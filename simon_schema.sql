-- ============================================================
-- DATABASE SIMON (Sistem Informasi Monitoring)
-- MySQL 8.0+ / MariaDB 10.11+
-- Dibuat berdasarkan dokumen "Rancangan Database SIMON"
-- ============================================================

CREATE DATABASE IF NOT EXISTS simon
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE simon;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS v_monitoring_deadline;
DROP VIEW IF EXISTS v_ringkasan_proyek;
DROP TABLE IF EXISTS notifikasi, ringkasan_evaluasi, evaluasi_nilai,
  evaluasi_pekerjaan, kriteria_evaluasi, pekerjaan_status_log, lampiran,
  progres_log, pekerjaan_tahapan, pekerjaan, rencana_pekerjaan, proyek,
  pengaturan, tahapan, prioritas, jenis_pekerjaan, fungsi, users, divisi, roles;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. MASTER DATA
CREATE TABLE roles (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(20) NOT NULL UNIQUE,
  nama VARCHAR(100) NOT NULL,
  deskripsi VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE divisi (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(20) NOT NULL UNIQUE,
  nama VARCHAR(150) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  divisi_id INT UNSIGNED NULL,
  role_id TINYINT UNSIGNED NOT NULL,
  supervisor_id INT UNSIGNED NULL,
  nama VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(150) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_divisi FOREIGN KEY (divisi_id) REFERENCES divisi(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE fungsi (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(150) NOT NULL UNIQUE,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE jenis_pekerjaan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(30) NOT NULL UNIQUE,
  nama VARCHAR(150) NOT NULL,
  awalan_nomor VARCHAR(30) NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE prioritas (
  id TINYINT UNSIGNED PRIMARY KEY,
  nama VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE tahapan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(30) NOT NULL UNIQUE,
  nama VARCHAR(100) NOT NULL,
  urutan TINYINT UNSIGNED NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE pengaturan (
  kunci VARCHAR(50) PRIMARY KEY,
  nilai VARCHAR(255) NOT NULL,
  keterangan VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. PERENCANAAN
CREATE TABLE proyek (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(30) NOT NULL UNIQUE,
  nama VARCHAR(200) NOT NULL,
  deskripsi TEXT NULL,
  tahun SMALLINT UNSIGNED NOT NULL,
  periode_mulai DATE NOT NULL,
  periode_selesai DATE NOT NULL,
  target_jumlah INT UNSIGNED NULL,
  status ENUM('draft','aktif','selesai','arsip') NOT NULL DEFAULT 'draft',
  dibuat_oleh INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_proyek_periode CHECK (periode_selesai >= periode_mulai),
  CONSTRAINT fk_proyek_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE rencana_pekerjaan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proyek_id INT UNSIGNED NOT NULL,
  rencana_asal_id INT UNSIGNED NULL,
  tipe_rencana ENUM('plan','extra','special') NOT NULL DEFAULT 'plan',
  tahun_plan SMALLINT UNSIGNED NULL,
  jangka ENUM('jangka_pendek','bulanan','tahunan') NOT NULL DEFAULT 'tahunan',
  jenis_id INT UNSIGNED NOT NULL,
  fungsi_id INT UNSIGNED NULL,
  prioritas_id TINYINT UNSIGNED NOT NULL,
  judul VARCHAR(500) NOT NULL,
  ruang_lingkup TEXT NULL,
  target TEXT NULL,
  dasar_permintaan TEXT NULL,
  media_permintaan ENUM('email','surat','whatsapp','lisan','rapat','hardcopy','lainnya') NULL,
  tgl_rencana_mulai DATE NOT NULL,
  durasi_hari SMALLINT UNSIGNED NOT NULL,
  tgl_rencana_selesai DATE GENERATED ALWAYS AS (DATE_ADD(tgl_rencana_mulai, INTERVAL durasi_hari DAY)) STORED,
  pic_awal_id INT UNSIGNED NULL,
  status ENUM('draft','disetujui','berjalan','selesai','dibatalkan') NOT NULL DEFAULT 'draft',
  alasan_batal VARCHAR(255) NULL,
  disetujui_oleh INT UNSIGNED NULL,
  tgl_disetujui DATETIME NULL,
  dibuat_oleh INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rencana_proyek (proyek_id),
  CONSTRAINT chk_rencana_durasi CHECK (durasi_hari > 0),
  CONSTRAINT fk_rencana_proyek FOREIGN KEY (proyek_id) REFERENCES proyek(id),
  CONSTRAINT fk_rencana_asal FOREIGN KEY (rencana_asal_id) REFERENCES rencana_pekerjaan(id) ON DELETE SET NULL,
  CONSTRAINT fk_rencana_jenis FOREIGN KEY (jenis_id) REFERENCES jenis_pekerjaan(id),
  CONSTRAINT fk_rencana_fungsi FOREIGN KEY (fungsi_id) REFERENCES fungsi(id) ON DELETE SET NULL,
  CONSTRAINT fk_rencana_prioritas FOREIGN KEY (prioritas_id) REFERENCES prioritas(id),
  CONSTRAINT fk_rencana_pic FOREIGN KEY (pic_awal_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_rencana_disetujui FOREIGN KEY (disetujui_oleh) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_rencana_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES users(id)
) ENGINE=InnoDB;

-- 3. PELAKSANAAN
CREATE TABLE pekerjaan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(30) NOT NULL UNIQUE,
  proyek_id INT UNSIGNED NOT NULL,
  rencana_id INT UNSIGNED NULL,
  pekerjaan_induk_id INT UNSIGNED NULL,
  jenis_id INT UNSIGNED NOT NULL,
  fungsi_id INT UNSIGNED NULL,
  divisi_id INT UNSIGNED NULL,
  prioritas_id TINYINT UNSIGNED NOT NULL,
  nama_pekerjaan VARCHAR(500) NOT NULL,
  deskripsi TEXT NULL,
  dasar_permintaan TEXT NULL,
  media_permintaan ENUM('email','surat','whatsapp','lisan','rapat','hardcopy','lainnya') NULL,
  penanggung_jawab_id INT UNSIGNED NOT NULL,
  supervisor_id INT UNSIGNED NOT NULL,
  tgl_mulai DATE NOT NULL,
  deadline DATE NOT NULL,
  tgl_selesai_aktual DATE NULL,
  progres_terakhir TINYINT UNSIGNED NOT NULL DEFAULT 0,
  progres_terverifikasi TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('belum_dimulai','berjalan','tertunda','menunggu_evaluasi','selesai','dibatalkan') NOT NULL DEFAULT 'belum_dimulai',
  alasan_batal VARCHAR(255) NULL,
  nomor_dokumen VARCHAR(100) NULL,
  dibuat_oleh INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pekerjaan_deadline (deadline),
  INDEX idx_pekerjaan_status (status),
  INDEX idx_pekerjaan_nomor (nomor_dokumen),
  CONSTRAINT chk_pekerjaan_progres CHECK (progres_terakhir BETWEEN 0 AND 100 AND progres_terverifikasi BETWEEN 0 AND 100),
  CONSTRAINT chk_pekerjaan_tanggal CHECK (deadline >= tgl_mulai),
  CONSTRAINT fk_pekerjaan_proyek FOREIGN KEY (proyek_id) REFERENCES proyek(id),
  CONSTRAINT fk_pekerjaan_rencana FOREIGN KEY (rencana_id) REFERENCES rencana_pekerjaan(id) ON DELETE SET NULL,
  CONSTRAINT fk_pekerjaan_induk FOREIGN KEY (pekerjaan_induk_id) REFERENCES pekerjaan(id) ON DELETE SET NULL,
  CONSTRAINT fk_pekerjaan_jenis FOREIGN KEY (jenis_id) REFERENCES jenis_pekerjaan(id),
  CONSTRAINT fk_pekerjaan_fungsi FOREIGN KEY (fungsi_id) REFERENCES fungsi(id) ON DELETE SET NULL,
  CONSTRAINT fk_pekerjaan_divisi FOREIGN KEY (divisi_id) REFERENCES divisi(id) ON DELETE SET NULL,
  CONSTRAINT fk_pekerjaan_prioritas FOREIGN KEY (prioritas_id) REFERENCES prioritas(id),
  CONSTRAINT fk_pekerjaan_pic FOREIGN KEY (penanggung_jawab_id) REFERENCES users(id),
  CONSTRAINT fk_pekerjaan_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(id),
  CONSTRAINT fk_pekerjaan_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE pekerjaan_tahapan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pekerjaan_id INT UNSIGNED NOT NULL,
  tahapan_id INT UNSIGNED NOT NULL,
  tanggal DATE NOT NULL,
  catatan VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pekerjaan_tahapan (pekerjaan_id, tahapan_id),
  CONSTRAINT fk_pt_pekerjaan FOREIGN KEY (pekerjaan_id) REFERENCES pekerjaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_pt_tahapan FOREIGN KEY (tahapan_id) REFERENCES tahapan(id)
) ENGINE=InnoDB;

CREATE TABLE progres_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pekerjaan_id INT UNSIGNED NOT NULL,
  tanggal_update DATE NOT NULL,
  nilai_progres TINYINT UNSIGNED NOT NULL,
  catatan TEXT NULL,
  diperbarui_oleh INT UNSIGNED NOT NULL,
  status_verifikasi ENUM('menunggu','disetujui','dikembalikan') NOT NULL DEFAULT 'menunggu',
  diverifikasi_oleh INT UNSIGNED NULL,
  tgl_verifikasi DATETIME NULL,
  catatan_verifikasi TEXT NULL,
  sumber ENUM('aplikasi','impor') NOT NULL DEFAULT 'aplikasi',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_progres_pekerjaan_tanggal (pekerjaan_id, tanggal_update),
  CONSTRAINT chk_nilai_progres CHECK (nilai_progres BETWEEN 0 AND 100),
  CONSTRAINT fk_progres_pekerjaan FOREIGN KEY (pekerjaan_id) REFERENCES pekerjaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_progres_pembuat FOREIGN KEY (diperbarui_oleh) REFERENCES users(id),
  CONSTRAINT fk_progres_verifikator FOREIGN KEY (diverifikasi_oleh) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE lampiran (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pekerjaan_id INT UNSIGNED NOT NULL,
  progres_log_id INT UNSIGNED NULL,
  nama_file VARCHAR(255) NOT NULL,
  path_file VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NULL,
  ukuran_byte BIGINT UNSIGNED NULL,
  keterangan VARCHAR(255) NULL,
  diunggah_oleh INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lampiran_pekerjaan FOREIGN KEY (pekerjaan_id) REFERENCES pekerjaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_lampiran_progres FOREIGN KEY (progres_log_id) REFERENCES progres_log(id) ON DELETE SET NULL,
  CONSTRAINT fk_lampiran_user FOREIGN KEY (diunggah_oleh) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE pekerjaan_status_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pekerjaan_id INT UNSIGNED NOT NULL,
  status_lama VARCHAR(30) NULL,
  status_baru VARCHAR(30) NOT NULL,
  alasan VARCHAR(255) NULL,
  diubah_oleh INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_statuslog_pekerjaan FOREIGN KEY (pekerjaan_id) REFERENCES pekerjaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_statuslog_user FOREIGN KEY (diubah_oleh) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. EVALUASI
CREATE TABLE kriteria_evaluasi (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(150) NOT NULL,
  deskripsi VARCHAR(255) NULL,
  bobot DECIMAL(5,2) NOT NULL DEFAULT 0,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_kriteria_bobot CHECK (bobot BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE evaluasi_pekerjaan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pekerjaan_id INT UNSIGNED NOT NULL,
  evaluasi_ke TINYINT UNSIGNED NOT NULL DEFAULT 1,
  evaluator_id INT UNSIGNED NOT NULL,
  skor_akhir DECIMAL(5,2) NOT NULL DEFAULT 0,
  catatan TEXT NULL,
  rekomendasi TEXT NULL,
  tgl_evaluasi DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_evaluasi_ke (pekerjaan_id, evaluasi_ke),
  CONSTRAINT chk_skor_akhir CHECK (skor_akhir BETWEEN 0 AND 100),
  CONSTRAINT fk_eval_pekerjaan FOREIGN KEY (pekerjaan_id) REFERENCES pekerjaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE evaluasi_nilai (
  evaluasi_id INT UNSIGNED NOT NULL,
  kriteria_id INT UNSIGNED NOT NULL,
  skor DECIMAL(5,2) NOT NULL,
  catatan VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (evaluasi_id, kriteria_id),
  CONSTRAINT chk_evaluasi_nilai_skor CHECK (skor BETWEEN 0 AND 100),
  CONSTRAINT fk_en_evaluasi FOREIGN KEY (evaluasi_id) REFERENCES evaluasi_pekerjaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_en_kriteria FOREIGN KEY (kriteria_id) REFERENCES kriteria_evaluasi(id)
) ENGINE=InnoDB;

CREATE TABLE ringkasan_evaluasi (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proyek_id INT UNSIGNED NOT NULL,
  jenis_periode ENUM('bulanan','tahunan') NOT NULL,
  tahun SMALLINT UNSIGNED NOT NULL,
  bulan TINYINT UNSIGNED NOT NULL DEFAULT 0,
  jumlah_dievaluasi INT UNSIGNED NOT NULL DEFAULT 0,
  rata_skor DECIMAL(5,2) NULL,
  ringkasan TEXT NULL,
  rekomendasi_perencanaan TEXT NULL,
  dibuat_oleh INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ringkasan_periode (proyek_id, jenis_periode, tahun, bulan),
  CONSTRAINT chk_ringkasan_bulan CHECK (bulan BETWEEN 0 AND 12),
  CONSTRAINT fk_ringkasan_proyek FOREIGN KEY (proyek_id) REFERENCES proyek(id) ON DELETE CASCADE,
  CONSTRAINT fk_ringkasan_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES users(id)
) ENGINE=InnoDB;

-- 5. NOTIFIKASI
CREATE TABLE notifikasi (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  pekerjaan_id INT UNSIGNED NULL,
  rencana_id INT UNSIGNED NULL,
  tipe ENUM('lewat_deadline','mendekati_deadline','perlu_verifikasi','progres_dikembalikan','menunggu_evaluasi','rencana_baru') NOT NULL,
  pesan VARCHAR(255) NOT NULL,
  dibaca_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_notifikasi_user_baca (user_id, dibaca_at),
  CONSTRAINT fk_notifikasi_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifikasi_pekerjaan FOREIGN KEY (pekerjaan_id) REFERENCES pekerjaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifikasi_rencana FOREIGN KEY (rencana_id) REFERENCES rencana_pekerjaan(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- DATA MASTER AWAL
INSERT INTO roles (kode, nama, deskripsi) VALUES
('admin','Admin','Mengelola pengguna dan master data'),
('planner','Planner','Menyusun perencanaan pekerjaan'),
('supervisor','Supervisor','Menetapkan dan memantau pekerjaan'),
('staff','Staff','Melaksanakan pekerjaan dan mengirim progres'),
('evaluator','Evaluator','Melakukan evaluasi pekerjaan');

INSERT INTO prioritas (id, nama) VALUES
(1,'Tinggi'), (2,'Sedang'), (3,'Rendah');

INSERT INTO tahapan (kode, nama, urutan) VALUES
('MULAI_DRAFT','Mulai Draft',1),
('RELEASE_VP','Released VP IT',2),
('MASUK_BOD','Masuk BOD',3),
('RILIS','Rilis',4);

INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES
('batas_hari_perhatian','7','Sisa hari deadline kurang dari atau sama dengan nilai ini dianggap dekat deadline'),
('batas_progres_perhatian','70','Progres di bawah nilai ini dekat deadline dianggap perlu perhatian');

INSERT INTO kriteria_evaluasi (nama, deskripsi, bobot, aktif) VALUES
('Kesesuaian Rencana','Kesesuaian hasil dengan rencana awal',30,1),
('Kualitas Hasil','Kualitas hasil pekerjaan',40,1),
('Ketepatan Waktu','Ketepatan penyelesaian terhadap deadline',20,1),
('Dokumentasi','Kelengkapan dokumentasi pekerjaan',10,1);

-- VIEW 1: STATUS DEADLINE DIHITUNG, BUKAN DISIMPAN DI TABEL
CREATE VIEW v_monitoring_deadline AS
SELECT
  p.id AS pekerjaan_id,
  p.kode,
  p.nama_pekerjaan,
  p.penanggung_jawab_id,
  u.nama AS nama_penanggung_jawab,
  p.supervisor_id,
  s.nama AS nama_supervisor,
  p.tgl_mulai,
  p.deadline,
  p.progres_terakhir,
  p.progres_terverifikasi,
  p.status,
  DATEDIFF(p.deadline, CURDATE()) AS sisa_hari,
  CASE
    WHEN p.status IN ('selesai','dibatalkan') THEN 'selesai_atau_dibatalkan'
    WHEN p.deadline < CURDATE() THEN 'terlambat'
    WHEN DATEDIFF(p.deadline, CURDATE()) <= CAST((SELECT nilai FROM pengaturan WHERE kunci='batas_hari_perhatian') AS UNSIGNED)
         AND p.progres_terverifikasi < CAST((SELECT nilai FROM pengaturan WHERE kunci='batas_progres_perhatian') AS UNSIGNED)
      THEN 'perlu_perhatian'
    ELSE 'normal'
  END AS kondisi_deadline
FROM pekerjaan p
JOIN users u ON u.id = p.penanggung_jawab_id
JOIN users s ON s.id = p.supervisor_id;

-- VIEW 2: RINGKASAN ANGKA UNTUK DASHBOARD / LAPORAN PROYEK
CREATE VIEW v_ringkasan_proyek AS
SELECT
  pr.id AS proyek_id,
  pr.kode AS kode_proyek,
  pr.nama AS nama_proyek,
  pr.tahun,
  COUNT(DISTINCT pk.id) AS target_pekerjaan,
  COUNT(DISTINCT CASE WHEN pk.status='selesai' THEN pk.id END) AS jumlah_selesai,
  COUNT(DISTINCT CASE WHEN pk.status IN ('belum_dimulai','berjalan','tertunda','menunggu_evaluasi') THEN pk.id END) AS jumlah_berjalan,
  COUNT(DISTINCT CASE WHEN pk.status NOT IN ('selesai','dibatalkan') AND pk.deadline < CURDATE() THEN pk.id END) AS jumlah_terlambat,
  COALESCE(ROUND(AVG(pk.progres_terverifikasi),2),0) AS rata_progres_terverifikasi,
  COUNT(DISTINCT pk.penanggung_jawab_id) AS jumlah_staff,
  ROUND(AVG(ev.skor_akhir),2) AS rata_rata_skor_evaluasi
FROM proyek pr
LEFT JOIN pekerjaan pk ON pk.proyek_id = pr.id
LEFT JOIN evaluasi_pekerjaan ev ON ev.pekerjaan_id = pk.id
GROUP BY pr.id, pr.kode, pr.nama, pr.tahun;

-- ============================================================
-- SELESAI. Jalankan file ini melalui phpMyAdmin > Import,
-- atau MySQL Workbench / command line.
-- ============================================================
