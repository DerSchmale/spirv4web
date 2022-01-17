import { defaultClone, defaultCopy } from "./defaultCopy";

export class Pair<A, B>
{
    first: A;
    second: B;

    constructor(first?: A, second?: B)
    {
        this.first = first;
        this.second = second;
    }

    equals(b: Pair<A, B>): boolean
    {
        return this.first === b.first && this.second === b.second;
    }

    clone(): Pair<A, B>
    {
        const c = new Pair<A, B>();
        defaultCopy(this, c);
        return c;
    }
}