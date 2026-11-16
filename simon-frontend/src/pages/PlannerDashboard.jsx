import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  Eye,
  FilePlus2,
  FileText,
  FolderKanban,
  History,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  CalendarRange,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  X,
  UserRound,
} from "lucide-react";
import "./PlannerDashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const PLAN_PAGE_SIZE = 6;
const PROJECT_PAGE_SIZE = 5;
const DEFAULT_PLAN_FILTERS = {
  project: "all",
  type: "all",
  status: "all",
  year: "all",
};

const emptyDashboard = {
  summary: {
    total_rencana: 0,
    rencana_draft: 0,
    rencana_menunggu_review: 0,
    rencana_revisi: 0,
    rencana_disetujui: 0,
    rencana_berjalan: 0,
    rencana_selesai: 0,
    total_proyek: 0,
    proyek_aktif: 0,
  },
  evaluation: {
    jumlah_dievaluasi: 0,
    rata_rata: 0,
    summary: null,
    latest: null,
    criteria: [],
  },
  plans: [],
  projects: [],
  notifications: [],
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
    evaluation: { ...emptyDashboard.evaluation, ...data.evaluation },
    plans: data.plans || [],
    projects: data.projects || [],
    notifications: data.notifications || [],
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
    menunggu_review: "Menunggu Review",
    revisi: "Revisi",
    disetujui: "Disetujui",
    berjalan: "Berjalan",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan",
    arsip: "Arsip",
  }[status] || status || "Belum ditentukan";
}

