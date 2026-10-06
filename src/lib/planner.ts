// Course planner logic, ported from the extension (extension/src/planner.js).
// Everything here is pure: Planner.svelte renders what these return.

import { UPLB_CATALOG } from './catalog.ts';
import { detectTrack, resolveSpecialization, resolveTrack, UPLB_PROGRAMS, type Program } from './curriculum.ts';
import { ayOfAbs, termKeyToAbs, type GradesData } from './grades.ts';
import {
	amisCourses,
	fillRequirementSlots,
	gradeResult,
	plannerCourseList,
	remainingRequirements,
	type Result as GradeResult
} from './requirements.ts';
import {
	analyzeGraph,
	computeSlips,
	normCode,
	offeredIn,
	preGroups,
	scheduleEarliest,
	type Graph,
	type PlanCourse,
	type ScheduleOptions,
	type ScheduleResult,
	type Sem
} from './scheduler.ts';

/* ---------- Terms ---------- */

const SEMS: Sem[] = ['1', '2', 'midyear'];
export const semOfAbs = (abs: number) => SEMS[abs % 3];

export function absLabel(abs: number): string {
	const ay = Math.floor(abs / 3);
	const s = abs % 3;
	if (s === 0) return `1st sem ${ay}`;
	if (s === 1) return `2nd sem ${ay + 1}`;
	return `Midyear ${ay + 1}`;
}
export const ayLabel = ayOfAbs;

// ponytail: month heuristic for the current term (Aug-Dec 1st, Jan-May 2nd,
// Jun-Jul midyear). Only used when grades are older than the calendar.
export function calendarAbs(now = new Date()): number {
	const y = now.getFullYear();
	const m = now.getMonth() + 1;
	if (m >= 8) return y * 3;
	if (m <= 5) return (y - 1) * 3 + 1;
	return (y - 1) * 3 + 2;
}

/* ---------- Inputs ---------- */

export type CourseStatus = 'passed' | 'failed' | 'planned' | 'inprogress';
export type WhatIfMode = 'fail' | '1' | '3';

export interface PlannerOptions {
	cap: number;
	midyear: boolean;
	midyear9: boolean;
}

export interface PlannerInput {
	gradesData: GradesData | null;
	substitutions: Record<string, string>;
	customCourseStatus: Record<string, CourseStatus>;
	plannerPins: Record<string, number>;
	plannerPetitions: Record<string, true>;
	plannerOptions: PlannerOptions;
	whatif: { code: string; mode: WhatIfMode } | null;
}

export interface Model {
	code: string;
	program: Program;
	/** The track the plan follows, or null for programs without tracks. */
	track: string | null;
	/** The specialization key the plan follows, or null. */
	specialization: string | null;
	courses: PlanCourse[];
	byCode: Map<string, PlanCourse>;
	graph: Graph;
}

/** 18 units a sem unless the student picks 21 in Plan options. */
export const DEFAULT_PLANNER_OPTIONS: PlannerOptions = { cap: 18, midyear: false, midyear9: false };

/**
 * The track a plan follows. An SP or thesis course on record (passed, failed
 * or being taken now) wins, then the track the student picked, then the
 * program default.
 */
export function planTrack(program: Program, gradesData: GradesData | null | undefined, chosen: string | null): string | null {
	return detectTrack(program, amisCourses(gradesData)) || resolveTrack(program, chosen);
}

const models = new Map<string, Model>();

/** The program's courses for a track and specialization merged with the catalog, plus its prerequisite graph. Cached per program, track and specialization. */
export function modelFor(code: string, chosenTrack: string | null = null, chosenSpecialization: string | null = null): Model | null {
	const program = UPLB_PROGRAMS[code];
	if (!program || !program.majorCourses) return null;
	const track = resolveTrack(program, chosenTrack);
	const specialization = resolveSpecialization(program, chosenSpecialization);
	const key = `${code}:${track}:${specialization}`;
	if (!models.has(key)) {
		const courses = plannerCourseList(program, track, UPLB_CATALOG, specialization);
		models.set(key, {
			code,
			program,
			track,
			specialization,
			courses,
			byCode: new Map(courses.map((c) => [c.code, c])),
			graph: analyzeGraph(courses)
		});
	}
	return models.get(key)!;
}

