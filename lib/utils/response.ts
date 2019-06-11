import * as DocumentDb from "documentdb";
import * as express from "express";
import { isLeft } from "fp-ts/lib/Either";
import {
  IResultIterator,
  iteratorToArray
} from "io-functions-commons/dist/src/utils/documentdb";
import {
  HttpStatusCodeEnum,
  IResponse,
  ResponseErrorGeneric
} from "italia-ts-commons/lib/responses";

/**
 * Interface for a successful response returning a json object.
 */
export interface IResponseSuccessJsonIterator<T>
  extends IResponse<"IResponseSuccessJsonIterator"> {
  readonly value: T; // needed to discriminate from other T subtypes
  readonly apply: (
    response: express.Response
  ) => Promise<void | IResponseErrorQuery | express.Response>;
}

/**
 * A response that consumes and return the DocumentDb iterator as a json array
 * or an error in case of any failure occurs querying the database.
 *
 * @TODO: pagination
 */
export function ResponseJsonIterator<T>(
  i: IResultIterator<T>
): IResponseSuccessJsonIterator<T> {
  return {
    apply: res =>
      iteratorToArray(i).then(errorOrDocuments => {
        if (isLeft(errorOrDocuments)) {
          const queryError = errorOrDocuments.value;
          return ResponseErrorQuery(queryError.body, queryError).apply(res);
        }
        const documents = errorOrDocuments.value;
        const kindlessDocuments = documents.map(d =>
          Object.assign(Object.assign({}, d), { kind: undefined })
        );
        return res.status(200).json({
          items: kindlessDocuments,
          page_size: kindlessDocuments.length
        });
      }),
    kind: "IResponseSuccessJsonIterator",
    value: {} as T
  };
}

/**
 * Interface for a response describing a database error.
 */
export interface IResponseErrorQuery extends IResponse<"IResponseErrorQuery"> {}

/**
 * Returns a response describing a database error.
 *
 * @param detail The error message
 * @param error  The QueryError object
 */
export function ResponseErrorQuery(
  detail: string,
  error: DocumentDb.QueryError
): IResponseErrorQuery {
  return {
    ...ResponseErrorGeneric(
      HttpStatusCodeEnum.HTTP_STATUS_500,
      `Query error (${error.code})`,
      detail
    ),
    kind: "IResponseErrorQuery"
  };
}
