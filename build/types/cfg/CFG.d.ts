import { Compiler } from "../compiler/Compiler";
import { SPIRFunction } from "../common/SPIRFunction";
export declare class CFG {
    private compiler;
    private func;
    private preceding_edges;
    private succeeding_edges;
    private immediate_dominators;
    private visit_order;
    private post_order;
    private empty_vector;
    constructor(compiler: Compiler, func: SPIRFunction);
    get_compiler(): Compiler;
    get_function(): SPIRFunction;
    get_immediate_dominator(block: number): number;
    get_visit_order(block: number): number;
    find_common_dominator(a: number, b: number): number;
    get_preceding_edges(block: number): number[];
    get_succeeding_edges(block: number): number[];
    walk_from(seen_blocks: Set<number>, block: number, op: (block: number) => boolean): void;
    find_loop_dominator(block_id: number): number;
}
