/**
 * WULING HUB — Project Workspace
 * Google Apps Script backend. Google Sheets is the database.
 *
 * ไฟล์นี้พอร์ตมาจาก React component ต้นฉบับ (App.jsx) แบบเต็มรูปแบบ — สคีมาและ
 * ฟีเจอร์ (Project Template, ลากสลับลำดับ Task, ย้ายงานทั้งหมดระหว่างคน, ฯลฯ)
 * อ้างอิงจากไฟล์นั้นโดยตรง ไม่ใช่จากดีไซน์ HTML ชุดแรกที่เคยพอร์ตไปก่อนหน้านี้
 *
 * ติดตั้ง:
 * 1) แนะนำให้สร้างเป็น "bound script" ผูกกับ Google Sheet ที่จะใช้เป็นฐานข้อมูล
 *    (เปิดชีตใหม่ -> Extensions -> Apps Script -> วางไฟล์ทั้งหมดในโฟลเดอร์นี้)
 * 2) ถ้าอยากรันแบบ standalone (ไม่ผูกชีต) ให้ตั้ง Script Property ชื่อ
 *    SPREADSHEET_ID เป็น ID ของ Google Sheet ที่ต้องการใช้เป็นฐานข้อมูล
 *    (Project Settings -> Script Properties) ระบบจะสร้างชีต/หัวตาราง/ข้อมูล
 *    ตัวอย่างให้อัตโนมัติในการเรียกใช้งานครั้งแรก
 * 3) Deploy -> New deployment -> Web app
 *    - Execute as: User accessing the web app
 *    - Who has access: ตามนโยบายทีม
 *    ผู้ใช้แต่ละคนต้องมีสิทธิ์ Editor บนตัว Google Sheet ด้วย
 */

// ── Config ──────────────────────────────────────────────────────────────
var SHEETS = {
  USERS: 'Users',
  PROJECTS: 'Projects',
  TASKS: 'Tasks',
  MILESTONES: 'Milestones',
  ACTIVITY: 'Activity',
  NOTIFICATIONS: 'Notifications',
};

// คอลัมน์ของแต่ละชีต เรียงตามลำดับจริงในตาราง — ฟิลด์ที่เป็น array/object
// จะถูกเก็บเป็นข้อความ JSON ในเซลล์เดียว (ดู JSON_FIELDS ด้านล่าง)
var SCHEMA = {
  Users: ['id', 'name', 'dept', 'role', 'tone'],
  Projects: ['id', 'name', 'category', 'dept', 'desc', 'ownerId', 'team', 'priority', 'status',
    'start', 'due', 'budget', 'actualCost', 'manual', 'tags', 'note'],
  // order: เลข float ใช้เรียงลำดับ Task ทั่วทั้งระบบ (ลากสลับ/ปุ่มขึ้น-ลง จะแก้แค่ค่านี้)
  Tasks: ['id', 'projectId', 'name', 'ownerId', 'collaborators', 'dept', 'status', 'start', 'due',
    'priority', 'progress', 'estCost', 'actualCost', 'subtasks', 'comments', 'attachments', 'desc',
    'createdAt', 'completedAt', 'order'],
  Milestones: ['id', 'projectId', 'name', 'date', 'done'],
  Activity: ['id', 'projectId', 'at', 'userId', 'text'],
  Notifications: ['id', 'text', 'at', 'read', 'kind'],
};

var JSON_FIELDS = {
  Projects: ['team', 'tags'],
  Tasks: ['collaborators', 'subtasks', 'comments', 'attachments'],
};
var BOOL_FIELDS = {
  Milestones: ['done'],
  Notifications: ['read'],
};
var NUM_FIELDS = {
  Projects: ['budget', 'actualCost', 'manual'],
  Tasks: ['progress', 'estCost', 'actualCost', 'order'],
};

var DEPARTMENTS = ['Management', 'Marketing', 'Sales', 'Service', 'Admin', 'Accounting'];
var CATEGORIES = ['Marketing', 'Sales', 'Event', 'Service', 'Website', 'IT / System', 'CRM',
  'Facility', 'HR', 'Accounting', 'Management', 'Other'];
var STATUS_OPTIONS = ['TODO', 'IN PROGRESS', 'REVIEW', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
var PSTATUS_OPTIONS = ['PLANNING', 'IN PROGRESS', 'ON HOLD', 'COMPLETED', 'CANCELLED'];
var PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
var ROLE_OPTIONS = ['ADMIN', 'MANAGEMENT', 'PROJECT MANAGER', 'TEAM MEMBER'];
var TEMPLATES = {
  'EVENT TEMPLATE': ['เลือกพื้นที่จัด Event', 'ติดต่อสถานที่', 'Confirm Event', 'ออกแบบ Artwork', 'สร้าง Content',
    'ยิง Meta Ads', 'เตรียมรถ Demo', 'ตรวจรถก่อน Event', 'เตรียม Sales Kit', 'เตรียม Lead Form', 'จัด Event',
    'เก็บ Lead', 'Follow-up Lead', 'Event Summary'],
  'MARKETING CAMPAIGN TEMPLATE': ['Campaign Planning', 'Content Planning', 'Artwork Production', 'Video Production',
    'Ad Setup', 'Campaign Launch', 'Monitor Ads', 'Lead Report', 'Campaign Optimization', 'Campaign Summary'],
  'WEBSITE PROJECT TEMPLATE': ['Research', 'Keyword Research', 'Content Structure', 'UI Design', 'Development',
    'SEO', 'AEO', 'Testing', 'Publish', 'Analytics Setup', 'Optimization'],
  'ไม่ใช้ Template': [],
};

// ── Web app entry point ────────────────────────────────────────────────
function doGet(e) {
  ensureSeed_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('WULING HUB — Project Workspace')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// ── Spreadsheet access ──────────────────────────────────────────────────
function ss_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (err) { /* fall through */ }
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var created = SpreadsheetApp.create('WULING HUB — Database');
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}
function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  var headers = SCHEMA[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    return sh;
  }
  // เติมคอลัมน์ที่ขาดไว้ด้านขวา (เช่นอัปเกรดจากเวอร์ชันก่อนหน้าที่ Tasks ยังไม่มี
  // collaborators/attachments/order) โดยไม่ทับคอลัมน์เดิมที่มีข้อมูลอยู่แล้ว
  var lastCol = Math.max(1, sh.getLastColumn());
  var have = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (have[i] !== headers[i] && !have[i]) sh.getRange(1, i + 1).setValue(headers[i]);
  }
  return sh;
}
function ensureSeed_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var usersSheet = sheet_(SHEETS.USERS);
    if (usersSheet.getLastRow() < 2) {
      seedData_();
    } else {
      Object.keys(SHEETS).forEach(function (k) { sheet_(SHEETS[k]); });
    }
  } finally {
    lock.releaseLock();
  }
}

