<script lang="ts" module>
	import { courseOptions } from '#lib/grades.ts';
	import { UPLB_PROGRAMS } from '#lib/curriculum.ts';

	// Built once: every catalog and checklist course, for the code autocomplete.
	let options: ReturnType<typeof courseOptions> | null = null;
	const getOptions = () => (options ??= courseOptions(Object.values(UPLB_PROGRAMS)));
</script>

<script lang="ts">
	import { app } from '#lib/app.svelte.ts';
	import { addCourse, VALID_GRADES } from '#lib/importers.ts';
	import { calendarAbs } from '#lib/planner.ts';
	import type { SemNo } from '#lib/grades.ts';
	import Icon from './Icon.svelte';

	const nowAbs = calendarAbs();
	const thisAy = Math.floor(nowAbs / 3);
	const years = Array.from({ length: 12 }, (_, i) => thisAy - i);

	let ay = $state(thisAy);
	let sem = $state<SemNo>(((nowAbs % 3) + 1) as SemNo);
	let code = $state('');
	let title = $state('');
	let units = $state(3);
	let grade = $state('');
	let error = $state('');
	let added = $state('');
	let codeInput: HTMLInputElement | undefined = $state();

	const all = getOptions();
	const byCode = new Map(all.map((o) => [o.code, o]));
	const norm = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim();

	// Fill title and units when the typed code matches a known course.
	function onCode() {
		const hit = byCode.get(norm(code));
		if (hit) {
			title = hit.title;
			units = hit.units;
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const c = norm(code);
		if (!/^[A-Z]{2,8} ?\d{1,3}(\.\d{1,2})?[A-Z]?$/.test(c) && !byCode.has(c)) {
			error = 'Enter a course code like CMSC 12 or MATH 27.';
			return;
		}
		if (!(units >= 0 && units <= 12)) {
			error = 'Units should be a number from 0 to 12.';
			return;
		}
		error = '';
		const id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		app.s.gradesData = addCourse(app.s.gradesData, ay, sem, { code: c, title, units, grade }, id);
		if (!app.s.source) app.s.source = 'manual';
		added = `Added ${c}${grade ? ` with ${grade}` : ''}.`;
		code = '';
		title = '';
		units = 3;
		grade = '';
		codeInput?.focus();
	}
</script>

<form class="editor" onsubmit={submit} novalidate>
	<div class="term">
		<div class="field">
			<label for="ge-ay">Academic year</label>
			<select id="ge-ay" class="select" bind:value={ay}>
				{#each years as y (y)}
					<option value={y}>{y} to {y + 1}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="ge-sem">Semester</label>
			<select id="ge-sem" class="select" bind:value={sem}>
				<option value={1}>1st semester</option>
				<option value={2}>2nd semester</option>
				<option value={3}>Midyear</option>
			</select>
		</div>
	</div>
	<div class="course">
		<div class="field code">
			<label for="ge-code">Course code</label>
			<input id="ge-code"
				bind:this={codeInput}
				class="input"
				bind:value={code}
				oninput={onCode}
				list="course-codes"
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				placeholder="CMSC 12"
				required
			/>
		</div>
		<div class="field title">
			<label for="ge-title">Title</label>
			<input id="ge-title" class="input" bind:value={title} placeholder="Filled in for known courses" />
		</div>
		<div class="field units">
			<label for="ge-units">Units</label>
			<input id="ge-units" class="input" type="number" min="0" max="12" step="1" bind:value={units} />
		</div>
		<div class="field grade">
			<label for="ge-grade">Grade</label>
			<select id="ge-grade" class="select" bind:value={grade}>
				<option value="">No grade yet</option>
				{#each VALID_GRADES as g (g)}
					<option value={g}>{g}</option>
				{/each}
			</select>
		</div>
		<button class="btn btn-primary add" type="submit"><Icon name="plus" />Add course</button>
	</div>
	<datalist id="course-codes">
		{#each all as o (o.code)}
			<option value={o.code}>{o.title}</option>
		{/each}
	</datalist>
	<p class="status" class:bad={!!error} role="status">{error || added}</p>
</form>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.term,
	.course {
		display: grid;
		gap: 10px;
		grid-template-columns: 1fr 1fr;
	}

	.code,
	.title,
	.add {
		grid-column: 1 / -1;
	}

	.status {
		min-height: 1.4em;
		font-size: 0.9rem;
		color: var(--ok);
	}

	.status.bad {
		color: var(--bad);
	}

	@media (min-width: 720px) {
		.term {
			grid-template-columns: 220px 220px;
		}

		.course {
			grid-template-columns: 160px 1fr 90px 140px auto;
			align-items: end;
		}

		.code,
		.title,
		.add {
			grid-column: auto;
		}
	}
</style>
