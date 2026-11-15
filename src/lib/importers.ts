// Parsers for everything a student can bring in: the extension's JSON backup,
// a planner plan file, the extension bridge reply, and manual edits. All pure.

import { UPLB_PROGRAMS } from './curriculum.ts';
import { manualTermKey, valueId, type AmisGradeValue, type GradesData, type SemNo } from './grades.ts';
import { checkPlan, type PlanFile, type PlannerInput, type PlannerOptions } from './planner.ts';

const isObj = (x: unknown): x is Record<string, unknown> => x != null && typeof x === 'object' && !Array.isArray(x);

/** True when the value looks like the AMIS grades API response. */
export function isGradesData(x: unknown): x is GradesData {
	return isObj(x) && isObj(x.student_grades) && Object.values(x.student_grades).every((t) => isObj(t) && Array.isArray(t.values));
}

/** What a backup or the extension can hand over. */
export interface GradesPatch {
	gradesData: GradesData;
	selectedProgram?: string;
	excludedCourses?: string[];
	substitutions?: Record<string, string>;
	removals?: Record<string, string>;
	selectedSpecializations?: Record<string, string>;
	/** When the extension last read AMIS, in ms. */
	fetchedAt?: number;
	track?: string;
	plan?: Pick<PlannerInput, 'customCourseStatus' | 'plannerPins' | 'plannerPetitions'> & { plannerOptions: PlannerOptions };
}

/**
 * The extension's export (popup "Export JSON") or its bridge reply:
 * { source: 'elbi-gradesim', selectedProgram, excludedCourses, substitutions, gradesData }.
 * A bare AMIS grades response is accepted too.
 */
export function parseBackup(obj: unknown): GradesPatch | string {
	if (isGradesData(obj)) return { gradesData: obj };
	if (!isObj(obj) || obj.source !== 'elbi-gradesim') return "That file isn't a GradeSim backup, so nothing changed. Pick a file from Save backup, or a plan from Save plan.";
	if (!isGradesData(obj.gradesData)) return 'That backup has no grades in it yet. Open AMIS with the extension installed, then save a new backup.';
	const patch: GradesPatch = { gradesData: obj.gradesData };
	if (typeof obj.selectedProgram === 'string' && UPLB_PROGRAMS[obj.selectedProgram]) patch.selectedProgram = obj.selectedProgram;
	if (Array.isArray(obj.excludedCourses)) patch.excludedCourses = obj.excludedCourses.map(String);
	if (isObj(obj.substitutions) && Object.values(obj.substitutions).every((v) => typeof v === 'string')) {
		patch.substitutions = obj.substitutions as Record<string, string>;
	}
	if (isObj(obj.removals) && Object.values(obj.removals).every((v) => typeof v === 'string')) {
		patch.removals = obj.removals as Record<string, string>;
	}
	if (isObj(obj.selectedSpecializations) && Object.values(obj.selectedSpecializations).every((v) => typeof v === 'string')) {
		patch.selectedSpecializations = obj.selectedSpecializations as Record<string, string>;
	}
	if (typeof obj.fetchedAt === 'number') patch.fetchedAt = obj.fetchedAt;
	const track = isObj(obj.selectedTracks) && patch.selectedProgram ? obj.selectedTracks[patch.selectedProgram] : null;
	if (typeof track === 'string') patch.track = track;
	const plan = {
		customCourseStatus: obj.customCourseStatus ?? {},
		plannerPins: obj.plannerPins ?? {},
		plannerPetitions: obj.plannerPetitions ?? {},
		plannerOptions: obj.plannerOptions
	};
	if (patch.selectedProgram && !checkPlan({ source: 'elbi-gradesim-plan', version: 1, program: patch.selectedProgram, substitutions: {}, ...plan })) {
		patch.plan = plan as GradesPatch['plan'];
	}
	return patch;
}

export type Imported = { kind: 'grades'; patch: GradesPatch } | { kind: 'plan'; plan: PlanFile } | { kind: 'error'; message: string };

