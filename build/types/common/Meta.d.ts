import { Bitset } from "./Bitset";
import { BuiltIn } from "../spirv/BuiltIn";
import { FPRoundingMode } from "../spirv/FPRoundingMode";
export declare class MetaDecorationExtended {
    flags: Bitset;
    values: Uint32Array;
    clone(): MetaDecorationExtended;
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
    clone(): MetaDecoration;
}
export declare class Meta {
    decoration: MetaDecoration;
    members: MetaDecoration[];
    decoration_word_offset: number[];
    hlsl_is_magic_counter_buffer: boolean;
    hlsl_magic_counter_buffer: number;
}
