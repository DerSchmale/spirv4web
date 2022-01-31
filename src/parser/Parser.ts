// @ts-ignore
import { createWith, equals, transform } from "@derschmale/array-utils";
import { ParsedIR } from "./ParsedIR";
import { Instruction } from "../common/Instruction";
import { SPIRFunction } from "../common/SPIRFunction";
import {
    SPIRBlock,
    SPIRBlockCase,
    SPIRBlockHints,
    SPIRBlockMerge,
    SPIRBlockPhi,
    SPIRBlockTerminator
} from "../common/SPIRBlock";
import { SPIRType, SPIRBaseType } from "../common/SPIRType";
import { IVariant, IVariantType } from "../common/IVariant";
import { Pair } from "../utils/Pair";
import { variant_get, variant_set } from "../common/Variant";
import { SPIRString } from "../common/SPIRString";
import { SPIRUndef } from "../common/SPIRUndef";
import { SPIRExtension, SPIRExtensionExtension } from "../common/SPIRExtension";
import { SPIREntryPoint } from "../common/SPIREntryPoint";
import { defaultClone, defaultCopy } from "../utils/defaultCopy";
import { SPIRConstant } from "../common/SPIRConstant";
import { SPIRFunctionPrototype } from "../common/SPIRFunctionPrototype";
import { SPIRVariable } from "../common/SPIRVariable";
import { SPIRConstantOp } from "../common/SPIRConstantOp";
import { MagicNumber } from "../spirv/spirv";
import { Op } from "../spirv/Op";
import { AddressingModel } from "../spirv/AddressingModel";
import { MemoryModel } from "../spirv/MemoryModel";
import { SourceLanguage } from "../spirv/SourceLanguage";
import { Capability } from "../spirv/Capability";
import { ExecutionModel } from "../spirv/ExecutionModel";
import { ExecutionMode } from "../spirv/ExecutionMode";
import { Decoration } from "../spirv/Decoration";
import { ImageFormat } from "../spirv/ImageFormat";
import { Dim } from "../spirv/Dim";
import { AccessQualifier } from "../spirv/AccessQualifier";
import { StorageClass } from "../spirv/StorageClass";
import { SelectionControlMask } from "../spirv/SelectionControlMask";
import { LoopControlMask } from "../spirv/LoopControlMask";
import { BlockMetaFlagBits } from "./BlockMetaFlagBits";

export class Parser
{
    private ir: ParsedIR = new ParsedIR();
    private current_function: SPIRFunction;
    private current_block: SPIRBlock;
    // This must be an ordered data structure so we always pick the same type aliases.
    private global_struct_cache: number[] = [];
    private forward_pointer_fixups: Pair<number, number>[] = [];

    constructor(spirv: Uint32Array)
    {
        this.ir.spirv = spirv;
    }

    get_parsed_ir(): ParsedIR
    {
        return this.ir;
    }

    parse()
    {
        const spirv = this.ir.spirv;
        const len = spirv.length;

        if (len < 5)
            throw new Error("SPIRV file too small.");

        const s = spirv;

        // Endian-swap if we need to (for web: we don't, actually).
        if (s[0] === swap_endian(MagicNumber)) {
            transform(s, (c: number) => swap_endian(c));
        }

        if (s[0] !== MagicNumber || !is_valid_spirv_version(s[1]))
            throw new Error("Invalid SPIRV format.");

        const bound = s[3];

        const MaximumNumberOfIDs = 0x3fffff;
        if (bound > MaximumNumberOfIDs)
            throw new Error("ID bound exceeds limit of 0x3fffff.");

        this.ir.set_id_bounds(bound);

        let offset = 5;

        const instructions: Instruction[] = [];

        while (offset < len) {
            const instr = new Instruction();
            instr.op = spirv[offset] & 0xffff;
            instr.count = (spirv[offset] >> 16) & 0xffff;

            if (instr.count === 0)
                throw new Error("SPIR-V instructions cannot consume 0 words. Invalid SPIR-V file.");

            instr.offset = offset + 1;
            instr.length = instr.count - 1;

            offset += instr.count;

            if (offset > spirv.length)
                throw new Error("SPIR-V instruction goes out of bounds.");

            instructions.push(instr);
        }

        instructions.forEach(i => this.parseInstruction(i));

        this.forward_pointer_fixups.forEach(fixup =>
        {
            const target = this.get<SPIRType>(SPIRType, fixup.first);
            const source = this.get<SPIRType>(SPIRType, fixup.second);
            target.member_types = source.member_types;
            target.basetype = source.basetype;
            target.self = source.self;
        });
        this.forward_pointer_fixups = [];

        if (this.current_function)
            throw new Error("Function was not terminated.");
        if (this.current_block)
            throw new Error("Block was not terminated.");
        if (this.ir.default_entry_point === 0)
            throw new Error("There is no entry point in the SPIR-V module.");
    }

