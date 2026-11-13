<script lang="ts">
	import { untrack } from 'svelte';
	import { FIX_SEMS, validateFix, type ChecklistFix, type FixSem } from '#lib/fix.ts';
	import { offeredIn, type PlanCourse } from '#lib/scheduler.ts';

	// Edits one checklist row, or adds a missing one when no course is given.
	let { course, onsave, oncancel }: { course?: PlanCourse; onsave: (fix: ChecklistFix) => void; oncancel: () => void } = $props();

	const was = untrack(() => ({
		units: course?.units ?? 3,
		prereqs: (course?.pre ?? []).map((g) => g[0]).join(', '),
		sems: FIX_SEMS.map(([s]) => s).filter((s) => !course || offeredIn(course, s))
	}));
	let code = $state('');
	let title = $state('');
	let units = $state(was.units);
	let prereqs = $state(was.prereqs);
	let sems = $state<FixSem[]>(was.sems);
	let note = $state('');
	let error = $state('');

	function save(e: SubmitEvent) {
		e.preventDefault();
		submit(
			course
				? {
						kind: 'edit',
						code: course.code,
						units: units !== was.units ? units : undefined,
						prereqs: prereqs.trim() !== was.prereqs ? prereqs : undefined,
						sems: [...sems].sort().join() !== [...was.sems].sort().join() ? sems : undefined,
						note
					}
				: { kind: 'add', code, title, units, prereqs, sems, note }
		);
	}

	function submit(raw: unknown) {
		const fix = validateFix(raw);
		if (typeof fix === 'string') error = fix;
		else onsave(fix);
	}
</script>

<form class="pl-fix" onsubmit={save}>
	<p><strong>{course ? `Fix ${course.code}` : 'Add a missing course'}</strong></p>
	{#if !course}
		<label class="field">Course code<input class="input" bind:value={code} placeholder="CMSC 123" required /></label>
		<label class="field">Title<input class="input" bind:value={title} maxlength="120" required /></label>
	{/if}
	<label class="field">Units<input class="input" type="number" min="1" max="12" bind:value={units} required /></label>
	<label class="field">
		Prerequisites
		<input class="input" bind:value={prereqs} placeholder="None" />
		<small>Write course codes with commas between them. Leave it empty when there are none.</small>
	</label>
	<fieldset>
		<legend>Offered in</legend>
		{#each FIX_SEMS as [value, label] (value)}
			<label class="check"><input type="checkbox" bind:group={sems} {value} /> {label}</label>
		{/each}
	</fieldset>
	<label class="field">
		Note for the maintainers (optional)
		<input class="input" bind:value={note} maxlength="300" placeholder="Where you saw this" />
	</label>
	{#if error}<p class="pl-fix-error" role="alert">{error}</p>{/if}
	<div class="pl-actions">
		<button class="btn btn-primary" type="submit">{course ? 'Save fix' : 'Add course'}</button>
		{#if course}
			<button class="btn btn-secondary" type="button" onclick={() => submit({ kind: 'remove', code: course.code, note })}>Not in my curriculum</button>
		{/if}
		<button class="textbtn" type="button" onclick={oncancel}>Cancel</button>
	</div>
</form>
