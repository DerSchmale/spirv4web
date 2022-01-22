import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { SPIRFunction } from "../common/SPIRFunction";
import { CFG } from "../cfg/CFG";

export class CFGBuilder extends OpcodeHandler
{
    compiler: Compiler;

    // original is map
    function_cfgs: CFG[] = [];

    constructor(compiler: Compiler)
    {
        super();
        this.compiler = compiler;
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        return true;
    }

    follow_function_call(func: SPIRFunction): boolean
    {
        if (!this.function_cfgs.hasOwnProperty(func.self))
        {
            this.function_cfgs[func.self] = new CFG(this.compiler, func);
            return true;
        }
        else
            return false;
    }
}