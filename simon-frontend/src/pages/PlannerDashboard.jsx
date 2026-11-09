import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  FilePlus2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  CalendarRange,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import "./PlannerDashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const emptyDashboard = {
  summary: {
    total_rencana: 0,
    rencana_draft: 0,
    rencana_berjalan: 0,
    rencana_selesai: 0,
    total_proyek: 0,
    proyek_aktif: 0,
  },
  plans: [],
  projects: [],
  options: {
    jenisPekerjaan: [],
    fungsi: [],
    prioritas: [],
    staff: [],
  },
};

const projectFields = [
  { name: "kode", label: "Kode proyek", type: "text", required: true, maxLength: 30 },
  { name: "nama", label: "Nama proyek", type: "text", required: true, maxLength: 200 },
  { name: "deskripsi", label: "Deskripsi", type: "textarea", wide: true },
  { name: "tahun", label: "Tahun", type: "number", required: true, min: 2000, max: 2200 },
  { name: "periode_mulai", label: "Periode mulai", type: "date", required: true },
  { name: "periode_selesai", label: "Periode selesai", type: "date", required: true },
  { name: "target_jumlah", label: "Target pekerjaan", type: "number", min: 0, max: 4294967295 },
  { name: "status", label: "Status", type: "select", required: true, options: ["draft", "aktif", "selesai", "arsip"] },
];

const planFields = [
  { name: "proyek_id", label: "Proyek", type: "project", required: true },
  { name: "rencana_asal_id", label: "Rencana asal", type: "origin" },
  { name: "tipe_rencana", label: "Tipe rencana", type: "select", required: true, options: ["plan", "extra", "special"] },
  { name: "tahun_plan", label: "Tahun plan", type: "number", min: 2000, max: 2200 },
  { name: "jangka", label: "Jangka", type: "select", required: true, options: ["jangka_pendek", "bulanan", "tahunan"] },
  { name: "jenis_id", label: "Jenis pekerjaan", type: "jenisPekerjaan", required: true },
  { name: "fungsi_id", label: "Fungsi", type: "fungsi" },
  { name: "prioritas_id", label: "Prioritas", type: "prioritas", required: true },
  { name: "judul", label: "Judul rencana", type: "text", required: true, maxLength: 500, wide: true },
  { name: "ruang_lingkup", label: "Ruang lingkup", type: "textarea", wide: true },
  { name: "target", label: "Target", type: "textarea", wide: true },
  { name: "dasar_permintaan", label: "Dasar permintaan", type: "textarea", wide: true },
  { name: "media_permintaan", label: "Media permintaan", type: "select", options: ["email", "surat", "whatsapp", "lisan", "rapat", "hardcopy", "lainnya"] },
  { name: "tgl_rencana_mulai", label: "Tanggal mulai", type: "date", required: true },
  { name: "durasi_hari", label: "Durasi (hari)", type: "number", required: true, min: 1, max: 65535 },
  { name: "pic_awal_id", label: "PIC awal", type: "staff" },
  { name: "status", label: "Status", type: "select", required: true, options: ["draft", "disetujui", "berjalan", "selesai", "dibatalkan"] },
  { name: "alasan_batal", label: "Alasan batal", type: "text", maxLength: 255 },
];

