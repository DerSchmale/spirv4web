export enum AccessChainFlagBits
{
    INDEX_IS_LITERAL_BIT = 1 << 0,
    CHAIN_ONLY_BIT = 1 << 1,
    PTR_CHAIN_BIT = 1 << 2,
    SKIP_REGISTER_EXPRESSION_READ_BIT = 1 << 3,
    LITERAL_MSB_FORCE_ID = 1 << 4,
    FLATTEN_ALL_MEMBERS_BIT = 1 << 5,
    FORCE_COMPOSITE_BIT = 1 << 6
}