<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '#lib/components/Seo.svelte';

	const faq = [
		{
			q: 'Is this an official UPLB tool?',
			a: 'No. Elbi GradeSim is built by students under UPLB Tools and is not affiliated with or endorsed by UPLB, the UP System, or AMIS. Treat every number here as an estimate and confirm anything important with your college secretary or the Office of the University Registrar.'
		},
		{
			q: 'Where do my grades go?',
			a: 'Nowhere. The web app keeps your grades in this browser’s local storage, and the extension keeps them in its own storage on your device. There are no accounts, no analytics, and no server that receives grades.'
		},
		{
			q: 'How is the GWA computed?',
			a: 'Each numeric grade is weighted by its units and the total is divided by the units counted. NSTP, HK and PE never count. S, U, INC, DRP and similar marks are shown but left out of the GWA. You can also leave out courses yourself, for example credits from a previous program.'
		},
		{
			q: 'What are the Latin honors cutoffs?',
			a: 'GradeSim uses a GWA of 1.20 or better for Summa Cum Laude, 1.45 for Magna Cum Laude and 1.75 for Cum Laude. Honors also depend on residency, unit load and having no failing or dropped grades, which GradeSim cannot check for you.'
		},
		{
			q: 'How does the planner decide when I graduate?',
			a: 'It places every remaining course in the earliest term that satisfies its prerequisites and corequisites, falls in a semester the course is actually offered (from AMIS class listings for 2023 to 2026), and fits your unit cap. Courses where a one-term slip moves your graduation are marked critical.'
		},
		{
			q: 'My program is missing or a course looks wrong.',
			a: 'Curriculum data comes from the official checklists and is checked by volunteers. Open an issue on GitHub with the course and what the checklist says, and we will fix it.'
		},
		{
			q: 'Can I use it on my phone?',
			a: 'Yes. Install it from your browser menu (Add to Home Screen) and it works offline after the first visit. The extension itself needs a desktop browser, so on a phone import a backup file or enter your grades by hand.'
		}
	];
</script>

<Seo
	title="About Elbi GradeSim"
	description="What Elbi GradeSim does, how it computes your UPLB GWA and graduation plan, how it keeps your grades private, and who builds it."
	path="/about/"
/>

<div class="wrap">
	<header class="page-head">
		<p class="eyebrow">About</p>
		<h1>A GWA calculator and course planner for UPLB students</h1>
		<p>
			Elbi GradeSim started as a browser extension that reads your grades from AMIS. The web app brings the same math to any
			browser: your GWA, what you need for Latin honors, and a term-by-term map to graduation.
		</p>
	</header>

	<figure class="shot">
		<picture>
			<source srcset="/screenshots/planner-dark.jpg" media="(prefers-color-scheme: dark)" />
			<img src="/screenshots/planner-light.jpg" alt="The planner showing past terms with passed courses, a failed course with its retake, and the remaining terms up to graduation" width="1440" height="900" loading="lazy" decoding="async" />
		</picture>
		<figcaption>The planner maps every remaining course to the earliest term it can go, and shows what a failed course costs.</figcaption>
	</figure>

	<div class="prose">
		<h2>What it does</h2>
		<ul>
			<li><strong>Grades.</strong> Your GWA, units and courses per term or per year, with University Scholar and College Scholar terms marked.</li>
			<li><strong>What if.</strong> Pick a target and see the average you need on your remaining units, counting GE slots and free electives.</li>
			<li><strong>Planner.</strong> Your checklist laid out by term, with prerequisite chains, critical courses, retakes, petitions, and an Excel export.</li>
			<li><strong>Wrapped.</strong> A set of cards about your grades that you can save as an image.</li>
		</ul>

		<h2>Private by design</h2>
		<p>
			Everything runs in your browser. Your grades are saved in local storage on this device and are never uploaded. You can
			export a backup at any time and clear everything with one button on the Grades tab.
		</p>

		<h2>Questions</h2>
		{#each faq as item (item.q)}
			<h3>{item.q}</h3>
			<p>{item.a}</p>
		{/each}

		<h2>Credits</h2>
		<p>
			Elbi GradeSim is part of <a href="https://uplb.tools" rel="noopener" target="_blank">UPLB Tools</a>, the student-run group
			behind Room TBA and other campus tools. The code is open source on
			<a href="https://github.com/uplbtools/gradesim" rel="noopener" target="_blank">GitHub</a>, and curriculum fixes from
			students are always welcome.
		</p>
		<p><a class="btn btn-primary" href={resolve('/')}>Open Elbi GradeSim</a></p>
	</div>
</div>

<style>
	.shot {
		margin: 24px 0 8px;
	}

	.shot img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-md);
	}

	figcaption {
		margin-top: 8px;
		font-size: 0.88rem;
		color: var(--muted);
	}

	.prose .btn {
		margin-top: 12px;
		color: var(--on-brand);
	}
</style>
