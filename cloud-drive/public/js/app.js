/* CloudDrive 协作网盘前端 */
const $ = s => document.querySelector(s);
const $$ = (s, scope) => [...(scope || document).querySelectorAll(s)];

const state = {
  token: localStorage.getItem('cd_token') || '',
  user: null,
  folderId: null,
  tree: null,
  rootName: '',
  settings: { dsUrl: 'http://localhost:8080' },
  editorDoc: null
};

/* ---------- utils ---------- */
async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers);
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  if (opts.json) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json); delete opts.json; }
  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401 && !path.includes('/login')) { logout(); throw new Error('unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function fmtSize(n) {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0;
  while (n >= 1024 && i < 3) { n /= 1024; i++; }
  return n.toFixed(i ? 1 : 0) + ' ' + u[i];
}
function fmtTime(ts) {
  const d = new Date(ts), now = Date.now();
  if (now - ts < 60000) return '刚刚';
  if (now - ts < 3600000) return Math.floor((now - ts) / 60000) + ' 分钟前';
  if (now - ts < 86400000) return Math.floor((now - ts) / 3600000) + ' 小时前';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const ICONS = { folder: '📁', word: '📄', cell: '📊', slide: '📽', pdf: '📕', image: '🖼', text: '📃', zip: '🗜', video: '🎬', audio: '🎵', other: '📎' };
function iconFor(f) {
  if (f.type === 'folder') return ICONS.folder;
  const e = (f.ext || '').toLowerCase();
  if (f.docType === 'word') return ICONS.word;
  if (f.docType === 'cell') return ICONS.cell;
  if (f.docType === 'slide') return ICONS.slide;
  if (f.docType === 'pdf') return ICONS.pdf;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(e)) return ICONS.image;
  if (['txt', 'md', 'json', 'log', 'js', 'css', 'html', 'xml', 'yml', 'yaml'].includes(e)) return ICONS.text;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return ICONS.zip;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(e)) return ICONS.video;
  if (['mp3', 'wav', 'flac', 'ogg'].includes(e)) return ICONS.audio;
  return ICONS.other;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 2600);
}

function showView(v) {
  $$('.app, #view-login, .editor-wrap').forEach(el => el.classList.add('hidden'));
  $('#view-' + v).classList.remove('hidden');
}

/* ---------- modal ---------- */
function openModal(title, bodyHTML, { okText = '确定', cancelText = '取消', showOk = true, onOk } = {}) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML;
  $('#modal-ok').textContent = okText;
  $('#modal-ok').classList.toggle('hidden', !showOk);
  $('#modal-cancel').textContent = cancelText;
  $('#modal-mask').classList.remove('hidden');
  const close = () => { $('#modal-mask').classList.add('hidden'); $('#modal-ok').onclick = null; };
  $('#modal-cancel').onclick = close;
  $('#modal-ok').onclick = async () => {
    if (!onOk || await onOk() !== false) close();
  };
  const inp = $('#modal-body input[type=text]'); if (inp) inp.focus();
  return { close, body: $('#modal-body') };
}

/* ---------- login ---------- */
async function initLogin() {
  showView('login');
  let users = [];
  if (state.token) {
    try { const me = await api('/api/me'); state.user = me.user; users = me.users; return enterApp(); }
    catch { }
  }
  try { users = (await (await fetch('/api/users')).json()).users || []; } catch { }
  renderQuickUsers(users);
}

function renderQuickUsers(users) {
  const list = users.length ? users : [];
  $('#quick-users').innerHTML = list.map(u =>
    `<div class="quick-user" data-name="${esc(u.name)}"><div class="avatar" style="background:${u.color}">${esc(u.name[0])}</div><span>${esc(u.name)}</span></div>`
  ).join('');
  $$('#quick-users .quick-user').forEach(el => el.onclick = () => { $('#login-name').value = el.dataset.name; doLogin(); });
}

async function doLogin() {
  const name = $('#login-name').value.trim();
  if (!name) return toast('请输入昵称');
  const res = await api('/api/login', { method: 'POST', json: { name } });
  state.token = res.token; state.user = res.user;
  localStorage.setItem('cd_token', res.token);
  renderQuickUsers(res.users);
  enterApp();
}
function logout() {
  localStorage.removeItem('cd_token'); state.token = ''; state.user = null;
  showView('login');
}

async function enterApp() {
  showView('drive');
  $('#user-name').textContent = state.user.name;
  const av = $('#user-avatar');
  av.textContent = state.user.name[0]; av.style.background = state.user.color;
  const st = await api('/api/settings'); state.settings = st;
  await loadTree();
  switchNav('files');
}

