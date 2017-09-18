// tslint:disable:no-any
import { isNewMessage } from "../NewMessage";

describe("NewMessage", () => {
  it("should validate valid payloads", () => {
    const payloads: ReadonlyArray<any> = [
      {
        content: {
          body_short: "Hello, world! This works! 12"
        },
        default_addresses: {
          email: "federico@teamdigitale.governo.it"
        }
      }
    ];
    payloads.forEach(payload => {
      expect(isNewMessage(payload)).toBeTruthy();
    });
  });
});
