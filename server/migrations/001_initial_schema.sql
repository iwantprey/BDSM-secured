
CREATE TABLE IF NOT EXISTS system_users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  role ENUM('resident', 'staff', 'admin') NOT NULL DEFAULT 'resident',
  barangay VARCHAR(160) NOT NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  joined_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drainage_reports (
  id CHAR(20) PRIMARY KEY,
  resident_id VARCHAR(50) NULL,
  resident_name VARCHAR(120) NULL,
  resident_email VARCHAR(254) NULL,
  location VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status ENUM('pending', 'verified', 'in-progress', 'resolved', 'rejected') NOT NULL DEFAULT 'pending',
  assigned_to VARCHAR(50) NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reports_status_submitted (status, submitted_at),
  INDEX idx_reports_resident_email (resident_email),
  CONSTRAINT fk_reports_resident FOREIGN KEY (resident_id) REFERENCES system_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reports_assignee FOREIGN KEY (assigned_to) REFERENCES system_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inspections (
  id CHAR(20) PRIMARY KEY,
  report_id CHAR(20) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  inspection_date_time DATETIME NULL,
  inspector_id VARCHAR(50) NULL,
  inspection_date DATE NOT NULL,
  inspection_time TIME NOT NULL,
  inspector VARCHAR(120) NULL,
  notes TEXT NULL,
  status ENUM('scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inspections_report FOREIGN KEY (report_id) REFERENCES drainage_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_inspections_inspector FOREIGN KEY (inspector_id) REFERENCES system_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  report_id CHAR(20) PRIMARY KEY,
  assigned_to VARCHAR(50) NULL,
  estimated_cost DECIMAL(12,2) NULL,
  materials TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_report FOREIGN KEY (report_id) REFERENCES drainage_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_assignee FOREIGN KEY (assigned_to) REFERENCES system_users(id) ON DELETE SET NULL
);
