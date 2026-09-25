import { useMemo, useState } from "react";
import "./styles.css";
import MetricCards from "./components/MetricCards";
import NewPlanForm from "./components/NewPlanForm";
import NoticeBar from "./components/NoticeBar";
import PlanCard from "./components/PlanCard";
import Sidebar, { type BoardFilter } from "./components/Sidebar";
import { usePlans } from "./hooks/usePlans";
import type { ToothPlan } from "./domain/types";

// 页面层组合：记录（plansStore）→ 判断（rules）→ 看板页面（components）

const FILTER_PREDICATES: Record<BoardFilter, (p: ToothPlan) => boolean> = {
  all: () => true,
  active: (p) => !p.completed,
  checkedIn: (p) => !p.completed && p.visitCheckedIn,
  awaitConfirm: (p) =>
    !p.completed && p.visitCheckedIn && !p.guardianConfirmed && !p.emergency?.active,
  emergency: (p) => p.emergency?.active === true,
  contact: (p) => p.contactListed && !p.completed,
  done: (p) => p.completed,
};

function App() {
  const {
    plans,
    summary,
    notice,
    dismissNotice,
    addPlan,
    removePlan,
    restoreDemo,
    actions,
  } = usePlans();

  const [filter, setFilter] = useState<BoardFilter>("all");

  const counts = useMemo(() => {
    const result = {} as Record<BoardFilter, number>;
    (Object.keys(FILTER_PREDICATES) as BoardFilter[]).forEach((key) => {
      result[key] = plans.filter(FILTER_PREDICATES[key]).length;
    });
    return result;
  }, [plans]);

  const visiblePlans = useMemo(
    () => plans.filter(FILTER_PREDICATES[filter]),
    [plans, filter]
  );

  const emergencyPlans = plans.filter((p) => p.emergency?.active);
  const contactPlans = plans.filter((p) => p.contactListed && !p.completed);

  const jumpToPlan = (id: string) => {
    setFilter("all");
    requestAnimationFrame(() => {
      document
        .getElementById(`plan-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const handleRemove = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (plan && window.confirm(`确定删除 ${plan.childName} 的 ${plan.toothCode} 牙治疗计划？`)) {
      removePlan(id);
    }
  };

  return (
    <main className="app-shell">
      <NoticeBar notice={notice} onDismiss={dismissNotice} />

      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · 乳牙治疗计划台</p>
          <h1>乳牙根管治疗看板</h1>
          <p className="subtitle">
            按牙位登记患儿、治疗阶段、预计次数与本次监护人。到诊后经家长确认才能推进；
            明显疼痛或肿胀本次转急诊并保留原计划重排；连续两次未到诊进入联系名单。
          </p>
        </div>
        <div className="stack-card">
          <span>记录 / 判断 / 页面 分层</span>
          <strong>阶段、到诊次数与联系安排本地持久化，重新打开仍在</strong>
        </div>
      </section>

      <MetricCards summary={summary} />

      <section className="workspace">
        <Sidebar
          filter={filter}
          onFilter={setFilter}
          counts={counts}
          emergencyPlans={emergencyPlans}
          contactPlans={contactPlans}
          onJump={jumpToPlan}
          onRestoreDemo={restoreDemo}
        />

        <section className="board-column">
          <NewPlanForm onCreate={addPlan} />
          <div className="plan-list">
            {visiblePlans.length === 0 && (
              <div className="empty-board">当前筛选下没有牙位计划</div>
            )}
            {visiblePlans.map((plan) => (
              <div key={plan.id} id={`plan-${plan.id}`}>
                <PlanCard plan={plan} actions={actions} onRemove={handleRemove} />
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
