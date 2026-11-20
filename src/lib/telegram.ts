import {
  InvestmentRecord,
  InvestmentStatus,
  InvestmentWithdrawalRecord,
  SalaryDisbursementRecord,
  SalaryProgressStatus,
  TelegramSettings,
} from '../types';
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

export function getInvestmentStatusLabelBn(status?: InvestmentStatus | string): string {
  switch (status) {
    case 'active':
      return 'সক্রিয় অংশীদারিত্ব';
    case 'completed':
      return 'মেয়াদ সমাপ্ত';
    case 'refunded':
      return 'মূলধন ফেরত ও সমাপ্ত';
    case 'cancelled':
      return 'বাতিলকৃত';
    default:
      return 'সক্রিয়';
  }
}

export function getWithdrawalStatusLabelBn(status?: string): string {
  switch (status) {
    case 'approved':
      return 'অনুমোদিত (Approved)';
    case 'completed':
      return 'পরিশোধ সম্পন্ন (Completed)';
    case 'pending':
    default:
      return 'অপেক্ষমাণ (Pending)';
  }
}

function getWithdrawalTypeLabelBn(type?: string): string {
  switch (type) {
    case 'capital_full':
      return 'সম্পূর্ণ মূলধন প্রত্যাহার';
    case 'capital_partial':
      return 'আংশিক মূলধন উত্তোলন';
    case 'profit_monthly':
      return 'মাসিক লভ্যাংশ';
    case 'profit_annual':
      return 'বাৎসরিক মুনাফা';
    default:
      return 'উত্তোলন';
  }
}

function getInvestmentPaymentMethodLabelBn(method?: string): string {
  if (method === 'cheque') return 'চেক (Cheque)';
  return getPaymentMethodLabelBn(method);
}

export type InvestmentTelegramEvent =
  | 'created'
  | 'status_updated'
  | 'deleted'
  | 'blocked'
  | 'unblocked';

