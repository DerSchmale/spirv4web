import { Compiler, opcode_is_sign_invariant, to_signed_basetype, to_unsigned_basetype } from "../Compiler";
import { ParsedIR } from "../../parser/ParsedIR";
import { LocationComponentPair } from "../../common/LocationComponentPair";
import {
    AddressingModel,
    BuiltIn,
    Capability,
    Decoration,
    Dim,
    ExecutionMode,
    ExecutionModel,
    ImageFormat,
    Op,
    StorageClass
} from "../../spirv";
import { Pair } from "../../utils/Pair";
import { SPIRVariable } from "../../common/SPIRVariable";
import { SPIRType, SPIRTypeBaseType } from "../../common/SPIRType";
import { BackendVariations, PlsFormat } from "./glsl";
import { PlsRemap } from "./PlsRemap";
import { GLSLOptions } from "./GLSLOptions";
import { Types } from "../../common/Types";
import { ExtendedDecorations, Meta } from "../../common/Meta";
import { SPIRFunction } from "../../common/SPIRFunction";
import { StringStream } from "../../utils/StringStream";
import { SPIRExpression } from "../../common/SPIRExpression";
import { SPIRConstant } from "../../common/SPIRConstant";
import { SPIRAccessChain } from "../../common/SPIRAccessChain";
import { maplike_get } from "../../utils/maplike_get";
import { convert_to_string } from "../../utils/string";
import { type_is_floating_point, type_is_integral } from "../../common/common";
import { Bitset } from "../../common/Bitset";
import { GLSLPrecision } from "./GLSLPrecision";
import { Dict } from "../../utils/Dict";
import { SPIRConstantOp } from "../../common/SPIRConstantOp";
import { AccessChainMeta } from "../../common/AccessChainMeta";
import { AccessChainFlagBits } from "./AccessChainFlagBits";
import { SPIRUndef } from "../../common/SPIRUndef";
import { BufferPackingStandard } from "../BufferPackingStandard";

const swizzle: string[][] = [
    [ ".x", ".y", ".z", ".w" ],
    [ ".xy", ".yz", ".zw" ],
    [ ".xyz", ".yzw" ],
    [ "" ]
];

const ops: string[] = [];
ops[Op.OpSNegate] = "-";
ops[Op.OpNot] = "~";
ops[Op.OpIAdd] = "+";
ops[Op.OpISub] = "-";
ops[Op.OpIMul] = "*";
ops[Op.OpSDiv] = "/";
ops[Op.OpUDiv] = "/";
ops[Op.OpUMod] = "%";
ops[Op.OpSMod] = "%";
ops[Op.OpShiftRightLogical] = ">>";
ops[Op.OpShiftRightArithmetic] = ">>";
ops[Op.OpShiftLeftLogical] = ">>";
ops[Op.OpBitwiseOr] = "|";
ops[Op.OpBitwiseXor] = "^";
ops[Op.OpBitwiseAnd] = "&";
ops[Op.OpLogicalOr] = "||";
ops[Op.OpLogicalAnd] = "&&";
ops[Op.OpLogicalNot] = "!";
ops[Op.OpLogicalEqual] = "==";
ops[Op.OpLogicalNotEqual] = "!=";
ops[Op.OpIEqual] = "==";
ops[Op.OpINotEqual] = "!=";
ops[Op.OpULessThan] = "<";
ops[Op.OpSLessThan] = "<";
ops[Op.OpULessThanEqual] = "<=";
ops[Op.OpSLessThanEqual] = "<=";
ops[Op.OpUGreaterThan] = ">";
ops[Op.OpSGreaterThan] = ">";
ops[Op.OpSGreaterThanEqual] = ">=";
ops[Op.OpSGreaterThanEqual] = ">=";

const expectedVecComps: string[] = [ "x", "y", "z", "w" ];

const keywords: Set<string> = new Set([
    "abs", "acos", "acosh", "all", "any", "asin", "asinh", "atan", "atanh",
    "atomicAdd", "atomicCompSwap", "atomicCounter", "atomicCounterDecrement", "atomicCounterIncrement",
    "atomicExchange", "atomicMax", "atomicMin", "atomicOr", "atomicXor",
    "bitCount", "bitfieldExtract", "bitfieldInsert", "bitfieldReverse",
    "ceil", "cos", "cosh", "cross", "degrees",
    "dFdx", "dFdxCoarse", "dFdxFine",
    "dFdy", "dFdyCoarse", "dFdyFine",
    "distance", "dot", "EmitStreamVertex", "EmitVertex", "EndPrimitive", "EndStreamPrimitive", "equal", "exp", "exp2",
    "faceforward", "findLSB", "findMSB", "float16BitsToInt16", "float16BitsToUint16", "floatBitsToInt", "floatBitsToUint", "floor", "fma", "fract",
    "frexp", "fwidth", "fwidthCoarse", "fwidthFine",
    "greaterThan", "greaterThanEqual", "groupMemoryBarrier",
    "imageAtomicAdd", "imageAtomicAnd", "imageAtomicCompSwap", "imageAtomicExchange", "imageAtomicMax", "imageAtomicMin", "imageAtomicOr", "imageAtomicXor",
    "imageLoad", "imageSamples", "imageSize", "imageStore", "imulExtended", "int16BitsToFloat16", "intBitsToFloat", "interpolateAtOffset", "interpolateAtCentroid", "interpolateAtSample",
    "inverse", "inversesqrt", "isinf", "isnan", "ldexp", "length", "lessThan", "lessThanEqual", "log", "log2",
    "matrixCompMult", "max", "memoryBarrier", "memoryBarrierAtomicCounter", "memoryBarrierBuffer", "memoryBarrierImage", "memoryBarrierShared",
    "min", "mix", "mod", "modf", "noise", "noise1", "noise2", "noise3", "noise4", "normalize", "not", "notEqual",
    "outerProduct", "packDouble2x32", "packHalf2x16", "packInt2x16", "packInt4x16", "packSnorm2x16", "packSnorm4x8",
    "packUint2x16", "packUint4x16", "packUnorm2x16", "packUnorm4x8", "pow",
    "radians", "reflect", "refract", "round", "roundEven", "sign", "sin", "sinh", "smoothstep", "sqrt", "step",
    "tan", "tanh", "texelFetch", "texelFetchOffset", "texture", "textureGather", "textureGatherOffset", "textureGatherOffsets",
    "textureGrad", "textureGradOffset", "textureLod", "textureLodOffset", "textureOffset", "textureProj", "textureProjGrad",
    "textureProjGradOffset", "textureProjLod", "textureProjLodOffset", "textureProjOffset", "textureQueryLevels", "textureQueryLod", "textureSamples", "textureSize",
    "transpose", "trunc", "uaddCarry", "uint16BitsToFloat16", "uintBitsToFloat", "umulExtended", "unpackDouble2x32", "unpackHalf2x16", "unpackInt2x16", "unpackInt4x16",
    "unpackSnorm2x16", "unpackSnorm4x8", "unpackUint2x16", "unpackUint4x16", "unpackUnorm2x16", "unpackUnorm4x8", "usubBorrow",

    "active", "asm", "atomic_uint", "attribute", "bool", "break", "buffer",
    "bvec2", "bvec3", "bvec4", "case", "cast", "centroid", "class", "coherent", "common", "const", "continue", "default", "discard",
    "dmat2", "dmat2x2", "dmat2x3", "dmat2x4", "dmat3", "dmat3x2", "dmat3x3", "dmat3x4", "dmat4", "dmat4x2", "dmat4x3", "dmat4x4",
    "do", "double", "dvec2", "dvec3", "dvec4", "else", "enum", "extern", "external", "false", "filter", "fixed", "flat", "float",
    "for", "fvec2", "fvec3", "fvec4", "goto", "half", "highp", "hvec2", "hvec3", "hvec4", "if", "iimage1D", "iimage1DArray",
    "iimage2D", "iimage2DArray", "iimage2DMS", "iimage2DMSArray", "iimage2DRect", "iimage3D", "iimageBuffer", "iimageCube",
    "iimageCubeArray", "image1D", "image1DArray", "image2D", "image2DArray", "image2DMS", "image2DMSArray", "image2DRect",
    "image3D", "imageBuffer", "imageCube", "imageCubeArray", "in", "inline", "inout", "input", "int", "interface", "invariant",
    "isampler1D", "isampler1DArray", "isampler2D", "isampler2DArray", "isampler2DMS", "isampler2DMSArray", "isampler2DRect",
    "isampler3D", "isamplerBuffer", "isamplerCube", "isamplerCubeArray", "ivec2", "ivec3", "ivec4", "layout", "long", "lowp",
    "mat2", "mat2x2", "mat2x3", "mat2x4", "mat3", "mat3x2", "mat3x3", "mat3x4", "mat4", "mat4x2", "mat4x3", "mat4x4", "mediump",
    "namespace", "noinline", "noperspective", "out", "output", "packed", "partition", "patch", "precise", "precision", "public", "readonly",
    "resource", "restrict", "return", "sample", "sampler1D", "sampler1DArray", "sampler1DArrayShadow",
    "sampler1DShadow", "sampler2D", "sampler2DArray", "sampler2DArrayShadow", "sampler2DMS", "sampler2DMSArray",
    "sampler2DRect", "sampler2DRectShadow", "sampler2DShadow", "sampler3D", "sampler3DRect", "samplerBuffer",
    "samplerCube", "samplerCubeArray", "samplerCubeArrayShadow", "samplerCubeShadow", "shared", "short", "sizeof", "smooth", "static",
    "struct", "subroutine", "superp", "switch", "template", "this", "true", "typedef", "uimage1D", "uimage1DArray", "uimage2D",
    "uimage2DArray", "uimage2DMS", "uimage2DMSArray", "uimage2DRect", "uimage3D", "uimageBuffer", "uimageCube",
    "uimageCubeArray", "uint", "uniform", "union", "unsigned", "usampler1D", "usampler1DArray", "usampler2D", "usampler2DArray",
    "usampler2DMS", "usampler2DMSArray", "usampler2DRect", "usampler3D", "usamplerBuffer", "usamplerCube",
    "usamplerCubeArray", "using", "uvec2", "uvec3", "uvec4", "varying", "vec2", "vec3", "vec4", "void", "volatile",
    "while", "writeonly"
]);

type AccessChainFlags = number;

export class CompilerGLSL extends Compiler
{
    protected buffer: StringStream = new StringStream();

    protected redirect_statement: string[];

    protected options: GLSLOptions = new GLSLOptions();

    protected local_variable_names: Set<string> = new Set();
    protected resource_names: Set<string> = new Set();
    protected block_input_names: Set<string> = new Set();
    protected block_output_names: Set<string> = new Set();
    protected block_ubo_names: Set<string> = new Set();
    protected block_ssbo_names: Set<string> = new Set();
    protected block_names: Set<string> = new Set(); // A union of all block_*_names.
    protected function_overloads: Dict<Set<bigint>> = {};  //map<string, set<uint64_t>>
    protected preserved_aliases: string[] = [];     //map<uint32_t, string>

    protected backend: BackendVariations = new BackendVariations();

    protected indent: number = 0;

    // Ensure that we declare phi-variable copies even if the original declaration isn't deferred
    protected flushed_phi_variables: Set<number> = new Set();

    protected flattened_buffer_blocks: Set<number> = new Set();
    protected flattened_structs: boolean[] = []; //map<uint32_t, bool>

    // Usage tracking. If a temporary is used more than once, use the temporary instead to
    // avoid AST explosion when SPIRV is generated with pure SSA and doesn't write stuff to variables.
    protected expression_usage_counts: number[] = []; // std::unordered_map<uint32_t, uint32_t>

    protected forced_extensions: string[] = [];
    protected header_lines: string[] = [];

    protected statement_count: number = 0;

    protected requires_transpose_2x2: boolean = false;
    protected requires_transpose_3x3: boolean = false;
    protected requires_transpose_4x4: boolean = false;

    protected pls_inputs: PlsRemap[];
    protected pls_outputs: PlsRemap[];

    // GL_EXT_shader_framebuffer_fetch support.
    protected subpass_to_framebuffer_fetch_attachment: Pair<number, number>[] = [];
    protected inout_color_attachments: Pair<number, boolean>[] = [];

    protected masked_output_locations: Set<LocationComponentPair> = new Set();
    protected masked_output_builtins: Set<number> = new Set();


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
        const flags = maplike_get(Meta, this.ir.meta, type.self).decoration.decoration_flags;

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

    protected reset()
    {
        // We do some speculative optimizations which should pretty much always work out,
        // but just in case the SPIR-V is rather weird, recompile until it's happy.
        // This typically only means one extra pass.
        this.clear_force_recompile();

        // Clear invalid expression tracking.
        this.invalid_expressions.clear();
        this.current_function = null;

        // Clear temporary usage tracking.
        this.expression_usage_counts = [];
        this.forwarded_temporaries.clear();
        this.suppressed_usage_tracking.clear();

        // Ensure that we declare phi-variable copies even if the original declaration isn't deferred
        this.flushed_phi_variables.clear();

        this.reset_name_caches();

        const ir = this.ir;
        ir.for_each_typed_id<SPIRFunction>(SPIRFunction, (_, func) =>
        {
            func.active = false;
            func.flush_undeclared = true;
        });

        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) => var_.dependees = []);

        ir.reset_all_of_type(SPIRExpression);
        ir.reset_all_of_type(SPIRAccessChain);

        this.statement_count = 0;
        this.indent = 0;
        this.current_loop_level = 0;
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

    protected emit_header()
    {
        const execution = this.get_entry_point();
        const options = this.options;
        // const ir = this.ir;

        // WEBGL 1 doesn't support version number
        if (options.version !== 100)
            this.statement("#version ", options.version, options.es && options.version > 100 ? " es" : "");

        if (!options.es && options.version < 420) {
            // Needed for binding = # on UBOs, etc.
            if (options.enable_420pack_extension) {
                this.statement("#ifdef GL_ARB_shading_language_420pack");
                this.statement("#extension GL_ARB_shading_language_420pack : require");
                this.statement("#endif");
            }
            // Needed for: layout(early_fragment_tests) in;
            if (execution.flags.get(ExecutionMode.ExecutionModeEarlyFragmentTests))
                this.require_extension_internal("GL_ARB_shader_image_load_store");
        }

        // Needed for: layout(post_depth_coverage) in;
        if (execution.flags.get(ExecutionMode.ExecutionModePostDepthCoverage))
            this.require_extension_internal("GL_ARB_post_depth_coverage");

        // Needed for: layout({pixel,sample}_interlock_[un]ordered) in;
        const interlock_used = execution.flags.get(ExecutionMode.ExecutionModePixelInterlockOrderedEXT) ||
            execution.flags.get(ExecutionMode.ExecutionModePixelInterlockUnorderedEXT) ||
            execution.flags.get(ExecutionMode.ExecutionModeSampleInterlockOrderedEXT) ||
            execution.flags.get(ExecutionMode.ExecutionModeSampleInterlockUnorderedEXT);

        if (interlock_used) {
            if (options.es) {
                if (options.version < 310)
                    throw new Error("At least ESSL 3.10 required for fragment shader interlock.");
                this.require_extension_internal("GL_NV_fragment_shader_interlock");
            }
            else {
                if (options.version < 420)
                    this.require_extension_internal("GL_ARB_shader_image_load_store");
                this.require_extension_internal("GL_ARB_fragment_shader_interlock");
            }
        }

        for (let ext of this.forced_extensions) {
            if (ext === "GL_EXT_shader_explicit_arithmetic_types_float16") {
                // Special case, this extension has a potential fallback to another vendor extension in normal GLSL.
                // GL_AMD_gpu_shader_half_float is a superset, so try that first.
                this.statement("#if defined(GL_AMD_gpu_shader_half_float)");
                this.statement("#extension GL_AMD_gpu_shader_half_float : require");
                // if (!options.vulkan_semantics)
                // {
                this.statement("#elif defined(GL_NV_gpu_shader5)");
                this.statement("#extension GL_NV_gpu_shader5 : require");
                /*}
                else
                {
                    statement("#elif defined(GL_EXT_shader_explicit_arithmetic_types_float16)");
                    statement("#extension GL_EXT_shader_explicit_arithmetic_types_float16 : require");
                }*/
                this.statement("#else");
                this.statement("#error No extension available for FP16.");
                this.statement("#endif");
            }
            else if (ext === "GL_EXT_shader_explicit_arithmetic_types_int16") {
                // if (options.vulkan_semantics)
                //     statement("#extension GL_EXT_shader_explicit_arithmetic_types_int16 : require");
                // else
                // {
                this.statement("#if defined(GL_AMD_gpu_shader_int16)");
                this.statement("#extension GL_AMD_gpu_shader_int16 : require");
                this.statement("#elif defined(GL_NV_gpu_shader5)");
                this.statement("#extension GL_NV_gpu_shader5 : require");
                this.statement("#else");
                this.statement("#error No extension available for Int16.");
                this.statement("#endif");
                // }
            }
            else if (ext === "GL_ARB_post_depth_coverage") {
                if (options.es)
                    this.statement("#extension GL_EXT_post_depth_coverage : require");
                else {
                    this.statement("#if defined(GL_ARB_post_depth_coverge)");
                    this.statement("#extension GL_ARB_post_depth_coverage : require");
                    this.statement("#else");
                    this.statement("#extension GL_EXT_post_depth_coverage : require");
                    this.statement("#endif");
                }
            }
            else if (/*!options.vulkan_semantics &&*/ ext === "GL_ARB_shader_draw_parameters") {
                // Soft-enable this extension on plain GLSL.
                this.statement("#ifdef ", ext);
                this.statement("#extension ", ext, " : enable");
                this.statement("#endif");
            }
            else if (ext === "GL_EXT_control_flow_attributes") {
                // These are just hints so we can conditionally enable and fallback in the shader.
                this.statement("#if defined(GL_EXT_control_flow_attributes)");
                this.statement("#extension GL_EXT_control_flow_attributes : require");
                this.statement("#define SPIRV_CROSS_FLATTEN [[flatten]]");
                this.statement("#define SPIRV_CROSS_BRANCH [[dont_flatten]]");
                this.statement("#define SPIRV_CROSS_UNROLL [[unroll]]");
                this.statement("#define SPIRV_CROSS_LOOP [[dont_unroll]]");
                this.statement("#else");
                this.statement("#define SPIRV_CROSS_FLATTEN");
                this.statement("#define SPIRV_CROSS_BRANCH");
                this.statement("#define SPIRV_CROSS_UNROLL");
                this.statement("#define SPIRV_CROSS_LOOP");
                this.statement("#endif");
            }
            else if (ext === "GL_NV_fragment_shader_interlock") {
                this.statement("#extension GL_NV_fragment_shader_interlock : require");
                this.statement("#define SPIRV_Cross_beginInvocationInterlock() beginInvocationInterlockNV()");
                this.statement("#define SPIRV_Cross_endInvocationInterlock() endInvocationInterlockNV()");
            }
            else if (ext === "GL_ARB_fragment_shader_interlock") {
                this.statement("#ifdef GL_ARB_fragment_shader_interlock");
                this.statement("#extension GL_ARB_fragment_shader_interlock : enable");
                this.statement("#define SPIRV_Cross_beginInvocationInterlock() beginInvocationInterlockARB()");
                this.statement("#define SPIRV_Cross_endInvocationInterlock() endInvocationInterlockARB()");
                this.statement("#elif defined(GL_INTEL_fragment_shader_ordering)");
                this.statement("#extension GL_INTEL_fragment_shader_ordering : enable");
                this.statement("#define SPIRV_Cross_beginInvocationInterlock() beginFragmentShaderOrderingINTEL()");
                this.statement("#define SPIRV_Cross_endInvocationInterlock()");
                this.statement("#endif");
            }
            else
                this.statement("#extension ", ext, " : require");
        }

        // subgroups not supported
        /*if (!options.vulkan_semantics)
        {
            const Supp = ShaderSubgroupSupportHelper;
            const result = shader_subgroup_supporter.resolve();

            for (let feature_index = 0; feature_index < Supp::FeatureCount; feature_index++)
            {
                auto feature = static_cast<Supp::Feature>(feature_index);
                if (!shader_subgroup_supporter.is_feature_requested(feature))
                    continue;

                auto exts = Supp::get_candidates_for_feature(feature, result);
                if (exts.empty())
                    continue;

                statement("");

                for (auto &ext : exts)
                {
                    const char *name = Supp::get_extension_name(ext);
                    const char *extra_predicate = Supp::get_extra_required_extension_predicate(ext);
                    auto extra_names = Supp::get_extra_required_extension_names(ext);
                    statement(&ext !== &exts.front() ? "#elif" : "#if", " defined(", name, ")",
                        (*extra_predicate !== '\0' ? " && " : ""), extra_predicate);
                    for (const auto &e : extra_names)
                    statement("#extension ", e, " : enable");
                    statement("#extension ", name, " : require");
                }

                if (!Supp::can_feature_be_implemented_without_extensions(feature))
                {
                    statement("#else");
                    statement("#error No extensions available to emulate requested subgroup feature.");
                }

                statement("#endif");
            }
        }*/

        for (let header of this.header_lines)
            this.statement(header);

        const inputs: string[] = [];
        const outputs: string[] = [];

        switch (execution.model) {
            case ExecutionModel.ExecutionModelVertex:
                if (options.ovr_multiview_view_count)
                    inputs.push("num_views = " + options.ovr_multiview_view_count);
                break;
            /*case ExecutionModelGeometry:
                if ((execution.flags.get(ExecutionModeInvocations)) && execution.invocations !== 1)
                    inputs.push(join("invocations = ", execution.invocations));
                if (execution.flags.get(ExecutionModeInputPoints))
                    inputs.push("points");
                if (execution.flags.get(ExecutionModeInputLines))
                    inputs.push("lines");
                if (execution.flags.get(ExecutionModeInputLinesAdjacency))
                    inputs.push("lines_adjacency");
                if (execution.flags.get(ExecutionModeTriangles))
                    inputs.push("triangles");
                if (execution.flags.get(ExecutionModeInputTrianglesAdjacency))
                    inputs.push("triangles_adjacency");

                if (!execution.geometry_passthrough)
                {
                    // For passthrough, these are implies and cannot be declared in shader.
                    outputs.push(join("max_vertices = ", execution.output_vertices));
                    if (execution.flags.get(ExecutionModeOutputTriangleStrip))
                        outputs.push("triangle_strip");
                    if (execution.flags.get(ExecutionModeOutputPoints))
                        outputs.push("points");
                    if (execution.flags.get(ExecutionModeOutputLineStrip))
                        outputs.push("line_strip");
                }
                break;

            case ExecutionModelTessellationControl:
                if (execution.flags.get(ExecutionModeOutputVertices))
                    outputs.push(join("vertices = ", execution.output_vertices));
                break;

            case ExecutionModelTessellationEvaluation:
                if (execution.flags.get(ExecutionModeQuads))
                    inputs.push("quads");
                if (execution.flags.get(ExecutionModeTriangles))
                    inputs.push("triangles");
                if (execution.flags.get(ExecutionModeIsolines))
                    inputs.push("isolines");
                if (execution.flags.get(ExecutionModePointMode))
                    inputs.push("point_mode");

                if (!execution.flags.get(ExecutionModeIsolines))
                {
                    if (execution.flags.get(ExecutionModeVertexOrderCw))
                        inputs.push("cw");
                    if (execution.flags.get(ExecutionModeVertexOrderCcw))
                        inputs.push("ccw");
                }

                if (execution.flags.get(ExecutionModeSpacingFractionalEven))
                    inputs.push("fractional_even_spacing");
                if (execution.flags.get(ExecutionModeSpacingFractionalOdd))
                    inputs.push("fractional_odd_spacing");
                if (execution.flags.get(ExecutionModeSpacingEqual))
                    inputs.push("equal_spacing");
                break;

            case ExecutionModelGLCompute:
            {
                if (execution.workgroup_size.constant !== 0 || execution.flags.get(ExecutionModeLocalSizeId))
                {
                    SpecializationConstant wg_x, wg_y, wg_z;
                    get_work_group_size_specialization_constants(wg_x, wg_y, wg_z);

                    // If there are any spec constants on legacy GLSL, defer declaration, we need to set up macro
                    // declarations before we can emit the work group size.
                    if (options.vulkan_semantics ||
                        ((wg_x.id === ConstantID(0)) && (wg_y.id === ConstantID(0)) && (wg_z.id === ConstantID(0))))
                        build_workgroup_size(inputs, wg_x, wg_y, wg_z);
                }
                else
                {
                    inputs.push(join("local_size_x = ", execution.workgroup_size.x));
                    inputs.push(join("local_size_y = ", execution.workgroup_size.y));
                    inputs.push(join("local_size_z = ", execution.workgroup_size.z));
                }
                break;
            }*/

            case ExecutionModel.ExecutionModelFragment:
                if (options.es) {
                    switch (options.fragment.default_float_precision) {
                        case GLSLPrecision.Lowp:
                            this.statement("precision lowp float;");
                            break;

                        case GLSLPrecision.Mediump:
                            this.statement("precision mediump float;");
                            break;

                        case GLSLPrecision.Highp:
                            this.statement("precision highp float;");
                            break;

                        default:
                            break;
                    }

                    switch (options.fragment.default_int_precision) {
                        case GLSLPrecision.Lowp:
                            this.statement("precision lowp int;");
                            break;

                        case GLSLPrecision.Mediump:
                            this.statement("precision mediump int;");
                            break;

                        case GLSLPrecision.Highp:
                            this.statement("precision highp int;");
                            break;

                        default:
                            break;
                    }
                }

                if (execution.flags.get(ExecutionMode.ExecutionModeEarlyFragmentTests))
                    inputs.push("early_fragment_tests");
                if (execution.flags.get(ExecutionMode.ExecutionModePostDepthCoverage))
                    inputs.push("post_depth_coverage");

                if (interlock_used)
                    this.statement("#if defined(GL_ARB_fragment_shader_interlock)");

                if (execution.flags.get(ExecutionMode.ExecutionModePixelInterlockOrderedEXT))
                    this.statement("layout(pixel_interlock_ordered) in;");
                else if (execution.flags.get(ExecutionMode.ExecutionModePixelInterlockUnorderedEXT))
                    this.statement("layout(pixel_interlock_unordered) in;");
                else if (execution.flags.get(ExecutionMode.ExecutionModeSampleInterlockOrderedEXT))
                    this.statement("layout(sample_interlock_ordered) in;");
                else if (execution.flags.get(ExecutionMode.ExecutionModeSampleInterlockUnorderedEXT))
                    this.statement("layout(sample_interlock_unordered) in;");

                if (interlock_used) {
                    this.statement("#elif !defined(GL_INTEL_fragment_shader_ordering)");
                    this.statement("#error Fragment Shader Interlock/Ordering extension missing!");
                    this.statement("#endif");
                }

                if (!options.es && execution.flags.get(ExecutionMode.ExecutionModeDepthGreater))
                    this.statement("layout(depth_greater) out float gl_FragDepth;");
                else if (!options.es && execution.flags.get(ExecutionMode.ExecutionModeDepthLess))
                    this.statement("layout(depth_less) out float gl_FragDepth;");

                break;

            default:
                break;
        }

        /*for (let cap of ir.declared_capabilities)
            if (cap === Capability.CapabilityRayTraversalPrimitiveCullingKHR) {
                throw new error("Raytracing not supported");
                this.statement("layout(primitive_culling);");
            }*/

        if (inputs.length > 0)
            this.statement("layout(", inputs.join(", "), ") in;");
        if (outputs.length > 0)
            this.statement("layout(", outputs.join(", "), ") out;");

        this.statement("");
    }

    protected emit_struct_member(type: SPIRType, member_type_id: number, index: number, qualifier: string = "", base_offset: number = 0)
    {
        const membertype = this.get<SPIRType>(SPIRType, member_type_id);

        const { ir } = this;
        let memberflags;
        const memb = maplike_get(Meta, ir.meta, type.self).members;
        if (index < memb.length)
            memberflags = memb[index].decoration_flags;
        else
            memberflags = new Bitset();

        let qualifiers = "";
        const flags = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags;
        const is_block = flags.get(Decoration.DecorationBlock) || flags.get(Decoration.DecorationBufferBlock);

        if (is_block)
            qualifiers = this.to_interpolation_qualifiers(memberflags);

        this.statement(this.layout_for_member(type, index), qualifiers, qualifier, this.flags_to_qualifiers_glsl(membertype, memberflags),
            this.variable_decl(membertype, this.to_member_name(type, index)), ";");
    }

    protected emit_struct_padding_target(_: SPIRType)
    {
    }

    protected emit_buffer_block(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const ubo_block = var_.storage === StorageClass.StorageClassUniform && this.has_decoration(type.self, Decoration.DecorationBlock);

        const { options } = this;
        if (this.flattened_buffer_blocks.has(var_.self))
            this.emit_buffer_block_flattened(var_);
        else if (this.is_legacy() || (!options.es && options.version === 130) ||
            (ubo_block && options.emit_uniform_buffer_as_plain_uniforms))
            this.emit_buffer_block_legacy(var_);
        else
            this.emit_buffer_block_native(var_);
    }

    protected emit_push_constant_block(var_: SPIRVariable)
    {
        const { options } = this;
        if (this.flattened_buffer_blocks.has(var_.self))
            this.emit_buffer_block_flattened(var_);
            // else if (options.vulkan_semantics)
        //         this.emit_push_constant_block_vulkan(var_);
        else if (options.emit_push_constant_as_uniform_buffer)
            this.emit_buffer_block_native(var_);
        else
            this.emit_push_constant_block_glsl(var_);
    }

    protected emit_buffer_block_legacy(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const ir = this.ir;
        const ssbo = var_.storage === StorageClass.StorageClassStorageBuffer ||
            ir.meta[type.self].decoration.decoration_flags.get(Decoration.DecorationBufferBlock);
        if (ssbo)
            throw new Error("SSBOs not supported in legacy targets.");

        // We're emitting the push constant block as a regular struct, so disable the block qualifier temporarily.
        // Otherwise, we will end up emitting layout() qualifiers on naked structs which is not allowed.
        const block_flags = ir.meta[type.self].decoration.decoration_flags;
        const block_flag = block_flags.get(Decoration.DecorationBlock);
        block_flags.clear(Decoration.DecorationBlock);
        this.emit_struct(type);
        if (block_flag)
            block_flags.set(Decoration.DecorationBlock);
        this.emit_uniform(var_);
        this.statement("");
    }

    protected emit_buffer_block_flattened(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);

        // Block names should never alias.
        const buffer_name = this.to_name(type.self, false);
        const buffer_size = (this.get_declared_struct_size(type) + 15) / 16;

        const basic_type: SPIRTypeBaseType = this.get_common_basic_type(type);
        if (basic_type !== undefined) {
            let tmp = new SPIRType();
            tmp.basetype = basic_type;
            tmp.vecsize = 4;
            if (basic_type !== SPIRTypeBaseType.Float && basic_type !== SPIRTypeBaseType.Int && basic_type !== SPIRTypeBaseType.UInt)
                throw new Error("Basic types in a flattened UBO must be float, int or uint.");

            const flags = this.ir.get_buffer_block_flags(var_);
            this.statement("uniform ", this.flags_to_qualifiers_glsl(tmp, flags), this.type_to_glsl(tmp), " ", buffer_name, "[",
                buffer_size, "];");
        }
        else
            throw new Error("All basic types in a flattened block must be the same.");
    }

    protected emit_flattened_io_block(var_: SPIRVariable, qual: string)
    {
        const var_type = this.get<SPIRType>(SPIRType, var_.basetype);
        if (var_type.array.length > 0)
            throw new Error("Array of varying structs cannot be flattened to legacy-compatible varyings.");

        // Emit flattened types based on the type alias. Normally, we are never supposed to emit
        // struct declarations for aliased types.
        const type = var_type.type_alias ? this.get<SPIRType>(SPIRType, var_type.type_alias) : var_type;

        const { ir } = this;
        const dec = maplike_get(Meta, ir.meta, type.self).decoration;
        const old_flags = dec.decoration_flags.clone();
        // Emit the members as if they are part of a block to get all qualifiers.
        dec.decoration_flags.set(Decoration.DecorationBlock);

        type.member_name_cache.clear();

        const member_indices: number[] = [];
        member_indices.push(0);
        const basename = this.to_name(var_.self);

        let i = 0;
        for (let member of type.member_types) {
            this.add_member_name(type, i);
            const membertype = this.get<SPIRType>(SPIRType, member);

            member_indices[member_indices.length - 1] = i;
            if (membertype.basetype === SPIRTypeBaseType.Struct)
                this.emit_flattened_io_block_struct(basename, type, qual, member_indices);
            else
                this.emit_flattened_io_block_member(basename, type, qual, member_indices);
            i++;
        }

        dec.decoration_flags = old_flags;

        // Treat this variable as fully flattened from now on.
        this.flattened_structs[var_.self] = true;
    }

    protected emit_flattened_io_block_struct(basename: string, type: SPIRType, qual: string, indices: number[])
    {
        const sub_indices = indices.concat();
        sub_indices.push(0);

        let member_type: SPIRType = type;
        for (let index of indices)
            member_type = this.get<SPIRType>(SPIRType, member_type.member_types[index]);

        console.assert(member_type.basetype === SPIRTypeBaseType.Struct);

        if (member_type.array.length > 0)
            throw new Error("Cannot flatten array of structs in I/O blocks.");

        for (let i = 0; i < member_type.member_types.length; i++) {
            sub_indices[sub_indices.length - 1] = i;
            if (this.get<SPIRType>(SPIRType, member_type.member_types[i]).basetype === SPIRTypeBaseType.Struct)
                this.emit_flattened_io_block_struct(basename, type, qual, sub_indices);
            else
                this.emit_flattened_io_block_member(basename, type, qual, sub_indices);
        }
    }

    protected emit_flattened_io_block_member(basename: string, type: SPIRType, qual: string, indices: number[])
    {
        let member_type_id = type.self;
        let member_type: SPIRType = type;
        let parent_type: SPIRType = null;
        let flattened_name = basename;

        for (let index of indices) {
            flattened_name += "_";
            flattened_name += this.to_member_name(member_type, index);
            parent_type = member_type;
            member_type_id = member_type.member_types[index];
            member_type = this.get<SPIRType>(SPIRType, member_type_id);
        }

        console.assert(member_type.basetype !== SPIRTypeBaseType.Struct);

        // We're overriding struct member names, so ensure we do so on the primary type.
        if (parent_type.type_alias)
            parent_type = this.get<SPIRType>(SPIRType, parent_type.type_alias);

        // Sanitize underscores because joining the two identifiers might create more than 1 underscore in a row,
        // which is not allowed.
        flattened_name = ParsedIR.sanitize_underscores(flattened_name);

        const last_index = indices[indices.length - 1];

        // Pass in the varying qualifier here so it will appear in the correct declaration order.
        // Replace member name while emitting it so it encodes both struct name and member name.
        const backup_name = this.get_member_name(parent_type.self, last_index);
        const member_name = this.to_member_name(parent_type, last_index);
        this.set_member_name(parent_type.self, last_index, flattened_name);
        this.emit_struct_member(parent_type, member_type_id, last_index, qual);
        // Restore member name.
        this.set_member_name(parent_type.self, last_index, member_name);
    }

    protected emit_uniform(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const { options } = this;
        if (type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 2 && type.image.dim !== Dim.DimSubpassData) {
            if (!options.es && options.version < 420)
                this.require_extension_internal("GL_ARB_shader_image_load_store");
            else if (options.es && options.version < 310)
                throw new Error("At least ESSL 3.10 required for shader image load store.");
        }

        this.add_resource_name(var_.self);
        this.statement(this.layout_for_variable(var_), this.variable_decl(var_), ";");
    }

    // Converts the format of the current expression from packed to unpacked,
    // by wrapping the expression in a constructor of the appropriate type.
    // GLSL does not support packed formats, so simply return the expression.
    // Subclasses that do will override.
    protected unpack_expression_type(expr_str: string, _0: SPIRType, _1: number, _2: boolean, _3: boolean): string
    {
        return expr_str;
    }

    protected builtin_translates_to_nonarray(_: BuiltIn): boolean
    {
        return false;
    }

    protected statement_inner(...args)
    {
        for (let i = 0; i < args.length; ++i) {
            this.buffer.append(args[i]);
            this.statement_count++;
        }
    }

    // The optional id parameter indicates the object whose type we are trying
