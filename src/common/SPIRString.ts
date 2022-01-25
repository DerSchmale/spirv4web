import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";

export class SPIRString extends IVariant
{
    static type = Types.String;

    str: string;

    constructor(other: SPIRString);
    constructor(str: string);
    constructor(param0: string | SPIRString)
    {
        super();
        if (param0 instanceof SPIRString)
            defaultCopy(param0, this);
        else
            this.str = param0;
    }
}