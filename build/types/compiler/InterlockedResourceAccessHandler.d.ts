import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv/Op";
export declare class InterlockedResourceAccessHandler extends OpcodeHandler {
    compiler: Compiler;
    in_crit_sec: boolean;
    interlock_function_id: number;
    split_function_case: boolean;
    control_flow_interlock: boolean;
    use_critical_section: boolean;
    call_stack_is_interlocked: boolean;
    call_stack: number[];
    constructor(compiler: Compiler, entry_point_id: number);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
    begin_function_scope(args: Uint32Array, length: number): boolean;
    end_function_scope(args: Uint32Array, length: number): boolean;
    access_potential_resource(id: number): void;
}
