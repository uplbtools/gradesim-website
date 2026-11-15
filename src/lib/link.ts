// A backup or a plan packed into a link's fragment, which a browser never
// sends to a server. The phone bookmark writes the same format.

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
	return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function packLink(data: unknown, base: string): Promise<string> {
	const bytes = await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream('deflate-raw'));
	let bin = '';
	bytes.forEach((b) => (bin += String.fromCharCode(b)));
	return `${base}#d=${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

/** The JSON text in a location hash. Null when the hash isn't a data link, and it throws on a damaged one. */
export async function unpackHash(hash: string): Promise<string | null> {
	if (!hash.startsWith('#d=')) return null;
	const bin = atob(hash.slice(3).replace(/-/g, '+').replace(/_/g, '/'));
	return new TextDecoder().decode(await pipe(Uint8Array.from(bin, (c) => c.charCodeAt(0)), new DecompressionStream('deflate-raw')));
}
