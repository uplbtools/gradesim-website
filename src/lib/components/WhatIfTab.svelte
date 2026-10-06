<script lang="ts">
	import { app } from '#lib/app.svelte.ts';
	import { detectTrack, getProgramDataQuality } from '#lib/curriculum.ts';
	import { HONORS } from '#lib/grades.ts';
	import { modelFor, planTrack } from '#lib/planner.ts';
	import { amisCourses, gwaOutlook, remainingRequirements } from '#lib/requirements.ts';
	import Icon from './Icon.svelte';
	import Notice from './Notice.svelte';

	// Counts come from requirements.ts, the same code the planner uses, so both show the same units left.
	const rows = $derived(amisCourses(app.s.gradesData));
	const detected = $derived(detectTrack(app.program, rows));
	const track = $derived(planTrack(app.program, app.s.gradesData, app.s.track));
	const quality = $derived(getProgramDataQuality(app.program.code));
	const left = $derived.by(() => {
		const model = app.program.available ? modelFor(app.program.code, track) : null;
		if (!model) return null;
		return remainingRequirements(
			model.courses,
			rows.filter((r) => r.result === 'passed'),
			{ substitutions: app.s.substitutions, overrides: app.s.customCourseStatus }
		);
	});
	const tracks = $derived(app.program.tracks ? Object.entries(app.program.tracks) : []);
	const g = $derived(app.gwa);

	// Start on the best honor still in reach, or cum laude.
	let picked = $state<string | null>(null);
	let custom = $state('');
	const startHonor = $derived(left ? gwaOutlook(g.gwa, g.totalUnits, left.gwaUnits, 1.75).bestHonor : null);
	const choice = $derived(picked ?? String(startHonor ? startHonor[1] : 1.75));
	const target = $derived(choice === 'custom' ? parseFloat(custom) : parseFloat(choice));
	const validTarget = $derived(target >= 1 && target <= 5);
	const targetName = $derived(HONORS.find((h) => h.max === target)?.name ?? `A GWA of ${validTarget ? target.toFixed(2) : '?'}`);

	// The newest failed course not passed since, for the planner link.
	const openFailure = $derived.by(() => {
		const passed = new Set(rows.filter((r) => r.result === 'passed').map((r) => r.code));
		const failed = rows.filter((r) => r.result === 'failed' && !passed.has(r.code));
		return failed.length ? failed[failed.length - 1].code : null;
	});

	const answer = $derived.by(() => {
		if (!left || !validTarget) return null;
		const o = gwaOutlook(g.gwa, g.totalUnits, left.gwaUnits, target);
		if (o.status === 'out-of-reach') {
			const best = o.bestHonor && gwaOutlook(g.gwa, g.totalUnits, left.gwaUnits, o.bestHonor[1]);
			const rest = best
				? `${o.bestHonor![0]} is still possible ${best.status === 'any-pass' ? 'if you pass everything' : `with an average of ${best.required!.toFixed(2)} or better`}.`
				: 'No Latin honor is in reach now, but every grade better than your GWA still raises it.';
			return {
				label: 'Best GWA still possible',
				value: o.ceiling.toFixed(2),
				note: 'with 1.00 in every course left',
				tone: 'bad',
				text: `${targetName} is out of reach. ${rest}`,
				failure: openFailure
			} as const;
		}
		if (o.status === 'any-pass') {
			const name = targetName.toLowerCase();
			return {
				label: 'Average you need',
				value: '3.00',
				note: 'any passing grade',
				tone: 'ok',
				text: g.gwa > 0 && g.gwa <= target ? `You are at ${name} now. Pass every course left and you keep it.` : `Pass every course left and you reach ${name}.`,
				failure: null
			} as const;
		}
		const r = o.required!;
		const how = r <= 1.25 ? 'excellent grades' : r <= 1.75 ? 'very good grades' : r <= 2.5 ? 'good grades' : 'grades a little better than passing';
		return {
			label: 'Average you need',
			value: r.toFixed(2),
			note: `on your ${left.gwaUnits} GWA units left`,
			tone: r <= 1.75 ? 'warn' : 'ok',
			text: `${targetName} is in reach with ${how}.`,
			failure: null
		} as const;
	});

	function seeCost(code: string) {
		app.whatif = { code, mode: 'fail' };
		location.hash = 'planner';
	}
</script>

