import { SPIRBlock } from "../common/SPIRBlock";
import { SPIRFunction } from "../common/SPIRFunction";
import { Op } from "../spirv/Op";
export declare abstract class OpcodeHandler {
    abstract handle(opcode: Op, args: Uint32Array, length: number): boolean;
    handle_terminator(_: SPIRBlock): boolean;
    follow_function_call(_: SPIRFunction): boolean;
    set_current_block(_: SPIRBlock): void;
    rearm_current_block(_: SPIRBlock): void;
    begin_function_scope(_: Uint32Array, __: number): boolean;
    end_function_scope(_: Uint32Array, __: number): boolean;
}
