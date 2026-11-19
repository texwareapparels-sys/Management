import React, { useState, useEffect } from 'react';
import { JobApplication, Employee } from '../types';
import { approveJobApplication } from '../lib/firebase';
import { formatMoney } from '../lib/utils';
import {
  X,
  CheckCircle,
  FileText,
  UserCheck,
  Building2,
  DollarSign,
  Calendar,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { generateUniqueWorkerId, isWorkerIdUnique, getConflictingWorker } from '../lib/workerIdUtils';

interface JobApplicationApproveModalProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  existingEmployees: Employee[];
  onSuccess: (updatedApp: JobApplication, newEmp: Employee) => void;
  showToast: (msg: string) => void;
  onOpenContract?: (emp: Employee) => void;
  onOpenPrintApp?: (app: JobApplication) => void;
}

export const JobApplicationApproveModal: React.FC<JobApplicationApproveModalProps> = ({
  application,
  isOpen,
  onClose,
  existingEmployees,
  onSuccess,
  showToast,
  onOpenContract,
  onOpenPrintApp,
}) => {
  const [workerId, setWorkerId] = useState('');
  const [salary, setSalary] = useState<number>(12000);
  const [otRate, setOtRate] = useState<number>(115);
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedEmp, setCompletedEmp] = useState<Employee | null>(null);

  // Auto-generate next unique worker ID (e.g. TWA-001) and fill defaults when opened
  useEffect(() => {
    if (application && isOpen) {
      const nextId = generateUniqueWorkerId(existingEmployees);
      setWorkerId(nextId);

      const expSal = application.expectedSalary || 12500;
      setSalary(expSal);
      setOtRate(Math.round((expSal / 208) * 2));
      setDesignation(application.appliedDesignation || 'সুইং অপারেটর');
      setDepartment(application.department || 'সুইং সেকশন');
      setJoinDate(new Date().toISOString().split('T')[0]);
      setCompletedEmp(null);
    }
  }, [application, isOpen, existingEmployees]);

  // Regenerate fresh unique worker ID
  const handleRegenerateWorkerId = () => {
    const nextId = generateUniqueWorkerId(existingEmployees);
    setWorkerId(nextId);
    showToast(`নতুন ইউনিক আইডি "${nextId}" তৈরি করা হয়েছে`);
  };

  // Auto re-calc OT rate when salary changes
  const handleSalaryChange = (val: number) => {
    setSalary(val);
    setOtRate(Math.round((val / 208) * 2));
  };

  if (!isOpen || !application) return null;

  const isIdUnique = isWorkerIdUnique(workerId, existingEmployees);
  const conflictingEmp = !isIdUnique ? getConflictingWorker(workerId, existingEmployees) : undefined;

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWorkerId = workerId.trim().toUpperCase();
    if (!cleanWorkerId) {
      showToast('অনুগ্রহ করে Worker ID প্রদান করুন');
      return;
    }

    if (!isWorkerIdUnique(cleanWorkerId, existingEmployees)) {
      const conflict = getConflictingWorker(cleanWorkerId, existingEmployees);
      const statusLabel = conflict?.status === 'resigned' ? 'পদত্যাগকৃত কর্মী' : conflict?.status === 'terminated' ? 'অব্যাহতি/বরখাস্তকৃত কর্মী' : conflict?.status === 'salary_history' ? 'বেতন রেকর্ডের কর্মী' : 'কর্মী';
      showToast(`⚠️ Worker ID "${cleanWorkerId}" ইতিমধ্যে ${statusLabel} "${conflict?.name || conflict?.workerId || 'অন্য জন'}"-এর জন্য ব্যবহৃত! অন্য ইউনিক আইডি দিন।`);
      return;
    }

    if (!salary || salary <= 0) {
      showToast('অনুগ্রহ করে নির্ধারিত মাসিক মূল বেতন প্রদান করুন');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const newEmpData: Omit<Employee, 'id'> = {
        name: application.name,
        workerId: workerId.trim().toUpperCase(),
        designation: designation.trim(),
        department: department.trim(),
        salary: Number(salary),
        otRate: Number(otRate),
        nid: application.nid,
        mobile: application.mobile,
        address: application.presentAddress || application.permanentAddress,
        joinDate: joinDate,
        birthDate: application.birthDate,
        photoUrl: application.photoUrl || '',
        signatureUrl: application.signatureUrl || '',
        bankName: application.bankName || '',
        accountNumber: application.accountNumber || '',
        accountName: application.name,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const { employeeId } = await approveJobApplication(application.id, newEmpData);

      const createdEmp: Employee = {
        ...newEmpData,
        id: employeeId,
      };

      const updatedApp: JobApplication = {
        ...application,
        status: 'approved',
        approvedWorkerId: newEmpData.workerId,
        approvedSalary: newEmpData.salary,
        approvedAt: now,
      };

      setCompletedEmp(createdEmp);
      showToast(`শ্রমিক "${application.name}" সফলভাবে কারখানার মূল তালিকায় যুক্ত হয়েছে!`);
      onSuccess(updatedApp, createdEmp);
    } catch (err) {
      console.error(err);
      showToast('আবেদন অনুমোদন করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">আবেদন গ্রহণ ও শ্রমিক তালিকায় অন্তর্ভুক্তি</h3>
              <p className="text-xs text-emerald-200">
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

        {/* If Completed Success Screen */}
        {completedEmp ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-300">
              <Sparkles className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900">শ্রমিক সফলভাবে নিয়োগপ্রাপ্ত হয়েছেন!</h4>
              <p className="text-xs text-slate-600 mt-1">
                কর্মী <b>{completedEmp.name}</b> (আইডি: <span className="font-mono font-bold text-emerald-700">{completedEmp.workerId}</span>) স্বয়ংক্রিয়ভাবে কারখানার মূল সক্রিয় শ্রমিক তালিকায় যুক্ত হয়েছেন।
              </p>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-left grid grid-cols-2 gap-2 text-slate-800">
              <div>
                <span className="text-slate-500 block">নির্ধারিত পদ:</span>
                <span className="font-bold">{completedEmp.designation}</span>
              </div>
              <div>
                <span className="text-slate-500 block">মাসিক মূল বেতন:</span>
                <span className="font-bold text-emerald-800">৳ {formatMoney(completedEmp.salary)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">ওভারটাইম রেট:</span>
                <span className="font-bold font-mono">৳ {completedEmp.otRate}/ঘণ্টা</span>
              </div>
              <div>
                <span className="text-slate-500 block">যোগদানের তারিখ:</span>
                <span className="font-bold">{completedEmp.joinDate}</span>
              </div>
            </div>

            {/* Quick Next Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              {onOpenContract && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenContract(completedEmp);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>চুক্তি পত্র ডাউনলোড ও প্রিন্ট করুন</span>
                </button>
              )}

              {onOpenPrintApp && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPrintApp({
                      ...application,
                      status: 'approved',
                      approvedWorkerId: completedEmp.workerId,
                      approvedSalary: completedEmp.salary,
                    });
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>গৃহীত আবেদন ফরম প্রিন্ট</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                সম্পন্ন
              </button>
            </div>
          </div>
        ) : (
          /* Form for Approval */
          <form onSubmit={handleApprove} className="p-5 space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">স্বয়ংক্রিয় শ্রমিক সংযোজন:</p>
                <p className="text-slate-700 mt-0.5 leading-relaxed">
                  আবেদনটি গ্রহণ করার সাথে সাথে প্রার্থীর নাম, ছবি, ডিজিটাল স্বাক্ষর, NID, মোবাইল, বর্তমান ঠিকানা সহ সকল তথ্য কারখানার <b>মূল সক্রিয় শ্রমিক তালিকায় (Active Workers)</b> যুক্ত হয়ে যাবে এবং সাথে সাথেই তার নামে <b>চুক্তিপত্র (Contract Letter)</b> ডাউনলোড করা যাবে।
                </p>
              </div>
            </div>

            {/* Candidate Summary Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs">
              <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-300 flex items-center justify-center">
                {application.photoUrl ? (
                  <img src={application.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <UserCheck className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-black text-slate-900 text-sm">{application.name}</div>
                <div className="text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>পদ: <b>{application.appliedDesignation}</b></span>
                  <span>•</span>
                  <span>বিভাগ: <b>{application.department || 'সুইং সেকশন'}</b></span>
                </div>
              </div>
            </div>

            {/* Input Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-800">
                    বরাদ্দকৃত Worker ID (শ্রমিক আইডি) *
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateWorkerId}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                    title="পরবর্তী ইউনিক আইডি জেনারেট করুন"
                  >
                    <RefreshCw className="w-3 h-3" />
                    অটো আইডি
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value.toUpperCase())}
                  placeholder="যেমন: TWA-001"
                  className={`w-full px-3 py-2 border rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none ${
                    !isIdUnique ? 'border-rose-400 bg-rose-50 text-rose-900' : 'border-slate-300 bg-white'
                  }`}
                />
                {!isIdUnique && conflictingEmp ? (
                  <span className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    এই আইডি ইতিমধ্যে {conflictingEmp.status === 'resigned' ? 'পদত্যাগকৃত কর্মী' : conflictingEmp.status === 'terminated' ? 'অব্যাহতি/বরখাস্তকৃত কর্মী' : 'কর্মী'} "{conflictingEmp.name || conflictingEmp.workerId}"-এর জন্য সংরক্ষিত!
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    স্বয়ংক্রিয় ইউনিক আইডি (যেমন: TWA-001)
                  </span>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  চূড়ান্ত অনুমোদিত মাসিক মূল বেতন (টাকা) *
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={100}
                  value={salary}
                  onChange={(e) => handleSalaryChange(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">প্রার্থীর প্রত্যাশা: ৳ {formatMoney(application.expectedSalary)}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  চূড়ান্ত পদবী *
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  সেকশন / বিভাগ
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="সুইং সেকশন"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  ওভারটাইম রেট (টাকা/ঘণ্টা)
                </label>
                <input
                  type="number"
                  value={otRate}
                  onChange={(e) => setOtRate(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">স্বয়ংক্রিয় ফর্মুলা: (বেতন / ২০৮) × ২</span>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  কারখানায় যোগদানের তারিখ
                </label>
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer transition"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition active:scale-95 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'প্রসেসিং হচ্ছে...' : 'অনুমোদন করুন ও শ্রমিক তালিকায় যুক্ত করুন'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
