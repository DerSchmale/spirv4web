// @ts-ignore
import { createWith, removeAllElements } from "@derschmale/array-utils";
import { Variant, variant_get, variant_set } from "../common/Variant";
import { ObjectPoolGroup } from "../common/ObjectPoolGroup";
import { Meta, MetaDecoration } from "../common/Meta";
import { Types } from "../common/Types";
import { AddressingModel, Capability, Decoration, FPRoundingMode, ImageFormat, MemoryModel, Op } from "../spirv";
import { SPIREntryPoint } from "../common/SPIREntryPoint";
import { Bitset } from "../common/Bitset";
import { MemberPointer, Pointer } from "../utils/Pointer";
import { SPIRVariable } from "../common/SPIRVariable";
import { SPIRType, SPIRTypeBaseType } from "../common/SPIRType";
import { SPIRConstant } from "../common/SPIRConstant";
import { SPIRConstantOp } from "../common/SPIRConstantOp";
import { IVariant, IVariantType } from "../common/IVariant";
import { ObjectPool } from "../containers/ObjectPool";
import { SPIRFunction } from "../common/SPIRFunction";
import { SPIRFunctionPrototype } from "../common/SPIRFunctionPrototype";
import { SPIRBlock } from "../common/SPIRBlock";
import { SPIRExtension } from "../common/SPIRExtension";
import { SPIRExpression } from "../common/SPIRExpression";
import { SPIRCombinedImageSampler } from "../common/SPIRCombinedImageSampler";
import { SPIRAccessChain } from "../common/SPIRAccessChain";
import { SPIRUndef } from "../common/SPIRUndef";
import { SPIRString } from "../common/SPIRString";
import { replaceCharAt } from "../utils/string";

// Meta data about blocks. The cross-compiler needs to query if a block is either of these types.
// It is a bitset as there can be more than one tag per block.
export enum BlockMetaFlagBits
{
    BLOCK_META_LOOP_HEADER_BIT = 1 << 0,
    BLOCK_META_CONTINUE_BIT = 1 << 1,
    BLOCK_META_LOOP_MERGE_BIT = 1 << 2,
    BLOCK_META_SELECTION_MERGE_BIT = 1 << 3,
    BLOCK_META_MULTISELECT_MERGE_BIT = 1 << 4
}

class Source
{
    version: number = 0;
    es: boolean = false;
    known: boolean = false;
    hlsl: boolean = false;
}

type BlockMetaFlags = number;

class LoopLock
{
    private lock: MemberPointer<ParsedIR, number> | Pointer<number>;

    // is normally a pointer
    constructor(lock: MemberPointer<ParsedIR, number> | Pointer<number>)
    {
        this.lock = lock;
        this.lock.set(this.lock.get() + 1);
    }

    // IMPORTANT TO CALL THIS MANUALLY SINCE WE DON'T HAVE DESTRUCTORS
    dispose()
    {
        this.lock.set(this.lock.get() - 1);
    }
}

export class ParsedIR
{
    // TODO: Reimplement pool group?
    private pool_group: ObjectPoolGroup;

    spirv: Uint32Array;
    ids: Variant[] = [];

    // Various meta data for IDs, decorations, names, etc.
    // this is actually a Map<ID, Meta>, so we use a sparse array so we can use the same [id] syntax
    meta: Meta[] = [];

    // Holds all IDs which have a certain type.
    // This is needed so we can iterate through a specific kind of resource quickly,
    // and in-order of module declaration.
    ids_for_type: ID[][] = new Array(Types.TypeCount);

    // Special purpose lists which contain a union of types.
    // This is needed so we can declare specialization constants and structs in an interleaved fashion,
    // among other things.
    // Constants can be of struct type, and struct array sizes can use specialization constants.
    ids_for_constant_or_type: ID[] = [];
    ids_for_constant_or_variable: ID[] = [];

    // We need to keep track of the width the Ops that contains a type for the
    // OpSwitch instruction, since this one doesn't contains the type in the
    // instruction itself. And in some case we need to cast the condition to
    // wider types. We only need the width to do the branch fixup since the
    // type check itself can be done at runtime
    load_type_width: number[] = [];

