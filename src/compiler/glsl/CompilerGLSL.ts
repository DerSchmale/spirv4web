import { Compiler } from "../Compiler";
import { ParsedIR } from "../../parser/ParsedIR";
import { LocationComponentPair } from "../../common/LocationComponentPair";
import { BuiltIn, Decoration, Dim, StorageClass } from "../../spirv";
import { Pair } from "../../utils/Pair";
import { SPIRVariable } from "../../common/SPIRVariable";
import { SPIRType, SPIRTypeBaseType } from "../../common/SPIRType";
import { BackendVariations } from "./glsl";
import { PlsRemap } from "./PlsRemap";
import { GLSLOptions } from "./GLSLOptions";
import { Types } from "../../common/Types";
import { ExtendedDecorations } from "../../common/Meta";

export class CompilerGLSL extends Compiler
{
    protected backend: BackendVariations = new BackendVariations();

    protected flattened_buffer_blocks: Set<number> = new Set();

    protected forced_extensions: string[] = [];

    protected pls_inputs: PlsRemap[];
    protected pls_outputs: PlsRemap[];

    // GL_EXT_shader_framebuffer_fetch support.
    protected subpass_to_framebuffer_fetch_attachment: Pair<number, number>[] = [];
    protected inout_color_attachments: Pair<number, boolean>[] = [];

    protected masked_output_locations: Set<LocationComponentPair> = new Set();
    protected masked_output_builtins: Set<number> = new Set();

    private options: GLSLOptions = new GLSLOptions();
    private current_locale_radix_character: string = ".";

    constructor(parsedIR: ParsedIR)
    {
        super(parsedIR);
        this.init();
    }

    remap_pixel_local_storage(inputs: PlsRemap[], outputs: PlsRemap[])
    {
        this.pls_inputs = inputs;
        this.pls_outputs = outputs;
        this.remap_pls_variables();
    }

    // Redirect a subpassInput reading from input_attachment_index to instead load its value from
    // the color attachment at location = color_location. Requires ESSL.
    // If coherent, uses GL_EXT_shader_framebuffer_fetch, if not, uses noncoherent variant.
    remap_ext_framebuffer_fetch(input_attachment_index: number, color_location: number, coherent: boolean)
    {
        this.subpass_to_framebuffer_fetch_attachment.push(new Pair(input_attachment_index, color_location));
        this.inout_color_attachments.push(new Pair(color_location, coherent));
    }

    get_common_options(): GLSLOptions
    {
        return this.options;
    }

    // Adds an extension which is required to run this shader, e.g.
    // require_extension("GL_KHR_my_extension");
    require_extension(ext: string)
    {
        if (!this.has_extension(ext))
            this.forced_extensions.push(ext);
    }

    // Legacy GLSL compatibility method.
    // Takes a uniform or push constant variable and flattens it into a (i|u)vec4 array[N]; array instead.
    // For this to work, all types in the block must be the same basic type, e.g. mixing vec2 and vec4 is fine, but
    // mixing int and float is not.
    // The name of the uniform array will be the same as the interface block name.
    flatten_buffer_block(id: VariableID)
    {
        const var_ = this.get<SPIRVariable>(SPIRVariable, id);
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const name = this.to_name(type.self, false);
        const flags = this.ir.meta[type.self].decoration.decoration_flags;

        if (type.array.length > 0)
            throw new Error(name + " is an array of UBOs.");
        if (type.basetype !== SPIRTypeBaseType.Struct)
            throw new Error(name + " is not a struct.");
        if (!flags.get(Decoration.DecorationBlock))
            throw new Error(name + " is not a block.");
        if (type.member_types.length === 0)
            throw new Error(name + " is an empty struct.");

        this.flattened_buffer_blocks.add(id);
    }

    // If a shader output is active in this stage, but inactive in a subsequent stage,
    // this can be signalled here. This can be used to work around certain cross-stage matching problems
    // which plagues MSL and HLSL in certain scenarios.
    // An output which matches one of these will not be emitted in stage output interfaces, but rather treated as a private
    // variable.
    // This option is only meaningful for MSL and HLSL, since GLSL matches by location directly.
    // Masking builtins only takes effect if the builtin in question is part of the stage output interface.
    mask_stage_output_by_location(location: number, component: number)
    {
        this.masked_output_locations.add(new LocationComponentPair(location, component));
    }

    mask_stage_output_by_builtin(builtin: BuiltIn)
    {
        this.masked_output_builtins.add(builtin);
    }

    protected has_extension(ext: string): boolean
    {
        return this.forced_extensions.indexOf(ext) >= 0;
    }

    protected require_extension_internal(ext: string)
    {
        if (this.backend.supports_extensions && !this.has_extension(ext)) {
            this.forced_extensions.push(ext);
            this.force_recompile();
        }
    }

    protected is_legacy(): boolean
    {
        const options = this.options;
        return (options.es && options.version < 300) || (!options.es && options.version < 130);
    }

    protected is_legacy_es(): boolean
    {
        const options = this.options;
        return options.es && options.version < 300;
    }

    protected is_legacy_desktop(): boolean
    {
        const options = this.options;
        return !options.es && options.version < 130;
    }


    protected remap_pls_variables()
    {
        for (let input of this.pls_inputs) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, input.id);

            let input_is_target = false;
            if (var_.storage === StorageClass.StorageClassUniformConstant) {
                let type = this.get<SPIRType>(SPIRType, var_.basetype);
                input_is_target = type.image.dim === Dim.DimSubpassData;
            }

            if (var_.storage !== StorageClass.StorageClassInput && !input_is_target)
                throw new Error("Can only use in and target variables for PLS inputs.");

