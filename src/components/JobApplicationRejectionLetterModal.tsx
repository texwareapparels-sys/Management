import React, { useRef } from 'react';
import { JobApplication, FactorySettings } from '../types';
import { formatDateBn } from '../lib/utils';
import { printElement } from '../lib/printer';
import { DEFAULT_FACTORY_SETTINGS } from '../lib/firebase';
import { X, Printer, FileText, XCircle, Building2, Phone, MapPin } from 'lucide-react';

interface JobApplicationRejectionLetterModalProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  factory?: FactorySettings;
  showToast?: (msg: string) => void;
}

export const JobApplicationRejectionLetterModal: React.FC<JobApplicationRejectionLetterModalProps> = ({
  application,
  isOpen,
  onClose,
  factory = DEFAULT_FACTORY_SETTINGS,
  showToast,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !application) return null;

  const handlePrint = () => {
    if (printAreaRef.current) {
      printElement(printAreaRef.current, `বাতিলপত্র-${application.applicationNo}`, 'contract');
      showToast?.('বাতিলপত্র প্রিন্ট সম্পন্ন হয়েছে');
    }
  };

  const appDateFormatted = application.createdAt
    ? formatDateBn(new Date(application.createdAt).toISOString().split('T')[0])
    : '—';

  const rejectDateFormatted = application.rejectedAt
    ? formatDateBn(new Date(application.rejectedAt).toISOString().split('T')[0])
    : appDateFormatted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] my-auto overflow-hidden border border-slate-200">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">আবেদন বাতিলের অফিসিয়াল পত্র (A4)</h3>
              <p className="text-xs text-rose-200">
                আবেদন নং: <span className="font-mono font-bold text-white">{application.applicationNo}</span> | আবেদনকারী: {application.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট করুন (Print / PDF)</span>
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

        {/* Scrollable Printable A4 Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          <div
            ref={printAreaRef}
            id="rejectionLetterPrintArea"
            className="w-full max-w-[210mm] bg-white text-slate-900 p-8 sm:p-12 shadow-lg rounded-sm border border-slate-300 relative print:p-0 print:border-none print:shadow-none"
            style={{ minHeight: '260mm' }}
          >
            {/* Factory Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
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

            {/* Memo & Date */}
            <div className="flex justify-between items-center text-xs text-slate-700 mb-6 font-semibold">
              <div>
                স্মারক নং: <span className="font-mono font-bold text-slate-900">TWA/HR/REJ/{application.applicationNo}</span>
              </div>
              <div>
                তারিখ: <span className="font-bold text-slate-900">{rejectDateFormatted} খ্রিঃ</span>
              </div>
            </div>

            {/* Recipient Box */}
            <div className="mb-6 text-xs text-slate-800 space-y-1">
              <div className="font-bold text-slate-900 text-sm">বরাবর,</div>
              <div className="font-bold text-slate-900 text-sm">{application.name}</div>
              <div>পিতা: {application.fatherName}</div>
              <div>মাতা: {application.motherName}</div>
              <div>জাতীয় পরিচয়পত্র (NID) নং: <span className="font-mono font-bold">{application.nid}</span></div>
              <div>মোবাইল: <span className="font-mono">{application.mobile}</span></div>
              <div>ঠিকানা: {application.presentAddress}</div>
            </div>

            {/* Subject */}
            <div className="bg-slate-100 p-2.5 rounded border-l-4 border-rose-600 font-bold text-xs text-slate-900 mb-6">
              বিষয়: চাকরির আবেদনপত্র নামঞ্জুর / বাতিলকরণ প্রসঙ্গে বিজ্ঞপ্তি।
            </div>

            {/* Letter Body */}
            <div className="text-xs leading-relaxed text-slate-800 space-y-4 mb-8 text-justify">
              <p>
                জনাব/জনাবা,
              </p>
              <p>
                আপনার অবগতির জন্য জানানো যাইতেছে যে, অত্র কারখানায় <b>"{application.appliedDesignation}"</b> পদে নিয়োগ লাভের নিমিত্তে গত <b>{appDateFormatted} খ্রিঃ</b> তারিখে আপনি যে চাকরির আবেদনপত্র (আবেদন নং: <span className="font-mono font-bold">{application.applicationNo}</span>) দাখিল করিয়াছিলেন, তাহা কারখানা নিয়োগ কমিটির সভায় পুঙ্খানুপুঙ্খভাবে যাচাই ও পর্যালোচনা করা হইয়াছে।
              </p>
              <p>
                অতীব দুঃখের সহিত জানানো যাইতেছে যে, নিম্নবর্ণিত সুনির্দিষ্ট কারণবশত আপনার দাখিলকৃত আবেদনটি গ্রহণ করা সম্ভব হইতেছে না এবং আবেদনটি বাতিল ঘোষণা করা হইল:
              </p>

              {/* Rejection Reason Card */}
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg text-xs">
                <div className="font-bold text-rose-900 mb-1 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>বাতিলের কারণ:</span>
                </div>
                <div className="font-black text-rose-950 text-sm pl-5">
                  {application.rejectionReason || 'প্রয়োজনীয় যোগ্যতা বা কাগজপত্রের ঘাটতি'}
                </div>
                {application.rejectionNote && (
                  <div className="text-slate-700 text-[11px] mt-2 pl-5 pt-1 border-t border-rose-200">
                    <b>অতিরিক্ত মন্তব্য:</b> {application.rejectionNote}
                  </div>
                )}
              </div>

              <p>
                ভবিষ্যতে আমাদের প্রতিষ্ঠানে আপনার যোগ্যতা ও অভিজ্ঞতার সাথে সামঞ্জস্যপূর্ণ কোনো নতুন পদ উন্মুক্ত হইলে আপনার জীবনবৃত্তান্ত অগ্রাধিকার ভিত্তিতে বিবেচনা করা হইবে।
              </p>
              <p>
                আপনার উজ্জ্বল ভবিষ্যৎ, সুস্বাস্থ্য ও দীর্ঘায়ু কামনা করি।
              </p>
            </div>

            {/* Authority Signature */}
            <div className="pt-16 flex justify-between items-end text-xs">
              <div className="text-slate-500 text-[10px]">
                অনুলিপি: অফিস কপি ও মানবসম্পদ বিভাগ (HR)
              </div>
              <div className="text-center w-52">
                <div className="border-t-2 border-slate-900 pt-1.5">
                  <div className="font-black text-slate-900 text-xs">ব্যবস্থাপক (মানবসম্পদ ও প্রশাসন)</div>
                  <div className="text-slate-600 text-[10px]">{factory.name || 'টেক্স ওয়ার অ্যাপারেলস'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
