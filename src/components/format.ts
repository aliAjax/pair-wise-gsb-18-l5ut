// ===== 页面层：展示用小工具 =====

/** ISO/本地时间 -> "MM-DD HH:mm" */
export function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local 输入框的当前默认值 */
export function nowLocalInput(): string {
  return new Date().toISOString().slice(0, 16);
}
