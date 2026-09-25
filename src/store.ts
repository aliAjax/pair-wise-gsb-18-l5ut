// ===== 记录层 × 判断层：状态编排 =====
// 所有修改集中在这里：先用 rules 做判断，通过后才变更记录并追加历史，最后持久化。
import {
  canAdvance,
  canCheckIn,
  canComplete,
  createContactArrangement,
  isEmergencyActive,
  nextStage,
  reachContactThreshold,
  stageLabel,
} from "./rules";
import { loadPlans, resetPlans, savePlans } from "./storage";
import type {
  ContactArrangement,
  NewPlanInput,
  TreatmentPlan,
} from "./types";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const now = () => new Date().toISOString();

function withHistory(plan: TreatmentPlan, action: string): TreatmentPlan {
  return { ...plan, history: [...plan.history, { at: now(), action }] };
}

let uid = 0;
function makeId(): string {
  uid += 1;
  return `plan-${Date.now().toString(36)}-${uid}`;
}

export function initPlans(): TreatmentPlan[] {
  return loadPlans();
}

/** 新增牙位计划（初诊登记） */
export function addPlan(
  plans: TreatmentPlan[],
  input: NewPlanInput,
): { plans: TreatmentPlan[]; result: ActionResult } {
  if (!input.toothNo.trim() || !input.childName.trim()) {
    return { plans, result: { ok: false, message: "牙位和患儿姓名必填" } };
  }
  if (input.plannedVisits < 1) {
    return { plans, result: { ok: false, message: "预计次数至少为 1" } };
  }
  if (!input.guardianName.trim()) {
    return { plans, result: { ok: false, message: "请登记本次陪同监护人" } };
  }
  const plan: TreatmentPlan = {
    ...input,
    toothNo: input.toothNo.trim(),
    childName: input.childName.trim(),
    id: makeId(),
    stage: "intake",
    attendedVisits: 0,
    consecutiveNoShows: 0,
    guardianConfirmed: false,
    confirmNote: "",
    visitOutcome: "pending",
    emergency: { active: false, reason: "", at: "", resolved: false },
    contact: null,
    history: [{ at: now(), action: `初诊登记，预计 ${input.plannedVisits} 次完成` }],
    createdAt: now(),
  };
  const next = [plan, ...plans];
  savePlans(next);
  return { plans: next, result: { ok: true, message: `已登记 ${plan.toothNo}（${plan.childName}）` } };
}

/** 更新本次监护人（家长常临时换人，每次接诊核对） */
export function updateGuardian(
  plans: TreatmentPlan[],
  id: string,
  patch: Pick<TreatmentPlan, "guardianName" | "guardianRelation" | "guardianPhone">,
): TreatmentPlan[] {
  const next = plans.map((plan) =>
    plan.id === id
      ? {
          ...plan,
          ...patch,
          // 换人后需要重新确认，沿用上一个监护人的确认无效
          guardianConfirmed: false,
        }
      : plan,
  );
  savePlans(next);
  return next;
}

/** 家长确认 / 取消确认 */
export function setGuardianConfirm(
  plans: TreatmentPlan[],
  id: string,
  confirmed: boolean,
  note: string,
): { plans: TreatmentPlan[]; result: ActionResult } {
  const target = plans.find((plan) => plan.id === id);
  if (!target) return { plans, result: { ok: false, message: "记录不存在" } };
  if (confirmed && !target.guardianName.trim()) {
    return { plans, result: { ok: false, message: "请先登记监护人再确认" } };
  }
  const next = plans.map((plan) =>
    plan.id === id
      ? {
          ...plan,
          guardianConfirmed: confirmed,
          confirmNote: confirmed ? note : "",
          history: confirmed
            ? [...plan.history, { at: now(), action: `家长确认（${plan.guardianName}）${note ? `：${note}` : ""}` }]
            : plan.history,
        }
      : plan,
  );
  savePlans(next);
  return { plans: next, result: { ok: confirmed, message: confirmed ? "家长已确认，可以推进" : "已撤回确认" } };
}

/** 前台登记到诊：到诊次数 +1，清零连续爽约与联系名单 */
export function checkIn(
  plans: TreatmentPlan[],
  id: string,
): { plans: TreatmentPlan[]; result: ActionResult } {
  const target = plans.find((plan) => plan.id === id);
  if (!target) return { plans, result: { ok: false, message: "记录不存在" } };
  const check = canCheckIn(target);
  if (!check.ok) return { plans, result: { ok: false, message: check.reason ?? "不能登记到诊" } };

  const wasInContact = reachContactThreshold(target);
  const next = plans.map((plan) => {
    if (plan.id !== id) return plan;
    return {
      ...withHistory(
        plan,
        `到诊 #${plan.attendedVisits + 1} 已登记${wasInContact ? "，移出联系名单" : ""}`,
      ),
      visitOutcome: "attended" as const,
      attendedVisits: plan.attendedVisits + 1,
      consecutiveNoShows: 0,
      contact: null,
    };
  });
  savePlans(next);
  return { plans: next, result: { ok: true, message: `${target.toothNo} 到诊已登记` } };
}

