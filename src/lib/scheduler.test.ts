// Ported from the extension's scheduler.test.js (node assert) to vitest.
import { expect, test } from 'vitest';
import {
	analyzeGraph,
	combineRequisites,
	computeSlips,
	enrichCourses,
	extractCode,
	offeredIn,
	parseRequisite,
	parseSemOffered,
	plannableCourses,
	scheduleEarliest,
	semAt,
	termLabel,
	type PlanCourse
} from './scheduler.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const eq = (a: unknown, b: unknown) => expect(a).toBe(b);
const deq = (a: unknown, b: unknown) => expect(a).toEqual(b);
const ok = (a: unknown) => expect(a).toBeTruthy();

test('scheduler: the extension self-check, assertion for assertion', () => {
const C = (code: string, units: number, sem?: string, prereqs: string[] = []): PlanCourse => ({ code, title: code, units, sem, prereqs });
	
	// Synthetic curriculum: A -> B -> C chain across alternating sems, D midyear-only.
	const COURSES = [
	  C('A', 3, '1'),
	  C('B', 3, '2', ['A']),
	  C('CC', 3, '1', ['B']),
	  C('D', 3, 'midyear'),
	  C('E', 3, '1'),
	];
	
	// helpers
	eq(semAt(0, '1'), '1');
	eq(semAt(1, '1'), '2');
	eq(semAt(2, '1'), 'midyear');
	eq(semAt(3, '1'), '1');
	eq(termLabel(0, 2026, '1'), '2026 1st Sem');
	eq(termLabel(1, 2026, '1'), '2027 2nd Sem');
	eq(termLabel(2, 2026, '1'), '2027 Midyear');
	eq(termLabel(3, 2026, '1'), '2027 1st Sem');
	eq(plannableCourses([C('GE 1', 3), C('Elective', 3)]).length, 1);
	
	// baseline: A,E @ t0; B @ t1; D @ t2 (midyear); CC @ t3 (next 1st sem)
	const r = scheduleEarliest({ courses: COURSES, passed: new Set(), startSem: '1' });
	eq(r.assignedTerm['A'], 0);
	eq(r.assignedTerm['E'], 0);
	eq(r.assignedTerm['B'], 1);
	eq(r.assignedTerm['D'], 2);
	eq(r.assignedTerm['CC'], 3);
	eq(r.gradTermIndex, 3);
	deq(r.unschedulable, []);
	
	// fail cascade: having passed A+B, failing B (removed from passed) pushes
	// CC from t0 to t3, a full offering cycle later.
	const withB = scheduleEarliest({ courses: COURSES, passed: new Set(['A', 'B']), startSem: '1' });
	eq(withB.assignedTerm['CC'], 0);
	const failB = scheduleEarliest({ courses: COURSES, passed: new Set(['A']), startSem: '1' });
	eq(failB.assignedTerm['B'], 1);
	eq(failB.assignedTerm['CC'], 3);
	
	// unit cap: only 6 units fit in 1st sem, third course waits for next 1st sem
	const capped = scheduleEarliest({
	  courses: [C('X1', 3, '1'), C('X2', 3, '1'), C('X3', 3, '1')],
	  passed: new Set(),
	  unitCaps: { '1': 6, '2': 21, 'midyear': 6 },
	  startSem: '1',
	});
	const t0Count = ['X1', 'X2', 'X3'].filter((c) => capped.assignedTerm[c] === 0).length;
	eq(t0Count, 2);
	eq(Math.max(...['X1', 'X2', 'X3'].map(c => capped.assignedTerm[c])), 3);
	
	// notBefore delay honored, and offering still respected (t3 is next 1st sem)
	const delayed = scheduleEarliest({ courses: [C('A', 3, '1')], passed: new Set(), notBefore: { A: 1 }, startSem: '1' });
	eq(delayed.assignedTerm['A'], 3);
	
	// unknown prereq dropped with a warning, course still schedules
	const unk = scheduleEarliest({ courses: [C('F', 3, '2', ['GHOST 1'])], passed: new Set(), startSem: '1' });
	eq(unk.assignedTerm['F'], 1);
	ok(unk.warnings.some(w => w.includes('GHOST 1')));
	
	// prereq cycle terminates and reports both as unschedulable
	const cyc = scheduleEarliest({
	  courses: [C('P', 3, '1', ['Q']), C('Q', 3, '1', ['P'])],
	  passed: new Set(),
	  startSem: '1',
	});
	deq(cyc.unschedulable.sort(), ['P', 'Q']);
	
	// critical path first under tight caps: chain head beats leaf course
	const crit = scheduleEarliest({
	  courses: [C('H1', 3, '1'), C('H2', 3, '2', ['H1']), C('H3', 3, '1', ['H2']), C('LEAF', 3, '1')],
	  passed: new Set(),
	  unitCaps: { '1': 3, '2': 21, 'midyear': 6 },
	  startSem: '1',
	});
	eq(crit.assignedTerm['H1'], 0); // chain of 3 outranks LEAF
	
	// --- requisite parser ---
	deq(parseRequisite('CMSC 12').pre, [['CMSC 12']]);
	deq(parseRequisite('(CMSC 57 and CMSC 21)').pre, [['CMSC 57'], ['CMSC 21']]);
	let pr = parseRequisite('ABT 101 or COI');
	deq(pr.pre, []);
	eq(pr.coi, true);
	pr = parseRequisite('IE 184 and Senior Standing');
	deq(pr.pre, [['IE 184']]);
	eq(pr.standing, 'senior');
	deq(parseRequisite('(PHYS 72) (OLD)').pre, [['PHYS 72']]);
	deq(parseRequisite('MATH 27 or Equivalent').pre, [['MATH 27']]);
	deq(parseRequisite('(CHEM 18 and CHEM 18.1.)').pre, [['CHEM 18'], ['CHEM 18.1']]);
	deq(parseRequisite('Hort 110 and COI').pre, [['HORT 110']]);
	deq(parseRequisite('-').pre, []);
	pr = parseRequisite('MATH 28 and COI and Junior Standing and Must have taken one ABE subject with laboratory');
	deq(pr.pre, [['MATH 28']]);
	eq(pr.standing, 'junior');
	ok(pr.note && pr.note.includes('ABE subject'));
	// several PRE rows are alternatives: OR of AND-sets becomes AND of OR-groups
	const comb = combineRequisites([
	  { req_type: 'PRE', req_courses: '(MATH 27 and MATH 20)' },
	  { req_type: 'PRE', req_courses: '(MATH 37 and AMAT 19)' },
	  { req_type: 'PRE', req_courses: '(MATH 27 and AMAT 19)' },
	  { req_type: 'PRE', req_courses: '(MATH 37 and MATH 20)' },
	  { req_type: 'CO', req_courses: '(CHEM 40.1)' },
	]);
	deq(comb.pre, [['MATH 27', 'MATH 37'], ['AMAT 19', 'MATH 20']]);
	deq(comb.co, ['CHEM 40.1']);
	eq(extractCode('3     ENSC 10.1. Engineering Graphics Laboratory'), 'ENSC 10.1');
	deq(parseSemOffered('1st, 2nd and Midyear'), { 1: true, 2: true, 3: true });
	
	// --- offering fallback: observed, then catalog sem_offered, then checklist ---
	eq(offeredIn(<any>{ offered: { 1: 0, 2: 3, 3: 0 }, catalogSem: '1s,2s', sem: '1' }, '1'), false);
	eq(offeredIn(<any>{ offered: { 1: 0, 2: 3, 3: 0 } }, '2'), true);
	eq(offeredIn(<any>{ offered: { 1: 0, 2: 0, 3: 0 }, catalogSem: '1s', sem: '2' }, '1'), true);
	eq(offeredIn(<any>{ offered: { 1: 0, 2: 0, 3: 0 }, catalogSem: '1s', sem: '2' }, '2'), false);
	// catalog says midyear but it was never observed: no midyear
	eq(offeredIn(<any>{ catalogSem: '1s,2s,M' }, 'midyear'), false);
	eq(offeredIn(<any>{ offered: { 1: 1, 2: 0, 3: 2 } }, 'midyear'), true);
	eq(offeredIn(<any>{ sem: '2' }, '1'), false);
	eq(offeredIn(<any>{}, '2'), true);
	
	// --- OR-groups, coreqs, standing, COI ---
	const K = (code: string, extra?: Partial<PlanCourse>): PlanCourse => ({ code, title: code, units: 3, offered: { 1: 1, 2: 1, 3: 0 }, pre: [], ...extra });
	let r2 = scheduleEarliest({
	  courses: [K('NEW1'), K('USE', { pre: [['OLD1', 'NEW1']] })],
	  passed: new Set(), startSem: '1',
	});
	eq(r2.assignedTerm.USE, 1); // OLD1 unknown, NEW1 satisfies the group
	r2 = scheduleEarliest({
	  courses: [K('LEC', { co: ['LAB'] }), K('LAB', { units: 1, co: ['LEC'] })],
	  passed: new Set(), startSem: '1',
	});
	eq(r2.assignedTerm.LEC, 0);
	eq(r2.assignedTerm.LAB, 0); // mutual coreqs share a term
	// senior standing: 75% of 12 units = 9 must be done first
	r2 = scheduleEarliest({
	  courses: [K('S1'), K('S2'), K('S3'), K('SEN', { standing: 'senior' })],
	  passed: new Set(), unitCaps: { 1: 21, 2: 21, midyear: 6 }, startSem: '1',
	});
	eq(r2.assignedTerm.SEN, 1);
	eq(r2.assignedTerm.S1, 0);
	// petition: a 2nd-sem-only course can go in 1st sem, flagged conditional
	r2 = scheduleEarliest({ courses: [K('P2', { offered: { 1: 0, 2: 3, 3: 0 }, petition: true })], passed: new Set(), startSem: '1' });
	eq(r2.assignedTerm.P2, 0);
	eq(r2.conditional.P2, true);
	
	// --- retake: fail at t0, notBefore t1, next 1st-sem-only offering is t3 ---
	const once = K('ONCE', { offered: { 1: 4, 2: 0, 3: 0 } });
	const firstTry = scheduleEarliest({ courses: [once], passed: new Set(), startSem: '1' });
	eq(firstTry.assignedTerm.ONCE, 0);
	const retake = scheduleEarliest({ courses: [once], passed: new Set(), notBefore: { ONCE: firstTry.assignedTerm.ONCE + 1 }, startSem: '1' });
	eq(retake.assignedTerm.ONCE, 3);
	
	// --- in-progress counts as passed, planning starts at the next term ---
	// latest AMIS term is 1st sem with MATH 27 ungraded: start at 2nd sem, MATH 28 at t0
	const inprog = scheduleEarliest({
	  courses: [K('MATH 27'), K('MATH 28', { pre: [['MATH 27']] })],
	  passed: new Set(['MATH 27']), startSem: '2',
	});
	eq(inprog.assignedTerm['MATH 28'], 0);
	eq(inprog.assignedTerm['MATH 27'], undefined);
	
	// --- delay and blocking factors on a small fixture ---
	//   A -> B -> D,  A -> C,  E alone
	const fx = [K('A'), K('B', { pre: [['A']] }), K('C', { pre: [['A']] }), K('D', { pre: [['B']] }), K('E')];
	const g = analyzeGraph(fx);
	eq(g.delay.A, 3);
	eq(g.delay.D, 3);
	eq(g.delay.C, 2);
	eq(g.delay.E, 1);
	eq(g.blocking.A, 3);
	eq(g.blocking.B, 1);
	eq(g.blocking.E, 0);
	deq(Array.from(g.ancestors('D')).sort(), ['A', 'B']);
	
	// --- slip: delaying a chain course moves graduation, a leaf with slack does not ---
	const slipOpts = { courses: fx, passed: new Set<string>(), startSem: '1' as const };
	const slips = computeSlips(slipOpts);
	ok(slips.A > 0 && slips.B > 0 && slips.D > 0);
	eq(slips.E, 0);
	eq(slips.C, 0);
	
	// --- enrichCourses: garbled checklist rows are salvaged, catalog wins ---
	const cat = { 'CHEM 18': { units: 3, title: 'University Chemistry', offered: { 1: 4, 2: 3, 3: 0 } },
	  'CE 151': { units: 3, title: 'Sanitary', offered: { 1: 4, 2: 0, 3: 0 }, pre: [['CHEM 18']] } };
	const en = enrichCourses([
	  { code: '3 CHEM 18. University Chemistry', title: '3 CHEM 18. University Chemistry 3 PI 10. Life of Rizal 3 Laboratory 3', units: 3, year: 2, sem: '2' },
	  { code: 'CE 151', title: 'x', units: 3, year: 3, sem: '1', prereqs: ['CE 999'] },
	  { code: '3', title: '3 3 3 20', units: 3, year: 2, sem: 'midyear' },
	  { code: 'GE', title: 'Elective', units: 3 }, { code: 'GE', title: 'Elective', units: 3 },
	], cat);
	deq(en.map(c => c.code), ['CHEM 18', 'PI 10', 'CE 151', 'GE', 'GE (2)']);
	deq(en.find(c => c.code === 'CE 151')!.pre, [['CHEM 18']]);
});
