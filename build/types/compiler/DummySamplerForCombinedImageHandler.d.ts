import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { OpcodeHandler } from "./OpcodeHandler";
export declare class DummySamplerForCombinedImageHandler extends OpcodeHandler {
    compiler: Compiler;
    need_dummy_sampler: boolean;
    constructor(compiler: Compiler);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
}