/* ---------- tree ---------- */
async function loadTree() {
  const t = await api('/api/tree');
  state.tree = t.root; state.rootId = t.rootId; state.rootName = t.rootName;
  renderTree();
}

function treeHTML(nodes) {
  return nodes.map(n => `
    <div class="tree-item" data-id="${n.id}">📁 ${esc(n.name)}</div>
    ${n.children.length ? `<div class="tree-children">${treeHTML(n.children)}</div>` : ''}
  `).join('');
}

function renderTree() {
  const root = { id: state.rootId, name: state.rootName || '全部文件', children: state.tree };
  $('#tree').innerHTML = treeHTML([root]);
  $$('#tree .tree-item').forEach(el => el.onclick = () => openFolder(el.dataset.id));
  markTreeActive();
}
function markTreeActive() {
  $$('#tree .tree-item').forEach(el => el.classList.toggle('active', el.dataset.id === state.folderId));
}

/* ---------- navigation ---------- */
function switchNav(nav) {
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.nav === nav));
  $('#panel-shares').classList.toggle('hidden', nav !== 'shares');
  $('#panel-activity').classList.toggle('hidden', nav !== 'activity');
  $('#dropzone').classList.toggle('hidden', nav !== 'files');
  if (nav === 'files' && state.folderId) openFolder(state.folderId);
  if (nav === 'shares') loadShares();
  if (nav === 'activity') loadActivity();
}

async function openFolder(id) {
  state.folderId = id;
  switchNavSilent('files');
  const data = await api(`/api/nodes/${id}`);
  state.rootName = data.crumbs[0].name;
  $('#crumbs').innerHTML = data.crumbs.map((c, i) =>
    `${i ? '<span class="crumb-sep">/</span>' : ''}<span class="crumb ${i === data.crumbs.length - 1 ? 'current' : ''}" data-id="${c.id}">${esc(c.name)}</span>`
  ).join('');
  $$('#crumbs .crumb:not(.current)').forEach(el => el.onclick = () => openFolder(el.dataset.id));
  renderFileList(data.items, $('#file-list'));
  $('#empty-state').classList.toggle('hidden', data.items.length > 0);
  renderTree();
}
function switchNavSilent(nav) {
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.nav === nav));
  $('#panel-shares').classList.add('hidden');
  $('#panel-activity').classList.add('hidden');
  $('#dropzone').classList.remove('hidden');
}

/* ---------- file list ---------- */
function renderFileList(items, container) {
  container.innerHTML = items.map(f => `
    <div class="file-row" data-id="${f.id}" data-type="${f.type}">
      <div class="file-name"><span class="file-icon">${iconFor(f)}</span>
        <span class="fname">${esc(f.name)}</span>
        ${f.editable ? '<span class="badge">在线编辑</span>' : ''}
      </div>
      <div class="file-meta">${f.type === 'folder' ? '—' : fmtSize(f.size)}</div>
      <div class="file-meta">${fmtTime(f.updatedAt)}</div>
      <div class="owner-chip">${f.owner ? `<span class="dot" style="background:${f.owner.color}">${esc(f.owner.name[0])}</span>${esc(f.owner.name)}` : ''}</div>
      <div class="row-actions"><button class="icon-btn more-btn" title="更多">⋯</button></div>
    </div>`).join('');
  $$('.file-row', container).forEach(row => {
    const f = items.find(x => x.id === row.dataset.id);
    row.onclick = e => {
      if (e.target.closest('.more-btn')) return;
      if (f.type === 'folder') openFolder(f.id);
      else openFile(f);
    };
    row.querySelector('.more-btn').onclick = e => { e.stopPropagation(); showCtx(e, f); };
    row.oncontextmenu = e => { e.preventDefault(); showCtx(e, f); };
  });
}

/* ---------- context menu ---------- */
function showCtx(e, f) {
  const menu = $('#ctx-menu');
  const acts = [];
  if (f.type === 'file') {
    if (f.editable) acts.push(['✏️ 在线编辑', () => openEditor(f, 'edit')]);
    acts.push(['👁 预览', () => previewFile(f)]);
    acts.push(['⬇️ 下载', () => download(f.id, f.name)]);
  }
  acts.push(['🔗 分享', () => shareDialog(f)]);
  acts.push(['✏️ 重命名', () => renameDialog(f)]);
  if (f.type === 'file') acts.push(['📂 移动到', () => moveDialog(f)]);
  acts.push(['🗑️ 删除', () => deleteDialog(f), true]);
  menu.innerHTML = acts.map(([label], i) => `<div data-i="${i}" class="${acts[i][2] ? 'danger' : ''}">${label}</div>`).join('');
  menu.style.left = Math.min(e.clientX, innerWidth - 170) + 'px';
  menu.style.top = Math.min(e.clientY, innerHeight - acts.length * 38 - 16) + 'px';
  menu.classList.remove('hidden');
  $$('#ctx-menu div').forEach((el, i) => el.onclick = () => { menu.classList.add('hidden'); acts[i][1](); });
}
document.addEventListener('click', () => $('#ctx-menu').classList.add('hidden'));

