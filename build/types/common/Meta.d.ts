import { Bitset } from "./Bitset";
import { BuiltIn, FPRoundingMode } from "../spirv";
export declare enum ExtendedDecorations {
    SPIRVCrossDecorationBufferBlockRepacked = 0,
    SPIRVCrossDecorationPhysicalTypeID = 1,
    SPIRVCrossDecorationPhysicalTypePacked = 2,
    SPIRVCrossDecorationPaddingTarget = 3,
    SPIRVCrossDecorationInterfaceMemberIndex = 4,
    SPIRVCrossDecorationInterfaceOrigID = 5,
    SPIRVCrossDecorationResourceIndexPrimary = 6,
    SPIRVCrossDecorationResourceIndexSecondary = 7,
    SPIRVCrossDecorationResourceIndexTertiary = 8,
    SPIRVCrossDecorationResourceIndexQuaternary = 9,
    SPIRVCrossDecorationExplicitOffset = 10,
    SPIRVCrossDecorationBuiltInDispatchBase = 11,
    SPIRVCrossDecorationDynamicImageSampler = 12,
    SPIRVCrossDecorationBuiltInStageInputSize = 13,
    SPIRVCrossDecorationTessIOOriginalInputTypeID = 14,
    SPIRVCrossDecorationInterpolantComponentExpr = 15,
    SPIRVCrossDecorationCount = 16
}
export declare class MetaDecorationExtended {
    flags: Bitset;
    values: Uint32Array;
}
export declare class MetaDecoration {
    alias: string;
    qualified_alias: string;
    hlsl_semantic: string;
    decoration_flags: Bitset;
    builtin_type: BuiltIn;
    location: number;
    component: number;
    set: number;
    binding: number;
    offset: number;
    xfb_buffer: number;
    xfb_stride: number;
    stream: number;
    array_stride: number;
    matrix_stride: number;
    input_attachment: number;
    spec_id: number;
    index: number;
    fp_rounding_mode: FPRoundingMode;
    builtin: boolean;
    extended: MetaDecorationExtended;
}
export declare class Meta {
    decoration: MetaDecoration;
    members: MetaDecoration[];
    decoration_word_offset: number[];
    hlsl_is_magic_counter_buffer: boolean;
    hlsl_magic_counter_buffer: number;
}
