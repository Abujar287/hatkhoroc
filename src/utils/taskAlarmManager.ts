// Task Alarm & Notification Manager
let activeAudioContext: AudioContext | null = null;
let activeAlarmInterval: number | null = null;

// Unlock AudioContext on first user interaction
export function initAudioUnlock() {
  if (typeof window === 'undefined') return;

  const unlock = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!activeAudioContext) {
        activeAudioContext = new AudioCtx();
      }
      if (activeAudioContext.state === 'suspended') {
        activeAudioContext.resume();
      }
    } catch (e) {
      console.warn('Audio unlock error:', e);
    }
  };

  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

// Play alarm tune (loud repeating chime/digital bell)
export function playTaskAlarmSound(): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return () => {};

    if (!activeAudioContext) {
      activeAudioContext = new AudioCtx();
    }
    if (activeAudioContext.state === 'suspended') {
      activeAudioContext.resume().catch(() => {});
    }

    const ctx = activeAudioContext;

    // Stop any previously playing alarm
    stopTaskAlarmSound();

    const playBeepPattern = () => {
      try {
        if (!ctx || ctx.state !== 'running') return;

        const now = ctx.currentTime;
        const frequencies = [880, 1046.5, 1318.5, 1760]; // Musical alarm tones (A5, C6, E6, A6)
        
        frequencies.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.2);
        });
      } catch {}
    };

    // Play immediately and loop every 1.2 seconds
    playBeepPattern();
    activeAlarmInterval = window.setInterval(playBeepPattern, 1200);

    return stopTaskAlarmSound;
  } catch (err) {
    console.warn('Failed to play task alarm sound:', err);
    return () => {};
  }
}

// Stop the currently ringing alarm sound
export function stopTaskAlarmSound() {
  if (activeAlarmInterval !== null) {
    clearInterval(activeAlarmInterval);
    activeAlarmInterval = null;
  }
}

// Trigger Web Vibration API
export function vibrateDevice(pattern: number[] = [300, 150, 300, 150, 500]) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

// System Notification Trigger
export async function sendSystemNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    // Try service worker notification first (better on mobile PWA)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          icon: '/logo.png',
          badge: '/logo.png',
          vibrate: [300, 150, 300],
          ...options
        } as any);
        return true;
      }
    }

    // Fallback to standard web notification
    new Notification(title, {
      icon: '/logo.png',
      badge: '/logo.png',
      ...options
    });
    return true;
  } catch (err) {
    console.warn('Notification error:', err);
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
