// UPLB curriculum data and helpers, ported from the GradeSim extension
// (extension/src/curriculum.js). The extension kept a "current program" global;
// here every helper takes the program explicitly.

import programsJson from './data/programs.json';
import type { ChecklistCourse } from './scheduler.ts';

export interface Track {
	name: string;
	code: string;
	freeElectiveUnits: number;
	majorElectiveUnits?: number;
}

export interface Program {
	code: string;
	name: string;
	college: string;
	collegeName: string;
	available: boolean;
	totalUnitsRequired?: number;
	geCoursesRequired?: number;
	hkCoursesRequired?: number;
	nstpCoursesRequired?: number;
	tracks?: Record<string, Track>;
	defaultTrack?: string;
	majorCourses: ChecklistCourse[];
	requiredCodes?: string[];
}

export const UPLB_PROGRAMS = programsJson as unknown as Record<string, Program>;
export const DEFAULT_PROGRAM = 'BSCS';

export const COLLEGES: Record<string, string> = {
	CAS: 'College of Arts and Sciences',
	CAFS: 'College of Agriculture and Food Science',
	CDC: 'College of Development Communication',
	CEAT: 'College of Engineering and Agro-Industrial Technology',
	CEM: 'College of Economics and Management',
	CFNR: 'College of Forestry and Natural Resources',
	CHE: 'College of Human Ecology',
	CVM: 'College of Veterinary Medicine'
};

/** Programs grouped by college, names sorted, for the program picker. */
export function programsByCollege(): { college: string; name: string; programs: Program[] }[] {
	return Object.entries(COLLEGES)
		.map(([college, name]) => ({
			college,
			name,
			programs: Object.values(UPLB_PROGRAMS)
				.filter((p) => p.college === college)
				.sort((a, b) => a.name.localeCompare(b.name))
		}))
		.filter((g) => g.programs.length);
}

const NON_GWA_PREFIXES = ['NSTP', 'HK', 'PE'];
const KNOWN_GE_CODES = new Set([
	'ARTS 1',
	'COMM 10',
	'ETHICS 1',
	'HIST 1',
	'HUM 3',
	'KAS 1',
	'KAS 1/HIST 1',
	'MATH 10',
	'PHILARTS 1',
	'PHLO 1',
	'PI 10',
	'SAS 1',
	'SCIENCE 10',
	'SOSC 3',
	'STS 1',
	'WIKA 1'
]);

export function normalizeCourseCode(code: unknown): string {
	return String(code ?? '')
		.toUpperCase()
		.replace(/\s+/g, ' ')
		.trim();
}

export function isNonGwaCourseCode(courseCode: string): boolean {
	const code = normalizeCourseCode(courseCode);
	return NON_GWA_PREFIXES.some((prefix) => code.startsWith(prefix));
}

export function isGECourse(courseCode: string, courseTitle?: string): boolean {
	if (courseTitle === undefined) {
		courseTitle = courseCode;
		courseCode = '';
	}
	const code = normalizeCourseCode(courseCode);
	const title = String(courseTitle || '').toUpperCase();
	return (
		KNOWN_GE_CODES.has(code) ||
		code === 'GE' ||
		/^GE\s*\d*$/.test(code) ||
		code.includes('GE ELECTIVE') ||
		title.trim().startsWith('(GE)') ||
		/\bGE\s*(ELECTIVE|COURSE|\d)\b/.test(title) ||
		/\bGENERAL EDUCATION\b/.test(title)
	);
}

function defaultSlot(index: number) {
	return { year: Math.floor(index / 2) + 1, sem: index % 2 === 0 ? '1' : '2' };
}

type Slim = Pick<Program, 'majorCourses' | 'geCoursesRequired' | 'hkCoursesRequired' | 'nstpCoursesRequired'>;

export function genericRequirementCourses(program: Partial<Slim> | null | undefined): ChecklistCourse[] {
	const existing = program?.majorCourses || [];
	const countExisting = (predicate: (c: ChecklistCourse) => boolean) => existing.filter(predicate).length;
	const courses: ChecklistCourse[] = [];
	const slots = (
		kind: 'ge' | 'hk' | 'nstp',
		have: number,
		need: number,
		code: string,
		title: string,
		units: number
	) => {
		for (let i = have; i < need; i++) {
			courses.push({ code: `${code} ${i + 1}`, title, units, ...defaultSlot(i), prereqs: [], genericRequirement: kind });
		}
	};
	slots(
		'ge',
		countExisting((c) => isGECourse(c.code, c.title)),
		program?.geCoursesRequired == null ? 9 : program.geCoursesRequired,
		'GE',
		'General Education',
		3
	);
	slots(
		'hk',
		countExisting((c) => /^(HK|PE)/.test(normalizeCourseCode(c.code))),
		program?.hkCoursesRequired == null ? 2 : program.hkCoursesRequired,
		'HK',
		'Human Kinetics',
		2
	);
	slots(
		'nstp',
		countExisting((c) => normalizeCourseCode(c.code).startsWith('NSTP')),
		program?.nstpCoursesRequired == null ? 2 : program.nstpCoursesRequired,
		'NSTP',
		'National Service Training Program',
		3
	);
	return courses;
}

