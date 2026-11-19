import { AttendanceRecord, ShiftSettings } from '../types';
import { DEFAULT_SHIFT_SETTINGS } from './attendanceUtils';

// সম্পূর্ণ ফ্রেশ হাজিরা খাতা: কোনো ডেমো বা নমুনা হাজিরা রেকর্ড রাখা হবে না
export function generateInitialAttendanceRecords(_shift: ShiftSettings = DEFAULT_SHIFT_SETTINGS): AttendanceRecord[] {
  return [];
}

