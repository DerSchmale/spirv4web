import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { StorageClass } from "../spirv";
import { SPIRVFunctionParameter } from "./SPIRFunction";
export declare class SPIRVariable extends IVariant {
    static type: Types;
    basetype: TypeID;
    storage: StorageClass;
    decoration: number;
    initializer: ID;
    basevariable: VariableID;
    dereference_chain: number;
    compat_builtin: boolean;
    statically_assigned: boolean;
    static_expression: ID;
    dependees: ID[];
    forwardable: boolean;
    deferred_declaration: boolean;
    phi_variable: boolean;
    allocate_temporary_copy: boolean;
    remapped_variable: boolean;
    remapped_components: number;
    dominator: BlockID;
    loop_variable: boolean;
    loop_variable_enable: boolean;
    parameter: SPIRVFunctionParameter;
    constructor(other: SPIRVariable);
    constructor(basetype: TypeID);
}
