import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  get,
  Database
} from 'firebase/database';
import {
  Employee,
  TelegramSettings,
  SMSSettings,
  FactorySettings,
  SalaryDisbursementRecord,
  SalaryProgressStatus,
  AttendanceRecord,
  ShiftSettings,
  JobApplication,
  JobApplicationStatus,
  WorkerNotice,
  InvestmentRecord,
  InvestmentWithdrawalRecord,
  ProfitClaimEntry,
  AdminSecuritySettings,
  DEFAULT_ADMIN_SECURITY_SETTINGS
} from '../types';
import { normalizeSmsApiUrl } from './sms';
import { INITIAL_EMPLOYEES } from './initialData';
import { DEFAULT_SHIFT_SETTINGS } from './attendanceUtils';
import { generateInitialAttendanceRecords } from './attendanceSeed';
import { generateUniqueWorkerId } from './workerIdUtils';
import {
  sendSalaryStatusTelegramNotification,
  sendInvestmentTelegramNotification,
  sendInvestmentWithdrawalTelegramNotification,
} from './telegram';

const firebaseConfig = {
  apiKey: "AIzaSyAiqeoFeg5UUQShhsAT-pXHon1KSThqm78",
  authDomain: "tournament-13d76.firebaseapp.com",
  databaseURL: "https://tournament-13d76-default-rtdb.firebaseio.com",
  projectId: "tournament-13d76",
  storageBucket: "tournament-13d76.firebasestorage.app",
  messagingSenderId: "60952664895",
  appId: "1:60952664895:web:05224b06c79d50b5f9918a",
  measurementId: "G-HDQ7EK8BY5"
};

let db: Database | null = null;
try {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getDatabase(app);
} catch (err) {
  console.warn("Firebase initialization warning, using local fallback:", err);
}

const LOCAL_STORAGE_EMP_KEY = 'texware_employees_v2';
const LOCAL_STORAGE_TG_KEY = 'texware_telegram_settings_v2';
const LOCAL_STORAGE_SMS_KEY = 'texware_sms_settings_v2';
const LOCAL_STORAGE_SALARY_KEY = 'texware_salary_records_v1';
const LOCAL_STORAGE_ATTENDANCE_KEY = 'texware_attendance_records_v1';
const LOCAL_STORAGE_SHIFT_KEY = 'texware_shift_settings_v1';
const LOCAL_STORAGE_SEEDED_KEY = 'texware_has_seeded_initial_v2';
const LOCAL_STORAGE_DELETED_KEY = 'texware_deleted_emp_ids_v2';
const LOCAL_STORAGE_ATTENDANCE_SEEDED_KEY = 'texware_has_seeded_attendance_v2';
const LOCAL_STORAGE_DELETED_ATTENDANCE_KEY = 'texware_deleted_attendance_ids_v2';
const LOCAL_STORAGE_DELETED_SALARY_KEY = 'texware_deleted_salary_ids_v1';
const LOCAL_STORAGE_FACTORY_KEY = 'texware_factory_settings_v1';

// Demo / Sample Worker identification to ensure 100% clean factory database with zero demo data
export const DEMO_EMPLOYEE_IDS = ['emp_init_1', 'emp_init_2', 'emp_init_3', 'emp_init_4', 'emp_init_5'];
export const DEMO_WORKER_IDS = ['TW-101', 'TW-102', 'TW-103', 'TW-104', 'TW-105'];
export const DEMO_WORKER_NAMES = [
  'মোঃ রফিকুল ইসলাম',
  'মোছাঃ নাসিমা আক্তার',
  'আব্দুল করিম শেখ',
  'ফারহানা ইয়াসমিন',
  'তানভীর আহমেদ'
];

// Fallback backup for real factory employee মোঃ সোহেল রানা / সেহেল (Worker ID '01')
export const REAL_EMPLOYEE_SOHEL: Employee = {
  id: '-P22mwtVVjox1TpSv61J',
  name: 'মোঃ সোহেল রানা',
  workerId: '01',
  designation: 'জুনিয়র অপারেটর',
  department: 'সুইং সেকশন',
  salary: 5000,
  otRate: 20,
  joinDate: '2026-04-01',
  birthDate: '2011-10-02',
  address: 'চকসদু উত্তরপাড়া, গাবতলী . বগুড়া',
  mobile: '',
  nid: '',
  bankName: 'N/A',
  accountName: 'N/A',
  accountNumber: 'N/A',
  bankBranch: '',
  status: 'active',
  clearanceDone: false,
  finalSettlementPaid: false,
  finalSettlementNote: '',
  noticeServed: 'no',
  resignationDate: '',
  resignationReason: '',
  suspensionDate: '',
  suspensionDuration: '',
  suspensionReason: '',
  terminationDate: '',
  terminationMemo: '',
  terminationReason: '',
  createdAt: 1789991310119,
  updatedAt: 1791391689086,
};

export function isSohelEmployee(emp: Partial<Employee> | { id?: string; workerId?: string; name?: string } | null | undefined): boolean {
  if (!emp) return false;
  if (emp.id === '-P22mwtVVjox1TpSv61J' || emp.workerId === '01' || emp.workerId === '1') return true;
  const n = (emp.name || '').toLowerCase();
  if (n.includes('সোহেল') || n.includes('সেহেল') || n.includes('sohel') || n.includes('sehel')) return true;
  return false;
}

export function isDemoEmployee(emp: Partial<Employee> | { id?: string; workerId?: string; name?: string } | null | undefined): boolean {
  if (!emp) return false;
  // সর্বদা প্রকৃত কর্মী মোঃ সোহেল রানা / সেহেল সুরক্ষিত
  if (isSohelEmployee(emp)) return false;

  // Real employees have real IDs; only demo workers from initialData are demo
  if (emp.id && (emp.id.startsWith('emp_init_') || DEMO_EMPLOYEE_IDS.includes(emp.id))) {
    if (!emp.name || DEMO_WORKER_NAMES.includes(emp.name.trim())) {
      return true;
    }
  }
  if (emp.workerId && DEMO_WORKER_IDS.includes(emp.workerId)) {
    if (!emp.name || DEMO_WORKER_NAMES.includes(emp.name.trim())) {
      return true;
    }
  }
  return false;
}

export function isDemoAttendanceRecord(rec: AttendanceRecord | { id?: string; employeeId?: string; workerId?: string; employeeName?: string } | null | undefined): boolean {
  if (!rec) return false;
  // সর্বদা প্রকৃত কর্মী মোঃ সোহেল রানা / সেহেল এর হাজিরা সুরক্ষিত
  if (rec.employeeId === '-P22mwtVVjox1TpSv61J' || rec.workerId === '01' || rec.workerId === '1') return false;
  const n = (rec.employeeName || '').toLowerCase();
  if (n.includes('সোহেল') || n.includes('সেহেল') || n.includes('sohel') || n.includes('sehel')) return false;

  if (rec.id && rec.id.startsWith('att_emp_init_')) {
    if (!rec.employeeName || DEMO_WORKER_NAMES.includes(rec.employeeName.trim())) return true;
  }
  if (rec.employeeId && (rec.employeeId.startsWith('emp_init_') || DEMO_EMPLOYEE_IDS.includes(rec.employeeId))) {
    if (!rec.employeeName || DEMO_WORKER_NAMES.includes(rec.employeeName.trim())) return true;
  }
  if (rec.workerId && DEMO_WORKER_IDS.includes(rec.workerId)) {
    if (!rec.employeeName || DEMO_WORKER_NAMES.includes(rec.employeeName.trim())) {
      return true;
    }
  }
  return false;
}

// Set of deleted employee IDs to prevent zombie restoration from cache or auto-seeds
export function getDeletedEmployeeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_KEY);
    const set = raw ? new Set(JSON.parse(raw)) : new Set<string>();
    // নিশ্চিত করুন প্রকৃত কর্মী মোঃ সোহেল রানা / সেহেল কখনো ডিলিট তালিকায় থাকবে না
    set.delete('-P22mwtVVjox1TpSv61J');
    set.delete('01');
    set.delete('1');
    return set as Set<string>;
  } catch {
    return new Set<string>();
  }
}

export function recordDeletedEmployeeId(id: string, workerId?: string) {
  if (id === '-P22mwtVVjox1TpSv61J' || workerId === '01' || workerId === '1') return;
  try {
    const set = getDeletedEmployeeIds();
    if (id && id !== '-P22mwtVVjox1TpSv61J') set.add(id);
    if (workerId && DEMO_WORKER_IDS.includes(workerId)) set.add(workerId);
    set.delete('-P22mwtVVjox1TpSv61J');
    set.delete('01');
    set.delete('1');
    localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn("Could not save deleted ID:", e);
  }
}

export function unmarkDeletedEmployeeId(id: string) {
  try {
    const set = getDeletedEmployeeIds();
    let changed = false;
    if (set.has(id)) {
      set.delete(id);
      changed = true;
    }
    set.delete('-P22mwtVVjox1TpSv61J');
    set.delete('01');
    set.delete('1');
    localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn("Could not unmark deleted employee ID:", e);
  }
}

// Set of deleted attendance record IDs to prevent resurrection from cache or auto-seed
export function getDeletedAttendanceIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_ATTENDANCE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function recordDeletedAttendanceIds(ids: string[]) {
  try {
    const set = getDeletedAttendanceIds();
    ids.forEach((id) => {
      if (id) set.add(id);
    });
    localStorage.setItem(
      LOCAL_STORAGE_DELETED_ATTENDANCE_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch (e) {
    console.warn("Could not save deleted attendance ID:", e);
  }
}

export function unmarkDeletedAttendanceId(id: string) {
  try {
    const set = getDeletedAttendanceIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(
        LOCAL_STORAGE_DELETED_ATTENDANCE_KEY,
        JSON.stringify(Array.from(set))
      );
    }
  } catch (e) {
    console.warn("Could not unmark deleted attendance ID:", e);
  }
}

// Set of deleted salary record IDs to prevent zombie restoration from cache or auto-sync
export function getDeletedSalaryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_SALARY_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function recordDeletedSalaryIds(ids: string[]) {
  try {
    const set = getDeletedSalaryIds();
    ids.forEach((id) => {
      if (id) set.add(id);
    });
    localStorage.setItem(
      LOCAL_STORAGE_DELETED_SALARY_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch (e) {
    console.warn("Could not save deleted salary ID:", e);
  }
}

export function unmarkDeletedSalaryId(id: string) {
  try {
    const set = getDeletedSalaryIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(
        LOCAL_STORAGE_DELETED_SALARY_KEY,
        JSON.stringify(Array.from(set))
      );
    }
  } catch (e) {
    console.warn("Could not unmark deleted salary ID:", e);
  }
}

// Active in-memory subscribers for synchronous state propagation
const employeeSubscribers = new Set<(employees: Employee[]) => void>();
const salarySubscribers = new Set<(records: SalaryDisbursementRecord[]) => void>();
const attendanceSubscribers = new Set<(records: AttendanceRecord[]) => void>();

function notifyEmployeeSubscribers(list: Employee[]) {
  employeeSubscribers.forEach((cb) => {
    try {
      cb(list);
    } catch (err) {
      console.error("Employee subscriber error:", err);
    }
  });
}

function notifySalarySubscribers(list: SalaryDisbursementRecord[]) {
  salarySubscribers.forEach((cb) => {
    try {
      cb(list);
    } catch (err) {
      console.error("Salary subscriber error:", err);
    }
  });
}

function notifyAttendanceSubscribers(list: AttendanceRecord[]) {
  attendanceSubscribers.forEach((cb) => {
    try {
      cb(list);
    } catch (err) {
      console.error("Attendance subscriber error:", err);
    }
  });
}

// Timeout helper to avoid infinite hanging on mobile/Telegram WebApp proxy connections
async function safeFirebaseAction<T>(actionPromise: Promise<T>, timeoutMs = 3500): Promise<void> {
  try {
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Firebase action timeout")), timeoutMs)
    );
    await Promise.race([actionPromise, timeout]);
  } catch (e) {
    console.warn("Firebase action timed out or failed (local state kept):", e);
  }
}

/**
 * Recursively cleans an object for Firebase Realtime Database.
 * Firebase strictly rejects any object that contains `undefined` values.
 */
export function cleanForFirebase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirebase(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (typeof val === 'object' && val !== null) {
        clean[key] = cleanForFirebase(val);
      } else {
        clean[key] = val;
      }
    }
  }
  return clean as T;
}

export function getLocalEmployees(): Employee[] {
  const deletedIds = getDeletedEmployeeIds();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EMP_KEY);
    let list: Employee[] = [];
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.filter((e: Employee) => {
          if (!e) return false;
          // সর্বদা প্রকৃত কর্মী মোঃ সোহেল রানা / সেহেল সুরক্ষিত
          if (isSohelEmployee(e)) {
            return true;
          }
          if (isDemoEmployee(e)) return false;
          if (deletedIds.has(e.id)) return false;
          if (e.workerId && DEMO_WORKER_IDS.includes(e.workerId) && deletedIds.has(e.workerId)) return false;
          return true;
        });
      }
    }
    // যদি লোকাল স্টোরেজে সোহেল কোনো কারণে বাদ পড়ে থাকে, সাথে সাথে রিস্টোর করা
    if (!list.some(isSohelEmployee)) {
      list.unshift(REAL_EMPLOYEE_SOHEL);
    }
    return list;
  } catch (e) {
    return [REAL_EMPLOYEE_SOHEL];
  }
}

