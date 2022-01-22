export class VisitOrder
{
    v: number = -1;

    get(): number
    {
        return this.v;
    }

    set(value: number)
    {
        this.v = value;
    }
}