import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";

export class SPIRExpression extends IVariant
{
    static type = Types.TypeExpression;

    // If non-zero, prepend expression with to_expression(base_expression).
    // Used in amortizing multiple calls to to_expression()
    // where in certain cases that would quickly force a temporary when not needed.
    base_expression: ID = 0;

    expression: string = "";
    expression_type: TypeID = 0;

    // If this expression is a forwarded load,
    // allow us to reference the original variable.
    loaded_from: ID = 0;

    // If this expression will never change, we can avoid lots of temporaries
    // in high level source.
    // An expression being immutable can be speculative,
    // it is assumed that this is true almost always.
    immutable: boolean = false;

    // Before use, this expression must be transposed.
    // This is needed for targets which don't support row_major layouts.
    need_transpose: boolean = false;

    // Whether or not this is an access chain expression.
    access_chain: boolean = false;

    // A list of expressions which this expression depends on.
    expression_dependencies: ID[] = [];

    // By reading this expression, we implicitly read these expressions as well.
    // Used by access chain Store and Load since we read multiple expressions in this case.
    implied_read_expressions: ID[] = [];

    // The expression was emitted at a certain scope. Lets us track when an expression read means multiple reads.
    emitted_loop_level: number = 0;

    // Only created by the backend target to avoid creating tons of temporaries.
    constructor(other: SPIRExpression);
    constructor(expr: string, expression_type: TypeID, immutable: boolean);
    constructor(param0: string | SPIRExpression = "", expression_type?: TypeID, immutable?: boolean)
    {
        super();
        if (param0 instanceof SPIRExpression) {
            defaultCopy(this, param0);
        }
        else {
            this.expression = param0;
            this.expression_type = expression_type;
            this.immutable = immutable;
        }
    }
}