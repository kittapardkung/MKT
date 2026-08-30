/**
 * MKT Content Manager — Apps Script backend
 *
 * Data model lives in a Google Sheet (bound to this script, or referenced by
 * Script Property SPREADSHEET_ID). Sheets are created automatically on first
 * run with the headers/seed data below — see ensureSheets().
 *
 * Web app entry point: doGet(). All read/write calls used by Index.html go
 * through the api* functions below, each of which returns the full
 * bootstrap payload (see buildBootstrap) so the client can simply re-render.
 */

var SHEETS = {
  POSTS: 'Posts',
  TAGS: 'Tags',
  IDEAS: 'Ideas',
  EVENTS: 'Events',
  TARGETS: 'Targets',
  LEADS: 'Leads',
  USERS: 'Users',
  LOG: 'Log'
};

var HEADERS = {
  Posts: ['id','date','time','channel','title','format','status','owner','src_link','final_link','post_url','caption','tags','approved_by','approved_at','created_at','updated_at'],
  Tags: ['tag','active'],
  Ideas: ['id','title','category','score','note','promoted_post_id','created_at'],
  Events: ['date','title','note'],
  Targets: ['key','target'],
  Leads: ['date','source','model'],
  Users: ['email','role'],
  Log: ['timestamp','post_id','user','comment','status']
};

/* ======================
   WEB APP ENTRY POINT
   ====================== */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('MKT Content Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('MKT Content')
      .addItem('ตั้งค่าเริ่มต้น (Initialize Sheets)', 'setupSheets')
      .addToUi();
  } catch (e) {
    // Not bound to a spreadsheet UI context (e.g. running from the editor) — ignore.
  }
}

function setupSheets() {
  var ss = getSpreadsheet();
  ensureSheets(ss);
  try {
    SpreadsheetApp.getUi().alert('ตั้งค่าชีตเริ่มต้นเรียบร้อยแล้ว');
  } catch (e) {
    // no UI available
  }
}

/* ======================
   PUBLIC API — called from Index.html via google.script.run
   ====================== */

