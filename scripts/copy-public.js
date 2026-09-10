const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');

console.log('[copy-public] Copying public directory to dist...');

if (!fs.existsSync(publicDir)) {
  console.error('[copy-public] Error: public directory does not exist at', publicDir);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.log('[copy-public] dist directory does not exist, creating it...');
  fs.mkdirSync(distDir, { recursive: true });
}

try {
  fs.cpSync(publicDir, distDir, { recursive: true, force: true });
  console.log('[copy-public] Successfully copied all files from public/ to dist/');

  // Verify key files exist in dist
  const requiredFiles = ['landing.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html'];
  const missing = requiredFiles.filter(f => !fs.existsSync(path.join(distDir, f)));
  if (missing.length > 0) {
    console.warn('[copy-public] Warning: missing files in dist:', missing);
  } else {
    console.log('[copy-public] All required static pages verified in dist/');
  }
} catch (err) {
  console.error('[copy-public] Failed to copy public files to dist:', err);
  process.exit(1);
}
