/**
 * Graduation scheduler, ported from the GradeSim extension (extension/src/scheduler.js).
 * Pure functions, no DOM.
 *
 * Computes the earliest feasible term for every remaining course given
 * prerequisite groups, corequisites, standing, semester offerings
 * (1st/2nd/midyear) and per-term unit caps. Also computes the Curricular
 * Analytics metrics (Heileman et al. 2018): delay factor (longest prerequisite
 * path through a course) and blocking factor (courses reachable downstream).
 */

export type Sem = '1' | '2' | 'midyear';
export type Standing = 'junior' | 'senior';
/** Observed offerings: number of terms with a section, keyed 1 = 1st sem, 2 = 2nd, 3 = midyear. */
export type Offered = Partial<Record<1 | 2 | 3 | '1' | '2' | '3', number | boolean>>;

export interface CatalogEntry {
	units: number;
	title: string;
	offered?: Offered;
	catalogSem?: string;
	pre?: string[][];
	co?: string[];
	coi?: boolean;
	standing?: Standing | null;
	note?: string | null;
}

/** A checklist row from the curriculum data. */
export interface ChecklistCourse {
	code: string;
	title?: string;
	units?: number;
	year?: number;
	sem?: Sem | string;
	prereqs?: string[];
	genericRequirement?: 'ge' | 'hk' | 'nstp' | 'elective';
	catalogSem?: string | null;
	track?: string;
	gradeType?: string;
}

/** A course the scheduler can place. */
export interface PlanCourse extends ChecklistCourse {
	title: string;
	units: number;
	pre?: string[][];
	co?: string[];
	standing?: Standing | null;
	coi?: boolean;
	note?: string | null;
	offered?: Offered | null;
	inCatalog?: boolean;
	petition?: boolean;
}

export const SEM_CYCLE: Sem[] = ['1', '2', 'midyear'];
const SEM_DIGIT: Record<Sem, 1 | 2 | 3> = { '1': 1, '2': 2, midyear: 3 };
// Load rules from the UPLB catalog: 18 units a regular sem (21 with lab
// courses), midyear 6 (the Dean may allow 9).
export const DEFAULT_UNIT_CAPS: Record<Sem, number> = { '1': 18, '2': 18, midyear: 6 };
// Assumption: UPLB does not publish standing thresholds in the catalog we have;
// junior = 50% and senior = 75% of the program's total units.
export const STANDING_FRACTION: Record<Standing, number> = { junior: 0.5, senior: 0.75 };

export function normCode(code: unknown): string {
	return String(code ?? '')
		.toUpperCase()
		.replace(/\s+/g, ' ')
		.replace(/\.$/, '')
		.trim();
}

const COURSE_RE = /\b([A-Za-z]{2,6})\s*(\d{1,3}(?:\.\d{1,2})?[A-Za-z]?)(?!\d)/;

/** First course code inside a messy string ("3  ENSC 10.1. Engineering ..."), or ''. */
export function extractCode(raw: unknown): string {
	const m = String(raw ?? '').match(COURSE_RE);
	return m ? normCode(`${m[1]} ${m[2]}`) : '';
}

/* ---------- Requisite parsing ---------- */

type Atom = { code?: string; coi?: boolean; standing?: Standing; equiv?: boolean; note?: boolean };
type Token = '(' | ')' | 'and' | 'or' | Atom;

export interface Requisite {
	pre: string[][];
	coi: boolean;
	standing: Standing | null;
	note: string | null;
}

function uniq<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

function strongerStanding(a: Standing | null, b: Standing | null): Standing | null {
	if (!a) return b;
	if (!b) return a;
	return STANDING_FRACTION[a] >= STANDING_FRACTION[b] ? a : b;
}

/** Drop any OR-group that is a superset of another (A and (A or B) = A). */
function absorb(groups: string[][]): string[][] {
	const sorted = groups.map((g) => uniq(g).sort()).sort((a, b) => a.length - b.length);
	const kept: string[][] = [];
	sorted.forEach((g) => {
		if (!kept.some((k) => k.every((c) => g.includes(c)))) kept.push(g);
	});
	return kept;
}

