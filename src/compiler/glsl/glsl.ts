export const GLSLstd450Version = 100;
export const GLSLstd450Revision = 3;

export enum GLSLstd450 {
    GLSLstd450Bad = 0,              // Don't use

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

    GLSLstd450Modf = 35,            // second operand needs an OpVariable to write to
    GLSLstd450ModfStruct = 36,      // no OpVariable operand
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
    GLSLstd450IMix = 47,            // Reserved
    GLSLstd450Step = 48,
    GLSLstd450SmoothStep = 49,

    GLSLstd450Fma = 50,
    GLSLstd450Frexp = 51,            // second operand needs an OpVariable to write to
    GLSLstd450FrexpStruct = 52,      // no OpVariable operand
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

    GLSLstd450Count
}

export enum PlsFormat
{
    PlsNone = 0,

    PlsR11FG11FB10F,
    PlsR32F,
    PlsRG16F,
    PlsRGB10A2,
    PlsRGBA8,
    PlsRG16,

    PlsRGBA8I,
    PlsRG16I,

    PlsRGB10A2UI,
    PlsRGBA8UI,
    PlsRG16UI,
    PlsR32UI
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
    boolean_mix_function: string = "mix";
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