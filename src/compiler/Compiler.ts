// @ts-ignore
import { count, unique } from "@derschmale/array-utils";
import { BlockMetaFlagBits, ParsedIR } from "../parser/ParsedIR";
import { SPIRType, SPIRTypeBaseType } from "../common/SPIRType";
import { BuiltIn, Decoration, Dim, ExecutionMode, ExecutionModel, ImageFormat, Op, StorageClass } from "../spirv";
import { Types } from "../common/Types";
import { SPIRConstant } from "../common/SPIRConstant";
import { SPIRVariable } from "../common/SPIRVariable";
import { IVariant, IVariantType } from "../common/IVariant";
import { variant_get, variant_set } from "../common/Variant";
import { SPIREntryPoint } from "../common/SPIREntryPoint";
import { EntryPoint } from "./EntryPoint";
import { DummySamplerForCombinedImageHandler } from "./DummySamplerForCombinedImageHandler";
import { SPIRFunction } from "../common/SPIRFunction";
import { SPIRExpression } from "../common/SPIRExpression";
import {
    SPIRBlock,
    SPIRBlockCase,
    SPIRBlockContinueBlockType,
    SPIRBlockMerge,
    SPIRBlockMethod,
    SPIRBlockTerminator
} from "../common/SPIRBlock";
import { SPIRAccessChain } from "../common/SPIRAccessChain";
import { SPIRConstantOp } from "../common/SPIRConstantOp";
import { SPIRCombinedImageSampler } from "../common/SPIRCombinedImageSampler";
import { SPIRUndef } from "../common/SPIRUndef";
import { OpcodeHandler } from "./OpcodeHandler";
import { EmbeddedInstruction, Instruction } from "../common/Instruction";
import { defaultCopy } from "../utils/defaultCopy";
import { InterfaceVariableAccessHandler } from "./InterfaceVariableAccessHandler";
import { BuiltInResource, Resource, ShaderResources } from "./ShaderResources";
import { ExtendedDecorations, Meta, MetaDecoration } from "../common/Meta";
import { Bitset } from "../common/Bitset";
import { CombinedImageSampler } from "./CombinedImageSampler";
import { CombinedImageSamplerHandler } from "./CombinedImageSamplerHandler";
import { CFGBuilder } from "./CFGBuilder";
import { CFG } from "../cfg/CFG";
import { AnalyzeVariableScopeAccessHandler } from "./AnalyzeVariableScopeAccessHandler";
import { maplike_get } from "../utils/maplike_get";
import { Pair } from "../utils/Pair";
import { DominatorBuilder } from "../cfg/DominatorBuilder";
import { StaticExpressionAccessHandler } from "./StaticExpressionAccessHandler";
import { ActiveBuiltinHandler } from "./ActiveBuiltinHandler";
import { CombinedImageSamplerDrefHandler } from "./CombinedImageSamplerDrefHandler";
import { CombinedImageSamplerUsageHandler } from "./CombinedImageSamplerUsageHandler";
import { InterlockedResourceAccessPrepassHandler } from "./InterlockedResourceAccessPrepassHandler";
import { InterlockedResourceAccessHandler } from "./InterlockedResourceAccessHandler";
import { PhysicalBlockMeta } from "./PhysicalBlockMeta";
import { PhysicalStorageBufferPointerHandler } from "./PhysicalStorageBufferPointerHandler";
import { convert_to_string } from "../utils/string";
import { SPIRExtension, SPIRExtensionExtension } from "../common/SPIRExtension";
import { GLSLstd450 } from "./glsl/glsl";

type VariableTypeRemapCallback = (type: SPIRType, name: string, type_name: string) => string;

export abstract class Compiler
{
    ir: ParsedIR;
    // Marks variables which have global scope and variables which can alias with other variables
    // (SSBO, image load store, etc)
    protected global_variables: number[] = [];
    protected aliased_variables: number[] = [];

    protected current_function: SPIRFunction;
    protected current_block: SPIRBlock;
    protected current_loop_level: number = 0;
    protected active_interface_variables: Set<VariableID> = new Set();
    protected check_active_interface_variables: boolean = false;

    protected invalid_expressions: Set<number> = new Set();

    protected is_force_recompile: boolean = false;
    combined_image_samplers: CombinedImageSampler[] = [];

    protected variable_remap_callback: VariableTypeRemapCallback;

    protected forced_temporaries: Set<number> = new Set();
    protected forwarded_temporaries: Set<number> = new Set();
    protected suppressed_usage_tracking: Set<number> = new Set();
    protected hoisted_temporaries: Set<number> = new Set();
    protected forced_invariant_temporaries: Set<number> = new Set();

    active_input_builtins: Bitset = new Bitset();
    active_output_builtins: Bitset = new Bitset();
    clip_distance_count: number = 0;
    cull_distance_count: number = 0;
    position_invariant: boolean = false;

    // If a variable ID or parameter ID is found in this set, a sampler is actually a shadow/comparison sampler.
    // SPIR-V does not support this distinction, so we must keep track of this information outside the type system.
    // There might be unrelated IDs found in this set which do not correspond to actual variables.
    // This set should only be queried for the existence of samplers which are already known to be variables or parameter IDs.
    // Similar is implemented for images, as well as if subpass inputs are needed.
    protected comparison_ids: Set<number> = new Set<number>();
    protected need_subpass_input: boolean = false;

    // In certain backends, we will need to use a dummy sampler to be able to emit code.
    // GLSL does not support texelFetch on texture2D objects, but SPIR-V does,
    // so we need to workaround by having the application inject a dummy sampler.
    dummy_sampler_id: number;

    protected function_cfgs: CFG[]; // std::unordered_map<uint32_t, std::unique_ptr<CFG>>

    protected physical_storage_non_block_pointer_types: number[] = [];
    protected physical_storage_type_to_alignment: PhysicalBlockMeta[] = []; // map<uint32_t, PhysicalBlockMeta>

    // The set of all resources written while inside the critical section, if present.
    interlocked_resources: Set<number> = new Set();
    protected interlocked_is_complex: boolean = false;

    protected declared_block_names: string[] = [];

    constructor(parsedIR: ParsedIR)
    {
        this.set_ir(parsedIR);
    }

    // After parsing, API users can modify the SPIR-V via reflection and call this
    // to disassemble the SPIR-V into the desired langauage.
    // Sub-classes actually implement this.
    abstract compile(): string;

    // Gets the identifier (OpName) of an ID. If not defined, an empty string will be returned.
    get_name(id: ID): string
    {
        return this.ir.get_name(id);
    }

    // Applies a decoration to an ID. Effectively injects OpDecorate.
    set_decoration(id: ID, decoration: Decoration, argument: number = 0)
    {
        this.ir.set_decoration(id, decoration, argument);
    }

    protected set_decoration_string(id: ID, decoration: Decoration, argument: string)
    {
        this.ir.set_decoration_string(id, decoration, argument);
    }

    // Overrides the identifier OpName of an ID.
    // Identifiers beginning with underscores or identifiers which contain double underscores
    // are reserved by the implementation.
    set_name(id: ID, name: string)
    {
        this.ir.set_name(id, name);
    }

    // Gets a bitmask for the decorations which are applied to ID.
    // I.e. (1ull << Op.DecorationFoo) | (1ull << Op.DecorationBar)
    protected get_decoration_bitset(id: ID): Bitset
    {
        return this.ir.get_decoration_bitset(id);
    }

    // Returns the effective size of a buffer block struct member.
    protected get_declared_struct_member_size(struct_type: SPIRType, index: number): number
    {
        if (struct_type.member_types.length === 0)
            throw new Error("Declared struct in block cannot be empty.");

        const flags = this.get_member_decoration_bitset(struct_type.self, index);
        const type = this.get<SPIRType>(SPIRType, struct_type.member_types[index]);

        switch (type.basetype) {
            case SPIRTypeBaseType.Unknown:
            case SPIRTypeBaseType.Void:
            case SPIRTypeBaseType.Boolean: // Bools are purely logical, and cannot be used for externally visible types.
            case SPIRTypeBaseType.AtomicCounter:
            case SPIRTypeBaseType.Image:
            case SPIRTypeBaseType.SampledImage:
            case SPIRTypeBaseType.Sampler:
                throw new Error("Querying size for object with opaque size.");

            default:
                break;
        }

        if (type.pointer && type.storage === StorageClass.StorageClassPhysicalStorageBuffer) {
            // Check if this is a top-level pointer type, and not an array of pointers.
            if (type.pointer_depth > this.get<SPIRType>(SPIRType, type.parent_type).pointer_depth)
                return 8;
        }

        if (type.array.length > 0) {
            // For arrays, we can use ArrayStride to get an easy check.
            const array_size_literal = type.array_size_literal[type.array_size_literal.length - 1];
            const array_size = array_size_literal ? type.array[type.array.length - 1] : this.evaluate_constant_u32(type.array[type.array.length - 1]);
            return this.type_struct_member_array_stride(struct_type, index) * array_size;
        }
        else if (type.basetype === SPIRTypeBaseType.Struct) {
            return this.get_declared_struct_size(type);
        }
        else {
            const vecsize = type.vecsize;
            const columns = type.columns;

            // Vectors.
            if (columns === 1) {
                const component_size = type.width / 8;
                return vecsize * component_size;
            }
            else {
                const matrix_stride = this.type_struct_member_matrix_stride(struct_type, index);

                // Per SPIR-V spec, matrices must be tightly packed and aligned up for vec3 accesses.
                if (flags.get(Decoration.DecorationRowMajor))
                    return matrix_stride * vecsize;
                else if (flags.get(Decoration.DecorationColMajor))
                    return matrix_stride * columns;
                else
                    throw new Error("Either row-major or column-major must be declared for matrices.");
            }
        }
    }

