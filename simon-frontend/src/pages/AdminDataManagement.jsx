import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChartColumn,
  ChevronRight,
  FileText,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import "./AdminDataManagement.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const groups = {
  master: ["divisi", "fungsi", "jenis_pekerjaan", "tahapan", "prioritas", "roles", "kriteria_evaluasi", "rencana_pekerjaan"],
  projects: ["proyek", "rencana_pekerjaan"],
  tasks: ["pekerjaan", "pekerjaan_tahapan"],
  progress: ["progres_log"],
  audit: ["lampiran", "pekerjaan_status_log"],
  evaluations: ["kriteria_evaluasi", "evaluasi_pekerjaan", "evaluasi_nilai", "ringkasan_evaluasi"],
  notifications: ["notifikasi"],
  settings: ["pengaturan"],
};

const masterCards = [
  {
    resource: "roles",
    label: "Roles",
    description: (count) => `${count} role resmi dengan akses berbeda`,
    icon: Users,
  },
  {
    resource: "divisi",
    label: "Divisi",
    description: (count) => `${count} unit kerja pelaksana`,
    icon: Building2,
  },
  {
    resource: "fungsi",
    label: "Fungsi",
    description: () => "14 subjek dokumen perencanaan",
    icon: Layers,
  },
  {
    resource: "jenis_pekerjaan",
    label: "Jenis Pekerjaan",
    description: (count) => `${count} klasifikasi keluaran pekerjaan`,
    icon: Layers,
  },
  {
    resource: "prioritas",
    label: "Prioritas",
    description: (count) => `${count} tingkat urgensi pekerjaan`,
    icon: Layers,
  },
  {
    resource: "tahapan",
    label: "Tahapan",
    description: (count) => `${count} template tahap awal`,
    icon: Layers,
  },
  {
    resource: "kriteria_evaluasi",
    label: "Kriteria Evaluasi",
    description: (count) => `${count} kriteria dengan total bobot 100%`,
    icon: ChartColumn,
  },
  {
    resource: "media_permintaan",
    label: "Media Permintaan",
    description: (count) => `${count} kanal asal permintaan`,
    icon: FileText,
    options: true,
  },
];

function displayValue(value, field, lookups) {
  if (value === null || value === undefined || value === "") return "-";
  if (field?.type === "lookup") {
    const option = (lookups[field.lookup] || []).find(
      (item) => String(item.id) === String(value)
    );
    return option?.label || value;
  }
  if (field?.type === "boolean") return Number(value) === 1 ? "Aktif" : "Nonaktif";
  if (field?.type === "date" && /^\d{4}-\d{2}-\d{2}/.test(String(value))) {
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }
  if (field?.type === "select") {
    return String(value).replaceAll("_", " ");
  }
  if (typeof value === "string" && value.length > 100) {
    return `${value.slice(0, 97)}...`;
  }
  return String(value);
}

function initialForm(fields, row = null) {
  return Object.fromEntries(fields.map((field) => {
    const value = row ? row[field.name] : field.default;
    if (field.type === "boolean") return [field.name, Boolean(Number(value ?? field.default ?? 0))];
    if (field.type === "date" || field.type === "datetime") {
      return [field.name, value ? String(value).replace(" ", "T").slice(0, field.type === "date" ? 10 : 16) : ""];
    }
    return [field.name, value === null || value === undefined ? "" : String(value)];
  }));
}

