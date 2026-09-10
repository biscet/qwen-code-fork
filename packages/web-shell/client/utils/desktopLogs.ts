export async function downloadDesktopLogs(): Promise<string | null> {
  const invoke = (
    window as {
      __TAURI__?: {
        core?: { invoke?: (command: string) => Promise<string | null> };
      };
    }
  ).__TAURI__?.core?.invoke;
  if (typeof invoke !== 'function') {
    throw new Error('Desktop log download is unavailable.');
  }
  return invoke('download_logs');
}
