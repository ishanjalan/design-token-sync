<script lang="ts">
	import { Palette, Globe, Smartphone, Settings as SettingsIcon, ChevronUp, ChevronDown } from 'lucide-svelte';
	import type { Platform, GithubConfigs, GithubRepoConfig } from '$lib/types.js';

	type SettingsTab = 'design' | 'web' | 'android' | 'ios' | 'general';

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

	let activeSettingsTab = $state<SettingsTab>('design');

	const TABS: { id: SettingsTab; label: string }[] = [
		{ id: 'design', label: 'Design' },
		{ id: 'web', label: 'Web' },
		{ id: 'android', label: 'Android' },
		{ id: 'ios', label: 'iOS' },
		{ id: 'general', label: 'General' }
	];
</script>

<div class="settings-section">
	<button
		class="settings-toggle"
		class:settings-toggle--open={show}
		onclick={onToggle}
		aria-expanded={show}
		aria-controls="settings-body"
	>
		<span class="settings-toggle-label"><SettingsIcon size={12} strokeWidth={2} /> Settings</span>
		<span class="settings-arrow" aria-hidden="true">{#if show}<ChevronUp size={12} strokeWidth={2} />{:else}<ChevronDown size={12} strokeWidth={2} />{/if}</span>
	</button>
	{#if show}
		<div class="settings-body" id="settings-body" role="group" aria-label="Settings">
			<!-- Role tabs -->
			<div class="settings-tabs" role="tablist" aria-label="Settings category">
				{#each TABS as tab (tab.id)}
					<button
						class="settings-tab"
						class:settings-tab--active={activeSettingsTab === tab.id}
						role="tab"
						aria-selected={activeSettingsTab === tab.id}
						onclick={() => (activeSettingsTab = tab.id)}
					>
						<span class="settings-tab-icon">
						{#if tab.id === 'design'}<Palette size={14} strokeWidth={1.75} />
						{:else if tab.id === 'web'}<Globe size={14} strokeWidth={1.75} />
						{:else if tab.id === 'android'}<Smartphone size={14} strokeWidth={1.75} />
						{:else if tab.id === 'ios'}<Smartphone size={14} strokeWidth={1.75} />
						{:else}<SettingsIcon size={14} strokeWidth={1.75} />{/if}
					</span>
						<span class="settings-tab-label">{tab.label}</span>
					</button>
				{/each}
			</div>

			<!-- Design tab -->
			{#if activeSettingsTab === 'design'}
				<div class="settings-tab-body" role="tabpanel" aria-label="Design settings">
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
							The file key is the ID in your Figma URL after <code>/design/</code>.
							PAT needs <code>file_variables:read</code> scope. Requires Organization or Enterprise plan.
							For other plans, use the <strong>Tokensmith Sync</strong> plugin instead.
						</p>
					</div>

					<div class="settings-group">
						<label class="settings-group-label" for="figma-webhook-passcode">Figma webhook</label>
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
										: ''}/api/figma/webhook?passcode={encodeURIComponent(
										figmaWebhookPasscode
									)}</code
								>
							</p>
						{:else}
							<p class="settings-hint" id="figma-webhook-hint">
								Auto-sync when a Figma file version is published.
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

			<!-- Web / Android / iOS tabs -->
			{#if activeSettingsTab === 'web' || activeSettingsTab === 'android' || activeSettingsTab === 'ios'}
				{@const platform = activeSettingsTab as Platform}
				<div class="settings-tab-body" role="tabpanel" aria-label="{platform} settings">
					<div class="settings-group">
						<label class="settings-group-label" for="github-pat-input">GitHub Personal Access Token</label>
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
							PAT needs <code>repo</code> scope. Shared across all platforms.
						</p>
					</div>

					<fieldset class="settings-group">
						<legend
							class="settings-group-label"
							style="color: {platformColor(platform)}"
						>
							{platform === 'web' ? 'Web' : platform === 'ios' ? 'iOS' : 'Android'} repository
						</legend>
						<div class="settings-platform-fields">
							<label class="sr-only" for="gh-owner-{platform}">Owner / org</label>
							<input
								id="gh-owner-{platform}"
								class="settings-input"
								type="text"
								placeholder="owner / org"
								value={githubRepos[platform]?.owner ?? ''}
								oninput={(e) => onGithubRepoChange(platform, 'owner', e)}
							/>
							<label class="sr-only" for="gh-repo-{platform}">Repository name</label>
							<input
								id="gh-repo-{platform}"
								class="settings-input"
								type="text"
								placeholder="repo"
								value={githubRepos[platform]?.repo ?? ''}
								oninput={(e) => onGithubRepoChange(platform, 'repo', e)}
							/>
							<label class="sr-only" for="gh-branch-{platform}">Base branch</label>
							<input
								id="gh-branch-{platform}"
								class="settings-input"
								type="text"
								placeholder="base branch"
								value={githubRepos[platform]?.branch ?? ''}
								oninput={(e) => onGithubRepoChange(platform, 'branch', e)}
							/>
							<label class="sr-only" for="gh-dir-{platform}">Target directory</label>
							<input
								id="gh-dir-{platform}"
								class="settings-input"
								type="text"
								placeholder="target dir (optional)"
								value={githubRepos[platform]?.dir ?? ''}
								oninput={(e) => onGithubRepoChange(platform, 'dir', e)}
							/>
						</div>
						<p class="settings-hint">
							{#if platform === 'web'}
								PR branch delivers SCSS + TypeScript token files.
							{:else if platform === 'ios'}
								PR branch delivers Swift token files.
							{:else}
								PR branch delivers Kotlin token files.
							{/if}
						</p>
					</fieldset>
				</div>
			{/if}

			<!-- General tab -->
			{#if activeSettingsTab === 'general'}
				<div class="settings-tab-body" role="tabpanel" aria-label="General settings">
					<div class="settings-group">
						<label class="settings-group-label" for="chat-webhook-input">Google Chat webhook (override)</label>
						<input
							id="chat-webhook-input"
							class="settings-input"
							type="url"
							placeholder="Configured via GOOGLE_CHAT_WEBHOOK_URL env var"
							value={chatWebhookUrl}
							oninput={onChatWebhookChange}
							spellcheck="false"
							aria-describedby="chat-webhook-hint"
						/>
						<p class="settings-hint" id="chat-webhook-hint">
							Notifies when auto-sync detects changes. Configured server-side via <code>GOOGLE_CHAT_WEBHOOK_URL</code>; enter a URL here only to override.
						</p>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.settings-section {
		margin-top: 14px;
		border: 1px solid var(--borderColor-default);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.settings-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: var(--bgColor-inset);
		border: none;
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		color: var(--fgColor-disabled);
		cursor: pointer;
		transition: color var(--transition-fast), background var(--transition-fast);
	}
	.settings-toggle:hover {
		color: var(--fgColor-muted);
		background: var(--control-bgColor-rest);
	}
	.settings-toggle--open {
		color: var(--fgColor-muted);
		border-bottom: 1px solid var(--borderColor-muted);
	}
	.settings-toggle-label {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.settings-arrow {
		display: flex;
		align-items: center;
		opacity: 0.6;
	}
	.settings-body {
		background: var(--bgColor-inset);
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	/* ─── Tabs (pill-style) ─────────────────────────────────────────────────── */
	.settings-tabs {
		display: flex;
		gap: 4px;
		padding: 12px 16px 0;
		border-bottom: 1px solid var(--borderColor-muted);
		background: var(--bgColor-inset);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.settings-tabs::-webkit-scrollbar {
		display: none;
	}
	.settings-tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px 12px 10px;
		margin-bottom: -1px;
		border: none;
		background: transparent;
		border-radius: 100px;
		cursor: pointer;
		color: var(--fgColor-disabled);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		white-space: nowrap;
		transition: color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
	}
	.settings-tab:hover {
		color: var(--fgColor-muted);
		background: color-mix(in srgb, var(--bgColor-accent-muted) 10%, transparent);
	}
	.settings-tab--active {
		color: var(--fgColor-default);
		background: var(--control-bgColor-hover);
		box-shadow: var(--shadow-button);
	}
	.settings-tab-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}
	.settings-tab-label {
		line-height: 1;
	}

	/* ─── Tab body ──────────────────────────────────────────────────────────── */
	.settings-tab-body {
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* ─── Shared ────────────────────────────────────────────────────────────── */
	.settings-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		border: none;
		margin: 0;
		padding: 0;
	}
	.settings-group-label {
		display: block;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		color: var(--fgColor-muted);
		border: none;
		padding: 0;
	}
	.settings-input {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 500;
		padding: 8px 12px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		border-radius: var(--radius-sm);
		color: var(--control-fgColor-rest);
		width: 100%;
		letter-spacing: 0;
		outline: none;
		transition: border-color var(--transition-default), color var(--transition-default);
	}
	.settings-input:focus {
		border-color: var(--borderColor-accent-emphasis);
		color: var(--fgColor-default);
	}
	.settings-input::placeholder {
		color: var(--control-fgColor-placeholder);
	}
	.settings-hint {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		color: var(--fgColor-disabled);
		line-height: 1.6;
	}
	.settings-platform-fields {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.figma-fetch-btn {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		padding: 8px 16px;
		background: var(--button-primary-bgColor-rest);
		color: var(--button-primary-fgColor-rest);
		border: 1px solid var(--button-primary-borderColor-rest);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--transition-fast), border-color var(--transition-fast);
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
		font-family: var(--font-code);
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
