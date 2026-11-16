import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChartColumn,
  ClipboardList,
  ChevronRight,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Paperclip,
  Search,
  Send,
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
      { key: "rencana_menunggu_review", label: "RENCANA MASUK", hint: "Menunggu pemeriksaan Planner", Icon: ClipboardList, tone: "violet" },
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
  plans: [],
  priorities: [],
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
    draft: "Draft",
    menunggu_review: "Menunggu Review",
    revisi: "Revisi",
    disetujui: "Disetujui",
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
  const [planStatusFilter, setPlanStatusFilter] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planHistory, setPlanHistory] = useState([]);
  const [planHistoryLoading, setPlanHistoryLoading] = useState(false);
  const [planActionError, setPlanActionError] = useState("");
  const [planActionMessage, setPlanActionMessage] = useState("");
  const [planActionSaving, setPlanActionSaving] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [taskPlan, setTaskPlan] = useState(null);
  const [taskForm, setTaskForm] = useState({});
  const [taskRequestKey, setTaskRequestKey] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
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

  const filteredPlans = useMemo(() => dashboard.plans.filter((plan) => {
    const matchesStatus = planStatusFilter === "all"
      || (planStatusFilter === "menunggu_review" && plan.status === "menunggu_review")
      || (planStatusFilter === "approved" && plan.status === "disetujui")
      || (planStatusFilter === "running" && plan.status === "berjalan");
    return matchesStatus && matchesQuery(plan, query);
  }), [dashboard.plans, planStatusFilter, query]);

  function goToSection(section) {
    setActiveSection(section);
    setSidebarOpen(false);
    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function openIncomingPlan(plan) {
    setSelectedPlan(plan);
    setRevisionNote("");
    setPlanActionError("");
    setPlanHistory([]);
    setPlanHistoryLoading(true);
    try {
      const response = await fetch(`${API_URL}/supervisor/plans/${plan.id}/history`, {
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal memuat riwayat rencana.");
      setPlanHistory(data.history || []);
    } catch (requestError) {
      setPlanActionError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend."
          : requestError.message || "Gagal memuat riwayat rencana."
      );
    } finally {
      setPlanHistoryLoading(false);
    }
  }

  async function reviewPlan(action) {
    if (!selectedPlan) return;
    setPlanActionError("");
    setPlanActionMessage("");
    setPlanActionSaving(true);
    try {
      const response = await fetch(`${API_URL}/supervisor/plans/${selectedPlan.id}/review`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, catatan: revisionNote }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal memeriksa rencana.");
      setSelectedPlan(null);
      setPlanActionMessage(data.message || "Pemeriksaan rencana berhasil disimpan.");
      await loadDashboard();
    } catch (requestError) {
      setPlanActionError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
          : requestError.message || "Gagal memeriksa rencana."
      );
    } finally {
      setPlanActionSaving(false);
    }
  }

  function openTaskForm(plan) {
    setPlanActionError("");
    setSelectedPlan(null);
    setTaskPlan(plan);
    setTaskRequestKey(window.crypto.randomUUID());
    setTaskForm({
      penanggung_jawab_id: "",
      nama_pekerjaan: plan.judul,
      deskripsi: plan.ruang_lingkup || "",
      target: plan.target || "",
      prioritas_id: String(plan.prioritas_id || ""),
      tgl_mulai: String(plan.tgl_rencana_mulai || "").slice(0, 10),
      deadline: String(plan.tgl_rencana_selesai || "").slice(0, 10),
    });
  }

  async function createStaffTask(event) {
    event.preventDefault();
    if (!taskPlan) return;
    setPlanActionError("");
    setTaskSaving(true);
    try {
      const response = await fetch(`${API_URL}/supervisor/plans/${taskPlan.id}/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...taskForm,
          idempotency_key: taskRequestKey,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal membuat pekerjaan.");
      setTaskPlan(null);
      setPlanActionMessage(data.message || "Pekerjaan berhasil dibuat.");
      await loadDashboard();
    } catch (requestError) {
      setPlanActionError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
          : requestError.message || "Gagal membuat pekerjaan."
      );
    } finally {
      setTaskSaving(false);
    }
  }

  async function markSupervisorNotificationRead(notification) {
    if (notification.dibaca_at) return;
    try {
      const response = await fetch(`${API_URL}/supervisor/notifications/${notification.id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal memperbarui notifikasi.");
      setDashboard((current) => ({
        ...current,
        notifications: current.notifications.map((item) =>
          item.id === notification.id
            ? { ...item, dibaca_at: new Date().toISOString() }
            : item
        ),
      }));
    } catch (requestError) {
      setPlanActionError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend."
          : requestError.message || "Gagal memperbarui notifikasi."
      );
    }
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
      {planActionError && (
        <div className="staff-error" role="alert">
          <div><strong>Proses rencana gagal</strong><span>{planActionError}</span></div>
          <button type="button" onClick={() => setPlanActionError("")}>Tutup</button>
        </div>
      )}
      {planActionMessage && (
        <div className="staff-success" role="status">
          <CheckCircle2 size={16} />
          <span>{planActionMessage}</span>
          <button type="button" onClick={() => setPlanActionMessage("")} aria-label="Tutup notifikasi">
            <X size={14} />
          </button>
        </div>
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
                className={activeSection === "incoming-plans" ? "active" : ""}
                onClick={() => goToSection("incoming-plans")}
              >
                <ClipboardList size={18} /> Rencana Masuk
                {Number(summary.rencana_menunggu_review) > 0 && (
                  <span className="staff-nav-count">{summary.rencana_menunggu_review}</span>
                )}
              </button>
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
              title={role === "supervisor" && Number(summary.rencana_menunggu_review) > 0
                ? `${summary.rencana_menunggu_review} rencana menunggu review`
                : "Lihat notifikasi"}
              onClick={() => goToSection(role === "supervisor" ? "incoming-plans" : "notifications")}
            >
              <Bell size={18} />
              {role === "supervisor" && Number(summary.rencana_menunggu_review) > 0 && (
                <i className="staff-notification-count">{summary.rencana_menunggu_review}</i>
              )}
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
              {role === "supervisor" && (
                <button type="button" onClick={() => goToSection("incoming-plans")}>
                  Tinjau rencana masuk <ChevronRight size={16} />
                </button>
              )}
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

          {role === "supervisor" && (
            <section className="staff-panel supervisor-plan-panel" id="incoming-plans">
              <div className="staff-panel-heading">
                <div>
                  <h2>Rencana Masuk</h2>
                  <p>Rencana dari Planner dalam divisi Anda untuk diperiksa atau diturunkan menjadi pekerjaan</p>
                </div>
                <span>{formatCount(dashboard.plans.length)} rencana</span>
              </div>
              <div className="supervisor-plan-toolbar">
                <div className="staff-filter-tabs" role="group" aria-label="Filter status rencana">
                  {[
                    ["all", "Semua"],
                    ["menunggu_review", "Menunggu Review"],
                    ["approved", "Disetujui"],
                    ["running", "Berjalan"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      className={planStatusFilter === value ? "active" : ""}
                      key={value}
                      onClick={() => setPlanStatusFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="supervisor-plan-list">
                {loading ? (
                  <div className="staff-empty">Memuat rencana masuk...</div>
                ) : filteredPlans.length === 0 ? (
                  <div className="staff-empty">
                    {dashboard.plans.length === 0
                      ? "Belum ada rencana masuk atau rencana yang siap dibuat menjadi pekerjaan."
                      : "Tidak ada rencana yang cocok dengan pencarian dan filter."}
                  </div>
                ) : filteredPlans.map((plan) => (
                  <article className="supervisor-plan-row" key={plan.id}>
                    <div className="supervisor-plan-copy">
                      <div className="staff-task-meta">
                        <span>{plan.kode_proyek}</span>
                        <span>{plan.tipe_rencana}</span>
                        <span>{plan.prioritas}</span>
                      </div>
                      <h3>{plan.judul}</h3>
                      <p>{plan.nama_proyek} · {plan.jenis_pekerjaan} · Planner {plan.planner_nama}</p>
                      <div className="supervisor-plan-meta">
                        <span><CalendarDays size={13} /> {formatDate(plan.tgl_rencana_mulai)} · {plan.durasi_hari} hari</span>
                        <span><Users size={13} /> PIC awal: {plan.pic_awal_nama || "Belum ditentukan"}</span>
                        {Number(plan.jumlah_pekerjaan) > 0 && (
                          <span>{formatCount(plan.jumlah_pekerjaan)} pekerjaan terkait</span>
                        )}
                      </div>
                    </div>
                    <div className="supervisor-plan-actions">
                      <span className={`planner-status status-${plan.status}`}>{statusLabel(plan.status)}</span>
                      <button type="button" onClick={() => openIncomingPlan(plan)}>
                        <FileText size={14} /> Lihat Detail
                      </button>
                      {["disetujui", "berjalan"].includes(plan.status) && (
                        <button type="button" className="primary" onClick={() => openTaskForm(plan)}>
                          <BriefcaseBusiness size={14} /> Buat Pekerjaan
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

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
                <NotificationPanel
                  notifications={dashboard.notifications}
                  loading={loading}
                  onRead={markSupervisorNotificationRead}
                />
              </section>
            </>
          )}

          {role === "supervisor" && selectedPlan && (
            <div className="supervisor-modal-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget && !planActionSaving) setSelectedPlan(null);
            }}>
              <section className="supervisor-workflow-modal" role="dialog" aria-modal="true" aria-labelledby="supervisor-plan-title">
                <div className="supervisor-modal-heading">
                  <div>
                    <span>{selectedPlan.kode_proyek} · {selectedPlan.nama_proyek}</span>
                    <h2 id="supervisor-plan-title">{selectedPlan.judul}</h2>
                    <p>Diajukan oleh {selectedPlan.planner_nama}</p>
                  </div>
                  <span className={`planner-status status-${selectedPlan.status}`}>{statusLabel(selectedPlan.status)}</span>
                  <button type="button" className="staff-icon-button" onClick={() => setSelectedPlan(null)} aria-label="Tutup detail rencana">
                    <X size={17} />
                  </button>
                </div>
                <dl className="supervisor-plan-details">
                  <div><dt>Jenis pekerjaan</dt><dd>{selectedPlan.jenis_pekerjaan}</dd></div>
                  <div><dt>Tipe rencana</dt><dd>{selectedPlan.tipe_rencana}</dd></div>
                  <div><dt>Prioritas</dt><dd>{selectedPlan.prioritas}</dd></div>
                  <div><dt>Tanggal mulai</dt><dd>{formatDate(selectedPlan.tgl_rencana_mulai)}</dd></div>
                  <div><dt>Durasi</dt><dd>{selectedPlan.durasi_hari} hari</dd></div>
                  <div><dt>Estimasi selesai</dt><dd>{formatDate(selectedPlan.tgl_rencana_selesai)}</dd></div>
                  <div><dt>PIC awal</dt><dd>{selectedPlan.pic_awal_nama || "Belum ditentukan"}</dd></div>
                  <div><dt>Jumlah pekerjaan</dt><dd>{formatCount(selectedPlan.jumlah_pekerjaan)}</dd></div>
                </dl>
                <div className="supervisor-plan-notes">
                  <article><h3>Ruang lingkup</h3><p>{selectedPlan.ruang_lingkup || "Belum diisi."}</p></article>
                  <article><h3>Target</h3><p>{selectedPlan.target || "Belum diisi."}</p></article>
                  <article><h3>Dasar permintaan</h3><p>{selectedPlan.dasar_permintaan || "Belum diisi."}</p></article>
                </div>
                <section className="supervisor-plan-history">
                  <h3>Riwayat Status</h3>
                  {planHistoryLoading ? (
                    <p>Memuat riwayat...</p>
                  ) : planHistory.length === 0 ? (
                    <p>Belum ada riwayat status.</p>
                  ) : (
                    <ol>
                      {planHistory.map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.status_lama ? `${statusLabel(entry.status_lama)} → ` : ""}{statusLabel(entry.status_baru)}</strong>
                          <small>{entry.diubah_oleh || "Pengguna"} · {formatDate(entry.created_at)}</small>
                          {entry.catatan && <p>{entry.catatan}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                {selectedPlan.status === "menunggu_review" && (
                  <label className="supervisor-revision-field">
                    <span>Catatan revisi <b>(wajib jika meminta revisi)</b></span>
                    <textarea
                      value={revisionNote}
                      onChange={(event) => setRevisionNote(event.target.value)}
                      maxLength={5000}
                      placeholder="Tuliskan bagian rencana yang perlu diperbaiki..."
                    />
                  </label>
                )}
                {planActionError && <p className="supervisor-modal-error" role="alert">{planActionError}</p>}
                <div className="supervisor-modal-actions">
                  <button type="button" onClick={() => setSelectedPlan(null)} disabled={planActionSaving}>Tutup</button>
                  {selectedPlan.status === "menunggu_review" && (
                    <>
                      <button type="button" onClick={() => reviewPlan("revision")} disabled={planActionSaving || !revisionNote.trim()}>
                        Minta Revisi
                      </button>
                      <button type="button" className="primary" onClick={() => reviewPlan("approve")} disabled={planActionSaving}>
                        <CheckCircle2 size={15} /> {planActionSaving ? "Menyimpan..." : "Setujui Rencana"}
                      </button>
                    </>
                  )}
                  {["disetujui", "berjalan"].includes(selectedPlan.status) && (
                    <button type="button" className="primary" onClick={() => openTaskForm(selectedPlan)}>
                      <BriefcaseBusiness size={15} /> Buat Pekerjaan
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {role === "supervisor" && taskPlan && (
            <div className="supervisor-modal-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget && !taskSaving) setTaskPlan(null);
            }}>
              <form className="supervisor-workflow-modal" onSubmit={createStaffTask}>
                <div className="supervisor-modal-heading">
                  <div>
                    <span>{taskPlan.kode_proyek} · {taskPlan.nama_proyek}</span>
                    <h2>Buat Pekerjaan dari Rencana</h2>
                    <p>{taskPlan.judul}</p>
                  </div>
                  <button type="button" className="staff-icon-button" onClick={() => setTaskPlan(null)} aria-label="Tutup form pekerjaan">
                    <X size={17} />
                  </button>
                </div>
                <div className="supervisor-task-form">
                  <label>
                    <span>Staff penanggung jawab *</span>
                    <select
                      value={taskForm.penanggung_jawab_id || ""}
                      onChange={(event) => setTaskForm((current) => ({ ...current, penanggung_jawab_id: event.target.value }))}
                      required
                    >
                      <option value="">Pilih Staff</option>
                      {dashboard.team.map((staff) => (
                        <option key={staff.id} value={staff.id}>{staff.nama} (@{staff.username})</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Judul pekerjaan *</span>
                    <input
                      value={taskForm.nama_pekerjaan || ""}
                      onChange={(event) => setTaskForm((current) => ({ ...current, nama_pekerjaan: event.target.value }))}
                      maxLength={500}
                      required
                    />
                  </label>
                  <label>
                    <span>Prioritas *</span>
                    <select
                      value={taskForm.prioritas_id || ""}
                      onChange={(event) => setTaskForm((current) => ({ ...current, prioritas_id: event.target.value }))}
                      required
                    >
                      <option value="">Pilih prioritas</option>
                      {dashboard.priorities.map((priority) => (
                        <option key={priority.id} value={priority.id}>{priority.nama}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Tanggal mulai *</span>
                    <input
                      type="date"
                      value={taskForm.tgl_mulai || ""}
                      onChange={(event) => setTaskForm((current) => ({ ...current, tgl_mulai: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    <span>Tanggal selesai *</span>
                    <input
                      type="date"
                      value={taskForm.deadline || ""}
                      onChange={(event) => setTaskForm((current) => ({ ...current, deadline: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="wide">
                    <span>Deskripsi pekerjaan</span>
                    <textarea
                      value={taskForm.deskripsi || ""}
                      onChange={(event) => setTaskForm((current) => ({ ...current, deskripsi: event.target.value }))}
                      maxLength={5000}
                    />
                  </label>
                  <label className="wide">
                    <span>Target pekerjaan</span>
                    <textarea
                      value={taskForm.target || ""}
                      onChange={(event) => setTaskForm((current) => ({ ...current, target: event.target.value }))}
                      maxLength={5000}
                    />
                  </label>
                </div>
                {planActionError && <p className="supervisor-modal-error" role="alert">{planActionError}</p>}
                <div className="supervisor-modal-actions">
                  <button type="button" onClick={() => setTaskPlan(null)} disabled={taskSaving}>Batal</button>
                  <button type="submit" className="primary" disabled={taskSaving || dashboard.team.length === 0}>
                    <Send size={15} /> {taskSaving ? "Membuat pekerjaan..." : "Buat Pekerjaan"}
                  </button>
                </div>
                {dashboard.team.length === 0 && <p className="supervisor-modal-error">Belum ada Staff aktif yang berada dalam tim Anda.</p>}
              </form>
            </div>
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

function NotificationPanel({ notifications, loading, onRead }) {
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
              {item.judul_rencana && <span>Rencana: {item.judul_rencana}</span>}
              <small>{formatDate(item.created_at)}</small>
            </div>
            {onRead && !item.dibaca_at && (
              <button
                type="button"
                className="staff-notification-read"
                onClick={() => onRead(item)}
              >
                Tandai dibaca
              </button>
            )}
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
