import React, { useState } from 'react';
import { Employee } from '../types';
import {
  X,
  Key,
  Copy,
  Check,
  Search,
  ExternalLink,
  MessageCircle,
  Phone,
  Lock,
  User,
  Share2,
  FileSpreadsheet,
  Link as LinkIcon
} from 'lucide-react';

import { isDemoEmployee } from '../lib/firebase';
import { getWorkerLoginUrl, getWorkerCredentialsMessage, getWorkerDefaultPassword } from '../lib/userAuthLinks';

interface AllWorkersLoginModalProps {
  employees: Employee[];
  isOpen: boolean;
  onClose: () => void;
  onSelectWorker: (emp: Employee) => void;
  showToast: (msg: string) => void;
}

export const AllWorkersLoginModal: React.FC<AllWorkersLoginModalProps> = ({
  employees,
  isOpen,
  onClose,
  onSelectWorker,
  showToast,
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getWorkerLink = (emp: Employee) => {
    return getWorkerLoginUrl(emp);
  };

  const getWorkerPass = (emp: Employee) => {
    return getWorkerDefaultPassword(emp);
  };

  const activeEmployees = employees.filter((e) => e.status === 'active' && !isDemoEmployee(e));

  const filtered = activeEmployees.filter((emp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.workerId.toLowerCase().includes(q) ||
      (emp.mobile && emp.mobile.includes(q)) ||
      emp.designation.toLowerCase().includes(q)
    );
  });

  const handleCopyLink = (emp: Employee) => {
    try {
      const link = getWorkerLink(emp);
      navigator.clipboard.writeText(link);
      setCopiedId(emp.id);
      showToast(`✓ ${emp.name} (${emp.workerId}) এর আলাদা ব্যক্তিগত লগইন লিংক কপি হয়েছে!`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast('লিংক কপি করা সম্ভব হয়নি');
    }
  };

  const handleCopyWorkerMessage = (emp: Employee) => {
    try {
      const text = getWorkerCredentialsMessage(emp);
      navigator.clipboard.writeText(text);
      setCopiedId(`msg_${emp.id}`);
      showToast(`✓ ${emp.name} এর সম্পূর্ণ ব্যক্তিগত লগইন মেসেজ কপি হয়েছে!`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast('তথ্য কপি করা সম্ভব হয়নি');
    }
  };

  const handleCopyAllReport = () => {
    try {
      let report = `টেক্স ওয়ার অ্যাপারেলস — প্রতিটি শ্রমিকের আলাদা আলাদা ব্যক্তিগত লগইন লিংক ও পাসওয়ার্ড তালিকা:\n\n`;
      report += `(প্রতিটি কর্মীর জন্য স্বতন্ত্র আলাদা লিংক তৈরি করা হয়েছে। কর্মীকে তার নামের পাশের নির্দিষ্ট লিংকটি দিন)\n\n`;
      report += `========================================\n\n`;
      activeEmployees.forEach((emp, i) => {
        const pass = getWorkerPass(emp);
        const link = getWorkerLink(emp);
        report += `${i + 1}. ${emp.name} (Worker ID: ${emp.workerId})\n`;
        report += `   পদবী: ${emp.designation} • 📱 মোবাইল (লগইন নম্বর): ${emp.mobile || 'নেই'}\n`;
        report += `   🔑 পাসওয়ার্ড: ${pass}\n`;
        report += `   🔗 আলাদা ব্যক্তিগত লগইন লিংক: ${link}\n\n`;
      });

      navigator.clipboard.writeText(report);
      showToast('✓ প্রতিটি কর্মীর আলাদা লগইন লিংক ও পাসওয়ার্ড তালিকা কপি করা হয়েছে!');
    } catch {
      showToast('রিপোর্ট কপি করা সম্ভব হয়নি');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                সকল শ্রমিকের প্রোফাইল লগইন লিংক ও পাসওয়ার্ড তালিকা
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                মোট সক্রিয় শ্রমিক: {activeEmployees.length} জন • অ্যাডমিন কন্ট্রোল প্যানেল
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Individual Worker Login Link Notice Banner */}
        <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 border-b border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
              🔗
            </span>
            <div>
              <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5 flex-wrap">
                <span>প্রতিটি শ্রমিকের জন্য আলাদা আলাদা লগইন লিংক সক্রিয়:</span>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  ✓ স্বতন্ত্র ব্যক্তিগত লিংক
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                প্রত্যেক শ্রমিক তার নামের পাশে থাকা নিজস্ব আলাদা লিংকে প্রবেশ করে সহজে হাজিরা ও বেতন বিবরণী দেখতে পারবেন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyAllReport}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="সকল কর্মীর আলাদা লিংক ও পাসওয়ার্ড তালিকা একসঙ্গে কপি করুন"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>সকল আলাদা লিংক রিপোর্ট কপি</span>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম / Worker ID / মোবাইল দিয়ে খুঁজুন..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <div className="text-xs text-slate-500">
            মোট প্রদর্শিত: <b className="text-indigo-950">{filtered.length}</b> জন কর্মী
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Key className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <span>কোনো শ্রমিক পাওয়া যায়নি</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">শ্রমিকের নাম ও পদ</th>
                    <th className="py-2 px-3">Worker ID</th>
                    <th className="py-2 px-3">মোবাইল নম্বর</th>
                    <th className="py-2 px-3">পাসওয়ার্ড</th>
                    <th className="py-2 px-3">ব্যক্তিগত আলাদা লগইন লিংক</th>
                    <th className="py-2 px-3 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((emp) => {
                    const pass = getWorkerPass(emp);
                    const link = getWorkerLink(emp);
                    return (
                      <tr key={emp.id} className="hover:bg-indigo-50/30 transition">
                        <td className="py-2.5 px-3">
                          <div className="font-black text-slate-900">{emp.name}</div>
                          <div className="text-[10.5px] text-slate-500">{emp.designation} • {emp.department || 'সুইং'}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px]">
                            {emp.workerId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {emp.mobile || <span className="text-rose-500 font-normal">নেই</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-black text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                            {pass}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 max-w-[220px]">
                            <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-1 rounded truncate flex-1 border border-slate-200 select-all" title={link}>
                              {link}
                            </span>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 transition"
                              title="লিংকটি নতুন ট্যাবে খুলুন"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(emp)}
                              className={`px-2 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                                copiedId === emp.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                              }`}
                              title="ব্যক্তিগত লিংক কপি করুন"
                            >
                              {copiedId === emp.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === emp.id ? 'কপি হয়েছে' : 'লিংক কপি'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyWorkerMessage(emp)}
                              className={`px-2 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                                copiedId === `msg_${emp.id}`
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                              }`}
                              title="হোয়াটসঅ্যাপ বা মেসেজ পাঠানোর জন্য পূর্ণ বিবরণ কপি করুন"
                            >
                              {copiedId === `msg_${emp.id}` ? <Check className="w-3 h-3" /> : <MessageCircle className="w-3 h-3 text-emerald-600" />}
                              <span>মেসেজ</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onSelectWorker(emp);
                              }}
                              className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 transition active:scale-95 cursor-pointer"
                              title="পাসওয়ার্ড পরিবর্তন, লিংক পরিবর্তন ও অ্যাক্সেস কন্ট্রোল"
                            >
                              <Key className="w-3 h-3" />
                              <span>কন্ট্রোল</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 text-[11px]">
            * শ্রমিক এই পাসওয়ার্ড দিয়ে লগইন করে শুধুমাত্র তথ্য দেখতে পারবেন, কোনো পরিবর্তন করতে পারবেন না।
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
