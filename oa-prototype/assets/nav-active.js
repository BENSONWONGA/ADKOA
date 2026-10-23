/* ============ 导航激活 + 侧边栏身份注入（唯一激活机制：body[data-page]） ============ */
(function () {
  var page = document.body && document.body.getAttribute('data-page');
  if (page) {
    var items = document.querySelectorAll('.nav-item[data-nav]');
    for (var i = 0; i < items.length; i++) {
      if (items[i].getAttribute('data-nav') === page) items[i].classList.add('active');
    }
  }
  /* 侧边栏用户信息（数据源：mock.js 的 DB.currentUser） */
  if (window.DB && DB.currentUser) {
    var av = document.getElementById('nav-avatar');
    var nm = document.getElementById('nav-name');
    var dp = document.getElementById('nav-dept');
    if (av) av.textContent = DB.currentUser.name.charAt(0);
    if (nm) nm.textContent = DB.currentUser.name;
    if (dp) dp.textContent = DB.currentUser.dept + ' · ' + DB.currentUser.pos;
  }
  /* 移动端侧边栏开关（悬浮按钮由 ui.js 注入） */
  var toggle = document.getElementById('nav-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    document.querySelector('.app-nav').classList.toggle('open');
  });
})();