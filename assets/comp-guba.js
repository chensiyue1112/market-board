/* comp-guba.js —— 「股吧」页（`guba.html`）的渲染（2026-09-28 新建）
 *
 * 数据：`site/data/guba.js`（→ `window.GUBA`），由 `pipeline/tools/export_guba.py` 生成。
 * ⚠ **排序与摘要全在导出那一层做完**，这里只管画（本项目既有做法：页面不重算）。
 * ⚠ 本页呈现的是**一群人的复盘**（共识与分歧），不是本系统的判断；引用可点开原帖。
 */
(function () {
  var D = window.GUBA || {};
  var RULE = D.rule || {};
  var DATES = D.dates || [];
  var cur = (D.date && DATES.indexOf(D.date) >= 0) ? D.date : (DATES[0] || null);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  /* ⚠ 总结与要点里可能带 Markdown 的 `**加粗**`（AI 落库时写的），页面是纯 HTML →
     不还原就会**原样显示成两个星号**。`check_page.js` 有一条常驻断言专抓这个。
     ⚠ **必须在 esc() 之后**再还原标签 —— 顺序反了就是 XSS。
     ⚠⚠ 末尾那两句**收尾**不能省：断言查的是"渲染文本里出现 `**` 或 `~~`"，
       而**源内容里本来就可能带** —— 实测 2026-09-28 就被拦下来了：帖子里一句
       「么么哒~~~」的**三个波浪号**命中了 `~~`。**不配对/装饰性的记号一律降到单字符**。 */
  function md(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/\*{2,}/g, '')
      .replace(/~{2,}/g, '～');
  }

  function post(o) {
    var noBody = !o.s;
    return '<div class="post' + (noBody ? ' nobody' : '') + '">' +
      '<div class="tt"><a href="' + esc(o.u) + '" target="_blank" rel="noopener">' +
        esc(o.t) + '</a></div>' +
      '<div class="mt">' +
        '<span class="k">' + esc(o.a) + '</span>' +
        '<span class="k">阅 ' + (o.v || 0) + '</span>' +
        '<span class="k">评 ' + (o.r || 0) + '</span>' +
        '<span class="k">' + esc(o.tm) + '</span>' +
        '<a class="k" href="' + esc(o.u) + '" target="_blank" rel="noopener">原帖 ↗</a>' +
      '</div>' +
      '<div class="sn">' + (noBody ? '（这条没有正文 —— 淘股吧不少复盘是纯图片帖）'
                                    : md(o.s)) + '</div>' +
      '</div>';
  }

  function render() {
    var day = (cur && D.days) ? D.days[cur] : null;
    document.getElementById('dday').textContent = cur || '—';
    /* ⚠ 2026-09-28：这里原来会把 `rule.warn`（"⚠ 这里是一群人的复盘…不是本系统的判断…"）
       渲染进 `#warn` —— 用户当天说「**这个别显示**」→ **整条去掉**：
       导出侧（`export_guba.py`）不再发 `warn`、`guba.html` 里那个 `#warn` 容器也删了。
       所以这一段**不要再加回来**。 */

    /* 日期控件（日历） */
    var sel = document.getElementById('dsel'), i = DATES.indexOf(cur);
    if (sel) {
      sel.innerHTML = DATES.map(function (d) { return '<option value="' + d + '"' +
        (d === cur ? ' selected' : '') + '>' + d + '</option>'; }).join('');
      sel.disabled = !DATES.length;
    }
    var prev = document.getElementById('prev'), next = document.getElementById('next');
    /* ⚠ 日期轴是**倒序**（新 → 旧），所以"前一天"＝数组里下标 +1 */
    if (prev) prev.disabled = (i < 0 || i >= DATES.length - 1);
    if (next) next.disabled = (i <= 0);
    var pos = document.getElementById('pos');
    if (pos) pos.textContent = (i >= 0 && DATES.length)
      ? ('第 ' + (i + 1) + ' / ' + DATES.length + ' 天') : '';

    var cnt = document.getElementById('cnt');
    if (cnt) cnt.textContent = day
      ? ('总结 ' + (day.summary || '').length + ' 字 ｜ ' + (day.points || []).length +
         ' 条要点 ｜ 依据 ' + (day.src_n || 0) + ' 篇帖子')
      : '—';

    var v = document.getElementById('view');
    if (!day) {
      v.innerHTML = '<div class="empty">还没有股吧总结 —— 先 <code>python pipeline\\ingest_tgb.py ' +
        '--date &lt;交易日&gt;</code> 取当天的收盘总结帖，读了正文再 ' +
        '<code>python pipeline\\guba_note.py --add note.json</code>，' +
        '最后 <code>python pipeline\\tools\\export_guba.py</code>。</div>';
      return;
    }
    var h = ['<div class="sum"><h3>今日复盘整合</h3><div class="body">' +
      md(day.summary) + '</div>'];
    if ((day.points || []).length) {
      h.push('<div class="pts">');
      day.points.forEach(function (p) {
        h.push('<div class="p"><div class="k">' + md(p.k) + '</div><div class="v">' +
          md(p.v) + '</div></div>');
      });
      h.push('</div>');
    }
    h.push('</div>');
    h.push('<div class="bar">引用的帖子（' + (day.posts || []).length + ' 篇，按阅读降序 · 点标题可跳原帖）</div>');
    (day.posts || []).forEach(function (o) { h.push(post(o)); });
    h.push('<div class="bar" style="font-weight:400;color:#6b7280">' + md(RULE.note || '') + '</div>');
    v.innerHTML = h.join('');
  }

  document.getElementById('dsel').addEventListener('change', function (e) {
    cur = e.target.value; render();
  });
  document.getElementById('prev').addEventListener('click', function () {
    var i = DATES.indexOf(cur);
    if (i >= 0 && i < DATES.length - 1) { cur = DATES[i + 1]; render(); }
  });
  document.getElementById('next').addEventListener('click', function () {
    var i = DATES.indexOf(cur);
    if (i > 0) { cur = DATES[i - 1]; render(); }
  });
  document.getElementById('latest').addEventListener('click', function () {
    cur = DATES[0] || null; render();
  });

  render();
})();
