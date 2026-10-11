export type TeamsChannelConfig = {
  teamId: string;
  channelId: string;
  channelName: string;
  tenantId: string;
  qrImageUrl: string;
};

export const teamsChannelStorageKey = "lunch-ledger:teams-channel";

export const teamsChannelProfiles = [
  {
    name: "Cơm Chưa",
    teamId: "14545eec-51d2-4898-97df-bba08d5937b7",
    channelId: "19:ZhvU1IFOqBaDvAO6osg0dXI6R-YYDLSWwewzEinFT9M1@thread.tacv2",
    channelName: "Cơm Chưa",
    tenantId: "a132a7f5-19fb-48f8-9ed0-5554d0f7652e",
  },
  {
    name: "test_power_automate",
    teamId: "14545eec-51d2-4898-97df-bba08d5937b7",
    channelId: "19:X-ecLJw03EqevcEF8U5dJdktA7ZffBRb33Nf6hGDm-E1@thread.tacv2",
    channelName: "test_power_automate",
    tenantId: "a132a7f5-19fb-48f8-9ed0-5554d0f7652e",
  },
] satisfies Array<
  Pick<
    TeamsChannelConfig,
    "teamId" | "channelId" | "channelName" | "tenantId"
  > & { name: string }
>;

function getEnvValue(name: string): string {
  return (import.meta.env[name] as string | undefined)?.trim() ?? "";
}

export function getDefaultTeamsChannelConfig(): TeamsChannelConfig {
  return {
    teamId: getEnvValue("VITE_TEAMS_TEAM_ID"),
    channelId: getEnvValue("VITE_TEAMS_CHANNEL_ID"),
    channelName: getEnvValue("VITE_TEAMS_CHANNEL_NAME"),
    tenantId: getEnvValue("VITE_TEAMS_TENANT_ID"),
    qrImageUrl: getEnvValue("VITE_TEAMS_QR_IMAGE_URL"),
  };
}

export function readTeamsChannelConfig(): TeamsChannelConfig {
  const fallback = getDefaultTeamsChannelConfig();

  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(teamsChannelStorageKey);
    if (!stored) return fallback;

    const parsed = JSON.parse(stored) as Partial<TeamsChannelConfig>;
    return {
      teamId: parsed.teamId?.trim() || fallback.teamId,
      channelId: parsed.channelId?.trim() || fallback.channelId,
      channelName: parsed.channelName?.trim() || fallback.channelName,
      tenantId: parsed.tenantId?.trim() || fallback.tenantId,
      qrImageUrl: parsed.qrImageUrl?.trim() || fallback.qrImageUrl,
    };
  } catch {
    return fallback;
  }
}