/**
 * Parse one AMIS req_courses string into CNF: pre is an AND of OR-groups.
 * "ABT 101 or COI" gives coi and no group (COI counts as satisfied).
 * "(CMSC 57 and CMSC 21)" gives [["CMSC 57"], ["CMSC 21"]].
 * "MATH 27 or Equivalent" gives [["MATH 27"]] (equivalents are not modelled).
 */
export function parseRequisite(str: string | null | undefined): Requisite {
	const out: Requisite = { pre: [], coi: false, standing: null, note: null };
	const raw = (str || '').trim();
	if (!raw || raw === '-') return out;

	const cleaned = raw.replace(/\(\s*(old|new)\s*\)|-\s*(old|new)\b|_cbc\b/gi, '').replace(/,/g, ' and ');

	const tokens: Token[] = [];
	let rest = cleaned;
	let unknown = false;
	while (rest.length) {
		let m: RegExpMatchArray | null;
		if ((m = rest.match(/^\s+/))) {
			rest = rest.slice(m[0].length);
			continue;
		}
		if ((m = rest.match(/^[()]/))) {
			tokens.push(m[0] as '(' | ')');
			rest = rest.slice(1);
			continue;
		}
		if ((m = rest.match(/^(and|or)\b/i))) {
			tokens.push(m[0].toLowerCase() as 'and' | 'or');
			rest = rest.slice(m[0].length);
			continue;
		}
		if (/^coi\b/i.test(rest)) {
			tokens.push({ coi: true });
			rest = rest.slice(3);
			continue;
		}
		if ((m = rest.match(/^(junior|senior)\s+standing\b/i))) {
			tokens.push({ standing: m[1].toLowerCase() as Standing });
			rest = rest.slice(m[0].length);
			continue;
		}
		if ((m = rest.match(/^equivalent\b/i))) {
			tokens.push({ equiv: true });
			rest = rest.slice(m[0].length);
			continue;
		}
		if ((m = rest.match(new RegExp('^' + COURSE_RE.source)))) {
			tokens.push({ code: normCode(`${m[1]} ${m[2]}`) });
			rest = rest.slice(m[0].length);
			continue;
		}
		if ((m = rest.match(/^[^\s()]+/))) {
			rest = rest.slice(m[0].length);
			if (/[a-z]/i.test(m[0])) {
				unknown = true;
				const last = tokens[tokens.length - 1];
				if (typeof last !== 'object' || !last.note) tokens.push({ note: true });
			}
			continue;
		}
	}

	// Recursive descent to CNF (array of OR-groups of atoms). "and" binds tighter
	// than "or"; adjacent atoms with no operator are read as "and".
	let i = 0;
	const atomCnf = (a: Atom): Atom[][] => [[a]];
	const andCnf = (x: Atom[][], y: Atom[][]) => x.concat(y);
	const orCnf = (x: Atom[][], y: Atom[][]) => {
		const res: Atom[][] = [];
		x.forEach((gx) => y.forEach((gy) => res.push(gx.concat(gy))));
		return res;
	};
	function parseExpr(): Atom[][] {
		let left = parseTerm();
		while (tokens[i] === 'or') {
			i++;
			left = orCnf(left, parseTerm());
		}
		return left;
	}
	function parseTerm(): Atom[][] {
		let left = parseFactor();
		while (i < tokens.length && tokens[i] !== 'or' && tokens[i] !== ')') {
			if (tokens[i] === 'and') i++;
			if (i >= tokens.length || tokens[i] === ')' || tokens[i] === 'or') break;
			left = andCnf(left, parseFactor());
		}
		return left;
	}
	function parseFactor(): Atom[][] {
		const t = tokens[i++];
		if (t === '(') {
			const e = parseExpr();
			if (tokens[i] === ')') i++;
			return e;
		}
		if (t && typeof t === 'object') return atomCnf(t);
		return []; // stray operator or ')': contributes nothing
	}
	let cnf: Atom[][] = [];
	while (i < tokens.length) {
		const before = i;
		cnf = andCnf(cnf, parseExpr());
		if (tokens[i] === ')') i++;
		if (i === before) i++;
	}

	cnf.forEach((group) => {
		if (group.some((a) => a.coi)) {
			out.coi = true;
			return;
		}
		const st = group.find((a) => a.standing);
		if (st && group.every((a) => a.standing)) {
			out.standing = strongerStanding(out.standing, st.standing ?? null);
			return;
		}
		const codes = uniq(group.filter((a) => a.code).map((a) => a.code as string));
		if (codes.length) out.pre.push(codes);
	});
	out.pre = absorb(out.pre);
	if (unknown) out.note = raw;
	return out;
}

