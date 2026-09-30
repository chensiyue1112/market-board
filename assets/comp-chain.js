/* comp-chain.js —— 「消息」页（`news.html`）的渲染
 *
 * 数据：`site/data/chain.js`（→ `window.CHAIN`），由 `pipeline/tools/export_chain.py` 生成。
 * ⚠ **分组、★ 置顶、排序全在导出那一层做完**，这里只管画（本项目既有做法：页面不重算）。
 * ⚠ 这个模块原来长在 `box.html` 的 `#chainModal` 里，2026-09-27 用户定"**完整替代外围宏观、
 *   改名为消息**" —— 于是原样搬成顶层页，渲染逻辑几乎没动。
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

  /* 一条消息：标题（★）＋ 元信息（日期 / 类型 / 来源 / 原文链接）＋ 传导机制 */
  function item(o) {
    return '<div class="it"><div class="tt">' + (o.z ? '<span class="st">★</span>' : '') +
      md(o.t) + '</div><div class="mt">' +
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
    if (w && RULE.warn) w.textContent = RULE.warn;
    document.getElementById('cnt').textContent =
      (D.n || 0) + ' 条 ｜ ' + (D.m || 0) + ' 条链' + (top.length ? ' ｜ ★ ' + top.length + ' 条置顶' : '');

    if (!D.n) {
      document.getElementById('view').innerHTML = '<div class="empty">还没有传导链消息 —— ' +
        'AI 读一遍 <code>news_wire</code>、筛出会传到 A 股的那些，再 ' +
        '<code>python pipeline\\news_chain.py --add chain.json</code> 写入，' +
        '然后跑 <code>python pipeline\\tools\\export_chain.py</code>。</div>';
      return;
    }
    var h = [];
    if (top.length) {
      h.push('<div class="bar">★ 今天最该先看的</div>');
      top.forEach(function (o) { h.push('<div class="star">' + item(o) + '</div>'); });
      h.push('<div class="bar">按传导链看全部</div>');
    }
    gs.forEach(function (g) {
      h.push('<div class="cn"><h3>' + esc(g.c) + '<span class="n"> · ' +
        g.items.length + ' 条</span></h3>');
      g.items.forEach(function (o) { h.push(item(o)); });
      h.push('</div>');
    });
    document.getElementById('view').innerHTML = h.join('');
  }
  render();
})();
