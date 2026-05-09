import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";

const ROLE_LABELS = { patient: "Patient", admin: "Administrator" };
const ROLE_COLORS = {
  patient: { bg: "#ede9fe", color: "#7c3aed", border: "#ddd6fe" },
  admin:   { bg: "#ffe4e6", color: "#be123c", border: "#fecdd3" },
};

const EMPTY_FORM = { name: "", email: "", password: "", role: "patient", patient_id: "" };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null); // null = create mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/admin/users");
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      patient_id: u.patient_id || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) return setFormError("Name is required");
    if (!form.email.trim()) return setFormError("Email is required");
    if (!editUser && !form.password) return setFormError("Password is required for new users");
    if (!editUser && form.password.length < 6) return setFormError("Password must be at least 6 characters");

    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/admin/users/${editUser.id || editUser._id}`, {
          name: form.name.trim(),
          role: form.role,
          patient_id: form.role === "patient" ? form.patient_id.trim() || null : null,
          password: form.password || undefined,
        });
      } else {
        await api.post("/admin/users", {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          patient_id: form.role === "patient" ? form.patient_id.trim() || null : null,
        });
      }
      closeModal();
      await loadUsers();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/users/${deleteTarget.id || deleteTarget._id}`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const displayName = (u.displayName || u.name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const matchSearch = !q || displayName.includes(q) || email.includes(q);
    const matchRole = roleFilter === "All" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <header style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Users</h1>
            <p style={styles.subtitle}>Manage user accounts and roles</p>
          </div>
          <button style={styles.createBtn} onClick={openCreate}>
            + Add User
          </button>
        </header>

        {/* Filters */}
        <div style={styles.filterBar}>
          <input
            style={styles.searchInput}
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={styles.select}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="admin">Administrator</option>
            <option value="patient">Patient</option>
          </select>
        </div>

        {/* Table */}
        <div style={styles.tableWrap}>
          {loading ? (
            <div style={styles.loadingCell}>Loading users...</div>
          ) : (
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Role</th>
                    <th style={styles.th}>Patient ID</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const rc = ROLE_COLORS[u.role] || {};
                    return (
                      <tr key={u.id || u._id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={styles.nameCell}>
                            <div style={styles.avatar}>{(u.displayName || u.name || "U").charAt(0).toUpperCase()}</div>
                            <span style={styles.nameText}>{u.displayName || u.name}</span>
                          </div>
                        </td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.rolePill,
                            background: rc.bg,
                            color: rc.color,
                            border: `1px solid ${rc.border}`,
                          }}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        <td style={styles.td}>{u.patient_id || <span style={styles.na}>—</span>}</td>
                        <td style={styles.td}>
                          {u.createdAt
                            ? new Date(u.createdAt).toLocaleDateString("en-PH", {
                                month: "short", day: "numeric", year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actionBtns}>
                            <button style={styles.editBtn} onClick={() => openEdit(u)}>Edit</button>
                            <button style={styles.deleteBtn} onClick={() => setDeleteTarget(u)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={styles.emptyCell}>No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <h2 style={styles.modalTitle}>{editUser ? "Edit User" : "Add New User"}</h2>
              <form onSubmit={handleSave} style={styles.form} noValidate>
                <Field label="Full Name">
                  <input
                    style={styles.input}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Full name"
                    required
                  />
                </Field>
                {!editUser && (
                  <Field label="Email Address">
                    <input
                      style={styles.input}
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="user@example.com"
                      required
                    />
                  </Field>
                )}
                <Field label={editUser ? "New Password (leave blank to keep)" : "Password"}>
                  <input
                    style={styles.input}
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editUser ? "Leave blank to keep current" : "Min. 6 characters"}
                  />
                </Field>
                <Field label="Role">
                  <select
                    style={styles.input}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value, patient_id: "" })}
                  >
                    <option value="patient">Patient</option>
                    <option value="admin">Administrator</option>
                  </select>
                </Field>
                {form.role === "patient" && (
                  <Field label="Patient ID (PMS)">
                    <input
                      style={styles.input}
                      value={form.patient_id}
                      onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
                      placeholder="e.g. PH001"
                    />
                  </Field>
                )}
                {formError && <div style={styles.formError}>{formError}</div>}
                <div style={styles.modalActions}>
                  <button type="button" style={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button type="submit" style={styles.saveBtn} disabled={saving}>
                    {saving ? "Saving..." : editUser ? "Save Changes" : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {deleteTarget && (
          <div style={styles.overlay}>
            <div style={{ ...styles.modal, maxWidth: "380px" }}>
              <h2 style={styles.modalTitle}>Delete User</h2>
              <p style={styles.confirmText}>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
                This action cannot be undone.
              </p>
              <div style={styles.modalActions}>
                <button style={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button style={styles.dangerBtn} onClick={handleDelete}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={fieldStyles.label}>{label}</label>
      {children}
    </div>
  );
}

const fieldStyles = {
  label: { fontSize: "11.5px", fontWeight: "600", color: "#374151", letterSpacing: "0.3px" },
};

const styles = {
  layout: { display: "flex", height: "100vh", overflow: "hidden" },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "20px 24px",
    overflow: "hidden",
    background: "#f8fafc",
    minWidth: 0,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  title: { fontFamily: "Lora, serif", fontSize: "22px", color: "#1e293b", fontWeight: "600" },
  subtitle: { fontSize: "12px", color: "#64748b", marginTop: "3px" },
  createBtn: {
    padding: "9px 18px",
    background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },

  filterBar: {
    display: "flex",
    gap: "10px",
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    outline: "none",
  },
  select: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "8px 10px",
    fontSize: "12px",
    background: "white",
    minWidth: "160px",
  },

  tableWrap: {
    flex: 1,
    minHeight: 0,
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    overflow: "hidden",
  },
  tableScroll: { overflow: "auto", height: "100%" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "760px" },
  th: {
    textAlign: "left",
    fontSize: "11px",
    color: "#475569",
    padding: "10px 14px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    position: "sticky",
    top: 0,
    zIndex: 1,
    fontWeight: "600",
  },
  tr: { transition: "background 0.13s" },
  td: { fontSize: "12px", color: "#1e293b", padding: "11px 14px", borderBottom: "1px solid #f1f5f9" },
  loadingCell: { padding: "20px", color: "#94a3b8", fontSize: "13px", textAlign: "center" },
  emptyCell: { padding: "24px", color: "#94a3b8", fontSize: "13px", textAlign: "center" },

  nameCell: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: {
    width: "30px", height: "30px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
    color: "white",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "12px", fontWeight: "700", flexShrink: 0,
  },
  nameText: { fontWeight: "600", color: "#0f172a" },
  rolePill: {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "700",
  },
  na: { color: "#94a3b8" },

  actionBtns: { display: "flex", gap: "6px" },
  editBtn: {
    padding: "5px 10px",
    background: "#e0f2fe",
    color: "#0284c7",
    border: "1px solid #bae6fd",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  deleteBtn: {
    padding: "5px 10px",
    background: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "24px",
  },
  modal: {
    background: "white",
    borderRadius: "20px",
    padding: "32px",
    width: "100%",
    maxWidth: "460px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  },
  modalTitle: {
    fontFamily: "Lora, serif",
    fontSize: "20px",
    color: "#1e293b",
    fontWeight: "600",
    marginBottom: "20px",
  },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  input: {
    border: "1.5px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    outline: "none",
    background: "#fafafa",
    width: "100%",
    boxSizing: "border-box",
  },
  formError: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    padding: "9px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "500",
  },
  modalActions: {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
    marginTop: "6px",
  },
  cancelBtn: {
    padding: "9px 18px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#475569",
    cursor: "pointer",
  },
  saveBtn: {
    padding: "9px 20px",
    background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "9px 20px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  confirmText: {
    fontSize: "14px",
    color: "#334155",
    lineHeight: "1.6",
    marginBottom: "20px",
  },
};
