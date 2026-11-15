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
		<div class="copy" id="start">
			<h1>Your GWA, Latin honors and graduation plan</h1>
			<p class="lede">GradeSim computes your GWA the way UPLB does and plans the sems you have left.</p>

			<div class="start" class:waiting={extension === 'checking'}>
				{#if extension === 'found'}
					<button class="btn btn-primary btn-lg" type="button" onclick={onExtension}>
						<Icon name="plug" />Import from the extension
					</button>
					<p class="hint">The extension on this browser already has your grades from AMIS.</p>
				{:else if extension === 'empty'}
					<Notice>
						The extension is installed but hasn't seen your grades yet. Log in to AMIS, open your grades, then reload this
						page.
					</Notice>
				{:else}
					<a class="btn btn-primary btn-lg laptop" href={resolve('install/')}>Get the extension</a>
					<a class="btn btn-primary btn-lg phone" href={resolve('install/') + '#phone'}>Get my grades from AMIS</a>
					<p class="hint phone">A phone can't install the extension, so a bookmark brings your grades over.</p>
				{/if}
			</div>

			<div class="other">
				<div class="links">
					<FileButton label="Load backup" {onFile} quiet />
					<button class="textbtn" type="button" onclick={onManual} aria-expanded={manual}>
						<Icon name="pencil" />Enter grades by hand
					</button>
				</div>
				<p class="hint">No grades yet? <a href={resolve('curricula/')}>See your program's checklist</a>.</p>
			</div>

			<p class="privacy"><Icon name="shield" />Your grades stay in this browser.</p>
		</div>

		<figure class="shot">
			<ThemedShot
				name="planner-crop"
				alt="Part of the planner. The next sem lists the planned courses and the retake of a failed MATH 27."
				width={1086}
				height={798}
			/>
		</figure>
	</div>

	{#if manual}
		<section class="card manual" aria-labelledby="manual-title" {@attach (el) => el.scrollIntoView()}>
			<h2 id="manual-title">Add your first course</h2>
			<p class="muted">Pick the sem, then add each course. Your dashboard opens after the first one.</p>
			<GradeEditor />
		</section>
	{/if}

	<div class="features">
		<section class="feature">
			<div>
				<h2>Your GWA, counted the UPLB way</h2>
				<p>GradeSim weighs each grade by its units, leaves out HK and NSTP, and shows the GWA of every sem.</p>
			</div>
			<figure>
				<ThemedShot name="grades-phone" alt="The Grades tab. The GWA is 1.9773, and the 1st sem of AY 2024-25 lists four courses with their grades." width={680} height={1040} />
			</figure>
		</section>
		<section class="feature">
			<div>
				<h2>The grades you need for honors</h2>
				<p>Pick summa, magna, cum laude or your own target. GradeSim tells you the average you need on the units you have left.</p>
			</div>
			<figure>
				<ThemedShot name="target-phone" alt="The Target tab. Magna cum laude is picked, and the average needed on the 100 units left is 1.28." width={680} height={986} />
			</figure>
		</section>
		<section class="feature">
			<div>
				<h2>A plan for the sems you have left</h2>
				<p>The planner puts each course in the earliest sem its prerequisites and AMIS offerings allow. It shows what a failed course or a full section does to your graduation.</p>
			</div>
			<figure>
				<ThemedShot name="planner-phone" alt="The planner. Graduation is the 2nd sem of 2029, and the next sem lists six courses with the retake of MATH 27." width={680} height={1222} />
			</figure>
		</section>
		<section class="feature">
			<div>
				<h2>A card for your story</h2>
				<p>Wrapped draws your GWA and your best sem on a card you can save and post.</p>
			</div>
			<figure>
				<img class="card-shot" src="/screenshots/wrapped-card.jpg" alt="A Wrapped card. A tin on a picnic cloth holds an ID card and a GWA of 1.9773 with the words Honor roll." width="616" height="1095" loading="lazy" decoding="async" />
			</figure>
		</section>
	</div>

	<p class="again"><a class="btn btn-secondary btn-lg" href="#start">Add my grades</a></p>
</div>

<style>
	.phone {
		display: none;
	}

	@media (pointer: coarse) {
		.laptop {
			display: none;
		}

		.phone {
			display: revert;
		}

		a.phone {
			display: inline-flex;
		}
	}

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

	.waiting {
		visibility: hidden;
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

	@media (max-width: 719px) {
		.shot {
			display: none;
		}
	}

	.features {
		display: grid;
		gap: 56px;
		margin-top: 72px;
	}

	.feature {
		display: grid;
		gap: 20px;
		align-items: center;
	}

	.feature h2 {
		font-size: clamp(1.3rem, 1rem + 1.4vw, 1.75rem);
		max-width: 22ch;
		text-wrap: balance;
	}

	.feature p {
		margin-top: 10px;
		max-width: 46ch;
	}

	.feature figure {
		margin: 0;
		width: 100%;
		max-width: 340px;
	}

	.card-shot {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--radius-lg);
	}

	.again {
		margin: 56px 0 24px;
	}

	.copy {
		scroll-margin-top: 88px;
	}

	@media (min-width: 720px) {
		.features {
			gap: 88px;
			margin-top: 104px;
		}

		.feature {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 56px;
		}

		.feature figure {
			justify-self: center;
		}

		.feature:nth-child(even) figure {
			order: -1;
		}

		.again {
			margin-top: 88px;
		}
	}

	.manual {
		margin-top: 32px;
		scroll-margin-top: 76px;
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
