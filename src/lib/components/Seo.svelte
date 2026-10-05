<script lang="ts">
	let { title, description, path }: { title: string; description: string; path: string } = $props();
	const url = $derived(`https://gradesim.uplb.tools${path}`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Elbi GradeSim" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content="https://gradesim.uplb.tools/og.jpg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Elbi GradeSim, the UPLB GWA calculator and course planner" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>
