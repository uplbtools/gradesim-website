<script lang="ts">
	import { app } from '#lib/app.svelte.ts';
	import { HONORS, remainingFor, whatIf } from '#lib/grades.ts';
	import Icon from './Icon.svelte';
	import Notice from './Notice.svelte';

	let choice = $state<string>('1.75');
	let custom = $state('');

	const target = $derived(choice === 'custom' ? parseFloat(custom) : parseFloat(choice));
	const validTarget = $derived(target >= 1 && target <= 5);
	const rem = $derived(remainingFor(app.program, app.gwa.completedCourses, app.s.substitutions, app.s.track));
	const result = $derived(validTarget ? whatIf(target, app.gwa.gwa, app.gwa.totalUnits, rem.remainingUnits) : null);
	const targetName = $derived(HONORS.find((h) => h.max === target)?.name ?? `a GWA of ${validTarget ? target.toFixed(2) : '?'}`);
	const tracks = $derived(app.program.tracks ? Object.entries(app.program.tracks) : []);

	const verdict = $derived.by(() => {
		if (!result) return null;
		switch (result.status) {
			case 'achieved':
				return { tone: 'ok', icon: 'check', text: `You are already within ${targetName}. Keep your grades where they are.` } as const;
			case 'impossible-low':
				return { tone: 'bad', icon: 'x', text: `${targetName} is out of reach. It would take an average better than 1.00 (${result.required.toFixed(2)}) on what is left.` } as const;
			case 'impossible-high':
				return { tone: 'bad', icon: 'x', text: `${targetName} is not reachable with the units you have left.` } as const;
			default: {
				const how = { excellent: 'with excellent grades', good: 'with very good grades', moderate: 'with good grades', difficult: 'and it is a stretch' }[result.effort!];
				return { tone: result.effort === 'difficult' ? 'warn' : 'ok', icon: result.effort === 'difficult' || result.effort === 'moderate' ? 'alert' : 'check', text: `${targetName} is reachable ${how}.` } as const;
			}
		}
	});
</script>

<div class="whatif">
	<section class="card" aria-labelledby="target-title">
		<h2 id="target-title" class="h">What GWA are you aiming for?</h2>
		<div class="targets" role="radiogroup" aria-labelledby="target-title">
			{#each HONORS as h (h.key)}
				<label class="target" class:on={choice === String(h.max)}>
					<input type="radio" name="target" value={String(h.max)} bind:group={choice} />
					<span class="tname">{h.name}</span>
					<span class="tmax">GWA {h.max.toFixed(2)} or better</span>
				</label>
			{/each}
			<label class="target" class:on={choice === 'custom'}>
				<input type="radio" name="target" value="custom" bind:group={choice} />
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
					onfocus={() => (choice = 'custom')}
				/>
			</label>
		</div>
	</section>

	<section class="card result" aria-live="polite" aria-labelledby="result-title">
		<h2 id="result-title" class="h">What you need</h2>
		{#if !validTarget}
			<p class="muted">Enter a target GWA from 1.00 to 5.00.</p>
		{:else if result && verdict}
			<p class="verdict {verdict.tone}"><Icon name={verdict.icon} />{verdict.text}</p>
			<dl>
				<div><dt>Current GWA</dt><dd>{app.gwa.gwa > 0 ? app.gwa.gwa.toFixed(4) : 'None yet'}</dd></div>
				<div><dt>Target</dt><dd>{target.toFixed(2)} or better</dd></div>
				<div><dt>Units done</dt><dd>{app.gwa.totalUnits}</dd></div>
				<div><dt>Units left</dt><dd>{rem.remainingUnits}</dd></div>
				<div class="big">
					<dt>Average you need on the rest</dt>
					<dd data-testid="required">{result.status === 'achieved' ? 'Stay the course' : result.status === 'possible' ? result.required.toFixed(4) : 'Not possible'}</dd>
				</div>
			</dl>
			<p class="muted small">This is an estimate from your checklist. It assumes 3 units per missing GE course and counts the free electives your track still needs.</p>
		{/if}
	</section>

	{#if tracks.length}
		<section class="card" aria-labelledby="track-title">
			<h2 id="track-title" class="h">Your track</h2>
			{#if rem.detectedTrack}
				<Notice tone="ok">Detected from your grades as {app.program.tracks![rem.detectedTrack].name} ({app.program.tracks![rem.detectedTrack].code}).</Notice>
			{:else}
				<div class="tracks" role="radiogroup" aria-label="Track">
					{#each tracks as [key, t] (key)}
						<label class="check">
							<input type="radio" name="track" value={key} checked={rem.track === key} onchange={() => (app.s.track = key)} />
							<span><strong>{t.name}</strong> <span class="muted">{t.code}, {t.freeElectiveUnits} free elective units</span></span>
						</label>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<section class="card" aria-labelledby="rem-title">
		<h2 id="rem-title" class="h">Still to take for {app.program.name}</h2>
		{#if rem.remaining.length}
			<ul class="rem">
				{#each rem.remaining as c (c.code)}
					<li><span class="code">{c.code}</span><span class="units">{c.units}u</span></li>
				{/each}
			</ul>
		{:else}
			<Notice tone="ok">Every required course on the checklist is done.</Notice>
		{/if}
		<ul class="notes">
			<li>
				{#if rem.remainingGESlots > 0}
					<strong>{rem.remainingGESlots} more GE {rem.remainingGESlots === 1 ? 'course' : 'courses'}</strong> needed. You have {rem.completedGECount} of {rem.geRequired}.
				{:else}
					<strong>GE courses are complete</strong> ({rem.completedGECount} of {rem.geRequired}).
				{/if}
			</li>
			<li>
				{#if rem.freeElectiveUnitsRemaining > 0}
					<strong>{rem.freeElectiveUnitsRemaining} free elective units</strong> left. You have {rem.freeElectiveUnitsTaken} of {rem.freeElectiveUnitsTotal}.
				{:else}
					<strong>Free electives are complete</strong> ({rem.freeElectiveUnitsTaken} of {rem.freeElectiveUnitsTotal} units).
				{/if}
			</li>
		</ul>
	</section>
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

	.verdict {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		font-weight: 600;
		color: var(--ink);
	}

	.verdict :global(.icon) {
		margin-top: 3px;
	}

	.verdict.ok :global(.icon) {
		color: var(--ok);
	}

	.verdict.bad :global(.icon) {
		color: var(--bad);
	}

	.verdict.warn :global(.icon) {
		color: var(--warn);
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

	.big {
		grid-column: 1 / -1;
		padding: 12px 14px;
		border-radius: var(--radius-sm);
		background: var(--brand-tint);
	}

	.big dd {
		font-family: var(--font-display);
		font-size: 1.8rem;
	}

	.small {
		font-size: 0.82rem;
	}

	.tracks {
		display: flex;
		flex-direction: column;
	}

	.rem {
		list-style: none;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.rem li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px 4px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		background: var(--bg-card);
	}

	.rem .code {
		font-weight: 650;
		font-size: 0.88rem;
		color: var(--ink);
	}

	.units {
		font-size: 0.74rem;
		font-weight: 600;
		padding: 0 6px;
		border-radius: var(--radius-pill);
		background: var(--brand-tint);
	}

	.notes {
		margin-top: 14px;
		padding-left: 1.1rem;
		font-size: 0.92rem;
	}

	.notes li + li {
		margin-top: 4px;
	}

	@media (min-width: 900px) {
		.whatif {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}

		.whatif > :first-child,
		.whatif > :last-child {
			grid-column: 1 / -1;
		}
	}
</style>
