import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  InvestmentRecord,
  FactorySettings,
  PaymentMethod,
  ProfitPayoutType,
  InvestmentStatus,
  InvestmentWithdrawalRecord,
  MINIMUM_INVESTMENT_AMOUNT,
  INVESTMENT_PLANS
} from '../types';
import {
  subscribeInvestments,
  saveOrUpdateInvestment,
  deleteInvestmentById,
  loadFactorySettings,
  blockInvestorProfile,
  unblockInvestorProfile,
  updateInvestorCredentials,
  subscribeWithdrawals,
  deleteWithdrawalById,
  updateWithdrawalStatus
} from '../lib/firebase';
import { formatMoney, toBengaliNumber, formatDateBn, numberToBengaliWords } from '../lib/utils';
import { getInvestorLoginUrl } from '../lib/userAuthLinks';
import { printElement } from '../lib/printer';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  Printer,
  FileText,
  DollarSign,
  User,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  Edit,
  ShieldCheck,
  Award,
  Receipt,
  Camera,
  Upload,
  Link,
  Copy,
  Unlock,
  Ban,
  Key,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  Check,
  Clock
} from 'lucide-react';

function safeParseDateMs(dateStr?: string): number {
  if (!dateStr) return Date.now();
  const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
    if (!isNaN(dt.getTime())) return dt.getTime();
  }
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

