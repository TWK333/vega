// 调试会话列表：按任务归组，可查找归属用户、任务、会话和热心市民。

/**
 * @typedef {Object} DebugSession
 * @property {string} id
 * @property {string} [title]
 * @property {string} [employeeId]
 * @property {string} [employeeName]
 * @property {string} [ownerId]
 * @property {string} [ownerName]
 * @property {string} [taskId]
 * @property {string} [taskText]
 * @property {string} [taskStatus]
 * @property {string} [kind]
 * @property {boolean} [running]
 * @property {number} [createdAt]
 * @property {string} [scene]
 * @property {string} [model]
 * @property {boolean} [localAgent]
 * @property {string} [clientName]
 * @property {string} [clientId]
 */

/**
 * @typedef {Object} DebugSessionGroup
 * @property {string} key
 * @property {string} kind
 * @property {string} taskId
 * @property {string} taskText
 * @property {string} taskStatus
 * @property {string} label
 * @property {DebugSession[]} sessions
 */

/** 没有 taskId 的会话按种类分开，不并进任何一个任务组。 */
const UNLINKED = {
  chat: "沟通会话",
  group: "群聊会话",
  narrator: "旁白会话",
};

const SEARCH_FIELDS = ["id", "title", "taskId", "taskText", "employeeName", "ownerId", "ownerName"];

function looseKind(session) {
  return Object.hasOwn(UNLINKED, session?.kind) ? session.kind : "other";
}

/**
 * 员工筛选之后，再按搜索字段做不区分大小写的子串匹配。空白查询视为不过滤。
 * @param {DebugSession[]} sessions
 * @param {{ employeeId?: string, query?: string }} [filter]
 * @returns {DebugSession[]}
 */
export function visibleDebugSessions(sessions, filter = {}) {
  const employeeId = filter.employeeId || "";
  const needle = String(filter.query || "").trim().toLowerCase();
  return (sessions || []).filter((session) => {
    if (employeeId && session.employeeId !== employeeId) return false;
    if (!needle) return true;
    return SEARCH_FIELDS.some((field) => String(session?.[field] ?? "").toLowerCase().includes(needle));
  });
}

/**
 * 同一 taskId 的会话合成一组（保留输入顺序）。
 * 没有 taskId 的沟通 / 群聊 / 旁白各自成组，其它无任务会话归入「未关联任务」。
 * 组的先后跟随各组第一条会话在列表中的位置。
 * @param {DebugSession[]} sessions
 * @returns {DebugSessionGroup[]}
 */
export function groupDebugSessions(sessions) {
  const groups = [];
  const byKey = new Map();
  for (const session of sessions || []) {
    const taskId = session?.taskId || "";
    const kind = taskId ? "task" : looseKind(session);
    const key = taskId ? `task:${taskId}` : `loose:${kind}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        kind,
        taskId,
        taskText: "",
        taskStatus: "",
        label: taskId ? "" : (UNLINKED[kind] || "未关联任务"),
        sessions: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    if (taskId) {
      if (!group.taskText && session.taskText) group.taskText = session.taskText;
      if (!group.taskStatus && session.taskStatus) group.taskStatus = session.taskStatus;
    }
    group.sessions.push(session);
  }
  return groups;
}
