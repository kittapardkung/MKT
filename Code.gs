/**
 * MKT Content Manager — Google Apps Script
 * ใช้คู่กับ Index.html เพียง 2 ไฟล์
 *
 * วิธีใช้:
 * 1) แนะนำให้สร้าง Apps Script แบบ "ผูกกับ Google Sheet" (bound script)
 * 2) วางไฟล์นี้เป็น Code.gs และหน้าเว็บเป็น Index.html
 * 3) แก้ TEAM / NOTIFY_EMAILS ด้านล่าง
 * 4) Run setupApp() 1 ครั้ง เพื่อสร้างชีต + Triggers
 * 5) Deploy > New deployment > Web app
 *
 * ถ้าเป็น Standalone Script:
 * ตั้ง Script Property ชื่อ SPREADSHEET_ID = ไอดี Google Sheet
 */

var APP = {
  TZ: 'Asia/Bangkok',
  SHEETS: {
    Posts: ['id','date','time','channel','title','format','status','owner','caption','tags','src_link','final_link','approved_by','approved_at','post_url'],
    Ideas: ['id','created_at','created_by','title','category','note','score','promoted_post_id'],
    Tags: ['tag','active','created_at'],
    Events: ['id','date','name','status','leads'],
    Targets: ['key','label','target','period'],
    Log: ['at','who','post_id','action','from','to','comment']
  },
  POST_STATUS: ['ร่าง','รออนุมัติ','อนุมัติแล้ว','เผยแพร่แล้ว'],
  FORMATS: ['ภาพ','วิดีโอ'],
  CHANNELS: ['Facebook','Instagram','TikTok','LINE OA','YouTube']
};

/**
 * แก้รายชื่อจริงของทีมตรงนี้
 * คนที่ไม่อยู่ใน TEAM จะเป็น creative
 */
var TEAM = {
  // 'editor@yourcompany.com': 'editor',
  // 'creative@yourcompany.com': 'creative'
};

/**
 * อีเมลรับ weekly digest / reminder
 * ถ้าปล่อยว่าง ระบบจะส่งหา editor ใน TEAM
 */
var NOTIFY_EMAILS = [
  // 'manager@yourcompany.com'
];

function doGet() {
  ensureSheets();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('MKT Content Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function apiPing() {
  return { ok: true, at: str_(new Date()), app: 'MKT Content Manager' };
}

/**
 * ใช้ Run ครั้งแรกจาก Apps Script Editor
 */
function setupApp() {
  ensureSheets();
  createTriggers();
  return 'พร้อมใช้งาน';
}

/**
 * สร้าง / ซ่อมโครงชีตโดยไม่ผูกกับตำแหน่งคอลัมน์
 * - ชีตที่มีอยู่แล้ว: เติมเฉพาะ header ที่ขาดไว้ด้านขวา
 * - GET_tel ไม่สร้าง เพราะเป็นชีต IMPORTRANGE จากฝ่ายขาย
 */
function ensureSheets() {
  var ss = db_();

  Object.keys(APP.SHEETS).forEach(function(name) {
    var wanted = APP.SHEETS[name];
    var sh = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, wanted.length).setValues([wanted]);
      styleHeader_(sh, wanted.length);
      sh.setFrozenRows(1);
      return;
    }

    var lastCol = Math.max(sh.getLastColumn(), 1);
    var headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
      .map(function(x) { return String(x || '').trim(); });

    // ชีตว่างจริง
    var hasAnyHeader = headers.some(function(x) { return !!x; });
    if (!hasAnyHeader) {
      sh.getRange(1, 1, 1, wanted.length).setValues([wanted]);
      styleHeader_(sh, wanted.length);
      sh.setFrozenRows(1);
      return;
    }

    var missing = wanted.filter(function(h) { return headers.indexOf(h) === -1; });
    if (missing.length) {
      sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
      styleHeader_(sh, lastCol + missing.length);
    }
    sh.setFrozenRows(1);
  });

  seedTargets_();
  seedTags_();
  return true;
}

