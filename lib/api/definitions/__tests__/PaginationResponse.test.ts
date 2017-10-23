import {
  isPaginationResponse,
  PaginationResponse,
  toPaginationResponse
} from "../PaginationResponse";

describe("PaginationResponse#toPaginationResponse", () => {
  it("should returns a defined option for valid pagination response", () => {
    const paginationResponseOne: PaginationResponse = {
      next: "next",
      page_size: 2
    };
    expect(toPaginationResponse(paginationResponseOne).get).toEqual(
      paginationResponseOne
    );
  });
  it("should returns an empty option for invalid pagination response", () => {
    const paginationResponseTwo = {
      next: 1,
      page_size: 2
    };
    expect(toPaginationResponse(paginationResponseTwo)).toEqual({});
  });
});

describe("PaginationResponse#isPaginationResponse", () => {
  it("should returns true if PaginationResponse is well formed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      {
        next: "next",
        page_size: 2
      },
      {
        next: undefined,
        page_size: 2
      },
      {
        next: null,
        page_size: 2
      },
      {
        next: "next",
        page_size: undefined
      },
      {
        next: "next",
        page_size: null
      }
    ];

    fixtures.forEach(f => expect(isPaginationResponse(f)).toBe(true));
  });

  it("should returns false if PaginationResponse is malformed", () => {
    /* tslint:disable:no-null-keyword */
    /* tslint:disable:no-any */
    const fixtures: ReadonlyArray<any> = [
      null,
      {
        next: 1,
        page_size: 2
      },
      {
        next: "next",
        page_size: "2"
      }
    ];
    fixtures.forEach(f => expect(isPaginationResponse(f)).toBeFalsy());
  });
});
