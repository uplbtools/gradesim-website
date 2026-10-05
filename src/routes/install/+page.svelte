<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '#lib/components/Seo.svelte';
	import Icon from '#lib/components/Icon.svelte';

	const stores = [
		{
			name: 'Chrome',
			logo: '/chrome.svg',
			href: 'https://chromewebstore.google.com/detail/elbi-gradesim-uplb-gwa-ca/mlhklblbhkikcmobmmajckjcbmdinldb',
			store: 'Chrome Web Store'
		},
		{
			name: 'Firefox',
			logo: '/firefox.svg',
			href: 'https://addons.mozilla.org/en-US/firefox/addon/elbi-gradesim/',
			store: 'Firefox Add-ons'
		},
		{
			name: 'Edge',
			logo: '/edge.svg',
			href: 'https://microsoftedge.microsoft.com/addons/detail/elbi-gradesim-uplb-gwa-/ebiakebpglddgmkdehdjiadnjgkmgnga',
			store: 'Edge Add-ons'
		}
	];
</script>

<Seo
	title="Install the Elbi GradeSim extension"
	description="Get the free Elbi GradeSim extension for Chrome, Firefox or Edge. It reads your grades when you open AMIS and keeps them on your device."
	path="/install/"
/>

<div class="wrap">
	<header class="page-head">
		<h1>Install the extension</h1>
		<p>
			The extension reads your grades when you open AMIS, then shows them in its popup and hands them to this web app when you
			ask. It is free, open source, and keeps everything on your device.
		</p>
	</header>

	<ul class="stores">
		{#each stores as s (s.name)}
			<li>
				<a class="store card" href={s.href} rel="noopener" target="_blank">
					<img src={s.logo} alt="" width="44" height="44" />
					<span>
						<strong>Add to {s.name}</strong>
						<span class="muted">{s.store}</span>
					</span>
					<Icon name="external" />
				</a>
			</li>
		{/each}
	</ul>

	<p class="also">
		<img src="/opera.svg" alt="" width="24" height="24" /><img src="/brave.svg" alt="" width="24" height="24" />
		<span>Opera, Brave and other Chromium browsers can install it from the Chrome Web Store.</span>
	</p>

	<section class="prose steps">
		<h2>After installing</h2>
		<ol>
			<li>Log in to <a href="https://amis.uplb.edu.ph" rel="noopener" target="_blank">AMIS</a> as usual. GradeSim never sees your password; you sign in to AMIS itself.</li>
			<li>Open your grades. The extension saves them in your browser.</li>
			<li>Come back to <a href={resolve('/')}>Elbi GradeSim</a> and choose Import from the GradeSim extension.</li>
		</ol>
		<p>
			No extension, or on a phone? You can still use the web app. Import a JSON backup or type your grades in by hand.
		</p>
	</section>
</div>

<style>
	.stores {
		list-style: none;
		padding: 0;
		margin-top: 20px;
		display: grid;
		gap: 12px;
	}

	.store {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 80px;
		text-decoration: none;
		color: var(--ink);
		transition: border-color var(--transition-fast);
	}

	.store:hover {
		border-color: var(--brand);
		color: var(--ink);
	}

	.store > span {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.store strong {
		font-size: 1.05rem;
	}

	.also {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 16px;
		color: var(--muted);
		font-size: 0.92rem;
	}

	.also span {
		margin-left: 6px;
	}

	.steps {
		margin-top: 8px;
	}

	.steps ol {
		padding-left: 1.25rem;
	}

	.steps li + li {
		margin-top: 0.4rem;
	}

	@media (min-width: 720px) {
		.stores {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
