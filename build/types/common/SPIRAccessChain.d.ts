import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { StorageClass } from "../spirv/StorageClass";
export declare class SPIRAccessChain extends IVariant {
    static type: Types;
    basetype: TypeID;
    storage: StorageClass;
    base: string;
    dynamic_index: string;
    static_index: number;
    loaded_from: VariableID;
    matrix_stride: number;
    array_stride: number;
    row_major_matrix: boolean;
    immutable: boolean;
    implied_read_expressions: ID[];
    constructor(other: SPIRAccessChain);
    constructor(basetype: TypeID, storage: StorageClass, base: string, dynamic_index: string, static_index: number);
}
