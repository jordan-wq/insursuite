declare module "cloudflare:workers" {
  export const env: {
    DB?: unknown;
    BUCKET?: {
      put: (key: string, value: ReadableStream, options?: unknown) => Promise<unknown>;
      get: (key: string) => Promise<{ body?: BodyInit | null } | null>;
    };
    AGENT_EMAILS?: string;
  };
}
