export declare enum MemorySemanticsMask {
    MemorySemanticsMaskNone = 0,
    MemorySemanticsAcquireMask = 2,
    MemorySemanticsReleaseMask = 4,
    MemorySemanticsAcquireReleaseMask = 8,
    MemorySemanticsSequentiallyConsistentMask = 16,
    MemorySemanticsUniformMemoryMask = 64,
    MemorySemanticsSubgroupMemoryMask = 128,
    MemorySemanticsWorkgroupMemoryMask = 256,
    MemorySemanticsCrossWorkgroupMemoryMask = 512,
    MemorySemanticsAtomicCounterMemoryMask = 1024,
    MemorySemanticsImageMemoryMask = 2048,
    MemorySemanticsOutputMemoryMask = 4096,
    MemorySemanticsOutputMemoryKHRMask = 4096,
    MemorySemanticsMakeAvailableMask = 8192,
    MemorySemanticsMakeAvailableKHRMask = 8192,
    MemorySemanticsMakeVisibleMask = 16384,
    MemorySemanticsMakeVisibleKHRMask = 16384,
    MemorySemanticsVolatileMask = 32768
}
