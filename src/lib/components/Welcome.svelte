<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from './Icon.svelte';
	import FileButton from './FileButton.svelte';
	import GradeEditor from './GradeEditor.svelte';

	let {
		extension,
		manual,
		onExtension,
		onFile,
		onManual
	}: {
		extension: 'checking' | 'found' | 'empty' | 'missing';
		manual: boolean;
		onExtension: () => void;
		onFile: (f: File) => void;
		onManual: () => void;
	} = $props();
</script>

<div class="welcome wrap">
	<div class="intro">
		<img src="/plumbob.svg" alt="" width="40" height="60" />
		<div>
			<h1>Your GWA, your honors standing and your way to graduation</h1>
			<p class="lede">
				Elbi GradeSim computes your GWA the way UPLB does, shows the average you need for Latin honors, and maps the terms
				you have left around prerequisites and when each course is actually offered.
			</p>
			<p class="privacy"><Icon name="shield" />Your grades stay in this browser. There are no accounts and nothing is uploaded.</p>
		</div>
	</div>

	<h2 class="ways-title">Bring in your grades</h2>
	<ol class="ways">
		<li class="card">
			<span class="step">1</span>
			<h3>From the GradeSim extension</h3>
			{#if extension === 'found'}
				<p>The extension on this browser has your grades from AMIS.</p>
				<button class="btn btn-primary" type="button" onclick={onExtension}>
					<Icon name="plug" />Import from the GradeSim extension
				</button>
			{:else if extension === 'empty'}
				<p>The extension is installed but has not seen your grades yet. Log in to AMIS, open your grades, then reload this page.</p>
			{:else}
				<p>The extension reads your grades when you open AMIS and hands them to this page. Nothing passes through a server.</p>
				<a class="btn btn-secondary" href={resolve('install/')}>Install the extension</a>
				{#if extension === 'checking'}<p class="muted small" aria-live="polite">Looking for the extension.</p>{/if}
			{/if}
		</li>
		<li class="card">
			<span class="step">2</span>
			<h3>From a file</h3>
			<p>Use a JSON backup from the extension (Export JSON in its popup) or a plan you saved from this planner.</p>
			<FileButton label="Import a file" {onFile} />
		</li>
		<li class="card">
			<span class="step">3</span>
			<h3>By hand</h3>
			<p>Type in your courses and grades term by term. Course codes fill in from the UPLB catalog.</p>
			<button class="btn btn-secondary" type="button" onclick={onManual} aria-expanded={manual}>
				<Icon name="pencil" />Enter grades by hand
			</button>
		</li>
	</ol>

	{#if manual}
		<section class="card manual" aria-labelledby="manual-title">
			<h2 id="manual-title">Add your first course</h2>
			<p class="muted">Pick the term, then add each course. Your dashboard opens after the first one.</p>
			<GradeEditor />
		</section>
	{/if}
</div>

<style>
	.welcome {
		padding-top: 32px;
	}

	.intro {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}

	.intro img {
		flex: 0 0 auto;
		margin-top: 6px;
	}

	h1 {
		font-size: clamp(1.6rem, 1.1rem + 2.4vw, 2.6rem);
		max-width: 22ch;
	}

	.lede {
		margin-top: 12px;
		max-width: 62ch;
		font-size: 1.05rem;
	}

	.privacy {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 14px;
		padding: 6px 12px;
		border-radius: var(--radius-pill);
		background: var(--brand-tint);
		color: var(--ink);
		font-size: 0.9rem;
		font-weight: 500;
	}

	.privacy :global(.icon) {
		color: var(--ok);
	}

	.ways-title {
		margin-top: 36px;
		font-size: 1.2rem;
	}

	.ways {
		list-style: none;
		padding: 0;
		margin-top: 12px;
		display: grid;
		gap: 12px;
	}

	.ways li {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
	}

	.ways h3 {
		font-size: 1.05rem;
	}

	.ways p {
		font-size: 0.93rem;
	}

	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--brand);
		color: var(--on-brand);
		font-weight: 700;
		font-size: 0.85rem;
	}

	.small {
		font-size: 0.82rem;
	}

	.manual {
		margin-top: 16px;
	}

	.manual h2 {
		font-size: 1.15rem;
	}

	.manual > p {
		margin: 4px 0 12px;
	}

	@media (max-width: 479px) {
		.intro img {
			display: none;
		}
	}

	@media (min-width: 860px) {
		.ways {
			grid-template-columns: repeat(3, 1fr);
		}

		.ways li :global(.btn) {
			margin-top: auto;
		}
	}
</style>
