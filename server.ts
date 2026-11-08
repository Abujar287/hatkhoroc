import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import fs from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const webpush = require('web-push');

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const portArgIndex = process.argv.indexOf('--port');
if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
  const parsedPort = parseInt(process.argv[portArgIndex + 1], 10);
  if (!isNaN(parsedPort)) {
    port = parsedPort;
  }
}

async function startServer() {
  console.log('Starting server...');
  const app = express();
  app.use(express.json());

  // Serve static assets from public folder
  app.use(express.static(path.resolve(__dirname, 'public')));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Google Sheets Proxy
  const GOOGLE_SCRIPT_TARGET = process.env.VITE_GOOGLE_SCRIPT_URL ||
    'https://script.google.com/macros/s/AKfycbwdR3oDJiUFWFopvUeLI-8r92-9uS-jRUdRKFW3CghmmIy84sQZjNEeEkY6yboG8g4z/exec';

  app.all('/api/sheet-proxy', async (req, res) => {
    try {
      if (req.method === 'POST') {
        const response = await fetch(GOOGLE_SCRIPT_TARGET, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(req.body)
        });
        const text = await response.text();
        try {
          return res.json(JSON.parse(text));
        } catch {
          return res.send(text);
        }
      } else {
        const queryString = new URLSearchParams(req.query as any).toString();
        const url = queryString ? `${GOOGLE_SCRIPT_TARGET}?${queryString}` : GOOGLE_SCRIPT_TARGET;
        const response = await fetch(url);
        const text = await response.text();
        try {
          return res.json(JSON.parse(text));
        } catch {
          return res.send(text);
        }
      }
    } catch (error: any) {
      console.error('Sheet proxy error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --------------------------------------------------------------------------
  // WEB PUSH & BACKGROUND ALARM SCHEDULER
  // (Wakes up mobile device / status bar even when app & browser are closed)
  // --------------------------------------------------------------------------
  const VAPID_FILE = path.resolve(__dirname, 'vapid-keys.json');
  const SUBSCRIPTIONS_FILE = path.resolve(__dirname, 'push-subscriptions.json');
  const TASKS_FILE = path.resolve(__dirname, 'push-scheduled-tasks.json');

  let vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BDbWP_SNIwkRyPQX-aH4-zk--_JdeqaUUf4itd4dD19rgCqoxu_biiD5D_IeC4cIQtmW0i1LJXDwFKIMngxIoTs',
    privateKey: process.env.VAPID_PRIVATE_KEY || '2BVlEpKbwvOAi98N9bw5GylYNBVNddM4jSeq_7y0ryc'
  };

  try {
    const rawVapid = await fs.readFile(VAPID_FILE, 'utf-8');
    const parsed = JSON.parse(rawVapid);
    if (parsed.publicKey && parsed.privateKey) {
      vapidKeys = parsed;
    }
  } catch {
    await fs.writeFile(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf-8').catch(() => {});
  }

  try {
    webpush.setVapidDetails(
      'mailto:support@hisabkitab.app',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (err) {
    console.warn('Failed to set VAPID details:', err);
  }

  let pushSubscriptions: Array<{
    subscription: any;
    clientTimezoneOffset: number;
    timezone?: string;
    updatedAt: string;
  }> = [];

  let scheduledTasks: Array<{
    id: string;
    title: string;
    dueDate: string;
    dueTime?: string;
    amount: number;
    status: string;
    autoNotify?: boolean;
    clientTimezoneOffset?: number;
    timezone?: string;
  }> = [];

  const notifiedKeysSet = new Set<string>();

  // Load existing subscriptions from disk
  try {
    const rawSubs = await fs.readFile(SUBSCRIPTIONS_FILE, 'utf-8');
    pushSubscriptions = JSON.parse(rawSubs);
  } catch {}

  // Load existing tasks from disk
  try {
    const rawTasks = await fs.readFile(TASKS_FILE, 'utf-8');
    scheduledTasks = JSON.parse(rawTasks);
  } catch {}

  async function persistSubscriptions() {
    try {
      await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(pushSubscriptions, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to persist push subscriptions:', err);
    }
  }

  async function persistTasks() {
    try {
      await fs.writeFile(TASKS_FILE, JSON.stringify(scheduledTasks, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to persist scheduled tasks:', err);
    }
  }

  // 1. Get VAPID public key
  app.get('/api/push/vapid-key', (_req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  // 2. Subscribe endpoint
  app.post('/api/push/subscribe', async (req, res) => {
    try {
      const { subscription, clientTimezoneOffset, timezone } = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
      }

      const offset = typeof clientTimezoneOffset === 'number' ? clientTimezoneOffset : 0;
      const index = pushSubscriptions.findIndex(s => s.subscription?.endpoint === subscription.endpoint);
      const newEntry = {
        subscription,
        clientTimezoneOffset: offset,
        timezone: timezone || 'UTC',
        updatedAt: new Date().toISOString()
      };

      if (index >= 0) {
        pushSubscriptions[index] = newEntry;
      } else {
        pushSubscriptions.push(newEntry);
      }

      await persistSubscriptions();
      console.log(`Registered push subscription. Total active: ${pushSubscriptions.length}`);
      res.json({ success: true, total: pushSubscriptions.length });
    } catch (error: any) {
      console.error('Subscription error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Sync client tasks to server scheduler
  app.post('/api/push/sync-tasks', async (req, res) => {
    try {
      const { tasks, clientTimezoneOffset, timezone } = req.body;
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Tasks must be an array' });
      }

      const offset = typeof clientTimezoneOffset === 'number' ? clientTimezoneOffset : -360; // Default GMT+6

      scheduledTasks = tasks.map((t: any) => ({
        id: t.id,
        title: t.title || 'টাস্ক রিমাইন্ডার',
        dueDate: t.dueDate,
        dueTime: t.dueTime || '09:00',
        amount: Number(t.amount) || 0,
        status: t.status || 'pending',
        autoNotify: t.autoNotify !== false,
        clientTimezoneOffset: offset,
        timezone: timezone || 'Asia/Dhaka'
      }));

      await persistTasks();
      res.json({ success: true, count: scheduledTasks.length });
    } catch (error: any) {
      console.error('Sync tasks error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Test notification endpoint
  app.post('/api/push/test', async (_req, res) => {
    if (pushSubscriptions.length === 0) {
      return res.status(400).json({ error: 'No active push subscriptions' });
    }
    const payload = JSON.stringify({
      title: '🚨 হাত খরচ - টেস্ট অ্যালার্ম',
      body: 'অ্যালার্ম ও নোটিফিকেশন সিস্টেম অ্যাপ বন্ধ থাকলেও সফলভাবে কাজ করছে!',
      tag: 'test-alarm',
      url: '/?tab=task'
    });

    let sent = 0;
    for (const subItem of pushSubscriptions) {
      try {
        await webpush.sendNotification(subItem.subscription, payload);
        sent++;
      } catch (e) {
        console.warn('Test push failed for an endpoint:', e);
      }
    }
    res.json({ success: true, sent });
  });

  // Format 12-hour time on server
  function formatTime12hServer(time24: string): string {
    if (!time24) return '';
    const parts = time24.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  // Server-Side Alarm Checking Loop
  // Evaluates every 15 seconds if any scheduled task is due in user's timezone
  const alarmInterval = setInterval(async () => {
    try {
      if (pushSubscriptions.length === 0 || scheduledTasks.length === 0) return;

      for (const task of scheduledTasks) {
        if (task.status !== 'pending' || task.autoNotify === false) continue;
        if (!task.dueDate) continue;

        // Determine client local time
        // getTimezoneOffset() is in minutes: local = UTC - offsetMinutes
        const offsetMinutes = typeof task.clientTimezoneOffset === 'number' ? task.clientTimezoneOffset : -360;
        const nowUtc = Date.now();
        const clientTimeEpoch = nowUtc - (offsetMinutes * 60 * 1000);
        const clientDate = new Date(clientTimeEpoch);

        const y = clientDate.getUTCFullYear();
        const m = String(clientDate.getUTCMonth() + 1).padStart(2, '0');
        const d = String(clientDate.getUTCDate()).padStart(2, '0');
        const clientDateStr = `${y}-${m}-${d}`;

        const clientHours = String(clientDate.getUTCHours()).padStart(2, '0');
        const clientMinutes = String(clientDate.getUTCMinutes()).padStart(2, '0');
        const clientTimeStr = `${clientHours}:${clientMinutes}`;

        const isDueToday = task.dueDate === clientDateStr;
        const isOverdue = task.dueDate < clientDateStr;
        const taskDueTime = task.dueTime || '09:00';

        const isTimeToRing = isOverdue || (isDueToday && clientTimeStr >= taskDueTime);

        if (isTimeToRing) {
          const triggerKey = `${task.id}_${clientDateStr}`;
          if (!notifiedKeysSet.has(triggerKey)) {
            notifiedKeysSet.add(triggerKey);
            console.log(`[ALARM SCHEDULER] Triggering scheduled alarm for task: "${task.title}" (Due: ${task.dueDate} ${task.dueTime})`);

            const timeFormatted = task.dueTime ? formatTime12hServer(task.dueTime) : '';
            const pushPayload = JSON.stringify({
              title: `🚨 বকেয়া বিল/টাস্ক: ${task.title}`,
              body: `পরিমাণ: ${task.amount.toLocaleString()} | তারিখ: ${task.dueDate} ${timeFormatted ? '(' + timeFormatted + ')' : ''}`,
              tag: `task-alarm-${task.id}`,
              taskId: task.id,
              url: `/?tab=task&ringTask=${task.id}`
            });

            const expiredEndpoints: string[] = [];

            for (const subItem of pushSubscriptions) {
              try {
                await webpush.sendNotification(subItem.subscription, pushPayload);
              } catch (err: any) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                  // Subscription has expired or was unsubscribed
                  expiredEndpoints.push(subItem.subscription.endpoint);
                } else {
                  console.warn('Error sending web push:', err.message);
                }
              }
            }

            if (expiredEndpoints.length > 0) {
              pushSubscriptions = pushSubscriptions.filter(
                s => !expiredEndpoints.includes(s.subscription.endpoint)
              );
              await persistSubscriptions();
            }
          }
        }
      }
    } catch (err) {
      console.warn('Alarm interval error:', err);
    }
  }, 15000);

  app.post('/api/gemini', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const { model, contents, config } = req.body;
      const response = await ai.models.generateContent({
        model: model || 'gemini-2.5-flash',
        contents,
        config
      });
      res.json(response);
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null
      },
      appType: 'custom',
    });

    // Provide a comprehensive Vite client mock to satisfy HMR imports and inject CSS
    app.get('/@vite/client', (req, res) => {
      res.type('application/javascript').send(`
        export const createHotContext = (ownerPath) => ({
          accept: (deps, callback) => {},
          dispose: (callback) => {},
          decline: () => {},
          invalidate: () => {},
          on: (event, callback) => {},
          send: (event, data) => {},
          prune: (callback) => {},
          data: {}
        });
        export const updateStyle = (id, content) => {
          if (typeof document === 'undefined') return;
          let style = document.getElementById(id);
          if (!style) {
            style = document.createElement('style');
            style.id = id;
            style.setAttribute('type', 'text/css');
            document.head.appendChild(style);
          }
          style.textContent = content;
        };
        export const removeStyle = (id) => {
          if (typeof document === 'undefined') return;
          const style = document.getElementById(id);
          if (style) style.remove();
        };
        export const injectQuery = (url) => url;
        export default { createHotContext, updateStyle, removeStyle, injectQuery };
      `);
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      try {
        let template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server started at http://0.0.0.0:${port}`);
  });

  const shutdown = () => {
    clearInterval(alarmInterval);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(console.error);
