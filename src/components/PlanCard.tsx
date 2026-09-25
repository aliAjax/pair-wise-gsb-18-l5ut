// ===== 页面层：单个牙位治疗计划卡片 =====
import { useEffect, useState } from "react";
import {
  STAGES,
  STATUS_LABEL,
  canAdvance,
  canCheckIn,
  canComplete,
  deriveStatus,
  isEmergencyActive,
  reachContactThreshold,
  stageLabel,
  stageProgress,
} from "../rules";
import type {
  ContactArrangement,
  NewPlanInput,
  TreatmentPlan,
} from "../types";
import { formatTime, nowLocalInput } from "./format";

interface Props {
  plan: TreatmentPlan;
  onGuardianChange: (id: string, patch: Pick<TreatmentPlan, "guardianName" | "guardianRelation" | "guardianPhone">) => void;
  onConfirm: (id: string, confirmed: boolean, note: string) => void;
  onCheckIn: (id: string) => void;
  onNoShow: (id: string) => void;
  onAdvance: (id: string) => void;
  onEmergency: (id: string, reason: string) => void;
  onResolveEmergency: (id: string) => void;
  onSaveContact: (id: string, arrangement: ContactArrangement) => void;
}

const VISIT_LABEL: Record<TreatmentPlan["visitOutcome"], string> = {
  pending: "本次未接诊",
  attended: "本次已到诊",
  noshow: "本次未到诊",
};

