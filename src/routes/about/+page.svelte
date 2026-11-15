<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '#lib/components/Seo.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import ThemedShot from '#lib/components/ThemedShot.svelte';

	const faq = [
		{
			q: 'Is this an official UPLB tool?',
			a: "No. GradeSim is built by students under UPLB Tools and isn't affiliated with or endorsed by UPLB, the UP System, or AMIS. Treat every number here as an estimate and confirm anything important with your college secretary or the Office of the University Registrar."
		},
		{
			q: 'Where do my grades go?',
			a: 'They stay on your device. The web app keeps your grades in this browser’s local storage, and the extension keeps them in its own storage on your device. There are no accounts, no analytics, and no server that receives grades. You can save a backup or clear everything on the Grades tab.'
		},
		{
			q: 'How is the GWA computed?',
			a: 'Each numeric grade is weighted by its units and the total is divided by the units counted. NSTP, HK and PE never count. S, U, INC, DRP and similar marks are shown but left out of the GWA. You can also leave out courses yourself, for example credits from a previous program.'
		},
		{
			q: 'What are the Latin honors cutoffs?',
			a: "GradeSim uses a GWA of 1.20 or better for summa cum laude, 1.45 for magna cum laude and 1.75 for cum laude. Honors also depend on residency, unit load and having no failing or dropped grades, which GradeSim can't check for you."
		},
		{
			q: 'How does the planner decide when I graduate?',
			a: 'It places every remaining course in the earliest sem that meets its prerequisites, that AMIS has offered the course in (from class listings for 2023 to 2026) and that fits your unit cap. It flags a course when taking it a sem later moves your graduation.'
		},
		{
			q: 'My program is missing or a course looks wrong.',
			a: 'The checklists come from the official ones and are checked by volunteers. In the planner, select the course and choose Fix this course. Your plan uses the fix right away, and you can send it to UPLB Tools so the checklist is fixed for everyone. For a missing program, open an issue on GitHub.'
		},
		{
			q: 'Can I use it on my phone?',
			a: 'Yes. Install it from your browser menu (Add to Home Screen) and it works offline after the first visit. Firefox for Android can install the extension, and in Chrome or Safari the bookmark on the Get the extension page opens GradeSim with your AMIS grades.'
		}
	];
</script>

<Seo
	title="About Elbi GradeSim"
	description="What Elbi GradeSim does, how it computes your UPLB GWA and graduation plan, how it keeps your grades private, and who builds it."
	path="/about/"
/>

<div class="wrap">
	<PageHead title="A GWA calculator and course planner for UPLB students">
		GradeSim shows your GWA, what you need for Latin honors and a sem by sem plan to graduation.
	</PageHead>

	<figure class="shot">
		<ThemedShot
			name="planner"
			alt="The planner showing the graduation sem, the what-if controls and a first year with a failed MATH 27"
			width={1440}
			height={900}
		/>
	</figure>

	<div class="prose">
		<h2>What it does</h2>
		<ul>
			<li>Grades shows your GWA by sem or year and marks your scholar sems.</li>
			<li>Target shows the average you need for the GWA you're aiming for.</li>
			<li>Planner lays out your checklist sem by sem around prerequisites.</li>
			<li>Wrapped makes cards about your grades to share.</li>
		</ul>

		<h2>Questions</h2>
		{#each faq as item (item.q)}
			<details name="faq">
				<summary>{item.q}</summary>
				<p>{item.a}</p>
			</details>
		{/each}

		<h2>Credits</h2>
		<p>
			GradeSim is part of <a href="https://uplb.tools" rel="noopener" target="_blank">UPLB Tools</a>. The code is open source on
			<a href="https://github.com/uplbtools/gradesim" rel="noopener" target="_blank">GitHub</a>.
		</p>
		<p><a class="btn btn-primary" href={resolve('/')}>Open GradeSim</a></p>
	</div>
</div>

<style>
	.shot {
		margin: 24px 0 8px;
	}

	@media (max-width: 719px) {
		.shot {
			display: none;
		}
	}

	details {
		border-bottom: 1px solid var(--border);
	}

	summary {
		margin-left: 18px;
		list-style-position: outside;
		cursor: pointer;
		padding: 12px 0;
		font-weight: 650;
		color: var(--ink);
	}

	details p {
		margin: 0 0 14px;
	}

	.prose .btn {
		margin-top: 12px;
		color: var(--on-brand);
	}
</style>
