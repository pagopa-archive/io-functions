// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { EmailAddress } from "./EmailAddress";

/**
 * Default addresses for notifying the recipient of the message in case no address for the related channel is set in his profile.
 */

import * as t from "io-ts";

// required attributes
const NewMessageDefaultAddressesR = t.interface({});

// optional attributes
const NewMessageDefaultAddressesO = t.partial({
  email: EmailAddress
});

export const NewMessageDefaultAddresses = t.intersection([
  NewMessageDefaultAddressesR,
  NewMessageDefaultAddressesO
]);

export type NewMessageDefaultAddresses = t.TypeOf<
  typeof NewMessageDefaultAddresses
>;
