/* ============ Mock 数据（全站唯一数据源，跨页面数据一致） ============ */
window.DB = (function () {
  return {
    currentUser: { id: 1, name: '张伟', dept: '市场部', pos: '市场经理', leader: '李娜' },

    depts: [
      { id: 100, name: '市场部', parent: null, leader: '李娜' },
      { id: 200, name: '产品部', parent: null, leader: '王强' },
      { id: 300, name: '研发部', parent: 200, leader: '刘洋' },
      { id: 400, name: '财务部', parent: null, leader: '吴迪' },
      { id: 500, name: '人力资源部', parent: null, leader: '郑好' },
      { id: 600, name: '行政部', parent: null, leader: '周涛' }
    ],

    users: [
      { id: 1, name: '张伟', dept: '市场部', pos: '市场经理', leader: '李娜', email: 'zhangwei@company.cn', phone: '138****1234', city: '上海' },
      { id: 2, name: '李娜', dept: '市场部', pos: '市场总监', leader: '吴迪', email: 'lina@company.cn', phone: '139****8812', city: '上海' },
      { id: 3, name: '王强', dept: '产品部', pos: '产品总监', leader: '吴迪', email: 'wangqiang@company.cn', phone: '136****0021', city: '上海' },
      { id: 4, name: '赵敏', dept: '市场部', pos: '市场专员', leader: '张伟', email: 'zhaomin@company.cn', phone: '137****6609', city: '上海' },
      { id: 5, name: '陈晨', dept: '研发部', pos: '前端开发', leader: '刘洋', email: 'chenchen@company.cn', phone: '135****4408', city: '北京' },
      { id: 6, name: '刘洋', dept: '研发部', pos: '研发经理', leader: '王强', email: 'liuyang@company.cn', phone: '150****2290', city: '北京' },
      { id: 7, name: '孙丽', dept: '市场部', pos: '市场专员', leader: '张伟', email: 'sunli@company.cn', phone: '158****3371', city: '上海' },
      { id: 8, name: '周涛', dept: '行政部', pos: '行政总监', leader: '吴迪', email: 'zhoutao@company.cn', phone: '186****0098', city: '上海' },
      { id: 9, name: '吴迪', dept: '财务部', pos: '财务总监', leader: '', email: 'wudi@company.cn', phone: '187****5502', city: '上海' },
      { id: 10, name: '郑好', dept: '人力资源部', pos: 'HR 经理', leader: '吴迪', email: 'zhenghao@company.cn', phone: '188****1936', city: '上海' }
    ],

    /* 审批单：type 请假/报销/用章；status 审批中/已通过/已驳回；node 直接上级/HR 复核 */
    approvals: [
      {
        id: 'SP2026-1011', type: '请假', title: '年假申请（上海）', applicant: '张伟', applicantDept: '市场部',
        fields: { leaveType: '年假', start: '2026-11-02', end: '2026-11-06', days: 5, reason: '家庭旅行，已与组内成员交接工作。', attach: '行程单.pdf' },
        status: '已通过', node: '', amount: null, submitTime: '2026-10-12 09:33',
        history: [
          { who: '张伟', time: '2026-10-12 09:33', action: '提交申请', note: '' },
          { who: '李娜', time: '2026-10-12 10:05', action: '同意', note: '同意，注意休假期间工作交接。' },
          { who: '郑好', time: '2026-10-12 10:41', action: '同意', note: '年假额度已扣减 5 天。' }
        ]
      },
      {
        id: 'SP2026-1014', type: '报销', title: 'Q3 渠道走访差旅报销', applicant: '张伟', applicantDept: '市场部',
        fields: { items: '上海-杭州-上海 高铁 2 程；住宿 2 晚', amount: 3260, reason: 'Q3 华东渠道伙伴拜访，按标准实报实销。', attach: '发票合集.pdf' },
        status: '已通过', node: '', amount: 3260, submitTime: '2026-10-15 14:20',
        history: [
          { who: '张伟', time: '2026-10-15 14:20', action: '提交申请', note: '' },
          { who: '李娜', time: '2026-10-15 15:02', action: '同意', note: '' },
          { who: '吴迪', time: '2026-10-16 09:10', action: '同意', note: '已核对发票，付款 3-5 个工作日到账。' }
        ]
      },
      {
        id: 'SP2026-1018', type: '用章', title: '合作协议用印申请', applicant: '张伟', applicantDept: '市场部',
        fields: { goods: '市场部合作协议（渠道框架）', reason: '与杭州某渠道商签订年度框架协议，需加盖合同专用章。', attach: '协议盖章页.pdf' },
        status: '已驳回', node: '', amount: null, submitTime: '2026-10-18 11:02',
        history: [
          { who: '张伟', time: '2026-10-18 11:02', action: '提交申请', note: '' },
          { who: '李娜', time: '2026-10-18 14:26', action: '驳回', note: '协议需法务审阅后盖章，请先走法务评审流程。' }
        ]
      },
      {
        id: 'SP2026-1021', type: '请假', title: '事假申请', applicant: '张伟', applicantDept: '市场部',
        fields: { leaveType: '事假', start: '2026-10-26', end: '2026-10-27', days: 2, reason: '家中有事处理。', attach: '' },
        status: '审批中', node: 'HR 复核', amount: null, submitTime: '2026-10-21 08:52',
        history: [
          { who: '张伟', time: '2026-10-21 08:52', action: '提交申请', note: '' },
          { who: '李娜', time: '2026-10-21 09:30', action: '同意', note: '同意，保持电话畅通。' }
        ]
      },
      {
        id: 'SP2026-1031', type: '请假', title: '病假申请', applicant: '赵敏', applicantDept: '市场部',
        fields: { leaveType: '病假', start: '2026-10-29', end: '2026-10-29', days: 1, reason: '感冒发烧，需休息一天。', attach: '医院诊断证明.pdf' },
        status: '审批中', node: '直接上级', amount: null, submitTime: '2026-10-22 19:14',
        history: [{ who: '赵敏', time: '2026-10-22 19:14', action: '提交申请', note: '' }]
      },
      {
        id: 'SP2026-1032', type: '报销', title: '客户接待费报销', applicant: '孙丽', applicantDept: '市场部',
        fields: { items: '客户午餐接待 ×1', amount: 1280, reason: '重点客户来访接待，附消费小票。', attach: '小票.jpg' },
        status: '审批中', node: '直接上级', amount: 1280, submitTime: '2026-10-22 10:40',
        history: [{ who: '孙丽', time: '2026-10-22 10:40', action: '提交申请', note: '' }]
      },
      {
        id: 'SP2026-1033', type: '请假', title: '调休申请', applicant: '赵敏', applicantDept: '市场部',
        fields: { leaveType: '调休', start: '2026-11-06', end: '2026-11-06', days: 1, reason: '国庆值班 1 天，申请调休。', attach: '' },
        status: '审批中', node: '直接上级', amount: null, submitTime: '2026-10-21 16:25',
        history: [{ who: '赵敏', time: '2026-10-21 16:25', action: '提交申请', note: '' }]
      },
      {
        id: 'SP2026-1034', type: '请假', title: '年假申请', applicant: '孙丽', applicantDept: '市场部',
        fields: { leaveType: '年假', start: '2026-11-10', end: '2026-11-12', days: 3, reason: '回老家探亲。', attach: '' },
        status: '审批中', node: '直接上级', amount: null, submitTime: '2026-10-23 08:18',
        history: [{ who: '孙丽', time: '2026-10-23 08:18', action: '提交申请', note: '' }]
      },
      {
        id: 'SP2026-1040', type: '用章', title: '采购合同用印申请', applicant: '周涛', applicantDept: '行政部',
        fields: { goods: '办公设备采购合同（打印机）', reason: '行政部办公设备年度采购合同用印。', attach: '采购合同.pdf' },
        status: '已通过', node: '', amount: null, submitTime: '2026-10-19 13:55',
        history: [
          { who: '周涛', time: '2026-10-19 13:55', action: '提交申请', note: '' },
          { who: '吴迪', time: '2026-10-19 15:20', action: '同意', note: '供应商资质已核。' },
          { who: '周涛', time: '2026-10-19 16:02', action: '同意', note: '章已盖，原件寄出。' }
        ]
      }
    ],

    tasks: [
      { id: 'TK-001', title: '整理 Q3 市场部总结报告素材', pri: 'high', due: '2026-10-24', assignee: '张伟', done: false, status: '进行中', project: '季报' },
      { id: 'TK-002', title: '修订请假审批模板并联动 HR', pri: 'high', due: '2026-10-20', assignee: '张伟', done: false, status: '待办', project: '审批优化' },
      { id: 'TK-003', title: '会议室设备巡检安排', pri: 'mid', due: '2026-10-27', assignee: '刘洋', done: false, status: '待办', project: '' },
      { id: 'TK-004', title: '完成 10 月考勤核对', pri: 'high', due: '2026-10-28', assignee: '郑好', done: false, status: '进行中', project: '考勤专项' },
      { id: 'TK-005', title: '新员工入职文档归档', pri: 'low', due: '2026-10-30', assignee: '周涛', done: false, status: '待办', project: '' },
      { id: 'TK-006', title: '报销流程演示 UAT 验收', pri: 'mid', due: '2026-10-25', assignee: '王强', done: false, status: '进行中', project: '审批优化' },
      { id: 'TK-007', title: '知识库权限矩阵文档初稿', pri: 'low', due: '2026-11-01', assignee: '陈晨', done: false, status: '待办', project: '知识库' },
      { id: 'TK-008', title: '通讯录可见性配置自查', pri: 'mid', due: '2026-10-22', assignee: '郑好', done: true, status: '已完成', project: '' },
      { id: 'TK-009', title: '前台访客登记流程复核', pri: 'mid', due: '2026-10-21', assignee: '孙丽', done: true, status: '已完成', project: '' }
    ],

    rooms: [
      { id: 'R-A', name: 'A 会议室', seats: 8, floor: '3F' },
      { id: 'R-B', name: 'B 会议室', seats: 12, floor: '5F' },
      { id: 'R-C', name: 'C 洽谈室', seats: 4, floor: '3F' }
    ],

    /* 会议室占用：key 为日期，数组为占用段 */
    bookings: {
      '2026-10-26': [
        { room: 'R-A', start: 9, len: 1, title: '市场部周例会', host: '张伟' },
        { room: 'R-A', start: 14, len: 1, title: '产品评审会', host: '王强' },
        { room: 'R-B', start: 10, len: 2, title: 'Q4 述职会', host: '李娜' },
        { room: 'R-C', start: 15, len: 1, title: '渠道伙伴接待', host: '赵敏' }
      ]
    },

    schedules: [
      { id: 'SC-01', title: '部门早会', time: '09:30', duration: '20 分钟', type: '例行', done: true },
      { id: 'SC-02', title: '与王强同步绩效考核口径', time: '11:00', duration: '30 分钟', type: '约定', done: false },
      { id: 'SC-03', title: '产品评审会（A 会议室）', time: '14:30', duration: '60 分钟', type: '会议', done: false },
      { id: 'SC-04', title: '整理 10 月报销单据', time: '16:00', duration: '45 分钟', type: '待办', done: false }
    ],

    meetings: [
      { id: 'MT-01', title: '市场部周例会', room: 'A 会议室', time: '2026-10-26 09:00-10:00', host: '张伟', attendees: ['张伟', '赵敏', '孙丽'], status: '待开始', minutes: '' },
      { id: 'MT-02', title: '审批流程月度复盘', room: 'B 会议室', time: '2026-10-27 14:00-15:30', host: '郑好', attendees: ['张伟', '王强', '刘洋'], status: '待开始', minutes: '' },
      { id: 'MT-03', title: 'Q3 渠道复盘会', room: 'A 会议室', time: '2026-10-16 15:00-16:30', host: '李娜', attendees: ['张伟', '赵敏', '孙丽'], status: '已结束', minutes: '纪要_v3 已上传' }
    ],

    announcements: [
      { id: 'AN-01', title: '关于 10 月考勤异常核对的通知', range: '全员', pubDate: '2026-10-22 09:00', read: false, expired: false, body: '10 月考勤已进入核对期。如您的考勤存在迟到、早退或缺卡记录，请在 10 月 27 日前完成补卡申请或提供说明，逾期将按考勤管理制度处理。' },
      { id: 'AN-02', title: '办公区消防演练安排（10 月 28 日）', range: '全员', pubDate: '2026-10-20 16:30', read: true, expired: false, body: '本月底将举行年度消防演练，届时办公区将短暂断电，请提前保存好工作内容。演练路线与集合点详见附件。' },
      { id: 'AN-03', title: '会议室设备升级维护通知', range: '全员', pubDate: '2026-10-19 11:20', read: true, expired: false, body: 'A、B 会议室投影与小间音视频设备将于周末统一切换，切换后首次使用请在桌面端测试投屏，如有异常联系行政部。' },
      { id: 'AN-04', title: 'Q4 部门预算结余申报说明', range: '财务部', pubDate: '2026-10-18 10:00', read: true, expired: false, body: 'Q4 预算结余将开放申报，请各部门在本月 25 日前提交说明，逾期视为不申报。' },
      { id: 'AN-05', title: '国庆假期作息调整的通知', range: '全员', pubDate: '2026-09-30 09:00', read: true, expired: true, body: '国庆假期 10 月 1 日至 10 月 7 日放假，10 月 8 日（周四）起正常上班。' }
    ],

    docs: [
      { id: 'DOC-01', category: '制度规范', parent: null, title: '考勤管理制度', author: '郑好', updated: '2026-09-08', viewers: 128, content: ['一、考勤方式：员工上下班需在办公系统内完成定位打卡，打卡区域以公司 Wi-Fi 白名单及 GPS 范围为准；外勤人员需在外勤打卡时填写说明。', '二、迟到与早退：上班迟到 30 分钟以内记为「迟到」，超过 30 分钟记为「缺卡」；下班早于规定时间记为「早退」。', '三、补卡与申诉：因忘打卡、系统故障导致异常的，应在当月起 5 个工作日内发起补卡申请，经直接上级与考勤管理员审批后生效。'] },
      { id: 'DOC-02', category: '制度规范', parent: null, title: '费用报销管理制度', author: '吴迪', updated: '2026-08-20', viewers: 96, content: ['一、报销原则：报销须在费用发生后 30 天内发起，单据须附合规发票，住宿、交通按差旅标准执行。', '二、审批权限：金额不超过 5000 元的报销由直接上级审批；超过 5000 元或涉及招待的，须增加财务复核节点。', '三、付款时效：审批通过后，财务于 3-5 个工作日内打款，状态可在报销单详情中跟踪。'] },
      { id: 'DOC-03', category: '操作手册', parent: null, title: '会议室预定指南', author: '周涛', updated: '2026-07-15', viewers: 64, content: ['一、预定规则：通过「日程会议」页选择会议室、日期与时段；系统将自动检测冲突，冲突时段不可选择。', '二、取消与变更：会议开始前 1 小时可在会议详情中取消，释放会议室资源；变更时间请先在原时段取消后重新预定。', '三、注意事项：请勿提前超过 14 天预定；临时占用超过 30 分钟未到场的会议将被行政部回收。'] },
      { id: 'DOC-04', category: '操作手册', parent: null, title: '审批发起指南', author: '张伟', updated: '2026-09-25', viewers: 87, content: ['一、发起路径：审批页选择「发起申请」，按类型填写表单；请假时长超过剩余额度时将无法提交。', '二、审批链：默认审批链为「直接上级 → 类型复核人（HR/财务）」，发起后可随时查看当前节点。', '三、驳回处理：被驳回的申请可在原单上修改后重新提交，已填写内容自动保留。'] },
      { id: 'DOC-05', category: '模板', parent: null, title: '请假申请审批模板', author: '郑好', updated: '2026-09-30', viewers: 41, content: ['使用说明：本模板为请假审批的默认表单结构，包含假期类型、起止时间、时长（自动计算）、事由及附件。', '假期类型包括年假、事假、病假、调休四类，其中调休仅限因公值班产生。'] }
    ],

    attRecords: [
      { date: '2026-10-17', in: '08:52', out: '18:24', result: '正常' },
      { date: '2026-10-20', in: '09:21', out: '18:02', result: '迟到' },
      { date: '2026-10-21', in: '08:47', out: '18:36', result: '正常' },
      { date: '2026-10-22', in: '09:33', out: '17:52', result: '缺卡' },
      { date: '2026-10-23', in: '08:41', out: '—', result: '正常' }
    ],

    monthStat: { days: 16, normal: 13, late: 1, early: 0, absent: 1, outside: 2, pending: 1 }
  };
})();