export declare type FromConstructor<T> = {
    from(...params: any[]): T;
};
export declare type DefaultConstructor<T> = {
    new (): T;
};
export declare type AnyConstructor<T> = {
    new (...args: any[]): T;
};
