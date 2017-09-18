// tslint:disable:ordered-imports
// tslint:disable:no-consecutive-blank-lines
// tslint:disable:no-trailing-whitespace
// tslint:disable:max-line-length
// tslint:disable:jsdoc-format
// tslint:disable:interface-name



/**
 * 
 */

  
import { isEmailString, toEmailString, EmailString } from "../../utils/strings";

export type EmailAddress = EmailString;

export const isEmailAddress = isEmailString;

export const toEmailAddress = toEmailString;
  

