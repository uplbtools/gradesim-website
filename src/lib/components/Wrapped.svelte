<script lang="ts">
	import { app, download } from '#lib/app.svelte.ts';
	import { drawCard, wrappedPanels } from '#lib/wrapped.ts';
	import Icon from './Icon.svelte';

	const panels = $derived(wrappedPanels(app.courses, app.program.totalUnitsRequired || 155));
	let i = $state(0);
	let busy = $state(false);
	const p = $derived(panels[Math.min(i, panels.length - 1)]);

	async function save() {
		busy = true;
		try {
			const canvas = document.createElement('canvas');
			await drawCard(canvas, p);
			const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
			if (blob) download(`elbi-gradesim-wrapped-${i + 1}.png`, blob);
		} finally {
			busy = false;
		}
	}
</script>

<div class="wrapped">
	<p class="muted intro">Your grades as a story you can share. Flip through the cards, then save the one you like as an image sized for stories.</p>

	<article class="panel" aria-roledescription="slide" aria-label="Card {i + 1} of {panels.length}" aria-live="polite">
		<span class="emoji" aria-hidden="true">{p.emoji}</span>
		<h2 class="title">{p.title}</h2>
		{#if p.value}<p class="value">{p.value}</p>{/if}
		{#if p.subtitle}<p class="subtitle">{p.subtitle}</p>{/if}
		{#if p.badges?.length}
			<ul class="badges" aria-label="Grades you have collected">
				{#each p.badges as b (b.text)}<li class:special={b.special}>{b.text}</li>{/each}
			</ul>
		{/if}
		{#if p.highlights?.length}
			<ul class="highlights">
				{#each p.highlights as h (h.label)}
					<li><span class="hl-label">{h.label}</span><strong>{h.name}</strong><span>{h.detail}</span></li>
				{/each}
			</ul>
		{/if}
		<p class="message">{p.message}</p>
	</article>

	<div class="nav">
		<button class="btn btn-secondary" type="button" onclick={() => i--} disabled={i === 0}><Icon name="left" />Previous</button>
		<span class="count" aria-hidden="true">{i + 1} of {panels.length}</span>
		<button class="btn btn-secondary" type="button" onclick={() => i++} disabled={i >= panels.length - 1}>Next<Icon name="right" /></button>
	</div>
	<button class="btn btn-primary save" type="button" onclick={save} disabled={busy}><Icon name="download" />{busy ? 'Making your image' : 'Save this card as an image'}</button>
</div>

<style>
	.wrapped {
		max-width: 460px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.intro {
		text-align: center;
		font-size: 0.92rem;
	}

	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 6px;
		min-height: 440px;
		padding: 32px 24px;
		border-radius: 24px;
		background: hsl(5, 53%, 32%);
		color: hsl(0, 0%, 100%);
		box-shadow: var(--shadow-md);
	}

	.emoji {
		font-size: 3.2rem;
		line-height: 1.2;
	}

	.title {
		color: hsl(9, 70%, 86%);
		font-size: 1.3rem;
		letter-spacing: 0.02em;
	}

	.value {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 3.4rem;
		line-height: 1.05;
		font-variant-numeric: tabular-nums;
	}

	.subtitle {
		color: hsl(8, 50%, 93%);
	}

	.badges {
		list-style: none;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		margin-top: 6px;
	}

	.badges li {
		padding: 3px 10px;
		border-radius: var(--radius-pill);
		background: hsl(0 0% 100% / 0.22);
		font-weight: 700;
	}

	.badges li.special {
		background: hsl(0 0% 100% / 0.1);
	}

	.highlights {
		list-style: none;
		padding: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 8px;
	}

	.highlights li {
		display: flex;
		flex-direction: column;
		padding: 10px 12px;
		border-radius: 14px;
		background: hsl(0 0% 100% / 0.12);
	}

	.hl-label {
		font-size: 0.8rem;
		color: hsl(9, 70%, 86%);
	}

	.message {
		margin-top: auto;
		padding-top: 12px;
		font-size: 0.98rem;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.count {
		font-weight: 600;
		color: var(--muted);
	}
</style>
