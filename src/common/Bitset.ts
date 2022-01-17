import { defaultClone } from "../utils/defaultCopy";

export class Bitset
{
// The most common bits to set are all lower than 64,
// so optimize for this case. Bits spilling outside 64 go into a slower data structure.
// In almost all cases, higher data structure will not be used.

    private lower: number;
    private higher: Set<number> = new Set();

    constructor(lower: number = 0)
    {
        this.lower = lower;
    }

    get(bit: number): boolean
    {
        if (bit < 32)
            return (this.lower & (1 << bit)) !== 0;
        else
            return this.higher.has(bit);
    }

    set(bit: number)
    {
        if (bit < 32)
            this.lower |= 1 << bit;
        else
            this.higher.add(bit);
    }

    clear(bit: number)
    {
        if (bit < 32)
            this.lower &= ~(1 << bit);
        else
            this.higher.delete(bit);
    }

    get_lower()
    {
        return this.lower;
    }

    reset()
    {
        this.lower = 0;
        this.higher.clear();
    }

    merge_and(other: Bitset)
    {
        this.lower &= other.lower;
        const tmp_set = new Set<number>();
        this.higher.forEach(v => {
            if (other.higher.has(v))
                tmp_set.add(v);
        });
        this.higher = tmp_set;
    }

    merge_or(other: Bitset)
    {
        this.lower |= other.lower;
        other.higher.forEach(v => this.higher.add(v));
    }

    equals(other: Bitset)
    {
        if (this.lower !== other.lower)
            return false;

        if (this.higher.size !== other.higher.size)
            return false;

        for (let it = this.higher.values(), val = null; (val = it.next().value); ) {
            if (!other.higher.has(val))
                return false;
        }

        return true;
    }

    for_each_bit(op: (i: number) => void)
    {
        // TODO: Add ctz-based iteration.
        for (let i = 0; i < 32; i++)
        {
            if (this.lower & (1 << i))
                op(i);
        }

        if (this.higher.size === 0)
            return;

        // Need to enforce an order here for reproducible results,
        // but hitting this path should happen extremely rarely, so having this slow path is fine.
        const bits = Array.from(this.higher);
        bits.sort();
        bits.forEach(op);
    }

    empty(): boolean
    {
        return this.lower === 0 && this.higher.size === 0;
    }

    clone(): Bitset
    {
        return defaultClone(Bitset, this);
    }
}