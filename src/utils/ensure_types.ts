const _uint32 = new Uint32Array(1);

// bit operators assume signed values, so ~0 = -1, but if uint, it would be 0xffffffff
export function uint32(value: number): number
{
    _uint32[0] = value;
    return _uint32[0];
}