export function setLocalEmployees(employees: Employee[]) {
  const deletedIds = getDeletedEmployeeIds();
  const cleaned = employees.filter((e) => {
    if (!e) return false;
    if (isSohelEmployee(e)) {
      return true;
    }
    if (isDemoEmployee(e)) return false;
    if (deletedIds.has(e.id)) return false;
    if (e.workerId && DEMO_WORKER_IDS.includes(e.workerId) && deletedIds.has(e.workerId)) return false;
    return true;
  });
  // নিশ্চিত করুন সোহেল সর্বদা তালিকায় রয়েছে
  if (!cleaned.some(isSohelEmployee)) {
    cleaned.unshift(REAL_EMPLOYEE_SOHEL);
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_EMP_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.error("Local storage error:", e);
  }
  // Immediately dispatch to all active React listeners
  notifyEmployeeSubscribers(cleaned);
}

export function subscribeEmployees(callback: (employees: Employee[]) => void): () => void {
  employeeSubscribers.add(callback);
  // Always emit local data first for instantaneous rendering
  const initial = getLocalEmployees();
  callback(initial);

  if (!db) {
    return () => {
      employeeSubscribers.delete(callback);
    };
  }

  const empRef = ref(db, 'employees');
  const unsubscribe = onValue(
    empRef,
    (snapshot) => {
      const val = snapshot.val();
      const deletedIds = getDeletedEmployeeIds();
      deletedIds.delete('-P22mwtVVjox1TpSv61J');
      deletedIds.delete('01');
      deletedIds.delete('1');

      if (val && typeof val === 'object') {
        const list: Employee[] = Object.entries(val)
          .filter(([key, item]: [string, any]) => {
            // সর্বদা প্রকৃত কর্মী মোঃ সোহেল রানা সুরক্ষিত ও দৃশ্যমান রাখা
            if (isSohelEmployee({ ...item, id: key })) {
              unmarkDeletedEmployeeId(key);
              unmarkDeletedEmployeeId('01');
              return true;
            }
            if (isDemoEmployee({ ...item, id: key })) {
              // Asynchronously remove demo worker from Firebase cloud database
              if (db) {
                safeFirebaseAction(remove(ref(db, `employees/${key}`)));
              }
              return false;
            }
            if (deletedIds.has(key)) return false;
            if (item?.id && deletedIds.has(item.id)) return false;
            if (item?.workerId && DEMO_WORKER_IDS.includes(item.workerId) && deletedIds.has(item.workerId)) return false;
            return true;
          })
          .map(([key, item]: [string, any]) => ({
            id: key,
            name: item.name || '',
            workerId: item.workerId || '',
            designation: item.designation || '',
            department: item.department || '',
            salary: Number(item.salary || 0),
            otRate: Number(item.otRate || 0),
            mobile: item.mobile || '',
            nid: item.nid || '',
            address: item.address || '',
            joinDate: item.joinDate || '',
            birthDate: item.birthDate || '',
            photoUrl: item.photoUrl || '',
            signatureUrl: item.signatureUrl || '',
            portalPassword: item.portalPassword || '',
            bankName: item.bankName || '',
            accountName: item.accountName || '',
            accountNumber: item.accountNumber || '',
            bankBranch: item.bankBranch || '',
            status: item.status || 'active',
            resignationDate: item.resignationDate || '',
            resignationReason: item.resignationReason || '',
            noticeServed: item.noticeServed || 'no',
            clearanceDone: Boolean(item.clearanceDone),
            finalSettlementPaid: Boolean(item.finalSettlementPaid),
            finalSettlementNote: item.finalSettlementNote || '',
            suspensionDate: item.suspensionDate || '',
            suspensionReason: item.suspensionReason || '',
            suspensionDuration: item.suspensionDuration || '',
            terminationDate: item.terminationDate || '',
            terminationReason: item.terminationReason || '',
            terminationMemo: item.terminationMemo || '',
            isBlocked: Boolean(item.isBlocked),
            blockReason: item.blockReason || '',
            blockedAt: item.blockedAt || 0,
            portalToken: item.portalToken || `w_${(item.createdAt || 1700000000000).toString(36)}_${(item.workerId || 'tok').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            portalLinkEnabled: item.portalLinkEnabled !== false,
            portalLinkChangedAt: item.portalLinkChangedAt || 0,
            lastProfileUpdateMonth: item.lastProfileUpdateMonth || '',
            lastProfileUpdatedAt: item.lastProfileUpdatedAt || 0,
            statusChangedAt: item.statusChangedAt || 0,
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || Date.now(),
          }));
        setLocalEmployees(list);
      } else {
        const currentLocal = getLocalEmployees();
        callback(currentLocal);
      }
    },
    (error) => {
      console.warn("Firebase onValue error (using local storage fallback):", error);
      callback(getLocalEmployees());
    }
  );

  return () => {
    employeeSubscribers.delete(callback);
    unsubscribe();
  };
}

async function seedFirebaseIfEmpty(_employees: Employee[]) {
  // Never seed any demo employees to cloud or database
  return;
}


export async function saveOrUpdateEmployee(
  employeeData: Omit<Employee, 'id'>,
  id?: string
): Promise<string> {
  const now = Date.now();
  const currentList = getLocalEmployees();

  if (id) {
    // Update
    const existing = currentList.find((e) => e.id === id);
    const updatedEmployee: Employee = {
      ...(existing || {}),
      ...employeeData,
      id,
      updatedAt: now,
    };
    const nextList = currentList.map((e) => (e.id === id ? updatedEmployee : e));
    setLocalEmployees(nextList);

    if (db) {
      try {
        await update(ref(db, `employees/${id}`), cleanForFirebase({
          ...(existing || {}),
          ...employeeData,
          updatedAt: now,
        }));
      } catch (err) {
        console.warn("Firebase update error, saved locally:", err);
      }
    }
    return id;
  } else {
    // Insert: Ensure strictly unique Worker ID (e.g. TWA-001)
    let assignedWorkerId = (employeeData.workerId || '').trim();
    if (!assignedWorkerId || currentList.some((e) => (e.workerId || '').trim().toLowerCase() === assignedWorkerId.toLowerCase())) {
      assignedWorkerId = generateUniqueWorkerId(currentList);
    }

    let newId = `emp_${Date.now()}`;
    const generatedToken =
      employeeData.portalToken ||
      `w_${now.toString(36)}_${assignedWorkerId.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).substring(2, 6)}`;
    const finalData = {
      ...employeeData,
      workerId: assignedWorkerId,
      portalToken: generatedToken,
      portalLinkEnabled: employeeData.portalLinkEnabled !== false,
      portalLinkChangedAt: employeeData.portalLinkChangedAt || now,
    };

    if (db) {
      try {
        const newRef = push(ref(db, 'employees'));
        newId = newRef.key || newId;
        const newEmployee: Employee = {
          ...finalData,
          id: newId,
          createdAt: now,
          updatedAt: now,
        };
        await set(newRef, cleanForFirebase({
          ...finalData,
          createdAt: now,
          updatedAt: now,
        }));
        setLocalEmployees([newEmployee, ...currentList]);
        return newId;
      } catch (err) {
        console.warn("Firebase push error, saving locally:", err);
      }
    }

    const localEmployee: Employee = {
      ...finalData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    setLocalEmployees([localEmployee, ...currentList]);
    return newId;
  }
}

/**
 * Worker Self Profile Update (পাসওয়ার্ড, ছবি, স্বাক্ষর)
 * প্রতি মাসে একবার পরিবর্তনের রেকর্ড সহ তাৎক্ষণিকভাবে Firebase ও Admin প্যানেলে সিঙ্ক হয়
 */
export async function updateWorkerSelfProfile(
  id: string,
  data: Partial<Employee>
): Promise<void> {
  const currentList = getLocalEmployees();
  const now = Date.now();
  const updatedList = currentList.map((e) => {
    if (e.id === id) {
      return {
        ...e,
        ...data,
        updatedAt: now,
      };
    }
    return e;
  });
  setLocalEmployees(updatedList);

  if (db) {
    try {
      const cleanData = cleanForFirebase({
        ...data,
        updatedAt: now,
      });
      await safeFirebaseAction(
        update(ref(db, `employees/${id}`), cleanData)
      );
    } catch (err) {
      console.warn("Firebase updateWorkerSelfProfile error:", err);
    }
  }
}

export async function updateResignationStatus(
  id: string,
  data: Partial<Employee>
): Promise<void> {
  const currentList = getLocalEmployees();
  const now = Date.now();
  const updatedList = currentList.map((e) => {
    if (e.id === id) {
      return {
        ...e,
        ...data,
        updatedAt: now,
      };
    }
    return e;
  });
  setLocalEmployees(updatedList);

  if (db) {
    try {
      const cleanData = cleanForFirebase({
        ...data,
        updatedAt: now,
      });
      await safeFirebaseAction(
        update(ref(db, `employees/${id}`), cleanData)
      );
    } catch (err) {
      console.warn("Firebase updateResignationStatus error (local state preserved):", err);
    }
  }
}

export async function deleteEmployeeById(id: string): Promise<void> {
  const currentList = getLocalEmployees();
  const target = currentList.find((e) => e.id === id || e.workerId === id);
  const workerId = target?.workerId;

  // 1. Record as deleted so onValue never restores it from cache/seeds
  recordDeletedEmployeeId(id, workerId);

  // 2. Immediately remove from local list and dispatch to all React components
  const nextList = currentList.filter(
    (e) => e.id !== id && (workerId ? e.workerId !== workerId : true)
  );
  setLocalEmployees(nextList);

  // Helper for direct HTTPS REST API deletion
  const restDelete = async (key: string) => {
    try {
      await fetch(
        `https://tournament-13d76-default-rtdb.firebaseio.com/employees/${encodeURIComponent(key)}.json`,
        { method: 'DELETE' }
      );
    } catch (e) {
      console.warn("REST delete fallback failed:", key, e);
    }
  };

  // Immediate REST call for the primary ID
  await restDelete(id);
  if (workerId && workerId !== id) {
    await restDelete(workerId);
  }

  // 3. Firebase SDK removal and deep scan for any matching employee nodes
  if (db) {
    try {
      await safeFirebaseAction(remove(ref(db, `employees/${id}`)), 1500);
    } catch (e) {
      console.warn("Firebase SDK remove error:", e);
    }

    try {
      const snap = await get(ref(db, 'employees'));
      if (snap.exists()) {
        const val = snap.val();
        if (val && typeof val === 'object') {
          for (const [key, item] of Object.entries(val)) {
            const it = item as any;
            if (
              key === id ||
              it?.id === id ||
              (workerId && (key === workerId || it?.workerId === workerId))
            ) {
              await remove(ref(db, `employees/${key}`)).catch(() => {});
              await restDelete(key);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Firebase scan delete error:", err);
    }
  }
}

export async function loadTelegramSettings(): Promise<TelegramSettings> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TG_KEY);
    const local = raw ? JSON.parse(raw) : { botToken: '', chatId: '' };
    if (db) {
      try {
        const snap = await get(ref(db, 'settings/telegram'));
        if (snap.exists()) {
          const val = snap.val();
          localStorage.setItem(LOCAL_STORAGE_TG_KEY, JSON.stringify(val));
          return val;
        }
      } catch (e) {}
    }
    return local;
  } catch (e) {
    return { botToken: '', chatId: '' };
  }
}

export async function saveTelegramSettings(settings: TelegramSettings): Promise<void> {
  const updated = { ...settings, updatedAt: Date.now() };
  localStorage.setItem(LOCAL_STORAGE_TG_KEY, JSON.stringify(updated));
  if (db) {
    try {
      await set(ref(db, 'settings/telegram'), updated);
    } catch (e) {
      console.warn("Firebase telegram save error:", e);
    }
  }
}

export async function loadSMSSettings(): Promise<SMSSettings> {
  const defaultSms: SMSSettings = {
    apiUrl: 'https://bulksmsbd.net/api/smsapi',
    apiKey: '',
    senderId: '8809617619482',
    method: 'GET',
    keyParam: 'api_key',
    mobileParam: 'number',
    messageParam: 'message',
    senderParam: 'senderid',
  };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SMS_KEY);
    let local = raw ? JSON.parse(raw) : defaultSms;
    if (local?.apiUrl) {
      local.apiUrl = normalizeSmsApiUrl(local.apiUrl);
    }
    if (db) {
      try {
        const snap = await get(ref(db, 'settings/sms'));
        if (snap.exists()) {
          const val = snap.val();
          if (val && typeof val === 'object') {
            val.apiUrl = normalizeSmsApiUrl(val.apiUrl);
          }
          localStorage.setItem(LOCAL_STORAGE_SMS_KEY, JSON.stringify(val));
          return val;
        }
      } catch (e) {}
    }
    return local;
  } catch (e) {
    return defaultSms;
  }
}

export async function saveSMSSettings(settings: SMSSettings): Promise<void> {
  const sanitized = {
    ...settings,
    apiUrl: normalizeSmsApiUrl(settings.apiUrl),
    updatedAt: Date.now(),
  };
  localStorage.setItem(LOCAL_STORAGE_SMS_KEY, JSON.stringify(sanitized));
  if (db) {
    try {
      await set(ref(db, 'settings/sms'), sanitized);
    } catch (e) {
      console.warn("Firebase SMS save error:", e);
    }
  }
}

/* ================= FACTORY & AGREEMENT SETTINGS ================= */
export const DEFAULT_CONTRACT_RULES: string[] = [
  'এই চুক্তি অনির্দিষ্টকালের জন্য কার্যকর থাকবে, তবে শ্রমিক ৩০ দিনের পূর্বে নোটিশ প্রদান সাপেক্ষে চুক্তি বাতিল করতে পারবে। অন্যথায় তাকে কোন বেতন প্রদান করা হবে না, উক্ত কারখানার নিয়ম অনুযায়ী।',
  'প্রতিদিন ৮ ঘন্টা কাজ করতে হবে, এবং প্রয়োজন ক্ষেত্রে অতিরিক্ত সময় কাজ করতে হবে এবং অতিরিক্ত সময় কাজ করলে অভারটাইম ভাতা প্রদান করা হবে।',
  'শ্রমিক সরকার নির্ধারিত বার্ষিক ছুটি, সপ্তাহিক ছুটি, উৎসব ছুটি ভোগ করতে পারবে, উক্ত কারখানার নিয়ম অনুযায়ী।',
  'শ্রমিক কে উক্ত কারখানার সকল নিয়ম-কানুন ও আচারন বিধি মেনে চলতে হবে। শৃঙ্খলা ভঙ্গের অভিযোগ প্রমানিত হলে মালিকপক্ষ যথাযথ ব্যবস্থা নিতে পারবে।',
  'শ্রমিককে পরিচয় পত্র প্রদান করা হবে, এবং শ্রমিক তা বহন করবে।',
  'চাকুরি শেষে পরিচয় পত্র জমা দিতে হবে, জমা না দিলে এবং পরিচয় পত্র হারালে ৫০০ টাকা জরিমানা।',
  'প্রতিদিন নিয়মিত আসলে হাজিরা বোনাস ৫০০ টাকা দেওয়া হবে।',
  'লেট ও অনুপস্থিতি মিলে প্রতি ৩ দিনে ১ দিনের হাজিরা কাটা হবে (যেমন: ১ দিন লেট + ২ দিন অনুপস্থিত = ১ দিন কর্তন)।',
];

export const DEFAULT_CONTRACT_DECLARATION = 'আমি উক্ত কারখানার সকল নিয়ম মেনে কাজ করবো।';

export const DEFAULT_FACTORY_SETTINGS: FactorySettings = {
  name: 'টেক্স ওয়ার অ্যাপারেলস',
  nameEn: 'TexWare Apparels Ltd.',
  address: 'কারখানা কমপ্লেক্স, রোড # ০৩, কোনাবাড়ী বিসিক শিল্প এলাকা, গাজীপুর, ঢাকা।',
  phone: '+৮৮০১৭১২-৩৪৫৬৭৮, +৮৮০১৯১১-২২৩৩৪৪',
  email: 'info@texwareapparels.com',
  contractRules: DEFAULT_CONTRACT_RULES,
  contractDeclaration: DEFAULT_CONTRACT_DECLARATION,
};

export async function loadFactorySettings(): Promise<FactorySettings> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FACTORY_KEY);
    const local: FactorySettings = raw ? JSON.parse(raw) : DEFAULT_FACTORY_SETTINGS;
    if (db) {
      try {
        const snap = await get(ref(db, 'settings/factory'));
        if (snap.exists()) {
          const val = snap.val();
          const merged: FactorySettings = {
            name: val.name || DEFAULT_FACTORY_SETTINGS.name,
            nameEn: val.nameEn || DEFAULT_FACTORY_SETTINGS.nameEn,
            address: val.address || DEFAULT_FACTORY_SETTINGS.address,
            phone: val.phone || DEFAULT_FACTORY_SETTINGS.phone,
            email: val.email || DEFAULT_FACTORY_SETTINGS.email,
            contractRules: Array.isArray(val.contractRules) && val.contractRules.length > 0
              ? val.contractRules
              : (local.contractRules && local.contractRules.length > 0 ? local.contractRules : DEFAULT_CONTRACT_RULES),
            contractDeclaration: val.contractDeclaration || local.contractDeclaration || DEFAULT_CONTRACT_DECLARATION,
            updatedAt: val.updatedAt || Date.now(),
          };
          localStorage.setItem(LOCAL_STORAGE_FACTORY_KEY, JSON.stringify(merged));
          return merged;
        }
      } catch (e) {}
    }
    return {
      ...DEFAULT_FACTORY_SETTINGS,
      ...local,
      contractRules: Array.isArray(local.contractRules) && local.contractRules.length > 0
        ? local.contractRules
        : DEFAULT_CONTRACT_RULES,
      contractDeclaration: local.contractDeclaration || DEFAULT_CONTRACT_DECLARATION,
    };
  } catch (e) {
    return DEFAULT_FACTORY_SETTINGS;
  }
}

