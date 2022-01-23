export enum FPFastMathModeMask {
    FPFastMathModeMaskNone = 0,
    FPFastMathModeNotNaNMask = 0x00000001,
    FPFastMathModeNotInfMask = 0x00000002,
    FPFastMathModeNSZMask = 0x00000004,
    FPFastMathModeAllowRecipMask = 0x00000008,
    FPFastMathModeFastMask = 0x00000010,
}