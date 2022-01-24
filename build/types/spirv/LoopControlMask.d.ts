export declare enum LoopControlMask {
    LoopControlMaskNone = 0,
    LoopControlUnrollMask = 1,
    LoopControlDontUnrollMask = 2,
    LoopControlDependencyInfiniteMask = 4,
    LoopControlDependencyLengthMask = 8,
    LoopControlMinIterationsMask = 16,
    LoopControlMaxIterationsMask = 32,
    LoopControlIterationMultipleMask = 64,
    LoopControlPeelCountMask = 128,
    LoopControlPartialCountMask = 256,
    LoopControlInitiationIntervalINTELMask = 65536,
    LoopControlMaxConcurrencyINTELMask = 131072,
    LoopControlDependencyArrayINTELMask = 262144,
    LoopControlPipelineEnableINTELMask = 524288,
    LoopControlLoopCoalesceINTELMask = 1048576,
    LoopControlMaxInterleavingINTELMask = 2097152,
    LoopControlSpeculatedIterationsINTELMask = 4194304
}
