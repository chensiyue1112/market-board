/* comp-boxsig.js —— **板块级信号**两个页面共用（超卖·恐慌底 ／ 跟随·温和回调+连板）
 *
 * 数据：`site/data/boxos.js`（→ `window.BOXOS`）／ `site/data/boxfol.js`（→ `window.BOXFOL`）
 * ⚠ **两个页面的 HTML/CSS/JS 一字不差** —— 差别只有页面在加载本文件前给的那个
 *   `window.BOXCFG`（读哪个数据源）。圈的颜色也由数据侧发（`rule.color`）：
 *   **超卖＝绿圈、跟随＝红圈**（用户 2026-09-27：「折线图用红圈替代，区分超卖」）。
 *
 * 三级结构（2026-09-27 用户：「大类（一级）信号条件」）：
 *   一级 **★ 信号就在这一层**：当天在候选清单里的大类 ＋ 它的 20 日涨幅
 *   二级 **明细、不筛**：该大类下每个小类的 20 日涨幅（同一个等权口径）
 *   三级 **明细、不筛**：该小类下的 ETF ＋ 折线图（信号日打圈）
 * ⚠ 二级/三级都**只是明细** —— 报告里「候选清单＝当天所有超跌**板块**」，颗粒度就是**大类**；
 *   拿小类/ETF 自己的 20 日涨幅再筛一遍是**外推**，报告没验过，所以只显示、不筛。
 */
