import { OpcodeHandler } from "./OpcodeHandler";
import { Op } from "../spirv";
export declare class DebugHandler extends OpcodeHandler {
    private compiler;
    constructor(compiler: any);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
    get_name(id: number): string | number;
}
