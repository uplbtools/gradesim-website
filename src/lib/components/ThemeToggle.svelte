<script lang="ts">
	import { onMount } from 'svelte';
	import { THEME_KEY } from '#lib/app.svelte.ts';
	import Icon from './Icon.svelte';

	type Theme = 'system' | 'light' | 'dark';
	const ORDER: Theme[] = ['system', 'light', 'dark'];
	const ICON = { system: 'monitor', light: 'sun', dark: 'moon' } as const;
	const LABEL = { system: 'Theme follows your device', light: 'Light theme', dark: 'Dark theme' };

	let theme = $state<Theme>('system');
	onMount(() => {
		const t = document.documentElement.dataset.theme;
		theme = t === 'light' || t === 'dark' ? t : 'system';
	});

	function cycle() {
		theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
		if (theme === 'system') delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = theme;
		try {
			if (theme === 'system') localStorage.removeItem(THEME_KEY);
			else localStorage.setItem(THEME_KEY, theme);
		} catch {
			/* not saved, still applied */
		}
	}
</script>

<button class="btn btn-ghost toggle" type="button" onclick={cycle} aria-label="{LABEL[theme]}. Change theme" title={LABEL[theme]} data-theme-state={theme}>
	<Icon name={ICON[theme]} />
</button>

<style>
	.toggle {
		width: 44px;
		padding: 0;
	}
</style>