function apiBootstrap() {
  try {
    return buildBootstrap();
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
}

function apiSavePost(payload) {
  if (!payload || !payload.id) throw new Error('ไม่พบรหัสคอนเทนต์');
  if (!String(payload.title || '').trim()) throw new Error('กรุณาระบุหัวเรื่อง');
  if (!payload.date) throw new Error('กรุณาระบุวันที่');

  var ss = getSpreadsheet();
  ensureSheets(ss);

  var sheet = ss.getSheetByName(SHEETS.POSTS);
  var headers = getHeaders(sheet);
  var rowIndex = findRowIndexById(sheet, headers, payload.id);
  if (rowIndex === -1) throw new Error('ไม่พบคอนเทนต์รหัส ' + payload.id);

  var fields = {
    date: payload.date,
    time: payload.time || '',
    channel: payload.channel || '',
    title: String(payload.title).trim(),
    format: payload.format || '',
    status: payload.status || 'ร่าง',
    owner: payload.owner || '',
    src_link: payload.src_link || '',
    final_link: payload.final_link || '',
    post_url: payload.post_url || '',
    caption: payload.caption || '',
    tags: payload.tags || '',
    updated_at: new Date()
  };
  updateRowFields(sheet, headers, rowIndex, fields);

  if (payload.comment && String(payload.comment).trim()) {
    appendLog(ss, payload.id, getActiveEmail(), String(payload.comment).trim(), fields.status);
  }

  return buildBootstrap();
}

function apiNewPost(payload) {
  if (!payload) throw new Error('ไม่มีข้อมูล');
  if (!String(payload.title || '').trim()) throw new Error('กรุณาระบุหัวเรื่อง');
  if (!payload.date) throw new Error('กรุณาระบุวันที่');

  var ss = getSpreadsheet();
  ensureSheets(ss);

  var sheet = ss.getSheetByName(SHEETS.POSTS);
  var headers = getHeaders(sheet);
  var id = 'P' + Utilities.getUuid().split('-')[0].toUpperCase();
  var now = new Date();

  appendRow(sheet, headers, {
    id: id,
    date: payload.date,
    time: payload.time || '',
    channel: payload.channel || '',
    title: String(payload.title).trim(),
    format: payload.format || '',
    status: payload.status || 'ร่าง',
    owner: payload.owner || '',
    src_link: payload.src_link || '',
    final_link: payload.final_link || '',
    post_url: payload.post_url || '',
    caption: payload.caption || '',
    tags: payload.tags || '',
    approved_by: '',
    approved_at: '',
    created_at: now,
    updated_at: now
  });

  if (payload.comment && String(payload.comment).trim()) {
    appendLog(ss, id, getActiveEmail(), String(payload.comment).trim(), payload.status || 'ร่าง');
  }

  return buildBootstrap();
}

function apiApprove(id) {
  if (!id) throw new Error('ไม่พบรหัสคอนเทนต์');

  var ss = getSpreadsheet();
  ensureSheets(ss);

  var me = getActiveEmail();
  if (getRole(ss, me) !== 'editor') {
    throw new Error('เฉพาะบรรณาธิการ (editor) เท่านั้นที่อนุมัติคอนเทนต์ได้');
  }

  var sheet = ss.getSheetByName(SHEETS.POSTS);
  var headers = getHeaders(sheet);
  var rowIndex = findRowIndexById(sheet, headers, id);
  if (rowIndex === -1) throw new Error('ไม่พบคอนเทนต์รหัส ' + id);

  var now = new Date();
  updateRowFields(sheet, headers, rowIndex, {
    status: 'อนุมัติแล้ว',
    approved_by: me,
    approved_at: now,
    updated_at: now
  });
  appendLog(ss, id, me, 'อนุมัติคอนเทนต์', 'อนุมัติแล้ว');

  return buildBootstrap();
}

function apiAddTag(tagName) {
  var tag = String(tagName || '').trim();
  if (!tag) throw new Error('กรุณาระบุชื่อแท็ก');

  var ss = getSpreadsheet();
  ensureSheets(ss);

  var sheet = ss.getSheetByName(SHEETS.TAGS);
  var headers = getHeaders(sheet);
  var rows = readSheetRaw(sheet);
  var existing = rows.filter(function (r) {
    return String(r.tag || '').trim().toLowerCase() === tag.toLowerCase();
  })[0];

  if (existing) {
    updateRowFields(sheet, headers, existing._row, { active: true });
  } else {
    appendRow(sheet, headers, { tag: tag, active: true });
  }

  return buildBootstrap();
}

function apiRemoveTag(tagName) {
  var tag = String(tagName || '').trim();
  if (!tag) throw new Error('กรุณาระบุชื่อแท็ก');

  var ss = getSpreadsheet();
  ensureSheets(ss);

  var tagSheet = ss.getSheetByName(SHEETS.TAGS);
  var tagHeaders = getHeaders(tagSheet);
  var tagRows = readSheetRaw(tagSheet);
  var found = tagRows.filter(function (r) {
    return String(r.tag || '').trim().toLowerCase() === tag.toLowerCase();
  })[0];
  if (found) updateRowFields(tagSheet, tagHeaders, found._row, { active: false });

  var postSheet = ss.getSheetByName(SHEETS.POSTS);
  var postHeaders = getHeaders(postSheet);
  var posts = readSheetRaw(postSheet);
  posts.forEach(function (p) {
    var list = String(p.tags || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].toLowerCase() === tag.toLowerCase()) { idx = i; break; }
    }
    if (idx !== -1) {
      list.splice(idx, 1);
      updateRowFields(postSheet, postHeaders, p._row, { tags: list.join(', ') });
    }
  });

  return buildBootstrap();
}

