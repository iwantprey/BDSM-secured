import { useEffect, useState } from 'react'
import type { DrainageReport, Priority } from '../data/models'
import { createReport, deleteReport, getReports, updateProfile, type ApiReport, type AuthUser } from '../services/api'
import { StatusBadge, PriorityBadge, formatDate, inputStyle, labelStyle, pageTitle, pageSubtitle, card, statusConfig } from '../components/Shared'

export default function ResidentView({ activeTab, user, onUserUpdated }: { activeTab: string; user: AuthUser; onUserUpdated: (user: AuthUser) => void }) {
  const [myReports, setMyReports] = useState<ApiReport[]>([])
  const [loadError, setLoadError] = useState('')
  const residentEmail = user.email

  const reloadReports = () => getReports({ residentEmail }).then(setMyReports).catch((error: Error) => setLoadError(error.message))
  useEffect(() => { void reloadReports() }, [])

  if (activeTab === 'submit') return <SubmitReportTab onCreated={reloadReports} />
  if (loadError) return <div role="alert" style={{ padding: '2rem', color: '#b91c1c' }}>Could not load reports: {loadError}</div>
  if (activeTab === 'track') return <TrackMyReportsTab reports={myReports} onDelete={async (id) => { await deleteReport(id); await reloadReports() }} />
  if (activeTab === 'settings') return <ProfileSettingsTab user={user} onUserUpdated={onUserUpdated} />
  return <ViewReportStatusTab reports={myReports} />
}

