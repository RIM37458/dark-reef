const PRESENTATIONS = Object.freeze({
  starting: Object.freeze({
    tone: "working",
    title: "斯拉达正在巡视暗黑之礁",
    detail: "深海卫士正在核验看守者铭牌，并聆听战场的回响。",
  }),
  unavailable: Object.freeze({
    tone: "idle",
    title: "深海卫士仍在巡猎",
    detail: "目标尚未踏入战场；斯拉达的监视之眼不会移开。",
  }),
  detailed_stats: Object.freeze({
    tone: "success",
    title: "侵蚀雾霭已锁定目标",
    detail: "斯拉达已为囚徒点灯，战场在深海监视之下显形。",
  }),
  transient_error: Object.freeze({
    tone: "error",
    title: "深海水道遭到扰动",
    detail: "战场回响暂时沉没；斯拉达将在下一轮巡逻中再次搜寻。",
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
      title: "侵蚀雾霭已锁定目标",
      detail: `斯拉达已为囚徒点灯，战场编号：${serverId}。暗流遮住了更深层的战况。`,
    };
  }
  return PRESENTATIONS[status.phase] ?? {
    tone: "idle",
    title: "深渊囚室静默",
    detail: "向斯拉达呈交看守者铭牌与囚徒编号，开启巡猎。",
  };
}

export function isTargetMarked(status) {
  return status?.phase === "spectating_unlisted" || status?.phase === "detailed_stats";
}
