import React, { useState, useEffect } from 'react';
import { JobApplication, Employee, FactorySettings } from '../types';
import {
  subscribeJobApplications,
  deleteJobApplication,
  loadFactorySettings,
  DEFAULT_FACTORY_SETTINGS,
} from '../lib/firebase';
import { formatMoney, formatDateBn, toBengaliNumber } from '../lib/utils';
import { JobApplicationPrintModal } from './JobApplicationPrintModal';
import { BlankJobApplicationModal } from './BlankJobApplicationModal';
import { JobApplicationRejectModal } from './JobApplicationRejectModal';
import { JobApplicationApproveModal } from './JobApplicationApproveModal';
import { JobApplicationRejectionLetterModal } from './JobApplicationRejectionLetterModal';
import { JobApplicationEditModal } from './JobApplicationEditModal';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Search,
  Filter,
  Plus,
  Trash2,
  Printer,
  FileCheck,
  Building2,
  Phone,
  User,
  Users,
  AlertCircle,
  Share2,
  ChevronRight,
  Sparkles,
  Eye,
  Pencil
} from 'lucide-react';

interface JobApplicationsAdminTabProps {
  existingEmployees: Employee[];
  onOpenContractLetter: (emp: Employee) => void;
  onOpenNewApplicationForm: () => void;
  showToast: (msg: string) => void;
}