/* ---------- actions ---------- */
function download(id, name) {
  const a = document.createElement('a');
  a.href = `/api/download/${id}?token=${encodeURIComponent(state.token)}`;
  a.download = name; a.click();
}

function openFile(f) {
  if (f.editable) openEditor(f, 'edit');
  else previewFile(f);
}

function renameDialog(f) {
  openModal('重命名', `<input type="text" id="m-name" value="${esc(f.name)}">`, {
    onOk: async () => {
      const name = $('#m-name').value.trim();
      if (!name) return false;
      await api(`/api/file/${f.id}`, { method: 'PATCH', json: { name } });
      toast('已重命名'); openFolder(state.folderId);
    }
  });
}

async function deleteDialog(f) {
  openModal('删除确认', `<p>确定删除「${esc(f.name)}」吗？${f.type === 'folder' ? '文件夹内所有内容也将被删除。' : ''}此操作不可恢复。</p>`, {
    okText: '删除', onOk: async () => {
      await api(`/api/file/${f.id}`, { method: 'DELETE' });
      toast('已删除'); loadTree();
      openFolder(f.id === state.folderId ? (f.parentId || state.rootId) : state.folderId);
    }
  });
}

function newFolderDialog() {
  openModal('新建文件夹', `<input type="text" id="m-name" placeholder="文件夹名称">`, {
    onOk: async () => {
      const name = $('#m-name').value.trim();
      if (!name) return false;
      await api('/api/folders', { method: 'POST', json: { name, parentId: state.folderId } });
      toast('已创建'); loadTree(); openFolder(state.folderId);
    }
  });
}

/* move: folder picker */
async function moveDialog(f) {
  const flat = [];
  (function walk(nodes, depth) {
    nodes.forEach(n => { flat.push({ id: n.id, name: '　'.repeat(depth) + '📁 ' + n.name }); walk(n.children, depth + 1); });
  })([...state.tree], 0);
  flat.unshift({ id: state.rootId, name: '🏠 ' + (state.rootName || '全部文件') });
  openModal(`移动「${f.name}」`, `<div class="tree-select scroll">${flat.map(x => `<div class="tree-item" data-id="${x.id}">${esc(x.name)}</div>`).join('')}</div>`, {
    showOk: false,
    onOk: () => { }
  });
  $$('#modal-body .tree-item').forEach(el => el.onclick = async () => {
    if (el.dataset.id === f.id) return toast('不能移动到自身');
    await api(`/api/file/${f.id}`, { method: 'PATCH', json: { parentId: el.dataset.id } });
    $('#modal-mask').classList.add('hidden');
    toast('已移动'); loadTree(); openFolder(state.folderId);
  });
}

/* ---------- preview ---------- */
async function previewFile(f) {
  const url = `/api/download/${f.id}?inline=1&token=${encodeURIComponent(state.token)}`;
  const e = (f.ext || '').toLowerCase();
  let body;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(e)) body = `<img class="preview-img" src="${url}">`;
  else if (e === 'pdf') body = `<iframe src="${url}" style="width:100%;height:60vh;border:1px solid var(--line);border-radius:10px"></iframe>`;
  else if (['txt', 'md', 'json', 'log', 'js', 'css', 'html', 'xml', 'yml', 'yaml', 'csv'].includes(e)) {
    const text = await (await fetch(url)).text();
    body = `<textarea class="preview-text" readonly>${esc(text.slice(0, 200000))}</textarea>`;
  } else if (['mp4', 'webm'].includes(e)) body = `<video class="preview-img" src="${url}" controls></video>`;
  else if (['mp3', 'wav', 'ogg'].includes(e)) body = `<audio src="${url}" controls style="width:100%"></audio>`;
  else body = `<p style="color:var(--muted);text-align:center;padding:30px">该格式不支持预览，请<a href="${url}" download>下载</a>后查看</p>`;
  openModal(`预览 · ${f.name}`, body, { showOk: false, cancelText: '关闭' });
}

