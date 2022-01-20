import { SPIRType } from "../../common/SPIRType";

export class TextureFunctionBaseArguments
{
    img: VariableID = 0;
    imgtype: SPIRType;
    is_fetch: boolean = false;
    is_gather: boolean = false;
    is_proj: boolean = false;
}

export class TextureFunctionNameArguments
{
    // GCC 4.8 workarounds, it doesn't understand '{}' constructor here, use explicit default constructor.
    base: TextureFunctionBaseArguments = new TextureFunctionBaseArguments();
    has_array_offsets: boolean = false;
    has_offset: boolean = false;
    has_grad: boolean = false;
    has_dref: boolean = false;
    is_sparse_feedback: boolean = false;
    has_min_lod: boolean = false;
    lod: number = 0;
}

export class TextureFunctionArguments
{
    base: TextureFunctionBaseArguments = new TextureFunctionBaseArguments();
    coord: number = 0;
    coord_components: number = 0;
    dref: number = 0;
    grad_x: number = 0;
    grad_y: number = 0;
    lod: number = 0;
    coffset: number = 0;
    offset: number = 0;
    bias: number = 0;
    component: number = 0;
    sample: number = 0;
    sparse_texel: number = 0;
    min_lod: number = 0;
    nonuniform_expression: boolean = false;
}