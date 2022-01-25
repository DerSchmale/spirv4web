export declare enum Op {
    Nop = 0,
    Undef = 1,
    SourceContinued = 2,
    Source = 3,
    SourceExtension = 4,
    Name = 5,
    MemberName = 6,
    String = 7,
    Line = 8,
    Extension = 10,
    ExtInstImport = 11,
    ExtInst = 12,
    MemoryModel = 14,
    EntryPoint = 15,
    ExecutionMode = 16,
    Capability = 17,
    TypeVoid = 19,
    TypeBool = 20,
    TypeInt = 21,
    TypeFloat = 22,
    TypeVector = 23,
    TypeMatrix = 24,
    TypeImage = 25,
    TypeSampler = 26,
    TypeSampledImage = 27,
    TypeArray = 28,
    TypeRuntimeArray = 29,
    TypeStruct = 30,
    TypeOpaque = 31,
    TypePointer = 32,
    TypeFunction = 33,
    TypeEvent = 34,
    TypeDeviceEvent = 35,
    TypeReserveId = 36,
    TypeQueue = 37,
    TypePipe = 38,
    TypeForwardPointer = 39,
    ConstantTrue = 41,
    ConstantFalse = 42,
    Constant = 43,
    ConstantComposite = 44,
    ConstantSampler = 45,
    ConstantNull = 46,
    SpecConstantTrue = 48,
    SpecConstantFalse = 49,
    SpecConstant = 50,
    SpecConstantComposite = 51,
    SpecConstantOp = 52,
    Function = 54,
    FunctionParameter = 55,
    FunctionEnd = 56,
    FunctionCall = 57,
    Variable = 59,
    ImageTexelPointer = 60,
    Load = 61,
    Store = 62,
    CopyMemory = 63,
    CopyMemorySized = 64,
    AccessChain = 65,
    InBoundsAccessChain = 66,
    PtrAccessChain = 67,
    ArrayLength = 68,
    GenericPtrMemSemantics = 69,
    InBoundsPtrAccessChain = 70,
    Decorate = 71,
    MemberDecorate = 72,
    DecorationGroup = 73,
    GroupDecorate = 74,
    GroupMemberDecorate = 75,
    VectorExtractDynamic = 77,
    VectorInsertDynamic = 78,
    VectorShuffle = 79,
    CompositeConstruct = 80,
    CompositeExtract = 81,
    CompositeInsert = 82,
    CopyObject = 83,
    Transpose = 84,
    SampledImage = 86,
    ImageSampleImplicitLod = 87,
    ImageSampleExplicitLod = 88,
    ImageSampleDrefImplicitLod = 89,
    ImageSampleDrefExplicitLod = 90,
    ImageSampleProjImplicitLod = 91,
    ImageSampleProjExplicitLod = 92,
    ImageSampleProjDrefImplicitLod = 93,
    ImageSampleProjDrefExplicitLod = 94,
    ImageFetch = 95,
    ImageGather = 96,
    ImageDrefGather = 97,
    ImageRead = 98,
    ImageWrite = 99,
    Image = 100,
    ImageQueryFormat = 101,
    ImageQueryOrder = 102,
    ImageQuerySizeLod = 103,
    ImageQuerySize = 104,
    ImageQueryLod = 105,
    ImageQueryLevels = 106,
    ImageQuerySamples = 107,
    ConvertFToU = 109,
    ConvertFToS = 110,
    ConvertSToF = 111,
    ConvertUToF = 112,
    UConvert = 113,
    SConvert = 114,
    FConvert = 115,
    QuantizeToF16 = 116,
    ConvertPtrToU = 117,
    SatConvertSToU = 118,
    SatConvertUToS = 119,
    ConvertUToPtr = 120,
    PtrCastToGeneric = 121,
    GenericCastToPtr = 122,
    GenericCastToPtrExplicit = 123,
    Bitcast = 124,
    SNegate = 126,
    FNegate = 127,
    IAdd = 128,
    FAdd = 129,
    ISub = 130,
    FSub = 131,
    IMul = 132,
    FMul = 133,
    UDiv = 134,
    SDiv = 135,
    FDiv = 136,
    UMod = 137,
    SRem = 138,
    SMod = 139,
    FRem = 140,
    FMod = 141,
    VectorTimesScalar = 142,
    MatrixTimesScalar = 143,
    VectorTimesMatrix = 144,
    MatrixTimesVector = 145,
    MatrixTimesMatrix = 146,
    OuterProduct = 147,
    Dot = 148,
    IAddCarry = 149,
    ISubBorrow = 150,
    UMulExtended = 151,
    SMulExtended = 152,
    Any = 154,
    All = 155,
    IsNan = 156,
    IsInf = 157,
    IsFinite = 158,
    IsNormal = 159,
    SignBitSet = 160,
    LessOrGreater = 161,
    Ordered = 162,
    Unordered = 163,
    LogicalEqual = 164,
    LogicalNotEqual = 165,
    LogicalOr = 166,
    LogicalAnd = 167,
    LogicalNot = 168,
    Select = 169,
    IEqual = 170,
    INotEqual = 171,
    UGreaterThan = 172,
    SGreaterThan = 173,
    UGreaterThanEqual = 174,
    SGreaterThanEqual = 175,
    ULessThan = 176,
    SLessThan = 177,
    ULessThanEqual = 178,
    SLessThanEqual = 179,
    FOrdEqual = 180,
    FUnordEqual = 181,
    FOrdNotEqual = 182,
    FUnordNotEqual = 183,
    FOrdLessThan = 184,
    FUnordLessThan = 185,
    FOrdGreaterThan = 186,
    FUnordGreaterThan = 187,
    FOrdLessThanEqual = 188,
    FUnordLessThanEqual = 189,
    FOrdGreaterThanEqual = 190,
    FUnordGreaterThanEqual = 191,
    ShiftRightLogical = 194,
    ShiftRightArithmetic = 195,
    ShiftLeftLogical = 196,
    BitwiseOr = 197,
    BitwiseXor = 198,
    BitwiseAnd = 199,
    Not = 200,
    BitFieldInsert = 201,
    BitFieldSExtract = 202,
    BitFieldUExtract = 203,
    BitReverse = 204,
    BitCount = 205,
    DPdx = 207,
    DPdy = 208,
    Fwidth = 209,
    DPdxFine = 210,
    DPdyFine = 211,
    FwidthFine = 212,
    DPdxCoarse = 213,
    DPdyCoarse = 214,
    FwidthCoarse = 215,
    EmitVertex = 218,
    EndPrimitive = 219,
    EmitStreamVertex = 220,
    EndStreamPrimitive = 221,
    ControlBarrier = 224,
    MemoryBarrier = 225,
    AtomicLoad = 227,
    AtomicStore = 228,
    AtomicExchange = 229,
    AtomicCompareExchange = 230,
    AtomicCompareExchangeWeak = 231,
    AtomicIIncrement = 232,
    AtomicIDecrement = 233,
    AtomicIAdd = 234,
    AtomicISub = 235,
    AtomicSMin = 236,
    AtomicUMin = 237,
    AtomicSMax = 238,
    AtomicUMax = 239,
    AtomicAnd = 240,
    AtomicOr = 241,
    AtomicXor = 242,
    Phi = 245,
    LoopMerge = 246,
    SelectionMerge = 247,
    Label = 248,
    Branch = 249,
    BranchConditional = 250,
    Switch = 251,
    Kill = 252,
    Return = 253,
    ReturnValue = 254,
    Unreachable = 255,
    LifetimeStart = 256,
    LifetimeStop = 257,
    GroupAsyncCopy = 259,
    GroupWaitEvents = 260,
    GroupAll = 261,
    GroupAny = 262,
    GroupBroadcast = 263,
    GroupIAdd = 264,
    GroupFAdd = 265,
    GroupFMin = 266,
    GroupUMin = 267,
    GroupSMin = 268,
    GroupFMax = 269,
    GroupUMax = 270,
    GroupSMax = 271,
    ReadPipe = 274,
    WritePipe = 275,
    ReservedReadPipe = 276,
    ReservedWritePipe = 277,
    ReserveReadPipePackets = 278,
    ReserveWritePipePackets = 279,
    CommitReadPipe = 280,
    CommitWritePipe = 281,
    IsValidReserveId = 282,
    GetNumPipePackets = 283,
    GetMaxPipePackets = 284,
    GroupReserveReadPipePackets = 285,
    GroupReserveWritePipePackets = 286,
    GroupCommitReadPipe = 287,
    GroupCommitWritePipe = 288,
    EnqueueMarker = 291,
    EnqueueKernel = 292,
    GetKernelNDrangeSubGroupCount = 293,
    GetKernelNDrangeMaxSubGroupSize = 294,
    GetKernelWorkGroupSize = 295,
    GetKernelPreferredWorkGroupSizeMultiple = 296,
    RetainEvent = 297,
    ReleaseEvent = 298,
    CreateUserEvent = 299,
    IsValidEvent = 300,
    SetUserEventStatus = 301,
    CaptureEventProfilingInfo = 302,
    GetDefaultQueue = 303,
    BuildNDRange = 304,
    ImageSparseSampleImplicitLod = 305,
    ImageSparseSampleExplicitLod = 306,
    ImageSparseSampleDrefImplicitLod = 307,
    ImageSparseSampleDrefExplicitLod = 308,
    ImageSparseSampleProjImplicitLod = 309,
    ImageSparseSampleProjExplicitLod = 310,
    ImageSparseSampleProjDrefImplicitLod = 311,
    ImageSparseSampleProjDrefExplicitLod = 312,
    ImageSparseFetch = 313,
    ImageSparseGather = 314,
    ImageSparseDrefGather = 315,
    ImageSparseTexelsResident = 316,
    NoLine = 317,
    AtomicFlagTestAndSet = 318,
    AtomicFlagClear = 319,
    ImageSparseRead = 320,
    SizeOf = 321,
    TypePipeStorage = 322,
    ConstantPipeStorage = 323,
    CreatePipeFromPipeStorage = 324,
    GetKernelLocalSizeForSubgroupCount = 325,
    GetKernelMaxNumSubgroups = 326,
    TypeNamedBarrier = 327,
    NamedBarrierInitialize = 328,
    MemoryNamedBarrier = 329,
    ModuleProcessed = 330,
    ExecutionModeId = 331,
    DecorateId = 332,
    GroupNonUniformElect = 333,
    GroupNonUniformAll = 334,
    GroupNonUniformAny = 335,
    GroupNonUniformAllEqual = 336,
    GroupNonUniformBroadcast = 337,
    GroupNonUniformBroadcastFirst = 338,
    GroupNonUniformBallot = 339,
    GroupNonUniformInverseBallot = 340,
    GroupNonUniformBallotBitExtract = 341,
    GroupNonUniformBallotBitCount = 342,
    GroupNonUniformBallotFindLSB = 343,
    GroupNonUniformBallotFindMSB = 344,
    GroupNonUniformShuffle = 345,
    GroupNonUniformShuffleXor = 346,
    GroupNonUniformShuffleUp = 347,
    GroupNonUniformShuffleDown = 348,
    GroupNonUniformIAdd = 349,
    GroupNonUniformFAdd = 350,
    GroupNonUniformIMul = 351,
    GroupNonUniformFMul = 352,
    GroupNonUniformSMin = 353,
    GroupNonUniformUMin = 354,
    GroupNonUniformFMin = 355,
    GroupNonUniformSMax = 356,
    GroupNonUniformUMax = 357,
    GroupNonUniformFMax = 358,
    GroupNonUniformBitwiseAnd = 359,
    GroupNonUniformBitwiseOr = 360,
    GroupNonUniformBitwiseXor = 361,
    GroupNonUniformLogicalAnd = 362,
    GroupNonUniformLogicalOr = 363,
    GroupNonUniformLogicalXor = 364,
    GroupNonUniformQuadBroadcast = 365,
    GroupNonUniformQuadSwap = 366,
    CopyLogical = 400,
    PtrEqual = 401,
    PtrNotEqual = 402,
    PtrDiff = 403,
    TerminateInvocation = 4416,
    SubgroupBallotKHR = 4421,
    SubgroupFirstInvocationKHR = 4422,
    SubgroupAllKHR = 4428,
    SubgroupAnyKHR = 4429,
    SubgroupAllEqualKHR = 4430,
    SubgroupReadInvocationKHR = 4432,
    TraceRayKHR = 4445,
    ExecuteCallableKHR = 4446,
    ConvertUToAccelerationStructureKHR = 4447,
    IgnoreIntersectionKHR = 4448,
    TerminateRayKHR = 4449,
    TypeRayQueryKHR = 4472,
    RayQueryInitializeKHR = 4473,
    RayQueryTerminateKHR = 4474,
    RayQueryGenerateIntersectionKHR = 4475,
    RayQueryConfirmIntersectionKHR = 4476,
    RayQueryProceedKHR = 4477,
    RayQueryGetIntersectionTypeKHR = 4479,
    GroupIAddNonUniformAMD = 5000,
    GroupFAddNonUniformAMD = 5001,
    GroupFMinNonUniformAMD = 5002,
    GroupUMinNonUniformAMD = 5003,
    GroupSMinNonUniformAMD = 5004,
    GroupFMaxNonUniformAMD = 5005,
    GroupUMaxNonUniformAMD = 5006,
    GroupSMaxNonUniformAMD = 5007,
    FragmentMaskFetchAMD = 5011,
    FragmentFetchAMD = 5012,
    ReadClockKHR = 5056,
    ImageSampleFootprintNV = 5283,
    GroupNonUniformPartitionNV = 5296,
    WritePackedPrimitiveIndices4x8NV = 5299,
    ReportIntersectionKHR = 5334,
    ReportIntersectionNV = 5334,
    IgnoreIntersectionNV = 5335,
    TerminateRayNV = 5336,
    TraceNV = 5337,
    TypeAccelerationStructureKHR = 5341,
    TypeAccelerationStructureNV = 5341,
    ExecuteCallableNV = 5344,
    TypeCooperativeMatrixNV = 5358,
    CooperativeMatrixLoadNV = 5359,
    CooperativeMatrixStoreNV = 5360,
    CooperativeMatrixMulAddNV = 5361,
    CooperativeMatrixLengthNV = 5362,
    BeginInvocationInterlockEXT = 5364,
    EndInvocationInterlockEXT = 5365,
    DemoteToHelperInvocationEXT = 5380,
    IsHelperInvocationEXT = 5381,
    SubgroupShuffleINTEL = 5571,
    SubgroupShuffleDownINTEL = 5572,
    SubgroupShuffleUpINTEL = 5573,
    SubgroupShuffleXorINTEL = 5574,
    SubgroupBlockReadINTEL = 5575,
    SubgroupBlockWriteINTEL = 5576,
    SubgroupImageBlockReadINTEL = 5577,
    SubgroupImageBlockWriteINTEL = 5578,
    SubgroupImageMediaBlockReadINTEL = 5580,
    SubgroupImageMediaBlockWriteINTEL = 5581,
    UCountLeadingZerosINTEL = 5585,
    UCountTrailingZerosINTEL = 5586,
    AbsISubINTEL = 5587,
    AbsUSubINTEL = 5588,
    IAddSatINTEL = 5589,
    UAddSatINTEL = 5590,
    IAverageINTEL = 5591,
    UAverageINTEL = 5592,
    IAverageRoundedINTEL = 5593,
    UAverageRoundedINTEL = 5594,
    ISubSatINTEL = 5595,
    USubSatINTEL = 5596,
    IMul32x16INTEL = 5597,
    UMul32x16INTEL = 5598,
    FunctionPointerINTEL = 5600,
    FunctionPointerCallINTEL = 5601,
    DecorateString = 5632,
    DecorateStringGOOGLE = 5632,
    MemberDecorateString = 5633,
    MemberDecorateStringGOOGLE = 5633,
    VmeImageINTEL = 5699,
    TypeVmeImageINTEL = 5700,
    TypeAvcImePayloadINTEL = 5701,
    TypeAvcRefPayloadINTEL = 5702,
    TypeAvcSicPayloadINTEL = 5703,
    TypeAvcMcePayloadINTEL = 5704,
    TypeAvcMceResultINTEL = 5705,
    TypeAvcImeResultINTEL = 5706,
    TypeAvcImeResultSingleReferenceStreamoutINTEL = 5707,
    TypeAvcImeResultDualReferenceStreamoutINTEL = 5708,
    TypeAvcImeSingleReferenceStreaminINTEL = 5709,
    TypeAvcImeDualReferenceStreaminINTEL = 5710,
    TypeAvcRefResultINTEL = 5711,
    TypeAvcSicResultINTEL = 5712,
    SubgroupAvcMceGetDefaultInterBaseMultiReferencePenaltyINTEL = 5713,
    SubgroupAvcMceSetInterBaseMultiReferencePenaltyINTEL = 5714,
    SubgroupAvcMceGetDefaultInterShapePenaltyINTEL = 5715,
    SubgroupAvcMceSetInterShapePenaltyINTEL = 5716,
    SubgroupAvcMceGetDefaultInterDirectionPenaltyINTEL = 5717,
    SubgroupAvcMceSetInterDirectionPenaltyINTEL = 5718,
    SubgroupAvcMceGetDefaultIntraLumaShapePenaltyINTEL = 5719,
    SubgroupAvcMceGetDefaultInterMotionVectorCostTableINTEL = 5720,
    SubgroupAvcMceGetDefaultHighPenaltyCostTableINTEL = 5721,
    SubgroupAvcMceGetDefaultMediumPenaltyCostTableINTEL = 5722,
    SubgroupAvcMceGetDefaultLowPenaltyCostTableINTEL = 5723,
    SubgroupAvcMceSetMotionVectorCostFunctionINTEL = 5724,
    SubgroupAvcMceGetDefaultIntraLumaModePenaltyINTEL = 5725,
    SubgroupAvcMceGetDefaultNonDcLumaIntraPenaltyINTEL = 5726,
    SubgroupAvcMceGetDefaultIntraChromaModeBasePenaltyINTEL = 5727,
    SubgroupAvcMceSetAcOnlyHaarINTEL = 5728,
    SubgroupAvcMceSetSourceInterlacedFieldPolarityINTEL = 5729,
    SubgroupAvcMceSetSingleReferenceInterlacedFieldPolarityINTEL = 5730,
    SubgroupAvcMceSetDualReferenceInterlacedFieldPolaritiesINTEL = 5731,
    SubgroupAvcMceConvertToImePayloadINTEL = 5732,
    SubgroupAvcMceConvertToImeResultINTEL = 5733,
    SubgroupAvcMceConvertToRefPayloadINTEL = 5734,
    SubgroupAvcMceConvertToRefResultINTEL = 5735,
    SubgroupAvcMceConvertToSicPayloadINTEL = 5736,
    SubgroupAvcMceConvertToSicResultINTEL = 5737,
    SubgroupAvcMceGetMotionVectorsINTEL = 5738,
    SubgroupAvcMceGetInterDistortionsINTEL = 5739,
    SubgroupAvcMceGetBestInterDistortionsINTEL = 5740,
    SubgroupAvcMceGetInterMajorShapeINTEL = 5741,
    SubgroupAvcMceGetInterMinorShapeINTEL = 5742,
    SubgroupAvcMceGetInterDirectionsINTEL = 5743,
    SubgroupAvcMceGetInterMotionVectorCountINTEL = 5744,
    SubgroupAvcMceGetInterReferenceIdsINTEL = 5745,
    SubgroupAvcMceGetInterReferenceInterlacedFieldPolaritiesINTEL = 5746,
    SubgroupAvcImeInitializeINTEL = 5747,
    SubgroupAvcImeSetSingleReferenceINTEL = 5748,
    SubgroupAvcImeSetDualReferenceINTEL = 5749,
    SubgroupAvcImeRefWindowSizeINTEL = 5750,
    SubgroupAvcImeAdjustRefOffsetINTEL = 5751,
    SubgroupAvcImeConvertToMcePayloadINTEL = 5752,
    SubgroupAvcImeSetMaxMotionVectorCountINTEL = 5753,
    SubgroupAvcImeSetUnidirectionalMixDisableINTEL = 5754,
    SubgroupAvcImeSetEarlySearchTerminationThresholdINTEL = 5755,
    SubgroupAvcImeSetWeightedSadINTEL = 5756,
    SubgroupAvcImeEvaluateWithSingleReferenceINTEL = 5757,
    SubgroupAvcImeEvaluateWithDualReferenceINTEL = 5758,
    SubgroupAvcImeEvaluateWithSingleReferenceStreaminINTEL = 5759,
    SubgroupAvcImeEvaluateWithDualReferenceStreaminINTEL = 5760,
    SubgroupAvcImeEvaluateWithSingleReferenceStreamoutINTEL = 5761,
    SubgroupAvcImeEvaluateWithDualReferenceStreamoutINTEL = 5762,
    SubgroupAvcImeEvaluateWithSingleReferenceStreaminoutINTEL = 5763,
    SubgroupAvcImeEvaluateWithDualReferenceStreaminoutINTEL = 5764,
    SubgroupAvcImeConvertToMceResultINTEL = 5765,
    SubgroupAvcImeGetSingleReferenceStreaminINTEL = 5766,
    SubgroupAvcImeGetDualReferenceStreaminINTEL = 5767,
    SubgroupAvcImeStripSingleReferenceStreamoutINTEL = 5768,
    SubgroupAvcImeStripDualReferenceStreamoutINTEL = 5769,
    SubgroupAvcImeGetStreamoutSingleReferenceMajorShapeMotionVectorsINTEL = 5770,
    SubgroupAvcImeGetStreamoutSingleReferenceMajorShapeDistortionsINTEL = 5771,
    SubgroupAvcImeGetStreamoutSingleReferenceMajorShapeReferenceIdsINTEL = 5772,
    SubgroupAvcImeGetStreamoutDualReferenceMajorShapeMotionVectorsINTEL = 5773,
    SubgroupAvcImeGetStreamoutDualReferenceMajorShapeDistortionsINTEL = 5774,
    SubgroupAvcImeGetStreamoutDualReferenceMajorShapeReferenceIdsINTEL = 5775,
    SubgroupAvcImeGetBorderReachedINTEL = 5776,
    SubgroupAvcImeGetTruncatedSearchIndicationINTEL = 5777,
    SubgroupAvcImeGetUnidirectionalEarlySearchTerminationINTEL = 5778,
    SubgroupAvcImeGetWeightingPatternMinimumMotionVectorINTEL = 5779,
    SubgroupAvcImeGetWeightingPatternMinimumDistortionINTEL = 5780,
    SubgroupAvcFmeInitializeINTEL = 5781,
    SubgroupAvcBmeInitializeINTEL = 5782,
    SubgroupAvcRefConvertToMcePayloadINTEL = 5783,
    SubgroupAvcRefSetBidirectionalMixDisableINTEL = 5784,
    SubgroupAvcRefSetBilinearFilterEnableINTEL = 5785,
    SubgroupAvcRefEvaluateWithSingleReferenceINTEL = 5786,
    SubgroupAvcRefEvaluateWithDualReferenceINTEL = 5787,
    SubgroupAvcRefEvaluateWithMultiReferenceINTEL = 5788,
    SubgroupAvcRefEvaluateWithMultiReferenceInterlacedINTEL = 5789,
    SubgroupAvcRefConvertToMceResultINTEL = 5790,
    SubgroupAvcSicInitializeINTEL = 5791,
    SubgroupAvcSicConfigureSkcINTEL = 5792,
    SubgroupAvcSicConfigureIpeLumaINTEL = 5793,
    SubgroupAvcSicConfigureIpeLumaChromaINTEL = 5794,
    SubgroupAvcSicGetMotionVectorMaskINTEL = 5795,
    SubgroupAvcSicConvertToMcePayloadINTEL = 5796,
    SubgroupAvcSicSetIntraLumaShapePenaltyINTEL = 5797,
    SubgroupAvcSicSetIntraLumaModeCostFunctionINTEL = 5798,
    SubgroupAvcSicSetIntraChromaModeCostFunctionINTEL = 5799,
    SubgroupAvcSicSetBilinearFilterEnableINTEL = 5800,
    SubgroupAvcSicSetSkcForwardTransformEnableINTEL = 5801,
    SubgroupAvcSicSetBlockBasedRawSkipSadINTEL = 5802,
    SubgroupAvcSicEvaluateIpeINTEL = 5803,
    SubgroupAvcSicEvaluateWithSingleReferenceINTEL = 5804,
    SubgroupAvcSicEvaluateWithDualReferenceINTEL = 5805,
    SubgroupAvcSicEvaluateWithMultiReferenceINTEL = 5806,
    SubgroupAvcSicEvaluateWithMultiReferenceInterlacedINTEL = 5807,
    SubgroupAvcSicConvertToMceResultINTEL = 5808,
    SubgroupAvcSicGetIpeLumaShapeINTEL = 5809,
    SubgroupAvcSicGetBestIpeLumaDistortionINTEL = 5810,
    SubgroupAvcSicGetBestIpeChromaDistortionINTEL = 5811,
    SubgroupAvcSicGetPackedIpeLumaModesINTEL = 5812,
    SubgroupAvcSicGetIpeChromaModeINTEL = 5813,
    SubgroupAvcSicGetPackedSkcLumaCountThresholdINTEL = 5814,
    SubgroupAvcSicGetPackedSkcLumaSumThresholdINTEL = 5815,
    SubgroupAvcSicGetInterRawSadsINTEL = 5816,
    LoopControlINTEL = 5887,
    ReadPipeBlockingINTEL = 5946,
    WritePipeBlockingINTEL = 5947,
    FPGARegINTEL = 5949,
    RayQueryGetRayTMinKHR = 6016,
    RayQueryGetRayFlagsKHR = 6017,
    RayQueryGetIntersectionTKHR = 6018,
    RayQueryGetIntersectionInstanceCustomIndexKHR = 6019,
    RayQueryGetIntersectionInstanceIdKHR = 6020,
    RayQueryGetIntersectionInstanceShaderBindingTableRecordOffsetKHR = 6021,
    RayQueryGetIntersectionGeometryIndexKHR = 6022,
    RayQueryGetIntersectionPrimitiveIndexKHR = 6023,
    RayQueryGetIntersectionBarycentricsKHR = 6024,
    RayQueryGetIntersectionFrontFaceKHR = 6025,
    RayQueryGetIntersectionCandidateAABBOpaqueKHR = 6026,
    RayQueryGetIntersectionObjectRayDirectionKHR = 6027,
    RayQueryGetIntersectionObjectRayOriginKHR = 6028,
    RayQueryGetWorldRayDirectionKHR = 6029,
    RayQueryGetWorldRayOriginKHR = 6030,
    RayQueryGetIntersectionObjectToWorldKHR = 6031,
    RayQueryGetIntersectionWorldToObjectKHR = 6032,
    AtomicFAddEXT = 6035,
    Max = 2147483647
}
