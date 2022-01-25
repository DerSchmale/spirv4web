// Meta data about blocks. The cross-compiler needs to query if a block is either of these types.
// It is a bitset as there can be more than one tag per block.
export enum BlockMetaFlagBits
{
    LOOP_HEADER_BIT = 1 << 0,
    CONTINUE_BIT = 1 << 1,
    LOOP_MERGE_BIT = 1 << 2,
    SELECTION_MERGE_BIT = 1 << 3,
    MULTISELECT_MERGE_BIT = 1 << 4
}