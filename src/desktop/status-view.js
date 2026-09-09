const PRESENTATIONS = Object.freeze({
  starting: Object.freeze({
    tone: "working",
    title: "正在连接",
    detail: "正在登录 Steam 并连接 Dota 2 协调服务器。",
  }),
  unavailable: Object.freeze({
    tone: "idle",
    title: "等待好友开局",
    detail: "当前没有发现可观战比赛，程序会自动继续检查。",
  }),
  detailed_stats: Object.freeze({
    tone: "success",
    title: "好友正在比赛",
    detail: "已发现比赛，并取得 Valve 提供的实时比赛数据。",
  }),
  transient_error: Object.freeze({
    tone: "error",
    title: "暂时无法查询",
    detail: "Steam 或 Valve 暂时没有响应，程序会在下一轮自动重试。",
  }),
});

export function presentStatus(status) {
  status ??= {};
  if (status.phase === "spectating_unlisted") {
    const serverId = /^\d{1,20}$/.test(String(status.serverSteamId ?? ""))
      ? status.serverSteamId
      : "未知";
    return {
      tone: "success",
      title: "好友正在比赛",
      detail: `已发现可观战比赛，服务器 ID：${serverId}。普通路人局可能没有详细比分。`,
    };
  }
  return PRESENTATIONS[status.phase] ?? {
    tone: "idle",
    title: "尚未开始监控",
    detail: "填写账号和好友信息后开始监控。",
  };
}
