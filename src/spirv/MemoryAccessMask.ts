export enum MemoryAccessMask {
    None = 0,
    Volatile = 0x00000001,
    Aligned = 0x00000002,
    Nontemporal = 0x00000004,
    MakePointerAvailable = 0x00000008,
    MakePointerAvailableKHR = 0x00000008,
    MakePointerVisible = 0x00000010,
    MakePointerVisibleKHR = 0x00000010,
    NonPrivatePointer = 0x00000020,
    NonPrivatePointerKHR = 0x00000020,
}