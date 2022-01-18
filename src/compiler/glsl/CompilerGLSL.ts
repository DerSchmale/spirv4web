import { Compiler } from "../Compiler";
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
    StorageClass
} from "../../spirv";
import { Pair } from "../../utils/Pair";
import { SPIRVariable } from "../../common/SPIRVariable";
import { SPIRType, SPIRTypeBaseType } from "../../common/SPIRType";
import { BackendVariations } from "./glsl";
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

const swizzle: string[][] = [
    [ ".x", ".y", ".z", ".w" ],
    [ ".xy", ".yz", ".zw" ],
    [ ".xyz", ".yzw" ],
    [ "" ]
];

const expectedVecComps: string[] = [ "x", "y", "z", "w" ];

export class CompilerGLSL extends Compiler
{
    protected buffer: StringStream = new StringStream();

    protected redirect_statement: string[];

    protected backend: BackendVariations = new BackendVariations();

    protected indent: number = 0;

    protected flattened_buffer_blocks: Set<number> = new Set();
    protected flattened_structs: boolean[] = []; //map<uint32_t, bool>

    // Usage tracking. If a temporary is used more than once, use the temporary instead to
    // avoid AST explosion when SPIRV is generated with pure SSA and doesn't write stuff to variables.
    protected expression_usage_counts: number[] = []; // std::unordered_map<uint32_t, uint32_t>

    protected forced_extensions: string[] = [];

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

    private options: GLSLOptions = new GLSLOptions();

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

    // Converts the format of the current expression from packed to unpacked,
    // by wrapping the expression in a constructor of the appropriate type.
    // GLSL does not support packed formats, so simply return the expression.
    // Subclasses that do will override.
    protected unpack_expression_type(expr_str: string, _0: SPIRType, _1: number, _2: boolean, _3: boolean): string
    {
        return expr_str;
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

    protected constant_expression_vector(c: SPIRConstant, vector: number): string
    {
        const type = this.get<SPIRType>(SPIRType, c.constant_type);
        type.columns = 1;

        const scalar_type = type;
        scalar_type.vecsize = 1;

        const backend = this.backend;
        let res;
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

    protected variable_decl(type: SPIRType, name: string, id: number);
    protected variable_decl(variable: SPIRVariable): string
    protected variable_decl(variable: SPIRVariable | SPIRType, name?: string, id?: number)
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
                    const dec = ir.meta[var_.self].decoration;
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
        const flags = ir.meta[id].decoration.decoration_flags;
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
        return this.flags_to_qualifiers_glsl(type, this.ir.meta[id].decoration.decoration_flags);
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

        /*
        // Shaders might cast unrelated data to pointers of non-block types.
        // Find all such instances and make sure we can cast the pointers to a synthesized block type.
        if (ir.addressing_model === AddressingModelPhysicalStorageBuffer64EXT)
            analyze_non_block_pointer_types();

        uint32_t;
        pass_count = 0;
        do {
            if (pass_count >= 3)
                throw new Error("Over 3 compilation loops detected. Must be a bug!");

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

                const flags = this.ir.meta[var_].decoration.decoration_flags;
                if (!flags.get(Decoration.DecorationNonWritable) && !flags.get(Decoration.DecorationNonReadable)) {
                    flags.set(Decoration.DecorationNonWritable);
                    flags.set(Decoration.DecorationNonReadable);
                }
            }
        });
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

function swap(arr: number[], a: number, b: number)
{
    const t = a[a];
    arr[a] = arr[b];
    arr[b] = t;
}