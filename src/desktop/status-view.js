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
    detail: "斯拉达已为囚徒点灯；下方战况会随每轮巡逻自动刷新。",
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

export function screenForState(state) {
  return state?.running ? "watch" : "login";
}

function gameClock(seconds) {
  if (!Number.isInteger(seconds)) return "—";
  const sign = seconds < 0 ? "−" : "";
  const absolute = Math.abs(seconds);
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
}

function lead(value) {
  if (!Number.isInteger(value)) return "—";
  if (value === 0) return "经济持平";
  return `${value > 0 ? "天辉" : "夜魇"}领先 ${Math.abs(value).toLocaleString("en-US")}`;
}

function count(value) {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : "—";
}

function presentTarget(target) {
  if (!target) return undefined;
  return {
    heroName: target.heroName ?? (target.heroId ? `英雄 #${target.heroId}` : "英雄未公开"),
    heroImageUrl: target.heroImageUrl,
    level: count(target.level),
    kda: `${count(target.kills)} / ${count(target.deaths)} / ${count(target.assists)}`,
    lastHits: `${count(target.lastHits)} / ${count(target.denies)}`,
    netWorth: count(target.netWorth),
    items: target.items ?? [],
  };
}

export function presentLiveMatch(status) {
  if (status?.phase !== "detailed_stats" || !status.match) return null;
  const match = status.match;
  const target = presentTarget(match.target);
  return {
    matchId: match.matchId ?? "未公开",
    gameTime: gameClock(match.gameTime),
    radiantScore: Number.isInteger(match.radiantScore) ? String(match.radiantScore) : "—",
    direScore: Number.isInteger(match.direScore) ? String(match.direScore) : "—",
    radiantLead: lead(match.radiantLead),
    spectators: Number.isInteger(match.spectators) ? match.spectators.toLocaleString("en-US") : "—",
    radiantName: match.radiantName ?? "天辉",
    direName: match.direName ?? "夜魇",
    source: status.source === "gc_source_tv"
      ? "Dota 2 协调服务器 · 延迟直播"
      : status.source === "valve_web_api"
        ? "Valve 实时统计接口"
        : "暗黑之礁演示回路",
    ...(target ? { target } : {}),
  };
}
