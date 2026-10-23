/* ============ API Stub 层：签名 = 未来真实 API，返回 mock 数据，含延迟与 TODO 标注 ============ */
(function (global) {
  var DB = global.DB;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* TODO: replace with GET /api/approvals?tab={tab} → { list, pending }
     请求参数：tab=my|pending；返回：列表、待办数量 */
  global.API = {
    fetchApprovals: function (tab) {
      return delay(400).then(function () {
        var me = DB.currentUser.name;
        var list;
        if (tab === 'pending') {
          list = DB.approvals.filter(function (a) { return a.status === '审批中' && a.node === '直接上级'; });
        } else {
          list = DB.approvals.filter(function (a) { return a.applicant === me; });
        }
        var p = DB.approvals.filter(function (a) { return a.status === '审批中' && a.node === '直接上级'; }).length;
        return { list: clone(list), pending: p };
      });
    },

    /* TODO: replace with POST /api/approvals  body={type,fields} → 新审批单 */
    submitApproval: function (payload) {
      return delay(450).then(function () {
        var n = 1060 + Math.floor(Math.random() * 40);
        var item = {
          id: 'SP2026-' + n, type: payload.type, title: payload.title, applicant: DB.currentUser.name,
          applicantDept: DB.currentUser.dept, fields: payload.fields, status: '审批中', node: '直接上级',
          amount: payload.fields.amount || null, submitTime: (new Date()).toLocaleString('zh-CN', { hour12: false }),
          history: [{ who: DB.currentUser.name, time: '刚刚', action: '提交申请', note: '' }]
        };
        DB.approvals.unshift(item);
        return clone(item);
      });
    },

    /* TODO: replace with POST /api/approvals/{id}/action  body={action,comment} → 更新后的单据 */
    handleApproval: function (id, action, comment) {
      return delay(380).then(function () {
        var it = null;
        DB.approvals.forEach(function (a) { if (a.id === id) it = a; });
        if (!it) return { ok: false };
        var now = new Date().toLocaleString('zh-CN', { hour12: false });
        if (action === '同意') {
          if (it.node === '直接上级') {
            it.node = 'HR 复核';
            it.history.push({ who: DB.currentUser.name, time: now, action: '同意', note: comment || '同意，按流程办理。' });
          } else {
            it.status = '已通过'; it.node = '已通过';
            it.history.push({ who: DB.currentUser.name, time: now, action: '同意', note: comment || '审批通过。' });
          }
        } else {
          it.status = '已驳回'; it.node = '';
          it.history.push({ who: DB.currentUser.name, time: now, action: '驳回', note: comment || '请补充说明。' });
        }
        return clone(it);
      });
    },

    /* TODO: replace with POST /api/approvals/{id}/cancel → 更新后的单据 */
    cancelApproval: function (id) {
      return delay(300).then(function () {
        var it = null;
        DB.approvals.forEach(function (a) { if (a.id === id) it = a; });
        if (!it || it.status !== '审批中') return { ok: false };
        it.status = '已撤销'; it.node = '';
        it.history.push({ who: DB.currentUser.name, time: new Date().toLocaleString('zh-CN', { hour12: false }), action: '撤销', note: '提交人主动撤销。' });
        return { ok: true, item: clone(it) };
      });
    },

    /* TODO: replace with GET /api/attendance/records → {records, today} */
    fetchAtt: function () {
      return delay(350).then(function () {
        var today = clone(DB.attRecords[DB.attRecords.length - 1]);
        return { records: clone(DB.attRecords.slice(0, -1)), today: today, stat: clone(DB.monthStat) };
      });
    },

    /* TODO: replace with POST /api/attendance/clock-in body={outside} → {record} */
    clockIn: function (outside) {
      return delay(300).then(function () {
        var d = new Date(), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
        var t = hh + ':' + mm, min = d.getHours() * 60 + d.getMinutes();
        var result = outside ? '外勤' : (min <= 540 ? '正常' : (min <= 570 ? '迟到' : '缺卡'));
        DB.attRecords[DB.attRecords.length - 1].in = t;
        DB.attRecords[DB.attRecords.length - 1].result = result;
        DB.attRecords[DB.attRecords.length - 1].outside = !!outside;
        return { time: t, result: result, msg: '打卡成功（' + (outside ? '外勤' : '定位') + '），判定 ' + result + '，已同步至考勤记录。' };
      });
    },

    /* TODO: replace with POST /api/attendance/clock-out body={outside} → {record} */
    clockOut: function (outside) {
      return delay(300).then(function () {
        var last = DB.attRecords[DB.attRecords.length - 1];
        if (!last.in || last.in === '—') return { ok: false, msg: '未完成上班打卡，请先上班打卡或发起补卡申请。' };
        var d = new Date(), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
        var t = hh + ':' + mm, min = d.getHours() * 60 + d.getMinutes();
        var result = outside ? '外勤' : (min >= 1080 ? '正常' : '早退');
        last.out = t; last.result = result; last.outside = !!outside;
        return { ok: true, time: t, result: result, msg: '打卡成功，判定 ' + result + '。' + (result === '早退' ? '可发起补卡申请。' : '') };
      });
    },

    /* TODO: replace with POST /api/attendance/reapply body={date,slot,reason} → 补卡申请（复用审批流） */
    reapply: function (payload) {
      return delay(400).then(function () {
        return { ok: true, msg: '补卡申请已提交，进入审批流：直接上级 → 考勤管理员。' };
      });
    },

    /* TODO: replace with GET /api/rooms/{date}/bookings → list */
    fetchBookings: function (date) {
      return delay(350).then(function () {
        var key = date || '2026-10-26';
        var list = DB.bookings[key] ? clone(DB.bookings[key]) : [];
        return { date: key, list: list, rooms: clone(DB.rooms) };
      });
    },

    /* TODO: replace with POST /api/bookings body={room,date,start,len,title} → {ok,list} */
    bookRoom: function (payload) {
      return delay(420).then(function () {
        var key = payload.date;
        var list = DB.bookings[key] || (DB.bookings[key] = []);
        var clash = list.some(function (b) {
          return b.room === payload.room && !((payload.start + payload.len) <= b.start || payload.start >= (b.start + b.len));
        });
        if (clash) return { ok: false, msg: '该时段已被占用（冲突检测命中），请选择其他时段。' };
        list.push({ room: payload.room, start: payload.start, len: payload.len, title: payload.title || '新建会议', host: DB.currentUser.name });
        return { ok: true, msg: '预定成功：' + key + ' ' + payload.start + ':00 起 ' + payload.len + ' 小时。', list: clone(list) };
      });
    },

    /* TODO: replace with GET /api/meetings + /api/schedules → {meetings,schedules} */
    fetchMeetings: function () {
      return delay(350).then(function () {
        return { meetings: clone(DB.meetings), schedules: clone(DB.schedules) };
      });
    },

    /* TODO: replace with POST /api/schedules body={title,time,duration,type} → 新日程 */
    addSchedule: function (payload) {
      return delay(320).then(function () {
        var id = 'SC-' + String(DB.schedules.length + 1).padStart(2, '0');
        DB.schedules.push({ id: id, title: payload.title, time: payload.time, duration: payload.duration, type: payload.type || '约定', done: false });
        return { ok: true, list: clone(DB.schedules) };
      });
    },

    /* TODO: replace with GET /api/tasks → list */
    fetchTasks: function () {
      return delay(350).then(function () { return clone(DB.tasks); });
    },

    /* TODO: replace with POST /api/tasks body={title,pri,due,assignee} → 新任务 */
    addTask: function (payload) {
      return delay(300).then(function () {
        var id = 'TK-' + String(DB.tasks.length + 10).padStart(3, '0');
        DB.tasks.unshift({ id: id, title: payload.title, pri: payload.pri, due: payload.due, assignee: payload.assignee || DB.currentUser.name, done: false, status: '待办', project: payload.project || '' });
        return clone(DB.tasks);
      });
    },

    /* TODO: replace with POST /api/tasks/{id}/status body={done} → list */
    setTaskDone: function (id, done) {
      return delay(250).then(function () {
        DB.tasks.forEach(function (t) { if (t.id === id) { t.done = done; t.status = done ? '已完成' : '待办'; } });
        return clone(DB.tasks);
      });
    },

    /* TODO: replace with GET /api/announcements → list */
    fetchAnnouncements: function () {
      return delay(380).then(function () {
        var unreadCount = DB.announcements.filter(function (a) { return !a.read && !a.expired; }).length;
        return { list: clone(DB.announcements), unread: unreadCount };
      });
    },

    /* TODO: replace with POST /api/announcements/{id}/read → ok */
    markRead: function (id) {
      return delay(200).then(function () {
        DB.announcements.forEach(function (a) { if (a.id === id) a.read = true; });
        return { ok: true };
      });
    },

    /* TODO: replace with GET /api/docs → list */
    fetchDocs: function () {
      return delay(300).then(function () { return clone(DB.docs); });
    },

    /* TODO: replace with GET /api/docs/{id} → doc */
    fetchDoc: function (id) {
      return delay(280).then(function () {
        var found = null;
        DB.docs.forEach(function (d) { if (d.id === id) found = clone(d); });
        return found;
      });
    },

    /* TODO: replace with GET /api/contacts?kw= → {depts,users} */
    searchContacts: function (kw) {
      return delay(300).then(function () {
        kw = (kw || '').trim();
        var users = kw ? DB.users.filter(function (u) { return u.name.indexOf(kw) > -1 || u.dept.indexOf(kw) > -1 || u.pos.indexOf(kw) > -1; }) : DB.users;
        return { depts: clone(DB.depts), users: clone(users) };
      });
    }
  };
})(window);