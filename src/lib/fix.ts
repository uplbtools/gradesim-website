/** A student's correction to one checklist row. It applies to their own plan and can be sent to UPLB Tools. */
export type FixSem = '1' | '2' | 'midyear';

export interface ChecklistFix {
	kind: 'edit' | 'add' | 'remove';
	code: string;
	title?: string;
	units?: number;
	prereqs?: string[];
	sems?: FixSem[];
	note?: string;
	sent?: true;
}

export const FIX_SEMS: [FixSem, string][] = [
	['1', '1st sem'],
	['2', '2nd sem'],
	['midyear', 'midyear']
];

const CODE = /^[A-Z]{2,6} \d{1,3}[A-Z]?(?:\.\d)?(?: \(\d\))?$/;
const code = (v: unknown) => String(v ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
// Text ends up in a public GitHub issue, so markup and mentions are dropped.
const text = (v: unknown, max: number) =>
	String(v ?? '')
		.replace(/[<>`|@[\]]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);

/** A clean fix, or the reason it is refused. The app and the function both run it. */
export function validateFix(raw: unknown): ChecklistFix | string {
	const r = (raw ?? {}) as Record<string, unknown>;
	const kind = r.kind;
	if (kind !== 'edit' && kind !== 'add' && kind !== 'remove') return 'Pick what to change.';
	const fix: ChecklistFix = { kind, code: code(r.code) };
	if (!CODE.test(fix.code)) return 'Write the course code like CMSC 123.';
	const note = text(r.note, 300);
	if (note) fix.note = note;
	if (kind === 'remove') return fix;
	const title = text(r.title, 120);
	if (title) fix.title = title;
	if (r.units != null && r.units !== '') {
		const units = Number(r.units);
		if (!Number.isInteger(units) || units < 1 || units > 12) return 'Units must be a whole number from 1 to 12.';
		fix.units = units;
	}
	if (r.prereqs != null) {
		const prereqs = (Array.isArray(r.prereqs) ? r.prereqs : String(r.prereqs).split(',')).map(code).filter(Boolean);
		if (prereqs.length > 8 || prereqs.some((p) => !CODE.test(p))) return 'Write prerequisites as course codes with commas between them.';
		fix.prereqs = prereqs;
	}
	if (r.sems != null) {
		const sems = FIX_SEMS.map(([s]) => s).filter((s) => Array.isArray(r.sems) && r.sems.includes(s));
		if (!sems.length) return 'Pick at least one sem.';
		fix.sems = sems;
	}
	if (kind === 'add' && (!fix.title || !fix.units)) return 'A new course needs a title and its units.';
	if (kind === 'edit' && !fix.title && !fix.units && !fix.prereqs && !fix.sems) return 'Change at least one field first.';
	return fix;
}

/** What a fix changes, as a phrase. */
export function fixText(f: ChecklistFix): string {
	if (f.kind === 'remove') return 'is not in the curriculum';
	const parts = [
		f.kind === 'add' ? `is missing (${f.title})` : f.title ? `is titled ${f.title}` : '',
		f.units ? `has ${f.units} ${f.units === 1 ? 'unit' : 'units'}` : '',
		f.prereqs ? (f.prereqs.length ? `requires ${f.prereqs.join(', ')}` : 'has no prerequisites') : '',
		f.sems ? `is offered in ${f.sems.map((s) => FIX_SEMS.find(([k]) => k === s)![1]).join(', ')}` : ''
	];
	return parts.filter(Boolean).join(', ');
}

/** The GitHub issue for a set of fixes. */
export function fixIssue(program: string, fixes: ChecklistFix[]): { title: string; body: string } {
	return {
		title: `Checklist fix: ${program} ${fixes.map((f) => f.code).join(', ')}`.slice(0, 120),
		body: [
			`A student sent this from gradesim.uplb.tools for **${program}**.`,
			'',
			'| Course | Change | Note |',
			'|---|---|---|',
			...fixes.map((f) => `| ${f.code} | ${fixText(f)} | ${f.note ?? ''} |`),
			'',
			'```json',
			JSON.stringify({ program, fixes }),
			'```'
		].join('\n')
	};
}
