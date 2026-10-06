<script lang="ts">
	// A product screenshot in the light and dark theme. Only the one matching the
	// current theme is displayed, and lazy images that are not displayed are not fetched.
	let { name, alt, width, height }: { name: string; alt: string; width: number; height: number } = $props();
</script>

<span class="shot">
	<img class="light" src="/screenshots/{name}-light.jpg" {alt} {width} {height} loading="lazy" decoding="async" />
	<img class="dark" src="/screenshots/{name}-dark.jpg" {alt} {width} {height} loading="lazy" decoding="async" />
</span>

<style>
	.shot img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
	}

	.dark {
		display: none !important;
	}

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .light {
			display: none !important;
		}
		:global(:root:not([data-theme='light'])) .dark {
			display: block !important;
		}
	}

	:global(:root[data-theme='dark']) .light {
		display: none !important;
	}
	:global(:root[data-theme='dark']) .dark {
		display: block !important;
	}
</style>