export function PlanCard({
  plan,
  onGuardianChange,
  onConfirm,
  onCheckIn,
  onNoShow,
  onAdvance,
  onEmergency,
  onResolveEmergency,
  onSaveContact,
}: Props) {
  const status = deriveStatus(plan);
  const emergencyOn = isEmergencyActive(plan.emergency);
  const inContact = reachContactThreshold(plan);
  const isDone = plan.stage === "done";
  const currentStageIndex = STAGES.findIndex((item) => item.id === plan.stage);

  const advanceCheck = canAdvance(plan);
  const completeCheck = canComplete(plan);
  const checkInCheck = canCheckIn(plan);
  const advanceAllowed = advanceCheck.ok || completeCheck.ok;
  const advanceHint = !advanceAllowed ? completeCheck.reason ?? advanceCheck.reason : undefined;

  // 监护人临时更换：本地编辑，失焦/按钮统一保存
  const [guardianDraft, setGuardianDraft] = useState<
    Pick<NewPlanInput, "guardianName" | "guardianRelation" | "guardianPhone">
  >({
    guardianName: plan.guardianName,
    guardianRelation: plan.guardianRelation,
    guardianPhone: plan.guardianPhone,
  });
  useEffect(() => {
    setGuardianDraft({
      guardianName: plan.guardianName,
      guardianRelation: plan.guardianRelation,
      guardianPhone: plan.guardianPhone,
    });
  }, [plan.guardianName, plan.guardianRelation, plan.guardianPhone]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmNote, setConfirmNote] = useState(plan.confirmNote);
  useEffect(() => setConfirmNote(plan.confirmNote), [plan.confirmNote]);

  const [emergencyOpen, setEmergencyOpen] = useState(emergencyOn);
  useEffect(() => setEmergencyOpen(emergencyOn), [emergencyOn]);
  const [emergencyReason, setEmergencyReason] = useState(
    "患儿诉明显疼痛，伴牙龈肿胀",
  );

  const [contactDraft, setContactDraft] = useState<ContactArrangement>(
    plan.contact ?? {
      method: "电话",
      note: "",
      scheduledAt: nowLocalInput(),
      contactedAt: null,
      rescheduled: false,
    },
  );
  useEffect(() => {
    if (plan.contact) setContactDraft(plan.contact);
  }, [plan.contact]);

  const commitGuardian = () =>
    onGuardianChange(plan.id, guardianDraft);

  return (
    <article className={`plan-card status-${status}`}>
      <header className="plan-head">
        <div>
          <div className="plan-title-row">
            <h3>{plan.toothNo}</h3>
            <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
          </div>
          <p className="plan-patient">
            {plan.childName} · {plan.age} 岁 · {plan.diagnosis || "诊断待补"}
          </p>
        </div>
        <div className="visit-count">
          <strong>
            {plan.attendedVisits}/{plan.plannedVisits}
          </strong>
          <span>到诊/预计</span>
        </div>
      </header>

      {/* 阶段条 */}
      <div className="stage-track">
        <div className="stage-meta">
          <span>
            当前阶段：<strong>{stageLabel(plan.stage)}</strong>
          </span>
          <span>{stageProgress(plan.stage)}%</span>
        </div>
        <div className="stage-bar">
          <i style={{ width: `${stageProgress(plan.stage)}%` }} />
        </div>
        <ol className="stage-steps">
          {STAGES.map((stage) => (
            <li
              key={stage.id}
              className={
                stage.id === plan.stage
                  ? "current"
                  : currentStageIndex >
                      STAGES.findIndex((item) => item.id === stage.id)
                    ? "passed"
                    : ""
              }
              title={stage.label}
            >
              {stage.label}
            </li>
          ))}
        </ol>
      </div>

      {/* 本次到诊 + 监护人 */}
      <div className="plan-grid">
        <div className="sub-block">
          <h4>本次到诊（前台核对）</h4>
          <p className={`visit-outcome outcome-${plan.visitOutcome}`}>
            {VISIT_LABEL[plan.visitOutcome]}
            {plan.consecutiveNoShows > 0 && (
              <em> · 连续未到 {plan.consecutiveNoShows} 次</em>
            )}
          </p>
          <div className="btn-row">
            <button
              disabled={!checkInCheck.ok}
              title={checkInCheck.reason}
              onClick={() => onCheckIn(plan.id)}
            >
              登记到诊
            </button>
            <button
              className="warn-btn"
              disabled={isDone || emergencyOn}
              onClick={() => onNoShow(plan.id)}
            >
              登记未到诊
            </button>
          </div>
        </div>

        <div className="sub-block">
          <h4>本次监护人（换人须重填）</h4>
          <div className="guardian-fields">
            <input
              aria-label="本次监护人姓名"
              placeholder="陪同人姓名"
              value={guardianDraft.guardianName}
              onChange={(event) =>
                setGuardianDraft({ ...guardianDraft, guardianName: event.target.value })
              }
              onBlur={commitGuardian}
            />
            <input
              aria-label="与患儿关系"
              placeholder="关系"
              value={guardianDraft.guardianRelation}
              onChange={(event) =>
                setGuardianDraft({ ...guardianDraft, guardianRelation: event.target.value })
              }
              onBlur={commitGuardian}
            />
            <input
              aria-label="监护人电话"
              placeholder="电话"
              value={guardianDraft.guardianPhone}
              onChange={(event) =>
                setGuardianDraft({ ...guardianDraft, guardianPhone: event.target.value })
              }
              onBlur={commitGuardian}
            />
          </div>
          <div className="confirm-row">
            {plan.guardianConfirmed ? (
              <>
                <span className="confirmed">✓ 家长已确认{plan.confirmNote ? `：${plan.confirmNote}` : ""}</span>
                <button className="link-btn" onClick={() => onConfirm(plan.id, false, "")}>
                  撤回确认
                </button>
              </>
            ) : (
              <button className="accent-btn" onClick={() => setConfirmOpen((v) => !v)}>
                家长确认
              </button>
            )}
          </div>
          {confirmOpen && !plan.guardianConfirmed && (
            <div className="inline-form">
              <input
                placeholder="确认备注（如：同意封药方案）"
                value={confirmNote}
                onChange={(event) => setConfirmNote(event.target.value)}
              />
              <div className="btn-row">
                <button
                  className="primary-action"
                  onClick={() => {
                    onConfirm(plan.id, true, confirmNote);
                    setConfirmOpen(false);
                  }}
                >
                  确认无误
                </button>
                <button onClick={() => setConfirmOpen(false)}>取消</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 推进 */}
      <div className="sub-block action-block">
        <div>
          <h4>治疗推进</h4>
          {!advanceAllowed && <p className="block-hint">{advanceHint}</p>}
        </div>
        <button
          className="primary-action"
          disabled={!advanceAllowed || emergencyOn}
          title={advanceHint}
          onClick={() => onAdvance(plan.id)}
        >
          {completeCheck.ok ? "家长确认后完成计划" : "家长确认后推进下一步"}
        </button>
      </div>

      {/* 急诊 */}
      <div className="sub-block emergency-block">
        <div className="emergency-head">
          <h4>明显疼痛 / 肿胀</h4>
          {!emergencyOn && !isDone && (
            <button className="danger-btn" onClick={() => setEmergencyOpen((v) => !v)}>
              本次转急诊
            </button>
          )}
        </div>
        {emergencyOn && (
          <div className="emergency-panel">
            <p className="emergency-reason">⚡ {plan.emergency.reason}</p>
            <p className="block-hint">
              登记于 {formatTime(plan.emergency.at)}。原计划保留在「{stageLabel(plan.stage)}
              」，急诊处理结束、重排复诊后解冻。
            </p>
            <button className="primary-action" onClick={() => onResolveEmergency(plan.id)}>
              急诊结束 · 回台等待重排
            </button>
          </div>
        )}
        {emergencyOpen && !emergencyOn && (
          <div className="inline-form">
            <input
              placeholder="疼痛/肿胀表现"
              value={emergencyReason}
              onChange={(event) => setEmergencyReason(event.target.value)}
            />
            <div className="btn-row">
              <button
                className="danger-btn"
                onClick={() => {
                  onEmergency(plan.id, emergencyReason);
                  setEmergencyOpen(false);
                }}
              >
                确认转急诊
              </button>
              <button onClick={() => setEmergencyOpen(false)}>取消</button>
            </div>
          </div>
        )}
      </div>

      {/* 联系名单 */}
      {inContact && (
        <div className="sub-block contact-block">
          <h4>联系名单（连续两次未到诊，不计完成）</h4>
          <div className="contact-fields">
            <label>
              <span>联系方式</span>
              <select
                value={contactDraft.method}
                onChange={(event) => setContactDraft({ ...contactDraft, method: event.target.value })}
              >
                <option>电话</option>
                <option>短信</option>
                <option>微信</option>
                <option>其他家属转告</option>
              </select>
            </label>
            <label>
              <span>计划联系时间</span>
              <input
                type="datetime-local"
                value={contactDraft.scheduledAt}
                onChange={(event) =>
                  setContactDraft({ ...contactDraft, scheduledAt: event.target.value })
                }
              />
            </label>
            <label>
              <span>实际联系时间</span>
              <input
                type="datetime-local"
                value={contactDraft.contactedAt ?? ""}
                onChange={(event) =>
                  setContactDraft({
                    ...contactDraft,
                    contactedAt: event.target.value || null,
                  })
                }
              />
            </label>
            <label className="contact-note">
              <span>跟进记录</span>
              <input
                placeholder="联系情况、改约时间、新陪同人"
                value={contactDraft.note}
                onChange={(event) => setContactDraft({ ...contactDraft, note: event.target.value })}
              />
            </label>
          </div>
          <label className="reschedule-check">
            <input
              type="checkbox"
              checked={contactDraft.rescheduled}
              onChange={(event) =>
                setContactDraft({ ...contactDraft, rescheduled: event.target.checked })
              }
            />
            已联系并确认重排（仍需下次实际到诊后才移出名单）
          </label>
          <div className="btn-row">
            <button className="primary-action" onClick={() => onSaveContact(plan.id, contactDraft)}>
              保存联系安排
            </button>
          </div>
        </div>
      )}

      {/* 操作历史 */}
      <details className="history-box">
        <summary>操作记录（{plan.history.length}）</summary>
        <ol>
          {[...plan.history].reverse().map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <time>{formatTime(entry.at)}</time>
              <span>{entry.action}</span>
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}
