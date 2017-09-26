import { markdownToHtml } from "../markdown";

describe("markdownToHtml", () => {
  it("should convert markdown to HTML", async () => {
    const result = await markdownToHtml.process(`
# Hello world

How are you?
  `);

    expect(result.toString().replace(/[ \n]/g, "")).toBe(
      "<h1>Helloworld</h1><p>Howareyou?</p>"
    );
  });
});
