<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from './Icon.svelte';
	import FileButton from './FileButton.svelte';
	import GradeEditor from './GradeEditor.svelte';
	import Notice from './Notice.svelte';
	import ThemedShot from './ThemedShot.svelte';

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
	<div class="hero">
		<div class="copy">
			<h1>Your GWA, your honors standing and your way to graduation</h1>
			<p class="lede">
				Elbi GradeSim computes your GWA the way UPLB does, shows the average you need for Latin honors, and maps the terms you
				have left around prerequisites and when each course is actually offered.
			</p>

			<div class="start">
				{#if extension === 'found'}
					<button class="btn btn-primary btn-lg" type="button" onclick={onExtension}>
						<Icon name="plug" />Import from the GradeSim extension
					</button>
					<p class="hint">The extension on this browser already has your grades from AMIS.</p>
				{:else if extension === 'empty'}
					<Notice>
						The extension is installed but has not seen your grades yet. Log in to AMIS, open your grades, then reload this
						page.
					</Notice>
				{:else}
					<a class="btn btn-primary btn-lg" href={resolve('install/')}>Install the extension</a>
					<p class="hint">It reads your grades when you open AMIS and hands them to this page without any server in between.</p>
				{/if}
			</div>

			<div class="other">
				<p>No extension, or on a phone?</p>
				<div class="links">
					<FileButton label="Import a file" {onFile} quiet />
					<button class="textbtn" type="button" onclick={onManual} aria-expanded={manual}>
						<Icon name="pencil" />Enter grades by hand
					</button>
				</div>
				<p class="hint">A file can be a JSON backup from the extension or a plan you saved from this planner.</p>
			</div>

			<p class="privacy"><Icon name="shield" />Your grades stay in this browser. There are no accounts and nothing is uploaded.</p>
		</div>

		<figure class="shot">
			<ThemedShot
				name="planner-crop"
				alt="Part of the planner. A failed MATH 27 shows its retake, and the courses waiting on it move to later terms."
				width={1086}
				height={798}
			/>
		</figure>
	</div>

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

	.hero {
		display: grid;
		gap: 32px;
		align-items: center;
	}

	h1 {
		font-size: clamp(1.75rem, 1.1rem + 2.6vw, 2.75rem);
		max-width: 20ch;
	}

	.lede {
		margin-top: 14px;
		max-width: 60ch;
		font-size: 1.05rem;
	}

	.start {
		margin-top: 28px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}

	.btn-lg {
		min-height: 52px;
		padding: 12px 22px;
		font-size: 1.05rem;
	}

	.hint {
		max-width: 60ch;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.other {
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
		max-width: 60ch;
	}

	.other > p:first-child {
		font-weight: 600;
		color: var(--ink);
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
		margin: 4px 0 4px -8px;
	}

	.privacy {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 20px;
		font-size: 0.9rem;
		color: var(--body);
	}

	.privacy :global(.icon) {
		color: var(--ok);
	}

	.shot {
		margin: 0;
	}

	.manual {
		margin-top: 32px;
	}

	.manual h2 {
		font-size: 1.15rem;
	}

	.manual > p {
		margin: 4px 0 12px;
	}

	@media (min-width: 960px) {
		.welcome {
			padding-top: 56px;
		}

		.hero {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
			gap: 56px;
		}
	}
</style>
