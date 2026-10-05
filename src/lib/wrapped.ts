// Elbi GradeSim Wrapped, ported from the extension popup. The panels are data
// here; Wrapped.svelte shows them and drawCard() paints the shareable image.

import { isPrefixExcluded, NON_NUMERIC_GRADES, numericGrade, type Course } from './grades.ts';

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
}

interface Sem {
	name: string;
	gwa: number;
}

export function wrappedData(courses: Course[]) {
	const distinct = new Set<string>();
	const distribution: Record<string, number> = {};
	const retakes: Record<string, number> = {};
	const sems = new Map<string, { w: number; u: number }>();
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
		const s = sems.get(c.termLabel) || { w: 0, u: 0 };
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

	const semList: Sem[] = Array.from(sems, ([name, s]) => ({ name, gwa: s.w / s.u }));
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
		bestSem,
		worstSem
	};
}

type Data = ReturnType<typeof wrappedData>;

function gwaPanel(d: Data): Panel {
	const g = d.gwa;
	const pick = (): [string, string, string] => {
		if (g === 0) return ['📚', 'NO GRADES YET', 'Freshie ka ba? Or di pa nag-uupload ng grades si registrar. Either way, good luck sa journey mo!'];
		if (g <= 1.2) return ['🏆', 'SUMMA MATERIAL', "Grabe naman 'to?? Penge tips naman. Seryoso, pano mo nagagawa 'yan habang may social life??"];
		if (g <= 1.45) return ['⭐', 'MAGNA TINGZ', 'Consistent high grades! Ikaw yung type na maayos notes tapos hinahanap ka ng groupmates pag may exam.'];
		if (g <= 1.75) return ['🎯', 'CUM LAUDE SZN', 'Solid GWA! Di ka nag-slack off pero di rin naman nagpaka-robot. Balance talaga.'];
		if (g <= 2.0) return ['🌟', 'HONOR ROLL', 'Pasok sa honors! May hirap-hirap pero kinaya mo naman. Proud of u!'];
		if (g <= 2.5) return ['💪', 'PASANG-ALAM', 'Passing is passing! May mga sem na mabigat talaga, wag ka maguilty. Nasa UP ka pa rin.'];
		if (g <= 3.0) return ['🎮', 'SURVIVAL MODE', 'Nandito ka pa, that counts. Minsan ganyan talaga UP. Basta graduate, panalo.'];
		return ['🌱', 'COMEBACK ARC', "Mababa man ngayon, pwede pa 'yan i-improve. Marami nang naka-recover from this. Kaya mo 'yan."];
	};
	const [emoji, title, message] = pick();
	return { emoji, title, value: g > 0 ? g.toFixed(4) : '--', subtitle: 'My Elbi GWA', message };
}

function semesterPanel(d: Data): Panel {
	if (!d.semCount || !d.bestSem) {
		return { emoji: '📅', title: 'SEMESTER STATS', value: '--', subtitle: 'No semester data yet', message: 'Check back once grades are in!' };
	}
	const b = d.bestSem;
	const bestWord = b.gwa <= 1.25 ? 'Your peak' : b.gwa <= 1.5 ? 'Nice run!' : b.gwa <= 1.75 ? 'Solid sem' : b.gwa <= 2 ? 'Good one' : 'Best so far';
	const highlights: Highlight[] = [{ label: '🏆 Best Semester', name: b.name, detail: `GWA ${b.gwa.toFixed(4)}. ${bestWord}` }];
	const t = d.worstSem;
	if (t && t.name !== b.name) {
		const word = t.gwa >= 3 ? 'Rough one' : t.gwa >= 2.5 ? 'Challenging' : t.gwa >= 2 ? 'Tough load' : 'Room to grow';
		highlights.push({ label: '📈 Toughest Semester', name: t.name, detail: `GWA ${t.gwa.toFixed(4)}. ${word}` });
	}
	const n = d.semCount;
	const message =
		n >= 8 ? `${n} semesters completed. Almost there!`
		: n >= 6 ? `${n} sems done. The end is in sight.`
		: n >= 4 ? `${n} sems in. You're halfway through!`
		: n >= 2 ? `${n} semesters down, many more to go.`
		: 'Just getting started. Enjoy the ride!';
	return { emoji: '📅', title: 'SEMESTER STATS', value: String(n), subtitle: n === 1 ? 'semester with grades' : 'semesters with grades', message, highlights, caption: 'My lowest and highest semester' };
}