/* ---------- upload ---------- */
async function uploadFiles(files) {
  if (!files.length) return;
  const fd = new FormData();
  [...files].forEach(f => fd.append('files', f));
  toast(`正在上传 ${files.length} 个文件…`);
  await api(`/api/upload?parentId=${state.folderId}`, { method: 'POST', body: fd });
  toast('上传完成');
  loadTree(); openFolder(state.folderId);
}

function bindUpload() {
  $('#btn-upload').onclick = () => $('#file-input').click();
  $('#file-input').onchange = e => uploadFiles(e.target.files);
  $('#btn-newfolder').onclick = newFolderDialog;
  $('#btn-logout').onclick = logout;
  $('#btn-login').onclick = doLogin;
  $('#login-name').onkeydown = e => e.key === 'Enter' && doLogin();
  $$('.nav-item').forEach(el => el.onclick = () => switchNav(el.dataset.nav));
  $('#btn-close-editor').onclick = closeEditor;

  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); $('#drop-hint').classList.remove('hidden'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || !dz.contains(e.relatedTarget)) $('#drop-hint').classList.add('hidden'); }));
  dz.addEventListener('drop', e => uploadFiles(e.dataTransfer.files));
}

/* ---------- shares ---------- */
async function shareDialog(f) {
  let mode = 'view';
  openModal(`分享「${f.name}」`, `
    <div class="radio-row">
      <div class="radio-card sel" data-m="view">👁 仅查看<small>可预览和下载</small></div>
      <div class="radio-card" data-m="edit">✏️ 可编辑<small>可在线协作编辑</small></div>
    </div>
    <div id="share-result"></div>
    <select id="share-days">
      <option value="">永久有效</option>
      <option value="1">1 天有效</option>
      <option value="7">7 天有效</option>
      <option value="30">30 天有效</option>
    </select>`, {
    okText: '创建链接',
    onOk: async () => {
      const days = $('#share-days').value;
      const s = await api('/api/shares', { method: 'POST', json: { nodeId: f.id, mode, days: days ? +days : null } });
      const link = `${location.origin}/s/${s.token}`;
      $('#modal-ok').classList.add('hidden');
      $('#share-result').innerHTML = `
        <div class="share-link-box"><input type="text" readonly value="${link}"><button class="btn" onclick="navigator.clipboard.writeText('${link}');this.textContent='已复制'">复制</button></div>
        <p style="color:var(--muted);font-size:12px">获得链接的任何人${mode === 'edit' ? '可在线编辑' : '可查看下载'}此内容。</p>`;
    }
  });
  $$('#modal-body .radio-card').forEach(el => el.onclick = () => {
    $$('#modal-body .radio-card').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel'); mode = el.dataset.m;
  });
}

async function loadShares() {
  switchNavSilent('shares'); $('#panel-shares').classList.remove('hidden'); $('#dropzone').classList.add('hidden');
  const { shares } = await api('/api/shares');
  $('#shares-list').innerHTML = shares.length ? shares.map(s => `
    <div class="share-item">
      <span class="file-icon">${s.nodeType === 'folder' ? '📁' : '📄'}</span>
      <div class="info">
        <div style="font-weight:600">${esc(s.nodeName)} <span class="mode-badge">${s.mode === 'edit' ? '可编辑' : '仅查看'}</span></div>
        <div class="link">${location.origin}/s/${s.token}</div>
        <div class="file-meta">${esc(s.creator)} 创建 · ${fmtTime(s.createdAt)}${s.expiresAt ? ' · ' + new Date(s.expiresAt).toLocaleDateString() + ' 过期' : ''}</div>
      </div>
      <button class="btn" onclick="navigator.clipboard.writeText('${location.origin}/s/${s.token}');toast('已复制')">复制链接</button>
      <button class="icon-btn" title="取消分享" data-id="${s.id}">✕</button>
    </div>`).join('') : '<p style="color:var(--muted)">暂无分享，在文件上右键即可创建分享链接</p>';
  $$('#shares-list [data-id]').forEach(el => el.onclick = async () => {
    await api('/api/shares/' + el.dataset.id, { method: 'DELETE' });
    toast('已取消分享'); loadShares();
  });
}

