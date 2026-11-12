// GitHub Repository Configuration for Auto-Update Checker
export const GITHUB_OWNER = 'Abujar287';
export const GITHUB_REPO = 'hatkhoroc';
export const GITHUB_BRANCH = 'main';

// Current Build Commit SHA & Version
// This gets stamped with the current commit so when a new commit is pushed to main,
// any client opening the app detects that a newer commit is available on GitHub!
export const CURRENT_BUILD_SHA = 'forced-update-sha-v1.1.2';
export const APP_VERSION = 'v1.1.2';
export const APP_BUILD_DATETIME = '2026-11-12 01:50 AM';

export function formatAppUpdateDateTime(dateInput?: string | number | Date | null): string {
  try {
    if (!dateInput) return APP_BUILD_DATETIME;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return APP_BUILD_DATETIME;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    let hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const strHours = String(hours12).padStart(2, '0');

    return `${y}-${m}-${day} ${strHours}:${mins} ${ampm}`;
  } catch {
    return APP_BUILD_DATETIME;
  }
}

export function getAppLastUpdateTime(): string {
  try {
    const saved = localStorage.getItem('app_last_update_datetime');
    if (saved) return saved;
  } catch {}
  return APP_BUILD_DATETIME;
}

export function setAppLastUpdateTime(val: string): void {
  try {
    localStorage.setItem('app_last_update_datetime', val);
  } catch {}
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentSha: string;
  latestSha: string;
  commitMessage: string;
  commitAuthor: string;
  commitDate: string;
  htmlUrl: string;
  releaseUrl: string;
  actionsUrl: string;
  apkDownloadUrl: string;
}

/**
 * Checks GitHub API for the latest commit on main branch or latest release.
 * Returns UpdateInfo if a newer version or commit is available.
 */
export async function checkGitHubForUpdates(force: boolean = false): Promise<UpdateInfo | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}?_t=${Date.now()}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      console.warn('GitHub API check failed with status:', res.status);
      return null;
    }

    const data = await res.json();
    const latestSha = data.sha;
    if (!latestSha) return null;

    const commitMessage = data.commit?.message?.split('\n')?.[0] || 'নতুন কোড আপডেট ও বাগ ফিক্স';
    const commitAuthor = data.commit?.author?.name || 'Developer';
    const commitDate = data.commit?.author?.date || data.commit?.committer?.date || new Date().toISOString();
    const formattedCommitDate = formatAppUpdateDateTime(commitDate);
    setAppLastUpdateTime(formattedCommitDate);
    const htmlUrl = data.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
    const apkDownloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/latest/hatkhoroc.apk`;

    // Read stored installed / acknowledged / dismissed SHA
    const installedSha = localStorage.getItem('app_installed_sha');
    const dismissedSha = localStorage.getItem('app_dismissed_sha');

    // An update is available ONLY if neither CURRENT_BUILD_SHA nor installedSha matches latestSha
    const isAlreadyOnLatest = 
      (CURRENT_BUILD_SHA && CURRENT_BUILD_SHA === latestSha) ||
      (installedSha && installedSha === latestSha);

    let hasUpdate = !isAlreadyOnLatest;

    if (!force && hasUpdate) {
      // If user recently dismissed this exact SHA, don't auto-nag
      if (dismissedSha === latestSha && isUpdateDismissedRecently()) {
        hasUpdate = false;
      }
    }

    return {
      hasUpdate,
      currentSha: CURRENT_BUILD_SHA,
      latestSha,
      commitMessage,
      commitAuthor,
      commitDate,
      htmlUrl,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      actionsUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`,
      apkDownloadUrl
    };
  } catch (err) {
    console.warn('Error checking GitHub updates:', err);
    return null;
  }
}

/**
 * Checks if the update popup was dismissed within the last 4 hours
 */
export function isUpdateDismissedRecently(): boolean {
  try {
    const dismissedAt = localStorage.getItem('app_update_dismissed_at');
    if (!dismissedAt) return false;
    const diffHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
    return diffHours < 4;
  } catch {
    return false;
  }
}

export function recordUpdateDismissed(sha?: string) {
  try {
    localStorage.setItem('app_update_dismissed_at', String(Date.now()));
    if (sha) {
      localStorage.setItem('app_dismissed_sha', sha);
    }
  } catch {}
}

export function recordUpdateAcknowledged(sha: string) {
  try {
    localStorage.setItem('app_installed_sha', sha);
    localStorage.setItem('app_dismissed_sha', sha);
    localStorage.removeItem('app_update_dismissed_at');
  } catch {}
}

