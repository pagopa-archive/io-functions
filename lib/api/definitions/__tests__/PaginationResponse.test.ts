import {
  isPaginationResponse,
  PaginationResponse,
  toPaginationResponse
} from "../PaginationResponse";

describe("Check PaginationResponse methods", () => {
  test("toPaginationResponse", () => {
    const paginationResponseOne: PaginationResponse = {
      next: "next",
      page_size: 2
    };
    const paginationResponseTwo = {
      next: 1,
      page_size: 2
    };

    expect(toPaginationResponse(paginationResponseOne).get).toEqual(
      paginationResponseOne
    );
    expect(toPaginationResponse(paginationResponseTwo)).toEqual({});
  });

  test("isPaginationResponse", () => {
    const paginationResponseOne: PaginationResponse = {
      next: "next",
      page_size: 2
    };
    expect(isPaginationResponse(paginationResponseOne)).toBe(true);
  });

  test("isPaginationResponse, check next property", () => {
    const paginationResponseOne = {
      next: 1,
      page_size: 2
    };
    const paginationResponseTwo: PaginationResponse = {
      next: undefined,
      page_size: 2
    };
    /* tslint:disable */
    const paginationResponseThree = {
      next: null,
      page_size: 2
    };
    /* tslint:enable */
    expect(isPaginationResponse(paginationResponseOne)).toBe(false);
    expect(isPaginationResponse(paginationResponseTwo)).toBe(true);
    expect(isPaginationResponse(paginationResponseThree)).toBe(true);
  });

  test("isPaginationResponse, check page_size property", () => {
    const paginationResponseOne = {
      next: "next",
      page_size: "2"
    };
    const paginationResponseTwo: PaginationResponse = {
      next: "next",
      page_size: undefined
    };
    /* tslint:disable */
    const paginationResponseThree = {
      next: "next",
      page_size: null
    };
    /* tslint:enable */
    expect(isPaginationResponse(paginationResponseOne)).toBe(false);
    expect(isPaginationResponse(paginationResponseTwo)).toBe(true);
    expect(isPaginationResponse(paginationResponseThree)).toBe(true);
  });
});
