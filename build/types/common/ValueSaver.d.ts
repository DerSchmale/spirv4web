export declare class ValueSaver<T> {
    private targetObject;
    private propName;
    private saved;
    constructor(targetObject: any, propName: string);
    get current(): T;
    set current(value: T);
    release(): void;
}
