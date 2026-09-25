import { useState } from "react";
import {
  canAdvance,
  CONTACT_CHANNELS,
  EMERGENCY_REASONS,
  GUARDIAN_RELATIONS,
  STAGES,
  stageIndex,
  STAGE_LABELS,
  type ContactInput,
  type EmergencyInput,
} from "../domain/rules";
import type { ToothPlan } from "../domain/types";

// 页面层：单个牙位计划卡。只负责采集输入和展示；所有“能不能做”的判断来自 rules.ts。

export interface PlanActions {
  checkIn: (id: string) => boolean;
  markNoShow: (id: string) => boolean;
  confirmGuardian: (id: string, guardian: {
    guardianName: string;
    guardianRelation: string;
    guardianPhone: string;
  }) => boolean;
  advance: (id: string) => boolean;
  divertEmergency: (id: string, input: EmergencyInput) => boolean;
  reschedule: (id: string) => boolean;
  logContact: (id: string, input: ContactInput) => boolean;
}

export default function PlanCard({
  plan,
  actions,
  onRemove,
}: {
  plan: ToothPlan;
  actions: PlanActions;
  onRemove: (id: string) => void;
}) {
  // 本次监护人信息（家长可能临时换人，默认带入上次信息，到诊后可改）
  const [guardianName, setGuardianName] = useState(plan.guardianName);
  const [guardianRelation, setGuardianRelation] = useState(plan.guardianRelation);
  const [guardianPhone, setGuardianPhone] = useState(plan.guardianPhone);

  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyReasons, setEmergencyReasons] = useState<string[]>([]);
  const [emergencyNote, setEmergencyNote] = useState("");

  const [contactChannel, setContactChannel] = useState(CONTACT_CHANNELS[0]);
  const [contactNote, setContactNote] = useState("");
  const [nextContactDate, setNextContactDate] = useState("");

  const currentStage = stageIndex(plan.stage);
  const emergencyActive = plan.emergency?.active === true;
  const advance = canAdvance(plan);
  const advanceLabel =
    plan.stage === "obturation" ? "完成根管充填，结束治疗" : "家长已确认，推进下一阶段";

  const toggleEmergencyReason = (reason: string) => {
    setEmergencyReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const submitEmergency = () => {
    const ok = actions.divertEmergency(plan.id, {
      reasons: emergencyReasons,
      note: emergencyNote,
    });
    if (ok) {
      setShowEmergency(false);
      setEmergencyReasons([]);
      setEmergencyNote("");
    }
  };

  const submitContact = () => {
    const ok = actions.logContact(plan.id, {
      channel: contactChannel,
      note: contactNote,
      nextContactDate,
    });
    if (ok) {
      setContactNote("");
      setNextContactDate("");
    }
  };

  return (
    <article className={`plan-card ${plan.completed ? "is-completed" : ""}`}>
      <header className="plan-head">
        <div className="tooth-code">{plan.toothCode}</div>
        <div className="plan-title">
          <h3>
            {plan.childName}
            <span className="diagnosis">{plan.diagnosis}</span>
          </h3>
          <p>
            预计 {plan.plannedVisits} 次 · 已到诊 {plan.attendedCount} 次 ·
            连续未到 {plan.consecutiveNoShows} 次
          </p>
        </div>
        <div className="plan-badges">
          {plan.completed && <span className="badge badge-done">已完成</span>}
          {emergencyActive && <span className="badge badge-emergency">急诊转介中</span>}
          {plan.contactListed && !plan.completed && (
            <span className="badge badge-contact">联系名单</span>
          )}
          {!plan.visitCheckedIn && !plan.completed && !emergencyActive && (
            <span className="badge badge-pending">待登记到诊</span>
          )}
          {plan.visitCheckedIn && !plan.guardianConfirmed && !plan.completed && (
            <span className="badge badge-warn">待家长确认</span>
          )}
          {plan.guardianConfirmed && !plan.completed && !emergencyActive && (
            <span className="badge badge-ok">本次已确认</span>
          )}
        </div>
      </header>

      {/* 阶段步进条 */}
      <ol className="stage-stepper">
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            className={
              i < currentStage
                ? "stage-past"
                : i === currentStage
                ? plan.completed
                  ? "stage-past"
                  : "stage-current"
                : "stage-todo"
            }
          >
            <span className="stage-dot">{i < currentStage || plan.completed ? "✓" : i + 1}</span>
            <span className="stage-name">{s.label}</span>
          </li>
        ))}
      </ol>

      {!plan.completed && (
        <>
          {/* 前台：本次到诊登记 */}
          <div className="action-row">
            <div className="action-label">
              <strong>本次到诊</strong>
              <span>
                {emergencyActive
                  ? "本次已转急诊，无法登记"
                  : plan.visitCheckedIn
                  ? `本次已到诊（监护人：${plan.guardianName || "待确认"}）`
                  : "前台需先登记到诊，漏记会导致后续无法推进"}
              </span>
            </div>
            <div className="action-buttons">
              <button
                className="primary-action"
                disabled={plan.visitCheckedIn || emergencyActive}
                onClick={() => actions.checkIn(plan.id)}
              >
                登记到诊
              </button>
              <button
                disabled={plan.visitCheckedIn || emergencyActive}
                onClick={() => actions.markNoShow(plan.id)}
              >
                本次未到
              </button>
            </div>
          </div>

          {/* 本次监护人：换人可改，确认后才能推进 */}
          <div className="guardian-box">
            <div className="guardian-head">
              <strong>本次监护人确认</strong>
              <span>
                {plan.guardianConfirmed
                  ? `${plan.guardianRelation} ${plan.guardianName}（${plan.guardianPhone}）已确认`
                  : "陪同人可能临时更换，请核实后再确认"}
              </span>
            </div>
            <div className="guardian-grid">
              <input
                placeholder="监护人姓名"
                value={guardianName}
                disabled={!plan.visitCheckedIn || plan.guardianConfirmed || emergencyActive}
                onChange={(e) => setGuardianName(e.target.value)}
              />
              <select
                value={guardianRelation}
                disabled={!plan.visitCheckedIn || plan.guardianConfirmed || emergencyActive}
                onChange={(e) => setGuardianRelation(e.target.value)}
              >
                <option value="">与患儿关系</option>
                {GUARDIAN_RELATIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input
                placeholder="联系电话"
                value={guardianPhone}
                disabled={!plan.visitCheckedIn || plan.guardianConfirmed || emergencyActive}
                onChange={(e) => setGuardianPhone(e.target.value)}
              />
              <button
                className={plan.guardianConfirmed ? "" : "primary-action"}
                disabled={!plan.visitCheckedIn || plan.guardianConfirmed || emergencyActive}
                onClick={() =>
                  actions.confirmGuardian(plan.id, {
                    guardianName,
                    guardianRelation,
                    guardianPhone,
                  })
                }
              >
                {plan.guardianConfirmed ? "已确认" : "家长确认"}
              </button>
            </div>
          </div>

          {/* 推进与急诊 */}
          <div className="action-row">
            <div className="action-label">
              <strong>治疗推进</strong>
              <span>
                {advance.ok
                  ? `当前阶段：${STAGE_LABELS[plan.stage]}`
                  : advance.reason}
              </span>
            </div>
            <div className="action-buttons">
              {!showEmergency && (
                <button
                  className="emergency-toggle"
                  disabled={emergencyActive}
                  onClick={() => setShowEmergency(true)}
                >
                  疼痛/肿胀 · 转急诊
                </button>
              )}
              <button
                className="primary-action"
                disabled={!advance.ok}
                onClick={() => actions.advance(plan.id)}
              >
                {advanceLabel}
              </button>
            </div>
          </div>

          {showEmergency && (
            <div className="emergency-form">
              <div className="checkbox-row">
                {EMERGENCY_REASONS.map((r) => (
                  <label key={r} className="check-pill">
                    <input
                      type="checkbox"
                      checked={emergencyReasons.includes(r)}
                      onChange={() => toggleEmergencyReason(r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
              <input
                placeholder="急诊处理说明，如：牙龈脓包伴肿胀，急诊开髓引流"
                value={emergencyNote}
                onChange={(e) => setEmergencyNote(e.target.value)}
              />
              <div className="action-buttons">
                <button onClick={() => setShowEmergency(false)}>取消</button>
                <button className="danger-action" onClick={submitEmergency}>
                  确认本次转急诊（原计划保留）
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 急诊占用条：阶段和次数原样保留，等待重排 */}
      {emergencyActive && (
        <div className="emergency-banner">
          <div>
            <strong>本次已转急诊 · 原计划等待重排</strong>
            <span>
              原因：{plan.emergency!.reasons.join("、")}（{plan.emergency!.since}）
              {plan.emergency!.note ? ` · ${plan.emergency!.note}` : ""}
            </span>
          </div>
          <button className="danger-action" onClick={() => actions.reschedule(plan.id)}>
            急诊处理结束，重排复诊
          </button>
        </div>
      )}

      {/* 联系名单：连续两次未到进入，记录跟进安排，不能直接算完成 */}
      {(plan.contactListed || plan.consecutiveNoShows >= 1) && !plan.completed && (
        <div className="contact-box">
          <div className="guardian-head">
            <strong>联系名单跟进</strong>
            <span>
              {plan.contactListed
                ? "已连续两次未到诊，需联系家长重排，不能直接算完成"
                : `已连续未到 ${plan.consecutiveNoShows} 次，达到两次将自动进入联系名单`}
              {plan.nextContactDate ? ` · 下次联系：${plan.nextContactDate}` : ""}
            </span>
          </div>
          <div className="contact-form">
            <select
              value={contactChannel}
              onChange={(e) => setContactChannel(e.target.value)}
            >
              {CONTACT_CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              placeholder="联系内容 / 家长反馈"
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
            />
            <input
              type="date"
              value={nextContactDate}
              onChange={(e) => setNextContactDate(e.target.value)}
            />
            <button className="primary-action" onClick={submitContact}>
              保存联系
            </button>
          </div>
          {plan.contactLogs.length > 0 && (
            <ul className="contact-logs">
              {plan.contactLogs.map((log, i) => (
                <li key={`${log.date}-${i}`}>
                  <span className="log-date">{log.date}</span>
                  <span className="log-channel">{log.channel}</span>
                  <span className="log-note">{log.note}</span>
                  {log.nextContactDate && <span className="log-next">→ {log.nextContactDate}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 经过记录 */}
      <details className="history-details">
        <summary>处理经过（{plan.history.length}）</summary>
        <ul className="history-list">
          {plan.history.map((h, i) => (
            <li key={`${h.date}-${i}`}>
              <span>{h.date}</span>
              <p>{h.text}</p>
            </li>
          ))}
        </ul>
      </details>

      {plan.completed && plan.completedAt && (
        <p className="completed-at">完成日期：{plan.completedAt}</p>
      )}

      <button className="link-delete" onClick={() => onRemove(plan.id)}>
        删除该牙位计划
      </button>
    </article>
  );
}
