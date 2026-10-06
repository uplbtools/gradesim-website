// UPLB curriculum data and helpers, ported from the GradeSim extension
// (extension/src/curriculum.js). The extension kept a "current program" global;
// here every helper takes the program explicitly.

import { UPLB_CATALOG } from './catalog.ts';
import programsJson from './data/programs.json';
import type { CatalogEntry, ChecklistCourse } from './scheduler.ts';

export interface Track {
	name: string;
	code: string;
	freeElectiveUnits: number;
	majorElectiveUnits?: number;
}

/** Courses from one pool of a specialization fill these MAJ slots, one each. */
export interface SpecializationPool {
	name: string;
	slots: string[];
	courses: string[];
}

/** A field of specialization or track the catalog lists for a program. */
export interface Specialization {
	name: string;
	source: string;
	note?: string;
	pools: SpecializationPool[];
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
	tracks?: Record<string, Track> | null;
	defaultTrack?: string;
	specializations?: Record<string, Specialization>;
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

/** Programs grouped by college, names sorted, for the program picker. Programs with available false show as coming soon. */
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
	// Word boundary so PEd and similar majors are not caught by PE.
	return NON_GWA_PREFIXES.some((prefix) => new RegExp(`^${prefix}\\b`).test(code));
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
		countExisting((c) => /^(HK|PE)\b/.test(normalizeCourseCode(c.code))),
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

type WithTracks = Partial<Slim> & Pick<Program, 'tracks' | 'defaultTrack'>;

/** A known track key, else the program's default, else its first track. */
export function resolveTrack(program: WithTracks | null | undefined, track?: string | null): string | null {
	const tracks = program?.tracks;
	if (!tracks) return null;
	if (track && tracks[track]) return track;
	return program.defaultTrack || Object.keys(tracks)[0];
}

/**
 * Required courses for one track. Students take the SP course (CMSC 190) or the
 * thesis course (CMSC 200), never both, so the other track's course is dropped
 * whether or not the checklist row carries a track tag.
 */
export function trackCourses(program: WithTracks | null | undefined, track?: string | null): ChecklistCourse[] {
	const chosen = resolveTrack(program, track);
	const otherCodes = new Set(
		Object.entries(program?.tracks || {})
			.filter(([key]) => key !== chosen)
			.map(([, t]) => normalizeCourseCode(t.code))
	);
	return (program?.majorCourses || []).filter(
		(c) => !(c.track && chosen && c.track !== chosen) && !otherCodes.has(normalizeCourseCode(c.code))
	);
}

/** Free elective slots for the track (CMSC 190 is 18 units, CMSC 200 is 15), 3 units each, hinted into 3rd and 4th year. */
export function freeElectiveCourses(program: WithTracks | null | undefined, track?: string | null): ChecklistCourse[] {
	if (!program?.tracks) return [];
	const courses: ChecklistCourse[] = [];
	for (let left = getFreeElectiveUnits(program, track), i = 0; left > 0; left -= 3, i++) {
		courses.push({
			code: `FE ${i + 1}`,
			title: 'Free Elective',
			units: Math.min(3, left),
			...defaultSlot(4 + (i % 4)),
			prereqs: [],
			genericRequirement: 'elective'
		});
	}
	return courses;
}

/** A known specialization key for the program, else null. */
export function resolveSpecialization(program: Pick<Program, 'specializations'> | null | undefined, key?: string | null): string | null {
	return key && program?.specializations?.[key] ? key : null;
}

/**
 * A specialization fills the program's MAJ slots from its pools. A pool with
 * one course per slot puts those courses in the slots. A pool with more
 * courses than slots keeps the slots and lists the courses as options.
 */
export function applySpecialization(
	rows: ChecklistCourse[],
	program: Pick<Program, 'specializations'> | null | undefined,
	key?: string | null
): ChecklistCourse[] {
	const spec = key ? program?.specializations?.[key] : undefined;
	if (!spec) return rows;
	const bySlot = new Map<string, { pool: SpecializationPool; i: number }>();
	spec.pools.forEach((pool) => pool.slots.forEach((slot, i) => bySlot.set(slot, { pool, i })));
	return rows.map((row) => {
		const hit = bySlot.get(row.code);
		if (!hit) return row;
		const { pool, i } = hit;
		// Title, prerequisites and offerings come from the catalog.
		if (pool.courses.length === pool.slots.length) {
			return { code: pool.courses[i], title: '', units: row.units, year: row.year, sem: row.sem, prereqs: [] };
		}
		return { ...row, title: `${pool.name}, ${spec.name}`, options: pool.courses };
	});
}

export function getPlannerCourses(
	program: (WithTracks & Pick<Program, 'specializations'>) | null | undefined,
	track?: string | null,
	specialization?: string | null
): ChecklistCourse[] {
	return [
		...applySpecialization(trackCourses(program, track), program, specialization),
		...genericRequirementCourses(program),
		...freeElectiveCourses(program, track)
	];
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
		else if (/^(HK|PE)\b/.test(code)) existing.hk.add(code);
		else if (code.startsWith('NSTP')) existing.nstp.add(code);
	});

	(completedCourses || []).forEach((course) => {
		const code = normalizeCourseCode(course.code || course.courseCode);
		const title = course.title || course.courseTitle || '';
		let kind: Kind | null = null;
		if (isGECourse(code, title)) kind = 'ge';
		else if (/^(HK|PE)\b/.test(code)) kind = 'hk';
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

/**
 * The student's track (SP or thesis) from AMIS rows. Any enrollment counts,
 * including the course being taken now (no grade yet) and a failed attempt.
 * Only a drop or withdrawal does not.
 */
export function detectTrack(
	program: Pick<Program, 'tracks'> | null | undefined,
	courses: { code?: string; courseCode?: string; grade?: unknown }[]
): string | null {
	if (!program?.tracks) return null;
	const codes = (courses || [])
		.filter((c) => !['DRP', 'W'].includes(String(c.grade ?? '').toUpperCase().trim()))
		.map((c) => normalizeCourseCode(c.code || c.courseCode));
	// Longest code first, so AAE 200A is not mistaken for AAE 200.
	const tracks = Object.entries(program.tracks).sort(([, a], [, b]) => b.code.length - a.code.length);
	for (const [key, track] of tracks) {
		const trackCode = normalizeCourseCode(track.code);
		if (codes.some((code) => code.startsWith(trackCode))) return key;
	}
	return null;
}

export function getFreeElectiveUnits(program: WithTracks | null | undefined, track?: string | null): number {
	if (!program?.tracks) return 15;
	return program.tracks[resolveTrack(program, track)!]?.freeElectiveUnits ?? 15;
}

export function countCompletedGE(completedCourses: Done[]): number {
	return completedCourses.filter((c) => isGECourse(c.code || c.courseCode || '', c.title || c.courseTitle || ''))
		.length;
}

/**
 * How far the planner can trust a program's data, for a rough guide notice.
 * prereqShare is the share of named courses with prerequisites from the
 * checklist or the catalog. Under 30% means the plan mostly ignores course order.
 */
export function getProgramDataQuality(programCode: string, catalog: Record<string, CatalogEntry> = UPLB_CATALOG) {
	const program = UPLB_PROGRAMS[programCode];
	if (!program) return { confident: false, prereqShare: 0, reasons: ['This program is not in GradeSim yet.'] };
	const named = (program.majorCourses || []).filter((c) => !c.genericRequirement);
	const withPrereqs = named.filter((c) => {
		const entry = catalog[normalizeCourseCode(c.code)];
		return (c.prereqs || []).length > 0 || !!(entry && (entry.pre || entry.co || entry.standing));
	});
	const prereqShare = named.length ? withPrereqs.length / named.length : 0;
	const reasons: string[] = [];
	if (!program.available) reasons.push('The checklist for this program is incomplete, so the plan may miss courses.');
	if (prereqShare < 0.3)
		reasons.push(
			`Only ${Math.round(prereqShare * 100)}% of courses have known prerequisites, so the plan may put courses in the wrong order.`
		);
	return { confident: reasons.length === 0, prereqShare, reasons };
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