export default function AdminDataManagement({ category, token }) {
  const [metadata, setMetadata] = useState({ resources: {}, lookups: {} });
  const [rows, setRows] = useState([]);
  const [masterCounts, setMasterCounts] = useState({});
  const [overviewLoading, setOverviewLoading] = useState(category === "master");
  const [overviewError, setOverviewError] = useState("");
  const [overviewRevision, setOverviewRevision] = useState(0);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const resources = useMemo(() => groups[category] || [], [category]);
  const resource = metadata.resources[selected];
  const isMasterOverview = category === "master" && !selected;

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token || ""}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Permintaan gagal.");
    return data;
  }, [token]);

  async function loadRows(resourceName = selected) {
    if (!resourceName) return;
    setLoading(true);
    setError("");
    try {
      const data = await request(`/admin/data/${resourceName}`);
      setRows(data.rows || []);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Backend tidak dapat dihubungi. Pastikan server berjalan."
        : requestError.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      setLoading(true);
      setError("");
      try {
        const data = await request("/admin/modules");
        if (!active) return;
        setMetadata(data);
        setSelected((current) => category === "master"
          ? ""
          : current && resources.includes(current) && data.resources[current]
            ? current
            : resources.find((name) => data.resources[name]) || "");
      } catch (requestError) {
        if (!active) return;
        const message = requestError instanceof TypeError
          ? "Backend tidak dapat dihubungi. Pastikan server berjalan."
          : requestError.message || "Gagal memuat modul Admin.";
        setError(message);
        if (category === "master") {
          setOverviewError(message);
          setOverviewLoading(false);
        }
        setLoading(false);
      }
    }
    loadInitialData();
    return () => {
      active = false;
    };
  }, [category, request, resources]);

  useEffect(() => {
    if (!isMasterOverview || !Object.keys(metadata.resources).length) return undefined;
    let active = true;
    const resourcesToCount = masterCards.filter((card) => !card.options);

    Promise.all(resourcesToCount.map(async (card) => {
      const data = await request(`/admin/data/${card.resource}`);
      return [card.resource, data.rows.length];
    }))
      .then((entries) => {
        if (active) setMasterCounts(Object.fromEntries(entries));
      })
      .catch((requestError) => {
        if (active) {
          setOverviewError(requestError instanceof TypeError
            ? "Backend tidak dapat dihubungi. Pastikan server berjalan."
            : requestError.message || "Gagal memuat ringkasan Master Data.");
        }
      })
      .finally(() => {
        if (active) setOverviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isMasterOverview, metadata.resources, overviewRevision, request]);

  useEffect(() => {
    if (!selected || selected === "laporan") return;
    let active = true;
    request(`/admin/data/${selected}`)
      .then((data) => {
        if (active) setRows(data.rows || []);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof TypeError
            ? "Backend tidak dapat dihubungi. Pastikan server berjalan."
            : requestError.message || "Gagal memuat data.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, selected]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => Object.values(row).some((value) =>
      String(value ?? "").toLowerCase().includes(normalized)
    ));
  }, [rows, query]);

  function chooseResource(name) {
    setLoading(true);
    setSelected(name);
    setQuery("");
    setError("");
    setNotice("");
    setEditing(null);
  }

  function returnToOverview() {
    setSelected("");
    setRows([]);
    setQuery("");
    setError("");
    setNotice("");
    setEditing(null);
    setForm({});
    setOverviewLoading(true);
    setOverviewError("");
    setOverviewRevision((revision) => revision + 1);
  }

  function refreshMasterOverview() {
    setOverviewLoading(true);
    setOverviewError("");
    setOverviewRevision((revision) => revision + 1);
  }

  function manageMasterResource(name) {
    chooseResource(name);
    if (name === "rencana_pekerjaan") {
      setNotice("Media Permintaan dikelola melalui data Rencana Pekerjaan.");
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(initialForm(resource.fields));
    setError("");
    setNotice("");
  }

  function openEdit(row) {
    const keyValue = resource.composite
      ? resource.composite.map((key) => row[key]).join(":")
      : row[resource.key];
    setEditing({ key: keyValue });
    setForm(initialForm(resource.fields, row));
    setError("");
    setNotice("");
  }

  function closeForm() {
    if (!saving) {
      setEditing(null);
      setForm({});
    }
  }

  function updateField(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const path = editing
        ? `/admin/data/${selected}/${encodeURIComponent(editing.key)}`
        : `/admin/data/${selected}`;
      const data = await request(path, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setEditing(null);
      setForm({});
      setNotice(data.message || `${resource.label} berhasil disimpan.`);
      await loadRows(selected);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Backend tidak dapat dihubungi. Pastikan server berjalan."
        : requestError.message || "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    const key = String(row[resource.key]);
    const label = row.nama || row.kode || key;
    if (!window.confirm(`Hapus ${resource.label.toLowerCase()} "${label}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setDeleting(key);
    setError("");
    setNotice("");
    try {
      const data = await request(
        `/admin/data/${selected}/${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      setNotice(data.message || `${resource.label} berhasil dihapus.`);
      await loadRows(selected);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Backend tidak dapat dihubungi. Pastikan server berjalan."
        : requestError.message || `Gagal menghapus ${resource.label}.`);
    } finally {
      setDeleting("");
    }
  }

  const title = category === "master" ? "Master Data"
    : category === "projects" ? "Proyek & Perencanaan"
      : category === "tasks" ? "Manajemen Pekerjaan"
        : category === "progress" ? "Monitoring Progres & Verifikasi"
          : category === "audit" ? "Lampiran & Riwayat"
            : category === "evaluations" ? "Manajemen Evaluasi"
              : category === "notifications" ? "Notifikasi"
                : "Pengaturan Sistem";

  if (isMasterOverview) {
    return (
      <section className="admin-data admin-master-overview">
        <div className="admin-master-heading">
          <div className="admin-master-breadcrumb">
            <span>SIMON</span>
            <ChevronRight size={14} />
            <span>Master Data</span>
          </div>
          <h2>Master Data</h2>
          <p>Konfigurasi referensi inti yang digunakan seluruh modul</p>
        </div>

        {overviewError && (
          <div className="admin-data-message error" role="alert">
            <AlertCircle size={17} />
            <span>{overviewError}</span>
            <button
              className="admin-data-button secondary"
              type="button"
              onClick={refreshMasterOverview}
            >
              <RefreshCw size={14} /> Coba lagi
            </button>
          </div>
        )}

        <div className="admin-master-grid">
          {masterCards.map((card) => {
            const Icon = card.icon;
            const count = card.options
              ? metadata.resources.rencana_pekerjaan?.fields
                .find((field) => field.name === "media_permintaan")?.options.length ?? 0
              : masterCounts[card.resource];
            return (
              <article className="admin-master-card" key={card.resource}>
                <div className="admin-master-icon">
                  <Icon size={22} />
                </div>
                <span className="admin-master-label">{card.label}</span>
                <strong className="admin-master-count">
                  {overviewLoading && !card.options
                    ? "..."
                    : overviewError && !card.options
                      ? "-"
                      : count ?? 0}
                </strong>
                <span className="admin-master-description">
                  {overviewError && !card.options
                    ? "Jumlah data belum dapat dimuat"
                    : card.description(count ?? 0)}
                </span>
                <button
                  className="admin-master-action"
                  type="button"
                  onClick={() => manageMasterResource(card.options ? "rencana_pekerjaan" : card.resource)}
                  disabled={overviewLoading}
                >
                  Kelola data <ChevronRight size={16} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className={`admin-data content-card${category === "master" ? " admin-master-detail" : ""}`}>
      <div className="admin-data-heading">
        <div>
          <h2>{title}</h2>
          <p>Kelola data SIMON sesuai tabel dan relasi pada database.</p>
        </div>
        <div className="admin-data-heading-actions">
          {category === "master" && (
            <button
              className="admin-data-button secondary"
              type="button"
              onClick={returnToOverview}
            >
              <ArrowLeft size={15} /> Kembali ke Master Data
            </button>
          )}
          <button
            className="admin-data-button secondary"
            type="button"
            onClick={() => selected && loadRows(selected)}
            disabled={loading || !selected}
          >
            <RefreshCw size={15} /> Muat ulang
          </button>
        </div>
      </div>

      <div className="admin-resource-tabs" role="tablist" aria-label="Pilih tabel database">
        {resources.filter((name) => name !== "rencana_pekerjaan" || selected === name).map((name) => {
          const item = metadata.resources[name];
          if (!item) return null;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={selected === name}
              className={selected === name ? "active" : ""}
              onClick={() => chooseResource(name)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error && <div className="admin-data-message error" role="alert"><AlertCircle size={17} />{error}</div>}
      {notice && <div className="admin-data-message success" role="status">{notice}</div>}

      {resource && (
        <>
          <div className="admin-data-toolbar">
            <label className="admin-data-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Cari ${resource.label.toLowerCase()}...`}
              />
            </label>
            {!resource.readOnly && !resource.editOnly && (
              <button className="admin-data-button primary" type="button" onClick={openCreate}>
                <Plus size={16} /> Tambah {resource.label}
              </button>
            )}
            <span>{filteredRows.length} data</span>
          </div>

          {resource.readOnly && (
            <p className="admin-data-readonly">
              Data ini merupakan referensi atau riwayat transaksi dan ditampilkan hanya-baca agar jejak serta relasi database tetap terjaga.
            </p>
          )}

          <div className="admin-data-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  {resource.columns.map((column) => (
                    <th key={column}>
                      {resource.fields.find((field) => field.name === column)?.label ||
                        column.replaceAll("_", " ")}
                    </th>
                  ))}
                  {!resource.readOnly && (!resource.createOnly || resource.deletable) && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={resource.columns.length + (!resource.readOnly && (!resource.createOnly || resource.deletable) ? 1 : 0)} className="admin-data-empty">Memuat data...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={resource.columns.length + (!resource.readOnly && (!resource.createOnly || resource.deletable) ? 1 : 0)} className="admin-data-empty">Belum ada data yang sesuai.</td></tr>
                ) : filteredRows.map((row, index) => {
                  const isProtected = resource.protectedCodes?.some(
                    (code) => code.toLowerCase() === String(row.kode || "").toLowerCase()
                  ) ?? false;

                  return (
                    <tr key={resource.composite
                      ? resource.composite.map((key) => row[key]).join(":")
                      : row[resource.key] ?? index}
                    >
                      {resource.columns.map((column) => {
                        const field = resource.fields.find((item) => item.name === column);
                        return (
                          <td key={column} title={row[column] == null ? "" : String(row[column])}>
                            {displayValue(row[column], field, metadata.lookups)}
                          </td>
                        );
                      })}
                      {!resource.readOnly && (!resource.createOnly || resource.deletable) && (
                        <td>
                          <div className="admin-data-row-actions">
                            {!resource.createOnly && (
                              <button
                                className="admin-data-edit"
                                type="button"
                                onClick={() => openEdit(row)}
                                aria-label={`Ubah ${resource.label}`}
                              >
                                <Pencil size={14} /> Ubah
                              </button>
                            )}
                            {resource.deletable && !isProtected && (
                              <button
                                className="admin-data-delete"
                                type="button"
                                onClick={() => deleteRow(row)}
                                disabled={deleting === String(row[resource.key])}
                                aria-label={`Hapus ${resource.label}`}
                              >
                                <Trash2 size={14} />
                                {deleting === String(row[resource.key]) ? "Menghapus..." : "Hapus"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing !== null || (editing === null && Object.keys(form).length > 0) ? (
        <div className="admin-data-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <section className="admin-data-modal" role="dialog" aria-modal="true" aria-labelledby="admin-data-modal-title">
            <div className="admin-data-modal-heading">
              <div>
                <h2 id="admin-data-modal-title">{editing ? `Ubah ${resource.label}` : `Tambah ${resource.label}`}</h2>
                <p>Perubahan disimpan pada tabel <code>{resource.table || selected}</code>.</p>
              </div>
              <button className="admin-data-close" type="button" onClick={closeForm} aria-label="Tutup" disabled={saving}>
                <X size={19} />
              </button>
            </div>
            <form className="admin-data-form" onSubmit={save}>
              {resource.fields.map((field) => (
                <label className={field.type === "textarea" ? "wide" : ""} key={field.name}>
                  <span>{field.label}{field.required && <b> *</b>}</span>
                  {field.type === "textarea" ? (
                    <textarea
                      name={field.name}
                      value={form[field.name] || ""}
                      onChange={updateField}
                      required={field.required}
                      disabled={Boolean(editing && field.immutable)}
                    />
                  ) : field.type === "boolean" ? (
                    <span className="admin-data-checkbox">
                      <input
                        type="checkbox"
                        name={field.name}
                        checked={Boolean(form[field.name])}
                        onChange={updateField}
                        disabled={Boolean(editing && field.immutable)}
                      />
                      Aktif
                    </span>
                  ) : field.type === "select" || field.type === "lookup" ? (
                    <select
                      name={field.name}
                      value={form[field.name] || ""}
                      onChange={updateField}
                      required={field.required}
                      disabled={Boolean(editing && field.immutable)}
                    >
                      <option value="">Pilih {field.label.toLowerCase()}</option>
                      {field.type === "select"
                        ? field.options.map((option) => <option value={option} key={option}>{option.replaceAll("_", " ")}</option>)
                        : (metadata.lookups[field.lookup] || []).map((option) => (
                          <option value={option.id} key={option.id}>{option.label}</option>
                        ))}
                    </select>
                  ) : (
                    <input
                      name={field.name}
                      type={field.type === "datetime" ? "datetime-local" : field.type}
                      value={form[field.name] || ""}
                      onChange={updateField}
                      required={field.required}
                      maxLength={field.maxLength}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      disabled={Boolean(editing && field.immutable)}
                    />
                  )}
                </label>
              ))}
              {error && <div className="admin-data-message error wide" role="alert">{error}</div>}
              <div className="admin-data-form-actions wide">
                <button className="admin-data-button secondary" type="button" onClick={closeForm} disabled={saving}>Batal</button>
                <button className="admin-data-button primary" type="submit" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan perubahan"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
