// Shared API model types. Application records now come from the backend.
export type ReportStatus = 'pending' | 'verified' | 'in-progress' | 'resolved' | 'rejected'
export type Priority = 'low' | 'medium' | 'high'
export type UserRole = 'resident' | 'staff' | 'admin'

export interface DrainageReport {
  id: string
  residentUserId?: string | null
  residentName: string | null
  assignedToUserId?: string | null
  location: string
  type: string
  description: string
  priority: Priority
  status: ReportStatus
  submittedAt: string
  updatedAt: string
  assignedTo?: string
}

export interface SystemUser {
  id: string
  name: string
  email: string
  role: UserRole
  barangay: string
  status: 'active' | 'inactive'
  joinedAt: string
}
