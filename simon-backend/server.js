
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { pool } from "./db.js";

dotenv.config();

const app = express();
const progressUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = new Map([
      [".pdf", ["application/pdf"]],
      [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
      [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]],
      [".jpg", ["image/jpeg"]],
      [".jpeg", ["image/jpeg"]],
      [".png", ["image/png"]],
    ]);
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedMimeTypes = allowedTypes.get(extension);
    if (!allowedMimeTypes?.includes(file.mimetype)) {
      return callback(new Error("Format lampiran harus PDF, DOCX, XLSX, JPG, atau PNG."));
    }
    return callback(null, true);
  },
});
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const progressUploadDirectory = path.join(backendDirectory, "uploads", "progress");

function parseProgressUpload(req, res, next) {
  progressUpload.single("lampiran")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        message: error.code === "LIMIT_FILE_SIZE"
          ? "Ukuran lampiran maksimal 10 MB."
          : "Lampiran tidak valid atau melebihi batas yang diizinkan."
      });
    }
    return res.status(400).json({ message: error.message });
  });
}

const frontendOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({
  origin(origin, callback) {
    const isViteLoopbackOrigin =
      typeof origin === "string" &&
      /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):517[3-9]$/.test(origin);

    if (!origin || frontendOrigins.includes(origin) || isViteLoopbackOrigin) {
      return callback(null, true);
    }

    return callback(null, false);
  }
}));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Database tidak dapat dihubungi"
    });
  }
});

async function requireAdmin(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({ message: "Token autentikasi diperlukan." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || typeof payload !== "object" || !payload.id) {
      return res.status(401).json({ message: "Token autentikasi tidak valid." });
    }

    const [users] = await pool.execute(
      `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.aktif = 1 AND r.kode = 'admin'
       LIMIT 1`,
      [payload.id]
    );

    if (!users.length) {
      return res.status(403).json({
        message: "Akses hanya tersedia untuk administrator aktif."
      });
    }

    req.adminUserId = Number(users[0].id);
    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Token autentikasi tidak valid atau kedaluwarsa." });
    }

    console.error("Admin authorization error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat memeriksa hak akses administrator."
    });
  }
}

async function requirePlanner(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({ message: "Token autentikasi diperlukan." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || typeof payload !== "object" || !payload.id) {
      return res.status(401).json({ message: "Token autentikasi tidak valid." });
    }

    const [users] = await pool.execute(
      `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.aktif = 1 AND r.kode = 'planner'
       LIMIT 1`,
      [payload.id]
    );

    if (!users.length) {
      return res.status(403).json({
        message: "Akses hanya tersedia untuk planner aktif."
      });
    }

    req.plannerUserId = Number(users[0].id);
    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Token autentikasi tidak valid atau kedaluwarsa."
      });
    }

    console.error("Planner authorization error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat memeriksa hak akses planner."
    });
  }
}

async function requireStaff(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({ message: "Token autentikasi diperlukan." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || typeof payload !== "object" || !payload.id) {
      return res.status(401).json({ message: "Token autentikasi tidak valid." });
    }

    const [users] = await pool.execute(
      `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.aktif = 1 AND r.kode = 'staff'
       LIMIT 1`,
      [payload.id]
    );

    if (!users.length) {
      return res.status(403).json({
        message: "Akses hanya tersedia untuk staff aktif."
      });
    }

    req.staffUserId = Number(users[0].id);
    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Token autentikasi tidak valid atau kedaluwarsa."
      });
    }

    console.error("Staff authorization error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat memeriksa hak akses staff."
    });
  }
}

async function requireSupervisor(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({ message: "Token autentikasi diperlukan." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || typeof payload !== "object" || !payload.id) {
      return res.status(401).json({ message: "Token autentikasi tidak valid." });
    }

    const [users] = await pool.execute(
      `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.aktif = 1 AND r.kode = 'supervisor'
       LIMIT 1`,
      [payload.id]
    );

    if (!users.length) {
      return res.status(403).json({
        message: "Akses hanya tersedia untuk supervisor aktif."
      });
    }

    req.supervisorUserId = Number(users[0].id);
    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Token autentikasi tidak valid atau kedaluwarsa."
      });
    }

    console.error("Supervisor authorization error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat memeriksa hak akses supervisor."
    });
  }
}

async function requireEvaluator(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({ message: "Token autentikasi diperlukan." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || typeof payload !== "object" || !payload.id) {
      return res.status(401).json({ message: "Token autentikasi tidak valid." });
    }

    const [users] = await pool.execute(
      `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.aktif = 1 AND r.kode = 'evaluator'
       LIMIT 1`,
      [payload.id]
    );

    if (!users.length) {
      return res.status(403).json({
        message: "Akses hanya tersedia untuk evaluator aktif."
      });
    }

    req.evaluatorUserId = Number(users[0].id);
    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Token autentikasi tidak valid atau kedaluwarsa."
      });
    }

    console.error("Evaluator authorization error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat memeriksa hak akses evaluator."
    });
  }
}

function parseNullableId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : NaN;
}

