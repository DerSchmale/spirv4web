import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";
import { StorageClass } from "../spirv/StorageClass";

export class SPIRAccessChain extends IVariant
{
    static type = Types.AccessChain;

    // The access chain represents an offset into a buffer.
    // Some backends need more complicated handling of access chains to be able to use buffers, like HLSL
    // which has no usable buffer type ala GLSL SSBOs.
    // StructuredBuffer is too limited, so our only option is to deal with ByteAddressBuffer which works with raw addresses.

    basetype: TypeID;
    storage: StorageClass;
    base: string;
    dynamic_index: string;
    static_index: number;

    loaded_from: VariableID = 0;
    matrix_stride: number = 0;
    array_stride: number = 0;
    row_major_matrix: boolean = false;
    immutable: boolean = false;

    // By reading this expression, we implicitly read these expressions as well.
    // Used by access chain Store and Load since we read multiple expressions in this case.
    implied_read_expressions: ID[] = [];

    constructor(other: SPIRAccessChain);
    constructor(basetype: TypeID, storage: StorageClass, base: string, dynamic_index: string, static_index: number);
    constructor(param0: TypeID | SPIRAccessChain = 0, storage?: StorageClass, base?: string, dynamic_index?: string, static_index?: number)
    {
        super();
        if (param0 instanceof SPIRAccessChain) {
            defaultCopy(param0, this);
        }
        else {
            this.basetype = param0;
            this.storage = storage;
            this.base = base;
            this.dynamic_index = dynamic_index;
            this.static_index = static_index;
        }
    }
}