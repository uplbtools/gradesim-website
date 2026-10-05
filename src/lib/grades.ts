// Grades, GWA, honors and the what-if math, ported from the GradeSim extension
// popup (extension/src/popup.js). The popup mixed math with DOM writes; here the
// math is pure and the Svelte components render the results.

import { UPLB_CATALOG } from './catalog.ts';
import {
	countCompletedGE,
	detectTrack,
	getFreeElectiveUnits,
	isGECourse,
	type Program
} from './curriculum.ts';

/* ---------- AMIS grades API shape ---------- */

export interface AmisGradeValue {
	id?: string | number;
	grade?: string | number | null;
	unit_taken?: string | number;
	section?: string;
	status?: string;
	course?: { course_code?: string; title?: string };
	grade_term?: { term?: string; ay?: string };
}

export interface AmisTerm {
	term?: string;
	values: AmisGradeValue[];
}

export interface GradesData {
	student_grades: Record<string, AmisTerm>;
}

/* ---------- Terms ---------- */

export type SemNo = 1 | 2 | 3;

/**
 * Absolute term number: academic year start * 3 + (0 = 1st sem, 1 = 2nd,
 * 2 = midyear). AMIS term ids are 12<year digit><term digit> (1251 = AY
 * 2025-26 1st sem); terms added by hand use "<year>-<term>" (2019-1).
 */
export function termKeyToAbs(key: string): number | null {
	let m = String(key).match(/^12(\d)([123])$/);
	if (m) return (2020 + Number(m[1])) * 3 + Number(m[2]) - 1;
	m = String(key).match(/^(\d{4})-([123])$/);
	if (m) return Number(m[1]) * 3 + Number(m[2]) - 1;
	return null;
}

export function manualTermKey(ayStart: number, sem: SemNo): string {
	return `${ayStart}-${sem}`;
}

const SEM_NAMES = ['1st sem', '2nd sem', 'Midyear'];
export const ayOfAbs = (abs: number) => {
	const ay = Math.floor(abs / 3);
	return `AY ${ay}-${String(ay + 1).slice(2)}`;
};
export const termNameOfAbs = (abs: number) => `${SEM_NAMES[abs % 3]} ${ayOfAbs(abs)}`;

export function termName(key: string, termData?: AmisTerm): string {
	const abs = termKeyToAbs(key);
	if (abs != null) return termNameOfAbs(abs);
	return typeof termData?.term === 'string' && termData.term ? termData.term : `Term ${key}`;
}

/** Term keys, newest first. Unknown ids keep their stored order, after known ones. */
export function sortedTermKeys(data: GradesData | null | undefined): string[] {
	const keys = Object.keys(data?.student_grades || {});
	return keys
		.map((k, i) => ({ k, i, abs: termKeyToAbs(k) }))
		.sort((a, b) => (b.abs ?? -1) - (a.abs ?? -1) || b.i - a.i)
		.map((x) => x.k);
}

/* ---------- Parsed courses ---------- */

export interface Course {
	id: string;
	termKey: string;
	termLabel: string;
	ay: string;
	code: string;
	title: string;
	units: number;
	grade: string;
}

export const NON_NUMERIC_GRADES = ['S', 'U', 'INC', 'DRP', 'W', 'P', 'DFG'];
const EXCLUDED_PREFIXES = ['NSTP', 'HK', 'PE'];

export const isPrefixExcluded = (code: string) =>
	EXCLUDED_PREFIXES.some((p) => code.toUpperCase().startsWith(p));

export const gradeText = (g: unknown) => String(g ?? '').toUpperCase().trim();

/** Numeric grade between 1 and 5, or null. */
export function numericGrade(g: unknown): number | null {
	const s = gradeText(g);
	if (NON_NUMERIC_GRADES.includes(s)) return null;
	const n = parseFloat(s);
	return Number.isNaN(n) || n < 1 || n > 5 ? null : n;
}

/** Course id the way the extension builds it, so exclusions carry over between the two. */
export const valueId = (v: AmisGradeValue, termKey: string) =>
	String(v.id || `${v.course?.course_code || 'Unknown'}-${termKey}`);

/** Flatten the AMIS structure into one row per course attempt. */
export function parseAMISData(data: GradesData | null | undefined): Course[] {
	const courses: Course[] = [];
	if (!data || !data.student_grades) return courses;
	for (const termKey of sortedTermKeys(data)) {
		const termData = data.student_grades[termKey];
		if (!termData || !Array.isArray(termData.values)) continue;
		const abs = termKeyToAbs(termKey);
		for (const v of termData.values) {
			const code = v.course?.course_code || 'Unknown';
			courses.push({
				id: valueId(v, termKey),
				termKey,
				termLabel: termName(termKey, termData),
				ay: abs != null ? ayOfAbs(abs) : v.grade_term?.ay ? `AY ${v.grade_term.ay}` : 'Unknown year',
				code,
				title: v.course?.title || 'Unknown',
				units: parseInt(String(v.unit_taken ?? '')) || 0,
				grade: gradeText(v.grade)
			});
		}
	}
	return courses;
}

