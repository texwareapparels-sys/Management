import React, { useRef, useState } from 'react';
import { JobApplication, FactorySettings } from '../types';
import { formatDateBn, toBengaliNumber, formatMoney } from '../lib/utils';
import { printElement, exportElementToPdf } from '../lib/printer';
import { DEFAULT_FACTORY_SETTINGS } from '../lib/firebase';
import {
  X,
  Printer,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Phone,
  MapPin,
  User,
  ShieldCheck,
  FileText,
  Trash2,
  Eye,
  Loader2,
  Pencil
} from 'lucide-react';

interface JobApplicationPrintModalProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  factory?: FactorySettings;
  showToast?: (msg: string) => void;
  onApproveClick?: (app: JobApplication) => void;
  onRejectClick?: (app: JobApplication) => void;
  onOpenContract?: (workerId: string) => void;
  onDeleteClick?: (app: JobApplication) => void;
  onEditClick?: (app: JobApplication) => void;
  isDraftPreview?: boolean;
  onOpenBlankForm?: () => void;
}

export const JobApplicationPrintModal: React.FC<JobApplicationPrintModalProps> = ({
  application,
  isOpen,
  onClose,
  factory = DEFAULT_FACTORY_SETTINGS,
  showToast,
  onApproveClick,
  onRejectClick,
  onOpenContract,
  onDeleteClick,
  onEditClick,
  isDraftPreview = false,
  onOpenBlankForm,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!isOpen || !application) return null;

  const handlePrint = () => {
    if (printAreaRef.current) {
      printElement(printAreaRef.current, `আবেদনপত্র-${application.applicationNo}`, 'contract');
      showToast?.('আবেদনপত্র প্রিন্ট সম্পন্ন হয়েছে');
    }
  };

  const handleDownloadPdf = async () => {
    if (printAreaRef.current) {
      setIsExportingPdf(true);
      showToast?.('আবেদন ফরমের PDF প্রস্তুত হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...');
      const applicantNameClean = (application.name || 'Candidate').replace(/\s+/g, '-');
      const filename = `Job-Application-${application.applicationNo}-${applicantNameClean}`;
      const success = await exportElementToPdf(
        printAreaRef.current,
        filename,
        (status) => setIsExportingPdf(status)
      );
      setIsExportingPdf(false);
      if (success) {
        showToast?.('✓ আবেদন ফরমের PDF সফলভাবে ডাউনলোড হয়েছে');
      }
    }
  };

  const appDateFormatted = application.createdAt
    ? formatDateBn(new Date(application.createdAt).toISOString().split('T')[0])
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] my-auto overflow-hidden border border-slate-200">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  {isDraftPreview ? 'আবেদন প্রিভিউ (A4 ফরম)' : 'শ্রমিক নিয়োগ আবেদনপত্র (A4 ফরম)'}
                </h3>
                {isDraftPreview ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-blue-500/20 text-blue-300 border-blue-400/30">
                    খসড়া প্রিভিউ (Draft)
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      application.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                        : application.status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                    }`}
                  >
                    {application.status === 'approved'
                      ? 'অনুমোদিত'
                      : application.status === 'rejected'
                      ? 'বাতিলকৃত'
                      : 'পেন্ডিং / অপেক্ষমাণ'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                আবেদন নং: <span className="font-mono font-bold text-amber-300">{application.applicationNo}</span> | আবেদনকারী: {application.name || 'নতুন প্রার্থী'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDraftPreview && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-sm active:scale-95"
              >
                <span>← ফরম জমা দিতে ফিরুন</span>
              </button>
            )}

            {/* Optional Blank Form Switcher */}
            {onOpenBlankForm && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBlankForm();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
                title="হাতে লেখার ফাঁকা ফরম দেখুন ও প্রিন্ট/ডাউনলোড করুন"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>ফাঁকা ফরম</span>
              </button>
            )}

            {!isDraftPreview && application.status === 'approved' && application.approvedWorkerId && onOpenContract && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenContract(application.approvedWorkerId!);
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
                title="চুক্তিপত্র দেখুন ও ডাউনলোড করুন"
              >
                <span>চুক্তিপত্র দেখুন</span>
              </button>
            )}

            {!isDraftPreview && onEditClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditClick(application);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
                title="আবেদনের তথ্য এডিট করুন"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>এডিট করুন</span>
              </button>
            )}

            {!isDraftPreview && application.status === 'pending' && onApproveClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onApproveClick(application);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>গ্রহণ করুন</span>
              </button>
            )}

            {!isDraftPreview && application.status === 'pending' && onRejectClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRejectClick(application);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>বাতিল করুন</span>
              </button>
            )}

            {!isDraftPreview && onDeleteClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteClick(application);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
                title="আবেদন মুছে ফেলুন"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>মুছে ফেলুন</span>
              </button>
            )}

            {/* Direct PDF Download Button */}
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95 disabled:opacity-60"
              title="A4 সাইজে PDF হিসেবে ডাউনলোড করুন"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isExportingPdf ? 'তৈরি হচ্ছে...' : 'PDF ডাউনলোড'}</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
              title="A4 সাইজের কাগজে প্রিন্ট করুন"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 প্রিন্ট</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          {/* Printable Document Box */}
          <div
            ref={printAreaRef}
            id="jobApplicationPrintArea"
            className="bg-white text-slate-900 p-5 sm:p-6 shadow-lg rounded-sm border border-slate-300 relative print:p-0 print:border-none print:shadow-none mx-auto"
            style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
          >
            {/* Header: Factory Letterhead */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="text-center">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                  {factory.name || 'টেক্স ওয়ার অ্যাপারেলস'}
                </h1>
                {factory.nameEn && (
                  <h2 className="text-xs font-bold tracking-widest text-slate-600 uppercase">
                    {factory.nameEn}
                  </h2>
                )}
                <p className="text-xs text-slate-600 mt-1">
                  {factory.address || 'প্লট #১২, কোনাবাড়ী বিসিক শিল্প এলাকা, গাজীপুর-১৭০০'}
                </p>
                <p className="text-xs text-slate-600 font-mono">
                  ফোন: {factory.phone || '০১৭০০-১২৩৪৫৬'} {factory.email && `| ইমেইল: ${factory.email}`}
                </p>
              </div>

              {/* Title & Tracking Stamp */}
              <div className="mt-3 flex items-center justify-between border-t border-slate-300 pt-3 flex-wrap gap-2">
                <div className="bg-slate-900 text-white px-4 py-1 rounded text-sm font-black tracking-wide inline-block uppercase">
                  শ্রমিক / কর্মচারী নিয়োগ আবেদনপত্র
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-600">আবেদন নং:</span>{' '}
                    <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 border border-slate-300 rounded">
                      {application.applicationNo}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600">তারিখ:</span>{' '}
                    <span className="font-bold text-slate-900">{appDateFormatted}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Applicant Photo & Top Vital Box */}
            <div className="flex flex-col-reverse sm:flex-row gap-5 items-start justify-between mb-5 pb-4 border-b border-slate-200">
              <div className="flex-1 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <span className="text-slate-500 font-semibold block">আবেদনকৃত পদ:</span>
                    <span className="text-sm font-black text-slate-900">{application.appliedDesignation}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">সেকশন / বিভাগ:</span>
                    <span className="text-sm font-bold text-slate-800">{application.department || 'সাধারণ উৎপাদন'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">শিক্ষাগত যোগ্যতা:</span>
                    <span className="text-sm font-bold text-slate-800">
                      {application.education || 'উল্লেখ নেই'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">মোবাইল নম্বর:</span>
                    <span className="text-sm font-bold font-mono text-slate-900">{application.mobile}</span>
                  </div>
                </div>

                {/* Status Callout */}
                <div className="mt-2 pt-2 border-t border-dashed border-slate-200 flex items-center gap-2">
                  <span className="text-slate-600 font-bold">আবেদনের বর্তমান অবস্থা:</span>
                  {application.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[11px]">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      অনুমোদিত (নিয়োগকৃত - আইডি: {application.approvedWorkerId || 'TW-NEW'})
                    </span>
                  ) : application.status === 'rejected' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-300 text-[11px]">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      বাতিলকৃত ({application.rejectionReason || 'অনুপযুক্ত'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      বিবেচনাধীন / অপেক্ষমাণ (Pending)
                    </span>
                  )}
                </div>
              </div>

              {/* Photos Corner: Applicant & Guardian */}
              <div className="flex items-center gap-3 shrink-0 self-center sm:self-start">
                {/* Applicant Photo */}
                <div className="text-center">
                  <div className="w-28 h-32 border-2 border-slate-400 rounded-sm overflow-hidden bg-slate-50 flex items-center justify-center p-0.5 shadow-xs">
                    {application.photoUrl ? (
                      <img
                        src={application.photoUrl}
                        alt="Applicant"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <User className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        <span className="text-[10px] font-semibold block">শ্রমিকের ছবি</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-1 block">শ্রমিকের ছবি</span>
                </div>

                {/* Guardian Photo (if available) */}
                {application.guardianPhotoUrl && (
                  <div className="text-center">
                    <div className="w-24 h-28 border-2 border-dashed border-slate-400 rounded-sm overflow-hidden bg-slate-50 flex items-center justify-center p-0.5 shadow-xs">
                      <img
                        src={application.guardianPhotoUrl}
                        alt="Guardian"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 mt-1 block">অভিভাবকের ছবি</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 1: Applicant Personal Information */}
            <div className="mb-4">
              <div className="bg-slate-100 px-3 py-1 font-bold text-xs text-slate-800 border-l-4 border-slate-900 mb-2 uppercase">
                ১. আবেদনকারীর ব্যক্তিগত তথ্যাবলী (জাতীয় পরিচয়পত্র অনুযায়ী)
              </div>
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-36 bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      নাম (বাংলায়):
                    </td>
                    <td className="p-1.5 font-bold text-slate-900 border-r border-slate-300">
                      {application.name}
                    </td>
                    <td className="w-36 bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      Name (English):
                    </td>
                    <td className="p-1.5 font-mono text-slate-900">
                      {application.nameEn || '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      পিতার নাম:
                    </td>
                    <td className="p-1.5 text-slate-900 border-r border-slate-300">
                      {application.fatherName}
                    </td>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      মাতার নাম:
                    </td>
                    <td className="p-1.5 text-slate-900">
                      {application.motherName}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      জাতীয় পরিচয়পত্র (NID) নং:
                    </td>
                    <td className="p-1.5 font-mono font-bold text-slate-900 border-r border-slate-300">
                      {application.nid}
                    </td>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      জন্ম তারিখ ও বয়স:
                    </td>
                    <td className="p-1.5 text-slate-900">
                      {formatDateBn(application.birthDate)} {application.age ? `(${application.age} বছর)` : ''}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      লিঙ্গ ও বৈবাহিক অবস্থা:
                    </td>
                    <td className="p-1.5 text-slate-900 border-r border-slate-300">
                      {application.gender === 'male' ? 'পুরুষ' : application.gender === 'female' ? 'মহিলা' : 'অন্যান্য'}{' '}
                      / {application.maritalStatus === 'married' ? 'বিবাহিত' : application.maritalStatus === 'unmarried' ? 'অবিবাহিত' : application.maritalStatus || '—'}
                    </td>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      রক্তের গ্রুপ:
                    </td>
                    <td className="p-1.5 font-bold text-slate-900">
                      {application.bloodGroup || '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      মোবাইল নম্বর:
                    </td>
                    <td className="p-1.5 font-mono text-slate-900 border-r border-slate-300">
                      {application.mobile}
                    </td>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      বিকল্প মোবাইল নং:
                    </td>
                    <td className="p-1.5 font-mono text-slate-900">
                      {application.altMobile || '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      বর্তমান ঠিকানা:
                    </td>
                    <td colSpan={3} className="p-1.5 text-slate-900">
                      {application.presentAddress}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      স্থায়ী ঠিকানা:
                    </td>
                    <td colSpan={3} className="p-1.5 text-slate-900">
                      {application.permanentAddress}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Education & Experience */}
            <div className="mb-4">
              <div className="bg-slate-100 px-3 py-1 font-bold text-xs text-slate-800 border-l-4 border-slate-900 mb-2 uppercase">
                ২. শিক্ষাগত যোগ্যতা ও কাজের অভিজ্ঞতা
              </div>
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-36 bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      শিক্ষাগত যোগ্যতা:
                    </td>
                    <td className="p-1.5 text-slate-900 border-r border-slate-300">
                      {application.education || 'সাধারণ সাক্ষর / প্রাথমিক'}
                    </td>
                    <td className="w-36 bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      ব্যাংক / মোবাইল ব্যাংকিং:
                    </td>
                    <td className="p-1.5 text-slate-900 font-mono">
                      {application.bankName ? `${application.bankName} (${application.accountNumber || '—'})` : 'ক্যাশ পেমেন্ট'}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      পূর্বের কাজের অভিজ্ঞতা:
                    </td>
                    <td colSpan={3} className="p-1.5 text-slate-900">
                      {application.experience || 'পূর্বে গার্মেন্টস বা সংশ্লিষ্ট কারখানায় কাজের অভিজ্ঞতা নেই (নতুন কর্মী)।'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Guardian / Nominee Information */}
            <div className="mb-4">
              <div className="bg-slate-100 px-3 py-1 font-bold text-xs text-slate-800 border-l-4 border-slate-900 mb-2 uppercase">
                ৩. অভিভাবক / নমিনির তথ্য (জরুরি প্রয়োজনে যোগাযোগের জন্য)
              </div>
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-36 bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      অভিভাবকের নাম:
                    </td>
                    <td className="p-1.5 font-bold text-slate-900 border-r border-slate-300">
                      {application.guardianName}
                    </td>
                    <td className="w-36 bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      সম্পর্ক:
                    </td>
                    <td className="p-1.5 font-bold text-slate-900">
                      {application.guardianRelation}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      অভিভাবকের মোবাইল:
                    </td>
                    <td className="p-1.5 font-mono text-slate-900 border-r border-slate-300">
                      {application.guardianMobile}
                    </td>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      অভিভাবকের NID নং:
                    </td>
                    <td className="p-1.5 font-mono text-slate-900">
                      {application.guardianNid || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      অভিভাবকের ঠিকানা:
                    </td>
                    <td colSpan={3} className="p-1.5 text-slate-900">
                      {application.guardianAddress || application.permanentAddress}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 4: Declaration & Applicant Signature */}
            <div className="mb-5 p-3 bg-slate-50 border border-slate-300 rounded text-xs space-y-2">
              <p className="font-semibold text-slate-800 leading-relaxed text-[11px]">
                <b>অঙ্গীকারনামা:</b> আমি শপথপূর্বক ঘোষণা করিতেছি যে, উপরে বর্ণিত যাবতীয় বিবরণ ও তথ্যাবলী আমার জ্ঞান ও বিশ্বাস মতে সম্পূর্ণ সত্য ও নির্ভুল। ভবিষ্যতে কোনো তথ্য ভুল বা অসত্য প্রমাণিত হইলে কারখানা কর্তৃপক্ষ বিনা নোটিশে আমার নিয়োগ বাতিল কিংবা আইনানুগ ব্যবস্থা গ্রহণ করিতে পারিবেন।
              </p>
              <div className="pt-4 flex items-end justify-between">
                <div>
                  <span className="text-slate-500 text-[10px] block">আবেদনের তারিখ:</span>
                  <span className="font-bold text-slate-800 text-xs">{appDateFormatted}</span>
                </div>
                <div className="text-center">
                  <div className="h-12 flex items-center justify-center">
                    {application.signatureUrl ? (
                      <img
                        src={application.signatureUrl}
                        alt="Signature"
                        className="max-h-11 max-w-[150px] object-contain"
                      />
                    ) : (
                      <div className="w-32 border-b border-slate-400" />
                    )}
                  </div>
                  <div className="border-t border-slate-700 pt-0.5 px-4 text-[10px] font-bold text-slate-800">
                    আবেদনকারী শ্রমিকের স্বাক্ষর
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Official Review & Decision Section */}
            <div className="border-2 border-slate-900 rounded p-3 bg-white">
              <div className="font-black text-xs text-slate-900 border-b border-slate-300 pb-1 mb-2 uppercase flex items-center justify-between">
                <span>৪. কারখানা কর্তৃপক্ষের পর্যালোচনা ও চূড়ান্ত সিদ্ধান্ত (অফিসিয়াল ব্যবহারের জন্য)</span>
                <span className="text-[10px] text-slate-500 font-normal">FOR HR & MANAGEMENT USE</span>
              </div>

              {application.status === 'approved' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-900">
                      আবেদনটি সাদরে গ্রহণ ও অনুমোদন করা হয়েছে। সংশ্লিষ্ট শ্রমিককে কারখানার নিয়মিত তালিকায় অন্তর্ভুক্ত করা হলো।
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-1.5 bg-slate-50 border border-slate-200 rounded">
                      <span className="text-[10px] text-slate-500 block">বরাদ্দকৃত Worker ID:</span>
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {application.approvedWorkerId || 'TW-NEW'}
                      </span>
                    </div>
                    <div className="p-1.5 bg-slate-50 border border-slate-200 rounded">
                      <span className="text-[10px] text-slate-500 block">অনুমোদিত মাসিক মূল বেতন:</span>
                      <span className="font-black text-emerald-800 text-sm">
                        ৳ {formatMoney(application.approvedSalary || application.expectedSalary)}
                      </span>
                    </div>
                    <div className="p-1.5 bg-slate-50 border border-slate-200 rounded">
                      <span className="text-[10px] text-slate-500 block">চূড়ান্ত পদবী:</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {application.appliedDesignation}
                      </span>
                    </div>
                    <div className="p-1.5 bg-slate-50 border border-slate-200 rounded">
                      <span className="text-[10px] text-slate-500 block">অনুমোদনের তারিখ:</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {application.approvedAt
                          ? formatDateBn(new Date(application.approvedAt).toISOString().split('T')[0])
                          : appDateFormatted}
                      </span>
                    </div>
                  </div>
                </div>
              ) : application.status === 'rejected' ? (
                <div className="space-y-2">
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900 mb-1">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>আবেদনটি নামঞ্জুর / বাতিল করা হয়েছে</span>
                    </div>
                    <p className="text-slate-800">
                      <b>বাতিলের সুনির্দিষ্ট কারণ:</b>{' '}
                      <span className="font-semibold text-rose-700">{application.rejectionReason}</span>
                    </p>
                    {application.rejectionNote && (
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        <b>মন্তব্য:</b> {application.rejectionNote}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center justify-between">
                  <span>আবেদনটি বর্তমানে যাচাই-বাছাই ও অপেক্ষমাণ অবস্থায় রয়েছে। কর্তৃপক্ষের চূড়ান্ত অনুমোদন প্রক্রিয়াধীন।</span>
                  <span className="font-mono font-bold text-amber-800">STATUS: PENDING</span>
                </div>
              )}

              {/* Signatures Row */}
              <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs">
                <div>
                  <div className="border-t border-slate-500 pt-1 font-bold text-slate-800">
                    যাচাইকারীর স্বাক্ষর
                  </div>
                  <div className="text-[10px] text-slate-500">এইচআর / কল্যাণ কর্মকর্তা</div>
                </div>
                <div>
                  <div className="border-t border-slate-500 pt-1 font-bold text-slate-800">
                    বিভাগীয় প্রধান / পিএম
                  </div>
                  <div className="text-[10px] text-slate-500">প্রোডাকশন ম্যানেজার</div>
                </div>
                <div>
                  <div className="border-t border-slate-900 pt-1 font-black text-slate-900">
                    নিয়োগ কর্তৃপক্ষের অনুমোদন ও সিল
                  </div>
                  <div className="text-[10px] text-slate-500">ব্যবস্থাপনা পরিচালক / জিএম</div>
                </div>
              </div>
            </div>

            {/* Small Footer Stamp */}
            <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[10px] text-slate-500 flex items-center justify-between">
              <span>{factory.name || 'টেক্স ওয়ার অ্যাপারেলস'} এইচআর পোর্টাল</span>
              <span>বাংলাদেশ শ্রম আইন ২০০৬ ও শ্রম বিধিমালা ২০১৫ মোতাবেক সংরক্ষিত</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