export async function saveFactorySettings(settings: FactorySettings): Promise<void> {
  const updated: FactorySettings = {
    ...settings,
    name: settings.name?.trim() || DEFAULT_FACTORY_SETTINGS.name,
    nameEn: settings.nameEn?.trim() || DEFAULT_FACTORY_SETTINGS.nameEn,
    address: settings.address?.trim() || DEFAULT_FACTORY_SETTINGS.address,
    phone: settings.phone?.trim() || DEFAULT_FACTORY_SETTINGS.phone,
    email: settings.email?.trim() || DEFAULT_FACTORY_SETTINGS.email,
    contractRules: Array.isArray(settings.contractRules) && settings.contractRules.length > 0
      ? settings.contractRules.map((r) => r.trim()).filter((r) => r.length > 0)
      : DEFAULT_CONTRACT_RULES,
    contractDeclaration: settings.contractDeclaration?.trim() || DEFAULT_CONTRACT_DECLARATION,
    updatedAt: Date.now(),
  };
  localStorage.setItem(LOCAL_STORAGE_FACTORY_KEY, JSON.stringify(updated));
  if (db) {
    try {
      await set(ref(db, 'settings/factory'), updated);
    } catch (e) {
      console.warn("Firebase factory settings save error:", e);
    }
  }
}

const FIREBASE_RTDB_BASE_URL = 'https://tournament-13d76-default-rtdb.firebaseio.com';

async function restDeleteRTDB(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${FIREBASE_RTDB_BASE_URL}/${path}.json`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.warn(`REST DELETE ${path} failed:`, e);
    return false;
  }
}

async function restPutRTDB(path: string, data: any): Promise<boolean> {
  try {
    const res = await fetch(`${FIREBASE_RTDB_BASE_URL}/${path}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.warn(`REST PUT ${path} failed:`, e);
    return false;
  }
}

/* ================= SALARY DISBURSEMENT RECORDS ================= */
export function getLocalSalaryRecords(): SalaryDisbursementRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SALARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const deletedIds = getDeletedSalaryIds();
      return parsed.filter((r) => !deletedIds.has(r.id));
    }
    return [];
  } catch (e) {
    return [];
  }
}

export function setLocalSalaryRecords(records: SalaryDisbursementRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SALARY_KEY, JSON.stringify(records));
  } catch (e) {
    console.error("Local storage error:", e);
  }
  // Immediately dispatch to all active React listeners
  notifySalarySubscribers(records);
}

export function subscribeSalaryRecords(
  callback: (records: SalaryDisbursementRecord[]) => void
): () => void {
  salarySubscribers.add(callback);
  const initial = getLocalSalaryRecords();
  callback(initial);

  // Quick initial REST sync check so clients without active WebSockets get immediately updated
  fetch(`${FIREBASE_RTDB_BASE_URL}/salaryRecords.json`)
    .then((res) => res.json())
    .then((val) => {
      if (!val || Object.keys(val).length === 0) {
        setLocalSalaryRecords([]);
        callback([]);
      }
    })
    .catch(() => {});

  if (!db) {
    return () => {
      salarySubscribers.delete(callback);
    };
  }

  const recRef = ref(db, 'salaryRecords');
  const unsubscribe = onValue(
    recRef,
    (snapshot) => {
      const val = snapshot.val();
      const deletedSalaryIds = getDeletedSalaryIds();
      if (val && typeof val === 'object') {
        const list: SalaryDisbursementRecord[] = Object.entries(val)
          .filter(([key]) => !deletedSalaryIds.has(key))
          .map(([key, item]: [string, any]) => ({
            id: key,
            employeeId: item.employeeId || '',
            employeeName: item.employeeName || '',
            workerId: item.workerId || '',
            designation: item.designation || '',
            department: item.department || '',
            month: item.month || '',
            year: Number(item.year || new Date().getFullYear()),
            salary: Number(item.salary || 0),
            presentDays: Number(item.presentDays || 0),
            totalDays: Number(item.totalDays || 0),
            absentDays: Number(item.absentDays || 0),
            lateDays: Number(item.lateDays || 0),
            absentPenaltyDays: Number(item.absentPenaltyDays || 0),
            latePenaltyDays: Number(item.latePenaltyDays || 0),
            effectivePresentDays: Number(item.effectivePresentDays || 0),
            presentSalary: Number(item.presentSalary || 0),
            otHours: Number(item.otHours || 0),
            otRate: Number(item.otRate || 0),
            otPay: Number(item.otPay || 0),
            bonus: Number(item.bonus || 0),
            advance: Number(item.advance || 0),
            deduction: Number(item.deduction || 0),
            deductionReason: item.deductionReason || '',
            netPayable: Number(item.netPayable || 0),
            paidAmount: Number(item.paidAmount || 0),
            dueAmount: Number(item.dueAmount || 0),
            paymentMethod: item.paymentMethod || 'cash',
            paymentStatus: item.paymentStatus || 'paid',
            progressStatus: item.progressStatus || (item.paymentStatus === 'paid' ? 'disbursed' : 'calculated'),
            statusUpdatedAt: Number(item.statusUpdatedAt || item.paidAt || Date.now()),
            statusUpdatedDate: item.statusUpdatedDate || '',
            paidAt: Number(item.paidAt || Date.now()),
            note: item.note || '',
          }));
        // Sort newest first
        list.sort((a, b) => b.paidAt - a.paidAt);
        setLocalSalaryRecords(list);
      } else {
        // Firebase has 0 salary records, synchronize local storage and listeners to empty
        setLocalSalaryRecords([]);
        callback([]);
      }
    },
    (err) => {
      console.warn("Salary records onValue error:", err);
      callback(getLocalSalaryRecords());
    }
  );

  return () => {
    salarySubscribers.delete(callback);
    unsubscribe();
  };
}