/* ---------- Grade history ---------- */

type Result = GradeResult | 'inprogress';

export interface Attempt {
	code: string;
	title: string;
	units: number;
	result: Result;
	abs: number;
	order: number;
	via?: string;
}

export function readHistory(model: Model, input: PlannerInput, now = new Date()) {
	const sg = input.gradesData?.student_grades || {};
	const attempts: (Omit<Attempt, 'abs'> & { abs: number | null })[] = [];
	Object.keys(sg).forEach((key, i) => {
		const termData = sg[key];
		if (!termData || !Array.isArray(termData.values)) return;
		// Real ids map to calendar terms; anything else keeps its order.
		const abs = termKeyToAbs(key);
		termData.values.forEach((v) => {
			const code = normCode(v.course && v.course.course_code);
			if (!code) return;
			attempts.push({
				code,
				title: (v.course && v.course.title) || '',
				units: parseFloat(String(v.unit_taken)) || 0,
				result: gradeResult(v.grade),
				abs,
				order: i
			});
		});
	});
	// Unknown ids: lay them out as consecutive regular sems ending last term.
	if (attempts.some((a) => a.abs == null)) {
		const orders = Array.from(new Set(attempts.filter((a) => a.abs == null).map((a) => a.order))).sort((a, b) => a - b);
		let abs = calendarAbs(now) - 1;
		const absOf: Record<number, number> = {};
		for (let i = orders.length - 1; i >= 0; i--) {
			if (abs % 3 === 2) abs--;
			absOf[orders[i]] = abs--;
		}
		attempts.forEach((a) => {
			if (a.abs == null) a.abs = absOf[a.order];
		});
	}
	const list = attempts as Attempt[];
	const latestAbs = list.length ? Math.max(...list.map((a) => a.abs)) : null;
	list.forEach((a) => {
		if (a.result === 'nograde') a.result = a.abs === latestAbs ? 'inprogress' : 'other';
	});
	list.sort((a, b) => a.abs - b.abs);

	// Curriculum code to attempts, including GE, HK, NSTP and elective slots and substitutions.
	const byCurr: Record<string, Attempt[]> = {};
	const push = (code: string, a: Attempt) => {
		(byCurr[code] = byCurr[code] || []).push(a);
	};
	list.forEach((a) => {
		if (model.byCode.has(a.code)) push(a.code, a);
	});

	// Slots filled the same way the What if tab counts them.
	const doneOrNow = list.filter((a) => a.result === 'passed' || a.result === 'inprogress');
	fillRequirementSlots(model.courses, doneOrNow, input.substitutions).forEach((a, slot) => {
		if (a.code !== slot && model.byCode.has(slot)) push(slot, { ...a, via: a.code });
	});

	return { attempts: list, byCurr, latestAbs, passedOutside: new Set(doneOrNow.map((a) => a.code)) };
}

/* ---------- Planning ---------- */

interface Failure {
	code: string;
	past: boolean;
	source: 'marked' | 'amis' | 'whatif';
}

interface Run {
	result: ScheduleResult;
	runOpts: ScheduleOptions;
	attemptAt: Record<string, number>;
	passed: Set<string>;
}

export interface CourseInfo {
	tries: Attempt[];
	auto: 'todo' | 'passed' | 'inprogress' | 'failed';
	override?: CourseStatus;
	status: string;
}