function validEmail(value) {
  return typeof value === "string" &&
    value.length <= 150 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const adminResources = {
  divisi: {
    label: "Divisi",
    table: "divisi",
    key: "id",
    columns: ["id", "kode", "nama", "aktif"],
    fields: [
      { name: "kode", label: "Kode", type: "text", required: true, maxLength: 20 },
      { name: "nama", label: "Nama divisi", type: "text", required: true, maxLength: 150 },
      { name: "aktif", label: "Aktif", type: "boolean", default: 1 }
    ],
    deletable: true
  },
  fungsi: {
    label: "Fungsi",
    table: "fungsi",
    key: "id",
    columns: ["id", "nama", "aktif"],
    fields: [
      { name: "nama", label: "Nama fungsi", type: "text", required: true, maxLength: 150 },
      { name: "aktif", label: "Aktif", type: "boolean", default: 1 }
    ],
    deletable: true
  },
  jenis_pekerjaan: {
    label: "Jenis Pekerjaan",
    table: "jenis_pekerjaan",
    key: "id",
    columns: ["id", "kode", "nama", "awalan_nomor", "aktif"],
    fields: [
      { name: "kode", label: "Kode", type: "text", required: true, maxLength: 30 },
      { name: "nama", label: "Nama jenis pekerjaan", type: "text", required: true, maxLength: 150 },
      { name: "awalan_nomor", label: "Awalan nomor", type: "text", maxLength: 30 },
      { name: "aktif", label: "Aktif", type: "boolean", default: 1 }
    ],
    deletable: true
  },
  tahapan: {
    label: "Tahapan",
    table: "tahapan",
    key: "id",
    columns: ["id", "kode", "nama", "urutan", "aktif"],
    fields: [
      { name: "kode", label: "Kode", type: "text", required: true, maxLength: 30 },
      { name: "nama", label: "Nama tahapan", type: "text", required: true, maxLength: 100 },
      { name: "urutan", label: "Urutan", type: "number", required: true, min: 1, max: 255 },
      { name: "aktif", label: "Aktif", type: "boolean", default: 1 }
    ],
    deletable: true
  },
  prioritas: {
    label: "Prioritas",
    table: "prioritas",
    key: "id",
    columns: ["id", "nama"],
    fields: [
      { name: "id", label: "ID prioritas", type: "number", required: true, integer: true, min: 1, max: 255, immutable: true },
      { name: "nama", label: "Nama prioritas", type: "text", required: true, maxLength: 50 }
    ],
    deletable: true
  },
  roles: {
    label: "Role",
    table: "roles",
    key: "id",
    columns: ["id", "kode", "nama", "deskripsi"],
    fields: [
      { name: "kode", label: "Kode role", type: "text", required: true, maxLength: 20, immutable: true },
      { name: "nama", label: "Nama role", type: "text", required: true, maxLength: 100 },
      { name: "deskripsi", label: "Deskripsi", type: "textarea", maxLength: 255 }
    ],
    deletable: true,
    protectedCodes: ["admin", "planner", "supervisor", "staff", "evaluator"]
  },
  pengaturan: {
    label: "Pengaturan Sistem",
    table: "pengaturan",
    key: "kunci",
    columns: ["kunci", "nilai", "keterangan", "updated_at"],
    fields: [
      { name: "kunci", label: "Kunci", type: "text", required: true, maxLength: 50, immutable: true },
      { name: "nilai", label: "Nilai", type: "text", required: true, maxLength: 255 },
      { name: "keterangan", label: "Keterangan", type: "text", maxLength: 255 }
    ]
  },
  proyek: {
    label: "Proyek",
    table: "proyek",
    key: "id",
    columns: ["id", "kode", "nama", "tahun", "periode_mulai", "periode_selesai", "target_jumlah", "status"],
    fields: [
      { name: "kode", label: "Kode proyek", type: "text", required: true, maxLength: 30 },
      { name: "nama", label: "Nama proyek", type: "text", required: true, maxLength: 200 },
      { name: "deskripsi", label: "Deskripsi", type: "textarea" },
      { name: "tahun", label: "Tahun", type: "number", required: true, integer: true, min: 2000, max: 2200 },
      { name: "periode_mulai", label: "Periode mulai", type: "date", required: true },
      { name: "periode_selesai", label: "Periode selesai", type: "date", required: true },
      { name: "target_jumlah", label: "Target pekerjaan", type: "number", integer: true, min: 0, max: 4294967295 },
      { name: "status", label: "Status", type: "select", required: true, options: ["draft", "aktif", "selesai", "arsip"] }
    ],
    createdBy: true
  },
  rencana_pekerjaan: {
    label: "Rencana Pekerjaan",
    table: "rencana_pekerjaan",
    key: "id",
    columns: ["id", "judul", "proyek_id", "jenis_id", "jangka", "tgl_rencana_mulai", "tgl_rencana_selesai", "status"],
    fields: [
      { name: "proyek_id", label: "Proyek", type: "lookup", lookup: "proyek", required: true },
      { name: "rencana_asal_id", label: "Rencana asal", type: "lookup", lookup: "rencana_pekerjaan" },
      { name: "tipe_rencana", label: "Tipe rencana", type: "select", required: true, options: ["plan", "extra", "special"], default: "plan" },
      { name: "tahun_plan", label: "Tahun plan", type: "number", integer: true, min: 2000, max: 2200 },
      { name: "jangka", label: "Jangka", type: "select", required: true, options: ["jangka_pendek", "bulanan", "tahunan"], default: "tahunan" },
      { name: "jenis_id", label: "Jenis pekerjaan", type: "lookup", lookup: "jenis_pekerjaan", required: true },
      { name: "fungsi_id", label: "Fungsi", type: "lookup", lookup: "fungsi" },
      { name: "prioritas_id", label: "Prioritas", type: "lookup", lookup: "prioritas", required: true },
      { name: "judul", label: "Judul rencana", type: "text", required: true, maxLength: 500 },
      { name: "ruang_lingkup", label: "Ruang lingkup", type: "textarea" },
      { name: "target", label: "Target", type: "textarea" },
      { name: "dasar_permintaan", label: "Dasar permintaan", type: "textarea" },
      { name: "media_permintaan", label: "Media permintaan", type: "select", options: ["email", "surat", "whatsapp", "lisan", "rapat", "hardcopy", "lainnya"] },
      { name: "tgl_rencana_mulai", label: "Tanggal mulai", type: "date", required: true },
      { name: "durasi_hari", label: "Durasi (hari)", type: "number", required: true, integer: true, min: 1, max: 65535 },
      { name: "pic_awal_id", label: "PIC awal", type: "lookup", lookup: "staff" },
      { name: "status", label: "Status", type: "select", required: true, options: ["draft", "disetujui", "berjalan", "selesai", "dibatalkan"], default: "draft" },
      { name: "alasan_batal", label: "Alasan batal", type: "text", maxLength: 255 }
    ],
    createdBy: true
  },
  pekerjaan: {
    label: "Pekerjaan",
    table: "pekerjaan",
    key: "id",
    columns: ["id", "kode", "nama_pekerjaan", "proyek_id", "penanggung_jawab_id", "supervisor_id", "deadline", "progres_terverifikasi", "status"],
    fields: [
      { name: "kode", label: "Kode pekerjaan", type: "text", required: true, maxLength: 30 },
      { name: "proyek_id", label: "Proyek", type: "lookup", lookup: "proyek", required: true },
      { name: "rencana_id", label: "Rencana", type: "lookup", lookup: "rencana_pekerjaan" },
      { name: "pekerjaan_induk_id", label: "Pekerjaan induk", type: "lookup", lookup: "pekerjaan" },
      { name: "jenis_id", label: "Jenis pekerjaan", type: "lookup", lookup: "jenis_pekerjaan", required: true },
      { name: "fungsi_id", label: "Fungsi", type: "lookup", lookup: "fungsi" },
      { name: "divisi_id", label: "Divisi", type: "lookup", lookup: "divisi" },
      { name: "prioritas_id", label: "Prioritas", type: "lookup", lookup: "prioritas", required: true },
      { name: "nama_pekerjaan", label: "Nama pekerjaan", type: "text", required: true, maxLength: 500 },
      { name: "deskripsi", label: "Deskripsi", type: "textarea" },
      { name: "dasar_permintaan", label: "Dasar permintaan", type: "textarea" },
      { name: "media_permintaan", label: "Media permintaan", type: "select", options: ["email", "surat", "whatsapp", "lisan", "rapat", "hardcopy", "lainnya"] },
      { name: "penanggung_jawab_id", label: "Penanggung jawab", type: "lookup", lookup: "staff", required: true },
      { name: "supervisor_id", label: "Supervisor", type: "lookup", lookup: "supervisor", required: true },
      { name: "tgl_mulai", label: "Tanggal mulai", type: "date", required: true },
      { name: "deadline", label: "Tenggat", type: "date", required: true },
      { name: "status", label: "Status", type: "select", required: true, options: ["belum_dimulai", "berjalan", "tertunda", "menunggu_evaluasi", "selesai", "dibatalkan"], default: "belum_dimulai" },
      { name: "alasan_batal", label: "Alasan batal", type: "text", maxLength: 255 },
      { name: "nomor_dokumen", label: "Nomor dokumen", type: "text", maxLength: 100 }
    ],
    createdBy: true,
    tracksStatus: true
  },
  pekerjaan_tahapan: {
    label: "Tahapan Pekerjaan",
    table: "pekerjaan_tahapan",
    key: "id",
    columns: ["id", "pekerjaan_id", "tahapan_id", "tanggal", "catatan"],
    fields: [
      { name: "pekerjaan_id", label: "Pekerjaan", type: "lookup", lookup: "pekerjaan", required: true },
      { name: "tahapan_id", label: "Tahapan", type: "lookup", lookup: "tahapan", required: true },
      { name: "tanggal", label: "Tanggal", type: "date", required: true },
      { name: "catatan", label: "Catatan", type: "text", maxLength: 255 }
    ]
  },
  progres_log: {
    label: "Progres & Verifikasi",
    table: "progres_log",
    key: "id",
    columns: ["id", "pekerjaan_id", "tanggal_update", "nilai_progres", "diperbarui_oleh", "status_verifikasi", "diverifikasi_oleh", "tgl_verifikasi"],
    fields: [
      { name: "status_verifikasi", label: "Status verifikasi", type: "select", required: true, options: ["menunggu", "disetujui", "dikembalikan"] },
      { name: "catatan_verifikasi", label: "Catatan verifikasi", type: "textarea" }
    ],
    editOnly: true
  },
  lampiran: {
    label: "Lampiran",
    table: "lampiran",
    key: "id",
    columns: ["id", "pekerjaan_id", "progres_log_id", "nama_file", "mime_type", "ukuran_byte", "diunggah_oleh", "created_at"],
    fields: [],
    readOnly: true
  },
  pekerjaan_status_log: {
    label: "Riwayat Status",
    table: "pekerjaan_status_log",
    key: "id",
    columns: ["id", "pekerjaan_id", "status_lama", "status_baru", "alasan", "diubah_oleh", "created_at"],
    fields: [],
    readOnly: true
  },
  kriteria_evaluasi: {
    label: "Kriteria Evaluasi",
    table: "kriteria_evaluasi",
    key: "id",
    columns: ["id", "nama", "deskripsi", "bobot", "aktif"],
    fields: [
      { name: "nama", label: "Nama kriteria", type: "text", required: true, maxLength: 150 },
      { name: "deskripsi", label: "Deskripsi", type: "text", maxLength: 255 },
      { name: "bobot", label: "Bobot (%)", type: "number", required: true, min: 0, max: 100, step: "0.01" },
      { name: "aktif", label: "Aktif", type: "boolean", default: 1 }
    ],
    deletable: true
  },
  evaluasi_pekerjaan: {
    label: "Evaluasi Pekerjaan",
    table: "evaluasi_pekerjaan",
    key: "id",
    columns: ["id", "pekerjaan_id", "evaluasi_ke", "evaluator_id", "skor_akhir", "tgl_evaluasi", "catatan", "rekomendasi"],
    fields: [
      { name: "pekerjaan_id", label: "Pekerjaan", type: "lookup", lookup: "pekerjaan", required: true },
      { name: "evaluasi_ke", label: "Evaluasi ke", type: "number", required: true, min: 1, max: 255, default: 1 },
      { name: "evaluator_id", label: "Evaluator", type: "lookup", lookup: "evaluator", required: true },
      { name: "skor_akhir", label: "Skor akhir", type: "number", required: true, min: 0, max: 100, step: "0.01" },
      { name: "catatan", label: "Catatan", type: "textarea" },
      { name: "rekomendasi", label: "Rekomendasi", type: "textarea" },
      { name: "tgl_evaluasi", label: "Tanggal evaluasi", type: "date", required: true }
    ]
  },
  evaluasi_nilai: {
    label: "Nilai Kriteria Evaluasi",
    table: "evaluasi_nilai",
    key: "id",
    columns: ["evaluasi_id", "kriteria_id", "skor", "catatan"],
    fields: [
      { name: "evaluasi_id", label: "Evaluasi", type: "lookup", lookup: "evaluasi_pekerjaan", required: true },
      { name: "kriteria_id", label: "Kriteria", type: "lookup", lookup: "kriteria_evaluasi", required: true },
      { name: "skor", label: "Skor", type: "number", required: true, min: 0, max: 100, step: "0.01" },
      { name: "catatan", label: "Catatan", type: "text", maxLength: 255 }
    ],
    composite: ["evaluasi_id", "kriteria_id"]
  },
  ringkasan_evaluasi: {
    label: "Ringkasan Evaluasi",
    table: "ringkasan_evaluasi",
    key: "id",
    columns: ["id", "proyek_id", "jenis_periode", "tahun", "bulan", "jumlah_dievaluasi", "rata_skor", "ringkasan", "rekomendasi_perencanaan"],
    fields: [
      { name: "proyek_id", label: "Proyek", type: "lookup", lookup: "proyek", required: true },
      { name: "jenis_periode", label: "Jenis periode", type: "select", required: true, options: ["bulanan", "tahunan"] },
      { name: "tahun", label: "Tahun", type: "number", required: true, min: 2000, max: 2200 },
      { name: "bulan", label: "Bulan (0 untuk tahunan)", type: "number", min: 0, max: 12, default: 0 },
      { name: "jumlah_dievaluasi", label: "Jumlah dievaluasi", type: "number", min: 0, default: 0 },
      { name: "rata_skor", label: "Rata-rata skor", type: "number", min: 0, max: 100, step: "0.01" },
      { name: "ringkasan", label: "Ringkasan", type: "textarea" },
      { name: "rekomendasi_perencanaan", label: "Rekomendasi perencanaan", type: "textarea" }
    ],
    createdBy: true
  },
  notifikasi: {
    label: "Notifikasi",
    table: "notifikasi",
    key: "id",
    columns: ["id", "user_id", "tipe", "pesan", "pekerjaan_id", "rencana_id", "dibaca_at", "created_at"],
    fields: [
      { name: "user_id", label: "Penerima", type: "lookup", lookup: "users", required: true },
      { name: "pekerjaan_id", label: "Pekerjaan", type: "lookup", lookup: "pekerjaan" },
      { name: "rencana_id", label: "Rencana", type: "lookup", lookup: "rencana_pekerjaan" },
      { name: "tipe", label: "Tipe", type: "select", required: true, options: ["lewat_deadline", "mendekati_deadline", "perlu_verifikasi", "progres_dikembalikan", "menunggu_evaluasi", "rencana_baru"] },
      { name: "pesan", label: "Pesan", type: "text", required: true, maxLength: 255 },
      { name: "dibaca_at", label: "Waktu dibaca", type: "datetime" }
    ]
  }
};

const adminLookups = {
  proyek: "SELECT id, CONCAT(kode, ' — ', nama) AS label FROM proyek ORDER BY nama LIMIT 500",
  rencana_pekerjaan: "SELECT id, CONCAT(id, ' — ', judul) AS label FROM rencana_pekerjaan ORDER BY id DESC LIMIT 500",
  pekerjaan: "SELECT id, CONCAT(kode, ' — ', nama_pekerjaan) AS label FROM pekerjaan ORDER BY id DESC LIMIT 500",
  jenis_pekerjaan: "SELECT id, CONCAT(kode, ' — ', nama) AS label FROM jenis_pekerjaan WHERE aktif = 1 ORDER BY nama",
  fungsi: "SELECT id, nama AS label FROM fungsi WHERE aktif = 1 ORDER BY nama",
  divisi: "SELECT id, CONCAT(kode, ' — ', nama) AS label FROM divisi WHERE aktif = 1 ORDER BY nama",
  prioritas: "SELECT id, nama AS label FROM prioritas ORDER BY id",
  tahapan: "SELECT id, CONCAT(urutan, ' — ', nama) AS label FROM tahapan WHERE aktif = 1 ORDER BY urutan",
  staff: `SELECT u.id, CONCAT(u.nama, ' — ', u.username) AS label FROM users u
          JOIN roles r ON r.id = u.role_id WHERE r.kode = 'staff' AND u.aktif = 1 ORDER BY u.nama`,
  supervisor: `SELECT u.id, CONCAT(u.nama, ' — ', u.username) AS label FROM users u
                JOIN roles r ON r.id = u.role_id WHERE r.kode = 'supervisor' AND u.aktif = 1 ORDER BY u.nama`,
  evaluator: `SELECT u.id, CONCAT(u.nama, ' — ', u.username) AS label FROM users u
               JOIN roles r ON r.id = u.role_id WHERE r.kode = 'evaluator' AND u.aktif = 1 ORDER BY u.nama`,
  users: `SELECT u.id, CONCAT(u.nama, ' — ', u.username) AS label FROM users u
          WHERE u.aktif = 1 ORDER BY u.nama`,
  evaluasi_pekerjaan: `SELECT id, CONCAT('Evaluasi #', id, ' — ', skor_akhir) AS label
                       FROM evaluasi_pekerjaan ORDER BY id DESC LIMIT 500`,
  kriteria_evaluasi: "SELECT id, CONCAT(nama, ' — ', bobot, '%') AS label FROM kriteria_evaluasi WHERE aktif = 1 ORDER BY nama"
};

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const [[work]] = await pool.execute(
      `SELECT
         COUNT(*) AS totalRegulasi,
         COALESCE(SUM(status IN ('belum_dimulai','berjalan','tertunda','menunggu_evaluasi')),0) AS dalamProses,
         COALESCE(SUM(status = 'selesai'),0) AS selesai,
         COALESCE(SUM(status NOT IN ('selesai','dibatalkan') AND deadline < CURDATE()),0) AS terlambat
       FROM pekerjaan`
    );
    const [[counts]] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM users) AS totalPengguna,
         (SELECT COUNT(*) FROM proyek) AS totalProyek,
         (SELECT COUNT(*) FROM rencana_pekerjaan) AS totalRencana,
         (SELECT COUNT(*) FROM evaluasi_pekerjaan) AS totalEvaluasi,
         (SELECT COUNT(*) FROM progres_log WHERE status_verifikasi = 'menunggu') AS menungguVerifikasi`
    );
    const [recentRegulations] = await pool.execute(
      `SELECT
         pk.id,
         pk.kode,
         pk.nama_pekerjaan AS nama,
         d.nama AS divisi,
         pk.progres_terverifikasi AS progres,
         CASE
           WHEN pk.status NOT IN ('selesai','dibatalkan') AND pk.deadline < CURDATE() THEN 'Terlambat'
           WHEN pk.status = 'selesai' THEN 'Selesai'
           ELSE pk.status
         END AS status
       FROM pekerjaan pk
       LEFT JOIN divisi d ON d.id = pk.divisi_id
       ORDER BY pk.updated_at DESC, pk.id DESC
       LIMIT 8`
    );
    return res.json({ ...work, ...counts, recentRegulations });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).json({ message: "Gagal mengambil ringkasan dashboard Admin." });
  }
});

async function savePlannerResource(req, res, resourceName, creating) {
  const resource = adminResources[resourceName];
  const itemId = creating ? null : Number(req.params.id);
  if (!resource || !["proyek", "rencana_pekerjaan"].includes(resourceName)) {
    return res.status(404).json({ message: "Data Planner tidak ditemukan." });
  }
  if (!creating && (!Number.isSafeInteger(itemId) || itemId < 1)) {
    return res.status(400).json({ message: "ID data tidak valid." });
  }

  const parsed = parseAdminResourceValues(resource, req.body, creating);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const values = parsed.values;
  if (creating) values.dibuat_oleh = req.plannerUserId;

  if (resourceName === "proyek" &&
      values.periode_selesai < values.periode_mulai) {
    return res.status(400).json({
      message: "Periode selesai harus sama dengan atau setelah periode mulai."
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (!creating) {
      const [ownedRows] = await connection.execute(
        `SELECT id FROM \`${resource.table}\`
         WHERE id = ? AND dibuat_oleh = ? FOR UPDATE`,
        [itemId, req.plannerUserId]
      );
      if (!ownedRows.length) {
        await connection.rollback();
        return res.status(404).json({ message: "Data tidak ditemukan." });
      }
    }

    if (resourceName === "rencana_pekerjaan") {
      const [projects] = await connection.execute(
        "SELECT id FROM proyek WHERE id = ? AND dibuat_oleh = ? LIMIT 1",
        [values.proyek_id, req.plannerUserId]
      );
      if (!projects.length) {
        await connection.rollback();
        return res.status(400).json({
          message: "Pilih proyek yang dibuat oleh akun Planner ini."
        });
      }
      if (values.rencana_asal_id !== null) {
        const [originPlans] = await connection.execute(
          "SELECT id FROM rencana_pekerjaan WHERE id = ? AND dibuat_oleh = ? LIMIT 1",
          [values.rencana_asal_id, req.plannerUserId]
        );
        if (!originPlans.length) {
          await connection.rollback();
          return res.status(400).json({
            message: "Rencana asal tidak ditemukan pada akun Planner ini."
          });
        }
      }
    }

    let id = itemId;
    if (creating) {
      const fields = Object.keys(values);
      const [result] = await connection.execute(
        `INSERT INTO \`${resource.table}\`
          (${fields.map((field) => `\`${field}\``).join(", ")})
         VALUES (${fields.map(() => "?").join(", ")})`,
        fields.map((field) => values[field])
      );
      id = result.insertId;
    } else {
      const fields = Object.keys(values).filter((field) =>
        field !== "dibuat_oleh" &&
        !resource.fields.find((item) => item.name === field)?.immutable
      );
      const [result] = await connection.execute(
        `UPDATE \`${resource.table}\`
         SET ${fields.map((field) => `\`${field}\` = ?`).join(", ")}
         WHERE id = ? AND dibuat_oleh = ?`,
        [...fields.map((field) => values[field]), itemId, req.plannerUserId]
      );
      if (result.affectedRows === 0) {
        const [existingRows] = await connection.execute(
          `SELECT id FROM \`${resource.table}\`
           WHERE id = ? AND dibuat_oleh = ? LIMIT 1`,
          [itemId, req.plannerUserId]
        );
        if (!existingRows.length) {
          await connection.rollback();
          return res.status(404).json({ message: "Data tidak ditemukan." });
        }
      }
    }

    await connection.commit();
    return res.status(creating ? 201 : 200).json({
      message: `${resource.label} berhasil ${creating ? "ditambahkan" : "diperbarui"}.`,
      id
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Kode proyek sudah digunakan." });
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
      return res.status(400).json({
        message: "Relasi data tidak valid atau data terkait tidak ditemukan."
      });
    }
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        message: `${resource.label} masih memiliki relasi dengan data lain dan tidak dapat diperbarui.`
      });
    }
    console.error(`Planner ${resource.label} save error:`, error);
    return res.status(500).json({ message: `Gagal menyimpan ${resource.label}.` });
  } finally {
    if (connection) connection.release();
  }
}

