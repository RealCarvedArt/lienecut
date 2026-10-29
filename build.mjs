// Bundle src/app.js (+ vendored tracer) into a single self-contained dist/index.html.
//   node build.mjs           build once
//   node build.mjs --serve   serve on http://localhost:5174, rebuilding on every page load
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createLocalServer } from './server.mjs';

// The tracer's PNG codec imports node:zlib; the browser decodes images itself and never calls it.
const stubZlib = {
  name: 'stub-zlib',
  setup(b) {
    b.onResolve({ filter: /^node:zlib$/ }, () => ({ path: 'zlib', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'const no = () => { throw new Error("zlib is not available in the browser"); }; export const inflateSync = no, deflateSync = no;',
    }));
  },
};

export async function build() {
  const r = await esbuild.build({
    entryPoints: ['src/app.js'],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    minify: true,
    legalComments: 'inline',
    banner: { js: '/*! LieneCut. Includes honeymaro/pixcut tracer, MIT (c) its authors; protocol per popcornhax/PixCut-App, MIT. */' },
    write: false,
    plugins: [stubZlib],
  });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const script = `\n${js}`;
  const hash = createHash('sha256').update(script).digest('base64');
  const policy = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`;
  const html = readFileSync('index.html', 'utf8').replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`).replace('<!--APP-->', () => `<script>${script}</script>`);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  return html;
}

if (process.argv.includes('--serve')) {
  createLocalServer(build).listen(5174, '127.0.0.1', () => console.log('LieneCut on http://127.0.0.1:5174'));
} else {
  const html = await build();
  console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KiB`);
}
