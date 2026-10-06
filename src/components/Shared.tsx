import type { CSSProperties } from 'react'
import type { ReportStatus, Priority, UserRole } from '../data/models'

export const statusConfig: Record<ReportStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: 'Pending', bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  verified: { label: 'Verified', bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  'in-progress': { label: 'In Progress', bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  resolved: { label: 'Resolved', bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  rejected: { label: 'Rejected', bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
}

export const priorityConfig: Record<Priority, { label: string; bg: string; text: string }> = {
  low: { label: 'Low', bg: '#f3f4f6', text: '#6b7280' },
  medium: { label: 'Medium', bg: '#fef3c7', text: '#92400e' },
  high: { label: 'High', bg: '#fee2e2', text: '#991b1b' },
}

export const roleColors: Record<UserRole, { bg: string; text: string; label: string }> = {
  admin: { bg: '#ede9fe', text: '#5b21b6', label: 'Administrator' },
  staff: { bg: '#fef3c7', text: '#92400e', label: 'Barangay Staff' },
  resident: { bg: '#d1fae5', text: '#065f46', label: 'Resident' },
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const cfg = statusConfig[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '0.2rem 0.625rem',
        borderRadius: 100,
        backgroundColor: cfg.bg,
        color: cfg.text,
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = priorityConfig[priority]
  return (
    <span
      style={{
        padding: '0.2rem 0.625rem',
        borderRadius: 100,
        backgroundColor: cfg.bg,
        color: cfg.text,
        fontSize: '0.75rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
    </span>
  )
}

export function RoleBadge({ role }: { role: UserRole }) {
  const cfg = roleColors[role]
  return (
    <span
      style={{
        padding: '0.2rem 0.625rem',
        borderRadius: 100,
        backgroundColor: cfg.bg,
        color: cfg.text,
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  border: '1px solid #d1dce8',
  borderRadius: '8px',
  fontSize: '0.9375rem',
  color: '#0a1f3d',
  backgroundColor: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.375rem',
}

export const pageTitle: CSSProperties = {
  fontFamily: '"DM Serif Display", Georgia, serif',
  fontSize: '1.625rem',
  fontWeight: 400,
  color: '#0a1f3d',
  marginBottom: '0.375rem',
  lineHeight: 1.2,
}

export const pageSubtitle: CSSProperties = {
  color: '#5a7199',
  fontSize: '0.875rem',
  marginBottom: 0,
}

export const card: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  border: '1px solid #d1dce8',
  padding: '1.25rem',
}
