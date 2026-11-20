export type EmploymentStatus = 'active' | 'resigned' | 'suspended' | 'terminated';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday';

export interface AttendanceRecord {
  id: string; // unique ID or att_{empId}_{date}
  employeeId: string;
  workerId: string;
  employeeName: string;
  department?: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  inTime?: string; // HH:mm e.g. "08:15"
  outTime?: string; // HH:mm e.g. "17:30"
  shiftStart?: string; // HH:mm e.g. "08:00"
  shiftEnd?: string; // HH:mm e.g. "17:00"
  isLate?: boolean;
  lateMinutes?: number;
  otHours?: number; // hours beyond shiftEnd
  note?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ShiftSettings {
  standardInTime: string; // e.g. "08:00"
  standardOutTime: string; // e.g. "17:00"
  graceMinutes: number; // e.g. 15
  standardHours: number; // e.g. 8
  updatedAt?: number;
}

export interface EmployeeAttendanceStats {
  totalRecords: number;
  totalOfficeDays?: number; // কারখানার মাসিক অফিস ডে / কর্মদিবস (স্ট্যান্ডার্ড ২৬ দিন)
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  leaveCount: number;
  fridayOtHours?: number; // শুক্রবারের ওটি ঘণ্টা (কোনো সাধারণ হাজিরা যোগ হবে না)
  regularOtHours?: number; // সাধারণ কার্যদিবসের ওটি ঘণ্টা
  fridayDutiesCount?: number; // শুক্রবার ওটি ডিউটি করার দিনের সংখ্যা
  totalOtHours: number;
  attendanceRate: number; // percentage (0-100)
}

export interface Employee {
  id: string; // Firebase key or local UUID
  name: string;
  workerId: string;
  designation: string;
  department?: string;
  salary: number;
  otRate: number;
  nid?: string;
  mobile?: string;
  address?: string;
  joinDate?: string;
  birthDate?: string;
  photoUrl?: string;
  signatureUrl?: string; // শ্রমিকের ডিজিটাল স্বাক্ষর (চুক্তিপত্র, বরখাস্ত, পদত্যাগ নথির জন্য)
  portalPassword?: string; // শ্রমিকের ব্যক্তিগত প্রোফাইল লগইন পাসওয়ার্ড (ডিফল্ট: মোবাইলের শেষ ৪ সংখ্যা বা ১২৩৪৫৬)
  // Bank details for salary disbursement & contract letter
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  bankBranch?: string;
  // Status tracking: active | resigned | suspended | terminated
  status: EmploymentStatus;
  resignationDate?: string;
  resignationReason?: string;
  noticeServed?: 'yes' | 'no' | 'partial';
  clearanceDone?: boolean;
  finalSettlementPaid?: boolean;
  finalSettlementNote?: string;
  // Suspension tracking
  suspensionDate?: string;
  suspensionReason?: string;
  suspensionDuration?: string;
  // Termination tracking
  terminationDate?: string;
  terminationReason?: string;
  terminationMemo?: string;
  // Block tracking: Admin can block / unblock worker profile with specific reason
  isBlocked?: boolean;
  blockReason?: string;
  blockedAt?: number;
  // Worker Account Link Security & Regeneration: Admin can change / invalidate / disable worker links
  portalToken?: string; // শ্রমিকের ইউনিক অ্যাক্সেস টোকেন (অ্যাডমিন লিংক পরিবর্তন করলে পুরাতন লিংক বাতিল হয়ে যাবে)
  portalLinkEnabled?: boolean; // অ্যাডমিন থেকে লিংক অন/অফ (চাকরি না করলে লিংক সম্পূর্ণ বন্ধ রাখা যাবে)
  portalLinkChangedAt?: number; // লিংক পরিবর্তনের শেষ তারিখ
  // Worker Self Profile Updates (Once per month)
  lastProfileUpdateMonth?: string; // e.g. "2026-10", প্রতি মাসে একবার পরিবর্তন নীতি
  lastProfileUpdatedAt?: number; // শেষ পরিবর্তনের সময়
  // General status change audit
  statusChangedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface SalaryCalculation {
  employee: Employee;
  month: string;
  year: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays?: number;
  absentPenaltyDays?: number; // কারখানার নিয়ম: প্রতি ৩ দিন অনুপস্থিতিতে অতিরিক্ত ১ দিন কর্তন
  latePenaltyDays?: number;   // কারখানার নিয়ম: প্রতি ৩ দিন লেটে ১ দিন কর্তন
  effectivePresentDays?: number; // মূল বেতনযোগ্য দিন
  salary: number;
  presentSalary: number;
  otHours: number;
  otRate: number;
  otPay: number;
  bonus: number;
  advance: number;
  deduction: number;
  deductionReason: string;
  isResignationSettlement?: boolean;
  isNewJoinerMidMonth?: boolean; // নতুন কর্মী খণ্ডিত মাসে যোগদান (শুধু হাজিরা প্রদেয়, কোনো কর্তন নেই)
  newJoinerNote?: string;
  finalSalary: number;
  calculatedAt: number;
}

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'bank';

export type SalaryProgressStatus =
  | 'due'         // বাকী
  | 'calculating' // বাকী (পূর্বে হিসাব চলমান)
  | 'calculated'  // হিসাব সম্পূর্ণ
  | 'ready'       // বেতন দেওয়ার জন্য প্রস্তুত
  | 'disbursed';  // বেতন প্রদান করা সম্পূর্ণ

export interface SalaryDisbursementRecord {
  id: string; // record ID
  employeeId: string;
  employeeName: string;
  workerId: string;
  designation: string;
  department?: string;
  month: string;
  year: number;
  salary: number;
  presentDays: number;
  totalDays: number;
  absentDays?: number;
  lateDays?: number;
  absentPenaltyDays?: number;
  latePenaltyDays?: number;
  effectivePresentDays?: number;
  isNewJoinerMidMonth?: boolean; // নতুন কর্মী খণ্ডিত মাসে যোগদান
  presentSalary: number;
  otHours: number;
  otRate: number;
  otPay: number;
  bonus: number;
  advance: number;
  deduction: number;
  deductionReason?: string;
  netPayable: number; // total calculated
  paidAmount: number; // amount disbursed
  dueAmount: number; // বকেয়া
  paymentMethod: PaymentMethod; // ক্যাশ / বিকাশ / নগদ / ব্যাংক
  paymentStatus: 'paid' | 'partial' | 'due' | 'pending';
  progressStatus?: SalaryProgressStatus; // হিসাব চলমান | হিসাব সম্পূর্ণ | প্রস্তুত | প্রদান সম্পূর্ণ
  statusUpdatedAt?: number; // তারিখ অনুযায়ী স্ট্যাটাস আপডেটের সময়
  statusUpdatedDate?: string; // YYYY-MM-DD
  paidAt: number;
  note?: string;
}

export type NoticeTargetType = 'all' | 'individual';
export type NoticePriority = 'normal' | 'important' | 'urgent';
export type NoticeCategory = 'general' | 'salary' | 'holiday' | 'warning' | 'appreciation' | 'leave' | 'overtime' | 'shift' | 'discipline' | 'urgent';

export interface NoticeConfirmation {
  employeeId: string;
  workerId?: string;
  workerName?: string;
  confirmedAt: number;
}

export interface WorkerNotice {
  id: string;
  title: string;
  message: string;
  targetType: NoticeTargetType; // 'all' বা 'individual'
  targetEmployeeId?: string;
  targetWorkerId?: string;
  targetEmployeeName?: string;
  category: NoticeCategory;
  priority: NoticePriority;
  createdBy?: string;
  createdAt: number;
  publishedDate: string; // YYYY-MM-DD
  readBy?: string[];
  confirmations?: NoticeConfirmation[];
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  notifyOnResignation?: boolean;
  notifyOnSalary?: boolean;
  notifyOnInvestment?: boolean;
  updatedAt?: number;
}

export interface SMSSettings {
  apiUrl: string;
  apiKey: string;
  senderId: string;
  method: 'GET' | 'POST';
  keyParam: string;
  mobileParam: string;
  messageParam: string;
  senderParam: string;
  updatedAt?: number;
}

export interface FactorySettings {
  name: string;
  nameEn?: string;
  address: string;
  phone: string;
  email?: string;
  contractRules?: string[];
  contractDeclaration?: string;
  updatedAt?: number;
}

export type JobApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface JobApplication {
  id: string; // Unique ID (e.g. app_1728512345678)
  applicationNo: string; // Serial/Tracking No (e.g. TW-APP-2026-001)
  status: JobApplicationStatus;

  // Applicant Personal Information (NID অনুযায়ী)
  name: string; // আবেদনকারীর নাম (বাংলা)
  nameEn?: string; // Applicant Name (English)
  fatherName: string; // পিতার নাম
  motherName: string; // মাতার নাম
  nid: string; // জাতীয় পরিচয়পত্র (NID) বা জন্ম নিবন্ধন নম্বর
  birthDate: string; // জন্ম তারিখ (YYYY-MM-DD)
  age?: number | string; // বয়স
  gender: 'male' | 'female' | 'other'; // লিঙ্গ
  maritalStatus?: 'unmarried' | 'married' | 'divorced' | 'widowed'; // বৈবাহিক অবস্থা
  bloodGroup?: string; // রক্তের গ্রুপ
  mobile: string; // মোবাইল নম্বর
  altMobile?: string; // বিকল্প মোবাইল নম্বর

  // Address
  presentAddress: string; // বর্তমান ঠিকানা
  permanentAddress: string; // স্থায়ী ঠিকানা

  // Job & Qualifications
  appliedDesignation: string; // আবেদনকৃত পদ (সুইং অপারেটর, কোয়ালিটি, হেল্পার, ইত্যাদি)
  department?: string; // পছন্দনীয় সেকশন
  expectedSalary?: number; // প্রত্যাশিত বেতন (মাসিক)
  experience?: string; // কাজের অভিজ্ঞতা
  education?: string; // শিক্ষাগত যোগ্যতা

  // Photo & Signature
  photoUrl?: string; // শ্রমিকের পাসপোর্ট সাইজ ছবি
  signatureUrl?: string; // শ্রমিকের ডিজিটাল স্বাক্ষর

  // Guardian / Nominee Information (অভিভাবকের সকল তথ্য ও ছবি)
  guardianName: string; // অভিভাবকের নাম
  guardianRelation: string; // সম্পর্ক (পিতা/মাতা/স্বামী/স্ত্রী/ভাই/বোন ইত্যাদি)
  guardianNid?: string; // অভিভাবকের জাতীয় পরিচয়পত্র নম্বর
  guardianMobile: string; // অভিভাবকের মোবাইল নম্বর
  guardianAddress?: string; // অভিভাবকের ঠিকানা
  guardianPhotoUrl?: string; // অভিভাবকের ছবি (Guardian Photo)

  // Bank Account (Optional)
  bankName?: string;
  accountNumber?: string;

  // Review & Decision Data
  rejectionReason?: string; // বাতিলের সুনির্দিষ্ট কারণ
  rejectionNote?: string; // বিস্তারিত মন্তব্য
  rejectedAt?: number;
  approvedWorkerId?: string; // যদি গ্রহণ করা হয়, কোন Worker ID বরাদ্দ দেওয়া হয়েছে
  approvedSalary?: number; // অনুমোদিত চূড়ান্ত বেতন
  approvedAt?: number;

  createdAt: number;
  updatedAt?: number;
}

export type InvestmentStatus = 'active' | 'completed' | 'refunded' | 'cancelled';
export type ProfitPayoutType = 'monthly' | 'quarterly' | 'yearly' | 'tenure_end';

export interface InvestmentRecord {
  id: string; // Unique ID (e.g. inv_1728512345678)
  agreementNo: string; // Agreement / Registration No (e.g. TW-INV-2026-001)
  
