import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { Instruction } from "./Instruction";
import { Pair } from "../utils/Pair";
import { defaultClone, defaultCopy } from "../utils/defaultCopy";

export enum SPIRBlockTerminator
{
    Unknown,
    Direct, // Emit next block directly without a particular condition.

    Select, // Block ends with an if/else block.
    MultiSelect, // Block ends with switch statement.

    Return, // Block ends with return.
    Unreachable, // Noop
    Kill, // Discard
    IgnoreIntersection, // Ray Tracing
    TerminateRay // Ray Tracing
}

export enum SPIRBlockMerge
{
    None,
    Loop,
    Selection
}

export enum SPIRBlockHints
{
    None,
    Unroll,
    DontUnroll,
    Flatten,
    DontFlatten
}

export enum SPIRBlockMethod
{
    MergeToSelectForLoop,
    MergeToDirectForLoop,
    MergeToSelectContinueForLoop
}

export enum SPIRBlockContinueBlockType
{
    ContinueNone,

    // Continue block is branchless and has at least one instruction.
    ForLoop,

    // Noop continue block.
    WhileLoop,

    // Continue block is conditional.
    DoWhileLoop,

    // Highly unlikely that anything will use this,
    // since it is really awkward/impossible to express in GLSL.
    ComplexLoop
}

export class SPIRBlockPhi
{
    local_variable: ID; // flush local variable ...
    parent: BlockID; // If we're in from_block and want to branch into this block ...
    function_variable: BlockID; // to this function-global "phi" variable first.

    clone() { return defaultClone<SPIRBlockPhi>(SPIRBlockPhi, this); }

    constructor(local_variable: ID = 0, parent: BlockID = 0, function_variable: BlockID = 0)
    {
        this.local_variable = local_variable;
        this.parent = parent;
        this.function_variable = function_variable;
    }
}

export class SPIRBlockCase
{
    value: bigint;
    block: BlockID;

    clone() { return defaultClone(SPIRBlockCase, this); }

    constructor();
    constructor(value: bigint, block: BlockID)
    constructor(value: bigint = BigInt(0), block: BlockID = 0)
    {
        this.value = value;
        this.block = block;
    }
}

export class SPIRBlock extends IVariant
{
    static type: Types = Types.Block;
    static NoDominator: number = 0xffffffff;

    terminator: SPIRBlockTerminator = SPIRBlockTerminator.Unknown;
    merge: SPIRBlockMerge = SPIRBlockMerge.None;
    hint: SPIRBlockHints = SPIRBlockHints.None;
    next_block: BlockID = 0;
    merge_block: BlockID = 0;
    continue_block: BlockID = 0;

    return_value: ID = 0; // If 0, return nothing (void).
    condition: ID = 0;
    true_block: BlockID = 0;
    false_block: BlockID = 0;
    default_block: BlockID = 0;

    ops: Instruction[] = [];

    // Before entering this block flush out local variables to magical "phi" variables.
    phi_variables: SPIRBlockPhi[] = [];

    // Declare these temporaries before beginning the block.
    // Used for handling complex continue blocks which have side effects.
    declare_temporary: Pair<TypeID, ID>[] = [];

    // Declare these temporaries, but only conditionally if this block turns out to be
    // a complex loop header.
    potential_declare_temporary: Pair<TypeID, ID>[] = [];

    cases_32bit: SPIRBlockCase[] = [];
    cases_64bit: SPIRBlockCase[] = [];

    // If we have tried to optimize code for this block but failed,
    // keep track of this.
    disable_block_optimization: boolean = false;

    // If the continue block is complex, fallback to "dumb" for loops.
    complex_continue: boolean = false;

    // Do we need a ladder variable to defer breaking out of a loop construct after a switch block?
    need_ladder_break: boolean = false;

    // If marked, we have explicitly handled SPIRBlockPhi from this block, so skip any flushes related to that on a branch.
    // Used to handle an edge case with switch and case-label fallthrough where fall-through writes to SPIRBlockPhi.
    ignore_phi_from_block: BlockID = 0;

    // The dominating block which this block might be within.
    // Used in continue; blocks to determine if we really need to write continue.
    loop_dominator: BlockID = 0;

    // All access to these variables are dominated by this block,
    // so before branching anywhere we need to make sure that we declare these variables.
    dominated_variables: VariableID[] = [];

    // These are variables which should be declared in a for loop header, if we
    // fail to use a classic for-loop,
    // we remove these variables, and fall back to regular variables outside the loop.
    loop_variables: VariableID[] = [];

    // Some expressions are control-flow dependent, i.e. any instruction which relies on derivatives or
    // sub-group-like operations.
    // Make sure that we only use these expressions in the original block.
    invalidate_expressions: ID[] = [];

    constructor(other?: SPIRBlock)
    {
        super();
        if (other)
            defaultCopy(other, this);
    }
}