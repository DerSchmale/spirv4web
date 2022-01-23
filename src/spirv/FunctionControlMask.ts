export enum FunctionControlMask {
    FunctionControlMaskNone = 0,
    FunctionControlInlineMask = 0x00000001,
    FunctionControlDontInlineMask = 0x00000002,
    FunctionControlPureMask = 0x00000004,
    FunctionControlConstMask = 0x00000008,
}