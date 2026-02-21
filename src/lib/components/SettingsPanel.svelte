<script lang="ts">
	import type { Platform, GithubConfigs, GithubRepoConfig } from '$lib/types.js';

	interface Props {
		show: boolean;
		chatWebhookUrl: string;
		githubPat: string;
		githubRepos: GithubConfigs;
		figmaFileKey: string;
		figmaPat: string;
		figmaFetching: boolean;
		figmaWebhookPasscode: string;
		figmaWebhookEvent: { file_name: string; timestamp: string; receivedAt: string } | null;
		selectedPlatforms: Platform[];
		platformColor: (platform: Platform) => string;
		onToggle: () => void;
		onChatWebhookChange: (e: Event) => void;
		onGithubPatChange: (e: Event) => void;
		onGithubRepoChange: (platform: Platform, field: keyof GithubRepoConfig, e: Event) => void;
		onFigmaFileKeyChange: (e: Event) => void;
		onFigmaPatChange: (e: Event) => void;
		onFigmaFetch: () => void;
		onFigmaPasscodeChange: (e: Event) => void;
	}

	let {
		show,
		chatWebhookUrl,
		githubPat,
		githubRepos,
		figmaFileKey,
		figmaPat,
		figmaFetching,
		figmaWebhookPasscode,
		figmaWebhookEvent,
		selectedPlatforms,
		platformColor,
		onToggle,
		onChatWebhookChange,
		onGithubPatChange,
		onGithubRepoChange,
		onFigmaFileKeyChange,
		onFigmaPatChange,
		onFigmaFetch,
		onFigmaPasscodeChange
	}: Props = $props();

	let firstInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (show) {
			setTimeout(() => firstInputEl?.focus(), 50);
		}
	});
</script>

