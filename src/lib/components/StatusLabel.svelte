<script lang="ts">
	import { STATUS, type CardStatus } from '#lib/planner.ts';
	import Icon, { type IconName } from './Icon.svelte';

	// A planner course status, always an icon plus a word. Colors live in planner.css.
	let { status, label }: { status: CardStatus; label?: string } = $props();
</script>

<span class="pl-status st-{status}"><Icon name={STATUS[status][0] as IconName} size={13} />{label ?? STATUS[status][1]}</span>
