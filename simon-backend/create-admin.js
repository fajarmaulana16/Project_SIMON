
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { pool } from "./db.js";

dotenv.config();

const rl = readline.createInterface({ input, output });

try {
  const nama = (await rl.question("Nama admin: ")).trim();
  const username = (await rl.question("Username admin: ")).trim();
  const email = (await rl.question("Email admin: ")).trim();
  const password = await rl.question("Password admin: ");

  if (!nama || !username || !email || password.length < 8) {
    throw new Error(
      "Semua kolom wajib diisi dan password minimal 8 karakter."
    );
  }

  const [roles] = await pool.execute(
    "SELECT id FROM roles WHERE kode = ? LIMIT 1",
    ["admin"]
  );

  if (!roles.length) {
    throw new Error(
      "Role admin belum tersedia. Periksa data awal tabel roles."
    );
  }

  const [existing] = await pool.execute(
    "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
    [username, email]
  );

  if (existing.length) {
    throw new Error("Username atau email sudah digunakan.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await pool.execute(
    `INSERT INTO users
      (role_id, nama, username, email, password_hash, aktif)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [roles[0].id, nama, username, email, passwordHash]
  );

  console.log("Akun Admin berhasil dibuat.");
} catch (error) {
  console.error("Gagal membuat akun:", error.message);
} finally {
  rl.close();
  await pool.end();
}
