// ===== 页面层：新增牙位治疗计划表单（初诊登记）=====
import { useState } from "react";
import type { NewPlanInput } from "../types";

interface Props {
  onCreate: (input: NewPlanInput) => void;
}

const EMPTY: NewPlanInput = {
  toothNo: "",
  childName: "",
  age: 5,
  diagnosis: "",
  plannedVisits: 3,
  guardianName: "",
  guardianRelation: "",
  guardianPhone: "",
};

export function NewPlanForm({ onCreate }: Props) {
  const [form, setForm] = useState<NewPlanInput>(EMPTY);

  const set = <K extends keyof NewPlanInput>(key: K, value: NewPlanInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    onCreate(form);
    setForm(EMPTY);
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>初诊登记</p>
          <h2>新增乳牙治疗计划</h2>
        </div>
        <button className="primary-action" onClick={submit}>
          登记牙位
        </button>
      </div>
      <div className="field-grid">
        <label>
          <span>牙位 *</span>
          <input
            placeholder="如 #54、#75"
            value={form.toothNo}
            onChange={(event) => set("toothNo", event.target.value)}
          />
        </label>
        <label>
          <span>患儿姓名 *</span>
          <input
            placeholder="患儿姓名"
            value={form.childName}
            onChange={(event) => set("childName", event.target.value)}
          />
        </label>
        <label>
          <span>年龄</span>
          <input
            type="number"
            min={0}
            max={14}
            value={form.age}
            onChange={(event) => set("age", Number(event.target.value))}
          />
        </label>
        <label>
          <span>诊断</span>
          <input
            placeholder="如 急性牙髓炎"
            value={form.diagnosis}
            onChange={(event) => set("diagnosis", event.target.value)}
          />
        </label>
        <label>
          <span>预计次数 *</span>
          <input
            type="number"
            min={1}
            max={10}
            value={form.plannedVisits}
            onChange={(event) => set("plannedVisits", Math.max(1, Number(event.target.value)))}
          />
        </label>
        <label>
          <span>本次监护人 *</span>
          <input
            placeholder="陪同人姓名（如：李建国 父亲）"
            value={form.guardianName}
            onChange={(event) => set("guardianName", event.target.value)}
          />
        </label>
        <label>
          <span>与患儿关系</span>
          <input
            placeholder="父亲 / 母亲 / 祖父母 / 其他"
            value={form.guardianRelation}
            onChange={(event) => set("guardianRelation", event.target.value)}
          />
        </label>
        <label>
          <span>联系电话</span>
          <input
            placeholder="监护人电话"
            value={form.guardianPhone}
            onChange={(event) => set("guardianPhone", event.target.value)}
          />
        </label>
      </div>
      <p className="form-hint">
        家长常临时更换陪同人：每次接诊请在卡片上重新核对「本次监护人」，换人后须重新确认才能推进。
      </p>
    </section>
  );
}
