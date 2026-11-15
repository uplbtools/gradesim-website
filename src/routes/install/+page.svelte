<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '#lib/components/Seo.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { BOOKMARKLET } from '#lib/bookmarklet.ts';

	let copied = $state<boolean | 'failed'>(false);

	async function copyBookmarklet() {
		copied = await navigator.clipboard.writeText(BOOKMARKLET).then(
			() => true,
			() => 'failed' as const
		);
	}

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
	<PageHead title="Get the extension">
		The extension reads your grades when you open AMIS. It's free and open source, and it keeps everything on your device.
	</PageHead>

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
			<li>Log in to <a href="https://amis.uplb.edu.ph" rel="noopener" target="_blank">AMIS</a>.</li>
			<li>Open your grades. The extension saves them in your browser.</li>
			<li>Come back to <a href={resolve('/')}>GradeSim</a>. Your grades load after you choose Import from the extension once.</li>
		</ol>
	</section>

	<section class="prose steps">
		<h2 id="phone">On a phone</h2>
		<p>
			Firefox for Android can install the extension from <a href={stores[1].href} rel="noopener" target="_blank">Firefox Add-ons</a>.
			Chrome and Safari on phones can't install extensions, so use a bookmark that opens GradeSim with your grades.
		</p>
		<ol>
			<li>
				<button class="btn" type="button" onclick={copyBookmarklet}>{copied === true ? 'Copied' : 'Copy the bookmark'}</button>
				{#if copied === 'failed'}<span role="alert">Your browser blocked the copy. Allow clipboard access for this site, then try again.</span>{/if}
			</li>
			<li>Bookmark any page, edit the bookmark, name it gradesim and paste what you copied as its address.</li>
			<li>
				Log in to <a href="https://amis.uplb.edu.ph" rel="noopener" target="_blank">AMIS</a>, type gradesim in the address bar and tap the
				bookmark. GradeSim opens with your grades.
			</li>
		</ol>
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
