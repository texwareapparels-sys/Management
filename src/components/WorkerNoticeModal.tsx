import React, { useState, useEffect } from 'react';
import { Employee, WorkerNotice, NoticeTargetType, NoticePriority, NoticeCategory } from '../types';
import {
  subscribeWorkerNotices,
  saveOrUpdateWorkerNotice,
  deleteWorkerNoticeById,
} from '../lib/firebase';
import { formatDateBn } from '../lib/utils';
import {
  X,
  Bell,
  Send,
  Trash2,
  Users,
  User,
  AlertTriangle,
  Sparkles,
  Calendar,
  DollarSign,
  Info,
  CheckCircle2,
  Plus,
  CheckCheck,
  Eye,
  Clock
} from 'lucide-react';

interface WorkerNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  initialSelectedEmployee?: Employee | null;
  showToast: (msg: string) => void;
}

export const WorkerNoticeModal: React.FC<WorkerNoticeModalProps> = ({
  isOpen,
  onClose,
  employees,
  initialSelectedEmployee,
  showToast,
}) => {
  const [notices, setNotices] = useState<WorkerNotice[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('create');
  const [selectedNoticeForReceipt, setSelectedNoticeForReceipt] = useState<WorkerNotice | null>(null);
  const [receiptTab, setReceiptTab] = useState<'confirmed' | 'pending'>('confirmed');
  
  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<NoticeTargetType>(
    initialSelectedEmployee ? 'individual' : 'all'
  );
  const [targetEmployeeId, setTargetEmployeeId] = useState(
    initialSelectedEmployee ? initialSelectedEmployee.id : (employees[0]?.id || '')
  );
  const [category, setCategory] = useState<NoticeCategory>('general');
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeWorkerNotices((data) => {
      setNotices(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (initialSelectedEmployee) {
      setTargetType('individual');
      setTargetEmployeeId(initialSelectedEmployee.id);
      setActiveTab('create');
    }
  }, [initialSelectedEmployee]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('নোটিশের শিরোনাম লিখুন');
      return;
    }
    if (!message.trim()) {
      showToast('নোটিশের বিস্তারিত বার্তা লিখুন');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetEmp: Employee | undefined;
      if (targetType === 'individual') {
        targetEmp = employees.find((emp) => emp.id === targetEmployeeId);
      }

      await saveOrUpdateWorkerNotice({
        title: title.trim(),
        message: message.trim(),
        targetType,
        targetEmployeeId: targetType === 'individual' ? targetEmployeeId : undefined,
        targetWorkerId: targetEmp ? targetEmp.workerId : undefined,
        targetEmployeeName: targetEmp ? targetEmp.name : undefined,
        category,
        priority,
        createdBy: 'কারখানা প্রশাসন ও এইচআর',
        createdAt: Date.now(),
        publishedDate: new Date().toISOString().split('T')[0],
        readBy: [],
      });

      showToast(
        targetType === 'all'
          ? '✓ সকল শ্রমিকের জন্য নোটিশ সফলভাবে জারি করা হয়েছে!'
          : `✓ ${targetEmp?.name || 'শ্রমিক'}-এর প্রোফাইলে নোটিশ পাঠানো হয়েছে!`
      );

      // Reset form
      setTitle('');
      setMessage('');
      setActiveTab('list');
    } catch (err: any) {
      showToast('নোটিশ প্রকাশে ব্যর্থ হয়েছে: ' + (err.message || 'ত্রুটি'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noticeId: string, noticeTitle: string) => {
    if (confirm(`আপনি কি নিশ্চিত যে "${noticeTitle}" নোটিশটি মুছে ফেলতে চান?`)) {
      try {
        await deleteWorkerNoticeById(noticeId);
        showToast('নোটিশ মুছে ফেলা হয়েছে');
      } catch {
        showToast('নোটিশ মুছতে সমস্যা হয়েছে');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <span>শ্রমিক নোটিশ বোর্ড ব্যবস্থাপনা</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-200 border border-blue-400/30">
                  Worker Notifications
                </span>
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                এক সাথে সকল শ্রমিকের জন্য অথবা আলাদা আলাদা সুনির্দিষ্ট কর্মীর জন্য নোটিশ জারি করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>নতুন নোটিশ লিখুন</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>প্রকাশিত নোটিশ তালিকা ({notices.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Target Type: All vs Individual */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  নোটিশের প্রাপক (Target) *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                      targetType === 'all'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-xs">এক সাথে সকল শ্রমিক</div>
                      <div className="text-[10px] text-slate-500">কারখানার সব শ্রমিকের নোটিশ বোর্ডে যাবে</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('individual')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                      targetType === 'individual'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-xs">আলাদা সুনির্দিষ্ট কর্মী</div>
                      <div className="text-[10px] text-slate-500">শুধুমাত্র নির্দিষ্ট শ্রমিকের একাউন্টে যাবে</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* If Individual: Select Employee */}
              {targetType === 'individual' && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-1">
                  <label className="block text-xs font-bold text-indigo-950">
                    নির্দিষ্ট কর্মী নির্বাচন করুন *
                  </label>
                  <select
                    value={targetEmployeeId}
                    onChange={(e) => setTargetEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} — {emp.workerId} ({emp.designation})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  নোটিশের শিরোনাম (Title) *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: সাপ্তাহিক ছুটির নোটিশ / বেতন প্রদান আপডেট"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    নোটিশের ধরন (Category)
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as NoticeCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="general">সাধারণ নোটিশ</option>
                    <option value="holiday">ছুটি ও কারখানা বন্ধ</option>
                    <option value="salary">বেতন ও বোনাস সংক্রান্ত</option>
                    <option value="warning">সতর্কবার্তা ও নিয়মাবলী</option>
                    <option value="appreciation">ধন্যবাদ ও প্রশংসা</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    গুরুত্ব (Priority)
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as NoticePriority)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="normal">সাধারণ (Normal)</option>
                    <option value="important">গুরুত্বপূর্ণ (Important)</option>
                    <option value="urgent">জরুরি (Urgent)</option>
                  </select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  নোটিশের বিস্তারিত বার্তা (Notice Details) *
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="শ্রমিকের উদ্দেশ্যে সম্পূর্ণ তথ্য বা নোটিশের বক্তব্য লিখুন..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'নোটিশ জারি হচ্ছে...' : 'নোটিশ প্রকাশ করুন'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Notice List Tab */
            <div className="space-y-3">
              {notices.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Bell className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs font-bold text-slate-600">কোনো নোটিশ প্রকাশিত হয়নি</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    + নতুন নোটিশ তৈরি করুন
                  </button>
                </div>
              ) : (
                notices.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-2xl border transition shadow-2xs space-y-2 ${
                      n.priority === 'urgent'
                        ? 'border-rose-300 bg-rose-50/30'
                        : n.priority === 'important'
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-xs text-slate-900">{n.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            n.targetType === 'all'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          }`}>
                            {n.targetType === 'all' ? 'সকল কর্মী' : `কর্মী: ${n.targetEmployeeName || n.targetWorkerId}`}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            n.priority === 'urgent'
                              ? 'bg-rose-100 text-rose-800'
                              : n.priority === 'important'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {n.priority === 'urgent' ? 'জরুরি' : n.priority === 'important' ? 'গুরুত্বপূর্ণ' : 'সাধারণ'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          প্রকাশিত: {formatDateBn(n.publishedDate)} • {n.createdBy || 'প্রশাসন'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(n.id, n.title)}
                        className="p-1 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer shrink-0"
                        title="নোটিশ মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/60 p-2.5 rounded-xl border border-slate-100 whitespace-pre-wrap">
                      {n.message}
                    </p>

                    {/* নোটিশ নিশ্চিতকরণ স্থিতি (Admin confirmation tracking) */}
                    {n.targetType === 'individual' ? (
                      (() => {
                        const targetEmp = employees.find(
                          (e) => e.id === n.targetEmployeeId || (n.targetWorkerId && e.workerId === n.targetWorkerId)
                        );
                        const conf = n.confirmations?.find(
                          (c) =>
                            c.employeeId === n.targetEmployeeId ||
                            (targetEmp && c.employeeId === targetEmp.id) ||
                            (n.targetWorkerId && c.workerId === n.targetWorkerId)
                        );

                        return conf ? (
                          <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex-wrap gap-1.5">
                            <div className="flex items-center gap-1.5 font-bold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>✓ শ্রমিক নোটিশটি পড়েছেন ও নিশ্চিত করেছেন</span>
                            </div>
                            <div className="text-[11px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                              {new Date(conf.confirmedAt).toLocaleDateString('bn-BD')} {new Date(conf.confirmedAt).toLocaleTimeString('bn-BD')}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>⏳ শ্রমিক এখনও নোটিশ দেখেননি বা নিশ্চিত করেননি (অপেক্ষমান)</span>
                          </div>
                        );
                      })()
                    ) : (
                      (() => {
                        const confirmedCount = n.confirmations?.length || 0;
                        const activeEmps = employees.filter((e) => e.status === 'active');
                        const totalCount = activeEmps.length;
                        const percent = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

                        return (
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                                <span>শ্রমিকদের নিশ্চিতকরণ স্থিতি:</span>
                              </span>
                              <span className="font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full text-[11px]">
                                {confirmedCount} জন নিশ্চিত করেছেন / মোট {totalCount} জন ({percent}%)
                              </span>
                            </div>

                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, percent)}%` }}
                              />
                            </div>

                            <div className="flex justify-end pt-0.5">
                              <button
                                type="button"
                                onClick={() => setSelectedNoticeForReceipt(n)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-bold underline flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>কারা দেখেছেন ও নিশ্চিত করেছেন রিপোর্ট দেখুন ({confirmedCount} জন) →</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmed Workers Detail Modal (Admin Audit Report) */}
      {selectedNoticeForReceipt && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="font-black text-sm text-white flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  <span>নোটিশ নিশ্চিতকরণ রিপোর্ট</span>
                </h4>
                <p className="text-xs text-slate-300 truncate max-w-sm mt-0.5">
                  {selectedNoticeForReceipt.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNoticeForReceipt(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
              <button
                type="button"
                onClick={() => setReceiptTab('confirmed')}
                className={`py-2 px-3 text-xs font-bold border-b-2 cursor-pointer ${
                  receiptTab === 'confirmed'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                নিশ্চিত করেছেন ({selectedNoticeForReceipt.confirmations?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setReceiptTab('pending')}
                className={`py-2 px-3 text-xs font-bold border-b-2 cursor-pointer ${
                  receiptTab === 'pending'
                    ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                এখনও দেখেননি ({Math.max(0, employees.filter((e) => e.status === 'active').length - (selectedNoticeForReceipt.confirmations?.length || 0))})
              </button>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto flex-1">
              {receiptTab === 'confirmed' ? (
                (selectedNoticeForReceipt.confirmations?.length || 0) === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">এখনও কোনো শ্রমিক এই নোটিশ নিশ্চিত করেননি।</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {selectedNoticeForReceipt.confirmations?.map((c, i) => (
                      <div key={i} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{c.workerName || 'শ্রমিক'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">ID: {c.workerId || c.employeeId}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>নিশ্চিত করেছেন</span>
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {new Date(c.confirmedAt).toLocaleDateString('bn-BD')} {new Date(c.confirmedAt).toLocaleTimeString('bn-BD')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {employees
                    .filter((e) => e.status === 'active' && !selectedNoticeForReceipt.confirmations?.some((c) => c.employeeId === e.id))
                    .map((emp) => (
                      <div key={emp.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">{emp.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">ID: {emp.workerId} • {emp.department}</div>
                        </div>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                          অপেক্ষমান
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setSelectedNoticeForReceipt(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
