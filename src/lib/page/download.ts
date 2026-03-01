import type { GenerateResponse } from '$lib/types.js';

export async function downloadZip(
	files: GenerateResponse['files'],
	toast: { success: (msg: string) => void }
): Promise<void> {
	if (!files?.length) return;
	const { zipSync, strToU8 } = await import('fflate');
	const zipped = zipSync(
		Object.fromEntries(files.map((f) => [`${f.platform}/${f.filename}`, strToU8(f.content)]))
	);
	const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `tokensmith-${new Date().toISOString().slice(0, 10)}.zip`;
	a.click();
	URL.revokeObjectURL(url);
	toast.success('ZIP downloaded');
}

export async function copyToClipboard(
	content: string,
	toast: { success: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
	try {
		await navigator.clipboard.writeText(content);
		toast.success('Copied to clipboard');
	} catch {
		toast.error('Copy failed');
	}
}
