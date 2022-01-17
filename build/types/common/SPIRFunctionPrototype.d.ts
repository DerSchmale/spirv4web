import { IVariant } from "./IVariant";
import { Types } from "./Types";
export declare class SPIRFunctionPrototype extends IVariant {
    static type: Types;
    return_type: TypeID;
    parameter_types: number[];
    constructor(other: SPIRFunctionPrototype);
    constructor(return_type: TypeID);
}
