// Ported from the extension's curriculum.test.js (node assert) to vitest.
import { expect, test } from 'vitest';
import {
	countCompletedGE,
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

test('all 35 programs ship with a checklist', () => {
	const programs = Object.values(UPLB_PROGRAMS);
	expect(programs).toHaveLength(35);
	programs.forEach((p) => expect(p.majorCourses.length).toBeGreaterThan(0));
});
