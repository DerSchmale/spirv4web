import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { StorageClass } from "../spirv";
import { SPIRFunctionParameter } from "./SPIRFunction";
import { defaultCopy } from "../utils/defaultCopy";

export class SPIRVariable extends IVariant
{
    static type = Types.TypeVariable;

    basetype: TypeID = 0;
    storage: StorageClass = StorageClass.StorageClassGeneric;
    decoration: number = 0;
    initializer: ID = 0;
    basevariable: VariableID = 0;

    dereference_chain: number;
    compat_builtin: boolean = false;

    // If a variable is shadowed, we only statically assign to it
    // and never actually emit a statement for it.
    // When we read the variable as an expression, just forward
    // shadowed_id as the expression.
    statically_assigned: boolean = false;
    static_expression: ID = 0;

    // Temporaries which can remain forwarded as long as this variable is not modified.
    dependees: ID[] = [];
    forwardable: boolean = true;

    deferred_declaration: boolean = false;
    phi_variable: boolean = false;

    // Used to deal with SPIRBlockPhi variable flushes. See flush_phi().
    allocate_temporary_copy: boolean = false;

    remapped_variable: boolean = false;
    remapped_components: number = 0;

    // The block which dominates all access to this variable.
    dominator: BlockID = 0;
    // If true, this variable is a loop variable, when accessing the variable
    // outside a loop,
    // we should statically forward it.
    loop_variable: boolean = false;
    // Set to true while we're inside the for loop.
    loop_variable_enable: boolean = false;

    parameter: SPIRFunctionParameter = null;

    constructor(other: SPIRVariable);
    constructor(basetype: TypeID);
    constructor(param0: TypeID | SPIRVariable, storage: StorageClass = 0, initializer: ID = 0, basevariable: VariableID = 0)
    {
        super();
        if (param0 instanceof SPIRVariable)
            defaultCopy(param0, this);
        else {
            this.basetype = param0;
            this.storage = storage;
            this.initializer = initializer;
            this.basevariable = basevariable;
        }
    }
}