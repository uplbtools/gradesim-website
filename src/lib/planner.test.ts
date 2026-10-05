import { expect, test } from 'vitest';
import backup from './fixtures/backup.json';
import type { GradesData } from './grades.ts';
import {
	absLabel,
	buildColumns,
	calendarAbs,
	compute,
	defaultCap,
	gradeResult,
	modelFor,
	summary,
	type PlannerInput
} from './planner.ts';

const now = new Date(2024, 9, 1); // October 2024: 1st sem AY 2024-25 is underway
const model = modelFor('BSCS')!;
const input = (over: Partial<PlannerInput> = {}): PlannerInput => ({
	gradesData: backup.gradesData as GradesData,
	substitutions: {},
	customCourseStatus: {},
	plannerPins: {},
	plannerPetitions: {},
	plannerOptions: { cap: defaultCap(model.program), midyear: false, midyear9: false },
	whatif: null,
	...over
});

test('term helpers', () => {
	expect(calendarAbs(new Date(2024, 9, 1))).toBe(2024 * 3);
	expect(calendarAbs(new Date(2025, 1, 1))).toBe(2024 * 3 + 1);
	expect(calendarAbs(new Date(2025, 5, 15))).toBe(2024 * 3 + 2);
	expect(absLabel(2024 * 3)).toBe('1st sem 2024');
	expect(absLabel(2024 * 3 + 1)).toBe('2nd sem 2025');
	expect(gradeResult('2.75')).toBe('passed');
	expect(gradeResult('5.00')).toBe('failed');
	expect(gradeResult('INC')).toBe('other');
	expect(gradeResult('')).toBe('nograde');
});

test('a failed course comes back as a retake after its failed attempt', () => {
	const v = compute(model, input(), now);
	expect(v.startAbs).toBe(2024 * 3 + 1); // the term after the latest grades
	expect(v.failures.map((f) => f.code)).toContain('MATH 27');
	const { list, primary } = buildColumns(v);
	expect(primary['MATH 27'].status).toBe('retake');
	const failedCol = list.find((c) => c.abs === 2023 * 3)!;
	expect(failedCol.cards.find((c) => c.code === 'MATH 27')!.status).toBe('failed');
	expect(primary['CMSC 12'].status).toBe('passed');
	expect(summary(v).headline).toMatch(/^Graduate /);
});

test('marking the failed course passed removes the retake and can only help', () => {
	const base = compute(model, input(), now);
	const fixed = compute(model, input({ customCourseStatus: { 'MATH 27': 'passed' } }), now);
	expect(buildColumns(fixed).primary['MATH 27'].status).toBe('passed');
	expect(fixed.now.result.gradTermIndex).toBeLessThanOrEqual(base.now.result.gradTermIndex);
});

test('what-if fail on a planned course adds a hypothetical attempt and a retake', () => {
	const v = compute(model, input({ whatif: { code: 'CMSC 100', mode: 'fail' } }), now);
	const { list, primary } = buildColumns(v);
	expect(primary['CMSC 100'].status).toBe('retake');
	expect(list.some((c) => c.cards.some((k) => k.code === 'CMSC 100' && k.hypothetical))).toBe(true);
});

test('every program builds a plan without throwing', () => {
	for (const code of ['BSCS', 'BSBIO', 'BSCE', 'DVM', 'BACOMM', 'ASDC']) {
		const m = modelFor(code)!;
		const v = compute(m, { ...input(), gradesData: null, plannerOptions: { cap: defaultCap(m.program), midyear: false, midyear9: false } }, now);
		expect(buildColumns(v).list.length).toBeGreaterThan(0);
	}
});
