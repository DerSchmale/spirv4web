export class Hasher
{
    private h: bigint = BigInt(0xcbf29ce484222325);

    u32(value: number)
    {
        this.h = (this.h * BigInt(0x100000001b3)) ^ BigInt(value);
    }

    get(): bigint
    {
        return this.h;
    }

}