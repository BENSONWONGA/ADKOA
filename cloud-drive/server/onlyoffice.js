// OnlyOffice Document Server integration
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { load, save, logActivity, uid } = require('./db');

const JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || 'onlyoffice-secret-change-me';
const DOC_SERVER_URL = process.env.ONLYOFFICE_DS_URL || 'http://localhost:8080';
const STORAGE_DIR = path.join(__dirname, '..', 'storage');

const TYPE_MAP = {
  word: ['docx', 'doc', 'odt', 'rtf', 'txt', 'mht', 'html', 'htm'],
  cell: ['xlsx', 'xls', 'ods', 'csv'],
  slide: ['pptx', 'ppt', 'odp'],
  pdf: ['pdf', 'pdfa', 'epub', 'xps']
};

function documentType(ext) {
  ext = (ext || '').toLowerCase();
  for (const [t, list] of Object.entries(TYPE_MAP)) {
    if (list.includes(ext)) return t;
  }
  return null;
}

function isEditable(ext) {
  ext = (ext || '').toLowerCase();
  return ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'odt', 'ods', 'odp', 'rtf', 'txt', 'csv', 'pdf'].includes(ext);
}

function newDocKey() {
  return crypto.randomBytes(12).toString('hex');
}

function baseOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

// Build editor config for a file node
function buildEditorConfig(node, user, mode, req) {
  const d = load();
  const origin = baseOrigin(req);
  const ext = node.ext || '';
  const docType = documentType(ext) || 'word';

  // access token allowing the DS to download this file
  const dlToken = jwt.sign({ nodeId: node.id, purpose: 'download' }, JWT_SECRET, { expiresIn: '12h' });
  const cbToken = jwt.sign({ nodeId: node.id, purpose: 'callback' }, JWT_SECRET, { expiresIn: '12h' });

  const canEdit = mode === 'edit' && isEditable(ext);

  const config = {
    document: {
      fileType: ext,
      key: node.ooKey || (node.ooKey = newDocKey()),
      title: node.name,
      url: `${origin}/api/onlyoffice/download/${node.id}?token=${dlToken}`,
      permissions: {
        edit: canEdit,
        comment: canEdit,
        download: true,
        print: true
      }
    },
    documentType: docType,
    editorConfig: {
      callbackUrl: `${origin}/api/onlyoffice/callback/${node.id}?token=${cbToken}`,
      lang: 'zh-CN',
      user: { id: user.id, name: user.name },
      customization: {
        about: false,
        feedback: false,
        compactHeader: true,
        toolbarHideFilename: true
      }
    }
  };

  if (canEdit) {
    config.document.permissions.save = true;
  }

  // sign the whole config (DS JWT verification)
  const token = jwt.sign(config, JWT_SECRET);
  save();
  return { serverUrl: DOC_SERVER_URL, config, token };
}

// Handle DS callback: status 2/6 => save file
async function handleCallback(nodeId, body, req) {
  const d = load();
  const node = d.nodes[nodeId];
  if (!node) throw Object.assign(new Error('file not found'), { status: 404 });

  const status = body.status;
  if (status === 1) {
    logActivity(nodeId, null, 'editing', '正在协作编辑');
    return { error: 0 };
  }
  if (status === 4) {
    logActivity(nodeId, null, 'closed', '已关闭编辑器');
    return { error: 0 };
  }
  if (status === 2 || status === 6 || status === 7) {
    if (body.url) {
      const res = await fetch(body.url);
      if (!res.ok) throw Object.assign(new Error('download from DS failed: ' + res.status), { status: 500 });
      const buf = Buffer.from(await res.arrayBuffer());
      const realPath = path.join(STORAGE_DIR, node.storageName);
      fs.writeFileSync(realPath, buf);
      node.size = buf.length;
      node.updatedAt = Date.now();
      node.ooKey = newDocKey(); // force reload next time
      const editor = body.users && body.users.length ? body.users.join(', ') : '协作者';
      logActivity(nodeId, null, 'saved', `${editor} 保存了新版本`);
      save();
    }
    return { error: 0 };
  }
  return { error: 0 };
}

function verifyJwt(payload, secret) {
  return jwt.verify(payload, secret);
}

module.exports = { buildEditorConfig, handleCallback, documentType, isEditable, newDocKey, JWT_SECRET, DOC_SERVER_URL, STORAGE_DIR };
