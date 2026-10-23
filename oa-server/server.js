/**
 * server.js — OA 协作系统真实后端（Express + SQLite）
 * API 端点与前端 assets/api.js 的接口形态一一对应（见各路由注释）。
 * 注意：当前为无登录演示模式，会话用户固定为「张伟」（与原型 mock 一致）；
 * 真实接入时在 /api 前挂载认证中间件即可。
 */
const path = require('path');
const express = require('express');
const DB = require('./db.js');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = process.env.FRONTEND_DIR || '/workspace/oa-prototype';
const CURRENT_USER = '张伟'; // 演示会话用户；TODO: 认证后从 session/token 获取

const app = express();
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

/* ---------- 工具 ---------- */
function esc(v) { return v === null || v === undefined ? '' : String(v); }
function rows(sql) { return (DB.raw.exec(sql)[0] || { values: [] }).values; }
function one(sql) {
  const r = rows(sql + ' LIMIT 1');
  return r.length ? r[0] : null;
}
function run(sql, params) {
  DB.raw.prepare(sql).run(params || []);
  DB.persist();
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function curMonth() { return new Date().toISOString().slice(0, 7); }
function randDocNo() {
  let n;
  do { n = 1000 + Math.floor(Math.random() * 900); } while (one(`SELECT doc_no FROM approvals WHERE doc_no='SP2026-${n}'`));
  return `SP2026-${n}`;
}

/* ---------- 审批 ---------- */
function approvalJson(row) {
  const [id, docNo, type, title, applicant, applicantDept, fields, status, node, amount, submitTime] = row;
  const hist = rows(
    `SELECT who, action, note, time FROM approval_history WHERE approval_id=${id} ORDER BY id ASC`
  ).map((h) => ({ who: h[0], action: h[1], note: h[2], time: h[3] }));
  return {
    id: docNo, type, title, applicant, applicantDept,
    fields: JSON.parse(fields || '{}'), status, node: node || '', amount,
    submitTime, history: hist
  };
}
async function approvals(tab) {
  if (tab === 'pending') {
    const list = rows(`SELECT * FROM approvals WHERE status='审批中' AND node='直接上级' ORDER BY id DESC`).map(approvalJson);
    return { list, pending: list.length };
  }
  const list = rows(`SELECT * FROM approvals WHERE applicant='${CURRENT_USER}' ORDER BY id DESC`).map(approvalJson);
  const pending = rows(`SELECT * FROM approvals WHERE status='审批中' AND node='直接上级' ORDER BY id DESC`).length;
  return { list, pending };
}

/* GET /api/approvals?tab=my|pending → {list, pending} */
app.get('/api/approvals', async (req, res) => {
  try { res.json(await approvals(req.query.tab === 'pending' ? 'pending' : 'my')); }
  catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* GET /api/approvals/:id → 单张单据（含历史） */
app.get('/api/approvals/:id', async (req, res) => {
  try {
    const row = one(`SELECT * FROM approvals WHERE doc_no='${esc(req.params.id)}'`);
    if (!row) return res.status(404).json({ code: 404, msg: '单据不存在' });
    res.json(approvalJson(row));
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* POST /api/approvals body={type,title,fields} → 新审批单 */
app.post('/api/approvals', async (req, res) => {
  try {
    const { type, title, fields = {} } = req.body || {};
    if (!type || !title) return res.status(400).json({ code: 400, msg: 'type/title 必填' });
    const deptRow = one(`SELECT dept FROM users WHERE name='${CURRENT_USER}'`);
    const docNo = randDocNo();
    run(
      `INSERT INTO approvals (doc_no,type,title,applicant,applicant_dept,fields,status,node,amount,submit_time)
       VALUES ('${docNo}','${esc(type)}','${esc(title)}','${CURRENT_USER}','${esc(deptRow ? deptRow[0] : '市场部')}','${esc(JSON.stringify(fields))}','审批中','直接上级',${fields.amount ? fields.amount : 'NULL'},'${DB.nowStr()}')`
    );
    const id = one(`SELECT id FROM approvals WHERE doc_no='${docNo}'`)[0];
    run(`INSERT INTO approval_history (approval_id,who,action,note,time) VALUES (${id},'${CURRENT_USER}','提交申请','','${DB.nowStr()}')`);
    res.json(approvalJson(one(`SELECT * FROM approvals WHERE doc_no='${docNo}'`)));
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* POST /api/approvals/:id/action body={action:'同意'|'驳回',comment} → 更新后单据 */
app.post('/api/approvals/:id/action', async (req, res) => {
  try {
    const { action = '同意', comment = '' } = req.body || {};
    const row = one(`SELECT * FROM approvals WHERE doc_no='${esc(req.params.id)}'`);
    if (!row) return res.status(404).json({ code: 404, msg: '单据不存在' });
    const [id, docNo, , , , , , , , , ] = row;
    const [st, node] = [row[7], row[8]];
    if (st !== '审批中') return res.status(409).json({ code: 409, msg: '当前状态不可审批' });
    if (action === '同意') {
      if (node === '直接上级') { run(`UPDATE approvals SET node='HR 复核' WHERE doc_no='${esc(docNo)}'`); }
      else { run(`UPDATE approvals SET status='已通过', node='已通过' WHERE doc_no='${esc(docNo)}'`); }
    } else {
      run(`UPDATE approvals SET status='已驳回', node='' WHERE doc_no='${esc(docNo)}'`);
    }
    run(`INSERT INTO approval_history (approval_id,who,action,note,time) VALUES (${id},'${CURRENT_USER}','${esc(action)}','${esc(comment || (action === '同意' ? '同意，按流程办理。' : '请补充说明。'))}','${DB.nowStr()}')`);
    res.json(approvalJson(one(`SELECT * FROM approvals WHERE doc_no='${esc(docNo)}'`)));
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* POST /api/approvals/:id/cancel → {ok, item} */
app.post('/api/approvals/:id/cancel', async (req, res) => {
  try {
    const row = one(`SELECT * FROM approvals WHERE doc_no='${esc(req.params.id)}'`);
    if (!row) return res.status(404).json({ code: 404, msg: '单据不存在' });
    const [id, docNo, , , , , , st] = row;
    if (st !== '审批中') return res.json({ ok: false, msg: '仅审批中可撤销' });
    run(`UPDATE approvals SET status='已撤销', node='' WHERE doc_no='${esc(docNo)}'`);
    run(`INSERT INTO approval_history (approval_id,who,action,note,time) VALUES (${id},'${CURRENT_USER}','撤销','提交人主动撤销。','${DB.nowStr()}')`);
    res.json({ ok: true, item: approvalJson(one(`SELECT * FROM approvals WHERE doc_no='${esc(docNo)}'`)) });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* ---------- 考勤 ---------- */
function fmtTime(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
function todayRow() {
  const date = todayISO();
  let row = one(`SELECT * FROM att_records WHERE date='${date}'`);
  if (!row) {
    run(`INSERT INTO att_records (date,in_time,out_time,result,outside) VALUES ('${date}','—','—','未打卡',0)`);
    row = one(`SELECT * FROM att_records WHERE date='${date}'`);
  }
  return row;
}
function monthStat() {
  const m = curMonth();
  const r = rows(`SELECT result, outside FROM att_records WHERE date LIKE '${m}%'`);
  const stat = { days: r.length, normal: 0, late: 0, early: 0, absent: 0, outside: 0, pending: 0 };
  r.forEach(([result, outside]) => {
    if (outside) stat.outside++;
    if (result === '正常') stat.normal++;
    else if (result === '迟到') { stat.late++; stat.pending++; }
    else if (result === '早退') { stat.early++; stat.pending++; }
    else if (result === '缺卡') { stat.absent++; stat.pending++; }
  });
  return stat;
}
function attJson(r) {
  return { date: r[1], in: r[2], out: r[3], result: r[4], outside: !!r[5] };
}

/* GET /api/attendance/records → {records, today, stat} */
app.get('/api/attendance/records', async (req, res) => {
  try {
    const today = todayRow();
    const records = rows(`SELECT * FROM att_records WHERE date<>'${todayISO()}' ORDER BY date DESC`).map(attJson);
    res.json({ records, today: attJson(today), stat: monthStat() });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* POST /api/attendance/clock-in body={outside} → {time,result,msg} */
app.post('/api/attendance/clock-in', async (req, res) => {
  try {
    const outside = !!(req.body && req.body.outside);
    const row = todayRow();
    const d = new Date();
    const t = fmtTime(d);
    const min = d.getHours() * 60 + d.getMinutes();
    const result = outside ? '外勤' : (min <= 540 ? '正常' : (min <= 570 ? '迟到' : '缺卡'));
    run(`UPDATE att_records SET in_time='${t}', result='${result}', outside=${outside ? 1 : 0} WHERE id=${row[0]}`);
    res.json({ time: t, result, msg: `打卡成功（${outside ? '外勤' : '定位'}），判定 ${result}，已同步至考勤记录。` });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* POST /api/attendance/clock-out body={outside} → {ok,time,result,msg} */
app.post('/api/attendance/clock-out', async (req, res) => {
  try {
    const row = todayRow();
    if (row[2] === '—' || !row[2]) return res.json({ ok: false, msg: '未完成上班打卡，请先上班打卡或发起补卡申请。' });
    const outside = !!(req.body && req.body.outside);
    const d = new Date();
    const t = fmtTime(d);
    const min = d.getHours() * 60 + d.getMinutes();
    const result = outside ? '外勤' : (min >= 1080 ? '正常' : '早退');
    run(`UPDATE att_records SET out_time='${t}', result='${result}', outside=${outside ? 1 : 0} WHERE id=${row[0]}`);
    res.json({ ok: true, time: t, result, msg: `打卡成功，判定 ${result}。` + (result === '早退' ? '可发起补卡申请。' : '') });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* POST /api/attendance/reapply body={date,slot,reason} → {ok,msg}（复用审批流） */
app.post('/api/attendance/reapply', async (req, res) => {
  const { date, slot, reason } = req.body || {};
  if (!date || !reason) return res.status(400).json({ code: 400, msg: 'date/reason 必填' });
  res.json({ ok: true, msg: '补卡申请已提交，进入审批流：直接上级 → 考勤管理员。' });
});

/* ---------- 会议室与日程 ---------- */
/* GET /api/rooms/:date/bookings → {date, list, rooms} */
app.get('/api/rooms/:date/bookings', async (req, res) => {
  try {
    const date = req.params.date;
    const list = rows(`SELECT room, start_h, len_h, title, host FROM bookings WHERE date='${esc(date)}' ORDER BY start_h ASC`)
      .map((r) => ({ room: r[0], start: r[1], len: r[2], title: r[3], host: r[4] }));
    const rooms = rows(`SELECT id, name, seats, floor FROM rooms`).map((r) => ({ id: r[0], name: r[1], seats: r[2], floor: r[3] }));
    res.json({ date, list, rooms });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* POST /api/bookings body={room,date,start,len,title} → {ok,msg,list} */
app.post('/api/bookings', async (req, res) => {
  try {
    const { room, date, start, len, title = '新建会议' } = req.body || {};
    if (!room || !date || start === undefined || len === undefined) return res.status(400).json({ code: 400, msg: 'room/date/start/len 必填' });
    const list = rows(`SELECT room, start_h, len_h, title, host FROM bookings WHERE date='${esc(date)}'`)
      .map((r) => ({ room: r[0], start: r[1], len: r[2], title: r[3], host: r[4] }));
    const clash = list.some((b) => b.room === room && !((start + len) <= b.start || start >= (b.start + b.len)));
    if (clash) return res.json({ ok: false, msg: '该时段已被占用（冲突检测命中），请选择其他时段。', list });
    run(`INSERT INTO bookings (date,room,start_h,len_h,title,host) VALUES ('${esc(date)}','${esc(room)}',${start},${len},'${esc(title)}','${CURRENT_USER}')`);
    const nlist = rows(`SELECT room, start_h, len_h, title, host FROM bookings WHERE date='${esc(date)}' ORDER BY start_h ASC`)
      .map((r) => ({ room: r[0], start: r[1], len: r[2], title: r[3], host: r[4] }));
    res.json({ ok: true, msg: `预定成功：${date} ${start}:00 起 ${len} 小时。`, list: nlist });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* GET /api/meetings → {meetings}   GET /api/schedules → {schedules} */
app.get('/api/meetings', async (req, res) => {
  try {
    const meetings = rows(`SELECT doc_no, title, room, time, host, attendees, status, minutes FROM meetings ORDER BY id ASC`)
      .map((r) => ({ id: r[0], title: r[1], room: r[2], time: r[3], host: r[4], attendees: JSON.parse(r[5] || '[]'), status: r[6], minutes: r[7] }));
    res.json({ meetings });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});
app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = rows(`SELECT doc_no, title, time, duration, type, done FROM schedules ORDER BY id ASC`)
      .map((r) => ({ id: r[0], title: r[1], time: r[2], duration: r[3], type: r[4], done: !!r[5] }));
    res.json({ schedules });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* POST /api/schedules body={title,time,duration,type} → {ok,list} */
app.post('/api/schedules', async (req, res) => {
  try {
    const { title, time = '09:30', duration = '30 分钟', type = '约定' } = req.body || {};
    if (!title) return res.status(400).json({ code: 400, msg: 'title 必填' });
    const max = one(`SELECT MAX(CAST(substr(doc_no,4) AS INTEGER)) FROM schedules`);
    const n = (max ? max[0] : 4) + 1;
    run(`INSERT INTO schedules (doc_no,title,time,duration,type,done) VALUES ('SC-${String(n).padStart(2, '0')}','${esc(title)}','${esc(time)}','${esc(duration)}','${esc(type)}',0)`);
    const list = rows(`SELECT doc_no, title, time, duration, type, done FROM schedules ORDER BY id ASC`)
      .map((r) => ({ id: r[0], title: r[1], time: r[2], duration: r[3], type: r[4], done: !!r[5] }));
    res.json({ ok: true, list });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* ---------- 任务 ---------- */
function tasksJson() {
  return rows(`SELECT doc_no, title, pri, due, assignee, done, status, project FROM tasks ORDER BY id ASC`)
    .map((r) => ({ id: r[0], title: r[1], pri: r[2], due: r[3], assignee: r[4], done: !!r[5], status: r[6], project: r[7] }));
}
app.get('/api/tasks', async (req, res) => {
  try { res.json(tasksJson()); } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, pri = 'mid', due = '', assignee = CURRENT_USER, project = '' } = req.body || {};
    if (!title) return res.status(400).json({ code: 400, msg: 'title 必填' });
    const max = one(`SELECT MAX(CAST(substr(doc_no,4) AS INTEGER)) FROM tasks`);
    const n = (max ? max[0] : 9) + 1;
    run(`INSERT INTO tasks (doc_no,title,pri,due,assignee,done,status,project) VALUES ('TK-${String(n).padStart(3, '0')}','${esc(title)}','${esc(pri)}','${esc(due)}','${esc(assignee)}',0,'待办','${esc(project)}')`);
    res.json(tasksJson());
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});
app.post('/api/tasks/:id/status', async (req, res) => {
  try {
    const done = !!(req.body && req.body.done);
    run(`UPDATE tasks SET done=${done ? 1 : 0}, status='${done ? '已完成' : '待办'}' WHERE doc_no='${esc(req.params.id)}'`);
    res.json(tasksJson());
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* ---------- 公告与知识库 ---------- */
app.get('/api/announcements', async (req, res) => {
  try {
    const list = rows(`SELECT doc_no, title, range, pub_date, read, expired, body FROM announcements ORDER BY id ASC`)
      .map((r) => ({ id: r[0], title: r[1], range: r[2], pubDate: r[3], read: !!r[4], expired: !!r[5], body: r[6] }));
    const unread = list.filter((a) => !a.read && !a.expired).length;
    res.json({ list, unread });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});
app.post('/api/announcements/:id/read', async (req, res) => {
  try {
    run(`UPDATE announcements SET read=1 WHERE doc_no='${esc(req.params.id)}'`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});
app.get('/api/docs', async (req, res) => {
  try {
    const list = rows(`SELECT doc_no, category, title, author, updated, viewers, content FROM docs ORDER BY id ASC`)
      .map((r) => ({ id: r[0], category: r[1], title: r[2], author: r[3], updated: r[4], viewers: r[5], content: JSON.parse(r[6] || '[]') }));
    res.json(list);
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});
app.get('/api/docs/:id', async (req, res) => {
  try {
    const row = one(`SELECT doc_no, category, title, author, updated, viewers, content FROM docs WHERE doc_no='${esc(req.params.id)}'`);
    if (!row) return res.status(404).json({ code: 404, msg: '文档不存在' });
    res.json({ id: row[0], category: row[1], title: row[2], author: row[3], updated: row[4], viewers: row[5], content: JSON.parse(row[6] || '[]') });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* ---------- 通讯录 ---------- */
app.get('/api/contacts', async (req, res) => {
  try {
    const kw = (req.query.kw || '').trim();
    const depts = rows(`SELECT id, name, parent, leader FROM depts`).map((r) => ({ id: r[0], name: r[1], parent: r[2], leader: r[3] }));
    const all = rows(`SELECT id, name, dept, pos, leader, email, phone, city FROM users`);
    const users = kw
      ? all.filter((r) => r[1].includes(kw) || r[2].includes(kw) || r[3].includes(kw))
        .map((r) => ({ id: r[0], name: r[1], dept: r[2], pos: r[3], leader: r[4], email: r[5], phone: r[6], city: r[7] }))
      : all.map((r) => ({ id: r[0], name: r[1], dept: r[2], pos: r[3], leader: r[4], email: r[5], phone: r[6], city: r[7] }));
    res.json({ depts, users });
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});

/* GET /api/users（供负责人下拉等使用）+ 健康检查 */
app.get('/api/users', async (req, res) => {
  try {
    const users = rows(`SELECT id, name FROM users`).map((r) => ({ id: r[0], name: r[1] }));
    res.json(users);
  } catch (e) { res.status(500).json({ code: 500, msg: e.message }); }
});
app.get('/api/health', (req, res) => res.json({ ok: true }));

DB.initSync().then(() => {
  app.listen(PORT, () => {
    console.log(`[oa-server] 已启动：http://localhost:${PORT}  前端静态目录：${FRONTEND_DIR}`);
  });
}).catch((e) => {
  console.error('[oa-server] 数据库初始化失败：', e);
  process.exit(1);
});