export const JobApplicationsAdminTab: React.FC<JobApplicationsAdminTabProps> = ({
  existingEmployees,
  onOpenContractLetter,
  onOpenNewApplicationForm,
  showToast,
}) => {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);

  // Modals state
  const [selectedPrintApp, setSelectedPrintApp] = useState<JobApplication | null>(null);
  const [selectedEditApp, setSelectedEditApp] = useState<JobApplication | null>(null);
  const [selectedRejectApp, setSelectedRejectApp] = useState<JobApplication | null>(null);
  const [selectedApproveApp, setSelectedApproveApp] = useState<JobApplication | null>(null);
  const [selectedRejectionLetterApp, setSelectedRejectionLetterApp] = useState<JobApplication | null>(null);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState<JobApplication | null>(null);
  const [isBlankModalOpen, setIsBlankModalOpen] = useState(false);

  // Subscribe to real-time job applications
  useEffect(() => {
    loadFactorySettings().then((cfg) => setFactory(cfg));
    const unsubscribe = subscribeJobApplications((data) => {
      setApplications(data);
    });
    return () => unsubscribe();
  }, []);

  // Permanent Shareable Link
  const getShareableLink = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      return `${origin}${pathname}?mode=apply`;
    }
    return '';
  };

  const handleCopyLink = () => {
    const link = getShareableLink();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      showToast('আবেদন ফরমের স্থায়ী লিংক কপি হয়েছে!');
    } else {
      showToast('লিংক: ' + link);
    }
  };

  const handleOpenLinkInNewTab = () => {
    const link = getShareableLink();
    window.open(link, '_blank');
  };

  // Counts
  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;
  const rejectedCount = applications.filter((a) => a.status === 'rejected').length;

  // Filtered List
  const filteredApps = applications.filter((app) => {
    if (filterStatus !== 'all' && app.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = app.name?.toLowerCase().includes(q);
      const matchNo = app.applicationNo?.toLowerCase().includes(q);
      const matchMobile = app.mobile?.toLowerCase().includes(q);
      const matchNid = app.nid?.toLowerCase().includes(q);
      const matchDesig = app.appliedDesignation?.toLowerCase().includes(q);
      return matchName || matchNo || matchMobile || matchNid || matchDesig;
    }
    return true;
  });

  // Trigger Contract Modal from Approved Application
  const handleOpenContractForApproved = (workerIdOrName: string) => {
    // Find employee by workerId
    const found = existingEmployees.find(
      (e) => e.workerId?.toLowerCase() === workerIdOrName?.toLowerCase()
    );
    if (found) {
      onOpenContractLetter(found);
    } else {
      showToast('কর্মচারীর রেকর্ড লোড হচ্ছে, কর্মী তালিকা চেক করুন');
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Permanent Application Link Card */}
      <div className="bg-slate-950 text-white rounded-xl p-4 sm:p-5 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">আবেদন ফরমের স্থায়ী পাবলিক লিংক</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                এই নির্দিষ্ট লিংকটি শেয়ার করলে প্রার্থী অনলাইনে সরাসরি আবেদন করতে পারবে এবং স্বয়ংক্রিয়ভাবে এখানে জমা হবে।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>লিংক কপি করুন</span>
            </button>

            <button
              type="button"
              onClick={handleOpenLinkInNewTab}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="নতুন ট্যাবে ওপেন করে দেখুন"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>লিংক খুলুন</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBlankModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="হাতে পূরণের জন্য ফাঁকা আবেদন ফরম প্রিন্ট বা PDF ডাউনলোড করুন"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>হাতে পূরণের ফাঁকা ফরম</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewApplicationForm}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="অ্যাপ থেকেই প্রার্থীর আবেদন ফরম পূরণ করুন"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>নতুন আবেদন পূরণ করুন</span>
            </button>
          </div>
        </div>

        {/* Link Text Box */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold shrink-0">স্থায়ী লিংক:</span>
          <div className="flex-1 font-mono text-[11px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-teal-300 select-all truncate">
            {getShareableLink()}
          </div>
        </div>
      </div>

      {/* 2. Top Metric Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => setFilterStatus('pending')}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterStatus === 'pending'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${filterStatus === 'pending' ? 'text-slate-300' : 'text-slate-500'}`}>
              পেন্ডিং (অপেক্ষমাণ)
            </span>
            <Clock className={`w-4 h-4 ${filterStatus === 'pending' ? 'text-amber-300' : 'text-amber-600'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono mt-1 flex items-baseline gap-2 tabular-nums">
            <span>{toBengaliNumber(pendingCount)}</span>
            {pendingCount > 0 && (
              <span className={`text-[10.5px] font-sans font-semibold ${
                filterStatus === 'pending' ? 'text-amber-300' : 'text-amber-700'
              }`}>
                নতুন আবেদন
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('approved')}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterStatus === 'approved'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${filterStatus === 'approved' ? 'text-slate-300' : 'text-slate-500'}`}>
              অনুমোদিত (গ্রহণকৃত)
            </span>
            <CheckCircle className={`w-4 h-4 ${filterStatus === 'approved' ? 'text-emerald-300' : 'text-emerald-600'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono mt-1 tabular-nums">
            {toBengaliNumber(approvedCount)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('rejected')}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterStatus === 'rejected'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${filterStatus === 'rejected' ? 'text-slate-300' : 'text-slate-500'}`}>
              বাতিলকৃত (Rejected)
            </span>
            <XCircle className={`w-4 h-4 ${filterStatus === 'rejected' ? 'text-rose-300' : 'text-rose-600'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono mt-1 tabular-nums">
            {toBengaliNumber(rejectedCount)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${filterStatus === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              সর্বমোট আবেদন
            </span>
            <Users className={`w-4 h-4 ${filterStatus === 'all' ? 'text-teal-300' : 'text-slate-500'}`} />
          </div>
          <div className="text-2xl font-extrabold font-mono mt-1 tabular-nums">
            {toBengaliNumber(applications.length)}
          </div>
        </button>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="প্রার্থীর নাম, মোবাইল, NID বা ট্র্যাকিং নং..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-600 outline-none"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-stretch sm:self-auto overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer shrink-0 tabular-nums ${
              filterStatus === 'pending'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            পেন্ডিং ({toBengaliNumber(pendingCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('approved')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer shrink-0 tabular-nums ${
              filterStatus === 'approved'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            অনুমোদিত ({toBengaliNumber(approvedCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer shrink-0 tabular-nums ${
              filterStatus === 'rejected'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বাতিলকৃত ({toBengaliNumber(rejectedCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer shrink-0 tabular-nums ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সকল ({applications.length})
          </button>
        </div>
      </div>

      {/* 4. Applications List / Cards */}
      {filteredApps.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm">কোনো আবেদন পাওয়া যায়নি</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filterStatus === 'pending'
              ? 'বর্তমানে কোনো অপেক্ষমাণ (Pending) আবেদন নেই। নতুন আবেদন আসলে তা রিয়েল-টাইম এখানে প্রদর্শিত হবে।'
              : 'আপনার নির্বাচিত ফিল্টারে কোনো আবেদন রেকর্ড নেই।'}
          </p>
          <button
            type="button"
            onClick={onOpenNewApplicationForm}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>নতুন আবেদন ফরম পূরণ করুন</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApps.map((app) => {
            const dateStr = app.createdAt
              ? formatDateBn(new Date(app.createdAt).toISOString().split('T')[0])
              : '—';

            return (
              <div
                key={app.id}
                className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:border-blue-300 transition space-y-3"
              >
                {/* Top Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      {app.applicationNo}
                    </span>
                    <span className="text-xs text-slate-500">
                      তারিখ: <b>{dateStr}</b>
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {app.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>অনুমোদিত / নিয়মিত কর্মী</span>
                        {app.approvedWorkerId && (
                          <span className="font-mono text-emerald-950 font-black ml-1">
                            ({app.approvedWorkerId})
                          </span>
                        )}
                      </span>
                    ) : app.status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-xs border border-rose-300">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>বাতিলকৃত (Rejected)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-black text-xs border border-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>পেন্ডিং / অপেক্ষমাণ</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Candidate Main Content */}
                <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
                  {/* Photo & Vital Details */}
                  <div className="flex items-start gap-3.5 flex-1">
                    {/* Applicant Photo */}
                    <div className="w-16 h-20 rounded-xl bg-slate-100 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                      {app.photoUrl ? (
                        <img src={app.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-7 h-7 text-slate-400" />
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-base text-slate-900">{app.name}</h4>
                        {app.age && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            ({app.age} বছর)
                          </span>
                        )}
                      </div>

                      <div className="text-slate-700 flex items-center gap-3 flex-wrap">
                        <span>পদ: <b className="text-blue-900 font-bold">{app.appliedDesignation}</b></span>
                        <span>•</span>
                        <span>বিভাগ: <b>{app.department || 'সুইং'}</b></span>
                        {app.education && (
                          <>
                            <span>•</span>
                            <span>যোগ্যতা: <b>{app.education}</b></span>
                          </>
                        )}
                      </div>

                      <div className="text-slate-600 flex items-center gap-3 flex-wrap pt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <b className="font-mono">{app.mobile}</b>
                        </span>
                        <span>•</span>
                        <span>NID: <b className="font-mono">{app.nid}</b></span>
                      </div>

                      <div className="text-slate-500 text-[11px] line-clamp-1 pt-0.5">
                        বর্তমান ঠিকানা: {app.presentAddress}
                      </div>

                      {/* Guardian Preview */}
                      <div className="text-slate-600 text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-200 mt-1 flex items-center gap-2">
                        <span className="font-bold text-slate-700">অভিভাবক:</span>
                        <span>{app.guardianName} ({app.guardianRelation}) — {app.guardianMobile}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rejection / Approval Specific Notes */}
                  {app.status === 'rejected' && (
                    <div className="w-full sm:w-64 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-rose-900 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>বাতিলের কারণ:</span>
                      </div>
                      <p className="text-rose-950 font-semibold text-[11px] leading-tight">
                        {app.rejectionReason}
                      </p>
                      {app.rejectionNote && (
                        <p className="text-slate-600 text-[10px]">
                          মন্তব্য: {app.rejectionNote}
                        </p>
                      )}
                    </div>
                  )}

                  {app.status === 'approved' && (
                    <div className="w-full sm:w-64 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-emerald-900 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>নিয়োগ চূড়ান্ত হয়েছে</span>
                      </div>
                      <div className="text-emerald-950 font-bold text-[11px] flex items-center justify-between">
                        <span>Worker ID:</span>
                        <span className="font-mono font-black">{app.approvedWorkerId}</span>
                      </div>
                      <div className="text-emerald-950 font-bold text-[11px] flex items-center justify-between">
                        <span>চূড়ান্ত বেতন:</span>
                        <span>৳ {formatMoney(app.approvedSalary)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* View & Print Application Preview */}
                    <button
                      type="button"
                      onClick={() => setSelectedPrintApp(app)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      title="আবেদনের পূর্ণাঙ্গ বিবরণ প্রিভিউ ও A4 সাইজে প্রিন্ট করুন"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>প্রিভিউ ও A4 প্রিন্ট</span>
                    </button>

                    {/* Edit Application */}
                    <button
                      type="button"
                      onClick={() => setSelectedEditApp(app)}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      title="আবেদন ফরমের তথ্য এডিট ও সংশোধন করুন"
                    >
                      <Pencil className="w-3.5 h-3.5 text-amber-600" />
                      <span>এডিট করুন</span>
                    </button>

                    {/* If Rejected: Print Rejection Letter */}
                    {app.status === 'rejected' && (
                      <button
                        type="button"
                        onClick={() => setSelectedRejectionLetterApp(app)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>বাতিল পত্র প্রিন্ট</span>
                      </button>
                    )}

                    {/* If Approved: Contract Letter Download */}
                    {app.status === 'approved' && app.approvedWorkerId && (
                      <button
                        type="button"
                        onClick={() => handleOpenContractForApproved(app.approvedWorkerId!)}
                        className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>চুক্তি পত্র ডাউনলোড</span>
                      </button>
                    )}
                  </div>

                  {/* Primary Decision Buttons for Pending */}
                  <div className="flex items-center gap-2">
                    {app.status === 'pending' && (
                      <>
                        {/* Reject Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedRejectApp(app)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>বাতিল করুন</span>
                        </button>

                        {/* Approve Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedApproveApp(app)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer ring-2 ring-emerald-500/30"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>গ্রহণ করুন (শ্রমিক লিস্টে যোগ)</span>
                        </button>
                      </>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteApp(app)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                      title="আবেদনটি স্থায়ীভাবে মুছে ফেলুন"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>মুছে ফেলুন</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}
      {/* 1. Job Application Print Modal */}
      {selectedPrintApp && (
        <JobApplicationPrintModal
          application={selectedPrintApp}
          isOpen={Boolean(selectedPrintApp)}
          onClose={() => setSelectedPrintApp(null)}
          factory={factory}
          showToast={showToast}
          onApproveClick={(app) => {
            setSelectedPrintApp(null);
            setSelectedApproveApp(app);
          }}
          onRejectClick={(app) => {
            setSelectedPrintApp(null);
            setSelectedRejectApp(app);
          }}
          onOpenContract={(workerId) => handleOpenContractForApproved(workerId)}
          onEditClick={(app) => {
            setSelectedPrintApp(null);
            setSelectedEditApp(app);
          }}
          onDeleteClick={(app) => setConfirmDeleteApp(app)}
          onOpenBlankForm={() => setIsBlankModalOpen(true)}
        />
      )}

      {/* 1.5 Edit Application Modal */}
      {selectedEditApp && (
        <JobApplicationEditModal
          application={selectedEditApp}
          isOpen={Boolean(selectedEditApp)}
          onClose={() => setSelectedEditApp(null)}
          showToast={showToast}
        />
      )}

      {/* 2. Rejection Modal (interactive) */}
      {selectedRejectApp && (
        <JobApplicationRejectModal
          application={selectedRejectApp}
          isOpen={Boolean(selectedRejectApp)}
          onClose={() => setSelectedRejectApp(null)}
          showToast={showToast}
          onSuccess={(updated) => {
            // Updated in list
          }}
          onOpenRejectionLetter={(app) => {
            setSelectedRejectionLetterApp(app);
          }}
        />
      )}

      {/* 3. Rejection Letter A4 Modal (printable) */}
      {selectedRejectionLetterApp && (
        <JobApplicationRejectionLetterModal
          application={selectedRejectionLetterApp}
          isOpen={Boolean(selectedRejectionLetterApp)}
          onClose={() => setSelectedRejectionLetterApp(null)}
          factory={factory}
          showToast={showToast}
        />
      )}

      {/* 4. Approve Modal (interactive + auto-adds to employees) */}
      {selectedApproveApp && (
        <JobApplicationApproveModal
          application={selectedApproveApp}
          isOpen={Boolean(selectedApproveApp)}
          onClose={() => setSelectedApproveApp(null)}
          existingEmployees={existingEmployees}
          showToast={showToast}
          onSuccess={(updatedApp, newEmp) => {
            // Already handled in approveJobApplication
          }}
          onOpenContract={(emp) => onOpenContractLetter(emp)}
          onOpenPrintApp={(app) => setSelectedPrintApp(app)}
        />
      )}

      {/* 5. Delete Confirmation Modal (Safe In-App Modal) */}
      {confirmDeleteApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                আবেদনটি মুছে ফেলতে চান?
              </h3>
              <p className="text-xs text-slate-600">
                প্রার্থী: <b className="text-slate-900">{confirmDeleteApp.name}</b>
                <br />
                আবেদন নং: <span className="font-mono font-bold text-blue-700">{confirmDeleteApp.applicationNo}</span>
              </p>
              <p className="text-[11px] text-rose-600 font-semibold pt-1">
                এই আবেদনটি ডাটাবেস থেকে স্থায়ীভাবে মুছে ফেলা হবে।
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteApp(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                না, রাখুন
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteJobApplication(confirmDeleteApp.id);
                    showToast(`আবেদন "${confirmDeleteApp.applicationNo}" মুছে ফেলা হয়েছে`);
                    setConfirmDeleteApp(null);
                  } catch {
                    showToast('আবেদন মুছে ফেলা যায়নি');
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-md active:scale-95"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Blank Application Form Modal */}
      {isBlankModalOpen && (
        <BlankJobApplicationModal
          isOpen={isBlankModalOpen}
          onClose={() => setIsBlankModalOpen(false)}
          factory={factory}
          showToast={showToast}
        />
      )}
    </div>
  );
};
