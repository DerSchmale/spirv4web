import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";
import { Op } from "../spirv/Op";

export class SPIRConstantOp extends IVariant
{
    static type = Types.ConstantOp;

    opcode: Op;
    arguments: number[] = [];
    basetype: TypeID;

    constructor(other: SPIRConstantOp);
    constructor(result_type: TypeID, op: Op, args: number[]);
    constructor(param0: TypeID | SPIRConstantOp, op?: Op, args?: number[])
    {
        super();
        if (param0 instanceof SPIRConstantOp) {
            defaultCopy(param0, this);
        }
        else {
            this.basetype = param0;
            this.opcode = op;
            this.arguments = args.slice();
        }
    }
}