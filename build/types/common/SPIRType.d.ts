import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { Dim } from "../spirv/Dim";
import { ImageFormat } from "../spirv/ImageFormat";
import { AccessQualifier } from "../spirv/AccessQualifier";
import { StorageClass } from "../spirv/StorageClass";
export declare enum SPIRBaseType {
    Unknown = 0,
    Void = 1,
    Boolean = 2,
    SByte = 3,
    UByte = 4,
    Short = 5,
    UShort = 6,
    Int = 7,
    UInt = 8,
    Int64 = 9,
    UInt64 = 10,
    AtomicCounter = 11,
    Half = 12,
    Float = 13,
    Double = 14,
    Struct = 15,
    Image = 16,
    SampledImage = 17,
    Sampler = 18,
    AccelerationStructure = 19,
    RayQuery = 20,
    ControlPointArray = 21,
    Interpolant = 22,
    Char = 23
}
export declare class SPIRTypeImageType {
    type: TypeID;
    dim: Dim;
    depth: boolean;
    arrayed: boolean;
    ms: boolean;
    sampled: number;
    format: ImageFormat;
    access: AccessQualifier;
    clone(): SPIRTypeImageType;
    equals(b: SPIRTypeImageType): boolean;
}
export declare class SPIRType extends IVariant {
    static type: Types;
    basetype: SPIRBaseType;
    width: number;
    vecsize: number;
    columns: number;
    array: number[];
    array_size_literal: boolean[];
    pointer_depth: number;
    pointer: boolean;
    forward_pointer: boolean;
    storage: StorageClass;
    member_types: TypeID[];
    member_type_index_redirection: number[];
    image: SPIRTypeImageType;
    type_alias: TypeID;
    parent_type: TypeID;
    member_name_cache: Set<string>;
    constructor(other?: SPIRType);
}