export function compute(model: Model, input: PlannerInput, now = new Date()) {
	const opts = input.plannerOptions;
	const hist = readHistory(model, input, now);
	const startAbs = Math.max(hist.latestAbs != null ? hist.latestAbs + 1 : 0, calendarAbs(now));

	// Per course: what the grades say, then any manual override.
	const info: Record<string, CourseInfo> = {};
	model.courses.forEach((c) => {
		const tries = hist.byCurr[c.code] || [];
		const last = tries[tries.length - 1];
		let auto: CourseInfo['auto'] = 'todo';
		if (tries.some((a) => a.result === 'passed')) auto = 'passed';
		else if (last && last.result === 'inprogress') auto = 'inprogress';
		else if (tries.some((a) => a.result === 'failed')) auto = 'failed';
		const override = input.customCourseStatus[c.code];
		const status = override === 'planned' ? 'todo' : override || auto;
		info[c.code] = { tries, auto, override, status };
	});

	const passed = new Set(hist.passedOutside);
	model.courses.forEach((c) => {
		const st = info[c.code].status;
		if (st === 'passed' || st === 'inprogress') passed.add(c.code);
		else passed.delete(c.code);
	});

	// Failures: past ones (an attempt on record or the course being taken now)
	// just aren't passed; future ones (marked on a course not yet taken, or the
	// what-if) are taken in their planned term, failed, and retaken later.
	const failures: Failure[] = [];
	model.courses.forEach((c) => {
		const i = info[c.code];
		if (i.status !== 'failed') return;
		failures.push({ code: c.code, past: i.tries.length > 0, source: i.override ? 'marked' : 'amis' });
	});
	const wi = input.whatif;
	if (wi && wi.mode === 'fail' && !passed.has(wi.code) && !failures.some((f) => f.code === wi.code)) {
		failures.push({ code: wi.code, past: false, source: 'whatif' });
	}

	const unitCaps = { '1': Number(opts.cap), '2': Number(opts.cap), midyear: opts.midyear9 ? 9 : 6 };
	const baseOpts = {
		courses: model.courses.map((c) => ({ ...c, petition: !!input.plannerPetitions[c.code] })),
		startSem: semOfAbs(startAbs),
		unitCaps,
		useMidyear: !!opts.midyear,
		totalUnits: Number(model.program.totalUnitsRequired) || undefined
	};
	const pinNotBefore: Record<string, number> = {};
	Object.entries(input.plannerPins).forEach(([code, abs]) => {
		if (abs > startAbs) pinNotBefore[code] = abs - startAbs;
	});

	// Run with a subset of failures in effect.
	function run(active: Failure[], applyDelay = true): Run {
		const p = new Set(passed);
		failures.forEach((f) => {
			if (f.past && !active.includes(f)) p.add(f.code);
		});
		const notBefore = { ...pinNotBefore };
		const reserved: Record<number, number> = {};
		const attemptAt: Record<string, number> = {};
		const future = failures.filter((f) => !f.past && active.includes(f));
		if (future.length) {
			const clean = scheduleEarliest({ ...baseOpts, passed: p, notBefore });
			future.forEach((f) => {
				const t = clean.assignedTerm[f.code];
				if (t === undefined) return;
				attemptAt[f.code] = t;
				notBefore[f.code] = Math.max(notBefore[f.code] || 0, t + 1);
				reserved[t] = (reserved[t] || 0) + (Number(model.byCode.get(f.code)!.units) || 3);
			});
		}
		if (applyDelay && wi && wi.mode !== 'fail') {
			const clean = scheduleEarliest({ ...baseOpts, passed: p, notBefore });
			const t = clean.assignedTerm[wi.code];
			if (t !== undefined) notBefore[wi.code] = Math.max(notBefore[wi.code] || 0, t + Number(wi.mode));
		}
		const runOpts = { ...baseOpts, passed: p, notBefore, reserved };
		return { result: scheduleEarliest(runOpts), runOpts, attemptAt, passed: p };
	}

	const nowRun = run(failures);
	const ideal = failures.length ? run([]) : nowRun;
	const costs = failures.map((f) => {
		const without = run(failures.filter((x) => x !== f));
		return { ...f, costT: [without.result.gradTermIndex, nowRun.result.gradTermIndex] as [number, number], cost: 0 };
	});
	// Baseline with the what-if removed, for the "what changed" message.
	const noWhatif = wi ? run(failures.filter((f) => f.source !== 'whatif'), false) : null;
	const slips = computeSlips(nowRun.runOpts, nowRun.result);
	// Same count as the What if tab: passed courses plus manual marks.
	const left = remainingRequirements(
		model.courses,
		hist.attempts.filter((a) => a.result === 'passed'),
		{ substitutions: input.substitutions, overrides: input.customCourseStatus }
	);

	const v = { model, input, hist, info, startAbs, passed: nowRun.passed, failures, costs, now: nowRun, ideal, noWhatif, slips, unitCaps, left };
	v.costs.forEach((c) => {
		c.cost = termsLate(v, c.costT[0], c.costT[1]);
	});
	return v;
}

