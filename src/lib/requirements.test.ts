// Ported from the extension's requirements.test.js and planner-sweep.test.js.
// The What if tab and the planner count the same courses left, and the GWA
// outlook math matches the extension.
import { expect, test } from 'vitest';
import { UPLB_CATALOG } from './catalog.ts';
import { getPlannerCourses, UPLB_PROGRAMS } from './curriculum.ts';
import type { GradesData } from './grades.ts';
import { compute, DEFAULT_PLANNER_OPTIONS, modelFor } from './planner.ts';
import { amisCourses, gradeResult, gwaOutlook, plannerCourseList, remainingRequirements } from './requirements.ts';
import { enrichCourses, scheduleEarliest, semAt } from './scheduler.ts';

test('grade results', () => {
	expect(gradeResult('1.00')).toBe('passed');
	expect(gradeResult('P')).toBe('passed');
	expect(gradeResult('5.00')).toBe('failed');
	expect(gradeResult('INC')).toBe('other');
	expect(gradeResult('4.00')).toBe('other');
	expect(gradeResult(null)).toBe('nograde');
});

// A BSCS student with GE courses named by code, HK, NSTP, a PEd course and an
// outside elective, a failed then retaken course, an open 5.00, an INC, and
// two courses being taken now.
const v = (code: string, title: string, units: number, grade: string | null) => ({
	grade,
	unit_taken: String(units),
	course: { course_code: code, title }
});
const gradesData: GradesData = {
	student_grades: {
		1231: { values: [v('CMSC 12', 'Foundations of Computer Science', 3, '1.00'), v('CMSC 56', 'Discrete Mathematics I', 3, '1.50'),
			v('MATH 27', 'Analytic Geometry and Calculus II', 3, 'INC'), v('ETHICS 1', 'Ethics and Moral Reasoning', 3, '1.25'),
			v('HK 11', 'Wellness', 2, '1.00'), v('NSTP 1', 'National Service Training Program I', 3, 'P')] },
		1232: { values: [v('CMSC 21', 'Fundamentals of Programming', 3, '5.00'), v('CMSC 22', 'Object-Oriented Programming', 3, '1.75'),
			v('STS 1', 'Science, Technology and Society', 3, '1.50'), v('ARTS 1', 'Critical Perspectives in the Arts', 3, '1.25'),
			v('PED 101', 'Foundations of Physical Education', 3, '1.50')] },
		1241: { values: [v('CMSC 21', 'Fundamentals of Programming', 3, '2.00'), v('MATH 28', 'Analytic Geometry and Calculus III', 3, '2.25'),
			v('CMSC 123', 'Data Structures', 3, '5.00'), v('ECON 11', 'Introductory Economics', 3, '1.75')] },
		1251: { values: [v('CMSC 100', 'Web Programming', 3, null), v('CMSC 127', 'File Processing and Database Systems', 3, null)] }
	}
};
const BSCS = UPLB_PROGRAMS.BSCS;
const passedRows = amisCourses(gradesData).filter((r) => r.result === 'passed');
const courses = plannerCourseList(BSCS, 'sp', UPLB_CATALOG);
const left = remainingRequirements(courses, passedRows);
const leftCodes = new Set(left.left.map((c) => c.code));

test('GE by code, HK and NSTP complete, PEd and ECON 11 fill free electives', () => {
	expect(left.ge).toEqual({ done: 3, total: 9 });
	expect(!leftCodes.has('HK 1') && leftCodes.has('HK 2')).toBe(true);
	expect(!leftCodes.has('NSTP 1') && leftCodes.has('NSTP 2')).toBe(true);
	expect(left.electives).toEqual({ doneUnits: 6, totalUnits: 18 });
	expect(leftCodes.has('CMSC 21')).toBe(false);
	['CMSC 123', 'MATH 27', 'CMSC 100', 'CMSC 127'].forEach((c) => expect(leftCodes.has(c), c).toBe(true));
	// HK and NSTP units are left to take but do not count in the GWA.
	expect(left.units - left.gwaUnits).toBe(2 + 3);
});

