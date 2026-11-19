import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  InvestmentRecord,
  InvestmentWithdrawalRecord,
  FactorySettings,
  WithdrawalType,
  PaymentMethod,
  Employee,
  INVESTMENT_PLANS,
  MINIMUM_INVESTMENT_AMOUNT,
  ProfitClaimEntry
} from '../types';
import {
  subscribeInvestments,
  subscribeWithdrawals,
  saveOrUpdateWithdrawal,
  loadFactorySettings,
  DEFAULT_FACTORY_SETTINGS,
  subscribeEmployees,
  claimDailyProfit
} from '../lib/firebase';
import { formatMoney, toBengaliNumber, toEnglishNumber, formatDateBn, numberToBengaliWords } from '../lib/utils';
import { printElement } from '../lib/printer';
import {
  TrendingUp,
  Lock,
  Phone,
  Eye,
  EyeOff,
  User,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Printer,
  Receipt,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  LogOut,
  Building2,
  AlertTriangle,
  Upload,
  X,
  Plus,
  Gift,
  Sparkles,
  Timer,
  History,
  Calculator,
  Check,
  Layers
} from 'lucide-react';

function normalizePhoneLast10(phone?: string): string {
  const digits = toEnglishNumber(phone || '').replace(/[^0-9]/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function safeParseDateMs(dateStr?: string): number {
  if (!dateStr) return Date.now();
  const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    const dt = new Date(y, m, d, 0, 0, 0, 0);
    if (!isNaN(dt.getTime())) return dt.getTime();
  }
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

function safeDateToYmd(ms: number): string {
  const dt = new Date(isNaN(ms) ? Date.now() : ms);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface InvestorPortalProps {
  initialMobile?: string;
  initialInvestorId?: string;
  onBackToApp?: () => void;
  onSwitchToWorkerPortal?: () => void;
  showToast: (msg: string) => void;
}

export const InvestorPortal: React.FC<InvestorPortalProps> = ({
  initialMobile = '',
  initialInvestorId = '',
  onBackToApp,
  onSwitchToWorkerPortal,
  showToast,
}) => {
  // All investments & withdrawals state
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<InvestmentWithdrawalRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);

  // Auth State
  const [loggedInInvestor, setLoggedInInvestor] = useState<InvestmentRecord | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState(initialMobile || initialInvestorId);
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [crossPortalRedirect, setCrossPortalRedirect] = useState<'worker' | null>(null);

  // Active view tab inside portal
  const [portalTab, setPortalTab] = useState<'all' | 'profit' | 'withdrawals' | 'documents'>('all');

  // Modals
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedAgreementDoc, setSelectedAgreementDoc] = useState<InvestmentRecord | null>(null);
  const [selectedReceiptDoc, setSelectedReceiptDoc] = useState<InvestmentRecord | null>(null);
  const [selectedVoucherDoc, setSelectedVoucherDoc] = useState<InvestmentWithdrawalRecord | null>(null);
  const [showClaimHistoryModal, setShowClaimHistoryModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [calcAmount, setCalcAmount] = useState<number | ''>(1000);
  const [calcPlanDays, setCalcPlanDays] = useState<number>(30);
  const [isClaimingProfit, setIsClaimingProfit] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Ref for stable subscription access
  const loggedInInvestorIdRef = useRef<string | null>(null);
  useEffect(() => {
    loggedInInvestorIdRef.current = loggedInInvestor?.id || null;
  }, [loggedInInvestor?.id]);

  // 1-second live ticker for 24h claim countdown & maturity tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Withdrawal Form Fields
  const [wthAmount, setWthAmount] = useState<number | ''>('');
  const [wthType, setWthType] = useState<WithdrawalType>('profit_monthly');
  const [wthDate, setWthDate] = useState(() => safeDateToYmd(Date.now()));
  const [wthPaymentMethod, setWthPaymentMethod] = useState<PaymentMethod | 'cheque'>('bank');
  const [wthBankName, setWthBankName] = useState('ইসলামী ব্যাংক বাংলাদেশ লিঃ');
  const [wthAccountNo, setWthAccountNo] = useState('');
  const [wthChequeOrTxn, setWthChequeOrTxn] = useState('');
  const [wthReason, setWthReason] = useState('');
  const [wthFormError, setWthFormError] = useState('');
  const [isSubmittingWth, setIsSubmittingWth] = useState(false);

  // Signature Photo Upload
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState('');
  const sigFileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to real-time data ONCE
  useEffect(() => {
    loadFactorySettings().then((res) => {
      if (res && res.name) setFactory(res);
    });

    const unsubInv = subscribeInvestments((list) => {
      setInvestments(list);
      const activeId = loggedInInvestorIdRef.current;
      if (activeId) {
        const found = list.find((i) => i.id === activeId);
        if (!found) {
          setLoggedInInvestor(null);
          setLoginError('আপনার বিনিয়োগ চুক্তিটি অ্যাডমিন কর্তৃক মুছে ফেলা হয়েছে। বিস্তারিত জানতে কর্তৃপক্ষের সাথে যোগাযোগ করুন।');
          showToast('বিনিয়োগ রেকর্ড পাওয়া যায়নি — লগআউট করা হয়েছে');
        } else if (found.isBlocked) {
          setLoggedInInvestor(null);
          setLoginError(
            `⛔ আপনার ইনভেস্টর অ্যাকাউন্ট অ্যাডমিন কর্তৃক সাময়িকভাবে ব্লক করা হয়েছে!\n\nকারণ: ${
              found.blockReason || 'প্রশাসনিক প্রয়োজনে অ্যাকাউন্ট সাময়িকভাবে বন্ধ রাখা হয়েছে।'
            }\n\nঅ্যাকাউন্ট আনব্লক করতে কারখানার অ্যাডমিন বা ব্যবস্থাপনা কর্তৃপক্ষের সাথে যোগাযোগ করুন।`
          );
          showToast('অ্যাকাউন্ট ব্লক করা হয়েছে — লগআউট করা হয়েছে');
        } else {
          setLoggedInInvestor(found);
        }
      }
    });

    const unsubWth = subscribeWithdrawals((list) => {
      setWithdrawals(list);
    });

    const unsubEmp = subscribeEmployees((list) => {
      setEmployees(list || []);
    });

    return () => {
      unsubInv();
      unsubWth();
      unsubEmp();
    };
  }, []);

  // Set initial login input
  useEffect(() => {
    if (!loggedInInvestor && (initialMobile || initialInvestorId)) {
      setLoginIdentifier(initialMobile || initialInvestorId);
    }
  }, [initialMobile, initialInvestorId, loggedInInvestor]);

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setCrossPortalRedirect(null);

    const rawInputEn = toEnglishNumber(loginIdentifier).trim();
    const cleanInput = rawInputEn.toLowerCase();
    const cleanPass = toEnglishNumber(loginPassword).trim();
    const inputDigits = cleanInput.replace(/[^0-9]/g, '');
    const normalizedInputPhone = normalizePhoneLast10(inputDigits);

    if (!cleanInput) {
      setLoginError('অনুগ্রহ করে মোবাইল নম্বর, চুক্তি নং বা ইনভেস্টর কোড লিখুন');
      return;
    }
    if (!cleanPass) {
      setLoginError('অনুগ্রহ করে আপনার গোপন পাসওয়ার্ড লিখুন');
      return;
    }

    // Match candidate investments strictly (exact agreementNo/code/id OR exact normalized 10-digit mobile)
    const candidates = investments.filter((inv) => {
      const invMobNorm = normalizePhoneLast10(inv.investorMobile);
      const matchMobile = normalizedInputPhone.length >= 10 && invMobNorm === normalizedInputPhone;
      const matchAgreement = (inv.agreementNo || '').trim().toLowerCase() === cleanInput;
      const matchCode = Boolean(inv.investorCode) && inv.investorCode!.trim().toLowerCase() === cleanInput;
      const matchId = (inv.id || '').trim().toLowerCase() === cleanInput;
      return matchAgreement || matchCode || matchId || matchMobile;
    });

    // Prioritize active & unblocked contracts first
    const sortedCandidates = [...candidates].sort((a, b) => {
      const score = (x: InvestmentRecord) =>
        (x.isBlocked ? 0 : 10) + (x.status === 'active' ? 5 : 0);
      return score(b) - score(a) || (b.createdAt || 0) - (a.createdAt || 0);
    });

    // Check if entered credentials belong to a factory worker in employees database
    const matchedEmp = employees.find((emp) => {
      const empMobNorm = normalizePhoneLast10(emp.mobile);
      const matchMobile = normalizedInputPhone.length >= 10 && empMobNorm === normalizedInputPhone;
      const matchWorkerId = (emp.workerId || '').trim().toLowerCase() === cleanInput;
      return matchMobile || matchWorkerId;
    });

    // Cross-role protection: If user is an employee trying to log in at the investor portal
    if (sortedCandidates.length === 0 && matchedEmp) {
      setCrossPortalRedirect('worker');
      setLoginError(
        `⛔ প্রবেশাধিকার সংরক্ষিত: আপনি টেক্স ওয়ার অ্যাপারেলসের একজন শ্রমিক/কর্মচারী (${matchedEmp.name}, আইডি: ${matchedEmp.workerId})।\n\nএটি শুধুমাত্র কারখানা বিনিয়োগকারী (Investor) অংশীদারদের পোর্টাল (texwareinvestment)। শ্রমিকগণ ইনভেস্টমেন্ট সাইটে লগইন করতে পারবেন না।\n\nঅনুগ্রহ করে আপনার নির্ধারিত শ্রমিক পোর্টালে (texwareworker) গিয়ে মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন।`
      );
      return;
    }

    if (sortedCandidates.length === 0) {
      setLoginError('এই মোবাইল নম্বর বা চুক্তি নম্বর দিয়ে কোনো বিনিয়োগকারীর তথ্য পাওয়া যায়নি। সঠিক তথ্য দিন অথবা কারখানা কর্তৃপক্ষের সাথে যোগাযোগ করুন।');
      return;
    }

    const checkPasswordMatch = (inv: InvestmentRecord) => {
      const customPass = inv.portalPassword ? toEnglishNumber(inv.portalPassword).trim() : '';
      if (customPass) {
        return customPass === cleanPass;
      }
      const mobileDigits = toEnglishNumber(inv.investorMobile || '').replace(/[^0-9]/g, '');
      const defaultLast4 = mobileDigits.slice(-4);
      return (defaultLast4 && cleanPass === defaultLast4) || cleanPass === '123456';
    };

    const authenticatedMatch = sortedCandidates.find(checkPasswordMatch);

    if (!authenticatedMatch) {
      // Check if primary candidate is blocked first so we don't leak password hint if blocked
      const primary = sortedCandidates[0];
      if (primary.isBlocked) {
        setLoginError(
          `⛔ আপনার ইনভেস্টর অ্যাকাউন্ট অ্যাডমিন কর্তৃক সাময়িকভাবে ব্লক করা হয়েছে!\n\nকারণ: ${
            primary.blockReason || 'প্রশাসনিক প্রয়োজনে অ্যাকাউন্ট সাময়িকভাবে বন্ধ রাখা হয়েছে।'
          }\n\nঅ্যাকাউন্ট আনব্লক করতে কারখানার অ্যাডমিন বা ব্যবস্থাপনা কর্তৃপক্ষের সাথে যোগাযোগ করুন।`
        );
        return;
      }
      setLoginError('ভুল পাসওয়ার্ড। পাসওয়ার্ড ভুলে গেলে কারখানা অ্যাডমিনের সাথে যোগাযোগ করুন।');
      return;
    }

    // BLOCK CHECK: If matched investor is blocked by Admin
    if (authenticatedMatch.isBlocked) {
      setLoginError(
        `⛔ আপনার ইনভেস্টর অ্যাকাউন্ট অ্যাডমিন কর্তৃক সাময়িকভাবে ব্লক করা হয়েছে!\n\nকারণ: ${
          authenticatedMatch.blockReason || 'প্রশাসনিক প্রয়োজনে অ্যাকাউন্ট সাময়িকভাবে বন্ধ রাখা হয়েছে।'
        }\n\nঅ্যাকাউন্ট আনব্লক করতে কারখানার অ্যাডমিন বা ব্যবস্থাপনা কর্তৃপক্ষের সাথে যোগাযোগ করুন।`
      );
      return;
    }

    setLoggedInInvestor(authenticatedMatch);
    setPortalTab('all');
    showToast(`স্বাগতম জনাব ${authenticatedMatch.investorName}! ইনভেস্টর পোর্টালে সফলভাবে প্রবেশ করেছেন।`);
  };

  const handleLogout = () => {
    setLoggedInInvestor(null);
    setLoginPassword('');
    setLoginError('');
    setShowWithdrawalModal(false);
    setSelectedAgreementDoc(null);
    setSelectedReceiptDoc(null);
    setSelectedVoucherDoc(null);
    setShowClaimHistoryModal(false);
    setShowCalculatorModal(false);
    showToast('ইনভেস্টর পোর্টাল থেকে সফলভাবে লগআউট করা হয়েছে');
  };

  // Strict per-investor contract list (only other contracts of the exact same investor with matching phone AND NID)
  const myOwnContracts = useMemo(() => {
    if (!loggedInInvestor) return [];
    const myPhone = normalizePhoneLast10(loggedInInvestor.investorMobile);
    const myNid = toEnglishNumber(loggedInInvestor.investorNid || '').replace(/\s+/g, '');
    return investments.filter((inv) => {
      if (inv.id === loggedInInvestor.id) return true;
      if (inv.isBlocked) return false;
      const invPhone = normalizePhoneLast10(inv.investorMobile);
      const invNid = toEnglishNumber(inv.investorNid || '').replace(/\s+/g, '');
      return Boolean(myPhone && invPhone === myPhone && myNid && invNid === myNid);
    });
  }, [investments, loggedInInvestor]);

  // Withdrawals strictly for this logged-in contract
  const myWithdrawals = useMemo(() => {
    if (!loggedInInvestor) return [];
    return withdrawals.filter(
      (w) =>
        w.investmentId === loggedInInvestor.id ||
        (!w.investmentId && w.agreementNo === loggedInInvestor.agreementNo)
    );
  }, [withdrawals, loggedInInvestor]);

  // Aggregate Metrics for this investor
  const totalWithdrawnAmount = useMemo(() => {
    return myWithdrawals.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [myWithdrawals]);

  const capitalWithdrawnAmount = useMemo(() => {
    return myWithdrawals
      .filter((w) => w.withdrawalType === 'capital_partial' || w.withdrawalType === 'capital_full')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [myWithdrawals]);

  const profitWithdrawnAmount = useMemo(() => {
    return myWithdrawals
      .filter((w) => w.withdrawalType === 'profit_monthly' || w.withdrawalType === 'profit_annual')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [myWithdrawals]);

  const remainingCapital = useMemo(() => {
    if (!loggedInInvestor) return 0;
    return Math.max(0, (Number(loggedInInvestor.amount) || 0) - capitalWithdrawnAmount);
  }, [loggedInInvestor, capitalWithdrawnAmount]);

  const availableClaimedProfit = useMemo(() => {
    if (!loggedInInvestor) return 0;
    return Math.max(
      0,
      Math.round(((Number(loggedInInvestor.totalProfitClaimed) || 0) - profitWithdrawnAmount) * 100) / 100
    );
  }, [loggedInInvestor, profitWithdrawnAmount]);

  // Plan Duration & Term Maturity Tracking
  const durationDays = useMemo(() => {
    if (!loggedInInvestor) return 30;
    return Math.max(1, loggedInInvestor.durationDays || (loggedInInvestor.durationMonths ? loggedInInvestor.durationMonths * 30 : 30));
  }, [loggedInInvestor]);

  const investmentStartTime = useMemo(() => {
    return safeParseDateMs(loggedInInvestor?.investmentDate);
  }, [loggedInInvestor?.investmentDate]);

  const maturityTimestamp = useMemo(() => {
    return investmentStartTime + (durationDays * 24 * 60 * 60 * 1000);
  }, [investmentStartTime, durationDays]);

  const isTermMatured = useMemo(() => {
    return currentTime >= maturityTimestamp;
  }, [currentTime, maturityTimestamp]);

  const daysUntilMaturity = useMemo(() => {
    return Math.max(0, Math.ceil((maturityTimestamp - currentTime) / (1000 * 60 * 60 * 24)));
  }, [maturityTimestamp, currentTime]);

  const maturityDateFormatted = useMemo(() => {
    return formatDateBn(safeDateToYmd(maturityTimestamp));
  }, [maturityTimestamp]);

  // 24-Hour Daily Profit Claim Calculation
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const lastClaimTime = loggedInInvestor?.lastProfitClaimedAt || 0;
  const timeSinceLastClaim = currentTime - lastClaimTime;
  const claimedDaysCount = loggedInInvestor?.claimedDaysCount || 0;
  const remainingClaimDays = Math.max(0, durationDays - claimedDaysCount);

  // Total Plan Profit & Daily Profit Rate
  // e.g. 7 days: 2%, 15 days: 4%, 30 days: 6%, 60 days: 9%, 90 days: 11%, 120 days: 13%
  const totalExpectedProfit = useMemo(() => {
    if (!loggedInInvestor) return 0;
    const rate = Number(loggedInInvestor.profitRatePercent) || 0;
    return Math.round((Number(loggedInInvestor.amount) * rate) / 100);
  }, [loggedInInvestor]);

  const dailyProfitAmount = useMemo(() => {
    if (!loggedInInvestor || durationDays <= 0) return 0;
    return Math.round((totalExpectedProfit / durationDays) * 100) / 100;
  }, [totalExpectedProfit, durationDays]);

  const canClaimDailyNow = useMemo(() => {
    if (!loggedInInvestor || loggedInInvestor.status !== 'active') return false;
    if (claimedDaysCount >= durationDays) return false;
    if (lastClaimTime === 0) return true;
    return timeSinceLastClaim >= ONE_DAY_MS;
  }, [loggedInInvestor, claimedDaysCount, durationDays, lastClaimTime, timeSinceLastClaim]);

  const claimCountdown = useMemo(() => {
    if (canClaimDailyNow || claimedDaysCount >= durationDays) return null;
    const remainingMs = Math.max(0, ONE_DAY_MS - timeSinceLastClaim);
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    return {
      hours,
      minutes,
      seconds,
      textBn: `${toBengaliNumber(hours)} ঘণ্টা ${toBengaliNumber(minutes)} মিনিট ${toBengaliNumber(seconds)} সেকেন্ড`,
    };
  }, [canClaimDailyNow, claimedDaysCount, durationDays, timeSinceLastClaim]);

  // Handler for 24-hour Daily Profit Claim
  const handleClaimDailyProfit = async () => {
    if (!loggedInInvestor) return;
    if (!canClaimDailyNow) {
      if (claimCountdown) {
        showToast(`⏳ পরবর্তী মুনাফা ক্লেম করতে এখনো ${claimCountdown.textBn} অপেক্ষা করতে হবে।`);
      }
      return;
    }

    setIsClaimingProfit(true);
    try {
      const res = await claimDailyProfit(loggedInInvestor.id);
      if (res.success && res.updatedInvestment) {
        setLoggedInInvestor(res.updatedInvestment);
        showToast(res.message);
      } else {
        showToast(res.message);
      }
    } catch (e) {
      console.error("Error claiming profit:", e);
      showToast('মুনাফা ক্লেম করতে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।');
    } finally {
      setIsClaimingProfit(false);
    }
  };

  const openWithdrawalModal = () => {
    setWthFormError('');
    const defaultType: WithdrawalType =
      availableClaimedProfit > 0 ? 'profit_monthly' : 'capital_full';
    setWthType(defaultType);
    setWthAmount(
      defaultType === 'capital_full'
        ? remainingCapital || ''
        : availableClaimedProfit > 0
        ? availableClaimedProfit
        : remainingCapital || ''
    );
    setWthDate(safeDateToYmd(Date.now()));
    setShowWithdrawalModal(true);
  };

  const handleClearUploadedSignature = () => {
    setUploadedSignatureUrl('');
    if (sigFileInputRef.current) {
      sigFileInputRef.current.value = '';
    }
  };

  // Upload signature photo
  const handleSignatureFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে সঠিক ছবির ফাইল নির্বাচন করুন');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('ছবির ফাইল সাইজ ৩ মেগাবাইটের কম হতে হবে');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedSignatureUrl(reader.result as string);
      showToast('✓ সিগনেচারের ছবি আপলোড হয়েছে');
    };
    reader.readAsDataURL(file);
  };

  // Submit Withdrawal
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInInvestor) return;
    setWthFormError('');

    // Strict requirement: User cannot submit withdrawal request before investment duration matures
    if (!isTermMatured) {
      setWthFormError(
        `⛔ চুক্তির মেয়াদ পূর্ণ হওয়ার পূর্বে টাকা উত্তোলন রিকোয়েস্ট গ্রহণযোগ্য নয়!\n\nআপনি ${toBengaliNumber(durationDays)} দিনের মেয়াদে ডিপোজিট করেছেন। আপনার মেয়াদের সমাপ্তি তারিখ: ${maturityDateFormatted} (আর ${toBengaliNumber(daysUntilMaturity)} দিন বাকি)।\n\nচুক্তির শর্তানুযায়ী মেয়াদ শেষ হওয়ার পর আপনি উত্তোলনের রিকোয়েস্ট দিতে পারবেন।`
      );
      return;
    }

    if (!wthDate) {
      setWthFormError('অনুগ্রহ করে উত্তোলনের তারিখ নির্বাচন করুন');
      return;
    }

    const numAmount = Number(wthAmount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      setWthFormError('অনুগ্রহ করে সঠিক টাকার অংক লিখুন');
      return;
    }

    // Capital balance check
    if ((wthType === 'capital_partial' || wthType === 'capital_full') && numAmount > remainingCapital) {
      setWthFormError(`উত্তোলনকৃত অর্থ আপনার অবশিষ্ট মূলধন (৳ ${formatMoney(remainingCapital)}) এর চেয়ে বেশি হতে পারে না`);
      return;
    }

    // Claimed profit balance check
    if ((wthType === 'profit_monthly' || wthType === 'profit_annual') && numAmount > availableClaimedProfit) {
      setWthFormError(
        availableClaimedProfit <= 0
          ? 'আপনার উত্তোলনযোগ্য ক্লেমকৃত মুনাফা বর্তমানে শূন্য (৳ ০)। মুনাফা উত্তোলনের পূর্বে দৈনিক মুনাফা ক্লেম সম্পন্ন করুন অথবা মূলধন উত্তোলন নির্বাচন করুন।'
          : `লভ্যাংশ উত্তোলন আপনার অবশিষ্ট ক্লেমকৃত মুনাফা (৳ ${formatMoney(availableClaimedProfit)}) এর চেয়ে বেশি হতে পারে না`
      );
      return;
    }

    if (!uploadedSignatureUrl) {
      setWthFormError('অনুগ্রহ করে আপনার স্বাক্ষরের ছবি আপলোড করুন');
      return;
    }

    setIsSubmittingWth(true);
    try {
      const bankDisplay =
        wthPaymentMethod === 'bank'
          ? [wthBankName.trim(), wthAccountNo.trim() ? `A/C: ${wthAccountNo.trim()}` : '']
              .filter(Boolean)
              .join(' • ')
          : undefined;

      const recordPayload: Omit<InvestmentWithdrawalRecord, 'id' | 'createdAt' | 'updatedAt'> = {
        investmentId: loggedInInvestor.id,
        agreementNo: loggedInInvestor.agreementNo,
        investorName: loggedInInvestor.investorName,
        investorMobile: loggedInInvestor.investorMobile,
        withdrawalDate: wthDate,
        withdrawalType: wthType,
        amount: numAmount,
        paymentMethod: wthPaymentMethod,
        bankName: bankDisplay || undefined,
        chequeOrTxnNo: wthChequeOrTxn.trim() || undefined,
        reasonOrNote: wthReason.trim() || undefined,
        investorSignatureUrl: uploadedSignatureUrl,
        signatureType: 'uploaded',
        status: 'pending',
      };

      const newId = await saveOrUpdateWithdrawal(recordPayload);
      const savedDoc: InvestmentWithdrawalRecord = {
        ...recordPayload,
        id: newId,
        createdAt: Date.now(),
      };

      setShowWithdrawalModal(false);
      setWthAmount('');
      setWthChequeOrTxn('');
      setWthAccountNo('');
      setWthReason('');
      handleClearUploadedSignature();

      showToast('✓ টাকা উত্তোলনের রিকোয়েস্ট ও ভাউচার সফলভাবে জমা হয়েছে!');
      setSelectedVoucherDoc(savedDoc);
    } catch {
      setWthFormError('উত্তোলন সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmittingWth(false);
    }
  };

  const handlePrintDoc = () => {
    if (selectedVoucherDoc) {
      const el = document.getElementById('printableA4WithdrawalVoucher');
      if (el) {
        printElement(el, `Withdrawal_Voucher_${selectedVoucherDoc.agreementNo}`, 'contract');
        return;
      }
    }
    if (selectedAgreementDoc) {
      const el = document.getElementById('printableA4InvestmentAgreement');
      if (el) {
        printElement(el, `Investment_Agreement_${selectedAgreementDoc.agreementNo}`, 'contract');
        return;
      }
    }
    if (selectedReceiptDoc) {
      const el = document.getElementById('printableMoneyReceipt');
      if (el) {
        printElement(el, `Money_Receipt_${selectedReceiptDoc.agreementNo}`, 'pos');
        return;
      }
    }
    window.print();
  };

  /* ================= 1. LOGIN SCREEN (ISOLATED MODE) ================= */
  if (!loggedInInvestor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md rounded-3xl border border-amber-400/30 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Subtle Golden Glow Accents */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Factory Brand & Monogram Header */}
          <div className="text-center space-y-2 relative z-10">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg border-2 border-amber-300">
              <TrendingUp className="w-9 h-9 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-block px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10.5px] font-black uppercase tracking-wider mb-1">
                Investor Partner Portal
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {factory.name || 'টেক্স ওয়ার অ্যাপারেলস'}
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                কারখানা বিনিয়োগকারী অংশীদারদের ব্যক্তিগত পোর্টাল
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-mono font-bold text-amber-200 mt-2 shadow-inner">
                <span className="text-amber-300">🔗 একক লগইন লিংক:</span>
                <span className="text-slate-950 bg-amber-400 px-2 py-0.5 rounded-md font-black tracking-wider">texwareinvestment</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1.5 max-w-xs mx-auto">
                সকল বিনিয়োগকারী অংশীদার এই একক লিংক ব্যবহার করে তাদের মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করবেন।
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {loginError && (
            <div className="p-4 bg-rose-950/80 border border-rose-500/50 rounded-2xl text-rose-200 text-xs whitespace-pre-line space-y-2 animate-in fade-in duration-200 shadow-md">
              <div className="font-bold flex items-center gap-1.5 text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>প্রবেশাধিকার নোটিশ:</span>
              </div>
              <p className="leading-relaxed pl-5 font-medium">{loginError}</p>

              {crossPortalRedirect === 'worker' && (
                <div className="pt-1.5 pl-5">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSwitchToWorkerPortal) {
                        onSwitchToWorkerPortal();
                      } else {
                        window.location.href = '/texwareworker';
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 text-center cursor-pointer"
                  >
                    <span>👷‍♂️ শ্রমিক পোর্টালে যান (texwareworker)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-bold text-amber-200 mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>নিবন্ধিত মোবাইল নম্বর বা চুক্তি নং *</span>
              </label>
              <input
                type="text"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="যেমন: 017xxxxxxxx বা TW-INV-2026-001"
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-sm font-bold text-white focus:ring-2 focus:ring-amber-400/40 outline-none transition"
              />
              <span className="text-[10.5px] text-slate-400 mt-1 block">
                বিনিয়োগের সময় প্রদত্ত মোবাইল নম্বরটি লিখুন
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-200 mb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>পোর্টাল পাসওয়ার্ড *</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখুন"
                  className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700 focus:border-amber-400 rounded-xl font-mono text-sm font-bold text-white focus:ring-2 focus:ring-amber-400/40 outline-none transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                ডিফল্ট পাসওয়ার্ড: মোবাইলের শেষ ৪ ডিজিট অথবা ১২৩৪৫৬
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
            >
              <span>ইনভেস্টর পোর্টালে প্রবেশ করুন</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Secure System Seal */}
          <div className="pt-3 border-t border-slate-800 text-center text-[10.5px] text-slate-400 space-y-1">
            <div className="flex items-center justify-center gap-1 text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>২৫৬-বিট এনক্রিপ্টেড সিকিউর পোর্টাল</span>
            </div>
            <p>সকল ডাটা কারখানা সার্ভারে সুরক্ষিতভাবে সংরক্ষিত</p>
          </div>

          {onBackToApp && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onBackToApp}
                className="text-xs text-slate-400 hover:text-amber-300 font-semibold underline cursor-pointer"
              >
                ← প্রধান অ্যাপ্লিকেশনে ফিরে যান
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ================= 2. LOGGED-IN INVESTOR DASHBOARD ================= */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Corporate Navigation Bar */}
      <header className="bg-slate-900/90 border-b border-amber-400/20 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-8 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              title="আগের পেজে ফিরে যান"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black flex items-center justify-center shadow-md border border-amber-300">
            <TrendingUp className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm sm:text-base text-white tracking-tight">
                {factory.name}
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase">
                Investor Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              বিনিয়োগকারী অংশীদার: <b className="text-amber-300 font-bold">{loggedInInvestor.investorName}</b> ({loggedInInvestor.agreementNo})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Apply Withdrawal Button */}
          <button
            type="button"
            onClick={openWithdrawalModal}
            className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
          >
            <DollarSign className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">টাকা উত্তোলন ফরম</span>
            <span className="sm:hidden">উত্তোলন</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">লগআউট</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto p-3 sm:p-6 space-y-6">
        {/* Investor Profile Hero Card (Golden Luxury Theme) */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-5 sm:p-7 border border-amber-400/30 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-amber-400/60 overflow-hidden bg-slate-800 shrink-0 shadow-lg">
                {loggedInInvestor.investorPhotoUrl ? (
                  <img
                    src={loggedInInvestor.investorPhotoUrl}
                    alt={loggedInInvestor.investorName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-300 text-2xl font-black">
                    {loggedInInvestor.investorName.charAt(0)}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-2xl font-black text-white">
                    {loggedInInvestor.investorName}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>সক্রিয় অংশীদার</span>
                  </span>
                </div>
                <div className="text-xs text-slate-300 space-y-0.5 font-medium">
                  <p>চুক্তি নং: <b className="text-amber-300 font-mono">{loggedInInvestor.agreementNo}</b> | মোবাইল: <b className="text-white font-mono">{loggedInInvestor.investorMobile}</b></p>
                  <p>বিনিয়োগের তারিখ: {formatDateBn(loggedInInvestor.investmentDate)} | নমিনি: <b>{loggedInInvestor.nomineeName} ({loggedInInvestor.nomineeRelation})</b></p>
                </div>
              </div>
            </div>

            {/* Quick Document Buttons */}
            <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setSelectedAgreementDoc(loggedInInvestor)}
                className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer border border-blue-400/40"
              >
                <FileText className="w-4 h-4" />
                <span>A4 চুক্তিপত্র</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceiptDoc(loggedInInvestor)}
                className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer border border-emerald-400/40"
              >
                <Receipt className="w-4 h-4" />
                <span>টাকা জমার রসিদ</span>
              </button>
            </div>
          </div>
        </div>

        {/* Contract Switcher (Only if this exact same authenticated investor holds multiple contracts) */}
        {myOwnContracts.length > 1 && (
          <div className="bg-slate-900/90 border border-amber-400/30 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Layers className="w-4 h-4" />
              <span>আপনার নিজস্ব বিনিয়োগ চুক্তিসমূহ ({toBengaliNumber(myOwnContracts.length)} টি):</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {myOwnContracts.map((c) => {
                const isCurrent = c.id === loggedInInvestor.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setLoggedInInvestor(c)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {c.agreementNo} (৳ {formatMoney(c.amount)})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Portal Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit flex-wrap">
          {[
            { id: 'all', label: 'সম্পূর্ণ ড্যাশবোর্ড' },
            { id: 'profit', label: '২৪ ঘণ্টায় মুনাফা ক্লেম ও প্ল্যান' },
            { id: 'withdrawals', label: `টাকা উত্তোলন (${toBengaliNumber(myWithdrawals.length)})` },
            { id: 'documents', label: 'চুক্তিপত্র, রসিদ ও প্রোফাইল' },
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setPortalTab(tabItem.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                portalTab === tabItem.id
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* 4 Essential Financial Balance Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Initial Investment */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-1">
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
              মোট বিনিয়োগকৃত মূলধন:
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
              ৳ {formatMoney(loggedInInvestor.amount)}
            </div>
            <span className="text-[10.5px] text-amber-300/90 block font-medium">
              প্ল্যান: {toBengaliNumber(durationDays)} দিন ({toBengaliNumber(loggedInInvestor.profitRatePercent || 0)}% মুনাফা)
            </span>
          </div>

          {/* Card 2: Remaining Capital Balance */}
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 shadow-md space-y-1">
            <span className="text-[11px] font-bold text-emerald-400 block uppercase tracking-wider">
              বর্তমান মূলধন ব্যালেন্স:
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
              ৳ {formatMoney(remainingCapital)}
            </div>
            <span className="text-[10.5px] text-emerald-400/90 block flex items-center gap-1">
              {isTermMatured ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 inline" />
                  <span>মেয়াদ পূর্ণ (উত্তোলনযোগ্য)</span>
                </span>
              ) : (
                <span className="text-amber-300/90 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3 inline" />
                  <span>উত্তোলন লক: আর {toBengaliNumber(daysUntilMaturity)} দিন</span>
                </span>
              )}
            </span>
          </div>

          {/* Card 3: 24-Hour Daily Profit Yield */}
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 shadow-md space-y-1">
            <span className="text-[11px] font-bold text-blue-400 block uppercase tracking-wider">
              দৈনিক মুনাফা (২৪ ঘণ্টায় ১ বার):
            </span>
            <div className="text-xl sm:text-2xl font-black text-blue-300 font-mono">
              ৳ {formatMoney(dailyProfitAmount)}
            </div>
            <span className="text-[10.5px] text-blue-300/90 block">
              ক্লেম করা হয়েছে: {toBengaliNumber(claimedDaysCount)} / {toBengaliNumber(durationDays)} দিন
            </span>
          </div>

          {/* Card 4: Total Claimed Profit & Available */}
          <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 shadow-md space-y-1">
            <span className="text-[11px] font-bold text-purple-400 block uppercase tracking-wider">
              ক্লেমকৃত মুনাফা (উত্তোলনযোগ্য):
            </span>
            <div className="text-xl sm:text-2xl font-black text-purple-300 font-mono">
              ৳ {formatMoney(availableClaimedProfit)}
            </div>
            <span className="text-[10.5px] text-purple-300/80 block">
              মোট ক্লেম: ৳ {formatMoney(loggedInInvestor.totalProfitClaimed || 0)} · উত্তোলন: ৳ {formatMoney(totalWithdrawnAmount)}
            </span>
          </div>
        </div>

        {(portalTab === 'all' || portalTab === 'profit') && (
          <>
        {/* 1. 24-HOUR DAILY PROFIT CLAIM CENTER (২৪ ঘণ্টায় ১ বার মুনাফা ক্লেম সেন্টার) */}
        <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-900/60 rounded-3xl p-5 sm:p-6 border-2 border-amber-400/50 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-52 h-52 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shadow-md">
                  <Gift className="w-5 h-5" />
                </span>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  দৈনিক মুনাফা ক্লেম সেন্টার (২৪ ঘণ্টায় ১ বার)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  প্রতিদিন ক্লেমযোগ্য
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                আপনি <b>{toBengaliNumber(durationDays)} দিনের মেয়াদে {toBengaliNumber(loggedInInvestor.profitRatePercent || 0)}% লাভে</b> ডিপোজিট করেছেন। আপনার একাউন্টে প্রতিদিন ২৪ ঘণ্টা পর পর <b>৳ {formatMoney(dailyProfitAmount)}</b> টাকা স্বয়ংক্রিয়ভাবে ক্লেম করার সুযোগ রয়েছে।
              </p>

              {/* Progress Bar of Claimed Days */}
              <div className="space-y-1 max-w-md pt-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>ক্লেমের অগ্রগতি: {toBengaliNumber(claimedDaysCount)} / {toBengaliNumber(durationDays)} দিন</span>
                  <span className="text-amber-400">{Math.round((claimedDaysCount / durationDays) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((claimedDaysCount / durationDays) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action Box: Big Claim Button OR Countdown Ticker */}
            <div className="flex flex-col items-stretch sm:items-end gap-2.5 shrink-0 w-full sm:w-auto">
              {claimedDaysCount >= durationDays ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 font-black text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>সকল দিনের মুনাফা ক্লেম সম্পন্ন</span>
                  </div>
                  <p className="text-[10.5px]">নির্ধারিত {toBengaliNumber(durationDays)} দিনের মুনাফা সম্পূর্ণ সফলভাবে পেয়েছেন।</p>
                </div>
              ) : canClaimDailyNow ? (
                <button
                  type="button"
                  disabled={isClaimingProfit}
                  onClick={handleClaimDailyProfit}
                  className="py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:shadow-amber-400/30 transition-all active:scale-95 cursor-pointer border-2 border-amber-300"
                >
                  <Sparkles className="w-5 h-5 text-slate-950 fill-current" />
                  <span>
                    {isClaimingProfit
                      ? 'ক্লেম সম্পন্ন হচ্ছে...'
                      : `🎁 আজকের মুনাফা ক্লেম করুন (৳ ${formatMoney(dailyProfitAmount)})`}
                  </span>
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-400/40 text-center space-y-1.5 shadow-md">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300">
                    <Timer className="w-4 h-4 text-amber-400 animate-spin" />
                    <span>পরবর্তী ক্লেম উপলব্ধ হতে বাকি:</span>
                  </div>
                  <div className="font-mono text-sm sm:text-base font-black text-white bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                    {claimCountdown?.textBn || 'অপেক্ষা করুন...'}
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    প্রতি ২৪ ঘণ্টায় ১ বার দৈনিক মুনাফা ক্লেম করা যায়
                  </span>
                </div>
              )}

              {/* View Claim History Button */}
              <button
                type="button"
                onClick={() => setShowClaimHistoryModal(true)}
                className="py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>মুনাফা ক্লেমের ইতিহাস ({toBengaliNumber((loggedInInvestor.profitClaimHistory || []).length)})</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. OFFICIAL INVESTMENT TIERS STRIP & PROFIT CALCULATOR */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h4 className="font-bold text-white text-xs sm:text-sm">
                কারখানার অফিশিয়াল মেয়াদি ইনভেস্টমেন্ট প্ল্যানসমূহ (মিনিমাম ডিপোজিট ১,০০০ টাকা):
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowCalculatorModal(true)}
              className="py-1 px-3 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>মুনাফা ক্যালকুলেটর</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {INVESTMENT_PLANS.map((plan) => {
              const isMyPlan = durationDays === plan.days && (loggedInInvestor.profitRatePercent || 0) === plan.ratePercent;
              return (
                <div
                  key={plan.days}
                  className={`p-2.5 rounded-xl border text-center space-y-0.5 transition ${
                    isMyPlan
                      ? 'bg-amber-400/15 border-amber-400 text-white shadow-sm ring-1 ring-amber-400'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block font-medium">মেয়াদ</span>
                  <div className="font-black text-xs sm:text-sm text-white">
                    {toBengaliNumber(plan.days)} দিন
                  </div>
                  <div className="font-black text-xs text-amber-400">
                    {toBengaliNumber(plan.ratePercent)}% লাভ
                  </div>
                  {isMyPlan && (
                    <span className="text-[9.5px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full inline-block mt-0.5">
                      আপনার প্ল্যান
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          </>
        )}

        {(portalTab === 'all' || portalTab === 'withdrawals') && (
          <>
        {/* 3. MATURITY & CAPITAL WITHDRAWAL STATUS BANNER */}
        <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all ${
          isTermMatured
            ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/50 border-emerald-500/50'
            : 'bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border-amber-400/30'
        }`}>
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-black text-white text-base flex items-center justify-center sm:justify-start gap-2">
              {isTermMatured ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>আপনার {toBengaliNumber(durationDays)} দিনের মেয়াদি চুক্তি পূর্ণ হয়েছে! মূলধন উত্তোলন করতে পারেন</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 text-amber-400" />
                  <span>মূলধন উত্তোলন লক রয়েছে: মেয়াদ পূর্ণ হতে এখনো {toBengaliNumber(daysUntilMaturity)} দিন বাকি</span>
                </>
              )}
            </h3>
            <p className="text-xs text-slate-300">
              {isTermMatured
                ? 'আপনার বিনিয়োগের সম্পূর্ণ মেয়াদ সমাপ্ত হয়েছে। আপনি ডিজিটাল স্বাক্ষরের মাধ্যমে মূলধন উত্তোলনের রিকোয়েস্ট দিতে পারেন।'
                : `চুক্তির শর্তানুযায়ী ${toBengaliNumber(durationDays)} দিনের মেয়াদের পূর্বে মূলধন উত্তোলন করা যাবে না। মেয়াদ সমাপ্তির তারিখ: ${maturityDateFormatted}। মেয়াদ পূর্ণ হলে মূলধন উত্তোলন উন্মুক্ত হবে।`}
            </p>
          </div>

          <button
            type="button"
            onClick={openWithdrawalModal}
            className={`py-2.5 px-5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition active:scale-95 cursor-pointer shrink-0 ${
              isTermMatured
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40'
            }`}
          >
            {isTermMatured ? (
              <>
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>টাকা উত্তোলনের ফর্ম পূরণ করুন</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-400" />
                <span>উত্তোলন শর্ত ও স্থিতি দেখুন</span>
              </>
            )}
          </button>
        </div>

        {/* Withdrawal History & Printable Vouchers Register */}
        <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
            <div className="flex items-center gap-2 font-black text-white text-sm sm:text-base">
              <Receipt className="w-5 h-5 text-amber-400" />
              <span>আপনার টাকা উত্তোলন ইতিহাস ও ভাউচার রেজিস্টার</span>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
              মোট উত্তোলন: {toBengaliNumber(myWithdrawals.length)} টি
            </span>
          </div>

          {myWithdrawals.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Receipt className="w-10 h-10 mx-auto opacity-30 text-amber-400" />
              <p className="font-bold text-slate-400 text-xs">
                আপনি এখনও কোনো অর্থ উত্তোলন করেননি।
              </p>
              <p className="text-[11px] text-slate-500">
                মুনাফা বা মূলধনের টাকা উত্তোলন করতে উপরের "টাকা উত্তোলনের ফর্ম পূরণ করুন" বাটনে চাপ দিন।
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myWithdrawals.map((wth) => {
                const typeLabels: Record<WithdrawalType, string> = {
                  capital_partial: 'মূলধন আংশিক ফেরত',
                  capital_full: 'সম্পূর্ণ মূলধন প্রত্যাহার',
                  profit_monthly: 'মাসিক লভ্যাংশ উত্তোলন',
                  profit_annual: 'বাৎসরিক লভ্যাংশ উত্তোলন',
                };

                const statusBadge =
                  wth.status === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                    : wth.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-400/30';

                const statusLabel =
                  wth.status === 'pending'
                    ? '⏳ অনুমোদনের অপেক্ষায়'
                    : wth.status === 'completed'
                    ? '✓ পরিশোধ সম্পন্ন'
                    : '✓ অনুমোদিত';

                return (
                  <div
                    key={wth.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                          {wth.voucherNo || wth.id}
                        </span>
                        <span className="text-xs font-black text-white">
                          {typeLabels[wth.withdrawalType] || wth.withdrawalType}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusBadge}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 space-y-0.5">
                        <p>
                          তারিখ: <b>{formatDateBn(wth.withdrawalDate)}</b> | মাধ্যম: <b>{wth.paymentMethod}</b>
                          {wth.bankName && ` (${wth.bankName})`}
                          {wth.chequeOrTxnNo && ` | রেফারেন্স: ${wth.chequeOrTxnNo}`}
                        </p>
                        {wth.reasonOrNote && (
                          <p className="text-slate-400 italic">বিবরণ: {wth.reasonOrNote}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">উত্তোলিত অর্থ:</span>
                        <span className="text-lg font-black text-amber-400 font-mono">
                          ৳ {formatMoney(wth.amount)}
                        </span>
                      </div>

                      {/* 1-Click Print Voucher Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedVoucherDoc(wth)}
                        className="py-1.5 px-3 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer border border-blue-400/30 shrink-0"
                        title="A4 সাইজ টাকা উত্তোলন ভাউচার ও রসিদ প্রিন্ট করুন"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>ভাউচার প্রিন্ট</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}

        {(portalTab === 'all' || portalTab === 'documents') && (
          <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2 font-black text-white text-sm sm:text-base">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span>চুক্তিপত্র, জমার রসিদ ও ব্যক্তিগত তথ্য</span>
              </div>
              <span className="text-xs font-mono text-amber-300">{loggedInInvestor.agreementNo}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-amber-300 mb-1">বিনিয়োগকারীর পরিচিতি</div>
                <p className="text-slate-300">পিতা/স্বামী: <b className="text-white">{loggedInInvestor.investorFatherOrSpouse || '—'}</b></p>
                <p className="text-slate-300">জাতীয় পরিচয়পত্র (NID): <b className="text-white font-mono">{loggedInInvestor.investorNid || '—'}</b></p>
                <p className="text-slate-300">ঠিকানা: <b className="text-white">{loggedInInvestor.investorPresentAddress || '—'}</b></p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-emerald-300 mb-1">নমিনি ও চুক্তির মেয়াদ</div>
                <p className="text-slate-300">নমিনি: <b className="text-white">{loggedInInvestor.nomineeName || '—'} ({loggedInInvestor.nomineeRelation || '—'})</b></p>
                <p className="text-slate-300">বিনিয়োগের তারিখ: <b className="text-white font-mono">{formatDateBn(loggedInInvestor.investmentDate)}</b></p>
                <p className="text-slate-300">মেয়াদ সমাপ্তির তারিখ: <b className="text-amber-300 font-mono">{maturityDateFormatted}</b></p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => setSelectedAgreementDoc(loggedInInvestor)}
                className="py-2 px-4 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>A4 চুক্তিপত্র দেখুন ও প্রিন্ট করুন</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceiptDoc(loggedInInvestor)}
                className="py-2 px-4 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>টাকা জমার মানি রিসিট দেখুন</span>
              </button>
              <button
                type="button"
                onClick={() => setShowClaimHistoryModal(true)}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>দৈনিক মুনাফা ক্লেমের ইতিহাস</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ================= 3. WITHDRAWAL APPLICATION & SIGNATURE FORM MODAL ================= */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white rounded-3xl max-w-xl w-full shadow-2xl border border-amber-400/40 overflow-hidden my-4 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-slate-950 p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-md">
                  <DollarSign className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-950">
                    টাকা উত্তোলনের আবেদন ও ভাউচার
                  </h3>
                  <p className="text-[11px] font-bold text-slate-900/80">
                    উত্তোলন ভাউচারের জন্য আপনার স্বাক্ষরের ছবি আপলোড করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawalModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950/20 hover:bg-slate-950 text-slate-950 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitWithdrawal} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {wthFormError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-bold flex items-start gap-2 whitespace-pre-line">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{wthFormError}</span>
                </div>
              )}

              {/* Investor Info Recap */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">বিনিয়োগকারী:</span>
                  <strong className="text-white">{loggedInInvestor.investorName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">অবশিষ্ট মূলধন:</span>
                  <strong className="text-emerald-400 font-mono">৳ {formatMoney(remainingCapital)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ক্লেমকৃত মুনাফা ব্যালেন্স:</span>
                  <strong className="text-amber-300 font-mono">৳ {formatMoney(availableClaimedProfit)}</strong>
                </div>
              </div>

              {/* Term Maturity Lock Card */}
              {!isTermMatured && (
                <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-100 space-y-2">
                  <div className="flex items-center gap-2 font-black text-white text-xs sm:text-sm">
                    <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>মেয়াদ পূর্ণ হওয়ার আগে টাকা উত্তোলন রিকোয়েস্ট বন্ধ</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-200">
                    চুক্তির শর্তানুযায়ী আপনি <b>{toBengaliNumber(durationDays)} দিনের মেয়াদে</b> ডিপোজিট করেছেন। নির্ধারিত মেয়াদের পূর্বে উত্তোলন রিকোয়েস্ট দেওয়া যাবে না।
                  </p>
                  <div className="p-2.5 bg-black/40 rounded-xl border border-rose-400/30 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-300">মেয়াদ উত্তীর্ণের তারিখ: <b className="text-white font-mono">{maturityDateFormatted}</b></span>
                    <span className="text-amber-300 font-mono">আর {toBengaliNumber(daysUntilMaturity)} দিন বাকি</span>
                  </div>
                  <p className="text-[10.5px] text-rose-300 italic">
                    * তবে আপনি প্রতিদিন ২৪ ঘণ্টায় ১ বার আপনার অর্জিত দৈনিক মুনাফা পোর্টাল থেকে সরাসরি ক্লেম করতে পারবেন।
                  </p>
                </div>
              )}

              {/* Amount & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-amber-200 mb-1">
                    উত্তোলনের ধরন *
                  </label>
                  <select
                    value={wthType}
                    onChange={(e) => {
                      const nextType = e.target.value as WithdrawalType;
                      setWthType(nextType);
                      if (nextType === 'capital_full') {
                        setWthAmount(remainingCapital);
                      } else if (nextType === 'profit_monthly' || nextType === 'profit_annual') {
                        setWthAmount(availableClaimedProfit > 0 ? availableClaimedProfit : '');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white focus:border-amber-400 outline-none"
                  >
                    <option value="profit_monthly">মাসিক লভ্যাংশ উত্তোলন</option>
                    <option value="profit_annual">বাৎসরিক লভ্যাংশ উত্তোলন</option>
                    <option value="capital_partial">মূলধন আংশিক ফেরত উত্তোলন</option>
                    <option value="capital_full">সম্পূর্ণ মূলধন প্রত্যাহার</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-amber-200 mb-1">
                    টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={wthAmount}
                    onChange={(e) => setWthAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="টাকার পরিমাণ লিখুন"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono font-black text-amber-300 text-sm focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-200 mb-1">
                    উত্তোলনের তারিখ *
                  </label>
                  <input
                    type="date"
                    required
                    value={wthDate}
                    onChange={(e) => setWthDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-200 mb-1">
                    পরিশোধের মাধ্যম *
                  </label>
                  <select
                    value={wthPaymentMethod}
                    onChange={(e) => setWthPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white focus:border-amber-400 outline-none"
                  >
                    <option value="bank">ব্যাংক ট্রান্সফার (Bank)</option>
                    <option value="cash">নগদ ক্যাশ (Cash)</option>
                    <option value="cheque">ব্যাংক চেক (Cheque)</option>
                    <option value="bkash">বিকাশ (bKash)</option>
                    <option value="nagad">নগদ (Nagad)</option>
                  </select>
                </div>

                {wthPaymentMethod === 'bank' && (
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">ব্যাংকের নাম</label>
                      <input
                        type="text"
                        value={wthBankName}
                        onChange={(e) => setWthBankName(e.target.value)}
                        placeholder="যেমন: ইসলামী ব্যাংক বাংলাদেশ লিঃ"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">একাউন্ট নম্বর</label>
                      <input
                        type="text"
                        value={wthAccountNo}
                        onChange={(e) => setWthAccountNo(e.target.value)}
                        placeholder="একাউন্ট নং"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block font-bold text-amber-200 mb-1">
                    {wthPaymentMethod === 'bkash' || wthPaymentMethod === 'nagad'
                      ? 'বিকাশ / নগদ রিসিভার নম্বর বা রেফারেন্স (ঐচ্ছিক)'
                      : 'চেক নম্বর / ট্রানজেকশন রেফারেন্স (ঐচ্ছিক)'}
                  </label>
                  <input
                    type="text"
                    value={wthChequeOrTxn}
                    onChange={(e) => setWthChequeOrTxn(e.target.value)}
                    placeholder={
                      wthPaymentMethod === 'bkash' || wthPaymentMethod === 'nagad'
                        ? 'যেমন: 017xxxxxxxx'
                        : 'যেমন: CHQ-1024 বা TXN-9988'
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-amber-200 mb-1">
                    উত্তোলনের কারণ বা বিশেষ বিবরণ (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={wthReason}
                    onChange={(e) => setWthReason(e.target.value)}
                    placeholder="যেমন: মেয়াদ পরবর্তী অর্জিত মুনাফা / মূলধন গ্রহণ..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                  />
                </div>
              </div>

              {/* SIGNATURE SECTION: স্বাক্ষরের ছবি আপলোড */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-amber-400/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <span className="font-black text-amber-300 text-xs flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>বিনিয়োগকারীর স্বাক্ষরের ছবি আপলোড *</span>
                  </span>
                  <div className="flex items-center gap-3">
                    {loggedInInvestor.investorSignatureUrl && !uploadedSignatureUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedSignatureUrl(loggedInInvestor.investorSignatureUrl || '');
                          showToast('✓ সংরক্ষিত স্বাক্ষর যুক্ত হয়েছে');
                        }}
                        className="text-[10.5px] text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        সংরক্ষিত স্বাক্ষর ব্যবহার করুন
                      </button>
                    )}
                    {uploadedSignatureUrl && (
                      <button
                        type="button"
                        onClick={handleClearUploadedSignature}
                        className="text-[10.5px] text-rose-400 hover:underline font-bold cursor-pointer"
                      >
                        স্বাক্ষর মুছুন
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10.5px] text-slate-400 block">
                    👉 কাগজের উপর করা আপনার স্বাক্ষরের স্পষ্ট ছবি নির্বাচন বা ক্যামেরা দিয়ে তুলুন:
                  </span>

                  <input
                    type="file"
                    ref={sigFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleSignatureFileUpload}
                  />

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => sigFileInputRef.current?.click()}
                      className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40 font-bold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95 shadow-md"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{uploadedSignatureUrl ? 'স্বাক্ষরের ছবি পরিবর্তন' : '📁 স্বাক্ষরের ছবি আপলোড করুন'}</span>
                    </button>

                    {uploadedSignatureUrl && (
                      <div className="w-28 h-14 border border-amber-400/50 bg-white rounded-xl p-1.5 flex items-center justify-center overflow-hidden shadow-sm">
                        <img
                          src={uploadedSignatureUrl}
                          alt="Uploaded Signature"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWithdrawalModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWth || !isTermMatured}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition active:scale-95 cursor-pointer ${
                    !isTermMatured
                      ? 'bg-slate-800 text-amber-300 border border-amber-400/40 opacity-70 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950'
                  }`}
                >
                  {!isTermMatured ? <Lock className="w-4 h-4 text-amber-400" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  <span>
                    {!isTermMatured
                      ? `মেয়াদ উত্তীর্ণের আগে উত্তোলন বন্ধ (আর ${toBengaliNumber(daysUntilMaturity)} দিন)`
                      : isSubmittingWth
                      ? 'প্রসেসিং হচ্ছে...'
                      : 'উত্তোলন ভাউচার সম্পন্ন করুন'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 3B. DAILY PROFIT CLAIM HISTORY MODAL ================= */}
      {showClaimHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white rounded-3xl max-w-xl w-full shadow-2xl border border-amber-400/40 overflow-hidden my-4 flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-amber-600 to-amber-800 text-slate-950 p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-md">
                  <History className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-950">
                    দৈনিক মুনাফা ক্লেম হিস্ট্রি ও রেজিস্টার
                  </h3>
                  <p className="text-[11px] font-bold text-slate-900/80">
                    প্রতি ২৪ ঘণ্টায় ১ বার ক্লেমকৃত দৈনিক লভ্যাংশের তালিকা
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClaimHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950/20 hover:bg-slate-950 text-slate-950 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10.5px] text-slate-400 block">মোট ক্লেম সম্পন্ন:</span>
                  <span className="text-base font-black text-amber-400 font-mono">
                    {toBengaliNumber(claimedDaysCount)} / {toBengaliNumber(durationDays)} দিন
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10.5px] text-slate-400 block">মোট অর্জিত মুনাফা:</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    ৳ {formatMoney(loggedInInvestor.totalProfitClaimed || 0)}
                  </span>
                </div>
              </div>

              {/* Claims List */}
              {(!loggedInInvestor.profitClaimHistory || loggedInInvestor.profitClaimHistory.length === 0) ? (
                <div className="py-10 text-center text-slate-400 space-y-2">
                  <Gift className="w-10 h-10 mx-auto opacity-30 text-amber-400" />
                  <p className="font-bold text-slate-300">এখনও কোনো দৈনিক মুনাফা ক্লেম করা হয়নি</p>
                  <p className="text-[11px] text-slate-500">
                    প্রতি ২৪ ঘণ্টা পর পর ড্যাশবোর্ডের "আজকের মুনাফা ক্লেম করুন" বাটনে চাপ দিয়ে মুনাফা জমা করুন।
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {loggedInInvestor.profitClaimHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 font-black text-xs flex items-center justify-center">
                          {toBengaliNumber(item.dayIndex || idx + 1)}
                        </span>
                        <div>
                          <div className="font-bold text-white text-xs">
                            {toBengaliNumber(item.dayIndex || idx + 1)}ম দিনের দৈনিক মুনাফা
                          </div>
                          <span className="text-[10.5px] text-slate-400">
                            তারিখ: {formatDateBn(item.date)} ({new Date(item.claimedAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-400 font-mono">
                          +৳ {formatMoney(item.amount)}
                        </span>
                        <span className="text-[9.5px] text-emerald-300/80 block font-bold">
                          ✓ সফলভাবে যুক্ত
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowClaimHistoryModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3C. OFFICIAL PLANS & PROFIT CALCULATOR MODAL ================= */}
      {showCalculatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white rounded-3xl max-w-xl w-full shadow-2xl border border-emerald-400/40 overflow-hidden my-4 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-950 text-emerald-400 flex items-center justify-center shadow-md">
                  <Calculator className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    অফিশিয়াল ইনভেস্টমেন্ট প্ল্যান ও প্রফিট ক্যালকুলেটর
                  </h3>
                  <p className="text-[11px] font-bold text-emerald-100/90">
                    মিনিমাম ডিপোজিট ১,০০০ টাকা • ২৪ ঘণ্টায় ১ বার দৈনিক মুনাফা ক্লেম
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCalculatorModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Amount input */}
              <div>
                <label className="block font-bold text-amber-200 mb-1">
                  বিনিয়োগের টাকার অঙ্ক (মিনিমাম ১,০০০ টাকা) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-base font-black text-amber-300 outline-none focus:border-amber-400"
                    placeholder="যেমন: ১০০০, ৫০০০, ১০০০০"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    টাকা (BDT)
                  </span>
                </div>
                {Number(calcAmount) < 1000 && (
                  <span className="text-[10.5px] text-rose-400 mt-1 block">
                    * মিনিমাম ডিপোজিট ১,০০০ টাকা
                  </span>
                )}
              </div>

              {/* 6 Plan buttons */}
              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  মেয়াদ ও মুনাফার হার নির্বাচন করুন:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INVESTMENT_PLANS.map((plan) => {
                    const isSelected = calcPlanDays === plan.days;
                    return (
                      <button
                        key={plan.days}
                        type="button"
                        onClick={() => setCalcPlanDays(plan.days)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-md scale-[1.02]'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold">{toBengaliNumber(plan.days)} দিন</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                            isSelected ? 'bg-slate-950 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {toBengaliNumber(plan.ratePercent)}% লাভ
                          </span>
                        </div>
                        <span className={`text-[10px] mt-1.5 ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                          ২৪ ঘণ্টায় ১ বার ক্লেম
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calculated Results */}
              {(() => {
                const num = Math.max(1000, Number(calcAmount) || 0);
                const currentPlan = INVESTMENT_PLANS.find((p) => p.days === calcPlanDays) || INVESTMENT_PLANS[2];
                const totalProfit = Math.round((num * currentPlan.ratePercent) / 100);
                const dailyProfit = Math.round((totalProfit / currentPlan.days) * 100) / 100;
                const grandTotal = num + totalProfit;

                return (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-slate-950 border border-emerald-400/40 space-y-3">
                    <div className="font-black text-amber-300 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>হিসাবকৃত ফলাফল বিবরণী ({toBengaliNumber(currentPlan.days)} দিনের প্ল্যান)</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">দৈনিক মুনাফা (২৪ ঘণ্টায়):</span>
                        <span className="text-sm font-black text-emerald-300 font-mono">৳ {formatMoney(dailyProfit)}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">মোট অর্জিত মুনাফা:</span>
                        <span className="text-sm font-black text-amber-400 font-mono">৳ {formatMoney(totalProfit)}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 block">মেয়াদ শেষে মোট ফেরত:</span>
                        <span className="text-sm font-black text-white font-mono">৳ {formatMoney(grandTotal)}</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-400/10 rounded-xl border border-amber-400/20 text-[10.5px] text-amber-200/90 space-y-1">
                      <p><b>শর্তাবলী:</b></p>
                      <p>১. প্রতিদিন (২৪ ঘণ্টায় ১ বার) আপনার একাউন্টে ৳ {formatMoney(dailyProfit)} টাকা ক্লেম করতে পারবেন।</p>
                      <p>২. নির্বাচিত {toBengaliNumber(currentPlan.days)} দিনের মেয়াদের পূর্বে মূলধন উত্তোলন করা যাবে না। মেয়াদ শেষে সম্পূর্ণ মূলধন ৳ {formatMoney(num)} টাকা উত্তোলন করা যাবে।</p>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCalculatorModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. OFFICIAL A4 WITHDRAWAL VOUCHER & RECEIPT MODAL (1-CLICK PRINT & PDF) ================= */}
      {selectedVoucherDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-300 overflow-hidden my-4 flex flex-col max-h-[92vh]">
            {/* Modal Top Bar */}
            <div className="bg-slate-900 text-white p-3.5 sm:px-6 flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="font-bold text-sm text-white">
                    A4 টাকা উত্তোলন ভাউচার ও রসিদ — {selectedVoucherDoc.voucherNo || selectedVoucherDoc.id}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    বিনিয়োগকারীর মূলধন / মুনাফা বুঝিয়া পাওয়ার অফিশিয়াল প্রত্যয়নপত্র
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDoc}
                  className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4 stroke-[2.5]" />
                  <span>১-ক্লিকে A4 প্রিন্ট</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoucherDoc(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Container */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100/60 print:p-0 print:bg-white">
              <div
                id="printableA4WithdrawalVoucher"
                className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white p-8 sm:p-12 shadow-md print:shadow-none border border-slate-200 print:border-none text-slate-900 space-y-6 relative"
                style={{ fontFamily: 'sans-serif' }}
              >
                {/* Official Factory Header */}
                <div className="text-center pb-4 border-b-2 border-slate-800 space-y-1">
                  <div className="inline-block px-3 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest mb-1">
                    Official Investment Withdrawal Voucher & Acknowledgment
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                    {factory.name || 'টেক্স ওয়ার অ্যাপারেলস'}
                  </h1>
                  <p className="text-xs text-slate-700 font-medium">
                    {factory.address || 'কোনাবাড়ী শিল্প এলাকা, গাজীপুর-১৭০০'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    ফোন: {factory.phone}
                  </p>
                </div>

                {/* Voucher Meta Tracking Bar */}
                <div className="flex items-center justify-between text-xs font-bold py-2 border-b border-dashed border-slate-300">
                  <div>
                    <span className="text-slate-500 font-normal">ভাউচার / স্মারক নং: </span>
                    <span className="font-mono text-slate-950">{selectedVoucherDoc.voucherNo || selectedVoucherDoc.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">তারিখ: </span>
                    <span className="font-mono text-slate-950">{formatDateBn(selectedVoucherDoc.withdrawalDate)}</span>
                  </div>
                </div>

                {/* Voucher Heading */}
                <div className="text-center py-2 bg-amber-50 rounded-xl border border-amber-300">
                  <h2 className="text-base sm:text-lg font-black text-slate-950">
                    বিনিয়োগের অর্থ / লভ্যাংশ উত্তোলন ও প্রাপ্তিস্বীকার রসিদ
                  </h2>
                  <p className="text-[11px] text-amber-900 font-bold">
                    {selectedVoucherDoc.status === 'pending'
                      ? '[ বিনিয়োগকারী কর্তৃক দাখিলকৃত — হিসাব বিভাগ অনুমোদনের অপেক্ষায় ]'
                      : '[ কারখানা প্রশাসন ও হিসাব বিভাগ কর্তৃক অনুমোদিত ]'}
                  </p>
                </div>

                {/* Details Section */}
                <div className="space-y-4 text-xs leading-relaxed">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-slate-900">
                      অত্র ভাউচারের মাধ্যমে এই মর্মে প্রত্যয়ন করা যাইতেছে যে, কারখানা বিনিয়োগকারী অংশীদার:
                    </p>
                    <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-slate-200 font-bold">
                      <div>
                        <span className="text-slate-500 font-normal">বিনিয়োগকারীর নাম: </span>
                        <span className="text-slate-950">{selectedVoucherDoc.investorName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-normal">মোবাইল নম্বর: </span>
                        <span className="text-slate-950 font-mono">{selectedVoucherDoc.investorMobile}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-normal">মূল চুক্তি নম্বর: </span>
                        <span className="text-slate-950 font-mono">{selectedVoucherDoc.agreementNo}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-normal">উত্তোলনের খাত: </span>
                        <span className="text-amber-900">
                          {selectedVoucherDoc.withdrawalType === 'capital_partial'
                            ? 'মূলধন আংশিক ফেরত'
                            : selectedVoucherDoc.withdrawalType === 'capital_full'
                            ? 'সম্পূর্ণ মূলধন প্রত্যাহার'
                            : selectedVoucherDoc.withdrawalType === 'profit_monthly'
                            ? 'মাসিক লভ্যাংশ উত্তোলন'
                            : 'বাৎসরিক মুনাফা'}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-900 pt-1">
                      তাঁহার বিনিয়োগ চুক্তির অনুকূলে কারখানা কর্তৃপক্ষ হইতে নিম্নে বর্ণিত অর্থ নগদ / ব্যাংক / চেক মারফত স্বজ্ঞানে বুঝিয়া গ্রহণ করিলেন:
                    </p>

                    {/* Amount Banner */}
                    <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-400 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-emerald-800 font-bold block">
                          উত্তোলিত মোট টাকার অংক:
                        </span>
                        <span className="text-2xl font-black text-emerald-950 font-mono block">
                          ৳ {formatMoney(selectedVoucherDoc.amount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-emerald-800 font-bold block">কথায়:</span>
                        <span className="text-sm font-black text-emerald-900">
                          {numberToBengaliWords(selectedVoucherDoc.amount)}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11.5px] text-slate-700 space-y-1 pt-1">
                      <p>
                        <b>পরিশোধের মাধ্যম:</b> {selectedVoucherDoc.paymentMethod}
                        {selectedVoucherDoc.bankName && ` • ব্যাংক: ${selectedVoucherDoc.bankName}`}
                        {selectedVoucherDoc.chequeOrTxnNo && ` • ট্রানজেকশন/চেক নং: ${selectedVoucherDoc.chequeOrTxnNo}`}
                      </p>
                      {selectedVoucherDoc.reasonOrNote && (
                        <p><b>উত্তোলনের বিবরণ বা কারণ:</b> {selectedVoucherDoc.reasonOrNote}</p>
                      )}
                    </div>
                  </div>

                  {/* Legal Release Statement */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-800">
                    <p className="font-bold text-slate-950 mb-1">বিনিয়োগকারীর সম্মতি ও প্রাপ্তিস্বীকার ঘোষণা:</p>
                    <p className="leading-relaxed">
                      "আমি অত্র ভাউচারে উল্লিখিত সর্বমোট <b>৳ {formatMoney(selectedVoucherDoc.amount)}</b> (<span className="underline font-bold">{numberToBengaliWords(selectedVoucherDoc.amount)}</span>) টাকা কারখানা কর্তৃপক্ষ হইতে পূর্ণ সন্তুষ্টির সাথে বুঝিয়া পাইলাম এবং অত্র রসিদে নিজ স্বাক্ষরে তাহা স্বীকার করিলাম।"
                    </p>
                  </div>
                </div>

                {/* Signatures Grid */}
                <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs">
                  {/* Verified Investor Signature */}
                  <div className="space-y-2">
                    <div className="h-16 flex items-end justify-center pb-1">
                      {selectedVoucherDoc.investorSignatureUrl ? (
                        <img
                          src={selectedVoucherDoc.investorSignatureUrl}
                          alt="Investor Signature"
                          className="max-h-14 max-w-[140px] object-contain"
                        />
                      ) : (
                        <div className="w-32 border-b border-slate-400" />
                      )}
                    </div>
                    <div className="border-t-2 border-slate-800 pt-1">
                      <p className="font-bold text-slate-950">{selectedVoucherDoc.investorName}</p>
                      <p className="text-[10px] text-slate-600 font-bold">গ্রহীতা / বিনিয়োগকারীর স্বাক্ষর</p>
                    </div>
                  </div>

                  {/* Cashier / Accounts */}
                  <div className="space-y-2">
                    <div className="h-16 flex items-end justify-center pb-1">
                      <div className="w-32 border-b border-slate-400" />
                    </div>
                    <div className="border-t-2 border-slate-800 pt-1">
                      <p className="font-bold text-slate-950">হিসাবরক্ষণ কর্মকর্তা</p>
                      <p className="text-[10px] text-slate-600 font-bold">ক্যাশ ও একাউন্টস শাখা</p>
                    </div>
                  </div>

                  {/* Factory MD / Official Stamp */}
                  <div className="space-y-2">
                    <div className="h-16 flex items-end justify-center pb-1">
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center text-[9px] text-slate-400 uppercase font-black">
                        অফিস সিল
                      </div>
                    </div>
                    <div className="border-t-2 border-slate-800 pt-1">
                      <p className="font-bold text-slate-950">ব্যবস্থাপনা কর্তৃপক্ষ</p>
                      <p className="text-[10px] text-slate-600 font-bold">{factory.name}</p>
                    </div>
                  </div>
                </div>

                {/* Footer Meta */}
                <div className="pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-0.5">
                  <p>© {factory.name} — বিনিয়োগ হিসাব বিভাগ • ভাউচার আইডি: {selectedVoucherDoc.id}</p>
                  <p>মুদ্রণ তারিখ: {new Date().toLocaleDateString('bn-BD')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 5. A4 OFFICIAL AGREEMENT MODAL ================= */}
      {selectedAgreementDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden my-4 flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-3.5 sm:px-6 flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-sm text-white">
                  A4 বিনিয়োগ চুক্তিপত্র — {selectedAgreementDoc.agreementNo}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDoc}
                  className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4 stroke-[2.5]" />
                  <span>১-ক্লিকে A4 প্রিন্ট</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAgreementDoc(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100/60 print:p-0 print:bg-white">
              <div
                id="printableA4InvestmentAgreement"
                className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white p-8 sm:p-12 shadow-md print:shadow-none border border-slate-200 print:border-none text-slate-900 space-y-6 relative"
                style={{ fontFamily: 'sans-serif' }}
              >
                <div className="text-center pb-4 border-b-2 border-slate-800 space-y-1">
                  <div className="inline-block px-3 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest mb-1">
                    Official Investment Agreement & Deed of Partnership
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                    {factory.name}
                  </h1>
                  <p className="text-xs text-slate-700 font-medium">
                    {factory.address}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    ফোন: {factory.phone}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs font-bold py-2 border-b border-dashed border-slate-300">
                  <div>
                    <span className="text-slate-500 font-normal">স্মারক নং: </span>
                    <span className="font-mono text-slate-900">{selectedAgreementDoc.agreementNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">তারিখ: </span>
                    <span className="font-mono text-slate-900">{formatDateBn(selectedAgreementDoc.investmentDate)}</span>
                  </div>
                </div>

                <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-300">
                  <h2 className="text-base sm:text-lg font-black text-slate-950">
                    ব্যবসায়িক বিনিয়োগ ও লাভ-ক্ষতি বণ্টন চুক্তিপত্র
                  </h2>
                </div>

                {/* Parties */}
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-slate-950">১ম পক্ষ (কারখানা কর্তৃপক্ষ):</p>
                    <p className="text-slate-800"><b>{factory.name}</b>, ঠিকানা: {factory.address}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="font-black text-slate-950">২য় পক্ষ (বিনিয়োগকারী অংশীদার):</p>
                      <p className="text-slate-900"><b>নাম:</b> {selectedAgreementDoc.investorName} | <b>পিতা/স্বামী:</b> {selectedAgreementDoc.investorFatherOrSpouse || '—'}</p>
                      <p className="text-slate-800"><b>মোবাইল:</b> {selectedAgreementDoc.investorMobile} | <b>NID:</b> {selectedAgreementDoc.investorNid}</p>
                      <p className="text-slate-800"><b>ঠিকানা:</b> {selectedAgreementDoc.investorPresentAddress}</p>
                    </div>
                    {selectedAgreementDoc.investorPhotoUrl && (
                      <div className="w-20 h-24 border border-slate-300 rounded-lg overflow-hidden shrink-0 self-center sm:self-start bg-white">
                        <img
                          src={selectedAgreementDoc.investorPhotoUrl}
                          alt={selectedAgreementDoc.investorName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-slate-950">মনোনীত নমিনি (উত্তরাধিকারী):</p>
                    <p className="text-slate-800"><b>নাম:</b> {selectedAgreementDoc.nomineeName} ({selectedAgreementDoc.nomineeRelation})</p>
                  </div>
                </div>

                {/* Amount & Plan Terms */}
                {(() => {
                  const docDays = selectedAgreementDoc.durationDays || (selectedAgreementDoc.durationMonths ? selectedAgreementDoc.durationMonths * 30 : 30);
                  const docMatDate = formatDateBn(safeDateToYmd(safeParseDateMs(selectedAgreementDoc.investmentDate) + docDays * 86400000));
                  return (
                    <>
                      <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-400 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-emerald-800 font-bold block">বিনিয়োগকৃত মোট অর্থ:</span>
                          <span className="text-2xl font-black text-emerald-950 font-mono">
                            ৳ {formatMoney(selectedAgreementDoc.amount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-800 font-bold block">নির্বাচিত প্ল্যান ও মুনাফা:</span>
                          <span className="text-base font-black text-emerald-900">
                            {toBengaliNumber(docDays)} দিন মেয়াদে {toBengaliNumber(selectedAgreementDoc.profitRatePercent || 0)}%
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-800 space-y-1.5 leading-relaxed">
                        <p>
                          <b>মেয়াদ ও মুনাফা শর্ত:</b> এই চুক্তির মেয়াদ <b>{toBengaliNumber(docDays)} দিন</b> (সমাপ্তি তারিখ: <b>{docMatDate}</b>)। ২য় পক্ষ ২৪ ঘণ্টায় ১ বার নির্ধারিত হারে দৈনিক মুনাফা ক্লেম করিতে পারিবেন এবং মেয়াদ পূর্ণ হওয়ার পর সম্পূর্ণ মূলধন ফেরত উত্তোলনের আবেদন করিতে পারিবেন। মেয়াদের পূর্বে মূলধন উত্তোলন প্রযোজ্য হইবে না।
                        </p>
                      </div>
                    </>
                  );
                })()}

                {/* Signatures */}
                <div className="pt-10 grid grid-cols-2 gap-8 text-center text-xs">
                  <div className="space-y-2">
                    <div className="h-14 flex items-end justify-center">
                      {selectedAgreementDoc.investorSignatureUrl ? (
                        <img
                          src={selectedAgreementDoc.investorSignatureUrl}
                          alt="Signature"
                          className="max-h-12 max-w-[140px] object-contain"
                        />
                      ) : (
                        <div className="w-32 border-b border-slate-400" />
                      )}
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold">
                      বিনিয়োগকারীর স্বাক্ষর
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-14 flex items-end justify-center">
                      <div className="w-32 border-b border-slate-400" />
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold">
                      কারখানা কর্তৃপক্ষের স্বাক্ষর ও সিল
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. OFFICIAL MONEY RECEIPT MODAL ================= */}
      {selectedReceiptDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-300 overflow-hidden my-4 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-3.5 sm:px-6 flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-sm text-white">
                  টাকা প্রাপ্তির মানি রিসিট — {selectedReceiptDoc.agreementNo}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDoc}
                  className="py-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>প্রিন্ট রসিদ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptDoc(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <div id="printableMoneyReceipt" className="p-6 bg-amber-50/40 rounded-2xl border-2 border-slate-800 space-y-4 text-slate-900">
                <div className="text-center pb-3 border-b-2 border-slate-800 space-y-0.5">
                  <h2 className="text-2xl font-black text-slate-950">{factory.name}</h2>
                  <p className="text-xs text-slate-600">{factory.address}</p>
                  <div className="inline-block px-3 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-black uppercase mt-1">
                    বিনিয়োগ মূলধন জমা রসিদ (Money Receipt)
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold">
                  <span>রসিদ নং: <b className="font-mono">{selectedReceiptDoc.agreementNo}</b></span>
                  <span>তারিখ: <b className="font-mono">{formatDateBn(selectedReceiptDoc.investmentDate)}</b></span>
                </div>

                <div className="text-xs space-y-2 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                  <p>
                    বিনিয়োগকারী জনাব/জনাবা <b>{selectedReceiptDoc.investorName}</b> (মোবাইল: {selectedReceiptDoc.investorMobile})-এর নিকট হইতে কারখানার উৎপাদন ও ব্যবসা সম্প্রসারণের জন্য সর্বমোট নিম্নের অর্থ বুঝিয়া পাওয়া গেল:
                  </p>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center justify-between">
                    <span className="font-black text-emerald-950 text-base">
                      ৳ {formatMoney(selectedReceiptDoc.amount)}
                    </span>
                    <span className="font-bold text-emerald-800">
                      ({numberToBengaliWords(selectedReceiptDoc.amount)})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    পরিশোধের মাধ্যম: <b>{selectedReceiptDoc.paymentMethod}</b>
                    {selectedReceiptDoc.bankName && ` • ব্যাংক: ${selectedReceiptDoc.bankName}`}
                    {selectedReceiptDoc.chequeOrTxnNo && ` • চেক/Txn: ${selectedReceiptDoc.chequeOrTxnNo}`}
                  </p>
                </div>

                <div className="pt-8 flex items-end justify-between text-xs">
                  <div className="text-center">
                    <div className="h-12 flex items-end justify-center mb-1">
                      {selectedReceiptDoc.investorSignatureUrl ? (
                        <img
                          src={selectedReceiptDoc.investorSignatureUrl}
                          alt="Investor Signature"
                          className="max-h-10 max-w-[110px] object-contain"
                        />
                      ) : (
                        <div className="w-28 border-b border-slate-600" />
                      )}
                    </div>
                    <div className="w-28 border-t border-slate-600 pt-1">
                      <span className="text-[11px] font-bold text-slate-700">বিনিয়োগকারীর স্বাক্ষর</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="h-12 flex items-end justify-center mb-1">
                      <div className="w-28 border-b border-slate-600" />
                    </div>
                    <div className="w-28 border-t border-slate-600 pt-1">
                      <span className="text-[11px] font-bold text-slate-900">গ্রহীতার স্বাক্ষর ও সিল</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
