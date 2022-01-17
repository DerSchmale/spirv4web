import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { SPIRType } from "./SPIRType";
export declare class SPIRConstantConstant {
    value: ArrayBuffer;
    private _dataView;
    get u32(): number;
    set u32(value: number);
    get i32(): number;
    set i32(value: number);
    get f32(): number;
    set f32(value: number);
    get u64(): bigint;
    set u64(value: bigint);
    get i64(): bigint;
    set i64(value: bigint);
    get f64(): number;
    set f64(value: number);
    clone(): SPIRConstantConstant;
}
export declare class SPIRConstantConstantVector {
    r: SPIRConstantConstant[];
    id: ID[];
    vecsize: number;
    constructor();
    clone(): SPIRConstantConstantVector;
}
export declare class SPIRConstantConstantMatrix {
    c: SPIRConstantConstantVector[];
    id: ID[];
    columns: number;
    constructor();
    clone(): SPIRConstantConstantMatrix;
}
export declare class SPIRConstant extends IVariant {
    static type: Types;
    constant_type: TypeID;
    m: SPIRConstantConstantMatrix;
    specialization: boolean;
    is_used_as_array_length: boolean;
    is_used_as_lut: boolean;
    subconstants: Uint32Array;
    specialization_constant_macro_name: string;
    f16_to_f32(u16_value: number): number;
    specialization_constant_id(col: number, row?: number): number;
    scalar(col?: number, row?: number): number;
    scalar_i16(col?: number, row?: number): number;
    scalar_u16(col?: number, row?: number): number;
    scalar_i8(col?: number, row?: number): number;
    scalar_u8(col?: number, row?: number): number;
    scalar_f16(col?: number, row?: number): number;
    scalar_f32(col?: number, row?: number): number;
    scalar_i32(col?: number, row?: number): number;
    scalar_f64(col?: number, row?: number): number;
    scalar_i64(col?: number, row?: number): bigint;
    scalar_u64(col?: number, row?: number): bigint;
    vector(): SPIRConstantConstantVector;
    vector_size(): number;
    columns(): number;
    make_null(constant_type: SPIRType): void;
    constant_is_null(): boolean;
    constructor();
    constructor(other: SPIRConstant);
    constructor(constant_type: TypeID);
    constructor(constant_type: TypeID, elements: number[], num_elements: number, specialized: boolean);
    constructor(constant_type: TypeID, v0: number, specialized: boolean);
    constructor(constant_type: TypeID, v0: bigint, specialized: boolean);
    constructor(constant_type: TypeID, vector_elements: SPIRConstant[], num_elements: number, specialized: boolean);
    _construct(constant_type: TypeID): void;
    _constructArray(constant_type: TypeID, elements: Uint32Array, num_elements: number, specialized: boolean): void;
    _constructScalar32(constant_type: TypeID, v0: number, specialized: boolean): void;
    _constructScalar64(constant_type: TypeID, v0: bigint, specialized: boolean): void;
    _constructVecMat(constant_type: TypeID, vector_elements: SPIRConstant[], num_elements: number, specialized: boolean): void;
}
