import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'node_modules', '@fontsource', 'inter', 'files');
const targetDir = path.join(root, 'public', 'assets', 'files');

async function main() {
  const fontFiles = await readdir(sourceDir);
  await mkdir(targetDir, { recursive: true });

  await Promise.all(
    fontFiles.map((file) => copyFile(path.join(sourceDir, file), path.join(targetDir, file)))
  );

  console.log(`Copied ${fontFiles.length} Inter font files to public/assets/files`);
}

await main();
