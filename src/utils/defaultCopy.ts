// a shallow copy function
import { DefaultConstructor } from "../common/ConstructorTypes";

export function defaultCopy<T>(src: T, dst: T)
{
    for (let key in src) {
        if (src.hasOwnProperty(key))
            dst[key] = _clone(src[key]);
    }
}

export function defaultClone<T>(classRef: DefaultConstructor<T>, src: T): T
{
    const c = new classRef();
    defaultCopy(src, c);
    return c;
}

function _clone(src: any): any
{
    if (Array.isArray(src)) {
        return src.map(elm => _clone(elm));
    }
    else if (src instanceof Set) {
        const set = new Set();

        src.forEach(elm => {
            set.add(_clone(elm));
        });

        return set;
    }
    else {
        const type = typeof src;
        if (type === "object") {
            // the object knows how to clone itself
            if (typeof src.clone === "function")
                return src.clone();
            else if (src instanceof Set) {
                const dst = new Set();
                src.forEach((value => dst.add(value)));
                return dst;
            }
            else if (
                src instanceof Uint8Array|| src instanceof Uint8ClampedArray || src instanceof Uint16Array || src instanceof Uint32Array ||
                src instanceof Int8Array || src instanceof Int16Array || src instanceof Int32Array ||
                src instanceof BigInt64Array || src instanceof BigUint64Array ||
                src instanceof Float32Array || src instanceof Float64Array
            ) {
                return src.slice();
            }
            else {
                throw new Error(`The object ${src} does not have a clone function.`);
            }
        }
        else if (type !== "function") {
            // it's a primitive, it can just be passed back
            return src;
        }
    }
}