import type { BoardSummary } from "../domain/rules";

// 页面层：看板顶部指标卡（只读展示）

function MetricCard({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone: "primary" | "danger" | "warn" | "ok";
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>
        {value}
        {suffix ? <em>{suffix}</em> : null}
      </strong>
      <i className={`metric-bar bar-${tone}`} />
    </article>
  );
}

export default function MetricCards({ summary }: { summary: BoardSummary }) {
  return (
    <section className="metrics-grid">
      <MetricCard
        label="治疗中计划"
        value={summary.active}
        suffix={`/ 共 ${summary.total} 份`}
        tone="primary"
      />
      <MetricCard label="本次转急诊" value={summary.emergency} suffix="份等待重排" tone="danger" />
      <MetricCard label="联系名单" value={summary.contactList} suffix="份连续失约" tone="warn" />
      <MetricCard label="已完成" value={summary.completed} suffix="份乳牙治疗" tone="ok" />
    </section>
  );
}