<div class="whatif">
	{#if !quality.confident}
		<Notice tone="warn"><strong>Treat these numbers as a rough guide.</strong> {quality.reasons.join(' ')}</Notice>
	{/if}

	<section class="card" aria-labelledby="target-title">
		<h2 id="target-title" class="h">What GWA are you aiming for?</h2>
		<div class="targets" role="radiogroup" aria-labelledby="target-title">
			{#each HONORS as h (h.key)}
				<label class="target" class:on={choice === String(h.max)}>
					<input type="radio" name="target" value={String(h.max)} checked={choice === String(h.max)} onchange={() => (picked = String(h.max))} />
					<span class="tname">{h.name}</span>
					<span class="tmax">GWA {h.max.toFixed(2)} or better</span>
				</label>
			{/each}
			<label class="target" class:on={choice === 'custom'}>
				<input type="radio" name="target" value="custom" checked={choice === 'custom'} onchange={() => (picked = 'custom')} />
				<span class="tname">Your own target</span>
				<input
					class="input custom"
					type="number"
					min="1"
					max="5"
					step="0.01"
					placeholder="1.50"
					aria-label="Custom target GWA"
					bind:value={custom}
					onfocus={() => (picked = 'custom')}
				/>
			</label>
		</div>
	</section>

	<section class="card result" aria-live="polite" aria-labelledby="result-title">
		<h2 id="result-title" class="h">What you need</h2>
		{#if !left}
			<Notice tone="info">GradeSim does not have the {app.program.name} checklist yet, so it cannot count your remaining units. Your GWA above still works.</Notice>
		{:else if !validTarget}
			<p class="muted">Enter a target GWA from 1.00 to 5.00.</p>
		{:else if answer}
			<div class="big">
				<span class="label">{answer.label}</span>
				<span class="value" data-testid="required">{answer.value}</span>
				<span class="muted small">{answer.note}</span>
			</div>
			<Notice tone={answer.tone}>
				{answer.text}
				{#snippet action()}
					{#if answer.failure}
						{@const code = answer.failure}
						<button class="textbtn" type="button" aria-label="See what failing {code} costs in the planner" onclick={() => seeCost(code)}>See what this costs</button>
					{/if}
				{/snippet}
			</Notice>
			<dl>
				<div><dt>Current GWA</dt><dd>{g.gwa > 0 ? g.gwa.toFixed(4) : 'None yet'}</dd></div>
				<div><dt>Target</dt><dd>{target.toFixed(2)} or better</dd></div>
				<div><dt>GWA units so far</dt><dd>{g.totalUnits}</dd></div>
				<div><dt>GWA units left</dt><dd>{left.gwaUnits}</dd></div>
			</dl>
		{/if}
	</section>

	{#if left}
		<section class="card" aria-labelledby="rem-title">
			<h2 id="rem-title" class="h">Left to take for {app.program.name}</h2>
			<dl>
				<div><dt>Courses</dt><dd>{left.left.length}</dd></div>
				<div><dt>Units</dt><dd data-testid="units-left">{left.units}</dd></div>
				<div><dt>GE courses done</dt><dd>{left.ge.done} of {left.ge.total}</dd></div>
				{#if left.electives.totalUnits > 0}
					<div><dt>Free elective units done</dt><dd>{left.electives.doneUnits} of {left.electives.totalUnits}</dd></div>
				{/if}
			</dl>
			<a class="btn btn-secondary" href="#planner"><Icon name="planned" />See them in the planner</a>

			{#if tracks.length}
				<details class="track">
					<summary>Track</summary>
					{#if detected}
						<Notice tone="ok">Your grades show the {app.program.tracks![detected].name} ({app.program.tracks![detected].code}).</Notice>
					{:else}
						<Notice tone="warn">No SP or thesis course in your grades yet, so GradeSim assumes {app.program.tracks![track!].name} ({app.program.tracks![track!].code}). Pick yours below.</Notice>
						<div class="tracks" role="radiogroup" aria-label="Track">
							{#each tracks as [key, t] (key)}
								<label class="check">
									<input type="radio" name="track" value={key} checked={track === key} onchange={() => (app.s.track = key)} />
									<span><strong>{t.name}</strong> <span class="muted">{t.code}, {t.freeElectiveUnits} free elective units</span></span>
								</label>
							{/each}
						</div>
					{/if}
				</details>
			{/if}
		</section>
	{/if}
</div>

<style>
	.whatif {
		display: grid;
		gap: 16px;
	}

	.h {
		font-size: 1.1rem;
		margin-bottom: 10px;
	}

	.targets {
		display: grid;
		gap: 8px;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	}

	.target {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 14px;
		border: 1px solid var(--border-input);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		cursor: pointer;
	}

	.target.on {
		border-color: var(--brand);
		box-shadow: 0 0 0 1px var(--brand);
		background: var(--brand-tint);
	}

	.target > input[type='radio'] {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}

	.target:has(input[type='radio']:focus-visible) {
		outline: var(--focus-ring);
		outline-offset: 2px;
	}

	.tname {
		font-weight: 700;
		color: var(--ink);
	}

	.tmax {
		font-size: 0.82rem;
		color: var(--muted);
	}

	.custom {
		position: relative;
		z-index: 1;
		margin-top: 4px;
		min-height: 38px;
	}

	.big {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: 12px;
		padding: 12px 14px;
		border-radius: var(--radius-sm);
		background: var(--brand-tint);
	}

	.big .label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--muted);
	}

	.big .value {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	dl {
		margin: 14px 0 10px;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}

	dt {
		font-size: 0.78rem;
		color: var(--muted);
		font-weight: 600;
	}

	dd {
		margin: 0;
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.small {
		font-size: 0.82rem;
	}

	.track {
		margin-top: 16px;
	}

	.track summary {
		cursor: pointer;
		font-weight: 650;
		color: var(--ink);
		margin-bottom: 8px;
	}

	.tracks {
		display: flex;
		flex-direction: column;
		margin-top: 8px;
	}

	@media (min-width: 900px) {
		.whatif {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}

		.whatif > :global(.notice),
		.whatif > section:first-of-type {
			grid-column: 1 / -1;
		}
	}
</style>
