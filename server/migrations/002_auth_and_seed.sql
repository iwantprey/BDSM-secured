
ALTER TABLE system_users
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER email,
  ADD COLUMN address VARCHAR(255) NULL AFTER barangay,
  ADD COLUMN phone VARCHAR(40) NULL AFTER address;

ALTER TABLE drainage_reports
  ADD COLUMN resident_email VARCHAR(254) NULL;

ALTER TABLE inspections
  ADD COLUMN inspection_date DATE NULL,
  ADD COLUMN inspection_time TIME NULL,
  ADD COLUMN inspector VARCHAR(120) NULL;

ALTER TABLE inspections
  MODIFY COLUMN inspection_date_time DATETIME NULL;

ALTER TABLE inspections
  MODIFY COLUMN report_type VARCHAR(100) NULL,
  MODIFY COLUMN location VARCHAR(255) NULL;

UPDATE inspections
SET inspection_date = COALESCE(inspection_date, DATE(inspection_date_time)),
    inspection_time = COALESCE(inspection_time, TIME(inspection_date_time));

UPDATE inspections i
JOIN system_users u ON u.id = i.inspector_id
SET i.inspector = COALESCE(NULLIF(i.inspector, ''), u.name);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
  ('system_name', 'Barangay DMMS'),
  ('barangay_name', 'Barangay San Antonio'),
  ('contact_email', 'admin@brgy.gov.ph'),
  ('report_prefix', 'RPT'),
  ('notifications_enabled', 'true');