    // Declared capabilities and extensions in the SPIR-V module.
    // Not really used except for reflection at the moment.
    declared_capabilities: Capability[] = [];
    declared_extensions: string[] = [];

    // Meta data about blocks. The cross-compiler needs to query if a block is either of these types.
    // It is a bitset as there can be more than one tag per block.
    block_meta: number[] = [];
    continue_block_to_loop_header: BlockID[] = [];  // map

    // Normally, we'd stick SPIREntryPoint in ids array, but it conflicts with SPIRFunction.
    // Entry points can therefore be seen as some sort of meta structure.
    entry_points: SPIREntryPoint[] = [];
    default_entry_point: FunctionID = 0;

    source: Source = new Source();

    addressing_model: AddressingModel = AddressingModel.AddressingModelMax;
    memory_model: MemoryModel = MemoryModel.MemoryModelMax;

    private loop_iteration_depth_hard: number = 0;
    private loop_iteration_depth_soft: number = 0;
    private empty_string: string = "";
    private cleared_bitset: Bitset = new Bitset();

    private meta_needing_name_fixup: Set<number> = new Set();

    constructor()
    {
        for (let i = 0; i < this.ids_for_type.length; ++i)
            this.ids_for_type[i] = [];

        // we're not using pools for now because we don't have destructors
        this.pool_group = new ObjectPoolGroup();
        this.pool_group.pools[Types.TypeType] = new ObjectPool(SPIRType);
        this.pool_group.pools[Types.TypeVariable] = new ObjectPool(SPIRVariable);
        this.pool_group.pools[Types.TypeConstant] = new ObjectPool(SPIRConstant);
        this.pool_group.pools[Types.TypeFunction] = new ObjectPool(SPIRFunction);
        this.pool_group.pools[Types.TypeFunctionPrototype] = new ObjectPool(SPIRFunctionPrototype);
        this.pool_group.pools[Types.TypeBlock] = new ObjectPool(SPIRBlock);
        this.pool_group.pools[Types.TypeExtension] = new ObjectPool(SPIRExtension);
        this.pool_group.pools[Types.TypeExpression] = new ObjectPool(SPIRExpression);
        this.pool_group.pools[Types.TypeConstantOp] = new ObjectPool(SPIRConstantOp);
        this.pool_group.pools[Types.TypeCombinedImageSampler] = new ObjectPool(SPIRCombinedImageSampler);
        this.pool_group.pools[Types.TypeAccessChain] = new ObjectPool(SPIRAccessChain);
        this.pool_group.pools[Types.TypeUndef] = new ObjectPool(SPIRUndef);
        this.pool_group.pools[Types.TypeString] = new ObjectPool(SPIRString);
    }

    // Resizes ids, meta and block_meta.
    set_id_bounds(bounds: number)
    {
        this.ids = createWith(bounds, () => new Variant(this.pool_group));
        this.block_meta = createWith(bounds, () => 0);
    }

    // Decoration handling methods.
    // Can be useful for simple "raw" reflection.
    // However, most members are here because the Parser needs most of these,
    // and might as well just have the whole suite of decoration/name handling in one place.
    set_name(id: ID, name: string)
    {
        let m = this.get_meta(id);
        m.decoration.alias = name;
        if (!is_valid_identifier(name) || is_reserved_identifier(name, false, false))
            this.meta_needing_name_fixup.add(id);
    }

    get_name(id: ID): string
    {
        let m = this.find_meta(id);
        if (m)
            return m.decoration.alias;
        else
            return this.empty_string;
    }

