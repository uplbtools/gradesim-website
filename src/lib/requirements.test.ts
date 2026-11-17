// Ported from the extension's requirements.test.js and planner-sweep.test.js.
// The What if tab and the planner count the same courses left, and the GWA
// outlook math matches the extension.
import { expect, test } from 'vitest';
import { UPLB_CATALOG } from './catalog.ts';
import { getPlannerCourses, isNonGwaCourseCode, UPLB_PROGRAMS } from './curriculum.ts';
import type { GradesData } from './grades.ts';
import { compute, DEFAULT_PLANNER_OPTIONS, markConflict, modelFor } from './planner.ts';
import { amisCourses, applyRemovals, fillRequirementSlots, gradeResult, gwaOutlook, plannerCourseList, remainingRequirements, removalKey, surplusElectives, unlistedCourses } from './requirements.ts';
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
	expect(left.units - left.gwaUnits).toBe(3 * 2 + 3);
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

test('honors count only the required electives, the earliest first', () => {
	const list = plannerCourseList(BSCS, 'sp', UPLB_CATALOG);
	const feSlots = list.filter((c) => /^FE\b/.test(c.code)).length;
	const extra = Array.from({ length: feSlots + 2 }, (_, i) => ({ code: `SOC ${100 + i}`, title: 'Elective', units: 3, grade: '1.00', result: 'passed', termId: String(1231 + i) }));
	const named = { code: 'CMSC 12', title: 'Foundations of Computer Science', units: 3, grade: '1.00', result: 'passed', termId: '1231' };
	expect(surplusElectives(list, [named, ...extra]).map((r) => r.code)).toEqual(extra.slice(-2).map((r) => r.code));
	expect(surplusElectives(list, [named, ...extra.slice(0, feSlots)])).toEqual([]);
	expect(surplusElectives(list.filter((c) => c.genericRequirement !== 'elective'), extra)).toEqual([]);
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

test('BSCS special problem twice, midyear practicum and electives with no standing', () => {
	const sp = plannerCourseList(BSCS, 'sp', UPLB_CATALOG);
	const gwaUnits = sp.filter((c) => !isNonGwaCourseCode(c.code)).reduce((s, c) => s + c.units, 0);
	expect(gwaUnits).toBe(BSCS.totalUnitsRequired);
	const thesis = plannerCourseList(BSCS, 'thesis', UPLB_CATALOG);
	expect(thesis.filter((c) => /^CMSC 200/.test(c.code)).map((c) => c.units)).toEqual([3, 3]);
	expect(thesis.filter((c) => !isNonGwaCourseCode(c.code)).reduce((s, c) => s + c.units, 0)).toBe(130);

	const fresh = scheduleEarliest({ courses: sp, passed: new Set(), useMidyear: false, totalUnits: 130 });
	expect(fresh.plan.find((t) => t.courses.includes('CMSC 198'))!.sem).toBe('midyear');
	const firstFE = Math.min(...sp.filter((c) => /^FE/.test(c.code)).map((c) => fresh.assignedTerm[c.code]));
	expect(firstFE).toBeLessThan(9);

	// CMSC 56 failed with CMSC 57 passed, the practicum, and a second CMSC 190 being taken now.
	const taken: GradesData = {
		student_grades: {
			1231: { values: [v('CMSC 56', 'Discrete I', 3, '5.00'), v('CMSC 12', 'Foundations', 3, '1.50')] },
			1232: { values: [v('CMSC 57', 'Discrete II', 3, '2.00')] },
			1253: { values: [v('CMSC 198', 'Practicum', 3, 'S')] },
			1261: { values: [v('CMSC 190', 'Special Problem', 1, '1.50')] },
			1262: { values: [v('CMSC 190', 'Special Problem', 2, null)] }
		}
	};
	const view = compute(
		modelFor('BSCS', 'sp')!,
		{ gradesData: taken, substitutions: {}, customCourseStatus: {}, plannerPins: {}, plannerPetitions: {}, plannerOptions: DEFAULT_PLANNER_OPTIONS, whatif: null },
		new Date(2027, 1, 1)
	);
	expect(view.info['CMSC 190'].status).toBe('passed');
	expect(view.info['CMSC 190 (2)'].status).toBe('inprogress');
	expect(view.info['CMSC 198'].status).toBe('passed');
	expect(view.info['FE 1'].status).toBe('todo');
	expect(view.conflicts).toEqual([{ code: 'CMSC 57', pre: 'CMSC 56' }]);
});

test('HK 12 taken for three sports fills three HK slots', () => {
	const sp = plannerCourseList(BSCS, 'sp', UPLB_CATALOG);
	const row = (code: string) => ({ code, title: '', units: 2, result: 'passed' as const });
	const filled = fillRequirementSlots(sp, [row('HK 11'), row('HK 12'), row('HK 12'), row('HK 12')]);
	expect(['HK 1', 'HK 2', 'HK 3', 'HK 4'].every((c) => filled.has(c))).toBe(true);
});

test('a restricted elective takes only the subjects its title names', () => {
	const comm = plannerCourseList(UPLB_PROGRAMS.BACOMM, null, UPLB_CATALOG);
	const slot = (title: string) => comm.find((c) => c.title === title)!.code;
	const row = (code: string) => ({ code, title: '', units: 3, result: 'passed' as const });
	const filled = fillRequirementSlots(comm, [row('PHLO 171'), row('FRCH 10'), row('STAT 166')]);
	expect(filled.get(slot('Elective (Foreign Language)'))?.code).toBe('FRCH 10');
	expect(filled.get(slot('Elective (SOSC or PHLO)'))?.code).toBe('PHLO 171');
	expect(filled.get(slot('Elective (STAT)'))?.code).toBe('STAT 166');
	expect(fillRequirementSlots(comm, [row('PHLO 171')]).has(slot('Elective (Foreign Language)'))).toBe(false);
});

test('a mark that would fail the prerequisite of a passed course, or pass a course after a failed prerequisite, is refused', () => {
	const taken: GradesData = {
		student_grades: {
			1231: { values: [v('CMSC 56', 'Discrete I', 3, '2.00'), v('CMSC 12', 'Foundations', 3, '5.00')] },
			1232: { values: [v('CMSC 57', 'Discrete II', 3, '2.00')] }
		}
	};
	const view = compute(
		modelFor('BSCS', 'sp')!,
		{ gradesData: taken, substitutions: {}, customCourseStatus: {}, plannerPins: {}, plannerPetitions: {}, plannerOptions: DEFAULT_PLANNER_OPTIONS, whatif: null },
		new Date(2027, 1, 1)
	);
	expect(markConflict(view, 'CMSC 56', 'failed')).toEqual({ code: 'CMSC 57', pre: 'CMSC 56' });
	expect(markConflict(view, 'CMSC 21', 'passed')).toEqual({ code: 'CMSC 21', pre: 'CMSC 12' });
	expect(markConflict(view, 'CMSC 57', 'failed')).toBeUndefined();
	expect(markConflict(view, 'MATH 27', 'passed')).toBeUndefined();
});

test('a 4.00 removal exam: a pass gives 3.00, a fail gives 5.00, other grades stay', () => {
	const fours: GradesData = {
		student_grades: { '1251': { values: [v('MATH 27', '', 3, '4.00'), v('CHEM 18', '', 3, '4.00'), v('STS 1', '', 3, '2.00')] } }
	};
	const removed = applyRemovals(fours, {
		[removalKey('1251', 'math 27')]: 'pass',
		[removalKey('1251', 'CHEM 18')]: 'fail',
		[removalKey('1251', 'STS 1')]: 'fail'
	});
	expect(amisCourses(removed).map((r) => [r.code, r.grade, r.result])).toEqual([
		['MATH 27', '3.00', 'passed'],
		['CHEM 18', '5.00', 'failed'],
		['STS 1', '2.00', 'passed']
	]);
	expect(fours.student_grades['1251'].values[0].grade).toBe('4.00');
	expect(applyRemovals(fours, {})).toBe(fours);
});

test('an either-or checklist line takes the other course, and a second one is an elective', () => {
	const row = (code: string) => ({ code, title: '', units: 3, result: 'passed' as const });
	const he = plannerCourseList(UPLB_PROGRAMS.BSHE, null, UPLB_CATALOG);
	const thesis = fillRequirementSlots(he, [row('HFDS 200'), row('HFDS 200')]);
	expect(thesis.has('CERP 200') && thesis.has('CERP 200 (2)')).toBe(true);
	const socio = plannerCourseList(UPLB_PROGRAMS.BASOCIO, null, UPLB_CATALOG);
	const both = fillRequirementSlots(socio, [row('SOC 135'), row('SOC 130')]);
	expect(both.get('SOC 130')?.code).toBe('SOC 130');
	expect([...both.values()].some((r) => r.code === 'SOC 135')).toBe(true);
});

test('unlisted courses are the ones an open slot may have taken', () => {
	const stat = plannerCourseList(UPLB_PROGRAMS.BSSTAT, null, UPLB_CATALOG);
	const named = stat.find((c) => !c.genericRequirement && c.code.startsWith('STAT '))!.code;
	const row = (code: string, result: 'passed' | 'failed' | 'nograde' = 'passed', units = 3) => ({ code, title: '', units, result });
	const rows = [row(named), row('ECON 130'), row('ECON 130'), row('MGT 111', 'nograde'), row('ECON 131', 'failed'), row('HK 11', 'passed', 2), row('ARTS 1'), row('NSTP 1')];
	expect(unlistedCourses(stat, rows)).toEqual(['ECON 130', 'MGT 111']);
});