export async function saveOrUpdateSalaryRecord(
  recordData: Omit<SalaryDisbursementRecord, 'id'>,
  id?: string
): Promise<string> {
  const currentList = getLocalSalaryRecords();
  const recId = id || `sal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  // If this record ID was previously deleted, unmark it
  unmarkDeletedSalaryId(recId);

  const newRecord: SalaryDisbursementRecord = {
    ...recordData,
    id: recId,
  };

  const existingIndex = currentList.findIndex((r) => r.id === recId);
  let nextList: SalaryDisbursementRecord[];
  if (existingIndex >= 0) {
    nextList = currentList.map((r) => (r.id === recId ? newRecord : r));
  } else {
    nextList = [newRecord, ...currentList];
  }
  setLocalSalaryRecords(nextList);

  // Save via REST and Firebase SDK
  await restPutRTDB(`salaryRecords/${recId}`, cleanForFirebase(newRecord));
  if (db) {
    await safeFirebaseAction(set(ref(db, `salaryRecords/${recId}`), cleanForFirebase(newRecord)));
  }

  return recId;
}

/**
 * Updates or creates salary progress status (হিসাব চলমান, হিসাব সম্পূর্ণ, প্রস্তুত, প্রদান সম্পূর্ণ)
 * along with status update date and audit history.
 */
export async function updateSalaryProgressStatus(
  employee: Employee,
  month: string,
  year: number,
  progressStatus: SalaryProgressStatus,
  statusUpdatedDate: string,
  note?: string,
  calculatedData?: Partial<SalaryDisbursementRecord>
): Promise<string> {
  const currentList = getLocalSalaryRecords();
  const existing = currentList.find(
    (r) =>
      (r.employeeId === employee.id || r.workerId === employee.workerId) &&
      r.month === month &&
      r.year === year
  );

  const recId = existing?.id || `sal_${employee.id}_${month}_${year}`;
  const netPayable = calculatedData?.netPayable ?? existing?.netPayable ?? Number(employee.salary || 0);

  const newRecord: SalaryDisbursementRecord = {
    id: recId,
    employeeId: employee.id,
    employeeName: employee.name,
    workerId: employee.workerId,
    designation: employee.designation,
    department: employee.department || '',
    month,
    year,
    salary: Number(employee.salary || 0),
    presentDays: calculatedData?.presentDays ?? existing?.presentDays ?? 26,
    totalDays: calculatedData?.totalDays ?? existing?.totalDays ?? 26,
    absentDays: calculatedData?.absentDays ?? existing?.absentDays ?? 0,
    lateDays: calculatedData?.lateDays ?? existing?.lateDays ?? 0,
    absentPenaltyDays: calculatedData?.absentPenaltyDays ?? existing?.absentPenaltyDays ?? 0,
    latePenaltyDays: calculatedData?.latePenaltyDays ?? existing?.latePenaltyDays ?? 0,
    effectivePresentDays: calculatedData?.effectivePresentDays ?? existing?.effectivePresentDays ?? 26,
    presentSalary: calculatedData?.presentSalary ?? existing?.presentSalary ?? Number(employee.salary || 0),
    otHours: calculatedData?.otHours ?? existing?.otHours ?? 0,
    otRate: calculatedData?.otRate ?? existing?.otRate ?? Number(employee.otRate || 0),
    otPay: calculatedData?.otPay ?? existing?.otPay ?? 0,
    bonus: calculatedData?.bonus ?? existing?.bonus ?? 0,
    advance: calculatedData?.advance ?? existing?.advance ?? 0,
    deduction: calculatedData?.deduction ?? existing?.deduction ?? 0,
    deductionReason: calculatedData?.deductionReason ?? existing?.deductionReason ?? '',
    netPayable,
    paidAmount: progressStatus === 'disbursed' ? netPayable : (progressStatus === 'due' || progressStatus === 'calculating' ? 0 : (existing?.paidAmount || 0)),
    dueAmount: progressStatus === 'disbursed' ? 0 : netPayable,
    paymentMethod: existing?.paymentMethod || 'cash',
    paymentStatus: progressStatus === 'disbursed' ? 'paid' : (progressStatus === 'due' || progressStatus === 'calculating' ? 'due' : (existing?.paymentStatus || 'pending')),
    progressStatus,
    statusUpdatedAt: Date.now(),
    statusUpdatedDate,
    paidAt: existing?.paidAt || Date.now(),
    note: note !== undefined ? note : (existing?.note || ''),
  };

  const previousStatus =
    existing?.progressStatus || (existing?.paymentStatus === 'paid' ? 'disbursed' : 'due');

  const savedId = await saveOrUpdateSalaryRecord(newRecord, recId);

  void (async () => {
    try {
      const [tgCfg, facCfg] = await Promise.all([
        loadTelegramSettings(),
        loadFactorySettings(),
      ]);
      await sendSalaryStatusTelegramNotification({
        record: newRecord,
        previousStatus,
        settings: tgCfg,
        factoryName: facCfg?.name,
      });
    } catch {}
  })();

  return savedId;
}

export async function deleteSalaryRecordById(id: string): Promise<void> {
  if (!id) return;
  recordDeletedSalaryIds([id]);
  const currentList = getLocalSalaryRecords();
  const nextList = currentList.filter((r) => r.id !== id);
  setLocalSalaryRecords(nextList);

  // 1. Direct REST Delete to ensure immediate removal
  await restDeleteRTDB(`salaryRecords/${encodeURIComponent(id)}`);

  // 2. Firebase SDK remove
  if (db) {
    await safeFirebaseAction(remove(ref(db, `salaryRecords/${id}`)), 1500);

    // 3. Scan Firebase for any records with matching id or key
    try {
      const snap = await get(ref(db, 'salaryRecords'));
      if (snap.exists()) {
        const val = snap.val();
        if (val && typeof val === 'object') {
          for (const [key, item] of Object.entries(val)) {
            const it = item as any;
            if (key === id || it?.id === id) {
              await remove(ref(db, `salaryRecords/${key}`)).catch(() => {});
              await restDeleteRTDB(`salaryRecords/${key}`);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Salary delete scan error:", e);
    }
  }
}

/**
 * Ensures any and all records in Firebase and local storage for a specific worker, month and year
 * are completely deleted and purged.
 */
export async function deleteSalaryRecordForWorkerMonth(
  workerIdOrEmpId: string,
  month: string,
  year: number | string
): Promise<void> {
  if (!workerIdOrEmpId || !month || !year) return;
  const currentList = getLocalSalaryRecords();
  const targetIdClean = workerIdOrEmpId.trim().toLowerCase();
  
  const toDelete = currentList.filter((r) => {
    const matchWorker = (r.employeeId && r.employeeId.trim().toLowerCase() === targetIdClean) ||
                        (r.workerId && r.workerId.trim().toLowerCase() === targetIdClean);
    const matchMonth = r.month === month;
    const matchYear = String(r.year) === String(year);
    return matchWorker && matchMonth && matchYear;
  });

  const ids = toDelete.map((r) => r.id);
  if (ids.length > 0) {
    recordDeletedSalaryIds(ids);
  }

  const nextList = currentList.filter((r) => !toDelete.some((d) => d.id === r.id));
  setLocalSalaryRecords(nextList);

  for (const id of ids) {
    await restDeleteRTDB(`salaryRecords/${encodeURIComponent(id)}`);
    if (db) {
      await safeFirebaseAction(remove(ref(db, `salaryRecords/${id}`)), 1000);
    }
  }

  // Also query Firebase RTDB for any nodes matching this worker & month & year
  try {
    const res = await fetch(`${FIREBASE_RTDB_BASE_URL}/salaryRecords.json`);
    const val = await res.json();
    if (val && typeof val === 'object') {
      for (const [key, item] of Object.entries(val)) {
        const it = item as any;
        const matchWorker = (it?.employeeId && String(it.employeeId).trim().toLowerCase() === targetIdClean) ||
                            (it?.workerId && String(it.workerId).trim().toLowerCase() === targetIdClean);
        const matchMonth = it?.month === month;
        const matchYear = String(it?.year) === String(year);
        if (matchWorker && matchMonth && matchYear) {
          recordDeletedSalaryIds([key]);
          await restDeleteRTDB(`salaryRecords/${key}`);
          if (db) {
            await remove(ref(db, `salaryRecords/${key}`)).catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    console.warn("Scan delete worker month error:", e);
  }
}

export async function deleteSalaryRecordsBatch(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  recordDeletedSalaryIds(ids);
  const currentList = getLocalSalaryRecords();
  const idSet = new Set(ids);
  const nextList = currentList.filter((r) => !idSet.has(r.id));
  setLocalSalaryRecords(nextList);

  for (const id of ids) {
    await restDeleteRTDB(`salaryRecords/${encodeURIComponent(id)}`);
    if (db) {
      await safeFirebaseAction(remove(ref(db, `salaryRecords/${id}`)), 1000);
    }
  }
}

/**
 * Delete salary records matching month and/or year
 */
export async function deleteSalaryRecordsByMonthYear(
  month?: string,
  year?: number | string
): Promise<number> {
  const currentList = getLocalSalaryRecords();
  const toDelete = currentList.filter((r) => {
    if (month && month !== 'all' && r.month !== month) return false;
    if (year && String(year) !== 'all' && String(r.year) !== String(year)) return false;
    return true;
  });

  const ids = toDelete.map((r) => r.id);
  if (ids.length > 0) {
    recordDeletedSalaryIds(ids);
  }

  const nextList = currentList.filter((r) => {
    if (month && month !== 'all' && r.month !== month) return true;
    if (year && String(year) !== 'all' && String(r.year) !== String(year)) return true;
    return false;
  });
  setLocalSalaryRecords(nextList);

  // REST delete each identified ID
  for (const id of ids) {
    await restDeleteRTDB(`salaryRecords/${encodeURIComponent(id)}`);
    if (db) {
      await safeFirebaseAction(remove(ref(db, `salaryRecords/${id}`)), 1000);
    }
  }

  // Deep scan Firebase RTDB for any nodes matching this month/year
  try {
    const res = await fetch(`${FIREBASE_RTDB_BASE_URL}/salaryRecords.json`);
    const val = await res.json();
    if (val && typeof val === 'object') {
      for (const [key, item] of Object.entries(val)) {
        const it = item as any;
        const matchMonth = !month || month === 'all' || it?.month === month;
        const matchYear = !year || String(year) === 'all' || String(it?.year) === String(year);
        if (matchMonth && matchYear) {
          recordDeletedSalaryIds([key]);
          await restDeleteRTDB(`salaryRecords/${key}`);
          if (db) {
            await remove(ref(db, `salaryRecords/${key}`)).catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    console.warn("Scan batch delete error:", e);
  }

  return toDelete.length;
}

/**
 * Permanently purge and wipe all past salary disbursement records and history for all workers
 */
export async function purgeAllPastSalaryHistory(): Promise<number> {
  const currentList = getLocalSalaryRecords();
  const count = currentList.length;

  try {
    localStorage.removeItem(LOCAL_STORAGE_SALARY_KEY);
    localStorage.removeItem('texware_salary_records');
    localStorage.removeItem(LOCAL_STORAGE_DELETED_SALARY_KEY);
    localStorage.removeItem('texware_dismissed_salary_drafts');
  } catch (e) {
    console.warn("Error wiping local salary records:", e);
  }

  // 1. Instant REST DELETE to completely wipe salaryRecords node in RTDB
  await restDeleteRTDB('salaryRecords');

  // 2. Set lastPurgedAt in Firebase so all client devices instantly purge
  const purgeTimestamp = Date.now();
  await restPutRTDB('settings/salaryMeta', {
    lastPurgedAt: purgeTimestamp,
    updatedAt: purgeTimestamp,
  });

  if (db) {
    try {
      await safeFirebaseAction(remove(ref(db, 'salaryRecords')));
      await safeFirebaseAction(set(ref(db, 'settings/salaryMeta'), {
        lastPurgedAt: purgeTimestamp,
        updatedAt: purgeTimestamp,
      }));
    } catch (e) {
      console.warn("Error removing salaryRecords from Firebase:", e);
    }
  }

  setLocalSalaryRecords([]);
  notifySalarySubscribers([]);
  return count;
}

/**
 * Permanently delete all salary disbursement records
 */
export async function deleteAllSalaryRecords(): Promise<number> {
  return await purgeAllPastSalaryHistory();
}

let inMemoryAttendanceList: AttendanceRecord[] = [];

/* ================= ATTENDANCE RECORDS & SHIFT SETTINGS ================= */
export function getLocalAttendanceRecords(): AttendanceRecord[] {
  const deletedAttIds = getDeletedAttendanceIds();
  if (inMemoryAttendanceList.length > 0) {
    return inMemoryAttendanceList.filter((r) => !deletedAttIds.has(r.id) && !isDemoAttendanceRecord(r));
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter((r) => !deletedAttIds.has(r.id) && !isDemoAttendanceRecord(r));
        inMemoryAttendanceList = filtered;
        return filtered;
      }
    }
    return [];
  } catch (e) {
    return inMemoryAttendanceList || [];
  }
}

export function deduplicateAttendanceRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    if (!r || !r.date) return;
    const normWId = r.workerId ? r.workerId.trim().toLowerCase() : '';
    const normName = r.employeeName ? r.employeeName.trim().toLowerCase() : '';
    const identity = normWId || normName || r.employeeId;
    const key = `${identity}_${r.date}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      const rOt = Number(r.otHours) || 0;
      const exOt = Number(existing.otHours) || 0;
      if (rOt > exOt || (r.status !== 'absent' && existing.status === 'absent') || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
        map.set(key, r);
      }
    }
  });
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function setLocalAttendanceRecords(records: AttendanceRecord[]) {
  const cleanList = deduplicateAttendanceRecords(records).filter((r) => !isDemoAttendanceRecord(r));
  inMemoryAttendanceList = cleanList;
  try {
    localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(cleanList));
  } catch (e) {
    console.error("Local storage error for attendance:", e);
  }
  // Dispatch to all active listeners
  notifyAttendanceSubscribers(cleanList);
}

export function subscribeAttendanceRecords(
  callback: (records: AttendanceRecord[]) => void
): () => void {
  attendanceSubscribers.add(callback);
  const initial = getLocalAttendanceRecords();
  callback(initial);

  if (!db) {
    return () => {
      attendanceSubscribers.delete(callback);
    };
  }

  const attRef = ref(db, 'attendanceRecords');
  const unsubscribe = onValue(
    attRef,
    (snapshot) => {
      const val = snapshot.val();
      const deletedAttIds = getDeletedAttendanceIds();
      if (val && typeof val === 'object') {
        const remoteList: AttendanceRecord[] = Object.entries(val)
          .filter(([key, item]: [string, any]) => {
            // সর্বদা প্রকৃত কর্মী মোঃ সোহেল রানার হাজিরা সুরক্ষিত রাখা
            if (item?.employeeId === '-P22mwtVVjox1TpSv61J' || item?.workerId === '01' || item?.workerId === '1' || (item?.employeeName && (item.employeeName.includes('সোহেল') || item.employeeName.includes('সেহেল')))) {
              if (deletedAttIds.has(key)) unmarkDeletedAttendanceId(key);
              return true;
            }
            if (deletedAttIds.has(key)) return false;
            if (isDemoAttendanceRecord({ ...item, id: key })) {
              // Asynchronously remove demo attendance record from Firebase cloud database
              if (db) {
                safeFirebaseAction(remove(ref(db, `attendanceRecords/${key}`)));
              }
              return false;
            }
            return true;
          })
          .map(([key, item]: [string, any]) => ({
            id: key,
            employeeId: item.employeeId || '',
            workerId: item.workerId || '',
            employeeName: item.employeeName || '',
            department: item.department || '',
            date: item.date || '',
            status: item.status || 'present',
            inTime: item.inTime ?? '',
            outTime: item.outTime ?? '',
            shiftStart: item.shiftStart ?? '',
            shiftEnd: item.shiftEnd ?? '',
            isLate: Boolean(item.isLate),
            lateMinutes: Number(item.lateMinutes || 0),
            otHours: Number(item.otHours || 0),
            note: item.note ?? '',
            createdAt: Number(item.createdAt || Date.now()),
            updatedAt: Number(item.updatedAt || Date.now()),
          }));

        // Preserve any local records that haven't been deleted and haven't synced to cloud yet
        const currentLocal = getLocalAttendanceRecords();
        const remoteIdSet = new Set(remoteList.map((r) => r.id));
        const unsyncedLocal = currentLocal.filter(
          (r) => !remoteIdSet.has(r.id) && !deletedAttIds.has(r.id) && !isDemoAttendanceRecord(r)
        );

        const merged = [...remoteList, ...unsyncedLocal];
        merged.sort((a, b) => b.date.localeCompare(a.date));
        setLocalAttendanceRecords(merged);

        // If there were unsynced local records, push them to Firebase so they are never lost!
        if (unsyncedLocal.length > 0) {
          unsyncedLocal.forEach((r) => {
            safeFirebaseAction(set(ref(db!, `attendanceRecords/${r.id}`), cleanForFirebase(r)));
          });
        }
      } else {
        const currentLocal = getLocalAttendanceRecords();
        callback(currentLocal);
      }
    },
    (err) => {
      console.warn("Attendance onValue error, using local fallback:", err);
      callback(getLocalAttendanceRecords());
    }
  );

  return () => {
    attendanceSubscribers.delete(callback);
    unsubscribe();
  };
}

