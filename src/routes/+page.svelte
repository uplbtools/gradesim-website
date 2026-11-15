<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { getExtensionGrades, probeExtension } from '#lib/bridge.ts';
	import { unpackHash } from '#lib/link.ts';
	import { UPLB_PROGRAMS } from '#lib/curriculum.ts';
	import { parseBackup, parseImport } from '#lib/importers.ts';
	import { absLabel, absOfAmisTerm, takeCourses } from '#lib/planner.ts';
	import Seo from '#lib/components/Seo.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import Welcome from '#lib/components/Welcome.svelte';
	import GradesTab from '#lib/components/GradesTab.svelte';
	import WhatIfTab from '#lib/components/WhatIfTab.svelte';
	import Planner from '#lib/components/Planner.svelte';
	import Wrapped from '#lib/components/Wrapped.svelte';

	const TABS = [
		{ id: 'grades', label: 'Grades' },
		{ id: 'whatif', label: 'Target' },
		{ id: 'planner', label: 'Planner' },
		{ id: 'wrapped', label: 'Wrapped' }
	] as const;
	type Tab = (typeof TABS)[number]['id'];

	let tab = $state<Tab>('grades');
	/** checking, found (the extension answered with grades), empty (answered, nothing captured yet) or missing. */
	let extension = $state<'checking' | 'found' | 'empty' | 'missing'>('checking');
	let message = $state<{ text: string; tone: 'ok' | 'bad' } | null>(null);
	let manual = $state(false);

	function readHash() {
		const h = location.hash.slice(1);
		if (TABS.some((t) => t.id === h)) tab = h as Tab;
		else if (h.startsWith('d=')) fromLink();
	}

	async function fromLink() {
		const hash = location.hash;
		history.replaceState(history.state, '', location.pathname + location.search + '#grades'); // the grades leave the address bar
		const text = await unpackHash(hash).catch(() => null);
		if (text == null) {
			message = { text: "GradeSim can't read that link, so nothing changed. Copy a new one on the device that has your grades.", tone: 'bad' };
			return;
		}
		const r = parseImport(text);
		if (r.kind === 'plan') {
			app.viewPlan(r.plan);
			setTab('planner');
			return;
		}
		if (app.hasData && !confirm('This link holds grades. Replace the grades saved in this browser with them?')) return;
		fromText(text, 'your link');
	}

	function setTab(id: Tab) {
		tab = id;
		history.replaceState(history.state, '', `#${id}`);
	}

	function pickTab(id: Tab) {
		message = null;
		setTab(id);
	}

	function onTabKey(e: KeyboardEvent, i: number) {
		const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (!n && e.key !== 'Home' && e.key !== 'End') return;
		e.preventDefault();
		const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + n + TABS.length) % TABS.length;
		pickTab(TABS[next].id);
		tick().then(() => document.getElementById(`tab-${TABS[next].id}`)?.focus());
	}

	onMount(() => {
		app.load();
		document.documentElement.dataset.appReady = ''; // hydrated; e2e waits on this
		readHash();
		// ?program=BSCHEM from the curricula page picks the program. ?from=extension and
		// ?whatif=CMSC 21 come from the extension's popup. Then the URL is tidied.
		const url = new URL(location.href);
		const program = url.searchParams.get('program');
		const fromPopup = url.searchParams.get('from') === 'extension';
		const failed = url.searchParams.get('whatif');
		if (failed) app.whatif = { code: failed, mode: 'fail' };
		const take = url.searchParams.get('take');
		const term = Number(url.searchParams.get('term'));
		if (take && Number.isInteger(term) && term > 0) {
			const checklist = new Set(UPLB_PROGRAMS[app.s.selectedProgram]?.majorCourses.map((c) => c.code));
			const codes = take.split(',').map((c) => c.trim()).filter((c) => checklist.has(c));
			const abs = absOfAmisTerm(term);
			Object.assign(app.s, takeCourses(codes, abs, app.s));
			tab = 'planner';
			message = codes.length
				? { text: `Room TBA put ${codes.join(', ')} in ${absLabel(abs)}.`, tone: 'ok' }
				: { text: "None of the courses from Room TBA are on your checklist, so nothing changed.", tone: 'bad' };
		}
		if (program && UPLB_PROGRAMS[program]?.available) {
			app.s.selectedProgram = program;
			app.blank = true;
		} else if (!app.hasData && tab === 'planner' && !fromPopup) app.blank = true;
		if (url.search) {
			['program', 'from', 'whatif', 'take', 'term'].forEach((k) => url.searchParams.delete(k));
			history.replaceState(history.state, '', url.pathname + url.search + url.hash);
		}
		probeExtension().then(async (r) => {
			extension = r ? (r.hasGrades ? 'found' : 'empty') : 'missing';
			const s = app.s;
			// Opening GradeSim from the popup is the student asking for their grades here.
			if (fromPopup && !app.hasData) {
				if (r?.hasGrades) await fromExtension();
				else if (tab === 'planner') app.blank = true;
				return;
			}
			if (!r?.hasGrades || !r.fetchedAt || s.source !== 'extension' || !s.fetchedAt || r.fetchedAt === s.fetchedAt) return;
			if (s.handEdited) {
				message = { text: 'The extension has newer grades from AMIS. Importing them replaces the grades you edited by hand.', tone: 'ok' };
				return;
			}
			const patch = parseBackup(await getExtensionGrades());
			if (typeof patch === 'string') return;
			app.refreshGrades(patch);
			message = { text: 'GradeSim loaded your newer grades from the extension.', tone: 'ok' };
		});
	});

	// Save on every change once the saved state has been read.
	$effect(() => {
		if (!app.ready) return;
		JSON.stringify(app.s);
		app.persist();
	});

	async function fromExtension() {
		const reply = await getExtensionGrades();
		if (!reply) {
			message = { text: "The extension didn't answer, so nothing changed. Reload this page and try again.", tone: 'bad' };
			return;
		}
		const r = parseBackup(reply);
		if (typeof r === 'string') {
			message = { text: r, tone: 'bad' };
			return;
		}
		app.applyGrades(r, 'extension');
		message = { text: `Imported ${app.courses.length} courses from the extension.`, tone: 'ok' };
		manual = false;
	}

	const fromFile = async (file: File) => fromText(await file.text(), file.name);

	function fromText(text: string, name: string) {
		const result = parseImport(text);
		if (result.kind === 'error') {
			message = { text: result.message, tone: 'bad' };
			return;
		}
		if (result.kind === 'grades') {
			app.applyGrades(result.patch, 'file');
			message = { text: `Imported ${app.courses.length} courses from ${name}.`, tone: 'ok' };
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
	title="Elbi GradeSim, the UPLB GWA calculator and course planner"
	description="Compute your UPLB GWA, see what you need for Latin honors, and plan your remaining terms around prerequisites. Free, open source, and your grades stay in your browser."
	path="/"
/>

{#if message}
	<div
		class="wrap flash"
		{@attach (el) => {
			void message; // reruns for each new message
			el.scrollIntoView({ block: 'nearest' });
		}}
	>
		<Notice tone={message.tone} live>
			{message.text}
			{#snippet action()}
				<button class="textbtn dismiss" type="button" onclick={() => (message = null)}>Dismiss</button>
			{/snippet}
		</Notice>
	</div>
{/if}

{#if !app.ready || (!app.hasData && !app.blank)}
	<div class:welcome-pending={!app.ready}>
		<Welcome {extension} {manual} onExtension={fromExtension} onFile={fromFile} onManual={() => (manual = true)} />
	</div>
{:else if !app.hasData}
	<div class="dash wrap">
		<p class="blank">
			{#if app.shared != null}
				This is a {app.program.name} plan someone shared with you. Nothing here is saved in this browser.
				<button class="textbtn" type="button" onclick={() => { app.closeShared(); setTab('grades'); }}>Close it</button>
			{:else}
				This is the {app.program.name} checklist planned from a blank transcript.
				<button class="textbtn" type="button" onclick={() => { app.blank = false; setTab('grades'); }}>Add your grades</button> to plan from where you are.
			{/if}
		</p>
		<Planner />
	</div>
{:else}
	<div class="dash">
		<div class="wrap">
			<h1 class="visually-hidden">Your dashboard</h1>
			<div class="tabs" role="tablist" aria-label="GradeSim sections">
				{#each TABS as t, i (t.id)}
					<button
						id="tab-{t.id}"
						role="tab"
						type="button"
						aria-selected={tab === t.id}
						aria-controls="panel-{t.id}"
						tabindex={tab === t.id ? 0 : -1}
						onclick={() => pickTab(t.id)}
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
			class="wrap"
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
		scroll-margin-top: 76px;
		margin-top: 12px;
	}

	.flash :global(.notice) {
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
			flex: 1 1 auto;
			padding: 8px 4px;
		}
	}

	.blank {
		margin: 20px 0 16px;
		color: var(--muted);
	}

	.blank .textbtn {
		display: inline;
		min-height: 0;
		padding: 0;
	}
</style>