    // Returns a set of all global variables which are statically accessed
    // by the control flow graph from the current entry point.
    // Only variables which change the interface for a shader are returned, that is,
    // variables with storage class of Input, Output, Uniform, UniformConstant, PushConstant and AtomicCounter
    // storage classes are returned.
    //
    // To use the returned set as the filter for which variables are used during compilation,
    // this set can be moved to set_enabled_interface_variables().
    get_active_interface_variables(): Set<VariableID>
    {
        // Traverse the call graph and find all interface variables which are in use.
        const ir = this.ir;
        const variables: Set<VariableID> = new Set();
        const handler = new InterfaceVariableAccessHandler(this, variables);
        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), handler);

        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_: number, var_: SPIRVariable) =>
        {
            if (var_.storage !== StorageClass.StorageClassOutput)
                return;
            if (!this.interface_variable_exists_in_entry_point(var_.self))
                return;

            // An output variable which is just declared (but uninitialized) might be read by subsequent stages
            // so we should force-enable these outputs,
            // since compilation will fail if a subsequent stage attempts to read from the variable in question.
            // Also, make sure we preserve output variables which are only initialized, but never accessed by any code.
            if (var_.initializer !== <ID>0 || this.get_execution_model() !== ExecutionModel.ExecutionModelFragment)
                variables.add(var_.self);
        });

        // If we needed to create one, we'll need it.
        if (this.dummy_sampler_id)
            variables.add(this.dummy_sampler_id);

        return variables;
    }

    // Sets the interface variables which are used during compilation.
    // By default, all variables are used.
    // Once set, compile() will only consider the set in active_variables.
    set_enabled_interface_variables(active_variables: Set<VariableID>)
    {
        this.active_interface_variables = active_variables;
        this.check_active_interface_variables = true;
    }

    // Query shader resources, use ids with reflection interface to modify or query binding points, etc.
    get_shader_resources(): ShaderResources;

    // Query shader resources, but only return the variables which are part of active_variables.
    // E.g.: get_shader_resources(get_active_variables()) to only return the variables which are statically
    // accessed.
    get_shader_resources(active_variables: Set<VariableID>): ShaderResources;

    get_shader_resources(active_variables?: Set<VariableID>): ShaderResources
    {
        const res = new ShaderResources();
        const ir = this.ir;
        const ssbo_instance_name = this.reflection_ssbo_instance_name_is_significant();

        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);

            // It is possible for uniform storage classes to be passed as function parameters, so detect
            // that. To detect function parameters, check of StorageClass of variable is function scope.
            if (var_.storage === StorageClass.StorageClassFunction || !type.pointer)
                return;

            if (active_variables && !active_variables.has(var_.self))
                return;

            // In SPIR-V 1.4 and up, every global must be present in the entry point interface list,
            // not just IO variables.
            let active_in_entry_point = true;
            if (ir.get_spirv_version() < 0x10400) {
                if (var_.storage === StorageClass.StorageClassInput || var_.storage === StorageClass.StorageClassOutput)
                    active_in_entry_point = this.interface_variable_exists_in_entry_point(var_.self);
            }
            else
                active_in_entry_point = this.interface_variable_exists_in_entry_point(var_.self);

            if (!active_in_entry_point)
                return;

            const is_builtin = this.is_builtin_variable(var_);

            if (is_builtin) {
                if (var_.storage !== StorageClass.StorageClassInput && var_.storage !== StorageClass.StorageClassOutput)
                    return;

                const list = var_.storage === StorageClass.StorageClassInput ? res.builtin_inputs : res.builtin_outputs;
                const resource: BuiltInResource = new BuiltInResource();

                if (this.has_decoration(type.self, Decoration.DecorationBlock)) {
                    resource.resource = new Resource(
                        var_.self, var_.basetype, type.self,
                        this.get_remapped_declared_block_name(var_.self, false)
                    );

                    for (let i = 0; i < type.member_types.length; i++) {
                        resource.value_type_id = type.member_types[i];
                        resource.builtin = <BuiltIn>this.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn);
                        list.push(resource);
                    }
                }
                else {
                    const strip_array = !this.has_decoration(var_.self, Decoration.DecorationPatch) && (
                        this.get_execution_model() === ExecutionModel.ExecutionModelTessellationControl ||
                        (this.get_execution_model() === ExecutionModel.ExecutionModelTessellationEvaluation &&
                            var_.storage === StorageClass.StorageClassInput));

                    resource.resource = new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self));

                    if (strip_array && type.array.length > 0)
                        resource.value_type_id = this.get_variable_data_type(var_).parent_type;
                    else
                        resource.value_type_id = this.get_variable_data_type_id(var_);

                    console.assert(resource.value_type_id);

                    resource.builtin = <BuiltIn>this.get_decoration(var_.self, Decoration.DecorationBuiltIn);
                    list.push(resource);
                }
                return;
            }

            // Input
            if (var_.storage === StorageClass.StorageClassInput) {
                if (this.has_decoration(type.self, Decoration.DecorationBlock)) {
                    res.stage_inputs.push(new Resource(
                        var_.self, var_.basetype, type.self,
                        this.get_remapped_declared_block_name(var_.self, false)
                    ));
                }
                else
                    res.stage_inputs.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // Subpass inputs
            else if (var_.storage === StorageClass.StorageClassUniformConstant && type.image.dim === Dim.DimSubpassData) {
                res.subpass_inputs.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // Outputs
            else if (var_.storage === StorageClass.StorageClassOutput) {
                if (this.has_decoration(type.self, Decoration.DecorationBlock)) {
                    res.stage_outputs.push(
                        new Resource(var_.self, var_.basetype, type.self, this.get_remapped_declared_block_name(var_.self, false))
                    );
                }
                else
                    res.stage_outputs.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // UBOs
            else if (type.storage === StorageClass.StorageClassUniform && this.has_decoration(type.self, Decoration.DecorationBlock)) {
                res.uniform_buffers.push(new Resource(
                    var_.self, var_.basetype, type.self, this.get_remapped_declared_block_name(var_.self, false)
                ));
            }
            // Old way to declare SSBOs.
            else if (type.storage === StorageClass.StorageClassUniform && this.has_decoration(type.self, Decoration.DecorationBufferBlock)) {
                res.storage_buffers.push(new Resource(
                    var_.self, var_.basetype, type.self, this.get_remapped_declared_block_name(var_.self, ssbo_instance_name)
                ));
            }
            // Modern way to declare SSBOs.
            else if (type.storage === StorageClass.StorageClassStorageBuffer) {
                res.storage_buffers.push(new Resource(
                    var_.self, var_.basetype, type.self, this.get_remapped_declared_block_name(var_.self, ssbo_instance_name)
                ));
            }
            // Push constant blocks
            else if (type.storage === StorageClass.StorageClassPushConstant) {
                // There can only be one push constant block, but keep the vector in case this restriction is lifted
                // in the future.
                res.push_constant_buffers.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // Images
            else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.Image &&
                type.image.sampled === 2) {
                res.storage_images.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // Separate images
            else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.Image &&
                type.image.sampled === 1) {
                res.separate_images.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // Separate samplers
            else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.Sampler) {
                res.separate_samplers.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // Textures
            else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.SampledImage) {
                res.sampled_images.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // Atomic counters
            else if (type.storage === StorageClass.StorageClassAtomicCounter) {
                res.atomic_counters.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
            // Acceleration structures
            else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.AccelerationStructure) {
                res.acceleration_structures.push(new Resource(var_.self, var_.basetype, type.self, this.get_name(var_.self)));
            }
        });

        return res;
    }

    get_common_basic_type(type: SPIRType): SPIRTypeBaseType
    {
        if (type.basetype === SPIRTypeBaseType.Struct) {
            let base_type = SPIRTypeBaseType.Unknown;
            for (let member_type of type.member_types) {
                const member_base = this.get_common_basic_type(this.get<SPIRType>(SPIRType, member_type));
                if (member_base === undefined)
                    return undefined;

                if (base_type === SPIRTypeBaseType.Unknown)
                    base_type = member_base;
                else if (base_type !== member_base)
                    return undefined;
            }
            return base_type;
        }
        else {
            return type.basetype;
        }
    }

    // Remapped variables are considered built-in variables and a backend will
    // not emit a declaration for this variable.
    // This is mostly useful for making use of builtins which are dependent on extensions.
    set_remapped_variable_state(id: VariableID, remap_enable: boolean)
    {
        this.get<SPIRVariable>(SPIRVariable, id).remapped_variable = remap_enable;
    }

    get_remapped_variable_state(id: VariableID): boolean
    {
        return this.get<SPIRVariable>(SPIRVariable, id).remapped_variable;
    }

    // For subpassInput variables which are remapped to plain variables,
    // the number of components in the remapped
    // variable must be specified as the backing type of subpass inputs are opaque.
    set_subpass_input_remapped_components(id: VariableID, components: number)
    {
        this.get<SPIRVariable>(SPIRVariable, id).remapped_components = components;
    }

    get_subpass_input_remapped_components(id: VariableID): number
    {
        return this.get<SPIRVariable>(SPIRVariable, id).remapped_components;
    }

    // All operations work on the current entry point.
    // Entry points can be swapped out with set_entry_point().
    // Entry points should be set right after the constructor completes as some reflection functions traverse the graph from the entry point.
    // Resource reflection also depends on the entry point.
    // By default, the current entry point is set to the first OpEntryPoint which appears in the SPIR-V module.

    // Some shader languages restrict the names that can be given to entry points, and the
    // corresponding backend will automatically rename an entry point name, during the call
    // to compile() if it is illegal. For example, the common entry point name main() is
    // illegal in MSL, and is renamed to an alternate name by the MSL backend.
    // Given the original entry point name contained in the SPIR-V, this function returns
    // the name, as updated by the backend during the call to compile(). If the name is not
    // illegal, and has not been renamed, or if this function is called before compile(),
    // this function will simply return the same name.

    // New variants of entry point query and reflection.
    // Names for entry points in the SPIR-V module may alias if they belong to different execution models.
    // To disambiguate, we must pass along with the entry point names the execution model.
    get_entry_points_and_stages(): EntryPoint[]
    {
        const entries: EntryPoint[] = [];
        this.ir.entry_points.forEach(entry =>
            entries.push(new EntryPoint(entry.orig_name, entry.model))
        );
        return entries;
    }

    set_entry_point(name: string, model: ExecutionModel)
    {
        const entry = this.get_entry_point(name, model);
        this.ir.default_entry_point = entry.self;
    }

    // Renames an entry point from old_name to new_name.
    // If old_name is currently selected as the current entry point, it will continue to be the current entry point,
    // albeit with a new name.
    // get_entry_points() is essentially invalidated at this point.
    rename_entry_point(old_name: string, new_name: string, model: ExecutionModel)
    {
        const entry = this.get_entry_point(old_name, model);
        entry.orig_name = new_name;
        entry.name = new_name;
    }

    get_entry_point(): SPIREntryPoint;
    get_entry_point(name: string, model: ExecutionModel): SPIREntryPoint;
    get_entry_point(...args): SPIREntryPoint
    {
        const ir = this.ir;
        if (args.length === 0) {
            return ir.entry_points[ir.default_entry_point];
        }
        else {
            const entry = ir.entry_points.find(entry => entry.orig_name === args[0] && entry.model === args[1]);
            if (!entry)
                throw new Error("Entry point does not exist.");
            return entry;
        }
    }

    // Traverses all reachable opcodes and sets active_builtins to a bitmask of all builtin variables which are accessed in the shader.
    update_active_builtins()
    {
        const ir = this.ir;

        this.active_input_builtins.reset();
        this.active_output_builtins.reset();
        this.cull_distance_count = 0;
        this.clip_distance_count = 0;
        const handler = new ActiveBuiltinHandler(this);

        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), handler);

        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_: SPIRVariable) =>
        {
            if (var_.storage !== StorageClass.StorageClassOutput)
                return;

            if (!this.interface_variable_exists_in_entry_point(var_.self))
                return;

            // Also, make sure we preserve output variables which are only initialized, but never accessed by any code.
            if (var_.initializer !== <ID>(0))
                handler.add_if_builtin_or_block(var_.self);
        });
    }

    has_active_builtin(builtin: BuiltIn, storage: StorageClass): boolean
    {
        let flags: Bitset;
        switch (storage) {
            case StorageClass.StorageClassInput:
                flags = this.active_input_builtins;
                break;
            case StorageClass.StorageClassOutput:
                flags = this.active_output_builtins;
                break;

            default:
                return false;
        }
        return flags.get(builtin);
    }

    get_execution_model(): ExecutionModel
    {
        return this.get_entry_point().model;
    }

    // Analyzes all OpImageFetch (texelFetch) opcodes and checks if there are instances where
    // said instruction is used without a combined image sampler.
    // GLSL targets do not support the use of texelFetch without a sampler.
    // To workaround this, we must inject a dummy sampler which can be used to form a sampler2D at the call-site of
    // texelFetch as necessary.
    //
    // This must be called before build_combined_image_samplers().
    // build_combined_image_samplers() may refer to the ID returned by this method if the returned ID is non-zero.
    // The return value will be the ID of a sampler object if a dummy sampler is necessary, or 0 if no sampler object
    // is required.
    //
    // If the returned ID is non-zero, it can be decorated with set/bindings as desired before calling compile().
    // Calling this function also invalidates get_active_interface_variables(), so this should be called
    // before that function.
    build_dummy_sampler_for_combined_images(): VariableID
    {
        const handler = new DummySamplerForCombinedImageHandler(this);
        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, this.ir.default_entry_point), handler);

        const ir = this.ir;
        if (handler.need_dummy_sampler) {
            const offset: number = ir.increase_bound_by(3);
            const type_id = offset;
            const ptr_type_id = offset + 1;
            const var_id = offset + 2;

            // let sampler_type: SPIRType;
            const sampler = this.set<SPIRType>(SPIRType, type_id);
            sampler.basetype = SPIRTypeBaseType.Sampler;

            const ptr_sampler = this.set<SPIRType>(SPIRType, ptr_type_id);
            defaultCopy(sampler, ptr_sampler);
            ptr_sampler.self = type_id;
            ptr_sampler.storage = StorageClass.StorageClassUniformConstant;
            ptr_sampler.pointer = true;
            ptr_sampler.parent_type = type_id;

            this.set<SPIRVariable>(SPIRVariable, var_id, ptr_type_id, StorageClass.StorageClassUniformConstant, 0);
            this.set_name(var_id, "SPIRV_Cross_DummySampler");
            this.dummy_sampler_id = var_id;
            return var_id;
        }
        else
            return 0;
    }

    // Analyzes all separate image and samplers used from the currently selected entry point,
    // and re-routes them all to a combined image sampler instead.
    // This is required to "support" separate image samplers in targets which do not natively support
    // this feature, like GLSL/ESSL.
    //
    // This must be called before compile() if such remapping is desired.
    // This call will add new sampled images to the SPIR-V,
    // so it will appear in reflection if get_shader_resources() is called after build_combined_image_samplers.
    //
    // If any image/sampler remapping was found, no separate image/samplers will appear in the decompiled output,
    // but will still appear in reflection.
    //
    // The resulting samplers will be void of any decorations like name, descriptor sets and binding points,
    // so this can be added before compile() if desired.
    //
    // Combined image samplers originating from this set are always considered active variables.
    // Arrays of separate samplers are not supported, but arrays of separate images are supported.
    // Array of images + sampler -> Array of combined image samplers.
    build_combined_image_samplers()
    {
        this.ir.for_each_typed_id<SPIRFunction>(SPIRFunction, (_, func) =>
        {
            func.combined_parameters = [];
            func.shadow_arguments = [];
            func.do_combined_parameters = true;
        });

        this.combined_image_samplers = [];
        const handler = new CombinedImageSamplerHandler(this);
        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, this.ir.default_entry_point), handler);
    }

    // Gets a remapping for the combined image samplers.
    get_combined_image_samplers(): CombinedImageSampler[]
    {
        return this.combined_image_samplers;
    }

    // Set a new variable type remap callback.
    // The type remapping is designed to allow global interface variable to assume more special types.
    // A typical example here is to remap sampler2D into samplerExternalOES, which currently isn't supported
    // directly by SPIR-V.
    //
    // In compile() while emitting code,
    // for every variable that is declared, including function parameters, the callback will be called
    // and the API user has a chance to change the textual representation of the type used to declare the variable.
    // The API user can detect special patterns in names to guide the remapping.
    set_variable_type_remap_callback(cb: VariableTypeRemapCallback)
    {
        this.variable_remap_callback = cb;
    }

    get_current_id_bound(): number
    {
        return this.ir.ids.length;
    }

    protected stream(instr: Instruction): Uint32Array
    {
        // If we're not going to use any arguments, just return nullptr.
        // We want to avoid case where we return an out of range pointer
        // that trips debug assertions on some platforms.
        if (!instr.length)
            return null;

        if (instr.is_embedded()) {
            const embedded = <EmbeddedInstruction>(instr);
            console.assert(embedded.ops.length === instr.length);
            return new Uint32Array(embedded.ops);
        }
        else {
            if (instr.offset + instr.length > this.ir.spirv.length)
                throw new Error("Compiler::stream() out of range.");

            return this.ir.spirv.slice(instr.offset, instr.offset + instr.length);
        }
    }

    execution_is_branchless(from: SPIRBlock, to: SPIRBlock): boolean
    {
        let start = from;
        for (; ;) {
            if (start.self === to.self)
                return true;

            if (start.terminator === SPIRBlockTerminator.Direct && start.merge === SPIRBlockMerge.MergeNone)
                start = this.get<SPIRBlock>(SPIRBlock, start.next_block);
            else
                return false;
        }
    }

    execution_is_direct_branch(from: SPIRBlock, to: SPIRBlock): boolean
    {
        return from.terminator === SPIRBlockTerminator.Direct && from.merge === SPIRBlockMerge.MergeNone && from.next_block === to.self;
    }

    protected is_break(next: number): boolean
    {
        this.ir.block_meta[next] = this.ir.block_meta[next] || 0;
        return (this.ir.block_meta[next] & (BlockMetaFlagBits.BLOCK_META_LOOP_MERGE_BIT | BlockMetaFlagBits.BLOCK_META_MULTISELECT_MERGE_BIT)) !== 0;
    }

    protected is_loop_break(next: number): boolean
    {
        this.ir.block_meta[next] = this.ir.block_meta[next] || 0;
        return (this.ir.block_meta[next] & BlockMetaFlagBits.BLOCK_META_LOOP_MERGE_BIT) !== 0;
    }

    protected is_conditional(next: number): boolean
    {
        this.ir.block_meta[next] = this.ir.block_meta[next] || 0;
        return (this.ir.block_meta[next] & (BlockMetaFlagBits.BLOCK_META_SELECTION_MERGE_BIT | BlockMetaFlagBits.BLOCK_META_MULTISELECT_MERGE_BIT)) !== 0;
    }

    protected flush_dependees(var_: SPIRVariable)
    {
        for (let expr of var_.dependees)
            this.invalid_expressions.add(expr);
        var_.dependees = [];
    }

    protected flush_all_active_variables()
    {
        // Invalidate all temporaries we read from variables in this block since they were forwarded.
        // Invalidate all temporaries we read from globals.
        for (let v of this.current_function.local_variables)
            this.flush_dependees(this.get<SPIRVariable>(SPIRVariable, v));
        for (let arg of this.current_function.arguments)
            this.flush_dependees(this.get<SPIRVariable>(SPIRVariable, arg.id));
        for (let global of this.global_variables)
            this.flush_dependees(this.get<SPIRVariable>(SPIRVariable, global));

        this.flush_all_aliased_variables();
    }

    protected flush_all_aliased_variables()
    {
        for (let aliased of this.aliased_variables)
            this.flush_dependees(this.get<SPIRVariable>(SPIRVariable, aliased));
    }

    protected flush_control_dependent_expressions(block_id: number)
    {
        const block = this.get<SPIRBlock>(SPIRBlock, block_id);
        for (let expr of block.invalidate_expressions)
            this.invalid_expressions.add(expr);
        block.invalidate_expressions = [];
    }

    protected register_global_read_dependencies(func: SPIRBlock | SPIRFunction, id: number)
    {
        if (func instanceof SPIRFunction) {
            for (let block of func.blocks)
                this.register_global_read_dependencies(this.get<SPIRBlock>(SPIRBlock, block), id);
            return;
        }

        const block = func;
        for (let i of block.ops)
        {
            const ops = this.stream(i);
            const op = <Op>(i.op);

            switch (op)
            {
                case Op.OpFunctionCall:
                {
                    const func = ops[2];
                    this.register_global_read_dependencies(this.get<SPIRFunction>(SPIRFunction, func), id);
                    break;
                }

                case Op.OpLoad:
                case Op.OpImageRead:
                {
                    // If we're in a storage class which does not get invalidated, adding dependencies here is no big deal.
                    const var_ = this.maybe_get_backing_variable(ops[2]);
                    if (var_ && var_.storage !== StorageClass.StorageClassFunction)
                    {
                        const type = this.get<SPIRType>(SPIRType, var_.basetype);

                        // InputTargets are immutable.
                        if (type.basetype != SPIRTypeBaseType.Image && type.image.dim !== Dim.DimSubpassData)
                            var_.dependees.push(id);
                    }
                    break;
                }

                default:
                    break;
            }
        }
    }

    update_name_cache(cache_primary: Set<string>, name: string): string;
    update_name_cache(cache_primary: Set<string>, cache_secondary: Set<string>, name: string): string;

    // A variant which takes two sets of names. The secondary is only used to verify there are no collisions,
    // but the set is not updated when we have found a new name.
    // Used primarily when adding block interface names.
    update_name_cache(cache_primary: Set<string>, cache_secondary: Set<string> | string, name?: string): string
    {
        if (!name) {
            // first overload
            name = <string>cache_secondary;
            cache_secondary = cache_primary;
            return this.update_name_cache(cache_primary, cache_secondary, name);
        }

        if (name === "")
            return name;

        const find_name = (n: string): boolean =>
        {
            if (cache_primary.has(n))
                return true;

            if (cache_primary !== cache_secondary)
                if ((<Set<string>>cache_secondary).has(n))
                    return true;

            return false;
        };

        const insert_name = (n: string) =>
        {
            cache_primary.add(n);
        };

        if (!find_name(name)) {
            insert_name(name);
            return name;
        }

        let counter = 0;
        let tmpname = name;

        let use_linked_underscore = true;

        if (tmpname === "_") {
            // We cannot just append numbers, as we will end up creating internally reserved names.
            // Make it like _0_<counter> instead.
            tmpname += "0";
        }
        else if (tmpname.charAt(tmpname.length - 1) === "_") {
            // The last_character is an underscore, so we don't need to link in underscore.
            // This would violate double underscore rules.
            use_linked_underscore = false;
        }

        // If there is a collision (very rare),
        // keep tacking on extra identifier until it's unique.
        do {
            counter++;
            name = tmpname + (use_linked_underscore ? "_" : "") + convert_to_string(counter);
        } while (find_name(name));
        insert_name(name);

        return name;
    }

    protected function_is_pure(func: SPIRFunction): boolean
    {
        for (const block of func.blocks)
        {
            if (!this.block_is_pure(this.get<SPIRBlock>(SPIRBlock, block)))
            {
                //fprintf(stderr, "Function %s is impure!\n", to_name(func.self).c_str());
                return false;
            }
        }

        //fprintf(stderr, "Function %s is pure!\n", to_name(func.self).c_str());
        return true;
    }

    protected block_is_pure(block: SPIRBlock)
    {
        // This is a global side effect of the function.
        if (block.terminator === SPIRBlockTerminator.Kill ||
            block.terminator === SPIRBlockTerminator.TerminateRay ||
            block.terminator === SPIRBlockTerminator.IgnoreIntersection)
            return false;

        for (let i of block.ops)
        {
            const ops = this.stream(i);
            const op = <Op>(i.op);

            switch (op)
            {
                case Op.OpFunctionCall:
                {
                    const func = ops[2];
                    if (!this.function_is_pure(this.get<SPIRFunction>(SPIRFunction, func)))
                        return false;
                    break;
                }

                case Op.OpCopyMemory:
                case Op.OpStore:
                {
                    const type = this.expression_type(ops[0]);
                    if (type.storage !== StorageClass.StorageClassFunction)
                        return false;
                    break;
                }

                case Op.OpImageWrite:
                    return false;

                // Atomics are impure.
                /*case OpAtomicLoad:
                case OpAtomicStore:
                case OpAtomicExchange:
                case OpAtomicCompareExchange:
                case OpAtomicCompareExchangeWeak:
                case OpAtomicIIncrement:
                case OpAtomicIDecrement:
                case OpAtomicIAdd:
                case OpAtomicISub:
                case OpAtomicSMin:
                case OpAtomicUMin:
                case OpAtomicSMax:
                case OpAtomicUMax:
                case OpAtomicAnd:
                case OpAtomicOr:
                case OpAtomicXor:
                    return false;*/

                // Geometry shader builtins modify global state.
                /*case OpEndPrimitive:
                case OpEmitStreamVertex:
                case OpEndStreamPrimitive:
                case OpEmitVertex:
                    return false;*/

                // Barriers disallow any reordering, so we should treat blocks with barrier as writing.
                case Op.OpControlBarrier:
                case Op.OpMemoryBarrier:
                    return false;

                // Ray tracing builtins are impure.
                /*case OpReportIntersectionKHR:
                case OpIgnoreIntersectionNV:
                case OpTerminateRayNV:
                case OpTraceNV:
                case OpTraceRayKHR:
                case OpExecuteCallableNV:
                case OpExecuteCallableKHR:
                case OpRayQueryInitializeKHR:
                case OpRayQueryTerminateKHR:
                case OpRayQueryGenerateIntersectionKHR:
                case OpRayQueryConfirmIntersectionKHR:
                case OpRayQueryProceedKHR:
                    // There are various getters in ray query, but they are considered pure.
                    return false;*/

                // OpExtInst is potentially impure depending on extension, but GLSL builtins are at least pure.

                case Op.OpDemoteToHelperInvocationEXT:
                    // This is a global side effect of the function.
                    return false;

                case Op.OpExtInst:
                {
                    const extension_set = ops[2];
                    if (this.get<SPIRExtension>(SPIRExtension, extension_set).ext === SPIRExtensionExtension.GLSL)
                    {
                        const op_450 = <GLSLstd450>(ops[3]);
                        switch (op_450)
                        {
                            case GLSLstd450.GLSLstd450Modf:
                            case GLSLstd450.GLSLstd450Frexp:
                            {
                                const type = this.expression_type(ops[5]);
                                if (type.storage !== StorageClass.StorageClassFunction)
                                    return false;
                                break;
                            }

                            default:
                                break;
                        }
                    }
                    break;
                }

                default:
                    break;
            }
        }

        return true;
    }

    protected execution_is_noop(from: SPIRBlock, to: SPIRBlock): boolean
    {
        if (!this.execution_is_branchless(from, to))
            return false;

        let start = from;
        for (; ;) {
            if (start.self === to.self)
                return true;

            if (start.ops.length > 0)
                return false;

            const next = this.get<SPIRBlock>(SPIRBlock, start.next_block);
            // Flushing phi variables does not count as noop.
            for (let phi of next.phi_variables)
                if (phi.parent === start.self)
                    return false;

            start = next;
        }
    }

    protected continue_block_type(block: SPIRBlock): SPIRBlockContinueBlockType
    {
// The block was deemed too complex during code emit, pick conservative fallback paths.
        if (block.complex_continue)
            return SPIRBlockContinueBlockType.ComplexLoop;

        // In older glslang output continue block can be equal to the loop header.
        // In this case, execution is clearly branchless, so just assume a while loop header here.
        if (block.merge === SPIRBlockMerge.MergeLoop)
            return SPIRBlockContinueBlockType.WhileLoop;

        if (block.loop_dominator === SPIRBlock.NoDominator) {
            // Continue block is never reached from CFG.
            return SPIRBlockContinueBlockType.ComplexLoop;
        }

        const dominator = this.get<SPIRBlock>(SPIRBlock, block.loop_dominator);

        if (this.execution_is_noop(block, dominator))
            return SPIRBlockContinueBlockType.WhileLoop;
        else if (this.execution_is_branchless(block, dominator))
            return SPIRBlockContinueBlockType.ForLoop;
        else {
            const false_block = this.maybe_get<SPIRBlock>(SPIRBlock, block.false_block);
            const true_block = this.maybe_get<SPIRBlock>(SPIRBlock, block.true_block);
            const merge_block = this.maybe_get<SPIRBlock>(SPIRBlock, dominator.merge_block);

            // If we need to flush Phi in this block, we cannot have a DoWhile loop.
            const flush_phi_to_false = false_block && this.flush_phi_required(block.self, block.false_block);
            const flush_phi_to_true = true_block && this.flush_phi_required(block.self, block.true_block);
            if (flush_phi_to_false || flush_phi_to_true)
                return SPIRBlockContinueBlockType.ComplexLoop;

            const positive_do_while = block.true_block === dominator.self &&
                (block.false_block === dominator.merge_block ||
                    (false_block && merge_block && this.execution_is_noop(false_block, merge_block)));

            const negative_do_while = block.false_block === dominator.self &&
                (block.true_block === dominator.merge_block ||
                    (true_block && merge_block && this.execution_is_noop(true_block, merge_block)));

            if (block.merge === SPIRBlockMerge.MergeNone && block.terminator === SPIRBlockTerminator.Select &&
                (positive_do_while || negative_do_while)) {
                return SPIRBlockContinueBlockType.DoWhileLoop;
            }
            else
                return SPIRBlockContinueBlockType.ComplexLoop;
        }
    }

    protected force_recompile()
    {
        this.is_force_recompile = true;
    }

    protected is_forcing_recompilation(): boolean
    {
        return this.is_force_recompile;
    }

    protected block_is_loop_candidate(block: SPIRBlock, method: SPIRBlockMethod): boolean
    {
// Tried and failed.
        if (block.disable_block_optimization || block.complex_continue)
            return false;

        if (method === SPIRBlockMethod.MergeToSelectForLoop || method === SPIRBlockMethod.MergeToSelectContinueForLoop) {
            // Try to detect common for loop pattern
            // which the code backend can use to create cleaner code.
            // for(;;) { if (cond) { some_body; } else { break; } }
            // is the pattern we're looking for.
            const false_block = this.maybe_get<SPIRBlock>(SPIRBlock, block.false_block);
            const true_block = this.maybe_get<SPIRBlock>(SPIRBlock, block.true_block);
            const merge_block = this.maybe_get<SPIRBlock>(SPIRBlock, block.merge_block);

            const false_block_is_merge = block.false_block === block.merge_block ||
                (false_block && merge_block && this.execution_is_noop(false_block, merge_block));

            const true_block_is_merge = block.true_block === block.merge_block ||
                (true_block && merge_block && this.execution_is_noop(true_block, merge_block));

            const positive_candidate =
                block.true_block !== block.merge_block && block.true_block !== block.self && false_block_is_merge;

            const negative_candidate =
                block.false_block !== block.merge_block && block.false_block !== block.self && true_block_is_merge;

            let ret = block.terminator === SPIRBlockTerminator.Select && block.merge === SPIRBlockMerge.MergeLoop &&
                (positive_candidate || negative_candidate);

            if (ret && positive_candidate && method === SPIRBlockMethod.MergeToSelectContinueForLoop)
                ret = block.true_block === block.continue_block;
            else if (ret && negative_candidate && method === SPIRBlockMethod.MergeToSelectContinueForLoop)
                ret = block.false_block === block.continue_block;

            // If we have OpPhi which depends on branches which came from our own block,
            // we need to flush phi variables in else block instead of a trivial break,
            // so we cannot assume this is a for loop candidate.
            if (ret) {
                for (let phi of block.phi_variables)
                    if (phi.parent === block.self)
                        return false;

                const merge = this.maybe_get<SPIRBlock>(SPIRBlock, block.merge_block);
                if (merge)
                    for (let phi of merge.phi_variables)
                        if (phi.parent === block.self)
                            return false;
            }
            return ret;
        }
        else if (method === SPIRBlockMethod.MergeToDirectForLoop) {
            // Empty loop header that just sets up merge target
            // and branches to loop body.
            let ret = block.terminator === SPIRBlockTerminator.Direct && block.merge === SPIRBlockMerge.MergeLoop && block.ops.length === 0;

            if (!ret)
                return false;

            const child = this.get<SPIRBlock>(SPIRBlock, block.next_block);

            const false_block = this.maybe_get<SPIRBlock>(SPIRBlock, child.false_block);
            const true_block = this.maybe_get<SPIRBlock>(SPIRBlock, child.true_block);
            const merge_block = this.maybe_get<SPIRBlock>(SPIRBlock, block.merge_block);

            const false_block_is_merge = child.false_block === block.merge_block ||
                (false_block && merge_block && this.execution_is_noop(false_block, merge_block));

            const true_block_is_merge = child.true_block === block.merge_block ||
                (true_block && merge_block && this.execution_is_noop(true_block, merge_block));

            const positive_candidate = child.true_block !== block.merge_block && child.true_block !== block.self && false_block_is_merge;

            const negative_candidate = child.false_block !== block.merge_block && child.false_block !== block.self && true_block_is_merge;

            ret = child.terminator === SPIRBlockTerminator.Select && child.merge === SPIRBlockMerge.MergeNone &&
                (positive_candidate || negative_candidate);

            // If we have OpPhi which depends on branches which came from our own block,
            // we need to flush phi variables in else block instead of a trivial break,
            // so we cannot assume this is a for loop candidate.
            if (ret) {
                for (let phi of block.phi_variables)
                    if (phi.parent === block.self || phi.parent === child.self)
                        return false;

                for (let phi of child.phi_variables)
                    if (phi.parent === block.self)
                        return false;

                const merge = this.maybe_get<SPIRBlock>(SPIRBlock, block.merge_block);
                if (merge)
                    for (let phi of merge.phi_variables)
                        if (phi.parent === block.self || phi.parent === child.false_block)
                            return false;
            }

            return ret;
        }
        else
            return false;
    }

    protected inherit_expression_dependencies(dst: number, source_expression: number)
    {
        // Don't inherit any expression dependencies if the expression in dst
        // is not a forwarded temporary.
        if (!this.forwarded_temporaries.has(dst) ||
            this.forced_temporaries.has(dst)) {
            return;
        }

        const e = this.get<SPIRExpression>(SPIRExpression, dst);
        const phi = this.maybe_get<SPIRVariable>(SPIRVariable, source_expression);
        if (phi?.phi_variable) {
            // We have used a phi variable, which can change at the end of the block,
            // so make sure we take a dependency on this phi variable.
            phi.dependees.push(dst);
        }

        const s = this.maybe_get<SPIRExpression>(SPIRExpression, source_expression);
        if (!s)
            return;

        const e_deps = e.expression_dependencies;
        const s_deps = s.expression_dependencies;

        // If we depend on a expression, we also depend on all sub-dependencies from source.
        e_deps.push(source_expression);
        e_deps.push(...s_deps);

        // Eliminate duplicated dependencies.
        e.expression_dependencies = unique(e_deps);
    }

    protected add_implied_read_expression(e: SPIRExpression | SPIRAccessChain, source: number)
    {
        const itr = e.implied_read_expressions.indexOf(<ID>(source));
        if (itr < 0)
            e.implied_read_expressions.push(source);
    }

    protected clear_force_recompile()
    {
        this.is_force_recompile = false;
    }

    // For proper multiple entry point support, allow querying if an Input or Output
    // variable is part of that entry points interface.
    protected interface_variable_exists_in_entry_point(id: number): boolean
    {
        const var_ = this.get<SPIRVariable>(SPIRVariable, id);
        const ir = this.ir;
        if (ir.get_spirv_version() < 0x10400) {
            if (var_.storage !== StorageClass.StorageClassInput &&
                var_.storage !== StorageClass.StorageClassOutput &&
                var_.storage !== StorageClass.StorageClassUniformConstant)
                throw new Error("Only Input, Output variables and Uniform constants are part of a shader linking" +
                    " interface.");

            // This is to avoid potential problems with very old glslang versions which did
            // not emit input/output interfaces properly.
            // We can assume they only had a single entry point, and single entry point
            // shaders could easily be assumed to use every interface variable anyways.
            if (count(ir.entry_points) <= 1)
                return true;
        }

        // In SPIR-V 1.4 and later, all global resource variables must be present.

        const execution = this.get_entry_point();
        return execution.interface_variables.indexOf(id) >= 0;
    }

    protected remap_variable_type_name(type: SPIRType, var_name: string, type_name: string)
    {
        if (this.variable_remap_callback)
            return this.variable_remap_callback(type, var_name, type_name);

        return type_name;
    }

    protected set_ir(ir: ParsedIR): void
    {
        this.ir = ir;
        this.parse_fixup();
    }

    protected parse_fixup(): void
    {
        const ir = this.ir;
// Figure out specialization constants for work group sizes.
        for (let id_ of ir.ids_for_constant_or_variable) {
            const id = ir.ids[id_];

            if (id.get_type() === Types.TypeConstant) {
                const c = id.get<SPIRConstant>(SPIRConstant);
                if (ir.get_meta(c.self).decoration.builtin && ir.get_meta(c.self).decoration.builtin_type === BuiltIn.BuiltInWorkgroupSize) {
                    // In current SPIR-V, there can be just one constant like this.
                    // All entry points will receive the constant value.
                    for (let entry of ir.entry_points) {
                        entry.workgroup_size.constant = c.self;
                        entry.workgroup_size.x = c.scalar(0, 0);
                        entry.workgroup_size.y = c.scalar(0, 1);
                        entry.workgroup_size.z = c.scalar(0, 2);
                    }
                }
            }
            else if (id.get_type() === Types.TypeVariable) {
                const var_ = id.get<SPIRVariable>(SPIRVariable);
                if (var_.storage === StorageClass.StorageClassPrivate ||
                    var_.storage === StorageClass.StorageClassWorkgroup ||
                    var_.storage === StorageClass.StorageClassOutput)
                    this.global_variables.push(var_.self);
                if (this.variable_storage_is_aliased(var_))
                    this.aliased_variables.push(var_.self);
            }
        }
    }

    protected variable_storage_is_aliased(v: SPIRVariable): boolean
    {
        const type = this.get<SPIRType>(SPIRType, v.basetype);
        const ssbo = v.storage === StorageClass.StorageClassStorageBuffer ||
            this.ir.get_meta(type.self).decoration.decoration_flags.get(Decoration.DecorationBufferBlock);
        const image = type.basetype === SPIRTypeBaseType.Image;
        const counter = type.basetype === SPIRTypeBaseType.AtomicCounter;
        const buffer_reference = type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT;

        let is_restrict: boolean;
        if (ssbo)
            is_restrict = this.ir.get_buffer_block_flags(v).get(Decoration.DecorationRestrict);
        else
            is_restrict = this.has_decoration(v.self, Decoration.DecorationRestrict);

        return !is_restrict && (ssbo || image || counter || buffer_reference);
    }

    protected add_loop_level()
    {
        this.current_loop_level++;
    }

    protected set_initializers(e: IVariant)
    {
        if (e instanceof SPIRExpression)
            e.emitted_loop_level = this.current_loop_level;
    }


    // If our IDs are out of range here as part of opcodes, throw instead of
    // undefined behavior.
    set<T extends IVariant>(classRef: IVariantType<T>, id: number, ...args): T
    {
        this.ir.add_typed_id(classRef.type, id);
        const var_ = variant_set<T>(classRef, this.ir.ids[id], ...args);
        var_.self = id;
        this.set_initializers(var_);
        return var_;
    }

    get<T extends IVariant>(classRef: IVariantType<T>, id: number)
    {
        return variant_get<T>(classRef, this.ir.ids[id]);
    }

    has_decoration(id: ID, decoration: Decoration): boolean
    {
        return this.ir.has_decoration(id, decoration);
    }

    // Gets the value for decorations which take arguments.
    // If the decoration is a boolean (i.e. Op.DecorationNonWritable),
    // 1 will be returned.
    // If decoration doesn't exist or decoration is not recognized,
    // 0 will be returned.
    get_decoration(id: ID, decoration: Decoration): number
    {
        return this.ir.get_decoration(id, decoration);
    }

    protected get_decoration_string(id: ID, decoration: Decoration): string
    {
        return this.ir.get_decoration_string(id, decoration);
    }

    // Removes the decoration for an ID.
    protected unset_decoration(id: ID, decoration: Decoration)
    {
        this.ir.unset_decoration(id, decoration);
    }

    // Gets the SPIR-V type associated with ID.
    // Mostly used with Resource::type_id and Resource::base_type_id to parse the underlying type of a resource.
    get_type(id: TypeID): SPIRType
    {
        return this.get<SPIRType>(SPIRType, id);
    }

    // If get_name() is an empty string, get the fallback name which will be used
    // instead in the disassembled source.
    protected get_fallback_name(id: ID): string
    {
        return "_" + id;
    }

    // If get_name() of a Block struct is an empty string, get the fallback name.
    // This needs to be per-variable as multiple variables can use the same block type.
    protected get_block_fallback_name(id: VariableID): string
    {
        const var_ = this.get<SPIRVariable>(SPIRVariable, id);
        if (this.get_name(id) === "")
            return "_" + this.get<SPIRType>(SPIRType, var_.basetype).self + "_" + id;
        else
            return this.get_name(id);
    }

    // Given an OpTypeStruct in ID, obtain the identifier for member number "index".
    // This may be an empty string.
    protected get_member_name(id: TypeID, index: number): string
    {
        return this.ir.get_member_name(id, index);
    }

    // Given an OpTypeStruct in ID, obtain the OpMemberDecoration for member number "index".
    get_member_decoration(id: TypeID, index: number, decoration: Decoration): number
    {
        return this.ir.get_member_decoration(id, index, decoration);
    }

    protected get_member_decoration_string(id: TypeID, index: number, decoration: Decoration): string
    {
        return this.ir.get_member_decoration_string(id, index, decoration);
    }

    // Sets the member identifier for OpTypeStruct ID, member number "index".
    set_member_name(id: TypeID, index: number, name: string)
    {
        this.ir.set_member_name(id, index, name);
    }

    // Returns the qualified member identifier for OpTypeStruct ID, member number "index",
    // or an empty string if no qualified alias exists
    protected get_member_qualified_name(type_id: TypeID, index: number): string
    {
        const m = this.ir.find_meta(type_id);
        if (m && index < m.members.length)
            return m.members[index].qualified_alias;
        else
            return this.ir.get_empty_string();
    }

    // Gets the decoration mask for a member of a struct, similar to get_decoration_mask.
    get_member_decoration_bitset(id: TypeID, index: number): Bitset
    {
        return this.ir.get_member_decoration_bitset(id, index);
    }

    // Returns whether the decoration has been applied to a member of a struct.
    has_member_decoration(id: TypeID, index: number, decoration: Decoration): boolean
    {
        return this.ir.has_member_decoration(id, index, decoration);
    }

    // Similar to set_decoration, but for struct members.
    protected set_member_decoration(id: TypeID, index: number, decoration: Decoration, argument: number = 0)
    {
        this.ir.set_member_decoration(id, index, decoration, argument);
    }

    protected set_member_decoration_string(id: TypeID, index: number, decoration: Decoration, argument: string)
    {
        this.ir.set_member_decoration_string(id, index, decoration, argument);
    }

    // Unsets a member decoration, similar to unset_decoration.
    protected unset_member_decoration(id: TypeID, index: number, decoration: Decoration)
    {
        this.ir.unset_member_decoration(id, index, decoration);
    }

    // Gets the fallback name for a member, similar to get_fallback_name.
    protected get_fallback_member_name(index: number): string
    {
        return "_" + index;
    }

    // Returns the effective size of a buffer block.
    protected get_declared_struct_size(type: SPIRType): number
    {
        if (type.member_types.length === 0)
            throw new Error("Declared struct in block cannot be empty.");

        // Offsets can be declared out of order, so we need to deduce the actual size
        // based on last member instead.
        let member_index = 0;
        let highest_offset = 0;
        for (let i = 0; i < type.member_types.length; i++) {
            const offset = this.type_struct_member_offset(type, i);
            if (offset > highest_offset) {
                highest_offset = offset;
                member_index = i;
            }
        }

        const size = this.get_declared_struct_member_size(type, member_index);
        return highest_offset + size;
    }

    maybe_get<T extends IVariant>(classRef: IVariantType<T>, id: number)
    {
        const ir = this.ir;
        if (id >= ir.ids.length)
            return null;
        else if (ir.ids[id].get_type() === classRef.type)
            return this.get<T>(classRef, id);
        else
            return null;
    }

    // Gets the id of SPIR-V type underlying the given type_id, which might be a pointer.
    protected get_pointee_type_id(type_id: number): number
    {
        const p_type = this.get<SPIRType>(SPIRType, type_id);
        if (p_type.pointer) {
            console.assert(p_type.parent_type);
            type_id = p_type.parent_type;
        }
        return type_id;
    }

    // Gets the SPIR-V type underlying the given type, which might be a pointer.
    get_pointee_type<T>(type: SPIRType): SPIRType;
    get_pointee_type<T>(type: number): SPIRType;
    get_pointee_type<T>(type: SPIRType | number): SPIRType
    {
        if (typeof type === "number") {
            return this.get_pointee_type(this.get<SPIRType>(SPIRType, type));
        }

        let p_type = type;
        if (p_type.pointer) {
            console.assert(p_type.parent_type);
            p_type = this.get<SPIRType>(SPIRType, p_type.parent_type);
        }
        return p_type;
    }

    // Gets the ID of the SPIR-V type underlying a variable.
    protected get_variable_data_type_id(var_: SPIRVariable): number
    {
        if (var_.phi_variable)
            return var_.basetype;
        return this.get_pointee_type_id(var_.basetype);
    }


    // Gets the SPIR-V type underlying a variable.
    protected get_variable_data_type(var_: SPIRVariable): SPIRType
    {
        return this.get<SPIRType>(SPIRType, this.get_variable_data_type_id(var_));
    }

    protected is_immutable(id: number): boolean
    {
        const ir = this.ir;
        if (ir.ids[id].get_type() === Types.TypeVariable) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, id);

            // Anything we load from the UniformConstant address space is guaranteed to be immutable.
            const pointer_to_const = var_.storage === StorageClass.StorageClassUniformConstant;
            return pointer_to_const || var_.phi_variable || !this.expression_is_lvalue(id);
        }
        else if (ir.ids[id].get_type() === Types.TypeAccessChain)
            return this.get<SPIRAccessChain>(SPIRAccessChain, id).immutable;
        else if (ir.ids[id].get_type() === Types.TypeExpression)
            return this.get<SPIRExpression>(SPIRExpression, id).immutable;
        else if (
            ir.ids[id].get_type() === Types.TypeConstant ||
            ir.ids[id].get_type() === Types.TypeConstantOp ||
            ir.ids[id].get_type() === Types.TypeUndef
        )
            return true;
        else
            return false;
    }

    maybe_get_backing_variable(chain: number): SPIRVariable
    {
        let var_ = this.maybe_get<SPIRVariable>(SPIRVariable, chain);
        if (!var_) {
            const cexpr = this.maybe_get<SPIRExpression>(SPIRExpression, chain);
            if (cexpr)
                var_ = this.maybe_get<SPIRVariable>(SPIRVariable, cexpr.loaded_from);

            const access_chain = this.maybe_get<SPIRAccessChain>(SPIRAccessChain, chain);
            if (access_chain)
                var_ = this.maybe_get<SPIRVariable>(SPIRVariable, access_chain.loaded_from);
        }

        return var_;
    }

    to_name(id: number, allow_alias: boolean = true): string
    {
        const ir = this.ir;
        if (allow_alias && ir.ids[id].get_type() === Types.TypeType) {
            // If this type is a simple alias, emit the
            // name of the original type instead.
            // We don't want to override the meta alias
            // as that can be overridden by the reflection APIs after parse.
            const type = this.get<SPIRType>(SPIRType, id);
            if (type.type_alias) {
                // If the alias master has been specially packed, we will have emitted a clean variant as well,
                // so skip the name aliasing here.
                if (!this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked))
                    return this.to_name(type.type_alias);
            }
        }

        const alias = ir.get_name(id);
        if (!alias || alias === "")
            return "_" + id;
        else
            return alias;
    }

    protected is_builtin_variable(var_: SPIRVariable): boolean
    {
        const m = this.ir.find_meta(var_.self);

        if (var_.compat_builtin || (m && m.decoration.builtin))
            return true;
        else
            return this.is_builtin_type(this.get<SPIRType>(SPIRType, var_.basetype));
    }

    protected is_builtin_type(type: SPIRType): boolean
    {
        const type_meta = this.ir.find_meta(type.self);

        // We can have builtin structs as well. If one member of a struct is builtin, the struct must also be builtin.
        if (type_meta)
            for (let m of type_meta.members)
                if (m.builtin)
                    return true;

        return false;
    }

    protected is_hidden_variable(var_: SPIRVariable, include_builtins: boolean = false): boolean
    {
        if ((this.is_builtin_variable(var_) && !include_builtins) || var_.remapped_variable)
            return true;

        // Combined image samplers are always considered active as they are "magic" variables.
        const rs = this.combined_image_samplers.find(samp => samp.combined_id === var_.self);
        if (rs) {
            return false;
        }

        const { ir } = this;
        // In SPIR-V 1.4 and up we must also use the active variable interface to disable global variables
        // which are not part of the entry point.
        if (ir.get_spirv_version() >= 0x10400 && var_.storage !== StorageClass.StorageClassGeneric &&
            var_.storage !== StorageClass.StorageClassFunction && !this.interface_variable_exists_in_entry_point(var_.self)) {
            return true;
        }

        return this.check_active_interface_variables && storage_class_is_interface(var_.storage) && this.active_interface_variables.has(var_.self);
    }

    protected is_member_builtin(type: SPIRType, index: number): BuiltIn
    {
        const type_meta = this.ir.find_meta(type.self);

        if (type_meta) {
            const memb = type_meta.members;
            if (index < memb.length && memb[index].builtin) {
                return memb[index].builtin_type;
            }
        }

        return undefined;
    }

    protected is_scalar(type: SPIRType)
    {
        return type.basetype !== SPIRTypeBaseType.Struct && type.vecsize === 1 && type.columns === 1;
    }

    protected is_vector(type: SPIRType)
    {
        return type.vecsize > 1 && type.columns === 1;
    }

    protected is_matrix(type: SPIRType): boolean
    {
        return type.vecsize > 1 && type.columns > 1;
    }

    protected is_array(type: SPIRType): boolean
    {
        return type.array.length > 0;
    }

    protected expression_type_id(id: number): number
    {
        switch (this.ir.ids[id].get_type()) {
            case Types.TypeVariable:
                return this.get<SPIRVariable>(SPIRVariable, id).basetype;

            case Types.TypeExpression:
                return this.get<SPIRExpression>(SPIRExpression, id).expression_type;

            case Types.TypeConstant:
                return this.get<SPIRConstant>(SPIRConstant, id).constant_type;

            case Types.TypeConstantOp:
                return this.get<SPIRConstantOp>(SPIRConstantOp, id).basetype;

            case Types.TypeUndef:
                return this.get<SPIRUndef>(SPIRUndef, id).basetype;

            case Types.TypeCombinedImageSampler:
                return this.get<SPIRCombinedImageSampler>(SPIRCombinedImageSampler, id).combined_type;

            case Types.TypeAccessChain:
                return this.get<SPIRAccessChain>(SPIRAccessChain, id).basetype;

            default:
                throw new Error("Cannot resolve expression type.");
        }
    }

    expression_type(id: number): SPIRType
    {
        return this.get<SPIRType>(SPIRType, this.expression_type_id(id));
    }

    protected expression_is_lvalue(id: number): boolean
    {
        const type = this.expression_type(id);
        switch (type.basetype) {
            case SPIRTypeBaseType.SampledImage:
            case SPIRTypeBaseType.Image:
            case SPIRTypeBaseType.Sampler:
                return false;

            default:
                return true;
        }
    }

    register_read(expr: number, chain: number, forwarded: boolean)
    {
        const e = this.get<SPIRExpression>(SPIRExpression, expr);
        const var_ = this.maybe_get_backing_variable(chain);

        if (var_) {
            e.loaded_from = var_.self;

            // If the backing variable is immutable, we do not need to depend on the variable.
            if (forwarded && !this.is_immutable(var_.self))
                var_.dependees.push(e.self);

            // If we load from a parameter, make sure we create "inout" if we also write to the parameter.
            // The default is "in" however, so we never invalidate our compilation by reading.
            if (var_ && var_.parameter)
                var_.parameter.read_count++;
        }
    }

    protected register_write(chain: number)
    {
        let var_ = this.maybe_get<SPIRVariable>(SPIRVariable, chain);
        if (!var_) {
            // If we're storing through an access chain, invalidate the backing variable instead.
            const expr = this.maybe_get<SPIRExpression>(SPIRExpression, chain);
            if (expr && expr.loaded_from)
                var_ = this.maybe_get<SPIRVariable>(SPIRVariable, expr.loaded_from);

            const access_chain = this.maybe_get<SPIRAccessChain>(SPIRAccessChain, chain);
            if (access_chain && access_chain.loaded_from)
                var_ = this.maybe_get<SPIRVariable>(SPIRVariable, access_chain.loaded_from);
        }

        const chain_type = this.expression_type(chain);

        if (var_) {
            let check_argument_storage_qualifier = true;
            const type = this.expression_type(chain);

            // If our variable is in a storage class which can alias with other buffers,
            // invalidate all variables which depend on aliased variables. And if this is a
            // variable pointer, then invalidate all variables regardless.
            if (this.get_variable_data_type(var_).pointer) {
                this.flush_all_active_variables();

                if (type.pointer_depth === 1) {
                    // We have a backing variable which is a pointer-to-pointer type.
                    // We are storing some data through a pointer acquired through that variable,
                    // but we are not writing to the value of the variable itself,
                    // i.e., we are not modifying the pointer directly.
                    // If we are storing a non-pointer type (pointer_depth === 1),
                    // we know that we are storing some unrelated data.
                    // A case here would be
                    // void foo(Foo * const *arg) {
                    //   Foo *bar = *arg;
                    //   bar->unrelated = 42;
                    // }
                    // arg, the argument is constant.
                    check_argument_storage_qualifier = false;
                }
            }

            if (type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT || this.variable_storage_is_aliased(var_))
                this.flush_all_aliased_variables();
            else if (var_)
                this.flush_dependees(var_);

            // We tried to write to a parameter which is not marked with out qualifier, force a recompile.
            if (check_argument_storage_qualifier && var_.parameter && var_.parameter.write_count === 0) {
                var_.parameter.write_count++;
                this.force_recompile();
            }
        }
        else if (chain_type.pointer) {
            // If we stored through a variable pointer, then we don't know which
            // variable we stored to. So *all* expressions after this point need to
            // be invalidated.
            // FIXME: If we can prove that the variable pointer will point to
            // only certain variables, we can invalidate only those.
            this.flush_all_active_variables();
        }

        // If chain_type.pointer is false, we're not writing to memory backed variables, but temporaries instead.
        // This can happen in copy_logical_type where we unroll complex reads and writes to temporaries.
    }


    protected is_continue(next: number): boolean
    {
        this.ir.block_meta[next] = this.ir.block_meta[next] || 0;
        return (this.ir.block_meta[next] & BlockMetaFlagBits.BLOCK_META_CONTINUE_BIT) !== 0;
    }

    protected is_single_block_loop(next: number): boolean
    {
        const block = this.get<SPIRBlock>(SPIRBlock, next);
        return block.merge === SPIRBlockMerge.MergeLoop && block.continue_block === <ID>(next);
    }

    protected traverse_all_reachable_opcodes(block: SPIRBlock, handler: OpcodeHandler): boolean;
    protected traverse_all_reachable_opcodes(block: SPIRFunction, handler: OpcodeHandler): boolean;
    protected traverse_all_reachable_opcodes(param0: SPIRBlock | SPIRFunction, handler: OpcodeHandler): boolean
    {
        if (param0 instanceof SPIRFunction) {
            for (let block of param0.blocks)
                if (!this.traverse_all_reachable_opcodes(this.get<SPIRBlock>(SPIRBlock, block), handler))
                    return false;

            return true;
        }

        const block = param0;
        handler.set_current_block(block);
        handler.rearm_current_block(block);

        // Ideally, perhaps traverse the CFG instead of all blocks in order to eliminate dead blocks,
        // but this shouldn't be a problem in practice unless the SPIR-V is doing insane things like recursing
        // inside dead blocks ...
        for (let i of block.ops) {
            const ops = this.stream(i);
            const op = <Op>(i.op);

            if (!handler.handle(op, ops, i.length))
                return false;

            if (op === Op.OpFunctionCall) {
                const func = this.get<SPIRFunction>(SPIRFunction, ops[2]);
                if (handler.follow_function_call(func)) {
                    if (!handler.begin_function_scope(ops, i.length))
                        return false;
                    if (!this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ops[2]), handler))
                        return false;
                    if (!handler.end_function_scope(ops, i.length))
                        return false;

                    handler.rearm_current_block(block);
                }
            }
        }

        if (!handler.handle_terminator(block))
            return false;

        return true;
    }

    analyze_image_and_sampler_usage()
    {
        const ir = this.ir;
        const dref_handler = new CombinedImageSamplerDrefHandler(this);
        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), dref_handler);

        const handler = new CombinedImageSamplerUsageHandler(this, dref_handler.dref_combined_samplers);
        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), handler);

        // Need to run this traversal twice. First time, we propagate any comparison sampler usage from leaf functions
        // down to main().
        // In the second pass, we can propagate up forced depth state coming from main() up into leaf functions.
        handler.dependency_hierarchy = [];
        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), handler);

        this.comparison_ids = handler.comparison_ids;
        this.need_subpass_input = handler.need_subpass_input;

        // Forward information from separate images and samplers into combined image samplers.
        for (let combined of this.combined_image_samplers)
            if (this.comparison_ids.has(combined.sampler_id))
                this.comparison_ids.add(combined.combined_id);
    }

    protected build_function_control_flow_graphs_and_analyze()
    {
        const ir = this.ir;
        const handler = new CFGBuilder(this);
        handler.function_cfgs[ir.default_entry_point] = new CFG(this, this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point));
        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), handler);
        this.function_cfgs = handler.function_cfgs;
        const single_function = count(this.function_cfgs) <= 1;

        this.function_cfgs.forEach((f_second, f_first) =>
        {
            const func = this.get<SPIRFunction>(SPIRFunction, f_first);
            const scope_handler = new AnalyzeVariableScopeAccessHandler(this, func);
            this.analyze_variable_scope(func, scope_handler);
            this.find_function_local_luts(func, scope_handler, single_function);

            // Check if we can actually use the loop variables we found in analyze_variable_scope.
            // To use multiple initializers, we need the same type and qualifiers.
            for (let block of func.blocks) {
                const b = this.get<SPIRBlock>(SPIRBlock, block);
                if (b.loop_variables.length < 2)
                    continue;

                const flags = this.get_decoration_bitset(b.loop_variables[0]);
                const type = this.get<SPIRVariable>(SPIRVariable, b.loop_variables[0]).basetype;
                let invalid_initializers = false;
                for (let loop_variable of b.loop_variables) {
                    if (flags !== this.get_decoration_bitset(loop_variable) ||
                        type !== this.get<SPIRVariable>(SPIRVariable, b.loop_variables[0]).basetype) {
                        invalid_initializers = true;
                        break;
                    }
                }

                if (invalid_initializers) {
                    for (let loop_variable of b.loop_variables)
                        this.get<SPIRVariable>(SPIRVariable, loop_variable).loop_variable = false;
                    b.loop_variables = [];
                }
            }
        });
    }

    get_cfg_for_current_function()
    {
        console.assert(this.current_function);
        return this.get_cfg_for_function(this.current_function.self);
    }

    get_cfg_for_function(id: number): CFG
    {
        const cfg = this.function_cfgs[id];
        console.assert(cfg);
        return cfg;
    }

    // variable_to_blocks = map<uint32_t, set<uint32_t>>
    // complete_write_blocks = map<uint32_t, set<uint32_t>>
    analyze_parameter_preservation(entry: SPIRFunction, cfg: CFG, variable_to_blocks: Set<number>[], complete_write_blocks: Set<number>[])
    {
        for (let arg of entry.arguments) {
            // Non-pointers are always inputs.
            const type = this.get<SPIRType>(SPIRType, arg.type);
            if (!type.pointer)
                continue;

            // Opaque argument types are always in
            let potential_preserve: boolean;
            switch (type.basetype) {
                case SPIRTypeBaseType.Sampler:
                case SPIRTypeBaseType.Image:
                case SPIRTypeBaseType.SampledImage:
                case SPIRTypeBaseType.AtomicCounter:
                    potential_preserve = false;
                    break;

                default:
                    potential_preserve = true;
                    break;
            }

            if (!potential_preserve)
                continue;

            if (!variable_to_blocks.hasOwnProperty(arg.id)) {
                // Variable is never accessed.
                continue;
            }

            // We have accessed a variable, but there was no complete writes to that variable.
            // We deduce that we must preserve the argument.
            if (!complete_write_blocks.hasOwnProperty(arg.id)) {
                arg.read_count++;
                continue;
            }

            const itrSecond = complete_write_blocks[arg.id];

            // If there is a path through the CFG where no block completely writes to the variable, the variable will be in an undefined state
            // when the function returns. We therefore need to implicitly preserve the variable in case there are writers in the function.
            // Major case here is if a function is
            // void foo(int &var) { if (cond) var = 10; }
            // Using read/write counts, we will think it's just an out variable, but it really needs to be inout,
            // because if we don't write anything whatever we put into the function must return back to the caller.
            const visit_cache: Set<number> = new Set();
            if (exists_unaccessed_path_to_return(cfg, entry.entry_block, itrSecond, visit_cache))
                arg.read_count++;
        }
    }

    protected analyze_non_block_pointer_types()
    {
        const ir = this.ir;
        const handler = new PhysicalStorageBufferPointerHandler(this);
        this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), handler);

        // Analyze any block declaration we have to make. It might contain
        // physical pointers to POD types which we never used, and thus never added to the list.
        // We'll need to add those pointer types to the set of types we declare.
        ir.for_each_typed_id<SPIRType>(SPIRType, (_, type) =>
        {
            if (this.has_decoration(type.self, Decoration.DecorationBlock) || this.has_decoration(type.self, Decoration.DecorationBufferBlock))
                handler.analyze_non_block_types_from_block(type);
        });

        handler.non_block_types.forEach(type =>
            this.physical_storage_non_block_pointer_types.push(type)
        );

        this.physical_storage_non_block_pointer_types.sort();
        this.physical_storage_type_to_alignment = handler.physical_block_type_meta;
    }

    protected analyze_variable_scope(entry: SPIRFunction, handler: AnalyzeVariableScopeAccessHandler)
    {
// First, we map out all variable access within a function.
        // Essentially a map of block -> { variables accessed in the basic block }
        this.traverse_all_reachable_opcodes(entry, handler);

        const ir = this.ir;
        const cfg = maplike_get(CFG, this.function_cfgs, entry.self);

        // Analyze if there are parameters which need to be implicitly preserved with an "in" qualifier.
        this.analyze_parameter_preservation(entry, cfg, handler.accessed_variables_to_block, handler.complete_write_variables_to_block);

        // unordered_map<uint32_t, uint32_t>
        const potential_loop_variables: number[] = [];

        // Find the loop dominator block for each block.
        for (const block_id of entry.blocks) {
            const block = this.get<SPIRBlock>(SPIRBlock, block_id);

            const itrSecond = ir.continue_block_to_loop_header[block_id];
            if (!!itrSecond && itrSecond !== block_id) {
                // Continue block might be unreachable in the CFG, but we still like to know the loop dominator.
                // Edge case is when continue block is also the loop header, don't set the dominator in this case.
                block.loop_dominator = itrSecond;
            }
            else {
                const loop_dominator = cfg.find_loop_dominator(block_id);
                if (loop_dominator !== block_id)
                    block.loop_dominator = loop_dominator;
                else
                    block.loop_dominator = SPIRBlock.NoDominator;
            }
        }

        // For each variable which is statically accessed.
        handler.accessed_variables_to_block.forEach((var_second, var_first) =>
        {
            // Only deal with variables which are considered local variables in this function.
            if (entry.local_variables.indexOf(var_first) < 0)
                return;

            const builder = new DominatorBuilder(cfg);
            const blocks = var_second;
            const type = this.expression_type(var_first);

            // Figure out which block is dominating all accesses of those variables.
            blocks.forEach(block =>
            {
                // If we're accessing a variable inside a continue block, this variable might be a loop variable.
                // We can only use loop variables with scalars, as we cannot track static expressions for vectors.
                if (this.is_continue(block)) {
                    // Potentially awkward case to check for.
                    // We might have a variable inside a loop, which is touched by the continue block,
                    // but is not actually a loop variable.
                    // The continue block is dominated by the inner part of the loop, which does not make sense in high-level
                    // language output because it will be declared before the body,
                    // so we will have to lift the dominator up to the relevant loop header instead.
                    builder.add_block(maplike_get(0, ir.continue_block_to_loop_header, block));

                    // Arrays or structs cannot be loop variables.
                    if (type.vecsize === 1 && type.columns === 1 && type.basetype !== SPIRTypeBaseType.Struct && type.array.length === 0) {
                        // The variable is used in multiple continue blocks, this is not a loop
                        // candidate, signal that by setting block to -1u.
                        const potential: number = maplike_get(0, potential_loop_variables, var_first);

                        if (potential === 0)
                            potential_loop_variables[var_first] = block;
                        else
                            potential_loop_variables[var_first] = -1;
                    }
                }
                builder.add_block(block);
            });

            builder.lift_continue_block_dominator();

            // Add it to a per-block list of variables.
            let dominating_block = builder.get_dominator();

            // For variables whose dominating block is inside a loop, there is a risk that these variables
            // actually need to be preserved across loop iterations. We can express this by adding
            // a "read" access to the loop header.
            // In the dominating block, we must see an OpStore or equivalent as the first access of an OpVariable.
            // Should that fail, we look for the outermost loop header and tack on an access there.
            // Phi nodes cannot have this problem.
            if (dominating_block) {
                const variable = this.get<SPIRVariable>(SPIRVariable, var_first);
                if (!variable.phi_variable) {
                    let block = this.get<SPIRBlock>(SPIRBlock, dominating_block);
                    const preserve = this.may_read_undefined_variable_in_block(block, var_first);
                    if (preserve) {
                        // Find the outermost loop scope.
                        while (block.loop_dominator !== <BlockID>(SPIRBlock.NoDominator))
                            block = this.get<SPIRBlock>(SPIRBlock, block.loop_dominator);

                        if (block.self !== dominating_block) {
                            builder.add_block(block.self);
                            dominating_block = builder.get_dominator();
                        }
                    }
                }
            }

            // If all blocks here are dead code, this will be 0, so the variable in question
            // will be completely eliminated.
            if (dominating_block) {
                const block = this.get<SPIRBlock>(SPIRBlock, dominating_block);
                block.dominated_variables.push(var_first);
                this.get<SPIRVariable>(SPIRVariable, var_first).dominator = dominating_block;
            }
        });

        handler.accessed_temporaries_to_block.forEach((var_second, var_first) =>
        {
            if (!handler.result_id_to_type.hasOwnProperty(var_first)) {
                // We found a false positive ID being used, ignore.
                // This should probably be an assert.
                return;
            }

            const itrSecond = handler.result_id_to_type[var_first];

            // There is no point in doing domination analysis for opaque types.
            const type = this.get<SPIRType>(SPIRType, itrSecond);
            if (this.type_is_opaque_value(type))
                return;

            const builder = new DominatorBuilder(cfg);
            let force_temporary = false;
            let used_in_header_hoisted_continue_block = false;

            // Figure out which block is dominating all accesses of those temporaries.
            const blocks = var_second;
            blocks.forEach(block =>
            {
                builder.add_block(block);

                if (blocks.size !== 1 && this.is_continue(block)) {
                    // The risk here is that inner loop can dominate the continue block.
                    // Any temporary we access in the continue block must be declared before the loop.
                    // This is moot for complex loops however.
                    const loop_header_block = this.get<SPIRBlock>(SPIRBlock, maplike_get(0, ir.continue_block_to_loop_header, block));
                    console.assert(loop_header_block.merge === SPIRBlockMerge.MergeLoop);
                    builder.add_block(loop_header_block.self);
                    used_in_header_hoisted_continue_block = true;
                }
            });

            const dominating_block = builder.get_dominator();

            if (blocks.size !== 1 && this.is_single_block_loop(dominating_block)) {
                // Awkward case, because the loop header is also the continue block,
                // so hoisting to loop header does not help.
                force_temporary = true;
            }

            if (dominating_block) {
                // If we touch a variable in the dominating block, this is the expected setup.
                // SPIR-V normally mandates this, but we have extra cases for temporary use inside loops.
                const first_use_is_dominator = blocks.has(dominating_block);

                if (!first_use_is_dominator || force_temporary) {
                    if (handler.access_chain_expressions.has(var_first)) {
                        // Exceptionally rare case.
                        // We cannot declare temporaries of access chains (except on MSL perhaps with pointers).
                        // Rather than do that, we force the indexing expressions to be declared in the right scope by
                        // tracking their usage to that end. There is no temporary to hoist.
                        // However, we still need to observe declaration order of the access chain.

                        if (used_in_header_hoisted_continue_block) {
                            // For this scenario, we used an access chain inside a continue block where we also registered an access to header block.
                            // This is a problem as we need to declare an access chain properly first with full definition.
                            // We cannot use temporaries for these expressions,
                            // so we must make sure the access chain is declared ahead of time.
                            // Force a complex for loop to deal with this.
                            // TODO: Out-of-order declaring for loops where continue blocks are emitted last might be another option.
                            const loop_header_block = this.get<SPIRBlock>(SPIRBlock, dominating_block);
                            console.assert(loop_header_block.merge === SPIRBlockMerge.MergeLoop);
                            loop_header_block.complex_continue = true;
                        }
                    }
                    else {
                        // This should be very rare, but if we try to declare a temporary inside a loop,
                        // and that temporary is used outside the loop as well (spirv-opt inliner likes this)
                        // we should actually emit the temporary outside the loop.
                        this.hoisted_temporaries.add(var_first);
                        this.forced_temporaries.add(var_first);

                        const block_temporaries = this.get<SPIRBlock>(SPIRBlock, dominating_block).declare_temporary;
                        block_temporaries.push(new Pair(maplike_get(0, handler.result_id_to_type, var_first), var_first));
                    }
                }
                else if (blocks.size > 1) {
                    // Keep track of the temporary as we might have to declare this temporary.
                    // This can happen if the loop header dominates a temporary, but we have a complex fallback loop.
                    // In this case, the header is actually inside the for (;;) {} block, and we have problems.
                    // What we need to do is hoist the temporaries outside the for (;;) {} block in case the header block
                    // declares the temporary.
                    const block_temporaries = this.get<SPIRBlock>(SPIRBlock, dominating_block).potential_declare_temporary;
                    block_temporaries.push(new Pair(maplike_get(0, handler.result_id_to_type, var_first), var_first));
                }
            }
        });

        const seen_blocks: Set<number> = new Set();

        // Now, try to analyze whether or not these variables are actually loop variables.
        potential_loop_variables.forEach((loop_variable_second, loop_variable_first) =>
        {
            const var_ = this.get<SPIRVariable>(SPIRVariable, loop_variable_first);
            let dominator = var_.dominator;
            const block = loop_variable_second;

            // The variable was accessed in multiple continue blocks, ignore.
            if (block === -1 || block === 0)
                return;

            // Dead code.
            if (dominator === 0)
                return;

            let header: BlockID = 0;

            // Find the loop header for this block if we are a continue block.
            {
                if (ir.continue_block_to_loop_header.hasOwnProperty(block)) {
                    header = ir.continue_block_to_loop_header[block];
                }
                else if (this.get<SPIRBlock>(SPIRBlock, block).continue_block === block) {
                    // Also check for self-referential continue block.
                    header = block;
                }
            }

            console.assert(header);
            const header_block = this.get<SPIRBlock>(SPIRBlock, header);
            const blocks = maplike_get<Set<number>>(Set, handler.accessed_variables_to_block, loop_variable_first);

            // If a loop variable is not used before the loop, it's probably not a loop variable.
            let has_accessed_variable = blocks.has(header);

            // Now, there are two conditions we need to meet for the variable to be a loop variable.
            // 1. The dominating block must have a branch-free path to the loop header,
            // this way we statically know which expression should be part of the loop variable initializer.

            // Walk from the dominator, if there is one straight edge connecting
            // dominator and loop header, we statically know the loop initializer.
            let static_loop_init = true;
            while (dominator !== header) {
                if (blocks.has(dominator))
                    has_accessed_variable = true;

                const succ = cfg.get_succeeding_edges(dominator);
                if (succ.length !== 1) {
                    static_loop_init = false;
                    break;
                }

                const pred = cfg.get_preceding_edges(succ[0]);
                if (pred.length !== 1 || pred[0] !== dominator) {
                    static_loop_init = false;
                    break;
                }

                dominator = succ[0];
            }

            if (!static_loop_init || !has_accessed_variable)
                return;

            // The second condition we need to meet is that no access after the loop
            // merge can occur. Walk the CFG to see if we find anything.

            seen_blocks.clear();
            cfg.walk_from(seen_blocks, header_block.merge_block, walk_block =>
            {
                // We found a block which accesses the variable outside the loop.
                if (blocks.has(walk_block))
                    static_loop_init = false;
                return true;
            });

            if (!static_loop_init)
                return;

            // We have a loop variable.
            header_block.loop_variables.push(loop_variable_first);
            // Need to sort here as variables come from an unordered container, and pushing stuff in wrong order
            // will break reproducability in regression runs.
            header_block.loop_variables.sort();
            this.get<SPIRVariable>(SPIRVariable, loop_variable_first).loop_variable = true;
        });
    }

    find_function_local_luts(entry: SPIRFunction, handler: AnalyzeVariableScopeAccessHandler, single_function: boolean)
    {
        const cfg = maplike_get(CFG, this.function_cfgs, entry.self);
        const ir = this.ir;

        // For each variable which is statically accessed.
        handler.accessed_variables_to_block.forEach((accessed_var_second, accessed_var_first) =>
        {
            const blocks = accessed_var_second;
            const var_ = this.get<SPIRVariable>(SPIRVariable, accessed_var_first);
            const type = this.expression_type(accessed_var_first);

            // Only consider function local variables here.
            // If we only have a single function in our CFG, private storage is also fine,
            // since it behaves like a function local variable.
            const allow_lut = var_.storage === StorageClass.StorageClassFunction || (single_function && var_.storage === StorageClass.StorageClassPrivate);
            if (!allow_lut)
                return;

            // We cannot be a phi variable.
            if (var_.phi_variable)
                return;

            // Only consider arrays here.
            if (type.array.length === 0)
                return;

            // If the variable has an initializer, make sure it is a constant expression.
            let static_constant_expression = 0;
            if (var_.initializer) {
                if (ir.ids[var_.initializer].get_type() !== Types.TypeConstant)
                    return;

                static_constant_expression = var_.initializer;

                // There can be no stores to this variable, we have now proved we have a LUT.
                if (handler.complete_write_variables_to_block.hasOwnProperty(var_.self) ||
                    handler.partial_write_variables_to_block.hasOwnProperty(var_.self))
                    return;
            }
            else {
                // We can have one, and only one write to the variable, and that write needs to be a constant.

                // No partial writes allowed.
                if (handler.partial_write_variables_to_block.hasOwnProperty(var_.self))
                    return;

                // No writes?
                if (!handler.complete_write_variables_to_block.hasOwnProperty(var_.self))
                    return;

                const itr_second = handler.complete_write_variables_to_block[var_.self];

                // We write to the variable in more than one block.
                const write_blocks = itr_second;
                if (write_blocks.size !== 1)
                    return;

                // The write needs to happen in the dominating block.
                const builder = new DominatorBuilder(cfg);
                blocks.forEach(block => builder.add_block(block));
                const dominator = builder.get_dominator();

                // The complete write happened in a branch or similar, cannot deduce static expression.
                if (write_blocks.has(dominator))
                    return;

                // Find the static expression for this variable.
                const static_expression_handler = new StaticExpressionAccessHandler(this, var_.self);
                this.traverse_all_reachable_opcodes(this.get<SPIRBlock>(SPIRBlock, dominator), static_expression_handler);

                // We want one, and exactly one write
                if (static_expression_handler.write_count !== 1 || static_expression_handler.static_expression === 0)
                    return;

                // Is it a constant expression?
                if (ir.ids[static_expression_handler.static_expression].get_type() !== Types.TypeConstant)
                    return;

                // We found a LUT!
                static_constant_expression = static_expression_handler.static_expression;
            }

            this.get<SPIRConstant>(SPIRConstant, static_constant_expression).is_used_as_lut = true;
            var_.static_expression = static_constant_expression;
            var_.statically_assigned = true;
            var_.remapped_variable = true;
        });
    }

    protected may_read_undefined_variable_in_block(block: SPIRBlock, var_: number): boolean
    {
        for (let op of block.ops) {
            const ops = this.stream(op);
            switch (op.op) {
                case Op.OpStore:
                case Op.OpCopyMemory:
                    if (ops[0] === var_)
                        return false;
                    break;

                case Op.OpAccessChain:
                case Op.OpInBoundsAccessChain:
                case Op.OpPtrAccessChain:
                    // Access chains are generally used to partially read and write. It's too hard to analyze
                    // if all constituents are written fully before continuing, so just assume it's preserved.
                    // This is the same as the parameter preservation analysis.
                    if (ops[2] === var_)
                        return true;
                    break;

                case Op.OpSelect:
                    // Variable pointers.
                    // We might read before writing.
                    if (ops[3] === var_ || ops[4] === var_)
                        return true;
                    break;

                case Op.OpPhi: {
                    // Variable pointers.
                    // We might read before writing.
                    if (op.length < 2)
                        break;

                    const count = op.length - 2;
                    for (let i = 0; i < count; i += 2)
                        if (ops[i + 2] === var_)
                            return true;
                    break;
                }

                case Op.OpCopyObject:
                case Op.OpLoad:
                    if (ops[2] === var_)
                        return true;
                    break;

                case Op.OpFunctionCall: {
                    if (op.length < 3)
                        break;

                    // May read before writing.
                    const count = op.length - 3;
                    for (let i = 0; i < count; i++)
                        if (ops[i + 3] === var_)
                            return true;
                    break;
                }

                default:
                    break;
            }
        }

        // Not accessed somehow, at least not in a usual fashion.
        // It's likely accessed in a branch, so assume we must preserve.
        return true;
    }

    protected analyze_interlocked_resource_usage()
    {
        if (this.get_execution_model() === ExecutionModel.ExecutionModelFragment &&
            (this.get_entry_point().flags.get(ExecutionMode.ExecutionModePixelInterlockOrderedEXT) ||
                this.get_entry_point().flags.get(ExecutionMode.ExecutionModePixelInterlockUnorderedEXT) ||
                this.get_entry_point().flags.get(ExecutionMode.ExecutionModeSampleInterlockOrderedEXT) ||
                this.get_entry_point().flags.get(ExecutionMode.ExecutionModeSampleInterlockUnorderedEXT))) {
            const ir = this.ir;
            const prepass_handler = new InterlockedResourceAccessPrepassHandler(this, ir.default_entry_point);
            this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), prepass_handler);

            const handler = new InterlockedResourceAccessHandler(this, ir.default_entry_point);
            handler.interlock_function_id = prepass_handler.interlock_function_id;
            handler.split_function_case = prepass_handler.split_function_case;
            handler.control_flow_interlock = prepass_handler.control_flow_interlock;
            handler.use_critical_section = !handler.split_function_case && !handler.control_flow_interlock;

            this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), handler);

            // For GLSL. If we hit any of these cases, we have to fall back to conservative approach.
            this.interlocked_is_complex =
                !handler.use_critical_section || handler.interlock_function_id !== ir.default_entry_point;
        }
    }

    instruction_to_result_type(op: Op, args: Uint32Array, length: number): { result_type: number, result_id: number }
    {
        // Most instructions follow the pattern of <result-type> <result-id> <arguments>.
        // There are some exceptions.
        switch (op) {
            case Op.OpStore:
            case Op.OpCopyMemory:
            case Op.OpCopyMemorySized:
            case Op.OpImageWrite:
            case Op.OpAtomicStore:
            case Op.OpAtomicFlagClear:
            case Op.OpEmitStreamVertex:
            case Op.OpEndStreamPrimitive:
            case Op.OpControlBarrier:
            case Op.OpMemoryBarrier:
            case Op.OpGroupWaitEvents:
            case Op.OpRetainEvent:
            case Op.OpReleaseEvent:
            case Op.OpSetUserEventStatus:
            case Op.OpCaptureEventProfilingInfo:
            case Op.OpCommitReadPipe:
            case Op.OpCommitWritePipe:
            case Op.OpGroupCommitReadPipe:
            case Op.OpGroupCommitWritePipe:
            case Op.OpLine:
            case Op.OpNoLine:
                return null;

            default:
                if (length > 1 && this.maybe_get<SPIRType>(SPIRType, args[0]) !== null) {
                    return { result_type: args[0], result_id: args[1] };
                }
                else
                    return null;
        }
    }

    combined_decoration_for_member(type: SPIRType, index: number): Bitset
    {
        const flags = new Bitset();
        const type_meta = this.ir.find_meta(type.self);

        if (type_meta) {
            const members = type_meta.members;
            if (index >= members.length)
                return flags;
            const dec = members[index];

            flags.merge_or(dec.decoration_flags);

            const member_type = this.get<SPIRType>(SPIRType, type.member_types[index]);

            // If our member type is a struct, traverse all the child members as well recursively.
            const member_childs = member_type.member_types;
            for (let i = 0; i < member_childs.length; i++) {
                const child_member_type = this.get<SPIRType>(SPIRType, member_childs[i]);
                if (!child_member_type.pointer)
                    flags.merge_or(this.combined_decoration_for_member(member_type, i));
            }
        }

        return flags;
    }

    is_desktop_only_format(format: ImageFormat): boolean
    {
        switch (format) {
            // Desktop-only formats
            case ImageFormat.ImageFormatR11fG11fB10f:
            case ImageFormat.ImageFormatR16f:
            case ImageFormat.ImageFormatRgb10A2:
            case ImageFormat.ImageFormatR8:
            case ImageFormat.ImageFormatRg8:
            case ImageFormat.ImageFormatR16:
            case ImageFormat.ImageFormatRg16:
            case ImageFormat.ImageFormatRgba16:
            case ImageFormat.ImageFormatR16Snorm:
            case ImageFormat.ImageFormatRg16Snorm:
            case ImageFormat.ImageFormatRgba16Snorm:
            case ImageFormat.ImageFormatR8Snorm:
            case ImageFormat.ImageFormatRg8Snorm:
            case ImageFormat.ImageFormatR8ui:
            case ImageFormat.ImageFormatRg8ui:
            case ImageFormat.ImageFormatR16ui:
            case ImageFormat.ImageFormatRgb10a2ui:
            case ImageFormat.ImageFormatR8i:
            case ImageFormat.ImageFormatRg8i:
            case ImageFormat.ImageFormatR16i:
                return true;
            default:
                break;
        }

        return false;
    }

    protected set_extended_decoration(id: number, decoration: ExtendedDecorations, value: number = 0)
    {
        const dec = maplike_get(Meta, this.ir.meta, id).decoration;
        dec.extended.flags.set(decoration);
        dec.extended.values[decoration] = value;
    }

    protected get_extended_decoration(id: number, decoration: ExtendedDecorations): number
    {
        const m = this.ir.find_meta(id);
        if (!m)
            return 0;

        const dec = m.decoration;

        if (!dec.extended.flags.get(decoration))
            return get_default_extended_decoration(decoration);

        return dec.extended.values[decoration];
    }

    protected has_extended_decoration(id: number, decoration: ExtendedDecorations): boolean
    {
        const m = this.ir.find_meta(id);
        if (!m)
            return false;

        const dec = m.decoration;
        return dec.extended.flags.get(decoration);
    }

    protected unset_extended_decoration(id: number, decoration: ExtendedDecorations)
    {
        const dec = maplike_get(Meta, this.ir.meta, id).decoration;
        dec.extended.flags.clear(decoration);
        dec.extended.values[decoration] = 0;
    }

    protected set_extended_member_decoration(type: number, index: number, decoration: ExtendedDecorations, value: number = 0)
    {
        const members = maplike_get(Meta, this.ir.meta, type).members;
        if (index === members.length) {
            members.push(new MetaDecoration());
        }

        const dec = members[index];
        dec.extended.flags.set(decoration);
        dec.extended.values[decoration] = value;
    }

    protected get_extended_member_decoration(type: number, index: number, decoration: ExtendedDecorations): number
    {
        const m = this.ir.find_meta(type);
        if (!m)
            return 0;

        if (index >= m.members.length)
            return 0;

        const dec = m.members[index];
        if (!dec.extended.flags.get(decoration))
            return get_default_extended_decoration(decoration);
        return dec.extended.values[decoration];
    }

    protected has_extended_member_decoration(type: number, index: number, decoration: ExtendedDecorations): boolean
    {
        const m = this.ir.find_meta(type);
        if (!m)
            return false;

        if (index >= m.members.length)
            return false;

        const dec = m.members[index];
        return dec.extended.flags.get(decoration);
    }

    protected unset_extended_member_decoration(type: number, index: number, decoration: ExtendedDecorations)
    {
        const members = maplike_get(Meta, this.ir.meta, type).members;
        if (index === members.length) {
            members.push(new MetaDecoration());
        }
        const dec = members[index];
        dec.extended.flags.clear(decoration);
        dec.extended.values[decoration] = 0;
    }

    type_is_array_of_pointers(type: SPIRType): boolean
    {
        if (!type.pointer)
            return false;

        // If parent type has same pointer depth, we must have an array of pointers.
        return type.pointer_depth === this.get<SPIRType>(SPIRType, type.parent_type).pointer_depth;
    }

    protected type_is_opaque_value(type: SPIRType): boolean
    {
        return !type.pointer && (type.basetype === SPIRTypeBaseType.SampledImage || type.basetype === SPIRTypeBaseType.Image ||
            type.basetype === SPIRTypeBaseType.Sampler);
    }

    protected is_depth_image(type: SPIRType, id: number): boolean
    {
        return (type.image.depth && type.image.format === ImageFormat.ImageFormatUnknown) || this.comparison_ids.has(id);
    }

    protected reflection_ssbo_instance_name_is_significant(): boolean
    {
        const ir = this.ir;
        if (ir.source.known) {
            // UAVs from HLSL source tend to be declared in a way where the type is reused
            // but the instance name is significant, and that's the name we should report.
            // For GLSL, SSBOs each have their own block type as that's how GLSL is written.
            return ir.source.hlsl;
        }

        const ssbo_type_ids: Set<number> = new Set();
        let aliased_ssbo_types = false;

        // If we don't have any OpSource information, we need to perform some shaky heuristics.
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            if (!type.pointer || var_.storage === StorageClass.StorageClassFunction)
                return;

            const ssbo = var_.storage === StorageClass.StorageClassStorageBuffer ||
                (var_.storage === StorageClass.StorageClassUniform && this.has_decoration(type.self, Decoration.DecorationBufferBlock));

            if (ssbo) {
                if (ssbo_type_ids.has(type.self))
                    aliased_ssbo_types = true;
                else
                    ssbo_type_ids.add(type.self);
            }
        });

        // If the block name is aliased, assume we have HLSL-style UAV declarations.
        return aliased_ssbo_types;
    }

    // API for querying buffer objects.
    // The type passed in here should be the base type of a resource, i.e.
    // get_type(resource.base_type_id)
    // as decorations are set in the basic Block type.
    // The type passed in here must have these decorations set, or an exception is raised.
    // Only UBOs and SSBOs or sub-structs which are part of these buffer types will have these decorations set.
    protected type_struct_member_offset(type: SPIRType, index: number): number
    {
        const type_meta = this.ir.find_meta(type.self);
        if (type_meta) {
            // Decoration must be set in valid SPIR-V, otherwise throw.
            const dec = type_meta.members[index];
            if (dec.decoration_flags.get(Decoration.DecorationOffset))
                return dec.offset;
            else
                throw new Error("Struct member does not have Offset set.");
        }
        else
            throw new Error("Struct member does not have Offset set.");
    }

    protected type_struct_member_array_stride(type: SPIRType, index: number): number
    {
        const type_meta = this.ir.find_meta(type.member_types[index]);
        if (type_meta) {
            // Decoration must be set in valid SPIR-V, otherwise throw.
            // ArrayStride is part of the array type not OpMemberDecorate.
            const dec = type_meta.decoration;
            if (dec.decoration_flags.get(Decoration.DecorationArrayStride))
                return dec.array_stride;
            else
                throw new Error("Struct member does not have ArrayStride set.");
        }
        else
            throw new Error("Struct member does not have ArrayStride set.");
    }

    protected type_struct_member_matrix_stride(type: SPIRType, index: number): number
    {
        const type_meta = this.ir.find_meta(type.self);
        if (type_meta) {
            // Decoration must be set in valid SPIR-V, otherwise throw.
            // MatrixStride is part of OpMemberDecorate.
            const dec = type_meta.members[index];
            if (dec.decoration_flags.get(Decoration.DecorationMatrixStride))
                return dec.matrix_stride;
            else
                throw new Error("Struct member does not have MatrixStride set.");
        }
        else
            throw new Error("Struct member does not have MatrixStride set.");
    }

    protected get_remapped_declared_block_name(id: number, fallback_prefer_instance_name: boolean): string
    {
        const itr = this.declared_block_names[id];
        if (itr) {
            return itr;
        }
        else {
            const var_ = this.get<SPIRVariable>(SPIRVariable, id);

            if (fallback_prefer_instance_name) {
                return this.to_name(var_.self);
            }
            else {
                const type = this.get<SPIRType>(SPIRType, var_.basetype);
                const type_meta = this.ir.find_meta(type.self);
                const block_name = type_meta ? type_meta.decoration.alias : null;
                return (!block_name || block_name === "") ? this.get_block_fallback_name(id) : block_name;
            }
        }
    }

    protected type_is_block_like(type: SPIRType): boolean
    {
        if (type.basetype !== SPIRTypeBaseType.Struct)
            return false;

        if (this.has_decoration(type.self, Decoration.DecorationBlock) || this.has_decoration(type.self, Decoration.DecorationBufferBlock)) {
            return true;
        }

        // Block-like types may have Offset decorations.
        for (let i = 0; i < type.member_types.length; i++)
            if (this.has_member_decoration(type.self, i, Decoration.DecorationOffset))
                return true;

        return false;
    }

    protected flush_phi_required(from: BlockID, to: BlockID): boolean
    {
        const child = this.get<SPIRBlock>(SPIRBlock, to);
        for (let phi of child.phi_variables)
            if (phi.parent === from)
                return true;
        return false;
    }

    protected evaluate_spec_constant_u32(spec: SPIRConstantOp): number
    {
        const result_type = this.get<SPIRType>(SPIRType, spec.basetype);
        if (result_type.basetype !== SPIRTypeBaseType.UInt && result_type.basetype !== SPIRTypeBaseType.Int &&
            result_type.basetype !== SPIRTypeBaseType.Boolean) {
            throw new Error("Only 32-bit integers and booleans are currently supported when evaluating specialization constants.");
        }

        if (!this.is_scalar(result_type))
            throw new Error("Spec constant evaluation must be a scalar.\n");

        let value = 0;

        const eval_u32 = (id: number): number =>
        {
            const type = this.expression_type(id);
            if (type.basetype !== SPIRTypeBaseType.UInt && type.basetype !== SPIRTypeBaseType.Int && type.basetype !== SPIRTypeBaseType.Boolean) {
                throw new Error("Only 32-bit integers and booleans are currently supported when evaluating specialization constants.");
            }

            if (!this.is_scalar(type))
                throw new Error("Spec constant evaluation must be a scalar.");

            const c = this.maybe_get<SPIRConstant>(SPIRConstant, id);
            if (c)
                return c.scalar();
            else
                return this.evaluate_spec_constant_u32(this.get<SPIRConstantOp>(SPIRConstantOp, id));
        };

        // Support the basic opcodes which are typically used when computing array sizes.
        switch (spec.opcode) {
            case Op.OpIAdd:
                value = eval_u32(spec.arguments[0]) + eval_u32(spec.arguments[1]);
                break;
            case Op.OpISub:
                value = eval_u32(spec.arguments[0]) - eval_u32(spec.arguments[1]);
                break;
            case Op.OpIMul:
                value = eval_u32(spec.arguments[0]) * eval_u32(spec.arguments[1]);
                break;
            case Op.OpBitwiseAnd:
                value = eval_u32(spec.arguments[0]) & eval_u32(spec.arguments[1]);
                break;
            case Op.OpBitwiseOr:
                value = eval_u32(spec.arguments[0]) | eval_u32(spec.arguments[1]);
                break;
            case Op.OpBitwiseXor:
                value = eval_u32(spec.arguments[0]) ^ eval_u32(spec.arguments[1]);
                break;
            case Op.OpLogicalAnd:
                value = eval_u32(spec.arguments[0]) & eval_u32(spec.arguments[1]);
                break;
            case Op.OpLogicalOr:
                value = eval_u32(spec.arguments[0]) | eval_u32(spec.arguments[1]);
                break;
            case Op.OpShiftLeftLogical:
                value = eval_u32(spec.arguments[0]) << eval_u32(spec.arguments[1]);
                break;
            case Op.OpShiftRightLogical:
            case Op.OpShiftRightArithmetic:
                value = eval_u32(spec.arguments[0]) >> eval_u32(spec.arguments[1]);
                break;
            case Op.OpLogicalEqual:
            case Op.OpIEqual:
                value = eval_u32(spec.arguments[0]) === eval_u32(spec.arguments[1]) ? 1 : 0;
                break;
            case Op.OpLogicalNotEqual:
            case Op.OpINotEqual:
                value = eval_u32(spec.arguments[0]) !== eval_u32(spec.arguments[1]) ? 1 : 0;
                break;
            case Op.OpULessThan:
            case Op.OpSLessThan:
                value = eval_u32(spec.arguments[0]) < eval_u32(spec.arguments[1]) ? 1 : 0;
                break;
            case Op.OpULessThanEqual:
            case Op.OpSLessThanEqual:
                value = eval_u32(spec.arguments[0]) <= eval_u32(spec.arguments[1]) ? 1 : 0;
                break;
            case Op.OpUGreaterThan:
            case Op.OpSGreaterThan:
                value = eval_u32(spec.arguments[0]) > eval_u32(spec.arguments[1]) ? 1 : 0;
                break;
            case Op.OpUGreaterThanEqual:
            case Op.OpSGreaterThanEqual:
                value = eval_u32(spec.arguments[0]) >= eval_u32(spec.arguments[1]) ? 1 : 0;
                break;

            case Op.OpLogicalNot:
                value = eval_u32(spec.arguments[0]) ? 0 : 1;
                break;

            case Op.OpNot:
                value = ~eval_u32(spec.arguments[0]);
                break;

            case Op.OpSNegate:
                value = -eval_u32(spec.arguments[0]);
                break;

            case Op.OpSelect:
                value = eval_u32(spec.arguments[0]) ? eval_u32(spec.arguments[1]) : eval_u32(spec.arguments[2]);
                break;

            case Op.OpUMod:
            case Op.OpSMod:
            case Op.OpSRem: {
                const a = eval_u32(spec.arguments[0]);
                const b = eval_u32(spec.arguments[1]);
                if (b === 0)
                    throw new Error("Undefined behavior in Mod, b === 0.\n");
                value = a % b;
                break;
            }

            case Op.OpUDiv:
            case Op.OpSDiv: {
                const a = eval_u32(spec.arguments[0]);
                const b = eval_u32(spec.arguments[1]);
                if (b === 0)
                    throw new Error("Undefined behavior in Div, b === 0.\n");
                value = a / b;
                break;
            }

            default:
                throw new Error("Unsupported spec constant opcode for evaluation.\n");
        }

        return value;
    }

    protected evaluate_constant_u32(id: number): number
    {
        const c = this.maybe_get<SPIRConstant>(SPIRConstant, id);
        if (c)
            return c.scalar();
        else
            return this.evaluate_spec_constant_u32(this.get<SPIRConstantOp>(SPIRConstantOp, id));
    }

    is_vertex_like_shader(): boolean
    {
        const model = this.get_execution_model();
        return model === ExecutionModel.ExecutionModelVertex || model === ExecutionModel.ExecutionModelGeometry ||
            model === ExecutionModel.ExecutionModelTessellationControl || model === ExecutionModel.ExecutionModelTessellationEvaluation;
    }

    get_case_list(block: SPIRBlock): SPIRBlockCase[]
    {
        const ir = this.ir;
        let width = 0;
        let constant: SPIRConstant;
        let var_: SPIRVariable;

        // First we check if we can get the type directly from the block.condition
        // since it can be a SPIRConstant or a SPIRVariable.
        if ((constant = this.maybe_get<SPIRConstant>(SPIRConstant, block.condition))) {
            const type = this.get<SPIRType>(SPIRType, constant.constant_type);
            width = type.width;
        }
        else if ((var_ = this.maybe_get<SPIRVariable>(SPIRVariable, block.condition))) {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            width = type.width;
        }
        else {
            const search = ir.load_type_width[block.condition];
            if (search) {
                throw new Error("Use of undeclared variable on a switch statement.");
            }

            width = search;
        }

        if (width > 32)
            return block.cases_64bit;

        return block.cases_32bit;
    }
}

