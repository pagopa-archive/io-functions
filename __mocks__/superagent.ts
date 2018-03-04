/**
 * Implements a superagent mock to use inside jest tests.
 * Avoids real calls to some HTTP backend.
 *
 * https://github.com/visionmedia/superagent
 *
 */
// tslint:disable
let __response = {};
let __requestSpy = (_: any) => ({});
let __responseSpy = (_: any) => ({});

const request = jest.fn().mockReturnValue({
  get: jest.fn(function(req: any) {
    __requestSpy(req);
    return request;
  }),
  post: jest.fn(function(req: any) {
    __requestSpy(req);
    return request;
  }),
  send: jest.fn().mockImplementation((req: any) => {
    __requestSpy(req);
    __responseSpy((__response as any).body);
    return Promise.resolve(__response);
  }),
  timeout: jest.fn().mockReturnThis(),
  __setResponse: (response: any) => {
    __response = response;
  },
  __setRequestSpy: (requestSpy: any) => {
    __requestSpy = requestSpy;
  },
  __setResponseSpy: (responseSpy: any) => {
    __responseSpy = responseSpy;
  },
  __resetMocks: () => {
    __requestSpy = (_: any) => ({});
    __responseSpy = (_: any) => ({});
    __response = {};
  }
});

export = request;
