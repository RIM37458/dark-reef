export function assertTrustedIpcSender(event, windows) {
  const sender = event?.sender;
  const trusted = windows.some((window) => (
    window
    && !window.isDestroyed()
    && window.webContents === sender
  ));
  if (!trusted) throw new Error("Untrusted IPC sender");
}
