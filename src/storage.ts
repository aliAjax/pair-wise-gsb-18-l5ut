// ===== 记录层：本地持久化 =====
// 重新打开浏览器后，阶段、到诊次数、急诊标记、联系安排都还在。
import { seedPlans } from "./seed";
import type { TreatmentPlan } from "./types";

const STORAGE_KEY = "hxwl-04.primary-teeth-plans.v1";

export function loadPlans(): TreatmentPlan[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedPlans();
    const parsed = JSON.parse(raw) as TreatmentPlan[];
    if (!Array.isArray(parsed)) return seedPlans();
    return parsed;
  } catch {
    return seedPlans();
  }
}

export function savePlans(plans: TreatmentPlan[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // 隐私模式或存储满时静默失败，不影响当前会话操作
  }
}

export function resetPlans(): TreatmentPlan[] {
  const seeds = seedPlans();
  savePlans(seeds);
  return seeds;
}
