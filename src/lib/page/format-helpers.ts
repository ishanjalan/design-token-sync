import type { Platform } from '$lib/types.js';

const PLATFORM_COLORS: Record<Platform, string> = {
	web: 'var(--fgColor-accent)',
	android: '#7F52FF',
	ios: '#F05138'
};

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}

export function langLabel(format: string): string {
	switch (format) {
		case 'scss': return 'SCSS';
		case 'typescript': return 'TypeScript';
		case 'swift': return 'Swift';
		case 'kotlin': return 'Kotlin';
		case 'css': return 'CSS';
		default: return format;
	}
}

export function platformColor(platform: Platform): string {
	return PLATFORM_COLORS[platform] ?? 'var(--fgColor-disabled)';
}

export function formatTime(d: Date): string {
	return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function timeAgo(d: Date): string {
	const secs = Math.floor((Date.now() - d.getTime()) / 1000);
	if (secs < 60) return `${secs}s ago`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
	return `${Math.floor(secs / 3600)}h ago`;
}
