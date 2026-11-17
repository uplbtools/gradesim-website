<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { app, download } from '#lib/app.svelte.ts';
	import { formatGrade, groupGWA, substituteOptions, termKeyToAbs } from '#lib/grades.ts';
	import { parseImport } from '#lib/importers.ts';
	import { packLink } from '#lib/link.ts';
	import { UPLB_CATALOG } from '#lib/catalog.ts';
	import { getProgramDataQuality, isNonGwaCourseCode, UPLB_PROGRAMS } from '#lib/curriculum.ts';
	import {
		absLabel,
		buildColumns,
		cardFacts,
		columnFacts,
		compute,
		DEFAULT_PLANNER_OPTIONS,
		exportModel,
		makePlanFile,
		markConflict,
		modelFor,
		offeringLabel,
		optionEffect,
		planTrack,
		restricted,
		roomTbaLink,
		STATUS,
		summary,
		termsLate,
		termsText,
		unitsText,
		today,
		whatIfMessage,
		type Card,
		type Column,
		type PlannerInput,
	} from '#lib/planner.ts';
	import { fixIssue, fixText, type ChecklistFix } from '#lib/fix.ts';
	import { amisCourses, unlistedCourses } from '#lib/requirements.ts';
	import { preGroups, type PlanCourse } from '#lib/scheduler.ts';
	import { buildPlannerSheets, writeXlsx } from '#lib/xlsx.ts';
	import FixForm from './FixForm.svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import Notice from './Notice.svelte';
	import PlanMap from './PlanMap.svelte';
	import StatusLabel from './StatusLabel.svelte';
	import './planner.css';

	const model = $derived(modelFor(app.s.selectedProgram, planTrack(app.program, app.grades, app.s.track), app.specialization, app.fixes));
	const quality = $derived(getProgramDataQuality(app.s.selectedProgram));
	const options = $derived(app.s.plannerOptions ?? DEFAULT_PLANNER_OPTIONS);
	const input = $derived<PlannerInput>({
		gradesData: app.grades,
		substitutions: app.s.substitutions,
		customCourseStatus: app.s.customCourseStatus,
		plannerPins: app.s.plannerPins,
		plannerPetitions: app.s.plannerPetitions,
		plannerOptions: options,
		whatif: app.whatif,
		startAbs: app.shared ?? undefined
	});
	const view = $derived(model ? compute(model, input) : null);
	const layout = $derived(view ? buildColumns(view) : null);
	const sum = $derived(view ? summary(view) : null);
	let selected = $state<string | null>(null);
	let status = $state('');
	let notice = $state<{ text: string; bad: boolean } | null>(null);
	let menu: HTMLDetailsElement | undefined = $state();
	let planInput: HTMLInputElement | undefined = $state();
	let sheetEl: HTMLDivElement | undefined = $state();
	// The course whose fix form is open, or 'add' for a missing course.
	let fixing = $state<string | null>(null);
	let acted = $state<string | null>(null);

	// The map needs a wide screen, so phones and narrow windows keep the sheet.
	const VIEW_KEY = 'gradesim:planView';
	let wide = $state(false);
	let mode = $state<'map' | 'sheet'>('map');
	onMount(() => {
		try {
			if (localStorage.getItem(VIEW_KEY) === 'sheet') mode = 'sheet';
		} catch {
			/* storage blocked */
		}
		const mq = window.matchMedia('(min-width: 1100px)');
		wide = mq.matches;
		const onChange = () => (wide = mq.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});
	function setMode(next: 'map' | 'sheet') {
		mode = next;
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {
			/* storage blocked */
		}
	}

	function saveFix(fix: ChecklistFix) {
		app.setFix(fix);
		fixing = null;
		if (fix.kind === 'remove') selected = null;
		status = `${fix.code} ${fixText(fix)}. Your plan now uses this.`;
	}

	async function sendFixes() {
		const program = app.program.code;
		const fixes = app.fixes.filter((f) => !f.sent);
		let ok = false;
		try {
			const res = await fetch('/api/fix/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ program, fixes }) });
			ok = res.ok;
		} catch {
			/* offline or no function: fall back to GitHub */
		}
		if (ok) {
			app.setFixes(app.fixes.map((f) => ({ ...f, sent: true })));
			notice = { text: 'Sent. A maintainer will review your fixes. Thank you.', bad: false };
		} else {
			const issue = fixIssue(program, fixes);
			window.open(`https://github.com/uplbtools/gradesim/issues/new?${new URLSearchParams(issue)}`, '_blank', 'noopener');
			notice = { text: 'GitHub opened in a new tab with your fixes filled in. Submit the issue there to send them.', bad: false };
		}
	}

	const chain = $derived.by(() => {
		if (!selected || !model) return null;
		return new Set([selected, ...model.graph.ancestors(selected), ...model.graph.descendants(selected)]);
	});

	const wiResult = $derived(app.whatif && view ? whatIfMessage(view) : '');

	// Academic years, each with its terms. Named courses come first, then the GE, HK, NSTP and elective slots.
	const years = $derived.by(() => {
		if (!view || !layout || !model) return [];
		const slot = (card: Card) => (model.byCode.get(card.code)!.genericRequirement ? 1 : 0);
		const out: { label: string; terms: { column: Column; f: ReturnType<typeof columnFacts>; name: string; sem?: number; gwa: number; cards: Card[]; failed: number }[] }[] = [];
		layout.list.forEach((column) => {
			const f = columnFacts(column, view);
			const dated = Number.isFinite(column.abs) && column.abs >= 0;
			const label = dated ? f.sub : f.name;
			if (out.at(-1)?.label !== label) out.push({ label, terms: [] });
			out.at(-1)!.terms.push({
				column,
				f,
				name: dated ? f.name : f.sub,
				sem: dated ? column.abs % 3 : undefined,
				gwa: f.isPast ? groupGWA(app.courses.filter((c) => termKeyToAbs(c.termKey) === column.abs), app.excluded).gwa : 0,
				cards: [...column.cards].sort((a, b) => slot(a) - slot(b) || a.code.localeCompare(b.code, undefined, { numeric: true })),
				failed: column.cards.filter((c) => c.status === 'failed' && !c.hypothetical).length
			});
		});
		return out;
	});
	const isDone = (t: (typeof years)[number]['terms'][number]) => t.f.isPast && t.f.tag !== 'Now';
	const split = (done: boolean) => years.map((y) => ({ ...y, terms: y.terms.filter((t) => isDone(t) === done) })).filter((y) => y.terms.length);
	const ahead = $derived(split(false));
	const past = $derived(split(true));
	const spare = $derived(view?.now.result.spare ?? []);
	const pastLine = $derived.by(() => {
		const terms = past.flatMap((y) => y.terms);
		const dated = terms.filter((t) => t.sem !== undefined);
		const mids = dated.filter((t) => t.sem === 2).length;
		const units = terms.reduce((n, t) => n + t.cards.filter((c) => c.status === 'passed' && !isNonGwaCourseCode(c.code)).reduce((u, c) => u + (Number(model?.byCode.get(c.code)?.units) || 0), 0), 0);
		return `${termsText(dated.length - mids)}${mids ? ` and ${mids} midyear${mids === 1 ? '' : 's'}` : ''} done, ${unitsText(units)} passed`;
	});

	async function focusCard(code: string) {
		await tick();
		const el = sheetEl?.querySelector<HTMLElement>(`.pl-row[data-primary][data-code="${CSS.escape(code)}"]`);
		for (let d = el?.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
		el?.scrollIntoView({ block: 'nearest' });
		el?.focus({ preventScroll: true });
	}

	function select(code: string) {
		selected = selected === code ? null : code;
		if (selected && model) status = `${code} selected. ${model.graph.blocking[code] || 0} courses depend on it.`;
	}

	function goto(code: string) {
		selected = code;
		focusCard(code);
	}

	function setOptions(patch: Partial<typeof options>) {
		app.s.plannerOptions = { ...options, ...patch };
	}

	let menuOpen = $state(false);
	const CAPS = [[18, '18 units'], [21, '21 units'], ['checklist', "the checklist's load"]] as const;
	const moved = (text: string) => (text.startsWith("you'd") ? text : '');
	const effects = $derived.by(() => {
		if (!menuOpen || !view) return null;
		const v = view;
		const caps = CAPS.filter(([cap]) => cap !== options.cap)
			.map(([cap, label]) => [label, optionEffect(v, { cap })] as const)
			.filter(([, text]) => text.startsWith("you'd"))
			.map(([label, text]) => `With ${label}, ${text}`);
		return {
			cap: caps.join(' '),
			midyear: moved(optionEffect(v, { midyear: !options.midyear })),
			midyear9: moved(optionEffect(v, { midyear9: !options.midyear9 }))
		};
	});
	const skipped = $derived(options.skip ?? []);
	const offChoices = $derived.by(() => {
		if (!view) return [];
		const out: number[] = [];
		for (let abs = view.startAbs; out.length < 8; abs++) if (abs % 3 !== 2 && !skipped.includes(abs)) out.push(abs);
		return out;
	});
	const setSkip = (next: number[]) => setOptions({ skip: next.length ? next.sort((a, b) => a - b) : undefined });
	const petitions = $derived(Object.keys(app.s.plannerPetitions));
	// Programs whose major slots have no official course list yet, by their label on the check form.
	const CONFIRM_FORM: Record<string, string> = {
		BSAGRI: 'BS Agriculture (BSAGRI)',
		BSACHEM: 'BS Agricultural Chemistry (BSACHEM)',
		BSABE: 'BS Agricultural and Biosystems Engineering (BSABE)',
		BSAAE: 'BS Agricultural and Applied Economics (BSAAE)',
		BSCHE: 'BS Chemical Engineering (BSCHE)',
		BSECON: 'BS Economics (BSECON)',
		BSEE: 'BS Electrical Engineering (BSEE)',
		BSHE: 'BS Human Ecology (BSHE)',
		BSSTAT: 'BS Statistics (BSSTAT)',
		BSDC: 'BS Development Communication (BSDC)',
		ASDC: 'Associate of Science in Development Communication (ASDC)',
		AASS: 'Associate in Arts in Sports Studies (AASS)'
	};
	// The check form, filled in with what GradeSim already knows.
	const confirmForm = $derived.by(() => {
		const label = CONFIRM_FORM[app.program.code];
		if (!label || !model) return null;
		const years = new Set(app.courses.map((c) => c.ay)).size;
		const fields = {
			'entry.1230122317': label,
			'entry.1556773492': app.program.specializations?.[app.specialization ?? '']?.name,
			'entry.323619521': ['', '2nd year', '3rd year', '4th year', '5th year'][years - 1],
			'entry.1973018930': unlistedCourses(model.courses, amisCourses(app.grades), app.s.substitutions).join(', ')
		};
		const filled = Object.entries(fields).filter((f): f is [string, string] => !!f[1]);
		return `https://docs.google.com/forms/d/e/1FAIpQLSf3AEKf6DTpsXfq3WZAc3RXGPaX2V3qLydheP21g_gMHtUcXQ/viewform?${new URLSearchParams([['usp', 'pp_url'], ...filled])}`;
	});
	const confirmUrl = (c: PlanCourse) => (c.code.startsWith('MAJ ') && !c.allow && !c.options ? confirmForm : null);
	const pickSpec = (c: PlanCourse) =>
		!app.specialization && Object.values(app.program.specializations ?? {}).some((s) => s.pools?.some((p) => p.slots.includes(c.code)));
	const subOptions = $derived(substituteOptions(app.program, app.gwa.completedCourses, app.s.substitutions));

	function credit(code: string, taken: string) {
		const next = { ...app.s.substitutions };
		if (taken) next[code] = taken;
		else delete next[code];
		app.s.substitutions = next;
		acted = code;
		focusCard(code);
	}

	function act(name: 'passed' | 'failed' | 'inprogress' | 'undo' | 'later', code: string) {
		if (!view) return;
		if (name === 'passed' || name === 'failed' || name === 'inprogress') {
			const next = { ...app.s.customCourseStatus };
			if (name === view.info[code].auto) delete next[code];
			else next[code] = name;
			app.s.customCourseStatus = next;
			status = name === 'inprogress' ? `${code} marked as taking now` : `${code} marked ${name}`;
		} else if (name === 'later') {
			const t = view.now.result.assignedTerm[code];
			app.s.plannerPins = { ...app.s.plannerPins, [code]: view.startAbs + t + 1 };
		} else {
			const marks = { ...app.s.customCourseStatus };
			const pins = { ...app.s.plannerPins };
			delete marks[code];
			delete pins[code];
			app.s.customCourseStatus = marks;
			app.s.plannerPins = pins;
		}
		acted = code;
		focusCard(code);
	}

	function togglePetition(code: string, on: boolean) {
		const next = { ...app.s.plannerPetitions };
		if (on) next[code] = true;
		else delete next[code];
		app.s.plannerPetitions = next;
	}

	function clearWhatif() {
		app.whatif = null;
	}

	function closeMenu() {
		if (menu) menu.open = false;
	}

	function autoPlan() {
		app.s.plannerPins = {};
		closeMenu();
		status = 'Plan recomputed from scratch.';
	}

	function resetPlan() {
		closeMenu();
		if (!confirm('Reset the plan? This clears courses you marked passed or failed, courses you moved, and petitions. Your grades stay.')) return;
		app.s.customCourseStatus = {};
		app.s.plannerPins = {};
		app.s.plannerPetitions = {};
		clearWhatif();
	}

	function savePlan() {
		closeMenu();
		const plan = makePlanFile(app.s.selectedProgram, input);
		download(`gradesim-plan-${app.s.selectedProgram}-${today()}.json`, new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }));
		status = 'Plan saved as a file.';
	}

	async function loadPlan(file: File) {
		closeMenu();
		const r = parseImport(await file.text());
		if (r.kind !== 'plan') {
			notice = { text: r.kind === 'error' ? r.message : 'That file has grades, not a plan. Load it from the Grades tab.', bad: true };
			return;
		}
		if (r.plan.program !== app.s.selectedProgram) {
			const name = UPLB_PROGRAMS[r.plan.program].name;
			if (!confirm(`This plan is for ${name}. Switch to ${name} and load it? Your current marks and moves are replaced.`)) return;
		}
		app.applyPlan(r.plan);
		const saved = new Date(r.plan.savedAt);
		notice = { text: `Loaded the plan saved ${Number.isNaN(saved.getTime()) ? 'earlier' : saved.toLocaleDateString('en-CA')}.`, bad: false };
	}

	async function copyPlanLink() {
		closeMenu();
		if (!view || !model) return;
		const marks = { ...input.customCourseStatus };
		view.passed.forEach((code) => {
			if (model.byCode.has(code)) marks[code] = 'passed';
		});
		const plan = {
			...makePlanFile(model.code, { ...input, customCourseStatus: marks, substitutions: {} }),
			track: model.track,
			specialization: model.specialization,
			startAbs: view.startAbs
		};
		const url = await packLink(plan, location.origin + resolve('/'));
		notice = await navigator.clipboard.writeText(url).then(
			() => ({ text: 'The link is copied. It holds your plan and the courses you passed, with no grades.', bad: false }),
			() => ({ text: 'Your browser blocked the copy. Save the plan as a file and send that.', bad: true })
		);
	}

	function printPlan() {
		closeMenu();
		selected = null;
		sheetEl?.querySelectorAll('details').forEach((d) => (d.open = true));
		window.print();
	}

	function exportXlsx() {
		closeMenu();
		if (!view || !layout) return;
		const bytes = writeXlsx(buildPlannerSheets(exportModel(view, layout.list, layout.primary)));
		download(`gradesim-plan-${app.s.selectedProgram}-${today()}.xlsx`, new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
		status = 'Excel file downloaded.';
	}

	function onWindowClick(e: MouseEvent) {
		if (menu?.open && !menu.contains(e.target as Node)) menu.open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (menu?.open) menu.open = false;
		else if (selected) {
			const code = selected;
			selected = null;
			focusCard(code);
		}
	}

</script>

<svelte:window onclick={onWindowClick} onkeydown={onKey} />

{#snippet detail(code: string)}
	{#if view && model}
		{@const c = model.byCode.get(code)!}
		{@const i = view.info[code]}
		{@const card = layout?.primary[code]}
		{@const t = view.now.result.assignedTerm[code]}
		{@const slip = c.genericRequirement === 'elective' && view.slips[code] > 0 ? undefined : view.slips[code]}
		{@const deps = model.graph.edges.filter((e) => e.from === code).map((e) => e.to)}
		{@const past = i.tries.length > 0}
		{@const fix = app.fixes.find((f) => f.code === code)}
		{@const offer = offeringLabel(c)}
		{@const canCredit = !c.genericRequirement && (app.s.substitutions[code] || (i.status !== 'passed' && subOptions.length))}
		{@const passBlock = i.status !== 'passed' && markConflict(view, code, 'passed')}
		{@const failBlock = i.status !== 'failed' && markConflict(view, code, 'failed')}
		{@const canTake = t !== undefined && !passBlock && card?.status !== 'locked' && i.status !== 'passed' && i.status !== 'inprogress'}
		<aside class="pl-detail" aria-label="Details for {code}">
			<div class="pl-detail-head">
				<div>
					<p class="pl-detail-code">{c.code} <StatusLabel status={card ? card.status : i.status === 'failed' ? 'failed' : 'planned'} label={card?.waitingOn ? `Waiting on ${card.waitingOn}` : undefined} /></p>
					<p class="pl-detail-title">{c.title}</p>
				</div>
				<button type="button" class="pl-close" aria-label="Close details" onclick={() => select(code)}><Icon name="x" /></button>
			</div>
			{#if restricted(c) && i.status !== 'passed'}
				<p class="pl-muted">{offer === 'Not offered lately' ? "AMIS hasn't offered this lately." : `Offered ${offer.toLowerCase().replace('only', 'sem only')}.`}</p>
			{/if}
			{#if i.status !== 'passed' && slip !== undefined}
				<p class="pl-fact" class:bad={slip > 0}>
					{#if slip > 0}
						<strong>Take this on time.</strong> A sem later moves your graduation by {slip === Infinity ? 'more than the plan can show' : termsText(termsLate(view, view.now.result.gradTermIndex, view.now.result.gradTermIndex + slip))}.
					{:else}
						You can take this a sem later and still graduate on time.
					{/if}
				</p>
			{/if}
			{#if c.options}
				<h4>Take one of these</h4>
				<ul class="pl-reqs">
					{#each c.options as o (o)}
						<li><strong>{o}</strong> {UPLB_CATALOG[o]?.title.replace(/\.$/, '') ?? ''}{view.passed.has(o) ? ', passed' : ''}</li>
					{/each}
				</ul>
			{/if}
			{#if preGroups(c).length || c.co?.length || c.standing || c.coi || c.note}
				<h4>Requires</h4>
				<ul class="pl-reqs">
					{#each preGroups(c) as g, gi (gi)}
						<li>{@render group(g)}</li>
					{/each}
					{#each c.co || [] as x (x)}
						<li>Take with {@render group([x])} (corequisite)</li>
					{/each}
					{#if c.standing}<li>This needs {c.standing} standing, which GradeSim counts as {c.standing === 'senior' ? '75' : '50'}% of your units.</li>{/if}
					{#if c.coi}<li>Consent of instructor (COI) also works</li>{/if}
					{#if c.note}<li class="pl-muted">AMIS says {c.note}</li>{/if}
				</ul>
			{/if}
			{#if deps.length}
				<h4>Unlocks</h4>
				<p class="pl-deps">{#each deps as d (d)}{@render group([d])}{/each}</p>
			{/if}
			<div class="pl-actions pl-marks">
				{#if i.status !== 'passed' && !passBlock}<button type="button" class="btn btn-secondary" onclick={() => act('passed', code)}><Icon name="check" />Mark passed</button>{/if}
				{#if i.status !== 'failed' && !failBlock}<button type="button" class="btn btn-secondary" onclick={() => act('failed', code)}><Icon name="x" />{past || i.status === 'inprogress' ? 'Mark failed' : 'If I fail it'}</button>{/if}
			</div>
			{#if i.override || app.s.plannerPins[code] != null || t !== undefined || canTake}
				<div class="pl-links">
					{#if canTake}<button type="button" class="textbtn" onclick={() => act('inprogress', code)}>I'm taking it now</button>{/if}
					{#if i.override || app.s.plannerPins[code] != null}<button type="button" class="textbtn" onclick={() => act('undo', code)}>Undo my changes</button>{/if}
					{#if t !== undefined}<button type="button" class="textbtn" onclick={() => act('later', code)}>Can't get a slot</button>{/if}
				</div>
			{/if}
			{#if failBlock}<p class="pl-muted">{failBlock.code} is passed, so {code} can't be marked failed.</p>{/if}
			{#if passBlock}<p class="pl-muted">{passBlock.pre} is failed, so {code} can't be marked passed.</p>{/if}
			{#if acted === code && sum}<p><strong>{sum.headline}.{sum.deltaText ? ` ${sum.deltaText}.` : ''}</strong></p>{/if}
			{#if restricted(c) && i.status !== 'passed'}
				<label class="pl-petition">
					<input type="checkbox" checked={!!app.s.plannerPetitions[code]} onchange={(e) => togglePetition(code, e.currentTarget.checked)} />
					<span>Plan on a petition<small>A petition needs about 10 students and approval from the department, the college and OVCAA.</small></span>
				</label>
			{/if}
			{#if canCredit}
				<details class="pl-more" open={fixing === code || !!fix || !!app.s.substitutions[code]}>
					<summary><Icon name="chevron" size={16} />Credit or fix this course</summary>
					<label class="field pl-credit">
						Credit a course you passed
						<select class="select" value={app.s.substitutions[code] ?? ''} onchange={(e) => credit(code, e.currentTarget.value)}>
							<option value="">None</option>
							{#if app.s.substitutions[code]}<option value={app.s.substitutions[code]}>{app.s.substitutions[code]}</option>{/if}
							{#each subOptions as o (o.code)}<option value={o.code.toUpperCase().trim()}>{o.code}, {unitsText(o.units)}, {formatGrade(String(o.grade))}</option>{/each}
						</select>
						<small>It counts as {code} in your plan and on the Grades tab.</small>
					</label>
					{@render fixLine(c, fix)}
				</details>
			{:else if !c.genericRequirement}
				{@render fixLine(c, fix)}
			{:else if pickSpec(c)}
				<p class="pl-muted">Pick your specialization in Plan settings to see which courses count here. {#if confirmUrl(c)}If yours isn't there, <a href={confirmUrl(c)} target="_blank" rel="external noopener">tell us what you took</a>.{/if}</p>
			{:else if confirmUrl(c)}
				<p class="pl-muted">GradeSim doesn't know yet which courses count here. <a href={confirmUrl(c)} target="_blank" rel="external noopener">Tell us what you took</a>{#if app.hasData}. The form opens filled in from your grades, so check it and submit.{/if}</p>
			{/if}
		</aside>
	{/if}
{/snippet}

{#snippet fixLine(c: PlanCourse, fix: ChecklistFix | undefined)}
	{#if fixing === c.code}
		<FixForm course={c} onsave={saveFix} oncancel={() => (fixing = null)} />
	{:else if fix}
		<p class="pl-muted">
			Your fix is in your plan{fix.sent ? ' and was sent' : ''}.
			{#if !fix.sent}<button type="button" class="textbtn" onclick={sendFixes}>Send to UPLB Tools</button>{/if}
			<button type="button" class="textbtn" onclick={() => (fixing = c.code)}>Change it</button>
		</p>
	{:else}
		<p class="pl-fixline"><button type="button" class="textbtn" onclick={() => (fixing = c.code)}>Fix this course</button></p>
	{/if}
{/snippet}

{#snippet group(codes: string[])}
	{#each codes as code, k (code)}
		{@const inList = model?.byCode.has(code)}
		{@const st = view?.passed.has(code) ? 'passed' : view?.failures.some((f) => f.code === code) ? 'failed' : inList ? 'todo' : 'outside'}
		{#if k > 0}<span class="pl-or"> or </span>{/if}
		{#if inList}
			<button type="button" class="pl-link st-{st}" onclick={() => goto(code)}><Icon name={st === 'passed' ? 'check' : st === 'failed' ? 'x' : 'planned'} size={14} />{code}</button>
		{:else}
			<span class="pl-link st-{st}"><Icon name="planned" size={14} />{code}<small class="pl-outside">, not in your checklist</small></span>
		{/if}
	{/each}
{/snippet}

{#snippet yearList(list: typeof years)}
	{#if view && layout && model}
	{#each list as year (year.label)}
		<section class="pl-year" aria-label={year.label}>
			<h3>{year.label}</h3>
			{#each year.terms as term (term.column.abs)}
						{@const f = term.f}
						<details class="pl-term" class:past={f.isPast} data-sem={term.sem} open={!f.isPast || f.tag === 'Now' || term.failed > 0}>
							<summary>
								<Icon name="chevron" size={16} />
								<span class="pl-term-name">{term.name}</span>
								{#if f.tag === 'Next' || f.tag === 'Now'}<span class="pl-term-tag">{f.tag === 'Next' ? 'next' : 'now'}</span>{/if}
								<span class="pl-term-facts">
									{#if term.failed}<span class="bad">{term.failed} failed</span>{/if}
									{#if term.gwa}<span>GWA {term.gwa.toFixed(4)}</span>{/if}
									{#if f.future && !f.isMid && f.units > 18}<span class="warn">heavy</span>{/if}
									<span class:warn={f.loud}>{#if f.loud}<Icon name="alert" size={13} />{/if}{f.off ? 'Off' : f.cap ? `${f.units} of ${f.cap} units` : unitsText(f.units)}</span>
								</span>
							</summary>
							{#if f.warn}<p class="pl-term-warn">{f.warn}</p>{/if}
							{#if f.tag === 'Now' && term.column.abs === view.startAbs && term.cards.some((c) => c.status !== 'inprogress')}<p class="pl-off">This sem has started. Open each course you're taking and pick I'm taking it now.</p>{/if}
							<ul class="pl-rows" class:nograde={!term.cards.some((c) => c.grade)}>
								{#each term.cards as card (card)}
									{@const c = model.byCode.get(card.code)!}
									{@const facts = cardFacts(card, view)}
									{@const isPrimary = layout.primary[card.code] === card}
									{@const word = card.status === 'passed' || card.status === 'planned' || card.status === 'ready' ? '' : facts.statusLabel}
									<li>
										<button
											type="button"
											class="pl-row st-{card.status}"
											class:history={card.history || card.hypothetical}
											class:generic={!!c.genericRequirement}
											class:chain={chain?.has(card.code) && !(selected === card.code && isPrimary)}
											class:dim={chain && !chain.has(card.code)}
											data-code={card.code}
											data-primary={isPrimary ? '1' : undefined}
											aria-pressed={selected === card.code && isPrimary}
											aria-label="{c.code}, {c.title}. {facts.statusLabel}{facts.crit ? ', take on time' : ''}. {unitsText(Number(c.units) || 0)}{card.grade ? `, grade ${card.grade}` : ''}.{card.waitingOn ? ` Waiting on ${card.waitingOn}.` : ''}"
											onclick={() => select(card.code)}
										>
											<span class="pl-mark"><Icon name={STATUS[card.status][0] as IconName} size={16} /></span>
											<span class="pl-code">{c.code}</span>
											<span class="pl-title">{c.title}</span>
											<span class="pl-row-note" class:warn={facts.note?.warn}>
												{[facts.note?.text ?? word, card.pinned ? 'Moved by you' : '', facts.crit ? 'Take on time' : ''].filter(Boolean).join(', ')}
											</span>
											<span class="pl-row-units">{c.units}</span>
											<span class="pl-row-grade">{card.grade ?? ''}</span>
										</button>
										{#if isPrimary && selected === card.code}{@render detail(card.code)}{/if}
									</li>
								{:else}
									{#if !f.off}<li class="pl-empty">Nothing offered that fits</li>{/if}
								{/each}
							</ul>
							{#if f.off}<p class="pl-off">You're taking this sem off. <button type="button" class="textbtn" onclick={() => setSkip(skipped.filter((a) => a !== term.column.abs))}>Take it after all</button></p>{/if}
							{#if f.tag === 'Next' || f.tag === 'Now'}
								{@const codes = term.cards.filter((c) => !model.byCode.get(c.code)?.genericRequirement && c.status !== 'passed' && c.status !== 'failed').map((c) => c.code)}
								{#if codes.length}<a class="textbtn pl-roomtba" href={roomTbaLink(term.column.abs, codes, app.program.code)} target="_blank" rel="external noopener">Plan sections in Room TBA <Icon name="external" size={14} /></a>{/if}
							{/if}
							{#if term.column.abs === view.startAbs && spare.length}
								<details class="pl-term pl-also">
									<summary><Icon name="chevron" size={16} />You can also take {spare.length} other course{spare.length === 1 ? '' : 's'}</summary>
									<p class="pl-muted">Their prerequisites are done, so swap one in if a section is full.</p>
									<ul class="pl-rows nograde">
										{#each spare as code (code)}
											{@const c = model.byCode.get(code)!}
											<li>
												<button type="button" class="pl-row" class:generic={!!c.genericRequirement} data-also={code} onclick={() => goto(code)}>
													<span class="pl-mark"><Icon name="ready" size={16} /></span>
													<span class="pl-code">{c.code}</span>
													<span class="pl-title">{c.title}</span>
													<span class="pl-row-note">Planned for {absLabel(view.startAbs + view.now.result.assignedTerm[code])}</span>
													<span class="pl-row-units">{c.units}</span>
												</button>
											</li>
										{/each}
									</ul>
								</details>
							{/if}
						</details>
			{/each}
		</section>
	{/each}
	{/if}
{/snippet}

{#if !view || !layout || !sum || !model}
	<Notice>The planner doesn't have a checklist for this program yet.</Notice>
{:else}
	<div class="planner">
		{#if notice}
			<Notice tone={notice.bad ? 'bad' : 'ok'} live>{notice.text}</Notice>
		{/if}
		{#if !quality.confident}
			<Notice tone="warn"><strong>Treat this plan as a rough guide.</strong> {quality.reasons.join(' ')}</Notice>
		{/if}

		<section class="pl-summary" aria-live="polite">
			<p class="pl-print-only">{app.program.name}</p>
			<h2 class="pl-grad" data-testid="grad-term">
				<span>{sum.headline}</span>
				{#if sum.deltaText}<span class="pl-delta" class:ok={sum.deltaOk}><Icon name={sum.deltaOk ? 'check' : 'alert'} />{sum.deltaText}</span>{/if}
			</h2>
			<p class="pl-sub">{sum.sub}</p>
			{#if sum.costs.length || view.conflicts.length}
				<ul class="pl-costs">
					{#each sum.costs as c (c.code)}
						<li class:bad={c.cost > 0}>
							<Icon name={c.cost > 0 ? 'x' : 'check'} size={16} />
							<span><strong>{c.code}</strong> {c.source === 'whatif' ? 'in the what-if' : c.past ? 'failed' : 'marked failed'}, {c.cost > 0 ? `${termsText(c.cost)} later` : 'no delay'}</span>
						</li>
					{/each}
					{#each view.conflicts as c (c.code + c.pre)}
						<li class="bad">
							<Icon name="alert" size={16} />
							<span><strong>{c.code}</strong> is passed, so its prerequisite {c.pre} can't be failed. Check the mark on {c.pre}.</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="pl-controls">
			{#if wide}
				<div class="pl-view" role="group" aria-label="Show the plan as">
					<button type="button" aria-pressed={mode === 'map'} onclick={() => setMode('map')}>Map</button>
					<button type="button" aria-pressed={mode === 'sheet'} onclick={() => setMode('sheet')}>Sheet</button>
				</div>
			{/if}
			<details class="pl-menu" bind:this={menu} ontoggle={(e) => (menuOpen = e.currentTarget.open)}>
				<summary class="btn btn-secondary">Plan settings<Icon name="chevron" /></summary>
				<div class="pl-menu-pop">
					<label class="pl-menu-item pl-field">
						Max load per sem
						<select class="select" value={String(options.cap)} onchange={(e) => setOptions({ cap: Number(e.currentTarget.value) || 'checklist' })}>
							<option value="18">18 units</option>
							<option value="21">21 units (labs)</option>
							<option value="checklist">The checklist's load</option>
						</select>
						{#if effects?.cap}<small>{effects.cap}</small>{/if}
					</label>
					<label class="pl-menu-item pl-field">
						Min load per sem
						<select class="select" value={String(options.minLoad || 0)} onchange={(e) => setOptions({ minLoad: Number(e.currentTarget.value) })}>
							<option value="0">None</option>
							<option value="12">12 units</option>
							<option value="15">15 units</option>
							<option value="18">18 units</option>
						</select>
					</label>
					<label class="pl-menu-item pl-field">
						Take a sem off
						<select class="select" value="" onchange={(e) => { const abs = Number(e.currentTarget.value); e.currentTarget.value = ''; if (abs) setSkip([...skipped, abs]); }}>
							<option value="">Pick a sem</option>
							{#each offChoices as abs (abs)}<option value={abs}>{absLabel(abs)}</option>{/each}
						</select>
					</label>
					{#if app.program.specializations}
						<label class="pl-menu-item pl-field">
							Specialization
							<select class="select" value={app.specialization ?? ''} onchange={(e) => app.setSpecialization(e.currentTarget.value)}>
								<option value="">Not chosen yet</option>
								{#each Object.entries(app.program.specializations) as [key, s] (key)}
									<option value={key}>{s.name}</option>
								{/each}
							</select>
						</label>
					{/if}
					<label class="pl-menu-item pl-check"><input type="checkbox" checked={options.midyear} onchange={(e) => setOptions({ midyear: e.currentTarget.checked })} /> <span>Take classes in midyear{#if effects?.midyear}<small>With this {options.midyear ? 'off' : 'on'}, {effects.midyear}</small>{/if}</span></label>
					{#if options.midyear}<label class="pl-menu-item pl-check pl-indent"><input type="checkbox" checked={options.midyear9} onchange={(e) => setOptions({ midyear9: e.currentTarget.checked })} /> <span>Up to 9 units (Dean's approval){#if effects?.midyear9}<small>With this {options.midyear9 ? 'off' : 'on'}, {effects.midyear9}</small>{/if}</span></label>{/if}
					<hr class="pl-menu-sep" />
					<button type="button" class="pl-menu-item" onclick={autoPlan}>Auto-plan again</button>
					{#if petitions.length}
						<button type="button" class="pl-menu-item" onclick={() => (app.s.plannerPetitions = {})}>Clear petitions<small>{petitions.join(', ')}</small></button>
					{/if}
					<button type="button" class="pl-menu-item" onclick={copyPlanLink}>Copy a link to this plan</button>
					<details class="pl-more">
						<summary class="pl-menu-item">More<Icon name="chevron" size={16} /></summary>
						<button type="button" class="pl-menu-item" onclick={savePlan}>Save plan</button>
						<button type="button" class="pl-menu-item" onclick={() => planInput?.click()}>Load plan</button>
						<button type="button" class="pl-menu-item" onclick={exportXlsx}>Export to Excel</button>
						<button type="button" class="pl-menu-item" onclick={printPlan}>Print</button>
						<button type="button" class="pl-menu-item pl-danger" onclick={resetPlan}>Reset plan</button>
					</details>
				</div>
			</details>
			<input
				bind:this={planInput}
				type="file"
				accept=".json,application/json"
				hidden
				onchange={(e) => {
					const f = e.currentTarget.files?.[0];
					e.currentTarget.value = '';
					if (f) loadPlan(f);
				}}
			/>
		</section>

		<p class="pl-result" aria-live="polite">{#if wiResult}{wiResult} <button class="textbtn" type="button" onclick={clearWhatif}>Clear</button>{/if}</p>

		{#if app.fixes.length}
			<section class="pl-fixes" aria-label="Your fixes to this checklist">
				<h3>Your fixes to this checklist</h3>
				<ul>
					{#each app.fixes as f (f.code)}
						<li>
							<span><strong>{f.code}</strong> {fixText(f)}{f.sent ? ' (sent)' : ''}</span>
							<button type="button" class="textbtn" onclick={() => app.setFixes(app.fixes.filter((x) => x !== f))}>Undo</button>
						</li>
					{/each}
				</ul>
				<p class="pl-muted">Your plan already uses these. Sending them lets UPLB Tools fix the checklist for everyone. Only the fixes are sent, never your grades.</p>
				<div class="pl-actions">
					{#if app.fixes.some((f) => !f.sent)}<button type="button" class="btn btn-secondary" onclick={sendFixes}><Icon name="upload" />Send to UPLB Tools</button>{/if}
				</div>
			</section>
		{/if}

		{#if wide && mode === 'map' && view && layout}
			<PlanMap {view} columns={layout.list} primary={layout.primary} {selected} onselect={select} {detail} />
		{:else}
			<div class="pl-sheet" data-testid="planner-sheet" bind:this={sheetEl}>
				{@render yearList(ahead)}
				{#if past.length}
					<details class="pl-term pl-past">
						<summary><Icon name="chevron" size={16} />{pastLine}</summary>
						{@render yearList(past)}
					</details>
				{/if}
			</div>
		{/if}

		<p class="pl-muted pl-how">GradeSim puts each course in the earliest sem its prerequisites and AMIS offerings allow.</p>

		<div class="pl-fixes pl-add">
			{#if fixing === 'add'}
				<FixForm onsave={saveFix} oncancel={() => (fixing = null)} />
			{:else}
				<button type="button" class="textbtn" onclick={() => (fixing = 'add')}>Add a course the checklist is missing</button>
			{/if}
		</div>

		<span class="visually-hidden" aria-live="polite">{status}</span>
	</div>
{/if}
