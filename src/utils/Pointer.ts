// this just wraps a value that we can share. Only useful for primitives.
export class Pointer<T>
{
    private value: T;

    constructor(value?: T)
    {
        this.value = value;
    }

    get(): T {
        return this.value;
    }

    set(value: T) {
        this.value = value;
    }
}

// this allows us to alias an object property. Only useful for primitives.
export class MemberPointer<A, B>
{
    private owner: A;
    private propName: any;

    constructor(owner: A, propName: string)
    {
        this.owner = owner;
        this.propName = propName;
    }

    get(): B
    {
        return this.owner[this.propName];
    }

    set(value: B)
    {
        this.owner[this.propName] = value;
    }
}