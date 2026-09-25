// ===== 乳牙根管治疗计划台 · 记录层（数据结构）=====
// 仅定义"记什么"，不包含任何业务判断，页面与规则都依赖这里的类型。

/** 乳牙根管（牙髓）治疗阶段 */
export type StageId =
  | "intake" // 初诊登记
  | "anesthesia" // 局麻与隔湿
  | "access" // 开髓去冠髓
  | "cleaning" // 根管清理冲洗
  | "medication" // 根管封药
  | "filling" // 根管充填
  | "crown" // 预成冠/修复完成
  | "done"; // 计划完成

/** 本次到诊的处置结果，由前台在接诊时登记 */
export type VisitOutcome =
  | "pending" // 尚未接诊
  | "attended" // 已到诊
  | "noshow"; // 未到诊（爽约）

/** 明显疼痛或肿胀：本次转急诊 */
export interface EmergencyMark {
  active: boolean;
  reason: string; // 疼痛 / 肿胀表现
  at: string; // 登记时间 ISO
  /** 急诊处理后是否已回台重排；未回台前原计划冻结 */
  resolved: boolean;
}

/** 进入联系名单后的跟进安排（连续两次未到诊） */
export interface ContactArrangement {
  method: string; // 电话 / 短信 / 微信
  note: string;
  scheduledAt: string; // 计划联系时间
  contactedAt: string | null; // 实际联系时间
  /** 已联系并确认重排，等待下次到诊 */
  rescheduled: boolean;
}

export interface HistoryEntry {
  at: string;
  action: string;
}

/** 一个牙位 = 一条乳牙治疗计划 */
export interface TreatmentPlan {
  id: string;
  toothNo: string; // 乳牙牙位，如 #54、#75、#84
  childName: string; // 患儿姓名
  age: number;
  diagnosis: string; // 诊断，如 急性牙髓炎、慢性根尖周炎
  stage: StageId; // 当前治疗阶段
  plannedVisits: number; // 预计总次数
  attendedVisits: number; // 已到诊次数（已完成到诊）
  consecutiveNoShows: number; // 连续未到诊次数
  guardianName: string; // 本次陪同监护人（常临时更换，每次接诊核对）
  guardianRelation: string; // 与患儿关系
  guardianPhone: string;
  /** 家长确认：阶段推进、到诊登记等关键动作必须经确认 */
  guardianConfirmed: boolean;
  confirmNote: string;
  visitOutcome: VisitOutcome;
  emergency: EmergencyMark;
  contact: ContactArrangement | null; // 进入联系名单后存在
  history: HistoryEntry[];
  createdAt: string;
}

/** 新增计划时的表单输入 */
export type NewPlanInput = Pick<
  TreatmentPlan,
  | "toothNo"
  | "childName"
  | "age"
  | "diagnosis"
  | "plannedVisits"
  | "guardianName"
  | "guardianRelation"
  | "guardianPhone"
>;

/** 看板上用于汇总的计划状态（由判断层派生，不落库） */
export type PlanStatus =
  | "emergency" // 本次转急诊，原计划保留
  | "contact" // 连续两次未到诊，联系名单
  | "active" // 治疗进行中
  | "done"; // 已完成
