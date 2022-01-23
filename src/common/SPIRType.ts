import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultClone, defaultCopy } from "../utils/defaultCopy";
import { Dim } from "../spirv/Dim";
import { ImageFormat } from "../spirv/ImageFormat";
import { AccessQualifier } from "../spirv/AccessQualifier";
import { StorageClass } from "../spirv/StorageClass";

export enum SPIRTypeBaseType
{
    Unknown,
    Void,
    Boolean,
    SByte,
    UByte,
    Short,
    UShort,
    Int,
    UInt,
    Int64,
    UInt64,
    AtomicCounter,
    Half,
    Float,
    Double,
    Struct,
    Image,
    SampledImage,
    Sampler,
    AccelerationStructure,
    RayQuery,

    // Keep internal types at the end.
    ControlPointArray,
    Interpolant,
    Char
}

export class SPIRTypeImageType
{
    type: TypeID;
    dim: Dim;
    depth: boolean;
    arrayed: boolean;
    ms: boolean;
    sampled: number;
    format: ImageFormat;
    access: AccessQualifier;

    clone() { return defaultClone(SPIRTypeImageType, this); }
    equals(b: SPIRTypeImageType): boolean
    {
        return this.type === b.type && this.dim === b.dim && this.depth === b.depth && this.arrayed === b.arrayed &&
            this.ms === b.ms && this.sampled === b.sampled && this.format === b.format && this.access === b.access;
    }
}

export class SPIRType extends IVariant
{
    static type = Types.TypeType;

    // Scalar/vector/matrix support.
    basetype: SPIRTypeBaseType = SPIRTypeBaseType.Unknown;
    width: number = 0;
    vecsize: number = 1;
    columns: number = 1;

    // Arrays, support array of arrays by having a vector of array sizes.
    array: number[] = [];

    // Array elements can be either specialization constants or specialization ops.
    // This array determines how to interpret the array size.
    // If an element is true, the element is a literal,
    // otherwise, it's an expression, which must be resolved on demand.
    // The actual size is not really known until runtime.
    array_size_literal: boolean[] = [];

    // Pointers
    // Keep track of how many pointer layers we have.
    pointer_depth: number = 0;
    pointer: boolean = false;
    forward_pointer: boolean = false;
    storage: StorageClass = StorageClass.StorageClassGeneric;

    member_types: TypeID[] = [];

    // If member order has been rewritten to handle certain scenarios with Offset,
    // allow codegen to rewrite the index.
    member_type_index_redirection: number[] = [];

    image: SPIRTypeImageType = new SPIRTypeImageType();

    // Structs can be declared multiple times if they are used as part of interface blocks.
    // We want to detect this so that we only emit the struct definition once.
    // Since we cannot rely on OpName to be equal, we need to figure out aliases.
    type_alias: TypeID = 0;

    // Denotes the type which this type is based on.
    // Allows the backend to traverse how a complex type is built up during access chains.
    parent_type: TypeID = 0;

    // Used in backends to avoid emitting members with conflicting names.

    member_name_cache: Set<string> = new Set<string>();

    constructor(other?: SPIRType)
    {
        super();
        if (other)
            defaultCopy(other, this);
    }
}