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
export const APP_BUILD_DATETIME = '2026-11-22T06:28:00Z';

const BASE_COMMIT_COUNT = 195;
const BASE_VERSION_STEPS = 14; // v1.1.4 => 1*10 + 4 = 14
const FALLBACK_BUILD_DATETIME = '2026-11-22 12:28 PM';
const STALE_PLACEHOLDER_DATETIME = '2026-11-14 09:30 PM';

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
  const defaultFormatted = getResolvedDefaultBuildDateTime();
  try {
    const saved = localStorage.getItem('app_last_update_datetime');
    if (saved && saved !== STALE_PLACEHOLDER_DATETIME) {
      const savedMs = Date.parse(saved);
      const buildMs = Date.parse(APP_BUILD_DATETIME);
      if (!Number.isNaN(savedMs) && !Number.isNaN(buildMs) && savedMs < buildMs) {
        return defaultFormatted;
      }
      return saved;
    }
  } catch {}
  return defaultFormatted;
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

function parseReleaseMetadataFromBody(body: string): { runNumber: number; buildNumber: number; sha: string; version: string } {
  if (!body) return { runNumber: 0, buildNumber: 0, sha: '', version: '' };
  const runMatch = body.match(/\[run:(\d+)\]/i);
  const buildMatch = body.match(/\[build:(\d+)\]/i);
  const shaMatch = body.match(/\[sha:([0-9a-fA-F]{7,40})\]/i);
  const versionMatch = body.match(/\[version:(v?\d+\.\d+\.\d+)\]/i);
  const runNumber = runMatch ? parseInt(runMatch[1], 10) : 0;
  const explicitBuild = buildMatch ? parseInt(buildMatch[1], 10) : 0;
  const buildNumber = explicitBuild > 0 ? explicitBuild : (runNumber > 0 ? 10000 + runNumber : 0);
  const sha = shaMatch ? shaMatch[1] : '';
  const version = versionMatch ? (versionMatch[1].startsWith('v') ? versionMatch[1] : `v${versionMatch[1]}`) : '';
  return { runNumber, buildNumber, sha, version };
}