  // Investor Personal Info
  investorName: string; // বিনিয়োগকারীর নাম
  investorFatherOrSpouse: string; // পিতা / স্বামীর নাম
  investorNid: string; // জাতীয় পরিচয়পত্র (NID) নম্বর
  investorMobile: string; // মোবাইল নম্বর
  investorAltMobile?: string; // বিকল্প মোবাইল নম্বর
  investorEmail?: string; // ইমেইল (ঐচ্ছিক)
  investorPresentAddress: string; // বর্তমান ঠিকানা
  investorPermanentAddress: string; // স্থায়ী ঠিকানা
  investorPhotoUrl?: string; // বিনিয়োগকারীর ছবি
  investorSignatureUrl?: string; // ডিজিটাল স্বাক্ষর

  // Nominee Info
  nomineeName: string; // নমিনির নাম
  nomineeRelation: string; // সম্পর্ক (স্ত্রী/পুত্র/মাতা ইত্যাদি)
  nomineeNid?: string; // নমিনির এনআইডি
  nomineeMobile?: string; // নমিনির মোবাইল
  nomineeAddress?: string; // নমিনির ঠিকানা
  nomineePhotoUrl?: string; // নমিনির ছবি

  // Financial & Agreement Terms
  amount: number; // বিনিয়োগকৃত টাকার অঙ্ক (মিনিমাম ১,০০০ টাকা থেকে শুরু)
  investmentDate: string; // বিনিয়োগের তারিখ (YYYY-MM-DD)
  durationMonths: number; // মেয়াদ (মাসে, যেমন ১, ২, ৩ বা পুরাতন হিসাব)
  durationDays?: number; // নির্দিষ্ট মেয়াদ দিনে: ৭, ১৫, ৩০, ৬০, ৯০, ১২০ দিন
  profitRatePercent?: number; // প্রস্তাবিত মুনাফা বা শতকরা হার (%)
  profitPayout: ProfitPayoutType; // দৈনিক / মাসিক / ত্রৈমাসিক / বাৎসরিক / মেয়াদ শেষে
  paymentMethod: PaymentMethod | 'cheque'; // ক্যাশ / ব্যাংক ট্রান্সফার / চেক / বিকাশ / নগদ
  bankName?: string; // ব্যাংকের নাম (যদি থাকে)
  chequeOrTxnNo?: string; // চেক বা ট্রানজেকশন নম্বর

