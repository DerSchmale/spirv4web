import { IVariant } from "./IVariant";
import { Types } from "./Types";
export declare class SPIRCombinedImageSampler extends IVariant {
    static type: Types;
    combined_type: TypeID;
    image: VariableID;
    sampler: VariableID;
    constructor(other: SPIRCombinedImageSampler);
    constructor(type: TypeID, image: VariableID, sampler: VariableID);
}