// ── Generic row helpers ─────────────────────────────────────────────────
function rowToObj_(sheetName, headers, row) {
  var obj = {};
  headers.forEach(function (h, i) {
    var v = row[i];
    if ((JSON_FIELDS[sheetName] || []).indexOf(h) >= 0) {
      obj[h] = v ? (function () { try { return JSON.parse(v); } catch (e) { return []; } })() : [];
    } else if ((BOOL_FIELDS[sheetName] || []).indexOf(h) >= 0) {
      obj[h] = (v === true || v === 'TRUE' || v === 'true' || v === 1);
    } else if ((NUM_FIELDS[sheetName] || []).indexOf(h) >= 0) {
      obj[h] = (v === '' || v === null || v === undefined) ? (h === 'manual' ? null : 0) : Number(v);
    } else if (v instanceof Date) {
      obj[h] = Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
    } else {
      obj[h] = v === undefined ? '' : v;
    }
  });
  return obj;
}
function objToRow_(sheetName, headers, obj) {
  return headers.map(function (h) {
    var v = obj[h];
    if ((JSON_FIELDS[sheetName] || []).indexOf(h) >= 0) return JSON.stringify(v || []);
    if ((BOOL_FIELDS[sheetName] || []).indexOf(h) >= 0) return !!v;
    if (v === undefined || v === null) return '';
    return v;
  });
}
function readAll_(sheetName) {
  var sh = sheet_(sheetName);
  var lastRow = sh.getLastRow();
  var headers = SCHEMA[sheetName];
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.filter(function (r) { return r[0] !== ''; })
    .map(function (r) { return rowToObj_(sheetName, headers, r); });
}
function appendObj_(sheetName, obj) {
  var sh = sheet_(sheetName);
  var headers = SCHEMA[sheetName];
  sh.appendRow(objToRow_(sheetName, headers, obj));
  return obj;
}
function appendMany_(sheetName, objs) {
  if (!objs.length) return;
  var sh = sheet_(sheetName);
  var headers = SCHEMA[sheetName];
  var rows = objs.map(function (o) { return objToRow_(sheetName, headers, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}
function findRowIndex_(sh, headers, id) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  var idCol = headers.indexOf('id') + 1;
  var ids = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}
function patchById_(sheetName, id, patch) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_(sheetName);
    var headers = SCHEMA[sheetName];
    var r = findRowIndex_(sh, headers, id);
    if (r < 0) return null;
    var current = rowToObj_(sheetName, headers, sh.getRange(r, 1, 1, headers.length).getValues()[0]);
    var next = Object.assign({}, current, patch);
    sh.getRange(r, 1, 1, headers.length).setValues([objToRow_(sheetName, headers, next)]);
    return next;
  } finally {
    lock.releaseLock();
  }
}
function deleteById_(sheetName, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_(sheetName);
    var headers = SCHEMA[sheetName];
    var r = findRowIndex_(sh, headers, id);
    if (r > 0) sh.deleteRow(r);
  } finally {
    lock.releaseLock();
  }
}
function deleteWhere_(sheetName, matchKey, matchVal) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_(sheetName);
    var headers = SCHEMA[sheetName];
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    var col = headers.indexOf(matchKey) + 1;
    var values = sh.getRange(2, col, lastRow - 1, 1).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      if (String(values[i][0]) === String(matchVal)) sh.deleteRow(i + 2);
    }
  } finally {
    lock.releaseLock();
  }
}

// ── Public API ───────────────────────────────────────────────────────────
function getAllData() {
  ensureSeed_();
  var tasks = readAll_(SHEETS.TASKS).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  return {
    users: readAll_(SHEETS.USERS),
    projects: readAll_(SHEETS.PROJECTS),
    tasks: tasks,
    milestones: readAll_(SHEETS.MILESTONES),
    activity: readAll_(SHEETS.ACTIVITY).sort(function (a, b) { return b.at < a.at ? -1 : 1; }),
    notifications: readAll_(SHEETS.NOTIFICATIONS).sort(function (a, b) { return b.id < a.id ? -1 : 1; }),
    options: {
      departments: DEPARTMENTS, categories: CATEGORIES, statusOptions: STATUS_OPTIONS,
      pstatusOptions: PSTATUS_OPTIONS, priorityOptions: PRIORITY_OPTIONS, roleOptions: ROLE_OPTIONS,
      templates: TEMPLATES,
    },
  };
}

