declare module 'whois' {
  interface WhoisOptions {
    server?: string;
    port?: number;
    timeout?: number;
    follow?: number;
  }

  function lookup(domain: string, callback: (err: Error | null, data: string) => void): void;
  function lookup(domain: string, options: WhoisOptions, callback: (err: Error | null, data: string) => void): void;

  export default {
    lookup
  };
} 