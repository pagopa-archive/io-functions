// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any
// tslint:disable:object-literal-sort-keys

import { TimeToLive } from "./TimeToLive";
import { MessageContent } from "./MessageContent";
import { NewMessageDefaultAddresses } from "./NewMessageDefaultAddresses";

/**
 * 
 */

import * as t from "io-ts";

// required attributes
const NewMessageR = t.interface({
  content: MessageContent
});

// optional attributes
const NewMessageO = t.partial({
  time_to_live: TimeToLive,

  default_addresses: NewMessageDefaultAddresses
});

export const NewMessage = t.intersection([NewMessageR, NewMessageO]);

export type NewMessage = t.TypeOf<typeof NewMessage>;
