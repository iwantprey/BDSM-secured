
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id CHAR(36) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  email VARCHAR(254) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_user_created (user_id, created_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES system_users(id) ON DELETE CASCADE
);
