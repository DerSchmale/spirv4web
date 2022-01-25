import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv/Op";

export class DebugHandler extends OpcodeHandler
{
    private compiler: Compiler;

    constructor(compiler)
    {
        super();
        this.compiler = compiler;
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        let str = ``;
        switch (opcode) {
            case Op.Load:
                str = "load " + this.get_name(args[1]) + " " + this.get_name(args[2]);
                break;
            case Op.Store:
                str = "store " + this.get_name(args[0]) + " " + this.get_name(args[1]);
                break;
            case Op.AccessChain:
                str = "access chain " + this.get_name(args[1]) + " " + this.get_name(args[2]);
                break;
            default:
                str = `UNKNOWN (${opcode})`
        }

        console.log(str);

        return true;
    }

    get_name(id: number)
    {
        return this.compiler.get_name(id) || id;
    }

}