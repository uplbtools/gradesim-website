import { expect, test } from 'vitest';

const svelte = import.meta.glob('/src/**/*.svelte', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const strings = import.meta.glob('/src/lib/{wrapped,importers}.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const RETIRED = /\b[Ss]emesters?\b|\b[Ss]ubjects?\b|\b\d+u\b|Export JSON|Import JSON|Import a file|Install the extension|\bCurricula\b|Save slide|as an image/;

test('user-facing text uses one name per thing', () => {
	const hits: string[] = [];
	for (const [file, src] of Object.entries(svelte)) {
		const markup = src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
		for (const line of markup.split('\n')) if (RETIRED.test(line.replace(/href=\{?[^\s>]+/g, ''))) hits.push(`${file}: ${line.trim()}`);
	}
	for (const [file, src] of Object.entries(strings)) {
		for (const s of src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? []) if (RETIRED.test(s)) hits.push(`${file}: ${s}`);
	}
	expect(hits).toEqual([]);
});
