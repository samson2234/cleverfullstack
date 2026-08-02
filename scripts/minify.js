const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const terser = require('terser');
const { minify: minifyHtml } = require('html-minifier-terser');

const root = process.argv[2] ? path.resolve(process.argv[2]) : (__dirname + '/..');

function walk(dir, ext, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'scripts' || e.name === 'vendor') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
}

function report(file, before, after) {
  const kb1 = (before / 1024).toFixed(1);
  const kb2 = (after / 1024).toFixed(1);
  console.log(`  ${path.relative(root, file).padEnd(46)} ${kb1.padStart(7)}KB -> ${kb2.padStart(7)}KB  (${(100 * (1 - after / before)).toFixed(1)}% smaller)`);
}

async function run() {
  const cssFiles = [];
  const jsFiles = [];
  const htmlFiles = [];
  walk(root, '.css', cssFiles);
  walk(root, '.js', jsFiles);
  walk(root, '.html', htmlFiles);

  const skip = (f) => {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (rel === 'analytics.js') return true;         // placeholder config — dead-code eliminated to empty
    if (rel.startsWith('api/') || rel.startsWith('lib/')) return true; // Vercel serverless functions
    if (rel.startsWith('vendor/')) return true;
    return false;
  };

  console.log('Minifying CSS:');
  for (const f of cssFiles) {
    if (skip(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const out = new CleanCSS({ level: 2 }).minify(src);
    if (out.errors.length) { console.log('  ERROR in ' + f + ': ' + out.errors.join('; ')); continue; }
    fs.writeFileSync(f, out.styles);
    report(f, Buffer.byteLength(src), Buffer.byteLength(out.styles));
  }

  console.log('Minifying JS:');
  for (const f of jsFiles) {
    if (skip(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const out = await terser.minify(src, { compress: true, mangle: true });
    if (out.error) { console.log('  ERROR in ' + f + ': ' + out.error.message); continue; }
    fs.writeFileSync(f, out.code);
    report(f, Buffer.byteLength(src), Buffer.byteLength(out.code));
  }

  console.log('Minifying HTML:');
  for (const f of htmlFiles) {
    if (skip(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const out = await minifyHtml(src, {
      collapseWhitespace: true,
      removeComments: true,
      collapseBooleanAttributes: true,
      removeRedundantAttributes: false,
      keepClosingSlash: true,
      minifyCSS: false,
      minifyJS: false,
      ignoreCustomComments: [/^ ?(Tawk|End)/]
    });
    fs.writeFileSync(f, out);
    report(f, Buffer.byteLength(src), Buffer.byteLength(out));
  }
  console.log('\nDone. Review changes with git diff before committing.');
}

run();
