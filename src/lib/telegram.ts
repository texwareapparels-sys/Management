import { SalaryDisbursementRecord, SalaryProgressStatus, TelegramSettings } from '../types';
import { formatMoney, toBengaliNumber } from './utils';

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

const LOCAL_TG_SETTINGS_KEY = 'texware_telegram_settings_v2';
const LOCAL_FACTORY_SETTINGS_KEY = 'texware_factory_settings_v1';

function escapeTelegramHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getSalaryProgressStatusLabel(
  progressStatus?: SalaryProgressStatus | string,
  paymentStatus?: string
): string {
  if (progressStatus === 'disbursed' || progressStatus === 'paid' || paymentStatus === 'paid') {
    return 'বেতন প্রদান করা সম্পূর্ণ';
  }
  if (progressStatus === 'ready') {
    return 'বেতন দেওয়ার জন্য প্রস্তুত';
  }
  if (progressStatus === 'calculated') {
    return 'হিসাব সম্পূর্ণ';
  }
  if (progressStatus === 'due' || progressStatus === 'calculating' || paymentStatus === 'due') {
    return 'বাকী';
  }
  if (paymentStatus === 'partial') {
    return 'আংশিক পরিশোধিত';
  }
  if (paymentStatus === 'pending') {
    return 'অপেক্ষমাণ (পেন্ডিং)';
  }
  return 'বাকী';
}

function getPaymentMethodLabelBn(method?: string): string {
  switch (method) {
    case 'bkash':
      return 'বিকাশ (bKash)';
    case 'nagad':
      return 'নগদ (Nagad)';
    case 'rocket':
      return 'রকেট (Rocket)';
    case 'bank':
      return 'ব্যাংক (Bank)';
    case 'cash':
    default:
      return 'ক্যাশ (নগদ)';
  }
}

function getCachedTelegramSettings(): TelegramSettings {
  try {
    if (typeof localStorage === 'undefined') return { botToken: '', chatId: '' };
    const raw = localStorage.getItem(LOCAL_TG_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { botToken: '', chatId: '' };
  } catch {
    return { botToken: '', chatId: '' };
  }
}

function getCachedFactoryName(): string {
  try {
    if (typeof localStorage === 'undefined') return 'টেক্স ওয়ার অ্যাপারেলস';
    const raw = localStorage.getItem(LOCAL_FACTORY_SETTINGS_KEY);
    if (!raw) return 'টেক্স ওয়ার অ্যাপারেলস';
    const parsed = JSON.parse(raw);
    return parsed?.name || 'টেক্স ওয়ার অ্যাপারেলস';
  } catch {
    return 'টেক্স ওয়ার অ্যাপারেলস';
  }
}

// Serialized async queue to pace bulk Telegram notifications safely under rate limits
let telegramSendQueue: Promise<unknown> = Promise.resolve();
let lastSendTimestamp = 0;

function enqueueTelegramSend<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    const elapsed = now - lastSendTimestamp;
    if (elapsed < 90) {
      await new Promise((resolve) => setTimeout(resolve, 90 - elapsed));
    }
    try {
      return await task();
    } finally {
      lastSendTimestamp = Date.now();
    }
  };
  const next = telegramSendQueue.then(run, run);
  telegramSendQueue = next.catch(() => undefined);
  return next;
}

export async function sendSalaryStatusTelegramNotification(params: {
  record: SalaryDisbursementRecord;
  previousStatus?: SalaryProgressStatus | string;
  settings?: TelegramSettings | null;
  factoryName?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    const fallbackSettings = getCachedTelegramSettings();
    const effectiveSettings: TelegramSettings =
      params.settings && (params.settings.botToken || params.settings.chatId)
        ? params.settings
        : fallbackSettings;

    if (effectiveSettings.notifyOnSalary === false) {
      return { ok: false, skipped: true };
    }

    const botToken = (effectiveSettings.botToken || '').trim();
    const chatId = (effectiveSettings.chatId || '').trim();
    if (!botToken || !chatId) {
      return { ok: false, skipped: true };
    }

    const { record, previousStatus } = params;
    const factoryName = (params.factoryName || '').trim() || getCachedFactoryName();
    const currentStatusLabel = getSalaryProgressStatusLabel(record.progressStatus, record.paymentStatus);
    const prevStatusLabel = previousStatus
      ? getSalaryProgressStatusLabel(previousStatus)
      : undefined;

    const netPayable = Number(record.netPayable || record.salary || 0);
    const paidAmount =
      record.paymentStatus === 'paid' || record.progressStatus === 'disbursed'
        ? netPayable
        : Number(record.paidAmount || 0);
    const dueAmount =
      record.paymentStatus === 'paid' || record.progressStatus === 'disbursed'
        ? 0
        : Math.max(0, netPayable - paidAmount);

    const statusIcon =
      record.progressStatus === 'disbursed' || record.paymentStatus === 'paid'
        ? '✅'
        : record.progressStatus === 'ready'
        ? '⏳'
        : record.progressStatus === 'calculated'
        ? '📋'
        : '⌛';

    const lines: string[] = [
      `📢 <b>শ্রমিক বেতন স্ট্যাটাস আপডেট</b>`,
      `🏭 <b>প্রতিষ্ঠান:</b> ${escapeTelegramHtml(factoryName)}`,
      ``,
      `👤 <b>শ্রমিকের নাম:</b> ${escapeTelegramHtml(record.employeeName || 'অজানা')}`,
      `🆔 <b>আইডি:</b> <code>${escapeTelegramHtml(record.workerId || record.employeeId || '-')}</code>${record.designation ? ` | <b>পদবি:</b> ${escapeTelegramHtml(record.designation)}` : ''}`,
      `📅 <b>বেতনের মাস:</b> ${escapeTelegramHtml(record.month)} ${escapeTelegramHtml(toBengaliNumber(record.year))}`,
    ];

    if (prevStatusLabel && prevStatusLabel !== currentStatusLabel) {
      lines.push(`🔄 <b>পূর্ববর্তী স্ট্যাটাস:</b> ${escapeTelegramHtml(prevStatusLabel)}`);
    }

    lines.push(
      `${statusIcon} <b>বর্তমান স্ট্যাটাস:</b> <b>${escapeTelegramHtml(currentStatusLabel)}</b>`,
      `💵 <b>নিট বেতন:</b> ৳${escapeTelegramHtml(formatMoney(netPayable))}`,
      `💰 <b>পরিশোধিত:</b> ৳${escapeTelegramHtml(formatMoney(paidAmount))} | <b>বকেয়া:</b> ৳${escapeTelegramHtml(formatMoney(dueAmount))}`,
      `💳 <b>মাধ্যম:</b> ${escapeTelegramHtml(getPaymentMethodLabelBn(record.paymentMethod))}`
    );

    if (record.note && record.note.trim()) {
      lines.push(`📝 <b>নোট:</b> ${escapeTelegramHtml(record.note.trim())}`);
    }

    lines.push(`🕒 <b>সময়:</b> ${escapeTelegramHtml(new Date().toLocaleString('bn-BD'))}`);

    const text = lines.join('\n');
    const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;

    return await enqueueTelegramSend(async () => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          console.warn('Telegram salary notification error:', data.description);
          return { ok: false, error: data.description || 'Telegram API error' };
        }
        return { ok: true };
      } catch (err: any) {
        console.warn('Telegram salary notification network error:', err);
        return { ok: false, error: err?.message || 'Network error' };
      }
    });
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}