export async function sendInvestmentTelegramNotification(params: {
  event: InvestmentTelegramEvent;
  investment: InvestmentRecord;
  previousStatus?: InvestmentStatus | string;
  settings?: TelegramSettings | null;
  factoryName?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    const fallbackSettings = getCachedTelegramSettings();
    const effectiveSettings: TelegramSettings =
      params.settings && (params.settings.botToken || params.settings.chatId)
        ? params.settings
        : fallbackSettings;

    if (effectiveSettings.notifyOnInvestment === false) {
      return { ok: false, skipped: true };
    }

    const botToken = (effectiveSettings.botToken || '').trim();
    const chatId = (effectiveSettings.chatId || '').trim();
    if (!botToken || !chatId) {
      return { ok: false, skipped: true };
    }

    const { event, investment, previousStatus } = params;
    const factoryName = (params.factoryName || '').trim() || getCachedFactoryName();
    const currentStatusLabel =
      event === 'deleted'
        ? 'বাতিল ও অপসারিত (Deleted)'
        : event === 'blocked'
        ? 'সাময়িক ব্লকড (Blocked)'
        : event === 'unblocked'
        ? `সক্রিয় (আনব্লকড) — ${getInvestmentStatusLabelBn(investment.status)}`
        : getInvestmentStatusLabelBn(investment.status);

    const prevStatusLabel = previousStatus
      ? getInvestmentStatusLabelBn(previousStatus)
      : undefined;

    let titleLine = '📢 <b>ইনভেস্টমেন্ট আপডেট নোটিফিকেশন</b>';
    if (event === 'created') {
      titleLine = '🆕 <b>নতুন ইনভেস্টমেন্ট / বিনিয়োগ নিবন্ধন</b>';
    } else if (event === 'deleted' || investment.status === 'cancelled') {
      titleLine = '❌ <b>ইনভেস্টমেন্ট বাতিল / অপসারণ</b>';
    } else if (event === 'blocked') {
      titleLine = '⛔ <b>ইনভেস্টর অ্যাকাউন্ট ব্লক</b>';
    } else if (event === 'unblocked') {
      titleLine = '🔓 <b>ইনভেস্টর অ্যাকাউন্ট আনব্লক</b>';
    } else if (investment.status === 'refunded') {
      titleLine = '💸 <b>বিনিয়োগ মূলধন ফেরত ও সমাপ্ত</b>';
    } else if (investment.status === 'completed') {
      titleLine = '🏁 <b>বিনিয়োগ মেয়াদ সমাপ্ত</b>';
    } else if (event === 'status_updated') {
      titleLine = '🔄 <b>ইনভেস্টমেন্ট স্ট্যাটাস আপডেট</b>';
    }

    const statusIcon =
      event === 'deleted' || investment.status === 'cancelled'
        ? '❌'
        : event === 'blocked'
        ? '⛔'
        : investment.status === 'refunded'
        ? '💸'
        : investment.status === 'completed'
        ? '🏁'
        : '✅';

    const durationDisplay = investment.durationDays
      ? `${toBengaliNumber(investment.durationDays)} দিন (${toBengaliNumber(investment.profitRatePercent || 0)}% মুনাফা)`
      : `${toBengaliNumber(investment.durationMonths || 1)} মাস`;

    const lines: string[] = [
      titleLine,
      `🏭 <b>প্রতিষ্ঠান:</b> ${escapeTelegramHtml(factoryName)}`,
      ``,
      `👤 <b>বিনিয়োগকারী:</b> ${escapeTelegramHtml(investment.investorName || 'অজানা')}`,
      `📄 <b>চুক্তি নং:</b> <code>${escapeTelegramHtml(investment.agreementNo || investment.id)}</code>`,
      `📞 <b>মোবাইল:</b> ${escapeTelegramHtml(investment.investorMobile || '-')}`,
      `💰 <b>বিনিয়োগের পরিমাণ:</b> ৳${escapeTelegramHtml(formatMoney(investment.amount || 0))}`,
      `⏳ <b>মেয়াদ ও মুনাফা:</b> ${escapeTelegramHtml(durationDisplay)}`,
      `💳 <b>মাধ্যম:</b> ${escapeTelegramHtml(getInvestmentPaymentMethodLabelBn(investment.paymentMethod))}`,
    ];

    if (prevStatusLabel && event === 'status_updated' && prevStatusLabel !== currentStatusLabel) {
      lines.push(`🔄 <b>পূর্ববর্তী স্ট্যাটাস:</b> ${escapeTelegramHtml(prevStatusLabel)}`);
    }

    lines.push(`${statusIcon} <b>বর্তমান স্ট্যাটাস:</b> <b>${escapeTelegramHtml(currentStatusLabel)}</b>`);

    if (event === 'blocked' && investment.blockReason) {
      lines.push(`📝 <b>ব্লকের কারণ:</b> ${escapeTelegramHtml(investment.blockReason)}`);
    } else if (investment.refundAmount && investment.status === 'refunded') {
      lines.push(`💵 <b>ফেরতকৃত অর্থ:</b> ৳${escapeTelegramHtml(formatMoney(investment.refundAmount))}`);
    }

    if (investment.notes && investment.notes.trim()) {
      lines.push(`📝 <b>নোট:</b> ${escapeTelegramHtml(investment.notes.trim())}`);
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
          console.warn('Telegram investment notification error:', data.description);
          return { ok: false, error: data.description || 'Telegram API error' };
        }
        return { ok: true };
      } catch (err: any) {
        console.warn('Telegram investment notification network error:', err);
        return { ok: false, error: err?.message || 'Network error' };
      }
    });
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}

