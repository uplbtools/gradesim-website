import { expect, test } from 'vitest';
import { POST } from '../../api/fix.ts';
import { fixIssue, validateFix, type ChecklistFix } from './fix.ts';
import { modelFor } from './planner.ts';

test('a fix is cleaned, and a bad one is refused with a reason', () => {
	expect(validateFix({ kind: 'edit', code: 'cmsc  190', prereqs: '' })).toEqual({ kind: 'edit', code: 'CMSC 190', prereqs: [] });
	expect(validateFix({ kind: 'remove', code: 'CMSC 199', note: 'see <b>@maintainer</b> `x` | y' })).toEqual({ kind: 'remove', code: 'CMSC 199', note: 'see bmaintainer/b x y' });
	expect(validateFix({ kind: 'edit', code: 'CMSC 198' })).toBe('Change at least one field first.');
	expect(validateFix({ kind: 'edit', code: 'CMSC 198', units: 40 })).toMatch(/Units/);
	expect(validateFix({ kind: 'add', code: 'not a code', title: 'X', units: 3 })).toMatch(/course code/);
	expect(validateFix({ kind: 'edit', code: 'CMSC 198', prereqs: 'CMSC 22; drop table' })).toMatch(/prerequisites/);
});

test('fixes change the plan model', () => {
	const fixes = [
		validateFix({ kind: 'edit', code: 'CMSC 198', units: 6, sems: ['midyear'], prereqs: 'CMSC 128' }),
		validateFix({ kind: 'remove', code: 'CMSC 199' }),
		validateFix({ kind: 'add', code: 'CMSC 191', title: 'Special Topics', units: 3 })
	] as ChecklistFix[];
	const model = modelFor('BSCS', 'sp', null, fixes)!;
	expect(model.byCode.get('CMSC 198')).toMatchObject({ units: 6, pre: [['CMSC 128']], offered: { 1: 0, 2: 0, 3: 1 }, fixed: true });
	expect(model.byCode.has('CMSC 199')).toBe(false);
	expect(model.byCode.get('CMSC 191')?.title).toBe('Special Topics');
	expect(modelFor('BSCS', 'sp')!.byCode.get('CMSC 198')!.units).toBe(3);
	expect(fixIssue('BSCS', fixes).body).toContain('| CMSC 199 | is not in the curriculum |');
});

test('the function refuses requests until it is set up, and from other sites', async () => {
	const request = () => new Request('https://gradesim.uplb.tools/api/fix', { method: 'POST', headers: { origin: 'https://example.com' }, body: '{}' });
	delete process.env.GRADESIM_FIX_TOKEN;
	expect((await POST(request())).status).toBe(503);
	process.env.GRADESIM_FIX_TOKEN = 'test';
	expect((await POST(request())).status).toBe(403);
	delete process.env.GRADESIM_FIX_TOKEN;
});
