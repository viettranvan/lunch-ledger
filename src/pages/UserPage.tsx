import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function UserPage() {
  const users = useQuery(api.users.getAll);

  const createUser = useMutation(api.users.create);

  // User form state
  const [newUserName, setNewUserName] = useState("");

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName) return;

    await createUser({
      name: newUserName,
    });

    setNewUserName("");
  };

  if (users === undefined) {
    return <div className="loader">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="dashboard-grid full-width">
      <div className="panel full-width">
        <h2>Thành viên</h2>
        <form className="inline-form" onSubmit={handleCreateUser}>
          <input
            type="text"
            className="input-field"
            placeholder="Tên thành viên mới"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            required
          />
          <button type="submit" className="submit-btn small-btn">
            Thêm
          </button>
        </form>

        {users.length === 0 ? (
          <div className="empty-state">Chưa có thành viên nào</div>
        ) : (
          <div className="user-chips">
            {users.map((user) => (
              <div key={user._id} className="user-chip">
                👤 {user.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
