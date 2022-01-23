import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv/Op";
export declare class InterfaceVariableAccessHandler extends OpcodeHandler {
    compiler: Compiler;
    variables: Set<VariableID>;
    constructor(compiler: Compiler, variables: Set<VariableID>);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
}