<div class="settings-section">
	<button
		class="settings-toggle"
		class:settings-toggle--open={show}
		onclick={onToggle}
		aria-expanded={show}
		aria-controls="settings-body"
	>
		<span>⚙ Settings</span>
		<span class="settings-arrow" aria-hidden="true">{show ? '▲' : '▼'}</span>
	</button>
	{#if show}
		<div class="settings-body" id="settings-body" role="group" aria-label="Settings">
			<div class="settings-group">
				<label class="settings-group-label" for="chat-webhook-input">Google Chat webhook</label>
				<input
					id="chat-webhook-input"
					bind:this={firstInputEl}
					class="settings-input"
					type="url"
					placeholder="https://chat.googleapis.com/v1/spaces/…/messages?key=…"
					value={chatWebhookUrl}
					oninput={onChatWebhookChange}
					spellcheck="false"
					aria-describedby="chat-webhook-hint"
				/>
				<p class="settings-hint" id="chat-webhook-hint">
					Paste a Google Chat incoming webhook URL. A summary card is posted after each generation.
				</p>
			</div>

			<div class="settings-group">
				<label class="settings-group-label" for="github-pat-input"
					>GitHub Personal Access Token</label
				>
				<input
					id="github-pat-input"
					class="settings-input"
					type="password"
					placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
					value={githubPat}
					oninput={onGithubPatChange}
					autocomplete="off"
					aria-describedby="github-pat-hint"
				/>
				<p class="settings-hint" id="github-pat-hint">
					PAT needs <code>repo</code> scope. One PR is opened per platform in its own branch.
				</p>
				{#each selectedPlatforms as platform (platform)}
					<fieldset class="settings-platform-group">
						<legend class="settings-platform-label" style="color: {platformColor(platform)}"
							>{platform} repository</legend
						>
						<div class="settings-platform-fields">
							<label class="sr-only" for="gh-owner-{platform}">Owner / org ({platform})</label>
							<input
								id="gh-owner-{platform}"
								class="settings-input settings-input--half"
								type="text"
								placeholder="owner / org"
								value={githubRepos[platform]?.owner ?? ''}
								oninput={(e) => onGithubRepoChange(platform, 'owner', e)}
							/>
							<label class="sr-only" for="gh-repo-{platform}">Repository name ({platform})</label>
							<input
								id="gh-repo-{platform}"
								class="settings-input settings-input--half"
								type="text"
								placeholder="repo"
								value={githubRepos[platform]?.repo ?? ''}
								oninput={(e) => onGithubRepoChange(platform, 'repo', e)}
							/>
							<label class="sr-only" for="gh-branch-{platform}">Base branch ({platform})</label>
							<input
								id="gh-branch-{platform}"
								class="settings-input settings-input--half"
								type="text"
								placeholder="base branch"
								value={githubRepos[platform]?.branch ?? ''}
								oninput={(e) => onGithubRepoChange(platform, 'branch', e)}
							/>
							<label class="sr-only" for="gh-dir-{platform}">Target directory ({platform})</label>
							<input
								id="gh-dir-{platform}"
								class="settings-input settings-input--half"
								type="text"
								placeholder="target dir (optional)"
								value={githubRepos[platform]?.dir ?? ''}
								oninput={(e) => onGithubRepoChange(platform, 'dir', e)}
							/>
						</div>
					</fieldset>
				{/each}
			</div>

			<div class="settings-group">
				<label class="settings-group-label" for="figma-file-key">Figma Variables API</label>
				<input
					id="figma-file-key"
					class="settings-input"
					type="text"
					placeholder="Figma file key (from URL: figma.com/design/FILE_KEY/…)"
					value={figmaFileKey}
					oninput={onFigmaFileKeyChange}
					spellcheck="false"
					aria-describedby="figma-api-hint"
				/>
				<input
					id="figma-pat"
					class="settings-input"
					type="password"
					placeholder="Figma Personal Access Token (figd_…)"
					value={figmaPat}
					oninput={onFigmaPatChange}
					autocomplete="off"
				/>
				<button
					class="figma-fetch-btn"
					disabled={!figmaFileKey || !figmaPat || figmaFetching}
					onclick={onFigmaFetch}
				>
					{#if figmaFetching}
						Fetching…
					{:else}
						Fetch tokens from Figma
					{/if}
				</button>
				<p class="settings-hint" id="figma-api-hint">
					Connect directly to Figma's Variables API. The file key is the ID in your Figma URL after <code>/design/</code>.
					Your PAT needs <code>file_variables:read</code> scope. Requires Organization or Enterprise plan.
					For other plans, use the <strong>Tokensmith Sync</strong> Figma plugin instead.
				</p>
			</div>

			<div class="settings-group">
				<label class="settings-group-label" for="figma-webhook-passcode"
					>Figma webhook passcode</label
				>
				<input
					id="figma-webhook-passcode"
					class="settings-input"
					type="password"
					placeholder="Enter a secure passcode"
					value={figmaWebhookPasscode}
					oninput={onFigmaPasscodeChange}
					spellcheck="false"
					autocomplete="off"
					aria-describedby="figma-webhook-hint"
				/>
				{#if figmaWebhookPasscode}
					<p class="settings-hint settings-hint--mono" id="figma-webhook-hint">
						Register this URL in Figma: <code
							>{typeof window !== 'undefined'
								? window.location.origin
								: ''}/api/figma/webhook?passcode={encodeURIComponent(figmaWebhookPasscode)}</code
						>
					</p>
				{:else}
					<p class="settings-hint" id="figma-webhook-hint">
						Set a passcode to enable Figma webhook notifications when a file version is published.
					</p>
				{/if}
				{#if figmaWebhookEvent}
					<p class="settings-hint">
						Last event: <strong>{figmaWebhookEvent.file_name}</strong> at {new Date(
							figmaWebhookEvent.receivedAt
						).toLocaleString()}
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.settings-section {
		margin-top: 14px;
		border: 1px solid var(--borderColor-default);
		border-radius: var(--borderRadius-large);
		overflow: hidden;
	}
	.settings-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: var(--bgColor-inset);
		border: none;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		letter-spacing: 0;
		text-transform: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition:
			color var(--base-duration-100) var(--base-easing-ease),
			background var(--base-duration-100) var(--base-easing-ease);
	}
	.settings-toggle:hover {
		color: var(--fgColor-muted);
		background: var(--control-bgColor-rest);
	}
	.settings-toggle--open {
		color: var(--fgColor-muted);
		border-bottom: 1px solid var(--borderColor-muted);
	}
	.settings-arrow {
		font-size: 10px;
		opacity: 0.6;
	}
	.settings-body {
		padding: 16px;
		background: var(--bgColor-inset);
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.settings-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.settings-group-label {
		display: block;
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-medium);
		letter-spacing: 0;
		text-transform: none;
		color: var(--fgColor-muted);
	}
	.settings-input {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-sm);
		font-weight: var(--base-text-weight-normal);
		padding: 8px 12px;
		background: var(--control-bgColor-rest);
		border: 1px solid var(--control-borderColor-rest);
		border-radius: var(--borderRadius-medium);
		color: var(--control-fgColor-rest);
		width: 100%;
		letter-spacing: 0;
		outline: none;
		transition:
			border-color var(--base-duration-200) var(--base-easing-ease),
			color var(--base-duration-200) var(--base-easing-ease);
	}
	.settings-input:focus {
		border-color: var(--borderColor-accent-emphasis);
		color: var(--fgColor-default);
	}
	.settings-input::placeholder {
		color: var(--control-fgColor-placeholder);
	}
	.settings-input--half {
		flex: 1;
		min-width: 0;
	}
	.settings-hint {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-normal);
		color: var(--fgColor-disabled);
		line-height: var(--base-text-lineHeight-relaxed);
	}
	.settings-platform-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		border: none;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.settings-platform-label {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-xs);
		font-weight: var(--base-text-weight-semibold);
		letter-spacing: 0;
		text-transform: none;
		margin-top: 4px;
		padding: 0;
	}
	.settings-platform-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.figma-fetch-btn {
		font-family: var(--fontStack-sansSerif);
		font-size: var(--base-text-size-sm);
		font-weight: var(--base-text-weight-semibold);
		padding: 8px 16px;
		background: var(--button-primary-bgColor-rest);
		color: var(--button-primary-fgColor-rest);
		border: 1px solid var(--button-primary-borderColor-rest);
		border-radius: var(--borderRadius-medium);
		cursor: pointer;
		transition:
			background var(--base-duration-100) var(--base-easing-ease),
			border-color var(--base-duration-100) var(--base-easing-ease);
	}
	.figma-fetch-btn:hover:not(:disabled) {
		background: var(--button-primary-bgColor-hover);
		border-color: var(--button-primary-borderColor-hover);
	}
	.figma-fetch-btn:disabled {
		background: var(--button-primary-bgColor-disabled);
		color: var(--button-primary-fgColor-disabled);
		border-color: var(--button-primary-borderColor-disabled);
		cursor: not-allowed;
	}
	.settings-hint :global(code) {
		font-family: var(--fontStack-monospace);
		font-size: 10px;
		word-break: break-all;
	}

	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		clip: rect(0 0 0 0);
		overflow: hidden;
	}
</style>
