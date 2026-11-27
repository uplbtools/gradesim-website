// Elbi GradeSim Wrapped, ported from the extension popup. The panels are data
// here; Wrapped.svelte shows them and drawCard() paints the shareable image.

import { groupGWA, isPrefixExcluded, NON_NUMERIC_GRADES, numericGrade, scholarFor, scholarHolds, termKeyToAbs, type Course } from './grades.ts';

interface Highlight {
	label: string;
	name: string;
	detail: string;
}

export interface Panel {
	emoji: string;
	title: string;
	value: string;
	subtitle?: string;
	message: string;
	badges?: { text: string; special: boolean }[];
	highlights?: Highlight[];
	/** Caption under the highlights on the exported card. */
	caption?: string;
	/** Which of Reann Vargas's pages the card is drawn on. */
	frame?: 'sem' | 'id' | 'tin' | 'note' | 'tray' | 'open';
	/** Sem GWAs in order, for the line on the lid. */
	sems?: number[];
	/** Share of units passed, 0 to 1. */
	progress?: number;
	/** One more line on the card. */
	extra?: string;
	/** Units in the sem, on the sem card. */
	units?: number;
}

interface Sem {
	name: string;
	gwa: number;
}

export function wrappedData(courses: Course[]) {
	const distinct = new Set<string>();
	const distribution: Record<string, number> = {};
	const retakes: Record<string, number> = {};
	const sems = new Map<string, { w: number; u: number; abs: number }>();
	let fails = 0;
	let weighted = 0;
	let units = 0;
	let passedUnits = 0;
	let best: { code: string; grade: number } | null = null;
	let worst: { code: string; grade: number } | null = null;

	courses.forEach((c) => {
		if (isPrefixExcluded(c.code)) return;
		distinct.add(c.grade);
		if (NON_NUMERIC_GRADES.includes(c.grade)) return;
		const g = numericGrade(c.grade);
		if (g == null || !c.units) return;
		const s = sems.get(c.termLabel) || { w: 0, u: 0, abs: termKeyToAbs(c.termKey) ?? 0 };
		s.w += g * c.units;
		s.u += c.units;
		sems.set(c.termLabel, s);
		distribution[g.toFixed(2)] = (distribution[g.toFixed(2)] || 0) + 1;
		const code = c.code.toUpperCase().trim();
		retakes[code] = (retakes[code] || 0) + 1;
		if (g === 5) fails++;
		if (!best || g < best.grade) best = { code: c.code, grade: g };
		if (g < 5 && (!worst || g > worst.grade)) worst = { code: c.code, grade: g };
		weighted += g * c.units;
		units += c.units;
		if (g <= 3) passedUnits += c.units;
	});

	let mostRetaken: { code: string; count: number } | null = null;
	Object.entries(retakes).forEach(([code, count]) => {
		if (count > 1 && (!mostRetaken || count > mostRetaken.count)) mostRetaken = { code, count };
	});

	const semList: Sem[] = Array.from(sems, ([name, s]) => ({ name, gwa: s.w / s.u, abs: s.abs })).sort((a, b) => a.abs - b.abs);
	let comeback: { sem: Sem; up: number } | null = null;
	semList.forEach((s, i) => {
		const up = i ? semList[i - 1].gwa - s.gwa : 0;
		if (up >= 0.1 && (!comeback || up > comeback.up)) comeback = { sem: s, up };
	});
	const bestSem = semList.reduce<Sem | null>((a, s) => (!a || s.gwa < a.gwa ? s : a), null);
	const worstSem = semList.reduce<Sem | null>((a, s) => (!a || s.gwa > a.gwa ? s : a), null);

	return {
		gwa: units > 0 ? weighted / units : 0,
		passedUnits,
		distinct,
		numericKinds: Object.keys(distribution).length,
		fails,
		best: best as { code: string; grade: number } | null,
		worst: worst as { code: string; grade: number } | null,
		mostRetaken: mostRetaken as { code: string; count: number } | null,
		semCount: semList.length,
		semList,
		comeback: comeback as { sem: Sem; up: number } | null,
		bestSem,
		worstSem
	};
}

