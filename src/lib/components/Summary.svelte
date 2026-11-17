<script lang="ts">
	import { app } from '#lib/app.svelte.ts';
	import { normalizeCourseCode } from '#lib/curriculum.ts';
	import { calculateGWA, honorFor, lightSems, standingFor } from '#lib/grades.ts';
	import { modelFor, planTrack } from '#lib/planner.ts';
	import { amisCourses, surplusElectives } from '#lib/requirements.ts';
	import Icon from './Icon.svelte';

	const g = $derived(app.gwa);
	// Extra electives stay in the GWA but not in the one for Latin honors.
	const surplus = $derived.by(() => {
		const model = app.program.available ? modelFor(app.program.code, planTrack(app.program, app.grades, app.s.track), app.specialization, app.fixes) : null;
		const passed = amisCourses(app.grades).filter((r) => r.result === 'passed');
		return model ? surplusElectives(model.courses, passed, app.s.substitutions) : [];
	});
	const honors = $derived.by(() => {
		if (!surplus.length) return g;
		const skip = new Set(surplus.map((r) => `${r.termId}:${r.code}`));
		return calculateGWA(
			app.courses.filter((c) => !skip.has(`${c.termKey}:${normalizeCourseCode(c.code)}`)),
			app.excluded
		);
	});
	const honor = $derived(honorFor(honors.gwa, honors.totalUnits));
	const light = $derived(honor ? lightSems(app.courses) : []);
	const standing = $derived(standingFor(app.courses));
	const STANDING = {
		warning: "Under UPLB's rules on scholastic standing, that gets a warning from your Dean.",
		probation: 'That puts you on probation next sem, and your Dean may limit your load. Passing more than half your units next sem lifts it.',
		dropped: "Under UPLB's rules that can drop you from your college. Talk to your College Secretary about readmission.",
		barred: "Under UPLB's rules that can bar you from readmission. Talk to your College Secretary soon."
	};
</script>

<section class="summary" aria-label="Your GWA">
	<h2 class="gwa">
		{#if g.gwa > 0}GWA <span data-testid="gwa">{g.gwa.toFixed(4)}</span>{:else}<span data-testid="gwa">No grades yet</span>{/if}
		{#if honor}<span class="honor {honor.key}"><Icon name="award" />In {honor.name.toLowerCase()} range</span>{/if}
	</h2>
	<p class="sub">
		{g.passedUnits} units passed{#if g.excludedCount}, {g.excludedUnits} left out{/if}.
	</p>
	{#if standing}
		<p class="sub" data-testid="standing">
			{standing.low} of {standing.units} units in {standing.label} got grades below 3.00. {STANDING[standing.level]}
		</p>
	{/if}
	{#if light.length}
		<p class="sub" data-testid="light-sems">
			{light.map((s) => `${s.label} had ${s.units} units`).join(', and ')}. Latin honors need at least 15 units each sem, or the checklist's load when it's lower, unless your college accepted a reason such as health.
		</p>
	{/if}
	{#if surplus.length}
		<p class="sub">
			Your GWA for Latin honors is <strong data-testid="honors-gwa">{honors.gwa.toFixed(4)}</strong>. It counts only the electives your program requires and leaves out {surplus.map((r) => r.code).join(', ')}.
		</p>
	{/if}
</section>

<style>
	.summary {
		margin: 6px 0 4px;
	}

	.gwa {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(1.6rem, 3.2vw, 2.4rem);
		line-height: 1.15;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.honor {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		border-radius: var(--radius-pill);
		border: 1px solid var(--brand-line);
		background: var(--brand-tint);
		color: var(--brand);
		font-family: var(--font-sans);
		font-weight: 650;
		font-size: 0.88rem;
	}

	.sub {
		margin-top: 4px;
		max-width: 60ch;
		color: var(--muted);
		font-size: 0.88rem;
	}

	.sub strong {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
</style>
