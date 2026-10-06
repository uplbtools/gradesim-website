// Offline support: precache the build and the prerendered pages, then serve
// them when the network is gone. Query strings never break a cache hit
// (/?program=BSCS#planner must open offline), and /about matches /about/.

import { self } from '$app/service-worker';
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `gradesim-${version}`;
// ponytail: the checklist images (28 MB) stay network-only; cache them on view if offline checklists matter.
const big = (p: string) => p.includes('curricula/') || p.includes('screenshots/');
const PRECACHE = [
	...immutable.map((f) => f.path),
	...assets.map((f) => f.path).filter((p) => !big(p)),
	...prerendered.map((f) => f.path)
].map((p) => new URL(p, self.registration.scope).pathname);

/** /about and /about/index.html both mean the prerendered /about/. */
function pageKey(url: URL): string {
	let p = url.pathname.replace(/index\.html$/, '');
	if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
	return p;
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	if (req.mode === 'navigate') {
		// Network first so a new deploy shows up, cache when offline.
		event.respondWith(
			fetch(req).catch(async () => {
				const cache = await caches.open(CACHE);
				return (
					(await cache.match(pageKey(url), { ignoreSearch: true })) ??
					(await cache.match('/', { ignoreSearch: true })) ??
					Response.error()
				);
			})
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const hit = await cache.match(url.pathname, { ignoreSearch: true });
			if (hit) return hit;
			const res = await fetch(req);
			if (res.ok && res.type === 'basic' && !big(url.pathname)) cache.put(url.pathname, res.clone());
			return res;
		})()
	);
});
