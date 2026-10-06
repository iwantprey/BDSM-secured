import { useEffect, useState } from 'react'
import type { DrainageReport, ReportStatus, SystemUser } from '../data/models'
import { createInspection, deleteInspection, deleteMaintenanceRecord, getInspections, getMaintenanceRecords, getReports, getUsers, saveMaintenanceRecord, updateInspection, updateReport, type ApiReport, type AuthUser, type Inspection, type MaintenanceRecord as ApiMaintenanceRecord } from '../services/api'
import { StatusBadge, PriorityBadge, formatDate, pageTitle, pageSubtitle, card, statusConfig, inputStyle, labelStyle } from '../components/Shared'

export default function StaffView({ activeTab, user }: { activeTab: string; user: AuthUser }) {
  if (activeTab === 'submitted') return <SubmittedReportsTab />
  if (activeTab === 'inspect') return <ScheduleInspectionTab currentUser={user} />
  if (activeTab === 'update') return <UpdateStatusTab />
  return <RecordMaintenanceTab />
}

/* ────────── View Submitted Reports ────────── */

function SubmittedReportsTab() {
  const [reports, setReports] = useState<ApiReport[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const filtered = reports.filter((r) => {
    const matchSearch = r.id.toLowerCase().includes(search.toLowerCase()) || (r.residentName ?? '').toLowerCase().includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase()) || r.location.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || r.status === filter
    return matchSearch && matchFilter
  })

  useEffect(() => { void getReports().then(setReports).catch((err: Error) => setError(err.message)) }, [])

  const handleManage = async (id: string, action: 'verify' | 'reject') => {
    try {
      const updated = await updateReport(id, { status: action === 'verify' ? 'verified' : 'rejected' })
      setReports((prev) => prev.map((report) => report.id === id ? updated : report))
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update report') }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={pageTitle}>View Submitted Reports</h1>
        <p style={pageSubtitle}>Browse all resident-submitted drainage reports and manage them</p>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, resident, type, or location…"
          style={{ ...inputStyle, maxWidth: 320, flex: '1 1 200px' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', 'pending', 'verified', 'in-progress', 'resolved', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 100, border: `1px solid ${filter === f ? '#f59e0b' : '#d1dce8'}`, backgroundColor: filter === f ? '#fef3c7' : '#ffffff', color: filter === f ? '#92400e' : '#5a7199', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}
            >
              {f === 'all' ? 'All' : f.replace('-', ' ')}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.8125rem', color: '#8eadd4', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {filtered.length} report{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 800 }}>
        {filtered.map((report) => (
          <div key={report.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', fontWeight: 600, color: '#8eadd4' }}>{report.id}</span>
                  <StatusBadge status={report.status} />
                  <PriorityBadge priority={report.priority} />
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '0.2rem' }}>{report.type}</div>
                <div style={{ fontSize: '0.875rem', color: '#5a7199', marginBottom: '0.25rem' }}>📍 {report.location}</div>
                <div style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.5 }}>{report.description}</div>
                <div style={{ fontSize: '0.75rem', color: '#8eadd4', marginTop: '0.375rem' }}>
                  Submitted by <span style={{ color: '#374151', fontWeight: 500 }}>{report.residentName}</span> · {formatDate(report.submittedAt)}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                {report.assignedTo && (
                  <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#8eadd4' }}>Assigned To</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a5fb4' }}>{report.assignedTo}</div>
                  </div>
                )}
              </div>
            </div>

            {report.status === 'pending' && (
              <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f0f4fa' }}>
                <button onClick={() => handleManage(report.id, 'verify')} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1a5fb4', color: '#ffffff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit' }}>
                  ✔ Verify &amp; Manage
                </button>
                <button onClick={() => handleManage(report.id, 'reject')} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit' }}>
                  ✗ Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ────────── Schedule Inspection ────────── */

function ScheduleInspectionTab({ currentUser }: { currentUser: AuthUser }) {
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [availableReports, setAvailableReports] = useState<DrainageReport[]>([])
  const [showForm, setShowForm] = useState(false)
  const [staffUsers, setStaffUsers] = useState<SystemUser[]>([])
  const [form, setForm] = useState({ reportId: '', location: '', date: '', time: '09:00', inspectorUserId: currentUser.id, notes: '' })

  useEffect(() => { void getReports().then(setAvailableReports).catch(() => setAvailableReports([])) }, [])
  useEffect(() => { void getUsers('staff').then(setStaffUsers).catch(() => setStaffUsers([])) }, [])
  const reloadInspections = () => getInspections().then(setInspections)
  useEffect(() => { void reloadInspections().catch(() => setInspections([])) }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createInspection({ reportId: form.reportId, date: form.date, time: form.time, inspectorUserId: form.inspectorUserId, notes: form.notes })
      await reloadInspections()
      setShowForm(false)
      setForm({ reportId: '', location: '', date: '', time: '09:00', inspectorUserId: currentUser.id, notes: '' })
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not schedule inspection') }
  }

  const toggle = async (inspection: Inspection) => {
    const status = inspection.status === 'scheduled' ? 'completed' : 'scheduled'
    try { await updateInspection(inspection.id, { status }); await reloadInspections() }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Could not update inspection') }
  }

  const inspStatusCfg: Record<Inspection['status'], { label: string; bg: string; text: string }> = {
    scheduled: { label: 'Scheduled', bg: '#dbeafe', text: '#1e40af' },
    completed: { label: 'Completed', bg: '#d1fae5', text: '#065f46' },
    cancelled: { label: 'Cancelled', bg: '#fee2e2', text: '#991b1b' },
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Schedule Inspection</h1>
          <p style={pageSubtitle}>Plan and track on-site inspections for drainage reports</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '0.625rem 1.25rem', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit', flexShrink: 0 }}>
          + Schedule Inspection
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ ...card, maxWidth: 600, marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0a1f3d', paddingBottom: '0.75rem', borderBottom: '1px solid #e8eef7' }}>New Inspection</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Report ID *</label>
              <select required value={form.reportId} onChange={(e) => setForm({ ...form, reportId: e.target.value })} style={inputStyle}>
                <option value="">Select report</option>
                {availableReports.filter((r) => r.status === 'pending' || r.status === 'verified').map((r) => (
                  <option key={r.id} value={r.id}>{r.id} — {r.type}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assigned Inspector *</label>
              <select required value={form.inspectorUserId} onChange={(e) => setForm({ ...form, inspectorUserId: e.target.value })} style={inputStyle}>
                {staffUsers.filter((person) => person.status === 'active').map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Inspection Date *</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Time *</label>
              <input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g., Bring desilting equipment" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '0.625rem', backgroundColor: 'transparent', color: '#5a7199', border: '1px solid #d1dce8', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" style={{ flex: 1, padding: '0.625rem', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Schedule</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 720 }}>
        {inspections.map((ins) => {
          const scfg = inspStatusCfg[ins.status]
          return (
            <div key={ins.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', fontWeight: 600, color: '#8eadd4' }}>{ins.id}</span>
                    <span style={{ padding: '0.2rem 0.625rem', borderRadius: 100, backgroundColor: scfg.bg, color: scfg.text, fontSize: '0.75rem', fontWeight: 600 }}>{scfg.label}</span>
                    <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', color: '#5a7199' }}>{ins.reportId}</span>
                  </div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '0.2rem' }}>{ins.reportType}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#5a7199', marginBottom: '0.25rem' }}>📍 {ins.location}</div>
                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8125rem', color: '#374151', marginBottom: ins.notes ? '0.375rem' : 0, flexWrap: 'wrap' }}>
                    <span>📅 {formatDate(ins.date)} at {ins.time}</span>
                    <span>👷 {ins.inspector}</span>
                  </div>
                  {ins.notes && <div style={{ fontSize: '0.8125rem', color: '#8eadd4', fontStyle: 'italic' }}>"{ins.notes}"</div>}
                </div>
                {ins.status !== 'cancelled' && (
                  <button
                    onClick={() => void toggle(ins)}
                    style={{ padding: '0.375rem 0.875rem', backgroundColor: ins.status === 'scheduled' ? '#d1fae5' : '#f0f4fa', color: ins.status === 'scheduled' ? '#065f46' : '#5a7199', border: `1px solid ${ins.status === 'scheduled' ? '#a7f3d0' : '#d1dce8'}`, borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    {ins.status === 'scheduled' ? '✔ Mark Done' : '↺ Reopen'}
                  </button>
                )}
                <button type="button" onClick={async () => { if (!window.confirm('Delete this inspection?')) return; try { await deleteInspection(ins.id); await reloadInspections() } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not delete inspection') } }} style={{ padding: '0.375rem 0.75rem', color: '#b91c1c', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ────────── Update Maintenance Status ────────── */

const updatableStatuses: ReportStatus[] = ['verified', 'in-progress', 'resolved']

function UpdateStatusTab() {
  const [reports, setReports] = useState<ApiReport[]>([])
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  useEffect(() => { void getReports().then((items) => setReports(items.filter((r) => updatableStatuses.includes(r.status)))).catch((err: Error) => setError(err.message)) }, [])

  const handleStatusChange = (id: string, newStatus: ReportStatus) => {
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus, updatedAt: new Date().toISOString().slice(0, 10) } : r))
  }

  const handleSave = (id: string) => {
    const report = reports.find((item) => item.id === id)
    if (!report) return
    void updateReport(id, { status: report.status }).then((updated) => {
      setReports((prev) => prev.map((item) => item.id === id ? updated : item))
      setSaved((prev) => ({ ...prev, [id]: true }))
      setError('')
      setTimeout(() => setSaved((prev) => ({ ...prev, [id]: false })), 2000)
    }).catch((err: Error) => setError(err.message))
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={pageTitle}>Update Maintenance Status</h1>
        <p style={pageSubtitle}>Advance report status through the maintenance pipeline</p>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['verified', 'in-progress', 'resolved'] as ReportStatus[]).map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
        <span style={{ fontSize: '0.8125rem', color: '#8eadd4', alignSelf: 'center' }}>— active pipeline stages</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 800 }}>
        {reports.map((report) => (
          <div key={report.id} style={card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', fontWeight: 600, color: '#8eadd4' }}>{report.id}</span>
                  <StatusBadge status={report.status} />
                  <PriorityBadge priority={report.priority} />
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '0.25rem' }}>{report.type}</div>
                <div style={{ fontSize: '0.8125rem', color: '#5a7199' }}>📍 {report.location}</div>
                <div style={{ fontSize: '0.8125rem', color: '#8eadd4', marginTop: '0.25rem' }}>
                  Reported by <span style={{ color: '#374151', fontWeight: 500 }}>{report.residentName}</span>
                  {report.assignedTo && <> · <span style={{ color: '#1a5fb4', fontWeight: 500 }}>{report.assignedTo}</span></>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6875rem', color: '#8eadd4' }}>Updated</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>{formatDate(report.updatedAt)}</div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e8eef7', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#5a7199', flexShrink: 0 }}>Set Status:</span>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                {updatableStatuses.map((s) => {
                  const cfg = statusConfig[s]
                  const isActive = report.status === s
                  return (
                    <button key={s} onClick={() => handleStatusChange(report.id, s)} style={{ padding: '0.375rem 0.875rem', borderRadius: 100, border: `1px solid ${isActive ? cfg.dot : '#d1dce8'}`, backgroundColor: isActive ? cfg.bg : 'transparent', color: isActive ? cfg.text : '#5a7199', fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
              <button onClick={() => handleSave(report.id)} style={{ padding: '0.4375rem 1.125rem', backgroundColor: saved[report.id] ? '#059669' : '#1a5fb4', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit', flexShrink: 0, transition: 'background-color 0.2s' }}>
                {saved[report.id] ? '✓ Saved' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ────────── Record Maintenance Details ────────── */

type MaintenanceForm = Omit<ApiMaintenanceRecord, 'estimatedCost'> & { estimatedCost: string | number; saved: boolean }

function RecordMaintenanceTab() {
  const [records, setRecords] = useState<MaintenanceForm[]>([])
  const [staffUsers, setStaffUsers] = useState<SystemUser[]>([])
  useEffect(() => { void getMaintenanceRecords().then((items) => setRecords(items.map((item) => ({ ...item, estimatedCost: item.estimatedCost ?? '', saved: item.estimatedCost !== null || !!item.materials || !!item.notes || !!item.assignedToUserId || !!item.assignedTo })))).catch(() => setRecords([])) }, [])
  useEffect(() => { void getUsers('staff').then(setStaffUsers).catch(() => setStaffUsers([])) }, [])

  const update = (reportId: string, field: keyof MaintenanceForm, value: string) => {
    setRecords((prev) => prev.map((rec) => rec.reportId === reportId ? { ...rec, [field]: value, saved: false } : rec))
  }

  const save = async (reportId: string) => {
    const record = records.find((item) => item.reportId === reportId)
    if (!record) return
    try {
      const saved = await saveMaintenanceRecord(reportId, { assignedToUserId: record.assignedToUserId || null, estimatedCost: record.estimatedCost, materials: record.materials, notes: record.notes })
      setRecords((prev) => prev.map((item) => item.reportId === reportId ? { ...item, ...saved, estimatedCost: saved.estimatedCost ?? '', saved: true } : item))
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not save maintenance record') }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={pageTitle}>Record Maintenance Details</h1>
        <p style={pageSubtitle}>Assign maintenance personnel, record estimated costs, and list required materials</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 740 }}>
        {records.map((rec) => (
          <div key={rec.reportId} style={{ ...card, border: rec.saved ? '1px solid #a7f3d0' : '1px solid #d1dce8' }}>
            {/* Report header */}
            <div style={{ marginBottom: '1.125rem', paddingBottom: '1rem', borderBottom: '1px solid #e8eef7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', fontWeight: 600, color: '#8eadd4' }}>{rec.reportId}</span>
                {rec.saved && <span style={{ padding: '0.2rem 0.625rem', borderRadius: 100, backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.75rem', fontWeight: 600 }}>✓ Saved</span>}
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '0.2rem' }}>{rec.reportType}</div>
              <div style={{ fontSize: '0.8125rem', color: '#5a7199' }}>📍 {rec.location}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Assign Maintenance Personnel */}
              <div>
                <label style={labelStyle}>Assign Maintenance Personnel</label>
                <select value={rec.assignedToUserId ?? ''} onChange={(e) => update(rec.reportId, 'assignedToUserId', e.target.value)} style={inputStyle}>
                  <option value="">— Unassigned —</option>
                  {staffUsers.filter((person) => person.status === 'active').map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </div>

              {/* Estimated Maintenance Cost */}
              <div>
                <label style={labelStyle}>Record Estimated Maintenance Cost</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8eadd4', fontSize: '0.875rem', fontWeight: 600 }}>₱</span>
                  <input
                    type="number"
                    min="0"
                    value={rec.estimatedCost}
                    onChange={(e) => update(rec.reportId, 'estimatedCost', e.target.value)}
                    placeholder="0.00"
                    style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                  />
                </div>
              </div>

              {/* Materials Needed */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Record Materials Needed</label>
                <textarea
                  value={rec.materials}
                  onChange={(e) => update(rec.reportId, 'materials', e.target.value)}
                  placeholder="e.g., 3 bags cement, 2m PVC pipe Ø150mm, gravel (1 cu.m.), desilting tools…"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Internal notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Internal Notes</label>
                <input
                  value={rec.notes}
                  onChange={(e) => update(rec.reportId, 'notes', e.target.value)}
                  placeholder="Additional context for the maintenance team…"
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              onClick={() => void save(rec.reportId)}
              style={{ marginTop: '1rem', padding: '0.5625rem 1.5rem', backgroundColor: rec.saved ? '#059669' : '#f59e0b', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit', transition: 'background-color 0.2s' }}
            >
              {rec.saved ? '✓ Record Saved' : 'Save Maintenance Record'}
            </button>
            {rec.saved && <button type="button" onClick={async () => { try { await deleteMaintenanceRecord(rec.reportId); setRecords((prev) => prev.map((item) => item.reportId === rec.reportId ? { ...item, assignedTo: '', estimatedCost: '', materials: '', notes: '', saved: false } : item)) } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not delete maintenance record') } }} style={{ marginLeft: '0.75rem', color: '#b91c1c', background: 'transparent', border: 'none', cursor: 'pointer' }}>Delete saved record</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
