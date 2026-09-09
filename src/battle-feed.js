function scoreEvent(previous, current, side, label) {
  const before = previous?.[side];
  const after = current?.[side];
  if (!Number.isInteger(before) || !Number.isInteger(after) || after <= before) return null;
  return `${label}新增 ${after - before} 次击杀，比分来到 ${current.radiantScore ?? "—"}:${current.direScore ?? "—"}。`;
}

function itemKey(item) {
  return item?.id ?? item?.name;
}

export function describeBattleChanges(previous, current) {
  if (!current) return [];
  if (!previous || previous.matchId !== current.matchId) {
    return ["监视之眼已接入战场，开始记录目标动向。"];
  }
  const events = [
    scoreEvent(previous, current, "radiantScore", "天辉"),
    scoreEvent(previous, current, "direScore", "夜魇"),
  ].filter(Boolean);
  const previousDeaths = previous.target?.deaths;
  const currentDeaths = current.target?.deaths;
  const previousKills = previous.target?.kills;
  const currentKills = current.target?.kills;
  if (Number.isInteger(previousKills) && Number.isInteger(currentKills) && currentKills > previousKills) {
    events.push(`目标击杀数增至 ${currentKills}。`);
  }
  if (Number.isInteger(previousDeaths) && Number.isInteger(currentDeaths) && currentDeaths > previousDeaths) {
    events.push(`目标阵亡次数增至 ${currentDeaths}。`);
  }
  const previousItems = new Set((previous.target?.items ?? []).map(itemKey));
  for (const item of current.target?.items ?? []) {
    if (!previousItems.has(itemKey(item))) events.push(`目标装备栏出现 ${item.name}。`);
  }
  if (Number.isInteger(previous.radiantLead) && Number.isInteger(current.radiantLead)
      && Math.sign(previous.radiantLead) !== Math.sign(current.radiantLead)
      && current.radiantLead !== 0) {
    events.push(`经济优势已转向${current.radiantLead > 0 ? "天辉" : "夜魇"}。`);
  }
  return events;
}