async function seedFirebaseAttendanceIfEmpty(_records: AttendanceRecord[]) {
  // Do not seed any demo attendance
  return;
}


export async function saveOrUpdateAttendanceRecord(
  recordData: Omit<AttendanceRecord, 'id'>,
  id?: string
): Promise<string> {
  const currentList = getLocalAttendanceRecords();
  // Standard deterministic key for single employee date if not provided
  const recId = id || (recordData.employeeId && recordData.date 
    ? `att_${recordData.employeeId}_${recordData.date}`
    : `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);

  // Unmark this record ID from deleted IDs so it is never filtered out
  unmarkDeletedAttendanceId(recId);

  const now = Date.now();
  const sanitizedRecord: AttendanceRecord = {
    ...recordData,
    id: recId,
    inTime: recordData.inTime ?? '',
    outTime: recordData.outTime ?? '',
    shiftStart: recordData.shiftStart ?? DEFAULT_SHIFT_SETTINGS.standardInTime,
    shiftEnd: recordData.shiftEnd ?? DEFAULT_SHIFT_SETTINGS.standardOutTime,
    note: recordData.note ?? '',
    createdAt: recordData.createdAt || now,
    updatedAt: now,
  };

  const existingIndex = currentList.findIndex(
    (r) => r.id === recId || (r.employeeId === sanitizedRecord.employeeId && r.date === sanitizedRecord.date)
  );
  let nextList: AttendanceRecord[];
  if (existingIndex >= 0) {
    nextList = currentList.map((r, i) => (i === existingIndex ? sanitizedRecord : r));
  } else {
    nextList = [sanitizedRecord, ...currentList];
  }
  // Sort newest date first
  nextList.sort((a, b) => b.date.localeCompare(a.date));
  setLocalAttendanceRecords(nextList);

  if (db) {
    const payload = cleanForFirebase(sanitizedRecord);
    await safeFirebaseAction(set(ref(db, `attendanceRecords/${recId}`), payload));
  }

  return recId;
}

export async function saveBulkAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
  if (!records.length) return;
  // Unmark all records from deleted attendance IDs
  records.forEach((r) => unmarkDeletedAttendanceId(r.id));

  const currentList = getLocalAttendanceRecords();
  const map = new Map<string, AttendanceRecord>();

  // Load existing
  currentList.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
  // Overwrite/merge new
  records.forEach((r) => {
    const sanitized: AttendanceRecord = {
      ...r,
      inTime: r.inTime ?? '',
      outTime: r.outTime ?? '',
      shiftStart: r.shiftStart ?? DEFAULT_SHIFT_SETTINGS.standardInTime,
      shiftEnd: r.shiftEnd ?? DEFAULT_SHIFT_SETTINGS.standardOutTime,
      note: r.note ?? '',
    };
    map.set(`${r.employeeId}_${r.date}`, sanitized);
  });

  const nextList = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  setLocalAttendanceRecords(nextList);

  if (db) {
    const updates: Record<string, any> = {};
    records.forEach((r) => {
      const sanitized: AttendanceRecord = {
        ...r,
        inTime: r.inTime ?? '',
        outTime: r.outTime ?? '',
        shiftStart: r.shiftStart ?? DEFAULT_SHIFT_SETTINGS.standardInTime,
        shiftEnd: r.shiftEnd ?? DEFAULT_SHIFT_SETTINGS.standardOutTime,
        note: r.note ?? '',
      };
      updates[`attendanceRecords/${r.id}`] = cleanForFirebase(sanitized);
    });
    await safeFirebaseAction(update(ref(db), updates));
  }
}

export async function deleteAttendanceRecordById(id: string): Promise<void> {
  localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_SEEDED_KEY, 'true');
  recordDeletedAttendanceIds([id]);
  const currentList = getLocalAttendanceRecords();
  const nextList = currentList.filter((r) => r.id !== id);
  setLocalAttendanceRecords(nextList);

  if (db) {
    if (nextList.length === 0) {
      await safeFirebaseAction(remove(ref(db, 'attendanceRecords')));
    } else {
      await safeFirebaseAction(remove(ref(db, `attendanceRecords/${id}`)));
    }
  }
}

export async function deleteBulkAttendanceRecords(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_SEEDED_KEY, 'true');
  recordDeletedAttendanceIds(ids);

  const idSet = new Set(ids);
  const currentList = getLocalAttendanceRecords();
  const nextList = currentList.filter((r) => !idSet.has(r.id));
  setLocalAttendanceRecords(nextList);

  if (db) {
    try {
      if (nextList.length === 0) {
        await safeFirebaseAction(remove(ref(db, 'attendanceRecords')));
      } else {
        const updates: Record<string, any> = {};
        ids.forEach((id) => {
          updates[id] = null;
        });
        await safeFirebaseAction(update(ref(db, 'attendanceRecords'), updates));
      }
    } catch (err) {
      console.warn("Firebase bulk delete attendance error:", err);
    }
  }
}

export async function deleteAllAttendanceRecords(): Promise<number> {
  localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_SEEDED_KEY, 'true');
  const currentList = getLocalAttendanceRecords();
  const count = currentList.length;
  const allIds = currentList.map((r) => r.id);
  recordDeletedAttendanceIds(allIds);

  // Set local state to empty
  setLocalAttendanceRecords([]);

  if (db) {
    try {
      await safeFirebaseAction(remove(ref(db, 'attendanceRecords')));
    } catch (err) {
      console.warn("Firebase remove attendanceRecords error:", err);
    }
  }

  return count;
}

export async function clearAttendanceRecordsByFilter(filter: {
  date?: string;
  month?: string;
  year?: number;
  employeeId?: string;
}): Promise<number> {
  const currentList = getLocalAttendanceRecords();
  const matchingRecords = currentList.filter((rec) => {
    if (filter.employeeId && filter.employeeId !== 'all' && rec.employeeId !== filter.employeeId) return false;
    if (filter.date && rec.date !== filter.date) return false;
    if (filter.year && !rec.date.startsWith(`${filter.year}`)) return false;
    if (filter.month && filter.month !== 'all') {
      const targetPrefix = `${filter.year || new Date().getFullYear()}-${filter.month}`;
      if (!rec.date.startsWith(targetPrefix)) return false;
    }
    return true;
  });

  const ids = matchingRecords.map((r) => r.id);
  if (ids.length > 0) {
    await deleteBulkAttendanceRecords(ids);
  }
  return ids.length;
}

export async function loadShiftSettings(): Promise<ShiftSettings> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SHIFT_KEY);
    const local = raw ? JSON.parse(raw) : DEFAULT_SHIFT_SETTINGS;
    if (db) {
      try {
        const snap = await get(ref(db, 'settings/shift'));
        if (snap.exists()) {
          const val = snap.val();
          localStorage.setItem(LOCAL_STORAGE_SHIFT_KEY, JSON.stringify(val));
          return val;
        }
      } catch (e) {}
    }
    return local;
  } catch (e) {
    return DEFAULT_SHIFT_SETTINGS;
  }
}

export async function saveShiftSettings(settings: ShiftSettings): Promise<void> {
  const updated = { ...settings, updatedAt: Date.now() };
  localStorage.setItem(LOCAL_STORAGE_SHIFT_KEY, JSON.stringify(updated));
  if (db) {
    try {
      await set(ref(db, 'settings/shift'), updated);
    } catch (e) {
      console.warn("Firebase shift settings save error:", e);
    }
  }
}

/* ================= JOB APPLICATIONS (চাকরির আবেদন ও নিয়োগ পোর্টাল) ================= */

const LOCAL_STORAGE_APPLICATIONS_KEY = 'texware_job_applications_v2';
const LOCAL_STORAGE_APP_SEEDED_KEY = 'texware_has_seeded_applications_v1';
const applicationSubscribers = new Set<(apps: JobApplication[]) => void>();

// কোনো ডেমো বা অটো আবেদন রাখা হবে না (ব্যবহারকারীর নির্দেশ অনুযায়ী ক্লিন খালি তালিকা)
const INITIAL_JOB_APPLICATIONS: JobApplication[] = [];

export function getLocalJobApplications(): JobApplication[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_APPLICATIONS_KEY);
    if (!raw) return [];
    const list: JobApplication[] = JSON.parse(raw);
    // ফিল্টার: পূর্বে থাকা কোনো ডেমো/নমুনা ডেটা (app_sample_) স্বয়ংক্রিয়ভাবে বাদ দেওয়া
    return Array.isArray(list) ? list.filter((a) => !a.id.startsWith('app_sample_')) : [];
  } catch {
    return [];
  }
}

export function setLocalJobApplications(apps: JobApplication[]) {
  try {
    const cleaned = apps.filter((a) => !a.id.startsWith('app_sample_'));
    localStorage.setItem(LOCAL_STORAGE_APPLICATIONS_KEY, JSON.stringify(cleaned));
    applicationSubscribers.forEach((cb) => cb(cleaned));
  } catch (e) {
    console.warn("Could not save job applications locally:", e);
  }
}

export function subscribeJobApplications(callback: (apps: JobApplication[]) => void) {
  applicationSubscribers.add(callback);
  callback(getLocalJobApplications());

  if (!db) {
    return () => {
      applicationSubscribers.delete(callback);
    };
  }

  const appsRef = ref(db, 'job_applications');
  const unsubscribe = onValue(
    appsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list: JobApplication[] = Object.keys(val)
          .filter((k) => !k.startsWith('app_sample_'))
          .map((k) => ({
            ...val[k],
            id: k,
          }));
        // Sort descending by creation date
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setLocalJobApplications(list);
      } else {
        const currentLocal = getLocalJobApplications();
        callback(currentLocal);
      }
    },
    (err) => {
      console.warn("Firebase job_applications error, using local fallback:", err);
      callback(getLocalJobApplications());
    }
  );

  return () => {
    applicationSubscribers.delete(callback);
    unsubscribe();
  };
}

/**
 * Submits a new job application from the public online portal
 */
export async function submitJobApplication(
  data: Omit<JobApplication, 'id' | 'createdAt' | 'status' | 'applicationNo'>
): Promise<{ id: string; applicationNo: string }> {
  const now = Date.now();
  const currentList = getLocalJobApplications();
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const count = currentList.length + 1;
  const applicationNo = `TW-APP-${yearSuffix}-${String(count).padStart(3, '0')}`;

  let newId = `app_${now}_${Math.random().toString(36).substring(2, 6)}`;

  const newApp: JobApplication = {
    ...data,
    id: newId,
    applicationNo,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  const updatedList = [newApp, ...currentList];
  setLocalJobApplications(updatedList);

  if (db) {
    try {
      const newRef = push(ref(db, 'job_applications'));
      newId = newRef.key || newId;
      newApp.id = newId;
      await set(newRef, cleanForFirebase({
        ...newApp,
        id: newId,
      }));
    } catch (e) {
      console.warn("Firebase submitJobApplication error, saved locally:", e);
    }
  }

  return { id: newId, applicationNo };
}

/**
 * Rejects a job application with specific reason
 */
export async function rejectJobApplication(
  id: string,
  rejectionReason: string,
  rejectionNote?: string
): Promise<void> {
  const now = Date.now();
  const currentList = getLocalJobApplications();
  const updatedList = currentList.map((app) => {
    if (app.id === id) {
      return {
        ...app,
        status: 'rejected' as JobApplicationStatus,
        rejectionReason: rejectionReason.trim(),
        rejectionNote: rejectionNote?.trim() || '',
        rejectedAt: now,
        updatedAt: now,
      };
    }
    return app;
  });

  setLocalJobApplications(updatedList);

  if (db) {
    try {
      await update(ref(db, `job_applications/${id}`), {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        rejectionNote: rejectionNote?.trim() || '',
        rejectedAt: now,
        updatedAt: now,
      });
    } catch (e) {
      console.warn("Firebase rejectJobApplication error:", e);
    }
  }
}

/**
 * Approves a job application and automatically adds the applicant to the active employee list!
 */
export async function approveJobApplication(
  appId: string,
  employeeData: Omit<Employee, 'id'>
): Promise<{ employeeId: string; workerId: string }> {
  const now = Date.now();

  // 1. Add / Save to Employee list in database
  const createdEmpId = await saveOrUpdateEmployee(employeeData);

  // 2. Update Application status to 'approved'
  const currentList = getLocalJobApplications();
  const updatedList = currentList.map((app) => {
    if (app.id === appId) {
      return {
        ...app,
        status: 'approved' as JobApplicationStatus,
        approvedWorkerId: employeeData.workerId,
        approvedSalary: employeeData.salary,
        approvedAt: now,
        updatedAt: now,
      };
    }
    return app;
  });

  setLocalJobApplications(updatedList);

  if (db) {
    try {
      await update(ref(db, `job_applications/${appId}`), {
        status: 'approved',
        approvedWorkerId: employeeData.workerId,
        approvedSalary: employeeData.salary,
        approvedAt: now,
        updatedAt: now,
      });
    } catch (e) {
      console.warn("Firebase approveJobApplication error:", e);
    }
  }

  return { employeeId: createdEmpId, workerId: employeeData.workerId };
}

/**
 * Deletes a job application
 */
export async function deleteJobApplication(id: string): Promise<void> {
  const currentList = getLocalJobApplications();
  const updatedList = currentList.filter((a) => a.id !== id);
  setLocalJobApplications(updatedList);

  if (db) {
    try {
      await remove(ref(db, `job_applications/${id}`));
    } catch (e) {
      console.warn("Firebase deleteJobApplication error:", e);
    }
  }
}

/* ================= WORKER NOTICES & NOTIFICATION SYSTEM (শ্রমিক নোটিশ বোর্ড) ================= */

const LOCAL_STORAGE_NOTICES_KEY = 'texware_worker_notices_v2';
const LOCAL_STORAGE_DELETED_NOTICES_KEY = 'texware_deleted_notices_v2';

const INITIAL_WORKER_NOTICES: WorkerNotice[] = [];

function getDeletedNoticeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_NOTICES_KEY);
    const set = raw ? new Set(JSON.parse(raw)) : new Set<string>();
    set.add('notice_default_1');
    set.add('notice_default_2');
    return set as Set<string>;
  } catch {
    const set = new Set<string>();
    set.add('notice_default_1');
    set.add('notice_default_2');
    return set;
  }
}

function recordDeletedNoticeId(id: string) {
  try {
    const set = getDeletedNoticeIds();
    set.add(id);
    localStorage.setItem(LOCAL_STORAGE_DELETED_NOTICES_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn("Could not save deleted notice ID:", e);
  }
}

export function getLocalWorkerNotices(): WorkerNotice[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTICES_KEY);
    const deleted = getDeletedNoticeIds();
    if (raw) {
      const parsed: WorkerNotice[] = JSON.parse(raw);
      return parsed.filter((n) => !deleted.has(n.id) && !n.id.startsWith('notice_default_'));
    }
  } catch (e) {
    console.warn("Error reading local worker notices:", e);
  }
  return [];
}

const noticeSubscribers = new Set<(notices: WorkerNotice[]) => void>();

export function setLocalWorkerNotices(notices: WorkerNotice[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_NOTICES_KEY, JSON.stringify(notices));
  } catch (e) {
    console.warn("Error saving local worker notices:", e);
  }
  noticeSubscribers.forEach((cb) => {
    try {
      cb(notices);
    } catch (err) {
      console.warn("Notice subscriber error:", err);
    }
  });
}

export function subscribeWorkerNotices(
  callback: (notices: WorkerNotice[]) => void
): () => void {
  noticeSubscribers.add(callback);
  const initial = getLocalWorkerNotices();
  callback(initial);

  if (!db) {
    return () => {
      noticeSubscribers.delete(callback);
    };
  }

  const noticesRef = ref(db, 'worker_notices');
  const unsubscribe = onValue(
    noticesRef,
    (snapshot) => {
      const val = snapshot.val();
      const deleted = getDeletedNoticeIds();
      if (val && typeof val === 'object') {
        const list: WorkerNotice[] = Object.entries(val)
          .filter(([key]) => !deleted.has(key) && !key.startsWith('notice_default_'))
          .map(([key, item]: [string, any]) => ({
            id: key,
            title: item.title || '',
            message: item.message || '',
            targetType: item.targetType || 'all',
            targetEmployeeId: item.targetEmployeeId || '',
            targetWorkerId: item.targetWorkerId || '',
            targetEmployeeName: item.targetEmployeeName || '',
            category: item.category || 'general',
            priority: item.priority || 'normal',
            createdBy: item.createdBy || 'কারখানা প্রশাসন',
            createdAt: Number(item.createdAt || Date.now()),
            publishedDate: item.publishedDate || new Date().toISOString().split('T')[0],
            readBy: Array.isArray(item.readBy) ? item.readBy : [],
            confirmations: Array.isArray(item.confirmations) ? item.confirmations : [],
          }));
        list.sort((a, b) => b.createdAt - a.createdAt);
        setLocalWorkerNotices(list);
      } else {
        const local = getLocalWorkerNotices();
        callback(local);
      }
    },
    (err) => {
      console.warn("Worker notices onValue error:", err);
      callback(getLocalWorkerNotices());
    }
  );

  return () => {
    noticeSubscribers.delete(callback);
    unsubscribe();
  };
}

export async function saveOrUpdateWorkerNotice(
  noticeData: Omit<WorkerNotice, 'id'>,
  id?: string
): Promise<string> {
  const currentList = getLocalWorkerNotices();
  const noticeId = id || `notice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newNotice: WorkerNotice = {
    ...noticeData,
    id: noticeId,
  };

  const existingIndex = currentList.findIndex((n) => n.id === noticeId);
  let nextList: WorkerNotice[];
  if (existingIndex >= 0) {
    nextList = currentList.map((n) => (n.id === noticeId ? newNotice : n));
  } else {
    nextList = [newNotice, ...currentList];
  }

  setLocalWorkerNotices(nextList);

  if (db) {
    await safeFirebaseAction(set(ref(db, `worker_notices/${noticeId}`), cleanForFirebase(newNotice)));
  }

  return noticeId;
}

export async function deleteWorkerNoticeById(id: string): Promise<void> {
  recordDeletedNoticeId(id);
  const currentList = getLocalWorkerNotices();
  const nextList = currentList.filter((n) => n.id !== id);
  setLocalWorkerNotices(nextList);

  if (db) {
    await safeFirebaseAction(remove(ref(db, `worker_notices/${id}`)));
  }
}

export async function markNoticeAsRead(noticeId: string, employeeId: string): Promise<void> {
  if (!noticeId || !employeeId) return;
  const currentList = getLocalWorkerNotices();
  const target = currentList.find((n) => n.id === noticeId);
  if (!target) return;
  const readBy = new Set(target.readBy || []);
  if (readBy.has(employeeId)) return;
  readBy.add(employeeId);

  const updatedNotice: WorkerNotice = {
    ...target,
    readBy: Array.from(readBy),
  };

  const nextList = currentList.map((n) => (n.id === noticeId ? updatedNotice : n));
  setLocalWorkerNotices(nextList);

  if (db) {
    await safeFirebaseAction(update(ref(db, `worker_notices/${noticeId}`), {
      readBy: Array.from(readBy),
    }));
  }
}

export const markWorkerNoticeAsRead = markNoticeAsRead;

export async function confirmWorkerNotice(
  noticeId: string,
  employee: { id: string; workerId?: string; name: string }
): Promise<void> {
  if (!noticeId || !employee?.id) return;
  const currentList = getLocalWorkerNotices();
  const target = currentList.find((n) => n.id === noticeId);
  if (!target) return;

  const readBy = new Set(target.readBy || []);
  readBy.add(employee.id);

  const existingConfirmations = Array.isArray(target.confirmations) ? target.confirmations : [];
  let nextConfirmations = existingConfirmations;
  if (!existingConfirmations.some((c) => c.employeeId === employee.id)) {
    nextConfirmations = [
      ...existingConfirmations,
      {
        employeeId: employee.id,
        workerId: employee.workerId || '',
        workerName: employee.name,
        confirmedAt: Date.now(),
      },
    ];
  }

  const updatedNotice: WorkerNotice = {
    ...target,
    readBy: Array.from(readBy),
    confirmations: nextConfirmations,
  };

  const nextList = currentList.map((n) => (n.id === noticeId ? updatedNotice : n));
  setLocalWorkerNotices(nextList);

  if (db) {
    await safeFirebaseAction(
      update(
        ref(db, `worker_notices/${noticeId}`),
        cleanForFirebase({
          readBy: Array.from(readBy),
          confirmations: nextConfirmations,
        })
      )
    );
  }
}

/* ================= WORKER PROFILE BLOCK / UNBLOCK ================= */
export async function blockEmployeeProfile(
  id: string,
  reason: string
): Promise<void> {
  const currentList = getLocalEmployees();
  const now = Date.now();
  const trimmedReason = reason.trim() || 'কারখানা প্রশাসন কর্তৃক সাময়িকভাবে অ্যাকাউন্ট ব্লক করা হয়েছে।';
  const updatedList = currentList.map((e) => {
    if (e.id === id) {
      return {
        ...e,
        isBlocked: true,
        blockReason: trimmedReason,
        blockedAt: now,
        updatedAt: now,
      };
    }
    return e;
  });
  setLocalEmployees(updatedList);
  if (db) {
    try {
      await safeFirebaseAction(
        update(ref(db, `employees/${id}`), {
          isBlocked: true,
          blockReason: trimmedReason,
          blockedAt: now,
          updatedAt: now,
        })
      );
    } catch (e) {
      console.warn("Firebase blockEmployeeProfile error:", e);
    }
  }
}

export async function unblockEmployeeProfile(id: string): Promise<void> {
  const currentList = getLocalEmployees();
  const now = Date.now();
  const updatedList = currentList.map((e) => {
    if (e.id === id) {
      return {
        ...e,
        isBlocked: false,
        blockReason: '',
        blockedAt: undefined,
        updatedAt: now,
      };
    }
    return e;
  });
  setLocalEmployees(updatedList);
  if (db) {
    try {
      await safeFirebaseAction(
        update(ref(db, `employees/${id}`), {
          isBlocked: false,
          blockReason: '',
          blockedAt: null,
          updatedAt: now,
        })
      );
    } catch (e) {
      console.warn("Firebase unblockEmployeeProfile error:", e);
    }
  }
}

/* ================= WORKER PORTAL LINK MANAGEMENT ================= */
export async function regenerateWorkerPortalLink(
  id: string,
  customToken?: string
): Promise<string> {
  const currentList = getLocalEmployees();
  const now = Date.now();
  const token =
    customToken?.trim() ||
    `w_${now.toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const updatedList = currentList.map((e) => {
    if (e.id === id) {
      return {
        ...e,
        portalToken: token,
        portalLinkEnabled: true,
        portalLinkChangedAt: now,
        updatedAt: now,
      };
    }
    return e;
  });
  setLocalEmployees(updatedList);
  if (db) {
    try {
      await safeFirebaseAction(
        update(ref(db, `employees/${id}`), {
          portalToken: token,
          portalLinkEnabled: true,
          portalLinkChangedAt: now,
          updatedAt: now,
        })
      );
    } catch (e) {
      console.warn("Firebase regenerateWorkerPortalLink error:", e);
    }
  }
  return token;
}

export async function toggleWorkerPortalLink(
  id: string,
  enabled: boolean
): Promise<void> {
  const currentList = getLocalEmployees();
  const now = Date.now();
  const updatedList = currentList.map((e) => {
    if (e.id === id) {
      return {
        ...e,
        portalLinkEnabled: enabled,
        updatedAt: now,
      };
    }
    return e;
  });
  setLocalEmployees(updatedList);
  if (db) {
    try {
      await safeFirebaseAction(
        update(ref(db, `employees/${id}`), {
          portalLinkEnabled: enabled,
          updatedAt: now,
        })
      );
    } catch (e) {
      console.warn("Firebase toggleWorkerPortalLink error:", e);
    }
  }
}

/* ================= CLEAR ALL DEMO EMPLOYEES & DEMO ATTENDANCE ================= */
export async function purgeAllDemoData(): Promise<{ employeesRemoved: number; attendanceRemoved: number }> {
  let empRemoved = 0;
  let attRemoved = 0;

  // 1. Purge from local employees
  try {
    const deletedEmpIds = getDeletedEmployeeIds();
    // সর্বদা মোঃ সোহেল রানা সুরক্ষিত রাখা
    deletedEmpIds.delete('-P22mwtVVjox1TpSv61J');
    deletedEmpIds.delete('01');
    deletedEmpIds.delete('1');

    const rawEmp = localStorage.getItem(LOCAL_STORAGE_EMP_KEY);
    if (rawEmp) {
      const parsed = JSON.parse(rawEmp);
      if (Array.isArray(parsed)) {
        const demoEmps = parsed.filter(isDemoEmployee);
        demoEmps.forEach((e: Employee) => {
          if (e.id && !isSohelEmployee(e) && DEMO_EMPLOYEE_IDS.includes(e.id)) deletedEmpIds.add(e.id);
          if (e.workerId && !isSohelEmployee(e) && DEMO_WORKER_IDS.includes(e.workerId)) deletedEmpIds.add(e.workerId);
        });
        const cleanEmps = parsed.filter((e: Employee) => !isDemoEmployee(e));
        // সর্বদা নিশ্চিত করুন মোঃ সোহেল রানা / সেহেল যেন বাদ না পড়ে
        if (!cleanEmps.some(isSohelEmployee)) {
          cleanEmps.unshift(REAL_EMPLOYEE_SOHEL);
        }
        localStorage.setItem(LOCAL_STORAGE_EMP_KEY, JSON.stringify(cleanEmps));
        empRemoved = demoEmps.length;
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(deletedEmpIds)));
        } catch {}
        notifyEmployeeSubscribers(cleanEmps);
      }
    }
  } catch (e) {
    console.warn("Error purging demo employees:", e);
  }

  // 2. Purge from local attendance records
  try {
    const deletedAttIds = getDeletedAttendanceIds();
    // সর্বদা মোঃ সোহেল রানার হাজিরা সুরক্ষিত রাখা
    Array.from(deletedAttIds).forEach((id) => {
      if (id.includes('-P22mwtVVjox1TpSv61J') || id.includes('_01_')) {
        deletedAttIds.delete(id);
      }
    });

    const rawAtt = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
    if (rawAtt) {
      const parsed = JSON.parse(rawAtt);
      if (Array.isArray(parsed)) {
        const demoAtts = parsed.filter(isDemoAttendanceRecord);
        demoAtts.forEach((r: AttendanceRecord) => {
          if (r.id) deletedAttIds.add(r.id);
        });
        const cleanAtts = parsed.filter((r: AttendanceRecord) => !isDemoAttendanceRecord(r));
        inMemoryAttendanceList = cleanAtts;
        localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(cleanAtts));
        attRemoved = demoAtts.length;
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_ATTENDANCE_KEY, JSON.stringify(Array.from(deletedAttIds)));
        } catch {}
        if (demoAtts.length > 0) {
          notifyAttendanceSubscribers(cleanAtts);
        }
      }
    }
  } catch (e) {
    console.warn("Error purging demo attendance:", e);
  }

  // 3. Purge from Firebase DB
  if (db) {
    try {
      DEMO_EMPLOYEE_IDS.forEach((id) => {
        safeFirebaseAction(remove(ref(db!, `employees/${id}`)));
      });
      DEMO_WORKER_IDS.forEach((wid) => {
        safeFirebaseAction(remove(ref(db!, `employees/${wid}`)));
      });
    } catch (e) {
      console.warn("Error removing demo employees from Firebase:", e);
    }

    try {
      const attSnap = await get(ref(db, 'attendanceRecords'));
      if (attSnap.exists()) {
        const val = attSnap.val();
        if (val && typeof val === 'object') {
          Object.entries(val).forEach(([k, item]: [string, any]) => {
            if (isDemoAttendanceRecord({ ...item, id: k })) {
              safeFirebaseAction(remove(ref(db!, `attendanceRecords/${k}`)));
            }
          });
        }
      }
    } catch (e) {
      console.warn("Error removing demo attendance from Firebase:", e);
    }
  }

  // 4. Purge demo notices from local storage & Firebase
  try {
    const rawNotices = localStorage.getItem(LOCAL_STORAGE_NOTICES_KEY);
    if (rawNotices) {
      const parsed = JSON.parse(rawNotices);
      if (Array.isArray(parsed)) {
        const cleanNotices = parsed.filter((n: any) => n.id && !n.id.startsWith('notice_default_'));
        localStorage.setItem(LOCAL_STORAGE_NOTICES_KEY, JSON.stringify(cleanNotices));
        setLocalWorkerNotices(cleanNotices);
      }
    }
    const delNotices = getDeletedNoticeIds();
    delNotices.add('notice_default_1');
    delNotices.add('notice_default_2');
    localStorage.setItem(LOCAL_STORAGE_DELETED_NOTICES_KEY, JSON.stringify(Array.from(delNotices)));
  } catch {}

  if (db) {
    try {
      safeFirebaseAction(remove(ref(db, 'worker_notices/notice_default_1')));
      safeFirebaseAction(remove(ref(db, 'worker_notices/notice_default_2')));
    } catch (e) {
      console.warn("Error removing demo notices from Firebase:", e);
    }
  }

  return { employeesRemoved: empRemoved, attendanceRemoved: attRemoved };
}

export async function clearAllDemoEmployees(): Promise<number> {
  const result = await purgeAllDemoData();
  return result.employeesRemoved;
}

// Auto-purge all demo data on initial load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    purgeAllDemoData().catch(() => {});
  }, 50);
}


/* ================= INVESTMENTS PERSISTENCE & RTDB ================= */
const LOCAL_STORAGE_INVESTMENTS_KEY = 'texware_investments_v1';
const LOCAL_STORAGE_DELETED_INVESTMENTS_KEY = 'texware_deleted_investments_v1';
const investmentSubscribers = new Set<(investments: InvestmentRecord[]) => void>();

export function getDeletedInvestmentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_INVESTMENTS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function recordDeletedInvestmentId(id: string) {
  if (!id) return;
  try {
    const set = getDeletedInvestmentIds();
    set.add(id);
    localStorage.setItem(LOCAL_STORAGE_DELETED_INVESTMENTS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn("Could not save deleted investment ID:", e);
  }
}

export function unmarkDeletedInvestmentId(id: string) {
  if (!id) return;
  try {
    const set = getDeletedInvestmentIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(LOCAL_STORAGE_DELETED_INVESTMENTS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch (e) {
    console.warn("Could not unmark deleted investment ID:", e);
  }
}

function notifyInvestmentSubscribers(list: InvestmentRecord[]) {
  investmentSubscribers.forEach((cb) => {
    try {
      cb(list);
    } catch (e) {
      console.error("Investment subscriber error:", e);
    }
  });
}

export function getLocalInvestments(): InvestmentRecord[] {
  try {
    const deletedIds = getDeletedInvestmentIds();
    const raw = localStorage.getItem(LOCAL_STORAGE_INVESTMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && item.id && !deletedIds.has(item.id))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function setLocalInvestments(investments: InvestmentRecord[]) {
  const deletedIds = getDeletedInvestmentIds();
  const sorted = [...investments]
    .filter((item) => item && item.id && !deletedIds.has(item.id))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  try {
    localStorage.setItem(LOCAL_STORAGE_INVESTMENTS_KEY, JSON.stringify(sorted));
  } catch (e) {
    console.error("Local storage error for investments:", e);
  }
  notifyInvestmentSubscribers(sorted);
}

export function subscribeInvestments(callback: (investments: InvestmentRecord[]) => void): () => void {
  investmentSubscribers.add(callback);
  callback(getLocalInvestments());

  if (db) {
    const investmentsRef = ref(db, 'investments');
    const unsub = onValue(
      investmentsRef,
      (snapshot) => {
        const val = snapshot.val();
        const deletedIds = getDeletedInvestmentIds();
        if (val && typeof val === 'object') {
          const list: InvestmentRecord[] = Object.keys(val)
            .filter((k) => !deletedIds.has(k) && val[k] && !deletedIds.has(val[k]?.id))
            .map((k) => ({
              ...val[k],
              id: k,
            }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setLocalInvestments(list);
        } else {
          // Database node is genuinely empty (e.g., last record deleted)
          setLocalInvestments([]);
        }
      },
      (err) => {
        console.warn("Investments onValue error, using local fallback:", err);
        callback(getLocalInvestments());
      }
    );

    return () => {
      investmentSubscribers.delete(callback);
      unsub();
    };
  }

  return () => {
    investmentSubscribers.delete(callback);
  };
}

export async function saveOrUpdateInvestment(
  data: Omit<InvestmentRecord, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string
): Promise<string> {
  const currentList = getLocalInvestments();
  const now = Date.now();
  const recordId = id || `inv_${now}_${Math.random().toString(36).substring(2, 6)}`;
  unmarkDeletedInvestmentId(recordId);

  const existing = id ? currentList.find((x) => x.id === id) : undefined;
  const record: InvestmentRecord = {
    ...(existing || {}),
    ...data,
    id: recordId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const nextList = id && existing
    ? currentList.map((item) => (item.id === id ? record : item))
    : [record, ...currentList.filter((item) => item.id !== recordId)];

  setLocalInvestments(nextList);

  if (db) {
    try {
      await safeFirebaseAction(
        set(ref(db, `investments/${recordId}`), cleanForFirebase(record))
      );
    } catch (e) {
      console.warn("Firebase save investment error:", e);
    }
  }

  if (!existing) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentTelegramNotification({
          event: 'created',
          investment: record,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  } else if (existing.status !== record.status) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentTelegramNotification({
          event: 'status_updated',
          investment: record,
          previousStatus: existing.status,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  }

  return recordId;
}

export async function deleteInvestmentById(id: string): Promise<void> {
  const currentList = getLocalInvestments();
  const target = currentList.find((item) => item.id === id);
  recordDeletedInvestmentId(id);
  const nextList = currentList.filter((item) => item.id !== id);
  setLocalInvestments(nextList);

  if (db) {
    try {
      await safeFirebaseAction(remove(ref(db, `investments/${id}`)));
    } catch (e) {
      console.warn("Firebase delete investment error:", e);
    }
  }

  if (target) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentTelegramNotification({
          event: 'deleted',
          investment: target,
          previousStatus: target.status,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  }
}

/* ================= INVESTOR BLOCK / UNBLOCK & CREDENTIALS ================= */
export async function blockInvestorProfile(
  id: string,
  reason: string
): Promise<void> {
  const currentList = getLocalInvestments();
  const now = Date.now();
  const trimmedReason = reason.trim() || 'কারখানা প্রশাসন কর্তৃক সাময়িকভাবে অ্যাকাউন্ট ব্লক করা হয়েছে।';
  const updatedList = currentList.map((inv) => {
    if (inv.id === id) {
      return {
        ...inv,
        isBlocked: true,
        blockReason: trimmedReason,
        blockedAt: now,
        updatedAt: now,
      };
    }
    return inv;
  });
  setLocalInvestments(updatedList);
  if (db) {
    try {
      await safeFirebaseAction(
        update(ref(db, `investments/${id}`), {
          isBlocked: true,
          blockReason: trimmedReason,
          blockedAt: now,
          updatedAt: now,
        })
      );
    } catch (e) {
      console.warn("Firebase blockInvestorProfile error:", e);
    }
  }

  const target = updatedList.find((inv) => inv.id === id);
  if (target) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentTelegramNotification({
          event: 'blocked',
          investment: target,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  }
}

export async function unblockInvestorProfile(id: string): Promise<void> {
  const currentList = getLocalInvestments();
  const now = Date.now();
  const updatedList = currentList.map((inv) => {
    if (inv.id === id) {
      return {
        ...inv,
        isBlocked: false,
        blockReason: '',
        blockedAt: undefined,
        updatedAt: now,
      };
    }
    return inv;
  });
  setLocalInvestments(updatedList);
  if (db) {
    try {
      await safeFirebaseAction(
        update(ref(db, `investments/${id}`), {
          isBlocked: false,
          blockReason: '',
          blockedAt: null,
          updatedAt: now,
        })
      );
    } catch (e) {
      console.warn("Firebase unblockInvestorProfile error:", e);
    }
  }

  const target = updatedList.find((inv) => inv.id === id);
  if (target) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentTelegramNotification({
          event: 'unblocked',
          investment: target,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  }
}

export async function updateInvestorCredentials(
  id: string,
  mobile: string,
  password?: string
): Promise<void> {
  const currentList = getLocalInvestments();
  const now = Date.now();
  const cleanMobile = mobile.trim();
  const updatedList = currentList.map((inv) => {
    if (inv.id === id) {
      return {
        ...inv,
        investorMobile: cleanMobile || inv.investorMobile,
        portalPassword: password !== undefined ? password.trim() : inv.portalPassword,
        updatedAt: now,
      };
    }
    return inv;
  });
  setLocalInvestments(updatedList);
  if (db) {
    try {
      const payload: Record<string, any> = {
        updatedAt: now,
      };
      if (cleanMobile) {
        payload.investorMobile = cleanMobile;
      }
      if (password !== undefined) {
        payload.portalPassword = password.trim();
      }
      await safeFirebaseAction(update(ref(db, `investments/${id}`), payload));
    } catch (e) {
      console.warn("Firebase updateInvestorCredentials error:", e);
    }
  }
}

/* ================= DAILY PROFIT CLAIM (২৪ ঘণ্টায় ১ বার মুনাফা ক্লেম) ================= */
export async function claimDailyProfit(
  investmentId: string
): Promise<{ success: boolean; message: string; claimedAmount?: number; updatedInvestment?: InvestmentRecord }> {
  const currentList = getLocalInvestments();
  const target = currentList.find((x) => x.id === investmentId);
  if (!target) {
    return { success: false, message: 'বিনিয়োগ রেকর্ড পাওয়া যায়নি।' };
  }
  if (target.isBlocked) {
    return { success: false, message: 'আপনার অ্যাকাউন্টটি অ্যাডমিন কর্তৃক ব্লক করা রয়েছে।' };
  }
  if (target.status !== 'active') {
    return { success: false, message: 'এই বিনিয়োগ চুক্তিটি বর্তমানে সক্রিয় নয়।' };
  }

  const durationDays = Math.max(1, target.durationDays || (target.durationMonths ? target.durationMonths * 30 : 30));
  const claimedDays = target.claimedDaysCount || 0;

  if (claimedDays >= durationDays) {
    return { success: false, message: `আপনি ইতিমধ্যে নির্ধারিত সকল (${durationDays}) দিনের মুনাফা সম্পূর্ণ ক্লেম করে ফেলেছেন!` };
  }

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (target.lastProfitClaimedAt && (now - target.lastProfitClaimedAt < ONE_DAY_MS)) {
    const remainingMs = ONE_DAY_MS - (now - target.lastProfitClaimedAt);
    const remHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const remSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    return {
      success: false,
      message: `পরবর্তী মুনাফা ক্লেম করতে এখনো ${remHours} ঘণ্টা ${remMinutes} মিনিট ${remSeconds} সেকেন্ড অপেক্ষা করতে হবে। প্রতি ২৪ ঘণ্টায় ১ বার ক্লেম করা যায়।`
    };
  }

  // Calculate daily profit based on tier profit rate
  // Total profit = amount * (profitRatePercent / 100)
  // Daily profit = Total profit / durationDays
  const totalPlanProfit = ((Number(target.amount) || 0) * (Number(target.profitRatePercent) || 0)) / 100;
  const rawDaily = totalPlanProfit / durationDays;
  const dailyAmount = Math.round(rawDaily * 100) / 100;

  const nextClaimedDays = claimedDays + 1;
  const nextTotalClaimed = Math.round(((target.totalProfitClaimed || 0) + dailyAmount) * 100) / 100;

  const claimEntry: ProfitClaimEntry = {
    id: `claim_${now}_${Math.random().toString(36).substring(2, 6)}`,
    claimedAt: now,
    amount: dailyAmount,
    dayIndex: nextClaimedDays,
    date: new Date(now).toISOString().slice(0, 10),
  };

  const updatedInv: InvestmentRecord = {
    ...target,
    lastProfitClaimedAt: now,
    claimedDaysCount: nextClaimedDays,
    totalProfitClaimed: nextTotalClaimed,
    profitClaimHistory: [claimEntry, ...(target.profitClaimHistory || [])],
    updatedAt: now,
  };

  const nextList = currentList.map((item) => (item.id === investmentId ? updatedInv : item));
  setLocalInvestments(nextList);

  if (db) {
    try {
      await safeFirebaseAction(
        update(ref(db, `investments/${investmentId}`), cleanForFirebase({
          lastProfitClaimedAt: now,
          claimedDaysCount: nextClaimedDays,
          totalProfitClaimed: nextTotalClaimed,
          profitClaimHistory: updatedInv.profitClaimHistory,
          updatedAt: now,
        }))
      );
    } catch (e) {
      console.warn("Firebase claimDailyProfit error:", e);
    }
  }

  return {
    success: true,
    message: `✓ আজকের (${nextClaimedDays}/${durationDays} দিন) দৈনিক মুনাফা ৳ ${dailyAmount} সফলভাবে আপনার একাউন্টে যুক্ত হয়েছে!`,
    claimedAmount: dailyAmount,
    updatedInvestment: updatedInv,
  };
}

/* ================= INVESTMENT WITHDRAWALS (টাকা উত্তোলন ভাউচার ও রসিদ) ================= */
const LOCAL_STORAGE_WITHDRAWALS_KEY = 'texware_invest_withdrawals_v1';
const LOCAL_STORAGE_DELETED_WITHDRAWALS_KEY = 'texware_deleted_withdrawals_v1';
const withdrawalSubscribers = new Set<(list: InvestmentWithdrawalRecord[]) => void>();

export function getDeletedWithdrawalIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_WITHDRAWALS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function recordDeletedWithdrawalId(id: string) {
  if (!id) return;
  try {
    const set = getDeletedWithdrawalIds();
    set.add(id);
    localStorage.setItem(LOCAL_STORAGE_DELETED_WITHDRAWALS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn("Could not save deleted withdrawal ID:", e);
  }
}

export function unmarkDeletedWithdrawalId(id: string) {
  if (!id) return;
  try {
    const set = getDeletedWithdrawalIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(LOCAL_STORAGE_DELETED_WITHDRAWALS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch (e) {
    console.warn("Could not unmark deleted withdrawal ID:", e);
  }
}

function notifyWithdrawalSubscribers(list: InvestmentWithdrawalRecord[]) {
  withdrawalSubscribers.forEach((cb) => {
    try {
      cb(list);
    } catch (e) {
      console.error("Withdrawal subscriber error:", e);
    }
  });
}

export function getLocalWithdrawals(): InvestmentWithdrawalRecord[] {
  try {
    const deletedIds = getDeletedWithdrawalIds();
    const raw = localStorage.getItem(LOCAL_STORAGE_WITHDRAWALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && item.id && !deletedIds.has(item.id))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function setLocalWithdrawals(withdrawals: InvestmentWithdrawalRecord[]) {
  const deletedIds = getDeletedWithdrawalIds();
  const sorted = [...withdrawals]
    .filter((item) => item && item.id && !deletedIds.has(item.id))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  try {
    localStorage.setItem(LOCAL_STORAGE_WITHDRAWALS_KEY, JSON.stringify(sorted));
  } catch (e) {
    console.error("Local storage error for withdrawals:", e);
  }
  notifyWithdrawalSubscribers(sorted);
}

export function subscribeWithdrawals(
  callback: (withdrawals: InvestmentWithdrawalRecord[]) => void
): () => void {
  withdrawalSubscribers.add(callback);
  callback(getLocalWithdrawals());

  if (db) {
    const wthRef = ref(db, 'investment_withdrawals');
    const unsub = onValue(
      wthRef,
      (snapshot) => {
        const val = snapshot.val();
        const deletedIds = getDeletedWithdrawalIds();
        if (val && typeof val === 'object') {
          const list: InvestmentWithdrawalRecord[] = Object.keys(val)
            .filter((k) => !deletedIds.has(k) && val[k] && !deletedIds.has(val[k]?.id))
            .map((k) => ({
              ...val[k],
              id: k,
            }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setLocalWithdrawals(list);
        } else {
          setLocalWithdrawals([]);
        }
      },
      (err) => {
        console.warn("Withdrawals onValue error, using local fallback:", err);
        callback(getLocalWithdrawals());
      }
    );

    return () => {
      withdrawalSubscribers.delete(callback);
      unsub();
    };
  }

  return () => {
    withdrawalSubscribers.delete(callback);
  };
}

export async function saveOrUpdateWithdrawal(
  data: Omit<InvestmentWithdrawalRecord, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string
): Promise<string> {
  const currentList = getLocalWithdrawals();
  const now = Date.now();
  const recordId = id || `wth_${now}_${Math.random().toString(36).substring(2, 6)}`;
  unmarkDeletedWithdrawalId(recordId);

  const existing = id ? currentList.find((x) => x.id === id) : undefined;
  const yearStr = new Date().getFullYear();
  let maxSerial = currentList.length;
  currentList.forEach((w) => {
    const m = (w.voucherNo || '').match(/WTH-VOUCHER-\d+-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxSerial) maxSerial = n;
    }
  });

  const record: InvestmentWithdrawalRecord = {
    ...(existing || {}),
    ...data,
    id: recordId,
    voucherNo: data.voucherNo || existing?.voucherNo || `WTH-VOUCHER-${yearStr}-${String(maxSerial + 1).padStart(3, '0')}`,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const nextList = id && existing
    ? currentList.map((item) => (item.id === id ? record : item))
    : [record, ...currentList.filter((item) => item.id !== recordId)];

  setLocalWithdrawals(nextList);

  if (db) {
    try {
      await safeFirebaseAction(
        set(ref(db, `investment_withdrawals/${recordId}`), cleanForFirebase(record))
      );
    } catch (e) {
      console.warn("Firebase save withdrawal error:", e);
    }
  }

  if (!existing) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentWithdrawalTelegramNotification({
          event: 'created',
          withdrawal: record,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  } else if (existing.status !== record.status) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentWithdrawalTelegramNotification({
          event: 'status_updated',
          withdrawal: record,
          previousStatus: existing.status,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  }

  return recordId;
}

export async function updateWithdrawalStatus(
  id: string,
  status: 'pending' | 'approved' | 'completed'
): Promise<void> {
  const currentList = getLocalWithdrawals();
  const existing = currentList.find((item) => item.id === id);
  const now = Date.now();
  const nextList = currentList.map((item) =>
    item.id === id ? { ...item, status, updatedAt: now } : item
  );
  setLocalWithdrawals(nextList);

  if (db) {
    try {
      await safeFirebaseAction(
        update(ref(db, `investment_withdrawals/${id}`), {
          status,
          updatedAt: now,
        })
      );
    } catch (e) {
      console.warn("Firebase updateWithdrawalStatus error:", e);
    }
  }

  const updated = nextList.find((item) => item.id === id);
  if (updated) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentWithdrawalTelegramNotification({
          event: 'status_updated',
          withdrawal: updated,
          previousStatus: existing?.status,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  }
}

export async function deleteWithdrawalById(id: string): Promise<void> {
  const currentList = getLocalWithdrawals();
  const target = currentList.find((item) => item.id === id);
  recordDeletedWithdrawalId(id);
  const nextList = currentList.filter((item) => item.id !== id);
  setLocalWithdrawals(nextList);

  if (db) {
    try {
      await safeFirebaseAction(remove(ref(db, `investment_withdrawals/${id}`)));
    } catch (e) {
      console.warn("Firebase delete withdrawal error:", e);
    }
  }

  if (target) {
    void (async () => {
      try {
        const [tgCfg, facCfg] = await Promise.all([
          loadTelegramSettings(),
          loadFactorySettings(),
        ]);
        await sendInvestmentWithdrawalTelegramNotification({
          event: 'deleted',
          withdrawal: target,
          previousStatus: target.status,
          settings: tgCfg,
          factoryName: facCfg?.name,
        });
      } catch {}
    })();
  }
}

/* ================= ADMIN SECURITY & CLOUD PASSWORD ================= */
const LOCAL_STORAGE_ADMIN_SECURITY_KEY = 'texware_admin_security_v1';
const LOCAL_STORAGE_ADMIN_PASSWORD_LEGACY_KEY = 'texware_admin_password';

const adminSecuritySubscribers: ((settings: AdminSecuritySettings) => void)[] = [];

export function getLocalAdminSecurity(): AdminSecuritySettings {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ADMIN_SECURITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.adminPassword === 'string' && parsed.adminPassword.trim()) {
        return {
          adminPassword: parsed.adminPassword.trim(),
          isDefaultPassword: Boolean(parsed.isDefaultPassword),
          passwordChangedAt: Number(parsed.passwordChangedAt) || 0,
          updatedAt: Number(parsed.updatedAt) || 0,
        };
      }
    }
  } catch (e) {}

  // Fallback to legacy key if user previously changed password
  try {
    const legacy = localStorage.getItem(LOCAL_STORAGE_ADMIN_PASSWORD_LEGACY_KEY);
    if (legacy && legacy.trim()) {
      const trimmed = legacy.trim();
      const isCustom = trimmed !== '123456';
      return {
        adminPassword: trimmed,
        isDefaultPassword: !isCustom,
        passwordChangedAt: isCustom ? Date.now() : 0,
        updatedAt: Date.now(),
      };
    }
  } catch (e) {}

  return { ...DEFAULT_ADMIN_SECURITY_SETTINGS };
}

export function subscribeAdminSecurity(callback: (settings: AdminSecuritySettings) => void): () => void {
  adminSecuritySubscribers.push(callback);

  // Emit current local immediately
  const initialLocal = getLocalAdminSecurity();
  try {
    callback(initialLocal);
  } catch (err) {
    console.error("Admin security initial callback error:", err);
  }

  if (!db) {
    return () => {
      const idx = adminSecuritySubscribers.indexOf(callback);
      if (idx !== -1) adminSecuritySubscribers.splice(idx, 1);
    };
  }

  const securityRef = ref(db, 'settings/admin_security');
  const unsub = onValue(
    securityRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val.adminPassword === 'string' && val.adminPassword.trim()) {
        const sec: AdminSecuritySettings = {
          adminPassword: String(val.adminPassword).trim(),
          isDefaultPassword: val.isDefaultPassword === true,
          passwordChangedAt: Number(val.passwordChangedAt) || 0,
          updatedAt: Number(val.updatedAt) || Date.now(),
        };

        try {
          localStorage.setItem(LOCAL_STORAGE_ADMIN_SECURITY_KEY, JSON.stringify(sec));
          localStorage.setItem(LOCAL_STORAGE_ADMIN_PASSWORD_LEGACY_KEY, sec.adminPassword);
        } catch {}

        adminSecuritySubscribers.forEach((cb) => {
          try {
            cb(sec);
          } catch (e) {
            console.error("Admin security subscriber error:", e);
          }
        });
      } else {
        // If Firebase doesn't have an admin_security record yet,
        // but local already had a custom password, sync it to Firebase immediately!
        const local = getLocalAdminSecurity();
        if (!local.isDefaultPassword && local.adminPassword && local.adminPassword !== '123456') {
          saveAdminSecurity(local.adminPassword, false).catch(() => {});
        }
      }
    },
    (err) => {
      console.warn("Firebase admin security subscription warning:", err);
      try {
        callback(getLocalAdminSecurity());
      } catch {}
    }
  );

  return () => {
    const idx = adminSecuritySubscribers.indexOf(callback);
    if (idx !== -1) adminSecuritySubscribers.splice(idx, 1);
    unsub();
  };
}

export async function saveAdminSecurity(
  newPassword: string,
  isDefault = false
): Promise<AdminSecuritySettings> {
  const cleanPass = (newPassword || '').trim();
  const now = Date.now();
  const updated: AdminSecuritySettings = {
    adminPassword: cleanPass,
    isDefaultPassword: isDefault,
    passwordChangedAt: now,
    updatedAt: now,
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_ADMIN_SECURITY_KEY, JSON.stringify(updated));
    localStorage.setItem(LOCAL_STORAGE_ADMIN_PASSWORD_LEGACY_KEY, cleanPass);
  } catch {}

  // Notify subscribers immediately
  adminSecuritySubscribers.forEach((cb) => {
    try {
      cb(updated);
    } catch (e) {}
  });

  if (db) {
    try {
      await safeFirebaseAction(
        set(ref(db, 'settings/admin_security'), cleanForFirebase(updated))
      );
    } catch (e) {
      console.warn("Firebase save admin security error:", e);
    }
  }

  return updated;
}
