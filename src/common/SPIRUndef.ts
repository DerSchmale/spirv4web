import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";

export class SPIRUndef extends IVariant
{
    static type = Types.TypeUndef;

    basetype: TypeID;

    constructor(other: SPIRUndef);
    constructor(basetype: TypeID);
    constructor(param0: TypeID | SPIRUndef)
    {
        super();
        if (param0 instanceof SPIRUndef)
            defaultCopy(this, param0);
        else
            this.basetype = param0;
    }
}