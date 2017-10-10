import {
  isPaginationResponse,
  PaginationResponse,
  toPaginationResponse
} from "../PaginationResponse";

describe("PaginationResponse#toPaginationResponse", () => {
  test("should returns a defined option for valid pagination response", () => {
    const paginationResponseOne: PaginationResponse = {
      next: "next",
      page_size: 2
    };
    expect(toPaginationResponse(paginationResponseOne).get).toEqual(
      paginationResponseOne
    );
  });
  test("should returns an empty option for invalid pagination response", () => {
    const paginationResponseTwo = {
      next: 1,
      page_size: 2
    };
    expect(toPaginationResponse(paginationResponseTwo)).toEqual({});
  });
});

describe("PaginationResponse#isPaginationResponse", () => {
  test("should returns true if PaginationResponse is well formed", () => {
    const paginationResponseOne: PaginationResponse = {
      next: "next",
      page_size: 2
    };
    expect(isPaginationResponse(paginationResponseOne)).toBe(true);
  });

  test("should returns true if PaginationResponse object does not have next property", () => {
    const paginationResponseTwo = {
      page_size: 2
    };
    expect(isPaginationResponse(paginationResponseTwo)).toBe(true);
  });
  test("should returns true if PaginationResponse object does have next property set to null", () => {
    /* tslint:disable */
    const paginationResponseThree = {
      next: null,
      page_size: 2
    };
    /* tslint:enable */
    expect(isPaginationResponse(paginationResponseThree)).toBe(true);
  });
  test("should returns false if PaginationResponse object does have next property malformed", () => {
    const paginationResponseOne = {
      next: 1,
      page_size: 2
    };
    expect(isPaginationResponse(paginationResponseOne)).toBe(false);
  });

  test("should returns true if PaginationResponse object does not have page_size property", () => {
    const paginationResponseTwo = {
      next: "next"
    };
    expect(isPaginationResponse(paginationResponseTwo)).toBe(true);
  });
  test("should returns true if PaginationResponse object does have page_size property set to null", () => {
    /* tslint:disable */
    const paginationResponseThree = {
      next: "next",
      page_size: null
    };
    /* tslint:enable */
    expect(isPaginationResponse(paginationResponseThree)).toBe(true);
  });
  test("should returns false if PaginationResponse object does have page_size property malformed", () => {
    const paginationResponseOne = {
      next: "next",
      page_size: "2"
    };

    expect(isPaginationResponse(paginationResponseOne)).toBe(false);
  });
});
