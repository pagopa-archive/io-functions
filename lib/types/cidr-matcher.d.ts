declare module "cidr-matcher" {
  class Matcher {
    constructor();
    constructor(classes: Array<string>);
    addNetworkClass(cidr: string): void;
    removeNetworkClass(cidr: string): void;
    contains(cidr: string): boolean;
    containsAny(addrs: Array<string>): boolean;
  }

  export = Matcher;
}
