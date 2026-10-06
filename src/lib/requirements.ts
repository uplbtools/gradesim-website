// What a student has passed and what is left, ported from the extension
// (extension/src/requirements.js). The What if tab and the planner both count
// with these, so they show the same units left.

import {
	getPlannerCourses,
	isGECourse,
	isNonGwaCourseCode,
	normalizeCourseCode,
	type Program
} from './curriculum.ts';
import type { GradesData } from './grades.ts';
import { enrichCourses, type CatalogEntry, type PlanCourse } from './scheduler.ts';

export type Result = 'passed' | 'failed' | 'nograde' | 'other';

/** One AMIS grade as passed, failed, nograde, or other (INC, DRP, 4.00). */
export function gradeResult(raw: unknown): Result {
	const g = (raw == null ? '' : String(raw)).toUpperCase().trim();
	const n = parseFloat(g);
	if (g === 'S' || g === 'P' || (n >= 1 && n <= 3)) return 'passed';
	if (n === 5 || g === 'F' || g === 'U') return 'failed';
	if (!g) return 'nograde';
	return 'other';
}

export interface Row {
	code: string;
	title: string;
	units: number;
	grade?: unknown;
	result?: string;
	termId?: string;
}

/** Every AMIS row as { code, title, units, grade, result, termId }. */
export function amisCourses(gradesData: GradesData | null | undefined): Row[] {
	return Object.entries(gradesData?.student_grades || {})
		.flatMap(([termId, t]) =>
			(t?.values || []).map((v) => ({
				code: normalizeCourseCode(v.course?.course_code),
				title: v.course?.title || '',
				units: parseFloat(String(v.unit_taken)) || 0,
				grade: v.grade,
				result: gradeResult(v.grade),
				termId
			}))
		)
		.filter((r) => r.code);
}

/**
 * Put rows into planner slots. A named checklist course fills itself and a
 * substitution fills its required course. Then GE, HK and NSTP courses fill
 * their placeholder slots and any other course with units fills an elective
 * slot, one course per slot. Returns a map of slot code to row.
 * ponytail: one course per 3-unit elective slot, so a 6-unit elective fills one.
 */
export function fillRequirementSlots<R extends Row>(
	courses: PlanCourse[],
	rows: R[],
	substitutions: Record<string, string> = {}
): Map<string, R> {
	const norm = (r: Row) => normalizeCourseCode(r.code);
	const named = new Set(courses.filter((c) => !c.genericRequirement).map((c) => normalizeCourseCode(c.code)));
	const fill = new Map<string, R>();
	rows.forEach((r) => {
		if (named.has(norm(r)) && !fill.has(norm(r))) fill.set(norm(r), r);
	});
	const used = new Set<string>();
	Object.entries(substitutions || {}).forEach(([req, taken]) => {
		const code = normalizeCourseCode(req);
		const row = rows.find((r) => norm(r) === normalizeCourseCode(taken));
		if (!row) return;
		used.add(norm(row));
		if (named.has(code) && !fill.has(code)) fill.set(code, row);
	});
	const seen = new Set<string>();
	const outside = rows.filter((r) => {
		const code = norm(r);
		if (named.has(code) || used.has(code) || seen.has(code)) return false;
		seen.add(code);
		return true;
	});
	const kindOf = (r: Row) => {
		const code = norm(r);
		if (isGECourse(code, r.title)) return 'ge';
		if (/^(HK|PE)\b/.test(code)) return 'hk';
		if (/^NSTP\b/.test(code)) return 'nstp';
		return r.units > 0 ? 'elective' : null;
	};
	(['ge', 'hk', 'nstp', 'elective'] as const).forEach((kind) => {
		const taken = outside.filter((r) => kindOf(r) === kind);
		courses
			.filter((c) => c.genericRequirement === kind)
			.forEach((slot, i) => {
				if (taken[i]) fill.set(normalizeCourseCode(slot.code), taken[i]);
			});
	});
	return fill;
}

/** The planner's course list: checklist rows for the track plus GE, HK, NSTP and free elective slots, with catalog data. */
export function plannerCourseList(
	program: Program,
	track: string | null,
	catalog: Record<string, CatalogEntry> = {}
): PlanCourse[] {
	return enrichCourses(getPlannerCourses(program, track), catalog);
}

/**
 * What is left of a plannerCourseList for passed rows. overrides are the
 * planner's manual marks. units counts every course left, the number the
 * planner shows. gwaUnits leaves out HK and NSTP, which the GWA skips.
 */
export function remainingRequirements(
	courses: PlanCourse[],
	passedRows: Row[],
	{ substitutions = {}, overrides = {} }: { substitutions?: Record<string, string>; overrides?: Record<string, string> } = {}
) {
	const fill = fillRequirementSlots(courses, passedRows, substitutions);
	const done = (c: PlanCourse) => {
		const o = overrides[c.code];
		if (o === 'passed') return true;
		if (o === 'failed' || o === 'planned') return false;
		return fill.has(normalizeCourseCode(c.code));
	};
	const sum = (list: PlanCourse[]) => list.reduce((s, c) => s + (Number(c.units) || 0), 0);
	const left = courses.filter((c) => !done(c));
	const ge = courses.filter((c) => c.genericRequirement === 'ge' || (!c.genericRequirement && isGECourse(c.code, c.title)));
	// Free electives only. MAJ slots are major electives, counted with the rest.
	const fe = courses.filter((c) => c.genericRequirement === 'elective' && /^FE\b/.test(c.code));
	return {
		courses,
		fill,
		left,
		units: sum(left),
		gwaUnits: sum(left.filter((c) => !isNonGwaCourseCode(c.code))),
		ge: { done: ge.filter(done).length, total: ge.length },
		electives: { doneUnits: sum(fe.filter(done)), totalUnits: sum(fe) }
	};
}

export type Remaining = ReturnType<typeof remainingRequirements>;

export const LATIN_HONORS = [
	['Summa cum laude', 1.2],
	['Magna cum laude', 1.45],
	['Cum laude', 1.75]
] as const;

export type Outlook = {
	status: 'reachable' | 'any-pass' | 'out-of-reach';
	required: number | null;
	ceiling: number;
	bestHonor: (typeof LATIN_HONORS)[number] | null;
};

/**
 * Where a target GWA stands. gwa and units are the GWA so far and the units
 * behind it, left is the GWA units still to take. status is reachable,
 * any-pass (passing every course is enough), or out-of-reach. ceiling is the
 * GWA with 1.00 in everything left.
 */
export function gwaOutlook(gwa: number, units: number, left: number, target: number): Outlook {
	const sum = gwa * units;
	const ceiling = units + left > 0 ? (sum + left) / (units + left) : 0;
	const bestHonor = LATIN_HONORS.find(([, cut]) => ceiling > 0 && ceiling <= cut + 1e-9) || null;
	if (left <= 0) return { status: gwa <= target ? 'any-pass' : 'out-of-reach', required: null, ceiling, bestHonor };
	const required = (target * (units + left) - sum) / left;
	// A pass is 1.00 to 3.00, so a needed average of 3.00 or more means any
	// passing grade is enough, and one under 1.00 cannot happen.
	const status = required < 1 - 1e-9 ? 'out-of-reach' : required >= 3 ? 'any-pass' : 'reachable';
	return { status, required, ceiling, bestHonor };
}
