import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ulid } from "ulid";

// a generator of identifiers
export type ObjectIdGenerator = () => NonEmptyString;

// tslint:disable-next-line:no-useless-cast
export const ulidGenerator: ObjectIdGenerator = () => ulid() as NonEmptyString;
