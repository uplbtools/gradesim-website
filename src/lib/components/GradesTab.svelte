<script lang="ts">
	import { resolve } from '$app/paths';
	import { app, download } from '#lib/app.svelte.ts';
	import {
		formatGrade,
		gradeTone,
		groupCourses,
		groupGWA,
		NON_NUMERIC_GRADES,
		scholarFor,
		substituteOptions
	} from '#lib/grades.ts';
	import { makeBackup, removeCourse, setGrade, VALID_GRADES } from '#lib/importers.ts';
	import { today } from '#lib/planner.ts';
	import Icon from './Icon.svelte';
	import FileButton from './FileButton.svelte';
	import GradeEditor from './GradeEditor.svelte';

	let {
		extension,
		onExtension,
		onFile
	}: {
		extension: 'checking' | 'found' | 'empty' | 'missing';
		onExtension: () => void;
		onFile: (f: File) => void;
	} = $props();

	let view = $state<'term' | 'year'>('term');
	let editing = $state(false);
	let subReq = $state('');
	let subTaken = $state('');

	const groups = $derived(groupCourses(app.courses, view));
	const subOptions = $derived(substituteOptions(app.program, app.gwa.completedCourses, app.s.substitutions));
	const required = $derived([...app.program.majorCourses].sort((a, b) => a.code.localeCompare(b.code)));
	const SOURCE = { extension: 'the GradeSim extension', file: 'a file you imported', manual: 'grades you entered' };

	function addSub() {
		if (!subReq || !subTaken) return;
		app.s.substitutions = { ...app.s.substitutions, [subReq]: subTaken };
		subReq = '';
		subTaken = '';
	}

	function removeSub(req: string) {
		const next = { ...app.s.substitutions };
		delete next[req];
		app.s.substitutions = next;
	}

	function exportBackup() {
		const json = JSON.stringify(makeBackup(app.s), null, 2);
		download(`elbi-gradesim-backup-${today()}.json`, new Blob([json], { type: 'application/json' }));
	}

	function clearAll() {
		if (!confirm('Clear everything GradeSim saved in this browser? Your grades, exclusions, substitutions and plan are removed. This cannot be undone, so export a backup first if you want one.')) return;
		app.clear();
	}
</script>