function collectorPanel(d: Data): Panel {
	const total = d.distinct.size;
	const [emoji, title, message] =
		total >= 10 ? ['🎰', 'FULL COLLECTION', "You've seen it all, from 1.0 to 5.0, plus S, U, INC, DRP. Your transcript tells a story."]
		: total >= 7 ? ['🃏', 'VARIETY PACK', "A bit of everything! Shows you've taken different kinds of subjects with different outcomes."]
		: total >= 4 ? ['🎲', 'MIXED BAG', 'Some ups, some downs. Pretty normal for most students tbh.']
		: d.numericKinds === 1 && d.gwa <= 1.5 ? ['🎯', 'ONE-TRACK MIND', "Same high grade over and over? That's rare consistency. How."]
		: ['📊', 'STEADY GRADES', "You stick to a range. Predictable in a good way. You know what you're doing."];
	const badges = Array.from(d.distinct)
		.filter(Boolean)
		.sort()
		.map((text) => ({ text, special: NON_NUMERIC_GRADES.includes(text) }));
	return { emoji, title, value: String(total), subtitle: 'distinct grades collected', message, badges };
}

function perseverancePanel(d: Data): Panel {
	const f = d.fails;
	const [emoji, title, message] =
		f === 0 ? ['🏅', 'CLEAN RECORD', "Zero 5.0s? That's actually impressive. Not everyone can say that."]
		: f === 1 ? ['💫', 'ONE SETBACK', "One 5.0 isn't the end of the world. It happens to plenty of us. Bounce back season."]
		: f <= 3 ? ['🔥', 'STILL STANDING', `${f} failed subjects but you're still here. Every retake is a chance to do better.`]
		: f <= 5 ? ['🦅', 'FIGHTING SPIRIT', `${f} times down but not out. The fact that you're still going says a lot.`]
		: ['💎', 'SURVIVOR', `${f} 5.0s and still pushing through? That takes real grit. Respect.`];
	return { emoji, title, value: String(f), subtitle: f === 1 ? 'subject to retake' : 'subjects to retake', message };
}

function highlightsPanel(d: Data): Panel {
	const highlights: Highlight[] = [];
	if (d.best) highlights.push({ label: '🏆 Best Performance', name: d.best.code, detail: `Grade ${d.best.grade.toFixed(2)}` });
	if (d.worst) highlights.push({ label: '📈 Room to Grow', name: d.worst.code, detail: `Grade ${d.worst.grade.toFixed(2)}` });
	if (d.mostRetaken) highlights.push({ label: '🔄 Persistence Award', name: d.mostRetaken.code, detail: `Taken ${d.mostRetaken.count} times. You didn't give up` });
	return {
		emoji: '🫴',
		title: 'YOUR HIGHLIGHTS',
		value: '',
		subtitle: highlights.length ? undefined : 'Complete some subjects to see your highlights!',
		message: 'Every subject is part of your journey',
		highlights,
		caption: 'My lowest and highest grade'
	};
}

function progressPanel(d: Data, totalRequired: number): Panel {
	const done = d.passedUnits;
	const left = Math.max(0, totalRequired - done);
	const pct = Math.min(100, Math.round((done / totalRequired) * 100));
	const [emoji, title, message] =
		pct >= 100 ? ['🎓', 'GRADUATION READY', 'All units done! Time to march. Congratulations. You made it.']
		: pct >= 80 ? ['🚀', 'ALMOST THERE', `${left} units left. The finish line is in sight. Last push na 'to.`]
		: pct >= 60 ? ['⚡', 'PAST HALFWAY', `${left} units to go. More than half done. You've got momentum.`]
		: pct >= 40 ? ['🌤️', 'MAKING PROGRESS', `${left} units remaining. Take it one sem at a time.`]
		: pct >= 20 ? ['🌅', 'EARLY DAYS', `${left} units ahead of you. Plenty of time to figure things out.`]
		: ['🌱', 'JUST STARTING', `${left} units to complete. Welcome to the journey. It's a marathon, not a sprint.`];
	return { emoji, title, value: `${pct}%`, subtitle: `${done} of ${totalRequired} units passed`, message };
}

export function wrappedPanels(courses: Course[], totalRequired = 155): Panel[] {
	const d = wrappedData(courses);
	return [gwaPanel(d), semesterPanel(d), collectorPanel(d), perseverancePanel(d), highlightsPanel(d), progressPanel(d, totalRequired)];
}

/* ---------- Shareable card ---------- */

/**
 * Paint a panel as a 1080 by 1920 story card in the UPLB Tools colors.
 * The extension drew a transparent overlay; the web app makes a full card so it
 * reads on its own when shared.
 */
export async function drawCard(canvas: HTMLCanvasElement, p: Panel): Promise<void> {
	const W = 1080;
	const H = 1920;
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	try {
		await Promise.all([document.fonts.load('800 96px Raleway'), document.fonts.load('500 40px Inter')]);
	} catch {
		/* system fonts are fine */
	}
	const display = 'Raleway, Inter, system-ui, sans-serif';
	const body = 'Inter, system-ui, sans-serif';

	ctx.fillStyle = '#7b2a22'; // hsl(5, 53%, 32%)
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
