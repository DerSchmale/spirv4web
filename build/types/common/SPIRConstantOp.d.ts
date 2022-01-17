import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { Op } from "../spirv";
export declare class SPIRConstantOp extends IVariant {
    static type: Types;
    opcode: Op;
    arguments: number[];
    basetype: TypeID;
    constructor(other: SPIRConstantOp);
    constructor(result_type: TypeID, op: Op, args: number[]);
}