function compareSemver(a?: string | null, b?: string | null): number {
  const parse = (v?: string | null): number[] => {
    const cleaned = String(v || '')
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split(' ')[0];
    if (!cleaned) return [];
    return cleaned.split('.').map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
  };
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  if (len === 0) return 0;
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function normalizeVersionTag(raw?: string | null): string {
  const match = String(raw || '').trim().match(/v?\d+\.\d+\.\d+/i);
  if (!match) return '';
  return match[0].toLowerCase().startsWith('v') ? match[0].toLowerCase() : `v${match[0]}`;
}

export function computeAutoVersionFromCommitCount(totalCommits: number): string {
  if (!totalCommits || totalCommits <= BASE_COMMIT_COUNT) return APP_VERSION;
  const delta = totalCommits - BASE_COMMIT_COUNT;
  const steps = BASE_VERSION_STEPS + delta;
  const minor = Math.floor(steps / 10);
  const patch = steps % 10;
  return `v1.${minor}.${patch}`;
}

export function getDisplayAppVersion(): string {
  if (isNativeAndroidApp()) {
    return APP_VERSION;
  }
  try {
    const saved = normalizeVersionTag(localStorage.getItem('app_installed_version'));
    if (saved && compareSemver(saved, APP_VERSION) > 0) {
      return saved;
    }
  } catch {}
  return APP_VERSION;
}

async function fetchRemoteAppMetadata(): Promise<{ appVersion: string; buildDateTime: string }> {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/src/utils/updateChecker.ts?_t=${Date.now()}`;
    const res = await fetch(rawUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return { appVersion: '', buildDateTime: '' };
    const text = await res.text();
    const versionMatch = text.match(/export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    const dateMatch = text.match(/export\s+const\s+APP_BUILD_DATETIME\s*=\s*['"]([^'"]+)['"]/);
    return {
      appVersion: versionMatch ? normalizeVersionTag(versionMatch[1]) : '',
      buildDateTime: dateMatch ? dateMatch[1].trim() : ''
    };
  } catch {
    return { appVersion: '', buildDateTime: '' };
  }
}

async function fetchGitHubCommitSummary(): Promise<{
  totalCommits: number;
  sha: string;
  date: string;
  message: string;
  author: string;
  htmlUrl: string;
}> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?sha=${GITHUB_BRANCH}&per_page=1&_t=${Date.now()}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(9000)
    });
    if (!res.ok) {
      return { totalCommits: 0, sha: '', date: '', message: '', author: '', htmlUrl: '' };
    }
    const linkHeader = res.headers.get('link') || '';
    const lastMatch = linkHeader.match(/page=(\d+)>;\s*rel="last"/i);
    const arr = await res.json();
    const latest = Array.isArray(arr) ? arr[0] : null;
    const totalCommits = lastMatch ? parseInt(lastMatch[1], 10) : (latest ? 1 : 0);
    return {
      totalCommits: Number.isFinite(totalCommits) ? totalCommits : 0,
      sha: String(latest?.sha || ''),
      date: String(latest?.commit?.author?.date || latest?.commit?.committer?.date || ''),
      message: latest?.commit?.message ? String(latest.commit.message).split('\n')[0] : '',
      author: latest?.commit?.author?.name ? String(latest.commit.author.name) : '',
      htmlUrl: String(latest?.html_url || '')
    };
  } catch {
    return { totalCommits: 0, sha: '', date: '', message: '', author: '', htmlUrl: '' };
  }
}

/**
 * Checks GitHub (remote APP_VERSION + GitHub Releases + successful Android APK builds)
 * to verify whether a newer version actually exists.
 * Never prompts when the running Web/PWA or installed Android APK is already on the latest version.
 */
export async function checkGitHubForUpdates(force: boolean = false): Promise<UpdateInfo | null> {
  try {
    const nativeInfo = await getNativeInstalledInfo();
    reconcilePendingUpdateInstall(nativeInfo.buildNumber);

    const headers = { Accept: 'application/vnd.github.v3+json' };
    const releaseMetaUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/latest?_t=${Date.now()}`;

    const [remoteMeta, releaseRes, commitSummary] = await Promise.all([
      fetchRemoteAppMetadata(),
      fetch(releaseMetaUrl, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(9000)
      }).catch(() => null),
      fetchGitHubCommitSummary()
    ]);

    let apkDownloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/latest/hatkhoroc.apk`;
    let apkSizeBytes: number | undefined;
    let releaseUpdatedAt = '';
    let releaseHtmlUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/latest`;
    let bodyMeta = { runNumber: 0, buildNumber: 0, sha: '', version: '' };

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

    // Query latest successful Android APK workflow run when release body doesn't contain build metadata
    let actionsBuildNumber = 0;
    let actionsSha = '';
    let actionsUpdatedAt = '';
    let commitMessage = commitSummary.message || 'নতুন কোড আপডেট ও বাগ ফিক্স';
    let commitAuthor = commitSummary.author || 'Developer';

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
            if (!commitSummary.message && latestRun.head_commit?.message) {
              commitMessage = String(latestRun.head_commit.message).split('\n')[0];
            }
            if (!commitSummary.author && latestRun.head_commit?.author?.name) {
              commitAuthor = String(latestRun.head_commit.author.name);
            }
          }
        } catch {}
      }
    }

    const fallbackCommitSha = commitSummary.sha;
    const fallbackCommitDate = commitSummary.date;
    const htmlUrl = commitSummary.htmlUrl || releaseHtmlUrl;

    const latestApkBuildNumber = Math.max(bodyMeta.buildNumber || 0, actionsBuildNumber || 0);
    const latestSha = nativeInfo.isNative
      ? (bodyMeta.sha || actionsSha || fallbackCommitSha)
      : (fallbackCommitSha || bodyMeta.sha || actionsSha);

    const pickLatestDate = (...candidates: Array<string | undefined | null>): string => {
      let bestStr = '';
      let bestMs = 0;
      for (const raw of candidates) {
        if (!raw) continue;
        const ms = Date.parse(raw);
        if (!Number.isNaN(ms) && ms > bestMs) {
          bestMs = ms;
          bestStr = raw;
        }
      }
      return bestStr;
    };

    const rawReleaseDate = nativeInfo.isNative
      ? (releaseUpdatedAt || actionsUpdatedAt || fallbackCommitDate || remoteMeta.buildDateTime || APP_BUILD_DATETIME)
      : pickLatestDate(fallbackCommitDate, releaseUpdatedAt, actionsUpdatedAt, remoteMeta.buildDateTime, APP_BUILD_DATETIME);

    const autoCommitVersion = commitSummary.totalCommits > 0
      ? computeAutoVersionFromCommitCount(commitSummary.totalCommits)
      : '';

    const pickHighestVersion = (...candidates: Array<string | undefined | null>): string => {
      let best = APP_VERSION;
      for (const c of candidates) {
        const norm = normalizeVersionTag(c);
        if (norm && compareSemver(norm, best) > 0) {
          best = norm;
        }
      }
      return best;
    };

    const installedVersion = getDisplayAppVersion();
    const remoteAppVersion = nativeInfo.isNative
      ? pickHighestVersion(bodyMeta.version, remoteMeta.appVersion, autoCommitVersion, APP_VERSION)
      : pickHighestVersion(autoCommitVersion, remoteMeta.appVersion, bodyMeta.version, APP_VERSION);

    const isRemoteSemverNewer = compareSemver(remoteAppVersion, installedVersion) > 0;
    const isRemoteSemverSameOrOlder = compareSemver(remoteAppVersion, installedVersion) <= 0;

    if (!latestSha && !releaseUpdatedAt && latestApkBuildNumber === 0 && !remoteMeta.appVersion && commitSummary.totalCommits === 0) {
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
      } else if (
        (Boolean(releaseUpdatedAt) && Boolean(installedReleaseAt) && installedReleaseAt === releaseUpdatedAt) ||
        (Boolean(latestSha) && Boolean(installedSha) && installedSha === latestSha)
      ) {
        isAlreadyOnLatest = true;
      } else if (latestApkBuildNumber === 0 && isRemoteSemverSameOrOlder) {
        // When GitHub Actions API couldn't supply a build number and app version matches GitHub, don't falsely prompt
        isAlreadyOnLatest = true;
      }
    } else {
      if (isRealBuildSha && latestSha) {
        isAlreadyOnLatest = CURRENT_BUILD_SHA === latestSha && !isRemoteSemverNewer;
      } else if (commitSummary.totalCommits > 0 || remoteMeta.appVersion) {
        // On Web/PWA: compare installed/running version against auto-incremented GitHub version
        isAlreadyOnLatest = !isRemoteSemverNewer;
      } else {
        isAlreadyOnLatest =
          (installedBuildSaved > 0 && latestApkBuildNumber > 0 && installedBuildSaved >= latestApkBuildNumber) ||
          (Boolean(releaseUpdatedAt) && Boolean(installedReleaseAt) && installedReleaseAt === releaseUpdatedAt) ||
          (Boolean(latestSha) && Boolean(installedSha) && installedSha === latestSha);
      }
    }

    if (isAlreadyOnLatest) {
      // Always sync the displayed last update timestamp & version when verified on the latest version
      if (formattedReleaseDate) {
        setAppLastUpdateTime(formattedReleaseDate);
      }
      if (!nativeInfo.isNative && remoteAppVersion) {
        try {
          localStorage.setItem('app_installed_version', remoteAppVersion);
        } catch {}
      }
      if (nativeInfo.isNative || isRealBuildSha) {
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
      nativeInfo.buildNumber > 0 ? `${installedVersion} (#${nativeInfo.buildNumber})` : installedVersion;
    const newVersionLabel =
      nativeInfo.isNative && latestApkBuildNumber > 0
        ? `${remoteAppVersion} (#${latestApkBuildNumber})`
        : remoteAppVersion;

    return {
      hasUpdate,
      currentSha: CURRENT_BUILD_SHA,
      latestSha: latestSha || releaseUpdatedAt || remoteAppVersion || `build-${latestApkBuildNumber}`,
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
  buildNumber?: number,
  version?: string
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
    const cleanVer = normalizeVersionTag(version);
    if (cleanVer) {
      localStorage.setItem('app_installed_version', cleanVer);
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
