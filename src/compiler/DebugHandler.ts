import { OpcodeHandler } from "./OpcodeHandler";
import { Op } from "../spirv";
import { Compiler } from "./Compiler";


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
            case Op.OpLoad:
                str = "load " + this.get_name(args[1]) + " " + this.get_name(args[2]);
                break;
            case Op.OpStore:
                str = "store " + this.get_name(args[0]) + " " + this.get_name(args[1]);
                break;
            case Op.OpAccessChain:
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