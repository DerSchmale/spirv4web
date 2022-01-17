import { IVariant } from "./IVariant";
import { Types } from "./Types";
export declare class SPIRString extends IVariant {
    static type: Types;
    str: string;
    constructor(other: SPIRString);
    constructor(str: string);
}
