import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import "./AdminReports.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function formatNumber(value, fraction = 0) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminReports({ token }) {
  const [reports, setReports] = useState({ projects: [], deadlines: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/admin/reports`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal memuat laporan.");
      setReports({
        projects: data.projects || [],
        deadlines: data.deadlines || [],
      });
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Backend tidak dapat dihubungi. Pastikan server berjalan."
        : requestError.message || "Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function fetchReports() {
      try {
        const response = await fetch(`${API_URL}/admin/reports`, {
          headers: { Authorization: `Bearer ${token || ""}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Gagal memuat laporan.");
        if (active) {
          setReports({
            projects: data.projects || [],
            deadlines: data.deadlines || [],
          });
        }
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof TypeError
            ? "Backend tidak dapat dihubungi. Pastikan server berjalan."
            : requestError.message || "Gagal memuat laporan.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchReports();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <section className="admin-reports">
      <div className="admin-report-heading">
        <div>
          <h2>Laporan & Analisis</h2>
          <p>Ringkasan proyek dan pemantauan tenggat berdasarkan view database SIMON.</p>
        </div>
        <button type="button" onClick={loadReports} disabled={loading}>
          <RefreshCw size={15} /> Muat ulang
        </button>
      </div>

      {error && <div className="admin-report-error" role="alert"><AlertTriangle size={17} />{error}</div>}

      <section className="content-card admin-report-card">
        <div className="admin-report-card-title">
          <div><BarChart3 size={18} /><h3>Ringkasan Proyek</h3></div>
          <span>{reports.projects.length} proyek</span>
        </div>
        <div className="admin-report-table-wrap">
          <table className="admin-report-table">
            <thead>
              <tr>
                <th>Proyek</th><th>Tahun</th><th>Target</th><th>Selesai</th>
                <th>Berjalan</th><th>Terlambat</th><th>Rata-rata progres</th>
                <th>Staff</th><th>Rata-rata evaluasi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="admin-report-empty">Memuat laporan...</td></tr>
              ) : reports.projects.length === 0 ? (
                <tr><td colSpan="9" className="admin-report-empty">Belum ada data proyek.</td></tr>
              ) : reports.projects.map((project) => (
                <tr key={project.proyek_id}>
                  <td><strong>{project.kode_proyek}</strong><span>{project.nama_proyek}</span></td>
                  <td>{project.tahun}</td>
                  <td>{formatNumber(project.target_pekerjaan)}</td>
                  <td>{formatNumber(project.jumlah_selesai)}</td>
                  <td>{formatNumber(project.jumlah_berjalan)}</td>
                  <td>{formatNumber(project.jumlah_terlambat)}</td>
                  <td>{formatNumber(project.rata_progres_terverifikasi, 1)}%</td>
                  <td>{formatNumber(project.jumlah_staff)}</td>
                  <td>{project.rata_rata_skor_evaluasi == null
                    ? "-"
                    : formatNumber(project.rata_rata_skor_evaluasi, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card admin-report-card">
        <div className="admin-report-card-title">
          <div><AlertTriangle size={18} /><h3>Pekerjaan Perlu Perhatian</h3></div>
          <span>{reports.deadlines.length} pekerjaan</span>
        </div>
        <div className="admin-report-table-wrap">
          <table className="admin-report-table">
            <thead>
              <tr>
                <th>Kode / Pekerjaan</th><th>Penanggung jawab</th><th>Supervisor</th>
                <th>Mulai</th><th>Tenggat</th><th>Sisa hari</th>
                <th>Progres tervalidasi</th><th>Kondisi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="admin-report-empty">Memuat laporan...</td></tr>
              ) : reports.deadlines.length === 0 ? (
                <tr><td colSpan="8" className="admin-report-empty">Tidak ada pekerjaan terlambat atau perlu perhatian.</td></tr>
              ) : reports.deadlines.map((item) => (
                <tr key={item.pekerjaan_id}>
                  <td><strong>{item.kode}</strong><span>{item.nama_pekerjaan}</span></td>
                  <td>{item.nama_penanggung_jawab}</td>
                  <td>{item.nama_supervisor}</td>
                  <td>{formatDate(item.tgl_mulai)}</td>
                  <td>{formatDate(item.deadline)}</td>
                  <td>{formatNumber(item.sisa_hari)}</td>
                  <td>{formatNumber(item.progres_terverifikasi)}%</td>
                  <td><span className={`admin-report-status ${item.kondisi_deadline}`}>
                    {item.kondisi_deadline === "terlambat" ? "Terlambat" : "Perlu perhatian"}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
