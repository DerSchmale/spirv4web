export function set_compare<T>(a: Set<T>, b: Set<T>): boolean
{
    if (a.size !== b.size) return false;
    for (let it = a.values(), val:T = null; (val = it.next().value); ) {
        if (!b.has(val))
            return false;
    }

    return true;
}