// เดิมนับจาก "จำนวนแถวปัจจุบัน + 1" ซึ่งถ้ามีการลบไปก่อนหน้า จำนวนแถวจะถอยกลับ ทำให้สุ่ม
// ได้ id ซ้ำกับของเดิมที่ยังอยู่ในชีต — จึงหาค่ารันสูงสุดที่เคยใช้จริงจาก id ทั้งหมดแล้วบวก 1 แทน
function nextProjectId_() {
  var year = new Date().getFullYear();
  var max = 0;
  readAll_(SHEETS.PROJECTS).forEach(function (p) {
    var m = /^PRJ-\d{4}-(\d+)$/.exec(p.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'PRJ-' + year + '-' + String(max + 1).padStart(4, '0');
}
function nextTaskIdNum_() {
  var max = 0;
  readAll_(SHEETS.TASKS).forEach(function (t) {
    var m = /^TSK-\d{4}-(\d+)$/.exec(t.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max;
}
function nextTaskId_(n) {
  return 'TSK-' + new Date().getFullYear() + '-' + String(n).padStart(6, '0');
}
function nextUserId_() {
  var users = readAll_(SHEETS.USERS);
  var max = users.reduce(function (m, u) { return Math.max(m, parseInt(String(u.id).slice(1), 10) || 0); }, 0);
  return 'U' + (max + 1);
}
function maxTaskOrder_() {
  var tasks = readAll_(SHEETS.TASKS);
  return tasks.reduce(function (m, t) { return Math.max(m, t.order || 0); }, 0);
}

function logActivity_(projectId, userId, text) {
  appendObj_(SHEETS.ACTIVITY, { id: 'A' + Date.now() + Math.floor(Math.random() * 1000), projectId: projectId, at: nowStamp_(), userId: userId, text: text });
}
function notify_(text, kind) {
  appendObj_(SHEETS.NOTIFICATIONS, { id: 'N' + Date.now() + Math.floor(Math.random() * 1000), text: text, at: nowStamp_(), read: false, kind: kind || 'update' });
}
function nowStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
}
function todayIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
}
function userName_(id) {
  var u = readAll_(SHEETS.USERS).find(function (x) { return x.id === id; });
  return u ? u.name : '—';
}

// — Projects —
function createProject(form, templateName) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var id, p, newTasks = [];
  try {
    id = nextProjectId_();
    p = {
      id: id, name: form.name, category: form.category, dept: form.dept, desc: form.desc || '',
      ownerId: form.ownerId, team: [form.ownerId], priority: form.priority, status: form.status || 'PLANNING',
      start: form.start, due: form.due, budget: Number(form.budget) || 0, actualCost: 0, manual: null,
      tags: form.tags ? String(form.tags).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [],
      note: '',
    };
    appendObj_(SHEETS.PROJECTS, p);

    var tpl = TEMPLATES[templateName] || [];
    if (tpl.length) {
      var n0 = nextTaskIdNum_();
      var ord = maxTaskOrder_();
      var startD = new Date(form.start + 'T00:00:00'), dueD = new Date(form.due + 'T00:00:00');
      var totalDays = Math.max(1, Math.round((dueD - startD) / 86400000) + 1);
      var span = Math.max(1, Math.floor(totalDays / tpl.length));
      newTasks = tpl.map(function (name, i) {
        var s = new Date(startD.getTime() + i * span * 86400000);
        var d = new Date(startD.getTime() + (i * span + span - 1) * 86400000);
        return {
          id: nextTaskId_(n0 + 1 + i), projectId: id, name: name, ownerId: form.ownerId, collaborators: [],
          dept: form.dept, status: 'TODO', start: fmtDate_(s), due: fmtDate_(d), priority: 'MEDIUM', progress: 0,
          estCost: 0, actualCost: 0, subtasks: [], comments: [], attachments: [], desc: '',
          createdAt: todayIso_(), completedAt: null, order: ++ord,
        };
      });
      appendMany_(SHEETS.TASKS, newTasks);
    }
  } finally {
    lock.releaseLock();
  }
  logActivity_(id, form.ownerId, 'สร้าง Project "' + p.name + '"' + (newTasks.length ? (' จาก ' + templateName + ' (' + newTasks.length + ' Task)') : ''));
  notify_('สร้าง Project ใหม่ "' + p.name + '"', 'task');
  return p;
}
function fmtDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
}
function updateProject(id, patch, userId, activityText) {
  var next = patchById_(SHEETS.PROJECTS, id, patch);
  if (activityText) logActivity_(id, userId, activityText);
  return next;
}
function deleteProject(id) {
  var p = readAll_(SHEETS.PROJECTS).find(function (x) { return x.id === id; });
  deleteWhere_(SHEETS.TASKS, 'projectId', id);
  deleteWhere_(SHEETS.MILESTONES, 'projectId', id);
  deleteWhere_(SHEETS.ACTIVITY, 'projectId', id);
  deleteById_(SHEETS.PROJECTS, id);
  if (p) notify_('ลบโครงการ "' + p.name + '" แล้ว', 'update');
}
function toggleProjectTeam(projectId, userId) {
  var p = readAll_(SHEETS.PROJECTS).find(function (x) { return x.id === projectId; });
  if (!p) return null;
  var inTeam = p.team.indexOf(userId) >= 0;
  var team = inTeam ? p.team.filter(function (x) { return x !== userId; }) : p.team.concat([userId]);
  logActivity_(projectId, p.ownerId, (inTeam ? 'นำ ' : 'เพิ่ม ') + userName_(userId) + (inTeam ? ' ออกจากทีม' : ' เข้าทีม'));
  return patchById_(SHEETS.PROJECTS, projectId, { team: team });
}

// — Tasks —
function createTask(form) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var t;
  try {
    var id = nextTaskId_(nextTaskIdNum_() + 1);
    t = {
      id: id, projectId: form.projectId, name: form.name, ownerId: form.ownerId, collaborators: [],
      dept: form.dept, status: form.status || 'TODO', start: form.start, due: form.due, priority: form.priority,
      progress: 0, estCost: Number(form.estCost) || 0, actualCost: 0, subtasks: [], comments: [], attachments: [],
      desc: form.desc || '', createdAt: todayIso_(), completedAt: null, order: maxTaskOrder_() + 1,
    };
    appendObj_(SHEETS.TASKS, t);
  } finally {
    lock.releaseLock();
  }
  logActivity_(t.projectId, t.ownerId, 'เพิ่ม Task "' + t.name + '"');
  notify_('Task ใหม่ "' + t.name + '" มอบให้ ' + userName_(t.ownerId), 'task');
  return t;
}
function updateTask(id, patch) {
  var current = readAll_(SHEETS.TASKS).find(function (x) { return x.id === id; });
  if (!current) return null;
  if (patch.status && patch.status !== current.status) {
    if (patch.status === 'COMPLETED') { patch.progress = 100; patch.completedAt = todayIso_(); }
    else if (current.status === 'COMPLETED') { patch.completedAt = null; }
    logActivity_(current.projectId, current.ownerId, 'เปลี่ยน Task "' + current.name + '" เป็น ' + patch.status);
  }
  if (patch.due && patch.due !== current.due) {
    logActivity_(current.projectId, current.ownerId, 'เปลี่ยน Deadline "' + current.name + '" จาก ' + current.due + ' เป็น ' + patch.due);
  }
  if (patch.ownerId && patch.ownerId !== current.ownerId) {
    logActivity_(current.projectId, patch.ownerId, 'มอบหมาย "' + current.name + '" ให้ ' + userName_(patch.ownerId));
    notify_('มอบหมาย Task "' + current.name + '" ให้ ' + userName_(patch.ownerId), 'task');
  }
  return patchById_(SHEETS.TASKS, id, patch);
}
function deleteTask(id) {
  var t = readAll_(SHEETS.TASKS).find(function (x) { return x.id === id; });
  deleteById_(SHEETS.TASKS, id);
  if (t) {
    logActivity_(t.projectId, t.ownerId, 'ลบ Task "' + t.name + '"');
    notify_('ลบ Task "' + t.name + '" แล้ว', 'update');
  }
}
function patchSubtasks_(taskId, subs) {
  var doneCount = subs.filter(function (s) { return s.done; }).length;
  var pct = subs.length ? Math.round((doneCount / subs.length) * 100) : null;
  var patch = { subtasks: subs };
  if (pct != null) {
    patch.progress = pct;
    var t = readAll_(SHEETS.TASKS).find(function (x) { return x.id === taskId; });
    if (pct === 100) { patch.status = 'COMPLETED'; patch.completedAt = todayIso_(); }
    else if (t && t.status === 'TODO') patch.status = 'IN PROGRESS';
  }
  return patchById_(SHEETS.TASKS, taskId, patch);
}
function toggleSubtask(taskId, subId) {
  var t = readAll_(SHEETS.TASKS).find(function (x) { return x.id === taskId; });
  if (!t) return null;
  var subs = t.subtasks.map(function (s) { return s.id === subId ? Object.assign({}, s, { done: !s.done }) : s; });
  return patchSubtasks_(taskId, subs);
}
function addSubtask(taskId, name) {
  var t = readAll_(SHEETS.TASKS).find(function (x) { return x.id === taskId; });
  if (!t) return null;
  var subs = t.subtasks.concat([{ id: taskId + '-' + Date.now(), name: name, done: false }]);
  return patchById_(SHEETS.TASKS, taskId, { subtasks: subs });
}
function deleteSubtask(taskId, subId) {
  var t = readAll_(SHEETS.TASKS).find(function (x) { return x.id === taskId; });
  if (!t) return null;
  var subs = t.subtasks.filter(function (s) { return s.id !== subId; });
  return patchById_(SHEETS.TASKS, taskId, { subtasks: subs });
}
function addComment(taskId, userId, text) {
  var t = readAll_(SHEETS.TASKS).find(function (x) { return x.id === taskId; });
  if (!t) return null;
  var comments = t.comments.concat([{ userId: userId, text: text, at: nowStamp_() }]);
  var next = patchById_(SHEETS.TASKS, taskId, { comments: comments });
  logActivity_(t.projectId, userId, 'เพิ่ม Comment ใน Task "' + t.name + '"');
  var m = text.match(/@(\w+)/);
  if (m) notify_('@' + m[1] + ' ถูก mention ใน "' + t.name + '"', 'mention');
  return next;
}

// ลากสลับลำดับ / ปุ่มขึ้น-ลง: ปรับแค่ order ของ task ที่ลาก ให้แทรกติดกับ target
// (ก่อนหรือหลังตามทิศทาง) โดยคำนวณเป็นค่ากึ่งกลางระหว่าง target กับเพื่อนบ้านของมันใน
// ลำดับ order ทั้งระบบ — ไม่ต้องเขียนทับ order ของแถวอื่นเลย
function reorderTask(dragId, targetId, after) {
  var tasks = readAll_(SHEETS.TASKS).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  var ti = tasks.findIndex(function (t) { return t.id === targetId; });
  if (ti < 0 || dragId === targetId) return null;
  var target = tasks[ti];
  var neighbor = after ? tasks[ti + 1] : tasks[ti - 1];
  var newOrder;
  if (neighbor && neighbor.id !== dragId) {
    newOrder = (target.order + neighbor.order) / 2;
  } else {
    newOrder = after ? target.order + 1 : target.order - 1;
  }
  return patchById_(SHEETS.TASKS, dragId, { order: newOrder });
}
// จัดเรียง Task ของโครงการเดียวตามคีย์ที่เลือก (ไม่แตะ Task โครงการอื่น)
function sortProjectTasks(projectId, key, userId) {
  var all = readAll_(SHEETS.TASKS);
  var mine = all.filter(function (t) { return t.projectId === projectId; });
  mine.sort(function (a, b) {
    if (key === 'due') return (a.due < b.due ? -1 : a.due > b.due ? 1 : (a.start < b.start ? -1 : 1));
    if (key === 'start') return (a.start < b.start ? -1 : a.start > b.start ? 1 : (a.due < b.due ? -1 : 1));
    var P = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return P[a.priority] - P[b.priority];
  });
  var base = Date.now();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    mine.forEach(function (t, i) { patchById_(SHEETS.TASKS, t.id, { order: base + i }); });
  } finally {
    lock.releaseLock();
  }
  logActivity_(projectId, userId, key === 'due' ? 'จัดเรียง Task ตามวันครบกำหนด' : key === 'start' ? 'จัดเรียง Task ตามวันเริ่ม' : 'จัดเรียง Task ตาม Priority');
  return true;
}

