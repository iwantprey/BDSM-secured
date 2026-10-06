
-- The administrator's configured barangay is the source of truth for every account.
UPDATE system_users u
JOIN system_settings s ON s.setting_key = 'barangay_name'
SET u.barangay = s.setting_value
WHERE u.barangay <> s.setting_value;

-- Give demo residents realistic street addresses where older seeds left them blank.
UPDATE system_users
SET address = CASE email
  WHEN 'jdelacruz@email.com' THEN '123 Rizal Street'
  WHEN 'areyes@email.com' THEN '45 Mabini Avenue'
  WHEN 'pgarcia@email.com' THEN '78 Bonifacio Road'
  WHEN 'lmendoza@email.com' THEN '15 Luna Street'
  WHEN 'rflores@email.com' THEN '200 Aguinaldo Street'
  WHEN 'cbautista@email.com' THEN '9 Del Pilar Street'
  WHEN 'jnavarro@email.com' THEN '33 Quezon Boulevard'
  ELSE address
END
WHERE email IN (
  'jdelacruz@email.com', 'areyes@email.com', 'pgarcia@email.com',
  'lmendoza@email.com', 'rflores@email.com', 'cbautista@email.com',
  'jnavarro@email.com'
);

-- Normalize demo report and inspection locations to the configured barangay.
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
WHERE r.id REGEXP '^RPT-20(24|26)-00[1-7]$';

UPDATE inspections i
JOIN drainage_reports r ON r.id = i.report_id
SET i.location = r.location
WHERE r.id REGEXP '^RPT-20(24|26)-00[1-7]$';
