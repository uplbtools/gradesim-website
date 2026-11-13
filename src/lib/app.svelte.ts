// App state. Everything lives in this browser's localStorage under one
// versioned key; nothing is sent anywhere.

import type { ChecklistFix } from './fix.ts';
import { DEFAULT_PROGRAM, resolveSpecialization, UPLB_PROGRAMS } from './curriculum.ts';
import { calculateGWA, parseAMISData, type GradesData } from './grades.ts';
import type { GradesPatch } from './importers.ts';
import { applyRemovals } from './requirements.ts';
import type { CourseStatus, PlannerOptions, PlannerInput, PlanFile } from './planner.ts';

export const STORAGE_KEY = 'gradesim:v1';
export const THEME_KEY = 'gradesim:theme';

export interface Saved {
	version: 1;
	gradesData: GradesData | null;
	/** Where the grades came from, for the status line. */
	source: 'extension' | 'file' | 'manual' | null;
	selectedProgram: string;
	excludedCourses: string[];
	substitutions: Record<string, string>;
	/** removalKey(termId, code) to pass or fail, for 4.00 grades. */
	removals: Record<string, string>;
	track: string | null;
	/** Program code to the specialization key the student picked. */
	selectedSpecializations: Record<string, string>;
	customCourseStatus: Record<string, CourseStatus>;
	plannerPins: Record<string, number>;
	plannerPetitions: Record<string, true>;
	/** null until the planner first opens and picks a default cap for the program. */
	plannerOptions: PlannerOptions | null;
	/** Program code to the student's own corrections to its checklist. */
	checklistFixes: Record<string, ChecklistFix[]>;
}

export const blank = (): Saved => ({
	version: 1,
	gradesData: null,
	source: null,
	selectedProgram: DEFAULT_PROGRAM,
	excludedCourses: [],
	substitutions: {},
	removals: {},
	track: null,
	selectedSpecializations: {},
	customCourseStatus: {},
	plannerPins: {},
	plannerPetitions: {},
	plannerOptions: null,
	checklistFixes: {}
});

function read(): Saved {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const s = raw ? JSON.parse(raw) : null;
		if (s && s.version === 1) {
			const merged = { ...blank(), ...s };
			if (!UPLB_PROGRAMS[merged.selectedProgram]) merged.selectedProgram = DEFAULT_PROGRAM;
			return merged;
		}
	} catch {
		/* private mode or bad JSON: start fresh */
	}
	return blank();
}

class AppState {
	s = $state<Saved>(blank());
	/** False until the saved state has been read in the browser. */
	ready = $state(false);
	/** Planner what-if, not saved (a plan file can carry one). */
	whatif = $state<PlannerInput['whatif']>(null);
	/** Planning a program with no grades, from a ?program= link. Not saved. */
	blank = $state(false);

	/** The stored grades with removal exam results applied. */
	grades = $derived(applyRemovals(this.s.gradesData, this.s.removals));
	courses = $derived(parseAMISData(this.grades));
	excluded = $derived(new Set(this.s.excludedCourses));
	gwa = $derived(calculateGWA(this.courses, this.excluded));
	program = $derived(UPLB_PROGRAMS[this.s.selectedProgram] ?? UPLB_PROGRAMS[DEFAULT_PROGRAM]);
	hasData = $derived(this.courses.length > 0);
	specialization = $derived(resolveSpecialization(this.program, this.s.selectedSpecializations[this.program.code]));
	fixes = $derived(this.s.checklistFixes[this.program.code] ?? []);

	load() {
		this.s = read();
		this.ready = true;
	}

	persist() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.s));
		} catch {
			/* storage full or blocked: the session still works */
		}
	}

	applyGrades(patch: GradesPatch, source: Saved['source']) {
		this.s.gradesData = patch.gradesData;
		this.s.source = source;
		if (patch.selectedProgram) this.s.selectedProgram = patch.selectedProgram;
		if (patch.excludedCourses) this.s.excludedCourses = patch.excludedCourses;
		if (patch.substitutions) this.s.substitutions = patch.substitutions;
		if (patch.removals) this.s.removals = patch.removals;
		if (patch.selectedSpecializations) this.s.selectedSpecializations = patch.selectedSpecializations;
	}

	/** Pick a specialization for the current program, or none with an empty key. */
	setSpecialization(key: string) {
		const all = { ...this.s.selectedSpecializations };
		if (key) all[this.program.code] = key;
		else delete all[this.program.code];
		this.s.selectedSpecializations = all;
	}

	/** Save a fix for the current program. It replaces an earlier fix to the same course. */
	setFix(fix: ChecklistFix) {
		this.setFixes([...this.fixes.filter((f) => f.code !== fix.code), fix]);
	}

	setFixes(fixes: ChecklistFix[]) {
		this.s.checklistFixes = { ...this.s.checklistFixes, [this.program.code]: fixes };
	}

	applyPlan(plan: PlanFile) {
		this.s.selectedProgram = plan.program;
		this.s.customCourseStatus = plan.customCourseStatus;
		this.s.plannerPins = plan.plannerPins;
		this.s.plannerPetitions = plan.plannerPetitions;
		this.s.plannerOptions = plan.plannerOptions;
		this.s.substitutions = plan.substitutions;
		this.whatif = plan.whatif;
	}

	/** Record a removal exam result for a 4.00, or clear it with an empty result. */
	setRemoval(key: string, result: string) {
		const all = { ...this.s.removals };
		if (result) all[key] = result;
		else delete all[key];
		this.s.removals = all;
	}

	toggleExcluded(id: string) {
		const list = this.s.excludedCourses;
		this.s.excludedCourses = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	clear() {
		this.s = blank();
		this.whatif = null;
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			/* nothing to clear */
		}
	}
}

export const app = new AppState();

/** Save a Blob as a file. Blob plus a download link: works offline, no permission needed. */
export function download(name: string, blob: Blob) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
