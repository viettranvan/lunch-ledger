import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  getDefaultTeamsChannelConfig,
  readTeamsChannelConfig,
  type TeamsChannelConfig,
} from "../lib/teamsChannelConfig";

export default function TeamsSettingsPage() {
  const storedConfig = useQuery(api.features.teams.queries.get);
  const saveConfig = useMutation(api.features.teams.mutations.save);
  const [config, setConfig] = useState<TeamsChannelConfig>(readTeamsChannelConfig);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (storedConfig === undefined || storedConfig === null) return;

    setConfig({
      teamId: storedConfig.team_id,
      channelId: storedConfig.channel_id,
      channelName: storedConfig.channel_name ?? "",
      tenantId: storedConfig.tenant_id,
      qrImageUrl: storedConfig.qr_image_url ?? "",
    });
  }, [storedConfig]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextConfig = {
      teamId: config.teamId.trim(),
      channelId: config.channelId.trim(),
      channelName: config.channelName.trim(),
      tenantId: config.tenantId.trim(),
      qrImageUrl: config.qrImageUrl.trim(),
    };

    setIsSaving(true);
    setSaveError(null);
    try {
      await saveConfig({
        team_id: nextConfig.teamId,
        channel_id: nextConfig.channelId,
        channel_name: nextConfig.channelName || undefined,
        tenant_id: nextConfig.tenantId,
        qr_image_url: nextConfig.qrImageUrl || undefined,
      });
      setConfig(nextConfig);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không thể lưu cấu hình.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    const defaults = getDefaultTeamsChannelConfig();
    setConfig(defaults);
    setSaved(false);
    setSaveError(null);
  };

  return (
    <div className="dashboard-grid">
      <section className="panel teams-settings-panel">
        <div className="teams-settings-heading">
          <div>
            <h2>Cấu hình kênh Teams</h2>
            <p className="text-muted">
              Chọn nơi Power Automate sẽ gửi thông báo nhắc nợ từ Lunch Ledger.
            </p>
          </div>
          <span className="teams-settings-badge">Dynamic destination</span>
        </div>

        <form className="teams-settings-form" onSubmit={handleSubmit}>
          <label>
            <span className="teams-field-label">
              Team ID <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <input
              type="text"
              className="input-field"
              value={config.teamId}
              onChange={(event) => setConfig((current) => ({ ...current, teamId: event.target.value }))}
              placeholder="14545eec-..."
              spellCheck={false}
              autoComplete="off"
              required
            />
            <small>ID của team chứa channel cần gửi.</small>
          </label>

          <label>
            <span className="teams-field-label">
              Channel ID <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <input
              type="text"
              className="input-field"
              value={config.channelId}
              onChange={(event) => setConfig((current) => ({ ...current, channelId: event.target.value }))}
              placeholder="19:...@thread.tacv2"
              spellCheck={false}
              autoComplete="off"
              required
            />
            <small>ID của channel trong Teams.</small>
          </label>

          <label>
            <span className="teams-field-label">
              Channel name <span className="optional-label">(tùy chọn)</span>
            </span>
            <input
              type="text"
              className="input-field"
              value={config.channelName}
              onChange={(event) => setConfig((current) => ({ ...current, channelName: event.target.value }))}
              placeholder="test_power_automate"
              autoComplete="off"
            />
            <small>Dùng để hiển thị và đối chiếu; không dùng để route message.</small>
          </label>

          <label>
            <span className="teams-field-label">
              Tenant ID <span className="required-mark" aria-hidden="true">*</span>
            </span>
            <input
              type="text"
              className="input-field"
              value={config.tenantId}
              onChange={(event) => setConfig((current) => ({ ...current, tenantId: event.target.value }))}
              placeholder="a132a7f5-..."
              spellCheck={false}
              autoComplete="off"
              required
            />
            <small>Tenant Microsoft 365 chứa team và channel.</small>
          </label>

          <label>
            <span className="teams-field-label">
              QR image URL <span className="optional-label">(tùy chọn)</span>
            </span>
            <input
              type="url"
              className="input-field"
              value={config.qrImageUrl}
              onChange={(event) => setConfig((current) => ({ ...current, qrImageUrl: event.target.value }))}
              placeholder="https://res.cloudinary.com/.../qr.jpg"
              spellCheck={false}
              autoComplete="off"
            />
            <small>
              URL ảnh QR sẽ được gửi động sang Power Automate để hiển thị trong Adaptive Card.
            </small>
          </label>

          <div className="teams-settings-actions">
            <button type="submit" className="submit-btn small-btn">
              {isSaving ? "Đang lưu..." : saved ? "Đã lưu cấu hình" : "Lưu cấu hình"}
            </button>
            <button type="button" className="teams-settings-reset" onClick={resetToDefaults}>
              Khôi phục mặc định
            </button>
          </div>
        </form>

        {saveError && <p className="teams-settings-error">{saveError}</p>}

        <p className="teams-settings-note">
          Cấu hình được lưu trong Convex và dùng chung cho workspace. Webhook Power
          Automate vẫn được giữ ở Convex environment và không đưa ra frontend.
        </p>
      </section>
    </div>
  );
}