/* ---------- activity ---------- */
async function loadActivity() {
  switchNavSilent('activity'); $('#panel-activity').classList.remove('hidden'); $('#dropzone').classList.add('hidden');
  const { activities } = await api('/api/activities?limit=50');
  $('#activity-list').innerHTML = activities.length ? activities.map(a => `
    <div class="activity-item">
      <span class="avatar" style="background:${a.user.color};width:30px;height:30px;font-size:13px">${esc(a.user.name[0])}</span>
      <div class="txt">${esc(a.user.name)} ${esc(a.detail || a.action)} <b>${esc(a.nodeName)}</b></div>
      <div class="ts">${fmtTime(a.ts)}</div>
    </div>`).join('') : '<p style="color:var(--muted)">暂无动态</p>';
}

/* ---------- OnlyOffice editor ---------- */
function loadDsApi(serverUrl) {
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) return resolve();
    const s = document.createElement('script');
    s.src = `${serverUrl}/web-apps/apps/api/documents/api.js`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('DS api.js load failed'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('timeout')), 6000);
  });
}

async function openEditor(f, mode, shareToken) {
  state.shareToken = shareToken || null;
  showView('editor');
  $('#editor-title').textContent = f.name;
  $('#editor-mode').textContent = mode === 'edit' ? '协作编辑' : '只读预览';
  $('#editor-hint').classList.add('hidden');
  $('#onlyoffice-placeholder').innerHTML = '';
  let cfg;
  try {
    cfg = shareToken
      ? await api(`/api/onlyoffice/config-share/${shareToken}/${f.id}`)
      : await api(`/api/onlyoffice/config/${f.id}?mode=${mode}`);
  } catch (e) { return editorFail(e); }
  try {
    await loadDsApi(cfg.serverUrl);
    state.editorDoc = new DocsAPI.DocEditor('onlyoffice-placeholder', { ...cfg.config, token: cfg.token });
  } catch (e) { editorFail(e); }
}
function editorFail(e) {
  console.warn('OnlyOffice unavailable:', e);
  $('#editor-hint').classList.remove('hidden');
  $('#onlyoffice-placeholder').innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">无法连接文档服务器（${state.settings.dsUrl}）<br><button class="btn" style="margin-top:14px" onclick="closeEditor()">返回</button></div>`;
}
function closeEditor() {
  if (state.editorDoc) { try { state.editorDoc.destroyEditor(); } catch { } state.editorDoc = null; }
  if (state.shareToken) { const t = state.shareToken; state.shareToken = null; loadSharePage(t); return; }
  showView('drive');
  openFolder(state.folderId);
}

/* ---------- guest share page ---------- */
async function loadSharePage(token) {
  showView('share');
  try {
    const data = await api(`/api/s/${token}`);
    $('#share-title').textContent = '🔗 ' + data.node.name;
    $('#share-mode-badge').textContent = data.share.mode === 'edit' ? '可编辑分享' : '只读分享';
    if (data.node.type === 'file') {
      renderShareList([data.node], token, data.share.mode, true);
    } else {
      renderShareList(data.items, token, data.share.mode, false);
    }
  } catch (e) {
    $('#share-list').innerHTML = `<div class="empty"><div class="empty-icon">🚫</div><p>${esc(e.message === 'share not found' ? '分享链接不存在或已失效' : '加载失败')}</p></div>`;
  }
}

function renderShareList(items, token, mode, isSingle) {
  const c = $('#share-list');
  c.innerHTML = items.map(f => `
    <div class="file-row" data-id="${f.id}">
      <div class="file-name"><span class="file-icon">${iconFor(f)}</span><span class="fname">${esc(f.name)}</span></div>
      <div class="file-meta">${f.type === 'folder' ? '' : fmtSize(f.size)}</div>
      <div class="file-meta">${fmtTime(f.updatedAt)}</div>
      <div class="row-actions">
        ${f.type === 'file' ? `<button class="btn dl">下载</button>` : ''}
        ${f.editable ? `<button class="btn btn-primary ed">${mode === 'edit' ? '编辑' : '查看'}</button>` : ''}
      </div>
    </div>`).join('');
  $$('.file-row', c).forEach(row => {
    const f = items.find(x => x.id === row.dataset.id);
    const dl = row.querySelector('.dl'); if (dl) dl.onclick = () => { location.href = `/api/s/${token}/download/${f.id}`; };
    const ed = row.querySelector('.ed'); if (ed) ed.onclick = () => openEditor(f, mode, token);
    if (f.type === 'file' && !f.editable) row.onclick = () => { location.href = `/api/s/${token}/download/${f.id}?inline=1`; };
  });
}

/* ---------- boot ---------- */
bindUpload();
const shareMatch = location.pathname.match(/^\/s\/([a-f0-9]+)$/);
if (shareMatch) {
  loadSharePage(shareMatch[1]);
} else {
  initLogin();
}