INSERT IGNORE INTO system_users (id, name, email, role, barangay, address, phone, status, joined_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Admin Reyes', 'admin@brgy.gov.ph', 'admin', 'Barangay Central', NULL, NULL, 'active', '2023-01-10'),
  ('00000000-0000-4000-8000-000000000002', 'Maria Santos', 'msantos@brgy.gov.ph', 'staff', 'Brgy. San Antonio', NULL, NULL, 'active', '2023-03-15'),
  ('00000000-0000-4000-8000-000000000003', 'Roberto Cruz', 'rcruz@brgy.gov.ph', 'staff', 'Brgy. San Jose', NULL, NULL, 'active', '2023-05-20'),
  ('00000000-0000-4000-8000-000000000004', 'Juan dela Cruz', 'jdelacruz@email.com', 'resident', 'Brgy. San Antonio', '123 Rizal Street, Brgy. San Antonio', '+63 917 123 4567', 'active', '2023-08-01'),
  ('00000000-0000-4000-8000-000000000005', 'Ana Reyes', 'areyes@email.com', 'resident', 'Brgy. San Jose', NULL, NULL, 'active', '2023-09-12'),
  ('00000000-0000-4000-8000-000000000006', 'Pedro Garcia', 'pgarcia@email.com', 'resident', 'Brgy. Maliwanag', NULL, NULL, 'inactive', '2024-01-05'),
  ('00000000-0000-4000-8000-000000000007', 'Lourdes Mendoza', 'lmendoza@email.com', 'resident', 'Brgy. San Antonio', NULL, NULL, 'active', '2024-02-18');

INSERT IGNORE INTO drainage_reports (id, resident_id, resident_name, resident_email, location, type, description, priority, status, assigned_to, submitted_at, updated_at) VALUES
  ('RPT-2024-001', (SELECT id FROM system_users WHERE email = 'jdelacruz@email.com'), 'Juan dela Cruz', 'jdelacruz@email.com', '123 Rizal Street, Brgy. San Antonio', 'Clogged Drain', 'Main drainage canal near the public market is severely clogged with debris and garbage, causing flooding during heavy rains.', 'high', 'verified', (SELECT id FROM system_users WHERE email = 'msantos@brgy.gov.ph'), '2024-07-15', '2024-07-16'),
  ('RPT-2024-002', (SELECT id FROM system_users WHERE email = 'areyes@email.com'), 'Ana Reyes', 'areyes@email.com', '45 Mabini Avenue, Brgy. San Jose', 'Flooded Area', 'Sidewalk floods every rain due to blocked drainage opening. Water reaches ankle level and poses hazard to pedestrians and children.', 'high', 'in-progress', (SELECT id FROM system_users WHERE email = 'rcruz@brgy.gov.ph'), '2024-07-18', '2024-07-19'),
  ('RPT-2024-003', (SELECT id FROM system_users WHERE email = 'pgarcia@email.com'), 'Pedro Garcia', 'pgarcia@email.com', '78 Bonifacio Road, Brgy. Maliwanag', 'Broken Drainage Cover', 'Steel grate covering the drainage canal is broken and missing sections, creating a safety hazard for pedestrians and vehicles.', 'medium', 'pending', NULL, '2024-07-20', '2024-07-20'),
  ('RPT-2024-004', (SELECT id FROM system_users WHERE email = 'lmendoza@email.com'), 'Lourdes Mendoza', 'lmendoza@email.com', '15 Luna Street, Brgy. San Antonio', 'Overflowing Canal', 'The secondary canal overflows during moderate rain, flooding nearby residential areas. Needs immediate desilting and debris clearing.', 'high', 'pending', NULL, '2024-07-21', '2024-07-21'),
  ('RPT-2024-005', NULL, 'Ricardo Flores', 'rflores@email.com', '200 Aguinaldo St, Brgy. Bagong Pag-asa', 'Damaged Culvert', 'Culvert under the road has developed a significant crack. Water is seeping through and causing road surface damage.', 'medium', 'resolved', (SELECT id FROM system_users WHERE email = 'msantos@brgy.gov.ph'), '2024-07-10', '2024-07-14'),
  ('RPT-2024-006', NULL, 'Cristina Bautista', 'cbautista@email.com', '9 Del Pilar St, Brgy. San Jose', 'Clogged Drain', 'Drainage inlet in front of the school is completely blocked by leaves and garbage. Standing water creates dengue mosquito breeding grounds.', 'medium', 'rejected', NULL, '2024-07-12', '2024-07-13'),
  ('RPT-2024-007', NULL, 'Jose Navarro', 'jnavarro@email.com', '33 Quezon Blvd, Brgy. Maliwanag', 'Flooded Area', 'Entire street floods during heavy rain due to undersized drainage system. Multiple households and businesses are affected.', 'high', 'verified', (SELECT id FROM system_users WHERE email = 'rcruz@brgy.gov.ph'), '2024-07-22', '2024-07-23');

INSERT IGNORE INTO inspections (id, report_id, report_type, location, inspection_date_time, inspector_id, inspection_date, inspection_time, inspector, notes, status) VALUES
  ('INS-001', 'RPT-2024-001', 'Clogged Drain', '123 Rizal Street, Brgy. San Antonio', '2024-07-18 09:00:00', '00000000-0000-4000-8000-000000000002', '2024-07-18', '09:00:00', 'Maria Santos', 'Bring desilting equipment.', 'completed'),
  ('INS-002', 'RPT-2024-004', 'Overflowing Canal', '15 Luna Street, Brgy. San Antonio', '2024-07-25 08:00:00', '00000000-0000-4000-8000-000000000003', '2024-07-25', '08:00:00', 'Roberto Cruz', 'Check upstream canal junction.', 'scheduled'),
  ('INS-003', 'RPT-2024-007', 'Flooded Area', '33 Quezon Blvd, Brgy. Maliwanag', '2024-07-26 14:00:00', '00000000-0000-4000-8000-000000000002', '2024-07-26', '14:00:00', 'Maria Santos', '', 'scheduled');

INSERT IGNORE INTO maintenance_records (report_id, assigned_to) VALUES
  ('RPT-2024-001', (SELECT id FROM system_users WHERE email = 'msantos@brgy.gov.ph')),
  ('RPT-2024-002', (SELECT id FROM system_users WHERE email = 'rcruz@brgy.gov.ph')),
  ('RPT-2024-007', (SELECT id FROM system_users WHERE email = 'rcruz@brgy.gov.ph'));

-- Keep all seeded user and report locations tied to the admin-configured barangay.
UPDATE system_users u
JOIN system_settings s ON s.setting_key = 'barangay_name'
SET u.barangay = s.setting_value;

UPDATE system_users
SET address = CASE email
  WHEN 'jdelacruz@email.com' THEN '123 Rizal Street'
  WHEN 'areyes@email.com' THEN '45 Mabini Avenue'
  WHEN 'pgarcia@email.com' THEN '78 Bonifacio Road'
  WHEN 'lmendoza@email.com' THEN '15 Luna Street'
  ELSE address
END
WHERE email IN ('jdelacruz@email.com', 'areyes@email.com', 'pgarcia@email.com', 'lmendoza@email.com');

UPDATE drainage_reports r
JOIN system_settings s ON s.setting_key = 'barangay_name'
SET r.location = CONCAT(
  CASE RIGHT(r.id, 3)
    WHEN '001' THEN '123 Rizal Street'
    WHEN '002' THEN '45 Mabini Avenue'
    WHEN '003' THEN '78 Bonifacio Road'
    WHEN '004' THEN '15 Luna Street'
    WHEN '005' THEN '200 Aguinaldo Street'
    WHEN '006' THEN '9 Del Pilar Street'
    WHEN '007' THEN '33 Quezon Boulevard'
  END,
  ', ', s.setting_value
)
WHERE r.id REGEXP '^RPT-2024-00[1-7]$';

UPDATE inspections i
JOIN drainage_reports r ON r.id = i.report_id
SET i.location = r.location
WHERE r.id REGEXP '^RPT-2024-00[1-7]$';