async function deletePlannerResource(req, res, resourceName) {
  const resource = adminResources[resourceName];
  const itemId = Number(req.params.id);
  if (!resource || !["proyek", "rencana_pekerjaan"].includes(resourceName)) {
    return res.status(404).json({ message: "Data Planner tidak ditemukan." });
  }
  if (!Number.isSafeInteger(itemId) || itemId < 1) {
    return res.status(400).json({ message: "ID data tidak valid." });
  }

  try {
    const [result] = await pool.execute(
      `DELETE FROM \`${resource.table}\` WHERE id = ? AND dibuat_oleh = ?`,
      [itemId, req.plannerUserId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }
    return res.json({ message: `${resource.label} berhasil dihapus.` });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        message: `${resource.label} masih digunakan oleh data lain dan tidak dapat dihapus.`
      });
    }
    console.error(`Planner ${resource.label} delete error:`, error);
    return res.status(500).json({ message: `Gagal menghapus ${resource.label}.` });
  }
}

app.post("/api/planner/projects", requirePlanner, (req, res) =>
  savePlannerResource(req, res, "proyek", true)
);
app.put("/api/planner/projects/:id", requirePlanner, (req, res) =>
  savePlannerResource(req, res, "proyek", false)
);
app.delete("/api/planner/projects/:id", requirePlanner, (req, res) =>
  deletePlannerResource(req, res, "proyek")
);
app.post("/api/planner/plans", requirePlanner, (req, res) =>
  savePlannerResource(req, res, "rencana_pekerjaan", true)
);
app.put("/api/planner/plans/:id", requirePlanner, (req, res) =>
  savePlannerResource(req, res, "rencana_pekerjaan", false)
);
app.delete("/api/planner/plans/:id", requirePlanner, (req, res) =>
  deletePlannerResource(req, res, "rencana_pekerjaan")
);

app.get("/api/admin/modules", requireAdmin, async (req, res) => {
  try {
    const lookups = await Promise.all(
      Object.entries(adminLookups).map(async ([name, sql]) => {
        const [rows] = await pool.query(sql);
        return [name, rows];
      })
    );
    return res.json({
      resources: Object.fromEntries(
        Object.entries(adminResources).map(([key, resource]) => [
          key,
          {
            label: resource.label,
            table: resource.table,
            columns: resource.columns,
            fields: resource.fields,
            readOnly: Boolean(resource.readOnly),
            editOnly: Boolean(resource.editOnly),
            createOnly: Boolean(resource.createOnly),
            deletable: Boolean(resource.deletable),
            protectedCodes: resource.protectedCodes || [],
            key: resource.key,
            composite: resource.composite || null
          }
        ])
      ),
      lookups: Object.fromEntries(lookups)
    });
  } catch (error) {
    console.error("Admin modules metadata error:", error);
    return res.status(500).json({ message: "Gagal mengambil konfigurasi modul Admin." });
  }
});

app.get("/api/admin/data/:resource", requireAdmin, async (req, res) => {
  const resource = adminResources[req.params.resource];
  if (!resource) return res.status(404).json({ message: "Modul Admin tidak ditemukan." });

  try {
    const columns = resource.columns.map((column) => `\`${column}\``).join(", ");
    const orderColumn = resource.composite?.[0] || resource.key;
    const orderBy = orderColumn === "id"
      ? ` ORDER BY \`${orderColumn}\` DESC`
      : ` ORDER BY \`${orderColumn}\``;
    const [rows] = await pool.query(
      `SELECT ${columns} FROM \`${resource.table}\`${orderBy} LIMIT 500`
    );
    return res.json({ rows });
  } catch (error) {
    console.error(`Admin ${req.params.resource} list error:`, error);
    return res.status(500).json({ message: `Gagal mengambil data ${resource.label}.` });
  }
});

function parseAdminResourceValues(resource, body, creating) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Data modul tidak valid." };
  }
  const values = {};
  for (const field of resource.fields) {
    let value = body[field.name];
    if (value === undefined) {
      if (creating && field.default !== undefined) values[field.name] = field.default;
      else if (creating && field.required) return { error: `${field.label} wajib diisi.` };
      else if (creating) values[field.name] = null;
      continue;
    }
    if (value === "" && !field.required) value = null;
    if (value === null) {
      if (field.required) return { error: `${field.label} wajib diisi.` };
      values[field.name] = null;
      continue;
    }
    if (field.type === "text" || field.type === "textarea" || field.type === "date" || field.type === "datetime") {
      if (typeof value !== "string") return { error: `${field.label} tidak valid.` };
      if (field.required && !value.trim()) return { error: `${field.label} wajib diisi.` };
      if (field.maxLength && value.length > field.maxLength) {
        return { error: `${field.label} maksimal ${field.maxLength} karakter.` };
      }
      values[field.name] = value.trim() || null;
      continue;
    }
    if (field.type === "boolean") {
      values[field.name] = value === true || value === 1 || value === "1" ? 1 : 0;
      continue;
    }
    if (field.type === "select") {
      if (!field.options.includes(value)) return { error: `Pilihan ${field.label} tidak valid.` };
      values[field.name] = value;
      continue;
    }
    if (field.type === "number" || field.type === "lookup") {
      const number = Number(value);
      if (!Number.isFinite(number) ||
          (field.integer && !Number.isSafeInteger(number)) ||
          (field.type === "lookup" && (!Number.isSafeInteger(number) || number < 1)) ||
          (field.min !== undefined && number < field.min) ||
          (field.max !== undefined && number > field.max)) {
        return { error: `${field.label} tidak valid.` };
      }
      values[field.name] = number;
    }
  }
  return { values };
}

