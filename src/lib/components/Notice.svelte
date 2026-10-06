<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	// The one notice line: tone picks the icon and its color (.notice in app.css).
	let {
		tone = 'info',
		live = false,
		children,
		action
	}: { tone?: 'info' | 'ok' | 'warn' | 'bad'; live?: boolean; children: Snippet; action?: Snippet } = $props();
	const ICON = { info: 'info', ok: 'check', warn: 'alert', bad: 'alert' } as const;
</script>

<div class="notice {tone}" role={live ? 'status' : undefined}>
	<Icon name={ICON[tone]} />
	<span>{@render children()}</span>
	{@render action?.()}
</div>
