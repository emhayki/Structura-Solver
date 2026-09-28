import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));

for (const folder of ['', 'dist']) {
  const directory = join(root, folder);
  const html = await readFile(join(directory, 'index.html'), 'utf8');

  assert.ok(html.includes('id="root"'));

  assert.ok(
    !html.includes('type="module"'),
    'Ready-to-open build must use a classic script.'
  );

  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(
      match[1].startsWith('./'),
      'Use relative, local asset paths.'
    );

    await access(join(directory, match[1]));
  }

  const js = await readFile(
    join(directory, 'assets/structura.js'),
    'utf8'
  );

  const css = await readFile(
    join(directory, 'assets/structura.css'),
    'utf8'
  );

  new vm.Script(js, {
    filename: 'structura.js'
  });

  assert.ok(
    !/\bimport\s*\(/.test(js),
    'Offline build must not dynamically import chunks.'
  );

  assert.ok(
    !/\bprocess\.env\b/.test(js),
    'Browser bundle must not require process.env.'
  );

  assert.ok(
    !/@import\s/.test(css),
    'Stylesheets must be fully bundled.'
  );

  assert.ok(
    !/url\(\s*['"]?https?:/i.test(css),
    'Stylesheets must not load external assets.'
  );

  for (const classname of [
    '.app-header',
    '.drawing-area',
    '.model-panel',
    '.results-surface'
  ]) {
    assert.ok(
      css.includes(classname),
      `Missing design style ${classname}`
    );
  }

  console.log(
    `PASS: ${folder || 'root'}/index.html, local assets, bundled styles, and JavaScript syntax verified.`
  );
}