import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { PhysicalBlockMeta } from "./PhysicalBlockMeta";
import { SPIRType, SPIRTypeBaseType } from "../common/SPIRType";
import { maplike_get } from "../utils/maplike_get";
import { Op } from "../spirv/Op";
import { MemoryAccessMask } from "../spirv/MemoryAccessMask";
import { StorageClass } from "../spirv/StorageClass";

export class PhysicalStorageBufferPointerHandler extends OpcodeHandler
{
    compiler: Compiler;
    non_block_types: Set<number> = new Set();
    physical_block_type_meta: PhysicalBlockMeta[] = []; // map<uint32_t, PhysicalBlockMeta>
    access_chain_to_physical_block: PhysicalBlockMeta[] = []; // map<uint32_t, PhysicalBlockMeta *>

    constructor(compiler: Compiler)
    {
        super();
        this.compiler = compiler;
    }

    handle(op: Op, args: Uint32Array, length: number): boolean
    {
        // When a BDA pointer comes to life, we need to keep a mapping of SSA ID -> type ID for the pointer type.
        // For every load and store, we'll need to be able to look up the type ID being accessed and mark any alignment
        // requirements.
        switch (op)
        {
            case Op.OpConvertUToPtr:
            case Op.OpBitcast:
            case Op.OpCompositeExtract:
                // Extract can begin a new chain if we had a struct or array of pointers as input.
                // We don't begin chains before we have a pure scalar pointer.
                this.setup_meta_chain(args[0], args[1]);
                break;

            case Op.OpAccessChain:
            case Op.OpInBoundsAccessChain:
            case Op.OpPtrAccessChain:
            case Op.OpCopyObject:
            {
                const itr_second = this.access_chain_to_physical_block[args[2]];
                if (itr_second)
                    this.access_chain_to_physical_block[args[1]] = itr_second;
                break;
            }

            case Op.OpLoad:
            {
                this.setup_meta_chain(args[0], args[1]);
                if (length >= 4)
                    this.mark_aligned_access(args[2], args.slice(3), length - 3);
                break;
            }

            case Op.OpStore:
            {
                if (length >= 3)
                    this.mark_aligned_access(args[0], args.slice(3), length - 2);
                break;
            }

            default:
                break;
        }

        return true;
    }

    mark_aligned_access(id: number, args: Uint32Array, length: number)
    {
        const mask = args[0];
        let offset = 0;
        length--;
        if (length && (mask & MemoryAccessMask.MemoryAccessVolatileMask) !== 0)
        {
            offset++;
            length--;
        }

        if (length && (mask & MemoryAccessMask.MemoryAccessAlignedMask) !== 0)
        {
            const alignment = args[offset];
            const meta = this.find_block_meta(id);

            // This makes the assumption that the application does not rely on insane edge cases like:
            // Bind buffer with ADDR = 8, use block offset of 8 bytes, load/store with 16 byte alignment.
            // If we emit the buffer with alignment = 16 here, the first element at offset = 0 should
            // actually have alignment of 8 bytes, but this is too theoretical and awkward to support.
            // We could potentially keep track of any offset in the access chain, but it's
            // practically impossible for high level compilers to emit code like that,
            // so deducing overall alignment requirement based on maximum observed Alignment value is probably fine.
            if (meta && alignment > meta.alignment)
                meta.alignment = alignment;
        }
    }

    find_block_meta( id: number): PhysicalBlockMeta
    {
        const itr_second = this.access_chain_to_physical_block[id];
        return itr_second || null;
    }

    type_is_bda_block_entry(type_id: number): boolean
    {
        const type = this.compiler.get<SPIRType>(SPIRType, type_id);
        return type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT && type.pointer &&
            type.pointer_depth === 1 && !this.compiler.type_is_array_of_pointers(type);
    }

    setup_meta_chain(type_id: number, var_id: number)
    {
        if (this.type_is_bda_block_entry(type_id))
        {
            const meta = maplike_get(PhysicalBlockMeta, this.physical_block_type_meta, type_id);
            this.access_chain_to_physical_block[var_id] = meta;

            const type = this.compiler.get<SPIRType>(SPIRType, type_id);
            if (type.basetype !== SPIRTypeBaseType.Struct)
                this.non_block_types.add(type_id);

            if (meta.alignment === 0)
                meta.alignment = this.get_minimum_scalar_alignment(this.compiler.get_pointee_type(type));
        }
    }

    get_minimum_scalar_alignment(type: SPIRType): number
    {
        if (type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT)
            return 8;
        else if (type.basetype === SPIRTypeBaseType.Struct)
        {
            let alignment = 0;
            for (let member_type of type.member_types)
            {
                const member_align = this.get_minimum_scalar_alignment(this.compiler.get<SPIRType>(SPIRType, member_type));
                if (member_align > alignment)
                    alignment = member_align;
            }
            return alignment;
        }
        else
            return type.width / 8;
    }

    analyze_non_block_types_from_block(type: SPIRType)
    {
        for (let member of type.member_types)
        {
            const subtype = this.compiler.get<SPIRType>(SPIRType, member);
            if (subtype.basetype !== SPIRTypeBaseType.Struct && subtype.pointer &&
                subtype.storage === StorageClass.StorageClassPhysicalStorageBufferEXT)
            {
                this.non_block_types.add(this.get_base_non_block_type_id(member));
            }
            else if (subtype.basetype === SPIRTypeBaseType.Struct && !subtype.pointer)
                this.analyze_non_block_types_from_block(subtype);
        }
    }

    get_base_non_block_type_id(type_id: number): number
    {
        let type = this.compiler.get<SPIRType>(SPIRType, type_id);
        while (type.pointer &&
            type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT &&
            !this.type_is_bda_block_entry(type_id))
        {
            type_id = type.parent_type;
            type = this.compiler.get<SPIRType>(SPIRType, type_id);
        }

        console.assert(this.type_is_bda_block_entry(type_id));
        return type_id;
    }
}