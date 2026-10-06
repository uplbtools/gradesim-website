<script lang="ts">
	import type { Snippet } from 'svelte';

	// Title block shared by every page around the app.
	let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<header class="page-head">
	<h1>{title}</h1>
	{#if children}<p>{@render children()}</p>{/if}
</header>