const todayLabel = new Date().toLocaleDateString("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

async function fetchPlannerDashboard(token) {
  const response = await fetch(`${API_URL}/planner/dashboard`, {
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Gagal memuat dashboard planner.");
  }
  return {
    summary: { ...emptyDashboard.summary, ...data.summary },
    plans: data.plans || [],
    projects: data.projects || [],
    options: { ...emptyDashboard.options, ...data.options },
  };
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusLabel(status) {
  return {
    draft: "Draft",
    disetujui: "Disetujui",
    berjalan: "Berjalan",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan",
    arsip: "Arsip",
  }[status] || status || "Belum ditentukan";
}

function initials(name) {
  return String(name || "Planner")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function formValues(fields, item = null) {
  return Object.fromEntries(fields.map((field) => {
    const value = item?.[field.name];
    if (field.type === "date") {
      return [field.name, value ? String(value).slice(0, 10) : ""];
    }
    if (value === undefined && field.name === "tahun") {
      return [field.name, String(new Date().getFullYear())];
    }
    if (value === undefined && field.name === "tipe_rencana") return [field.name, "plan"];
    if (value === undefined && field.name === "jangka") return [field.name, "tahunan"];
    if (value === undefined && field.name === "status") {
      return [field.name, field.options?.[0] || ""];
    }
    return [field.name, value === null || value === undefined ? "" : String(value)];
  }));
}

export default function PlannerDashboard({ session, onLogout }) {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [projectActionId, setProjectActionId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState("");
  const [notice, setNotice] = useState("");
  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const userName = session?.user?.nama || "Planner";
  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      setDashboard(await fetchPlannerDashboard(session?.token));
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
          : requestError.message || "Gagal memuat dashboard planner."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchPlannerDashboard(session?.token)
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError instanceof TypeError
            ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
            : requestError.message || "Gagal memuat dashboard planner."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.token]);

  useEffect(() => {
    if (activeSection === "projects") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (activeSection === "dashboard") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(activeSection)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeSection]);

  const filteredPlans = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return dashboard.plans;
    return dashboard.plans.filter((plan) =>
      [
        plan.judul,
        plan.kode_proyek,
        plan.nama_proyek,
        plan.jenis_pekerjaan,
        plan.fungsi,
        plan.status,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery))
    );
  }, [dashboard.plans, query]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return dashboard.projects;
    return dashboard.projects.filter((project) =>
      [project.nama, project.kode, project.tahun, project.status]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery))
    );
  }, [dashboard.projects, query]);

  const monitoredPlans = useMemo(() => {
    const upcomingLimit = new Date(today);
    upcomingLimit.setDate(upcomingLimit.getDate() + 14);

    return dashboard.plans.map((plan) => {
      const start = parseDateOnly(plan.tgl_rencana_mulai);
      const end = parseDateOnly(plan.tgl_rencana_selesai);
      const isClosed = ["selesai", "dibatalkan"].includes(plan.status);
      const overdue = Boolean(end && end < today && !isClosed);
      const upcoming = Boolean(start && start >= today && start <= upcomingLimit && !isClosed);

      return { ...plan, start, end, overdue, upcoming };
    });
  }, [dashboard.plans, today]);

  const projectManagement = useMemo(() => {
    const projects = dashboard.projects.map((project) => {
      const plans = dashboard.plans.filter(
        (plan) => String(plan.proyek_id) === String(project.id)
      );
      const jobCount = plans.reduce(
        (total, plan) => total + (Number(plan.jumlah_pekerjaan) || 0),
        0
      );
      const weightedProgress = plans.reduce(
        (total, plan) => total
          + (Number(plan.jumlah_pekerjaan) || 0) * (Number(plan.rata_progres) || 0),
        0
      );
      const progress = jobCount
        ? Math.round(weightedProgress / jobCount)
        : plans.length
          ? Math.round(plans.reduce((total, plan) => total + (Number(plan.rata_progres) || 0), 0) / plans.length)
          : 0;

      return {
        ...project,
        plansCount: plans.length,
        jobCount,
        progress,
        overdueCount: monitoredPlans.filter(
          (plan) => String(plan.proyek_id) === String(project.id) && plan.overdue
        ).length,
      };
    });
    const targetJobs = projects.reduce(
      (total, project) => total + (Number(project.target_jumlah) || 0),
      0
    );
    const actualJobs = projects.reduce((total, project) => total + project.jobCount, 0);
    const progressWeight = projects.reduce(
      (total, project) => total + (Number(project.target_jumlah) || project.jobCount || 0),
      0
    );
    const progress = progressWeight
      ? Math.round(projects.reduce(
        (total, project) => total
          + project.progress * (Number(project.target_jumlah) || project.jobCount || 0),
        0
      ) / progressWeight)
      : 0;
    const featuredProject = projects.find((project) => project.status === "aktif") || projects[0] || null;

    return {
      projects,
      featuredProject,
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.status === "aktif").length,
      targetJobs,
      actualJobs,
      progress,
      atRiskProjects: projects.filter((project) => project.overdueCount > 0).length,
    };
  }, [dashboard.projects, dashboard.plans, monitoredPlans]);

  const planTimeline = useMemo(() => {
    const datedPlans = monitoredPlans
      .filter((plan) => plan.start && plan.end)
      .sort((first, second) => first.start - second.start);
    if (!datedPlans.length) return [];
    const minDate = Math.min(...datedPlans.map((plan) => plan.start.getTime()));
    const maxDate = Math.max(...datedPlans.map((plan) => plan.end.getTime()));
    const totalSpan = Math.max(1, maxDate - minDate);

    return datedPlans.map((plan) => {
      const left = ((plan.start.getTime() - minDate) / totalSpan) * 100;
      const width = Math.max(((plan.end.getTime() - plan.start.getTime()) / totalSpan) * 100, 1.5);
      return {
        ...plan,
        left: Math.min(98.5, Math.max(0, left)),
        width: Math.min(100 - left, width),
      };
    });
  }, [monitoredPlans]);

  const monitoringSummary = useMemo(() => ({
    overdue: monitoredPlans.filter((plan) => plan.overdue).length,
    upcoming: monitoredPlans.filter((plan) => plan.upcoming).length,
    active: monitoredPlans.filter((plan) => ["disetujui", "berjalan"].includes(plan.status)).length,
    completed: monitoredPlans.filter((plan) => plan.status === "selesai").length,
  }), [monitoredPlans]);

  const dashboardOverview = useMemo(() => {
    const year = today.getFullYear();
    const quarter = Math.floor(today.getMonth() / 3);
    const quarterStart = new Date(year, quarter * 3, 1);
    const quarterEnd = new Date(year, quarter * 3 + 3, 0);
    const monthStart = new Date(year, today.getMonth(), 1);
    const monthEnd = new Date(year, today.getMonth() + 1, 0);
    const agendaLimit = new Date(today);
    agendaLimit.setDate(agendaLimit.getDate() + 30);
    const yearProjects = dashboard.projects.filter(
      (project) => Number(project.tahun) === year
    );
    const yearProjectIds = new Set(yearProjects.map((project) => String(project.id)));
    const annualTarget = yearProjects.reduce(
      (total, project) => total + (Number(project.target_jumlah) || 0),
      0
    );
    const annualPlans = dashboard.plans.filter(
      (plan) => yearProjectIds.has(String(plan.proyek_id))
    );
    const annualProgress = annualTarget
      ? Math.min(100, Math.round((annualPlans.length / annualTarget) * 100))
      : 0;
    const pipeline = [
      { key: "draft", label: "Draft" },
      { key: "disetujui", label: "Disetujui" },
      { key: "berjalan", label: "Berjalan" },
      { key: "selesai", label: "Selesai" },
      { key: "dibatalkan", label: "Dibatalkan" },
    ].map((stage) => ({
      ...stage,
      count: dashboard.plans.filter((plan) => plan.status === stage.key).length,
    }));
    const quarterPlans = monitoredPlans.filter(
      (plan) => plan.start && plan.end && plan.start <= quarterEnd && plan.end >= quarterStart
    );
    const monthlyMilestones = monitoredPlans.reduce((total, plan) => {
      return total
        + Number(Boolean(plan.start && plan.start >= monthStart && plan.start <= monthEnd))
        + Number(Boolean(plan.end && plan.end >= monthStart && plan.end <= monthEnd));
    }, 0);
    const agenda = monitoredPlans.flatMap((plan) => {
      const events = [];
      if (plan.start && plan.start >= today && plan.start <= agendaLimit) {
        events.push({ plan, date: plan.start, label: "Mulai rencana" });
      }
      if (plan.end && plan.end >= today && plan.end <= agendaLimit) {
        events.push({ plan, date: plan.end, label: "Target selesai" });
      }
      return events;
    }).sort((first, second) => first.date - second.date).slice(0, 3);

    return {
      year,
      quarterLabel: `Kuartal ${["I", "II", "III", "IV"][quarter]}`,
      monthLabel: today.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      annualTarget,
      annualPlans: annualPlans.length,
      annualProgress,
      pipeline,
      quarterPlans,
      monthlyMilestones,
      quarterCompleted: quarterPlans.filter((plan) => plan.status === "selesai").length,
      quarterActive: quarterPlans.filter((plan) => ["disetujui", "berjalan"].includes(plan.status)).length,
      quarterAtRisk: quarterPlans.filter((plan) => plan.overdue).length,
      agenda,
    };
  }, [dashboard.plans, dashboard.projects, monitoredPlans, today]);

  function goToSection(section) {
    setActiveSection(section);
    setSidebarOpen(false);
    if (section === "projects") {
      setProjectActionId(null);
    }
  }

  function openCreate(kind) {
    const fields = kind === "project" ? projectFields : planFields;
    setEditor({ kind, item: null });
    setForm(formValues(fields));
    setError("");
    setNotice("");
  }

  function openEdit(kind, item) {
    const fields = kind === "project" ? projectFields : planFields;
    setEditor({ kind, item });
    setForm(formValues(fields, item));
    setError("");
    setNotice("");
  }

  function closeEditor() {
    if (!saving) {
      setEditor(null);
      setForm({});
    }
  }

  function updateFormField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function savePlannerItem(event) {
    event.preventDefault();
    if (!editor) return;

    const fields = editor.kind === "project" ? projectFields : planFields;
    const payload = Object.fromEntries(fields.map((field) => [
      field.name,
      field.type === "number"
        ? form[field.name] === "" ? null : Number(form[field.name])
        : form[field.name] || null,
    ]));
    const resource = editor.kind === "project" ? "projects" : "plans";
    const method = editor.item ? "PUT" : "POST";
    const path = editor.item
      ? `${API_URL}/planner/${resource}/${editor.item.id}`
      : `${API_URL}/planner/${resource}`;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(path, {
        method,
        headers: {
          Authorization: `Bearer ${session?.token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal menyimpan data.");
      setEditor(null);
      setForm({});
      setNotice(data.message || "Data berhasil disimpan.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
        : requestError.message || "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlannerItem(kind, item) {
    const label = kind === "project" ? item.nama : item.judul;
    if (!window.confirm(`Hapus "${label}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    const resource = kind === "project" ? "projects" : "plans";
    const key = `${kind}-${item.id}`;
    setDeleting(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/planner/${resource}/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal menghapus data.");
      setNotice(data.message || "Data berhasil dihapus.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
        : requestError.message || "Gagal menghapus data.");
    } finally {
      setDeleting("");
    }
  }

  function fieldOptions(field) {
    const options = dashboard.options;
    if (field.type === "project") {
      return dashboard.projects.map((item) => ({ value: item.id, label: `${item.kode} — ${item.nama}` }));
    }
    if (field.type === "origin") {
      return dashboard.plans
        .filter((item) => String(item.id) !== String(editor?.item?.id))
        .map((item) => ({ value: item.id, label: item.judul }));
    }
    if (field.type === "jenisPekerjaan") {
      return options.jenisPekerjaan.map((item) => ({ value: item.id, label: `${item.kode} — ${item.nama}` }));
    }
    if (field.type === "fungsi" || field.type === "prioritas") {
      return options[field.type].map((item) => ({ value: item.id, label: item.nama }));
    }
    if (field.type === "staff") {
      return options.staff.map((item) => ({ value: item.id, label: `${item.nama} (@${item.username})` }));
    }
    return (field.options || []).map((value) => ({
      value,
      label: value.replaceAll("_", " "),
    }));
  }

  const summary = dashboard.summary;

  return (
    <div className="planner-dashboard">
      {sidebarOpen && (
        <button
          className="planner-sidebar-overlay"
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`planner-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="planner-brand">
          <div className="planner-brand-icon"><ChartColumn size={25} /></div>
          <div>
            <h2>SIMON</h2>
            <span>Monitoring System</span>
          </div>
        </div>

        <span className="planner-nav-label">RUANG KERJA</span>
        <nav className="planner-nav">
          <button
            type="button"
            className={activeSection === "dashboard" ? "active" : ""}
            onClick={() => goToSection("dashboard")}
          >
            <LayoutDashboard size={18} /> Dashboard Planner
          </button>
          <button
            type="button"
            className={activeSection === "projects" ? "active" : ""}
            onClick={() => goToSection("projects")}
          >
            <FolderKanban size={18} /> Manajemen Proyek
          </button>
          <button
            type="button"
            className={activeSection === "plans" ? "active" : ""}
            onClick={() => goToSection("plans")}
          >
            <ClipboardList size={18} /> Rencana Pekerjaan
            {Number(summary.rencana_draft) > 0 && (
              <span className="planner-nav-count">{summary.rencana_draft}</span>
            )}
          </button>
          <button
            type="button"
            className={activeSection === "timeline" ? "active" : ""}
            onClick={() => goToSection("timeline")}
          >
            <CalendarRange size={18} /> Timeline Perencanaan
          </button>
          <button
            type="button"
            className={activeSection === "monitoring" ? "active" : ""}
            onClick={() => goToSection("monitoring")}
          >
            <ClipboardCheck size={18} /> Monitoring Rencana
            {monitoringSummary.overdue > 0 && (
              <span className="planner-nav-count">{monitoringSummary.overdue}</span>
            )}
          </button>
        </nav>

        <div className="planner-sidebar-bottom">
          <button type="button" onClick={onLogout}>
            <LogOut size={18} /> Keluar
          </button>
          <span>SIMON · Monitoring pekerjaan</span>
        </div>
      </aside>

      <main className="planner-main" id="dashboard">
        <header className="planner-topbar">
          <div className="planner-top-left">
            <button
              className="planner-icon-button planner-mobile-menu"
              type="button"
              aria-label="Buka navigasi"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={19} />
            </button>
            <label className="planner-global-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari rencana atau proyek..."
                aria-label="Cari rencana atau proyek"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Hapus pencarian"
                >
                  <X size={15} />
                </button>
              )}
            </label>
          </div>
          <div className="planner-top-actions">
            <span className="planner-date"><CalendarDays size={16} /> {todayLabel}</span>
            <button
              className="planner-icon-button"
              type="button"
              title="Muat ulang dashboard"
              onClick={loadDashboard}
              disabled={loading}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="planner-icon-button planner-notification"
              type="button"
              title={`${summary.rencana_draft || 0} rencana berstatus draft`}
              onClick={() => goToSection("plans")}
            >
              <Bell size={18} />
              {Number(summary.rencana_draft) > 0 && <i />}
            </button>
            <div className="planner-top-user">
              <div className="planner-avatar">{initials(userName)}</div>
              <div><strong>{userName}</strong><span>PLANNER</span></div>
            </div>
          </div>
        </header>

        <div className={`planner-content ${activeSection === "projects" ? "planner-content-projects" : ""}`}>
          <div className="planner-page-title">
            <div>
              <h1>Dashboard Planner</h1>
              <p>Kelola proyek, susun rencana kerja, dan pantau jadwal dalam satu ruang kerja.</p>
            </div>
          </div>

          {error && (
            <div className="planner-error" role="alert">
              <div><strong>Dashboard belum dapat dimuat</strong><span>{error}</span></div>
              <button type="button" onClick={loadDashboard}>Coba lagi</button>
            </div>
          )}
          {notice && <div className="planner-notice" role="status">{notice}</div>}

          <section className="planner-hero planner-portfolio-hero">
            <div className="planner-hero-copy">
              <span className="planner-eyebrow">PERENCANAAN {dashboardOverview.year}</span>
              <h2>Portofolio rencana dalam kendali</h2>
              <p>
                {formatCount(summary.total_rencana)} rencana tersebar di {formatCount(summary.total_proyek)} proyek
                {dashboardOverview.annualTarget > 0
                  ? ` tahun ini, dengan capaian ${dashboardOverview.annualProgress}% dari target tahunan.`
                  : " yang Anda kelola."}
              </p>
            </div>
            <button type="button" className="planner-portfolio-create" onClick={() => openCreate("plan")} disabled={dashboard.projects.length === 0}>
              Buat Rencana <Plus size={17} />
            </button>
          </section>

          <section className="planner-overview-stats" aria-label="Ringkasan perencanaan tahunan">
            <article>
              <span>Target tahunan</span>
              <strong>{loading ? "—" : formatCount(dashboardOverview.annualTarget)}</strong>
              <small>rencana pekerjaan</small>
            </article>
            <article>
              <span>Sudah direncanakan</span>
              <strong>{loading ? "—" : formatCount(dashboardOverview.annualPlans)}</strong>
              <small>{dashboardOverview.annualProgress}% dari target</small>
            </article>
            <article>
              <span>Menunggu tindak lanjut</span>
              <strong>{loading ? "—" : formatCount(summary.rencana_draft)}</strong>
              <small>rencana berstatus draft</small>
            </article>
            <article className="planner-overview-progress">
              <div><span>Capaian rencana</span><strong>{loading ? "—" : `${dashboardOverview.annualProgress}%`}</strong></div>
              <div className="planner-overview-progress-track" role="progressbar" aria-label="Capaian target tahunan" aria-valuemin="0" aria-valuemax="100" aria-valuenow={dashboardOverview.annualProgress}>
                <i style={{ width: `${dashboardOverview.annualProgress}%` }} />
              </div>
            </article>
          </section>

          <div className="planner-overview-grid">
            <section className="planner-panel planner-pipeline-panel">
              <div className="planner-panel-heading">
                <div>
                  <h2>Pipeline Perencanaan</h2>
                  <p>Posisi seluruh rencana pada siklus perencanaan</p>
                </div>
                <button type="button" className="planner-text-link" onClick={() => goToSection("timeline")}>
                  Buka timeline <ChevronRight size={15} />
                </button>
              </div>
              <div className="planner-pipeline-list">
                {dashboardOverview.pipeline.map((stage, index) => (
                  <div className="planner-pipeline-row" key={stage.key}>
                    <span className="planner-pipeline-number">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{stage.label}</strong>
                    <div className="planner-pipeline-track">
                      <i style={{ width: `${(stage.count / Math.max(1, summary.total_rencana)) * 100}%` }} />
                    </div>
                    <b>{loading ? "—" : formatCount(stage.count)}</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="planner-panel planner-quarter-panel">
              <div className="planner-panel-heading">
                <div>
                  <h2>Fokus {dashboardOverview.quarterLabel}</h2>
                  <p>{dashboardOverview.monthLabel}</p>
                </div>
                <span className="planner-quarter-badge">Q{Math.floor(today.getMonth() / 3) + 1}</span>
              </div>
              <div className="planner-quarter-total">
                <strong>{loading ? "—" : formatCount(dashboardOverview.monthlyMilestones)}</strong>
                <span>milestone bulan ini</span>
              </div>
              <div className="planner-quarter-status">
                <div><i className="quarter-complete" /><span>Selesai</span><strong>{formatCount(dashboardOverview.quarterCompleted)}</strong></div>
                <div><i className="quarter-active" /><span>Berjalan</span><strong>{formatCount(dashboardOverview.quarterActive)}</strong></div>
                <div><i className="quarter-risk" /><span>Berisiko</span><strong>{formatCount(dashboardOverview.quarterAtRisk)}</strong></div>
              </div>
            </section>
          </div>

          <section className="planner-panel planner-agenda-panel">
            <div className="planner-panel-heading">
              <div>
                <h2>Agenda Perencanaan Terdekat</h2>
                <p>Milestone rencana yang perlu dijaga dalam 30 hari</p>
              </div>
              <button type="button" className="planner-text-link" onClick={() => goToSection("projects")}>
                Semua proyek <ChevronRight size={15} />
              </button>
            </div>
            {loading ? (
              <div className="planner-empty">Memuat agenda...</div>
            ) : dashboardOverview.agenda.length === 0 ? (
              <div className="planner-empty">Belum ada milestone dalam 30 hari ke depan.</div>
            ) : (
              <div className="planner-agenda-list">
                {dashboardOverview.agenda.map((event, index) => (
                  <button
                    className="planner-agenda-item"
                    key={`${event.plan.id}-${event.label}-${index}`}
                    type="button"
                    onClick={() => goToSection("plans")}
                  >
                    <span className="planner-agenda-date">{event.date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
                    <span className="planner-agenda-copy">
                      <small>{event.label}</small>
                      <strong>{event.plan.judul}</strong>
                      <span>{event.plan.nama_proyek}</span>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="planner-workspace">
            <section className="planner-panel planner-plan-panel" id="plans">
              <div className="planner-panel-heading">
                <div>
                  <h2>Rencana Pekerjaan</h2>
                  <p>Rencana pekerjaan yang Anda buat</p>
                </div>
                <div className="planner-heading-actions">
                  <span className="planner-heading-total">{formatCount(summary.total_rencana)} rencana</span>
                  <button type="button" className="planner-add-button" onClick={() => openCreate("plan")} disabled={dashboard.projects.length === 0}>
                    <Plus size={14} /> Tambah rencana
                  </button>
                </div>
              </div>

              {dashboard.projects.length === 0 && !loading && (
                <div className="planner-inline-hint">
                  Buat proyek terlebih dahulu sebelum menambahkan rencana pekerjaan.
                </div>
              )}

              <div className="planner-plan-list">
                {loading ? (
                  <div className="planner-empty">Memuat rencana pekerjaan...</div>
                ) : filteredPlans.length === 0 ? (
                  <div className="planner-empty">
                    {query ? "Tidak ada rencana yang cocok dengan pencarian." : "Belum ada rencana pekerjaan."}
                  </div>
                ) : filteredPlans.map((plan, index) => (
                  <article className="planner-plan-row" key={plan.id}>
                    <div className={`planner-plan-number plan-number-${index % 4}`}>
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="planner-plan-info">
                      <div className="planner-plan-meta">
                        <span>{plan.kode_proyek}</span>
                        {plan.fungsi && <span>{plan.fungsi}</span>}
                        {plan.prioritas && <span>{plan.prioritas}</span>}
                      </div>
                      <h3>{plan.judul}</h3>
                      <p>{plan.nama_proyek} · {plan.jenis_pekerjaan} · {plan.tipe_rencana} · {plan.jangka}</p>
                      <div className="planner-plan-dates">
                        <CalendarDays size={13} />
                        {formatDate(plan.tgl_rencana_mulai)} – {formatDate(plan.tgl_rencana_selesai)}
                      </div>
                    </div>
                    <div className="planner-plan-result">
                      <strong>{Number(plan.rata_progres) || 0}%</strong>
                      <span className={`planner-status status-${plan.status}`}>
                        {statusLabel(plan.status)}
                      </span>
                      <small>{formatCount(plan.jumlah_pekerjaan)} pekerjaan</small>
                      <div className="planner-row-actions">
                        <button type="button" onClick={() => openEdit("plan", plan)} disabled={saving || Boolean(deleting)} aria-label={`Ubah rencana ${plan.judul}`}><Pencil size={13} /> Ubah</button>
                        <button type="button" className="danger" onClick={() => deletePlannerItem("plan", plan)} disabled={saving || Boolean(deleting)} aria-label={`Hapus rencana ${plan.judul}`}><Trash2 size={13} /> Hapus</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="planner-project-management" id="projects">
            <div className="planner-project-page-heading">
              <div>
                <h1>Manajemen Proyek</h1>
                <p>Kelola wadah perencanaan tahunan dan pencapaian target.</p>
              </div>
              <button type="button" className="planner-project-primary-button" onClick={() => openCreate("project")}>
                <Plus size={17} /> Tambah Proyek
              </button>
            </div>

            {loading ? (
              <div className="planner-panel planner-empty">Memuat ringkasan proyek...</div>
            ) : projectManagement.featuredProject ? (
              <article className="planner-project-feature">
                <div className="planner-project-feature-main">
                  <div className="planner-project-feature-icon"><FolderKanban size={25} /></div>
                  <div className="planner-project-feature-copy">
                    <span className="planner-project-code">
                      PROYEK {statusLabel(projectManagement.featuredProject.status).toUpperCase()} · {projectManagement.featuredProject.kode}
                    </span>
                    <h2>{projectManagement.featuredProject.nama}</h2>
                    <p>
                      Periode {formatDate(projectManagement.featuredProject.periode_mulai)} – {formatDate(projectManagement.featuredProject.periode_selesai)}
                      {" · "}Dikelola oleh Anda
                    </p>
                  </div>
                </div>
                <div className="planner-project-feature-progress">
                  <span>Pencapaian target</span>
                  <div>
                    <strong>{formatCount(projectManagement.featuredProject.jobCount)}</strong>
                    <small>
                      {projectManagement.featuredProject.target_jumlah === null || projectManagement.featuredProject.target_jumlah === undefined
                        ? "pekerjaan"
                        : `/ ${formatCount(projectManagement.featuredProject.target_jumlah)} pekerjaan`}
                    </small>
                  </div>
                  <div
                    className="planner-overview-progress-track"
                    role="progressbar"
                    aria-label={`Pencapaian target ${projectManagement.featuredProject.nama}`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={projectManagement.featuredProject.target_jumlah
                      ? Math.min(100, Math.round((projectManagement.featuredProject.jobCount / projectManagement.featuredProject.target_jumlah) * 100))
                      : 0}
                  >
                    <i style={{
                      width: `${projectManagement.featuredProject.target_jumlah
                        ? Math.min(100, Math.round((projectManagement.featuredProject.jobCount / projectManagement.featuredProject.target_jumlah) * 100))
                        : 0}%`,
                    }} />
                  </div>
                </div>
              </article>
            ) : null}

            <div className="planner-project-metrics">
              <article className="planner-project-metric">
                <div className="planner-project-metric-icon metric-projects"><FolderKanban size={20} /></div>
                <div><span>Total Proyek</span><strong>{loading ? "—" : formatCount(projectManagement.totalProjects)}</strong><small>{formatCount(projectManagement.activeProjects)} proyek aktif</small></div>
              </article>
              <article className="planner-project-metric">
                <div className="planner-project-metric-icon metric-target"><Target size={20} /></div>
                <div><span>Target Pekerjaan</span><strong>{loading ? "—" : formatCount(projectManagement.targetJobs)}</strong><small>{formatCount(projectManagement.actualJobs)} pekerjaan terdaftar</small></div>
              </article>
              <article className="planner-project-metric">
                <div className="planner-project-metric-icon metric-progress"><Activity size={20} /></div>
                <div><span>Progress Keseluruhan</span><strong>{loading ? "—" : `${projectManagement.progress}%`}</strong><small>{formatCount(projectManagement.atRiskProjects)} proyek perlu perhatian</small></div>
              </article>
            </div>

            <section className="planner-panel planner-project-panel planner-project-register">
              <div className="planner-panel-heading">
                <div>
                  <h2>Daftar Proyek</h2>
                  <p>Wadah utama perencanaan periode</p>
                </div>
              </div>
              {loading ? (
                <div className="planner-empty">Memuat proyek...</div>
              ) : filteredProjects.length === 0 ? (
                <div className="planner-empty">
                  {query ? "Tidak ada proyek yang cocok dengan pencarian." : "Belum ada proyek. Tambahkan proyek untuk mulai mengelola perencanaan."}
                  {!query && (
                    <button type="button" className="planner-project-primary-button" onClick={() => openCreate("project")}>
                      <Plus size={15} /> Tambah proyek pertama
                    </button>
                  )}
                </div>
              ) : (
                <div className="planner-project-table">
                  {filteredProjects.map((project) => {
                    const projectData = projectManagement.projects.find((item) => String(item.id) === String(project.id)) || project;
                    return (
                      <article className="planner-project-table-row" key={project.id}>
                        <div className="planner-project-table-name">
                          <span>{project.kode}</span>
                          <strong>{project.nama}</strong>
                          <small>{formatDate(project.periode_mulai)} – {formatDate(project.periode_selesai)}</small>
                        </div>
                        <div className="planner-project-owner">
                          <span className="planner-project-owner-avatar">{initials(userName)}</span>
                          <span>Anda</span>
                        </div>
                        <div className="planner-project-row-progress">
                          <div><strong>{projectData.progress || 0}%</strong><span>{formatCount(projectData.jobCount || 0)} pekerjaan</span></div>
                          <div className="planner-overview-progress-track">
                            <i style={{ width: `${Math.max(0, Math.min(100, projectData.progress || 0))}%` }} />
                          </div>
                        </div>
                        <span className={`planner-status status-project-${project.status}`}>{statusLabel(project.status)}</span>
                        <div className="planner-project-row-actions">
                          <div className="planner-project-action-menu-wrap">
                            <button
                              className="planner-project-more-button"
                              type="button"
                              aria-label={`Aksi proyek ${project.nama}`}
                              aria-expanded={projectActionId === project.id}
                              aria-haspopup="menu"
                              onClick={() => setProjectActionId(
                                projectActionId === project.id ? null : project.id
                              )}
                              disabled={saving || Boolean(deleting)}
                            >
                              <MoreHorizontal size={17} />
                            </button>
                            {projectActionId === project.id && (
                              <div className="planner-project-action-menu" role="menu">
                                <button
                                  role="menuitem"
                                  type="button"
                                  onClick={() => {
                                    setProjectActionId(null);
                                    openEdit("project", project);
                                  }}
                                >
                                  <Pencil size={13} /> Ubah proyek
                                </button>
                                <button
                                  className="danger"
                                  role="menuitem"
                                  type="button"
                                  onClick={() => {
                                    setProjectActionId(null);
                                    deletePlannerItem("project", project);
                                  }}
                                  disabled={saving || Boolean(deleting)}
                                >
                                  <Trash2 size={13} /> Hapus proyek
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            className="planner-project-open-button"
                            type="button"
                            onClick={() => openEdit("project", project)}
                            aria-label={`Buka proyek ${project.nama}`}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              <div className="planner-project-footer">
                <FilePlus2 size={15} />
                <span>Daftar proyek menampilkan proyek yang dibuat oleh akun Planner ini.</span>
              </div>
            </section>
          </section>

          <section className="planner-panel planner-timeline-panel" id="timeline">
            <div className="planner-panel-heading">
              <div>
                <h2>Timeline Perencanaan</h2>
                <p>Rentang tanggal mulai dan target selesai setiap rencana</p>
              </div>
              <CalendarRange size={19} />
            </div>
            {loading ? (
              <div className="planner-empty">Memuat timeline...</div>
            ) : planTimeline.length === 0 ? (
              <div className="planner-empty">Belum ada rencana dengan rentang tanggal untuk ditampilkan.</div>
            ) : (
              <div className="planner-timeline-list">
                {planTimeline.map((plan) => (
                  <article className="planner-timeline-row" key={plan.id}>
                    <div className="planner-timeline-label">
                      <strong>{plan.judul}</strong>
                      <span>{plan.kode_proyek} · {plan.nama_proyek}</span>
                    </div>
                    <div className="planner-timeline-track" aria-label={`${formatDate(plan.tgl_rencana_mulai)} sampai ${formatDate(plan.tgl_rencana_selesai)}`}>
                      <div
                        className={`planner-timeline-bar status-${plan.status}${plan.overdue ? " is-overdue" : ""}`}
                        style={{ left: `${plan.left}%`, width: `${plan.width}%` }}
                        title={`${formatDate(plan.tgl_rencana_mulai)} – ${formatDate(plan.tgl_rencana_selesai)}`}
                      />
                    </div>
                    <div className="planner-timeline-dates">
                      {formatDate(plan.tgl_rencana_mulai)} – {formatDate(plan.tgl_rencana_selesai)}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="planner-timeline-legend">
              <span><i className="legend-draft" /> Draft</span>
              <span><i className="legend-active" /> Disetujui / Berjalan</span>
              <span><i className="legend-complete" /> Selesai</span>
              <span><i className="legend-overdue" /> Melewati target</span>
            </div>
          </section>

          <section className="planner-panel planner-monitoring-panel" id="monitoring">
            <div className="planner-panel-heading">
              <div>
                <h2>Monitoring Rencana</h2>
                <p>Pantau status, jadwal, progres pekerjaan, dan tenggat rencana</p>
              </div>
              <ClipboardCheck size={19} />
            </div>
            <div className="planner-monitoring-stats">
              <article><span>Terlambat</span><strong className={monitoringSummary.overdue ? "monitoring-danger" : ""}>{formatCount(monitoringSummary.overdue)}</strong></article>
              <article><span>Mulai dalam 14 hari</span><strong>{formatCount(monitoringSummary.upcoming)}</strong></article>
              <article><span>Disetujui / berjalan</span><strong>{formatCount(monitoringSummary.active)}</strong></article>
              <article><span>Selesai</span><strong>{formatCount(monitoringSummary.completed)}</strong></article>
            </div>
            <div className="planner-monitoring-table-wrap">
              <table className="planner-monitoring-table">
                <thead>
                  <tr>
                    <th>Rencana</th>
                    <th>Proyek</th>
                    <th>Jadwal</th>
                    <th>Progres pekerjaan</th>
                    <th>Status monitoring</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" className="planner-empty">Memuat data monitoring...</td></tr>
                  ) : monitoredPlans.length === 0 ? (
                    <tr><td colSpan="5" className="planner-empty">Belum ada rencana untuk dimonitor.</td></tr>
                  ) : monitoredPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td><strong>{plan.judul}</strong><small>{plan.jenis_pekerjaan} · {plan.prioritas}</small></td>
                      <td>{plan.kode_proyek} · {plan.nama_proyek}</td>
                      <td>{formatDate(plan.tgl_rencana_mulai)} – {formatDate(plan.tgl_rencana_selesai)}<small>{formatCount(plan.durasi_hari)} hari</small></td>
                      <td>
                        <div className="planner-monitor-progress">
                          <span>{formatCount(plan.jumlah_pekerjaan)} pekerjaan</span>
                          <strong>{Number(plan.rata_progres) || 0}%</strong>
                        </div>
                        <div className="planner-monitor-track"><i style={{ width: `${Math.min(100, Math.max(0, Number(plan.rata_progres) || 0))}%` }} /></div>
                      </td>
                      <td>
                        <span className={`planner-monitor-badge${plan.overdue ? " overdue" : plan.upcoming ? " upcoming" : ""}`}>
                          {plan.overdue ? "Melewati target" : plan.upcoming ? "Segera dimulai" : statusLabel(plan.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="planner-footer">
            SIMON · Sistem Informasi Monitoring <span>•</span> Dashboard Planner
          </footer>
        </div>
        {editor && (
          <div className="planner-modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}>
            <section className="planner-modal" role="dialog" aria-modal="true" aria-labelledby="planner-modal-title">
              <div className="planner-modal-heading">
                <div>
                  <h2 id="planner-modal-title">
                    {editor.item ? "Ubah" : "Tambah"} {editor.kind === "project" ? "Proyek" : "Rencana Pekerjaan"}
                  </h2>
                  <p>Lengkapi data sesuai tabel {editor.kind === "project" ? "proyek" : "rencana_pekerjaan"}.</p>
                </div>
                <button type="button" className="planner-modal-close" onClick={closeEditor} disabled={saving} aria-label="Tutup formulir">
                  <X size={18} />
                </button>
              </div>
              <form className="planner-form" onSubmit={savePlannerItem}>
                {(editor.kind === "project" ? projectFields : planFields).map((field) => {
                  const options = fieldOptions(field);
                  return (
                    <label className={field.wide || field.type === "textarea" ? "wide" : ""} key={field.name}>
                      <span>{field.label}{field.required && <b>*</b>}</span>
                      {field.type === "textarea" ? (
                        <textarea name={field.name} value={form[field.name] || ""} onChange={updateFormField} required={field.required} maxLength={field.maxLength} />
                      ) : field.type === "select" || !["text", "number", "date"].includes(field.type) ? (
                        <select name={field.name} value={form[field.name] || ""} onChange={updateFormField} required={field.required}>
                          <option value="">{`Pilih ${field.label.toLowerCase()}`}</option>
                          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : (
                        <input
                          name={field.name}
                          type={field.type}
                          value={form[field.name] || ""}
                          onChange={updateFormField}
                          required={field.required}
                          maxLength={field.maxLength}
                          min={field.min}
                          max={field.max}
                          step={field.type === "number" ? "1" : undefined}
                        />
                      )}
                    </label>
                  );
                })}
                {error && <div className="planner-form-error wide" role="alert">{error}</div>}
                <div className="planner-form-actions wide">
                  <button type="button" onClick={closeEditor} disabled={saving}>Batal</button>
                  <button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
