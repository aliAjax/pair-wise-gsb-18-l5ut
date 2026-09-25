import { useCallback, useMemo, useState } from "react";
import {
  advanceStage,
  checkIn,
  confirmGuardian,
  createPlan,
  divertEmergency,
  logContact,
  markNoShow,
  rescheduleAfterEmergency,
  RuleError,
  summarize,
  type ContactInput,
  type EmergencyInput,
  type GuardianInput,
  type NewPlanInput,
} from "../domain/rules";
import type { ToothPlan } from "../domain/types";
import { loadPlans, resetPlans, savePlans } from "../storage/plansStore";

// 页面与判断层之间的桥接：所有操作都走规则函数，结果统一落盘，错误以消息形式返回给页面。

export interface Notice {
  type: "ok" | "error";
  text: string;
}

export function usePlans() {
  const [plans, setPlans] = useState<ToothPlan[]>(() => loadPlans());
  const [notice, setNotice] = useState<Notice | null>(null);

  const persist = useCallback((next: ToothPlan[]) => {
    setPlans(next);
    savePlans(next);
  }, []);

  /** 在单份计划上套用规则函数；成功返回 true，规则不允许时弹错并返回 false */
  const applyTo = useCallback(
    (id: string, fn: (plan: ToothPlan) => ToothPlan, okText: string) => {
      let ok = false;
      setPlans((prev) => {
        const target = prev.find((p) => p.id === id);
        if (!target) return prev;
        try {
          const updated = fn(target);
          ok = true;
          setNotice({ type: "ok", text: okText });
          const next = prev.map((p) => (p.id === id ? updated : p));
          savePlans(next);
          return next;
        } catch (err) {
          const text =
            err instanceof RuleError
              ? err.message
              : "操作失败，请检查输入";
          setNotice({ type: "error", text });
          return prev;
        }
      });
      return ok;
    },
    []
  );

  const addPlan = useCallback(
    (input: NewPlanInput): boolean => {
      try {
        const plan = createPlan(input);
        const next = [plan, ...plans];
        persist(next);
        setNotice({ type: "ok", text: `已为 ${plan.childName} 的 ${plan.toothCode} 牙建立治疗计划` });
        return true;
      } catch (err) {
        setNotice({
          type: "error",
          text: err instanceof RuleError ? err.message : "建档失败",
        });
        return false;
      }
    },
    [plans, persist]
  );

  const removePlan = useCallback(
    (id: string) => {
      persist(plans.filter((p) => p.id !== id));
      setNotice({ type: "ok", text: "已删除该牙位计划" });
    },
    [plans, persist]
  );

  const restoreDemo = useCallback(() => {
    persist(resetPlans());
    setNotice({ type: "ok", text: "已恢复示例记录" });
  }, [persist]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const actions = useMemo(
    () => ({
      checkIn: (id: string) =>
        applyTo(id, checkIn, "已登记本次到诊"),
      markNoShow: (id: string) =>
        applyTo(id, markNoShow, "已记录本次未到诊"),
      confirmGuardian: (id: string, guardian: GuardianInput) =>
        applyTo(id, (p) => confirmGuardian(p, guardian), "监护人已确认，可以推进下一步"),
      advance: (id: string) =>
        applyTo(id, advanceStage, "已推进到下一治疗阶段"),
      divertEmergency: (id: string, input: EmergencyInput) =>
        applyTo(id, (p) => divertEmergency(p, input), "本次已安排转急诊，原计划保留等待重排"),
      reschedule: (id: string) =>
        applyTo(id, rescheduleAfterEmergency, "急诊处理结束，原计划已重新排入复诊"),
      logContact: (id: string, input: ContactInput) =>
        applyTo(id, (p) => logContact(p, input), "已保存联系跟进记录"),
    }),
    [applyTo]
  );

  return {
    plans,
    summary: summarize(plans),
    notice,
    dismissNotice,
    addPlan,
    removePlan,
    restoreDemo,
    actions,
  };
}
