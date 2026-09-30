/* comp-guba.js —— 「股吧」页（`guba.html`）的渲染（2026-09-28 新建）
 *
 * 数据：`site/data/guba.js`（→ `window.GUBA`），由 `pipeline/tools/export_guba.py` 生成。
 *      **长线读数**另有 `site/data/longview.js`（→ `window.LONGVIEW`），由
 *      `pipeline/tools/export_longview.py` 从行情库算出（0 请求）。
 * ★★★ 2026-10-21：**每天分成短线／长线两段**（用户：「这是两个完全不一样的行情」，
 *   四字也变成两个）。老数据没有新字段 → `renderOne()` 回退成改版前的单段渲染。
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
        (o.sn ? '<span class="k src">' + esc(o.sn) + '</span>' : '') +
        '<span class="k">' + esc(o.a) + '</span>' +
        '<span class="k">阅 ' + (o.v || 0) + '</span>' +
        '<span class="k">评 ' + (o.r || 0) + '</span>' +
        '<span class="k">' + esc(o.tm) + '</span>' +
        '<a class="k" href="' + esc(o.u) + '" target="_blank" rel="noopener">原帖 ↗</a>' +
      '</div>' +
      '<div class="sn">' + (noBody ? '（这条没有正文，不计入依据）'
                                    : md(o.s)) + '</div>' +
      '</div>';
  }

  /* ── 2026-10-21：**长短线两段**（用户：「你的股吧页面也要分成长短线来讲，这是两个完全
     不一样的行情，四字评价也拓展成两个四字」）。
     · 老数据（只有 `summary`/`points`）→ 走 `renderOne()`，**和改版前一模一样**（不能白屏）；
     · 新数据（有 `tag_s`/`sum_s`/`pts_s` 或长线那三列）→ 走 `renderDuo()`，两段并列，
       四字**同等醒目**、只有颜色分（短线红／长线蓝）。
     ⚠ 长线那一段上面那行读数来自 `window.LONGVIEW`（`pipeline/tools/export_longview.py`
       用行情库算的**真实数字**）—— 不是 AI 写的，也不许在这里重算。 */

  function pointList(pts) {
    var h = ['<div class="pts">'];
    (pts || []).forEach(function (p) {
      h.push('<div class="p"><div class="k">' + md(p.k) + '</div><div class="v">' +
        md(p.v) + '</div></div>');
    });
    h.push('</div>');
    return h.join('');
  }

  /* 一段（短线或长线）：标签 ＋ **一句话** ＋ 综述 ＋ 要点
     ★ 2026-10-21 晚（用户：「**算了，你的四个字概括的完全很有限，用一句话吧**」）：
       那一格从「四字印章」改成**一句话** —— 元素换成 `.tline`（正文 13.5px、正常行高、
       不是 700），**不复用 `.t4`／`.tag` 那套大字**；短线红系、长线蓝系，字号等同。 */
  function seg(cls, label, tag, sum, pts) {
    if (!tag && !sum && !(pts || []).length) return '';
    var h = ['<div class="sum ' + cls + '">',
      '<div class="sgh"><i class="pl ' + cls + '">' + label + '</i>' +
      (tag ? '<span class="tline ' + cls + '">' + md(tag) + '</span>' : '') + '</div>'];
    if (sum) h.push('<div class="body">' + md(sum) + '</div>');
    if ((pts || []).length) h.push(pointList(pts));
    h.push('</div>');
    return h.join('');
  }

  /* 长线的**客观读数**一行（`window.LONGVIEW.days[日期]`）——12px 灰、数字等宽、紧凑。
     ⚠ 缺数据（null）就显示「—」，**不要填 0**（`export_longview.py` 那边也是 null）。 */
  function readout(day) {
    var all = (window.LONGVIEW || {}).days || {};
    var o = all[day];
    if (!o) return '';
    var sh = o.sh || {}, tn = o.turn || {}, mi = o.micro || {};
    function b(v) { return v == null ? '—' : (v ? '上' : '下'); }
    function pct(v) { return v == null ? '—' : ((v > 0 ? '+' : '') + v + '%'); }
    var amt = '—';
    if (tn.e != null) {
      amt = tn.e >= 10000 ? ((tn.e / 10000).toFixed(2) + ' 万亿') : (Math.round(tn.e) + ' 亿');
    }
    var w = [
      '上证 ' + (sh.c == null ? '—' : Math.round(sh.c)) +
        '（MA20 ' + b(sh.ma20) + ' / MA60 ' + b(sh.ma60) + ' / MA120 ' + b(sh.ma120) + '）',
      '60日位置 ' + (sh.pos60 == null ? '—' : sh.pos60 + '%'),
      '距250日高点 ' + pct(sh.dd250),
      '成交 ' + amt + '（20日均 ' + (tn.ratio20 == null ? '—' : tn.ratio20.toFixed(2)) + ' 倍）',
      '微盘 ' + (mi.c == null ? '—' : Math.round(mi.c)) + '（20日 ' + pct(mi.chg20) + '）'
    ];
    return '<div class="lview">' + w.join(' · ') + '</div>';
  }

  /* 老数据那一段：**原样保留**（改版前的单段渲染，老数据必须照样能看） */
  function renderOne(day) {
    var h = ['<div class="sum"><h3>今日复盘整合</h3><div class="body">' +
      md(day.summary) + '</div>'];
    if ((day.points || []).length) h.push(pointList(day.points));
    h.push('</div>');
    return h.join('');
  }

  function renderDuo(day) {
    /* ⚠ 读数按**日期键**取（`window.LONGVIEW.days['2026-10-21']`），不是按 day 对象 ——
       这里用模块级的 `cur`（＝当前选中日）。 */
    return seg('s', '短线', day.tag_s, day.sum_s, day.pts_s) +
      readout(cur) +
      seg('l', '长线', day.tag_l, day.sum_l, day.pts_l);
  }

  function hasDuo(day) {
    return !!(day.tag_s || day.tag_l || day.sum_s || day.sum_l ||
              (day.pts_s || []).length || (day.pts_l || []).length);
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
      ? (hasDuo(day)
        ? ('短线 ' + (day.sum_s || '').length + ' 字 ｜ 长线 ' + (day.sum_l || '').length +
           ' 字 ｜ 依据 ' + (day.src_n || 0) + ' 篇帖子')
        : ('总结 ' + (day.summary || '').length + ' 字 ｜ ' + (day.points || []).length +
           ' 条要点 ｜ 依据 ' + (day.src_n || 0) + ' 篇帖子'))
      : '—';

    var v = document.getElementById('view');
    if (!day) {
      v.innerHTML = '<div class="empty">还没有股吧总结 —— 先 <code>python pipeline\\ingest_tgb.py ' +
        '--date &lt;交易日&gt;</code> 取当天的收盘总结帖，读了正文再 ' +
        '<code>python pipeline\\guba_note.py --add note.json</code>，' +
        '最后 <code>python pipeline\\tools\\export_guba.py</code>。</div>';
      return;
    }
    var h = [hasDuo(day) ? renderDuo(day) : renderOne(day)];
    h.push('<div class="bar">引用的帖子（' + (day.posts || []).length + ' 篇）</div>');
    (day.posts || []).forEach(function (o) { h.push(post(o)); });
    /* ★★★ 2026-10-12（用户：「**所有页面一堆灰色小字都删掉，特别碍事**」）——
       这里原来还推一行 `rule.note`（"取数＝脚本抓…总结＝AI 读正文后写的…"）**整段说明**，
       现在**不渲染了**。⚠ 数据侧（`export_guba.py` 发的 `rule.note`）**照旧保留**，
       想恢复就把这一行加回来 —— **别去删数据**（说明留在数据里备查）。 */
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
