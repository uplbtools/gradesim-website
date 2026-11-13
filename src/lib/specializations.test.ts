// Specializations from the CEM catalog, ported from the extension's
// curriculum-data.test.js, requirements.test.js and planner-sweep.test.js.
import { expect, test } from 'vitest';
import { UPLB_CATALOG } from './catalog.ts';
import { getPlannerCourses, isNonGwaCourseCode, normalizeCourseCode, UPLB_PROGRAMS } from './curriculum.ts';
import { modelFor } from './planner.ts';
import { plannerCourseList, remainingRequirements } from './requirements.ts';
import { enrichCourses, scheduleEarliest } from './scheduler.ts';

const withSpecs = Object.values(UPLB_PROGRAMS).filter((p) => p.specializations);

test('BS AAE, BS ABME and BS Economics list their catalog specializations', () => {
	expect(Object.keys(UPLB_PROGRAMS.BSAAE.specializations!)).toEqual(['pefm', 'amp', 'rfc', 'nre', 'fne']);
	expect(Object.keys(UPLB_PROGRAMS.BSABME.specializations!)).toEqual(['management', 'entrepreneurship']);
	expect(Object.keys(UPLB_PROGRAMS.BSECON.specializations!)).toEqual(['development', 'environmental']);
});

// These are in the catalog PDFs but had no AMIS class in the terms we have.
const NOT_IN_AMIS = new Set(['FRM 110', 'BIO 151', 'BIO 130A', 'BIO 130B', 'MCB 101', 'BOT 110', 'BOT 140', 'ZOO 140', 'ZOO 113', 'CHEM 102', 'PHYS 193.1', 'WLDL 101']);

test('every specialization course is real, not already required, and fills MAJ elective rows', () => {
	const checklist = new Set(Object.values(UPLB_PROGRAMS).flatMap((p) => (p.majorCourses || []).map((c) => normalizeCourseCode(c.code))));
	const failures: string[] = [];
	const units = (list: { units?: number }[]) => list.reduce((s, c) => s + (c.units || 0), 0);
	withSpecs.forEach((p) => {
		const rows = new Map(p.majorCourses.map((c) => [normalizeCourseCode(c.code), c]));
		const baseUnits = units(getPlannerCourses(p, p.defaultTrack));
		Object.entries(p.specializations!).forEach(([key, spec]) => {
			if (!/page \d+/.test(spec.source)) failures.push(`${p.code} ${key}: no catalog page`);
			const courseRows = spec.courses || [];
			courseRows.forEach((c) => {
				if (c.slot && rows.get(c.slot)?.genericRequirement !== 'elective') failures.push(`${p.code} ${key}: ${c.slot} is not a MAJ elective row`);
				if (!c.title || !(c.units! > 0) || !(c.year! >= 1) || !['1', '2', 'midyear'].includes(String(c.sem))) failures.push(`${p.code} ${key}: ${c.code} row is incomplete`);
			});
			const checkCourse = (code: string) => {
				if (!UPLB_CATALOG[code] && !checklist.has(code) && !NOT_IN_AMIS.has(code)) failures.push(`${p.code} ${key}: ${code} is in no catalog or checklist`);
				if (rows.has(code)) failures.push(`${p.code} ${key}: ${code} is already required`);
			};
			courseRows.forEach((c) => checkCourse(c.code));
			(spec.pools || []).forEach((pool) => {
				if (pool.courses.length < pool.slots.length) failures.push(`${p.code} ${key}: fewer courses than slots`);
				pool.slots.forEach((slot) => {
					if (rows.get(slot)?.genericRequirement !== 'elective') failures.push(`${p.code} ${key}: ${slot} is not a MAJ elective row`);
				});
				pool.courses.forEach(checkCourse);
			});
			const plan = getPlannerCourses(p, p.defaultTrack, key);
			const codes = plan.map((c) => normalizeCourseCode(c.code));
			if (new Set(codes).size !== codes.length) failures.push(`${p.code} ${key}: a course twice`);
			const added = courseRows.reduce((s, c) => s + (c.units || 0) - (c.slot ? rows.get(c.slot)?.units || 0 : 0), 0);
			if (units(plan) !== baseUnits + added) failures.push(`${p.code} ${key}: unit total changed`);
			const stated = Number((spec.note || '').match(/^(\d+) units in all/)?.[1]);
			const gwaUnits = units(plan.filter((c) => !isNonGwaCourseCode(c.code)));
			if (stated && gwaUnits !== stated) failures.push(`${p.code} ${key}: plans ${gwaUnits} units, the catalog says ${stated}`);
			const r = scheduleEarliest({
				courses: enrichCourses(plan, UPLB_CATALOG),
				passed: new Set(),
				useMidyear: false,
				totalUnits: p.totalUnitsRequired
			});
			if (r.unschedulable.length) failures.push(`${p.code} ${key}: cannot place ${r.unschedulable.join(', ')}`);
		});
	});
	expect(failures).toEqual([]);
});