type Data = ReturnType<typeof wrappedData>;

function thisSemPanel(courses: Course[], d: Data, pick?: number): Panel | null {
	if (!d.semList.length) return null;
	const n = Math.min(pick ?? d.semList.length, d.semList.length - 1) + 1;
	const sem = d.semList[n - 1];
	const taken = courses.filter((c) => c.termLabel === sem.name);
	const scholar = scholarHolds(courses).has(taken[0].termKey) ? null : scholarFor(groupGWA(taken));
	const g = sem.gwa;
	const title =
		scholar ? scholar
		: g <= 1.75 ? 'Uno-heavy sem'
		: g <= 2.0 ? 'Solid sem'
		: g <= 2.5 ? 'Steady sem'
		: g <= 3.0 ? 'Survived the sem'
		: 'Bawi next sem';
	return {
		emoji: '🍓',
		title,
		value: g.toFixed(4),
		subtitle: sem.name,
		message: '',
		units: taken.filter((c) => !isPrefixExcluded(c.code)).reduce((u, c) => u + (c.units || 0), 0),
		frame: 'sem'
	};
}

function gwaPanel(d: Data): Panel {
	const g = d.gwa;
	const pick = (): [string, string, string] => {
		if (g === 0) return ['📚', 'No grades yet', 'Freshie ka ba? Or di pa nag-uupload ng grades si registrar. Either way, good luck this sem.'];
		if (g <= 1.2) return ['🏆', 'Summa material', "Grabe naman 'to. Penge tips naman. Seryoso, pano mo nagagawa 'yan habang may social life?"];
		if (g <= 1.45) return ['⭐', 'Magna tingz', 'Consistent high grades. Ikaw yung type na maayos notes tapos hinahanap ka ng groupmates pag may exam.'];
		if (g <= 1.75) return ['🎯', 'Cum laude szn', 'Solid GWA. Di ka nag-slack off pero di rin naman nagpaka-robot. Balance talaga.'];
		if (g <= 2.0) return ['🌟', 'Honor roll', 'Pasok sa honors. May hirap-hirap pero kinaya mo naman. Proud of u.'];
		if (g <= 2.5) return ['💪', 'Pasang-alam', 'Passing is passing. May mga sem na mabigat talaga, wag ka maguilty. Nasa UP ka pa rin.'];
		if (g <= 3.0) return ['🎮', 'Survival mode', 'Nandito ka pa, that counts. Minsan ganyan talaga UP. Basta graduate, panalo.'];
		return ['🌱', 'Comeback arc', "Mababa man ngayon, pwede pa 'yan i-improve. Marami nang naka-recover from this. Kaya mo 'yan."];
	};
	const [emoji, title, message] = pick();
	return { emoji, title, value: g > 0 ? g.toFixed(4) : '--', subtitle: 'My Elbi GWA', message, frame: g > 0 ? 'id' : undefined };
}

function semesterPanel(d: Data): Panel {
	if (!d.semCount || !d.bestSem) {
		return { emoji: '📅', title: 'Sem stats', value: '--', subtitle: 'No sem has grades yet', message: 'Check back once grades are in.' };
	}
	const b = d.bestSem;
	const highlights: Highlight[] = [{ label: '🏆 Best sem', name: b.name, detail: `GWA ${b.gwa.toFixed(4)}` }];
	const t = d.worstSem;
	const up = d.comeback;
	if (up && up.sem.name !== b.name) highlights.push({ label: '📈 Comeback sem', name: up.sem.name, detail: `GWA ${up.sem.gwa.toFixed(4)}. Up ${up.up.toFixed(2)} from the sem before` });
	else if (t && t.name !== b.name) {
		highlights.push({ label: '📈 Toughest sem', name: t.name, detail: `GWA ${t.gwa.toFixed(4)}` });
	}
	const n = d.semCount;
	const message =
		n >= 8 ? `${n} sems done. Almost there.`
		: n >= 6 ? `${n} sems done. The end is in sight.`
		: n >= 4 ? `${n} sems in. You're halfway through.`
		: n >= 2 ? `${n} sems down, many more to go.`
		: 'Just getting started. Enjoy the ride.';
	return { emoji: '📅', title: 'Sem stats', value: String(n), subtitle: n === 1 ? 'sem with grades' : 'sems with grades', message, highlights, caption: 'My best and toughest sem', frame: 'tin', sems: d.semList.map((s) => s.gwa) };
}

