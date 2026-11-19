import React, { useRef, useState } from 'react';
import { FactorySettings } from '../types';
import { printElement, exportElementToPdf } from '../lib/printer';
import { DEFAULT_FACTORY_SETTINGS } from '../lib/firebase';
import {
  X,
  Printer,
  Download,
  FileText,
  FileCheck2,
  Building2,
  User,
  Sparkles,
  Info,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface BlankJobApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  factory?: FactorySettings;
  showToast?: (msg: string) => void;
}

export const BlankJobApplicationModal: React.FC<BlankJobApplicationModalProps> = ({
  isOpen,
  onClose,
  factory = DEFAULT_FACTORY_SETTINGS,
  showToast,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (printAreaRef.current) {
      printElement(printAreaRef.current, `ফাঁকা-চাকরির-আবেদন-ফরম-${factory.name || 'TexWare'}`, 'contract');
      showToast?.('ফাঁকা আবেদন ফরম প্রিন্ট উইন্ডো খোলা হয়েছে');
    }
  };

  const handleDownloadPdf = async () => {
    if (printAreaRef.current) {
      setIsExportingPdf(true);
      showToast?.('ফাঁকা ফরমের PDF তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...');
      const success = await exportElementToPdf(
        printAreaRef.current,
        `Blank-Job-Application-Form-${factory.name ? factory.name.replace(/\s+/g, '-') : 'TexWare'}`,
        (status) => setIsExportingPdf(status),
        true
      );
      setIsExportingPdf(false);
      if (success) {
        showToast?.('✓ ফাঁকা আবেদন ফরমের PDF ডাউনলোড সম্পন্ন হয়েছে');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] my-auto overflow-hidden border border-slate-200">
        
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white">
                  হাতে পূরণের ফাঁকা আবেদন ফরম (Blank Form)
                </h3>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                  হাতে লেখার জন্য প্রস্তুত
                </span>
              </div>
              <p className="text-xs text-slate-300">
                এই ফরমটি প্রিন্ট বা PDF ডাউনলোড করে প্রার্থীরা সরাসরি কলম দিয়ে হাতে পূরণ করতে পারবেন
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download PDF Button */}
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95 disabled:opacity-60"
              title="সরাসরি PDF ফাইল হিসেবে ডাউনলোড করুন"
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
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
              title="A4 সাইজের কাগজে সরাসরি প্রিন্ট করুন"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 প্রিন্ট</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document View */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100 flex justify-center">
          {/* Printable A4 Paper */}
          <div
            ref={printAreaRef}
            id="blankJobApplicationPrintArea"
            className="w-full max-w-[210mm] bg-white text-slate-900 p-5 sm:p-6 shadow-lg rounded-sm border border-slate-300 relative print:p-0 print:border-none print:shadow-none mx-auto"
            style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
          >
            {/* Header: Factory Official Letterhead */}
            <div className="border-b-2 border-slate-900 pb-2 mb-2">
              <div className="text-center">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                  {factory.name || 'টেক্স ওয়ার অ্যাপারেলস'}
                </h1>
                {factory.nameEn && (
                  <h2 className="text-[11px] font-bold tracking-widest text-slate-600 uppercase">
                    {factory.nameEn}
                  </h2>
                )}
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {factory.address || 'প্লট #১২, কোনাবাড়ী বিসিক শিল্প এলাকা, গাজীপুর-১৭০০'}
                </p>
                <p className="text-[11px] text-slate-600 font-mono">
                  ফোন: {factory.phone || '০১৭০০-১২৩৪৫৬'} {factory.email && `| ইমেইল: ${factory.email}`}
                </p>
              </div>

              {/* Title & Blank Form Indicators */}
              <div className="mt-2 flex items-center justify-between border-t border-slate-300 pt-2 flex-wrap gap-2">
                <div className="bg-slate-900 text-white px-3 py-0.5 rounded text-xs font-black tracking-wide inline-block uppercase">
                  শ্রমিক / কর্মচারী নিয়োগ আবেদনপত্র (হাতে পূরণের জন্য)
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-700">বিতরণ তারিখ:</span>{' '}
                    <span className="font-mono text-slate-900">....../....../২০২...</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">আবেদন নং:</span>{' '}
                    <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2 py-0.5 border border-slate-300 rounded inline-block min-w-[65px] text-center">
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Photos & Application Meta Corner */}
            <div className="flex gap-3 items-start justify-between mb-2.5 pb-2 border-b border-slate-200">
              <div className="flex-1 space-y-1.5 text-xs">
                <div className="p-2 bg-slate-50 border border-slate-300 rounded text-[10px] text-slate-700 leading-snug">
                  <span className="font-bold text-slate-900 block mb-0.5">সাধারণ নির্দেশনাবলী:</span>
                  ১. আবেদনকারীকে ফরমের সকল ঘর স্পষ্ট অক্ষরে নিজ হাতে কলম দিয়ে পূরণ করিতে হইবে।<br />
                  ২. আবেদনপত্রের সাথে জাতীয় পরিচয়পত্র (NID)/জন্ম নিবন্ধনের ফটোকপি ও ছবি সংযুক্ত করিতে হইবে।
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                  <div className="border-b border-dashed border-slate-400 pb-0.5">
                    <span className="text-slate-600 font-bold text-[11px]">আবেদনকৃত পদ:</span>{' '}
                    <span className="text-slate-400 font-mono">............................................</span>
                  </div>
                  <div className="border-b border-dashed border-slate-400 pb-0.5">
                    <span className="text-slate-600 font-bold text-[11px]">সেকশন/বিভাগ:</span>{' '}
                    <span className="text-slate-400 font-mono">............................................</span>
                  </div>
                </div>
              </div>

              {/* Photos Boxes */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-22 h-26 border-2 border-dashed border-slate-400 rounded-sm bg-slate-50 flex flex-col items-center justify-center p-1 text-center">
                  <User className="w-6 h-6 text-slate-400 mb-0.5" />
                  <span className="text-[8.5px] font-bold text-slate-600 leading-tight">
                    আবেদনকারীর পাসপোর্ট ছবি<br />(১ কপি আঠা দিয়ে লাগান)
                  </span>
                </div>

                <div className="w-20 h-26 border-2 border-dashed border-slate-300 rounded-sm bg-slate-50 flex flex-col items-center justify-center p-1 text-center">
                  <User className="w-5 h-5 text-slate-400 mb-0.5" />
                  <span className="text-[8.5px] font-bold text-slate-500 leading-tight">
                    অভিভাবকের ছবি<br />(১ কপি)
                  </span>
                </div>
              </div>
            </div>

            {/* Section 1: Applicant Personal Information (Handwritten Blank Grid) */}
            <div className="mb-2">
              <div className="bg-slate-100 px-2.5 py-0.5 font-bold text-xs text-slate-800 border-l-4 border-slate-900 mb-1 uppercase">
                ১. আবেদনকারীর ব্যক্তিগত তথ্যাবলী (জাতীয় পরিচয়পত্র / জন্ম নিবন্ধন অনুযায়ী)
              </div>
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-36 bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      নাম (বাংলায়):
                    </td>
                    <td className="p-1.5 text-slate-400 border-r border-slate-300">
                      ...........................................................................................
                    </td>
                    <td className="w-36 bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      Name (English Block):
                    </td>
                    <td className="p-1.5 text-slate-400">
                      ...........................................................................................
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      পিতার নাম:
                    </td>
                    <td className="p-1.5 text-slate-400 border-r border-slate-300">
                      ...........................................................................................
                    </td>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      মাতার নাম:
                    </td>
                    <td className="p-1.5 text-slate-400">
                      ...........................................................................................
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      স্বামী / স্ত্রীর নাম (যদি থাকে):
                    </td>
                    <td className="p-1.5 text-slate-400 border-r border-slate-300">
                      ...........................................................................................
                    </td>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      জাতীয় পরিচয়পত্র (NID) নং:
                    </td>
                    <td className="p-1.5 text-slate-400">
                      ...........................................................................................
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      জন্ম তারিখ ও বয়স:
                    </td>
                    <td className="p-1.5 text-slate-700 border-r border-slate-300">
                      তারিখ: ......./......./১৯..... ইং (বয়স: ........ বছর)
                    </td>
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      লিঙ্গ ও বৈবাহিক অবস্থা:
                    </td>
                    <td className="p-1.5 text-slate-700">
                      [ &nbsp; ] পুরুষ &nbsp; [ &nbsp; ] মহিলা &nbsp; [ &nbsp; ] অন্যান্য &nbsp;|&nbsp; [ &nbsp; ] বিবাহিত &nbsp; [ &nbsp; ] অবিবাহিত
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1.5 font-bold text-slate-700 border-r border-slate-300">
                      মোবাইল নম্বর:
                    </td>
                    <td className="p-1.5 text-slate-400 border-r border-slate-300">
                      ০ ১ ......................................................................
                    </td>
                    <td className="bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      বিকল্প মোবাইল / রক্তের গ্রুপ:
                    </td>
                    <td className="p-1 text-slate-700">
                      মোবাইল: ....................................... | রক্তের গ্রুপ: ................
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      বর্তমান ঠিকানা:
                    </td>
                    <td colSpan={3} className="p-1 text-slate-400">
                      গ্রাম/বাড়ি: ..................................................... ডাকঘর: ..................................................... থানা: ..................................................... জেলা: .....................................................
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      স্থায়ী ঠিকানা:
                    </td>
                    <td colSpan={3} className="p-1 text-slate-400">
                      গ্রাম/বাড়ি: ..................................................... ডাকঘর: ..................................................... থানা: ..................................................... জেলা: .....................................................
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Education & Experience */}
            <div className="mb-2">
              <div className="bg-slate-100 px-2.5 py-0.5 font-bold text-xs text-slate-800 border-l-4 border-slate-900 mb-1 uppercase">
                ২. শিক্ষাগত যোগ্যতা ও পূর্ববর্তী কাজের অভিজ্ঞতা
              </div>
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-36 bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      শিক্ষাগত যোগ্যতা:
                    </td>
                    <td className="p-1 text-slate-700 border-r border-slate-300">
                      [ &nbsp; ] প্রাথমিক/সাক্ষর &nbsp; [ &nbsp; ] ৮ম/JSC &nbsp; [ &nbsp; ] SSC &nbsp; [ &nbsp; ] HSC/অন্যান্য
                    </td>
                    <td className="w-36 bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      ব্যাংক / বিকাশ / নগদ হিসাব:
                    </td>
                    <td className="p-1 text-slate-400">
                      হিসাব নং: .................................................................
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      পূর্বের কাজের অভিজ্ঞতা:
                    </td>
                    <td colSpan={3} className="p-1 text-slate-400">
                      কারখানার নাম: .................................................................... পদবী: .................................................... মেয়াদ: ........ বছর ........ মাস
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Guardian / Nominee Information */}
            <div className="mb-2">
              <div className="bg-slate-100 px-2.5 py-0.5 font-bold text-xs text-slate-800 border-l-4 border-slate-900 mb-1 uppercase">
                ৩. অভিভাবক / নমিনির তথ্য (জরুরি প্রয়োজনে যোগাযোগের জন্য)
              </div>
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-36 bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      অভিভাবকের নাম:
                    </td>
                    <td className="p-1 text-slate-400 border-r border-slate-300">
                      ...........................................................................................
                    </td>
                    <td className="w-36 bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      সম্পর্ক:
                    </td>
                    <td className="p-1 text-slate-700">
                      [ &nbsp; ] পিতা &nbsp; [ &nbsp; ] স্বামী &nbsp; [ &nbsp; ] ভাই &nbsp; [ &nbsp; ] অন্যান্য
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      অভিভাবকের মোবাইল:
                    </td>
                    <td className="p-1 text-slate-400 border-r border-slate-300">
                      ০ ১ ......................................................................
                    </td>
                    <td className="bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      অভিভাবকের NID নং:
                    </td>
                    <td className="p-1 text-slate-400">
                      ...........................................................................................
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-1 font-bold text-slate-700 border-r border-slate-300">
                      অভিভাবকের ঠিকানা:
                    </td>
                    <td colSpan={3} className="p-1 text-slate-400">
                      ....................................................................................................................................................................................
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 4: Declaration & Applicant Signature Line */}
            <div className="mb-2 p-2 bg-slate-50 border border-slate-300 rounded text-xs space-y-1.5">
              <p className="font-semibold text-slate-800 leading-tight text-[10.5px]">
                <b>অঙ্গীকারনামা:</b> আমি শপথপূর্বক ঘোষণা করিতেছি যে, উপরে বর্ণিত যাবতীয় বিবরণ ও তথ্যাবলী আমার জ্ঞান ও বিশ্বাস মতে সম্পূর্ণ সত্য ও নির্ভুল। ভবিষ্যতে কোনো তথ্য ভুল বা অসত্য প্রমাণিত হইলে কারখানা কর্তৃপক্ষ বিনা নোটিশে আমার নিয়োগ বাতিল কিংবা প্রয়োজনীয় আইনানুগ ব্যবস্থা গ্রহণ করিতে পারিবেন।
              </p>
              <div className="pt-1.5 flex items-end justify-between">
                <div>
                  <span className="text-slate-600 text-[9.5px] block">আবেদনের তারিখ:</span>
                  <span className="font-bold text-slate-800 text-xs font-mono">....... / ....... / ২০২... ইং</span>
                </div>
                <div className="text-center">
                  <div className="w-44 h-8 border-b-2 border-slate-700 flex items-end justify-center pb-0.5">
                    <span className="text-[9.5px] text-slate-400 italic">এখানে দস্তখত বা টিপসই দিন</span>
                  </div>
                  <div className="pt-0.5 text-[9.5px] font-bold text-slate-800">
                    আবেদনকারী শ্রমিকের স্বাক্ষর / টিপসই
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Official Review & Decision Section */}
            <div className="border-2 border-slate-900 rounded p-2 bg-white">
              <div className="font-black text-xs text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5 uppercase flex items-center justify-between">
                <span>৪. কারখানা কর্তৃপক্ষের পর্যালোচনা ও চূড়ান্ত সিদ্ধান্ত (অফিসিয়াল ব্যবহারের জন্য)</span>
                <span className="text-[9.5px] text-slate-500 font-normal">FOR HR & MANAGEMENT USE ONLY</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs mb-2">
                <div className="p-1 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[9.5px] text-slate-600 block">বরাদ্দকৃত Worker ID:</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">TW - ........................</span>
                </div>
                <div className="p-1 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[9.5px] text-slate-600 block">অনুমোদিত মূল বেতন:</span>
                  <span className="font-bold text-slate-800 text-xs">৳ ...............................</span>
                </div>
                <div className="p-1 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[9.5px] text-slate-600 block">চূড়ান্ত পদবী ও গ্রেড:</span>
                  <span className="font-bold text-slate-800 text-xs">...................................</span>
                </div>
                <div className="p-1 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[9.5px] text-slate-600 block">যোগদানের তারিখ:</span>
                  <span className="font-bold text-slate-800 text-xs font-mono">...../...../২০২... ইং</span>
                </div>
              </div>

              {/* Official Signatures Row */}
              <div className="grid grid-cols-3 gap-6 pt-3 text-center text-xs">
                <div>
                  <div className="border-t border-slate-500 pt-0.5 font-bold text-slate-800 text-[11px]">
                    যাচাইকারীর স্বাক্ষর
                  </div>
                  <div className="text-[9.5px] text-slate-500">এইচআর / কল্যাণ কর্মকর্তা</div>
                </div>
                <div>
                  <div className="border-t border-slate-500 pt-0.5 font-bold text-slate-800 text-[11px]">
                    বিভাগীয় প্রধান / পিএম
                  </div>
                  <div className="text-[9.5px] text-slate-500">প্রোডাকশন ম্যানেজার</div>
                </div>
                <div>
                  <div className="border-t border-slate-900 pt-0.5 font-black text-slate-900 text-[11px]">
                    নিয়োগ কর্তৃপক্ষের অনুমোদন ও সিল
                  </div>
                  <div className="text-[9.5px] text-slate-500">ব্যবস্থাপনা পরিচালক / জিএম</div>
                </div>
              </div>
            </div>

            {/* Footer Note */}
            <div className="mt-1.5 pt-1 border-t border-slate-200 text-center text-[9.5px] text-slate-500 flex items-center justify-between">
              <span>{factory.name || 'টেক্স ওয়ার অ্যাপারেলস'} • নিয়োগ শাখা</span>
              <span>বাংলাদেশ শ্রম আইন ২০০৬ ও শ্রম বিধিমালা ২০১৫ অনুযায়ী সংরক্ষিত</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
