import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { SPIRBlock } from "../common/SPIRBlock";
export declare class InterlockedResourceAccessPrepassHandler extends OpcodeHandler {
    compiler: Compiler;
    interlock_function_id: number;
    current_block_id: number;
    split_function_case: boolean;
    control_flow_interlock: boolean;
    call_stack: number[];
    constructor(compiler: Compiler, entry_point_id: number);
    rearm_current_block(block: SPIRBlock): void;
    begin_function_scope(args: Uint32Array, length: number): boolean;
    end_function_scope(args: Uint32Array, length: number): boolean;
    handle(op: Op, args: Uint32Array, length: number): boolean;
}
