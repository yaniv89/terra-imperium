// scripts/worldgen/run.mjs
// Runs a module function of the game in Node through Vite's SSR loader (extensionless imports):
//   node scripts/worldgen/run.mjs <module path from the repo root> <export name> [json args]
// The export is called with the parsed args and its result printed as JSON. A small helper for
// the world generator scripts and quick checks.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [, , mod, name, args] = process.argv;
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const m = await server.ssrLoadModule(mod.startsWith('/') ? mod : `/${mod}`);
  const out = await m[name](...(args ? JSON.parse(args) : []));
  console.log(JSON.stringify(out, null, 1));
} finally {
  await server.close();
}
