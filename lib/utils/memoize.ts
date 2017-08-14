
export function memoize<T>(f: () => T): () => T {
  let t: T | null = null;
  return (() => {
    if (t == null) {
      t = f();
    }
    return t;
  });
}
