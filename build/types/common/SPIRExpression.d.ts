import { IVariant } from "./IVariant";
import { Types } from "./Types";
export declare class SPIRExpression extends IVariant {
    static type: Types;
    base_expression: ID;
    expression: string;
    expression_type: TypeID;
    loaded_from: ID;
    immutable: boolean;
    need_transpose: boolean;
    access_chain: boolean;
    expression_dependencies: ID[];
    implied_read_expressions: ID[];
    emitted_loop_level: number;
    constructor(other: SPIRExpression);
    constructor(expr: string, expression_type: TypeID, immutable: boolean);
}
