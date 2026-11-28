import React, { useState } from 'react';
import { Employee } from '../types';
import { formatDateBn, formatMoney, toBengaliNumber, getStatusBadge } from '../lib/utils';
import {
  User,
  ShieldCheck,
  Lock,
  Phone,
  CreditCard,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  IdCard,
  FileText,
  Building2,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  Info,
  Award,
  Smartphone,
  Download
} from 'lucide-react';

interface WorkerProfileReadOnlyProps {
  employee: Employee;
  onOpenPhotoModal?: () => void;
  onBackToAttendance?: () => void;
  onOpenInstallModal?: () => void;
  showToast: (msg: string) => void;
}

export const WorkerProfileReadOnly: React.FC<WorkerProfileReadOnlyProps> = ({
  employee,
  onOpenPhotoModal,
  onBackToAttendance,
  onOpenInstallModal,
  showToast,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`${label} কপি করা হয়েছে`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const statusInfo = getStatusBadge(employee.status);

  // Calculate employment duration
  const getTenure = (joinDateStr?: string) => {
    if (!joinDateStr) return '—';
    try {
      const join = new Date(joinDateStr);
      const now = new Date();
      if (isNaN(join.getTime())) return '—';
      const diffMs = now.getTime() - join.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return '—';
      const months = Math.floor(diffDays / 30.4375);
      const years = Math.floor(months / 12);
      const remMonths = months % 12;

      if (years > 0) {
        return `${toBengaliNumber(years)} বছর ${remMonths > 0 ? `${toBengaliNumber(remMonths)} মাস` : ''} (${toBengaliNumber(diffDays)} দিন)`;
      }
      if (months > 0) {
        return `${toBengaliNumber(months)} মাস (${toBengaliNumber(diffDays)} দিন)`;
      }
      return `${toBengaliNumber(diffDays)} দিন`;
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 1. Header Information & Read-Only Notice Bar */}
      <div className="bg-gradient-to-r from-[#08142E] via-[#0F2149] to-[#132B63] text-white rounded-2xl p-4 sm:p-5 shadow-md border border-[#1E3A8A]/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white flex items-center justify-center shrink-0 shadow-sm">
              <IdCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-white">
                  কর্মী পূর্ণাঙ্গ প্রোফাইল তথ্য
                </h3>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/20 text-amber-200 border border-amber-400/35 text-[10px] font-black inline-flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>শুধুমাত্র প্রদর্শনযোগ্য (Read-Only)</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                আপনার কারখানায় নিবন্ধিত সকল অফিসিয়াল তথ্য একনজরে সংরক্ষিত
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onBackToAttendance && (
              <button
                type="button"
                onClick={onBackToAttendance}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#1D63DC] to-[#2563EB] hover:from-blue-500 hover:to-blue-600 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
              >
                <span>← হাজিরা ভিউতে ফিরুন</span>
              </button>
            )}
          </div>
        </div>

        {/* Informational Sub-badge */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-amber-200/90">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            নিরাপত্তা বিধি: শ্রমিক পোর্টাল থেকে তথ্য পরিবর্তন বন্ধ রাখা হয়েছে। কোনো তথ্য পরিবর্তন বা সংশোধনের প্রয়োজন হলে কারখানা এইচআর / অ্যাডমিন শাখার সাথে যোগাযোগ করুন।
          </span>
        </div>
      </div>

      {/* 1.1 Dedicated Worker App Phone Install Card */}
      <div className="bg-gradient-to-r from-[#059669] via-[#0D9488] to-[#0284C7] text-white rounded-2xl p-4 sm:p-5 shadow-md border border-emerald-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/15 p-2 flex items-center justify-center border border-white/25 shadow-inner shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-sm sm:text-base text-white">
                টেক্স ওয়ার শ্রমিক অ্যাপ ফোনে ডাউনলোড / ইনস্টল করুন
              </h4>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-lg">
                শ্রমিকদের জন্য স্বতন্ত্র অ্যাপ
              </span>
            </div>
            <p className="text-xs text-teal-50 mt-1 leading-relaxed">
              প্লে-স্টোর ছাড়াই আপনার মোবাইলের হোম স্ক্রিনে অ্যাপটি ইনস্টল করে রাখুন। প্রতিদিন ব্রাউজারে লিংক খোঁজা ছাড়াই সরাসরি আইডি ও পাসওয়ার্ড দিয়ে নিজের হাজিরা ও বেতন দেখুন।
            </p>
          </div>
        </div>

        {onOpenInstallModal && (
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>শ্রমিক অ্যাপ ইনস্টল করুন</span>
          </button>
        )}
      </div>

      {/* 2. Compact All-in-One Information Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
        
        {/* Top Profile Summary Strip */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Photo with zoom trigger */}
            <div
              onClick={onOpenPhotoModal}
              className="w-16 h-20 sm:w-20 sm:h-24 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-inner relative group cursor-pointer hover:border-blue-400 transition"
              title="বড় করে দেখতে চাপুন"
            >
              {employee.photoUrl ? (
                <img
                  src={employee.photoUrl}
                  alt={employee.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              ) : (
                <User className="w-8 h-8 text-slate-400" />
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                <Eye className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base sm:text-lg font-black text-slate-900">{employee.name}</h4>
                <button
                  type="button"
                  onClick={() => handleCopy(employee.workerId, 'workerId', 'Worker ID')}
                  className="font-mono font-black text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 cursor-pointer transition"
                  title="কপি করতে চাপুন"
                >
                  <span>{employee.workerId}</span>
                  {copiedKey === 'workerId' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-blue-500" />}
                </button>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                  {statusInfo.label}
                </span>
              </div>

              <p className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800">{employee.designation}</span>
                <span>•</span>
                <span>সেকশন: <b className="text-slate-800">{employee.department || 'সুইং'}</b></span>
              </p>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {employee.mobile || '—'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  যোগদান: {formatDateBn(employee.joinDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Key Rates Highlights (Colorful Gradient Metric Tiles) */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div className="px-3.5 py-2 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#2563EB] text-white text-center shadow-xs">
              <span className="text-[10px] text-white/85 block font-semibold">মূল বেতন</span>
              <span className="font-mono font-black text-xs sm:text-sm text-white tabular-nums">৳ {formatMoney(Number(employee.salary || 0))}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-gradient-to-br from-[#635BFF] to-[#4338CA] text-white text-center shadow-xs">
              <span className="text-[10px] text-white/85 block font-semibold">ওটি রেট (ঘণ্টা)</span>
              <span className="font-mono font-black text-xs sm:text-sm text-white tabular-nums">৳ {toBengaliNumber(Number(employee.otRate || 0))}</span>
            </div>
          </div>
        </div>

        {/* 3. Compact Categorized Detail Sections in 1 Place */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Section 1: ব্যক্তিগত ও জাতীয় পরিচয় */}
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#1D63DC] to-[#2563EB] text-white flex items-center justify-center shadow-xs">
                <User className="w-3.5 h-3.5" />
              </div>
              <span>ব্যক্তিগত ও পরিচয় তথ্য</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              
              {/* NID Card */}
              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">জাতীয় পরিচয়পত্র (NID):</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{employee.nid || 'রেকর্ড নেই'}</span>
                  {employee.nid && (
                    <button
                      type="button"
                      onClick={() => handleCopy(employee.nid!, 'nid', 'NID')}
                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                      title="কপি করুন"
                    >
                      {copiedKey === 'nid' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile Number */}
              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">নিবন্ধিত মোবাইল:</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{employee.mobile || '—'}</span>
                  {employee.mobile && (
                    <button
                      type="button"
                      onClick={() => handleCopy(employee.mobile!, 'mobile', 'মোবাইল')}
                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                      title="কপি করুন"
                    >
                      {copiedKey === 'mobile' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Birth Date */}
              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">জন্ম তারিখ:</span>
                <span className="font-bold text-slate-900">{formatDateBn(employee.birthDate)}</span>
              </div>

              {/* Present Address */}
              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200 sm:col-span-2 md:col-span-3">
                <span className="text-[11px] text-slate-500 block mb-0.5">বর্তমান ঠিকানা:</span>
                <span className="font-medium text-slate-800 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{employee.address || 'কারখানা রেকর্ডে ঠিকানা সংরক্ষিত নেই'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: চাকরি, পদবী ও শিফট তথ্য */}
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#635BFF] to-[#4338CA] text-white flex items-center justify-center shadow-xs">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <span>চাকরি ও কর্মসংস্থান তথ্য</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              
              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">যোগদানের তারিখ:</span>
                <span className="font-bold text-slate-900">{formatDateBn(employee.joinDate)}</span>
              </div>

              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">চাকরির বয়স / কর্মকাল:</span>
                <span className="font-bold text-indigo-950 font-mono">{getTenure(employee.joinDate)}</span>
              </div>

              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">স্ট্যান্ডার্ড কর্মঘণ্টা:</span>
                <span className="font-medium text-slate-900 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>সকাল ৮:০০ - বিকাল ৫:০০ (৮ ঘণ্টা)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: বেতন ও পেমেন্ট অ্যাকাউন্ট বিবরণী */}
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#059669] to-[#16A34A] text-white flex items-center justify-center shadow-xs">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <span>বেতন ও পেমেন্ট অ্যাকাউন্ট বিবরণী</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              
              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">নির্ধারিত মাসিক মূল বেতন:</span>
                <span className="font-mono font-black text-slate-900">৳ {formatMoney(Number(employee.salary || 0))}</span>
              </div>

              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">প্রতি ঘণ্টা ওভারটাইম রেট:</span>
                <span className="font-mono font-black text-indigo-700">৳ {toBengaliNumber(Number(employee.otRate || 0))} / ঘণ্টা</span>
              </div>

              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block mb-0.5">বেতন গ্রহণের মাধ্যম / অ্যাকাউন্ট:</span>
                <span className="font-bold text-slate-900 font-mono flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {employee.bankName
                      ? `${employee.bankName} ${employee.accountNumber ? `(${employee.accountNumber})` : ''}`
                      : 'ক্যাশ / নগদ পরিশোধ'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: অনুমোদিত ডিজিটাল স্বাক্ষর (Official Digital Signature) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                <Award className="w-3.5 h-3.5 text-teal-600" />
                <span>কারখানায় সংরক্ষিত ডিজিটাল স্বাক্ষর (Official Signature)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                চুক্তিপত্র ও রসিদের জন্য সংরক্ষিত
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {employee.signatureUrl ? (
                  <div className="h-14 px-4 py-1.5 bg-white border border-slate-300 rounded-lg flex items-center justify-center shadow-2xs">
                    <img
                      src={employee.signatureUrl}
                      alt="Signature"
                      className="max-h-11 object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-12 px-3 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                    কোনো ডিজিটাল স্বাক্ষর যুক্ত নেই
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {employee.signatureUrl ? 'স্বাক্ষর ভেরিফাইড ও সক্রিয়' : 'স্বাক্ষর রেকর্ড খালি'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {employee.signatureUrl
                      ? 'কারখানা সার্ভারে আপনার আনুষ্ঠানিক স্বাক্ষর সংরক্ষিত রয়েছে।'
                      : 'স্বাক্ষর যোগ করতে কারখানার এইচআর শাখায় যোগাযোগ করুন।'}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>রিড-অনলি মোড</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Bottom Support Note */}
        <div className="p-4 bg-slate-50 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">
              তথ্য হালনাগাদ ও সহায়তা প্রয়োজন?
            </p>
            <p className="text-[11px] leading-relaxed">
              কারখানা বিধি অনুযায়ী শ্রমিক সরাসরি নিজের তথ্য পরিবর্তন করতে পারবেন না। যদি আপনার মোবাইল নম্বর, নাম, ঠিকানা বা ব্যাংক অ্যাকাউন্টে কোনো পরিবর্তন আনতে চান, তবে জাতীয় পরিচয়পত্র বা প্রমাণপত্র সহ কারখানা প্রশাসন অথবা মানবসম্পদ (HR) বিভাগে যোগাযোগ করুন।
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