// to find the description for. It is optional. Most type descriptions do not
// depend on a specific object's use of that type.
    protected type_to_glsl(type: SPIRType, id: number = 0): string
    {
        if (type.pointer && type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT && type.basetype !== SPIRTypeBaseType.Struct) {
            // Need to create a magic type name which compacts the entire type information.
            let name = this.type_to_glsl(this.get_pointee_type(type));
            for (let i = 0; i < type.array.length; i++) {
                if (type.array_size_literal[i])
                    name += type.array[i] + "_";
                else
                    name += `id${type.array[i]}_"`;
            }
            name += "Pointer";
            return name;
        }

        const backend = this.backend;
        switch (type.basetype) {
            case SPIRTypeBaseType.Struct:
                // Need OpName lookup here to get a "sensible" name for a struct.
                if (backend.explicit_struct_type)
                    return "struct " + this.to_name(type.self);
                else
                    return this.to_name(type.self);

            case SPIRTypeBaseType.Image:
            case SPIRTypeBaseType.SampledImage:
                return this.image_type_glsl(type, id);

            case SPIRTypeBaseType.Sampler:
                // The depth field is set by calling code based on the variable ID of the sampler, effectively reintroducing
                // this distinction into the type system.
                return this.comparison_ids.has(id) ? "samplerShadow" : "sampler";

            case SPIRTypeBaseType.AccelerationStructure:
                // return this.ray_tracing_is_khr ? "accelerationStructureEXT" : "accelerationStructureNV";
                throw new Error("AccelerationStructure is not supported");

            case SPIRTypeBaseType.RayQuery:
                throw new Error("RayQuery is not supported");
                return "rayQueryEXT";

            case SPIRTypeBaseType.Void:
                return "void";

            default:
                break;
        }

        if (type.basetype === SPIRTypeBaseType.UInt && this.is_legacy())
            throw new Error("Unsigned integers are not supported on legacy targets.");

        // TODO: All below can be simplified using a lookup if we assume correct Spir-V
        if (type.vecsize === 1 && type.columns === 1) // Scalar builtin
        {
            switch (type.basetype) {
                case SPIRTypeBaseType.Boolean:
                    return "bool";
                case SPIRTypeBaseType.SByte:
                    return backend.basic_int8_type;
                case SPIRTypeBaseType.UByte:
                    return backend.basic_uint8_type;
                case SPIRTypeBaseType.Short:
                    return backend.basic_int16_type;
                case SPIRTypeBaseType.UShort:
                    return backend.basic_uint16_type;
                case SPIRTypeBaseType.Int:
                    return backend.basic_int_type;
                case SPIRTypeBaseType.UInt:
                    return backend.basic_uint_type;
                case SPIRTypeBaseType.AtomicCounter:
                    return "atomic_uint";
                case SPIRTypeBaseType.Half:
                    return "float16_t";
                case SPIRTypeBaseType.Float:
                    return "float";
                case SPIRTypeBaseType.Double:
                    return "double";
                case SPIRTypeBaseType.Int64:
                    return "int64_t";
                case SPIRTypeBaseType.UInt64:
                    return "uint64_t";
                default:
                    return "???";
            }
        }
        else if (type.vecsize > 1 && type.columns === 1) // Vector builtin
        {
            switch (type.basetype) {
                case SPIRTypeBaseType.Boolean:
                    return "bvec" + type.vecsize;
                case SPIRTypeBaseType.SByte:
                    return "i8vec" + type.vecsize;
                case SPIRTypeBaseType.UByte:
                    return "u8vec" + type.vecsize;
                case SPIRTypeBaseType.Short:
                    return "i16vec" + type.vecsize;
                case SPIRTypeBaseType.UShort:
                    return "u16vec" + type.vecsize;
                case SPIRTypeBaseType.Int:
                    return "ivec" + type.vecsize;
                case SPIRTypeBaseType.UInt:
                    return "uvec" + type.vecsize;
                case SPIRTypeBaseType.Half:
                    return "f16vec" + type.vecsize;
                case SPIRTypeBaseType.Float:
                    return "vec" + type.vecsize;
                case SPIRTypeBaseType.Double:
                    return "dvec" + type.vecsize;
                case SPIRTypeBaseType.Int64:
                    return "i64vec" + type.vecsize;
                case SPIRTypeBaseType.UInt64:
                    return "u64vec" + type.vecsize;
                default:
                    return "???";
            }
        }
        else if (type.vecsize === type.columns) // Simple Matrix builtin
        {
            switch (type.basetype) {
                case SPIRTypeBaseType.Boolean:
                    return "bmat" + type.vecsize;
                case SPIRTypeBaseType.Int:
                    return "imat" + type.vecsize;
                case SPIRTypeBaseType.UInt:
                    return "umat" + type.vecsize;
                case SPIRTypeBaseType.Half:
                    return "f16mat" + type.vecsize;
                case SPIRTypeBaseType.Float:
                    return "mat" + type.vecsize;
                case SPIRTypeBaseType.Double:
                    return "dmat" + type.vecsize;
                // Matrix types not supported for int64/uint64.
                default:
                    return "???";
            }
        }
        else {
            switch (type.basetype) {
                case SPIRTypeBaseType.Boolean:
                    return `bmat${type.columns}x${type.vecsize}`;
                case SPIRTypeBaseType.Int:
                    return `imat${type.columns}x${type.vecsize}`;
                case SPIRTypeBaseType.UInt:
                    return `umat${type.columns}x${type.vecsize}`;
                case SPIRTypeBaseType.Half:
                    return `f16mat${type.columns}x${type.vecsize}`;
                case SPIRTypeBaseType.Float:
                    return `mat${type.columns}x${type.vecsize}`;
                case SPIRTypeBaseType.Double:
                    return `dmat${type.columns}x${type.vecsize}`;
                // Matrix types not supported for int64/uint64.
                default:
                    return "???";
            }
        }
    }

    builtin_to_glsl(builtin: BuiltIn, storage: StorageClass): string
    {
        const options = this.options;
        switch (builtin) {
            case BuiltIn.BuiltInPosition:
                return "gl_Position";
            case BuiltIn.BuiltInPointSize:
                return "gl_PointSize";
            case BuiltIn.BuiltInClipDistance:
                return "gl_ClipDistance";
            case BuiltIn.BuiltInCullDistance:
                return "gl_CullDistance";
            case BuiltIn.BuiltInVertexId:
                // if (options.vulkan_semantics)
                //     throw new Error("Cannot implement gl_VertexID in Vulkan GLSL. This shader was created "
                // "with GL semantics.");
                return "gl_VertexID";
            case BuiltIn.BuiltInInstanceId:
                /*if (options.vulkan_semantics)
                {
                    auto model = get_entry_point().model;
                    switch (model)
                    {
                        case spv::ExecutionModelIntersectionKHR:
                        case spv::ExecutionModelAnyHitKHR:
                        case spv::ExecutionModelClosestHitKHR:
                            // gl_InstanceID is allowed in these shaders.
                            break;

                        default:
                            throw new Error("Cannot implement gl_InstanceID in Vulkan GLSL. This shader was "
                            "created with GL semantics.");
                    }
                }*/
                if (!options.es && options.version < 140) {
                    this.require_extension_internal("GL_ARB_draw_instanced");
                }
                return "gl_InstanceID";
            case BuiltIn.BuiltInVertexIndex:
                /*if (options.vulkan_semantics)
                    return "gl_VertexIndex";
                else*/
                return "gl_VertexID"; // gl_VertexID already has the base offset applied.
            case BuiltIn.BuiltInInstanceIndex:
                // if (options.vulkan_semantics)
                //     return "gl_InstanceIndex";

                if (!options.es && options.version < 140) {
                    this.require_extension_internal("GL_ARB_draw_instanced");
                }

                if (options.vertex.support_nonzero_base_instance) {
                    // if (!options.vulkan_semantics)
                    // {
                    // This is a soft-enable. We will opt-in to using gl_BaseInstanceARB if supported.
                    this.require_extension_internal("GL_ARB_shader_draw_parameters");
                    // }
                    return "(gl_InstanceID + SPIRV_Cross_BaseInstance)"; // ... but not gl_InstanceID.
                }
                else
                    return "gl_InstanceID";
            case BuiltIn.BuiltInPrimitiveId:
                if (storage === StorageClass.StorageClassInput && this.get_entry_point().model === ExecutionModel.ExecutionModelGeometry)
                    return "gl_PrimitiveIDIn";
                else
                    return "gl_PrimitiveID";
            case BuiltIn.BuiltInInvocationId:
                return "gl_InvocationID";
            case BuiltIn.BuiltInLayer:
                return "gl_Layer";
            case BuiltIn.BuiltInViewportIndex:
                return "gl_ViewportIndex";
            case BuiltIn.BuiltInTessLevelOuter:
                return "gl_TessLevelOuter";
            case BuiltIn.BuiltInTessLevelInner:
                return "gl_TessLevelInner";
            case BuiltIn.BuiltInTessCoord:
                return "gl_TessCoord";
            case BuiltIn.BuiltInFragCoord:
                return "gl_FragCoord";
            case BuiltIn.BuiltInPointCoord:
                return "gl_PointCoord";
            case BuiltIn.BuiltInFrontFacing:
                return "gl_FrontFacing";
            case BuiltIn.BuiltInFragDepth:
                return "gl_FragDepth";
            case BuiltIn.BuiltInNumWorkgroups:
                return "gl_NumWorkGroups";
            case BuiltIn.BuiltInWorkgroupSize:
                return "gl_WorkGroupSize";
            case BuiltIn.BuiltInWorkgroupId:
                return "gl_WorkGroupID";
            case BuiltIn.BuiltInLocalInvocationId:
                return "gl_LocalInvocationID";
            case BuiltIn.BuiltInGlobalInvocationId:
                return "gl_GlobalInvocationID";
            case BuiltIn.BuiltInLocalInvocationIndex:
                return "gl_LocalInvocationIndex";
            case BuiltIn.BuiltInHelperInvocation:
                return "gl_HelperInvocation";

            case BuiltIn.BuiltInBaseVertex:
                if (options.es)
                    throw new Error("BaseVertex not supported in ES profile.");

                /*if (options.vulkan_semantics)
                {
                    if (options.version < 460)
                    {
                        require_extension_internal("GL_ARB_shader_draw_parameters");
                        return "gl_BaseVertexARB";
                    }
                    return "gl_BaseVertex";
                }*/
                // On regular GL, this is soft-enabled and we emit ifdefs in code.
                this.require_extension_internal("GL_ARB_shader_draw_parameters");
                return "SPIRV_Cross_BaseVertex";

            case BuiltIn.BuiltInBaseInstance:
                if (options.es)
                    throw new Error("BaseInstance not supported in ES profile.");

                /*if (options.vulkan_semantics)
                {
                    if (options.version < 460)
                    {
                        require_extension_internal("GL_ARB_shader_draw_parameters");
                        return "gl_BaseInstanceARB";
                    }
                    return "gl_BaseInstance";
                }*/
                // On regular GL, this is soft-enabled and we emit ifdefs in code.
                this.require_extension_internal("GL_ARB_shader_draw_parameters");
                return "SPIRV_Cross_BaseInstance";

            case BuiltIn.BuiltInDrawIndex:
                if (options.es)
                    throw new Error("DrawIndex not supported in ES profile.");

                /*if (options.vulkan_semantics)
                {
                    if (options.version < 460)
                    {
                        require_extension_internal("GL_ARB_shader_draw_parameters");
                        return "gl_DrawIDARB";
                    }
                    return "gl_DrawID";
                }*/
                // On regular GL, this is soft-enabled and we emit ifdefs in code.
                this.require_extension_internal("GL_ARB_shader_draw_parameters");
                return "gl_DrawIDARB";

            case BuiltIn.BuiltInSampleId:
                if (options.es && options.version < 320)
                    this.require_extension_internal("GL_OES_sample_variables");
                if (!options.es && options.version < 400)
                    throw new Error("gl_SampleID not supported before GLSL 400.");
                return "gl_SampleID";

            case BuiltIn.BuiltInSampleMask:
                if (options.es && options.version < 320)
                    this.require_extension_internal("GL_OES_sample_variables");
                if (!options.es && options.version < 400)
                    throw new Error("gl_SampleMask/gl_SampleMaskIn not supported before GLSL 400.");

                if (storage === StorageClass.StorageClassInput)
                    return "gl_SampleMaskIn";
                else
                    return "gl_SampleMask";

            case BuiltIn.BuiltInSamplePosition:
                if (options.es && options.version < 320)
                    this.require_extension_internal("GL_OES_sample_variables");
                if (!options.es && options.version < 400)
                    throw new Error("gl_SamplePosition not supported before GLSL 400.");
                return "gl_SamplePosition";

            case BuiltIn.BuiltInViewIndex:
                /*if (options.vulkan_semantics)
                    return "gl_ViewIndex";
                else*/
                return "gl_ViewID_OVR";

            case BuiltIn.BuiltInNumSubgroups:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::NumSubgroups);
            return "gl_NumSubgroups";*/

            case BuiltIn.BuiltInSubgroupId:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupID);
            return "gl_SubgroupID";*/

            case BuiltIn.BuiltInSubgroupSize:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupSize);
            return "gl_SubgroupSize";*/

            case BuiltIn.BuiltInSubgroupLocalInvocationId:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupInvocationID);
            return "gl_SubgroupInvocationID";*/

            case BuiltIn.BuiltInSubgroupEqMask:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
            return "gl_SubgroupEqMask";*/

            case BuiltIn.BuiltInSubgroupGeMask:
            /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
            return "gl_SubgroupGeMask";*/

            case BuiltIn.BuiltInSubgroupGtMask:
            /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
            return "gl_SubgroupGtMask";*/

            case BuiltIn.BuiltInSubgroupLeMask:
            /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
            return "gl_SubgroupLeMask";*/

            case BuiltIn.BuiltInSubgroupLtMask:
                /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
                return "gl_SubgroupLtMask";*/
                throw new Error("Subgroups not supported");

            case BuiltIn.BuiltInLaunchIdKHR:
            // return ray_tracing_is_khr ? "gl_LaunchIDEXT" : "gl_LaunchIDNV";
            case BuiltIn.BuiltInLaunchSizeKHR:
            // return ray_tracing_is_khr ? "gl_LaunchSizeEXT" : "gl_LaunchSizeNV";
            case BuiltIn.BuiltInWorldRayOriginKHR:
            // return ray_tracing_is_khr ? "gl_WorldRayOriginEXT" : "gl_WorldRayOriginNV";
            case BuiltIn.BuiltInWorldRayDirectionKHR:
            // return ray_tracing_is_khr ? "gl_WorldRayDirectionEXT" : "gl_WorldRayDirectionNV";
            case BuiltIn.BuiltInObjectRayOriginKHR:
            // return ray_tracing_is_khr ? "gl_ObjectRayOriginEXT" : "gl_ObjectRayOriginNV";
            case BuiltIn.BuiltInObjectRayDirectionKHR:
            // return ray_tracing_is_khr ? "gl_ObjectRayDirectionEXT" : "gl_ObjectRayDirectionNV";
            case BuiltIn.BuiltInRayTminKHR:
            // return ray_tracing_is_khr ? "gl_RayTminEXT" : "gl_RayTminNV";
            case BuiltIn.BuiltInRayTmaxKHR:
            // return ray_tracing_is_khr ? "gl_RayTmaxEXT" : "gl_RayTmaxNV";
            case BuiltIn.BuiltInInstanceCustomIndexKHR:
            // return ray_tracing_is_khr ? "gl_InstanceCustomIndexEXT" : "gl_InstanceCustomIndexNV";
            case BuiltIn.BuiltInObjectToWorldKHR:
            // return ray_tracing_is_khr ? "gl_ObjectToWorldEXT" : "gl_ObjectToWorldNV";
            case BuiltIn.BuiltInWorldToObjectKHR:
            // return ray_tracing_is_khr ? "gl_WorldToObjectEXT" : "gl_WorldToObjectNV";
            case BuiltIn.BuiltInHitTNV:
            // gl_HitTEXT is an alias of RayTMax in KHR.
            // return "gl_HitTNV";
            case BuiltIn.BuiltInHitKindKHR:
            // return ray_tracing_is_khr ? "gl_HitKindEXT" : "gl_HitKindNV";
            case BuiltIn.BuiltInIncomingRayFlagsKHR:
                throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "gl_IncomingRayFlagsEXT" : "gl_IncomingRayFlagsNV";

            case BuiltIn.BuiltInBaryCoordNV: {
                if (options.es && options.version < 320)
                    throw new Error("gl_BaryCoordNV requires ESSL 320.");
                else if (!options.es && options.version < 450)
                    throw new Error("gl_BaryCoordNV requires GLSL 450.");
                this.require_extension_internal("GL_NV_fragment_shader_barycentric");
                return "gl_BaryCoordNV";
            }

            case BuiltIn.BuiltInBaryCoordNoPerspNV: {
                if (options.es && options.version < 320)
                    throw new Error("gl_BaryCoordNoPerspNV requires ESSL 320.");
                else if (!options.es && options.version < 450)
                    throw new Error("gl_BaryCoordNoPerspNV requires GLSL 450.");
                this.require_extension_internal("GL_NV_fragment_shader_barycentric");
                return "gl_BaryCoordNoPerspNV";
            }

            case BuiltIn.BuiltInFragStencilRefEXT: {
                if (!options.es) {
                    this.require_extension_internal("GL_ARB_shader_stencil_export");
                    return "gl_FragStencilRefARB";
                }
                else
                    throw new Error("Stencil export not supported in GLES.");
            }

            case BuiltIn.BuiltInPrimitiveShadingRateKHR: {
                // if (!options.vulkan_semantics)
                throw new Error("Can only use PrimitiveShadingRateKHR in Vulkan GLSL.");
                // require_extension_internal("GL_EXT_fragment_shading_rate");
                // return "gl_PrimitiveShadingRateEXT";
            }

            case BuiltIn.BuiltInShadingRateKHR: {
                // if (!options.vulkan_semantics)
                throw new Error("Can only use ShadingRateKHR in Vulkan GLSL.");
                // require_extension_internal("GL_EXT_fragment_shading_rate");
                // return "gl_ShadingRateEXT";
            }

            case BuiltIn.BuiltInDeviceIndex:
                // if (!options.vulkan_semantics)
                throw new Error("Need Vulkan semantics for device group support.");
            // require_extension_internal("GL_EXT_device_group");
            // return "gl_DeviceIndex";

            case BuiltIn.BuiltInFullyCoveredEXT:
                if (!options.es)
                    this.require_extension_internal("GL_NV_conservative_raster_underestimation");
                else
                    throw new Error("Need desktop GL to use GL_NV_conservative_raster_underestimation.");
                return "gl_FragFullyCoveredNV";

            default:
                return "gl_BuiltIn_" + convert_to_string(builtin);
        }
    }

    protected image_type_glsl(type: SPIRType, id: number = 0): string
    {
        const imagetype = this.get<SPIRType>(SPIRType, type.image.type);
        let res = "";

        switch (imagetype.basetype) {
            case SPIRTypeBaseType.Int:
            case SPIRTypeBaseType.Short:
            case SPIRTypeBaseType.SByte:
                res = "i";
                break;
            case SPIRTypeBaseType.UInt:
            case SPIRTypeBaseType.UShort:
            case SPIRTypeBaseType.UByte:
                res = "u";
                break;
            default:
                break;
        }

        // For half image types, we will force mediump for the sampler, and cast to f16 after any sampling operation.
        // We cannot express a true half texture type in GLSL. Neither for short integer formats for that matter.
        const options = this.options;
        /*if (type.basetype === SPIRTypeBaseType.Image && type.image.dim === Dim.DimSubpassData && options.vulkan_semantics)
            return res + "subpassInput" + (type.image.ms ? "MS" : "");
        else*/
        if (type.basetype === SPIRTypeBaseType.Image && type.image.dim === Dim.DimSubpassData &&
            this.subpass_input_is_framebuffer_fetch(id)) {
            const sampled_type = this.get<SPIRType>(SPIRType, type.image.type);
            sampled_type.vecsize = 4;
            return this.type_to_glsl(sampled_type);
        }

        // If we're emulating subpassInput with samplers, force sampler2D
        // so we don't have to specify format.
        if (type.basetype === SPIRTypeBaseType.Image && type.image.dim !== Dim.DimSubpassData) {
            // Sampler buffers are always declared as samplerBuffer even though they might be separate images in the SPIR-V.
            if (type.image.dim === Dim.DimBuffer && type.image.sampled === 1)
                res += "sampler";
            else
                res += type.image.sampled === 2 ? "image" : "texture";
        }
        else
            res += "sampler";

        switch (type.image.dim) {
            case Dim.Dim1D:
                res += "1D";
                break;
            case Dim.Dim2D:
                res += "2D";
                break;
            case Dim.Dim3D:
                res += "3D";
                break;
            case Dim.DimCube:
                res += "Cube";
                break;
            case Dim.DimRect:
                if (options.es)
                    throw new Error("Rectangle textures are not supported on OpenGL ES.");

                if (this.is_legacy_desktop())
                    this.require_extension_internal("GL_ARB_texture_rectangle");

                res += "2DRect";
                break;

            case Dim.DimBuffer:
                if (options.es && options.version < 320)
                    this.require_extension_internal("GL_EXT_texture_buffer");
                else if (!options.es && options.version < 300)
                    this.require_extension_internal("GL_EXT_texture_buffer_object");
                res += "Buffer";
                break;

            case Dim.DimSubpassData:
                res += "2D";
                break;
            default:
                throw new Error("Only 1D, 2D, 2DRect, 3D, Buffer, InputTarget and Cube textures supported.");
        }

        if (type.image.ms)
            res += "MS";
        if (type.image.arrayed) {
            if (this.is_legacy_desktop())
                this.require_extension_internal("GL_EXT_texture_array");
            res += "Array";
        }

        // "Shadow" state in GLSL only exists for samplers and combined image samplers.
        if (((type.basetype === SPIRTypeBaseType.SampledImage) || (type.basetype === SPIRTypeBaseType.Sampler)) &&
            this.is_depth_image(type, id)) {
            res += "Shadow";
        }

        return res;
    }

    constant_expression(c: SPIRConstant): string
    {
        const type = this.get<SPIRType>(SPIRType, c.constant_type);
        const backend = this.backend;

        if (type.pointer) {
            return backend.null_pointer_literal;
        }
        else if (c.subconstants.length > 0) {
            // Handles Arrays and structures.
            let res: string;

            // Allow Metal to use the array<T> template to make arrays a value type
            let needs_trailing_tracket = false;
            if (backend.use_initializer_list && backend.use_typed_initializer_list && type.basetype === SPIRTypeBaseType.Struct &&
                type.array.length === 0) {
                res = this.type_to_glsl_constructor(type) + "{ ";
            }
            else if (backend.use_initializer_list && backend.use_typed_initializer_list && backend.array_is_value_type &&
                type.array.length > 0) {
                res = this.type_to_glsl_constructor(type) + "({ ";
                needs_trailing_tracket = true;
            }
            else if (backend.use_initializer_list) {
                res = "{ ";
            }
            else {
                res = this.type_to_glsl_constructor(type) + "(";
            }

            for (let i = 0; i < c.subconstants.length; ++i) {
                const elem = c.subconstants[i];
                const subc = this.get<SPIRConstant>(SPIRConstant, elem);
                if (subc.specialization)
                    res += this.to_name(elem);
                else
                    res += this.constant_expression(subc);

                if (i !== c.subconstants.length - 1)
                    res += ", ";
            }

            res += backend.use_initializer_list ? " }" : ")";
            if (needs_trailing_tracket)
                res += ")";

            return res;
        }
        else if (type.basetype === SPIRTypeBaseType.Struct && type.member_types.length === 0) {
            // Metal tessellation likes empty structs which are then constant expressions.
            if (backend.supports_empty_struct)
                return "{ }";
            else if (backend.use_typed_initializer_list)
                return this.type_to_glsl(this.get<SPIRType>(SPIRType, c.constant_type)) + "{ 0 }";
            else if (backend.use_initializer_list)
                return "{ 0 }";
            else
                return this.type_to_glsl(this.get<SPIRType>(SPIRType, c.constant_type)) + "(0)";
        }
        else if (c.columns() === 1) {
            return this.constant_expression_vector(c, 0);
        }
        else {
            let res = this.type_to_glsl(this.get<SPIRType>(SPIRType, c.constant_type)) + "(";
            for (let col = 0; col < c.columns(); col++) {
                if (c.specialization_constant_id(col) !== 0)
                    res += this.to_name(c.specialization_constant_id(col));
                else
                    res += this.constant_expression_vector(c, col);

                if (col + 1 < c.columns())
                    res += ", ";
            }
            res += ")";
            return res;
        }
    }

    constant_op_expression(cop: SPIRConstantOp): string
    {
        const type = this.get<SPIRType>(SPIRType, cop.basetype);
        let binary = false;
        let unary = false;
        let op: string = "";

        if (this.is_legacy() && is_unsigned_opcode(cop.opcode))
            throw new Error("Unsigned integers are not supported on legacy targets.");

        // TODO: Find a clean way to reuse emit_instruction.
        switch (cop.opcode) {
            case Op.OpSConvert:
            case Op.OpUConvert:
            case Op.OpFConvert:
                op = this.type_to_glsl_constructor(type);
                break;

            case Op.OpSNegate:
            case Op.OpNot:
            case Op.OpLogicalNot:
                unary = true;
                op = ops[cop.opcode];
                break;
            case Op.OpIAdd:
            case Op.OpISub:
            case Op.OpIMul:
            case Op.OpSDiv:
            case Op.OpUDiv:
            case Op.OpUMod:
            case Op.OpSMod:
            case Op.OpShiftRightLogical:
            case Op.OpShiftRightArithmetic:
            case Op.OpShiftLeftLogical:
            case Op.OpBitwiseOr:
            case Op.OpBitwiseXor:
            case Op.OpBitwiseAnd:
            case Op.OpLogicalOr:
            case Op.OpLogicalAnd:
            case Op.OpLogicalEqual:
            case Op.OpLogicalNotEqual:
            case Op.OpIEqual:
            case Op.OpINotEqual:
            case Op.OpULessThan:
            case Op.OpSLessThan:
            case Op.OpULessThanEqual:
            case Op.OpSLessThanEqual:
            case Op.OpUGreaterThan:
            case Op.OpSGreaterThan:
            case Op.OpUGreaterThanEqual:
            case Op.OpSGreaterThanEqual:
                binary = true;
                op = ops[cop.opcode];
                break;

            case Op.OpSRem: {
                const op0 = cop.arguments[0];
                const op1 = cop.arguments[1];
                return this.to_enclosed_expression(op0) + " - " + this.to_enclosed_expression(op1) + " * (",
                this.to_enclosed_expression(op0) + " / " + this.to_enclosed_expression(op1) + ")";
            }

            case Op.OpSelect: {
                if (cop.arguments.length < 3)
                    throw new Error("Not enough arguments to OpSpecConstantOp.");

                // This one is pretty annoying. It's triggered from
                // uint(bool), int(bool) from spec constants.
                // In order to preserve its compile-time constness in Vulkan GLSL,
                // we need to reduce the OpSelect expression back to this simplified model.
                // If we cannot, fail.
                const _op = this.to_trivial_mix_op(type, cop.arguments[2], cop.arguments[1], cop.arguments[0]);
                if (_op) {
                    op = _op;
                    // Implement as a simple cast down below.
                }
                else {
                    // Implement a ternary and pray the compiler understands it :)
                    return this.to_ternary_expression(type, cop.arguments[0], cop.arguments[1], cop.arguments[2]);
                }
                break;
            }

            case Op.OpVectorShuffle: {
                let expr = this.type_to_glsl_constructor(type);
                expr += "(";

                const left_components = this.expression_type(cop.arguments[0]).vecsize;
                const left_arg = this.to_enclosed_expression(cop.arguments[0]);
                const right_arg = this.to_enclosed_expression(cop.arguments[1]);

                for (let i = 2; i < cop.arguments.length; i++) {
                    const index = cop.arguments[i];
                    if (index >= left_components)
                        expr += right_arg + "." + "xyzw"[index - left_components];
                    else
                        expr += left_arg + "." + "xyzw"[index];

                    if (i + 1 < cop.arguments.length)
                        expr += ", ";
                }

                expr += ")";
                return expr;
            }

            case Op.OpCompositeExtract: {
                const expr = this.access_chain_internal(cop.arguments[0], cop.arguments.slice(1), cop.arguments.length - 1,
                    AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT, null);
                return expr;
            }

            case Op.OpCompositeInsert:
                throw new Error("OpCompositeInsert spec constant op is not supported.");

            default:
                // Some opcodes are unimplemented here, these are currently not possible to test from glslang.
                throw new Error("Unimplemented spec constant op.");
        }

        let bit_width = 0;
        if (unary || binary || cop.opcode === Op.OpSConvert || cop.opcode === Op.OpUConvert)
            bit_width = this.expression_type(cop.arguments[0]).width;

        let input_type: SPIRTypeBaseType;
        const skip_cast_if_equal_type = opcode_is_sign_invariant(cop.opcode);

        switch (cop.opcode) {
            case Op.OpIEqual:
            case Op.OpINotEqual:
                input_type = to_signed_basetype(bit_width);
                break;

            case Op.OpSLessThan:
            case Op.OpSLessThanEqual:
            case Op.OpSGreaterThan:
            case Op.OpSGreaterThanEqual:
            case Op.OpSMod:
            case Op.OpSDiv:
            case Op.OpShiftRightArithmetic:
            case Op.OpSConvert:
            case Op.OpSNegate:
                input_type = to_signed_basetype(bit_width);
                break;

            case Op.OpULessThan:
            case Op.OpULessThanEqual:
            case Op.OpUGreaterThan:
            case Op.OpUGreaterThanEqual:
            case Op.OpUMod:
            case Op.OpUDiv:
            case Op.OpShiftRightLogical:
            case Op.OpUConvert:
                input_type = to_unsigned_basetype(bit_width);
                break;

            default:
                input_type = type.basetype;
                break;
        }

        if (binary) {
            if (cop.arguments.length < 2)
                throw new Error("Not enough arguments to OpSpecConstantOp.");

            const props = { cast_op0: "", cast_op1: "", input_type };
            const expected_type = this.binary_op_bitcast_helper(props, cop.arguments[0], cop.arguments[1], skip_cast_if_equal_type);
            input_type = props.input_type;

            if (type.basetype !== input_type && type.basetype !== SPIRTypeBaseType.Boolean) {
                expected_type.basetype = input_type;
                let expr = this.bitcast_glsl_op(type, expected_type);
                expr += "(" + props.cast_op0 + " " + op + " " + props.cast_op1 + ")";
                return expr;
            }
            else
                return "(" + props.cast_op0 + " " + op + " " + props.cast_op1 + ")";
        }
        else if (unary) {
            if (cop.arguments.length < 1)
                throw new Error("Not enough arguments to OpSpecConstantOp.");

            // Auto-bitcast to result type as needed.
            // Works around various casting scenarios in glslang as there is no OpBitcast for specialization constants.
            return "(" + op + this.bitcast_glsl(type, cop.arguments[0]) + ")";
        }
        else if (cop.opcode === Op.OpSConvert || cop.opcode === Op.OpUConvert) {
            if (cop.arguments.length < 1)
                throw new Error("Not enough arguments to OpSpecConstantOp.");

            const arg_type = this.expression_type(cop.arguments[0]);
            if (arg_type.width < type.width && input_type !== arg_type.basetype) {
                const expected = arg_type;
                expected.basetype = input_type;
                return op + "(" + this.bitcast_glsl(expected, cop.arguments[0]) + ")";
            }
            else
                return op + "(" + this.to_expression(cop.arguments[0]) + ")";
        }
        else {
            if (cop.arguments.length < 1)
                throw new Error("Not enough arguments to OpSpecConstantOp.");
            return op + "(" + this.to_expression(cop.arguments[0]) + ")";
        }
    }

    protected constant_expression_vector(c: SPIRConstant, vector: number): string
    {
        const type = this.get<SPIRType>(SPIRType, c.constant_type);
        type.columns = 1;

        const scalar_type = type;
        scalar_type.vecsize = 1;

        const backend = this.backend;
        let res = "";
        let splat = backend.use_constructor_splatting && c.vector_size() > 1;
        let swizzle_splat = backend.can_swizzle_scalar && c.vector_size() > 1;

        if (!type_is_floating_point(type)) {
            // Cannot swizzle literal integers as a special case.
            swizzle_splat = false;
        }

        if (splat || swizzle_splat) {
            // Cannot use constant splatting if we have specialization constants somewhere in the vector.
            for (let i = 0; i < c.vector_size(); i++) {
                if (c.specialization_constant_id(vector, i) !== 0) {
                    splat = false;
                    swizzle_splat = false;
                    break;
                }
            }
        }

        if (splat || swizzle_splat) {
            if (type.width === 64) {
                const ident: bigint = c.scalar_u64(vector, 0);
                for (let i = 1; i < c.vector_size(); i++) {
                    if (ident !== c.scalar_u64(vector, i)) {
                        splat = false;
                        swizzle_splat = false;
                        break;
                    }
                }
            }
            else {
                let ident = c.scalar(vector, 0);
                for (let i = 1; i < c.vector_size(); i++) {
                    if (ident !== c.scalar(vector, i)) {
                        splat = false;
                        swizzle_splat = false;
                    }
                }
            }
        }

        if (c.vector_size() > 1 && !swizzle_splat)
            res += this.type_to_glsl(type) + "(";

        switch (type.basetype) {
            case SPIRTypeBaseType.Half:
                if (splat || swizzle_splat) {
                    res += this.convert_half_to_string(c, vector, 0);
                    if (swizzle_splat)
                        res = this.remap_swizzle(this.get<SPIRType>(SPIRType, c.constant_type), 1, res);
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else
                            res += this.convert_half_to_string(c, vector, i);

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.Float:
                if (splat || swizzle_splat) {
                    res += this.convert_float_to_string(c, vector, 0);
                    if (swizzle_splat)
                        res = this.remap_swizzle(this.get<SPIRType>(SPIRType, c.constant_type), 1, res);
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else
                            res += this.convert_float_to_string(c, vector, i);

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.Double:
                if (splat || swizzle_splat) {
                    res += this.convert_double_to_string(c, vector, 0);
                    if (swizzle_splat)
                        res = this.remap_swizzle(this.get<SPIRType>(SPIRType, c.constant_type), 1, res);
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else
                            res += this.convert_double_to_string(c, vector, i);

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.Int64: {
                const tmp = type;
                tmp.vecsize = 1;
                tmp.columns = 1;
                const int64_type = this.type_to_glsl(tmp);

                if (splat) {
                    res += convert_to_string(c.scalar_i64(vector, 0), int64_type, backend.long_long_literal_suffix);
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else
                            res += convert_to_string(c.scalar_i64(vector, i), int64_type, backend.long_long_literal_suffix);

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;
            }

            case SPIRTypeBaseType.UInt64:
                if (splat) {
                    res += convert_to_string(c.scalar_u64(vector, 0));
                    if (backend.long_long_literal_suffix)
                        res += "ull";
                    else
                        res += "ul";
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else {
                            res += convert_to_string(c.scalar_u64(vector, i));
                            if (backend.long_long_literal_suffix)
                                res += "ull";
                            else
                                res += "ul";
                        }

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.UInt:
                if (splat) {
                    res += convert_to_string(c.scalar(vector, 0));
                    if (this.is_legacy()) {
                        // Fake unsigned constant literals with signed ones if possible.
                        // Things like array sizes, etc, tend to be unsigned even though they could just as easily be signed.
                        if (c.scalar_i32(vector, 0) < 0)
                            throw new Error("Tried to convert uint literal into int, but this made the literal negative.");
                    }
                    else if (backend.uint32_t_literal_suffix)
                        res += "u";
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else {
                            res += convert_to_string(c.scalar(vector, i));
                            if (this.is_legacy()) {
                                // Fake unsigned constant literals with signed ones if possible.
                                // Things like array sizes, etc, tend to be unsigned even though they could just as easily be signed.
                                if (c.scalar_i32(vector, i) < 0)
                                    throw new Error("Tried to convert uint literal into int, but this made the literal negative.");
                            }
                            else if (backend.uint32_t_literal_suffix)
                                res += "u";
                        }

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.Int:
                if (splat)
                    res += convert_to_string(c.scalar_i32(vector, 0));
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else
                            res += convert_to_string(c.scalar_i32(vector, i));
                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.UShort:
                if (splat) {
                    res += convert_to_string(c.scalar(vector, 0));
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else {
                            if (backend.uint16_t_literal_suffix !== "") {
                                res += convert_to_string(c.scalar_u16(vector, i));
                                res += backend.uint16_t_literal_suffix;
                            }
                            else {
                                // If backend doesn't have a literal suffix, we need to value cast.
                                res += this.type_to_glsl(scalar_type);
                                res += "(";
                                res += convert_to_string(c.scalar_u16(vector, i));
                                res += ")";
                            }
                        }

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.Short:
                if (splat) {
                    res += convert_to_string(c.scalar_i16(vector, 0));
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else {
                            if (backend.int16_t_literal_suffix !== "") {
                                res += convert_to_string(c.scalar_i16(vector, i));
                                res += backend.int16_t_literal_suffix;
                            }
                            else {
                                // If backend doesn't have a literal suffix, we need to value cast.
                                res += this.type_to_glsl(scalar_type);
                                res += "(";
                                res += convert_to_string(c.scalar_i16(vector, i));
                                res += ")";
                            }
                        }

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.UByte:
                if (splat) {
                    res += convert_to_string(c.scalar_u8(vector, 0));
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else {
                            res += this.type_to_glsl(scalar_type);
                            res += "(";
                            res += convert_to_string(c.scalar_u8(vector, i));
                            res += ")";
                        }

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.SByte:
                if (splat) {
                    res += convert_to_string(c.scalar_i8(vector, 0));
                }
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else {
                            res += this.type_to_glsl(scalar_type);
                            res += "(";
                            res += convert_to_string(c.scalar_i8(vector, i));
                            res += ")";
                        }

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            case SPIRTypeBaseType.Boolean:
                if (splat)
                    res += c.scalar(vector, 0) ? "true" : "false";
                else {
                    for (let i = 0; i < c.vector_size(); i++) {
                        if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                            res += this.to_expression(c.specialization_constant_id(vector, i));
                        else
                            res += c.scalar(vector, i) ? "true" : "false";

                        if (i + 1 < c.vector_size())
                            res += ", ";
                    }
                }
                break;

            default:
                throw new Error("Invalid constant expression basetype.");
        }

        if (c.vector_size() > 1 && !swizzle_splat)
            res += ")";

        return res;
    }

    protected statement(...args)
    {
        if (this.is_forcing_recompilation()) {
            // Do not bother emitting code while force_recompile is active.
            // We will compile again.
            this.statement_count++;
            return;
        }

        if (this.redirect_statement) {
            this.redirect_statement = this.redirect_statement.concat(...args);
            this.statement_count++;
        }
        else {
            for (let i = 0; i < this.indent; i++)
                this.buffer.append("\t");

            this.statement_inner(...args);
            this.buffer.append("\n");
        }
    }

    protected statement_no_indent(...args)
    {
        const old_indent = this.indent;
        this.indent = 0;
        this.statement(...args);
        this.indent = old_indent;
    }

    protected begin_scope()
    {
        this.statement("{");
        this.indent++;
    }

    protected end_scope(trailer?: string)
    {
        if (!this.indent)
            throw new Error("Popping empty indent stack.");
        this.indent--;
        if (trailer)
            this.statement("}", trailer);
        else
            this.statement("}");
    }


    protected end_scope_decl(decl?: string)
    {
        if (!this.indent)
            throw new Error("Popping empty indent stack.");
        this.indent--;

        if (decl)
            this.statement("} ", decl, ";");
        else
            this.statement("};");
    }

    protected add_resource_name(id: number)
    {
        const dec = maplike_get(Meta, this.ir.meta, id).decoration;
        dec.alias = this.add_variable(this.resource_names, this.block_names, dec.alias);
    }

    protected add_member_name(type: SPIRType, index: number)
    {
        const memb = maplike_get(Meta, this.ir.meta, type.self).members;
        if (index < memb.length && memb[index].alias !== "") {
            let name = memb[index].alias;
            if (name === "")
                return;

            name = ParsedIR.sanitize_identifier(name, true, true);
            name = this.update_name_cache(type.member_name_cache, name);

            memb[index].alias = name;
        }
    }

    protected type_to_array_glsl(type: SPIRType)
    {
        if (type.pointer && type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT && type.basetype !== SPIRTypeBaseType.Struct) {
            // We are using a wrapped pointer type, and we should not emit any array declarations here.
            return "";
        }

        if (type.array.length === 0)
            return "";

        const options = this.options;
        if (options.flatten_multidimensional_arrays) {
            let res = "";
            res += "[";
            for (let i = type.array.length; i; i--) {
                res += this.enclose_expression(this.to_array_size(type, i - 1));
                if (i > 1)
                    res += " * ";
            }
            res += "]";
            return res;
        }
        else {
            if (type.array.length > 1) {
                if (!options.es && options.version < 430)
                    this.require_extension_internal("GL_ARB_arrays_of_arrays");
                else if (options.es && options.version < 310)
                    throw new Error("Arrays of arrays not supported before ESSL version 310. " +
                        "Try using --flatten-multidimensional-arrays or set " +
                        "options.flatten_multidimensional_arrays to true.");
            }

            let res = "";
            for (let i = type.array.length; i; i--) {
                res += "[";
                res += this.to_array_size(type, i - 1);
                res += "]";
            }
            return res;
        }
    }

    protected to_array_size(type: SPIRType, index: number): string
    {
        console.assert(type.array.length === type.array_size_literal.length);

        const size = type.array[index];
        if (!type.array_size_literal[index])
            return this.to_expression(size);
        else if (size)
            return convert_to_string(size);
        else if (!this.backend.unsized_array_supported) {
            // For runtime-sized arrays, we can work around
            // lack of standard support for this by simply having
            // a single element array.
            //
            // Runtime length arrays must always be the last element
            // in an interface block.
            return "1";
        }
        else
            return "";
    }

    protected to_array_size_literal(type: SPIRType, index?: number): number
    {
        if (index === undefined)
            index = type.array.length - 1;

        console.assert(type.array.length === type.array_size_literal.length);

        if (type.array_size_literal[index]) {
            return type.array[index];
        }
        else {
            // Use the default spec constant value.
            // This is the best we can do.
            return this.evaluate_constant_u32(type.array[index]);
        }
    }

    protected variable_decl(type: SPIRType, name: string, id?: number);
    protected variable_decl(variable: SPIRVariable): string
    protected variable_decl(variable: SPIRVariable | SPIRType, name?: string, id: number = 0)
    {
        if (name !== undefined) {
            // first overload
            const type = <SPIRType>variable;
            let type_name = this.type_to_glsl(type, id);
            type_name = this.remap_variable_type_name(type, name, type_name);
            return type_name + " " + name + this.type_to_array_glsl(type);
        }

        variable = <SPIRVariable>variable;
        // Ignore the pointer type since GLSL doesn't have pointers.
        const type = this.get_variable_data_type(variable);

        if (type.pointer_depth > 1 && !this.backend.support_pointer_to_pointer)
            throw new Error("Cannot declare pointer-to-pointer types.");

        const options = this.options;
        const ir = this.ir;
        let res = this.to_qualifiers_glsl(variable.self) + this.variable_decl(type, this.to_name(variable.self), variable.self);

        if (variable.loop_variable && variable.static_expression) {
            const expr = variable.static_expression;
            if (ir.ids[expr].get_type() !== Types.TypeUndef)
                res += " = " + this.to_unpacked_expression(variable.static_expression);
            else if (options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                res += " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(variable));
        }
        else if (variable.initializer && !this.variable_decl_is_remapped_storage(variable, StorageClass.StorageClassWorkgroup)) {
            const expr = variable.initializer;
            if (ir.ids[expr].get_type() !== Types.TypeUndef)
                res += " = " + this.to_initializer_expression(variable);
            else if (options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                res += " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(variable));
        }

        return res;
    }

    protected variable_decl_is_remapped_storage(var_: SPIRVariable, storage: StorageClass): boolean
    {
        return var_.storage === storage;
    }

    protected is_non_native_row_major_matrix(id: number): boolean
    {
        // Natively supported row-major matrices do not need to be converted.
        // Legacy targets do not support row major.
        if (this.backend.native_row_major_matrix && !this.is_legacy())
            return false;

        const e = this.maybe_get<SPIRExpression>(SPIRExpression, id);
        if (e)
            return e.need_transpose;
        else
            return this.has_decoration(id, Decoration.DecorationRowMajor);
    }

    protected member_is_non_native_row_major_matrix(type: SPIRType, index: number): boolean
    {
        // Natively supported row-major matrices do not need to be converted.
        if (this.backend.native_row_major_matrix && !this.is_legacy())
            return false;

        // Non-matrix or column-major matrix types do not need to be converted.
        if (!this.has_member_decoration(type.self, index, Decoration.DecorationRowMajor))
            return false;

        // Only square row-major matrices can be converted at this time.
        // Converting non-square matrices will require defining custom GLSL function that
        // swaps matrix elements while retaining the original dimensional form of the matrix.
        const mbr_type = this.get<SPIRType>(SPIRType, type.member_types[index]);
        if (mbr_type.columns !== mbr_type.vecsize)
            throw new Error("Row-major matrices must be square on this platform.");

        return true;
    }

    protected member_is_remapped_physical_type(type: SPIRType, index: number): boolean
    {
        return this.has_extended_member_decoration(type.self, index, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
    }

    protected member_is_packed_physical_type(type: SPIRType, index: number): boolean
    {
        return this.has_extended_member_decoration(type.self, index, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked);
    }

    // Wraps the expression string in a function call that converts the
    // row_major matrix result of the expression to a column_major matrix.
    // Base implementation uses the standard library transpose() function.
    // Subclasses may override to use a different function.
    protected convert_row_major_matrix(exp_str: string, exp_type: SPIRType, physical_type_id: number, is_packed: boolean): string
    {
        exp_str = this.strip_enclosed_expression(exp_str);
        if (!this.is_matrix(exp_type)) {
            const column_index = exp_str.lastIndexOf("[");
            if (column_index === -1)
                return exp_str;

            const column_expr = exp_str.substring(column_index);
            exp_str = exp_str.substring(0, column_index);

            let transposed_expr = this.type_to_glsl_constructor(exp_type) + "(";

            // Loading a column from a row-major matrix. Unroll the load.
            for (let c = 0; c < exp_type.vecsize; c++) {
                transposed_expr += `${exp_str}[${c}]${column_expr}`;
                if (c + 1 < exp_type.vecsize)
                    transposed_expr += ", ";
            }

            transposed_expr += ")";
            return transposed_expr;
        }
        else if (this.options.version < 120) {
            // GLSL 110, ES 100 do not have transpose(), so emulate it.  Note that
            // these GLSL versions do not support non-square matrices.
            if (exp_type.vecsize === 2 && exp_type.columns === 2) {
                if (!this.requires_transpose_2x2) {
                    this.requires_transpose_2x2 = true;
                    this.force_recompile();
                }
            }
            else if (exp_type.vecsize === 3 && exp_type.columns === 3) {
                if (!this.requires_transpose_3x3) {
                    this.requires_transpose_3x3 = true;
                    this.force_recompile();
                }
            }
            else if (exp_type.vecsize === 4 && exp_type.columns === 4) {
                if (!this.requires_transpose_4x4) {
                    this.requires_transpose_4x4 = true;
                    this.force_recompile();
                }
            }
            else
                throw new Error("Non-square matrices are not supported in legacy GLSL, cannot transpose.");
            return `spvTranspose(${exp_str})`;
        }
        else
            return `transpose(${exp_str})`;
    }

    protected preserve_alias_on_reset(id: number)
    {
        this.preserved_aliases[id] = this.get_name(id);
    }

    protected reset_name_caches()
    {
        this.preserved_aliases.forEach((preserved_second, preserved_first) =>
            this.set_name(preserved_first, preserved_second)
        );

        this.preserved_aliases = [];
        this.resource_names.clear();
        this.block_input_names.clear();
        this.block_output_names.clear();
        this.block_ubo_names.clear();
        this.block_ssbo_names.clear();
        this.block_names.clear();
        this.function_overloads = {};
    }

    protected emit_struct(type: SPIRType)
    {
        // Struct types can be stamped out multiple times
        // with just different offsets, matrix layouts, etc ...
        // Type-punning with these types is legal, which complicates things
        // when we are storing struct and array types in an SSBO for example.
        // If the type master is packed however, we can no longer assume that the struct declaration will be redundant.
        if (type.type_alias !== <TypeID>(0) && !this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked))
            return;

        this.add_resource_name(type.self);
        const name = this.type_to_glsl(type);

        const { backend } = this;

        this.statement(!backend.explicit_struct_type ? "struct " : "", name);
        this.begin_scope();

        type.member_name_cache.clear();

        let i = 0;
        let emitted = false;
        for (let member of type.member_types) {
            this.add_member_name(type, i);
            this.emit_struct_member(type, member, i);
            i++;
            emitted = true;
        }

        // Don't declare empty structs in GLSL, this is not allowed.
        if (this.type_is_empty(type) && !backend.supports_empty_struct) {
            this.statement("int empty_struct_member;");
            emitted = true;
        }

        if (this.has_extended_decoration(type.self, ExtendedDecorations.SPIRVCrossDecorationPaddingTarget))
            this.emit_struct_padding_target(type);

        this.end_scope_decl();

        if (emitted)
            this.statement("");
    }


    protected emit_resources()
    {
        const execution = this.get_entry_point();
        const options = this.options;
        const ir = this.ir;

        this.replace_illegal_names();

        // Legacy GL uses gl_FragData[], redeclare all fragment outputs
        // with builtins.
        if (execution.model === ExecutionModel.ExecutionModelFragment && this.is_legacy())
            this.replace_fragment_outputs();

        // Emit PLS blocks if we have such variables.
        if (this.pls_inputs.length > 0 || this.pls_outputs.length > 0)
            this.emit_pls();

        /*switch (execution.model)
        {
            case ExecutionModelGeometry:
            case ExecutionModelTessellationControl:
            case ExecutionModelTessellationEvaluation:
                fixup_implicit_builtin_block_names();
                break;

            default:
                break;
        }*/

        // Emit custom gl_PerVertex for SSO compatibility.
        if (options.separate_shader_objects && !options.es && execution.model !== ExecutionModel.ExecutionModelFragment) {
            switch (execution.model) {
                /*case ExecutionModelGeometry:
                case ExecutionModelTessellationControl:
                case ExecutionModelTessellationEvaluation:
                    emit_declared_builtin_block(StorageClassInput, execution.model);
                    emit_declared_builtin_block(StorageClassOutput, execution.model);
                    break;*/

                case ExecutionModel.ExecutionModelVertex:
                    this.emit_declared_builtin_block(StorageClass.StorageClassOutput, execution.model);
                    break;

                default:
                    break;
            }
        }
        else if (this.should_force_emit_builtin_block(StorageClass.StorageClassOutput)) {
            this.emit_declared_builtin_block(StorageClass.StorageClassOutput, execution.model);
        }
        else if (execution.geometry_passthrough) {
            // Need to declare gl_in with Passthrough.
            // If we're doing passthrough, we cannot emit an output block, so the output block test above will never pass.
            this.emit_declared_builtin_block(StorageClass.StorageClassInput, execution.model);
        }
        else {
            // Need to redeclare clip/cull distance with explicit size to use them.
            // SPIR-V mandates these builtins have a size declared.
            const storage = execution.model === ExecutionModel.ExecutionModelFragment ? "in" : "out";
            if (this.clip_distance_count !== 0)
                this.statement(storage, " float gl_ClipDistance[", this.clip_distance_count, "];");
            if (this.cull_distance_count !== 0)
                this.statement(storage, " float gl_CullDistance[", this.cull_distance_count, "];");
            if (this.clip_distance_count !== 0 || this.cull_distance_count !== 0)
                this.statement("");
        }

        if (this.position_invariant) {
            this.statement("invariant gl_Position;");
            this.statement("");
        }

        let emitted = false;

        // If emitted Vulkan GLSL,
        // emit specialization constants as actual floats,
        // spec op expressions will redirect to the constant name.
        //
        {
            const loop_lock = ir.create_loop_hard_lock();
            for (const id_ of ir.ids_for_constant_or_type) {
                const id = ir.ids[id_];

                if (id.get_type() === Types.TypeConstant) {
                    const c = id.get<SPIRConstant>(SPIRConstant);

                    const needs_declaration = c.specialization || c.is_used_as_lut;

                    if (needs_declaration) {
                        if (/*!options.vulkan_semantics &&*/ c.specialization) {
                            c.specialization_constant_macro_name =
                                this.constant_value_macro_name(this.get_decoration(c.self, Decoration.DecorationSpecId));
                        }
                        this.emit_constant(c);
                        emitted = true;
                    }
                }
                else if (id.get_type() === Types.TypeConstantOp) {
                    this.emit_specialization_constant_op(id.get<SPIRConstantOp>(SPIRConstantOp));
                    emitted = true;
                }
                else if (id.get_type() === Types.TypeType) {
                    let type = id.get<SPIRType>(SPIRType);

                    let is_natural_struct = type.basetype === SPIRTypeBaseType.Struct && type.array.length === 0 && type.pointer &&
                        (!this.has_decoration(type.self, Decoration.DecorationBlock) &&
                            !this.has_decoration(type.self, Decoration.DecorationBufferBlock));

                    // Special case, ray payload and hit attribute blocks are not really blocks, just regular structs.
                    /*if (type.basetype === SPIRTypeBaseType.Struct && type.pointer &&
                        this.has_decoration(type.self, Decoration.DecorationBlock) &&
                        (type.storage === StorageClass.StorageClassRayPayloadKHR || type.storage === StorageClass.StorageClassIncomingRayPayloadKHR ||
                        type.storage === StorageClass.StorageClassHitAttributeKHR))
                    {
                        type = this.get<SPIRType>(SPIRType, type.parent_type);
                        is_natural_struct = true;
                    }*/

                    if (is_natural_struct) {
                        if (emitted)
                            this.statement("");
                        emitted = false;

                        this.emit_struct(type);
                    }
                }
            }
            loop_lock.dispose();
        }

        if (emitted)
            this.statement("");

        // If we needed to declare work group size late, check here.
        // If the work group size depends on a specialization constant, we need to declare the layout() block
        // after constants (and their macros) have been declared.
        /*if (execution.model === ExecutionModelGLCompute && !options.vulkan_semantics &&
            (execution.workgroup_size.constant !== 0 || execution.flags.get(ExecutionModeLocalSizeId)))
        {
            SpecializationConstant wg_x, wg_y, wg_z;
            get_work_group_size_specialization_constants(wg_x, wg_y, wg_z);

            if ((wg_x.id !== ConstantID(0)) || (wg_y.id !== ConstantID(0)) || (wg_z.id !== ConstantID(0)))
            {
                SmallVector<string> inputs;
                build_workgroup_size(inputs, wg_x, wg_y, wg_z);
                statement("layout(", merge(inputs), ") in;");
                statement("");
            }
        }*/

        emitted = false;

        if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT) {
            for (let type of this.physical_storage_non_block_pointer_types) {
                this.emit_buffer_reference_block(type, false);
            }

            // Output buffer reference blocks.
            // Do this in two stages, one with forward declaration,
            // and one without. Buffer reference blocks can reference themselves
            // to support things like linked lists.
            ir.for_each_typed_id<SPIRType>(SPIRType, (self, type) =>
            {
                if (type.basetype === SPIRTypeBaseType.Struct && type.pointer &&
                    type.pointer_depth === 1 && !this.type_is_array_of_pointers(type) &&
                    type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
                    this.emit_buffer_reference_block(self, true);
                }
            });

            ir.for_each_typed_id<SPIRType>(SPIRType, (self, type) =>
            {
                if (type.basetype === SPIRTypeBaseType.Struct &&
                    type.pointer && type.pointer_depth === 1 && !this.type_is_array_of_pointers(type) &&
                    type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
                    this.emit_buffer_reference_block(self, false);
                }
            });
        }

        // Output UBOs and SSBOs
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);

            const is_block_storage = type.storage === StorageClass.StorageClassStorageBuffer ||
                type.storage === StorageClass.StorageClassUniform ||
                type.storage === StorageClass.StorageClassShaderRecordBufferKHR;
            const has_block_flags = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags.get(Decoration.DecorationBlock) ||
                maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags.get(Decoration.DecorationBufferBlock);

            if (var_.storage !== StorageClass.StorageClassFunction && type.pointer && is_block_storage &&
                !this.is_hidden_variable(var_) && has_block_flags) {
                this.emit_buffer_block(var_);
            }
        });

        // Output push constant blocks
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_: SPIRVariable) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            if (var_.storage !== StorageClass.StorageClassFunction && type.pointer &&
                type.storage === StorageClass.StorageClassPushConstant && !this.is_hidden_variable(var_)) {
                this.emit_push_constant_block(var_);
            }
        });

        const skip_separate_image_sampler = true; /*this.combined_image_samplers.length !== 0 ||
         !options.vulkan_semantics;*/

        // Output Uniform Constants (values, samplers, images, etc).
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);

            // If we're remapping separate samplers and images, only emit the combined samplers.
            if (skip_separate_image_sampler) {
                // Sampler buffers are always used without a sampler, and they will also work in regular GL.
                const sampler_buffer = type.basetype === SPIRTypeBaseType.Image && type.image.dim === Dim.DimBuffer;
                const separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1;
                const separate_sampler = type.basetype === SPIRTypeBaseType.Sampler;
                if (!sampler_buffer && (separate_image || separate_sampler))
                    return;
            }

            if (var_.storage !== StorageClass.StorageClassFunction && type.pointer &&
                (type.storage === StorageClass.StorageClassUniformConstant || type.storage === StorageClass.StorageClassAtomicCounter ||
                    type.storage === StorageClass.StorageClassRayPayloadKHR || type.storage === StorageClass.StorageClassIncomingRayPayloadKHR ||
                    type.storage === StorageClass.StorageClassCallableDataKHR || type.storage === StorageClass.StorageClassIncomingCallableDataKHR ||
                    type.storage === StorageClass.StorageClassHitAttributeKHR) && !this.is_hidden_variable(var_)) {
                this.emit_uniform(var_);
                emitted = true;
            }
        });

        if (emitted)
            this.statement("");
        emitted = false;

        let emitted_base_instance = false;

        // Output in/out interfaces.
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);

            let is_hidden = this.is_hidden_variable(var_);

            // Unused output I/O variables might still be required to implement framebuffer fetch.
            if (var_.storage === StorageClass.StorageClassOutput && !this.is_legacy() &&
                this.location_is_framebuffer_fetch(this.get_decoration(var_.self, Decoration.DecorationLocation))/* !== 0*/) {
                is_hidden = false;
            }

            if (var_.storage !== StorageClass.StorageClassFunction && type.pointer &&
                (var_.storage === StorageClass.StorageClassInput || var_.storage === StorageClass.StorageClassOutput) &&
                this.interface_variable_exists_in_entry_point(var_.self) && !is_hidden) {
                if (options.es && this.get_execution_model() === ExecutionModel.ExecutionModelVertex &&
                    var_.storage === StorageClass.StorageClassInput && type.array.length === 1) {
                    throw new Error("OpenGL ES doesn't support array input variables in vertex shader.");
                }
                this.emit_interface_block(var_);
                emitted = true;
            }
            else if (this.is_builtin_variable(var_)) {
                const builtin = <BuiltIn>(this.get_decoration(var_.self, Decoration.DecorationBuiltIn));
                // For gl_InstanceIndex emulation on GLES, the API user needs to
                // supply this uniform.

                // The draw parameter extension is soft-enabled on GL with some fallbacks.
                // if (!options.vulkan_semantics)
                // {
                if (!emitted_base_instance &&
                    ((options.vertex.support_nonzero_base_instance && builtin === BuiltIn.BuiltInInstanceIndex) ||
                        (builtin === BuiltIn.BuiltInBaseInstance))) {
                    this.statement("#ifdef GL_ARB_shader_draw_parameters");
                    this.statement("#define SPIRV_Cross_BaseInstance gl_BaseInstanceARB");
                    this.statement("#else");
                    // A crude, but simple workaround which should be good enough for non-indirect draws.
                    this.statement("uniform int SPIRV_Cross_BaseInstance;");
                    this.statement("#endif");
                    emitted = true;
                    emitted_base_instance = true;
                }
                else if (builtin === BuiltIn.BuiltInBaseVertex) {
                    this.statement("#ifdef GL_ARB_shader_draw_parameters");
                    this.statement("#define SPIRV_Cross_BaseVertex gl_BaseVertexARB");
                    this.statement("#else");
                    // A crude, but simple workaround which should be good enough for non-indirect draws.
                    this.statement("uniform int SPIRV_Cross_BaseVertex;");
                    this.statement("#endif");
                }
                else if (builtin === BuiltIn.BuiltInDrawIndex) {
                    this.statement("#ifndef GL_ARB_shader_draw_parameters");
                    // Cannot really be worked around.
                    this.statement("#error GL_ARB_shader_draw_parameters is not supported.");
                    this.statement("#endif");
                }
                // }
            }
        });

        // Global variables.
        for (const global of this.global_variables) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, global);
            if (this.is_hidden_variable(var_, true))
                continue;

            if (var_.storage !== StorageClass.StorageClassOutput) {
                if (!this.variable_is_lut(var_)) {
                    this.add_resource_name(var_.self);

                    let initializer = "";
                    if (options.force_zero_initialized_variables && var_.storage === StorageClass.StorageClassPrivate &&
                        !var_.initializer && !var_.static_expression && this.type_can_zero_initialize(this.get_variable_data_type(var_))) {
                        initializer = " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(var_));
                    }

                    this.statement(this.variable_decl(var_), initializer, ";");
                    emitted = true;
                }
            }
            else if (var_.initializer && this.maybe_get<SPIRConstant>(SPIRConstant, var_.initializer) !== null) {
                this.emit_output_variable_initializer(var_);
            }
        }

        if (emitted)
            this.statement("");

        this.declare_undefined_values();
    }

    protected emit_buffer_block_native(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);

        const { ir } = this;
        const flags = ir.get_buffer_block_flags(var_);
        const dec = maplike_get(Meta, ir.meta, type.self).decoration;
        const ssbo = var_.storage === StorageClass.StorageClassStorageBuffer || var_.storage === StorageClass.StorageClassShaderRecordBufferKHR ||
            dec.decoration_flags.get(Decoration.DecorationBufferBlock);
        const is_restrict = ssbo && flags.get(Decoration.DecorationRestrict);
        const is_writeonly = ssbo && flags.get(Decoration.DecorationNonReadable);
        const is_readonly = ssbo && flags.get(Decoration.DecorationNonWritable);
        const is_coherent = ssbo && flags.get(Decoration.DecorationCoherent);

        // Block names should never alias, but from HLSL input they kind of can because block types are reused for UAVs ...
        let buffer_name = this.to_name(type.self, false);

        const block_namespace = ssbo ? this.block_ssbo_names : this.block_ubo_names;

        // Shaders never use the block by interface name, so we don't
        // have to track this other than updating name caches.
        // If we have a collision for any reason, just fallback immediately.
        if (dec.alias === "" || block_namespace.has(buffer_name) || this.resource_names.has(buffer_name)) {
            buffer_name = this.get_block_fallback_name(var_.self);
        }

        // Make sure we get something unique for both global name scope and block name scope.
        // See GLSL 4.5 spec: section 4.3.9 for details.
        buffer_name = this.add_variable(block_namespace, this.resource_names, buffer_name);

        // If for some reason buffer_name is an illegal name, make a final fallback to a workaround name.
        // This cannot conflict with anything else, so we're safe now.
        // We cannot reuse this fallback name in neither global scope (blocked by block_names) nor block name scope.
        if (buffer_name === "")
            buffer_name = "_" + this.get<SPIRType>(SPIRType, var_.basetype).self + "_" + var_.self;

        this.block_names.add(buffer_name);
        block_namespace.add(buffer_name);

        // Save for post-reflection later.
        this.declared_block_names[var_.self] = buffer_name;

        this.statement(this.layout_for_variable(var_), is_coherent ? "coherent " : "", is_restrict ? "restrict " : "",
            is_writeonly ? "writeonly " : "", is_readonly ? "readonly " : "", ssbo ? "buffer " : "uniform ",
            buffer_name);

        this.begin_scope();

        type.member_name_cache.clear();

        let i = 0;
        for (let member of type.member_types) {
            this.add_member_name(type, i);
            this.emit_struct_member(type, member, i);
            i++;
        }

        // var_.self can be used as a backup name for the block name,
        // so we need to make sure we don't disturb the name here on a recompile.
        // It will need to be reset if we have to recompile.
        this.preserve_alias_on_reset(var_.self);
        this.add_resource_name(var_.self);
        this.end_scope_decl(this.to_name(var_.self) + this.type_to_array_glsl(type));
        this.statement("");
    }

    protected emit_buffer_reference_block(type_id: number, forward_declaration: boolean)
    {
        const type = this.get<SPIRType>(SPIRType, type_id);
        let buffer_name = "";

        const { ir } = this;
        if (forward_declaration) {
            // Block names should never alias, but from HLSL input they kind of can because block types are reused for UAVs ...
            // Allow aliased name since we might be declaring the block twice. Once with buffer reference (forward declared) and one proper declaration.
            // The names must match up.
            buffer_name = this.to_name(type.self, false);

            // Shaders never use the block by interface name, so we don't
            // have to track this other than updating name caches.
            // If we have a collision for any reason, just fallback immediately.
            if (maplike_get(Meta, ir.meta, type.self).decoration.alias.length === 0 ||
                this.block_ssbo_names.has(buffer_name) ||
                this.resource_names.has(buffer_name)) {
                buffer_name = "_" + type.self;
            }

            // Make sure we get something unique for both global name scope and block name scope.
            // See GLSL 4.5 spec: section 4.3.9 for details.
            buffer_name = this.add_variable(this.block_ssbo_names, this.resource_names, buffer_name);

            // If for some reason buffer_name is an illegal name, make a final fallback to a workaround name.
            // This cannot conflict with anything else, so we're safe now.
            // We cannot reuse this fallback name in neither global scope (blocked by block_names) nor block name scope.
            if (buffer_name.length === 0)
                buffer_name = "_" + type.self;

            this.block_names.add(buffer_name);
            this.block_ssbo_names.add(buffer_name);

            // Ensure we emit the correct name when emitting non-forward pointer type.
            ir.meta[type.self].decoration.alias = buffer_name;
        }
        else if (type.basetype !== SPIRTypeBaseType.Struct)
            buffer_name = this.type_to_glsl(type);
        else
            buffer_name = this.to_name(type.self, false);

        if (!forward_declaration) {
            const itr_second = this.physical_storage_type_to_alignment[type_id];
            let alignment = 0;
            if (itr_second)
                alignment = itr_second.alignment;

            if (type.basetype === SPIRTypeBaseType.Struct) {
                const attributes: string[] = [ "buffer_reference" ];
                if (alignment)
                    attributes.push("buffer_reference_align = " + alignment);
                attributes.push(this.buffer_to_packing_standard(type, true));

                const flags = ir.get_buffer_block_type_flags(type);
                let decorations = "";
                if (flags.get(Decoration.DecorationRestrict))
                    decorations += " restrict";
                if (flags.get(Decoration.DecorationCoherent))
                    decorations += " coherent";
                if (flags.get(Decoration.DecorationNonReadable))
                    decorations += " writeonly";
                if (flags.get(Decoration.DecorationNonWritable))
                    decorations += " readonly";

                this.statement("layout(", attributes.join(", "), ")", decorations, " buffer ", buffer_name);
            }
            else if (alignment)
                this.statement("layout(buffer_reference, buffer_reference_align = ", alignment, ") buffer ", buffer_name);
            else
                this.statement("layout(buffer_reference) buffer ", buffer_name);

            this.begin_scope();

            if (type.basetype === SPIRTypeBaseType.Struct) {
                type.member_name_cache.clear();

                let i = 0;
                for (let member of type.member_types) {
                    this.add_member_name(type, i);
                    this.emit_struct_member(type, member, i);
                    i++;
                }
            }
            else {
                const pointee_type = this.get_pointee_type(type);
                this.statement(this.type_to_glsl(pointee_type), " value", this.type_to_array_glsl(pointee_type), ";");
            }

            this.end_scope_decl();
            this.statement("");
        }
        else {
            this.statement("layout(buffer_reference) buffer ", buffer_name, ";");
        }
    }

    protected emit_declared_builtin_block(storage: StorageClass, model: ExecutionModel)
    {
        let emitted_builtins = new Bitset();
        let global_builtins = new Bitset();
        let block_var: SPIRVariable = null;
        let emitted_block = false;
        let builtin_array = false;

        // Need to use declared size in the type.
        // These variables might have been declared, but not statically used, so we haven't deduced their size yet.
        let cull_distance_size = 0;
        let clip_distance_size = 0;

        let have_xfb_buffer_stride = false;
        let have_geom_stream = false;
        let have_any_xfb_offset = false;
        let xfb_stride = 0, xfb_buffer = 0, geom_stream = 0;
        const builtin_xfb_offsets: number[] = []; //std::unordered_map<uint32_t, uint32_t> ;

        const { ir, options } = this;

        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            const block = this.has_decoration(type.self, Decoration.DecorationBlock);
            const builtins = new Bitset();

            if (var_.storage === storage && block && this.is_builtin_variable(var_)) {
                let index = 0;
                for (let m of maplike_get(Meta, ir.meta, type.self).members) {
                    if (m.builtin) {
                        builtins.set(m.builtin_type);
                        if (m.builtin_type === BuiltIn.BuiltInCullDistance)
                            cull_distance_size = this.to_array_size_literal(this.get<SPIRType>(SPIRType, type.member_types[index]));
                        else if (m.builtin_type === BuiltIn.BuiltInClipDistance)
                            clip_distance_size = this.to_array_size_literal(this.get<SPIRType>(SPIRType, type.member_types[index]));

                        if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.DecorationOffset)) {
                            have_any_xfb_offset = true;
                            builtin_xfb_offsets[m.builtin_type] = m.offset;
                        }

                        if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.DecorationStream)) {
                            const stream = m.stream;
                            if (have_geom_stream && geom_stream !== stream)
                                throw new Error("IO block member Stream mismatch.");
                            have_geom_stream = true;
                            geom_stream = stream;
                        }
                    }
                    index++;
                }

                if (storage === StorageClass.StorageClassOutput && this.has_decoration(var_.self, Decoration.DecorationXfbBuffer) &&
                    this.has_decoration(var_.self, Decoration.DecorationXfbStride)) {
                    const buffer_index = this.get_decoration(var_.self, Decoration.DecorationXfbBuffer);
                    const stride = this.get_decoration(var_.self, Decoration.DecorationXfbStride);
                    if (have_xfb_buffer_stride && buffer_index !== xfb_buffer)
                        throw new Error("IO block member XfbBuffer mismatch.");
                    if (have_xfb_buffer_stride && stride !== xfb_stride)
                        throw new Error("IO block member XfbBuffer mismatch.");
                    have_xfb_buffer_stride = true;
                    xfb_buffer = buffer_index;
                    xfb_stride = stride;
                }

                if (storage === StorageClass.StorageClassOutput && this.has_decoration(var_.self, Decoration.DecorationStream)) {
                    const stream = this.get_decoration(var_.self, Decoration.DecorationStream);
                    if (have_geom_stream && geom_stream !== stream)
                        throw new Error("IO block member Stream mismatch.");
                    have_geom_stream = true;
                    geom_stream = stream;
                }
            }
            else if (var_.storage === storage && !block && this.is_builtin_variable(var_)) {
                // While we're at it, collect all declared global builtins (HLSL mostly ...).
                const m = maplike_get(Meta, ir.meta, var_.self).decoration;
                if (m.builtin) {
                    global_builtins.set(m.builtin_type);
                    if (m.builtin_type === BuiltIn.BuiltInCullDistance)
                        cull_distance_size = this.to_array_size_literal(type);
                    else if (m.builtin_type === BuiltIn.BuiltInClipDistance)
                        clip_distance_size = this.to_array_size_literal(type);

                    if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.DecorationXfbStride) &&
                        m.decoration_flags.get(Decoration.DecorationXfbBuffer) && m.decoration_flags.get(Decoration.DecorationOffset)) {
                        have_any_xfb_offset = true;
                        builtin_xfb_offsets[m.builtin_type] = m.offset;
                        const buffer_index = m.xfb_buffer;
                        const stride = m.xfb_stride;
                        if (have_xfb_buffer_stride && buffer_index !== xfb_buffer)
                            throw new Error("IO block member XfbBuffer mismatch.");
                        if (have_xfb_buffer_stride && stride !== xfb_stride)
                            throw new Error("IO block member XfbBuffer mismatch.");
                        have_xfb_buffer_stride = true;
                        xfb_buffer = buffer_index;
                        xfb_stride = stride;
                    }

                    if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.DecorationStream)) {
                        const stream = this.get_decoration(var_.self, Decoration.DecorationStream);
                        if (have_geom_stream && geom_stream !== stream)
                            throw new Error("IO block member Stream mismatch.");
                        have_geom_stream = true;
                        geom_stream = stream;
                    }
                }
            }

            if (builtins.empty())
                return;

            if (emitted_block)
                throw new Error("Cannot use more than one builtin I/O block.");

            emitted_builtins = builtins;
            emitted_block = true;
            builtin_array = type.array.length > 0;
            block_var = var_;
        });

        global_builtins = new Bitset(global_builtins.get_lower());
        global_builtins.set(BuiltIn.BuiltInPosition);
        global_builtins.set(BuiltIn.BuiltInPointSize);
        global_builtins.set(BuiltIn.BuiltInClipDistance);
        global_builtins.set(BuiltIn.BuiltInCullDistance);

        // Try to collect all other declared builtins.
        if (!emitted_block)
            emitted_builtins = global_builtins;

        // Can't declare an empty interface block.
        if (emitted_builtins.empty())
            return;

        if (storage === StorageClass.StorageClassOutput) {
            const attr: string[] = [];
            if (have_xfb_buffer_stride && have_any_xfb_offset) {
                if (!options.es) {
                    if (options.version < 440 && options.version >= 140)
                        this.require_extension_internal("GL_ARB_enhanced_layouts");
                    else if (options.version < 140)
                        throw new Error("Component decoration is not supported in targets below GLSL 1.40.");
                    if (!options.es && options.version < 440)
                        this.require_extension_internal("GL_ARB_enhanced_layouts");
                }
                else if (options.es)
                    throw new Error("Need GL_ARB_enhanced_layouts for xfb_stride or xfb_buffer.");
                attr.push(`xfb_buffer = ${xfb_buffer}, xfb_stride = ${xfb_stride}`);
            }

            if (have_geom_stream) {
                if (this.get_execution_model() !== ExecutionModel.ExecutionModelGeometry)
                    throw new Error("Geometry streams can only be used in geometry shaders.");
                if (options.es)
                    throw new Error("Multiple geometry streams not supported in ESSL.");
                if (options.version < 400)
                    this.require_extension_internal("GL_ARB_transform_feedback3");
                attr.push("stream = " + geom_stream);
            }

            if (attr.length > 0)
                this.statement("layout(", attr.join(", "), ") out gl_PerVertex");
            else
                this.statement("out gl_PerVertex");
        }
        else {
            // If we have passthrough, there is no way PerVertex cannot be passthrough.
            if (this.get_entry_point().geometry_passthrough)
                this.statement("layout(passthrough) in gl_PerVertex");
            else
                this.statement("in gl_PerVertex");
        }

        this.begin_scope();
        if (emitted_builtins.get(BuiltIn.BuiltInPosition)) {
            const itr_second = builtin_xfb_offsets[BuiltIn.BuiltInPosition];
            if (itr_second)
                this.statement("layout(xfb_offset = ", itr_second, ") vec4 gl_Position;");
            else
                this.statement("vec4 gl_Position;");
        }

        if (emitted_builtins.get(BuiltIn.BuiltInPointSize)) {
            const itr_second = builtin_xfb_offsets.find[BuiltIn.BuiltInPointSize];
            if (itr_second)
                this.statement("layout(xfb_offset = ", itr_second, ") float gl_PointSize;");
            else
                this.statement("float gl_PointSize;");
        }

        if (emitted_builtins.get(BuiltIn.BuiltInClipDistance)) {
            const itr_second = builtin_xfb_offsets[BuiltIn.BuiltInClipDistance];
            if (itr_second)
                this.statement("layout(xfb_offset = ", itr_second, ") float gl_ClipDistance[", clip_distance_size, "];");
            else
                this.statement("float gl_ClipDistance[", clip_distance_size, "];");
        }

        if (emitted_builtins.get(BuiltIn.BuiltInCullDistance)) {
            const itr_second = builtin_xfb_offsets[BuiltIn.BuiltInCullDistance];
            if (itr_second)
                this.statement("layout(xfb_offset = ", itr_second, ") float gl_CullDistance[", cull_distance_size, "];");
            else
                this.statement("float gl_CullDistance[", cull_distance_size, "];");
        }

        if (builtin_array) {
            /*if (model === ExecutionModelTessellationControl && storage === StorageClassOutput)
                this.end_scope_decl(join(to_name(block_var->self), "[", get_entry_point().output_vertices, "]"));
            else
                this.end_scope_decl(join(to_name(block_var->self), "[]"));*/
        }
        else
            this.end_scope_decl();

        this.statement("");
    }

    protected should_force_emit_builtin_block(storage: StorageClass)
    {
// If the builtin block uses XFB, we need to force explicit redeclaration of the builtin block.

        if (storage !== StorageClass.StorageClassOutput)
            return false;

        let should_force = false;

        const { ir } = this;
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            if (should_force)
                return;

            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            const block = this.has_decoration(type.self, Decoration.DecorationBlock);
            if (var_.storage === storage && block && this.is_builtin_variable(var_)) {
                const member_count = type.member_types.length;
                for (let i = 0; i < member_count; i++) {
                    if (this.has_member_decoration(type.self, i, Decoration.DecorationBuiltIn) &&
                        is_block_builtin(<BuiltIn>(this.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn))) &&
                        this.has_member_decoration(type.self, i, Decoration.DecorationOffset)) {
                        should_force = true;
                    }
                }
            }
            else if (var_.storage === storage && !block && this.is_builtin_variable(var_)) {
                if (is_block_builtin(<BuiltIn>(this.get_decoration(type.self, Decoration.DecorationBuiltIn))) &&
                    this.has_decoration(var_.self, Decoration.DecorationOffset)) {
                    should_force = true;
                }
            }
        });

        // If we're declaring clip/cull planes with control points we need to force block declaration.
        /*if (this.get_execution_model() === ExecutionModel.ExecutionModelTessellationControl &&
            (clip_distance_count || cull_distance_count))
        {
            should_force = true;
        }*/

        return should_force;
    }

    protected emit_push_constant_block_glsl(var_: SPIRVariable)
    {
        const { ir } = this;
        // OpenGL has no concept of push constant blocks, implement it as a uniform struct.
        const type = this.get<SPIRType>(SPIRType, var_.basetype);

        const flags = maplike_get(Meta, ir.meta, var_.self).decoration.decoration_flags;
        flags.clear(Decoration.DecorationBinding);
        flags.clear(Decoration.DecorationDescriptorSet);

        /*#if 0
        if (flags & ((1ull << DecorationBinding) | (1ull << DecorationDescriptorSet)))
        throw new Error("Push constant blocks cannot be compiled to GLSL with Binding or Set syntax. "
        "Remap to location with reflection API first or disable these decorations.");
        #endif
        */
        // We're emitting the push constant block as a regular struct, so disable the block qualifier temporarily.
        // Otherwise, we will end up emitting layout() qualifiers on naked structs which is not allowed.
        const block_flags = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags;
        const block_flag = block_flags.get(Decoration.DecorationBlock);
        block_flags.clear(Decoration.DecorationBlock);

        this.emit_struct(type);

        if (block_flag)
            block_flags.set(Decoration.DecorationBlock);

        this.emit_uniform(var_);
        this.statement("");
    }

    protected emit_interface_block(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const { ir, options } = this;
        if (var_.storage === StorageClass.StorageClassInput && type.basetype === SPIRTypeBaseType.Double &&
            !options.es && options.version < 410) {
            this.require_extension_internal("GL_ARB_vertex_attrib_64bit");
        }

        // Either make it plain in/out or in/out blocks depending on what shader is doing ...
        const block = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags.get(Decoration.DecorationBlock);
        const qual = this.to_storage_qualifiers_glsl(var_);

        if (block) {
            // ESSL earlier than 310 and GLSL earlier than 150 did not support
            // I/O variables which are struct types.
            // To support this, flatten the struct into separate varyings instead.
            if (options.force_flattened_io_blocks || (options.es && options.version < 310) ||
                (!options.es && options.version < 150)) {
                // I/O blocks on ES require version 310 with Android Extension Pack extensions, or core version 320.
                // On desktop, I/O blocks were introduced with geometry shaders in GL 3.2 (GLSL 150).
                this.emit_flattened_io_block(var_, qual);
            }
            else {
                if (options.es && options.version < 320) {
                    // Geometry and tessellation extensions imply this extension.
                    if (!this.has_extension("GL_EXT_geometry_shader") && !this.has_extension("GL_EXT_tessellation_shader"))
                        this.require_extension_internal("GL_EXT_shader_io_blocks");
                }

                // Workaround to make sure we can emit "patch in/out" correctly.
                this.fixup_io_block_patch_qualifiers(var_);

                // Block names should never alias.
                let block_name = this.to_name(type.self, false);

                // The namespace for I/O blocks is separate from other variables in GLSL.
                const block_namespace = type.storage === StorageClass.StorageClassInput ? this.block_input_names : this.block_output_names;

                // Shaders never use the block by interface name, so we don't
                // have to track this other than updating name caches.
                if (block_name.length === 0 || block_namespace.has(block_name))
                    block_name = this.get_fallback_name(type.self);
                else
                    block_namespace.add(block_name);

                // If for some reason buffer_name is an illegal name, make a final fallback to a workaround name.
                // This cannot conflict with anything else, so we're safe now.
                if (block_name.length === 0)
                    block_name = "_" + this.get<SPIRType>(SPIRType, var_.basetype).self + "_" + var_.self;

                // Instance names cannot alias block names.
                this.resource_names.add(block_name);

                const is_patch = this.has_decoration(var_.self, Decoration.DecorationPatch);
                this.statement(this.layout_for_variable(var_), (is_patch ? "patch " : ""), qual, block_name);
                this.begin_scope();

                type.member_name_cache.clear();

                let i = 0;
                for (let member of type.member_types) {
                    this.add_member_name(type, i);
                    this.emit_struct_member(type, member, i);
                    i++;
                }

                this.add_resource_name(var_.self);
                this.end_scope_decl(this.to_name(var_.self) + this.type_to_array_glsl(type));
                this.statement("");
            }
        }
        else {
            // ESSL earlier than 310 and GLSL earlier than 150 did not support
            // I/O variables which are struct types.
            // To support this, flatten the struct into separate varyings instead.
            if (type.basetype === SPIRTypeBaseType.Struct &&
                (options.force_flattened_io_blocks || (options.es && options.version < 310) ||
                    (!options.es && options.version < 150))) {
                this.emit_flattened_io_block(var_, qual);
            }
            else {
                this.add_resource_name(var_.self);

                // Tessellation control and evaluation shaders must have either gl_MaxPatchVertices or unsized arrays for input arrays.
                // Opt for unsized as it's the more "correct" variant to use.
                /*const control_point_input_array = type.storage === StorageClass.StorageClassInput && type.array.length > 0 &&
                    !this.has_decoration(var_.self, Decoration.DecorationPatch) &&
                    (this.get_entry_point().model === ExecutionModel.ExecutionModelTessellationControl ||
                    this.get_entry_point().model === ExecutionModel.ExecutionModelTessellationEvaluation);*/

                /*let old_array_size = 0;
                let old_array_size_literal = true;

                if (control_point_input_array)
                {
                    swap(type.array.back(), old_array_size);
                    swap(type.array_size_literal.back(), old_array_size_literal);
                }*/

                this.statement(this.layout_for_variable(var_), this.to_qualifiers_glsl(var_.self),
                    this.variable_decl(type, this.to_name(var_.self), var_.self), ";");

                /*if (control_point_input_array)
                {
                    swap(type.array.back(), old_array_size);
                    swap(type.array_size_literal.back(), old_array_size_literal);
                }*/
            }
        }
    }

    protected constant_value_macro_name(id: number): string
    {
        return "SPIRV_CROSS_CONSTANT_ID_" + id;
    }

    protected get_constant_mapping_to_workgroup_component(c: SPIRConstant)
    {
        const entry_point = this.get_entry_point();
        let index = -1;

        // Need to redirect specialization constants which are used as WorkGroupSize to the builtin,
        // since the spec constant declarations are never explicitly declared.
        if (entry_point.workgroup_size.constant === 0 && entry_point.flags.get(ExecutionMode.ExecutionModeLocalSizeId)) {
            if (c.self === entry_point.workgroup_size.id_x)
                index = 0;
            else if (c.self === entry_point.workgroup_size.id_y)
                index = 1;
            else if (c.self === entry_point.workgroup_size.id_z)
                index = 2;
        }

        return index;
    }

    emit_constant(constant: SPIRConstant)
    {
        const type = this.get<SPIRType>(SPIRType, constant.constant_type);
        const name = this.to_name(constant.self);

        // only relevant to Compute Shaders
        /*const wg_x = new SpecializationConstant(),
            wg_y = new SpecializationConstant(),
            wg_z = new SpecializationConstant();

        /*const workgroup_size_id = this.get_work_group_size_specialization_constants(wg_x, wg_y, wg_z);

        // This specialization constant is implicitly declared by emitting layout() in;
        if (constant.self === workgroup_size_id)
            return;

        // These specialization constants are implicitly declared by emitting layout() in;
        // In legacy GLSL, we will still need to emit macros for these, so a layout() in; declaration
        // later can use macro overrides for work group size.
        bool is_workgroup_size_constant = ConstantID(constant.self) === wg_x.id || ConstantID(constant.self) === wg_y.id ||
        ConstantID(constant.self) === wg_z.id;

        if (options.vulkan_semantics && is_workgroup_size_constant)
        {
            // Vulkan GLSL does not need to declare workgroup spec constants explicitly, it is handled in layout().
            return;
        }
        else if (!options.vulkan_semantics && is_workgroup_size_constant &&
            !has_decoration(constant.self, DecorationSpecId))
        {
            // Only bother declaring a workgroup size if it is actually a specialization constant, because we need macros.
            return;
        }*/

        // Only scalars have constant IDs.
        if (this.has_decoration(constant.self, Decoration.DecorationSpecId)) {
            /*if (options.vulkan_semantics)
            {
                statement("layout(constant_id = ", get_decoration(constant.self, DecorationSpecId), ") const ",
                    variable_decl(type, name), " = ", constant_expression(constant), ";");
            }
            else
            {*/
            const macro_name = constant.specialization_constant_macro_name;
            this.statement("#ifndef ", macro_name);
            this.statement("#define ", macro_name, " ", this.constant_expression(constant));
            this.statement("#endif");

            // For workgroup size constants, only emit the macros.
            // if (!is_workgroup_size_constant)
            this.statement("const ", this.variable_decl(type, name), " = ", macro_name, ";");
            // }
        }
        else {
            this.statement("const ", this.variable_decl(type, name), " = ", this.constant_expression(constant), ";");
        }
    }

    protected emit_specialization_constant_op(constant: SPIRConstantOp)
    {
        const type = this.get<SPIRType>(SPIRType, constant.basetype);
        const name = this.to_name(constant.self);
        this.statement("const ", this.variable_decl(type, name), " = ", this.constant_op_expression(constant), ";");
    }

    protected should_dereference(id: number): boolean
    {
        const type = this.expression_type(id);
        // Non-pointer expressions don't need to be dereferenced.
        if (!type.pointer)
            return false;

        // Handles shouldn't be dereferenced either.
        if (!this.expression_is_lvalue(id))
            return false;

        // If id is a variable but not a phi variable, we should not dereference it.
        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, id);
        if (var_)
            return var_.phi_variable;

        // If id is an access chain, we should not dereference it.
        const expr = this.maybe_get<SPIRExpression>(SPIRExpression, id);
        if (expr)
            return !expr.access_chain;

        // Otherwise, we should dereference this pointer expression.
        return true;
    }

    protected to_trivial_mix_op(type: SPIRType, left: number, right: number, lerp: number): string
    {
        const { backend } = this;
        const cleft = this.maybe_get<SPIRConstant>(SPIRConstant, left);
        const cright = this.maybe_get<SPIRConstant>(SPIRConstant, right);
        const lerptype = this.expression_type(lerp);

        // If our targets aren't constants, we cannot use construction.
        if (!cleft || !cright)
            return undefined;

        // If our targets are spec constants, we cannot use construction.
        if (cleft.specialization || cright.specialization)
            return undefined;

        const value_type = this.get<SPIRType>(SPIRType, cleft.constant_type);

        if (lerptype.basetype !== SPIRTypeBaseType.Boolean)
            return undefined;
        if (value_type.basetype === SPIRTypeBaseType.Struct || this.is_array(value_type))
            return undefined;
        if (!backend.use_constructor_splatting && value_type.vecsize !== lerptype.vecsize)
            return undefined;

        // Only valid way in SPIR-V 1.4 to use matrices in select is a scalar select.
        // matrix(scalar) constructor fills in diagnonals, so gets messy very quickly.
        // Just avoid this case.
        if (value_type.columns > 1)
            return undefined;

        // If our bool selects between 0 and 1, we can cast from bool instead, making our trivial constructor.
        let ret = true;
        for (let row = 0; ret && row < value_type.vecsize; row++) {
            switch (type.basetype) {
                case SPIRTypeBaseType.Short:
                case SPIRTypeBaseType.UShort:
                    ret = cleft.scalar_u16(0, row) === 0 && cright.scalar_u16(0, row) === 1;
                    break;

                case SPIRTypeBaseType.Int:
                case SPIRTypeBaseType.UInt:
                    ret = cleft.scalar(0, row) === 0 && cright.scalar(0, row) === 1;
                    break;

                case SPIRTypeBaseType.Half:
                    ret = cleft.scalar_f16(0, row) === 0.0 && cright.scalar_f16(0, row) === 1.0;
                    break;

                case SPIRTypeBaseType.Float:
                    ret = cleft.scalar_f32(0, row) === 0.0 && cright.scalar_f32(0, row) === 1.0;
                    break;

                case SPIRTypeBaseType.Double:
                    ret = cleft.scalar_f64(0, row) === 0.0 && cright.scalar_f64(0, row) === 1.0;
                    break;

                case SPIRTypeBaseType.Int64:
                case SPIRTypeBaseType.UInt64:
                    ret = cleft.scalar_u64(0, row) === BigInt(0) && cright.scalar_u64(0, row) === BigInt(1);
                    break;

                default:
                    ret = false;
                    break;
            }
        }

        if (ret)
            return this.type_to_glsl_constructor(type);

        return undefined;
    }

    protected binary_op_bitcast_helper(props: { cast_op0: string, cast_op1: string, input_type: SPIRTypeBaseType }, op0: number, op1: number, skip_cast_if_equal_type: boolean): SPIRType
    {
        const type0 = this.expression_type(op0);
        const type1 = this.expression_type(op1);

        // We have to bitcast if our inputs are of different type, or if our types are not equal to expected inputs.
        // For some functions like OpIEqual and INotEqual, we don't care if inputs are of different types than expected
        // since equality test is exactly the same.
        const cast = (type0.basetype !== type1.basetype) || (!skip_cast_if_equal_type && type0.basetype !== props.input_type);

        // Create a fake type so we can bitcast to it.
        // We only deal with regular arithmetic types here like int, uints and so on.
        const expected_type: SPIRType = new SPIRType();
        expected_type.basetype = props.input_type;
        expected_type.vecsize = type0.vecsize;
        expected_type.columns = type0.columns;
        expected_type.width = type0.width;

        if (cast) {
            props.cast_op0 = this.bitcast_glsl(expected_type, op0);
            props.cast_op1 = this.bitcast_glsl(expected_type, op1);
        }
        else {
            // If we don't cast, our actual input type is that of the first (or second) argument.
            props.cast_op0 = this.to_enclosed_unpacked_expression(op0);
            props.cast_op1 = this.to_enclosed_unpacked_expression(op1);
            props.input_type = type0.basetype;
        }

        return expected_type;
    }

    protected to_ternary_expression(restype: SPIRType, select: number, true_value: number, false_value: number): string
    {
        let expr;
        const lerptype = this.expression_type(select);

        if (lerptype.vecsize === 1)
            expr = this.to_enclosed_expression(select) + " ? " + this.to_enclosed_pointer_expression(true_value) + " : " + this.to_enclosed_pointer_expression(false_value);
        else {
            const swiz = (expression: number, i: number) =>
            {
                return this.to_extract_component_expression(expression, i);
            };

            expr = this.type_to_glsl_constructor(restype);
            expr += "(";
            for (let i = 0; i < restype.vecsize; i++) {
                expr += swiz(select, i);
                expr += " ? ";
                expr += swiz(true_value, i);
                expr += " : ";
                expr += swiz(false_value, i);
                if (i + 1 < restype.vecsize)
                    expr += ", ";
            }
            expr += ")";
        }

        return expr;
    }

    protected expression_is_forwarded(id: number): boolean
    {
        return this.forwarded_temporaries.has(id);
    }

    protected expression_suppresses_usage_tracking(id: number): boolean
    {
        return this.suppressed_usage_tracking.has(id);
    }

    protected expression_read_implies_multiple_reads(id: number): boolean
    {
        const expr = this.maybe_get<SPIRExpression>(SPIRExpression, id);
        if (!expr)
            return false;

        // If we're emitting code at a deeper loop level than when we emitted the expression,
        // we're probably reading the same expression over and over.
        return this.current_loop_level > expr.emitted_loop_level;
    }

    protected access_chain_internal_append_index(expr: string, base: number, type: SPIRType, flags: AccessChainFlags, access_chain_is_arrayed: boolean, index: number): string
    {
        const index_is_literal = (flags & AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT) !== 0;
        const register_expression_read = (flags & AccessChainFlagBits.ACCESS_CHAIN_SKIP_REGISTER_EXPRESSION_READ_BIT) === 0;

        expr += "[";

        if (index_is_literal)
            expr += convert_to_string(index);
        else
            expr += this.to_unpacked_expression(index, register_expression_read);

        expr += "]";

        return expr;
    }

    protected access_chain_internal(base: number, indices: number[], count: number, flags: AccessChainFlags, meta: AccessChainMeta): string
    {
        let expr = "";

        const { backend, options, ir } = this;

        const index_is_literal = (flags & AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT) !== 0;
        const msb_is_id = (flags & AccessChainFlagBits.ACCESS_CHAIN_LITERAL_MSB_FORCE_ID) !== 0;
        const chain_only = (flags & AccessChainFlagBits.ACCESS_CHAIN_CHAIN_ONLY_BIT) !== 0;
        const ptr_chain = (flags & AccessChainFlagBits.ACCESS_CHAIN_PTR_CHAIN_BIT) !== 0;
        const register_expression_read = (flags & AccessChainFlagBits.ACCESS_CHAIN_SKIP_REGISTER_EXPRESSION_READ_BIT) === 0;
        const flatten_member_reference = (flags & AccessChainFlagBits.ACCESS_CHAIN_FLATTEN_ALL_MEMBERS_BIT) !== 0;

        if (!chain_only) {
            // We handle transpose explicitly, so don't resolve that here.
            const e = this.maybe_get<SPIRExpression>(SPIRExpression, base);
            const old_transpose = e && e.need_transpose;
            if (e)
                e.need_transpose = false;
            expr = this.to_enclosed_expression(base, register_expression_read);
            if (e)
                e.need_transpose = old_transpose;
        }

        // Start traversing type hierarchy at the proper non-pointer types,
        // but keep type_id referencing the original pointer for use below.
        let type_id = this.expression_type_id(base);

        if (!backend.native_pointers) {
            if (ptr_chain)
                throw new Error("Backend does not support native pointers and does not support OpPtrAccessChain.");

            // Wrapped buffer reference pointer types will need to poke into the internal "value" member before
            // continuing the access chain.
            if (this.should_dereference(base)) {
                const type = this.get<SPIRType>(SPIRType, type_id);
                expr = this.dereference_expression(type, expr);
            }
        }

        let type = this.get_pointee_type(type_id);

        let access_chain_is_arrayed = expr.indexOf("[") >= 0;
        let row_major_matrix_needs_conversion = this.is_non_native_row_major_matrix(base);
        let is_packed = this.has_extended_decoration(base, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked);
        let physical_type = this.get_extended_decoration(base, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
        let is_invariant = this.has_decoration(base, Decoration.DecorationInvariant);
        let pending_array_enclose = false;
        let dimension_flatten = false;

        const append_index = (index: number, is_literal: boolean) =>
        {
            let mod_flags: AccessChainFlags = flags;
            if (!is_literal)
                mod_flags &= ~AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT;
            expr = this.access_chain_internal_append_index(expr, base, type, mod_flags, access_chain_is_arrayed, index);
        };

        for (let i = 0; i < count; i++) {
            let index = indices[i];

            let is_literal = index_is_literal;
            if (is_literal && msb_is_id && (index >> 31) !== 0) {
                is_literal = false;
                index &= 0x7fffffff;
            }

            // Pointer chains
            if (ptr_chain && i === 0) {
                // If we are flattening multidimensional arrays, only create opening bracket on first
                // array index.
                if (options.flatten_multidimensional_arrays) {
                    dimension_flatten = type.array.length >= 1;
                    pending_array_enclose = dimension_flatten;
                    if (pending_array_enclose)
                        expr += "[";
                }

                if (options.flatten_multidimensional_arrays && dimension_flatten) {
                    // If we are flattening multidimensional arrays, do manual stride computation.
                    if (is_literal)
                        expr += convert_to_string(index);
                    else
                        expr += this.to_enclosed_expression(index, register_expression_read);

                    for (let j = type.array.length; j; j--) {
                        expr += " * ";
                        expr += this.enclose_expression(this.to_array_size(type, j - 1));
                    }

                    if (type.array.length === 0)
                        pending_array_enclose = false;
                    else
                        expr += " + ";

                    if (!pending_array_enclose)
                        expr += "]";
                }
                else {
                    append_index(index, is_literal);
                }

                if (type.basetype === SPIRTypeBaseType.ControlPointArray) {
                    type_id = type.parent_type;
                    type = this.get<SPIRType>(SPIRType, type_id);
                }

                access_chain_is_arrayed = true;
            }
            // Arrays
            else if (type.array.length > 0) {
                // If we are flattening multidimensional arrays, only create opening bracket on first
                // array index.
                if (options.flatten_multidimensional_arrays && !pending_array_enclose) {
                    dimension_flatten = type.array.length > 1;
                    pending_array_enclose = dimension_flatten;
                    if (pending_array_enclose)
                        expr += "[";
                }

                console.assert(type.parent_type);

                const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, base);
                if (backend.force_gl_in_out_block && i === 0 && var_ && this.is_builtin_variable(var_) &&
                    !this.has_decoration(type.self, Decoration.DecorationBlock)) {
                    // This deals with scenarios for tesc/geom where arrays of gl_Position[] are declared.
                    // Normally, these variables live in blocks when compiled from GLSL,
                    // but HLSL seems to just emit straight arrays here.
                    // We must pretend this access goes through gl_in/gl_out arrays
                    // to be able to access certain builtins as arrays.
                    const builtin = maplike_get(Meta, ir.meta, base).decoration.builtin_type;
                    switch (builtin) {
                        // case BuiltInCullDistance: // These are already arrays, need to figure out rules for these in tess/geom.
                        // case BuiltInClipDistance:
                        case BuiltIn.BuiltInPosition:
                        case BuiltIn.BuiltInPointSize:
                            if (var_.storage === StorageClass.StorageClassInput)
                                expr = "gl_in[" + this.to_expression(index, register_expression_read), "]." + expr;
                            else if (var_.storage === StorageClass.StorageClassOutput)
                                expr = "gl_out[" + this.to_expression(index, register_expression_read), "]." + expr;
                            else
                                append_index(index, is_literal);
                            break;

                        default:
                            append_index(index, is_literal);
                            break;
                    }
                }
                else if (options.flatten_multidimensional_arrays && dimension_flatten) {
                    // If we are flattening multidimensional arrays, do manual stride computation.
                    const parent_type = this.get<SPIRType>(SPIRType, type.parent_type);

                    if (is_literal)
                        expr += convert_to_string(index);
                    else
                        expr += this.to_enclosed_expression(index, register_expression_read);

                    for (let j = parent_type.array.length; j; j--) {
                        expr += " * ";
                        expr += this.enclose_expression(this.to_array_size(parent_type, j - 1));
                    }

                    if (parent_type.array.length === 0)
                        pending_array_enclose = false;
                    else
                        expr += " + ";

                    if (!pending_array_enclose)
                        expr += "]";
                }
                    // Some builtins are arrays in SPIR-V but not in other languages, e.g. gl_SampleMask[] is an array in SPIR-V but not in Metal.
                // By throwing away the index, we imply the index was 0, which it must be for gl_SampleMask.
                else if (!this.builtin_translates_to_nonarray(<BuiltIn>(this.get_decoration(base, Decoration.DecorationBuiltIn)))) {
                    append_index(index, is_literal);
                }

                type_id = type.parent_type;
                type = this.get<SPIRType>(SPIRType, type_id);

                access_chain_is_arrayed = true;
            }
                // For structs, the index refers to a constant, which indexes into the members, possibly through a redirection mapping.
            // We also check if this member is a builtin, since we then replace the entire expression with the builtin one.
            else if (type.basetype === SPIRTypeBaseType.Struct) {
                if (!is_literal)
                    index = this.evaluate_constant_u32(index);

                if (index < type.member_type_index_redirection.length)
                    index = type.member_type_index_redirection[index];

                if (index >= type.member_types.length)
                    throw new Error("Member index is out of bounds!");

                let builtin: BuiltIn = this.is_member_builtin(type, index);
                if (builtin !== undefined && this.access_chain_needs_stage_io_builtin_translation(base)) {
                    if (access_chain_is_arrayed) {
                        expr += ".";
                        expr += this.builtin_to_glsl(builtin, type.storage);
                    }
                    else
                        expr = this.builtin_to_glsl(builtin, type.storage);
                }
                else {
                    // If the member has a qualified name, use it as the entire chain
                    const qual_mbr_name = this.get_member_qualified_name(type_id, index);
                    if (qual_mbr_name !== "")
                        expr = qual_mbr_name;
                    else if (flatten_member_reference)
                        expr += "_" + this.to_member_name(type, index);
                    else
                        expr += this.to_member_reference(base, type, index, ptr_chain);
                }

                if (this.has_member_decoration(type.self, index, Decoration.DecorationInvariant))
                    is_invariant = true;

                is_packed = this.member_is_packed_physical_type(type, index);
                if (this.member_is_remapped_physical_type(type, index))
                    physical_type = this.get_extended_member_decoration(type.self, index, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
                else
                    physical_type = 0;

                row_major_matrix_needs_conversion = this.member_is_non_native_row_major_matrix(type, index);
                type = this.get<SPIRType>(SPIRType, type.member_types[index]);
            }
            // Matrix -> Vector
            else if (type.columns > 1) {
                // If we have a row-major matrix here, we need to defer any transpose in case this access chain
                // is used to store a column. We can resolve it right here and now if we access a scalar directly,
                // by flipping indexing order of the matrix.

                expr += "[";
                if (is_literal)
                    expr += convert_to_string(index);
                else
                    expr += this.to_unpacked_expression(index, register_expression_read);
                expr += "]";

                type_id = type.parent_type;
                type = this.get<SPIRType>(SPIRType, type_id);
            }
            // Vector -> Scalar
            else if (type.vecsize > 1) {
                let deferred_index = "";
                if (row_major_matrix_needs_conversion) {
                    // Flip indexing order.
                    const column_index = expr.lastIndexOf("[");
                    if (column_index >= 0) {
                        deferred_index = expr.substring(column_index);
                        expr = expr.substring(0, column_index);
                    }
                }

                // Internally, access chain implementation can also be used on composites,
                // ignore scalar access workarounds in this case.
                let effective_storage: StorageClass = StorageClass.StorageClassGeneric;
                let ignore_potential_sliced_writes = false;
                if ((flags & AccessChainFlagBits.ACCESS_CHAIN_FORCE_COMPOSITE_BIT) === 0) {
                    if (this.expression_type(base).pointer)
                        effective_storage = this.get_expression_effective_storage_class(base);

                    // Special consideration for control points.
                    // Control points can only be written by InvocationID, so there is no need
                    // to consider scalar access chains here.
                    // Cleans up some cases where it's very painful to determine the accurate storage class
                    // since blocks can be partially masked ...
                    /*const var_ = maybe_get_backing_variable(base);
                    if (var_ && var_.storage === StorageClass.StorageClassOutput &&
                        get_execution_model() === ExecutionModelTessellationControl &&
                        !has_decoration(var_.self, DecorationPatch))
                    {
                        ignore_potential_sliced_writes = true;
                    }*/
                }
                else
                    ignore_potential_sliced_writes = true;

                if (!row_major_matrix_needs_conversion && !ignore_potential_sliced_writes) {
                    // On some backends, we might not be able to safely access individual scalars in a vector.
                    // To work around this, we might have to cast the access chain reference to something which can,
                    // like a pointer to scalar, which we can then index into.
                    expr = this.prepare_access_chain_for_scalar_access(expr, this.get<SPIRType>(SPIRType, type.parent_type), effective_storage, is_packed);
                }

                if (is_literal) {
                    const out_of_bounds = (index >= type.vecsize);

                    if (!is_packed && !row_major_matrix_needs_conversion) {
                        expr += ".";
                        expr += this.index_to_swizzle(out_of_bounds ? 0 : index);
                    }
                    else {
                        // For packed vectors, we can only access them as an array, not by swizzle.
                        expr += "[" + (out_of_bounds ? 0 : index) + "]";
                    }
                }
                else if (ir.ids[index].get_type() === Types.TypeConstant && !is_packed && !row_major_matrix_needs_conversion) {
                    const c = this.get<SPIRConstant>(SPIRConstant, index);
                    const out_of_bounds = (c.scalar() >= type.vecsize);

                    if (c.specialization) {
                        // If the index is a spec constant, we cannot turn extract into a swizzle.
                        expr += "[" + (out_of_bounds ? "0" : this.to_expression(index)) + "]";
                    }
                    else {
                        expr += "." + this.index_to_swizzle(out_of_bounds ? 0 : c.scalar());
                    }
                }
                else {
                    expr += "[" + this.to_unpacked_expression(index, register_expression_read) + "]";
                }

                if (row_major_matrix_needs_conversion && !ignore_potential_sliced_writes) {
                    expr = this.prepare_access_chain_for_scalar_access(expr, this.get<SPIRType>(SPIRType, type.parent_type), effective_storage, is_packed);
                }

                expr += deferred_index;
                row_major_matrix_needs_conversion = false;

                is_packed = false;
                physical_type = 0;
                type_id = type.parent_type;
                type = this.get<SPIRType>(SPIRType, type_id);
            }
            else if (!backend.allow_truncated_access_chain)
                throw new Error("Cannot subdivide a scalar value!");
        }

        if (pending_array_enclose) {
            throw new Error("Flattening of multidimensional arrays were enabled, " +
                "but the access chain was terminated in the middle of a multidimensional array. " +
                "This is not supported.");
        }

        if (meta) {
            meta.need_transpose = row_major_matrix_needs_conversion;
            meta.storage_is_packed = is_packed;
            meta.storage_is_invariant = is_invariant;
            meta.storage_physical_type = physical_type;
        }

        return expr;
    }

    protected get_expression_effective_storage_class(ptr: number): StorageClass
    {
        const var_ = this.maybe_get_backing_variable(ptr);

        // If the expression has been lowered to a temporary, we need to use the Generic storage class.
        // We're looking for the effective storage class of a given expression.
        // An access chain or forwarded OpLoads from such access chains
        // will generally have the storage class of the underlying variable, but if the load was not forwarded
        // we have lost any address space qualifiers.
        const forced_temporary = this.ir.ids[ptr].get_type() === Types.TypeExpression && !this.get<SPIRExpression>(SPIRExpression, ptr).access_chain &&
            (this.forced_temporaries.has(ptr) || !this.forwarded_temporaries.has(ptr));

        if (var_ && !forced_temporary) {
            if (this.variable_decl_is_remapped_storage(var_, StorageClass.StorageClassWorkgroup))
                return StorageClass.StorageClassWorkgroup;
            if (this.variable_decl_is_remapped_storage(var_, StorageClass.StorageClassStorageBuffer))
                return StorageClass.StorageClassStorageBuffer;

            // Normalize SSBOs to StorageBuffer here.
            if (var_.storage === StorageClass.StorageClassUniform && this.has_decoration(this.get<SPIRType>(SPIRType, var_.basetype).self, Decoration.DecorationBufferBlock))
                return StorageClass.StorageClassStorageBuffer;
            else
                return var_.storage;
        }
        else
            return this.expression_type(ptr).storage;
    }

    protected access_chain_needs_stage_io_builtin_translation(_: number)
    {
        return true;
    }

    protected prepare_access_chain_for_scalar_access(expr: string, type: SPIRType, storage: StorageClass, is_packed: boolean): string
    {
        return expr;
    }

    protected index_to_swizzle(index: number): string
    {
        switch (index) {
            case 0:
                return "x";
            case 1:
                return "y";
            case 2:
                return "z";
            case 3:
                return "w";
            default:
                return "x";		// Don't crash, but engage the "undefined behavior" described for out-of-bounds logical addressing in spec.
        }
    }

    protected remap_swizzle(out_type: SPIRType, input_components: number, expr: string): string
    {
        if (out_type.vecsize === input_components)
            return expr;
        else if (input_components === 1 && !this.backend.can_swizzle_scalar)
            return this.type_to_glsl(out_type) + "(" + expr + ")";
        else {
            // FIXME: This will not work with packed expressions.
            let e = this.enclose_expression(expr) + ".";
            // Just clamp the swizzle index if we have more outputs than inputs.
            for (let c = 0; c < out_type.vecsize; c++)
                e += this.index_to_swizzle(Math.min(c, input_components - 1));
            if (this.backend.swizzle_is_function && out_type.vecsize > 1)
                e += "()";

            e = this.remove_duplicate_swizzle(e);
            return e;
        }
    }

    protected to_expression(id: number, register_expression_read: boolean = true): string
    {
        if (this.invalid_expressions.hasOwnProperty(id))
            this.handle_invalid_expression(id);

        const ir = this.ir;
        if (ir.ids[id].get_type() === Types.TypeExpression) {
            // We might have a more complex chain of dependencies.
            // A possible scenario is that we
            //
            // %1 = OpLoad
            // %2 = OpDoSomething %1 %1. here %2 will have a dependency on %1.
            // %3 = OpDoSomethingAgain %2 %2. Here %3 will lose the link to %1 since we don't propagate the dependencies like that.
            // OpStore %1 %foo // Here we can invalidate %1, and hence all expressions which depend on %1. Only %2 will know since it's part of invalid_expressions.
            // %4 = OpDoSomethingAnotherTime %3 %3 // If we forward all expressions we will see %1 expression after store, not before.
            //
            // However, we can propagate up a list of depended expressions when we used %2, so we can check if %2 is invalid when reading %3 after the store,
            // and see that we should not forward reads of the original variable.
            const expr = this.get<SPIRExpression>(SPIRExpression, id);
            for (let dep of expr.expression_dependencies)
                if (this.invalid_expressions.hasOwnProperty(dep))
                    this.handle_invalid_expression(dep);
        }

        if (register_expression_read)
            this.track_expression_read(id);

        switch (ir.ids[id].get_type()) {
            case Types.TypeExpression: {
                const e = this.get<SPIRExpression>(SPIRExpression, id);
                if (e.base_expression)
                    return this.to_enclosed_expression(e.base_expression) + e.expression;
                else if (e.need_transpose) {
                    // This should not be reached for access chains, since we always deal explicitly with transpose state
                    // when consuming an access chain expression.
                    const physical_type_id = this.get_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
                    const is_packed = this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked);
                    return this.convert_row_major_matrix(e.expression, this.get<SPIRType>(SPIRType, e.expression_type), physical_type_id, is_packed);
                }
                else if (this.flattened_structs.hasOwnProperty(id)) {
                    return this.load_flattened_struct(e.expression, this.get<SPIRType>(SPIRType, e.expression_type));
                }
                else {
                    if (this.is_forcing_recompilation()) {
                        // During first compilation phase, certain expression patterns can trigger exponential growth of memory.
                        // Avoid this by returning dummy expressions during this phase.
                        // Do not use empty expressions here, because those are sentinels for other cases.
                        return "_";
                    }
                    else
                        return e.expression;
                }
            }

            case Types.TypeConstant: {
                const c = this.get<SPIRConstant>(SPIRConstant, id);
                const type = this.get<SPIRType>(SPIRType, c.constant_type);

                // WorkGroupSize may be a constant.
                if (this.has_decoration(c.self, Decoration.DecorationBuiltIn))
                    return this.builtin_to_glsl(<BuiltIn>(this.get_decoration(c.self, Decoration.DecorationBuiltIn)), StorageClass.StorageClassGeneric);
                else if (c.specialization) {
                    if (this.backend.workgroup_size_is_hidden) {
                        const wg_index = this.get_constant_mapping_to_workgroup_component(c);
                        if (wg_index >= 0) {
                            let wg_size = this.builtin_to_glsl(BuiltIn.BuiltInWorkgroupSize, StorageClass.StorageClassInput) + this.vector_swizzle(1, wg_index);
                            if (type.basetype !== SPIRTypeBaseType.UInt)
                                wg_size = this.bitcast_expression(type, SPIRTypeBaseType.UInt, wg_size);
                            return wg_size;
                        }
                    }

                    return this.to_name(id);
                }
                else if (c.is_used_as_lut)
                    return this.to_name(id);
                else if (type.basetype === SPIRTypeBaseType.Struct && !this.backend.can_declare_struct_inline)
                    return this.to_name(id);
                else if (type.array.length > 0 && !this.backend.can_declare_arrays_inline)
                    return this.to_name(id);
                else
                    return this.constant_expression(c);
            }

            case Types.TypeConstantOp:
                return this.to_name(id);

            case Types.TypeVariable: {
                const var_ = this.get<SPIRVariable>(SPIRVariable, id);
                // If we try to use a loop variable before the loop header, we have to redirect it to the static expression,
                // the variable has not been declared yet.
                if (var_.statically_assigned || (var_.loop_variable && !var_.loop_variable_enable))
                    return this.to_expression(var_.static_expression);
                else if (var_.deferred_declaration) {
                    var_.deferred_declaration = false;
                    return this.variable_decl(var_);
                }
                else if (this.flattened_structs.hasOwnProperty(id)) {
                    return this.load_flattened_struct(this.to_name(id), this.get<SPIRType>(SPIRType, var_.basetype));
                }
                else {
                    const dec = maplike_get(Meta, ir.meta, var_.self).decoration;
                    if (dec.builtin)
                        return this.builtin_to_glsl(dec.builtin_type, var_.storage);
                    else
                        return this.to_name(id);
                }
            }

            case Types.TypeCombinedImageSampler:
                // This type should never be taken the expression of directly.
                // The intention is that texture sampling functions will extract the image and samplers
                // separately and take their expressions as needed.
                // GLSL does not use this type because OpSampledImage immediately creates a combined image sampler
                // expression ala sampler2D(texture, sampler).
                throw new Error("Combined image samplers have no default expression representation.");

            case Types.TypeAccessChain:
                // We cannot express this type. They only have meaning in other OpAccessChains, OpStore or OpLoad.
                throw new Error("Access chains have no default expression representation.");

            default:
                return this.to_name(id);
        }
    }

    // Just like to_expression except that we enclose the expression inside parentheses if needed.
    protected to_enclosed_expression(id: number, register_expression_read: boolean = true): string
    {
        return this.enclose_expression(this.to_expression(id, register_expression_read));
    }

    protected to_unpacked_expression(id: number, register_expression_read: boolean = true): string
    {
        // If we need to transpose, it will also take care of unpacking rules.
        const e = this.maybe_get<SPIRExpression>(SPIRExpression, id);
        const need_transpose = e && e.need_transpose;
        const is_remapped = this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
        const is_packed = this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked);

        if (!need_transpose && (is_remapped || is_packed)) {
            return this.unpack_expression_type(this.to_expression(id, register_expression_read),
                this.get_pointee_type(this.expression_type_id(id)),
                this.get_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID),
                this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked), false);
        }
        else
            return this.to_expression(id, register_expression_read);
    }

    protected to_enclosed_unpacked_expression(id: number, register_expression_read: boolean = true)
    {
        return this.enclose_expression(this.to_unpacked_expression(id, register_expression_read));
    }

    protected to_enclosed_pointer_expression(id: number, register_expression_read: boolean = true): string
    {
        const type = this.expression_type(id);
        if (type.pointer && this.expression_is_lvalue(id) && !this.should_dereference(id))
            return this.address_of_expression(this.to_enclosed_expression(id, register_expression_read));
        else
            return this.to_enclosed_unpacked_expression(id, register_expression_read);
    }

    protected to_extract_component_expression(id: number, index: number): string
    {
        const expr = this.to_enclosed_expression(id);
        if (this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked))
            return expr + "[" + index + "]";
        else
            return expr + "." + this.index_to_swizzle(index);
    }

    protected enclose_expression(expr: string): string
    {
        let need_parens = false;
        const exprLength = expr.length;

        // If the expression starts with a unary we need to enclose to deal with cases where we have back-to-back
        // unary expressions.
        if (exprLength > 0) {
            const c = expr.charAt(0);
            if (c === "-" || c === "+" || c === "!" || c === "~" || c === "&" || c === "*")
                need_parens = true;
        }

        if (!need_parens) {
            let paren_count = 0;
            for (let i = 0; i < exprLength; ++i) {
                const c = expr.charAt(i);
                if (c === "(" || c === "[")
                    paren_count++;
                else if (c === ")" || c === "]") {
                    console.assert(paren_count);
                    paren_count--;
                }
                else if (c === " " && paren_count === 0) {
                    need_parens = true;
                    break;
                }
            }
            console.assert(paren_count === 0);
        }

        // If this expression contains any spaces which are not enclosed by parentheses,
        // we need to enclose it so we can treat the whole string as an expression.
        // This happens when two expressions have been part of a binary op earlier.
        if (need_parens)
            return "(" + expr + ")";
        else
            return expr;
    }

    protected dereference_expression(expr_type: SPIRType, expr: string): string
    {
        // If this expression starts with an address-of operator ('&'), then
        // just return the part after the operator.
        // TODO: Strip parens if unnecessary?
        if (expr.charAt(0) === "&")
            return expr.substring(1);
        else if (this.backend.native_pointers)
            return "*" + expr;
        else if (expr_type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT && expr_type.basetype !== SPIRTypeBaseType.Struct &&
            expr_type.pointer_depth === 1) {
            return this.enclose_expression(expr) + ".value";
        }
        else
            return expr;
    }

    protected address_of_expression(expr: string): string
    {
        if (expr.length > 3 && expr.charAt(0) === "(" && expr.charAt(1) === "*" && expr.charAt(expr.length - 1) === ")") {
            // If we have an expression which looks like (*foo), taking the address of it is the same as stripping
            // the first two and last characters. We might have to enclose the expression.
            // This doesn't work for cases like (*foo + 10),
            // but this is an r-value expression which we cannot take the address of anyways.
            return this.enclose_expression(expr.substring(2, expr.length - 1));
        }
        else if (expr.charAt(0) === "*") {
            // If this expression starts with a dereference operator ('*'), then
            // just return the part after the operator.
            return expr.substr(1);
        }
        else
            return "&" + this.enclose_expression(expr);
    }

    // Sometimes we proactively enclosed an expression where it turns out we might have not needed it after all.
    protected strip_enclosed_expression(expr: string): string
    {
        const exprLength = expr.length;
        const lastChar = expr.charAt(exprLength - 1);
        if (exprLength < 2 || expr.charAt(0) !== "(" || lastChar !== ")")
            return expr;

        // Have to make sure that our first and last parens actually enclose everything inside it.
        let paren_count = 0;
        for (let i = 0; i < exprLength; ++i) {
            const c = expr.charAt(i);
            if (c === "(")
                paren_count++;
            else if (c === ")") {
                paren_count--;

                // If we hit 0 and this is not the final char, our first and final parens actually don't
                // enclose the expression, and we cannot strip, e.g.: (a + b) * (c + d).
                if (paren_count === 0 && c !== lastChar)
                    return expr;
            }
        }
        return expr.substring(1, exprLength - 1);
    }

    protected to_member_name(type: SPIRType, index: number): string
    {
        if (type.type_alias !== <TypeID>(0) &&
            !this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked)) {
            return this.to_member_name(this.get<SPIRType>(SPIRType, type.type_alias), index);
        }

        const memb = maplike_get(Meta, this.ir.meta, type.self).members;
        if (index < memb.length && memb[index].alias !== "")
            return memb[index].alias;
        else
            return "_m" + index;
    }

    to_member_reference(_: number, type: SPIRType, index: number, __: boolean): string
    {
        return "." + this.to_member_name(type, index);
    }

    protected type_to_glsl_constructor(type: SPIRType): string
    {
        const options = this.options;
        const backend = this.backend;
        if (backend.use_array_constructor && type.array.length > 1) {
            if (options.flatten_multidimensional_arrays)
                throw new Error("Cannot flatten constructors of multidimensional array constructors, e.g. float[][]().");
            else if (!options.es && options.version < 430)
                this.require_extension_internal("GL_ARB_arrays_of_arrays");
            else if (options.es && options.version < 310)
                throw new Error("Arrays of arrays not supported before ESSL version 310.");
        }

        let e = this.type_to_glsl(type);
        if (backend.use_array_constructor) {
            for (let i = 0; i < type.array.length; i++)
                e += "[]";
        }
        return e;
    }

    protected to_qualifiers_glsl(id: number): string
    {
        const ir = this.ir;
        const backend = this.backend;
        const flags = maplike_get(Meta, ir.meta, id).decoration.decoration_flags;
        let res = "";

        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, id);

        if (var_ && var_.storage === StorageClass.StorageClassWorkgroup && !backend.shared_is_implied)
            res += "shared ";

        res += this.to_interpolation_qualifiers(flags);
        if (var_)
            res += this.to_storage_qualifiers_glsl(var_);

        const type = this.expression_type(id);
        if (type.image.dim !== Dim.DimSubpassData && type.image.sampled === 2) {
            if (flags.get(Decoration.DecorationCoherent))
                res += "coherent ";
            if (flags.get(Decoration.DecorationRestrict))
                res += "restrict ";

            if (flags.get(Decoration.DecorationNonWritable))
                res += "readonly ";

            let formatted_load = type.image.format === ImageFormat.ImageFormatUnknown;
            if (flags.get(Decoration.DecorationNonReadable)) {
                res += "writeonly ";
                formatted_load = false;
            }

            if (formatted_load) {
                if (!this.options.es)
                    this.require_extension_internal("GL_EXT_shader_image_load_formatted");
                else
                    throw new Error("Cannot use GL_EXT_shader_image_load_formatted in ESSL.");
            }
        }

        res += this.to_precision_qualifiers_glsl(id);

        return res;
    }

    protected fixup_io_block_patch_qualifiers(var_: SPIRVariable)
    {
        // Works around weird behavior in glslangValidator where
        // a patch out block is translated to just block members getting the decoration.
        // To make glslang not complain when we compile again, we have to transform this back to a case where
        // the variable itself has Patch decoration, and not members.
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        if (this.has_decoration(type.self, Decoration.DecorationBlock)) {
            const member_count = type.member_types.length;
            for (let i = 0; i < member_count; i++) {
                if (this.has_member_decoration(type.self, i, Decoration.DecorationPatch)) {
                    this.set_decoration(var_.self, Decoration.DecorationPatch);
                    break;
                }
            }

            if (this.has_decoration(var_.self, Decoration.DecorationPatch))
                for (let i = 0; i < member_count; i++)
                    this.unset_member_decoration(type.self, i, Decoration.DecorationPatch);
        }
    }

    protected emit_output_variable_initializer(var_: SPIRVariable)
    {
        const { ir } = this;
        // If a StorageClassOutput variable has an initializer, we need to initialize it in main().
        const entry_func = this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point);
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const is_patch = this.has_decoration(var_.self, Decoration.DecorationPatch);
        const is_block = this.has_decoration(type.self, Decoration.DecorationBlock);
        const is_control_point = this.get_execution_model() === ExecutionModel.ExecutionModelTessellationControl && !is_patch;

        if (is_block) {
            const member_count = type.member_types.length;
            const type_is_array = type.array.length === 1;
            let array_size = 1;
            if (type_is_array)
                array_size = this.to_array_size_literal(type);
            const iteration_count = is_control_point ? 1 : array_size;

            // If the initializer is a block, we must initialize each block member one at a time.
            for (let i = 0; i < member_count; i++) {
                // These outputs might not have been properly declared, so don't initialize them in that case.
                if (this.has_member_decoration(type.self, i, Decoration.DecorationBuiltIn)) {
                    if (this.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn) === BuiltIn.BuiltInCullDistance &&
                        !this.cull_distance_count)
                        continue;

                    if (this.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn) === BuiltIn.BuiltInClipDistance &&
                        !this.clip_distance_count)
                        continue;
                }

                // We need to build a per-member array first, essentially transposing from AoS to SoA.
                // This code path hits when we have an array of blocks.
                let lut_name;
                if (type_is_array) {
                    lut_name = `_${var_.self}_${i}_init`;
                    const member_type_id = this.get<SPIRType>(SPIRType, var_.basetype).member_types[i];
                    const member_type = this.get<SPIRType>(SPIRType, member_type_id);
                    const array_type = member_type;
                    array_type.parent_type = member_type_id;
                    array_type.array.push(array_size);
                    array_type.array_size_literal.push(true);

                    const exprs: string[] = [];
                    // exprs.reserve(array_size);
                    const c = this.get<SPIRConstant>(SPIRConstant, var_.initializer);
                    for (let j = 0; j < array_size; j++)
                        exprs.push(this.to_expression(this.get<SPIRConstant>(SPIRConstant, c.subconstants[j]).subconstants[i]));
                    this.statement("const ", this.type_to_glsl(array_type), " ", lut_name, this.type_to_array_glsl(array_type), " = ",
                        this.type_to_glsl_constructor(array_type), "(", exprs.join(", "), ");");
                }

                for (let j = 0; j < iteration_count; j++) {
                    entry_func.fixup_hooks_in.push(() =>
                    {
                        const meta = new AccessChainMeta();
                        const c = this.get<SPIRConstant>(SPIRConstant, var_.initializer);

                        let invocation_id = 0;
                        let member_index_id = 0;
                        if (is_control_point) {
                            let ids = ir.increase_bound_by(3);
                            const uint_type = new SPIRType();
                            uint_type.basetype = SPIRTypeBaseType.UInt;
                            uint_type.width = 32;
                            this.set<SPIRType>(SPIRType, ids, uint_type);
                            this.set<SPIRExpression>(SPIRExpression, ids + 1, this.builtin_to_glsl(BuiltIn.BuiltInInvocationId, StorageClass.StorageClassInput), ids, true);
                            this.set<SPIRConstant>(SPIRConstant, ids + 2, ids, i, false);
                            invocation_id = ids + 1;
                            member_index_id = ids + 2;
                        }

                        if (is_patch) {
                            this.statement("if (gl_InvocationID === 0)");
                            this.begin_scope();
                        }

                        if (type_is_array && !is_control_point) {
                            const indices = [ j, i ];
                            const chain = this.access_chain_internal(var_.self, indices, 2, AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT, meta);
                            this.statement(chain, " = ", lut_name, "[", j, "];");
                        }
                        else if (is_control_point) {
                            const indices = [ invocation_id, member_index_id ];
                            const chain = this.access_chain_internal(var_.self, indices, 2, 0, meta);
                            this.statement(chain, " = ", lut_name, "[", this.builtin_to_glsl(BuiltIn.BuiltInInvocationId, StorageClass.StorageClassInput), "];");
                        }
                        else {
                            const chain = this.access_chain_internal(var_.self, [ i ], 1, AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT, meta);
                            this.statement(chain, " = ", this.to_expression(c.subconstants[i]), ";");
                        }

                        if (is_patch)
                            this.end_scope();
                    });
                }
            }
        }
        else if (is_control_point) {
            const lut_name = `_${var_.self}_init`;
            this.statement("const ", this.type_to_glsl(type), " ", lut_name, this.type_to_array_glsl(type),
                " = ", this.to_expression(var_.initializer), ";");
            entry_func.fixup_hooks_in.push(() =>
            {
                this.statement(this.to_expression(var_.self), "[gl_InvocationID] = ", lut_name, "[gl_InvocationID];");
            });
        }
        else if (this.has_decoration(var_.self, Decoration.DecorationBuiltIn) &&
            this.get_decoration(var_.self, Decoration.DecorationBuiltIn) === BuiltIn.BuiltInSampleMask) {
            // We cannot copy the array since gl_SampleMask is unsized in GLSL. Unroll time! <_<
            entry_func.fixup_hooks_in.push(() =>
            {
                const c = this.get<SPIRConstant>(SPIRConstant, var_.initializer);
                const num_constants = c.subconstants.length;
                for (let i = 0; i < num_constants; i++) {
                    // Don't use to_expression on constant since it might be uint, just fish out the raw int.
                    this.statement(this.to_expression(var_.self), "[", i, "] = ",
                        convert_to_string(this.get<SPIRConstant>(SPIRConstant, c.subconstants[i]).scalar_i32()), ";");
                }
            });
        }
        else {
            const lut_name = `${var_.self}_init`;
            this.statement("const ", this.type_to_glsl(type), " ", lut_name, this.type_to_array_glsl(type), " = ", this.to_expression(var_.initializer), ";");
            entry_func.fixup_hooks_in.push(() =>
            {
                if (is_patch) {
                    this.statement("if (gl_InvocationID === 0)");
                    this.begin_scope();
                }
                this.statement(this.to_expression(var_.self), " = ", lut_name, ";");
                if (is_patch)
                    this.end_scope();
            });
        }
    }

    protected to_precision_qualifiers_glsl(id: number): string
    {
        const type = this.expression_type(id);
        const use_precision_qualifiers = this.backend.allow_precision_qualifiers;
        if (use_precision_qualifiers && (type.basetype === SPIRTypeBaseType.Image || type.basetype === SPIRTypeBaseType.SampledImage)) {
            // Force mediump for the sampler type. We cannot declare 16-bit or smaller image types.
            const result_type = this.get<SPIRType>(SPIRType, type.image.type);
            if (result_type.width < 32)
                return "mediump ";
        }
        return this.flags_to_qualifiers_glsl(type, maplike_get(Meta, this.ir.meta, id).decoration.decoration_flags);
    }

    protected to_storage_qualifiers_glsl(var_: SPIRVariable): string
    {
        const execution = this.get_entry_point();

        if (this.subpass_input_is_framebuffer_fetch(var_.self))
            return "";

        if (var_.storage === StorageClass.StorageClassInput || var_.storage === StorageClass.StorageClassOutput) {
            if (this.is_legacy() && execution.model === ExecutionModel.ExecutionModelVertex)
                return var_.storage === StorageClass.StorageClassInput ? "attribute " : "varying ";
            else if (this.is_legacy() && execution.model === ExecutionModel.ExecutionModelFragment)
                return "varying "; // Fragment outputs are renamed so they never hit this case.
            else if (execution.model === ExecutionModel.ExecutionModelFragment && var_.storage === StorageClass.StorageClassOutput) {
                const loc = this.get_decoration(var_.self, Decoration.DecorationLocation);
                const is_inout = this.location_is_framebuffer_fetch(loc);
                if (is_inout)
                    return "inout ";
                else
                    return "out ";
            }
            else
                return var_.storage === StorageClass.StorageClassInput ? "in " : "out ";
        }
        else if (var_.storage === StorageClass.StorageClassUniformConstant || var_.storage === StorageClass.StorageClassUniform ||
            var_.storage === StorageClass.StorageClassPushConstant) {
            return "uniform ";
        }
        else if (var_.storage === StorageClass.StorageClassRayPayloadKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "rayPayloadEXT " : "rayPayloadNV ";
        }
        else if (var_.storage === StorageClass.StorageClassIncomingRayPayloadKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "rayPayloadInEXT " : "rayPayloadInNV ";
        }
        else if (var_.storage === StorageClass.StorageClassHitAttributeKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "hitAttributeEXT " : "hitAttributeNV ";
        }
        else if (var_.storage === StorageClass.StorageClassCallableDataKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "callableDataEXT " : "callableDataNV ";
        }
        else if (var_.storage === StorageClass.StorageClassIncomingCallableDataKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "callableDataInEXT " : "callableDataInNV ";
        }

        return "";
    }

    protected flags_to_qualifiers_glsl(type: SPIRType, flags: Bitset)
    {
        // GL_EXT_buffer_reference variables can be marked as restrict.
        if (flags.get(Decoration.DecorationRestrictPointerEXT))
            return "restrict ";

        const backend = this.backend;
        const options = this.options;
        let qual = "";

        if (type_is_floating_point(type) && flags.get(Decoration.DecorationNoContraction) && backend.support_precise_qualifier)
            qual = "precise ";

        // Structs do not have precision qualifiers, neither do doubles (desktop only anyways, so no mediump/highp).
        const type_supports_precision =
            type.basetype === SPIRTypeBaseType.Float || type.basetype === SPIRTypeBaseType.Int || type.basetype === SPIRTypeBaseType.UInt ||
            type.basetype === SPIRTypeBaseType.Image || type.basetype === SPIRTypeBaseType.SampledImage ||
            type.basetype === SPIRTypeBaseType.Sampler;

        if (!type_supports_precision)
            return qual;

        if (options.es) {
            const execution = this.get_entry_point();

            if (flags.get(Decoration.DecorationRelaxedPrecision)) {
                const implied_fmediump = type.basetype === SPIRTypeBaseType.Float &&
                    options.fragment.default_float_precision === GLSLPrecision.Mediump &&
                    execution.model === ExecutionModel.ExecutionModelFragment;

                const implied_imediump = (type.basetype === SPIRTypeBaseType.Int || type.basetype === SPIRTypeBaseType.UInt) &&
                    options.fragment.default_int_precision === GLSLPrecision.Mediump &&
                    execution.model === ExecutionModel.ExecutionModelFragment;

                qual += (implied_fmediump || implied_imediump) ? "" : "mediump ";
            }
            else {
                const implied_fhighp =
                    type.basetype === SPIRTypeBaseType.Float && ((options.fragment.default_float_precision === GLSLPrecision.Highp &&
                            execution.model === ExecutionModel.ExecutionModelFragment) ||
                        (execution.model !== ExecutionModel.ExecutionModelFragment));

                const implied_ihighp = (type.basetype === SPIRTypeBaseType.Int || type.basetype === SPIRTypeBaseType.UInt) &&
                    ((options.fragment.default_int_precision === GLSLPrecision.Highp &&
                            execution.model === ExecutionModel.ExecutionModelFragment) ||
                        (execution.model !== ExecutionModel.ExecutionModelFragment));

                qual += (implied_fhighp || implied_ihighp) ? "" : "highp ";
            }
        }
        else if (backend.allow_precision_qualifiers) {
            // Vulkan GLSL supports precision qualifiers, even in desktop profiles, which is convenient.
            // The default is highp however, so only emit mediump in the rare case that a shader has these.
            if (flags.get(Decoration.DecorationRelaxedPrecision))
                qual += "mediump ";
        }

        return qual;
    }

    protected format_to_glsl(format: ImageFormat): string
    {
        if (this.options.es && this.is_desktop_only_format(format))
            throw new Error("Attempting to use image format not supported in ES profile.");

        switch (format) {
            case ImageFormat.ImageFormatRgba32f:
                return "rgba32f";
            case ImageFormat.ImageFormatRgba16f:
                return "rgba16f";
            case ImageFormat.ImageFormatR32f:
                return "r32f";
            case ImageFormat.ImageFormatRgba8:
                return "rgba8";
            case ImageFormat.ImageFormatRgba8Snorm:
                return "rgba8_snorm";
            case ImageFormat.ImageFormatRg32f:
                return "rg32f";
            case ImageFormat.ImageFormatRg16f:
                return "rg16f";
            case ImageFormat.ImageFormatRgba32i:
                return "rgba32i";
            case ImageFormat.ImageFormatRgba16i:
                return "rgba16i";
            case ImageFormat.ImageFormatR32i:
                return "r32i";
            case ImageFormat.ImageFormatRgba8i:
                return "rgba8i";
            case ImageFormat.ImageFormatRg32i:
                return "rg32i";
            case ImageFormat.ImageFormatRg16i:
                return "rg16i";
            case ImageFormat.ImageFormatRgba32ui:
                return "rgba32ui";
            case ImageFormat.ImageFormatRgba16ui:
                return "rgba16ui";
            case ImageFormat.ImageFormatR32ui:
                return "r32ui";
            case ImageFormat.ImageFormatRgba8ui:
                return "rgba8ui";
            case ImageFormat.ImageFormatRg32ui:
                return "rg32ui";
            case ImageFormat.ImageFormatRg16ui:
                return "rg16ui";
            case ImageFormat.ImageFormatR11fG11fB10f:
                return "r11f_g11f_b10f";
            case ImageFormat.ImageFormatR16f:
                return "r16f";
            case ImageFormat.ImageFormatRgb10A2:
                return "rgb10_a2";
            case ImageFormat.ImageFormatR8:
                return "r8";
            case ImageFormat.ImageFormatRg8:
                return "rg8";
            case ImageFormat.ImageFormatR16:
                return "r16";
            case ImageFormat.ImageFormatRg16:
                return "rg16";
            case ImageFormat.ImageFormatRgba16:
                return "rgba16";
            case ImageFormat.ImageFormatR16Snorm:
                return "r16_snorm";
            case ImageFormat.ImageFormatRg16Snorm:
                return "rg16_snorm";
            case ImageFormat.ImageFormatRgba16Snorm:
                return "rgba16_snorm";
            case ImageFormat.ImageFormatR8Snorm:
                return "r8_snorm";
            case ImageFormat.ImageFormatRg8Snorm:
                return "rg8_snorm";
            case ImageFormat.ImageFormatR8ui:
                return "r8ui";
            case ImageFormat.ImageFormatRg8ui:
                return "rg8ui";
            case ImageFormat.ImageFormatR16ui:
                return "r16ui";
            case ImageFormat.ImageFormatRgb10a2ui:
                return "rgb10_a2ui";
            case ImageFormat.ImageFormatR8i:
                return "r8i";
            case ImageFormat.ImageFormatRg8i:
                return "rg8i";
            case ImageFormat.ImageFormatR16i:
                return "r16i";
            default:
                // case ImageFormat.ImageFormatUnknown:
                return null;
        }
    }

    protected layout_for_member(type: SPIRType, index: number): string
    {
        if (this.is_legacy())
            return "";

        const is_block = this.has_decoration(type.self, Decoration.DecorationBlock) || this.has_decoration(type.self, Decoration.DecorationBufferBlock);
        if (!is_block)
            return "";

        const { ir, options } = this;
        const memb = maplike_get(Meta, ir.meta, type.self).members;
        if (index >= memb.length)
            return "";
        const dec = memb[index];

        const attr: string[] = [];

        if (this.has_member_decoration(type.self, index, Decoration.DecorationPassthroughNV))
            attr.push("passthrough");

        // We can only apply layouts on members in block interfaces.
        // This is a bit problematic because in SPIR-V decorations are applied on the struct types directly.
        // This is not supported on GLSL, so we have to make the assumption that if a struct within our buffer block struct
        // has a decoration, it was originally caused by a top-level layout() qualifier in GLSL.
        //
        // We would like to go from (SPIR-V style):
        //
        // struct Foo { layout(row_major) mat4 matrix; };
        // buffer UBO { Foo foo; };
        //
        // to
        //
        // struct Foo { mat4 matrix; }; // GLSL doesn't support any layout shenanigans in raw struct declarations.
        // buffer UBO { layout(row_major) Foo foo; }; // Apply the layout on top-level.
        const flags = this.combined_decoration_for_member(type, index);

        if (flags.get(Decoration.DecorationRowMajor))
            attr.push("row_major");
        // We don't emit any global layouts, so column_major is default.
        //if (flags & (1ull << DecorationColMajor))
        //    attr.push("column_major");

        if (dec.decoration_flags.get(Decoration.DecorationLocation) && this.can_use_io_location(type.storage, true))
            attr.push("location = " + dec.location);

        // Can only declare component if we can declare location.
        if (dec.decoration_flags.get(Decoration.DecorationComponent) && this.can_use_io_location(type.storage, true)) {
            if (!options.es) {
                if (options.version < 440 && options.version >= 140)
                    this.require_extension_internal("GL_ARB_enhanced_layouts");
                else if (options.version < 140)
                    throw new Error("Component decoration is not supported in targets below GLSL 1.40.");
                attr.push("component = " + dec.component);
            }
            else
                throw new Error("Component decoration is not supported in ES targets.");
        }

        // SPIRVCrossDecorationPacked is set by layout_for_variable earlier to mark that we need to emit offset qualifiers.
        // This is only done selectively in GLSL as needed.
        if (this.has_extended_decoration(type.self, ExtendedDecorations.SPIRVCrossDecorationExplicitOffset) &&
            dec.decoration_flags.get(Decoration.DecorationOffset))
            attr.push("offset = " + dec.offset);
        else if (type.storage === StorageClass.StorageClassOutput && dec.decoration_flags.get(Decoration.DecorationOffset))
            attr.push("xfb_offset = " + dec.offset);

        if (attr.length === 0)
            return "";

        let res = "layout(";
        res += attr.join(", ");
        res += ") ";
        return res;
    }

    protected to_interpolation_qualifiers(flags: Bitset): string
    {
        let res = "";
        //if (flags & (1ull << DecorationSmooth))
        //    res += "smooth ";
        if (flags.get(Decoration.DecorationFlat))
            res += "flat ";
        if (flags.get(Decoration.DecorationNoPerspective))
            res += "noperspective ";
        if (flags.get(Decoration.DecorationCentroid))
            res += "centroid ";
        if (flags.get(Decoration.DecorationPatch))
            res += "patch ";
        if (flags.get(Decoration.DecorationSample))
            res += "sample ";
        if (flags.get(Decoration.DecorationInvariant))
            res += "invariant ";

        if (flags.get(Decoration.DecorationExplicitInterpAMD)) {
            this.require_extension_internal("GL_AMD_shader_explicit_vertex_parameter");
            res += "__explicitInterpAMD ";
        }

        if (flags.get(Decoration.DecorationPerVertexNV)) {
            const options = this.options;
            if (options.es && options.version < 320)
                throw new Error("pervertexNV requires ESSL 320.");
            else if (!options.es && options.version < 450)
                throw new Error("pervertexNV requires GLSL 450.");
            this.require_extension_internal("GL_NV_fragment_shader_barycentric");
            res += "pervertexNV ";
        }

        return res;
    }

    protected layout_for_variable(var_: SPIRVariable): string
    {
        // FIXME: Come up with a better solution for when to disable layouts.
        // Having layouts depend on extensions as well as which types
        // of layouts are used. For now, the simple solution is to just disable
        // layouts for legacy versions.
        if (this.is_legacy())
            return "";

        if (this.subpass_input_is_framebuffer_fetch(var_.self))
            return "";

        const { options, ir } = this;
        const attr: string[] = [];

        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const flags = this.get_decoration_bitset(var_.self);
        const typeflags = this.get_decoration_bitset(type.self);

        if (flags.get(Decoration.DecorationPassthroughNV))
            attr.push("passthrough");

        /*if (options.vulkan_semantics && var_.storage === StorageClass.StorageClassPushConstant)
            attr.push("push_constant");
        else if (var_.storage === StorageClass.StorageClassShaderRecordBufferKHR)
            attr.push(ray_tracing_is_khr ? "shaderRecordEXT" : "shaderRecordNV");*/

        if (flags.get(Decoration.DecorationRowMajor))
            attr.push("row_major");
        if (flags.get(Decoration.DecorationColMajor))
            attr.push("column_major");

        /*if (options.vulkan_semantics)
        {
            if (flags.get(Decoration.DecorationInputAttachmentIndex))
                attr.push("input_attachment_index = " + this.get_decoration(var_.self, DecorationInputAttachmentIndex));
        }*/

        const is_block = this.has_decoration(type.self, Decoration.DecorationBlock);
        if (flags.get(Decoration.DecorationLocation) && this.can_use_io_location(var_.storage, is_block)) {
            const combined_decoration = new Bitset();
            const members = maplike_get(Meta, ir.meta, type.self).members;
            for (let i = 0; i < members.length; i++)
                combined_decoration.merge_or(this.combined_decoration_for_member(type, i));

            // If our members have location decorations, we don't need to
            // emit location decorations at the top as well (looks weird).
            if (!combined_decoration.get(Decoration.DecorationLocation))
                attr.push("location = " + this.get_decoration(var_.self, Decoration.DecorationLocation));
        }

        if (this.get_execution_model() === ExecutionModel.ExecutionModelFragment && var_.storage === StorageClass.StorageClassOutput &&
            this.location_is_non_coherent_framebuffer_fetch(this.get_decoration(var_.self, Decoration.DecorationLocation))) {
            attr.push("noncoherent");
        }

        // Transform feedback
        let uses_enhanced_layouts = false;
        if (is_block && var_.storage === StorageClass.StorageClassOutput) {
            // For blocks, there is a restriction where xfb_stride/xfb_buffer must only be declared on the block itself,
            // since all members must match the same xfb_buffer. The only thing we will declare for members of the block
            // is the xfb_offset.
            const member_count = type.member_types.length;
            let have_xfb_buffer_stride = false;
            let have_any_xfb_offset = false;
            let have_geom_stream = false;
            let xfb_stride = 0, xfb_buffer = 0, geom_stream = 0;

            if (flags.get(Decoration.DecorationXfbBuffer) && flags.get(Decoration.DecorationXfbStride)) {
                have_xfb_buffer_stride = true;
                xfb_buffer = this.get_decoration(var_.self, Decoration.DecorationXfbBuffer);
                xfb_stride = this.get_decoration(var_.self, Decoration.DecorationXfbStride);
            }

            if (flags.get(Decoration.DecorationStream)) {
                have_geom_stream = true;
                geom_stream = this.get_decoration(var_.self, Decoration.DecorationStream);
            }

            // Verify that none of the members violate our assumption.
            for (let i = 0; i < member_count; i++) {
                if (this.has_member_decoration(type.self, i, Decoration.DecorationStream)) {
                    const member_geom_stream = this.get_member_decoration(type.self, i, Decoration.DecorationStream);
                    if (have_geom_stream && member_geom_stream !== geom_stream)
                        throw new Error("IO block member Stream mismatch.");
                    have_geom_stream = true;
                    geom_stream = member_geom_stream;
                }

                // Only members with an Offset decoration participate in XFB.
                if (!this.has_member_decoration(type.self, i, Decoration.DecorationOffset))
                    continue;
                have_any_xfb_offset = true;

                if (this.has_member_decoration(type.self, i, Decoration.DecorationXfbBuffer)) {
                    const buffer_index = this.get_member_decoration(type.self, i, Decoration.DecorationXfbBuffer);
                    if (have_xfb_buffer_stride && buffer_index !== xfb_buffer)
                        throw new Error("IO block member XfbBuffer mismatch.");
                    have_xfb_buffer_stride = true;
                    xfb_buffer = buffer_index;
                }

                if (this.has_member_decoration(type.self, i, Decoration.DecorationXfbStride)) {
                    const stride = this.get_member_decoration(type.self, i, Decoration.DecorationXfbStride);
                    if (have_xfb_buffer_stride && stride !== xfb_stride)
                        throw new Error("IO block member XfbStride mismatch.");
                    have_xfb_buffer_stride = true;
                    xfb_stride = stride;
                }
            }

            if (have_xfb_buffer_stride && have_any_xfb_offset) {
                attr.push("xfb_buffer = " + xfb_buffer);
                attr.push("xfb_stride = " + xfb_stride);
                uses_enhanced_layouts = true;
            }

            if (have_geom_stream) {
                if (this.get_execution_model() !== ExecutionModel.ExecutionModelGeometry)
                    throw new Error("Geometry streams can only be used in geometry shaders.");
                if (options.es)
                    throw new Error("Multiple geometry streams not supported in ESSL.");
                if (options.version < 400)
                    this.require_extension_internal("GL_ARB_transform_feedback3");
                attr.push("stream = " + this.get_decoration(var_.self, Decoration.DecorationStream));
            }
        }
        else if (var_.storage === StorageClass.StorageClassOutput) {
            if (flags.get(Decoration.DecorationXfbBuffer) && flags.get(Decoration.DecorationXfbStride) && flags.get(Decoration.DecorationOffset)) {
                // XFB for standalone variables, we can emit all decorations.
                attr.push("xfb_buffer = " + this.get_decoration(var_.self, Decoration.DecorationXfbBuffer));
                attr.push("xfb_stride = " + this.get_decoration(var_.self, Decoration.DecorationXfbStride));
                attr.push("xfb_offset = " + this.get_decoration(var_.self, Decoration.DecorationOffset));
                uses_enhanced_layouts = true;
            }

            if (flags.get(Decoration.DecorationStream)) {
                if (this.get_execution_model() !== ExecutionModel.ExecutionModelGeometry)
                    throw new Error("Geometry streams can only be used in geometry shaders.");
                if (options.es)
                    throw new Error("Multiple geometry streams not supported in ESSL.");
                if (options.version < 400)
                    this.require_extension_internal("GL_ARB_transform_feedback3");
                attr.push("stream = " + this.get_decoration(var_.self, Decoration.DecorationStream));
            }
        }

        // Can only declare Component if we can declare location.
        if (flags.get(Decoration.DecorationComponent) && this.can_use_io_location(var_.storage, is_block)) {
            uses_enhanced_layouts = true;
            attr.push("component = " + this.get_decoration(var_.self, Decoration.DecorationComponent));
        }

        if (uses_enhanced_layouts) {
            if (!options.es) {
                if (options.version < 440 && options.version >= 140)
                    this.require_extension_internal("GL_ARB_enhanced_layouts");
                else if (options.version < 140)
                    throw new Error("GL_ARB_enhanced_layouts is not supported in targets below GLSL 1.40.");
                if (!options.es && options.version < 440)
                    this.require_extension_internal("GL_ARB_enhanced_layouts");
            }
            else if (options.es)
                throw new Error("GL_ARB_enhanced_layouts is not supported in ESSL.");
        }

        if (flags.get(Decoration.DecorationIndex))
            attr.push("index = " + this.get_decoration(var_.self, Decoration.DecorationIndex));

        // Do not emit set = decoration in regular GLSL output, but
        // we need to preserve it in Vulkan GLSL mode.
        /*if (var_.storage !== StorageClass.StorageClassPushConstant && var_.storage !== StorageClass.StorageClassShaderRecordBufferKHR)
        {
            if (flags.get(Decoration.DecorationDescriptorSet) && options.vulkan_semantics)
                attr.push(join("set = ", get_decoration(var_.self, Decoration.DecorationDescriptorSet)));
        }*/

        const push_constant_block = false; //options.vulkan_semantics && var_.storage ===StorageClass.StorageClassPushConstant;
        const ssbo_block = var_.storage === StorageClass.StorageClassStorageBuffer || var_.storage === StorageClass.StorageClassShaderRecordBufferKHR ||
            (var_.storage === StorageClass.StorageClassUniform && typeflags.get(Decoration.DecorationBufferBlock));
        const emulated_ubo = var_.storage === StorageClass.StorageClassPushConstant && options.emit_push_constant_as_uniform_buffer;
        const ubo_block = var_.storage === StorageClass.StorageClassUniform && typeflags.get(Decoration.DecorationBlock);

        // GL 3.0/GLSL 1.30 is not considered legacy, but it doesn't have UBOs ...
        let can_use_buffer_blocks = (options.es && options.version >= 300) || (!options.es && options.version >= 140);

        // pretend no UBOs when options say so
        if (ubo_block && options.emit_uniform_buffer_as_plain_uniforms)
            can_use_buffer_blocks = false;

        let can_use_binding: boolean;
        if (options.es)
            can_use_binding = options.version >= 310;
        else
            can_use_binding = options.enable_420pack_extension || (options.version >= 420);

        // Make sure we don't emit binding layout for a classic uniform on GLSL 1.30.
        if (!can_use_buffer_blocks && var_.storage === StorageClass.StorageClassUniform)
            can_use_binding = false;

        if (var_.storage === StorageClass.StorageClassShaderRecordBufferKHR)
            can_use_binding = false;

        if (can_use_binding && flags.get(Decoration.DecorationBinding))
            attr.push("binding = " + this.get_decoration(var_.self, Decoration.DecorationBinding));

        if (var_.storage !== StorageClass.StorageClassOutput && flags.get(Decoration.DecorationOffset))
            attr.push("offset = " + this.get_decoration(var_.self, Decoration.DecorationOffset));

        // Instead of adding explicit offsets for every element here, just assume we're using std140 or std430.
        // If SPIR-V does not comply with either layout, we cannot really work around it.
        if (can_use_buffer_blocks && (ubo_block || emulated_ubo)) {
            attr.push(this.buffer_to_packing_standard(type, false));
        }
        else if (can_use_buffer_blocks && (push_constant_block || ssbo_block)) {
            attr.push(this.buffer_to_packing_standard(type, true));
        }

        // For images, the type itself adds a layout qualifer.
        // Only emit the format for storage images.
        if (type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 2) {
            const fmt = this.format_to_glsl(type.image.format);
            if (fmt)
                attr.push(fmt);
        }

        if (attr.length === 0)
            return "";

        return "layout(" + attr.join(", ") + ") ";
    }

    protected to_initializer_expression(var_: SPIRVariable): string
    {
        return this.to_unpacked_expression(var_.initializer);
    }

    protected to_zero_initialized_expression(type_id: number): string
    {
        /*#ifndef NDEBUG
        auto &type = get<SPIRType>(type_id);
        assert(type.storage === StorageClassPrivate || type.storage === StorageClassFunction ||
        type.storage === StorageClassGeneric);
        #endif*/

        const ir = this.ir;
        const id = ir.increase_bound_by(1);
        ir.make_constant_null(id, type_id, false);
        return this.constant_expression(this.get<SPIRConstant>(SPIRConstant, id));
    }

    protected type_can_zero_initialize(type: SPIRType): boolean
    {
        if (type.pointer)
            return false;

        if (type.array.length > 0 && this.options.flatten_multidimensional_arrays)
            return false;

        for (let literal of type.array_size_literal)
            if (!literal)
                return false;

        for (let memb of type.member_types)
            if (!this.type_can_zero_initialize(this.get<SPIRType>(SPIRType, memb)))
                return false;

        return true;
    }

    protected buffer_is_packing_standard(type: SPIRType, packing: BufferPackingStandard, failed_validation_index: number[] = null, start_offset: number = 0, end_offset: number = ~0): boolean
    {
// This is very tricky and error prone, but try to be exhaustive and correct here.
        // SPIR-V doesn't directly say if we're using std430 or std140.
        // SPIR-V communicates this using Offset and ArrayStride decorations (which is what really matters),
        // so we have to try to infer whether or not the original GLSL source was std140 or std430 based on this information.
        // We do not have to consider shared or packed since these layouts are not allowed in Vulkan SPIR-V (they are useless anyways, and custom offsets would do the same thing).
        //
        // It is almost certain that we're using std430, but it gets tricky with arrays in particular.
        // We will assume std430, but infer std140 if we can prove the struct is not compliant with std430.
        //
        // The only two differences between std140 and std430 are related to padding alignment/array stride
        // in arrays and structs. In std140 they take minimum vec4 alignment.
        // std430 only removes the vec4 requirement.

        let offset = 0;
        let pad_alignment = 1;

        const is_top_level_block = this.has_decoration(type.self, Decoration.DecorationBlock) || this.has_decoration(type.self, Decoration.DecorationBufferBlock);
        const { ir } = this;

        for (let i = 0; i < type.member_types.length; i++) {
            const memb_type = this.get<SPIRType>(SPIRType, type.member_types[i]);
            const member_flags = maplike_get(Meta, ir.meta, type.self).members[i].decoration_flags;

            // Verify alignment rules.
            const packed_alignment = this.type_to_packed_alignment(memb_type, member_flags, packing);

            // This is a rather dirty workaround to deal with some cases of OpSpecConstantOp used as array size, e.g:
            // layout(constant_id = 0) const int s = 10;
            // const int S = s + 5; // SpecConstantOp
            // buffer Foo { int data[S]; }; // <-- Very hard for us to deduce a fixed value here,
            // we would need full implementation of compile-time constant folding. :(
            // If we are the last member of a struct, there might be cases where the actual size of that member is irrelevant
            // for our analysis (e.g. unsized arrays).
            // This lets us simply ignore that there are spec constant op sized arrays in our buffers.
            // Querying size of this member will fail, so just don't call it unless we have to.
            //
            // This is likely "best effort" we can support without going into unacceptably complicated workarounds.
            const member_can_be_unsized = is_top_level_block && (i + 1) === type.member_types.length && memb_type.array.length > 0;

            let packed_size = 0;
            if (!member_can_be_unsized /*|| this.packing_is_hlsl(packing)*/)
                packed_size = this.type_to_packed_size(memb_type, member_flags, packing);

            // We only need to care about this if we have non-array types which can straddle the vec4 boundary.
            /*if (packing_is_hlsl(packing))
            {
                // If a member straddles across a vec4 boundary, alignment is actually vec4.
                uint32_t begin_word = offset / 16;
                uint32_t end_word = (offset + packed_size - 1) / 16;
                if (begin_word !== end_word)
                    packed_alignment = max(packed_alignment, 16u);
            }*/

            const actual_offset = this.type_struct_member_offset(type, i);
            // Field is not in the specified range anymore and we can ignore any further fields.
            if (actual_offset >= end_offset)
                break;

            const alignment = Math.max(packed_alignment, pad_alignment);
            offset = (offset + alignment - 1) & ~(alignment - 1);

            // The next member following a struct member is aligned to the base alignment of the struct that came before.
            // GL 4.5 spec, 7.6.2.2.
            if (memb_type.basetype === SPIRTypeBaseType.Struct && !memb_type.pointer)
                pad_alignment = packed_alignment;
            else
                pad_alignment = 1;

            // Only care about packing if we are in the given range
            if (actual_offset >= start_offset) {
                // We only care about offsets in std140, std430, etc ...
                // For EnhancedLayout variants, we have the flexibility to choose our own offsets.
                if (!packing_has_flexible_offset(packing)) {
                    if (actual_offset !== offset) // This cannot be the packing we're looking for.
                    {
                        if (failed_validation_index)
                            failed_validation_index[0] = i;
                        return false;
                    }
                }
                else if ((actual_offset & (alignment - 1)) !== 0) {
                    // We still need to verify that alignment rules are observed, even if we have explicit offset.
                    if (failed_validation_index)
                        failed_validation_index[0] = i;
                    return false;
                }

                // Verify array stride rules.
                if (memb_type.array.length === 0 && this.type_to_packed_array_stride(memb_type, member_flags, packing) !=
                    this.type_struct_member_array_stride(type, i)) {
                    if (failed_validation_index)
                        failed_validation_index[0] = i;
                    return false;
                }

                // Verify that sub-structs also follow packing rules.
                // We cannot use enhanced layouts on substructs, so they better be up to spec.
                const substruct_packing = packing_to_substruct_packing(packing);

                if (!memb_type.pointer && memb_type.member_types.length > 0 &&
                    !this.buffer_is_packing_standard(memb_type, substruct_packing)) {
                    if (failed_validation_index)
                        failed_validation_index[0] = i;
                    return false;
                }
            }

            // Bump size.
            offset = actual_offset + packed_size;
        }

        return true;
    }

    protected buffer_to_packing_standard(type: SPIRType, support_std430_without_scalar_layout: boolean): string
    {
        const { options } = this;
        if (support_std430_without_scalar_layout && this.buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingStd430))
            return "std430";
        else if (this.buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingStd140))
            return "std140";
        /*else if (options.vulkan_semantics && buffer_is_packing_standard(type, BufferPackingScalar))
        {
            require_extension_internal("GL_EXT_scalar_block_layout");
            return "scalar";
        }*/
        else if (support_std430_without_scalar_layout &&
            this.buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingStd430EnhancedLayout)) {
            if (options.es/* && !options.vulkan_semantics*/)
                throw new Error("Push constant block cannot be expressed as neither std430 nor std140. ES-targets do not support GL_ARB_enhanced_layouts.");
            /*if (!options.es && !options.vulkan_semantics && options.version < 440)
                this.require_extension_internal("GL_ARB_enhanced_layouts");*/

            this.set_extended_decoration(type.self, ExtendedDecorations.SPIRVCrossDecorationExplicitOffset);
            return "std430";
        }
        else if (this.buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingStd140EnhancedLayout)) {
            // Fallback time. We might be able to use the ARB_enhanced_layouts to deal with this difference,
            // however, we can only use layout(offset) on the block itself, not any substructs, so the substructs better be the appropriate layout.
            // Enhanced layouts seem to always work in Vulkan GLSL, so no need for extensions there.
            if (options.es /*&& !options.vulkan_semantics*/)
                throw new Error("Push constant block cannot be expressed as neither std430 nor std140. ES-targets do not support GL_ARB_enhanced_layouts.");
            if (!options.es && /*!options.vulkan_semantics &&*/ options.version < 440)
                this.require_extension_internal("GL_ARB_enhanced_layouts");

            this.set_extended_decoration(type.self, ExtendedDecorations.SPIRVCrossDecorationExplicitOffset);
            return "std140";
        }
            /*else if (options.vulkan_semantics && buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingScalarEnhancedLayout))
            {
                set_extended_decoration(type.self, SPIRVCrossDecorationExplicitOffset);
                require_extension_internal("GL_EXT_scalar_block_layout");
                return "scalar";
            }*/
            /*else if (!support_std430_without_scalar_layout && options.vulkan_semantics &&
                buffer_is_packing_standard(type, BufferPackingStd430))
            {
                // UBOs can support std430 with GL_EXT_scalar_block_layout.
                require_extension_internal("GL_EXT_scalar_block_layout");
                return "std430";
            }*/
        /*else if (!support_std430_without_scalar_layout && options.vulkan_semantics &&
            buffer_is_packing_standard(type, BufferPackingStd430EnhancedLayout))
        {
            // UBOs can support std430 with GL_EXT_scalar_block_layout.
            set_extended_decoration(type.self, SPIRVCrossDecorationExplicitOffset);
            require_extension_internal("GL_EXT_scalar_block_layout");
            return "std430";
        }*/
        else {
            throw new Error("Buffer block cannot be expressed as any of std430, std140, scalar, even with enhanced layouts. You can try flattening this block to support a more flexible layout.");
        }
    }

    protected type_to_packed_base_size(type: SPIRType, _: BufferPackingStandard): number
    {
        switch (type.basetype) {
            case SPIRTypeBaseType.Double:
            case SPIRTypeBaseType.Int64:
            case SPIRTypeBaseType.UInt64:
                return 8;
            case SPIRTypeBaseType.Float:
            case SPIRTypeBaseType.Int:
            case SPIRTypeBaseType.UInt:
                return 4;
            case SPIRTypeBaseType.Half:
            case SPIRTypeBaseType.Short:
            case SPIRTypeBaseType.UShort:
                return 2;
            case SPIRTypeBaseType.SByte:
            case SPIRTypeBaseType.UByte:
                return 1;

            default:
                throw new Error("Unrecognized type in type_to_packed_base_size.");
        }
    }

    protected type_to_packed_alignment(type: SPIRType, flags: Bitset, packing: BufferPackingStandard): number
    {
        const { ir } = this;
        // If using PhysicalStorageBufferEXT storage class, this is a pointer,
        // and is 64-bit.
        if (type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
            if (!type.pointer)
                throw new Error("Types in PhysicalStorageBufferEXT must be pointers.");

            if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT) {
                if (packing_is_vec4_padded(packing) && this.type_is_array_of_pointers(type))
                    return 16;
                else
                    return 8;
            }
            else
                throw new Error("AddressingModelPhysicalStorageBuffer64EXT must be used for PhysicalStorageBufferEXT.");
        }

        if (type.array.length) {
            let minimum_alignment = 1;
            if (packing_is_vec4_padded(packing))
                minimum_alignment = 16;

            let tmp = this.get<SPIRType>(SPIRType, type.parent_type);
            while (!tmp.array.length)
                tmp = this.get<SPIRType>(SPIRType, tmp.parent_type);

            // Get the alignment of the base type, then maybe round up.
            return Math.max(minimum_alignment, this.type_to_packed_alignment(tmp, flags, packing));
        }

        if (type.basetype === SPIRTypeBaseType.Struct) {
            // Rule 9. Structs alignments are maximum alignment of its members.
            let alignment = 1;
            for (let i = 0; i < type.member_types.length; i++) {
                const member_flags = maplike_get(Meta, ir.meta, type.self).members[i].decoration_flags;
                alignment =
                    Math.max(alignment, this.type_to_packed_alignment(this.get<SPIRType>(SPIRType, type.member_types[i]), member_flags, packing));
            }

            // In std140, struct alignment is rounded up to 16.
            if (packing_is_vec4_padded(packing))
                alignment = Math.max(alignment, 16);

            return alignment;
        }
        else {
            const base_alignment = this.type_to_packed_base_size(type, packing);

            // Alignment requirement for scalar block layout is always the alignment for the most basic component.
            if (packing_is_scalar(packing))
                return base_alignment;

            // Vectors are *not* aligned in HLSL, but there's an extra rule where vectors cannot straddle
            // a vec4, this is handled outside since that part knows our current offset.
            /*if (type.columns === 1 && packing_is_hlsl(packing))
                return base_alignment;*/

            // From 7.6.2.2 in GL 4.5 core spec.
            // Rule 1
            if (type.vecsize === 1 && type.columns === 1)
                return base_alignment;

            // Rule 2
            if ((type.vecsize === 2 || type.vecsize === 4) && type.columns === 1)
                return type.vecsize * base_alignment;

            // Rule 3
            if (type.vecsize === 3 && type.columns === 1)
                return 4 * base_alignment;

            // Rule 4 implied. Alignment does not change in std430.

            // Rule 5. Column-major matrices are stored as arrays of
            // vectors.
            if (flags.get(Decoration.DecorationColMajor) && type.columns > 1) {
                if (packing_is_vec4_padded(packing))
                    return 4 * base_alignment;
                else if (type.vecsize === 3)
                    return 4 * base_alignment;
                else
                    return type.vecsize * base_alignment;
            }

            // Rule 6 implied.

            // Rule 7.
            if (flags.get(Decoration.DecorationRowMajor) && type.vecsize > 1) {
                if (packing_is_vec4_padded(packing))
                    return 4 * base_alignment;
                else if (type.columns === 3)
                    return 4 * base_alignment;
                else
                    return type.columns * base_alignment;
            }

            // Rule 8 implied.
        }

        throw new Error("Did not find suitable rule for type. Bogus decorations?");
    }

    protected type_to_packed_array_stride(type: SPIRType, flags: Bitset, packing: BufferPackingStandard): number
    {
        // Array stride is equal to aligned size of the underlying type.
        const parent = type.parent_type;
        console.assert(parent);

        const tmp = this.get<SPIRType>(SPIRType, parent);

        const size = this.type_to_packed_size(tmp, flags, packing);
        const alignment = this.type_to_packed_alignment(type, flags, packing);
        return (size + alignment - 1) & ~(alignment - 1);
    }

    protected type_to_packed_size(type: SPIRType, flags: Bitset, packing: BufferPackingStandard): number
    {
        if (type.array.length) {
            const packed_size = this.to_array_size_literal(type) * this.type_to_packed_array_stride(type, flags, packing);

            // For arrays of vectors and matrices in HLSL, the last element has a size which depends on its vector size,
            // so that it is possible to pack other vectors into the last element.
            /*if (packing_is_hlsl(packing) && type.basetype !== SPIRTypeBaseType.Struct)
                packed_size -= (4 - type.vecsize) * (type.width / 8);*/

            return packed_size;
        }

        const { ir } = this;

        // If using PhysicalStorageBufferEXT storage class, this is a pointer,
        // and is 64-bit.
        if (type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
            if (!type.pointer)
                throw new Error("Types in PhysicalStorageBufferEXT must be pointers.");

            if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT)
                return 8;
            else
                throw new Error("AddressingModelPhysicalStorageBuffer64EXT must be used for PhysicalStorageBufferEXT.");
        }

        let size = 0;

        if (type.basetype === SPIRTypeBaseType.Struct) {
            let pad_alignment = 1;

            for (let i = 0; i < type.member_types.length; i++) {
                const member_flags = maplike_get(Meta, ir.meta, type.self).members[i].decoration_flags;
                const member_type = this.get<SPIRType>(SPIRType, type.member_types[i]);

                const packed_alignment = this.type_to_packed_alignment(member_type, member_flags, packing);
                const alignment = Math.max(packed_alignment, pad_alignment);

                // The next member following a struct member is aligned to the base alignment of the struct that came before.
                // GL 4.5 spec, 7.6.2.2.
                if (member_type.basetype === SPIRTypeBaseType.Struct)
                    pad_alignment = packed_alignment;
                else
                    pad_alignment = 1;

                size = (size + alignment - 1) & ~(alignment - 1);
                size += this.type_to_packed_size(member_type, member_flags, packing);
            }
        }
        else {
            const base_alignment = this.type_to_packed_base_size(type, packing);

            if (packing_is_scalar(packing)) {
                size = type.vecsize * type.columns * base_alignment;
            }
            else {
                if (type.columns === 1)
                    size = type.vecsize * base_alignment;

                if (flags.get(Decoration.DecorationColMajor) && type.columns > 1) {
                    if (packing_is_vec4_padded(packing))
                        size = type.columns * 4 * base_alignment;
                    else if (type.vecsize === 3)
                        size = type.columns * 4 * base_alignment;
                    else
                        size = type.columns * type.vecsize * base_alignment;
                }

                if (flags.get(Decoration.DecorationRowMajor) && type.vecsize > 1) {
                    if (packing_is_vec4_padded(packing))
                        size = type.vecsize * 4 * base_alignment;
                    else if (type.columns === 3)
                        size = type.vecsize * 4 * base_alignment;
                    else
                        size = type.vecsize * type.columns * base_alignment;
                }

                // For matrices in HLSL, the last element has a size which depends on its vector size,
                // so that it is possible to pack other vectors into the last element.
                /*if (this.packing_is_hlsl(packing) && type.columns > 1)
                    size -= (4 - type.vecsize) * (type.width / 8);*/
            }
        }

        return size;
    }

    protected bitcast_glsl_op(out_type: SPIRType, in_type: SPIRType): string
    {
        // OpBitcast can deal with pointers.
        if (out_type.pointer || in_type.pointer) {
            if (out_type.vecsize === 2 || in_type.vecsize === 2)
                this.require_extension_internal("GL_EXT_buffer_reference_uvec2");
            return this.type_to_glsl(out_type);
        }

        if (out_type.basetype === in_type.basetype)
            return "";

        const options = this.options;

        console.assert(out_type.basetype !== SPIRTypeBaseType.Boolean);
        console.assert(in_type.basetype !== SPIRTypeBaseType.Boolean);

        const integral_cast = type_is_integral(out_type) && type_is_integral(in_type);
        const same_size_cast = out_type.width === in_type.width;

        // Trivial bitcast case, casts between integers.
        if (integral_cast && same_size_cast)
            return this.type_to_glsl(out_type);

        // Catch-all 8-bit arithmetic casts (GL_EXT_shader_explicit_arithmetic_types).
        if (out_type.width === 8 && in_type.width >= 16 && integral_cast && in_type.vecsize === 1)
            return "unpack8";
        else if (in_type.width === 8 && out_type.width === 16 && integral_cast && out_type.vecsize === 1)
            return "pack16";
        else if (in_type.width === 8 && out_type.width === 32 && integral_cast && out_type.vecsize === 1)
            return "pack32";

        // Floating <-> Integer special casts. Just have to enumerate all cases. :(
        // 16-bit, 32-bit and 64-bit floats.
        if (out_type.basetype === SPIRTypeBaseType.UInt && in_type.basetype === SPIRTypeBaseType.Float) {
            if (this.is_legacy_es())
                throw new Error("Float -> Uint bitcast not supported on legacy ESSL.");
            else if (!options.es && options.version < 330)
                this.require_extension_internal("GL_ARB_shader_bit_encoding");
            return "floatBitsToUint";
        }
        else if (out_type.basetype === SPIRTypeBaseType.Int && in_type.basetype === SPIRTypeBaseType.Float) {
            if (this.is_legacy_es())
                throw new Error("Float -> Int bitcast not supported on legacy ESSL.");
            else if (!options.es && options.version < 330)
                this.require_extension_internal("GL_ARB_shader_bit_encoding");
            return "floatBitsToInt";
        }
        else if (out_type.basetype === SPIRTypeBaseType.Float && in_type.basetype === SPIRTypeBaseType.UInt) {
            if (this.is_legacy_es())
                throw new Error("Uint -> Float bitcast not supported on legacy ESSL.");
            else if (!options.es && options.version < 330)
                this.require_extension_internal("GL_ARB_shader_bit_encoding");
            return "uintBitsToFloat";
        }
        else if (out_type.basetype === SPIRTypeBaseType.Float && in_type.basetype === SPIRTypeBaseType.Int) {
            if (this.is_legacy_es())
                throw new Error("Int -> Float bitcast not supported on legacy ESSL.");
            else if (!options.es && options.version < 330)
                this.require_extension_internal("GL_ARB_shader_bit_encoding");
            return "intBitsToFloat";
        }

        else if (out_type.basetype === SPIRTypeBaseType.Int64 && in_type.basetype === SPIRTypeBaseType.Double)
            return "doubleBitsToInt64";
        else if (out_type.basetype === SPIRTypeBaseType.UInt64 && in_type.basetype === SPIRTypeBaseType.Double)
            return "doubleBitsToUint64";
        else if (out_type.basetype === SPIRTypeBaseType.Double && in_type.basetype === SPIRTypeBaseType.Int64)
            return "int64BitsToDouble";
        else if (out_type.basetype === SPIRTypeBaseType.Double && in_type.basetype === SPIRTypeBaseType.UInt64)
            return "uint64BitsToDouble";
        else if (out_type.basetype === SPIRTypeBaseType.Short && in_type.basetype === SPIRTypeBaseType.Half)
            return "float16BitsToInt16";
        else if (out_type.basetype === SPIRTypeBaseType.UShort && in_type.basetype === SPIRTypeBaseType.Half)
            return "float16BitsToUint16";
        else if (out_type.basetype === SPIRTypeBaseType.Half && in_type.basetype === SPIRTypeBaseType.Short)
            return "int16BitsToFloat16";
        else if (out_type.basetype === SPIRTypeBaseType.Half && in_type.basetype === SPIRTypeBaseType.UShort)
            return "uint16BitsToFloat16";

        // And finally, some even more special purpose casts.
        if (out_type.basetype === SPIRTypeBaseType.UInt64 && in_type.basetype === SPIRTypeBaseType.UInt && in_type.vecsize === 2)
            return "packUint2x32";
        else if (out_type.basetype === SPIRTypeBaseType.UInt && in_type.basetype === SPIRTypeBaseType.UInt64 && out_type.vecsize === 2)
            return "unpackUint2x32";
        else if (out_type.basetype === SPIRTypeBaseType.Half && in_type.basetype === SPIRTypeBaseType.UInt && in_type.vecsize === 1)
            return "unpackFloat2x16";
        else if (out_type.basetype === SPIRTypeBaseType.UInt && in_type.basetype === SPIRTypeBaseType.Half && in_type.vecsize === 2)
            return "packFloat2x16";
        else if (out_type.basetype === SPIRTypeBaseType.Int && in_type.basetype === SPIRTypeBaseType.Short && in_type.vecsize === 2)
            return "packInt2x16";
        else if (out_type.basetype === SPIRTypeBaseType.Short && in_type.basetype === SPIRTypeBaseType.Int && in_type.vecsize === 1)
            return "unpackInt2x16";
        else if (out_type.basetype === SPIRTypeBaseType.UInt && in_type.basetype === SPIRTypeBaseType.UShort && in_type.vecsize === 2)
            return "packUint2x16";
        else if (out_type.basetype === SPIRTypeBaseType.UShort && in_type.basetype === SPIRTypeBaseType.UInt && in_type.vecsize === 1)
            return "unpackUint2x16";
        else if (out_type.basetype === SPIRTypeBaseType.Int64 && in_type.basetype === SPIRTypeBaseType.Short && in_type.vecsize === 4)
            return "packInt4x16";
        else if (out_type.basetype === SPIRTypeBaseType.Short && in_type.basetype === SPIRTypeBaseType.Int64 && in_type.vecsize === 1)
            return "unpackInt4x16";
        else if (out_type.basetype === SPIRTypeBaseType.UInt64 && in_type.basetype === SPIRTypeBaseType.UShort && in_type.vecsize === 4)
            return "packUint4x16";
        else if (out_type.basetype === SPIRTypeBaseType.UShort && in_type.basetype === SPIRTypeBaseType.UInt64 && in_type.vecsize === 1)
            return "unpackUint4x16";

        return "";
    }

    protected bitcast_glsl(result_type: SPIRType, argument: number): string
    {
        const op = this.bitcast_glsl_op(result_type, this.expression_type(argument));
        if (op === "")
            return this.to_enclosed_unpacked_expression(argument);
        else
            return op + "(" + this.to_unpacked_expression(argument) + ")";
    }

    protected bitcast_expression(target_type: SPIRTypeBaseType, args: number): string
    protected bitcast_expression(target_type: SPIRType, expr_type: SPIRTypeBaseType, expr: string): string
    protected bitcast_expression(target_type: SPIRType | SPIRTypeBaseType, arg: SPIRTypeBaseType | number, expr?: string): string
    {
        if (expr === undefined) {
            // first overload
            target_type = <SPIRTypeBaseType>target_type;
            expr = this.to_expression(arg);
            const src_type = this.expression_type(arg);
            if (src_type.basetype !== target_type) {
                const target = src_type;
                target.basetype = target_type;
                expr = this.bitcast_glsl_op(target, src_type) + "(" + expr + ")";
            }

            return expr;
        }
        else {
            target_type = <SPIRType>target_type;
            const expr_type = <SPIRTypeBaseType>arg;
            // second overload
            if (target_type.basetype === expr_type)
                return expr;

            const src_type = target_type;
            src_type.basetype = expr_type;
            return this.bitcast_glsl_op(target_type, src_type) + "(" + expr + ")";
        }

    }

    protected remove_duplicate_swizzle(op: string): string
    {
        const pos = op.lastIndexOf(".");
        // either not present, or the first
        if (pos <= 0)
            return op;

        const final_swiz = op.substring(pos + 1);

        if (this.backend.swizzle_is_function) {
            if (final_swiz.length < 2)
                return op;

            if (final_swiz.substring(final_swiz.length - 2) === "()")
                final_swiz.substring(0, final_swiz.length - 2);
            else
                return op;
        }

        // Check if final swizzle is of form .x, .xy, .xyz, .xyzw or similar.
        // If so, and previous swizzle is of same length,
        // we can drop the final swizzle altogether.
        for (let i = 0; i < final_swiz.length; i++) {

            if (i >= 4 || final_swiz[i] !== expectedVecComps[i])
                return op;
        }

        let prevpos = op.lastIndexOf(".", pos - 1);
        if (prevpos < 0)
            return op;

        prevpos++;

        // Make sure there are only swizzles here ...
        for (let i = prevpos; i < pos; i++) {
            if (op[i] < "w" || op[i] > "z") {
                // If swizzles are foo.xyz() like in C++ backend for example, check for that.
                if (this.backend.swizzle_is_function && i + 2 === pos && op[i] === "(" && op[i + 1] === ")")
                    break;

                return op;
            }
        }

        // If original swizzle is large enough, just carve out the components we need.
        // E.g. foobar.wyx.xy will turn into foobar.wy.
        if (pos - prevpos >= final_swiz.length) {
            op = op.substring(0, prevpos + final_swiz.length);

            // Add back the function call ...
            if (this.backend.swizzle_is_function)
                op += "()";
        }
        return op;
    }

    protected replace_illegal_names(keywords_: Set<string> = keywords)
    {
        const ir = this.ir;
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            if (this.is_hidden_variable(var_))
                return;

            const meta = ir.find_meta(var_.self);
            if (!meta)
                return;

            const m = meta.decoration;
            if (keywords_.has(m.alias))
                m.alias = "_" + m.alias;
        });

        ir.for_each_typed_id<SPIRFunction>(SPIRFunction, (_, func) =>
        {
            const meta = ir.find_meta(func.self);
            if (!meta)
                return;

            const m = meta.decoration;
            if (keywords_.has(m.alias))
                m.alias = "_" + m.alias;
        });

        ir.for_each_typed_id<SPIRType>(SPIRType, (_, type) =>
        {
            const meta = ir.find_meta(type.self);
            if (!meta)
                return;

            const m = meta.decoration;
            if (keywords_.has(m.alias))
                m.alias = "_" + m.alias;

            for (let memb of meta.members)
                if (keywords_.has(memb.alias))
                    memb.alias = "_" + memb.alias;
        });
    };

    protected replace_fragment_output(var_: SPIRVariable)
    {
        const ir = this.ir;
        const m = maplike_get(Meta, ir.meta, var_.self).decoration;
        let location = 0;
        if (m.decoration_flags.get(Decoration.DecorationLocation))
            location = m.location;

        // If our variable is arrayed, we must not emit the array part of this as the SPIR-V will
        // do the access chain part of this for us.
        const type = this.get<SPIRType>(SPIRType, var_.basetype);

        if (type.array.length === 0) {
            // Redirect the write to a specific render target in legacy GLSL.
            m.alias = `gl_FragData[${location}]`;

            if (this.is_legacy_es() && location !== 0)
                this.require_extension_internal("GL_EXT_draw_buffers");
        }
        else if (type.array.length === 1) {
            // If location is non-zero, we probably have to add an offset.
            // This gets really tricky since we'd have to inject an offset in the access chain.
            // FIXME: This seems like an extremely odd-ball case, so it's probably fine to leave it like this for now.
            m.alias = "gl_FragData";
            if (location !== 0)
                throw new Error("Arrayed output variable used, but location is not 0. This is unimplemented in SPIRV-Cross.");

            if (this.is_legacy_es())
                this.require_extension_internal("GL_EXT_draw_buffers");
        }
        else
            throw new Error("Array-of-array output variable used. This cannot be implemented in legacy GLSL.");

        var_.compat_builtin = true; // We don't want to declare this variable, but use the name as-is.
    }

    protected replace_fragment_outputs()
    {
        this.ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);

            if (!this.is_builtin_variable(var_) && !var_.remapped_variable && type.pointer && var_.storage === StorageClass.StorageClassOutput)
                this.replace_fragment_output(var_);
        });
    }

    protected load_flattened_struct(basename: string, type: SPIRType): string
    {
        let expr = this.type_to_glsl_constructor(type);
        expr += "(";

        for (let i = 0; i < type.member_types.length; i++) {
            if (i)
                expr += ", ";

            let member_type = this.get<SPIRType>(SPIRType, type.member_types[i]);
            if (member_type.basetype === SPIRTypeBaseType.Struct)
                expr += this.load_flattened_struct(this.to_flattened_struct_member(basename, type, i), member_type);
            else
                expr += this.to_flattened_struct_member(basename, type, i);
        }
        expr += ")";
        return expr;
    }

    protected to_flattened_struct_member(basename: string, type: SPIRType, index: number): string
    {
        const ret = basename + "_" + this.to_member_name(type, index);
        ParsedIR.sanitize_underscores(ret);
        return ret;
    }

    protected track_expression_read(id: number)
    {
        const ir = this.ir;
        switch (ir.ids[id].get_type()) {
            case Types.TypeExpression: {
                const e = this.get<SPIRExpression>(SPIRExpression, id);
                for (let implied_read of e.implied_read_expressions)
                    this.track_expression_read(implied_read);
                break;
            }

            case Types.TypeAccessChain: {
                const e = this.get<SPIRAccessChain>(SPIRAccessChain, id);
                for (let implied_read of e.implied_read_expressions)
                    this.track_expression_read(implied_read);
                break;
            }

            default:
                break;
        }

        // If we try to read a forwarded temporary more than once we will stamp out possibly complex code twice.
        // In this case, it's better to just bind the complex expression to the temporary and read that temporary twice.
        if (this.expression_is_forwarded(id) && !this.expression_suppresses_usage_tracking(id)) {
            let v = maplike_get(0, this.expression_usage_counts, id);
            v++;

            // If we create an expression outside a loop,
            // but access it inside a loop, we're implicitly reading it multiple times.
            // If the expression in question is expensive, we should hoist it out to avoid relying on loop-invariant code motion
            // working inside the backend compiler.
            if (this.expression_read_implies_multiple_reads(id))
                v++;

            if (v >= 2) {
                //if (v === 2)
                //    fprintf(stderr, "ID %u was forced to temporary due to more than 1 expression use!\n", id);

                this.forced_temporaries.add(id);
                // Force a recompile after this pass to avoid forwarding this variable.
                this.force_recompile();
            }
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

    protected pls_decl(var_: PlsRemap): string
    {
        const variable = this.get<SPIRVariable>(SPIRVariable, var_.id);

        const type: SPIRType = new SPIRType();
        type.vecsize = pls_format_to_components(var_.format);
        type.basetype = pls_format_to_basetype(var_.format);

        return to_pls_layout(var_.format) + this.to_pls_qualifiers_glsl(variable) + this.type_to_glsl(type) + " " +
            this.to_name(variable.self);
    }

    protected to_pls_qualifiers_glsl(variable: SPIRVariable): string
    {
    const flags = maplike_get(Meta, this.ir.meta, variable.self).decoration.decoration_flags;
    if (flags.get(Decoration.DecorationRelaxedPrecision))
        return "mediump ";
    else
        return "highp ";
    }

    protected emit_pls()
    {
        const execution = this.get_entry_point();
        const options = this.options;

        if (execution.model !== ExecutionModel.ExecutionModelFragment)
            throw new Error("Pixel local storage only supported in fragment shaders.");

        if (!options.es)
            throw new Error("Pixel local storage only supported in OpenGL ES.");

        if (options.version < 300)
            throw new Error("Pixel local storage only supported in ESSL 3.0 and above.");

        if (this.pls_inputs.length > 0) {
            this.statement("__pixel_local_inEXT _PLSIn");
            this.begin_scope();
            for (let input of this.pls_inputs)
                this.statement(this.pls_decl(input), ";");
            this.end_scope_decl();
            this.statement("");
        }

        if (this.pls_outputs.length > 0) {
            this.statement("__pixel_local_outEXT _PLSOut");
            this.begin_scope();
            for (let output of this.pls_outputs)
                this.statement(this.pls_decl(output), ";");
            this.end_scope_decl();
            this.statement("");
        }
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

    protected location_is_framebuffer_fetch(location: number): boolean
    {
        return !!this.inout_color_attachments.find(elem => elem.first === location);
    }

    protected location_is_non_coherent_framebuffer_fetch(location: number): boolean
    {
        return !!this.inout_color_attachments.find(elem => elem.first === location && !elem.second);
    }

    protected subpass_input_is_framebuffer_fetch(id: number): boolean
    {
        if (!this.has_decoration(id, Decoration.DecorationInputAttachmentIndex))
            return false;

        const input_attachment_index = this.get_decoration(id, Decoration.DecorationInputAttachmentIndex);
        for (let remap of this.subpass_to_framebuffer_fetch_attachment)
            if (remap.first === input_attachment_index)
                return true;

        return false;
    }

    emit_inout_fragment_outputs_copy_to_subpass_inputs()
    {
        for (let remap of this.subpass_to_framebuffer_fetch_attachment) {
            const subpass_var = this.find_subpass_input_by_attachment_index(remap.first);
            const output_var = this.find_color_output_by_location(remap.second);
            if (!subpass_var)
                continue;
            if (!output_var)
                throw new Error("Need to declare the corresponding fragment output variable to be able to read from" +
                    " it.");
            if (this.is_array(this.get<SPIRType>(SPIRType, output_var.basetype)))
                throw new Error("Cannot use GL_EXT_shader_framebuffer_fetch with arrays of color outputs.");

            const func = this.get<SPIRFunction>(SPIRFunction, this.get_entry_point().self);
            func.fixup_hooks_in.push(() =>
            {
                if (this.is_legacy()) {
                    this.statement(this.to_expression(subpass_var.self), " = ", "gl_LastFragData[",
                        this.get_decoration(output_var.self, Decoration.DecorationLocation), "];");
                }
                else {
                    const num_rt_components = this.get<SPIRType>(SPIRType, output_var.basetype).vecsize;
                    this.statement(this.to_expression(subpass_var.self), this.vector_swizzle(num_rt_components, 0), " = ",
                        this.to_expression(output_var.self), ";");
                }
            });
        }
    }

    find_subpass_input_by_attachment_index(index: number): SPIRVariable
    {
        let ret: SPIRVariable = null;
        this.ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            if (this.has_decoration(var_.self, Decoration.DecorationInputAttachmentIndex) &&
                this.get_decoration(var_.self, Decoration.DecorationInputAttachmentIndex) === index) {
                ret = var_;
            }
        });
        return ret;
    }

    find_color_output_by_location(location: number): SPIRVariable
    {
        let ret = null;
        this.ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_: SPIRVariable) =>
        {
            if (var_.storage === StorageClass.StorageClassOutput && this.get_decoration(var_.self, Decoration.DecorationLocation) === location)
                ret = var_;
        });
        return ret;
    }

    // A variant which takes two sets of name. The secondary is only used to verify there are no collisions,
    // but the set is not updated when we have found a new name.
    // Used primarily when adding block interface names.
    protected add_variable(variables_primary: Set<string>, variables_secondary: Set<string>, name: string): string
    {
        if (name === "")
            return;

        name = ParsedIR.sanitize_underscores(name);
        if (ParsedIR.is_globally_reserved_identifier(name, true)) {
            name = "";
            return;
        }

        name = this.update_name_cache(variables_primary, variables_secondary, name);

        return name;
    }

    handle_invalid_expression(id: number)
    {
        // We tried to read an invalidated expression.
        // This means we need another pass at compilation, but next time, force temporary variables so that they cannot be invalidated.
        this.forced_temporaries.add(id);
        this.force_recompile();
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
        this.find_static_extensions();
        this.fixup_image_load_store_access();
        this.update_active_builtins();
        this.analyze_image_and_sampler_usage();
        this.analyze_interlocked_resource_usage();
        if (this.inout_color_attachments.length > 0)
            this.emit_inout_fragment_outputs_copy_to_subpass_inputs();


        // Shaders might cast unrelated data to pointers of non-block types.
        // Find all such instances and make sure we can cast the pointers to a synthesized block type.
        if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT)
            this.analyze_non_block_pointer_types();

        let pass_count = 0;
        do {
            if (pass_count >= 3)
                throw new Error("Over 3 compilation loops detected. Must be a bug!");

            this.reset();

            this.buffer.reset();

            this.emit_header();
            this.emit_resources();
            // this.emit_extension_workarounds(this.get_execution_model());

            // this.emit_function(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), new Bitset());

            pass_count++;
        } while (this.is_forcing_recompilation());

        /*
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

        // Entry point in GLSL is always main().*/
        this.get_entry_point().name = "main";

        return this.buffer.str();
    }

    protected find_static_extensions()
    {
        const ir = this.ir;
        const options = this.options;

        ir.for_each_typed_id<SPIRType>(SPIRType, (_, type) =>
        {
            if (type.basetype === SPIRTypeBaseType.Double) {
                if (options.es)
                    throw new Error("FP64 not supported in ES profile.");

                if (!options.es && options.version < 400)
                    this.require_extension_internal("GL_ARB_gpu_shader_fp64");
            }
            else if (type.basetype === SPIRTypeBaseType.Int64 || type.basetype === SPIRTypeBaseType.UInt64) {
                if (options.es)
                    throw new Error("64-bit integers not supported in ES profile.");
                if (!options.es)
                    this.require_extension_internal("GL_ARB_gpu_shader_int64");
            }
            else if (type.basetype === SPIRTypeBaseType.Half) {
                this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_float16");
                // if (options.vulkan_semantics)
                //     require_extension_internal("GL_EXT_shader_16bit_storage");
            }
            else if (type.basetype === SPIRTypeBaseType.SByte || type.basetype === SPIRTypeBaseType.UByte) {
                this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_int8");
                // if (options.vulkan_semantics)
                //     require_extension_internal("GL_EXT_shader_8bit_storage");
            }
            else if (type.basetype === SPIRTypeBaseType.Short || type.basetype === SPIRTypeBaseType.UShort) {
                this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_int16");
                // if (options.vulkan_semantics)
                //     require_extension_internal("GL_EXT_shader_16bit_storage");
            }
        });

        const execution = this.get_entry_point();
        switch (execution.model) {
            case ExecutionModel.ExecutionModelGLCompute:
                throw new Error("Compute shaders are not supported!");
            /*if (!options.es && options.version < 430)
                this.require_extension_internal("GL_ARB_compute_shader");
            if (options.es && options.version < 310)
                throw new Error("At least ESSL 3.10 required for compute shaders.");
            break;*/

            case ExecutionModel.ExecutionModelGeometry:
                throw new Error("Geometry shaders are not supported!");
            /*if (options.es && options.version < 320)
                this.require_extension_internal("GL_EXT_geometry_shader");
            if (!options.es && options.version < 150)
                this.require_extension_internal("GL_ARB_geometry_shader4");

            if (execution.flags.get(ExecutionMode.ExecutionModeInvocations) && execution.invocations !== 1)
            {
                // Instanced GS is part of 400 core or this extension.
                if (!options.es && options.version < 400)
                    this.require_extension_internal("GL_ARB_gpu_shader5");
            }
            break;*/

            case ExecutionModel.ExecutionModelTessellationEvaluation:
            case ExecutionModel.ExecutionModelTessellationControl:
                throw new Error("Tessellation shaders are not supported!");
            /*if (options.es && options.version < 320)
                this.require_extension_internal("GL_EXT_tessellation_shader");
            if (!options.es && options.version < 400)
                this.require_extension_internal("GL_ARB_tessellation_shader");
            break;*/

            case ExecutionModel.ExecutionModelRayGenerationKHR:
            case ExecutionModel.ExecutionModelIntersectionKHR:
            case ExecutionModel.ExecutionModelAnyHitKHR:
            case ExecutionModel.ExecutionModelClosestHitKHR:
            case ExecutionModel.ExecutionModelMissKHR:
            case ExecutionModel.ExecutionModelCallableKHR:
            // NV enums are aliases.
            /*if (options.es || options.version < 460)
                throw new Error("Ray tracing shaders require non-es profile with version 460 or above.");
            if (!options.vulkan_semantics)
                throw new Error("Ray tracing requires Vulkan semantics.");

            // Need to figure out if we should target KHR or NV extension based on capabilities.
            for (const cap of ir.declared_capabilities)
            {
                if (cap === Capability.CapabilityRayTracingKHR || cap === Capability.CapabilityRayQueryKHR ||
                    cap === Capability.CapabilityRayTraversalPrimitiveCullingKHR)
                {
                    this.ray_tracing_is_khr = true;
                    break;
                }
            }

            if (this.ray_tracing_is_khr)
            {
                // In KHR ray tracing we pass payloads by pointer instead of location,
                // so make sure we assign locations properly.
                this.ray_tracing_khr_fixup_locations();
                this.require_extension_internal("GL_EXT_ray_tracing");
            }
            else
                this.require_extension_internal("GL_NV_ray_tracing");
            break;*/

            default:
                break;
        }

        if (this.pls_inputs.length !== 0 || this.pls_outputs.length !== 0) {
            if (execution.model !== ExecutionModel.ExecutionModelFragment)
                throw new Error("Can only use GL_EXT_shader_pixel_local_storage in fragment shaders.");

            this.require_extension_internal("GL_EXT_shader_pixel_local_storage");
        }

        if (this.inout_color_attachments.length !== 0) {
            if (execution.model !== ExecutionModel.ExecutionModelFragment)
                throw new Error("Can only use GL_EXT_shader_framebuffer_fetch in fragment shaders.");
            // if (options.vulkan_semantics)
            //     throw new Error("Cannot use EXT_shader_framebuffer_fetch in Vulkan GLSL.");

            let has_coherent = false;
            let has_incoherent = false;

            for (let att of this.inout_color_attachments) {
                if (att.second)
                    has_coherent = true;
                else
                    has_incoherent = true;
            }

            if (has_coherent)
                this.require_extension_internal("GL_EXT_shader_framebuffer_fetch");
            if (has_incoherent)
                this.require_extension_internal("GL_EXT_shader_framebuffer_fetch_non_coherent");
        }

        if (options.separate_shader_objects && !options.es && options.version < 410)
            this.require_extension_internal("GL_ARB_separate_shader_objects");

        if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT) {
            // if (!options.vulkan_semantics)
            throw new Error("GL_EXT_buffer_reference is only supported in Vulkan GLSL.");
            if (options.es && options.version < 320)
                throw new Error("GL_EXT_buffer_reference requires ESSL 320.");
            else if (!options.es && options.version < 450)
                throw new Error("GL_EXT_buffer_reference requires GLSL 450.");
            this.require_extension_internal("GL_EXT_buffer_reference");
        }
        else if (ir.addressing_model !== AddressingModel.AddressingModelLogical) {
            throw new Error("Only Logical and PhysicalStorageBuffer64EXT addressing models are supported.");
        }

        // Check for nonuniform qualifier and passthrough.
        // Instead of looping over all decorations to find this, just look at capabilities.
        for (let cap of ir.declared_capabilities) {
            switch (cap) {
                case Capability.CapabilityShaderNonUniformEXT:
                    throw new Error("CapabilityShaderNonUniformEXT not supported");
                    /*if (!options.vulkan_semantics)
                        this.require_extension_internal("GL_NV_gpu_shader5");
                    else
                         require_extension_internal("GL_EXT_nonuniform_qualifier");*/
                    break;
                case Capability.CapabilityRuntimeDescriptorArrayEXT:
                    throw new Error("CapabilityRuntimeDescriptorArrayEXT not supported");
                /*if (!options.vulkan_semantics)
                    throw new Error("GL_EXT_nonuniform_qualifier is only supported in Vulkan GLSL.");
                this.require_extension_internal("GL_EXT_nonuniform_qualifier");
                break;*/

                case Capability.CapabilityGeometryShaderPassthroughNV:
                    throw new Error("GeometryShaderPassthroughNV capability not supported");
                /*if (execution.model === ExecutionModelGeometry)
                {
                    require_extension_internal("GL_NV_geometry_shader_passthrough");
                    execution.geometry_passthrough = true;
                }
                break;*/

                case Capability.CapabilityVariablePointers:
                case Capability.CapabilityVariablePointersStorageBuffer:
                    throw new Error("VariablePointers capability is not supported in GLSL.");

                case Capability.CapabilityMultiView:
                    throw new Error("MultiView capability is not supported in GLSL.");
                /*if (options.vulkan_semantics)
                    require_extension_internal("GL_EXT_multiview");
                else
                {
                    require_extension_internal("GL_OVR_multiview2");
                    if (options.ovr_multiview_view_count === 0)
                        throw new Error("ovr_multiview_view_count must be non-zero when using GL_OVR_multiview2.");
                    if (get_execution_model() !== ExecutionModelVertex)
                        throw new Error("OVR_multiview2 can only be used with Vertex shaders.");
                }
                break;*/

                case Capability.CapabilityRayQueryKHR:
                    throw new Error("RayQuery capability is not supported.");
                /*if (options.es || options.version < 460 || !options.vulkan_semantics)
                    throw new Error("RayQuery requires Vulkan GLSL 460.");
                require_extension_internal("GL_EXT_ray_query");
                ray_tracing_is_khr = true;
                break;*/

                case Capability.CapabilityRayTraversalPrimitiveCullingKHR:
                    throw new Error("RayTraversalPrimitiveCulling capability is not supported.");
                /*if (options.es || options.version < 460 || !options.vulkan_semantics)
                    throw new Error("RayQuery requires Vulkan GLSL 460.");
                require_extension_internal("GL_EXT_ray_flags_primitive_culling");
                ray_tracing_is_khr = true;
                break;*/

                default:
                    break;
            }
        }

        if (options.ovr_multiview_view_count) {
            throw new Error("OVR_multiview2 is not supported");
            /*if (options.vulkan_semantics)
                throw new Error("OVR_multiview2 cannot be used with Vulkan semantics.");
            if (get_execution_model() !== ExecutionModelVertex)
                throw new Error("OVR_multiview2 can only be used with Vertex shaders.");
            require_extension_internal("GL_OVR_multiview2");*/
        }
    }

    protected fixup_image_load_store_access()
    {
        if (!this.options.enable_storage_image_qualifier_deduction)
            return;

        this.ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (var_, _) =>
        {
            const vartype = this.expression_type(var_);
            if (vartype.basetype === SPIRTypeBaseType.Image && vartype.image.sampled === 2) {
                // Very old glslangValidator and HLSL compilers do not emit required qualifiers here.
                // Solve this by making the image access as restricted as possible and loosen up if we need to.
                // If any no-read/no-write flags are actually set, assume that the compiler knows what it's doing.

                const flags = maplike_get(Meta, this.ir.meta, var_).decoration.decoration_flags;
                if (!flags.get(Decoration.DecorationNonWritable) && !flags.get(Decoration.DecorationNonReadable)) {
                    flags.set(Decoration.DecorationNonWritable);
                    flags.set(Decoration.DecorationNonReadable);
                }
            }
        });
    }

    protected type_is_empty(type: SPIRType)
    {
        return type.basetype === SPIRTypeBaseType.Struct && type.member_types.length === 0;
    }

    protected declare_undefined_values()
    {
        let emitted = false;
        this.ir.for_each_typed_id<SPIRUndef>(SPIRUndef, (_, undef) =>
        {
            const type = this.get<SPIRType>(SPIRType, undef.basetype);
            // OpUndef can be void for some reason ...
            if (type.basetype === SPIRTypeBaseType.Void)
                return;

            let initializer = "";
            if (this.options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                initializer = " = " + this.to_zero_initialized_expression(undef.basetype);

            this.statement(this.variable_decl(type, this.to_name(undef.self), undef.self), initializer, ";");
            emitted = true;
        });

        if (emitted)
            this.statement("");
    }

    protected can_use_io_location(storage: StorageClass, block: boolean): boolean
    {
        const { options } = this;
// Location specifiers are must have in SPIR-V, but they aren't really supported in earlier versions of GLSL.
        // Be very explicit here about how to solve the issue.
        if ((this.get_execution_model() !== ExecutionModel.ExecutionModelVertex && storage === StorageClass.StorageClassInput) ||
            (this.get_execution_model() !== ExecutionModel.ExecutionModelFragment && storage === StorageClass.StorageClassOutput)) {
            const minimum_desktop_version = block ? 440 : 410;
            // ARB_enhanced_layouts vs ARB_separate_shader_objects ...

            if (!options.es && options.version < minimum_desktop_version && !options.separate_shader_objects)
                return false;
            else if (options.es && options.version < 310)
                return false;
        }

        if ((this.get_execution_model() === ExecutionModel.ExecutionModelVertex && storage === StorageClass.StorageClassInput) ||
            (this.get_execution_model() === ExecutionModel.ExecutionModelFragment && storage === StorageClass.StorageClassOutput)) {
            if (options.es && options.version < 300)
                return false;
            else if (!options.es && options.version < 330)
                return false;
        }

        if (storage === StorageClass.StorageClassUniform || storage === StorageClass.StorageClassUniformConstant || storage === StorageClass.StorageClassPushConstant) {
            if (options.es && options.version < 310)
                return false;
            else if (!options.es && options.version < 430)
                return false;
        }

        return true;
    }

    protected convert_half_to_string(c: SPIRConstant, col: number, row: number): string
    {
        let res;
        const float_value = c.scalar_f16(col, row);

        // There is no literal "hf" in GL_NV_gpu_shader5, so to avoid lots
        // of complicated workarounds, just value-cast to the half type always.
        if (isNaN(float_value) || float_value === Number.POSITIVE_INFINITY || float_value === Number.NEGATIVE_INFINITY) {
            const type = new SPIRType();
            type.basetype = SPIRTypeBaseType.Half;
            type.vecsize = 1;
            type.columns = 1;

            if (float_value === Number.POSITIVE_INFINITY)
                res = this.type_to_glsl(type) + "(1.0 / 0.0)";
            else if (float_value === Number.NEGATIVE_INFINITY)
                res = this.type_to_glsl(type) + "(-1.0 / 0.0)";
            else if (isNaN(float_value))
                res = this.type_to_glsl(type) + "(0.0 / 0.0)";
            else
                throw new Error("Cannot represent non-finite floating point constant.");
        }
        else {
            const type = new SPIRType();
            type.basetype = SPIRTypeBaseType.Half;
            type.vecsize = 1;
            type.columns = 1;
            res = this.type_to_glsl(type) + "(" + convert_to_string(float_value) + ")";
        }

        return res;
    }

    protected convert_float_to_string(c: SPIRConstant, col: number, row: number): string
    {
        let res;
        const float_value = c.scalar_f32(col, row);

        const backend = this.backend;

        if (isNaN(float_value) || float_value === Number.POSITIVE_INFINITY || float_value === Number.NEGATIVE_INFINITY) {
            // Use special representation.
            if (!this.is_legacy()) {
                const out_type = new SPIRType();
                const in_type = new SPIRType();
                out_type.basetype = SPIRTypeBaseType.Float;
                in_type.basetype = SPIRTypeBaseType.UInt;
                out_type.vecsize = 1;
                in_type.vecsize = 1;
                out_type.width = 32;
                in_type.width = 32;

                const print_buffer = "0x" + c.scalar(col, row) + "u";

                let comment: string = "inf";
                if (float_value === Number.NEGATIVE_INFINITY)
                    comment = "-inf";
                else if (isNaN(float_value))
                    comment = "nan";
                res = this.bitcast_glsl_op(out_type, in_type) + `(${print_buffer} /* ${comment} */)`;
            }
            else {
                if (float_value === Number.POSITIVE_INFINITY) {
                    if (backend.float_literal_suffix)
                        res = "(1.0f / 0.0f)";
                    else
                        res = "(1.0 / 0.0)";
                }
                else if (float_value === Number.NEGATIVE_INFINITY) {
                    if (backend.float_literal_suffix)
                        res = "(-1.0f / 0.0f)";
                    else
                        res = "(-1.0 / 0.0)";
                }
                else if (isNaN(float_value)) {
                    if (backend.float_literal_suffix)
                        res = "(0.0f / 0.0f)";
                    else
                        res = "(0.0 / 0.0)";
                }
                else
                    throw new Error("Cannot represent non-finite floating point constant.");
            }
        }
        else {
            res = convert_to_string(float_value);
            if (backend.float_literal_suffix)
                res += "f";
        }

        return res;
    }

    protected convert_double_to_string(c: SPIRConstant, col: number, row: number): string
    {
        let res;
        const double_value = c.scalar_f64(col, row);
        const options = this.options;
        const backend = this.backend;

        if (isNaN(double_value) || isNaN(double_value)) {
            // Use special representation.
            if (!this.is_legacy()) {
                const out_type = new SPIRType();
                const in_type = new SPIRType();
                out_type.basetype = SPIRTypeBaseType.Double;
                in_type.basetype = SPIRTypeBaseType.UInt64;
                out_type.vecsize = 1;
                in_type.vecsize = 1;
                out_type.width = 64;
                in_type.width = 64;

                const u64_value = c.scalar_u64(col, row);

                if (options.es)
                    throw new Error("64-bit integers/float not supported in ES profile.");
                this.require_extension_internal("GL_ARB_gpu_shader_int64");

                const print_buffer = "0x" + u64_value.toString() + backend.long_long_literal_suffix ? "ull" : "ul";

                let comment = "inf";
                if (double_value === Number.POSITIVE_INFINITY)
                    comment = "-inf";
                else if (isNaN(double_value))
                    comment = "nan";
                res = this.bitcast_glsl_op(out_type, in_type) + `(${print_buffer} /* ${comment} */)`;
            }
            else {
                if (options.es)
                    throw new Error("FP64 not supported in ES profile.");
                if (options.version < 400)
                    this.require_extension_internal("GL_ARB_gpu_shader_fp64");

                if (double_value === Number.POSITIVE_INFINITY) {
                    if (backend.double_literal_suffix)
                        res = "(1.0lf / 0.0lf)";
                    else
                        res = "(1.0 / 0.0)";
                }
                else if (double_value === Number.NEGATIVE_INFINITY) {
                    if (backend.double_literal_suffix)
                        res = "(-1.0lf / 0.0lf)";
                    else
                        res = "(-1.0 / 0.0)";
                }
                else if (isNaN(double_value)) {
                    if (backend.double_literal_suffix)
                        res = "(0.0lf / 0.0lf)";
                    else
                        res = "(0.0 / 0.0)";
                }
                else
                    throw new Error("Cannot represent non-finite floating point constant.");
            }
        }
        else {
            res = convert_to_string(double_value);
            if (backend.double_literal_suffix)
                res += "lf";
        }

        return res;
    }

    protected variable_is_lut(var_: SPIRVariable): boolean
    {
        const statically_assigned = var_.statically_assigned && var_.static_expression !== <ID>(0) && var_.remapped_variable;

        if (statically_assigned) {
            const constant = this.maybe_get<SPIRConstant>(SPIRConstant, var_.static_expression);
            if (constant && constant.is_used_as_lut)
                return true;
        }

        return false;
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
                    if (other_id === self)
                        return;

                    if (other_type.type_alias === type.type_alias)
                        other_type.type_alias = self;
                });

                this.get<SPIRType>(SPIRType, type.type_alias).type_alias = self;
                type.type_alias = 0;
            }
        });
    }

    protected reorder_type_alias()
    {
        const ir = this.ir;
        // Reorder declaration of types so that the master of the type alias is always emitted first.
        // We need this in case a type B depends on type A (A must come before in the vector), but A is an alias of a type Abuffer, which
        // means declaration of A doesn't happen (yet), and order would be B, ABuffer and not ABuffer, B. Fix this up here.
        const loop_lock = ir.create_loop_hard_lock();

        const type_ids = ir.ids_for_type[Types.TypeType];
        for (let alias_itr of type_ids) {
            const type = this.get<SPIRType>(SPIRType, alias_itr);
            if (type.type_alias !== <TypeID>(0) &&
                !this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked)) {
                // We will skip declaring this type, so make sure the type_alias type comes before.
                const master_itr = type_ids.indexOf(<ID>(type.type_alias));
                console.assert(master_itr >= 0);

                if (alias_itr < master_itr) {
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

    protected vector_swizzle(vecsize: number, index: number): string
    {
        console.assert(vecsize >= 1 && vecsize <= 4);
        console.assert(index >= 0 && index < 4);
        console.assert(swizzle[vecsize - 1][index]);

        return swizzle[vecsize - 1][index];
    }
}

function swap<T>(arr: T[], a: number, b: number)
{
    const t = a[a];
    arr[a] = arr[b];
    arr[b] = t;
}

function is_block_builtin(builtin: BuiltIn)
{
    return builtin === BuiltIn.BuiltInPosition || builtin === BuiltIn.BuiltInPointSize || builtin === BuiltIn.BuiltInClipDistance ||
        builtin === BuiltIn.BuiltInCullDistance;
}

function is_unsigned_opcode(op: Op): boolean
{
    // Don't have to be exhaustive, only relevant for legacy target checking ...
    switch (op) {
        case Op.OpShiftRightLogical:
        case Op.OpUGreaterThan:
        case Op.OpUGreaterThanEqual:
        case Op.OpULessThan:
        case Op.OpULessThanEqual:
        case Op.OpUConvert:
        case Op.OpUDiv:
        case Op.OpUMod:
        case Op.OpUMulExtended:
        case Op.OpConvertUToF:
        case Op.OpConvertFToU:
            return true;

        default:
            return false;
    }
}

function packing_has_flexible_offset(packing: BufferPackingStandard): boolean
{
    switch (packing) {
        case BufferPackingStandard.BufferPackingStd140:
        case BufferPackingStandard.BufferPackingStd430:
        case BufferPackingStandard.BufferPackingScalar:
            // case BufferPackingHLSLCbuffer:
            return false;

        default:
            return true;
    }
}

function packing_to_substruct_packing(packing: BufferPackingStandard): BufferPackingStandard
{
    switch (packing) {
        case BufferPackingStandard.BufferPackingStd140EnhancedLayout:
            return BufferPackingStandard.BufferPackingStd140;
        case BufferPackingStandard.BufferPackingStd430EnhancedLayout:
            return BufferPackingStandard.BufferPackingStd430;
        // case BufferPackingStandard.BufferPackingHLSLCbufferPackOffset:
        // return BufferPackingStandard.BufferPackingHLSLCbuffer;
        case BufferPackingStandard.BufferPackingScalarEnhancedLayout:
            return BufferPackingStandard.BufferPackingScalar;
        default:
            return packing;
    }
}

function packing_is_vec4_padded(packing: BufferPackingStandard): boolean
{
    switch (packing) {
        // case BufferPackingStandard.BufferPackingHLSLCbuffer:
        // case BufferPackingStandard.BufferPackingHLSLCbufferPackOffset:
        case BufferPackingStandard.BufferPackingStd140:
        case BufferPackingStandard.BufferPackingStd140EnhancedLayout:
            return true;

        default:
            return false;
    }
}

function packing_is_scalar(packing: BufferPackingStandard): boolean
{
    switch (packing) {
        case BufferPackingStandard.BufferPackingScalar:
        case BufferPackingStandard.BufferPackingScalarEnhancedLayout:
            return true;

        default:
            return false;
    }
}

function pls_format_to_basetype(format: PlsFormat): SPIRTypeBaseType
{
    switch (format) {
        case PlsFormat.PlsRGBA8I:
        case PlsFormat.PlsRG16I:
            return SPIRTypeBaseType.Int;

        case PlsFormat.PlsRGB10A2UI:
        case PlsFormat.PlsRGBA8UI:
        case PlsFormat.PlsRG16UI:
        case PlsFormat.PlsR32UI:
            return SPIRTypeBaseType.UInt;

        default:
            /*case PlsR11FG11FB10F:
            case PlsR32F:
            case PlsRG16F:
            case PlsRGB10A2:
            case PlsRGBA8:
            case PlsRG16:*/
            return SPIRTypeBaseType.Float;
    }
}

function pls_format_to_components(format: PlsFormat): number
{
    switch (format) {
        default:
        case PlsFormat.PlsR32F:
        case PlsFormat.PlsR32UI:
            return 1;

        case PlsFormat.PlsRG16F:
        case PlsFormat.PlsRG16:
        case PlsFormat.PlsRG16UI:
        case PlsFormat.PlsRG16I:
            return 2;

        case PlsFormat.PlsR11FG11FB10F:
            return 3;

        case PlsFormat.PlsRGB10A2:
        case PlsFormat.PlsRGBA8:
        case PlsFormat.PlsRGBA8I:
        case PlsFormat.PlsRGB10A2UI:
        case PlsFormat.PlsRGBA8UI:
            return 4;
    }
}

function to_pls_layout(format: PlsFormat): string
{
    switch (format) {
        case PlsFormat.PlsR11FG11FB10F:
            return "layout(r11f_g11f_b10f) ";
        case PlsFormat.PlsR32F:
            return "layout(r32f) ";
        case PlsFormat.PlsRG16F:
            return "layout(rg16f) ";
        case PlsFormat.PlsRGB10A2:
            return "layout(rgb10_a2) ";
        case PlsFormat.PlsRGBA8:
            return "layout(rgba8) ";
        case PlsFormat.PlsRG16:
            return "layout(rg16) ";
        case PlsFormat.PlsRGBA8I:
            return "layout(rgba8i)";
        case PlsFormat.PlsRG16I:
            return "layout(rg16i) ";
        case PlsFormat.PlsRGB10A2UI:
            return "layout(rgb10_a2ui) ";
        case PlsFormat.PlsRGBA8UI:
            return "layout(rgba8ui) ";
        case PlsFormat.PlsRG16UI:
            return "layout(rg16ui) ";
        case PlsFormat.PlsR32UI:
            return "layout(r32ui) ";
        default:
            return "";
    }
}