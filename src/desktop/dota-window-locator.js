import { execFile } from "node:child_process";

const PROCESS_QUERY = String.raw`$dota = @(Get-Process -Name 'dota2' -ErrorAction SilentlyContinue)
if ($dota.Count -eq 0) { [Console]::Out.Write('not-running'); exit 0 }
$visible = $dota | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($null -eq $visible) { [Console]::Out.Write('no-visible-window'); exit 0 }
[Console]::Out.Write($visible.MainWindowHandle.ToInt64().ToString([Globalization.CultureInfo]::InvariantCulture))`;

export function captureSourceWindowHandle(sourceId) {
  if (typeof sourceId !== "string") return undefined;
  return /^window:(\d+):\d+$/.exec(sourceId)?.[1];
}

export function parseDotaWindowQuery(output) {
  const value = typeof output === "string" ? output.trim() : "";
  if (value === "not-running" || value === "no-visible-window") return Object.freeze({ status: value });
  if (/^[1-9]\d{0,19}$/.test(value)) return Object.freeze({ status: "ready", windowHandle: value });
  throw new TypeError("Windows Dota 2 窗口查询结果无效");
}

export function queryDotaWindow({ execute = execFile } = {}) {
  if (typeof execute !== "function") throw new TypeError("Windows 进程查询执行器无效");
  return new Promise((resolve, reject) => {
    execute("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      PROCESS_QUERY,
    ], {
      encoding: "utf8",
      maxBuffer: 1_024,
      timeout: 3_000,
      windowsHide: true,
    }, (error, stdout) => {
      if (error) {
        reject(new Error("无法读取 Windows 的 Dota 2 窗口状态", { cause: error }));
        return;
      }
      try {
        resolve(parseDotaWindowQuery(stdout));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

export function createDotaWindowLocator({ queryWindow = queryDotaWindow } = {}) {
  if (typeof queryWindow !== "function") throw new TypeError("Dota 2 窗口查询器无效");
  return Object.freeze({
    async locate(sources) {
      if (!Array.isArray(sources)) throw new TypeError("画面来源格式无效");
      const window = await queryWindow();
      if (window.status !== "ready") return window;
      const source = sources.find(({ id }) => captureSourceWindowHandle(id) === window.windowHandle);
      if (!source) return Object.freeze({ status: "source-unavailable" });
      return Object.freeze({
        status: "bound",
        sourceId: source.id,
        sourceName: String(source.name).slice(0, 160),
      });
    },
  });
}
