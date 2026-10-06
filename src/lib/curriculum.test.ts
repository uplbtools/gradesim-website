// Ported from the extension's curriculum.test.js (node assert) to vitest.
import { expect, test } from 'vitest';
import { UPLB_CATALOG } from './catalog.ts';
import {
	countCompletedGE,
	detectTrack,
	getFreeElectiveUnits,
	getPlannerCourses,
	getProgramDataQuality,
	trackCourses,
	genericRequirementCourses,
	getCompletedRequirementSlotCodes,
	isGECourse,
	isNonGwaCourseCode,
	UPLB_PROGRAMS
} from './curriculum.ts';

test('GE and non-GWA detection', () => {
	expect(isGECourse('ARTS 1', 'Critical Perspectives in the Arts')).toBe(true);
	expect(isGECourse('GE 1', 'General Education')).toBe(true);
	expect(isGECourse('CMSC 12', 'Foundations of Computer Science')).toBe(false);
	expect(isNonGwaCourseCode('HK 11')).toBe(true);
	expect(isNonGwaCourseCode('NSTP 1')).toBe(true);
	expect(isNonGwaCourseCode('ARTS 1')).toBe(false);
	// Word boundary: PE 1 is out of the GWA, PEd majors are in.
	expect(isNonGwaCourseCode('PE 1')).toBe(true);
	expect(isNonGwaCourseCode('PED 91')).toBe(false);
});

const completed = [
	{ code: 'ARTS 1', title: 'Critical Perspectives in the Arts' },
	{ code: 'COMM 10', title: 'Critical Perspectives in Communication' },
	{ code: 'HK 11', title: 'Human Kinetics' },
	{ code: 'NSTP 1', title: 'National Service Training Program I' }
];

test('generic requirement slots fill from completed courses', () => {
	expect(countCompletedGE(completed)).toBe(2);

	const bscsSlots = genericRequirementCourses(UPLB_PROGRAMS.BSCS);
	expect(bscsSlots.filter((c) => c.genericRequirement === 'ge')).toHaveLength(9);
	expect(bscsSlots.filter((c) => c.genericRequirement === 'hk')).toHaveLength(2);
	expect(bscsSlots.filter((c) => c.genericRequirement === 'nstp')).toHaveLength(2);

	const done = getCompletedRequirementSlotCodes(completed, UPLB_PROGRAMS.BSCS);
	expect(done.has('GE 1')).toBe(true);
	expect(done.has('GE 2')).toBe(true);
	expect(done.has('GE 3')).toBe(false);
	expect(done.has('HK 1')).toBe(true);
	expect(done.has('HK 2')).toBe(false);
	expect(done.has('NSTP 1')).toBe(true);
	expect(done.has('NSTP 2')).toBe(false);

	const oneListedGE = {
		geCoursesRequired: 2,
		majorCourses: [{ code: 'ARTS 1', title: 'Critical Perspectives in the Arts', units: 3 }]
	};
	const listedOnly = getCompletedRequirementSlotCodes([{ code: 'ARTS 1', title: 'Critical Perspectives in the Arts' }], oneListedGE);
	expect(Array.from(listedOnly)).toEqual([]);
});

test('all 35 programs ship with a checklist, six of them coming soon', () => {
	const programs = Object.values(UPLB_PROGRAMS);
	expect(programs).toHaveLength(35);
	programs.forEach((p) => expect(p.majorCourses.length).toBeGreaterThan(0));
	expect(programs.filter((p) => !p.available).map((p) => p.code).sort()).toEqual(
		['AAENTREP', 'AAFOR', 'AASS', 'ASDC', 'BSMATE', 'BSMST']
	);
});

test('tracks: SP or thesis, never both, with track-sized free electives', () => {
	const BSCS = UPLB_PROGRAMS.BSCS;
	const codes = (list: { code: string }[]) => list.map((c) => c.code);
	const feUnits = (list: { genericRequirement?: string; units?: number }[]) =>
		list.filter((c) => c.genericRequirement === 'elective').reduce((s, c) => s + (c.units || 0), 0);
	const sp = getPlannerCourses(BSCS, 'sp');
	expect(codes(sp)).toContain('CMSC 190');
	expect(codes(sp)).not.toContain('CMSC 200');
	expect(feUnits(sp)).toBe(18);
	const thesis = getPlannerCourses(BSCS, 'thesis');
	expect(codes(thesis)).toContain('CMSC 200');
	expect(codes(thesis)).not.toContain('CMSC 190');
	expect(feUnits(thesis)).toBe(15);
	expect(codes(trackCourses(BSCS, undefined))).toContain('CMSC 190');
	expect(getFreeElectiveUnits(BSCS, 'thesis')).toBe(15);
	// Zero free elective units stay zero (BSAAE thesis).
	expect(getFreeElectiveUnits(UPLB_PROGRAMS.BSAAE, 'thesis')).toBe(0);

	expect(detectTrack(BSCS, [{ courseCode: 'CMSC 200', grade: null }])).toBe('thesis');
	expect(detectTrack(BSCS, [{ code: 'CMSC 190', grade: '' }])).toBe('sp');
	expect(detectTrack(BSCS, [{ courseCode: 'CMSC 200', grade: 'DRP' }])).toBeNull();
	expect(detectTrack(BSCS, [{ courseCode: 'CMSC 12', grade: '1.00' }])).toBeNull();
	expect(detectTrack(UPLB_PROGRAMS.BSAAE, [{ code: 'AAE 200A' }])).toBe('mfp');
});

test('data quality for the rough guide notice', () => {
	const good = getProgramDataQuality('BSCS', UPLB_CATALOG);
	expect(good.confident).toBe(true);
	expect(good.prereqShare).toBeGreaterThanOrEqual(0.3);
	expect(good.reasons).toEqual([]);
	const thin = getProgramDataQuality('BAPHILO', UPLB_CATALOG);
	expect(thin.confident).toBe(false);
	expect(thin.prereqShare).toBeLessThan(0.3);
	expect(thin.reasons).toHaveLength(1);
	expect(getProgramDataQuality('ASDC').confident).toBe(false);
	expect(getProgramDataQuality('NOPE').confident).toBe(false);
});