    set_decoration(id: ID, decoration: Decoration, argument: number = 0)
    {
        const dec = this.get_meta(id).decoration;
        dec.decoration_flags.set(decoration);

        switch (decoration) {
            case Decoration.DecorationBuiltIn:
                dec.builtin = true;
                dec.builtin_type = argument;
                break;

            case Decoration.DecorationLocation:
                dec.location = argument;
                break;

            case Decoration.DecorationComponent:
                dec.component = argument;
                break;

            case Decoration.DecorationOffset:
                dec.offset = argument;
                break;

            case Decoration.DecorationXfbBuffer:
                dec.xfb_buffer = argument;
                break;

            case Decoration.DecorationXfbStride:
                dec.xfb_stride = argument;
                break;

            case Decoration.DecorationStream:
                dec.stream = argument;
                break;

            case Decoration.DecorationArrayStride:
                dec.array_stride = argument;
                break;

            case Decoration.DecorationMatrixStride:
                dec.matrix_stride = argument;
                break;

            case Decoration.DecorationBinding:
                dec.binding = argument;
                break;

            case Decoration.DecorationDescriptorSet:
                dec.set = argument;
                break;

            case Decoration.DecorationInputAttachmentIndex:
                dec.input_attachment = argument;
                break;

            case Decoration.DecorationSpecId:
                dec.spec_id = argument;
                break;

            case Decoration.DecorationIndex:
                dec.index = argument;
                break;

            case Decoration.DecorationHlslCounterBufferGOOGLE:
                this.get_meta(id).hlsl_magic_counter_buffer = argument;
                this.meta[argument].hlsl_is_magic_counter_buffer = true;
                break;

            case Decoration.DecorationFPRoundingMode:
                dec.fp_rounding_mode = argument;
                break;

            default:
                break;
        }
    }

    set_decoration_string(id: ID, decoration: Decoration, argument: string)
    {
        const dec = this.get_meta(id).decoration;
        dec.decoration_flags.set(decoration);

        switch (decoration) {
            case Decoration.DecorationHlslSemanticGOOGLE:
                dec.hlsl_semantic = argument;
                break;

            default:
                break;
        }
    }

    has_decoration(id: ID, decoration: Decoration): boolean
    {
        return this.get_decoration_bitset(id).get(decoration);
    }

    get_decoration(id: ID, decoration: Decoration): number
    {
        const m = this.find_meta(id);
        if (!m)
            return 0;

        const dec = m.decoration;
        if (!dec.decoration_flags.get(decoration))
            return 0;

        switch (decoration) {
            case Decoration.DecorationBuiltIn:
                return dec.builtin_type;
            case Decoration.DecorationLocation:
                return dec.location;
            case Decoration.DecorationComponent:
                return dec.component;
            case Decoration.DecorationOffset:
                return dec.offset;
            case Decoration.DecorationXfbBuffer:
                return dec.xfb_buffer;
            case Decoration.DecorationXfbStride:
                return dec.xfb_stride;
            case Decoration.DecorationStream:
                return dec.stream;
            case Decoration.DecorationBinding:
                return dec.binding;
            case Decoration.DecorationDescriptorSet:
                return dec.set;
            case Decoration.DecorationInputAttachmentIndex:
                return dec.input_attachment;
            case Decoration.DecorationSpecId:
                return dec.spec_id;
            case Decoration.DecorationArrayStride:
                return dec.array_stride;
            case Decoration.DecorationMatrixStride:
                return dec.matrix_stride;
            case Decoration.DecorationIndex:
                return dec.index;
            case Decoration.DecorationFPRoundingMode:
                return dec.fp_rounding_mode;
            default:
                return 1;
        }
    }

    get_decoration_string(id: ID, decoration: Decoration): string
    {
        const m = this.find_meta(id);
        if (!m)
            return this.empty_string;

        const dec = m.decoration;

        if (!dec.decoration_flags.get(decoration))
            return this.empty_string;

        switch (decoration) {
            case Decoration.DecorationHlslSemanticGOOGLE:
                return dec.hlsl_semantic;

            default:
                return this.empty_string;
        }
    }

    get_decoration_bitset(id: ID): Bitset
    {
        const m = this.find_meta(id);
        if (m) {
            const dec = m.decoration;
            return dec.decoration_flags;
        }
        else
            return this.cleared_bitset;
    }

