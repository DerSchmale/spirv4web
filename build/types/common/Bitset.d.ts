export declare class Bitset {
    private lower;
    private higher;
    constructor(lower?: number);
    get(bit: number): boolean;
    set(bit: number): void;
    clear(bit: number): void;
    get_lower(): number;
    reset(): void;
    merge_and(other: Bitset): void;
    merge_or(other: Bitset): void;
    equals(other: Bitset): boolean;
    for_each_bit(op: (i: number) => void): void;
    empty(): boolean;
    clone(): Bitset;
}
