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
		scholarHolds,
		substituteOptions
	} from '#lib/grades.ts';
	import { makeBackup, removeCourse, setGrade, VALID_GRADES } from '#lib/importers.ts';
	import { packLink } from '#lib/link.ts';
	import { today, unitsText } from '#lib/planner.ts';
	import { removalKey } from '#lib/requirements.ts';
	import Icon from './Icon.svelte';
	import Summary from './Summary.svelte';
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
	const subCount = $derived(Object.keys(app.s.substitutions).length);
	const holds = $derived(scholarHolds(app.courses));
	const subOptions = $derived(substituteOptions(app.program, app.gwa.completedCourses, app.s.substitutions));
	const required = $derived([...app.program.majorCourses].sort((a, b) => a.code.localeCompare(b.code)));
	const SOURCE = { extension: 'the extension', file: 'a backup or a link', manual: 'what you entered by hand' };

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

	let link = $state<'copied' | 'failed' | null>(null);
	async function copyLink() {
		const url = await packLink(makeBackup(app.s), location.origin + resolve('/'));
		link = await navigator.clipboard.writeText(url).then(
			() => 'copied' as const,
			() => 'failed' as const
		);
	}

	function clearAll() {
		if (!confirm("Clear everything GradeSim saved in this browser? Your grades, left-out courses, substitutions and plan are removed. This can't be undone, so save a backup first if you want one.")) return;
		app.clear();
	}
</script>

