// Prerequisite arrows routed like tidy cable management. Pure geometry with
// no DOM. The extension keeps a plain JS copy in extension/src/route-edges.js
// (uplbtools/gradesim). Change both.
//
// Cards sit on a lattice. Every card has the same height, columns are colGap
// apart and rows rowGap apart, so the gaps line up into straight channels.
// An arrow leaves its prerequisite from the right edge, drops into the column
// gap beside it, runs along the row gap next to the target's row across any
// terms in between, climbs or drops in the column gap before the target, and
// enters it from the left. It only ever travels through gaps, never over a
// card. Each trunk in a column gap and each track in a row gap gets its own
// lane, spread evenly across the gap.

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = [number, number];
export type Route = { points: Point[]; d: string };

const ARROW_INSET = 4; // the arrowhead marker covers the last few pixels

type Trunk = { L: number[]; R: number[]; x: number };
type Plan = { a: Rect; b: Rect; ys: number; yt: number; out: Trunk; into?: Trunk; band: number; y: number };
type Run = { x0: number; x1: number; plans: Plan[]; track: number };

/** Routes edges whose source column sits left of the target column. Same order out as in. */
export function routeEdges(
	edges: { from: Rect; to: Rect }[],
	{ colGap, rowGap, radius = 5 }: { colGap: number; rowGap: number; radius?: number }
): Route[] {
	const mid = (r: Rect) => r.y + r.h / 2;
	const id = (r: Rect) => `${Math.round(r.x)},${Math.round(r.y)}`;
	const same = (a: number, b: number) => Math.abs(a - b) < 0.5;

	// Column gaps, keyed by their left edge. Each holds trunks: one per source
	// card leaving through it (its arrows bundle, then fan out) and one per
	// target card entering through it. A trunk records the heights where it
	// branches off to the left (L) and to the right (R).
	const gaps = new Map<number, { x: number; trunks: Map<string, Trunk> }>();
	const trunk = (gx: number, key: string) => {
		const k = Math.round(gx);
		if (!gaps.has(k)) gaps.set(k, { x: gx, trunks: new Map() });
		const g = gaps.get(k)!.trunks;
		if (!g.has(key)) g.set(key, { L: [], R: [], x: 0 });
		return g.get(key)!;
	};

	const plans: Plan[] = edges.map(({ from: a, to: b }) => {
		const ys = mid(a);
		const yt = mid(b);
		const out = trunk(a.x + a.w, `out ${id(a)}`);
		out.L.push(ys);
		if (b.x - colGap - (a.x + a.w) < 1) {
			// neighbouring terms share one gap
			out.R.push(yt);
			return { a, b, ys, yt, out, band: 0, y: 0 };
		}
		// Row gap beside the target's row, on the side the arrow comes from.
		const band = ys <= yt ? b.y - rowGap : b.y + b.h;
		const into = trunk(b.x - colGap, `in ${id(b)}`);
		out.R.push(band + rowGap / 2);
		into.L.push(band + rowGap / 2);
		into.R.push(yt);
		return { a, b, ys, yt, out, into, band, y: 0 };
	});

	// Order the trunks in each gap to cut down crossings, then spread them out.
	// Crossings if p sits left of q: p's right branches cut q's trunk, q's left
	// branches cut p's trunk, and a shared height would run two arrows together.
	const span = (t: Trunk) => [Math.min(...t.L, ...t.R), Math.max(...t.L, ...t.R)];
	const cost = (p: Trunk, q: Trunk) => {
		const [p0, p1] = span(p);
		const [q0, q1] = span(q);
		let c = 0;
		p.R.forEach((y) => {
			if (y > q0 && y < q1) c++;
			if (q.L.some((l) => same(l, y))) c += 10;
		});
		q.L.forEach((y) => {
			if (y > p0 && y < p1) c++;
		});
		return c;
	};
	gaps.forEach(({ x, trunks }) => {
		// A trunk with no height is a straight line across and needs no lane.
		const list = [...trunks.values()].filter((t) => {
			const [y0, y1] = span(t);
			t.x = x + colGap / 2;
			return y1 - y0 >= 0.5;
		});
		// Start from source row, then target row, then swap neighbours while it helps.
		list.sort((p, q) => Math.min(...p.L) - Math.min(...q.L) || Math.min(...p.R) - Math.min(...q.R));
		for (let pass = 0, swapped = true; swapped && pass < list.length; pass++) {
			swapped = false;
			for (let i = 0; i + 1 < list.length; i++) {
				if (cost(list[i + 1], list[i]) < cost(list[i], list[i + 1])) {
					[list[i], list[i + 1]] = [list[i + 1], list[i]];
					swapped = true;
				}
			}
		}
		list.forEach((t, i) => (t.x = x + ((i + 1) * colGap) / (list.length + 1)));
	});

	// Row gap tracks. Arrows from one source share a track like a bundle; runs
	// that overlap get separate tracks, spread evenly across the gap.
	const bands = new Map<number, Map<Trunk, Run>>();
	plans.forEach((p) => {
		if (!p.into) return;
		const k = Math.round(p.band);
		if (!bands.has(k)) bands.set(k, new Map());
		const runs = bands.get(k)!;
		const x0 = Math.min(p.out.x, p.into.x);
		const x1 = Math.max(p.out.x, p.into.x);
		const run = runs.get(p.out);
		if (run) {
			run.x0 = Math.min(run.x0, x0);
			run.x1 = Math.max(run.x1, x1);
			run.plans.push(p);
		} else runs.set(p.out, { x0, x1, plans: [p], track: 0 });
	});
	bands.forEach((runs) => {
		const ends: number[] = [];
		const list = [...runs.values()].sort((p, q) => p.x0 - q.x0 || p.x1 - q.x1);
		list.forEach((run) => {
			let t = ends.findIndex((e) => e < run.x0 - 0.5);
			if (t < 0) t = ends.length;
			ends[t] = run.x1;
			run.track = t;
		});
		list.forEach((run) => run.plans.forEach((p) => (p.y = p.band + ((run.track + 1) * rowGap) / (ends.length + 1))));
	});

	return plans.map((p) => {
		const sx = p.a.x + p.a.w;
		const points: Point[] = p.into
			? [[sx, p.ys], [p.out.x, p.ys], [p.out.x, p.y], [p.into.x, p.y], [p.into.x, p.yt], [p.b.x, p.yt]]
			: [[sx, p.ys], [p.out.x, p.ys], [p.out.x, p.yt], [p.b.x, p.yt]];
		return { points, d: pathD(points, radius) };
	});
}

