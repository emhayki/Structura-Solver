import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = await realpath(resolve(project, process.argv[2] || '.'));
const port = Number(process.argv[3] || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Use a port between 1 and 65535.');
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  try {
    let pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const requested = resolve(root, '.' + pathname);
    if (!requested.startsWith(root + sep)) throw new Error('Outside static root');

    const file = await realpath(requested);
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) {
      throw new Error('Not a static file');
    }

    const data = await readFile(file);

    response.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });

    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('File not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Structura: http://localhost:${port}/\nServing ${root}\nPress Ctrl+C to stop.`);
});