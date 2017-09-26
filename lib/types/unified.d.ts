declare module "unified" {
  import * as vfile from "vfile";

  interface IProcessor {
    use(arg: any): IProcessor;

    process(doc: string): Promise<vfile.VFile<{}>>;
  }

  function unified(): IProcessor;

  export = unified;
}
