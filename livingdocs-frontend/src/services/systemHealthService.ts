export interface SystemHealthState {
  backend: boolean;
  aiEngine: boolean;
  postgres: boolean;
  webhook: boolean;
  lastChecked: number;
}

const STORAGE_KEY = "livingdocs_system_health_status";

// Lấy trạng thái đã lưu hoặc trạng thái mặc định (tất cả online)
export function getStoredSystemHealth(): SystemHealthState {
  if (typeof window === "undefined") {
    return {
      backend: true,
      aiEngine: true,
      postgres: true,
      webhook: true,
      lastChecked: Date.now(),
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as SystemHealthState;
    }
  } catch {
    // fallback
  }

  return {
    backend: true,
    aiEngine: true,
    postgres: true,
    webhook: true,
    lastChecked: Date.now(),
  };
}

// Lưu trạng thái và phát event đồng bộ thời gian thực giữa các trang
export function saveSystemHealth(state: SystemHealthState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("livingdocs:health_changed", { detail: state }));
  } catch {
    // fallback
  }
}