    private parseInstruction(instruction: Instruction)
    {
        const ops = this.stream(instruction);
        const op = instruction.op;
        const ir = this.ir;
        let length = instruction.length;


        switch (op) {
            case Op.SourceContinued:
            case Op.SourceExtension:
            case Op.Nop:
            case Op.ModuleProcessed:
                break;

            case Op.String: {
                this.set<SPIRString>(SPIRString, ops[0], extract_string(ir.spirv, instruction.offset + 1));
                break;
            }

            case Op.MemoryModel:
                ir.addressing_model = <AddressingModel>ops[0];
                ir.memory_model = <MemoryModel>ops[1];
                break;

            case Op.Source: {
                const lang: SourceLanguage = ops[0];
                switch (lang) {
                    case SourceLanguage.ESSL:
                        ir.source.es = true;
                        ir.source.version = ops[1];
                        ir.source.known = true;
                        ir.source.hlsl = false;
                        break;

                    case SourceLanguage.GLSL:
                        ir.source.es = false;
                        ir.source.version = ops[1];
                        ir.source.known = true;
                        ir.source.hlsl = false;
                        break;

                    case SourceLanguage.HLSL:
                        // For purposes of cross-compiling, this is GLSL 450.
                        ir.source.es = false;
                        ir.source.version = 450;
                        ir.source.known = true;
                        ir.source.hlsl = true;
                        break;

                    default:
                        ir.source.known = false;
                        break;
                }
                break;
            }

            case Op.Undef: {
                const result_type = ops[0];
                const id = ops[1];
                this.set<SPIRUndef>(SPIRUndef, id, result_type);
                if (this.current_block)
                    this.current_block.ops.push(instruction);
                break;
            }

            case Op.Capability: {
                const cap: Capability = ops[0];
                if (cap === Capability.Kernel)
                    throw new Error("Kernel capability not supported.");

                ir.declared_capabilities.push(ops[0]);
                break;
            }

            case Op.Extension: {
                const ext = extract_string(ir.spirv, instruction.offset);
                ir.declared_extensions.push(ext);
                break;
            }

            case Op.ExtInstImport: {
                const id = ops[0];
                const ext = extract_string(ir.spirv, instruction.offset + 1);
                if (ext === "GLSL.std.450")
                    this.set<SPIRExtension>(SPIRExtension, id, SPIRExtensionExtension.GLSL);
                else if (ext === "DebugInfo")
                    this.set<SPIRExtension>(SPIRExtension, id, SPIRExtensionExtension.SPV_debug_info);
                else if (ext === "SPV_AMD_shader_ballot")
                    this.set<SPIRExtension>(SPIRExtension, id, SPIRExtensionExtension.SPV_AMD_shader_ballot);
                else if (ext === "SPV_AMD_shader_explicit_vertex_parameter")
                    this.set<SPIRExtension>(SPIRExtension, id, SPIRExtensionExtension.SPV_AMD_shader_explicit_vertex_parameter);
                else if (ext === "SPV_AMD_shader_trinary_minmax")
                    this.set<SPIRExtension>(SPIRExtension, id, SPIRExtensionExtension.SPV_AMD_shader_trinary_minmax);
                else if (ext === "SPV_AMD_gcn_shader")
                    this.set<SPIRExtension>(SPIRExtension, id, SPIRExtensionExtension.SPV_AMD_gcn_shader);
                else
                    this.set<SPIRExtension>(SPIRExtension, id, SPIRExtensionExtension.Unsupported);

                // Other SPIR-V extensions which have ExtInstrs are currently not supported.

                break;
            }

            case Op.ExtInst: {
                // The SPIR-V debug information extended instructions might come at global scope.
                if (this.current_block)
                    this.current_block.ops.push(instruction);
                break;
            }

            case Op.EntryPoint: {
                const e = new SPIREntryPoint(ops[1], <ExecutionModel>(ops[0]), extract_string(ir.spirv, instruction.offset + 2));
                ir.entry_points[ops[1]] = e;

                // Strings need nul-terminator and consume the whole word.
                let strlen_words = (e.name.length + 1 + 3) >> 2;

                for (let i = strlen_words + 2; i < instruction.length; i++)
                    e.interface_variables.push(ops[i]);

                // Set the name of the entry point in case OpName is not provided later.
                ir.set_name(ops[1], e.name);

                // If we don't have an entry, make the first one our "default".
                if (!ir.default_entry_point)
                    ir.default_entry_point = ops[1];

                break;
            }

            case Op.ExecutionMode: {
                const execution = ir.entry_points[ops[0]];
                const mode = <ExecutionMode>(ops[1]);
                execution.flags.set(mode);

                switch (mode) {
                    case ExecutionMode.Invocations:
                        execution.invocations = ops[2];
                        break;

                    case ExecutionMode.LocalSize:
                        execution.workgroup_size.x = ops[2];
                        execution.workgroup_size.y = ops[3];
                        execution.workgroup_size.z = ops[4];
                        break;

                    case ExecutionMode.OutputVertices:
                        execution.output_vertices = ops[2];
                        break;

                    default:
                        break;
                }
                break;
            }

            case Op.Name: {
                const id = ops[0];
                ir.set_name(id, extract_string(ir.spirv, instruction.offset + 1));
                break;
            }

            case Op.MemberName: {
                const id = ops[0];
                const member = ops[1];
                ir.set_member_name(id, member, extract_string(ir.spirv, instruction.offset + 2));
                break;
            }

            case Op.DecorationGroup: {
                // Noop, this simply means an ID should be a collector of decorations.
                // The meta array is already a flat array of decorations which will contain the relevant decorations.
                break;
            }

            case Op.GroupDecorate: {
                const group_id = ops[0];
                const decorations = ir.get_meta(group_id).decoration;
                const flags = decorations.decoration_flags;

                // Copies decorations from one ID to another. Only copy decorations which are set in the group,
                // i.e., we cannot just copy the meta structure directly.
                for (let i = 1; i < length; i++) {
                    let target = ops[i];
                    flags.for_each_bit(bit =>
                    {
                        let decoration: Decoration = bit;

                        if (decoration_is_string(decoration)) {
                            ir.set_decoration_string(target, decoration, ir.get_decoration_string(group_id, decoration));
                        }
                        else {
                            ir.get_meta(target).decoration_word_offset[decoration] =
                                ir.get_meta(group_id).decoration_word_offset[decoration];
                            ir.set_decoration(target, decoration, ir.get_decoration(group_id, decoration));
                        }
                    });
                }
                break;
            }

            case Op.GroupMemberDecorate: {
                const group_id = ops[0];
                const flags = ir.get_meta(group_id).decoration.decoration_flags;

                // Copies decorations from one ID to another. Only copy decorations which are set in the group,
                // i.e., we cannot just copy the meta structure directly.
                for (let i = 1; i + 1 < length; i += 2) {
                    const target = ops[i];
                    const index = ops[i + 1];
                    flags.for_each_bit(bit =>
                    {
                        const decoration: Decoration = bit;

                        if (decoration_is_string(decoration))
                            ir.set_member_decoration_string(target, index, decoration,
                                ir.get_decoration_string(group_id, decoration));
                        else
                            ir.set_member_decoration(target, index, decoration, ir.get_decoration(group_id, decoration));
                    });
                }
                break;
            }

            case Op.Decorate:
            case Op.DecorateId: {
                // OpDecorateId technically supports an array of arguments, but our only supported decorations are single uint,
                // so merge decorate and decorate-id here.
                const id = ops[0];
                const decoration: Decoration = ops[1];

                if (length >= 3) {
                    // uint32_t(&ops[2] - ir.spirv.data())
                    // this is just the offset of ops[2] into the spirv data array
                    ir.get_meta(id).decoration_word_offset[decoration] = instruction.offset + 2;
                    ir.set_decoration(id, decoration, ops[2]);
                }
                else
                    ir.set_decoration(id, decoration);

                break;
            }

            case Op.DecorateStringGOOGLE: {
                const id = ops[0];
                const decoration: Decoration = ops[1];
                ir.set_decoration_string(id, decoration, extract_string(ir.spirv, instruction.offset + 2));
                break;
            }

            case Op.MemberDecorate: {
                const id = ops[0];
                const member = ops[1];
                const decoration: Decoration = ops[2];
                if (length >= 4)
                    ir.set_member_decoration(id, member, decoration, ops[3]);
                else
                    ir.set_member_decoration(id, member, decoration);
                break;
            }

            case Op.MemberDecorateStringGOOGLE: {
                const id = ops[0];
                const member = ops[1];
                const decoration: Decoration = ops[2];
                ir.set_member_decoration_string(id, member, decoration, extract_string(ir.spirv, instruction.offset + 3));
                break;
            }

            // Build up basic types.
            case Op.TypeVoid: {
                const id = ops[0];
                const type = this.set<SPIRType>(SPIRType, id);
                type.basetype = SPIRBaseType.Void;
                break;
            }

            case Op.TypeBool: {
                const id = ops[0];
                const type = this.set<SPIRType>(SPIRType, id);
                type.basetype = SPIRBaseType.Boolean;
                type.width = 1;
                break;
            }

            case Op.TypeFloat: {
                const id = ops[0];
                const width = ops[1];
                const type = this.set<SPIRType>(SPIRType, id);
                if (width === 64)
                    type.basetype = SPIRBaseType.Double;
                else if (width === 32)
                    type.basetype = SPIRBaseType.Float;
                else if (width === 16)
                    type.basetype = SPIRBaseType.Half;
                else
                    throw new Error("Unrecognized bit-width of floating point type.");
                type.width = width;
                break;
            }

            case Op.TypeInt: {
                const id = ops[0];
                const width = ops[1];
                const signedness = ops[2] !== 0;
                const type = this.set<SPIRType>(SPIRType, id);
                type.basetype = signedness ? to_signed_basetype(width) : to_unsigned_basetype(width);
                type.width = width;
                break;
            }

            // Build composite types by "inheriting".
            // NOTE: The self member is also copied! For pointers and array modifiers this is a good thing
            // since we can refer to decorations on pointee classes which is needed for UBO/SSBO, I/O blocks in geometry/tess etc.
            case Op.TypeVector: {
                const id = ops[0];
                const vecsize = ops[2];

                const base = this.get<SPIRType>(SPIRType, ops[1]);
                const vecbase = this.set<SPIRType>(SPIRType, id);

                defaultCopy(base, vecbase);
                vecbase.vecsize = vecsize;
                vecbase.self = id;
                vecbase.parent_type = ops[1];
                break;
            }

            case Op.TypeMatrix: {
                const id = ops[0];
                const colcount = ops[2];

                const base = this.get<SPIRType>(SPIRType, ops[1]);
                const matrixbase = this.set<SPIRType>(SPIRType, id);

                defaultCopy(base, matrixbase);
                matrixbase.columns = colcount;
                matrixbase.self = id;
                matrixbase.parent_type = ops[1];
                break;
            }

            case Op.TypeArray: {
                const id = ops[0];
                const arraybase = this.set<SPIRType>(SPIRType, id);

                const tid = ops[1];
                const base = this.get<SPIRType>(SPIRType, tid);

                defaultCopy(base, arraybase);
                arraybase.parent_type = tid;

                const cid = ops[2];
                ir.mark_used_as_array_length(cid);
                const c = this.maybe_get<SPIRConstant>(SPIRConstant, cid);
                const literal = c && !c.specialization;

                // We're copying type information into Array types, so we'll need a fixup for any physical pointer
                // references.
                if (base.forward_pointer)
                    this.forward_pointer_fixups.push(new Pair(id, tid));

                arraybase.array_size_literal.push(literal);
                arraybase.array.push(literal ? c.scalar() : cid);
                // Do NOT set arraybase.self!
                break;
            }

            case Op.TypeRuntimeArray: {
                const id = ops[0];

                const base = this.get<SPIRType>(SPIRType, ops[1]);
                const arraybase = this.set<SPIRType>(SPIRType, id);

                // We're copying type information into Array types, so we'll need a fixup for any physical pointer
                // references.
                if (base.forward_pointer)
                    this.forward_pointer_fixups.push(new Pair(id, ops[1]));

                defaultCopy(base, arraybase);
                arraybase.array.push(0);
                arraybase.array_size_literal.push(true);
                arraybase.parent_type = ops[1];
                // Do NOT set arraybase.self!
                break;
            }

            case Op.TypeImage: {
                const id = ops[0];
                const type = this.set<SPIRType>(SPIRType, id);
                type.basetype = SPIRBaseType.Image;
                type.image.type = ops[1];
                type.image.dim = <Dim>(ops[2]);
                type.image.depth = ops[3] === 1;
                type.image.arrayed = ops[4] !== 0;
                type.image.ms = ops[5] !== 0;
                type.image.sampled = ops[6];
                type.image.format = <ImageFormat>(ops[7]);
                type.image.access = (length >= 9) ? <AccessQualifier>(ops[8]) : AccessQualifier.Max;
                break;
            }

            case Op.TypeSampledImage: {
                const id = ops[0];
                const imagetype = ops[1];
                const type = this.set<SPIRType>(SPIRType, id);
                defaultCopy(this.get<SPIRType>(SPIRType, imagetype), type);
                type.basetype = SPIRBaseType.SampledImage;
                type.self = id;
                break;
            }

            case Op.TypeSampler: {
                const id = ops[0];
                const type = this.set<SPIRType>(SPIRType, id);
                type.basetype = SPIRBaseType.Sampler;
                break;
            }

            case Op.TypePointer: {
                const id = ops[0];

                // Very rarely, we might receive a FunctionPrototype here.
                // We won't be able to compile it, but we shouldn't crash when parsing.
                // We should be able to reflect.
                const base = this.maybe_get<SPIRType>(SPIRType, ops[2]);
                const ptrbase = this.set<SPIRType>(SPIRType, id);

                if (base)
                    defaultCopy(base, ptrbase);

                ptrbase.pointer = true;
                ptrbase.pointer_depth++;
                ptrbase.storage = <StorageClass>(ops[1]);

                if (ptrbase.storage === StorageClass.AtomicCounter)
                    ptrbase.basetype = SPIRBaseType.AtomicCounter;

                if (base && base.forward_pointer)
                    this.forward_pointer_fixups.push(new Pair(id, ops[2]));

                ptrbase.parent_type = ops[2];

                // Do NOT set ptrbase.self!
                break;
            }

            case Op.TypeForwardPointer: {
                const id = ops[0];
                const ptrbase = this.set<SPIRType>(SPIRType, id);
                ptrbase.pointer = true;
                ptrbase.pointer_depth++;
                ptrbase.storage = <StorageClass>(ops[1]);
                ptrbase.forward_pointer = true;

                if (ptrbase.storage === StorageClass.AtomicCounter)
                    ptrbase.basetype = SPIRBaseType.AtomicCounter;

                break;
            }

            case Op.TypeStruct: {
                const id = ops[0];
                const type = this.set<SPIRType>(SPIRType, id);
                type.basetype = SPIRBaseType.Struct;
                for (let i = 1; i < length; i++)
                    type.member_types.push(ops[i]);

                // Check if we have seen this struct type before, with just different
                // decorations.
                //
                // Add workaround for issue #17 as well by looking at OpName for the struct
                // types, which we shouldn't normally do.
                // We should not normally have to consider type aliases like this to begin with
                // however ... glslang issues #304, #307 cover this.

                // For stripped names, never consider struct type aliasing.
                // We risk declaring the same struct multiple times, but type-punning is not allowed
                // so this is safe.
                const consider_aliasing = ir.get_name(type.self).length !== 0;
                if (consider_aliasing) {
                    for (let other of this.global_struct_cache) {
                        if (ir.get_name(type.self) === ir.get_name(other) &&
                            this.types_are_logically_equivalent(type, this.get<SPIRType>(SPIRType, other))) {
                            type.type_alias = other;
                            break;
                        }
                    }

                    if (type.type_alias === 0)
                        this.global_struct_cache.push(id);
                }
                break;
            }

            case Op.TypeFunction:
            {
                const id = ops[0];
                const ret = ops[1];

                const func = this.set<SPIRFunctionPrototype>(SPIRFunctionPrototype, id, ret);
                for (let i = 2; i < length; i++)
                    func.parameter_types.push(ops[i]);

                break;
            }

            case Op.TypeAccelerationStructureKHR:
            {
                const id = ops[0];
                const type = this.set<SPIRType>(SPIRType, id);
                type.basetype = SPIRBaseType.AccelerationStructure;
                break;
            }

            case Op.TypeRayQueryKHR:
            {
                const id = ops[0];
                const type = this.set<SPIRType>(SPIRType, id);
                type.basetype = SPIRBaseType.RayQuery;
                break;
            }

            // Variable declaration
            // All variables are essentially pointers with a storage qualifier.
            case Op.Variable:
            {
                const type = ops[0];
                const id = ops[1];
                const storage = <StorageClass>(ops[2]);
                const initializer = length === 4 ? ops[3] : 0;

                if (storage === StorageClass.Function)
                {
                    if (!this.current_function)
                        throw new Error("No function currently in scope");
                    this.current_function.add_local_variable(id);
                }

                this.set<SPIRVariable>(SPIRVariable, id, type, storage, initializer);
                break;
            }

            // OpPhi
            // OpPhi is a fairly magical opcode.
            // It selects temporary variables based on which parent block we *came from*.
            // In high-level languages we can "de-SSA" by creating a function local, and flush out temporaries to this function-local
            // variable to emulate SSA Phi.
            case Op.Phi:
            {
                if (!this.current_function)
                    throw new Error("No function currently in scope");
                if (!this.current_block)
                    throw new Error("No block currently in scope");

                const result_type = ops[0];
                const id = ops[1];

                // Instead of a temporary, create a new function-wide temporary with this ID instead.
                const var_ = this.set<SPIRVariable>(SPIRVariable, id, result_type, StorageClass.Function);
                var_.phi_variable = true;

                this.current_function.add_local_variable(id);

                for (let i = 2; i + 2 <= length; i += 2)
                    this.current_block.phi_variables.push(new SPIRBlockPhi(ops[i], ops[i + 1], id));

                break;
            }

            // Constants
            case Op.SpecConstant:
            case Op.Constant:
            {
                const id = ops[1];
                const type = this.get<SPIRType>(SPIRType, ops[0]);

                if (type.width > 32) {
                    this.set<SPIRConstant>(SPIRConstant, id, ops[0], bigintFrom(ops[3], ops[2]), op === Op.SpecConstant);
                }
                else
                    this.set<SPIRConstant>(SPIRConstant, id, ops[0], ops[2], op === Op.SpecConstant);
                break;
            }

            case Op.SpecConstantFalse:
            case Op.ConstantFalse:
            {
                this.set<SPIRConstant>(SPIRConstant, ops[1], ops[0], 0, op === Op.SpecConstantFalse);
                break;
            }

            case Op.SpecConstantTrue:
            case Op.ConstantTrue:
            {
                this.set<SPIRConstant>(SPIRConstant, ops[1], ops[0], 1, op === Op.SpecConstantTrue);
                break;
            }

            case Op.ConstantNull:
            {
                ir.make_constant_null(ops[1], ops[0], true);
                break;
            }

            case Op.SpecConstantComposite:
            case Op.ConstantComposite:
            {
                const id = ops[1];
                const type = ops[0];

                const ctype = this.get<SPIRType>(SPIRType, type);

                // We can have constants which are structs and arrays.
                // In this case, our SPIRConstant will be a list of other SPIRConstant ids which we
                // can refer to.
                if (ctype.basetype === SPIRBaseType.Struct || ctype.array.length !== 0)
                {
                    const elements = ops.slice(2);
                    this.set<SPIRConstant>(SPIRConstant, id, type, elements, length - 2, op === Op.SpecConstantComposite);
                }
                else
                {
                    const elements = length - 2;
                    if (elements > 4)
                        throw new Error("OpConstantComposite only supports 1, 2, 3 and 4 elements.");

                    const remapped_constant_ops: SPIRConstant[] = createWith(4, () => new SPIRConstant());
                    const c: SPIRConstant[] = new Array(4);
                    for (let i = 0; i < elements; i++)
                    {
                        // Specialization constants operations can also be part of this.
                        // We do not know their value, so any attempt to query SPIRConstant later
                        // will fail. We can only propagate the ID of the expression and use to_expression on it.
                        const constant_op = this.maybe_get<SPIRConstantOp>(SPIRConstantOp, ops[2 + i]);
                        const undef_op = this.maybe_get<SPIRUndef>(SPIRUndef, ops[2 + i]);
                        if (constant_op)
                        {
                            if (op === Op.ConstantComposite)
                                throw new Error("Specialization constant operation used in OpConstantComposite.");

                            remapped_constant_ops[i].make_null(this.get<SPIRType>(SPIRType, constant_op.basetype));
                            remapped_constant_ops[i].self = constant_op.self;
                            remapped_constant_ops[i].constant_type = constant_op.basetype;
                            remapped_constant_ops[i].specialization = true;
                            c[i] = remapped_constant_ops[i];
                        }
                        else if (undef_op)
                        {
                            // Undefined, just pick 0.
                            remapped_constant_ops[i].make_null(this.get<SPIRType>(SPIRType, undef_op.basetype));
                            remapped_constant_ops[i].constant_type = undef_op.basetype;
                            c[i] = remapped_constant_ops[i];
                        }
                        else
                            c[i] = this.get<SPIRConstant>(SPIRConstant, ops[2 + i]);
                    }
                    this.set<SPIRConstant>(SPIRConstant, id, type, c, elements, op === Op.SpecConstantComposite);
                }
                break;
            }

            // Functions
            case Op.Function:
            {
                const res = ops[0];
                const id = ops[1];
                // Control
                const type = ops[3];

                if (this.current_function)
                    throw new Error("Must end a function before starting a new one!");

                this.current_function = this.set<SPIRFunction>(SPIRFunction, id, res, type);
                break;
            }

            case Op.FunctionParameter:
            {
                const type = ops[0];
                const id = ops[1];

                if (!this.current_function)
                    throw new Error("Must be in a function!");

                this.current_function.add_parameter(type, id);
                this.set<SPIRVariable>(SPIRVariable, id, type, StorageClass.Function);
                break;
            }

            case Op.FunctionEnd:
            {
                if (this.current_block)
                {
                    // Very specific error message, but seems to come up quite often.
                    throw new Error("Cannot end a function before ending the current block.\n" +
                    "Likely cause: If this SPIR-V was created from glslang HLSL, make sure the entry point is valid.");
                }
                this.current_function = null;
                break;
            }

            // Blocks
            case Op.Label:
            {
                // OpLabel always starts a block.
                if (!this.current_function)
                    throw new Error("Blocks cannot exist outside functions!");

                const id = ops[0];

                this.current_function.blocks.push(id);
                if (!this.current_function.entry_block)
                    this.current_function.entry_block = id;

                if (this.current_block)
                    throw new Error("Cannot start a block before ending the current block.");

                this.current_block = this.set<SPIRBlock>(SPIRBlock, id);
                break;
            }

            // Branch instructions end blocks.
            case Op.Branch:
            {
                if (!this.current_block)
                    throw new Error("Trying to end a non-existing block.");

                const target = ops[0];
                const current_block = this.current_block;
                current_block.terminator = SPIRBlockTerminator.Direct;
                current_block.next_block = target;
                this.current_block = null;
                break;
            }

            case Op.BranchConditional:
            {
                if (!this.current_block)
                    throw new Error("Trying to end a non-existing block.");

                const current_block = this.current_block;
                current_block.condition = ops[0];
                current_block.true_block = ops[1];
                current_block.false_block = ops[2];
                current_block.terminator = SPIRBlockTerminator.Select;

                if (current_block.true_block === current_block.false_block)
                {
                    // Bogus conditional, translate to a direct branch.
                    // Avoids some ugly edge cases later when analyzing CFGs.

                    // There are some super jank cases where the merge block is different from the true/false,
                    // and later branches can "break" out of the selection construct this way.
                    // This is complete nonsense, but CTS hits this case.
                    // In this scenario, we should see the selection construct as more of a Switch with one default case.
                    // The problem here is that this breaks any attempt to break out of outer switch statements,
                    // but it's theoretically solvable if this ever comes up using the ladder breaking system ...

                    if (current_block.true_block !== current_block.next_block && current_block.merge === SPIRBlockMerge.Selection)
                    {
                        const ids = ir.increase_bound_by(2);

                        const type = new SPIRType();
                        type.basetype = SPIRBaseType.Int;
                        type.width = 32;
                        this.set<SPIRType>(SPIRType, ids, type);
                        const c = this.set<SPIRConstant>(SPIRConstant, ids + 1, ids);

                        current_block.condition = c.self;
                        current_block.default_block = current_block.true_block;
                        current_block.terminator = SPIRBlockTerminator.MultiSelect;
                        ir.block_meta[current_block.next_block] = ir.block_meta[current_block.next_block] || 0;
                        ir.block_meta[current_block.next_block] &= ~BlockMetaFlagBits.SELECTION_MERGE_BIT;
                        ir.block_meta[current_block.next_block] |= BlockMetaFlagBits.MULTISELECT_MERGE_BIT;
                    }
                else
                    {
                        ir.block_meta[current_block.next_block] = ir.block_meta[current_block.next_block] || 0;
                        ir.block_meta[current_block.next_block] &= ~BlockMetaFlagBits.SELECTION_MERGE_BIT;
                        current_block.next_block = current_block.true_block;
                        current_block.condition = 0;
                        current_block.true_block = 0;
                        current_block.false_block = 0;
                        current_block.merge_block = 0;
                        current_block.merge = SPIRBlockMerge.None;
                        current_block.terminator = SPIRBlockTerminator.Direct;
                    }
                }

                this.current_block = null;
                break;
            }

            case Op.Switch:
            {
                const current_block = this.current_block;

                if (!current_block)
                    throw new Error("Trying to end a non-existing block.");

                current_block.terminator = SPIRBlockTerminator.MultiSelect;

                current_block.condition = ops[0];
                current_block.default_block = ops[1];

                const remaining_ops = length - 2;
                if ((remaining_ops % 2) === 0)
                {
                    for (let i = 2; i + 2 <= length; i += 2)
                        current_block.cases_32bit.push(new SPIRBlockCase(BigInt(ops[i]), ops[i + 1]));
                }

                if ((remaining_ops % 3) === 0)
                {
                    for (let i = 2; i + 3 <= length; i += 3)
                    {
                        current_block.cases_64bit.push(new SPIRBlockCase(bigintFrom(ops[i+1], ops[i]), ops[i + 2]));
                    }
                }

                // If we jump to next block, make it break instead since we're inside a switch case block at that point.
                ir.block_meta[current_block.next_block] = ir.block_meta[current_block.next_block] || 0;
                ir.block_meta[current_block.next_block] |= BlockMetaFlagBits.MULTISELECT_MERGE_BIT;

                this.current_block = null;
                break;
            }

            case Op.Kill:
            {
                if (!this.current_block)
                    throw new Error("Trying to end a non-existing block.");
                this.current_block.terminator = SPIRBlockTerminator.Kill;
                this.current_block = null;
                break;
            }

            case Op.TerminateRayKHR:
                // NV variant is not a terminator.
                if (!this.current_block)
                    throw new Error("Trying to end a non-existing block.");
                this.current_block.terminator = SPIRBlockTerminator.TerminateRay;
                this.current_block = null;
                break;

            case Op.IgnoreIntersectionKHR:
                // NV variant is not a terminator.
                if (!this.current_block)
                    throw new Error("Trying to end a non-existing block.");
                this.current_block.terminator = SPIRBlockTerminator.IgnoreIntersection;
                this.current_block = null;
                break;

            case Op.Return:
            {
                if (!this.current_block)
                    throw new Error("Trying to end a non-existing block.");
                this.current_block.terminator = SPIRBlockTerminator.Return;
                this.current_block = null;
                break;
            }

            case Op.ReturnValue:
            {
                const current_block = this.current_block;

                if (!current_block)
                    throw new Error("Trying to end a non-existing block.");

                current_block.terminator = SPIRBlockTerminator.Return;
                current_block.return_value = ops[0];
                this.current_block = null;
                break;
            }

            case Op.Unreachable:
            {
                if (!this.current_block)
                    throw new Error("Trying to end a non-existing block.");
                this.current_block.terminator = SPIRBlockTerminator.Unreachable;
                this.current_block = null;
                break;
            }

            case Op.SelectionMerge:
            {
                const current_block = this.current_block;

                if (!current_block)
                    throw new Error("Trying to modify a non-existing block.");

                current_block.next_block = ops[0];
                current_block.merge = SPIRBlockMerge.Selection;
                ir.block_meta[current_block.next_block] = ir.block_meta[current_block.next_block] || 0;
                ir.block_meta[current_block.next_block] |= BlockMetaFlagBits.SELECTION_MERGE_BIT;

                if (length >= 2)
                {
                    if (ops[1] & SelectionControlMask.Flatten)
                        current_block.hint = SPIRBlockHints.Flatten;
                    else if (ops[1] & SelectionControlMask.DontFlatten)
                        current_block.hint = SPIRBlockHints.DontFlatten;
                }
                break;
            }

            case Op.LoopMerge:
            {
                const current_block = this.current_block;
                if (!current_block)
                    throw new Error("Trying to modify a non-existing block.");

                current_block.merge_block = ops[0];
                current_block.continue_block = ops[1];
                current_block.merge = SPIRBlockMerge.Loop;

                ir.block_meta[current_block.self] = ir.block_meta[current_block.self] || 0;
                ir.block_meta[current_block.self] |= BlockMetaFlagBits.LOOP_HEADER_BIT;
                ir.block_meta[current_block.merge_block] = ir.block_meta[current_block.merge_block] || 0;
                ir.block_meta[current_block.merge_block] |= BlockMetaFlagBits.LOOP_MERGE_BIT;

                ir.continue_block_to_loop_header[current_block.continue_block] = <BlockID>current_block.self;

                // Don't add loop headers to continue blocks,
                // which would make it impossible branch into the loop header since
                // they are treated as continues.
                if (current_block.continue_block !== <BlockID>current_block.self) {
                    ir.block_meta[current_block.continue_block] = ir.block_meta[current_block.continue_block] || 0;
                    ir.block_meta[current_block.continue_block] |= BlockMetaFlagBits.CONTINUE_BIT;
                }

                if (length >= 3)
                {
                    if (ops[2] & LoopControlMask.Unroll)
                        current_block.hint = SPIRBlockHints.Unroll;
                    else if (ops[2] & LoopControlMask.DontUnroll)
                        current_block.hint = SPIRBlockHints.DontUnroll;
                }
                break;
            }

            case Op.SpecConstantOp:
            {
                if (length < 3)
                    throw new Error("OpSpecConstantOp not enough arguments.");

                const result_type = ops[0];
                const id = ops[1];
                const spec_op = <Op>(ops[2]);

                this.set<SPIRConstantOp>(SPIRConstantOp, id, result_type, spec_op, ops.slice(3));
                break;
            }

            case Op.Line:
            {
                const current_block = this.current_block;
                // OpLine might come at global scope, but we don't care about those since they will not be declared in any
                // meaningful correct order.
                // Ignore all OpLine directives which live outside a function.
                if (current_block)
                    current_block.ops.push(instruction);

                // Line directives may arrive before first OpLabel.
                // Treat this as the line of the function declaration,
                // so warnings for arguments can propagate properly.
                const current_function = this.current_function;
                if (current_function)
                {
                    // Store the first one we find and emit it before creating the function prototype.
                    if (current_function.entry_line.file_id === 0)
                    {
                        current_function.entry_line.file_id = ops[0];
                        current_function.entry_line.line_literal = ops[1];
                    }
                }
                break;
            }

            case Op.NoLine:
            {
                // OpNoLine might come at global scope.
                if (this.current_block)
                    this.current_block.ops.push(instruction);
                break;
            }

            // Actual opcodes.
            default:
                if (length >= 2)
                {
                    const type = this.maybe_get<SPIRType>(SPIRType, ops[0]);
                    if (type)
                    {
                        ir.load_type_width[ops[1]] = type.width;
                    }
                }
                if (!this.current_block)
                    throw new Error("Currently no block to insert opcode.");

                this.current_block.ops.push(instruction);
                break;
        }
    }

