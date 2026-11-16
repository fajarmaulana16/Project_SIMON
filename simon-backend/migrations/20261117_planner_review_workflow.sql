-- Jalankan satu kali pada database SIMON sebelum memperbarui backend.
-- Nilai status lama tetap tersedia; ALTER enum ini tidak mengubah baris yang sudah ada.
ALTER TABLE rencana_pekerjaan
  MODIFY COLUMN status
    ENUM('draft','menunggu_review','revisi','disetujui','berjalan','selesai','dibatalkan')
    NOT NULL DEFAULT 'draft';

CREATE TABLE rencana_status_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rencana_id INT UNSIGNED NOT NULL,
  status_lama VARCHAR(30) NULL,
  status_baru VARCHAR(30) NOT NULL,
  catatan TEXT NULL,
  diubah_oleh INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rencana_status_log (rencana_id, created_at),
  CONSTRAINT fk_rencana_status_log_rencana
    FOREIGN KEY (rencana_id) REFERENCES rencana_pekerjaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_rencana_status_log_user
    FOREIGN KEY (diubah_oleh) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE pekerjaan
  ADD COLUMN idempotency_key CHAR(36) NULL UNIQUE;