function seedTargets_() {
  var sh = db_().getSheetByName('Targets');
  var rows = sheetObjects_(sh);
  if (rows.length) return;

  var defaults = [
    {key:'leads', label:'Lead Generation', target:150, period:'quarter'},
    {key:'content', label:'คอนเทนต์ที่ผลิต', target:20, period:'month'},
    {key:'video', label:'วิดีโอ', target:20, period:'month'},
    {key:'image', label:'ภาพ', target:20, period:'month'},
    {key:'events', label:'Event Test Drive', target:2, period:'quarter'}
  ];
  defaults.forEach(function(o) { appendObject_(sh, o); });
}

function seedTags_() {
  var sh = db_().getSheetByName('Tags');
  if (sheetObjects_(sh).length) return;

  ['รีวิวรถ','โปรโมชั่น','Event','ความรู้ EV','PORTA','Darion','วิดีโอสั้น'].forEach(function(tag) {
    appendObject_(sh, {tag:tag, active:true, created_at:new Date()});
  });
}

function apiBootstrap() {
  try {
    ensureSheets();

    var me = currentEmail_();
    var role = TEAM[me] || 'creative';
    var ss = db_();

    var result = {
      posts: cleanRows_(sheetObjects_(ss.getSheetByName('Posts'))),
      tags: cleanRows_(sheetObjects_(ss.getSheetByName('Tags'))),
      ideas: cleanRows_(sheetObjects_(ss.getSheetByName('Ideas'))),
      events: cleanRows_(sheetObjects_(ss.getSheetByName('Events'))),
      targets: cleanRows_(sheetObjects_(ss.getSheetByName('Targets'))),
      leads: leadSummary(),
      me: String(me || ''),
      role: String(role || 'creative')
    };

    return clean_(result);
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

function apiSavePost(post) {
  try {
    ensureSheets();
    post = post || {};
    var sh = db_().getSheetByName('Posts');
    var existing = null;

    if (post.id) existing = findByField_(sh, 'id', post.id);
    if (!existing && post._row) existing = { row: Number(post._row), data: objectAtRow_(sh, Number(post._row)) };

    if (!existing) throw new Error('ไม่พบคอนเทนต์ที่ต้องการแก้ไข');

    var before = existing.data;
    var next = normalizePost_(merge_(before, post), false);

    updateObjectAtRow_(sh, existing.row, next);

    var who = currentEmail_();
    if (String(before.status || '') !== String(next.status || '')) {
      log_(next.id, 'STATUS_CHANGE', before.status || '', next.status || '', post.comment || '', who);

      if (next.status === 'รออนุมัติ') {
        notifyEditorsPending_(next);
      }
    } else if (post.comment) {
      log_(next.id, 'COMMENT', '', '', post.comment, who);
    } else {
      log_(next.id, 'UPDATE', '', '', '', who);
    }

    return apiBootstrap();
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

function apiNewPost(o) {
  try {
    ensureSheets();
    o = o || {};
    var sh = db_().getSheetByName('Posts');

    var post = normalizePost_({
      id: newId_('P'),
      date: o.date || new Date(),
      time: o.time || '09:00',
      channel: o.channel || 'Facebook',
      title: o.title || 'คอนเทนต์ใหม่',
      format: o.format || 'ภาพ',
      status: o.status || 'ร่าง',
      owner: o.owner || currentEmail_(),
      caption: o.caption || '',
      tags: o.tags || '',
      src_link: o.src_link || monthlyFolderLink_(o.date),
      final_link: o.final_link || '',
      approved_by: '',
      approved_at: '',
      post_url: ''
    }, true);

    appendObject_(sh, post);
    log_(post.id, 'CREATE', '', post.status, o.comment || '', currentEmail_());

    return apiBootstrap();
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

/**
 * row รับได้ทั้ง:
 * - row number จริงในชีต
 * - post id
 * - object {id: "..."} หรือ {_row: 2}
 */
function apiApprove(row) {
  try {
    ensureSheets();

    if (role_() !== 'editor') {
      throw new Error('บัญชีนี้ไม่มีสิทธิ์อนุมัติคอนเทนต์');
    }

    var sh = db_().getSheetByName('Posts');
    var found = null;

    if (typeof row === 'object' && row) {
      if (row.id) found = findByField_(sh, 'id', row.id);
      else if (row._row) found = {row:Number(row._row), data:objectAtRow_(sh, Number(row._row))};
    } else if (typeof row === 'number') {
      found = {row:Number(row), data:objectAtRow_(sh, Number(row))};
    } else {
      found = findByField_(sh, 'id', String(row || ''));
    }

    if (!found || !found.data || !found.data.id) throw new Error('ไม่พบคอนเทนต์');

    var before = found.data;
    var who = currentEmail_();
    var next = merge_(before, {
      status: 'อนุมัติแล้ว',
      approved_by: who,
      approved_at: new Date()
    });

    next = normalizePost_(next, false);
    updateObjectAtRow_(sh, found.row, next);
    log_(next.id, 'APPROVE', before.status || '', 'อนุมัติแล้ว', '', who);

    return apiBootstrap();
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

function apiPromoteIdea(o) {
  try {
    ensureSheets();
    o = o || {};

    var ss = db_();
    var ideaSh = ss.getSheetByName('Ideas');
    var postSh = ss.getSheetByName('Posts');

    var found = findByField_(ideaSh, 'id', o.id);
    if (!found) throw new Error('ไม่พบไอเดีย');

    var idea = found.data;
    var post = normalizePost_({
      id: newId_('P'),
      date: o.date || new Date(),
      time: o.time || '09:00',
      channel: o.channel || 'Facebook',
      title: o.title || idea.title || 'คอนเทนต์ใหม่',
      format: o.format || 'ภาพ',
      status: 'ร่าง',
      owner: o.owner || currentEmail_(),
      caption: '',
      tags: o.tags || idea.category || '',
      src_link: o.src_link || monthlyFolderLink_(o.date),
      final_link: '',
      approved_by: '',
      approved_at: '',
      post_url: ''
    }, true);

    appendObject_(postSh, post);
    updateObjectAtRow_(ideaSh, found.row, merge_(idea, {promoted_post_id:post.id}));
    log_(post.id, 'PROMOTE_IDEA', '', 'ร่าง', idea.title || '', currentEmail_());

    return apiBootstrap();
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

function apiAddTag(tag) {
  try {
    ensureSheets();
    tag = String(tag || '').trim();
    if (!tag) throw new Error('กรุณาระบุชื่อแท็ก');

    var sh = db_().getSheetByName('Tags');
    var existing = findByField_(sh, 'tag', tag);

    if (existing) {
      updateObjectAtRow_(sh, existing.row, merge_(existing.data, {active:true}));
    } else {
      appendObject_(sh, {tag:tag, active:true, created_at:new Date()});
    }

    return apiBootstrap();
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

function apiRemoveTag(tag) {
  try {
    ensureSheets();
    tag = String(tag || '').trim();
    if (!tag) throw new Error('กรุณาระบุชื่อแท็ก');

    var ss = db_();
    var tagSh = ss.getSheetByName('Tags');
    var found = findByField_(tagSh, 'tag', tag);

    if (found) {
      updateObjectAtRow_(tagSh, found.row, merge_(found.data, {active:false}));
    }

    // ปลดแท็กออกจาก Posts ทั้งหมดด้วย
    var postSh = ss.getSheetByName('Posts');
    var posts = sheetObjects_(postSh);
    posts.forEach(function(p) {
      var arr = csvTags_(p.tags);
      var next = arr.filter(function(x) { return x !== tag; });
      if (arr.join(',') !== next.join(',')) {
        updateObjectAtRow_(postSh, p._row, merge_(p, {tags:next.join(', ')}));
      }
    });

    return apiBootstrap();
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

/**
 * API เสริมสำหรับคลังไอเดีย
 */
function apiAddIdea(o) {
  try {
    ensureSheets();
    o = o || {};
    if (!String(o.title || '').trim()) throw new Error('กรุณาระบุชื่อไอเดีย');

    var sh = db_().getSheetByName('Ideas');
    appendObject_(sh, {
      id: newId_('I'),
      created_at: new Date(),
      created_by: currentEmail_(),
      title: String(o.title || '').trim(),
      category: String(o.category || '').trim(),
      note: String(o.note || '').trim(),
      score: Number(o.score || 0),
      promoted_post_id: ''
    });

    return apiBootstrap();
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

function apiDeleteIdea(id) {
  try {
    ensureSheets();
    var sh = db_().getSheetByName('Ideas');
    var found = findByField_(sh, 'id', id);
    if (!found) throw new Error('ไม่พบไอเดีย');
    sh.deleteRow(found.row);
    return apiBootstrap();
  } catch (err) {
    return { error: errorMessage_(err) };
  }
}

/**
 * อ่าน GET_tel แบบ READ ONLY
 * นับ Phone_Number ไม่ซ้ำ = 1 lead
 * พร้อมคืน raw summary ที่หน้าเว็บสามารถกรองตามช่วงเวลาได้
 */
function leadSummary() {
  try {
    var sh = db_().getSheetByName('GET_tel');
    if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) {
      return emptyLeadSummary_();
    }

    var values = sh.getDataRange().getDisplayValues();
    var headers = values[0].map(function(h) { return String(h || '').trim(); });
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    var required = ['Created_Date','Phone_Number','Source','Interested_Model','Lead_Status'];
    var okay = required.every(function(h) { return Object.prototype.hasOwnProperty.call(idx, h); });
    if (!okay) return emptyLeadSummary_();

    var seen = {};
    var rows = [];

    for (var r = 1; r < values.length; r++) {
      var phone = normalizePhone_(values[r][idx.Phone_Number]);
      if (!phone || seen[phone]) continue;
      seen[phone] = true;

      rows.push({
        date: normalizeDateText_(values[r][idx.Created_Date]),
        phone: phone,
        source: String(values[r][idx.Source] || '').trim(),
        model: String(values[r][idx.Interested_Model] || '').trim(),
        status: String(values[r][idx.Lead_Status] || '').trim()
      });
    }

    return summarizeLeadRows_(rows);
  } catch (err) {
    return emptyLeadSummary_();
  }
}

/**
 * Debug: ดูค่าที่พบใน Source ทั้งหมด
 * ผลลัพธ์ดูได้จาก Execution log
 */
function inspectLeadSources() {
  var sh = db_().getSheetByName('GET_tel');
  if (!sh || sh.getLastRow() < 2) {
    console.log('GET_tel ไม่มีข้อมูล');
    return [];
  }

  var values = sh.getDataRange().getDisplayValues();
  var headers = values[0].map(function(x) { return String(x || '').trim(); });
  var idx = headers.indexOf('Source');

  if (idx === -1) {
    console.log('ไม่พบ header: Source');
    return [];
  }

  var sourceValues = values.slice(1).map(function(r) { return String(r[idx] || '').trim(); });
  console.log(JSON.stringify(sourceValues));
  return sourceValues;
}

/**
 * Trigger: ทุกวัน 09:00
 */
function remindPending() {
  ensureSheets();

  var posts = sheetObjects_(db_().getSheetByName('Posts'))
    .filter(function(p) { return p.status === 'รออนุมัติ'; });

  if (!posts.length) return;

  var recipients = notificationEmails_();
  if (!recipients.length) return;

  var lines = posts.map(function(p) {
    return '- ' + displayDate_(p.date) + ' ' + String(p.time || '') + ' | ' +
      String(p.title || '') + ' | ' + String(p.channel || '');
  });

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: '[MKT Content] งานรออนุมัติ ' + posts.length + ' รายการ',
    body:
      'มีคอนเทนต์รออนุมัติ ' + posts.length + ' รายการ\n\n' +
      lines.join('\n') +
      '\n\nกรุณาเปิด MKT Content Manager เพื่อตรวจและอนุมัติ'
  });
}

/**
 * Trigger: ทุกวันจันทร์ 08:00
 */
function weeklyDigest() {
  ensureSheets();

  var ss = db_();
  var posts = sheetObjects_(ss.getSheetByName('Posts'));
  var events = sheetObjects_(ss.getSheetByName('Events'));
  var leads = leadSummary();

  var now = new Date();
  var start = new Date(now);
  start.setDate(now.getDate() - 7);
  start.setHours(0,0,0,0);

  var content7 = posts.filter(function(p) {
    var d = parseDate_(p.date);
    return d && d >= start && d <= now;
  }).length;

  var event7 = events.filter(function(e) {
    var d = parseDate_(e.date);
    return d && d >= start && d <= now;
  }).length;

  var lead7 = (leads.rows || []).filter(function(l) {
    var d = parseDate_(l.date);
    return d && d >= start && d <= now;
  }).length;

  var pending = posts.filter(function(p) { return p.status === 'รออนุมัติ'; }).length;
  var recipients = notificationEmails_();
  if (!recipients.length) return;

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: '[MKT Content] Weekly KPI Digest',
    body:
      'สรุป KPI 7 วันที่ผ่านมา\n\n' +
      'คอนเทนต์: ' + content7 + ' ชิ้น\n' +
      'ลีดไม่ซ้ำ: ' + lead7 + ' ลีด\n' +
      'Event: ' + event7 + ' ครั้ง\n' +
      'งานรออนุมัติปัจจุบัน: ' + pending + ' รายการ\n'
  });
}

function createTriggers() {
  var names = ['remindPending','weeklyDigest'];

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (names.indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('remindPending')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  ScriptApp.newTrigger('weeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  return true;
}

/* =========================
   INTERNAL HELPERS
   ========================= */

function db_() {
  var propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (propId) return SpreadsheetApp.openById(propId);

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('ไม่พบ Spreadsheet: ถ้าใช้ Standalone Script ให้ตั้ง Script Property ชื่อ SPREADSHEET_ID');
  }
  return active;
}

function styleHeader_(sh, lastCol) {
  if (!lastCol) return;
  sh.getRange(1,1,1,lastCol)
    .setFontWeight('bold')
    .setBackground('#eef5fb')
    .setFontColor('#17324d');
}

function headers_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1,1,1,lastCol).getDisplayValues()[0]
    .map(function(x) { return String(x || '').trim(); });
}

function headerMap_(sh) {
  var map = {};
  headers_(sh).forEach(function(h, i) {
    if (h) map[h] = i + 1;
  });
  return map;
}

function sheetObjects_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];

  var range = sh.getDataRange();
  var raw = range.getValues();
  var display = range.getDisplayValues();
  var hdr = display[0].map(function(x) { return String(x || '').trim(); });
  var out = [];

  for (var r = 1; r < raw.length; r++) {
    var isBlank = display[r].every(function(v) { return String(v || '').trim() === ''; });
    if (isBlank) continue;

    var o = {_row:r+1};
    hdr.forEach(function(h, c) {
      if (!h) return;
      o[h] = raw[r][c];
    });
    out.push(o);
  }
  return out;
}

function objectAtRow_(sh, row) {
  row = Number(row);
  if (!row || row < 2 || row > sh.getLastRow()) return null;

  var hdr = headers_(sh);
  var vals = sh.getRange(row, 1, 1, hdr.length).getValues()[0];
  var o = {_row:row};
  hdr.forEach(function(h, i) {
    if (h) o[h] = vals[i];
  });
  return o;
}

function appendObject_(sh, obj) {
  var hdr = headers_(sh);
  var row = hdr.map(function(h) {
    return toCellValue_(obj[h]);
  });
  sh.appendRow(row);
}

function updateObjectAtRow_(sh, row, obj) {
  var hdr = headers_(sh);
  var map = headerMap_(sh);

  Object.keys(obj || {}).forEach(function(k) {
    if (k === '_row' || !map[k]) return;
    sh.getRange(row, map[k]).setValue(toCellValue_(obj[k]));
  });
}

function findByField_(sh, field, value) {
  var rows = sheetObjects_(sh);
  var target = String(value == null ? '' : value).trim();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][field] == null ? '' : rows[i][field]).trim() === target) {
      return {row:rows[i]._row, data:rows[i]};
    }
  }
  return null;
}

function normalizePost_(p, isNew) {
  p = p || {};

  var status = APP.POST_STATUS.indexOf(String(p.status || '')) !== -1 ? String(p.status) : 'ร่าง';
  var format = APP.FORMATS.indexOf(String(p.format || '')) !== -1 ? String(p.format) : 'ภาพ';
  var channel = APP.CHANNELS.indexOf(String(p.channel || '')) !== -1 ? String(p.channel) : 'Facebook';

  return {
    id: String(p.id || (isNew ? newId_('P') : '')),
    date: parseDate_(p.date) || new Date(),
    time: normalizeTime_(p.time),
    channel: channel,
    title: String(p.title || '').trim(),
    format: format,
    status: status,
    owner: String(p.owner || '').trim(),
    caption: String(p.caption || ''),
    tags: csvTags_(p.tags).join(', '),
    src_link: String(p.src_link || '').trim(),
    final_link: String(p.final_link || '').trim(),
    approved_by: String(p.approved_by || '').trim(),
    approved_at: p.approved_at ? (parseDateTime_(p.approved_at) || p.approved_at) : '',
    post_url: String(p.post_url || '').trim()
  };
}

function log_(postId, action, fromValue, toValue, comment, who) {
  appendObject_(db_().getSheetByName('Log'), {
    at: new Date(),
    who: who || currentEmail_(),
    post_id: postId || '',
    action: action || '',
    from: fromValue || '',
    to: toValue || '',
    comment: comment || ''
  });
}

function currentEmail_() {
  try {
    return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (err) {
    return '';
  }
}

function role_() {
  var email = currentEmail_();
  return TEAM[email] || 'creative';
}

function notificationEmails_() {
  var list = NOTIFY_EMAILS.slice();

  Object.keys(TEAM).forEach(function(email) {
    if (TEAM[email] === 'editor') list.push(email);
  });

  var unique = {};
  return list
    .map(function(x) { return String(x || '').trim().toLowerCase(); })
    .filter(function(x) {
      if (!x || unique[x]) return false;
      unique[x] = true;
      return true;
    });
}

function notifyEditorsPending_(post) {
  var recipients = notificationEmails_();
  if (!recipients.length) return;

  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: '[MKT Content] รออนุมัติ: ' + String(post.title || ''),
      body:
        'มีคอนเทนต์ใหม่รออนุมัติ\n\n' +
        'หัวเรื่อง: ' + String(post.title || '') + '\n' +
        'วันที่: ' + displayDate_(post.date) + '\n' +
        'เวลา: ' + String(post.time || '') + '\n' +
        'ช่องทาง: ' + String(post.channel || '') + '\n' +
        'ผู้รับผิดชอบ: ' + String(post.owner || '') + '\n' +
        'งานสำเร็จ: ' + String(post.final_link || '-')
    });
  } catch (err) {
    console.log('notifyEditorsPending_ error: ' + errorMessage_(err));
  }
}

function monthlyFolderLink_(dateValue) {
  var d = parseDate_(dateValue) || new Date();
  var key = 'DRIVE_FOLDER_' + Utilities.formatDate(d, APP.TZ, 'yyyy_MM');
  return String(PropertiesService.getScriptProperties().getProperty(key) || '');
}

function summarizeLeadRows_(rows) {
  var sources = {};
  var models = {};
  var statuses = {};

  rows.forEach(function(r) {
    var s = r.source || '(ไม่ระบุ)';
    var m = r.model || '(ไม่ระบุ)';
    var st = r.status || '(ไม่ระบุ)';
    sources[s] = (sources[s] || 0) + 1;
    models[m] = (models[m] || 0) + 1;
    statuses[st] = (statuses[st] || 0) + 1;
  });

  return {
    total: rows.length,
    sources: countMapToArray_(sources),
    models: countMapToArray_(models),
    statuses: countMapToArray_(statuses),
    rows: rows
  };
}

function emptyLeadSummary_() {
  return {total:0, sources:[], models:[], statuses:[], rows:[]};
}

function countMapToArray_(map) {
  var total = Object.keys(map).reduce(function(sum, k) { return sum + Number(map[k] || 0); }, 0);

  return Object.keys(map)
    .map(function(k) {
      var count = Number(map[k] || 0);
      return {
        name: k,
        count: count,
        pct: total ? Math.round((count / total) * 1000) / 10 : 0
      };
    })
    .sort(function(a,b) { return b.count - a.count; });
}

function normalizePhone_(v) {
  return String(v || '').replace(/[^\d+]/g, '').trim();
}

function normalizeTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, APP.TZ, 'HH:mm');

  var s = String(v || '').trim();
  if (!s) return '09:00';

  var m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return s;

  return ('0' + m[1]).slice(-2) + ':' + m[2];
}