test('a BS MST specialization adds its own courses to the plan', () => {
	const mst = UPLB_PROGRAMS.BSMST;
	expect(mst.available).toBe(true);
	expect(Object.keys(mst.specializations!)).toEqual(['biology', 'chemistry', 'mathematics', 'physics']);
	const codes = getPlannerCourses(mst, null, 'biology').map((c) => c.code);
	expect(codes).toEqual(expect.arrayContaining(['BOT 14', 'BIO 150', 'MCB 11', 'ZOO 14', 'HFDS 130']));
	expect(getPlannerCourses(mst, null).some((c) => c.code === 'BOT 14')).toBe(false);
});

test('a chosen field lists its pool on the slots and only pool courses fill them', () => {
	const aae = UPLB_PROGRAMS.BSAAE;
	const amp = plannerCourseList(aae, 'thesis', UPLB_CATALOG, 'amp');
	expect(amp.find((c) => c.code === 'MAJ 2')?.options).toEqual(['AGRI 41', 'FST 11']);
	const took = [
		{ code: 'AAE 125', title: 'Agricultural and Food Supply Chains', units: 3 },
		{ code: 'CMSC 12', title: 'Foundations', units: 3 }
	];
	const fill = remainingRequirements(amp, took).fill;
	expect(fill.get('MAJ 1')?.code).toBe('AAE 125');
	expect([...fill.values()].some((r) => r.code === 'CMSC 12')).toBe(false);
	// With no specialization picked, any course still fills a MAJ slot.
	expect(remainingRequirements(plannerCourseList(aae, 'thesis', UPLB_CATALOG), took).fill.size).toBe(2);
	// An unknown key changes nothing, and the model caches per specialization.
	expect(modelFor('BSAAE', 'thesis', 'nope')?.specialization).toBeNull();
	expect(modelFor('BSAAE', 'thesis', 'amp')?.specialization).toBe('amp');
});

test('a pool with one course per slot plans the real courses with prerequisites', () => {
	const abme = plannerCourseList(UPLB_PROGRAMS.BSABME, null, UPLB_CATALOG, 'entrepreneurship');
	expect(abme.some((c) => /^MAJ/.test(c.code))).toBe(false);
	expect(abme.find((c) => c.code === 'ABME 176')?.pre).toEqual([['ABME 174']]);
});

test('a BS AAE student who skipped AGRI 21 still has it left and planned', () => {
	const aae = UPLB_PROGRAMS.BSAAE;
	const courses = plannerCourseList(aae, 'thesis', UPLB_CATALOG);
	const firstYear = aae.majorCourses
		.filter((c) => c.year === 1 && c.code !== 'AGRI 21')
		.map((c) => ({ code: c.code, title: c.title || '', units: c.units || 0 }));
	const left = remainingRequirements(courses, firstYear);
	expect(left.left.some((c) => c.code === 'AGRI 21')).toBe(true);
	expect(left.left.some((c) => c.code === 'AGRI 31')).toBe(false);
	const plan = scheduleEarliest({ courses, passed: new Set(left.fill.keys()), startSem: '1', useMidyear: false, totalUnits: aae.totalUnitsRequired });
	expect(plan.assignedTerm['AGRI 21']).toBeDefined();
});
