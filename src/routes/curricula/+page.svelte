<script lang="ts">
	import { resolve } from '$app/paths';
	import { CHECKLIST_PROGRAM, COLLEGES, UPLB_PROGRAMS } from '#lib/curriculum.ts';
	import Seo from '#lib/components/Seo.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PageHead from '#lib/components/PageHead.svelte';

	// Checklist images in static/curricula/<college>/<slug>-<page>.png
	const CHECKLISTS: Record<string, [name: string, slug: string, pages: number][]> = {
		CAS: [
			['BA Communication Arts', 'BA-Communication-Arts', 2],
			['BA Philosophy', 'BA-Philosophy', 2],
			['BA Sociology', 'BA-Sociology', 2],
			['BS Agricultural Chemistry', 'BS-Agricultural-Chemistry', 2],
			['BS Applied Mathematics', 'BS-Applied-Mathematics', 2],
			['BS Applied Physics', 'BS-Applied-Physics', 2],
			['BS Biology', 'BS-Biology', 2],
			['BS Chemistry', 'BS-Chemistry', 2],
			['BS Mathematics', 'BS-Mathematics', 2],
			['BS Statistics', 'BS-Statistics', 2]
		],
		CAFS: [
			['BS Agricultural Biotechnology', 'BS-Agricultural-Biotechnology', 2],
			['BS Agriculture', 'BS-Agriculture', 2],
			['BS Food Science and Technology', 'BS-Food-Science-and-Technology', 2]
		],
		CDC: [['BS Development Communication', 'BS-Development-Communication', 2]],
		CEM: [
			['BS Agribusiness Management and Entrepreneurship', 'BS-Agribusiness-Management-Entrepreneurship', 2],
			['BS Agricultural and Applied Economics', 'BS-Agricultural-and-Applied-Economics', 2],
			['BS Economics', 'BS-Economics', 2]
		],
		CEAT: [
			['BS Chemical Engineering', 'BS-Chemical-Engineering', 2],
			['BS Civil Engineering', 'BS-Civil-Engineering', 2],
			['BS Electrical Engineering', 'BS-Electrical-Engineering', 1],
			['BS Industrial Engineering', 'BS-Industrial-Engineering', 1],
			['BS Mechanical Engineering', 'BS-Mechanical-Engineering', 1]
		],
		CFNR: [['BS Forestry', 'BS-Forestry', 1]],
		CHE: [
			['BS Human Ecology', 'BS-Human-Ecology', 2],
			['BS Nutrition', 'BS-Nutrition', 1]
		],
		CVM: [['Doctor of Veterinary Medicine', 'Doctor-of-Veterinary-Medicine', 1]]
	};

	// Programs the planner knows that have no checklist image here yet, by college.
	const withImage = new Set(Object.values(CHECKLIST_PROGRAM));
	const plannerOnly = (college: string) =>
		Object.values(UPLB_PROGRAMS)
			.filter((p) => p.college === college && !withImage.has(p.code))
			.sort((a, b) => a.name.localeCompare(b.name));

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
/>

<div class="wrap">
	<PageHead title="UPLB curriculum checklists">
		Official checklists for undergraduate programs, grouped by college. Open one to read it, or plan it term by term in
		GradeSim. Programs marked planner only already work in the planner, and their checklist image will be added here later.
	</PageHead>

	{#each Object.entries(CHECKLISTS) as [college, programs] (college)}
		<section class="college" aria-labelledby="c-{college}">
			<h2 id="c-{college}">{COLLEGES[college]}</h2>
			<ul>
				{#each programs as [name, slug, pages] (slug)}
					<li>
						<button class="program card" type="button" onclick={() => show(college, name, slug, pages)}>
							<span>{name}</span>
							<span class="muted">{pages} {pages === 1 ? 'page' : 'pages'}</span>
						</button>
					</li>
				{/each}
				{#each plannerOnly(college) as p (p.code)}
					<li>
						<a class="program card planner-only" href="{resolve('/')}?program={p.code}#planner">
							<span>{p.name}</span>
							<span class="muted">Planner only for now</span>
						</a>
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
		display: grid;
		gap: 8px;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	}

	.program {
		width: 100%;
		min-height: 56px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		text-align: left;
		font-weight: 600;
		color: var(--ink);
		text-decoration: none;
		cursor: pointer;
	}

	.program:hover {
		border-color: var(--brand);
	}

	.planner-only {
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 2px;
	}

	.program .muted {
		font-weight: 400;
		font-size: 0.85rem;
		flex: 0 0 auto;
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
