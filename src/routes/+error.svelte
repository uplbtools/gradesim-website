<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PageHead from '#lib/components/PageHead.svelte';

	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{missing ? 'Page not found' : 'Something went wrong'}, Elbi GradeSim</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="wrap">
	<PageHead title={missing ? 'This page is not here' : 'Something went wrong'}>
		{#if missing}
			The link may be old or mistyped. Your grades are safe, since they live in this browser and not on any page.
		{:else}
			GradeSim hit an error ({page.status}). Reload the page, and if it keeps happening, tell us on GitHub.
		{/if}
	</PageHead>
	<p class="next">
		<a class="btn btn-primary" href={resolve('/')}>Open Elbi GradeSim</a>
		<a class="btn btn-secondary" href={resolve('curricula/')}>Browse curricula</a>
		<a class="textbtn" href="https://github.com/uplbtools/gradesim/issues" rel="noopener" target="_blank">Report a broken link</a>
	</p>
</div>

<style>
	.next {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-top: 16px;
	}
</style>