function apiAddIdea(payload) {
  if (!payload || !String(payload.title || '').trim()) throw new Error('กรุณาระบุชื่อไอเดีย');

  var ss = getSpreadsheet();
  ensureSheets(ss);

  var sheet = ss.getSheetByName(SHEETS.IDEAS);
  var headers = getHeaders(sheet);
  var id = 'I' + Utilities.getUuid().split('-')[0].toUpperCase();

  appendRow(sheet, headers, {
    id: id,
    title: String(payload.title).trim(),
    category: payload.category || '',
    score: Number(payload.score || 0),
    note: payload.note || '',
    promoted_post_id: '',
    created_at: new Date()
  });

  return buildBootstrap();
}

function apiPromoteIdea(payload) {
  if (!payload || !payload.id) throw new Error('ไม่พบรหัสไอเดีย');
  if (!payload.date) throw new Error('กรุณาเลือกวันที่');

  var ss = getSpreadsheet();
  ensureSheets(ss);

  var ideaSheet = ss.getSheetByName(SHEETS.IDEAS);
  var ideaHeaders = getHeaders(ideaSheet);
  var ideaRowIndex = findRowIndexById(ideaSheet, ideaHeaders, payload.id);
  if (ideaRowIndex === -1) throw new Error('ไม่พบไอเดียรหัส ' + payload.id);

  var ideaRows = readSheetRaw(ideaSheet);
  var idea = ideaRows.filter(function (r) { return r._row === ideaRowIndex; })[0];
  if (idea && idea.promoted_post_id) throw new Error('ไอเดียนี้ถูกส่งเข้าปฏิทินแล้ว');

  var postSheet = ss.getSheetByName(SHEETS.POSTS);
  var postHeaders = getHeaders(postSheet);
  var postId = 'P' + Utilities.getUuid().split('-')[0].toUpperCase();
  var now = new Date();

  appendRow(postSheet, postHeaders, {
    id: postId,
    date: payload.date,
    time: payload.time || '09:00',
    channel: payload.channel || 'Facebook',
    title: payload.title || (idea ? idea.title : ''),
    format: payload.format || 'ภาพ',
    status: 'ร่าง',
    owner: getActiveEmail(),
    src_link: '',
    final_link: '',
    post_url: '',
    caption: '',
    tags: '',
    approved_by: '',
    approved_at: '',
    created_at: now,
    updated_at: now
  });

  updateRowFields(ideaSheet, ideaHeaders, ideaRowIndex, { promoted_post_id: postId });

  return buildBootstrap();
}

/* ======================
   BOOTSTRAP / READ
   ====================== */

function buildBootstrap() {
  var ss = getSpreadsheet();
  ensureSheets(ss);

  var me = getActiveEmail();

  return {
    me: me,
    role: getRole(ss, me),
    posts: readPosts(ss),
    tags: readTags(ss),
    ideas: readIdeas(ss),
    events: readEvents(ss),
    targets: readTargets(ss),
    leads: readLeads(ss)
  };
}

function readPosts(ss) {
  var sheet = ss.getSheetByName(SHEETS.POSTS);
  return readSheetRaw(sheet).map(function (r) {
    return {
      id: String(r.id || ''),
      date: toDateStr(r.date),
      time: toTimeStr(r.time),
      channel: r.channel || '',
      title: r.title || '',
      format: r.format || '',
      status: r.status || 'ร่าง',
      owner: r.owner || '',
      src_link: r.src_link || '',
      final_link: r.final_link || '',
      post_url: r.post_url || '',
      caption: r.caption || '',
      tags: r.tags || '',
      approved_by: r.approved_by || '',
      approved_at: toIsoStr(r.approved_at)
    };
  });
}

function readTags(ss) {
  var sheet = ss.getSheetByName(SHEETS.TAGS);
  return readSheetRaw(sheet).map(function (r) {
    return { tag: String(r.tag || ''), active: r.active };
  });
}

function readIdeas(ss) {
  var sheet = ss.getSheetByName(SHEETS.IDEAS);
  return readSheetRaw(sheet).map(function (r) {
    return {
      id: String(r.id || ''),
      title: r.title || '',
      category: r.category || '',
      score: Number(r.score || 0),
      note: r.note || '',
      promoted_post_id: r.promoted_post_id ? String(r.promoted_post_id) : ''
    };
  });
}

