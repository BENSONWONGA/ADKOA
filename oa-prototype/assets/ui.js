/* ============ UI 共享工具：toast / modal / 移动端导航开关 ============ */
(function (global) {
  var U = {};

  U.toast = function (msg, type) {
    type = type || 'info';
    var holder = document.querySelector('.toast-holder');
    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'toast-holder';
      document.body.appendChild(holder);
    }
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<span class="dot"></span><span>' + msg + '</span>';
    holder.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 320); }, 2400);
  };

  U.modal = function (title, bodyHtml, footerHtml) {
    U.closeModal();
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><span>' + title + '</span><button class="btn btn-ghost btn-sm" data-mc>x</button></div>' +
      '<div class="modal-b">' + bodyHtml + '</div>' +
      (footerHtml ? '<div class="modal-f">' + footerHtml + '</div>' : '') +
      '</div>';
    mask.addEventListener('click', function (e) { if (e.target === mask || e.target.getAttribute('data-mc')) U.closeModal(); });
    document.body.appendChild(mask);
    return mask;
  };

  U.closeModal = function () {
    var m = document.querySelector('.modal-mask');
    if (m) m.remove();
  };

  /* 移动端导航开关按钮（≤900px 显示）；需待 DOM 就绪后再注入 */
  function injectToggle() {
    if (document.getElementById('nav-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'nav-toggle';
    btn.innerHTML = '<span></span><span></span><span></span>';
    btn.setAttribute('aria-label', '打开导航');
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggle);
  } else {
    injectToggle();
  }

  global.UI = U;
})(window);