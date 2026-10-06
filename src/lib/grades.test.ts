import { expect, test } from 'vitest';
import backup from './fixtures/backup.json';
import {
	calculateGWA,
	groupCourses,
	groupGWA,
	honorFor,
	parseAMISData,
	scholarFor,
	sortedTermKeys,
	substituteOptions,
	termKeyToAbs,
	termName,
	type Course,
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
	// Term ids past 2029 parse: 1, a two digit year, then the term.
	expect(termKeyToAbs(1293)).toBe(2029 * 3 + 2);
	expect(termKeyToAbs(1301)).toBe(2030 * 3);
	expect(termKeyToAbs('1312')).toBe(2031 * 3 + 1);
	expect(termKeyToAbs(1254)).toBeNull();
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
	// The failed MATH 27 is in the GWA but not in the units passed.
	expect(g.passedUnits).toBe(30);
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

test('honors: Latin honors only, none with zero graded units', () => {
	expect(honorFor(0, 0)).toBeNull();
	expect(honorFor(1, 0)).toBeNull();
	expect(honorFor(1.2, 30)?.name).toBe('Summa Cum Laude');
	expect(honorFor(1.21, 30)?.name).toBe('Magna Cum Laude');
	expect(honorFor(1.45, 30)?.name).toBe('Magna Cum Laude');
	expect(honorFor(1.75, 30)?.name).toBe('Cum Laude');
	expect(honorFor(2, 30)).toBeNull();
});

test('scholars need 15 units and no 5.00, 4.00 or INC that term', () => {
	const ok = { gwa: 1.45, totalUnits: 15, hasFailOrInc: false };
	expect(scholarFor(ok)).toBe('University Scholar');
	expect(scholarFor({ ...ok, gwa: 1.5 })).toBe('College Scholar');
	expect(scholarFor({ ...ok, gwa: 1.9 })).toBeNull();
	expect(scholarFor({ ...ok, totalUnits: 12 })).toBeNull();
	expect(scholarFor({ ...ok, hasFailOrInc: true })).toBeNull();
	const row = (code: string, grade: string, units = 3): Course => ({ id: code, termKey: '1251', termLabel: '', ay: '', code, title: '', units, grade });
	const term = [row('CMSC 12', '1.00'), row('CMSC 21', '1.00'), row('CMSC 22', '1.00'), row('MATH 27', '1.00'), row('ECON 11', '1.00')];
	expect(scholarFor(groupGWA(term))).toBe('University Scholar');
	expect(groupGWA([...term, row('STS 1', 'INC')]).hasFailOrInc).toBe(true);
	expect(groupGWA([...term, row('ARTS 1', '4.00')]).hasFailOrInc).toBe(true);
});

test('PE, HK and NSTP stay out of the GWA but PEd counts', () => {
	const row = (code: string, grade: string): Course => ({ id: code, termKey: '1251', termLabel: '', ay: '', code, title: '', units: 3, grade });
	const g = calculateGWA([row('PE 1', '1.00'), row('HK 11', '1.00'), row('NSTP 1', '1.00'), row('PED 101', '2.00')]);
	expect(g.totalUnits).toBe(3);
	expect(g.gwa).toBe(2);
});

test('groups by term and year with their own GWA', () => {
	const byTerm = groupCourses(courses, 'term');
	expect(byTerm.map((g) => g.label)).toEqual(['1st sem AY 2024-25', '2nd sem AY 2023-24', '1st sem AY 2023-24']);
	expect(groupGWA(byTerm[0].courses).gwa).toBeCloseTo(22.5 / 12, 10);
	const byYear = groupCourses(courses, 'year');
	expect(byYear.map((g) => g.label)).toEqual(['AY 2024-25', 'AY 2023-24']);
});

test('substitute options leave out required, GE and already used courses', () => {
	const done = [
		{ code: 'CMSC 12', title: '', units: 3, grade: 1 },
		{ code: 'ARTS 1', title: '', units: 3, grade: 1 },
		{ code: 'PED 101', title: '', units: 3, grade: 2 },
		{ code: 'ECON 11', title: '', units: 3, grade: 2 }
	];
	expect(substituteOptions(UPLB_PROGRAMS.BSCS, done, {}).map((c) => c.code)).toEqual(['ECON 11', 'PED 101']);
	expect(substituteOptions(UPLB_PROGRAMS.BSCS, done, { 'MATH 27': 'PED 101' }).map((c) => c.code)).toEqual(['ECON 11']);
});