/** Orthogonal polyline with rounded corners, stopping short for the arrowhead. */
export function pathD(points: Point[], radius: number): string {
	const pts = points.map((p): Point => [p[0], p[1]]);
	pts[pts.length - 1][0] -= ARROW_INSET;
	// Drop repeated points, then straight-through corners.
	const uniq = pts.filter((p, i) => !i || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
	const clean = uniq.filter((p, i) => {
		const prev = uniq[i - 1];
		const next = uniq[i + 1];
		return !(prev && next && ((prev[0] === p[0] && p[0] === next[0]) || (prev[1] === p[1] && p[1] === next[1])));
	});
	let d = `M ${clean[0][0]} ${clean[0][1]}`;
	for (let i = 1; i < clean.length - 1; i++) {
		const [px, py] = clean[i - 1];
		const [cx, cy] = clean[i];
		const [nx, ny] = clean[i + 1];
		const r = Math.min(radius, Math.hypot(cx - px, cy - py) / 2, Math.hypot(nx - cx, ny - cy) / 2);
		d +=
			` L ${cx - Math.sign(cx - px) * r} ${cy - Math.sign(cy - py) * r}` +
			` Q ${cx} ${cy} ${cx + Math.sign(nx - cx) * r} ${cy + Math.sign(ny - cy) * r}`;
	}
	const last = clean[clean.length - 1];
	return `${d} L ${last[0]} ${last[1]}`;
}
