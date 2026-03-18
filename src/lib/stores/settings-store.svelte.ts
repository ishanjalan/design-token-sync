import { browser } from '$app/environment';
import type { Platform, GithubConfigs, PrResult } from '$lib/types.js';
import {
	saveNotifyUrl,
	loadNotifyUrl,
	saveGithubPat,
	loadGithubPat,
	saveGithubRepos,
	loadGithubRepos,
	saveFigmaWebhookPasscode,
	loadFigmaWebhookPasscode,
	saveFigmaFileKey,
	loadFigmaFileKey,
	saveFigmaPat,
	loadFigmaPat,
	saveKotlinPackage,
	loadKotlinPackage
} from '$lib/storage.js';

class SettingsStoreClass {
	chatWebhookUrl = $state('');
	githubPat = $state('');
	githubRepos = $state<GithubConfigs>({});
	sendingPrs = $state(false);
	prResults = $state<PrResult[]>([]);
	figmaFileKey = $state('');
	figmaPat = $state('');
	figmaFetching = $state(false);
	figmaWebhookPasscode = $state('');
	figmaWebhookEvent = $state<{
		file_name: string;
		timestamp: string;
		receivedAt: string;
	} | null>(null);
	figmaWebhookSeen = $state(true);
	autoGenerate = $state(false);
	kotlinPackage = $state('');

	get figmaConnected() {
		return !!this.figmaFileKey && !!this.figmaPat;
	}

	init() {
		this.chatWebhookUrl = loadNotifyUrl();
		this.githubPat = loadGithubPat();
		this.githubRepos = loadGithubRepos();
		this.figmaWebhookPasscode = loadFigmaWebhookPasscode();
		this.figmaFileKey = loadFigmaFileKey();
		this.figmaPat = loadFigmaPat();
		this.autoGenerate = localStorage.getItem('auto-generate') === 'true';
		this.kotlinPackage = loadKotlinPackage();
	}

	onChatWebhookChange(e: Event) {
		this.chatWebhookUrl = (e.target as HTMLInputElement).value;
		if (browser) saveNotifyUrl(this.chatWebhookUrl);
	}

	onGithubPatChange(e: Event) {
		this.githubPat = (e.target as HTMLInputElement).value;
		if (browser) saveGithubPat(this.githubPat);
	}

	onGithubRepoChange(
		platform: Platform,
		field: keyof NonNullable<GithubConfigs[Platform]>,
		e: Event
	) {
		const val = (e.target as HTMLInputElement).value;
		this.githubRepos = {
			...this.githubRepos,
			[platform]: {
				...(this.githubRepos[platform] ?? { owner: '', repo: '', branch: 'main', dir: '' }),
				[field]: val
			}
		};
		if (browser) saveGithubRepos(this.githubRepos);
	}

	onFigmaFileKeyChange(e: Event) {
		this.figmaFileKey = (e.target as HTMLInputElement).value;
		if (browser) saveFigmaFileKey(this.figmaFileKey);
	}

	onFigmaPatChange(e: Event) {
		this.figmaPat = (e.target as HTMLInputElement).value;
		if (browser) saveFigmaPat(this.figmaPat);
	}

	onFigmaPasscodeChange(e: Event) {
		this.figmaWebhookPasscode = (e.target as HTMLInputElement).value;
		if (browser) saveFigmaWebhookPasscode(this.figmaWebhookPasscode);
	}

	onKotlinPackageChange(e: Event) {
		this.kotlinPackage = (e.target as HTMLInputElement).value;
		if (browser) saveKotlinPackage(this.kotlinPackage);
	}
}

export const settingsStore = new SettingsStoreClass();
