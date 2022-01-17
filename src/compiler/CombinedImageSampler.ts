export class CombinedImageSampler
{
    // The ID of the sampler2D variable.
    combined_id: VariableID;
    // The ID of the texture2D variable.
    image_id: VariableID;
    // The ID of the sampler variable.
    sampler_id: VariableID;

    constructor(combined_id: VariableID, image_id: VariableID, sampler_id: VariableID)
    {
        this.combined_id = combined_id;
        this.image_id = image_id;
        this.sampler_id = sampler_id;
    }
}