    unset_decoration(id: ID, decoration: Decoration)
    {
        const dec = this.get_meta(id).decoration;
        dec.decoration_flags.clear(decoration);

        switch (decoration) {
            case Decoration.DecorationBuiltIn:
                dec.builtin = false;
                break;

            case Decoration.DecorationLocation:
                dec.location = 0;
                break;

            case Decoration.DecorationComponent:
                dec.component = 0;
                break;

            case Decoration.DecorationOffset:
                dec.offset = 0;
                break;

            case Decoration.DecorationXfbBuffer:
                dec.xfb_buffer = 0;
                break;

            case Decoration.DecorationXfbStride:
                dec.xfb_stride = 0;
                break;

            case Decoration.DecorationStream:
                dec.stream = 0;
                break;

            case Decoration.DecorationBinding:
                dec.binding = 0;
                break;

            case Decoration.DecorationDescriptorSet:
                dec.set = 0;
                break;

            case Decoration.DecorationInputAttachmentIndex:
                dec.input_attachment = 0;
                break;

            case Decoration.DecorationSpecId:
                dec.spec_id = 0;
                break;

            case Decoration.DecorationHlslSemanticGOOGLE:
                dec.hlsl_semantic = "";
                break;

            case Decoration.DecorationFPRoundingMode:
                dec.fp_rounding_mode = FPRoundingMode.FPRoundingModeMax;
                break;

            case Decoration.DecorationHlslCounterBufferGOOGLE: {
                const meta = this.get_meta(id);
                const counter = meta.hlsl_magic_counter_buffer;
                if (counter) {
                    this.meta[counter].hlsl_is_magic_counter_buffer = false;
                    meta.hlsl_magic_counter_buffer = 0;
                }
                break;
            }

            default:
                break;
        }
    }

    private resize_members(members: MetaDecoration[], len: number)
    {
        const old = members.length;
        members.length = len;

        for (let i = old; i < len; ++i) {
            members[i] = new MetaDecoration();
        }
    }

    // Decoration handling methods (for members of a struct).
    set_member_name(id: TypeID, index: number, name: string)
    {
        const m = this.get_meta(id);
        this.resize_members(m.members, Math.max(m.members.length, index + 1))

        m.members[index].alias = name;
        if (!is_valid_identifier(name) || is_reserved_identifier(name, true, false))
            this.meta_needing_name_fixup.add(id);
    }

    get_member_name(id: TypeID, index: number): string
    {
        const m = this.find_meta(id);
        if (m) {
            if (index >= m.members.length)
                return this.empty_string;
            return m.members[index].alias;
        }
        else
            return this.empty_string;
    }

    set_member_decoration(id: TypeID, index: number, decoration: Decoration, argument: number = 0)
    {
        // 5 = size_t(index) + 1
        const m = this.get_meta(id);
        this.resize_members(m.members, Math.max(m.members.length, index + 1))
        const dec = m.members[index];
        dec.decoration_flags.set(decoration);

        switch (decoration) {
            case Decoration.DecorationBuiltIn:
                dec.builtin = true;
                dec.builtin_type = argument;
                break;

            case Decoration.DecorationLocation:
                dec.location = argument;
                break;

            case Decoration.DecorationComponent:
                dec.component = argument;
                break;

            case Decoration.DecorationBinding:
                dec.binding = argument;
                break;

            case Decoration.DecorationOffset:
                dec.offset = argument;
                break;

            case Decoration.DecorationXfbBuffer:
                dec.xfb_buffer = argument;
                break;

            case Decoration.DecorationXfbStride:
                dec.xfb_stride = argument;
                break;

            case Decoration.DecorationStream:
                dec.stream = argument;
                break;

            case Decoration.DecorationSpecId:
                dec.spec_id = argument;
                break;

            case Decoration.DecorationMatrixStride:
                dec.matrix_stride = argument;
                break;

            case Decoration.DecorationIndex:
                dec.index = argument;
                break;

            default:
                break;
        }
    }

    set_member_decoration_string(id: TypeID, index: number, decoration: Decoration, argument: string)
    {
        const m = this.get_meta(id);
        // 5 = size_t(index) + 1)
        this.resize_members(m.members, Math.max(m.members.length, index + 1))
        const dec = m.members[index];
        dec.decoration_flags.set(decoration);

        switch (decoration) {
            case Decoration.DecorationHlslSemanticGOOGLE:
                dec.hlsl_semantic = argument;
                break;

            default:
                break;
        }
    }

