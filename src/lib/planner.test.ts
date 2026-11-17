import { expect, test } from 'vitest';
import backup from './fixtures/backup.json';
import type { GradesData } from './grades.ts';
import {
	absLabel,
	absOfAmisTerm,
	amisTerm,
	roomTbaLink,
	takeCourses,
	buildColumns,
	calendarAbs,
	cardFacts,
	columnFacts,
	compute,
	DEFAULT_PLANNER_OPTIONS,
	modelFor,
	optionEffect,
	whatIfMessage,
	summary,
	type PlannerInput
} from './planner.ts';
import { gradeResult } from './requirements.ts';

const now = new Date(2024, 9, 1); // October 2024: 1st sem AY 2024-25 is underway
const model = modelFor('BSCS')!;
const input = (over: Partial<PlannerInput> = {}): PlannerInput => ({
	gradesData: backup.gradesData as GradesData,
	substitutions: {},
	customCourseStatus: {},
	plannerPins: {},
	plannerPetitions: {},
	plannerOptions: DEFAULT_PLANNER_OPTIONS,
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
		const v = compute(m, { ...input(), gradesData: null, plannerOptions: DEFAULT_PLANNER_OPTIONS }, now);
		expect(buildColumns(v).list.length).toBeGreaterThan(0);
	}
});

test('a term of 18 units plus HK and NSTP is not an overload', () => {
	const m = modelFor('BACOMM')!;
	const v = compute(m, { ...input(), gradesData: null, plannerOptions: DEFAULT_PLANNER_OPTIONS }, now);
	const cols = buildColumns(v).list.map((c) => ({ c, f: columnFacts(c, v) }));
	expect(cols.some(({ c }) => c.cards.some((k) => /^(HK|NSTP)\b/.test(k.code)))).toBe(true);
	cols.forEach(({ f }) => expect(f.warn).toBe(''));
});

test('the checklist load lets a blank BS EE plan take its prescribed heavy sems', () => {
	const m = modelFor('BSEE')!;
	const facts = (cap: 18 | 'checklist') => {
		const v = compute(m, { ...input(), gradesData: null, plannerOptions: { ...DEFAULT_PLANNER_OPTIONS, cap } }, now);
		return buildColumns(v).list.map((c) => columnFacts(c, v));
	};
	expect(Math.max(...facts(18).map((f) => f.units))).toBeLessThanOrEqual(18);
	const byChecklist = facts('checklist');
	expect(byChecklist.some((f) => f.units > 18 && f.warn === 'Over 18 units, which the checklist puts in this sem.')).toBe(true);
	expect(byChecklist.every((f) => !f.loud || f.isMid)).toBe(true);
});

