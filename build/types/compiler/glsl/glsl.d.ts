export declare const GLSLstd450Version = 100;
export declare const GLSLstd450Revision = 3;
export declare enum GLSLstd450 {
    Bad = 0,
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
    Modf = 35,
    ModfStruct = 36,
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
    IMix = 47,
    Step = 48,
    SmoothStep = 49,
    Fma = 50,
    Frexp = 51,
    FrexpStruct = 52,
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
    Count = 82
}
export declare enum PlsFormat {
    None = 0,
    R11FG11FB10F = 1,
    R32F = 2,
    RG16F = 3,
    RGB10A2 = 4,
    RGBA8 = 5,
    RG16 = 6,
    RGBA8I = 7,
    RG16I = 8,
    RGB10A2UI = 9,
    RGBA8UI = 10,
    RG16UI = 11,
    R32UI = 12
}
export declare class BackendVariations {
    discard_literal: string;
    demote_literal: string;
    null_pointer_literal: string;
    float_literal_suffix: boolean;
    double_literal_suffix: boolean;
    uint32_t_literal_suffix: boolean;
    long_long_literal_suffix: boolean;
    basic_int_type: string;
    basic_uint_type: string;
    basic_int8_type: string;
    basic_uint8_type: string;
    basic_int16_type: string;
    basic_uint16_type: string;
    int16_t_literal_suffix: string;
    uint16_t_literal_suffix: string;
    nonuniform_qualifier: string;
    swizzle_is_function: boolean;
    shared_is_implied: boolean;
    unsized_array_supported: boolean;
    explicit_struct_type: boolean;
    use_initializer_list: boolean;
    use_typed_initializer_list: boolean;
    can_declare_struct_inline: boolean;
    can_declare_arrays_inline: boolean;
    native_row_major_matrix: boolean;
    use_constructor_splatting: boolean;
    allow_precision_qualifiers: boolean;
    can_swizzle_scalar: boolean;
    force_gl_in_out_block: boolean;
    can_return_array: boolean;
    allow_truncated_access_chain: boolean;
    supports_extensions: boolean;
    supports_empty_struct: boolean;
    array_is_value_type: boolean;
    buffer_offset_array_is_value_type: boolean;
    comparison_image_samples_scalar: boolean;
    native_pointers: boolean;
    support_small_type_sampling_result: boolean;
    support_case_fallthrough: boolean;
    use_array_constructor: boolean;
    needs_row_major_load_workaround: boolean;
    support_pointer_to_pointer: boolean;
    support_precise_qualifier: boolean;
    support_64bit_switch: boolean;
    workgroup_size_is_hidden: boolean;
}
