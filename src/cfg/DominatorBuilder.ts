import { CFG } from "./CFG";
import { SPIRBlock, SPIRBlockTerminator } from "../common/SPIRBlock";

export class DominatorBuilder
{
    private cfg: CFG;
    private dominator: number = 0;

    constructor(cfg: CFG)
    {
        this.cfg = cfg;
    }

    add_block(block: number)
    {
        if (!this.cfg.get_immediate_dominator(block))
        {
            // Unreachable block via the CFG, we will never emit this code anyways.
            return;
        }

        if (!this.dominator)
        {
            this.dominator = block;
            return;
        }

        if (block !== this.dominator)
            this.dominator = this.cfg.find_common_dominator(block, this.dominator);
    }

    get_dominator(): number
    {
        return this.dominator;
    }

    lift_continue_block_dominator()
    {
        // It is possible for a continue block to be the dominator of a variable is only accessed inside the while block of a do-while loop.
        // We cannot safely declare variables inside a continue block, so move any variable declared
        // in a continue block to the entry block to simplify.
        // It makes very little sense for a continue block to ever be a dominator, so fall back to the simplest
        // solution.

        if (!this.dominator)
            return;

        const cfg = this.cfg;
        const block = cfg.get_compiler().get<SPIRBlock>(SPIRBlock, this.dominator);
        const post_order = cfg.get_visit_order(this.dominator);

        // If we are branching to a block with a higher post-order traversal index (continue blocks), we have a problem
        // since we cannot create sensible GLSL code for this, fallback to entry block.
        let back_edge_dominator = false;
        switch (block.terminator)
        {
            case SPIRBlockTerminator.Direct:
                if (cfg.get_visit_order(block.next_block) > post_order)
                    back_edge_dominator = true;
                break;

            case SPIRBlockTerminator.Select:
                if (cfg.get_visit_order(block.true_block) > post_order)
                    back_edge_dominator = true;
                if (cfg.get_visit_order(block.false_block) > post_order)
                    back_edge_dominator = true;
                break;

            case SPIRBlockTerminator.MultiSelect:
            {
                const cases = cfg.get_compiler().get_case_list(block);
                for (let target of cases)
                {
                    if (cfg.get_visit_order(target.block) > post_order)
                        back_edge_dominator = true;
                }
                if (block.default_block && cfg.get_visit_order(block.default_block) > post_order)
                    back_edge_dominator = true;
                break;
            }

            default:
                break;
        }

        if (back_edge_dominator)
            this.dominator = cfg.get_function().entry_block;
    }
}