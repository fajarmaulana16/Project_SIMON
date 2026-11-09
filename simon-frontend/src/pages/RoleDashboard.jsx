import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChartColumn,
  ChevronRight,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Paperclip,
  RefreshCw,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import "./StaffDashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const configs = {
  supervisor: {
    title: "Supervisor",
    endpoint: "supervisor",
    workLabel: "Pekerjaan Tim",
    workSection: "tasks",
    emptyWork: "Belum ada pekerjaan yang berada dalam pengawasan Anda.",
    stats: [
      { key: "total_pekerjaan", label: "TOTAL PEKERJAAN", hint: "Dalam pengawasan Anda", Icon: BriefcaseBusiness, tone: "blue" },
      { key: "pekerjaan_aktif", label: "PEKERJAAN AKTIF", hint: "Belum dimulai, berjalan, atau tertunda", Icon: Activity, tone: "teal" },
      { key: "menunggu_verifikasi", label: "PROGRES MENUNGGU", hint: "Laporan Staff untuk ditinjau", Icon: CheckCircle2, tone: "violet" },
      { key: "jumlah_staff", label: "ANGGOTA STAFF", hint: "Staff aktif dalam tim Anda", Icon: Users, tone: "blue" },
      { key: "pekerjaan_terlambat", label: "PEKERJAAN TERLAMBAT", hint: "Belum selesai melewati tenggat", Icon: AlertTriangle, tone: "orange" },
    ],
  },
  evaluator: {
    title: "Evaluator",
    endpoint: "evaluator",
    workLabel: "Antrean Evaluasi",
    workSection: "tasks",
    emptyWork: "Belum ada pekerjaan yang menunggu evaluasi.",
    stats: [
      { key: "menunggu_evaluasi", label: "ANTREAN EVALUASI", hint: "Siap untuk dievaluasi", Icon: Clock3, tone: "orange" },
      { key: "total_evaluasi", label: "EVALUASI SELESAI", hint: "Evaluasi yang Anda catat", Icon: CheckCircle2, tone: "teal" },
      { key: "rata_skor", label: "RATA-RATA SKOR", hint: "Dari seluruh evaluasi Anda", Icon: Star, tone: "violet", decimal: true },
      { key: "evaluasi_terlambat", label: "LEWAT TENGGAT", hint: "Antrean evaluasi melewati tenggat", Icon: AlertTriangle, tone: "blue" },
    ],
  },
};

const emptyDashboard = {
  summary: {},
  tasks: [],
  queue: [],
  evaluations: [],
  team: [],
  updates: [],
  notifications: [],
};

