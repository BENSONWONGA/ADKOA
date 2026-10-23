/* ============ API 层：真实后端调用（Express + SQLite），接口签名与原型存根一致 ============
 * 各函数对应后端 REST 端点；后端见 /workspace/oa-server/server.js。
 * 无鉴权演示模式，会话用户为「张伟」（与服务端 CURRENT_USER 一致）；接入认证时仅需在 fetch 中附加令牌。
 */
(function (global) {
  var BASE = '/api';

  function req(method, path, body) {
    var opt = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opt.body = JSON.stringify(body);
    return fetch(BASE + path, opt).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error((data && data.msg) || ('HTTP ' + r.status));
        return data;
      });
    });
  }

  global.API = {
    /* GET /api/approvals?tab=my|pending → {list, pending} */
    fetchApprovals: function (tab) {
      return req('GET', '/approvals?tab=' + (tab === 'pending' ? 'pending' : 'my'));
    },

    /* POST /api/approvals body={type,title,fields} → 新审批单 */
    submitApproval: function (payload) {
      return req('POST', '/approvals', payload);
    },

    /* POST /api/approvals/:id/action body={action,comment} → 更新后单据 */
    handleApproval: function (id, action, comment) {
      return req('POST', '/approvals/' + encodeURIComponent(id) + '/action', { action: action, comment: comment || '' });
    },

    /* POST /api/approvals/:id/cancel → {ok,item} */
    cancelApproval: function (id) {
      return req('POST', '/approvals/' + encodeURIComponent(id) + '/cancel');
    },

    /* GET /api/attendance/records → {records,today,stat} */
    fetchAtt: function () {
      return req('GET', '/attendance/records');
    },

    /* POST /api/attendance/clock-in body={outside} → {time,result,msg} */
    clockIn: function (outside) {
      return req('POST', '/attendance/clock-in', { outside: !!outside });
    },

    /* POST /api/attendance/clock-out body={outside} → {ok,time,result,msg} */
    clockOut: function (outside) {
      return req('POST', '/attendance/clock-out', { outside: !!outside });
    },

    /* POST /api/attendance/reapply body={date,slot,reason} → {ok,msg} */
    reapply: function (payload) {
      return req('POST', '/attendance/reapply', payload);
    },

    /* GET /api/rooms/:date/bookings → {date,list,rooms} */
    fetchBookings: function (date) {
      return req('GET', '/rooms/' + encodeURIComponent(date || '2026-10-26') + '/bookings');
    },

    /* POST /api/bookings body={room,date,start,len,title} → {ok,msg,list} */
    bookRoom: function (payload) {
      return req('POST', '/bookings', payload);
    },

    /* GET /api/meetings → {meetings} */
    fetchMeetings: function () {
      return req('GET', '/meetings');
    },

    /* GET /api/schedules → {schedules} */
    fetchSchedules: function () {
      return req('GET', '/schedules');
    },

    /* POST /api/schedules body={title,time,duration,type} → {ok,list} */
    addSchedule: function (payload) {
      return req('POST', '/schedules', payload);
    },

    /* GET /api/tasks → list */
    fetchTasks: function () {
      return req('GET', '/tasks');
    },

    /* POST /api/tasks body={title,pri,due,assignee,project} → list */
    addTask: function (payload) {
      return req('POST', '/tasks', payload);
    },

    /* POST /api/tasks/:id/status body={done} → list */
    setTaskDone: function (id, done) {
      return req('POST', '/tasks/' + encodeURIComponent(id) + '/status', { done: !!done });
    },

    /* GET /api/announcements → {list,unread} */
    fetchAnnouncements: function () {
      return req('GET', '/announcements');
    },

    /* POST /api/announcements/:id/read → {ok} */
    markRead: function (id) {
      return req('POST', '/announcements/' + encodeURIComponent(id) + '/read');
    },

    /* GET /api/docs → list */
    fetchDocs: function () {
      return req('GET', '/docs');
    },

    /* GET /api/docs/:id → doc */
    fetchDoc: function (id) {
      return req('GET', '/docs/' + encodeURIComponent(id));
    },

    /* GET /api/contacts?kw= → {depts,users} */
    searchContacts: function (kw) {
      return req('GET', '/contacts?kw=' + encodeURIComponent(kw || ''));
    }
  };
})(window);