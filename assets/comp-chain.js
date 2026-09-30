/* comp-chain.js —— 「消息」页（`news.html`）的渲染
 *
 * 数据：`site/data/chain.js`（→ `window.CHAIN`），由 `pipeline/tools/export_chain.py` 生成。
 * ⚠ **分组、排序、重要性筛选全在导出那一层做完**，这里只管画（本项目既有做法：页面不重算）。
 * ⚠ 这个模块原来长在 `box.html` 的 `#chainModal` 里，2026-09-27 用户定"**完整替代外围宏观、
 *   改名为消息**" —— 于是原样搬成顶层页。
 *
 * ★★ 2026-10-12 改版（用户：「**消息面做成点击展开的，一次只展开一个板块的，
 *   日期从最新到旧排序，只要重要的，不重要的别展示了**」）：
 *   · 每个**传导链**是一行，**点击展开**；**一次只开一个**（点开新的会自动收起上一个）；
 *   · 默认展开**排在最前面**的那条链（= 最新日期的那条，排序由导出侧保证）；
 *   · 条数/最新日期写在标题行上，收起时也能一眼看出"这条链最近有没有东西"；
 *   · `z` ＝ **0/1/2 三档**：1＝重要（★）、2＝特别重要（★★）。**0 的根本不会发过来**；
 *   · ⚠ **默认全部收起**（用户 2026-10-12：「不点击就别展开」）—— 只有点过才展开。
 */
(function () {
  var D = window.CHAIN || {};
  var RULE = D.rule || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  /* ⚠⚠ **`chain_news` 的 `title`/`detail` 当初是按 Markdown 写的**（AI 落库时写的），
     页面是纯 HTML → `**xx**` 会**原样显示成两个星号**。`check_page.js` 有一条常驻断言
     专抓这个（"无 Markdown 记号残留"），2026-09-27 搬这个模块时**真被它拦下来了** ——
     原来这段逻辑长在 `box.html` 里（`md()`），搬过来时漏了。
     ⚠ **必须在 `esc()` 之后**再还原标签 —— 顺序反了就是 XSS。 */
  function md(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/~~([^~]+)~~/g, '<s>$1</s>');
  }

  /* 一条消息：重要性标记（★/★★）＋ 标题 ＋ 元信息（日期 / 类型 / 来源 / 原文链接）＋ 传导机制 */
  function item(o) {
    var mark = o.z >= 2 ? '<span class="st s2">★★</span>'
             : (o.z >= 1 ? '<span class="st">★</span>' : '');
    return '<div class="it"><div class="tt">' + mark + md(o.t) + '</div><div class="mt">' +
      '<span class="k">' + esc(o.d) + '</span>' +
      (o.k ? '<span class="k">' + esc(o.k) + '</span>' : '') +
      (o.s ? '<span class="k">' + esc(o.s) + '</span>' : '') +
      (o.u ? '<a class="k" href="' + esc(o.u) + '" target="_blank" rel="noopener">原文</a>'
           : '<span class="k">（无原文链接）</span>') +
      '</div>' + (o.x ? '<div class="xt">传导：' + md(o.x) + '</div>' : '') + '</div>';
  }

  function render() {
    var top = D.top || [], gs = D.groups || [];
    document.getElementById('dday').textContent = D.date || '—';
    var c = document.getElementById('crit');
    if (c && RULE.note) c.textContent = '　｜　' + RULE.note;
    var w = document.getElementById('warn');
    /* ⚠ `rule.warn` 是**纯文本**直出（不走 `md()`）→ 导出侧那行**不许写 `**`** */
    if (w && RULE.warn) w.textContent = RULE.warn;
    document.getElementById('cnt').textContent =
      (D.n || 0) + ' 条 ｜ ' + (D.m || 0) + ' 条链';

    if (!D.n) {
      document.getElementById('view').innerHTML = '<div class="empty">还没有传导链消息 —— ' +
        'AI 读一遍 <code>news_wire</code>、筛出会传到 A 股的那些，再 ' +
        '<code>python pipeline\\news_chain.py --add chain.json</code> 写入，' +
        '然后跑 <code>python pipeline\\tools\\export_chain.py</code>。</div>';
      return;
    }
    var h = [];
    if (top.length) {
      h.push('<div class="bar">今天最该先看的</div>');
      top.forEach(function (o) { h.push('<div class="star">' + item(o) + '</div>'); });
    }
    h.push('<div class="bar">按传导链看（点标题展开，一次开一个）</div>');
    gs.forEach(function (g, i) {
      /* ★★ 2026-10-12（用户：「**不是说弄成点击再展开吗，不点击就别展开**」）——
         **默认全部收起**，不点就一个都不展开。
         ⚠ 我第一版自作主张"默认展开第一条"，被用户否了 —— **别再改回去**：
           "点击展开"这个说法的重点就是**未点击时是收起状态**。 */
      h.push('<div class="cn">' +
        '<h3 class="cnh" role="button" tabindex="0" aria-expanded="false">' +
        '<span class="cnn">' + esc(g.c) + '</span>' +
        '<span class="n">' + g.items.length + ' 条 · 最新 ' + esc(String(g.d || '').slice(5)) +
        '</span><i class="cv">▾</i></h3><div class="cnb">');
      g.items.forEach(function (o) { h.push(item(o)); });
      h.push('</div></div>');
    });
    var host = document.getElementById('view');
    host.innerHTML = h.join('');

    /* 手风琴：**一次只开一个** —— 点开的那个展开、其余全部收起。
       ⚠⚠ 用 `document.querySelectorAll` 而**不是 `host.querySelectorAll`**（2026-10-12 实测）：
         `check_page.js` 的 stub DOM **只实现了 `document.querySelectorAll`**，元素级的没有 →
         写 `host.querySelectorAll` 会当场 `is not a function`，页面校验直接报错。
         `document.querySelectorAll('.cn')` 在 stub 下返回**空数组**（它只认 `button`），
         所以这段在 stub 里**自然什么都不做**，浏览器里照常工作。 */
    var all = (typeof document.querySelectorAll === 'function')
      ? document.querySelectorAll('.cn') : [];
    function closeAll(except) {
      for (var i = 0; i < all.length; i++) {
        if (all[i] === except) continue;
        all[i].className = 'cn';
        var hh = all[i].querySelector('.cnh');
        if (hh) hh.setAttribute('aria-expanded', 'false');
      }
    }
    for (var i = 0; i < all.length; i++) {
      (function (box) {
        /* ⚠ 元素级 `querySelector` 同样只在**真的有 .cn 元素**时才会走到
           （stub 下 `all` 是空数组，这段根本不执行） */
        if (typeof box.querySelector !== 'function') return;
        var head = box.querySelector('.cnh');
        if (!head) return;
        function toggle() {
          var isOpen = box.className.indexOf('open') >= 0;
          if (isOpen) {
            box.className = 'cn';
            head.setAttribute('aria-expanded', 'false');
          } else {
            closeAll(box);
            box.className = 'cn open';
            head.setAttribute('aria-expanded', 'true');
          }
        }
        head.addEventListener('click', toggle);
        head.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      })(all[i]);
    }
  }
  render();
})();
