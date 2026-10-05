import { expect, test } from 'vitest';
import backup from './fixtures/backup.json';
import {
	calculateGWA,
	groupCourses,
	groupGWA,
	honorFor,
	parseAMISData,
	remainingFor,
	scholarFor,
	sortedTermKeys,
	termKeyToAbs,
	termName,
	whatIf,
	type GradesData
} from './grades.ts';
import { UPLB_PROGRAMS } from './curriculum.ts';

const data = backup.gradesData as GradesData;
const courses = parseAMISData(data);

test('term keys: AMIS ids and hand-entered terms', () => {
	expect(termKeyToAbs('1251')).toBe(2025 * 3);
	expect(termKeyToAbs('1252')).toBe(2025 * 3 + 1);
	expect(termKeyToAbs('1243')).toBe(2024 * 3 + 2);
	expect(termKeyToAbs('2019-1')).toBe(2019 * 3);
	expect(termKeyToAbs('weird')).toBeNull();
	expect(termName('1251')).toBe('1st sem AY 2025-26');
	expect(termName('1243')).toBe('Midyear AY 2024-25');
	expect(termName('x', { term: 'Summer 2020', values: [] })).toBe('Summer 2020');
	expect(sortedTermKeys({ student_grades: { '1232': { values: [] }, '1241': { values: [] }, '1231': { values: [] } } })).toEqual(['1241', '1232', '1231']);
});

test('parses the AMIS shape newest term first, with extension-compatible ids', () => {
	expect(courses).toHaveLength(15);
	expect(courses[0].termKey).toBe('1241');
	expect(courses.find((c) => c.code === 'CMSC 12')).toMatchObject({ id: '1', units: 3, grade: '1.25', ay: 'AY 2023-24' });
	expect(parseAMISData({ student_grades: { '1251': { values: [{ course: { course_code: 'X 1' }, grade: 2 }] } } })[0].id).toBe('X 1-1251');
	expect(parseAMISData(null)).toEqual([]);
});

test('GWA skips NSTP, HK, PE and non-numeric grades and weights by units', () => {
	const g = calculateGWA(courses);
	expect(g.totalUnits).toBe(33);
	expect(g.totalCourses).toBe(11);
	expect(g.gwa).toBeCloseTo(65.25 / 33, 10);
	// S counts as completed, INC and a failing grade do not
	expect(g.completedCourses.some((c) => c.code === 'MATH 27')).toBe(false);
	expect(g.completedCourses.some((c) => c.code === 'NSTP 1')).toBe(false);
	expect(g.completedCourses.some((c) => c.code === 'STS 1')).toBe(false);
});

test('excluding a course takes it out of the GWA and tallies it', () => {
	const math = courses.find((c) => c.code === 'MATH 27')!;
	const g = calculateGWA(courses, new Set([math.id]));
	expect(g.totalUnits).toBe(30);
	expect(g.excludedUnits).toBe(3);
	expect(g.excludedCount).toBe(1);
	expect(g.gwa).toBeCloseTo(50.25 / 30, 10);
});

test('honors and scholar thresholds', () => {
	expect(honorFor(0)).toBeNull();
	expect(honorFor(1.2)?.name).toBe('Summa Cum Laude');
	expect(honorFor(1.21)?.name).toBe('Magna Cum Laude');
	expect(honorFor(1.45)?.name).toBe('Magna Cum Laude');
	expect(honorFor(1.75)?.name).toBe('Cum Laude');
	expect(honorFor(2)?.name).toBe('Honor Roll');
	expect(honorFor(2.01)).toBeNull();
	expect(scholarFor(1.45)).toBe('University Scholar');
	expect(scholarFor(1.5)).toBe('College Scholar');
	expect(scholarFor(1.9)).toBe('Honor Roll');
	expect(scholarFor(2.5)).toBeNull();
});

test('groups by term and year with their own GWA', () => {
	const byTerm = groupCourses(courses, 'term');
	expect(byTerm.map((g) => g.label)).toEqual(['1st sem AY 2024-25', '2nd sem AY 2023-24', '1st sem AY 2023-24']);
	expect(groupGWA(byTerm[0].courses)).toBeCloseTo(22.5 / 12, 10);
	const byYear = groupCourses(courses, 'year');
	expect(byYear.map((g) => g.label)).toEqual(['AY 2024-25', 'AY 2023-24']);
});

test('what-if: average needed on the remaining units', () => {
	expect(whatIf(1.75, 1.5, 30, 100)).toMatchObject({ status: 'achieved' });
	const r = whatIf(1.75, 2, 30, 90);
	expect(r.status).toBe('possible');
	expect(r.required).toBeCloseTo((1.75 * 120 - 2 * 30) / 90, 10);
	expect(whatIf(1.2, 2.5, 120, 10).status).toBe('impossible-low');
	expect(whatIf(1.2, 0, 0, 100)).toMatchObject({ status: 'possible', required: 1.2, effort: 'excellent' });
	expect(whatIf(1, 1.5, 30, 0).status).toBe('impossible-low');
});

test('remaining courses honor substitutions and count GE slots', () => {
	const g = calculateGWA(courses);
	const before = remainingFor(UPLB_PROGRAMS.BSCS, g.completedCourses, {}, null);
	expect(before.remaining.some((c) => c.code === 'MATH 27')).toBe(true);
	expect(before.completedGECount).toBe(4);
	expect(before.remainingGESlots).toBe(5);
	const after = remainingFor(UPLB_PROGRAMS.BSCS, g.completedCourses, { 'MATH 27': 'STAT 101' }, null);
	expect(after.remaining.some((c) => c.code === 'MATH 27')).toBe(false);
	expect(after.remainingUnits).toBe(before.remainingUnits - 3);
});