export type View = ReturnType<typeof compute>;

/** "N terms later" counted in terms the student would attend: midyears count only when the plan uses them. */
export function termsLate(v: Pick<View, 'startAbs' | 'input'>, fromT: number, toT: number): number {
	let n = 0;
	for (let t = fromT + 1; t <= toT; t++) {
		if ((v.startAbs + t) % 3 !== 2 || v.input.plannerOptions.midyear) n++;
	}
	return n;
}
export const termsText = (n: number) => `${n} term${n === 1 ? '' : 's'}`;
export const unitsText = (n: number) => `${n} unit${n === 1 ? '' : 's'}`;

/* ---------- Summary ---------- */

export function summary(v: View) {
	const r = v.now.result;
	const gradAbs = r.gradTermIndex >= 0 ? v.startAbs + r.gradTermIndex : null;
	const headline =
		gradAbs == null
			? r.unschedulable.length
				? 'Some courses cannot be placed'
				: 'All planned requirements done'
			: `Graduate ${absLabel(gradAbs)}`;

	const delta = termsLate(v, v.ideal.result.gradTermIndex, r.gradTermIndex);
	let deltaText = '';
	let deltaOk = false;
	if (v.failures.length && delta > 0) {
		const culprits = v.costs.filter((c) => c.cost > 0);
		const one = culprits.length === 1 ? culprits[0] : v.failures.length === 1 ? v.failures[0] : null;
		const why = one
			? `because ${one.code} ${one.source === 'whatif' ? 'is failed in this what-if' : 'failed'}`
			: `because of ${v.failures.length} failed courses`;
		deltaText = `+${termsText(delta)} ${why}`;
	} else if (v.failures.length) {
		deltaText = `No delay from ${v.failures.length === 1 ? v.failures[0].code : 'your failed courses'}`;
		deltaOk = true;
	}

	const termsLeft = r.plan.filter((p) => p.courses.length).length;
	const nowTaking = Object.values(v.info).some((i) => i.status === 'inprogress');
	const sentences: string[] = [];
	if (gradAbs != null)
		sentences.push(`That is ${ayLabel(gradAbs)}, with ${termsText(termsLeft)} of classes from ${absLabel(v.startAbs)}.`);
	sentences.push(`You have ${unitsText(v.left.units)} left to pass${nowTaking ? ', counting this term' : ''}.`);
	sentences.push(
		`The plan takes up to ${v.unitCaps['1']} units a sem and ${v.input.plannerOptions.midyear ? `up to ${v.unitCaps.midyear} in midyear` : 'midyear only where the checklist puts it'}.`
	);
	const sub = sentences.join(' ');

	const showCosts = v.costs.length > 1 || (v.costs.length === 1 && v.costs[0].source !== 'whatif');
	return { headline, deltaText, deltaOk, sub, costs: showCosts ? v.costs : [] };
}

/* ---------- Cards and columns ---------- */

