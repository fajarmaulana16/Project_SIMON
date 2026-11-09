import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import "./UserManagement.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const emptyForm = {
  nama: "",
  username: "",
  email: "",
  roleId: "",
  divisiId: "",
  supervisorId: "",
  password: "",
  aktif: true,
};

function toForm(user) {
  return {
    nama: user.nama || "",
    username: user.username || "",
    email: user.email || "",
    roleId: String(user.role_id),
    divisiId: user.divisi_id ? String(user.divisi_id) : "",
    supervisorId:
      user.role_kode === "supervisor" || !user.supervisor_id
        ? ""
        : String(user.supervisor_id),
    password: "",
    aktif: Number(user.aktif) === 1,
  };
}

async function requestUsers(token) {
  const response = await fetch(`${API_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Gagal mengambil data pengguna.");
  }

  return data;
}

export default function UserManagement({ token, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await requestUsers(token);
      setUsers(data.users || []);
      setRoles(data.roles || []);
      setDivisions(data.divisions || []);
      setSupervisors(data.supervisors || []);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Server tidak dapat dihubungi. Periksa koneksi backend."
          : requestError.message || "Gagal mengambil data pengguna."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialUsers() {
      try {
        const data = await requestUsers(token);
        if (!active) return;
        setUsers(data.users || []);
        setRoles(data.roles || []);
        setDivisions(data.divisions || []);
        setSupervisors(data.supervisors || []);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError instanceof TypeError
            ? "Server tidak dapat dihubungi. Periksa koneksi backend."
            : requestError.message || "Gagal mengambil data pengguna."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInitialUsers();
    return () => {
      active = false;
    };
  }, [token]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = [
        user.nama,
        user.username,
        user.email,
        user.role_nama,
        user.divisi_nama,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && Number(user.aktif) === 1) ||
        (statusFilter === "inactive" && Number(user.aktif) !== 1);
      return matchesQuery && matchesStatus;
    });
  }, [users, query, statusFilter]);

  const selectedRole = roles.find(
    (role) => String(role.id) === form.roleId
  );

  function openCreateForm() {
    const defaultRole = roles.find((role) => role.kode === "staff");
    setEditingUser(null);
    setForm({
      ...emptyForm,
      roleId: defaultRole ? String(defaultRole.id) : "",
    });
    setError("");
    setNotice("");
  }

  function openEditForm(user) {
    setEditingUser(user);
    setForm(toForm(user));
    setError("");
    setNotice("");
  }

  function closeForm() {
    if (!saving) {
      setEditingUser(null);
      setForm(emptyForm);
    }
  }

  function updateField(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "roleId" && roles.find((role) => String(role.id) === value)?.kode === "supervisor"
        ? { supervisorId: "" }
        : {}),
    }));
  }

  async function saveUser(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);

    const payload = {
      nama: form.nama.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      roleId: Number(form.roleId),
      divisiId: form.divisiId || null,
      supervisorId: form.supervisorId || null,
      aktif: form.aktif,
    };
    if (!editingUser || form.password) {
      payload.password = form.password;
    }

    try {
      const response = await fetch(
        editingUser
          ? `${API_URL}/admin/users/${editingUser.id}`
          : `${API_URL}/admin/users`,
        {
          method: editingUser ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Gagal menyimpan pengguna.");
      }

      setEditingUser(null);
      setForm(emptyForm);
      setNotice(data.message || "Data pengguna berhasil disimpan.");
      await loadUsers();
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Server tidak dapat dihubungi. Periksa koneksi backend."
          : requestError.message || "Gagal menyimpan pengguna."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserStatus(user) {
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...toForm(user),
          roleId: Number(user.role_id),
          divisiId: user.divisi_id,
          supervisorId: user.supervisor_id,
          password: undefined,
          aktif: Number(user.aktif) !== 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Status pengguna gagal diperbarui.");
      }
      setNotice(data.message || "Status pengguna berhasil diperbarui.");
      await loadUsers();
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Server tidak dapat dihubungi. Periksa koneksi backend."
          : requestError.message || "Status pengguna gagal diperbarui."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(
      `Hapus akun pengguna "${user.nama}" (@${user.username})? Tindakan ini tidak dapat dibatalkan.`
    )) {
      return;
    }

    setError("");
    setNotice("");
    setDeletingUserId(user.id);
    try {
      const response = await fetch(`${API_URL}/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Gagal menghapus pengguna.");
      }

      setNotice(data.message || "Pengguna berhasil dihapus.");
      await loadUsers();
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Server tidak dapat dihubungi. Periksa koneksi backend."
          : requestError.message || "Gagal menghapus pengguna."
      );
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <section className="users-management content-card">
      <div className="users-heading">
        <div>
          <h2>Manajemen Pengguna</h2>
          <p>Kelola akun, role, divisi, supervisor, dan status akses pengguna.</p>
        </div>
        <div className="users-heading-actions">
          <button
            className="users-button users-button-secondary"
            type="button"
            onClick={loadUsers}
            disabled={loading || saving}
          >
            <RefreshCw size={16} />
            Muat ulang
          </button>
          <button
            className="users-button users-button-primary"
            type="button"
            onClick={openCreateForm}
            disabled={saving || deletingUserId !== null}
          >
            <Plus size={17} />
            Tambah pengguna
          </button>
        </div>
      </div>

      {error && <div className="users-message users-message-error" role="alert">{error}</div>}
      {notice && <div className="users-message users-message-success" role="status">{notice}</div>}

      <div className="users-toolbar">
        <label className="users-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, username, email, role..."
            aria-label="Cari pengguna"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter berdasarkan status"
        >
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <span className="users-count">{filteredUsers.length} pengguna</span>
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Role</th>
              <th>Divisi</th>
              <th>Supervisor</th>
              <th>Status</th>
              <th>Login terakhir</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="users-empty" colSpan="7">Memuat data pengguna...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td className="users-empty" colSpan="7">Tidak ada pengguna yang cocok.</td></tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.nama}</strong>
                    <span className="users-subtext">{user.username}</span>
                    {user.email && <span className="users-subtext">{user.email}</span>}
                  </td>
                  <td>{user.role_nama}</td>
                  <td>{user.divisi_nama || "-"}</td>
                  <td>{user.supervisor_nama || "-"}</td>
                  <td>
                    <span className={`users-status ${Number(user.aktif) === 1 ? "is-active" : "is-inactive"}`}>
                      {Number(user.aktif) === 1 ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString("id-ID")
                      : "Belum pernah"}
                  </td>
                  <td>
                    <div className="users-row-actions">
                      <button
                        className="users-action-edit"
                        type="button"
                        onClick={() => openEditForm(user)}
                        disabled={saving}
                      >
                        <Pencil size={14} />
                        Ubah
                      </button>
                      <button
                        className={`users-action-toggle ${Number(user.aktif) === 1 ? "deactivate" : "activate"}`}
                        type="button"
                        onClick={() => toggleUserStatus(user)}
                        disabled={saving || deletingUserId !== null}
                      >
                        {Number(user.aktif) === 1 ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        className="users-action-delete"
                        type="button"
                        onClick={() => deleteUser(user)}
                        disabled={saving || deletingUserId !== null || String(user.id) === String(currentUserId)}
                        title={String(user.id) === String(currentUserId) ? "Akun yang sedang digunakan tidak dapat dihapus" : "Hapus pengguna"}
                        aria-label={`Hapus pengguna ${user.nama}`}
                      >
                        <Trash2 size={14} />
                        {deletingUserId === user.id ? "Menghapus..." : "Hapus"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingUser !== null || (!editingUser && form.roleId) ? (
        <div className="users-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <section
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
          >
            <div className="users-modal-heading">
              <div>
                <h2 id="users-modal-title">
                  {editingUser ? "Ubah pengguna" : "Tambah pengguna"}
                </h2>
                <p>Data disimpan pada tabel users sesuai relasi database SIMON.</p>
              </div>
              <button
                className="users-close-button"
                type="button"
                onClick={closeForm}
                aria-label="Tutup formulir"
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form className="users-form" onSubmit={saveUser}>
              <label>
                Nama lengkap
                <input
                  name="nama"
                  value={form.nama}
                  onChange={updateField}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Username
                <input
                  name="username"
                  value={form.username}
                  onChange={updateField}
                  minLength={3}
                  maxLength={50}
                  required
                />
              </label>
              <label>
                Email <span>(opsional)</span>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  maxLength={150}
                />
              </label>
              <label>
                Role
                <select
                  name="roleId"
                  value={form.roleId}
                  onChange={updateField}
                  required
                >
                  <option value="" disabled>Pilih role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.nama}</option>
                  ))}
                </select>
              </label>
              <label>
                Divisi
                <select name="divisiId" value={form.divisiId} onChange={updateField}>
                  <option value="">Tidak ditentukan</option>
                  {divisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.nama} ({division.kode})
                    </option>
                  ))}
                </select>
              </label>
              {selectedRole?.kode !== "supervisor" && (
                <label>
                  Supervisor
                  <select
                    name="supervisorId"
                    value={form.supervisorId}
                    onChange={updateField}
                  >
                    <option value="">Tidak ditentukan</option>
                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.nama} (@{supervisor.username})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Password {editingUser ? <span>(kosongkan jika tidak diubah)</span> : null}
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={updateField}
                  minLength={8}
                  autoComplete="new-password"
                  required={!editingUser}
                />
              </label>
              <label className="users-checkbox">
                <input
                  name="aktif"
                  type="checkbox"
                  checked={form.aktif}
                  onChange={updateField}
                />
                Akun aktif dan dapat login
              </label>

              <div className="users-form-actions">
                <button
                  className="users-button users-button-secondary"
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  className="users-button users-button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan pengguna"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
