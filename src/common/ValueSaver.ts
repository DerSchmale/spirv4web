export class ValueSaver<T>
{
    private targetObject: any;
    private propName: string;
    private saved: T;

    constructor(targetObject: any, propName: string)
    {
        this.saved = targetObject[propName];
        this.targetObject = targetObject;
        this.propName = propName;
    }

    get current(): T
    {
        return this.targetObject[this.propName];
    }

    set current(value: T)
    {
        this.targetObject[this.propName] = value;
    }

    release()
    {
        this.targetObject[this.propName] = this.saved;
    }
}