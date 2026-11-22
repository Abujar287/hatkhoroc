import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

// GitHub Repository Configuration for Auto-Update Checker
export const GITHUB_OWNER = 'Abujar287';
export const GITHUB_REPO = 'hatkhoroc';
export const GITHUB_BRANCH = 'main';

// Current Build Commit SHA, Build Number & Version (stamped during Android CI build)
export const CURRENT_BUILD_SHA = 'forced-update-sha-v1.1.4';
export const CURRENT_BUILD_NUMBER = 0;
export const APP_VERSION = 'v1.1.4';
export const APP_BUILD_DATETIME = '2026-11-14 09:30 PM';

const FALLBACK_BUILD_DATETIME = '2026-11-14 09:30 PM';

function getResolvedDefaultBuildDateTime(): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(APP_BUILD_DATETIME)) {
    return formatAppUpdateDateTime(APP_BUILD_DATETIME);
  }
  return APP_BUILD_DATETIME || FALLBACK_BUILD_DATETIME;
}

export function formatAppUpdateDateTime(dateInput?: string | number | Date | null): string {
  try {
    if (!dateInput) return FALLBACK_BUILD_DATETIME;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      return typeof dateInput === 'string' && dateInput.trim() ? dateInput : FALLBACK_BUILD_DATETIME;
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const strHours = String(hours12).padStart(2, '0');

    return `${y}-${m}-${day} ${strHours}:${mins} ${ampm}`;
  } catch {
    return FALLBACK_BUILD_DATETIME;
  }
}

export function getAppLastUpdateTime(): string {
  try {
    const saved = localStorage.getItem('app_last_update_datetime');
    if (saved) return saved;
  } catch {}
  return getResolvedDefaultBuildDateTime();
}

export function setAppLastUpdateTime(val: string): void {
  try {
    localStorage.setItem('app_last_update_datetime', val);
  } catch {}
}

export interface NativeInstalledInfo {
  isNative: boolean;
  buildNumber: number;
  versionName: string;
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
  latestBuildNumber?: number;
}

export function isNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}
  return (
    Boolean((window as any).AndroidNativeUpdater) ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  );
}

export async function getNativeInstalledInfo(): Promise<NativeInstalledInfo> {
  const isNative = isNativeAndroidApp();
  let buildNumber = CURRENT_BUILD_NUMBER || 0;
  let versionName = APP_VERSION;

  if (!isNative) {
    return { isNative: false, buildNumber, versionName };
  }

  // 1. Try custom AndroidNativeUpdater bridge if present
  try {
    const nativeUpdater = (window as any).AndroidNativeUpdater;
    if (nativeUpdater && typeof nativeUpdater.getAppBuildInfo === 'function') {
      const raw = nativeUpdater.getAppBuildInfo();
      const parsed = JSON.parse(raw);
      const vc = Number(parsed?.versionCode || 0);
      if (vc > 0) buildNumber = Math.max(buildNumber, vc);
      if (parsed?.versionName) versionName = String(parsed.versionName);
    }
  } catch {}

  // 2. Query @capacitor/app getInfo() (reads Android PackageInfo.versionCode & versionName)
  try {
    const info = await Promise.race([
      CapApp.getInfo(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 1500))
    ]);
    if (info) {
      const vc = parseInt(String(info.build || ''), 10);
      if (!isNaN(vc) && vc > 0) {
        buildNumber = Math.max(buildNumber, vc);
      }
      if (info.version && versionName === APP_VERSION) {
        versionName = String(info.version);
      }
    }
  } catch {}

  return { isNative, buildNumber, versionName };
}

interface PendingInstallRecord {
  sha?: string;
  releaseUpdatedAt?: string;
  newDateTime?: string;
  targetBuildNumber?: number;
  previousBuildNumber?: number;
  savedAt: number;
}

const PENDING_INSTALL_KEY = 'app_pending_update_install';