async function saveAdminResource(req, res, creating) {
  const resource = adminResources[req.params.resource];
  if (!resource) return res.status(404).json({ message: "Modul Admin tidak ditemukan." });
  if (resource.readOnly || resource.fields.length === 0) {
    return res.status(403).json({ message: `${resource.label} bersifat hanya-baca.` });
  }
  if (!creating && resource.createOnly) {
    return res.status(403).json({ message: `${resource.label} hanya dapat ditambahkan, bukan diperbarui.` });
  }
  if (creating && resource.editOnly) {
    return res.status(403).json({ message: `${resource.label} hanya dapat diperbarui, bukan ditambahkan.` });
  }

  const parsed = parseAdminResourceValues(resource, req.body, creating);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const values = parsed.values;
  if (resource.createdBy && creating) values.dibuat_oleh = req.adminUserId;

  const itemId = req.params.id;
  if (!creating) {
    if (resource.composite) {
      const compositeId = String(itemId).split(":");
      if (compositeId.length !== resource.composite.length ||
          compositeId.some((part) => !Number.isSafeInteger(Number(part)) || Number(part) < 1)) {
        return res.status(400).json({ message: "ID data tidak valid." });
      }
      for (const [index, key] of resource.composite.entries()) {
        if (Number(values[key]) !== Number(compositeId[index])) {
          return res.status(400).json({ message: "Kunci utama data evaluasi tidak dapat diubah." });
        }
      }
    } else if (resource.key === "id" &&
        (!Number.isSafeInteger(Number(itemId)) || Number(itemId) < 1)) {
      return res.status(400).json({ message: "ID data tidak valid." });
    } else if (resource.key !== "id" &&
        (!itemId || itemId.length > 50 || itemId !== values[resource.key])) {
      return res.status(400).json({ message: "Kunci pengaturan tidak valid atau tidak dapat diubah." });
    }
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    let id = itemId;

    if (creating) {
      const fields = Object.keys(values);
      const placeholders = fields.map(() => "?").join(", ");
      const [result] = await connection.execute(
        `INSERT INTO \`${resource.table}\` (${fields.map((field) => `\`${field}\``).join(", ")})
         VALUES (${placeholders})`,
        fields.map((field) => values[field])
      );
      id = resource.key === "id" ? result.insertId : values[resource.key];
      if (resource.tracksStatus && values.status) {
        await connection.execute(
          `INSERT INTO pekerjaan_status_log (pekerjaan_id, status_lama, status_baru, diubah_oleh)
           VALUES (?, NULL, ?, ?)`,
          [id, values.status, req.adminUserId]
        );
      }
    } else {
      const fields = Object.keys(values).filter((field) =>
        !resource.composite?.includes(field) &&
        !resource.fields.find((item) => item.name === field)?.immutable
      );
      if (fields.length) {
        const keyWhere = resource.composite
          ? resource.composite.map((field) => `\`${field}\` = ?`).join(" AND ")
          : `\`${resource.key}\` = ?`;
        const keyValues = resource.composite
          ? String(itemId).split(":").map(Number)
          : [itemId];
        let oldStatus = null;
        if (resource.tracksStatus && values.status) {
          const [oldRows] = await connection.execute(
            "SELECT status FROM pekerjaan WHERE id = ? FOR UPDATE",
            [itemId]
          );
          if (!oldRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Data tidak ditemukan." });
          }
          oldStatus = oldRows[0].status;
        }
        if (req.params.resource === "progres_log") {
          const [progressRows] = await connection.execute(
            `SELECT pl.pekerjaan_id, pl.nilai_progres, pl.status_verifikasi,
                    pk.penanggung_jawab_id, pk.kode, pk.nama_pekerjaan
             FROM progres_log pl
             JOIN pekerjaan pk ON pk.id = pl.pekerjaan_id
             WHERE pl.id = ? FOR UPDATE`,
            [itemId]
          );
          if (!progressRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Laporan progres tidak ditemukan." });
          }
          const progress = progressRows[0];
          await connection.execute(
            `UPDATE progres_log
             SET status_verifikasi = ?, catatan_verifikasi = ?,
                 diverifikasi_oleh = ?,
                 tgl_verifikasi = IF(? = 'menunggu', NULL, CURRENT_TIMESTAMP)
             WHERE id = ?`,
            [
              values.status_verifikasi,
              values.catatan_verifikasi,
              values.status_verifikasi === "menunggu" ? null : req.adminUserId,
              values.status_verifikasi,
              itemId
            ]
          );
          const [verifiedRows] = await connection.execute(
            `SELECT nilai_progres
             FROM progres_log
             WHERE pekerjaan_id = ? AND status_verifikasi = 'disetujui'
             ORDER BY tanggal_update DESC, id DESC
             LIMIT 1`,
            [progress.pekerjaan_id]
          );
          await connection.execute(
            `UPDATE pekerjaan
             SET progres_terverifikasi = ?
             WHERE id = ?`,
            [verifiedRows.length ? verifiedRows[0].nilai_progres : 0, progress.pekerjaan_id]
          );
          if (values.status_verifikasi === "dikembalikan" &&
              progress.status_verifikasi !== "dikembalikan") {
            const message = values.catatan_verifikasi
              ? `Progres pekerjaan ${progress.kode} dikembalikan: ${values.catatan_verifikasi}`.slice(0, 255)
              : `Progres pekerjaan ${progress.kode} perlu diperbaiki.`;
            await connection.execute(
              `INSERT INTO notifikasi (user_id, pekerjaan_id, tipe, pesan)
               VALUES (?, ?, 'progres_dikembalikan', ?)`,
              [progress.penanggung_jawab_id, progress.pekerjaan_id, message]
            );
          }
          await connection.commit();
          return res.json({
            message: `Progres ${progress.kode} berhasil ${values.status_verifikasi === "disetujui" ? "disetujui" : values.status_verifikasi === "dikembalikan" ? "dikembalikan" : "diperbarui"}.`,
            id: itemId
          });
        }
        const [result] = await connection.execute(
          `UPDATE \`${resource.table}\`
           SET ${fields.map((field) => `\`${field}\` = ?`).join(", ")}
           WHERE ${keyWhere}`,
          [...fields.map((field) => values[field]), ...keyValues]
        );
        if (result.affectedRows === 0) {
          const [existing] = await connection.execute(
            `SELECT 1 FROM \`${resource.table}\` WHERE ${keyWhere} LIMIT 1`,
            keyValues
          );
          if (!existing.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Data tidak ditemukan." });
          }
        }
        if (resource.tracksStatus && oldStatus && oldStatus !== values.status) {
          await connection.execute(
            `INSERT INTO pekerjaan_status_log
              (pekerjaan_id, status_lama, status_baru, diubah_oleh)
             VALUES (?, ?, ?, ?)`,
            [itemId, oldStatus, values.status, req.adminUserId]
          );
        }
      }
    }
    await connection.commit();
    return res.status(creating ? 201 : 200).json({
      message: `${resource.label} berhasil ${creating ? "ditambahkan" : "diperbarui"}.`,
      id
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Data dengan kode atau kunci tersebut sudah ada." });
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
      return res.status(400).json({ message: "Relasi data tidak valid atau data terkait tidak ditemukan." });
    }
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({ message: "Data masih digunakan oleh relasi lain dan tidak dapat diubah." });
    }
    console.error(`Admin ${resource.label} save error:`, error);
    return res.status(500).json({ message: `Gagal menyimpan ${resource.label}.` });
  } finally {
    if (connection) connection.release();
  }
}

app.post("/api/admin/data/:resource", requireAdmin, (req, res) =>
  saveAdminResource(req, res, true)
);

app.put("/api/admin/data/:resource/:id", requireAdmin, (req, res) =>
  saveAdminResource(req, res, false)
);

app.delete("/api/admin/data/:resource/:id", requireAdmin, async (req, res) => {
  const resource = adminResources[req.params.resource];
  if (!resource) return res.status(404).json({ message: "Modul Admin tidak ditemukan." });
  if (!resource.deletable || resource.key !== "id") {
    return res.status(403).json({ message: `${resource.label} tidak dapat dihapus.` });
  }

  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "ID data tidak valid." });
  }

  try {
    if (resource.protectedCodes?.length) {
      const [protectedRows] = await pool.execute(
        `SELECT kode FROM \`${resource.table}\`
         WHERE id = ? AND kode IN (${resource.protectedCodes.map(() => "?").join(", ")})
         LIMIT 1`,
        [id, ...resource.protectedCodes]
      );
      if (protectedRows.length) {
        return res.status(409).json({
          message: "Role bawaan sistem tidak dapat dihapus."
        });
      }
    }

    const [result] = await pool.execute(
      `DELETE FROM \`${resource.table}\` WHERE \`${resource.key}\` = ?`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    return res.json({ message: `${resource.label} berhasil dihapus.` });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        message: `${resource.label} masih digunakan oleh data lain dan tidak dapat dihapus.`
      });
    }
    console.error(`Admin ${resource.label} delete error:`, error);
    return res.status(500).json({ message: `Gagal menghapus ${resource.label}.` });
  }
});

app.get("/api/admin/reports", requireAdmin, async (req, res) => {
  try {
    const [projects] = await pool.query(
      `SELECT * FROM v_ringkasan_proyek ORDER BY tahun DESC, nama_proyek ASC`
    );
    const [deadlines] = await pool.query(
      `SELECT * FROM v_monitoring_deadline
       WHERE kondisi_deadline IN ('terlambat','perlu_perhatian')
       ORDER BY sisa_hari ASC, kode ASC LIMIT 200`
    );
    return res.json({ projects, deadlines });
  } catch (error) {
    console.error("Admin reports error:", error);
    return res.status(500).json({ message: "Gagal mengambil laporan SIMON." });
  }
});

