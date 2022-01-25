export enum FPFastMathModeMask {
    None = 0,
    NaNMask = 0x00000001,
    InfMask = 0x00000002,
    NSZMask = 0x00000004,
    AllowRecipMask = 0x00000008,
    FastMask = 0x00000010,
}