/**
 * Combine all AMIS requisite rows for one course. Several PRE rows are
 * alternatives (old/new curriculum variants), so they are OR-ed together.
 */
export function combineRequisites(rows: { req_type: string; req_courses: string }[] | null | undefined) {
	const pres: Requisite[] = [];
	const co: string[] = [];
	let coi = false;
	const notes: string[] = [];
	(rows || []).forEach((r) => {
		const parsed = parseRequisite(r.req_courses);
		if (parsed.note) notes.push(parsed.note);
		if (r.req_type === 'CO') {
			parsed.pre.forEach((g) => co.push(...g));
			coi = coi || parsed.coi;
		} else if (r.req_type === 'PRE') {
			if (parsed.pre.length || parsed.coi || parsed.standing) pres.push(parsed);
		}
	});

	const out = {
		pre: [] as string[][],
		co: uniq(co),
		coi,
		standing: null as Standing | null,
		note: notes.length ? uniq(notes).join('; ') : null
	};
	if (!pres.length) return out;

	// OR of CNFs: distribute, then absorb. An alternative with no course groups
	// (e.g. "COI" alone) makes the whole course requirement satisfiable.
	if (pres.some((p) => p.pre.length === 0)) {
		out.coi = out.coi || pres.some((p) => p.coi);
	} else {
		let cnf = pres[0].pre;
		for (let k = 1; k < pres.length; k++) {
			const next: string[][] = [];
			cnf.forEach((a) => pres[k].pre.forEach((b) => next.push(uniq(a.concat(b)))));
			cnf = absorb(next);
		}
		out.pre = cnf;
	}
	out.coi = out.coi || pres.some((p) => p.coi);
	// Standing only binds if every alternative asks for it.
	if (pres.every((p) => p.standing)) {
		out.standing = pres
			.map((p) => p.standing as Standing)
			.reduce((a, b) => (STANDING_FRACTION[a] <= STANDING_FRACTION[b] ? a : b));
	}
	return out;
}