    private stream(instr: Instruction)
    {
        if (instr.length === 0)
            return null;

        if (instr.offset + instr.length > this.ir.spirv.length)
            throw new Error("Compiler::stream() out of range.");

        return this.ir.spirv.slice(instr.offset, instr.offset + instr.length);
    }

    private set<T extends IVariant>(classRef: IVariantType<T>, id: number, ...args)
    {
        this.ir.add_typed_id(classRef.type, id);
        let v = variant_set<T>(classRef, this.ir.ids[id], ...args);
        v.self = id;
        return v;
    }

    get<T extends IVariant>(classRef: IVariantType<T>, id: number)
    {
        return variant_get<T>(classRef, this.ir.ids[id]);
    }

    maybe_get<T extends IVariant>(classRef: IVariantType<T>, id: number)
    {
        if (this.ir.ids[id].get_type() === classRef.type)
            return this.get<T>(classRef, id);
        else
            return null;
    }

    types_are_logically_equivalent(a: SPIRType, b: SPIRType): boolean
    {
        if (a.basetype !== b.basetype)
            return false;
        if (a.width !== b.width)
            return false;
        if (a.vecsize !== b.vecsize)
            return false;
        if (a.columns !== b.columns)
            return false;

        if (!equals(a.array, b.array))
            return false;

        if (a.basetype === SPIRBaseType.Image || a.basetype === SPIRBaseType.SampledImage) {
            if (!a.image.equals(b.image))
                return false;
        }

        if (!equals(a.member_types, b.member_types))
            return false;

        const member_types = a.member_types.length;
        for (let i = 0; i < member_types; i++) {
            if (!this.types_are_logically_equivalent(this.get<SPIRType>(SPIRType, a.member_types[i]), this.get<SPIRType>(SPIRType, b.member_types[i])))
                return false;
        }

        return true;
    }
}

