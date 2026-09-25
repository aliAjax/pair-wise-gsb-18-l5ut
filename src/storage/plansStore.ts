import { buildSeedPlans } from "../domain/rules";
import type { ToothPlan } from "../domain/types";

// 记录层：本地持久化。只管读写牙位计划，不判断业务规则。
// 重新打开页面后，治疗阶段、到诊/未到次数、联系名单与急诊状态都从这里恢复。

const STORAGE_KEY = "hxwl-04.primary-tooth-plans.v1";

function isValidPlan(value: unknown): value is ToothPlan {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.toothCode === "string" &&
    typeof p.childName === "string" &&
    typeof p.stage === "string" &&
    Array.isArray(p.history)
  );
}

export function loadPlans(): ToothPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const plans = parsed.filter(isValidPlan);
        if (plans.length > 0) return plans;
      }
    }
  } catch {
    // 存储损坏或不可用时退回示例数据
  }
  const seed = buildSeedPlans();
  savePlans(seed);
  return seed;
}

export function savePlans(plans: ToothPlan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // 隐私模式等场景写不进时静默降级（规则层状态在本次会话内仍可用）
  }
}

export function resetPlans(): ToothPlan[] {
  const seed = buildSeedPlans();
  savePlans(seed);
  return seed;
}
