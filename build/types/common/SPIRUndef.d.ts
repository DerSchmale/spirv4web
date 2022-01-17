import { IVariant } from "./IVariant";
import { Types } from "./Types";
export declare class SPIRUndef extends IVariant {
    static type: Types;
    basetype: TypeID;
    constructor(other: SPIRUndef);
    constructor(basetype: TypeID);
}
