import { OpcodeHandler } from "./OpcodeHandler";
import { SPIRFunction } from "../common/SPIRFunction";
import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { SPIRBlock } from "../common/SPIRBlock";
export declare class AnalyzeVariableScopeAccessHandler extends OpcodeHandler {
    compiler: Compiler;
    entry: SPIRFunction;
    accessed_variables_to_block: Set<number>[];
    accessed_temporaries_to_block: Set<number>[];
    result_id_to_type: number[];
    complete_write_variables_to_block: Set<number>[];
    partial_write_variables_to_block: Set<number>[];
    access_chain_expressions: Set<number>;
    access_chain_children: Set<number>[];
    current_block: SPIRBlock;
    constructor(compiler: Compiler, entry: SPIRFunction);
    follow_function_call(_: SPIRFunction): boolean;
    set_current_block(block: SPIRBlock): void;
    notify_variable_access(id: number, block: number): void;
    id_is_phi_variable(id: number): boolean;
    id_is_potential_temporary(id: number): boolean;
    handle(op: Op, args: Uint32Array, length: number): boolean;
    handle_terminator(block: SPIRBlock): boolean;
}
