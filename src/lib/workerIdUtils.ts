import { Employee } from '../types';

/**
 * Standard factory worker ID prefix
 * যেমন: TWA-001, TWA-002, TWA-003 ইত্যাদি
 */
export const DEFAULT_WORKER_ID_PREFIX = 'TWA';

const LOCAL_STORAGE_EMP_KEY = 'texware_employees_v2';
const LOCAL_STORAGE_SALARY_KEY = 'texware_salary_records_v1';
const LOCAL_STORAGE_ATTENDANCE_KEY = 'texware_attendance_records_v1';
const LOCAL_STORAGE_DELETED_KEY = 'texware_deleted_emp_ids_v2';
const LOCAL_STORAGE_APP_KEY = 'texware_job_applications_v1';

/**
 * Converts Bengali numerals (০-৯) to English numerals (0-9).
 * যেমন: '১২' -> '12', 'TWA-০১৩' -> 'TWA-013'
 */
export function convertBengaliToEnglishDigits(str: string): string {
  if (!str) return '';
  return String(str).replace(/[০-৯]/g, (digit) => {
    return '০১২৩৪৫৬৭৮৯'.indexOf(digit).toString();
  });
}

/**
 * Extracts the numeric serial number from any worker ID string,
 * supporting Bengali digits, English digits, prefixes (TWA-, TW-, etc.), and leading zeros.
 * 
 * উদাহরণ:
 * '12' -> 12
 * '১২' -> 12
 * '012' -> 12
 * 'TWA-012' -> 12
 * 'TWA-12' -> 12
 * 'TW-13' -> 13
 * '১৩' -> 13
 */
export function extractWorkerNumericValue(workerId: string): number | null {
  if (!workerId) return null;
  const englishStr = convertBengaliToEnglishDigits(String(workerId).trim());
  if (!englishStr) return null;

  // Match consecutive digits anywhere in the ID
  const match = englishStr.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0 && num < 100000) {
      return num;
    }
  }
  return null;
}

export interface KnownWorkerRecord {
  id?: string;
  workerId: string;
  name?: string;
  status?: string;
  source?: string;
}

/**
 * Collects ALL known worker IDs that have ever existed in the factory:
 * 1. Currently passed employees in state (active, resigned, suspended, terminated)
 * 2. Persisted employees in localStorage
 * 3. Historical salary disbursement records (সকল পূর্ববর্তী মাসের বেতন শিট)
 * 4. Historical attendance records (সকল পূর্ববর্তী হাজিরা খাতা)
 * 5. Approved job applications
 * 6. Explicitly deleted IDs
 */
