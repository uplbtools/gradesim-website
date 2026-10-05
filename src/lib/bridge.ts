// Ask the GradeSim extension for the grades it captured from AMIS. Nothing
// leaves the device: the extension answers this page directly.
//
// Chrome, Edge, Opera and Brave: the extension lists this site under
// externally_connectable, so the page can message it by extension id.
// Firefox has no externally_connectable for web pages, so the extension runs a
// small content script on this site that answers window.postMessage requests.

/** Store ids. Opera and Brave install from the Chrome Web Store, so they share its id. */
export const EXTENSION_IDS = [
	'mlhklblbhkikcmobmmajckjcbmdinldb', // Chrome Web Store
	'ebiakebpglddgmkdehdjiadnjgkmgnga' // Edge Add-ons
];

const REQUEST = 'GRADESIM_GET_GRADES';
const REPLY = 'GRADESIM_GRADES';

interface ChromeRuntime {
	sendMessage: (id: string, msg: unknown, cb: (reply: unknown) => void) => void;
	lastError?: unknown;
}

function viaRuntime(id: string, timeout: number): Promise<unknown> {
	const rt = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
	if (!rt?.sendMessage) return Promise.resolve(null);
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), timeout);
		try {
			rt.sendMessage(id, { type: REQUEST }, (reply) => {
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

function viaWindow(timeout: number): Promise<unknown> {
	return new Promise((resolve) => {
		const onMessage = (e: MessageEvent) => {
			if (e.source !== window || e.origin !== location.origin) return;
			if (e.data?.type !== REPLY) return;
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
		window.postMessage({ type: REQUEST }, location.origin);
	});
}

/**
 * The extension's reply: the same shape as its JSON backup, or null when no
 * extension answered (not installed, or an older version without the bridge).
 */
export async function askExtension(timeout = 800): Promise<unknown> {
	if (typeof window === 'undefined') return null;
	const replies = await Promise.all([...EXTENSION_IDS.map((id) => viaRuntime(id, timeout)), viaWindow(timeout)]);
	return replies.find((r) => r != null) ?? null;
}
