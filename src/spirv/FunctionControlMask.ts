export enum FunctionControlMask {
    None = 0,
    Inline = 0x00000001,
    DontInline = 0x00000002,
    Pure = 0x00000004,
    Const = 0x00000008,
}