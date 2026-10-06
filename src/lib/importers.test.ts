import { expect, test } from 'vitest';
import backup from './fixtures/backup.json';
import { addCourse, makeBackup, parseImport, removeCourse, setGrade } from './importers.ts';
import { parseAMISData, type GradesData } from './grades.ts';
import { makePlanFile } from './planner.ts';

test('reads the extension JSON backup', () => {
	const r = parseImport(JSON.stringify(backup));
	expect(r.kind).toBe('grades');
	if (r.kind !== 'grades') return;
	expect(r.patch.selectedProgram).toBe('BSCS');
	expect(Object.keys(r.patch.gradesData.student_grades)).toHaveLength(3);
});

test('accepts a bare AMIS grades response', () => {
	const r = parseImport(JSON.stringify(backup.gradesData));
	expect(r.kind).toBe('grades');
});

test('round-trips its own backup', () => {
	const file = makeBackup({
		gradesData: backup.gradesData as GradesData,
		selectedProgram: 'BSBIO',
		excludedCourses: ['3'],
		substitutions: { 'MATH 27': 'STAT 101' },
		selectedSpecializations: { BSAAE: 'amp' }
	});
	const r = parseImport(JSON.stringify(file));
	expect(r).toMatchObject({
		kind: 'grades',
		patch: { selectedProgram: 'BSBIO', excludedCourses: ['3'], substitutions: { 'MATH 27': 'STAT 101' }, selectedSpecializations: { BSAAE: 'amp' } }
	});
});

test('rejects junk with a readable reason', () => {
	expect(parseImport('not json')).toMatchObject({ kind: 'error' });
	expect(parseImport('{"hello":1}')).toMatchObject({ kind: 'error', message: expect.stringContaining('not a GradeSim backup') });
	expect(parseImport('{"source":"elbi-gradesim","gradesData":null}')).toMatchObject({ kind: 'error', message: expect.stringContaining('no grades') });
	expect(parseImport('{"student_grades":{"1251":{"values":"x"}}}')).toMatchObject({ kind: 'error' });
});

test('reads a saved plan and refuses a damaged one', () => {
	const plan = makePlanFile('BSCS', {
		gradesData: null,
		substitutions: {},
		customCourseStatus: { 'CMSC 12': 'passed' },
		plannerPins: { 'CMSC 21': 6080 },
		plannerPetitions: {},
		plannerOptions: { cap: 18, midyear: false, midyear9: false },
		whatif: { code: 'CMSC 21', mode: 'fail' }
	});
	expect(parseImport(JSON.stringify(plan))).toMatchObject({ kind: 'plan', plan: { program: 'BSCS' } });
	expect(parseImport(JSON.stringify({ ...plan, plannerOptions: { cap: 30 } }))).toMatchObject({ kind: 'error', message: expect.stringContaining('damaged') });
	expect(parseImport(JSON.stringify({ ...plan, program: 'NOPE' }))).toMatchObject({ kind: 'error', message: expect.stringContaining('NOPE') });
	expect(parseImport(JSON.stringify({ ...plan, version: 2 }))).toMatchObject({ kind: 'error', message: expect.stringContaining('newer') });
});

test('manual entry builds the same AMIS shape', () => {
	let d = addCourse(null, 2025, 1, { code: 'cmsc  12', title: '', units: 3, grade: '1.50' }, 'm-1');
	d = addCourse(d, 2025, 1, { code: 'MATH 27', title: 'Calculus', units: 3, grade: '' }, 'm-2');
	d = addCourse(d, 2024, 2, { code: 'ARTS 1', title: 'Arts', units: 3, grade: '2.00' }, 'm-3');
	expect(Object.keys(d.student_grades).sort()).toEqual(['2024-2', '2025-1']);
	const parsed = parseAMISData(d);
	expect(parsed[0]).toMatchObject({ code: 'CMSC 12', title: 'CMSC 12', grade: '1.50', termLabel: '1st sem AY 2025-26' });
	expect(parsed.find((c) => c.code === 'MATH 27')!.grade).toBe('');
	d = setGrade(d, '2025-1', 'm-2', '2.25');
	expect(parseAMISData(d).find((c) => c.code === 'MATH 27')!.grade).toBe('2.25');
	d = removeCourse(d, '2024-2', 'm-3');
	expect(d.student_grades['2024-2']).toBeUndefined();
});
