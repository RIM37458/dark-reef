const MODES = Object.freeze({
  live: Object.freeze({
    eyebrow: "LIVE SCREEN READING // LOCAL ONLY",
    title: "实战选人仪",
    badge: "正式模式 · 真实画面",
    boardTitle: "识图投影阵列",
    showDemo: false,
    showCapture: true,
    showProfile: true,
    message: "先读取 Dota 2 画面，再部署投影。识图操作位于投影工具条。",
  }),
  demo: Object.freeze({
    eyebrow: "TEN SIGILS // SIMULATION",
    title: "十人征召演示",
    badge: "演示模式 · 预设数据",
    boardTitle: "演示英雄阵列",
    showDemo: true,
    showCapture: false,
    showProfile: false,
    message: "演示按十手选人逐步更新，亮起的是当前推荐候选；不会读取游戏画面。",
  }),
});

export function presentDraftRoomMode(mode) {
  const presentation = MODES[mode];
  if (!presentation) throw new RangeError("未知选人模式");
  return presentation;
}