export function getPlannerCourses(program: Partial<Slim> | null | undefined): ChecklistCourse[] {
	return [...(program?.majorCourses || []), ...genericRequirementCourses(program)];
}

type Done = { code?: string; courseCode?: string; title?: string; courseTitle?: string };

export function getCompletedRequirementSlotCodes(
	completedCourses: Done[] | null | undefined,
	program: Partial<Slim> | null | undefined
): Set<string> {
	const slots = genericRequirementCourses(program);
	const done = new Set<string>();
	type Kind = 'ge' | 'hk' | 'nstp';
	const counts: Record<Kind, number> = { ge: 0, hk: 0, nstp: 0 };
	const existingDone: Record<Kind, number> = { ge: 0, hk: 0, nstp: 0 };
	const existing: Record<Kind, Set<string>> = { ge: new Set(), hk: new Set(), nstp: new Set() };

	(program?.majorCourses || []).forEach((course) => {
		const code = normalizeCourseCode(course.code);
		if (isGECourse(code, course.title)) existing.ge.add(code);
		else if (code.startsWith('HK') || code.startsWith('PE')) existing.hk.add(code);
		else if (code.startsWith('NSTP')) existing.nstp.add(code);
	});

	(completedCourses || []).forEach((course) => {
		const code = normalizeCourseCode(course.code || course.courseCode);
		const title = course.title || course.courseTitle || '';
		let kind: Kind | null = null;
		if (isGECourse(code, title)) kind = 'ge';
		else if (code.startsWith('HK') || code.startsWith('PE')) kind = 'hk';
		else if (code.startsWith('NSTP')) kind = 'nstp';
		if (!kind) return;
		counts[kind]++;
		if (existing[kind].has(code)) existingDone[kind]++;
	});

	(['ge', 'hk', 'nstp'] as Kind[]).forEach((type) => {
		slots
			.filter((course) => course.genericRequirement === type)
			.slice(0, Math.max(0, counts[type] - existingDone[type]))
			.forEach((course) => done.add(normalizeCourseCode(course.code)));
	});

	return done;
}

/** Which track the student is on, from completed courses (SP or thesis course code). */
export function detectTrack(program: Program, completedCourses: { code: string }[]): string | null {
	if (!program.tracks) return null;
	const codes = completedCourses.map((c) => c.code.toUpperCase().trim());
	for (const [trackKey, track] of Object.entries(program.tracks)) {
		if (codes.some((code) => code.startsWith(track.code.toUpperCase()))) return trackKey;
	}
	return null;
}

export function getFreeElectiveUnits(program: Program, track: string | null): number {
	if (!program.tracks) return 15;
	if (track && program.tracks[track]) return program.tracks[track].freeElectiveUnits;
	const defaultTrack = program.defaultTrack || Object.keys(program.tracks)[0];
	return program.tracks[defaultTrack]?.freeElectiveUnits || 15;
}

export function countCompletedGE(completedCourses: Done[]): number {
	return completedCourses.filter((c) => isGECourse(c.code || c.courseCode || '', c.title || c.courseTitle || ''))
		.length;
}

/** Curriculum checklist image slugs (static/curricula) to program codes. */
export const CHECKLIST_PROGRAM: Record<string, string> = {
	'BS-Chemistry': 'BSCHEM',
	'BS-Biology': 'BSBIO',
	'BS-Applied-Mathematics': 'BSAPMATH',
	'BS-Applied-Physics': 'BSAPPHY',
	'BS-Mathematics': 'BSMATH',
	'BS-Statistics': 'BSSTAT',
	'BA-Communication-Arts': 'BACOMM',
	'BA-Philosophy': 'BAPHILO',
	'BA-Sociology': 'BASOCIO',
	'BS-Agriculture': 'BSAGRI',
	'BS-Agricultural-Biotechnology': 'BSABIO',
	'BS-Food-Science-and-Technology': 'BSFST',
	'BS-Agricultural-and-Applied-Economics': 'BSAAE',
	'BS-Agribusiness-Management-Entrepreneurship': 'BSABME',
	'BS-Economics': 'BSECON',
	'BS-Chemical-Engineering': 'BSCHE',
	'BS-Civil-Engineering': 'BSCE',
	'BS-Electrical-Engineering': 'BSEE',
	'BS-Industrial-Engineering': 'BSIE',
	'BS-Mechanical-Engineering': 'BSME',
	'BS-Forestry': 'BSFOR',
	'BS-Human-Ecology': 'BSHE',
	'BS-Nutrition': 'BSNUTRI',
	'Doctor-of-Veterinary-Medicine': 'DVM',
	'BS-Development-Communication': 'BSDC',
	'BS-Agricultural-Chemistry': 'BSACHEM'
};
