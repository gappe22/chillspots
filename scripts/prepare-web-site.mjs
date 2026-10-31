import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'sites/chillspots-web');
if (!existsSync(path.join(root, 'dist/index.html'))) {
  throw new Error('Run npm run build before preparing the web deployment.');
}
mkdirSync(destination, { recursive: true });
// Copy an explicit source snapshot, excluding native build output and local state.
for (const entry of ['app', 'assets', 'components', 'constants', 'hooks', 'lib', 'shared', 'server', 'public', 'dist', 'README.md', 'Dockerfile', '.dockerignore', '.env.example', 'app.json', 'babel.config.js', 'metro.config.js', 'package.json', 'package-lock.json', 'tsconfig.json']) {
  rmSync(path.join(destination, entry), { recursive: true, force: true });
  cpSync(path.join(root, entry), path.join(destination, entry), {
    recursive: true,
    filter: source => path.basename(source) !== '.DS_Store' && !source.startsWith(path.join(root, 'server/data')),
  });
}
const packageFile = path.join(destination, 'package.json');
const manifest = JSON.parse(readFileSync(packageFile, 'utf8'));
delete manifest.scripts['prepare:web-site'];
writeFileSync(packageFile, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(path.join(destination, '.gitignore'), 'node_modules/\ndist/\n.expo/\n.DS_Store\nserver/data/\n.env\n.env.local\n');
// The copied README describes Express hosting; a static-only host cannot run the API.
console.log(`Prepared web source and build at ${destination}`);
