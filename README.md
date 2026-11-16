# Project_SIMON

## Alur review Rencana Pekerjaan

Untuk database SIMON yang sudah berjalan, jalankan migrasi
[`20261117_planner_review_workflow.sql`](./simon-backend/migrations/20261117_planner_review_workflow.sql)
sebanyak satu kali sebelum memperbarui backend. Migrasi mempertahankan status
rencana yang sudah ada, menambahkan status review/revisi, membuat tabel riwayat
status rencana, dan menambahkan kunci idempotensi nullable untuk mencegah
pekerjaan ganda saat permintaan Supervisor diulang. Instalasi baru dapat
menggunakan definisi terbaru di [`simon_schema.sql`](./simon_schema.sql).