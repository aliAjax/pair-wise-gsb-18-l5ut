import type { ToothPlan } from "../domain/types";

// 页面层：侧栏筛选与急诊/联系名单快捷入口

export type BoardFilter =
  | "all"
  | "active"
  | "checkedIn"
  | "awaitConfirm"
  | "emergency"
  | "contact"
  | "done";

const FILTERS: { id: BoardFilter; label: string }[] = [
  { id: "all", label: "全部计划" },
  { id: "active", label: "治疗中" },
  { id: "checkedIn", label: "本次已到诊" },
  { id: "awaitConfirm", label: "待家长确认" },
  { id: "emergency", label: "转急诊" },
  { id: "contact", label: "联系名单" },
  { id: "done", label: "已完成" },
];

const RULES = [
  "先登记到诊 → 监护人确认 → 才能推进阶段",
  "明显疼痛或肿胀：本次转急诊，原计划保留等待重排",
  "连续两次未到诊：进入联系名单，不能直接算完成",
];

export default function Sidebar({
  filter,
  onFilter,
  counts,
  emergencyPlans,
  contactPlans,
  onJump,
  onRestoreDemo,
}: {
  filter: BoardFilter;
  onFilter: (f: BoardFilter) => void;
  counts: Record<BoardFilter, number>;
  emergencyPlans: ToothPlan[];
  contactPlans: ToothPlan[];
  onJump: (id: string) => void;
  onRestoreDemo: () => void;
}) {
  return (
    <aside className="panel sidebar">
      <h2>看板筛选</h2>
      <div className="filter-list">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={filter === f.id ? "filter-item active" : "filter-item"}
            onClick={() => onFilter(f.id)}
          >
            <span>{f.label}</span>
            <em>{counts[f.id]}</em>
          </button>
        ))}
      </div>

      <h2>工作台规则</h2>
      <ul className="rule-list">
        {RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <h2>急诊 · 等待重排（{emergencyPlans.length}）</h2>
      <div className="quick-list">
        {emergencyPlans.length === 0 && <p className="quick-empty">暂无</p>}
        {emergencyPlans.map((p) => (
          <button key={p.id} className="quick-item quick-danger" onClick={() => onJump(p.id)}>
            <strong>{p.toothCode} · {p.childName}</strong>
            <span>{p.emergency?.reasons.join("、")} · {p.emergency?.since}</span>
          </button>
        ))}
      </div>

      <h2>联系名单（{contactPlans.length}）</h2>
      <div className="quick-list">
        {contactPlans.length === 0 && <p className="quick-empty">暂无</p>}
        {contactPlans.map((p) => (
          <button key={p.id} className="quick-item quick-warn" onClick={() => onJump(p.id)}>
            <strong>{p.toothCode} · {p.childName}</strong>
            <span>
              连续未到 {p.consecutiveNoShows} 次
              {p.nextContactDate ? ` · 下次联系 ${p.nextContactDate}` : ""}
            </span>
          </button>
        ))}
      </div>

      <button className="restore-btn" onClick={onRestoreDemo}>
        恢复示例记录
      </button>
    </aside>
  );
}
