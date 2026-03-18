<script lang="ts">
	import { Check, X, AlertTriangle } from 'lucide-svelte';
	import type { TokenCoverageRow } from '$lib/types.js';

	interface Props {
		coverage: TokenCoverageRow[];
	}

	let { coverage }: Props = $props();

	const visible = $derived(coverage.filter((r) => r.inTokens > 0 || r.willGenerate));
	let expanded = $state(false);
</script>

{#if visible.length > 0}
	<div class="coverage-bar">
		<button
			class="coverage-toggle"
			onclick={() => (expanded = !expanded)}
			aria-expanded={expanded}
		>
			<span class="coverage-label">Token coverage</span>
			<span class="coverage-pills">
				{#each visible as row}
					<span
						class="coverage-pill"
						class:coverage-pill--ok={row.willGenerate}
						class:coverage-pill--warn={row.inTokens > 0 && !row.willGenerate}
						class:coverage-pill--empty={row.inTokens === 0}
					>
						{row.type}
						<span class="coverage-pill-count">{row.inTokens}</span>
					</span>
				{/each}
			</span>
			<span class="coverage-chevron" class:coverage-chevron--open={expanded}>›</span>
		</button>

		{#if expanded}
			<div class="coverage-table-wrap">
				<table class="coverage-table">
					<thead>
						<tr>
							<th>Token Type</th>
							<th class="coverage-col-num">In Tokens</th>
							<th class="coverage-col-status">In Ref</th>
							<th class="coverage-col-status">Generated</th>
						</tr>
					</thead>
					<tbody>
						{#each visible as row}
							{@const warn = row.inTokens > 0 && !row.willGenerate}
							<tr class:coverage-row--warn={warn}>
								<td class="coverage-type">
									{#if warn}<AlertTriangle size={12} strokeWidth={2} />{/if}
									{row.type}
								</td>
								<td class="coverage-col-num">
									<span class="coverage-count">{row.inTokens}</span>
								</td>
								<td class="coverage-col-status">
									{#if row.inReference}
										<span class="coverage-icon coverage-icon--ok"><Check size={13} strokeWidth={2.5} /></span>
									{:else}
										<span class="coverage-icon coverage-icon--no"><X size={13} strokeWidth={2.5} /></span>
									{/if}
								</td>
								<td class="coverage-col-status">
									{#if row.willGenerate}
										<span class="coverage-icon coverage-icon--ok"><Check size={13} strokeWidth={2.5} /></span>
									{:else}
										<span class="coverage-icon coverage-icon--no"><X size={13} strokeWidth={2.5} /></span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}

<style>
	.coverage-bar {
		border-bottom: 1px solid var(--borderColor-muted);
		background: var(--bgColor-inset);
	}

	.coverage-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px;
		border: none;
		background: none;
		cursor: pointer;
		font-family: var(--font-display);
		color: var(--fgColor-muted);
		transition: background var(--transition-fast);
	}
	.coverage-toggle:hover {
		background: var(--control-bgColor-hover);
	}

	.coverage-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--fgColor-disabled);
		white-space: nowrap;
	}

	.coverage-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		flex: 1;
	}

	.coverage-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: 100px;
		font-size: 11px;
		font-weight: 500;
		font-family: var(--font-display);
		line-height: 1.4;
	}
	.coverage-pill--ok {
		background: color-mix(in srgb, var(--fgColor-success) 12%, transparent);
		color: var(--fgColor-success);
	}
	.coverage-pill--warn {
		background: color-mix(in srgb, var(--fgColor-attention) 12%, transparent);
		color: var(--fgColor-attention);
	}
	.coverage-pill--empty {
		background: var(--control-bgColor-rest);
		color: var(--fgColor-disabled);
	}
	.coverage-pill-count {
		font-family: var(--font-code);
		font-size: 10px;
		opacity: 0.7;
	}

	.coverage-chevron {
		font-size: 14px;
		font-weight: 600;
		transition: transform var(--transition-fast);
		color: var(--fgColor-disabled);
	}
	.coverage-chevron--open {
		transform: rotate(90deg);
	}

	.coverage-table-wrap {
		padding: 0 16px 12px;
	}
	.coverage-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-display);
		font-size: 12px;
	}
	.coverage-table th {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fgColor-disabled);
		text-align: left;
		padding: 4px 8px 6px;
		border-bottom: 1px solid var(--borderColor-muted);
	}
	.coverage-table td {
		padding: 5px 8px;
		border-bottom: 1px solid color-mix(in srgb, var(--borderColor-muted) 50%, transparent);
	}
	.coverage-table tbody tr:last-child td {
		border-bottom: none;
	}

	.coverage-col-num {
		text-align: right;
		width: 80px;
	}
	.coverage-col-status {
		text-align: center;
		width: 80px;
	}

	.coverage-type {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
		color: var(--fgColor-default);
	}

	.coverage-count {
		font-family: var(--font-code);
		font-size: 11px;
		color: var(--fgColor-muted);
	}

	.coverage-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.coverage-icon--ok {
		color: var(--fgColor-success);
	}
	.coverage-icon--no {
		color: var(--fgColor-disabled);
		opacity: 0.5;
	}

	.coverage-row--warn {
		background: color-mix(in srgb, var(--fgColor-attention) 5%, transparent);
	}
	.coverage-row--warn .coverage-type {
		color: var(--fgColor-attention);
	}
</style>
