import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultClone, defaultCopy } from "../utils/defaultCopy";

export class SPIRFunctionParameter
{
    type: TypeID;
    id: ID;
    read_count: number;
    write_count: number;

    // Set to true if this parameter aliases a global variable,
    // used mostly in Metal where global variables
    // have to be passed down to functions as regular arguments.
    // However, for this kind of variable, we should not care about
    // read and write counts as access to the function arguments
    // is not local to the function in question.
    alias_global_variable: boolean;

    constructor(type: TypeID = 0, id: ID = 0, read_count: number = 0, write_count: number = 0, alias_global_variable: boolean = false)
    {
        this.type = type;
        this.id = id;
        this.read_count = read_count;
        this.write_count = write_count;
        this.alias_global_variable = alias_global_variable;
    }

    clone()
    {
        return defaultClone(SPIRFunctionParameter, this);
    }
}

// When calling a function, and we're remapping separate image samplers,
// resolve these arguments into combined image samplers and pass them
// as additional arguments in this order.
// It gets more complicated as functions can pull in their own globals
// and combine them with parameters,
// so we need to distinguish if something is local parameter index
// or a global ID.
export class SPIRFunctionCombinedImageSamplerParameter
{
    id: VariableID;
    image_id: VariableID;
    sampler_id: VariableID;
    global_image: boolean;
    global_sampler: boolean;
    depth: boolean;

    clone()
    {
        return defaultClone(SPIRFunctionCombinedImageSamplerParameter, this);
    }

    constructor();
    constructor(id: VariableID,
                image_id: VariableID,
                sampler_id: VariableID,
                global_image: boolean,
                global_sampler: boolean,
                depth: boolean);

    constructor(id: VariableID = 0,
                image_id: VariableID = 0,
                sampler_id: VariableID = 0,
                global_image: boolean = false,
                global_sampler: boolean = false,
                depth: boolean = false)
    {
        this.id = id;
        this.image_id = image_id;
        this.sampler_id = sampler_id;
        this.global_image = global_image;
        this.global_sampler = global_sampler;
        this.depth = depth;
    }
}

export class SPIRVFunctionEntryLine
{
    file_id: number = 0;
    line_literal: number = 0;

    clone()
    {
        return defaultClone(SPIRVFunctionEntryLine, this);
    }
}

export class SPIRFunction extends IVariant
{
    static type = Types.Function;

    return_type: TypeID;
    function_type: TypeID;
    arguments: SPIRFunctionParameter[] = [];

    // Can be used by backends to add magic arguments.
    // Currently used by combined image/sampler implementation.

    shadow_arguments: SPIRFunctionParameter[] = [];
    local_variables: VariableID[] = [];
    entry_block: BlockID = 0;
    blocks: BlockID[] = [];
    combined_parameters: SPIRFunctionCombinedImageSamplerParameter[] = [];

    entry_line: SPIRVFunctionEntryLine = new SPIRVFunctionEntryLine();

    // Hooks to be run when the function returns.
    // Mostly used for lowering internal data structures onto flattened structures.
    // Need to defer this, because they might rely on things which change during compilation.
    // Intentionally not a small vector, this one is rare, and std::function can be large.
    fixup_hooks_out: (() => void)[] = [];

    // Hooks to be run when the function begins.
    // Mostly used for populating internal data structures from flattened structures.
    // Need to defer this, because they might rely on things which change during compilation.
    // Intentionally not a small vector, this one is rare, and std::function can be large.
    fixup_hooks_in: (() => void)[] = [];

    // On function entry, make sure to copy a constant array into thread addr space to work around
    // the case where we are passing a constant array by value to a function on backends which do not
    // consider arrays value types.
    constant_arrays_needed_on_stack: ID[] = [];

    active: boolean = false;
    flush_undeclared: boolean = true;
    do_combined_parameters: boolean = true;

    constructor(other: SPIRFunction);
    constructor(return_type: TypeID, function_type: TypeID);
    constructor(param0: TypeID | SPIRFunction, function_type?: TypeID)
    {
        super();
        if (param0 instanceof SPIRFunction)
            defaultCopy(param0, this);
        else {
            this.return_type = param0;
            this.function_type = function_type;
        }
    }

    add_local_variable(id: VariableID)
    {
        this.local_variables.push(id);
    }

    add_parameter(parameter_type: TypeID, id: ID, alias_global_variable: boolean = false)
    {
        // Arguments are read-only until proven otherwise.
        this.arguments.push(new SPIRFunctionParameter(parameter_type, id, 0, 0, alias_global_variable));
    }
}