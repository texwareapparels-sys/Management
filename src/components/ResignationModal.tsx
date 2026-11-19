import React, { useState, useEffect } from 'react';
import { Employee, EmploymentStatus } from '../types';
import { updateResignationStatus } from '../lib/firebase';
import { X, UserX, CheckCircle2, AlertTriangle, RotateCcw, Calendar, FileText, BadgeCheck, ShieldAlert, Clock, Printer } from 'lucide-react';

interface ResignationModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onOpenResignationLetter?: (emp: Employee) => void;
  onOpenSuspensionNotice?: (emp: Employee) => void;
  onOpenTerminationNotice?: (emp: Employee) => void;
}

const RESIGNATION_REASONS = [
  'অধিকতর সুবিধাজনক সুযোগ বা নতুন চাকরিতে যোগদান',
  'পারিবারিক বা ব্যক্তিগত কারণ',
  'শারীরিক অসুস্থতা বা স্বাস্থ্যগত সমস্যা',
  'স্থায়ীভাবে নিজ গ্রামে বা এলাকায় ফিরে যাওয়া',
  'বিবাহ বা মাতৃত্বকালীন কারণে ছাড়পত্র',
  'উচ্চশিক্ষা বা বিদেশ গমণ',
  'যাতায়াত বা দূরত্বের সমস্যা',
  'অন্যান্য কারণ (নিচে বিস্তারিত লিখুন)'
];

const SUSPENSION_REASONS = [
  'শৃঙ্খলাভঙ্গ সংক্রান্ত অভিযোগ তদন্তাধীন',
  'কারখানা কর্তৃপক্ষের অনুমতি ব্যতিরেকে কর্মবিরতি',
  'সহকর্মী বা সুপারভাইজারের সাথে অসদাচরণের অভিযোগ',
  'ফ্যাক্টরির নিরাপত্তা ও গোপনীয়তা নিয়ম লঙ্ঘন',
  'বারবার দায়িত্বে অবহেলা বা কারণ দর্শাও নোটিশের জবাব না দেওয়া',
  'সাময়িক কারখানা স্থগিতাদেশ বা প্রশাসনিক তদন্ত',
  'অন্যান্য কারণ (নিচে বিস্তারিত লিখুন)'
];

const TERMINATION_REASONS = [
  'গুরুতর শৃঙ্খলাভঙ্গ বা অসদাচরণের দায়ে বরখাস্ত',
  'বিনা অনুমতিতে ১০ কার্যদিবসের অধিক একটানা অনুপস্থিতি',
  'কারখানার সম্পত্তি নষ্ট, চুরি বা মারাত্মক আর্থিক ক্ষতিসাধন',
  'ইচ্ছাকৃত অবহেলা ও বারবার সতর্ক করার পরও সংশোধন না হওয়া',
  'শ্রম আইন অনুযায়ী কারখানা পুনর্গঠন বা ছাঁটাই (Retrenchment)',
  'মিথ্যা তথ্য বা জালিয়াতির দায়ে চাকরিচ্যুত',
  'অন্যান্য কারণ (নিচে বিস্তারিত লিখুন)'
];