/** Sort out a dropped or picked JSON file. */
export function parseImport(text: string): Imported {
	let obj: unknown;
	try {
		obj = JSON.parse(text);
	} catch {
		return { kind: 'error', message: "GradeSim can't read that file, so nothing changed. Pick the backup GradeSim saved." };
	}
	if (isObj(obj) && obj.source === 'elbi-gradesim-plan') {
		const problem = checkPlan(obj);
		return problem ? { kind: 'error', message: problem } : { kind: 'plan', plan: obj as unknown as PlanFile };
	}
	const r = parseBackup(obj);
	return typeof r === 'string' ? { kind: 'error', message: r } : { kind: 'grades', patch: r };
}

/** The extension export shape, so a file saved here also loads in the extension. */
export function makeBackup(s: {
	gradesData: GradesData | null;
	selectedProgram: string;
	excludedCourses: string[];
	substitutions: Record<string, string>;
	removals?: Record<string, string>;
	selectedSpecializations?: Record<string, string>;
	fetchedAt?: number | null;
	track?: string | null;
	customCourseStatus?: PlannerInput['customCourseStatus'];
	plannerPins?: PlannerInput['plannerPins'];
	plannerPetitions?: PlannerInput['plannerPetitions'];
	plannerOptions?: PlannerOptions | null;
}) {
	return {
		source: 'elbi-gradesim',
		timestamp: new Date().toISOString(),
		selectedProgram: s.selectedProgram,
		excludedCourses: s.excludedCourses,
		substitutions: s.substitutions,
		removals: s.removals ?? {},
		selectedSpecializations: s.selectedSpecializations ?? {},
		...(s.fetchedAt ? { fetchedAt: s.fetchedAt } : {}),
		...(s.track ? { selectedTracks: { [s.selectedProgram]: s.track } } : {}),
		customCourseStatus: s.customCourseStatus ?? {},
		plannerPins: s.plannerPins ?? {},
		plannerPetitions: s.plannerPetitions ?? {},
		...(s.plannerOptions ? { plannerOptions: s.plannerOptions } : {}),
		gradesData: s.gradesData
	};
}

/* ---------- Manual entry ---------- */

export const VALID_GRADES = ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00', '4.00', '5.00', 'INC', 'DRP', 'S', 'U', 'P'];

export interface ManualCourse {
	code: string;
	title: string;
	units: number;
	/** One of VALID_GRADES, or '' when the class is still ongoing. */
	grade: string;
}

/** Returns a copy of the data with the course added to the term (created when missing). */
export function addCourse(data: GradesData | null, ayStart: number, sem: SemNo, course: ManualCourse, id: string): GradesData {
	const key = manualTermKey(ayStart, sem);
	const code = course.code.toUpperCase().replace(/\s+/g, ' ').trim();
	const next: GradesData = { student_grades: { ...(data?.student_grades || {}) } };
	const term = next.student_grades[key] || { values: [] };
	const value: AmisGradeValue = {
		id,
		grade: course.grade || null,
		unit_taken: String(course.units),
		course: { course_code: code, title: course.title.trim() || code }
	};
	next.student_grades[key] = { ...term, values: [...term.values, value] };
	return next;
}

/** Returns a copy without the course; drops the term when it empties. */
export function removeCourse(data: GradesData, termKey: string, id: string): GradesData {
	const next: GradesData = { student_grades: { ...data.student_grades } };
	const term = next.student_grades[termKey];
	if (!term) return next;
	const values = term.values.filter((v) => valueId(v, termKey) !== id);
	if (values.length) next.student_grades[termKey] = { ...term, values };
	else delete next.student_grades[termKey];
	return next;
}

/** Returns a copy with one course's grade changed. */
export function setGrade(data: GradesData, termKey: string, id: string, grade: string): GradesData {
	const next: GradesData = { student_grades: { ...data.student_grades } };
	const term = next.student_grades[termKey];
	if (!term) return next;
	next.student_grades[termKey] = {
		...term,
		values: term.values.map((v) => (valueId(v, termKey) === id ? { ...v, grade: grade || null } : v))
	};
	return next;
}
