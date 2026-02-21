<script lang="ts">
	interface DiffRegion {
		line: number;
		type: 'add' | 'remove';
	}

	interface Props {
		content: string;
		totalLines: number;
		scrollTop: number;
		scrollHeight: number;
		clientHeight: number;
		diffRegions?: DiffRegion[];
		searchMatchLines?: number[];
		onSeek: (fraction: number) => void;
	}

	let {
		content,
		totalLines,
		scrollTop,
		scrollHeight,
		clientHeight,
		diffRegions = [],
		searchMatchLines = [],
		onSeek
	}: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let container: HTMLDivElement | undefined = $state();
	const WIDTH = 60;

	function isComment(line: string): boolean {
		const t = line.trimStart();
		return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
	}

	function isKeyword(line: string): boolean {
		const t = line.trimStart();
		return /^(export|import|@use|@import|@property|:root|object|fun |val |var |let |const |public |private |internal )/.test(t);
	}

	function draw() {
		if (!canvas || !container) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const containerH = container.clientHeight;
		if (containerH <= 0) return;

		const canvasH = containerH;
		const dpr = devicePixelRatio;
		canvas.width = WIDTH * dpr;
		canvas.height = canvasH * dpr;
		canvas.style.width = `${WIDTH}px`;
		canvas.style.height = `${canvasH}px`;
		ctx.scale(dpr, dpr);

		ctx.clearRect(0, 0, WIDTH, canvasH);

		const lines = content.split('\n');
		const lineH = canvasH / Math.max(lines.length, 1);

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const y = i * lineH;
			const len = Math.min(line.length, 80);
			const w = (len / 80) * (WIDTH - 8);
			const h = Math.max(lineH, 0.5);

			if (isComment(line)) {
				ctx.fillStyle = 'rgba(87, 166, 74, 0.4)';
			} else if (isKeyword(line)) {
				ctx.fillStyle = 'rgba(86, 156, 214, 0.4)';
			} else if (line.trim().length === 0) {
				continue;
			} else {
				ctx.fillStyle = 'rgba(180, 180, 180, 0.2)';
			}
			ctx.fillRect(4, y, Math.max(w, 2), h);
		}

		for (const region of diffRegions) {
			const y = (region.line - 1) * lineH;
			ctx.fillStyle = region.type === 'add'
				? 'rgba(63, 185, 80, 0.6)'
				: 'rgba(248, 81, 73, 0.6)';
			ctx.fillRect(0, y, 3, Math.max(lineH, 1));
		}

		for (const matchLine of searchMatchLines) {
			const y = (matchLine - 1) * lineH;
			ctx.fillStyle = 'rgba(227, 179, 65, 0.8)';
			ctx.fillRect(WIDTH - 6, y, 5, Math.max(lineH, 1));
		}

		if (scrollHeight > 0 && clientHeight > 0) {
			const vpTop = (scrollTop / scrollHeight) * canvasH;
			const vpH = Math.max((clientHeight / scrollHeight) * canvasH, 14);
			ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
			ctx.fillRect(0, vpTop, WIDTH, vpH);
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
			ctx.lineWidth = 1;
			ctx.strokeRect(0.5, Math.round(vpTop) + 0.5, WIDTH - 1, Math.round(vpH) - 1);
		}
	}

	$effect(() => {
		content; totalLines; scrollTop; scrollHeight; clientHeight;
		diffRegions; searchMatchLines;
		draw();
	});

	function seekFromEvent(e: MouseEvent) {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const h = rect.height;
		if (h > 0) onSeek(Math.max(0, Math.min(1, y / h)));
	}

	let dragging = $state(false);

	function handlePointerDown(e: PointerEvent) {
		dragging = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		seekFromEvent(e);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		seekFromEvent(e);
	}

	function handlePointerUp() {
		dragging = false;
	}
</script>

<div
	class="minimap"
	bind:this={container}
	role="scrollbar"
	aria-label="Code minimap"
	aria-orientation="vertical"
	aria-controls="code-scroll-region"
	aria-valuenow={scrollTop}
	aria-valuemin={0}
	aria-valuemax={scrollHeight}
	tabindex="-1"
>
	<canvas
		bind:this={canvas}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
	></canvas>
</div>

<style>
	.minimap {
		width: 60px;
		flex-shrink: 0;
		overflow: hidden;
		border-left: 1px solid var(--borderColor-muted);
		background: color-mix(in srgb, var(--bgColor-default) 50%, transparent);
		cursor: pointer;
		user-select: none;
	}
	.minimap canvas {
		display: block;
	}
</style>