            var_.remapped_variable = true;
        }

        for (let output of this.pls_outputs) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, output.id);
            if (var_.storage !== StorageClass.StorageClassOutput)
                throw new Error("Can only use out variables for PLS outputs.");
            var_.remapped_variable = true;
        }
    }

    private init(): void
    {
        const ir = this.ir;
        const options = this.options;

        if (ir.source.known) {
            options.es = ir.source.es;
            options.version = ir.source.version;
        }
    }

    compile(): string
    {
        const ir = this.ir;
        const options = this.options;
        const backend = this.backend;

        ir.fixup_reserved_names();

        // if (!options.vulkan_semantics)
        // {
        // only NV_gpu_shader5 supports divergent indexing on OpenGL, and it does so without extra qualifiers
        backend.nonuniform_qualifier = "";
        backend.needs_row_major_load_workaround = true;
        // }
        backend.allow_precision_qualifiers = /*options.vulkan_semantics ||*/ options.es;
        backend.force_gl_in_out_block = true;
        backend.supports_extensions = true;
        backend.use_array_constructor = true;
        backend.workgroup_size_is_hidden = true;

        backend.support_precise_qualifier = (!options.es && options.version >= 400) || (options.es && options.version >= 320);

        if (this.is_legacy_es())
            backend.support_case_fallthrough = false;

        // Scan the SPIR-V to find trivial uses of extensions.
        this.fixup_type_alias();
        this.reorder_type_alias();
        this.build_function_control_flow_graphs_and_analyze();
        /*find_static_extensions();
        fixup_image_load_store_access();
        update_active_builtins();
        analyze_image_and_sampler_usage();
        analyze_interlocked_resource_usage();
        if (!inout_color_attachments.empty())
            emit_inout_fragment_outputs_copy_to_subpass_inputs();

        // Shaders might cast unrelated data to pointers of non-block types.
        // Find all such instances and make sure we can cast the pointers to a synthesized block type.
        if (ir.addressing_model == AddressingModelPhysicalStorageBuffer64EXT)
            analyze_non_block_pointer_types();

        uint32_t;
        pass_count = 0;
        do {
            if (pass_count >= 3)
                SPIRV_CROSS_THROW("Over 3 compilation loops detected. Must be a bug!");

            reset();

            buffer.reset();

            emit_header();
            emit_resources();
            emit_extension_workarounds(get_execution_model());

            emit_function(get<SPIRFunction>(ir.default_entry_point), Bitset());

            pass_count++;
        } while (is_forcing_recompilation());

        // Implement the interlocked wrapper function at the end.
        // The body was implemented in lieu of main().
        if (interlocked_is_complex) {
            statement("void main()");
            begin_scope();
            statement("// Interlocks were used in a way not compatible with GLSL, this is very slow.");
            statement("SPIRV_Cross_beginInvocationInterlock();");
            statement("spvMainInterlockedBody();");
            statement("SPIRV_Cross_endInvocationInterlock();");
            end_scope();
        }

        // Entry point in GLSL is always main().
        get_entry_point().name = "main";

        return buffer.str();*/
        return "";
    }

    protected fixup_type_alias()
    {
        const ir = this.ir;
// Due to how some backends work, the "master" type of type_alias must be a block-like type if it exists.
        ir.for_each_typed_id<SPIRType>(SPIRType, (self, type) =>
        {
            if (!type.type_alias)
                return;

            if (this.has_decoration(type.self, Decoration.DecorationBlock) || this.has_decoration(type.self, Decoration.DecorationBufferBlock)) {
                // Top-level block types should never alias anything else.
                type.type_alias = 0;
            }
            else if (this.type_is_block_like(type) && type.self === <ID>(self)) {
                // A block-like type is any type which contains Offset decoration, but not top-level blocks,
                // i.e. blocks which are placed inside buffers.
                // Become the master.
                ir.for_each_typed_id<SPIRType>(SPIRType, (other_id, other_type) =>
                {
                    if (other_id == self)
                        return;

                    if (other_type.type_alias == type.type_alias)
                        other_type.type_alias = self;
                });

                this.get<SPIRType>(SPIRType, type.type_alias).type_alias = self;
                type.type_alias = 0;
            }
        });
    }

    reorder_type_alias()
    {
        const ir = this.ir;
        // Reorder declaration of types so that the master of the type alias is always emitted first.
        // We need this in case a type B depends on type A (A must come before in the vector), but A is an alias of a type Abuffer, which
        // means declaration of A doesn't happen (yet), and order would be B, ABuffer and not ABuffer, B. Fix this up here.
        const loop_lock = ir.create_loop_hard_lock();

        const type_ids = ir.ids_for_type[Types.TypeType];
        for (let alias_itr of type_ids)
        {
            const type = this.get<SPIRType>(SPIRType, alias_itr);
            if (type.type_alias !== <TypeID>(0) &&
                !this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked))
            {
                // We will skip declaring this type, so make sure the type_alias type comes before.
                const master_itr = type_ids.indexOf(<ID>(type.type_alias));
                console.assert(master_itr >= 0);

                if (alias_itr < master_itr)
                {
                    // Must also swap the type order for the constant-type joined array.
                    const joined_types = ir.ids_for_constant_or_type;
                    const alt_alias_itr = joined_types.indexOf(alias_itr);
                    const alt_master_itr = joined_types.indexOf(master_itr);
                    console.assert(alt_alias_itr >= 0);
                    console.assert(alt_master_itr >= 0);

                    swap(joined_types, alias_itr, master_itr);
                    swap(joined_types, alt_alias_itr, alt_master_itr);
                }
            }
        }

        loop_lock.dispose();
    }
}

function swap(arr: number[], a: number, b:number)
{
    const t = a[a]
    arr[a] = arr[b];
    arr[b] = t;
}