export const DIRECT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwdR3oDJiUFWFopvUeLI-8r92-9uS-jRUdRKFW3CghmmIy84sQZjNEeEkY6yboG8g4z/exec';

export const GOOGLE_SCRIPT_URL = DIRECT_GOOGLE_SCRIPT_URL;

/**
 * Universal helper that works on both Web Server and Android APK.
 * On Android APK (Capacitor/WebView), /api/sheet-proxy does not exist locally.
 * So this automatically uses direct Google Apps Script Web App URL!
 */
export async function fetchSheetApi(
  endpointOrQuery: string,
  options?: RequestInit
): Promise<Response> {
  const isNativeApp =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      window.location.protocol === 'capacitor:' ||
      (window.location.hostname === 'localhost' && window.location.port !== '3000'));

  let targetUrl = DIRECT_GOOGLE_SCRIPT_URL;

  if (!isNativeApp) {
    if (endpointOrQuery.startsWith('/api/sheet-proxy')) {
      targetUrl = endpointOrQuery;
    } else if (endpointOrQuery.startsWith('?')) {
      targetUrl = `/api/sheet-proxy${endpointOrQuery}`;
    } else {
      targetUrl = endpointOrQuery;
    }
  } else {
    if (endpointOrQuery.includes('?')) {
      const queryString = endpointOrQuery.split('?')[1];
      targetUrl = `${DIRECT_GOOGLE_SCRIPT_URL}?${queryString}`;
    }
  }

  let finalOptions = options || {};
  if (targetUrl.includes('script.google.com')) {
    if (options?.method === 'POST') {
      finalOptions = {
        ...options,
        headers: {
          ...(options?.headers || {}),
          'Content-Type': 'text/plain;charset=utf-8'
        }
      };
    } else {
      // For GET requests to direct Google Apps Script, strip Content-Type header to prevent CORS preflight blocks
      const { headers, ...rest } = options || {};
      const cleanHeaders: Record<string, string> = { ...(headers as any || {}) };
      delete cleanHeaders['Content-Type'];
      delete cleanHeaders['content-type'];
      finalOptions = {
        ...rest,
        headers: cleanHeaders
      };
    }
  }

  try {
    const res = await fetch(targetUrl, finalOptions);
    if (res.ok) return res;

    // Fallback to direct URL if web proxy returned non-ok error
    if (targetUrl !== DIRECT_GOOGLE_SCRIPT_URL) {
      const fallbackUrl = endpointOrQuery.includes('?')
        ? `${DIRECT_GOOGLE_SCRIPT_URL}?${endpointOrQuery.split('?')[1]}`
        : DIRECT_GOOGLE_SCRIPT_URL;
      return await fetch(fallbackUrl, finalOptions);
    }
    return res;
  } catch (err) {
    // Fallback to direct Google Apps Script URL if network error / 404 on proxy
    if (targetUrl !== DIRECT_GOOGLE_SCRIPT_URL) {
      const fallbackUrl = endpointOrQuery.includes('?')
        ? `${DIRECT_GOOGLE_SCRIPT_URL}?${endpointOrQuery.split('?')[1]}`
        : DIRECT_GOOGLE_SCRIPT_URL;
      return await fetch(fallbackUrl, finalOptions);
    }
    throw err;
  }
}
