<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { askExtension } from '#lib/bridge.ts';
	import { UPLB_PROGRAMS } from '#lib/curriculum.ts';
	import { parseBackup, parseImport } from '#lib/importers.ts';
	import Seo from '#lib/components/Seo.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Welcome from '#lib/components/Welcome.svelte';
	import Summary from '#lib/components/Summary.svelte';
	import GradesTab from '#lib/components/GradesTab.svelte';
	import WhatIfTab from '#lib/components/WhatIfTab.svelte';
	import Planner from '#lib/components/Planner.svelte';
	import Wrapped from '#lib/components/Wrapped.svelte';

	const TABS = [
		{ id: 'grades', label: 'Grades' },
		{ id: 'whatif', label: 'What if' },
		{ id: 'planner', label: 'Planner' },
		{ id: 'wrapped', label: 'Wrapped' }
	] as const;
	type Tab = (typeof TABS)[number]['id'];

	let tab = $state<Tab>('grades');
	/** checking, found (the extension answered with grades), empty (answered, nothing captured yet) or missing. */
	let extension = $state<'checking' | 'found' | 'empty' | 'missing'>('checking');
	let extensionReply: unknown = null;
	let message = $state<{ text: string; tone: 'ok' | 'bad' } | null>(null);
	let manual = $state(false);

	function readHash() {
		const h = location.hash.slice(1);
		if (TABS.some((t) => t.id === h)) tab = h as Tab;
	}

	function setTab(id: Tab) {
		tab = id;
		history.replaceState(history.state, '', `#${id}`);
	}

	function onTabKey(e: KeyboardEvent, i: number) {
		const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (!n && e.key !== 'Home' && e.key !== 'End') return;
		e.preventDefault();
		const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + n + TABS.length) % TABS.length;
		setTab(TABS[next].id);
		tick().then(() => document.getElementById(`tab-${TABS[next].id}`)?.focus());
	}

	onMount(() => {
		app.load();
		document.documentElement.dataset.appReady = ''; // hydrated; e2e waits on this
		readHash();
		// ?program=BSCHEM from the curricula page picks the program, then the URL is tidied.
		const url = new URL(location.href);
		const program = url.searchParams.get('program');
		if (program && UPLB_PROGRAMS[program]) {
			app.s.selectedProgram = program;
			url.searchParams.delete('program');
			history.replaceState(history.state, '', url.pathname + url.search + url.hash);
		}
		askExtension().then((reply) => {
			extensionReply = reply;
			if (!reply) extension = 'missing';
			else extension = typeof parseBackup(reply) === 'string' ? 'empty' : 'found';
		});
	});

	// Save on every change once the saved state has been read.
	$effect(() => {
		if (!app.ready) return;
		JSON.stringify(app.s);
		app.persist();
	});

	function fromExtension() {
		const r = parseBackup(extensionReply);
		if (typeof r === 'string') {
			message = { text: r, tone: 'bad' };
			return;
		}
		app.applyGrades(r, 'extension');
		message = { text: `Imported ${app.courses.length} courses from the GradeSim extension.`, tone: 'ok' };
		manual = false;
	}

	async function fromFile(file: File) {
		const result = parseImport(await file.text());
		if (result.kind === 'error') {
			message = { text: result.message, tone: 'bad' };
			return;
		}
		if (result.kind === 'grades') {
			app.applyGrades(result.patch, 'file');
			message = { text: `Imported ${app.courses.length} courses from ${file.name}.`, tone: 'ok' };
			manual = false;
			return;
		}
		const plan = result.plan;
		if (plan.program !== app.s.selectedProgram && app.hasData) {
			const name = UPLB_PROGRAMS[plan.program].name;
			if (!confirm(`This plan is for ${name}. Switch to ${name} and load it? Your current planner marks and moves are replaced.`)) return;
		}
		app.applyPlan(plan);
		const saved = new Date(plan.savedAt);
		message = {
			text: `Loaded the plan saved ${Number.isNaN(saved.getTime()) ? 'earlier' : saved.toLocaleDateString('en-CA')}.${app.hasData ? '' : ' Add your grades so passed courses count.'}`,
			tone: 'ok'
		};
		if (app.hasData) setTab('planner');
	}
</script>

<svelte:window onhashchange={readHash} />

<Seo
	title="Elbi GradeSim: UPLB GWA calculator, Latin honors and course planner"
	description="Compute your UPLB GWA, see what you need for Latin honors, and plan your remaining terms around prerequisites. Free, open source, and your grades stay in your browser."
	path="/"
/>

{#if message}
	<div class="wrap flash">
		<div class="notice {message.tone}" role="status">
			<Icon name={message.tone === 'ok' ? 'check' : 'alert'} />
			<span>{message.text}</span>
			<button class="textbtn dismiss" type="button" onclick={() => (message = null)}>Dismiss</button>
		</div>
	</div>
{/if}

{#if !app.ready || !app.hasData}
	<div class:welcome-pending={!app.ready}>
		<Welcome {extension} {manual} onExtension={fromExtension} onFile={fromFile} onManual={() => (manual = true)} />
	</div>
{:else}
	<div class="dash">
		<div class={tab === 'planner' ? 'wide' : 'wrap'}>
			<Summary />
			<div class="tabs" role="tablist" aria-label="GradeSim sections">
				{#each TABS as t, i (t.id)}
					<button
						id="tab-{t.id}"
						role="tab"
						type="button"
						aria-selected={tab === t.id}
						aria-controls="panel-{t.id}"
						tabindex={tab === t.id ? 0 : -1}
						onclick={() => setTab(t.id)}
						onkeydown={(e) => onTabKey(e, i)}
					>
						{t.label}
					</button>
				{/each}
			</div>
		</div>
		<div
			id="panel-{tab}"
			role="tabpanel"
			aria-labelledby="tab-{tab}"
			class={tab === 'planner' ? 'wide' : 'wrap'}
		>
			{#if tab === 'grades'}
				<GradesTab {extension} onExtension={fromExtension} onFile={fromFile} />
			{:else if tab === 'whatif'}
				<WhatIfTab />
			{:else if tab === 'planner'}
				<Planner />
			{:else}
				<Wrapped />
			{/if}
		</div>
	</div>
{/if}

<style>
	.flash {
		margin-top: 12px;
	}

	.flash .notice {
		align-items: center;
	}

	.dismiss {
		margin-left: auto;
	}

	.dash {
		padding-top: 16px;
	}

	.tabs {
		display: flex;
		gap: 4px;
		margin: 16px 0 16px;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
	}

	.tabs button {
		flex: 0 0 auto;
		min-height: 44px;
		padding: 8px 16px;
		border: 0;
		border-bottom: 3px solid transparent;
		background: none;
		color: var(--muted);
		font-weight: 600;
		cursor: pointer;
	}

	.tabs button[aria-selected='true'] {
		color: var(--ink);
		border-bottom-color: var(--brand);
	}

	.tabs button:hover {
		color: var(--ink);
	}

	@media (max-width: 479px) {
		.tabs button {
			padding: 8px 10px;
		}
	}

	.wide {
		max-width: 1600px;
		margin: 0 auto;
		padding: 0 16px;
	}

	@media (min-width: 720px) {
		.wide {
			padding: 0 24px;
		}
	}
</style>
