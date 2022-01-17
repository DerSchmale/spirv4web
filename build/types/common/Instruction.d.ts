export declare class Instruction {
    op: number;
    count: number;
    offset: number;
    length: number;
    is_embedded(): boolean;
}
export declare class EmbeddedInstruction extends Instruction {
    ops: number[];
}
