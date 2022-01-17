import { Op } from "../spirv";
import { SPIRBlock } from "../common/SPIRBlock";
import { SPIRFunction } from "../common/SPIRFunction";

export abstract class OpcodeHandler
{
    abstract handle(opcode: Op, args: Uint32Array, length: number): boolean;

    handle_terminator(_: SPIRBlock): boolean
    {
        return true;
    }

    follow_function_call(_: SPIRFunction): boolean
    {
        return true;
    }

    set_current_block(_: SPIRBlock)
    {
    }

    // Called after returning from a function or when entering a block,
    // can be called multiple times per block,
    // while set_current_block is only called on block entry.
    rearm_current_block(_: SPIRBlock)
    {
    }

    begin_function_scope(_: Uint32Array, __: number): boolean
    {
        return true;
    }

    end_function_scope(_: Uint32Array, __: number): boolean
    {
        return true;
    }
}