export function collectAllKnownWorkerRecords(
  passedEmployees: Array<Partial<Employee> & { id?: string; workerId?: string; name?: string; status?: string }> = []
): KnownWorkerRecord[] {
  const map = new Map<string, KnownWorkerRecord>();

  const registerRecord = (rec: KnownWorkerRecord) => {
    const raw = (rec.workerId || '').trim();
    if (!raw) return;
    const cleanEng = convertBengaliToEnglishDigits(raw).toLowerCase();
    if (!cleanEng) return;

    if (!map.has(cleanEng)) {
      map.set(cleanEng, rec);
    } else {
      // Prefer existing with better name or status if present
      const existing = map.get(cleanEng)!;
      if (!existing.name && rec.name) existing.name = rec.name;
      if (!existing.status && rec.status) existing.status = rec.status;
      if (rec.id && !existing.id) existing.id = rec.id;
    }
  };

  // 1. Passed employees (active, resigned, suspended, terminated)
  if (Array.isArray(passedEmployees)) {
    for (const emp of passedEmployees) {
      if (emp?.workerId) {
        registerRecord({
          id: emp.id,
          workerId: emp.workerId,
          name: emp.name,
          status: emp.status || 'active',
          source: 'passedEmployees'
        });
      }
    }
  }

  // 2. Local storage employees
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_EMP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const emp of parsed) {
            if (emp?.workerId) {
              registerRecord({
                id: emp.id,
                workerId: emp.workerId,
                name: emp.name,
                status: emp.status || 'active',
                source: 'localStorage_employees'
              });
            }
          }
        }
      }
    } catch {
      // ignore JSON errors
    }

    // 3. Local storage salary records
    try {
      const rawSal = localStorage.getItem(LOCAL_STORAGE_SALARY_KEY);
      if (rawSal) {
        const parsed = JSON.parse(rawSal);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            if (s?.workerId) {
              registerRecord({
                id: s.employeeId,
                workerId: s.workerId,
                name: s.employeeName,
                status: 'salary_history',
                source: 'salary_record'
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Local storage attendance records
    try {
      const rawAtt = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
      if (rawAtt) {
        const parsed = JSON.parse(rawAtt);
        if (Array.isArray(parsed)) {
          for (const a of parsed) {
            if (a?.workerId) {
              registerRecord({
                id: a.employeeId,
                workerId: a.workerId,
                name: a.employeeName,
                status: 'attendance_history',
                source: 'attendance_record'
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 5. Job applications approvedWorkerId
    try {
      const rawApps = localStorage.getItem(LOCAL_STORAGE_APP_KEY);
      if (rawApps) {
        const parsed = JSON.parse(rawApps);
        if (Array.isArray(parsed)) {
          for (const app of parsed) {
            if (app?.approvedWorkerId) {
              registerRecord({
                workerId: app.approvedWorkerId,
                name: app.name,
                status: 'approved_application',
                source: 'job_application'
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 6. Explicitly deleted worker IDs
    try {
      const rawDel = localStorage.getItem(LOCAL_STORAGE_DELETED_KEY);
      if (rawDel) {
        const parsed = JSON.parse(rawDel);
        if (Array.isArray(parsed)) {
          for (const delId of parsed) {
            if (typeof delId === 'string' && delId.trim() && !delId.startsWith('emp_')) {
              registerRecord({
                workerId: delId,
                name: 'পূর্বে মুছে ফেলা কর্মী',
                status: 'deleted',
                source: 'deleted_set'
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(map.values());
}

/**
 * Checks if a given Worker ID is unique among ALL employees who have EVER worked (past, present, resigned, terminated).
 * Returns false if the candidate matches any existing ID string OR shares the exact same numeric value with an existing worker.
 */
export function isWorkerIdUnique(
  workerId: string,
  existingEmployees: Array<Partial<Employee> & { id?: string; workerId?: string }> = [],
  excludeEmployeeId?: string
): boolean {
  if (!workerId || !workerId.trim()) return false;
  const candidateClean = convertBengaliToEnglishDigits(workerId.trim()).toLowerCase();
  const candidateNum = extractWorkerNumericValue(workerId);

  const allRecords = collectAllKnownWorkerRecords(existingEmployees);

  for (const rec of allRecords) {
    if (excludeEmployeeId && rec.id === excludeEmployeeId) continue;
    const existingClean = convertBengaliToEnglishDigits(rec.workerId.trim()).toLowerCase();

    // 1. Direct string match (case-insensitive & Bengali-normalized)
    if (existingClean === candidateClean) {
      return false;
    }

    // 2. Numeric identity collision
    // যেমন: যদি কোনো কর্মীর আইডি '12' বা '১২' বা 'TWA-012' হয়, তবে অন্য কাউকে '12' বা '১২' বা 'TWA-012' দেওয়া যাবে না
    if (candidateNum !== null) {
      const existingNum = extractWorkerNumericValue(rec.workerId);
      if (existingNum !== null && existingNum === candidateNum) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Finds the conflicting worker or record that holds this ID (or shares this numeric identity).
 */
export function getConflictingWorker(
  workerId: string,
  existingEmployees: Array<Partial<Employee> & { id?: string; workerId?: string; name?: string; status?: string }> = [],
  excludeEmployeeId?: string
): KnownWorkerRecord | undefined {
  if (!workerId || !workerId.trim()) return undefined;
  const candidateClean = convertBengaliToEnglishDigits(workerId.trim()).toLowerCase();
  const candidateNum = extractWorkerNumericValue(workerId);

  const allRecords = collectAllKnownWorkerRecords(existingEmployees);

  // First pass: exact string match
  for (const rec of allRecords) {
    if (excludeEmployeeId && rec.id === excludeEmployeeId) continue;
    const existingClean = convertBengaliToEnglishDigits(rec.workerId.trim()).toLowerCase();
    if (existingClean === candidateClean) {
      return rec;
    }
  }

  // Second pass: numeric value collision
  if (candidateNum !== null) {
    for (const rec of allRecords) {
      if (excludeEmployeeId && rec.id === excludeEmployeeId) continue;
      const existingNum = extractWorkerNumericValue(rec.workerId);
      if (existingNum !== null && existingNum === candidateNum) {
        return rec;
      }
    }
  }

  return undefined;
}

/**
 * Generates the next guaranteed unique Worker ID for a new employee.
 * 
 * গ্যারান্টি:
 * ১. বর্তমান কর্মরত, পদত্যাগকৃত (Resigned), অব্যাহতি/বরখাস্তকৃত (Terminated),
 *    পূর্বের সকল মাসের বেতন শিট এবং হাজিরা খাতার সকল কর্মীর আইডি স্ক্যান করে।
 * ২. সর্বোচ্চ ক্রমিক নম্বর (যেমন: ১২, ১৩ ইত্যাদি থাকলে সর্বোচ্চ ১৩) শনাক্ত করে।
 * ৩. পরবর্তী আইডি অবশ্যই পূর্ববর্তী সকল নম্বরের চেয়ে বড় হবে (যেমন: ১৪ বা TWA-014)।
 * ৪. কোনো পদত্যাগকৃত বা অব্যাহতিপ্রাপ্ত কর্মীর আইডি (যেমন: ১২ বা ১৩) আর কখনোই পুনরাবৃত্তি হবে না!
 */
export function generateUniqueWorkerId(
  existingEmployees: Array<Partial<Employee> & { id?: string; workerId?: string; name?: string; status?: string }> = [],
  prefix: string = DEFAULT_WORKER_ID_PREFIX
): string {
  const cleanPrefix = (prefix || DEFAULT_WORKER_ID_PREFIX).trim().toUpperCase();
  const allRecords = collectAllKnownWorkerRecords(existingEmployees);

  const existingStrings = new Set<string>();
  const existingNumbers = new Set<number>();
  let maxNumber = 0;

  for (const rec of allRecords) {
    const rawId = (rec.workerId || '').trim();
    if (!rawId) continue;

    const engStr = convertBengaliToEnglishDigits(rawId).toLowerCase();
    existingStrings.add(engStr);

    const num = extractWorkerNumericValue(rawId);
    if (num !== null) {
      existingNumbers.add(num);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  // Start with the next number after the highest known worker number in the factory
  let candidateNum = maxNumber + 1;
  if (candidateNum < 1) candidateNum = 1;

  // Format with minimum 3 digits padding: 1 -> "001", 14 -> "014", 105 -> "105"
  const formatCandidate = (num: number): string => {
    const padded = String(num).padStart(3, '0');
    return `${cleanPrefix}-${padded}`;
  };

  let candidateId = formatCandidate(candidateNum);

  // Guarantee strict uniqueness: loop until finding an ID that:
  // 1. Its string does not exist
  // 2. Its numeric value has never been used by ANY active, resigned, or terminated worker
  while (
    existingNumbers.has(candidateNum) ||
    existingStrings.has(candidateId.toLowerCase()) ||
    existingStrings.has(String(candidateNum)) ||
    existingStrings.has(convertBengaliToEnglishDigits(candidateId).toLowerCase())
  ) {
    candidateNum++;
    candidateId = formatCandidate(candidateNum);
  }

  return candidateId;
}