function enumLabel(value) {
  return {
    plan: "Rencana utama",
    extra: "Tambahan",
    special: "Khusus",
    jangka_pendek: "Jangka pendek",
    bulanan: "Bulanan",
    tahunan: "Tahunan",
    email: "Surel",
    surat: "Surat",
    whatsapp: "WhatsApp",
    lisan: "Lisan",
    rapat: "Rapat",
    hardcopy: "Dokumen cetak",
    lainnya: "Lainnya",
    aktif: "Aktif",
    arsip: "Arsip",
  }[value] || String(value || "").replaceAll("_", " ");
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
  const [planQuery, setPlanQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [projectQuery, setProjectQuery] = useState("");
  const [projectYearFilter, setProjectYearFilter] = useState("all");
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [projectPage, setProjectPage] = useState(1);
  const [planMenuOpen, setPlanMenuOpen] = useState(true);
  const [planFilters, setPlanFilters] = useState({ ...DEFAULT_PLAN_FILTERS });
  const [planFilterDraft, setPlanFilterDraft] = useState({ ...DEFAULT_PLAN_FILTERS });
  const [planPage, setPlanPage] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planHistory, setPlanHistory] = useState([]);
  const [planHistoryLoading, setPlanHistoryLoading] = useState(false);
  const [planHistoryError, setPlanHistoryError] = useState("");
  const [submittingPlanId, setSubmittingPlanId] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetailTab, setProjectDetailTab] = useState("info");
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
    if (activeSection === "dashboard" || activeSection === "plans") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(activeSection)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeSection]);

  const projectYearById = useMemo(() => new Map(
    dashboard.projects.map((project) => [String(project.id), String(project.tahun)])
  ), [dashboard.projects]);
  const planYearOptions = useMemo(() => [...new Set(dashboard.plans.map((plan) =>
    String(plan.tahun_plan || projectYearById.get(String(plan.proyek_id)) || "")
  ).filter(Boolean))].sort((first, second) => Number(second) - Number(first)), [dashboard.plans, projectYearById]);
  const filteredPlans = useMemo(() => {
    const normalizedQuery = planQuery.trim().toLowerCase();
    return dashboard.plans.filter((plan) =>
      (planFilters.status === "all"
        || (planFilters.status === "history" && ["selesai", "dibatalkan"].includes(plan.status))
        || plan.status === planFilters.status)
      && (planFilters.project === "all" || String(plan.proyek_id) === planFilters.project)
      && (planFilters.type === "all" || plan.tipe_rencana === planFilters.type)
      && (planFilters.year === "all" || String(plan.tahun_plan || projectYearById.get(String(plan.proyek_id)) || "") === planFilters.year)
      && (!normalizedQuery || [
        plan.judul,
        plan.kode_proyek,
        plan.nama_proyek,
        plan.jenis_pekerjaan,
        plan.fungsi,
        plan.status,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)))
    );
  }, [dashboard.plans, planFilters, planQuery, projectYearById]);
  const planStatusCounts = useMemo(() => [
    { key: "draft", label: "Draft", color: "#3b82f6" },
    { key: "menunggu_review", label: "Menunggu Review", color: "#e5a528" },
    { key: "revisi", label: "Revisi", color: "#e97955" },
    { key: "disetujui", label: "Disetujui", color: "#30a879" },
    { key: "berjalan", label: "Berjalan", color: "#f59e0b" },
    { key: "selesai", label: "Selesai", color: "#8b70d8" },
    { key: "dibatalkan", label: "Dibatalkan", color: "#ef4444" },
  ].map((status) => ({
    ...status,
    count: dashboard.plans.filter((plan) => plan.status === status.key).length,
  })), [dashboard.plans]);
  const planStatusTotal = planStatusCounts.reduce((total, status) => total + status.count, 0);
  let donutProgress = 0;
  const donutStops = planStatusCounts.map((status) => {
    const start = donutProgress;
    donutProgress += planStatusTotal ? (status.count / planStatusTotal) * 100 : 0;
    return `${status.color} ${start}% ${donutProgress}%`;
  });
  const planStatusDonut = planStatusTotal
    ? `conic-gradient(${donutStops.join(", ")})`
    : "conic-gradient(#e8edf4 0% 100%)";
  const maxPlanStatusCount = Math.max(1, ...planStatusCounts.map((status) => status.count));
  const recentPlans = dashboard.plans.slice(0, 5);
  const unreadNotifications = dashboard.notifications.filter((item) => !item.dibaca_at).length;

  const planPageCount = Math.max(1, Math.ceil(filteredPlans.length / PLAN_PAGE_SIZE));
  const currentPlanPage = Math.min(planPage, planPageCount);
  const planPageWindowStart = Math.max(1, Math.min(currentPlanPage - 1, planPageCount - 2));
  const planPageNumbers = Array.from(
    { length: Math.min(3, planPageCount) },
    (_, index) => planPageWindowStart + index
  );
  const paginatedPlans = filteredPlans.slice(
    (currentPlanPage - 1) * PLAN_PAGE_SIZE,
    currentPlanPage * PLAN_PAGE_SIZE
  );
  const planRangeStart = filteredPlans.length
    ? (currentPlanPage - 1) * PLAN_PAGE_SIZE + 1
    : 0;
  const planRangeEnd = Math.min(currentPlanPage * PLAN_PAGE_SIZE, filteredPlans.length);
  const selectedPlanPic = selectedPlan
    ? dashboard.options.staff.find(
        (staff) => String(staff.id) === String(selectedPlan.pic_awal_id)
      )
    : null;
  const selectedPlanOrigin = selectedPlan?.rencana_asal_id
    ? dashboard.plans.find(
        (plan) => String(plan.id) === String(selectedPlan.rencana_asal_id)
      )
    : null;
  const latestRevisionNote = planHistory.find((item) => item.status_baru === "revisi");
  const selectedProjectPlans = selectedProject
    ? dashboard.plans.filter((plan) => String(plan.proyek_id) === String(selectedProject.id))
    : [];
  const projectDetailRows = projectDetailTab === "history"
    ? selectedProjectPlans.filter((plan) => ["selesai", "dibatalkan"].includes(plan.status))
    : selectedProjectPlans;

  const filteredProjects = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLowerCase();
    return dashboard.projects.filter((project) =>
      (projectYearFilter === "all" || String(project.tahun) === projectYearFilter)
      && (projectStatusFilter === "all" || project.status === projectStatusFilter)
      && (!normalizedQuery || [
        project.nama,
        project.kode,
        project.tahun,
        project.status,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)))
    );
  }, [dashboard.projects, projectQuery, projectStatusFilter, projectYearFilter]);
  const projectPageCount = Math.max(1, Math.ceil(filteredProjects.length / PROJECT_PAGE_SIZE));
  const currentProjectPage = Math.min(projectPage, projectPageCount);
  const paginatedProjects = filteredProjects.slice(
    (currentProjectPage - 1) * PROJECT_PAGE_SIZE,
    currentProjectPage * PROJECT_PAGE_SIZE
  );
  const projectRangeStart = filteredProjects.length
    ? (currentProjectPage - 1) * PROJECT_PAGE_SIZE + 1
    : 0;
  const projectRangeEnd = Math.min(currentProjectPage * PROJECT_PAGE_SIZE, filteredProjects.length);
  const projectStatusSummary = useMemo(() => ({
    active: dashboard.projects.filter((project) => project.status === "aktif").length,
    draft: dashboard.projects.filter((project) => project.status === "draft").length,
    completed: dashboard.projects.filter((project) => project.status === "selesai").length,
  }), [dashboard.projects]);

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
    if (["plans", "timeline", "monitoring"].includes(section)) {
      setPlanMenuOpen(true);
    }
  }

  function openCreate(kind) {
    const fields = kind === "project" ? projectFields : planFields;
    setEditor({ kind, item: null });
    setForm(formValues(fields));
    setError("");
    setNotice("");
    if (kind === "plan") {
      setPlanFilters({ ...DEFAULT_PLAN_FILTERS });
      setPlanFilterDraft({ ...DEFAULT_PLAN_FILTERS });
      setPlanPage(1);
      setActiveSection("plans");
      setSidebarOpen(false);
    }
  }

  function openEdit(kind, item) {
    if (kind === "plan" && !["draft", "revisi"].includes(item.status)) {
      setNotice("Rencana hanya dapat diubah saat berstatus Draft atau Revisi.");
      return;
    }
    const fields = kind === "project" ? projectFields : planFields;
    setEditor({ kind, item });
    setForm(formValues(fields, item));
    setError("");
    setNotice("");
  }

  async function openPlanDetails(plan) {
    setSelectedPlan(plan);
    setPlanHistory([]);
    setPlanHistoryError("");
    setPlanHistoryLoading(true);
    try {
      const response = await fetch(`${API_URL}/planner/plans/${plan.id}/history`, {
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal memuat riwayat rencana.");
      setPlanHistory(data.history || []);
    } catch (requestError) {
      setPlanHistoryError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend."
          : requestError.message || "Gagal memuat riwayat rencana."
      );
    } finally {
      setPlanHistoryLoading(false);
    }
  }

  async function submitPlanToSupervisor(plan) {
    if (!["draft", "revisi"].includes(plan.status)) return;
    if (!window.confirm(`Kirim "${plan.judul}" kepada Supervisor untuk ditinjau?`)) return;
    setSubmittingPlanId(String(plan.id));
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/planner/plans/${plan.id}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal mengirim rencana.");
      setSelectedPlan(null);
      setNotice(data.message || "Rencana berhasil dikirim kepada Supervisor.");
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
          : requestError.message || "Gagal mengirim rencana."
      );
    } finally {
      setSubmittingPlanId("");
    }
  }

  async function markNotificationRead(notification) {
    if (notification.dibaca_at) return;
    try {
      const response = await fetch(
        `${API_URL}/planner/notifications/${notification.id}/read`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.token || ""}` },
        }
      );
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
      setError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend."
          : requestError.message || "Gagal memperbarui notifikasi."
      );
    }
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
      label: enumLabel(value),
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
            <span>Sistem Informasi Monitoring</span>
          </div>
        </div>

        <div className="planner-sidebar-user">
          <div className="planner-avatar">{initials(userName)}</div>
          <div><strong>{userName}</strong><span>Planner</span></div>
        </div>

        <span className="planner-nav-label">RUANG KERJA</span>
        <nav className="planner-nav">
          <button
            type="button"
            className={activeSection === "dashboard" ? "active" : ""}
            onClick={() => goToSection("dashboard")}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button
            type="button"
            className={activeSection === "projects" ? "active" : ""}
            onClick={() => goToSection("projects")}
          >
            <FolderKanban size={18} /> Data Proyek
          </button>
          <button
            type="button"
            className={["plans", "timeline", "monitoring"].includes(activeSection) ? "active" : ""}
            onClick={() => setPlanMenuOpen((open) => !open)}
            aria-expanded={planMenuOpen}
          >
            <ClipboardList size={18} /> Rencana Pekerjaan
            <ChevronDown className={`planner-nav-chevron${planMenuOpen ? " is-open" : ""}`} size={15} />
          </button>
          {planMenuOpen && (
            <div className="planner-subnav">
              <button
                type="button"
                className={activeSection === "plans" && planFilters.status === "all" ? "active" : ""}
                onClick={() => {
                  setPlanFilters({ ...DEFAULT_PLAN_FILTERS });
                  setPlanFilterDraft({ ...DEFAULT_PLAN_FILTERS });
                  setPlanPage(1);
                  goToSection("plans");
                }}
              >
                Semua Rencana
              </button>
              <button type="button" onClick={() => openCreate("plan")}>
                Buat Rencana
              </button>
              <button
                type="button"
                className={activeSection === "plans" && planFilters.status === "history" ? "active" : ""}
                onClick={() => {
                  const historyFilters = { ...DEFAULT_PLAN_FILTERS, status: "history" };
                  setPlanFilters(historyFilters);
                  setPlanFilterDraft(historyFilters);
                  setPlanPage(1);
                  goToSection("plans");
                }}
              >
                <History size={15} /> Riwayat Rencana
              </button>
              <button type="button" className={activeSection === "timeline" ? "active" : ""} onClick={() => goToSection("timeline")}>
                <CalendarRange size={15} /> Jadwal
              </button>
              <button type="button" className={activeSection === "monitoring" ? "active" : ""} onClick={() => goToSection("monitoring")}>
                <ClipboardCheck size={15} /> Monitoring
              </button>
            </div>
          )}
          <button
            type="button"
            className={activeSection === "evaluation" ? "active" : ""}
            onClick={() => goToSection("evaluation")}
          >
            <ClipboardCheck size={18} /> Evaluasi & Rekomendasi
          </button>
          <button
            type="button"
            className={activeSection === "reports" ? "active" : ""}
            onClick={() => goToSection("reports")}
          >
            <FileText size={18} /> Laporan Perencanaan
          </button>
          <button
            type="button"
            className={activeSection === "profile" ? "active" : ""}
            onClick={() => goToSection("profile")}
          >
            <UserRound size={18} /> Profil
          </button>
        </nav>

        <div className="planner-sidebar-bottom">
          <button type="button" onClick={onLogout}>
            <LogOut size={18} /> Logout
          </button>
          <span>SIMON · Sistem Informasi Monitoring</span>
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
            {activeSection === "projects" && (
              <strong className="planner-topbar-page-title">Data Proyek</strong>
            )}
          </div>
          <div className="planner-top-actions">
            <span className="planner-date"><CalendarDays size={16} /> {todayLabel}</span>
            <button
              className="planner-icon-button planner-notification"
              type="button"
              title="Notifikasi Rencana Pekerjaan"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={18} />
              {unreadNotifications > 0 && <i>{unreadNotifications > 9 ? "9+" : unreadNotifications}</i>}
            </button>
            {notificationsOpen && (
              <div className="planner-notification-popover">
                <div className="planner-notification-heading">
                  <strong>Notifikasi</strong>
                  <span>{formatCount(unreadNotifications)} belum dibaca</span>
                </div>
                {dashboard.notifications.length === 0 ? (
                  <p className="planner-notification-empty">Belum ada notifikasi.</p>
                ) : dashboard.notifications.map((notification) => (
                  <button
                    type="button"
                    className={`planner-notification-item${notification.dibaca_at ? "" : " unread"}`}
                    key={notification.id}
                    onClick={async () => {
                      await markNotificationRead(notification);
                      setNotificationsOpen(false);
                      goToSection("plans");
                      const plan = dashboard.plans.find(
                        (item) => String(item.id) === String(notification.rencana_id)
                      );
                      if (plan) openPlanDetails(plan);
                    }}
                  >
                    <span>{notification.pesan}</span>
                    <small>{formatDate(notification.created_at)}</small>
                  </button>
                ))}
              </div>
            )}
            <div className="planner-top-user">
              <div className="planner-avatar">{initials(userName)}</div>
              <div><strong>{userName}</strong><span>PLANNER</span></div>
            </div>
          </div>
        </header>

        <div className={`planner-content ${activeSection === "projects" ? "planner-content-projects" : ""} ${activeSection === "plans" ? "planner-content-plans" : ""}`}>
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
            <div className="planner-portfolio-actions">
              <button type="button" className="planner-portfolio-create secondary" onClick={() => openCreate("project")}>
                <FolderKanban size={16} /> Buat Proyek
              </button>
              <button type="button" className="planner-portfolio-create" onClick={() => openCreate("plan")} disabled={dashboard.projects.length === 0}>
                <Plus size={17} /> Buat Rencana
              </button>
            </div>
          </section>

          <section className="planner-stats" aria-label="Statistik perencanaan">
            <article className="planner-stat-card">
              <div className="planner-stat-icon stat-blue"><FolderKanban size={20} /></div>
              <p className="planner-stat-label">Total Proyek</p>
              <strong>{loading ? "—" : formatCount(summary.total_proyek)}</strong>
              <span>Proyek yang Anda kelola</span>
            </article>
            <article className="planner-stat-card">
              <div className="planner-stat-icon stat-teal"><ClipboardList size={20} /></div>
              <p className="planner-stat-label">Total Rencana Pekerjaan</p>
              <strong>{loading ? "—" : formatCount(summary.total_rencana)}</strong>
              <span>Seluruh rencana pekerjaan</span>
            </article>
            <article className="planner-stat-card">
              <div className="planner-stat-icon stat-orange"><FilePlus2 size={20} /></div>
              <p className="planner-stat-label">Rencana Draft</p>
              <strong>{loading ? "—" : formatCount(summary.rencana_draft)}</strong>
              <span>Menunggu tindak lanjut</span>
            </article>
            <article className="planner-stat-card">
              <div className="planner-stat-icon stat-violet"><ClipboardCheck size={20} /></div>
              <p className="planner-stat-label">Rencana Disetujui</p>
              <strong>{loading ? "—" : formatCount(summary.rencana_disetujui)}</strong>
              <span>Siap menjadi acuan pekerjaan</span>
            </article>
          </section>

          <section className="planner-panel planner-status-chart">
            <div className="planner-panel-heading">
              <div>
                <h2>Grafik Status Rencana Pekerjaan</h2>
                <p>Jumlah rencana berdasarkan status terbaru</p>
              </div>
              <ChartColumn size={19} />
            </div>
            {loading ? (
              <div className="planner-empty">Memuat status rencana...</div>
            ) : (
              <div className="planner-status-chart-bars" role="img" aria-label="Grafik jumlah rencana berdasarkan status">
                {planStatusCounts.map((status) => (
                  <div className="planner-status-chart-column" key={status.key} aria-label={`${status.label}: ${status.count}`}>
                    <strong>{formatCount(status.count)}</strong>
                    <div className="planner-status-chart-track">
                      <i
                        className={`chart-status-${status.key}`}
                        style={{ height: `${Math.max(4, (status.count / maxPlanStatusCount) * 100)}%` }}
                      />
                    </div>
                    <span>{status.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="planner-overview-stats" aria-label="Ringkasan operasional planner">
            <article>
              <span>Proyek aktif</span>
              <strong>{loading ? "—" : formatCount(summary.proyek_aktif)}</strong>
              <small>{loading ? "Memuat data proyek..." : `dari ${formatCount(summary.total_proyek)} proyek terdaftar`}</small>
            </article>
            <article>
              <span>Total rencana</span>
              <strong>{loading ? "—" : formatCount(summary.total_rencana)}</strong>
              <small>{loading ? "Memuat data rencana..." : "di seluruh siklus perencanaan"}</small>
            </article>
            <article>
              <span>Rencana berjalan</span>
              <strong>{loading ? "—" : formatCount(summary.rencana_berjalan)}</strong>
              <small>{loading ? "Memuat status rencana..." : `${formatCount(summary.rencana_draft)} rencana berstatus draft`}</small>
            </article>
            <article className="planner-overview-progress">
              <div><span>Capaian target {dashboardOverview.year}</span><strong>{loading ? "—" : `${dashboardOverview.annualProgress}%`}</strong></div>
              <div className="planner-overview-progress-track" role="progressbar" aria-label="Capaian target tahunan" aria-valuemin="0" aria-valuemax="100" aria-valuenow={dashboardOverview.annualProgress}>
                <i style={{ width: `${dashboardOverview.annualProgress}%` }} />
              </div>
              <small>{loading ? "Memuat capaian target..." : `${formatCount(dashboardOverview.annualPlans)} dari ${formatCount(dashboardOverview.annualTarget)} target pekerjaan direncanakan`}</small>
            </article>
          </section>

          <div className="planner-overview-grid">
            <section className="planner-panel planner-pipeline-panel">
              <div className="planner-panel-heading">
                <div>
                  <h2>Tahapan Perencanaan</h2>
                  <p>Posisi seluruh rencana pada tahapan perencanaan</p>
                </div>
                <button type="button" className="planner-text-link" onClick={() => goToSection("timeline")}>
                      Buka jadwal <ChevronRight size={15} />
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
                <span>tonggak jadwal bulan ini</span>
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
              <div className="planner-empty">Belum ada tonggak jadwal dalam 30 hari ke depan.</div>
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

          <section className="planner-panel planner-recent-plans" id="recent-plans">
            <div className="planner-panel-heading">
              <div>
                <h2>Rencana Pekerjaan Terbaru</h2>
                <p>Lima rencana terakhir yang diperbarui</p>
              </div>
              <button
                type="button"
                className="planner-text-link"
                onClick={() => {
                  setPlanFilters({ ...DEFAULT_PLAN_FILTERS });
                  setPlanFilterDraft({ ...DEFAULT_PLAN_FILTERS });
                  setPlanPage(1);
                  goToSection("plans");
                }}
              >
                Lihat Semua Rencana <ChevronRight size={15} />
              </button>
            </div>
            <div className="planner-data-table-wrap">
              <table className="planner-data-table planner-recent-plan-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Rencana</th>
                    <th>Proyek</th>
                    <th>Jenis Rencana</th>
                    <th>Prioritas</th>
                    <th>PIC Awal</th>
                    <th>Tanggal Mulai</th>
                    <th>Estimasi Selesai</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="10" className="planner-empty">Memuat rencana pekerjaan...</td></tr>
                  ) : recentPlans.length === 0 ? (
                    <tr><td colSpan="10" className="planner-empty">Belum ada rencana pekerjaan.</td></tr>
                  ) : recentPlans.map((plan, index) => {
                    const pic = dashboard.options.staff.find((staff) => String(staff.id) === String(plan.pic_awal_id));
                    return (
                      <tr key={plan.id}>
                        <td>{index + 1}</td>
                        <td><strong>{plan.judul}</strong></td>
                        <td>{plan.nama_proyek}</td>
                        <td>{enumLabel(plan.tipe_rencana) || "—"}</td>
                        <td>{plan.prioritas || "—"}</td>
                        <td>{pic?.nama || "Belum ditentukan"}</td>
                        <td>{formatDate(plan.tgl_rencana_mulai)}</td>
                        <td>{formatDate(plan.tgl_rencana_selesai)}</td>
                        <td><span className={`planner-status status-${plan.status}`}>{statusLabel(plan.status)}</span></td>
                        <td>
                          <button
                            type="button"
                            className="planner-table-action"
                            onClick={() => openPlanDetails(plan)}
                            aria-label={`Lihat detail rencana ${plan.judul}`}
                          >
                            <Eye size={14} /> Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="planner-panel planner-evaluation-panel" id="evaluation">
            <div className="planner-panel-heading">
              <div>
                <h2>Evaluasi dan Rekomendasi</h2>
                <p>Ringkasan hasil evaluasi pekerjaan pada proyek Anda</p>
              </div>
              <ClipboardCheck size={19} />
            </div>
            <div className="planner-evaluation-content">
              <div className="planner-evaluation-metrics">
                <article>
                  <span>Rata-rata nilai evaluasi</span>
                  <strong>{loading ? "—" : `${Number(dashboard.evaluation.rata_rata || 0).toLocaleString("id-ID")} / 100`}</strong>
                </article>
                <article>
                  <span>Pekerjaan telah dievaluasi</span>
                  <strong>{loading ? "—" : formatCount(dashboard.evaluation.jumlah_dievaluasi)}</strong>
                </article>
              </div>
              <div className="planner-evaluation-notes">
                {dashboard.evaluation.summary ? (
                  <>
                    <p className="planner-evaluation-context">
                      Ringkasan {dashboard.evaluation.summary.jenis_periode} {dashboard.evaluation.summary.bulan ? `bulan ${dashboard.evaluation.summary.bulan}, ` : ""}
                      {dashboard.evaluation.summary.tahun} · {dashboard.evaluation.summary.nama_proyek}
                    </p>
                    <article>
                      <h3>Ringkasan hasil evaluasi</h3>
                      <p>{dashboard.evaluation.summary.ringkasan || "Belum ada ringkasan evaluasi."}</p>
                    </article>
                    <article>
                      <h3>Rekomendasi perencanaan berikutnya</h3>
                      <p>{dashboard.evaluation.summary.rekomendasi_perencanaan || "Belum ada rekomendasi perencanaan."}</p>
                    </article>
                  </>
                ) : dashboard.evaluation.latest ? (
                  <>
                    <p className="planner-evaluation-context">
                      Evaluasi terbaru · {dashboard.evaluation.latest.nama_proyek} · {formatDate(dashboard.evaluation.latest.tgl_evaluasi)}
                    </p>
                    <article>
                      <h3>Ringkasan hasil evaluasi</h3>
                      <p>{dashboard.evaluation.latest.catatan || "Evaluator belum menambahkan ringkasan."}</p>
                    </article>
                    <article>
                      <h3>Rekomendasi perencanaan berikutnya</h3>
                      <p>{dashboard.evaluation.latest.rekomendasi || "Belum ada rekomendasi perencanaan."}</p>
                    </article>
                  </>
                ) : (
                  <div className="planner-empty">Belum ada hasil evaluasi untuk proyek yang Anda kelola.</div>
                )}
                {dashboard.evaluation.criteria.length > 0 && (
                  <div className="planner-evaluation-criteria">
                    <h3>Nilai kriteria pada evaluasi terakhir</h3>
                    <ul>
                      {dashboard.evaluation.criteria.map((criterion) => (
                        <li key={criterion.nama}>
                          <span>{criterion.nama} ({Number(criterion.bobot).toLocaleString("id-ID")}%)</span>
                          <strong>{Number(criterion.skor).toLocaleString("id-ID")}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <p className="planner-readonly-note">Informasi evaluasi hanya dapat dilihat. Penilaian dikelola oleh Evaluator.</p>
          </section>

          <section className="planner-panel planner-report-panel" id="reports">
            <div className="planner-panel-heading">
              <div>
                <h2>Laporan Perencanaan</h2>
                <p>Ringkasan proyek dan rencana berdasarkan data SIMON</p>
              </div>
              <FileText size={19} />
            </div>
            <div className="planner-data-table-wrap">
              <table className="planner-data-table">
                <thead>
                  <tr><th>Proyek</th><th>Tahun</th><th>Total Rencana</th><th>Draft</th><th>Disetujui</th><th>Berjalan</th><th>Selesai</th><th>Dibatalkan</th></tr>
                </thead>
                <tbody>
                  {dashboard.projects.length === 0 ? (
                    <tr><td colSpan="8" className="planner-empty">Belum ada data proyek untuk dilaporkan.</td></tr>
                  ) : dashboard.projects.map((project) => {
                    const projectPlans = dashboard.plans.filter((plan) => String(plan.proyek_id) === String(project.id));
                    const count = (status) => projectPlans.filter((plan) => plan.status === status).length;
                    return (
                      <tr key={project.id}>
                        <td><strong>{project.kode} · {project.nama}</strong></td>
                        <td>{project.tahun}</td>
                        <td>{projectPlans.length}</td>
                        <td>{count("draft")}</td>
                        <td>{count("disetujui")}</td>
                        <td>{count("berjalan")}</td>
                        <td>{count("selesai")}</td>
                        <td>{count("dibatalkan")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="planner-panel planner-profile-panel" id="profile">
            <div className="planner-panel-heading">
              <div>
                <h2>Profil</h2>
                <p>Informasi akun yang sedang digunakan</p>
              </div>
              <UserRound size={19} />
            </div>
            <dl className="planner-profile-details">
              <div><dt>Nama</dt><dd>{userName}</dd></div>
              <div><dt>Username</dt><dd>{session?.user?.username || "—"}</dd></div>
              <div><dt>Email</dt><dd>{session?.user?.email || "—"}</dd></div>
              <div><dt>Peran</dt><dd>Planner</dd></div>
            </dl>
          </section>

          <div className="planner-workspace">
            {activeSection === "plans" && (
              <>
                <div className="planner-plan-page-heading">
                  <div className="planner-plan-page-title">
                    <div className="planner-plan-page-icon"><ClipboardList size={23} /></div>
                    <div>
                      <h1>Rencana Pekerjaan</h1>
                      <p>Kelola rencana pekerjaan proyek secara terstruktur dan pantau statusnya.</p>
                    </div>
                  </div>
                </div>

                <section className="planner-plan-stats" aria-label="Ringkasan rencana pekerjaan">
                  <article className="planner-plan-stat">
                    <span className="plan-stat-icon plan-stat-total"><ClipboardList size={19} /></span>
                    <div><span>Total Rencana</span><strong>{loading ? "—" : formatCount(summary.total_rencana)}</strong><small>Seluruh rencana pekerjaan</small></div>
                  </article>
                  <article className="planner-plan-stat">
                    <span className="plan-stat-icon plan-stat-draft"><CalendarDays size={19} /></span>
                    <div><span>Rencana Draft</span><strong>{loading ? "—" : formatCount(summary.rencana_draft)}</strong><small>Perlu ditindaklanjuti</small></div>
                  </article>
                  <article className="planner-plan-stat">
                    <span className="plan-stat-icon plan-stat-approved"><ClipboardCheck size={19} /></span>
                    <div><span>Rencana Disetujui</span><strong>{loading ? "—" : formatCount(summary.rencana_disetujui)}</strong><small>Siap menjadi acuan pekerjaan</small></div>
                  </article>
                  <article className="planner-plan-stat">
                    <span className="plan-stat-icon plan-stat-complete"><CalendarRange size={19} /></span>
                    <div><span>Rencana Selesai</span><strong>{loading ? "—" : formatCount(summary.rencana_selesai)}</strong><small>Telah diselesaikan</small></div>
                  </article>
                </section>

                <div className="planner-plan-filters">
                  <label className="planner-plan-search">
                    <Search size={15} />
                    <input
                      type="search"
                      value={planQuery}
                      onChange={(event) => {
                        setPlanQuery(event.target.value);
                        setPlanPage(1);
                      }}
                      placeholder="Cari judul rencana atau proyek..."
                      aria-label="Cari judul rencana atau proyek"
                    />
                  </label>
                  <label>
                    <span>Proyek</span>
                    <select
                      value={planFilterDraft.project}
                      onChange={(event) => setPlanFilterDraft((filters) => ({ ...filters, project: event.target.value }))}
                    >
                      <option value="all">Semua Proyek</option>
                      {dashboard.projects.map((project) => (
                        <option key={project.id} value={String(project.id)}>{project.nama}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Jenis</span>
                    <select
                      value={planFilterDraft.type}
                      onChange={(event) => setPlanFilterDraft((filters) => ({ ...filters, type: event.target.value }))}
                    >
                      <option value="all">Semua Jenis</option>
                      {["plan", "extra", "special"].map((type) => (
                        <option key={type} value={type}>{enumLabel(type)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={planFilterDraft.status}
                      onChange={(event) => setPlanFilterDraft((filters) => ({ ...filters, status: event.target.value }))}
                    >
                      <option value="all">Semua Status</option>
                      <option value="draft">Draft</option>
                      <option value="disetujui">Disetujui</option>
                      <option value="berjalan">Berjalan</option>
                      <option value="selesai">Selesai</option>
                      <option value="dibatalkan">Dibatalkan</option>
                      <option value="history">Riwayat</option>
                    </select>
                  </label>
                  <label>
                    <span>Tahun</span>
                    <select
                      value={planFilterDraft.year}
                      onChange={(event) => setPlanFilterDraft((filters) => ({ ...filters, year: event.target.value }))}
                    >
                      <option value="all">Semua Tahun</option>
                      {planYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="planner-plan-filter-button"
                    onClick={() => {
                      setPlanFilters({ ...planFilterDraft });
                      setPlanPage(1);
                    }}
                  >
                    <Search size={14} /> Filter
                  </button>
                  <button
                    type="button"
                    className="planner-plan-create-button"
                    onClick={() => openCreate("plan")}
                    disabled={dashboard.projects.length === 0}
                  >
                    <Plus size={15} /> Buat Rencana
                  </button>
                </div>

                {dashboard.projects.length === 0 && !loading && (
                  <div className="planner-inline-hint">
                    Buat proyek terlebih dahulu sebelum menambahkan rencana pekerjaan.
                  </div>
                )}

                <section className="planner-panel planner-plan-panel" id="plans">
                  <div className="planner-plan-table-wrap">
                    <table className="planner-plan-table">
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Judul Rencana</th>
                          <th>Proyek</th>
                          <th>Jenis Rencana</th>
                          <th>Prioritas</th>
                          <th>PIC Awal</th>
                          <th>Tanggal Mulai</th>
                          <th>Estimasi Selesai</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan="10" className="planner-empty">Memuat rencana pekerjaan...</td></tr>
                        ) : filteredPlans.length === 0 ? (
                          <tr>
                            <td colSpan="10" className="planner-empty">
                              {dashboard.plans.length === 0
                                ? "Belum ada rencana pekerjaan."
                                : "Tidak ada rencana yang sesuai dengan pencarian dan filter."}
                            </td>
                          </tr>
                        ) : paginatedPlans.map((plan, index) => {
                          const pic = dashboard.options.staff.find((staff) => String(staff.id) === String(plan.pic_awal_id));
                          return (
                            <tr key={plan.id}>
                              <td>{planRangeStart + index}</td>
                              <td><strong>{plan.judul}</strong></td>
                              <td>{plan.nama_proyek}</td>
                              <td>{enumLabel(plan.tipe_rencana)}</td>
                              <td><span className={`planner-plan-priority priority-${String(plan.prioritas || "").toLowerCase()}`}>{plan.prioritas || "—"}</span></td>
                              <td>{pic?.nama || "Belum ditentukan"}</td>
                              <td>{formatDate(plan.tgl_rencana_mulai)}</td>
                              <td>{formatDate(plan.tgl_rencana_selesai)}</td>
                              <td><span className={`planner-status status-${plan.status}`}>{statusLabel(plan.status)}</span></td>
                              <td>
                                <div className="planner-plan-actions">
                                  <button type="button" onClick={() => openPlanDetails(plan)} aria-label={`Lihat detail ${plan.judul}`} title="Detail"><Eye size={14} /></button>
                                  {["draft", "revisi"].includes(plan.status) && (
                                    <button
                                      type="button"
                                      onClick={() => submitPlanToSupervisor(plan)}
                                      disabled={submittingPlanId === String(plan.id)}
                                      aria-label={`Kirim ${plan.judul} kepada Supervisor`}
                                      title={submittingPlanId === String(plan.id) ? "Mengirim..." : "Kirim ke Supervisor"}
                                    >
                                      <Send size={14} />
                                    </button>
                                  )}
                                  <button type="button" onClick={() => openEdit("plan", plan)} disabled={saving || Boolean(deleting) || !["draft", "revisi"].includes(plan.status)} aria-label={`Ubah ${plan.judul}`} title="Ubah"><Pencil size={14} /></button>
                                  <button type="button" className="danger" onClick={() => deletePlannerItem("plan", plan)} disabled={saving || Boolean(deleting) || !["draft", "revisi"].includes(plan.status)} aria-label={`Hapus ${plan.judul}`} title="Hapus"><Trash2 size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {!loading && filteredPlans.length > 0 && (
                    <div className="planner-plan-pagination">
                      <span>Menampilkan {formatCount(planRangeStart)}–{formatCount(planRangeEnd)} dari {formatCount(filteredPlans.length)} data</span>
                      <div>
                        <button type="button" onClick={() => setPlanPage(currentPlanPage - 1)} disabled={currentPlanPage <= 1} aria-label="Halaman sebelumnya">
                          <ChevronLeft size={15} />
                        </button>
                        {planPageNumbers.map((pageNumber) => (
                          <button
                            type="button"
                            className={currentPlanPage === pageNumber ? "active" : ""}
                            key={pageNumber}
                            onClick={() => setPlanPage(pageNumber)}
                            aria-label={`Halaman ${pageNumber}`}
                          >
                            {pageNumber}
                          </button>
                        ))}
                        <button type="button" onClick={() => setPlanPage(currentPlanPage + 1)} disabled={currentPlanPage >= planPageCount} aria-label="Halaman berikutnya">
                          <ChevronRight size={15} />
                        </button>
                        <span className="planner-plan-page-size">6 / halaman</span>
                      </div>
                    </div>
                  )}
                </section>

                <div className="planner-plan-insight-grid">
                  <section className="planner-panel planner-plan-recent">
                    <div className="planner-panel-heading">
                      <div><h2>Rencana Terbaru</h2><p>Rencana terakhir yang diperbarui</p></div>
                      <button
                        type="button"
                        className="planner-text-link"
                        onClick={() => {
                          setPlanFilters({ ...DEFAULT_PLAN_FILTERS });
                          setPlanFilterDraft({ ...DEFAULT_PLAN_FILTERS });
                          setPlanQuery("");
                          setPlanPage(1);
                        }}
                      >
                        Lihat Semua Rencana <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="planner-plan-recent-list">
                      {loading ? (
                        <div className="planner-empty">Memuat rencana terbaru...</div>
                      ) : recentPlans.length === 0 ? (
                        <div className="planner-empty">Belum ada rencana terbaru.</div>
                      ) : recentPlans.slice(0, 3).map((plan) => (
                        <button type="button" className="planner-plan-recent-item" key={plan.id} onClick={() => openPlanDetails(plan)}>
                          <span className="planner-plan-recent-date">{formatDate(plan.tgl_rencana_mulai)}</span>
                          <span className="planner-plan-recent-copy">
                            <strong>{plan.judul}</strong>
                            <small>{plan.nama_proyek}</small>
                          </span>
                          <span className={`planner-status status-${plan.status}`}>{statusLabel(plan.status)}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="planner-panel planner-plan-detail-summary">
                    <div className="planner-panel-heading">
                      <div><h2>Detail Rencana</h2><p>Komposisi status dan rekomendasi</p></div>
                      <button type="button" className="planner-text-link" onClick={() => goToSection("evaluation")}>
                        Lihat Evaluasi <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="planner-plan-summary-content">
                      <div className="planner-plan-donut" role="img" aria-label={`Jumlah rencana berdasarkan status: ${planStatusTotal}`} style={{ background: planStatusDonut }}>
                        <div><strong>{formatCount(planStatusTotal)}</strong><span>Total</span></div>
                      </div>
                      <ul className="planner-plan-status-legend">
                        {planStatusCounts.map((status) => (
                          <li key={status.key}>
                            <span><i style={{ background: status.color }} />{status.label}</span>
                            <strong>{formatCount(status.count)}</strong>
                          </li>
                        ))}
                      </ul>
                      <article className="planner-plan-recommendation">
                        <h3><Lightbulb size={15} /> Rekomendasi</h3>
                        <p>
                          {dashboard.evaluation.summary?.rekomendasi_perencanaan
                            || dashboard.evaluation.latest?.rekomendasi
                            || "Belum ada rekomendasi evaluasi untuk proyek yang Anda kelola."}
                        </p>
                      </article>
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>

          <section className="planner-project-management" id="projects">
            <div className="planner-project-breadcrumb">
              <button type="button" onClick={() => goToSection("dashboard")}>
                <LayoutDashboard size={13} /> Dashboard
              </button>
              <ChevronRight size={13} />
              <span>Data Proyek</span>
            </div>
            <div className="planner-project-page-heading">
              <div className="planner-project-page-title">
                <div className="planner-project-page-icon"><FolderKanban size={25} /></div>
                <div>
                <h1>Data Proyek</h1>
                <p>Kelola data proyek yang dikelola dalam sistem.</p>
                </div>
              </div>
              <button type="button" className="planner-project-primary-button" onClick={() => openCreate("project")}>
                <Plus size={17} /> Tambah Proyek
              </button>
            </div>

            {activeSection !== "projects" && loading ? (
              <div className="planner-panel planner-empty">Memuat ringkasan proyek...</div>
            ) : activeSection !== "projects" && projectManagement.featuredProject ? (
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
                <div><span>Total Proyek</span><strong>{loading ? "—" : formatCount(projectManagement.totalProjects)}</strong><small>Jumlah seluruh proyek</small></div>
              </article>
              <article className="planner-project-metric">
                <div className="planner-project-metric-icon metric-target"><ClipboardCheck size={20} /></div>
                <div><span>Proyek Aktif</span><strong>{loading ? "—" : formatCount(projectStatusSummary.active)}</strong><small>Sedang berjalan</small></div>
              </article>
              <article className="planner-project-metric">
                <div className="planner-project-metric-icon metric-draft"><FilePlus2 size={20} /></div>
                <div><span>Proyek Draft</span><strong>{loading ? "—" : formatCount(projectStatusSummary.draft)}</strong><small>Masih dalam perencanaan</small></div>
              </article>
              <article className="planner-project-metric">
                <div className="planner-project-metric-icon metric-completed"><CalendarDays size={20} /></div>
                <div><span>Proyek Selesai</span><strong>{loading ? "—" : formatCount(projectStatusSummary.completed)}</strong><small>Telah selesai</small></div>
              </article>
            </div>

            <section className="planner-panel planner-project-panel planner-project-register">
              <div className="planner-panel-heading">
                <div>
                  <h2>Daftar Proyek</h2>
                  <p>Seluruh proyek yang Anda kelola</p>
                </div>
              </div>
              <div className="planner-project-filters">
                <label className="planner-project-search">
                  <Search size={16} />
                  <input
                    type="search"
                    value={projectQuery}
                    onChange={(event) => {
                      setProjectQuery(event.target.value);
                      setProjectPage(1);
                    }}
                    placeholder="Cari kode atau nama proyek..."
                    aria-label="Cari kode atau nama proyek"
                  />
                </label>
                <label>
                  <span>Tahun</span>
                  <select
                    value={projectYearFilter}
                    onChange={(event) => {
                      setProjectYearFilter(event.target.value);
                      setProjectPage(1);
                    }}
                  >
                    <option value="all">Semua Tahun</option>
                    {[...new Set(dashboard.projects.map((project) => String(project.tahun)))].sort((a, b) => Number(b) - Number(a)).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={projectStatusFilter}
                    onChange={(event) => {
                      setProjectStatusFilter(event.target.value);
                      setProjectPage(1);
                    }}
                  >
                    <option value="all">Semua Status</option>
                    <option value="aktif">Aktif</option>
                    <option value="draft">Draft</option>
                    <option value="selesai">Selesai</option>
                    <option value="arsip">Arsip</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="planner-project-reset"
                  onClick={() => {
                    setProjectQuery("");
                    setProjectYearFilter("all");
                    setProjectStatusFilter("all");
                    setProjectPage(1);
                  }}
                >
                  <RotateCcw size={14} /> Reset Filter
                </button>
              </div>
              {loading ? (
                <div className="planner-empty">Memuat proyek...</div>
              ) : filteredProjects.length === 0 ? (
                <div className="planner-empty">
                  {dashboard.projects.length ? "Tidak ada proyek yang sesuai dengan filter." : "Belum ada proyek. Tambahkan proyek untuk mulai mengelola perencanaan."}
                  {!dashboard.projects.length && (
                    <button type="button" className="planner-project-primary-button" onClick={() => openCreate("project")}>
                      <Plus size={15} /> Tambah proyek pertama
                    </button>
                  )}
                </div>
              ) : (
                <div className="planner-data-table-wrap">
                  <table className="planner-data-table planner-project-data-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Kode Proyek</th>
                        <th>Nama Proyek</th>
                        <th>Tahun</th>
                        <th>Periode</th>
                        <th>Target Pekerjaan</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProjects.map((project, index) => (
                        <tr key={project.id}>
                          <td>{projectRangeStart + index}</td>
                          <td><strong>{project.kode}</strong></td>
                          <td>{project.nama}</td>
                          <td>{project.tahun}</td>
                          <td>{formatDate(project.periode_mulai)} – {formatDate(project.periode_selesai)}</td>
                          <td>{project.target_jumlah === null ? "—" : formatCount(project.target_jumlah)}</td>
                          <td><span className={`planner-status status-project-${project.status}`}>{statusLabel(project.status)}</span></td>
                          <td>
                            <div className="planner-table-actions">
                              <button
                                type="button"
                                className="planner-table-action"
                                onClick={() => {
                                  setProjectDetailTab("info");
                                  setSelectedProject(project);
                                }}
                              >
                                <Eye size={14} /> Detail
                              </button>
                              <button type="button" className="planner-table-action" onClick={() => openEdit("project", project)} disabled={saving || Boolean(deleting)}>
                                <Pencil size={14} /> Edit
                              </button>
                              <button type="button" className="planner-table-action danger" onClick={() => deletePlannerItem("project", project)} disabled={saving || Boolean(deleting)}>
                                <Trash2 size={14} /> Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!loading && filteredProjects.length > 0 && (
                <div className="planner-project-pagination">
                  <span>Menampilkan {projectRangeStart}–{projectRangeEnd} dari {filteredProjects.length} data</span>
                  <div>
                    <button type="button" onClick={() => setProjectPage(currentProjectPage - 1)} disabled={currentProjectPage <= 1} aria-label="Halaman sebelumnya">
                      <ChevronLeft size={15} />
                    </button>
                    <strong>{currentProjectPage}</strong>
                    <button type="button" onClick={() => setProjectPage(currentProjectPage + 1)} disabled={currentProjectPage >= projectPageCount} aria-label="Halaman berikutnya">
                      <ChevronRight size={15} />
                    </button>
                  </div>
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
                <h2>Jadwal Perencanaan</h2>
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
            SIMON · Sistem Informasi Monitoring
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
                  <button type="submit" disabled={saving}>
                    {saving
                      ? "Menyimpan..."
                      : editor.kind === "plan"
                        ? editor.item ? "Simpan Perubahan" : "Simpan Draft"
                        : "Simpan"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        {selectedProject && (
          <div
            className="planner-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedProject(null);
            }}
          >
            <section className="planner-modal planner-plan-detail-modal" role="dialog" aria-modal="true" aria-labelledby="planner-project-detail-title">
              <div className="planner-modal-heading">
                <div>
                  <span className="planner-plan-detail-code">{selectedProject.kode}</span>
                  <h2 id="planner-project-detail-title">{selectedProject.nama}</h2>
                  <p>Detail proyek perencanaan</p>
                </div>
                <button type="button" className="planner-modal-close" onClick={() => setSelectedProject(null)} aria-label="Tutup detail proyek">
                  <X size={18} />
                </button>
              </div>
              <div className="planner-project-detail-tabs" role="tablist" aria-label="Informasi proyek">
                {[
                  ["info", "Informasi Umum"],
                  ["plans", "Rencana Pekerjaan"],
                  ["history", "Riwayat"],
                ].map(([tab, label]) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={projectDetailTab === tab}
                    className={projectDetailTab === tab ? "active" : ""}
                    key={tab}
                    onClick={() => setProjectDetailTab(tab)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {projectDetailTab === "info" ? (
                <>
                  <dl className="planner-plan-detail-grid">
                    <div><dt>Tahun</dt><dd>{selectedProject.tahun}</dd></div>
                    <div><dt>Status</dt><dd><span className={`planner-status status-project-${selectedProject.status}`}>{statusLabel(selectedProject.status)}</span></dd></div>
                    <div><dt>Periode mulai</dt><dd>{formatDate(selectedProject.periode_mulai)}</dd></div>
                    <div><dt>Periode selesai</dt><dd>{formatDate(selectedProject.periode_selesai)}</dd></div>
                    <div><dt>Target pekerjaan</dt><dd>{selectedProject.target_jumlah === null ? "—" : formatCount(selectedProject.target_jumlah)}</dd></div>
                    <div><dt>Jumlah rencana</dt><dd>{formatCount(selectedProject.jumlah_rencana)}</dd></div>
                  </dl>
                  <div className="planner-plan-detail-notes">
                    <article><h3>Deskripsi</h3><p>{selectedProject.deskripsi || "Belum ada deskripsi proyek."}</p></article>
                  </div>
                </>
              ) : (
                <div className="planner-project-detail-list">
                  {projectDetailRows.length === 0 ? (
                    <p className="planner-empty">
                      {projectDetailTab === "history"
                        ? "Belum ada rencana selesai atau dibatalkan."
                        : "Belum ada rencana pekerjaan pada proyek ini."}
                    </p>
                  ) : projectDetailRows.map((plan) => (
                    <article key={plan.id}>
                      <div>
                        <strong>{plan.judul}</strong>
                        <span>{formatDate(plan.tgl_rencana_mulai)} – {formatDate(plan.tgl_rencana_selesai)}</span>
                      </div>
                      <span className={`planner-status status-${plan.status}`}>{statusLabel(plan.status)}</span>
                    </article>
                  ))}
                </div>
              )}
              <div className="planner-form-actions planner-plan-detail-actions">
                <button type="button" onClick={() => setSelectedProject(null)}>Tutup</button>
                <button
                  type="button"
                  onClick={() => {
                    const project = selectedProject;
                    setSelectedProject(null);
                    openEdit("project", project);
                  }}
                >
                  <Pencil size={14} /> Edit Proyek
                </button>
              </div>
            </section>
          </div>
        )}
        {selectedPlan && (
          <div
            className="planner-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedPlan(null);
            }}
          >
            <section
              className="planner-modal planner-plan-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="planner-plan-detail-title"
            >
              <div className="planner-modal-heading">
                <div>
                  <span className="planner-plan-detail-code">{selectedPlan.kode_proyek}</span>
                  <h2 id="planner-plan-detail-title">{selectedPlan.judul}</h2>
                  <p>{selectedPlan.nama_proyek} · {selectedPlan.jenis_pekerjaan}</p>
                </div>
                <div className="planner-plan-detail-heading-actions">
                  <span className={`planner-status status-${selectedPlan.status}`}>
                    {statusLabel(selectedPlan.status)}
                  </span>
                  <button
                    type="button"
                    className="planner-modal-close"
                    onClick={() => setSelectedPlan(null)}
                    aria-label="Tutup detail rencana"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <dl className="planner-plan-detail-grid">
                <div><dt>Rencana asal</dt><dd>{selectedPlanOrigin?.judul || (selectedPlan.rencana_asal_id ? `ID ${selectedPlan.rencana_asal_id}` : "Rencana utama")}</dd></div>
                <div><dt>Jenis rencana</dt><dd>{enumLabel(selectedPlan.tipe_rencana) || "—"}</dd></div>
                <div><dt>Jangka</dt><dd>{enumLabel(selectedPlan.jangka) || "—"}</dd></div>
                <div><dt>Tahun rencana</dt><dd>{selectedPlan.tahun_plan || "—"}</dd></div>
                <div><dt>Fungsi</dt><dd>{selectedPlan.fungsi || "Belum ditentukan"}</dd></div>
                <div><dt>Prioritas</dt><dd>{selectedPlan.prioritas || "—"}</dd></div>
                <div><dt>PIC awal</dt><dd>{selectedPlanPic?.nama || "Belum ditentukan"}</dd></div>
                <div><dt>Tanggal mulai</dt><dd>{formatDate(selectedPlan.tgl_rencana_mulai)}</dd></div>
                <div><dt>Target selesai</dt><dd>{formatDate(selectedPlan.tgl_rencana_selesai)}</dd></div>
                <div><dt>Durasi</dt><dd>{formatCount(selectedPlan.durasi_hari)} hari</dd></div>
                <div><dt>Pekerjaan terkait</dt><dd>{formatCount(selectedPlan.jumlah_pekerjaan)} pekerjaan</dd></div>
                <div><dt>Progres rata-rata</dt><dd>{Number(selectedPlan.rata_progres) || 0}%</dd></div>
                <div><dt>Media permintaan</dt><dd>{selectedPlan.media_permintaan || "—"}</dd></div>
              </dl>

              <div className="planner-plan-detail-notes">
                <article><h3>Ruang lingkup</h3><p>{selectedPlan.ruang_lingkup || "Belum diisi."}</p></article>
                <article><h3>Target</h3><p>{selectedPlan.target || "Belum diisi."}</p></article>
                <article><h3>Dasar permintaan</h3><p>{selectedPlan.dasar_permintaan || "Belum diisi."}</p></article>
                {selectedPlan.alasan_batal && (
                  <article><h3>Alasan pembatalan</h3><p>{selectedPlan.alasan_batal}</p></article>
                )}
                {latestRevisionNote?.catatan && (
                  <article className="planner-revision-note">
                    <h3>Catatan revisi Supervisor</h3>
                    <p>{latestRevisionNote.catatan}</p>
                  </article>
                )}
              </div>

              <section className="planner-plan-history" aria-label="Riwayat perubahan status">
                <h3>Riwayat Status</h3>
                {planHistoryLoading ? (
                  <p>Memuat riwayat status...</p>
                ) : planHistoryError ? (
                  <p role="alert">{planHistoryError}</p>
                ) : planHistory.length === 0 ? (
                  <p>Belum ada riwayat status.</p>
                ) : (
                  <ol>
                    {planHistory.map((entry) => (
                      <li key={entry.id}>
                        <div>
                          <strong>{entry.status_lama ? `${statusLabel(entry.status_lama)} → ` : ""}{statusLabel(entry.status_baru)}</strong>
                          <small>{entry.diubah_oleh || "Pengguna"} · {formatDate(entry.created_at)}</small>
                          {entry.catatan && <p>{entry.catatan}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <div className="planner-form-actions planner-plan-detail-actions">
                <button type="button" onClick={() => setSelectedPlan(null)}>Tutup</button>
                {["draft", "revisi"].includes(selectedPlan.status) && (
                  <>
                    <button
                      type="button"
                      onClick={() => submitPlanToSupervisor(selectedPlan)}
                      disabled={submittingPlanId === String(selectedPlan.id)}
                    >
                      <Send size={14} /> {submittingPlanId === String(selectedPlan.id) ? "Mengirim..." : "Kirim ke Supervisor"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const plan = selectedPlan;
                        setSelectedPlan(null);
                        openEdit("plan", plan);
                      }}
                    >
                      <Pencil size={14} /> Ubah rencana
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
