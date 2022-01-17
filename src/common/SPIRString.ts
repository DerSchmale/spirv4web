import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";

export class SPIRString extends IVariant
{
    static type = Types.TypeString;

    str: string;

    constructor(other: SPIRString);
    constructor(str: string);
    constructor(param0: string | SPIRString)
    {
        super();
        if (param0 instanceof SPIRString)
            defaultCopy(this, param0);
        else
            this.str = param0;
    }
}