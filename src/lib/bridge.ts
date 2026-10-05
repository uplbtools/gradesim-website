// Ask the GradeSim extension for the grades it captured from AMIS. Nothing
// leaves the device: the extension answers this page directly.
//
// Chrome, Edge, Opera and Brave: the extension lists this site under
// externally_connectable, so the page can message it by extension id.
// Firefox has no externally_connectable for web pages, so the extension runs a
// small content script on this site that answers window.postMessage requests.
//
// Two requests: GRADESIM_PING only says whether grades exist (sent on load to
// pick the right button), GRADESIM_GET_GRADES hands them over and is only sent
// when the student clicks Import.

/** Store ids. Opera and Brave install from the Chrome Web Store, so they share its id. */
export const EXTENSION_IDS = [
	'mlhklblbhkikcmobmmajckjcbmdinldb', // Chrome Web Store
	'ebiakebpglddgmkdehdjiadnjgkmgnga' // Edge Add-ons
];

type Request = 'GRADESIM_PING' | 'GRADESIM_GET_GRADES';
const REPLY = 'GRADESIM_REPLY';

interface ChromeRuntime {
	sendMessage: (id: string, msg: unknown, cb: (reply: unknown) => void) => void;
	lastError?: unknown;
}

function viaRuntime(id: string, type: Request, timeout: number): Promise<unknown> {
	const rt = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
	if (!rt?.sendMessage) return Promise.resolve(null);
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), timeout);
		try {
			rt.sendMessage(id, { type }, (reply) => {
				clearTimeout(timer);
				void rt.lastError; // read it so Chrome does not log "unchecked lastError"
				resolve(reply ?? null);
			});
		} catch {
			clearTimeout(timer);
			resolve(null);
		}
	});
}

function viaWindow(type: Request, timeout: number): Promise<unknown> {
	return new Promise((resolve) => {
		const onMessage = (e: MessageEvent) => {
			if (e.source !== window || e.origin !== location.origin) return;
			if (e.data?.type !== REPLY || e.data.request !== type) return;
			cleanup();
			resolve(e.data.payload ?? null);
		};
		const cleanup = () => {
			clearTimeout(timer);
			window.removeEventListener('message', onMessage);
		};
		const timer = setTimeout(() => {
			cleanup();
			resolve(null);
		}, timeout);
		window.addEventListener('message', onMessage);
		window.postMessage({ type }, location.origin);
	});
}

async function ask(type: Request, timeout: number): Promise<unknown> {
	if (typeof window === 'undefined') return null;
	const replies = await Promise.all([...EXTENSION_IDS.map((id) => viaRuntime(id, type, timeout)), viaWindow(type, timeout)]);
	return replies.find((r) => r != null) ?? null;
}

/** 'found' when the extension has grades, 'empty' when it is installed without any, null when nothing answered. */
export async function probeExtension(timeout = 800): Promise<'found' | 'empty' | null> {
	const r = (await ask('GRADESIM_PING', timeout)) as { hasGrades?: boolean } | null;
	if (!r) return null;
	return r.hasGrades ? 'found' : 'empty';
}

/** The extension's grades in the same shape as its JSON backup, or null. */
export function getExtensionGrades(timeout = 3000): Promise<unknown> {
	return ask('GRADESIM_GET_GRADES', timeout);
}
