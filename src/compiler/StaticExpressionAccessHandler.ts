import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { SPIRFunction } from "../common/SPIRFunction";

export class StaticExpressionAccessHandler extends OpcodeHandler
{
    compiler: Compiler;
    variable_id: number;
    static_expression: number = 0;
    write_count: number = 0;

    constructor(compiler: Compiler, variable_id: number)
    {
        super();
        this.variable_id = variable_id;
    }

    follow_function_call(_: SPIRFunction): boolean
    {
        return false;
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        switch (opcode)
        {
            case Op.OpStore:
                if (length < 2)
                    return false;
                if (args[0] === this.variable_id)
                {
                    this.static_expression = args[1];
                    this.write_count++;
                }
                break;

            case Op.OpLoad:
                if (length < 3)
                    return false;
                if (args[2] == this.variable_id && this.static_expression === 0) // Tried to read from variable before it
                    // was initialized.
                    return false;
                break;

            case Op.OpAccessChain:
            case Op.OpInBoundsAccessChain:
            case Op.OpPtrAccessChain:
                if (length < 3)
                    return false;
                if (args[2] === this.variable_id) // If we try to access chain our candidate variable before we store to
                    // it, bail.
                    return false;
                break;

            default:
                break;
        }

        return true;
    }
}