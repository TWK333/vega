// Import the installed renderer verbatim; never execute the Electron main process or read its profile.
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const archive = resolve(process.argv[2] || join(process.env.LOCALAPPDATA || '', 'Programs/Grok Bot/resources/app.asar'));
const output = resolve('local/grok_ui');
const fd = openSync(archive, 'r');
try {
  const prefix = Buffer.alloc(16);
  assert.equal(readSync(fd, prefix, 0, 16, 0), 16, 'Truncated ASAR prefix');
  const headerLength = prefix.readUInt32LE(12), dataOffset = 8 + prefix.readUInt32LE(4);
  assert(headerLength > 0 && headerLength < 16 * 1024 * 1024 && dataOffset >= 16 + headerLength, 'Invalid ASAR header');
  const headerBytes = Buffer.alloc(headerLength);
  assert.equal(readSync(fd, headerBytes, 0, headerLength, 16), headerLength, 'Truncated ASAR header');
  const header = JSON.parse(headerBytes.toString('utf8'));
  const entries = [];
  function visit(node, name = '') {
    for (const [part, value] of Object.entries(node.files || {})) {
      assert(part !== '.' && part !== '..' && !/[\\/]/.test(part), 'Unsafe archive path');
      const path = name + part;
      if (value.files) visit(value, path + '/');
      else if (path.startsWith('dist/renderer/')) {
        assert(!value.link && !value.unpacked && Number.isSafeInteger(value.size) && value.size >= 0, 'Unsupported ASAR entry');
        const offset = Number(value.offset);
        assert(Number.isSafeInteger(offset) && offset >= 0 && value.size <= 64 * 1024 * 1024, 'Invalid ASAR range');
        const data = Buffer.alloc(value.size);
        assert.equal(readSync(fd, data, 0, data.length, dataOffset + offset), data.length, 'Truncated ASAR entry');
        const sha256 = createHash('sha256').update(data).digest('hex');
        assert.equal(value.integrity?.algorithm, 'SHA256', 'Missing source integrity');
        assert.equal(sha256, value.integrity.hash, 'Source integrity mismatch: ' + path);
        const file = path.slice('dist/renderer/'.length);
        mkdirSync(dirname(join(output, file)), { recursive: true });
        writeFileSync(join(output, file), data);
        entries.push({ file, bytes: data.length, sha256 });
      }
    }
  }
  visit(header);
  const packageEntry = header.files['package.json'];
  const packageBytes = Buffer.alloc(packageEntry.size);
  readSync(fd, packageBytes, 0, packageBytes.length, dataOffset + Number(packageEntry.offset));
  const pkg = JSON.parse(packageBytes.toString());
  const index = readFileSync(join(output, 'index.html'), 'utf8');
  assert(index.includes('<head>') && index.includes('id="root"'), 'Unknown renderer entry');
  const preload = header.files.dist.files['electron-preload'].files['preload.cjs'];
  const preloadBytes = Buffer.alloc(preload.size);
  assert.equal(readSync(fd, preloadBytes, 0, preloadBytes.length, dataOffset + Number(preload.offset)), preloadBytes.length);
  assert.equal(createHash('sha256').update(preloadBytes).digest('hex'), preload.integrity.hash);
  const methods = [...new Set([...preloadBytes.toString().matchAll(/\b([A-Za-z_$][\w$]*):[A-Za-z_$][\w$]*\(\)\.(?:noArgs|args)\b/g)].map(match => match[1]))].sort();
  assert(methods.includes('getCursorAuthStatus') && methods.includes('getWindowState'), 'Unknown preload contract');
  writeFileSync(join(output, 'desktop-methods.js'), 'window.__vegaDesktopMethods = ' + JSON.stringify(methods) + ';\n');
  writeFileSync(join(output, 'index.html'), index.replace('<head>', '<head>\n    <script src="./desktop-methods.js"></script>\n    <script src="./vega-bridge.js"></script>').replace("connect-src 'self' ws: sand-media: https://grok.com", "connect-src 'self'"));
  writeFileSync(join(output, 'source-manifest.json'), JSON.stringify({ product: pkg.productName, version: pkg.version, builtAt: pkg.sandBuiltAt, source: 'resources/app.asar/dist/renderer', modification: 'index.html: load the local bridge before the original entry and restrict connect-src to self; all original assets are byte-identical', files: entries }, null, 2) + '\n');
  console.log(`Imported ${entries.length} verified Grok Bot ${pkg.version} renderer files (${entries.reduce((sum, e) => sum + e.bytes, 0)} bytes).`);
} finally { closeSync(fd); }