  // Daily Profit Claim Tracking (২৪ ঘন্টায় ১ বার ক্লেম)
  lastProfitClaimedAt?: number; // সর্বশেষ মুনাফা ক্লেমের টাইমস্ট্যাম্প
  totalProfitClaimed?: number; // এ যাবত মোট ক্লেমকৃত মুনাফা (টাকা)
  claimedDaysCount?: number; // মোট কত দিন মুনাফা ক্লেম করা হয়েছে
  profitClaimHistory?: ProfitClaimEntry[]; // প্রতি ক্লেমের বিবরণ ও তারিখ

  // Witnesses & Legal
  witnessName?: string; // ১ম সাক্ষীর নাম
  witnessMobile?: string; // সাক্ষীর মোবাইল
  witnessAddress?: string; // সাক্ষীর ঠিকানা

  status: InvestmentStatus; // সক্রিয় / সমাপ্ত / ফেরত প্রদানকৃত / বাতিল
  notes?: string; // অতিরিক্ত শর্ত বা মন্তব্য
  refundDate?: string; // মূলধন ফেরত দেওয়ার তারিখ (যদি দেওয়া হয়ে থাকে)
  refundAmount?: number; // ফেরতকৃত অর্থ
  refundNote?: string;

  // Investor Portal Authentication & Security
  portalPassword?: string; // বিনিয়োগকারীর নিজস্ব পোর্টাল পাসওয়ার্ড
  investorCode?: string; // ইউনিক কোড যেমন INV-001
  isBlocked?: boolean; // অ্যাডমিন থেকে অ্যাকাউন্ট ব্লক কিনা
  blockReason?: string; // ব্লক করার সুনির্দিষ্ট কারণ
  blockedAt?: number; // ব্লক করার সময়

