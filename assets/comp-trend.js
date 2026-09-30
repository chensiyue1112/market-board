/* comp-trend.js — 趋势研判页（2026-11-14 v2）
   ════════════════════════════════════════════════════════════════════════
   这一版的页面**不列榜**：指数只留今日、主线只留研判过的 ≤3 个、
   影响因素 ≤2 条、长线位置已删除（每日页已有）。
   所有判断在 `pipeline/tools/export_trend.py` 里算完，这里只排版。
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var D = window.TREND || {};

  function T(id) { return document.getElementById(id); }
  function set(id, html) { var el = T(id); if (el) el.innerHTML = html; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sign(v, d) {
    if (v == null || isNaN(v)) return '—';
    var n = Number(v);
    return (n > 0 ? '+' : '') + n.toFixed(d == null ? 2 : d) + '%';
  }
  function cls(v) { return v == null ? 'flat' : (v > 0 ? 'up' : (v < 0 ? 'down' : 'flat')); }

  /* ── 日期 ─────────────────────────────────────────────────────────── */
  set('tDate', esc(D.generated || ''));

  /* ── ① 定性（权重/成长分化 + 量能）────────────────────────────────── */
  (function verdict() {
    var v = (D.verdict || []).slice();
    var amt = D.amount_total_yi ? (D.amount_total_yi / 1e4).toFixed(2) + ' 万亿' : null;
    var b = D.breadth || {};
    var line = '<div class="vline main">' + (v.length ? esc(v[0]) : '—') + '</div>';
    var sub = [];
    if (v.length > 1) sub.push(esc(v[1]));
    sub.push('两市成交 ' + (amt || '—'));
    sub.push('涨停 <b class="up">' + (b.zt | 0) + '</b> · 炸板 <b class="warn">' + (b.zb | 0) +
             '</b> · 跌停 <b class="down">' + (b.dt | 0) + '</b> · 最高 <b>' + (b.max_lbc | 0) + ' 板</b>');
    line += '<div class="vline sub">' + sub.join('　｜　') + '</div>';
    set('tVerdict', line);
  })();

  /* ── ② 指数（今日 only）───────────────────────────────────────────── */
  (function indices() {
    var arr = D.indices || [];
    if (!arr.length) { set('tIdxRows', '<tr><td colspan="3" class="empty">无数据</td></tr>'); return; }
    set('tIdxRows', arr.map(function (x) {
      return '<tr><td class="l"><b>' + esc(x.name) + '</b>' +
        '<span class="grp">' + esc(x.group) + '</span></td>' +
        '<td class="' + cls(x.pct) + '"><b>' + sign(x.pct) + '</b></td>' +
        '<td class="dim">' + (x.amount_share == null ? '—' : x.amount_share.toFixed(1) + '%') + '</td></tr>';
    }).join(''));
  })();

  /* ── ③ 板块归因 ───────────────────────────────────────────────────── */
  function boardLine(arr) {
    if (!arr || !arr.length) return '<span class="dim">—</span>';
    return arr.map(function (b) {
      return '<span class="bchip ' + (b.pct > 0 ? 'up' : 'down') + '">' + esc(b.name) +
        '<i>' + sign(b.pct) + '</i></span>';
    }).join('');
  }
  set('tUpB', boardLine(D.up_boards));
  set('tDnB', boardLine(D.dn_boards));

  /* ── ④ 短线主线 ───────────────────────────────────────────────────── */
  (function mains() {
    var js = D.judgement || '';
    set('tJudge', '<span class="jl">研判</span>' + esc(js).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'));

    var arr = D.mains || [];
    if (!arr.length) { set('tMains', ''); return; }
    var stageCls = { '加速': 'hot', '发酵': 'mid', '新起': 'new', '分歧': 'warn', '退潮': 'cool', '名字炒作': 'pseudo' };
    set('tMains', arr.map(function (m, i) {
      return '<div class="mcard">' +
        '<div class="mh"><span class="midx">' + (i + 1) + '</span>' +
        '<b>' + esc(m.name) + '</b>' +
        '<span class="stag ' + (stageCls[m.stage] || 'gray') + '">' + esc(m.stage) + '</span></div>' +
        (m.pseudo ? '<div class="pnote">同花顺没有这个分类，是按涨停股名字共性归的</div>' : '') +
        '<div class="mmeta"><i>涨停 <b>' + m.zt + '</b></i><i>最高 <b>' + m.high + ' 板</b></i>' +
        '<i>连板 <b>' + m.cont + '</b></i></div>' +
        '<div class="mwhy">' + esc(m.why) + '</div>' +
        '<div class="mld">龙头 ' + esc(m.leader || '—') +
          (m.leader_lbc ? ' <b>' + m.leader_lbc + ' 板</b>' : '') + '</div>' +
        '</div>';
    }).join(''));
  })();

  /* ── ⑤ 隐性聚集（够格才出）────────────────────────────────────────── */
  (function hidden() {
    var arr = D.hidden || [];
    if (!arr.length) { set('tHidden', ''); return; }
    set('tHidden',
      '<h2>隐性聚集 <span class="ph">同花顺不统计的名字共性，只在够 3 只时提示</span></h2>' +
      '<div class="hbox">' + arr.map(function (h) {
        return '<div class="hrow"><span class="hch">' + esc(h.ch) + '</span>' +
          '<span class="hn">' + h.n + ' 只 · 最高 ' + h.max_lbc + ' 板</span>' +
          '<span class="hm">' + h.members.map(esc).join('、') + '</span></div>';
      }).join('') + '</div>');
  })();

  /* ── ⑥ 影响因素（≤2 条）───────────────────────────────────────────── */
  (function events() {
    var arr = D.events || [];
    if (!arr.length) {
      set('tEvent', '<div class="evnone">今天没有能解释走势的重大事件</div>');
      return;
    }
    set('tEvent', arr.map(function (e) {
      var tag = e.same_dir === true ? '<span class="evtag on">与今日走势同向</span>'
        : (e.same_dir === false ? '<span class="evtag off">方向上不构成解释</span>' : '');
      return '<div class="ev"><div class="evh"><span class="evk">' + esc(e.kind) + '</span>' +
        esc(e.title) + '</div>' +
        '<div class="evf"><span class="evt">' + esc(e.t) + '</span>' +
        '<span class="evs">' + esc(e.src || '') + '</span>' + tag + '</div></div>';
    }).join(''));
  })();

  /* ── ⑦ 股评原帖（附录）───────────────────────────────────────────── */
  (function guba() {
    var G = D.guba;
    if (!G) { set('tGuba', '<div class="empty">无股评数据</div>'); return; }
    var html = '';
    if (G.sum_s) html += '<div class="gsum"><b>' + esc(G.tag_s || '短线') + '</b><p>' + esc(G.sum_s) + '</p></div>';
    if (G.sum_l) html += '<div class="gsum"><b>' + esc(G.tag_l || '长线') + '</b><p>' + esc(G.sum_l) + '</p></div>';
    var refs = G.refs || [];
    if (refs.length) {
      html += '<div class="grefs">' + refs.map(function (r) {
        return '<div class="gref"><a href="' + esc(r.url || '#') + '" target="_blank" rel="noopener">' +
          esc(r.title || '') + '</a></div>';
      }).join('') + '</div>';
    }
    set('tGuba', html);
  })();
})();
