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

// Play alarm tune on mobile and desktop
export function playTaskAlarmSound(): () => void {
  try {
    // 1. Stop any currently running alarm
    stopTaskAlarmSound();

    // 2. Play via HTML5 Audio element (/alarm.wav) - essential for phone speaker
    try {
      if (!activeAudioElement) {
        activeAudioElement = new Audio('/alarm.wav');
      }
      activeAudioElement.currentTime = 0;
      activeAudioElement.volume = 1.0;
      activeAudioElement.loop = true;
      activeAudioElement.play().catch((err) => {
        console.warn('Audio element play restricted until touch:', err);
      });
    } catch (audioErr) {
      console.warn('Audio tag play error:', audioErr);
    }

    // 3. Also play via Web Audio synthesizer as layered loud bell
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!activeAudioContext) {
        activeAudioContext = new AudioCtx();
      }
      if (activeAudioContext.state === 'suspended') {
        activeAudioContext.resume().catch(() => {});
      }

      const ctx = activeAudioContext;
      const playChimePattern = () => {
        try {
          if (!ctx || ctx.state !== 'running') return;
          const now = ctx.currentTime;
          // Dual musical frequencies
          const freqs = [880, 1174, 1396, 1760];
          freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.09);

            gain.gain.setValueAtTime(0, now + idx * 0.09);
            gain.gain.linearRampToValueAtTime(0.4, now + idx * 0.09 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.22);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.09);
            osc.stop(now + idx * 0.09 + 0.25);
          });
        } catch {}
      };

      playChimePattern();
      activeAlarmInterval = window.setInterval(playChimePattern, 1200);
    }

    return stopTaskAlarmSound;
  } catch (err) {
    console.warn('Failed to play task alarm sound:', err);
    return () => {};
  }
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

// Trigger Web Vibration API (phone vibration)
export function vibrateDevice(pattern: number[] = [500, 200, 500, 200, 500, 200, 800]) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
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

// System Notification Trigger for Phone Notification Bar
export async function sendSystemNotification(title: string, options?: any): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: any = {
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [500, 200, 500, 200, 500, 200, 800],
    requireInteraction: true,
    renotify: true,
    tag: options?.tag || `task-${Date.now()}`,
    data: { url: '/?tab=task' },
    ...options
  };

  try {
    // 1. Try Service Worker registration (Primary method for Android & mobile notification bar)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notificationOptions);
          return true;
        }
      } catch (swReadyErr) {
        // Fallback to getRegistration
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, notificationOptions);
          return true;
        }
      }

      // Also message the service worker directly
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options: notificationOptions
        });
        return true;
      }
    }

    // 2. Desktop fallback to standard Notification
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

