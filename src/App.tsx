import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import "./App.css";

function App() {
  const users = useQuery(api.users.getAll) || [];
  const createUser = useMutation(api.users.create);
  const updateUser = useMutation(api.users.update);
  const removeUser = useMutation(api.users.remove);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editingId, setEditingId] = useState<Id<"users"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    await createUser({ name: newName, email: newEmail });
    setNewName("");
    setNewEmail("");
  };

  const startEdit = (user: {
    _id: Id<"users">;
    name: string;
    email: string;
  }) => {
    setEditingId(user._id);
    setEditName(user.name);
    setEditEmail(user.email);
  };

  const handleUpdate = async (id: Id<"users">) => {
    await updateUser({ id, name: editName, email: editEmail });
    setEditingId(null);
  };

  const handleDelete = async (id: Id<"users">) => {
    await removeUser({ id });
  };

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "left",
      }}
    >
      <h1>Quản lý người dùng</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Test Convex CRUD hoạt động
      </p>

      <form
        onSubmit={handleCreate}
        style={{ marginBottom: "2rem", display: "flex", gap: "1rem" }}
      >
        <input
          type="text"
          placeholder="Tên"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
          style={{
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            flex: 1,
          }}
        />
        <input
          type="email"
          placeholder="Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          style={{
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            flex: 1,
          }}
        />
        <button
          type="submit"
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Thêm
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {users.map((user) => (
          <li
            key={user._id}
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1rem",
              alignItems: "center",
              border: "1px solid #eee",
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            {editingId === user._id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ padding: "0.5rem", flex: 1 }}
                />
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{ padding: "0.5rem", flex: 1 }}
                />
                <button onClick={() => handleUpdate(user._id)}>Lưu</button>
                <button onClick={() => setEditingId(null)}>Hủy</button>
              </>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", fontSize: "1.1rem" }}>
                    {user.name}
                  </strong>
                  <span style={{ color: "#666" }}>{user.email}</span>
                </div>
                <button onClick={() => startEdit(user)}>Sửa</button>
                <button
                  onClick={() => handleDelete(user._id)}
                  style={{
                    backgroundColor: "#ff4d4f",
                    color: "white",
                    border: "none",
                  }}
                >
                  Xóa
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {users.length === 0 && (
        <p style={{ textAlign: "center", color: "#888" }}>
          Chưa có người dùng nào. Hãy thêm mới!
        </p>
      )}
    </div>
  );
}

export default App;
