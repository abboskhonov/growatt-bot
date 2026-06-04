// Stub for bun:sqlite — used when bundling for Cloudflare Workers
export class Database {
  constructor() { throw new Error('bun:sqlite not available in this environment') }
  query() { throw new Error('Not implemented') }
  exec() { throw new Error('Not implemented') }
}