function exists_unaccessed_path_to_return(cfg: CFG, block: number, blocks: Set<number>, visit_cache: Set<number>): boolean
{
    // This block accesses the variable.
    if (blocks.has(block))
        return false;

    // We are at the end of the CFG.
    if (cfg.get_succeeding_edges(block).length === 0)
        return true;

    // If any of our successors have a path to the end, there exists a path from block.
    for (let succ of cfg.get_succeeding_edges(block)) {
        if (!visit_cache.has(succ)) {
            if (exists_unaccessed_path_to_return(cfg, succ, blocks, visit_cache))
                return true;
            visit_cache.add(succ);
        }
    }

    return false;
}

function get_default_extended_decoration(decoration: ExtendedDecorations): number
{
    switch (decoration) {
        case ExtendedDecorations.SPIRVCrossDecorationResourceIndexPrimary:
        case ExtendedDecorations.SPIRVCrossDecorationResourceIndexSecondary:
        case ExtendedDecorations.SPIRVCrossDecorationResourceIndexTertiary:
        case ExtendedDecorations.SPIRVCrossDecorationResourceIndexQuaternary:
        case ExtendedDecorations.SPIRVCrossDecorationInterfaceMemberIndex:
            return ~0;

        default:
            return 0;
    }
}

function storage_class_is_interface(storage: StorageClass): boolean
{
    switch (storage) {
        case StorageClass.StorageClassInput:
        case StorageClass.StorageClassOutput:
        case StorageClass.StorageClassUniform:
        case StorageClass.StorageClassUniformConstant:
        case StorageClass.StorageClassAtomicCounter:
        case StorageClass.StorageClassPushConstant:
        case StorageClass.StorageClassStorageBuffer:
            return true;

        default:
            return false;
    }
}