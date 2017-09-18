declare module "codice-fiscale-italiano" {
  function CodiceFiscaleItaliano(cf: string): boolean;

  export = CodiceFiscaleItaliano;

  namespace CodiceFiscaleItaliano {
    function validateCF(cf: string): boolean;
  }
}
