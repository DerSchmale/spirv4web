import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { Instruction } from "./Instruction";
import { Pair } from "../utils/Pair";
export declare enum SPIRBlockTerminator {
    Unknown = 0,
    Direct = 1,
    Select = 2,
    MultiSelect = 3,
    Return = 4,
    Unreachable = 5,
    Kill = 6,
    IgnoreIntersection = 7,
    TerminateRay = 8
}
export declare enum SPIRBlockMerge {
    None = 0,
    Loop = 1,
    Selection = 2
}
export declare enum SPIRBlockHints {
    None = 0,
    Unroll = 1,
    DontUnroll = 2,
    Flatten = 3,
    DontFlatten = 4
}
export declare enum SPIRBlockMethod {
    MergeToSelectForLoop = 0,
    MergeToDirectForLoop = 1,
    MergeToSelectContinueForLoop = 2
}
export declare enum SPIRBlockContinueBlockType {
    ContinueNone = 0,
    ForLoop = 1,
    WhileLoop = 2,
    DoWhileLoop = 3,
    ComplexLoop = 4
}
export declare class SPIRBlockPhi {
    local_variable: ID;
    parent: BlockID;
    function_variable: BlockID;
    clone(): SPIRBlockPhi;
    constructor(local_variable?: ID, parent?: BlockID, function_variable?: BlockID);
}
export declare class SPIRBlockCase {
    value: bigint;
    block: BlockID;
    clone(): SPIRBlockCase;
    constructor();
    constructor(value: bigint, block: BlockID);
}
export declare class SPIRBlock extends IVariant {
    static type: Types;
    static NoDominator: number;
    terminator: SPIRBlockTerminator;
    merge: SPIRBlockMerge;
    hint: SPIRBlockHints;
    next_block: BlockID;
    merge_block: BlockID;
    continue_block: BlockID;
    return_value: ID;
    condition: ID;
    true_block: BlockID;
    false_block: BlockID;
    default_block: BlockID;
    ops: Instruction[];
    phi_variables: SPIRBlockPhi[];
    declare_temporary: Pair<TypeID, ID>[];
    potential_declare_temporary: Pair<TypeID, ID>[];
    cases_32bit: SPIRBlockCase[];
    cases_64bit: SPIRBlockCase[];
    disable_block_optimization: boolean;
    complex_continue: boolean;
    need_ladder_break: boolean;
    ignore_phi_from_block: BlockID;
    loop_dominator: BlockID;
    dominated_variables: VariableID[];
    loop_variables: VariableID[];
    invalidate_expressions: ID[];
    constructor(other?: SPIRBlock);
}
