import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { SPIRFunction } from "../common/SPIRFunction";
export declare class StaticExpressionAccessHandler extends OpcodeHandler {
    compiler: Compiler;
    variable_id: number;
    static_expression: number;
    write_count: number;
    constructor(compiler: Compiler, variable_id: number);
    follow_function_call(_: SPIRFunction): boolean;
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
}
