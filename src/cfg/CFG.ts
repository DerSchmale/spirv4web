import { Compiler } from "../compiler/Compiler";
import { SPIRFunction } from "../common/SPIRFunction";
import { VisitOrder } from "./VisitOrder";
import { SPIRBlock, SPIRBlockMerge, SPIRBlockTerminator } from "../common/SPIRBlock";
import { DominatorBuilder } from "./DominatorBuilder";
import { maplike_get } from "../utils/maplike_get";

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
    private visit_count: number = 0;            // SmallVector<uint32_t>

    constructor(compiler?: Compiler, func?: SPIRFunction)
    {
        this.compiler = compiler;
        this.func = func;
        this.build_post_order_visit_order();
        this.build_immediate_dominators();
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

    node_terminates_control_flow_in_sub_graph(from: BlockID, to: BlockID): boolean
    {
        // Walk backwards, starting from "to" block.
        // Only follow pred edges if they have a 1:1 relationship, or a merge relationship.
        // If we cannot find a path to "from", we must assume that to is inside control flow in some way.

        const compiler = this.compiler;
        const from_block = compiler.get<SPIRBlock>(SPIRBlock, from);
        let ignore_block_id: BlockID = 0;
        if (from_block.merge === SPIRBlockMerge.MergeLoop)
            ignore_block_id = from_block.merge_block;

        while (to != from)
        {
            const pred_itr_second = this.preceding_edges[to];
            if (!pred_itr_second)
                return false;

            const builder = new DominatorBuilder(this);
            for (let edge of pred_itr_second)
                builder.add_block(edge);

            const dominator = builder.get_dominator();
            if (dominator === 0)
                return false;

            const dom = compiler.get<SPIRBlock>(SPIRBlock, dominator);

            let true_path_ignore = false;
            let false_path_ignore = false;
            if (ignore_block_id && dom.terminator === SPIRBlockTerminator.Select)
            {
                const true_block = compiler.get<SPIRBlock>(SPIRBlock, dom.true_block);
                const false_block = compiler.get<SPIRBlock>(SPIRBlock, dom.false_block);
                const ignore_block = compiler.get<SPIRBlock>(SPIRBlock, ignore_block_id);
                true_path_ignore = compiler.execution_is_branchless(true_block, ignore_block);
                false_path_ignore = compiler.execution_is_branchless(false_block, ignore_block);
            }

            if ((dom.merge === SPIRBlockMerge.MergeSelection && dom.next_block == to) ||
                (dom.merge === SPIRBlockMerge.MergeLoop && dom.merge_block == to) ||
                (dom.terminator == SPIRBlockTerminator.Direct && dom.next_block == to) ||
                (dom.terminator == SPIRBlockTerminator.Select && dom.true_block == to && false_path_ignore) ||
                (dom.terminator == SPIRBlockTerminator.Select && dom.false_block == to && true_path_ignore))
            {
                // Allow walking selection constructs if the other branch reaches out of a loop construct.
                // It cannot be in-scope anymore.
                to = dominator;
            }
            else
                return false;
        }

        return true;
    }

    private add_branch(from: number, to: number)
    {
        const add_unique = (l: number[], value: number) => {
            const itr = l.indexOf(value);
            if (itr < 0)
                l.push(value);
        };
        add_unique(maplike_get<number[]>(Array, this.preceding_edges, to), from);
        add_unique(maplike_get<number[]>(Array, this.succeeding_edges, from), to);
    }

    private build_post_order_visit_order()
    {
        const block = this.func.entry_block;
        this.visit_count = 0;
        this.visit_order = [];
        this.post_order = [];
        this.post_order_visit(block);
    }

    private build_immediate_dominators()
    {
        // Traverse the post-order in reverse and build up the immediate dominator tree.
        this.immediate_dominators = [];
        this.immediate_dominators[this.func.entry_block] = this.func.entry_block;

        for (let i = this.post_order.length; i; i--)
        {
            const block = this.post_order[i - 1];
            const pred = maplike_get<number[]>(Array, this.preceding_edges, block);
            if (pred.length === 0) // This is for the entry block, but we've already set up the dominators.
                continue;

            for (let edge of pred)
            {
                if (maplike_get(0, this.immediate_dominators, block))
                {
                    console.assert(maplike_get(0, this.immediate_dominators, edge));
                    this.immediate_dominators[block] = this.find_common_dominator(this.immediate_dominators[block], edge);
                }
                else
                    this.immediate_dominators[block] = edge;
            }
        }
    }

    private post_order_visit(block_id: number)
    {
// If we have already branched to this block (back edge), stop recursion.
        // If our branches are back-edges, we do not record them.
        // We have to record crossing edges however.
        if (this.has_visited_forward_edge(block_id))
            return true;
        else if (this.is_back_edge(block_id))
            return false;

        // Block back-edges from recursively revisiting ourselves.
        maplike_get(VisitOrder, this.visit_order, block_id).set(0);

        const block = this.compiler.get<SPIRBlock>(SPIRBlock, block_id);

        // If this is a loop header, add an implied branch to the merge target.
        // This is needed to avoid annoying cases with do { ... } while(false) loops often generated by inliners.
        // To the CFG, this is linear control flow, but we risk picking the do/while scope as our dominating block.
        // This makes sure that if we are accessing a variable outside the do/while, we choose the loop header as dominator.
        // We could use has_visited_forward_edge, but this break code-gen where the merge block is unreachable in the CFG.

        // Make a point out of visiting merge target first. This is to make sure that post visit order outside the loop
        // is lower than inside the loop, which is going to be key for some traversal algorithms like post-dominance analysis.
        // For selection constructs true/false blocks will end up visiting the merge block directly and it works out fine,
        // but for loops, only the header might end up actually branching to merge block.
        if (block.merge === SPIRBlockMerge.MergeLoop && this.post_order_visit(block.merge_block))
            this.add_branch(block_id, block.merge_block);

        // First visit our branch targets.
        switch (block.terminator)
        {
            case SPIRBlockTerminator.Direct:
                if (this.post_order_visit(block.next_block))
                    this.add_branch(block_id, block.next_block);
                break;

            case SPIRBlockTerminator.Select:
                if (this.post_order_visit(block.true_block))
                    this.add_branch(block_id, block.true_block);
                if (this.post_order_visit(block.false_block))
                    this.add_branch(block_id, block.false_block);
                break;

            case SPIRBlockTerminator.MultiSelect:
            {
                const cases = this.compiler.get_case_list(block);
                for (let target of cases)
                {
                    if (this.post_order_visit(target.block))
                        this.add_branch(block_id, target.block);
                }
                if (block.default_block && this.post_order_visit(block.default_block))
                    this.add_branch(block_id, block.default_block);
                break;
            }
            default:
                break;
        }

        // If this is a selection merge, add an implied branch to the merge target.
        // This is needed to avoid cases where an inner branch dominates the outer branch.
        // This can happen if one of the branches exit early, e.g.:
        // if (cond) { ...; break; } else { var = 100 } use_var(var);
        // We can use the variable without a Phi since there is only one possible parent here.
        // However, in this case, we need to hoist out the inner variable to outside the branch.
        // Use same strategy as loops.
        if (block.merge === SPIRBlockMerge.MergeSelection && this.post_order_visit(block.next_block))
        {
            // If there is only one preceding edge to the merge block and it's not ourselves, we need a fixup.
            // Add a fake branch so any dominator in either the if (), or else () block, or a lone case statement
            // will be hoisted out to outside the selection merge.
            // If size > 1, the variable will be automatically hoisted, so we should not mess with it.
            // The exception here is switch blocks, where we can have multiple edges to merge block,
            // all coming from same scope, so be more conservative in this case.
            // Adding fake branches unconditionally breaks parameter preservation analysis,
            // which looks at how variables are accessed through the CFG.
            if (this.preceding_edges.hasOwnProperty(block.next_block))
            {
                const pred_itr_second = this.preceding_edges[block.next_block];
                const pred = pred_itr_second;
                let num_succeeding_edges = 0;
                if (this.succeeding_edges.hasOwnProperty(block_id))
                    num_succeeding_edges = this.succeeding_edges[block_id].length;

                if (block.terminator === SPIRBlockTerminator.MultiSelect && num_succeeding_edges === 1)
                {
                    // Multiple branches can come from the same scope due to "break;", so we need to assume that all branches
                    // come from same case scope in worst case, even if there are multiple preceding edges.
                    // If we have more than one succeeding edge from the block header, it should be impossible
                    // to have a dominator be inside the block.
                    // Only case this can go wrong is if we have 2 or more edges from block header and
                    // 2 or more edges to merge block, and still have dominator be inside a case label.
                    if (pred.length === 0)
                        this.add_branch(block_id, block.next_block);
                }
                else
                {
                    if (pred.length === 1 && pred[0] !== block_id)
                        this.add_branch(block_id, block.next_block);
                }
            }
            else
            {
                // If the merge block does not have any preceding edges, i.e. unreachable, hallucinate it.
                // We're going to do code-gen for it, and domination analysis requires that we have at least one preceding edge.
                this.add_branch(block_id, block.next_block);
            }
        }

        // Then visit ourselves. Start counting at one, to let 0 be a magic value for testing back vs. crossing edges.
        maplike_get(VisitOrder, this.visit_order, block_id).set(++this.visit_count);
        this.post_order.push(block_id);
        return true;
    }

    private is_back_edge(to: number): boolean
    {
        // We have a back edge if the visit order is set with the temporary magic value 0.
        // Crossing edges will have already been recorded with a visit order.
        return this.visit_order.hasOwnProperty(to) && this.visit_order[to].get() === 0;
    }

    private has_visited_forward_edge(to: number): boolean
    {
        // If > 0, we have visited the edge already, and this is not a back edge branch.
        return this.visit_order.hasOwnProperty(to) && this.visit_order[to].get() > 0;
    }
}