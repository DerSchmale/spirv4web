import { OpcodeHandler } from "./OpcodeHandler";
import { Op } from "../spirv";
import { Compiler } from "./Compiler";
export declare class CombinedImageSamplerDrefHandler extends OpcodeHandler {
    compiler: Compiler;
    dref_combined_samplers: Set<number>;
    constructor(compiler: Compiler);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
}
