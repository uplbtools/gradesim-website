<script lang="ts">
	import { app } from '#lib/app.svelte.ts';
	import { honorFor } from '#lib/grades.ts';
	import Icon from './Icon.svelte';

	const g = $derived(app.gwa);
	const honor = $derived(honorFor(g.gwa));
</script>

<section class="summary" aria-label="Summary">
	<div class="gwa">
		<span class="label">Your GWA</span>
		<span class="value" data-testid="gwa">{g.gwa > 0 ? g.gwa.toFixed(4) : 'No grades yet'}</span>
		{#if honor}
			<span class="honor {honor.key}"><Icon name="award" />{honor.name} track</span>
		{/if}
	</div>
	<dl class="stats">
		<div>
			<dt>Units in GWA</dt>
			<dd>{g.totalUnits}{#if g.excludedCount}<small> ({g.excludedUnits} left out)</small>{/if}</dd>
		</div>
		<div>
			<dt>Courses</dt>
			<dd>{g.totalCourses}{#if g.excludedCount}<small> ({g.excludedCount} left out)</small>{/if}</dd>
		</div>
		<div>
			<dt>Program</dt>
			<dd class="prog">{app.program.name}</dd>
		</div>
	</dl>
</section>

<style>
	.summary {
		display: grid;
		gap: 16px;
		padding: 20px;
		border-radius: var(--radius-lg);
		background: var(--bg-elevated);
		border: 1px solid var(--border);
	}

	.gwa {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}

	.label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--muted);
	}

	.value {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2.4rem, 1.8rem + 3vw, 3.6rem);
		line-height: 1;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.honor {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		padding: 3px 10px;
		border-radius: var(--radius-pill);
		border: 1px solid var(--brand-line);
		background: var(--brand-tint);
		color: var(--brand);
		font-weight: 650;
		font-size: 0.88rem;
	}

	.stats {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 12px;
	}

	dt {
		font-size: 0.78rem;
		color: var(--muted);
		font-weight: 600;
	}

	dd {
		margin: 2px 0 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	dd small {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
	}

	.prog {
		font-size: 1rem;
	}

	@media (min-width: 720px) {
		.summary {
			grid-template-columns: auto 1fr;
			align-items: end;
			gap: 32px;
			padding: 24px 28px;
		}
	}
</style>
