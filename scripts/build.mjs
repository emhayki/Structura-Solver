import { build } from 'vite';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

process.chdir(root);

await build({
  configFile: join(root, 'vite.config.ts')
});

const html = await readFile(
  join(root, 'index.html'),
  'utf8'
);

await writeFile(
  join(root, 'dist/index.html'),
  html
);

await writeFile(
  join(root, 'dist/.nojekyll'),
  ''
);

await mkdir(
  join(root, 'assets'),
  { recursive: true }
);

await cp(
  join(root, 'dist/assets'),
  join(root, 'assets'),
  { recursive: true }
);

await cp(
  join(root, 'public/favicon.svg'),
  join(root, 'favicon.svg')
);

await cp(
  join(root, 'THIRD_PARTY_NOTICES.md'),
  join(root, 'dist/THIRD_PARTY_NOTICES.md')
);

await cp(
  join(root, 'licenses'),
  join(root, 'dist/licenses'),
  { recursive: true }
);

console.log(
  'Built dist/ and refreshed the ready-to-open root index.html assets.'
);