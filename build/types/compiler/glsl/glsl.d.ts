export declare const GLSLstd450Version = 100;
export declare const GLSLstd450Revision = 3;
export declare enum GLSLstd450 {
    GLSLstd450Bad = 0,
    GLSLstd450Round = 1,
    GLSLstd450RoundEven = 2,
    GLSLstd450Trunc = 3,
    GLSLstd450FAbs = 4,
    GLSLstd450SAbs = 5,
    GLSLstd450FSign = 6,
    GLSLstd450SSign = 7,
    GLSLstd450Floor = 8,
    GLSLstd450Ceil = 9,
    GLSLstd450Fract = 10,
    GLSLstd450Radians = 11,
    GLSLstd450Degrees = 12,
    GLSLstd450Sin = 13,
    GLSLstd450Cos = 14,
    GLSLstd450Tan = 15,
    GLSLstd450Asin = 16,
    GLSLstd450Acos = 17,
    GLSLstd450Atan = 18,
    GLSLstd450Sinh = 19,
    GLSLstd450Cosh = 20,
    GLSLstd450Tanh = 21,
    GLSLstd450Asinh = 22,
    GLSLstd450Acosh = 23,
    GLSLstd450Atanh = 24,
    GLSLstd450Atan2 = 25,
    GLSLstd450Pow = 26,
    GLSLstd450Exp = 27,
    GLSLstd450Log = 28,
    GLSLstd450Exp2 = 29,
    GLSLstd450Log2 = 30,
    GLSLstd450Sqrt = 31,
    GLSLstd450InverseSqrt = 32,
    GLSLstd450Determinant = 33,
    GLSLstd450MatrixInverse = 34,
    GLSLstd450Modf = 35,
    GLSLstd450ModfStruct = 36,
    GLSLstd450FMin = 37,
    GLSLstd450UMin = 38,
    GLSLstd450SMin = 39,
    GLSLstd450FMax = 40,
    GLSLstd450UMax = 41,
    GLSLstd450SMax = 42,
    GLSLstd450FClamp = 43,
    GLSLstd450UClamp = 44,
    GLSLstd450SClamp = 45,
    GLSLstd450FMix = 46,
    GLSLstd450IMix = 47,
    GLSLstd450Step = 48,
    GLSLstd450SmoothStep = 49,
    GLSLstd450Fma = 50,
    GLSLstd450Frexp = 51,
    GLSLstd450FrexpStruct = 52,
    GLSLstd450Ldexp = 53,
    GLSLstd450PackSnorm4x8 = 54,
    GLSLstd450PackUnorm4x8 = 55,
    GLSLstd450PackSnorm2x16 = 56,
    GLSLstd450PackUnorm2x16 = 57,
    GLSLstd450PackHalf2x16 = 58,
    GLSLstd450PackDouble2x32 = 59,
    GLSLstd450UnpackSnorm2x16 = 60,
    GLSLstd450UnpackUnorm2x16 = 61,
    GLSLstd450UnpackHalf2x16 = 62,
    GLSLstd450UnpackSnorm4x8 = 63,
    GLSLstd450UnpackUnorm4x8 = 64,
    GLSLstd450UnpackDouble2x32 = 65,
    GLSLstd450Length = 66,
    GLSLstd450Distance = 67,
    GLSLstd450Cross = 68,
    GLSLstd450Normalize = 69,
    GLSLstd450FaceForward = 70,
    GLSLstd450Reflect = 71,
    GLSLstd450Refract = 72,
    GLSLstd450FindILsb = 73,
    GLSLstd450FindSMsb = 74,
    GLSLstd450FindUMsb = 75,
    GLSLstd450InterpolateAtCentroid = 76,
    GLSLstd450InterpolateAtSample = 77,
    GLSLstd450InterpolateAtOffset = 78,
    GLSLstd450NMin = 79,
    GLSLstd450NMax = 80,
    GLSLstd450NClamp = 81,
    GLSLstd450Count = 82
}
export declare enum PlsFormat {
    PlsNone = 0,
    PlsR11FG11FB10F = 1,
    PlsR32F = 2,
    PlsRG16F = 3,
    PlsRGB10A2 = 4,
    PlsRGBA8 = 5,
    PlsRG16 = 6,
    PlsRGBA8I = 7,
    PlsRG16I = 8,
    PlsRGB10A2UI = 9,
    PlsRGBA8UI = 10,
    PlsRG16UI = 11,
    PlsR32UI = 12
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
    boolean_mix_function: string;
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
