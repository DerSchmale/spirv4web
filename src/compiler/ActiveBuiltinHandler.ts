import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Bitset } from "../common/Bitset";
import { SPIRType } from "../common/SPIRType";
import { SPIRVariable } from "../common/SPIRVariable";
import { BuiltIn } from "../spirv/BuiltIn";
import { Op } from "../spirv/Op";
import { Decoration } from "../spirv/Decoration";
import { StorageClass } from "../spirv/StorageClass";

export class ActiveBuiltinHandler extends OpcodeHandler
{
    compiler: Compiler;

    constructor(compiler: Compiler)
    {
        super();
        this.compiler = compiler;
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        return false;
    }

    handle_builtin(type: SPIRType, builtin: BuiltIn, decoration_flags: Bitset)
    {
        // If used, we will need to explicitly declare a new array size for these builtins.

        if (builtin === BuiltIn.BuiltInClipDistance) {
            if (!type.array_size_literal[0])
                throw new Error("Array size for ClipDistance must be a literal.");
            const array_size = type.array[0];
            if (array_size === 0)
                throw new Error("Array size for ClipDistance must not be unsized.");
            this.compiler.clip_distance_count = array_size;
        }
        else if (builtin === BuiltIn.BuiltInCullDistance) {
            if (!type.array_size_literal[0])
                throw new Error("Array size for CullDistance must be a literal.");
            const array_size = type.array[0];
            if (array_size === 0)
                throw new Error("Array size for CullDistance must not be unsized.");
            this.compiler.cull_distance_count = array_size;
        }
        else if (builtin === BuiltIn.BuiltInPosition) {
            if (decoration_flags.get(Decoration.DecorationInvariant))
                this.compiler.position_invariant = true;
        }
    }

    add_if_builtin_or_block(id: number)
    {
        this.add_if_builtin(id, true);
    }

    add_if_builtin(id: number, allow_blocks: boolean = false)
    {
        // Only handle plain variables here.
        // Builtins which are part of a block are handled in AccessChain.
        // If allow_blocks is used however, this is to handle initializers of blocks,
        // which implies that all members are written to.

        const compiler = this.compiler;
        const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, id);
        const m = compiler.ir.find_meta(id);
        if (var_ && m)
        {
            const type = compiler.get<SPIRType>(SPIRType, var_.basetype);
            const decorations = m.decoration;
            const flags = type.storage === StorageClass.StorageClassInput ?
                compiler.active_input_builtins : compiler.active_output_builtins;
            if (decorations.builtin)
            {
                flags.set(decorations.builtin_type);
                this.handle_builtin(type, decorations.builtin_type, decorations.decoration_flags);
            }
            else if (allow_blocks && compiler.has_decoration(type.self, Decoration.DecorationBlock))
            {
                const member_count = type.member_types.length;
                for (let i = 0; i < member_count; i++)
                {
                    if (compiler.has_member_decoration(type.self, i, Decoration.DecorationBuiltIn))
                    {
                        const member_type = compiler.get<SPIRType>(SPIRType, type.member_types[i]);
                        const builtin = <BuiltIn>(compiler.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn));
                        flags.set(builtin);
                        this.handle_builtin(member_type, builtin, compiler.get_member_decoration_bitset(type.self, i));
                    }
                }
            }
        }
    }
}