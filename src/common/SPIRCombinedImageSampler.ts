import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";

export class SPIRCombinedImageSampler extends IVariant
{
    static type = Types.TypeCombinedImageSampler;

    combined_type: TypeID;
    image: VariableID;
    sampler: VariableID;

    constructor(other: SPIRCombinedImageSampler);
    constructor(type: TypeID, image: VariableID, sampler: VariableID)
    constructor(param0: TypeID | SPIRCombinedImageSampler, image?: VariableID, sampler?: VariableID)
    {
        super();
        if (param0 instanceof SPIRCombinedImageSampler) {
            defaultCopy(this, param0);
        }
        else {
            this.combined_type = param0;
            this.image = image;
            this.sampler = sampler;
        }
    }
}