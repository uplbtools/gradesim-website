import { expect, test } from 'vitest';
import backup from './fixtures/backup.json';
import { shownGwa } from './wrapped.ts';
import {
	calculateGWA,
	gradeTone,
	groupCourses,
	groupGWA,
	honorFor,
	lightSems,
	standingFor,
	parseAMISData,
	scholarFor,
	scholarHolds,
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
	expect(honorFor(1.2, 30)?.name).toBe('Summa cum laude');
	expect(honorFor(1.21, 30)?.name).toBe('Magna cum laude');
	expect(honorFor(1.45, 30)?.name).toBe('Magna cum laude');
	expect(honorFor(1.75, 30)?.name).toBe('Cum laude');
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
		{ code: 'ECON 11', title: '', units: 3, grade: 2 },
		{ code: 'CMSC 198', title: '', units: 3, grade: 1 }
	];
	expect(substituteOptions(UPLB_PROGRAMS.BSCS, done, {}).map((c) => c.code)).toEqual(['ECON 11', 'PED 101']);
	expect(substituteOptions(UPLB_PROGRAMS.BSCS, done, { 'MATH 27': 'PED 101' }).map((c) => c.code)).toEqual(['ECON 11']);
});

test('a failing or INC grade in HK or NSTP holds the scholar badge for that term', () => {
	const row = (code: string, grade: string, termKey: string): Course => ({ id: code + termKey, termKey, termLabel: '', ay: '', code, title: '', units: 2, grade });
	const holds = scholarHolds([row('HK 11', '5.00', '1231'), row('NSTP 1', 'INC', '1232'), row('HK 12', '1.00', '1241'), row('MATH 27', '5.00', '1242')]);
	expect([...holds]).toEqual(['1231', '1232']);
});

test('a 4.00 is not a passing grade', () => {
	expect(gradeTone('4.00')).toBe('other');
	expect(gradeTone('3.00')).toBe('passing');
});

test('a GWA can be posted the way students mask it', () => {
	expect(['none', 'xx', 'bx', 'xc', 'bc', 'full'].map((k) => shownGwa('1.8750', k as never))).toEqual(['', '1.xx', '1.8x', '1.x7', '1.87', '1.8750']);
});

test('a sem under 15 academic units shows up for Latin honors, but not a midyear or the latest sem', () => {
	const c = (termKey: string, code: string, units: number, grade = '1.00'): Course => ({ id: `${termKey}${code}`, termKey, termLabel: termName(termKey), ay: '', code, title: '', units, grade });
	const courses = [
		...['A 1', 'A 2', 'A 3', 'A 4', 'A 5'].map((k) => c('1241', k, 3)),
		c('1242', 'B 1', 3), c('1242', 'B 2', 3), c('1242', 'B 3', 3), c('1242', 'B 4', 3), c('1242', 'HK 12', 2), c('1242', 'B 5', 3, 'DRP'),
		c('1243', 'M 1', 3),
		c('1251', 'C 1', 3)
	];
	expect(lightSems(courses)).toEqual([{ label: '2nd sem AY 2024-25', abs: termKeyToAbs('1242'), units: 12 }]);
});

test('scholastic standing follows the share of units below 3.00 in the latest regular sem', () => {
	const c = (termKey: string, code: string, units: number, grade: string): Course => ({ id: `${termKey}${code}`, termKey, termLabel: termName(termKey), ay: '', code, title: '', units, grade });
	const sem = (termKey: string, low: number, grades = 5) => Array.from({ length: grades }, (_, i) => c(termKey, `X ${i}`, 3, i < low ? '5.00' : '2.00'));
	expect(standingFor(sem('1251', 0))).toBeNull();
	expect(standingFor(sem('1251', 2))?.level).toBe('warning');
	expect(standingFor(sem('1251', 3))?.level).toBe('probation');
	expect(standingFor(sem('1251', 4))?.level).toBe('dropped');
	expect(standingFor(sem('1251', 5))?.level).toBe('barred');
	expect(standingFor([...sem('1242', 3), ...sem('1251', 3)])?.level).toBe('dropped');
	expect(standingFor([...sem('1251', 3), c('1253', 'M 1', 3, '2.00'), c('1251', 'HK 12', 2, '5.00'), c('1251', 'Y 1', 3, 'INC')])).toMatchObject({ level: 'probation', low: 9, units: 15 });
});
