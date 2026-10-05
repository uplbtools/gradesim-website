<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<footer class="site-footer">
	<div class="wrap">
		<nav aria-label="Footer">
			<a href={resolve('about/')}>About</a>
			<a href={resolve('curricula/')}>Curricula</a>
			<a href={resolve('install/')}>Install the extension</a>
			<a href={resolve('privacy/')}>Privacy</a>
			<a href={resolve('terms/')}>Terms</a>
			<a href="https://github.com/uplbtools/gradesim" rel="noopener" target="_blank">GitHub</a>
			<a href="https://uplb.tools" rel="noopener" target="_blank">UPLB Tools</a>
		</nav>
		<p>
			Elbi GradeSim is a student-run project under <a href="https://uplb.tools" rel="noopener" target="_blank">UPLB Tools</a>. It is not an
			official UPLB website, and your grades never leave your browser.
		</p>
	</div>
</footer>

<style>
	.site-footer {
		margin-top: 48px;
		padding: 20px 0 32px;
		border-top: 1px solid var(--border);
		font-size: 0.85rem;
		color: var(--muted);
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin-bottom: 8px;
	}

	nav a {
		display: inline-flex;
		align-items: center;
		min-height: 32px;
		color: var(--body);
	}
</style>
