import { IVariant } from "./IVariant";
import { Types } from "./Types";
export declare class SPIRVFunctionParameter {
    type: TypeID;
    id: ID;
    read_count: number;
    write_count: number;
    alias_global_variable: boolean;
    constructor(type?: TypeID, id?: ID, read_count?: number, write_count?: number, alias_global_variable?: boolean);
    clone(): SPIRVFunctionParameter;
}
export declare class SPIRFunctionCombinedImageSamplerParameter {
    id: VariableID;
    image_id: VariableID;
    sampler_id: VariableID;
    global_image: boolean;
    global_sampler: boolean;
    depth: boolean;
    clone(): SPIRFunctionCombinedImageSamplerParameter;
    constructor();
    constructor(id: VariableID, image_id: VariableID, sampler_id: VariableID, global_image: boolean, global_sampler: boolean, depth: boolean);
}
export declare class SPIRVFunctionEntryLine {
    file_id: number;
    line_literal: number;
    clone(): SPIRVFunctionEntryLine;
}
export declare class SPIRFunction extends IVariant {
    static type: Types;
    return_type: TypeID;
    function_type: TypeID;
    arguments: SPIRVFunctionParameter[];
    shadow_arguments: SPIRVFunctionParameter[];
    local_variables: VariableID[];
    entry_block: BlockID;
    blocks: BlockID[];
    combined_parameters: SPIRFunctionCombinedImageSamplerParameter[];
    entry_line: SPIRVFunctionEntryLine;
    fixup_hooks_out: (() => void)[];
    fixup_hooks_in: (() => void)[];
    constant_arrays_needed_on_stack: ID[];
    active: boolean;
    flush_undeclared: boolean;
    do_combined_parameters: boolean;
    constructor(other: SPIRFunction);
    constructor(return_type: TypeID, function_type: TypeID);
    add_local_variable(id: VariableID): void;
    add_parameter(parameter_type: TypeID, id: ID, alias_global_variable?: boolean): void;
}
