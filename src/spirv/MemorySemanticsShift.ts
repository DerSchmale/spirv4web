export enum MemorySemanticsShift {
    Acquire = 1,
    Release = 2,
    AcquireRelease = 3,
    SequentiallyConsistent = 4,
    UniformMemory = 6,
    SubgroupMemory = 7,
    WorkgroupMemory = 8,
    CrossWorkgroupMemory = 9,
    AtomicCounterMemory = 10,
    ImageMemory = 11,
    OutputMemory = 12,
    OutputMemoryKHR = 12,
    MakeAvailable = 13,
    MakeAvailableKHR = 13,
    MakeVisible = 14,
    MakeVisibleKHR = 14,
    Volatile = 15,
    Max = 0x7fffffff,
}