import { Compiler } from "../compiler/Compiler";
import { SPIRFunction } from "../common/SPIRFunction";
import { VisitOrder } from "./VisitOrder";
import { SPIRBlock, SPIRBlockMerge } from "../common/SPIRBlock";

export class CFG
{
    private compiler: Compiler;
    private func: SPIRFunction;
    private preceding_edges: number[][] = [];       // std::unordered_map<uint32_t, SmallVector<uint32_t>>
    private succeeding_edges: number[][] = [];      // std::unordered_map<uint32_t, SmallVector<uint32_t>>
    private immediate_dominators: number[] = [];    // std::unordered_map<uint32_t, uint32_t>
    private visit_order: VisitOrder[] = [];         // std::unordered_map<uint32_t, VisitOrder>
    private post_order: number[] = [];              // SmallVector<uint32_t>
    private empty_vector: number[] = [];            // SmallVector<uint32_t>

    constructor(compiler: Compiler, func: SPIRFunction)
    {
        this.compiler = compiler;
        this.func = func;
    }

    get_compiler(): Compiler
    {
        return this.compiler;
    }

    get_function(): SPIRFunction
    {
        return this.func;
    }

    get_immediate_dominator(block: number): number
    {
        const itr_second = this.immediate_dominators[block];
        if (itr_second)
            return itr_second;
            else
        return 0;
    }

    get_visit_order(block: number): number
    {
        const itr_second = this.visit_order[block];
        console.assert(itr_second);
        const v = itr_second.get();
        console.assert(v > 0);
        return v;
    }

    find_common_dominator(a: number, b: number): number
    {
        while (a !== b)
        {
            if (this.get_visit_order(a) < this.get_visit_order(b))
                a = this.get_immediate_dominator(a);
            else
                b = this.get_immediate_dominator(b);
        }
        return a;
    }

    get_preceding_edges(block: number): number[]
    {
        const itr_second = this.preceding_edges[block];
        return itr_second || this.empty_vector;
    }

    get_succeeding_edges(block: number): number[]
    {
        const itr_second = this.succeeding_edges[block];
        return itr_second || this.empty_vector;
    }

    walk_from(seen_blocks: Set<number>, block: number, op: (block: number) => boolean)
    {
        if (seen_blocks.has(block))
            return;
        seen_blocks.add(block);

        if (op(block))
        {
            for (let b of this.get_succeeding_edges(block))
                this.walk_from(seen_blocks, b, op);
        }
    }

    find_loop_dominator(block_id: number): number
    {
        while (block_id !== SPIRBlock.NoDominator)
        {
            const itr_second = this.preceding_edges[block_id];
            if (!itr_second)
                return SPIRBlock.NoDominator;
            if (itr_second.length === 0)
                return SPIRBlock.NoDominator;

            let pred_block_id = SPIRBlock.NoDominator;
            let ignore_loop_header = false;

            // If we are a merge block, go directly to the header block.
            // Only consider a loop dominator if we are branching from inside a block to a loop header.
            // NOTE: In the CFG we forced an edge from header to merge block always to support variable scopes properly.
            for (let pred of itr_second)
            {
                let pred_block = this.compiler.get<SPIRBlock>(SPIRBlock, pred);
                if (pred_block.merge == SPIRBlockMerge.MergeLoop && pred_block.merge_block == <ID>(block_id))
                {
                    pred_block_id = pred;
                    ignore_loop_header = true;
                    break;
                }
                else if (pred_block.merge == SPIRBlockMerge.MergeSelection && pred_block.next_block == <ID>(block_id))
                {
                    pred_block_id = pred;
                    break;
                }
            }

            // No merge block means we can just pick any edge. Loop headers dominate the inner loop, so any path we
            // take will lead there.
            if (pred_block_id == SPIRBlock.NoDominator)
                pred_block_id = itr_second[0];

            block_id = pred_block_id;

            if (!ignore_loop_header && block_id)
            {
                const block = this.compiler.get<SPIRBlock>(SPIRBlock, block_id);
                if (block.merge == SPIRBlockMerge.MergeLoop)
                    return block_id;
            }
        }

        return block_id;
    }
}