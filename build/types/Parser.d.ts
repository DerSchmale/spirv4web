import { ParsedIR } from "./ParsedIR";
export declare class Parser {
    ir: ParsedIR;
    constructor(spirv: Uint32Array);
    parse(): void;
}
