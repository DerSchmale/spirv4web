export enum RayFlagsMask {
    None = 0,
    OpaqueKHR = 0x00000001,
    NoOpaqueKHR = 0x00000002,
    TerminateOnFirstHitKHR = 0x00000004,
    SkipClosestHitShaderKHR = 0x00000008,
    CullBackFacingTrianglesKHR = 0x00000010,
    CullFrontFacingTrianglesKHR = 0x00000020,
    CullOpaqueKHR = 0x00000040,
    CullNoOpaqueKHR = 0x00000080,
    SkipTrianglesKHR = 0x00000100,
    SkipAABBsKHR = 0x00000200,
} 