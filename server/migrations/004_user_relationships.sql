
ALTER TABLE drainage_reports
  ADD COLUMN resident_user_id VARCHAR(50) NULL,
  ADD COLUMN assigned_to_user_id VARCHAR(50) NULL,
  MODIFY COLUMN resident_name VARCHAR(120) NULL,
  MODIFY COLUMN resident_email VARCHAR(254) NULL;

UPDATE drainage_reports r
JOIN system_users u ON u.id = r.resident_id
SET r.resident_user_id = u.id
WHERE r.resident_user_id IS NULL;

UPDATE drainage_reports r
JOIN system_users u ON u.id = r.assigned_to
SET r.assigned_to_user_id = u.id
WHERE r.assigned_to_user_id IS NULL;

UPDATE drainage_reports r
JOIN system_users u ON LOWER(u.email) = LOWER(r.resident_email)
SET r.resident_user_id = u.id
WHERE r.resident_user_id IS NULL;

UPDATE drainage_reports r
JOIN (
  SELECT name, MIN(id) AS id FROM system_users WHERE role IN ('staff', 'admin') GROUP BY name HAVING COUNT(*) = 1
) u ON u.name = r.assigned_to
SET r.assigned_to_user_id = u.id
WHERE r.assigned_to_user_id IS NULL;

ALTER TABLE inspections
  ADD COLUMN inspector_user_id VARCHAR(50) NULL,
  MODIFY COLUMN inspector VARCHAR(120) NULL;

UPDATE inspections i
JOIN system_users u ON u.id = i.inspector_id
SET i.inspector_user_id = u.id
WHERE i.inspector_user_id IS NULL;

UPDATE inspections i
JOIN (
  SELECT name, MIN(id) AS id FROM system_users WHERE role IN ('staff', 'admin') GROUP BY name HAVING COUNT(*) = 1
) u ON u.name = i.inspector
SET i.inspector_user_id = u.id
WHERE i.inspector_user_id IS NULL;

ALTER TABLE maintenance_records
  ADD COLUMN assigned_to_user_id VARCHAR(50) NULL;

UPDATE maintenance_records m
JOIN system_users u ON u.id = m.assigned_to
SET m.assigned_to_user_id = u.id
WHERE m.assigned_to_user_id IS NULL;

UPDATE maintenance_records m
JOIN (
  SELECT name, MIN(id) AS id FROM system_users WHERE role IN ('staff', 'admin') GROUP BY name HAVING COUNT(*) = 1
) u ON u.name = m.assigned_to
SET m.assigned_to_user_id = u.id
WHERE m.assigned_to_user_id IS NULL;

ALTER TABLE drainage_reports
  ADD CONSTRAINT fk_reports_resident_user FOREIGN KEY (resident_user_id) REFERENCES system_users(id) ON DELETE RESTRICT;

ALTER TABLE drainage_reports
  ADD CONSTRAINT fk_reports_assignee_user FOREIGN KEY (assigned_to_user_id) REFERENCES system_users(id) ON DELETE SET NULL;

ALTER TABLE inspections
  ADD CONSTRAINT fk_inspections_inspector_user FOREIGN KEY (inspector_user_id) REFERENCES system_users(id) ON DELETE SET NULL;

ALTER TABLE maintenance_records
  ADD CONSTRAINT fk_maintenance_assignee_user FOREIGN KEY (assigned_to_user_id) REFERENCES system_users(id) ON DELETE SET NULL;
