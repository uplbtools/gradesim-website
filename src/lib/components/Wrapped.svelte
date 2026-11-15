<script lang="ts">
	import { app, download } from '#lib/app.svelte.ts';
	import { bare, drawCard, wrappedPanels } from '#lib/wrapped.ts';
	import Icon from './Icon.svelte';

	const panels = $derived(wrappedPanels(app.courses, app.program.totalUnitsRequired || 155));
	let i = $state(0);
	let busy = $state(false);
	const p = $derived(panels[Math.min(i, panels.length - 1)]);

	let preview = $state('');
	let name = $state('');
	const ordinal = ['1st', '2nd', '3rd'];
	const id = $derived.by(() => {
		const years = new Set(app.courses.map((c) => c.ay)).size;
		return { name: name.trim(), year: `${ordinal[years - 1] ?? `${years}th`} year`, course: app.program.code };
	});
	const alt = $derived(
		[p.title, p.frame === 'id' ? `GWA ${p.value}` : '', ...(p.highlights ?? []).map((h) => `${bare(h.label)} ${h.name}, ${h.detail}`), 'drawn in a tin on a picnic blanket']
			.filter(Boolean)
			.join(', ')
	);

	async function card() {
		const canvas = document.createElement('canvas');
		await drawCard(canvas, p, id);
		return new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
	}

	$effect(() => {
		if (!p.frame) {
			preview = '';
			return;
		}
		let gone = false;
		card().then((blob) => {
			if (!blob || gone) return;
			URL.revokeObjectURL(preview);
			preview = URL.createObjectURL(blob);
		});
		return () => {
			gone = true;
		};
	});

	async function save() {
		busy = true;
		try {
			const blob = await card();
			if (!blob) return;
			const name = `elbi-gradesim-wrapped-${i + 1}.png`;
			const file = new File([blob], name, { type: 'image/png' });
			if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
			else download(name, blob);
		} finally {
			busy = false;
		}
	}
</script>

<div class="wrapped">

	{#if p.frame}
		{#if preview}
			<img class="frame" src={preview} {alt} />
		{:else}
			<div class="frame loading" role="img" aria-label="Drawing your card"></div>
		{/if}
		<p class="muted">{p.message}</p>
	{:else}
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
	{/if}

	{#if p.frame === 'id'}
		<label class="field">Your name on the card<input class="input" bind:value={name} maxlength="40" autocomplete="name" /></label>
		<p class="muted">Add your photo over the picture in Instagram or Facebook.</p>
	{/if}

	<div class="nav">
		<button class="btn btn-secondary" type="button" onclick={() => i--} disabled={i === 0}><Icon name="left" />Previous</button>
		<span class="count" aria-hidden="true">{i + 1} of {panels.length}</span>
		<button class="btn btn-secondary" type="button" onclick={() => i++} disabled={i >= panels.length - 1}>Next<Icon name="right" /></button>
	</div>
	<button class="btn btn-primary save" type="button" onclick={save} disabled={busy}><Icon name="download" />{busy ? 'Making your image' : 'Save this card'}</button>
</div>

<style>
	.wrapped {
		max-width: 460px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
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

	.frame {
		width: 100%;
		aspect-ratio: 9 / 16;
		border-radius: 24px;
		box-shadow: var(--shadow-md);
	}

	.loading {
		background: var(--brand-tint);
	}

	.emoji {
		font-size: 3.2rem;
		line-height: 1.2;
	}

	.title {
		color: hsl(9, 70%, 86%);
		font-size: 1.3rem;
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
