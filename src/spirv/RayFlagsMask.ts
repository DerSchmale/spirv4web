export enum RayFlagsMask {
    RayFlagsMaskNone = 0,
    RayFlagsOpaqueKHRMask = 0x00000001,
    RayFlagsNoOpaqueKHRMask = 0x00000002,
    RayFlagsTerminateOnFirstHitKHRMask = 0x00000004,
    RayFlagsSkipClosestHitShaderKHRMask = 0x00000008,
    RayFlagsCullBackFacingTrianglesKHRMask = 0x00000010,
    RayFlagsCullFrontFacingTrianglesKHRMask = 0x00000020,
    RayFlagsCullOpaqueKHRMask = 0x00000040,
    RayFlagsCullNoOpaqueKHRMask = 0x00000080,
    RayFlagsSkipTrianglesKHRMask = 0x00000100,
    RayFlagsSkipAABBsKHRMask = 0x00000200,
}