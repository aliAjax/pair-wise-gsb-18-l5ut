import { useMemo, useState } from "react";
import "./styles.css";
import { NewPlanForm } from "./components/NewPlanForm";
import { PlanCard } from "./components/PlanCard";
import {
  deriveStatus,
  isEmergencyActive,
  reachContactThreshold,
} from "./rules";
import {
  ActionResult,
  addPlan,
  advanceStage,
  checkIn,
  initPlans,
  markNoShow,
  resolveEmergency,
  restoreSamplePlans,
  saveContact,
  setGuardianConfirm,
  transferEmergency,
  updateGuardian,
} from "./store";
import type {
  ContactArrangement,
  NewPlanInput,
  PlanStatus,
  TreatmentPlan,
} from "./types";

type Filter = PlanStatus | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部牙位" },
  { id: "active", label: "治疗中" },
  { id: "emergency", label: "转急诊" },
  { id: "contact", label: "联系名单" },
  { id: "done", label: "已完成" },
];

const USERS = ["儿童牙科医生", "助理", "前台", "复诊协调员"];

function App() {
  const [plans, setPlans] = useState<TreatmentPlan[]>(initPlans);
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState<ActionResult | null>(null);

  const notify = (result: ActionResult) => {
    setToast(result);
    window.setTimeout(() => setToast(null), 2600);
  };

  const run = (
    outcome: { plans: TreatmentPlan[]; result: ActionResult },
  ): void => {
    setPlans(outcome.plans);
    notify(outcome.result);
  };

  const metrics = useMemo(() => {
    const emergency = plans.filter((plan) => isEmergencyActive(plan.emergency)).length;
    const contact = plans.filter((plan) => reachContactThreshold(plan)).length;
    const active = plans.filter((plan) => deriveStatus(plan) === "active").length;
    const done = plans.filter((plan) => plan.stage === "done").length;
    return { emergency, contact, active, done };
  }, [plans]);

  const visiblePlans = useMemo(
    () => (filter === "all" ? plans : plans.filter((plan) => deriveStatus(plan) === filter)),
    [plans, filter],
  );

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · port 5104</p>
          <h1>乳牙治疗计划台</h1>
          <p className="subtitle">
            按牙位登记患儿、治疗阶段、预计次数与本次监护人；家长确认后才能推进下一步。
            明显疼痛或肿胀本次转急诊并保留原计划；连续两次未到诊进入联系名单，不能直接算完成。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈 / 分层</span>
          <strong>React + Vite + TypeScript</strong>
          <small>记录（types/storage/store）· 判断（rules）· 页面（components）</small>
          <button
            onClick={() => {
              setPlans(restoreSamplePlans());
              notify({ ok: true, message: "已恢复示例数据" });
            }}
          >
            恢复示例数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <button
          className={`metric-card metric-clickable ${filter === "active" ? "metric-selected" : ""}`}
          onClick={() => setFilter(filter === "active" ? "all" : "active")}
        >
          <span>治疗中</span>
          <strong>{metrics.active}</strong>
          <i className="status-ok" />
        </button>
        <button
          className={`metric-card metric-clickable ${filter === "emergency" ? "metric-selected" : ""}`}
          onClick={() => setFilter(filter === "emergency" ? "all" : "emergency")}
        >
          <span>转急诊（计划保留）</span>
          <strong>{metrics.emergency}</strong>
          <i className="status-danger" />
        </button>
        <button
          className={`metric-card metric-clickable ${filter === "contact" ? "metric-selected" : ""}`}
          onClick={() => setFilter(filter === "contact" ? "all" : "contact")}
        >
          <span>联系名单（连续 2 次未到）</span>
          <strong>{metrics.contact}</strong>
          <i className="status-watch" />
        </button>
        <button
          className={`metric-card metric-clickable ${filter === "done" ? "metric-selected" : ""}`}
          onClick={() => setFilter(filter === "done" ? "all" : "done")}
        >
          <span>已完成</span>
          <strong>{metrics.done}</strong>
          <i className="status-ok" />
        </button>
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {USERS.map((user) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>看板筛选</h2>
          <div className="filter-list">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                className={filter === item.id ? "filter-active" : ""}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <h2>规则速查</h2>
          <ul className="rule-note">
            <li>每次接诊核对本次监护人，换人需重新确认</li>
            <li>登记到诊后，经家长确认才能推进阶段</li>
            <li>明显疼痛/肿胀：本次转急诊，原计划冻结保留</li>
            <li>连续 2 次未到诊自动进联系名单</li>
            <li>未到诊、未确认都不能标记完成</li>
          </ul>
        </aside>

        <NewPlanForm onCreate={(input: NewPlanInput) => run(addPlan(plans, input))} />
      </section>

      <section className="board panel">
        <div className="section-heading">
          <div>
            <p>乳牙治疗看板</p>
            <h2>
              {FILTERS.find((item) => item.id === filter)?.label} · {visiblePlans.length} 个牙位
            </h2>
          </div>
        </div>

        {visiblePlans.length === 0 ? (
          <div className="empty-board">当前筛选下暂无牙位计划</div>
        ) : (
          <div className="plan-grid-layout">
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onGuardianChange={(id, patch) => setPlans(updateGuardian(plans, id, patch))}
                onConfirm={(id, confirmed, note) =>
                  run(setGuardianConfirm(plans, id, confirmed, note))
                }
                onCheckIn={(id) => run(checkIn(plans, id))}
                onNoShow={(id) => run(markNoShow(plans, id))}
                onAdvance={(id) => run(advanceStage(plans, id))}
                onEmergency={(id, reason) => run(transferEmergency(plans, id, reason))}
                onResolveEmergency={(id) => run(resolveEmergency(plans, id))}
                onSaveContact={(id, arrangement: ContactArrangement) =>
                  run(saveContact(plans, id, arrangement))
                }
              />
            ))}
          </div>
        )}
      </section>

      {toast && (
        <div className={`toast ${toast.ok ? "toast-ok" : "toast-err"}`} role="status">
          {toast.ok ? "✓ " : "⚠ "}
          {toast.message}
        </div>
      )}
    </main>
  );
}

export default App;