/** "1s,2s,M" / "1st, 2nd and Midyear" / "1,2,S" gives { 1: true, 2: true, 3: true } */
export function parseSemOffered(str: unknown): Partial<Record<1 | 2 | 3, true>> {
	const out: Partial<Record<1 | 2 | 3, true>> = {};
	String(str ?? '')
		.toLowerCase()
		.replace(/"/g, '')
		.split(/[\s,]+|\band\b/)
		.forEach((tok) => {
			if (!tok) return;
			if (tok[0] === '1') out[1] = true;
			else if (tok[0] === '2') out[2] = true;
			else if (/^(m|s$|summer)/.test(tok)) out[3] = true;
		});
	return out;
}

/* ---------- Offerings ---------- */

export function semAt(termIndex: number, startSem: Sem): Sem {
	const start = SEM_CYCLE.indexOf(startSem);
	return SEM_CYCLE[(start + termIndex) % SEM_CYCLE.length];
}

type OfferingInput = Pick<PlanCourse, 'offered' | 'catalogSem' | 'sem'>;

/**
 * Order: observed offerings (sections seen in AMIS terms), then the catalog's
 * sem_offered, then the checklist slot. Midyear only counts when observed,
 * except a checklist that places the course in midyear (practicums).
 */
export function offeredIn(course: Partial<OfferingInput>, sem: Sem): boolean {
	const d = SEM_DIGIT[sem];
	const obs = course.offered as Record<number, number | boolean> | null | undefined;
	if (obs && (obs[1] || obs[2] || obs[3])) return !!obs[d];
	if (course.catalogSem) {
		const cat = parseSemOffered(course.catalogSem);
		if (cat[1] || cat[2]) return d !== 3 && !!cat[d];
	}
	if (!course.sem) return sem !== 'midyear';
	return course.sem === sem;
}

/**
 * Human label for a term. Year advances when wrapping 1st sem to 2nd sem
 * (2nd sem and midyear run in the next calendar year).
 */
export function termLabel(termIndex: number, startYear: number, startSem: Sem): string {
	let year = startYear;
	let sem = startSem;
	for (let i = 0; i < termIndex; i++) {
		if (sem === '1') {
			sem = '2';
			year += 1;
		} else if (sem === '2') {
			sem = 'midyear';
		} else {
			sem = '1';
		}
	}
	const names: Record<Sem, string> = { '1': '1st Sem', '2': '2nd Sem', midyear: 'Midyear' };
	return `${year} ${names[sem]}`;
}

/**
 * Courses the planner can schedule: real course codes plus generic requirement
 * slots. Bare "Elective" checklist rows stay out; getPlannerCourses adds
 * track-sized free elective slots (FE 1, FE 2, ...) instead.
 */
export function plannableCourses<T extends { code: string }>(courses: T[] | null | undefined): T[] {
	return (courses || []).filter((c) => c.code && c.code !== 'Elective');
}

/**
 * Prerequisite groups for a course. Accepts the catalog shape (pre: [[...]])
 * or the checklist shape (prereqs: [...], every one required).
 */
export function preGroups(course: Pick<PlanCourse, 'pre' | 'prereqs'> | undefined): string[][] {
	if (!course) return [];
	if (course.pre) return course.pre.map((g) => g.map(normCode));
	return (course.prereqs || []).map((p) => [normCode(p)]);
}

/* ---------- Curriculum + catalog merge ---------- */

const CLEAN_CODE_RE = /^[A-Z]{2,6} \d{1,3}(\.\d{1,2})?[A-Z]?$/;

/**
 * Turn checklist rows (some garbled by PDF parsing, e.g. code "3 CHEM 18.
 * University Chemistry" with several courses run together in the title) into
 * clean planner courses, then attach catalog data: units, offerings and
 * requisites. Catalog requisites and units win over the checklist when present,
 * since PDF parsing garbled some checklist units (CHEM 18 at 51).
 */
// ponytail: SP and thesis courses (190, 200, 200A) keep checklist units. AMIS
// lists them as variable 1-unit enrollments, so the catalog number undercounts.
const VARIABLE_UNIT_RE = / (190|200)[A-Z]?$/;
function unitsFor(course: ChecklistCourse, c: CatalogEntry | null): number {
	if (c && c.units != null && !VARIABLE_UNIT_RE.test(normCode(course.code))) return c.units;
	if (course.units != null) return course.units;
	return c ? c.units : 3;
}

export function enrichCourses(
	list: ChecklistCourse[] | null | undefined,
	catalog: Record<string, CatalogEntry> | null | undefined
): PlanCourse[] {
	const cat = catalog || {};
	const out: PlanCourse[] = [];
	const seen = new Set<string>();
	const add = (course: ChecklistCourse) => {
		let code = course.code;
		if (seen.has(code)) {
			if (CLEAN_CODE_RE.test(code)) return; // same real course twice
			let n = 2;
			while (seen.has(`${course.code} (${n})`)) n++;
			code = `${course.code} (${n})`;
		}
		seen.add(code);
		const c = cat[course.code] || null;
		const hasReq = !!(c && (c.pre || c.co || c.coi || c.standing));
		out.push({
			...course,
			code,
			title: course.title || (c && c.title) || course.code,
			units: unitsFor(course, c),
			pre: hasReq && c ? c.pre || [] : (course.prereqs || []).map((p) => [extractCode(p) || normCode(p)]),
			co: hasReq && c ? c.co || [] : [],
			standing: hasReq && c ? c.standing || null : null,
			coi: !!(c && c.coi),
			note: (c && c.note) || null,
			offered: c ? c.offered : null,
			catalogSem: c ? c.catalogSem || null : course.catalogSem || null,
			inCatalog: !!c
		});
	};

	(list || []).forEach((row) => {
		const raw = normCode(row.code);
		if (!raw || raw === 'ELECTIVE' || /^\d+$/.test(raw)) return;
		if (row.genericRequirement || CLEAN_CODE_RE.test(raw) || !/\d/.test(raw)) {
			// GE/HK/NSTP/elective slots can be filled any regular sem.
			add(
				CLEAN_CODE_RE.test(raw) && !row.genericRequirement
					? { ...row, code: raw }
					: { ...row, code: raw, catalogSem: '1s,2s' }
			);
			return;
		}
		// Garbled row: salvage every course code in its code and title text.
		const text = `${row.code} ${row.title || ''}`;
		const re = new RegExp(COURSE_RE.source, 'g');
		let m: RegExpExecArray | null;
		while ((m = re.exec(text))) {
			const code = normCode(`${m[1]} ${m[2]}`);
			if (!cat[code] && (m[1] !== m[1].toUpperCase() || /^[IVX]+$/.test(m[1]))) continue; // "Laboratory 3", "Calculus III 3"
			const named = text.slice(re.lastIndex).match(/^\.?\s*([^\d]+?)(?=\s+\d|\s*$)/);
			add({
				code,
				title: cat[code] ? cat[code].title : named ? named[1].trim() : '',
				units: cat[code] ? cat[code].units : row.units,
				year: row.year,
				sem: row.sem,
				prereqs: []
			});
		}
	});
	return out;
}

/* ---------- Scheduler ---------- */

export interface ScheduleOptions {
	courses: PlanCourse[];
	/** Codes already passed (in progress counts as passed). */
	passed?: Iterable<string>;
	/** {CODE: minTermIndex}: retakes, delays, pins. */
	notBefore?: Record<string, number>;
	/** {termIndex: units} taken by failed attempts. */
	reserved?: Record<number, number>;
	unitCaps?: Partial<Record<Sem, number>>;
	/** Sem of termIndex 0. */
	startSem?: Sem;
	/** Program total, for standing. */
	totalUnits?: number;
	/** false = only checklist midyear courses in midyear. */
	useMidyear?: boolean;
	maxTerms?: number;
}

export interface ScheduleResult {
	plan: { termIndex: number; sem: Sem; courses: string[]; units: number }[];
	gradTermIndex: number;
	assignedTerm: Record<string, number>;
	conditional: Record<string, boolean>;
	unschedulable: string[];
	warnings: string[];
}

/** Greedy topological scheduler. */
export function scheduleEarliest(opts: ScheduleOptions): ScheduleResult {
	const courses = plannableCourses(opts.courses);
	const passed = new Set(Array.from(opts.passed || []).map(normCode));
	const notBefore = opts.notBefore || {};
	const reserved = opts.reserved || {};
	const unitCaps = opts.unitCaps || DEFAULT_UNIT_CAPS;
	const startSem = opts.startSem || '1';
	const maxTerms = opts.maxTerms || 30;
	const warnings: string[] = [];

	const byCode = new Map<string, PlanCourse>();
	courses.forEach((c) => byCode.set(normCode(c.code), c));
	const unitsOf = (code: string) => {
		const c = byCode.get(code);
		return c && c.units != null ? Number(c.units) : 3;
	};
	const totalUnits =
		opts.totalUnits || Array.from(byCode.keys()).reduce((s, c) => s + unitsOf(c), 0);

	// Requisites restricted to known courses; unknown ones can't gate anything.
	const groupsOf = new Map<string, string[][]>();
	const coOf = new Map<string, string[]>();
	const dependentsOf = new Map<string, string[]>();
	byCode.forEach((course, code) => {
		const groups: string[][] = [];
		preGroups(course).forEach((g) => {
			const known = g.filter((c) => byCode.has(c) || passed.has(c));
			if (!known.length) {
				warnings.push(`${code}: unknown prerequisite "${g.join(' or ')}" ignored`);
				return;
			}
			groups.push(known);
			known.forEach((c) => {
				if (!byCode.has(c)) return;
				if (!dependentsOf.has(c)) dependentsOf.set(c, []);
				dependentsOf.get(c)!.push(code);
			});
		});
		groupsOf.set(code, groups);
		coOf.set(
			code,
			(course.co || []).map(normCode).filter((c) => byCode.has(c) && c !== code)
		);
	});

	// Critical-path priority: longest chain of dependents, memoized DFS.
	const chainMemo = new Map<string, number>();
	function chainLength(code: string, visiting: Set<string>): number {
		if (chainMemo.has(code)) return chainMemo.get(code)!;
		if (visiting.has(code)) return 0; // cycle, reported via unschedulable later
		visiting.add(code);
		let best = 0;
		(dependentsOf.get(code) || []).forEach((dep) => {
			best = Math.max(best, chainLength(dep, visiting));
		});
		visiting.delete(code);
		chainMemo.set(code, best + 1);
		return best + 1;
	}

	const remaining = new Set<string>();
	byCode.forEach((_c, code) => {
		if (!passed.has(code)) remaining.add(code);
	});

	let doneUnits = 0;
	byCode.forEach((_c, code) => {
		if (passed.has(code)) doneUnits += unitsOf(code);
	});

	const assignedTerm: Record<string, number> = {};
	const conditional: Record<string, boolean> = {};
	const plan: ScheduleResult['plan'] = [];
	let emptyStreak = 0;

	for (let t = 0; t < maxTerms && remaining.size > 0; t++) {
		const sem = semAt(t, startSem);
		const cap = (unitCaps[sem] != null ? unitCaps[sem]! : DEFAULT_UNIT_CAPS[sem]) - (reserved[t] || 0);
		const done = (c: string) => passed.has(c) || (assignedTerm[c] !== undefined && assignedTerm[c] < t);

		let candidates = Array.from(remaining).filter((code) => {
			const course = byCode.get(code)!;
			if (!offeredIn(course, sem) && !course.petition) return false;
			// Most students skip midyear. Only checklist midyear courses, and courses
			// AMIS only ever offers in midyear (BA 183), go there unless opted in.
			if (
				sem === 'midyear' &&
				opts.useMidyear === false &&
				course.sem !== 'midyear' &&
				(offeredIn(course, '1') || offeredIn(course, '2'))
			)
				return false;
			if ((notBefore[code] || 0) > t) return false;
			const need = course.standing && STANDING_FRACTION[course.standing];
			if (need && doneUnits < need * totalUnits) return false;
			return groupsOf.get(code)!.every((g) => g.some(done));
		});
		// Coreqs: passed, already placed, or placeable in this same term.
		for (let changed = true; changed; ) {
			const set = new Set(candidates);
			const next = candidates.filter((code) =>
				coOf.get(code)!.every((c) => done(c) || assignedTerm[c] === t || set.has(c))
			);
			changed = next.length !== candidates.length;
			candidates = next;
		}

		candidates.sort((a, b) => {
			const diff = chainLength(b, new Set()) - chainLength(a, new Set());
			if (diff !== 0) return diff;
			return unitsOf(b) - unitsOf(a);
		});

		const placed: string[] = [];
		let units = 0;
		candidates.forEach((code) => {
			if (assignedTerm[code] !== undefined) return;
			// Place a course together with its unplaced coreqs, or not at all.
			const bundle = [
				code,
				...coOf.get(code)!.filter((c) => remaining.has(c) && assignedTerm[c] === undefined)
			];
			const bundleUnits = bundle.reduce((s, c) => s + unitsOf(c), 0);
			if (units + bundleUnits > cap) return;
			units += bundleUnits;
			bundle.forEach((c) => {
				placed.push(c);
				assignedTerm[c] = t;
				remaining.delete(c);
				if (!offeredIn(byCode.get(c)!, sem)) conditional[c] = true;
			});
		});
		placed.forEach((c) => {
			doneUnits += unitsOf(c);
		});

		if (placed.length > 0) {
			plan.push({ termIndex: t, sem, courses: placed, units });
			emptyStreak = 0;
		} else {
			// A full offering cycle with no progress and nothing merely waiting on
			// notBefore means the rest can never be placed (cycles, bad data,
			// course bigger than its sem's cap).
			const stillWaiting = Array.from(remaining).some((code) => (notBefore[code] || 0) > t);
			emptyStreak = stillWaiting ? 0 : emptyStreak + 1;
			if (emptyStreak >= SEM_CYCLE.length) break;
		}
	}

	const unschedulable = Array.from(remaining);
	if (unschedulable.length > 0) {
		warnings.push(`could not place: ${unschedulable.join(', ')}`);
	}

	const gradTermIndex = plan.length > 0 ? plan[plan.length - 1].termIndex : -1;
	return { plan, gradTermIndex, assignedTerm, conditional, unschedulable, warnings };
}

/* ---------- Curricular Analytics metrics ---------- */

export interface Graph {
	edges: { from: string; to: string }[];
	delay: Record<string, number>;
	blocking: Record<string, number>;
	ancestors: (c: string) => Set<string>;
	descendants: (c: string) => Set<string>;
}

/**
 * Prerequisite edges (u to v) between courses of the program, plus per-course
 * delay factor (courses on the longest prerequisite path through it) and
 * blocking factor (courses reachable downstream). Coreq edges are excluded.
 */
export function analyzeGraph(courses: PlanCourse[]): Graph {
	const list = plannableCourses(courses);
	const codes = new Set(list.map((c) => normCode(c.code)));
	const preds = new Map<string, string[]>();
	const succs = new Map<string, string[]>();
	codes.forEach((c) => {
		preds.set(c, []);
		succs.set(c, []);
	});
	const edges: Graph['edges'] = [];
	list.forEach((course) => {
		const v = normCode(course.code);
		preGroups(course).forEach((g) =>
			g.forEach((u) => {
				if (!codes.has(u) || u === v || preds.get(v)!.includes(u)) return;
				preds.get(v)!.push(u);
				succs.get(u)!.push(v);
				edges.push({ from: u, to: v });
			})
		);
	});

	const longest = (adj: Map<string, string[]>) => {
		const memo = new Map<string, number>();
		const visit = (c: string, stack: Set<string>): number => {
			if (memo.has(c)) return memo.get(c)!;
			if (stack.has(c)) return 0;
			stack.add(c);
			let best = 0;
			adj.get(c)!.forEach((n) => {
				best = Math.max(best, visit(n, stack));
			});
			stack.delete(c);
			memo.set(c, best + 1);
			return best + 1;
		};
		codes.forEach((c) => visit(c, new Set()));
		return memo;
	};
	const up = longest(preds);
	const down = longest(succs);

	const reach = (start: string, adj: Map<string, string[]>) => {
		const seen = new Set<string>();
		const stack = [...adj.get(start)!];
		while (stack.length) {
			const c = stack.pop()!;
			if (seen.has(c) || c === start) continue;
			seen.add(c);
			stack.push(...adj.get(c)!);
		}
		return seen;
	};

	const delay: Record<string, number> = {};
	const blocking: Record<string, number> = {};
	codes.forEach((c) => {
		delay[c] = up.get(c)! + down.get(c)! - 1;
		blocking[c] = reach(c, succs).size;
	});
	return {
		edges,
		delay,
		blocking,
		ancestors: (c) => (preds.has(c) ? reach(c, preds) : new Set()),
		descendants: (c) => (succs.has(c) ? reach(c, succs) : new Set())
	};
}

/**
 * Slip: rerun the scheduler with one course pushed one term later. slip > 0
 * means the course sits on the term-aware critical path. O(n) reruns, cheap
 * at curriculum size (about 60 courses).
 */
export function computeSlips(opts: ScheduleOptions, base?: ScheduleResult): Record<string, number> {
	const result = base || scheduleEarliest(opts);
	const slip: Record<string, number> = {};
	Object.entries(result.assignedTerm).forEach(([code, t]) => {
		const notBefore = { ...(opts.notBefore || {}), [code]: t + 1 };
		const r = scheduleEarliest({ ...opts, notBefore });
		slip[code] =
			r.unschedulable.length > result.unschedulable.length
				? Infinity
				: r.gradTermIndex - result.gradTermIndex;
	});
	return slip;
}
