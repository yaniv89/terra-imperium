// Resolve the pure engine graph within the checkout, without inspecting unrelated parent folders.
import fs from 'node:fs';
import path from 'node:path';
export const engineSources = root => ({
  name: 'engine-sources',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      if (!args.path.startsWith('.') && !path.isAbsolute(args.path)) throw new Error(`Unexpected engine dependency: ${args.path}`);
      const candidate = path.resolve(args.importer && args.importer !== '<stdin>' ? path.dirname(args.importer) : (args.resolveDir || root), args.path);
      const resolved = [candidate, `${candidate}.js`, `${candidate}.json`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!resolved || !resolved.startsWith(root + path.sep)) throw new Error(`Engine source outside checkout: ${args.path}`);
      return { path: resolved, namespace: 'engine' };
    });
    build.onLoad({ filter: /.*/, namespace: 'engine' }, args => ({ contents: fs.readFileSync(args.path, 'utf8'), loader: args.path.endsWith('.json') ? 'json' : 'js' }));
  }
});
