import { expect, test } from 'vitest';
import { routeEdges, type Rect } from './route-edges.ts';

const COL_W = 150;
const COL_GAP = 36;
const CARD_H = 110;
const ROW_GAP = 20;
const TOP = 60;
const PITCH = CARD_H + ROW_GAP;

type Card = Rect & { c: number; r: number };

// Small seeded generator so a failure is reproducible.
function rng(seed: number) {
	let s = seed;
	return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

function lattice(seed: number) {
	const rand = rng(seed);
	const cards: Card[] = [];
	for (let c = 0; c < 8; c++) {
		const rows = 2 + Math.floor(rand() * 6);
		for (let r = 0; r < rows; r++) cards.push({ x: c * (COL_W + COL_GAP), y: TOP + r * PITCH, w: COL_W, h: CARD_H, c, r });
	}
	const edges: { from: Card; to: Card }[] = [];
	for (let i = 0; i < 30; i++) {
		const from = cards[Math.floor(rand() * cards.length)];
		const later = cards.filter((t) => t.c > from.c);
		if (later.length) edges.push({ from, to: later[Math.floor(rand() * later.length)] });
	}
	return { cards, edges };
}

const touches = (s: { x0: number; x1: number; y0: number; y1: number }, r: Rect) =>
	s.x0 <= r.x + r.w && s.x1 >= r.x && s.y0 <= r.y + r.h && s.y1 >= r.y;

// Lanes in a gap are distinct and evenly spaced across it: offsets at (k+1)/(n+1).
function expectEven(lanes: Set<number>, start: number, width: number) {
	const xs = [...lanes].sort((a, b) => a - b);
	xs.forEach((x, k) => expect(x - start).toBeCloseTo(((k + 1) * width) / (xs.length + 1), 6));
}

test.each(Array.from({ length: 40 }, (_, i) => i + 1))('random lattice %i: arrows stay in the gaps on even lanes', (seed) => {
	const { cards, edges } = lattice(seed);
	const routes = routeEdges(edges, { colGap: COL_GAP, rowGap: ROW_GAP });
	expect(routes).toHaveLength(edges.length);
	const colLanes = new Map<number, Set<number>>();
	const rowLanes = new Map<number, Set<number>>();

	routes.forEach(({ points, d }, i) => {
		const { from, to } = edges[i];
		expect(d.startsWith('M ')).toBe(true);
		expect(points[0]).toEqual([from.x + from.w, from.y + from.h / 2]);
		expect(points.at(-1)).toEqual([to.x, to.y + to.h / 2]);
		for (let k = 1; k < points.length; k++) {
			const [ax, ay] = points[k - 1];
			const [bx, by] = points[k];
			expect(ax === bx || ay === by, `edge ${i} segment ${k} is axis aligned`).toBe(true);
			const s = { x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by) };
			for (const card of cards) {
				// The first and last segments meet their own card only at the endpoint.
				if (card === from && k === 1) expect(s.x0).toBeGreaterThanOrEqual(card.x + card.w);
				else if (card === to && k === points.length - 1) expect(s.x1).toBeLessThanOrEqual(card.x);
				else expect(touches(s, card), `edge ${i} segment ${k} touches card ${card.c},${card.r}`).toBe(false);
			}
			if (ax === bx && ay !== by) {
				// vertical run in a column gap
				const gap = Math.floor(ax / (COL_W + COL_GAP)) * (COL_W + COL_GAP) + COL_W;
				if (!colLanes.has(gap)) colLanes.set(gap, new Set());
				colLanes.get(gap)!.add(ax);
			}
			if (ay === by && ax !== bx && k !== 1 && k !== points.length - 1) {
				// run along a row gap
				const top = TOP - ROW_GAP + Math.floor((ay - TOP + ROW_GAP) / PITCH) * PITCH;
				expect(ay).toBeGreaterThan(top);
				expect(ay).toBeLessThan(top + ROW_GAP);
				if (!rowLanes.has(top)) rowLanes.set(top, new Set());
				rowLanes.get(top)!.add(ay);
			}
		}
	});
	colLanes.forEach((xs, gap) => expectEven(xs, gap, COL_GAP));
	rowLanes.forEach((ys, top) => expectEven(ys, top, ROW_GAP));
});

test('neighbouring cards in one row get a straight arrow', () => {
	const from = { x: 0, y: 0, w: 150, h: 110 };
	const to = { x: 186, y: 0, w: 150, h: 110 };
	const [r] = routeEdges([{ from, to }], { colGap: 36, rowGap: 20 });
	expect(r.d).toBe('M 150 55 L 182 55');
});