app.get("/api/planner/dashboard", requirePlanner, async (req, res) => {
  try {
    const [summaryRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total_rencana,
         COALESCE(SUM(rp.status = 'draft'), 0) AS rencana_draft,
         COALESCE(SUM(rp.status IN ('disetujui', 'berjalan')), 0) AS rencana_berjalan,
         COALESCE(SUM(rp.status = 'selesai'), 0) AS rencana_selesai
       FROM rencana_pekerjaan rp
       WHERE rp.dibuat_oleh = ?`,
      [req.plannerUserId]
    );
    const [projectRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total_proyek,
         COALESCE(SUM(pr.status = 'aktif'), 0) AS proyek_aktif
       FROM proyek pr
       WHERE pr.dibuat_oleh = ?`,
      [req.plannerUserId]
    );
    const [plans] = await pool.execute(
      `SELECT
         rp.id,
         rp.proyek_id,
         rp.rencana_asal_id,
         rp.tipe_rencana,
         rp.tahun_plan,
         rp.jangka,
         rp.jenis_id,
         rp.fungsi_id,
         rp.prioritas_id,
         rp.judul,
         rp.ruang_lingkup,
         rp.target,
         rp.dasar_permintaan,
         rp.media_permintaan,
         rp.status,
         rp.tgl_rencana_mulai,
         rp.durasi_hari,
         rp.tgl_rencana_selesai,
         rp.pic_awal_id,
         rp.alasan_batal,
         rp.updated_at,
         pr.kode AS kode_proyek,
         pr.nama AS nama_proyek,
         jp.nama AS jenis_pekerjaan,
         f.nama AS fungsi,
         p.nama AS prioritas,
         COALESCE(work.jumlah_pekerjaan, 0) AS jumlah_pekerjaan,
         COALESCE(work.rata_progres, 0) AS rata_progres
       FROM rencana_pekerjaan rp
       JOIN proyek pr ON pr.id = rp.proyek_id
       JOIN jenis_pekerjaan jp ON jp.id = rp.jenis_id
       LEFT JOIN fungsi f ON f.id = rp.fungsi_id
       JOIN prioritas p ON p.id = rp.prioritas_id
       LEFT JOIN (
         SELECT
           rencana_id,
           COUNT(*) AS jumlah_pekerjaan,
           ROUND(AVG(progres_terverifikasi)) AS rata_progres
         FROM pekerjaan
         WHERE rencana_id IS NOT NULL
         GROUP BY rencana_id
       ) work ON work.rencana_id = rp.id
       WHERE rp.dibuat_oleh = ?
       ORDER BY rp.updated_at DESC, rp.id DESC
      `,
      [req.plannerUserId]
    );
    const [projects] = await pool.execute(
      `SELECT
         pr.id,
         pr.kode,
         pr.nama,
         pr.deskripsi,
         pr.tahun,
         pr.status,
         pr.periode_mulai,
         pr.periode_selesai,
         pr.target_jumlah,
         COALESCE(plan_counts.jumlah_rencana, 0) AS jumlah_rencana
       FROM proyek pr
       LEFT JOIN (
         SELECT proyek_id, COUNT(*) AS jumlah_rencana
         FROM rencana_pekerjaan
         WHERE dibuat_oleh = ?
         GROUP BY proyek_id
       ) plan_counts ON plan_counts.proyek_id = pr.id
       WHERE pr.dibuat_oleh = ?
       ORDER BY
         CASE pr.status WHEN 'aktif' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
         pr.tahun DESC,
         pr.updated_at DESC`,
      [req.plannerUserId, req.plannerUserId]
    );
    const [jenisPekerjaan] = await pool.execute(
      "SELECT id, kode, nama FROM jenis_pekerjaan WHERE aktif = 1 ORDER BY nama"
    );
    const [fungsi] = await pool.execute(
      "SELECT id, nama FROM fungsi WHERE aktif = 1 ORDER BY nama"
    );
    const [prioritas] = await pool.execute(
      "SELECT id, nama FROM prioritas ORDER BY id"
    );
    const [staff] = await pool.execute(
      `SELECT u.id, u.nama, u.username
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.aktif = 1 AND r.kode = 'staff'
       ORDER BY u.nama`
    );

    return res.json({
      summary: {
        ...summaryRows[0],
        ...projectRows[0]
      },
      plans,
      projects,
      options: { jenisPekerjaan, fungsi, prioritas, staff }
    });
  } catch (error) {
    console.error("Planner dashboard error:", error);
    return res.status(500).json({
      message: "Gagal mengambil ringkasan dashboard planner."
    });
  }
});

