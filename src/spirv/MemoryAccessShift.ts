export enum MemoryAccessShift {
    Volatile = 0,
    Aligned = 1,
    Nontemporal = 2,
    MakePointerAvailable = 3,
    MakePointerAvailableKHR = 3,
    MakePointerVisible = 4,
    MakePointerVisibleKHR = 4,
    NonPrivatePointer = 5,
    NonPrivatePointerKHR = 5,
    Max = 0x7fffffff,
}