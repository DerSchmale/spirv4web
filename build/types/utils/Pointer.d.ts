export declare class Pointer<T> {
    private value;
    constructor(value?: T);
    get(): T;
    set(value: T): void;
}
export declare class MemberPointer<A, B> {
    private owner;
    private propName;
    constructor(owner: A, propName: string);
    get(): B;
    set(value: B): void;
}