(function () {
  var CFG = window.BOXCFG || {};
  var B = window[CFG.src || 'BOXOS'] || {};
  var RULE = B.rule || {};
  var DOT = RULE.color || '#0ca30c';                 /* 折线圆点的颜色：超卖绿 / 跟随红 */
  var TREE = B.tree || [], FLAT = B.flat || [], DAYS = B.days || {};
  var AXIS = B.axis || [], SER = B.series || {}, MOM = B.mom || {}, PCT = B.pct || {};
  var SIG = B.sig || {};                             /* {大类: [轴下标, …]} 信号日 */
  var DATES = ((B.all_dates && B.all_dates.length) ? B.all_dates : []).slice();
  /* ★★ 2026-09-27 晚（用户）：「**超卖和跟随都只保留有产出的日期，其他没有的日期不用显示了，
     我指的是页面上一天下一天那样，那样也就不用一个点来表示有数据。**」
     → `all_dates` **只含有产出的交易日**（导出侧保证），所以：
       · 下拉 / 前一天 / 后一天 / 最新 **全在有产出的日子之间跳**；
       · 那个"●＝这天有动作"的标记**不再需要**（翻到的每一天都有产出）。 */

  var IDX = {}, NAME = {}, BIGOF = {};
  TREE.forEach(function (b) { b.subs.forEach(function (s) { s.etfs.forEach(function (e) {
    NAME[e[0]] = e[1]; BIGOF[e[0]] = b.big; }); }); });
  FLAT.forEach(function (x, i) { IDX[x] = i; });
  var BIGS = TREE.map(function (b) { return b.big; });

  var CUR = B.date, BIG = null, SMALL = null, ROWS = [], PICKED = {}, EXP = {};
  var CHART = null, BEST = null, COLOR = {};
  /* 折线的分类色：**不用 ECharts 自带调色板**（第 2/3 色太浅、白底看不清）——
     用校验过的那套参考色，固定顺序取；1 号槽 `#2a78d6` 正是本项目在用的蓝。 */
  var PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  var WIN0 = 30, LADDER = [10, 30, 100, 250], WIN = WIN0, REND = 0;

  function qa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pctTxt(p) { return p == null ? '—' : ((p > 0 ? '+' : '') + p.toFixed(2) + '%'); }
  function pctCls(p) { return p == null ? '' : (p > 0 ? 'ok' : 'bad'); }
  function momTxt(m) { return m == null ? '—' : ((m > 0 ? '+' : '') + (m * 100).toFixed(1) + '%'); }
  function momCls(m) { return m == null ? '' : (m > 0 ? 'ok' : 'bad'); }

  function day() { return DAYS[CUR] || { bigs: [] }; }
  function momBig(d, nm) { return ((MOM[d] || {}).big || {})[nm]; }
  function momSmall(d, nm) { return ((MOM[d] || {}).small || {})[nm]; }
  function pctOf(code) { var i = IDX[code], a = PCT[CUR] || [];
    return i == null ? null : (a[i] === undefined ? null : a[i]); }
  /* ETF 自己的 20 日涨幅（**明细**，不是信号）：从长轴收盘价现算 */
  function etfMom20(code) {
    var s = SER[code] || [], i;
    for (i = s.length - 1; i >= 0; i--) if (s[i] != null) break;
    if (i < 20 || s[i - 20] == null || !s[i - 20]) return null;
    return s[i] / s[i - 20] - 1;
  }

  /* ══ 一级：**信号就在这一层** —— 当天在候选清单里的大类 ══ */
  function renderBig() {
    BIG = null; SMALL = null; ROWS = [];
    document.getElementById('crumb').innerHTML = '';
    var D = day(), bs = (D.bigs || []).slice();
    bs.sort(function (a, b) { return (a[1] == null ? 9 : a[1]) - (b[1] == null ? 9 : b[1]); });
    var h = [];
    if (!bs.length) {
      /* ⚠ 正常**走不到这里** —— 日期轴里只有"有产出"的日子（导出侧保证）。
         留着纯属兜底：万一数据坏了，页面得**说出来**，而不是白屏装没事。 */
      h.push('<div class="card empty">' + esc(CUR) + '　数据里这一天没有候选大类' +
        '（日期轴本该只含有产出的日子 —— 报这个说明数据有问题，重跑 export_box_sig.py）</div>');
    } else {
      h.push('<div class="bar"><b>' + esc(topLine(D)) + '</b></div>');
      bs.forEach(function (r) {
        var b = null, k;
        for (k = 0; k < TREE.length; k++) if (TREE[k].big === r[0]) { b = TREE[k]; break; }
        if (!b) return;
        var nEtf = 0; b.subs.forEach(function (s) { nEtf += s.etfs.length; });
        h.push('<div class="bcard"><div class="row" data-big="' + esc(r[0]) + '">' +
          '<span class="nm">' + esc(r[0]) + '</span>' +
          '<span class="tagline">' + b.subs.length + ' 个小类 · ' + nEtf + ' 只 ETF' +
          (Q_SIG === 'fol' && r[2] ? '　连板抬升 ' + r[2] + ' 个板块' : '') + '</span>' +
          '<span class="pct ' + momCls(r[1]) + '">' + momTxt(r[1]) + '</span>' +
          '<span class="dim">20 日</span></div></div>');
      });
    }
    document.getElementById('view').innerHTML = h.join('');
  }
  function topLine(D) {
    if (Q_SIG === 'os') {
      return '恐慌度 ' + (D.k == null ? 0 : D.k) + '/' + (D.n == null ? 0 : D.n) + ' = ' +
        ((D.share == null ? 0 : D.share * 100).toFixed(1)) + '%（≥ ' +
        (RULE.share * 100).toFixed(0) + '% 触发）　｜　候选 ' + D.bigs.length + ' 个超跌大类';
    }
    return '触发 ' + D.bigs.length + ' 个大类（温和回调 ＋ 连板抬升）';
  }

  /* ══ 二级：该大类下的**全部小类**（明细、不筛），按 20 日涨幅升序 ══ */
  function renderSmall(bigName) {
    BIG = bigName; SMALL = null; ROWS = [];
    var b = null, k;
    for (k = 0; k < TREE.length; k++) if (TREE[k].big === bigName) { b = TREE[k]; break; }
    if (!b) return;
    var arr = b.subs.map(function (s) {
      return { small: s.small, n: s.etfs.length, m: momSmall(CUR, s.small) };
    }).sort(function (x, y) {
      return (x.m == null ? 9 : x.m) - (y.m == null ? 9 : y.m);
    });
    var bm = momBig(CUR, bigName);
    var h = ['<div class="bar"><b>' + esc(bigName) + '</b> <span class="dim">' +
      arr.length + ' 个小类 ｜ 大类 20 日 ' + momTxt(bm) + '（信号层）｜ 下面是**明细**，不筛</span></div>'];
    arr.forEach(function (r) {
      h.push('<div class="bcard"><div class="row" data-small="' + esc(r.small) + '">' +
        '<span class="nm">' + esc(r.small) + '</span>' +
        '<span class="tagline">' + r.n + ' 只 ETF</span>' +
        '<span class="pct ' + momCls(r.m) + '">' + momTxt(r.m) + '</span>' +
        '<span class="dim">20 日</span></div></div>');
    });
    document.getElementById('view').innerHTML = h.join('');
    document.getElementById('crumb').innerHTML =
      '<a data-home="1">全部大类</a> <span>›</span> ' + esc(bigName) + '（小类）';
  }

  /* ══ 三级：该小类下的 ETF ＋ 折线（信号日打圈） ══ */
  function renderEtfs(smallName) {
    var b = null, s = null, k, j;
    for (k = 0; k < TREE.length; k++) if (TREE[k].big === BIG) { b = TREE[k]; break; }
    if (!b) return;
    for (j = 0; j < b.subs.length; j++) if (b.subs[j].small === smallName) { s = b.subs[j]; break; }
    if (!s) return;
    SMALL = smallName;
    ROWS = s.etfs.map(function (e) {
      return { code: e[0], name: e[1], scale: e[2], board: e[3],
               pct: pctOf(e[0]), m20: etfMom20(e[0]) };
    });
    ROWS.sort(function (x, y) {
      var a = x.pct == null ? -1e9 : x.pct, c = y.pct == null ? -1e9 : y.pct; return c - a; });
    BEST = bestCode();
    COLOR = {};
    var n = 0;
    if (BEST != null) { COLOR[BEST] = PALETTE[0]; n = 1; }
    ROWS.forEach(function (r) {
      if (COLOR[r.code]) return;
      COLOR[r.code] = PALETTE[n] || '#6b7280';
      n++;
    });
    anchorWin();
    document.getElementById('view').innerHTML =
      '<div class="bar"><span class="dim">共 ' + ROWS.length + ' 只 ｜ 窗口对准 ' + esc(CUR) +
      ' ｜ 圆圈＝这一天「' + esc(BIG) + '」在信号清单里</span></div>' +
      '<div id="tbl"></div><div id="chart"></div><div class="chartbar" id="cbar"></div>';
    document.getElementById('crumb').innerHTML =
      '<a data-home="1">全部大类</a> <span>›</span> <a data-back="1">' + esc(BIG) +
      '</a> <span>›</span> ' + esc(smallName);
    renderTable();
    if (CHART) { try { CHART.dispose(); } catch (e) {} CHART = null; }
    var el = document.getElementById('chart');
    if (el && window.echarts) CHART = echarts.init(el);
    renderChart();
  }
  function renderTable() {
    var h = ['<table><thead><tr><th>ETF</th><th class="n">当日</th><th class="n">规模</th>' +
      '<th>上市板块</th><th class="n">近30日</th><th class="n">20日</th></tr></thead><tbody>'];
    ROWS.forEach(function (r) {
      var c = cum30(r.code), on = (r.code === BEST) || !!PICKED[r.code];
      h.push('<tr class="' + (on ? 'on' : '') + '" data-row="' + esc(r.code) + '"><td>' +
        '<span class="sw' + (on ? '' : ' off') + '" style="background:' + COLOR[r.code] + '"></span>' +
        '<span class="c">' + esc(r.code) + '</span> ' + esc(r.name) + '</td>' +
        '<td class="n ' + pctCls(r.pct) + '">' + pctTxt(r.pct) + '</td>' +
        '<td class="n dim">' + r.scale + ' 亿</td><td class="dim">' + esc(r.board) + '</td>' +
        '<td class="n dim">' + (c == null ? '—' : pctTxt(c * 100)) + '</td>' +
        '<td class="n ' + momCls(r.m20) + '">' + momTxt(r.m20) + '</td></tr>');
    });
    h.push('</tbody></table>');
    document.getElementById('tbl').innerHTML = h.join('');
  }
  /* 近 30 个交易日累计涨幅（表格那列，也是"默认画谁"的尺）——
     ⚠ **必须显式取轴的最后 30 根**（`WIN0`），别写成"首个非空→末个非空" */
  function cum30(code) {
    var a = (SER[code] || []).slice(-WIN0), v = a.filter(function (x) { return x != null; });
    if (!v.length || !v[0]) return null;
    return v[v.length - 1] / v[0] - 1;
  }
  function bestCode() {
    var w = ROWS.filter(function (r) { return cum30(r.code) != null; });
    if (!w.length) return null;
    var b = w[0];
    w.forEach(function (r) { if (cum30(r.code) > cum30(b.code)) b = r; });
    return b.code;
  }

  /* ══ 折线的日期窗口 ══ */
  function winStart() { return Math.max(0, REND - WIN + 1); }
  function winAxis() { var s = winStart(); return AXIS.slice(s, s + WIN); }
  function firstIdx() {
    var m = AXIS.length;
    ROWS.forEach(function (r) {
      if (r.code !== BEST && !PICKED[r.code]) return;
      var a = SER[r.code] || [], i;
      for (i = 0; i < a.length; i++) if (a[i] != null) { if (i < m) m = i; break; }
    });
    return m;
  }
  function clampRend() {
    var n = AXIS.length;
    REND = Math.min(REND, n - 1);
    REND = Math.max(REND, Math.min(n - 1, firstIdx() + WIN - 1));
  }
  /* ★ 2026-09-27：**点进来就把「我正在看的那一天」摆在窗口正中**（用户：「把确认点尽可能放在中间，
     不然每日我还得手动去寻找这个点的位置」）。锚点＝ `CUR`；能居中就居中，30 天放不下就
     **按需收窄**到刚好装得下（下限＝`LADDER[0]`）；太靠末端（含"就是最新那天"）退回"贴右端"。 */
  function anchorWin() {
    var n = AXIS.length, a = AXIS.indexOf(CUR);
    WIN = WIN0; REND = n - 1;
    if (a < 0) { clampRend(); return; }
    var wc = 2 * Math.min(n - 1 - a, a) + 1;
    if (wc >= WIN0) WIN = WIN0;
    else if (wc >= LADDER[0]) WIN = wc;
    else { clampRend(); return; }
    REND = a + Math.floor(WIN / 2);
    clampRend();
  }
  function zoom(dir) {           /* ⚠ 取"比当前大/小的最近一档"，任何宽度都有下一档 */
    var t = null, k;
    if (dir > 0) { for (k = LADDER.length - 1; k >= 0; k--) if (LADDER[k] < WIN) { t = LADDER[k]; break; } }
    else { for (k = 0; k < LADDER.length; k++) if (LADDER[k] > WIN) { t = LADDER[k]; break; } }
    if (t == null || t > AXIS.length) return;
    WIN = t; clampRend();
  }
  function pan(dir) { REND += dir * Math.max(1, Math.round(WIN / 2)); clampRend(); }
  /* 折线画的是**涨幅（%）**、基点为该 ETF **在图上最早的可用日期**；
     ⚠ 窗口一挪、基点跟着挪 —— 所以线的数值是随窗口重算的。 */
  function pctSeries(code) {
    var s = winStart(), full = SER[code] || [], hi = Math.min(s + WIN, full.length),
        base = null, i, out = [];
    for (i = s; i < hi; i++) if (full[i] != null) { base = full[i]; break; }
    if (!base) return [];
    for (i = s; i < hi; i++) out.push(full[i] == null ? null : (full[i] / base - 1) * 100);
    return out;
  }
  function pctFmt(v) { return (v == null) ? '—' : ((v > 0 ? '+' : '') + v.toFixed(2) + '%'); }
  /* **空心圈**（用户：「折线图用红圈替代」）—— 颜色由数据侧发（超卖绿 / 跟随红），
     位置＝该 ETF 所属**大类**的信号日里、落在当前窗口内的那些。 */
  function marksOf(vals, ax) {
    var s = winStart(), out = [], days = SIG[BIG] || [];
    days.forEach(function (i0) {
      var i = i0 - s;
      if (i < 0 || i >= vals.length) return;
      var v = vals[i]; if (v == null) return;
      out.push({ coord: [ax[i], v], value: '',
                 itemStyle: { color: 'transparent', borderColor: DOT, borderWidth: 2 },
                 symbolSize: 9 });
    });
    return out;
  }
  function renderChart() {
    if (BEST == null) return;
    var ax = winAxis();
    function mkLine(r, dashed) {
      var d = pctSeries(r.code);
      return { name: r.code + ' ' + (NAME[r.code] || ''), type: 'line', showSymbol: false,
               lineStyle: { width: 1.5, color: COLOR[r.code], type: dashed ? 'dashed' : 'solid' },
               itemStyle: { color: COLOR[r.code] }, data: d,
               markPoint: { symbol: 'circle', symbolSize: 9, label: { show: false }, silent: true,
                            data: marksOf(d, ax) } };
    }
    var series = [], bestRow = ROWS.filter(function (r) { return r.code === BEST; })[0];
    if (bestRow) series.push(mkLine(bestRow, false));
    ROWS.forEach(function (r) {
      if (r.code === BEST || !PICKED[r.code]) return;
      if (!pctSeries(r.code).length) return;
      series.push(mkLine(r, true));
    });
    if (!series.length) return;
    if (CHART) CHART.setOption({
      animation: false,                    /* 点了马上出现，不要"慢慢画出来"那套 */
      grid: { left: 60, right: 16, top: 26, bottom: 44 },
      tooltip: { trigger: 'axis', valueFormatter: pctFmt },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      xAxis: { type: 'category', data: winAxis(), axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 11, formatter: '{value}%' } },
      series: series }, true);
    renderBtns();
  }
  function renderBtns() {
    var n = AXIS.length,
        canIn = WIN > LADDER[0], canOut = WIN < Math.min(LADDER[LADDER.length - 1], n),
        canL = winStart() > firstIdx(), canR = REND < n - 1;
    function b(a, v, s, ok) { return '<button ' + a + '="' + v + '"' + (ok ? '' : ' disabled') + '>' + s + '</button>'; }
    var el = document.getElementById('cbar'); if (!el) return;
    el.innerHTML = b('data-zoom', 'in', '+', canIn) + b('data-zoom', 'out', '−', canOut) +
                   b('data-pan', 'left', '←', canL) + b('data-pan', 'right', '→', canR);
  }

  /* ⚠ 交互**一律走文档级事件委托**（逐元素 onclick 校验器看不见，等于把"点了没反应"放行） */
  document.addEventListener('click', function (ev) {
    var t = ev.target, n;
    if (!t || !t.closest) return;
    if ((n = t.closest('[data-day]'))) { setDay(n.getAttribute('data-day')); return; }
    if ((n = t.closest('[data-zoom]'))) { zoom(n.getAttribute('data-zoom') === 'in' ? 1 : -1); renderChart(); return; }
    if ((n = t.closest('[data-pan]'))) { pan(n.getAttribute('data-pan') === 'left' ? -1 : 1); renderChart(); return; }
    if ((n = t.closest('[data-row]'))) { var c = n.getAttribute('data-row'); PICKED[c] = !PICKED[c]; renderTable(); renderChart(); return; }
    if (t.closest('[data-back]')) { renderSmall(BIG); return; }
    if (t.closest('[data-home]')) { renderBig(); return; }
    if ((n = t.closest('[data-small]'))) { renderEtfs(n.getAttribute('data-small')); return; }
    if ((n = t.closest('[data-big]'))) { renderSmall(n.getAttribute('data-big')); return; }
  });
  function dayInfo() {
    var D = day(), nb = (D.bigs || []).length;
    var txt = (Q_SIG === 'os')
      ? ('恐慌度 ' + (D.k == null ? 0 : D.k) + '/' + (D.n == null ? 0 : D.n) + ' = ' +
         ((D.share == null ? 0 : D.share * 100).toFixed(1)) + '%')
      : ('温和回调区 ' + (D.pull == null ? 0 : D.pull) + ' 个大类');
    /* ⚠ 开头**必须是那一天本身** —— `check_page.js` 的「切日」断言就是靠这个判"导航条真的换了那天" */
    document.getElementById('dinfo').textContent = DATES.length
      ? (CUR + '　｜　' + txt + '　｜　触发 ' + nb + ' 个大类'
         + '　｜　第 ' + (DATES.indexOf(CUR) + 1) + '/' + DATES.length + ' 个有产出的交易日') : '';
  }
  function setDay(d) {
    CUR = d; EXP = {}; PICKED = {};
    document.getElementById('sel').value = d; dayInfo(); renderBig();
  }
  function init() {
    /* ⚠ 页头**两个日期要分开**：`data_date`＝库里最新交易日（"数据到哪天"），
       `date`＝最近一个**有产出**的日子。日期轴只含有产出的日子，两者常常不是同一天
       （例如超卖页数据到 2026-09-24、最近有产出是 2026-08-03）—— 混成一个就会写成
       "数据日 2026-08-03"，看着像数据没更新。 */
    document.getElementById('dday').textContent = B.data_date || B.date || '—';
    var _ls = document.getElementById('lsig');
    if (_ls) {
      _ls.textContent = (B.date && B.date !== B.data_date)
        ? ('　｜　最近有产出 ' + B.date) : '';
    }
    var c = document.getElementById('crit');
    if (c && RULE.note) c.textContent = '　｜　' + RULE.note;
    var w = document.getElementById('warn');
    if (w && RULE.warn) w.textContent = RULE.warn;
    if (!DATES.length) {
      document.getElementById('view').innerHTML = '<div class="empty">没有交易日数据</div>';
      return;
    }
    if (DATES.indexOf(CUR) < 0) CUR = DATES[DATES.length - 1];
    document.getElementById('sel').innerHTML = DATES.map(function (d) {
      return '<option value="' + d + '">' + d + '</option>'; }).join('');
    document.getElementById('sel').onchange = function () { setDay(this.value); };
    document.getElementById('prev').onclick = function () {
      var i = DATES.indexOf(CUR); if (i > 0) setDay(DATES[i - 1]); };
    document.getElementById('next').onclick = function () {
      var i = DATES.indexOf(CUR); if (i >= 0 && i < DATES.length - 1) setDay(DATES[i + 1]); };
    document.getElementById('last').onclick = function () { setDay(DATES[DATES.length - 1]); };
    setDay(CUR);
  }
  var Q_SIG = RULE.strategy || 'os';
  init();
})();