/** 登记本次未到诊；连续两次自动进联系名单（不算完成、不推进） */
export function markNoShow(
  plans: TreatmentPlan[],
  id: string,
): { plans: TreatmentPlan[]; result: ActionResult } {
  const target = plans.find((plan) => plan.id === id);
  if (!target) return { plans, result: { ok: false, message: "记录不存在" } };
  if (target.stage === "done") return { plans, result: { ok: false, message: "计划已完成" } };
  if (isEmergencyActive(target.emergency)) {
    return { plans, result: { ok: false, message: "急诊冻结中，不登记爽约" } };
  }

  const next = plans.map((plan) => {
    if (plan.id !== id) return plan;
    const consecutiveNoShows = plan.consecutiveNoShows + 1;
    const entered = consecutiveNoShows >= 2 && !reachContactThreshold(plan);
    return {
      ...withHistory(
        plan,
        `未到诊 #${consecutiveNoShows}（连续 ${consecutiveNoShows} 次）${entered ? "，进入联系名单" : ""}`,
      ),
      visitOutcome: "noshow" as const,
      consecutiveNoShows,
      contact: entered
        ? createContactArrangement({
            scheduledAt: new Date().toISOString().slice(0, 16),
          })
        : plan.contact,
    };
  });
  savePlans(next);
  return { plans: next, result: { ok: true, message: "已登记未到诊" } };
}

/** 推进到下一治疗阶段（最后一步为完成）；必须家长确认且本次已到诊 */
export function advanceStage(
  plans: TreatmentPlan[],
  id: string,
): { plans: TreatmentPlan[]; result: ActionResult } {
  const target = plans.find((plan) => plan.id === id);
  if (!target) return { plans, result: { ok: false, message: "记录不存在" } };

  const completion = canComplete(target);
  if (completion.ok) {
    const next = plans.map((plan) =>
      plan.id === id
        ? {
            ...withHistory(plan, "预成冠/修复完成，家长确认，计划完成"),
            stage: "done" as const,
          }
        : plan,
    );
    savePlans(next);
    return { plans: next, result: { ok: true, message: "治疗计划已完成" } };
  }

  const check = canAdvance(target);
  if (!check.ok) return { plans, result: { ok: false, message: check.reason ?? "不能推进" } };
  const following = nextStage(target.stage);
  if (!following) return { plans, result: { ok: false, message: "已在最后阶段" } };

  const next = plans.map((plan) =>
    plan.id === id
      ? {
          ...withHistory(plan, `推进到「${stageLabel(following)}」`),
          stage: following,
          // 每个新的一次复诊需要重新登记到诊、重新请家长确认
          visitOutcome: "pending" as const,
          guardianConfirmed: false,
          confirmNote: "",
        }
      : plan,
  );
  savePlans(next);
  return { plans: next, result: { ok: true, message: `已推进到「${stageLabel(following)}」，下次复诊需重新确认` } };
}

/** 明显疼痛或肿胀：本次转急诊，冻结原计划等待重排 */
export function transferEmergency(
  plans: TreatmentPlan[],
  id: string,
  reason: string,
): { plans: TreatmentPlan[]; result: ActionResult } {
  const target = plans.find((plan) => plan.id === id);
  if (!target) return { plans, result: { ok: false, message: "记录不存在" } };
  if (!reason.trim()) {
    return { plans, result: { ok: false, message: "请填写疼痛/肿胀表现" } };
  }
  if (target.stage === "done") return { plans, result: { ok: false, message: "计划已完成" } };

  const next = plans.map((plan) =>
    plan.id === id
      ? {
          ...withHistory(plan, "明显疼痛/肿胀，本次转急诊，原计划保留待重排"),
          emergency: {
            active: true,
            reason: reason.trim(),
            at: now(),
            resolved: false,
          },
        }
      : plan,
  );
  savePlans(next);
  return { plans: next, result: { ok: true, message: "已转急诊，原计划保留" } };
}

/** 急诊处理结束：原计划解冻，等待重排下次复诊（阶段不变） */
export function resolveEmergency(
  plans: TreatmentPlan[],
  id: string,
): { plans: TreatmentPlan[]; result: ActionResult } {
  const target = plans.find((plan) => plan.id === id);
  if (!target) return { plans, result: { ok: false, message: "记录不存在" } };
  if (!isEmergencyActive(target.emergency)) {
    return { plans, result: { ok: false, message: "没有进行中的急诊" } };
  }
  const next = plans.map((plan) =>
    plan.id === id
      ? {
          ...withHistory(plan, "急诊处理结束，计划解冻，等待重排下次复诊"),
          emergency: { ...plan.emergency, active: false, resolved: true },
          visitOutcome: "pending" as const,
          guardianConfirmed: false,
          confirmNote: "",
        }
      : plan,
  );
  savePlans(next);
  return { plans: next, result: { ok: true, message: "已回台，可重排复诊" } };
}

/** 保存联系名单上的跟进安排 */
export function saveContact(
  plans: TreatmentPlan[],
  id: string,
  arrangement: ContactArrangement,
): { plans: TreatmentPlan[]; result: ActionResult } {
  const target = plans.find((plan) => plan.id === id);
  if (!target) return { plans, result: { ok: false, message: "记录不存在" } };
  if (!reachContactThreshold(target)) {
    return { plans, result: { ok: false, message: "该记录不在联系名单" } };
  }
  const next = plans.map((plan) =>
    plan.id === id
      ? {
          ...withHistory(
            plan,
            `联系安排：${arrangement.method}${arrangement.contactedAt ? "（已联系）" : "（待联系）"}${arrangement.rescheduled ? "，已确认重排" : ""}`,
          ),
          contact: arrangement,
        }
      : plan,
  );
  savePlans(next);
  return { plans: next, result: { ok: true, message: "联系安排已保存" } };
}

export function restoreSamplePlans(): TreatmentPlan[] {
  return resetPlans();
}