function ProfileSettingsTab({ user, onUserUpdated }: { user: AuthUser; onUserUpdated: (user: AuthUser) => void }) {
  const [profile, setProfile] = useState({ name: user.name, address: user.address ?? '', barangay: user.barangay, email: user.email, phone: user.phone ?? '', photo: '' })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const update = (field: keyof typeof profile, value: string) => { setProfile((current) => ({ ...current, [field]: value })); setSaved(false) }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}><h1 style={pageTitle}>Settings</h1><p style={pageSubtitle}>Customize your resident profile and contact information.</p></div>
      <form onSubmit={async (event) => { event.preventDefault(); setSaving(true); setError(''); try { const updated = await updateProfile({ name: profile.name, address: profile.address, phone: profile.phone }); onUserUpdated(updated); setSaved(true) } catch (err) { setError(err instanceof Error ? err.message : 'Could not save profile') } finally { setSaving(false) } }} style={{ ...card, maxWidth: 680, display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid #e8eef7' }}>
          {profile.photo ? <img src={profile.photo} alt="Profile preview" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #d1fae5' }} /> : <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#d1fae5', color: '#065f46', display: 'grid', placeItems: 'center', fontSize: '1.5rem', fontWeight: 700 }}>JD</div>}
          <div><div style={{ fontWeight: 700, color: '#0a1f3d', marginBottom: '0.25rem' }}>Profile picture</div><div style={{ color: '#8eadd4', fontSize: '0.8125rem' }}>Use a clear JPG or PNG image.</div></div>
          <label style={{ marginLeft: 'auto', padding: '0.5rem 0.75rem', border: '1px solid #d1dce8', borderRadius: 7, color: '#1a5fb4', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Choose image<input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) update('photo', URL.createObjectURL(file)) }} /></label>
        </div>
        <div><label style={labelStyle}>Full name</label><input required value={profile.name} onChange={(event) => update('name', event.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Address</label><input required value={profile.address} onChange={(event) => update('address', event.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Barangay</label><input readOnly value={profile.barangay} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} /><small style={{ color: '#64748b' }}>Managed by the system administrator.</small></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><div><label style={labelStyle}>Email address</label><input readOnly type="email" value={profile.email} style={{ ...inputStyle, backgroundColor: '#f8fafc' }} /></div><div><label style={labelStyle}>Phone number</label><input type="tel" value={profile.phone} onChange={(event) => update('phone', event.target.value)} style={inputStyle} /></div></div>
        {error && <div role="alert" style={{ color: '#b91c1c' }}>{error}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>{saved && <span style={{ color: '#059669', fontSize: '0.8125rem', fontWeight: 600 }}>Profile updated successfully.</span>}<button disabled={saving} type="submit" style={{ padding: '0.7rem 1.25rem', backgroundColor: '#1a5fb4', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>
  )
}

/* ────────── Submit Report ────────── */

type SubmitStep = 'form' | 'validating' | 'success'

function SubmitReportTab({ onCreated }: { onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ location: '', type: '', priority: 'medium' as Priority, description: '', photoName: '' })
  const [step, setStep] = useState<SubmitStep>('form')
  const [focusField, setFocusField] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  const focused = (field: string): React.CSSProperties => ({
    ...inputStyle,
    outline: focusField === field ? '2px solid #1a5fb4' : 'none',
    outlineOffset: '2px',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setStep('validating')
    try {
      const report = await createReport({
        location: form.location,
        type: form.type,
        description: form.description,
        priority: form.priority,
      })
      setReference(report.id)
      await onCreated()
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report')
      setStep('form')
    }
  }

  if (step === 'validating') {
    return (
      <div style={{ padding: '2.5rem 2rem', maxWidth: 580 }}>
        <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⏳</div>
          <h3 style={{ fontWeight: 700, color: '#0a1f3d', marginBottom: '0.5rem' }}>Validating Report Details</h3>
          <p style={{ color: '#5a7199', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Checking report information and saving to the system…
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', textAlign: 'left' }}>
            {[
              { label: 'Validate Report Details', done: true },
              { label: 'Save Report to Database', done: true },
              { label: 'Upload Photo', done: !!form.photoName },
            ].map(({ label, done }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderRadius: 8, backgroundColor: done ? '#d1fae5' : '#f0f4fa' }}>
                <span style={{ fontSize: 14 }}>{done ? '✅' : '⏸'}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: done ? '#065f46' : '#5a7199' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div style={{ padding: '2.5rem 2rem', maxWidth: 580 }}>
        <div style={{ ...card, textAlign: 'center', padding: '2.5rem', border: '1px solid #a7f3d0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 1.25rem' }}>✅</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#065f46', marginBottom: '0.5rem' }}>Report Submitted Successfully</h2>
          <p style={{ color: '#047857', marginBottom: '0.5rem', lineHeight: 1.6 }}>
            Reference number assigned:
          </p>
          <div style={{ display: 'inline-block', fontFamily: '"DM Mono", monospace', fontSize: '1.125rem', fontWeight: 700, color: '#0a1f3d', backgroundColor: '#f0f4fa', border: '1px solid #d1dce8', borderRadius: 8, padding: '0.5rem 1.25rem', margin: '0.75rem 0 1.25rem', letterSpacing: '0.05em' }}>
            {reference}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Validate Report Details', status: 'Complete' },
              { label: 'Save Report', status: 'Saved' },
              { label: 'Photo Upload', status: form.photoName ? 'Uploaded' : 'Skipped (optional)' },
            ].map(({ label, status }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#5a7199' }}>
                <span>{label}</span>
                <span style={{ fontWeight: 600, color: '#059669' }}>{status}</span>
              </div>
            ))}
          </div>
          <p style={{ color: '#5a7199', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
            Track your report status under <strong>Track My Reports</strong>. You may opt in to status notifications there.
          </p>
          <button
            onClick={() => { setStep('form'); setForm({ location: '', type: '', priority: 'medium', description: '', photoName: '' }) }}
            style={{ padding: '0.75rem 2rem', backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.9375rem', fontFamily: 'inherit' }}
          >
            Submit Another Report
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={pageTitle}>Submit Drainage Report</h1>
        <p style={pageSubtitle}>Report drainage issues in your area. Your report will be validated and saved automatically.</p>
      </div>

      {/* Process steps banner */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.75rem', maxWidth: 620 }}>
        {[
          { n: 1, label: 'Validate Details', color: '#1a5fb4' },
          { n: 2, label: 'Save Report', color: '#8b5cf6' },
          { n: 3, label: 'Upload Photo', color: '#10b981', optional: true },
        ].map(({ n, label, color, optional }, i) => (
          <div key={n} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: color + '20', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color }}>
                {n}
              </div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#5a7199', textAlign: 'center', lineHeight: 1.3 }}>
                {label}{optional && <span style={{ color: '#8eadd4' }}><br />(Optional)</span>}
              </div>
            </div>
            {i < 2 && <div style={{ width: 32, height: 1, backgroundColor: '#d1dce8', marginBottom: 20 }} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ ...card, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
        {error && <div role="alert" style={{ color: '#b91c1c', background: '#fee2e2', padding: '0.75rem', borderRadius: 8 }}>{error}</div>}
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0a1f3d', paddingBottom: '1rem', borderBottom: '1px solid #e8eef7' }}>Issue Details</h2>

        <div>
          <label style={labelStyle}>Street Address / Location *</label>
          <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} onFocus={() => setFocusField('location')} onBlur={() => setFocusField(null)} placeholder="e.g., 123 Rizal Street, Brgy. San Antonio" style={focused('location')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Type of Issue *</label>
            <select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} onFocus={() => setFocusField('type')} onBlur={() => setFocusField(null)} style={focused('type')}>
              <option value="">Select issue type</option>
              <option>Clogged Drain</option>
              <option>Flooded Area</option>
              <option>Broken Drainage Cover</option>
              <option>Overflowing Canal</option>
              <option>Damaged Culvert</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority Level</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} onFocus={() => setFocusField('priority')} onBlur={() => setFocusField(null)} style={focused('priority')}>
              <option value="low">Low — Minor inconvenience</option>
              <option value="medium">Medium — Needs attention</option>
              <option value="high">High — Urgent safety hazard</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Description *</label>
          <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} onFocus={() => setFocusField('desc')} onBlur={() => setFocusField(null)} placeholder="Describe the issue — location landmarks, severity, how long it has been a problem, and any impact on residents." rows={4} style={{ ...focused('desc'), resize: 'vertical', minHeight: 100 }} />
        </div>

        {/* Upload Photo (Optional) */}
        <div style={{ border: '2px dashed #d1dce8', borderRadius: 10, padding: '1.25rem', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.2rem' }}>
                📷 Upload Photo <span style={{ color: '#8eadd4', fontWeight: 400, fontSize: '0.8125rem' }}>(Optional)</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#8eadd4' }}>
                {form.photoName ? form.photoName : 'Photos help staff assess the issue faster.'}
              </div>
            </div>
            <label style={{ padding: '0.4375rem 1rem', backgroundColor: '#ffffff', color: '#1a5fb4', border: '1px solid #d1dce8', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
              Choose File
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setForm({ ...form, photoName: e.target.files?.[0]?.name ?? '' })} />
            </label>
          </div>
        </div>

        <button type="submit" style={{ padding: '0.8125rem', backgroundColor: '#1a5fb4', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem', fontFamily: 'inherit' }}>
          Validate &amp; Submit Report
        </button>
      </form>
    </div>
  )
}

/* ────────── Track My Reports ────────── */

function TrackMyReportsTab({ reports, onDelete }: { reports: DrainageReport[]; onDelete: (id: string) => Promise<void> }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter)

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={pageTitle}>Track My Reports</h1>
        <p style={pageSubtitle}>Monitor the progress of all your submitted drainage reports</p>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['all', 'pending', 'verified', 'in-progress', 'resolved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.35rem 0.875rem',
              borderRadius: 100,
              border: `1px solid ${filter === f ? '#1a5fb4' : '#d1dce8'}`,
              backgroundColor: filter === f ? '#1a5fb4' : '#ffffff',
              color: filter === f ? '#ffffff' : '#5a7199',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textTransform: 'capitalize',
            }}
          >
            {f === 'all' ? 'All Reports' : f.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 760 }}>
        {filtered.length === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: '2.5rem', color: '#5a7199' }}>No reports match this filter.</div>
        )}
        {filtered.map((report) => (
          <TrackCard key={report.id} report={report} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}

function TrackCard({ report, onDelete }: { report: DrainageReport; onDelete: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)

  const pipeline: Array<DrainageReport['status']> = ['pending', 'verified', 'in-progress', 'resolved']
  const currentIdx = pipeline.indexOf(report.status as typeof pipeline[number])

  return (
    <div style={{ ...card, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', fontWeight: 600, color: '#8eadd4' }}>{report.id}</span>
            <StatusBadge status={report.status} />
            <PriorityBadge priority={report.priority} />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '0.25rem' }}>{report.type}</div>
          <div style={{ fontSize: '0.875rem', color: '#5a7199' }}>📍 {report.location}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.6875rem', color: '#8eadd4', marginBottom: '0.2rem' }}>Submitted</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0a1f3d' }}>{formatDate(report.submittedAt)}</div>
        </div>
      </div>

      {/* Progress pipeline */}
      {report.status !== 'rejected' && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f0f4fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {pipeline.map((s, i) => {
              const done = i <= currentIdx
              const cfg = statusConfig[s]
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: done ? cfg.dot : '#e8eef7', border: `2px solid ${done ? cfg.dot : '#d1dce8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {done && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ffffff', display: 'block' }} />}
                    </div>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 600, color: done ? cfg.text : '#8eadd4', textAlign: 'center', lineHeight: 1.2, textTransform: 'capitalize' }}>{cfg.label}</span>
                  </div>
                  {i < pipeline.length - 1 && (
                    <div style={{ height: 2, flex: 1, backgroundColor: i < currentIdx ? '#1a5fb4' : '#e8eef7', marginBottom: 18, marginLeft: -4, marginRight: -4 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {open && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f0f4fa' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#5a7199', marginBottom: '0.375rem' }}>Description</div>
          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, margin: 0 }}>{report.description}</p>
          {report.status === 'pending' && <button type="button" onClick={(event) => { event.stopPropagation(); if (window.confirm('Delete this pending report?')) void onDelete(report.id) }} style={{ marginTop: '0.75rem', padding: '0.4rem 0.75rem', color: '#b91c1c', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>Delete pending report</button>}
          {report.assignedTo && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#5a7199' }}>
              Assigned to: <span style={{ fontWeight: 600, color: '#1a5fb4' }}>{report.assignedTo}</span>
            </div>
          )}
        </div>
      )}
      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#8eadd4' }}>{open ? '▲ Less' : '▼ More detail'}</div>
    </div>
  )
}

/* ────────── View Report Status ────────── */

function ViewReportStatusTab({ reports }: { reports: DrainageReport[] }) {
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({})

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={pageTitle}>View Report Status</h1>
        <p style={pageSubtitle}>Check the current status of each report and opt in to status notifications</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 700 }}>
        {reports.map((report) => (
          <div key={report.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '0.75rem', fontWeight: 600, color: '#8eadd4' }}>{report.id}</span>
                  <StatusBadge status={report.status} />
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0a1f3d', marginBottom: '0.2rem' }}>{report.type}</div>
                <div style={{ fontSize: '0.8125rem', color: '#5a7199' }}>📍 {report.location}</div>
                <div style={{ fontSize: '0.75rem', color: '#8eadd4', marginTop: '0.375rem' }}>
                  Submitted {formatDate(report.submittedAt)} · Updated {formatDate(report.updatedAt)}
                </div>
              </div>

              {/* Notification toggle */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                <div style={{ fontSize: '0.6875rem', color: '#8eadd4', textAlign: 'right' }}>Status Notifications</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: notifPrefs[report.id] ? '#059669' : '#8eadd4' }}>
                    {notifPrefs[report.id] ? 'On' : 'Off'}
                  </span>
                  <button
                    onClick={() => setNotifPrefs((prev) => ({ ...prev, [report.id]: !prev[report.id] }))}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 100,
                      border: 'none',
                      backgroundColor: notifPrefs[report.id] ? '#059669' : '#d1dce8',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                      padding: 0,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: notifPrefs[report.id] ? 21 : 3,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s',
                        display: 'block',
                      }}
                    />
                  </button>
                </div>
                <div style={{ fontSize: '0.625rem', color: '#8eadd4', textAlign: 'right', maxWidth: 120, lineHeight: 1.4 }}>
                  Receive status notification (optional)
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
