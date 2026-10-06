
INSERT IGNORE INTO system_users (id, name, email, role, barangay, status, joined_at) VALUES
  ('00000000-0000-4000-8000-000000000008', 'Ricardo Flores', 'rflores@email.com', 'resident', 'Brgy. Bagong Pag-asa', 'active', '2026-03-12'),
  ('00000000-0000-4000-8000-000000000009', 'Cristina Bautista', 'cbautista@email.com', 'resident', 'Brgy. San Jose', 'active', '2026-03-19'),
  ('00000000-0000-4000-8000-000000000010', 'Jose Navarro', 'jnavarro@email.com', 'resident', 'Brgy. Maliwanag', 'active', '2026-04-02');

UPDATE drainage_reports r
JOIN system_users u ON LOWER(u.email) = LOWER(r.resident_email)
SET r.resident_id = u.id
WHERE r.resident_id IS NULL;

INSERT IGNORE INTO drainage_reports (id, resident_id, resident_name, resident_email, location, type, description, priority, status, assigned_to, submitted_at, updated_at) VALUES
  ('RPT-2026-001', (SELECT id FROM system_users WHERE email = 'jdelacruz@email.com'), 'Juan dela Cruz', 'jdelacruz@email.com', '123 Rizal Street, Brgy. San Antonio', 'Clogged Drain', 'Main drainage canal near the public market is severely clogged with debris and garbage, causing flooding during heavy rains.', 'high', 'verified', (SELECT id FROM system_users WHERE email = 'msantos@brgy.gov.ph'), '2026-07-15', '2026-07-16'),
  ('RPT-2026-002', (SELECT id FROM system_users WHERE email = 'areyes@email.com'), 'Ana Reyes', 'areyes@email.com', '45 Mabini Avenue, Brgy. San Jose', 'Flooded Area', 'Sidewalk floods every rain due to blocked drainage opening. Water reaches ankle level and poses hazard to pedestrians and children.', 'high', 'in-progress', (SELECT id FROM system_users WHERE email = 'rcruz@brgy.gov.ph'), '2026-07-18', '2026-07-19'),
  ('RPT-2026-003', (SELECT id FROM system_users WHERE email = 'pgarcia@email.com'), 'Pedro Garcia', 'pgarcia@email.com', '78 Bonifacio Road, Brgy. Maliwanag', 'Broken Drainage Cover', 'Steel grate covering the drainage canal is broken and missing sections, creating a safety hazard for pedestrians and vehicles.', 'medium', 'pending', NULL, '2026-07-20', '2026-07-20'),
  ('RPT-2026-004', (SELECT id FROM system_users WHERE email = 'lmendoza@email.com'), 'Lourdes Mendoza', 'lmendoza@email.com', '15 Luna Street, Brgy. San Antonio', 'Overflowing Canal', 'The secondary canal overflows during moderate rain, flooding nearby residential areas. Needs immediate desilting and debris clearing.', 'high', 'pending', NULL, '2026-07-21', '2026-07-21'),
  ('RPT-2026-005', (SELECT id FROM system_users WHERE email = 'rflores@email.com'), 'Ricardo Flores', 'rflores@email.com', '200 Aguinaldo St, Brgy. Bagong Pag-asa', 'Damaged Culvert', 'Culvert under the road has developed a significant crack. Water is seeping through and causing road surface damage.', 'medium', 'resolved', (SELECT id FROM system_users WHERE email = 'msantos@brgy.gov.ph'), '2026-07-10', '2026-07-14'),
  ('RPT-2026-006', (SELECT id FROM system_users WHERE email = 'cbautista@email.com'), 'Cristina Bautista', 'cbautista@email.com', '9 Del Pilar St, Brgy. San Jose', 'Clogged Drain', 'Drainage inlet in front of the school is completely blocked by leaves and garbage. Standing water creates dengue mosquito breeding grounds.', 'medium', 'rejected', NULL, '2026-07-12', '2026-07-13'),
  ('RPT-2026-007', (SELECT id FROM system_users WHERE email = 'jnavarro@email.com'), 'Jose Navarro', 'jnavarro@email.com', '33 Quezon Blvd, Brgy. Maliwanag', 'Flooded Area', 'Entire street floods during heavy rain due to undersized drainage system. Multiple households and businesses are affected.', 'high', 'verified', (SELECT id FROM system_users WHERE email = 'rcruz@brgy.gov.ph'), '2026-07-22', '2026-07-23');

-- Older deployments may already contain the report IDs but have NULL owners.
UPDATE drainage_reports r
JOIN system_users u ON LOWER(u.email) = LOWER(r.resident_email)
SET r.resident_id = u.id
WHERE r.resident_id IS NULL;

INSERT IGNORE INTO inspections (id, report_id, report_type, location, inspection_date_time, inspector_id, inspection_date, inspection_time, inspector, notes, status)
SELECT seed.id, report.id, seed.report_type, seed.location, seed.inspection_date_time, inspector.id, seed.inspection_date, seed.inspection_time, inspector.name, seed.notes, seed.status
FROM (
  SELECT 'INS-001' AS id, 'RPT-2026-001' AS report_id, 'Clogged Drain' AS report_type, '123 Rizal Street, Brgy. San Antonio' AS location, '2026-07-18 09:00:00' AS inspection_date_time, 'msantos@brgy.gov.ph' AS inspector_email, '2026-07-18' AS inspection_date, '09:00:00' AS inspection_time, 'Bring desilting equipment.' AS notes, 'completed' AS status
  UNION ALL SELECT 'INS-002', 'RPT-2026-004', 'Overflowing Canal', '15 Luna Street, Brgy. San Antonio', '2026-07-25 08:00:00', 'rcruz@brgy.gov.ph', '2026-07-25', '08:00:00', 'Check upstream canal junction.', 'scheduled'
  UNION ALL SELECT 'INS-003', 'RPT-2026-007', 'Flooded Area', '33 Quezon Blvd, Brgy. Maliwanag', '2026-07-26 14:00:00', 'msantos@brgy.gov.ph', '2026-07-26', '14:00:00', '', 'scheduled'
) seed
JOIN drainage_reports report ON report.id = seed.report_id
JOIN system_users inspector ON inspector.email = seed.inspector_email;

INSERT IGNORE INTO maintenance_records (report_id, assigned_to)
SELECT report.id, staff.id
FROM (
  SELECT 'RPT-2026-001' AS report_id, 'msantos@brgy.gov.ph' AS staff_email
  UNION ALL SELECT 'RPT-2026-002', 'rcruz@brgy.gov.ph'
  UNION ALL SELECT 'RPT-2026-007', 'rcruz@brgy.gov.ph'
) seed
JOIN drainage_reports report ON report.id = seed.report_id
JOIN system_users staff ON staff.email = seed.staff_email;
