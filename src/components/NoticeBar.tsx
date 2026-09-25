import type { Notice } from "../hooks/usePlans";

// 页面层：操作结果提示条（规则层拒绝操作时显示原因）

export default function NoticeBar({
  notice,
  onDismiss,
}: {
  notice: Notice | null;
  onDismiss: () => void;
}) {
  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.type}`} onClick={onDismiss}>
      <span>{notice.type === "error" ? "无法操作：" : ""}{notice.text}</span>
      <b>×</b>
    </div>
  );
}