    get_member_decoration(id: TypeID, index: number, decoration: Decoration): number
    {
        const m = this.find_meta(id);
        if (!m)
            return 0;

        if (index >= m.members.length)
            return 0;

        const dec = m.members[index];
        if (!dec.decoration_flags.get(decoration))
            return 0;

        switch (decoration) {
            case Decoration.DecorationBuiltIn:
                return dec.builtin_type;
            case Decoration.DecorationLocation:
                return dec.location;
            case Decoration.DecorationComponent:
                return dec.component;
            case Decoration.DecorationBinding:
                return dec.binding;
            case Decoration.DecorationOffset:
                return dec.offset;
            case Decoration.DecorationXfbBuffer:
                return dec.xfb_buffer;
            case Decoration.DecorationXfbStride:
                return dec.xfb_stride;
            case Decoration.DecorationStream:
                return dec.stream;
            case Decoration.DecorationSpecId:
                return dec.spec_id;
            case Decoration.DecorationIndex:
                return dec.index;
            default:
                return 1;
        }
    }

    get_member_decoration_string(id: TypeID, index: number, decoration: Decoration): string
    {
        const m = this.find_meta(id);
        if (m) {
            if (!this.has_member_decoration(id, index, decoration))
                return this.empty_string;

            const dec = m.members[index];

            switch (decoration) {
                case Decoration.DecorationHlslSemanticGOOGLE:
                    return dec.hlsl_semantic;

                default:
                    return this.empty_string;
            }
        }
        else
            return this.empty_string;
    }

    has_member_decoration(id: TypeID, index: number, decoration: Decoration): boolean
    {
        return this.get_member_decoration_bitset(id, index).get(decoration);
    }

    get_member_decoration_bitset(id: TypeID, index: number): Bitset
    {
        const m = this.find_meta(id);
        if (m) {
            if (index >= m.members.length)
                return this.cleared_bitset.clone();
            return m.members[index].decoration_flags;
        }
        else
            return this.cleared_bitset.clone();
    }

    unset_member_decoration(id: TypeID, index: number, decoration: Decoration)
    {
        const m = this.get_meta(id);
        if (index >= m.members.length)
            return;

        const dec = m.members[index];

        dec.decoration_flags.clear(decoration);
        switch (decoration) {
            case Decoration.DecorationBuiltIn:
                dec.builtin = false;
                break;

            case Decoration.DecorationLocation:
                dec.location = 0;
                break;

            case Decoration.DecorationComponent:
                dec.component = 0;
                break;

            case Decoration.DecorationOffset:
                dec.offset = 0;
                break;

            case Decoration.DecorationXfbBuffer:
                dec.xfb_buffer = 0;
                break;

            case Decoration.DecorationXfbStride:
                dec.xfb_stride = 0;
                break;

            case Decoration.DecorationStream:
                dec.stream = 0;
                break;

            case Decoration.DecorationSpecId:
                dec.spec_id = 0;
                break;

            case Decoration.DecorationHlslSemanticGOOGLE:
                dec.hlsl_semantic = "";
                break;

            default:
                break;
        }
    }

    mark_used_as_array_length(id: ID)
    {
        switch (this.ids[id].get_type())
        {
            case Types.TypeConstant:
                this.get<SPIRConstant>(SPIRConstant, id).is_used_as_array_length = true;
                break;

            case Types.TypeConstantOp:
            {
                const cop = this.get<SPIRConstantOp>(SPIRConstantOp, id);
                if (cop.opcode === Op.OpCompositeExtract)
                    this.mark_used_as_array_length(cop.arguments[0]);
                else if (cop.opcode === Op.OpCompositeInsert)
                {
                    this.mark_used_as_array_length(cop.arguments[0]);
                    this.mark_used_as_array_length(cop.arguments[1]);
                }
                else
                    for (let arg_id of cop.arguments)
                        this.mark_used_as_array_length(arg_id);
                break;
            }

            case Types.TypeUndef:
                break;

            default:
                throw new Error("Shouldn't reach this branch");
        }
    }

