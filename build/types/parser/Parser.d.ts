import { ParsedIR } from "./ParsedIR";
import { SPIRType } from "../common/SPIRType";
import { IVariant, IVariantType } from "../common/IVariant";
export declare class Parser {
    private ir;
    private current_function;
    private current_block;
    private global_struct_cache;
    private forward_pointer_fixups;
    constructor(spirv: Uint32Array);
    get_parsed_ir(): ParsedIR;
    parse(): void;
    private parseInstruction;
    private stream;
    private set;
    get<T extends IVariant>(classRef: IVariantType<T>, id: number): T;
    maybe_get<T extends IVariant>(classRef: IVariantType<T>, id: number): T;
    types_are_logically_equivalent(a: SPIRType, b: SPIRType): boolean;
}
