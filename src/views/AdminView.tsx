import { useEffect, useState } from 'react'
import type { SystemUser, UserRole } from '../data/models'
import { createUser, deleteUser, getReports, getSettings, getUsers, saveSettings, updateUser, type ApiReport, type SystemSettings } from '../services/api'
import { StatusBadge, PriorityBadge, RoleBadge, formatDate, pageTitle, pageSubtitle, card, inputStyle, labelStyle } from '../components/Shared'

export default function AdminView({ activeTab }: { activeTab: string }) {
  if (activeTab === 'dashboard') return <DashboardTab />
  if (activeTab === 'users') return <ManageUsersTab />
  if (activeTab === 'staff-accounts') return <ManageStaffAccountsTab />
  return <GenerateReportsTab />
}

/* ────────── Dashboard & Analytics ────────── */

function DashboardTab() {
  const [reports, setReports] = useState<ApiReport[]>([])
  const [activeUsers, setActiveUsers] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    void Promise.all([getReports(), getUsers()]).then(([items, users]) => {
      setReports(items)
      setActiveUsers(users.filter((user) => user.status === 'active').length)
    }).catch((err: Error) => setError(err.message))
  }, [])
  const total = reports.length
  const pending = reports.filter((r) => r.status === 'pending').length
  const inProgress = reports.filter((r) => r.status === 'in-progress' || r.status === 'verified').length
  const resolved = reports.filter((r) => r.status === 'resolved').length
  const recent = reports.slice(0, 5)
  const monthlyStats = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index))
    const month = date.toLocaleDateString('en', { month: 'short' })
    const key = date.toISOString().slice(0, 7)
    return { month, count: reports.filter((report) => report.submittedAt.startsWith(key)).length }
  })

  const stats = [
    { label: 'Total Reports', value: total, icon: '📋', color: '#1a5fb4', bg: '#dbeafe' },
    { label: 'Pending Review', value: pending, icon: '⏳', color: '#d97706', bg: '#fef3c7' },
    { label: 'In Progress', value: inProgress, icon: '🔧', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Resolved', value: resolved, icon: '✅', color: '#059669', bg: '#d1fae5' },
    { label: 'Active Users', value: activeUsers, icon: '👥', color: '#0891b2', bg: '#cffafe' },
  ]

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={pageTitle}>Dashboard &amp; Analytics</h1>
        <p style={pageSubtitle}>System-wide overview of drainage reports, activity, and performance</p>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>Could not load dashboard: {error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {stats.map((s) => (
          <div key={s.label} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0a1f3d', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.8125rem', color: '#5a7199', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={card}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '1.5rem' }}>Reports Submitted per Month</h2>
          <BarChart data={monthlyStats} />
        </div>
        <div style={card}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '1.25rem' }}>Status Breakdown</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {[
              { label: 'Pending', count: pending, color: '#f59e0b' },
              { label: 'Verified', count: reports.filter((r) => r.status === 'verified').length, color: '#3b82f6' },
              { label: 'In Progress', count: reports.filter((r) => r.status === 'in-progress').length, color: '#8b5cf6' },
              { label: 'Resolved', count: resolved, color: '#10b981' },
              { label: 'Rejected', count: reports.filter((r) => r.status === 'rejected').length, color: '#ef4444' },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>{label}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0a1f3d' }}>{count}</span>
                </div>
                <div style={{ height: 6, backgroundColor: '#e8eef7', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${total ? (count / total) * 100 : 0}%`, backgroundColor: color, borderRadius: 100 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '1rem' }}>Recent Reports</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8eef7' }}>
                {['Report ID', 'Resident', 'Type', 'Location', 'Priority', 'Status', 'Date'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#8eadd4', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((report, i) => (
                <tr key={report.id} style={{ borderBottom: i < recent.length - 1 ? '1px solid #f0f4fa' : 'none' }}>
                  <td style={{ padding: '0.75rem', fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', color: '#5a7199', whiteSpace: 'nowrap' }}>{report.id}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: '#0a1f3d', whiteSpace: 'nowrap' }}>{report.residentName}</td>
                  <td style={{ padding: '0.75rem', color: '#374151' }}>{report.type}</td>
                  <td style={{ padding: '0.75rem', color: '#5a7199', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.location}</td>
                  <td style={{ padding: '0.75rem' }}><PriorityBadge priority={report.priority} /></td>
                  <td style={{ padding: '0.75rem' }}><StatusBadge status={report.status} /></td>
                  <td style={{ padding: '0.75rem', color: '#5a7199', whiteSpace: 'nowrap' }}>{formatDate(report.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BarChart({ data }: { data: { month: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count))
  const chartH = 100
  const barW = 32
  const gap = 20
  const totalW = data.length * (barW + gap) - gap
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={totalW + 4} height={chartH + 36} style={{ overflow: 'visible', display: 'block' }}>
        {data.map((d, i) => {
          const barH = Math.max(4, (d.count / maxCount) * chartH)
          const x = i * (barW + gap)
          const isHov = hovered === i
          return (
            <g key={d.month} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={chartH - barH} width={barW} height={barH} rx={5} fill={isHov ? '#1248a0' : '#1a5fb4'} style={{ transition: 'fill 0.15s' }} />
              <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={11} fill="#8eadd4" fontFamily="DM Sans, sans-serif">{d.month}</text>
              {isHov && <text x={x + barW / 2} y={chartH - barH - 8} textAnchor="middle" fontSize={11} fontWeight="700" fill="#0a1f3d" fontFamily="DM Sans, sans-serif">{d.count}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ────────── Manage Users (Residents) ────────── */

function ManageUsersTab() {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<SystemUser | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void getUsers('resident').then(setUsers).catch((err: Error) => setError(err.message)) }, [])

  const handleSave = async (user: SystemUser & { password?: string }) => {
    try {
      const saved = editUser ? await updateUser(user.id, user) : await createUser({ ...user, password: user.password! })
      setUsers((prev) => editUser ? prev.map((item) => item.id === saved.id ? saved : item) : [...prev, saved])
      setShowModal(false); setEditUser(null); setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save user') }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Manage Users</h1>
          <p style={pageSubtitle}>Add, edit, or remove resident accounts in the system</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowModal(true) }} style={{ padding: '0.625rem 1.25rem', backgroundColor: '#1a5fb4', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit', flexShrink: 0 }}>
          + Add User
        </button>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <UsersTable users={users} onEdit={(u) => { setEditUser(u); setShowModal(true) }} onDelete={(id) => setDeleteId(id)} />
      {showModal && <UserModal user={editUser} defaultRole="resident" allowedRoles={['resident']} onSave={handleSave} onClose={() => { setShowModal(false); setEditUser(null) }} />}
      {deleteId && <ConfirmDelete userName={users.find((u) => u.id === deleteId)?.name ?? ''} onConfirm={async () => { try { await deleteUser(deleteId); setUsers((prev) => prev.filter((u) => u.id !== deleteId)); setDeleteId(null); setError('') } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete user') } }} onCancel={() => setDeleteId(null)} />}
    </div>
  )
}

/* ────────── Manage Barangay Staff Accounts ────────── */

function ManageStaffAccountsTab() {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<SystemUser | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void getUsers().then((all) => setUsers(all.filter((u) => u.role === 'staff' || u.role === 'admin'))).catch((err: Error) => setError(err.message)) }, [])

  const handleSave = async (user: SystemUser & { password?: string }) => {
    try {
      const saved = editUser ? await updateUser(user.id, user) : await createUser({ ...user, password: user.password! })
      setUsers((prev) => editUser ? prev.map((item) => item.id === saved.id ? saved : item) : [...prev, saved])
      setShowModal(false); setEditUser(null); setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save user') }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Manage Staff Accounts</h1>
          <p style={pageSubtitle}>Manage Barangay Staff and Administrator accounts, roles, and system access</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowModal(true) }} style={{ padding: '0.625rem 1.25rem', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit', flexShrink: 0 }}>
          + Add Staff Account
        </button>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Staff', count: users.length, color: '#1a5fb4' },
          { label: 'Barangay Staff', count: users.filter((u) => u.role === 'staff').length, color: '#f59e0b' },
          { label: 'Administrators', count: users.filter((u) => u.role === 'admin').length, color: '#8b5cf6' },
          { label: 'Active', count: users.filter((u) => u.status === 'active').length, color: '#059669' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ backgroundColor: '#ffffff', border: '1px solid #d1dce8', borderRadius: 8, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.0625rem', fontWeight: 800, color }}>{count}</span>
            <span style={{ fontSize: '0.8125rem', color: '#5a7199' }}>{label}</span>
          </div>
        ))}
      </div>

      <UsersTable users={users} onEdit={(u) => { setEditUser(u); setShowModal(true) }} onDelete={(id) => setDeleteId(id)} />
      {showModal && <UserModal user={editUser} defaultRole="staff" allowedRoles={['staff', 'admin']} onSave={handleSave} onClose={() => { setShowModal(false); setEditUser(null) }} />}
      {deleteId && <ConfirmDelete userName={users.find((u) => u.id === deleteId)?.name ?? ''} onConfirm={async () => { try { await deleteUser(deleteId); setUsers((prev) => prev.filter((u) => u.id !== deleteId)); setDeleteId(null); setError('') } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete user') } }} onCancel={() => setDeleteId(null)} />}
    </div>
  )
}

/* ────────── Generate Reports ────────── */

type ReportFormat = 'pdf' | 'csv' | 'xlsx'

const reportHeaders = ['Report ID', 'Submitted', 'Resident', 'Location', 'Type', 'Description', 'Priority', 'Status', 'Assigned To']

function reportRows(reports: ApiReport[]) {
  return reports.map((report) => [report.id, report.submittedAt.slice(0, 10), report.residentName ?? '', report.location, report.type, report.description, report.priority, report.status, report.assignedTo ?? ''])
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function createXlsxBlob(rows: string[][]) {
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    let column = ''
    for (let index = columnIndex + 1; index > 0; index = Math.floor((index - 1) / 26)) column = String.fromCharCode(65 + ((index - 1) % 26)) + column
    return `<c r="${column}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
  }).join('')}</row>`).join('')
  const files: [string, string][] = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Drainage Reports" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`],
  ]
  const encoder = new TextEncoder()
  const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    return (crc ^ 0xffffffff) >>> 0
  }
  const u16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true)
  const u32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value, true)
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0
  for (const [name, contents] of files) {
    const nameBytes = encoder.encode(name)
    const contentBytes = encoder.encode(contents)
    const checksum = crc32(contentBytes)
    const local = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(local.buffer)
    u32(localView, 0, 0x04034b50); u16(localView, 4, 20); u16(localView, 6, 0); u16(localView, 8, 0); u16(localView, 10, 0); u16(localView, 12, 0)
    u32(localView, 14, checksum); u32(localView, 18, contentBytes.length); u32(localView, 22, contentBytes.length); u16(localView, 26, nameBytes.length); u16(localView, 28, 0)
    u16(localView, 10, 0); u16(localView, 12, 0x21)
    local.set(nameBytes, 30)
    localParts.push(local, contentBytes)
    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    u32(centralView, 0, 0x02014b50); u16(centralView, 4, 20); u16(centralView, 6, 20); u16(centralView, 8, 0); u16(centralView, 10, 0); u16(centralView, 12, 0); u16(centralView, 14, 0)
    u32(centralView, 16, checksum); u32(centralView, 20, contentBytes.length); u32(centralView, 24, contentBytes.length); u16(centralView, 28, nameBytes.length); u16(centralView, 30, 0); u16(centralView, 32, 0); u16(centralView, 34, 0); u16(centralView, 36, 0); u32(centralView, 38, 0); u32(centralView, 42, localOffset)
    u16(centralView, 12, 0); u16(centralView, 14, 0x21)
    central.set(nameBytes, 46)
    centralParts.push(central)
    localOffset += local.length + contentBytes.length
  }
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  u32(endView, 0, 0x06054b50); u16(endView, 4, 0); u16(endView, 6, 0); u16(endView, 8, files.length); u16(endView, 10, files.length); u32(endView, 12, centralSize); u32(endView, 16, localOffset); u16(endView, 20, 0)
  const zipSize = [...localParts, ...centralParts, end].reduce((size, part) => size + part.length, 0)
  const zip = new Uint8Array(zipSize)
  let zipOffset = 0
  for (const part of [...localParts, ...centralParts, end]) { zip.set(part, zipOffset); zipOffset += part.length }
  return new Blob([zip.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function createPdfBlob(rows: string[][]) {
  const safe = (value: string) => value.normalize('NFKD').replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const wrapped = rows.flatMap((row) => {
    const [id, submitted, resident, location, type, description, priority, status, assigned] = row
    const text = `${id} | ${submitted} | ${resident} | ${location} | ${type} | ${description} | ${priority} | ${status} | ${assigned}`
    const chunks: string[] = []
    for (let start = 0; start < text.length; start += 105) chunks.push(text.slice(start, start + 105))
    return chunks.length ? chunks : ['']
  })
  const lines = [`Barangay Drainage Management System - Reports`, `Generated ${new Date().toLocaleDateString('en-PH')} | ${rows.length} record(s)`, reportHeaders.join(' | '), '', ...wrapped]
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += 48) pages.push(lines.slice(index, index + 48))
  if (!pages.length) pages.push(['No reports match the selected filters.'])
  const objects: string[] = ['']
  const pageIds: number[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  pages.forEach((page, index) => {
    const pageId = objects.length
    const streamId = pageId + 1
    pageIds.push(pageId)
    const commands = ['BT', '/F1 9 Tf', '40 800 Td', '12 TL', ...page.flatMap((line) => [`(${safe(line)}) Tj`, 'T*']), 'ET'].join('\n')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`)
    objects.push(`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`)
  })
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id++) { offsets[id] = pdf.length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n` }
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function GenerateReportsTab() {
  const [reports, setReports] = useState<ApiReport[]>([])
  const [loadError, setLoadError] = useState('')
  const today = new Date()
  const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const [dateFrom, setDateFrom] = useState(dateInput(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [dateTo, setDateTo] = useState(dateInput(today))
  const [statusFilter, setStatusFilter] = useState('all')
  const [format, setFormat] = useState<ReportFormat>('pdf')
  const [generated, setGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    void getReports().then(setReports).catch((err: Error) => setLoadError(err.message))
    void getSettings().then(setSettings).catch((err: Error) => setSettingsError(err.message))
  }, [])

  const handleGenerate = () => {
    setGenerating(true)
    setGenerated(false)
    setTimeout(() => { setGenerating(false); setGenerated(true) }, 200)
  }

  const filteredReports = reports.filter((r) => {
    const submittedDate = r.submittedAt.slice(0, 10)
    const inRange = submittedDate >= dateFrom && submittedDate <= dateTo
    return inRange && (statusFilter === 'all' || r.status === statusFilter)
  })
  const filteredCount = filteredReports.length
  const downloadReport = () => {
    const rows = [reportHeaders, ...reportRows(filteredReports)]
    const filename = `drainage-report-${dateFrom}-to-${dateTo}.${format}`
    if (format === 'csv') {
      const csv = rows.map((row) => row.map((cell) => {
        const safeCell = /^[=+@-]/.test(cell) ? `'${cell}` : cell
        return `"${safeCell.replace(/"/g, '""')}"`
      }).join(',')).join('\r\n')
      downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), filename)
    } else if (format === 'xlsx') {
      downloadBlob(createXlsxBlob(rows), filename)
    } else {
      downloadBlob(createPdfBlob(reportRows(filteredReports)), filename)
    }
  }

  const presets = [
    { label: 'Summary Report', desc: 'Overview of all reports with status breakdown and trends', icon: '📊' },
    { label: 'Detailed Report', desc: 'Full details of each report including descriptions and personnel', icon: '📋' },
    { label: 'Maintenance Cost Report', desc: 'Estimated costs and materials per resolved report', icon: '💰' },
    { label: 'Performance Report', desc: 'Staff performance metrics and resolution times', icon: '⚡' },
  ]

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={pageTitle}>Generate Reports</h1>
        <p style={pageSubtitle}>Export drainage maintenance data as PDF, CSV, or XLSX for records and auditing</p>
      </div>
      {loadError && <p role="alert" style={{ color: '#b91c1c' }}>Could not load reports: {loadError}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', maxWidth: 820, alignItems: 'start' }}>
        {/* Filters */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '1rem', gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0a1f3d', paddingBottom: '0.75rem', borderBottom: '1px solid #e8eef7' }}>Report Filters</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <label style={labelStyle}>Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setGenerated(false) }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setGenerated(false) }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Status Filter</label>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setGenerated(false) }} style={inputStyle}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div style={{ backgroundColor: '#f0f4fa', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#5a7199' }}>
            <span style={{ fontWeight: 600, color: '#0a1f3d' }}>{filteredCount} report{filteredCount !== 1 ? 's' : ''}</span> match the selected filters.
          </div>

          {/* Format selector */}
          <div>
            <label style={labelStyle}>Export Format</label>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              {(['pdf', 'csv', 'xlsx'] as ReportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFormat(f); setGenerated(false) }}
                  style={{ flex: 1, padding: '0.625rem', border: `1px solid ${format === f ? '#1a5fb4' : '#d1dce8'}`, borderRadius: 8, backgroundColor: format === f ? '#dbeafe' : '#ffffff', color: format === f ? '#1e40af' : '#5a7199', fontWeight: format === f ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ padding: '0.75rem', backgroundColor: generating ? '#8eadd4' : '#1a5fb4', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontSize: '0.9375rem', fontFamily: 'inherit' }}
          >
            {generating ? '⏳ Generating…' : `Generate ${format.toUpperCase()} Report`}
          </button>
        </div>

        {/* Generated file preview */}
        {generated && (
          <div style={{ ...card, border: '1px solid #a7f3d0', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {format === 'pdf' ? '📄' : format === 'csv' ? '📊' : '📗'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0a1f3d', marginBottom: '0.2rem' }}>
                    drainage-report-{dateFrom}-to-{dateTo}.{format}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#5a7199' }}>
                    {filteredCount} records · {format.toUpperCase()} · Generated {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <button
                onClick={downloadReport}
                style={{ padding: '0.5625rem 1.25rem', backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}
              >
                ↓ Download
              </button>
            </div>
            <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '0.9375rem', color: '#0a1f3d', marginBottom: '0.75rem' }}>Report preview</h3>
              {filteredReports.length === 0 ? <p style={{ color: '#5a7199', fontSize: '0.875rem' }}>No reports match these filters.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                <thead><tr>{reportHeaders.map((header) => <th key={header} style={{ padding: '0.625rem', borderBottom: '1px solid #d1dce8', color: '#5a7199', whiteSpace: 'nowrap' }}>{header}</th>)}</tr></thead>
                <tbody>{reportRows(filteredReports).map((row, rowIndex) => <tr key={filteredReports[rowIndex].id}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} style={{ padding: '0.625rem', borderBottom: '1px solid #e8eef7', color: '#334155', maxWidth: cellIndex === 5 ? 320 : undefined, whiteSpace: cellIndex === 5 ? 'normal' : 'nowrap' }}>{cell || '—'}</td>)}</tr>)}</tbody>
              </table>}
            </div>
          </div>
        )}

        {/* Report presets */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '1rem' }}>Report Templates</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem' }}>
            {presets.map((p) => (
              <div key={p.label} style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: 10, border: '1px solid #e8eef7', cursor: 'pointer' }} onClick={() => { setGenerated(false) }}>
                <div style={{ fontSize: 22, marginBottom: '0.5rem' }}>{p.icon}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0a1f3d', marginBottom: '0.25rem' }}>{p.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#5a7199', lineHeight: 1.45 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Manage System Settings (included via Generate Reports) */}
        <div style={{ gridColumn: '1 / -1' }}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: '#5a7199' }}
          >
            <span style={{ fontSize: 14 }}>⚙️</span>
            Manage System Settings
            <span style={{ marginLeft: '0.25rem' }}>{settingsOpen ? '▲' : '▼'}</span>
          </button>
          {settingsOpen && (
            <div style={{ ...card, marginTop: '0.75rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '1.125rem' }}>System Settings</h3>
              {settingsError && <p role="alert" style={{ color: '#b91c1c' }}>{settingsError}</p>}
              {settings && <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {([
                  { label: 'System Name', key: 'system_name' },
                  { label: 'Barangay Name', key: 'barangay_name' },
                  { label: 'Contact Email', key: 'contact_email' },
                  { label: 'Report Reference Prefix', key: 'report_prefix' },
                ] as const).map(({ label, key }) => (
                  <div key={label}>
                    <label style={labelStyle}>{label}</label>
                    <input value={settings[key]} onChange={(event) => { setSettings({ ...settings, [key]: event.target.value }); setSettingsSaved(false) }} style={inputStyle} />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="checkbox" id="notif" checked={settings.notifications_enabled} onChange={(event) => { setSettings({ ...settings, notifications_enabled: event.target.checked }); setSettingsSaved(false) }} style={{ width: 16, height: 16 }} />
                  <label htmlFor="notif" style={{ fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}>
                    Enable email status notifications for residents
                  </label>
                </div>
              </div>
              <button onClick={async () => { if (!settings) return; try { setSettings(await saveSettings(settings)); setSettingsSaved(true); setSettingsError('') } catch (error) { setSettingsError(error instanceof Error ? error.message : 'Could not save settings') } }} style={{ marginTop: '1rem', padding: '0.5625rem 1.5rem', backgroundColor: '#1a5fb4', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>
                {settingsSaved ? 'Settings Saved' : 'Save Settings'}
              </button>
              </>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ────────── Shared table + modal components ────────── */

function UsersTable({ users, onEdit, onDelete }: { users: SystemUser[]; onEdit: (u: SystemUser) => void; onDelete: (id: string) => void }) {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e8eef7', backgroundColor: '#f8fafc' }}>
              {['User', 'Email', 'Role', 'Barangay', 'Status', 'Joined', 'Actions'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#8eadd4', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr key={user.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f0f4fa' : 'none' }}>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ fontWeight: 600, color: '#0a1f3d' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#8eadd4', fontFamily: '"DM Mono", monospace' }}>{user.id}</div>
                </td>
                <td style={{ padding: '0.875rem 1rem', color: '#5a7199' }}>{user.email}</td>
                <td style={{ padding: '0.875rem 1rem' }}><RoleBadge role={user.role} /></td>
                <td style={{ padding: '0.875rem 1rem', color: '#374151', whiteSpace: 'nowrap' }}>{user.barangay}</td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.2rem 0.625rem', borderRadius: 100, backgroundColor: user.status === 'active' ? '#d1fae5' : '#f3f4f6', color: user.status === 'active' ? '#065f46' : '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: user.status === 'active' ? '#10b981' : '#9ca3af', display: 'inline-block' }} />
                    {user.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '0.875rem 1rem', color: '#5a7199', whiteSpace: 'nowrap' }}>{formatDate(user.joinedAt)}</td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => onEdit(user)} style={{ padding: '0.3125rem 0.75rem', backgroundColor: '#f0f4fa', color: '#1a5fb4', border: '1px solid #d1dce8', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}>Edit</button>
                    <button onClick={() => onDelete(user.id)} style={{ padding: '0.3125rem 0.75rem', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UserModal({ user, defaultRole, allowedRoles, onSave, onClose }: { user: SystemUser | null; defaultRole: UserRole; allowedRoles: UserRole[]; onSave: (u: SystemUser & { password?: string }) => void; onClose: () => void }) {
  const blank: SystemUser = { id: '', name: '', email: '', role: defaultRole, barangay: '', status: 'active', joinedAt: '' }
  const [form, setForm] = useState<SystemUser>(user ?? blank)
  const [password, setPassword] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(6,15,36,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }} onClick={onClose}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: '1.375rem', fontWeight: 400, color: '#0a1f3d', marginBottom: '1.5rem' }}>
          {user ? 'Edit User' : 'Add New User'}
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, ...(password ? { password } : {}) }) }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Juan dela Cruz" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Email Address *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g., user@example.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{user ? 'Reset password (optional)' : 'Initial password *'}</label>
            <input required={!user} type="password" minLength={6} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={inputStyle} />
            <small style={{ color: '#8eadd4' }}>Use 6–72 characters.</small>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Role *</label>
              <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} style={inputStyle}>
                {allowedRoles.map((role) => <option key={role} value={role}>{role === 'resident' ? 'Resident' : role === 'staff' ? 'Barangay Staff' : 'Administrator'}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} style={inputStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Barangay</label>
            <input readOnly value={form.barangay || 'Set in System Settings'} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} />
            <small style={{ color: '#64748b' }}>All accounts use the barangay name configured in System Settings.</small>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.6875rem', backgroundColor: 'transparent', color: '#5a7199', border: '1px solid #d1dce8', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" style={{ flex: 1, padding: '0.6875rem', backgroundColor: '#1a5fb4', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {user ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDelete({ userName, onConfirm, onCancel }: { userName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(6,15,36,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }} onClick={onCancel}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 380, textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 40, marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '0.5rem' }}>Delete User?</h3>
        <p style={{ color: '#5a7199', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          You are about to permanently delete <strong style={{ color: '#0a1f3d' }}>{userName}</strong>. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '0.6875rem', backgroundColor: 'transparent', color: '#5a7199', border: '1px solid #d1dce8', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '0.6875rem', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}
