<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.ts';
	import { programsByCollege } from '#lib/curriculum.ts';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	const groups = programsByCollege();
	const onApp = $derived(page.url.pathname === '/');
	let menu: HTMLDetailsElement | undefined = $state();

	function closeMenu(e: Event) {
		if (menu?.open && !menu.contains(e.target as Node)) menu.open = false;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && menu?.open) {
			menu.open = false;
			menu.querySelector('summary')?.focus();
		}
	}
</script>

<svelte:window onclick={closeMenu} onkeydown={onKey} />

<header class="site-header">
	<div class="bar">
		<a class="brand" href={resolve('/')} aria-label="Elbi GradeSim home">
			<img src="/plumbob.svg" alt="" width="20" height="30" />
			<span class="name">Elbi GradeSim</span>
			<span class="by">by UPLB Tools</span>
		</a>

		{#if onApp && app.ready && app.hasData}
			<label class="program">
				<span class="visually-hidden">Your degree program</span>
				<select class="select" bind:value={app.s.selectedProgram}>
					{#each groups as g (g.college)}
						<optgroup label={g.name}>
							{#each g.programs as p (p.code)}
								<option value={p.code} disabled={!p.available}>{p.available ? p.name : `${p.name}, coming soon`}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</label>
		{/if}

		<div class="tools">
			<ThemeToggle />
			<details class="menu" bind:this={menu}>
				<summary class="btn btn-ghost" aria-label="Menu">
					<Icon name="menu" />
					<span class="menu-word">Menu</span>
				</summary>
				<nav class="menu-pop" aria-label="Site">
					<a href={resolve('/')}>Your grades</a>
					<a href={resolve('about/')}>About GradeSim</a>
					<a href={resolve('curricula/')}>Curricula</a>
					<a href={resolve('install/')}>Install the extension</a>
					<a href={resolve('privacy/')}>Privacy</a>
					<a href={resolve('terms/')}>Terms</a>
					<hr />
					<a href="https://github.com/uplbtools/gradesim" rel="noopener" target="_blank">
						GitHub <Icon name="external" size={14} />
					</a>
					<a href="https://uplb.tools" rel="noopener" target="_blank">
						More from UPLB Tools <Icon name="external" size={14} />
					</a>
				</nav>
			</details>
		</div>
	</div>
</header>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 50;
		background: color-mix(in srgb, var(--bg-page) 92%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--border);
	}

	.bar {
		max-width: 1600px;
		margin: 0 auto;
		padding: 8px 16px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		text-decoration: none;
		color: var(--ink);
	}

	.name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.15rem;
	}

	.by {
		font-size: 0.8rem;
		color: var(--muted);
	}

	.program {
		order: 3;
		flex: 1 1 100%;
	}

	.program .select {
		font-weight: 600;
	}

	.tools {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.menu {
		position: relative;
	}

	.menu > summary {
		list-style: none;
	}

	.menu > summary::-webkit-details-marker {
		display: none;
	}

	.menu-pop {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		width: 250px;
		display: flex;
		flex-direction: column;
		padding: 6px;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
	}

	.menu-pop a {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		color: var(--ink);
		text-decoration: none;
	}

	.menu-pop a:hover {
		background: var(--brand-tint);
	}

	.menu-pop hr {
		width: 100%;
		margin: 4px 0;
		border: 0;
		border-top: 1px solid var(--border);
	}

	@media (max-width: 479px) {
		.by,
		.menu-word {
			display: none;
		}
	}

	@media (min-width: 720px) {
		.bar {
			padding: 8px 24px;
		}

		.program {
			order: 0;
			flex: 0 1 340px;
		}
	}
</style>
