// Task Alarm & Notification Manager with Service Worker & Audio Support
let activeAudioContext: AudioContext | null = null;
let activeAlarmInterval: number | null = null;
let activeAudioElement: HTMLAudioElement | null = null;

// Unlock AudioContext & Audio element on user interactions
export function initAudioUnlock() {
  if (typeof window === 'undefined') return;

  const unlock = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!activeAudioContext) {
          activeAudioContext = new AudioCtx();
        }
        if (activeAudioContext.state === 'suspended') {
          activeAudioContext.resume().catch(() => {});
        }
      }

      // Pre-warm audio element for mobile browser playback permission
      if (!activeAudioElement) {
        const audio = new Audio('/alarm.wav');
        audio.volume = 0.01;
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1.0;
        }).catch(() => {});
        activeAudioElement = audio;
      }
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  };

  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

// Alarm sound disabled per user request — no sound plays, only notifications & popups
export function playTaskAlarmSound(): () => void {
  return () => {};
}

// Stop the currently ringing alarm sound
export function stopTaskAlarmSound() {
  // Stop audio element
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
  }

  // Stop Web Audio synthesizer
  if (activeAlarmInterval !== null) {
    clearInterval(activeAlarmInterval);
    activeAlarmInterval = null;
  }
}

// Trigger Web Vibration API (phone vibration) - Disabled per user request
export function vibrateDevice(pattern: number[] = [500, 200, 500, 200, 500, 200, 800]) {
  // Silent per request
}

// Request or ensure notification permission
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

// System Notification Trigger for Phone Notification Bar (Native Android APK + Web/PWA)
export async function sendSystemNotification(title: string, options?: any): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const tag = options?.tag || `entry-${Date.now()}`;
  const bodyText = typeof options?.body === 'string' ? options.body : '';

  // 1. Native Android APK bridge (shows directly in Android phone notification bar)
  try {
    const nativeUpdater = (window as any).AndroidNativeUpdater;
    if (nativeUpdater && typeof nativeUpdater.showEntryNotification === 'function') {
      nativeUpdater.showEntryNotification(title, bodyText, tag);
      return true;
    }
  } catch (err) {
    console.warn('Native Android notification warning:', err);
  }

  // 2. Web / Mobile Browser / Installed PWA Notification API
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'default') {
    const granted = await ensureNotificationPermission();
    if (!granted) return false;
  } else if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: any = {
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    requireInteraction: false,
    renotify: true,
    tag,
    data: { url: '/?tab=task' },
    ...options
  };

  try {
    // Primary method for mobile Chrome & PWA notification bar: Service Worker showNotification
    if ('serviceWorker' in navigator) {
      let reg: ServiceWorkerRegistration | undefined = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      if (!reg) {
        const readyOrTimeout = await Promise.race<ServiceWorkerRegistration | null>([
          navigator.serviceWorker.ready.catch(() => null),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 700))
        ]);
        if (readyOrTimeout) reg = readyOrTimeout;
      }

      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, notificationOptions);
        return true;
      }

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options: notificationOptions
        });
        return true;
      }
    }

    // Desktop / fallback standard Notification
    try {
      new Notification(title, notificationOptions);
      return true;
    } catch {
      return false;
    }
  } catch (err) {
    console.warn('System Notification error:', err);
    return false;
  }
}

export type EntryNotificationKind = 'Expense' | 'Income' | 'Task' | 'Note' | 'Category';

export interface EntryAddedNotificationInput {
  kind: EntryNotificationKind;
  title?: string;
  category?: string;
  amount?: number;
  date?: string;
  time?: string;
  note?: string;
  targetTab?: string;
}

export async function notifyEntryAdded(input: EntryAddedNotificationInput): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const amountText =
    typeof input.amount === 'number' && !isNaN(input.amount) && input.amount > 0
      ? `৳${input.amount.toLocaleString()}`
      : '';

  let title = 'হাত খরচ — New Entry Added';
  const detailParts: string[] = [];

  if (input.kind === 'Expense') {
    title = 'New Expense Added';
    if (amountText) detailParts.push(amountText);
    if (input.category) detailParts.push(input.category);
    if (input.date) detailParts.push(input.date);
  } else if (input.kind === 'Income') {
    title = 'New Income Added';
    if (amountText) detailParts.push(amountText);
    if (input.category) detailParts.push(input.category);
    if (input.date) detailParts.push(input.date);
  } else if (input.kind === 'Task') {
    title = 'New Task Entry Added';
    if (input.title) detailParts.push(input.title);
    if (amountText) detailParts.push(amountText);
    if (input.date) detailParts.push(input.time ? `${input.date} ${input.time}` : input.date);
  } else if (input.kind === 'Note') {
    title = 'New Note Added';
    if (input.title) detailParts.push(input.title);
    if (input.category) detailParts.push(input.category);
  } else if (input.kind === 'Category') {
    title = 'New Category Added';
    if (input.category) detailParts.push(input.category);
  }

  let body = detailParts.join(' • ');
  if (input.note && input.note.trim()) {
    body = body ? `${body} — ${input.note.trim()}` : input.note.trim();
  }
  if (!body) {
    body = 'Saved to হাত খরচ';
  }

  const tag = `entry_${input.kind.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return sendSystemNotification(title, {
    body,
    tag,
    requireInteraction: false,
    renotify: true,
    vibrate: [120, 60, 120],
    data: {
      url: '/',
      targetTab: input.targetTab || 'details',
      isEntryNotification: true
    }
  });
}

// Track notified tasks to avoid duplicate alarms within a time window
const NOTIFIED_KEY = 'app_notified_tasks_v2';

export function getNotifiedTaskMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function markTaskAsNotified(taskId: string, triggerKey: string) {
  try {
    const current = getNotifiedTaskMap();
    current[taskId] = triggerKey;
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(current));
  } catch {}
}

export function hasTaskBeenNotified(taskId: string, triggerKey: string): boolean {
  const current = getNotifiedTaskMap();
  return current[taskId] === triggerKey;
}

// Convert VAPID base64 string to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register Web Push subscription with server so phone wakes up when app is closed
export async function setupWebPushSubscription(forceRenew = false): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    let reg: ServiceWorkerRegistration | undefined;
    try {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    } catch {
      reg = await navigator.serviceWorker.ready;
    }

    if (!reg) return false;

    // Fetch server VAPID key
    const res = await fetch('/api/push/vapid-key');
    const data = await res.json();
    if (!data.publicKey) return false;

    let subscription = await reg.pushManager.getSubscription();

    if (subscription && forceRenew) {
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(data.publicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    if (subscription) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          clientTimezoneOffset: new Date().getTimezoneOffset(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      return true;
    }
  } catch (err) {
    console.warn('Web push setup error:', err);
  }
  return false;
}

// Sync active tasks to server background scheduler so alarm fires at exact time (e.g. 11:30) even with app closed
export async function syncTasksToPushServer(tasks: any[]): Promise<boolean> {
  if (typeof window === 'undefined' || !tasks) return false;

  try {
    const res = await fetch('/api/push/sync-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks,
        clientTimezoneOffset: new Date().getTimezoneOffset(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to sync tasks to push server:', err);
    return false;
  }
}

// Trigger an instant push test from server to test notification while app is closed
export async function triggerTestServerAlarm(): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    const res = await fetch('/api/push/test', { method: 'POST' });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