  createdAt: number;
  updatedAt?: number;
}

export interface InvestmentPlanTier {
  days: number;
  ratePercent: number; // ৭ দিনে ২%, ১৫ দিনে ৪%, ৩০ দিনে ৬%, ৬০ দিনে ৯%, ৯০ দিনে ১১%, ১২০ দিনে ১৩%
  labelBn: string;
}

export const MINIMUM_INVESTMENT_AMOUNT = 1000; // নূন্যতম ১,০০০ টাকা ডিপোজিট

export const INVESTMENT_PLANS: InvestmentPlanTier[] = [
  { days: 7, ratePercent: 2, labelBn: '৭ দিন (২% মুনাফা)' },
  { days: 15, ratePercent: 4, labelBn: '১৫ দিন (৪% মুনাফা)' },
  { days: 30, ratePercent: 6, labelBn: '৩০ দিন (৬% মুনাফা)' },
  { days: 60, ratePercent: 9, labelBn: '৬০ দিন (৯% মুনাফা)' },
  { days: 90, ratePercent: 11, labelBn: '৯০ দিন (১১% মুনাফা)' },
  { days: 120, ratePercent: 13, labelBn: '১২০ দিন (১৩% মুনাফা)' },
];

export interface ProfitClaimEntry {
  id: string;
  claimedAt: number; // timestamp
  amount: number; // টাকার পরিমাণ
  dayIndex: number; // কততম দিনের ক্লেম
  date: string; // YYYY-MM-DD
}

export type WithdrawalType = 'capital_partial' | 'capital_full' | 'profit_monthly' | 'profit_annual';

export interface InvestmentWithdrawalRecord {
  id: string; // wth_1728512345678
  investmentId: string; // সংশ্লিষ্ট বিনিয়োগ রেকর্ডের ID
  agreementNo: string; // চুক্তিপত্র নং
  investorName: string; // বিনিয়োগকারীর নাম
  investorMobile: string; // মোবাইল নম্বর
  withdrawalDate: string; // টাকা উত্তোলনের তারিখ (YYYY-MM-DD)
  withdrawalType: WithdrawalType; // মূলধন আংশিক / মূলধন সম্পূর্ণ / মাসিক মুনাফা / বার্ষিক লভ্যাংশ
  amount: number; // উত্তোলিত টাকার পরিমাণ (টাকা)
  paymentMethod: PaymentMethod | 'cheque'; // ক্যাশ / ব্যাংক / চেক ইত্যাদি
  bankName?: string; // ব্যাংকের নাম (যদি থাকে)
  chequeOrTxnNo?: string; // চেক বা ট্রানজেকশন আইডি
  reasonOrNote?: string; // উত্তোলনের কারণ বা বিস্তারিত বিবরণ
  
