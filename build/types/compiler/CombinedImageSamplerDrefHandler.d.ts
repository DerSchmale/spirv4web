import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv/Op";
export declare class CombinedImageSamplerDrefHandler extends OpcodeHandler {
    compiler: Compiler;
    dref_combined_samplers: Set<number>;
    constructor(compiler: Compiler);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
}
