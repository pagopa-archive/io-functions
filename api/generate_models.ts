// tslint:disable:no-console

import * as fs from "fs-extra";
import * as nunjucks from "nunjucks";
import * as SwaggerParser from "swagger-parser";
import { Spec } from "swagger-schema-official";

async function generateModelsFromApi(e: nunjucks.Environment, specs: string, root: string): Promise<void> {
  const api: Spec = await SwaggerParser.parse(specs);
  const definitions = api.definitions;
  if (!definitions) {
    console.log("No definitions found");
    return;
  }
  for (const definitionName in definitions) {
    if (definitions.hasOwnProperty(definitionName)) {
      const definition = definitions[definitionName];
      console.log("-------", definitionName);
      console.log(definition);
      const res = e.render("model.ts.njk", {
        definition,
        definitionName,
      });
      // TODO: autofix lint errors with tslint
      await fs.writeFile(`${root}/definitions/${definitionName}.ts`, res);
    }
  }
}

nunjucks.configure({
  trimBlocks: true,
});

const env = new nunjucks.Environment(new nunjucks.FileSystemLoader("api/templates"));
env.addFilter("contains", <T>(a: ReadonlyArray<T>, item: T) => {
  return a.indexOf(item) !== -1;
});

generateModelsFromApi(env, "api/messages.yaml", "lib/api").then(
  () => console.log("done"),
  (err) => console.log(`Error: ${err}`),
);
