// ===== 判断层：乳牙治疗计划业务规则 =====
// 全部是纯函数，只回答"能不能做、处于什么状态"，不改数据、不碰页面。
import type {
  ContactArrangement,
  EmergencyMark,
  PlanStatus,
  StageId,
  TreatmentPlan,
} from "./types";

/** 乳牙根管治疗标准阶段（含完成态） */
export const STAGES: { id: StageId; label: string }[] = [
  { id: "intake", label: "初诊登记" },
  { id: "anesthesia", label: "局麻隔湿" },
  { id: "access", label: "开髓去冠髓" },
  { id: "cleaning", label: "清理冲洗" },
  { id: "medication", label: "根管封药" },
  { id: "filling", label: "根管充填" },
  { id: "crown", label: "预成冠修复" },
  { id: "done", label: "计划完成" },
];

export const STAGE_INDEX: Record<StageId, number> = STAGES.reduce(
  (acc, stage, index) => ({ ...acc, [stage.id]: index }),
  {} as Record<StageId, number>,
);

export const stageLabel = (stage: StageId): string =>
  STAGES.find((item) => item.id === stage)?.label ?? stage;

export function nextStage(stage: StageId): StageId | null {
  const index = STAGE_INDEX[stage];
  return index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1].id : null;
}

export interface CheckResult {
  ok: boolean;
  reason?: string;
}

/** 进入联系名单的阈值：连续两次未到诊 */
export const NO_SHOW_LIMIT = 2;

export function reachContactThreshold(plan: TreatmentPlan): boolean {
  return plan.consecutiveNoShows >= NO_SHOW_LIMIT;
}

/** 急诊是否生效中：已登记且尚未处理完回台 */
export function isEmergencyActive(emergency: EmergencyMark): boolean {
  return emergency.active && !emergency.resolved;
}

/** 家长确认是否齐备：本次监护人姓名必填且已勾选确认 */
export function isGuardianConfirmed(plan: TreatmentPlan): CheckResult {
  if (!plan.guardianName.trim()) {
    return { ok: false, reason: "请先登记本次陪同监护人" };
  }
  if (!plan.guardianConfirmed) {
    return { ok: false, reason: "家长尚未确认，不能推进下一步" };
  }
  return { ok: true };
}

/**
 * 能否推进到下一治疗阶段：
 * 1. 本次已实际到诊；2. 家长已确认；3. 不存在未处理完的急诊；4. 不在联系名单待跟进状态。
 */
export function canAdvance(plan: TreatmentPlan): CheckResult {
  if (plan.stage === "done") return { ok: false, reason: "计划已完成" };
  if (isEmergencyActive(plan.emergency)) {
    return { ok: false, reason: "本次已转急诊，原计划保留，待急诊后重排" };
  }
  if (reachContactThreshold(plan)) {
    return { ok: false, reason: "连续两次未到诊，需先完成联系并重排" };
  }
  if (plan.visitOutcome !== "attended") {
    return { ok: false, reason: "本次到诊未登记，请前台先勾到诊" };
  }
  const confirm = isGuardianConfirmed(plan);
  if (!confirm.ok) return confirm;
  return { ok: true };
}

/**
 * 能否标记计划完成：走完最后一个治疗阶段（预成冠修复），
 * 且完成同样要求本次到诊 + 家长确认；未到诊绝不允许算完成。
 */
export function canComplete(plan: TreatmentPlan): CheckResult {
  if (plan.stage === "done") return { ok: false, reason: "计划已完成" };
  if (plan.stage !== "crown") {
    return { ok: false, reason: "尚未完成预成冠/修复阶段" };
  }
  if (plan.consecutiveNoShows > 0) {
    return { ok: false, reason: "存在未处理的爽约记录，不能直接算完成" };
  }
  if (plan.visitOutcome !== "attended") {
    return { ok: false, reason: "未到诊不能算完成" };
  }
  return isGuardianConfirmed(plan);
}

/** 能否登记到诊：急诊冻结期间不接诊（须先走急诊重排流程） */
export function canCheckIn(plan: TreatmentPlan): CheckResult {
  if (plan.stage === "done") return { ok: false, reason: "计划已完成" };
  if (isEmergencyActive(plan.emergency)) {
    return { ok: false, reason: "急诊处理中，回台重排后再登记到诊" };
  }
  if (plan.visitOutcome === "attended") {
    return { ok: false, reason: "本次到诊已登记" };
  }
  return { ok: true };
}

/** 派生看板状态（优先级：急诊 > 联系名单 > 完成 > 进行中） */
export function deriveStatus(plan: TreatmentPlan): PlanStatus {
  if (isEmergencyActive(plan.emergency)) return "emergency";
  if (plan.stage === "done") return "done";
  if (reachContactThreshold(plan)) return "contact";
  return "active";
}

export const STATUS_LABEL: Record<PlanStatus, string> = {
  emergency: "转急诊",
  contact: "联系名单",
  active: "治疗中",
  done: "已完成",
};

/** 阶段进度百分比，用于进度条 */
export function stageProgress(stage: StageId): number {
  return Math.round((STAGE_INDEX[stage] / (STAGES.length - 1)) * 100);
}

/** 新建联系名单跟进项的默认值 */
export function createContactArrangement(
  patch: Partial<ContactArrangement>,
): ContactArrangement {
  return {
    method: "电话",
    note: "",
    scheduledAt: new Date().toISOString().slice(0, 16),
    contactedAt: null,
    rescheduled: false,
 ...patch,
  };
}
