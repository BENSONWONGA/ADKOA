# OA 协作系统 — 后端服务

基于 PRD v0.1 与已验证原型的真实后端实现：**Node.js + Express + SQLite（sql.js/WASM）**，零原生编译依赖。

## 快速启动

```bash
cd oa-server
npm install          # 首次
npm start            # 启动服务（默认端口 3000）
```

启动后打开 <http://localhost:3000> 即进入 OA 系统（服务同时托管前端静态页与 `/api` 接口）。

- 首次启动自动创建 SQLite 数据库 `data/oa.db` 并写入与原型一致的种子数据。
- 删除 `data/oa.db` 后重启即可重置为种子数据。
- 默认端口 `3000`，可用环境变量 `PORT` 覆盖；前端目录可用 `FRONTEND_DIR` 覆盖。

## 架构

```
oa-server/
├── server.js      Express 应用：静态托管 + 全部 REST API
├── db.js          SQLite 数据层（建表、种子数据、持久化）
├── data/oa.db     SQLite 数据库文件（首次启动自动生成）
├── test-api.js    22 项接口自动化测试（npm test）
└── package.json
```

前端 `/workspace/oa-prototype/` 的 `assets/api.js` 已从 mock 存根切换为真实 `fetch('/api/...')` 调用，接口签名与原型存根一一对应，页面层零改动。

## API 一览（与原型 `api.js` 存根一一对应）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/approvals?tab=my\|pending` | 我的申请 / 待办审批（含 pending 计数） |
| GET | `/api/approvals/:id` | 单张单据详情（含审批历史） |
| POST | `/api/approvals` | 发起申请 `{type,title,fields}` |
| POST | `/api/approvals/:id/action` | 同意/驳回 `{action,comment}`（直接上级→复核→通过/驳回） |
| POST | `/api/approvals/:id/cancel` | 撤销（仅审批中） |
| GET | `/api/attendance/records` | 打卡记录 + 今日 + 月度统计 |
| POST | `/api/attendance/clock-in` / `clock-out` | 上下班打卡 `{outside}`（按系统时间判定迟到/早退/缺卡） |
| POST | `/api/attendance/reapply` | 补卡申请 |
| GET | `/api/rooms/:date/bookings` | 当日会议室占用 |
| POST | `/api/bookings` | 预定（含冲突检测）`{room,date,start,len,title}` |
| GET | `/api/meetings` / `/api/schedules` | 我的会议 / 今日日程 |
| POST | `/api/schedules` | 新建日程 |
| GET | `/api/tasks` | 任务列表 |
| POST | `/api/tasks` | 新建任务 |
| POST | `/api/tasks/:id/status` | 完成/重新开启 `{done}` |
| GET | `/api/announcements` | 公告（含 unread 计数） |
| POST | `/api/announcements/:id/read` | 标记已读 |
| GET | `/api/docs` / `/api/docs/:id` | 知识库文档列表 / 详情 |
| GET | `/api/contacts?kw=` | 通讯录（组织树 + 成员检索） |
| GET | `/api/users` | 成员（负责人下拉等） |

## 测试

```bash
npm test             # 22 项接口测试（需先启动服务）
```

已通过的验证：
- 接口层 22/22：审批全链路（提交→同意→撤销）、打卡判定、会议室冲突检测、任务增改、公告已读、文档、通讯录检索。
- 端到端 22/22（jsdom 加载真实页面 + 真实 HTTP 到后端）：7 个页面无运行时报错，页面数据来自真实数据库，交互（同意审批、预定会议、新建任务、搜索）真实落库。

## 已知边界（演示模式）

- **无登录鉴权**：会话用户固定为「张伟」（`server.js` 中 `CURRENT_USER`），与原型 mock 一致；接入认证时在 `/api` 前挂载鉴权中间件即可。
- **SQL 拼接**：为保持零依赖简洁，SQL 以参数插值形式编写，当前仅服务端内可信数据。正式上线建议改用参数化语句。
- **考勤定位**：打卡判定的「定位/Wi-Fi」为演示文案，判定基于服务器系统时间。
- 待办审批中的二级复核人、驳回后的「修改重提」沿用原型交互，接口已支持。
