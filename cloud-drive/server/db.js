// Simple JSON file database with in-memory cache
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const uid = () => crypto.randomBytes(8).toString('hex');

function seed() {
  const rootId = uid();
  return {
    users: [
      { id: uid(), name: '张伟', color: '#4f7cff', createdAt: Date.now() },
      { id: uid(), name: '李娜', color: '#f2994a', createdAt: Date.now() },
      { id: uid(), name: '王强', color: '#27ae60', createdAt: Date.now() }
    ],
    nodes: {
      [rootId]: { id: rootId, name: '我的网盘', type: 'folder', parentId: null, ownerId: null, createdAt: Date.now(), updatedAt: Date.now() }
    },
    shares: [],
    activities: [],
    meta: { rootId }
  };
}

let db = null;
let saveTimer = null;

function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    db = seed();
    persist();
  }
  return db;
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 50);
}

// ---- helpers ----
function getUserByName(name) {
  const d = load();
  return d.users.find(u => u.name === name);
}

function ensureUser(name) {
  const d = load();
  let u = getUserByName(name);
  if (!u) {
    const colors = ['#4f7cff', '#f2994a', '#27ae60', '#9b51e0', '#eb5757', '#2d9cdb'];
    u = { id: uid(), name, color: colors[d.users.length % colors.length], createdAt: Date.now() };
    d.users.push(u);
    save();
  }
  return u;
}

function childrenOf(parentId) {
  const d = load();
  return Object.values(d.nodes).filter(n => n.parentId === parentId);
}

function pathOf(nodeId) {
  const d = load();
  const parts = [];
  let cur = d.nodes[nodeId];
  while (cur && cur.parentId) {
    parts.unshift(cur.name);
    cur = d.nodes[cur.parentId];
  }
  return '/' + parts.join('/');
}

function isDescendant(nodeId, maybeAncestorId) {
  const d = load();
  let cur = d.nodes[nodeId];
  while (cur && cur.parentId) {
    if (cur.parentId === maybeAncestorId) return true;
    cur = d.nodes[cur.parentId];
  }
  return false;
}

function logActivity(nodeId, userId, action, detail) {
  const d = load();
  d.activities.unshift({ id: uid(), nodeId, userId, action, detail: detail || '', ts: Date.now() });
  if (d.activities.length > 500) d.activities.length = 500;
  save();
}

module.exports = { load, save, uid, ensureUser, getUserByName, childrenOf, pathOf, isDescendant, logActivity };
