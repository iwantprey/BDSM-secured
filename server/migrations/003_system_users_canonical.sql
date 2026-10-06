
ALTER TABLE system_users
  MODIFY COLUMN name VARCHAR(150) NOT NULL,
  MODIFY COLUMN email VARCHAR(254) NOT NULL,
  MODIFY COLUMN barangay VARCHAR(160) NOT NULL,
  ADD COLUMN password_hash VARCHAR(255) NULL,
  ADD COLUMN address VARCHAR(255) NULL,
  ADD COLUMN phone VARCHAR(40) NULL;

INSERT IGNORE INTO system_users (id, name, email, password_hash, role, barangay, address, phone, status, joined_at)
SELECT id, name, email, password_hash, role, barangay, address, phone, status, joined_at
FROM users;
