declare module 'whois-json' {
  interface WhoisOptions {
    follow?: number;
    timeout?: number;
  }

  interface WhoisResult {
    domainName?: string;
    registrar?: string;
    creationDate?: string;
    expirationDate?: string;
    nameServer?: string[];
    status?: string;
    whoisServer?: string;
    [key: string]: any;
  }

  function whois(domain: string, options?: WhoisOptions): Promise<WhoisResult>;
  
  export = whois;
} 