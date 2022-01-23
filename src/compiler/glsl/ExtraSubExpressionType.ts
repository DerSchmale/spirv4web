export enum ExtraSubExpressionType
{
    // Create masks above any legal ID range to allow multiple address spaces into the extra_sub_expressions map.
    EXTRA_SUB_EXPRESSION_TYPE_STREAM_OFFSET = 0x10000000,
    EXTRA_SUB_EXPRESSION_TYPE_AUX = 0x20000000
}