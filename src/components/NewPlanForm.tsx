import { useState } from "react";
import type { NewPlanInput } from "../domain/rules";

// 页面层：新牙位建档表单

const PRIMARY_TEETH = [
  "55", "54", "53", "52", "51", "61", "62", "63", "64", "65",
  "85", "84", "83", "82", "81", "71", "72", "73", "74", "75",
];

export default function NewPlanForm({
  onCreate,
}: {
  onCreate: (input: NewPlanInput) => boolean;
}) {
  const [toothCode, setToothCode] = useState("");
  const [childName, setChildName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [plannedVisits, setPlannedVisits] = useState(3);
  const [open, setOpen] = useState(false);

  const submit = () => {
    const ok = onCreate({ toothCode, childName, diagnosis, plannedVisits });
    if (ok) {
      setToothCode("");
      setChildName("");
      setDiagnosis("");
      setPlannedVisits(3);
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <section className="panel new-plan-bar">
        <div>
          <h2>乳牙治疗计划台</h2>
          <p>按牙位登记患儿、治疗阶段、预计次数与本次监护人；家长确认后才能推进下一步</p>
        </div>
        <button className="primary-action" onClick={() => setOpen(true)}>
          + 新增牙位计划
        </button>
      </section>
    );
  }

  return (
    <section className="panel new-plan-form">
      <div className="section-heading">
        <div>
          <p>新建计划</p>
          <h2>牙位建档</h2>
        </div>
        <button onClick={() => setOpen(false)}>收起</button>
      </div>
      <div className="field-grid">
        <label>
          <span>牙位（FDI 乳牙编号）</span>
          <input
            list="primary-teeth"
            value={toothCode}
            placeholder="如 74"
            onChange={(e) => setToothCode(e.target.value)}
          />
          <datalist id="primary-teeth">
            {PRIMARY_TEETH.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
        </label>
        <label>
          <span>患儿姓名</span>
          <input
            value={childName}
            placeholder="如 李小满"
            onChange={(e) => setChildName(e.target.value)}
          />
        </label>
        <label>
          <span>诊断</span>
          <input
            value={diagnosis}
            placeholder="如 急性牙髓炎"
            onChange={(e) => setDiagnosis(e.target.value)}
          />
        </label>
        <label>
          <span>预计次数</span>
          <input
            type="number"
            min={1}
            max={8}
            value={plannedVisits}
            onChange={(e) => setPlannedVisits(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-action" onClick={submit}>
          建立计划
        </button>
        <span className="form-hint">建档后从「开髓拔髓」开始，每次到诊需重新登记并确认监护人</span>
      </div>
    </section>
  );
}
