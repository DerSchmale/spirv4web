import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";

export class SPIRFunctionPrototype extends IVariant
{
    static type = Types.FunctionPrototype;

    return_type: TypeID;
    parameter_types: number[] = [];

    constructor(other: SPIRFunctionPrototype);
    constructor(return_type: TypeID);
    constructor(param0: TypeID | SPIRFunctionPrototype)
    {
        super();
        if (param0 instanceof SPIRFunctionPrototype)
            defaultCopy(param0, this);
        else
            this.return_type = param0;
    }
}