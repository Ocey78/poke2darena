import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)), process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.ttf':'font/ttf', '.txt':'text/plain' };
const server = createServer(async (request,response) => {
  try {
    const url = new URL(request.url,'http://localhost');
    const requested = decodeURIComponent(url.pathname);
    if (requested.split('/').some(segment => segment.startsWith('.') || segment === 'node_modules')) {
      response.writeHead(404); response.end('Not found'); return;
    }
    let path = resolve(root, '.' + requested);
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    if ((await stat(path)).isDirectory()) {
      if (!requested.endsWith('/')) { response.writeHead(302, { Location: url.pathname + '/' + url.search }); response.end(); return; }
      path = resolve(path,'index.html');
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404);
    response.end('Not found');
  }
});
server.listen(port,'127.0.0.1', () => console.log(`Local preview http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
