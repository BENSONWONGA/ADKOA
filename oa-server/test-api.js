const BASE = 'http://localhost:3000';
const J = (r) => r.json();
let pass = 0, fail = 0;
async function t(name, fn) {
  try {
    const ok = await fn();
    if (ok) { pass++; console.log('PASS ' + name); }
    else { fail++; console.log('FAIL ' + name); }
  } catch (e) { fail++; console.log('FAIL ' + name + ' → ' + e.message); }
}
(async () => {
  await t('GET / (index.html 静态)', async () => {
    const r = await fetch(BASE + '/');
    const html = await r.text();
    return r.ok && html.includes('协同办公系统');
  });
  await t('GET /api/health', async () => (await J(await fetch(BASE + '/api/health'))).ok === true);
  await t('GET /api/approvals?tab=my → 张伟4条', async () => {
    const d = await J(await fetch(BASE + '/api/approvals?tab=my'));
    return d.list.length === 4 && d.list.every(a => a.applicant === '张伟');
  });
  await t('GET /api/approvals?tab=pending → 4条待办', async () => {
    const d = await J(await fetch(BASE + '/api/approvals?tab=pending'));
    return d.pending === 4 && d.list.length === 4 && d.list.every(a => a.node === '直接上级');
  });
  let newId = null;
  await t('POST /api/approvals 提交报销', async () => {
    const r = await fetch(BASE + '/api/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: '报销', title: '测试报销单', fields: { reason: '接口测试', amount: 680, dept: '市场部', attach: '' } }) });
    const d = await J(r);
    newId = d.id;
    return d.status === '审批中' && d.node === '直接上级' && d.amount === 680 && d.history.length === 1;
  });
  await t('POST /api/approvals/:id/action 一级同意 → HR 复核', async () => {
    const d = await J(await fetch(BASE + '/api/approvals/' + newId + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: '同意', comment: '同意' }) }));
    return d.node === 'HR 复核' && d.status === '审批中' && d.history.length === 2;
  });
  await t('GET /api/approvals/:id 详情含历史', async () => {
    const d = await J(await fetch(BASE + '/api/approvals/' + newId));
    return d.history[1].action === '同意';
  });
  await t('POST cancel 撤销', async () => {
    const d = await J(await fetch(BASE + '/api/approvals/' + newId + '/cancel', { method: 'POST' }));
    return d.ok === true && d.item.status === '已撤销';
  });
  await t('GET /api/attendance/records → stat 数值', async () => {
    const d = await J(await fetch(BASE + '/api/attendance/records'));
    return d.today && d.stat && typeof d.stat.days === 'number' && Array.isArray(d.records);
  });
  await t('POST clock-in / clock-out', async () => {
    const ci = await J(await fetch(BASE + '/api/attendance/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outside: false }) }));
    const co = await J(await fetch(BASE + '/api/attendance/clock-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outside: false }) }));
    return !!ci.time && co.ok === true && !!co.time;
  });
  await t('GET /api/rooms/2026-10-26/bookings → 4条', async () => {
    const d = await J(await fetch(BASE + '/api/rooms/2026-10-26/bookings'));
    return d.list.length === 4 && d.list.some(b => b.title === '产品评审会');
  });
  await t('POST /api/bookings 冲突（A 14:00-15:00）', async () => {
    const d = await J(await fetch(BASE + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: 'R-A', date: '2026-10-26', start: 14, len: 1, title: '冲突单' }) }));
    return d.ok === false;
  });
  await t('POST /api/bookings 成功（A 15:00-17:00）', async () => {
    const d = await J(await fetch(BASE + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: 'R-A', date: '2026-10-26', start: 15, len: 2, title: '接口预定会议' }) }));
    return d.ok === true && d.list.length === 5;
  });
  await t('GET /api/meetings + /api/schedules', async () => {
    const m = await J(await fetch(BASE + '/api/meetings'));
    const s = await J(await fetch(BASE + '/api/schedules'));
    return m.meetings.length === 3 && s.schedules.length === 4;
  });
  await t('POST /api/schedules 新增', async () => {
    const d = await J(await fetch(BASE + '/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '接口测试日程', time: '15:30' }) }));
    return d.ok === true && d.list.length === 5 && d.list[d.list.length - 1].title === '接口测试日程';
  });
  await t('GET/POST /api/tasks + 状态', async () => {
    const before = await J(await fetch(BASE + '/api/tasks'));
    const add = await J(await fetch(BASE + '/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '接口任务', pri: 'high', due: '2026-10-30' }) }));
    const id = add[0].id;
    const done = await J(await fetch(BASE + '/api/tasks/' + id + '/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: true }) }));
    const target = done.find(tx => tx.id === id);
    return before.length === 9 && add.length === 10 && target && target.done === true && target.status === '已完成';
  });
  await t('GET /api/announcements → unread=1', async () => {
    const d = await J(await fetch(BASE + '/api/announcements'));
    return d.unread === 1 && d.list.length === 5;
  });
  await t('POST /api/announcements/:id/read → unread=0', async () => {
    await fetch(BASE + '/api/announcements/AN-01/read', { method: 'POST' });
    const d = await J(await fetch(BASE + '/api/announcements'));
    return d.unread === 0;
  });
  await t('GET /api/docs + /api/docs/DOC-01', async () => {
    const list = await J(await fetch(BASE + '/api/docs'));
    const doc = await J(await fetch(BASE + '/api/docs/DOC-01'));
    return list.length === 5 && doc.title === '考勤管理制度' && Array.isArray(doc.content);
  });
  await t('GET /api/contacts?kw=市场部 → 4人', async () => {
    const d = await J(await fetch(BASE + '/api/contacts?kw=' + encodeURIComponent('市场部')));
    return d.users.length === 4 && d.depts.length === 6;
  });
  await t('GET /api/contacts?kw=张 → 1人', async () => {
    const d = await J(await fetch(BASE + '/api/contacts?kw=' + encodeURIComponent('张')));
    return d.users.length === 1 && d.users[0].name === '张伟';
  });
  await t('GET /api/users → 10人', async () => {
    const d = await J(await fetch(BASE + '/api/users'));
    return d.length === 10;
  });
  console.log(`\n结果：PASS ${pass} / FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();