import * as DocumentDb from "documentdb";
import {
  HttpStatusCodeEnum,
  IResponse,
  ResponseErrorGeneric
} from "italia-ts-commons/lib/responses";
import { IResultIterator, iteratorToArray } from "./documentdb";

/**
 * Interface for a successful response returning a json object.
 */
export interface IResponseSuccessJsonIterator<T>
  extends IResponse<"IResponseSuccessJsonIterator"> {
  readonly value: T; // needed to discriminate from other T subtypes
}

/**
 * A successful response that consumes and return the documentdb iterator as a json array
 * @TODO: pagination
 */
export function ResponseSuccessJsonIterator<T>(
  i: IResultIterator<T>
): IResponseSuccessJsonIterator<T> {
  return {
    apply: res =>
      iteratorToArray(i).then(documents => {
        const kindlessDocuments = documents.map(d =>
          Object.assign(Object.assign({}, d), { kind: undefined })
        );
        res.status(200).json({
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