export interface Completed {
	code: string;
	title: string;
	units: number;
	grade: number | 'S';
}

export interface GwaResult {
	gwa: number;
	totalUnits: number;
	totalCourses: number;
	completedCourses: Completed[];
	excludedUnits: number;
	excludedCount: number;
}

/**
 * Weighted GWA. NSTP, HK and PE never count. Non-numeric grades are shown but
 * skipped; S still counts as passed. Courses the student excluded (shiftees)
 * are tallied separately.
 */
export function calculateGWA(courses: Course[], excludedIds: Set<string> = new Set()): GwaResult {
	let weighted = 0;
	let totalUnits = 0;
	let totalCourses = 0;
	let excludedUnits = 0;
	let excludedCount = 0;
	const completedCourses: Completed[] = [];

	courses.forEach((course) => {
		if (isPrefixExcluded(course.code)) return;
		const units = course.units || 0;
		if (NON_NUMERIC_GRADES.includes(course.grade)) {
			if (course.grade === 'S') completedCourses.push({ code: course.code, title: course.title, units, grade: 'S' });
			return;
		}
		const grade = numericGrade(course.grade);
		if (grade == null || units === 0) return;
		if (excludedIds.has(course.id)) {
			excludedUnits += units;
			excludedCount++;
			return;
		}
		weighted += grade * units;
		totalUnits += units;
		totalCourses++;
		// A 4.00 or 5.00 counts in the GWA but does not complete the course. The
		// extension popup listed it as completed, which hid failed courses from
		// the remaining list.
		if (grade <= 3) completedCourses.push({ code: course.code, title: course.title, units, grade });
	});

	return {
		gwa: totalUnits > 0 ? weighted / totalUnits : 0,
		totalUnits,
		totalCourses,
		completedCourses,
		excludedUnits,
		excludedCount
	};
}

/** GWA of one term or year, skipping excluded courses. */
export function groupGWA(courses: Course[], excludedIds: Set<string> = new Set()): number {
	let weighted = 0;
	let units = 0;
	courses.forEach((c) => {
		if (excludedIds.has(c.id) || isPrefixExcluded(c.code)) return;
		const g = numericGrade(c.grade);
		if (g == null || !c.units) return;
		weighted += g * c.units;
		units += c.units;
	});
	return units > 0 ? weighted / units : 0;
}

export interface Group {
	key: string;
	label: string;
	courses: Course[];
}

/** Group by term or by academic year, newest first. NSTP, HK and PE are left out like the popup did. */
export function groupCourses(courses: Course[], by: 'term' | 'year'): Group[] {
	const groups = new Map<string, Group>();
	courses.forEach((c) => {
		if (isPrefixExcluded(c.code)) return;
		const key = by === 'term' ? c.termKey : c.ay;
		if (!groups.has(key)) groups.set(key, { key, label: by === 'term' ? c.termLabel : c.ay, courses: [] });
		groups.get(key)!.courses.push(c);
	});
	return Array.from(groups.values()); // courses arrive newest term first
}

/* ---------- Honors ---------- */

export const HONORS = [
	{ key: 'summa', name: 'Summa Cum Laude', max: 1.2 },
	{ key: 'magna', name: 'Magna Cum Laude', max: 1.45 },
	{ key: 'cum', name: 'Cum Laude', max: 1.75 },
	{ key: 'roll', name: 'Honor Roll', max: 2.0 }
] as const;

export function honorFor(gwa: number) {
	if (!(gwa > 0)) return null;
	return HONORS.find((h) => gwa <= h.max) ?? null;
}

export function scholarFor(gwa: number): string | null {
	if (!(gwa > 0)) return null;
	if (gwa <= 1.45) return 'University Scholar';
	if (gwa <= 1.75) return 'College Scholar';
	if (gwa <= 2.0) return 'Honor Roll';
	return null;
}

export type GradeTone = 'excellent' | 'good' | 'passing' | 'failed' | 'satisfactory' | 'other';

export function gradeTone(grade: string): GradeTone {
	if (grade === 'S' || grade === 'P') return 'satisfactory';
	if (grade === 'U' || grade === 'F') return 'failed';
	const n = numericGrade(grade);
	if (n == null) return 'other';
	if (n <= 1.5) return 'excellent';
	if (n <= 2.0) return 'good';
	if (n >= 5) return 'failed';
	return 'passing';
}

export const formatGrade = (grade: string) => {
	const n = numericGrade(grade);
	return n == null ? grade || 'No grade' : n.toFixed(2);
};

/* ---------- Remaining courses ---------- */