app.get("/api/staff/dashboard", requireStaff, async (req, res) => {
  try {
    const [summaryRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total_pekerjaan,
         COALESCE(SUM(pk.status IN ('belum_dimulai', 'berjalan', 'tertunda')), 0) AS pekerjaan_aktif,
         COALESCE(SUM(pk.status = 'menunggu_evaluasi'), 0) AS menunggu_evaluasi,
         COALESCE(SUM(pk.status = 'selesai'), 0) AS pekerjaan_selesai,
         COALESCE(SUM(
           pk.status NOT IN ('selesai', 'dibatalkan')
           AND pk.deadline < CURDATE()
         ), 0) AS pekerjaan_terlambat,
         COALESCE(SUM(
           pk.status NOT IN ('selesai', 'dibatalkan')
           AND pk.deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         ), 0) AS deadline_mendekat
       FROM pekerjaan pk
       WHERE pk.penanggung_jawab_id = ?`,
      [req.staffUserId]
    );

    const [attentionRows] = await pool.execute(
      `SELECT
         COALESCE(SUM(latest.status_verifikasi = 'dikembalikan'), 0) AS progres_dikembalikan,
         COALESCE(SUM(latest.status_verifikasi = 'menunggu'), 0) AS progres_menunggu
       FROM (
         SELECT pl.status_verifikasi
         FROM progres_log pl
         JOIN (
           SELECT pekerjaan_id, MAX(id) AS latest_id
           FROM progres_log
           GROUP BY pekerjaan_id
         ) latest_ids ON latest_ids.latest_id = pl.id
         JOIN pekerjaan pk ON pk.id = pl.pekerjaan_id
         WHERE pk.penanggung_jawab_id = ?
       ) latest`,
      [req.staffUserId]
    );

    const [weeklyProgressRows] = await pool.execute(
      `SELECT
         COUNT(*) AS diajukan,
         COALESCE(SUM(status_verifikasi = 'disetujui'), 0) AS disetujui
       FROM progres_log
       WHERE diperbarui_oleh = ?
         AND tanggal_update >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
         AND tanggal_update <= CURDATE()`,
      [req.staffUserId]
    );

    const [tasks] = await pool.execute(
      `SELECT
         pk.id,
         pk.kode,
         pk.nama_pekerjaan,
         pk.deskripsi,
         pk.tgl_mulai,
         pk.deadline,
         pk.progres_terakhir,
         pk.progres_terverifikasi,
         pk.status,
         pk.nomor_dokumen,
         pk.supervisor_id,
         pr.kode AS kode_proyek,
         pr.nama AS nama_proyek,
         p.nama AS prioritas,
         f.nama AS fungsi,
         d.nama AS divisi,
         s.nama AS supervisor_nama,
         latest.nilai_progres AS progres_terbaru,
         latest.status_verifikasi AS status_verifikasi_terbaru,
         latest.tanggal_update AS progres_diperbarui,
         approved.nilai_progres AS progres_disetujui_terakhir,
         approved.tanggal_update AS progres_disetujui_tanggal,
         approved.catatan AS catatan_progres_disetujui,
         approver.nama AS progres_disetujui_oleh,
         (
           SELECT pt.tahapan_id
           FROM pekerjaan_tahapan pt
           WHERE pt.pekerjaan_id = pk.id
           ORDER BY pt.tanggal DESC, pt.id DESC
           LIMIT 1
         ) AS tahapan_saat_ini
       FROM pekerjaan pk
       JOIN proyek pr ON pr.id = pk.proyek_id
       JOIN prioritas p ON p.id = pk.prioritas_id
       LEFT JOIN fungsi f ON f.id = pk.fungsi_id
       LEFT JOIN divisi d ON d.id = pk.divisi_id
       LEFT JOIN users s ON s.id = pk.supervisor_id
       LEFT JOIN (
         SELECT pl.pekerjaan_id, pl.nilai_progres, pl.status_verifikasi, pl.tanggal_update
         FROM progres_log pl
         JOIN (
           SELECT pekerjaan_id, MAX(id) AS latest_id
           FROM progres_log
           WHERE diperbarui_oleh = ?
           GROUP BY pekerjaan_id
         ) latest_ids ON latest_ids.latest_id = pl.id
       ) latest ON latest.pekerjaan_id = pk.id
       LEFT JOIN (
         SELECT pl.pekerjaan_id, pl.nilai_progres, pl.tanggal_update,
                pl.catatan, pl.diverifikasi_oleh
         FROM progres_log pl
         JOIN (
           SELECT pekerjaan_id, MAX(id) AS latest_id
           FROM progres_log
           WHERE status_verifikasi = 'disetujui'
           GROUP BY pekerjaan_id
         ) approved_ids ON approved_ids.latest_id = pl.id
       ) approved ON approved.pekerjaan_id = pk.id
       LEFT JOIN users approver ON approver.id = approved.diverifikasi_oleh
       WHERE pk.penanggung_jawab_id = ?
       ORDER BY
         CASE
           WHEN pk.status NOT IN ('selesai', 'dibatalkan') AND pk.deadline < CURDATE() THEN 0
           WHEN pk.status IN ('belum_dimulai', 'berjalan', 'tertunda', 'menunggu_evaluasi') THEN 1
           ELSE 2
         END,
         pk.deadline ASC,
         pk.updated_at DESC
      `,
      [req.staffUserId, req.staffUserId]
    );

    const [stages] = await pool.execute(
      `SELECT id, nama, urutan
       FROM tahapan
       WHERE aktif = 1
       ORDER BY urutan, nama`
    );

    const [notifications] = await pool.execute(
      `SELECT
         n.id,
         n.tipe,
         n.pesan,
         n.dibaca_at,
         n.created_at,
         n.pekerjaan_id,
         pk.kode AS kode_pekerjaan,
         pk.nama_pekerjaan
       FROM notifikasi n
       LEFT JOIN pekerjaan pk ON pk.id = n.pekerjaan_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 6`,
      [req.staffUserId]
    );

    const [progressHistory] = await pool.execute(
      `SELECT
         pl.id,
         pl.pekerjaan_id,
         pl.nilai_progres,
         pl.tanggal_update,
         pl.catatan,
         pl.status_verifikasi,
         pl.catatan_verifikasi,
         pl.tgl_verifikasi,
         pl.created_at,
         pk.kode AS kode_pekerjaan,
         pk.nama_pekerjaan,
         verifier.nama AS diverifikasi_oleh_nama,
         (
           SELECT COUNT(*)
           FROM lampiran la
           WHERE la.progres_log_id = pl.id
         ) AS jumlah_lampiran
       FROM progres_log pl
       JOIN pekerjaan pk ON pk.id = pl.pekerjaan_id
       LEFT JOIN users verifier ON verifier.id = pl.diverifikasi_oleh
       WHERE pk.penanggung_jawab_id = ?
         AND pl.diperbarui_oleh = ?
       ORDER BY pl.created_at DESC, pl.id DESC
       LIMIT 20`,
      [req.staffUserId, req.staffUserId]
    );

    const [progressAttachments] = await pool.execute(
      `SELECT la.id, la.progres_log_id, la.nama_file
       FROM lampiran la
       JOIN progres_log pl ON pl.id = la.progres_log_id
       JOIN pekerjaan pk ON pk.id = pl.pekerjaan_id
       WHERE pk.penanggung_jawab_id = ?
         AND pl.diperbarui_oleh = ?
       ORDER BY la.id`,
      [req.staffUserId, req.staffUserId]
    );
    const attachmentsByProgress = new Map();
    for (const attachment of progressAttachments) {
      const progressId = Number(attachment.progres_log_id);
      const attachments = attachmentsByProgress.get(progressId) || [];
      attachments.push({ id: attachment.id, nama_file: attachment.nama_file });
      attachmentsByProgress.set(progressId, attachments);
    }

    return res.json({
      summary: {
        ...summaryRows[0],
        ...attentionRows[0],
        progres_minggu_ini: weeklyProgressRows[0].diajukan,
        progres_disetujui_minggu_ini: weeklyProgressRows[0].disetujui
      },
      tasks,
      notifications,
      progressHistory: progressHistory.map((item) => ({
        ...item,
        lampiran: attachmentsByProgress.get(Number(item.id)) || []
      })),
      stages
    });
  } catch (error) {
    console.error("Staff dashboard error:", error);
    return res.status(500).json({
      message: "Gagal mengambil ringkasan dashboard staff."
    });
  }
});

app.get("/api/staff/tasks/:id/progress-history", requireStaff, async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isSafeInteger(taskId) || taskId < 1) {
    return res.status(400).json({ message: "ID pekerjaan tidak valid." });
  }

  try {
    const [tasks] = await pool.execute(
      `SELECT id
       FROM pekerjaan
       WHERE id = ? AND penanggung_jawab_id = ?
       LIMIT 1`,
      [taskId, req.staffUserId]
    );
    if (!tasks.length) {
      return res.status(404).json({ message: "Pekerjaan tidak ditemukan." });
    }

    const [history] = await pool.execute(
      `SELECT
         pl.id,
         pl.pekerjaan_id,
         pl.nilai_progres,
         pl.tanggal_update,
         pl.catatan,
         pl.status_verifikasi,
         pl.catatan_verifikasi,
         pl.tgl_verifikasi,
         updater.nama AS diperbarui_oleh_nama,
         verifier.nama AS diverifikasi_oleh_nama,
         (
           SELECT COUNT(*)
           FROM lampiran la
           WHERE la.progres_log_id = pl.id
         ) AS jumlah_lampiran
       FROM progres_log pl
       JOIN pekerjaan pk ON pk.id = pl.pekerjaan_id
       LEFT JOIN users updater ON updater.id = pl.diperbarui_oleh
       LEFT JOIN users verifier ON verifier.id = pl.diverifikasi_oleh
       WHERE pl.pekerjaan_id = ?
         AND pk.penanggung_jawab_id = ?
         AND pl.diperbarui_oleh = ?
       ORDER BY pl.tanggal_update, pl.id`,
      [taskId, req.staffUserId, req.staffUserId]
    );

    const [attachments] = await pool.execute(
      `SELECT la.id, la.progres_log_id, la.nama_file
       FROM lampiran la
       JOIN progres_log pl ON pl.id = la.progres_log_id
       JOIN pekerjaan pk ON pk.id = pl.pekerjaan_id
       WHERE pl.pekerjaan_id = ?
         AND pk.penanggung_jawab_id = ?
         AND pl.diperbarui_oleh = ?
       ORDER BY la.id`,
      [taskId, req.staffUserId, req.staffUserId]
    );
    const attachmentsByProgress = new Map();
    for (const attachment of attachments) {
      const progressId = Number(attachment.progres_log_id);
      const progressAttachments = attachmentsByProgress.get(progressId) || [];
      progressAttachments.push({
        id: attachment.id,
        nama_file: attachment.nama_file
      });
      attachmentsByProgress.set(progressId, progressAttachments);
    }

    return res.json({
      history: history.map((item) => ({
        ...item,
        lampiran: attachmentsByProgress.get(Number(item.id)) || []
      }))
    });
  } catch (error) {
    console.error("Staff task progress history error:", error);
    return res.status(500).json({
      message: "Gagal mengambil riwayat progres pekerjaan."
    });
  }
});

app.post("/api/staff/tasks/:id/progress", requireStaff, parseProgressUpload, async (req, res) => {
  const taskId = Number(req.params.id);
  const progress = Number(req.body?.nilai_progres);
  const stageId = Number(req.body?.tahapan_id);
  const updateDate = String(req.body?.tanggal_update || "");
  const detail = typeof req.body?.catatan === "string"
    ? req.body.catatan.trim()
    : "";
  const obstacle = typeof req.body?.kendala === "string"
    ? req.body.kendala.trim()
    : "";
  const nextStep = typeof req.body?.rencana_tindak_lanjut === "string"
    ? req.body.rencana_tindak_lanjut.trim()
    : "";

  if (!Number.isSafeInteger(taskId) || taskId < 1) {
    return res.status(400).json({ message: "ID pekerjaan tidak valid." });
  }
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    return res.status(400).json({
      message: "Progres harus berupa bilangan bulat antara 0 sampai 100."
    });
  }
  if (!Number.isSafeInteger(stageId) || stageId < 1) {
    return res.status(400).json({ message: "Tahapan pekerjaan wajib dipilih." });
  }
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(updateDate)
    ? new Date(`${updateDate}T00:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== updateDate) {
    return res.status(400).json({ message: "Tanggal update tidak valid." });
  }
  if (!detail) {
    return res.status(400).json({ message: "Catatan progres wajib diisi." });
  }
  const noteParts = [
    `Detail: ${detail}`,
    obstacle ? `Kendala: ${obstacle}` : "",
    nextStep ? `Rencana tindak lanjut: ${nextStep}` : ""
  ].filter(Boolean);
  const note = noteParts.join("\n\n");
  if (note.length > 5000) {
    return res.status(400).json({
      message: "Catatan progres maksimal 5000 karakter."
    });
  }

  let connection;
  let savedFilePath = "";
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [todayRows] = await connection.execute(
      "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today"
    );
    if (updateDate > todayRows[0].today) {
      await connection.rollback();
      return res.status(400).json({ message: "Tanggal update tidak boleh melebihi hari ini." });
    }

    const [tasks] = await connection.execute(
      `SELECT id, kode, status, progres_terverifikasi
       FROM pekerjaan
       WHERE id = ? AND penanggung_jawab_id = ?
       FOR UPDATE`,
      [taskId, req.staffUserId]
    );
    if (!tasks.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Pekerjaan tidak ditemukan." });
    }

    const task = tasks[0];
    if (["selesai", "dibatalkan"].includes(task.status)) {
      await connection.rollback();
      return res.status(409).json({
        message: "Progres tidak dapat diperbarui untuk pekerjaan yang sudah selesai atau dibatalkan."
      });
    }
    if (progress < Number(task.progres_terverifikasi)) {
      await connection.rollback();
      return res.status(400).json({
        message: `Progres baru tidak boleh lebih rendah dari progres terverifikasi (${task.progres_terverifikasi}%).`
      });
    }

    const [stages] = await connection.execute(
      "SELECT id, nama FROM tahapan WHERE id = ? AND aktif = 1 LIMIT 1",
      [stageId]
    );
    if (!stages.length) {
      await connection.rollback();
      return res.status(400).json({ message: "Tahapan yang dipilih tidak tersedia." });
    }

    let newStatus = task.status;
    if (progress === 100) {
      newStatus = "menunggu_evaluasi";
    } else if (task.status === "menunggu_evaluasi") {
      newStatus = "berjalan";
    } else if (task.status === "belum_dimulai" && progress > 0) {
      newStatus = "berjalan";
    }

    const [progressResult] = await connection.execute(
      `INSERT INTO progres_log
         (pekerjaan_id, tanggal_update, nilai_progres, catatan, diperbarui_oleh)
       VALUES (?, ?, ?, ?, ?)`,
      [taskId, updateDate, progress, note, req.staffUserId]
    );
    const progressLogId = Number(progressResult.insertId);

    await connection.execute(
      `INSERT INTO pekerjaan_tahapan (pekerjaan_id, tahapan_id, tanggal, catatan)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tanggal = VALUES(tanggal), catatan = VALUES(catatan)`,
      [taskId, stageId, updateDate, `Tahapan progres ${progress}%`]
    );

    if (req.file) {
      await fs.mkdir(progressUploadDirectory, { recursive: true });
      const extension = path.extname(req.file.originalname).toLowerCase();
      const fileName = `${randomUUID()}${extension}`;
      savedFilePath = path.join(progressUploadDirectory, fileName);
      await fs.writeFile(savedFilePath, req.file.buffer, { flag: "wx" });
      const storedPath = path.relative(backendDirectory, savedFilePath);
      await connection.execute(
        `INSERT INTO lampiran
           (pekerjaan_id, progres_log_id, nama_file, path_file, mime_type,
            ukuran_byte, keterangan, diunggah_oleh)
         VALUES (?, ?, ?, ?, ?, ?, 'Lampiran pembaruan progres', ?)`,
        [
          taskId,
          progressLogId,
          path.basename(req.file.originalname).slice(0, 255),
          storedPath,
          req.file.mimetype,
          req.file.size,
          req.staffUserId
        ]
      );
    }

    await connection.execute(
      `UPDATE pekerjaan
       SET progres_terakhir = ?, status = ?
       WHERE id = ?`,
      [progress, newStatus, taskId]
    );
    if (newStatus !== task.status) {
      await connection.execute(
        `INSERT INTO pekerjaan_status_log
           (pekerjaan_id, status_lama, status_baru, diubah_oleh)
         VALUES (?, ?, ?, ?)`,
        [taskId, task.status, newStatus, req.staffUserId]
      );
    }

    await connection.commit();
    return res.status(201).json({
      message: "Progres pekerjaan berhasil diperbarui.",
      id: taskId,
      progressLogId
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (savedFilePath) {
      try {
        await fs.unlink(savedFilePath);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error("Staff progress attachment cleanup error:", cleanupError);
        }
      }
    }
    console.error("Staff progress update error:", error);
    return res.status(500).json({
      message: "Gagal memperbarui progres pekerjaan."
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/api/staff/progress-attachments/:id", requireStaff, async (req, res) => {
  const attachmentId = Number(req.params.id);
  if (!Number.isSafeInteger(attachmentId) || attachmentId < 1) {
    return res.status(400).json({ message: "ID lampiran tidak valid." });
  }

  try {
    const [attachments] = await pool.execute(
      `SELECT la.nama_file, la.path_file
       FROM lampiran la
       JOIN progres_log pl ON pl.id = la.progres_log_id
       JOIN pekerjaan pk ON pk.id = pl.pekerjaan_id
       WHERE la.id = ?
         AND pk.penanggung_jawab_id = ?
         AND pl.diperbarui_oleh = ?
       LIMIT 1`,
      [attachmentId, req.staffUserId, req.staffUserId]
    );
    if (!attachments.length) {
      return res.status(404).json({ message: "Lampiran tidak ditemukan." });
    }

    const filePath = path.resolve(backendDirectory, attachments[0].path_file);
    if (!filePath.startsWith(`${progressUploadDirectory}${path.sep}`)) {
      return res.status(404).json({ message: "Lampiran tidak ditemukan." });
    }
    await fs.access(filePath);
    return res.download(filePath, attachments[0].nama_file);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ message: "File lampiran tidak ditemukan." });
    }
    console.error("Staff progress attachment error:", error);
    return res.status(500).json({ message: "Gagal mengambil lampiran progres." });
  }
});

app.get("/api/supervisor/dashboard", requireSupervisor, async (req, res) => {
  try {
    const [summaryRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total_pekerjaan,
         COALESCE(SUM(pk.status IN ('belum_dimulai', 'berjalan', 'tertunda')), 0) AS pekerjaan_aktif,
         COALESCE(SUM(pk.status = 'menunggu_evaluasi'), 0) AS menunggu_evaluasi,
         COALESCE(SUM(pk.status = 'selesai'), 0) AS pekerjaan_selesai,
         COALESCE(SUM(
           pk.status NOT IN ('selesai', 'dibatalkan')
           AND pk.deadline < CURDATE()
         ), 0) AS pekerjaan_terlambat,
         (
           SELECT COUNT(*)
           FROM progres_log pl
           JOIN pekerjaan review_task ON review_task.id = pl.pekerjaan_id
           WHERE review_task.supervisor_id = ?
             AND pl.status_verifikasi = 'menunggu'
         ) AS menunggu_verifikasi,
         (
           SELECT COUNT(*)
           FROM users team_staff
           JOIN roles team_role ON team_role.id = team_staff.role_id
           WHERE team_staff.supervisor_id = ?
             AND team_staff.aktif = 1
             AND team_role.kode = 'staff'
         ) AS jumlah_staff
       FROM pekerjaan pk
       WHERE pk.supervisor_id = ?`,
      [req.supervisorUserId, req.supervisorUserId, req.supervisorUserId]
    );

    const [tasks] = await pool.execute(
      `SELECT
         pk.id,
         pk.kode,
         pk.nama_pekerjaan,
         pk.deadline,
         pk.progres_terakhir,
         pk.progres_terverifikasi,
         pk.status,
         pr.kode AS kode_proyek,
         pr.nama AS nama_proyek,
         p.nama AS prioritas,
         d.nama AS divisi,
         staff.nama AS staff_nama,
         latest.nilai_progres AS progres_terbaru,
         latest.status_verifikasi AS status_verifikasi_terbaru,
         latest.tanggal_update AS progres_diperbarui
       FROM pekerjaan pk
       JOIN proyek pr ON pr.id = pk.proyek_id
       JOIN prioritas p ON p.id = pk.prioritas_id
       LEFT JOIN divisi d ON d.id = pk.divisi_id
       JOIN users staff ON staff.id = pk.penanggung_jawab_id
       LEFT JOIN (
         SELECT pl.pekerjaan_id, pl.nilai_progres, pl.status_verifikasi, pl.tanggal_update
         FROM progres_log pl
         JOIN (
           SELECT pekerjaan_id, MAX(id) AS latest_id
           FROM progres_log
           GROUP BY pekerjaan_id
         ) latest_ids ON latest_ids.latest_id = pl.id
       ) latest ON latest.pekerjaan_id = pk.id
       WHERE pk.supervisor_id = ?
       ORDER BY
         CASE
           WHEN pk.status NOT IN ('selesai', 'dibatalkan') AND pk.deadline < CURDATE() THEN 0
           WHEN latest.status_verifikasi = 'menunggu' THEN 1
           WHEN pk.status IN ('belum_dimulai', 'berjalan', 'tertunda', 'menunggu_evaluasi') THEN 2
           ELSE 3
         END,
         pk.deadline ASC,
         pk.updated_at DESC
       LIMIT 12`,
      [req.supervisorUserId]
    );

    const [notifications] = await pool.execute(
      `SELECT
         n.id,
         n.tipe,
         n.pesan,
         n.dibaca_at,
         n.created_at,
         n.pekerjaan_id,
         pk.kode AS kode_pekerjaan,
         pk.nama_pekerjaan
       FROM notifikasi n
       LEFT JOIN pekerjaan pk ON pk.id = n.pekerjaan_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 6`,
      [req.supervisorUserId]
    );

    const [team] = await pool.execute(
      `SELECT
         staff.id,
         staff.nama,
         staff.username,
         d.nama AS divisi,
         (
           SELECT COUNT(*)
           FROM pekerjaan assigned
           WHERE assigned.penanggung_jawab_id = staff.id
             AND assigned.supervisor_id = ?
         ) AS total_pekerjaan,
         (
           SELECT COUNT(*)
           FROM pekerjaan assigned
           WHERE assigned.penanggung_jawab_id = staff.id
             AND assigned.supervisor_id = ?
             AND assigned.status IN ('belum_dimulai', 'berjalan', 'tertunda')
         ) AS pekerjaan_aktif,
         (
           SELECT COUNT(*)
           FROM pekerjaan assigned
           WHERE assigned.penanggung_jawab_id = staff.id
             AND assigned.supervisor_id = ?
             AND assigned.status NOT IN ('selesai', 'dibatalkan')
             AND assigned.deadline < CURDATE()
         ) AS pekerjaan_terlambat,
         (
           SELECT MAX(pl.created_at)
           FROM progres_log pl
           JOIN pekerjaan assigned ON assigned.id = pl.pekerjaan_id
           WHERE assigned.penanggung_jawab_id = staff.id
             AND assigned.supervisor_id = ?
         ) AS progres_terakhir
       FROM users staff
       JOIN roles staff_role ON staff_role.id = staff.role_id
       LEFT JOIN divisi d ON d.id = staff.divisi_id
       WHERE staff.supervisor_id = ?
         AND staff.aktif = 1
         AND staff_role.kode = 'staff'
       ORDER BY staff.nama ASC
       LIMIT 20`,
      [
        req.supervisorUserId,
        req.supervisorUserId,
        req.supervisorUserId,
        req.supervisorUserId,
        req.supervisorUserId
      ]
    );

    const [updates] = await pool.execute(
      `SELECT
         pl.id,
         pl.pekerjaan_id,
         pl.nilai_progres,
         pl.tanggal_update,
         pl.catatan,
         pl.status_verifikasi,
         pl.catatan_verifikasi,
         pl.created_at,
         pk.kode AS kode_pekerjaan,
         pk.nama_pekerjaan,
         pk.progres_terverifikasi,
         pr.kode AS kode_proyek,
         pr.nama AS nama_proyek,
         staff.nama AS staff_nama,
         (
           SELECT COUNT(*)
           FROM lampiran la
           WHERE la.progres_log_id = pl.id
         ) AS jumlah_lampiran
       FROM progres_log pl
       JOIN pekerjaan pk ON pk.id = pl.pekerjaan_id
       JOIN proyek pr ON pr.id = pk.proyek_id
       JOIN users staff ON staff.id = pl.diperbarui_oleh
       WHERE pk.supervisor_id = ?
       ORDER BY
         CASE WHEN pl.status_verifikasi = 'menunggu' THEN 0 ELSE 1 END,
         pl.created_at DESC,
         pl.id DESC
       LIMIT 12`,
      [req.supervisorUserId]
    );

    return res.json({
      summary: summaryRows[0],
      tasks,
      team,
      updates,
      notifications
    });
  } catch (error) {
    console.error("Supervisor dashboard error:", error);
    return res.status(500).json({
      message: "Gagal mengambil ringkasan dashboard supervisor."
    });
  }
});

app.get("/api/evaluator/dashboard", requireEvaluator, async (req, res) => {
  try {
    const [summaryRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total_evaluasi,
         COALESCE(ROUND(AVG(ep.skor_akhir), 2), 0) AS rata_skor,
         COALESCE(SUM(
           YEAR(ep.tgl_evaluasi) = YEAR(CURDATE())
           AND MONTH(ep.tgl_evaluasi) = MONTH(CURDATE())
         ), 0) AS evaluasi_bulan_ini
       FROM evaluasi_pekerjaan ep
       WHERE ep.evaluator_id = ?`,
      [req.evaluatorUserId]
    );
    const [queueRows] = await pool.execute(
      `SELECT
         COUNT(*) AS menunggu_evaluasi,
         COALESCE(SUM(pk.deadline < CURDATE()), 0) AS evaluasi_terlambat
       FROM pekerjaan pk
       WHERE pk.status = 'menunggu_evaluasi'
         AND NOT EXISTS (
           SELECT 1
           FROM evaluasi_pekerjaan ep
           WHERE ep.pekerjaan_id = pk.id
         )`
    );
    const [queue] = await pool.execute(
      `SELECT
         pk.id,
         pk.kode,
         pk.nama_pekerjaan,
         pk.deadline,
         pk.progres_terverifikasi,
         pk.status,
         pr.kode AS kode_proyek,
         pr.nama AS nama_proyek,
         p.nama AS prioritas,
         d.nama AS divisi,
         staff.nama AS staff_nama,
         supervisor.nama AS supervisor_nama
       FROM pekerjaan pk
       JOIN proyek pr ON pr.id = pk.proyek_id
       JOIN prioritas p ON p.id = pk.prioritas_id
       LEFT JOIN divisi d ON d.id = pk.divisi_id
       JOIN users staff ON staff.id = pk.penanggung_jawab_id
       JOIN users supervisor ON supervisor.id = pk.supervisor_id
       WHERE pk.status = 'menunggu_evaluasi'
         AND NOT EXISTS (
           SELECT 1
           FROM evaluasi_pekerjaan ep
           WHERE ep.pekerjaan_id = pk.id
         )
       ORDER BY pk.deadline ASC, pk.updated_at DESC
       LIMIT 12`
    );
    const [evaluations] = await pool.execute(
      `SELECT
         ep.id,
         ep.pekerjaan_id,
         ep.evaluasi_ke,
         ep.skor_akhir,
         ep.catatan,
         ep.rekomendasi,
         ep.tgl_evaluasi,
         pk.kode AS kode_pekerjaan,
         pk.nama_pekerjaan,
         pr.kode AS kode_proyek,
         pr.nama AS nama_proyek,
         staff.nama AS staff_nama,
         (
           SELECT COUNT(*)
           FROM evaluasi_nilai en
           WHERE en.evaluasi_id = ep.id
         ) AS jumlah_kriteria
       FROM evaluasi_pekerjaan ep
       JOIN pekerjaan pk ON pk.id = ep.pekerjaan_id
       JOIN proyek pr ON pr.id = pk.proyek_id
       JOIN users staff ON staff.id = pk.penanggung_jawab_id
       WHERE ep.evaluator_id = ?
       ORDER BY ep.tgl_evaluasi DESC, ep.id DESC
       LIMIT 8`,
      [req.evaluatorUserId]
    );
    const [notifications] = await pool.execute(
      `SELECT
         n.id,
         n.tipe,
         n.pesan,
         n.dibaca_at,
         n.created_at,
         n.pekerjaan_id,
         pk.kode AS kode_pekerjaan,
         pk.nama_pekerjaan
       FROM notifikasi n
       LEFT JOIN pekerjaan pk ON pk.id = n.pekerjaan_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 6`,
      [req.evaluatorUserId]
    );

    return res.json({
      summary: { ...summaryRows[0], ...queueRows[0] },
      queue,
      evaluations,
      notifications
    });
  } catch (error) {
    console.error("Evaluator dashboard error:", error);
    return res.status(500).json({
      message: "Gagal mengambil ringkasan dashboard evaluator."
    });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT
         u.id,
         u.nama,
         u.username,
         u.email,
         u.role_id,
         r.kode AS role_kode,
         r.nama AS role_nama,
         u.divisi_id,
         d.nama AS divisi_nama,
         u.supervisor_id,
         s.nama AS supervisor_nama,
         u.aktif,
         u.last_login_at,
         u.created_at,
         u.updated_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN divisi d ON d.id = u.divisi_id
       LEFT JOIN users s ON s.id = u.supervisor_id
       ORDER BY u.created_at DESC, u.id DESC`
    );
    const [roles] = await pool.execute(
      "SELECT id, kode, nama FROM roles ORDER BY id"
    );
    const [divisions] = await pool.execute(
      "SELECT id, kode, nama FROM divisi WHERE aktif = 1 ORDER BY nama"
    );
    const [supervisors] = await pool.execute(
      `SELECT u.id, u.nama, u.username
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.aktif = 1 AND r.kode = 'supervisor'
       ORDER BY u.nama`
    );

    return res.json({ users, roles, divisions, supervisors });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({
      message: "Gagal mengambil data pengguna."
    });
  }
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ message: "Data pengguna tidak valid." });
  }

  const nama = typeof body.nama === "string" ? body.nama.trim() : "";
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : null;
  const roleId = parseNullableId(body.roleId);
  const divisiId = parseNullableId(body.divisiId);
  const supervisorId = parseNullableId(body.supervisorId);

  if (!nama || nama.length > 100) {
    return res.status(400).json({
      message: "Nama wajib diisi dan maksimal 100 karakter."
    });
  }
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({
      message: "Username harus terdiri dari 3 sampai 50 karakter."
    });
  }
  if (email && !validEmail(email)) {
    return res.status(400).json({ message: "Format email tidak valid." });
  }
  if (!Number.isSafeInteger(roleId)) {
    return res.status(400).json({ message: "Role wajib dipilih." });
  }
  if (Number.isNaN(divisiId) || Number.isNaN(supervisorId)) {
    return res.status(400).json({
      message: "Divisi atau supervisor yang dipilih tidak valid."
    });
  }
  if (typeof body.password !== "string" || body.password.length < 8) {
    return res.status(400).json({
      message: "Password wajib diisi dan minimal 8 karakter."
    });
  }

  try {
    const [roles] = await pool.execute(
      "SELECT id, kode FROM roles WHERE id = ? LIMIT 1",
      [roleId]
    );
    if (!roles.length) {
      return res.status(400).json({ message: "Role tidak ditemukan." });
    }

    if (roles[0].kode === "supervisor" && supervisorId !== null) {
      return res.status(400).json({
        message: "Akun supervisor tidak dapat ditautkan ke supervisor lain."
      });
    }

    if (divisiId !== null) {
      const [divisions] = await pool.execute(
        "SELECT id FROM divisi WHERE id = ? AND aktif = 1 LIMIT 1",
        [divisiId]
      );
      if (!divisions.length) {
        return res.status(400).json({
          message: "Divisi tidak ditemukan atau sudah tidak aktif."
        });
      }
    }

    if (supervisorId !== null) {
      const [supervisors] = await pool.execute(
        `SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND u.aktif = 1 AND r.kode = 'supervisor'
         LIMIT 1`,
        [supervisorId]
      );
      if (!supervisors.length) {
        return res.status(400).json({
          message: "Supervisor harus merupakan akun supervisor yang aktif."
        });
      }
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users
        (role_id, divisi_id, supervisor_id, nama, username, email, password_hash, aktif)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roleId,
        divisiId,
        supervisorId,
        nama,
        username,
        email,
        passwordHash,
        body.aktif === false || body.aktif === 0 ? 0 : 1
      ]
    );

    return res.status(201).json({
      message: "Pengguna berhasil ditambahkan.",
      id: result.insertId
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Username atau email sudah digunakan."
      });
    }
    console.error("Create user error:", error);
    return res.status(500).json({
      message: "Gagal menambahkan pengguna."
    });
  }
});

app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const body = req.body;
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({ message: "ID pengguna tidak valid." });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ message: "Data pengguna tidak valid." });
  }

  const nama = typeof body.nama === "string" ? body.nama.trim() : "";
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : null;
  const roleId = parseNullableId(body.roleId);
  const divisiId = parseNullableId(body.divisiId);
  const supervisorId = parseNullableId(body.supervisorId);
  const aktif = body.aktif === true || body.aktif === 1 ? 1 : 0;

  if (!nama || nama.length > 100) {
    return res.status(400).json({
      message: "Nama wajib diisi dan maksimal 100 karakter."
    });
  }
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({
      message: "Username harus terdiri dari 3 sampai 50 karakter."
    });
  }
  if (email && !validEmail(email)) {
    return res.status(400).json({ message: "Format email tidak valid." });
  }
  if (!Number.isSafeInteger(roleId)) {
    return res.status(400).json({ message: "Role wajib dipilih." });
  }
  if (Number.isNaN(divisiId) || Number.isNaN(supervisorId)) {
    return res.status(400).json({
      message: "Divisi atau supervisor yang dipilih tidak valid."
    });
  }
  if (body.password !== undefined && body.password !== "" &&
      (typeof body.password !== "string" || body.password.length < 8)) {
    return res.status(400).json({
      message: "Password baru minimal 8 karakter."
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [targetRows] = await connection.execute(
      `SELECT u.id, u.aktif, r.kode AS role_kode
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? FOR UPDATE`,
      [userId]
    );
    if (!targetRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }

    const [roles] = await connection.execute(
      "SELECT id, kode FROM roles WHERE id = ? LIMIT 1",
      [roleId]
    );
    if (!roles.length) {
      await connection.rollback();
      return res.status(400).json({ message: "Role tidak ditemukan." });
    }

    if (userId === req.adminUserId &&
        (roles[0].kode !== "admin" || aktif !== 1)) {
      await connection.rollback();
      return res.status(400).json({
        message: "Anda tidak dapat menonaktifkan akun sendiri atau mengubah role sendiri."
      });
    }

    const targetIsActiveSupervisor =
      targetRows[0].role_kode === "supervisor" &&
      Number(targetRows[0].aktif) === 1;
    if (targetIsActiveSupervisor &&
        (roles[0].kode !== "supervisor" || aktif !== 1)) {
      const [assignedUsers] = await connection.execute(
        "SELECT id FROM users WHERE supervisor_id = ? FOR UPDATE",
        [userId]
      );
      if (assignedUsers.length) {
        await connection.rollback();
        return res.status(400).json({
          message: "Pindahkan pengguna yang berada di bawah supervisor ini sebelum mengubah role atau menonaktifkannya."
        });
      }
    }

    const targetIsActiveAdmin =
      targetRows[0].role_kode === "admin" && Number(targetRows[0].aktif) === 1;
    if (targetIsActiveAdmin &&
        (roles[0].kode !== "admin" || aktif !== 1)) {
      const [activeAdmins] = await connection.execute(
        `SELECT id FROM users
         WHERE role_id = (SELECT id FROM roles WHERE kode = 'admin')
           AND aktif = 1
         FOR UPDATE`
      );
      if (activeAdmins.length <= 1) {
        await connection.rollback();
        return res.status(400).json({
          message: "Tidak dapat menonaktifkan atau mengubah role administrator aktif terakhir."
        });
      }
    }

    if (divisiId !== null) {
      const [divisions] = await connection.execute(
        "SELECT id FROM divisi WHERE id = ? AND aktif = 1 LIMIT 1",
        [divisiId]
      );
      if (!divisions.length) {
        await connection.rollback();
        return res.status(400).json({
          message: "Divisi tidak ditemukan atau sudah tidak aktif."
        });
      }
    }

    if (supervisorId !== null) {
      if (supervisorId === userId) {
        await connection.rollback();
        return res.status(400).json({
          message: "Pengguna tidak dapat menjadi supervisor bagi dirinya sendiri."
        });
      }
      const [supervisors] = await connection.execute(
        `SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND u.aktif = 1 AND r.kode = 'supervisor'
         LIMIT 1`,
        [supervisorId]
      );
      if (!supervisors.length) {
        await connection.rollback();
        return res.status(400).json({
          message: "Supervisor harus merupakan akun supervisor yang aktif."
        });
      }
    }

    if (roles[0].kode === "supervisor" && supervisorId !== null) {
      await connection.rollback();
      return res.status(400).json({
        message: "Akun supervisor tidak dapat ditautkan ke supervisor lain."
      });
    }

    if (typeof body.password === "string" && body.password) {
      const passwordHash = await bcrypt.hash(body.password, 12);
      await connection.execute(
        `UPDATE users
         SET role_id = ?, divisi_id = ?, supervisor_id = ?, nama = ?,
             username = ?, email = ?, password_hash = ?, aktif = ?
         WHERE id = ?`,
        [roleId, divisiId, supervisorId, nama, username, email, passwordHash, aktif, userId]
      );
    } else {
      await connection.execute(
        `UPDATE users
         SET role_id = ?, divisi_id = ?, supervisor_id = ?, nama = ?,
             username = ?, email = ?, aktif = ?
         WHERE id = ?`,
        [roleId, divisiId, supervisorId, nama, username, email, aktif, userId]
      );
    }

    await connection.commit();
    return res.json({ message: "Data pengguna berhasil diperbarui." });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Username atau email sudah digunakan."
      });
    }
    console.error("Update user error:", error);
    return res.status(500).json({
      message: "Gagal memperbarui pengguna."
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({ message: "ID pengguna tidak valid." });
  }
  if (userId === req.adminUserId) {
    return res.status(400).json({
      message: "Anda tidak dapat menghapus akun yang sedang digunakan."
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [targetRows] = await connection.execute(
      `SELECT u.id, u.aktif, r.kode AS role_kode
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? FOR UPDATE`,
      [userId]
    );
    if (!targetRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }

    const target = targetRows[0];
    if (target.role_kode === "admin" && Number(target.aktif) === 1) {
      const [activeAdmins] = await connection.execute(
        `SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE r.kode = 'admin' AND u.aktif = 1
         FOR UPDATE`
      );
      if (activeAdmins.length <= 1) {
        await connection.rollback();
        return res.status(409).json({
          message: "Administrator aktif terakhir tidak dapat dihapus."
        });
      }
    }

    if (target.role_kode === "supervisor") {
      const [assignedUsers] = await connection.execute(
        "SELECT id FROM users WHERE supervisor_id = ? LIMIT 1",
        [userId]
      );
      if (assignedUsers.length) {
        await connection.rollback();
        return res.status(409).json({
          message: "Pindahkan pengguna yang berada di bawah supervisor ini sebelum menghapus akun."
        });
      }
    }

    const [result] = await connection.execute(
      "DELETE FROM users WHERE id = ?",
      [userId]
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }

    await connection.commit();
    return res.json({ message: "Pengguna berhasil dihapus." });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        message: "Pengguna masih terkait dengan data SIMON dan tidak dapat dihapus."
      });
    }
    console.error("Delete user error:", error);
    return res.status(500).json({ message: "Gagal menghapus pengguna." });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/api/auth/register", (req, res) => {
  return res.status(404).json({
    message: "Registrasi publik dinonaktifkan. Akun hanya dapat dibuat oleh administrator."
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Username/email dan password wajib diisi."
      });
    }

    const [rows] = await pool.execute(
      `SELECT
         u.id,
         u.nama,
         u.username,
         u.email,
         u.password_hash,
         u.aktif,
         r.kode AS role_kode,
         r.nama AS role_nama
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = ? OR u.email = ?
       LIMIT 1`,
      [username.trim(), username.trim()]
    );

    const user = rows[0];

    if (
      !user ||
      Number(user.aktif) !== 1 ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        message: "Username/email atau password tidak valid."
      });
    }

    await pool.execute(
      "UPDATE users SET last_login_at = NOW() WHERE id = ?",
      [user.id]
    );

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role_kode
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      message: "Login berhasil.",
      token,
      user: {
        id: user.id,
        nama: user.nama,
        username: user.username,
        email: user.email,
        role: user.role_kode,
        roleNama: user.role_nama
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan server. Periksa konfigurasi backend."
    });
  }
});

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`Backend SIMON berjalan di http://localhost:${port}`);
});