function collectorPanel(d: Data): Panel {
	const total = d.distinct.size;
	const [emoji, title, message] =
		total >= 10 ? ['🎰', 'Full collection', "You've seen it all, from 1.00 to 5.00, plus S, U, INC, DRP. Your transcript tells a story."]
		: total >= 7 ? ['🃏', 'Variety pack', "A bit of everything. Shows you've taken different kinds of courses with different outcomes."]
		: total >= 4 ? ['🎲', 'Mixed bag', 'Some ups, some downs. Pretty normal for most students tbh.']
		: d.numericKinds === 1 && d.gwa <= 1.5 ? ['🎯', 'One-track mind', "Same high grade over and over? That's rare consistency. How."]
		: ['📊', 'Steady grades', "You stick to a range. Predictable in a good way. You know what you're doing."];
	const badges = Array.from(d.distinct)
		.filter(Boolean)
		.sort()
		.map((text) => ({ text, special: NON_NUMERIC_GRADES.includes(text) }));
	const f = d.fails;
	const extra = f === 0 ? 'Zero 5.00s' : f === 1 ? 'One 5.00' : `${f} 5.00s`;
	return { emoji, title, value: String(total), subtitle: total === 1 ? 'kind of grade' : 'kinds of grades', message, badges, extra, frame: total ? 'note' : undefined };
}

function highlightsPanel(d: Data): Panel {
	const highlights: Highlight[] = [];
	if (d.best) highlights.push({ label: '🏆 Best grade', name: d.best.code, detail: `Grade ${d.best.grade.toFixed(2)}` });
	if (d.worst) highlights.push({ label: '📈 Lowest grade', name: d.worst.code, detail: `Grade ${d.worst.grade.toFixed(2)}` });
	if (d.mostRetaken) highlights.push({ label: '🔄 Most retaken', name: d.mostRetaken.code, detail: `Taken ${d.mostRetaken.count} times` });
	return {
		emoji: '🫴',
		title: 'Your highlights',
		value: '',
		subtitle: highlights.length ? undefined : 'Pass a course to see your highlights.',
		message: 'Every course counts toward the diploma.',
		highlights,
		caption: 'My lowest and highest grade',
		extra: `${d.passedUnits} units passed`,
		frame: d.best ? 'tray' : undefined
	};
}

function progressPanel(d: Data, totalRequired: number): Panel {
	const done = d.passedUnits;
	const left = Math.max(0, totalRequired - done);
	const pct = Math.min(100, Math.round((done / totalRequired) * 100));
	const [emoji, title, message] =
		pct >= 100 ? ['🎓', 'Graduation ready', 'All units done. Time to march. Congratulations. You made it.']
		: pct >= 80 ? ['🚀', 'Almost there', `${left} units left. The finish line is in sight. Last push na 'to.`]
		: pct >= 60 ? ['⚡', 'Past halfway', `${left} units to go. More than half done. You've got momentum.`]
		: pct >= 40 ? ['🌤️', 'Making progress', `${left} units remaining. Take it one sem at a time.`]
		: pct >= 20 ? ['🌅', 'Early days', `${left} units ahead of you. Plenty of time to figure things out.`]
		: ['🌱', 'Just starting', `${left} units to complete. Plenty of terms ahead, so pace yourself.`];
	return { emoji, title, value: `${pct}%`, subtitle: `${done} of ${totalRequired} units passed`, message, progress: pct / 100, extra: left ? `${left} units to go` : 'All units done', frame: done ? 'open' : undefined };
}

/** pick is the index of the sem card's sem in wrappedData().semList, the latest by default. */
export function wrappedPanels(courses: Course[], totalRequired = 155, pick?: number): Panel[] {
	const d = wrappedData(courses);
	const sem = thisSemPanel(courses, d, pick);
	return [...(sem ? [sem] : []), gwaPanel(d), semesterPanel(d), highlightsPanel(d), collectorPanel(d), progressPanel(d, totalRequired)];
}

