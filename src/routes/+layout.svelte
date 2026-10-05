<script lang="ts">
	import '#lib/styles/tokens.css';
	import '#lib/styles/app.css';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>
<SiteHeader />
<main id="main" tabindex="-1">
	{@render children()}
</main>
<SiteFooter />
