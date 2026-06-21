const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

function fetchUrl(targetUrl, headers, callback, redirectCount = 0) {
  if (redirectCount > 5) return callback(new Error('Too many redirects'));
  let parsed;
  try { parsed = new URL(targetUrl); } catch(e) { return callback(new Error('Invalid URL: ' + targetUrl)); }
  const mod = parsed.protocol === 'https:' ? https : http;

  const opts = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      ...(headers['range'] ? { 'Range': headers['range'] } : {}),
    },
    timeout: 15000,
  };

  const req = mod.request(opts, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      const next = res.headers.location.startsWith('http')
        ? res.headers.location
        : new URL(res.headers.location, targetUrl).href;
      return fetchUrl(next, headers, callback, redirectCount + 1);
    }
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => callback(null, Buffer.concat(chunks), res.headers, res.statusCode));
  });
  req.on('error', callback);
  req.on('timeout', () => { req.destroy(); callback(new Error('Request timed out')); });
  req.end();
}

function rewriteM3U8(text, targetUrl) {
  const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
  return text.split('\n').map(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const absUrl = /^https?:\/\//i.test(t) ? t : (t.startsWith('/') ? new URL(t, targetUrl).href : base + t);
    return `http://localhost:${PORT}/proxy?url=${encodeURIComponent(absUrl)}`;
  }).join('\n');
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve player.html
  if (parsed.pathname === '/' || parsed.pathname === '/player.html') {
    const file = path.join(__dirname, 'player.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('player.html not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Proxy endpoint
  if (parsed.pathname === '/proxy') {
    const targetUrl = parsed.query.url;
    if (!targetUrl) { res.writeHead(400); res.end('Missing ?url='); return; }

    fetchUrl(targetUrl, req.headers, (err, data, upstreamHeaders, status) => {
      if (err) {
        console.error('[proxy error]', targetUrl, err.message);
        res.writeHead(502); res.end('Proxy error: ' + err.message); return;
      }

      const ct = (upstreamHeaders['content-type'] || '').toLowerCase();
      const isM3U8 = /mpegurl|m3u8/.test(ct) || /\.m3u8(\?|$)/i.test(targetUrl);
      const isM3U  = !isM3U8 && (/\.m3u(\?|$)/i.test(targetUrl) || ct.includes('x-mpegurl') || ct.includes('audio/mpegurl'));

      if (isM3U8) {
        const text = rewriteM3U8(data.toString('utf8'), targetUrl);
        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*' });
        res.end(text);
        return;
      }

      const outCt = isM3U ? 'audio/x-mpegurl' : (ct || 'application/octet-stream');
      const safeHeaders = { 'Content-Type': outCt, 'Access-Control-Allow-Origin': '*' };
      if (upstreamHeaders['content-length']) safeHeaders['Content-Length'] = upstreamHeaders['content-length'];
      res.writeHead(status || 200, safeHeaders);
      res.end(data);
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  TV Player is running!');
  console.log(`  Open: http://localhost:${PORT}`);
  console.log('');
  console.log('  Press Ctrl+C to stop.');
});