/* ---------- Shareable card ---------- */

/**
 * Paint a panel as a 1080 by 1920 story card in the UPLB Tools colors.
 * The extension drew a transparent overlay; the web app makes a full card so it
 * reads on its own when shared.
 */
export interface IdCard {
	name: string;
	year: string;
	course: string;
	/** How much of the GWA to show. */
	show?: GwaShow;
	/** When the grades were read from AMIS, unedited. Empty when they weren't. */
	amis?: string;
	/** Leave a spot for a photo the student adds in Instagram or Facebook. */
	photo?: boolean;
}

export type GwaShow = 'none' | 'xx' | 'bx' | 'xc' | 'bc' | 'full';

/** A GWA written the way students post it, like 1.xx or 1.8x. Two decimals are cut, not rounded. */
export function shownGwa(value: string, show: GwaShow = 'none'): string {
	const [a, d = ''] = value.split('.');
	if (show === 'none' || !d) return '';
	if (show === 'full') return value;
	const [b, c] = d;
	return `${a}.${{ xx: 'xx', bx: `${b}x`, xc: `x${c}`, bc: `${b}${c}` }[show]}`;
}

/** A highlight label without its leading emoji. */
export const bare = (label: string) => label.replace(/^\P{L}+/u, '');

export async function drawCard(canvas: HTMLCanvasElement, p: Panel, id: IdCard): Promise<void> {
	const W = 1080;
	const H = 1920;
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	try {
		await Promise.all([document.fonts.load('800 96px Figtree'), document.fonts.load('500 40px Figtree')]);
	} catch {
		/* system fonts are fine */
	}
	const display = 'Figtree, system-ui, sans-serif';
	const body = display;
	if (p.frame) return drawFrame(ctx, p, display, id);

	ctx.fillStyle = '#7b1113';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = 'rgba(255,255,255,0.06)';
	ctx.beginPath();
	ctx.arc(W - 120, 260, 420, 0, Math.PI * 2);
	ctx.fill();

	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	const cx = W / 2;
	const wrap = (text: string, max: number) => {
		const lines: string[] = [];
		let line = '';
		text.split(' ').forEach((w) => {
			const test = line ? `${line} ${w}` : w;
			if (ctx.measureText(test).width > max && line) {
				lines.push(line);
				line = w;
			} else line = test;
		});
		if (line) lines.push(line);
		return lines;
	};

	// Brand row: plumbob and wordmark.
	ctx.fillStyle = '#2a8f55';
	ctx.beginPath();
	ctx.moveTo(cx - 250, 150);
	ctx.lineTo(cx - 280, 195);
	ctx.lineTo(cx - 250, 265);
	ctx.lineTo(cx - 220, 195);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'left';
	ctx.font = `800 56px ${display}`;
	ctx.fillText('Elbi GradeSim', cx - 190, 225);
	ctx.textAlign = 'center';

	let y = 520;
	ctx.font = `120px ${body}`;
	ctx.fillText(p.emoji, cx, y);
	y += 130;
	ctx.font = `800 64px ${display}`;
	ctx.fillStyle = '#f3c9c1';
	ctx.fillText(p.title, cx, y);
	y += 40;
	if (p.value) {
		y += 170;
		ctx.font = `800 ${p.value.length > 5 ? 180 : 220}px ${display}`;
		ctx.fillStyle = '#ffffff';
		ctx.fillText(p.value, cx, y);
	}
	if (p.subtitle) {
		y += 80;
		ctx.font = `500 44px ${body}`;
		ctx.fillStyle = '#f6e6e3';
		wrap(p.subtitle, W - 200).forEach((l) => {
			ctx.fillText(l, cx, y);
			y += 56;
		});
	}
	if (p.badges?.length) {
		y += 40;
		ctx.font = `700 38px ${body}`;
		const bw = 140;
		const per = 6;
		for (let i = 0; i < p.badges.length; i += per) {
			const row = p.badges.slice(i, i + per);
			let x = cx - (row.length * (bw + 16) - 16) / 2;
			row.forEach((b) => {
				ctx.fillStyle = b.special ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)';
				ctx.beginPath();
				ctx.roundRect(x, y, bw, 72, 36);
				ctx.fill();
				ctx.fillStyle = '#ffffff';
				ctx.fillText(b.text, x + bw / 2, y + 50);
				x += bw + 16;
			});
			y += 90;
		}
	}
	if (p.highlights?.length) {
		y += 40;
		p.highlights.forEach((h) => {
			ctx.fillStyle = 'rgba(255,255,255,0.12)';
			ctx.beginPath();
			ctx.roundRect(140, y, W - 280, 190, 32);
			ctx.fill();
			ctx.fillStyle = '#f3c9c1';
			ctx.font = `600 34px ${body}`;
			ctx.fillText(h.label, cx, y + 54);
			ctx.fillStyle = '#ffffff';
			ctx.font = `800 52px ${display}`;
			ctx.fillText(h.name, cx, y + 116);
			ctx.font = `500 34px ${body}`;
			ctx.fillText(h.detail, cx, y + 164);
			y += 220;
		});
	}
	y = Math.max(y + 60, H - 420);
	ctx.font = `500 42px ${body}`;
	ctx.fillStyle = '#ffffff';
	wrap(p.message, W - 240).forEach((l) => {
		ctx.fillText(l, cx, y);
		y += 58;
	});
	ctx.font = `600 36px ${body}`;
	ctx.fillStyle = '#f3c9c1';
	ctx.fillText('gradesim.uplb.tools', cx, H - 110);
}