export function offeringLabel(c: PlanCourse): string {
	const o1 = offeredIn(c, '1');
	const o2 = offeredIn(c, '2');
	const off = c.offered as Record<number, number> | null | undefined;
	const om = off ? off[3] > 0 : c.sem === 'midyear';
	let base = o1 && o2 ? 'Any sem' : o1 ? '1st only' : o2 ? '2nd only' : om ? 'Midyear' : 'Not seen';
	if (om && (o1 || o2)) base += ' + mid';
	return base;
}

export const restricted = (c: PlanCourse) => !(offeredIn(c, '1') && offeredIn(c, '2'));

export type CardStatus = 'passed' | 'inprogress' | 'failed' | 'retake' | 'ready' | 'planned' | 'locked';

export const STATUS: Record<CardStatus, [icon: string, label: string]> = {
	passed: ['check', 'Passed'],
	inprogress: ['clock', 'Taking now'],
	failed: ['x', 'Failed'],
	retake: ['retake', 'Retake'],
	ready: ['ready', 'Ready'],
	planned: ['planned', 'Planned'],
	locked: ['lock', 'Waiting']
};

export interface Card {
	code: string;
	status: CardStatus;
	via?: string;
	history?: boolean;
	credited?: boolean;
	hypothetical?: boolean;
	waitingOn?: string | null;
	conditional?: boolean;
	pinned?: boolean;
	unplaceable?: boolean;
}

export interface Column {
	abs: number;
	cards: Card[];
}

/** Nearest failed course upstream of `code`, if any. */
function waitingOn(code: string, v: View): string | null {
	const anc = v.model.graph.ancestors(code);
	for (const f of v.failures) if (anc.has(f.code) && !v.passed.has(f.code)) return f.code;
	return null;
}

export function buildColumns(v: View): { list: Column[]; primary: Record<string, Card> } {
	const cols = new Map<number, Column>();
	const col = (abs: number) => {
		if (!cols.has(abs)) cols.set(abs, { abs, cards: [] });
		return cols.get(abs)!;
	};
	const primary: Record<string, Card> = {};
	const r = v.now.result;
	const { model } = v;

	model.courses.forEach((c) => {
		const i = v.info[c.code];
		// History: every attempt shows in its term.
		i.tries.forEach((a, k) => {
			const isLast = k === i.tries.length - 1;
			let st: CardStatus | null =
				a.result === 'passed' ? 'passed' : a.result === 'inprogress' ? 'inprogress' : a.result === 'failed' ? 'failed' : null;
			if (!st) return;
			if (isLast && i.override) st = i.override === 'planned' ? null : i.override;
			if (!st) return;
			const card: Card = { code: c.code, status: st, via: a.via, history: !isLast };
			col(a.abs).cards.push(card);
			if (isLast && st !== 'failed') primary[c.code] = card;
		});
		// Marked passed with no record: credited column.
		if (!i.tries.length && i.status === 'passed') {
			const card: Card = { code: c.code, status: 'passed', credited: true };
			col(-1).cards.push(card);
			primary[c.code] = card;
		}
		// Future failure: the failed attempt in its planned term.
		if (v.now.attemptAt[c.code] !== undefined) {
			col(v.startAbs + v.now.attemptAt[c.code]).cards.push({ code: c.code, status: 'failed', hypothetical: true });
		}
		const t = r.assignedTerm[c.code];
		if (t !== undefined) {
			const wait = waitingOn(c.code, v);
			const isRetake = v.failures.some((f) => f.code === c.code);
			let st: CardStatus = isRetake ? 'retake' : wait ? 'locked' : 'planned';
			if (st === 'planned' && preGroups(c).every((g) => g.some((x) => v.passed.has(x) || !model.byCode.has(x)))) st = 'ready';
			const card: Card = {
				code: c.code,
				status: st,
				waitingOn: wait,
				conditional: !!r.conditional[c.code],
				pinned: v.input.plannerPins[c.code] != null
			};
			col(v.startAbs + t).cards.push(card);
			primary[c.code] = card;
		}
	});
	r.unschedulable.forEach((code) => {
		const card: Card = { code, status: 'locked', unplaceable: true };
		col(Infinity).cards.push(card);
		primary[code] = card;
	});

	// Future regular sems stay visible even if empty (waiting on an offering);
	// empty midyears are dropped.
	const gradAbs = r.gradTermIndex >= 0 ? v.startAbs + r.gradTermIndex : v.startAbs - 1;
	for (let abs = v.startAbs; abs <= gradAbs; abs++) if (abs % 3 !== 2) col(abs);

	const list = Array.from(cols.values()).sort((a, b) => a.abs - b.abs);
	orderColumns(model, list, primary);
	return { list, primary };
}

