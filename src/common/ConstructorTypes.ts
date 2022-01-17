// this is a stand-in for copy-constructors etc
export type FromConstructor<T> = { from(...params): T }
export type DefaultConstructor<T> = { new(): T }
export type AnyConstructor<T> = { new(...args): T }