import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function UserRow({ user }: { user: Doc<"users"> }) {
  const updateTeamsEmail = useMutation(
    api.features.users.mutations.updateTeamsEmail,
  );
  const toggleActive = useMutation(api.features.users.mutations.toggleActive);
  const [editingEmail, setEditingEmail] = useState(false);
  const [email, setEmail] = useState(user.teams_email ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEmail = async () => {
    setIsSaving(true);
    try {
      await updateTeamsEmail({
        id: user._id as Id<"users">,
        teams_email: email.trim() || undefined,
      });
      setEditingEmail(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setIsSaving(true);
    try {
      await toggleActive({
        id: user._id as Id<"users">,
        is_active: !user.is_active,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <tr className={user.is_active ? "" : "user-table-row-inactive"}>
      <td>
        <strong>{user.name}</strong>
      </td>
      <td>
        {editingEmail ? (
          <form
            className="user-email-editor"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveEmail();
            }}
          >
            <input
              type="email"
              className="input-field user-email-input"
              placeholder="email@vinova.sg"
              value={email}
              required={Boolean(email.trim())}
              onChange={(event) => setEmail(event.target.value)}
              aria-label={`Email Teams của ${user.name}`}
              autoFocus
            />
            <button
              type="submit"
              className="submit-btn small-btn"
              disabled={isSaving}
            >
              Lưu
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                setEmail(user.teams_email ?? "");
                setEditingEmail(false);
              }}
              disabled={isSaving}
            >
              Hủy
            </button>
          </form>
        ) : (
          <div className="user-email-cell">
            <span>{user.teams_email || "Chưa có email"}</span>
            <button
              type="button"
              className="user-icon-action"
              onClick={() => setEditingEmail(true)}
              aria-label={`Sửa email Teams của ${user.name}`}
              title={`Sửa email Teams của ${user.name}`}
            >
              <EditIcon />
            </button>
          </div>
        )}
      </td>
      <td>
        <span
          className={`user-status-badge ${user.is_active ? "active" : "inactive"}`}
        >
          {user.is_active ? "Đang hoạt động" : "Ngưng hoạt động"}
        </span>
      </td>
      <td className="user-table-action-cell">
        <label className="user-status-switch">
          <input
            type="checkbox"
            checked={user.is_active}
            onChange={() => void handleToggleActive()}
            disabled={isSaving}
            aria-label={`${user.is_active ? "Ngưng hoạt động" : "Kích hoạt lại"} ${user.name}`}
          />
          <span className="user-status-switch-track" aria-hidden="true">
            <span className="user-status-switch-thumb" />
          </span>
          <span className="user-status-switch-label">
            {isSaving ? "Đang lưu..." : user.is_active ? "Bật" : "Tắt"}
          </span>
        </label>
      </td>
    </tr>
  );
}

export default function UsersPage() {
  const users = useQuery(api.features.users.queries.getAll);
  const createUser = useMutation(api.features.users.mutations.create);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    try {
      await createUser({
        name: trimmedName,
        teams_email: email.trim() || undefined,
      });
      setName("");
      setEmail("");
    } finally {
      setIsCreating(false);
    }
  };

  if (users === undefined) {
    return <div className="loader">Đang tải dữ liệu...</div>;
  }

  const activeCount = users.filter((user) => user.is_active).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div className="dashboard-grid">
      <section className="panel users-page-panel">
        <div className="users-page-heading">
          <div>
            <h2>Quản lý thành viên</h2>
            <p className="text-muted">
              {activeCount} đang hoạt động <span aria-hidden="true">·</span>{" "}
              {inactiveCount} đã ngưng
            </p>
          </div>
        </div>

        <form className="inline-form user-create-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="input-field"
            placeholder="Tên thành viên"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Tên thành viên mới"
            required
          />
          <input
            type="email"
            className="input-field"
            placeholder="Email Teams (không bắt buộc)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="Email Teams thành viên mới"
          />
          <button
            type="submit"
            className="submit-btn small-btn"
            disabled={isCreating}
          >
            {isCreating ? "Đang thêm..." : "Thêm thành viên"}
          </button>
        </form>

        {users.length === 0 ? (
          <div className="empty-state">Chưa có thành viên nào</div>
        ) : (
          <div className="users-table-scroll">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Thành viên</th>
                  <th scope="col">Email Teams</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Kích hoạt</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow key={user._id} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