/**
 * Barycenter sweeps: order each column by the mean row of a card's
 * prerequisites (left to right), then of its dependents (right to left).
 * ponytail: plain barycenter, no crossing count; d3-dag if this looks bad.
 */
function orderColumns(model: Model, list: Column[], primary: Record<string, Card>) {
	const delay = model.graph.delay;
	list.forEach((c) => c.cards.sort((a, b) => (delay[b.code] || 0) - (delay[a.code] || 0) || a.code.localeCompare(b.code)));
	const rowOf = () => {
		const pos: Record<string, number> = {};
		list.forEach((c) =>
			c.cards.forEach((card, i) => {
				if (primary[card.code] === card) pos[card.code] = i;
			})
		);
		return pos;
	};
	const preds = (code: string) => preGroups(model.byCode.get(code)).flat();
	const succs = (code: string) => model.graph.edges.filter((e) => e.from === code).map((e) => e.to);
	for (let pass = 0; pass < 4; pass++) {
		const forward = pass % 2 === 0;
		const order = forward ? list : [...list].reverse();
		order.forEach((column) => {
			const pos = rowOf();
			const key = new Map<Card, number>();
			column.cards.forEach((card, i) => {
				const nb = (forward ? preds(card.code) : succs(card.code)).filter((x) => pos[x] !== undefined);
				key.set(card, nb.length ? nb.reduce((s, x) => s + pos[x], 0) / nb.length : i);
			});
			column.cards.sort((a, b) => key.get(a)! - key.get(b)!);
		});
	}
}

/** On the critical path. Free elective cards stand for any course, so they never are. */
export const isCritical = (code: string, v: View) =>
	v.slips[code] > 0 && v.model.byCode.get(code)?.genericRequirement !== 'elective';

/** What a card says besides code and title: shared by the map and the Excel export. */
export function cardFacts(card: Card, v: View) {
	const crit = isCritical(card.code, v) && !card.history && !['passed', 'inprogress', 'failed'].includes(card.status);
	let note: { icon: string | null; text: string; warn?: boolean } | null = null;
	if (card.waitingOn) note = { icon: 'lock', text: `Waiting on ${card.waitingOn}` };
	else if (card.conditional) note = { icon: 'flag', text: 'Petition needed', warn: true };
	else if (card.unplaceable) note = { icon: 'alert', text: "Can't place", warn: true };
	else if (card.via && card.via !== card.code) note = { icon: null, text: `via ${card.via}` };
	else if (card.hypothetical) note = { icon: null, text: 'If failed here' };
	return { crit, note, statusLabel: card.status === 'failed' && card.history ? 'Failed' : STATUS[card.status][1] };
}

