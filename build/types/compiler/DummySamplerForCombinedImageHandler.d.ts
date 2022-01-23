import { Compiler } from "./Compiler";
import { OpcodeHandler } from "./OpcodeHandler";
import { Op } from "../spirv/Op";
export declare class DummySamplerForCombinedImageHandler extends OpcodeHandler {
    compiler: Compiler;
    need_dummy_sampler: boolean;
    constructor(compiler: Compiler);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
}
