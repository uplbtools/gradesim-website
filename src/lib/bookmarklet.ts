// Opens GradeSim with the grades packed into the link (see link.ts). An older
// browser saves them as a file instead.
const code = `(async () => {
	if (location.hostname !== 'amis.uplb.edu.ph') return alert('Open AMIS, log in, then tap this bookmark there.');
	const token = localStorage.getItem('auth._token.local');
	if (!token || token === 'false') return alert('Log in to AMIS first, then tap this bookmark again.');
	const headers = { Accept: 'application/json', Authorization: token.startsWith('Bearer ') ? token : 'Bearer ' + token };
	const session = localStorage.getItem('x-session-id');
	if (session) headers['X-Session-Id'] = session;
	const res = await fetch('https://api-amis.uplb.edu.ph/api/students/grades?summarize=true', { credentials: 'include', headers }).catch(() => null);
	const data = res && res.ok ? await res.json() : null;
	if (!data || !data.student_grades) return alert("AMIS didn't send your grades. Log in again and retry.");
	const terms = {};
	for (const [id, t] of Object.entries(data.student_grades)) {
		if (!t || !Array.isArray(t.values)) continue;
		terms[id] = {
			term: t.term,
			values: t.values.map((v) => ({
				id: v.id, grade: v.grade, unit_taken: v.unit_taken, section: v.section, status: v.status,
				course: { course_code: v.course?.course_code, title: v.course?.title },
				grade_term: { term: v.grade_term?.term, ay: v.grade_term?.ay }
			}))
		};
	}
	const file = JSON.stringify({ source: 'elbi-gradesim', timestamp: new Date().toISOString(), gradesData: { student_grades: terms } });
	try {
		const packed = await new Response(new Blob([file]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
		let bin = '';
		new Uint8Array(packed).forEach((b) => (bin += String.fromCharCode(b)));
		location.href = 'https://gradesim.uplb.tools/#d=' + btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
		return;
	} catch (e) {}
	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
	a.download = 'gradesim-amis.json';
	document.body.append(a);
	a.click();
	a.remove();
	if (confirm('Saved gradesim-amis.json. Open GradeSim to import it?')) location.href = 'https://gradesim.uplb.tools/';
})();`;

export const BOOKMARKLET = 'javascript:' + encodeURIComponent(code.replace(/\s*\n\s*/g, ' '));
