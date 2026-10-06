
UPDATE drainage_reports
SET resident_id = resident_user_id
WHERE resident_id IS NULL AND resident_user_id IS NOT NULL;

UPDATE drainage_reports
SET assigned_to = assigned_to_user_id
WHERE assigned_to IS NULL AND assigned_to_user_id IS NOT NULL;

UPDATE inspections
SET inspector_id = inspector_user_id
WHERE inspector_id IS NULL AND inspector_user_id IS NOT NULL;

UPDATE maintenance_records
SET assigned_to = assigned_to_user_id
WHERE assigned_to IS NULL AND assigned_to_user_id IS NOT NULL;

ALTER TABLE drainage_reports DROP FOREIGN KEY fk_reports_resident_user;
ALTER TABLE drainage_reports DROP FOREIGN KEY fk_reports_assignee_user;
ALTER TABLE drainage_reports DROP COLUMN resident_user_id;
ALTER TABLE drainage_reports DROP COLUMN assigned_to_user_id;

ALTER TABLE inspections DROP FOREIGN KEY fk_inspections_inspector_user;
ALTER TABLE inspections DROP COLUMN inspector_user_id;

ALTER TABLE maintenance_records DROP FOREIGN KEY fk_maintenance_assignee_user;
ALTER TABLE maintenance_records DROP COLUMN assigned_to_user_id;
