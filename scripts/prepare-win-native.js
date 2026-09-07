'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.platform === 'win32') {
  console.log('Windows native dependencies are already platform-native.');
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'node_modules', 'odbc', 'lib', 'bindings', 'napi-v8', 'odbc.node');
const temp = path.join(root, '.cache-odbc-win');
const archive = path.join(temp, 'odbc-win.tgz');
const url = 'https://github.com/IBM/node-odbc/releases/download/v2.5.0/odbc-v2.5.0-win32-x64-napi-v8.tar.gz';

fs.mkdirSync(temp, { recursive: true });
try {
  execFileSync('curl', ['-fL', '--retry', '3', url, '-o', archive], { stdio: 'inherit' });
  execFileSync('tar', ['-xzf', archive, '-C', temp], { stdio: 'inherit' });
  const extracted = path.join(temp, 'napi-v8', 'odbc.node');
  if (!fs.existsSync(extracted)) throw new Error('ODBC Windows binary was not found in the downloaded archive.');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(extracted, target);
  console.log(`Prepared Windows ODBC binary: ${target}`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
