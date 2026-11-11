// GitHub Repository Configuration for Auto-Update Checker
export const GITHUB_OWNER = 'Abujar287';
export const GITHUB_REPO = 'hatkhoroc';
export const GITHUB_BRANCH = 'main';

// Current Build Commit SHA & Version
// This gets stamped with the current commit so when a new commit is pushed to main,
// any client opening the app detects that a newer commit is available on GitHub!
export const CURRENT_BUILD_SHA = 'forced-update-sha-1794379151488';
export const APP_VERSION = 'v1.1.2';

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
}

/**
 * Checks GitHub API for the latest commit on main branch.
 * Returns UpdateInfo if a new commit or release is found.
 */
export async function checkGitHubForUpdates(): Promise<UpdateInfo | null> {
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
    const htmlUrl = data.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

    // Read stored installed SHA if user previously acknowledged an update
    const installedSha = localStorage.getItem('app_installed_sha') || CURRENT_BUILD_SHA;

    const hasUpdate = latestSha !== CURRENT_BUILD_SHA && latestSha !== installedSha;

    return {
      hasUpdate,
      currentSha: installedSha,
      latestSha,
      commitMessage,
      commitAuthor,
      commitDate,
      htmlUrl,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      actionsUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`
    };
  } catch (err) {
    console.warn('Error checking GitHub updates:', err);
    return null;
  }
}

/**
 * Checks if the update popup was dismissed within the last hour
 */
export function isUpdateDismissedRecently(): boolean {
  try {
    const dismissedAt = localStorage.getItem('app_update_dismissed_at');
    if (!dismissedAt) return false;
    const diffHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
    return diffHours < 1; // Remind again after 1 hour if not updated
  } catch {
    return false;
  }
}

export function recordUpdateDismissed() {
  try {
    localStorage.setItem('app_update_dismissed_at', String(Date.now()));
  } catch {}
}

export function recordUpdateAcknowledged(sha: string) {
  try {
    localStorage.setItem('app_installed_sha', sha);
  } catch {}
}
