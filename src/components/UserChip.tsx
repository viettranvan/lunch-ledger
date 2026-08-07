import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export default function UserChip({ user }: { user: Doc<"users"> }) {
  const updateTeamsEmail = useMutation(api.users.updateTeamsEmail);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user.teams_email ?? "");

  const handleSave = async () => {
    await updateTeamsEmail({
      id: user._id as Id<"users">,
      teams_email: email.trim() || undefined,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        className="user-chip"
        style={{ display: "flex", flexDirection: "column", gap: "6px" }}
      >
        <strong style={{ fontSize: "0.9rem" }}>👤 {user.name}</strong>
        <input
          type="email"
          className="input-field"
          placeholder="email@vinova.sg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ fontSize: "0.8rem", padding: "4px 8px" }}
          autoFocus
        />
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className="submit-btn small-btn"
            onClick={handleSave}
            style={{ fontSize: "0.75rem", padding: "4px 10px" }}
          >
            Lưu
          </button>
          <button
            type="button"
            className="cancel-btn"
            onClick={() => {
              setEmail(user.teams_email ?? "");
              setEditing(false);
            }}
            style={{ fontSize: "0.75rem", padding: "4px 10px" }}
          >
            Hủy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="user-chip"
      onClick={() => setEditing(true)}
      title={
        user.teams_email
          ? `Teams: ${user.teams_email} (click để sửa)`
          : "Click để thêm Teams email"
      }
      style={{ cursor: "pointer" }}
    >
      👤 {user.name}
      {user.teams_email ? (
        <span style={{ opacity: 0.6, fontSize: "0.75rem", marginLeft: "6px" }}>
          ✉️
        </span>
      ) : (
        <span style={{ opacity: 0.4, fontSize: "0.75rem", marginLeft: "6px" }}>
          +email
        </span>
      )}
    </div>
  );
}