/** Header facts for a term column: shared by the map and the Excel export. */
export function columnFacts(column: Column, v: View) {
	const isPast = column.abs < v.startAbs;
	let name: string;
	let sub: string;
	if (column.abs === -1) {
		name = 'Credited';
		sub = 'No term on record';
	} else if (column.abs === Infinity) {
		name = "Can't place";
		sub = 'Check prerequisites';
	} else {
		name = absLabel(column.abs).replace(/ \d+$/, '');
		sub = ayLabel(column.abs);
	}
	const units = column.cards.reduce((s, c) => s + (Number(v.model.byCode.get(c.code)!.units) || 0), 0);
	const isMid = column.abs % 3 === 2;
	const future = !isPast && Number.isFinite(column.abs) && column.abs >= 0;
	const nowTerm = column.cards.some((c) => c.status === 'inprogress');
	const tag = column.abs === v.startAbs ? 'Next' : nowTerm ? 'Now' : isPast && column.abs >= 0 ? 'Taken' : '';
	let warn = '';
	if (future) {
		if (isMid && units > 6) warn = "Over 6 units in midyear needs the Dean's approval (max 9).";
		else if (!isMid && units > v.unitCaps['1']) warn = `Over your ${v.unitCaps['1']}-unit cap. This needs an overload approval.`;
		else if (!isMid && units > 18) warn = 'Over 18 units. This is allowed up to 21 when the term has lab courses.';
	}
	const loud = !!warn && (isMid || units > v.unitCaps['1']);
	return { isPast, name, sub, units, isMid, future, tag, warn, loud, cap: future ? (isMid ? v.unitCaps.midyear : v.unitCaps['1']) : null };
}

/**
 * A course already failed on record: its retake is in the plan, so say what
 * that failure costs instead of failing it a second time. Empty when the
 * course has no past failure.
 */
export function pastFailMessage(v: View, code: string): string {
	const past = v.costs.find((c) => c.code === code && c.past);
	if (!past) return '';
	const t = v.now.result.assignedTerm[code];
	const retake = t === undefined ? '' : ` The retake is planned for ${absLabel(v.startAbs + t)}.`;
	return past.cost > 0
		? `${code} is failed on your record, which moves graduation ${termsText(past.cost)} later, to ${absLabel(v.startAbs + v.now.result.gradTermIndex)}.${retake}`
		: `${code} is failed on your record, but it does not move graduation.${retake}`;
}

/** Courses whose planned term moved later between two runs. */
export function whatIfMessage(v: View): string {
	const wi = v.input.whatif;
	if (!wi || !v.noWhatif) return '';
	if (wi.mode === 'fail') {
		const past = pastFailMessage(v, wi.code);
		if (past) return past;
	}
	const after = v.now.result;
	const base = v.noWhatif.result;
	const slip = termsLate(v, base.gradTermIndex, after.gradTermIndex);
	const pushed = Object.keys(after.assignedTerm).filter(
		(c) => c !== wi.code && base.assignedTerm[c] !== undefined && after.assignedTerm[c] > base.assignedTerm[c]
	);
	const list = pushed.length > 5 ? `${pushed.slice(0, 5).join(', ')} and ${pushed.length - 5} more` : pushed.join(', ');
	const verb = wi.mode === 'fail' ? `Failing ${wi.code}` : `Taking ${wi.code} ${wi.mode === '1' ? 'a term' : 'a year'} later`;
	return slip > 0
		? `${verb} moves graduation to ${absLabel(v.startAbs + after.gradTermIndex)} (+${termsText(slip)}).${pushed.length ? ` Also pushed later are ${list}.` : ''}`
		: `${verb} does not move graduation.${pushed.length ? ` It shifts ${list}.` : ' Nothing else shifts.'}`;
}

/* ---------- Save, load and export ---------- */

export const PLAN_KEYS = ['customCourseStatus', 'plannerPins', 'plannerPetitions', 'plannerOptions', 'substitutions'] as const;

export interface PlanFile {
	source: 'elbi-gradesim-plan';
	version: 1;
	savedAt: string;
	program: string;
	whatif: PlannerInput['whatif'];
	customCourseStatus: PlannerInput['customCourseStatus'];
	plannerPins: PlannerInput['plannerPins'];
	plannerPetitions: PlannerInput['plannerPetitions'];
	plannerOptions: PlannerOptions;
	substitutions: Record<string, string>;
}

