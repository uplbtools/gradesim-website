import { expect, test } from 'vitest';
import backup from './fixtures/backup.json';
import { packLink, unpackHash } from './link.ts';

test('a backup survives the trip through a link', async () => {
	const url = await packLink(backup, 'https://gradesim.uplb.tools/');
	expect(url.length).toBeLessThan(JSON.stringify(backup).length);
	expect(JSON.parse((await unpackHash(new URL(url).hash))!)).toEqual(backup);
});

test('other hashes are left alone, and a damaged link throws', async () => {
	expect(await unpackHash('#planner')).toBeNull();
	await expect(unpackHash('#d=not-a-link')).rejects.toThrow();
});
