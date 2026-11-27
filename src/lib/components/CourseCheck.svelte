<script lang="ts">
	// Asks which courses a student took for an open major slot and sends the answer to the course check form.
	let {
		program,
		major,
		taken,
		onsent,
		oncancel
	}: { program: string; major?: string; taken: string[]; onsent: () => void; oncancel: () => void } = $props();

	const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSf3AEKf6DTpsXfq3WZAc3RXGPaX2V3qLydheP21g_gMHtUcXQ/formResponse';
	const YEARS = ['2nd year', '3rd year', '4th year', '5th year', 'Graduated'];
	const SURE = [
		'My adviser or college secretary said so',
		'My checklist lists them',
		'They counted in my AMIS checklist or evaluation',
		"It's my best guess"
	];

	let picked = $state<string[]>([]);
	let others = $state('');
	let yearPick = $state('');
	let sure = $state('');
	let contact = $state('');
	let error = $state('');
	let sending = $state(false);

	async function send(e: SubmitEvent) {
		e.preventDefault();
		const codes = [...picked, others.trim()].filter(Boolean).join(', ');
		if (!codes) {
			error = 'Tick or type at least one course.';
			return;
		}
		const fields = [
			['entry.1230122317', program],
			['entry.1556773492', major],
			['entry.323619521', yearPick],
			['entry.1973018930', codes],
			['entry.73101628', sure],
			['entry.824639324', contact.trim()]
		].filter((f): f is [string, string] => !!f[1]);
		const body = new URLSearchParams(fields);
		sending = true;
		try {
			await fetch(FORM, { method: 'POST', mode: 'no-cors', body });
			onsent();
		} catch {
			error = "That didn't send. Check your connection, then press Send again.";
		}
		sending = false;
	}
</script>

<form class="pl-fix" onsubmit={send}>
	<p><strong>Which courses did you take for your major?</strong></p>
	{#if taken.length}
		<fieldset>
			<legend>From your grades</legend>
			{#each taken as code (code)}
				<label class="check"><input type="checkbox" bind:group={picked} value={code} /> {code}</label>
			{/each}
		</fieldset>
	{/if}
	<label class="field">
		{taken.length ? 'Other courses (optional)' : 'Course codes'}
		<input class="input" bind:value={others} placeholder={taken.length ? undefined : 'STAT 164, STAT 166'} />
	</label>
	<label class="field">
		Year level
		<select class="select" bind:value={yearPick} required>
			<option value="" disabled>Pick one</option>
			{#each YEARS as y (y)}<option>{y}</option>{/each}
		</select>
	</label>
	<label class="field">
		How do you know they count?
		<select class="select" bind:value={sure} required>
			<option value="" disabled>Pick one</option>
			{#each SURE as s (s)}<option>{s}</option>{/each}
		</select>
	</label>
	<label class="field">
		Messenger or email (optional)
		<input class="input" bind:value={contact} maxlength="120" />
		<small>We only use it to ask a follow-up question.</small>
	</label>
	{#if error}<p class="pl-fix-error" role="alert">{error}</p>{/if}
	<div class="pl-actions">
		<button class="btn btn-primary" type="submit" disabled={sending}>Send</button>
		<button class="textbtn" type="button" onclick={oncancel}>Cancel</button>
	</div>
</form>
