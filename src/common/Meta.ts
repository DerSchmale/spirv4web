import { Bitset } from "./Bitset";
import { BuiltIn } from "../spirv/BuiltIn";
import { FPRoundingMode } from "../spirv/FPRoundingMode";
import { defaultClone } from "../utils/defaultCopy";
import { ExtendedDecorations } from "./ExtendedDecorations";

export class MetaDecorationExtended
{
    flags: Bitset = new Bitset();
    values: Uint32Array = new Uint32Array(ExtendedDecorations.Count);

    clone(): MetaDecorationExtended
    {
        return defaultClone(MetaDecorationExtended, this);
    }
}

export class MetaDecoration
{
    alias: string = "";
    qualified_alias: string = "";
    hlsl_semantic: string = "";
    decoration_flags: Bitset = new Bitset();
    builtin_type = BuiltIn.Max;
    location: number = 0;
    component: number = 0;
    set: number = 0;
    binding: number = 0;
    offset: number = 0;
    xfb_buffer: number = 0;
    xfb_stride: number = 0;
    stream: number = 0;
    array_stride: number = 0;
    matrix_stride: number = 0;
    input_attachment: number = 0;
    spec_id: number = 0;
    index: number = 0;
    fp_rounding_mode: FPRoundingMode = FPRoundingMode.Max;
    builtin: boolean = false;

    extended: MetaDecorationExtended = new MetaDecorationExtended();

    clone(): MetaDecoration
    {
        return defaultClone(MetaDecoration, this);
    }
}

export class Meta
{
    decoration = new MetaDecoration();

    // Intentionally not a SmallVector. Decoration is large and somewhat rare.
    members: MetaDecoration[] = [];

    decoration_word_offset: number[] = [];

    // For SPV_GOOGLE_hlsl_functionality1.
    hlsl_is_magic_counter_buffer: boolean = false;
    // ID for the sibling counter buffer.
    hlsl_magic_counter_buffer: number = 0;
}