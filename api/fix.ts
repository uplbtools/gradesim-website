// Vercel compiles this file without a bundler, so the import names the emitted .js file.
import { fixIssue, validateFix, type ChecklistFix } from '../src/lib/fix.js';

// Files a student's checklist fixes as one GitHub issue. Only the fixes arrive here, never grades.
export async function POST(request: Request): Promise<Response> {
	const token = process.env.GRADESIM_FIX_TOKEN;
	if (!token) return new Response('Not set up', { status: 503 });
	if (request.headers.get('origin') !== 'https://gradesim.uplb.tools') return new Response('Forbidden', { status: 403 });
	const raw = await request.text();
	if (raw.length > 4096) return new Response('Too large', { status: 413 });
	let data: { program?: unknown; fixes?: unknown };
	try {
		data = JSON.parse(raw);
	} catch {
		return new Response('Bad request', { status: 400 });
	}
	const program = String(data?.program ?? '');
	const fixes = Array.isArray(data?.fixes) ? data.fixes.slice(0, 20).map(validateFix) : [];
	if (!/^[A-Z]{2,10}$/.test(program) || !fixes.length || fixes.some((f) => typeof f === 'string')) {
		return new Response('Bad request', { status: 400 });
	}
	const res = await fetch('https://api.github.com/repos/uplbtools/gradesim/issues', {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'gradesim-website' },
		body: JSON.stringify(fixIssue(program, fixes as ChecklistFix[]))
	});
	if (!res.ok) return new Response('Could not file the issue', { status: 502 });
	return Response.json({ url: (await res.json()).html_url });
}
