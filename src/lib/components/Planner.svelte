<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { app, download } from '#lib/app.svelte.ts';
	import { parseImport } from '#lib/importers.ts';
	import { getProgramDataQuality, UPLB_PROGRAMS } from '#lib/curriculum.ts';
	import {
		absLabel,
		buildColumns,
		cardFacts,
		columnFacts,
		compute,
		DEFAULT_PLANNER_OPTIONS,
		exportModel,
		isCritical,
		makePlanFile,
		modelFor,
		offeringLabel,
		planTrack,
		restricted,
		STATUS,
		summary,
		termsLate,
		termsText,
		today,
		whatIfMessage,
		type Card,
		type CardStatus,
		type PlannerInput,
		type WhatIfMode
	} from '#lib/planner.ts';
	import { preGroups } from '#lib/scheduler.ts';
	import { buildPlannerSheets, writeXlsx } from '#lib/xlsx.ts';
	import Icon, { type IconName } from './Icon.svelte';
	import Notice from './Notice.svelte';
	import StatusLabel from './StatusLabel.svelte';
	import './planner.css';

	const model = $derived(modelFor(app.s.selectedProgram, planTrack(app.program, app.s.gradesData, app.s.track)));
	const quality = $derived(getProgramDataQuality(app.s.selectedProgram));
	const options = $derived(app.s.plannerOptions ?? DEFAULT_PLANNER_OPTIONS);
	const input = $derived<PlannerInput>({
		gradesData: app.s.gradesData,
		substitutions: app.s.substitutions,
		customCourseStatus: app.s.customCourseStatus,
		plannerPins: app.s.plannerPins,
		plannerPetitions: app.s.plannerPetitions,
		plannerOptions: options,
		whatif: app.whatif
	});
	const view = $derived(model ? compute(model, input) : null);
	const layout = $derived(view ? buildColumns(view) : null);
	const sum = $derived(view ? summary(view) : null);
	const whatifCodes = $derived.by(() => {
		if (!view) return [];
		const codes = Object.keys(view.now.result.assignedTerm).sort();
		if (app.whatif && !codes.includes(app.whatif.code)) codes.push(app.whatif.code);
		return codes;
	});

	let selected = $state<string | null>(null);
	let hover = $state<string | null>(null);
	let phone = $state(false);
	let status = $state('');
	let notice = $state<{ text: string; bad: boolean } | null>(null);
	let wiMode = $state<WhatIfMode>(app.whatif?.mode ?? 'fail');
	let wiCode = $state(app.whatif?.code ?? '');
	let wiResult = $state('');
	let menu: HTMLDetailsElement | undefined = $state();
	let planInput: HTMLInputElement | undefined = $state();
	let gridEl: HTMLDivElement | undefined = $state();
	let paths = $state<{ d: string; kind: string }[]>([]);
	let svgSize = $state({ w: 0, h: 0 });
	let relayout = $state(0);

	const focusCode = $derived(hover ?? selected);
	const chain = $derived.by(() => {
		if (!focusCode || !model) return null;
		const anc = model.graph.ancestors(focusCode);
		const desc = model.graph.descendants(focusCode);
		return { anc, desc, all: new Set([focusCode, ...anc, ...desc]) };
	});

	onMount(() => {
		const mq = window.matchMedia('(max-width: 719px)');
		phone = mq.matches;
		const onChange = () => (phone = mq.matches);
		mq.addEventListener('change', onChange);
		const onResize = () => relayout++;
		window.addEventListener('resize', onResize);
		if (app.whatif && view) wiResult = whatIfMessage(view);
		return () => {
			mq.removeEventListener('change', onChange);
			window.removeEventListener('resize', onResize);
		};
	});

	// Draw prerequisite arrows after layout: the focused course's chain, plus the critical path.
	$effect(() => {
		void relayout;
		const v = view;
		const ch = chain;
		const focus = focusCode;
		const grid = gridEl;
		if (!v || !grid || phone || !layout) {
			paths = [];
			return;
		}
		const frame = requestAnimationFrame(() => {
			const gridRect = grid.getBoundingClientRect();
			svgSize = { w: grid.scrollWidth, h: grid.scrollHeight };
			const nodeOf = (code: string) => grid.querySelector<HTMLElement>(`.pl-card[data-primary][data-code="${CSS.escape(code)}"]`);
			const crit = (code: string) => isCritical(code, v);
			const out: { d: string; kind: string }[] = [];
			v.model.graph.edges.forEach(({ from, to }) => {
				let kind: string | null = null;
				if (ch) {
					const up = (to === focus || ch.anc.has(to)) && ch.anc.has(from);
					const down = (from === focus || ch.desc.has(from)) && ch.desc.has(to);
					if (up || down) kind = 'chain';
				}
				if (!kind && crit(from) && crit(to)) kind = 'crit';
				if (!kind) return;
				const a = nodeOf(from);
				const b = nodeOf(to);
				if (!a || !b || a.closest('details:not([open])') || b.closest('details:not([open])')) return;
				const ra = a.getBoundingClientRect();
				const rb = b.getBoundingClientRect();
				if (ra.right > rb.left) return; // same column or backwards: coreq-like, skip
				const x1 = ra.right - gridRect.left;
				const y1 = ra.top + ra.height / 2 - gridRect.top;
				const x2 = rb.left - gridRect.left;
				const y2 = rb.top + rb.height / 2 - gridRect.top;
				const dx = Math.max(24, (x2 - x1) / 2);
				out.push({ kind, d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 4} ${y2}` });
			});
			paths = out;
		});
		return () => cancelAnimationFrame(frame);
	});

	function cardClass(card: Card, primary: boolean, crit: boolean) {
		const c = ['pl-card', `st-${card.status}`];
		if (crit) c.push('crit');
		if (card.history || card.hypothetical) c.push('history');
		if (chain) c.push(card.code === focusCode && primary ? 'focus' : chain.all.has(card.code) ? 'chain' : 'dim');
		return c.join(' ');
	}

	async function focusCard(code: string) {
		await tick();
		const el = gridEl?.querySelector<HTMLElement>(`.pl-card[data-primary][data-code="${CSS.escape(code)}"]`);
		el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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

	function act(name: 'passed' | 'failed' | 'clear' | 'later' | 'unpin', code: string) {
		if (!view) return;
		if (name === 'passed' || name === 'failed') {
			const next = { ...app.s.customCourseStatus };
			if (name === view.info[code].auto) delete next[code];
			else next[code] = name;
			app.s.customCourseStatus = next;
			status = `${code} marked ${name}`;
		} else if (name === 'clear') {
			const next = { ...app.s.customCourseStatus };
			delete next[code];
			app.s.customCourseStatus = next;
		} else if (name === 'later') {
			const t = view.now.result.assignedTerm[code];
			app.s.plannerPins = { ...app.s.plannerPins, [code]: view.startAbs + t + 1 };
		} else {
			const next = { ...app.s.plannerPins };
			delete next[code];
			app.s.plannerPins = next;
		}
		focusCard(code);
	}

	function togglePetition(code: string, on: boolean) {
		const next = { ...app.s.plannerPetitions };
		if (on) next[code] = true;
		else delete next[code];
		app.s.plannerPetitions = next;
	}

	function simulate(e: SubmitEvent) {
		e.preventDefault();
		if (!wiCode) {
			wiResult = 'Pick a course first.';
			return;
		}
		app.whatif = { code: wiCode, mode: wiMode };
		selected = wiCode;
		tick().then(() => {
			if (view) wiResult = whatIfMessage(view);
		});
	}

	function clearWhatif() {
		app.whatif = null;
		wiResult = '';
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
			notice = { text: r.kind === 'error' ? r.message : 'That file has grades, not a plan. Import it from the Grades tab.', bad: true };
			return;
		}
		if (r.plan.program !== app.s.selectedProgram) {
			const name = UPLB_PROGRAMS[r.plan.program].name;
			if (!confirm(`This plan is for ${name}. Switch to ${name} and load it? Your current marks and moves are replaced.`)) return;
		}
		app.applyPlan(r.plan);
		wiMode = r.plan.whatif?.mode ?? 'fail';
		wiCode = r.plan.whatif?.code ?? '';
		await tick();
		wiResult = view && app.whatif ? whatIfMessage(view) : '';
		const saved = new Date(r.plan.savedAt);
		notice = { text: `Loaded the plan saved ${Number.isNaN(saved.getTime()) ? 'earlier' : saved.toLocaleDateString('en-CA')}.`, bad: false };
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

	const LEGEND: CardStatus[] = ['passed', 'inprogress', 'failed', 'retake', 'ready', 'planned', 'locked'];
	const icon = (s: CardStatus) => STATUS[s][0] as IconName;
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKey} />

{#snippet detail(code: string)}
	{#if view && model}
		{@const c = model.byCode.get(code)!}
		{@const i = view.info[code]}
		{@const card = layout?.primary[code]}
		{@const t = view.now.result.assignedTerm[code]}
		{@const slip = view.slips[code]}
		{@const blocking = model.graph.blocking[code] || 0}
		{@const delay = model.graph.delay[code] || 1}
		{@const deps = model.graph.edges.filter((e) => e.from === code).map((e) => e.to)}
		{@const past = i.tries.length > 0}
		{@const off = c.offered as Record<number, number> | null | undefined}
		<aside class="pl-detail" aria-label="Details for {code}">
			<div class="pl-detail-head">
				<div>
					<p class="pl-detail-code">{c.code} <StatusLabel status={card ? card.status : i.status === 'failed' ? 'failed' : 'planned'} /></p>
					<p class="pl-detail-title">{c.title}</p>
				</div>
				<button type="button" class="pl-close" aria-label="Close details" onclick={() => select(code)}><Icon name="x" /></button>
			</div>
			<p class="pl-muted">
				{`${c.units} units, offered ${offeringLabel(c).toLowerCase()}${off ? ` (${off[1] ?? 0} of 4 first sems, ${off[2] ?? 0} of 3 second sems, ${off[3] ?? 0} of 2 midyears seen)` : ''}.${t !== undefined ? ` Planned for ${absLabel(view.startAbs + t)}.` : ''}`}
			</p>
			{#if card?.waitingOn}<p class="pl-note"><Icon name="lock" size={14} />Waiting on {card.waitingOn}</p>{/if}
			<ul class="pl-metrics">
				<li><strong>{blocking}</strong> {blocking === 1 ? 'course' : 'courses'} blocked if this is failed</li>
				<li><strong>{delay}</strong> {delay === 1 ? 'course' : 'courses'} on the longest chain through it</li>
				{#if slip !== undefined}
					{#if slip > 0}
						<li class="bad"><strong>Critical.</strong> Taking it a term later delays graduation by {slip === Infinity ? 'more than the plan can show' : termsText(termsLate(view, view.now.result.gradTermIndex, view.now.result.gradTermIndex + slip))}.</li>
					{:else}
						<li>Has slack. Taking it a term later does not move graduation.</li>
					{/if}
				{/if}
			</ul>
			<h4>Requires</h4>
			{#if preGroups(c).length || c.co?.length || c.standing || c.coi || c.note}
				<ul class="pl-reqs">
					{#each preGroups(c) as g, gi (gi)}
						<li>{@render group(g)}</li>
					{/each}
					{#each c.co || [] as x (x)}
						<li>Take with {@render group([x])} (corequisite)</li>
					{/each}
					{#if c.standing}<li>{c.standing === 'senior' ? 'Senior' : 'Junior'} standing (assumed {c.standing === 'senior' ? '75' : '50'}% of total units)</li>{/if}
					{#if c.coi}<li>Consent of instructor (COI) also works</li>{/if}
					{#if c.note}<li class="pl-muted">AMIS says {c.note}</li>{/if}
				</ul>
			{:else}
				<p class="pl-muted">No prerequisites.</p>
			{/if}
			<h4>Unlocks</h4>
			{#if deps.length}
				<p class="pl-deps">{#each deps as d (d)}{@render group([d])}{/each}</p>
			{:else}
				<p class="pl-muted">Nothing else in your checklist.</p>
			{/if}
			<div class="pl-actions">
				{#if i.status !== 'passed'}<button type="button" class="btn btn-secondary" onclick={() => act('passed', code)}><Icon name="check" />Mark passed</button>{/if}
				{#if i.status !== 'failed'}<button type="button" class="btn btn-secondary" onclick={() => act('failed', code)}><Icon name="x" />{past || i.status === 'inprogress' ? 'Mark failed' : 'Mark failed (what-if)'}</button>{/if}
				{#if i.override}<button type="button" class="textbtn" onclick={() => act('clear', code)}>Use {past ? 'my grades' : 'the plan'} again</button>{/if}
				{#if t !== undefined}<button type="button" class="textbtn" onclick={() => act('later', code)}>Take a term later</button>{/if}
				{#if app.s.plannerPins[code] != null}<button type="button" class="textbtn" onclick={() => act('unpin', code)}>Back to earliest</button>{/if}
			</div>
			{#if restricted(c) && i.status !== 'passed'}
				<label class="pl-petition">
					<input type="checkbox" checked={!!app.s.plannerPetitions[code]} onchange={(e) => togglePetition(code, e.currentTarget.checked)} />
					<span>Plan on a petitioned class when it is not offered. It needs about 10 students and department, college and OVCAA approval, so treat it as conditional.</span>
				</label>
			{/if}
		</aside>
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
			<span class="pl-link st-{st}" title="Not in your checklist"><Icon name="planned" size={14} />{code}</span>
		{/if}
	{/each}
{/snippet}

{#if !view || !layout || !sum || !model}
	<Notice>The planner does not have a checklist for this program yet.</Notice>
{:else}
	<div class="planner">
		{#if notice}
			<Notice tone={notice.bad ? 'bad' : 'ok'} live>{notice.text}</Notice>
		{/if}
		{#if !quality.confident}
			<Notice tone="warn"><strong>Treat this plan as a rough guide.</strong> {quality.reasons.join(' ')}</Notice>
		{/if}

		<section class="pl-summary" aria-live="polite">
			<p class="pl-grad" data-testid="grad-term">
				<span>{sum.headline}</span>
				{#if sum.deltaText}<span class="pl-delta" class:ok={sum.deltaOk}><Icon name={sum.deltaOk ? 'check' : 'alert'} />{sum.deltaText}</span>{/if}
			</p>
			<p class="pl-sub">{sum.sub}</p>
			{#if sum.costs.length}
				<ul class="pl-costs">
					{#each sum.costs as c (c.code)}
						<li class:bad={c.cost > 0}>
							<Icon name={c.cost > 0 ? 'x' : 'check'} size={16} /><strong>{c.code}</strong>
							{c.source === 'whatif' ? '(what-if)' : c.past ? 'failed' : '(marked failed)'}, {c.cost > 0 ? `+${termsText(c.cost)}` : 'no delay'}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="pl-controls">
			<form class="pl-whatif" onsubmit={simulate}>
				<span class="pl-whatif-lead" id="wi-lead">What if I</span>
				<select class="select" bind:value={wiMode} aria-label="Scenario">
					<option value="fail">fail</option>
					<option value="1">take a term later</option>
					<option value="3">take a year later</option>
				</select>
				<select class="select" bind:value={wiCode} aria-label="Course">
					<option value="">pick a course</option>
					{#each whatifCodes as c (c)}<option value={c}>{c}</option>{/each}
				</select>
				<button class="btn btn-primary" type="submit">Simulate</button>
				{#if app.whatif}<button class="textbtn" type="button" onclick={clearWhatif}>Clear</button>{/if}
			</form>
			<details class="pl-menu" bind:this={menu}>
				<summary class="btn btn-secondary">Plan options<Icon name="chevron" /></summary>
				<div class="pl-menu-pop">
					<button type="button" class="pl-menu-item" onclick={autoPlan}>Auto-plan again<small>Drops courses you pushed later</small></button>
					<label class="pl-menu-item">
						Max load per sem
						<select class="select" value={String(options.cap)} onchange={(e) => setOptions({ cap: Number(e.currentTarget.value) })}>
							<option value="18">18 units</option>
							<option value="21">21 units (with lab courses)</option>
						</select>
					</label>
					<label class="pl-menu-item pl-check"><input type="checkbox" checked={options.midyear} onchange={(e) => setOptions({ midyear: e.currentTarget.checked })} /> Take classes in midyear</label>
					<label class="pl-menu-item pl-check"><input type="checkbox" checked={options.midyear9} onchange={(e) => setOptions({ midyear9: e.currentTarget.checked })} /> Midyear up to 9 units (Dean's approval)</label>
					<button type="button" class="pl-menu-item" onclick={savePlan}>Save plan<small>Download your marks, moves and options as a file</small></button>
					<button type="button" class="pl-menu-item" onclick={() => planInput?.click()}>Load plan<small>Restore a plan file you saved earlier</small></button>
					<button type="button" class="pl-menu-item" onclick={exportXlsx}>Export to Excel<small>A color-coded sheet laid out like this map</small></button>
					<button type="button" class="pl-menu-item pl-danger" onclick={resetPlan}>Reset plan<small>Clears marks, moves and petitions</small></button>
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

		<div class="pl-legend">
			{#each LEGEND as s (s)}<span class="pl-chip st-{s}"><Icon name={icon(s)} size={14} />{STATUS[s][1]}</span>{/each}
			<span class="pl-chip crit-chip">Critical</span>
			<span class="pl-chip"><Icon name="flag" size={14} />Petition</span>
			<details class="pl-tips">
				<summary><Icon name="info" size={16} />How to read this</summary>
				<div class="pl-tips-pop">
					<p>Each column is a term. Past terms come from your grades. Future terms are the earliest plan that respects prerequisites, the sems each course is actually offered, and your unit cap.</p>
					<p>Select a course to see its full prerequisite chain, what it unlocks and how many courses a failure would block. Mark a course failed to see the retake and the delay.</p>
					<p>Thin maroon lines are the critical path, the courses where a one-term slip delays graduation.</p>
					<p>Offerings come from AMIS class listings for 2023 to 2026. Free electives are not included.</p>
				</div>
			</details>
		</div>

		<p class="pl-result" aria-live="polite">{wiResult}</p>

		<div class="pl-scroll">
			<svg class="pl-arrows" width={svgSize.w} height={svgSize.h} aria-hidden="true">
				<defs>
					<marker id="pl-arrow-chain" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="pl-arrowhead" /></marker>
					<marker id="pl-arrow-crit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" class="pl-arrowhead" /></marker>
				</defs>
				{#each paths as p, k (k)}<path class="pl-edge {p.kind}" d={p.d} marker-end="url(#pl-arrow-{p.kind})" />{/each}
			</svg>
			<div
				class="pl-grid"
				data-testid="planner-grid"
				bind:this={gridEl}
				role="presentation"
				onmouseleave={() => (hover = null)}
				ontoggle={() => relayout++}
			>
				{#each layout.list as column (column.abs)}
					{@const f = columnFacts(column, view)}
					<section class="pl-col" class:past={f.isPast} aria-label="{f.name} {f.sub}">
						<details open={!(phone && f.isPast)}>
							<summary class="pl-col-head">
								<span class="pl-col-name">{f.name} {#if f.tag}<span class="pl-tag {f.tag === 'Now' ? 'now' : f.tag === 'Taken' ? 'past' : ''}">{f.tag}</span>{/if}</span>
								<span class="pl-col-sub">{f.sub}<span class="pl-col-units" class:warn={f.loud} title={f.warn || undefined}>{#if f.loud}<Icon name="alert" size={13} />{/if}{f.units} units</span></span>
								{#if f.warn}<span class="visually-hidden">{f.warn}</span>{/if}
							</summary>
							<div class="pl-cards">
								{#each column.cards as card (card)}
									{@const c = model.byCode.get(card.code)!}
									{@const facts = cardFacts(card, view)}
									{@const isPrimary = layout.primary[card.code] === card}
									<div
										class={cardClass(card, isPrimary, facts.crit)}
										role="button"
										tabindex="0"
										data-code={card.code}
										data-primary={isPrimary ? '1' : undefined}
										aria-pressed={selected === card.code && isPrimary}
										aria-label="{c.code}, {c.title}. {facts.statusLabel}{facts.crit ? ', critical' : ''}. {c.units} units, {offeringLabel(c)}.{card.waitingOn ? ` Waiting on ${card.waitingOn}.` : ''}"
										onclick={() => select(card.code)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												select(card.code);
											}
										}}
										onmouseenter={() => (hover = card.code)}
									>
										<span class="pl-card-top"><StatusLabel status={card.status} label={facts.statusLabel} /><span class="pl-units">{c.units}u</span></span>
										<span class="pl-code">{c.code}{#if card.pinned}<span class="pl-pin" title="Moved later by you"> *</span>{/if}</span>
										<span class="pl-title">{c.title}</span>
										<span class="pl-card-foot"><span class="pl-offer">{offeringLabel(c)}</span>{#if facts.crit}<span class="pl-crit">Critical</span>{/if}</span>
										{#if facts.note}<span class="pl-note" class:warn={facts.note.warn}>{#if facts.note.icon}<Icon name={facts.note.icon as IconName} size={13} />{/if}{facts.note.text}</span>{/if}
									</div>
									{#if phone && isPrimary && selected === card.code}{@render detail(card.code)}{/if}
								{:else}
									<p class="pl-empty">Nothing offered that fits</p>
								{/each}
							</div>
						</details>
					</section>
				{/each}
			</div>
		</div>

		{#if !phone && selected && model.byCode.has(selected)}{@render detail(selected)}{/if}
		<span class="visually-hidden" aria-live="polite">{status}</span>
	</div>
{/if}
