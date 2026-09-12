import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsxPath = path.join(__dirname, 'node_modules', '.bin', 'tsx');

const child = spawn(process.execPath, [
  '--require', path.join(__dirname, 'node_modules', 'tsx', 'cjs', 'api.js'),
  path.join(__dirname, 'electron', 'main.ts')
], { stdio: 'inherit' });

child.on('close', (code) => process.exit(code || 0));
