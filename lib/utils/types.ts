/**
 * Returns a new type that has only the F fields of type T.
 */
export type LimitedFields<T, F extends keyof T> = { [P in F]: T[P] };
