// API base URL is injected at build time via Vite environment variables
// Set VITE_API_BASE_URL to the backend root (e.g. https://your-backend.run.app)
// If the env var wasn't set at build-time (common on Vercel), fall back to the
// deployed backend URL so the site doesn't attempt to call localhost from the
// user's browser. This fallback is intentionally explicit so you can change it.
const BUILD_API_BASE = (import.meta.env?.VITE_API_BASE_URL as string) || '';
const API_BASE = BUILD_API_BASE;
if (!BUILD_API_BASE) {
  // eslint-disable-next-line no-console
  console.warn('[rajac] VITE_API_BASE_URL not set — API calls will fail. Set this env var to your VPS backend URL.');
}
const API_BASE_URL = API_BASE.endsWith('/') ? API_BASE + 'api' : API_BASE + '/api';

// Exported constant for other parts of the app that still use fetch directly.
// This value already includes the trailing '/api' segment (e.g. https://.../api)
export const API_CF = API_BASE_URL;

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  student?: T;
  transactions?: T;
  summary?: T;
  overdueList?: T;
  paid?: number;
  remaining?: number;
  message?: string;
  error?: string;
}

interface Student {
  studentID?: string;
  name: string;
  grade: string;
  baseFees: number;
  discountPct?: number;
  netFees: number;
  totalPaid: number;
  unpaid: number;
  phoneNumber?: string;
}

interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  name: string;
  amount: number;
  method: 'Cash' | 'InstaPay' | 'Visa' | 'Check' | string;
  date: string;
  note?: string;
}

interface CashSummary {
  availableCash: number;
  availableBank: number;
}

interface OverdueStudent {
  FullName: string;
  DueDate: string;
}

