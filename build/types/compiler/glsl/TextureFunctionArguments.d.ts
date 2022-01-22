import { SPIRType } from "../../common/SPIRType";
export declare class TextureFunctionBaseArguments {
    img: VariableID;
    imgtype: SPIRType;
    is_fetch: boolean;
    is_gather: boolean;
    is_proj: boolean;
}
export declare class TextureFunctionNameArguments {
    base: TextureFunctionBaseArguments;
    has_array_offsets: boolean;
    has_offset: boolean;
    has_grad: boolean;
    has_dref: boolean;
    is_sparse_feedback: boolean;
    has_min_lod: boolean;
    lod: number;
}
export declare class TextureFunctionArguments {
    base: TextureFunctionBaseArguments;
    coord: number;
    coord_components: number;
    dref: number;
    grad_x: number;
    grad_y: number;
    lod: number;
    coffset: number;
    offset: number;
    bias: number;
    component: number;
    sample: number;
    sparse_texel: number;
    min_lod: number;
    nonuniform_expression: boolean;
}