// — Milestones —
function createMilestone(form, userId) {
  var m = { id: 'MS' + Date.now(), projectId: form.projectId, name: form.name, date: form.date, done: false };
  appendObj_(SHEETS.MILESTONES, m);
  logActivity_(form.projectId, userId, 'เพิ่ม Milestone "' + m.name + '"');
  return m;
}
function toggleMilestone(id) {
  var m = readAll_(SHEETS.MILESTONES).find(function (x) { return x.id === id; });
  if (!m) return null;
  return patchById_(SHEETS.MILESTONES, id, { done: !m.done });
}
function deleteMilestone(id, userId) {
  var m = readAll_(SHEETS.MILESTONES).find(function (x) { return x.id === id; });
  deleteById_(SHEETS.MILESTONES, id);
  if (m) logActivity_(m.projectId, userId, 'ลบ Milestone "' + m.name + '"');
}

// — Note (โน้ตของโครงการ) —
function setProjectNote(projectId, text, userId) {
  logActivity_(projectId, userId, 'เพิ่ม Note ในโครงการ');
  return patchById_(SHEETS.PROJECTS, projectId, { note: text });
}

// — Users / Team —
function createUser() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var u;
  try {
    var id = nextUserId_();
    var tones = ['bg-blue-600', 'bg-emerald-600', 'bg-slate-800', 'bg-amber-600', 'bg-violet-600',
      'bg-rose-600', 'bg-teal-600', 'bg-indigo-600', 'bg-orange-600', 'bg-cyan-700'];
    var n = parseInt(id.slice(1), 10);
    u = { id: id, name: 'สมาชิกใหม่ ' + n, dept: 'Sales', role: 'TEAM MEMBER', tone: tones[(n - 1) % tones.length] };
    appendObj_(SHEETS.USERS, u);
  } finally {
    lock.releaseLock();
  }
  notify_('เพิ่มสมาชิกใหม่ในทีม — แก้ชื่อได้ที่หน้า Team', 'update');
  return u;
}
function updateUser(id, patch) {
  return patchById_(SHEETS.USERS, id, patch);
}
function deleteUser(id) {
  var u = readAll_(SHEETS.USERS).find(function (x) { return x.id === id; });
  deleteById_(SHEETS.USERS, id);
  if (u) notify_('ลบสมาชิก "' + u.name + '" ออกจากทีมแล้ว', 'update');
}
// ย้ายงานทั้งหมด (Task ที่เป็นเจ้าของ + Project ที่เป็น Owner/อยู่ในทีม) จากคนหนึ่งไปอีกคน
function reassignAll(fromId, toId) {
  if (!toId || toId === fromId) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    readAll_(SHEETS.TASKS).forEach(function (t) {
      if (t.ownerId === fromId) patchById_(SHEETS.TASKS, t.id, { ownerId: toId });
    });
    readAll_(SHEETS.PROJECTS).forEach(function (p) {
      var patch = {};
      if (p.ownerId === fromId) patch.ownerId = toId;
      if (p.team.indexOf(fromId) >= 0) {
        var set = {}; p.team.concat([toId]).forEach(function (x) { set[x === fromId ? toId : x] = true; });
        patch.team = Object.keys(set);
      }
      if (Object.keys(patch).length) patchById_(SHEETS.PROJECTS, p.id, patch);
    });
  } finally {
    lock.releaseLock();
  }
  notify_('ย้ายงานทั้งหมดของ ' + userName_(fromId) + ' ไปให้ ' + userName_(toId), 'update');
}

