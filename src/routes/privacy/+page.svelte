<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
</script>

<Seo
	title="Privacy policy, Elbi GradeSim"
	description="How Elbi GradeSim handles your data. Grades stay in your browser, in the web app's local storage or the extension's storage. Nothing is uploaded."
	path="/privacy/"
/>

<div class="wrap">
	<PageHead title="Privacy policy">Last updated October 6, 2026</PageHead>

	<article class="prose">
		<h2>What Elbi GradeSim is</h2>
		<p>
			Elbi GradeSim is a free web app at gradesim.uplb.tools and a companion browser extension. Both help UPLB students compute
			their GWA, simulate Latin honor targets and plan their remaining terms. They are open source projects maintained by
			student volunteers under UPLB Tools, and they are not an official UPLB product.
		</p>

		<h2>Your grades stay in your browser</h2>
		<p>
			<strong>The web app saves your grades, settings and plan in your browser’s local storage on this device.</strong> It does
			not send your grades, GWA or plan to any server. All computation happens in your browser.
		</p>
		<ul>
			<li>No account or sign-up.</li>
			<li>No analytics, tracking or advertising scripts in the app.</li>
			<li>No cloud sync. Clearing your browser data, or using Clear my data on the Grades tab, removes what was saved.</li>
			<li>Backups and plan files you export are saved as files on your device, and you decide where they go.</li>
		</ul>

		<h2>The extension</h2>
		<p>
			The extension reads the grades AMIS already shows you when you open it while logged in, and keeps them in the
			extension’s storage on your device. It does not send your AMIS credentials, grades or GWA anywhere. It only runs on AMIS
			pages and, so that it can hand your grades to this web app when you ask, on gradesim.uplb.tools.
		</p>
		<p>
			When you choose Import from the GradeSim extension, the extension passes your grades directly to this page inside your
			browser. They do not travel over the network.
		</p>

		<h2>Hosting</h2>
		<p>
			The site is hosted on Vercel and reaches you through Cloudflare, which sits in front of it as a proxy and cache. Both
			may log standard request details such as IP address, browser and time of visit for security and delivery. Those logs never contain your grades, because your grades are not
			sent with any request. After the first visit the app can run offline from your browser’s cache.
		</p>

		<h2>Browser store listings</h2>
		<p>
			When you install the extension from the Chrome Web Store, Firefox Add-ons or Edge Add-ons, those platforms may collect
			installation and usage statistics under their own privacy policies. We only see aggregate install counts.
		</p>

		<h2>Open source</h2>
		<p>
			The source code for the web app and the extension is public on GitHub, so you can check how data is handled.
			Curriculum contributions in the repository never include anyone’s grades.
		</p>

		<h2>Children</h2>
		<p>Elbi GradeSim is meant for UPLB students and is not directed at children under 13.</p>

		<h2>Changes</h2>
		<p>We will update this policy if the app or the extension changes how data is handled. The date above shows the latest revision.</p>

		<h2>Contact</h2>
		<p>
			For questions about this policy, open an issue on
			<a href="https://github.com/uplbtools/gradesim/issues" rel="noopener" target="_blank">GitHub</a>. Issues are public, so
			never paste your grades or AMIS details there.
		</p>
	</article>
</div>