  // Signature: ফোনের স্ক্রিনে আঙুল দিয়ে ডিজিটাল সাইন অথবা ছবি ফাইল আপলোড
  investorSignatureUrl?: string; // ডিজিটাল স্বাক্ষর (Base64 বা Image URL)
  signatureType?: 'drawn' | 'uploaded'; // স্ক্র্যাচ ড্রয়িং নাকি ছবি আপলোড

  status: 'approved' | 'pending' | 'completed';
  createdAt: number;
  updatedAt?: number;
  voucherNo?: string; // অফিশিয়াল ক্যাশ/ব্যাংক ভাউচার নং e.g. WTH-VOUCHER-2026-001
}

export interface AdminSecuritySettings {
  adminPassword: string; // ক্লাউড সিঙ্কড অ্যাডমিন পাসওয়ার্ড
  isDefaultPassword: boolean; // একবার পাসওয়ার্ড পরিবর্তন করলে এটি false হয়ে যাবে, ফলে ১২৩৪৫৬ সম্পূর্ণ নিষিদ্ধ হবে
  passwordChangedAt?: number;
  updatedAt?: number;
}

export const DEFAULT_ADMIN_SECURITY_SETTINGS: AdminSecuritySettings = {
  adminPassword: '123456',
  isDefaultPassword: true,
  passwordChangedAt: 0,
  updatedAt: 0,
};
