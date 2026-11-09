import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChartColumn,
  ChevronRight,
  Download,
  Clock3,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PencilLine,
  Paperclip,
  RefreshCw,
  Search,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import "./StaffDashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const emptyDashboard = {
  summary: {
    total_pekerjaan: 0,
    pekerjaan_aktif: 0,
    menunggu_evaluasi: 0,
    pekerjaan_selesai: 0,
    pekerjaan_terlambat: 0,
    deadline_mendekat: 0,
  },
  tasks: [],
  notifications: [],
  progressHistory: [],
  stages: [],
};

const todayLabel = new Date().toLocaleDateString("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const currentDate = new Date();
const todayInputDate = [
  currentDate.getFullYear(),
  String(currentDate.getMonth() + 1).padStart(2, "0"),
  String(currentDate.getDate()).padStart(2, "0"),
].join("-");

async function fetchStaffDashboard(token) {
  const response = await fetch(`${API_URL}/staff/dashboard`, {
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Gagal memuat dashboard staff.");
  }
  return {
    summary: { ...emptyDashboard.summary, ...data.summary },
    tasks: data.tasks || [],
    notifications: data.notifications || [],
    progressHistory: data.progressHistory || [],
    stages: data.stages || [],
  };
}

async function fetchTaskProgressHistory(token, taskId) {
  const response = await fetch(`${API_URL}/staff/tasks/${taskId}/progress-history`, {
    headers: { Authorization: ["Bear", "er"].join("") + " " + (token || "") },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Gagal memuat riwayat progres pekerjaan.");
  }
  return data.history || [];
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("id-ID");
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

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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
    disetujui: "Terverifikasi",
    dikembalikan: "Perlu diperbaiki",
  }[status] || "";
}

function getNoteSection(note, section) {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(note || "").match(
    new RegExp(
      `(?:^|\\n\\n)${escapedSection}:\\s*([\\s\\S]*?)(?=\\n\\n(?:Detail|Kendala|Rencana tindak lanjut):|$)`,
      "i"
    )
  );
  return match?.[1]?.trim() || "";
}

function initials(name) {
  return String(name || "Staff")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function isOverdue(task) {
  return task.status !== "selesai" &&
    task.status !== "dibatalkan" &&
    task.deadline &&
    new Date(`${String(task.deadline).slice(0, 10)}T00:00:00`) < new Date(new Date().toDateString());
}

export default function StaffDashboard({ session, onLogout }) {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskSort, setTaskSort] = useState("deadline");
  const [historyTaskId, setHistoryTaskId] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historySort, setHistorySort] = useState("newest");
  const [historyMonth, setHistoryMonth] = useState("all");
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoadedTaskId, setHistoryLoadedTaskId] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyReload, setHistoryReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [progressTask, setProgressTask] = useState(null);
  const [progressValue, setProgressValue] = useState(0);
  const [progressDate, setProgressDate] = useState(() => todayInputDate);
  const [progressStageId, setProgressStageId] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [progressObstacle, setProgressObstacle] = useState("");
  const [progressNextStep, setProgressNextStep] = useState("");
  const [progressAttachment, setProgressAttachment] = useState(null);
  const [progressError, setProgressError] = useState("");
  const [progressSaving, setProgressSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const verifiedProgress = Number(progressTask?.progres_terverifikasi) || 0;
  const userName = session?.user?.nama || "Staff";
  const summary = dashboard.summary;

  function progressDraftKey(taskId) {
    return `simon_staff_progress_draft_${session?.user?.id}_${taskId}`;
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      setDashboard(await fetchStaffDashboard(session?.token));
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
          : requestError.message || "Gagal memuat dashboard staff."
      );
    } finally {
      setLoading(false);
    }
  }

  function openProgressForm(task) {
    setProgressTask(task);
    setProgressError("");
    const availableStages = dashboard.stages || [];
    const taskStageId = String(task.tahapan_saat_ini || "");
    const selectedStageId = availableStages.some(
      (stage) => String(stage.id) === taskStageId
    )
      ? taskStageId
      : String(availableStages[0]?.id || "");
    const defaults = {
      nilai_progres: Number(task.progres_terverifikasi) || 0,
      tanggal_update: todayInputDate,
      tahapan_id: selectedStageId,
      catatan: "",
      kendala: "",
      rencana_tindak_lanjut: "",
    };
    let draft = defaults;
    try {
      const savedDraft = localStorage.getItem(progressDraftKey(task.id));
      if (savedDraft) draft = { ...defaults, ...JSON.parse(savedDraft) };
    } catch {
      setProgressError("Draft progres tersimpan tidak dapat dibaca dari browser.");
    }
    setProgressValue(Math.max(
      defaults.nilai_progres,
      Number(draft.nilai_progres) || 0
    ));
    setProgressDate(draft.tanggal_update);
    setProgressStageId(String(draft.tahapan_id));
    setProgressNote(draft.catatan);
    setProgressObstacle(draft.kendala);
    setProgressNextStep(draft.rencana_tindak_lanjut);
    setProgressAttachment(null);
    setSuccessMessage("");
    setActiveSection("update-progress");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveProgressDraft() {
    try {
      localStorage.setItem(progressDraftKey(progressTask.id), JSON.stringify({
        nilai_progres: Number(progressValue) || verifiedProgress,
        tanggal_update: progressDate,
        tahapan_id: progressStageId,
        catatan: progressNote,
        kendala: progressObstacle,
        rencana_tindak_lanjut: progressNextStep,
      }));
      setSuccessMessage(
        progressAttachment
          ? "Draft disimpan di browser ini. Pilih kembali lampiran saat melanjutkan."
          : "Draft disimpan di browser ini."
      );
      setProgressError("");
    } catch {
      setProgressError("Draft tidak dapat disimpan. Periksa ruang penyimpanan browser.");
    }
  }

  async function submitProgress(event) {
    event.preventDefault();
    if (!progressTask) return;

    setProgressError("");
    setProgressSaving(true);
    try {
      const formData = new FormData();
      formData.set("nilai_progres", String(progressValue));
      formData.set("tanggal_update", progressDate);
      formData.set("tahapan_id", progressStageId);
      formData.set("catatan", progressNote);
      formData.set("kendala", progressObstacle);
      formData.set("rencana_tindak_lanjut", progressNextStep);
      if (progressAttachment) formData.set("lampiran", progressAttachment);

      const response = await fetch(
        `${API_URL}/staff/tasks/${progressTask.id}/progress`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.token || ""}` },
          body: formData,
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Gagal memperbarui progres.");
      }

      setProgressTask(null);
      setActiveSection("progress-history");
      setHistoryLoadedTaskId("");
      setHistoryError("");
      setSuccessMessage(data.message || "Progres berhasil diperbarui.");
      try {
        localStorage.removeItem(progressDraftKey(progressTask.id));
      } catch {
        setSuccessMessage(
          "Progres berhasil dikirim. Hapus draft lokal secara manual jika masih muncul kembali."
        );
      }
      await loadDashboard();
    } catch (requestError) {
      setProgressError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
          : requestError.message || "Gagal memperbarui progres."
      );
    } finally {
      setProgressSaving(false);
    }
  }

  async function downloadProgressAttachment(attachment) {
    try {
      const response = await fetch(
        `${API_URL}/staff/progress-attachments/${attachment.id}`,
        { headers: { Authorization: `Bearer ${session?.token || ""}` } }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Gagal mengunduh lampiran.");
      }
      const fileUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = attachment.nama_file;
      link.click();
      URL.revokeObjectURL(fileUrl);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
          : requestError.message || "Gagal mengunduh lampiran."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  useEffect(() => {
    let active = true;
    fetchStaffDashboard(session?.token)
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError instanceof TypeError
            ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
            : requestError.message || "Gagal memuat dashboard staff."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.token]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dashboard.tasks.filter((task) => {
      const matchesQuery = [
        task.kode,
        task.nama_pekerjaan,
        task.nama_proyek,
        task.kode_proyek,
        task.prioritas,
        task.status,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      const matchesFilter =
        filter === "all" ||
        (filter === "updatable" && !["selesai", "dibatalkan"].includes(task.status)) ||
        (filter === "active" && ["berjalan", "tertunda", "menunggu_evaluasi"].includes(task.status)) ||
        (filter === "overdue" && isOverdue(task)) ||
        (filter === "waiting" && task.status === "menunggu_evaluasi") ||
        (filter === "done" && task.status === "selesai");
      return matchesQuery && matchesFilter;
    });
  }, [dashboard.tasks, query, filter]);

  const activeTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dashboard.tasks.filter((task) =>
      !["selesai", "dibatalkan"].includes(task.status) &&
      [
        task.kode,
        task.nama_pekerjaan,
        task.nama_proyek,
        task.kode_proyek,
        task.prioritas,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery))
    );
  }, [dashboard.tasks, query]);
  const homeTasks = activeTasks.slice(0, 4);
  const taskWorkspaceResults = useMemo(() => {
    const normalizedQuery = taskSearch.trim().toLowerCase();
    return dashboard.tasks
      .filter((task) => {
        const matchesQuery = [
          task.kode,
          task.nama_pekerjaan,
          task.nama_proyek,
          task.kode_proyek,
          task.prioritas,
          task.fungsi,
          task.divisi,
        ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
        const matchesFilter =
          filter === "all" ||
          (filter === "active" && ["belum_dimulai", "berjalan", "tertunda"].includes(task.status)) ||
          (filter === "overdue" && (isOverdue(task) || task.status_verifikasi_terbaru === "dikembalikan")) ||
          (filter === "new" && task.status === "belum_dimulai") ||
          (filter === "done" && task.status === "selesai");
        return matchesQuery && matchesFilter;
      })
      .sort((first, second) => {
        if (taskSort === "progress") {
          return Number(second.progres_terakhir || 0) - Number(first.progres_terakhir || 0);
        }
        return String(first.deadline || "9999-12-31").localeCompare(
          String(second.deadline || "9999-12-31")
        );
      });
  }, [dashboard.tasks, filter, taskSearch, taskSort]);
  const selectedHistoryTask =
    dashboard.tasks.find((task) => String(task.id) === String(historyTaskId)) ||
    dashboard.tasks[0] ||
    null;
  const selectedHistoryTaskId = selectedHistoryTask ? String(selectedHistoryTask.id) : "";
  useEffect(() => {
    if (activeSection !== "progress-history" || !selectedHistoryTaskId) return undefined;
    let active = true;
    fetchTaskProgressHistory(session?.token, selectedHistoryTaskId)
      .then((entries) => {
        if (!active) return;
        setHistoryEntries(entries);
        setHistoryLoadedTaskId(selectedHistoryTaskId);
        setHistoryError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setHistoryEntries([]);
        setHistoryLoadedTaskId(selectedHistoryTaskId);
        setHistoryError(
          requestError instanceof TypeError
            ? "Tidak dapat terhubung ke backend. Pastikan server berjalan."
            :             requestError.message || "Gagal memuat riwayat progres pekerjaan."
        );
      });

    return () => {
      active = false;
    };
  }, [activeSection, historyReload, selectedHistoryTaskId, session?.token]);
  const historyLoading = activeSection === "progress-history" &&
    Boolean(selectedHistoryTaskId) &&
    historyLoadedTaskId !== selectedHistoryTaskId &&
    !historyError;
  const currentTaskHistory = useMemo(
    () => historyLoadedTaskId === selectedHistoryTaskId ? historyEntries : [],
    [historyEntries, historyLoadedTaskId, selectedHistoryTaskId]
  );
  const selectedTaskHistory = useMemo(
    () => currentTaskHistory
      .filter((item) => Number(item.pekerjaan_id) === Number(selectedHistoryTask?.id))
      .sort((first, second) =>
        String(first.tanggal_update).localeCompare(String(second.tanggal_update)) ||
        Number(first.id) - Number(second.id)
      ),
    [currentTaskHistory, selectedHistoryTask?.id]
  );
  const availableHistoryMonths = [...new Set(selectedTaskHistory.map(
    (item) => String(item.tanggal_update || "").slice(0, 7)
  ).filter(Boolean))].sort();
  const chartHistory = selectedTaskHistory.filter((item) =>
    historyMonth === "all" || String(item.tanggal_update || "").slice(0, 7) === historyMonth
  );
  const statusCounts = selectedTaskHistory.reduce((counts, item) => {
    if (item.status_verifikasi in counts) counts[item.status_verifikasi] += 1;
    return counts;
  }, { disetujui: 0, menunggu: 0, dikembalikan: 0 });
  const historyTotal = Object.values(statusCounts).reduce((total, count) => total + count, 0);
  const latestHistoryProgress = selectedTaskHistory[selectedTaskHistory.length - 1];
  const displayedHistory = [...selectedTaskHistory]
    .filter((item) => historyStatus === "all" || item.status_verifikasi === historyStatus)
    .sort((first, second) => {
      const compared = String(first.tanggal_update).localeCompare(String(second.tanggal_update)) ||
        Number(first.id) - Number(second.id);
      return historySort === "newest" ? -compared : compared;
    });

  const priorityTask = useMemo(() => {
    const returnedTask = activeTasks.find(
      (task) => task.status_verifikasi_terbaru === "dikembalikan"
    );
    if (returnedTask) return returnedTask;

    return [...activeTasks].sort((first, second) => {
      const firstOverdue = isOverdue(first);
      const secondOverdue = isOverdue(second);
      if (firstOverdue !== secondOverdue) return firstOverdue ? -1 : 1;
      return String(first.deadline || "9999-12-31").localeCompare(
        String(second.deadline || "9999-12-31")
      );
    })[0] || null;
  }, [activeTasks]);

  const returnedProgressCount = Number(summary.progres_dikembalikan) || 0;
  const tasksNeedingAttention = dashboard.tasks.filter(
    (task) => isOverdue(task) || task.status_verifikasi_terbaru === "dikembalikan"
  );
  const returnedTask = dashboard.tasks.find(
    (task) => task.status_verifikasi_terbaru === "dikembalikan" &&
      !["selesai", "dibatalkan"].includes(task.status)
  );
  const deadlineTasks = [...dashboard.tasks]
    .filter((task) => !["selesai", "dibatalkan"].includes(task.status))
    .sort((first, second) => String(first.deadline || "9999-12-31").localeCompare(
      String(second.deadline || "9999-12-31")
    ));
  const deadlineTask = deadlineTasks.find(
    (task) => Number(task.id) !== Number(returnedTask?.id)
  ) || deadlineTasks[0] || null;
  const pendingProgressCount = Number(summary.progres_menunggu) || 0;
  const deadlineTodayCount = activeTasks.filter(
    (task) => String(task.deadline || "").slice(0, 10) === todayInputDate
  ).length;
  const weeklySubmitted = Number(summary.progres_minggu_ini) || 0;
  const weeklyApproved = Number(summary.progres_disetujui_minggu_ini) || 0;
  const weeklyCompletion = weeklySubmitted
    ? Math.round((weeklyApproved / weeklySubmitted) * 100)
    : 0;
  const priorityHistory = priorityTask
    ? dashboard.progressHistory.find(
        (item) => Number(item.pekerjaan_id) === Number(priorityTask.id)
      )
    : null;
  const priorityNextStep = getNoteSection(
    priorityTask?.catatan_progres_disetujui || priorityHistory?.catatan,
    "Rencana tindak lanjut"
  );
  const primaryActionCount = returnedProgressCount + deadlineTodayCount;

  function goToSection(section) {
    setActiveSection(section);
    if (section === "tasks") setFilter("active");
    setSidebarOpen(false);
    if (section === "progress-history") {
      setHistoryLoadedTaskId("");
      setHistoryError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function goToProgressUpdates() {
    setActiveSection("update-progress");
    setFilter("updatable");
    setSidebarOpen(false);
    const firstUpdatableTask = dashboard.tasks.find(
      (task) => !["selesai", "dibatalkan"].includes(task.status)
    );
    if (firstUpdatableTask) {
      openProgressForm(firstUpdatableTask);
      return;
    }
    setProgressTask(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToTasks() {
    setProgressTask(null);
    setActiveSection("tasks");
    setFilter("active");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeTaskFilter(value) {
    setFilter(value);
    setActiveSection(value === "updatable" ? "update-progress" : "tasks");
  }

  return (
    <div className="staff-dashboard">
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
            <LayoutDashboard size={18} /> Dashboard Staff
          </button>
          <button
            type="button"
            className={activeSection === "tasks" ? "active" : ""}
            onClick={() => goToSection("tasks")}
          >
            <BriefcaseBusiness size={18} /> Pekerjaan Saya
            {Number(summary.pekerjaan_aktif) > 0 && (
              <span className="staff-nav-count">{summary.pekerjaan_aktif}</span>
            )}
          </button>
          <button
            type="button"
            className={activeSection === "update-progress" ? "active" : ""}
            onClick={goToProgressUpdates}
          >
            <Activity size={18} /> Update Progres
          </button>
          <button
            type="button"
            className={activeSection === "notifications" ? "active" : ""}
            onClick={() => goToSection("notifications")}
          >
            <Bell size={18} /> Notifikasi
            {dashboard.notifications.filter((item) => !item.dibaca_at).length > 0 && (
              <span className="staff-nav-count">
                {dashboard.notifications.filter((item) => !item.dibaca_at).length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={activeSection === "progress-history" ? "active" : ""}
            onClick={() => goToSection("progress-history")}
          >
            <History size={18} /> Riwayat Progres
          </button>
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
                aria-label="Cari pekerjaan"
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
              <div><strong>{userName}</strong><span>STAFF</span></div>
            </div>
          </div>
        </header>

        <div className="staff-content">
          {activeSection === "progress-history" ? (
            <section className="staff-history-page" id="progress-history">
              <div className="staff-page-title">
                <h1>Riwayat Progres</h1>
                <p>Visualisasi progres mingguan dan hasil verifikasi dari progres_log</p>
              </div>

              {error && (
                <div className="staff-error" role="alert">
                  <div><strong>Riwayat progres belum dapat dimuat</strong><span>{error}</span></div>
                  <button type="button" onClick={loadDashboard}>Coba lagi</button>
                </div>
              )}
              {successMessage && (
                <div className="staff-success" role="status">
                  <CheckCircle2 size={17} />
                  <span>{successMessage}</span>
                  <button type="button" aria-label="Tutup pesan" onClick={() => setSuccessMessage("")}>
                    <X size={15} />
                  </button>
                </div>
              )}
              {historyError && (
                <div className="staff-error" role="alert">
                  <div><strong>Riwayat pekerjaan belum dapat dimuat</strong><span>{historyError}</span></div>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryError("");
                      setHistoryLoadedTaskId("");
                      setHistoryReload((count) => count + 1);
                    }}
                  >
                    Muat ulang
                  </button>
                </div>
              )}

              <section className="staff-history-summary">
                <label className="staff-history-task-select">
                  <span>PEKERJAAN</span>
                  <select
                    value={selectedHistoryTask?.id || ""}
                    onChange={(event) => {
                      setHistoryTaskId(event.target.value);
                      setHistoryLoadedTaskId("");
                      setHistoryError("");
                      setHistoryMonth("all");
                      setHistoryStatus("all");
                    }}
                    aria-label="Pilih pekerjaan untuk riwayat progres"
                  >
                    {!dashboard.tasks.length && <option value="">Belum ada pekerjaan</option>}
                    {dashboard.tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.kode} — {task.nama_pekerjaan}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="staff-history-summary-stat">
                  <span>PROGRES TERAKHIR</span>
                  <strong>{Number(latestHistoryProgress?.nilai_progres ?? selectedHistoryTask?.progres_terakhir) || 0}%</strong>
                </div>
                <div className="staff-history-summary-stat">
                  <span>TERVERIFIKASI</span>
                  <strong className="is-verified">{Number(selectedHistoryTask?.progres_terverifikasi) || 0}%</strong>
                </div>
                <div className="staff-history-summary-stat">
                  <span>TOTAL UPDATE</span>
                  <strong>{formatCount(historyTotal)}</strong>
                </div>
                <span className={`staff-history-task-status status-${selectedHistoryTask?.status || "none"}`}>
                  {selectedHistoryTask ? statusLabel(selectedHistoryTask.status) : "Tidak ada pekerjaan"}
                </span>
              </section>

              <div className="staff-history-analytics">
                <section className="staff-panel staff-history-chart-panel">
                  <div className="staff-history-panel-heading">
                    <div>
                      <h2>Perkembangan Progres</h2>
                      <p>Visualisasi setiap pembaruan yang tersimpan pada progres_log</p>
                    </div>
                    <label className="staff-history-month-select">
                      <span className="staff-visually-hidden">Pilih bulan</span>
                      <select
                        value={historyMonth}
                        onChange={(event) => setHistoryMonth(event.target.value)}
                        aria-label="Filter bulan riwayat"
                      >
                        <option value="all">Semua bulan</option>
                        {availableHistoryMonths.map((month) => (
                          <option key={month} value={month}>
                            {new Date(`${month}-01T00:00:00`).toLocaleDateString("id-ID", {
                              month: "long",
                              year: "numeric",
                            })}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {loading || historyLoading ? (
                    <div className="staff-empty">Memuat visualisasi progres...</div>
                  ) : chartHistory.length === 0 ? (
                    <div className="staff-history-chart-empty">
                      Belum ada riwayat progres untuk pekerjaan ini.
                    </div>
                  ) : (
                    <>
                      <div className="staff-history-chart">
                        <svg viewBox="0 0 800 190" role="img" aria-label="Grafik perkembangan progres">
                          <defs>
                            <linearGradient id="staff-history-area" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity=".2" />
                              <stop offset="100%" stopColor="#2563eb" stopOpacity=".015" />
                            </linearGradient>
                          </defs>
                          {[0, 25, 50, 75, 100].map((value) => {
                            const y = 158 - value * 1.35;
                            return (
                              <g key={value}>
                                <line x1="44" x2="786" y1={y} y2={y} className="staff-history-chart-grid" />
                                <text x="0" y={y + 3} className="staff-history-chart-axis">{value}%</text>
                              </g>
                            );
                          })}
                          {(() => {
                            const points = chartHistory.map((item, index) => {
                              const x = chartHistory.length === 1
                                ? 415
                                : 44 + (index * 742) / (chartHistory.length - 1);
                              const value = Math.min(100, Math.max(0, Number(item.nilai_progres) || 0));
                              return { x, y: 158 - value * 1.35, value, item };
                            });
                            const linePath = points.map((point, index) =>
                              `${index ? "L" : "M"} ${point.x} ${point.y}`
                            ).join(" ");
                            const areaPath = `${linePath} L ${points[points.length - 1].x} 158 L ${points[0].x} 158 Z`;
                            return (
                              <g>
                                <path d={areaPath} fill="url(#staff-history-area)" />
                                <path d={linePath} className="staff-history-chart-line" />
                                {points.map((point) => (
                                  <circle
                                    key={point.item.id}
                                    cx={point.x}
                                    cy={point.y}
                                    r="6"
                                    className="staff-history-chart-point"
                                  />
                                ))}
                              </g>
                            );
                          })()}
                        </svg>
                      </div>
                      <div
                        className="staff-history-chart-labels"
                        style={{ "--history-point-count": chartHistory.length }}
                      >
                        {chartHistory.map((item) => (
                          <div key={item.id}>
                            <span>{formatDate(item.tanggal_update)}</span>
                            <strong>{Number(item.nilai_progres) || 0}%</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>

                <section className="staff-panel staff-history-status-panel">
                  <div className="staff-history-panel-heading">
                    <div>
                      <h2>Status Verifikasi</h2>
                      <p>Distribusi pembaruan pada pekerjaan ini</p>
                    </div>
                  </div>
                  <div
                    className={`staff-history-donut ${historyTotal ? "" : "is-empty"}`}
                    role="img"
                    aria-label={`${historyTotal} update: ${statusCounts.disetujui} disetujui, ${statusCounts.menunggu} menunggu, ${statusCounts.dikembalikan} dikembalikan`}
                    style={{
                      "--history-approved": `${historyTotal ? (statusCounts.disetujui / historyTotal) * 100 : 0}%`,
                      "--history-pending": `${historyTotal ? (statusCounts.menunggu / historyTotal) * 100 : 0}%`,
                      "--history-returned": `${historyTotal ? (statusCounts.dikembalikan / historyTotal) * 100 : 0}%`,
                    }}
                  >
                    <div>
                      <strong>{formatCount(historyTotal)}</strong>
                      <span>Update</span>
                    </div>
                  </div>
                  <div className="staff-history-donut-legend">
                    <span><i className="is-approved" /> Disetujui <strong>{formatCount(statusCounts.disetujui)}</strong></span>
                    <span><i className="is-pending" /> Menunggu <strong>{formatCount(statusCounts.menunggu)}</strong></span>
                    <span><i className="is-returned" /> Dikembalikan <strong>{formatCount(statusCounts.dikembalikan)}</strong></span>
                  </div>
                </section>
              </div>

              <section className="staff-panel staff-history-timeline-panel">
                <div className="staff-history-timeline-heading">
                  <div>
                    <h2>Daftar Riwayat Progres</h2>
                    <p>Halaman baca-saja untuk menelusuri pembaruan dan hasil verifikasi</p>
                  </div>
                  <div className="staff-history-timeline-controls">
                    <select
                      value={historyStatus}
                      onChange={(event) => setHistoryStatus(event.target.value)}
                      aria-label="Filter status verifikasi riwayat"
                    >
                      <option value="all">Semua Status</option>
                      <option value="disetujui">Disetujui</option>
                      <option value="menunggu">Menunggu</option>
                      <option value="dikembalikan">Dikembalikan</option>
                    </select>
                    <select
                      value={historySort}
                      onChange={(event) => setHistorySort(event.target.value)}
                      aria-label="Urutkan riwayat progres"
                    >
                      <option value="newest">Terbaru</option>
                      <option value="oldest">Terlama</option>
                    </select>
                  </div>
                </div>
                <div className="staff-history-timeline">
                  {loading || historyLoading ? (
                    <div className="staff-empty">Memuat riwayat progres...</div>
                  ) : displayedHistory.length === 0 ? (
                    <div className="staff-empty">
                      {selectedTaskHistory.length
                        ? "Tidak ada pembaruan dengan status tersebut."
                        : "Belum ada riwayat progres untuk pekerjaan ini."}
                    </div>
                  ) : displayedHistory.map((item) => (
                    <article className={`staff-history-timeline-item is-${item.status_verifikasi || "menunggu"}`} key={item.id}>
                      <div className="staff-history-timeline-marker">
                        <strong>{Number(item.nilai_progres) || 0}%</strong>
                      </div>
                      <div className="staff-history-timeline-card">
                        <div className="staff-history-entry-top">
                          <div>
                            <strong>{formatDate(item.tanggal_update)}</strong>
                            <span>Diperbarui oleh {item.diperbarui_oleh_nama || userName} · sumber: aplikasi</span>
                          </div>
                          <span className={`staff-verification status-${item.status_verifikasi}`}>
                            {item.status_verifikasi === "disetujui"
                              ? "Disetujui"
                              : item.status_verifikasi === "dikembalikan"
                                ? "Dikembalikan"
                                : "Menunggu"}
                          </span>
                        </div>
                        {item.catatan && <p className="staff-history-entry-note">{item.catatan}</p>}
                        <div className={`staff-history-review is-${item.status_verifikasi || "menunggu"}`}>
                          {item.status_verifikasi === "dikembalikan"
                            ? <AlertTriangle size={17} />
                            : item.status_verifikasi === "disetujui"
                              ? <CheckCircle2 size={17} />
                              : <Clock3 size={17} />}
                          <div>
                            <strong>
                              {item.status_verifikasi === "disetujui"
                                ? `Disetujui oleh ${item.diverifikasi_oleh_nama || "Supervisor"}`
                                : item.status_verifikasi === "dikembalikan"
                                  ? `Dikembalikan oleh ${item.diverifikasi_oleh_nama || "Supervisor"}`
                                  : "Menunggu verifikasi Supervisor"}
                            </strong>
                            <span>
                              {item.tgl_verifikasi
                                ? `Diverifikasi ${formatDateTime(item.tgl_verifikasi)}`
                                : item.status_verifikasi === "menunggu"
                                  ? "Pembaruan menunggu hasil verifikasi"
                                  : ""}
                            </span>
                            {item.catatan_verifikasi && (
                              <small>Catatan: {item.catatan_verifikasi}</small>
                            )}
                          </div>
                        </div>
                        {item.lampiran?.length > 0 && (
                          <div className="staff-history-attachments">
                            {item.lampiran.map((attachment) => (
                              <button
                                key={attachment.id}
                                type="button"
                                onClick={() => downloadProgressAttachment(attachment)}
                              >
                                <Paperclip size={12} /> {attachment.nama_file} <Download size={12} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          ) : activeSection === "tasks" ? (
            <section className="staff-workspace-page">
              <div className="staff-page-title">
                <h1>Pekerjaan Saya</h1>
                <p>Daftar pekerjaan yang ditugaskan langsung kepada Anda</p>
              </div>

              {error && (
                <div className="staff-error" role="alert">
                  <div><strong>Dashboard belum dapat dimuat</strong><span>{error}</span></div>
                  <button type="button" onClick={loadDashboard}>Coba lagi</button>
                </div>
              )}

              <section className="staff-workspace-profile">
                <div className="staff-workspace-identity">
                  <div className="staff-workspace-avatar">{initials(userName)}</div>
                  <div>
                    <span>RUANG KERJA STAFF</span>
                    <h2>{userName}</h2>
                    <p>
                      {dashboard.tasks.find((task) => task.supervisor_nama)?.divisi || "SIMON"}
                      {dashboard.tasks.find((task) => task.supervisor_nama)?.supervisor_nama
                        ? ` · Supervisor ${dashboard.tasks.find((task) => task.supervisor_nama).supervisor_nama}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="staff-workspace-stats">
                  <div><span>DITUGASKAN</span><strong>{formatCount(dashboard.tasks.length)}</strong><small>pekerjaan</small></div>
                  <div><span>AKTIF</span><strong>{formatCount(dashboard.tasks.filter((task) => !["selesai", "dibatalkan"].includes(task.status)).length)}</strong><small>sedang dikerjakan</small></div>
                  <div><span>PERLU TINDAKAN</span><strong className="is-warning">{formatCount(tasksNeedingAttention.length)}</strong><small>perlu ditinjau</small></div>
                  <div><span>SELESAI</span><strong>{formatCount(dashboard.tasks.filter((task) => task.status === "selesai").length)}</strong><small>periode ini</small></div>
                </div>
              </section>

              <div className="staff-workspace-notices">
                {returnedTask && (
                  <button
                    className="staff-workspace-notice is-returned"
                    type="button"
                    onClick={() => openProgressForm(returnedTask)}
                  >
                    <span className="staff-workspace-notice-icon"><AlertTriangle size={20} /></span>
                    <span className="staff-workspace-notice-copy">
                      <small>PROGRES DIKEMBALIKAN</small>
                      <strong>{returnedTask.nama_pekerjaan}</strong>
                      <span>{returnedTask.catatan_verifikasi || "Supervisor meminta perbaikan pada pembaruan progres."}</span>
                    </span>
                    <span className="staff-workspace-notice-action">Perbaiki Sekarang</span>
                    <ChevronRight size={17} />
                  </button>
                )}
                {deadlineTask && (
                  <button
                    className="staff-workspace-notice is-deadline"
                    type="button"
                    onClick={() => openProgressForm(deadlineTask)}
                  >
                    <span className="staff-workspace-notice-icon"><Clock3 size={20} /></span>
                    <span className="staff-workspace-notice-copy">
                      <small>{isOverdue(deadlineTask) ? "DEADLINE TERLEWAT" : "DEADLINE TERDEKAT"}</small>
                      <strong>{deadlineTask.nama_pekerjaan}</strong>
                      <span>
                        Progres terverifikasi {Number(deadlineTask.progres_terverifikasi) || 0}%
                        {deadlineTask.progres_terakhir !== undefined
                          ? ` · Progres terakhir ${Number(deadlineTask.progres_terakhir) || 0}%`
                          : ""}
                      </span>
                    </span>
                    <span className="staff-workspace-notice-action">Update Progres</span>
                    <ChevronRight size={17} />
                  </button>
                )}
              </div>

              <section className="staff-panel staff-workspace-panel">
                <div className="staff-workspace-toolbar">
                  <div className="staff-filter-tabs" role="group" aria-label="Filter pekerjaan">
                    {[
                      ["active", "Aktif"],
                      ["overdue", "Perlu Tindakan"],
                      ["new", "Belum Dimulai"],
                      ["done", "Selesai"],
                      ["all", "Semua"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={filter === value ? "active" : ""}
                        onClick={() => setFilter(value)}
                      >
                        {label}
                        {value === "overdue" && tasksNeedingAttention.length > 0 && (
                          <span className="staff-workspace-tab-count">{formatCount(tasksNeedingAttention.length)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="staff-workspace-controls">
                    <label className="staff-workspace-search">
                      <Search size={16} />
                      <input
                        value={taskSearch}
                        onChange={(event) => setTaskSearch(event.target.value)}
                        placeholder="Cari pekerjaan saya..."
                        aria-label="Cari pekerjaan saya"
                      />
                    </label>
                    <select
                      value={taskSort}
                      onChange={(event) => setTaskSort(event.target.value)}
                      aria-label="Urutkan pekerjaan"
                    >
                      <option value="deadline">Deadline terdekat</option>
                      <option value="progress">Progres tertinggi</option>
                    </select>
                  </div>
                </div>

                <div className="staff-workspace-list">
                  {loading || historyLoading ? (
                    <div className="staff-empty">Memuat pekerjaan...</div>
                  ) : taskWorkspaceResults.length === 0 ? (
                    <div className="staff-empty">
                      {dashboard.tasks.length === 0
                        ? "Belum ada pekerjaan yang ditugaskan kepada Anda."
                        : "Tidak ada pekerjaan yang cocok dengan filter."}
                    </div>
                  ) : taskWorkspaceResults.map((task) => {
                    const progress = Math.min(100, Math.max(0, Number(task.progres_terakhir ?? 0)));
                    const verification = task.status_verifikasi_terbaru;
                    const historyItem = dashboard.progressHistory.find(
                      (item) => Number(item.pekerjaan_id) === Number(task.id)
                    );
                    const nextStep = getNoteSection(
                      task.catatan_progres_disetujui || historyItem?.catatan,
                      "Rencana tindak lanjut"
                    );
                    const dateText = task.deadline
                      ? String(task.deadline).slice(0, 10)
                      : "";
                    const deadlineDate = dateText
                      ? new Date(`${dateText}T00:00:00`)
                      : null;
                    const daysLeft = deadlineDate && !Number.isNaN(deadlineDate.getTime())
                      ? Math.ceil((deadlineDate - new Date(`${todayInputDate}T00:00:00`)) / 86400000)
                      : null;
                    return (
                      <article
                        className={`staff-workspace-row ${verification === "dikembalikan" ? "is-returned" : ""} ${isOverdue(task) ? "is-late" : ""}`}
                        key={task.id}
                      >
                        <div className="staff-workspace-task">
                          <div className="staff-workspace-task-meta">
                            {task.kode && <span>{task.kode}</span>}
                            {task.jenis_pekerjaan && <span>{task.jenis_pekerjaan}</span>}
                            {task.prioritas && <span className="is-priority">{task.prioritas}</span>}
                          </div>
                          <h3>{task.nama_pekerjaan}</h3>
                          <p>{task.fungsi || task.divisi || task.nama_proyek || "Pekerjaan"}</p>
                          <div className={`staff-workspace-next ${verification === "dikembalikan" ? "is-returned" : ""}`}>
                            {verification === "dikembalikan"
                              ? <AlertTriangle size={15} />
                              : verification === "menunggu"
                                ? <Clock3 size={15} />
                                : <CheckCircle2 size={15} />}
                            <span>
                              <small>TINDAKAN BERIKUTNYA</small>
                              <strong>
                                {verification === "dikembalikan"
                                  ? "Perbaiki pembaruan progres yang dikembalikan"
                                  : verification === "menunggu"
                                    ? `Menunggu verifikasi progres ${progress}%`
                                    : nextStep || "Lanjutkan pekerjaan sesuai rencana"}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <div className="staff-workspace-progress">
                          <div><span>PROGRES SAYA</span><strong>{progress}%</strong></div>
                          <div className="staff-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres ${task.nama_pekerjaan}`}>
                            <div style={{ width: `${progress}%` }} />
                          </div>
                          <small>{Number(task.progres_terverifikasi) || 0}% terverifikasi</small>
                        </div>
                        <div className="staff-workspace-deadline">
                          <span>DEADLINE</span>
                          <strong>{formatDate(task.deadline)}</strong>
                          <small className={daysLeft !== null && daysLeft < 0 ? "is-late" : ""}>
                            {daysLeft === null
                              ? "Belum ditentukan"
                              : daysLeft < 0
                                ? `${Math.abs(daysLeft)} hari terlambat`
                                : daysLeft === 0
                                  ? "Jatuh tempo hari ini"
                                  : `${daysLeft} hari lagi`}
                          </small>
                        </div>
                        <div className="staff-workspace-verification">
                          <span>VERIFIKASI TERAKHIR</span>
                          <strong className={`staff-verification status-${verification || "none"}`}>
                            {verification === "disetujui"
                              ? "Disetujui"
                              : verification === "dikembalikan"
                                ? "Dikembalikan"
                                : verification === "menunggu"
                                  ? "Menunggu"
                                  : "—"}
                          </strong>
                          <small>
                            {task.progres_disetujui_tanggal
                              ? formatDate(task.progres_disetujui_tanggal)
                              : historyItem?.tanggal_update
                                ? formatDate(historyItem.tanggal_update)
                                : "Belum ada update"}
                          </small>
                        </div>
                        <button
                          className="staff-workspace-history"
                          type="button"
                          aria-label={`Lihat riwayat progres ${task.nama_pekerjaan}`}
                          onClick={() => goToSection("progress-history")}
                        >
                          <MoreHorizontal size={19} />
                        </button>
                        <button
                          className="staff-workspace-update"
                          type="button"
                          onClick={() => openProgressForm(task)}
                          disabled={["selesai", "dibatalkan"].includes(task.status)}
                        >
                          <Activity size={15} />
                          {verification === "dikembalikan" ? "Perbaiki" : "Update"}
                        </button>
                      </article>
                    );
                  })}
                </div>
                <footer className="staff-workspace-footer">
                  <span>
                    Menampilkan {formatCount(taskWorkspaceResults.length)} dari {formatCount(dashboard.tasks.length)} pekerjaan yang ditugaskan kepada {userName.split(/\s+/)[0]}
                  </span>
                  <button type="button" onClick={() => goToSection("progress-history")}>
                    Lihat seluruh riwayat progres <ChevronRight size={15} />
                  </button>
                </footer>
              </section>
            </section>
          ) : activeSection === "update-progress" ? (
            <section className="staff-progress-page">
              <div className="staff-progress-page-title">
                <div>
                  <h1>Update Progres</h1>
                  <p>Laporkan perkembangan pekerjaan untuk diverifikasi Supervisor</p>
                </div>
                <button
                  type="button"
                  className="staff-progress-back"
                  onClick={returnToTasks}
                >
                  <ArrowLeft size={15} /> Kembali
                </button>
              </div>

              {error && (
                <div className="staff-error" role="alert">
                  <div><strong>Permintaan belum berhasil</strong><span>{error}</span></div>
                  <button type="button" onClick={() => setError("")}>Tutup</button>
                </div>
              )}
              {successMessage && (
                <div className="staff-success" role="status">
                  <CheckCircle2 size={17} />
                  <span>{successMessage}</span>
                  <button
                    type="button"
                    aria-label="Tutup pesan"
                    onClick={() => setSuccessMessage("")}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {!progressTask ? (
                <section className="staff-progress-empty">
                  <div className="staff-progress-empty-icon"><BriefcaseBusiness size={22} /></div>
                  <h2>Belum ada pekerjaan yang dipilih</h2>
                  <p>Buka bagian Pekerjaan Saya, lalu pilih Update progres pada pekerjaan yang ingin dilaporkan.</p>
                  <button type="button" className="staff-progress-back" onClick={returnToTasks}>
                    <ArrowLeft size={15} /> Kembali ke Pekerjaan Saya
                  </button>
                </section>
              ) : (
                <div className="staff-progress-layout">
                  <form className="staff-progress-form-panel" onSubmit={submitProgress}>
                    <section className="staff-progress-selected">
                      <div>
                        <span className="staff-progress-eyebrow">PEKERJAAN YANG DIPILIH</span>
                        <h2>{progressTask.nama_pekerjaan}</h2>
                        <p>
                          {progressTask.kode}
                          {progressTask.kode_proyek ? ` · ${progressTask.kode_proyek}` : ""}
                          {progressTask.fungsi ? ` · FUNGSI ${progressTask.fungsi}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="staff-progress-change-task"
                        onClick={returnToTasks}
                      >
                        <BriefcaseBusiness size={16} /> Ganti Pekerjaan
                      </button>
                    </section>

                    <div className="staff-progress-current">
                      <div
                        className="staff-progress-ring"
                        style={{ "--progress-ring-value": `${verifiedProgress * 3.6}deg` }}
                        role="img"
                        aria-label={`Progres terverifikasi ${verifiedProgress}%`}
                      >
                        <strong>{verifiedProgress}%</strong>
                        <span>terverifikasi</span>
                      </div>
                      <div className="staff-progress-current-copy">
                        <span>PROGRES SAAT INI</span>
                        <strong>
                          {progressTask.progres_disetujui_terakhir !== null &&
                          progressTask.progres_disetujui_terakhir !== undefined
                            ? `${progressTask.progres_disetujui_terakhir}% progres disetujui`
                            : "Belum ada progres yang disetujui"}
                        </strong>
                        {progressTask.catatan_progres_disetujui && (
                          <p>{progressTask.catatan_progres_disetujui}</p>
                        )}
                        <small>
                          {progressTask.progres_disetujui_tanggal
                            ? `Diperbarui ${formatDate(progressTask.progres_disetujui_tanggal)}`
                            : "Pembaruan ini akan dikirim untuk verifikasi Supervisor"}
                          {progressTask.progres_disetujui_oleh
                            ? ` · Disetujui oleh ${progressTask.progres_disetujui_oleh}`
                            : ""}
                        </small>
                      </div>
                      <span className={`staff-verification ${
                        progressTask.progres_disetujui_tanggal ? "status-disetujui" : ""
                      }`}>
                        {progressTask.progres_disetujui_tanggal ? "Disetujui" : "Belum diverifikasi"}
                      </span>
                    </div>

                    <section className="staff-progress-form-section">
                      <div className="staff-progress-section-title">
                        <span>01</span>
                        <div>
                          <h3>Nilai Progres Baru</h3>
                          <p>Masukkan perkembangan terbaru, tidak boleh lebih rendah dari progres terverifikasi</p>
                        </div>
                      </div>
                      <div className="staff-progress-value-panel">
                        <div className="staff-progress-slider-copy">
                          <span>{verifiedProgress}% sebelumnya</span>
                          <strong>{progressValue}%</strong>
                          <span>100% selesai</span>
                        </div>
                        <input
                          className="staff-progress-slider"
                          type="range"
                          min={verifiedProgress}
                          max="100"
                          step="1"
                          value={progressValue}
                          onChange={(event) => setProgressValue(Number(event.target.value))}
                          aria-label="Nilai progres baru"
                        />
                        <div className="staff-progress-scale">
                          <span>{verifiedProgress}</span><span>70</span><span>80</span><span>90</span><span>100</span>
                        </div>
                        <label className="staff-progress-number-field">
                          <span>PROGRES BARU</span>
                          <div>
                            <input
                              type="number"
                              min={verifiedProgress}
                              max="100"
                              step="1"
                              value={progressValue}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (event.target.value === "") setProgressValue("");
                                else setProgressValue(Math.min(100, Math.max(verifiedProgress, value)));
                              }}
                              required
                              aria-label="Nilai progres baru dalam persen"
                            />
                            <span>%</span>
                          </div>
                        </label>
                      </div>
                    </section>

                    <section className="staff-progress-form-section">
                      <div className="staff-progress-section-title">
                        <span>02</span>
                        <div>
                          <h3>Detail Pembaruan</h3>
                          <p>Jelaskan hasil yang telah dicapai pada pembaruan ini</p>
                        </div>
                      </div>
                      <div className="staff-progress-fields-grid">
                        <label className="staff-form-field">
                          Tanggal Update <b>*</b>
                          <input
                            type="date"
                            value={progressDate}
                            max={todayInputDate}
                            onChange={(event) => setProgressDate(event.target.value)}
                            required
                          />
                        </label>
                        <label className="staff-form-field">
                          Tahapan Saat Ini <b>*</b>
                          <select
                            value={progressStageId}
                            onChange={(event) => setProgressStageId(event.target.value)}
                            required
                          >
                            <option value="">Pilih tahapan</option>
                            {(dashboard.stages || []).map((stage) => (
                              <option key={stage.id} value={stage.id}>{stage.nama}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="staff-form-field">
                        Catatan Progres <b>*</b>
                        <textarea
                          value={progressNote}
                          onChange={(event) => setProgressNote(event.target.value)}
                          maxLength="4000"
                          rows="4"
                          placeholder="Jelaskan hasil dan perkembangan pekerjaan..."
                          required
                        />
                      </label>
                      <label className="staff-form-field">
                        Kendala <span>(opsional)</span>
                        <textarea
                          value={progressObstacle}
                          onChange={(event) => setProgressObstacle(event.target.value)}
                          maxLength="1000"
                          rows="3"
                          placeholder="Tuliskan kendala yang memengaruhi progres, jika ada..."
                        />
                      </label>
                      <label className="staff-form-field">
                        Rencana Tindak Lanjut <span>(opsional)</span>
                        <textarea
                          value={progressNextStep}
                          onChange={(event) => setProgressNextStep(event.target.value)}
                          maxLength="1000"
                          rows="3"
                          placeholder="Tuliskan rencana tindak lanjut pekerjaan..."
                        />
                      </label>
                    </section>

                    <section className="staff-progress-form-section staff-progress-attachments">
                      <div className="staff-progress-section-title">
                        <span>03</span>
                        <div>
                          <h3>Lampiran / Dokumentasi</h3>
                          <p>Unggah bukti pekerjaan yang mendukung pembaruan progres</p>
                        </div>
                      </div>
                      <label
                        className="staff-upload-area"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const file = event.dataTransfer.files[0];
                          if (file) setProgressAttachment(file);
                        }}
                      >
                        <input
                          type="file"
                          accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                          onChange={(event) => setProgressAttachment(event.target.files[0] || null)}
                        />
                        <span className="staff-upload-icon"><Upload size={20} /></span>
                        <span className="staff-upload-copy">
                          <strong>
                            {progressAttachment
                              ? progressAttachment.name
                              : "Tarik file ke sini atau pilih dari perangkat"}
                          </strong>
                          <small>PDF, DOCX, XLSX, JPG, atau PNG · Maksimal 10 MB</small>
                        </span>
                        <span className="staff-upload-button">Pilih File</span>
                      </label>
                      {progressAttachment && (
                        <button
                          className="staff-remove-attachment"
                          type="button"
                          onClick={() => setProgressAttachment(null)}
                        >
                          <X size={13} /> Hapus lampiran
                        </button>
                      )}
                    </section>

                    {progressError && (
                      <p className="staff-progress-error" role="alert">{progressError}</p>
                    )}
                    <footer className="staff-progress-form-footer">
                      <p><AlertTriangle size={16} /> Pembaruan akan disimpan sebagai baris baru pada <strong>progres_log</strong> dengan status verifikasi menunggu.</p>
                      <div>
                        <button
                          className="staff-progress-draft"
                          type="button"
                          onClick={saveProgressDraft}
                          disabled={progressSaving}
                        >
                          Simpan Draft
                        </button>
                        <button
                          className="staff-progress-submit"
                          type="submit"
                          disabled={progressSaving}
                        >
                          <CheckCircle2 size={16} />
                          {progressSaving ? "Mengirim..." : "Kirim untuk Verifikasi"}
                        </button>
                      </div>
                    </footer>
                  </form>

                  <aside className="staff-progress-aside">
                    <section className="staff-panel staff-progress-summary">
                      <div className="staff-panel-heading">
                        <div><h2>Ringkasan Pekerjaan</h2></div>
                      </div>
                      <div className="staff-summary-row">
                        <span>PIC</span><strong><i>{initials(userName)}</i>{userName}</strong>
                      </div>
                      <div className="staff-summary-row">
                        <span>Prioritas</span><strong><em>{progressTask.prioritas || "-"}</em></strong>
                      </div>
                      <div className="staff-summary-row">
                        <span>Deadline</span>
                        <strong>{formatDate(progressTask.deadline)}</strong>
                      </div>
                      <div className="staff-summary-row">
                        <span>Supervisor</span><strong>{progressTask.supervisor_nama || "-"}</strong>
                      </div>
                    </section>

                    <section className="staff-panel staff-progress-flow">
                      <div className="staff-panel-heading">
                        <div><h2>Alur Setelah Dikirim</h2></div>
                      </div>
                      <ol>
                        <li><i>1</i><div><strong>Menunggu Verifikasi</strong><span>Supervisor meninjau nilai, catatan, dan lampiran.</span></div></li>
                        <li><i>2</i><div><strong>Disetujui / Dikembalikan</strong><span>Jika dikembalikan, Anda akan menerima catatan perbaikan.</span></div></li>
                        <li><i>3</i><div><strong>Progres Terverifikasi</strong><span>Nilai disetujui menjadi progres resmi pekerjaan.</span></div></li>
                      </ol>
                    </section>

                    <div className="staff-progress-reminder">
                      <AlertTriangle size={19} />
                      <p><strong>Pastikan progres dapat dibuktikan.</strong><span>Sertakan catatan spesifik dan dokumentasi agar proses verifikasi lebih cepat.</span></p>
                    </div>
                  </aside>
                </div>
              )}
            </section>
          ) : (
            <>
          <div className="staff-page-title">
            <h1>Dashboard Staff</h1>
            <p>Ringkasan operasional dan aktivitas terbaru SIMON</p>
          </div>

          {error && (
            <div className="staff-error" role="alert">
              <div><strong>Dashboard belum dapat dimuat</strong><span>{error}</span></div>
              <button type="button" onClick={loadDashboard}>Coba lagi</button>
            </div>
          )}
          {successMessage && (
            <div className="staff-success" role="status">
              <CheckCircle2 size={17} />
              <span>{successMessage}</span>
              <button
                type="button"
                aria-label="Tutup pesan"
                onClick={() => setSuccessMessage("")}
              >
                <X size={15} />
              </button>
            </div>
          )}

          <section className="staff-hero">
            <div className="staff-focus-copy">
              <span className="staff-eyebrow">{todayLabel.toLocaleUpperCase("id-ID")}</span>
              <h2>Fokus hari ini, {userName.split(/\s+/)[0]}</h2>
              <p>
                {primaryActionCount
                  ? `${deadlineTodayCount} tenggat hari ini dan ${returnedProgressCount} progres perlu diperbaiki.`
                  : "Tidak ada tindakan mendesak. Lanjutkan pekerjaan sesuai rencana."}
              </p>
            </div>
            <div className="staff-focus-count">
              <strong>{loading ? "—" : formatCount(primaryActionCount)}</strong>
              <span>tindakan utama</span>
            </div>
          </section>

          <section className="staff-home-grid">
            <article className="staff-priority-card">
              {priorityTask ? (
                <>
                  <div className="staff-priority-heading">
                    <span>PRIORITAS HARI INI</span>
                    <span className={`staff-priority-deadline ${
                      String(priorityTask.deadline || "").slice(0, 10) === todayInputDate ||
                      isOverdue(priorityTask) ? "is-due" : ""
                    }`}>
                      {isOverdue(priorityTask)
                        ? "Terlambat"
                        : String(priorityTask.deadline || "").slice(0, 10) === todayInputDate
                          ? "Deadline Hari Ini"
                          : `Tenggat ${formatDate(priorityTask.deadline)}`}
                    </span>
                  </div>
                  <h2>{priorityTask.nama_pekerjaan}</h2>
                  <p className="staff-priority-meta">
                    {priorityTask.kode}{priorityTask.kode_proyek ? ` · ${priorityTask.kode_proyek}` : ""}
                  </p>
                  <div className="staff-priority-progress">
                    <div className="staff-priority-progress-copy">
                      <span>PROGRES TERVERIFIKASI</span>
                      <strong>{Number(priorityTask.progres_terverifikasi) || 0}%</strong>
                    </div>
                    <div
                      className="staff-priority-track"
                      role="progressbar"
                      aria-valuenow={Number(priorityTask.progres_terverifikasi) || 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progres terverifikasi ${priorityTask.nama_pekerjaan}`}
                    >
                      <span style={{
                        width: `${Math.min(100, Number(priorityTask.progres_terverifikasi) || 0)}%`,
                      }} />
                    </div>
                    <small>
                      {priorityNextStep
                        ? `Langkah berikutnya: ${priorityNextStep}`
                        : `Status pekerjaan: ${statusLabel(priorityTask.status)}`}
                    </small>
                  </div>
                  <button
                    className="staff-priority-update"
                    type="button"
                    onClick={() => openProgressForm(priorityTask)}
                  >
                    <Activity size={16} /> Update Progres Sekarang
                  </button>
                </>
              ) : (
                <div className="staff-priority-empty">
                  <span>PRIORITAS HARI INI</span>
                  <h2>Tidak ada pekerjaan aktif</h2>
                  <p>Pekerjaan aktif yang ditugaskan kepada Anda akan muncul di sini.</p>
                </div>
              )}
            </article>

            <div className="staff-home-side">
              <button
                type="button"
                className="staff-action-card is-returned"
                onClick={() => goToSection("progress-history")}
              >
                <span className="staff-action-icon"><AlertTriangle size={19} /></span>
                <span className="staff-action-copy">
                  <small>PERLU DIPERBAIKI</small>
                  <strong>{formatCount(returnedProgressCount)} progres dikembalikan</strong>
                  <span>Lengkapi bukti persetujuan</span>
                </span>
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                className="staff-action-card is-pending"
                onClick={() => goToSection("progress-history")}
              >
                <span className="staff-action-icon"><Clock3 size={19} /></span>
                <span className="staff-action-copy">
                  <small>MENUNGGU SUPERVISOR</small>
                  <strong>{formatCount(pendingProgressCount)} progres diajukan</strong>
                  <span>Menunggu proses verifikasi</span>
                </span>
                <ChevronRight size={18} />
              </button>
              <article className="staff-weekly-card">
                <div className="staff-weekly-heading">
                  <span>CAPAIAN MINGGU INI</span>
                  <strong>{formatCount(weeklyApproved)} dari {formatCount(weeklySubmitted)}</strong>
                </div>
                <div
                  className="staff-weekly-track"
                  role="progressbar"
                  aria-valuenow={weeklyCompletion}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Persentase progres yang disetujui minggu ini"
                >
                  <span style={{ width: `${weeklyCompletion}%` }} />
              </div>
                <small>
                  {weeklySubmitted
                    ? "pembaruan progres disetujui"
                    : "belum ada pembaruan progres minggu ini"}
                </small>
              </article>
            </div>
          </section>

          {error && (
            <div className="staff-error" role="alert">
              <div><strong>Dashboard belum dapat dimuat</strong><span>{error}</span></div>
              <button type="button" onClick={loadDashboard}>Coba lagi</button>
            </div>
          )}
          {successMessage && (
            <div className="staff-success" role="status">
              <CheckCircle2 size={17} />
              <span>{successMessage}</span>
              <button
                type="button"
                aria-label="Tutup pesan"
                onClick={() => setSuccessMessage("")}
              >
                <X size={15} />
              </button>
            </div>
          )}

          <div className={`staff-panels ${activeSection === "dashboard" ? "staff-home-panels" : ""}`}>
            <section
              className={`staff-panel staff-task-panel ${
                activeSection === "dashboard" ? "staff-home-task-panel" : ""
              }`}
              id="tasks"
            >
              <div className="staff-panel-heading">
                <div>
                  <h2>{activeSection === "dashboard" ? "Pekerjaan Aktif Saya" : filter === "updatable" ? "Update Progres" : "Pekerjaan Saya"}</h2>
                  <p>
                    {activeSection === "dashboard"
                      ? "Urutan berdasarkan tindakan terdekat"
                      : filter === "updatable"
                      ? "Pilih pekerjaan untuk mencatat progres terbaru"
                      : "Pekerjaan yang ditugaskan kepada Anda"}
                  </p>
                </div>
                {activeSection === "dashboard" ? (
                  <button
                    className="staff-workspace-link"
                    type="button"
                    onClick={() => goToSection("tasks")}
                  >
                    Buka ruang kerja <ChevronRight size={14} />
                  </button>
                ) : (
                  <span>
                    {filter === "updatable"
                      ? `${formatCount(filteredTasks.length)} pekerjaan`
                      : `${formatCount(summary.total_pekerjaan)} pekerjaan`}
                  </span>
                )}
              </div>
              {activeSection !== "dashboard" && (
                <div className="staff-task-toolbar">
                  <div className="staff-filter-tabs" role="group" aria-label="Filter pekerjaan">
                    {[
                      ["all", "Semua"],
                      ["updatable", "Perlu update"],
                      ["active", "Aktif"],
                      ["overdue", "Terlambat"],
                      ["waiting", "Menunggu evaluasi"],
                      ["done", "Selesai"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={filter === value ? "active" : ""}
                        onClick={() => changeTaskFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="staff-task-list">
                {loading ? (
                  <div className="staff-empty">Memuat pekerjaan...</div>
                ) : (activeSection === "dashboard" ? homeTasks : filteredTasks).length === 0 ? (
                  <div className="staff-empty">
                    {filter === "updatable"
                      ? "Tidak ada pekerjaan yang dapat diperbarui saat ini."
                      : dashboard.tasks.length === 0
                      ? "Belum ada pekerjaan yang ditugaskan kepada Anda."
                      : "Tidak ada pekerjaan yang cocok dengan filter."}
                  </div>
                ) : (activeSection === "dashboard" ? homeTasks : filteredTasks).map((task) => {
                  const progress = Math.min(100, Math.max(
                    0,
                    Number(task.progres_terakhir ?? 0)
                  ));
                  const overdue = isOverdue(task);
                  return (
                    <article
                      className={`staff-task-row ${
                        activeSection === "dashboard" ? "staff-home-task-row" : ""
                      }`}
                      key={task.id}
                    >
                      <div className={`staff-task-mark ${overdue ? "is-late" : ""}`}>
                        {overdue ? <AlertTriangle size={17} /> : <FileText size={17} />}
                      </div>
                      <div className="staff-task-info">
                        <div className="staff-task-meta">
                          <span>{task.kode}</span>
                          {task.kode_proyek && <span>{task.kode_proyek}</span>}
                          {task.prioritas && <span>{task.prioritas}</span>}
                        </div>
                        <h3>{task.nama_pekerjaan}</h3>
                        <p>{task.nama_proyek}{task.divisi ? ` · ${task.divisi}` : ""}</p>
                        <div className="staff-task-deadline">
                          <CalendarDays size={13} />
                          Tenggat {formatDate(task.deadline)}
                          {overdue && <strong>Terlambat</strong>}
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
                        <small className={
                          activeSection === "dashboard"
                            ? `staff-home-task-status status-${task.status_verifikasi_terbaru || "menunggu"}`
                            : ""
                        }>
                          {task.status_verifikasi_terbaru
                            ? verificationLabel(task.status_verifikasi_terbaru)
                            : `Terverifikasi ${Number(task.progres_terverifikasi) || 0}%`}
                        </small>
                        {!["selesai", "dibatalkan"].includes(task.status) && (
                          <button
                            className="staff-progress-action"
                            type="button"
                            onClick={() => openProgressForm(task)}
                          >
                            <PencilLine size={12} /> Update progres
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="staff-panel staff-activity-panel" id="notifications">
              <div className="staff-panel-heading">
                <div><h2>Notifikasi Terbaru</h2><p>Informasi terkait pekerjaan Anda</p></div>
                <Bell size={18} />
              </div>
              <div className="staff-notification-list">
                {loading ? (
                  <div className="staff-empty">Memuat notifikasi...</div>
                ) : dashboard.notifications.length === 0 ? (
                  <div className="staff-empty">Belum ada notifikasi.</div>
                ) : dashboard.notifications.map((item) => (
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
                        <span>{item.kode_pekerjaan ? `${item.kode_pekerjaan} · ` : ""}{item.nama_pekerjaan}</span>
                      )}
                      <small>{formatDate(item.created_at)}</small>
                    </div>
                    {!item.dibaca_at && <i aria-label="Belum dibaca" />}
                  </article>
                ))}
              </div>
              <div className="staff-quick-summary">
                <UserRound size={15} />
                <span>Progress Anda tercatat pada pekerjaan yang menjadi tanggung jawab Anda.</span>
              </div>
            </section>
          </div>

          <section className="staff-panel staff-history-panel" id="progress-history">
            <div className="staff-panel-heading">
              <div><h2>Riwayat Progres</h2><p>20 pembaruan progres terakhir pada pekerjaan Anda</p></div>
              <History size={18} />
            </div>
            <div className="staff-history-list">
              {loading ? (
                <div className="staff-empty">Memuat riwayat progres...</div>
              ) : dashboard.progressHistory.length === 0 ? (
                <div className="staff-empty">Belum ada riwayat progres.</div>
              ) : dashboard.progressHistory.map((item) => (
                <article className="staff-history-row" key={item.id}>
                  <div className="staff-history-score">{Number(item.nilai_progres)}%</div>
                  <div className="staff-history-copy">
                    <h3>{item.kode_pekerjaan} · {item.nama_pekerjaan}</h3>
                    <div className="staff-history-meta">
                      <span>{formatDate(item.tanggal_update)}</span>
                      <span className={`staff-verification status-${item.status_verifikasi}`}>
                        {verificationLabel(item.status_verifikasi)}
                      </span>
                    </div>
                    {item.catatan && <p>{item.catatan}</p>}
                    {item.catatan_verifikasi && (
                      <small className="staff-history-review-note">
                        Catatan verifikasi: {item.catatan_verifikasi}
                      </small>
                    )}
                    {item.lampiran?.length > 0 && (
                      <div className="staff-history-attachments">
                        {item.lampiran.map((attachment) => (
                          <button
                            key={attachment.id}
                            type="button"
                            onClick={() => downloadProgressAttachment(attachment)}
                          >
                            <Paperclip size={12} /> {attachment.nama_file} <Download size={12} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <footer className="staff-footer">
            SIMON · Sistem Informasi Monitoring <span>•</span> Dashboard Staff
          </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
