// 记录层：乳牙治疗计划的数据结构（只描述“记什么”，不含任何业务判断）

/** 乳牙根管治疗的阶段顺序：开髓拔髓 → 封药消毒 → 根管充填 → 治疗完成 */
export type StageId = "access" | "medicament" | "obturation" | "done";

/** 处理时间线条目 */
export interface HistoryEntry {
  date: string;
  text: string;
}

/** 联系名单中的一次联系记录 */
export interface ContactLogEntry {
  date: string;
  channel: string; // 电话 / 微信 / 短信
  note: string;
  nextContactDate?: string;
}

/** 急诊转介状态；active=false 后对象清空，经过仍留在 history 中 */
export interface EmergencyState {
  active: boolean;
  reasons: string[]; // 明显疼痛 / 肿胀
  since: string;
  note: string;
}

/** 一个牙位对应一份乳牙治疗计划 */
export interface ToothPlan {
  id: string;
  toothCode: string; // 牙位，如 74、55
  childName: string; // 患儿
  diagnosis: string; // 诊断

  stage: StageId; // 当前治疗阶段
  plannedVisits: number; // 预计次数
  attendedCount: number; // 已到诊次数（持久化）
  consecutiveNoShows: number; // 连续未到诊次数（持久化）
  visitCheckedIn: boolean; // 本次是否已由前台登记到诊

  guardianName: string; // 本次监护人（家长可能临时换人，每次就诊可改）
  guardianRelation: string;
  guardianPhone: string;
  guardianConfirmed: boolean; // 本次监护人是否已确认

  emergency: EmergencyState | null; // 非空且 active 表示本次已转急诊、原计划等待重排
  contactListed: boolean; // 是否在联系名单中（连续两次未到诊）
  contactLogs: ContactLogEntry[]; // 联系安排（持久化）
  nextContactDate?: string;

  completed: boolean;
  completedAt?: string;

  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}
