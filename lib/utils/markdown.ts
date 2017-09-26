import * as html from "rehype-stringify";
import * as markdown from "remark-parse";
import * as remark2rehype from "remark-rehype";
import unified = require("unified");

/**
 * A Unified pipeline thar uses remark and rehype to parse a Markdown file and
 * convert it to HTML.
 */
export const markdownToHtml = unified()
  .use(markdown)
  .use(remark2rehype)
  .use(html);
