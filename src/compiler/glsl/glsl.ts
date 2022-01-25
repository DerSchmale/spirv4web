export const GLSLstd450Version = 100;
export const GLSLstd450Revision = 3;

export enum GLSLstd450 {
    Bad = 0,              // Don't use

    Round = 1,
    RoundEven = 2,
    Trunc = 3,
    FAbs = 4,
    SAbs = 5,
    FSign = 6,
    SSign = 7,
    Floor = 8,
    Ceil = 9,
    Fract = 10,

    Radians = 11,
    Degrees = 12,
    Sin = 13,
    Cos = 14,
    Tan = 15,
    Asin = 16,
    Acos = 17,
    Atan = 18,
    Sinh = 19,
    Cosh = 20,
    Tanh = 21,
    Asinh = 22,
    Acosh = 23,
    Atanh = 24,
    Atan2 = 25,

    Pow = 26,
    Exp = 27,
    Log = 28,
    Exp2 = 29,
    Log2 = 30,
    Sqrt = 31,
    InverseSqrt = 32,

    Determinant = 33,
    MatrixInverse = 34,

    Modf = 35,            // second operand needs an OpVariable to write to
    ModfStruct = 36,      // no OpVariable operand
    FMin = 37,
    UMin = 38,
    SMin = 39,
    FMax = 40,
    UMax = 41,
    SMax = 42,
    FClamp = 43,
    UClamp = 44,
    SClamp = 45,
    FMix = 46,
    IMix = 47,            // Reserved
    Step = 48,
    SmoothStep = 49,

    Fma = 50,
    Frexp = 51,            // second operand needs an OpVariable to write to
    FrexpStruct = 52,      // no OpVariable operand
    Ldexp = 53,

    PackSnorm4x8 = 54,
    PackUnorm4x8 = 55,
    PackSnorm2x16 = 56,
    PackUnorm2x16 = 57,
    PackHalf2x16 = 58,
    PackDouble2x32 = 59,
    UnpackSnorm2x16 = 60,
    UnpackUnorm2x16 = 61,
    UnpackHalf2x16 = 62,
    UnpackSnorm4x8 = 63,
    UnpackUnorm4x8 = 64,
    UnpackDouble2x32 = 65,

    Length = 66,
    Distance = 67,
    Cross = 68,
    Normalize = 69,
    FaceForward = 70,
    Reflect = 71,
    Refract = 72,

    FindILsb = 73,
    FindSMsb = 74,
    FindUMsb = 75,

    InterpolateAtCentroid = 76,
    InterpolateAtSample = 77,
    InterpolateAtOffset = 78,

    NMin = 79,
    NMax = 80,
    NClamp = 81,

    Count
}

export enum PlsFormat
{
    None = 0,

    R11FG11FB10F,
    R32F,
    RG16F,
    RGB10A2,
    RGBA8,
    RG16,

    RGBA8I,
    RG16I,

    RGB10A2UI,
    RGBA8UI,
    RG16UI,
    R32UI
}

// Can be overriden by subclass backends for trivial things which
// shouldn't need polymorphism.
export class BackendVariations
{
    discard_literal: string = "discard";
    demote_literal: string = "demote";
    null_pointer_literal: string = "";
    float_literal_suffix: boolean = false;
    double_literal_suffix: boolean = true;
    uint32_t_literal_suffix: boolean = true;
    long_long_literal_suffix: boolean = false;
    basic_int_type: string = "int";
    basic_uint_type: string = "uint";
    basic_int8_type: string = "int8_t";
    basic_uint8_type: string = "uint8_t";
    basic_int16_type: string = "int16_t";
    basic_uint16_type: string = "uint16_t";
    int16_t_literal_suffix: string = "s";
    uint16_t_literal_suffix: string = "us";
    nonuniform_qualifier: string = "nonuniformEXT";
    // boolean_mix_function: string = "mix";
    swizzle_is_function: boolean = false;
    shared_is_implied: boolean = false;
    unsized_array_supported: boolean = true;
    explicit_struct_type: boolean = false;
    use_initializer_list: boolean = false;
    use_typed_initializer_list: boolean = false;
    can_declare_struct_inline: boolean = true;
    can_declare_arrays_inline: boolean = true;
    native_row_major_matrix: boolean = true;
    use_constructor_splatting: boolean = true;
    allow_precision_qualifiers: boolean = false;
    can_swizzle_scalar: boolean = false;
    force_gl_in_out_block: boolean = false;
    can_return_array: boolean = true;
    allow_truncated_access_chain: boolean = false;
    supports_extensions: boolean = false;
    supports_empty_struct: boolean = false;
    array_is_value_type: boolean = true;
    buffer_offset_array_is_value_type: boolean = true;
    comparison_image_samples_scalar: boolean = false;
    native_pointers: boolean = false;
    support_small_type_sampling_result: boolean = false;
    support_case_fallthrough: boolean = true;
    use_array_constructor: boolean = false;
    needs_row_major_load_workaround: boolean = false;
    support_pointer_to_pointer: boolean = false;
    support_precise_qualifier: boolean = false;
    support_64bit_switch: boolean = false;
    workgroup_size_is_hidden: boolean = false;
}