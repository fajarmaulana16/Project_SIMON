
import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FileBarChart,
  Bell,
  Search,
  Settings,
  LogOut,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Menu,
  RefreshCw,
} from "lucide-react";
import UserManagement from "./UserManagement";
import AdminDataManagement from "./AdminDataManagement";
import AdminReports from "./AdminReports";
import "./DashboardAdmin.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Manajemen Pengguna", icon: Users },
  { label: "Master Data", icon: Building2, category: "master" },
  { label: "Proyek & Rencana", icon: CalendarDays, category: "projects" },
  { label: "Pekerjaan", icon: FileText, category: "tasks" },
  { label: "Progres & Verifikasi", icon: ClipboardCheck, category: "progress" },
  { label: "Lampiran & Riwayat", icon: ChartColumn, category: "audit" },
  { label: "Evaluasi", icon: CheckCircle2, category: "evaluations" },
  { label: "Notifikasi", icon: Bell, category: "notifications" },
  { label: "Laporan", icon: FileBarChart, category: "reports" },
  { label: "Pengaturan", icon: Settings, category: "settings" },
];

const initialStats = [
  {
    key: "totalRegulasi",
    label: "Total Pekerjaan",
    icon: FileText,
    color: "blue",
  },
  {
    key: "dalamProses",
    label: "Dalam Proses",
    icon: Clock,
    color: "orange",
  },
  {
    key: "selesai",
    label: "Selesai",
    icon: CheckCircle2,
    color: "green",
  },
  {
    key: "terlambat",
    label: "Terlambat",
    icon: AlertTriangle,
    color: "red",
  },
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

async function fetchAdminDashboard(token) {
  const response = await fetch(`${API_URL}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || "Gagal mengambil data dashboard");
  }
  return {
    totalRegulasi: result.totalRegulasi ?? 0,
    dalamProses: result.dalamProses ?? 0,
    selesai: result.selesai ?? 0,
    terlambat: result.terlambat ?? 0,
    totalPengguna: result.totalPengguna ?? 0,
    totalProyek: result.totalProyek ?? 0,
    totalRencana: result.totalRencana ?? 0,
    totalEvaluasi: result.totalEvaluasi ?? 0,
    menungguVerifikasi: result.menungguVerifikasi ?? 0,
    recentRegulations: result.recentRegulations ?? [],
  };
}

export default function DashboardAdmin({ onLogout, session }) {
  const token =
    session?.token ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("simonToken");
  const [dashboard, setDashboard] = useState({
    totalRegulasi: 0,
    dalamProses: 0,
    selesai: 0,
    terlambat: 0,
    recentRegulations: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminName = session?.user?.nama || "Administrator";

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/admin/dashboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Gagal mengambil data dashboard"
        );
      }

      setDashboard({
        totalRegulasi: result.totalRegulasi ?? 0,
        dalamProses: result.dalamProses ?? 0,
        selesai: result.selesai ?? 0,
        terlambat: result.terlambat ?? 0,
        totalPengguna: result.totalPengguna ?? 0,
        totalProyek: result.totalProyek ?? 0,
        totalRencana: result.totalRencana ?? 0,
        totalEvaluasi: result.totalEvaluasi ?? 0,
        menungguVerifikasi: result.menungguVerifikasi ?? 0,
        recentRegulations: result.recentRegulations ?? [],
      });
    } catch (err) {
      setError(err.message || "Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    fetchAdminDashboard(token)
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Tidak dapat terhubung ke server.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  function refreshDashboard() {
    setLoading(true);
    setError("");
    loadDashboard();
  }

  const filteredRegulations = dashboard.recentRegulations.filter(
    (item) =>
      String(item.nama || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      String(item.divisi || "")
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const total = dashboard.totalRegulasi;
  const completion = total
    ? Math.round((dashboard.selesai / total) * 100)
    : 0;

  function handleMenuClick(label) {
    setActiveMenu(label);
    setSidebarOpen(false);
  }

  const activeItem = menuItems.find((item) => item.label === activeMenu);

  function handleLogout() {
    if (onLogout) {
      onLogout();
      return;
    }

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("simonToken");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("simonUser");
    window.location.href = "/login";
  }

  return (
    <div className="simon-admin">
      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Tutup navigasi"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="brand">
          <div className="brand-icon">
            <ChartColumn size={25} />
          </div>
          <div>
            <h2>SIMON</h2>
            <span>Monitoring System</span>
          </div>
        </div>

        <div className="sidebar-caption">MENU UTAMA</div>

        <nav className="sidebar-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`menu-item ${
                  activeMenu === item.label ? "active" : ""
                }`}
                onClick={() => handleMenuClick(item.label)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="menu-item logout" onClick={handleLogout}>
            <LogOut size={19} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="header-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka navigasi"
            >
              <Menu size={21} />
            </button>

            <div>
              <h1>{activeMenu === "Dashboard" ? "Dashboard Admin" : activeMenu}</h1>
              <p>
                {activeMenu === "Manajemen Pengguna"
                  ? "Kelola akun dan hak akses pengguna SIMON"
                  : activeMenu === "Dashboard"
                    ? "Ringkasan dan monitoring data SIMON"
                    : `Kelola ${activeMenu.toLowerCase()} berdasarkan database SIMON`}
              </p>
            </div>
          </div>

          <div className="header-actions">
            {activeMenu === "Dashboard" && (
              <button
                className="icon-button"
                title="Muat ulang data"
                onClick={refreshDashboard}
              >
                <RefreshCw size={19} />
              </button>
            )}

            <button
              className="icon-button"
              title="Notifikasi"
              onClick={() => handleMenuClick("Notifikasi")}
            >
              <Bell size={19} />
            </button>

            <div className="admin-profile">
              <div className="avatar">A</div>
              <div className="profile-text">
                <strong>{adminName}</strong>
                <span>Admin SIMON</span>
              </div>
            </div>
          </div>
        </header>

        {activeMenu === "Manajemen Pengguna" ? (
          <UserManagement token={token} currentUserId={session?.user?.id} />
        ) : activeItem?.category && activeItem.category !== "reports" ? (
          <AdminDataManagement key={activeItem.category} category={activeItem.category} token={token} />
        ) : activeMenu === "Laporan" ? (
          <AdminReports token={token} />
        ) : (
          <>
        <section className="welcome-panel">
          <div>
            <span className="welcome-tag">ADMINISTRATOR</span>
            <h2>Selamat datang, {adminName}</h2>
            <p>
              Pantau proyek, rencana, pelaksanaan, progres, dan evaluasi
              dalam satu dashboard.
            </p>
          </div>
          <div className="welcome-icon">
            <ChartColumn size={46} />
          </div>
        </section>

        <section className="stats-grid admin-database-stats">
          <article className="stat-card"><div className="stat-top"><span>Total Pengguna</span><div className="stat-icon blue"><Users size={22} /></div></div><h3>{loading ? "..." : formatNumber(dashboard.totalPengguna)}</h3><span className="stat-description">Akun pada database SIMON</span></article>
          <article className="stat-card"><div className="stat-top"><span>Proyek</span><div className="stat-icon blue"><CalendarDays size={22} /></div></div><h3>{loading ? "..." : formatNumber(dashboard.totalProyek)}</h3><span className="stat-description">Seluruh proyek terdaftar</span></article>
          <article className="stat-card"><div className="stat-top"><span>Rencana</span><div className="stat-icon orange"><FileText size={22} /></div></div><h3>{loading ? "..." : formatNumber(dashboard.totalRencana)}</h3><span className="stat-description">Rencana pekerjaan</span></article>
          <article className="stat-card"><div className="stat-top"><span>Menunggu Verifikasi</span><div className="stat-icon red"><ClipboardCheck size={22} /></div></div><h3>{loading ? "..." : formatNumber(dashboard.menungguVerifikasi)}</h3><span className="stat-description">Laporan progres menunggu</span></article>
        </section>

        <section className="stats-grid">
          {initialStats.map((stat) => {
            const Icon = stat.icon;

            return (
              <article className="stat-card" key={stat.key}>
                <div className="stat-top">
                  <span>{stat.label}</span>
                  <div className={`stat-icon ${stat.color}`}>
                    <Icon size={22} />
                  </div>
                </div>

                <h3>
                  {loading
                    ? "..."
                    : formatNumber(dashboard[stat.key])}
                </h3>

                <span className="stat-description">
                  Data dari database SIMON
                </span>
              </article>
            );
          })}
        </section>

        {error && (
          <div className="error-panel">
            <AlertTriangle size={19} />
            <div>
              <strong>Data belum dapat dimuat</strong>
              <p>{error}</p>
              <button onClick={refreshDashboard}>Coba lagi</button>
            </div>
          </div>
        )}

        <section className="dashboard-grid">
          <article className="content-card progress-card">
            <div className="card-heading">
              <div>
                <h3>Ringkasan Penyelesaian</h3>
                <p>Persentase pekerjaan yang sudah selesai</p>
              </div>
              <ChartColumn size={21} />
            </div>

            <div className="completion-number">
              {loading ? "..." : `${completion}%`}
            </div>

            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={completion}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="progress-value"
                style={{ width: `${completion}%` }}
              />
            </div>

            <div className="progress-footer">
              <span>Pekerjaan selesai</span>
              <strong>
                {formatNumber(dashboard.selesai)} dari{" "}
                {formatNumber(dashboard.totalRegulasi)}
              </strong>
            </div>

            <div className="progress-footer">
              <span>Masih dalam proses</span>
              <strong>{formatNumber(dashboard.dalamProses)}</strong>
            </div>

            <div className="progress-footer">
              <span>Perlu tindak lanjut</span>
              <strong className="text-danger">
                {formatNumber(dashboard.terlambat)}
              </strong>
            </div>
          </article>

          <article className="content-card">
            <div className="card-heading">
              <div>
                <h3>Status Monitoring</h3>
                <p>Komposisi status pekerjaan</p>
              </div>
            </div>

            <div className="status-list">
              <div className="status-row">
                <span className="status-dot blue-dot" />
                <span>Dalam Proses</span>
                <strong>{formatNumber(dashboard.dalamProses)}</strong>
              </div>

              <div className="status-row">
                <span className="status-dot green-dot" />
                <span>Selesai</span>
                <strong>{formatNumber(dashboard.selesai)}</strong>
              </div>

              <div className="status-row">
                <span className="status-dot red-dot" />
                <span>Terlambat</span>
                <strong>{formatNumber(dashboard.terlambat)}</strong>
              </div>
            </div>

            <p className="status-note">
              Status akan mengikuti hasil perhitungan data backend.
            </p>
          </article>
        </section>

        <section className="content-card regulations-card">
          <div className="table-heading">
            <div>
              <h3>Pekerjaan Terbaru</h3>
              <p>Daftar pekerjaan yang terakhir diperbarui</p>
            </div>

            <div className="table-tools">
              <div className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari pekerjaan..."
                />
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="regulation-table">
              <thead>
                <tr>
                  <th>Nama Pekerjaan</th>
                  <th>Divisi / Fungsi</th>
                  <th>Progres</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="empty-row">
                      Memuat data...
                    </td>
                  </tr>
                ) : filteredRegulations.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-row">
                      Belum ada data regulasi.
                    </td>
                  </tr>
                ) : (
                  filteredRegulations.map((item, index) => (
                    <tr key={item.id ?? index}>
                      <td>
                        <strong>{item.nama || "-"}</strong>
                      </td>
                      <td>{item.divisi || "-"}</td>
                      <td>
                        <div className="table-progress">
                          <div className="progress-track">
                            <div
                              className="progress-value"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, Number(item.progres) || 0)
                                )}%`,
                              }}
                            />
                          </div>
                          <span>{Number(item.progres) || 0}%</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            String(item.status || "")
                              .toLowerCase()
                              .includes("terlambat")
                              ? "badge-red"
                              : String(item.status || "")
                                  .toLowerCase()
                                  .includes("selesai")
                                ? "badge-green"
                                : "badge-orange"
                          }`}
                        >
                          {item.status || "Belum ditentukan"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="admin-footer">
          SIMON — Sistem Informasi Monitoring
        </footer>
          </>
        )}
      </main>
    </div>
  );
}