function normalizeDateText_(v) {
  var d = parseDate_(v);
  if (d) return Utilities.formatDate(d, APP.TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}

function displayDate_(v) {
  var d = parseDate_(v);
  return d ? Utilities.formatDate(d, APP.TZ, 'dd/MM/yyyy') : String(v || '');
}

function parseDate_(v) {
  if (!v && v !== 0) return null;

  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(v.getTime());
  }

  var s = String(v).trim();
  if (!s) return null;

  // yyyy-MM-dd
  var a = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (a) return new Date(Number(a[1]), Number(a[2])-1, Number(a[3]));

  // dd/MM/yyyy หรือ dd-MM-yyyy
  var b = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (b) {
    var year = Number(b[3]);
    if (year > 2400) year -= 543;
    return new Date(year, Number(b[2])-1, Number(b[1]));
  }

  var nativeDate = new Date(s);
  if (!isNaN(nativeDate.getTime())) return nativeDate;

  return null;
}

function parseDateTime_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function csvTags_(v) {
  var arr = Array.isArray(v) ? v : String(v || '').split(',');
  var seen = {};

  return arr.map(function(x) { return String(x || '').trim(); })
    .filter(function(x) {
      if (!x || seen[x]) return false;
      seen[x] = true;
      return true;
    });
}