    get_buffer_block_flags(var_: SPIRVariable): Bitset
    {
        const type = this.get(SPIRType, var_.basetype);
        if (type.basetype !== SPIRTypeBaseType.Struct) {
            throw new Error("Assertion failure");
        }

        // Some flags like non-writable, non-readable are actually found
        // as member decorations. If all members have a decoration set, propagate
        // the decoration up as a regular variable decoration.
        let base_flags: Bitset;
        const m = this.find_meta(var_.self);
        if (m)
            base_flags = m.decoration.decoration_flags.clone();
        else
            base_flags = new Bitset();

        if (type.member_types.length === 0)
            return base_flags?.clone() || new Bitset();

        const all_members_flags = this.get_buffer_block_type_flags(type);
        base_flags.merge_or(all_members_flags);
        return base_flags;
    }

    get_buffer_block_type_flags(type: SPIRType): Bitset
    {
        if (type.member_types.length === 0)
            return new Bitset();

        // make sure we're not overriding anything, so clone
        const all_members_flags = this.get_member_decoration_bitset(type.self, 0).clone();
        for (let i = 1; i < type.member_types.length; i++)
            all_members_flags.merge_and(this.get_member_decoration_bitset(type.self, i));
        return all_members_flags;
    }

    add_typed_id(type: Types, id: ID)
    {
        if (this.loop_iteration_depth_hard !== 0)
            throw new Error("Cannot add typed ID while looping over it.");

        const _id = this.ids[id];
        if (this.loop_iteration_depth_soft !== 0)
        {
            if (!_id.empty())
                throw new Error("Cannot override IDs when loop is soft locked.");
        }

        if (_id.empty() || _id.get_type() !== type)
        {
            switch (type)
            {
                case Types.TypeConstant:
                    this.ids_for_constant_or_variable.push(id);
                    this.ids_for_constant_or_type.push(id);
                    break;

                case Types.TypeVariable:
                    this.ids_for_constant_or_variable.push(id);
                    break;

                case Types.TypeType:
                case Types.TypeConstantOp:
                    this.ids_for_constant_or_type.push(id);
                    break;

                default:
                    break;
            }
        }

        if (_id.empty())
        {
            this.ids_for_type[type].push(id);
        }
        else if (_id.get_type() !== type)
        {
            this.remove_typed_id(_id.get_type(), id);
            this.ids_for_type[type].push(id);
        }
    }

    remove_typed_id(type: Types, id: ID)
    {
        removeAllElements(this.ids_for_type[type], id);
    }

    // This must be held while iterating over a type ID array.
    // It is undefined if someone calls set<>() while we're iterating over a data structure, so we must
    // make sure that this case is avoided.

    // If we have a hard lock, it is an error to call set<>(), and an exception is thrown.
    // If we have a soft lock, we silently ignore any additions to the typed arrays.
    // This should only be used for physical ID remapping where we need to create an ID, but we will never
    // care about iterating over them.
    create_loop_hard_lock(): LoopLock
    {
        return new LoopLock(new MemberPointer(this, "loop_iteration_depth_hard"));
    }

    create_loop_soft_lock(): LoopLock
    {
        return new LoopLock(new MemberPointer(this, "loop_iteration_depth_soft"));
    }

    for_each_typed_id<T extends IVariant>(classRef: IVariantType<T>, op: (id: ID, t: T) => void)
    {
        let loop_lock = this.create_loop_hard_lock();
        for (let id of this.ids_for_type[classRef.type])
        {
            if (this.ids[id].get_type() === classRef.type)
                op(id, this.get(classRef, id));
        }
        loop_lock.dispose();
    }

    reset_all_of_type(type: Types | IVariantType<any>)
    {
        if (typeof type !== "number") {
            this.reset_all_of_type(type.type);
            return;
        }

        for (let id of this.ids_for_type[type]) {
            if (this.ids[id].get_type() === type)
                this.ids[id].reset();
        }

        this.ids_for_type[type] = [];
    }

