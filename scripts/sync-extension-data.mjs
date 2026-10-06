// Regenerates src/lib/data/programs.json and catalog.json from the extension's
// curriculum.js and catalog.js. Run from the repo root with the path to the
// extension's src folder, for example
//   node scripts/sync-extension-data.mjs ../gradesim/extension/src
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const src = process.argv[2];
if (!src) throw new Error('Pass the path to extension/src');

function load(file) {
	const module = { exports: {} };
	vm.runInNewContext(readFileSync(join(src, file), 'utf8'), { module, console });
	return module.exports;
}

const { UPLB_PROGRAMS } = load('curriculum.js');
const { UPLB_CATALOG } = load('catalog.js');
writeFileSync('src/lib/data/programs.json', JSON.stringify(UPLB_PROGRAMS));
writeFileSync('src/lib/data/catalog.json', JSON.stringify(UPLB_CATALOG));
console.log(`${Object.keys(UPLB_PROGRAMS).length} programs, ${Object.keys(UPLB_CATALOG).length} catalog courses`);
