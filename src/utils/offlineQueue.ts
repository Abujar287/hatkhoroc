import { fetchSheetApi, DIRECT_GOOGLE_SCRIPT_URL } from './sheetApi';

export interface PendingSyncItem {
  id: string;
  action: string;
  sheetTab: string;
  payload: any;
  createdAt: number;
}

const QUEUE_KEY = 'app_offline_sync_queue_v1';

/**
 * Get all pending offline items from queue
 */
export function getOfflineQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save pending offline item to queue
 */
export function addToOfflineQueue(item: Omit<PendingSyncItem, 'id' | 'createdAt'>): void {
  try {
    const queue = getOfflineQueue();
    const newItem: PendingSyncItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now()
    };
    queue.push(newItem);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log('[OFFLINE QUEUE] Saved pending sync item:', newItem.action, newItem.sheetTab);
  } catch (err) {
    console.warn('[OFFLINE QUEUE] Error saving queue item:', err);
  }
}

/**
 * Remove specific item from queue by ID
 */
export function removeFromOfflineQueue(id: string): void {
  try {
    const queue = getOfflineQueue().filter(i => i.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

/**
 * Process and flush all pending offline items to Google Sheets
 */
export async function processOfflineQueue(onSuccessToast?: (count: number) => void): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  console.log(`[OFFLINE QUEUE] Processing ${queue.length} pending items...`);
  let syncedCount = 0;

  for (const item of queue) {
    try {
      let isSynced = false;
      try {
        const res = await fetchSheetApi('/api/sheet-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(item.payload)
        });
        if (res.ok) {
          isSynced = true;
        }
      } catch (proxyErr) {
        console.warn(`[OFFLINE QUEUE] Proxy sync failed for ${item.action}, trying direct:`, proxyErr);
      }

      if (!isSynced) {
        const directRes = await fetch(DIRECT_GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(item.payload)
        });
        if (directRes.ok) {
          isSynced = true;
        }
      }

      if (isSynced) {
        removeFromOfflineQueue(item.id);
        syncedCount++;
      }
    } catch (err) {
      console.warn(`[OFFLINE QUEUE] Failed item ${item.action}, will retry later:`, err);
    }
  }

  if (syncedCount > 0 && onSuccessToast) {
    onSuccessToast(syncedCount);
  }

  return syncedCount;
}