function swap_endian(v: number): number
{
    return ((v >> 24) & 0x000000ff) | ((v >> 8) & 0x0000ff00) | ((v << 8) & 0x00ff0000) | ((v << 24) & 0xff000000);
}

function is_valid_spirv_version(version: number): boolean
{
    switch (version) {
        // Allow v99 since it tends to just work.
        case 99:
        case 0x10000: // SPIR-V 1.0
        case 0x10100: // SPIR-V 1.1
        case 0x10200: // SPIR-V 1.2
        case 0x10300: // SPIR-V 1.3
        case 0x10400: // SPIR-V 1.4
        case 0x10500: // SPIR-V 1.5
            return true;

        default:
            return false;
    }
}

function extract_string(spirv: Uint32Array, offset: number): string
{
    let ret = "";
    for (let i = offset; i < spirv.length; i++) {
        let w = spirv[i];

        for (let j = 0; j < 4; j++, w >>= 8) {
            const c = w & 0xff;
            if (c === 0)
                return ret;

            ret = ret + String.fromCharCode(c);
        }
    }

    throw new Error("String was not terminated before EOF");
}

function decoration_is_string(decoration: Decoration): boolean
{
    switch (decoration) {
        case Decoration.HlslSemanticGOOGLE:
            return true;

        default:
            return false;
    }
}

function to_signed_basetype(width: number): SPIRBaseType
{
    switch (width) {
        case 8:
            return SPIRBaseType.SByte;
        case 16:
            return SPIRBaseType.Short;
        case 32:
            return SPIRBaseType.Int;
        case 64:
            return SPIRBaseType.Int64;
        default:
            throw new Error("Invalid bit width.");
    }
}

function to_unsigned_basetype(width: number): SPIRBaseType
{
    switch (width) {
        case 8:
            return SPIRBaseType.UByte;
        case 16:
            return SPIRBaseType.UShort;
        case 32:
            return SPIRBaseType.UInt;
        case 64:
            return SPIRBaseType.UInt64;
        default:
            throw new Error("Invalid bit width.");
    }
}