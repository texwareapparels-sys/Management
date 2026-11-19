import React, { useState } from 'react';
import { JobApplication } from '../types';
import { rejectJobApplication } from '../lib/firebase';
import { X, XCircle, AlertTriangle, Check, FileText } from 'lucide-react';

interface JobApplicationRejectModalProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedApp: JobApplication) => void;
  showToast: (msg: string) => void;
  onOpenRejectionLetter?: (app: JobApplication) => void;
}

const COMMON_REJECTION_REASONS = [
  'শ্রম আইন অনুযায়ী বয়স উপযুক্ত নয় (১৮ বছরের কম বা NID যাচাইয়ে অসঙ্গতি)',
  'আবেদনকৃত পদে পূর্বের প্রয়োজনীয় কাজের অভিজ্ঞতার ঘাটতি রয়েছে',
  'প্রয়োজনীয় কাগজপত্র বা জাতীয় পরিচয়পত্র (NID) অসম্পূর্ণ বা ক্রুটিপূর্ণ',
  'বর্তমানে সংশ্লিষ্ট সেকশনে কোনো শূন্য পদ নেই',
  'লিখিত বা ব্যবহারিক পরীক্ষায় উত্তীর্ণ হতে পারেন নাই',
  'অভিভাবকের তথ্য ও সম্মতি প্রদানে ব্যর্থ হয়েছেন',
];

export const JobApplicationRejectModal: React.FC<JobApplicationRejectModalProps> = ({
  application,
  isOpen,
  onClose,
  onSuccess,
  showToast,
  onOpenRejectionLetter,
}) => {
  const [reason, setReason] = useState<string>(COMMON_REJECTION_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !application) return null;

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = customReason.trim() ? customReason.trim() : reason;
    if (!finalReason) {
      showToast('অনুগ্রহ করে বাতিলের সুনির্দিষ্ট কারণ নির্বাচন বা লিখুন');
      return;
    }

    setIsSubmitting(true);
    try {
      await rejectJobApplication(application.id, finalReason, note.trim());
      const updated: JobApplication = {
        ...application,
        status: 'rejected',
        rejectionReason: finalReason,
        rejectionNote: note.trim(),
        rejectedAt: Date.now(),
      };
      showToast(`আবেদন "${application.applicationNo}" বাতিল করা হয়েছে`);
      onSuccess(updated);
      onClose();
      // Open rejection letter for 1-click printing if requested
      if (onOpenRejectionLetter) {
        onOpenRejectionLetter(updated);
      }
    } catch (err) {
      console.error(err);
      showToast('আবেদন বাতিল করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-rose-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">আবেদন বাতিল করুন</h3>
              <p className="text-xs text-rose-200">
                আবেদন নং: <span className="font-mono font-bold text-white">{application.applicationNo}</span> | {application.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleReject} className="p-5 space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">সতর্কতা:</p>
              <p className="text-slate-700 mt-0.5">
                আবেদনটি বাতিল করা হলে প্রার্থীর স্ট্যাটাস <b>"বাতিলকৃত"</b> হবে এবং বাতিলের কারণ সহ <b>অফিসিয়াল বাতিলের চিঠি (A4 Rejection Notice)</b> স্বয়ংক্রিয়ভাবে তৈরি ও প্রিন্ট করা যাবে।
              </p>
            </div>
          </div>

          {/* Quick Reasons Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              বাতিলের সুনির্দিষ্ট কারণ নির্বাচন করুন:
            </label>
            <div className="space-y-1.5">
              {COMMON_REJECTION_REASONS.map((r, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    setReason(r);
                    setCustomReason('');
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition cursor-pointer flex items-center justify-between ${
                    reason === r && !customReason
                      ? 'bg-rose-50 border-rose-400 text-rose-950 font-semibold ring-1 ring-rose-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="leading-snug">{r}</span>
                  {reason === r && !customReason && (
                    <Check className="w-4 h-4 text-rose-600 shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              অথবা নিজস্ব কারণ লিখুন (ঐচ্ছিক):
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="যেমন: মৌখিক পরীক্ষায় উপস্থিত হতে পারেন নাই..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              অতিরিক্ত মন্তব্য বা অফিসিয়াল নোট (ঐচ্ছিক):
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="আবেদনকারী ভবিষ্যতে আবেদন করতে পারবেন কি না ইত্যাদি..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer transition"
            >
              বন্ধ করুন
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'বাতিল হচ্ছে...' : 'বাতিল নিশ্চিত করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