<div class="grades">
	<Summary />
	<div class="toolbar">
		<div class="seg" role="group" aria-label="Group courses">
			<button type="button" aria-pressed={view === 'term'} onclick={() => (view = 'term')}>By sem</button>
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
			<p class="muted small">To change, remove or leave out a course, use the controls on its row below.</p>
		</section>
	{/if}

	<div class="card folds">
		<details class="fold">
			<summary><Icon name="chevron" size={16} />{`Course substitutions${subCount ? ` (${subCount})` : ''}`}</summary>
			{#if subCount}
				<ul class="subs">
					{#each Object.entries(app.s.substitutions) as [req, taken] (req)}
						<li>
							<span><strong>{req}</strong> is covered by <strong>{taken}</strong></span>
							<button class="iconbtn" type="button" aria-label="Remove the substitution for {req}" onclick={() => removeSub(req)}><Icon name="x" /></button>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="muted small">Match a course you passed to the required course it stands in for. The planner and the what-if count it as done.</p>
			<div class="subform">
				<label class="field">
					Required course
					<select class="select" bind:value={subReq}>
						<option value="">Choose a required course</option>
						{#each required as r (r.code)}<option value={r.code.toUpperCase().trim()}>{r.code}{r.units ? `, ${unitsText(r.units)}` : ''}</option>{/each}
					</select>
				</label>
				<label class="field">
					Covered by
					<select class="select" bind:value={subTaken}>
						<option value="">Choose a course you passed</option>
						{#each subOptions as c (c.code)}<option value={c.code.toUpperCase().trim()}>{c.code}, {unitsText(c.units)}, {formatGrade(String(c.grade))}</option>{/each}
					</select>
				</label>
				<button class="btn btn-secondary" type="button" disabled={!subReq || !subTaken} onclick={addSub}>Apply substitution</button>
			</div>
		</details>

		<details class="fold">
			<summary><Icon name="chevron" size={16} />Back up or clear your data</summary>
			<p class="small">
				{#if app.s.source}These grades came from {SOURCE[app.s.source]}.{/if}
				It's saved in this browser only. A backup moves it to another device or the extension.
			</p>
			<div class="actions">
				{#if extension === 'found'}
					<button class="btn btn-secondary" type="button" onclick={onExtension}><Icon name="plug" />Import from the extension</button>
				{:else}
					<a class="btn btn-secondary" href={resolve('install/')}><Icon name="plug" />Get the extension</a>
				{/if}
				<FileButton label="Load backup" {onFile} />
				<button class="btn btn-secondary" type="button" onclick={exportBackup}><Icon name="download" />Save backup</button>
				<button class="btn btn-secondary" type="button" onclick={copyLink}><Icon name="external" />Copy a link to my grades</button>
				<button class="btn btn-danger" type="button" onclick={clearAll}><Icon name="trash" />Clear my data</button>
			</div>
			<p class="small" aria-live="polite">
				{#if link === 'failed'}
					Your browser blocked the copy. Save a backup instead.
				{:else}
					{link === 'copied' ? 'The link is copied.' : 'The link opens your grades on another device, such as your phone.'}
					It holds your grades, so send it only to yourself.
				{/if}
			</p>
		</details>
	</div>

	{#each groups as g, i (g.key)}
		{@const group = groupGWA(g.courses, app.excluded)}
		{@const gwa = group.gwa}
		{@const scholar = g.courses.some((c) => holds.has(c.termKey)) ? null : scholarFor(group)}
		<details class="group" open={editing || i === 0} aria-label={g.label} role="region">
			<summary>
				<Icon name="chevron" size={16} />
				<h2>{g.label}</h2>
				{#if scholar}<span class="badge">{scholar}</span>{/if}
				<span class="ggwa">{gwa > 0 ? `GWA ${gwa.toFixed(4)}` : 'No GWA yet'}</span>
			</summary>
			<ul>
				{#each g.courses as c (c.id)}
					{@const tone = gradeTone(c.grade)}
					{@const nonNumeric = NON_NUMERIC_GRADES.includes(c.grade) || !c.grade}
					{@const out = app.excluded.has(c.id)}
					{@const raw = c.removalFrom ?? c.grade}
					<li class:out>
						<div class="info">
							<span class="code">{c.code}</span>
							<span class="title">{c.title}</span>
							{#if !editing && parseFloat(raw) === 4}
								{@const key = removalKey(c.termKey, c.code)}
								<select class="select removal" aria-label="Removal exam result for {c.code}" value={app.s.removals[key] ?? ''} onchange={(e) => app.setRemoval(key, e.currentTarget.value)}>
									<option value="">Removal exam not taken</option>
									<option value="pass">Passed removal, 3.00</option>
									<option value="fail">Failed removal, 5.00</option>
								</select>
							{/if}
						</div>
						<div class="right">
							{#if editing}
								<label>
									<span class="visually-hidden">Grade for {c.code}</span>
									<select class="select mini" value={raw} onchange={(e) => app.editGrades(setGrade(app.s.gradesData!, c.termKey, c.id, e.currentTarget.value))}>
										<option value="">No grade yet</option>
										{#each VALID_GRADES as v (v)}<option value={v}>{v}</option>{/each}
										{#if raw && !VALID_GRADES.includes(raw)}<option value={raw}>{raw}</option>{/if}
									</select>
								</label>
								<button class="iconbtn" type="button" aria-label="Remove {c.code} from {c.termLabel}" onclick={() => app.editGrades(removeCourse(app.s.gradesData!, c.termKey, c.id))}>
									<Icon name="trash" />
								</button>
							{/if}
							{#if !nonNumeric && (editing || out)}
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
							<span class="units">{unitsText(c.units)}</span>
							{#if !editing}
								<span class="grade {c.grade ? tone : 'none'}">
									{#if tone === 'failed'}<Icon name="x" size={14} />{:else if tone === 'other' && c.grade}<Icon name="alert" size={14} />{/if}
									{c.grade ? formatGrade(c.grade) : 'No grade yet'}
								</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</details>
	{/each}

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

	.group {
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-elevated);
		overflow: hidden;
	}

	.group > summary,
	.fold > summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		min-height: 48px;
		padding: 8px 12px;
		cursor: pointer;
		list-style: none;
	}

	.group > summary::-webkit-details-marker,
	.fold > summary::-webkit-details-marker {
		display: none;
	}

	.group > summary > :global(.icon),
	.fold > summary > :global(.icon) {
		color: var(--muted);
		transform: rotate(-90deg);
		transition: transform var(--transition-fast);
	}

	.group[open] > summary > :global(.icon),
	.fold[open] > summary > :global(.icon) {
		transform: none;
	}

	.group[open] > summary {
		border-bottom: 1px solid var(--border);
	}

	.group h2 {
		font-size: 1.05rem;
	}

	.ggwa {
		margin-left: auto;
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
		font-size: 0.8125rem;
		font-weight: 700;
	}

	.group ul {
		list-style: none;
		padding: 0;
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
		font-size: 0.8125rem;
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

	.grade.none {
		font-weight: 500;
		color: var(--muted);
	}

	.excl {
		min-height: 32px;
		padding: 2px 10px;
		border: 1px solid var(--border-input);
		border-radius: var(--radius-pill);
		background: var(--bg-card);
		color: var(--muted);
		font-size: 0.8125rem;
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

	.removal {
		align-self: flex-start;
		min-height: 40px;
		width: auto;
		max-width: 100%;
		margin-top: 4px;
		padding: 4px 8px;
		font-size: 0.82rem;
	}

	.subform {
		display: grid;
		gap: 10px;
		margin-top: 10px;
	}

	.folds {
		padding-block: 0;
	}

	.fold + .fold {
		border-top: 1px solid var(--border);
	}

	.fold > summary {
		padding-inline: 0;
		font-weight: 650;
		color: var(--ink);
	}

	.fold[open] {
		padding-bottom: 16px;
	}

	.fold p {
		margin: 0;
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

	@media (prefers-reduced-motion: reduce) {
		.group > summary > :global(.icon),
		.fold > summary > :global(.icon) {
			transition: none;
		}
	}

	@media (max-width: 719px) {
		.title {
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			white-space: normal;
		}

		.group li:has(.excl):not(:has(.mini)) {
			display: grid;
			grid-template: 'info units grade' 'info excl excl' / minmax(0, 1fr) auto auto;
			gap: 4px 8px;
		}

		.group li:has(.excl):not(:has(.mini)) .right {
			display: contents;
		}

		.info {
			grid-area: info;
		}

		.units {
			grid-area: units;
			align-self: center;
		}

		.grade {
			grid-area: grade;
		}

		.excl {
			grid-area: excl;
			justify-self: end;
		}

		.group li:has(.mini) {
			flex-wrap: wrap;
			row-gap: 6px;
		}

		.group li:has(.mini) .info {
			flex: 1 1 100%;
		}

		.group li:has(.mini) .right {
			margin-left: auto;
		}
	}

	@media (min-width: 720px) {
		.group li {
			min-height: 44px;
		}

		.info {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: baseline;
			column-gap: 12px;
		}

		.code {
			flex: 0 0 6.5em;
		}

		.title {
			flex: 1 1 0;
			font-size: 0.92rem;
		}

		.subform {
			grid-template-columns: 1fr 1fr auto;
			align-items: end;
		}
	}
</style>
