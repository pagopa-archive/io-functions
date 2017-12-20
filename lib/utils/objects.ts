/**
 * Return an object filtering out keys that point to undefined values.
 */
export const withoutUndefinedValues = <T extends object>(obj: T): T =>
  Object.keys(obj).reduce(
    (acc, k) => {
      const value = obj[k as keyof T];
      return value !== undefined
        ? {
            // see https://github.com/Microsoft/TypeScript/pull/13288
            // tslint:disable-next-line:no-any
            ...(acc as any),
            [k]:
              typeof value === "object" ? withoutUndefinedValues(value) : value
          }
        : acc;
    },
    {} as T
  ) as T;