<div class="grades">
	<div class="toolbar">
		<div class="seg" role="group" aria-label="Group courses">
			<button type="button" aria-pressed={view === 'term'} onclick={() => (view = 'term')}>By term</button>
			<button type="button" aria-pressed={view === 'year'} onclick={() => (view = 'year')}>By year</button>
		</div>
		<button class="btn btn-secondary" type="button" aria-expanded={editing} onclick={() => (editing = !editing)}>
			<Icon name="pencil" />{editing ? 'Done editing' : 'Add or edit grades'}
		</button>
	</div>

	{#if editing}
		<section class="card" aria-labelledby="add-title">
			<h2 id="add-title" class="h">Add a course</h2>
			<GradeEditor />
			<p class="muted small">To change or remove a course, use the controls on its row below.</p>
		</section>
	{/if}

	{#each groups as g (g.key)}
		{@const group = groupGWA(g.courses, app.excluded)}
		{@const gwa = group.gwa}
		{@const scholar = scholarFor(group)}
		<section class="group" aria-label={g.label}>
			<header>
				<h2>{g.label}</h2>
				<span class="ggwa">GWA {gwa > 0 ? gwa.toFixed(4) : 'not yet'}</span>
				{#if scholar}<span class="badge">{scholar}</span>{/if}
			</header>
			<ul>
				{#each g.courses as c (c.id)}
					{@const tone = gradeTone(c.grade)}
					{@const nonNumeric = NON_NUMERIC_GRADES.includes(c.grade) || !c.grade}
					{@const out = app.excluded.has(c.id)}
					<li class:out>
						<div class="info">
							<span class="code">{c.code}</span>
							<span class="title">{c.title}</span>
						</div>
						<div class="right">
							{#if editing}
								<label>
									<span class="visually-hidden">Grade for {c.code}</span>
									<select class="select mini" value={c.grade} onchange={(e) => (app.s.gradesData = setGrade(app.s.gradesData!, c.termKey, c.id, e.currentTarget.value))}>
										<option value="">No grade yet</option>
										{#each VALID_GRADES as v (v)}<option value={v}>{v}</option>{/each}
										{#if c.grade && !VALID_GRADES.includes(c.grade)}<option value={c.grade}>{c.grade}</option>{/if}
									</select>
								</label>
								<button class="iconbtn" type="button" aria-label="Remove {c.code} from {c.termLabel}" onclick={() => (app.s.gradesData = removeCourse(app.s.gradesData!, c.termKey, c.id))}>
									<Icon name="trash" />
								</button>
							{:else if !nonNumeric}
								<button
									class="excl"
									type="button"
									aria-pressed={out}
									aria-label={out ? `Count ${c.code} in your GWA again` : `Leave ${c.code} out of your GWA`}
									onclick={() => app.toggleExcluded(c.id)}
								>
									{out ? 'Left out' : 'Leave out'}
								</button>
							{/if}
							<span class="units">{c.units}u</span>
							{#if !editing}
								<span class="grade {tone}">
									{#if tone === 'failed'}<Icon name="x" size={14} />{:else if tone === 'other'}<Icon name="alert" size={14} />{/if}
									{formatGrade(c.grade)}
								</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	<section class="card" aria-labelledby="sub-title">
		<h2 id="sub-title" class="h">Course substitutions</h2>
		<p class="muted small">If a course you took stands in for a required one (a shiftee credit or an approved substitute), match them here. The planner and the what-if count the required course as done.</p>
		<div class="subform">
			<label class="field">
				Required course
				<select class="select" bind:value={subReq}>
					<option value="">Choose a required course</option>
					{#each required as r (r.code)}<option value={r.code.toUpperCase().trim()}>{r.code} ({r.units}u)</option>{/each}
				</select>
			</label>
			<label class="field">
				Covered by
				<select class="select" bind:value={subTaken}>
					<option value="">Choose a course you passed</option>
					{#each subOptions as c (c.code)}<option value={c.code.toUpperCase().trim()}>{c.code} ({c.units}u, {c.grade})</option>{/each}
				</select>
			</label>
			<button class="btn btn-secondary" type="button" disabled={!subReq || !subTaken} onclick={addSub}>Apply substitution</button>
		</div>
		{#if Object.keys(app.s.substitutions).length}
			<ul class="subs">
				{#each Object.entries(app.s.substitutions) as [req, taken] (req)}
					<li>
						<span><strong>{req}</strong> is covered by <strong>{taken}</strong></span>
						<button class="iconbtn" type="button" aria-label="Remove the substitution for {req}" onclick={() => removeSub(req)}><Icon name="x" /></button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted small">No substitutions yet.</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="data-title">
		<h2 id="data-title" class="h">Your data</h2>
		<p class="small">
			{#if app.s.source}These grades came from {SOURCE[app.s.source]}.{/if}
			Everything is saved in this browser only. Export a backup to move it to another device; the file also loads in the extension.
		</p>
		<div class="actions">
			{#if extension === 'found'}
				<button class="btn btn-secondary" type="button" onclick={onExtension}><Icon name="plug" />Import from the GradeSim extension</button>
			{:else}
				<a class="btn btn-secondary" href={resolve('install/')}><Icon name="plug" />Get the extension</a>
			{/if}
			<FileButton label="Import a file" {onFile} />
			<button class="btn btn-secondary" type="button" onclick={exportBackup}><Icon name="download" />Export backup</button>
			<button class="btn btn-danger" type="button" onclick={clearAll}><Icon name="trash" />Clear my data</button>
		</div>
	</section>
</div>

<style>
	.grades {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
	}

	.seg {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-elevated);
	}

	.seg button {
		min-height: 38px;
		padding: 4px 14px;
		border: 0;
		border-radius: calc(var(--radius-sm) - 2px);
		background: none;
		color: var(--muted);
		font-weight: 600;
		cursor: pointer;
	}

	.seg button[aria-pressed='true'] {
		background: var(--brand);
		color: var(--on-brand);
	}

	.h {
		font-size: 1.1rem;
		margin-bottom: 6px;
	}

	.small {
		font-size: 0.88rem;
	}

	.group header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
		padding: 0 4px 8px;
	}

	.group h2 {
		font-size: 1.05rem;
	}

	.ggwa {
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--body);
		font-variant-numeric: tabular-nums;
	}

	.badge {
		padding: 1px 9px;
		border-radius: var(--radius-pill);
		background: var(--brand-tint-strong);
		color: var(--brand);
		font-size: 0.76rem;
		font-weight: 700;
	}

	.group ul {
		list-style: none;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-elevated);
		overflow: hidden;
	}

	.group li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 12px;
		min-height: 52px;
	}

	.group li + li {
		border-top: 1px solid var(--border);
	}

	.group li.out .info {
		opacity: 0.55;
		text-decoration: line-through;
	}

	.info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.code {
		font-weight: 700;
		color: var(--ink);
	}

	.title {
		font-size: 0.82rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 0 0 auto;
	}

	.units {
		font-size: 0.78rem;
		font-weight: 600;
		padding: 1px 7px;
		border-radius: var(--radius-pill);
		background: var(--brand-tint);
		color: var(--body);
	}

	.grade {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 3px;
		min-width: 3.6em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}

	.grade.excellent,
	.grade.satisfactory {
		color: var(--ok);
	}

	.grade.failed {
		color: var(--bad);
	}

	.grade.other {
		color: var(--warn);
	}

	.excl {
		min-height: 32px;
		padding: 2px 10px;
		border: 1px solid var(--border-input);
		border-radius: var(--radius-pill);
		background: var(--bg-card);
		color: var(--muted);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
	}

	.excl[aria-pressed='true'] {
		border-color: var(--warn);
		color: var(--warn);
	}

	.iconbtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		color: var(--body);
		cursor: pointer;
	}

	.mini {
		min-height: 40px;
		width: auto;
		padding: 4px 8px;
	}

	.subform {
		display: grid;
		gap: 10px;
		margin-top: 10px;
	}

	.subs {
		list-style: none;
		padding: 0;
		margin-top: 10px;
	}

	.subs li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}

	@media (min-width: 720px) {
		.subform {
			grid-template-columns: 1fr 1fr auto;
			align-items: end;
		}
	}
</style>