// Auth token helper — reads from localStorage so it's always current
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("rajac_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Helper for GET requests
async function apiGet<T>(endpoint: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
  try {
    const url = new URL(API_BASE_URL + endpoint);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
    });
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (response.status === 401) return { ok: false, data: null as T, message: 'Session expired. Please log in again.' };
    const data = await response.json();
    return { ok: data.success, ...data, data: data.students || data.student || data.data || data.analytics || data.transactions || data.installments || data.config || data.deposits };
  } catch (error) {
    return { ok: false, data: null as T, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper for POST/PUT requests
async function apiSend<T>(endpoint: string, payload: Record<string, any>, method: 'POST' | 'PUT' = 'POST'): Promise<ApiResponse<T>> {
  try {
    const url = new URL(API_BASE_URL + endpoint);
    const response = await fetch(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    if (response.status === 401) return { ok: false, data: null as T, message: 'Session expired. Please log in again.' };
    const data = await response.json();
    return { ok: data.success, ...data, data: data.data || data.student || data.students || data.analytics || data.transactions || data.installments || data.config || data.deposits };
  } catch (error) {
    return { ok: false, data: null as T, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Student API calls
// Get student by identifier (ID or name)
export async function getStudentByIdentifier(identifier: string): Promise<ApiResponse<Student>> {
  // Call backend then normalize returned student shape into frontend model
  const res = await apiGet<any>(`/students/search/${encodeURIComponent(identifier)}`);
  if (!res.ok || !res.data) return res as ApiResponse<Student>;

  const s = res.data;
  const baseFees = Number(s.totalFees || s.Total_Fees || s.fees || s.baseFees || 0) || 0;
  const discountPct = Number(s.discountPercent || s.Discount_Percent || s.discount || s.discountPct || 0) || 0;
  // Trust backend Net_Amount/netAmount; do not compute locally
  const netFees = Number(s.netAmount || s.Net_Amount || s.netFees || 0) || 0;
  const totalPaid = Number(s.totalPaid || s.Total_Paid || s.paidAmount || 0) || 0;
  // Trust backend Remaining_Balance/remainingBalance
  const unpaid = Number(s.remainingBalance || s.Remaining_Balance || s.unpaid || s.remaining || 0) || 0;

  const normalized: Student = {
    studentID: s.studentId || s.Student_ID || s.id || s.studentID,
    name: s.name || s.Name || '',
    grade: s.year || s.Year || s.grade || '',
    baseFees,
    discountPct,
    netFees,
    totalPaid,
    unpaid,
    phoneNumber: s.phoneNumber || s.Phone_Number || s.phone || s.mobile || '',
  };

  return { ok: true, data: normalized };
}

// Payment API calls
export async function savePayment(data: {
  studentId: string;
  amountPaid: number;
  paymentMethod: string;
  discountPercent?: number;
  processedBy?: string;
}): Promise<ApiResponse<any>> {
  return apiSend('/payments/process', data, 'POST');
}

// Update student discount
export async function updateStudentDiscount(data: {
  studentId: string;
  discountPercent: number;
}): Promise<ApiResponse<any>> {
  return apiSend('/payments/apply-discount', data, 'POST');
}

// Update student total fees
export async function updateStudentTotalFees(data: {
  studentId: string;
  totalFees: number;
  updatedBy?: string;
}): Promise<ApiResponse<any>> {
  const { studentId, totalFees, updatedBy } = data;
  return apiSend(`/students/${studentId}/total-fees`, { totalFees, updatedBy }, 'PUT');
}

// Bank deposit API calls
export async function saveBankDeposit(data: {
  amount: number;
  bankName: string;
  depositedBy?: string;
  notes?: string;
}): Promise<ApiResponse<any>> {
  return apiSend('/bank/deposit', data, 'POST');
}

// In/Out transaction API calls
export async function saveInOut(data: {
  type: string;
  amount: number;
  subject: string;
  payerReceiverName: string;
  paymentMethod: string;
  notes?: string;
  processedBy?: string;
  date?: string;
}): Promise<ApiResponse<any>> {
  return apiSend('/finance/transaction', data, 'POST');
}

export async function getRecentTransactions(): Promise<ApiResponse<Transaction[]>> {
  return apiGet<Transaction[]>('/finance/transactions');
}

// Full analytics (returns backend analytics object)
export async function getAnalytics(): Promise<ApiResponse<any>> {
  const res = await apiGet<any>('/analytics');
  if (!res.ok) return res as ApiResponse<any>;
  // apiGet places the raw body into res.data or nested analytics; normalize to analytics object
  const analytics = res.data?.analytics || res.data || res;
  return { ok: true, data: analytics };
}

// Balance API calls
export async function getCashSummary(): Promise<ApiResponse<CashSummary>> {
  const res = await apiGet<any>('/analytics');
  if (!res.ok || !res.data) return res as ApiResponse<CashSummary>;

  // Backend returns analytics: { cash: { totalCashInHand }, bank: { totalInBank } }
  const analytics = res.data.analytics || res.data;
  const availableCash = Number(analytics?.cash?.totalCashInHand || analytics?.cash?.totalCash || analytics?.totalCashInHand || 0) || 0;
  const availableBank = Number(analytics?.bank?.totalInBank || analytics?.bank?.totalInBank || analytics?.bank?.totalInBank || 0) || 0;

  const normalized: CashSummary = {
    availableCash,
    availableBank
  };

  return { ok: true, data: normalized };
}

// Due dates API calls
export async function getOverdueList(): Promise<ApiResponse<OverdueStudent[]>> {
  const res = await apiGet<any>('/payments/overdue');
  if (!res.ok) return res as ApiResponse<OverdueStudent[]>;

  // Backend returns { overdueStudents: [...], totalOverdue, checkedAt }
  const payload = res.data || {};
  const rawList = payload.overdueStudents || payload.data || payload || [];

  // Normalize each overdue entry to a predictable frontend shape
  const list = (rawList || []).map((r: any) => {
    // backend may use different keys: name or Name, phoneNumber or Phone_Number
    const fullName = r.name || r.Name || r.FullName || r.Student_Name || r.studentName || '';
    const phone = r.phoneNumber || r.Phone_Number || r.phone || r.Phone || '';
    const dueDate = r.dueDate || r.DueDate || r.due_date || r.date || '';
    const amountDue = Number(r.amountDue || r.Amount_Due || r.dueAmount || r.Amount || r.amount || 0) || 0;
    const remaining = Number(r.remainingBalance || r.Remaining_Balance || r.balance || 0) || 0;
    const installmentNumber = r.installmentNumber || r.Installment_Number || r.installment || r.paymentNo || null;
    const daysOverdue = r.daysOverdue || r.Days_Overdue || 0;
    const studentId = r.studentId || r.Student_ID || r.id || r.StudentID || null;

    return {
      studentId,
      fullName,
      phone,
      dueDate,
      amountDue,
      remaining,
      installmentNumber,
      daysOverdue,
      raw: r
    };
  });

  return { ok: true, data: list };
}

// Admin helpers
export async function downloadMasterSheet(): Promise<ApiResponse<any>> {
  try {
    const url = API_BASE_URL + '/admin/master-sheet';
    const res = await fetch(url, { method: 'GET', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to download');
    // Create blob and trigger download
    const blob = await res.blob();
    const a = document.createElement('a');
    const urlObj = window.URL.createObjectURL(blob);
    a.href = urlObj;
    a.download = 'master_students.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(urlObj);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Error' };
  }
}

export async function deleteAllData(): Promise<ApiResponse<any>> {
  return apiSend('/admin/delete-all', {}, 'POST');
}

export async function updateInstallments(data: Array<{ number: number; date: string }>): Promise<ApiResponse<any>> {
  return apiSend('/admin/installments', { installments: data }, 'POST');
}

export async function createBackup(): Promise<ApiResponse<any>> {
  return apiSend('/admin/backup', {}, 'POST');
}

export async function undoLastAction(): Promise<ApiResponse<any>> {
  return apiSend('/admin/undo', {}, 'POST');
}

export async function listBackups(): Promise<ApiResponse<any[]>> {
  return apiGet('/admin/backups');
}

export async function refreshToken(): Promise<string | null> {
  try {
    const token = localStorage.getItem('rajac_token');
    if (!token) return null;
    const res = await fetch(API_BASE_URL + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

// Auth
export async function loginUser(username: string, password: string): Promise<any> {
  try {
    const res = await fetch(API_BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await res.json();
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Network error' };
  }
}

export async function getUsers(): Promise<ApiResponse<any[]>> {
  return apiGet('/auth/users');
}

export async function addUser(data: { username: string; password: string; role: string; name: string }): Promise<ApiResponse<any>> {
  return apiSend('/auth/users', data, 'POST');
}

export async function deleteUser(username: string): Promise<ApiResponse<any>> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() }
    });
    return await res.json();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Error' };
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
  return apiSend('/auth/change-password', { currentPassword, newPassword }, 'POST');
}

// Update single student
export async function updateStudentById(studentId: string, updates: {
  name?: string; year?: string; phoneNumber?: string;
  numberOfSubjects?: number; totalFees?: number; discountPercent?: number;
}): Promise<ApiResponse<any>> {
  return apiSend(`/students/${studentId}`, updates, 'PUT');
}

// Delete student
export async function deleteStudentById(studentId: string): Promise<ApiResponse<any>> {
  try {
    const res = await fetch(`${API_BASE_URL}/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() }
    });
    const data = await res.json();
    return { ok: data.success, ...data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Error' };
  }
}

// Bulk update students via Excel
export async function uploadStudentsUpdateFile(file: File): Promise<ApiResponse<any>> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(API_BASE_URL + '/students/upload-update', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    const data = await res.json();
    return { ok: data.success, ...data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Upload failed' };
  }
}

// New Academic Year reset
export async function newAcademicYear(academicYear: string, keepStudents = true): Promise<ApiResponse<any>> {
  return apiSend('/admin/new-academic-year', { academicYear, keepStudents }, 'POST');
}

// Add single student
export async function addStudent(data: {
  name: string;
  year: string;
  numberOfSubjects?: number;
  totalFees: number;
  phoneNumber?: string;
  discountPercent?: number;
  enrollmentDate?: string;
  processedBy?: string;
}): Promise<ApiResponse<any>> {
  return apiSend('/students', data, 'POST');
}

// Search students by name or student ID
export async function searchStudents(query: string): Promise<ApiResponse<any[]>> {
  const res = await apiGet(`/students/search/${encodeURIComponent(query)}`);
  // Backend returns a single student object; normalise to array for the UI
  if (res.ok) {
    const student = (res as any).student ?? (res as any).data;
    return { ...res, data: student ? [student] : [] };
  }
  return { ...res, data: [] };
}

// Upload students via Excel file
export async function uploadStudentsFile(file: File): Promise<ApiResponse<any>> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const url = API_BASE_URL + '/students/upload';
    const response = await fetch(url, { method: 'POST', headers: authHeaders(), body: formData });
    const data = await response.json();
    return { ok: data.success, ...data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Upload failed' };
  }
}

// Teachers API
export async function getTeachers(): Promise<ApiResponse<any[]>> {
  const res = await apiGet<any>('/teachers');
  if (!res.ok) return res as ApiResponse<any[]>;
  // Backend returns { success: true, teachers: [...] }
  return { ok: true, data: res.teachers || res.data || [] };
}

export async function addTeacher(teacher: {
  name: string;
  subject: string;
  numberOfClasses: number;
  totalAmount: number;
}): Promise<ApiResponse<any>> {
  return apiSend('/teachers', teacher, 'POST');
}

export async function payTeacher(payment: {
  teacherName: string;
  amount: number;
  method: string;
}): Promise<ApiResponse<any>> {
  return apiSend('/teachers/payment', payment, 'POST');
}

export async function deleteTeacher(teacherId: string): Promise<ApiResponse<any>> {
  try {
    const url = `${API_BASE_URL}/teachers/${teacherId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    const data = await response.json();
    return { ok: data.success, ...data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateTeacher(teacherId: string, updates: {
  name?: string;
  subject?: string;
  numberOfClasses?: number;
  totalAmount?: number;
}): Promise<ApiResponse<any>> {
  return apiSend(`/teachers/${teacherId}`, updates, 'PUT');
}