export interface Remaining {
	track: string | null;
	detectedTrack: string | null;
	remaining: { code: string; units: number; title?: string }[];
	requiredUnits: number;
	completedGECount: number;
	geRequired: number;
	remainingGESlots: number;
	freeElectiveUnitsTotal: number;
	freeElectiveUnitsTaken: number;
	freeElectiveUnitsRemaining: number;
	/** Units still to take: required + free electives + 3 per missing GE. */
	remainingUnits: number;
	/** Completed courses that can stand in for a required course. */
	substituteOptions: Completed[];
}

const up = (s: string) => s.toUpperCase().trim();

export function remainingFor(
	program: Program,
	completed: Completed[],
	substitutions: Record<string, string>,
	chosenTrack: string | null
): Remaining {
	const detectedTrack = detectTrack(program, completed);
	const track = program.tracks
		? detectedTrack || chosenTrack || program.defaultTrack || Object.keys(program.tracks)[0]
		: null;
	const freeElectiveUnitsTotal = getFreeElectiveUnits(program, track);

	const completedCodes = new Set(completed.map((c) => up(c.code)));
	for (const [req, taken] of Object.entries(substitutions)) {
		if (completedCodes.has(up(taken))) completedCodes.add(up(req));
	}
	const remaining = (program.majorCourses || [])
		.filter((c) => !completedCodes.has(up(c.code)))
		.map((c) => ({ code: c.code, units: Number(c.units) || 0, title: c.title }));
	const requiredUnits = remaining.reduce((s, c) => s + c.units, 0);

	const completedGECount = countCompletedGE(completed);
	const geRequired = program.geCoursesRequired || 9;
	const remainingGESlots = Math.max(0, geRequired - completedGECount);

	const requiredSet = new Set((program.requiredCodes || []).map(up));
	const isGE = (c: Completed) => isGECourse(c.code, c.title);
	const usedAsSub = (code: string) =>
		Object.entries(substitutions).some(([req, taken]) => up(taken) === code && requiredSet.has(up(req)));
	const freeElectiveUnitsTaken = completed
		.filter((c) => !requiredSet.has(up(c.code)) && !usedAsSub(up(c.code)) && !isGE(c))
		.reduce((s, c) => s + c.units, 0);
	const freeElectiveUnitsRemaining = Math.max(0, freeElectiveUnitsTotal - freeElectiveUnitsTaken);

	const takenAsSub = new Set(Object.values(substitutions).map(up));
	const substituteOptions = completed
		.filter((c) => !requiredSet.has(up(c.code)) && !isGE(c) && !takenAsSub.has(up(c.code)))
		.sort((a, b) => a.code.localeCompare(b.code));

	return {
		track,
		detectedTrack,
		remaining,
		requiredUnits,
		completedGECount,
		geRequired,
		remainingGESlots,
		freeElectiveUnitsTotal,
		freeElectiveUnitsTaken,
		freeElectiveUnitsRemaining,
		remainingUnits: requiredUnits + freeElectiveUnitsRemaining + remainingGESlots * 3,
		substituteOptions
	};
}

/* ---------- What if ---------- */

export type WhatIfStatus = 'achieved' | 'impossible-low' | 'impossible-high' | 'possible';

export interface WhatIf {
	status: WhatIfStatus;
	/** Average grade needed over the remaining units. */
	required: number;
	/** excellent, good, moderate or difficult, when possible. */
	effort?: 'excellent' | 'good' | 'moderate' | 'difficult';
}

/** Average grade needed on the remaining units for the final GWA to reach the target. */
export function whatIf(target: number, gwa: number, unitsDone: number, unitsLeft: number): WhatIf {
	if (gwa > 0 && gwa <= target) return { status: 'achieved', required: gwa };
	const required = unitsLeft > 0 ? (target * (unitsDone + unitsLeft) - gwa * unitsDone) / unitsLeft : 0;
	if (required < 1) return { status: 'impossible-low', required };
	if (required > 5) return { status: 'impossible-high', required };
	const effort =
		required <= 1.25 ? 'excellent' : required <= 1.75 ? 'good' : required <= 2.5 ? 'moderate' : 'difficult';
	return { status: 'possible', required, effort };
}

/* ---------- Catalog lookups for manual entry ---------- */

export interface CourseOption {
	code: string;
	title: string;
	units: number;
}

/** Every course code we know, from the catalog plus the program checklists. */
export function courseOptions(programs: Program[]): CourseOption[] {
	const map = new Map<string, CourseOption>();
	Object.entries(UPLB_CATALOG).forEach(([code, c]) => map.set(code, { code, title: c.title, units: c.units }));
	programs.forEach((p) =>
		p.majorCourses.forEach((c) => {
			const code = up(c.code);
			if (!map.has(code) && /^[A-Z]{2,6} \d/.test(code)) map.set(code, { code, title: c.title || '', units: Number(c.units) || 3 });
		})
	);
	return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}
