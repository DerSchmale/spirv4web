export class Instruction
{
    op: number = 0;
    count: number = 0;
    // If offset is 0 (not a valid offset into the instruction stream),
    // we have an instruction stream which is embedded in the object.
    offset: number = 0;
    length: number = 0;

    is_embedded(): boolean
    {
        return this.offset === 0;
    }
}

export class EmbeddedInstruction extends Instruction
{
    ops: number[] = [];
}