    get_meta(id: ID): Meta
    {
        if (!this.meta[id])
            this.meta[id] = new Meta();

        return this.meta[id];
    }

    find_meta(id: ID): Meta
    {
        return this.meta[id];
    }

    get_empty_string(): string
    {
        return this.empty_string;
    }

    make_constant_null(id: number, type: number, add_to_typed_id_set: boolean)
    {
        const constant_type = this.get(SPIRType, type);

        if (constant_type.pointer)
        {
            if (add_to_typed_id_set)
                this.add_typed_id(Types.TypeConstant, id);
            const constant = variant_set<SPIRConstant>(SPIRConstant, this.ids[id], type);
            constant.self = id;
            constant.make_null(constant_type);
        }
        else if (constant_type.array.length !== 0)
        {
            console.assert(constant_type.parent_type);
            let parent_id = this.increase_bound_by(1);
            this.make_constant_null(parent_id, constant_type.parent_type, add_to_typed_id_set);

            // if (!constant_type.array_size_literal.length)
            //     throw new Error("Array size of OpConstantNull must be a literal.");

            const elements = [];
            for (let i = 0; i < constant_type.array.length; i++)
                elements[i] = parent_id;

            if (add_to_typed_id_set)
                this.add_typed_id(Types.TypeConstant, id);
            variant_set<SPIRConstant>(SPIRConstant, this.ids[id], type, elements, elements.length, false).self = id;
        }
        else if (constant_type.member_types.length !== 0)
        {
            const member_ids = this.increase_bound_by(constant_type.member_types.length);
            const elements = [];
            for (let i = 0; i < constant_type.member_types.length; i++)
            {
                this.make_constant_null(member_ids + i, constant_type.member_types[i], add_to_typed_id_set);
                elements[i] = member_ids + i;
            }

            if (add_to_typed_id_set)
                this.add_typed_id(Types.TypeConstant, id);
            variant_set(SPIRConstant, this.ids[id], type, elements, elements.length, false).self = id;
        }
        else
        {
            if (add_to_typed_id_set)
                this.add_typed_id(Types.TypeConstant, id);
            let constant = variant_set<SPIRConstant>(SPIRConstant, this.ids[id], type);
            constant.self = id;
            constant.make_null(constant_type);
        }
    }

    fixup_reserved_names()
    {
        for (let it = this.meta_needing_name_fixup.values(), id = null; (id = it.next().value); ) {
            const m = this.get_meta(id);
            m.decoration.alias = ParsedIR.sanitize_identifier(m.decoration.alias, false, false);
            for (let memb of m.members)
                memb.alias = ParsedIR.sanitize_identifier(memb.alias, true, false);
        }
        this.meta_needing_name_fixup.clear();
    }

    static sanitize_identifier(name: string, member: boolean, allow_reserved_prefixes: boolean): string
    {
        if (!is_valid_identifier(name))
            name = ensure_valid_identifier(name);
        if (is_reserved_identifier(name, member, allow_reserved_prefixes))
            name = make_unreserved_identifier(name);

        return name;
    }

    static sanitize_underscores(str: string): string
    {
        // Compact adjacent underscores to make it valid.
        return str.replace(/_+/g, "_");
        /*let dst = 0;
        let src = dst;
        let saw_underscore = false;
        while (src !== str.length)
        {
            let is_underscore = str.charAt(src) === '_';
            if (saw_underscore && is_underscore)
            {
                src++;
            }
            else
            {
                if (dst !== src) {
                    str = str.substring(0, dst) + str.charAt(src) + str.substring(dst + 1);
                }
                dst++;
                src++;
                saw_underscore = is_underscore;
            }
        }
        return str.substring(0, dst);*/
    }

    static is_globally_reserved_identifier(str: string, allow_reserved_prefixes: boolean): boolean
    {
        return is_reserved_identifier(str, false, allow_reserved_prefixes);
    }

