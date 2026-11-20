import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee, TelegramSettings, SMSSettings, FactorySettings, EmploymentStatus, SalaryDisbursementRecord, PaymentMethod, AttendanceRecord, SalaryProgressStatus, AdminSecuritySettings } from '../types';
import {
  saveOrUpdateEmployee,
  deleteEmployeeById,
  setLocalEmployees,
  loadTelegramSettings,
  saveTelegramSettings,
  loadSMSSettings,
  saveSMSSettings,
  loadFactorySettings,
  saveFactorySettings,
  DEFAULT_FACTORY_SETTINGS,
  DEFAULT_CONTRACT_RULES,
  DEFAULT_CONTRACT_DECLARATION,
  subscribeSalaryRecords,
  deleteSalaryRecordById,
  deleteSalaryRecordForWorkerMonth,
  deleteSalaryRecordsBatch,
  deleteSalaryRecordsByMonthYear,
  deleteAllSalaryRecords,
  purgeAllPastSalaryHistory,
  saveOrUpdateSalaryRecord,
  subscribeAttendanceRecords,
  getLocalAttendanceRecords,
  getLocalSalaryRecords,
  updateResignationStatus,
  subscribeJobApplications,
  clearAllDemoEmployees,
  purgeAllDemoData,
  getLocalAdminSecurity,
  subscribeAdminSecurity,
  saveAdminSecurity
} from '../lib/firebase';
import { formatMoney, formatDateBn, getStatusBadge, toBengaliNumber } from '../lib/utils';
import { calculateEmployeeAttendanceStats, getNewJoinerSalaryPolicy, calculateCombinedPenaltyDays } from '../lib/attendanceUtils';
import { generateUniqueWorkerId, isWorkerIdUnique, getConflictingWorker } from '../lib/workerIdUtils';
import { printElement } from '../lib/printer';
import { openInExternalBrowser, isTelegramWebApp, sendSalaryStatusTelegramNotification } from '../lib/telegram';
import { AttendanceHub } from './AttendanceHub';
import { EmployeeAttendanceProfileView } from './EmployeeAttendanceProfileView';
import { ContractLetterModal } from './ContractLetterModal';
import { ResignationLetterModal } from './ResignationLetterModal';
import { SuspensionNoticeModal } from './SuspensionNoticeModal';
import { TerminationNoticeModal } from './TerminationNoticeModal';
import { JobApplicationsAdminTab } from './JobApplicationsAdminTab';
import { JobApplicationForm } from './JobApplicationForm';
import { WorkerCredentialModal } from './WorkerCredentialModal';
import { AllWorkersLoginModal } from './AllWorkersLoginModal';
import { WorkerNoticeModal } from './WorkerNoticeModal';
import {
  UserPlus,
  Users,
  User,
  UserX,
  X,
  Ban,
  IdCard,
  Key,
  Send,
  MessageSquare,
  KeyRound,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  Search,
  Edit,
  Trash2,
  Copy,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  ExternalLink,
  RotateCcw,
  Receipt,
  DollarSign,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  Download,
  Filter,
  Clock,
  Save,
  FileText,
  Bell,
  Camera,
  Upload,
  FileSignature,
  PenTool,
  Check,
  Building2,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';

export type AdminTab = 'list' | 'attendance' | 'salaries' | 'resignation' | 'form' | 'details' | 'telegram' | 'sms' | 'password' | 'factory' | 'applications';

interface AdminPanelProps {
  employees: Employee[];
  onOpenResignationModal: (emp: Employee) => void;
  onOpenResignationLetter?: (emp: Employee) => void;
  onOpenSuspensionNotice?: (emp: Employee) => void;
  onOpenTerminationNotice?: (emp: Employee) => void;
  showToast: (msg: string) => void;
  initialTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  onBack?: () => void;
}

const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  employees,
  onOpenResignationModal,
  onOpenResignationLetter,
  onOpenSuspensionNotice,
  onOpenTerminationNotice,
  showToast,
  initialTab,
  onTabChange,
  onBack,
}) => {
  // Auth & Cloud Security state
  const [adminSecurity, setAdminSecurity] = useState<AdminSecuritySettings>(() => getLocalAdminSecurity());
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('texware_admin_session') === 'true';
  });
  const [hasPasswordSet, setHasPasswordSet] = useState<boolean>(() => {
    const sec = getLocalAdminSecurity();
    const saved = localStorage.getItem('texware_admin_password');
    return !sec.isDefaultPassword || Boolean(saved && saved.trim() !== '123456');
  });

  useEffect(() => {
    const unsub = subscribeAdminSecurity((sec) => {
      setAdminSecurity(sec);
      if (!sec.isDefaultPassword) {
        setHasPasswordSet(true);
      }
    });
    return () => unsub();
  }, []);

  // First password setup state
  const [firstPass, setFirstPass] = useState('');
  const [firstPassConfirm, setFirstPassConfirm] = useState('');

  // Login state
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Active Admin Sub Tab
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab || 'list');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Employee Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formWorkerId, setFormWorkerId] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formDepartment, setFormDepartment] = useState('সুইং সেকশন');
  const [formSalary, setFormSalary] = useState('');
  const [formOtRate, setFormOtRate] = useState('');
  const [formJoinDate, setFormJoinDate] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formNid, setFormNid] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formSignatureUrl, setFormSignatureUrl] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [formBankName, setFormBankName] = useState('');
  const [formAccountName, setFormAccountName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formStatus, setFormStatus] = useState<EmploymentStatus>('active');
  const [formPortalPassword, setFormPortalPassword] = useState('');

  // Auto-assign next unique worker ID (e.g. TWA-001) if empty in create mode
  useEffect(() => {
    if (!editId && !formWorkerId) {
      setFormWorkerId(generateUniqueWorkerId(employees));
    }
  }, [editId, formWorkerId, employees]);

  const isFormWorkerIdUnique = useMemo(() => {
    return isWorkerIdUnique(formWorkerId, employees, editId || undefined);
  }, [formWorkerId, employees, editId]);

  const formConflictingWorker = useMemo(() => {
    return !isFormWorkerIdUnique ? getConflictingWorker(formWorkerId, employees, editId || undefined) : undefined;
  }, [formWorkerId, employees, editId, isFormWorkerIdUnique]);

  // Worker Credential Modal States (শ্রমিক প্রোফাইল লিংক ও পাসওয়ার্ড নিয়ন্ত্রণ)
  const [credentialModalEmp, setCredentialModalEmp] = useState<Employee | null>(null);
  const [showAllWorkersLoginModal, setShowAllWorkersLoginModal] = useState<boolean>(false);
  const [noticeModalOpen, setNoticeModalOpen] = useState<boolean>(false);
  const [noticeTargetEmp, setNoticeTargetEmp] = useState<Employee | null>(null);

  // Contract Letter Modal state
  const [contractModalEmp, setContractModalEmp] = useState<Employee | null>(null);
  const [zoomedPhotoEmp, setZoomedPhotoEmp] = useState<Employee | null>(null);

  // Resignation Letter Modal state
  const [resignationLetterModalEmp, setResignationLetterModalEmp] = useState<Employee | null>(null);

  // Suspension Notice Modal state
  const [suspensionNoticeModalEmp, setSuspensionNoticeModalEmp] = useState<Employee | null>(null);

  // Termination Notice Modal state
  const [terminationNoticeModalEmp, setTerminationNoticeModalEmp] = useState<Employee | null>(null);

  // Job Applications State
  const [pendingAppsCount, setPendingAppsCount] = useState<number>(0);
  const [showDirectAppForm, setShowDirectAppForm] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeJobApplications((apps) => {
      const p = apps.filter((a) => a.status === 'pending').length;
      setPendingAppsCount(p);
    });
    return () => unsub();
  }, []);

  // Factory Settings State
  const [factorySettings, setFactorySettings] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);
  const [facName, setFacName] = useState(DEFAULT_FACTORY_SETTINGS.name);
  const [facNameEn, setFacNameEn] = useState(DEFAULT_FACTORY_SETTINGS.nameEn || '');
  const [facAddress, setFacAddress] = useState(DEFAULT_FACTORY_SETTINGS.address);
  const [facPhone, setFacPhone] = useState(DEFAULT_FACTORY_SETTINGS.phone);
  const [facEmail, setFacEmail] = useState(DEFAULT_FACTORY_SETTINGS.email || '');
  const [facContractRules, setFacContractRules] = useState<string[]>(DEFAULT_CONTRACT_RULES);
  const [facContractDeclaration, setFacContractDeclaration] = useState<string>(DEFAULT_CONTRACT_DECLARATION);
  const [newRuleInput, setNewRuleInput] = useState('');
  const [isBulkRulesMode, setIsBulkRulesMode] = useState(false);
  const [bulkRulesText, setBulkRulesText] = useState('');
  const [isSavingFac, setIsSavingFac] = useState(false);

  // Employee List Filter & Search & 4 Dedicated Sections
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resigned' | 'suspended'>('all');
  const [employeeSectionTab, setEmployeeSectionTab] = useState<'active' | 'resigned' | 'suspended' | 'terminated'>('active');

  // Salary Records State
  const [salaryRecords, setSalaryRecords] = useState<SalaryDisbursementRecord[]>([]);
  const [salaryMonthFilter, setSalaryMonthFilter] = useState<string>('all');
  const [salaryYearFilter, setSalaryYearFilter] = useState<string>('all');
  const [salarySearchQuery, setSalarySearchQuery] = useState<string>('');
  const [salaryMethodFilter, setSalaryMethodFilter] = useState<string>('all');
  const [salaryStatusFilter, setSalaryStatusFilter] = useState<string>('all');
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState<boolean>(false);
  const [showPurgeAllHistoryModal, setShowPurgeAllHistoryModal] = useState<boolean>(false);
  const [isPurgingAllHistory, setIsPurgingAllHistory] = useState<boolean>(false);

  // Salary Record Edit State
  const [editingSalaryRecord, setEditingSalaryRecord] = useState<SalaryDisbursementRecord | null>(null);
  const [editRecBasicSalary, setEditRecBasicSalary] = useState<number>(0);
  const [editRecTotalDays, setEditRecTotalDays] = useState<number>(26);
  const [editRecPresentDays, setEditRecPresentDays] = useState<number>(26);
  const [editRecAbsentDays, setEditRecAbsentDays] = useState<number>(0);
  const [editRecLateDays, setEditRecLateDays] = useState<number>(0);
  const [editRecOtHours, setEditRecOtHours] = useState<number>(0);
  const [editRecOtRate, setEditRecOtRate] = useState<number>(0);
  const [editRecBonus, setEditRecBonus] = useState<number>(0);
  const [editRecAdvance, setEditRecAdvance] = useState<number>(0);
  const [editRecDeduction, setEditRecDeduction] = useState<number>(0);
  const [editRecDeductionReason, setEditRecDeductionReason] = useState<string>('');
  const [editRecNetPayable, setEditRecNetPayable] = useState<number>(0);
  const [editRecPaidAmount, setEditRecPaidAmount] = useState<number>(0);
  const [editRecPaymentMethod, setEditRecPaymentMethod] = useState<PaymentMethod>('cash');
  const [editRecPaymentStatus, setEditRecPaymentStatus] = useState<'paid' | 'due' | 'pending' | 'partial'>('pending');
  const [editRecProgressStatus, setEditRecProgressStatus] = useState<SalaryProgressStatus>('due');
  const [editRecNote, setEditRecNote] = useState<string>('');
  const [isEditingSalarySaving, setIsEditingSalarySaving] = useState<boolean>(false);

  // Month-based Batch Delete States
  const [batchDeleteMonth, setBatchDeleteMonth] = useState<string>(() => {
    return BENGALI_MONTHS[new Date().getMonth()];
  });
  const [batchDeleteYear, setBatchDeleteYear] = useState<number>(new Date().getFullYear());

  // Attendance Records State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Employee to delete confirm dialog state
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Set of dismissed/deleted salary draft keys (format: `workerId_month_year` or `empId_month_year`)
  const [dismissedDraftKeys, setDismissedDraftKeys] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('texware_dismissed_salary_drafts');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Profile Print Ref
  const profilePrintRef = useRef<HTMLDivElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const profileSignatureInputRef = useRef<HTMLInputElement>(null);
  const salarySheetPrintRef = useRef<HTMLDivElement>(null);
  const masterA4SheetPrintRef = useRef<HTMLDivElement>(null);

  // Master A4 Payroll & Attendance Sheet State
  const [showMasterA4Modal, setShowMasterA4Modal] = useState<boolean>(false);
  const [masterA4Month, setMasterA4Month] = useState<string>(() => {
    try {
      const local = localStorage.getItem('texware_salary_records_v1') || localStorage.getItem('texware_salary_records');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.month) {
          return parsed[0].month;
        }
      }
    } catch {}
    const currIdx = new Date().getMonth();
    return BENGALI_MONTHS[currIdx] || 'সেপ্টেম্বর';
  });
  const [masterA4Year, setMasterA4Year] = useState<number>(new Date().getFullYear());
  const [masterA4Dept, setMasterA4Dept] = useState<string>('all');
  const [masterA4Status, setMasterA4Status] = useState<'active' | 'all'>('active');
  const [masterTotalDays, setMasterTotalDays] = useState<number>(26);
  const [masterDefaultBonus, setMasterDefaultBonus] = useState<number>(500);
  const [masterA4IncludeDraft, setMasterA4IncludeDraft] = useState<boolean>(false);

  // Details Tab
  const [detailSelectedId, setDetailSelectedId] = useState<string>(() => {
    try {
      return localStorage.getItem('texware_selected_detail_id') || '';
    } catch {
      return '';
    }
  });

  // Telegram Settings State
  const [tgSettings, setTgSettings] = useState<TelegramSettings>({ botToken: '', chatId: '' });
  const [tgTesting, setTgTesting] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);

  // SMS Settings State
  const [smsSettings, setSmsSettingsState] = useState<SMSSettings>({
    apiUrl: 'https://api.bulksmsbd.net/api/smsapi',
    apiKey: '',
    senderId: 'TexWare',
    method: 'GET',
    keyParam: 'api_key',
    mobileParam: 'number',
    messageParam: 'message',
    senderParam: 'senderid',
  });
  const [smsMode, setSmsMode] = useState<'single' | 'bulk'>('single');
  const [singleSmsEmpId, setSingleSmsEmpId] = useState('');
  const [singleSmsMsg, setSingleSmsMsg] = useState('');
  const [bulkSmsMsg, setBulkSmsMsg] = useState('');
  const [selectedBulkEmpIds, setSelectedBulkEmpIds] = useState<string[]>([]);
  const [isSendingSms, setIsSendingSms] = useState(false);

  // Password Change Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Telegram In-App Printing & Record Delete Confirmation States
  const [telegramPrintModalTitle, setTelegramPrintModalTitle] = useState<string | null>(null);
  const [deleteSalaryRecordTarget, setDeleteSalaryRecordTarget] = useState<SalaryDisbursementRecord | null>(null);

  // Load Telegram, SMS & Factory Settings on mount and subscribe to Salary & Attendance Records
  useEffect(() => {
    loadTelegramSettings().then(setTgSettings);
    loadSMSSettings().then(setSmsSettingsState);
    loadFactorySettings().then((s) => {
      setFactorySettings(s);
      setFacName(s.name);
      setFacNameEn(s.nameEn || '');
      setFacAddress(s.address);
      setFacPhone(s.phone);
      setFacEmail(s.email || '');
      const rules = Array.isArray(s.contractRules) && s.contractRules.length > 0 ? s.contractRules : DEFAULT_CONTRACT_RULES;
      setFacContractRules(rules);
      setFacContractDeclaration(s.contractDeclaration || DEFAULT_CONTRACT_DECLARATION);
      setBulkRulesText(rules.join('\n'));
    });
    const unsubSal = subscribeSalaryRecords((records) => {
      setSalaryRecords(records);
    });
    const unsubAtt = subscribeAttendanceRecords((records) => {
      setAttendanceRecords(records);
    });
    // নিশ্চিত করুন কোনো ডেমো কর্মী বা ডেমো হাজিরা ডাটাবেজে নেই
    purgeAllDemoData().catch(() => {});
    return () => {
      unsubSal();
      unsubAtt();
    };
  }, []);

  // Ensure attendance and salary records are fresh on login or tab switch
  useEffect(() => {
    if (isLoggedIn) {
      const freshAtt = getLocalAttendanceRecords();
      if (freshAtt && freshAtt.length > 0) {
        setAttendanceRecords(freshAtt);
      }
      const freshSal = getLocalSalaryRecords();
      if (freshSal && freshSal.length > 0) {
        setSalaryRecords(freshSal);
      }
    }
  }, [isLoggedIn, activeTab]);

  const handleSaveFactoryProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingFac(true);
    try {
      const activeRules = isBulkRulesMode
        ? bulkRulesText
            .split('\n')
            .map((l) => l.trim().replace(/^\d+[\.\-\)]\s*/, ''))
            .filter((l) => l.length > 0)
        : facContractRules.map((r) => r.trim()).filter((r) => r.length > 0);

      const finalRules = activeRules.length > 0 ? activeRules : DEFAULT_CONTRACT_RULES;

      const updated: FactorySettings = {
        name: facName.trim() || DEFAULT_FACTORY_SETTINGS.name,
        nameEn: facNameEn.trim() || DEFAULT_FACTORY_SETTINGS.nameEn,
        address: facAddress.trim() || DEFAULT_FACTORY_SETTINGS.address,
        phone: facPhone.trim() || DEFAULT_FACTORY_SETTINGS.phone,
        email: facEmail.trim() || DEFAULT_FACTORY_SETTINGS.email,
        contractRules: finalRules,
        contractDeclaration: facContractDeclaration.trim() || DEFAULT_CONTRACT_DECLARATION,
        updatedAt: Date.now(),
      };
      await saveFactorySettings(updated);
      setFactorySettings(updated);
      setFacContractRules(finalRules);
      setBulkRulesText(finalRules.join('\n'));
      showToast('✓ কারখানার নাম, ঠিকানা ও চুক্তিপত্রের সকল শর্তাবলি সফলভাবে সংরক্ষিত হয়েছে');
    } catch (err) {
      showToast('কারখানার তথ্য সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSavingFac(false);
    }
  };

  const handleAddContractRule = () => {
    if (!newRuleInput.trim()) {
      showToast('অনুগ্রহ করে নতুন শর্ত বা নিয়মের বিবরণ লিখুন');
      return;
    }
    const updated = [...facContractRules, newRuleInput.trim()];
    setFacContractRules(updated);
    setBulkRulesText(updated.join('\n'));
    setNewRuleInput('');
    showToast(`✓ নতুন শর্ত #${toBengaliNumber(updated.length)} যুক্ত করা হয়েছে`);
  };

  const handleUpdateContractRule = (index: number, text: string) => {
    const updated = [...facContractRules];
    updated[index] = text;
    setFacContractRules(updated);
    setBulkRulesText(updated.join('\n'));
  };

  const handleDeleteContractRule = (index: number) => {
    if (facContractRules.length <= 1) {
      showToast('চুক্তিপত্রে অন্তত ১টি শর্ত থাকা আবশ্যক');
      return;
    }
    const updated = facContractRules.filter((_, idx) => idx !== index);
    setFacContractRules(updated);
    setBulkRulesText(updated.join('\n'));
    showToast('শর্তটি তালিকা থেকে সরানো হয়েছে');
  };

  const handleMoveContractRule = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= facContractRules.length) return;
    const updated = [...facContractRules];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFacContractRules(updated);
    setBulkRulesText(updated.join('\n'));
  };

  const handleResetContractRules = () => {
    setFacContractRules(DEFAULT_CONTRACT_RULES);
    setFacContractDeclaration(DEFAULT_CONTRACT_DECLARATION);
    setBulkRulesText(DEFAULT_CONTRACT_RULES.join('\n'));
    showToast('ডিফল্ট ৮টি শর্তাবলি সফলভাবে রিস্টোর হয়েছে');
  };

  // Sync details dropdown with active working employee or stored employee if empty
  useEffect(() => {
    const activeList = employees.filter((e) => e.status === 'active');
    const sourceList = activeList.length > 0 ? activeList : employees;
    if (sourceList.length > 0) {
      if (!detailSelectedId) {
        const saved = localStorage.getItem('texware_selected_detail_id');
        const match = saved && sourceList.find((e) => e.id === saved);
        const targetId = match ? match.id : sourceList[0].id;
        setDetailSelectedId(targetId);
        try {
          localStorage.setItem('texware_selected_detail_id', targetId);
        } catch {}
      } else {
        const exists = sourceList.some((e) => e.id === detailSelectedId);
        if (!exists) {
          setDetailSelectedId(sourceList[0].id);
          try {
            localStorage.setItem('texware_selected_detail_id', sourceList[0].id);
          } catch {}
        }
      }
    }
  }, [employees, detailSelectedId]);

  /* ================= AUTH HANDLERS ================= */
  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firstPass.length < 6) {
      showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }
    if (firstPass !== firstPassConfirm) {
      showToast('উভয় পাসওয়ার্ড মিলছে না');
      return;
    }
    try {
      await saveAdminSecurity(firstPass.trim(), false);
      sessionStorage.setItem('texware_admin_session', 'true');
      setHasPasswordSet(true);
      setIsLoggedIn(true);
      setFirstPass('');
      setFirstPassConfirm('');
      showToast('✓ Admin পাসওয়ার্ড ক্লাউড ডেটাবেজে সফলভাবে সেট হয়েছে');
    } catch {
      showToast('পাসওয়ার্ড সেট করতে সমস্যা হয়েছে');
    }
  };

  const handleQuickSetupDefault = async () => {
    try {
      await saveAdminSecurity('123456', true);
      sessionStorage.setItem('texware_admin_session', 'true');
      setHasPasswordSet(true);
      setIsLoggedIn(true);
      showToast('ডিফল্ট পাসওয়ার্ড (123456) সেট করে লগইন করা হয়েছে');
    } catch {
      setIsLoggedIn(true);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = loginPass.trim();
    const activePass = (adminSecurity.adminPassword || localStorage.getItem('texware_admin_password') || '').trim();
    const isCustom = !adminSecurity.isDefaultPassword || (activePass !== '' && activePass !== '123456');

    if (isCustom) {
      // Admin has set a custom password in cloud database!
      // STRICT SECURITY: 123456, admin, admin123 MUST NEVER be accepted!
      if (cleanInput === activePass) {
        sessionStorage.setItem('texware_admin_session', 'true');
        setIsLoggedIn(true);
        const freshAtt = getLocalAttendanceRecords();
        if (freshAtt && freshAtt.length > 0) {
          setAttendanceRecords(freshAtt);
        }
        const freshSal = getLocalSalaryRecords();
        if (freshSal && freshSal.length > 0) {
          setSalaryRecords(freshSal);
        }
        setLoginPass('');
        showToast('✓ Admin Login সফল হয়েছে');
      } else {
        if (cleanInput === '123456' || cleanInput === 'admin123' || cleanInput === 'admin') {
          showToast('⛔ এই সাইটের ডিফল্ট পাসওয়ার্ড (123456) নিষ্ক্রিয় করা হয়েছে! অ্যাডমিনের নতুন নির্ধারিত পাসওয়ার্ড দিন।');
        } else {
          showToast('⛔ ভুল পাসওয়ার্ড, সঠিক Admin পাসওয়ার্ড দিন');
        }
      }
    } else {
      // First-time before any password was customized
      if (cleanInput === activePass || cleanInput === '123456') {
        sessionStorage.setItem('texware_admin_session', 'true');
        setIsLoggedIn(true);
        const freshAtt = getLocalAttendanceRecords();
        if (freshAtt && freshAtt.length > 0) {
          setAttendanceRecords(freshAtt);
        }
        const freshSal = getLocalSalaryRecords();
        if (freshSal && freshSal.length > 0) {
          setSalaryRecords(freshSal);
        }
        setLoginPass('');
        showToast('✓ Admin Login সফল হয়েছে');
      } else {
        showToast('ভুল পাসওয়ার্ড, পুনরায় চেষ্টা করুন');
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('texware_admin_session');
    setIsLoggedIn(false);
    showToast('Admin Logout সম্পন্ন হয়েছে');
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWorkerId = formWorkerId.trim().toUpperCase();
    if (!formName.trim() || !cleanWorkerId || !formDesignation.trim()) {
      showToast('নাম, Worker ID ও পদবি পূরণ করা আবশ্যক');
      return;
    }

    // Strict uniqueness validation: No two workers can ever have the same ID (active, resigned, or terminated)!
    if (!isWorkerIdUnique(cleanWorkerId, employees, editId || undefined)) {
      const conflict = getConflictingWorker(cleanWorkerId, employees, editId || undefined);
      const statusLabel = conflict?.status === 'resigned' ? 'পদত্যাগকৃত কর্মী' : conflict?.status === 'terminated' ? 'অব্যাহতি/বরখাস্তকৃত কর্মী' : conflict?.status === 'salary_history' ? 'বেতন রেকর্ডের পূর্ববর্তী কর্মী' : 'কর্মী';
      showToast(`⚠️ Worker ID "${cleanWorkerId}" ইতিমধ্যে ${statusLabel} "${conflict?.name || conflict?.workerId || 'অন্য জন'}"-এর জন্য ব্যবহৃত! পদত্যাগকৃত বা কোনো কর্মীর আইডি দ্বিতীয়বার নেওয়া যাবে না।`);
      return;
    }

    const salaryNum = Number(formSalary) || 0;
    const otRateNum = Number(formOtRate) || 0;

    try {
      const existing = employees.find((e) => e.id === editId);
      const payload: Omit<Employee, 'id'> = {
        name: formName.trim(),
        workerId: cleanWorkerId,
        designation: formDesignation.trim(),
        department: formDepartment.trim(),
        salary: salaryNum,
        otRate: otRateNum,
        joinDate: formJoinDate,
        birthDate: formBirthDate,
        nid: formNid.trim(),
        mobile: formMobile.trim(),
        address: formAddress.trim(),
        photoUrl: formPhotoUrl.trim(),
        signatureUrl: formSignatureUrl.trim(),
        bankName: formBankName.trim(),
        accountName: formAccountName.trim() || formName.trim(),
        accountNumber: formAccountNumber.trim(),
        status: formStatus,
        resignationDate: formStatus === 'resigned' ? (existing?.resignationDate || new Date().toISOString().split('T')[0]) : (existing?.resignationDate || ''),
        resignationReason: formStatus === 'resigned' ? (existing?.resignationReason || '') : (existing?.resignationReason || ''),
        noticeServed: existing?.noticeServed || 'no',
        clearanceDone: Boolean(existing?.clearanceDone),
        finalSettlementPaid: Boolean(existing?.finalSettlementPaid),
        finalSettlementNote: existing?.finalSettlementNote || '',
        suspensionDate: existing?.suspensionDate || '',
        suspensionReason: existing?.suspensionReason || '',
        suspensionDuration: existing?.suspensionDuration || '',
        terminationDate: existing?.terminationDate || '',
        terminationReason: existing?.terminationReason || '',
        terminationMemo: existing?.terminationMemo || '',
        statusChangedAt: existing?.status !== formStatus ? Date.now() : (existing?.statusChangedAt || Date.now()),
        portalPassword: formPortalPassword.trim() || existing?.portalPassword || '',
      };

      await saveOrUpdateEmployee(payload, editId || undefined);

      if (editId) {
        showToast(`"${formName}" এর তথ্য সফলভাবে আপডেট হয়েছে`);
      } else {
        showToast(`নতুন কর্মচারী "${formName}" যোগ হয়েছে`);
      }

      resetForm();
      setActiveTab('list');
    } catch (err) {
      console.error(err);
      showToast('কর্মচারী সেভ করা সম্ভব হয়নি');
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditId(emp.id);
    setFormName(emp.name);
    setFormWorkerId(emp.workerId);
    setFormDesignation(emp.designation);
    setFormDepartment(emp.department || 'সুইং সেকশন');
    setFormSalary(String(emp.salary || ''));
    setFormOtRate(String(emp.otRate || ''));
    setFormJoinDate(emp.joinDate || '');
    setFormBirthDate(emp.birthDate || '');
    setFormNid(emp.nid || '');
    setFormMobile(emp.mobile || '');
    setFormAddress(emp.address || '');
    setFormPhotoUrl(emp.photoUrl || '');
    setFormSignatureUrl(emp.signatureUrl || '');
    setFormBankName(emp.bankName || '');
    setFormAccountName(emp.accountName || '');
    setFormAccountNumber(emp.accountNumber || '');
    setFormStatus(emp.status || 'active');
    setFormPortalPassword(emp.portalPassword || '');

    setActiveTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditId(null);
    setFormName('');
    const nextUniqueId = generateUniqueWorkerId(employees);
    setFormWorkerId(nextUniqueId);
    setFormDesignation('');
    setFormDepartment('সুইং সেকশন');
    setFormSalary('');
    setFormOtRate('');
    setFormJoinDate('');
    setFormBirthDate('');
    setFormNid('');
    setFormMobile('');
    setFormAddress('');
    setFormPhotoUrl('');
    setFormSignatureUrl('');
    setShowSignaturePad(false);
    setFormBankName('');
    setFormAccountName('');
    setFormAccountNumber('');
    setFormStatus('active');
    setFormPortalPassword('');
  };

  const handleDeleteEmployee = (emp: Employee) => {
    setDeleteConfirmEmp(emp);
  };

  const confirmExecuteDelete = async () => {
    if (!deleteConfirmEmp) return;
    const target = deleteConfirmEmp;
    setIsDeleting(true);
    try {
      await deleteEmployeeById(target.id);
      setDeleteConfirmEmp(null);
      if (detailSelectedId === target.id) {
        setDetailSelectedId('');
      }
      showToast(`কর্মচারী "${target.name}" সফলভাবে মুছে ফেলা হয়েছে`);
    } catch (err) {
      console.error("Delete error:", err);
      // Fallback removal from local state if network issue
      const remaining = employees.filter((e) => e.id !== target.id);
      setLocalEmployees(remaining);
      setDeleteConfirmEmp(null);
      showToast(`কর্মচারী "${target.name}" মুছে ফেলা হয়েছে`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSalaryRecord = (record: SalaryDisbursementRecord) => {
    setDeleteSalaryRecordTarget(record);
  };

  const confirmExecuteDeleteSalaryRecord = async () => {
    if (!deleteSalaryRecordTarget) return;
    const target = deleteSalaryRecordTarget;
    setDeleteSalaryRecordTarget(null);
    try {
      // 1. Mark draft key as dismissed so it doesn't bounce back as an auto-draft row
      const draftKey1 = `${(target.workerId || '').toLowerCase()}_${target.month}_${target.year}`;
      const draftKey2 = `${(target.employeeId || '').toLowerCase()}_${target.month}_${target.year}`;
      setDismissedDraftKeys((prev) => {
        const next = new Set(prev);
        if (draftKey1) next.add(draftKey1);
        if (draftKey2) next.add(draftKey2);
        try {
          localStorage.setItem('texware_dismissed_salary_drafts', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      // 2. Delete from Firebase & local state
      if (target.id) {
        await deleteSalaryRecordById(target.id);
      }
      if (target.workerId || target.employeeId) {
        await deleteSalaryRecordForWorkerMonth(target.workerId || target.employeeId, target.month, target.year);
      }

      showToast(`✓ ${target.employeeName}-এর ${target.month} ${toBengaliNumber(target.year)} সালের বেতন রেকর্ড স্থায়ীভাবে মুছে ফেলা হয়েছে`);
    } catch (e) {
      showToast('রেকর্ড মুছতে সমস্যা হয়েছে');
    }
  };

  const handlePrintProfile = () => {
    if (!profilePrintRef.current) {
      window.print();
      return;
    }
    const result = printElement(profilePrintRef.current, `Profile_${selectedDetailEmp?.name || 'Employee'}`);
    if (result.isTelegram) {
      setTelegramPrintModalTitle(`কর্মচারী প্রোফাইল প্রিন্ট (${selectedDetailEmp?.name || 'প্রোফাইল'})`);
    }
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDetailEmp) return;

    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে সঠিক ছবির ফাইল (JPG/PNG) নির্বাচন করুন');
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      showToast('ছবির সাইজ ২.৫ মেগাবাইটের কম হতে হবে');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const payload: Omit<Employee, 'id'> = {
          name: selectedDetailEmp.name,
          workerId: selectedDetailEmp.workerId,
          designation: selectedDetailEmp.designation,
          department: selectedDetailEmp.department,
          salary: selectedDetailEmp.salary,
          otRate: selectedDetailEmp.otRate,
          joinDate: selectedDetailEmp.joinDate,
          birthDate: selectedDetailEmp.birthDate,
          nid: selectedDetailEmp.nid,
          mobile: selectedDetailEmp.mobile,
          address: selectedDetailEmp.address,
          photoUrl: base64,
          signatureUrl: selectedDetailEmp.signatureUrl || '',
          bankName: selectedDetailEmp.bankName,
          accountName: selectedDetailEmp.accountName,
          accountNumber: selectedDetailEmp.accountNumber,
          bankBranch: selectedDetailEmp.bankBranch,
          status: selectedDetailEmp.status,
          resignationDate: selectedDetailEmp.resignationDate,
          resignationReason: selectedDetailEmp.resignationReason,
          noticeServed: selectedDetailEmp.noticeServed,
          clearanceDone: selectedDetailEmp.clearanceDone,
          finalSettlementPaid: selectedDetailEmp.finalSettlementPaid,
          finalSettlementNote: selectedDetailEmp.finalSettlementNote,
        };
        await saveOrUpdateEmployee(payload, selectedDetailEmp.id);
        showToast('✓ শ্রমিকের ছবি সফলভাবে যুক্ত হয়েছে এবং প্রোফাইল ও চুক্তিপত্রে প্রদর্শিত হবে');
      } catch (err) {
        showToast('ছবি সংরক্ষণ করতে সমস্যা হয়েছে');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProfilePhoto = async () => {
    if (!selectedDetailEmp) return;
    if (!window.confirm('আপনি কি এই শ্রমিকের ছবি মুছে ফেলতে চান?')) return;
    try {
      const payload: Omit<Employee, 'id'> = {
        name: selectedDetailEmp.name,
        workerId: selectedDetailEmp.workerId,
        designation: selectedDetailEmp.designation,
        department: selectedDetailEmp.department,
        salary: selectedDetailEmp.salary,
        otRate: selectedDetailEmp.otRate,
        joinDate: selectedDetailEmp.joinDate,
        birthDate: selectedDetailEmp.birthDate,
        nid: selectedDetailEmp.nid,
        mobile: selectedDetailEmp.mobile,
        address: selectedDetailEmp.address,
        photoUrl: '',
        signatureUrl: selectedDetailEmp.signatureUrl || '',
        bankName: selectedDetailEmp.bankName,
        accountName: selectedDetailEmp.accountName,
        accountNumber: selectedDetailEmp.accountNumber,
        bankBranch: selectedDetailEmp.bankBranch,
        status: selectedDetailEmp.status,
        resignationDate: selectedDetailEmp.resignationDate,
        resignationReason: selectedDetailEmp.resignationReason,
        noticeServed: selectedDetailEmp.noticeServed,
        clearanceDone: selectedDetailEmp.clearanceDone,
        finalSettlementPaid: selectedDetailEmp.finalSettlementPaid,
        finalSettlementNote: selectedDetailEmp.finalSettlementNote,
      };
      await saveOrUpdateEmployee(payload, selectedDetailEmp.id);
      showToast('✓ শ্রমিকের ছবি মুছে ফেলা হয়েছে');
    } catch (err) {
      showToast('ছবি মুছতে সমস্যা হয়েছে');
    }
  };

  const handlePromptPhotoUrl = async () => {
    if (!selectedDetailEmp) return;
    const url = window.prompt('শ্রমিকের ছবির সরাসরি অনলাইন লিংক (URL) দিন:', selectedDetailEmp.photoUrl || '');
    if (url === null) return;
    try {
      const cleanUrl = url.trim();
      const payload: Omit<Employee, 'id'> = {
        name: selectedDetailEmp.name,
        workerId: selectedDetailEmp.workerId,
        designation: selectedDetailEmp.designation,
        department: selectedDetailEmp.department,
        salary: selectedDetailEmp.salary,
        otRate: selectedDetailEmp.otRate,
        joinDate: selectedDetailEmp.joinDate,
        birthDate: selectedDetailEmp.birthDate,
        nid: selectedDetailEmp.nid,
        mobile: selectedDetailEmp.mobile,
        address: selectedDetailEmp.address,
        photoUrl: cleanUrl,
        signatureUrl: selectedDetailEmp.signatureUrl || '',
        bankName: selectedDetailEmp.bankName,
        accountName: selectedDetailEmp.accountName,
        accountNumber: selectedDetailEmp.accountNumber,
        bankBranch: selectedDetailEmp.bankBranch,
        status: selectedDetailEmp.status,
        resignationDate: selectedDetailEmp.resignationDate,
        resignationReason: selectedDetailEmp.resignationReason,
        noticeServed: selectedDetailEmp.noticeServed,
        clearanceDone: selectedDetailEmp.clearanceDone,
        finalSettlementPaid: selectedDetailEmp.finalSettlementPaid,
        finalSettlementNote: selectedDetailEmp.finalSettlementNote,
      };
      await saveOrUpdateEmployee(payload, selectedDetailEmp.id);
      showToast('✓ শ্রমিকের ছবির URL সফলভাবে সংরক্ষিত হয়েছে');
    } catch (err) {
      showToast('ছবির URL সংরক্ষণে ব্যর্থ হয়েছে');
    }
  };

  const handleProfileSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDetailEmp) return;
    if (file.size > 2.5 * 1024 * 1024) {
      showToast('স্বাক্ষর ফাইলের সাইজ ২.৫ মেগাবাইটের কম হতে হবে');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const payload: Omit<Employee, 'id'> = {
          name: selectedDetailEmp.name,
          workerId: selectedDetailEmp.workerId,
          designation: selectedDetailEmp.designation,
          department: selectedDetailEmp.department,
          salary: selectedDetailEmp.salary,
          otRate: selectedDetailEmp.otRate,
          joinDate: selectedDetailEmp.joinDate,
          birthDate: selectedDetailEmp.birthDate,
          nid: selectedDetailEmp.nid,
          mobile: selectedDetailEmp.mobile,
          address: selectedDetailEmp.address,
          photoUrl: selectedDetailEmp.photoUrl || '',
          signatureUrl: base64,
          bankName: selectedDetailEmp.bankName,
          accountName: selectedDetailEmp.accountName,
          accountNumber: selectedDetailEmp.accountNumber,
          bankBranch: selectedDetailEmp.bankBranch,
          status: selectedDetailEmp.status,
          resignationDate: selectedDetailEmp.resignationDate,
          resignationReason: selectedDetailEmp.resignationReason,
          noticeServed: selectedDetailEmp.noticeServed,
          clearanceDone: selectedDetailEmp.clearanceDone,
          finalSettlementPaid: selectedDetailEmp.finalSettlementPaid,
          finalSettlementNote: selectedDetailEmp.finalSettlementNote,
          suspensionDate: selectedDetailEmp.suspensionDate,
          suspensionReason: selectedDetailEmp.suspensionReason,
          suspensionDuration: selectedDetailEmp.suspensionDuration,
          terminationDate: selectedDetailEmp.terminationDate,
          terminationReason: selectedDetailEmp.terminationReason,
          terminationMemo: selectedDetailEmp.terminationMemo,
        };
        await saveOrUpdateEmployee(payload, selectedDetailEmp.id);
        showToast('✓ শ্রমিকের স্বাক্ষর সফলভাবে আপলোড হয়েছে (চুক্তিপত্র, বরখাস্ত ও পদত্যাগে স্বয়ংক্রিয়ভাবে বসবে)');
      } catch (err) {
        showToast('স্বাক্ষর সংরক্ষণ করতে সমস্যা হয়েছে');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSignatureRemove = async () => {
    if (!selectedDetailEmp) return;
    try {
      const payload: Omit<Employee, 'id'> = {
        name: selectedDetailEmp.name,
        workerId: selectedDetailEmp.workerId,
        designation: selectedDetailEmp.designation,
        department: selectedDetailEmp.department,
        salary: selectedDetailEmp.salary,
        otRate: selectedDetailEmp.otRate,
        joinDate: selectedDetailEmp.joinDate,
        birthDate: selectedDetailEmp.birthDate,
        nid: selectedDetailEmp.nid,
        mobile: selectedDetailEmp.mobile,
        address: selectedDetailEmp.address,
        photoUrl: selectedDetailEmp.photoUrl || '',
        signatureUrl: '',
        bankName: selectedDetailEmp.bankName,
        accountName: selectedDetailEmp.accountName,
        accountNumber: selectedDetailEmp.accountNumber,
        bankBranch: selectedDetailEmp.bankBranch,
        status: selectedDetailEmp.status,
        resignationDate: selectedDetailEmp.resignationDate,
        resignationReason: selectedDetailEmp.resignationReason,
        noticeServed: selectedDetailEmp.noticeServed,
        clearanceDone: selectedDetailEmp.clearanceDone,
        finalSettlementPaid: selectedDetailEmp.finalSettlementPaid,
        finalSettlementNote: selectedDetailEmp.finalSettlementNote,
        suspensionDate: selectedDetailEmp.suspensionDate,
        suspensionReason: selectedDetailEmp.suspensionReason,
        suspensionDuration: selectedDetailEmp.suspensionDuration,
        terminationDate: selectedDetailEmp.terminationDate,
        terminationReason: selectedDetailEmp.terminationReason,
        terminationMemo: selectedDetailEmp.terminationMemo,
      };
      await saveOrUpdateEmployee(payload, selectedDetailEmp.id);
      showToast('✓ শ্রমিকের স্বাক্ষর মুছে ফেলা হয়েছে');
    } catch {
      showToast('স্বাক্ষর মুছতে সমস্যা হয়েছে');
    }
  };

  const handlePrintSalarySheet = () => {
    if (!salarySheetPrintRef.current) {
      window.print();
      return;
    }
    const result = printElement(
      salarySheetPrintRef.current,
      `Salary_Sheet_${salaryMonthFilter}_${salaryYearFilter}`,
      'landscape'
    );
    if (result.isTelegram) {
      setTelegramPrintModalTitle(`মাসিক বেতন শিট প্রিন্ট (${salaryMonthFilter} ${salaryYearFilter})`);
    }
  };

  /* ================= UPDATE SALARY PAYMENT & PROGRESS STATUS DIRECTLY ================= */
  const handleUpdateSalaryStatus = async (
    rec: SalaryDisbursementRecord & { isDraft?: boolean },
    newStatus: SalaryProgressStatus | 'paid' | 'due' | 'pending'
  ) => {
    try {
      const isPaid = newStatus === 'paid' || newStatus === 'disbursed';
      const isReady = newStatus === 'ready';
      const isCalculated = newStatus === 'calculated';
      const isDue = newStatus === 'due' || newStatus === 'calculating';

      const netPayable = rec.netPayable || rec.salary || 0;
      const paidAmount = isPaid ? netPayable : 0;
      const dueAmount = isPaid ? 0 : netPayable;
      const progressStatus: SalaryProgressStatus = isPaid
        ? 'disbursed'
        : isReady
        ? 'ready'
        : isCalculated
        ? 'calculated'
        : 'due';

      const paymentStatus: 'paid' | 'due' | 'pending' = isPaid ? 'paid' : isDue ? 'due' : 'pending';

      const targetMonth = rec.month || salaryMonthFilter || 'অক্টোবর';
      const targetYear = rec.year || Number(salaryYearFilter) || 2026;
      const recId = rec.id && !rec.id.startsWith('sal_draft')
        ? rec.id
        : `sal_${rec.employeeId || rec.workerId}_${targetMonth}_${targetYear}`;

      const updated: SalaryDisbursementRecord = {
        ...rec,
        id: recId,
        month: targetMonth,
        year: targetYear,
        paymentStatus,
        progressStatus,
        paidAmount,
        dueAmount,
        statusUpdatedAt: Date.now(),
        statusUpdatedDate: new Date().toISOString().split('T')[0],
        paidAt: Date.now(),
      };
      delete (updated as any).isDraft;

      // Remove from dismissed draft keys so this record remains visible
      const dKey1 = `${(rec.workerId || '').toLowerCase()}_${targetMonth}_${targetYear}`;
      const dKey2 = `${(rec.employeeId || '').toLowerCase()}_${targetMonth}_${targetYear}`;
      setDismissedDraftKeys((prev) => {
        const next = new Set(prev);
        if (dKey1) next.delete(dKey1);
        if (dKey2) next.delete(dKey2);
        try {
          localStorage.setItem('texware_dismissed_salary_drafts', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      const previousStatus =
        rec.progressStatus || (rec.paymentStatus === 'paid' ? 'disbursed' : 'due');

      await saveOrUpdateSalaryRecord(updated, recId);

      // Send automatic Telegram Bot notification for this worker's salary status update
      void (async () => {
        try {
          const activeTg =
            tgSettings?.botToken?.trim() && tgSettings?.chatId?.trim()
              ? tgSettings
              : await loadTelegramSettings();
          await sendSalaryStatusTelegramNotification({
            record: updated,
            previousStatus,
            settings: activeTg,
            factoryName: factorySettings?.name,
          });
        } catch {}
      })();

      const statusLabels: Record<string, string> = {
        due: 'বাকী',
        calculating: 'বাকী',
        calculated: 'হিসাব সম্পূর্ণ',
        ready: 'বেতন দেওয়ার জন্য প্রস্তুত',
        disbursed: 'বেতন প্রদান করা সম্পূর্ণ',
        paid: 'বেতন প্রদান করা সম্পূর্ণ',
      };
      showToast(`✓ ${rec.employeeName}-এর স্ট্যাটাস "${statusLabels[progressStatus]}" করা হয়েছে এবং ক্লাউড ডাটাবেজে স্থায়ীভাবে সংরক্ষিত হয়েছে`);
    } catch (e) {
      showToast('স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে');
    }
  };

  /* ================= DEDUPLICATED SALARY RECORDS (PREVENTS 2ND ENTRY) ================= */
  const uniqueSalaryRecords = useMemo(() => {
    const map = new Map<string, SalaryDisbursementRecord>();
    salaryRecords.forEach((rawRec) => {
      let r = { ...rawRec };
      const net = r.netPayable || r.salary || 0;
      
      // Auto-heal payment amounts: If record is marked as paid or paidAmount >= net, due MUST be 0 and paid MUST be full net
      if (r.paymentStatus === 'paid' || (r.paidAmount && net > 0 && r.paidAmount >= net)) {
        r.paymentStatus = 'paid';
        r.paidAmount = net;
        r.dueAmount = 0;
      } else {
        const curPaid = r.paidAmount || 0;
        r.paidAmount = curPaid;
        r.dueAmount = Math.max(0, net - curPaid);
      }

      const key = `${r.workerId || r.employeeId}_${r.month}_${r.year}`;
      if (!map.has(key)) {
        map.set(key, r);
      } else {
        const prev = map.get(key)!;
        if ((r.paidAt || 0) >= (prev.paidAt || 0)) {
          map.set(key, r);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
  }, [salaryRecords]);

  /* ================= SALARY TABLE ROWS (COMBINES SAVED RECORDS + ACTIVE WORKERS DRAFT) ================= */
  const salaryTableRows = useMemo(() => {
    const isAllMonths = salaryMonthFilter === 'all';
    const targetMonth = isAllMonths ? (uniqueSalaryRecords[0]?.month || 'অক্টোবর') : salaryMonthFilter;
    const targetYear = salaryYearFilter === 'all' ? (uniqueSalaryRecords[0]?.year || 2026) : Number(salaryYearFilter);

    // 1. Gather saved records matching the selected month & year filter
    const savedMatching = uniqueSalaryRecords.filter((rec) => {
      if (!isAllMonths && rec.month !== targetMonth) return false;
      if (salaryYearFilter !== 'all' && Number(rec.year) !== targetYear) return false;
      return true;
    });

    const rows: (SalaryDisbursementRecord & { isDraft?: boolean })[] = [];
    const processedWorkerKeys = new Set<string>();

    savedMatching.forEach((rec) => {
      const key = `${(rec.workerId || rec.employeeId || '').toLowerCase()}_${rec.month}_${rec.year}`;
      if (!processedWorkerKeys.has(key)) {
        processedWorkerKeys.add(key);
        rows.push({ ...rec, isDraft: false });
      }
    });

    // 2. Also include active employees who don't have a saved record yet, UNLESS explicitly dismissed/deleted
    employees.forEach((emp) => {
      if (emp.status !== 'active') return;
      const key1 = `${(emp.workerId || '').toLowerCase()}_${targetMonth}_${targetYear}`;
      const key2 = `${(emp.id || '').toLowerCase()}_${targetMonth}_${targetYear}`;
      if (processedWorkerKeys.has(key1) || processedWorkerKeys.has(key2)) return;
      if (dismissedDraftKeys.has(key1) || dismissedDraftKeys.has(key2)) return;
      processedWorkerKeys.add(key1);

      const empJoinPolicy = getNewJoinerSalaryPolicy(emp.joinDate, targetMonth, targetYear);
      const isMidMonthJoiner = empJoinPolicy.isNewJoinerMidMonth;

      const attStats = calculateEmployeeAttendanceStats(
        emp.id,
        attendanceRecords,
        targetMonth,
        targetYear,
        emp.workerId,
        emp.name,
        emp.joinDate
      );

      const totalDays = 26;
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      if (isMidMonthJoiner) {
        presentDays = attStats.totalRecords > 0 
          ? attStats.presentCount 
          : Math.max(1, Math.min(totalDays, totalDays - empJoinPolicy.joinDay + 1));
        absentDays = 0;
        lateDays = 0;
      } else {
        presentDays = attStats.totalRecords > 0 ? attStats.presentCount : totalDays;
        absentDays = attStats.totalRecords > 0 ? attStats.absentCount : 0;
        lateDays = attStats.totalRecords > 0 ? attStats.lateCount : 0;
      }

      const { absentPenaltyDays, latePenaltyDays, totalPenaltyDays } = calculateCombinedPenaltyDays(absentDays, lateDays, isMidMonthJoiner);
      const effectivePresentDays = isMidMonthJoiner ? presentDays : Math.max(0, presentDays - totalPenaltyDays);
      const otHours = attStats.totalOtHours;
      const otRate = emp.otRate || (emp.salary ? Math.round((emp.salary / (26 * 8)) * 2) : 0);
      const otPay = Math.round(otHours * otRate);
      const attendanceBonus = isMidMonthJoiner
        ? 0
        : (attStats.totalRecords > 0 && absentDays === 0 && attStats.lateCount <= 2 ? 500 : 0);
      const presentSalary = Math.round((emp.salary / totalDays) * effectivePresentDays);
      const advance = 0;
      const deduction = 0;
      const netPayable = Math.max(0, Math.round(presentSalary + otPay + attendanceBonus - advance - deduction));

      rows.push({
        id: `sal_${emp.id}_${targetMonth}_${targetYear}`,
        employeeId: emp.id,
        employeeName: emp.name,
        workerId: emp.workerId,
        designation: emp.designation,
        department: emp.department || 'সাধারণ',
        month: targetMonth,
        year: targetYear,
        salary: emp.salary,
        presentDays,
        totalDays,
        absentDays,
        lateDays,
        absentPenaltyDays,
        latePenaltyDays,
        effectivePresentDays,
        presentSalary,
        otHours,
        otRate,
        otPay,
        bonus: attendanceBonus,
        advance,
        deduction,
        deductionReason: '',
        netPayable,
        paidAmount: 0,
        dueAmount: netPayable,
        paymentMethod: 'cash',
        paymentStatus: 'due',
        progressStatus: 'due',
        statusUpdatedAt: Date.now(),
        statusUpdatedDate: new Date().toISOString().split('T')[0],
        paidAt: Date.now(),
        note: '',
        isDraft: true,
      });
    });

    return rows;
  }, [uniqueSalaryRecords, employees, attendanceRecords, salaryMonthFilter, salaryYearFilter, dismissedDraftKeys]);

  /* ================= BULK UPDATE SALARY PROGRESS STATUS ================= */
  const handleBulkUpdateSalaryStatus = async (
    targetList: (SalaryDisbursementRecord & { isDraft?: boolean })[],
    newStatus: SalaryProgressStatus
  ) => {
    if (targetList.length === 0) {
      showToast('স্ট্যাটাস পরিবর্তন করার জন্য কোনো কর্মী পাওয়া যায়নি');
      return;
    }
    try {
      for (const rec of targetList) {
        await handleUpdateSalaryStatus(rec, newStatus);
      }
      const labels: Record<string, string> = {
        due: 'বাকী',
        calculating: 'বাকী',
        calculated: 'হিসাব সম্পূর্ণ',
        ready: 'বেতন দেওয়ার জন্য প্রস্তুত',
        disbursed: 'বেতন প্রদান করা সম্পূর্ণ',
      };
      showToast(`✓ প্রদর্শিত ${toBengaliNumber(targetList.length)} জন কর্মীর বেতন স্ট্যাটাস "${labels[newStatus]}" করা হয়েছে`);
    } catch (e) {
      showToast('স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে');
    }
  };

  const recordsInSelectedBatchMonth = useMemo(() => {
    return uniqueSalaryRecords.filter(
      (r) => r.month === batchDeleteMonth && Number(r.year) === Number(batchDeleteYear)
    );
  }, [uniqueSalaryRecords, batchDeleteMonth, batchDeleteYear]);

  // Auto-sync masterA4Month to the month that actually has salary records if current month has none
  useEffect(() => {
    if (uniqueSalaryRecords.length > 0) {
      const monthsWithRecords = new Set(uniqueSalaryRecords.map((r) => r.month));
      if (!monthsWithRecords.has(masterA4Month) && masterA4Month !== 'all') {
        const latestMonth = uniqueSalaryRecords[0]?.month;
        if (latestMonth) {
          setMasterA4Month(latestMonth);
        }
      }
    }
  }, [uniqueSalaryRecords, masterA4Month]);

  // When user filters by month in salary tab, keep Master A4 month aligned
  useEffect(() => {
    if (salaryMonthFilter !== 'all') {
      setMasterA4Month(salaryMonthFilter);
    }
  }, [salaryMonthFilter]);

  /* ================= EDIT WORKER'S SALARY HANDLERS ================= */
  const handleOpenEditSalaryRecord = (rec: SalaryDisbursementRecord) => {
    setEditingSalaryRecord(rec);
    setEditRecBasicSalary(rec.salary || 0);
    setEditRecTotalDays(rec.totalDays || 26);
    setEditRecPresentDays(rec.presentDays || 0);
    setEditRecAbsentDays(rec.absentDays ?? Math.max(0, (rec.totalDays || 26) - (rec.presentDays || 0)));
    setEditRecLateDays(rec.lateDays || 0);
    setEditRecOtHours(rec.otHours || 0);
    setEditRecOtRate(rec.otRate || 0);
    setEditRecBonus(rec.bonus || 0);
    setEditRecAdvance(rec.advance || 0);
    setEditRecDeduction(rec.deduction || 0);
    setEditRecDeductionReason(rec.deductionReason || '');
    setEditRecNetPayable(rec.netPayable || 0);
    setEditRecPaidAmount(rec.paidAmount || 0);
    setEditRecPaymentMethod(rec.paymentMethod || 'cash');
    setEditRecPaymentStatus(rec.paymentStatus || 'pending');
    setEditRecProgressStatus(rec.progressStatus || (rec.paymentStatus === 'paid' ? 'disbursed' : 'due'));
    setEditRecNote(rec.note || '');
  };

  const handleSaveEditedSalaryRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalaryRecord) return;
    setIsEditingSalarySaving(true);
    try {
      const emp = employees.find(
        (e) =>
          (e.id && e.id === editingSalaryRecord.employeeId) ||
          (e.workerId && e.workerId === editingSalaryRecord.workerId)
      );
      const joinPolicy = getNewJoinerSalaryPolicy(emp?.joinDate, editingSalaryRecord.month, editingSalaryRecord.year);
      const isMidMonthJoiner = Boolean(editingSalaryRecord.isNewJoinerMidMonth || joinPolicy.isNewJoinerMidMonth);

      const { absentPenaltyDays, latePenaltyDays, totalPenaltyDays } = calculateCombinedPenaltyDays(editRecAbsentDays, editRecLateDays, isMidMonthJoiner);
      const effectivePresentDays = isMidMonthJoiner ? editRecPresentDays : Math.max(0, editRecPresentDays - totalPenaltyDays);
      const presentSalary = editRecTotalDays > 0 ? Math.round((editRecBasicSalary / editRecTotalDays) * effectivePresentDays) : 0;
      const otPay = Math.round(editRecOtHours * editRecOtRate);
      const bonus = isMidMonthJoiner ? 0 : editRecBonus;

      const netPayable = editRecNetPayable > 0 
        ? editRecNetPayable 
        : Math.max(0, presentSalary + otPay + bonus - editRecAdvance - editRecDeduction);
      
      let paidAmount = editRecPaidAmount;
      let paymentStatus = editRecPaymentStatus;
      if (paymentStatus === 'paid') {
        paidAmount = netPayable;
      } else if (paidAmount >= netPayable && netPayable > 0) {
        paymentStatus = 'paid';
        paidAmount = netPayable;
      }
      const dueAmount = paymentStatus === 'paid' ? 0 : Math.max(0, netPayable - paidAmount);
      if (dueAmount === 0 && netPayable > 0) {
        paymentStatus = 'paid';
        paidAmount = netPayable;
      }

      const updatedRecord: SalaryDisbursementRecord = {
        ...editingSalaryRecord,
        salary: editRecBasicSalary,
        totalDays: editRecTotalDays,
        presentDays: editRecPresentDays,
        absentDays: editRecAbsentDays,
        lateDays: editRecLateDays,
        absentPenaltyDays,
        latePenaltyDays,
        effectivePresentDays,
        presentSalary,
        otHours: editRecOtHours,
        otRate: editRecOtRate,
        otPay,
        bonus: editRecBonus,
        advance: editRecAdvance,
        deduction: editRecDeduction,
        deductionReason: editRecDeductionReason,
        netPayable,
        paidAmount,
        dueAmount,
        paymentMethod: editRecPaymentMethod,
        paymentStatus,
        progressStatus: editRecProgressStatus,
        statusUpdatedAt: Date.now(),
        statusUpdatedDate: new Date().toISOString().split('T')[0],
        note: editRecNote,
        paidAt: Date.now(),
      };

      // Remove any dismissed draft key so this saved record remains visible
      const dKey1 = `${(editingSalaryRecord.workerId || '').toLowerCase()}_${editingSalaryRecord.month}_${editingSalaryRecord.year}`;
      const dKey2 = `${(editingSalaryRecord.employeeId || '').toLowerCase()}_${editingSalaryRecord.month}_${editingSalaryRecord.year}`;
      setDismissedDraftKeys((prev) => {
        const next = new Set(prev);
        if (dKey1) next.delete(dKey1);
        if (dKey2) next.delete(dKey2);
        try {
          localStorage.setItem('texware_dismissed_salary_drafts', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      const previousProgressStatus =
        editingSalaryRecord.progressStatus ||
        (editingSalaryRecord.paymentStatus === 'paid' ? 'disbursed' : 'due');
      const previousPaymentStatus = editingSalaryRecord.paymentStatus;

      await saveOrUpdateSalaryRecord(updatedRecord, editingSalaryRecord.id);

      if (
        updatedRecord.progressStatus !== previousProgressStatus ||
        updatedRecord.paymentStatus !== previousPaymentStatus
      ) {
        void (async () => {
          try {
            const activeTg =
              tgSettings?.botToken?.trim() && tgSettings?.chatId?.trim()
                ? tgSettings
                : await loadTelegramSettings();
            await sendSalaryStatusTelegramNotification({
              record: updatedRecord,
              previousStatus: previousProgressStatus,
              settings: activeTg,
              factoryName: factorySettings?.name,
            });
          } catch {}
        })();
      }

      showToast(`${editingSalaryRecord.employeeName}-এর বেতন হিসাব সফলভাবে আপডেট করা হয়েছে`);
      setEditingSalaryRecord(null);
    } catch (err) {
      console.error(err);
      showToast('বেতন হিসাব আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsEditingSalarySaving(false);
    }
  };

  /* ================= 1-CLICK MONTH BATCH DELETE HANDLER ================= */
  const handleExecuteBatchDeleteByMonth = async () => {
    setIsBatchDeleting(true);
    try {
      // Dismiss all drafts for this month/year so table becomes completely clean
      setDismissedDraftKeys((prev) => {
        const next = new Set(prev);
        employees.forEach((emp) => {
          next.add(`${(emp.workerId || '').toLowerCase()}_${batchDeleteMonth}_${batchDeleteYear}`);
          next.add(`${(emp.id || '').toLowerCase()}_${batchDeleteMonth}_${batchDeleteYear}`);
        });
        try {
          localStorage.setItem('texware_dismissed_salary_drafts', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      const deletedCount = await deleteSalaryRecordsByMonthYear(batchDeleteMonth, batchDeleteYear);
      setShowBatchDeleteModal(false);
      showToast(`✓ ${batchDeleteMonth} ${toBengaliNumber(batchDeleteYear)} সালের সকল বেতন রেকর্ড সফলভাবে মুছে ফেলা হয়েছে`);
    } catch (err) {
      showToast('হিসাব মুছতে সমস্যা হয়েছে');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  /* ================= 1-CLICK PURGE ALL SALARY HISTORY HANDLER ================= */
  const handleExecutePurgeAllHistory = async () => {
    setIsPurgingAllHistory(true);
    try {
      // Dismiss all drafts for all workers across months
      const allDraftKeys = new Set<string>();
      employees.forEach((emp) => {
        BENGALI_MONTHS.forEach((m) => {
          allDraftKeys.add(`${(emp.workerId || '').toLowerCase()}_${m}_2026`);
          allDraftKeys.add(`${(emp.id || '').toLowerCase()}_${m}_2026`);
          allDraftKeys.add(`${(emp.workerId || '').toLowerCase()}_${m}_2027`);
          allDraftKeys.add(`${(emp.id || '').toLowerCase()}_${m}_2027`);
        });
      });
      setDismissedDraftKeys(allDraftKeys);
      try {
        localStorage.setItem('texware_dismissed_salary_drafts', JSON.stringify(Array.from(allDraftKeys)));
      } catch {}

      const deletedCount = await purgeAllPastSalaryHistory();
      setShowPurgeAllHistoryModal(false);
      showToast(`✓ সকল শ্রমিকের পূর্ববর্তী বেতন প্রদান ও স্ট্যাটাস হিস্ট্রি সম্পূর্ণ মুছে ফেলা হয়েছে (${toBengaliNumber(deletedCount)} টি রেকর্ড অপসারিত)`);
    } catch (err) {
      console.error(err);
      showToast('বেতন হিস্ট্রি মুছতে সমস্যা হয়েছে');
    } finally {
      setIsPurgingAllHistory(false);
    }
  };

  /* ================= 1-CLICK GENERATE / PREPARE SALARY SHEET ================= */
  const handleGenerateSalarySheetForMonth = async (targetMonth: string, targetYear: number) => {
    // 1. Remove dismissed keys for this month & year
    setDismissedDraftKeys((prev) => {
      const next = new Set(prev);
      employees.forEach((emp) => {
        next.delete(`${(emp.workerId || '').toLowerCase()}_${targetMonth}_${targetYear}`);
        next.delete(`${(emp.id || '').toLowerCase()}_${targetMonth}_${targetYear}`);
      });
      try {
        localStorage.setItem('texware_dismissed_salary_drafts', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    let count = 0;
    for (const emp of activeEmployees) {
      const existing = uniqueSalaryRecords.find(
        (r) =>
          ((r.employeeId && r.employeeId === emp.id) || (r.workerId && r.workerId === emp.workerId)) &&
          r.month === targetMonth &&
          Number(r.year) === Number(targetYear)
      );
      if (!existing) {
        const attStats = calculateEmployeeAttendanceStats(
          emp.id,
          attendanceRecords,
          targetMonth,
          targetYear,
          emp.workerId,
          emp.name,
          emp.joinDate
        );
        const joinPolicy = getNewJoinerSalaryPolicy(emp.joinDate, targetMonth, targetYear);
        const isMidMonth = joinPolicy.isNewJoinerMidMonth;
        const totalDays = 26;
        const presentDays = isMidMonth
          ? (attStats.totalRecords > 0 ? attStats.presentCount : Math.max(1, totalDays - joinPolicy.joinDay + 1))
          : (attStats.totalRecords > 0 ? attStats.presentCount : totalDays);
        const absentDays = isMidMonth ? 0 : (attStats.totalRecords > 0 ? attStats.absentCount : 0);
        const lateDays = isMidMonth ? 0 : (attStats.totalRecords > 0 ? attStats.lateCount : 0);
        const { absentPenaltyDays: absentPenalty, latePenaltyDays: latePenalty, totalPenaltyDays } = calculateCombinedPenaltyDays(absentDays, lateDays, isMidMonth);
        const effectivePresent = isMidMonth ? presentDays : Math.max(0, presentDays - totalPenaltyDays);
        const otHours = attStats.totalOtHours;
        const otRate = emp.otRate || (emp.salary ? Math.round((emp.salary / (26 * 8)) * 2) : 0);
        const otPay = Math.round(otHours * otRate);
        const bonus = isMidMonth ? 0 : (attStats.totalRecords > 0 && absentDays === 0 && attStats.lateCount <= 2 ? 500 : 0);
        const presentSalary = Math.round((emp.salary / totalDays) * effectivePresent);
        const netPayable = Math.max(0, presentSalary + otPay + bonus);

        const recId = `sal_${emp.id}_${targetMonth}_${targetYear}`;
        const newRecord: SalaryDisbursementRecord = {
          id: recId,
          employeeId: emp.id,
          employeeName: emp.name,
          workerId: emp.workerId,
          designation: emp.designation,
          department: emp.department || 'সাধারণ',
          month: targetMonth,
          year: targetYear,
          salary: emp.salary,
          presentDays,
          totalDays,
          absentDays,
          lateDays,
          absentPenaltyDays: absentPenalty,
          latePenaltyDays: latePenalty,
          effectivePresentDays: effectivePresent,
          presentSalary,
          otHours,
          otRate,
          otPay,
          bonus,
          advance: 0,
          deduction: 0,
          deductionReason: '',
          netPayable,
          paidAmount: 0,
          dueAmount: netPayable,
          paymentMethod: 'cash',
          paymentStatus: 'due',
          progressStatus: 'due',
          statusUpdatedAt: Date.now(),
          statusUpdatedDate: new Date().toISOString().split('T')[0],
          paidAt: Date.now(),
          note: '',
        };
        await saveOrUpdateSalaryRecord(newRecord, recId);
        count++;
      }
    }
    showToast(`✓ ${targetMonth} ${toBengaliNumber(targetYear)} সালের ${toBengaliNumber(count || activeEmployees.length)} জন কর্মীর বেতন খাতা প্রস্তুত হয়েছে`);
  };

  /* ================= MASTER A4 PAYROLL & ATTENDANCE CALCULATIONS ================= */
  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach((e) => {
      if (e.department && e.department.trim()) {
        depts.add(e.department.trim());
      }
    });
    return Array.from(depts);
  }, [employees]);

  const masterA4Rows = useMemo(() => {
    const isAllMonths = masterA4Month === 'all';
    const targetMonth = masterA4Month;
    const targetYear = masterA4Year;

    const monthSavedRecords = uniqueSalaryRecords.filter((r) => {
      if (!isAllMonths && r.month !== targetMonth) return false;
      if (targetYear && Number(r.year) !== Number(targetYear)) return false;
      return true;
    });

    // If draft mode is off and no saved records exist for this month/year
    if (monthSavedRecords.length === 0 && !masterA4IncludeDraft) {
      return [];
    }

    // Build rows primarily from monthSavedRecords so that ALL calculated salary records in the salary book appear!
    const rows: any[] = [];
    const processedWorkerKeys = new Set<string>();

    monthSavedRecords.forEach((savedRec) => {
      // Find employee info if available
      const emp = employees.find(
        (e) =>
          (e.id && e.id === savedRec.employeeId) ||
          (e.workerId && e.workerId === savedRec.workerId) ||
          (e.name && e.name === savedRec.employeeName)
      );

      if (masterA4Status === 'active' && emp && emp.status !== 'active') return;
      if (masterA4Dept !== 'all') {
        const dept = savedRec.department || emp?.department || 'সাধারণ';
        if (dept !== masterA4Dept) return;
      }

      const key = `${savedRec.workerId || savedRec.employeeId}_${savedRec.month}_${savedRec.year}`;
      if (processedWorkerKeys.has(key)) return;
      processedWorkerKeys.add(key);

      const empJoinPolicy = getNewJoinerSalaryPolicy(emp?.joinDate, savedRec.month, savedRec.year);
      const isMidMonthJoiner = Boolean(savedRec.isNewJoinerMidMonth || empJoinPolicy.isNewJoinerMidMonth);

      const totalDays = savedRec.totalDays || masterTotalDays;
      const presentDays = savedRec.presentDays ?? 0;
      const absentDays = isMidMonthJoiner ? 0 : (savedRec.absentDays ?? Math.max(0, totalDays - presentDays));
      const lateDays = isMidMonthJoiner ? 0 : (savedRec.lateDays ?? 0);
      const { absentPenaltyDays: calcAbsentPenalty, latePenaltyDays: calcLatePenalty, totalPenaltyDays: calcTotalPenalty } =
        calculateCombinedPenaltyDays(absentDays, lateDays, isMidMonthJoiner);
      const absentPenaltyDays = isMidMonthJoiner ? 0 : (savedRec.absentPenaltyDays ?? calcAbsentPenalty);
      const latePenaltyDays = isMidMonthJoiner ? 0 : (savedRec.latePenaltyDays ?? calcLatePenalty);
      const effectivePresentDays = isMidMonthJoiner
        ? presentDays
        : (savedRec.effectivePresentDays ?? Math.max(0, presentDays - (absentPenaltyDays + latePenaltyDays)));
      const otHours = savedRec.otHours ?? 0;
      const otRate = savedRec.otRate || emp?.otRate || 0;
      const otPay = savedRec.otPay ?? 0;
      const attendanceBonus = isMidMonthJoiner ? 0 : (savedRec.bonus ?? 0);
      const presentSalary = savedRec.presentSalary ?? 0;
      const advance = savedRec.advance ?? 0;
      const deduction = savedRec.deduction ?? 0;
      const netPayable = savedRec.netPayable ?? 0;
      const isPaid = savedRec.paymentStatus === 'paid' || ((savedRec.paidAmount || 0) > 0 && (savedRec.paidAmount || 0) >= netPayable);
      const paidAmount = isPaid ? netPayable : (savedRec.paidAmount || 0);
      const dueAmount = isPaid ? 0 : (savedRec.dueAmount !== undefined ? savedRec.dueAmount : Math.max(0, netPayable - paidAmount));
      const paymentStatus = isPaid ? 'paid' : (dueAmount === 0 ? 'paid' : paidAmount > 0 ? 'pending' : 'due');
      const paymentMethod = savedRec.paymentMethod || 'cash';

      rows.push({
        sl: rows.length + 1,
        employeeId: savedRec.employeeId || emp?.id || '',
        workerId: savedRec.workerId || emp?.workerId || '—',
        name: savedRec.employeeName || emp?.name || '—',
        designation: savedRec.designation || emp?.designation || '—',
        department: savedRec.department || emp?.department || 'সাধারণ',
        basicSalary: savedRec.salary || emp?.salary || 0,
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        absentPenaltyDays,
        latePenaltyDays,
        effectivePresentDays,
        otHours,
        otRate,
        otPay,
        attendanceBonus,
        presentSalary,
        advance,
        deduction,
        netPayable,
        paidAmount,
        dueAmount,
        paymentStatus,
        paymentMethod,
        isSavedRecord: true,
      });
    });

    // If draft mode is enabled, add remaining active employees who don't have a saved record
    if (masterA4IncludeDraft) {
      employees.forEach((emp) => {
        const key = `${emp.workerId || emp.id}_${masterA4Month}_${targetYear}`;
        if (processedWorkerKeys.has(key)) return;
        if (masterA4Status === 'active' && emp.status !== 'active') return;
        if (masterA4Dept !== 'all' && emp.department !== masterA4Dept) return;

        processedWorkerKeys.add(key);
        const draftMonth = isAllMonths ? BENGALI_MONTHS[new Date().getMonth()] : targetMonth;
        const empJoinPolicy = getNewJoinerSalaryPolicy(emp.joinDate, draftMonth, targetYear);
        const isMidMonthJoiner = empJoinPolicy.isNewJoinerMidMonth;

        const attStats = calculateEmployeeAttendanceStats(
          emp.id,
          attendanceRecords,
          draftMonth,
          targetYear,
          emp.workerId,
          emp.name,
          emp.joinDate
        );
        const totalDays = masterTotalDays;
        let presentDays = 0;
        let absentDays = 0;
        let lateDays = 0;
        if (isMidMonthJoiner) {
          presentDays = attStats.totalRecords > 0 
            ? attStats.presentCount 
            : Math.max(1, Math.min(totalDays, totalDays - empJoinPolicy.joinDay + 1));
          absentDays = 0;
          lateDays = 0;
        } else {
          presentDays = attStats.totalRecords > 0 ? attStats.presentCount : totalDays;
          absentDays = attStats.totalRecords > 0 ? attStats.absentCount : 0;
          lateDays = attStats.totalRecords > 0 ? attStats.lateCount : 0;
        }

        const { absentPenaltyDays, latePenaltyDays, totalPenaltyDays } = calculateCombinedPenaltyDays(absentDays, lateDays, isMidMonthJoiner);
        const effectivePresentDays = isMidMonthJoiner ? presentDays : Math.max(0, presentDays - totalPenaltyDays);
        const otHours = attStats.totalOtHours;
        const otRate = emp.otRate || (emp.salary ? Math.round((emp.salary / (26 * 8)) * 2) : 0);
        const otPay = Math.round(otHours * otRate);
        const attendanceBonus = isMidMonthJoiner
          ? 0
          : (attStats.totalRecords > 0 && absentDays === 0 && attStats.lateCount <= 2 ? masterDefaultBonus : 0);
        const presentSalary = Math.round((emp.salary / totalDays) * effectivePresentDays);
        const advance = 0;
        const deduction = 0;
        const netPayable = Math.max(0, Math.round(presentSalary + otPay + attendanceBonus - advance - deduction));
        const paidAmount = 0;
        const dueAmount = netPayable;
        const paymentStatus: 'due' | 'paid' | 'pending' = 'due';

        rows.push({
          sl: rows.length + 1,
          employeeId: emp.id,
          workerId: emp.workerId,
          name: emp.name,
          designation: emp.designation,
          department: emp.department || 'সাধারণ',
          basicSalary: emp.salary,
          totalDays,
          presentDays,
          absentDays,
          lateDays,
          absentPenaltyDays,
          latePenaltyDays,
          effectivePresentDays,
          otHours,
          otRate,
          otPay,
          attendanceBonus,
          presentSalary,
          advance,
          deduction,
          netPayable,
          paidAmount,
          dueAmount,
          paymentStatus,
          paymentMethod: 'cash' as PaymentMethod,
          isSavedRecord: false,
        });
      });
    }

    return rows;
  }, [
    employees,
    uniqueSalaryRecords,
    attendanceRecords,
    masterA4Month,
    masterA4Year,
    masterA4Dept,
    masterA4Status,
    masterTotalDays,
    masterDefaultBonus,
    masterA4IncludeDraft,
  ]);

  const masterTotals = useMemo(() => {
    return masterA4Rows.reduce(
      (acc, r) => ({
        workersCount: acc.workersCount + 1,
        totalBasicSalary: acc.totalBasicSalary + r.basicSalary,
        totalPresentDays: acc.totalPresentDays + r.presentDays,
        totalAbsentDays: acc.totalAbsentDays + r.absentDays,
        totalLateDays: acc.totalLateDays + (r.lateDays || 0),
        totalAbsentPenaltyDays: acc.totalAbsentPenaltyDays + (r.absentPenaltyDays || 0),
        totalLatePenaltyDays: acc.totalLatePenaltyDays + (r.latePenaltyDays || 0),
        totalEffectivePresentDays: acc.totalEffectivePresentDays + (r.effectivePresentDays || 0),
        totalOtHours: acc.totalOtHours + r.otHours,
        totalOtPay: acc.totalOtPay + r.otPay,
        totalBonus: acc.totalBonus + r.attendanceBonus,
        totalPresentSalary: acc.totalPresentSalary + r.presentSalary,
        totalAdvance: acc.totalAdvance + r.advance,
        totalDeduction: acc.totalDeduction + r.deduction,
        totalNetPayable: acc.totalNetPayable + r.netPayable,
        totalPaid: acc.totalPaid + r.paidAmount,
        totalDue: acc.totalDue + r.dueAmount,
      }),
      {
        workersCount: 0,
        totalBasicSalary: 0,
        totalPresentDays: 0,
        totalAbsentDays: 0,
        totalLateDays: 0,
        totalAbsentPenaltyDays: 0,
        totalLatePenaltyDays: 0,
        totalEffectivePresentDays: 0,
        totalOtHours: 0,
        totalOtPay: 0,
        totalBonus: 0,
        totalPresentSalary: 0,
        totalAdvance: 0,
        totalDeduction: 0,
        totalNetPayable: 0,
        totalPaid: 0,
        totalDue: 0,
      }
    );
  }, [masterA4Rows]);

  const handlePrintMasterA4Sheet = () => {
    if (!masterA4SheetPrintRef.current) {
      window.print();
      return;
    }
    const result = printElement(
      masterA4SheetPrintRef.current,
      `Master_Payroll_Attendance_${masterA4Month}_${masterA4Year}`,
      'landscape'
    );
    if (result.isTelegram) {
      setTelegramPrintModalTitle(`A4 মাস্টার বেতন ও হাজিরা শিট (${masterA4Month} ${masterA4Year})`);
    }
  };

  const handleCopyEmployee = async (emp: Employee) => {
    const text = `
টেক্স ওয়ার অ্যাপারেলস - কর্মচারীর প্রোফাইল
---------------------------------------
নাম: ${emp.name}
Worker ID: ${emp.workerId}
পদবি: ${emp.designation} (${emp.department || 'সাধারণ'})
স্ট্যাটাস: ${emp.status === 'resigned' ? 'পদত্যাগকৃত (Resigned)' : 'কর্মরত (Active)'}
${emp.resignationDate ? `রিজাইন তারিখ: ${formatDateBn(emp.resignationDate)}\nরিজাইনের কারণ: ${emp.resignationReason || '—'}\n` : ''}
মাসিক বেতন: ${formatMoney(emp.salary)} ৳
প্রতি ঘণ্টা OT: ${formatMoney(emp.otRate)} ৳
যোগদানের তারিখ: ${formatDateBn(emp.joinDate)}
জন্ম তারিখ: ${formatDateBn(emp.birthDate)}
মোবাইল: ${emp.mobile || '—'}
NID: ${emp.nid || '—'}
ঠিকানা: ${emp.address || '—'}
    `.trim();

    try {
      await navigator.clipboard.writeText(text);
      showToast(`"${emp.name}" এর তথ্য কপি হয়েছে`);
    } catch (e) {
      showToast('কপি করতে সমস্যা হয়েছে');
    }
  };

  /* ================= TELEGRAM HANDLERS ================= */
  const handleSaveTelegram = async () => {
    if (!tgSettings.botToken.trim() || !tgSettings.chatId.trim()) {
      showToast('Bot Token এবং Chat ID লিখুন');
      return;
    }
    await saveTelegramSettings(tgSettings);
    showToast('Telegram সেটিংস সংরক্ষিত হয়েছে');
  };

  const handleTestTelegram = async () => {
    if (!tgSettings.botToken.trim() || !tgSettings.chatId.trim()) {
      showToast('আগে Telegram Token ও Chat ID দিন');
      return;
    }
    try {
      setTgTesting(true);
      const url = `https://api.telegram.org/bot${encodeURIComponent(tgSettings.botToken.trim())}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgSettings.chatId.trim(),
          text: `🔔 টেক্স ওয়ার অ্যাপারেলস (TexWare Apparels)\nTelegram Notification টেস্ট সফল হয়েছে।\nসময়: ${new Date().toLocaleString('bn-BD')}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await saveTelegramSettings(tgSettings);
        showToast('✓ Telegram টেস্ট মেসেজ সফলভাবে গেছে');
      } else {
        showToast(`Telegram টেস্ট ব্যর্থ: ${data.description || 'ভুল Token/Chat ID'}`);
      }
    } catch (err: any) {
      showToast('Telegram সংযোগ ব্যর্থ। ইন্টারনেট বা Token পরীক্ষা করুন।');
    } finally {
      setTgTesting(false);
    }
  };

  /* ================= SMS HANDLERS ================= */
  const handleSaveSmsSettings = async () => {
    if (!smsSettings.apiUrl.trim()) {
      showToast('SMS API URL লিখুন');
      return;
    }
    await saveSMSSettings(smsSettings);
    showToast('SMS API সেটিংস সংরক্ষিত হয়েছে');
  };

  const handleSendSingleSMS = async () => {
    const target = employees.find((e) => e.id === singleSmsEmpId);
    if (!target) {
      showToast('অনুগ্রহ করে একজন শ্রমিক নির্বাচন করুন');
      return;
    }
    if (!target.mobile) {
      showToast('এই শ্রমিকের মোবাইল নম্বর রেকর্ড করা নেই');
      return;
    }
    if (!singleSmsMsg.trim()) {
      showToast('মেসেজ লিখুন');
      return;
    }

    try {
      setIsSendingSms(true);
      const normalizedMobile = target.mobile.replace(/\D/g, '');
      const numberFormatted = normalizedMobile.startsWith('880')
        ? normalizedMobile
        : normalizedMobile.startsWith('01')
        ? '88' + normalizedMobile
        : normalizedMobile;

      const params = new URLSearchParams();
      params.set(smsSettings.keyParam || 'api_key', smsSettings.apiKey || '');
      params.set(smsSettings.mobileParam || 'number', numberFormatted);
      params.set(smsSettings.messageParam || 'message', singleSmsMsg.trim());
      if (smsSettings.senderId) {
        params.set(smsSettings.senderParam || 'senderid', smsSettings.senderId);
      }

      let res;
      if (smsSettings.method === 'POST') {
        res = await fetch(smsSettings.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
      } else {
        const sep = smsSettings.apiUrl.includes('?') ? '&' : '?';
        res = await fetch(`${smsSettings.apiUrl}${sep}${params.toString()}`);
      }

      const txt = await res.text();
      showToast(`SMS পাঠানোর অনুরোধ সম্পন্ন: ${txt.substring(0, 35)}`);
      setSingleSmsMsg('');
    } catch (err: any) {
      showToast(`SMS পাঠানো যায়নি: ${err.message || 'API Error'}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleSendBulkSMS = async () => {
    if (selectedBulkEmpIds.length === 0) {
      showToast('কমপক্ষে একজন শ্রমিক নির্বাচন করুন');
      return;
    }
    if (!bulkSmsMsg.trim()) {
      showToast('নোটিশ / মেসেজ লিখুন');
      return;
    }
    if (!confirm(`${selectedBulkEmpIds.length} জন শ্রমিককে এই SMS পাঠানো হবে। চালিয়ে যাবেন?`)) {
      return;
    }

    setIsSendingSms(true);
    let success = 0;
    let failed = 0;

    for (const empId of selectedBulkEmpIds) {
      const emp = employees.find((e) => e.id === empId);
      if (!emp || !emp.mobile) {
        failed++;
        continue;
      }
      try {
        const normalized = emp.mobile.replace(/\D/g, '');
        const numberFormatted = normalized.startsWith('880')
          ? normalized
          : normalized.startsWith('01')
          ? '88' + normalized
          : normalized;

        const params = new URLSearchParams();
        params.set(smsSettings.keyParam || 'api_key', smsSettings.apiKey || '');
        params.set(smsSettings.mobileParam || 'number', numberFormatted);
        params.set(smsSettings.messageParam || 'message', bulkSmsMsg.trim());
        if (smsSettings.senderId) {
          params.set(smsSettings.senderParam || 'senderid', smsSettings.senderId);
        }

        if (smsSettings.method === 'POST') {
          await fetch(smsSettings.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });
        } else {
          const sep = smsSettings.apiUrl.includes('?') ? '&' : '?';
          await fetch(`${smsSettings.apiUrl}${sep}${params.toString()}`);
        }
        success++;
        await new Promise((r) => setTimeout(r, 250));
      } catch (e) {
        failed++;
      }
    }

    setIsSendingSms(false);
    showToast(`Bulk SMS ফলাফল: সফল ${success}, ব্যর্থ ${failed}`);
  };

  /* ================= PASSWORD CHANGE HANDLER ================= */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const activePass = (adminSecurity.adminPassword || localStorage.getItem('texware_admin_password') || '123456').trim();
    if (oldPassword.trim() !== activePass) {
      showToast('বর্তমান পাসওয়ার্ড সঠিক নয়');
      return;
    }
    if (newPassword.trim().length < 6) {
      showToast('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      showToast('নতুন উভয় পাসওয়ার্ড মিলছে না');
      return;
    }

    try {
      await saveAdminSecurity(newPassword.trim(), false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('✓ Admin পাসওয়ার্ড ক্লাউড ডেটাবেজে সফলভাবে সংরক্ষিত হয়েছে! এখন যে কাউকে লিংক দিলেও আপনার দেওয়া নতুন পাসওয়ার্ড ছাড়া কেউ ১২৩৪৫৬ দিয়ে প্রবেশ করতে পারবে না।');
    } catch {
      showToast('পাসওয়ার্ড ক্লাউডে সংরক্ষণ করতে সমস্যা হয়েছে');
    }
  };

  /* ================= 4 DEDICATED SECTIONS & REINSTATE ================= */
  const activeEmployees = useMemo(() => employees.filter((e) => e.status === 'active'), [employees]);
  const resignedEmployees = useMemo(() => employees.filter((e) => e.status === 'resigned'), [employees]);
  const suspendedEmployees = useMemo(() => employees.filter((e) => e.status === 'suspended'), [employees]);
  const terminatedEmployees = useMemo(() => employees.filter((e) => e.status === 'terminated'), [employees]);

  const handleReinstateEmployee = async (emp: Employee) => {
    try {
      await updateResignationStatus(emp.id, {
        status: 'active',
        statusChangedAt: Date.now(),
        resignationDate: '',
        resignationReason: '',
        noticeServed: 'no',
        suspensionDate: '',
        suspensionReason: '',
        suspensionDuration: '',
        terminationDate: '',
        terminationReason: '',
        terminationMemo: '',
        clearanceDone: false,
        finalSettlementPaid: false,
        finalSettlementNote: '',
      });
      showToast(`✓ "${emp.name}" কে পুনরায় সফলভাবে সক্রিয় (Active) করা হয়েছে`);
    } catch (e) {
      showToast('স্ট্যাটাস সক্রিয় করা সম্ভব হয়নি');
    }
  };

  /* ================= FILTERED EMPLOYEES ================= */
  const filteredEmployees = employees.filter((emp) => {
    if (statusFilter === 'active' && emp.status !== 'active') return false;
    if (statusFilter === 'resigned' && emp.status !== 'resigned') return false;
    if (statusFilter === 'suspended' && (emp.status === 'active' || emp.status === 'resigned')) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.workerId.toLowerCase().includes(q) ||
      (emp.mobile && emp.mobile.includes(q)) ||
      emp.designation.toLowerCase().includes(q) ||
      (emp.department && emp.department.toLowerCase().includes(q))
    );
  });

  const activeWorkingEmployees = employees.filter((e) => e.status === 'active');
  const selectedDetailEmp =
    (detailSelectedId && activeWorkingEmployees.find((e) => e.id === detailSelectedId)) ||
    activeWorkingEmployees[0] ||
    employees.find((e) => e.id === detailSelectedId) ||
    employees[0] ||
    null;

  /* ================= LOGIN & FIRST TIME SCREENS ================= */
  if (!isLoggedIn) {
    const isCustomSet = !adminSecurity.isDefaultPassword;
    const showSetupScreen = !hasPasswordSet && !isCustomSet;

    return (
      <div className="min-h-[calc(100vh-8.5rem)] flex items-center justify-center p-2">
        <div className="bg-white rounded-xl p-6 border border-slate-200/90 w-full max-w-md mx-auto text-center relative shadow-xs">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="আগের পেজে ফিরে যান"
              className="absolute left-4 top-4 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>ফিরে যান</span>
            </button>
          )}
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-300 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-base font-extrabold text-slate-950 tracking-tight">অ্যাডমিন কন্ট্রোল প্যানেল</h2>
          <p className="text-[11.5px] text-slate-500 mt-0.5 mb-5">
            টেক্স ওয়ার অ্যাপারেলস · শুধুমাত্র অনুমোদিত এইচআর ও অ্যাডমিনদের জন্য
          </p>

          {showSetupScreen ? (
            <form onSubmit={handleFirstTimeSetup} className="space-y-3.5 text-left">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                <b className="text-slate-900 block mb-0.5">প্রথমবার Admin পাসওয়ার্ড সেট করুন</b>
                নিরাপত্তার স্বার্থে আপনার পছন্দমতো একটি শক্তিশালী পাসওয়ার্ড নির্ধারণ করুন।
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নতুন Admin পাসওয়ার্ড *
                </label>
                <input
                  type="password"
                  required
                  value={firstPass}
                  onChange={(e) => setFirstPass(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর বা সংখ্যা"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-600 focus:border-teal-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পাসওয়ার্ড নিশ্চিত করুন *
                </label>
                <input
                  type="password"
                  required
                  value={firstPassConfirm}
                  onChange={(e) => setFirstPassConfirm(e.target.value)}
                  placeholder="পাসওয়ার্ডটি আবার লিখুন"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-600 focus:border-teal-600 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                পাসওয়ার্ড সেট করে প্রবেশ করুন
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10.5px] text-slate-400">অথবা</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={handleQuickSetupDefault}
                className="w-full py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
              >
                ডিফল্ট পাসওয়ার্ড (123456) দিয়ে প্রবেশ করুন
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3.5 text-left">
              {isCustomSet && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>ক্লাউড সিকিউরিটি সক্রিয়। নির্ধারিত অ্যাডমিন পাসওয়ার্ড দিয়ে লগইন করুন।</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Password *
                </label>
                <div className="relative">
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="আপনার Admin পাসওয়ার্ড দিন"
                    className="w-full py-2.5 pl-3 pr-10 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-600 focus:border-teal-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                লগইন করুন
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  /* ================= ADMIN LOGGED IN DASHBOARD ================= */
  return (
    <div className="space-y-3">
      {/* Sub Menu Tabs Strip: Crisp Enterprise Segmented Strip + Back Icon */}
      <div className="bg-slate-100/90 rounded-xl p-1 border border-slate-200/90 flex items-stretch gap-1.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            title="আগের ফাংশন বা ড্যাশবোর্ডে ফিরে যান"
            className="px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-1">
          {/* ১. কর্মী ব্যবস্থাপনা */}
          <button
            type="button"
            id="tabAdminWorkers"
            onClick={() => handleTabChange('list')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'list' || activeTab === 'resignation'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <Users className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'list' || activeTab === 'resignation' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>১. কর্মী তালিকা</span>
          </button>

          {/* ২. হাজিরা ও টাইম */}
          <button
            type="button"
            id="tabAdminAttendance"
            onClick={() => handleTabChange('attendance')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'attendance'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'attendance' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>২. হাজিরা</span>
          </button>

          {/* ৩. বেতন খাতা */}
          <button
            type="button"
            id="tabAdminSalaries"
            onClick={() => handleTabChange('salaries')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'salaries'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <Receipt className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'salaries' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>৩. বেতন খাতা</span>
          </button>

          {/* ৪. নতুন কর্মী নিবন্ধন */}
          <button
            type="button"
            id="tabAdminNewWorker"
            onClick={() => {
              resetForm();
              handleTabChange('form');
            }}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'form'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <UserPlus className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'form' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>{editId ? '৪. এডিট কর্মী' : '৪. নতুন কর্মী'}</span>
          </button>

          {/* ৫. Telegram Bot */}
          <button
            type="button"
            id="tabAdminTelegram"
            onClick={() => handleTabChange('telegram')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'telegram'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <Send className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'telegram' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>৫. Telegram Bot</span>
          </button>

          {/* ৬. Auto SMS */}
          <button
            type="button"
            id="tabAdminSms"
            onClick={() => handleTabChange('sms')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'sms'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'sms' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>৬. Auto SMS</span>
          </button>

          {/* ৭. পাসওয়ার্ড */}
          <button
            type="button"
            id="tabAdminPassword"
            onClick={() => handleTabChange('password')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'password'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <KeyRound className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'password' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>৭. পাসওয়ার্ড</span>
          </button>

          {/* ৮. প্রোফাইল ও প্রিন্ট */}
          <button
            type="button"
            id="tabAdminDetails"
            onClick={() => handleTabChange('details')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'details'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <IdCard className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'details' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>৮. প্রোফাইল</span>
          </button>

          {/* ৯. কারখানা তথ্য ও চুক্তি সেটিংস */}
          <button
            type="button"
            id="tabAdminFactory"
            onClick={() => handleTabChange('factory')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'factory'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <Building2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'factory' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>৯. কারখানা তথ্য</span>
          </button>

          {/* ১০. আবেদন ফরম / পেন্ডিং আবেদন */}
          <button
            type="button"
            id="tabAdminApplications"
            onClick={() => handleTabChange('applications')}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11.5px] whitespace-nowrap shrink-0 ${
              activeTab === 'applications'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'applications' ? 'text-teal-300' : 'text-slate-400'}`} />
            <span>১০. আবেদন ফরম</span>
            {pendingAppsCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-400 text-slate-950 ml-0.5 tabular-nums">
                {pendingAppsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ================= TAB 1 & 2: 4-SECTION EMPLOYEE MANAGEMENT HUB ================= */}
      {(activeTab === 'list' || activeTab === 'resignation') && (
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 space-y-3">
          {/* 4 Dedicated Sections Navigation Bar */}
          <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Users className="w-4 h-4 text-teal-700" />
                <span>শ্রমিক ব্যবস্থাপনা</span>
                <span className="text-slate-300 font-normal">·</span>
                <span className="text-xs text-slate-500 font-medium tabular-nums">
                  মোট <b className="font-mono text-slate-900">{employees.length}</b> জন
                </span>
              </div>

              {/* Quick Worker Cancellation & Status Picker and Login list button */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowAllWorkersLoginModal(true)}
                  className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  title="সকল শ্রমিকের ব্যক্তিগত প্রোফাইল লিংক ও পাসওয়ার্ড তালিকা দেখুন"
                >
                  <Key className="w-3.5 h-3.5 text-teal-300" />
                  <span>লগইন লিংক ও পাসওয়ার্ড তালিকা</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNoticeTargetEmp(null);
                    setNoticeModalOpen(true);
                  }}
                  className="py-1.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  title="শ্রমিকদের এক সাথে বা আলাদা আলাদা নোটিশ প্রদান ও নোটিশ বোর্ড পরিচালনা"
                >
                  <Bell className="w-3.5 h-3.5 text-teal-100" />
                  <span>নোটিশ পাঠান (নোটিশ বোর্ড)</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      window.confirm(
                        'আপনি কি নিশ্চিত যে কারখানার সকল ডেমো কর্মী মুছে ফেলতে চান? এতে কারখানা সম্পূর্ণ ফ্রেশ হয়ে যাবে এবং শুধুমাত্র আপনার নিজস্ব যুক্ত করা প্রকৃত কর্মীদের ডাটা ও হিসাব নিখুঁতভাবে সংরক্ষিত থাকবে।'
                      )
                    ) {
                      const count = await clearAllDemoEmployees();
                      if (count > 0) {
                        showToast(`✓ সফল হয়েছে: ${count} জন ডেমো কর্মী সম্পূর্ণভাবে মুছে ফেলা হয়েছে!`);
                      } else {
                        showToast('কারখানায় কোনো ডেমো কর্মী অবশিষ্ট নেই, সবই বাস্তব ও সক্রিয় কর্মী।');
                      }
                    }
                  }}
                  className="py-1.5 px-3 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  title="কারখানার ডেমো কর্মী মুছে ফেলুন যাতে কোনো ডেমো ডাটা না থাকে"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>ডেমো কর্মী মুছুন</span>
                </button>

                <select
                  aria-label="শ্রমিকের স্ট্যাটাস বা সেকশন নির্বাচন করুন"
                  className="py-1.5 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer focus:ring-2 focus:ring-teal-600 outline-none"
                  onChange={(e) => {
                    const target = employees.find((emp) => emp.id === e.target.value);
                    if (target) {
                      onOpenResignationModal(target);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    শ্রমিকের স্ট্যাটাস / বাতিল করুন...
                  </option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.workerId}) — [{
                        emp.status === 'active'
                          ? 'কর্মরত'
                          : emp.status === 'resigned'
                          ? 'রিজাইনকৃত'
                          : emp.status === 'suspended'
                          ? 'স্থগিত'
                          : 'বরখাস্ত'
                      }]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Dedicated Section Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEmployeeSectionTab('active')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  employeeSectionTab === 'active'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${employeeSectionTab === 'active' ? 'text-emerald-200' : 'text-emerald-600'}`} />
                <span className="tabular-nums">১. কর্মরত / সক্রিয় ({activeEmployees.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setEmployeeSectionTab('resigned')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  employeeSectionTab === 'resigned'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <UserX className={`w-3.5 h-3.5 ${employeeSectionTab === 'resigned' ? 'text-rose-200' : 'text-rose-600'}`} />
                <span className="tabular-nums">২. পদত্যাগ / রিজাইন ({resignedEmployees.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setEmployeeSectionTab('suspended')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  employeeSectionTab === 'suspended'
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${employeeSectionTab === 'suspended' ? 'text-amber-200' : 'text-amber-600'}`} />
                <span className="tabular-nums">৩. সাময়িক স্থগিত ({suspendedEmployees.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setEmployeeSectionTab('terminated')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  employeeSectionTab === 'terminated'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${employeeSectionTab === 'terminated' ? 'text-slate-300' : 'text-slate-500'}`} />
                <span className="tabular-nums">৪. বরখাস্ত / অব্যাহতি ({terminatedEmployees.length})</span>
              </button>
            </div>
          </div>

          {/* Compact Search Bar + Concise 1-Line Section Context */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="এই সেকশনে নাম / Worker ID / পদবি / মোবাইল / সেকশন দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-600 focus:border-teal-600 outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2 pointer-events-none" />
            </div>
            <div className="text-[11.5px] font-medium text-slate-600 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0 tabular-nums">
              {employeeSectionTab === 'active'
                ? `কর্মরত / সক্রিয় সেকশন: ${activeEmployees.length} জন`
                : employeeSectionTab === 'resigned'
                ? `পদত্যাগ / রিজাইনকৃত সেকশন: ${resignedEmployees.length} জন`
                : employeeSectionTab === 'suspended'
                ? `সাময়িক স্থগিতকৃত সেকশন: ${suspendedEmployees.length} জন`
                : `অব্যাহতি ও বরখাস্ত সেকশন: ${terminatedEmployees.length} জন`}
            </div>
          </div>

          {/* Cards List inside Bounded Single-Viewport Container (No Outer Page Scroll) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 lg:max-h-[calc(100vh-20.5rem)] lg:overflow-y-auto enterprise-scroll pr-1 items-start">
            {(() => {
              const currentList =
                employeeSectionTab === 'active'
                  ? activeEmployees
                  : employeeSectionTab === 'resigned'
                  ? resignedEmployees
                  : employeeSectionTab === 'suspended'
                  ? suspendedEmployees
                  : terminatedEmployees;

              const filteredCurrentList = currentList.filter((emp) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return (
                  emp.name.toLowerCase().includes(q) ||
                  emp.workerId.toLowerCase().includes(q) ||
                  (emp.mobile && emp.mobile.includes(q)) ||
                  emp.designation.toLowerCase().includes(q) ||
                  (emp.department && emp.department.toLowerCase().includes(q)) ||
                  (emp.resignationReason && emp.resignationReason.toLowerCase().includes(q)) ||
                  (emp.suspensionReason && emp.suspensionReason.toLowerCase().includes(q)) ||
                  (emp.terminationReason && emp.terminationReason.toLowerCase().includes(q))
                );
              });

              if (filteredCurrentList.length === 0) {
                return (
                  <div className="xl:col-span-2 py-10 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                    <p className="font-bold text-slate-600">
                      {employeeSectionTab === 'active'
                        ? 'কোনো সক্রিয় কর্মচারী পাওয়া যায়নি'
                        : employeeSectionTab === 'resigned'
                        ? 'বর্তমানে কোনো পদত্যাগকৃত কর্মচারী নেই'
                        : employeeSectionTab === 'suspended'
                        ? 'বর্তমানে কোনো সাময়িক স্থগিতকৃত কর্মচারী নেই'
                        : 'বর্তমানে কোনো বরখাস্তকৃত কর্মচারী নেই'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      উপরে থাকা "যেকোনো শ্রমিকের স্ট্যাটাস / বাতিল করুন" ড্রপডাউন থেকে কর্মী নির্বাচন করে এই সেকশনে যুক্ত করতে পারেন।
                    </p>
                  </div>
                );
              }

              return filteredCurrentList.map((emp) => {
                const badge = getStatusBadge(emp.status);
                return (
                  <div
                    key={emp.id}
                    className="p-3.5 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {emp.photoUrl ? (
                        <img
                          src={emp.photoUrl}
                          alt={emp.name}
                          className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border ${
                          emp.status === 'active'
                            ? 'bg-slate-900 text-teal-300 border-slate-900'
                            : emp.status === 'resigned'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : emp.status === 'suspended'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {emp.name.charAt(0)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-sm text-slate-950 truncate">{emp.name}</span>
                            <span className={`text-[10.5px] font-semibold ${
                              emp.status === 'active'
                                ? 'text-emerald-700'
                                : emp.status === 'resigned'
                                ? 'text-rose-700'
                                : emp.status === 'suspended'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}>
                              · {badge.label}
                            </span>
                            {emp.isBlocked && (
                              <span className="text-[10px] font-semibold text-red-700 flex items-center gap-1">
                                <Ban className="w-3 h-3 text-red-600" />
                                <span>ব্লক করা</span>
                              </span>
                            )}
                          </div>

                          <span className="text-[11.5px] font-mono font-bold text-slate-900 tabular-nums shrink-0">
                            ৳{formatMoney(emp.salary)} <span className="text-slate-400 font-normal">| OT ৳{formatMoney(emp.otRate)}</span>
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-slate-700">{emp.workerId}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-700">{emp.designation}</span>
                          {emp.department && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{emp.department}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{emp.mobile || 'নেই'}</span>
                        </div>

                        {/* RESIGNED SPECIFIC METADATA */}
                        {emp.status === 'resigned' && (
                          <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px] space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span>
                                <b>পদত্যাগ তারিখ:</b> {formatDateBn(emp.resignationDate)} |{' '}
                                <b>নোটিশ:</b>{' '}
                                {emp.noticeServed === 'yes'
                                  ? 'সম্পূর্ণ দিয়েছে'
                                  : emp.noticeServed === 'partial'
                                  ? 'আংশিক'
                                  : 'দেয়নি'}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {emp.finalSettlementPaid ? (
                                  <b className="text-emerald-700">[✓ চূড়ান্ত নিষ্পত্তি সম্পন্ন]</b>
                                ) : (
                                  <b className="text-amber-700">[⏳ চূড়ান্ত দেনা-পাওনা বাকি]</b>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResignationLetterModalEmp(emp);
                                    onOpenResignationLetter?.(emp);
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer transition shadow-2xs active:scale-95"
                                  title="১-ক্লিকে এই শ্রমিকের তথ্যাবলিসহ পদত্যাগ ফরম প্রিন্ট করুন"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>১-ক্লিক রিজাইন ফরম প্রিন্ট</span>
                                </button>
                              </div>
                            </div>
                            <div>
                              <b>পদত্যাগের কারণ:</b> {emp.resignationReason || 'কারণ উল্লেখ নেই'}
                            </div>
                            {emp.finalSettlementNote && (
                              <div className="text-slate-600 italic">
                                নোট: {emp.finalSettlementNote}
                              </div>
                            )}
                          </div>
                        )}

                        {/* SUSPENDED SPECIFIC METADATA */}
                        {emp.status === 'suspended' && (
                          <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-[11px] space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span>
                                <b>স্থগিতাদেশ তারিখ:</b> {formatDateBn(emp.suspensionDate || emp.resignationDate)} |{' '}
                                <b>মেয়াদ/পর্যালোচনা:</b> {emp.suspensionDuration || '৭ কার্যদিবস'}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-amber-800">
                                  [সাময়িক তদন্তাধীন]
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSuspensionNoticeModalEmp(emp);
                                    onOpenSuspensionNotice?.(emp);
                                  }}
                                  className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer transition shadow-2xs active:scale-95"
                                  title="১-ক্লিকে এই শ্রমিকের তথ্যাবলিসহ সাময়িক স্থগিতাদেশ নোটিশ প্রিন্ট করুন"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>১-ক্লিক স্থগিত নোটিশ প্রিন্ট</span>
                                </button>
                              </div>
                            </div>
                            <div>
                              <b>স্থগিতের কারণ:</b> {emp.suspensionReason || emp.resignationReason || 'শৃঙ্খলাভঙ্গ সংক্রান্ত অভিযোগ'}
                            </div>
                            {emp.finalSettlementNote && (
                              <div className="text-slate-600 italic">
                                তদন্ত নোট: {emp.finalSettlementNote}
                              </div>
                            )}
                          </div>
                        )}

                        {/* TERMINATED SPECIFIC METADATA */}
                        {emp.status === 'terminated' && (
                          <div className="mt-2 p-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 text-[11px] space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span>
                                <b>বরখাস্ত কার্যকর তারিখ:</b> {formatDateBn(emp.terminationDate || emp.resignationDate)}
                                {emp.terminationMemo ? ` | মেমো: ${emp.terminationMemo}` : ''}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>
                                  {emp.finalSettlementPaid ? (
                                    <b className="text-emerald-700">[✓ ক্লিয়ারেন্স ও পাওনা পরিশোধিত]</b>
                                  ) : (
                                    <b className="text-rose-700">[⏳ দেনা-পাওনা বকেয়া]</b>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTerminationNoticeModalEmp(emp);
                                    onOpenTerminationNotice?.(emp);
                                  }}
                                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-black text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer transition shadow-2xs active:scale-95"
                                  title="১-ক্লিকে এই শ্রমিকের তথ্যাবলিসহ চাকরি হতে বরখাস্ত ও অব্যাহতি পত্র প্রিন্ট করুন"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>১-ক্লিক অব্যাহতি পত্র প্রিন্ট</span>
                                </button>
                              </div>
                            </div>
                            <div>
                              <b>বরখাস্তের সুনির্দিষ্ট কারণ:</b> {emp.terminationReason || emp.resignationReason || 'শৃঙ্খলাভঙ্গ ও অসদাচরণ'}
                            </div>
                            {emp.finalSettlementNote && (
                              <div className="text-slate-600 italic">
                                আদেশ নোট: {emp.finalSettlementNote}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-end gap-1.5 mt-3 pt-2.5 border-t border-slate-100 flex-wrap text-xs">
                      {/* Reinstate Action for non-active employees */}
                      {emp.status !== 'active' && (
                        <button
                          type="button"
                          onClick={() => handleReinstateEmployee(emp)}
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                          title="এই কর্মীকে পুনরায় সক্রিয় (Active) করুন"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>পুনরায় সক্রিয় (Active)</span>
                        </button>
                      )}

                      {/* Status Edit / Cancel modal trigger */}
                      <button
                        type="button"
                        onClick={() => onOpenResignationModal(emp)}
                        className={`py-1.5 px-2 rounded-lg font-semibold flex items-center gap-1 text-[11px] border transition-colors cursor-pointer ${
                          emp.status === 'active'
                            ? 'bg-white text-rose-700 hover:bg-rose-50 border-slate-200 hover:border-rose-200'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                        }`}
                        title="স্ট্যাটাস পরিবর্তন বা বাতিল করুন"
                      >
                        {emp.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        <span>{emp.status === 'active' ? 'বাতিল / স্ট্যাটাস' : 'স্ট্যাটাস সম্পাদন'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDetailSelectedId(emp.id);
                          try {
                            localStorage.setItem('texware_selected_detail_id', emp.id);
                          } catch {}
                          setActiveTab('details');
                        }}
                        className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                      >
                        <IdCard className="w-3.5 h-3.5 text-teal-300" />
                        <span>প্রোফাইল</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCredentialModalEmp(emp)}
                        className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1 text-[11px] border border-slate-200 transition-colors cursor-pointer"
                        title="এই শ্রমিকের ব্যক্তিগত প্রোফাইল লিংক ও পাসওয়ার্ড নিয়ন্ত্রণ করুন"
                      >
                        <Key className="w-3.5 h-3.5 text-slate-500" />
                        <span>লগইন ও পাসওয়ার্ড</span>
                      </button>

                      {/* Direct Block / Unblock Profile button */}
                      <button
                        type="button"
                        onClick={() => setCredentialModalEmp(emp)}
                        className={`py-1.5 px-2.5 rounded-lg font-semibold flex items-center gap-1 text-[11px] border transition-colors cursor-pointer ${
                          emp.isBlocked
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                        title={emp.isBlocked ? 'শ্রমিকের প্রোফাইল আনব্লক করুন' : 'শ্রমিকের প্রোফাইল ব্লক করুন (সুনির্দিষ্ট কারণসহ)'}
                      >
                        <Ban className={`w-3.5 h-3.5 ${emp.isBlocked ? 'text-rose-700' : 'text-slate-400'}`} />
                        <span>{emp.isBlocked ? 'ব্লক করা (আনব্লক)' : 'ব্লক / আনব্লক'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setContractModalEmp(emp)}
                        className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1 text-[11px] border border-slate-200 transition-colors cursor-pointer"
                        title="শ্রমিক নিয়োগ চুক্তিপত্র A4 প্রিন্ট করুন"
                      >
                        <FileText className="w-3.5 h-3.5 text-teal-700" />
                        <span>চুক্তিপত্র</span>
                      </button>

                      {emp.status === 'resigned' && (
                        <button
                          type="button"
                          onClick={() => {
                            setResignationLetterModalEmp(emp);
                            onOpenResignationLetter?.(emp);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 font-semibold flex items-center gap-1 text-[11px] border border-rose-200 transition-colors cursor-pointer"
                          title="১-ক্লিকে এই কর্মীর তথ্যাবলিসহ পদত্যাগ ফরম প্রিন্ট করুন"
                        >
                          <Printer className="w-3.5 h-3.5 text-rose-600" />
                          <span>রিজাইন ফরম</span>
                        </button>
                      )}

                      {emp.status === 'suspended' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSuspensionNoticeModalEmp(emp);
                            onOpenSuspensionNotice?.(emp);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-amber-50 text-amber-800 font-semibold flex items-center gap-1 text-[11px] border border-amber-200 transition-colors cursor-pointer"
                          title="১-ক্লিকে এই কর্মীর তথ্যাবলিসহ সাময়িক স্থগিতাদেশ নোটিশ প্রিন্ট করুন"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-700" />
                          <span>স্থগিত নোটিশ</span>
                        </button>
                      )}

                      {emp.status === 'terminated' && (
                        <button
                          type="button"
                          onClick={() => {
                            setTerminationNoticeModalEmp(emp);
                            onOpenTerminationNotice?.(emp);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-semibold flex items-center gap-1 text-[11px] border border-slate-300 transition-colors cursor-pointer"
                          title="১-ক্লিকে এই কর্মীর তথ্যাবলিসহ চাকরি হতে বরখাস্ত ও অব্যাহতি পত্র প্রিন্ট করুন"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-700" />
                          <span>অব্যাহতি পত্র</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleEditEmployee(emp)}
                        className="py-1.5 px-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-500" />
                        <span>এডিট</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyEmployee(emp)}
                        className="py-1.5 px-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>কপি</span>
                      </button>

                      <button
                        id={`btnDeleteEmp_${emp.id}`}
                        type="button"
                        onClick={() => handleDeleteEmployee(emp)}
                        className="py-1.5 px-2 rounded-lg bg-white text-rose-700 hover:bg-rose-50 font-semibold flex items-center gap-1 text-[11px] border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                        title="কর্মচারী মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>ডিলিট</span>
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ================= TAB: ATTENDANCE & IN/OUT TIME (হাজিরা ও টাইম) ================= */}
      {activeTab === 'attendance' && (
        <AttendanceHub
          employees={employees}
          attendanceRecords={attendanceRecords}
          showToast={showToast}
          onViewEmployeeProfile={(empId) => {
            setDetailSelectedId(empId);
            try {
              localStorage.setItem('texware_selected_detail_id', empId);
            } catch {}
            handleTabChange('details');
          }}
        />
      )}

      {/* ================= TAB: MONTHLY SALARY RECORDS (বেতন খাতা) ================= */}
      {activeTab === 'salaries' && (
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Receipt className="w-4 h-4 text-teal-700" />
                <span>মাসিক বেতন খাতা ও পরিশোধ ইতিহাস</span>
                <span className="text-slate-300 font-normal">·</span>
                <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
                  {salaryRecords.length} টি রেকর্ড
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                কোন মাসে কাকে কত বেতন ও ক্যাশ/বিকাশ দেওয়া হয়েছে তার বিস্তারিত খাতা
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (salaryMonthFilter !== 'all') {
                    setMasterA4Month(salaryMonthFilter);
                  } else if (uniqueSalaryRecords.length > 0 && (!masterA4Month || masterA4Month === 'all')) {
                    setMasterA4Month(uniqueSalaryRecords[0]?.month || 'সেপ্টেম্বর');
                  }
                  if (salaryYearFilter !== 'all') {
                    setMasterA4Year(Number(salaryYearFilter));
                  }
                  setShowMasterA4Modal(true);
                }}
                className="py-1.5 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                title="সকল শ্রমিকের উপস্থিতি, অনুপস্থিতি, ওটি ঘণ্টা ও টাকা, বোনাসসহ A4 মাস্টার পেপারে প্রিন্ট করুন"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-100" />
                <span>A4 মাস্টার বেতন ও হাজিরা শিট</span>
              </button>

              <button
                type="button"
                onClick={handlePrintSalarySheet}
                className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>পেমেন্ট খাতা প্রিন্ট</span>
              </button>
            </div>
          </div>

          {/* 1-Click A4 Master Sheet Executive Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-teal-300 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                  <span>সকল শ্রমিকের A4 বেতন ও হাজিরা মাস্টার শিট</span>
                  <span className="text-[10.5px] font-medium text-teal-700">
                    · ১-ক্লিক প্রিন্ট রেডি
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  এক ক্লিকে সকল শ্রমিকের উপস্থিতি, অনুপস্থিতি, মোট ওভারটাইম ঘণ্টা ও টাকা, হাজিরা বোনাস, নিট বেতন ও স্বাক্ষর কলামসহ A4 ল্যান্ডস্কেপ পেপারে প্রিন্ট করুন।
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (salaryMonthFilter !== 'all') {
                    setMasterA4Month(salaryMonthFilter);
                  } else if (uniqueSalaryRecords.length > 0 && (!masterA4Month || masterA4Month === 'all')) {
                    setMasterA4Month(uniqueSalaryRecords[0]?.month || 'সেপ্টেম্বর');
                  }
                  if (salaryYearFilter !== 'all') {
                    setMasterA4Year(Number(salaryYearFilter));
                  }
                  setShowMasterA4Modal(true);
                }}
                className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>প্রিভিউ ও সেটিংস</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (salaryMonthFilter !== 'all') {
                    setMasterA4Month(salaryMonthFilter);
                  } else if (uniqueSalaryRecords.length > 0 && (!masterA4Month || masterA4Month === 'all')) {
                    setMasterA4Month(uniqueSalaryRecords[0]?.month || 'সেপ্টেম্বর');
                  }
                  if (salaryYearFilter !== 'all') {
                    setMasterA4Year(Number(salaryYearFilter));
                  }
                  handlePrintMasterA4Sheet();
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                title="সরাসরি প্রিন্ট ডায়ালগ ওপেন করুন"
              >
                <Printer className="w-3.5 h-3.5 text-teal-300" />
                <span className="tabular-nums">১-ক্লিকে সরাসরি প্রিন্ট ({toBengaliNumber(masterTotals.workersCount)} জন)</span>
              </button>
            </div>
          </div>

          {/* Filtering Row: মাস, বছর, মাধ্যম, স্ট্যাটাস, সার্চ */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                মাস নির্বাচন করুন
              </label>
              <select
                value={salaryMonthFilter}
                onChange={(e) => setSalaryMonthFilter(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-teal-600 outline-none"
              >
                <option value="all">সব মাস (All Months)</option>
                {BENGALI_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                বছর নির্বাচন করুন
              </label>
              <select
                value={salaryYearFilter}
                onChange={(e) => setSalaryYearFilter(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-teal-600 outline-none"
              >
                <option value="all">সব বছর (All Years)</option>
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={String(y)}>
                    {toBengaliNumber(y)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                পেমেন্ট মাধ্যম (Method)
              </label>
              <select
                value={salaryMethodFilter}
                onChange={(e) => setSalaryMethodFilter(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-teal-600 outline-none"
              >
                <option value="all">সব মাধ্যম (All)</option>
                <option value="cash">ক্যাশ (নগদ)</option>
                <option value="bkash">বিকাশ (bKash)</option>
                <option value="nagad">নগদ (Nagad)</option>
                <option value="rocket">রকেট (Rocket)</option>
                <option value="bank">ব্যাংক (Bank)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                পরিশোধ স্ট্যাটাস (Status)
              </label>
              <select
                value={salaryStatusFilter}
                onChange={(e) => setSalaryStatusFilter(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-teal-600 outline-none"
              >
                <option value="all">সব স্ট্যাটাস (All)</option>
                <option value="due">বাকী</option>
                <option value="calculated">হিসাব সম্পূর্ণ</option>
                <option value="ready">বেতন দেওয়ার জন্য প্রস্তুত</option>
                <option value="disbursed">বেতন প্রদান করা সম্পূর্ণ</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                শ্রমিক / আইডি খুঁজুন
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={salarySearchQuery}
                  onChange={(e) => setSalarySearchQuery(e.target.value)}
                  placeholder="নাম বা Worker ID..."
                  className="w-full p-2 pl-7 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-600 outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
              </div>
            </div>
          </div>

          {/* Filtered Dataset & Live Metrics */}
          {(() => {
            const filtered = salaryTableRows.filter((rec) => {
              if (salaryMethodFilter !== 'all' && rec.paymentMethod !== salaryMethodFilter) return false;
              if (salaryStatusFilter !== 'all') {
                if (salaryStatusFilter === 'due') {
                  if (rec.progressStatus !== 'due' && rec.progressStatus !== 'calculating' && rec.paymentStatus !== 'due') return false;
                } else if (salaryStatusFilter === 'calculated') {
                  if (rec.progressStatus !== 'calculated') return false;
                } else if (salaryStatusFilter === 'ready') {
                  if (rec.progressStatus !== 'ready') return false;
                } else if (salaryStatusFilter === 'disbursed' || salaryStatusFilter === 'paid') {
                  if (rec.progressStatus !== 'disbursed' && rec.paymentStatus !== 'paid') return false;
                } else if (salaryStatusFilter === 'pending') {
                  if (rec.paymentStatus !== 'pending' && rec.paymentStatus !== 'partial') return false;
                }
              }
              if (salarySearchQuery.trim()) {
                const q = salarySearchQuery.toLowerCase();
                const matchName = rec.employeeName.toLowerCase().includes(q);
                const matchId = rec.workerId.toLowerCase().includes(q);
                if (!matchName && !matchId) return false;
              }
              return true;
            });

            // Live metrics calculated strictly from the actual records matching the filter
            const totalBasicSalary = filtered.reduce((sum, r) => sum + (r.salary || 0), 0);
            const totalWorkersCount = filtered.length;
            const totalPresentDays = filtered.reduce((sum, r) => sum + (r.presentDays || 0), 0);
            const totalAbsentDays = filtered.reduce(
              (sum, r) => sum + Math.max(0, (r.totalDays || 26) - (r.presentDays || 0)),
              0
            );
            const totalOtHours = filtered.reduce((sum, r) => sum + (r.otHours || 0), 0);
            const totalOtPay = filtered.reduce((sum, r) => sum + (r.otPay || 0), 0);
            const totalBonus = filtered.reduce((sum, r) => sum + (r.bonus || 0), 0);
            const totalNetPayable = filtered.reduce((sum, r) => sum + (r.netPayable || 0), 0);
            const totalPaid = filtered.reduce((sum, r) => {
              const p = r.paymentStatus === 'paid' ? (r.netPayable || r.paidAmount || 0) : (r.paidAmount || 0);
              return sum + p;
            }, 0);
            const totalDue = filtered.reduce((sum, r) => {
              if (r.paymentStatus === 'paid') return sum;
              const d = r.dueAmount !== undefined ? r.dueAmount : Math.max(0, (r.netPayable || 0) - (r.paidAmount || 0));
              return sum + d;
            }, 0);
            const cashCount = filtered.filter((r) => r.paymentMethod === 'cash').reduce((sum, r) => {
              const p = r.paymentStatus === 'paid' ? (r.netPayable || r.paidAmount || 0) : (r.paidAmount || 0);
              return sum + p;
            }, 0);
            const bkashCount = filtered.filter((r) => r.paymentMethod === 'bkash').reduce((sum, r) => {
              const p = r.paymentStatus === 'paid' ? (r.netPayable || r.paidAmount || 0) : (r.paidAmount || 0);
              return sum + p;
            }, 0);

            return (
              <>
                {/* On-Screen Master Summary Cards (সম্পূর্ণ ফিল্টারের রেকর্ডের ওপর ভিত্তি করে, ডিলিট করলে ০ হবে) */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-left text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">মোট মূল বেতন</div>
                    <div className="text-sm font-extrabold font-mono text-slate-950 mt-0.5 tabular-nums">৳{formatMoney(totalBasicSalary)}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">{toBengaliNumber(totalWorkersCount)} জন শ্রমিক</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">উপস্থিতি / অনুপস্থিতি</div>
                    <div className="text-sm font-extrabold font-mono text-emerald-700 mt-0.5 tabular-nums">
                      {toBengaliNumber(totalPresentDays)} / {toBengaliNumber(totalAbsentDays)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">মোট দিন</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">মোট ওভারটাইম</div>
                    <div className="text-sm font-extrabold font-mono text-slate-950 mt-0.5 tabular-nums">
                      {toBengaliNumber(totalOtHours)} ঘ. (৳{formatMoney(totalOtPay)})
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">ওটি রেট অনুযায়ী</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">মোট বোনাস</div>
                    <div className="text-sm font-extrabold font-mono text-slate-950 mt-0.5 tabular-nums">৳{formatMoney(totalBonus)}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">হাজিরা/উৎসব বোনাস</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">মোট নিট প্রদেয়</div>
                    <div className="text-sm font-extrabold font-mono text-teal-800 mt-0.5 tabular-nums">৳{formatMoney(totalNetPayable)}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">সর্বমোট নিট বেতন</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">পরিশোধিত / বকেয়া</div>
                    <div className="text-sm font-extrabold font-mono text-rose-700 mt-0.5 tabular-nums">
                      ৳{formatMoney(totalPaid)} / ৳{formatMoney(totalDue)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {totalDue === 0 && totalWorkersCount > 0 ? 'সম্পূর্ণ পরিশোধিত' : totalDue > 0 ? 'বকেয়া আছে' : 'রেকর্ড নেই'}
                    </div>
                  </div>
                </div>

                {/* Filter Info and Batch Delete Action Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-700">
                    <span className="font-bold">
                      প্রদর্শিত রেকর্ড: <strong className="text-slate-900">{toBengaliNumber(filtered.length)} টি</strong>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-[11px] text-slate-600">
                      মাস ও বছর: <strong>{salaryMonthFilter === 'all' ? 'সকল মাস' : salaryMonthFilter} {salaryYearFilter === 'all' ? 'সকল বছর' : `${toBengaliNumber(salaryYearFilter)} সাল`}</strong>
                    </span>
                    {totalWorkersCount > 0 && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          ক্যাশ: {formatMoney(cashCount)} ৳ | বিকাশ: {formatMoney(bkashCount)} ৳
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Bulk Status Update Dropdown */}
                    <div className="relative inline-block">
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleBulkUpdateSalaryStatus(filtered, val as SalaryProgressStatus);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs flex items-center transition-colors cursor-pointer"
                        title="প্রদর্শিত সকল কর্মীর স্ট্যাটাস এক ক্লিকে পরিবর্তন করুন"
                      >
                        <option value="" disabled>সবার স্ট্যাটাস পরিবর্তন করুন ▾</option>
                        <option value="due">সবাইকে "বাকী" করুন</option>
                        <option value="calculated">সবাইকে "হিসাব সম্পূর্ণ" করুন</option>
                        <option value="ready">সবাইকে "বেতন দেওয়ার জন্য প্রস্তুত" করুন</option>
                        <option value="disbursed">সবাইকে "বেতন প্রদান করা সম্পূর্ণ" করুন</option>
                      </select>
                    </div>

                    {/* New Salary Sheet Generator Button */}
                    <button
                      type="button"
                      onClick={() => handleGenerateSalarySheetForMonth(
                        salaryMonthFilter === 'all' ? (BENGALI_MONTHS[new Date().getMonth()] || 'অক্টোবর') : salaryMonthFilter,
                        salaryYearFilter === 'all' ? new Date().getFullYear() : Number(salaryYearFilter)
                      )}
                      className="py-1.5 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                      title="এই মাসের সকল সক্রিয় কর্মীর জন্য নতুন বেতন হিসাব তৈরি করুন"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>নতুন খাতা তৈরি</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (salaryMonthFilter !== 'all') {
                          setBatchDeleteMonth(salaryMonthFilter);
                        }
                        if (salaryYearFilter !== 'all') {
                          setBatchDeleteYear(Number(salaryYearFilter));
                        }
                        setShowBatchDeleteModal(true);
                      }}
                      className="py-1.5 px-3 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                      title="মাস অনুযায়ী সকল তথ্য এক ক্লিকে মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>মাস অনুযায়ী মুছুন</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPurgeAllHistoryModal(true)}
                      className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                      title="সকল শ্রমিকের পূর্ববর্তী সকল মাসের বেতন প্রদান ও স্ট্যাটাস হিস্ট্রি সম্পূর্ণ মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>সকল হিস্ট্রি মুছুন</span>
                    </button>
                  </div>
                </div>

                {/* Printable Salary Sheet Container */}
                <div
                  id="monthlySalarySheetPrintArea"
                  ref={salarySheetPrintRef}
                  className="space-y-3"
                >
                  <div className="hidden print:block print-block text-center border-b pb-2 mb-3">
                    <h2 className="text-lg font-black">টেক্স ওয়ার অ্যাপারেলস</h2>
                    <p className="text-xs font-semibold">
                      মাসিক বেতন ও পেমেন্ট বিবরণী — {salaryMonthFilter === 'all' ? 'সকল মাস' : salaryMonthFilter} {salaryYearFilter === 'all' ? 'সকল বছর' : `${toBengaliNumber(salaryYearFilter)} সাল`}
                    </p>
                    <p className="text-[10px] text-slate-500">প্রিন্ট তারিখ: {new Date().toLocaleDateString('bn-BD')}</p>
                    <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-200 text-[10px] font-bold">
                      <div>মোট রেকর্ড: {toBengaliNumber(filtered.length)} টি</div>
                      <div>মোট মূল বেতন: {formatMoney(totalBasicSalary)} ৳</div>
                      <div>মোট ওটি টাকা: {formatMoney(totalOtPay)} ৳</div>
                      <div>মোট নিট প্রদেয়: {formatMoney(totalNetPayable)} ৳</div>
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs space-y-3">
                      <AlertTriangle className="w-8 h-8 mx-auto text-slate-400" />
                      <div>
                        <p className="font-black text-sm text-slate-800">কোনো বেতন রেকর্ড সংরক্ষিত নেই</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {salaryMonthFilter === 'all'
                            ? 'সকল বেতন হিসাব সফলভাবে মুছে ফেলা হয়েছে অথবা নতুন হিসাব এখনও শুরু করা হয়নি।'
                            : `${salaryMonthFilter} ${salaryYearFilter === 'all' ? '' : toBengaliNumber(salaryYearFilter)} এর সকল বেতন রেকর্ড মুছে ফেলা হয়েছে।`}
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleGenerateSalarySheetForMonth(
                            salaryMonthFilter === 'all' ? (BENGALI_MONTHS[new Date().getMonth()] || 'অক্টোবর') : salaryMonthFilter,
                            salaryYearFilter === 'all' ? new Date().getFullYear() : Number(salaryYearFilter)
                          )}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          <Receipt className="w-4 h-4" />
                          <span>➕ {salaryMonthFilter === 'all' ? 'চলতি' : salaryMonthFilter} মাসের বেতন খাতা নতুন করে তৈরি করুন ({toBengaliNumber(activeEmployees.length)} জন কর্মী)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="p-2.5">তারিখ/মাস</th>
                            <th className="p-2.5">কর্মচারী ও আইডি</th>
                            <th className="p-2.5">পদবি</th>
                            <th className="p-2.5 text-right">নিট বেতন</th>
                            <th className="p-2.5 text-right">প্রদত্ত (Paid)</th>
                            <th className="p-2.5 text-center">মাধ্যম</th>
                            <th className="p-2.5 text-right">বকেয়া (Due)</th>
                            <th className="p-2.5 text-center">স্ট্যাটাস</th>
                            <th className="p-2.5 text-center no-print">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {filtered.map((rec) => {
                            const methodBadge = (() => {
                              switch (rec.paymentMethod) {
                                case 'cash':
                                  return <span className="text-emerald-700 font-semibold text-[11px]">ক্যাশ</span>;
                                case 'bkash':
                                  return <span className="text-slate-800 font-semibold text-[11px]">বিকাশ</span>;
                                case 'nagad':
                                  return <span className="text-slate-800 font-semibold text-[11px]">নগদ</span>;
                                case 'rocket':
                                  return <span className="text-slate-800 font-semibold text-[11px]">রকেট</span>;
                                case 'bank':
                                  return <span className="text-teal-700 font-semibold text-[11px]">ব্যাংক</span>;
                                default:
                                  return <span className="text-slate-600 font-semibold text-[11px]">অন্যান্য</span>;
                              }
                            })();

                            return (
                              <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-2.5 whitespace-nowrap">
                                  <div className="font-semibold text-slate-900">{rec.month} {rec.year}</div>
                                  <div className="text-[10px] text-slate-400 tabular-nums">{new Date(rec.paidAt).toLocaleDateString('bn-BD')}</div>
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    <span>{rec.employeeName}</span>
                                    {rec.isDraft && (
                                      <span className="text-amber-700 text-[10px] font-semibold">
                                        · ড্রাফট
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500">ID: {rec.workerId}</div>
                                </td>
                                <td className="p-2.5 whitespace-nowrap text-slate-600">
                                  {rec.designation}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                  ৳{formatMoney(rec.netPayable)}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                                  ৳{formatMoney(rec.paymentStatus === 'paid' ? rec.netPayable : (rec.paidAmount || 0))}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  {methodBadge}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                                  {rec.paymentStatus === 'paid' || rec.dueAmount === 0 ? (
                                    <span className="text-emerald-600 font-semibold">৳০</span>
                                  ) : (
                                    <span className="text-rose-600 font-bold">৳{formatMoney(rec.dueAmount)}</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <div className="no-print">
                                    <select
                                      value={
                                        rec.progressStatus === 'disbursed' || rec.paymentStatus === 'paid'
                                          ? 'disbursed'
                                          : rec.progressStatus === 'ready'
                                          ? 'ready'
                                          : rec.progressStatus === 'calculated'
                                          ? 'calculated'
                                          : 'due'
                                      }
                                      onChange={(e) =>
                                        handleUpdateSalaryStatus(rec, e.target.value as SalaryProgressStatus)
                                      }
                                      className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold border transition cursor-pointer focus:ring-2 focus:ring-teal-500 outline-none ${
                                        rec.progressStatus === 'disbursed' || rec.paymentStatus === 'paid'
                                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                                          : rec.progressStatus === 'ready'
                                          ? 'bg-slate-100 text-slate-800 border-slate-300'
                                          : rec.progressStatus === 'calculated'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : 'bg-rose-50 text-rose-800 border-rose-200'
                                      }`}
                                      title="বেতন স্ট্যাটাস পরিবর্তন করুন (শ্রমিক প্রোফাইলে তাৎক্ষণিক দৃশ্যমান)"
                                    >
                                      <option value="due">বাকী</option>
                                      <option value="calculated">হিসাব সম্পূর্ণ</option>
                                      <option value="ready">বেতন দেওয়ার জন্য প্রস্তুত</option>
                                      <option value="disbursed">বেতন প্রদান করা সম্পূর্ণ</option>
                                    </select>
                                  </div>
                                  <div className="hidden print:block print-block font-bold text-[10px]">
                                    {rec.progressStatus === 'disbursed' || rec.paymentStatus === 'paid'
                                      ? 'বেতন প্রদান করা সম্পূর্ণ'
                                      : rec.progressStatus === 'ready'
                                      ? 'বেতন দেওয়ার জন্য প্রস্তুত'
                                      : rec.progressStatus === 'calculated'
                                      ? 'হিসাব সম্পূর্ণ'
                                      : 'বাকী'}
                                  </div>
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap no-print">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSalaryRecord(rec)}
                                      className="p-1.5 rounded-md text-slate-600 hover:text-teal-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                      title="শ্রমিকের বেতন হিসাব সম্পাদন করুন (Edit)"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSalaryRecord(rec)}
                                      className="p-1.5 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="রেকর্ড মুছুন"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
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

                {/* ================= HIDDEN PRINT CONTAINER FOR MASTER A4 SHEET ================= */}
                <div className="hidden print:block print:relative print:w-full" aria-hidden="true">
                  <div
                    ref={masterA4SheetPrintRef}
                    id="masterSalaryA4PrintArea"
                    className="print-landscape bg-white text-slate-900 p-4"
                    style={{ minWidth: '1000px', fontFamily: '"Noto Sans Bengali", sans-serif' }}
                  >
                    {/* Factory Header */}
                    <div className="border-b-2 border-slate-900 pb-2 mb-2 text-center">
                      <h1 className="text-xl font-black text-slate-900 tracking-wide uppercase">
                        টেক্স ওয়ার অ্যাপারেলস (TexWare Apparels)
                      </h1>
                      <h2 className="text-xs font-bold text-slate-800 mt-0.5">
                        শ্রমিক ও কর্মচারীদের মাসিক বেতন ও হাজিরা মাস্টার বিবরণী (Monthly Attendance & Payroll Master Sheet)
                      </h2>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-600 font-semibold px-1">
                        <div>
                          <span>মাস ও বছর: </span>
                          <strong className="text-slate-950 text-[11px]">
                            {masterA4Month === 'all' ? 'সকল মাস' : masterA4Month} {masterA4Year ? `${toBengaliNumber(masterA4Year)} সাল` : ''}
                          </strong>
                          {masterA4Dept !== 'all' && (
                            <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-900">
                              সেকশন: {masterA4Dept}
                            </span>
                          )}
                        </div>
                        <div>
                          <span>মোট শ্রমিক সংখ্যা: </span>
                          <strong className="text-slate-950">{toBengaliNumber(masterTotals.workersCount)} জন</strong>
                        </div>
                        <div>
                          <span>মুদ্রণ তারিখ: </span>
                          <span>{new Date().toLocaleDateString('bn-BD')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <table className="w-full border-collapse border border-slate-400 text-left text-[9.5px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400 text-center">
                          <th className="p-1 border border-slate-300 w-7">ক্র.</th>
                          <th className="p-1 border border-slate-300 w-14">আইডি</th>
                          <th className="p-1 border border-slate-300 text-left">শ্রমিকের নাম ও পদবি</th>
                          <th className="p-1 border border-slate-300">সেকশন</th>
                          <th className="p-1 border border-slate-300 text-right">মূল বেতন</th>
                          <th className="p-1 border border-slate-300 w-9">মোট দিন</th>
                          <th className="p-1 border border-slate-300 w-9 bg-emerald-50 text-emerald-900">উপস্থিতি</th>
                          <th className="p-1 border border-slate-300 w-9 bg-rose-50 text-rose-900">অনুপস্থিতি</th>
                          <th className="p-1 border border-slate-300 w-11 bg-blue-50 text-blue-900">ওটি ঘণ্টা</th>
                          <th className="p-1 border border-slate-300 text-right w-11">ওটি দর</th>
                          <th className="p-1 border border-slate-300 text-right bg-blue-50 text-blue-900">ওটি টাকা</th>
                          <th className="p-1 border border-slate-300 text-right bg-amber-50 text-amber-900">হাজিরা বোনাস</th>
                          <th className="p-1 border border-slate-300 text-right">অর্জিত বেতন</th>
                          <th className="p-1 border border-slate-300 text-right">কর্তন</th>
                          <th className="p-1 border border-slate-300 text-right font-black bg-slate-200 text-slate-950">নিট প্রদেয়</th>
                          <th className="p-1 border border-slate-300 w-14">স্ট্যাটাস</th>
                          <th className="p-1 border border-slate-300 w-20">শ্রমিকের স্বাক্ষর</th>
                        </tr>
                      </thead>
                      <tbody>
                        {masterA4Rows.map((row) => (
                          <tr key={row.workerId} className="border-b border-slate-300 hover:bg-slate-50">
                            <td className="p-1 border border-slate-300 text-center font-semibold">{toBengaliNumber(row.sl)}</td>
                            <td className="p-1 border border-slate-300 text-center font-bold text-slate-800">{row.workerId}</td>
                            <td className="p-1 border border-slate-300 text-left">
                              <div className="font-bold text-slate-900 leading-tight">{row.name}</div>
                              <div className="text-[8px] text-slate-600 leading-tight">{row.designation}</div>
                            </td>
                            <td className="p-1 border border-slate-300 text-center text-[9px] text-slate-700">{row.department}</td>
                            <td className="p-1 border border-slate-300 text-right font-semibold">{formatMoney(row.basicSalary)}</td>
                            <td className="p-1 border border-slate-300 text-center">{toBengaliNumber(row.totalDays)}</td>
                            <td className="p-1 border border-slate-300 text-center font-bold text-emerald-800 bg-emerald-50/50">
                              {toBengaliNumber(row.presentDays)}
                            </td>
                            <td className="p-1 border border-slate-300 text-center font-bold text-rose-800 bg-rose-50/50">
                              {toBengaliNumber(row.absentDays)}
                            </td>
                            <td className="p-1 border border-slate-300 text-center font-bold text-blue-800 bg-blue-50/50">
                              {toBengaliNumber(row.otHours)}
                            </td>
                            <td className="p-1 border border-slate-300 text-right text-slate-600">{formatMoney(row.otRate)}</td>
                            <td className="p-1 border border-slate-300 text-right font-bold text-blue-900 bg-blue-50/50">
                              {formatMoney(row.otPay)}
                            </td>
                            <td className="p-1 border border-slate-300 text-right font-bold text-amber-900 bg-amber-50/50">
                              {row.attendanceBonus > 0 ? formatMoney(row.attendanceBonus) : '—'}
                            </td>
                            <td className="p-1 border border-slate-300 text-right font-semibold text-slate-800">
                              {formatMoney(row.presentSalary)}
                            </td>
                            <td className="p-1 border border-slate-300 text-right text-rose-700">
                              {(row.advance + row.deduction) > 0 ? formatMoney(row.advance + row.deduction) : '—'}
                            </td>
                            <td className="p-1 border border-slate-300 text-right font-black text-slate-950 bg-slate-100">
                              {formatMoney(row.netPayable)} ৳
                            </td>
                            <td className="p-1 border border-slate-300 text-center text-[8.5px] font-semibold">
                              {row.paymentStatus === 'paid' ? (
                                <span className="text-emerald-700 font-bold">সম্পূর্ণ পরিশোধিত</span>
                              ) : row.paymentStatus === 'pending' || row.paymentStatus === 'partial' ? (
                                <span className="text-amber-700 font-bold">পেন্ডিং</span>
                              ) : (
                                <span className="text-rose-700 font-bold">বাকী</span>
                              )}
                            </td>
                            <td className="p-1 border border-slate-300 text-center">
                              <div className="h-5"></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-200 text-slate-900 font-black border-t-2 border-slate-500 text-center">
                          <td colSpan={4} className="p-1 border border-slate-300 text-right pr-2">
                            সর্বমোট ({toBengaliNumber(masterTotals.workersCount)} জন):
                          </td>
                          <td className="p-1 border border-slate-300 text-right">{formatMoney(masterTotals.totalBasicSalary)} ৳</td>
                          <td className="p-1 border border-slate-300">—</td>
                          <td className="p-1 border border-slate-300 text-emerald-950">{toBengaliNumber(masterTotals.totalPresentDays)}</td>
                          <td className="p-1 border border-slate-300 text-rose-950">{toBengaliNumber(masterTotals.totalAbsentDays)}</td>
                          <td className="p-1 border border-slate-300 text-blue-950">{toBengaliNumber(masterTotals.totalOtHours)}</td>
                          <td className="p-1 border border-slate-300">—</td>
                          <td className="p-1 border border-slate-300 text-right text-blue-950">{formatMoney(masterTotals.totalOtPay)} ৳</td>
                          <td className="p-1 border border-slate-300 text-right text-amber-950">{formatMoney(masterTotals.totalBonus)} ৳</td>
                          <td className="p-1 border border-slate-300 text-right">{formatMoney(masterTotals.totalPresentSalary)} ৳</td>
                          <td className="p-1 border border-slate-300 text-right text-rose-900">
                            {formatMoney(masterTotals.totalAdvance + masterTotals.totalDeduction)} ৳
                          </td>
                          <td className="p-1 border border-slate-300 text-right bg-slate-300 text-slate-950">
                            {formatMoney(masterTotals.totalNetPayable)} ৳
                          </td>
                          <td colSpan={2} className="p-1 border border-slate-300 text-center text-[9px]">
                            পরিশোধিত: {formatMoney(masterTotals.totalPaid)} ৳ | বকেয়া: {formatMoney(masterTotals.totalDue)} ৳
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Signatures */}
                    <div className="grid grid-cols-5 gap-3 mt-7 pt-3 border-t border-slate-300 text-center text-[9px] font-bold text-slate-700">
                      <div>
                        <div className="border-t border-slate-400 pt-1 mt-5">হিসাব প্রস্তুতকারী</div>
                        <div className="text-[7.5px] text-slate-500 font-normal">Prepared By</div>
                      </div>
                      <div>
                        <div className="border-t border-slate-400 pt-1 mt-5">হিসাব কর্মকর্তা</div>
                        <div className="text-[7.5px] text-slate-500 font-normal">Accountant</div>
                      </div>
                      <div>
                        <div className="border-t border-slate-400 pt-1 mt-5">সেকশন ইনচার্জ</div>
                        <div className="text-[7.5px] text-slate-500 font-normal">Section In-Charge</div>
                      </div>
                      <div>
                        <div className="border-t border-slate-400 pt-1 mt-5">এইচআর ও এডমিন ম্যানেজার</div>
                        <div className="text-[7.5px] text-slate-500 font-normal">HR & Admin Manager</div>
                      </div>
                      <div>
                        <div className="border-t border-slate-400 pt-1 mt-5">ব্যবস্থাপনা পরিচালক</div>
                        <div className="text-[7.5px] text-slate-500 font-normal">Managing Director</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ================= TAB 3: EMPLOYEE FORM (ADD / EDIT) ================= */}
      {activeTab === 'form' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <UserPlus className="w-4 h-4 text-teal-700" />
              <span>{editId ? 'কর্মচারীর তথ্য সম্পাদন (Edit)' : 'নতুন কর্মচারী নিবন্ধন (Add Employee)'}</span>
            </div>
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                নতুন কর্মী ফর্মে ফিরে যান
              </button>
            )}
          </div>

          <form onSubmit={handleSaveEmployee} className="space-y-3.5 text-xs text-slate-800">
            <div>
              <label className="block font-bold text-slate-700 mb-1">কর্মচারীর পূর্ণ নাম *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="যেমন: মোঃ রফিকুল ইসলাম"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Worker ID / আইডি নম্বর *
                  </label>
                  {!editId && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextId = generateUniqueWorkerId(employees);
                        setFormWorkerId(nextId);
                        showToast(`নতুন ইউনিক আইডি "${nextId}" তৈরি করা হয়েছে`);
                      }}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-200 transition"
                      title="স্বয়ংক্রিয় ইউনিক আইডি জেনারেট করুন"
                    >
                      <RefreshCw className="w-3 h-3" />
                      অটো ইউনিক আইডি
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={formWorkerId}
                  onChange={(e) => setFormWorkerId(e.target.value.toUpperCase())}
                  placeholder="যেমন: TWA-001"
                  className={`w-full p-2.5 font-mono font-bold rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition ${
                    !isFormWorkerIdUnique
                      ? 'bg-rose-50 border-2 border-rose-400 text-rose-900'
                      : 'bg-slate-50 border border-slate-300 text-slate-900'
                  }`}
                />
                <div className="mt-1">
                  {!formWorkerId.trim() ? (
                    <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                      ⚠️ আইডি ফাঁকা রাখা যাবে না (যেমন: TWA-001)
                    </span>
                  ) : !isFormWorkerIdUnique ? (
                    <span className="text-[11px] text-rose-600 font-bold flex items-center gap-1 bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      এই আইডিটি ইতিমধ্যে {formConflictingWorker?.status === 'resigned' ? 'পদত্যাগকৃত কর্মী' : formConflictingWorker?.status === 'terminated' ? 'অব্যাহতি/বরখাস্তকৃত কর্মী' : 'কর্মী'} "{formConflictingWorker?.name || formConflictingWorker?.workerId}"-এর জন্য সংরক্ষিত! একই আইডি গ্রহণযোগ্য নয়।
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      স্বয়ংক্রিয় আলাদা ইউনিক আইডি (কারো সাথে মিলবে না)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">পদবি (Designation) *</label>
                <input
                  type="text"
                  required
                  value={formDesignation}
                  onChange={(e) => setFormDesignation(e.target.value)}
                  placeholder="যেমন: সুইং অপারেটর / কোয়ালিটি"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">সেকশন / ডিপার্টমেন্ট</label>
                <select
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="সুইং সেকশন">সুইং সেকশন</option>
                  <option value="কাটিং সেকশন">কাটিং সেকশন</option>
                  <option value="ফিনিশিং সেকশন">ফিনিশিং সেকশন</option>
                  <option value="কোয়ালিটি কন্ট্রোল">কোয়ালিটি কন্ট্রোল</option>
                  <option value="আইরন ও প্যাকিং">আইরন ও প্যাকিং</option>
                  <option value="মেইনটেন্যান্স ও মেকানিক">মেইনটেন্যান্স ও মেকানিক</option>
                  <option value="অফিস ও প্রশাসন">অফিস ও প্রশাসন</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">মাসিক মূল বেতন *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={formSalary}
                  onChange={(e) => setFormSalary(e.target.value)}
                  placeholder="14000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">প্রতি ঘণ্টা OT রেট *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={formOtRate}
                  onChange={(e) => setFormOtRate(e.target.value)}
                  placeholder="85"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">যোগদানের তারিখ</label>
                <input
                  type="date"
                  value={formJoinDate}
                  onChange={(e) => setFormJoinDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                  💡 <b>নতুন কর্মী নীতি:</b> মাসের মাঝামাঝি (যেমন ১৫ বা ২০ তারিখ) জয়েন করলে সে মাসে কোনো লেট বা অনুপস্থিতি কর্তন হবে না, শুধুমাত্র উপস্থিত কার্যদিবসের মজুরি দেওয়া হবে এবং হাজিরা বোনাস থাকবে না। পরবর্তী মাস থেকে নিয়মিত সকল নিয়ম কার্যকর হবে। ১ তারিখে জয়েন করলে প্রথম মাস থেকেই নিয়মিত সকল নিয়ম কার্যকর।
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">জন্ম তারিখ</label>
                <input
                  type="date"
                  value={formBirthDate}
                  onChange={(e) => setFormBirthDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                <input
                  type="tel"
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">জাতীয় পরিচয়পত্র (NID) নম্বর</label>
                <input
                  type="text"
                  value={formNid}
                  onChange={(e) => setFormNid(e.target.value)}
                  placeholder="NID নম্বর"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Worker Portal Password (Admin Control) */}
            <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  <span>শ্রমিক পোর্টাল লগইন পাসওয়ার্ড (Worker Portal Password)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const last4 = formMobile.replace(/[^0-9]/g, '').slice(-4);
                    setFormPortalPassword(last4 || '123456');
                  }}
                  className="text-[10.5px] text-indigo-700 hover:text-indigo-900 underline font-semibold cursor-pointer"
                >
                  ডিফল্ট সেট করুন
                </button>
              </div>
              <input
                type="text"
                value={formPortalPassword}
                onChange={(e) => setFormPortalPassword(e.target.value)}
                placeholder="পাসওয়ার্ড দিন (ডিফল্ট: মোবাইলের শেষ ৪ সংখ্যা বা 123456)"
                className="w-full p-2 bg-white border border-indigo-300 rounded-xl font-mono text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-[10.5px] text-slate-500">
                শ্রমিক এই পাসওয়ার্ড ও মোবাইল নম্বর দিয়ে তার ব্যক্তিগত প্রোফাইলে লগইন করে হাজিরা, ইন/আউট টাইম ও বেতন দেখতে পারবে।
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">স্থায়ী ও বর্তমান ঠিকানা</label>
              <textarea
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="গ্রাম, ডাকঘর, থানা, জেলা..."
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Employee Photo Upload or URL */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block font-bold text-slate-700">
                শ্রমিকের ছবি (চুক্তিপত্র ও আইডি কার্ডে ব্যবহৃত হবে)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {formPhotoUrl ? (
                  <img
                    src={formPhotoUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-400 shadow-xs shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 w-full space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs">
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>ডিভাইস থেকে ছবি আপলোড</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2.5 * 1024 * 1024) {
                            showToast('ছবির সাইজ ২.৫ মেগাবাইটের কম হতে হবে');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setFormPhotoUrl(reader.result as string);
                            showToast('ছবি সফলভাবে লোড হয়েছে');
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {formPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormPhotoUrl('')}
                        className="text-xs text-rose-600 hover:underline font-semibold"
                      >
                        ছবি সরান
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={formPhotoUrl}
                    onChange={(e) => setFormPhotoUrl(e.target.value)}
                    placeholder="অথবা ছবির URL দিন: https://example.com/photo.jpg"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Employee Signature Upload or Digital Pad */}
            <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4 text-amber-700" />
                  <span>শ্রমিকের স্বাক্ষর (চুক্তিপত্র, বরখাস্ত ও পদত্যাগ ফাইলের জন্য)</span>
                </label>
                <span className="text-[10px] text-amber-900 bg-amber-100 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                  স্বয়ংক্রিয়ভাবে ফর্মে বসবে
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {formSignatureUrl ? (
                  <div className="relative group p-1.5 bg-white rounded-lg border-2 border-amber-400 shadow-2xs shrink-0">
                    <img
                      src={formSignatureUrl}
                      alt="Signature Preview"
                      className="h-12 w-32 object-contain bg-white"
                    />
                    <div className="text-[9px] text-center text-slate-500 font-bold mt-0.5">স্বাক্ষর সংরক্ষিত</div>
                  </div>
                ) : (
                  <div className="h-12 w-32 rounded-lg bg-amber-100/50 border-2 border-dashed border-amber-300 flex flex-col items-center justify-center text-amber-600 shrink-0">
                    <FileSignature className="w-5 h-5 text-amber-500" />
                    <span className="text-[9px] font-bold">স্বাক্ষর নেই</span>
                  </div>
                )}

                <div className="flex-1 w-full space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="py-2 px-3 bg-white hover:bg-slate-50 border border-amber-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs transition active:scale-95">
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      <span>ডিভাইস থেকে স্বাক্ষর আপলোড (PNG/JPG)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2.5 * 1024 * 1024) {
                            showToast('স্বাক্ষর ফাইলের সাইজ ২.৫ মেগাবাইটের কম হতে হবে');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setFormSignatureUrl(reader.result as string);
                            showToast('✓ স্বাক্ষর সফলভাবে লোড হয়েছে');
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowSignaturePad((prev) => !prev)}
                      className="py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{showSignaturePad ? 'প্যাড বন্ধ করুন' : 'প্যাডে সই আঁকা (ঐচ্ছিক)'}</span>
                    </button>

                    {formSignatureUrl && (
                      <button
                        type="button"
                        onClick={() => setFormSignatureUrl('')}
                        className="text-xs text-rose-600 hover:underline font-bold"
                      >
                        স্বাক্ষর সরান
                      </button>
                    )}
                  </div>

                  {/* Expandable Digital Signature Canvas Pad */}
                  {showSignaturePad && (
                    <div className="p-2.5 bg-white border border-amber-300 rounded-xl shadow-xs space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs text-slate-700">
                        <span className="font-bold flex items-center gap-1 text-amber-900">
                          <PenTool className="w-3 h-3 text-amber-600" />
                          নিচের বক্সে মাউস বা আঙুল দিয়ে সই করুন:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const canvas = signatureCanvasRef.current;
                              if (canvas) {
                                const ctx = canvas.getContext('2d');
                                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                              }
                            }}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                          >
                            মুছুন (Clear)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const canvas = signatureCanvasRef.current;
                              if (canvas) {
                                const dataUrl = canvas.toDataURL('image/png');
                                setFormSignatureUrl(dataUrl);
                                setShowSignaturePad(false);
                                showToast('✓ ডিজিটাল স্বাক্ষর সংরক্ষিত হয়েছে');
                              }
                            }}
                            className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>সম্পন্ন (Save)</span>
                          </button>
                        </div>
                      </div>
                      <div className="border-2 border-dashed border-amber-300 rounded-lg overflow-hidden bg-white">
                        <canvas
                          ref={signatureCanvasRef}
                          width={320}
                          height={100}
                          className="w-full h-24 touch-none cursor-crosshair bg-white"
                          onMouseDown={(e) => {
                            const canvas = signatureCanvasRef.current;
                            if (!canvas) return;
                            const rect = canvas.getBoundingClientRect();
                            const scaleX = canvas.width / rect.width;
                            const scaleY = canvas.height / rect.height;
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;
                            ctx.strokeStyle = '#1e3a8a';
                            ctx.lineWidth = 2.5;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';
                            ctx.beginPath();
                            ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                            setIsDrawing(true);
                          }}
                          onMouseMove={(e) => {
                            if (!isDrawing) return;
                            const canvas = signatureCanvasRef.current;
                            if (!canvas) return;
                            const rect = canvas.getBoundingClientRect();
                            const scaleX = canvas.width / rect.width;
                            const scaleY = canvas.height / rect.height;
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;
                            ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                            ctx.stroke();
                          }}
                          onMouseUp={() => setIsDrawing(false)}
                          onMouseLeave={() => setIsDrawing(false)}
                          onTouchStart={(e) => {
                            const canvas = signatureCanvasRef.current;
                            if (!canvas || !e.touches[0]) return;
                            const rect = canvas.getBoundingClientRect();
                            const scaleX = canvas.width / rect.width;
                            const scaleY = canvas.height / rect.height;
                            const touch = e.touches[0];
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;
                            ctx.strokeStyle = '#1e3a8a';
                            ctx.lineWidth = 2.5;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';
                            ctx.beginPath();
                            ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                            setIsDrawing(true);
                          }}
                          onTouchMove={(e) => {
                            if (!isDrawing || !e.touches[0]) return;
                            const canvas = signatureCanvasRef.current;
                            if (!canvas) return;
                            const rect = canvas.getBoundingClientRect();
                            const scaleX = canvas.width / rect.width;
                            const scaleY = canvas.height / rect.height;
                            const touch = e.touches[0];
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;
                            ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                            ctx.stroke();
                          }}
                          onTouchEnd={() => setIsDrawing(false)}
                        />
                      </div>
                      <p className="text-[9.5px] text-slate-500 italic">
                        পরামর্শ: আঙুল বা মাউস দিয়ে সই করে "সম্পন্ন (Save)" বাটনে চাপুন। এটি নীল কালিতে ডিজিটাল স্বাক্ষর তৈরি করবে।
                      </p>
                    </div>
                  )}

                  <p className="text-[10px] text-amber-800">
                    💡 এই স্বাক্ষরটি নিয়োগ চুক্তিপত্র (Contract), চাকরি বরখাস্ত নোটিশ (Termination) ও পদত্যাগপত্রে (Resignation) স্বয়ংক্রিয়ভাবে যুক্ত হবে।
                  </p>
                </div>
              </div>
            </div>

            {/* Bank Information (Exact user request) */}
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
              <div className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
                <CreditCard className="w-4 h-4 text-blue-700" />
                <span>ব্যাংক তথ্য (চুক্তিপত্র ও বেতন স্থানান্তরের জন্য):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">ব্যাংক নাম</label>
                  <input
                    type="text"
                    value={formBankName}
                    onChange={(e) => setFormBankName(e.target.value)}
                    placeholder="যেমন: ডাচ বাংলা ব্যাংক / বিকাশ"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">একাউন্ট নাম</label>
                  <input
                    type="text"
                    value={formAccountName}
                    onChange={(e) => setFormAccountName(e.target.value)}
                    placeholder="শ্রমিকের নাম অনুযায়ী"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">একাউন্ট নাম্বার</label>
                  <input
                    type="text"
                    value={formAccountNumber}
                    onChange={(e) => setFormAccountNumber(e.target.value)}
                    placeholder="যেমন: ১২৩.১০১.XXXXX"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">চাকরির বর্তমান স্ট্যাটাস</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as EmploymentStatus)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white font-bold"
              >
                <option value="active">কর্মরত / সক্রিয় (Active)</option>
                <option value="resigned">পদত্যাগ / রিজাইনকৃত (Resigned)</option>
                <option value="suspended">সাময়িক স্থগিত (Suspended)</option>
                <option value="terminated">অব্যাহতিপ্রাপ্ত (Terminated)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors cursor-pointer"
              >
                {editId ? 'তথ্য আপডেট করুন' : 'নতুন কর্মচারী সংরক্ষণ করুন'}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors border border-slate-200 cursor-pointer"
                >
                  বাতিল
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ================= TAB 4: EMPLOYEE DETAILS & PRINT ================= */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <IdCard className="w-4 h-4 text-teal-700" />
              <span>শ্রমিকের বিস্তারিত প্রোফাইল ও প্রিন্ট</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                কর্মরত শ্রমিক নির্বাচন করুন ({toBengaliNumber(activeWorkingEmployees.length)} জন কর্মরত):
              </label>
              <span className="text-[11px] text-teal-700 font-semibold">
                শুধুমাত্র কর্মরত শ্রমিক
              </span>
            </div>
            <select
              value={detailSelectedId}
              onChange={(e) => {
                const newId = e.target.value;
                setDetailSelectedId(newId);
                try {
                  localStorage.setItem('texware_selected_detail_id', newId);
                } catch {}
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
            >
              {activeWorkingEmployees.length === 0 ? (
                <option value="">কোনো কর্মরত শ্রমিক নেই</option>
              ) : (
                activeWorkingEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.workerId} ({emp.designation})
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedDetailEmp && (
            <div
              id="employeeProfilePrintArea"
              ref={profilePrintRef}
              className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white"
            >
              <div className="bg-gradient-to-b from-slate-50 to-white p-5 text-center border-b border-slate-200">
                {/* Hidden photo input */}
                <input
                  type="file"
                  ref={profilePhotoInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePhotoUpload}
                />
                {/* Hidden signature input */}
                <input
                  type="file"
                  ref={profileSignatureInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfileSignatureUpload}
                />

                <div className="relative inline-block mx-auto mb-2 group">
                  {selectedDetailEmp.photoUrl ? (
                    <img
                      src={selectedDetailEmp.photoUrl}
                      alt={selectedDetailEmp.name}
                      onClick={() => setZoomedPhotoEmp(selectedDetailEmp)}
                      className="w-24 h-24 rounded-full object-cover border-3 border-white shadow-md cursor-pointer hover:scale-105 transition"
                      title="ছবি বড় করে দেখতে চাপুন"
                    />
                  ) : (
                    <div
                      onClick={() => profilePhotoInputRef.current?.click()}
                      className="w-24 h-24 rounded-full bg-slate-900 text-white text-3xl font-black flex items-center justify-center shadow-sm cursor-pointer hover:bg-slate-800 transition-colors"
                      title="ছবি যোগ করতে চাপুন"
                    >
                      {selectedDetailEmp.name.charAt(0)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => profilePhotoInputRef.current?.click()}
                    className="no-print absolute bottom-0 right-0 p-1.5 rounded-full bg-slate-900 text-white hover:bg-black shadow-md border-2 border-white cursor-pointer transition active:scale-90"
                    title="শ্রমিকের ছবি যুক্ত / পরিবর্তন করুন"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>

                <h3 className="text-base font-black text-slate-900">{selectedDetailEmp.name}</h3>
                <p className="text-xs text-slate-500">
                  {selectedDetailEmp.designation} • {selectedDetailEmp.department || 'সাধারণ'}
                </p>
                <div className="mt-1">
                  <span
                    className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      getStatusBadge(selectedDetailEmp.status).bg
                    }`}
                  >
                    {getStatusBadge(selectedDetailEmp.status).label}
                  </span>
                </div>

                {/* Quick actions for profile: photo, signature and contract letter */}
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap no-print">
                  <button
                    type="button"
                    onClick={() => profilePhotoInputRef.current?.click()}
                    className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-300"
                    title="কম্পিউটার বা মোবাইল থেকে ছবি ফাইল আপলোড করুন"
                  >
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>{selectedDetailEmp.photoUrl ? 'ছবি ফাইল পরিবর্তন' : 'ছবি আপলোড'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePromptPhotoUrl}
                    className="py-1.5 px-3 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-sky-300"
                    title="ছবির সরাসরি অনলাইন লিংক (URL) দিন"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                    <span>ছবির লিংক (URL)</span>
                  </button>

                  {selectedDetailEmp.photoUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => setZoomedPhotoEmp(selectedDetailEmp)}
                        className="py-1.5 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-indigo-200"
                        title="ছবি বড় করে দেখুন"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>ছবি বড় করুন</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemoveProfilePhoto}
                        className="py-1.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-rose-200"
                        title="শ্রমিকের ছবি মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>ছবি সরান</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => profileSignatureInputRef.current?.click()}
                    className="py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-amber-300"
                    title="শ্রমিকের ডিজিটাল স্বাক্ষর আপলোড করুন (চুক্তিপত্র ও বরখাস্ত ফাইলে অটো বসবে)"
                  >
                    <FileSignature className="w-3.5 h-3.5 text-amber-700" />
                    <span>{selectedDetailEmp.signatureUrl ? 'স্বাক্ষর পরিবর্তন' : 'স্বাক্ষর যোগ'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContractModalEmp(selectedDetailEmp)}
                    className="py-1.5 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 border border-amber-600"
                    title="শ্রমিক নিয়োগ চুক্তিপত্র (A4 সাইজ) প্রিন্ট করুন"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>চুক্তিপত্র প্রিন্ট (A4 Contract Letter)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCredentialModalEmp(selectedDetailEmp)}
                    className="py-1.5 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                    title="এই শ্রমিকের ব্যক্তিগত প্রোফাইল লিংক ও পাসওয়ার্ড নিয়ন্ত্রণ করুন"
                  >
                    <Key className="w-3.5 h-3.5 text-indigo-200" />
                    <span>লগইন লিংক ও পাসওয়ার্ড</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex p-3">
                  <div className="w-1/3 font-bold text-slate-600">Worker ID</div>
                  <div className="w-2/3 font-semibold text-slate-900">{selectedDetailEmp.workerId}</div>
                </div>
                <div className="flex p-3">
                  <div className="w-1/3 font-bold text-slate-600">মাসিক বেতন</div>
                  <div className="w-2/3 font-bold text-blue-700">{formatMoney(selectedDetailEmp.salary)} টাকা</div>
                </div>
                <div className="flex p-3">
                  <div className="w-1/3 font-bold text-slate-600">প্রতি ঘণ্টা OT</div>
                  <div className="w-2/3 font-semibold text-slate-900">{formatMoney(selectedDetailEmp.otRate)} টাকা</div>
                </div>
                <div className="flex p-3">
                  <div className="w-1/3 font-bold text-slate-600">যোগদানের তারিখ</div>
                  <div className="w-2/3 text-slate-800">{formatDateBn(selectedDetailEmp.joinDate)}</div>
                </div>
                <div className="flex p-3">
                  <div className="w-1/3 font-bold text-slate-600">জন্ম তারিখ</div>
                  <div className="w-2/3 text-slate-800">{formatDateBn(selectedDetailEmp.birthDate)}</div>
                </div>
                <div className="flex p-3">
                  <div className="w-1/3 font-bold text-slate-600">জাতীয় পরিচয়পত্র (NID)</div>
                  <div className="w-2/3 text-slate-800">{selectedDetailEmp.nid || '—'}</div>
                </div>
                <div className="flex p-3">
                  <div className="w-1/3 font-bold text-slate-600">মোবাইল নম্বর</div>
                  <div className="w-2/3 text-slate-800">{selectedDetailEmp.mobile || '—'}</div>
                </div>
                <div className="flex p-3">
                  <div className="w-1/3 font-bold text-slate-600">ঠিকানা</div>
                  <div className="w-2/3 text-slate-800">{selectedDetailEmp.address || '—'}</div>
                </div>

                <div className="flex p-3 bg-indigo-50/50 items-center justify-between flex-wrap gap-2 border-t border-indigo-100">
                  <div className="w-1/3 font-bold text-indigo-900 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    <span>পোর্টাল লগইন পাসওয়ার্ড</span>
                  </div>
                  <div className="w-2/3 flex items-center justify-between">
                    <span className="font-mono font-black text-indigo-950 bg-white px-2 py-0.5 rounded border border-indigo-200 text-xs">
                      {selectedDetailEmp.portalPassword ||
                        (selectedDetailEmp.mobile ? selectedDetailEmp.mobile.replace(/[^0-9]/g, '').slice(-4) : '123456')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCredentialModalEmp(selectedDetailEmp)}
                      className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                    >
                      পাসওয়ার্ড ও লিংক পরিবর্তন →
                    </button>
                  </div>
                </div>

                <div className="flex p-3 bg-amber-50/40 items-center justify-between flex-wrap gap-2 border-t border-amber-100">
                  <div className="w-1/3 font-bold text-slate-700 flex items-center gap-1.5">
                    <FileSignature className="w-4 h-4 text-amber-600" />
                    <span>ডিজিটাল স্বাক্ষর</span>
                  </div>
                  <div className="w-2/3 flex items-center justify-between flex-wrap gap-2">
                    {selectedDetailEmp.signatureUrl ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-white border border-amber-300 rounded shadow-2xs">
                          <img
                            src={selectedDetailEmp.signatureUrl}
                            alt="স্বাক্ষর"
                            className="h-8 max-w-[120px] object-contain"
                          />
                        </div>
                        <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          ✓ চুক্তিপত্র, বরখাস্ত ও পদত্যাগে স্বয়ংক্রিয় বসবে
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 italic">স্বাক্ষর যুক্ত নেই</span>
                        <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded">
                          আপলোড করতে পাশের বাটন চাপুন
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => profileSignatureInputRef.current?.click()}
                        className="py-1 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{selectedDetailEmp.signatureUrl ? 'স্বাক্ষর পরিবর্তন' : 'স্বাক্ষর আপলোড'}</span>
                      </button>
                      {selectedDetailEmp.signatureUrl && (
                        <button
                          type="button"
                          onClick={handleProfileSignatureRemove}
                          className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
                        >
                          মুছুন
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedDetailEmp.status === 'resigned' && (
                  <>
                    <div className="flex p-3 bg-rose-50/50">
                      <div className="w-1/3 font-bold text-rose-800">রিজাইনের তারিখ</div>
                      <div className="w-2/3 font-bold text-rose-900">{formatDateBn(selectedDetailEmp.resignationDate)}</div>
                    </div>
                    <div className="flex p-3 bg-rose-50/50">
                      <div className="w-1/3 font-bold text-rose-800">পদত্যাগের কারণ</div>
                      <div className="w-2/3 text-rose-900">{selectedDetailEmp.resignationReason || '—'}</div>
                    </div>
                    <div className="flex p-3 bg-rose-50/50">
                      <div className="w-1/3 font-bold text-rose-800">ক্লিয়ারেন্স ও দেনা-পাওনা</div>
                      <div className="w-2/3 text-rose-900">
                        {selectedDetailEmp.finalSettlementPaid ? 'সম্পূর্ণ পরিশোধিত' : 'বকেয়া রয়েছে'}
                      </div>
                    </div>
                  </>
                )}

                {selectedDetailEmp.status === 'suspended' && (
                  <>
                    <div className="flex p-3 bg-amber-50/50">
                      <div className="w-1/3 font-bold text-amber-800">স্থগিতাদেশের তারিখ</div>
                      <div className="w-2/3 font-bold text-amber-900">{formatDateBn(selectedDetailEmp.suspensionDate || selectedDetailEmp.resignationDate)}</div>
                    </div>
                    <div className="flex p-3 bg-amber-50/50">
                      <div className="w-1/3 font-bold text-amber-800">স্থগিতাদেশের মেয়াদ</div>
                      <div className="w-2/3 text-amber-900">{selectedDetailEmp.suspensionDuration || '৭ কার্যদিবস (তদন্ত সাপেক্ষে)'}</div>
                    </div>
                    <div className="flex p-3 bg-amber-50/50">
                      <div className="w-1/3 font-bold text-amber-800">স্থগিতের কারণ</div>
                      <div className="w-2/3 text-amber-900">{selectedDetailEmp.suspensionReason || '—'}</div>
                    </div>
                  </>
                )}

                {selectedDetailEmp.status === 'terminated' && (
                  <>
                    <div className="flex p-3 bg-slate-100/70">
                      <div className="w-1/3 font-bold text-slate-800">বরখাস্তের কার্যকর তারিখ</div>
                      <div className="w-2/3 font-bold text-slate-900">{formatDateBn(selectedDetailEmp.terminationDate || selectedDetailEmp.resignationDate)}</div>
                    </div>
                    <div className="flex p-3 bg-slate-100/70">
                      <div className="w-1/3 font-bold text-slate-800">বরখাস্তের কারণ</div>
                      <div className="w-2/3 text-slate-900">{selectedDetailEmp.terminationReason || '—'}</div>
                    </div>
                    <div className="flex p-3 bg-slate-100/70">
                      <div className="w-1/3 font-bold text-slate-800">ক্লিয়ারেন্স ও পাওনা স্থিতি</div>
                      <div className="w-2/3 text-slate-900">
                        {selectedDetailEmp.finalSettlementPaid ? 'পরিশোধিত' : 'বকেয়া রয়েছে'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Attendance & In/Out Time Dashboard inside Profile and Print */}
              <div className="p-4 border-t border-slate-200">
                <EmployeeAttendanceProfileView
                  employee={selectedDetailEmp}
                  records={attendanceRecords}
                  employees={employees}
                  showToast={showToast}
                  allowQuickMark={true}
                />
              </div>

              {/* Profile Bottom Actions */}
              <div className="p-3 bg-slate-50 flex items-center justify-end flex-wrap gap-2">
                {selectedDetailEmp.status === 'resigned' && (
                  <button
                    type="button"
                    onClick={() => {
                      setResignationLetterModalEmp(selectedDetailEmp);
                      onOpenResignationLetter?.(selectedDetailEmp);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs active:scale-95"
                    title="১-ক্লিকে পদত্যাগ ফরম প্রিন্ট করুন"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>১-ক্লিক রিজাইন ফরম প্রিন্ট</span>
                  </button>
                )}
                {selectedDetailEmp.status === 'suspended' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSuspensionNoticeModalEmp(selectedDetailEmp);
                      onOpenSuspensionNotice?.(selectedDetailEmp);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs active:scale-95"
                    title="১-ক্লিকে সাময়িক স্থগিতাদেশ নোটিশ প্রিন্ট করুন"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>১-ক্লিক স্থগিত নোটিশ প্রিন্ট</span>
                  </button>
                )}
                {selectedDetailEmp.status === 'terminated' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTerminationNoticeModalEmp(selectedDetailEmp);
                      onOpenTerminationNotice?.(selectedDetailEmp);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs active:scale-95"
                    title="১-ক্লিকে চাকরি হতে অব্যাহতি ও বরখাস্ত আদেশ প্রিন্ট করুন"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>১-ক্লিক অব্যাহতি পত্র প্রিন্ট</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setNoticeTargetEmp(selectedDetailEmp);
                    setNoticeModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold border border-indigo-200 text-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                  title="এই শ্রমিককে ব্যক্তিগত নোটিশ পাঠান"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>নোটিশ পাঠান</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenResignationModal(selectedDetailEmp)}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold border border-rose-200 text-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>রিজাইন আপডেট</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleEditEmployee(selectedDetailEmp)}
                  className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold border border-amber-200 text-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>এডিট</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEmployee(selectedDetailEmp)}
                  className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-bold border border-red-200 text-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>ডিলিট</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyEmployee(selectedDetailEmp)}
                  className="px-3 py-1.5 rounded-lg bg-white text-slate-700 hover:bg-slate-100 font-semibold border border-slate-200 text-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>কপি</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContractModalEmp(selectedDetailEmp)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-xs border border-amber-600"
                  title="শ্রমিক নিয়োগ চুক্তিপত্র (A4 সাইজ) প্রিন্ট করুন"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>চুক্তিপত্র (Contract Letter)</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintProfile}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-black font-semibold text-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>প্রিন্ট প্রোফাইল</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: TELEGRAM SETTINGS ================= */}
      {activeTab === 'telegram' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 space-y-4">
          {/* Sub Navigation for Password & Settings */}
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={() => handleTabChange('password')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>অ্যাডমিন পাসওয়ার্ড</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('telegram')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-900 text-white transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-teal-300" />
              <span>Telegram Bot</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('sms')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Auto SMS (Bulk)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('factory')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>কারখানার তথ্য ও চুক্তি</span>
            </button>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Telegram Bot Settings</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 leading-relaxed space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <span>💡 Telegram Bot ও Web App ব্যবহারের নিয়মাবলী:</span>
            </div>
            <p>
              • <b>টেলিগ্রাম বটে লিংক অ্যাড:</b> নিচের "ওয়েব অ্যাপ লিংক" কপি করে @BotFather-এ গিয়ে আপনার বটের Menu Button বা Inline WebApp হিসেবে যুক্ত করতে পারেন।
            </p>
            <p>
              • <b>প্রিন্টিং সংক্রান্ত তথ্য:</b> মোবাইলের টেলিগ্রাম অ্যাপ ব্রাউজারে সিস্টেম প্রিন্ট সাপোর্ট করে না। তাই ব্যবহারকারীরা অ্যাপের উপরে থাকা <b>"ব্রাউজারে খুলুন"</b> বাটনে ক্লিক করলে সরাসরি Chrome/Safari দিয়ে ব্লুটুথ ও থার্মাল প্রিন্টারে প্রিন্ট করতে পারবেন।
            </p>
            <p>
              • <b>কর্মচারী ডিলিট ও ম্যানেজমেন্ট:</b> এখন টেলিগ্রাম বট বা যে কোনো সংযোগে কর্মী ডিলিট ও বেতন খাতা তাৎক্ষণিকভাবে আপডেট হবে।
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {/* User App Link for Employees */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>১. ইউজার অ্যাপ লিংক (সাধারণ কর্মীদের বেতন দেখার জন্য)</span>
                </label>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                  নিরাপদ (কোনো এডমিন লিংক নেই)
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? window.location.origin : ''}
                  className="w-full py-2.5 px-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-800 font-mono text-[11px] select-all cursor-text"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(window.location.origin);
                      showToast('ইউজার অ্যাপ লিংক কপি হয়েছে (বট বা কর্মীদের দিন)');
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>কপি</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                টেলিগ্রাম বট বা কর্মীদের মেসেজে এই লিংকটি দিন। কর্মীরা এতে শুধু বেতন হিসাব করতে পারবে, নিচে কোনো এডমিন লিংক বা ট্যাব থাকবে না।
              </p>
            </div>

            {/* Admin Panel Direct Link */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>২. এডমিন প্যানেল সরাসরি লিংক (মালিক/এইচআর ব্যবহারের জন্য)</span>
                </label>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                  পাসওয়ার্ড সুরক্ষিত
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/?mode=admin` : ''}
                  className="w-full py-2.5 px-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-800 font-mono text-[11px] select-all cursor-text"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(`${window.location.origin}/?mode=admin`);
                      showToast('এডমিন লিংক কপি করা হয়েছে');
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>কপি</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                আপনার ব্রাউজারে বুকমার্ক করে রাখতে পারেন। সরাসরি এডমিন প্যানেল ওপেন হবে।
              </p>
            </div>

            {/* Worker Portal Individual & General Links */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>৩. শ্রমিকদের প্রোফাইল লগইন লিংক (Worker Portal)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAllWorkersLoginModal(true)}
                  className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200 cursor-pointer transition flex items-center gap-1"
                >
                  <Key className="w-3 h-3 text-indigo-600" />
                  <span>আলাদা আলাদা লিংক তালিকা দেখুন →</span>
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/texwareworker` : ''}
                  className="w-full py-2.5 px-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-800 font-mono text-[11px] select-all cursor-text"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(`${window.location.origin}/texwareworker`);
                      showToast('✓ সাধারণ পোর্টাল লিংক কপি করা হয়েছে (প্রতিটি শ্রমিকের নিজস্ব আলাদা লিংক পেতে "আলাদা আলাদা লিংক তালিকা দেখুন" বাটনে চাপুন)');
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>কপি</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                প্রতিটি শ্রমিকের জন্য আলাদা আলাদা ব্যক্তিগত লিংক তৈরি রয়েছে। কর্মীর নামের পাশে &apos;লগইন লিংক ও পাসওয়ার্ড&apos; বা উপরের &apos;আলাদা আলাদা লিংক তালিকা দেখুন&apos; থেকে নির্দিষ্ট লিংক কপি করতে পারবেন।
              </p>
            </div>

            {/* Universal Investor Portal Link */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>৪. সকল ইনভেস্টরের সাধারণ লগইন লিংক (Investor Portal: texwareinvestment)</span>
                </label>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                  ইনভেস্টর পোর্টাল
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/texwareinvestment` : ''}
                  className="w-full py-2.5 px-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-800 font-mono text-[11px] select-all cursor-text"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(`${window.location.origin}/texwareinvestment`);
                      showToast('✓ সকল ইনভেস্টরের একক পোর্টাল লিংক (texwareinvestment) কপি করা হয়েছে');
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>কপি</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                সব বিনিয়োগকারী অংশীদার এই একক লিংক ব্যবহার করে তাদের মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করবেন।
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Telegram Bot Token
              </label>
              <div className="relative">
                <input
                  type={showTgToken ? 'text' : 'password'}
                  value={tgSettings.botToken}
                  onChange={(e) => setTgSettings({ ...tgSettings, botToken: e.target.value })}
                  placeholder="যেমন: 123456789:ABCdefGhIJKlmNoPQRstuVWxyz"
                  className="w-full py-2.5 pl-3 pr-10 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowTgToken(!showTgToken)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showTgToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={tgSettings.chatId}
                onChange={(e) => setTgSettings({ ...tgSettings, chatId: e.target.value })}
                placeholder="যেমন: 987654321 বা @channel_username"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
              <div>
                <div className="font-bold text-emerald-950 text-xs">
                  শ্রমিকের বেতন স্ট্যাটাস আপডেটে অটো Telegram নোটিফিকেশন
                </div>
                <div className="text-[11px] text-emerald-800">
                  যেকোনো শ্রমিকের বেতন স্ট্যাটাস পরিবর্তন হলে বটে সাথে সাথে মেসেজ যাবে
                </div>
              </div>
              <input
                type="checkbox"
                checked={tgSettings.notifyOnSalary !== false}
                onChange={(e) => setTgSettings({ ...tgSettings, notifyOnSalary: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
              />
            </label>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveTelegram}
                className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
              >
                সেটিংস Save করুন
              </button>

              <button
                type="button"
                disabled={tgTesting}
                onClick={handleTestTelegram}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{tgTesting ? 'পরীক্ষা হচ্ছে...' : 'Telegram Test'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 6: AUTO MESSAGE / SMS ================= */}
      {activeTab === 'sms' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 space-y-4">
          {/* Sub Navigation for Password & Settings */}
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={() => handleTabChange('password')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>অ্যাডমিন পাসওয়ার্ড</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('telegram')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-slate-500" />
              <span>Telegram Bot</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('sms')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-900 text-white transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-teal-300" />
              <span>Auto SMS (Bulk)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('factory')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>কারখানার তথ্য ও চুক্তি</span>
            </button>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Auto Message / SMS (BulkSMSBD)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSmsMode('single')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                smsMode === 'single'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              একজন শ্রমিককে SMS
            </button>
            <button
              type="button"
              onClick={() => setSmsMode('bulk')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                smsMode === 'bulk'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              সকল শ্রমিককে নোটিশ (Bulk)
            </button>
          </div>

          {/* Single SMS Form */}
          {smsMode === 'single' ? (
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">শ্রমিক নির্বাচন করুন</label>
                <select
                  value={singleSmsEmpId}
                  onChange={(e) => setSingleSmsEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                >
                  <option value="">-- শ্রমিক নির্বাচন করুন --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.mobile || 'মোবাইল নেই'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">মেসেজ লিখুন</label>
                <textarea
                  value={singleSmsMsg}
                  onChange={(e) => setSingleSmsMsg(e.target.value)}
                  rows={3}
                  placeholder="আপনার মেসেজ লিখুন..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <button
                type="button"
                disabled={isSendingSms}
                onClick={handleSendSingleSMS}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold transition shadow-xs"
              >
                {isSendingSms ? 'পাঠানো হচ্ছে...' : 'SMS পাঠান'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700">প্রাপক তালিকা নির্বাচন</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedBulkEmpIds(employees.map((e) => e.id))}
                      className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                    >
                      সব নির্বাচন
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBulkEmpIds([])}
                      className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                    >
                      সব বাদ
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                  {employees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBulkEmpIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBulkEmpIds([...selectedBulkEmpIds, emp.id]);
                          } else {
                            setSelectedBulkEmpIds(selectedBulkEmpIds.filter((id) => id !== emp.id));
                          }
                        }}
                        className="w-3.5 h-3.5 text-blue-600 rounded"
                      />
                      <div className="flex-1 text-[11px]">
                        <b>{emp.name}</b> <span className="text-slate-500">({emp.mobile || 'মোবাইল নেই'})</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">নোটিশ বার্তা</label>
                <textarea
                  value={bulkSmsMsg}
                  onChange={(e) => setBulkSmsMsg(e.target.value)}
                  rows={3}
                  placeholder="যেমন: জরুরি নোটিশ: আগামীকাল কারখানা সকাল ৮টায় শুরু হবে।"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <button
                type="button"
                disabled={isSendingSms}
                onClick={handleSendBulkSMS}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold transition shadow-xs"
              >
                {isSendingSms ? 'পাঠানো হচ্ছে...' : `নির্বাচিত ${selectedBulkEmpIds.length} জনকে SMS পাঠান`}
              </button>
            </div>
          )}

          {/* BulkSMSBD API Parameters Box */}
          <div className="pt-3 border-t border-slate-100 text-xs space-y-2.5">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>BulkSMSBD API সেটিংস</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 mb-0.5">API URL</label>
                <input
                  type="text"
                  value={smsSettings.apiUrl}
                  onChange={(e) => setSmsSettingsState({ ...smsSettings, apiUrl: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-0.5">API Key</label>
                <input
                  type="password"
                  value={smsSettings.apiKey}
                  onChange={(e) => setSmsSettingsState({ ...smsSettings, apiKey: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-0.5">Sender ID</label>
                <input
                  type="text"
                  value={smsSettings.senderId}
                  onChange={(e) => setSmsSettingsState({ ...smsSettings, senderId: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-0.5">HTTP Method</label>
                <select
                  value={smsSettings.method}
                  onChange={(e) =>
                    setSmsSettingsState({ ...smsSettings, method: e.target.value as 'GET' | 'POST' })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSmsSettings}
              className="py-2 px-4 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-900 transition"
            >
              SMS API Settings Save
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 7: PASSWORD & LOGOUT ================= */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 space-y-4 max-w-lg mx-auto">
          {/* Sub Navigation for Password & Settings */}
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={() => handleTabChange('password')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-900 text-white transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-teal-300" />
              <span>অ্যাডমিন পাসওয়ার্ড</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('telegram')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-slate-500" />
              <span>Telegram Bot</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('sms')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Auto SMS (Bulk)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('factory')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>কারখানার তথ্য ও চুক্তি</span>
            </button>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Admin Password পরিবর্তন ও ক্লাউড নিরাপত্তা</span>
            </div>
            {!adminSecurity.isDefaultPassword ? (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ক্লাউড সিকিউরিটি সক্রিয়
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                ডিফল্ট পাসওয়ার্ড সক্রিয়
              </span>
            )}
          </div>

          {/* Cloud Security Guarantee Banner */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>🔒 স্বয়ংক্রিয় ক্লাউড সিঙ্ক সিকিউরিটি:</span>
            </div>
            <p className="text-[11.5px] text-blue-800">
              আপনি এখানে একবার পাসওয়ার্ড পরিবর্তন করলেই তা সরাসরি ক্লাউড ফায়ারবেস ডেটাবেজে সংরক্ষিত হয়ে যাবে। এরপর আপনি যাকে খুশি এই সাইটের লিংক প্রদান করলেও আপনার দেওয়া এই পাসওয়ার্ড ছাড়া কেউ কখনো ১২৩৪৫৬ বা অন্য কোনো কোড দিয়ে এডমিন প্যানেলে প্রবেশ করতে পারবে না।
            </p>
            {!adminSecurity.isDefaultPassword ? (
              <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 pt-1 border-t border-blue-200/60">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>বর্তমানে আপনার নির্ধারিত পাসওয়ার্ড কার্যকর রয়েছে এবং ১২৩৪৫৬ সম্পূর্ণ নিষ্ক্রিয়।</span>
              </div>
            ) : (
              <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 pt-1 border-t border-blue-200/60">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>নিরাপত্তার স্বার্থে এখনই আপনার নিজস্ব পাসওয়ার্ড সেট করুন।</span>
              </div>
            )}
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">বর্তমান পাসওয়ার্ড *</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">নতুন পাসওয়ার্ড *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="কমপক্ষে ৬ অক্ষর"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">নতুন পাসওয়ার্ড নিশ্চিত করুন *</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-xs"
            >
              পাসওয়ার্ড পরিবর্তন করুন
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs flex items-center justify-center gap-2 text-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Admin Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 9: FACTORY & AGREEMENT SETTINGS ================= */}
      {activeTab === 'factory' && (
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200/90 space-y-5 max-w-2xl mx-auto">
          {/* Sub Navigation for Settings */}
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={() => handleTabChange('password')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>অ্যাডমিন পাসওয়ার্ড</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('telegram')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-slate-500" />
              <span>Telegram Bot</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('sms')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Auto SMS (Bulk)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('factory')}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 bg-slate-900 text-white transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-teal-300" />
              <span>কারখানার তথ্য ও চুক্তি</span>
            </button>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-700" />
                <span>কারখানার পরিচিতি ও চুক্তিপত্র (Agreement) সেটিংস</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                এখানে দেওয়া কারখানার নাম, ঠিকানা ও ফোন নম্বর স্বয়ংক্রিয়ভাবে সকল চুক্তিপত্র ও অফিশিয়াল নথিতে প্রদর্শিত হবে।
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveFactoryProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  কারখানার নাম (বাংলায়) *
                </label>
                <input
                  type="text"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  placeholder="যেমন: টেক্স ওয়ার অ্যাপারেলস"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Factory Name (in English)
                </label>
                <input
                  type="text"
                  value={facNameEn}
                  onChange={(e) => setFacNameEn(e.target.value)}
                  placeholder="e.g. TexWare Apparels Ltd."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                কারখানার পূর্ণাঙ্গ ঠিকানা (বাংলায়) *
              </label>
              <textarea
                required
                rows={2}
                value={facAddress}
                onChange={(e) => setFacAddress(e.target.value)}
                placeholder="যেমন: কারখানা কমপ্লেক্স, রোড # ০৩, কোনাবাড়ী বিসিক শিল্প এলাকা, গাজীপুর, ঢাকা।"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs leading-relaxed focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-[10.5px] text-slate-400">এই ঠিকানা চুক্তিপত্রের শীর্ষে লেটারহেডে মুদ্রিত হবে।</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  যোগাযোগের ফোন নম্বর (Phone) *
                </label>
                <input
                  type="text"
                  required
                  value={facPhone}
                  onChange={(e) => setFacPhone(e.target.value)}
                  placeholder="যেমন: +৮৮০১৭১২-৩৪৫৬৭৮, +৮৮০১৯১১-২২৩৩৪৪"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  অফিশিয়াল ইমেইল (Email)
                </label>
                <input
                  type="email"
                  value={facEmail}
                  onChange={(e) => setFacEmail(e.target.value)}
                  placeholder="info@texwareapparels.com"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* ================= CONTRACT RULES & AGREEMENT CLAUSES ================= */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gradient-to-r from-teal-50 to-slate-50 p-3 rounded-xl border border-teal-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-black shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>চুক্তিপত্রের শর্তাবলি ও কারখানার নিয়ম-কানুন</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold border border-teal-300">
                        {toBengaliNumber(facContractRules.length)} টি শর্ত সক্রিয়
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      এখানে যেকোনো শর্ত সম্পাদন, নতুন নিয়ম যোগ অথবা মুছতে পারেন। A4 চুক্তিপত্রে সরাসরি মুদ্রিত হবে।
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isBulkRulesMode) {
                        setBulkRulesText(facContractRules.join('\n'));
                      } else {
                        const parsed = bulkRulesText
                          .split('\n')
                          .map((l) => l.trim().replace(/^\d+[\.\-\)]\s*/, ''))
                          .filter((l) => l.length > 0);
                        if (parsed.length > 0) {
                          setFacContractRules(parsed);
                        }
                      }
                      setIsBulkRulesMode(!isBulkRulesMode);
                    }}
                    className="py-1 px-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                  >
                    {isBulkRulesMode ? '✓ প্রতিটি শর্ত আলাদা ভিউ' : '📝 বালক টেক্সট ভিউ (একক বক্স)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetContractRules}
                    className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                    title="ডিফল্ট ৮টি শর্ত ফিরিয়ে আনুন"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>ডিফল্ট ৮টি শর্ত</span>
                  </button>
                </div>
              </div>

              {isBulkRulesMode ? (
                /* Bulk Textarea Editor */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>প্রতি লাইনে একটি করে শর্ত লিখুন বা পেস্ট করুন:</span>
                    <span className="text-[10px] text-slate-400">প্রতিটি লাইন চুক্তিপত্রে আলাদা শর্ত হিসেবে প্রদর্শিত হবে</span>
                  </div>
                  <textarea
                    rows={8}
                    value={bulkRulesText}
                    onChange={(e) => setBulkRulesText(e.target.value)}
                    placeholder="১. এই চুক্তি অনির্দিষ্টকালের জন্য...&#10;২. প্রতিদিন ৮ ঘণ্টা কাজ করতে হবে..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs leading-relaxed font-sans focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              ) : (
                /* Clause-by-Clause Cards */
                <div className="space-y-2">
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {facContractRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 hover:bg-white rounded-xl border border-slate-200 hover:border-teal-300 transition-all flex items-start gap-2 shadow-2xs group"
                      >
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 font-black text-xs flex items-center justify-center border border-teal-300">
                            {toBengaliNumber(idx + 1)}
                          </span>
                          <div className="flex flex-col gap-0.5 opacity-60 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveContractRule(idx, 'up')}
                              title="উপরে নিন"
                              className="p-0.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === facContractRules.length - 1}
                              onClick={() => handleMoveContractRule(idx, 'down')}
                              title="নিচে নিন"
                              className="p-0.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex-1">
                          <textarea
                            rows={2}
                            value={rule}
                            onChange={(e) => handleUpdateContractRule(idx, e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed focus:ring-1 focus:ring-teal-500 outline-none resize-y"
                            placeholder={`শর্ত #${toBengaliNumber(idx + 1)} লিখুন...`}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteContractRule(idx)}
                          title="এই শর্তটি মুছুন"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition shrink-0 cursor-pointer self-start"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Rule Box */}
                  <div className="p-3 bg-teal-50/60 rounded-xl border border-dashed border-teal-300 space-y-2">
                    <label className="block font-bold text-teal-950 text-xs">
                      + নতুন নিয়ম বা শর্ত যোগ করুন:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newRuleInput}
                        onChange={(e) => setNewRuleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddContractRule();
                          }
                        }}
                        placeholder="যেমন: কারখানায় মোবাইল ফোন ব্যবহার সংক্রান্ত বা বিশেষ নিয়ম..."
                        className="flex-1 p-2 bg-white border border-teal-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddContractRule}
                        className="py-2 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1 transition shadow-xs cursor-pointer active:scale-95 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>শর্ত যোগ করুন</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Worker Declaration text */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-bold text-slate-800 text-xs mb-1">
                  শ্রমিকের ঘোষণাবাক্য (Worker's Declaration Text):
                </label>
                <input
                  type="text"
                  value={facContractDeclaration}
                  onChange={(e) => setFacContractDeclaration(e.target.value)}
                  placeholder="আমি উক্ত কারখানার সকল নিয়ম মেনে কাজ করবো।"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-teal-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  এটি চুক্তিপত্রের শর্তাবলির নিচে কোটেশন চিহ্নের ভেতরে মুদ্রিত হবে।
                </span>
              </div>
            </div>

            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-2.5 text-teal-950">
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[11.5px]">
                <strong className="block text-teal-900">স্বয়ংক্রিয় লাইভ সিঙ্ক:</strong>
                <span>
                  এখানে যেকোনো পরিবর্তন সংরক্ষণ করলে তা তাৎক্ষণিকভাবে সকল কর্মচারীর A4 চুক্তিপত্রে (Agreement Form) যুক্ত হয়ে যাবে।
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setFacName(DEFAULT_FACTORY_SETTINGS.name);
                  setFacNameEn(DEFAULT_FACTORY_SETTINGS.nameEn || '');
                  setFacAddress(DEFAULT_FACTORY_SETTINGS.address);
                  setFacPhone(DEFAULT_FACTORY_SETTINGS.phone);
                  setFacEmail(DEFAULT_FACTORY_SETTINGS.email || '');
                  setFacContractRules(DEFAULT_CONTRACT_RULES);
                  setFacContractDeclaration(DEFAULT_CONTRACT_DECLARATION);
                  setBulkRulesText(DEFAULT_CONTRACT_RULES.join('\n'));
                  showToast('ডিফল্ট কারখানার তথ্য ও ৮টি শর্ত রিস্টোর করা হয়েছে');
                }}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ডিফল্ট তথ্য ও ৮টি শর্ত রিসেট</span>
              </button>

              <button
                type="submit"
                disabled={isSavingFac}
                className="py-2.5 px-6 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingFac ? 'সংরক্ষণ হচ্ছে...' : 'কারখানার তথ্য ও চুক্তিপত্র Save করুন'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= TAB 10: JOB APPLICATIONS & PENDING APPLICANTS ================= */}
      {activeTab === 'applications' && (
        <JobApplicationsAdminTab
          existingEmployees={employees}
          onOpenContractLetter={(emp) => setContractModalEmp(emp)}
          onOpenNewApplicationForm={() => setShowDirectAppForm(true)}
          showToast={showToast}
        />
      )}

      {/* Modal / Overlay for Filling Job Application Form from Admin */}
      {showDirectAppForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl my-auto overflow-hidden border border-slate-200 max-h-[96vh] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
              <JobApplicationForm
                onBackToApp={() => setShowDirectAppForm(false)}
                showToast={showToast}
                isStandalone={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= EMPLOYEE DELETE CONFIRMATION MODAL ================= */}
      {deleteConfirmEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                কর্মচারী মুছে ফেলতে চান?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                আপনি কি নিশ্চিত যে <b>"{deleteConfirmEmp.name}"</b> (ID: {deleteConfirmEmp.workerId})-কে ডাটাবেজ থেকে স্থায়ীভাবে মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।
              </p>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-left text-[11px] text-rose-800 space-y-1">
              <div>• নাম: <b>{deleteConfirmEmp.name}</b></div>
              <div>• পদবি: {deleteConfirmEmp.designation}</div>
              <div>• বিভাগ: {deleteConfirmEmp.department || 'সাধারণ'}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmEmp(null)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmExecuteDelete}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মুছে ফেলুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SALARY RECORD DELETE CONFIRMATION MODAL ================= */}
      {deleteSalaryRecordTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                বেতন রেকর্ড মুছে ফেলতে চান?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                আপনি কি নিশ্চিত যে <b>"{deleteSalaryRecordTarget.employeeName}"</b>-এর <b>{deleteSalaryRecordTarget.month}</b> মাসের বেতন রেকর্ড মুছে ফেলতে চান?
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-[11px] text-slate-700 space-y-1">
              <div>• কর্মী: <b>{deleteSalaryRecordTarget.employeeName}</b> ({deleteSalaryRecordTarget.workerId})</div>
              <div>• মাস: {deleteSalaryRecordTarget.month} {deleteSalaryRecordTarget.year}</div>
              <div>• পরিশোধিত: {formatMoney(deleteSalaryRecordTarget.paidAmount)} ৳ ({deleteSalaryRecordTarget.paymentMethod})</div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteSalaryRecordTarget(null)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={confirmExecuteDeleteSalaryRecord}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>হ্যাঁ, মুছুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SALARY RECORD EDIT MODAL ================= */}
      {editingSalaryRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-teal-300 flex items-center justify-center font-bold">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    শ্রমিকের বেতন হিসাব সম্পাদন (Edit Salary)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingSalaryRecord.employeeName} (ID: {editingSalaryRecord.workerId}) — {editingSalaryRecord.month} {editingSalaryRecord.year}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSalaryRecord(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedSalaryRecord} className="space-y-3 text-xs text-slate-800">
              {/* Row 1: Basic Salary, Total Days, Present Days */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">মূল বেতন (৳)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editRecBasicSalary}
                    onChange={(e) => setEditRecBasicSalary(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">মোট কার্যদিবস</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={editRecTotalDays}
                    onChange={(e) => setEditRecTotalDays(Number(e.target.value) || 26)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">উপস্থিত দিন</label>
                  <input
                    type="number"
                    min={0}
                    max={editRecTotalDays}
                    required
                    value={editRecPresentDays}
                    onChange={(e) => setEditRecPresentDays(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 2: OT Hours, OT Rate, Bonus */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">ওভারটাইম ঘণ্টা</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editRecOtHours}
                    onChange={(e) => setEditRecOtHours(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">ওটি দর (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={editRecOtRate}
                    onChange={(e) => setEditRecOtRate(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">বোনাস (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={editRecBonus}
                    onChange={(e) => setEditRecBonus(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-amber-700 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 3: Advance, Deduction, Deduction Reason */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">অগ্রিম কর্তন (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={editRecAdvance}
                    onChange={(e) => setEditRecAdvance(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-rose-700 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">অন্যান্য কর্তন (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={editRecDeduction}
                    onChange={(e) => setEditRecDeduction(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-rose-700 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">কর্তনের কারণ</label>
                  <input
                    type="text"
                    value={editRecDeductionReason}
                    onChange={(e) => setEditRecDeductionReason(e.target.value)}
                    placeholder="যেমন: জরিমানা"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 4: Net Payable & Paid Amount & Auto Due */}
              <div className="grid grid-cols-3 gap-2.5 p-2.5 bg-blue-50/60 rounded-xl border border-blue-200">
                <div>
                  <label className="block text-[11px] font-black text-blue-900 mb-1">সর্বমোট নিট বেতন (৳)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editRecNetPayable}
                    onChange={(e) => setEditRecNetPayable(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-blue-300 rounded-lg font-black text-blue-950 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-emerald-900 mb-1">প্রদত্ত টাকা (Paid) ৳</label>
                  <input
                    type="number"
                    min={0}
                    value={editRecPaidAmount}
                    onChange={(e) => {
                      const paid = Number(e.target.value) || 0;
                      setEditRecPaidAmount(paid);
                      if (paid >= editRecNetPayable && editRecNetPayable > 0) {
                        setEditRecPaymentStatus('paid');
                      } else if (paid > 0) {
                        setEditRecPaymentStatus('partial');
                      }
                    }}
                    className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-black text-emerald-700 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-rose-900 mb-1">বকেয়া টাকা (Due) ৳</label>
                  <div className="p-2 bg-white border border-rose-300 rounded-lg font-black text-rose-700 text-sm">
                    {formatMoney(Math.max(0, editRecNetPayable - editRecPaidAmount))} ৳
                  </div>
                </div>
              </div>

              {/* Row 5: Payment Method & Payment Status */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">পেমেন্ট মাধ্যম</label>
                  <select
                    value={editRecPaymentMethod}
                    onChange={(e) => setEditRecPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">💵 ক্যাশ (নগদ)</option>
                    <option value="bkash">📱 বিকাশ (bKash)</option>
                    <option value="nagad">📲 নগদ (Nagad)</option>
                    <option value="rocket">🟣 রকেট (Rocket)</option>
                    <option value="bank">🏦 ব্যাংক (Bank)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">বেতন স্ট্যাটাস (শ্রমিক প্রোফাইলে দৃশ্যমান)</label>
                  <select
                    value={
                      editRecProgressStatus === 'disbursed' || editRecPaymentStatus === 'paid'
                        ? 'disbursed'
                        : editRecProgressStatus === 'ready'
                        ? 'ready'
                        : editRecProgressStatus === 'calculated'
                        ? 'calculated'
                        : 'due'
                    }
                    onChange={(e) => {
                      const val = e.target.value as SalaryProgressStatus;
                      setEditRecProgressStatus(val);
                      if (val === 'disbursed') {
                        setEditRecPaymentStatus('paid');
                        setEditRecPaidAmount(editRecNetPayable);
                      } else if (val === 'due') {
                        setEditRecPaymentStatus('due');
                        setEditRecPaidAmount(0);
                      } else {
                        setEditRecPaymentStatus('pending');
                      }
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="due">⌛ বাকী</option>
                    <option value="calculated">📋 হিসাব সম্পূর্ণ</option>
                    <option value="ready">⏳ বেতন দেওয়ার জন্য প্রস্তুত</option>
                    <option value="disbursed">✓ বেতন প্রদান করা সম্পূর্ণ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">মন্তব্য (Note)</label>
                <input
                  type="text"
                  value={editRecNote}
                  onChange={(e) => setEditRecNote(e.target.value)}
                  placeholder="যেমন: ছুটির সমন্বয় অথবা স্পেশাল অনুমতি"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSalaryRecord(null)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isEditingSalarySaving}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEditingSalarySaving ? 'সংরক্ষণ হচ্ছে...' : 'হিসাব সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 1-CLICK MONTH-BASED SALARY BATCH DELETE MODAL ================= */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                মাস অনুযায়ী সবার হিসাব এক ক্লিকে মুছুন
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                যে মাসের সকল শ্রমিকের বেতন হিসাব এক ক্লিকে মুছে ফেলতে চান, সেই মাস ও বছর নির্বাচন করুন:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">মাস নির্বাচন</label>
                <select
                  value={batchDeleteMonth}
                  onChange={(e) => setBatchDeleteMonth(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
                >
                  {BENGALI_MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">বছর নির্বাচন</label>
                <select
                  value={batchDeleteYear}
                  onChange={(e) => setBatchDeleteYear(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{toBengaliNumber(y)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-left text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>বিদ্যমান রেকর্ড সংখ্যা:</span>
                <span className="text-sm font-black text-rose-950 bg-rose-100 px-2 py-0.5 rounded-md">
                  {toBengaliNumber(recordsInSelectedBatchMonth.length)} জন
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-1">
                ⚠️ সতর্কতা: এই অ্যাকশনটি নিশ্চিত করলে {batchDeleteMonth} {toBengaliNumber(batchDeleteYear)} সালের সকল শ্রমিকের বেতন হিসাব স্থায়ীভাবে ডাটাবেজ থেকে মুছে যাবে।
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={() => setShowBatchDeleteModal(false)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isBatchDeleting || recordsInSelectedBatchMonth.length === 0}
                onClick={handleExecuteBatchDeleteByMonth}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isBatchDeleting
                    ? 'মুছে ফেলা হচ্ছে...'
                    : recordsInSelectedBatchMonth.length === 0
                    ? 'কোনো রেকর্ড নেই'
                    : `এক ক্লিকে মুছুন (${toBengaliNumber(recordsInSelectedBatchMonth.length)} টি)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 1-CLICK PURGE ALL SALARY HISTORY MODAL ================= */}
      {showPurgeAllHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-rose-950">
                সকল শ্রমিকের বেতন ও স্ট্যাটাস হিস্ট্রি মুছবেন?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                কারখানার সকল শ্রমিকের পূর্ববর্তী সকল মাসের বেতন প্রদান ও স্ট্যাটাস হিস্ট্রি সম্পূর্ণ মুছে ফেলতে চান?
              </p>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-left text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>সর্বমোট হিস্ট্রি রেকর্ড:</span>
                <span className="text-sm font-black text-rose-950 bg-rose-100 px-2 py-0.5 rounded-md">
                  {toBengaliNumber(uniqueSalaryRecords.length)} টি
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-1">
                ⚠️ এই অ্যাকশনটি সম্পন্ন করলে সকল শ্রমিকের পূর্ববর্তী বেতন পরিশোধ ও স্ট্যাটাস বিবরণী ডাটাবেজ থেকে সম্পূর্ণ মুছে যাবে এবং শ্রমিকদের প্রোফাইলে বেতন স্ট্যাটাস নতুন করে <b>&quot;বাকী&quot;</b> থাকবে।
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={isPurgingAllHistory}
                onClick={() => setShowPurgeAllHistoryModal(false)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isPurgingAllHistory}
                onClick={handleExecutePurgeAllHistory}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isPurgingAllHistory ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, হিস্ট্রি মুছে ফেলুন'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 1-CLICK A4 MASTER PAYROLL & ATTENDANCE SHEET MODAL ================= */}
      {showMasterA4Modal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex flex-col p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-7xl w-full mx-auto my-auto shadow-2xl border border-slate-300 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black flex items-center gap-2">
                    <span>A4 মাস্টার বেতন ও হাজিরা শিট প্রিন্ট প্রিভিউ</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950">
                      A4 Landscape Format
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    সকল শ্রমিকের উপস্থিতি, অনুপস্থিতি, ওটি ঘণ্টা ও টাকা, হাজিরা বোনাস ও স্বাক্ষর কলামসহ ফ্যাক্টরি পে-রোল
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintMasterA4Sheet}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-slate-950" />
                  <span>🖨️ এখনই প্রিন্ট করুন (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMasterA4Modal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  বন্ধ করুন ✕
                </button>
              </div>
            </div>

            {/* Filter & Customization Toolbar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">মাস</label>
                <select
                  value={masterA4Month}
                  onChange={(e) => setMasterA4Month(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">সকল মাস (সব রেকর্ড)</option>
                  {BENGALI_MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">বছর</label>
                <select
                  value={masterA4Year}
                  onChange={(e) => setMasterA4Year(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{toBengaliNumber(y)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">সেকশন / বিভাগ</label>
                <select
                  value={masterA4Dept}
                  onChange={(e) => setMasterA4Dept(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">সকল সেকশন</option>
                  {availableDepartments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">কর্মী স্ট্যাটাস</label>
                <select
                  value={masterA4Status}
                  onChange={(e) => setMasterA4Status(e.target.value as 'active' | 'all')}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="active">শুধুমাত্র কর্মরত (Active)</option>
                  <option value="all">সকল কর্মী (All)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">মাসের মোট দিন</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={masterTotalDays}
                  onChange={(e) => setMasterTotalDays(Math.max(1, Number(e.target.value) || 26))}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">ডিফল্ট হাজিরা বোনাস</label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={masterDefaultBonus}
                  onChange={(e) => setMasterDefaultBonus(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  placeholder="যেমন: ৫০০ ৳"
                />
              </div>
            </div>

            {/* Paper Preview Area (Interactive on screen) */}
            <div className="p-3 sm:p-5 bg-slate-200 overflow-x-auto max-h-[68vh]">
              <div
                ref={masterA4SheetPrintRef}
                className="print-landscape bg-white rounded-xl shadow-lg border border-slate-300 p-4 sm:p-6 min-w-[1100px] text-slate-900 mx-auto text-[10px]"
              >
                {/* Factory Header */}
                <div className="border-b-2 border-slate-900 pb-2 mb-2 text-center">
                  <h1 className="text-xl font-black text-slate-900 tracking-wide uppercase">
                    টেক্স ওয়ার অ্যাপারেলস (TexWare Apparels)
                  </h1>
                  <h2 className="text-xs font-bold text-slate-800 mt-0.5">
                    শ্রমিক ও কর্মচারীদের মাসিক বেতন ও হাজিরা মাস্টার বিবরণী (Monthly Attendance & Payroll Master Sheet)
                  </h2>
                  <div className="text-[9px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md py-0.5 px-2 mt-1 inline-block font-semibold">
                    কারখানার সমন্বিত নিয়ম: লেট ও অনুপস্থিতি মিলে প্রতি ৩ দিনে ১ দিনের হাজিরা কর্তন (যেমন: ১ দিন লেট + ২ দিন অনুপস্থিত = ১ দিন কর্তন)
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-600 font-semibold px-1">
                    <div>
                      <span>মাস ও বছর: </span>
                      <strong className="text-slate-950 text-[11px]">{masterA4Month} {toBengaliNumber(masterA4Year)}</strong>
                      {masterA4Dept !== 'all' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-900">
                          সেকশন: {masterA4Dept}
                        </span>
                      )}
                    </div>
                    <div>
                      <span>মোট শ্রমিক সংখ্যা: </span>
                      <strong className="text-slate-950">{toBengaliNumber(masterTotals.workersCount)} জন</strong>
                    </div>
                    <div>
                      <span>মুদ্রণ তারিখ: </span>
                      <span>{new Date().toLocaleDateString('bn-BD')}</span>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border border-slate-400 text-left text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400 text-center">
                      <th className="p-1 border border-slate-300 w-6">ক্র.</th>
                      <th className="p-1 border border-slate-300 w-12">আইডি</th>
                      <th className="p-1 border border-slate-300 text-left">শ্রমিকের নাম ও পদবি</th>
                      <th className="p-1 border border-slate-300">সেকশন</th>
                      <th className="p-1 border border-slate-300 text-right">মূল বেতন</th>
                      <th className="p-1 border border-slate-300 w-8">কার্যদিবস</th>
                      <th className="p-1 border border-slate-300 w-8 bg-emerald-50 text-emerald-900">উপস্থিতি</th>
                      <th className="p-1 border border-slate-300 w-8 bg-rose-50 text-rose-900">অনুপস্থিতি</th>
                      <th className="p-1 border border-slate-300 w-9 bg-rose-100/70 text-rose-950" title="লেট ও অনুপস্থিতি সমন্বিত ৩ দিনে ১ দিন কর্তন">অনু. কর্তন</th>
                      <th className="p-1 border border-slate-300 w-8 bg-amber-50 text-amber-900">লেট</th>
                      <th className="p-1 border border-slate-300 w-9 bg-amber-100/70 text-amber-950" title="লেট ও অনুপস্থিতি সমন্বিত ৩ দিনে ১ দিন কর্তন">লেট কর্তন</th>
                      <th className="p-1 border border-slate-300 w-8 bg-emerald-100/70 text-emerald-950 font-black">প্রদেয় দিন</th>
                      <th className="p-1 border border-slate-300 w-9 bg-blue-50 text-blue-900">ওটি ঘণ্টা</th>
                      <th className="p-1 border border-slate-300 text-right bg-blue-50 text-blue-900">ওটি টাকা</th>
                      <th className="p-1 border border-slate-300 text-right bg-amber-50 text-amber-900">হাজিরা বোনাস</th>
                      <th className="p-1 border border-slate-300 text-right">অর্জিত বেতন</th>
                      <th className="p-1 border border-slate-300 text-right">কর্তন</th>
                      <th className="p-1 border border-slate-300 text-right font-black bg-slate-200 text-slate-950">নিট প্রদেয়</th>
                      <th className="p-1 border border-slate-300 w-14">স্ট্যাটাস</th>
                      <th className="p-1 border border-slate-300 w-16">স্বাক্ষর</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterA4Rows.map((row) => (
                      <tr key={row.workerId} className="border-b border-slate-300 hover:bg-slate-50">
                        <td className="p-1 border border-slate-300 text-center font-semibold">{toBengaliNumber(row.sl)}</td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-slate-800">{row.workerId}</td>
                        <td className="p-1 border border-slate-300 text-left">
                          <div className="font-bold text-slate-900 leading-tight">{row.name}</div>
                          <div className="text-[8px] text-slate-600 leading-tight">{row.designation}</div>
                        </td>
                        <td className="p-1 border border-slate-300 text-center text-[8.5px] text-slate-700">{row.department}</td>
                        <td className="p-1 border border-slate-300 text-right font-semibold">{formatMoney(row.basicSalary)}</td>
                        <td className="p-1 border border-slate-300 text-center">{toBengaliNumber(row.totalDays)}</td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-emerald-800 bg-emerald-50/40">
                          {toBengaliNumber(row.presentDays)}
                        </td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-rose-800 bg-rose-50/40">
                          {toBengaliNumber(row.absentDays)}
                        </td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-rose-900 bg-rose-100/50">
                          {row.absentPenaltyDays > 0 ? `+${toBengaliNumber(row.absentPenaltyDays)}` : '০'}
                        </td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-amber-800 bg-amber-50/40">
                          {toBengaliNumber(row.lateDays || 0)}
                        </td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-amber-900 bg-amber-100/50">
                          {row.latePenaltyDays > 0 ? `-${toBengaliNumber(row.latePenaltyDays)}` : '০'}
                        </td>
                        <td className="p-1 border border-slate-300 text-center font-black text-emerald-950 bg-emerald-100/40">
                          {toBengaliNumber(row.effectivePresentDays)}
                        </td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-blue-800 bg-blue-50/40">
                          {toBengaliNumber(row.otHours)}
                        </td>
                        <td className="p-1 border border-slate-300 text-right font-bold text-blue-900 bg-blue-50/40">
                          {formatMoney(row.otPay)}
                        </td>
                        <td className="p-1 border border-slate-300 text-right font-bold text-amber-900 bg-amber-50/40">
                          {row.attendanceBonus > 0 ? formatMoney(row.attendanceBonus) : '—'}
                        </td>
                        <td className="p-1 border border-slate-300 text-right font-semibold text-slate-800">
                          {formatMoney(row.presentSalary)}
                        </td>
                        <td className="p-1 border border-slate-300 text-right text-rose-700">
                          {(row.advance + row.deduction) > 0 ? formatMoney(row.advance + row.deduction) : '—'}
                        </td>
                        <td className="p-1 border border-slate-300 text-right font-black text-slate-950 bg-slate-100">
                          {formatMoney(row.netPayable)} ৳
                        </td>
                        <td className="p-1 border border-slate-300 text-center text-[8px] font-semibold">
                          {row.paymentStatus === 'paid' ? (
                            <span className="text-emerald-700 font-bold">পরিশোধিত</span>
                          ) : row.paymentStatus === 'pending' || row.paymentStatus === 'partial' ? (
                            <span className="text-amber-700 font-bold">পেন্ডিং</span>
                          ) : (
                            <span className="text-rose-700 font-bold">বাকী</span>
                          )}
                        </td>
                        <td className="p-1 border border-slate-300 text-center">
                          <div className="h-4"></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 text-slate-900 font-black border-t-2 border-slate-500 text-center text-[8.5px]">
                      <td colSpan={4} className="p-1 border border-slate-300 text-right pr-2">
                        সর্বমোট ({toBengaliNumber(masterTotals.workersCount)} জন):
                      </td>
                      <td className="p-1 border border-slate-300 text-right">{formatMoney(masterTotals.totalBasicSalary)} ৳</td>
                      <td className="p-1 border border-slate-300">—</td>
                      <td className="p-1 border border-slate-300 text-emerald-950">{toBengaliNumber(masterTotals.totalPresentDays)}</td>
                      <td className="p-1 border border-slate-300 text-rose-950">{toBengaliNumber(masterTotals.totalAbsentDays)}</td>
                      <td className="p-1 border border-slate-300 text-rose-950">+{toBengaliNumber(masterTotals.totalAbsentPenaltyDays)}</td>
                      <td className="p-1 border border-slate-300 text-amber-950">{toBengaliNumber(masterTotals.totalLateDays)}</td>
                      <td className="p-1 border border-slate-300 text-amber-950">-{toBengaliNumber(masterTotals.totalLatePenaltyDays)}</td>
                      <td className="p-1 border border-slate-300 text-emerald-950">{toBengaliNumber(masterTotals.totalEffectivePresentDays)}</td>
                      <td className="p-1 border border-slate-300 text-blue-950">{toBengaliNumber(masterTotals.totalOtHours)}</td>
                      <td className="p-1 border border-slate-300 text-right text-blue-950">{formatMoney(masterTotals.totalOtPay)} ৳</td>
                      <td className="p-1 border border-slate-300 text-right text-amber-950">{formatMoney(masterTotals.totalBonus)} ৳</td>
                      <td className="p-1 border border-slate-300 text-right">{formatMoney(masterTotals.totalPresentSalary)} ৳</td>
                      <td className="p-1 border border-slate-300 text-right text-rose-900">
                        {formatMoney(masterTotals.totalAdvance + masterTotals.totalDeduction)} ৳
                      </td>
                      <td className="p-1 border border-slate-300 text-right bg-slate-300 text-slate-950">
                        {formatMoney(masterTotals.totalNetPayable)} ৳
                      </td>
                      <td colSpan={2} className="p-1 border border-slate-300 text-center text-[8.5px]">
                        পরিশোধ: {formatMoney(masterTotals.totalPaid)} | বাকি: {formatMoney(masterTotals.totalDue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-5 gap-3 mt-7 pt-3 border-t border-slate-300 text-center text-[9px] font-bold text-slate-700">
                  <div>
                    <div className="border-t border-slate-400 pt-1 mt-5">হিসাব প্রস্তুতকারী</div>
                    <div className="text-[7.5px] text-slate-500 font-normal">Prepared By</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1 mt-5">হিসাব কর্মকর্তা</div>
                    <div className="text-[7.5px] text-slate-500 font-normal">Accountant</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1 mt-5">সেকশন ইনচার্জ</div>
                    <div className="text-[7.5px] text-slate-500 font-normal">Section In-Charge</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1 mt-5">এইচআর ও এডমিন ম্যানেজার</div>
                    <div className="text-[7.5px] text-slate-500 font-normal">HR & Admin Manager</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1 mt-5">ব্যবস্থাপনা পরিচালক</div>
                    <div className="text-[7.5px] text-slate-500 font-normal">Managing Director</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-slate-600">
                <span>মোট কর্মী: <strong className="text-slate-900">{toBengaliNumber(masterTotals.workersCount)} জন</strong></span>
                <span>•</span>
                <span>ওটি টাকা: <strong className="text-blue-700">{formatMoney(masterTotals.totalOtPay)} ৳</strong></span>
                <span>•</span>
                <span>বোনাস: <strong className="text-amber-700">{formatMoney(masterTotals.totalBonus)} ৳</strong></span>
                <span>•</span>
                <span>সর্বমোট প্রদেয়: <strong className="text-slate-900 font-black text-sm">{formatMoney(masterTotals.totalNetPayable)} ৳</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMasterA4Modal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
                <button
                  type="button"
                  onClick={handlePrintMasterA4Sheet}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-emerald-100" />
                  <span>🖨️ A4 ল্যান্ডস্কেপ পেপারে প্রিন্ট করুন</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {telegramPrintModalTitle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Printer className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                Telegram Bot-এ সরাসরি প্রিন্ট সাপোর্ট নেই
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                টেলিগ্রাম অ্যাপের নিজস্ব মোবাইল ব্রাউজারে সিস্টেম প্রিন্ট ডায়ালগ কাজ করে না। {telegramPrintModalTitle} প্রিন্ট করতে আপনার ফোনের ডিফল্ট ব্রাউজারে খুলুন:
              </p>
            </div>

            <div className="space-y-2 text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setTelegramPrintModalTitle(null);
                  openInExternalBrowser();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>ডিফল্ট ব্রাউজারে খুলুন (প্রিন্ট করতে)</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTelegramPrintModalTitle(null)}
                className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-700 font-semibold text-xs text-center cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Worker Contract Letter A4 Modal */}
      {contractModalEmp && (
        <ContractLetterModal
          employee={contractModalEmp}
          isOpen={Boolean(contractModalEmp)}
          onClose={() => setContractModalEmp(null)}
          onEmployeeUpdated={(updated) => {
            setContractModalEmp(updated);
          }}
          showToast={showToast}
        />
      )}
      {/* Worker Resignation Letter A4 Modal */}
      {resignationLetterModalEmp && (
        <ResignationLetterModal
          employee={resignationLetterModalEmp}
          isOpen={Boolean(resignationLetterModalEmp)}
          onClose={() => setResignationLetterModalEmp(null)}
          onEmployeeUpdated={(updated) => {
            setResignationLetterModalEmp(updated);
          }}
          showToast={showToast}
        />
      )}
      {/* Worker Suspension Notice A4 Modal */}
      {suspensionNoticeModalEmp && (
        <SuspensionNoticeModal
          employee={suspensionNoticeModalEmp}
          isOpen={Boolean(suspensionNoticeModalEmp)}
          onClose={() => setSuspensionNoticeModalEmp(null)}
          onEmployeeUpdated={(updated) => {
            setSuspensionNoticeModalEmp(updated);
          }}
          showToast={showToast}
        />
      )}
      {/* Worker Termination Notice A4 Modal */}
      {terminationNoticeModalEmp && (
        <TerminationNoticeModal
          employee={terminationNoticeModalEmp}
          isOpen={Boolean(terminationNoticeModalEmp)}
          onClose={() => setTerminationNoticeModalEmp(null)}
          onEmployeeUpdated={(updated) => {
            setTerminationNoticeModalEmp(updated);
          }}
          showToast={showToast}
        />
      )}
      {/* Worker Portal Login & Password Control Modal */}
      {credentialModalEmp && (
        <WorkerCredentialModal
          employee={credentialModalEmp}
          isOpen={Boolean(credentialModalEmp)}
          onClose={() => setCredentialModalEmp(null)}
          showToast={showToast}
        />
      )}
      {/* All Workers Login Credentials & Links Table Modal */}
      {showAllWorkersLoginModal && (
        <AllWorkersLoginModal
          employees={employees}
          isOpen={showAllWorkersLoginModal}
          onClose={() => setShowAllWorkersLoginModal(false)}
          onSelectWorker={(emp) => {
            setShowAllWorkersLoginModal(false);
            setCredentialModalEmp(emp);
          }}
          showToast={showToast}
        />
      )}
      {/* Worker Notice Modal (শ্রমিকদের আলাদা বা একসঙ্গে নোটিশ প্রেরণের ব্যবস্থা) */}
      {noticeModalOpen && (
        <WorkerNoticeModal
          isOpen={noticeModalOpen}
          onClose={() => {
            setNoticeModalOpen(false);
            setNoticeTargetEmp(null);
          }}
          employees={employees}
          initialSelectedEmployee={noticeTargetEmp}
          showToast={showToast}
        />
      )}
      {/* Zoomed Profile Photo Modal */}
      {zoomedPhotoEmp && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 text-slate-900">
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="font-black text-sm text-white">{zoomedPhotoEmp.name}</h4>
                <p className="text-[11px] text-slate-300 font-mono">Worker ID: {zoomedPhotoEmp.workerId}</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedPhotoEmp(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex flex-col items-center">
              <div className="w-64 h-80 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner flex items-center justify-center">
                {zoomedPhotoEmp.photoUrl ? (
                  <img
                    src={zoomedPhotoEmp.photoUrl}
                    alt={zoomedPhotoEmp.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-24 h-24 text-slate-300" />
                )}
              </div>
              <div className="mt-3 text-center text-xs space-y-0.5">
                <div className="font-bold text-slate-800">{zoomedPhotoEmp.designation} • {zoomedPhotoEmp.department}</div>
                <div className="text-slate-500 font-mono">মোবাইল: {zoomedPhotoEmp.mobile || '—'}</div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={() => setZoomedPhotoEmp(null)}
                className="px-5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
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
