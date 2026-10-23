/**
 * db.js — SQLite (sql.js/WASM) 数据层
 * 初始化数据库、建表、写入与原型 mock.js 一致的种子数据。
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'data', 'oa.db');

let db = null;

function nowStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function initSync() {
  return initSqlJs().then((SQL) => {
    if (fs.existsSync(DB_PATH)) {
      db = new SQL.Database(fs.readFileSync(DB_PATH));
    } else {
      db = new SQL.Database();
      createSchema();
      seed();
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      persist();
    }
    return db;
  });
}

function persist() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function createSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      dept TEXT NOT NULL,
      pos TEXT NOT NULL,
      leader TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      city TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS depts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      parent INTEGER,
      leader TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_no TEXT UNIQUE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      applicant TEXT NOT NULL,
      applicant_dept TEXT NOT NULL,
      fields TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '审批中',
      node TEXT DEFAULT '直接上级',
      amount REAL,
      submit_time TEXT
    );
    CREATE TABLE IF NOT EXISTS approval_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      approval_id INTEGER NOT NULL,
      who TEXT NOT NULL,
      action TEXT NOT NULL,
      note TEXT DEFAULT '',
      time TEXT,
      FOREIGN KEY (approval_id) REFERENCES approvals(id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_no TEXT UNIQUE,
      title TEXT NOT NULL,
      pri TEXT DEFAULT 'mid',
      due TEXT,
      assignee TEXT DEFAULT '',
      done INTEGER DEFAULT 0,
      status TEXT DEFAULT '待办',
      project TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      seats INTEGER,
      floor TEXT
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      room TEXT NOT NULL,
      start_h INTEGER NOT NULL,
      len_h INTEGER NOT NULL,
      title TEXT,
      host TEXT
    );
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_no TEXT UNIQUE,
      title TEXT,
      time TEXT,
      duration TEXT,
      type TEXT,
      done INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_no TEXT UNIQUE,
      title TEXT,
      room TEXT,
      time TEXT,
      host TEXT,
      attendees TEXT,
      status TEXT DEFAULT '待开始',
      minutes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_no TEXT UNIQUE,
      title TEXT,
      range TEXT,
      pub_date TEXT,
      read INTEGER DEFAULT 0,
      expired INTEGER DEFAULT 0,
      body TEXT
    );
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_no TEXT UNIQUE,
      category TEXT,
      title TEXT,
      author TEXT,
      updated TEXT,
      viewers INTEGER DEFAULT 0,
      content TEXT
    );
    CREATE TABLE IF NOT EXISTS att_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      in_time TEXT,
      out_time TEXT,
      result TEXT,
      outside INTEGER DEFAULT 0
    );
  `);
}

function seed() {
  const ins = (t, cols, rows) => {
    const stmt = db.prepare(`INSERT INTO ${t} (${cols}) VALUES (${cols.split(',').map(() => '?').join(',')})`);
    rows.forEach((r) => { stmt.run(r); });
    stmt.free();
  };

  ins('users', 'id,name,dept,pos,leader,email,phone,city', [
    [1, '张伟', '市场部', '市场经理', '李娜', 'zhangwei@company.cn', '138****1234', '上海'],
    [2, '李娜', '市场部', '市场总监', '吴迪', 'lina@company.cn', '139****8812', '上海'],
    [3, '王强', '产品部', '产品总监', '吴迪', 'wangqiang@company.cn', '136****0021', '上海'],
    [4, '赵敏', '市场部', '市场专员', '张伟', 'zhaomin@company.cn', '137****6609', '上海'],
    [5, '陈晨', '研发部', '前端开发', '刘洋', 'chenchen@company.cn', '135****4408', '北京'],
    [6, '刘洋', '研发部', '研发经理', '王强', 'liuyang@company.cn', '150****2290', '北京'],
    [7, '孙丽', '市场部', '市场专员', '张伟', 'sunli@company.cn', '158****3371', '上海'],
    [8, '周涛', '行政部', '行政总监', '吴迪', 'zhoutao@company.cn', '186****0098', '上海'],
    [9, '吴迪', '财务部', '财务总监', '', 'wudi@company.cn', '187****5502', '上海'],
    [10, '郑好', '人力资源部', 'HR 经理', '吴迪', 'zhenghao@company.cn', '188****1936', '上海']
  ]);

  ins('depts', 'id,name,parent,leader', [
    [100, '市场部', null, '李娜'], [200, '产品部', null, '王强'],
    [300, '研发部', 200, '刘洋'], [400, '财务部', null, '吴迪'],
    [500, '人力资源部', null, '郑好'], [600, '行政部', null, '周涛']
  ]);

  const J = JSON.stringify;
  const approvals = [
    ['SP2026-1011', '请假', '年假申请（上海）', '张伟', '市场部', J({ leaveType: '年假', start: '2026-11-02', end: '2026-11-06', days: 5, reason: '家庭旅行，已与组内成员交接工作。', attach: '行程单.pdf' }), '已通过', '', null, '2026-10-12 09:33'],
    ['SP2026-1014', '报销', 'Q3 渠道走访差旅报销', '张伟', '市场部', J({ items: '上海-杭州-上海 高铁 2 程；住宿 2 晚', amount: 3260, reason: 'Q3 华东渠道伙伴拜访，按标准实报实销。', attach: '发票合集.pdf' }), '已通过', '', 3260, '2026-10-15 14:20'],
    ['SP2026-1018', '用章', '合作协议用印申请', '张伟', '市场部', J({ goods: '市场部合作协议（渠道框架）', reason: '与杭州某渠道商签订年度框架协议，需加盖合同专用章。', attach: '协议盖章页.pdf' }), '已驳回', '', null, '2026-10-18 11:02'],
    ['SP2026-1021', '请假', '事假申请', '张伟', '市场部', J({ leaveType: '事假', start: '2026-10-26', end: '2026-10-27', days: 2, reason: '家中有事处理。', attach: '' }), '审批中', 'HR 复核', null, '2026-10-21 08:52'],
    ['SP2026-1031', '请假', '病假申请', '赵敏', '市场部', J({ leaveType: '病假', start: '2026-10-29', end: '2026-10-29', days: 1, reason: '感冒发烧，需休息一天。', attach: '医院诊断证明.pdf' }), '审批中', '直接上级', null, '2026-10-22 19:14'],
    ['SP2026-1032', '报销', '客户接待费报销', '孙丽', '市场部', J({ items: '客户午餐接待 ×1', amount: 1280, reason: '重点客户来访接待，附消费小票。', attach: '小票.jpg' }), '审批中', '直接上级', 1280, '2026-10-22 10:40'],
    ['SP2026-1033', '请假', '调休申请', '赵敏', '市场部', J({ leaveType: '调休', start: '2026-11-06', end: '2026-11-06', days: 1, reason: '国庆值班 1 天，申请调休。', attach: '' }), '审批中', '直接上级', null, '2026-10-21 16:25'],
    ['SP2026-1034', '请假', '年假申请', '孙丽', '市场部', J({ leaveType: '年假', start: '2026-11-10', end: '2026-11-12', days: 3, reason: '回老家探亲。', attach: '' }), '审批中', '直接上级', null, '2026-10-23 08:18'],
    ['SP2026-1040', '用章', '采购合同用印申请', '周涛', '行政部', J({ goods: '办公设备采购合同（打印机）', reason: '行政部办公设备年度采购合同用印。', attach: '采购合同.pdf' }), '已通过', '', null, '2026-10-19 13:55']
  ];
  ins('approvals', 'doc_no,type,title,applicant,applicant_dept,fields,status,node,amount,submit_time', approvals);

  const histories = [
    ['SP2026-1011', '张伟', '提交申请', '', '2026-10-12 09:33'],
    ['SP2026-1011', '李娜', '同意', '同意，注意休假期间工作交接。', '2026-10-12 10:05'],
    ['SP2026-1011', '郑好', '同意', '年假额度已扣减 5 天。', '2026-10-12 10:41'],
    ['SP2026-1014', '张伟', '提交申请', '', '2026-10-15 14:20'],
    ['SP2026-1014', '李娜', '同意', '', '2026-10-15 15:02'],
    ['SP2026-1014', '吴迪', '同意', '已核对发票，付款 3-5 个工作日到账。', '2026-10-16 09:10'],
    ['SP2026-1018', '张伟', '提交申请', '', '2026-10-18 11:02'],
    ['SP2026-1018', '李娜', '驳回', '协议需法务审阅后盖章，请先走法务评审流程。', '2026-10-18 14:26'],
    ['SP2026-1021', '张伟', '提交申请', '', '2026-10-21 08:52'],
    ['SP2026-1021', '李娜', '同意', '同意，保持电话畅通。', '2026-10-21 09:30'],
    ['SP2026-1031', '赵敏', '提交申请', '', '2026-10-22 19:14'],
    ['SP2026-1032', '孙丽', '提交申请', '', '2026-10-22 10:40'],
    ['SP2026-1033', '赵敏', '提交申请', '', '2026-10-21 16:25'],
    ['SP2026-1034', '孙丽', '提交申请', '', '2026-10-23 08:18'],
    ['SP2026-1040', '周涛', '提交申请', '', '2026-10-19 13:55'],
    ['SP2026-1040', '吴迪', '同意', '供应商资质已核。', '2026-10-19 15:20'],
    ['SP2026-1040', '周涛', '同意', '章已盖，原件寄出。', '2026-10-19 16:02']
  ];
  ins('approval_history', 'approval_id,who,action,note,time', histories.map((h) => {
    const row = db.exec(`SELECT id FROM approvals WHERE doc_no='${h[0]}'`)[0];
    return [row.values[0][0], h[1], h[2], h[3], h[4]];
  }));

  ins('tasks', 'doc_no,title,pri,due,assignee,done,status,project', [
    ['TK-001', '整理 Q3 市场部总结报告素材', 'high', '2026-10-24', '张伟', 0, '进行中', '季报'],
    ['TK-002', '修订请假审批模板并联动 HR', 'high', '2026-10-20', '张伟', 0, '待办', '审批优化'],
    ['TK-003', '会议室设备巡检安排', 'mid', '2026-10-27', '刘洋', 0, '待办', ''],
    ['TK-004', '完成 10 月考勤核对', 'high', '2026-10-28', '郑好', 0, '进行中', '考勤专项'],
    ['TK-005', '新员工入职文档归档', 'low', '2026-10-30', '周涛', 0, '待办', ''],
    ['TK-006', '报销流程演示 UAT 验收', 'mid', '2026-10-25', '王强', 0, '进行中', '审批优化'],
    ['TK-007', '知识库权限矩阵文档初稿', 'low', '2026-11-01', '陈晨', 0, '待办', '知识库'],
    ['TK-008', '通讯录可见性配置自查', 'mid', '2026-10-22', '郑好', 1, '已完成', ''],
    ['TK-009', '前台访客登记流程复核', 'mid', '2026-10-21', '孙丽', 1, '已完成', '']
  ]);

  ins('rooms', 'id,name,seats,floor', [
    ['R-A', 'A 会议室', 8, '3F'], ['R-B', 'B 会议室', 12, '5F'], ['R-C', 'C 洽谈室', 4, '3F']
  ]);

  ins('bookings', 'date,room,start_h,len_h,title,host', [
    ['2026-10-26', 'R-A', 9, 1, '市场部周例会', '张伟'],
    ['2026-10-26', 'R-A', 14, 1, '产品评审会', '王强'],
    ['2026-10-26', 'R-B', 10, 2, 'Q4 述职会', '李娜'],
    ['2026-10-26', 'R-C', 15, 1, '渠道伙伴接待', '赵敏']
  ]);

  ins('schedules', 'doc_no,title,time,duration,type,done', [
    ['SC-01', '部门早会', '09:30', '20 分钟', '例行', 1],
    ['SC-02', '与王强同步绩效考核口径', '11:00', '30 分钟', '约定', 0],
    ['SC-03', '产品评审会（A 会议室）', '14:30', '60 分钟', '会议', 0],
    ['SC-04', '整理 10 月报销单据', '16:00', '45 分钟', '待办', 0]
  ]);

  ins('meetings', 'doc_no,title,room,time,host,attendees,status,minutes', [
    ['MT-01', '市场部周例会', 'A 会议室', '2026-10-26 09:00-10:00', '张伟', J(['张伟', '赵敏', '孙丽']), '待开始', ''],
    ['MT-02', '审批流程月度复盘', 'B 会议室', '2026-10-27 14:00-15:30', '郑好', J(['张伟', '王强', '刘洋']), '待开始', ''],
    ['MT-03', 'Q3 渠道复盘会', 'A 会议室', '2026-10-16 15:00-16:30', '李娜', J(['张伟', '赵敏', '孙丽']), '已结束', '纪要_v3 已上传']
  ]);

  ins('announcements', 'doc_no,title,range,pub_date,read,expired,body', [
    ['AN-01', '关于 10 月考勤异常核对的通知', '全员', '2026-10-22 09:00', 0, 0, '10 月考勤已进入核对期。如您的考勤存在迟到、早退或缺卡记录，请在 10 月 27 日前完成补卡申请或提供说明，逾期将按考勤管理制度处理。'],
    ['AN-02', '办公区消防演练安排（10 月 28 日）', '全员', '2026-10-20 16:30', 1, 0, '本月底将举行年度消防演练，届时办公区将短暂断电，请提前保存好工作内容。演练路线与集合点详见附件。'],
    ['AN-03', '会议室设备升级维护通知', '全员', '2026-10-19 11:20', 1, 0, 'A、B 会议室投影与小间音视频设备将于周末统一切换，切换后首次使用请在桌面端测试投屏，如有异常联系行政部。'],
    ['AN-04', 'Q4 部门预算结余申报说明', '财务部', '2026-10-18 10:00', 1, 0, 'Q4 预算结余将开放申报，请各部门在本月 25 日前提交说明，逾期视为不申报。'],
    ['AN-05', '国庆假期作息调整的通知', '全员', '2026-09-30 09:00', 1, 1, '国庆假期 10 月 1 日至 10 月 7 日放假，10 月 8 日（周四）起正常上班。']
  ]);

  ins('docs', 'doc_no,category,title,author,updated,viewers,content', [
    ['DOC-01', '制度规范', '考勤管理制度', '郑好', '2026-09-08', 128, J(['一、考勤方式：员工上下班需在办公系统内完成定位打卡，打卡区域以公司 Wi-Fi 白名单及 GPS 范围为准；外勤人员需在外勤打卡时填写说明。', '二、迟到与早退：上班迟到 30 分钟以内记为「迟到」，超过 30 分钟记为「缺卡」；下班早于规定时间记为「早退」。', '三、补卡与申诉：因忘打卡、系统故障导致异常的，应在当月起 5 个工作日内发起补卡申请，经直接上级与考勤管理员审批后生效。'])],
    ['DOC-02', '制度规范', '费用报销管理制度', '吴迪', '2026-08-20', 96, J(['一、报销原则：报销须在费用发生后 30 天内发起，单据须附合规发票，住宿、交通按差旅标准执行。', '二、审批权限：金额不超过 5000 元的报销由直接上级审批；超过 5000 元或涉及招待的，须增加财务复核节点。', '三、付款时效：审批通过后，财务于 3-5 个工作日内打款，状态可在报销单详情中跟踪。'])],
    ['DOC-03', '操作手册', '会议室预定指南', '周涛', '2026-07-15', 64, J(['一、预定规则：通过「日程会议」页选择会议室、日期与时段；系统将自动检测冲突，冲突时段不可选择。', '二、取消与变更：会议开始前 1 小时可在会议详情中取消，释放会议室资源；变更时间请先在原时段取消后重新预定。', '三、注意事项：请勿提前超过 14 天预定；临时占用超过 30 分钟未到场的会议将被行政部回收。'])],
    ['DOC-04', '操作手册', '审批发起指南', '张伟', '2026-09-25', 87, J(['一、发起路径：审批页选择「发起申请」，按类型填写表单；请假时长超过剩余额度时将无法提交。', '二、审批链：默认审批链为「直接上级 → 类型复核人（HR/财务）」，发起后可随时查看当前节点。', '三、驳回处理：被驳回的申请可在原单上修改后重新提交，已填写内容自动保留。'])],
    ['DOC-05', '模板', '请假申请审批模板', '郑好', '2026-09-30', 41, J(['使用说明：本模板为请假审批的默认表单结构，包含假期类型、起止时间、时长（自动计算）、事由及附件。', '假期类型包括年假、事假、病假、调休四类，其中调休仅限因公值班产生。'])]
  ]);

  ins('att_records', 'date,in_time,out_time,result,outside', [
    ['2026-10-17', '08:52', '18:24', '正常', 0],
    ['2026-10-20', '09:21', '18:02', '迟到', 0],
    ['2026-10-21', '08:47', '18:36', '正常', 0],
    ['2026-10-22', '09:33', '17:52', '缺卡', 0],
    [new Date().toISOString().slice(0, 10), '08:41', '—', '正常', 0]
  ]);
}

module.exports = { initSync, persist, nowStr, get raw() { return db; } };