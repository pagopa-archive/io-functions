import * as documentdb from "documentdb";

declare module "documentdb" {
  // [#153802058] _ts is a number but is defined as string.
  // TODO: get rid of this file when this pull request gets merged:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22291#issuecomment-352883251
  export interface RetrievedDocument extends NewDocument, AbstractMeta {
    _ts: any;
  }
}
