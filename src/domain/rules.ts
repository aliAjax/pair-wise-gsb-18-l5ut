import type {
  ContactLogEntry,
  EmergencyState,
  HistoryEntry,
  StageId,
  ToothPlan,
} from "./types";

// 判断层：纯函数业务规则。不读 localStorage、不碰 React，只做“能不能做、做了变成什么”。

export const STAGES: { id: StageId; label: string }[] = [
  { id: "access", label: "开髓拔髓" },
  { id: "medicament", label: "封药消毒" },
  { id: "obturation", label: "根管充填" },
  { id: "done", label: "治疗完成" },
];

export const STAGE_LABELS: Record<StageId, string> = {
  access: "开髓拔髓",
  medicament: "封药消毒",
  obturation: "根管充填",
  done: "治疗完成",
};

export const CONTACT_CHANNELS = ["电话", "微信", "短信"];
export const EMERGENCY_REASONS = ["明显疼痛", "肿胀"];
export const GUARDIAN_RELATIONS = ["父亲", "母亲", "祖辈", "其他监护人"];

export function stageIndex(stage: StageId): number {
  return STAGES.findIndex((s) => s.id === stage);
}

export function nextStage(stage: StageId): StageId | null {
  const i = stageIndex(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1].id : null;
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clone(plan: ToothPlan): ToothPlan {
  return JSON.parse(JSON.stringify(plan)) as ToothPlan;
}

function touch(plan: ToothPlan): ToothPlan {
  plan.updatedAt = new Date().toISOString();
  return plan;
}

function history(plan: ToothPlan, text: string): void {
  const entry: HistoryEntry = { date: today(), text };
  plan.history.unshift(entry);
}

export class RuleError extends Error {}

// ---------- 建档 ----------

export interface NewPlanInput {
  toothCode: string;
  childName: string;
  diagnosis: string;
  plannedVisits: number;
}

export function createPlan(input: NewPlanInput): ToothPlan {
  if (!input.toothCode.trim()) throw new RuleError("请填写牙位");
  if (!input.childName.trim()) throw new RuleError("请填写患儿姓名");
  if (!input.diagnosis.trim()) throw new RuleError("请填写诊断");
  const visits = Math.round(Number(input.plannedVisits));
  if (!Number.isFinite(visits) || visits < 1 || visits > 8) {
    throw new RuleError("预计次数需为 1–8 次");
  }
  const now = new Date().toISOString();
  return {
    id: uid(),
    toothCode: input.toothCode.trim(),
    childName: input.childName.trim(),
    diagnosis: input.diagnosis.trim(),
    stage: "access",
    plannedVisits: visits,
    attendedCount: 0,
    consecutiveNoShows: 0,
    visitCheckedIn: false,
    guardianName: "",
    guardianRelation: "",
    guardianPhone: "",
    guardianConfirmed: false,
    emergency: null,
    contactListed: false,
    contactLogs: [],
    completed: false,
    history: [{ date: today(), text: "建立乳牙治疗计划" }],
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- 本次就诊：前台到诊登记 ----------

/** 前台登记到诊：漏记到诊会直接影响后续判断，因此到诊必须显式登记 */
export function checkIn(plan: ToothPlan): ToothPlan {
  const p = touch(clone(plan));
  if (p.completed) throw new RuleError("该计划已完成，无需登记到诊");
  if (p.emergency?.active)
    throw new RuleError("本次已转急诊，重排后再登记到诊");
  if (p.visitCheckedIn) throw new RuleError("本次到诊已登记，请勿重复登记");
  p.visitCheckedIn = true;
  p.attendedCount += 1;
  p.consecutiveNoShows = 0; // 到诊即打断连续未到
  history(p, `前台登记到诊，累计到诊 ${p.attendedCount} 次`);
  return p;
}

/** 标记本次未到诊（前台确认失约） */
export function markNoShow(plan: ToothPlan): ToothPlan {
  const p = touch(clone(plan));
  if (p.completed) throw new RuleError("该计划已完成");
  if (p.visitCheckedIn)
    throw new RuleError("本次已登记到诊，不能再标记未到");
  p.consecutiveNoShows += 1;
  if (p.consecutiveNoShows >= 2) {
    p.contactListed = true;
    history(
      p,
      `本次未到诊，已连续 ${p.consecutiveNoShows} 次，进入联系名单`
    );
  } else {
    history(p, `本次未到诊，连续未到 ${p.consecutiveNoShows} 次`);
  }
  return p;
}

// ---------- 本次监护人：临时换人，先确认再推进 ----------

export interface GuardianInput {
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
}

/** 家长（本次监护人）确认本次治疗安排；确认后才允许推进阶段 */
export function confirmGuardian(
  plan: ToothPlan,
  guardian: GuardianInput
): ToothPlan {
  const p = touch(clone(plan));
  if (p.completed) throw new RuleError("该计划已完成");
  if (p.emergency?.active)
    throw new RuleError("本次已转急诊，等待重排后再确认");
  if (!p.visitCheckedIn)
    throw new RuleError("请先由前台登记本次到诊，再做监护人确认");
  if (!guardian.guardianName.trim())
    throw new RuleError("请填写本次监护人姓名");
  if (!guardian.guardianRelation.trim())
    throw new RuleError("请选择与患儿关系");
  if (!guardian.guardianPhone.trim())
    throw new RuleError("请填写监护人联系电话");

  const changed =
    p.guardianName !== guardian.guardianName.trim() ||
    p.guardianRelation !== guardian.guardianRelation ||
    p.guardianPhone !== guardian.guardianPhone.trim();

  p.guardianName = guardian.guardianName.trim();
  p.guardianRelation = guardian.guardianRelation;
  p.guardianPhone = guardian.guardianPhone.trim();
  p.guardianConfirmed = true;
  history(
    p,
    `本次监护人${changed ? "变更为" : ""}${p.guardianRelation}${p.guardianName}，已确认治疗安排`
  );
  return p;
}

// ---------- 阶段推进 ----------

export function canAdvance(
  plan: ToothPlan
): { ok: boolean; reason?: string } {
  if (plan.completed) return { ok: false, reason: "计划已完成" };
  if (plan.emergency?.active)
    return { ok: false, reason: "本次已转急诊，原计划等待重排" };
  if (!plan.visitCheckedIn)
    return { ok: false, reason: "本次尚未登记到诊" };
  if (!plan.guardianConfirmed)
    return { ok: false, reason: "本次监护人尚未确认" };
  if (plan.contactListed)
    return { ok: false, reason: "在联系名单中，需联系跟进后再推进" };
  if (nextStage(plan.stage) === null)
    return { ok: false, reason: "已在最后阶段" };
  return { ok: true };
}

/** 完成当前阶段、进入下一阶段；完成时重置本次就诊标记，等待下次复诊 */
export function advanceStage(plan: ToothPlan): ToothPlan {
  const guard = canAdvance(plan);
  if (!guard.ok) throw new RuleError(guard.reason);
  const p = touch(clone(plan));
  const target = nextStage(p.stage)!;
  const isDone = target === "done";
  p.stage = target;
  if (isDone) {
    p.completed = true;
    p.completedAt = today();
    p.contactListed = false;
    history(
      p,
      `${STAGE_LABELS[target]}，乳牙治疗计划完成（共到诊 ${p.attendedCount}/${p.plannedVisits} 次）`
    );
  } else {
    history(p, `完成「${STAGE_LABELS[plan.stage]}」，进入「${STAGE_LABELS[target]}」`);
  }
  // 本次就诊结束：下次复诊需重新登记到诊、重新确认监护人（可能换人）
  p.visitCheckedIn = false;
  p.guardianConfirmed = false;
  return p;
}

// ---------- 急诊：本次转急诊，原计划保留等待重排 ----------

export interface EmergencyInput {
  reasons: string[]; // 明显疼痛 / 肿胀
  note: string;
}

/** 出现明显疼痛或肿胀：本次安排转急诊，治疗阶段与次数原样保留 */
export function divertEmergency(
  plan: ToothPlan,
  input: EmergencyInput
): ToothPlan {
  const p = touch(clone(plan));
  if (p.completed) throw new RuleError("计划已完成，无需转急诊");
  if (p.emergency?.active) throw new RuleError("已在急诊转介中");
  const reasons = input.reasons.filter(Boolean);
  if (reasons.length === 0)
    throw new RuleError("请勾选急诊原因（明显疼痛 / 肿胀）");

  const emergency: EmergencyState = {
    active: true,
    reasons,
    since: today(),
    note: input.note.trim(),
  };
  p.emergency = emergency;
  // 本次就诊中断：已登记的到诊保留，但确认作废、下次重排需重新确认
  p.guardianConfirmed = false;
  history(p, `出现${reasons.join("、")}，本次安排转急诊，原计划保留等待重排`);
  return p;
}

/** 急诊处理结束、重新安排治疗：解除急诊占用，阶段与已到诊次数不变 */
export function rescheduleAfterEmergency(plan: ToothPlan): ToothPlan {
  const p = touch(clone(plan));
  if (!p.emergency?.active)
    throw new RuleError("当前没有进行中的急诊转介");
  const reasons = p.emergency.reasons.join("、");
  p.emergency = null;
  p.visitCheckedIn = false;
  p.guardianConfirmed = false;
  history(p, `急诊（${reasons}）处理结束，原计划重新排入复诊，阶段与次数不变`);
  return p;
}

// ---------- 联系名单：连续两次未到，不能直接算完成 ----------

export interface ContactInput {
  channel: string;
  note: string;
  nextContactDate?: string;
}

export function logContact(plan: ToothPlan, input: ContactInput): ToothPlan {
  const p = touch(clone(plan));
  if (!input.channel.trim()) throw new RuleError("请选择联系方式");
  if (!input.note.trim()) throw new RuleError("请填写联系内容");
  const log: ContactLogEntry = {
    date: today(),
    channel: input.channel,
    note: input.note.trim(),
    nextContactDate: input.nextContactDate || undefined,
  };
  p.contactLogs.unshift(log);
  p.contactListed = true;
  p.nextContactDate = log.nextContactDate;
  history(
    p,
    `联系名单跟进（${log.channel}）：${log.note}${
      log.nextContactDate ? `，下次联系 ${log.nextContactDate}` : ""
    }`
  );
  return p;
}

// ---------- 看板汇总 ----------

export interface BoardSummary {
  total: number;
  active: number;
  completed: number;
  emergency: number;
  contactList: number;
  attendedTotal: number;
  plannedTotal: number;
}

export function summarize(plans: ToothPlan[]): BoardSummary {
  return {
    total: plans.length,
    active: plans.filter((p) => !p.completed).length,
    completed: plans.filter((p) => p.completed).length,
    emergency: plans.filter((p) => p.emergency?.active).length,
    contactList: plans.filter((p) => p.contactListed && !p.completed).length,
    attendedTotal: plans.reduce((sum, p) => sum + p.attendedCount, 0),
    plannedTotal: plans.reduce((sum, p) => sum + p.plannedVisits, 0),
  };
}

// ---------- 示例记录（演示用） ----------

function seedPlan(partial: Partial<ToothPlan> & Pick<ToothPlan, "toothCode" | "childName" | "diagnosis">): ToothPlan {
  const base = createPlan({
    toothCode: partial.toothCode,
    childName: partial.childName,
    diagnosis: partial.diagnosis,
    plannedVisits: partial.plannedVisits ?? 3,
  });
  return Object.assign(base, partial, { id: base.id }) as ToothPlan;
}

export function buildSeedPlans(): ToothPlan[] {
  const seeds: ToothPlan[] = [];

  // 01 急性牙髓炎：开髓拔髓已完成，等待第二次到诊做封药
  let p = seedPlan({
    toothCode: "74",
    childName: "李小满",
    diagnosis: "急性牙髓炎",
    plannedVisits: 3,
  });
  p = checkIn(p);
  p = confirmGuardian(p, {
    guardianName: "李婷",
    guardianRelation: "母亲",
    guardianPhone: "138****2041",
  });
  p = advanceStage(p);
  p.history.unshift({ date: today(), text: "已约下次复诊：封药消毒" });
  seeds.push(p);

  // 02 慢性根尖周炎：第一次就诊已完成；本次已到诊，但监护人临时换成外婆，待确认后才能推进
  p = seedPlan({
    toothCode: "84",
    childName: "周子航",
    diagnosis: "慢性根尖周炎",
    plannedVisits: 3,
  });
  p = checkIn(p);
  p = confirmGuardian(p, {
    guardianName: "周敏",
    guardianRelation: "母亲",
    guardianPhone: "137****5521",
  });
  p = advanceStage(p);
  p = checkIn(p);
  p.history.unshift({ date: today(), text: "本次陪同人变更：由外婆代为就诊，等待确认" });
  seeds.push(p);

  // 03 牙髓坏死：连续两次未到，已进联系名单（不能直接算完成）
  p = seedPlan({
    toothCode: "55",
    childName: "陈一一",
    diagnosis: "牙髓坏死",
    plannedVisits: 3,
    stage: "medicament",
    attendedCount: 1,
  });
  p = markNoShow(p);
  p = markNoShow(p);
  p = logContact(p, {
    channel: "电话",
    note: "家长工作忙忘复诊，已提醒尽快重排",
    nextContactDate: today(),
  });
  seeds.push(p);

  // 04 肿胀：本次转急诊，原计划保留等待重排
  p = seedPlan({
    toothCode: "64",
    childName: "王朵朵",
    diagnosis: "急性根尖周炎伴面部肿胀",
    plannedVisits: 4,
    stage: "medicament",
    attendedCount: 1,
  });
  p = divertEmergency(p, {
    reasons: ["明显疼痛", "肿胀"],
    note: "牙龈脓包伴右侧面部肿胀，转急诊开髓引流",
  });
  seeds.push(p);

  // 05 已完成：开髓 → 封药 → 充填，三次到诊
  p = seedPlan({
    toothCode: "75",
    childName: "赵小天",
    diagnosis: "深龋近髓",
    plannedVisits: 3,
  });
  p = checkIn(p);
  p = confirmGuardian(p, {
    guardianName: "赵磊",
    guardianRelation: "父亲",
    guardianPhone: "139****8810",
  });
  p = advanceStage(p);
  p = checkIn(p);
  p = confirmGuardian(p, {
    guardianName: "赵磊",
    guardianRelation: "父亲",
    guardianPhone: "139****8810",
  });
  p = advanceStage(p);
  p = checkIn(p);
  p = confirmGuardian(p, {
    guardianName: "赵磊",
    guardianRelation: "父亲",
    guardianPhone: "139****8810",
  });
  p = advanceStage(p);
  seeds.push(p);

  return seeds;
}