// — Notifications —
function markAllNotificationsRead() {
  var sh = sheet_(SHEETS.NOTIFICATIONS);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  var headers = SCHEMA[SHEETS.NOTIFICATIONS];
  var readCol = headers.indexOf('read') + 1;
  var col = sh.getRange(2, readCol, lastRow - 1, 1);
  col.setValues(col.getValues().map(function () { return [true]; }));
}

// ── Seed data — พอร์ตชุดข้อมูลตัวอย่างเดิมจาก React ต้นฉบับ ──
function seedData_() {
  Object.keys(SHEETS).forEach(function (k) { sheet_(SHEETS[k]); });

  var users = [
    { id: 'U1', name: 'ICE', dept: 'Marketing', role: 'PROJECT MANAGER', tone: 'bg-blue-600' },
    { id: 'U2', name: 'KOMEN', dept: 'Sales', role: 'TEAM MEMBER', tone: 'bg-emerald-600' },
    { id: 'U3', name: 'ANOTAI', dept: 'Management', role: 'MANAGEMENT', tone: 'bg-slate-800' },
    { id: 'U4', name: 'NOK', dept: 'Service', role: 'TEAM MEMBER', tone: 'bg-amber-600' },
    { id: 'U5', name: 'PLOY', dept: 'Admin', role: 'ADMIN', tone: 'bg-violet-600' },
    { id: 'U6', name: 'BEAM', dept: 'Accounting', role: 'TEAM MEMBER', tone: 'bg-rose-600' },
  ];
  appendMany_(SHEETS.USERS, users);

  var P1 = 'PRJ-2026-0001', P2 = 'PRJ-2026-0002', P3 = 'PRJ-2026-0003',
    P4 = 'PRJ-2026-0004', P5 = 'PRJ-2026-0005', P6 = 'PRJ-2026-0006';
  var projects = [
    { id: P1, name: 'งานสร้าง WEBSITE WULING', category: 'Website', dept: 'Marketing', desc: 'สร้างเว็บไซต์ศูนย์จำหน่ายใหม่ทั้งระบบ รองรับข้อมูลรถทุกรุ่น ฟอร์มจองทดลองขับ และเชื่อม Lead เข้า CRM', ownerId: 'U1', team: ['U1', 'U5', 'U3'], priority: 'HIGH', status: 'IN PROGRESS', start: '2026-09-01', due: '2026-10-31', budget: 180000, actualCost: 45000, manual: null, tags: ['website', 'seo', 'lead'], note: 'ต้องอนุมัติแบบหน้าแรกก่อน 14 ก.ย. เพื่อไม่ให้กระทบคิวพัฒนา' },
    { id: P2, name: 'งานเปิดหัวไฟแนนซ์ KRUNGSRI', category: 'Sales', dept: 'Sales', desc: 'ขอเปิดหัวไฟแนนซ์กับกรุงศรี ออโต้ เพื่อเพิ่มทางเลือกสินเชื่อให้ลูกค้าและเร่งอัตราการอนุมัติ', ownerId: 'U2', team: ['U2', 'U6', 'U3'], priority: 'URGENT', status: 'IN PROGRESS', start: '2026-08-25', due: '2026-09-25', budget: 15000, actualCost: 4000, manual: null, tags: ['finance', 'krungsri', 'sales'], note: '' },
    { id: P3, name: 'งานทำ FLOOR PLAN - NISSAN', category: 'Accounting', dept: 'Accounting', desc: 'ขอวงเงิน Floor Plan สำหรับสต๊อกรถ NISSAN พร้อมวางระบบควบคุมสต๊อกและการชำระคืนวงเงิน', ownerId: 'U6', team: ['U6', 'U3', 'U2'], priority: 'HIGH', status: 'IN PROGRESS', start: '2026-09-08', due: '2026-10-20', budget: 50000, actualCost: 0, manual: null, tags: ['floorplan', 'nissan', 'credit'], note: '' },
    { id: P4, name: 'งานเพิ่มทีมขาย 2 ตำแหน่ง', category: 'HR', dept: 'Management', desc: 'สรรหาและอบรมพนักงานขาย 2 อัตรา รองรับยอดขายไตรมาส 4 และงานตลาดองค์กร', ownerId: 'U5', team: ['U5', 'U2', 'U3'], priority: 'HIGH', status: 'IN PROGRESS', start: '2026-09-01', due: '2026-10-10', budget: 20000, actualCost: 6000, manual: null, tags: ['hr', 'recruit', 'sales'], note: '' },
    { id: P5, name: 'งานวางระบบบัญชี และ ภาษี', category: 'Accounting', dept: 'Accounting', desc: 'วางผังบัญชีใหม่ให้ตรงกับธุรกิจรถ EV ตั้งระบบ e-Tax และระบบต้นทุนรถต่อคัน', ownerId: 'U6', team: ['U6', 'U3', 'U5'], priority: 'HIGH', status: 'IN PROGRESS', start: '2026-08-15', due: '2026-10-31', budget: 90000, actualCost: 28000, manual: null, tags: ['accounting', 'tax', 'e-tax'], note: '' },
    { id: P6, name: 'งานเปิดตลาดโรงงาน และ OPERATING LEASE', category: 'Sales', dept: 'Sales', desc: 'เปิดตลาดลูกค้าองค์กรในนิคมอุตสาหกรรมชลบุรี-ระยอง ด้วยแพ็กเกจเช่าดำเนินงาน (Operating Lease)', ownerId: 'U2', team: ['U2', 'U3', 'U6', 'U1'], priority: 'HIGH', status: 'IN PROGRESS', start: '2026-09-01', due: '2026-11-30', budget: 70000, actualCost: 12000, manual: null, tags: ['b2b', 'fleet', 'operating-lease'], note: '' },
  ];
  appendMany_(SHEETS.PROJECTS, projects);

  var tid = 0, ord = 0;
  function T(pid, name, owner, dept, status, start, due, priority, progress, est, act, subs) {
    tid++; ord++;
    var id = 'TSK-2026-' + String(tid).padStart(6, '0');
    return {
      id: id, projectId: pid, name: name, ownerId: owner, collaborators: [], dept: dept, status: status,
      start: start, due: due, priority: priority, progress: status === 'COMPLETED' ? 100 : (progress || 0),
      estCost: est || 0, actualCost: act || 0,
      subtasks: (subs || []).map(function (s, i) { return { id: id + '-' + i, name: s[0], done: s[1] }; }),
      comments: [], attachments: [], desc: '', createdAt: '2026-08-25',
      completedAt: status === 'COMPLETED' ? due : null, order: ord,
    };
  }
  var tasks = [
    T(P1, 'สรุป Requirement และโครงสร้างเว็บไซต์', 'U1', 'Marketing', 'COMPLETED', '2026-09-01', '2026-09-04', 'HIGH', 100),
    T(P1, 'คัดเลือกผู้พัฒนาและเปรียบเทียบราคา', 'U6', 'Accounting', 'COMPLETED', '2026-09-02', '2026-09-05', 'HIGH', 100),
    T(P1, 'ออกแบบ UI/UX หน้าแรกและหน้ารถ', 'U1', 'Marketing', 'IN PROGRESS', '2026-09-05', '2026-09-14', 'HIGH', 35, 40000, 20000, [['Wireframe หน้าแรก', true], ['Mood board สี WULING', true], ['หน้ารายละเอียดรถ', false], ['หน้าโปรโมชั่น', false]]),
    T(P1, 'เตรียมเนื้อหาและรูปรถทุกรุ่น', 'U5', 'Admin', 'IN PROGRESS', '2026-09-07', '2026-09-20', 'MEDIUM', 20, 15000, 5000),
    T(P1, 'พัฒนาเว็บไซต์ Frontend / Backend', 'U3', 'Management', 'TODO', '2026-09-15', '2026-10-15', 'HIGH', 0, 90000, 20000),
    T(P1, 'เชื่อมฟอร์ม Lead เข้าระบบ CRM', 'U3', 'Management', 'TODO', '2026-10-05', '2026-10-15', 'HIGH', 0),
    T(P1, 'ตั้งค่า SEO และ Google Analytics', 'U1', 'Marketing', 'TODO', '2026-10-16', '2026-10-22', 'MEDIUM', 0),
    T(P1, 'ทดสอบระบบและเปิดใช้งานจริง', 'U5', 'Admin', 'TODO', '2026-10-23', '2026-10-31', 'URGENT', 0),
    T(P2, 'รวบรวมเอกสารบริษัทและงบการเงิน', 'U6', 'Accounting', 'COMPLETED', '2026-08-25', '2026-08-31', 'HIGH', 100),
    T(P2, 'ยื่นเรื่องขอเปิดหัวไฟแนนซ์กรุงศรี ออโต้', 'U2', 'Sales', 'COMPLETED', '2026-09-01', '2026-09-03', 'URGENT', 100, 4000, 4000),
    T(P2, 'นัดเจ้าหน้าที่กรุงศรีเข้าตรวจโชว์รูม', 'U2', 'Sales', 'IN PROGRESS', '2026-09-04', '2026-09-08', 'URGENT', 50, 0, 0, [['เตรียมพื้นที่โชว์รูม', true], ['เตรียมเอกสารจดทะเบียน', true], ['นัดวันตรวจ', false]]),
    T(P2, 'จัดทำสัญญาแต่งตั้งตัวแทนสินเชื่อ', 'U6', 'Accounting', 'TODO', '2026-09-09', '2026-09-14', 'HIGH', 0),
    T(P2, 'อบรมทีมขายเรื่องเงื่อนไขสินเชื่อ', 'U2', 'Sales', 'TODO', '2026-09-15', '2026-09-18', 'MEDIUM', 0),
    T(P2, 'ติดตั้งระบบยื่นสินเชื่อออนไลน์', 'U5', 'Admin', 'TODO', '2026-09-16', '2026-09-22', 'MEDIUM', 0, 8000, 0),
    T(P2, 'ทดสอบยื่นเคสแรกกับลูกค้าจริง', 'U2', 'Sales', 'TODO', '2026-09-22', '2026-09-25', 'HIGH', 0),
    T(P3, 'ศึกษาเงื่อนไข Floor Plan ของ NISSAN', 'U6', 'Accounting', 'IN PROGRESS', '2026-09-08', '2026-09-12', 'HIGH', 40),
    T(P3, 'ประเมินวงเงินสต๊อกรถที่ต้องใช้', 'U3', 'Management', 'TODO', '2026-09-12', '2026-09-16', 'HIGH', 0),
    T(P3, 'เตรียมงบการเงินและหลักประกัน', 'U6', 'Accounting', 'TODO', '2026-09-16', '2026-09-24', 'URGENT', 0),
    T(P3, 'เจรจาอัตราดอกเบี้ยกับสถาบันการเงิน', 'U3', 'Management', 'TODO', '2026-09-25', '2026-10-03', 'HIGH', 0),
    T(P3, 'จัดทำและเซ็นสัญญา Floor Plan', 'U6', 'Accounting', 'TODO', '2026-10-05', '2026-10-12', 'HIGH', 0, 20000, 0),
    T(P3, 'วางระบบควบคุมสต๊อกและการชำระคืนวงเงิน', 'U5', 'Admin', 'TODO', '2026-10-12', '2026-10-20', 'MEDIUM', 0, 15000, 0),
    T(P4, 'กำหนด Job Description และโครงสร้างค่าตอบแทน', 'U5', 'Admin', 'COMPLETED', '2026-09-01', '2026-09-03', 'HIGH', 100),
    T(P4, 'ประกาศรับสมัครทุกช่องทาง', 'U5', 'Admin', 'IN PROGRESS', '2026-09-03', '2026-09-12', 'HIGH', 60, 6000, 6000, [['JobThai + JobBKK', true], ['Facebook Page', true], ['เครือข่ายพนักงานแนะนำ', false]]),
    T(P4, 'คัดกรองใบสมัครและโทรนัดสัมภาษณ์', 'U5', 'Admin', 'TODO', '2026-09-10', '2026-09-18', 'MEDIUM', 0),
    T(P4, 'สัมภาษณ์รอบแรกโดยหัวหน้าฝ่ายขาย', 'U2', 'Sales', 'TODO', '2026-09-18', '2026-09-24', 'HIGH', 0),
    T(P4, 'สัมภาษณ์รอบผู้บริหาร', 'U3', 'Management', 'TODO', '2026-09-25', '2026-09-28', 'HIGH', 0),
    T(P4, 'เสนอเงื่อนไขและเซ็นสัญญาจ้าง', 'U5', 'Admin', 'TODO', '2026-09-29', '2026-10-02', 'URGENT', 0),
    T(P4, 'อบรมพนักงานขายใหม่และส่งลงพื้นที่', 'U2', 'Sales', 'TODO', '2026-10-05', '2026-10-10', 'MEDIUM', 0, 8000, 0),
    T(P5, 'ตรวจสอบผังบัญชีและระบบเดิม', 'U6', 'Accounting', 'COMPLETED', '2026-08-15', '2026-08-25', 'MEDIUM', 100),
    T(P5, 'คัดเลือกโปรแกรมบัญชีที่จะใช้', 'U6', 'Accounting', 'COMPLETED', '2026-08-26', '2026-09-02', 'HIGH', 100, 25000, 16000),
    T(P5, 'วางผังบัญชีใหม่ให้ตรงกับธุรกิจรถ EV', 'U6', 'Accounting', 'IN PROGRESS', '2026-09-03', '2026-09-15', 'HIGH', 45, 30000, 12000, [['หมวดรายได้ขายรถ', true], ['หมวดรายได้ศูนย์บริการ', true], ['หมวดต้นทุนรถต่อคัน', false], ['หมวดค่าคอมมิชชั่น', false]]),
    T(P5, 'ตรวจสอบภาษีซื้อ-ภาษีขายย้อนหลัง', 'U6', 'Accounting', 'IN PROGRESS', '2026-09-01', '2026-09-12', 'MEDIUM', 30),
    T(P5, 'ตั้งระบบใบกำกับภาษีอิเล็กทรอนิกส์ e-Tax', 'U5', 'Admin', 'TODO', '2026-09-16', '2026-09-30', 'HIGH', 0, 20000, 0),
    T(P5, 'วางระบบบันทึกต้นทุนรถและค่าคอมมิชชั่น', 'U6', 'Accounting', 'TODO', '2026-09-20', '2026-10-05', 'MEDIUM', 0),
    T(P5, 'อบรมทีมใช้งานระบบบัญชีใหม่', 'U6', 'Accounting', 'TODO', '2026-10-06', '2026-10-15', 'MEDIUM', 0),
    T(P5, 'ปิดงบทดลองเดือนแรกด้วยระบบใหม่', 'U6', 'Accounting', 'TODO', '2026-10-20', '2026-10-31', 'HIGH', 0),
    T(P6, 'จัดทำรายชื่อโรงงานเป้าหมาย ชลบุรี-ระยอง', 'U2', 'Sales', 'COMPLETED', '2026-09-01', '2026-09-04', 'HIGH', 100),
    T(P6, 'ทำ Presentation แพ็กเกจ Operating Lease', 'U1', 'Marketing', 'IN PROGRESS', '2026-09-04', '2026-09-12', 'HIGH', 40, 15000, 6000),
    T(P6, 'คำนวณต้นทุนและค่าเช่าต่อคันต่อเดือน', 'U6', 'Accounting', 'IN PROGRESS', '2026-09-05', '2026-09-14', 'HIGH', 25),
    T(P6, 'หาพันธมิตรบริษัทลีสซิ่ง', 'U3', 'Management', 'TODO', '2026-09-10', '2026-09-25', 'HIGH', 0),
    T(P6, 'เข้าพบลูกค้าโรงงาน 20 ราย', 'U2', 'Sales', 'TODO', '2026-09-20', '2026-10-31', 'HIGH', 0, 12000, 0),
    T(P6, 'จัด Test Drive สำหรับลูกค้าองค์กร', 'U2', 'Sales', 'TODO', '2026-10-10', '2026-10-20', 'MEDIUM', 0, 20000, 0),
    T(P6, 'เสนอราคาและปิดดีลล็อตแรก', 'U2', 'Sales', 'TODO', '2026-11-01', '2026-11-20', 'URGENT', 0),
    T(P6, 'ส่งมอบรถล็อตแรกและวางแผนบริการหลังการขาย', 'U4', 'Service', 'TODO', '2026-11-20', '2026-11-30', 'HIGH', 0),
  ];
  appendMany_(SHEETS.TASKS, tasks);

  var milestones = [
    { id: 'MS1', projectId: P1, name: 'อนุมัติแบบหน้าแรก', date: '2026-09-14', done: false },
    { id: 'MS2', projectId: P1, name: 'เว็บไซต์เปิดใช้งานจริง', date: '2026-10-31', done: false },
    { id: 'MS3', projectId: P2, name: 'กรุงศรีตรวจโชว์รูมผ่าน', date: '2026-09-08', done: false },
    { id: 'MS4', projectId: P2, name: 'เปิดหัวไฟแนนซ์สำเร็จ', date: '2026-09-25', done: false },
    { id: 'MS5', projectId: P3, name: 'อนุมัติวงเงิน Floor Plan', date: '2026-10-03', done: false },
    { id: 'MS6', projectId: P3, name: 'เซ็นสัญญาและเริ่มใช้วงเงิน', date: '2026-10-12', done: false },
    { id: 'MS7', projectId: P4, name: 'ปิดรับสมัครและคัดเลือกเสร็จ', date: '2026-09-28', done: false },
    { id: 'MS8', projectId: P4, name: 'พนักงานขายใหม่เริ่มงาน', date: '2026-10-05', done: false },
    { id: 'MS9', projectId: P5, name: 'ผังบัญชีใหม่พร้อมใช้', date: '2026-09-15', done: false },
    { id: 'MS10', projectId: P5, name: 'ปิดงบเดือนแรกด้วยระบบใหม่', date: '2026-10-31', done: false },
    { id: 'MS11', projectId: P6, name: 'แพ็กเกจ Operating Lease พร้อมเสนอ', date: '2026-09-15', done: false },
    { id: 'MS12', projectId: P6, name: 'ปิดดีลลูกค้าองค์กรรายแรก', date: '2026-11-20', done: false },
  ];
  appendMany_(SHEETS.MILESTONES, milestones);

  var activity = [
    { id: 'A1', projectId: P1, at: '2026-09-05 08:45', userId: 'U1', text: 'อัปโหลด Wireframe หน้าแรกใน Task "ออกแบบ UI/UX หน้าแรกและหน้ารถ"' },
    { id: 'A2', projectId: P2, at: '2026-09-04 14:10', userId: 'U2', text: 'ยื่นเอกสารขอเปิดหัวไฟแนนซ์ให้กรุงศรีเรียบร้อย รอเจ้าหน้าที่นัดตรวจโชว์รูม' },
    { id: 'A3', projectId: P6, at: '2026-09-04 11:20', userId: 'U3', text: 'อนุมัติงบเปิดตลาดลูกค้าองค์กร 70,000 บาท' },
    { id: 'A4', projectId: P4, at: '2026-09-03 10:05', userId: 'U5', text: 'เปิดประกาศรับสมัครพนักงานขาย 2 อัตรา' },
    { id: 'A5', projectId: P5, at: '2026-09-02 16:30', userId: 'U6', text: 'สรุปผลเปรียบเทียบโปรแกรมบัญชีและเลือกผู้ให้บริการแล้ว' },
    { id: 'A6', projectId: P3, at: '2026-09-08 09:15', userId: 'U6', text: 'เริ่มศึกษาเงื่อนไข Floor Plan ของ NISSAN' },
  ];
  appendMany_(SHEETS.ACTIVITY, activity);

  var notifications = [
    { id: 'N1', text: 'คุณได้รับ Task ใหม่ "ออกแบบ UI/UX หน้าแรกและหน้ารถ"', at: '09:10', read: false, kind: 'task' },
    { id: 'N2', text: '@ICE ถูก mention ใน "ทำ Presentation แพ็กเกจ Operating Lease"', at: '10:15', read: false, kind: 'mention' },
    { id: 'N3', text: 'Task "นัดเจ้าหน้าที่กรุงศรีเข้าตรวจโชว์รูม" ใกล้ครบกำหนด', at: '08:00', read: false, kind: 'deadline' },
    { id: 'N4', text: 'Task "วางผังบัญชีใหม่ให้ตรงกับธุรกิจรถ EV" อัปเดตความคืบหน้าเป็น 45%', at: 'เมื่อวาน', read: true, kind: 'update' },
  ];
  appendMany_(SHEETS.NOTIFICATIONS, notifications);
}
