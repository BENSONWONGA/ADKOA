const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dbm = require('./db');
const oo = require('./onlyoffice');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_SECRET = process.env.AUTH_SECRET || 'cloud-drive-auth-secret';
const { load, save, uid, childrenOf, pathOf, isDescendant, logActivity } = dbm;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, oo.STORAGE_DIR),
    filename: (req, file, cb) => cb(null, uid() + path.extname(file.originalname))
  })
});

// ---------- auth ----------
function tokenUser(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  if (!t) return null;
  try {
    const d = load();
    const { userId } = jwt.verify(t, AUTH_SECRET);
    return d.users.find(u => u.id === userId) || null;
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const u = tokenUser(req);
  if (!u) return res.status(401).json({ error: 'unauthorized' });
  req.user = u;
  next();
}

app.post('/api/login', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const user = dbm.ensureUser(name);
  const token = jwt.sign({ userId: user.id }, AUTH_SECRET, { expiresIn: '7d' });
  res.json({ token, user, users: load().users });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user, users: load().users }));

app.get('/api/users', (req, res) => res.json({ users: load().users }));

// ---------- tree & listing ----------
function publicNode(n) {
  const d = load();
  const owner = n.ownerId ? d.users.find(u => u.id === n.ownerId) : null;
  return {
    id: n.id, name: n.name, type: n.type, ext: n.ext || '', size: n.size || 0,
    parentId: n.parentId, updatedAt: n.updatedAt, createdAt: n.createdAt,
    owner: owner ? { name: owner.name, color: owner.color } : null,
    editable: n.type === 'file' && oo.isEditable(n.ext),
    docType: n.type === 'file' ? oo.documentType(n.ext) : null
  };
}

app.get('/api/tree', requireAuth, (req, res) => {
  const d = load();
  function build(parentId) {
    return childrenOf(parentId)
      .filter(n => n.type === 'folder')
      .map(n => ({ ...publicNode(n), children: build(n.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }
  res.json({ root: build(d.meta.rootId), rootId: d.meta.rootId, rootName: d.nodes[d.meta.rootId].name });
});

app.get('/api/nodes/:id', requireAuth, (req, res) => {
  const d = load();
  const node = d.nodes[req.params.id];
  if (!node) return res.status(404).json({ error: 'not found' });
  // breadcrumb
  const crumbs = [];
  let cur = node;
  while (cur) { crumbs.unshift(publicNode(cur)); cur = cur.parentId ? d.nodes[cur.parentId] : null; }
  const items = childrenOf(node.id).map(publicNode)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'zh') : a.type === 'folder' ? -1 : 1));
  res.json({ node: publicNode(node), crumbs, items });
});

app.get('/api/root', requireAuth, (req, res) => {
  const d = load();
  res.redirect(302, `/api/nodes/${d.meta.rootId}`);
});

// ---------- create folder ----------
app.post('/api/folders', requireAuth, (req, res) => {
  const d = load();
  const name = (req.body.name || '').trim();
  const parentId = req.body.parentId || d.meta.rootId;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!d.nodes[parentId] || d.nodes[parentId].type !== 'folder') return res.status(400).json({ error: 'bad parent' });
  const node = { id: uid(), name, type: 'folder', parentId, ownerId: req.user.id, createdAt: Date.now(), updatedAt: Date.now() };
  d.nodes[node.id] = node;
  logActivity(node.id, req.user.id, 'mkdir', `创建了文件夹「${name}」`);
  save();
  res.json(publicNode(node));
});

// ---------- helpers ----------
function uniqueName(parentId, name) {
  const taken = new Set(childrenOf(parentId).map(n => n.name));
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  while (taken.has(`${base}(${i})${ext}`)) i++;
  return `${base}(${i})${ext}`;
}

