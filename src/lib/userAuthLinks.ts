/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, InvestmentRecord } from '../types';

/**
 * Generates a unique, secure token for a worker's personal login portal.
 */
export function generateWorkerToken(workerId?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const cleanId = (workerId || 'tok').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `w_${timestamp}_${cleanId}_${random}`;
}

/**
 * Returns the individual dedicated login URL for a specific worker.
 * Every worker gets their own distinct personal login URL including their Worker ID
 * and their unique security access token.
 */
export function getWorkerLoginUrl(
  emp: { workerId: string; mobile?: string; portalToken?: string },
  customOrigin?: string
): string {
  if (!emp || !emp.workerId) return '';
  const origin = customOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams();
  params.set('portal', 'texwareworker');
  if (emp.mobile) {
    params.set('mobile', emp.mobile.trim());
  }
  params.set('workerId', emp.workerId.trim());
  if (emp.portalToken) {
    params.set('token', emp.portalToken.trim());
  }
  return `${origin}/texwareworker?${params.toString()}`;
}

/**
 * Returns the default password for a worker if no custom password is set.
 */
export function getWorkerDefaultPassword(emp: Partial<Employee>): string {
  if (emp.portalPassword && emp.portalPassword.trim()) {
    return emp.portalPassword.trim();
  }
  if (emp.mobile) {
    const digits = emp.mobile.replace(/[^0-9]/g, '');
    if (digits.length >= 4) {
      return digits.slice(-4);
    }
  }
  return '123456';
}

/**
 * Generates a complete Bangla text message containing the worker's personalized login credentials,
 * designed for WhatsApp, SMS, or direct clipboard copy.
 */
export function getWorkerCredentialsMessage(
  emp: Employee,
  customPassword?: string,
  factoryName: string = 'টেক্স ওয়ার অ্যাপারেলস'
): string {
  const loginUrl = getWorkerLoginUrl(emp);
  const password = customPassword || getWorkerDefaultPassword(emp);

  return `আসসালামু আলাইকুম ${emp.name},
${factoryName}-এ আপনার ব্যক্তিগত শ্রমিক অ্যাপ ও প্রোফাইল বিবরণ:

📱 আপনার শ্রমিক অ্যাপ লগইন লিংক:
${loginUrl}

📱 লগইন মোবাইল নম্বর: ${emp.mobile || 'নেই'}
🔑 পাসওয়ার্ড: ${password}
👤 Worker ID: ${emp.workerId} (অফিসিয়াল রেফারেন্স)

💡 অ্যাপ ব্যবহারের নিয়ম:
১. উপরের লিংকে যান এবং ক্রোম ব্রাউজারের ৩-ডট মেনু থেকে "Install app" বা "হোম স্ক্রিনে যোগ করুন" চাপ দিয়ে শ্রমিক অ্যাপটি আপনার মোবাইলে ডাউনলোড/ইনস্টল করে নিন।
২. আপনার নিবন্ধিত মোবাইল নম্বর এবং পাসওয়ার্ড দিয়ে লগইন করে প্রতিদিনের ইন-টাইম, আউট-টাইম, ওটি (OT), ছুটি এবং মাসিক বেতন বিবরণী দেখতে পারবেন (লগইন শুধুমাত্র মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে প্রযোজ্য, শ্রমিক আইডি দিয়ে লগইন করা যাবে না)।`;
}

/**
 * Returns individual dedicated login URL for an investor.
 */
export function getInvestorLoginUrl(
  inv: Partial<InvestmentRecord>,
  customOrigin?: string
): string {
  if (!inv) return '';
  const origin = customOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams();
  params.set('portal', 'texwareinvestment');
  if (inv.agreementNo) {
    params.set('agreementNo', inv.agreementNo.trim());
  } else if (inv.investorCode) {
    params.set('investorCode', inv.investorCode.trim());
  }
  return `${origin}/texwareinvestment?${params.toString()}`;
}
