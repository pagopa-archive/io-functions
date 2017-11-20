// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name
// tslint:disable:no-any

import { isMessageSubject, MessageSubject } from "./MessageSubject";
import {
  isMessageBodyMarkdown,
  MessageBodyMarkdown
} from "./MessageBodyMarkdown";

/**
 * 
 */

import { fromNullable, Option } from "fp-ts/lib/Option";

export interface MessageContent {
  readonly subject?: MessageSubject;

  readonly markdown: MessageBodyMarkdown;
}

export function isMessageContent(arg: any): arg is MessageContent {
  return (
    arg &&
    (arg.subject === undefined ||
      arg.subject === null ||
      isMessageSubject(arg.subject)) &&
    isMessageBodyMarkdown(arg.markdown) &&
    true
  );
}

export function toMessageContent(arg: any): Option<MessageContent> {
  return fromNullable(arg).filter(isMessageContent);
}
