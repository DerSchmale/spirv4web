export class StringStream
{
    _str: string = "";

    str()
    {
        return this._str;
    }

    append(...args)
    {
        this._str = this._str.concat(...args);
    }

    reset()
    {
        this._str = "";
    }
}