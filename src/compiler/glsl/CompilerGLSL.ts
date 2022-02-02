import { Compiler } from "../Compiler";
import {
    opcode_is_sign_invariant,
    to_signed_basetype,
    to_unsigned_basetype,
    type_is_floating_point,
    type_is_integral
} from "../../common/common";
import { ParsedIR } from "../../parser/ParsedIR";
import { LocationComponentPair } from "../../common/LocationComponentPair";
import { Pair } from "../../utils/Pair";
import { SPIRVariable } from "../../common/SPIRVariable";
import { SPIRBaseType, SPIRType } from "../../common/SPIRType";
import { BackendVariations, GLSLstd450, PlsFormat } from "./glsl";
import { PlsRemap } from "./PlsRemap";
import { GLSLOptions } from "./GLSLOptions";
import { Types } from "../../common/Types";
import { Meta } from "../../common/Meta";
import { SPIRFunction, SPIRFunctionParameter } from "../../common/SPIRFunction";
import { StringStream } from "../../utils/StringStream";
import { SPIRExpression } from "../../common/SPIRExpression";
import { SPIRConstant } from "../../common/SPIRConstant";
import { SPIRAccessChain } from "../../common/SPIRAccessChain";
import { maplike_get } from "../../utils/maplike_get";
import { convert_to_string } from "../../utils/string";
import { Bitset } from "../../common/Bitset";
import { GLSLPrecision } from "./GLSLPrecision";
import { Dict } from "../../utils/Dict";
import { SPIRConstantOp } from "../../common/SPIRConstantOp";
import { AccessChainMeta } from "../../common/AccessChainMeta";
import { AccessChainFlagBits } from "./AccessChainFlagBits";
import { SPIRUndef } from "../../common/SPIRUndef";
import { BufferPackingStandard } from "../BufferPackingStandard";
import { Hasher } from "../Hasher";
import {
    SPIRBlock,
    SPIRBlockContinueBlockType,
    SPIRBlockHints,
    SPIRBlockMerge,
    SPIRBlockMethod,
    SPIRBlockTerminator
} from "../../common/SPIRBlock";
import { SPIRString } from "../../common/SPIRString";
import { ValueSaver } from "../../common/ValueSaver";
import { defaultClone, defaultCopy } from "../../utils/defaultCopy";
import { EmbeddedInstruction, Instruction } from "../../common/Instruction";
import {
    TextureFunctionArguments,
    TextureFunctionBaseArguments,
    TextureFunctionNameArguments
} from "./TextureFunctionArguments";
import { SPIRCombinedImageSampler } from "../../common/SPIRCombinedImageSampler";
import { Op } from "../../spirv/Op";
import { BuiltIn } from "../../spirv/BuiltIn";
import { Decoration } from "../../spirv/Decoration";
import { StorageClass } from "../../spirv/StorageClass";
import { ExecutionMode } from "../../spirv/ExecutionMode";
import { ExecutionModel } from "../../spirv/ExecutionModel";
import { Dim } from "../../spirv/Dim";
import { ImageOperandsMask } from "../../spirv/ImageOperandsMask";
import { AddressingModel } from "../../spirv/AddressingModel";
import { ImageFormat } from "../../spirv/ImageFormat";
import { Capability } from "../../spirv/Capability";
import { ExtraSubExpressionType } from "./ExtraSubExpressionType";
import { SPIRExtension, SPIRExtensionExtension } from "../../common/SPIRExtension";
import { SpecializationConstant } from "../SpecializationConstant";
import { ExtendedDecorations } from "../../common/ExtendedDecorations";
import { BlockMetaFlagBits } from "../../parser/BlockMetaFlagBits";

const swizzle: string[][] = [
    [ ".x", ".y", ".z", ".w" ],
    [ ".xy", ".yz", ".zw" ],
    [ ".xyz", ".yzw" ],
    [ "" ]
];

/*const workaround_types: string[] = [
    "int", "ivec2", "ivec3", "ivec4", "uint", "uvec2", "uvec3", "uvec4",
    "float", "vec2", "vec3", "vec4", "double", "dvec2", "dvec3", "dvec4"
];*/

const ops: string[] = [];
ops[Op.SNegate] = "-";
ops[Op.Not] = "~";
ops[Op.IAdd] = "+";
ops[Op.ISub] = "-";
ops[Op.IMul] = "*";
ops[Op.SDiv] = "/";
ops[Op.UDiv] = "/";
ops[Op.UMod] = "%";
ops[Op.SMod] = "%";
ops[Op.ShiftRightLogical] = ">>";
ops[Op.ShiftRightArithmetic] = ">>";
ops[Op.ShiftLeftLogical] = ">>";
ops[Op.BitwiseOr] = "|";
ops[Op.BitwiseXor] = "^";
ops[Op.BitwiseAnd] = "&";
ops[Op.LogicalOr] = "||";
ops[Op.LogicalAnd] = "&&";
ops[Op.LogicalNot] = "!";
ops[Op.LogicalEqual] = "==";
ops[Op.LogicalNotEqual] = "!=";
ops[Op.IEqual] = "==";
ops[Op.INotEqual] = "!=";
ops[Op.ULessThan] = "<";
ops[Op.SLessThan] = "<";
ops[Op.ULessThanEqual] = "<=";
ops[Op.SLessThanEqual] = "<=";
ops[Op.UGreaterThan] = ">";
ops[Op.SGreaterThan] = ">";
ops[Op.SGreaterThanEqual] = ">=";
ops[Op.SGreaterThanEqual] = ">=";

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

function swap<T>(arr: T[], a: number, b: number)
{
    const t = arr[a];
    arr[a] = arr[b];
    arr[b] = t;
}

function is_block_builtin(builtin: BuiltIn)
{
    return builtin === BuiltIn.Position || builtin === BuiltIn.PointSize || builtin === BuiltIn.ClipDistance ||
        builtin === BuiltIn.CullDistance;
}

export class CompilerGLSL extends Compiler
{
    protected current_emitting_block: SPIRBlock = null;
    protected current_emitting_switch: SPIRBlock = null;
    protected current_emitting_switch_fallthrough: boolean = false;

    protected buffer: StringStream = new StringStream();

    protected redirect_statement: string[] = null;
    protected current_continue_block: SPIRBlock = null;

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

    protected processing_entry_point: boolean = false;

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

    // Used when expressions emit extra opcodes with their own unique IDs,
    // and we need to reuse the IDs across recompilation loops.
    // Currently used by NMin/Max/Clamp implementations.
    protected extra_sub_expressions: number[] = []; //std::unordered_map<uint32_t, uint32_t>

    protected workaround_ubo_load_overload_types: TypeID[] = [];

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

    // used when making unnamed uniform buffers global
    protected removed_structs: Set<number> = new Set();
    unnamed_ubo_info: Dict<string[]>;


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
        if (type.basetype !== SPIRBaseType.Struct)
            throw new Error(name + " is not a struct.");
        if (!flags.get(Decoration.Block))
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
        const s = this.masked_output_locations;
        for (let it = s.values(), val = null; (val = it.next().value);) {
            if (val.location === location && val.component === component)
                return;
        }
        s.add(new LocationComponentPair(location, component));
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

        this.removed_structs.clear();

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

    protected emit_function_prototype(func: SPIRFunction, return_flags: Bitset)
    {
        const { ir } = this;
        if (func.self !== ir.default_entry_point)
            this.add_function_overload(func);

        // Avoid shadow declarations.
        this.local_variable_names = new Set(this.resource_names);

        let decl = "";

        const type = this.get<SPIRType>(SPIRType, func.return_type);
        decl += this.flags_to_qualifiers_glsl(type, return_flags);
        decl += this.type_to_glsl(type);
        decl += this.type_to_array_glsl(type);
        decl += " ";

        if (func.self === ir.default_entry_point) {
            // If we need complex fallback in GLSL, we just wrap main() in a function
            // and interlock the entire shader ...
            if (this.interlocked_is_complex)
                decl += "spvMainInterlockedBody";
            else
                decl += "main";

            this.processing_entry_point = true;
        }
        else
            decl += this.to_name(func.self);

        decl += "(";

        const arglist: string[] = [];
        for (let arg of func.arguments) {
            // Do not pass in separate images or samplers if we're remapping
            // to combined image samplers.
            if (this.skip_argument(arg.id))
                continue;

            // Might change the variable name if it already exists in this function.
            // SPIRV OpName doesn't have any semantic effect, so it's valid for an implementation
            // to use same name for variables.
            // Since we want to make the GLSL debuggable and somewhat sane, use fallback names for variables which are duplicates.
            this.add_local_variable_name(arg.id);

            arglist.push(this.argument_decl(arg));

            // Hold a pointer to the parameter so we can invalidate the readonly field if needed.
            const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, arg.id);
            if (var_)
                var_.parameter = arg;
        }

        for (let arg of func.shadow_arguments) {
            // Might change the variable name if it already exists in this function.
            // SPIRV OpName doesn't have any semantic effect, so it's valid for an implementation
            // to use same name for variables.
            // Since we want to make the GLSL debuggable and somewhat sane, use fallback names for variables which are duplicates.
            this.add_local_variable_name(arg.id);

            arglist.push(this.argument_decl(arg));

            // Hold a pointer to the parameter so we can invalidate the readonly field if needed.
            const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, arg.id);
            if (var_)
                var_.parameter = arg;
        }

        decl += arglist.join(", ");
        decl += ")";
        this.statement(decl);
    }

    protected emit_function(func: SPIRFunction, return_flags: Bitset)
    {
        // Avoid potential cycles.
        if (func.active)
            return;
        func.active = true;

        const { ir } = this;

        // If we depend on a function, emit that function before we emit our own function.
        for (let block of func.blocks) {
            const b = this.get<SPIRBlock>(SPIRBlock, block);
            for (let i of b.ops) {
                const ops = this.stream(i);
                const op = <Op>(i.op);

                if (op === Op.FunctionCall) {
                    // Recursively emit functions which are called.
                    const id = ops[2];
                    this.emit_function(this.get<SPIRFunction>(SPIRFunction, id), maplike_get(Meta, ir.meta, ops[1]).decoration.decoration_flags);
                }
            }
        }

        if (func.entry_line.file_id !== 0)
            this.emit_line_directive(func.entry_line.file_id, func.entry_line.line_literal);
        this.emit_function_prototype(func, return_flags);
        this.begin_scope();

        if (func.self === ir.default_entry_point)
            this.emit_entry_point_declarations();

        this.current_function = func;
        const entry_block = this.get<SPIRBlock>(SPIRBlock, func.entry_block);

        func.constant_arrays_needed_on_stack.sort();
        for (let array of func.constant_arrays_needed_on_stack) {
            const c = this.get<SPIRConstant>(SPIRConstant, array);
            const type = this.get<SPIRType>(SPIRType, c.constant_type);
            this.statement(this.variable_decl(type, `_${array}_array_copy`), " = ", this.constant_expression(c), ";");
        }

        for (const v of func.local_variables) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, v);
            var_.deferred_declaration = false;

            if (this.variable_decl_is_remapped_storage(var_, StorageClass.Workgroup)) {
                // Special variable type which cannot have initializer,
                // need to be declared as standalone variables.
                // Comes from MSL which can push global variables as local variables in main function.
                this.add_local_variable_name(var_.self);
                this.statement(this.variable_decl(var_), ";");
                var_.deferred_declaration = false;
            }
            else if (var_.storage === StorageClass.Private) {
                // These variables will not have had their CFG usage analyzed, so move it to the entry block.
                // Comes from MSL which can push global variables as local variables in main function.
                // We could just declare them right now, but we would miss out on an important initialization case which is
                // LUT declaration in MSL.
                // If we don't declare the variable when it is assigned we're forced to go through a helper function
                // which copies elements one by one.
                this.add_local_variable_name(var_.self);

                if (var_.initializer) {
                    this.statement(this.variable_decl(var_), ";");
                    var_.deferred_declaration = false;
                }
                else {
                    const dominated = entry_block.dominated_variables;
                    if (dominated.indexOf(var_.self) < 0)
                        entry_block.dominated_variables.push(var_.self);
                    var_.deferred_declaration = true;
                }
            }
            else if (var_.storage === StorageClass.Function && var_.remapped_variable && var_.static_expression) {
                // No need to declare this variable, it has a static expression.
                var_.deferred_declaration = false;
            }
            else if (this.expression_is_lvalue(v)) {
                this.add_local_variable_name(var_.self);
                // Loop variables should never be declared early, they are explicitly emitted in a loop.
                if (var_.initializer && !var_.loop_variable)
                    this.statement(this.variable_decl_function_local(var_), ";");
                else {
                    // Don't declare variable until first use to declutter the GLSL output quite a lot.
                    // If we don't touch the variable before first branch,
                    // declare it then since we need variable declaration to be in top scope.
                    var_.deferred_declaration = true;
                }
            }
            else {
                // HACK: SPIR-V in older glslang output likes to use samplers and images as local variables, but GLSL does not allow this.
                // For these types (non-lvalue), we enforce forwarding through a shadowed variable.
                // This means that when we OpStore to these variables, we just write in the expression ID directly.
                // This breaks any kind of branching, since the variable must be statically assigned.
                // Branching on samplers and images would be pretty much impossible to fake in GLSL.
                var_.statically_assigned = true;
            }

            var_.loop_variable_enable = false;

            // Loop variables are never declared outside their for-loop, so block any implicit declaration.
            if (var_.loop_variable)
                var_.deferred_declaration = false;
        }

        // Enforce declaration order for regression testing purposes.
        for (let block_id of func.blocks) {
            const block = this.get<SPIRBlock>(SPIRBlock, block_id);
            block.dominated_variables.sort();
        }

        for (let line of this.current_function.fixup_hooks_in)
            line();

        this.emit_block_chain(entry_block);

        this.end_scope();
        this.processing_entry_point = false;
        this.statement("");

        // Make sure deferred declaration state for local variables is cleared when we are done with function.
        // We risk declaring Private/Workgroup variables in places we are not supposed to otherwise.
        for (let v of func.local_variables) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, v);
            var_.deferred_declaration = false;
        }
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

    // holy long function batman!

    protected emit_instruction(instruction: Instruction)
    {
        const ops = this.stream(instruction);
        const opcode = <Op>(instruction.op);
        let length = instruction.length;

        // If we need to do implicit bitcasts, make sure we do it with the correct type.
        const integer_width = this.get_integer_width_for_instruction(instruction);
        const int_type = to_signed_basetype(integer_width);
        const uint_type = to_unsigned_basetype(integer_width);

        const { backend, options, ir } = this;

        switch (opcode) {
            // Dealing with memory
            case Op.Load: {
                const result_type = ops[0];
                const id = ops[1];
                const ptr = ops[2];

                this.flush_variable_declaration(ptr);

                // If we're loading from memory that cannot be changed by the shader,
                // just forward the expression directly to avoid needless temporaries.
                // If an expression is mutable and forwardable, we speculate that it is immutable.
                const forward = this.should_forward(ptr) && !this.forced_temporaries.has(id);

                // If loading a non-native row-major matrix, mark the expression as need_transpose.
                let need_transpose = false;
                let old_need_transpose = false;

                const ptr_expression = this.maybe_get<SPIRExpression>(SPIRExpression, ptr);

                if (forward) {
                    // If we're forwarding the load, we're also going to forward transpose state, so don't transpose while
                    // taking the expression.
                    if (ptr_expression && ptr_expression.need_transpose) {
                        old_need_transpose = true;
                        ptr_expression.need_transpose = false;
                        need_transpose = true;
                    }
                    else if (this.is_non_native_row_major_matrix(ptr))
                        need_transpose = true;
                }

                // If we are forwarding this load,
                // don't register the read to access chain here, defer that to when we actually use the expression,
                // using the add_implied_read_expression mechanism.
                let expr;

                const is_packed = this.has_extended_decoration(ptr, ExtendedDecorations.PhysicalTypePacked);
                const is_remapped = this.has_extended_decoration(ptr, ExtendedDecorations.PhysicalTypeID);
                if (forward || (!is_packed && !is_remapped)) {
                    // For the simple case, we do not need to deal with repacking.
                    expr = this.to_dereferenced_expression(ptr, false);
                }
                else {
                    // If we are not forwarding the expression, we need to unpack and resolve any physical type remapping here before
                    // storing the expression to a temporary.
                    expr = this.to_unpacked_expression(ptr);
                }

                const type = this.get<SPIRType>(SPIRType, result_type);
                const expr_type = this.expression_type(ptr);

                // If the expression has more vector components than the result type, insert
                // a swizzle. This shouldn't happen normally on valid SPIR-V, but it might
                // happen with e.g. the MSL backend replacing the type of an input variable.
                if (expr_type.vecsize > type.vecsize)
                    expr = this.enclose_expression(expr + this.vector_swizzle(type.vecsize, 0));

                // We might need to cast in order to load from a builtin.
                expr = this.cast_from_variable_load(ptr, expr, type);

                // We might be trying to load a gl_Position[N], where we should be
                // doing float4[](gl_in[i].gl_Position, ...) instead.
                // Similar workarounds are required for input arrays in tessellation.
                // Also, loading from gl_SampleMask array needs special unroll.
                expr = this.unroll_array_from_complex_load(id, ptr, expr);

                if (!this.type_is_opaque_value(type) && this.has_decoration(ptr, Decoration.NonUniform)) {
                    // If we're loading something non-opaque, we need to handle non-uniform descriptor access.
                    expr = this.convert_non_uniform_expression(expr, ptr);
                }

                if (forward && ptr_expression)
                    ptr_expression.need_transpose = old_need_transpose;

                const flattened = ptr_expression && this.flattened_buffer_blocks.has(ptr_expression.loaded_from);

                if (backend.needs_row_major_load_workaround && !this.is_non_native_row_major_matrix(ptr) && !flattened)
                    expr = this.rewrite_load_for_wrapped_row_major(expr, result_type, ptr);

                // By default, suppress usage tracking since using same expression multiple times does not imply any extra work.
                // However, if we try to load a complex, composite object from a flattened buffer,
                // we should avoid emitting the same code over and over and lower the result to a temporary.
                const usage_tracking = flattened && (type.basetype === SPIRBaseType.Struct || (type.columns > 1));

                let e: SPIRExpression;
                if (!forward && this.expression_is_non_value_type_array(ptr)) {
                    // Complicated load case where we need to make a copy of ptr, but we cannot, because
                    // it is an array, and our backend does not support arrays as value types.
                    // Emit the temporary, and copy it explicitly.
                    e = this.emit_uninitialized_temporary_expression(result_type, id);
                    this.emit_array_copy(this.to_expression(id), id, ptr, StorageClass.Function, this.get_expression_effective_storage_class(ptr));
                }
                else
                    e = this.emit_op(result_type, id, expr, forward, !usage_tracking);

                e.need_transpose = need_transpose;
                this.register_read(id, ptr, forward);

                if (forward) {
                    // Pass through whether the result is of a packed type and the physical type ID.
                    if (this.has_extended_decoration(ptr, ExtendedDecorations.PhysicalTypePacked))
                        this.set_extended_decoration(id, ExtendedDecorations.PhysicalTypePacked);
                    if (this.has_extended_decoration(ptr, ExtendedDecorations.PhysicalTypeID)) {
                        this.set_extended_decoration(id, ExtendedDecorations.PhysicalTypeID,
                            this.get_extended_decoration(ptr, ExtendedDecorations.PhysicalTypeID));
                    }
                }
                else {
                    // This might have been set on an earlier compilation iteration, force it to be unset.
                    this.unset_extended_decoration(id, ExtendedDecorations.PhysicalTypePacked);
                    this.unset_extended_decoration(id, ExtendedDecorations.PhysicalTypeID);
                }

                this.inherit_expression_dependencies(id, ptr);
                if (forward)
                    this.add_implied_read_expression(e, ptr);
                break;
            }

            case Op.InBoundsAccessChain:
            case Op.AccessChain:
            case Op.PtrAccessChain: {
                const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, ops[2]);
                if (var_)
                    this.flush_variable_declaration(var_.self);

                // If the base is immutable, the access chain pointer must also be.
                // If an expression is mutable and forwardable, we speculate that it is immutable.
                const meta = new AccessChainMeta();
                const ptr_chain = opcode === Op.PtrAccessChain;
                const e = this.access_chain(ops[2], ops, 3, length - 3, this.get<SPIRType>(SPIRType, ops[0]), meta, ptr_chain);

                const expr = this.set<SPIRExpression>(SPIRExpression, ops[1], e, ops[0], this.should_forward(ops[2]));

                const backing_variable = this.maybe_get_backing_variable(ops[2]);
                expr.loaded_from = backing_variable ? backing_variable.self : <ID>(ops[2]);
                expr.need_transpose = meta.need_transpose;
                expr.access_chain = true;

                // Mark the result as being packed. Some platforms handled packed vectors differently than non-packed.
                if (meta.storage_is_packed)
                    this.set_extended_decoration(ops[1], ExtendedDecorations.PhysicalTypePacked);
                if (meta.storage_physical_type !== 0)
                    this.set_extended_decoration(ops[1], ExtendedDecorations.PhysicalTypeID, meta.storage_physical_type);
                if (meta.storage_is_invariant)
                    this.set_decoration(ops[1], Decoration.Invariant);
                if (meta.flattened_struct)
                    this.flattened_structs[ops[1]] = true;

                // If we have some expression dependencies in our access chain, this access chain is technically a forwarded
                // temporary which could be subject to invalidation.
                // Need to assume we're forwarded while calling inherit_expression_depdendencies.
                this.forwarded_temporaries.add(ops[1]);
                // The access chain itself is never forced to a temporary, but its dependencies might.
                this.suppressed_usage_tracking.add(ops[1]);

                for (let i = 2; i < length; i++) {
                    this.inherit_expression_dependencies(ops[1], ops[i]);
                    this.add_implied_read_expression(expr, ops[i]);
                }

                // If we have no dependencies after all, i.e., all indices in the access chain are immutable temporaries,
                // we're not forwarded after all.
                if (expr.expression_dependencies.length === 0)
                    this.forwarded_temporaries.delete(ops[1]);

                break;
            }

            case Op.Store: {
                const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, ops[0]);

                if (var_ && var_.statically_assigned)
                    var_.static_expression = ops[1];
                else if (var_ && var_.loop_variable && !var_.loop_variable_enable)
                    var_.static_expression = ops[1];
                else if (var_ && var_.remapped_variable && var_.static_expression) {
                    // Skip the write.
                }
                else if (this.flattened_structs.hasOwnProperty(ops[0])) {
                    this.store_flattened_struct(ops[0], ops[1]);
                    this.register_write(ops[0]);
                }
                else {
                    this.emit_store_statement(ops[0], ops[1]);
                }

                // Storing a pointer results in a variable pointer, so we must conservatively assume
                // we can write through it.
                if (this.expression_type(ops[1]).pointer)
                    this.register_write(ops[1]);
                break;
            }

            case Op.ArrayLength: {
                const result_type = ops[0];
                const id = ops[1];
                let e = this.access_chain_internal(ops[2], ops, 3, length - 3, AccessChainFlagBits.INDEX_IS_LITERAL_BIT, null);
                if (this.has_decoration(ops[2], Decoration.NonUniform))
                    e = this.convert_non_uniform_expression(e, ops[2]);
                this.set<SPIRExpression>(SPIRExpression, id, this.type_to_glsl(this.get<SPIRType>(SPIRType, result_type)),
                    "(" + e + ".length())", result_type, true);
                break;
            }

            // Function calls
            case Op.FunctionCall: {
                const result_type = ops[0];
                const id = ops[1];
                const func = ops[2];
                length -= 3;

                const callee = this.get<SPIRFunction>(SPIRFunction, func);
                const return_type = this.get<SPIRType>(SPIRType, callee.return_type);
                const pure = this.function_is_pure(callee);

                let callee_has_out_variables = false;
                let emit_return_value_as_argument = false;

                // Invalidate out variables passed to functions since they can be OpStore'd to.
                for (let i = 0; i < length; i++) {
                    if (callee.arguments[i].write_count) {
                        this.register_call_out_argument(ops[i + 3]);
                        callee_has_out_variables = true;
                    }

                    this.flush_variable_declaration(ops[i + 3]);
                }

                if (return_type.array.length > 0 && !backend.can_return_array) {
                    callee_has_out_variables = true;
                    emit_return_value_as_argument = true;
                }

                if (!pure)
                    this.register_impure_function_call();

                let funexpr = "";
                const arglist: string[] = [];
                funexpr += this.to_name(func) + "(";

                if (emit_return_value_as_argument) {
                    this.statement(this.type_to_glsl(return_type), " ", this.to_name(id), this.type_to_array_glsl(return_type), ";");
                    arglist.push(this.to_name(id));
                }

                for (let i = 0; i < length; i++) {
                    // Do not pass in separate images or samplers if we're remapping
                    // to combined image samplers.
                    if (this.skip_argument(ops[i + 3]))
                        continue;

                    arglist.push(this.to_func_call_arg(callee.arguments[i], ops[i + 3]));
                }

                for (let combined of callee.combined_parameters) {
                    const image_id = combined.global_image ? combined.image_id : <VariableID>(ops[3 + combined.image_id]);
                    const sampler_id = combined.global_sampler ? combined.sampler_id : <VariableID>(ops[3 + combined.sampler_id]);
                    arglist.push(this.to_combined_image_sampler(image_id, sampler_id));
                }

                this.append_global_func_args(callee, length, arglist);

                funexpr += arglist.join(", ");
                funexpr += ")";

                // Check for function call constraints.
                this.check_function_call_constraints(ops, 3, length);

                if (return_type.basetype !== SPIRBaseType.Void) {
                    // If the function actually writes to an out variable,
                    // take the conservative route and do not forward.
                    // The problem is that we might not read the function
                    // result (and emit the function) before an out variable
                    // is read (common case when return value is ignored!
                    // In order to avoid start tracking invalid variables,
                    // just avoid the forwarding problem altogether.
                    const forward = this.args_will_forward(id, ops, 3, length, pure) && !callee_has_out_variables && pure &&
                        (!this.forced_temporaries.has(id));

                    if (emit_return_value_as_argument) {
                        this.statement(funexpr, ";");
                        this.set<SPIRExpression>(SPIRExpression, id, this.to_name(id), result_type, true);
                    }
                    else
                        this.emit_op(result_type, id, funexpr, forward);

                    // Function calls are implicit loads from all variables in question.
                    // Set dependencies for them.
                    for (let i = 0; i < length; i++)
                        this.register_read(id, ops[i + 3], forward);

                    // If we're going to forward the temporary result,
                    // put dependencies on every variable that must not change.
                    if (forward)
                        this.register_global_read_dependencies(callee, id);
                }
                else
                    this.statement(funexpr, ";");

                break;
            }

            // Composite munging
            case Op.CompositeConstruct: {
                const result_type = ops[0];
                const id = ops[1];
                // const elems = ops.slice(2);
                length -= 2;

                let forward = true;
                for (let i = 0; i < length; i++)
                    forward = forward && this.should_forward(ops[i + 2]);

                const out_type = this.get<SPIRType>(SPIRType, result_type);
                const in_type = length > 0 ? this.expression_type(ops[2]) : null;

                // Only splat if we have vector constructors.
                // Arrays and structs must be initialized properly in full.
                const composite = out_type.array.length > 0 || out_type.basetype === SPIRBaseType.Struct;

                let splat = false;
                let swizzle_splat = false;

                if (in_type) {
                    splat = in_type.vecsize === 1 && in_type.columns === 1 && !composite && backend.use_constructor_splatting;
                    swizzle_splat = in_type.vecsize === 1 && in_type.columns === 1 && backend.can_swizzle_scalar;

                    if (ir.ids[ops[2]].get_type() === Types.Constant && !type_is_floating_point(in_type)) {
                        // Cannot swizzle literal integers as a special case.
                        swizzle_splat = false;
                    }
                }

                if (splat || swizzle_splat) {
                    const input = ops[2];
                    for (let i = 0; i < length; i++) {
                        if (input !== ops[i + 2]) {
                            splat = false;
                            swizzle_splat = false;
                        }
                    }
                }

                if (out_type.basetype === SPIRBaseType.Struct && !backend.can_declare_struct_inline)
                    forward = false;
                if (out_type.array.length > 0 && !backend.can_declare_arrays_inline)
                    forward = false;
                if (this.type_is_empty(out_type) && !backend.supports_empty_struct)
                    forward = false;

                let constructor_op = "";
                if (backend.use_initializer_list && composite) {
                    let needs_trailing_tracket = false;
                    // Only use this path if we are building composites.
                    // This path cannot be used for arithmetic.
                    if (backend.use_typed_initializer_list && out_type.basetype === SPIRBaseType.Struct && out_type.array.length === 0)
                        constructor_op += this.type_to_glsl_constructor(this.get<SPIRType>(SPIRType, result_type));
                    else if (backend.use_typed_initializer_list && backend.array_is_value_type && out_type.array.length > 0) {
                        // MSL path. Array constructor is baked into type here, do not use _constructor variant.
                        constructor_op += this.type_to_glsl_constructor(this.get<SPIRType>(SPIRType, result_type)) + "(";
                        needs_trailing_tracket = true;
                    }
                    constructor_op += "{ ";

                    if (this.type_is_empty(out_type) && !backend.supports_empty_struct)
                        constructor_op += "0";
                    else if (splat)
                        constructor_op += this.to_unpacked_expression(ops[2]);
                    else
                        constructor_op += this.build_composite_combiner(result_type, ops, 2, length);
                    constructor_op += " }";
                    if (needs_trailing_tracket)
                        constructor_op += ")";
                }
                else if (swizzle_splat && !composite) {
                    constructor_op = this.remap_swizzle(this.get<SPIRType>(SPIRType, result_type), 1, this.to_unpacked_expression(ops[2]));
                }
                else {
                    constructor_op = this.type_to_glsl_constructor(this.get<SPIRType>(SPIRType, result_type)) + "(";
                    if (this.type_is_empty(out_type) && !backend.supports_empty_struct)
                        constructor_op += "0";
                    else if (splat)
                        constructor_op += this.to_unpacked_expression(ops[2]);
                    else
                        constructor_op += this.build_composite_combiner(result_type, ops, 2, length);
                    constructor_op += ")";
                }

                if (constructor_op !== "") {
                    this.emit_op(result_type, id, constructor_op, forward);
                    for (let i = 0; i < length; i++)
                        this.inherit_expression_dependencies(id, ops[i + 2]);
                }
                break;
            }

            case Op.VectorInsertDynamic: {
                const result_type = ops[0];
                const id = ops[1];
                const vec = ops[2];
                const comp = ops[3];

                this.flush_variable_declaration(vec);

                // Make a copy, then use access chain to store the variable.
                this.statement(this.declare_temporary(result_type, id), this.to_expression(vec), ";");
                this.set<SPIRExpression>(SPIRExpression, id, this.to_name(id), result_type, true);
                const chain = this.access_chain_internal(id, ops, 4, 1, 0, null);
                this.statement(chain, " = ", this.to_unpacked_expression(comp), ";");
                break;
            }

            case Op.VectorExtractDynamic: {
                const result_type = ops[0];
                const id = ops[1];

                const expr = this.access_chain_internal(ops[2], ops, 3, 1, 0, null);
                this.emit_op(result_type, id, expr, this.should_forward(ops[2]));
                this.inherit_expression_dependencies(id, ops[2]);
                this.inherit_expression_dependencies(id, ops[3]);
                break;
            }

            case Op.CompositeExtract: {
                const result_type = ops[0];
                const id = ops[1];
                length -= 3;

                const type = this.get<SPIRType>(SPIRType, result_type);

                // We can only split the expression here if our expression is forwarded as a temporary.
                let allow_base_expression = !this.forced_temporaries.has(id);

                // Do not allow base expression for struct members. We risk doing "swizzle" optimizations in this case.
                const composite_type = this.expression_type(ops[2]);
                const composite_type_is_complex = composite_type.basetype === SPIRBaseType.Struct || composite_type.array.length > 0;
                if (composite_type_is_complex)
                    allow_base_expression = false;

                // Packed expressions or physical ID mapped expressions cannot be split up.
                if (this.has_extended_decoration(ops[2], ExtendedDecorations.PhysicalTypePacked) ||
                    this.has_extended_decoration(ops[2], ExtendedDecorations.PhysicalTypeID))
                    allow_base_expression = false;

                // Cannot use base expression for row-major matrix row-extraction since we need to interleave access pattern
                // into the base expression.
                if (this.is_non_native_row_major_matrix(ops[2]))
                    allow_base_expression = false;

                const meta = new AccessChainMeta();
                let e: SPIRExpression = null;
                const c = this.maybe_get<SPIRConstant>(SPIRConstant, ops[2]);

                if (c && !c.specialization && !composite_type_is_complex) {
                    const expr = this.to_extract_constant_composite_expression(result_type, c, ops, 3, length);
                    e = this.emit_op(result_type, id, expr, true, true);
                }
                else if (allow_base_expression && this.should_forward(ops[2]) && type.vecsize === 1 && type.columns === 1 && length === 1) {
                    // Only apply this optimization if result is scalar.

                    // We want to split the access chain from the base.
                    // This is so we can later combine different CompositeExtract results
                    // with CompositeConstruct without emitting code like
                    //
                    // vec3 temp = texture(...).xyz
                    // vec4(temp.x, temp.y, temp.z, 1.0).
                    //
                    // when we actually wanted to emit this
                    // vec4(texture(...).xyz, 1.0).
                    //
                    // Including the base will prevent this and would trigger multiple reads
                    // from expression causing it to be forced to an actual temporary in GLSL.
                    const expr = this.access_chain_internal(ops[2], ops, 3, length,
                        AccessChainFlagBits.INDEX_IS_LITERAL_BIT | AccessChainFlagBits.CHAIN_ONLY_BIT |
                        AccessChainFlagBits.FORCE_COMPOSITE_BIT, meta);
                    e = this.emit_op(result_type, id, expr, true, this.should_suppress_usage_tracking(ops[2]));
                    this.inherit_expression_dependencies(id, ops[2]);
                    e.base_expression = ops[2];
                }
                else {
                    const expr = this.access_chain_internal(ops[2], ops, 3, length,
                        AccessChainFlagBits.INDEX_IS_LITERAL_BIT | AccessChainFlagBits.FORCE_COMPOSITE_BIT, meta);
                    e = this.emit_op(result_type, id, expr, this.should_forward(ops[2]), this.should_suppress_usage_tracking(ops[2]));
                    this.inherit_expression_dependencies(id, ops[2]);
                }

                // Pass through some meta information to the loaded expression.
                // We can still end up loading a buffer type to a variable, then CompositeExtract from it
                // instead of loading everything through an access chain.
                e.need_transpose = meta.need_transpose;
                if (meta.storage_is_packed)
                    this.set_extended_decoration(id, ExtendedDecorations.PhysicalTypePacked);
                if (meta.storage_physical_type !== 0)
                    this.set_extended_decoration(id, ExtendedDecorations.PhysicalTypeID, meta.storage_physical_type);
                if (meta.storage_is_invariant)
                    this.set_decoration(id, Decoration.Invariant);

                break;
            }

            case Op.CompositeInsert: {
                const result_type = ops[0];
                const id = ops[1];
                const obj = ops[2];
                const composite = ops[3];
                length -= 4;

                this.flush_variable_declaration(composite);

                // Make a copy, then use access chain to store the variable.
                this.statement(this.declare_temporary(result_type, id), this.to_expression(composite), ";");
                this.set<SPIRExpression>(SPIRExpression, id, this.to_name(id), result_type, true);
                const chain = this.access_chain_internal(id, ops, 4, length, AccessChainFlagBits.INDEX_IS_LITERAL_BIT, null);
                this.statement(chain, " = ", this.to_unpacked_expression(obj), ";");

                break;
            }

            case Op.CopyMemory: {
                const lhs = ops[0];
                const rhs = ops[1];
                if (lhs !== rhs) {
                    let tmp_id = maplike_get(0, this.extra_sub_expressions, instruction.offset | ExtraSubExpressionType.STREAM_OFFSET);
                    if (!tmp_id)
                        tmp_id = ir.increase_bound_by(1);
                    const tmp_type_id = this.expression_type(rhs).parent_type;

                    const fake_load = new EmbeddedInstruction();
                    const fake_store = new EmbeddedInstruction();
                    fake_load.op = Op.Load;
                    fake_load.length = 3;
                    fake_load.ops.push(tmp_type_id);
                    fake_load.ops.push(tmp_id);
                    fake_load.ops.push(rhs);

                    fake_store.op = Op.Store;
                    fake_store.length = 2;
                    fake_store.ops.push(lhs);
                    fake_store.ops.push(tmp_id);

                    // Load and Store do a *lot* of workarounds, and we'd like to reuse them as much as possible.
                    // Synthesize a fake Load and Store pair for CopyMemory.
                    this.emit_instruction(fake_load);
                    this.emit_instruction(fake_store);
                }
                break;
            }

            case Op.CopyLogical: {
                // This is used for copying object of different types, arrays and structs.
                // We need to unroll the copy, element-by-element.
                const result_type = ops[0];
                const id = ops[1];
                const rhs = ops[2];

                this.emit_uninitialized_temporary_expression(result_type, id);
                this.emit_copy_logical_type(id, result_type, rhs, this.expression_type_id(rhs), []);
                break;
            }

            case Op.CopyObject: {
                const result_type = ops[0];
                const id = ops[1];
                const rhs = ops[2];
                const pointer = this.get<SPIRType>(SPIRType, result_type).pointer;

                const chain = this.maybe_get<SPIRAccessChain>(SPIRAccessChain, rhs);
                const imgsamp = this.maybe_get<SPIRCombinedImageSampler>(SPIRCombinedImageSampler, rhs);
                if (chain) {
                    // Cannot lower to a SPIRExpression, just copy the object.
                    const e = this.set<SPIRAccessChain>(SPIRAccessChain, id, chain);
                    e.self = id;
                }
                else if (imgsamp) {
                    // Cannot lower to a SPIRExpression, just copy the object.
                    // GLSL does not currently use this type and will never get here, but MSL does.
                    // Handled here instead of CompilerMSL for better integration and general handling,
                    // and in case GLSL or other subclasses require it in the future.
                    const e = this.set<SPIRCombinedImageSampler>(SPIRCombinedImageSampler, id, imgsamp);
                    e.self = id;
                }
                else if (this.expression_is_lvalue(rhs) && !pointer) {
                    // Need a copy.
                    // For pointer types, we copy the pointer itself.
                    this.statement(this.declare_temporary(result_type, id), this.to_unpacked_expression(rhs), ";");
                    this.set<SPIRExpression>(SPIRExpression, id, this.to_name(id), result_type, true);
                }
                else {
                    // RHS expression is immutable, so just forward it.
                    // Copying these things really make no sense, but
                    // seems to be allowed anyways.
                    const e = this.set<SPIRExpression>(SPIRExpression, id, this.to_expression(rhs), result_type, true);
                    if (pointer) {
                        const var_ = this.maybe_get_backing_variable(rhs);
                        e.loaded_from = var_ ? var_.self : 0;
                    }

                    // If we're copying an access chain, need to inherit the read expressions.
                    const rhs_expr = this.maybe_get<SPIRExpression>(SPIRExpression, rhs);
                    if (rhs_expr) {
                        e.implied_read_expressions = rhs_expr.implied_read_expressions;
                        e.expression_dependencies = rhs_expr.expression_dependencies;
                    }
                }
                break;
            }

            case Op.VectorShuffle: {
                const result_type = ops[0];
                const id = ops[1];
                const vec0 = ops[2];
                const vec1 = ops[3];
                // const elems = ops.slice(4);
                length -= 4;

                const type0 = this.expression_type(vec0);

                // If we have the undefined swizzle index -1, we need to swizzle in undefined data,
                // or in our case, T(0).
                let shuffle = false;
                for (let i = 0; i < length; i++)
                    if (ops[i + 4] >= type0.vecsize || ops[i + 4] === 0xffffffff)
                        shuffle = true;

                // Cannot use swizzles with packed expressions, force shuffle path.
                if (!shuffle && this.has_extended_decoration(vec0, ExtendedDecorations.PhysicalTypePacked))
                    shuffle = true;

                let expr = "";
                let should_fwd = false;
                let trivial_forward = false;

                if (shuffle) {
                    should_fwd = this.should_forward(vec0) && this.should_forward(vec1);
                    trivial_forward = this.should_suppress_usage_tracking(vec0) && this.should_suppress_usage_tracking(vec1);

                    // Constructor style and shuffling from two different vectors.
                    const args: string[] = [];
                    for (let i = 0; i < length; i++) {
                        if (ops[i + 4] === 0xffffffff) {
                            // Use a constant 0 here.
                            // We could use the first component or similar, but then we risk propagating
                            // a value we might not need, and bog down codegen.
                            const c = new SPIRConstant();
                            c.constant_type = type0.parent_type;
                            console.assert(type0.parent_type !== 0);
                            args.push(this.constant_expression(c));
                        }
                        else if (ops[i + 4] >= type0.vecsize)
                            args.push(this.to_extract_component_expression(vec1, ops[i + 4] - type0.vecsize));
                        else
                            args.push(this.to_extract_component_expression(vec0, ops[i + 4]));
                    }
                    expr += this.type_to_glsl_constructor(this.get<SPIRType>(SPIRType, result_type)) + "(" + args.join(", ") + ")";
                }
                else {
                    should_fwd = this.should_forward(vec0);
                    trivial_forward = this.should_suppress_usage_tracking(vec0);

                    // We only source from first vector, so can use swizzle.
                    // If the vector is packed, unpack it before applying a swizzle (needed for MSL)
                    expr += this.to_enclosed_unpacked_expression(vec0);
                    expr += ".";
                    for (let i = 0; i < length; i++) {
                        console.assert(ops[i + 4] !== 0xffffffff);
                        expr += this.index_to_swizzle(ops[i + 4]);
                    }

                    if (backend.swizzle_is_function && length > 1)
                        expr += "()";
                }

                // A shuffle is trivial in that it doesn't actually *do* anything.
                // We inherit the forwardedness from our arguments to avoid flushing out to temporaries when it's not really needed.

                this.emit_op(result_type, id, expr, should_fwd, trivial_forward);

                this.inherit_expression_dependencies(id, vec0);
                if (vec0 !== vec1)
                    this.inherit_expression_dependencies(id, vec1);
                break;
            }

            // ALU
            case Op.IsNan:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "isnan");
                break;

            case Op.IsInf:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "isnan");
                break;

            case Op.SNegate:
            case Op.FNegate:
                this.emit_unary_op(ops[0], ops[1], ops[2], "-");
                break;

            case Op.IAdd: {
                // For simple arith ops, prefer the output type if there's a mismatch to avoid extra bitcasts.
                const type = this.get<SPIRType>(SPIRType, ops[0]).basetype;
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "+", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.FAdd:
                this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "+");
                break;

            case Op.ISub: {
                const type = this.get<SPIRType>(SPIRType, ops[0]).basetype;
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "-", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.FSub:
                this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "-");
                break;

            case Op.IMul: {
                const type = this.get<SPIRType>(SPIRType, ops[0]).basetype;
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "*", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.VectorTimesMatrix:
            case Op.MatrixTimesVector: {
                // If the matrix needs transpose, just flip the multiply order.
                const e = this.maybe_get<SPIRExpression>(SPIRExpression, ops[opcode === Op.MatrixTimesVector ? 2 : 3]);
                if (e && e.need_transpose) {
                    e.need_transpose = false;
                    let expr = "";

                    if (opcode === Op.MatrixTimesVector)
                        expr = this.to_enclosed_unpacked_expression(ops[3]) + " * " + this.enclose_expression(this.to_unpacked_row_major_matrix_expression(ops[2]));
                    else
                        expr = this.enclose_expression(this.to_unpacked_row_major_matrix_expression(ops[3])) + " * " +
                            this.to_enclosed_unpacked_expression(ops[2]);

                    const forward = this.should_forward(ops[2]) && this.should_forward(ops[3]);
                    this.emit_op(ops[0], ops[1], expr, forward);
                    e.need_transpose = true;
                    this.inherit_expression_dependencies(ops[1], ops[2]);
                    this.inherit_expression_dependencies(ops[1], ops[3]);
                }
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "*");
                break;
            }

            case Op.MatrixTimesMatrix: {
                const a = this.maybe_get<SPIRExpression>(SPIRExpression, ops[2]);
                const b = this.maybe_get<SPIRExpression>(SPIRExpression, ops[3]);

                // If both matrices need transpose, we can multiply in flipped order and tag the expression as transposed.
                // a^T * b^T = (b * a)^T.
                if (a && b && a.need_transpose && b.need_transpose) {
                    a.need_transpose = false;
                    b.need_transpose = false;
                    const expr = this.enclose_expression(this.to_unpacked_row_major_matrix_expression(ops[3])) + " * " +
                        this.enclose_expression(this.to_unpacked_row_major_matrix_expression(ops[2]));
                    const forward = this.should_forward(ops[2]) && this.should_forward(ops[3]);
                    const e = this.emit_op(ops[0], ops[1], expr, forward);
                    e.need_transpose = true;
                    a.need_transpose = true;
                    b.need_transpose = true;
                    this.inherit_expression_dependencies(ops[1], ops[2]);
                    this.inherit_expression_dependencies(ops[1], ops[3]);
                }
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "*");

                break;
            }

            case Op.FMul:
            case Op.MatrixTimesScalar:
            case Op.VectorTimesScalar:
                this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "*");
                break;

            case Op.OuterProduct:
                this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "outerProduct");
                break;

            case Op.Dot:
                this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "dot");
                break;

            case Op.Transpose:
                if (options.version < 120) // Matches GLSL 1.10 / ESSL 1.00
                {
                    // transpose() is not available, so instead, flip need_transpose,
                    // which can later be turned into an emulated transpose op by
                    // convert_row_major_matrix(), if necessary.
                    const result_type = ops[0];
                    const result_id = ops[1];
                    const input = ops[2];

                    // Force need_transpose to false temporarily to prevent
                    // to_expression() from doing the transpose.
                    let need_transpose = false;
                    const input_e = this.maybe_get<SPIRExpression>(SPIRExpression, input);
                    if (input_e) {
                        const tmp = need_transpose;
                        need_transpose = input_e.need_transpose;
                        input_e.need_transpose = tmp;
                    }

                    const forward = this.should_forward(input);
                    const e = this.emit_op(result_type, result_id, this.to_expression(input), forward);
                    e.need_transpose = !need_transpose;

                    // Restore the old need_transpose flag.
                    if (input_e)
                        input_e.need_transpose = need_transpose;
                }
                else
                    this.emit_unary_func_op(ops[0], ops[1], ops[2], "transpose");
                break;

            case Op.SRem: {
                const result_type = ops[0];
                const result_id = ops[1];
                const op0 = ops[2];
                const op1 = ops[3];

                // Needs special handling.
                const forward = this.should_forward(op0) && this.should_forward(op1);
                const expr = this.to_enclosed_expression(op0) + " - " + this.to_enclosed_expression(op1) + " * (" +
                    this.to_enclosed_expression(op0) + " / " + this.to_enclosed_expression(op1) + ")";

                this.emit_op(result_type, result_id, expr, forward);
                this.inherit_expression_dependencies(result_id, op0);
                this.inherit_expression_dependencies(result_id, op1);
                break;
            }

            case Op.SDiv:
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "/", int_type, opcode_is_sign_invariant(opcode));
                break;

            case Op.UDiv:
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "/", uint_type, opcode_is_sign_invariant(opcode));
                break;

            /*case Op.IAddCarry:
            case Op.ISubBorrow: {
                if (options.es && options.version < 310)
                    throw new Error("Extended arithmetic is only available from ESSL 310.");
                else if (!options.es && options.version < 400)
                    throw new Error("Extended arithmetic is only available from GLSL 400.");

                const result_type = ops[0];
                const result_id = ops[1];
                const op0 = ops[2];
                const op1 = ops[3];
                const type = this.get<SPIRType>(SPIRType, result_type);
                this.emit_uninitialized_temporary_expression(result_type, result_id);
                const op = opcode === Op.IAddCarry ? "uaddCarry" : "usubBorrow";

                this.statement(this.to_expression(result_id), ".", this.to_member_name(type, 0), " = ", op, "(", this.to_expression(op0), ", ",
                    this.to_expression(op1), ", ", this.to_expression(result_id), ".", this.to_member_name(type, 1),
                     ");");

                break;
            }

            case Op.UMulExtended:
            case Op.SMulExtended: {
                if (options.es && options.version < 310)
                    throw new Error("Extended arithmetic is only available from ESSL 310.");
                else if (!options.es && options.version < 400)
                    throw new Error("Extended arithmetic is only available from GLSL 4000.");

                const result_type = ops[0];
                const result_id = ops[1];
                const op0 = ops[2];
                const op1 = ops[3];
                const type = this.get<SPIRType>(SPIRType, result_type);
                this.emit_uninitialized_temporary_expression(result_type, result_id);
                const op = opcode === Op.UMulExtended ? "umulExtended" : "imulExtended";

                this.statement(op, "(", this.to_expression(op0), ", ", this.to_expression(op1), ", ", this.to_expression(result_id), ".",
                    this.to_member_name(type, 1), ", ", this.to_expression(result_id), ".", this.to_member_name(type, 0), ");");
                break;
            }*/

            case Op.FDiv:
                this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "/");
                break;

            case Op.ShiftRightLogical:
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], ">>", uint_type, opcode_is_sign_invariant(opcode));
                break;

            case Op.ShiftRightArithmetic:
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "+", int_type, opcode_is_sign_invariant(opcode));
                break;

            case Op.ShiftLeftLogical: {
                const type = this.get<SPIRType>(SPIRType, ops[0]).basetype;
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "<<", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.BitwiseOr: {
                const type = this.get<SPIRType>(SPIRType, ops[0]).basetype;
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "|", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.BitwiseXor: {
                const type = this.get<SPIRType>(SPIRType, ops[0]).basetype;
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "^", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.BitwiseAnd: {
                const type = this.get<SPIRType>(SPIRType, ops[0]).basetype;
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "&", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.Not:
                this.emit_unary_op(ops[0], ops[1], ops[2], "~");
                break;

            case Op.UMod:
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "%", uint_type, opcode_is_sign_invariant(opcode));
                break;

            case Op.SMod:
                this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "%", int_type, opcode_is_sign_invariant(opcode));
                break;

            case Op.FMod:
                this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "mod");
                break;

            case Op.FRem: {
                if (this.is_legacy())
                    throw new Error("OpFRem requires trunc() and is only supported on non-legacy targets. A" +
                        " workaround is needed for legacy.");

                const result_type = ops[0];
                const result_id = ops[1];
                const op0 = ops[2];
                const op1 = ops[3];

                // Needs special handling.
                const forward = this.should_forward(op0) && this.should_forward(op1);
                const expr = this.to_enclosed_expression(op0) + " - " + this.to_enclosed_expression(op1) + " * trunc(" +
                    this.to_enclosed_expression(op0) + " / " + this.to_enclosed_expression(op1) + ")";

                this.emit_op(result_type, result_id, expr, forward);
                this.inherit_expression_dependencies(result_id, op0);
                this.inherit_expression_dependencies(result_id, op1);
                break;
            }

            // Relational
            case Op.Any:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "any");
                break;

            case Op.All:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "all");
                break;

            case Op.Select:
                this.emit_mix_op(ops[0], ops[1], ops[4], ops[3], ops[2]);
                break;

            case Op.LogicalOr: {
                // No vector variant in GLSL for logical OR.
                const result_type = ops[0];
                const id = ops[1];
                const type = this.get<SPIRType>(SPIRType, result_type);

                if (type.vecsize > 1)
                    this.emit_unrolled_binary_op(result_type, id, ops[2], ops[3], "||", false, SPIRBaseType.Unknown);
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "||");
                break;
            }

            case Op.LogicalAnd: {
                // No vector variant in GLSL for logical AND.
                const result_type = ops[0];
                const id = ops[1];
                const type = this.get<SPIRType>(SPIRType, result_type);

                if (type.vecsize > 1)
                    this.emit_unrolled_binary_op(result_type, id, ops[2], ops[3], "&&", false, SPIRBaseType.Unknown);
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "&&");
                break;
            }

            case Op.LogicalNot: {
                const type = this.get<SPIRType>(SPIRType, ops[0]);
                if (type.vecsize > 1)
                    this.emit_unary_func_op(ops[0], ops[1], ops[2], "not ");
                else
                    this.emit_unary_op(ops[0], ops[1], ops[2], "!");
                break;
            }

            case Op.IEqual: {
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op_cast(ops[0], ops[1], ops[2], ops[3], "equal", int_type, opcode_is_sign_invariant(opcode));
                else
                    this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "==", int_type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.LogicalEqual:
            case Op.FOrdEqual: {
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "equal");
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "==");
                break;
            }

            case Op.INotEqual: {
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op_cast(ops[0], ops[1], ops[2], ops[3], "notEqual", int_type, opcode_is_sign_invariant(opcode));
                else
                    this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "!=", int_type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.LogicalNotEqual:
            case Op.FOrdNotEqual: {
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "notEqual");
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "!=");
                break;
            }

            case Op.UGreaterThan:
            case Op.SGreaterThan: {
                const type = opcode === Op.UGreaterThan ? uint_type : int_type;
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op_cast(ops[0], ops[1], ops[2], ops[3], "greaterThan", type, opcode_is_sign_invariant(opcode));
                else
                    this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], ">", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.FOrdGreaterThan: {
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "greaterThan");
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], ">");
                break;
            }

            case Op.UGreaterThanEqual:
            case Op.SGreaterThanEqual: {
                const type = opcode === Op.UGreaterThanEqual ? uint_type : int_type;
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op_cast(ops[0], ops[1], ops[2], ops[3], "greaterThanEqual", type, opcode_is_sign_invariant(opcode));
                else
                    this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], ">=", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.FOrdGreaterThanEqual: {
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "greaterThanEqual");
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], ">=");
                break;
            }

            case Op.ULessThan:
            case Op.SLessThan: {
                const type = opcode === Op.ULessThan ? uint_type : int_type;
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op_cast(ops[0], ops[1], ops[2], ops[3], "lessThan", type, opcode_is_sign_invariant(opcode));
                else
                    this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "<", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.FOrdLessThan: {
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "lessThan");
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "<");
                break;
            }

            case Op.ULessThanEqual:
            case Op.SLessThanEqual: {
                const type = opcode === Op.ULessThanEqual ? uint_type : int_type;
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op_cast(ops[0], ops[1], ops[2], ops[3], "lessThanEqual", type, opcode_is_sign_invariant(opcode));
                else
                    this.emit_binary_op_cast(ops[0], ops[1], ops[2], ops[3], "<=", type, opcode_is_sign_invariant(opcode));
                break;
            }

            case Op.FOrdLessThanEqual: {
                if (this.expression_type(ops[2]).vecsize > 1)
                    this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "lessThanEqual");
                else
                    this.emit_binary_op(ops[0], ops[1], ops[2], ops[3], "<=");
                break;
            }

            // Conversion
            case Op.SConvert:
            case Op.ConvertSToF:
            case Op.UConvert:
            case Op.ConvertUToF: {
                const input_type = opcode === Op.SConvert || opcode === Op.ConvertSToF ? int_type : uint_type;
                const result_type = ops[0];
                const id = ops[1];

                const type = this.get<SPIRType>(SPIRType, result_type);
                const arg_type = this.expression_type(ops[2]);
                const func = this.type_to_glsl_constructor(type);

                if (arg_type.width < type.width || type_is_floating_point(type))
                    this.emit_unary_func_op_cast(result_type, id, ops[2], func, input_type, type.basetype);
                else
                    this.emit_unary_func_op(result_type, id, ops[2], func);
                break;
            }

            case Op.ConvertFToU:
            case Op.ConvertFToS: {
                // Cast to expected arithmetic type, then potentially bitcast away to desired signedness.
                const result_type = ops[0];
                const id = ops[1];
                const type = this.get<SPIRType>(SPIRType, result_type);
                const expected_type = defaultClone(SPIRType, type);
                const float_type = this.expression_type(ops[2]);
                expected_type.basetype = opcode === Op.ConvertFToS ? to_signed_basetype(type.width) : to_unsigned_basetype(type.width);

                const func = this.type_to_glsl_constructor(expected_type);
                this.emit_unary_func_op_cast(result_type, id, ops[2], func, float_type.basetype, expected_type.basetype);
                break;
            }

            case Op.FConvert: {
                const result_type = ops[0];
                const id = ops[1];

                const func = this.type_to_glsl_constructor(this.get<SPIRType>(SPIRType, result_type));
                this.emit_unary_func_op(result_type, id, ops[2], func);
                break;
            }

            case Op.Bitcast: {
                const result_type = ops[0];
                const id = ops[1];
                const arg = ops[2];

                if (!this.emit_complex_bitcast(result_type, id, arg)) {
                    const op = this.bitcast_glsl_op(this.get<SPIRType>(SPIRType, result_type), this.expression_type(arg));
                    this.emit_unary_func_op(result_type, id, arg, op);
                }
                break;
            }

            case Op.QuantizeToF16: {
                const result_type = ops[0];
                const id = ops[1];
                const arg = ops[2];

                let op = "";
                const type = this.get<SPIRType>(SPIRType, result_type);

                switch (type.vecsize) {
                    case 1:
                        op = "unpackHalf2x16(packHalf2x16(vec2(" + this.to_expression(arg) + "))).x";
                        break;
                    case 2:
                        op = "unpackHalf2x16(packHalf2x16(" + this.to_expression(arg) + "))";
                        break;
                    case 3: {
                        const op0 = "unpackHalf2x16(packHalf2x16(" + this.to_expression(arg) + ".xy))";
                        const op1 = "unpackHalf2x16(packHalf2x16(" + this.to_expression(arg) + ".zz)).x";
                        op = "vec3(" + op0 + ", " + op1 + ")";
                        break;
                    }
                    case 4: {
                        const op0 = "unpackHalf2x16(packHalf2x16(" + this.to_expression(arg) + ".xy))";
                        const op1 = "unpackHalf2x16(packHalf2x16(" + this.to_expression(arg) + ".zw))";
                        op = "vec4(" + op0 + ", " + op1 + ")";
                        break;
                    }
                    default:
                        throw new Error("Illegal argument to OpQuantizeToF16.");
                }

                this.emit_op(result_type, id, op, this.should_forward(arg));
                this.inherit_expression_dependencies(id, arg);
                break;
            }

            // Derivatives
            case Op.DPdx:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "dFdx");
                if (this.is_legacy_es())
                    this.require_extension_internal("GL_OES_standard_derivatives");
                this.register_control_dependent_expression(ops[1]);
                break;

            case Op.DPdy:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "dFdy");
                if (this.is_legacy_es())
                    this.require_extension_internal("GL_OES_standard_derivatives");
                this.register_control_dependent_expression(ops[1]);
                break;

            /*case Op.DPdxFine:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "dFdxFine");
                if (options.es) {
                    throw new Error("GL_ARB_derivative_control is unavailable in OpenGL ES.");
                }
                if (options.version < 450)
                    this.require_extension_internal("GL_ARB_derivative_control");
                this.register_control_dependent_expression(ops[1]);
                break;

            case Op.DPdyFine:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "dFdyFine");
                if (options.es) {
                    throw new Error("GL_ARB_derivative_control is unavailable in OpenGL ES.");
                }
                if (options.version < 450)
                    this.require_extension_internal("GL_ARB_derivative_control");
                this.register_control_dependent_expression(ops[1]);
                break;

            case Op.DPdxCoarse:
                if (options.es) {
                    throw new Error("GL_ARB_derivative_control is unavailable in OpenGL ES.");
                }
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "dFdxCoarse");
                if (options.version < 450)
                    this.require_extension_internal("GL_ARB_derivative_control");
                this.register_control_dependent_expression(ops[1]);
                break;

            case Op.DPdyCoarse:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "dFdyCoarse");
                if (options.es) {
                    throw new Error("GL_ARB_derivative_control is unavailable in OpenGL ES.");
                }
                if (options.version < 450)
                    this.require_extension_internal("GL_ARB_derivative_control");
                this.register_control_dependent_expression(ops[1]);
                break;*/

            case Op.Fwidth:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "fwidth");
                if (this.is_legacy_es())
                    this.require_extension_internal("GL_OES_standard_derivatives");
                this.register_control_dependent_expression(ops[1]);
                break;

            /*case Op.FwidthCoarse:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "fwidthCoarse");
                if (options.es) {
                    throw new Error("GL_ARB_derivative_control is unavailable in OpenGL ES.");
                }
                if (options.version < 450)
                    this.require_extension_internal("GL_ARB_derivative_control");
                this.register_control_dependent_expression(ops[1]);
                break;

            case Op.FwidthFine:
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "fwidthFine");
                if (options.es) {
                    throw new Error("GL_ARB_derivative_control is unavailable in OpenGL ES.");
                }
                if (options.version < 450)
                    this.require_extension_internal("GL_ARB_derivative_control");
                this.register_control_dependent_expression(ops[1]);
                break;*/

            // Bitfield
            case Op.BitFieldInsert: {
                this.emit_bitfield_insert_op(ops[0], ops[1], ops[2], ops[3], ops[4], ops[5], "bitfieldInsert", SPIRBaseType.Int);
                break;
            }

            case Op.BitFieldSExtract: {
                this.emit_trinary_func_op_bitextract(ops[0], ops[1], ops[2], ops[3], ops[4], "bitfieldExtract", int_type, int_type,
                    SPIRBaseType.Int, SPIRBaseType.Int);
                break;
            }

            case Op.BitFieldUExtract: {
                this.emit_trinary_func_op_bitextract(ops[0], ops[1], ops[2], ops[3], ops[4], "bitfieldExtract", uint_type, uint_type,
                    SPIRBaseType.Int, SPIRBaseType.Int);
                break;
            }

            case Op.BitReverse:
                // BitReverse does not have issues with sign since result type must match input type.
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "bitfieldReverse");
                break;

            case Op.BitCount: {
                const basetype = this.expression_type(ops[2]).basetype;
                this.emit_unary_func_op_cast(ops[0], ops[1], ops[2], "bitCount", basetype, int_type);
                break;
            }

            // Atomics
            /*case Op.AtomicExchange:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                uint32_t ptr = ops[2];
                // Ignore semantics for now, probably only relevant to CL.
                uint32_t val = ops[5];
                const char *op = check_atomic_image(ptr) ? "imageAtomicExchange" : "atomicExchange";

                emit_atomic_func_op(result_type, id, ptr, val, op);
                break;
            }

            case Op.AtomicCompareExchange:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                uint32_t ptr = ops[2];
                uint32_t val = ops[6];
                uint32_t comp = ops[7];
                const char *op = check_atomic_image(ptr) ? "imageAtomicCompSwap" : "atomicCompSwap";

                emit_atomic_func_op(result_type, id, ptr, comp, val, op);
                break;
            }

            case Op.AtomicLoad:
            {
                // In plain GLSL, we have no atomic loads, so emulate this by fetch adding by 0 and hope compiler figures it out.
                // Alternatively, we could rely on KHR_memory_model, but that's not very helpful for GL.
                auto &type = expression_type(ops[2]);
                forced_temporaries.insert(ops[1]);
                bool atomic_image = check_atomic_image(ops[2]);
                bool unsigned_type = (type.basetype === SPIRBaseType.UInt) ||
                (atomic_image && get<SPIRType>(type.image.type).basetype === SPIRBaseType.UInt);
                const char *op = atomic_image ? "imageAtomicAdd" : "atomicAdd";
                const char *increment = unsigned_type ? "0u" : "0";
                emit_op(ops[0], ops[1],
                    join(op, "(",
                        to_non_uniform_aware_expression(ops[2]), ", ", increment, ")"), false);
                flush_all_atomic_capable_variables();
                break;
            }

            case Op.AtomicStore:
            {
                // In plain GLSL, we have no atomic stores, so emulate this with an atomic exchange where we don't consume the result.
                // Alternatively, we could rely on KHR_memory_model, but that's not very helpful for GL.
                uint32_t ptr = ops[0];
                // Ignore semantics for now, probably only relevant to CL.
                uint32_t val = ops[3];
                const char *op = check_atomic_image(ptr) ? "imageAtomicExchange" : "atomicExchange";
                statement(op, "(", to_non_uniform_aware_expression(ptr), ", ", to_expression(val), ");");
                flush_all_atomic_capable_variables();
                break;
            }

            case Op.AtomicIIncrement:
                case Op.AtomicIDecrement:
            {
                forced_temporaries.insert(ops[1]);
                auto &type = expression_type(ops[2]);
                if (type.storage === StorageClassAtomicCounter)
                {
                    // Legacy GLSL stuff, not sure if this is relevant to support.
                    if (opcode === Op.AtomicIIncrement)
                        this.emit_unary_func_op(ops[0], ops[1], ops[2], "atomicCounterIncrement");
                    else
                        this.emit_unary_func_op(ops[0], ops[1], ops[2], "atomicCounterDecrement");
                }
                else
                {
                    bool atomic_image = check_atomic_image(ops[2]);
                    bool unsigned_type = (type.basetype === SPIRBaseType.UInt) ||
                    (atomic_image && get<SPIRType>(type.image.type).basetype === SPIRBaseType.UInt);
                    const char *op = atomic_image ? "imageAtomicAdd" : "atomicAdd";

                    const char *increment = nullptr;
                    if (opcode === OpAtomicIIncrement && unsigned_type)
                        increment = "1u";
                    else if (opcode === OpAtomicIIncrement)
                        increment = "1";
                    else if (unsigned_type)
                        increment = "uint(-1)";
                    else
                        increment = "-1";

                    emit_op(ops[0], ops[1],
                        join(op, "(", to_non_uniform_aware_expression(ops[2]), ", ", increment, ")"), false);
                }

                flush_all_atomic_capable_variables();
                break;
            }

            case Op.AtomicIAdd:
            {
                const char *op = check_atomic_image(ops[2]) ? "imageAtomicAdd" : "atomicAdd";
                emit_atomic_func_op(ops[0], ops[1], ops[2], ops[5], op);
                break;
            }

            case Op.AtomicISub:
            {
                const char *op = check_atomic_image(ops[2]) ? "imageAtomicAdd" : "atomicAdd";
                forced_temporaries.insert(ops[1]);
                auto expr = join(op, "(", to_non_uniform_aware_expression(ops[2]), ", -", to_enclosed_expression(ops[5]), ")");
                emit_op(ops[0], ops[1], expr, should_forward(ops[2]) && should_forward(ops[5]));
                flush_all_atomic_capable_variables();
                break;
            }

            case Op.AtomicSMin:
                case Op.AtomicUMin:
            {
                const char *op = check_atomic_image(ops[2]) ? "imageAtomicMin" : "atomicMin";
                emit_atomic_func_op(ops[0], ops[1], ops[2], ops[5], op);
                break;
            }

            case Op.AtomicSMax:
                case Op.AtomicUMax:
            {
                const char *op = check_atomic_image(ops[2]) ? "imageAtomicMax" : "atomicMax";
                emit_atomic_func_op(ops[0], ops[1], ops[2], ops[5], op);
                break;
            }

            case Op.AtomicAnd:
            {
                const char *op = check_atomic_image(ops[2]) ? "imageAtomicAnd" : "atomicAnd";
                emit_atomic_func_op(ops[0], ops[1], ops[2], ops[5], op);
                break;
            }

            case Op.AtomicOr:
            {
                const char *op = check_atomic_image(ops[2]) ? "imageAtomicOr" : "atomicOr";
                emit_atomic_func_op(ops[0], ops[1], ops[2], ops[5], op);
                break;
            }

            case Op.AtomicXor:
            {
                const char *op = check_atomic_image(ops[2]) ? "imageAtomicXor" : "atomicXor";
                emit_atomic_func_op(ops[0], ops[1], ops[2], ops[5], op);
                break;
            }

                // Geometry shaders
            case Op.EmitVertex:
                statement("EmitVertex();");
                break;

            case Op.EndPrimitive:
                statement("EndPrimitive();");
                break;

            case Op.EmitStreamVertex:
            {
                if (options.es)
                    throw new Error("Multi-stream geometry shaders not supported in ES.");
                else if (!options.es && options.version < 400)
                    throw new Error("Multi-stream geometry shaders only supported in GLSL 400.");

                auto stream_expr = to_expression(ops[0]);
                if (expression_type(ops[0]).basetype !== SPIRBaseType.Int)
                    stream_expr = join("int(", stream_expr, ")");
                statement("EmitStreamVertex(", stream_expr, ");");
                break;
            }

            case Op.EndStreamPrimitive:
            {
                if (options.es)
                    throw new Error("Multi-stream geometry shaders not supported in ES.");
                else if (!options.es && options.version < 400)
                    throw new Error("Multi-stream geometry shaders only supported in GLSL 400.");

                auto stream_expr = to_expression(ops[0]);
                if (expression_type(ops[0]).basetype !== SPIRBaseType.Int)
                    stream_expr = join("int(", stream_expr, ")");
                statement("EndStreamPrimitive(", stream_expr, ");");
                break;
            }*/

            // Textures
            case Op.ImageSampleExplicitLod:
            case Op.ImageSampleProjExplicitLod:
            case Op.ImageSampleDrefExplicitLod:
            case Op.ImageSampleProjDrefExplicitLod:
            case Op.ImageSampleImplicitLod:
            case Op.ImageSampleProjImplicitLod:
            case Op.ImageSampleDrefImplicitLod:
            case Op.ImageSampleProjDrefImplicitLod:
            case Op.ImageFetch:
            case Op.ImageGather:
            case Op.ImageDrefGather:
                // Gets a bit hairy, so move this to a separate instruction.
                this.emit_texture_op(instruction, false);
                break;

            case Op.ImageSparseSampleExplicitLod:
            case Op.ImageSparseSampleProjExplicitLod:
            case Op.ImageSparseSampleDrefExplicitLod:
            case Op.ImageSparseSampleProjDrefExplicitLod:
            case Op.ImageSparseSampleImplicitLod:
            case Op.ImageSparseSampleProjImplicitLod:
            case Op.ImageSparseSampleDrefImplicitLod:
            case Op.ImageSparseSampleProjDrefImplicitLod:
            case Op.ImageSparseFetch:
            case Op.ImageSparseGather:
            case Op.ImageSparseDrefGather:
                // Gets a bit hairy, so move this to a separate instruction.
                this.emit_texture_op(instruction, true);
                break;

            /*case Op.ImageSparseTexelsResident:
                if (options.es)
                    throw new Error("Sparse feedback is not supported in GLSL.");
                this.require_extension_internal("GL_ARB_sparse_texture2");
                this.emit_unary_func_op_cast(ops[0], ops[1], ops[2], "sparseTexelsResidentARB", int_type, SPIRBaseType.Boolean);
                break;*/

            case Op.Image: {
                const result_type = ops[0];
                const id = ops[1];

                // Suppress usage tracking.
                const e = this.emit_op(result_type, id, this.to_expression(ops[2]), true, true);

                // When using the image, we need to know which variable it is actually loaded from.
                const var_ = this.maybe_get_backing_variable(ops[2]);
                e.loaded_from = var_ ? var_.self : <ID>(0);
                break;
            }

            /*case Op.ImageQueryLod: {
                let op: string = null;
                if (!options.es && options.version < 400) {
                    this.require_extension_internal("GL_ARB_texture_query_lod");
                    // For some reason, the ARB spec is all-caps.
                    op = "textureQueryLOD";
                }
                else if (options.es)
                    throw new Error("textureQueryLod not supported in ES profile.");
                else
                    op = "textureQueryLod";

                let sampler_expr = this.to_expression(ops[2]);
                if (this.has_decoration(ops[2], Decoration.NonUniform)) {
                    if (this.maybe_get_backing_variable(ops[2]))
                        sampler_expr = this.convert_non_uniform_expression(sampler_expr, ops[2]);
                    else if (backend.nonuniform_qualifier !== "\0")
                        sampler_expr = backend.nonuniform_qualifier + "(" + sampler_expr + ")";
                }

                const forward = this.should_forward(ops[3]);
                this.emit_op(ops[0], ops[1],
                    op + "(" + sampler_expr + ", " + this.to_unpacked_expression(ops[3]) + ")",
                    forward);
                this.inherit_expression_dependencies(ops[1], ops[2]);
                this.inherit_expression_dependencies(ops[1], ops[3]);
                this.register_control_dependent_expression(ops[1]);
                break;
            }

            case Op.ImageQueryLevels: {
                const result_type = ops[0];
                const id = ops[1];

                if (!options.es && options.version < 430)
                    this.require_extension_internal("GL_ARB_texture_query_levels");
                if (options.es)
                    throw new Error("textureQueryLevels not supported in ES profile.");

                let expr = "textureQueryLevels(" + this.convert_separate_image_to_expression(ops[2]) + ")";
                const restype = this.get<SPIRType>(SPIRType, ops[0]);
                expr = this.bitcast_expression(restype, SPIRBaseType.Int, expr);
                this.emit_op(result_type, id, expr, true);
                break;
            }*/

            case Op.ImageQuerySamples: {
                const type = this.expression_type(ops[2]);
                const result_type = ops[0];
                const id = ops[1];

                let expr: string;
                if (type.image.sampled === 2)
                    expr = "imageSamples(" + this.to_non_uniform_aware_expression(ops[2]) + ")";
                else
                    expr = "textureSamples(" + this.convert_separate_image_to_expression(ops[2]) + ")";

                const restype = this.get<SPIRType>(SPIRType, ops[0]);
                expr = this.bitcast_expression(restype, SPIRBaseType.Int, expr);
                this.emit_op(result_type, id, expr, true);
                break;
            }

            case Op.SampledImage: {
                const result_type = ops[0];
                const id = ops[1];
                this.emit_sampled_image_op(result_type, id, ops[2], ops[3]);
                this.inherit_expression_dependencies(id, ops[2]);
                this.inherit_expression_dependencies(id, ops[3]);
                break;
            }

            case Op.ImageQuerySizeLod: {
                const result_type = ops[0];
                const id = ops[1];
                const img = ops[2];

                let fname = "textureSize";
                /*if (this.is_legacy_desktop()) {
                    const type = this.expression_type(img);
                    const imgtype = this.get<SPIRType>(SPIRType, type.self);
                    fname = this.legacy_tex_op(fname, imgtype, img);
                }
                else */
                if (this.is_legacy_es())
                    throw new Error("textureSize is not supported in ESSL 100.");

                let expr = fname + "(" + this.convert_separate_image_to_expression(img) + ", " + this.bitcast_expression(SPIRBaseType.Int, ops[3]) + ")";
                const restype = this.get<SPIRType>(SPIRType, ops[0]);
                expr = this.bitcast_expression(restype, SPIRBaseType.Int, expr);
                this.emit_op(result_type, id, expr, true);
                break;
            }

            // Image load/store
            case Op.ImageRead:
            case Op.ImageSparseRead: {
                // We added Nonreadable speculatively to the OpImage variable due to glslangValidator
                // not adding the proper qualifiers.
                // If it turns out we need to read the image after all, remove the qualifier and recompile.
                const var_ = this.maybe_get_backing_variable(ops[2]);
                if (var_) {
                    const flags = maplike_get(Meta, ir.meta, var_.self).decoration.decoration_flags;
                    if (flags.get(Decoration.NonReadable)) {
                        flags.clear(Decoration.NonReadable);
                        this.force_recompile();
                    }
                }

                const result_type = ops[0];
                const id = ops[1];

                let pure = false;
                let imgexpr = "";
                const type = this.expression_type(ops[2]);

                if (var_ && var_.remapped_variable) // Remapped input, just read as-is without any op-code
                {
                    if (type.image.ms)
                        throw new Error("Trying to remap multisampled image to variable, this is not possible.");

                    const itr_second = this.pls_inputs.find(pls => pls.id === var_.self);

                    if (!itr_second) {
                        // For non-PLS inputs, we rely on subpass type remapping information to get it right
                        // since ImageRead always returns 4-component vectors and the backing type is opaque.
                        if (!var_.remapped_components)
                            throw new Error("subpassInput was remapped, but remap_components is not set correctly.");
                        imgexpr = this.remap_swizzle(this.get<SPIRType>(SPIRType, result_type), var_.remapped_components, this.to_expression(ops[2]));
                    }
                    else {
                        // PLS input could have different number of components than what the SPIR expects, swizzle to
                        // the appropriate vector size.
                        const components = pls_format_to_components(itr_second.format);
                        imgexpr = this.remap_swizzle(this.get<SPIRType>(SPIRType, result_type), components, this.to_expression(ops[2]));
                    }
                    pure = true;
                }
                else if (type.image.dim === Dim.SubpassData) {
                    if (var_ && this.subpass_input_is_framebuffer_fetch(var_.self)) {
                        imgexpr = this.to_expression(var_.self);
                    }
                    /*else if (options.vulkan_semantics)
                    {
                        // With Vulkan semantics, use the proper Vulkan GLSL construct.
                        if (type.image.ms)
                        {
                            uint32_t operands = ops[4];
                            if (operands !== Sample || length !== 6)
                                throw new Error("Multisampled image used in OpImageRead, but unexpected "
                            "operand mask was used.");

                            uint32_t samples = ops[5];
                            imgexpr = join("subpassLoad(", to_non_uniform_aware_expression(ops[2]), ", ", to_expression(samples), ")");
                        }
                        else
                            imgexpr = join("subpassLoad(", to_non_uniform_aware_expression(ops[2]), ")");
                    }*/
                    else {
                        if (type.image.ms) {
                            const operands = ops[4];
                            if (operands !== ImageOperandsMask.Sample || length !== 6)
                                throw new Error("Multisampled image used in OpImageRead, but unexpected operand mask was used.");

                            const samples = ops[5];
                            imgexpr = "texelFetch(" + this.to_non_uniform_aware_expression(ops[2]) + ", ivec2(gl_FragCoord.xy), " +
                                this.to_expression(samples) + ")";
                        }
                        else {
                            // Implement subpass loads via texture barrier style sampling.
                            imgexpr = "texelFetch(" + this.to_non_uniform_aware_expression(ops[2]) + ", ivec2(gl_FragCoord.xy), 0)";
                        }
                    }
                    imgexpr = this.remap_swizzle(this.get<SPIRType>(SPIRType, result_type), 4, imgexpr);
                    pure = true;
                }
                else {
                    const sparse = opcode === Op.ImageSparseRead;
                    const props = { sparse_code_id: 0, sparse_texel_id: 0 };
                    if (sparse)
                        this.emit_sparse_feedback_temporaries(ops[0], ops[1], props);

                    // imageLoad only accepts int coords, not uint.
                    let coord_expr = this.to_expression(ops[3]);
                    const target_coord_type = defaultClone(SPIRType, this.expression_type(ops[3]));
                    target_coord_type.basetype = SPIRBaseType.Int;
                    coord_expr = this.bitcast_expression(target_coord_type, this.expression_type(ops[3]).basetype, coord_expr);

                    // Plain image load/store.
                    if (sparse) {
                        if (type.image.ms) {
                            const operands = ops[4];
                            if (operands !== ImageOperandsMask.Sample || length !== 6)
                                throw new Error("Multisampled image used in OpImageRead, but unexpected operand mask was used.");

                            const samples = ops[5];
                            this.statement(this.to_expression(props.sparse_code_id), " = sparseImageLoadARB(", this.to_non_uniform_aware_expression(ops[2]), ", ",
                                coord_expr, ", ", this.to_expression(samples), ", ", this.to_expression(props.sparse_texel_id), ");");
                        }
                        else {
                            this.statement(this.to_expression(props.sparse_code_id), " = sparseImageLoadARB(", this.to_non_uniform_aware_expression(ops[2]), ", ",
                                coord_expr, ", ", this.to_expression(props.sparse_texel_id), ");");
                        }
                        imgexpr = this.type_to_glsl(this.get<SPIRType>(SPIRType, result_type)) + "(" + this.to_expression(props.sparse_code_id) +
                            ", " + this.to_expression(props.sparse_texel_id) + ")";
                    }
                    else {
                        if (type.image.ms) {
                            const operands = ops[4];
                            if (operands !== ImageOperandsMask.Sample || length !== 6)
                                throw new Error("Multisampled image used in OpImageRead, but unexpected operand mask was used.");

                            const samples = ops[5];
                            imgexpr = "imageLoad(" + this.to_non_uniform_aware_expression(ops[2]) + ", " + coord_expr + ", " + this.to_expression(samples) + ")";
                        }
                        else
                            imgexpr = "imageLoad(" + this.to_non_uniform_aware_expression(ops[2]) + ", " + coord_expr + ")";
                    }

                    if (!sparse)
                        imgexpr = this.remap_swizzle(this.get<SPIRType>(SPIRType, result_type), 4, imgexpr);
                    pure = false;
                }

                if (var_ && var_.forwardable) {
                    const forward = !this.forced_temporaries.has(id);
                    const e = this.emit_op(result_type, id, imgexpr, forward);

                    // We only need to track dependencies if we're reading from image load/store.
                    if (!pure) {
                        e.loaded_from = var_.self;
                        if (forward)
                            var_.dependees.push(id);
                    }
                }
                else
                    this.emit_op(result_type, id, imgexpr, false);

                this.inherit_expression_dependencies(id, ops[2]);
                if (type.image.ms)
                    this.inherit_expression_dependencies(id, ops[5]);
                break;
            }

            case Op.ImageTexelPointer:
            {
                const result_type = ops[0];
                const id = ops[1];

                let coord_expr = this.to_expression(ops[3]);
                const target_coord_type = defaultClone(SPIRType, this.expression_type(ops[3]));
                target_coord_type.basetype = SPIRBaseType.Int;
                coord_expr = this.bitcast_expression(target_coord_type, this.expression_type(ops[3]).basetype, coord_expr);

                const expr = this.to_expression(ops[2]) + ", " + coord_expr;
                const e = this.set<SPIRExpression>(SPIRExpression, id, expr, result_type, true);

                // When using the pointer, we need to know which variable it is actually loaded from.
                const var_ = this.maybe_get_backing_variable(ops[2]);
                e.loaded_from = var_ ? var_.self : <ID>(0);
                this.inherit_expression_dependencies(id, ops[3]);
                break;
            }

            case Op.ImageWrite:
            {
                // We added Nonwritable speculatively to the OpImage variable due to glslangValidator
                // not adding the proper qualifiers.
                // If it turns out we need to write to the image after all, remove the qualifier and recompile.
                const var_ = this.maybe_get_backing_variable(ops[0]);
                if (var_)
                {
                    const flags = maplike_get(Meta, ir.meta, var_.self).decoration.decoration_flags;
                    if (flags.get(Decoration.NonWritable))
                    {
                        flags.clear(Decoration.NonWritable);
                        this.force_recompile();
                    }
                }

                const type = this.expression_type(ops[0]);
                const value_type = this.expression_type(ops[2]);
                const store_type = defaultClone(SPIRType, value_type);
                store_type.vecsize = 4;

                // imageStore only accepts int coords, not uint.
                let coord_expr = this.to_expression(ops[1]);
                const target_coord_type = defaultClone(SPIRType, this.expression_type(ops[1]));
                target_coord_type.basetype = SPIRBaseType.Int;
                coord_expr = this.bitcast_expression(target_coord_type, this.expression_type(ops[1]).basetype, coord_expr);

                if (type.image.ms)
                {
                    const operands = ops[3];
                    if (operands !== ImageOperandsMask.Sample || length !== 5)
                        throw new Error("Multisampled image used in OpImageWrite, but unexpected operand mask was used.");
                    const samples = ops[4];
                    this.statement("imageStore(", this.to_non_uniform_aware_expression(ops[0]), ", ", coord_expr, ", ",
                        this.to_expression(samples), ", ", this.remap_swizzle(store_type, value_type.vecsize, this.to_expression(ops[2])), ");");
                }
                else
                    this.statement("imageStore(", this.to_non_uniform_aware_expression(ops[0]), ", ", coord_expr, ", ",
                        this.remap_swizzle(store_type, value_type.vecsize, this.to_expression(ops[2])), ");");

                if (var_ && this.variable_storage_is_aliased(var_))
                    this.flush_all_aliased_variables();
                break;
            }

            case Op.ImageQuerySize:
            {
                const type = this.expression_type(ops[2]);
                const result_type = ops[0];
                const id = ops[1];

                if (type.basetype === SPIRBaseType.Image)
                {
                    let expr: string;
                    if (type.image.sampled === 2)
                    {
                        /*if (!options.es && options.version < 430)
                            this.require_extension_internal("GL_ARB_shader_image_size");
                        else if (options.es && options.version < 310)*/
                            throw new Error("At least ESSL 3.10 required for imageSize.");

                        // The size of an image is always constant.
                        // expr = "imageSize(" + this.to_non_uniform_aware_expression(ops[2]) + ")";
                    }
                    else
                    {
                        // This path is hit for samplerBuffers and multisampled images which do not have LOD.
                        let fname = "textureSize";
                        if (this.is_legacy())
                        {
                            const imgtype = this.get<SPIRType>(SPIRType, type.self);
                            fname = this.legacy_tex_op(fname, imgtype, ops[2]);
                        }
                        expr = fname + "(" + this.convert_separate_image_to_expression(ops[2]) + ")";
                    }

                    const restype = this.get<SPIRType>(SPIRType, ops[0]);
                    expr = this.bitcast_expression(restype, SPIRBaseType.Int, expr);
                    this.emit_op(result_type, id, expr, true);
                }
                else
                    throw new Error("Invalid type for OpImageQuerySize.");
                break;
            }

                // Compute
            /*case Op.ControlBarrier:
            case Op.MemoryBarrier:
            {
                let execution_scope = 0;
                let memory = 0;
                let semantics = 0;

                if (opcode === Op.MemoryBarrier)
                {
                    memory = this.evaluate_constant_u32(ops[0]);
                    semantics = this.evaluate_constant_u32(ops[1]);
                }
                else
                {
                    execution_scope = this.evaluate_constant_u32(ops[0]);
                    memory = this.evaluate_constant_u32(ops[1]);
                    semantics = this.evaluate_constant_u32(ops[2]);
                }

                if (execution_scope === Subgroup || memory === Subgroup)
                {
                    // OpControlBarrier with Subgroup is subgroupBarrier()
                    if (opcode !== OpControlBarrier)
                    {
                        request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMemBarrier);
                    }
                    else
                    {
                        request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupBarrier);
                    }
                }

                if (execution_scope !== Subgroup && get_entry_point().model === ExecutionModelTessellationControl)
                {
                    // Control shaders only have barriers, and it implies memory barriers.
                    if (opcode === OpControlBarrier)
                        statement("barrier();");
                    break;
                }

                // We only care about these flags, acquire/release and friends are not relevant to GLSL.
                semantics = mask_relevant_memory_semantics(semantics);

                if (opcode === OpMemoryBarrier)
                {
                    // If we are a memory barrier, and the next instruction is a control barrier, check if that memory barrier
                    // does what we need, so we avoid redundant barriers.
                    const Instruction *next = get_next_instruction_in_block(instruction);
                    if (next && next->op === OpControlBarrier)
                    {
                        auto *next_ops = stream(*next);
                        uint32_t next_memory = evaluate_constant_u32(next_ops[1]);
                        uint32_t next_semantics = evaluate_constant_u32(next_ops[2]);
                        next_semantics = mask_relevant_memory_semantics(next_semantics);

                        bool memory_scope_covered = false;
                        if (next_memory === memory)
                            memory_scope_covered = true;
                        else if (next_semantics === MemorySemanticsWorkgroupMemoryMask)
                        {
                            // If we only care about workgroup memory, either Device or Workgroup scope is fine,
                            // scope does not have to match.
                            if ((next_memory === Device || next_memory === Workgroup) &&
                                (memory === Device || memory === Workgroup))
                            {
                                memory_scope_covered = true;
                            }
                        }
                        else if (memory === Workgroup && next_memory === Device)
                        {
                            // The control barrier has device scope, but the memory barrier just has workgroup scope.
                            memory_scope_covered = true;
                        }

                        // If we have the same memory scope, and all memory types are covered, we're good.
                        if (memory_scope_covered && (semantics & next_semantics) === semantics)
                            break;
                    }
                }

                // We are synchronizing some memory or syncing execution,
                // so we cannot forward any loads beyond the memory barrier.
                if (semantics || opcode === OpControlBarrier)
                {
                    assert(current_emitting_block);
                    flush_control_dependent_expressions(current_emitting_block->self);
                    flush_all_active_variables();
                }

                if (memory === Workgroup) // Only need to consider memory within a group
                {
                    if (semantics === MemorySemanticsWorkgroupMemoryMask)
                    {
                        // OpControlBarrier implies a memory barrier for shared memory as well.
                        bool implies_shared_barrier = opcode === OpControlBarrier && execution_scope === Workgroup;
                        if (!implies_shared_barrier)
                            statement("memoryBarrierShared();");
                    }
                    else if (semantics !== 0)
                        statement("groupMemoryBarrier();");
                }
                else if (memory === Subgroup)
                {
                    const uint32_t all_barriers =
                    MemorySemanticsWorkgroupMemoryMask | MemorySemanticsUniformMemoryMask | MemorySemanticsImageMemoryMask;

                    if (semantics & (MemorySemanticsCrossWorkgroupMemoryMask | MemorySemanticsSubgroupMemoryMask))
                    {
                        // These are not relevant for GLSL, but assume it means memoryBarrier().
                        // memoryBarrier() does everything, so no need to test anything else.
                        statement("subgroupMemoryBarrier();");
                    }
                    else if ((semantics & all_barriers) === all_barriers)
                    {
                        // Short-hand instead of emitting 3 barriers.
                        statement("subgroupMemoryBarrier();");
                    }
                    else
                    {
                        // Pick out individual barriers.
                        if (semantics & MemorySemanticsWorkgroupMemoryMask)
                            statement("subgroupMemoryBarrierShared();");
                        if (semantics & MemorySemanticsUniformMemoryMask)
                            statement("subgroupMemoryBarrierBuffer();");
                        if (semantics & MemorySemanticsImageMemoryMask)
                            statement("subgroupMemoryBarrierImage();");
                    }
                }
                else
                {
                    const uint32_t all_barriers =
                    MemorySemanticsWorkgroupMemoryMask | MemorySemanticsUniformMemoryMask | MemorySemanticsImageMemoryMask;

                    if (semantics & (MemorySemanticsCrossWorkgroupMemoryMask | MemorySemanticsSubgroupMemoryMask))
                    {
                        // These are not relevant for GLSL, but assume it means memoryBarrier().
                        // memoryBarrier() does everything, so no need to test anything else.
                        statement("memoryBarrier();");
                    }
                    else if ((semantics & all_barriers) === all_barriers)
                    {
                        // Short-hand instead of emitting 4 barriers.
                        statement("memoryBarrier();");
                    }
                    else
                    {
                        // Pick out individual barriers.
                        if (semantics & MemorySemanticsWorkgroupMemoryMask)
                            statement("memoryBarrierShared();");
                        if (semantics & MemorySemanticsUniformMemoryMask)
                            statement("memoryBarrierBuffer();");
                        if (semantics & MemorySemanticsImageMemoryMask)
                            statement("memoryBarrierImage();");
                    }
                }

                if (opcode === OpControlBarrier)
                {
                    if (execution_scope === Subgroup)
                        statement("subgroupBarrier();");
                    else
                        statement("barrier();");
                }
                break;
            }*/

            case Op.ExtInst:
            {
                const extension_set = ops[2];

                const ext = this.get<SPIRExtension>(SPIRExtension, extension_set).ext;
                // const ops4 = ops.slice(4);

                if (ext === SPIRExtensionExtension.GLSL)
                {
                    this.emit_glsl_op(ops[0], ops[1], ops[3], ops, 4, length - 4);
                }
                /*else if (ext === SPIRExtensionExtension.SPV_AMD_shader_ballot)
                {
                    this.emit_spv_amd_shader_ballot_op(ops[0], ops[1], ops[3], ops, 4, length - 4);
                }
                else if (ext === SPIRExtensionExtension.SPV_AMD_shader_explicit_vertex_parameter)
                {
                    this.emit_spv_amd_shader_explicit_vertex_parameter_op(ops[0], ops[1], ops[3], ops, 4, length - 4);
                }
                else if (ext === SPIRExtensionExtension.SPV_AMD_shader_trinary_minmax)
                {
                    this.emit_spv_amd_shader_trinary_minmax_op(ops[0], ops[1], ops[3], ops, 4, length - 4);
                }
                else if (ext === SPIRExtensionExtension.SPV_AMD_gcn_shader)
                {
                    this.emit_spv_amd_gcn_shader_op(ops[0], ops[1], ops[3], ops, 4, length - 4);
                }*/
                else if (ext === SPIRExtensionExtension.SPV_debug_info)
                {
                    break; // Ignore SPIR-V debug information extended instructions.
                }
                else
                {
                    this.statement("// unimplemented ext op ", instruction.op);
                    break;
                }

                break;
            }

                // Legacy sub-group stuff ...
            /*case OpSubgroupBallotKHR:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                string expr;
                expr = join("uvec4(unpackUint2x32(ballotARB(" + to_expression(ops[2]) + ")), 0u, 0u)");
                emit_op(result_type, id, expr, should_forward(ops[2]));

                require_extension_internal("GL_ARB_shader_ballot");
                inherit_expression_dependencies(id, ops[2]);
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpSubgroupFirstInvocationKHR:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                emit_unary_func_op(result_type, id, ops[2], "readFirstInvocationARB");

                require_extension_internal("GL_ARB_shader_ballot");
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpSubgroupReadInvocationKHR:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                emit_binary_func_op(result_type, id, ops[2], ops[3], "readInvocationARB");

                require_extension_internal("GL_ARB_shader_ballot");
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpSubgroupAllKHR:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                emit_unary_func_op(result_type, id, ops[2], "allInvocationsARB");

                require_extension_internal("GL_ARB_shader_group_vote");
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpSubgroupAnyKHR:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                emit_unary_func_op(result_type, id, ops[2], "anyInvocationARB");

                require_extension_internal("GL_ARB_shader_group_vote");
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpSubgroupAllEqualKHR:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                emit_unary_func_op(result_type, id, ops[2], "allInvocationsEqualARB");

                require_extension_internal("GL_ARB_shader_group_vote");
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpGroupIAddNonUniformAMD:
                case OpGroupFAddNonUniformAMD:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                emit_unary_func_op(result_type, id, ops[4], "addInvocationsNonUniformAMD");

                require_extension_internal("GL_AMD_shader_ballot");
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpGroupFMinNonUniformAMD:
                case OpGroupUMinNonUniformAMD:
                case OpGroupSMinNonUniformAMD:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                emit_unary_func_op(result_type, id, ops[4], "minInvocationsNonUniformAMD");

                require_extension_internal("GL_AMD_shader_ballot");
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpGroupFMaxNonUniformAMD:
                case OpGroupUMaxNonUniformAMD:
                case OpGroupSMaxNonUniformAMD:
            {
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];
                emit_unary_func_op(result_type, id, ops[4], "maxInvocationsNonUniformAMD");

                require_extension_internal("GL_AMD_shader_ballot");
                register_control_dependent_expression(ops[1]);
                break;
            }

            case OpFragmentMaskFetchAMD:
            {
                auto &type = expression_type(ops[2]);
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];

                if (type.image.dim === spv::SubpassData)
                {
                    emit_unary_func_op(result_type, id, ops[2], "fragmentMaskFetchAMD");
                }
                else
                {
                    emit_binary_func_op(result_type, id, ops[2], ops[3], "fragmentMaskFetchAMD");
                }

                require_extension_internal("GL_AMD_shader_fragment_mask");
                break;
            }

            case OpFragmentFetchAMD:
            {
                auto &type = expression_type(ops[2]);
                uint32_t result_type = ops[0];
                uint32_t id = ops[1];

                if (type.image.dim === spv::SubpassData)
                {
                    emit_binary_func_op(result_type, id, ops[2], ops[4], "fragmentFetchAMD");
                }
                else
                {
                    emit_trinary_func_op(result_type, id, ops[2], ops[3], ops[4], "fragmentFetchAMD");
                }

                require_extension_internal("GL_AMD_shader_fragment_mask");
                break;
            }

                // Vulkan 1.1 sub-group stuff ...
            case OpGroupNonUniformElect:
                case OpGroupNonUniformBroadcast:
                case OpGroupNonUniformBroadcastFirst:
                case OpGroupNonUniformBallot:
                case OpGroupNonUniformInverseBallot:
                case OpGroupNonUniformBallotBitExtract:
                case OpGroupNonUniformBallotBitCount:
                case OpGroupNonUniformBallotFindLSB:
                case OpGroupNonUniformBallotFindMSB:
                case OpGroupNonUniformShuffle:
                case OpGroupNonUniformShuffleXor:
                case OpGroupNonUniformShuffleUp:
                case OpGroupNonUniformShuffleDown:
                case OpGroupNonUniformAll:
                case OpGroupNonUniformAny:
                case OpGroupNonUniformAllEqual:
                case OpGroupNonUniformFAdd:
                case OpGroupNonUniformIAdd:
                case OpGroupNonUniformFMul:
                case OpGroupNonUniformIMul:
                case OpGroupNonUniformFMin:
                case OpGroupNonUniformFMax:
                case OpGroupNonUniformSMin:
                case OpGroupNonUniformSMax:
                case OpGroupNonUniformUMin:
                case OpGroupNonUniformUMax:
                case OpGroupNonUniformBitwiseAnd:
                case OpGroupNonUniformBitwiseOr:
                case OpGroupNonUniformBitwiseXor:
                case OpGroupNonUniformLogicalAnd:
                case OpGroupNonUniformLogicalOr:
                case OpGroupNonUniformLogicalXor:
                case OpGroupNonUniformQuadSwap:
                case OpGroupNonUniformQuadBroadcast:
                emit_subgroup_op(instruction);
                break;
            */
            case Op.FUnordEqual:
                case Op.FUnordNotEqual:
                case Op.FUnordLessThan:
                case Op.FUnordGreaterThan:
                case Op.FUnordLessThanEqual:
                case Op.FUnordGreaterThanEqual:
            {
                // GLSL doesn't specify if floating point comparisons are ordered or unordered,
                // but glslang always emits ordered floating point compares for GLSL.
                // To get unordered compares, we can test the opposite thing and invert the result.
                // This way, we force true when there is any NaN present.
                const op0 = ops[2];
                const op1 = ops[3];

                let expr: string;
                if (this.expression_type(op0).vecsize > 1)
                {
                    let comp_op: string = null;
                    switch (opcode)
                    {
                        case Op.FUnordEqual:
                            comp_op = "notEqual";
                            break;

                        case Op.FUnordNotEqual:
                            comp_op = "equal";
                            break;

                        case Op.FUnordLessThan:
                            comp_op = "greaterThanEqual";
                            break;

                        case Op.FUnordLessThanEqual:
                            comp_op = "greaterThan";
                            break;

                        case Op.FUnordGreaterThan:
                            comp_op = "lessThanEqual";
                            break;

                        case Op.FUnordGreaterThanEqual:
                            comp_op = "lessThan";
                            break;

                        default:
                            console.assert(0);
                            break;
                    }

                    expr = "not(" + comp_op + "(" + this.to_unpacked_expression(op0) + ", " + this.to_unpacked_expression(op1) + "))";
                }
                else
                {
                    let comp_op = null;
                    switch (opcode)
                    {
                        case Op.FUnordEqual:
                            comp_op = " !== ";
                            break;

                        case Op.FUnordNotEqual:
                            comp_op = " === ";
                            break;

                        case Op.FUnordLessThan:
                            comp_op = " >= ";
                            break;

                        case Op.FUnordLessThanEqual:
                            comp_op = " > ";
                            break;

                        case Op.FUnordGreaterThan:
                            comp_op = " <= ";
                            break;

                        case Op.FUnordGreaterThanEqual:
                            comp_op = " < ";
                            break;

                        default:
                            console.assert(0);
                            break;
                    }

                    expr = "!(" + this.to_enclosed_unpacked_expression(op0) + comp_op + this.to_enclosed_unpacked_expression(op1) + ")";
                }

                this.emit_op(ops[0], ops[1], expr, this.should_forward(op0) && this.should_forward(op1));
                this.inherit_expression_dependencies(ops[1], op0);
                this.inherit_expression_dependencies(ops[1], op1);
                break;
            }

            /*case OpReportIntersectionKHR:
                // NV is same opcode.
                forced_temporaries.insert(ops[1]);
                if (ray_tracing_is_khr)
                    this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "reportIntersectionEXT");
                else
                    this.emit_binary_func_op(ops[0], ops[1], ops[2], ops[3], "reportIntersectionNV");
                flush_control_dependent_expressions(current_emitting_block->self);
                break;
            case OpIgnoreIntersectionNV:
                // KHR variant is a terminator.
                statement("ignoreIntersectionNV();");
                flush_control_dependent_expressions(current_emitting_block->self);
                break;
            case OpTerminateRayNV:
                // KHR variant is a terminator.
                statement("terminateRayNV();");
                flush_control_dependent_expressions(current_emitting_block->self);
                break;
            case OpTraceNV:
                statement("traceNV(", to_non_uniform_aware_expression(ops[0]), ", ", to_expression(ops[1]), ", ", to_expression(ops[2]), ", ",
                    to_expression(ops[3]), ", ", to_expression(ops[4]), ", ", to_expression(ops[5]), ", ",
                    to_expression(ops[6]), ", ", to_expression(ops[7]), ", ", to_expression(ops[8]), ", ",
                    to_expression(ops[9]), ", ", to_expression(ops[10]), ");");
                flush_control_dependent_expressions(current_emitting_block->self);
                break;
            case OpTraceRayKHR:
                if (!has_decoration(ops[10], DecorationLocation))
                    throw new Error("A memory declaration object must be used in TraceRayKHR.");
                statement("traceRayEXT(", to_non_uniform_aware_expression(ops[0]), ", ", to_expression(ops[1]), ", ", to_expression(ops[2]), ", ",
                    to_expression(ops[3]), ", ", to_expression(ops[4]), ", ", to_expression(ops[5]), ", ",
                    to_expression(ops[6]), ", ", to_expression(ops[7]), ", ", to_expression(ops[8]), ", ",
                    to_expression(ops[9]), ", ", get_decoration(ops[10], DecorationLocation), ");");
                flush_control_dependent_expressions(current_emitting_block->self);
                break;
            case OpExecuteCallableNV:
                statement("executeCallableNV(", to_expression(ops[0]), ", ", to_expression(ops[1]), ");");
                flush_control_dependent_expressions(current_emitting_block->self);
                break;
            case OpExecuteCallableKHR:
                if (!has_decoration(ops[1], DecorationLocation))
                    throw new Error("A memory declaration object must be used in ExecuteCallableKHR.");
                statement("executeCallableEXT(", to_expression(ops[0]), ", ", get_decoration(ops[1], DecorationLocation), ");");
                flush_control_dependent_expressions(current_emitting_block->self);
                break;

                // Don't bother forwarding temporaries. Avoids having to test expression invalidation with ray query objects.
            case OpRayQueryInitializeKHR:
                flush_variable_declaration(ops[0]);
                statement("rayQueryInitializeEXT(",
                    to_expression(ops[0]), ", ", to_expression(ops[1]), ", ",
                    to_expression(ops[2]), ", ", to_expression(ops[3]), ", ",
                    to_expression(ops[4]), ", ", to_expression(ops[5]), ", ",
                    to_expression(ops[6]), ", ", to_expression(ops[7]), ");");
                break;
            case OpRayQueryProceedKHR:
                flush_variable_declaration(ops[0]);
                emit_op(ops[0], ops[1], join("rayQueryProceedEXT(", to_expression(ops[2]), ")"), false);
                break;
            case OpRayQueryTerminateKHR:
                flush_variable_declaration(ops[0]);
                statement("rayQueryTerminateEXT(", to_expression(ops[0]), ");");
                break;
            case OpRayQueryGenerateIntersectionKHR:
                flush_variable_declaration(ops[0]);
                statement("rayQueryGenerateIntersectionEXT(", to_expression(ops[0]), ", ", to_expression(ops[1]), ");");
                break;
            case OpRayQueryConfirmIntersectionKHR:
                flush_variable_declaration(ops[0]);
                statement("rayQueryConfirmIntersectionEXT(", to_expression(ops[0]), ");");
                break;
                #define GLSL_RAY_QUERY_GET_OP(op) \
            case OpRayQueryGet##op##KHR: \
                flush_variable_declaration(ops[2]); \
                emit_op(ops[0], ops[1], join("rayQueryGet" #op "EXT(", to_expression(ops[2]), ")"), false); \
                break
                #define GLSL_RAY_QUERY_GET_OP2(op) \
            case OpRayQueryGet##op##KHR: \
                flush_variable_declaration(ops[2]); \
                emit_op(ops[0], ops[1], join("rayQueryGet" #op "EXT(", to_expression(ops[2]), ", ", "bool(", to_expression(ops[3]), "))"), false); \
                break
                GLSL_RAY_QUERY_GET_OP(RayTMin);
                GLSL_RAY_QUERY_GET_OP(RayFlags);
                GLSL_RAY_QUERY_GET_OP(WorldRayOrigin);
                GLSL_RAY_QUERY_GET_OP(WorldRayDirection);
                GLSL_RAY_QUERY_GET_OP(IntersectionCandidateAABBOpaque);
                GLSL_RAY_QUERY_GET_OP2(IntersectionType);
                GLSL_RAY_QUERY_GET_OP2(IntersectionT);
                GLSL_RAY_QUERY_GET_OP2(IntersectionInstanceCustomIndex);
                GLSL_RAY_QUERY_GET_OP2(IntersectionInstanceId);
                GLSL_RAY_QUERY_GET_OP2(IntersectionInstanceShaderBindingTableRecordOffset);
                GLSL_RAY_QUERY_GET_OP2(IntersectionGeometryIndex);
                GLSL_RAY_QUERY_GET_OP2(IntersectionPrimitiveIndex);
                GLSL_RAY_QUERY_GET_OP2(IntersectionBarycentrics);
                GLSL_RAY_QUERY_GET_OP2(IntersectionFrontFace);
                GLSL_RAY_QUERY_GET_OP2(IntersectionObjectRayDirection);
                GLSL_RAY_QUERY_GET_OP2(IntersectionObjectRayOrigin);
                GLSL_RAY_QUERY_GET_OP2(IntersectionObjectToWorld);
                GLSL_RAY_QUERY_GET_OP2(IntersectionWorldToObject);
                #undef GLSL_RAY_QUERY_GET_OP
                #undef GLSL_RAY_QUERY_GET_OP2

            case OpConvertUToAccelerationStructureKHR:
                require_extension_internal("GL_EXT_ray_tracing");
                this.emit_unary_func_op(ops[0], ops[1], ops[2], "accelerationStructureEXT");
                break;*/

            case Op.ConvertUToPtr:
            {
                const type = this.get<SPIRType>(SPIRType, ops[0]);
                if (type.storage !== StorageClass.PhysicalStorageBufferEXT)
                    throw new Error("Only StorageClassPhysicalStorageBufferEXT is supported by OpConvertUToPtr.");

                const in_type = this.expression_type(ops[2]);
                if (in_type.vecsize === 2)
                    this.require_extension_internal("GL_EXT_buffer_reference_uvec2");

                const op = this.type_to_glsl(type);
                this.emit_unary_func_op(ops[0], ops[1], ops[2], op);
                break;
            }

            case Op.ConvertPtrToU:
            {
                const type = this.get<SPIRType>(SPIRType, ops[0]);
                const ptr_type = this.expression_type(ops[2]);
                if (ptr_type.storage !== StorageClass.PhysicalStorageBufferEXT)
                    throw new Error("Only StorageClassPhysicalStorageBufferEXT is supported by OpConvertPtrToU.");

                if (type.vecsize === 2)
                    this.require_extension_internal("GL_EXT_buffer_reference_uvec2");

                const op = this.type_to_glsl(type);
                this.emit_unary_func_op(ops[0], ops[1], ops[2], op);
                break;
            }

            case Op.Undef:
                // Undefined value has been declared.
                break;

            case Op.Line:
            {
                this.emit_line_directive(ops[0], ops[1]);
                break;
            }

            case Op.NoLine:
                break;

            case Op.DemoteToHelperInvocationEXT:
                // if (!options.vulkan_semantics)
                    throw new Error("GL_EXT_demote_to_helper_invocation is only supported in Vulkan GLSL.");
                // require_extension_internal("GL_EXT_demote_to_helper_invocation");
                // statement(backend.demote_literal, ";");
                // break;

            case Op.IsHelperInvocationEXT:
                // if (!options.vulkan_semantics)
                    throw new Error("GL_EXT_demote_to_helper_invocation is only supported in Vulkan GLSL.");
                // require_extension_internal("GL_EXT_demote_to_helper_invocation");
                // emit_op(ops[0], ops[1], "helperInvocationEXT()", false);
                // break;

            /*case OpBeginInvocationInterlockEXT:
                // If the interlock is complex, we emit this elsewhere.
                if (!interlocked_is_complex)
                {
                    statement("SPIRV_Cross_beginInvocationInterlock();");
                    flush_all_active_variables();
                    // Make sure forwarding doesn't propagate outside interlock region.
                }
                break;

            case OpEndInvocationInterlockEXT:
                // If the interlock is complex, we emit this elsewhere.
                if (!interlocked_is_complex)
                {
                    statement("SPIRV_Cross_endInvocationInterlock();");
                    flush_all_active_variables();
                    // Make sure forwarding doesn't propagate outside interlock region.
                }
                break;*/

            default:
                console.log("unimplemented op ", instruction.op);
                this.statement("// unimplemented op ", instruction.op);

                throw new Error("Unsupported op " + instruction.op)
                // break;
        }
    }

    protected emit_block_instructions(block: SPIRBlock)
    {
        this.current_emitting_block = block;
        for (let op of block.ops)
            this.emit_instruction(op);
        this.current_emitting_block = null;
    }

    protected emit_glsl_op(result_type: number, id: number, eop: number, args: number[] | Uint32Array, arroffs: number, length: number)
{
    const op = <GLSLstd450>(eop);

    if (this.is_legacy() && is_unsigned_glsl_opcode(op))
        throw new Error("Unsigned integers are not supported on legacy GLSL targets.");

    // If we need to do implicit bitcasts, make sure we do it with the correct type.
    const integer_width = this.get_integer_width_for_glsl_instruction(op, args, arroffs, length);
    const int_type = to_signed_basetype(integer_width);
    const uint_type = to_unsigned_basetype(integer_width);

    const { ir } = this;

    switch (op)
    {
        // FP fiddling
    case GLSLstd450.Round:
        if (!this.is_legacy())
            this.emit_unary_func_op(result_type, id, args[arroffs], "round");
        else
        {
            const op0 = this.to_enclosed_expression(args[arroffs]);
            const op0_type = this.expression_type(args[arroffs]);
            const expr = "floor(" + op0 + " + " + this.type_to_glsl_constructor(op0_type) + "(0.5))";
            const forward = this.should_forward(args[arroffs]);
            this.emit_op(result_type, id, expr, forward);
            this.inherit_expression_dependencies(id, args[arroffs]);
        }
        break;

    case GLSLstd450.RoundEven:
        if (!this.is_legacy())
            this.emit_unary_func_op(result_type, id, args[arroffs], "roundEven");
        /*else if (!options.es)
        {
            // This extension provides round() with round-to-even semantics.
            this.require_extension_internal("GL_EXT_gpu_shader4");
            this.emit_unary_func_op(result_type, id, args[arroffs], "round");
        }*/
        else
            throw new Error("roundEven supported only in ESSL 300.");
        break;

    case GLSLstd450.Trunc:
        this.emit_unary_func_op(result_type, id, args[arroffs], "trunc");
        break;
    case GLSLstd450.SAbs:
        this.emit_unary_func_op_cast(result_type, id, args[arroffs], "abs", int_type, int_type);
        break;
    case GLSLstd450.FAbs:
        this.emit_unary_func_op(result_type, id, args[arroffs], "abs");
        break;
    case GLSLstd450.SSign:
        this.emit_unary_func_op_cast(result_type, id, args[arroffs], "sign", int_type, int_type);
        break;
    case GLSLstd450.FSign:
        this.emit_unary_func_op(result_type, id, args[arroffs], "sign");
        break;
    case GLSLstd450.Floor:
        this.emit_unary_func_op(result_type, id, args[arroffs], "floor");
        break;
    case GLSLstd450.Ceil:
        this.emit_unary_func_op(result_type, id, args[arroffs], "ceil");
        break;
    case GLSLstd450.Fract:
        this.emit_unary_func_op(result_type, id, args[arroffs], "fract");
        break;
    case GLSLstd450.Radians:
        this.emit_unary_func_op(result_type, id, args[arroffs], "radians");
        break;
    case GLSLstd450.Degrees:
        this.emit_unary_func_op(result_type, id, args[arroffs], "degrees");
        break;
    case GLSLstd450.Fma:
        // if ((!options.es && options.version < 400) || (options.es && options.version < 320))
        {
            const expr = this.to_enclosed_expression(args[arroffs]) + " * " + this.to_enclosed_expression(args[arroffs + 1]) + " + " +
                        this.to_enclosed_expression(args[arroffs + 2]);

            this.emit_op(result_type, id, expr,
                this.should_forward(args[arroffs]) && this.should_forward(args[arroffs + 1]) && this.should_forward(args[arroffs + 2]));
            for (let i = 0; i < 3; i++)
                this.inherit_expression_dependencies(id, args[i]);
        }
        // else
        //     this.emit_trinary_func_op(result_type, id, args[arroffs], args[arroffs + 1], args[arroffs + 2], "fma");
        break;
    case GLSLstd450.Modf:
        this.register_call_out_argument(args[arroffs + 1]);
        this.forced_temporaries.add(id);
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "modf");
        break;

    case GLSLstd450.ModfStruct:
    {
        const type = this.get<SPIRType>(SPIRType, result_type);
        this.emit_uninitialized_temporary_expression(result_type, id);
        this.statement(this.to_expression(id), ".", this.to_member_name(type, 0), " = ", "modf(", this.to_expression(args[arroffs]), ", ",
            this.to_expression(id), ".", this.to_member_name(type, 1), ");");
        break;
    }

        // Minmax
    case GLSLstd450.UMin:
        this.emit_binary_func_op_cast(result_type, id, args[arroffs], args[arroffs + 1], "min", uint_type, false);
        break;

    case GLSLstd450.SMin:
        this.emit_binary_func_op_cast(result_type, id, args[arroffs], args[arroffs + 1], "min", int_type, false);
        break;

    case GLSLstd450.FMin:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "min");
        break;

    case GLSLstd450.FMax:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "max");
        break;

    case GLSLstd450.UMax:
        this.emit_binary_func_op_cast(result_type, id, args[arroffs], args[arroffs + 1], "max", uint_type, false);
        break;

    case GLSLstd450.SMax:
        this.emit_binary_func_op_cast(result_type, id, args[arroffs], args[arroffs + 1], "max", int_type, false);
        break;

    case GLSLstd450.FClamp:
        this.emit_trinary_func_op(result_type, id, args[arroffs], args[arroffs + 1], args[arroffs + 2], "clamp");
        break;

    case GLSLstd450.UClamp:
        this.emit_trinary_func_op_cast(result_type, id, args[arroffs], args[arroffs + 1], args[arroffs + 2], "clamp", uint_type);
        break;

    case GLSLstd450.SClamp:
        this.emit_trinary_func_op_cast(result_type, id, args[arroffs], args[arroffs + 1], args[arroffs + 2], "clamp", int_type);
        break;

        // Trig
    case GLSLstd450.Sin:
        this.emit_unary_func_op(result_type, id, args[arroffs], "sin");
        break;
    case GLSLstd450.Cos:
        this.emit_unary_func_op(result_type, id, args[arroffs], "cos");
        break;
    case GLSLstd450.Tan:
        this.emit_unary_func_op(result_type, id, args[arroffs], "tan");
        break;
    case GLSLstd450.Asin:
        this.emit_unary_func_op(result_type, id, args[arroffs], "asin");
        break;
    case GLSLstd450.Acos:
        this.emit_unary_func_op(result_type, id, args[arroffs], "acos");
        break;
    case GLSLstd450.Atan:
        this.emit_unary_func_op(result_type, id, args[arroffs], "atan");
        break;
    case GLSLstd450.Sinh:
        this.emit_unary_func_op(result_type, id, args[arroffs], "sinh");
        break;
    case GLSLstd450.Cosh:
        this.emit_unary_func_op(result_type, id, args[arroffs], "cosh");
        break;
    case GLSLstd450.Tanh:
        this.emit_unary_func_op(result_type, id, args[arroffs], "tanh");
        break;
    case GLSLstd450.Asinh:
        this.emit_unary_func_op(result_type, id, args[arroffs], "asinh");
        break;
    case GLSLstd450.Acosh:
        this.emit_unary_func_op(result_type, id, args[arroffs], "acosh");
        break;
    case GLSLstd450.Atanh:
        this.emit_unary_func_op(result_type, id, args[arroffs], "atanh");
        break;
    case GLSLstd450.Atan2:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "atan");
        break;

        // Exponentials
    case GLSLstd450.Pow:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "pow");
        break;
    case GLSLstd450.Exp:
        this.emit_unary_func_op(result_type, id, args[arroffs], "exp");
        break;
    case GLSLstd450.Log:
        this.emit_unary_func_op(result_type, id, args[arroffs], "log");
        break;
    case GLSLstd450.Exp2:
        this.emit_unary_func_op(result_type, id, args[arroffs], "exp2");
        break;
    case GLSLstd450.Log2:
        this.emit_unary_func_op(result_type, id, args[arroffs], "log2");
        break;
    case GLSLstd450.Sqrt:
        this.emit_unary_func_op(result_type, id, args[arroffs], "sqrt");
        break;
    case GLSLstd450.InverseSqrt:
        this.emit_unary_func_op(result_type, id, args[arroffs], "inversesqrt");
        break;

        // Matrix math
    case GLSLstd450.Determinant:
        this.emit_unary_func_op(result_type, id, args[arroffs], "determinant");
        break;
    case GLSLstd450.MatrixInverse:
        this.emit_unary_func_op(result_type, id, args[arroffs], "inverse");
        break;

        // Lerping
    case GLSLstd450.FMix:
        case GLSLstd450.IMix:
    {
        this.emit_mix_op(result_type, id, args[arroffs], args[arroffs+ 1], args[arroffs + 2]);
        break;
    }
    case GLSLstd450.Step:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "step");
        break;
    case GLSLstd450.SmoothStep:
        this.emit_trinary_func_op(result_type, id, args[arroffs], args[arroffs + 1], args[arroffs + 2], "smoothstep");
        break;

        // Packing
    case GLSLstd450.Frexp:
        this.register_call_out_argument(args[arroffs + 1]);
        this.forced_temporaries.add(id);
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "frexp");
        break;

    case GLSLstd450.FrexpStruct:
    {
        const type = this.get<SPIRType>(SPIRType, result_type);
        this.emit_uninitialized_temporary_expression(result_type, id);
        this.statement(this.to_expression(id), ".", this.to_member_name(type, 0), " = ", "frexp(", this.to_expression(args[arroffs]), ", ",
            this.to_expression(id), ".", this.to_member_name(type, 1), ");");
        break;
    }

    case GLSLstd450.Ldexp:
    {
        const forward = this.should_forward(args[arroffs]) && this.should_forward(args[arroffs + 1]);

        const op0 = this.to_unpacked_expression(args[arroffs]);
        let op1 = this.to_unpacked_expression(args[arroffs + 1]);
        const op1_type = this.expression_type(args[arroffs + 1]);
        if (op1_type.basetype !== SPIRBaseType.Int)
        {
            // Need a value cast here.
            const target_type = defaultClone(SPIRType, op1_type);
            target_type.basetype = SPIRBaseType.Int;
            op1 = this.type_to_glsl_constructor(target_type) + "(" + op1 + ")";
        }

        const expr = "ldexp(" + op0 + ", " + op1 + ")";

        this.emit_op(result_type, id, expr, forward);
        this.inherit_expression_dependencies(id, args[arroffs]);
        this.inherit_expression_dependencies(id, args[arroffs + 1]);
        break;
    }

    case GLSLstd450.PackSnorm4x8:
        this.emit_unary_func_op(result_type, id, args[arroffs], "packSnorm4x8");
        break;
    case GLSLstd450.PackUnorm4x8:
        this.emit_unary_func_op(result_type, id, args[arroffs], "packUnorm4x8");
        break;
    case GLSLstd450.PackSnorm2x16:
        this.emit_unary_func_op(result_type, id, args[arroffs], "packSnorm2x16");
        break;
    case GLSLstd450.PackUnorm2x16:
        this.emit_unary_func_op(result_type, id, args[arroffs], "packUnorm2x16");
        break;
    case GLSLstd450.PackHalf2x16:
        this.emit_unary_func_op(result_type, id, args[arroffs], "packHalf2x16");
        break;
    case GLSLstd450.UnpackSnorm4x8:
        this.emit_unary_func_op(result_type, id, args[arroffs], "unpackSnorm4x8");
        break;
    case GLSLstd450.UnpackUnorm4x8:
        this.emit_unary_func_op(result_type, id, args[arroffs], "unpackUnorm4x8");
        break;
    case GLSLstd450.UnpackSnorm2x16:
        this.emit_unary_func_op(result_type, id, args[arroffs], "unpackSnorm2x16");
        break;
    case GLSLstd450.UnpackUnorm2x16:
        this.emit_unary_func_op(result_type, id, args[arroffs], "unpackUnorm2x16");
        break;
    case GLSLstd450.UnpackHalf2x16:
        this.emit_unary_func_op(result_type, id, args[arroffs], "unpackHalf2x16");
        break;

    case GLSLstd450.PackDouble2x32:
        this.emit_unary_func_op(result_type, id, args[arroffs], "packDouble2x32");
        break;
    case GLSLstd450.UnpackDouble2x32:
        this.emit_unary_func_op(result_type, id, args[arroffs], "unpackDouble2x32");
        break;

        // Vector math
    case GLSLstd450.Length:
        this.emit_unary_func_op(result_type, id, args[arroffs], "length");
        break;
    case GLSLstd450.Distance:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "distance");
        break;
    case GLSLstd450.Cross:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "cross");
        break;
    case GLSLstd450.Normalize:
        this.emit_unary_func_op(result_type, id, args[arroffs], "normalize");
        break;
    case GLSLstd450.FaceForward:
        this.emit_trinary_func_op(result_type, id, args[arroffs], args[arroffs + 1], args[arroffs+ 2], "faceforward");
        break;
    case GLSLstd450.Reflect:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "reflect");
        break;
    case GLSLstd450.Refract:
        this.emit_trinary_func_op(result_type, id, args[arroffs], args[arroffs + 1], args[arroffs + 2], "refract");
        break;

        // Bit-fiddling
    case GLSLstd450.FindILsb:
        // findLSB always returns int.
        this.emit_unary_func_op_cast(result_type, id, args[arroffs], "findLSB", this.expression_type(args[arroffs]).basetype, int_type);
        break;

    case GLSLstd450.FindSMsb:
        this.emit_unary_func_op_cast(result_type, id, args[arroffs], "findMSB", int_type, int_type);
        break;

    case GLSLstd450.FindUMsb:
        this.emit_unary_func_op_cast(result_type, id, args[arroffs], "findMSB", uint_type, int_type); // findMSB always
        // returns int.
        break;

        // Multisampled varying
    case GLSLstd450.InterpolateAtCentroid:
        this.emit_unary_func_op(result_type, id, args[arroffs], "interpolateAtCentroid");
        break;
    case GLSLstd450.InterpolateAtSample:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "interpolateAtSample");
        break;
    case GLSLstd450.InterpolateAtOffset:
        this.emit_binary_func_op(result_type, id, args[arroffs], args[arroffs + 1], "interpolateAtOffset");
        break;

    case GLSLstd450.NMin:
        case GLSLstd450.NMax:
    {
        this.emit_nminmax_op(result_type, id, args[arroffs], args[arroffs+ 1], op);
        break;
    }

    case GLSLstd450.NClamp:
    {
        // Make sure we have a unique ID here to avoid aliasing the extra sub-expressions between clamp and NMin sub-op.
        // IDs cannot exceed 24 bits, so we can make use of the higher bits for some unique flags.
        let max_id = maplike_get(0, this.extra_sub_expressions, id | ExtraSubExpressionType.TYPE_AUX);
        if (!max_id)
            max_id = ir.increase_bound_by(1);

        // Inherit precision qualifiers.
        ir.meta[max_id] = defaultClone(Meta, ir.meta[id]);

        this.emit_nminmax_op(result_type, max_id, args[arroffs], args[arroffs + 1], GLSLstd450.NMax);
        this.emit_nminmax_op(result_type, id, max_id, args[arroffs + 2], GLSLstd450.NMin);
        break;
    }

    default:
        this.statement("// unimplemented GLSL op ", eop);
        break;
    }
}

    protected emit_header()
    {
        const execution = this.get_entry_point();
        const options = this.options;

        // WEBGL 1 doesn't support version number
        if (options.version !== 100)
            this.statement("#version ", options.version, /*options.es &&*/ " es");

        /*if (!options.es && options.version < 420) {
            // Needed for binding = # on UBOs, etc.
            if (options.enable_420pack_extension) {
                this.statement("#ifdef GL_ARB_shading_language_420pack");
                this.statement("#extension GL_ARB_shading_language_420pack : require");
                this.statement("#endif");
            }
            // Needed for: layout(early_fragment_tests) in;
            if (execution.flags.get(ExecutionMode.EarlyFragmentTests))
                this.require_extension_internal("GL_ARB_shader_image_load_store");
        }*/

        // Needed for: layout(post_depth_coverage) in;
        if (execution.flags.get(ExecutionMode.PostDepthCoverage))
            this.require_extension_internal("GL_ARB_post_depth_coverage");

        // Needed for: layout({pixel,sample}_interlock_[un]ordered) in;
        const interlock_used = execution.flags.get(ExecutionMode.PixelInterlockOrderedEXT) ||
            execution.flags.get(ExecutionMode.PixelInterlockUnorderedEXT) ||
            execution.flags.get(ExecutionMode.SampleInterlockOrderedEXT) ||
            execution.flags.get(ExecutionMode.SampleInterlockUnorderedEXT);

        if (interlock_used) {
            // if (options.es) {
            //     if (options.version < 310)
                    throw new Error("At least ESSL 3.10 required for fragment shader interlock.");
            /*    this.require_extension_internal("GL_NV_fragment_shader_interlock");
            }
            else {
                if (options.version < 420)
                    this.require_extension_internal("GL_ARB_shader_image_load_store");
                this.require_extension_internal("GL_ARB_fragment_shader_interlock");
            }*/
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
                // if (options.es)
                    this.statement("#extension GL_EXT_post_depth_coverage : require");
                /*else {
                    this.statement("#if defined(GL_ARB_post_depth_coverge)");
                    this.statement("#extension GL_ARB_post_depth_coverage : require");
                    this.statement("#else");
                    this.statement("#extension GL_EXT_post_depth_coverage : require");
                    this.statement("#endif");
                }*/
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
        // const outputs: string[] = [];

        switch (execution.model) {
            case ExecutionModel.Vertex:
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

            case ExecutionModel.Fragment:
                // if (options.es) {
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
                // }

                if (execution.flags.get(ExecutionMode.EarlyFragmentTests))
                    inputs.push("early_fragment_tests");
                if (execution.flags.get(ExecutionMode.PostDepthCoverage))
                    inputs.push("post_depth_coverage");

                if (interlock_used)
                    this.statement("#if defined(GL_ARB_fragment_shader_interlock)");

                if (execution.flags.get(ExecutionMode.PixelInterlockOrderedEXT))
                    this.statement("layout(pixel_interlock_ordered) in;");
                else if (execution.flags.get(ExecutionMode.PixelInterlockUnorderedEXT))
                    this.statement("layout(pixel_interlock_unordered) in;");
                else if (execution.flags.get(ExecutionMode.SampleInterlockOrderedEXT))
                    this.statement("layout(sample_interlock_ordered) in;");
                else if (execution.flags.get(ExecutionMode.SampleInterlockUnorderedEXT))
                    this.statement("layout(sample_interlock_unordered) in;");

                if (interlock_used) {
                    this.statement("#elif !defined(GL_INTEL_fragment_shader_ordering)");
                    this.statement("#error Fragment Shader Interlock/Ordering extension missing!");
                    this.statement("#endif");
                }

                /*if (!options.es && execution.flags.get(ExecutionMode.DepthGreater))
                    this.statement("layout(depth_greater) out float gl_FragDepth;");
                else if (!options.es && execution.flags.get(ExecutionMode.DepthLess))
                    this.statement("layout(depth_less) out float gl_FragDepth;");*/

                break;

            default:
                break;
        }

        /*for (let cap of ir.declared_capabilities)
            if (cap === Capability.RayTraversalPrimitiveCullingKHR) {
                throw new error("Raytracing not supported");
                this.statement("layout(primitive_culling);");
            }*/

        if (inputs.length > 0)
            this.statement("layout(", inputs.join(", "), ") in;");
        // if (outputs.length > 0)
        //     this.statement("layout(", outputs.join(", "), ") out;");

        this.statement("");
    }

    protected emit_sampled_image_op(result_type: number, result_id: number, image_id: number, samp_id: number)
    {
        /*if (options.vulkan_semantics && combined_image_samplers.empty())
    {
        emit_binary_func_op(result_type, result_id, image_id, samp_id,
                            type_to_glsl(get<SPIRType>(result_type), result_id).c_str());
    }
    else
    {*/
        // Make sure to suppress usage tracking. It is illegal to create temporaries of opaque types.
        this.emit_op(result_type, result_id, this.to_combined_image_sampler(image_id, samp_id), true, true);
        // }

        // Make sure to suppress usage tracking and any expression invalidation.
        // It is illegal to create temporaries of opaque types.
        this.forwarded_temporaries.delete(result_id);
    }

    protected emit_texture_op(i: Instruction, sparse: boolean)
    {
        const ops = this.stream(i);
        const op = <Op>(i.op);

        let inherited_expressions: number[] = [];

        const result_type_id = ops[0];
        const id = ops[1];
        const return_type = this.get<SPIRType>(SPIRType, result_type_id);

        const ids = {
            sparse_code_id: 0,
            sparse_texel_id: 0
        };
        if (sparse)
            this.emit_sparse_feedback_temporaries(result_type_id, id, ids);

        const forward = { value: false };
        let expr = this.to_texture_op(i, sparse, forward, inherited_expressions);

        if (sparse) {
            this.statement(this.to_expression(ids.sparse_code_id), " = ", expr, ";");
            expr = this.type_to_glsl(return_type) + "(" + this.to_expression(ids.sparse_code_id) + ", " + this.to_expression(ids.sparse_texel_id) + ")";
            forward.value = true;
            inherited_expressions = [];
        }

        this.emit_op(result_type_id, id, expr, forward.value);
        for (let inherit of inherited_expressions)
            this.inherit_expression_dependencies(id, inherit);

        // Do not register sparse ops as control dependent as they are always lowered to a temporary.
        switch (op) {
            case Op.ImageSampleDrefImplicitLod:
            case Op.ImageSampleImplicitLod:
            case Op.ImageSampleProjImplicitLod:
            case Op.ImageSampleProjDrefImplicitLod:
                this.register_control_dependent_expression(id);
                break;

            default:
                break;
        }
    }

    protected to_texture_op(i: Instruction, sparse: boolean, forward: { value: boolean }, inherited_expressions: number[])
    {
        const ops = this.stream(i);
        const op = <Op>(i.op);
        let length = i.length;

        const result_type_id = ops[0];
        const img = <VariableID>ops[2];
        let coord = ops[3];
        let dref = 0;
        let comp = 0;
        let gather = false;
        let proj = false;
        let fetch = false;
        let nonuniform_expression = false;
        let optOffset: number;

        const result_type = this.get<SPIRType>(SPIRType, result_type_id);
        const { backend } = this;

        inherited_expressions.push(coord);
        if (this.has_decoration(img, Decoration.NonUniform) && !this.maybe_get_backing_variable(img))
            nonuniform_expression = true;

        switch (op) {
            case Op.ImageSampleDrefImplicitLod:
            case Op.ImageSampleDrefExplicitLod:
            case Op.ImageSparseSampleDrefImplicitLod:
            case Op.ImageSparseSampleDrefExplicitLod:
                dref = ops[4];
                optOffset = 5;
                length -= 5;
                break;

            case Op.ImageSampleProjDrefImplicitLod:
            case Op.ImageSampleProjDrefExplicitLod:
            case Op.ImageSparseSampleProjDrefImplicitLod:
            case Op.ImageSparseSampleProjDrefExplicitLod:
                dref = ops[4];
                optOffset = 5;
                length -= 5;
                proj = true;
                break;

            /*case Op.ImageDrefGather:
            case Op.ImageSparseDrefGather:
                dref = ops[4];
                optOffset = 5;
                length -= 5;
                gather = true;
                if (options.es && options.version < 310)
                    throw new Error("textureGather requires ESSL 310.");
                else if (!options.es && options.version < 400)
                    throw new Error("textureGather with depth compare requires GLSL 400.");
                break;

            case Op.ImageGather:
            case Op.ImageSparseGather:
                comp = ops[4];
                optOffset = 5;
                length -= 5;
                gather = true;
                if (options.es && options.version < 310)
                    throw new Error("textureGather requires ESSL 310.");
                else if (!options.es && options.version < 400) {
                    if (!this.expression_is_constant_null(comp))
                        throw new Error("textureGather with component requires GLSL 400.");
                    this.require_extension_internal("GL_ARB_texture_gather");
                }
                break;*/

            case Op.ImageFetch:
            case Op.ImageSparseFetch:
            case Op.ImageRead: // Reads === fetches in Metal (other langs will not get here)
                optOffset = 4;
                length -= 4;
                fetch = true;
                break;

            case Op.ImageSampleProjImplicitLod:
            case Op.ImageSampleProjExplicitLod:
            case Op.ImageSparseSampleProjImplicitLod:
            case Op.ImageSparseSampleProjExplicitLod:
                optOffset = 4;
                length -= 4;
                proj = true;
                break;

            default:
                optOffset = 4;
                length -= 4;
                break;
        }

        // Bypass pointers because we need the real image struct
        const type = this.expression_type(img);
        const imgtype = this.get<SPIRType>(SPIRType, type.self);

        let coord_components;
        switch (imgtype.image.dim) {
            case Dim.Dim1D:
                coord_components = 1;
                break;
            case Dim.Dim2D:
                coord_components = 2;
                break;
            case Dim.Dim3D:
                coord_components = 3;
                break;
            case Dim.Cube:
                coord_components = 3;
                break;
            case Dim.Buffer:
                coord_components = 1;
                break;
            default:
                coord_components = 2;
                break;
        }

        if (dref)
            inherited_expressions.push(dref);

        if (proj)
            coord_components++;
        if (imgtype.image.arrayed)
            coord_components++;

        let flags = 0;

        if (length) {
            flags = ops[optOffset++];
            length--;
        }

        const test = (flag: number): number =>
        {
            let v = 0;
            if (length && (flags & flag)) {
                v = ops[optOffset++];
                inherited_expressions.push(v);
                length--;
            }
            return v;
        };

        const bias = test(ImageOperandsMask.Bias);
        const lod = test(ImageOperandsMask.Lod);
        const grad_x = test(ImageOperandsMask.Grad);
        const grad_y = test(ImageOperandsMask.Grad);
        const coffset = test(ImageOperandsMask.ConstOffset);
        const offset = test(ImageOperandsMask.Offset);
        const coffsets = test(ImageOperandsMask.ConstOffsets);
        const sample = test(ImageOperandsMask.Sample);
        const minlod = test(ImageOperandsMask.MinLod);

        const base_args = new TextureFunctionBaseArguments();
        base_args.img = img;
        base_args.imgtype = imgtype;
        base_args.is_fetch = fetch;
        base_args.is_gather = gather;
        base_args.is_proj = proj;

        let expr = "";
        const name_args = new TextureFunctionNameArguments();

        name_args.base = base_args;
        name_args.has_array_offsets = coffsets !== 0;
        name_args.has_offset = coffset !== 0 || offset !== 0;
        name_args.has_grad = grad_x !== 0 || grad_y !== 0;
        name_args.has_dref = dref !== 0;
        name_args.is_sparse_feedback = sparse;
        name_args.has_min_lod = minlod !== 0;
        name_args.lod = lod;
        expr += this.to_function_name(name_args);
        expr += "(";

        let sparse_texel_id = 0;
        if (sparse)
            sparse_texel_id = this.get_sparse_feedback_texel_id(ops[1]);

        const args = new TextureFunctionArguments();
        args.base = base_args;
        args.coord = coord;
        args.coord_components = coord_components;
        args.dref = dref;
        args.grad_x = grad_x;
        args.grad_y = grad_y;
        args.lod = lod;
        args.coffset = coffset;
        args.offset = offset;
        args.bias = bias;
        args.component = comp;
        args.sample = sample;
        args.sparse_texel = sparse_texel_id;
        args.min_lod = minlod;
        args.nonuniform_expression = nonuniform_expression;
        expr += this.to_function_args(args, forward);
        expr += ")";

// texture(samplerXShadow) returns float. shadowX() returns vec4. Swizzle here.
        if (this.is_legacy() && this.is_depth_image(imgtype, img))
            expr += ".r";

// Sampling from a texture which was deduced to be a depth image, might actually return 1 component here.
// Remap back to 4 components as sampling opcodes expect.
        if (backend.comparison_image_samples_scalar && image_opcode_is_sample_no_dref(op)) {
            let image_is_depth = false;
            const combined = this.maybe_get<SPIRCombinedImageSampler>(SPIRCombinedImageSampler, img);
            const image_id = combined ? combined.image : img;

            if (combined && this.is_depth_image(imgtype, combined.image))
                image_is_depth = true;
            else if (this.is_depth_image(imgtype, img))
                image_is_depth = true;

            // We must also check the backing variable for the image.
            // We might have loaded an OpImage, and used that handle for two different purposes.
            // Once with comparison, once without.
            const image_variable = this.maybe_get_backing_variable(image_id);
            if (image_variable && this.is_depth_image(this.get<SPIRType>(SPIRType, image_variable.basetype), image_variable.self))
                image_is_depth = true;

            if (image_is_depth)
                expr = this.remap_swizzle(result_type, 1, expr);
        }

        if (!sparse && !backend.support_small_type_sampling_result && result_type.width < 32) {
            // Just value cast (narrowing) to expected type since we cannot rely on narrowing to work automatically.
            // Hopefully compiler picks this up and converts the texturing instruction to the appropriate precision.
            expr = this.type_to_glsl_constructor(result_type) + "(" + expr + ")";
        }

// Deals with reads from MSL. We might need to downconvert to fewer components.
        if (op === Op.ImageRead)
            expr = this.remap_swizzle(result_type, 4, expr);

        return expr;
    }

    protected emit_line_directive(file_id: number, line_literal: number)
    {
        // If we are redirecting statements, ignore the line directive.
        // Common case here is continue blocks.
        if (this.redirect_statement)
            return;

        if (this.options.emit_line_directives) {
            this.require_extension_internal("GL_GOOGLE_cpp_style_line_directive");
            this.statement_no_indent("#line ", line_literal, " \"", this.get<SPIRString>(SPIRString, file_id).str, "\"");
        }
    }

    protected emit_struct_member(type: SPIRType, member_type_id: number, index: number, qualifier: string = "", _base_offset: number = 0)
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
        const is_block = flags.get(Decoration.Block) || flags.get(Decoration.BufferBlock);

        if (is_block)
            qualifiers = this.to_interpolation_qualifiers(memberflags);

        this.statement(this.layout_for_member(type, index), qualifiers, qualifier, this.flags_to_qualifiers_glsl(membertype, memberflags),
            this.variable_decl(membertype, this.to_member_name(type, index)), ";");
    }

    protected emit_struct_padding_target(_: SPIRType)
    {
        // empty
    }

    protected to_function_name(args: TextureFunctionNameArguments): string
    {
        if (args.has_min_lod) {
            // if (options.es)
                throw new Error("Sparse residency is not supported in ESSL.");
            // this.require_extension_internal("GL_ARB_sparse_texture_clamp");
        }

        let fname = "";
        const imgtype = args.base.imgtype;
        const tex = args.base.img;

        // textureLod on sampler2DArrayShadow and samplerCubeShadow does not exist in GLSL for some reason.
        // To emulate this, we will have to use textureGrad with a constant gradient of 0.
        // The workaround will assert that the LOD is in fact constant 0, or we cannot emit correct code.
        // This happens for HLSL SampleCmpLevelZero on Texture2DArray and TextureCube.
        let workaround_lod_array_shadow_as_grad = false;
        if (((imgtype.image.arrayed && imgtype.image.dim === Dim.Dim2D) || imgtype.image.dim === Dim.Cube) &&
            this.is_depth_image(imgtype, tex) && args.lod) {
            if (!this.expression_is_constant_null(args.lod)) {
                throw new Error("textureLod on sampler2DArrayShadow is not constant 0.0. This cannot be expressed in" +
                    " GLSL.");
            }
            workaround_lod_array_shadow_as_grad = true;
        }

        if (args.is_sparse_feedback)
            fname += "sparse";

        if (args.base.is_fetch)
            fname += args.is_sparse_feedback ? "TexelFetch" : "texelFetch";
        else {
            fname += args.is_sparse_feedback ? "Texture" : "texture";

            if (args.base.is_gather)
                fname += "Gather";
            if (args.has_array_offsets)
                fname += "Offsets";
            if (args.base.is_proj)
                fname += "Proj";
            if (args.has_grad || workaround_lod_array_shadow_as_grad)
                fname += "Grad";
            if (args.lod !== 0 && !workaround_lod_array_shadow_as_grad)
                fname += "Lod";
        }

        if (args.has_offset)
            fname += "Offset";

        if (args.has_min_lod)
            fname += "Clamp";

        if (args.is_sparse_feedback || args.has_min_lod)
            fname += "ARB";

        return (this.is_legacy() && !args.base.is_gather) ? this.legacy_tex_op(fname, imgtype, tex) : fname;
    }

    protected to_function_args(args: TextureFunctionArguments, p_forward: { value: boolean }): string
    {
        const img = args.base.img;
        const imgtype = args.base.imgtype;

        const { backend } = this;

        let farg_str;
        if (args.base.is_fetch)
            farg_str = this.convert_separate_image_to_expression(img);
        else
            farg_str = this.to_non_uniform_aware_expression(img);

        if (args.nonuniform_expression && farg_str.indexOf("[") >= 0) {
            // Only emit nonuniformEXT() wrapper if the underlying expression is arrayed in some way.
            farg_str = backend.nonuniform_qualifier + "(" + farg_str + ")";
        }

        const swizz_func = backend.swizzle_is_function;
        const swizzle = (comps, in_comps): string =>
        {
            if (comps === in_comps)
                return "";

            switch (comps) {
                case 1:
                    return ".x";
                case 2:
                    return swizz_func ? ".xy()" : ".xy";
                case 3:
                    return swizz_func ? ".xyz()" : ".xyz";
                default:
                    return "";
            }
        };

        let forward = this.should_forward(args.coord);

        // The IR can give us more components than we need, so chop them off as needed.
        const swizzle_expr = swizzle(args.coord_components, this.expression_type(args.coord).vecsize);
        // Only enclose the UV expression if needed.
        let coord_expr = (swizzle_expr === "") ? this.to_expression(args.coord) : (this.to_enclosed_expression(args.coord) + swizzle_expr);

        // texelFetch only takes int, not uint.
        const coord_type = this.expression_type(args.coord);
        if (coord_type.basetype === SPIRBaseType.UInt) {
            const expected_type = defaultClone(SPIRType, coord_type);
            expected_type.vecsize = args.coord_components;
            expected_type.basetype = SPIRBaseType.Int;
            coord_expr = this.bitcast_expression(expected_type, coord_type.basetype, coord_expr);
        }

        // textureLod on sampler2DArrayShadow and samplerCubeShadow does not exist in GLSL for some reason.
        // To emulate this, we will have to use textureGrad with a constant gradient of 0.
        // The workaround will assert that the LOD is in fact constant 0, or we cannot emit correct code.
        // This happens for HLSL SampleCmpLevelZero on Texture2DArray and TextureCube.
        const workaround_lod_array_shadow_as_grad =
            ((imgtype.image.arrayed && imgtype.image.dim === Dim.Dim2D) || imgtype.image.dim === Dim.Cube) &&
            this.is_depth_image(imgtype, img) && args.lod !== 0;

        if (args.dref) {
            forward = forward && this.should_forward(args.dref);

            // SPIR-V splits dref and coordinate.
            if (args.base.is_gather ||
                args.coord_components === 4) // GLSL also splits the arguments in two. Same for textureGather.
            {
                farg_str += ", ";
                farg_str += this.to_expression(args.coord);
                farg_str += ", ";
                farg_str += this.to_expression(args.dref);
            }
            else if (args.base.is_proj) {
                // Have to reshuffle so we get vec4(coord, dref, proj), special case.
                // Other shading languages splits up the arguments for coord and compare value like SPIR-V.
                // The coordinate type for textureProj shadow is always vec4 even for sampler1DShadow.
                farg_str += ", vec4(";

                if (imgtype.image.dim === Dim.Dim1D) {
                    // Could reuse coord_expr, but we will mess up the temporary usage checking.
                    farg_str += this.to_enclosed_expression(args.coord) + ".x";
                    farg_str += ", ";
                    farg_str += "0.0, ";
                    farg_str += this.to_expression(args.dref);
                    farg_str += ", ";
                    farg_str += this.to_enclosed_expression(args.coord) + ".y)";
                }
                else if (imgtype.image.dim === Dim.Dim2D) {
                    // Could reuse coord_expr, but we will mess up the temporary usage checking.
                    farg_str += this.to_enclosed_expression(args.coord) + (swizz_func ? ".xy()" : ".xy");
                    farg_str += ", ";
                    farg_str += this.to_expression(args.dref);
                    farg_str += ", ";
                    farg_str += this.to_enclosed_expression(args.coord) + ".z)";
                }
                else
                    throw new Error("Invalid type for textureProj with shadow.");
            }
            else {
                // Create a composite which merges coord/dref into a single vector.
                const type = defaultClone(SPIRType, this.expression_type(args.coord));
                type.vecsize = args.coord_components + 1;
                farg_str += ", ";
                farg_str += this.type_to_glsl_constructor(type);
                farg_str += "(";
                farg_str += coord_expr;
                farg_str += ", ";
                farg_str += this.to_expression(args.dref);
                farg_str += ")";
            }
        }
        else {
            farg_str += ", ";
            farg_str += coord_expr;
        }

        if (args.grad_x || args.grad_y) {
            forward = forward && this.should_forward(args.grad_x);
            forward = forward && this.should_forward(args.grad_y);
            farg_str += ", ";
            farg_str += this.to_expression(args.grad_x);
            farg_str += ", ";
            farg_str += this.to_expression(args.grad_y);
        }

        if (args.lod) {
            if (workaround_lod_array_shadow_as_grad) {
                // Implement textureGrad() instead. LOD === 0.0 is implemented as gradient of 0.0.
                // Implementing this as plain texture() is not safe on some implementations.
                if (imgtype.image.dim === Dim.Dim2D)
                    farg_str += ", vec2(0.0), vec2(0.0)";
                else if (imgtype.image.dim === Dim.Cube)
                    farg_str += ", vec3(0.0), vec3(0.0)";
            }
            else {
                forward = forward && this.should_forward(args.lod);
                farg_str += ", ";

                const lod_expr_type = this.expression_type(args.lod);

                // Lod expression for TexelFetch in GLSL must be int, and only int.
                if (args.base.is_fetch && imgtype.image.dim !== Dim.Buffer && !imgtype.image.ms &&
                    lod_expr_type.basetype !== SPIRBaseType.Int) {
                    farg_str += "int(" + this.to_expression(args.lod) + ")";
                }
                else {
                    farg_str += this.to_expression(args.lod);
                }
            }
        }
        else if (args.base.is_fetch && imgtype.image.dim !== Dim.Buffer && !imgtype.image.ms) {
            // Lod argument is optional in OpImageFetch, but we require a LOD value, pick 0 as the default.
            farg_str += ", 0";
        }

        if (args.coffset) {
            forward = forward && this.should_forward(args.coffset);
            farg_str += ", ";
            farg_str += this.to_expression(args.coffset);
        }
        else if (args.offset) {
            forward = forward && this.should_forward(args.offset);
            farg_str += ", ";
            farg_str += this.to_expression(args.offset);
        }

        if (args.sample) {
            farg_str += ", ";
            farg_str += this.to_expression(args.sample);
        }

        if (args.min_lod) {
            farg_str += ", ";
            farg_str += this.to_expression(args.min_lod);
        }

        if (args.sparse_texel) {
            // Sparse texel output parameter comes after everything else, except it's before the optional, component/bias arguments.
            farg_str += ", ";
            farg_str += this.to_expression(args.sparse_texel);
        }

        if (args.bias) {
            forward = forward && this.should_forward(args.bias);
            farg_str += ", ";
            farg_str += this.to_expression(args.bias);
        }

        if (args.component && !this.expression_is_constant_null(args.component)) {
            forward = forward && this.should_forward(args.component);
            farg_str += ", ";
            const component_type = this.expression_type(args.component);
            if (component_type.basetype === SPIRBaseType.Int)
                farg_str += this.to_expression(args.component);
            else
                farg_str += "int(" + this.to_expression(args.component) + ")";
        }

        p_forward.value = forward;

        return farg_str;
    }

    protected emit_sparse_feedback_temporaries(result_type_id: number, id: number, ids: { sparse_code_id: number, sparse_texel_id: number })
    {
// Need to allocate two temporaries.
//         if (this.options.es)
            throw new Error("Sparse texture feedback is not supported on ESSL.");
        /*this.require_extension_internal("GL_ARB_sparse_texture2");

        let temps = maplike_get(0, this.extra_sub_expressions, id);
        if (temps === 0) {
            temps = this.ir.increase_bound_by(2);
            this.extra_sub_expressions[id] = temps;
        }

        ids.sparse_code_id = temps + 0;
        ids.sparse_texel_id = temps + 1;

        const return_type = this.get<SPIRType>(SPIRType, result_type_id);
        if (return_type.basetype !== SPIRBaseType.Struct || return_type.member_types.length !== 2)
            throw new Error("Invalid return type for sparse feedback.");
        this.emit_uninitialized_temporary(return_type.member_types[0], ids.sparse_code_id);
        this.emit_uninitialized_temporary(return_type.member_types[1], ids.sparse_texel_id);*/
    }

    protected get_sparse_feedback_texel_id(id: number): number
    {
        return this.extra_sub_expressions[id] || 0;
    }

    protected emit_buffer_block(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const ubo_block = var_.storage === StorageClass.Uniform && this.has_decoration(type.self, Decoration.Block);

        const { options, ir } = this;

        if (this.flattened_buffer_blocks.has(var_.self))
            this.emit_buffer_block_flattened(var_);
        else if (this.is_legacy() /*|| (!options.es && options.version === 130)*/ ||
            (ubo_block && options.emit_uniform_buffer_as_plain_uniforms)) {
            if (ir.get_name(var_.self) === "" && options.keep_unnamed_ubos) {
                this.emit_buffer_block_global(var_);
                // mark this struct instance as removed
                this.removed_structs.add(var_.self);
            }
            else
                this.emit_buffer_block_legacy(var_);
        }
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
        const meta = maplike_get(Meta, ir.meta, type.self);
        const ssbo = var_.storage === StorageClass.StorageBuffer ||
            meta.decoration.decoration_flags.get(Decoration.BufferBlock);
        if (ssbo)
            throw new Error("SSBOs not supported in legacy targets.");

        // We're emitting the push constant block as a regular struct, so disable the block qualifier temporarily.
        // Otherwise, we will end up emitting layout() qualifiers on naked structs which is not allowed.
        const block_flags = meta.decoration.decoration_flags;
        const block_flag = block_flags.get(Decoration.Block);
        block_flags.clear(Decoration.Block);
        this.emit_struct(type);
        if (block_flag)
            block_flags.set(Decoration.Block);
        this.emit_uniform(var_);
        this.statement("");
    }

    protected emit_buffer_block_flattened(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);

        // Block names should never alias.
        const buffer_name = this.to_name(type.self, false);
        const buffer_size = (this.get_declared_struct_size(type) + 15) / 16;

        const basic_type: SPIRBaseType = this.get_common_basic_type(type);
        if (basic_type !== undefined) {
            let tmp = new SPIRType();
            tmp.basetype = basic_type;
            tmp.vecsize = 4;
            if (basic_type !== SPIRBaseType.Float && basic_type !== SPIRBaseType.Int && basic_type !== SPIRBaseType.UInt)
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
        dec.decoration_flags.set(Decoration.Block);

        type.member_name_cache.clear();

        const member_indices: number[] = [];
        member_indices.push(0);
        const basename = this.to_name(var_.self);

        let i = 0;
        for (let member of type.member_types) {
            this.add_member_name(type, i);
            const membertype = this.get<SPIRType>(SPIRType, member);

            member_indices[member_indices.length - 1] = i;
            if (membertype.basetype === SPIRBaseType.Struct)
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

        console.assert(member_type.basetype === SPIRBaseType.Struct);

        if (member_type.array.length > 0)
            throw new Error("Cannot flatten array of structs in I/O blocks.");

        for (let i = 0; i < member_type.member_types.length; i++) {
            sub_indices[sub_indices.length - 1] = i;
            if (this.get<SPIRType>(SPIRType, member_type.member_types[i]).basetype === SPIRBaseType.Struct)
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

        console.assert(member_type.basetype !== SPIRBaseType.Struct);

        // We're overriding struct member names, so ensure we do so on the primary type.
        if (parent_type.type_alias)
            parent_type = this.get<SPIRType>(SPIRType, parent_type.type_alias);

        // Sanitize underscores because joining the two identifiers might create more than 1 underscore in a row,
        // which is not allowed.
        flattened_name = ParsedIR.sanitize_underscores(flattened_name);

        const last_index = indices[indices.length - 1];

        // Pass in the varying qualifier here so it will appear in the correct declaration order.
        // Replace member name while emitting it so it encodes both struct name and member name.
        // const backup_name = this.get_member_name(parent_type.self, last_index);
        const member_name = this.to_member_name(parent_type, last_index);
        this.set_member_name(parent_type.self, last_index, flattened_name);
        this.emit_struct_member(parent_type, member_type_id, last_index, qual);
        // Restore member name.
        this.set_member_name(parent_type.self, last_index, member_name);
    }

    protected emit_block_chain(block: SPIRBlock)
    {
        let select_branch_to_true_block = false;
        let select_branch_to_false_block = false;
        let skip_direct_branch = false;
        let emitted_loop_header_variables = false;
        let force_complex_continue_block = false;
        const loop_level_saver = new ValueSaver<number>(this, "current_loop_level");
        const { backend, ir } = this;

        if (block.merge === SPIRBlockMerge.Loop)
            this.add_loop_level();

        this.emit_hoisted_temporaries(block.declare_temporary);

        let continue_type: SPIRBlockContinueBlockType = SPIRBlockContinueBlockType.ContinueNone;
        if (block.continue_block) {
            continue_type = this.continue_block_type(this.get<SPIRBlock>(SPIRBlock, block.continue_block));
            // If we know we cannot emit a loop, mark the block early as a complex loop so we don't force unnecessary recompiles.
            if (continue_type === SPIRBlockContinueBlockType.ComplexLoop)
                block.complex_continue = true;
        }

        // If we have loop variables, stop masking out access to the variable now.
        for (let var_id of block.loop_variables) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, var_id);
            var_.loop_variable_enable = true;
            // We're not going to declare the variable directly, so emit a copy here.
            this.emit_variable_temporary_copies(var_);
        }

        // Remember deferred declaration state. We will restore it before returning.
        const rearm_dominated_variables: boolean[] = [];
        for (let i = 0; i < block.dominated_variables.length; i++) {
            const var_id = block.dominated_variables[i];
            const var_ = this.get<SPIRVariable>(SPIRVariable, var_id);
            rearm_dominated_variables[i] = var_.deferred_declaration;
        }

        // This is the method often used by spirv-opt to implement loops.
        // The loop header goes straight into the continue block.
        // However, don't attempt this on ESSL 1.0, because if a loop variable is used in a continue block,
        // it *MUST* be used in the continue block. This loop method will not work.
        if (!this.is_legacy_es() && this.block_is_loop_candidate(block, SPIRBlockMethod.MergeToSelectContinueForLoop)) {
            this.flush_undeclared_variables(block);
            if (this.attempt_emit_loop_header(block, SPIRBlockMethod.MergeToSelectContinueForLoop)) {
                if (this.execution_is_noop(this.get<SPIRBlock>(SPIRBlock, block.true_block), this.get<SPIRBlock>(SPIRBlock, block.merge_block)))
                    select_branch_to_false_block = true;
                else
                    select_branch_to_true_block = true;

                emitted_loop_header_variables = true;
                force_complex_continue_block = true;
            }
        }
        // This is the older loop behavior in glslang which branches to loop body directly from the loop header.
        else if (this.block_is_loop_candidate(block, SPIRBlockMethod.MergeToSelectForLoop)) {
            this.flush_undeclared_variables(block);
            if (this.attempt_emit_loop_header(block, SPIRBlockMethod.MergeToSelectForLoop)) {
                // The body of while, is actually just the true (or false) block, so always branch there unconditionally.
                if (this.execution_is_noop(this.get<SPIRBlock>(SPIRBlock, block.true_block), this.get<SPIRBlock>(SPIRBlock, block.merge_block)))
                    select_branch_to_false_block = true;
                else
                    select_branch_to_true_block = true;

                emitted_loop_header_variables = true;
            }
        }
            // This is the newer loop behavior in glslang which branches from Loop header directly to
        // a new block, which in turn has a OpBranchSelection without a selection merge.
        else if (this.block_is_loop_candidate(block, SPIRBlockMethod.MergeToDirectForLoop)) {
            this.flush_undeclared_variables(block);
            if (this.attempt_emit_loop_header(block, SPIRBlockMethod.MergeToDirectForLoop)) {
                skip_direct_branch = true;
                emitted_loop_header_variables = true;
            }
        }
        else if (continue_type === SPIRBlockContinueBlockType.DoWhileLoop) {
            this.flush_undeclared_variables(block);
            this.emit_while_loop_initializers(block);
            emitted_loop_header_variables = true;
            // We have some temporaries where the loop header is the dominator.
            // We risk a case where we have code like:
            // for (;;) { create-temporary; break; } consume-temporary;
            // so force-declare temporaries here.
            this.emit_hoisted_temporaries(block.potential_declare_temporary);
            this.statement("do");
            this.begin_scope();

            this.emit_block_instructions(block);
        }
        else if (block.merge === SPIRBlockMerge.Loop) {
            this.flush_undeclared_variables(block);
            this.emit_while_loop_initializers(block);
            emitted_loop_header_variables = true;

            // We have a generic loop without any distinguishable pattern like for, while or do while.
            this.get<SPIRBlock>(SPIRBlock, block.continue_block).complex_continue = true;
            continue_type = SPIRBlockContinueBlockType.ComplexLoop;

            // We have some temporaries where the loop header is the dominator.
            // We risk a case where we have code like:
            // for (;;) { create-temporary; break; } consume-temporary;
            // so force-declare temporaries here.
            this.emit_hoisted_temporaries(block.potential_declare_temporary);
            this.emit_block_hints(block);
            this.statement("for (;;)");
            this.begin_scope();

            this.emit_block_instructions(block);
        }
        else {
            this.emit_block_instructions(block);
        }

        // If we didn't successfully emit a loop header and we had loop variable candidates, we have a problem
        // as writes to said loop variables might have been masked out, we need a recompile.
        if (!emitted_loop_header_variables && block.loop_variables.length > 0) {
            this.force_recompile();
            for (let var_ of block.loop_variables)
                this.get<SPIRVariable>(SPIRVariable, var_).loop_variable = false;
            block.loop_variables = [];
        }

        this.flush_undeclared_variables(block);

        let emit_next_block = true;
        // Handle end of block.
        switch (block.terminator) {
            case SPIRBlockTerminator.Direct:
                // True when emitting complex continue block.
                if (block.loop_dominator === block.next_block) {
                    this.branch(block.self, block.next_block);
                    emit_next_block = false;
                }
                // True if MergeToDirectForLoop succeeded.
                else if (skip_direct_branch)
                    emit_next_block = false;
                else if (this.is_continue(block.next_block) || this.is_break(block.next_block) || this.is_conditional(block.next_block)) {
                    this.branch(block.self, block.next_block);
                    emit_next_block = false;
                }
                break;

            case SPIRBlockTerminator.Select:
                // True if MergeToSelectForLoop or MergeToSelectContinueForLoop succeeded.
                if (select_branch_to_true_block) {
                    if (force_complex_continue_block) {
                        console.assert(block.true_block === block.continue_block);

                        // We're going to emit a continue block directly here, so make sure it's marked as complex.
                        const continue_block = this.get<SPIRBlock>(SPIRBlock, block.continue_block);
                        const old_complex = continue_block.complex_continue;
                        continue_block.complex_continue = true;
                        this.branch(block.self, block.true_block);
                        continue_block.complex_continue = old_complex;
                    }
                    else
                        this.branch(block.self, block.true_block);
                }
                else if (select_branch_to_false_block) {
                    if (force_complex_continue_block) {
                        console.assert(block.false_block === block.continue_block);

                        // We're going to emit a continue block directly here, so make sure it's marked as complex.
                        const continue_block = this.get<SPIRBlock>(SPIRBlock, block.continue_block);
                        const old_complex = continue_block.complex_continue;
                        continue_block.complex_continue = true;
                        this.branch(block.self, block.false_block);
                        continue_block.complex_continue = old_complex;
                    }
                    else
                        this.branch(block.self, block.false_block);
                }
                else
                    this.branch(block.self, block.condition, block.true_block, block.false_block);
                break;

            case SPIRBlockTerminator.MultiSelect: {
                const type = this.expression_type(block.condition);
                const unsigned_case = type.basetype === SPIRBaseType.UInt || type.basetype === SPIRBaseType.UShort ||
                    type.basetype === SPIRBaseType.UByte || type.basetype === SPIRBaseType.UInt64;

                if (block.merge === SPIRBlockMerge.None)
                    throw new Error("Switch statement is not structured");

                if (!backend.support_64bit_switch && (type.basetype === SPIRBaseType.UInt64 || type.basetype === SPIRBaseType.Int64)) {
                    // SPIR-V spec suggests this is allowed, but we cannot support it in higher level languages.
                    throw new Error("Cannot use 64-bit switch selectors.");
                }

                let label_suffix = "";
                if (type.basetype === SPIRBaseType.UInt && backend.uint32_t_literal_suffix)
                    label_suffix = "u";
                else if (type.basetype === SPIRBaseType.Int64 && backend.support_64bit_switch)
                    label_suffix = "l";
                else if (type.basetype === SPIRBaseType.UInt64 && backend.support_64bit_switch)
                    label_suffix = "ul";
                else if (type.basetype === SPIRBaseType.UShort)
                    label_suffix = backend.uint16_t_literal_suffix;
                else if (type.basetype === SPIRBaseType.Short)
                    label_suffix = backend.int16_t_literal_suffix;

                const old_emitting_switch = this.current_emitting_switch;
                this.current_emitting_switch = block;

                if (block.need_ladder_break)
                    this.statement("bool _", block.self, "_ladder_break = false;");

                // Find all unique case constructs.
                const case_constructs: bigint[][] = []; // unordered_map<uint32_t, SmallVector<uint64_t>>
                const block_declaration_order: number[] = [];
                const literals_to_merge: bigint[] = [];

                // If a switch case branches to the default block for some reason, we can just remove that literal from consideration
                // and let the default: block handle it.
                // 2.11 in SPIR-V spec states that for fall-through cases, there is a very strict declaration order which we can take advantage of here.
                // We only need to consider possible fallthrough if order[i] branches to order[i + 1].
                const cases = this.get_case_list(block);
                for (let c of cases) {
                    if (c.block !== block.next_block && c.block !== block.default_block) {
                        if (!case_constructs.hasOwnProperty(c.block))
                            block_declaration_order.push(c.block);
                        maplike_get(Array, case_constructs, c.block).push(c.value);
                    }
                    else if (c.block === block.next_block && block.default_block !== block.next_block) {
                        // We might have to flush phi inside specific case labels.
                        // If we can piggyback on default:, do so instead.
                        literals_to_merge.push(c.value);
                    }
                }

                // Empty literal array -> default.
                if (block.default_block !== block.next_block) {
                    const default_block = this.get<SPIRBlock>(SPIRBlock, block.default_block);

                    // We need to slide in the default block somewhere in this chain
                    // if there are fall-through scenarios since the default is declared separately in OpSwitch.
                    // Only consider trivial fall-through cases here.
                    const num_blocks = block_declaration_order.length;
                    let injected_block = false;

                    for (let i = 0; i < num_blocks; i++) {
                        const case_block = this.get<SPIRBlock>(SPIRBlock, block_declaration_order[i]);
                        if (this.execution_is_direct_branch(case_block, default_block)) {
                            // Fallthrough to default block, we must inject the default block here.
                            block_declaration_order.splice(i + 1, 0, block.default_block);
                            injected_block = true;
                            break;
                        }
                        else if (this.execution_is_direct_branch(default_block, case_block)) {
                            // Default case is falling through to another case label, we must inject the default block here.
                            block_declaration_order.splice(i, 0, block.default_block);
                            injected_block = true;
                            break;
                        }
                    }

                    // Order does not matter.
                    if (!injected_block)
                        block_declaration_order.push(block.default_block);
                    else if (this.is_legacy_es())
                        throw new Error("Default case label fallthrough to other case label is not supported in ESSL 1.0.");

                    case_constructs[block.default_block] = [];
                }

                const num_blocks = block_declaration_order.length;

                const to_case_label = (literal: bigint, width: number, is_unsigned_case: boolean): string =>
                {
                    if (is_unsigned_case)
                        return convert_to_string(literal);

                    // For smaller cases, the literals are compiled as 32 bit wide
                    // literals so we don't need to care for all sizes specifically.
                    if (width <= 32) {
                        return convert_to_string(BigInt(Number(literal)));
                    }

                    return convert_to_string(BigInt(literal));
                };

                const to_legacy_case_label = (condition: number, labels: bigint[], suffix: string): string =>
                {
                    let ret = "";
                    const count = labels.length;
                    for (let i = 0; i < count; i++) {
                        if (i)
                            ret += " || ";
                        ret += (count > 1 ? "(" : "") + this.to_enclosed_expression(condition) + " === " + labels[i] + suffix + (count > 1 ? ")" : "");
                    }
                    return ret;
                };

                // We need to deal with a complex scenario for OpPhi. If we have case-fallthrough and Phi in the picture,
                // we need to flush phi nodes outside the switch block in a branch,
                // and skip any Phi handling inside the case label to make fall-through work as expected.
                // This kind of code-gen is super awkward and it's a last resort. Normally we would want to handle this
                // inside the case label if at all possible.
                for (let i = 1; backend.support_case_fallthrough && i < num_blocks; i++) {
                    if (this.flush_phi_required(block.self, block_declaration_order[i]) &&
                        this.flush_phi_required(block_declaration_order[i - 1], block_declaration_order[i])) {
                        const target_block = block_declaration_order[i];

                        // Make sure we flush Phi, it might have been marked to be ignored earlier.
                        this.get<SPIRBlock>(SPIRBlock, target_block).ignore_phi_from_block = 0;

                        const literals = case_constructs[target_block];

                        if (!literals.length) {
                            // Oh boy, gotta make a complete negative test instead! o.o
                            // Find all possible literals that would *not* make us enter the default block.
                            // If none of those literals match, we flush Phi ...
                            const conditions: string[] = [];
                            for (let j = 0; j < num_blocks; j++) {
                                const negative_literals = maplike_get<bigint[]>(Array, case_constructs, block_declaration_order[j]);
                                for (let case_label of negative_literals)
                                    conditions.push(this.to_enclosed_expression(block.condition) + " !== " + to_case_label(case_label, type.width, unsigned_case));
                            }

                            this.statement("if (", conditions.join(" && "), ")");
                            this.begin_scope();
                            this.flush_phi(block.self, target_block);
                            this.end_scope();
                        }
                        else {
                            const conditions: string[] = [];
                            // conditions.reserve(literals.size());
                            for (let case_label of literals)
                                conditions.push(this.to_enclosed_expression(block.condition) + " === " + to_case_label(case_label, type.width, unsigned_case));
                            this.statement("if (", conditions.join(" || "), ")");
                            this.begin_scope();
                            this.flush_phi(block.self, target_block);
                            this.end_scope();
                        }

                        // Mark the block so that we don't flush Phi from header to case label.
                        this.get<SPIRBlock>(SPIRBlock, target_block).ignore_phi_from_block = block.self;
                    }
                }

                // If there is only one default block, and no cases, this is a case where SPIRV-opt decided to emulate
                // non-structured exits with the help of a switch block.
                // This is buggy on FXC, so just emit the logical equivalent of a do { } while(false), which is more idiomatic.
                const degenerate_switch = block.default_block !== block.merge_block && !cases.length;

                if (degenerate_switch || this.is_legacy_es()) {
                    // ESSL 1.0 is not guaranteed to support do/while.
                    if (this.is_legacy_es()) {
                        const counter = this.statement_count;
                        this.statement("for (int spvDummy", counter, " = 0; spvDummy", counter,
                            " < 1; spvDummy", counter, "++)");
                    }
                    else
                        this.statement("do");
                }
                else {
                    this.emit_block_hints(block);
                    this.statement("switch (", this.to_unpacked_expression(block.condition), ")");
                }
                this.begin_scope();

                for (let i = 0; i < num_blocks; i++) {
                    const target_block = block_declaration_order[i];
                    const literals = case_constructs[target_block];

                    if (!literals.length) {
                        // Default case.
                        if (!degenerate_switch) {
                            if (this.is_legacy_es())
                                this.statement("else");
                            else
                                this.statement("default:");
                        }
                    }
                    else {
                        if (this.is_legacy_es()) {
                            this.statement((i ? "else " : ""), "if (", to_legacy_case_label(block.condition, literals, label_suffix),
                                ")");
                        }
                        else {
                            for (let case_literal of literals) {
                                // The case label value must be sign-extended properly in SPIR-V, so we can assume 32-bit values here.
                                this.statement("case ", to_case_label(case_literal, type.width, unsigned_case), label_suffix, ":");
                            }
                        }
                    }

                    const case_block = this.get<SPIRBlock>(SPIRBlock, target_block);
                    if (backend.support_case_fallthrough && i + 1 < num_blocks &&
                        this.execution_is_direct_branch(case_block, this.get<SPIRBlock>(SPIRBlock, block_declaration_order[i + 1]))) {
                        // We will fall through here, so just terminate the block chain early.
                        // We still need to deal with Phi potentially.
                        // No need for a stack-like thing here since we only do fall-through when there is a
                        // single trivial branch to fall-through target..
                        this.current_emitting_switch_fallthrough = true;
                    }
                    else
                        this.current_emitting_switch_fallthrough = false;

                    if (!degenerate_switch)
                        this.begin_scope();
                    this.branch(block.self, target_block);
                    if (!degenerate_switch)
                        this.end_scope();

                    this.current_emitting_switch_fallthrough = false;
                }

                // Might still have to flush phi variables if we branch from loop header directly to merge target.
                // This is supposed to emit all cases where we branch from header to merge block directly.
                // There are two main scenarios where cannot rely on default fallthrough.
                // - There is an explicit default: label already.
                //   In this case, literals_to_merge need to form their own "default" case, so that we avoid executing that block.
                // - Header -> Merge requires flushing PHI. In this case, we need to collect all cases and flush PHI there.
                const header_merge_requires_phi = this.flush_phi_required(block.self, block.next_block);
                const need_fallthrough_block = block.default_block === block.next_block || literals_to_merge.length !== 0;
                if ((header_merge_requires_phi && need_fallthrough_block) || literals_to_merge.length !== 0) {
                    for (let case_literal of literals_to_merge)
                        this.statement("case ", to_case_label(case_literal, type.width, unsigned_case), label_suffix, ":");

                    if (block.default_block === block.next_block) {
                        if (this.is_legacy_es())
                            this.statement("else");
                        else
                            this.statement("default:");
                    }

                    this.begin_scope();
                    this.flush_phi(block.self, block.next_block);
                    this.statement("break;");
                    this.end_scope();
                }

                if (degenerate_switch && !this.is_legacy_es())
                    this.end_scope_decl("while(false)");
                else
                    this.end_scope();

                if (block.need_ladder_break) {
                    this.statement("if (_", block.self, "_ladder_break)");
                    this.begin_scope();
                    this.statement("break;");
                    this.end_scope();
                }

                this.current_emitting_switch = old_emitting_switch;
                break;
            }

            case SPIRBlockTerminator.Return: {
                for (let line of this.current_function.fixup_hooks_out)
                    line();

                if (this.processing_entry_point)
                    this.emit_fixup();

                const cfg = this.get_cfg_for_current_function();

                if (block.return_value) {
                    const type = this.expression_type(block.return_value);
                    if (type.array.length && !backend.can_return_array) {
                        // If we cannot return arrays, we will have a special out argument we can write to instead.
                        // The backend is responsible for setting this up, and redirection the return values as appropriate.
                        if (ir.ids[block.return_value].get_type() !== Types.Undef) {
                            this.emit_array_copy("spvReturnValue", 0, block.return_value, StorageClass.Function,
                                this.get_expression_effective_storage_class(block.return_value));
                        }

                        if (!cfg.node_terminates_control_flow_in_sub_graph(this.current_function.entry_block, block.self) ||
                            block.loop_dominator !== <BlockID>(SPIRBlock.NoDominator)) {
                            this.statement("return;");
                        }
                    }
                    else {
                        // OpReturnValue can return Undef, so don't emit anything for this case.
                        if (ir.ids[block.return_value].get_type() !== Types.Undef)
                            this.statement("return ", this.to_unpacked_expression(block.return_value), ";");
                    }
                }
                else if (!cfg.node_terminates_control_flow_in_sub_graph(this.current_function.entry_block, block.self) ||
                    block.loop_dominator !== <BlockID>(SPIRBlock.NoDominator)) {
                    // If this block is the very final block and not called from control flow,
                    // we do not need an explicit return which looks out of place. Just end the function here.
                    // In the very weird case of for(;;) { return; } executing return is unconditional,
                    // but we actually need a return here ...
                    this.statement("return;");
                }
                break;
            }

            // If the Kill is terminating a block with a (probably synthetic) return value, emit a return value statement.
            case SPIRBlockTerminator.Kill:
                this.statement(backend.discard_literal, ";");
                if (block.return_value)
                    this.statement("return ", this.to_unpacked_expression(block.return_value), ";");
                break;

            case SPIRBlockTerminator.Unreachable:
                emit_next_block = false;
                break;

            case SPIRBlockTerminator.IgnoreIntersection:
                this.statement("ignoreIntersectionEXT;");
                break;

            case SPIRBlockTerminator.TerminateRay:
                this.statement("terminateRayEXT;");
                break;

            default:
                throw new Error("Unimplemented block terminator.");
        }

        if (block.next_block && emit_next_block) {
            // If we hit this case, we're dealing with an unconditional branch, which means we will output
            // that block after this. If we had selection merge, we already flushed phi variables.
            if (block.merge !== SPIRBlockMerge.Selection) {
                this.flush_phi(block.self, block.next_block);
                // For a direct branch, need to remember to invalidate expressions in the next linear block instead.
                this.get<SPIRBlock>(SPIRBlock, block.next_block).invalidate_expressions = block.invalidate_expressions;
            }

            // For switch fallthrough cases, we terminate the chain here, but we still need to handle Phi.
            if (!this.current_emitting_switch_fallthrough) {
                // For merge selects we might have ignored the fact that a merge target
                // could have been a break; or continue;
                // We will need to deal with it here.
                if (this.is_loop_break(block.next_block)) {
                    // Cannot check for just break, because switch statements will also use break.
                    console.assert(block.merge === SPIRBlockMerge.Selection);
                    this.statement("break;");
                }
                else if (this.is_continue(block.next_block)) {
                    console.assert(block.merge === SPIRBlockMerge.Selection);
                    this.branch_to_continue(block.self, block.next_block);
                }
                else if (<BlockID>(block.self) !== block.next_block)
                    this.emit_block_chain(this.get<SPIRBlock>(SPIRBlock, block.next_block));
            }
        }

        if (block.merge === SPIRBlockMerge.Loop) {
            if (continue_type === SPIRBlockContinueBlockType.DoWhileLoop) {
                // Make sure that we run the continue block to get the expressions set, but this
                // should become an empty string.
                // We have no fallbacks if we cannot forward everything to temporaries ...
                const continue_block = this.get<SPIRBlock>(SPIRBlock, block.continue_block);
                const positive_test = this.execution_is_noop(this.get<SPIRBlock>(SPIRBlock, continue_block.true_block),
                    this.get<SPIRBlock>(SPIRBlock, continue_block.loop_dominator));

                const current_count = this.statement_count;
                /*const statements =*/ this.emit_continue_block(block.continue_block, positive_test, !positive_test);
                if (this.statement_count !== current_count) {
                    // The DoWhile block has side effects, force ComplexLoop pattern next pass.
                    this.get<SPIRBlock>(SPIRBlock, block.continue_block).complex_continue = true;
                    this.force_recompile();
                }

                // Might have to invert the do-while test here.
                let condition = this.to_expression(continue_block.condition);
                if (!positive_test)
                    condition = "!" + this.enclose_expression(condition);

                this.end_scope_decl("while (" + condition + ")");
            }
            else
                this.end_scope();

            loop_level_saver.release();

            // We cannot break out of two loops at once, so don't check for break; here.
            // Using block.self as the "from" block isn't quite right, but it has the same scope
            // and dominance structure, so it's fine.
            if (this.is_continue(block.merge_block))
                this.branch_to_continue(block.self, block.merge_block);
            else
                this.emit_block_chain(this.get<SPIRBlock>(SPIRBlock, block.merge_block));
        }

        // Forget about control dependent expressions now.
        block.invalidate_expressions = [];

        // After we return, we must be out of scope, so if we somehow have to re-emit this function,
        // re-declare variables if necessary.
        console.assert(rearm_dominated_variables.length === block.dominated_variables.length);
        for (let i = 0; i < block.dominated_variables.length; i++) {
            const var_ = block.dominated_variables[i];
            this.get<SPIRVariable>(SPIRVariable, var_).deferred_declaration = rearm_dominated_variables[i];
        }

        // Just like for deferred declaration, we need to forget about loop variable enable
        // if our block chain is reinstantiated later.
        for (let var_id of block.loop_variables)
            this.get<SPIRVariable>(SPIRVariable, var_id).loop_variable_enable = false;

        // normally, destructor is triggered
        loop_level_saver.release();
    }

    protected emit_hoisted_temporaries(temporaries: Pair<TypeID, ID>[])
    {
        // If we need to force temporaries for certain IDs due to continue blocks, do it before starting loop header.
        // Need to sort these to ensure that reference output is stable.
        temporaries.sort((a, b) => a.second - b.second);

        const { ir, options } = this;
        for (let tmp of temporaries) {
            this.add_local_variable_name(tmp.second);
            const flags = maplike_get(Meta, ir.meta, tmp.second).decoration.decoration_flags;
            const type = this.get<SPIRType>(SPIRType, tmp.first);

            // Not all targets support pointer literals, so don't bother with that case.
            let initializer = "";
            if (options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                initializer = " = " + this.to_zero_initialized_expression(tmp.first);

            this.statement(this.flags_to_qualifiers_glsl(type, flags), this.variable_decl(type, this.to_name(tmp.second)), initializer, ";");

            this.hoisted_temporaries.add(tmp.second);
            this.forced_temporaries.add(tmp.second);

            // The temporary might be read from before it's assigned, set up the expression now.
            this.set<SPIRExpression>(SPIRExpression, tmp.second, this.to_name(tmp.second), tmp.first, true);
        }
    }

    protected emit_uniform(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        if (type.basetype === SPIRBaseType.Image && type.image.sampled === 2 && type.image.dim !== Dim.SubpassData) {
            /*if (!options.es && options.version < 420)
                this.require_extension_internal("GL_ARB_shader_image_load_store");
            else if (options.es && options.version < 310)*/
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

    protected emit_copy_logical_type(lhs_id: number, lhs_type_id: number, rhs_id: number, rhs_type_id: number, chain: number[])
    {
        // Fully unroll all member/array indices one by one.

        const lhs_type = this.get<SPIRType>(SPIRType, lhs_type_id);
        const rhs_type = this.get<SPIRType>(SPIRType, rhs_type_id);

        if (lhs_type.array.length > 0) {
            // Could use a loop here to support specialization constants, but it gets rather complicated with nested array types,
            // and this is a rather obscure opcode anyways, keep it simple unless we are forced to.
            const array_size = this.to_array_size_literal(lhs_type);
            chain.push(0);

            for (let i = 0; i < array_size; i++) {
                chain[chain.length - 1] = i;
                this.emit_copy_logical_type(lhs_id, lhs_type.parent_type, rhs_id, rhs_type.parent_type, chain);
            }
        }
        else if (lhs_type.basetype === SPIRBaseType.Struct) {
            chain.push(0);
            const member_count = lhs_type.member_types.length;
            for (let i = 0; i < member_count; i++) {
                chain[chain.length - 1] = i;
                this.emit_copy_logical_type(lhs_id, lhs_type.member_types[i], rhs_id, rhs_type.member_types[i], chain);
            }
        }
        else {
            // Need to handle unpack/packing fixups since this can differ wildly between the logical types,
            // particularly in MSL.
            // To deal with this, we emit access chains and go through emit_store_statement
            // to deal with all the special cases we can encounter.

            const lhs_meta = new AccessChainMeta();
            const rhs_meta = new AccessChainMeta();
            const lhs = this.access_chain_internal(lhs_id, chain, 0, chain.length, AccessChainFlagBits.INDEX_IS_LITERAL_BIT, lhs_meta);
            const rhs = this.access_chain_internal(rhs_id, chain, 0, chain.length, AccessChainFlagBits.INDEX_IS_LITERAL_BIT, rhs_meta);

            const id = this.ir.increase_bound_by(2);
            lhs_id = id;
            rhs_id = id + 1;

            {
                const lhs_expr = this.set<SPIRExpression>(SPIRExpression, lhs_id, lhs, lhs_type_id, true);
                lhs_expr.need_transpose = lhs_meta.need_transpose;

                if (lhs_meta.storage_is_packed)
                    this.set_extended_decoration(lhs_id, ExtendedDecorations.PhysicalTypePacked);
                if (lhs_meta.storage_physical_type !== 0)
                    this.set_extended_decoration(lhs_id, ExtendedDecorations.PhysicalTypeID, lhs_meta.storage_physical_type);

                this.forwarded_temporaries.add(lhs_id);
                this.suppressed_usage_tracking.add(lhs_id);
            }

            {
                const rhs_expr = this.set<SPIRExpression>(SPIRExpression, rhs_id, rhs, rhs_type_id, true);
                rhs_expr.need_transpose = rhs_meta.need_transpose;

                if (rhs_meta.storage_is_packed)
                    this.set_extended_decoration(rhs_id, ExtendedDecorations.PhysicalTypePacked);
                if (rhs_meta.storage_physical_type !== 0)
                    this.set_extended_decoration(rhs_id, ExtendedDecorations.PhysicalTypeID, rhs_meta.storage_physical_type);

                this.forwarded_temporaries.add(rhs_id);
                this.suppressed_usage_tracking.add(rhs_id);
            }

            this.emit_store_statement(lhs_id, rhs_id);
        }
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
        if (type.pointer && type.storage === StorageClass.PhysicalStorageBufferEXT && type.basetype !== SPIRBaseType.Struct) {
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
            case SPIRBaseType.Struct:
                // Need OpName lookup here to get a "sensible" name for a struct.
                if (backend.explicit_struct_type)
                    return "struct " + this.to_name(type.self);
                else
                    return this.to_name(type.self);

            case SPIRBaseType.Image:
            case SPIRBaseType.SampledImage:
                return this.image_type_glsl(type, id);

            case SPIRBaseType.Sampler:
                // The depth field is set by calling code based on the variable ID of the sampler, effectively reintroducing
                // this distinction into the type system.
                return this.comparison_ids.has(id) ? "samplerShadow" : "sampler";

            case SPIRBaseType.AccelerationStructure:
                // return this.ray_tracing_is_khr ? "accelerationStructureEXT" : "accelerationStructureNV";


            case SPIRBaseType.RayQuery:
                throw new Error("RayQuery is not supported");
                // return "rayQueryEXT";

            case SPIRBaseType.Void:
                return "void";

            default:
                break;
        }

        if (type.basetype === SPIRBaseType.UInt && this.is_legacy())
            throw new Error("Unsigned integers are not supported on legacy targets.");

        // TODO: All below can be simplified using a lookup if we assume correct Spir-V
        if (type.vecsize === 1 && type.columns === 1) // Scalar builtin
        {
            switch (type.basetype) {
                case SPIRBaseType.Boolean:
                    return "bool";
                case SPIRBaseType.SByte:
                    return backend.basic_int8_type;
                case SPIRBaseType.UByte:
                    return backend.basic_uint8_type;
                case SPIRBaseType.Short:
                    return backend.basic_int16_type;
                case SPIRBaseType.UShort:
                    return backend.basic_uint16_type;
                case SPIRBaseType.Int:
                    return backend.basic_int_type;
                case SPIRBaseType.UInt:
                    return backend.basic_uint_type;
                /*case SPIRBaseType.AtomicCounter:
                    return "atomic_uint";*/
                case SPIRBaseType.Half:
                    return "float16_t";
                case SPIRBaseType.Float:
                    return "float";
                case SPIRBaseType.Double:
                    return "double";
                case SPIRBaseType.Int64:
                    return "int64_t";
                case SPIRBaseType.UInt64:
                    return "uint64_t";
                default:
                    return "???";
            }
        }
        else if (type.vecsize > 1 && type.columns === 1) // Vector builtin
        {
            switch (type.basetype) {
                case SPIRBaseType.Boolean:
                    return "bvec" + type.vecsize;
                case SPIRBaseType.SByte:
                    return "i8vec" + type.vecsize;
                case SPIRBaseType.UByte:
                    return "u8vec" + type.vecsize;
                case SPIRBaseType.Short:
                    return "i16vec" + type.vecsize;
                case SPIRBaseType.UShort:
                    return "u16vec" + type.vecsize;
                case SPIRBaseType.Int:
                    return "ivec" + type.vecsize;
                case SPIRBaseType.UInt:
                    return "uvec" + type.vecsize;
                case SPIRBaseType.Half:
                    return "f16vec" + type.vecsize;
                case SPIRBaseType.Float:
                    return "vec" + type.vecsize;
                case SPIRBaseType.Double:
                    return "dvec" + type.vecsize;
                case SPIRBaseType.Int64:
                    return "i64vec" + type.vecsize;
                case SPIRBaseType.UInt64:
                    return "u64vec" + type.vecsize;
                default:
                    return "???";
            }
        }
        else if (type.vecsize === type.columns) // Simple Matrix builtin
        {
            switch (type.basetype) {
                case SPIRBaseType.Boolean:
                    return "bmat" + type.vecsize;
                case SPIRBaseType.Int:
                    return "imat" + type.vecsize;
                case SPIRBaseType.UInt:
                    return "umat" + type.vecsize;
                case SPIRBaseType.Half:
                    return "f16mat" + type.vecsize;
                case SPIRBaseType.Float:
                    return "mat" + type.vecsize;
                case SPIRBaseType.Double:
                    return "dmat" + type.vecsize;
                // Matrix types not supported for int64/uint64.
                default:
                    return "???";
            }
        }
        else {
            switch (type.basetype) {
                case SPIRBaseType.Boolean:
                    return `bmat${type.columns}x${type.vecsize}`;
                case SPIRBaseType.Int:
                    return `imat${type.columns}x${type.vecsize}`;
                case SPIRBaseType.UInt:
                    return `umat${type.columns}x${type.vecsize}`;
                case SPIRBaseType.Half:
                    return `f16mat${type.columns}x${type.vecsize}`;
                case SPIRBaseType.Float:
                    return `mat${type.columns}x${type.vecsize}`;
                case SPIRBaseType.Double:
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
            case BuiltIn.Position:
                return "gl_Position";
            case BuiltIn.PointSize:
                return "gl_PointSize";
            case BuiltIn.ClipDistance:
                return "gl_ClipDistance";
            case BuiltIn.CullDistance:
                return "gl_CullDistance";
            case BuiltIn.VertexId:
                // if (options.vulkan_semantics)
                //     throw new Error("Cannot implement gl_VertexID in Vulkan GLSL. This shader was created "
                // "with GL semantics.");
                return "gl_VertexID";
            case BuiltIn.InstanceId:
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
                /*if (!options.es && options.version < 140) {
                    this.require_extension_internal("GL_ARB_draw_instanced");
                }*/
                return "gl_InstanceID";
            case BuiltIn.VertexIndex:
                /*if (options.vulkan_semantics)
                    return "gl_VertexIndex";
                else*/
                return "gl_VertexID"; // gl_VertexID already has the base offset applied.
            case BuiltIn.InstanceIndex:
                // if (options.vulkan_semantics)
                //     return "gl_InstanceIndex";

                /*if (!options.es && options.version < 140) {
                    this.require_extension_internal("GL_ARB_draw_instanced");
                }*/

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
            case BuiltIn.PrimitiveId:
                if (storage === StorageClass.Input && this.get_entry_point().model === ExecutionModel.Geometry)
                    return "gl_PrimitiveIDIn";
                else
                    return "gl_PrimitiveID";
            case BuiltIn.InvocationId:
                return "gl_InvocationID";
            case BuiltIn.Layer:
                return "gl_Layer";
            case BuiltIn.ViewportIndex:
                return "gl_ViewportIndex";
            case BuiltIn.TessLevelOuter:
                return "gl_TessLevelOuter";
            case BuiltIn.TessLevelInner:
                return "gl_TessLevelInner";
            case BuiltIn.TessCoord:
                return "gl_TessCoord";
            case BuiltIn.FragCoord:
                return "gl_FragCoord";
            case BuiltIn.PointCoord:
                return "gl_PointCoord";
            case BuiltIn.FrontFacing:
                return "gl_FrontFacing";
            case BuiltIn.FragDepth:
                return "gl_FragDepth";
            case BuiltIn.NumWorkgroups:
                return "gl_NumWorkGroups";
            case BuiltIn.WorkgroupSize:
                return "gl_WorkGroupSize";
            case BuiltIn.WorkgroupId:
                return "gl_WorkGroupID";
            case BuiltIn.LocalInvocationId:
                return "gl_LocalInvocationID";
            case BuiltIn.GlobalInvocationId:
                return "gl_GlobalInvocationID";
            case BuiltIn.LocalInvocationIndex:
                return "gl_LocalInvocationIndex";
            case BuiltIn.HelperInvocation:
                return "gl_HelperInvocation";

            case BuiltIn.BaseVertex:
                // if (options.es)
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
                /*this.require_extension_internal("GL_ARB_shader_draw_parameters");
                return "SPIRV_Cross_BaseVertex";*/

            case BuiltIn.BaseInstance:
                // if (options.es)
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
                /*this.require_extension_internal("GL_ARB_shader_draw_parameters");
                return "SPIRV_Cross_BaseInstance";*/

            case BuiltIn.DrawIndex:
                // if (options.es)
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
                /*this.require_extension_internal("GL_ARB_shader_draw_parameters");
                return "gl_DrawIDARB";*/

            case BuiltIn.SampleId:
                // if (options.es && options.version < 320)
                    this.require_extension_internal("GL_OES_sample_variables");
                /*if (!options.es && options.version < 400)
                    throw new Error("gl_SampleID not supported before GLSL 400.");*/
                return "gl_SampleID";

            case BuiltIn.SampleMask:
                // if (options.es && options.version < 320)
                    this.require_extension_internal("GL_OES_sample_variables");
                /*if (!options.es && options.version < 400)
                    throw new Error("gl_SampleMask/gl_SampleMaskIn not supported before GLSL 400.");*/

                if (storage === StorageClass.Input)
                    return "gl_SampleMaskIn";
                else
                    return "gl_SampleMask";

            case BuiltIn.SamplePosition:
                // if (options.es && options.version < 320)
                    this.require_extension_internal("GL_OES_sample_variables");
                /*if (!options.es && options.version < 400)
                    throw new Error("gl_SamplePosition not supported before GLSL 400.");*/
                return "gl_SamplePosition";

            case BuiltIn.ViewIndex:
                /*if (options.vulkan_semantics)
                    return "gl_ViewIndex";
                else*/
                return "gl_ViewID_OVR";

            case BuiltIn.NumSubgroups:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::NumSubgroups);
            return "gl_NumSubgroups";*/

            case BuiltIn.SubgroupId:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupID);
            return "gl_SubgroupID";*/

            case BuiltIn.SubgroupSize:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupSize);
            return "gl_SubgroupSize";*/

            case BuiltIn.SubgroupLocalInvocationId:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupInvocationID);
            return "gl_SubgroupInvocationID";*/

            case BuiltIn.SubgroupEqMask:
            /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
            return "gl_SubgroupEqMask";*/

            case BuiltIn.SubgroupGeMask:
            /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
            return "gl_SubgroupGeMask";*/

            case BuiltIn.SubgroupGtMask:
            /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
            return "gl_SubgroupGtMask";*/

            case BuiltIn.SubgroupLeMask:
            /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
            return "gl_SubgroupLeMask";*/

            case BuiltIn.SubgroupLtMask:
                /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
                return "gl_SubgroupLtMask";*/
                throw new Error("Subgroups not supported");

            case BuiltIn.LaunchIdKHR:
            // return ray_tracing_is_khr ? "gl_LaunchIDEXT" : "gl_LaunchIDNV";
            case BuiltIn.LaunchSizeKHR:
            // return ray_tracing_is_khr ? "gl_LaunchSizeEXT" : "gl_LaunchSizeNV";
            case BuiltIn.WorldRayOriginKHR:
            // return ray_tracing_is_khr ? "gl_WorldRayOriginEXT" : "gl_WorldRayOriginNV";
            case BuiltIn.WorldRayDirectionKHR:
            // return ray_tracing_is_khr ? "gl_WorldRayDirectionEXT" : "gl_WorldRayDirectionNV";
            case BuiltIn.ObjectRayOriginKHR:
            // return ray_tracing_is_khr ? "gl_ObjectRayOriginEXT" : "gl_ObjectRayOriginNV";
            case BuiltIn.ObjectRayDirectionKHR:
            // return ray_tracing_is_khr ? "gl_ObjectRayDirectionEXT" : "gl_ObjectRayDirectionNV";
            case BuiltIn.RayTminKHR:
            // return ray_tracing_is_khr ? "gl_RayTminEXT" : "gl_RayTminNV";
            case BuiltIn.RayTmaxKHR:
            // return ray_tracing_is_khr ? "gl_RayTmaxEXT" : "gl_RayTmaxNV";
            case BuiltIn.InstanceCustomIndexKHR:
            // return ray_tracing_is_khr ? "gl_InstanceCustomIndexEXT" : "gl_InstanceCustomIndexNV";
            case BuiltIn.ObjectToWorldKHR:
            // return ray_tracing_is_khr ? "gl_ObjectToWorldEXT" : "gl_ObjectToWorldNV";
            case BuiltIn.WorldToObjectKHR:
            // return ray_tracing_is_khr ? "gl_WorldToObjectEXT" : "gl_WorldToObjectNV";
            case BuiltIn.HitTNV:
            // gl_HitTEXT is an alias of RayTMax in KHR.
            // return "gl_HitTNV";
            case BuiltIn.HitKindKHR:
            // return ray_tracing_is_khr ? "gl_HitKindEXT" : "gl_HitKindNV";
            case BuiltIn.IncomingRayFlagsKHR:
                throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "gl_IncomingRayFlagsEXT" : "gl_IncomingRayFlagsNV";

            case BuiltIn.BaryCoordNV: {
                // if (options.es && options.version < 320)
                    throw new Error("gl_BaryCoordNV requires ESSL 320.");
                /*else if (!options.es && options.version < 450)
                    throw new Error("gl_BaryCoordNV requires GLSL 450.");
                this.require_extension_internal("GL_NV_fragment_shader_barycentric");
                return "gl_BaryCoordNV";*/
            }

            case BuiltIn.BaryCoordNoPerspNV: {
                // if (options.es && options.version < 320)
                    throw new Error("gl_BaryCoordNoPerspNV requires ESSL 320.");
                /*else if (!options.es && options.version < 450)
                    throw new Error("gl_BaryCoordNoPerspNV requires GLSL 450.");
                this.require_extension_internal("GL_NV_fragment_shader_barycentric");
                return "gl_BaryCoordNoPerspNV";*/
            }

            case BuiltIn.FragStencilRefEXT: {
                /*if (!options.es) {
                    this.require_extension_internal("GL_ARB_shader_stencil_export");
                    return "gl_FragStencilRefARB";
                }
                else*/
                    throw new Error("Stencil export not supported in GLES.");
            }

            case BuiltIn.PrimitiveShadingRateKHR: {
                // if (!options.vulkan_semantics)
                throw new Error("Can only use PrimitiveShadingRateKHR in Vulkan GLSL.");
                // require_extension_internal("GL_EXT_fragment_shading_rate");
                // return "gl_PrimitiveShadingRateEXT";
            }

            case BuiltIn.ShadingRateKHR: {
                // if (!options.vulkan_semantics)
                throw new Error("Can only use ShadingRateKHR in Vulkan GLSL.");
                // require_extension_internal("GL_EXT_fragment_shading_rate");
                // return "gl_ShadingRateEXT";
            }

            case BuiltIn.DeviceIndex:
                // if (!options.vulkan_semantics)
                throw new Error("Need Vulkan semantics for device group support.");
            // require_extension_internal("GL_EXT_device_group");
            // return "gl_DeviceIndex";

            case BuiltIn.FullyCoveredEXT:
                /*if (!options.es)
                    this.require_extension_internal("GL_NV_conservative_raster_underestimation");
                else*/
                    throw new Error("Need desktop GL to use GL_NV_conservative_raster_underestimation.");
                // return "gl_FragFullyCoveredNV";

            default:
                return "gl_BuiltIn_" + convert_to_string(builtin);
        }
    }

    protected image_type_glsl(type: SPIRType, id: number = 0): string
    {
        const imagetype = this.get<SPIRType>(SPIRType, type.image.type);
        let res = "";

        switch (imagetype.basetype) {
            case SPIRBaseType.Int:
            case SPIRBaseType.Short:
            case SPIRBaseType.SByte:
                res = "i";
                break;
            case SPIRBaseType.UInt:
            case SPIRBaseType.UShort:
            case SPIRBaseType.UByte:
                res = "u";
                break;
            default:
                break;
        }

        // For half image types, we will force mediump for the sampler, and cast to f16 after any sampling operation.
        // We cannot express a true half texture type in GLSL. Neither for short integer formats for that matter.

        /*if (type.basetype === SPIRBaseType.Image && type.image.dim === Dim.SubpassData && options.vulkan_semantics)
            return res + "subpassInput" + (type.image.ms ? "MS" : "");
        else*/
        if (type.basetype === SPIRBaseType.Image && type.image.dim === Dim.SubpassData &&
            this.subpass_input_is_framebuffer_fetch(id)) {
            const sampled_type = defaultClone(SPIRType, this.get<SPIRType>(SPIRType, type.image.type));
            sampled_type.vecsize = 4;
            return this.type_to_glsl(sampled_type);
        }

        // If we're emulating subpassInput with samplers, force sampler2D
        // so we don't have to specify format.
        if (type.basetype === SPIRBaseType.Image && type.image.dim !== Dim.SubpassData) {
            // Sampler buffers are always declared as samplerBuffer even though they might be separate images in the SPIR-V.
            if (type.image.dim === Dim.Buffer && type.image.sampled === 1)
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
            case Dim.Cube:
                res += "Cube";
                break;
            case Dim.Rect:
                // if (options.es)
                    throw new Error("Rectangle textures are not supported on OpenGL ES.");

                /*if (this.is_legacy_desktop())
                    this.require_extension_internal("GL_ARB_texture_rectangle");

                res += "2DRect";
                break;*/

            case Dim.Buffer:
                // if (options.es && options.version < 320)
                    this.require_extension_internal("GL_EXT_texture_buffer");
                /*else if (!options.es && options.version < 300)
                    this.require_extension_internal("GL_EXT_texture_buffer_object");*/
                res += "Buffer";
                break;

            case Dim.SubpassData:
                res += "2D";
                break;
            default:
                throw new Error("Only 1D, 2D, 2DRect, 3D, Buffer, InputTarget and Cube textures supported.");
        }

        if (type.image.ms)
            res += "MS";
        if (type.image.arrayed) {
            /*if (this.is_legacy_desktop())
                this.require_extension_internal("GL_EXT_texture_array");*/
            res += "Array";
        }

        // "Shadow" state in GLSL only exists for samplers and combined image samplers.
        if (((type.basetype === SPIRBaseType.SampledImage) || (type.basetype === SPIRBaseType.Sampler)) &&
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
            if (backend.use_initializer_list && backend.use_typed_initializer_list && type.basetype === SPIRBaseType.Struct &&
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
        else if (type.basetype === SPIRBaseType.Struct && type.member_types.length === 0) {
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
            case Op.SConvert:
            case Op.UConvert:
            case Op.FConvert:
                op = this.type_to_glsl_constructor(type);
                break;

            case Op.SNegate:
            case Op.Not:
            case Op.LogicalNot:
                unary = true;
                op = ops[cop.opcode];
                break;
            case Op.IAdd:
            case Op.ISub:
            case Op.IMul:
            case Op.SDiv:
            case Op.UDiv:
            case Op.UMod:
            case Op.SMod:
            case Op.ShiftRightLogical:
            case Op.ShiftRightArithmetic:
            case Op.ShiftLeftLogical:
            case Op.BitwiseOr:
            case Op.BitwiseXor:
            case Op.BitwiseAnd:
            case Op.LogicalOr:
            case Op.LogicalAnd:
            case Op.LogicalEqual:
            case Op.LogicalNotEqual:
            case Op.IEqual:
            case Op.INotEqual:
            case Op.ULessThan:
            case Op.SLessThan:
            case Op.ULessThanEqual:
            case Op.SLessThanEqual:
            case Op.UGreaterThan:
            case Op.SGreaterThan:
            case Op.UGreaterThanEqual:
            case Op.SGreaterThanEqual:
                binary = true;
                op = ops[cop.opcode];
                break;

            case Op.SRem: {
                const op0 = cop.arguments[0];
                const op1 = cop.arguments[1];
                return this.to_enclosed_expression(op0) + " - " + this.to_enclosed_expression(op1) + " * (" +
                this.to_enclosed_expression(op0) + " / " + this.to_enclosed_expression(op1) + ")";
            }

            case Op.Select: {
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

            case Op.VectorShuffle: {
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

            case Op.CompositeExtract: {
                return this.access_chain_internal(cop.arguments[0], cop.arguments, 1, cop.arguments.length - 1,
                    AccessChainFlagBits.INDEX_IS_LITERAL_BIT, null);
            }

            case Op.CompositeInsert:
                throw new Error("OpCompositeInsert spec constant op is not supported.");

            default:
                // Some opcodes are unimplemented here, these are currently not possible to test from glslang.
                throw new Error("Unimplemented spec constant op.");
        }

        let bit_width = 0;
        if (unary || binary || cop.opcode === Op.SConvert || cop.opcode === Op.UConvert)
            bit_width = this.expression_type(cop.arguments[0]).width;

        let input_type: SPIRBaseType;
        const skip_cast_if_equal_type = opcode_is_sign_invariant(cop.opcode);

        switch (cop.opcode) {
            case Op.IEqual:
            case Op.INotEqual:
                input_type = to_signed_basetype(bit_width);
                break;

            case Op.SLessThan:
            case Op.SLessThanEqual:
            case Op.SGreaterThan:
            case Op.SGreaterThanEqual:
            case Op.SMod:
            case Op.SDiv:
            case Op.ShiftRightArithmetic:
            case Op.SConvert:
            case Op.SNegate:
                input_type = to_signed_basetype(bit_width);
                break;

            case Op.ULessThan:
            case Op.ULessThanEqual:
            case Op.UGreaterThan:
            case Op.UGreaterThanEqual:
            case Op.UMod:
            case Op.UDiv:
            case Op.ShiftRightLogical:
            case Op.UConvert:
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

            if (type.basetype !== input_type && type.basetype !== SPIRBaseType.Boolean) {
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
        else if (cop.opcode === Op.SConvert || cop.opcode === Op.UConvert) {
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
        const type = defaultClone(SPIRType, this.get<SPIRType>(SPIRType, c.constant_type));
        type.columns = 1;

        const scalar_type = defaultClone(SPIRType, type);
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
            case SPIRBaseType.Half:
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

            case SPIRBaseType.Float:
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

            case SPIRBaseType.Double:
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

            case SPIRBaseType.Int64: {
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

            case SPIRBaseType.UInt64:
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

            case SPIRBaseType.UInt:
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

            case SPIRBaseType.Int:
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

            case SPIRBaseType.UShort:
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

            case SPIRBaseType.Short:
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

            case SPIRBaseType.UByte:
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

            case SPIRBaseType.SByte:
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

            case SPIRBaseType.Boolean:
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
            this.redirect_statement.push(args.join(""));
            this.statement_count++;
        }
        else {
            for (let i = 0; i < this.indent; i++)
                this.buffer.append("   ");

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


    protected add_local_variable_name(id: number)
    {
        const dec = maplike_get(Meta, this.ir.meta, id).decoration;
        dec.alias = this.add_variable(this.local_variable_names, this.block_names, dec.alias);
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
        if (type.pointer && type.storage === StorageClass.PhysicalStorageBufferEXT && type.basetype !== SPIRBaseType.Struct) {
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
                /*if (!options.es && options.version < 430)
                    this.require_extension_internal("GL_ARB_arrays_of_arrays");
                else if (options.es && options.version < 310)*/
                    throw new Error("Arrays of arrays not supported before ESSL version 310. " +
                        "Try using --flatten-multidimensional-arrays or set " +
                        "options.flatten_multidimensional_arrays to true.");
            }

            /*let res = "";
            for (let i = type.array.length; i; i--) {
                res += "[";
                res += this.to_array_size(type, i - 1);
                res += "]";
            }
            return res;*/
        }
    }

    protected add_function_overload(func: SPIRFunction)
    {
        const hasher = new Hasher();
        for (let arg of func.arguments) {
            // Parameters can vary with pointer type or not,
            // but that will not change the signature in GLSL/HLSL,
            // so strip the pointer type before hashing.
            const type_id = this.get_pointee_type_id(arg.type);
            const type = this.get<SPIRType>(SPIRType, type_id);

            if (this.combined_image_samplers.length) {
                // If we have combined image samplers, we cannot really trust the image and sampler arguments
                // we pass down to callees, because they may be shuffled around.
                // Ignore these arguments, to make sure that functions need to differ in some other way
                // to be considered different overloads.
                if (type.basetype === SPIRBaseType.SampledImage ||
                    (type.basetype === SPIRBaseType.Image && type.image.sampled === 1) || type.basetype === SPIRBaseType.Sampler) {
                    continue;
                }
            }

            hasher.u32(type_id);
        }
        const types_hash = hasher.get();

        const function_name = this.to_name(func.self);
        const itr_second = this.function_overloads[function_name];
        if (itr_second) {
            // There exists a function with this name already.
            const overloads = itr_second;
            if (overloads.has(types_hash)) {
                // Overload conflict, assign a new name.
                this.add_resource_name(func.self);
                maplike_get(Set, this.function_overloads, this.to_name(func.self)).add(types_hash);
            }
            else {
                // Can reuse the name.
                overloads.add(types_hash);
            }
        }
        else {
            // First time we see this function name.
            this.add_resource_name(func.self);
            maplike_get(Set, this.function_overloads, this.to_name(func.self)).add(types_hash);
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

    protected emit_fixup()
    {
        if (this.is_vertex_like_shader()) {
            if (this.options.vertex.fixup_clipspace) {
                const suffix = this.backend.float_literal_suffix ? "f" : "";
                this.statement("gl_Position.z = 2.0", suffix, " * gl_Position.z - gl_Position.w;");
            }

            if (this.options.vertex.flip_vert_y)
                this.statement("gl_Position.y = -gl_Position.y;");
        }
    }

    protected variable_decl(type: SPIRType, name: string, id?: number);
    protected variable_decl(variable: SPIRVariable): string
    protected variable_decl(variable: SPIRVariable | SPIRType, name?: string, id: number = 0)
    {
        if (variable instanceof SPIRType) {
            // first overload
            const type = <SPIRType>variable;
            let type_name = this.type_to_glsl(type, id);
            type_name = this.remap_variable_type_name(type, name, type_name);

            return type_name + " " + name + this.type_to_array_glsl(type);
        }

        // Ignore the pointer type since GLSL doesn't have pointers.
        const type = this.get_variable_data_type(variable);

        if (type.pointer_depth > 1 && !this.backend.support_pointer_to_pointer)
            throw new Error("Cannot declare pointer-to-pointer types.");

        const options = this.options;
        const ir = this.ir;
        let res = this.to_qualifiers_glsl(variable.self) + this.variable_decl(type, this.to_name(variable.self), variable.self);

        if (variable.loop_variable && variable.static_expression) {
            const expr = variable.static_expression;
            if (ir.ids[expr].get_type() !== Types.Undef)
                res += " = " + this.to_unpacked_expression(variable.static_expression);
            else if (options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                res += " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(variable));
        }
        else if (variable.initializer && !this.variable_decl_is_remapped_storage(variable, StorageClass.Workgroup)) {
            const expr = variable.initializer;
            if (ir.ids[expr].get_type() !== Types.Undef)
                res += " = " + this.to_initializer_expression(variable);
            else if (options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                res += " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(variable));
        }

        return res;
    }

    protected variable_decl_function_local(var_: SPIRVariable): string
    {
        // These variables are always function local,
        // so make sure we emit the variable without storage qualifiers.
        // Some backends will inject custom variables locally in a function
        // with a storage qualifier which is not function-local.
        const old_storage = var_.storage;
        var_.storage = StorageClass.Function;
        const expr = this.variable_decl(var_);
        var_.storage = old_storage;
        return expr;
    }

    protected variable_decl_is_remapped_storage(var_: SPIRVariable, storage: StorageClass): boolean
    {
        return var_.storage === storage;
    }

    protected to_func_call_arg(arg: SPIRFunctionParameter, id: number): string
    {
        // Make sure that we use the name of the original variable, and not the parameter alias.
        let name_id = id;
        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, id);
        if (var_ && var_.basevariable)
            name_id = var_.basevariable;
        return this.to_expression(name_id);
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
            return this.has_decoration(id, Decoration.RowMajor);
    }

    protected member_is_non_native_row_major_matrix(type: SPIRType, index: number): boolean
    {
        // Natively supported row-major matrices do not need to be converted.
        if (this.backend.native_row_major_matrix && !this.is_legacy())
            return false;

        // Non-matrix or column-major matrix types do not need to be converted.
        if (!this.has_member_decoration(type.self, index, Decoration.RowMajor))
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
        return this.has_extended_member_decoration(type.self, index, ExtendedDecorations.PhysicalTypeID);
    }

    protected member_is_packed_physical_type(type: SPIRType, index: number): boolean
    {
        return this.has_extended_member_decoration(type.self, index, ExtendedDecorations.PhysicalTypePacked);
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
        if (type.type_alias !== <TypeID>(0) && !this.has_extended_decoration(type.type_alias, ExtendedDecorations.BufferBlockRepacked))
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

        if (this.has_extended_decoration(type.self, ExtendedDecorations.PaddingTarget))
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
        if (execution.model === ExecutionModel.Fragment && this.is_legacy())
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
        /*if (options.separate_shader_objects && !options.es && execution.model !== ExecutionModel.Fragment) {
            switch (execution.model) {
                /!*case ExecutionModelGeometry:
                case ExecutionModelTessellationControl:
                case ExecutionModelTessellationEvaluation:
                    emit_declared_builtin_block(StorageClassInput, execution.model);
                    emit_declared_builtin_block(StorageClassOutput, execution.model);
                    break;*!/

                case ExecutionModel.Vertex:
                    this.emit_declared_builtin_block(StorageClass.Output, execution.model);
                    break;

                default:
                    break;
            }
        }
        else*/ if (this.should_force_emit_builtin_block(StorageClass.Output)) {
            this.emit_declared_builtin_block(StorageClass.Output, execution.model);
        }
        else if (execution.geometry_passthrough) {
            // Need to declare gl_in with Passthrough.
            // If we're doing passthrough, we cannot emit an output block, so the output block test above will never pass.
            this.emit_declared_builtin_block(StorageClass.Input, execution.model);
        }
        else {
            // Need to redeclare clip/cull distance with explicit size to use them.
            // SPIR-V mandates these builtins have a size declared.
            const storage = execution.model === ExecutionModel.Fragment ? "in" : "out";
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

                if (id.get_type() === Types.Constant) {
                    const c = id.get<SPIRConstant>(SPIRConstant);

                    const needs_declaration = c.specialization || c.is_used_as_lut;

                    if (needs_declaration) {
                        if (/*!options.vulkan_semantics &&*/ c.specialization) {
                            c.specialization_constant_macro_name =
                                this.constant_value_macro_name(this.get_decoration(c.self, Decoration.SpecId));
                        }
                        this.emit_constant(c);
                        emitted = true;
                    }
                }
                else if (id.get_type() === Types.ConstantOp) {
                    this.emit_specialization_constant_op(id.get<SPIRConstantOp>(SPIRConstantOp));
                    emitted = true;
                }
                else if (id.get_type() === Types.Type) {
                    let type = id.get<SPIRType>(SPIRType);

                    let is_natural_struct = type.basetype === SPIRBaseType.Struct && type.array.length === 0 && !type.pointer &&
                            (!this.has_decoration(type.self, Decoration.Block) &&
                             !this.has_decoration(type.self, Decoration.BufferBlock));


                    // Special case, ray payload and hit attribute blocks are not really blocks, just regular structs.
                    /*if (type.basetype === SPIRBaseType.Struct && type.pointer &&
                        this.has_decoration(type.self, Decoration.Block) &&
                        (type.storage === StorageClass.RayPayloadKHR || type.storage === StorageClass.IncomingRayPayloadKHR ||
                        type.storage === StorageClass.HitAttributeKHR))
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

        if (ir.addressing_model === AddressingModel.PhysicalStorageBuffer64EXT) {
            for (let type of this.physical_storage_non_block_pointer_types) {
                this.emit_buffer_reference_block(type, false);
            }

            // Output buffer reference blocks.
            // Do this in two stages, one with forward declaration,
            // and one without. Buffer reference blocks can reference themselves
            // to support things like linked lists.
            ir.for_each_typed_id<SPIRType>(SPIRType, (self, type) =>
            {
                if (type.basetype === SPIRBaseType.Struct && type.pointer &&
                    type.pointer_depth === 1 && !this.type_is_array_of_pointers(type) &&
                    type.storage === StorageClass.PhysicalStorageBufferEXT) {
                    this.emit_buffer_reference_block(self, true);
                }
            });

            ir.for_each_typed_id<SPIRType>(SPIRType, (self, type) =>
            {
                if (type.basetype === SPIRBaseType.Struct &&
                    type.pointer && type.pointer_depth === 1 && !this.type_is_array_of_pointers(type) &&
                    type.storage === StorageClass.PhysicalStorageBufferEXT) {
                    this.emit_buffer_reference_block(self, false);
                }
            });
        }

        // Output UBOs and SSBOs
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);

            const is_block_storage =    type.storage === StorageClass.StorageBuffer ||
                                        type.storage === StorageClass.Uniform ||
                                        type.storage === StorageClass.ShaderRecordBufferKHR;
            const flags = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags;
            const has_block_flags = flags.get(Decoration.Block) || flags.get(Decoration.BufferBlock);

            if (var_.storage !== StorageClass.Function && type.pointer && is_block_storage &&
                !this.is_hidden_variable(var_) && has_block_flags) {
                this.emit_buffer_block(var_);
            }
        });

        // Output push constant blocks
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_: SPIRVariable) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            if (var_.storage !== StorageClass.Function && type.pointer &&
                type.storage === StorageClass.PushConstant && !this.is_hidden_variable(var_)) {
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
                const sampler_buffer = type.basetype === SPIRBaseType.Image && type.image.dim === Dim.Buffer;
                const separate_image = type.basetype === SPIRBaseType.Image && type.image.sampled === 1;
                const separate_sampler = type.basetype === SPIRBaseType.Sampler;
                if (!sampler_buffer && (separate_image || separate_sampler))
                    return;
            }

            if (var_.storage !== StorageClass.Function && type.pointer &&
                (type.storage === StorageClass.UniformConstant || type.storage === StorageClass.AtomicCounter ||
                    type.storage === StorageClass.RayPayloadKHR || type.storage === StorageClass.IncomingRayPayloadKHR ||
                    type.storage === StorageClass.CallableDataKHR || type.storage === StorageClass.IncomingCallableDataKHR ||
                    type.storage === StorageClass.HitAttributeKHR) && !this.is_hidden_variable(var_)) {
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
            if (var_.storage === StorageClass.Output && !this.is_legacy() &&
                this.location_is_framebuffer_fetch(this.get_decoration(var_.self, Decoration.Location))/* !== 0*/) {
                is_hidden = false;
            }

            if (var_.storage !== StorageClass.Function && type.pointer &&
                (var_.storage === StorageClass.Input || var_.storage === StorageClass.Output) &&
                this.interface_variable_exists_in_entry_point(var_.self) && !is_hidden) {
                if (/*options.es &&*/ this.get_execution_model() === ExecutionModel.Vertex &&
                    var_.storage === StorageClass.Input && type.array.length === 1) {
                    throw new Error("OpenGL ES doesn't support array input variables in vertex shader.");
                }
                this.emit_interface_block(var_);
                emitted = true;
            }
            else if (this.is_builtin_variable(var_)) {
                const builtin = <BuiltIn>(this.get_decoration(var_.self, Decoration.BuiltIn));
                // For gl_InstanceIndex emulation on GLES, the API user needs to
                // supply this uniform.

                // The draw parameter extension is soft-enabled on GL with some fallbacks.
                // if (!options.vulkan_semantics)
                // {
                if (!emitted_base_instance &&
                    ((options.vertex.support_nonzero_base_instance && builtin === BuiltIn.InstanceIndex) ||
                        (builtin === BuiltIn.BaseInstance))) {
                    this.statement("#ifdef GL_ARB_shader_draw_parameters");
                    this.statement("#define SPIRV_Cross_BaseInstance gl_BaseInstanceARB");
                    this.statement("#else");
                    // A crude, but simple workaround which should be good enough for non-indirect draws.
                    this.statement("uniform int SPIRV_Cross_BaseInstance;");
                    this.statement("#endif");
                    emitted = true;
                    emitted_base_instance = true;
                }
                else if (builtin === BuiltIn.BaseVertex) {
                    this.statement("#ifdef GL_ARB_shader_draw_parameters");
                    this.statement("#define SPIRV_Cross_BaseVertex gl_BaseVertexARB");
                    this.statement("#else");
                    // A crude, but simple workaround which should be good enough for non-indirect draws.
                    this.statement("uniform int SPIRV_Cross_BaseVertex;");
                    this.statement("#endif");
                }
                else if (builtin === BuiltIn.DrawIndex) {
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

            if (var_.storage !== StorageClass.Output) {
                if (!this.variable_is_lut(var_)) {
                    this.add_resource_name(var_.self);

                    let initializer = "";
                    if (options.force_zero_initialized_variables && var_.storage === StorageClass.Private &&
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

    protected emit_extension_workarounds(model: ExecutionModel)
    {
        /*if (!options.vulkan_semantics)
        {
            using Supp = ShaderSubgroupSupportHelper;
            auto result = shader_subgroup_supporter.resolve();

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupMask))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::SubgroupMask, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_shader_thread_group:
                            statement("#define gl_SubgroupEqMask uvec4(gl_ThreadEqMaskNV, 0u, 0u, 0u)");
                            statement("#define gl_SubgroupGeMask uvec4(gl_ThreadGeMaskNV, 0u, 0u, 0u)");
                            statement("#define gl_SubgroupGtMask uvec4(gl_ThreadGtMaskNV, 0u, 0u, 0u)");
                            statement("#define gl_SubgroupLeMask uvec4(gl_ThreadLeMaskNV, 0u, 0u, 0u)");
                            statement("#define gl_SubgroupLtMask uvec4(gl_ThreadLtMaskNV, 0u, 0u, 0u)");
                            break;
                        case Supp::ARB_shader_ballot:
                            statement("#define gl_SubgroupEqMask uvec4(unpackUint2x32(gl_SubGroupEqMaskARB), 0u, 0u)");
                            statement("#define gl_SubgroupGeMask uvec4(unpackUint2x32(gl_SubGroupGeMaskARB), 0u, 0u)");
                            statement("#define gl_SubgroupGtMask uvec4(unpackUint2x32(gl_SubGroupGtMaskARB), 0u, 0u)");
                            statement("#define gl_SubgroupLeMask uvec4(unpackUint2x32(gl_SubGroupLeMaskARB), 0u, 0u)");
                            statement("#define gl_SubgroupLtMask uvec4(unpackUint2x32(gl_SubGroupLtMaskARB), 0u, 0u)");
                            break;
                        default:
                            break;
                    }
                }
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupSize))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::SubgroupSize, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_shader_thread_group:
                            statement("#define gl_SubgroupSize gl_WarpSizeNV");
                            break;
                        case Supp::ARB_shader_ballot:
                            statement("#define gl_SubgroupSize gl_SubGroupSizeARB");
                            break;
                        case Supp::AMD_gcn_shader:
                            statement("#define gl_SubgroupSize uint(gl_SIMDGroupSizeAMD)");
                            break;
                        default:
                            break;
                    }
                }
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupInvocationID))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::SubgroupInvocationID, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_shader_thread_group:
                            statement("#define gl_SubgroupInvocationID gl_ThreadInWarpNV");
                            break;
                        case Supp::ARB_shader_ballot:
                            statement("#define gl_SubgroupInvocationID gl_SubGroupInvocationARB");
                            break;
                        default:
                            break;
                    }
                }
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupID))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::SubgroupID, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_shader_thread_group:
                            statement("#define gl_SubgroupID gl_WarpIDNV");
                            break;
                        default:
                            break;
                    }
                }
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::NumSubgroups))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::NumSubgroups, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_shader_thread_group:
                            statement("#define gl_NumSubgroups gl_WarpsPerSMNV");
                            break;
                        default:
                            break;
                    }
                }
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupBroadcast_First))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::SubgroupBroadcast_First, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_shader_thread_shuffle:
                            for (const char *t : workaround_types)
                        {
                            statement(t, " subgroupBroadcastFirst(", t,
                                " value) { return shuffleNV(value, findLSB(ballotThreadNV(true)), gl_WarpSizeNV); }");
                        }
                            for (const char *t : workaround_types)
                        {
                            statement(t, " subgroupBroadcast(", t,
                                " value, uint id) { return shuffleNV(value, id, gl_WarpSizeNV); }");
                        }
                            break;
                        case Supp::ARB_shader_ballot:
                            for (const char *t : workaround_types)
                        {
                            statement(t, " subgroupBroadcastFirst(", t,
                                " value) { return readFirstInvocationARB(value); }");
                        }
                            for (const char *t : workaround_types)
                        {
                            statement(t, " subgroupBroadcast(", t,
                                " value, uint id) { return readInvocationARB(value, id); }");
                        }
                            break;
                        default:
                            break;
                    }
                }
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupBallotFindLSB_MSB))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::SubgroupBallotFindLSB_MSB, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_shader_thread_group:
                            statement("uint subgroupBallotFindLSB(uvec4 value) { return findLSB(value.x); }");
                            statement("uint subgroupBallotFindMSB(uvec4 value) { return findMSB(value.x); }");
                            break;
                        default:
                            break;
                    }
                }
                statement("#else");
                statement("uint subgroupBallotFindLSB(uvec4 value)");
                begin_scope();
                statement("int firstLive = findLSB(value.x);");
                statement("return uint(firstLive !== -1 ? firstLive : (findLSB(value.y) + 32));");
                end_scope();
                statement("uint subgroupBallotFindMSB(uvec4 value)");
                begin_scope();
                statement("int firstLive = findMSB(value.y);");
                statement("return uint(firstLive !== -1 ? (firstLive + 32) : findMSB(value.x));");
                end_scope();
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupAll_Any_AllEqualBool))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::SubgroupAll_Any_AllEqualBool, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_gpu_shader_5:
                            statement("bool subgroupAll(bool value) { return allThreadsNV(value); }");
                            statement("bool subgroupAny(bool value) { return anyThreadNV(value); }");
                            statement("bool subgroupAllEqual(bool value) { return allThreadsEqualNV(value); }");
                            break;
                        case Supp::ARB_shader_group_vote:
                            statement("bool subgroupAll(bool v) { return allInvocationsARB(v); }");
                            statement("bool subgroupAny(bool v) { return anyInvocationARB(v); }");
                            statement("bool subgroupAllEqual(bool v) { return allInvocationsEqualARB(v); }");
                            break;
                        case Supp::AMD_gcn_shader:
                            statement("bool subgroupAll(bool value) { return ballotAMD(value) === ballotAMD(true); }");
                            statement("bool subgroupAny(bool value) { return ballotAMD(value) !== 0ull; }");
                            statement("bool subgroupAllEqual(bool value) { uint64_t b = ballotAMD(value); return b === 0ull || "
                            "b === ballotAMD(true); }");
                            break;
                        default:
                            break;
                    }
                }
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupAllEqualT))
            {
                statement("#ifndef GL_KHR_shader_subgroup_vote");
                statement(
                    "#define _SPIRV_CROSS_SUBGROUP_ALL_EQUAL_WORKAROUND(type) bool subgroupAllEqual(type value) { return "
                "subgroupAllEqual(subgroupBroadcastFirst(value) === value); }");
                for (const char *t : workaround_types)
                statement("_SPIRV_CROSS_SUBGROUP_ALL_EQUAL_WORKAROUND(", t, ")");
                statement("#undef _SPIRV_CROSS_SUBGROUP_ALL_EQUAL_WORKAROUND");
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupBallot))
            {
                auto exts = Supp::get_candidates_for_feature(Supp::SubgroupBallot, result);

                for (auto &e : exts)
                {
                    const char *name = Supp::get_extension_name(e);
                    statement(&e === &exts.front() ? "#if" : "#elif", " defined(", name, ")");

                    switch (e)
                    {
                        case Supp::NV_shader_thread_group:
                            statement("uvec4 subgroupBallot(bool v) { return uvec4(ballotThreadNV(v), 0u, 0u, 0u); }");
                            break;
                        case Supp::ARB_shader_ballot:
                            statement("uvec4 subgroupBallot(bool v) { return uvec4(unpackUint2x32(ballotARB(v)), 0u, 0u); }");
                            break;
                        default:
                            break;
                    }
                }
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupElect))
            {
                statement("#ifndef GL_KHR_shader_subgroup_basic");
                statement("bool subgroupElect()");
                begin_scope();
                statement("uvec4 activeMask = subgroupBallot(true);");
                statement("uint firstLive = subgroupBallotFindLSB(activeMask);");
                statement("return gl_SubgroupInvocationID === firstLive;");
                end_scope();
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupBarrier))
            {
                // Extensions we're using in place of GL_KHR_shader_subgroup_basic state
                // that subgroup execute in lockstep so this barrier is implicit.
                // However the GL 4.6 spec also states that `barrier` implies a shared memory barrier,
                // and a specific test of optimizing scans by leveraging lock-step invocation execution,
                // has shown that a `memoryBarrierShared` is needed in place of a `subgroupBarrier`.
                // https://github.com/buildaworldnet/IrrlichtBAW/commit/d8536857991b89a30a6b65d29441e51b64c2c7ad#diff-9f898d27be1ea6fc79b03d9b361e299334c1a347b6e4dc344ee66110c6aa596aR19
                statement("#ifndef GL_KHR_shader_subgroup_basic");
                statement("void subgroupBarrier() { memoryBarrierShared(); }");
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupMemBarrier))
            {
                if (model === spv::ExecutionModelGLCompute)
                {
                    statement("#ifndef GL_KHR_shader_subgroup_basic");
                    statement("void subgroupMemoryBarrier() { groupMemoryBarrier(); }");
                    statement("void subgroupMemoryBarrierBuffer() { groupMemoryBarrier(); }");
                    statement("void subgroupMemoryBarrierShared() { memoryBarrierShared(); }");
                    statement("void subgroupMemoryBarrierImage() { groupMemoryBarrier(); }");
                    statement("#endif");
                }
                else
                {
                    statement("#ifndef GL_KHR_shader_subgroup_basic");
                    statement("void subgroupMemoryBarrier() { memoryBarrier(); }");
                    statement("void subgroupMemoryBarrierBuffer() { memoryBarrierBuffer(); }");
                    statement("void subgroupMemoryBarrierImage() { memoryBarrierImage(); }");
                    statement("#endif");
                }
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupInverseBallot_InclBitCount_ExclBitCout))
            {
                statement("#ifndef GL_KHR_shader_subgroup_ballot");
                statement("bool subgroupInverseBallot(uvec4 value)");
                begin_scope();
                statement("return any(notEqual(value.xy & gl_SubgroupEqMask.xy, uvec2(0u)));");
                end_scope();

                statement("uint subgroupBallotInclusiveBitCount(uvec4 value)");
                begin_scope();
                statement("uvec2 v = value.xy & gl_SubgroupLeMask.xy;");
                statement("ivec2 c = bitCount(v);");
                statement_no_indent("#ifdef GL_NV_shader_thread_group");
                statement("return uint(c.x);");
                statement_no_indent("#else");
                statement("return uint(c.x + c.y);");
                statement_no_indent("#endif");
                end_scope();

                statement("uint subgroupBallotExclusiveBitCount(uvec4 value)");
                begin_scope();
                statement("uvec2 v = value.xy & gl_SubgroupLtMask.xy;");
                statement("ivec2 c = bitCount(v);");
                statement_no_indent("#ifdef GL_NV_shader_thread_group");
                statement("return uint(c.x);");
                statement_no_indent("#else");
                statement("return uint(c.x + c.y);");
                statement_no_indent("#endif");
                end_scope();
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupBallotBitCount))
            {
                statement("#ifndef GL_KHR_shader_subgroup_ballot");
                statement("uint subgroupBallotBitCount(uvec4 value)");
                begin_scope();
                statement("ivec2 c = bitCount(value.xy);");
                statement_no_indent("#ifdef GL_NV_shader_thread_group");
                statement("return uint(c.x);");
                statement_no_indent("#else");
                statement("return uint(c.x + c.y);");
                statement_no_indent("#endif");
                end_scope();
                statement("#endif");
                statement("");
            }

            if (shader_subgroup_supporter.is_feature_requested(Supp::SubgroupBallotBitExtract))
            {
                statement("#ifndef GL_KHR_shader_subgroup_ballot");
                statement("bool subgroupBallotBitExtract(uvec4 value, uint index)");
                begin_scope();
                statement_no_indent("#ifdef GL_NV_shader_thread_group");
                statement("uint shifted = value.x >> index;");
                statement_no_indent("#else");
                statement("uint shifted = value[index >> 5u] >> (index & 0x1fu);");
                statement_no_indent("#endif");
                statement("return (shifted & 1u) !== 0u;");
                end_scope();
                statement("#endif");
                statement("");
            }
        }*/

        if (this.workaround_ubo_load_overload_types.length) {
            for (let type_id of this.workaround_ubo_load_overload_types) {
                const type = this.get<SPIRType>(SPIRType, type_id);
                this.statement(this.type_to_glsl(type), " spvWorkaroundRowMajor(", this.type_to_glsl(type),
                    " wrap) { return wrap; }");
            }
            this.statement("");
        }

        if (this.requires_transpose_2x2) {
            this.statement("mat2 spvTranspose(mat2 m)");
            this.begin_scope();
            this.statement("return mat2(m[0][0], m[1][0], m[0][1], m[1][1]);");
            this.end_scope();
            this.statement("");
        }

        if (this.requires_transpose_3x3) {
            this.statement("mat3 spvTranspose(mat3 m)");
            this.begin_scope();
            this.statement("return mat3(m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]);");
            this.end_scope();
            this.statement("");
        }

        if (this.requires_transpose_4x4) {
            this.statement("mat4 spvTranspose(mat4 m)");
            this.begin_scope();
            this.statement("return mat4(m[0][0], m[1][0], m[2][0], m[3][0], m[0][1], m[1][1], m[2][1], m[3][1], m[0][2], m[1][2], m[2][2], m[3][2], m[0][3], m[1][3], m[2][3], m[3][3]);");
            this.end_scope();
            this.statement("");
        }
    }

    protected emit_buffer_block_global(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const ir = this.ir;
        const meta = maplike_get(Meta, ir.meta, type.self);
        const ssbo = var_.storage === StorageClass.StorageBuffer ||
            meta.decoration.decoration_flags.get(Decoration.BufferBlock);

        if (ssbo)
            throw new Error("SSBOs not supported in legacy targets.");

        const ubo_members: string[] = []

        let i = 0;
        for (let member of type.member_types) {
            const membertype = this.get<SPIRType>(SPIRType, member);
            const membername = this.to_member_name(type, i);

            ubo_members.push(membername + this.type_to_array_glsl(membertype));
            this.statement("uniform ", this.variable_decl(membertype, membername), ";");
            i++;
        }

        this.unnamed_ubo_info[this.to_name(type.self)] = ubo_members;

        this.statement("");
    }

    protected emit_buffer_block_native(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);

        const { ir, options } = this;
        const flags = ir.get_buffer_block_flags(var_);
        const dec = maplike_get(Meta, ir.meta, type.self).decoration;
        const ssbo = var_.storage === StorageClass.StorageBuffer || var_.storage === StorageClass.ShaderRecordBufferKHR ||
            dec.decoration_flags.get(Decoration.BufferBlock);
        const is_restrict = ssbo && flags.get(Decoration.Restrict);
        const is_writeonly = ssbo && flags.get(Decoration.NonReadable);
        const is_readonly = ssbo && flags.get(Decoration.NonWritable);
        const is_coherent = ssbo && flags.get(Decoration.Coherent);

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
        let name = "";
        if (ir.get_name(var_.self) === "" && options.keep_unnamed_ubos) {
            this.removed_structs.add(var_.self);
        }
        else
            name = this.to_name(var_.self) + this.type_to_array_glsl(type);

        this.end_scope_decl(name);
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
            maplike_get(Meta, ir.meta, type.self).decoration.alias = buffer_name;
        }
        else if (type.basetype !== SPIRBaseType.Struct)
            buffer_name = this.type_to_glsl(type);
        else
            buffer_name = this.to_name(type.self, false);

        if (!forward_declaration) {
            const itr_second = this.physical_storage_type_to_alignment[type_id];
            let alignment = 0;
            if (itr_second)
                alignment = itr_second.alignment;

            if (type.basetype === SPIRBaseType.Struct) {
                const attributes: string[] = [ "buffer_reference" ];
                if (alignment)
                    attributes.push("buffer_reference_align = " + alignment);
                attributes.push(this.buffer_to_packing_standard(type, true));

                const flags = ir.get_buffer_block_type_flags(type);
                let decorations = "";
                if (flags.get(Decoration.Restrict))
                    decorations += " restrict";
                if (flags.get(Decoration.Coherent))
                    decorations += " coherent";
                if (flags.get(Decoration.NonReadable))
                    decorations += " writeonly";
                if (flags.get(Decoration.NonWritable))
                    decorations += " readonly";

                this.statement("layout(", attributes.join(", "), ")", decorations, " buffer ", buffer_name);
            }
            else if (alignment)
                this.statement("layout(buffer_reference, buffer_reference_align = ", alignment, ") buffer ", buffer_name);
            else
                this.statement("layout(buffer_reference) buffer ", buffer_name);

            this.begin_scope();

            if (type.basetype === SPIRBaseType.Struct) {
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

        const { ir } = this;

        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            const block = this.has_decoration(type.self, Decoration.Block);
            const builtins = new Bitset();

            if (var_.storage === storage && block && this.is_builtin_variable(var_)) {
                let index = 0;
                for (let m of maplike_get(Meta, ir.meta, type.self).members) {
                    if (m.builtin) {
                        builtins.set(m.builtin_type);
                        if (m.builtin_type === BuiltIn.CullDistance)
                            cull_distance_size = this.to_array_size_literal(this.get<SPIRType>(SPIRType, type.member_types[index]));
                        else if (m.builtin_type === BuiltIn.ClipDistance)
                            clip_distance_size = this.to_array_size_literal(this.get<SPIRType>(SPIRType, type.member_types[index]));

                        if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.Offset)) {
                            have_any_xfb_offset = true;
                            builtin_xfb_offsets[m.builtin_type] = m.offset;
                        }

                        if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.Stream)) {
                            const stream = m.stream;
                            if (have_geom_stream && geom_stream !== stream)
                                throw new Error("IO block member Stream mismatch.");
                            have_geom_stream = true;
                            geom_stream = stream;
                        }
                    }
                    index++;
                }

                if (storage === StorageClass.Output && this.has_decoration(var_.self, Decoration.XfbBuffer) &&
                    this.has_decoration(var_.self, Decoration.XfbStride)) {
                    const buffer_index = this.get_decoration(var_.self, Decoration.XfbBuffer);
                    const stride = this.get_decoration(var_.self, Decoration.XfbStride);
                    if (have_xfb_buffer_stride && buffer_index !== xfb_buffer)
                        throw new Error("IO block member XfbBuffer mismatch.");
                    if (have_xfb_buffer_stride && stride !== xfb_stride)
                        throw new Error("IO block member XfbBuffer mismatch.");
                    have_xfb_buffer_stride = true;
                    xfb_buffer = buffer_index;
                    xfb_stride = stride;
                }

                if (storage === StorageClass.Output && this.has_decoration(var_.self, Decoration.Stream)) {
                    const stream = this.get_decoration(var_.self, Decoration.Stream);
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
                    if (m.builtin_type === BuiltIn.CullDistance)
                        cull_distance_size = this.to_array_size_literal(type);
                    else if (m.builtin_type === BuiltIn.ClipDistance)
                        clip_distance_size = this.to_array_size_literal(type);

                    if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.XfbStride) &&
                        m.decoration_flags.get(Decoration.XfbBuffer) && m.decoration_flags.get(Decoration.Offset)) {
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

                    if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.Stream)) {
                        const stream = this.get_decoration(var_.self, Decoration.Stream);
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
        global_builtins.set(BuiltIn.Position);
        global_builtins.set(BuiltIn.PointSize);
        global_builtins.set(BuiltIn.ClipDistance);
        global_builtins.set(BuiltIn.CullDistance);

        // Try to collect all other declared builtins.
        if (!emitted_block)
            emitted_builtins = global_builtins;

        // Can't declare an empty interface block.
        if (emitted_builtins.empty())
            return;

        if (storage === StorageClass.Output) {
            // const attr: string[] = [];
            if (have_xfb_buffer_stride && have_any_xfb_offset) {
                /*if (!options.es) {
                    if (options.version < 440 && options.version >= 140)
                        this.require_extension_internal("GL_ARB_enhanced_layouts");
                    else if (options.version < 140)
                        throw new Error("Component decoration is not supported in targets below GLSL 1.40.");
                    if (!options.es && options.version < 440)
                        this.require_extension_internal("GL_ARB_enhanced_layouts");
                }
                else if (options.es)*/
                    throw new Error("Need GL_ARB_enhanced_layouts for xfb_stride or xfb_buffer.");
                // attr.push(`xfb_buffer = ${xfb_buffer}, xfb_stride = ${xfb_stride}`);
            }

            if (have_geom_stream) {
                /*if (this.get_execution_model() !== ExecutionModel.Geometry)
                    throw new Error("Geometry streams can only be used in geometry shaders.");*/
                // if (options.es)
                    throw new Error("Multiple geometry streams not supported in ESSL.");
                /*if (options.version < 400)
                    this.require_extension_internal("GL_ARB_transform_feedback3");
                attr.push("stream = " + geom_stream);*/
            }

            // if (attr.length > 0)
            //     this.statement("layout(", attr.join(", "), ") out gl_PerVertex");
            // else
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
        if (emitted_builtins.get(BuiltIn.Position)) {
            const itr_second = builtin_xfb_offsets[BuiltIn.Position];
            if (itr_second)
                this.statement("layout(xfb_offset = ", itr_second, ") vec4 gl_Position;");
            else
                this.statement("vec4 gl_Position;");
        }

        if (emitted_builtins.get(BuiltIn.PointSize)) {
            const itr_second = builtin_xfb_offsets.find[BuiltIn.PointSize];
            if (itr_second)
                this.statement("layout(xfb_offset = ", itr_second, ") float gl_PointSize;");
            else
                this.statement("float gl_PointSize;");
        }

        if (emitted_builtins.get(BuiltIn.ClipDistance)) {
            const itr_second = builtin_xfb_offsets[BuiltIn.ClipDistance];
            if (itr_second)
                this.statement("layout(xfb_offset = ", itr_second, ") float gl_ClipDistance[", clip_distance_size, "];");
            else
                this.statement("float gl_ClipDistance[", clip_distance_size, "];");
        }

        if (emitted_builtins.get(BuiltIn.CullDistance)) {
            const itr_second = builtin_xfb_offsets[BuiltIn.CullDistance];
            if (itr_second)
                this.statement("layout(xfb_offset = ", itr_second, ") float gl_CullDistance[", cull_distance_size, "];");
            else
                this.statement("float gl_CullDistance[", cull_distance_size, "];");
        }

        if (builtin_array) {
            /*if (model === ExecutionModelTessellationControl && storage === StorageClassOutput)
                this.end_scope_decl(join(to_name(block_var_.self), "[", get_entry_point().output_vertices, "]"));
            else
                this.end_scope_decl(join(to_name(block_var_.self), "[]"));*/
        }
        else
            this.end_scope_decl();

        this.statement("");
    }

    protected should_force_emit_builtin_block(storage: StorageClass)
    {
// If the builtin block uses XFB, we need to force explicit redeclaration of the builtin block.

        if (storage !== StorageClass.Output)
            return false;

        let should_force = false;

        const { ir } = this;
        ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (_, var_) =>
        {
            if (should_force)
                return;

            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            const block = this.has_decoration(type.self, Decoration.Block);
            if (var_.storage === storage && block && this.is_builtin_variable(var_)) {
                const member_count = type.member_types.length;
                for (let i = 0; i < member_count; i++) {
                    if (this.has_member_decoration(type.self, i, Decoration.BuiltIn) &&
                        is_block_builtin(<BuiltIn>(this.get_member_decoration(type.self, i, Decoration.BuiltIn))) &&
                        this.has_member_decoration(type.self, i, Decoration.Offset)) {
                        should_force = true;
                    }
                }
            }
            else if (var_.storage === storage && !block && this.is_builtin_variable(var_)) {
                if (is_block_builtin(<BuiltIn>(this.get_decoration(type.self, Decoration.BuiltIn))) &&
                    this.has_decoration(var_.self, Decoration.Offset)) {
                    should_force = true;
                }
            }
        });

        // If we're declaring clip/cull planes with control points we need to force block declaration.
        /*if (this.get_execution_model() === ExecutionModel.TessellationControl &&
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
        flags.clear(Decoration.Binding);
        flags.clear(Decoration.DescriptorSet);

        /*#if 0
        if (flags & ((1ull << DecorationBinding) | (1ull << DecorationDescriptorSet)))
        throw new Error("Push constant blocks cannot be compiled to GLSL with Binding or Set syntax. "
        "Remap to location with reflection API first or disable these decorations.");
        #endif
        */
        // We're emitting the push constant block as a regular struct, so disable the block qualifier temporarily.
        // Otherwise, we will end up emitting layout() qualifiers on naked structs which is not allowed.
        const block_flags = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags;
        const block_flag = block_flags.get(Decoration.Block);
        block_flags.clear(Decoration.Block);

        this.emit_struct(type);

        if (block_flag)
            block_flags.set(Decoration.Block);

        this.emit_uniform(var_);
        this.statement("");
    }

    protected emit_interface_block(var_: SPIRVariable)
    {
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const { ir } = this;
        /*if (var_.storage === StorageClass.Input && type.basetype === SPIRBaseType.Double &&
            !options.es && options.version < 410) {
            this.require_extension_internal("GL_ARB_vertex_attrib_64bit");
        }*/

        // Either make it plain in/out or in/out blocks depending on what shader is doing ...
        const block = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags.get(Decoration.Block);
        const qual = this.to_storage_qualifiers_glsl(var_);

        if (block) {
            // ESSL earlier than 310 and GLSL earlier than 150 did not support
            // I/O variables which are struct types.
            // To support this, flatten the struct into separate varyings instead.
            /*if (options.force_flattened_io_blocks || (options.es && options.version < 310) ||
                (!options.es && options.version < 150)) {*/
                // I/O blocks on ES require version 310 with Android Extension Pack extensions, or core version 320.
                // On desktop, I/O blocks were introduced with geometry shaders in GL 3.2 (GLSL 150).
                this.emit_flattened_io_block(var_, qual);
            /*}
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
                const block_namespace = type.storage === StorageClass.Input ? this.block_input_names : this.block_output_names;

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

                const is_patch = this.has_decoration(var_.self, Decoration.Patch);
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
            }*/
        }
        else {
            // ESSL earlier than 310 and GLSL earlier than 150 did not support
            // I/O variables which are struct types.
            // To support this, flatten the struct into separate varyings instead.
            if (type.basetype === SPIRBaseType.Struct /*&&
                (options.force_flattened_io_blocks || (options.es && options.version < 310) ||
                    (!options.es && options.version < 150))*/) {
                this.emit_flattened_io_block(var_, qual);
            }
            else {
                this.add_resource_name(var_.self);

                // Tessellation control and evaluation shaders must have either gl_MaxPatchVertices or unsized arrays for input arrays.
                // Opt for unsized as it's the more "correct" variant to use.
                /*const control_point_input_array = type.storage === StorageClass.Input && type.array.length > 0 &&
                    !this.has_decoration(var_.self, Decoration.Patch) &&
                    (this.get_entry_point().model === ExecutionModel.TessellationControl ||
                    this.get_entry_point().model === ExecutionModel.TessellationEvaluation);*/

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
        return this.options.specialization_constant_prefix + id;
    }

    protected get_constant_mapping_to_workgroup_component(c: SPIRConstant)
    {
        const entry_point = this.get_entry_point();
        let index = -1;

        // Need to redirect specialization constants which are used as WorkGroupSize to the builtin,
        // since the spec constant declarations are never explicitly declared.
        if (entry_point.workgroup_size.constant === 0 && entry_point.flags.get(ExecutionMode.LocalSizeId)) {
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
        const wg_x = new SpecializationConstant();
        const wg_y = new SpecializationConstant();
        const wg_z = new SpecializationConstant();

        const workgroup_size_id = this.get_work_group_size_specialization_constants(wg_x, wg_y, wg_z);

        // This specialization constant is implicitly declared by emitting layout() in;
        if (constant.self === workgroup_size_id)
            return;

        // These specialization constants are implicitly declared by emitting layout() in;
        // In legacy GLSL, we will still need to emit macros for these, so a layout() in; declaration
        // later can use macro overrides for work group size.
        const is_workgroup_size_constant = constant.self === wg_x.id || constant.self === wg_y.id || constant.self === wg_z.id;

        /*if (options.vulkan_semantics && is_workgroup_size_constant)
        {
            // Vulkan GLSL does not need to declare workgroup spec constants explicitly, it is handled in layout().
            return;
        }
        else*/ if (/*!options.vulkan_semantics &&*/ is_workgroup_size_constant &&
            !this.has_decoration(constant.self, Decoration.SpecId))
        {
            // Only bother declaring a workgroup size if it is actually a specialization constant, because we need macros.
            return;
        }

        // Only scalars have constant IDs.
        if (this.has_decoration(constant.self, Decoration.SpecId)) {
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
            if (!is_workgroup_size_constant)
                this.statement("const ", this.variable_decl(type, name), " = ", macro_name, ";");
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

    protected emit_continue_block(continue_block: number, follow_true_block: boolean, follow_false_block: boolean): string
    {
        let block = this.get<SPIRBlock>(SPIRBlock, continue_block);

        // While emitting the continue block, declare_temporary will check this
        // if we have to emit temporaries.
        this.current_continue_block = block;

        const statements: string[] = [];

        // Capture all statements into our list.
        const old = this.redirect_statement;
        this.redirect_statement = statements;

        const { ir } = this;

        // Stamp out all blocks one after each other.
        while ((maplike_get(0, ir.block_meta, block.self) & BlockMetaFlagBits.LOOP_HEADER_BIT) === 0) {
            // Write out all instructions we have in this block.
            this.emit_block_instructions(block);

            // For plain branchless for/while continue blocks.
            if (block.next_block) {
                this.flush_phi(continue_block, block.next_block);
                block = this.get<SPIRBlock>(SPIRBlock, block.next_block);
            }
            // For do while blocks. The last block will be a select block.
            else if (block.true_block && follow_true_block) {
                this.flush_phi(continue_block, block.true_block);
                block = this.get<SPIRBlock>(SPIRBlock, block.true_block);
            }
            else if (block.false_block && follow_false_block) {
                this.flush_phi(continue_block, block.false_block);
                block = this.get<SPIRBlock>(SPIRBlock, block.false_block);
            }
            else {
                throw new Error("Invalid continue block detected!");
            }
        }

        // Restore old pointer.
        this.redirect_statement = old;

        // Somewhat ugly, strip off the last ';' since we use ',' instead.
        // Ideally, we should select this behavior in statement().
        for (let i = 0; i < statements.length; ++i) {
            const s = statements[i];
            if (s !== "" && s.charAt(s.length - 1) === ";")
                statements[i] = s.substring(0, s.length - 1);
        }

        this.current_continue_block = null;
        return statements.join(", ");
    }

    protected attempt_emit_loop_header(block: SPIRBlock, method: SPIRBlockMethod): boolean
    {
        const continue_type = this.continue_block_type(this.get<SPIRBlock>(SPIRBlock, block.continue_block));

        if (method === SPIRBlockMethod.MergeToSelectForLoop || method === SPIRBlockMethod.MergeToSelectContinueForLoop) {
            const current_count = this.statement_count;
            // If we're trying to create a true for loop,
            // we need to make sure that all opcodes before branch statement do not actually emit any code.
            // We can then take the condition expression and create a for (; cond ; ) { body; } structure instead.
            this.emit_block_instructions(block);

            const condition_is_temporary = !this.forced_temporaries.has(block.condition);

            // This can work! We only did trivial things which could be forwarded in block body!
            if (current_count === this.statement_count && condition_is_temporary) {
                switch (continue_type) {
                    case SPIRBlockContinueBlockType.ForLoop: {
                        // This block may be a dominating block, so make sure we flush undeclared variables before building the for loop header.
                        this.flush_undeclared_variables(block);

                        // Important that we do this in this order because
                        // emitting the continue block can invalidate the condition expression.
                        const initializer = this.emit_for_loop_initializers(block);
                        let condition = this.to_expression(block.condition);

                        // Condition might have to be inverted.
                        if (this.execution_is_noop(this.get<SPIRBlock>(SPIRBlock, block.true_block), this.get<SPIRBlock>(SPIRBlock, block.merge_block)))
                            condition = "!" + this.enclose_expression(condition);

                        this.emit_block_hints(block);
                        if (method !== SPIRBlockMethod.MergeToSelectContinueForLoop) {
                            const continue_block = this.emit_continue_block(block.continue_block, false, false);
                            this.statement("for (", initializer, "; ", condition, "; ", continue_block, ")");
                        }
                        else
                            this.statement("for (", initializer, "; ", condition, "; )");
                        break;
                    }

                    case SPIRBlockContinueBlockType.WhileLoop: {
                        // This block may be a dominating block, so make sure we flush undeclared variables before building the while loop header.
                        this.flush_undeclared_variables(block);
                        this.emit_while_loop_initializers(block);
                        this.emit_block_hints(block);

                        let condition = this.to_expression(block.condition);
                        // Condition might have to be inverted.
                        if (this.execution_is_noop(this.get<SPIRBlock>(SPIRBlock, block.true_block), this.get<SPIRBlock>(SPIRBlock, block.merge_block)))
                            condition = "!" + this.enclose_expression(condition);

                        this.statement("while (", condition, ")");
                        break;
                    }

                    default:
                        block.disable_block_optimization = true;
                        this.force_recompile();
                        this.begin_scope(); // We'll see an end_scope() later.
                        return false;
                }

                this.begin_scope();
                return true;
            }
            else {
                block.disable_block_optimization = true;
                this.force_recompile();
                this.begin_scope(); // We'll see an end_scope() later.
                return false;
            }
        }
        else if (method === SPIRBlockMethod.MergeToDirectForLoop) {
            const child = this.get<SPIRBlock>(SPIRBlock, block.next_block);

            // This block may be a dominating block, so make sure we flush undeclared variables before building the for loop header.
            this.flush_undeclared_variables(child);

            const current_count = this.statement_count;

            // If we're trying to create a true for loop,
            // we need to make sure that all opcodes before branch statement do not actually emit any code.
            // We can then take the condition expression and create a for (; cond ; ) { body; } structure instead.
            this.emit_block_instructions(child);

            const condition_is_temporary = !this.forced_temporaries.has(child.condition);

            // console.log(this.buffer.str());

            if (current_count === this.statement_count && condition_is_temporary) {
                let target_block = child.true_block;

                switch (continue_type) {
                    case SPIRBlockContinueBlockType.ForLoop: {
                        // Important that we do this in this order because
                        // emitting the continue block can invalidate the condition expression.
                        const initializer = this.emit_for_loop_initializers(block);

                        let condition = this.to_expression(child.condition);

                        // Condition might have to be inverted.
                        if (this.execution_is_noop(this.get<SPIRBlock>(SPIRBlock, child.true_block), this.get<SPIRBlock>(SPIRBlock, block.merge_block))) {
                            condition = "!" + this.enclose_expression(condition);
                            target_block = child.false_block;
                        }

                        const continue_block = this.emit_continue_block(block.continue_block, false, false);
                        this.emit_block_hints(block);
                        this.statement("for (", initializer, "; ", condition, "; ", continue_block, ")");
                        break;
                    }

                    case SPIRBlockContinueBlockType.WhileLoop: {
                        this.emit_while_loop_initializers(block);
                        this.emit_block_hints(block);

                        let condition = this.to_expression(child.condition);
                        // Condition might have to be inverted.
                        if (this.execution_is_noop(this.get<SPIRBlock>(SPIRBlock, child.true_block), this.get<SPIRBlock>(SPIRBlock, block.merge_block))) {
                            condition = "!" + this.enclose_expression(condition);
                            target_block = child.false_block;
                        }

                        this.statement("while (", condition, ")");
                        break;
                    }

                    default:
                        block.disable_block_optimization = true;
                        this.force_recompile();
                        this.begin_scope(); // We'll see an end_scope() later.
                        return false;
                }

                this.begin_scope();
                this.branch(child.self, target_block);
                return true;
            }
            else {
                block.disable_block_optimization = true;
                this.force_recompile();
                this.begin_scope(); // We'll see an end_scope() later.
                return false;
            }
        }
        else
            return false;
    }

    protected branch_to_continue(from: BlockID, to: BlockID)
    {
        const to_block = this.get<SPIRBlock>(SPIRBlock, to);
        if (from === to)
            return;

        console.assert(this.is_continue(to));
        if (to_block.complex_continue) {
            // Just emit the whole block chain as is.
            const usage_counts = this.expression_usage_counts.concat();

            this.emit_block_chain(to_block);

            // Expression usage counts are moot after returning from the continue block.
            this.expression_usage_counts = usage_counts;
        }
        else {
            const from_block = this.get<SPIRBlock>(SPIRBlock, from);
            let outside_control_flow = false;
            let loop_dominator = 0;

            // FIXME: Refactor this to not use the old loop_dominator tracking.
            if (from_block.merge_block) {
                // If we are a loop header, we don't set the loop dominator,
                // so just use "self" here.
                loop_dominator = from;
            }
            else if (from_block.loop_dominator !== <BlockID>(SPIRBlock.NoDominator)) {
                loop_dominator = from_block.loop_dominator;
            }

            if (loop_dominator !== 0) {
                const cfg = this.get_cfg_for_current_function();

                // For non-complex continue blocks, we implicitly branch to the continue block
                // by having the continue block be part of the loop header in for (; ; continue-block).
                outside_control_flow = cfg.node_terminates_control_flow_in_sub_graph(loop_dominator, from);
            }

            // Some simplification for for-loops. We always end up with a useless continue;
            // statement since we branch to a loop block.
            // Walk the CFG, if we unconditionally execute the block calling continue assuming we're in the loop block,
            // we can avoid writing out an explicit continue statement.
            // Similar optimization to return statements if we know we're outside flow control.
            if (!outside_control_flow)
                this.statement("continue;");
        }
    }

    protected branch(from: BlockID, to: BlockID);
    protected branch(from: BlockID, cond: number, true_block: BlockID, false_block: BlockID);

    protected branch(from: BlockID, cond: number | BlockID, true_block?: BlockID, false_block?: BlockID)
    {
        if (true_block === undefined) {
            this._branch(from, cond);
        }
        else {
            this._branchTrueFalse(from, cond, true_block, false_block);
        }
    }

    protected _branch(from: BlockID, to: BlockID)
    {
        this.flush_phi(from, to);
        this.flush_control_dependent_expressions(from);

        const to_is_continue = this.is_continue(to);

        const { ir } = this;

        // This is only a continue if we branch to our loop dominator.
        if ((ir.block_meta[to] & BlockMetaFlagBits.LOOP_HEADER_BIT) !== 0 && this.get<SPIRBlock>(SPIRBlock, from).loop_dominator === to) {
            // This can happen if we had a complex continue block which was emitted.
            // Once the continue block tries to branch to the loop header, just emit continue;
            // and end the chain here.
            this.statement("continue;");
        }
        else if (from !== to && this.is_break(to)) {
            // We cannot break to ourselves, so check explicitly for from !== to.
            // This case can trigger if a loop header is all three of these things:
            // - Continue block
            // - Loop header
            // - Break merge target all at once ...

            // Very dirty workaround.
            // Switch constructs are able to break, but they cannot break out of a loop at the same time.
            // Only sensible solution is to make a ladder variable, which we declare at the top of the switch block,
            // write to the ladder here, and defer the break.
            // The loop we're breaking out of must dominate the switch block, or there is no ladder breaking case.
            if (this.current_emitting_switch && this.is_loop_break(to) &&
                this.current_emitting_switch.loop_dominator !== <BlockID>(SPIRBlock.NoDominator) &&
                this.get<SPIRBlock>(SPIRBlock, this.current_emitting_switch.loop_dominator).merge_block === to) {
                if (!this.current_emitting_switch.need_ladder_break) {
                    this.force_recompile();
                    this.current_emitting_switch.need_ladder_break = true;
                }

                this.statement("_", this.current_emitting_switch.self, "_ladder_break = true;");
            }
            this.statement("break;");
        }
        else if (to_is_continue || from === to) {
            // For from === to case can happen for a do-while loop which branches into itself.
            // We don't mark these cases as continue blocks, but the only possible way to branch into
            // ourselves is through means of continue blocks.

            // If we are merging to a continue block, there is no need to emit the block chain for continue here.
            // We can branch to the continue block after we merge execution.

            // Here we make use of structured control flow rules from spec:
            // 2.11: - the merge block declared by a header block cannot be a merge block declared by any other header block
            //       - each header block must strictly dominate its merge block, unless the merge block is unreachable in the CFG
            // If we are branching to a merge block, we must be inside a construct which dominates the merge block.
            const block_meta = maplike_get(0, ir.block_meta, to);
            const branching_to_merge =
                (block_meta & (BlockMetaFlagBits.SELECTION_MERGE_BIT | BlockMetaFlagBits.MULTISELECT_MERGE_BIT |
                    BlockMetaFlagBits.LOOP_MERGE_BIT)) !== 0;
            if (!to_is_continue || !branching_to_merge)
                this.branch_to_continue(from, to);
        }
        else if (!this.is_conditional(to))
            this.emit_block_chain(this.get<SPIRBlock>(SPIRBlock, to));

        // It is important that we check for break before continue.
        // A block might serve two purposes, a break block for the inner scope, and
        // a continue block in the outer scope.
        // Inner scope always takes precedence.
    }

    protected _branchTrueFalse(from: BlockID, cond: number, true_block: BlockID, false_block: BlockID)
    {
        const from_block = this.get<SPIRBlock>(SPIRBlock, from);
        const merge_block = from_block.merge === SPIRBlockMerge.Selection ? from_block.next_block : <BlockID>(0);

        // If we branch directly to our selection merge target, we don't need a code path.
        const true_block_needs_code = true_block !== merge_block || this.flush_phi_required(from, true_block);
        const false_block_needs_code = false_block !== merge_block || this.flush_phi_required(from, false_block);

        if (!true_block_needs_code && !false_block_needs_code)
            return;

        // We might have a loop merge here. Only consider selection flattening constructs.
        // Loop hints are handled explicitly elsewhere.
        if (from_block.hint === SPIRBlockHints.Flatten || from_block.hint === SPIRBlockHints.DontFlatten)
            this.emit_block_hints(from_block);

        if (true_block_needs_code) {
            this.statement("if (", this.to_expression(cond), ")");
            this.begin_scope();
            this.branch(from, true_block);
            this.end_scope();

            if (false_block_needs_code) {
                this.statement("else");
                this.begin_scope();
                this.branch(from, false_block);
                this.end_scope();
            }
        }
        else if (false_block_needs_code) {
            // Only need false path, use negative conditional.
            this.statement("if (!", this.to_enclosed_expression(cond), ")");
            this.begin_scope();
            this.branch(from, false_block);
            this.end_scope();
        }
    }

    protected flush_phi(from: BlockID, to: BlockID)
    {
        const child = this.get<SPIRBlock>(SPIRBlock, to);
        if (child.ignore_phi_from_block === from)
            return;

        const temporary_phi_variables: Set<number> = new Set();

        for (let itr = 0; itr < child.phi_variables.length; ++itr) {
            const phi = child.phi_variables[itr];

            if (phi.parent === from) {
                const var_ = this.get<SPIRVariable>(SPIRVariable, phi.function_variable);

                // A Phi variable might be a loop variable, so flush to static expression.
                if (var_.loop_variable && !var_.loop_variable_enable)
                    var_.static_expression = phi.local_variable;
                else {
                    this.flush_variable_declaration(phi.function_variable);

                    // Check if we are going to write to a Phi variable that another statement will read from
                    // as part of another Phi node in our target block.
                    // For this case, we will need to copy phi.function_variable to a temporary, and use that for future reads.
                    // This is judged to be extremely rare, so deal with it here using a simple, but suboptimal algorithm.
                    let need_saved_temporary = false;
                    for (let i = itr + 1; i < child.phi_variables.length; ++i) {
                        const future_phi = child.phi_variables[i];
                        if (future_phi.local_variable === <ID>(phi.function_variable) && future_phi.parent === from) {
                            need_saved_temporary = true;
                            break;
                        }
                    }


                    if (need_saved_temporary) {
                        // Need to make sure we declare the phi variable with a copy at the right scope.
                        // We cannot safely declare a temporary here since we might be inside a continue block.
                        if (!var_.allocate_temporary_copy) {
                            var_.allocate_temporary_copy = true;
                            this.force_recompile();
                        }
                        this.statement("_", phi.function_variable, "_copy", " = ", this.to_name(phi.function_variable), ";");
                        temporary_phi_variables.add(phi.function_variable);
                    }

                    // This might be called in continue block, so make sure we
                    // use this to emit ESSL 1.0 compliant increments/decrements.
                    const lhs = this.to_expression(phi.function_variable);

                    let rhs;
                    if (temporary_phi_variables.has(phi.local_variable))
                        rhs = "_" + phi.local_variable + "_copy";
                    else
                        rhs = this.to_pointer_expression(phi.local_variable);

                    if (!this.optimize_read_modify_write(this.get<SPIRType>(SPIRType, var_.basetype), lhs, rhs))
                        this.statement(lhs, " = ", rhs, ";");
                }

                this.register_write(phi.function_variable);
            }
        }
    }

    protected flush_variable_declaration(id: number)
    {
        // Ensure that we declare phi-variable copies even if the original declaration isn't deferred
        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, id);
        const { options } = this;
        if (var_ && var_.deferred_declaration) {
            let initializer = "";
            if (options.force_zero_initialized_variables &&
                (var_.storage === StorageClass.Function || var_.storage === StorageClass.Generic ||
                    var_.storage === StorageClass.Private) &&
                !var_.initializer && this.type_can_zero_initialize(this.get_variable_data_type(var_))) {
                initializer = " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(var_));
            }

            this.statement(this.variable_decl_function_local(var_), initializer, ";");
            var_.deferred_declaration = false;
        }
        if (var_) {
            this.emit_variable_temporary_copies(var_);
        }
    }

    protected flush_undeclared_variables(block: SPIRBlock)
    {
        for (let v of block.dominated_variables)
            this.flush_variable_declaration(v);
    }

    protected emit_variable_temporary_copies(var_: SPIRVariable)
    {
        // Ensure that we declare phi-variable copies even if the original declaration isn't deferred
        if (var_.allocate_temporary_copy && !this.flushed_phi_variables.has(var_.self)) {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            const flags = this.get_decoration_bitset(var_.self);
            this.statement(this.flags_to_qualifiers_glsl(type, flags), this.variable_decl(type, "_" + var_.self + "_copy"), ";");
            this.flushed_phi_variables.add(var_.self);
        }
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

    protected should_forward(id: number): boolean
    {
        // If id is a variable we will try to forward it regardless of force_temporary check below
        // This is important because otherwise we'll get local sampler copies (highp sampler2D foo = bar) that are invalid in OpenGL GLSL
        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, id);
        if (var_ && var_.forwardable)
            return true;

        // For debugging emit temporary variables for all expressions
        if (this.options.force_temporary)
            return false;

        // Immutable expression can always be forwarded.
        if (this.is_immutable(id))
            return true;

        return false;
    }

    protected should_suppress_usage_tracking(id: number): boolean
    {
        // Used only by opcodes which don't do any real "work", they just swizzle data in some fashion.
        return !this.expression_is_forwarded(id) || this.expression_suppresses_usage_tracking(id);
    }

    protected emit_mix_op(result_type: number, id: number, left: number, right: number, lerp: number)
    {
        const lerptype = this.expression_type(lerp);
        const restype = this.get<SPIRType>(SPIRType, result_type);

        // If this results in a variable pointer, assume it may be written through.
        if (restype.pointer) {
            this.register_write(left);
            this.register_write(right);
        }

        /*let has_boolean_mix = backend.boolean_mix_function &&
            ((options.es && options.version >= 310) || (!options.es && options.version >= 450));*/
        const mix_op = this.to_trivial_mix_op(restype, left, right, lerp);
        const trivial_mix = mix_op !== undefined;

        // Cannot use boolean mix when the lerp argument is just one boolean,
        // fall back to regular trinary statements.
        // if (lerptype.vecsize === 1)
        //     has_boolean_mix = false;

        // If we can reduce the mix to a simple cast, do so.
        // This helps for cases like int(bool), uint(bool) which is implemented with
        // OpSelect bool 1 0.
        if (trivial_mix) {
            this.emit_unary_func_op(result_type, id, lerp, mix_op);
        }
        else if (/*!has_boolean_mix &&*/ lerptype.basetype === SPIRBaseType.Boolean) {
            // Boolean mix not supported on desktop without extension.
            // Was added in OpenGL 4.5 with ES 3.1 compat.
            //
            // Could use GL_EXT_shader_integer_mix on desktop at least,
            // but Apple doesn't support it. :(
            // Just implement it as ternary expressions.
            const expr = this.to_ternary_expression(this.get<SPIRType>(SPIRType, result_type), lerp, right, left);
            this.emit_op(result_type, id, expr, this.should_forward(left) && this.should_forward(right) && this.should_forward(lerp));
            this.inherit_expression_dependencies(id, left);
            this.inherit_expression_dependencies(id, right);
            this.inherit_expression_dependencies(id, lerp);
        }
        /*else if (lerptype.basetype === SPIRBaseType.Boolean)
            this.emit_trinary_func_op(result_type, id, left, right, lerp, backend.boolean_mix_function);*/
        else
            this.emit_trinary_func_op(result_type, id, left, right, lerp, "mix");
    }

    protected emit_nminmax_op(result_type: number, id: number, op0: number, op1: number, op: GLSLstd450)
    {
        const {ir} = this;
        // Need to emulate this call.
        let ids = maplike_get(0, this.extra_sub_expressions, id);
        if (!ids)
        {
            ids = ir.increase_bound_by(5);
            const btype = defaultClone(SPIRType, this.get<SPIRType>(SPIRType, result_type));
            btype.basetype = SPIRBaseType.Boolean;
            this.set<SPIRType>(SPIRType, ids, btype);
        }

        const btype_id = ids + 0;
        const left_nan_id = ids + 1;
        const right_nan_id = ids + 2;
        const tmp_id = ids + 3;
        const mixed_first_id = ids + 4;

        // Inherit precision qualifiers.
        ir.meta[tmp_id] = defaultClone(Meta, ir.meta[id]);
        ir.meta[mixed_first_id] = defaultClone(Meta, ir.meta[id]);

        this.emit_unary_func_op(btype_id, left_nan_id, op0, "isnan");
        this.emit_unary_func_op(btype_id, right_nan_id, op1, "isnan");
        this.emit_binary_func_op(result_type, tmp_id, op0, op1, op === GLSLstd450.NMin ? "min" : "max");
        this.emit_mix_op(result_type, mixed_first_id, tmp_id, op1, left_nan_id);
        this.emit_mix_op(result_type, id, mixed_first_id, op0, right_nan_id);
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

        if (lerptype.basetype !== SPIRBaseType.Boolean)
            return undefined;
        if (value_type.basetype === SPIRBaseType.Struct || this.is_array(value_type))
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
                case SPIRBaseType.Short:
                case SPIRBaseType.UShort:
                    ret = cleft.scalar_u16(0, row) === 0 && cright.scalar_u16(0, row) === 1;
                    break;

                case SPIRBaseType.Int:
                case SPIRBaseType.UInt:
                    ret = cleft.scalar(0, row) === 0 && cright.scalar(0, row) === 1;
                    break;

                case SPIRBaseType.Half:
                    ret = cleft.scalar_f16(0, row) === 0.0 && cright.scalar_f16(0, row) === 1.0;
                    break;

                case SPIRBaseType.Float:
                    ret = cleft.scalar_f32(0, row) === 0.0 && cright.scalar_f32(0, row) === 1.0;
                    break;

                case SPIRBaseType.Double:
                    ret = cleft.scalar_f64(0, row) === 0.0 && cright.scalar_f64(0, row) === 1.0;
                    break;

                case SPIRBaseType.Int64:
                case SPIRBaseType.UInt64:
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

    protected emit_trinary_func_op(result_type: number, result_id: number, op0: number, op1: number, op2: number, op: string)
    {
        const forward = this.should_forward(op0) && this.should_forward(op1) && this.should_forward(op2);
        this.emit_op(result_type, result_id, op + "(" + this.to_unpacked_expression(op0) + ", " +
            this.to_unpacked_expression(op1) + ", " + this.to_unpacked_expression(op2) + ")", forward);

        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
        this.inherit_expression_dependencies(result_id, op2);
    }

    protected emit_binary_func_op(result_type: number, result_id: number, op0: number, op1: number, op: string)
    {
        const forward = this.should_forward(op0) && this.should_forward(op1);
        this.emit_op(result_type, result_id, op + "(" + this.to_unpacked_expression(op0) + ", " + this.to_unpacked_expression(op1) + ")", forward);
        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
    }

    protected emit_trinary_func_op_bitextract(result_type: number, result_id: number, op0: number, op1: number,
                                              op2: number, op: string, expected_result_type: SPIRBaseType, input_type0: SPIRBaseType,
                                              input_type1: SPIRBaseType, input_type2: SPIRBaseType)
    {
        const out_type = this.get<SPIRType>(SPIRType, result_type);
        const expected_type = defaultClone(SPIRType, out_type);
        expected_type.basetype = input_type0;

        const cast_op0 = this.expression_type(op0).basetype !== input_type0 ? this.bitcast_glsl(expected_type, op0) : this.to_unpacked_expression(op0);
        const op1_expr = this.to_unpacked_expression(op1);
        const op2_expr = this.to_unpacked_expression(op2);

        // Use value casts here instead. Input must be exactly int or uint, but SPIR-V might be 16-bit.
        expected_type.basetype = input_type1;
        expected_type.vecsize = 1;
        const cast_op1 = this.expression_type(op1).basetype !== input_type1 ?
            this.type_to_glsl_constructor(expected_type) + "(" + op1_expr + ")" :
            op1_expr;

        expected_type.basetype = input_type2;
        expected_type.vecsize = 1;
        const cast_op2 = this.expression_type(op2).basetype !== input_type2 ?
            this.type_to_glsl_constructor(expected_type) + "(" + op2_expr + ")" :
            op2_expr;

        let expr = "";
        if (out_type.basetype !== expected_result_type) {
            expected_type.vecsize = out_type.vecsize;
            expected_type.basetype = expected_result_type;
            expr = this.bitcast_glsl_op(out_type, expected_type);
            expr += "(" + op + "(" + cast_op0 + ", " + cast_op1 + ", " + cast_op2 + ")" + ")";
        }
        else {
            expr += op + "(" + cast_op0 + ", " + cast_op1 + ", " + cast_op2 + ")";
        }

        this.emit_op(result_type, result_id, expr, this.should_forward(op0) && this.should_forward(op1) && this.should_forward(op2));
        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
        this.inherit_expression_dependencies(result_id, op2);
    }

    protected emit_bitfield_insert_op(result_type: number, result_id: number, op0: number, op1: number, op2: number,
                                      op3: number, op: string, offset_count_type: SPIRBaseType)
    {
        // Only need to cast offset/count arguments. Types of base/insert must be same as result type,
        // and bitfieldInsert is sign invariant.
        const forward = this.should_forward(op0) && this.should_forward(op1) && this.should_forward(op2) && this.should_forward(op3);

        const op0_expr = this.to_unpacked_expression(op0);
        const op1_expr = this.to_unpacked_expression(op1);
        let op2_expr = this.to_unpacked_expression(op2);
        let op3_expr = this.to_unpacked_expression(op3);

        const target_type = new SPIRType();
        target_type.vecsize = 1;
        target_type.basetype = offset_count_type;

        if (this.expression_type(op2).basetype !== offset_count_type) {
            // Value-cast here. Input might be 16-bit. GLSL requires int.
            op2_expr = this.type_to_glsl_constructor(target_type) + "(" + op2_expr + ")";
        }

        if (this.expression_type(op3).basetype !== offset_count_type) {
            // Value-cast here. Input might be 16-bit. GLSL requires int.
            op3_expr = this.type_to_glsl_constructor(target_type) + "(" + op3_expr + ")";
        }

        this.emit_op(result_type, result_id, op + "(" + op0_expr + ", " + op1_expr + ", " + op2_expr + ", " + op3_expr + ")", forward);

        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
        this.inherit_expression_dependencies(result_id, op2);
        this.inherit_expression_dependencies(result_id, op3);
    }

    protected emit_unary_func_op(result_type: number, result_id: number, op0: number, op: string)
    {
        const forward = this.should_forward(op0);
        this.emit_op(result_type, result_id, op + "(" + this.to_unpacked_expression(op0) + ")", forward);
        this.inherit_expression_dependencies(result_id, op0);
    }

    protected emit_binary_op(result_type: number, result_id: number, op0: number, op1: number, op: string)
    {
        // Various FP arithmetic opcodes such as add, sub, mul will hit this.
        const force_temporary_precise = this.backend.support_precise_qualifier &&
            this.has_decoration(result_id, Decoration.NoContraction) &&
            type_is_floating_point(this.get<SPIRType>(SPIRType, result_type));
        const forward = this.should_forward(op0) && this.should_forward(op1) && !force_temporary_precise;

        this.emit_op(result_type, result_id, this.to_enclosed_unpacked_expression(op0) + " " + op + " " + this.to_enclosed_unpacked_expression(op1), forward);

        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
    }

    protected emit_unrolled_binary_op(result_type: number, result_id: number, op0: number, op1: number, op: string, negate: boolean, expected_type: SPIRBaseType)
    {
        const type0 = this.expression_type(op0);
        const type1 = this.expression_type(op1);

        const target_type0 = defaultClone(SPIRType, type0);
        const target_type1 = defaultClone(SPIRType, type1);
        target_type0.basetype = expected_type;
        target_type1.basetype = expected_type;
        target_type0.vecsize = 1;
        target_type1.vecsize = 1;

        const type = this.get<SPIRType>(SPIRType, result_type);
        let expr = this.type_to_glsl_constructor(type);
        expr += "(";
        for (let i = 0; i < type.vecsize; i++) {
            // Make sure to call to_expression multiple times to ensure
            // that these expressions are properly flushed to temporaries if needed.
            if (negate)
                expr += "!(";

            if (expected_type !== SPIRBaseType.Unknown && type0.basetype !== expected_type)
                expr += this.bitcast_expression(target_type0, type0.basetype, this.to_extract_component_expression(op0, i));
            else
                expr += this.to_extract_component_expression(op0, i);

            expr += " " + op + " ";

            if (expected_type !== SPIRBaseType.Unknown && type1.basetype !== expected_type)
                expr += this.bitcast_expression(target_type1, type1.basetype, this.to_extract_component_expression(op1, i));
            else
                expr += this.to_extract_component_expression(op1, i);

            if (negate)
                expr += ")";

            if (i + 1 < type.vecsize)
                expr += ", ";
        }
        expr += ")";
        this.emit_op(result_type, result_id, expr, this.should_forward(op0) && this.should_forward(op1));

        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
    }

    protected emit_unary_func_op_cast(result_type: number, result_id: number, op0: number, op: string, input_type: SPIRBaseType, expected_result_type: SPIRBaseType)
    {
        const out_type = this.get<SPIRType>(SPIRType, result_type);
        const expr_type = this.expression_type(op0);
        const expected_type = defaultClone(SPIRType, out_type);

        // Bit-widths might be different in unary cases because we use it for SConvert/UConvert and friends.
        expected_type.basetype = input_type;
        expected_type.width = expr_type.width;

        let cast_op = "";
        if (expr_type.basetype !== input_type) {
            if (expr_type.basetype === SPIRBaseType.Boolean)
                cast_op = this.type_to_glsl(expected_type) + "(" + this.to_unpacked_expression(op0) + ")";
            else
                cast_op = this.bitcast_glsl(expected_type, op0);
        }
        else
            cast_op = this.to_unpacked_expression(op0);

        let expr = "";
        if (out_type.basetype !== expected_result_type) {
            expected_type.basetype = expected_result_type;
            expected_type.width = out_type.width;
            if (out_type.basetype === SPIRBaseType.Boolean)
                expr = this.type_to_glsl(out_type);
            else
                expr = this.bitcast_glsl_op(out_type, expected_type);
            expr += "(" + op + "(" + cast_op + ")" + ")";
        }
        else {
            expr += op + "(" + cast_op + ")";
        }

        this.emit_op(result_type, result_id, expr, this.should_forward(op0));
        this.inherit_expression_dependencies(result_id, op0);
    }

    protected emit_binary_func_op_cast(result_type: number, result_id: number, op0: number, op1: number, op: string, input_type: SPIRBaseType, skip_cast_if_equal_type: boolean)
    {
        const props = { cast_op0: "", cast_op1: "", input_type };
        const expected_type = this.binary_op_bitcast_helper(props, op0, op1, skip_cast_if_equal_type);
        const out_type = this.get<SPIRType>(SPIRType, result_type);

        // Special case boolean outputs since relational opcodes output booleans instead of int/uint.
        let expr = "";
        if (out_type.basetype !== input_type && out_type.basetype !== SPIRBaseType.Boolean) {
            expected_type.basetype = input_type;
            expr = this.bitcast_glsl_op(out_type, expected_type);
            expr += "(" + op + "(" + props.cast_op0 + ", " + props.cast_op1 + "))";
        }
        else {
            expr += op + "(" + props.cast_op0 + ", " + props.cast_op1 + ")";
        }

        this.emit_op(result_type, result_id, expr, this.should_forward(op0) && this.should_forward(op1));
        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
    }

    protected emit_trinary_func_op_cast(result_type: number, result_id: number, op0: number, op1: number, op2: number,
                                        op: string, input_type: SPIRBaseType)
    {
        const out_type = this.get<SPIRType>(SPIRType, result_type);
        const expected_type = defaultClone(SPIRType, out_type);
        expected_type.basetype = input_type;
        const cast_op0 = this.expression_type(op0).basetype !== input_type ? this.bitcast_glsl(expected_type, op0) : this.to_unpacked_expression(op0);
        const cast_op1 = this.expression_type(op1).basetype !== input_type ? this.bitcast_glsl(expected_type, op1) : this.to_unpacked_expression(op1);
        const cast_op2 = this.expression_type(op2).basetype !== input_type ? this.bitcast_glsl(expected_type, op2) : this.to_unpacked_expression(op2);

        let expr = "";
        if (out_type.basetype !== input_type) {
            expr = this.bitcast_glsl_op(out_type, expected_type);
            expr += "(" + op + "(" + cast_op0 + ", " + cast_op1 + ", " + cast_op2 + "))";
        }
        else {
            expr += op + "(" + cast_op0 + ", " + cast_op1 + ", " + cast_op2 + ")";
        }

        this.emit_op(result_type, result_id, expr, this.should_forward(op0) && this.should_forward(op1) && this.should_forward(op2));
        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
        this.inherit_expression_dependencies(result_id, op2);
    }

    protected emit_binary_op_cast(result_type: number, result_id: number, op0: number, op1: number, op: string, input_type: SPIRBaseType, skip_cast_if_equal_type: boolean)
    {
        const props = { cast_op0: "", cast_op1: "", input_type };
        const expected_type = this.binary_op_bitcast_helper(props, op0, op1, skip_cast_if_equal_type);
        const out_type = this.get<SPIRType>(SPIRType, result_type);

        // We might have casted away from the result type, so bitcast again.
        // For example, arithmetic right shift with uint inputs.
        // Special case boolean outputs since relational opcodes output booleans instead of int/uint.
        let expr = "";
        if (out_type.basetype !== props.input_type && out_type.basetype !== SPIRBaseType.Boolean) {
            expected_type.basetype = input_type;
            expr = this.bitcast_glsl_op(out_type, expected_type);
            expr += "(" + props.cast_op0 + " " + op + " " + props.cast_op1 + ")";
        }
        else
            expr += props.cast_op0 + " " + op + " " + props.cast_op1;

        this.emit_op(result_type, result_id, expr, this.should_forward(op0) && this.should_forward(op1));
        this.inherit_expression_dependencies(result_id, op0);
        this.inherit_expression_dependencies(result_id, op1);
    }

    protected binary_op_bitcast_helper(props: { cast_op0: string, cast_op1: string, input_type: SPIRBaseType }, op0: number, op1: number, skip_cast_if_equal_type: boolean): SPIRType
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

        return defaultClone(SPIRType, expected_type);
    }

    protected emit_complex_bitcast(result_type: number, id: number, op0: number): boolean
    {
        // Some bitcasts may require complex casting sequences, and are implemented here.
        // Otherwise a simply unary function will do with bitcast_glsl_op.

        const output_type = this.get<SPIRType>(SPIRType, result_type);
        const input_type = this.expression_type(op0);
        let expr;

        if (output_type.basetype === SPIRBaseType.Half && input_type.basetype === SPIRBaseType.Float && input_type.vecsize === 1)
            expr = "unpackFloat2x16(floatBitsToUint(" + this.to_unpacked_expression(op0) + "))";
        else if (output_type.basetype === SPIRBaseType.Float && input_type.basetype === SPIRBaseType.Half &&
            input_type.vecsize === 2)
            expr = "uintBitsToFloat(packFloat2x16(" + this.to_unpacked_expression(op0) + "))";
        else
            return false;

        this.emit_op(result_type, id, expr, this.should_forward(op0));
        return true;
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

    protected emit_unary_op(result_type: number, result_id: number, op0: number, op: string)
    {
        const forward = this.should_forward(op0);
        this.emit_op(result_type, result_id, op + this.to_enclosed_unpacked_expression(op0), forward);
        this.inherit_expression_dependencies(result_id, op0);
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

    protected emit_op(result_type: number, result_id: number, rhs: string, forwarding: boolean, suppress_usage_tracking: boolean = false): SPIRExpression
    {
        if (forwarding && !this.forced_temporaries.has(result_id)) {
            // Just forward it without temporary.
            // If the forward is trivial, we do not force flushing to temporary for this expression.
            this.forwarded_temporaries.add(result_id);
            if (suppress_usage_tracking)
                this.suppressed_usage_tracking.add(result_id);

            return this.set<SPIRExpression>(SPIRExpression, result_id, rhs, result_type, true);
        }
        else {
            // If expression isn't immutable, bind it to a temporary and make the new temporary immutable (they always are).
            this.statement(this.declare_temporary(result_type, result_id), rhs, ";");
            return this.set<SPIRExpression>(SPIRExpression, result_id, this.to_name(result_id), result_type, true);
        }
    }

    protected access_chain_internal_append_index(expr: string, base: number, type: SPIRType, flags: AccessChainFlags, access_chain_is_arrayed: boolean, index: number): string
    {
        const index_is_literal = (flags & AccessChainFlagBits.INDEX_IS_LITERAL_BIT) !== 0;
        const register_expression_read = (flags & AccessChainFlagBits.SKIP_REGISTER_EXPRESSION_READ_BIT) === 0;

        expr += "[";

        if (index_is_literal)
            expr += convert_to_string(index);
        else
            expr += this.to_unpacked_expression(index, register_expression_read);

        expr += "]";

        return expr;
    }

    protected access_chain_internal(base: number, indices: number[] | Uint32Array, arroffset: number, count: number, flags: AccessChainFlags, meta: AccessChainMeta): string
    {
        let expr = "";

        const { backend, options, ir } = this;

        const index_is_literal = (flags & AccessChainFlagBits.INDEX_IS_LITERAL_BIT) !== 0;
        const msb_is_id = (flags & AccessChainFlagBits.LITERAL_MSB_FORCE_ID) !== 0;
        const chain_only = (flags & AccessChainFlagBits.CHAIN_ONLY_BIT) !== 0;
        const ptr_chain = (flags & AccessChainFlagBits.PTR_CHAIN_BIT) !== 0;
        const register_expression_read = (flags & AccessChainFlagBits.SKIP_REGISTER_EXPRESSION_READ_BIT) === 0;
        const flatten_member_reference = (flags & AccessChainFlagBits.FLATTEN_ALL_MEMBERS_BIT) !== 0;

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
        let is_packed = this.has_extended_decoration(base, ExtendedDecorations.PhysicalTypePacked);
        let physical_type = this.get_extended_decoration(base, ExtendedDecorations.PhysicalTypeID);
        let is_invariant = this.has_decoration(base, Decoration.Invariant);
        let pending_array_enclose = false;
        let dimension_flatten = false;

        const append_index = (index: number, is_literal: boolean) =>
        {
            let mod_flags: AccessChainFlags = flags;
            if (!is_literal)
                mod_flags &= ~AccessChainFlagBits.INDEX_IS_LITERAL_BIT;
            expr = this.access_chain_internal_append_index(expr, base, type, mod_flags, access_chain_is_arrayed, index);
        };

        for (let i = 0; i < count; i++) {
            let index = indices[i + arroffset];

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

                if (type.basetype === SPIRBaseType.ControlPointArray) {
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
                    !this.has_decoration(type.self, Decoration.Block)) {
                    // This deals with scenarios for tesc/geom where arrays of gl_Position[] are declared.
                    // Normally, these variables live in blocks when compiled from GLSL,
                    // but HLSL seems to just emit straight arrays here.
                    // We must pretend this access goes through gl_in/gl_out arrays
                    // to be able to access certain builtins as arrays.
                    const builtin = maplike_get(Meta, ir.meta, base).decoration.builtin_type;
                    switch (builtin) {
                        // case BuiltInCullDistance: // These are already arrays, need to figure out rules for these in tess/geom.
                        // case BuiltInClipDistance:
                        case BuiltIn.Position:
                        case BuiltIn.PointSize:
                            if (var_.storage === StorageClass.Input)
                                expr = "gl_in[" + this.to_expression(index, register_expression_read) + "]." + expr;
                            else if (var_.storage === StorageClass.Output)
                                expr = "gl_out[" + this.to_expression(index, register_expression_read) + "]." + expr;
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
                else if (!this.builtin_translates_to_nonarray(<BuiltIn>(this.get_decoration(base, Decoration.BuiltIn)))) {
                    append_index(index, is_literal);
                }

                type_id = type.parent_type;
                type = this.get<SPIRType>(SPIRType, type_id);

                access_chain_is_arrayed = true;
            }
                // For structs, the index refers to a constant, which indexes into the members, possibly through a redirection mapping.
            // We also check if this member is a builtin, since we then replace the entire expression with the builtin one.
            else if (type.basetype === SPIRBaseType.Struct) {
                if (!is_literal)
                    index = this.evaluate_constant_u32(index);

                if (index < type.member_type_index_redirection.length)
                    index = type.member_type_index_redirection[index];

                if (index >= type.member_types.length)
                    throw new Error("Member index is out of bounds!");

                const builtin: BuiltIn = this.is_member_builtin(type, index);
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

                if (this.has_member_decoration(type.self, index, Decoration.Invariant))
                    is_invariant = true;

                is_packed = this.member_is_packed_physical_type(type, index);
                if (this.member_is_remapped_physical_type(type, index))
                    physical_type = this.get_extended_member_decoration(type.self, index, ExtendedDecorations.PhysicalTypeID);
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
                let effective_storage: StorageClass = StorageClass.Generic;
                let ignore_potential_sliced_writes = false;
                if ((flags & AccessChainFlagBits.FORCE_COMPOSITE_BIT) === 0) {
                    if (this.expression_type(base).pointer)
                        effective_storage = this.get_expression_effective_storage_class(base);

                    // Special consideration for control points.
                    // Control points can only be written by InvocationID, so there is no need
                    // to consider scalar access chains here.
                    // Cleans up some cases where it's very painful to determine the accurate storage class
                    // since blocks can be partially masked ...
                    /*const var_ = maybe_get_backing_variable(base);
                    if (var_ && var_.storage === StorageClass.Output &&
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
                else if (ir.ids[index].get_type() === Types.Constant && !is_packed && !row_major_matrix_needs_conversion) {
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
        const forced_temporary = this.ir.ids[ptr].get_type() === Types.Expression && !this.get<SPIRExpression>(SPIRExpression, ptr).access_chain &&
            (this.forced_temporaries.has(ptr) || !this.forwarded_temporaries.has(ptr));

        if (var_ && !forced_temporary) {
            if (this.variable_decl_is_remapped_storage(var_, StorageClass.Workgroup))
                return StorageClass.Workgroup;
            if (this.variable_decl_is_remapped_storage(var_, StorageClass.StorageBuffer))
                return StorageClass.StorageBuffer;

            // Normalize SSBOs to StorageBuffer here.
            if (var_.storage === StorageClass.Uniform && this.has_decoration(this.get<SPIRType>(SPIRType, var_.basetype).self, Decoration.BufferBlock))
                return StorageClass.StorageBuffer;
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

    protected access_chain(base: number, indices: Uint32Array, arroffset: number, count: number, target_type: SPIRType, meta: AccessChainMeta = null, ptr_chain: boolean = false): string
    {
        if (this.flattened_buffer_blocks.has(base)) {
            // need to be able to change these in functions:
            const props = {
                matrix_stride: 0,
                array_stride: 0,
                need_transpose: false
            };

            this.flattened_access_chain_offset(this.expression_type(base), indices, arroffset, count, 0, 16, props, ptr_chain);

            if (meta) {
                meta.need_transpose = target_type.columns > 1 && props.need_transpose;
                meta.storage_is_packed = false;
            }

            return this.flattened_access_chain(base, indices, arroffset, count, target_type, 0, props.matrix_stride, props.array_stride, props.need_transpose);
        }
        else if (this.flattened_structs.hasOwnProperty(base) && count > 0) {
            let flags = AccessChainFlagBits.CHAIN_ONLY_BIT | AccessChainFlagBits.SKIP_REGISTER_EXPRESSION_READ_BIT;
            if (ptr_chain)
                flags |= AccessChainFlagBits.PTR_CHAIN_BIT;

            if (this.flattened_structs[base]) {
                flags |= AccessChainFlagBits.FLATTEN_ALL_MEMBERS_BIT;
                if (meta)
                    meta.flattened_struct = target_type.basetype === SPIRBaseType.Struct;
            }

            const chain = this.access_chain_internal(base, indices, arroffset, count, flags, null).substring(1);
            if (meta) {
                meta.need_transpose = false;
                meta.storage_is_packed = false;
            }

            const basename = this.to_flattened_access_chain_expression(base);
            const ret = basename + "_" + chain;
            return ParsedIR.sanitize_underscores(ret);
        }
        else {
            let flags = AccessChainFlagBits.SKIP_REGISTER_EXPRESSION_READ_BIT;
            if (ptr_chain)
                flags |= AccessChainFlagBits.PTR_CHAIN_BIT;
            return this.access_chain_internal(base, indices, arroffset, count, flags, meta);
        }
    }

    protected flattened_access_chain(base: number, indices: Uint32Array | Array<number>, arroffset: number, count: number,
                                     target_type: SPIRType, offset: number, matrix_stride: number,
                                     _array_stride: number, need_transpose: boolean)
    {
        if (target_type.array.length > 0)
            throw new Error("Access chains that result in an array can not be flattened");
        else if (target_type.basetype === SPIRBaseType.Struct)
            return this.flattened_access_chain_struct(base, indices, arroffset, count, target_type, offset);
        else if (target_type.columns > 1)
            return this.flattened_access_chain_matrix(base, indices, arroffset, count, target_type, offset, matrix_stride, need_transpose);
        else
            return this.flattened_access_chain_vector(base, indices, arroffset, count, target_type, offset, matrix_stride, need_transpose);
    }

    protected flattened_access_chain_struct(base: number, indices: Uint32Array | Array<number>, arroffset: number, count: number,
                                            target_type: SPIRType, offset: number): string
    {
        let expr = this.type_to_glsl_constructor(target_type) + "(";

        for (let i = 0; i < target_type.member_types.length; ++i) {
            if (i !== 0)
                expr += ", ";

            const member_type = this.get<SPIRType>(SPIRType, target_type.member_types[i]);
            const member_offset = this.type_struct_member_offset(target_type, i);

            // The access chain terminates at the struct, so we need to find matrix strides and row-major information
            // ahead of time.
            let need_transpose = false;
            let matrix_stride = 0;
            if (member_type.columns > 1) {
                need_transpose = this.combined_decoration_for_member(target_type, i).get(Decoration.RowMajor);
                matrix_stride = this.type_struct_member_matrix_stride(target_type, i);
            }

            const tmp = this.flattened_access_chain(base, indices, arroffset, count, member_type, offset + member_offset,
                matrix_stride, 0 /* array_stride */, need_transpose);

            // Cannot forward transpositions, so resolve them here.
            if (need_transpose)
                expr += this.convert_row_major_matrix(tmp, member_type, 0, false);
            else
                expr += tmp;
        }

        expr += ")";

        return expr;
    }

    protected flattened_access_chain_matrix(base: number, indices: Uint32Array | Array<number>, arroffset: number, count: number,
                                            target_type: SPIRType, offset: number, matrix_stride: number, need_transpose: boolean): string
    {
        console.assert(matrix_stride);
        const tmp_type = defaultClone(SPIRType, target_type);
        if (need_transpose) {
            const tmp = tmp_type.vecsize;
            tmp_type.vecsize = tmp_type.columns;
            tmp_type.columns = tmp;
        }

        let expr = this.type_to_glsl_constructor(tmp_type) + "(";

        for (let i = 0; i < tmp_type.columns; i++) {
            if (i !== 0)
                expr += ", ";

            expr += this.flattened_access_chain_vector(base, indices, arroffset, count, tmp_type, offset + i * matrix_stride, matrix_stride, false);
        }

        expr += ")";

        return expr;
    }

    protected flattened_access_chain_vector(base: number, indices: Uint32Array | Array<number>, arroffset: number, count: number,
                                            target_type: SPIRType, offset: number, matrix_stride: number, need_transpose: boolean): string
    {
        const result = this.flattened_access_chain_offset(this.expression_type(base), indices, arroffset, count, offset, 16);

        const buffer_name = this.to_name(this.expression_type(base).self);

        if (need_transpose) {
            let expr = "";

            if (target_type.vecsize > 1) {
                expr += this.type_to_glsl_constructor(target_type);
                expr += "(";
            }

            for (let i = 0; i < target_type.vecsize; ++i) {
                if (i !== 0)
                    expr += ", ";

                const component_offset = result.second + i * matrix_stride;

                console.assert(component_offset % (target_type.width / 8) === 0);
                const index = component_offset / (target_type.width / 8);

                expr += buffer_name;
                expr += "[";
                expr += result.first; // this is a series of N1 * k1 + N2 * k2 + ... that is either empty or ends with a +
                expr += convert_to_string(index / 4);
                expr += "]";

                expr += this.vector_swizzle(1, index % 4);
            }

            if (target_type.vecsize > 1) {
                expr += ")";
            }

            return expr;
        }
        else {
            console.assert(result.second % (target_type.width / 8) === 0);
            const index = result.second / (target_type.width / 8);

            let expr = "";

            expr += buffer_name;
            expr += "[";
            expr += result.first; // this is a series of N1 * k1 + N2 * k2 + ... that is either empty or ends with a +
            expr += convert_to_string(index / 4);
            expr += "]";

            expr += this.vector_swizzle(target_type.vecsize, index % 4);

            return expr;
        }
    }

    protected flattened_access_chain_offset(basetype: SPIRType, indices: Uint32Array | Array<number>,
                                            arroffset: number, count: number, offset: number, word_stride: number,
                                            out: { need_transpose: boolean, matrix_stride: number, array_stride: number } = null,
                                            ptr_chain: boolean = false): Pair<string, number>
    {
        // Start traversing type hierarchy at the proper non-pointer types.
        let type = this.get_pointee_type(basetype);

        let expr = "";

        // Inherit matrix information in case we are access chaining a vector which might have come from a row major layout.
        let row_major_matrix_needs_conversion = out?.need_transpose || false;
        let matrix_stride = out?.matrix_stride || 0;
        let array_stride = out?.array_stride || 0;

        for (let i = 0; i < count; i++) {
            let index = indices[arroffset + i];

            // Pointers
            if (ptr_chain && i === 0) {
                // Here, the pointer type will be decorated with an array stride.
                array_stride = this.get_decoration(basetype.self, Decoration.ArrayStride);
                if (!array_stride)
                    throw new Error("SPIR-V does not define ArrayStride for buffer block.");

                const constant = this.maybe_get<SPIRConstant>(SPIRConstant, index);
                if (constant) {
                    // Constant array access.
                    offset += constant.scalar() * array_stride;
                }
                else {
                    // Dynamic array access.
                    if (array_stride % word_stride) {
                        throw new Error("Array stride for dynamic indexing must be divisible by the size of a" +
                            " 4-component vector. Likely culprit here is a float or vec2 array inside a push" +
                            " constant block which is std430. This cannot be flattened. Try using std140 layout" +
                            " instead.");
                    }

                    expr += this.to_enclosed_expression(index) + " * " + convert_to_string(array_stride / word_stride) + " + ";
                }
            }
            // Arrays
            else if (type.array.length > 0) {
                const constant = this.maybe_get<SPIRConstant>(SPIRConstant, index);
                if (constant) {
                    // Constant array access.
                    offset += constant.scalar() * array_stride;
                }
                else {
                    // Dynamic array access.
                    if (array_stride % word_stride) {
                        throw new Error("Array stride for dynamic indexing must be divisible by the size of a" +
                            " 4-component vector. Likely culprit here is a float or vec2 array inside a push" +
                            " constant block which is std430. This cannot be flattened. Try using std140 layout" +
                            " instead.");
                    }

                    expr += this.to_enclosed_expression(index, false) + " * " + convert_to_string(array_stride / word_stride) + " + ";
                }

                const parent_type = type.parent_type;
                type = this.get<SPIRType>(SPIRType, parent_type);

                if (type.array.length > 0)
                    array_stride = this.get_decoration(parent_type, Decoration.ArrayStride);
            }
                // For structs, the index refers to a constant, which indexes into the members.
            // We also check if this member is a builtin, since we then replace the entire expression with the builtin one.
            else if (type.basetype === SPIRBaseType.Struct) {
                index = this.evaluate_constant_u32(index);

                if (index >= type.member_types.length)
                    throw new Error("Member index is out of bounds!");

                offset += this.type_struct_member_offset(type, index);

                const struct_type = type;
                type = this.get<SPIRType>(SPIRType, type.member_types[index]);

                if (type.columns > 1) {
                    matrix_stride = this.type_struct_member_matrix_stride(struct_type, index);
                    row_major_matrix_needs_conversion =
                        this.combined_decoration_for_member(struct_type, index).get(Decoration.RowMajor);
                }
                else
                    row_major_matrix_needs_conversion = false;

                if (type.array.length > 0)
                    array_stride = this.type_struct_member_array_stride(struct_type, index);
            }
            // Matrix -> Vector
            else if (type.columns > 1) {
                const constant = this.maybe_get<SPIRConstant>(SPIRConstant, index);
                if (constant) {
                    index = this.evaluate_constant_u32(index);
                    offset += index * (row_major_matrix_needs_conversion ? (type.width / 8) : matrix_stride);
                }
                else {
                    const indexing_stride = row_major_matrix_needs_conversion ? (type.width / 8) : matrix_stride;
                    // Dynamic array access.
                    if (indexing_stride % word_stride) {
                        throw new Error("Matrix stride for dynamic indexing must be divisible by the size of a" +
                            " 4-component vector. Likely culprit here is a row-major matrix being accessed dynamically." +
                            " This cannot be flattened. Try using std140 layout instead.");
                    }

                    expr += this.to_enclosed_expression(index, false);
                    expr += " * ";
                    expr += convert_to_string(indexing_stride / word_stride);
                    expr += " + ";
                }

                type = this.get<SPIRType>(SPIRType, type.parent_type);
            }
            // Vector -> Scalar
            else if (type.vecsize > 1) {
                const constant = this.maybe_get<SPIRConstant>(SPIRConstant, index);
                if (constant) {
                    index = this.evaluate_constant_u32(index);
                    offset += index * (row_major_matrix_needs_conversion ? matrix_stride : (type.width / 8));
                }
                else {
                    const indexing_stride = row_major_matrix_needs_conversion ? matrix_stride : (type.width / 8);

                    // Dynamic array access.
                    if (indexing_stride % word_stride) {
                        throw new Error("Stride for dynamic vector indexing must be divisible by the " +
                            "size of a 4-component vector. This cannot be flattened in legacy targets.");
                    }

                    expr += this.to_enclosed_expression(index, false) + " * " + convert_to_string(indexing_stride / word_stride) + " + ";
                }

                type = this.get<SPIRType>(SPIRType, type.parent_type);
            }
            else
                throw new Error("Cannot subdivide a scalar value!");
        }

        if (out) {
            out.need_transpose = row_major_matrix_needs_conversion;
            out.matrix_stride = matrix_stride;
            out.array_stride = array_stride;
        }

        return new Pair(expr, offset);
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

            e = this.remove_duplicate_swizzle(e) || e;
            return e;
        }
    }

    protected declare_temporary(result_type: number, result_id: number): string
    {
        const type = this.get<SPIRType>(SPIRType, result_type);
        const flags = maplike_get(Meta, this.ir.meta, result_id).decoration.decoration_flags;

        // If we're declaring temporaries inside continue blocks,
        // we must declare the temporary in the loop header so that the continue block can avoid declaring new variables.
        if (this.current_continue_block && !this.hoisted_temporaries.has(result_id)) {
            const header = this.get<SPIRBlock>(SPIRBlock, this.current_continue_block.loop_dominator);
            if (!header.declare_temporary.find(tmp => tmp.first === result_type && tmp.second === result_id)) {
                header.declare_temporary.push(new Pair(result_type, result_id));
                this.hoisted_temporaries.add(result_id);
                this.force_recompile();
            }

            return this.to_name(result_id) + " = ";
        }
        else if (this.hoisted_temporaries.has(result_id)) {
            // The temporary has already been declared earlier, so just "declare" the temporary by writing to it.
            return this.to_name(result_id) + " = ";
        }
        else {
            // The result_id has not been made into an expression yet, so use flags interface.
            this.add_local_variable_name(result_id);
            return this.flags_to_qualifiers_glsl(type, flags) + this.variable_decl(type, this.to_name(result_id)) + " = ";
        }
    }

    protected emit_uninitialized_temporary(result_type: number, result_id: number)
    {
// If we're declaring temporaries inside continue blocks,
        // we must declare the temporary in the loop header so that the continue block can avoid declaring new variables.
        if (this.current_continue_block && !this.hoisted_temporaries.has(result_id)) {
            const header = this.get<SPIRBlock>(SPIRBlock, this.current_continue_block.loop_dominator);
            if (!header.declare_temporary.find(tmp => tmp.first === result_type && tmp.second === result_id)) {
                header.declare_temporary.push(new Pair(result_type, result_id));
                this.hoisted_temporaries.add(result_id);
                this.force_recompile();
            }
        }
        else if (!this.hoisted_temporaries.has(result_id)) {
            const type = this.get<SPIRType>(SPIRType, result_type);
            const flags = maplike_get(Meta, this.ir.meta, result_id).decoration.decoration_flags;

            // The result_id has not been made into an expression yet, so use flags interface.
            this.add_local_variable_name(result_id);

            let initializer = "";
            if (this.options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                initializer = " = " + this.to_zero_initialized_expression(result_type);

            this.statement(this.flags_to_qualifiers_glsl(type, flags), this.variable_decl(type, this.to_name(result_id)), initializer, ";");
        }
    }

    protected emit_uninitialized_temporary_expression(type: number, id: number): SPIRExpression
    {
        this.forced_temporaries.add(id);
        this.emit_uninitialized_temporary(type, id);
        return this.set<SPIRExpression>(SPIRExpression, id, this.to_name(id), type, true);
    }

    protected append_global_func_args(func: SPIRFunction, index: number, arglist: string[])
    {
        const args = func.arguments;
        const arg_cnt = args.length;
        for (let arg_idx = index; arg_idx < arg_cnt; arg_idx++) {
            const arg = args[arg_idx];
            console.assert(arg.alias_global_variable);

            // If the underlying variable needs to be declared
            // (ie. a local variable with deferred declaration), do so now.
            const var_id = this.get<SPIRVariable>(SPIRVariable, arg.id).basevariable;
            if (var_id)
                this.flush_variable_declaration(var_id);

            arglist.push(this.to_func_call_arg(arg, arg.id));
        }
    }

    protected to_non_uniform_aware_expression(id: number): string
    {
        let expr = this.to_expression(id);

        if (this.has_decoration(id, Decoration.NonUniform))
            expr = this.convert_non_uniform_expression(expr, id);

        return expr;
    }

    protected to_expression(id: number, register_expression_read: boolean = true): string
    {
        if (this.invalid_expressions.hasOwnProperty(id))
            this.handle_invalid_expression(id);

        const ir = this.ir;

        if (ir.ids[id].get_type() === Types.Expression) {
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
            case Types.Expression: {
                const e = this.get<SPIRExpression>(SPIRExpression, id);
                if (e.base_expression)
                    return this.to_enclosed_expression(e.base_expression) + e.expression;
                else if (e.need_transpose) {
                    // This should not be reached for access chains, since we always deal explicitly with transpose state
                    // when consuming an access chain expression.
                    const physical_type_id = this.get_extended_decoration(id, ExtendedDecorations.PhysicalTypeID);
                    const is_packed = this.has_extended_decoration(id, ExtendedDecorations.PhysicalTypePacked);
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

            case Types.Constant: {
                const c = this.get<SPIRConstant>(SPIRConstant, id);
                const type = this.get<SPIRType>(SPIRType, c.constant_type);

                // WorkGroupSize may be a constant.
                if (this.has_decoration(c.self, Decoration.BuiltIn))
                    return this.builtin_to_glsl(this.get_decoration(c.self, Decoration.BuiltIn), StorageClass.Generic);
                else if (c.specialization) {
                    if (this.backend.workgroup_size_is_hidden) {
                        const wg_index = this.get_constant_mapping_to_workgroup_component(c);
                        if (wg_index >= 0) {
                            let wg_size = this.builtin_to_glsl(BuiltIn.WorkgroupSize, StorageClass.Input) + this.vector_swizzle(1, wg_index);
                            if (type.basetype !== SPIRBaseType.UInt)
                                wg_size = this.bitcast_expression(type, SPIRBaseType.UInt, wg_size);
                            return wg_size;
                        }
                    }

                    return this.to_name(id);
                }
                else if (c.is_used_as_lut)
                    return this.to_name(id);
                else if (type.basetype === SPIRBaseType.Struct && !this.backend.can_declare_struct_inline)
                    return this.to_name(id);
                else if (type.array.length > 0 && !this.backend.can_declare_arrays_inline)
                    return this.to_name(id);
                else
                    return this.constant_expression(c);
            }

            case Types.ConstantOp:
                return this.to_name(id);

            case Types.Variable: {
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

            case Types.CombinedImageSampler:
                // This type should never be taken the expression of directly.
                // The intention is that texture sampling functions will extract the image and samplers
                // separately and take their expressions as needed.
                // GLSL does not use this type because OpSampledImage immediately creates a combined image sampler
                // expression ala sampler2D(texture, sampler).
                throw new Error("Combined image samplers have no default expression representation.");

            case Types.AccessChain:
                // We cannot express this type. They only have meaning in other OpAccessChains, OpStore or OpLoad.
                throw new Error("Access chains have no default expression representation.");

            default:
                return this.to_name(id);
        }
    }

    protected to_composite_constructor_expression(id: number, uses_buffer_offset: boolean): string
    {
        const type = this.expression_type(id);

        const { backend } = this;
        const reroll_array = type.array.length > 0 && (!backend.array_is_value_type || (uses_buffer_offset && !backend.buffer_offset_array_is_value_type));

        if (reroll_array) {
            // For this case, we need to "re-roll" an array initializer from a temporary.
            // We cannot simply pass the array directly, since it decays to a pointer and it cannot
            // participate in a struct initializer. E.g.
            // float arr[2] = { 1.0, 2.0 };
            // Foo foo = { arr }; must be transformed to
            // Foo foo = { { arr[0], arr[1] } };
            // The array sizes cannot be deduced from specialization constants since we cannot use any loops.

            // We're only triggering one read of the array expression, but this is fine since arrays have to be declared
            // as temporaries anyways.
            return this.to_rerolled_array_expression(this.to_enclosed_expression(id), type);
        }
        else
            return this.to_unpacked_expression(id);
    }

    protected to_rerolled_array_expression(base_expr: string, type: SPIRType): string
    {
        const size = this.to_array_size_literal(type);
        const parent = this.get<SPIRType>(SPIRType, type.parent_type);
        let expr = "{ ";

        for (let i = 0; i < size; i++) {
            let subexpr = base_expr + "[" + convert_to_string(i) + "]";
            if (parent.array.length === 0)
                expr += subexpr;
            else
                expr += this.to_rerolled_array_expression(subexpr, parent);

            if (i + 1 < size)
                expr += ", ";
        }

        expr += " }";
        return expr;
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
        const need_transpose = !!e && e.need_transpose;
        const is_remapped = this.has_extended_decoration(id, ExtendedDecorations.PhysicalTypeID);
        const is_packed = this.has_extended_decoration(id, ExtendedDecorations.PhysicalTypePacked);

        if (!need_transpose && (is_remapped || is_packed)) {
            return this.unpack_expression_type(this.to_expression(id, register_expression_read),
                this.get_pointee_type(this.expression_type_id(id)),
                this.get_extended_decoration(id, ExtendedDecorations.PhysicalTypeID),
                this.has_extended_decoration(id, ExtendedDecorations.PhysicalTypePacked), false);
        }
        else
            return this.to_expression(id, register_expression_read);
    }

    protected to_unpacked_row_major_matrix_expression(id: number): string
    {
        return this.unpack_expression_type(this.to_expression(id), this.expression_type(id),
            this.get_extended_decoration(id, ExtendedDecorations.PhysicalTypeID),
            this.has_extended_decoration(id, ExtendedDecorations.PhysicalTypePacked), true);
    }

    protected to_enclosed_unpacked_expression(id: number, register_expression_read: boolean = true): string
    {
        return this.enclose_expression(this.to_unpacked_expression(id, register_expression_read));
    }

    protected to_dereferenced_expression(id: number, register_expression_read: boolean = true): string
    {
        const type = this.expression_type(id);

        if (type.pointer && this.should_dereference(id))
            return this.dereference_expression(type, this.to_enclosed_expression(id, register_expression_read));
        else
            return this.to_expression(id, register_expression_read);
    }

    protected to_pointer_expression(id: number, register_expression_read: boolean = true): string
    {
        const type = this.expression_type(id);

        if (type.pointer && this.expression_is_lvalue(id) && !this.should_dereference(id))
            return this.address_of_expression(this.to_enclosed_expression(id, register_expression_read));
        else
            return this.to_unpacked_expression(id, register_expression_read);
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
        if (this.has_extended_decoration(id, ExtendedDecorations.PhysicalTypePacked))
            return expr + "[" + index + "]";
        else
            return expr + "." + this.index_to_swizzle(index);
    }

    protected to_extract_constant_composite_expression(result_type: number, c: SPIRConstant, chain: Uint32Array | number[], arroffset: number, length: number)
    {
        // It is kinda silly if application actually enters this path since they know the constant up front.
        // It is useful here to extract the plain constant directly.
        const tmp = new SPIRConstant();
        tmp.constant_type = result_type;
        const composite_type = this.get<SPIRType>(SPIRType, c.constant_type);
        console.assert(composite_type.basetype !== SPIRBaseType.Struct && composite_type.array.length === 0);
        console.assert(!c.specialization);

        if (this.is_matrix(composite_type)) {
            if (length === 2) {
                tmp.m.c[0].vecsize = 1;
                tmp.m.columns = 1;
                tmp.m.c[0].r[0] = c.m.c[chain[arroffset]].r[chain[arroffset + 1]];
            }
            else {
                console.assert(length === 1);
                tmp.m.c[0].vecsize = composite_type.vecsize;
                tmp.m.columns = 1;
                tmp.m.c[0] = c.m.c[chain[arroffset]];
            }
        }
        else {
            console.assert(length === 1);
            tmp.m.c[0].vecsize = 1;
            tmp.m.columns = 1;
            tmp.m.c[0].r[0] = c.m.c[0].r[chain[arroffset]];
        }

        return this.constant_expression(tmp);
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
        else if (expr_type.storage === StorageClass.PhysicalStorageBufferEXT && expr_type.basetype !== SPIRBaseType.Struct &&
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
            return expr.substring(1);
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
            !this.has_extended_decoration(type.type_alias, ExtendedDecorations.BufferBlockRepacked)) {
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

    protected to_multi_member_reference(type: SPIRType, indices: number[] | Uint32Array): string
    {
        let ret = "";
        let member_type = type;
        for (let i = 0; i < indices.length; ++i) {
            const index = indices[i];
            ret += "." + this.to_member_name(member_type, index);
            member_type = this.get<SPIRType>(SPIRType, member_type.member_types[index]);
        }
        return ret;
    }

    protected type_to_glsl_constructor(type: SPIRType): string
    {
        const options = this.options;
        const backend = this.backend;
        if (backend.use_array_constructor && type.array.length > 1) {
            if (options.flatten_multidimensional_arrays)
                throw new Error("Cannot flatten constructors of multidimensional array constructors, e.g. float[][]().");
            /*else if (!options.es && options.version < 430)
                this.require_extension_internal("GL_ARB_arrays_of_arrays");*/
            else /*if (options.es && options.version < 310)*/
                throw new Error("Arrays of arrays not supported before ESSL version 310.");
        }

        let e = this.type_to_glsl(type);
        if (backend.use_array_constructor) {
            for (let i = 0; i < type.array.length; i++)
                e += "[]";
        }
        return e;
    }

    protected argument_decl(arg: SPIRFunctionParameter): string
    {
        // glslangValidator seems to make all arguments pointer no matter what which is rather bizarre ...
        const type = this.expression_type(arg.id);
        let direction = "";

        if (type.pointer) {
            if (arg.write_count && arg.read_count)
                direction = "inout ";
            else if (arg.write_count)
                direction = "out ";
        }

        return (direction === "" ? "" : direction + " ") + this.to_qualifiers_glsl(arg.id) + this.variable_decl(type, this.to_name(arg.id), arg.id);
    }

    protected to_qualifiers_glsl(id: number): string
    {
        const ir = this.ir;
        const backend = this.backend;
        const flags = maplike_get(Meta, ir.meta, id).decoration.decoration_flags;
        let res = "";

        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, id);

        if (var_ && var_.storage === StorageClass.Workgroup && !backend.shared_is_implied)
            res += "shared ";

        res += this.to_interpolation_qualifiers(flags);
        if (var_)
            res += this.to_storage_qualifiers_glsl(var_);

        const type = this.expression_type(id);
        if (type.image.dim !== Dim.SubpassData && type.image.sampled === 2) {
            if (flags.get(Decoration.Coherent))
                res += "coherent ";
            if (flags.get(Decoration.Restrict))
                res += "restrict ";

            if (flags.get(Decoration.NonWritable))
                res += "readonly ";

            let formatted_load = type.image.format === ImageFormat.Unknown;
            if (flags.get(Decoration.NonReadable)) {
                res += "writeonly ";
                formatted_load = false;
            }

            if (formatted_load) {
                /*if (!this.options.es)
                    this.require_extension_internal("GL_EXT_shader_image_load_formatted");
                else*/
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
        if (this.has_decoration(type.self, Decoration.Block)) {
            const member_count = type.member_types.length;
            for (let i = 0; i < member_count; i++) {
                if (this.has_member_decoration(type.self, i, Decoration.Patch)) {
                    this.set_decoration(var_.self, Decoration.Patch);
                    break;
                }
            }

            if (this.has_decoration(var_.self, Decoration.Patch))
                for (let i = 0; i < member_count; i++)
                    this.unset_member_decoration(type.self, i, Decoration.Patch);
        }
    }

    protected emit_output_variable_initializer(var_: SPIRVariable)
    {
        const { ir } = this;
        // If a StorageClassOutput variable has an initializer, we need to initialize it in main().
        const entry_func = this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point);
        const type = this.get<SPIRType>(SPIRType, var_.basetype);
        const is_patch = this.has_decoration(var_.self, Decoration.Patch);
        const is_block = this.has_decoration(type.self, Decoration.Block);
        const is_control_point = this.get_execution_model() === ExecutionModel.TessellationControl && !is_patch;

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
                if (this.has_member_decoration(type.self, i, Decoration.BuiltIn)) {
                    if (this.get_member_decoration(type.self, i, Decoration.BuiltIn) === BuiltIn.CullDistance &&
                        !this.cull_distance_count)
                        continue;

                    if (this.get_member_decoration(type.self, i, Decoration.BuiltIn) === BuiltIn.ClipDistance &&
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
                            uint_type.basetype = SPIRBaseType.UInt;
                            uint_type.width = 32;
                            this.set<SPIRType>(SPIRType, ids, uint_type);
                            this.set<SPIRExpression>(SPIRExpression, ids + 1, this.builtin_to_glsl(BuiltIn.InvocationId, StorageClass.Input), ids, true);
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
                            const chain = this.access_chain_internal(var_.self, indices, 0, 2, AccessChainFlagBits.INDEX_IS_LITERAL_BIT, meta);
                            this.statement(chain, " = ", lut_name, "[", j, "];");
                        }
                        else if (is_control_point) {
                            const indices = [ invocation_id, member_index_id ];
                            const chain = this.access_chain_internal(var_.self, indices, 0, 2, 0, meta);
                            this.statement(chain, " = ", lut_name, "[", this.builtin_to_glsl(BuiltIn.InvocationId, StorageClass.Input), "];");
                        }
                        else {
                            const chain = this.access_chain_internal(var_.self, [ i ], 0, 1, AccessChainFlagBits.INDEX_IS_LITERAL_BIT, meta);
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
        else if (this.has_decoration(var_.self, Decoration.BuiltIn) &&
            this.get_decoration(var_.self, Decoration.BuiltIn) === BuiltIn.SampleMask) {
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
        if (use_precision_qualifiers && (type.basetype === SPIRBaseType.Image || type.basetype === SPIRBaseType.SampledImage)) {
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

        if (var_.storage === StorageClass.Input || var_.storage === StorageClass.Output) {
            if (this.is_legacy() && execution.model === ExecutionModel.Vertex)
                return var_.storage === StorageClass.Input ? "attribute " : "varying ";
            else if (this.is_legacy() && execution.model === ExecutionModel.Fragment)
                return "varying "; // Fragment outputs are renamed so they never hit this case.
            else if (execution.model === ExecutionModel.Fragment && var_.storage === StorageClass.Output) {
                const loc = this.get_decoration(var_.self, Decoration.Location);
                const is_inout = this.location_is_framebuffer_fetch(loc);
                if (is_inout)
                    return "inout ";
                else
                    return "out ";
            }
            else
                return var_.storage === StorageClass.Input ? "in " : "out ";
        }
        else if (var_.storage === StorageClass.UniformConstant || var_.storage === StorageClass.Uniform ||
            var_.storage === StorageClass.PushConstant) {
            return "uniform ";
        }
        else if (var_.storage === StorageClass.RayPayloadKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "rayPayloadEXT " : "rayPayloadNV ";
        }
        else if (var_.storage === StorageClass.IncomingRayPayloadKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "rayPayloadInEXT " : "rayPayloadInNV ";
        }
        else if (var_.storage === StorageClass.HitAttributeKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "hitAttributeEXT " : "hitAttributeNV ";
        }
        else if (var_.storage === StorageClass.CallableDataKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "callableDataEXT " : "callableDataNV ";
        }
        else if (var_.storage === StorageClass.IncomingCallableDataKHR) {
            throw new Error("Raytracing not supported");
            // return ray_tracing_is_khr ? "callableDataInEXT " : "callableDataInNV ";
        }

        return "";
    }

    protected flags_to_qualifiers_glsl(type: SPIRType, flags: Bitset)
    {
        // GL_EXT_buffer_reference variables can be marked as restrict.
        if (flags.get(Decoration.RestrictPointerEXT))
            return "restrict ";

        const backend = this.backend;
        const options = this.options;
        let qual = "";

        if (type_is_floating_point(type) && flags.get(Decoration.NoContraction) && backend.support_precise_qualifier)
            qual = "precise ";

        // Structs do not have precision qualifiers, neither do doubles (desktop only anyways, so no mediump/highp).
        const type_supports_precision =
            type.basetype === SPIRBaseType.Float || type.basetype === SPIRBaseType.Int || type.basetype === SPIRBaseType.UInt ||
            type.basetype === SPIRBaseType.Image || type.basetype === SPIRBaseType.SampledImage ||
            type.basetype === SPIRBaseType.Sampler;

        if (!type_supports_precision)
            return qual;

        // if (options.es) {
            const execution = this.get_entry_point();

            if (flags.get(Decoration.RelaxedPrecision)) {
                const implied_fmediump = type.basetype === SPIRBaseType.Float &&
                    options.fragment.default_float_precision === GLSLPrecision.Mediump &&
                    execution.model === ExecutionModel.Fragment;

                const implied_imediump = (type.basetype === SPIRBaseType.Int || type.basetype === SPIRBaseType.UInt) &&
                    options.fragment.default_int_precision === GLSLPrecision.Mediump &&
                    execution.model === ExecutionModel.Fragment;

                qual += (implied_fmediump || implied_imediump) ? "" : "mediump ";
            }
            else {
                const implied_fhighp =
                    type.basetype === SPIRBaseType.Float && ((options.fragment.default_float_precision === GLSLPrecision.Highp &&
                            execution.model === ExecutionModel.Fragment) ||
                        (execution.model !== ExecutionModel.Fragment));

                const implied_ihighp = (type.basetype === SPIRBaseType.Int || type.basetype === SPIRBaseType.UInt) &&
                    ((options.fragment.default_int_precision === GLSLPrecision.Highp &&
                            execution.model === ExecutionModel.Fragment) ||
                        (execution.model !== ExecutionModel.Fragment));

                qual += (implied_fhighp || implied_ihighp) ? "" : "highp ";
            }
        /*}
        else if (backend.allow_precision_qualifiers) {
            // Vulkan GLSL supports precision qualifiers, even in desktop profiles, which is convenient.
            // The default is highp however, so only emit mediump in the rare case that a shader has these.
            if (flags.get(Decoration.RelaxedPrecision))
                qual += "mediump ";
        }*/

        return qual;
    }

    protected format_to_glsl(format: ImageFormat): string
    {
        if (/*this.options.es &&*/ this.is_desktop_only_format(format))
            throw new Error("Attempting to use image format not supported in ES profile.");

        switch (format) {
            case ImageFormat.Rgba32f:
                return "rgba32f";
            case ImageFormat.Rgba16f:
                return "rgba16f";
            case ImageFormat.R32f:
                return "r32f";
            case ImageFormat.Rgba8:
                return "rgba8";
            case ImageFormat.Rgba8Snorm:
                return "rgba8_snorm";
            case ImageFormat.Rg32f:
                return "rg32f";
            case ImageFormat.Rg16f:
                return "rg16f";
            case ImageFormat.Rgba32i:
                return "rgba32i";
            case ImageFormat.Rgba16i:
                return "rgba16i";
            case ImageFormat.R32i:
                return "r32i";
            case ImageFormat.Rgba8i:
                return "rgba8i";
            case ImageFormat.Rg32i:
                return "rg32i";
            case ImageFormat.Rg16i:
                return "rg16i";
            case ImageFormat.Rgba32ui:
                return "rgba32ui";
            case ImageFormat.Rgba16ui:
                return "rgba16ui";
            case ImageFormat.R32ui:
                return "r32ui";
            case ImageFormat.Rgba8ui:
                return "rgba8ui";
            case ImageFormat.Rg32ui:
                return "rg32ui";
            case ImageFormat.Rg16ui:
                return "rg16ui";
            case ImageFormat.R11fG11fB10f:
                return "r11f_g11f_b10f";
            case ImageFormat.R16f:
                return "r16f";
            case ImageFormat.Rgb10A2:
                return "rgb10_a2";
            case ImageFormat.R8:
                return "r8";
            case ImageFormat.Rg8:
                return "rg8";
            case ImageFormat.R16:
                return "r16";
            case ImageFormat.Rg16:
                return "rg16";
            case ImageFormat.Rgba16:
                return "rgba16";
            case ImageFormat.R16Snorm:
                return "r16_snorm";
            case ImageFormat.Rg16Snorm:
                return "rg16_snorm";
            case ImageFormat.Rgba16Snorm:
                return "rgba16_snorm";
            case ImageFormat.R8Snorm:
                return "r8_snorm";
            case ImageFormat.Rg8Snorm:
                return "rg8_snorm";
            case ImageFormat.R8ui:
                return "r8ui";
            case ImageFormat.Rg8ui:
                return "rg8ui";
            case ImageFormat.R16ui:
                return "r16ui";
            case ImageFormat.Rgb10a2ui:
                return "rgb10_a2ui";
            case ImageFormat.R8i:
                return "r8i";
            case ImageFormat.Rg8i:
                return "rg8i";
            case ImageFormat.R16i:
                return "r16i";
            default:
                // case ImageFormat.Unknown:
                return null;
        }
    }

    protected layout_for_member(type: SPIRType, index: number): string
    {
        if (this.is_legacy())
            return "";

        const is_block = this.has_decoration(type.self, Decoration.Block) || this.has_decoration(type.self, Decoration.BufferBlock);
        if (!is_block)
            return "";

        const { ir } = this;
        const memb = maplike_get(Meta, ir.meta, type.self).members;
        if (index >= memb.length)
            return "";
        const dec = memb[index];

        const attr: string[] = [];

        if (this.has_member_decoration(type.self, index, Decoration.PassthroughNV))
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

        if (flags.get(Decoration.RowMajor))
            attr.push("row_major");
        // We don't emit any global layouts, so column_major is default.
        //if (flags & (1ull << DecorationColMajor))
        //    attr.push("column_major");

        if (dec.decoration_flags.get(Decoration.Location) && this.can_use_io_location(type.storage, true))
            attr.push("location = " + dec.location);

        // Can only declare component if we can declare location.
        if (dec.decoration_flags.get(Decoration.Component) && this.can_use_io_location(type.storage, true)) {
            /*if (!options.es) {
                if (options.version < 440 && options.version >= 140)
                    this.require_extension_internal("GL_ARB_enhanced_layouts");
                else if (options.version < 140)
                    throw new Error("Component decoration is not supported in targets below GLSL 1.40.");
                attr.push("component = " + dec.component);
            }
            else*/
                throw new Error("Component decoration is not supported in ES targets.");
        }

        // Packed is set by layout_for_variable earlier to mark that we need to emit offset qualifiers.
        // This is only done selectively in GLSL as needed.
        if (this.has_extended_decoration(type.self, ExtendedDecorations.ExplicitOffset) &&
            dec.decoration_flags.get(Decoration.Offset)) {
            attr.push("offset = " + dec.offset);
        }
        else if (type.storage === StorageClass.Output && dec.decoration_flags.get(Decoration.Offset))
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
        if (flags.get(Decoration.Flat))
            res += "flat ";
        if (flags.get(Decoration.NoPerspective))
            res += "noperspective ";
        if (flags.get(Decoration.Centroid))
            res += "centroid ";
        if (flags.get(Decoration.Patch))
            res += "patch ";
        if (flags.get(Decoration.Sample))
            res += "sample ";
        if (flags.get(Decoration.Invariant))
            res += "invariant ";

        if (flags.get(Decoration.ExplicitInterpAMD)) {
            this.require_extension_internal("GL_AMD_shader_explicit_vertex_parameter");
            res += "__explicitInterpAMD ";
        }

        if (flags.get(Decoration.PerVertexNV)) {
            /*const options = this.options;
            if (options.es && options.version < 320)*/
                throw new Error("pervertexNV requires ESSL 320.");
            /*else if (!options.es && options.version < 450)
                throw new Error("pervertexNV requires GLSL 450.");
            this.require_extension_internal("GL_NV_fragment_shader_barycentric");
            res += "pervertexNV ";*/
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

        if (flags.get(Decoration.PassthroughNV))
            attr.push("passthrough");

        /*if (options.vulkan_semantics && var_.storage === StorageClass.PushConstant)
            attr.push("push_constant");
        else if (var_.storage === StorageClass.ShaderRecordBufferKHR)
            attr.push(ray_tracing_is_khr ? "shaderRecordEXT" : "shaderRecordNV");*/

        if (flags.get(Decoration.RowMajor))
            attr.push("row_major");
        if (flags.get(Decoration.ColMajor))
            attr.push("column_major");

        /*if (options.vulkan_semantics)
        {
            if (flags.get(Decoration.InputAttachmentIndex))
                attr.push("input_attachment_index = " + this.get_decoration(var_.self, DecorationInputAttachmentIndex));
        }*/

        const is_block = this.has_decoration(type.self, Decoration.Block);
        if (flags.get(Decoration.Location) && this.can_use_io_location(var_.storage, is_block)) {
            const combined_decoration = new Bitset();
            const members = maplike_get(Meta, ir.meta, type.self).members;
            for (let i = 0; i < members.length; i++)
                combined_decoration.merge_or(this.combined_decoration_for_member(type, i));

            // If our members have location decorations, we don't need to
            // emit location decorations at the top as well (looks weird).
            if (!combined_decoration.get(Decoration.Location))
                attr.push("location = " + this.get_decoration(var_.self, Decoration.Location));
        }

        if (this.get_execution_model() === ExecutionModel.Fragment && var_.storage === StorageClass.Output &&
            this.location_is_non_coherent_framebuffer_fetch(this.get_decoration(var_.self, Decoration.Location))) {
            attr.push("noncoherent");
        }

        // Transform feedback
        let uses_enhanced_layouts = false;
        if (is_block && var_.storage === StorageClass.Output) {
            // For blocks, there is a restriction where xfb_stride/xfb_buffer must only be declared on the block itself,
            // since all members must match the same xfb_buffer. The only thing we will declare for members of the block
            // is the xfb_offset.
            const member_count = type.member_types.length;
            let have_xfb_buffer_stride = false;
            let have_any_xfb_offset = false;
            let have_geom_stream = false;
            let xfb_stride = 0, xfb_buffer = 0, geom_stream = 0;

            if (flags.get(Decoration.XfbBuffer) && flags.get(Decoration.XfbStride)) {
                have_xfb_buffer_stride = true;
                xfb_buffer = this.get_decoration(var_.self, Decoration.XfbBuffer);
                xfb_stride = this.get_decoration(var_.self, Decoration.XfbStride);
            }

            if (flags.get(Decoration.Stream)) {
                have_geom_stream = true;
                geom_stream = this.get_decoration(var_.self, Decoration.Stream);
            }

            // Verify that none of the members violate our assumption.
            for (let i = 0; i < member_count; i++) {
                if (this.has_member_decoration(type.self, i, Decoration.Stream)) {
                    const member_geom_stream = this.get_member_decoration(type.self, i, Decoration.Stream);
                    if (have_geom_stream && member_geom_stream !== geom_stream)
                        throw new Error("IO block member Stream mismatch.");
                    have_geom_stream = true;
                    geom_stream = member_geom_stream;
                }

                // Only members with an Offset decoration participate in XFB.
                if (!this.has_member_decoration(type.self, i, Decoration.Offset))
                    continue;
                have_any_xfb_offset = true;

                if (this.has_member_decoration(type.self, i, Decoration.XfbBuffer)) {
                    const buffer_index = this.get_member_decoration(type.self, i, Decoration.XfbBuffer);
                    if (have_xfb_buffer_stride && buffer_index !== xfb_buffer)
                        throw new Error("IO block member XfbBuffer mismatch.");
                    have_xfb_buffer_stride = true;
                    xfb_buffer = buffer_index;
                }

                if (this.has_member_decoration(type.self, i, Decoration.XfbStride)) {
                    const stride = this.get_member_decoration(type.self, i, Decoration.XfbStride);
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
                /*if (this.get_execution_model() !== ExecutionModel.Geometry)
                    throw new Error("Geometry streams can only be used in geometry shaders.");
                 if (options.es)*/
                    throw new Error("Multiple geometry streams not supported in ESSL.");
                /*if (options.version < 400)
                    this.require_extension_internal("GL_ARB_transform_feedback3");
                attr.push("stream = " + this.get_decoration(var_.self, Decoration.Stream));*/
            }
        }
        else if (var_.storage === StorageClass.Output) {
            if (flags.get(Decoration.XfbBuffer) && flags.get(Decoration.XfbStride) && flags.get(Decoration.Offset)) {
                // XFB for standalone variables, we can emit all decorations.
                attr.push("xfb_buffer = " + this.get_decoration(var_.self, Decoration.XfbBuffer));
                attr.push("xfb_stride = " + this.get_decoration(var_.self, Decoration.XfbStride));
                attr.push("xfb_offset = " + this.get_decoration(var_.self, Decoration.Offset));
                uses_enhanced_layouts = true;
            }

            if (flags.get(Decoration.Stream)) {
                /*if (this.get_execution_model() !== ExecutionModel.Geometry)
                    throw new Error("Geometry streams can only be used in geometry shaders.");
                if (options.es)*/
                    throw new Error("Multiple geometry streams not supported in ESSL.");
                /*if (options.version < 400)
                    this.require_extension_internal("GL_ARB_transform_feedback3");
                attr.push("stream = " + this.get_decoration(var_.self, Decoration.Stream));*/
            }
        }

        // Can only declare Component if we can declare location.
        if (flags.get(Decoration.Component) && this.can_use_io_location(var_.storage, is_block)) {
            uses_enhanced_layouts = true;
            attr.push("component = " + this.get_decoration(var_.self, Decoration.Component));
        }

        if (uses_enhanced_layouts) {
            /*if (!options.es) {
                if (options.version < 440 && options.version >= 140)
                    this.require_extension_internal("GL_ARB_enhanced_layouts");
                else if (options.version < 140)
                    throw new Error("GL_ARB_enhanced_layouts is not supported in targets below GLSL 1.40.");
                if (!options.es && options.version < 440)
                    this.require_extension_internal("GL_ARB_enhanced_layouts");
            }
            else if (options.es)*/
                throw new Error("GL_ARB_enhanced_layouts is not supported in ESSL.");
        }

        if (flags.get(Decoration.Index))
            attr.push("index = " + this.get_decoration(var_.self, Decoration.Index));

        // Do not emit set = decoration in regular GLSL output, but
        // we need to preserve it in Vulkan GLSL mode.
        /*if (var_.storage !== StorageClass.PushConstant && var_.storage !== StorageClass.ShaderRecordBufferKHR)
        {
            if (flags.get(Decoration.DescriptorSet) && options.vulkan_semantics)
                attr.push(join("set = ", get_decoration(var_.self, Decoration.DescriptorSet)));
        }*/

        const push_constant_block = false; //options.vulkan_semantics && var_.storage ===StorageClass.PushConstant;
        const ssbo_block = var_.storage === StorageClass.StorageBuffer || var_.storage === StorageClass.ShaderRecordBufferKHR ||
            (var_.storage === StorageClass.Uniform && typeflags.get(Decoration.BufferBlock));
        const emulated_ubo = var_.storage === StorageClass.PushConstant && options.emit_push_constant_as_uniform_buffer;
        const ubo_block = var_.storage === StorageClass.Uniform && typeflags.get(Decoration.Block);

        // GL 3.0/GLSL 1.30 is not considered legacy, but it doesn't have UBOs ...
        let can_use_buffer_blocks = (/*options.es &&*/ options.version >= 300)/* || (!options.es && options.version >= 140)*/;

        // pretend no UBOs when options say so
        if (ubo_block && options.emit_uniform_buffer_as_plain_uniforms)
            can_use_buffer_blocks = false;

        let can_use_binding: boolean;
        // if (options.es)
            can_use_binding = options.version >= 310;
        /*else
            can_use_binding = options.enable_420pack_extension || (options.version >= 420);*/

        // Make sure we don't emit binding layout for a classic uniform on GLSL 1.30.
        if (!can_use_buffer_blocks && var_.storage === StorageClass.Uniform)
            can_use_binding = false;

        if (var_.storage === StorageClass.ShaderRecordBufferKHR)
            can_use_binding = false;

        if (can_use_binding && flags.get(Decoration.Binding))
            attr.push("binding = " + this.get_decoration(var_.self, Decoration.Binding));

        if (var_.storage !== StorageClass.Output && flags.get(Decoration.Offset)) {
            attr.push("offset = " + this.get_decoration(var_.self, Decoration.Offset));
        }

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
        if (type.basetype === SPIRBaseType.Image && type.image.sampled === 2) {
            const fmt = this.format_to_glsl(type.image.format);
            if (fmt)
                attr.push(fmt);
        }

        if (attr.length === 0)
            return "";

        return "layout(" + attr.join(", ") + ") ";
    }

    protected to_combined_image_sampler(image_id: VariableID, samp_id: VariableID): string
    {
// Keep track of the array indices we have used to load the image.
        // We'll need to use the same array index into the combined image sampler array.
        const image_expr = this.to_non_uniform_aware_expression(image_id);
        let array_expr = "";
        const array_index = image_expr.indexOf("[");
        if (array_index >= 0)
            array_expr = image_expr.substring(array_index);

        const args = this.current_function.arguments;

        // For GLSL and ESSL targets, we must enumerate all possible combinations for sampler2D(texture2D, sampler) and redirect
        // all possible combinations into new sampler2D uniforms.
        const image = this.maybe_get_backing_variable(image_id);
        const samp = this.maybe_get_backing_variable(samp_id);
        if (image)
            image_id = image.self;
        if (samp)
            samp_id = samp.self;

        const image_itr = args.find(param => image_id === param.id);
        const sampler_itr = args.find(param => samp_id === param.id);

        if (image_itr || sampler_itr) {
            // If any parameter originates from a parameter, we will find it in our argument list.
            const global_image = !image_itr;
            const global_sampler = !sampler_itr;
            const iid = global_image ? image_id : <VariableID>(args.indexOf(image_itr));
            const sid = global_sampler ? samp_id : <VariableID>(args.indexOf(sampler_itr));

            const combined = this.current_function.combined_parameters;
            const itr = combined.find(p => p.global_image === global_image && p.global_sampler === global_sampler && p.image_id === iid && p.sampler_id === sid);

            if (itr)
                return this.to_expression(itr.id) + array_expr;
            else {
                throw new Error("Cannot find mapping for combined sampler parameter, was build_combined_image_samplers() used before compile() was called?");
            }
        }
        else {
            // For global sampler2D, look directly at the global remapping table.
            const mapping = this.combined_image_samplers;
            const itr = mapping.find(combined => combined.image_id === image_id && combined.sampler_id === samp_id);

            if (itr)
                return this.to_expression(itr.combined_id) + array_expr;
            else {
                throw new Error("Cannot find mapping for combined sampler, was build_combined_image_samplers() used before compile() was called?");
            }
        }
    }

    protected skip_argument(id: number): boolean
    {
        // if (!combined_image_samplers.empty() || !options.vulkan_semantics)
        // {
        const type = this.expression_type(id);
        if (type.basetype === SPIRBaseType.Sampler || (type.basetype === SPIRBaseType.Image && type.image.sampled === 1))
            return true;
        // }
        return false;
    }

    protected emit_array_copy(lhs: string, _: number, rhs_id: number, __: StorageClass, ___: StorageClass)
    {
        this.statement(lhs, " = ", this.to_expression(rhs_id), ";");
    }

    protected emit_block_hints(block: SPIRBlock)
    {
        // const { options } = this;
        // if ((options.es && options.version < 310) || (!options.es && options.version < 140))
            return;

        /*switch (block.hint) {
            case SPIRBlockHints.Flatten:
                this.require_extension_internal("GL_EXT_control_flow_attributes");
                this.statement("SPIRV_CROSS_FLATTEN");
                break;
            case SPIRBlockHints.DontFlatten:
                this.require_extension_internal("GL_EXT_control_flow_attributes");
                this.statement("SPIRV_CROSS_BRANCH");
                break;
            case SPIRBlockHints.Unroll:
                this.require_extension_internal("GL_EXT_control_flow_attributes");
                this.statement("SPIRV_CROSS_UNROLL");
                break;
            case SPIRBlockHints.DontUnroll:
                this.require_extension_internal("GL_EXT_control_flow_attributes");
                this.statement("SPIRV_CROSS_LOOP");
                break;
            default:
                break;
        }*/
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

    protected buffer_is_packing_standard(type: SPIRType, packing: BufferPackingStandard, failed_validation_index: number[] = null, start_offset: number = 0, end_offset: number = undefined): boolean
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

        const is_top_level_block = this.has_decoration(type.self, Decoration.Block) || this.has_decoration(type.self, Decoration.BufferBlock);
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
            if (end_offset !== undefined && actual_offset >= end_offset)
                break;

            const alignment = Math.max(packed_alignment, pad_alignment);
            offset = (offset + alignment - 1) & ~(alignment - 1);

            // The next member following a struct member is aligned to the base alignment of the struct that came before.
            // GL 4.5 spec, 7.6.2.2.
            if (memb_type.basetype === SPIRBaseType.Struct && !memb_type.pointer)
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
                if (memb_type.array.length > 0 && this.type_to_packed_array_stride(memb_type, member_flags, packing) !=
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
        if (support_std430_without_scalar_layout && this.buffer_is_packing_standard(type, BufferPackingStandard.Std430))
            return "std430";
        else if (this.buffer_is_packing_standard(type, BufferPackingStandard.Std140))
            return "std140";
        /*else if (options.vulkan_semantics && buffer_is_packing_standard(type, PackingScalar))
        {
            require_extension_internal("GL_EXT_scalar_block_layout");
            return "scalar";
        }*/
        /*else if (support_std430_without_scalar_layout &&
            this.buffer_is_packing_standard(type, BufferPackingStandard.Std430EnhancedLayout)) {
            if (options.es && !options.vulkan_semantics)
                throw new Error("Push constant block cannot be expressed as neither std430 nor std140. ES-targets do not support GL_ARB_enhanced_layouts.");
            if (!options.es && !options.vulkan_semantics && options.version < 440)
                this.require_extension_internal("GL_ARB_enhanced_layouts");

            this.set_extended_decoration(type.self, ExtendedDecorations.ExplicitOffset);
            return "std430";
        }
        else if (this.buffer_is_packing_standard(type, BufferPackingStandard.Std140EnhancedLayout)) {
            // Fallback time. We might be able to use the ARB_enhanced_layouts to deal with this difference,
            // however, we can only use layout(offset) on the block itself, not any substructs, so the substructs better be the appropriate layout.
            // Enhanced layouts seem to always work in Vulkan GLSL, so no need for extensions there.
            if (options.es && !options.vulkan_semantics)
                throw new Error("Push constant block cannot be expressed as neither std430 nor std140. ES-targets do not support GL_ARB_enhanced_layouts.");
            if (!options.es && !options.vulkan_semantics && options.version < 440)
                this.require_extension_internal("GL_ARB_enhanced_layouts");

            this.set_extended_decoration(type.self, ExtendedDecorations.ExplicitOffset);
            return "std140";
        }*/
            /*else if (options.vulkan_semantics && buffer_is_packing_standard(type, BufferPackingStandard.PackingScalarEnhancedLayout))
            {
                set_extended_decoration(type.self, ExplicitOffset);
                require_extension_internal("GL_EXT_scalar_block_layout");
                return "scalar";
            }*/
            /*else if (!support_std430_without_scalar_layout && options.vulkan_semantics &&
                buffer_is_packing_standard(type, Std430))
            {
                // UBOs can support std430 with GL_EXT_scalar_block_layout.
                require_extension_internal("GL_EXT_scalar_block_layout");
                return "std430";
            }*/
        /*else if (!support_std430_without_scalar_layout && options.vulkan_semantics &&
            buffer_is_packing_standard(type, Std430EnhancedLayout))
        {
            // UBOs can support std430 with GL_EXT_scalar_block_layout.
            set_extended_decoration(type.self, ExplicitOffset);
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
            case SPIRBaseType.Double:
            case SPIRBaseType.Int64:
            case SPIRBaseType.UInt64:
                return 8;
            case SPIRBaseType.Float:
            case SPIRBaseType.Int:
            case SPIRBaseType.UInt:
                return 4;
            case SPIRBaseType.Half:
            case SPIRBaseType.Short:
            case SPIRBaseType.UShort:
                return 2;
            case SPIRBaseType.SByte:
            case SPIRBaseType.UByte:
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
        if (type.storage === StorageClass.PhysicalStorageBufferEXT) {
            if (!type.pointer)
                throw new Error("Types in PhysicalStorageBufferEXT must be pointers.");

            if (ir.addressing_model === AddressingModel.PhysicalStorageBuffer64EXT) {
                if (packing_is_vec4_padded(packing) && this.type_is_array_of_pointers(type))
                    return 16;
                else
                    return 8;
            }
            else
                throw new Error("PhysicalStorageBuffer64EXT must be used for PhysicalStorageBufferEXT.");
        }

        if (type.array.length) {
            let minimum_alignment = 1;
            if (packing_is_vec4_padded(packing))
                minimum_alignment = 16;

            let tmp = this.get<SPIRType>(SPIRType, type.parent_type);
            while (tmp.array.length)
                tmp = this.get<SPIRType>(SPIRType, tmp.parent_type);

            // Get the alignment of the base type, then maybe round up.
            return Math.max(minimum_alignment, this.type_to_packed_alignment(tmp, flags, packing));
        }

        if (type.basetype === SPIRBaseType.Struct) {
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
            if (flags.get(Decoration.ColMajor) && type.columns > 1) {
                if (packing_is_vec4_padded(packing))
                    return 4 * base_alignment;
                else if (type.vecsize === 3)
                    return 4 * base_alignment;
                else
                    return type.vecsize * base_alignment;
            }

            // Rule 6 implied.

            // Rule 7.
            if (flags.get(Decoration.RowMajor) && type.vecsize > 1) {
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
            /*if (packing_is_hlsl(packing) && type.basetype !== SPIRBaseType.Struct)
                packed_size -= (4 - type.vecsize) * (type.width / 8);*/

            return packed_size;
        }

        const { ir } = this;

        // If using PhysicalStorageBufferEXT storage class, this is a pointer,
        // and is 64-bit.
        if (type.storage === StorageClass.PhysicalStorageBufferEXT) {
            if (!type.pointer)
                throw new Error("Types in PhysicalStorageBufferEXT must be pointers.");

            if (ir.addressing_model === AddressingModel.PhysicalStorageBuffer64EXT)
                return 8;
            else
                throw new Error("PhysicalStorageBuffer64EXT must be used for PhysicalStorageBufferEXT.");
        }

        let size = 0;

        if (type.basetype === SPIRBaseType.Struct) {
            let pad_alignment = 1;

            for (let i = 0; i < type.member_types.length; i++) {
                const member_flags = maplike_get(Meta, ir.meta, type.self).members[i].decoration_flags;
                const member_type = this.get<SPIRType>(SPIRType, type.member_types[i]);

                const packed_alignment = this.type_to_packed_alignment(member_type, member_flags, packing);
                const alignment = Math.max(packed_alignment, pad_alignment);

                // The next member following a struct member is aligned to the base alignment of the struct that came before.
                // GL 4.5 spec, 7.6.2.2.
                if (member_type.basetype === SPIRBaseType.Struct)
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

                if (flags.get(Decoration.ColMajor) && type.columns > 1) {
                    if (packing_is_vec4_padded(packing))
                        size = type.columns * 4 * base_alignment;
                    else if (type.vecsize === 3)
                        size = type.columns * 4 * base_alignment;
                    else
                        size = type.columns * type.vecsize * base_alignment;
                }

                if (flags.get(Decoration.RowMajor) && type.vecsize > 1) {
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

        console.assert(out_type.basetype !== SPIRBaseType.Boolean);
        console.assert(in_type.basetype !== SPIRBaseType.Boolean);

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
        if (out_type.basetype === SPIRBaseType.UInt && in_type.basetype === SPIRBaseType.Float) {
            if (this.is_legacy_es())
                throw new Error("Float -> Uint bitcast not supported on legacy ESSL.");
            /*else if (!options.es && options.version < 330)
                this.require_extension_internal("GL_ARB_shader_bit_encoding");*/
            return "floatBitsToUint";
        }
        else if (out_type.basetype === SPIRBaseType.Int && in_type.basetype === SPIRBaseType.Float) {
            if (this.is_legacy_es())
                throw new Error("Float -> Int bitcast not supported on legacy ESSL.");
            /*else if (!options.es && options.version < 330)
                this.require_extension_internal("GL_ARB_shader_bit_encoding");*/
            return "floatBitsToInt";
        }
        else if (out_type.basetype === SPIRBaseType.Float && in_type.basetype === SPIRBaseType.UInt) {
            if (this.is_legacy_es())
                throw new Error("Uint -> Float bitcast not supported on legacy ESSL.");
            /*else if (!options.es && options.version < 330)
                this.require_extension_internal("GL_ARB_shader_bit_encoding");*/
            return "uintBitsToFloat";
        }
        else if (out_type.basetype === SPIRBaseType.Float && in_type.basetype === SPIRBaseType.Int) {
            if (this.is_legacy_es())
                throw new Error("Int -> Float bitcast not supported on legacy ESSL.");
            /*else if (!options.es && options.version < 330)
                this.require_extension_internal("GL_ARB_shader_bit_encoding");*/
            return "intBitsToFloat";
        }

        else if (out_type.basetype === SPIRBaseType.Int64 && in_type.basetype === SPIRBaseType.Double)
            return "doubleBitsToInt64";
        else if (out_type.basetype === SPIRBaseType.UInt64 && in_type.basetype === SPIRBaseType.Double)
            return "doubleBitsToUint64";
        else if (out_type.basetype === SPIRBaseType.Double && in_type.basetype === SPIRBaseType.Int64)
            return "int64BitsToDouble";
        else if (out_type.basetype === SPIRBaseType.Double && in_type.basetype === SPIRBaseType.UInt64)
            return "uint64BitsToDouble";
        else if (out_type.basetype === SPIRBaseType.Short && in_type.basetype === SPIRBaseType.Half)
            return "float16BitsToInt16";
        else if (out_type.basetype === SPIRBaseType.UShort && in_type.basetype === SPIRBaseType.Half)
            return "float16BitsToUint16";
        else if (out_type.basetype === SPIRBaseType.Half && in_type.basetype === SPIRBaseType.Short)
            return "int16BitsToFloat16";
        else if (out_type.basetype === SPIRBaseType.Half && in_type.basetype === SPIRBaseType.UShort)
            return "uint16BitsToFloat16";

        // And finally, some even more special purpose casts.
        if (out_type.basetype === SPIRBaseType.UInt64 && in_type.basetype === SPIRBaseType.UInt && in_type.vecsize === 2)
            return "packUint2x32";
        else if (out_type.basetype === SPIRBaseType.UInt && in_type.basetype === SPIRBaseType.UInt64 && out_type.vecsize === 2)
            return "unpackUint2x32";
        else if (out_type.basetype === SPIRBaseType.Half && in_type.basetype === SPIRBaseType.UInt && in_type.vecsize === 1)
            return "unpackFloat2x16";
        else if (out_type.basetype === SPIRBaseType.UInt && in_type.basetype === SPIRBaseType.Half && in_type.vecsize === 2)
            return "packFloat2x16";
        else if (out_type.basetype === SPIRBaseType.Int && in_type.basetype === SPIRBaseType.Short && in_type.vecsize === 2)
            return "packInt2x16";
        else if (out_type.basetype === SPIRBaseType.Short && in_type.basetype === SPIRBaseType.Int && in_type.vecsize === 1)
            return "unpackInt2x16";
        else if (out_type.basetype === SPIRBaseType.UInt && in_type.basetype === SPIRBaseType.UShort && in_type.vecsize === 2)
            return "packUint2x16";
        else if (out_type.basetype === SPIRBaseType.UShort && in_type.basetype === SPIRBaseType.UInt && in_type.vecsize === 1)
            return "unpackUint2x16";
        else if (out_type.basetype === SPIRBaseType.Int64 && in_type.basetype === SPIRBaseType.Short && in_type.vecsize === 4)
            return "packInt4x16";
        else if (out_type.basetype === SPIRBaseType.Short && in_type.basetype === SPIRBaseType.Int64 && in_type.vecsize === 1)
            return "unpackInt4x16";
        else if (out_type.basetype === SPIRBaseType.UInt64 && in_type.basetype === SPIRBaseType.UShort && in_type.vecsize === 4)
            return "packUint4x16";
        else if (out_type.basetype === SPIRBaseType.UShort && in_type.basetype === SPIRBaseType.UInt64 && in_type.vecsize === 1)
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

    protected bitcast_expression(target_type: SPIRBaseType, args: number): string
    protected bitcast_expression(target_type: SPIRType, expr_type: SPIRBaseType, expr: string): string
    protected bitcast_expression(target_type: SPIRType | SPIRBaseType, arg: SPIRBaseType | number, expr?: string): string
    {
        if (expr === undefined) {
            // first overload
            target_type = <SPIRBaseType>target_type;
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
            const expr_type = <SPIRBaseType>arg;
            // second overload
            if (target_type.basetype === expr_type)
                return expr;

            const src_type = target_type;
            src_type.basetype = expr_type;
            return this.bitcast_glsl_op(target_type, src_type) + "(" + expr + ")";
        }

    }

    protected build_composite_combiner(return_type: number, elems: Array<number> | Uint32Array, arroffset: number, length: number): string
    {
        let base: ID = 0;
        let op = "";
        let subop = "";

        // Can only merge swizzles for vectors.
        const type = this.get<SPIRType>(SPIRType, return_type);
        const can_apply_swizzle_opt = type.basetype !== SPIRBaseType.Struct && type.array.length === 0 && type.columns === 1;
        let swizzle_optimization = false;

        const { backend } = this;

        for (let i = 0; i < length; i++) {
            const e = this.maybe_get<SPIRExpression>(SPIRExpression, elems[i + arroffset]);

            // If we're merging another scalar which belongs to the same base
            // object, just merge the swizzles to avoid triggering more than 1 expression read as much as possible!
            if (can_apply_swizzle_opt && e && e.base_expression && e.base_expression === base) {
                // Only supposed to be used for vector swizzle -> scalar.
                console.assert(e.expression !== "" && e.expression.charAt(0) === ".");
                subop += e.expression.substring(1);
                swizzle_optimization = true;
            }
            else {
                // We'll likely end up with duplicated swizzles, e.g.
                // foobar.xyz.xyz from patterns like
                // OpVectorShuffle
                // OpCompositeExtract x 3
                // OpCompositeConstruct 3x + other scalar.
                // Just modify op in-place.
                if (swizzle_optimization) {
                    if (backend.swizzle_is_function)
                        subop += "()";

                    // Don't attempt to remove unity swizzling if we managed to remove duplicate swizzles.
                    // The base "foo" might be vec4, while foo.xyz is vec3 (OpVectorShuffle) and looks like a vec3 due to the .xyz tacked on.
                    // We only want to remove the swizzles if we're certain that the resulting base will be the same vecsize.
                    // Essentially, we can only remove one set of swizzles, since that's what we have control over ...
                    // Case 1:
                    //  foo.yxz.xyz: Duplicate swizzle kicks in, giving foo.yxz, we are done.
                    //               foo.yxz was the result of OpVectorShuffle and we don't know the type of foo.
                    // Case 2:
                    //  foo.xyz: Duplicate swizzle won't kick in.
                    //           If foo is vec3, we can remove xyz, giving just foo.
                    subop = this.remove_duplicate_swizzle(subop) || this.remove_unity_swizzle(base, subop) || subop;

                    // Strips away redundant parens if we created them during component extraction.
                    subop = this.strip_enclosed_expression(subop);
                    swizzle_optimization = false;
                    op += subop;
                }
                else
                    op += subop;

                if (i)
                    op += ", ";

                const uses_buffer_offset = type.basetype === SPIRBaseType.Struct && this.has_member_decoration(type.self, i, Decoration.Offset);
                subop = this.to_composite_constructor_expression(elems[i + arroffset], uses_buffer_offset);
            }

            base = e ? e.base_expression : <ID>(0);
        }

        if (swizzle_optimization) {
            if (backend.swizzle_is_function)
                subop += "()";

            subop = this.remove_duplicate_swizzle(subop) || this.remove_unity_swizzle(base, subop) || subop;

            // Strips away redundant parens if we created them during component extraction.
            subop = this.strip_enclosed_expression(subop);
        }

        op += subop;
        return op;
    }


    protected remove_duplicate_swizzle(op: string): string
    {
        const pos = op.lastIndexOf(".");
        // either not present, or the first
        if (pos <= 0)
            return null;

        const final_swiz = op.substring(pos + 1);

        if (this.backend.swizzle_is_function) {
            if (final_swiz.length < 2)
                return null;

            if (final_swiz.substring(final_swiz.length - 2) === "()")
                final_swiz.substring(0, final_swiz.length - 2);
            else
                return null;
        }

        // Check if final swizzle is of form .x, .xy, .xyz, .xyzw or similar.
        // If so, and previous swizzle is of same length,
        // we can drop the final swizzle altogether.
        for (let i = 0; i < final_swiz.length; i++) {

            if (i >= 4 || final_swiz[i] !== expectedVecComps[i])
                return null;
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

                return null;
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

    // Optimizes away vector swizzles where we have something like
    // vec3 foo;
    // foo.xyz <-- swizzle expression does nothing.
    // This is a very common pattern after OpCompositeCombine.
    protected remove_unity_swizzle(base: number, op: string): string
    {
        const pos = op.indexOf(".");
        // either not found or first char
        if (pos <= 0)
            return null;

        let final_swiz = op.substring(pos + 1);

        if (this.backend.swizzle_is_function) {
            if (final_swiz.length < 2)
                return null;

            if (final_swiz.substring(final_swiz.length - 2) === "()")
                final_swiz = final_swiz.substring(0, final_swiz.length - 2);
            else
                return null;
        }

        // Check if final swizzle is of form .x, .xy, .xyz, .xyzw or similar.
        // If so, and previous swizzle is of same length,
        // we can drop the final swizzle altogether.
        for (let i = 0; i < final_swiz.length; i++) {
            if (i >= 4 || final_swiz[i] !== expectedVecComps[i])
                return null;
        }

        const type = this.expression_type(base);

        // Sanity checking ...
        console.assert(type.columns === 1 && type.array.length === 0);

        if (type.vecsize === final_swiz.length)
            op = op.substring(0, pos);

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

    protected emit_entry_point_declarations()
    {
    }

    protected replace_fragment_output(var_: SPIRVariable)
    {
        const ir = this.ir;
        const m = maplike_get(Meta, ir.meta, var_.self).decoration;
        let location = 0;
        if (m.decoration_flags.get(Decoration.Location))
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

            if (!this.is_builtin_variable(var_) && !var_.remapped_variable && type.pointer && var_.storage === StorageClass.Output)
                this.replace_fragment_output(var_);
        });
    }

    protected legacy_tex_op(op: string, imgtype: SPIRType, tex: number): string
    {
        let type: string;

        switch (imgtype.image.dim) {
            case Dim.Dim1D:
                // type = (imgtype.image.arrayed && !options.es) ? "1DArray" : "1D";
                type = "1D";
                break;
            case Dim.Dim2D:
                // type = (imgtype.image.arrayed && !options.es) ? "2DArray" : "2D";
                type = "2D";
                break;
            case Dim.Dim3D:
                type = "3D";
                break;
            case Dim.Cube:
                type = "Cube";
                break;
            case Dim.Rect:
                type = "2DRect";
                break;
            case Dim.Buffer:
                type = "Buffer";
                break;
            case Dim.SubpassData:
                type = "2D";
                break;
            default:
                type = "";
                break;
        }

        // In legacy GLSL, an extension is required for textureLod in the fragment
        // shader or textureGrad anywhere.
        let legacy_lod_ext = false;
        const execution = this.get_entry_point();
        if (op === "textureGrad" || op === "textureProjGrad" ||
            ((op === "textureLod" || op === "textureProjLod") && execution.model !== ExecutionModel.Vertex)) {
            if (this.is_legacy_es()) {
                legacy_lod_ext = true;
                this.require_extension_internal("GL_EXT_shader_texture_lod");
            }
            /*else if (this.is_legacy_desktop())
                this.require_extension_internal("GL_ARB_shader_texture_lod");*/
        }

        if (op === "textureLodOffset" || op === "textureProjLodOffset") {
            if (this.is_legacy_es())
                throw new Error(op + " not allowed in legacy ES");

            this.require_extension_internal("GL_EXT_gpu_shader4");
        }

        // GLES has very limited support for shadow samplers.
        // Basically shadow2D and shadow2DProj work through EXT_shadow_samplers,
        // everything else can just throw
        const is_comparison = this.is_depth_image(imgtype, tex);
        if (is_comparison && this.is_legacy_es()) {
            if (op === "texture" || op === "textureProj")
                this.require_extension_internal("GL_EXT_shadow_samplers");
            else
                throw new Error(op + " not allowed on depth samplers in legacy ES");
        }

        if (op === "textureSize") {
            if (this.is_legacy_es())
                throw new Error("textureSize not supported in legacy ES");
            if (is_comparison)
                throw new Error("textureSize not supported on shadow sampler in legacy GLSL");
            this.require_extension_internal("GL_EXT_gpu_shader4");
        }

        if (op === "texelFetch" && this.is_legacy_es())
            throw new Error("texelFetch not supported in legacy ES");

        const is_es_and_depth = this.is_legacy_es() && is_comparison;
        const type_prefix = is_comparison ? "shadow" : "texture";

        if (op === "texture")
            return is_es_and_depth ? type_prefix + type + "EXT" : type_prefix + type;
        else if (op === "textureLod")
            return type_prefix + type + legacy_lod_ext ? "LodEXT" : "Lod";
        else if (op === "textureProj")
            return type_prefix + type + is_es_and_depth ? "ProjEXT" : "Proj";
        else if (op === "textureGrad")
            return type_prefix + type + this.is_legacy_es() ? "GradEXT" : /*this.is_legacy_desktop() ? "GradARB" : */"Grad";
        else if (op === "textureProjLod")
            return type_prefix + type + legacy_lod_ext ? "ProjLodEXT" : "ProjLod";
        else if (op === "textureLodOffset")
            return type_prefix + type + "LodOffset";
        else if (op === "textureProjGrad")
            return type_prefix + type + this.is_legacy_es() ? "ProjGradEXT" : /*this.is_legacy_desktop() ? "ProjGradARB" :*/ "ProjGrad";
        else if (op === "textureProjLodOffset")
            return type_prefix + type + "ProjLodOffset";
        else if (op === "textureSize")
            return "textureSize" + type;
        else if (op === "texelFetch")
            return "texelFetch" + type;
        else {
            throw new Error("Unsupported legacy texture op: " + op);
        }
    }

    protected load_flattened_struct(basename: string, type: SPIRType): string
    {
        let expr = this.type_to_glsl_constructor(type);
        expr += "(";

        for (let i = 0; i < type.member_types.length; i++) {
            if (i)
                expr += ", ";

            let member_type = this.get<SPIRType>(SPIRType, type.member_types[i]);
            if (member_type.basetype === SPIRBaseType.Struct)
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

    protected store_flattened_struct(lhs_id: number, value: number);
    protected store_flattened_struct(basename: string, rhs: number, type: SPIRType, indices: Array<number> | Uint32Array);
    protected store_flattened_struct(basename: string | number, rhs_id: number, type?: SPIRType, indices?: Array<number> | Uint32Array)
    {
        if (typeof basename === "number") {
            const lhs_id = basename;
            const value = rhs_id;
            const type = this.expression_type(lhs_id);
            const basename_ = this.to_flattened_access_chain_expression(lhs_id);
            this.store_flattened_struct(basename_, value, type, []);
            return;
        }

        const sub_indices = Array.from(indices);
        sub_indices.push(0);

        let member_type = type;
        for (let i = 0; i < indices.length; ++i) {
            const index = indices[i];
            member_type = this.get<SPIRType>(SPIRType, member_type.member_types[index]);
        }

        for (let i = 0; i < member_type.member_types.length; i++) {
            sub_indices[sub_indices.length - 1] = i;
            const lhs = ParsedIR.sanitize_underscores(basename + "_" + this.to_member_name(member_type, i));

            if (this.get<SPIRType>(SPIRType, member_type.member_types[i]).basetype === SPIRBaseType.Struct) {
                this.store_flattened_struct(lhs, rhs_id, type, sub_indices);
            }
            else {
                const rhs = this.to_expression(rhs_id) + this.to_multi_member_reference(type, sub_indices);
                this.statement(lhs, " = ", rhs, ";");
            }
        }
    }

    protected to_flattened_access_chain_expression(id: number): string
    {
        // Do not use to_expression as that will unflatten access chains.
        let basename;
        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, id);
        if (var_)
            basename = this.to_name(var_.self);
        else {
            const expr = this.maybe_get<SPIRExpression>(SPIRExpression, id);
            if (expr)
                basename = expr.expression;
            else
                basename = this.to_expression(id);
        }

        return basename;
    }

    protected track_expression_read(id: number)
    {
        const ir = this.ir;
        switch (ir.ids[id].get_type()) {
            case Types.Expression: {
                const e = this.get<SPIRExpression>(SPIRExpression, id);
                for (let implied_read of e.implied_read_expressions)
                    this.track_expression_read(implied_read);
                break;
            }

            case Types.AccessChain: {
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

    protected request_workaround_wrapper_overload(id: TypeID)
    {

        // Must be ordered to maintain deterministic output, so vector is appropriate.
        if (this.workaround_ubo_load_overload_types.indexOf(id) < 0) {
            this.force_recompile();
            this.workaround_ubo_load_overload_types.push(id);
        }
    }

    protected rewrite_load_for_wrapped_row_major(expr: string, loaded_type: TypeID, ptr: ID): string
    {
        // Loading row-major matrices from UBOs on older AMD Windows OpenGL drivers is problematic.
        // To load these types correctly, we must first wrap them in a dummy function which only purpose is to
        // ensure row_major decoration is actually respected.
        const var_ = this.maybe_get_backing_variable(ptr);
        if (!var_)
            return expr;

        const backing_type = this.get<SPIRType>(SPIRType, var_.basetype);
        const is_ubo = backing_type.basetype === SPIRBaseType.Struct && backing_type.storage === StorageClass.Uniform &&
            this.has_decoration(backing_type.self, Decoration.Block);
        if (!is_ubo)
            return expr;

        let type = this.get<SPIRType>(SPIRType, loaded_type);
        let rewrite = false;

        if (this.is_matrix(type)) {
            // To avoid adding a lot of unnecessary meta tracking to forward the row_major state,
            // we will simply look at the base struct itself. It is exceptionally rare to mix and match row-major/col-major state.
            // If there is any row-major action going on, we apply the workaround.
            // It is harmless to apply the workaround to column-major matrices, so this is still a valid solution.
            // If an access chain occurred, the workaround is not required, so loading vectors or scalars don't need workaround.
            type = backing_type;
        }

        if (type.basetype === SPIRBaseType.Struct) {
            // If we're loading a struct where any member is a row-major matrix, apply the workaround.
            for (let i = 0; i < type.member_types.length; i++) {
                if (this.combined_decoration_for_member(type, i).get(Decoration.RowMajor)) {
                    rewrite = true;
                    break;
                }
            }
        }

        if (rewrite) {
            this.request_workaround_wrapper_overload(loaded_type);
            expr = "spvWorkaroundRowMajor(" + expr + ")";
        }

        return expr;
    }

    protected is_legacy(): boolean
    {
        const options = this.options;
        // return (options.es && options.version < 300) || (!options.es && options.version < 130);
        return options.version < 300;
    }

    protected is_legacy_es(): boolean
    {
        const options = this.options;
        return options.version < 300;
    }

    /*protected is_legacy_desktop(): boolean
    {
        return false;
        // const options = this.options;
        // return !options.es && options.version < 130;
    }*/

    protected register_impure_function_call()
    {
        // Impure functions can modify globals and aliased variables, so invalidate them as well.
        for (const global of this.global_variables)
            this.flush_dependees(this.get<SPIRVariable>(SPIRVariable, global));
        for (const aliased of this.aliased_variables)
            this.flush_dependees(this.get<SPIRVariable>(SPIRVariable, aliased));
    }

    protected register_control_dependent_expression(expr: number)
    {
        if (!this.forwarded_temporaries.has(expr))
            return;

        console.assert(this.current_emitting_block);
        this.current_emitting_block.invalidate_expressions.push(expr);
    }

    protected args_will_forward(id: number, args: Uint32Array | number[], arroffset: number, num_args: number, pure: boolean): boolean
    {
        if (this.forced_temporaries.has(id))
            return false;

        for (let i = 0; i < num_args; i++)
            if (!this.should_forward(args[i + arroffset]))
                return false;

        // We need to forward globals as well.
        if (!pure) {
            for (let global of this.global_variables)
                if (!this.should_forward(global))
                    return false;
            for (let aliased of this.aliased_variables)
                if (!this.should_forward(aliased))
                    return false;
        }

        return true;
    }

    protected register_call_out_argument(id: number)
    {
        this.register_write(id);

        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, id);
        if (var_)
            this.flush_variable_declaration(var_.self);
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
        if (flags.get(Decoration.RelaxedPrecision))
            return "mediump ";
        else
            return "highp ";
    }

    protected emit_pls()
    {
        const execution = this.get_entry_point();
        const options = this.options;

        if (execution.model !== ExecutionModel.Fragment)
            throw new Error("Pixel local storage only supported in fragment shaders.");

        /*if (!options.es)
            throw new Error("Pixel local storage only supported in OpenGL ES.");*/

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
            if (var_.storage === StorageClass.UniformConstant) {
                let type = this.get<SPIRType>(SPIRType, var_.basetype);
                input_is_target = type.image.dim === Dim.SubpassData;
            }

            if (var_.storage !== StorageClass.Input && !input_is_target)
                throw new Error("Can only use in and target variables for PLS inputs.");

            var_.remapped_variable = true;
        }

        for (let output of this.pls_outputs) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, output.id);
            if (var_.storage !== StorageClass.Output)
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
        if (!this.has_decoration(id, Decoration.InputAttachmentIndex))
            return false;

        const input_attachment_index = this.get_decoration(id, Decoration.InputAttachmentIndex);
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
                        this.get_decoration(output_var.self, Decoration.Location), "];");
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
            if (this.has_decoration(var_.self, Decoration.InputAttachmentIndex) &&
                this.get_decoration(var_.self, Decoration.InputAttachmentIndex) === index) {
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
            if (var_.storage === StorageClass.Output && this.get_decoration(var_.self, Decoration.Location) === location)
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
            return name;

        name = ParsedIR.sanitize_underscores(name);
        if (ParsedIR.is_globally_reserved_identifier(name, true)) {
            name = "";
            return name;
        }

        return this.update_name_cache(variables_primary, variables_secondary, name);
    }

    protected check_function_call_constraints(args: Array<number> | Uint32Array, arroffset: number, length: number)
    {
        // If our variable is remapped, and we rely on type-remapping information as
        // well, then we cannot pass the variable as a function parameter.
        // Fixing this is non-trivial without stamping out variants of the same function,
        // so for now warn about this and suggest workarounds instead.
        for (let i = 0; i < length; i++) {
            const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, args[arroffset + i]);
            if (!var_ || !var_.remapped_variable)
                continue;

            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            if (type.basetype === SPIRBaseType.Image && type.image.dim === Dim.SubpassData) {
                throw new Error("Tried passing a remapped subpassInput variable to a function. This will not work" +
                    " correctly because type-remapping information is lost. To workaround, please consider not passing" +
                    " the subpass input as a function parameter, or use in/out variables instead which do not need type" +
                    " remapping information.");
            }
        }
    }

    protected handle_invalid_expression(id: number)
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
            // options.es = ir.source.es;
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
        backend.allow_precision_qualifiers = true; ///*options.vulkan_semantics ||*/ options.es;
        backend.force_gl_in_out_block = true;
        backend.supports_extensions = true;
        backend.use_array_constructor = true;
        backend.workgroup_size_is_hidden = true;

        backend.support_precise_qualifier = false; /*(!options.es && options.version >= 400) || (options.es &&
         options.version >= 320);*/

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


        // this.traverse_all_reachable_opcodes(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), new DebugHandler(this));

        // Shaders might cast unrelated data to pointers of non-block types.
        // Find all such instances and make sure we can cast the pointers to a synthesized block type.
        if (ir.addressing_model === AddressingModel.PhysicalStorageBuffer64EXT)
            this.analyze_non_block_pointer_types();

        let pass_count = 0;
        // try {
        do {
            if (pass_count >= 3)
                throw new Error("Over 3 compilation loops detected. Must be a bug!");

            this.reset();

            this.buffer.reset();

            this.emit_header();
            this.emit_resources();
            this.emit_extension_workarounds(this.get_execution_model());

            this.emit_function(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), new Bitset());

            pass_count++;
        } while (this.is_forcing_recompilation());
        // }
        // catch (err) {
        //     console.error(err);
        // }

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

        let code = this.fixup_removed_structs(this.buffer.str());

        if (this.get_execution_model() === ExecutionModel.Vertex && options.remove_attribute_layouts)
            code = this.remove_attribute_layouts(code);

        return code;
    }

    protected fixup_removed_structs(str: string): string
    {
        // this is done as a post-processing step, there's probably better ways to get this done, but for now, this
        // works
        this.removed_structs.forEach(id => {
            const regex = new RegExp(this.to_name(id) + "\\.", "g");
            str = str.replace(regex, "");
        });

        return str;
    }

    protected remove_attribute_layouts(str: string): string
    {
        return str.replace(/layout\(location\s*=\s*\d+\)\s+in/g, "in");
    }

    protected find_static_extensions()
    {
        const ir = this.ir;
        const options = this.options;

        ir.for_each_typed_id<SPIRType>(SPIRType, (_, type) =>
        {
            if (type.basetype === SPIRBaseType.Double) {
                // if (options.es)
                    throw new Error("FP64 not supported in ES profile.");

                /*if (!options.es && options.version < 400)
                    this.require_extension_internal("GL_ARB_gpu_shader_fp64");*/
            }
            else if (type.basetype === SPIRBaseType.Int64 || type.basetype === SPIRBaseType.UInt64) {
                // if (options.es)
                    throw new Error("64-bit integers not supported in ES profile.");
                /*if (!options.es)
                    this.require_extension_internal("GL_ARB_gpu_shader_int64");*/
            }
            else if (type.basetype === SPIRBaseType.Half) {
                this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_float16");
                // if (options.vulkan_semantics)
                //     require_extension_internal("GL_EXT_shader_16bit_storage");
            }
            else if (type.basetype === SPIRBaseType.SByte || type.basetype === SPIRBaseType.UByte) {
                this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_int8");
                // if (options.vulkan_semantics)
                //     require_extension_internal("GL_EXT_shader_8bit_storage");
            }
            else if (type.basetype === SPIRBaseType.Short || type.basetype === SPIRBaseType.UShort) {
                this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_int16");
                // if (options.vulkan_semantics)
                //     require_extension_internal("GL_EXT_shader_16bit_storage");
            }
        });

        const execution = this.get_entry_point();
        switch (execution.model) {
            case ExecutionModel.GLCompute:
                throw new Error("Compute shaders are not supported!");
            /*if (!options.es && options.version < 430)
                this.require_extension_internal("GL_ARB_compute_shader");
            if (options.es && options.version < 310)
                throw new Error("At least ESSL 3.10 required for compute shaders.");
            break;*/

            case ExecutionModel.Geometry:
                throw new Error("Geometry shaders are not supported!");
            /*if (options.es && options.version < 320)
                this.require_extension_internal("GL_EXT_geometry_shader");
            if (!options.es && options.version < 150)
                this.require_extension_internal("GL_ARB_geometry_shader4");

            if (execution.flags.get(ExecutionMode.Invocations) && execution.invocations !== 1)
            {
                // Instanced GS is part of 400 core or this extension.
                if (!options.es && options.version < 400)
                    this.require_extension_internal("GL_ARB_gpu_shader5");
            }
            break;*/

            case ExecutionModel.TessellationEvaluation:
            case ExecutionModel.TessellationControl:
                throw new Error("Tessellation shaders are not supported!");
            /*if (options.es && options.version < 320)
                this.require_extension_internal("GL_EXT_tessellation_shader");
            if (!options.es && options.version < 400)
                this.require_extension_internal("GL_ARB_tessellation_shader");
            break;*/

            case ExecutionModel.RayGenerationKHR:
            case ExecutionModel.IntersectionKHR:
            case ExecutionModel.AnyHitKHR:
            case ExecutionModel.ClosestHitKHR:
            case ExecutionModel.MissKHR:
            case ExecutionModel.CallableKHR:
            // NV enums are aliases.
            /*if (options.es || options.version < 460)
                throw new Error("Ray tracing shaders require non-es profile with version 460 or above.");
            if (!options.vulkan_semantics)
                throw new Error("Ray tracing requires Vulkan semantics.");

            // Need to figure out if we should target KHR or NV extension based on capabilities.
            for (const cap of ir.declared_capabilities)
            {
                if (cap === Capability.RayTracingKHR || cap === Capability.RayQueryKHR ||
                    cap === Capability.RayTraversalPrimitiveCullingKHR)
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
            if (execution.model !== ExecutionModel.Fragment)
                throw new Error("Can only use GL_EXT_shader_pixel_local_storage in fragment shaders.");

            this.require_extension_internal("GL_EXT_shader_pixel_local_storage");
        }

        if (this.inout_color_attachments.length !== 0) {
            if (execution.model !== ExecutionModel.Fragment)
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

        /*if (options.separate_shader_objects && !options.es && options.version < 410)
            this.require_extension_internal("GL_ARB_separate_shader_objects");*/

        if (ir.addressing_model === AddressingModel.PhysicalStorageBuffer64EXT) {
            // if (!options.vulkan_semantics)
            throw new Error("GL_EXT_buffer_reference is only supported in Vulkan GLSL.");
            /*if (options.es && options.version < 320)
                throw new Error("GL_EXT_buffer_reference requires ESSL 320.");
            else if (!options.es && options.version < 450)
                throw new Error("GL_EXT_buffer_reference requires GLSL 450.");
            this.require_extension_internal("GL_EXT_buffer_reference");*/
        }
        else if (ir.addressing_model !== AddressingModel.Logical) {
            throw new Error("Only Logical and PhysicalStorageBuffer64EXT addressing models are supported.");
        }

        // Check for nonuniform qualifier and passthrough.
        // Instead of looping over all decorations to find this, just look at capabilities.
        for (let cap of ir.declared_capabilities) {
            switch (cap) {
                case Capability.ShaderNonUniformEXT:
                    throw new Error("CapabilityShaderNonUniformEXT not supported");
                    /*if (!options.vulkan_semantics)
                        this.require_extension_internal("GL_NV_gpu_shader5");
                    else
                         require_extension_internal("GL_EXT_nonuniform_qualifier");
                    break;*/
                case Capability.RuntimeDescriptorArrayEXT:
                    throw new Error("CapabilityRuntimeDescriptorArrayEXT not supported");
                /*if (!options.vulkan_semantics)
                    throw new Error("GL_EXT_nonuniform_qualifier is only supported in Vulkan GLSL.");
                this.require_extension_internal("GL_EXT_nonuniform_qualifier");
                break;*/

                case Capability.GeometryShaderPassthroughNV:
                    throw new Error("GeometryShaderPassthroughNV capability not supported");
                /*if (execution.model === ExecutionModelGeometry)
                {
                    require_extension_internal("GL_NV_geometry_shader_passthrough");
                    execution.geometry_passthrough = true;
                }
                break;*/

                case Capability.VariablePointers:
                case Capability.VariablePointersStorageBuffer:
                    throw new Error("VariablePointers capability is not supported in GLSL.");

                case Capability.MultiView:
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

                case Capability.RayQueryKHR:
                    throw new Error("RayQuery capability is not supported.");
                /*if (options.es || options.version < 460 || !options.vulkan_semantics)
                    throw new Error("RayQuery requires Vulkan GLSL 460.");
                require_extension_internal("GL_EXT_ray_query");
                ray_tracing_is_khr = true;
                break;*/

                case Capability.RayTraversalPrimitiveCullingKHR:
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

    protected emit_for_loop_initializers(block: SPIRBlock): string
    {
        if (block.loop_variables.length === 0)
            return "";

        const { ir } = this;
        const same_types = this.for_loop_initializers_are_same_type(block);

        // We can only declare for loop initializers if all variables are of same type.
        // If we cannot do this, declare individual variables before the loop header.
        // We might have a loop variable candidate which was not assigned to for some reason.
        let missing_initializers = 0;
        for (let variable of block.loop_variables) {
            const expr = this.get<SPIRVariable>(SPIRVariable, variable).static_expression;

            // Sometimes loop variables are initialized with OpUndef, but we can just declare
            // a plain variable without initializer in this case.
            if (expr === 0 || ir.ids[expr].get_type() === Types.Undef)
                missing_initializers++;
        }

        if (block.loop_variables.length === 1 && missing_initializers === 0) {
            return this.variable_decl(this.get<SPIRVariable>(SPIRVariable, block.loop_variables[0]));
        }
        else if (!same_types || missing_initializers === block.loop_variables.length) {
            for (let loop_var of block.loop_variables)
                this.statement(this.variable_decl(this.get<SPIRVariable>(SPIRVariable, loop_var)), ";");
            return "";
        }
        else {
            // We have a mix of loop variables, either ones with a clear initializer, or ones without.
            // Separate the two streams.
            let expr = "";

            for (let loop_var of block.loop_variables) {
                const static_expr = this.get<SPIRVariable>(SPIRVariable, loop_var).static_expression;
                if (static_expr === 0 || ir.ids[static_expr].get_type() === Types.Undef) {
                    this.statement(this.variable_decl(this.get<SPIRVariable>(SPIRVariable, loop_var)), ";");
                }
                else {
                    const var_ = this.get<SPIRVariable>(SPIRVariable, loop_var);
                    const type = this.get_variable_data_type(var_);
                    if (expr === "") {
                        // For loop initializers are of the form <type id = value, id = value, id = value, etc ...
                        expr = this.to_qualifiers_glsl(var_.self) + this.type_to_glsl(type) + " ";
                    }
                    else {
                        expr += ", ";
                        // In MSL, being based on C++, the asterisk marking a pointer
                        // binds to the identifier, not the type.
                        if (type.pointer)
                            expr += "* ";
                    }

                    expr += this.to_name(loop_var) + " = " + this.to_pointer_expression(var_.static_expression);
                }
            }
            return expr;
        }
    }

    protected emit_while_loop_initializers(block: SPIRBlock)
    {
// While loops do not take initializers, so declare all of them outside.
        for (let loop_var of block.loop_variables) {
            const var_ = this.get<SPIRVariable>(SPIRVariable, loop_var);
            this.statement(this.variable_decl(var_), ";");
        }
    }

    protected for_loop_initializers_are_same_type(block: SPIRBlock): boolean
    {
        if (block.loop_variables.length <= 1)
            return true;

        const { ir } = this;
        let expected = 0;
        let expected_flags = new Bitset();
        for (let var_ of block.loop_variables) {
            // Don't care about uninitialized variables as they will not be part of the initializers.
            const expr = this.get<SPIRVariable>(SPIRVariable, var_).static_expression;
            if (expr === 0 || ir.ids[expr].get_type() === Types.Undef)
                continue;

            if (expected === 0) {
                expected = this.get<SPIRVariable>(SPIRVariable, var_).basetype;
                defaultCopy(this.get_decoration_bitset(var_), expected_flags);
            }
            else if (expected !== this.get<SPIRVariable>(SPIRVariable, var_).basetype)
                return false;

            // Precision flags and things like that must also match.
            if (!expected_flags.equals(this.get_decoration_bitset(var_)))
                return false;
        }

        return true;
    }

    protected optimize_read_modify_write(type: SPIRType, lhs: string, rhs: string): boolean
    {
        // Do this with strings because we have a very clear pattern we can check for and it avoids
        // adding lots of special cases to the code emission.
        if (rhs.length < lhs.length + 3)
            return false;

        // Do not optimize matrices. They are a bit awkward to reason about in general
        // (in which order does operation happen?), and it does not work on MSL anyways.
        if (type.vecsize > 1 && type.columns > 1)
            return false;

        const index = rhs.indexOf(lhs);
        if (index !== 0)
            return false;

        let op = -1;
        // TODO: Shift operators, but it's not important for now.
        for (let i = lhs.length + 1; i < rhs.length; ++i) {
            const ch = rhs.charAt(i);
            if (ch === "+" || ch === "-" || ch === "/" || ch === "*" || ch === "%" || ch === "|" || ch === "&" || ch === "^") {
                op = i;
                break;
            }
        }

        if (op !== lhs.length + 1)
            return false;

        // Check that the op is followed by space. This excludes && and ||.
        if (rhs.charAt(op + 1) !== " ")
            return false;

        const bop = rhs.charAt(op);
        const expr = rhs.substring(lhs.length + 3);
        // Try to find increments and decrements. Makes it look neater as += 1, -= 1 is fairly rare to see in real code.
        // Find some common patterns which are equivalent.
        if ((bop === "+" || bop === "-") && (expr === "1" || expr === "uint(1)" || expr === "1u" || expr === "int(1u)"))
            this.statement(lhs, bop, bop, ";");
        else
            this.statement(lhs, " ", bop, "= ", expr, ";");
        return true;
    }

    protected fixup_image_load_store_access()
    {
        if (!this.options.enable_storage_image_qualifier_deduction)
            return;

        this.ir.for_each_typed_id<SPIRVariable>(SPIRVariable, (var_, _) =>
        {
            const vartype = this.expression_type(var_);
            if (vartype.basetype === SPIRBaseType.Image && vartype.image.sampled === 2) {
                // Very old glslangValidator and HLSL compilers do not emit required qualifiers here.
                // Solve this by making the image access as restricted as possible and loosen up if we need to.
                // If any no-read/no-write flags are actually set, assume that the compiler knows what it's doing.

                const flags = maplike_get(Meta, this.ir.meta, var_).decoration.decoration_flags;
                if (!flags.get(Decoration.NonWritable) && !flags.get(Decoration.NonReadable)) {
                    flags.set(Decoration.NonWritable);
                    flags.set(Decoration.NonReadable);
                }
            }
        });
    }

    protected type_is_empty(type: SPIRType)
    {
        return type.basetype === SPIRBaseType.Struct && type.member_types.length === 0;
    }

    protected declare_undefined_values()
    {
        let emitted = false;
        this.ir.for_each_typed_id<SPIRUndef>(SPIRUndef, (_, undef) =>
        {
            const type = this.get<SPIRType>(SPIRType, undef.basetype);
            // OpUndef can be void for some reason ...
            if (type.basetype === SPIRBaseType.Void)
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
        if ((this.get_execution_model() !== ExecutionModel.Vertex && storage === StorageClass.Input) ||
            (this.get_execution_model() !== ExecutionModel.Fragment && storage === StorageClass.Output)) {
            // const minimum_desktop_version = block ? 440 : 410;
            // ARB_enhanced_layouts vs ARB_separate_shader_objects ...

            /*if (!options.es && options.version < minimum_desktop_version && !options.separate_shader_objects)
                return false;
            else if (options.es && options.version < 310)*/
                return false;
        }

        if ((this.get_execution_model() === ExecutionModel.Vertex && storage === StorageClass.Input) ||
            (this.get_execution_model() === ExecutionModel.Fragment && storage === StorageClass.Output)) {
            if (/*options.es &&*/ options.version < 300)
                return false;
            /*else if (!options.es && options.version < 330)
                return false;*/
        }

        if (storage === StorageClass.Uniform || storage === StorageClass.UniformConstant || storage === StorageClass.PushConstant) {
            // if (options.es && options.version < 310)
                return false;
            /*else if (!options.es && options.version < 430)
                return false;*/
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
            type.basetype = SPIRBaseType.Half;
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
            type.basetype = SPIRBaseType.Half;
            type.vecsize = 1;
            type.columns = 1;
            res = convert_to_string(float_value);
            if (res.indexOf(".") < 0) res += ".0";
            res = this.type_to_glsl(type) + "(" + res + ")";
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
                out_type.basetype = SPIRBaseType.Float;
                in_type.basetype = SPIRBaseType.UInt;
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
            if (res.indexOf(".") < 0)
                res += ".0";
            if (backend.float_literal_suffix)
                res += "f";
        }

        return res;
    }

    protected convert_double_to_string(c: SPIRConstant, col: number, row: number): string
    {
        let res;
        const double_value = c.scalar_f64(col, row);
        const backend = this.backend;

        if (isNaN(double_value) || isNaN(double_value)) {
            throw new Error("64-bit integers/float not supported in ES profile.");

            // Use special representation.
            // if (!this.is_legacy()) {
                /*const out_type = new SPIRType();
                const in_type = new SPIRType();
                out_type.basetype = SPIRBaseType.Double;
                in_type.basetype = SPIRBaseType.UInt64;
                out_type.vecsize = 1;
                in_type.vecsize = 1;
                out_type.width = 64;
                in_type.width = 64;

                const u64_value = c.scalar_u64(col, row);*/

                // if (options.es)
                //     throw new Error("64-bit integers/float not supported in ES profile.");
                /*this.require_extension_internal("GL_ARB_gpu_shader_int64");

                const print_buffer = "0x" + u64_value.toString() + backend.long_long_literal_suffix ? "ull" : "ul";

                let comment = "inf";
                if (double_value === Number.POSITIVE_INFINITY)
                    comment = "-inf";
                else if (isNaN(double_value))
                    comment = "nan";*/
                // res = this.bitcast_glsl_op(out_type, in_type) + `(${print_buffer} /* ${comment} */)`;
            /*}
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
            }*/
        }
        else {
            res = convert_to_string(double_value);
            if (res.indexOf(".") < 0)
                res += ".0";
            if (backend.double_literal_suffix)
                res += "lf";
        }

        return res;
    }

    protected convert_separate_image_to_expression(id: number): string
    {
        const var_ = this.maybe_get_backing_variable(id);

        // If we are fetching from a plain OpTypeImage, we must combine with a dummy sampler in GLSL.
        // In Vulkan GLSL, we can make use of the newer GL_EXT_samplerless_texture_functions.
        if (var_) {
            const type = this.get<SPIRType>(SPIRType, var_.basetype);
            if (type.basetype === SPIRBaseType.Image && type.image.sampled === 1 && type.image.dim !== Dim.Buffer) {
                /*if (options.vulkan_semantics)
                {
                    if (dummy_sampler_id)
                    {
                        // Don't need to consider Shadow state since the dummy sampler is always non-shadow.
                        auto sampled_type = type;
                        sampled_type.basetype = SPIRBaseType.SampledImage;
                        return join(type_to_glsl(sampled_type), "(", to_non_uniform_aware_expression(id), ", ",
                            to_expression(dummy_sampler_id), ")");
                    }
                    else
                    {
                        // Newer glslang supports this extension to deal with texture2D as argument to texture functions.
                        require_extension_internal("GL_EXT_samplerless_texture_functions");
                    }
                }
                else
                {*/
                if (!this.dummy_sampler_id)
                    throw new Error("Cannot find dummy sampler ID. Was build_dummy_sampler_for_combined_images() called?");

                return this.to_combined_image_sampler(id, this.dummy_sampler_id);
                // }
            }
        }

        return this.to_non_uniform_aware_expression(id);
    }

    // Builtins in GLSL are always specific signedness, but the SPIR-V can declare them
    // as either unsigned or signed.
    // Sometimes we will need to automatically perform casts on load and store to make this work.
    protected cast_to_variable_store(target_id: number, expr: string, expr_type: SPIRType): string
    {
        const var_ = this.maybe_get_backing_variable(target_id);
        if (var_)
            target_id = var_.self;

        // Only interested in standalone builtin variables.
        if (!this.has_decoration(target_id, Decoration.BuiltIn))
            return expr;

        const builtin = <BuiltIn>(this.get_decoration(target_id, Decoration.BuiltIn));
        let expected_type = expr_type.basetype;

        // TODO: Fill in for more builtins.
        switch (builtin) {
            case BuiltIn.Layer:
            case BuiltIn.PrimitiveId:
            case BuiltIn.ViewportIndex:
            case BuiltIn.FragStencilRefEXT:
            case BuiltIn.SampleMask:
            case BuiltIn.PrimitiveShadingRateKHR:
            case BuiltIn.ShadingRateKHR:
                expected_type = SPIRBaseType.Int;
                break;

            default:
                break;
        }

        if (expected_type !== expr_type.basetype) {
            const type = expr_type;
            type.basetype = expected_type;
            expr = this.bitcast_expression(type, expr_type.basetype, expr);
        }

        return expr;
    }

    protected cast_from_variable_load(source_id: number, expr: string, expr_type: SPIRType): string
    {
        // We will handle array cases elsewhere.
        if (expr_type.array.length > 0)
            return expr;

        const var_ = this.maybe_get_backing_variable(source_id);
        if (var_)
            source_id = var_.self;

        // Only interested in standalone builtin variables.
        if (!this.has_decoration(source_id, Decoration.BuiltIn))
            return expr;

        const builtin = <BuiltIn>(this.get_decoration(source_id, Decoration.BuiltIn));
        let expected_type = expr_type.basetype;

        // TODO: Fill in for more builtins.
        switch (builtin) {
            case BuiltIn.Layer:
            case BuiltIn.PrimitiveId:
            case BuiltIn.ViewportIndex:
            case BuiltIn.InstanceId:
            case BuiltIn.InstanceIndex:
            case BuiltIn.VertexId:
            case BuiltIn.VertexIndex:
            case BuiltIn.SampleId:
            case BuiltIn.BaseVertex:
            case BuiltIn.BaseInstance:
            case BuiltIn.DrawIndex:
            case BuiltIn.FragStencilRefEXT:
            case BuiltIn.InstanceCustomIndexNV:
            case BuiltIn.SampleMask:
            case BuiltIn.PrimitiveShadingRateKHR:
            case BuiltIn.ShadingRateKHR:
                expected_type = SPIRBaseType.Int;
                break;

            case BuiltIn.GlobalInvocationId:
            case BuiltIn.LocalInvocationId:
            case BuiltIn.WorkgroupId:
            case BuiltIn.LocalInvocationIndex:
            case BuiltIn.WorkgroupSize:
            case BuiltIn.NumWorkgroups:
            case BuiltIn.IncomingRayFlagsNV:
            case BuiltIn.LaunchIdNV:
            case BuiltIn.LaunchSizeNV:
                expected_type = SPIRBaseType.UInt;
                break;

            default:
                break;
        }

        if (expected_type !== expr_type.basetype)
            expr = this.bitcast_expression(expr_type, expected_type, expr);

        return expr;
    }

    protected unroll_array_from_complex_load(target_id: number, source_id: number, expr: string)
    {
        if (!this.backend.force_gl_in_out_block)
            return expr;
        // This path is only relevant for GL backends.

        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, source_id);
        if (!var_)
            return expr;

        if (var_.storage !== StorageClass.Input && var_.storage !== StorageClass.Output)
            return expr;

        const type = this.get_variable_data_type(var_);
        if (type.array.length === 0)
            return expr;

        const builtin = <BuiltIn>(this.get_decoration(var_.self, Decoration.BuiltIn));
        const is_builtin = this.is_builtin_variable(var_) &&
            (builtin === BuiltIn.PointSize ||
                builtin === BuiltIn.Position ||
                builtin === BuiltIn.SampleMask);
        const is_tess = false; //this.is_tessellation_shader();
        const is_patch = this.has_decoration(var_.self, Decoration.Patch);
        const is_sample_mask = is_builtin && builtin === BuiltIn.SampleMask;

        // Tessellation input arrays are special in that they are unsized, so we cannot directly copy from it.
        // We must unroll the array load.
        // For builtins, we couldn't catch this case normally,
        // because this is resolved in the OpAccessChain in most cases.
        // If we load the entire array, we have no choice but to unroll here.
        if (!is_patch && (is_builtin || is_tess)) {
            const new_expr = "_" + target_id + "_unrolled";
            this.statement(this.variable_decl(type, new_expr, target_id), ";");
            let array_expr: string;
            if (type.array_size_literal[type.array_size_literal.length - 1]) {
                const lastChar = type.array[type.array.length - 1];
                array_expr = convert_to_string(lastChar);
                if (lastChar === 0)
                    throw new Error("Cannot unroll an array copy from unsized array.");
            }
            else
                array_expr = this.to_expression(type.array[type.array.length - 1]);

            // The array size might be a specialization constant, so use a for-loop instead.
            this.statement("for (int i = 0; i < int(", array_expr, "); i++)");
            this.begin_scope();
            if (is_builtin && !is_sample_mask)
                this.statement(new_expr, "[i] = gl_in[i].", expr, ";");
            else if (is_sample_mask) {
                const target_type = new SPIRType();
                target_type.basetype = SPIRBaseType.Int;
                this.statement(new_expr, "[i] = ", this.bitcast_expression(target_type, type.basetype, expr + "[i]"), ";");
            }
            else
                this.statement(new_expr, "[i] = ", expr, "[i];");
            this.end_scope();

            expr = new_expr;
        }

        return expr;
    }

    protected unroll_array_to_complex_store(target_id: number, source_id: number): boolean
    {
        if (!this.backend.force_gl_in_out_block)
            return false;
        // This path is only relevant for GL backends.

        const var_ = this.maybe_get<SPIRVariable>(SPIRVariable, target_id);
        if (!var_ || var_.storage !== StorageClass.Output)
            return false;

        if (!this.is_builtin_variable(var_) || <BuiltIn>(this.get_decoration(var_.self, Decoration.BuiltIn)) !== BuiltIn.SampleMask)
            return false;

        const type = this.expression_type(source_id);
        let array_expr;
        if (type.array_size_literal[type.array_size_literal.length - 1]) {
            const lastChar = type.array[type.array.length - 1];
            array_expr = convert_to_string(lastChar);
            if (lastChar === 0)
                throw new Error("Cannot unroll an array copy from unsized array.");
        }
        else
            array_expr = this.to_expression(type.array[type.array.length - 1]);

        const target_type = new SPIRType();
        target_type.basetype = SPIRBaseType.Int;

        this.statement("for (int i = 0; i < int(", array_expr, "); i++)");
        this.begin_scope();
        this.statement(this.to_expression(target_id), "[i] = ",
            this.bitcast_expression(target_type, type.basetype, this.to_expression(source_id) + "[i]"),
            ";");
        this.end_scope();

        return true;
    }

    protected convert_non_uniform_expression(expr: string, ptr_id: number): string
    {
        if (this.backend.nonuniform_qualifier === "\0")
            return expr;

        const var_ = this.maybe_get_backing_variable(ptr_id);
        if (!var_)
            return expr;

        if (var_.storage !== StorageClass.UniformConstant &&
            var_.storage !== StorageClass.StorageBuffer &&
            var_.storage !== StorageClass.Uniform)
            return expr;

        const backing_type = this.get<SPIRType>(SPIRType, var_.basetype);
        if (backing_type.array.length === 0)
            return expr;

        // If we get here, we know we're accessing an arrayed resource which
        // might require nonuniform qualifier.

        let start_array_index = expr.indexOf("[");

        if (start_array_index < 0)
            return expr;

        // We've opened a bracket, track expressions until we can close the bracket.
        // This must be our resource index.
        let end_array_index = -1;
        let bracket_count = 1;
        for (let index = start_array_index + 1; index < expr.length; index++) {
            if (expr.charAt(index) === "]") {
                if (--bracket_count === 0) {
                    end_array_index = index;
                    break;
                }
            }
            else if (expr[index] === "[")
                bracket_count++;
        }

        console.assert(bracket_count === 0);

        // Doesn't really make sense to declare a non-arrayed image with nonuniformEXT, but there's
        // nothing we can do here to express that.
        if (start_array_index >= 0 || end_array_index >= 0 || end_array_index < start_array_index)
            return expr;

        start_array_index++;

        return expr.substring(0, start_array_index) + this.backend.nonuniform_qualifier + "(" +
            expr.substring(start_array_index, end_array_index) + ")" +
            expr.substring(end_array_index);
    }

    protected disallow_forwarding_in_expression_chain(expr: SPIRExpression)
    {
        // Allow trivially forwarded expressions like OpLoad or trivial shuffles,
        // these will be marked as having suppressed usage tracking.
        // Our only concern is to make sure arithmetic operations are done in similar ways.
        if (this.expression_is_forwarded(expr.self) && !this.expression_suppresses_usage_tracking(expr.self) &&
            !this.forced_invariant_temporaries.has(expr.self)) {
            this.forced_temporaries.add(expr.self);
            this.forced_invariant_temporaries.add(expr.self);
            this.force_recompile();

            for (let dependent of expr.expression_dependencies)
                this.disallow_forwarding_in_expression_chain(this.get<SPIRExpression>(SPIRExpression, dependent));
        }
    }


    protected handle_store_to_invariant_variable(store_id: number, value_id: number)
    {
        // Variables or access chains marked invariant are complicated. We will need to make sure the code-gen leading up to
        // this variable is consistent. The failure case for SPIRV-Cross is when an expression is forced to a temporary
        // in one translation unit, but not another, e.g. due to multiple use of an expression.
        // This causes variance despite the output variable being marked invariant, so the solution here is to force all dependent
        // expressions to be temporaries.
        // It is uncertain if this is enough to support invariant in all possible cases, but it should be good enough
        // for all reasonable uses of invariant.
        if (!this.has_decoration(store_id, Decoration.Invariant))
            return;

        const expr = this.maybe_get<SPIRExpression>(SPIRExpression, value_id);
        if (!expr)
            return;

        this.disallow_forwarding_in_expression_chain(expr);
    }

    protected expression_is_constant_null(id: number): boolean
    {
        const c = this.maybe_get<SPIRConstant>(SPIRConstant, id);
        if (!c)
            return false;
        return c.constant_is_null();
    }

    protected expression_is_non_value_type_array(ptr: number): boolean
    {
        const type = this.expression_type(ptr);
        if (type.array.length === 0)
            return false;

        if (!this.backend.array_is_value_type)
            return true;

        const var_ = this.maybe_get_backing_variable(ptr);
        if (!var_)
            return false;

        const backed_type = this.get<SPIRType>(SPIRType, var_.basetype);
        return !this.backend.buffer_offset_array_is_value_type && backed_type.basetype === SPIRBaseType.Struct &&
            this.has_member_decoration(backed_type.self, 0, Decoration.Offset);
    }

    protected emit_store_statement(lhs_expression: number, rhs_expression: number)
    {
        let rhs = this.to_pointer_expression(rhs_expression);

        // Statements to OpStore may be empty if it is a struct with zero members. Just forward the store to /dev/null.
        if (rhs !== "") {
            this.handle_store_to_invariant_variable(lhs_expression, rhs_expression);

            if (!this.unroll_array_to_complex_store(lhs_expression, rhs_expression)) {
                let lhs = this.to_dereferenced_expression(lhs_expression);
                if (this.has_decoration(lhs_expression, Decoration.NonUniform))
                    lhs = this.convert_non_uniform_expression(lhs, lhs_expression);

                // We might need to cast in order to store to a builtin.
                rhs = this.cast_to_variable_store(lhs_expression, rhs, this.expression_type(rhs_expression));

                // Tries to optimize assignments like "<lhs> = <lhs> op expr".
                // While this is purely cosmetic, this is important for legacy ESSL where loop
                // variable increments must be in either i++ or i += const-expr.
                // Without this, we end up with i = i + 1, which is correct GLSL, but not correct GLES 2.0.
                if (!this.optimize_read_modify_write(this.expression_type(rhs_expression), lhs, rhs))
                    this.statement(lhs, " = ", rhs, ";");
            }
            this.register_write(lhs_expression);
        }
    }

    protected get_integer_width_for_instruction(instr: Instruction): number
    {
        if (instr.length < 3)
            return 32;

        const ops = this.stream(instr);

        switch (instr.op) {
            case Op.SConvert:
            case Op.ConvertSToF:
            case Op.UConvert:
            case Op.ConvertUToF:
            case Op.IEqual:
            case Op.INotEqual:
            case Op.SLessThan:
            case Op.SLessThanEqual:
            case Op.SGreaterThan:
            case Op.SGreaterThanEqual:
            case Op.ULessThan:
            case Op.ULessThanEqual:
            case Op.UGreaterThan:
            case Op.UGreaterThanEqual:
                return this.expression_type(ops[2]).width;

            default: {
                // We can look at result type which is more robust.
                const type = this.maybe_get<SPIRType>(SPIRType, ops[0]);
                if (type && type_is_integral(type))
                    return type.width;
                else
                    return 32;
            }
        }
    }

    protected get_integer_width_for_glsl_instruction(op: GLSLstd450, ops: Uint32Array| number[], arroffs: number, length: number): number
    {
        if (length < 1)
            return 32;

        switch (op) {
            case GLSLstd450.SAbs:
            case GLSLstd450.SSign:
            case GLSLstd450.UMin:
            case GLSLstd450.SMin:
            case GLSLstd450.UMax:
            case GLSLstd450.SMax:
            case GLSLstd450.UClamp:
            case GLSLstd450.SClamp:
            case GLSLstd450.FindSMsb:
            case GLSLstd450.FindUMsb:
                return this.expression_type(ops[arroffs]).width;

            default: {
                // We don't need to care about other opcodes, just return 32.
                return 32;
            }
        }
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

            if (this.has_decoration(type.self, Decoration.Block) || this.has_decoration(type.self, Decoration.BufferBlock)) {
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

        const type_ids = ir.ids_for_type[Types.Type];
        for (let alias_itr = 0; alias_itr < type_ids.length; ++alias_itr) {
            const type = this.get<SPIRType>(SPIRType, type_ids[alias_itr]);
            if (type.type_alias !== <TypeID>(0) &&
                !this.has_extended_decoration(type.type_alias, ExtendedDecorations.BufferBlockRepacked)) {
                // We will skip declaring this type, so make sure the type_alias type comes before.
                const master_itr = type_ids.indexOf(type.type_alias);
                console.assert(master_itr >= 0);

                if (alias_itr < master_itr) {
                    // Must also swap the type order for the constant-type joined array.
                    const joined_types = ir.ids_for_constant_or_type;
                    const alt_alias_itr = joined_types.indexOf(type_ids[alias_itr]);
                    const alt_master_itr = joined_types.indexOf(type_ids[master_itr]);
                    console.assert(alt_alias_itr >= 0);
                    console.assert(alt_master_itr >= 0);

                    swap(type_ids, alias_itr, master_itr);
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

function is_unsigned_opcode(op: Op): boolean
{
    // Don't have to be exhaustive, only relevant for legacy target checking ...
    switch (op) {
        case Op.ShiftRightLogical:
        case Op.UGreaterThan:
        case Op.UGreaterThanEqual:
        case Op.ULessThan:
        case Op.ULessThanEqual:
        case Op.UConvert:
        case Op.UDiv:
        case Op.UMod:
        case Op.UMulExtended:
        case Op.ConvertUToF:
        case Op.ConvertFToU:
            return true;

        default:
            return false;
    }
}

function packing_has_flexible_offset(packing: BufferPackingStandard): boolean
{
    switch (packing) {
        case BufferPackingStandard.Std140:
        case BufferPackingStandard.Std430:
        case BufferPackingStandard.PackingScalar:
            // case BufferPackingHLSLCbuffer:
            return false;

        default:
            return true;
    }
}

function packing_to_substruct_packing(packing: BufferPackingStandard): BufferPackingStandard
{
    switch (packing) {
        case BufferPackingStandard.Std140EnhancedLayout:
            return BufferPackingStandard.Std140;
        case BufferPackingStandard.Std430EnhancedLayout:
            return BufferPackingStandard.Std430;
        // case BufferPackingStandard.BufferPackingHLSLCbufferPackOffset:
        // return BufferPackingStandard.BufferPackingHLSLCbuffer;
        case BufferPackingStandard.PackingScalarEnhancedLayout:
            return BufferPackingStandard.PackingScalar;
        default:
            return packing;
    }
}

function packing_is_vec4_padded(packing: BufferPackingStandard): boolean
{
    switch (packing) {
        // case BufferPackingStandard.BufferPackingHLSLCbuffer:
        // case BufferPackingStandard.BufferPackingHLSLCbufferPackOffset:
        case BufferPackingStandard.Std140:
        case BufferPackingStandard.Std140EnhancedLayout:
            return true;

        default:
            return false;
    }
}

function packing_is_scalar(packing: BufferPackingStandard): boolean
{
    switch (packing) {
        case BufferPackingStandard.PackingScalar:
        case BufferPackingStandard.PackingScalarEnhancedLayout:
            return true;

        default:
            return false;
    }
}

function pls_format_to_basetype(format: PlsFormat): SPIRBaseType
{
    switch (format) {
        case PlsFormat.RGBA8I:
        case PlsFormat.RG16I:
            return SPIRBaseType.Int;

        case PlsFormat.RGB10A2UI:
        case PlsFormat.RGBA8UI:
        case PlsFormat.RG16UI:
        case PlsFormat.R32UI:
            return SPIRBaseType.UInt;

        default:
            /*case R11FG11FB10F:
            case R32F:
            case RG16F:
            case RGB10A2:
            case RGBA8:
            case PlsRG16:*/
            return SPIRBaseType.Float;
    }
}

function pls_format_to_components(format: PlsFormat): number
{
    switch (format) {
        default:
        case PlsFormat.R32F:
        case PlsFormat.R32UI:
            return 1;

        case PlsFormat.RG16F:
        case PlsFormat.RG16:
        case PlsFormat.RG16UI:
        case PlsFormat.RG16I:
            return 2;

        case PlsFormat.R11FG11FB10F:
            return 3;

        case PlsFormat.RGB10A2:
        case PlsFormat.RGBA8:
        case PlsFormat.RGBA8I:
        case PlsFormat.RGB10A2UI:
        case PlsFormat.RGBA8UI:
            return 4;
    }
}

function to_pls_layout(format: PlsFormat): string
{
    switch (format) {
        case PlsFormat.R11FG11FB10F:
            return "layout(r11f_g11f_b10f) ";
        case PlsFormat.R32F:
            return "layout(r32f) ";
        case PlsFormat.RG16F:
            return "layout(rg16f) ";
        case PlsFormat.RGB10A2:
            return "layout(rgb10_a2) ";
        case PlsFormat.RGBA8:
            return "layout(rgba8) ";
        case PlsFormat.RG16:
            return "layout(rg16) ";
        case PlsFormat.RGBA8I:
            return "layout(rgba8i)";
        case PlsFormat.RG16I:
            return "layout(rg16i) ";
        case PlsFormat.RGB10A2UI:
            return "layout(rgb10_a2ui) ";
        case PlsFormat.RGBA8UI:
            return "layout(rgba8ui) ";
        case PlsFormat.RG16UI:
            return "layout(rg16ui) ";
        case PlsFormat.R32UI:
            return "layout(r32ui) ";
        default:
            return "";
    }
}

function image_opcode_is_sample_no_dref(op: Op): boolean
{
    switch (op) {
        case Op.ImageSampleExplicitLod:
        case Op.ImageSampleImplicitLod:
        case Op.ImageSampleProjExplicitLod:
        case Op.ImageSampleProjImplicitLod:
        case Op.ImageFetch:
        case Op.ImageRead:
        case Op.ImageSparseSampleExplicitLod:
        case Op.ImageSparseSampleImplicitLod:
        case Op.ImageSparseSampleProjExplicitLod:
        case Op.ImageSparseSampleProjImplicitLod:
        case Op.ImageSparseFetch:
        case Op.ImageSparseRead:
            return true;

        default:
            return false;
    }
}

function is_unsigned_glsl_opcode(op: GLSLstd450)
{
    // Don't have to be exhaustive, only relevant for legacy target checking ...
    switch (op)
    {
        case GLSLstd450.UClamp:
        case GLSLstd450.UMin:
        case GLSLstd450.UMax:
        case GLSLstd450.FindUMsb:
            return true;

        default:
            return false;
    }
}