function newId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMddHHmmss') + '-' +
    Math.floor(1000 + Math.random() * 9000);
}

function merge_(a, b) {
  var out = {};
  Object.keys(a || {}).forEach(function(k) { out[k] = a[k]; });
  Object.keys(b || {}).forEach(function(k) {
    if (k !== '_row') out[k] = b[k];
  });
  return out;
}

function toCellValue_(v) {
  if (v === null || typeof v === 'undefined') return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v;
  return String(v);
}

function cleanRows_(rows) {
  return (rows || []).map(function(o) { return clean_(o); });
}

/**
 * แปลง Date / object / array ให้ serialize ผ่าน google.script.run ได้ชัวร์
 */
function clean_(v) {
  if (v === null || typeof v === 'undefined') return '';
  if (v instanceof Date) return Utilities.formatDate(v, APP.TZ, "yyyy-MM-dd'T'HH:mm:ss");
  if (Array.isArray(v)) return v.map(clean_);

  if (typeof v === 'object') {
    var o = {};
    Object.keys(v).forEach(function(k) { o[k] = clean_(v[k]); });
    return o;
  }

  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}

function errorMessage_(err) {
  if (!err) return 'Unknown error';
  return String(err.message || err.toString() || err);
}

function str_(v) {
  return clean_(v);
}
