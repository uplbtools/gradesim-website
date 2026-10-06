// Grades, GWA, honors and the what-if math, ported from the GradeSim extension
// popup (extension/src/popup.js). The popup mixed math with DOM writes; here the
// math is pure and the Svelte components render the results.

import { UPLB_CATALOG } from './catalog.ts';
import { isGECourse, isNonGwaCourseCode, type Program } from './curriculum.ts';

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
 * 2 = midyear). AMIS term ids are 1, a two digit year, then the term (1251
 * is AY 2025-26 1st sem and 1303 is the AY 2030-31 midyear). Terms added by
 * hand use "<year>-<term>" (2019-1).
 */
export function termKeyToAbs(key: string | number): number | null {
	let m = String(key).match(/^1(\d\d)([123])$/);
	if (m) return (2000 + Number(m[1])) * 3 + Number(m[2]) - 1;
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
/** NSTP, HK and PE are not in the GWA. PEd and similar codes are. */
export const isPrefixExcluded = isNonGwaCourseCode;

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
	/** Units with a passing grade (1.00 to 3.00). A 4.00 or 5.00 is in the GWA but not passed. */
	passedUnits: number;
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
	let passedUnits = 0;
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
		// A 4.00 or 5.00 counts in the GWA but does not complete the course.
		if (grade <= 3) {
			passedUnits += units;
			completedCourses.push({ code: course.code, title: course.title, units, grade });
		}
	});

	return {
		gwa: totalUnits > 0 ? weighted / totalUnits : 0,
		totalUnits,
		passedUnits,
		totalCourses,
		completedCourses,
		excludedUnits,
		excludedCount
	};
}

/** GWA of one term or year, skipping excluded courses, and whether it has a 5.00, 4.00 or INC. */
export function groupGWA(courses: Course[], excludedIds: Set<string> = new Set()) {
	let weighted = 0;
	let totalUnits = 0;
	let hasFailOrInc = false;
	courses.forEach((c) => {
		if (excludedIds.has(c.id) || isPrefixExcluded(c.code)) return;
		if (c.grade === 'INC') hasFailOrInc = true;
		const g = numericGrade(c.grade);
		if (g == null) return;
		if (g > 3) hasFailOrInc = true;
		if (!c.units) return;
		weighted += g * c.units;
		totalUnits += c.units;
	});
	return { gwa: totalUnits > 0 ? weighted / totalUnits : 0, totalUnits, hasFailOrInc };
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

// Latin honors only. Honor Roll is not a Latin honor, so it is not a target or a badge.
export const HONORS = [
	{ key: 'summa', name: 'Summa Cum Laude', max: 1.2 },
	{ key: 'magna', name: 'Magna Cum Laude', max: 1.45 },
	{ key: 'cum', name: 'Cum Laude', max: 1.75 }
] as const;

/** The honor track for a GWA. None with zero graded units. */
export function honorFor(gwa: number, totalUnits: number) {
	if (!totalUnits || !(gwa > 0)) return null;
	return HONORS.find((h) => gwa <= h.max) ?? null;
}

/** University or College Scholar for one term. Needs at least 15 units and no 5.00, 4.00 or INC. */
export function scholarFor(group: ReturnType<typeof groupGWA>): string | null {
	if (!(group.gwa > 0) || group.totalUnits < 15 || group.hasFailOrInc) return null;
	if (group.gwa <= 1.45) return 'University Scholar';
	if (group.gwa <= 1.75) return 'College Scholar';
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

/* ---------- Substitutions ---------- */

const up = (s: string) => s.toUpperCase().trim();

/** Passed courses that can stand in for a required course: not required, not a GE, not already used. */
export function substituteOptions(program: Program, completed: Completed[], substitutions: Record<string, string>): Completed[] {
	const requiredSet = new Set((program.requiredCodes || []).map(up));
	const takenAsSub = new Set(Object.values(substitutions).map(up));
	return completed
		.filter((c) => !requiredSet.has(up(c.code)) && !isGECourse(c.code, c.title) && !takenAsSub.has(up(c.code)))
		.sort((a, b) => a.code.localeCompare(b.code));
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
