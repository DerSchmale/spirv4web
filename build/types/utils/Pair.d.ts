export declare class Pair<A, B> {
    first: A;
    second: B;
    constructor(first?: A, second?: B);
    equals(b: Pair<A, B>): boolean;
    clone(): Pair<A, B>;
}