function deleteNode(nodeId) {
  const d = load();
  const node = d.nodes[nodeId];
  if (!node) return;
  if (node.type === 'folder') {
    childrenOf(nodeId).forEach(c => deleteNode(c.id));
  } else if (node.storageName) {
    const p = path.join(oo.STORAGE_DIR, node.storageName);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  delete d.nodes[nodeId];
  d.shares = d.shares.filter(s => s.nodeId !== nodeId);
}

// ---------- upload ----------
app.post('/api/upload', requireAuth, upload.array('files'), (req, res) => {
  const d = load();
  const parentId = req.query.parentId || d.meta.rootId;
  if (!d.nodes[parentId] || d.nodes[parentId].type !== 'folder') return res.status(400).json({ error: 'bad parent' });
  const created = [];
  for (const f of req.files || []) {
    const original = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const ext = (path.extname(original) || '').replace('.', '').toLowerCase();
    const name = uniqueName(parentId, original);
    const node = {
      id: uid(), name, ext, type: 'file', parentId, storageName: f.filename,
      size: f.size, ownerId: req.user.id, createdAt: Date.now(), updatedAt: Date.now(),
      ooKey: oo.newDocKey()
    };
    d.nodes[node.id] = node;
    logActivity(node.id, req.user.id, 'upload', `上传了「${name}」`);
    created.push(publicNode(node));
  }
  save();
  res.json({ created });
});

// ---------- download / preview ----------
app.get('/api/download/:id', (req, res) => {
  const d = load();
  const node = d.nodes[req.params.id];
  if (!node || node.type !== 'file') return res.status(404).json({ error: 'not found' });
  const p = path.join(oo.STORAGE_DIR, node.storageName);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'file missing' });
  const inline = req.query.inline === '1';
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(node.name)}`);
  res.sendFile(p);
});

app.get('/api/file/:id', requireAuth, (req, res) => {
  const d = load();
  const node = d.nodes[req.params.id];
  if (!node) return res.status(404).json({ error: 'not found' });
  res.json(publicNode(node));
});

// ---------- rename / move ----------
app.patch('/api/file/:id', requireAuth, (req, res) => {
  const d = load();
  const node = d.nodes[req.params.id];
  if (!node) return res.status(404).json({ error: 'not found' });
  if (req.body.name) {
    const name = req.body.name.trim();
    if (!name) return res.status(400).json({ error: 'bad name' });
    const old = node.name;
    node.name = name;
    if (node.type === 'file') node.ext = (path.extname(name) || '').replace('.', '').toLowerCase();
    logActivity(node.id, req.user.id, 'rename', `将「${old}」重命名为「${name}」`);
  }
  if (req.body.parentId !== undefined) {
    const parent = d.nodes[req.body.parentId];
    if (!parent || parent.type !== 'folder') return res.status(400).json({ error: 'bad parent' });
    if (parent.id === node.id || isDescendant(parent.id, node.id)) return res.status(400).json({ error: 'cannot move into itself' });
    node.parentId = parent.id;
    node.name = uniqueName(parent.id, node.name);
    logActivity(node.id, req.user.id, 'move', `将「${node.name}」移动到「${parent.name}」`);
  }
  node.updatedAt = Date.now();
  save();
  res.json(publicNode(node));
});

app.delete('/api/file/:id', requireAuth, (req, res) => {
  const d = load();
  const node = d.nodes[req.params.id];
  if (!node) return res.status(404).json({ error: 'not found' });
  if (node.id === d.meta.rootId) return res.status(400).json({ error: 'cannot delete root' });
  deleteNode(node.id);
  logActivity(node.parentId, req.user.id, 'delete', `删除了「${node.name}」`);
  save();
  res.json({ ok: true });
});

// ---------- activities ----------
app.get('/api/activities', requireAuth, (req, res) => {
  const d = load();
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const out = d.activities.slice(0, limit).map(a => {
    const u = a.userId ? d.users.find(x => x.id === a.userId) : null;
    const n = d.nodes[a.nodeId];
    return { ...a, user: u ? { name: u.name, color: u.color } : { name: '协作者', color: '#999' }, nodeName: n ? n.name : '(已删除)' };
  });
  res.json({ activities: out });
});

// ---------- sharing ----------
app.post('/api/shares', requireAuth, (req, res) => {
  const d = load();
  const node = d.nodes[req.body.nodeId];
  if (!node) return res.status(404).json({ error: 'not found' });
  const mode = req.body.mode === 'edit' ? 'edit' : 'view';
  const share = {
    id: uid(), nodeId: node.id, token: crypto.randomBytes(10).toString('hex'),
    mode, createdBy: req.user.id, createdAt: Date.now(),
    expiresAt: req.body.days ? Date.now() + req.body.days * 864e5 : null
  };
  d.shares.unshift(share);
  logActivity(node.id, req.user.id, 'share', `创建了${mode === 'edit' ? '可编辑' : '只读'}分享链接`);
  save();
  res.json(share);
});

app.get('/api/shares', requireAuth, (req, res) => {
  const d = load();
  res.json({
    shares: d.shares.map(s => {
      const n = d.nodes[s.nodeId];
      const u = d.users.find(x => x.id === s.createdBy);
      return { ...s, nodeName: n ? n.name : '(已删除)', nodeType: n ? n.type : null, creator: u ? u.name : '?' };
    })
  });
});

app.delete('/api/shares/:id', requireAuth, (req, res) => {
  const d = load();
  d.shares = d.shares.filter(s => s.id !== req.params.id);
  save();
  res.json({ ok: true });
});

// public share access
function shareNode(req, res, next) {
  const d = load();
  const s = d.shares.find(x => x.token === req.params.token);
  if (!s || !d.nodes[s.nodeId]) return res.status(404).json({ error: 'share not found' });
  if (s.expiresAt && s.expiresAt < Date.now()) return res.status(410).json({ error: 'link expired' });
  req.share = s;
  req.shareNode = d.nodes[s.nodeId];
  next();
}

app.get('/api/s/:token', shareNode, (req, res) => {
  const d = load();
  const node = req.shareNode;
  if (node.type === 'folder') {
    const items = childrenOf(node.id).map(publicNode)
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'zh') : a.type === 'folder' ? -1 : 1));
    return res.json({ share: { mode: req.share.mode }, node: publicNode(node), items });
  }
  res.json({ share: { mode: req.share.mode }, node: publicNode(node), items: [] });
});

app.get('/api/s/:token/download/:id', shareNode, (req, res) => {
  const node = req.shareNode;
  const target = load().nodes[req.params.id];
  if (!target || target.type !== 'file') return res.status(404).json({ error: 'not found' });
  if (target.id !== node.id && !isDescendant(target.id, node.id)) return res.status(403).json({ error: 'forbidden' });
  const p = path.join(oo.STORAGE_DIR, target.storageName);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'file missing' });
  const inline = req.query.inline === '1';
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(target.name)}`);
  res.sendFile(p);
});