const todayLabel = new Date().toLocaleDateString("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

async function fetchDashboard(role, token) {
  const response = await fetch(`${API_URL}/${role}/dashboard`, {
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Gagal memuat dashboard ${role}.`);
  }
  return {
    ...emptyDashboard,
    ...data,
    summary: data.summary || {},
    team: data.team || [],
    updates: data.updates || [],
  };
}

function formatCount(value, decimal = false) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: decimal ? 2 : 0,
    maximumFractionDigits: decimal ? 2 : 0,
  });
}

function formatDate(value) {
  if (!value) return "-";
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function statusLabel(status) {
  return {
    belum_dimulai: "Belum dimulai",
    berjalan: "Berjalan",
    tertunda: "Tertunda",
    menunggu_evaluasi: "Menunggu evaluasi",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan",
  }[status] || status || "Belum ditentukan";
}

function verificationLabel(status) {
  return {
    menunggu: "Menunggu verifikasi",
    disetujui: "Disetujui",
    dikembalikan: "Perlu diperbaiki",
  }[status] || "Status belum tersedia";
}

function initials(name) {
  return String(name || "SIMON")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function matchesQuery(item, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return Object.values(item).some((value) =>
    String(value ?? "").toLowerCase().includes(normalizedQuery)
  );
}

function DashboardForRole({ role, session, onLogout }) {
  const config = configs[role];
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const userName = session?.user?.nama || config.title;
  const summary = dashboard.summary;

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      setDashboard(await fetchDashboard(config.endpoint, session?.token));
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
          : requestError.message || `Gagal memuat dashboard ${config.title.toLowerCase()}.`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchDashboard(config.endpoint, session?.token)
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError instanceof TypeError
            ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
            : requestError.message || `Gagal memuat dashboard ${config.title.toLowerCase()}.`
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [config.endpoint, config.title, session?.token]);

  const filteredTasks = useMemo(() => {
    const tasks = role === "evaluator" ? dashboard.queue : dashboard.tasks;
    return tasks.filter((task) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && ["belum_dimulai", "berjalan", "tertunda"].includes(task.status)) ||
        (filter === "waiting" && task.status === "menunggu_evaluasi") ||
        (filter === "done" && task.status === "selesai");
      return matchesFilter && matchesQuery(task, query);
    });
  }, [dashboard.queue, dashboard.tasks, filter, query, role]);

  const filteredEvaluations = useMemo(
    () => dashboard.evaluations.filter((evaluation) => matchesQuery(evaluation, query)),
    [dashboard.evaluations, query]
  );

  const filteredUpdates = useMemo(
    () => dashboard.updates.filter((update) => matchesQuery(update, query)),
    [dashboard.updates, query]
  );

  function goToSection(section) {
    setActiveSection(section);
    setSidebarOpen(false);
    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const tasks = role === "evaluator" ? dashboard.queue : dashboard.tasks;

  return (
    <div className="staff-dashboard role-dashboard">
      {sidebarOpen && (
        <button
          className="staff-sidebar-overlay"
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`staff-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="staff-brand">
          <div className="staff-brand-icon"><ChartColumn size={25} /></div>
          <div><h2>SIMON</h2><span>Monitoring System</span></div>
        </div>

        <span className="staff-nav-label">RUANG KERJA</span>
        <nav className="staff-nav">
          <button
            type="button"
            className={activeSection === "dashboard" ? "active" : ""}
            onClick={() => goToSection("dashboard")}
          >
            <LayoutDashboard size={18} /> Dashboard {config.title}
          </button>
          <button
            type="button"
            className={activeSection === "tasks" ? "active" : ""}
            onClick={() => goToSection("tasks")}
          >
            <BriefcaseBusiness size={18} /> {config.workLabel}
          </button>
          {role === "supervisor" && (
            <>
              <button
                type="button"
                className={activeSection === "team" ? "active" : ""}
                onClick={() => goToSection("team")}
              >
                <Users size={18} /> Anggota Staff
                {dashboard.team.length > 0 && (
                  <span className="staff-nav-count">{dashboard.team.length}</span>
                )}
              </button>
              <button
                type="button"
                className={activeSection === "updates" ? "active" : ""}
                onClick={() => goToSection("updates")}
              >
                <Activity size={18} /> Progres Staff
                {Number(summary.menunggu_verifikasi) > 0 && (
                  <span className="staff-nav-count">{summary.menunggu_verifikasi}</span>
                )}
              </button>
            </>
          )}
          {role === "evaluator" && (
            <button
              type="button"
              className={activeSection === "evaluations" ? "active" : ""}
              onClick={() => goToSection("evaluations")}
            >
              <Star size={18} /> Riwayat Evaluasi
              {dashboard.evaluations.length > 0 && (
                <span className="staff-nav-count">{dashboard.evaluations.length}</span>
              )}
            </button>
          )}
        </nav>

        <div className="staff-sidebar-bottom">
          <button type="button" onClick={onLogout}><LogOut size={18} /> Keluar</button>
          <span>SIMON · Monitoring pekerjaan</span>
        </div>
      </aside>

      <main className="staff-main" id="dashboard">
        <header className="staff-topbar">
          <div className="staff-top-left">
            <button
              className="staff-icon-button staff-mobile-menu"
              type="button"
              aria-label="Buka navigasi"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={19} />
            </button>
            <label className="staff-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari pekerjaan, proyek, atau kode..."
                aria-label="Cari dashboard"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Hapus pencarian">
                  <X size={15} />
                </button>
              )}
            </label>
          </div>
          <div className="staff-top-actions">
            <span className="staff-date"><CalendarDays size={16} /> {todayLabel}</span>
            <button
              className="staff-icon-button"
              type="button"
              title="Muat ulang dashboard"
              onClick={loadDashboard}
              disabled={loading}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="staff-icon-button"
              type="button"
              title="Lihat notifikasi"
              onClick={() => goToSection("notifications")}
            >
              <Bell size={18} />
            </button>
            <div className="staff-top-user">
              <div className="staff-avatar">{initials(userName)}</div>
              <div><strong>{userName}</strong><span>{config.title.toUpperCase()}</span></div>
            </div>
          </div>
        </header>

        <div className="staff-content">
          <div className="staff-page-title">
            <h1>Dashboard {config.title}</h1>
            <p>Ringkasan pekerjaan dan aktivitas SIMON sesuai peran Anda</p>
          </div>

          {error && (
            <div className="staff-error" role="alert">
              <div><strong>Dashboard belum dapat dimuat</strong><span>{error}</span></div>
              <button type="button" onClick={loadDashboard}>Coba lagi</button>
            </div>
          )}

          <section className="staff-hero">
            <div className="staff-hero-copy">
              <span className="staff-eyebrow">RUANG KERJA {config.title.toUpperCase()}</span>
              <h2>Halo, {userName}. {role === "supervisor" ? "Pantau pekerjaan tim Anda." : "Siap melakukan evaluasi?"}</h2>
              <p>
                {role === "supervisor"
                  ? "Tinjau progres, verifikasi laporan terbaru, dan pantau tenggat pekerjaan tim."
                  : "Tinjau antrean pekerjaan dan pantau hasil evaluasi yang telah Anda catat."}
              </p>
              <button type="button" onClick={() => goToSection("tasks")}>
                {role === "supervisor" ? "Lihat pekerjaan tim" : "Lihat antrean evaluasi"}
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="staff-hero-art" aria-hidden="true">
              <div className="staff-art-circle">
                {role === "supervisor" ? <Activity size={36} /> : <Star size={34} />}
              </div>
              <div className="staff-art-card">
                <span><ChartColumn size={14} /> {role === "supervisor" ? "Dalam pemantauan" : "Antrean evaluasi"}</span>
                <strong>
                  {loading ? "—" : formatCount(
                    role === "supervisor" ? summary.total_pekerjaan : summary.menunggu_evaluasi
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="staff-stats">
            {config.stats.map(({ key, label, hint, Icon, tone, decimal }) => (
              <article className="staff-stat" key={key}>
                <div className={`staff-stat-icon staff-tone-${tone}`}><Icon size={20} /></div>
                <span className="staff-stat-label">{label}</span>
                <strong>{loading ? "—" : formatCount(summary[key], decimal)}</strong>
                <small>{hint}</small>
              </article>
            ))}
          </section>

          <div className="staff-panels">
            <section className="staff-panel staff-task-panel" id="tasks">
              <div className="staff-panel-heading">
                <div>
                  <h2>{config.workLabel}</h2>
                  <p>
                    {role === "supervisor"
                      ? "Pekerjaan yang ditugaskan kepada Anda sebagai supervisor"
                      : "Pekerjaan siap evaluasi berdasarkan status pekerjaan"}
                  </p>
                </div>
                <span>{formatCount(role === "evaluator" ? summary.menunggu_evaluasi : summary.total_pekerjaan)} pekerjaan</span>
              </div>
              <div className="staff-task-toolbar">
                <div className="staff-filter-tabs" role="group" aria-label="Filter pekerjaan">
                  {(role === "supervisor"
                    ? [["all", "Semua"], ["active", "Aktif"], ["waiting", "Menunggu evaluasi"], ["done", "Selesai"]]
                    : [["all", "Semua antrean"]]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={filter === value ? "active" : ""}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="staff-task-list">
                {loading ? (
                  <div className="staff-empty">Memuat pekerjaan...</div>
                ) : filteredTasks.length === 0 ? (
                  <div className="staff-empty">
                    {tasks.length === 0 ? config.emptyWork : "Tidak ada pekerjaan yang cocok dengan pencarian."}
                  </div>
                ) : filteredTasks.map((task) => {
                  const progress = Math.min(100, Math.max(
                    0,
                    Number(task.progres_terbaru ?? task.progres_terakhir ?? task.progres_terverifikasi ?? 0)
                  ));
                  return (
                    <article className="staff-task-row" key={task.id}>
                      <div className="staff-task-mark">
                        {role === "evaluator" ? <FileText size={17} /> : <BriefcaseBusiness size={17} />}
                      </div>
                      <div className="staff-task-info">
                        <div className="staff-task-meta">
                          <span>{task.kode}</span>
                          {task.kode_proyek && <span>{task.kode_proyek}</span>}
                          {task.prioritas && <span>{task.prioritas}</span>}
                        </div>
                        <h3>{task.nama_pekerjaan}</h3>
                        <p>{task.nama_proyek}{task.staff_nama ? ` · ${task.staff_nama}` : ""}</p>
                        <div className="staff-task-deadline">
                          <CalendarDays size={13} />
                          Tenggat {formatDate(task.deadline)}
                          {task.divisi && <span> · {task.divisi}</span>}
                        </div>
                      </div>
                      <div className="staff-task-progress">
                        <div className="staff-progress-numbers">
                          <strong>{progress}%</strong>
                          <span>{statusLabel(task.status)}</span>
                        </div>
                        <div
                          className="staff-progress-track"
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Progres ${task.nama_pekerjaan}`}
                        >
                          <div style={{ width: `${progress}%` }} />
                        </div>
                        <small>
                          {role === "supervisor" && task.status_verifikasi_terbaru
                            ? `Progres ${task.progres_terbaru ?? 0}% · ${task.status_verifikasi_terbaru}`
                            : `Terverifikasi ${Number(task.progres_terverifikasi) || 0}%`}
                        </small>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {role === "supervisor" ? (
              <section className="staff-panel staff-activity-panel" id="team">
                <div className="staff-panel-heading">
                  <div>
                    <h2>Anggota Staff</h2>
                    <p>Staff aktif yang terhubung ke akun supervisor Anda</p>
                  </div>
                  <Users size={18} />
                </div>
                <TeamPanel team={dashboard.team} loading={loading} />
              </section>
            ) : (
              <section className="staff-panel staff-activity-panel" id="evaluations">
                <div className="staff-panel-heading">
                  <div><h2>Riwayat Evaluasi</h2><p>Evaluasi yang telah Anda catat</p></div>
                  <Star size={18} />
                </div>
                <div className="staff-evaluation-list">
                  {loading ? (
                    <div className="staff-empty">Memuat riwayat evaluasi...</div>
                  ) : filteredEvaluations.length === 0 ? (
                    <div className="staff-empty">
                      {dashboard.evaluations.length === 0
                        ? "Belum ada evaluasi yang tercatat atas nama Anda."
                        : "Tidak ada hasil evaluasi yang cocok dengan pencarian."}
                    </div>
                  ) : filteredEvaluations.map((evaluation) => (
                    <article className="staff-evaluation-row" key={evaluation.id}>
                      <div className="staff-evaluation-score">
                        <strong>{formatCount(evaluation.skor_akhir, true)}</strong>
                        <span>SKOR</span>
                      </div>
                      <div className="staff-evaluation-copy">
                        <div className="staff-task-meta">
                          <span>{evaluation.kode_pekerjaan}</span>
                          {evaluation.kode_proyek && <span>{evaluation.kode_proyek}</span>}
                        </div>
                        <h3>{evaluation.nama_pekerjaan}</h3>
                        <p>{evaluation.nama_proyek} · {evaluation.staff_nama}</p>
                        <small>
                          Evaluasi ke-{evaluation.evaluasi_ke} · {formatDate(evaluation.tgl_evaluasi)}
                          {Number(evaluation.jumlah_kriteria) > 0
                            ? ` · ${evaluation.jumlah_kriteria} kriteria`
                            : ""}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {role === "evaluator" && (
              <section className="staff-panel staff-activity-panel role-notifications-panel" id="notifications">
                <NotificationPanel notifications={dashboard.notifications} loading={loading} />
              </section>
            )}
          </div>

          {role === "supervisor" && (
            <>
              <section className="staff-panel role-updates-panel" id="updates">
                <div className="staff-panel-heading">
                  <div>
                    <h2>Progres Terbaru Staff</h2>
                    <p>Laporan progres, catatan, dan status verifikasi dari pekerjaan dalam pengawasan Anda</p>
                  </div>
                  <Activity size={18} />
                </div>
                <ProgressUpdates updates={filteredUpdates} loading={loading} total={dashboard.updates.length} />
              </section>
              <section className="staff-panel role-notifications-panel" id="notifications">
                <NotificationPanel notifications={dashboard.notifications} loading={loading} />
              </section>
            </>
          )}

          <footer className="staff-footer">
            SIMON · Sistem Informasi Monitoring <span>•</span> Dashboard {config.title}
          </footer>
        </div>
      </main>
    </div>
  );
}

function TeamPanel({ team, loading }) {
  if (loading) return <div className="staff-empty">Memuat anggota tim...</div>;
  if (team.length === 0) {
    return <div className="staff-empty">Belum ada Staff aktif yang ditautkan ke akun Anda.</div>;
  }

  return (
    <div className="role-team-list">
      {team.map((member) => (
        <article className="role-team-row" key={member.id}>
          <div className="staff-avatar">{initials(member.nama)}</div>
          <div className="role-team-info">
            <strong>{member.nama}</strong>
            <span>{member.divisi || "Belum ditetapkan divisi"} · {member.total_pekerjaan} pekerjaan</span>
          </div>
          <div className="role-team-stats">
            <strong>{member.pekerjaan_aktif}</strong>
            <span>aktif</span>
          </div>
          {Number(member.pekerjaan_terlambat) > 0 && (
            <span className="role-team-late">{member.pekerjaan_terlambat} terlambat</span>
          )}
        </article>
      ))}
    </div>
  );
}

function ProgressUpdates({ updates, loading, total }) {
  if (loading) return <div className="staff-empty">Memuat progres pekerjaan...</div>;
  if (updates.length === 0) {
    return (
      <div className="staff-empty">
        {total === 0
          ? "Belum ada laporan progres untuk pekerjaan yang Anda awasi."
          : "Tidak ada progres yang cocok dengan pencarian."}
      </div>
    );
  }

  return (
    <div className="role-updates-list">
      {updates.map((update) => (
        <article className="role-update-row" key={update.id}>
          <div className={`staff-notification-icon ${update.status_verifikasi === "menunggu" ? "unread" : ""}`}>
            {update.status_verifikasi === "menunggu"
              ? <Clock3 size={16} />
              : <CheckCircle2 size={16} />}
          </div>
          <div className="role-update-copy">
            <div className="staff-task-meta">
              <span>{update.kode_pekerjaan}</span>
              {update.kode_proyek && <span>{update.kode_proyek}</span>}
            </div>
            <h3>{update.nama_pekerjaan}</h3>
            <p>
              Dilaporkan oleh <strong>{update.staff_nama}</strong>
              {" · "}{formatDate(update.tanggal_update)}
            </p>
            {update.catatan && <blockquote>{update.catatan}</blockquote>}
            {update.catatan_verifikasi && (
              <small className="role-review-note">Catatan verifikasi: {update.catatan_verifikasi}</small>
            )}
          </div>
          <div className="role-update-result">
            <strong>{Number(update.nilai_progres) || 0}%</strong>
            <span className={`role-verification status-${update.status_verifikasi}`}>
              {verificationLabel(update.status_verifikasi)}
            </span>
            {Number(update.jumlah_lampiran) > 0 && (
              <small><Paperclip size={12} /> {update.jumlah_lampiran} lampiran</small>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function NotificationPanel({ notifications, loading }) {
  return (
    <>
      <div className="staff-panel-heading">
        <div><h2>Notifikasi Terbaru</h2><p>Informasi terkait pekerjaan Anda</p></div>
        <Bell size={18} />
      </div>
      <div className="staff-notification-list">
        {loading ? (
          <div className="staff-empty">Memuat notifikasi...</div>
        ) : notifications.length === 0 ? (
          <div className="staff-empty">Belum ada notifikasi.</div>
        ) : notifications.map((item) => (
          <article className="staff-notification" key={item.id}>
            <div className={`staff-notification-icon ${item.dibaca_at ? "" : "unread"}`}>
              {item.tipe === "lewat_deadline" || item.tipe === "mendekati_deadline"
                ? <AlertTriangle size={16} />
                : item.tipe === "perlu_verifikasi"
                  ? <CheckCircle2 size={16} />
                  : <Bell size={16} />}
            </div>
            <div className="staff-notification-copy">
              <strong>{item.pesan}</strong>
              {item.nama_pekerjaan && (
                <span>
                  {item.kode_pekerjaan ? `${item.kode_pekerjaan} · ` : ""}
                  {item.nama_pekerjaan}
                </span>
              )}
              <small>{formatDate(item.created_at)}</small>
            </div>
            {!item.dibaca_at && <i aria-label="Belum dibaca" />}
          </article>
        ))}
      </div>
    </>
  );
}

export function SupervisorDashboard(props) {
  return <DashboardForRole {...props} role="supervisor" />;
}

export function EvaluatorDashboard(props) {
  return <DashboardForRole {...props} role="evaluator" />;
}
