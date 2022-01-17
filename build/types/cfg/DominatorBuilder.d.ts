import { CFG } from "./CFG";
export declare class DominatorBuilder {
    private cfg;
    private dominator;
    constructor(cfg: CFG);
    add_block(block: number): void;
    get_dominator(): number;
    lift_continue_block_dominator(): void;
}
