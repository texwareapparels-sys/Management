export function formatMoney(val: number | string | undefined | null): string {
  const num = Number(val || 0);
  return num.toLocaleString('en-US');
}

export function toBengaliNumber(val: number | string): string {
  const banglaDigits: Record<string, string> = {
    '0': '০',
    '1': '১',
    '2': '২',
    '3': '৩',
    '4': '৪',
    '5': '৫',
    '6': '৬',
    '7': '৭',
    '8': '৮',
    '9': '৯',
  };
  return String(val).replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

export function toEnglishNumber(val: number | string | undefined | null): string {
  if (val === null || val === undefined) return '';
  const bnToEnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return String(val).replace(/[০-৯]/g, (d) => bnToEnMap[d] || d);
}

export function formatDateBn(dateStr?: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return {
        label: 'কর্মরত',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'resigned':
      return {
        label: 'পদত্যাগ / রিজাইনকৃত',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    case 'suspended':
      return {
        label: 'সাময়িক স্থগিত',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'terminated':
      return {
        label: 'অব্যাহতিপ্রাপ্ত',
        bg: 'bg-slate-100 text-slate-700 border-slate-300',
        dot: 'bg-slate-500',
      };
    default:
      return {
        label: 'কর্মরত',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
  }
}

export function numberToBengaliWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'শূন্য টাকা মাত্র';

  const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ',
    'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ'];
  const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];

  function convertBelowHundred(n: number): string {
    if (n < 20) return units[n];
    const t = Math.floor(n / 10);
    const u = n % 10;
    // Common Bengali compound words for 21-99
    const special: Record<number, string> = {
      21: 'একুশ', 22: 'বাইশ', 23: 'তেইশ', 24: 'চব্বিশ', 25: 'পঁচিশ', 26: 'ছাব্বিশ', 27: 'সাতাশ', 28: 'আঠাশ', 29: 'উনত্রিশ',
      31: 'একত্রিশ', 32: 'বত্রিশ', 33: 'তেত্রিশ', 34: 'চৌত্রিশ', 35: 'পঁয়ত্রিশ', 36: 'ছত্রিশ', 37: 'সাঁইত্রিশ', 38: 'আটত্রিশ', 39: 'উনচল্লিশ',
      41: 'একচল্লিশ', 42: 'বিয়াল্লিশ', 43: 'তেতাল্লিশ', 44: 'চুয়াল্লিশ', 45: 'পঁয়তাল্লিশ', 46: 'ছেচল্লিশ', 47: 'সাতচল্লিশ', 48: 'আটচল্লিশ', 49: 'উনপঞ্চাশ',
      51: 'একান্ন', 52: 'বায়ান্ন', 53: 'তিপ্পান্ন', 54: 'চুয়ান্ন', 55: 'পঞ্চান্ন', 56: 'ছাপ্পান্ন', 57: 'সাতান্ন', 58: 'আটান্ন', 59: 'উনষাট',
      61: 'একষট্টি', 62: 'বাষট্টি', 63: 'তেষট্টি', 64: 'চৌষট্টি', 65: 'পঁয়ষট্টি', 66: 'ছেষট্টি', 67: 'সাতষট্টি', 68: 'আটষট্টি', 69: 'উনসত্তর',
      71: 'একাত্তর', 72: 'বাহাত্তর', 73: 'তিয়াত্তর', 74: 'চুয়াত্তর', 75: 'পঁচাত্তর', 76: 'ছিয়াত্তর', 77: 'সাতাত্তর', 78: 'আটাত্তর', 79: 'উনআশি',
      81: 'একাশি', 82: 'বিরাশি', 83: 'তিরাশি', 84: 'চুরাশি', 85: 'পঁচাশি', 86: 'ছিয়াশি', 87: 'সাতাশি', 88: 'আটাশি', 89: 'উননব্বই',
      91: 'একানব্বই', 92: 'বানব্বই', 93: 'তিরানব্বই', 94: 'চুরানব্বই', 95: 'পঁচানব্বই', 96: 'ছিয়ানব্বই', 97: 'সাতানব্বই', 98: 'আটানব্বই', 99: 'নিরানব্বই'
    };
    if (special[n]) return special[n];
    return `${tens[t]} ${units[u]}`.trim();
  }

  function convertSection(n: number): string {
    const parts: string[] = [];
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const hundred = Math.floor(n / 100);
    const rem = n % 100;

    if (crore > 0) parts.push(`${convertSection(crore)} কোটি`);
    if (lakh > 0) parts.push(`${convertBelowHundred(lakh)} লক্ষ`);
    if (thousand > 0) parts.push(`${convertBelowHundred(thousand)} হাজার`);
    if (hundred > 0) parts.push(`${units[hundred]} শত`);
    if (rem > 0) parts.push(convertBelowHundred(rem));

    return parts.join(' ').trim();
  }

  const result = convertSection(Math.floor(num));
  return `${result} টাকা মাত্র`;
}
