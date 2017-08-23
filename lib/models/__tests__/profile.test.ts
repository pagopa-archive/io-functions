import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { FiscalCode } from "../../utils/fiscalcode";

import { ProfileModel } from "../profile";

describe("findOneProfileByFiscalCode", () => {

  const collectionUrl = {} as DocumentDbUtils.DocumentDbCollectionUrl;
  const fiscalCode = "fc" as FiscalCode;

  it("should resolve a promise to an existing profile", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(null, [ "result" ], null)),
    };

    const clientMock = {
        queryDocuments: jest.fn((__, ___) => iteratorMock),
    };

    const model = new ProfileModel((clientMock as any) as DocumentDb.DocumentClient, collectionUrl);

    const promise = model.findOneProfileByFiscalCode(fiscalCode);

    return expect(promise).resolves.toEqual("result");
  });

  it("should resolve a promise to null if no profile is found", () => {
    const iteratorMock = {
      executeNext: jest.fn((cb) => cb(null, [ ], null)),
    };

    const clientMock = {
        queryDocuments: jest.fn((__, ___) => iteratorMock),
    };

    const model = new ProfileModel((clientMock as any) as DocumentDb.DocumentClient, collectionUrl);

    const promise = model.findOneProfileByFiscalCode(fiscalCode);

    return expect(promise).resolves.toEqual(null);
  });

});