export function recordPendingUpdateInstall(data: {
  sha?: string;
  releaseUpdatedAt?: string;
  newDateTime?: string;
  targetBuildNumber?: number;
  previousBuildNumber?: number;
}): void {
  try {
    const payload: PendingInstallRecord = {
      ...data,
      savedAt: Date.now()
    };
    localStorage.setItem(PENDING_INSTALL_KEY, JSON.stringify(payload));
  } catch {}
}

export function reconcilePendingUpdateInstall(currentNativeBuildNumber: number): void {
  try {
    const raw = localStorage.getItem(PENDING_INSTALL_KEY);
    if (!raw) return;
    const pending: PendingInstallRecord = JSON.parse(raw);
    const prevVc = Number(pending?.previousBuildNumber || 0);
    const targetVc = Number(pending?.targetBuildNumber || 0);

    const upgradedBeyondPrev = currentNativeBuildNumber > 0 && prevVc > 0 && currentNativeBuildNumber > prevVc;
    const reachedTarget = currentNativeBuildNumber > 0 && targetVc > 0 && currentNativeBuildNumber >= targetVc;

    if (upgradedBeyondPrev || reachedTarget) {
      recordUpdateAcknowledged(
        pending.sha || '',
        pending.newDateTime,
        pending.releaseUpdatedAt,
        currentNativeBuildNumber
      );
      localStorage.removeItem(PENDING_INSTALL_KEY);
      return;
    }

    // If Android installer was dismissed and > 2 minutes elapsed, clear stale pending record
    if (Date.now() - Number(pending?.savedAt || 0) > 2 * 60 * 1000) {
      localStorage.removeItem(PENDING_INSTALL_KEY);
    }
  } catch {}
}

function parseReleaseMetadataFromBody(body: string): { runNumber: number; buildNumber: number; sha: string } {
  if (!body) return { runNumber: 0, buildNumber: 0, sha: '' };
  const runMatch = body.match(/\[run:(\d+)\]/i);
  const buildMatch = body.match(/\[build:(\d+)\]/i);
  const shaMatch = body.match(/\[sha:([0-9a-fA-F]{7,40})\]/i);
  const runNumber = runMatch ? parseInt(runMatch[1], 10) : 0;
  const explicitBuild = buildMatch ? parseInt(buildMatch[1], 10) : 0;
  const buildNumber = explicitBuild > 0 ? explicitBuild : (runNumber > 0 ? 10000 + runNumber : 0);
  const sha = shaMatch ? shaMatch[1] : '';
  return { runNumber, buildNumber, sha };
}

/**
 * Checks GitHub Releases + successful Android APK builds to verify whether a newer APK actually exists.
 * Never prompts for commits whose APK hasn't been built/published yet.
 */