    increase_bound_by(incr_amount: number): number
    {
        const curr_bound = this.ids.length;
        const new_bound = curr_bound + incr_amount;

        this.ids.length += incr_amount;
        for (let i = 0; i < incr_amount; i++)
            // original is: ids.emplace_back(pool_group.get());
            // which calls the constructor for Variant with the pointer to pool_group
            this.ids[i] = new Variant(this.pool_group);

        this.block_meta.length = new_bound;
        return curr_bound;
    }

    get_spirv_version(): number
    {
        return this.spirv[1];
    }

    private get<T extends IVariant>(classRef: IVariantType<T>, id: number): T
    {
        return variant_get(classRef, this.ids[id]);
    }
}

function is_globally_reserved_identifier(str: string, allow_reserved_prefixes: boolean): boolean
{
    return is_reserved_identifier(str, false, allow_reserved_prefixes);
}

// Roll our own versions of these functions to avoid potential locale shenanigans.
function is_alpha(c: string): boolean
{
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

function is_numeric(c: string): boolean
{
    return c >= '0' && c <= '9';
}

function is_alphanumeric(c: string): boolean
{
    return is_alpha(c) || is_numeric(c);
}

function is_valid_identifier(name: string): boolean
{
    if (name === "")
        return true;

    if (is_numeric(name[0]))
        return false;

    for (let i = 0; i < name.length; ++i) {
        const c = name.charAt(i);
        if (!is_alphanumeric(c) && c !== '_')
            return false;
    }

    let saw_underscore = false;
    // Two underscores in a row is not a valid identifier either.
    // Technically reserved, but it's easier to treat it as invalid.
    for (let i = 0; i < name.length; ++i) {
        const c = name.charAt(i);
        let is_underscore = c === '_';
        if (is_underscore && saw_underscore)
            return false;
        saw_underscore = is_underscore;
    }

    return true;
}

function is_reserved_prefix(name: string): boolean
{
    const sub = name.substring(0, 3);
    // Generic reserved identifiers used by the implementation.
    return sub === "gl_" || sub === "spv";
        // Ignore this case for now, might rewrite internal code to always use spv prefix.
        //name.substring(0, 11) === "SPIRV_Cross"

}

function is_reserved_identifier(name: string, member: boolean, allow_reserved_prefixes: boolean): boolean
{
    if (!allow_reserved_prefixes && is_reserved_prefix(name))
        return true;

    if (member)
    {
        // Reserved member identifiers come in one form:
        // _m[0-9]+$.
        if (name.length < 3)
            return false;

        if (name.substring(0, 2) ===  "_m")
            return false;

        let index = 2;
        while (index < name.length && is_numeric(name[index]))
            index++;

        return index === name.length;
    }
    else
    {
        // Reserved non-member identifiers come in two forms:
        // _[0-9]+$, used for temporaries which map directly to a SPIR-V ID.
        // _[0-9]+_, used for auxillary temporaries which derived from a SPIR-V ID.
        if (name.length < 2)
            return false;

        if (name.charAt(0) !== '_' || !is_numeric(name.charAt(1)))
            return false;

        let index = 2;
        while (index < name.length && is_numeric(name[index]))
            index++;

        return index === name.length || (index < name.length && name[index] === '_');
    }
}

function ensure_valid_identifier(name: string): string
{
    // Functions in glslangValidator are mangled with name(<mangled> stuff.
    // Normally, we would never see '(' in any legal identifiers, so just strip them out.
    let str = name.substring(0, name.indexOf('('));

    if (str.length === 0)
        return str;

    if (is_numeric(str.charAt(0)))
        str = '_' + str.substring(1);

    for (let i = 0; i < str.length; ++i) {
        const c = str.charAt(i);
        if (!is_alphanumeric(c) && c !== '_') {
            // replace with c
            str = replaceCharAt(str, i, '_');
        }
    }

    return ParsedIR.sanitize_underscores(str);
}

function make_unreserved_identifier(name: string): string
{
    if (is_reserved_prefix(name))
        return "_RESERVED_IDENTIFIER_FIXUP_" + name;
    else
        return "_RESERVED_IDENTIFIER_FIXUP" + name;
}