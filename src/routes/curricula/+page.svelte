<script lang="ts">
	import { resolve } from '$app/paths';
	import { CHECKLIST_PROGRAM, COLLEGES } from '#lib/curriculum.ts';
	import Seo from '#lib/components/Seo.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PageHead from '#lib/components/PageHead.svelte';

	// Checklist images in static/curricula/<college>/<slug>-<page>.png
	const CHECKLISTS: Record<string, [name: string, slug: string, pages: number][]> = {
		CAS: [
			['Associate in Arts (Sports Studies)', 'AA-Sports-Studies', 1],
			['BA Communication Arts', 'BA-Communication-Arts', 2],
			['BA Philosophy', 'BA-Philosophy', 2],
			['BA Sociology', 'BA-Sociology', 2],
			['BS Agricultural Chemistry', 'BS-Agricultural-Chemistry', 2],
			['BS Applied Mathematics', 'BS-Applied-Mathematics', 2],
			['BS Applied Physics', 'BS-Applied-Physics', 2],
			['BS Biology', 'BS-Biology', 2],
			['BS Chemistry', 'BS-Chemistry', 2],
			['BS Computer Science', 'BS-Computer-Science', 1],
			['BS Mathematics', 'BS-Mathematics', 2],
			['BS Mathematics and Science Teaching', 'BS-Mathematics-and-Science-Teaching', 4],
			['BS Statistics', 'BS-Statistics', 2]
		],
		CAFS: [
			['BS Agricultural Biotechnology', 'BS-Agricultural-Biotechnology', 2],
			['BS Agriculture', 'BS-Agriculture', 1],
			['BS Food Science and Technology', 'BS-Food-Science-and-Technology', 2]
		],
		CDC: [
			['Associate of Science in Development Communication', 'AS-Development-Communication', 1],
			['BS Development Communication', 'BS-Development-Communication', 2]
		],
		CEM: [
			['Associate in Arts in Entrepreneurship', 'AA-Entrepreneurship', 1],
			['BS Accountancy', 'BS-Accountancy', 1],
			['BS Agribusiness Management and Entrepreneurship', 'BS-Agribusiness-Management-Entrepreneurship', 2],
			['BS Agricultural and Applied Economics', 'BS-Agricultural-and-Applied-Economics', 2],
			['BS Economics', 'BS-Economics', 2]
		],
		CEAT: [
			['BS Agricultural and Biosystems Engineering', 'BS-Agricultural-and-Biosystems-Engineering', 1],
			['BS Chemical Engineering', 'BS-Chemical-Engineering', 2],
			['BS Civil Engineering', 'BS-Civil-Engineering', 2],
			['BS Electrical Engineering', 'BS-Electrical-Engineering', 1],
			['BS Industrial Engineering', 'BS-Industrial-Engineering', 1],
			['BS Materials Engineering', 'BS-Materials-Engineering', 1],
			['BS Mechanical Engineering', 'BS-Mechanical-Engineering', 1]
		],
		CFNR: [
			['Associate of Science in Forestry', 'Associate-in-Forestry', 1],
			['BS Forestry', 'BS-Forestry', 1]
		],
		CHE: [
			['BS Human Ecology', 'BS-Human-Ecology', 2],
			['BS Nutrition', 'BS-Nutrition', 1]
		],
		CVM: [['Doctor of Veterinary Medicine', 'Doctor-of-Veterinary-Medicine', 1]]
	};

	let dialog: HTMLDialogElement | undefined = $state();
	let open = $state<{ college: string; name: string; slug: string; pages: number } | null>(null);

	function show(college: string, name: string, slug: string, pages: number) {
		open = { college, name, slug, pages };
		dialog?.showModal();
	}
</script>

<Seo
	title="UPLB curriculum checklists, Elbi GradeSim"
	description="Official curriculum checklists for UPLB undergraduate programs, grouped by college, with a link to plan each one in Elbi GradeSim."
	path="/curricula/"
	image="og-curricula.jpg"
	imageAlt="UPLB program checklists in Elbi GradeSim"
/>

<div class="wrap">
	<PageHead title="UPLB program checklists">
		Official checklists for undergraduate programs, grouped by college. Open one to read it, or plan it sem by sem in
		GradeSim.
	</PageHead>

	{#each Object.entries(CHECKLISTS) as [college, programs] (college)}
		<section class="college" aria-labelledby="c-{college}">
			<h2 id="c-{college}">{COLLEGES[college]}</h2>
			<ul>
				{#each programs as [name, slug, pages] (slug)}
					<li>
						<button class="program" type="button" onclick={() => show(college, name, slug, pages)}>{name}</button>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<dialog bind:this={dialog} aria-labelledby="dlg-title" onclose={() => (open = null)}>
	{#if open}
		<div class="dlg-head">
			<div>
				<h2 id="dlg-title">{open.name}</h2>
				<p class="muted">{COLLEGES[open.college]}</p>
			</div>
			<button class="btn btn-secondary close" type="button" onclick={() => dialog?.close()} aria-label="Close checklist"><Icon name="x" /></button>
		</div>
		{#if CHECKLIST_PROGRAM[open.slug]}
			<a class="btn btn-primary plan" href="{resolve('/')}?program={CHECKLIST_PROGRAM[open.slug]}#planner">Plan {open.name} in GradeSim</a>
		{/if}
		<div class="pages">
			{#each Array.from({ length: open.pages }, (_, i) => i + 1) as n (n)}
				<img src="/curricula/{open.college}/{open.slug}-{n}.png" alt="{open.name} checklist, page {n}" loading="lazy" decoding="async" />
			{/each}
		</div>
	{/if}
</dialog>

<style>
	.college {
		margin-top: 28px;
	}

	.college h2 {
		font-size: 1.15rem;
		margin-bottom: 10px;
	}

	.college ul {
		list-style: none;
		padding: 0;
		columns: 280px;
		column-gap: 32px;
	}

	.college li {
		break-inside: avoid;
		border-top: 1px solid var(--border);
	}

	.program {
		width: 100%;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 4px;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 500;
		text-align: left;
		color: var(--ink);
		text-decoration: none;
		cursor: pointer;
	}

	.program:hover {
		color: var(--brand);
	}

	dialog {
		width: min(960px, calc(100vw - 24px));
		max-height: calc(100vh - 24px);
		padding: 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--bg-elevated);
		color: var(--body);
	}

	dialog::backdrop {
		background: hsl(0 0% 0% / 0.55);
	}

	.dlg-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}

	.dlg-head h2 {
		font-size: 1.25rem;
	}

	.close {
		width: 44px;
		padding: 0;
	}

	.plan {
		margin-top: 12px;
	}

	.pages {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 16px;
	}

	.pages img {
		width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
		background: white;
	}
</style>