export async function checkGitHubForUpdates(force: boolean = false): Promise<UpdateInfo | null> {
  try {
    const nativeInfo = await getNativeInstalledInfo();
    reconcilePendingUpdateInstall(nativeInfo.buildNumber);

    const headers = { Accept: 'application/vnd.github.v3+json' };
    const releaseMetaUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/latest?_t=${Date.now()}`;

    const releaseRes = await fetch(releaseMetaUrl, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(9000)
    }).catch(() => null);

    let apkDownloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/latest/hatkhoroc.apk`;
    let apkSizeBytes: number | undefined;
    let releaseUpdatedAt = '';
    let releaseHtmlUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/latest`;
    let bodyMeta = { runNumber: 0, buildNumber: 0, sha: '' };

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
        if (relJson?.html_url) {
          releaseHtmlUrl = String(relJson.html_url);
        }
        bodyMeta = parseReleaseMetadataFromBody(String(relJson?.body || ''));
      } catch {}
    }

    // If release body doesn't contain build metadata yet, query the latest SUCCESSFUL Android APK workflow run
    let actionsBuildNumber = 0;
    let actionsSha = '';
    let actionsUpdatedAt = '';
    let commitMessage = 'নতুন কোড আপডেট ও বাগ ফিক্স';
    let commitAuthor = 'Developer';

    if (bodyMeta.buildNumber === 0 || !bodyMeta.sha) {
      const runsUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/android.yml/runs?status=success&per_page=1&_t=${Date.now()}`;
      const runsRes = await fetch(runsUrl, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(9000)
      }).catch(() => null);

      if (runsRes && runsRes.ok) {
        try {
          const runsJson = await runsRes.json();
          const latestRun = Array.isArray(runsJson?.workflow_runs) ? runsJson.workflow_runs[0] : null;
          if (latestRun) {
            const runNum = Number(latestRun.run_number || 0);
            actionsBuildNumber = runNum > 0 ? 10000 + runNum : 0;
            actionsSha = String(latestRun.head_sha || '');
            actionsUpdatedAt = String(latestRun.updated_at || latestRun.created_at || '');
            if (latestRun.head_commit?.message) {
              commitMessage = String(latestRun.head_commit.message).split('\n')[0];
            }
            if (latestRun.head_commit?.author?.name) {
              commitAuthor = String(latestRun.head_commit.author.name);
            }
          }
        } catch {}
      }
    }

    // Only fall back to commits/main if we still lack a SHA from both Release body and successful Android workflow
    let fallbackCommitSha = '';
    let fallbackCommitDate = '';
    let htmlUrl = releaseHtmlUrl;

    if (!bodyMeta.sha && !actionsSha) {
      const commitUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}?_t=${Date.now()}`;
      const commitRes = await fetch(commitUrl, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(9000)
      }).catch(() => null);

      if (commitRes && commitRes.ok) {
        try {
          const commitData = await commitRes.json();
          fallbackCommitSha = String(commitData?.sha || '');
          fallbackCommitDate = String(
            commitData?.commit?.author?.date || commitData?.commit?.committer?.date || ''
          );
          if (commitData?.commit?.message) {
            commitMessage = String(commitData.commit.message).split('\n')[0];
          }
          if (commitData?.commit?.author?.name) {
            commitAuthor = String(commitData.commit.author.name);
          }
          if (commitData?.html_url) {
            htmlUrl = String(commitData.html_url);
          }
        } catch {}
      }
    }

    const latestApkBuildNumber = Math.max(bodyMeta.buildNumber || 0, actionsBuildNumber || 0);
    const latestSha = bodyMeta.sha || actionsSha || fallbackCommitSha;
    const rawReleaseDate = releaseUpdatedAt || actionsUpdatedAt || fallbackCommitDate;

    if (!latestSha && !releaseUpdatedAt && latestApkBuildNumber === 0) {
      return null;
    }

    const formattedReleaseDate = formatAppUpdateDateTime(rawReleaseDate || new Date().toISOString());

    const installedSha = localStorage.getItem('app_installed_sha') || '';
    const dismissedSha = localStorage.getItem('app_dismissed_sha') || '';
    const installedReleaseAt = localStorage.getItem('app_installed_release_at') || '';
    const dismissedReleaseAt = localStorage.getItem('app_dismissed_release_at') || '';
    const installedBuildSaved = Number(localStorage.getItem('app_installed_build_number') || '0') || 0;
    const isRealBuildSha = Boolean(CURRENT_BUILD_SHA && !CURRENT_BUILD_SHA.startsWith('forced-update-sha'));

    let isAlreadyOnLatest = false;

    if (nativeInfo.isNative) {
      if (nativeInfo.buildNumber > 0 && latestApkBuildNumber > 0) {
        // Authoritative check on Android: compare installed APK versionCode vs latest published APK build
        isAlreadyOnLatest = nativeInfo.buildNumber >= latestApkBuildNumber;
      } else if (isRealBuildSha && latestSha && CURRENT_BUILD_SHA === latestSha) {
        isAlreadyOnLatest = true;
      } else {
        isAlreadyOnLatest =
          (Boolean(releaseUpdatedAt) && Boolean(installedReleaseAt) && installedReleaseAt === releaseUpdatedAt) ||
          (Boolean(latestSha) && Boolean(installedSha) && installedSha === latestSha);
      }
    } else {
      isAlreadyOnLatest =
        (isRealBuildSha && Boolean(latestSha) && CURRENT_BUILD_SHA === latestSha) ||
        (installedBuildSaved > 0 && latestApkBuildNumber > 0 && installedBuildSaved >= latestApkBuildNumber) ||
        (Boolean(releaseUpdatedAt) && Boolean(installedReleaseAt) && installedReleaseAt === releaseUpdatedAt) ||
        (Boolean(latestSha) && Boolean(installedSha) && installedSha === latestSha);
    }

    if (isAlreadyOnLatest) {
      // Keep local state synced cleanly when verified on the latest native/CI build
      if (nativeInfo.isNative || isRealBuildSha) {
        if (formattedReleaseDate) {
          setAppLastUpdateTime(formattedReleaseDate);
        }
        if (latestSha) {
          localStorage.setItem('app_installed_sha', latestSha);
        }
        if (releaseUpdatedAt) {
          localStorage.setItem('app_installed_release_at', releaseUpdatedAt);
        }
        if (nativeInfo.buildNumber > 0) {
          localStorage.setItem('app_installed_build_number', String(nativeInfo.buildNumber));
        }
      }
    }

    let hasUpdate = !isAlreadyOnLatest;

    // On automatic background checks (!force):
    // 1. Never nag again for the same release/SHA once dismissed.
    // 2. On hosted Web/PWA where CURRENT_BUILD_SHA isn't stamped by Android CI, don't auto-popup APK installer.
    if (!force && hasUpdate) {
      if (
        (latestSha && dismissedSha === latestSha) ||
        (releaseUpdatedAt && dismissedReleaseAt === releaseUpdatedAt)
      ) {
        hasUpdate = false;
      } else if (!nativeInfo.isNative && !isRealBuildSha) {
        hasUpdate = false;
      }
    }

    const currentVersionLabel =
      nativeInfo.buildNumber > 0 ? `${APP_VERSION} (#${nativeInfo.buildNumber})` : APP_VERSION;
    const newVersionLabel =
      latestApkBuildNumber > 0 ? `${APP_VERSION} (#${latestApkBuildNumber})` : APP_VERSION;

    return {
      hasUpdate,
      currentSha: CURRENT_BUILD_SHA,
      latestSha: latestSha || releaseUpdatedAt || `build-${latestApkBuildNumber}`,
      currentVersion: currentVersionLabel,
      currentDateTime: getAppLastUpdateTime(),
      newVersion: newVersionLabel,
      newDateTime: formattedReleaseDate,
      commitMessage,
      commitAuthor,
      commitDate: rawReleaseDate || new Date().toISOString(),
      htmlUrl,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      actionsUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`,
      apkDownloadUrl,
      apkSizeBytes,
      releaseUpdatedAt,
      latestBuildNumber: latestApkBuildNumber || undefined
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

export function recordUpdateDismissed(sha?: string, releaseUpdatedAt?: string) {
  try {
    localStorage.setItem('app_update_dismissed_at', String(Date.now()));
    if (sha) {
      localStorage.setItem('app_dismissed_sha', sha);
    }
    if (releaseUpdatedAt) {
      localStorage.setItem('app_dismissed_release_at', releaseUpdatedAt);
    }
  } catch {}
}

export function recordUpdateAcknowledged(
  sha: string,
  newDateTime?: string,
  releaseUpdatedAt?: string,
  buildNumber?: number
) {
  try {
    if (sha) {
      localStorage.setItem('app_installed_sha', sha);
      localStorage.setItem('app_dismissed_sha', sha);
    }
    if (releaseUpdatedAt) {
      localStorage.setItem('app_installed_release_at', releaseUpdatedAt);
      localStorage.setItem('app_dismissed_release_at', releaseUpdatedAt);
    }
    if (buildNumber && buildNumber > 0) {
      localStorage.setItem('app_installed_build_number', String(buildNumber));
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