function safeDateToYmd(ms: number): string {
  const dt = new Date(isNaN(ms) ? Date.now() : ms);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

interface InvestmentHubProps {
  onBackToApp?: () => void;
  showToast: (msg: string) => void;
  isAdmin?: boolean;
}

const DEFAULT_FACTORY: FactorySettings = {
  name: 'টেক্স ওয়ার অ্যাপারেলস',
  nameEn: 'Texware Apparels Limited',
  address: 'বাড়ি #১২, রোড #০৪, কোনাবাড়ী শিল্প এলাকা, গাজীপুর-১৭০০',
  phone: '০১৭১২-৩৪৫৬৭৮, ০১৮৯৮-৭৬৫৪৩২',
  email: 'texwareapparels@gmail.com',
};

export const InvestmentHub: React.FC<InvestmentHubProps> = ({
  onBackToApp,
  showToast,
  isAdmin = true,
}) => {
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvestmentStatus>('all');
  
  // Active View Tab (বিনিয়োগ তালিকা নাকি টাকা উত্তোলন ভাউচার তালিকা)
  const [activeHubTab, setActiveHubTab] = useState<'investments' | 'withdrawals'>('investments');
  const [withdrawals, setWithdrawals] = useState<InvestmentWithdrawalRecord[]>([]);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<InvestmentRecord | null>(null);
  const [selectedAgreementDoc, setSelectedAgreementDoc] = useState<InvestmentRecord | null>(null);
  const [selectedReceiptDoc, setSelectedReceiptDoc] = useState<InvestmentRecord | null>(null);
  const [selectedVoucherDoc, setSelectedVoucherDoc] = useState<InvestmentWithdrawalRecord | null>(null);
  const [credentialModalInv, setCredentialModalInv] = useState<InvestmentRecord | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [tempBlockReason, setTempBlockReason] = useState('');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'success';
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);

  const liveCredentialModalInv = useMemo(() => {
    if (!credentialModalInv) return null;
    return investments.find((x) => x.id === credentialModalInv.id) || credentialModalInv;
  }, [investments, credentialModalInv]);

  // Form Fields State
  const [investorName, setInvestorName] = useState('');
  const [investorFatherOrSpouse, setInvestorFatherOrSpouse] = useState('');
  const [investorNid, setInvestorNid] = useState('');
  const [investorMobile, setInvestorMobile] = useState('');
  const [investorAltMobile, setInvestorAltMobile] = useState('');
  const [investorEmail, setInvestorEmail] = useState('');
  const [investorPresentAddress, setInvestorPresentAddress] = useState('');
  const [investorPermanentAddress, setInvestorPermanentAddress] = useState('');
  const [investorPhotoUrl, setInvestorPhotoUrl] = useState('');
  const [investorSignatureUrl, setInvestorSignatureUrl] = useState('');

  // Nominee
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('স্ত্রী');
  const [nomineeNid, setNomineeNid] = useState('');
  const [nomineeMobile, setNomineeMobile] = useState('');
  const [nomineeAddress, setNomineeAddress] = useState('');

  // Financials
  const [amount, setAmount] = useState<number | ''>(1000);
  const [investmentDate, setInvestmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationDays, setDurationDays] = useState<number>(30);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [profitRatePercent, setProfitRatePercent] = useState<number>(6);
  const [profitPayout, setProfitPayout] = useState<ProfitPayoutType>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | 'cheque'>('bank');
  const [bankName, setBankName] = useState('ইসলামী ব্যাংক বাংলাদেশ লিঃ');
  const [chequeOrTxnNo, setChequeOrTxnNo] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [witnessMobile, setWitnessMobile] = useState('');
  const [witnessAddress, setWitnessAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // File input refs for photo & signature upload
  const sigFileInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to investments, withdrawals & factory
  useEffect(() => {
    loadFactorySettings().then((res) => {
      if (res && res.name) setFactory(res);
    });

    const unsubInv = subscribeInvestments((list) => {
      setInvestments(list);
    });

    const unsubWth = subscribeWithdrawals((wthList) => {
      setWithdrawals(wthList);
    });

    return () => {
      unsubInv();
      unsubWth();
    };
  }, []);

  // Filtered investments
  const filteredInvestments = useMemo(() => {
    return investments.filter((item) => {
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.investorName.toLowerCase().includes(q) ||
        item.investorMobile.includes(q) ||
        item.investorNid.includes(q) ||
        item.agreementNo.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [investments, statusFilter, searchQuery]);

  // Aggregate Metrics
  const totalInvestedAmount = useMemo(() => {
    return investments
      .filter((i) => i.status === 'active')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [investments]);

  const activeInvestorsCount = useMemo(() => {
    return investments.filter((i) => i.status === 'active').length;
  }, [investments]);

  const totalMonthlyProfitPayable = useMemo(() => {
    return investments
      .filter((i) => i.status === 'active')
      .reduce((acc, curr) => {
        const p = Number(curr.amount) || 0;
        const rate = (Number(curr.profitRatePercent) || 0) / 100;
        return acc + Math.round(p * rate);
      }, 0);
  }, [investments]);

  // Reset Form
  const resetForm = () => {
    setEditingInvestment(null);
    setInvestorName('');
    setInvestorFatherOrSpouse('');
    setInvestorNid('');
    setInvestorMobile('');
    setInvestorAltMobile('');
    setInvestorEmail('');
    setInvestorPresentAddress('');
    setInvestorPermanentAddress('');
    setInvestorPhotoUrl('');
    setInvestorSignatureUrl('');
    setNomineeName('');
    setNomineeRelation('স্ত্রী');
    setNomineeNid('');
    setNomineeMobile('');
    setNomineeAddress('');
    setAmount(1000);
    setInvestmentDate(new Date().toISOString().slice(0, 10));
    setDurationDays(30);
    setDurationMonths(1);
    setProfitRatePercent(6);
    setProfitPayout('monthly');
    setPaymentMethod('bank');
    setBankName('ইসলামী ব্যাংক বাংলাদেশ লিঃ');
    setChequeOrTxnNo('');
    setWitnessName('');
    setWitnessMobile('');
    setWitnessAddress('');
    setNotes('');
    setFormError('');
  };

  // Open Edit Form
  const handleEdit = (inv: InvestmentRecord) => {
    setEditingInvestment(inv);
    setInvestorName(inv.investorName);
    setInvestorFatherOrSpouse(inv.investorFatherOrSpouse || '');
    setInvestorNid(inv.investorNid || '');
    setInvestorMobile(inv.investorMobile || '');
    setInvestorAltMobile(inv.investorAltMobile || '');
    setInvestorEmail(inv.investorEmail || '');
    setInvestorPresentAddress(inv.investorPresentAddress || '');
    setInvestorPermanentAddress(inv.investorPermanentAddress || '');
    setInvestorPhotoUrl(inv.investorPhotoUrl || '');
    setInvestorSignatureUrl(inv.investorSignatureUrl || '');
    setNomineeName(inv.nomineeName || '');
    setNomineeRelation(inv.nomineeRelation || 'স্ত্রী');
    setNomineeNid(inv.nomineeNid || '');
    setNomineeMobile(inv.nomineeMobile || '');
    setNomineeAddress(inv.nomineeAddress || '');
    setAmount(inv.amount);
    setInvestmentDate(inv.investmentDate || new Date().toISOString().slice(0, 10));
    setDurationDays(inv.durationDays || (inv.durationMonths ? inv.durationMonths * 30 : 30));
    setDurationMonths(inv.durationMonths || 1);
    setProfitRatePercent(inv.profitRatePercent || 6);
    setProfitPayout(inv.profitPayout || 'monthly');
    setPaymentMethod(inv.paymentMethod || 'bank');
    setBankName(inv.bankName || '');
    setChequeOrTxnNo(inv.chequeOrTxnNo || '');
    setWitnessName(inv.witnessName || '');
    setWitnessMobile(inv.witnessMobile || '');
    setWitnessAddress(inv.witnessAddress || '');
    setNotes(inv.notes || '');
    setShowFormModal(true);
  };

  // Handle Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount)) {
      setFormError('অনুগ্রহ করে সঠিক টাকার অংক লিখুন');
      return;
    }

    // MANDATORY REQUIREMENT: Minimum 1,000 Tk up to unlimited
    if (numericAmount < MINIMUM_INVESTMENT_AMOUNT) {
      setFormError('❌ নূন্যতম ১,০০০ (এক হাজার) টাকা বিনিয়োগ করতে হবে। ১,০০০ টাকা থেকে শুরু করে যেকোনো অংক বিনিয়োগ প্রযোজ্য।');
      return;
    }

    if (!investorName.trim()) {
      setFormError('বিনিয়োগকারীর নাম লিখুন');
      return;
    }
    if (!investorMobile.trim()) {
      setFormError('বিনিয়োগকারীর মোবাইল নম্বর লিখুন');
      return;
    }
    if (!investorNid.trim()) {
      setFormError('বিনিয়োগকারীর জাতীয় পরিচয়পত্র (NID) নম্বর লিখুন');
      return;
    }

    setIsSaving(true);
    try {
      const yearStr = new Date().getFullYear();
      let maxSerial = investments.length;
      investments.forEach((inv) => {
        const m = (inv.agreementNo || '').match(/TW-INV-\d+-(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxSerial) maxSerial = n;
        }
      });
      const nextSerialStr = String(maxSerial + 1).padStart(3, '0');
      const generatedAgreementNo = editingInvestment
        ? editingInvestment.agreementNo
        : `TW-INV-${yearStr}-${nextSerialStr}`;

      const payload: Omit<InvestmentRecord, 'id' | 'createdAt' | 'updatedAt'> = {
        ...(editingInvestment || {}),
        agreementNo: generatedAgreementNo,
        investorCode: editingInvestment?.investorCode || `INV-${nextSerialStr}`,
        investorName: investorName.trim(),
        investorFatherOrSpouse: investorFatherOrSpouse.trim(),
        investorNid: investorNid.trim(),
        investorMobile: investorMobile.trim(),
        investorAltMobile: investorAltMobile.trim(),
        investorEmail: investorEmail.trim(),
        investorPresentAddress: investorPresentAddress.trim(),
        investorPermanentAddress: investorPermanentAddress.trim(),
        investorPhotoUrl: investorPhotoUrl.trim(),
        investorSignatureUrl: investorSignatureUrl.trim(),
        nomineeName: nomineeName.trim(),
        nomineeRelation: nomineeRelation.trim(),
        nomineeNid: nomineeNid.trim(),
        nomineeMobile: nomineeMobile.trim(),
        nomineeAddress: nomineeAddress.trim(),
        amount: numericAmount,
        investmentDate: investmentDate || safeDateToYmd(Date.now()),
        durationDays: Number(durationDays) || 30,
        durationMonths: Math.max(1, Math.round((Number(durationDays) || 30) / 30)),
        profitRatePercent: Number(profitRatePercent) || 0,
        profitPayout: profitPayout,
        paymentMethod: paymentMethod,
        bankName: bankName.trim(),
        chequeOrTxnNo: chequeOrTxnNo.trim(),
        witnessName: witnessName.trim(),
        witnessMobile: witnessMobile.trim(),
        witnessAddress: witnessAddress.trim(),
        status: editingInvestment ? editingInvestment.status : 'active',
        notes: notes.trim(),
      };

      await saveOrUpdateInvestment(payload, editingInvestment?.id);
      showToast(
        editingInvestment
          ? `✓ ${investorName}-এর বিনিয়োগ তথ্য আপডেট সম্পন্ন হয়েছে!`
          : `✓ অভিনন্দন! ${investorName}-এর ৳ ${formatMoney(numericAmount)} বিনিয়োগ চুক্তি সফলভাবে নিবন্ধিত হয়েছে!`
      );
      setShowFormModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      setFormError('তথ্য সংরক্ষণ করতে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Investment (in-app confirmation modal)
  const handleDelete = (inv: InvestmentRecord) => {
    setConfirmDialog({
      title: 'বিনিয়োগ রেকর্ড মুছে ফেলুন',
      message: `আপনি কি নিশ্চিত যে "${inv.investorName}" এর (চুক্তি নং: ${inv.agreementNo}) বিনিয়োগ রেকর্ডটি স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmLabel: 'হ্যাঁ, মুছে ফেলুন',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteInvestmentById(inv.id);
          showToast('বিনিয়োগ রেকর্ডটি মুছে ফেলা হয়েছে');
        } catch {
          showToast('মুছে ফেলা সম্ভব হয়নি');
        }
      },
    });
  };

  // Toggle Status (e.g. Return Capital / Refunded) via in-app modal
  const handleToggleRefunded = (inv: InvestmentRecord) => {
    const nextStatus: InvestmentStatus = inv.status === 'active' ? 'refunded' : 'active';
    setConfirmDialog({
      title: nextStatus === 'refunded' ? 'মূলধন ফেরত ও চুক্তি সমাপ্ত' : 'চুক্তি পুনরায় সক্রিয় করুন',
      message:
        nextStatus === 'refunded'
          ? `আপনি কি "${inv.investorName}"-কে মূলধন ৳ ${formatMoney(inv.amount)} ফেরত প্রদান ও চুক্তি সমাপ্ত ঘোষণা করতে চান?`
          : `আপনি কি "${inv.investorName}"-এর চুক্তিটি (${inv.agreementNo}) পুনরায় 'সক্রিয়' করতে চান?`,
      confirmLabel: nextStatus === 'refunded' ? 'হ্যাঁ, মূলধন ফেরত সম্পন্ন' : 'হ্যাঁ, সক্রিয় করুন',
      variant: nextStatus === 'refunded' ? 'warning' : 'success',
      onConfirm: async () => {
        await saveOrUpdateInvestment(
          {
            ...inv,
            status: nextStatus,
            refundDate: nextStatus === 'refunded' ? safeDateToYmd(Date.now()) : undefined,
            refundAmount: nextStatus === 'refunded' ? inv.amount : undefined,
          },
          inv.id
        );
        showToast(
          nextStatus === 'refunded'
            ? `✓ মূলধন ফেরত সম্পন্ন ও চুক্তি সমাপ্ত রেকর্ড করা হয়েছে!`
            : `✓ চুক্তি পুনরায় সক্রিয় করা হয়েছে!`
        );
      },
    });
  };

  // Image file upload handlers for signature & investor photo
  const handleSignatureFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে সঠিক ছবির ফাইল (PNG, JPG) নির্বাচন করুন');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('ছবির সাইজ ৫ মেগাবাইটের কম হতে হবে');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInvestorSignatureUrl(reader.result as string);
      showToast('✓ স্বাক্ষরের ছবি সফলভাবে আপলোড হয়েছে');
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে সঠিক ছবির ফাইল নির্বাচন করুন');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('ছবির সাইজ ৫ মেগাবাইটের কম হতে হবে');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInvestorPhotoUrl(reader.result as string);
      showToast('✓ বিনিয়োগকারীর ছবি সফলভাবে আপলোড হয়েছে');
    };
    reader.readAsDataURL(file);
  };

  const handleClearSignature = () => {
    setInvestorSignatureUrl('');
    if (sigFileInputRef.current) {
      sigFileInputRef.current.value = '';
    }
    showToast('স্বাক্ষর মুছে ফেলা হয়েছে');
  };

  // Print Document (Agreement, Receipt or Voucher)
  const handlePrintDoc = () => {
    if (selectedAgreementDoc) {
      const el = document.getElementById('printableA4InvestmentAgreement');
      if (el) {
        printElement(el, `Investment_Agreement_${selectedAgreementDoc.agreementNo}`, 'contract');
        return;
      }
    }
    if (selectedReceiptDoc) {
      const el = document.getElementById('printableInvestmentReceipt');
      if (el) {
        printElement(el, `Money_Receipt_${selectedReceiptDoc.agreementNo}`, 'pos');
        return;
      }
    }
    if (selectedVoucherDoc) {
      const el = document.getElementById('printableA4WithdrawalVoucher');
      if (el) {
        printElement(el, `Withdrawal_Voucher_${selectedVoucherDoc.agreementNo}`, 'contract');
        return;
      }
    }
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Banner & Quick Stats */}
      <div className="bg-slate-950 text-white rounded-xl p-5 sm:p-6 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                কারখানা ইনভেস্টমেন্ট ও তহবিল পোর্টাল
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                মিনিমাম ১,০০০ ৳ হতে শুরু (৭ থেকে ১২০ দিনের প্ল্যান) · মুনাফা বণ্টন চুক্তিপত্র, A4 সরকারি স্ট্যাম্প চুক্তি ও টাকা জমার রসিদ
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowFormModal(true);
              }}
              className="py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন বিনিয়োগ নিবন্ধন করুন</span>
            </button>
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                ← ফিরে যান
              </button>
            )}
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800">
          <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">মোট সক্রিয় মূলধন</span>
            <span className="text-lg sm:text-xl font-extrabold text-white font-mono mt-1 block tabular-nums">
              ৳ {formatMoney(totalInvestedAmount)}
            </span>
          </div>

          <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">সক্রিয় বিনিয়োগকারী</span>
            <span className="text-lg sm:text-xl font-extrabold text-teal-300 font-mono mt-1 block tabular-nums">
              {toBengaliNumber(activeInvestorsCount)} জন
            </span>
          </div>

          <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">মোট প্রদেয় প্ল্যান মুনাফা</span>
            <span className="text-lg sm:text-xl font-extrabold text-white font-mono mt-1 block tabular-nums">
              ৳ {formatMoney(totalMonthlyProfitPayable)}
            </span>
          </div>

          <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">সর্বমোট চুক্তি সংখ্যা</span>
            <span className="text-lg sm:text-xl font-extrabold text-white font-mono mt-1 block tabular-nums">
              {toBengaliNumber(investments.length)} টি
            </span>
          </div>
        </div>
      </div>

      {/* 2. Sub-Tab Switcher: Investments vs Withdrawals */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-lg w-fit flex-wrap">
        <button
          type="button"
          onClick={() => setActiveHubTab('investments')}
          className={`py-1.5 px-3.5 rounded-md font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeHubTab === 'investments'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="tabular-nums">বিনিয়োগ ও চুক্তিপত্র ({toBengaliNumber(investments.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveHubTab('withdrawals')}
          className={`py-1.5 px-3.5 rounded-md font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeHubTab === 'withdrawals'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span className="tabular-nums">টাকা উত্তোলনের রসিদ ও ভাউচার ({toBengaliNumber(withdrawals.length)})</span>
        </button>
      </div>

      {activeHubTab === 'investments' ? (
        <>
          {/* 3. Search & Filters Bar */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="বিনিয়োগকারীর নাম, মোবাইল, এনআইডি বা চুক্তি নং দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-600 outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>ফিল্টার:</span>
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer focus:ring-2 focus:ring-teal-600 outline-none"
          >
            <option value="all">সকল চুক্তি ({investments.length})</option>
            <option value="active">সক্রিয় চুক্তি ({investments.filter((i) => i.status === 'active').length})</option>
            <option value="completed">সমাপ্ত ({investments.filter((i) => i.status === 'completed').length})</option>
            <option value="refunded">মূলধন ফেরত ({investments.filter((i) => i.status === 'refunded').length})</option>
            <option value="cancelled">বাতিলকৃত ({investments.filter((i) => i.status === 'cancelled').length})</option>
          </select>
        </div>
      </div>

      {/* 3. Investments List Cards */}
      {filteredInvestments.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
            <DollarSign className="w-8 h-8" />
          </div>
          <h3 className="font-black text-slate-800 text-base">কোনো বিনিয়োগ রেকর্ড পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            আপনার কারখানায় নতুন বিনিয়োগকারী যুক্ত করতে উপরে থাকা "+ নতুন বিনিয়োগ নিবন্ধন করুন" বাটনে ক্লিক করুন।
          </p>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowFormModal(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>বিনিয়োগ নিবন্ধন শুরু করুন</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredInvestments.map((inv) => {
            const isRefunded = inv.status === 'refunded';
            const dDays = Math.max(1, inv.durationDays || (inv.durationMonths ? inv.durationMonths * 30 : 30));
            const planProfitTotal = Math.round(((Number(inv.amount) || 0) * (Number(inv.profitRatePercent) || 0)) / 100);
            const dailyProfitVal = Math.round((planProfitTotal / dDays) * 100) / 100;
            const claimedDays = inv.claimedDaysCount || 0;
            const claimedAmt = inv.totalProfitClaimed || 0;

            return (
              <div
                key={inv.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-md space-y-3.5 ${
                  isRefunded
                    ? 'border-slate-300 bg-slate-50/50'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                {/* Top Row: Investor & Amount */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {inv.investorPhotoUrl ? (
                        <img
                          src={inv.investorPhotoUrl}
                          alt={inv.investorName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <User className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-slate-900 text-base">{inv.investorName}</h3>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                          {inv.agreementNo}
                        </span>
                        {inv.isBlocked ? (
                          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10.5px] border bg-rose-100 text-rose-800 border-rose-300 flex items-center gap-1">
                            <Ban className="w-3 h-3 text-rose-600" />
                            <span>⛔ সাময়িক ব্লকড</span>
                          </span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10.5px] border ${
                              inv.status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : inv.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {inv.status === 'active'
                              ? '✓ সক্রিয় অংশীদারিত্ব'
                              : inv.status === 'completed'
                              ? '✓ মেয়াদ সমাপ্ত'
                              : inv.status === 'cancelled'
                              ? 'বাতিলকৃত'
                              : 'ফেরতকৃত / সমাপ্ত'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>মোবাইল: <b className="text-slate-700">{inv.investorMobile}</b></span>
                        <span>•</span>
                        <span>NID: <b className="text-slate-700">{inv.investorNid}</b></span>
                        <span>•</span>
                        <span>তারিখ: {formatDateBn(inv.investmentDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial High-Level Badge */}
                  <div className="text-left sm:text-right bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 self-start sm:self-auto">
                    <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">
                      বিনিয়োগকৃত অর্থ:
                    </span>
                    <span className="text-xl font-black text-emerald-950 font-mono block">
                      ৳ {formatMoney(inv.amount)}
                    </span>
                    <span className="text-[10.5px] text-emerald-700 font-bold block">
                      মুনাফা: {toBengaliNumber(inv.profitRatePercent || 0)}% (৳ {formatMoney(planProfitTotal)} · দৈনিক ৳ {formatMoney(dailyProfitVal)})
                    </span>
                    <span className="text-[10px] text-slate-600 font-semibold block">
                      ক্লেম সম্পন্ন: {toBengaliNumber(claimedDays)}/{toBengaliNumber(dDays)} দিন (৳ {formatMoney(claimedAmt)})
                    </span>
                  </div>
                </div>

                {/* Blocked Alert Banner if isBlocked */}
                {inv.isBlocked && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-rose-950">ইনভেস্টর পোর্টাল লগইন সাময়িকভাবে ব্লক করা আছে</strong>
                        <p className="text-[11px] text-rose-800 mt-0.5">
                          লগইনের সময় প্রদর্শিত কারণ: {inv.blockReason || 'প্রশাসনিক প্রয়োজনে অ্যাকাউন্ট সাময়িকভাবে বন্ধ রাখা হয়েছে।'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await unblockInvestorProfile(inv.id);
                        showToast('✓ ইনভেস্টর অ্যাকাউন্ট সফলভাবে আনব্লক করা হয়েছে');
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10.5px] transition cursor-pointer active:scale-95 shrink-0"
                    >
                      আনব্লক করুন
                    </button>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10.5px] text-slate-500 block">চুক্তির মেয়াদ:</span>
                    <span className="font-bold text-slate-800">
                      {inv.durationDays
                        ? `${toBengaliNumber(inv.durationDays)} দিন (${toBengaliNumber(inv.profitRatePercent || 0)}% লাভ)`
                        : `${toBengaliNumber(inv.durationMonths)} মাস (${toBengaliNumber(Math.round(inv.durationMonths / 12))} বছর)`}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10.5px] text-slate-500 block">পরিশোধের মাধ্যম:</span>
                    <span className="font-bold text-slate-800 capitalize">
                      {inv.paymentMethod === 'bank' ? 'ব্যাংক ট্রান্সফার' : inv.paymentMethod === 'cheque' ? 'চেক' : 'ক্যাশ'}
                      {inv.bankName && ` (${inv.bankName})`}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10.5px] text-slate-500 block">মনোনীত নমিনি:</span>
                    <span className="font-bold text-slate-800">
                      {inv.nomineeName || '—'} {inv.nomineeRelation && `(${inv.nomineeRelation})`}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10.5px] text-slate-500 block">সাক্ষী / রেফারেন্স:</span>
                    <span className="font-bold text-slate-800">
                      {inv.witnessName || 'কারখানা কর্তৃপক্ষ'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* A4 AGREEMENT BUTTON (1-Click Print & PDF) */}
                    <button
                      type="button"
                      onClick={() => setSelectedAgreementDoc(inv)}
                      className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                      title="A4 সাইজের অফিশিয়াল চুক্তিপত্র দেখুন ও সরাসরি প্রিন্ট করুন"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>A4 চুক্তিপত্র প্রিন্ট</span>
                    </button>

                    {/* MONEY RECEIPT BUTTON */}
                    <button
                      type="button"
                      onClick={() => setSelectedReceiptDoc(inv)}
                      className="py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                      title="বিনিয়োগের টাকা জমার মানি রিসিট দেখুন ও প্রিন্ট করুন"
                    >
                      <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                      <span>টাকা জমার রসিদ</span>
                    </button>

                    {/* INVESTOR USER LINK & ACCESS BUTTON */}
                    <button
                      type="button"
                      onClick={() => {
                        setCredentialModalInv(inv);
                        setTempPassword(inv.portalPassword || '');
                        setTempBlockReason(inv.blockReason || '');
                      }}
                      className="py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                      title="বিনিয়োগকারীর ব্যক্তিগত পোর্টাল লিংক, পাসওয়ার্ড ও ব্লক/আনব্লক নিয়ন্ত্রণ"
                    >
                      <Link className="w-3.5 h-3.5 text-amber-700" />
                      <span>ইউজার লিংক ও পাসওয়ার্ড</span>
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      {/* Return Capital / Refund Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleRefunded(inv)}
                        className={`py-1.5 px-2.5 rounded-xl font-bold text-xs border transition cursor-pointer active:scale-95 ${
                          isRefunded
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                        }`}
                        title="মূলধন ফেরত দেওয়া হলে স্ট্যাটাস পরিবর্তন করুন"
                      >
                        {isRefunded ? 'পুনরায় সক্রিয় করুন' : 'মূলধন ফেরত / সমাপ্ত'}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleEdit(inv)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                        title="তথ্য সম্পাদনা করুন"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(inv)}
                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                        title="রেকর্ড মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      ) : (
        /* WITHDRAWALS LIST VIEW */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-black text-slate-900 text-sm">বিনিয়োগকারীদের টাকা উত্তোলনের আবেদন ও ভাউচার তালিকা</h3>
              <p className="text-[11px] text-slate-500">বিনিয়োগকারী তাঁর ব্যক্তিগত পোর্টাল থেকে উত্তোলন ফরম পূরণ করলে এখানে স্বয়ংক্রিয়ভাবে জমা হয়</p>
            </div>
            <span className="font-bold text-xs bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-xl">
              সর্বমোট: {toBengaliNumber(withdrawals.length)} টি ভাউচার
            </span>
          </div>

          {withdrawals.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <Receipt className="w-7 h-7" />
              </div>
              <h4 className="font-black text-slate-800 text-sm">কোনো টাকা উত্তোলনের ভাউচার এখনও নেই</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                বিনিয়োগকারী অংশীদারগণ তাঁদের নিজস্ব লিংকে প্রবেশ করে ডিজিটাল স্বাক্ষর দিয়ে টাকা উত্তোলনের আবেদন করলে এখানে ভাউচার সংরক্ষিত হবে।
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-amber-300 transition shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900 text-base">{w.investorName}</h4>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-bold border border-amber-200">
                          {w.voucherNo || w.id}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                          চুক্তি: {w.agreementNo}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            w.status === 'pending'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : w.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}
                        >
                          {w.status === 'pending'
                            ? '⏳ অনুমোদনের অপেক্ষায়'
                            : w.status === 'completed'
                            ? '✓ পরিশোধ সম্পন্ন'
                            : '✓ অনুমোদিত'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        মোবাইল: <b className="text-slate-700">{w.investorMobile}</b> | তারিখ: {formatDateBn(w.withdrawalDate)}
                      </p>
                    </div>

                    <div className="text-left sm:text-right bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-amber-800 font-bold block">উত্তোলিত অর্থ:</span>
                      <span className="text-lg font-black text-amber-950 font-mono block">৳ {formatMoney(w.amount)}</span>
                      <span className="text-[10px] text-amber-700 font-bold block">
                        {w.withdrawalType === 'capital_partial'
                          ? 'আংশিক মূলধন'
                          : w.withdrawalType === 'capital_full'
                          ? 'সম্পূর্ণ মূলধন প্রত্যাহার'
                          : w.withdrawalType === 'profit_monthly'
                          ? 'মাসিক লভ্যাংশ'
                          : 'বাৎসরিক মুনাফা'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10.5px] text-slate-500 block">পরিশোধের মাধ্যম:</span>
                      <span className="font-bold text-slate-800 capitalize">{w.paymentMethod}</span>
                    </div>
                    {w.bankName && (
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10.5px] text-slate-500 block">ব্যাংকের বিবরণ:</span>
                        <span className="font-bold text-slate-800 truncate block">{w.bankName}</span>
                      </div>
                    )}
                    {w.chequeOrTxnNo && (
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10.5px] text-slate-500 block">চেক / রেফারেন্স:</span>
                        <span className="font-bold font-mono text-slate-800 truncate block">{w.chequeOrTxnNo}</span>
                      </div>
                    )}
                    {w.reasonOrNote && (
                      <div className="p-2 bg-slate-50 rounded-xl col-span-2">
                        <span className="text-[10.5px] text-slate-500 block">বিবরণ / কারণ:</span>
                        <span className="text-slate-800 truncate block">{w.reasonOrNote}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {w.investorSignatureUrl && (
                        <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200">
                          <img
                            src={w.investorSignatureUrl}
                            alt="Signature"
                            className="h-6 max-w-[80px] object-contain"
                          />
                          <span className="text-[10px] text-slate-500 font-bold pr-1">স্বাক্ষরিত</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isAdmin && w.status === 'pending' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await updateWithdrawalStatus(w.id, 'approved');
                            showToast('✓ উত্তোলন আবেদন অনুমোদিত হয়েছে');
                          }}
                          className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>অনুমোদন করুন</span>
                        </button>
                      )}
                      {isAdmin && w.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await updateWithdrawalStatus(w.id, 'completed');
                            showToast('✓ টাকা পরিশোধ সম্পন্ন চিহ্নিত করা হয়েছে');
                          }}
                          className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>পরিশোধ সম্পন্ন</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedVoucherDoc(w)}
                        className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                        title="১-ক্লিকে অফিশিয়াল টাকা উত্তোলন ভাউচার ও রসিদ প্রিন্ট করুন"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>A4 ভাউচার প্রিন্ট ও প্রিভিউ</span>
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDialog({
                              title: 'উত্তোলন ভাউচার মুছে ফেলুন',
                              message: `আপনি কি নিশ্চিত যে "${w.investorName}" এর (${w.voucherNo || w.id}) উত্তোলন ভাউচার রেকর্ডটি মুছে ফেলতে চান?`,
                              confirmLabel: 'হ্যাঁ, মুছে ফেলুন',
                              variant: 'danger',
                              onConfirm: async () => {
                                await deleteWithdrawalById(w.id);
                                showToast('✓ ভাউচার রেকর্ড মুছে ফেলা হয়েছে');
                              },
                            });
                          }}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                          title="রেকর্ড মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. NEW / EDIT INVESTMENT MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    {editingInvestment ? 'বিনিয়োগ তথ্য সম্পাদনা' : 'নতুন কারখানা বিনিয়োগ নিবন্ধন'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    নূন্যতম ১,০০০ টাকা থেকে শুরু করে যেকোনো পরিমাণ বিনিয়োগ ও চুক্তিপত্র তৈরি
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitForm} className="p-5 overflow-y-auto space-y-5 text-xs">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 font-bold flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{formError}</span>
                </div>
              )}

              {/* SECTION A: FINANCIAL DETAILS & OFFICIAL PLANS */}
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <span className="font-black text-emerald-950 flex items-center gap-1.5 text-xs">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>১. বিনিয়োগ ও মেয়াদি প্ল্যান (মিনিমাম ১,০০০ ৳)</span>
                  </span>
                  <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    মিনিমাম ১,০০০ — যেকোনো পরিমাণ
                  </span>
                </div>

                {/* Official 6 Investment Plans Cards */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span>অফিশিয়াল ইনভেস্টমেন্ট প্ল্যান নির্বাচন করুন *</span>
                    <span className="text-[11px] text-teal-700 font-semibold">মেয়াদ শেষে মূলধন উত্তোলনযোগ্য</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {INVESTMENT_PLANS.map((plan) => {
                      const isSelected = durationDays === plan.days && profitRatePercent === plan.ratePercent;
                      return (
                        <button
                          key={plan.days}
                          type="button"
                          onClick={() => {
                            setDurationDays(plan.days);
                            setProfitRatePercent(plan.ratePercent);
                            setDurationMonths(Math.max(1, Math.round(plan.days / 30)));
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md scale-[1.02] ring-2 ring-emerald-400/50'
                              : 'bg-white text-slate-800 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs">{toBengaliNumber(plan.days)} দিন</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-amber-400 text-slate-950' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {toBengaliNumber(plan.ratePercent)}% লাভ
                            </span>
                          </div>
                          <span className={`text-[10px] mt-1 ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                            ২৪ ঘণ্টায় ১ বার ক্লেম
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      বিনিয়োগকৃত টাকার পরিমাণ (টাকা) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1000}
                        step={500}
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="মিনিমাম ১,০০০ টাকা"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-black text-emerald-950 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        BDT
                      </span>
                    </div>
                    {/* Live Bangla in Words Preview */}
                    <span className="text-[11px] text-emerald-800 font-bold mt-1 block">
                      কথায়: {numberToBengaliWords(Number(amount) || 0)}
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      বিনিয়োগের শুরুর তারিখ *
                    </label>
                    <input
                      type="date"
                      required
                      value={investmentDate}
                      onChange={(e) => setInvestmentDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block font-medium">
                      মেয়াদ শেষ: {formatDateBn(safeDateToYmd(safeParseDateMs(investmentDate) + durationDays * 86400000))}
                    </span>
                  </div>
                </div>

                {/* Live Return Projection Summary Box */}
                {amount && Number(amount) >= 1000 && (
                  <div className="p-3 bg-gradient-to-r from-emerald-100/90 to-teal-100/80 rounded-xl border border-emerald-300 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
                    <div>
                      <span className="font-bold text-[11px] text-emerald-900 block">
                        নির্বাচিত প্ল্যান: {toBengaliNumber(durationDays)} দিন ({toBengaliNumber(profitRatePercent)}% সর্বমোট মুনাফা)
                      </span>
                      <span className="text-[10.5px] text-emerald-800">
                        প্রতি ২৪ ঘণ্টায় ১ বার দৈনিক মুনাফা ক্লেম করতে পারবেন
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <span className="text-[10px] text-slate-600 block">দৈনিক মুনাফা:</span>
                        <span className="text-xs font-black text-emerald-900 font-mono">
                          ৳ {formatMoney(((Number(amount) * profitRatePercent) / 100) / durationDays)}
                        </span>
                      </div>
                      <div className="pl-3 border-l border-emerald-300">
                        <span className="text-[10px] text-slate-600 block">মোট প্রদেয় মুনাফা:</span>
                        <span className="text-sm font-black text-emerald-950 font-mono">
                          ৳ {formatMoney((Number(amount) * profitRatePercent) / 100)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment and Bank Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      মুনাফা প্রদানের সময়কাল *
                    </label>
                    <select
                      value={profitPayout}
                      onChange={(e) => setProfitPayout(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="monthly">মাসিক মুনাফা প্রদান</option>
                      <option value="quarterly">ত্রৈমাসিক (প্রতি ৩ মাসে)</option>
                      <option value="yearly">বাৎসরিক এককালীন</option>
                      <option value="tenure_end">মেয়াদ শেষে মূলধনসহ মুনাফা</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      টাকা পরিশোধের মাধ্যম *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="bank">ব্যাংক একাউন্ট ট্রান্সফার</option>
                      <option value="cheque">ব্যাংক চেক (Cheque)</option>
                      <option value="cash">নগদ ক্যাশ (Cash)</option>
                      <option value="bkash">বিকাশ (bKash)</option>
                      <option value="nagad">নগদ (Nagad)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">
                      ব্যাংকের নাম ও চেক / ট্রানজেকশন স্লিপ নং (প্রযোজ্য ক্ষেত্রে)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="ব্যাংকের নাম (যেমন: ইসলামী ব্যাংক)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <input
                        type="text"
                        value={chequeOrTxnNo}
                        onChange={(e) => setChequeOrTxnNo(e.target.value)}
                        placeholder="চেক নম্বর বা Txn ID"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: INVESTOR PERSONAL INFORMATION */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-black text-slate-900 flex items-center gap-1.5 text-xs pb-2 border-b border-slate-200">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>২. বিনিয়োগকারীর ব্যক্তিগত তথ্য (২য় পক্ষ)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      বিনিয়োগকারীর পূর্ণ নাম (বাংলায়) *
                    </label>
                    <input
                      type="text"
                      required
                      value={investorName}
                      onChange={(e) => setInvestorName(e.target.value)}
                      placeholder="যেমন: হাজী মোঃ আব্দুর রহিম"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      পিতা / স্বামীর নাম *
                    </label>
                    <input
                      type="text"
                      required
                      value={investorFatherOrSpouse}
                      onChange={(e) => setInvestorFatherOrSpouse(e.target.value)}
                      placeholder="পিতা বা স্বামীর নাম লিখুন"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      জাতীয় পরিচয়পত্র (NID) নম্বর *
                    </label>
                    <input
                      type="text"
                      required
                      value={investorNid}
                      onChange={(e) => setInvestorNid(e.target.value)}
                      placeholder="১০, ১৩ বা ১৭ ডিজিটের NID নম্বর"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      মোবাইল নম্বর *
                    </label>
                    <input
                      type="text"
                      required
                      value={investorMobile}
                      onChange={(e) => setInvestorMobile(e.target.value)}
                      placeholder="017xxxxxxxx"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      বিকল্প মোবাইল / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={investorAltMobile}
                      onChange={(e) => setInvestorAltMobile(e.target.value)}
                      placeholder="ঐচ্ছিক মোবাইল নম্বর"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      ইমেইল (ঐচ্ছিক)
                    </label>
                    <input
                      type="email"
                      value={investorEmail}
                      onChange={(e) => setInvestorEmail(e.target.value)}
                      placeholder="investor@example.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">
                      বর্তমান ঠিকানা *
                    </label>
                    <input
                      type="text"
                      required
                      value={investorPresentAddress}
                      onChange={(e) => setInvestorPresentAddress(e.target.value)}
                      placeholder="গ্রাম/বাড়ি, রাস্তা, থানা/উপজেলা, জেলা"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">
                      স্থায়ী ঠিকানা *
                    </label>
                    <input
                      type="text"
                      required
                      value={investorPermanentAddress}
                      onChange={(e) => setInvestorPermanentAddress(e.target.value)}
                      placeholder="NID কার্ড অনুযায়ী স্থায়ী ঠিকানা"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Photo & Signature Upload Section */}
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200">
                    {/* 1. Investor Passport Photo Upload */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-blue-600" />
                          <span>বিনিয়োগকারীর ছবি (পাসপোর্ট সাইজ)</span>
                        </label>
                        {investorPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setInvestorPhotoUrl('');
                              if (photoFileInputRef.current) {
                                photoFileInputRef.current.value = '';
                              }
                            }}
                            className="text-[10.5px] text-rose-600 hover:underline font-bold cursor-pointer"
                          >
                            ছবি মুছুন
                          </button>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={photoFileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoFileUpload}
                      />

                      <div className="flex items-center gap-3">
                        {investorPhotoUrl ? (
                          <div className="w-16 h-20 rounded-lg border-2 border-blue-500 overflow-hidden bg-slate-100 shrink-0 shadow-xs">
                            <img
                              src={investorPhotoUrl}
                              alt="Investor Photo"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-slate-50 shrink-0">
                            <Camera className="w-6 h-6 mb-1 text-slate-300" />
                            <span className="text-[9px]">ছবি নেই</span>
                          </div>
                        )}

                        <div className="flex-1 space-y-1.5">
                          <button
                            type="button"
                            onClick={() => photoFileInputRef.current?.click()}
                            className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{investorPhotoUrl ? 'ছবি পরিবর্তন করুন' : 'ছবি আপলোড করুন'}</span>
                          </button>
                          <input
                            type="url"
                            value={investorPhotoUrl.startsWith('data:') ? '' : investorPhotoUrl}
                            onChange={(e) => setInvestorPhotoUrl(e.target.value)}
                            placeholder="বা ছবির ওয়েব লিংক (URL)"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Signature Photo Upload (স্বাক্ষরের ছবি আপলোড) */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <Upload className="w-4 h-4 text-emerald-600" />
                          <span>বিনিয়োগকারীর স্বাক্ষরের ছবি</span>
                        </label>
                        {investorSignatureUrl && (
                          <button
                            type="button"
                            onClick={handleClearSignature}
                            className="text-[10.5px] text-rose-600 hover:underline font-bold cursor-pointer"
                          >
                            স্বাক্ষর মুছুন
                          </button>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={sigFileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleSignatureFileUpload}
                      />

                      <div className="flex items-center gap-3">
                        {investorSignatureUrl ? (
                          <div className="w-24 h-16 rounded-lg border-2 border-emerald-500 bg-white p-1 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                            <img
                              src={investorSignatureUrl}
                              alt="Investor Signature"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-24 h-16 rounded-lg border-2 border-dashed border-emerald-300/80 bg-emerald-50/50 flex flex-col items-center justify-center text-emerald-700 shrink-0">
                            <Upload className="w-5 h-5 mb-0.5 text-emerald-600" />
                            <span className="text-[9px] font-bold">স্বাক্ষর নেই</span>
                          </div>
                        )}

                        <div className="flex-1 space-y-1.5">
                          <button
                            type="button"
                            onClick={() => sigFileInputRef.current?.click()}
                            className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{investorSignatureUrl ? 'স্বাক্ষরের ছবি পরিবর্তন' : '📁 স্বাক্ষরের ছবি আপলোড করুন'}</span>
                          </button>
                          <span className="text-[10px] text-slate-500 block leading-tight">
                            কাগজে করা স্বাক্ষরের স্পষ্ট ছবি ক্যামেরা বা গ্যালারি থেকে সরাসরি আপলোড করুন
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION C: NOMINEE INFORMATION (মনোনীত নমিনির তথ্য) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-black text-slate-900 flex items-center gap-1.5 text-xs pb-2 border-b border-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>৩. মনোনীত নমিনির তথ্য (৩য় পক্ষ)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      নমিনির পূর্ণ নাম *
                    </label>
                    <input
                      type="text"
                      required
                      value={nomineeName}
                      onChange={(e) => setNomineeName(e.target.value)}
                      placeholder="নমিনির নাম লিখুন"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      বিনিয়োগকারীর সাথে সম্পর্ক *
                    </label>
                    <select
                      value={nomineeRelation}
                      onChange={(e) => setNomineeRelation(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="স্ত্রী">স্ত্রী</option>
                      <option value="স্বামী">স্বামী</option>
                      <option value="পুত্র">পুত্র</option>
                      <option value="কন্যা">কন্যা</option>
                      <option value="মাতা">মাতা</option>
                      <option value="পিতা">পিতা</option>
                      <option value="ভাই">ভাই</option>
                      <option value="বোন">বোন</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      নমিনির মোবাইল নম্বর
                    </label>
                    <input
                      type="text"
                      value={nomineeMobile}
                      onChange={(e) => setNomineeMobile(e.target.value)}
                      placeholder="017xxxxxxxx"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      নমিনির এনআইডি নম্বর (যদি থাকে)
                    </label>
                    <input
                      type="text"
                      value={nomineeNid}
                      onChange={(e) => setNomineeNid(e.target.value)}
                      placeholder="নমিনির NID নম্বর"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION D: WITNESS & EXTRA NOTES */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-black text-slate-900 flex items-center gap-1.5 text-xs pb-2 border-b border-slate-200">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span>৪. সাক্ষী ও বিশেষ শর্তাবলী</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      ১ম সাক্ষীর নাম
                    </label>
                    <input
                      type="text"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      placeholder="সাক্ষীর নাম"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      সাক্ষীর মোবাইল নম্বর
                    </label>
                    <input
                      type="text"
                      value={witnessMobile}
                      onChange={(e) => setWitnessMobile(e.target.value)}
                      placeholder="017xxxxxxxx"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">
                      বিশেষ কোনো শর্ত বা চুক্তিগত নোট (ঐচ্ছিক)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="যেমন: ৩ মাস পূর্বে নোটিশ দিয়ে মূলধন ফেরত উত্তোলন করা যাবে..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : editingInvestment ? 'আপডেট করুন' : 'বিনিয়োগ নিবন্ধন সম্পন্ন করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. A4 OFFICIAL INVESTMENT AGREEMENT DOCUMENT MODAL (1-CLICK PRINT & PDF) */}
      {selectedAgreementDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden my-4 flex flex-col max-h-[92vh]">
            {/* Modal Top Bar (Controls for Print & Close) */}
            <div className="bg-slate-900 text-white p-3.5 sm:px-6 flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="font-bold text-sm text-white">
                    A4 সাইজ কারখানা বিনিয়োগ চুক্তিপত্র — {selectedAgreementDoc.agreementNo}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    স্ট্যান্ডার্ড A4 পেপারে সরকারি স্ট্যাম্প ফরম্যাট অনুযায়ী ১-ক্লিকে প্রিন্ট ও PDF সেভ করুন
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Zoom / Scale Controls for Contract Preview */}
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
                    className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                    title="প্রিভিউ ছোট করুন (Zoom Out)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-mono text-[10px] font-bold text-amber-400 min-w-[38px] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(1.4, Math.round((z + 0.1) * 10) / 10))}
                    className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                    title="প্রিভিউ বড় করুন (Zoom In)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                    title="১০০% স্বাভাবিক মাপে দেখুন"
                  >
                    ১০০%
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePrintDoc}
                  className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4 stroke-[2.5]" />
                  <span>১-ক্লিকে A4 প্রিন্ট / PDF</span>
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

            {/* Printable A4 Container */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100/60 print:p-0 print:bg-white">
              <div
                id="printableA4InvestmentAgreement"
                className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white p-8 sm:p-12 shadow-md print:shadow-none border border-slate-200 print:border-none text-slate-900 space-y-6 relative transition-transform duration-150"
                style={{ fontFamily: 'sans-serif', transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined, transformOrigin: 'top center' }}
              >
                {/* Official Letterhead Header */}
                <div className="text-center pb-4 border-b-2 border-slate-800 space-y-1 relative">
                  <div className="inline-block px-3 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest mb-1">
                    Official Investment Agreement & Deed of Partnership
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                    {factory.name || 'টেক্স ওয়ার অ্যাপারেলস'}
                  </h1>
                  {factory.nameEn && (
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {factory.nameEn}
                    </p>
                  )}
                  <p className="text-xs text-slate-700 font-medium">
                    {factory.address || 'কোনাবাড়ী শিল্প এলাকা, গাজীপুর-১৭০০'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    ফোন: {factory.phone} | ইমেইল: {factory.email || 'texwareapparels@gmail.com'}
                  </p>
                </div>

                {/* Agreement Tracking Meta */}
                <div className="flex items-center justify-between text-xs font-bold py-2 border-b border-dashed border-slate-300">
                  <div>
                    <span className="text-slate-500 font-normal">স্মারক / চুক্তিপত্র নং: </span>
                    <span className="font-mono text-slate-900">{selectedAgreementDoc.agreementNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">চুক্তি সম্পাদনের তারিখ: </span>
                    <span className="font-mono text-slate-900">{formatDateBn(selectedAgreementDoc.investmentDate)}</span>
                  </div>
                </div>

                {/* Agreement Title */}
                <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-300">
                  <h2 className="text-base sm:text-lg font-black text-slate-950">
                    ব্যবসায়িক বিনিয়োগ ও লাভ-ক্ষতি বণ্টন চুক্তিপত্র
                  </h2>
                  <p className="text-[11px] text-slate-600 font-bold">
                    [ বাংলাদেশ চুক্তি আইন ও যৌথ ব্যবসায়িক নীতিমালা অনুযায়ী সম্পাদিত ]
                  </p>
                </div>

                {/* Parties Details (১ম পক্ষ ও ২য় পক্ষ) */}
                <div className="space-y-4 text-xs leading-relaxed">
                  {/* ১ম পক্ষ: কারখানা কর্তৃপক্ষ */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-slate-950 mb-1 text-sm">
                      ১ম পক্ষ (ব্যবস্থাপনা ও কারখানা কর্তৃপক্ষ):
                    </p>
                    <p className="text-slate-800">
                      <b>{factory.name}</b>, স্বত্বাধিকারী / ব্যবস্থাপনা পরিচালক, ঠিকানা: {factory.address}। 
                      যাঁরা পরবর্তীতে এই চুক্তিতে <b>"১ম পক্ষ বা কারখানা প্রশাসন"</b> হিসেবে গণ্য হইবেন।
                    </p>
                  </div>

                  {/* ২য় পক্ষ: বিনিয়োগকারী */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="font-black text-slate-950 mb-1 text-sm">
                        ২য় পক্ষ (বিনিয়োগকারী অংশীদার):
                      </p>
                      <p className="text-slate-900">
                        <b>নাম:</b> {selectedAgreementDoc.investorName}
                      </p>
                      <p className="text-slate-800">
                        <b>পিতা / স্বামী:</b> {selectedAgreementDoc.investorFatherOrSpouse || '—'}
                      </p>
                      <p className="text-slate-800">
                        <b>জাতীয় পরিচয়পত্র (NID) নম্বর:</b> <span className="font-mono font-bold">{selectedAgreementDoc.investorNid}</span>
                      </p>
                      <p className="text-slate-800">
                        <b>মোবাইল নম্বর:</b> <span className="font-mono font-bold">{selectedAgreementDoc.investorMobile}</span>
                      </p>
                      <p className="text-slate-800">
                        <b>বর্তমান ঠিকানা:</b> {selectedAgreementDoc.investorPresentAddress}
                      </p>
                      <p className="text-slate-800">
                        <b>স্থায়ী ঠিকানা:</b> {selectedAgreementDoc.investorPermanentAddress}
                      </p>
                      <p className="text-slate-700 mt-1 italic">
                        যিনি পরবর্তীতে এই চুক্তিতে <b>"২য় পক্ষ বা বিনিয়োগকারী"</b> হিসেবে গণ্য হইবেন।
                      </p>
                    </div>

                    {/* Investor Photo Box */}
                    <div className="w-24 h-28 border-2 border-dashed border-slate-400 bg-white rounded-lg flex flex-col items-center justify-center shrink-0 self-center sm:self-start overflow-hidden">
                      {selectedAgreementDoc.investorPhotoUrl ? (
                        <img
                          src={selectedAgreementDoc.investorPhotoUrl}
                          alt={selectedAgreementDoc.investorName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 text-center p-1">
                          বিনিয়োগকারীর পাসপোর্ট সাইজ ছবি
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ৩য় পক্ষ: মনোনীত নমিনি */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-slate-950 mb-1">
                      মনোনীত নমিনির বিবরণ (উত্তরাধিকারী):
                    </p>
                    <p className="text-slate-800">
                      ২য় পক্ষের অবর্তমানে বা কোনো আকস্মিক দুর্ঘটনার ক্ষেত্রে এই বিনিয়োগের মূলধন ও লভ্যাংশ গ্রহণের সম্পূর্ণ অধিকার থাকিবে: 
                      <b> {selectedAgreementDoc.nomineeName}</b> (সম্পর্ক: <b>{selectedAgreementDoc.nomineeRelation}</b>, মোবাইল: <span className="font-mono">{selectedAgreementDoc.nomineeMobile || '—'}</span>, NID: <span className="font-mono">{selectedAgreementDoc.nomineeNid || '—'}</span>)-এর।
                    </p>
                  </div>
                </div>

                {/* TERMS & CONDITIONS (ধারা ও শর্তাবলী) */}
                <div className="space-y-3 text-xs leading-relaxed border-t border-slate-200 pt-3">
                  <h3 className="font-black text-slate-950 text-sm pb-1 border-b border-slate-200">
                    চুক্তিপত্র ও অংশীদারিত্বের শর্তাবলী:
                  </h3>

                  <div className="space-y-2 text-slate-800 text-[11.5px]">
                    <p>
                      <b>১ম ধারা (মূলধন প্রাপ্তি স্বীকার):</b> ২য় পক্ষ ১ম পক্ষের কারখানার সার্বিক উৎপাদন ও ব্যবসা সম্প্রসারণের জন্য সর্বমোট <b>৳ {formatMoney(selectedAgreementDoc.amount)}</b> (<span className="font-bold underline text-slate-950">{numberToBengaliWords(selectedAgreementDoc.amount)}</span>) বিনিয়োগ প্রদান করিলেন এবং ১ম পক্ষ অত্র চুক্তি স্বাক্ষরের মাধ্যমে উক্ত অর্থ প্রাপ্তি স্বীকার করিলেন।
                    </p>

                    {(() => {
                      const docDays = selectedAgreementDoc.durationDays || (selectedAgreementDoc.durationMonths ? selectedAgreementDoc.durationMonths * 30 : 30);
                      const docMatDate = formatDateBn(safeDateToYmd(safeParseDateMs(selectedAgreementDoc.investmentDate) + docDays * 86400000));
                      return (
                        <>
                          <p>
                            <b>২য় ধারা (মেয়াদ ও মুনাফা নীতি):</b> এই চুক্তির নির্ধারিত মেয়াদ <b>{toBengaliNumber(docDays)} দিন</b> (সমাপ্তি তারিখ: <b>{docMatDate}</b>)। ২য় পক্ষ বিনিয়োগকৃত অর্থের উপর <b>নির্ধারিত মেয়াদে সর্বমোট {toBengaliNumber(selectedAgreementDoc.profitRatePercent || 0)}%</b> হারে (প্রতি ২৪ ঘণ্টায় ১ বার দৈনিক মুনাফা ক্লেমের মাধ্যমে) লভ্যাংশ প্রাপ্ত হইবেন।
                          </p>

                          <p>
                            <b>৩য় ধারা (মূলধন সুরক্ষা ও ফেরত নীতি):</b> চুক্তির নির্ধারিত {toBengaliNumber(docDays)} দিনের মেয়াদ পূর্ণ হওয়ার পর ২য় পক্ষ তাঁহার মূলধনের সম্পূর্ণ টাকা (<span className="font-mono font-bold">৳ {formatMoney(selectedAgreementDoc.amount)}</span>) উত্তোলনের রিকোয়েস্ট দাখিলপূর্বক ফেরত পাইবেন। নির্ধারিত মেয়াদ সমাপ্তির পূর্বে মূলধন উত্তোলন প্রযোজ্য হইবে না।
                          </p>
                        </>
                      );
                    })()}

                    <p>
                      <b>৪র্থ ধারা (ব্যবস্থাপনা ও দায়বদ্ধতা):</b> কারখানার দৈনন্দিন পরিচালনা, উৎপাদন, কাঁচামাল ক্রয় ও শ্রম মজুরির যাবতীয় ব্যবস্থাপনা ১ম পক্ষের নিয়ন্ত্রণাধীনে থাকিবে। ২য় পক্ষ কারখানার অভ্যন্তরীণ দৈনিক কর্মপরিচালনায় কোনো অযৌক্তিক হস্তক্ষেপ করিবেন না।
                    </p>

                    <p>
                      <b>৫ম ধারা (বিরোধ নিষ্পত্তি):</b> যেকোনো বিরোধ বা ভুল বোঝাবুঝির ক্ষেত্রে উভয় পক্ষ পারস্পারিক আলোচনা ও সালিশের মাধ্যমে শান্তিপূর্ণ সমাধান করিতে বাধ্য থাকিবেন।
                    </p>
                  </div>
                </div>

                {/* SIGNATURE BLOCKS */}
                <div className="pt-10 grid grid-cols-3 gap-6 text-center text-xs">
                  {/* Investor Signature */}
                  <div className="space-y-2">
                    <div className="h-14 flex items-end justify-center">
                      {selectedAgreementDoc.investorSignatureUrl ? (
                        <img
                          src={selectedAgreementDoc.investorSignatureUrl}
                          alt="Investor Signature"
                          className="max-h-12 max-w-[120px] object-contain"
                        />
                      ) : (
                        <div className="w-28 border-b border-slate-400" />
                      )}
                    </div>
                    <div className="border-t border-slate-900 pt-1">
                      <p className="font-black text-slate-900">{selectedAgreementDoc.investorName}</p>
                      <p className="text-[10px] text-slate-500 font-bold">২য় পক্ষ / বিনিয়োগকারীর স্বাক্ষর</p>
                    </div>
                  </div>

                  {/* Factory MD Signature & Official Seal */}
                  <div className="space-y-2">
                    <div className="h-14 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-indigo-500 text-indigo-700 flex items-center justify-center text-[9px] font-black uppercase text-center p-1 opacity-70">
                        অফিশিয়াল সিল ও স্বাক্ষর
                      </div>
                    </div>
                    <div className="border-t border-slate-900 pt-1">
                      <p className="font-black text-slate-900">ব্যবস্থাপনা পরিচালক</p>
                      <p className="text-[10px] text-slate-500 font-bold">১ম পক্ষ / {factory.name}</p>
                    </div>
                  </div>

                  {/* Witness Signature */}
                  <div className="space-y-2">
                    <div className="h-14 flex items-end justify-center">
                      <div className="w-28 border-b border-slate-400" />
                    </div>
                    <div className="border-t border-slate-900 pt-1">
                      <p className="font-bold text-slate-800">{selectedAgreementDoc.witnessName || 'সাক্ষীর স্বাক্ষর'}</p>
                      <p className="text-[10px] text-slate-500 font-bold">সাক্ষী / রেফারেন্স</p>
                    </div>
                  </div>
                </div>

                {/* Footer Seal & Verification */}
                <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-0.5">
                  <p>© {factory.name} — সকল স্বত্ব সংরক্ষিত • অফিশিয়াল ইনভেস্টমেন্ট রেকর্ড কপি</p>
                  <p className="font-mono">Verification Code: {selectedAgreementDoc.id} • Registered</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. OFFICIAL MONEY RECEIPT MODAL */}
      {selectedReceiptDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-300 overflow-hidden my-4 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-3.5 sm:px-6 flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-sm text-white">
                  টাকা প্রাপ্তির মানি রিসিট — {selectedReceiptDoc.agreementNo}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDoc}
                  className="py-1.5 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
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
              <div id="printableInvestmentReceipt" className="p-6 bg-amber-50/30 rounded-2xl border-2 border-slate-800 space-y-4 text-slate-900">
                <div className="text-center pb-3 border-b-2 border-slate-800 space-y-0.5">
                  <h2 className="text-2xl font-black text-slate-950">{factory.name}</h2>
                  <p className="text-xs text-slate-600">{factory.address}</p>
                  <div className="inline-block px-3 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-black uppercase mt-1">
                    বিনিয়োগ মূলধন জমা রসিদ (Money Receipt)
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold">
                  <span>রসিদ / চুক্তি নং: <b className="font-mono">{selectedReceiptDoc.agreementNo}</b></span>
                  <span>তারিখ: <b className="font-mono">{formatDateBn(selectedReceiptDoc.investmentDate)}</b></span>
                </div>

                <div className="text-xs space-y-2 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                  <p>
                    বিনিয়োগকারী জনাব/জনাবা <b>{selectedReceiptDoc.investorName}</b> (মোবাইল: {selectedReceiptDoc.investorMobile})-এর নিকট হইতে কারখানার মূলধন হিসেবে নগদ / চেক / ব্যাংক ট্রান্সফার মারফত নিম্নের অর্থ বুঝিয়া পাওয়া গেল:
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
                    পরিশোধের মাধ্যম: <b>{selectedReceiptDoc.paymentMethod}</b> {selectedReceiptDoc.bankName && `• ব্যাংক: ${selectedReceiptDoc.bankName}`} {selectedReceiptDoc.chequeOrTxnNo && `• চেক/Txn: ${selectedReceiptDoc.chequeOrTxnNo}`}
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

      {/* 7. OFFICIAL A4 WITHDRAWAL VOUCHER MODAL */}
      {selectedVoucherDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden my-4 flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-3.5 sm:px-6 flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-sm text-white">
                  টাকা উত্তোলন ভাউচার ও রসিদ — {selectedVoucherDoc.voucherNo || selectedVoucherDoc.id}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDoc}
                  className="py-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
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
                    [ কারখানা প্রশাসন ও হিসাব বিভাগ কর্তৃক অনুমোদিত ]
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
                  </div>

                  {/* Financial Highlights */}
                  <div className="p-5 bg-amber-50/80 rounded-2xl border-2 border-amber-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-amber-900 font-bold block uppercase tracking-wider">
                        উত্তোলিত মোট টাকার অংক:
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono">
                        ৳ {formatMoney(selectedVoucherDoc.amount)}
                      </span>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-[11px] text-amber-900 font-bold block">কথায় (টাকা):</span>
                      <span className="text-sm font-bold text-slate-950 underline decoration-amber-500">
                        {numberToBengaliWords(selectedVoucherDoc.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 block">পরিশোধ পদ্ধতি:</span>
                      <strong className="text-slate-900 capitalize">{selectedVoucherDoc.paymentMethod}</strong>
                    </div>
                    {selectedVoucherDoc.bankName && (
                      <div>
                        <span className="text-slate-500 block">ব্যাংকের বিবরণ:</span>
                        <strong className="text-slate-900">{selectedVoucherDoc.bankName}</strong>
                      </div>
                    )}
                    {selectedVoucherDoc.chequeOrTxnNo && (
                      <div>
                        <span className="text-slate-500 block">চেক / ট্রানজেকশন নং:</span>
                        <strong className="text-slate-900 font-mono">{selectedVoucherDoc.chequeOrTxnNo}</strong>
                      </div>
                    )}
                  </div>

                  {selectedVoucherDoc.reasonOrNote && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 block">উত্তোলনের বিবরণ / মন্তব্য:</span>
                      <span className="text-slate-800">{selectedVoucherDoc.reasonOrNote}</span>
                    </div>
                  )}
                </div>

                {/* SIGNATURE SECTION */}
                <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs">
                  {/* Investor Signature */}
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

                  {/* Factory Authority */}
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

      {/* 8. INVESTOR CREDENTIAL & PORTAL LINK & BLOCK MANAGEMENT MODAL */}
      {liveCredentialModalInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-300 overflow-hidden my-4">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">ইনভেস্টর ইউজার লিংক ও অ্যাক্সেস পোর্টাল</h3>
                  <p className="text-[11px] text-slate-400">{liveCredentialModalInv.investorName} (চুক্তি: {liveCredentialModalInv.agreementNo})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCredentialModalInv(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-800">
              {/* Individual Investor Portal Link */}
              <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-900 flex items-center gap-1.5">
                    <Link className="w-4 h-4 text-emerald-600" />
                    <span>{liveCredentialModalInv.investorName} এর আলাদা ব্যক্তিগত লগইন লিংক:</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    স্বতন্ত্র লিংক
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  এই বিনিয়োগকারীর জন্য প্রস্তুতকৃত নির্দিষ্ট লিংক। তিনি সরাসরি এই লিংকে প্রবেশ করে চুক্তি নম্বর বা মোবাইল ও পাসওয়ার্ড দিয়ে দেখতে পারবেন।
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    readOnly
                    value={getInvestorLoginUrl(liveCredentialModalInv)}
                    className="flex-1 p-2 bg-white border border-slate-300 rounded-xl font-mono text-[11px] text-slate-700 outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const link = getInvestorLoginUrl(liveCredentialModalInv);
                      navigator.clipboard.writeText(link);
                      showToast(`✓ ${liveCredentialModalInv.investorName} এর আলাদা ব্যক্তিগত লগইন লিংক কপি করা হয়েছে`);
                    }}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>লিংক কপি</span>
                  </button>
                </div>
              </div>

              {/* Password Management */}
              <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block font-bold text-slate-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>পোর্টাল পাসওয়ার্ড ব্যবস্থাপনা:</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder={`ডিফল্ট পাসওয়ার্ড: ${liveCredentialModalInv.investorMobile.slice(-4) || '123456'}`}
                    className="flex-1 p-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900 font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await updateInvestorCredentials(liveCredentialModalInv.id, liveCredentialModalInv.investorMobile, tempPassword);
                      showToast('✓ ইনভেস্টর পাসওয়ার্ড সফলভাবে সংরক্ষিত হয়েছে!');
                    }}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>সংরক্ষণ</span>
                  </button>
                </div>
                <p className="text-[10.5px] text-slate-500">
                  {liveCredentialModalInv.portalPassword
                    ? `বর্তমান কাস্টম পাসওয়ার্ড: ${liveCredentialModalInv.portalPassword}`
                    : `ডিফল্ট পাসওয়ার্ড: মোবাইলের শেষ ৪ সংখ্যা (${liveCredentialModalInv.investorMobile.slice(-4)}) অথবা 123456`}
                </p>
              </div>

              {/* Account Block / Unblock Management */}
              <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>অ্যাকাউন্ট স্ট্যাটাস ও ব্লক / আনব্লক:</span>
                </label>
                {liveCredentialModalInv.isBlocked ? (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-rose-100/70 border border-rose-300 rounded-xl text-rose-950 font-bold text-xs">
                      ⛔ বর্তমানে অ্যাকাউন্টটি ব্লক করা আছে।
                      <div className="text-[11px] font-normal text-rose-900 mt-0.5">
                        কারণ: {liveCredentialModalInv.blockReason || 'প্রশাসনিক পর্যালোচনা'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await unblockInvestorProfile(liveCredentialModalInv.id);
                        showToast('✓ ইনভেস্টর অ্যাকাউন্ট সফলভাবে আনব্লক করা হয়েছে!');
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>অ্যাকাউন্ট আনব্লক করুন</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ব্লক করার কারণ (যা লগইন করার সময় ব্যবহারকারী দেখতে পাবে):
                      </label>
                      <input
                        type="text"
                        value={tempBlockReason}
                        onChange={(e) => setTempBlockReason(e.target.value)}
                        placeholder="যেমন: হিসাব যাচাইকরণের জন্য সাময়িক স্থগিত"
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await blockInvestorProfile(liveCredentialModalInv.id, tempBlockReason);
                        showToast('✓ ইনভেস্টর অ্যাকাউন্ট ব্লক করা হয়েছে!');
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Ban className="w-4 h-4" />
                      <span>অ্যাকাউন্ট ব্লক করুন</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. IN-APP CONFIRMATION DIALOG MODAL */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className={`p-4 text-white flex items-center justify-between ${
              confirmDialog.variant === 'danger'
                ? 'bg-rose-700'
                : confirmDialog.variant === 'warning'
                ? 'bg-amber-600'
                : 'bg-emerald-700'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{confirmDialog.title}</span>
              </div>
              <button
                type="button"
                disabled={isConfirmBusy}
                onClick={() => setConfirmDialog(null)}
                className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed font-medium text-slate-800">{confirmDialog.message}</p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isConfirmBusy}
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={isConfirmBusy}
                  onClick={async () => {
                    setIsConfirmBusy(true);
                    try {
                      await confirmDialog.onConfirm();
                      setConfirmDialog(null);
                    } finally {
                      setIsConfirmBusy(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-white font-bold cursor-pointer disabled:opacity-50 ${
                    confirmDialog.variant === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : confirmDialog.variant === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isConfirmBusy ? 'প্রসেসিং...' : confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