function readEvents(ss) {
  var sheet = ss.getSheetByName(SHEETS.EVENTS);
  return readSheetRaw(sheet).map(function (r) {
    return { date: toDateStr(r.date), title: r.title || '', note: r.note || '' };
  });
}

function readTargets(ss) {
  var sheet = ss.getSheetByName(SHEETS.TARGETS);
  return readSheetRaw(sheet).map(function (r) {
    return { key: String(r.key || ''), target: Number(r.target || 0) };
  });
}

function readLeads(ss) {
  var sheet = ss.getSheetByName(SHEETS.LEADS);
  var rows = readSheetRaw(sheet).map(function (r) {
    return { date: toDateStr(r.date), source: r.source || '', model: r.model || '' };
  });
  return { total: rows.length, rows: rows, sources: [], models: [] };
}

/* ======================
   SHEET / SPREADSHEET HELPERS
   ====================== */

function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('ไม่พบ Spreadsheet: กรุณารันสคริปต์นี้จากสเปรดชีตที่ผูกไว้ หรือกำหนด Script Property "SPREADSHEET_ID"');
  }
  return SpreadsheetApp.openById(id);
}

function ensureSheets(ss) {
  Object.keys(HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sheet.setFrozenRows(1);
      seedSheet(sheet, name);
    }
  });
}

function seedSheet(sheet, name) {
  if (name === 'Targets') {
    sheet.getRange(2, 1, 5, 2).setValues([
      ['leads', 150],
      ['content', 20],
      ['video', 20],
      ['image', 20],
      ['events', 2]
    ]);
  } else if (name === 'Tags') {
    sheet.getRange(2, 1, 4, 2).setValues([
      ['โปรโมชั่น', true],
      ['รีวิว', true],
      ['เปิดตัวรถใหม่', true],
      ['กิจกรรม', true]
    ]);
  } else if (name === 'Users') {
    var email = getActiveEmail();
    if (email) sheet.getRange(2, 1, 1, 2).setValues([[email, 'editor']]);
  }
}

function getHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
}

function readSheetRaw(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var headers = getHeaders(sheet);
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var isEmpty = row.every(function (c) { return c === '' || c === null; });
    if (isEmpty) continue;

    var obj = { _row: i + 2 };
    headers.forEach(function (h, idx) { obj[h] = row[idx]; });
    out.push(obj);
  }

  return out;
}

function appendRow(sheet, headers, obj) {
  var row = headers.map(function (h) { return (h in obj) ? obj[h] : ''; });
  sheet.appendRow(row);
}

function findRowIndexById(sheet, headers, id) {
  var idCol = headers.indexOf('id') + 1;
  if (idCol === 0) return -1;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var data = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function updateRowFields(sheet, headers, rowIndex, fields) {
  Object.keys(fields).forEach(function (key) {
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowIndex, col).setValue(fields[key]);
  });
}

function appendLog(ss, postId, user, comment, status) {
  var sheet = ss.getSheetByName(SHEETS.LOG);
  var headers = getHeaders(sheet);
  appendRow(sheet, headers, {
    timestamp: new Date(),
    post_id: postId,
    user: user || '',
    comment: comment,
    status: status || ''
  });
}

/* ======================
   USERS / ROLE
   ====================== */

function getActiveEmail() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (e) {}
  if (!email) {
    try { email = Session.getEffectiveUser().getEmail(); } catch (e) {}
  }
  return email || '';
}

function getRole(ss, email) {
  if (!email) return 'creative';

  var sheet = ss.getSheetByName(SHEETS.USERS);
  var rows = readSheetRaw(sheet);
  var found = rows.filter(function (r) {
    return String(r.email || '').trim().toLowerCase() === email.toLowerCase();
  })[0];

  if (found && String(found.role || '').trim().toLowerCase() === 'editor') return 'editor';
  return 'creative';
}

/* ======================
   TYPE COERCION HELPERS
   ====================== */

function toDateStr(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

function toTimeStr(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(v);
}

function toIsoStr(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return v.toISOString();
  return String(v);
}
