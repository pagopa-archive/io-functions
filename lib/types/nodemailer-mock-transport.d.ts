declare module "nodemailer-mock-transport" {
  import * as NodeMailer from "nodemailer";

  interface IMimeNode {
    date: Date;
    childNodes: IMimeNode[];
    content: string | Buffer;
  }

  interface ISentEmail {
    data: NodeMailer.SendMailOptions;
    message: IMimeNode;
  }

  interface IMockTransport {
    options: any;
    sentMail: ISentEmail[];
  }

  function index(): NodeMailer.Transport & IMockTransport;

  export = index;
}