test('a setting says what it does to graduation, and a sem under the minimum load is marked', () => {
	const m = modelFor('BSEE')!;
	const blank = (o = {}) => compute(m, { ...input(), gradesData: null, plannerOptions: { ...DEFAULT_PLANNER_OPTIONS, ...o } }, now);
	const v = blank();
	expect(optionEffect(v, { cap: 18 }, now)).toBe('your graduation sem stays the same.');
	expect(optionEffect(v, { cap: 'checklist' }, now)).toMatch(/^you'd graduate .+, which is earlier\.$/);
	const warns = (w: typeof v) => buildColumns(w).list.map((c) => columnFacts(c, w).warn);
	expect(warns(v).some((x) => x.startsWith('Under'))).toBe(false);
	expect(warns(blank({ minLoad: 18 }))).toContain('Under your 18-unit minimum.');
});

test('a what-if fail on a course already failed reports what that failure costs', () => {
	const v = compute(model, input({ whatif: { code: 'MATH 27', mode: 'fail' } }), now);
	expect(whatIfMessage(v)).toMatch(/^MATH 27 is failed on your record/);
});

test('free elective cards are never critical', () => {
	const v = compute(model, input(), now);
	const { primary } = buildColumns(v);
	const fe = Object.values(primary).filter((c) => /^FE /.test(c.code));
	expect(fe.length).toBeGreaterThan(0);
	fe.forEach((card) => expect(cardFacts(card, v).crit).toBe(false));
});

test('the plan follows the track: SP keeps CMSC 190 and 18 free elective units', () => {
	const sp = modelFor('BSCS', 'sp')!;
	const thesis = modelFor('BSCS', 'thesis')!;
	expect(sp.byCode.has('CMSC 190') && !sp.byCode.has('CMSC 200')).toBe(true);
	expect(thesis.byCode.has('CMSC 200') && !thesis.byCode.has('CMSC 190')).toBe(true);
	const fe = (m: typeof sp) => m.courses.filter((c) => /^FE /.test(c.code)).reduce((s, c) => s + c.units, 0);
	expect([fe(sp), fe(thesis)]).toEqual([18, 15]);
});

test('Room TBA link converts AMIS term ids both ways', () => {
	expect(absOfAmisTerm(1261)).toBe(2026 * 3);
	expect(absOfAmisTerm(1253)).toBe(2025 * 3 + 2);
	[1241, 1252, 1253, 1261].forEach((id) => expect(amisTerm(absOfAmisTerm(id))).toBe(id));
});

test('Room TBA link packs one row per course with no section or type', () => {
	const url = new URL(roomTbaLink(2026 * 3, ['CMSC 190', 'CMSC 190 (2)', 'STAT 101'], 'BSCS'));
	const plan = JSON.parse(atob(url.searchParams.get('plan')!.replace(/-/g, '+').replace(/_/g, '/')));
	expect(url.origin + url.pathname).toBe('https://room-tba.uplb.tools/planner');
	expect(url.searchParams.get('program')).toBe('BSCS');
	expect(plan).toEqual({ v: 1, t: 1261, s: [['CMSC 190', '', ''], ['STAT 101', '', '']] });
});

test('Room TBA link marks courses in progress in a sem that started and moves them in a later one', () => {
	const now = new Date(2026, 8, 1);
	const s = { customCourseStatus: {}, plannerPins: { 'MATH 27': 2026 * 3 } };
	expect(takeCourses(['CMSC 21'], 2026 * 3, s, now)).toEqual({ customCourseStatus: { 'CMSC 21': 'inprogress' }, plannerPins: { 'MATH 27': 2026 * 3 } });
	expect(takeCourses(['CMSC 21'], 2026 * 3 + 1, s, now).plannerPins).toEqual({ 'MATH 27': 2026 * 3, 'CMSC 21': 2026 * 3 + 1 });
	expect(s.plannerPins).toEqual({ 'MATH 27': 2026 * 3 });
});

test('a sem off stays empty and moves graduation later', () => {
	const base = compute(model, input(), now);
	const off = base.startAbs;
	const v = compute(model, input({ plannerOptions: { ...DEFAULT_PLANNER_OPTIONS, skip: [off] } }), now);
	expect(v.now.result.plan.some((p) => p.termIndex === 0)).toBe(false);
	expect(v.now.result.gradTermIndex).toBeGreaterThan(base.now.result.gradTermIndex);
	expect(buildColumns(v).list.find((c) => c.abs === off)?.cards).toEqual([]);
});

test('the sem that has started is Now, and a course marked as taken now sits in it', () => {
	const later = new Date(2025, 9, 1);
	const base = compute(model, input(), later);
	expect(base.startAbs).toBe(2025 * 3);
	const cols = buildColumns(base).list;
	expect(columnFacts(cols.find((c) => c.abs === base.startAbs)!, base).tag).toBe('Now');
	const r = base.now.result;
	const code = Object.keys(r.assignedTerm).find((c) => r.assignedTerm[c] === 0 && model.graph.edges.some((e) => e.from === c))!;
	const deps = model.graph.edges.filter((e) => e.from === code).map((e) => e.to);
	const v = compute(model, input({ customCourseStatus: { [code]: 'inprogress' } }), later);
	const col = buildColumns(v).list.find((c) => c.abs === v.startAbs)!;
	expect(col.cards.find((c) => c.code === code)?.status).toBe('inprogress');
	deps.forEach((d) => expect(v.now.result.assignedTerm[d]).not.toBe(0));
});