/** Returns a friendly reason the file can't be used, or '' when it is fine. */
export function checkPlan(p: unknown): string {
	const isObj = (x: unknown): x is Record<string, unknown> => x != null && typeof x === 'object' && !Array.isArray(x);
	const all = (o: unknown, ok: (x: unknown) => boolean) => isObj(o) && Object.values(o).every(ok);
	if (!isObj(p) || p.source !== 'elbi-gradesim-plan') return 'That file is not a GradeSim course plan. Pick a file made with Save plan.';
	if (p.version !== 1) return 'That plan was saved by a newer GradeSim. Reload this page and try again.';
	const prog = UPLB_PROGRAMS[String(p.program)];
	if (!prog || !prog.majorCourses) return `That plan is for a program this version does not have (${String(p.program)}).`;
	const o = p.plannerOptions;
	const w = p.whatif;
	const ok =
		all(p.customCourseStatus, (x) => ['passed', 'failed', 'planned', 'inprogress'].includes(x as string)) &&
		all(p.plannerPins, Number.isInteger) &&
		all(p.plannerPetitions, (x) => x === true) &&
		all(p.substitutions, (x) => typeof x === 'string') &&
		isObj(o) &&
		[18, 21].includes(Number(o.cap)) &&
		(w == null || (isObj(w) && typeof w.code === 'string' && ['fail', '1', '3'].includes(w.mode as string)));
	return ok ? '' : 'That plan file looks damaged, so nothing was changed.';
}

export const today = (d = new Date()) => d.toLocaleDateString('en-CA'); // local YYYY-MM-DD

export function makePlanFile(programCode: string, input: PlannerInput): PlanFile {
	return {
		source: 'elbi-gradesim-plan',
		version: 1,
		savedAt: new Date().toISOString(),
		program: programCode,
		whatif: input.whatif,
		customCourseStatus: input.customCourseStatus,
		plannerPins: input.plannerPins,
		plannerPetitions: input.plannerPetitions,
		plannerOptions: input.plannerOptions,
		substitutions: input.substitutions
	};
}

/** The planner as plain data for xlsx.ts: columns of cards plus a flat course list. */
export function exportModel(v: View, columns: Column[], primary: Record<string, Card>) {
	const termOf: Record<string, { term: string; abs: number; label: string; status: string }> = {};
	const cols = columns.map((column) => {
		const f = columnFacts(column, v);
		const term = column.abs === -1 ? 'Credited' : column.abs === Infinity ? 'Not placed' : `${f.sub} ${f.name}`;
		const cards = column.cards.map((card) => {
			const c = v.model.byCode.get(card.code)!;
			const { crit, note, statusLabel } = cardFacts(card, v);
			if (primary[card.code] === card) termOf[card.code] = { term, abs: column.abs, label: statusLabel, status: card.status };
			return {
				code: card.code,
				title: c.title,
				units: c.units,
				offer: offeringLabel(c),
				status: card.status,
				label: statusLabel,
				crit,
				note: note ? note.text : card.pinned ? 'moved later by you' : '',
				muted: !!(card.history || card.hypothetical || card.status === 'locked')
			};
		});
		return { name: f.name, sub: f.sub, tag: f.tag, units: f.units, cap: f.cap, cards };
	});
	const courses = v.model.courses
		.map((c) => {
			const t = termOf[c.code] || {
				term: 'Not placed',
				abs: Infinity,
				label: v.info[c.code].status === 'failed' ? 'Failed' : 'Planned',
				status: 'planned'
			};
			const groups = preGroups(c);
			return {
				code: c.code,
				title: c.title,
				units: c.units,
				term: t.term,
				abs: t.abs,
				status: t.status,
				label: t.label,
				prereqs: groups.length
					? groups.map((g) => (g.length > 1 && groups.length > 1 ? `(${g.join(' or ')})` : g.join(' or '))).join(' and ')
					: 'None'
			};
		})
		.sort((a, b) => a.abs - b.abs || a.code.localeCompare(b.code));
	const s = summary(v);
	return {
		title: `${s.headline}${s.deltaText ? ` (${s.deltaText})` : ''}`,
		subtitle: `${v.model.program.name || v.model.code}. ${s.sub} Exported ${today()} from Elbi GradeSim.`,
		columns: cols,
		courses
	};
}
