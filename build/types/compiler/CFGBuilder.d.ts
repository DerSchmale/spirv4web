import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { SPIRFunction } from "../common/SPIRFunction";
import { CFG } from "../cfg/CFG";
import { Op } from "../spirv/Op";
export declare class CFGBuilder extends OpcodeHandler {
    compiler: Compiler;
    function_cfgs: CFG[];
    constructor(compiler: Compiler);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
    follow_function_call(func: SPIRFunction): boolean;
}
