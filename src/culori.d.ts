// culori v4 ships no TypeScript declarations
declare module 'culori' {
	export interface Color {
		mode: string;
		r?: number;
		g?: number;
		b?: number;
		alpha?: number;
		[channel: string]: unknown;
	}

	export function parse(color: string): Color | undefined;
	export function formatHex(color: Color | string): string;
	export function formatHex8(color: Color | string): string;
}