const CREDIT = 'Design by Reann Vargas and Danica Manadong';
/** Reann Vargas's pages. Each tin, tray and note is tilted, so text is drawn turned with it. */
const FRAMES = { sem: 'tin-stats', id: 'tin-id', tin: 'tin', note: 'tin', tray: 'tray', open: 'tin-red' };
const INK = '#1c1917';
const SOFT = '#4a3f3c';
const RED = '#7b1113';

async function drawFrame(ctx: CanvasRenderingContext2D, p: Panel, font: string, id: IdCard) {
	const img = new Image();
	img.src = `/frames/${FRAMES[p.frame!]}.jpg`;
	await img.decode();
	ctx.drawImage(img, 0, 0, 1080, 1920);
	ctx.textAlign = 'center';
	const at = (x: number, y: number, turn: number, draw: () => void) => {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(turn);
		draw();
		ctx.restore();
	};
	const text = (t: string, weight: number, size: number, color: string, y: number, max = 1080, x = 0) => {
		do ctx.font = `${weight} ${size}px ${font}`;
		while (ctx.measureText(t).width > max && --size > 24);
		ctx.fillStyle = color;
		ctx.fillText(t, x, y, max);
	};
	const shadow = (blur: number) => {
		ctx.shadowColor = 'rgba(0,0,0,0.35)';
		ctx.shadowBlur = blur;
		ctx.shadowOffsetY = blur / 3;
	};
	// A cream label on the picnic cloth or grass.
	const tag = (t: string, size: number, x: number, y: number, turn: number) =>
		at(x, y, turn, () => {
			ctx.font = `800 ${size}px ${font}`;
			const w = ctx.measureText(t).width + size * 1.4;
			ctx.save();
			shadow(16);
			ctx.fillStyle = '#fbf5ea';
			ctx.beginPath();
			ctx.roundRect(-w / 2, -size * 0.95, w, size * 1.5, 10);
			ctx.fill();
			ctx.restore();
			text(t, 800, size, INK, size * 0.18);
		});
	const star = (x: number, y: number, r: number, turn: number) =>
		at(x, y, turn, () => {
			ctx.fillStyle = '#f2c230';
			ctx.beginPath();
			for (let i = 0; i < 10; i++) {
				const a = (Math.PI / 5) * i - Math.PI / 2;
				const d = i % 2 ? r * 0.45 : r;
				ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
			}
			ctx.fill();
		});
	const photo = new Image();
	if (id.photo && p.frame !== 'id' && p.frame !== 'sem') {
		photo.src = '/frames/photo.jpg';
		await photo.decode();
	}
	// A polaroid with Reann's picture placeholder, for a photo added in Instagram.
	const polaroid = (x: number, y: number, w: number, turn: number) =>
		at(x, y, turn, () => {
			const h = w * 1.07;
			ctx.save();
			shadow(24);
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(-w / 2 - 16, -h / 2 - 16, w + 32, h + 70);
			ctx.restore();
			ctx.drawImage(photo, -w / 2, -h / 2, w, h);
		});
	const url = 'gradesim.uplb.tools';
	const g = shownGwa(p.value, id.show);

	if (id.amis) {
		const label = `From AMIS, ${id.amis}`;
		ctx.font = `700 34px ${font}`;
		const w = ctx.measureText(label).width + 100;
		ctx.fillStyle = 'rgba(28,25,23,0.88)';
		ctx.beginPath();
		ctx.roundRect(60, 262, w, 68, 34);
		ctx.fill();
		ctx.fillStyle = '#2a8f55';
		ctx.beginPath();
		ctx.arc(100, 296, 20, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 6;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(90, 297);
		ctx.lineTo(98, 305);
		ctx.lineTo(111, 287);
		ctx.stroke();
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'left';
		ctx.fillText(label, 132, 308);
		ctx.textAlign = 'center';
	}

	ctx.font = `600 28px ${font}`;
	const cw = ctx.measureText(CREDIT).width + 48;
	ctx.fillStyle = 'rgba(28,25,23,0.82)';
	ctx.beginPath();
	const cy = p.frame === 'sem' ? 1646 : 1526;
	ctx.roundRect(540 - cw / 2, cy, cw, 50, 25);
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.fillText(CREDIT, 540, cy + 35);

	if (id.photo && (p.frame === 'tin' || p.frame === 'note')) polaroid(722, 455, 220, 0.12);
	if (id.photo && (p.frame === 'tray' || p.frame === 'open')) polaroid(842, 420, 230, 0.1);

	// Reann's SEM STATS page. The strips and boxes are tilted, so each value turns with its line.
	if (p.frame === 'sem') {
		const [term, ay] = (p.subtitle ?? '').split(' AY ');
		ctx.textAlign = 'left';
		(
			[
				[id.name, 540, 615, 300],
				[ay ? `${term} ${ay}` : term, 552, 716, 290],
				[id.course, 602, 796, 250]
			] as const
		).forEach(([t, x, y, max]) => at(x, y, -0.1, () => text(t, 700, 40, INK, 0, max)));
		ctx.textAlign = 'center';
		at(414, 1274, -0.19, () => text(String(p.units ?? ''), 800, 40, INK, 0, 220));
		at(515, 1404, -0.19, () => text(p.title, 800, 40, /Scholar$/.test(p.title) ? RED : INK, 0, 250));
		at(817, 1320, -0.1, () => {
			if (!g) return star(0, -20, 35, 0);
			text(g, 800, 64, RED, 0, 210);
		});
		return;
	}

	if (p.frame === 'id') {
		ctx.textAlign = 'left';
		const rows: [string, number, number, number][] = [
			[id.name, 556, 638, 285],
			[id.year, 566, 738, 295],
			[id.course, 612, 830, 268]
		];
		rows.forEach(([t, x, y, max]) => at(x, y, -0.19, () => text(t, 700, 40, INK, 0, max)));
		ctx.textAlign = 'center';
		at(592, 1215, -0.19, () => {
			if (g) {
				text(g, 800, 190, RED, 0);
				text(p.title, 800, 64, INK, 95);
			} else {
				text(p.title, 800, 120, RED, 20, 700);
				text('My Elbi GWA tier', 700, 44, INK, 95);
			}
			text(`Make yours on ${url}`, 600, 36, SOFT, 160);
		});
		return;
	}

	if (p.frame === 'tin') {
		at(500, 690, -0.17, () => {
			text(`${p.value} ${p.value === '1' ? 'sem' : 'sems'} done`, 800, 68, INK, -110, id.photo ? 300 : 380, id.photo ? -170 : -120);
			const g = p.sems ?? [];
			if (g.length > 1) {
				const x = (i: number) => -280 + (560 * i) / (g.length - 1);
				const y = (v: number) => -40 + ((Math.min(3, Math.max(1, v)) - 1) / 2) * 150;
				ctx.strokeStyle = RED;
				ctx.lineWidth = 8;
				ctx.lineJoin = 'round';
				ctx.beginPath();
				g.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
				ctx.stroke();
				ctx.fillStyle = RED;
				g.forEach((v, i) => {
					ctx.beginPath();
					ctx.arc(x(i), y(v), 13, 0, Math.PI * 2);
					ctx.fill();
				});
			}
		});
		const rows = p.highlights ?? [];
		at(596, 1225, -0.17, () => text(url, 600, 32, SOFT, 222));
		rows.forEach((h, i) =>
			at(596, 1225, -0.17, () => {
				const y = rows.length > 1 ? i * 195 - 180 : -40;
				text(bare(h.label), 600, 38, SOFT, y);
				text(h.name, 800, 62, INK, y + 72, 700);
				text(h.detail, 700, 40, RED, y + 130, 700);
			})
		);
		return;
	}

	if (p.frame === 'note') {
		const badges = (p.badges ?? []).slice(0, 12);
		at(340, 778, -0.17, () => {
			badges.forEach((b, i) => {
				const cx = ((i % 3) - 1) * 132;
				const cy = (Math.floor(i / 3) - (Math.ceil(badges.length / 3) - 1) / 2) * 88;
				ctx.fillStyle = b.special ? INK : RED;
				ctx.beginPath();
				ctx.roundRect(cx - 58, cy - 32, 116, 64, 32);
				ctx.fill();
				text(b.text, 800, 34, '#ffffff', cy + 12, 100, cx);
			});
		});
		at(770, id.photo ? 770 : 700, -0.17, () => {
			text(p.value, 800, id.photo ? 130 : 160, RED, 40, 300);
			text(p.subtitle ?? '', 700, 38, INK, 100, 300);
		});
		at(590, 1215, -0.18, () => {
			text('My grade collection', 600, 38, SOFT, -130);
			text(p.title, 800, 84, INK, -40, 700);
			text(p.extra ?? '', 700, 46, RED, 40, 700);
			text(url, 600, 36, SOFT, 140);
		});
		return;
	}

	if (p.frame === 'tray') {
		const [best, low, kept] = p.highlights ?? [];
		tag('My highlights', 64, 430, 520, -0.1);
		at(375, 1070, -0.1, () => {
			text(bare(best.label), 600, 36, SOFT, -170, 330);
			text(best.name, 800, 80, INK, -80, 330);
			text(best.detail.replace('Grade ', ''), 800, 150, RED, 90, 330);
		});
		const corner = (x: number, y: number, h: Highlight | undefined, fallback: [string, string, string]) =>
			at(x, y, -0.1, () => {
				const [label, name, detail] = h ? [bare(h.label), h.name, h.detail] : fallback;
				text(label, 600, 32, SOFT, -55, 300);
				text(name, 800, 54, INK, 10, 300);
				text(detail, 700, 34, RED, 60, 300);
			});
		corner(838, 805, low, ['', '', '']);
		corner(860, 1185, kept, ['So far', p.extra ?? '', '']);
		tag(url, 36, 540, 1478, -0.05);
		return;
	}

	at(488, 700, -0.19, () => {
		text(p.title, 800, 64, INK, -140, 700);
		text(p.value, 800, 200, RED, 50, 700);
		text(p.subtitle ?? '', 700, 42, INK, 130, 700);
	});
	at(585, 1225, -0.2, () => {
		const w = 640;
		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.beginPath();
		ctx.roundRect(-w / 2, -120, w, 48, 24);
		ctx.fill();
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.roundRect(-w / 2, -120, Math.max(48, w * (p.progress ?? 0)), 48, 24);
		ctx.fill();
		ctx.save();
		ctx.shadowColor = 'rgba(0,0,0,0.5)';
		ctx.shadowBlur = 10;
		text(p.extra ?? '', 800, 64, '#ffffff', 10, 700);
		text(url, 600, 36, '#ffffff', 110);
		ctx.restore();
	});
}
