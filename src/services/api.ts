import type { DrainageReport, SystemUser, Priority, ReportStatus } from "../data/models";

export interface ApiReport extends DrainageReport {
  residentEmail: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "resident" | "staff" | "admin";
  barangay: string;
  address: string | null;
  phone: string | null;
}

export interface SystemSettings {
  system_name: string;
  barangay_name: string;
  contact_email: string;
  report_prefix: string;
  notifications_enabled: boolean;
}

export interface ReportInput {
  location: string;
  type: string;
  description: string;
  priority: Priority;
}

export type ReportUpdate = Partial<ReportInput> & {
  status?: ReportStatus;
  assignedToUserId?: string | null;
};

export interface Inspection {
  id: string;
  reportId: string;
  reportType: string;
  location: string;
  date: string;
  time: string;
  inspectorUserId?: string | null;
  inspector: string;
  notes: string;
  status: "scheduled" | "completed" | "cancelled";
}

export interface MaintenanceRecord {
  reportId: string;
  reportType: string;
  location: string;
  assignedToUserId: string | null;
  assignedTo: string;
  estimatedCost: string | number | null;
  materials: string;
  notes: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getReports(filters: { status?: ReportStatus; residentEmail?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.residentEmail) query.set("residentEmail", filters.residentEmail);
  const suffix = query.size ? `?${query}` : "";
  return (await request<{ data: ApiReport[] }>(`/api/reports${suffix}`)).data;
}

export async function createReport(input: ReportInput) {
  return (await request<{ data: ApiReport }>("/api/reports", { method: "POST", body: JSON.stringify(input) })).data;
}

export async function updateReport(id: string, input: ReportUpdate) {
  return (await request<{ data: ApiReport }>(`/api/reports/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) })).data;
}

export async function deleteReport(id: string) {
  return request<void>(`/api/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getUsers(role?: SystemUser["role"]) {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  return (await request<{ data: SystemUser[] }>(`/api/users${query}`)).data;
}

export async function createUser(input: Omit<SystemUser, "id" | "joinedAt"> & { password: string }) {
  return (await request<{ data: SystemUser }>("/api/users", { method: "POST", body: JSON.stringify(input) })).data;
}

export async function updateUser(id: string, input: Partial<Omit<SystemUser, "id" | "joinedAt">> & { password?: string }) {
  return (await request<{ data: SystemUser }>(`/api/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) })).data;
}

export async function deleteUser(id: string) {
  return request<void>(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getInspections() {
  return (await request<{ data: Inspection[] }>("/api/inspections")).data;
}

export async function createInspection(input: Omit<Inspection, "id" | "reportType" | "location" | "status" | "inspector">) {
  return (await request<{ data: Inspection }>("/api/inspections", { method: "POST", body: JSON.stringify({ reportId: input.reportId, inspectionDate: input.date, inspectionTime: input.time, inspectorUserId: input.inspectorUserId, notes: input.notes }) })).data;
}

export async function updateInspection(id: string, input: Partial<Pick<Inspection, "date" | "time" | "inspectorUserId" | "notes" | "status">>) {
  return (await request<{ data: Partial<Inspection> }>(`/api/inspections/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ inspectionDate: input.date, inspectionTime: input.time, inspectorUserId: input.inspectorUserId, notes: input.notes, status: input.status }) })).data;
}

export async function deleteInspection(id: string) {
  return request<void>(`/api/inspections/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getMaintenanceRecords() {
  return (await request<{ data: MaintenanceRecord[] }>("/api/maintenance")).data;
}

export async function saveMaintenanceRecord(reportId: string, input: Pick<MaintenanceRecord, "assignedToUserId" | "estimatedCost" | "materials" | "notes">) {
  return (await request<{ data: MaintenanceRecord }>(`/api/maintenance/${encodeURIComponent(reportId)}`, { method: "PUT", body: JSON.stringify({ ...input, estimatedCost: input.estimatedCost === "" ? null : input.estimatedCost }) })).data;
}

export async function deleteMaintenanceRecord(reportId: string) {
  return request<void>(`/api/maintenance/${encodeURIComponent(reportId)}`, { method: "DELETE" });
}

export async function getSettings() {
  return (await request<{ data: SystemSettings }>("/api/settings")).data;
}

export async function saveSettings(settings: SystemSettings) {
  return (await request<{ data: SystemSettings }>("/api/settings", { method: "PUT", body: JSON.stringify(settings) })).data;
}

export async function getCurrentUser() {
  return (await request<{ data: AuthUser }>("/api/auth/me")).data;
}

export async function getLoginCaptcha(email: string) {
  return (await request<{ data: { required: false } | { required: true; id: string; question: string } }>("/api/auth/captcha", { method: "POST", body: JSON.stringify({ email }) })).data;
}

export async function login(email: string, password: string, captcha?: { id: string; answer: string }) {
  const body = captcha ? { email, password, captchaId: captcha.id, captchaAnswer: captcha.answer } : { email, password };
  return (await request<{ data: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) })).data;
}

export async function requestPasswordReset(email: string) {
  return request<{ message: string }>("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase() }) });
}

export async function confirmPasswordReset(input: { email: string; otp: string; password: string; confirmPassword: string }) {
  return request<{ message: string }>("/api/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ ...input, email: input.email.trim().toLowerCase() }) });
}

export async function registerResident(input: { name: string; email: string; password: string; confirmPassword: string; role: "resident"; address: string; phone: string }) {
  return request<{ message: string }>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export async function updateProfile(input: { name: string; address: string; phone: string }) {
  return (await request<{ data: AuthUser }>("/api/profile", { method: "PATCH", body: JSON.stringify(input) })).data;
}

export async function logout() {
  return request<void>("/api/auth/logout", { method: "POST" });
}
