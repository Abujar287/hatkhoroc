// GitHub Repository Configuration for Auto-Update Checker
export const GITHUB_OWNER = 'Abujar287';
export const GITHUB_REPO = 'hatkhoroc';
export const GITHUB_BRANCH = 'main';

// Current Build Commit SHA & Version
export const CURRENT_BUILD_SHA = 'forced-update-sha-v1.1.4';
export const APP_VERSION = 'v1.1.4';
export const APP_BUILD_DATETIME = '2026-11-14 09:30 PM';

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
  currentVersion: string;
  currentDateTime: string;
  newVersion: string;
  newDateTime: string;
  commitMessage: string;
  commitAuthor: string;
  commitDate: string;
  htmlUrl: string;
  releaseUrl: string;
  actionsUrl: string;
  apkDownloadUrl: string;
  apkSizeBytes?: number;
  releaseUpdatedAt?: string;
}

export function isNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean((window as any).AndroidNativeUpdater) ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  );
}

/**
 * Checks GitHub API for the latest commit on main branch or latest release.
 */
export async function checkGitHubForUpdates(force: boolean = false): Promise<UpdateInfo | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}?_t=${Date.now()}`;
    const releaseMetaUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/latest?_t=${Date.now()}`;

    const [res, releaseRes] = await Promise.all([
      fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json'
        }
      }),
      fetch(releaseMetaUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json'
        }
      }).catch(() => null)
    ]);

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
    const htmlUrl = data.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
    let apkDownloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/latest/hatkhoroc.apk`;
    let apkSizeBytes: number | undefined;
    let releaseUpdatedAt = '';

    if (releaseRes && releaseRes.ok) {
      try {
        const relJson = await releaseRes.json();
        const apkAsset = Array.isArray(relJson?.assets)
          ? relJson.assets.find((a: any) => a?.name === 'hatkhoroc.apk') ||
            relJson.assets.find((a: any) => typeof a?.name === 'string' && a.name.endsWith('.apk'))
          : null;
        if (apkAsset?.browser_download_url) {
          apkDownloadUrl = apkAsset.browser_download_url;
        }
        if (typeof apkAsset?.size === 'number' && apkAsset.size > 0) {
          apkSizeBytes = apkAsset.size;
        }
        releaseUpdatedAt = String(apkAsset?.updated_at || relJson?.published_at || '');
      } catch {}
    }

    const installedSha = localStorage.getItem('app_installed_sha');
    const dismissedSha = localStorage.getItem('app_dismissed_sha');
    const installedReleaseAt = localStorage.getItem('app_installed_release_at');
    const isRealBuildSha = Boolean(CURRENT_BUILD_SHA && !CURRENT_BUILD_SHA.startsWith('forced-update-sha'));
    const isNative = isNativeAndroidApp();

    const isAlreadyOnLatest =
      (isRealBuildSha && CURRENT_BUILD_SHA === latestSha) ||
      (Boolean(installedSha) && installedSha === latestSha) ||
      (Boolean(releaseUpdatedAt) && Boolean(installedReleaseAt) && installedReleaseAt === releaseUpdatedAt);

    if (isAlreadyOnLatest && isRealBuildSha) {
      setAppLastUpdateTime(formattedCommitDate);
    }

    let hasUpdate = !isAlreadyOnLatest;

    // On automatic background checks (!force):
    // 1. Never nag again for the same SHA once dismissed.
    // 2. On hosted Web/PWA where CURRENT_BUILD_SHA isn't stamped by Android CI, don't auto-popup APK installer.
    if (!force && hasUpdate) {
      if (dismissedSha === latestSha) {
        hasUpdate = false;
      } else if (!isNative && !isRealBuildSha) {
        hasUpdate = false;
      }
    }

    return {
      hasUpdate,
      currentSha: CURRENT_BUILD_SHA,
      latestSha,
      currentVersion: APP_VERSION,
      currentDateTime: getAppLastUpdateTime(),
      newVersion: APP_VERSION,
      newDateTime: formattedCommitDate,
      commitMessage,
      commitAuthor,
      commitDate,
      htmlUrl,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      actionsUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`,
      apkDownloadUrl,
      apkSizeBytes,
      releaseUpdatedAt
    };
  } catch (err) {
    console.warn('Error checking GitHub updates:', err);
    return null;
  }
}

export function isUpdateDismissedRecently(): boolean {
  try {
    const dismissedSha = localStorage.getItem('app_dismissed_sha');
    if (dismissedSha) return true;
    const dismissedAt = localStorage.getItem('app_update_dismissed_at');
    if (!dismissedAt) return false;
    const diffHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
    return diffHours < 24;
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

export function recordUpdateAcknowledged(sha: string, newDateTime?: string, releaseUpdatedAt?: string) {
  try {
    if (sha) {
      localStorage.setItem('app_installed_sha', sha);
      localStorage.setItem('app_dismissed_sha', sha);
    }
    if (releaseUpdatedAt) {
      localStorage.setItem('app_installed_release_at', releaseUpdatedAt);
    }
    if (newDateTime) {
      setAppLastUpdateTime(newDateTime);
    }
    localStorage.removeItem('app_update_dismissed_at');
  } catch {}
}

export async function forceAppUpdateRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const names = await caches.keys();
      for (const name of names) {
        await caches.delete(name);
      }
    }
  } catch (err) {
    console.warn('Error clearing caches/SW:', err);
  }
  window.location.reload();
}
