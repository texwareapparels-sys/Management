declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        showConfirm?: (message: string, callback: (ok: boolean) => void) => void;
        showAlert?: (message: string, callback?: () => void) => void;
        initData?: string;
        initDataUnsafe?: any;
        isExpanded?: boolean;
      };
    };
    TelegramWebviewProxy?: any;
  }
}

/**
 * Detects if the web application is running inside a Telegram WebApp / in-app webview
 */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;

  const hasTgObject = Boolean(
    window.Telegram?.WebApp?.initData ||
    window.Telegram?.WebApp?.initDataUnsafe?.query_id ||
    window.Telegram?.WebApp?.openLink
  );

  const hasTgProxy = typeof window.TelegramWebviewProxy !== 'undefined';
  const hasTgUserAgent = typeof navigator !== 'undefined' && /Telegram/i.test(navigator.userAgent);

  return hasTgObject || hasTgProxy || hasTgUserAgent;
}

/**
 * Initializes Telegram WebApp settings: expands viewport and signals readiness
 */
export function initTelegramWebApp(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  } catch (e) {
    console.warn('Failed to init Telegram WebApp:', e);
  }
}

/**
 * Opens a URL in the phone's native external browser (Chrome / Safari)
 * This allows system printing, downloading files, and accessing camera/hardware
 * that might be restricted inside Telegram's embedded webview.
 */
export function openInExternalBrowser(targetUrl?: string): void {
  if (typeof window === 'undefined') return;
  const url = targetUrl || window.location.href;

  try {
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
      return;
    }
  } catch (e) {
    console.warn('Telegram openLink error, falling back to window.open:', e);
  }

  try {
    window.open(url, '_blank');
  } catch (e) {
    window.location.href = url;
  }
}

/**
 * Opens Telegram share dialog
 */
export function shareViaTelegram(text: string, url?: string): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url || window.location.href)}&text=${encodeURIComponent(text)}`;
  openInExternalBrowser(shareUrl);
}