// ---------- onlyoffice ----------
app.get('/api/onlyoffice/config/:id', requireAuth, (req, res) => {
  const d = load();
  const node = d.nodes[req.params.id];
  if (!node || node.type !== 'file') return res.status(404).json({ error: 'not found' });
  const mode = req.query.mode === 'view' ? 'view' : 'edit';
  res.json(oo.buildEditorConfig(node, req.user, mode, req));
});

// guest editor config via share token
app.get('/api/onlyoffice/config-share/:token/:id', (req, res) => {
  const d = load();
  const s = d.shares.find(x => x.token === req.params.token);
  if (!s || s.expiresAt && s.expiresAt < Date.now()) return res.status(404).json({ error: 'share not found' });
  const node = d.nodes[req.params.id];
  if (!node || node.type !== 'file') return res.status(404).json({ error: 'not found' });
  if (node.id !== d.nodes[s.nodeId].id && !isDescendant(node.id, s.nodeId)) return res.status(403).json({ error: 'forbidden' });
  const guest = { id: 'guest-' + s.token.slice(0, 6), name: '访客·' + s.token.slice(0, 4) };
  const mode = s.mode === 'edit' ? 'edit' : 'view';
  res.json(oo.buildEditorConfig(node, guest, mode, req));
});

// DS downloads the document (token-authorized, no session)
app.get('/api/onlyoffice/download/:id', (req, res) => {
  let payload;
  try { payload = jwt.verify(req.query.token, oo.JWT_SECRET); } catch { return res.status(401).json({ error: 'bad token' }); }
  if (payload.purpose !== 'download' || payload.nodeId !== req.params.id) return res.status(403).json({ error: 'forbidden' });
  const node = load().nodes[req.params.id];
  if (!node) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(oo.STORAGE_DIR, node.storageName));
});

// DS save callback
app.post('/api/onlyoffice/callback/:id', async (req, res) => {
  try {
    const header = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const t = header || req.query.token || req.body.token;
    let payload;
    try { payload = jwt.verify(t, oo.JWT_SECRET); } catch { return res.status(401).json({ error: 1, message: 'bad token' }); }
    if (payload.purpose !== 'callback' || payload.nodeId !== req.params.id) return res.status(403).json({ error: 1 });
    const result = await oo.handleCallback(req.params.id, req.body, req);
    res.json(result);
  } catch (e) {
    console.error('onlyoffice callback error:', e);
    res.status(500).json({ error: 1, message: String(e.message || e) });
  }
});

app.get('/api/settings', (req, res) => {
  res.json({ dsUrl: oo.DOC_SERVER_URL });
});

// SPA fallback for share links
app.get('/s/:token', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ---------- seed demo content ----------
function seedDemo() {
  const d = load();
  if (d.activities.length > 0) return;
  const root = d.meta.rootId;
  const docs = { id: uid(), name: '产品文档', type: 'folder', parentId: root, ownerId: d.users[0].id, createdAt: Date.now(), updatedAt: Date.now() };
  d.nodes[docs.id] = docs;
  const samples = [
    ['需求说明书.docx', 'word'], ['季度预算表.xlsx', 'cell'], ['项目路演.pptx', 'slide']
  ];
  for (const [name] of samples) {
    const ext = name.split('.').pop();
    const p = path.join(oo.STORAGE_DIR, uid() + '.' + ext);
    fs.writeFileSync(p, Buffer.from('%docus placeholder - replace by uploading real files'));
    const node = { id: uid(), name, ext, type: 'file', parentId: docs.id, storageName: path.basename(p), size: fs.statSync(p).size, ownerId: d.users[0].id, createdAt: Date.now(), updatedAt: Date.now(), ooKey: oo.newDocKey() };
    d.nodes[node.id] = node;
    logActivity(node.id, d.users[0].id, 'upload', `上传了「${name}」`);
  }
  logActivity(docs.id, d.users[0].id, 'mkdir', '创建了文件夹「产品文档」');
  save();
}

fs.mkdirSync(oo.STORAGE_DIR, { recursive: true });
seedDemo();

app.listen(PORT, () => {
  console.log(`Cloud Drive running at http://localhost:${PORT}`);
  console.log(`OnlyOffice DS URL: ${oo.DOC_SERVER_URL} (set ONLYOFFICE_DS_URL to change)`);
});