test('What if units left equal what the scheduler places', () => {
	const plan = scheduleEarliest({ courses, passed: new Set(left.fill.keys()), useMidyear: false, totalUnits: BSCS.totalUnitsRequired });
	const byCode = new Map(courses.map((c) => [c.code, c]));
	const plannerUnits = [...Object.keys(plan.assignedTerm), ...plan.unschedulable].reduce(
		(s, code) => s + (Number(byCode.get(code)!.units) || 0),
		0
	);
	expect(left.units).toBe(plannerUnits);
});

test('What if units left equal the planner summary for the same BSCS student', () => {
	const model = modelFor('BSCS', 'sp')!;
	const view = compute(
		model,
		{
			gradesData,
			substitutions: {},
			customCourseStatus: {},
			plannerPins: {},
			plannerPetitions: {},
			plannerOptions: DEFAULT_PLANNER_OPTIONS,
			whatif: null
		},
		new Date(2025, 9, 1)
	);
	expect(view.left.units).toBe(left.units);
});

test('no made up free electives, and planner marks count', () => {
	expect(remainingRequirements(plannerCourseList(UPLB_PROGRAMS.BSSTAT, null, UPLB_CATALOG), []).electives.totalUnits).toBe(0);
	expect(remainingRequirements(plannerCourseList(UPLB_PROGRAMS.BSFST, null, UPLB_CATALOG), []).electives.totalUnits).toBe(6);
	const marked = remainingRequirements(courses, passedRows, { overrides: { 'CMSC 123': 'passed', 'CMSC 12': 'failed' } });
	expect(marked.units).toBe(left.units);
});

test('GWA outlook', () => {
	const out = gwaOutlook(1.9, 60, 60, 1.2);
	expect(out.status).toBe('out-of-reach');
	expect(out.ceiling).toBe(1.45);
	expect(out.bestHonor).toEqual(['Magna cum laude', 1.45]);
	const ok = gwaOutlook(1.9, 60, 60, 1.75);
	expect(ok.status).toBe('reachable');
	expect(Number(ok.required!.toFixed(2))).toBe(1.6);
	// A needed average of 3.00 or more means any passing grade works.
	expect(gwaOutlook(1.5, 60, 10, 1.75).status).toBe('any-pass');
	expect(gwaOutlook(2.5, 60, 0, 1.75).status).toBe('out-of-reach');
	// Not reachable only when the needed average would beat 1.00.
	expect(gwaOutlook(1.3, 60, 60, 1.15).status).toBe('reachable');
	expect(gwaOutlook(1.3, 60, 60, 1.14).status).toBe('out-of-reach');
});

test('every available program plans from scratch at 18 units with midyear off', () => {
	const failures: string[] = [];
	Object.values(UPLB_PROGRAMS)
		.filter((p) => p.available)
		.forEach((p) => {
			const years = Math.max(...p.majorCourses.map((c) => c.year || 0));
			(p.tracks ? Object.keys(p.tracks) : [null]).forEach((track) => {
				const label = track ? `${p.code} (${track})` : p.code;
				const r = scheduleEarliest({
					courses: enrichCourses(getPlannerCourses(p, track), UPLB_CATALOG),
					passed: new Set(),
					useMidyear: false,
					totalUnits: p.totalUnitsRequired
				});
				if (r.unschedulable.length) failures.push(`${label}: cannot place ${r.unschedulable.join(', ')}`);
				let regular = 0;
				for (let t = 0; t <= r.gradTermIndex; t++) if (semAt(t, '1') !== 'midyear') regular++;
				if (regular < 2 * years) failures.push(`${label}: ${regular} regular terms for a ${years}-year checklist`);
			});
		});
	expect(failures).toEqual([]);
});

test('HIST 1 fills KAS 1 and is not counted again as an elective', () => {
	const econ = plannerCourseList(UPLB_PROGRAMS.BSECON, null, UPLB_CATALOG);
	const hist = { code: 'HIST 1', title: 'Philippine History', units: 3 };
	const r = remainingRequirements(econ, [hist]);
	expect(r.fill.has('KAS 1')).toBe(true);
	expect(r.electives.doneUnits).toBe(0);
	const both = remainingRequirements(econ, [hist, { code: 'KAS 1', title: 'Kasaysayan ng Pilipinas', units: 3 }]);
	expect(both.fill.get('KAS 1')?.code).toBe('KAS 1');
});