export const ResignationModal: React.FC<ResignationModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSuccess,
  onOpenResignationLetter,
  onOpenSuspensionNotice,
  onOpenTerminationNotice,
}) => {
  if (!isOpen || !employee) return null;

  const [status, setStatus] = useState<EmploymentStatus>(employee.status || 'resigned');
  
  // Resignation state
  const [resignationDate, setResignationDate] = useState<string>(
    employee.resignationDate || new Date().toISOString().split('T')[0]
  );
  const [selectedResignReason, setSelectedResignReason] = useState<string>(
    employee.resignationReason && RESIGNATION_REASONS.includes(employee.resignationReason)
      ? employee.resignationReason
      : RESIGNATION_REASONS[0]
  );
  const [customResignReason, setCustomResignReason] = useState<string>(
    employee.resignationReason || ''
  );
  const [noticeServed, setNoticeServed] = useState<'yes' | 'no' | 'partial'>(
    employee.noticeServed || 'yes'
  );

  // Suspension state
  const [suspensionDate, setSuspensionDate] = useState<string>(
    employee.suspensionDate || new Date().toISOString().split('T')[0]
  );
  const [selectedSuspendReason, setSelectedSuspendReason] = useState<string>(
    employee.suspensionReason && SUSPENSION_REASONS.includes(employee.suspensionReason)
      ? employee.suspensionReason
      : SUSPENSION_REASONS[0]
  );
  const [customSuspendReason, setCustomSuspendReason] = useState<string>(
    employee.suspensionReason || ''
  );
  const [suspensionDuration, setSuspensionDuration] = useState<string>(
    employee.suspensionDuration || '৭ কার্যদিবস (তদন্ত সাপেক্ষে)'
  );

  // Termination state
  const [terminationDate, setTerminationDate] = useState<string>(
    employee.terminationDate || new Date().toISOString().split('T')[0]
  );
  const [selectedTermReason, setSelectedTermReason] = useState<string>(
    employee.terminationReason && TERMINATION_REASONS.includes(employee.terminationReason)
      ? employee.terminationReason
      : TERMINATION_REASONS[0]
  );
  const [customTermReason, setCustomTermReason] = useState<string>(
    employee.terminationReason || ''
  );
  const [terminationMemo, setTerminationMemo] = useState<string>(
    employee.terminationMemo || ''
  );

  // Common clearance & final settlement state
  const [clearanceDone, setClearanceDone] = useState<boolean>(
    Boolean(employee.clearanceDone)
  );
  const [finalSettlementPaid, setFinalSettlementPaid] = useState<boolean>(
    Boolean(employee.finalSettlementPaid)
  );
  const [finalSettlementNote, setFinalSettlementNote] = useState<string>(
    employee.finalSettlementNote || ''
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setStatus(employee.status || 'resigned');
      setResignationDate(employee.resignationDate || new Date().toISOString().split('T')[0]);
      
      const empResignReason = employee.resignationReason || '';
      if (empResignReason && RESIGNATION_REASONS.includes(empResignReason)) {
        setSelectedResignReason(empResignReason);
        setCustomResignReason('');
      } else if (empResignReason) {
        setSelectedResignReason(RESIGNATION_REASONS[RESIGNATION_REASONS.length - 1]);
        setCustomResignReason(empResignReason);
      } else {
        setSelectedResignReason(RESIGNATION_REASONS[0]);
        setCustomResignReason('');
      }

      setNoticeServed(employee.noticeServed || 'yes');
      setSuspensionDate(employee.suspensionDate || new Date().toISOString().split('T')[0]);

      const empSuspendReason = employee.suspensionReason || '';
      if (empSuspendReason && SUSPENSION_REASONS.includes(empSuspendReason)) {
        setSelectedSuspendReason(empSuspendReason);
        setCustomSuspendReason('');
      } else if (empSuspendReason) {
        setSelectedSuspendReason(SUSPENSION_REASONS[SUSPENSION_REASONS.length - 1]);
        setCustomSuspendReason(empSuspendReason);
      } else {
        setSelectedSuspendReason(SUSPENSION_REASONS[0]);
        setCustomSuspendReason('');
      }

      setSuspensionDuration(employee.suspensionDuration || '৭ কার্যদিবস (তদন্ত সাপেক্ষে)');
      setTerminationDate(employee.terminationDate || new Date().toISOString().split('T')[0]);

      const empTermReason = employee.terminationReason || '';
      if (empTermReason && TERMINATION_REASONS.includes(empTermReason)) {
        setSelectedTermReason(empTermReason);
        setCustomTermReason('');
      } else if (empTermReason) {
        setSelectedTermReason(TERMINATION_REASONS[TERMINATION_REASONS.length - 1]);
        setCustomTermReason(empTermReason);
      } else {
        setSelectedTermReason(TERMINATION_REASONS[0]);
        setCustomTermReason('');
      }

      setTerminationMemo(employee.terminationMemo || '');
      setClearanceDone(Boolean(employee.clearanceDone));
      setFinalSettlementPaid(Boolean(employee.finalSettlementPaid));
      setFinalSettlementNote(employee.finalSettlementNote || '');
      setErrorMessage(null);
    }
  }, [employee]);

  const handleSave = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const resignReasonFinal = selectedResignReason.includes('অন্যান্য')
        ? (customResignReason.trim() || 'অন্যান্য কারণ')
        : (customResignReason.trim() ? `${selectedResignReason} (${customResignReason.trim()})` : selectedResignReason);

      const suspendReasonFinal = selectedSuspendReason.includes('অন্যান্য')
        ? (customSuspendReason.trim() || 'অন্যান্য কারণ')
        : (customSuspendReason.trim() ? `${selectedSuspendReason} (${customSuspendReason.trim()})` : selectedSuspendReason);

      const termReasonFinal = selectedTermReason.includes('অন্যান্য')
        ? (customTermReason.trim() || 'অন্যান্য কারণ')
        : (customTermReason.trim() ? `${selectedTermReason} (${customTermReason.trim()})` : selectedTermReason);

      const payload: Partial<Employee> = {
        status,
        statusChangedAt: Date.now(),
      };

      if (status === 'resigned') {
        payload.resignationDate = resignationDate || new Date().toISOString().split('T')[0];
        payload.resignationReason = resignReasonFinal;
        payload.noticeServed = noticeServed;
        payload.clearanceDone = clearanceDone;
        payload.finalSettlementPaid = finalSettlementPaid;
        payload.finalSettlementNote = finalSettlementNote.trim();
        // Clear conflicting suspension or termination info
        payload.suspensionDate = '';
        payload.suspensionReason = '';
        payload.suspensionDuration = '';
        payload.terminationDate = '';
        payload.terminationReason = '';
        payload.terminationMemo = '';
      } else if (status === 'suspended') {
        payload.suspensionDate = suspensionDate || new Date().toISOString().split('T')[0];
        payload.suspensionReason = suspendReasonFinal;
        payload.suspensionDuration = suspensionDuration.trim();
        payload.clearanceDone = clearanceDone;
        payload.finalSettlementPaid = finalSettlementPaid;
        payload.finalSettlementNote = finalSettlementNote.trim();
        // Clear conflicting resignation or termination info
        payload.resignationDate = '';
        payload.resignationReason = '';
        payload.noticeServed = 'no';
        payload.terminationDate = '';
        payload.terminationReason = '';
        payload.terminationMemo = '';
      } else if (status === 'terminated') {
        payload.terminationDate = terminationDate || new Date().toISOString().split('T')[0];
        payload.terminationReason = termReasonFinal;
        payload.terminationMemo = terminationMemo.trim();
        payload.clearanceDone = clearanceDone;
        payload.finalSettlementPaid = finalSettlementPaid;
        payload.finalSettlementNote = finalSettlementNote.trim();
        // Clear conflicting resignation or suspension info
        payload.resignationDate = '';
        payload.resignationReason = '';
        payload.noticeServed = 'no';
        payload.suspensionDate = '';
        payload.suspensionReason = '';
        payload.suspensionDuration = '';
      } else {
        // active: clear all separation / resignation fields
        payload.resignationDate = '';
        payload.resignationReason = '';
        payload.noticeServed = 'no';
        payload.suspensionDate = '';
        payload.suspensionReason = '';
        payload.suspensionDuration = '';
        payload.terminationDate = '';
        payload.terminationReason = '';
        payload.terminationMemo = '';
        payload.clearanceDone = false;
        payload.finalSettlementPaid = false;
        payload.finalSettlementNote = '';
      }

      await updateResignationStatus(employee.id, payload);

      if (status === 'resigned') {
        onSuccess(`✓ "${employee.name}" এর পদত্যাগ / রিজাইন তথ্য সফলভাবে আপডেট হয়েছে`);
      } else if (status === 'suspended') {
        onSuccess(`✓ "${employee.name}" কে 'সাময়িক স্থগিত' সেকশনে আপডেট করা হয়েছে`);
      } else if (status === 'terminated') {
        onSuccess(`✓ "${employee.name}" কে 'অব্যাহতি / বরখাস্ত' সেকশনে আপডেট করা হয়েছে`);
      } else {
        onSuccess(`✓ "${employee.name}" সক্রিয় (Active) কর্মী হিসেবে বহাল করা হয়েছে`);
      }
      onClose();
    } catch (e) {
      console.error("Error updating resignation status:", e);
      setErrorMessage('স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              status === 'active'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : status === 'resigned'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                : status === 'suspended'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                : 'bg-slate-700 text-slate-200 border border-slate-600'
            }`}>
              {status === 'active' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {status === 'resigned' && <UserX className="w-5 h-5 text-rose-400" />}
              {status === 'suspended' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {status === 'terminated' && <RotateCcw className="w-5 h-5 text-slate-300" />}
            </div>
            <div>
              <h3 className="font-bold text-base">শ্রমিক স্ট্যাটাস ও সেকশন পরিবর্তন</h3>
              <p className="text-xs text-slate-300">
                {employee.name} (Worker ID: {employee.workerId} | পদবি: {employee.designation})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-slate-800 text-sm">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Status Selector - 4 distinct categories */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              শ্রমিকের জন্য প্রযোজ্য সেকশন ও স্ট্যাটাস নির্বাচন করুন *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  status === 'active'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                ১. কর্মরত / সক্রিয় (Active)
              </button>

              <button
                type="button"
                onClick={() => setStatus('resigned')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  status === 'resigned'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <UserX className="w-3.5 h-3.5" />
                ২. পদত্যাগ / রিজাইন (Resigned)
              </button>

              <button
                type="button"
                onClick={() => setStatus('suspended')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  status === 'suspended'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                ৩. সাময়িক স্থগিত (Suspended)
              </button>

              <button
                type="button"
                onClick={() => setStatus('terminated')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  status === 'terminated'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ৪. অব্যাহতি / বরখাস্ত (Terminated)
              </button>
            </div>
          </div>

          {/* ACTIVE STATUS VIEW */}
          {status === 'active' && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs leading-relaxed space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>কর্মী সক্রিয় (Active) তালিকায় বহাল থাকবেন</span>
              </div>
              <p>
                কর্মী নিয়মিত কর্মঘণ্টা, দৈনিক হাজিরা ও নিয়মিত বেতন গণনায় স্বয়ংক্রিয়ভাবে অন্তর্ভুক্ত থাকবেন। নিচে "সংরক্ষণ করুন" বাটনে ক্লিক করে নিশ্চিত করুন।
              </p>
            </div>
          )}

          {/* RESIGNED STATUS VIEW */}
          {status === 'resigned' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                <b>সেকশন: পদত্যাগ / রিজাইনকৃত কর্মী।</b> সংরক্ষণের পর এই কর্মী স্বয়ংক্রিয়ভাবে "রিজাইন / পদত্যাগ" সেকশনে স্থানান্তরিত হবেন।
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  কার্যকর পদত্যাগের / রিজাইন তারিখ *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={resignationDate}
                    onChange={(e) => setResignationDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পদত্যাগের কারণ *
                </label>
                <select
                  value={selectedResignReason}
                  onChange={(e) => setSelectedResignReason(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500"
                >
                  {RESIGNATION_REASONS.map((r, idx) => (
                    <option key={idx} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedResignReason.includes('অন্যান্য')
                    ? 'অন্যান্য কারণ বিস্তারিত লিখুন *'
                    : 'বিস্তারিত মন্তব্য বা অতিরিক্ত কারণ (ঐচ্ছিক)'}
                </label>
                <textarea
                  value={customResignReason}
                  onChange={(e) => setCustomResignReason(e.target.value)}
                  placeholder={
                    selectedResignReason.includes('অন্যান্য')
                      ? 'পদত্যাগের সুনির্দিষ্ট কারণ বিস্তারিত লিখুন...'
                      : 'প্রয়োজনে অতিরিক্ত মন্তব্য বা ম্যানেজমেন্টের নোট লিখুন...'
                  }
                  rows={2}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নোটিশ পিরিয়ড পালন
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeServed('yes')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                      noticeServed === 'yes'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    সম্পূর্ণ দিয়েছে
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeServed('partial')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                      noticeServed === 'partial'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    আংশিক দিয়েছে
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeServed('no')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                      noticeServed === 'no'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    দেয়নি (তাৎক্ষণিক)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUSPENDED STATUS VIEW */}
          {status === 'suspended' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <b>সেকশন: সাময়িক স্থগিত (Suspended)।</b> সংরক্ষণের পর এই কর্মী স্বয়ংক্রিয়ভাবে "সাময়িক স্থগিত" সেকশনে স্থানান্তরিত হবেন।
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  স্থগিতাদেশ কার্যকর হওয়ার তারিখ *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={suspensionDate}
                    onChange={(e) => setSuspensionDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সাময়িক স্থগিতের মূল কারণ *
                </label>
                <select
                  value={selectedSuspendReason}
                  onChange={(e) => setSelectedSuspendReason(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500"
                >
                  {SUSPENSION_REASONS.map((r, idx) => (
                    <option key={idx} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  স্থগিতের মেয়াদ বা পরবর্তী পর্যালোচনার সময়
                </label>
                <input
                  type="text"
                  value={suspensionDuration}
                  onChange={(e) => setSuspensionDuration(e.target.value)}
                  placeholder="যেমন: ৭ কার্যদিবস / পরবর্তী নোটিশ না দেওয়া পর্যন্ত"
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedSuspendReason.includes('অন্যান্য')
                    ? 'তদন্ত বা স্থগিতাদেশের সুনির্দিষ্ট বিবরণ *'
                    : 'তদন্ত বা প্রশাসনিক বিবরণ (ঐচ্ছিক)'}
                </label>
                <textarea
                  value={customSuspendReason}
                  onChange={(e) => setCustomSuspendReason(e.target.value)}
                  placeholder="তদন্ত কমিটির বিবরণ, নোটিশ নম্বর বা বিশেষ শর্ত লিখুন..."
                  rows={2}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* TERMINATED STATUS VIEW */}
          {status === 'terminated' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs">
                <b>সেকশন: অব্যাহতি / বরখাস্ত (Terminated)।</b> সংরক্ষণের পর এই কর্মী স্বয়ংক্রিয়ভাবে "অব্যাহতি / বরখাস্ত" সেকশনে স্থানান্তরিত হবেন।
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বরখাস্ত / অব্যাহতি কার্যকর হওয়ার তারিখ *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={terminationDate}
                    onChange={(e) => setTerminationDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-700"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বরখাস্ত / অব্যাহতির সুনির্দিষ্ট কারণ *
                </label>
                <select
                  value={selectedTermReason}
                  onChange={(e) => setSelectedTermReason(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-700"
                >
                  {TERMINATION_REASONS.map((r, idx) => (
                    <option key={idx} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  অফিস আদেশ বা মেমো রেফারেন্স নম্বর
                </label>
                <input
                  type="text"
                  value={terminationMemo}
                  onChange={(e) => setTerminationMemo(e.target.value)}
                  placeholder="যেমন: TW/HR/DISC/2026-089"
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedTermReason.includes('অন্যান্য')
                    ? 'চূড়ান্ত বরখাস্তের কারণ বিস্তারিত লিখুন *'
                    : 'চূড়ান্ত কারণ বা আদেশপত্র বিবরণ (ঐচ্ছিক)'}
                </label>
                <textarea
                  value={customTermReason}
                  onChange={(e) => setCustomTermReason(e.target.value)}
                  placeholder="বরখাস্তের চূড়ান্ত কারণ, কমিটি সিদ্ধান্ত বা আইনগত ধারা..."
                  rows={2}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-700"
                />
              </div>
            </div>
          )}

          {/* CLEARANCE & FINAL SETTLEMENT (FOR NON-ACTIVE STATUSES) */}
          {status !== 'active' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 mt-2">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BadgeCheck className="w-4 h-4 text-blue-600" />
                <span>হ্যান্ডওভার ও ক্লিয়ারেন্স চেকলিস্ট</span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearanceDone}
                  onChange={(e) => setClearanceDone(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  আইডি কার্ড, ইউনিফর্ম ও ফ্যাক্টরি সরঞ্জাম জমা সম্পন্ন হয়েছে
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={finalSettlementPaid}
                  onChange={(e) => setFinalSettlementPaid(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  চুড়ান্ত দেনা-পাওনা (Final Settlement) সম্পূর্ণ পরিশোধিত
                </span>
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  চুড়ান্ত দেনা-পাওনা বা হস্তান্তরের নোট
                </label>
                <input
                  type="text"
                  value={finalSettlementNote}
                  onChange={(e) => setFinalSettlementNote(e.target.value)}
                  placeholder="যেমন: শেষ মাসের বকেয়া বেতন ও ক্ষতিপূরণ সম্পূর্ণ হস্তান্তর হয়েছে"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {status === 'resigned' && onOpenResignationLetter && (
              <button
                type="button"
                onClick={() => {
                  const mergedEmp: Employee = {
                    ...employee,
                    status: 'resigned',
                    resignationDate: resignationDate || employee.resignationDate,
                    resignationReason:
                      selectedResignReason === RESIGNATION_REASONS[RESIGNATION_REASONS.length - 1]
                        ? customResignReason
                        : selectedResignReason,
                    noticeServed,
                    clearanceDone,
                    finalSettlementPaid,
                    finalSettlementNote: finalSettlementNote.trim(),
                  };
                  onClose();
                  onOpenResignationLetter(mergedEmp);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                title="১-ক্লিকে এই কর্মীর পূরণকৃত পদত্যাগপত্র ফরম প্রিন্ট করুন"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>১-ক্লিক পদত্যাগ ফরম প্রিন্ট</span>
              </button>
            )}

            {status === 'suspended' && onOpenSuspensionNotice && (
              <button
                type="button"
                onClick={() => {
                  const mergedEmp: Employee = {
                    ...employee,
                    status: 'suspended',
                    suspensionDate: suspensionDate || employee.suspensionDate,
                    suspensionReason:
                      selectedSuspendReason === SUSPENSION_REASONS[SUSPENSION_REASONS.length - 1]
                        ? customSuspendReason
                        : selectedSuspendReason,
                    suspensionDuration: suspensionDuration.trim(),
                    clearanceDone,
                    finalSettlementPaid,
                    finalSettlementNote: finalSettlementNote.trim(),
                  };
                  onClose();
                  onOpenSuspensionNotice(mergedEmp);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                title="১-ক্লিকে এই কর্মীর সাময়িক স্থগিতাদেশ নোটিশ প্রিন্ট করুন"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>১-ক্লিক স্থগিত নোটিশ প্রিন্ট</span>
              </button>
            )}

            {status === 'terminated' && onOpenTerminationNotice && (
              <button
                type="button"
                onClick={() => {
                  const mergedEmp: Employee = {
                    ...employee,
                    status: 'terminated',
                    terminationDate: terminationDate || employee.terminationDate,
                    terminationReason:
                      selectedTermReason === TERMINATION_REASONS[TERMINATION_REASONS.length - 1]
                        ? customTermReason
                        : selectedTermReason,
                    terminationMemo: terminationMemo.trim(),
                    clearanceDone,
                    finalSettlementPaid,
                    finalSettlementNote: finalSettlementNote.trim(),
                  };
                  onClose();
                  onOpenTerminationNotice(mergedEmp);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-black text-white flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                title="১-ক্লিকে এই কর্মীর বরখাস্ত ও অব্যাহতি পত্র প্রিন্ট করুন"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>১-ক্লিক অব্যাহতি পত্র প্রিন্ট</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSave}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
                status === 'active'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : status === 'resigned'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : status === 'suspended'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-slate-900 hover:bg-black'
              }`}
            >
              {loading ? 'আপডেট হচ্ছে...' : 'স্ট্যাটাস ও সেকশন সংরক্ষণ করুন'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

