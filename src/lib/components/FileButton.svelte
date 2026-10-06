<script lang="ts">
	import Icon from './Icon.svelte';

	let { label, onFile, quiet = false }: { label: string; onFile: (f: File) => void; quiet?: boolean } = $props();
	let input: HTMLInputElement | undefined = $state();
</script>

<button class={quiet ? 'textbtn' : 'btn btn-secondary'} type="button" onclick={() => input?.click()}>
	<Icon name="upload" />{label}
</button>
<input
	bind:this={input}
	type="file"
	accept=".json,application/json"
	hidden
	data-testid="file-input"
	onchange={(e) => {
		const f = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (f) onFile(f);
	}}
/>