export async function sendInvestmentWithdrawalTelegramNotification(params: {
  event: 'created' | 'status_updated' | 'deleted';
  withdrawal: InvestmentWithdrawalRecord;
  previousStatus?: string;
  settings?: TelegramSettings | null;
  factoryName?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    const fallbackSettings = getCachedTelegramSettings();
    const effectiveSettings: TelegramSettings =
      params.settings && (params.settings.botToken || params.settings.chatId)
        ? params.settings
        : fallbackSettings;

    if (effectiveSettings.notifyOnInvestment === false) {
      return { ok: false, skipped: true };
    }

    const botToken = (effectiveSettings.botToken || '').trim();
    const chatId = (effectiveSettings.chatId || '').trim();
    if (!botToken || !chatId) {
      return { ok: false, skipped: true };
    }

    const { event, withdrawal, previousStatus } = params;
    const factoryName = (params.factoryName || '').trim() || getCachedFactoryName();
    const currentStatusLabel =
      event === 'deleted'
        ? 'বাতিল / মুছে ফেলা হয়েছে'
        : getWithdrawalStatusLabelBn(withdrawal.status);
    const prevStatusLabel = previousStatus
      ? getWithdrawalStatusLabelBn(previousStatus)
      : undefined;

    const titleLine =
      event === 'created'
        ? '📤 <b>নতুন বিনিয়োগ উত্তোলন আবেদন</b>'
        : event === 'deleted'
        ? '❌ <b>উত্তোলন রিকোয়েস্ট বাতিল / মুছে ফেলা</b>'
        : '🔄 <b>বিনিয়োগ উত্তোলন স্ট্যাটাস আপডেট</b>';

    const statusIcon =
      event === 'deleted'
        ? '❌'
        : withdrawal.status === 'completed'
        ? '✅'
        : withdrawal.status === 'approved'
        ? '👍'
        : '⏳';

    const lines: string[] = [
      titleLine,
      `🏭 <b>প্রতিষ্ঠান:</b> ${escapeTelegramHtml(factoryName)}`,
      ``,
      `👤 <b>বিনিয়োগকারী:</b> ${escapeTelegramHtml(withdrawal.investorName || 'অজানা')}`,
      `📄 <b>চুক্তি নং:</b> <code>${escapeTelegramHtml(withdrawal.agreementNo || '-')}</code>${withdrawal.voucherNo ? ` | <b>ভাউচার:</b> <code>${escapeTelegramHtml(withdrawal.voucherNo)}</code>` : ''}`,
      `📞 <b>মোবাইল:</b> ${escapeTelegramHtml(withdrawal.investorMobile || '-')}`,
      `🏷️ <b>ধরন:</b> ${escapeTelegramHtml(getWithdrawalTypeLabelBn(withdrawal.withdrawalType))}`,
      `💸 <b>উত্তোলনের পরিমাণ:</b> ৳${escapeTelegramHtml(formatMoney(withdrawal.amount || 0))}`,
      `💳 <b>মাধ্যম:</b> ${escapeTelegramHtml(getInvestmentPaymentMethodLabelBn(withdrawal.paymentMethod))}`,
    ];

    if (prevStatusLabel && event === 'status_updated' && prevStatusLabel !== currentStatusLabel) {
      lines.push(`🔄 <b>পূর্ববর্তী স্ট্যাটাস:</b> ${escapeTelegramHtml(prevStatusLabel)}`);
    }

    lines.push(`${statusIcon} <b>বর্তমান স্ট্যাটাস:</b> <b>${escapeTelegramHtml(currentStatusLabel)}</b>`);

    if (withdrawal.reasonOrNote && withdrawal.reasonOrNote.trim()) {
      lines.push(`📝 <b>বিবরণ:</b> ${escapeTelegramHtml(withdrawal.reasonOrNote.trim())}`);
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
          console.warn('Telegram withdrawal notification error:', data.description);
          return { ok: false, error: data.description || 'Telegram API error' };
        }
        return { ok: true };
      } catch (err: any) {
        console.warn('Telegram withdrawal notification network error:', err);
        return { ok: false, error: err?.message || 'Network error' };
      }
    });
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}


