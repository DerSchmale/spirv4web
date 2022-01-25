export declare enum LoopControlMask {
    None = 0,
    Unroll = 1,
    DontUnroll = 2,
    DependencyInfinite = 4,
    DependencyLength = 8,
    MinIterations = 16,
    MaxIterations = 32,
    IterationMultiple = 64,
    PeelCount = 128,
    PartialCount = 256,
    InitiationIntervalINTEL = 65536,
    MaxConcurrencyINTEL = 131072,
    DependencyArrayINTEL = 262144,
    PipelineEnableINTEL = 524288,
    LoopCoalesceINTEL = 1048576,
    MaxInterleavingINTEL = 2097152,
    SpeculatedIterationsINTEL = 4194304
}
