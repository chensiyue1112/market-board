/* comptl.js —— 「时间轴」页（`timeline.html`）的渲染
 *
 * 数据：`site/data/timeline.js`（→ `window.TL`），由 `pipeline/tools/export_timeline.py` 生成。
 * ★★★ 2026-10-13 新建（用户：「**做一种类似时间轴的东西，开盘日用股吧得到的消息总结为四个字，
 *   这四个字要高度凝结总结当天的市场。……要方便观看和翻阅。**」）
 * ★★★ 2026-10-21：长短线**各一句话**（先是「两个四字」，当天晚些改成一句话 ——
 *   用户：「**算了，你的四个字概括的完全很有限，用一句话吧**」）。
 *   字段还是 `ts`／`tl`，内容是句子；渲染用 `.tline`（正文字号），**不用 `.tag`**。
 *   老数据（只有 `t`）→ 导出侧兜底成 `ts`，页面只画一行。
 *
 * ⚠ **分组、排序全在导出那一层做完**，这里只管画（本项目既有做法：页面不重算）。
 * ⚠ 与工具有关的坑：`check_page.js` 的 stub DOM **只实现了部分 API** ——
 *   所以这里只用 `document.getElementById` / `createElement` / `appendChild` /
 *   `textContent` / `className`，**不碰元素级 `querySelectorAll`**（踩过，见 comp-chain.js）。
 */
(function () {
  var D = window.TL || {};
  var RULE = D.rule || {};
  var UP = '#c0392b', DOWN = '#1a9e5f';     /* 红涨绿跌（A 股习惯） */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  /* 星期几：时间轴上"那天是周几"很有用（周一/周五的情绪完全两回事） */
  var WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function wk(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? '' : WK[d.getDay()];
  }

  function render() {
    var el = document.getElementById('dday'), cnt = document.getElementById('cnt');
    if (el) el.textContent = D.generated || '—';
    if (cnt) cnt.textContent = (D.n || 0) + ' 天';
    var n = document.getElementById('rule');
    if (n && RULE.note) n.textContent = RULE.note;
    var w = document.getElementById('warn');
    /* ⚠ `rule.warn` 是**纯文本**直出（不走 md）→ 导出侧那行**不许写 `**`** */
    if (w) { w.textContent = RULE.warn || ''; w.style.display = RULE.warn ? 'block' : 'none'; }

    var host = document.getElementById('view');
    if (!host) return;
    var days = D.days || [];
    if (!days.length) {
      host.innerHTML = '<div class="empty">还没有内容 —— ' +
        'AI 读一遍当天的淘股吧复盘，写短线／长线各一句话（可选配综述与要点），' +
        '填进 <code>guba_note_*.json</code> 的 <code>tag_s</code> / <code>tag_l</code> 字段' +
        '（和总结同一次 <code>--add</code>），' +
        '再跑 <code>python pipeline\\tools\\export_timeline.py</code>。</div>';
      return;
    }
    var h = [], lastMo = '';
    for (var i = 0; i < days.length; i++) {
      var d = days[i], mo = String(d.d || '').slice(0, 7);
      if (mo !== lastMo) {                       /* 按月分组，翻长了也有落点 */
        var c = 0;
        for (var k = i; k < days.length; k++) { if (String(days[k].d).slice(0, 7) === mo) c++; }
        h.push('<div class="mo">' + esc(mo.replace('-', ' 年 ')) + ' 月<i>' + c + ' 天</i></div>');
        lastMo = mo;
      }
      var st = [];
      if (d.zt != null) st.push('涨停 <b>' + d.zt + '</b>');
      if (d.h != null) st.push('最高 <b>' + d.h + '</b> 板');
      if (d.lb != null) st.push('连板 <b>' + d.lb + '</b> 只');
      /* ★★★ 2026-10-17：四字右边那根 12px **涨跌条**（红涨绿跌，长度=|当日涨跌|·6 像素，上限 40）
         —— 竖着扫下来就是一条"情绪心电图"，不用看数字。 */
      var bar = '';
      if (d.ret != null) {
        var bw = Math.min(40, Math.max(2, Math.round(Math.abs(d.ret) * 6)));
        bar = '<i class="db" style="width:' + bw + 'px;background:' +
              (d.ret >= 0 ? UP : DOWN) + '"></i>';
      }
      /* ★★★ 2026-10-17：**之后 3 个交易日**（沪指累计）—— 这是"验证"不是"预测"。
         ⚠ 最新那 2~3 天还没走完 → 显示「待验证」，别拿别的数凑。 */
      var fw;
      if (d.fwd != null) {
        fw = '<span class="dfwd">之后3天 <b class="' + (d.fwd >= 0 ? 'up' : 'dn') + '">' +
             (d.fwd >= 0 ? '+' : '') + d.fwd.toFixed(1) + '%</b></span>';
      } else {
        fw = '<span class="dfwd pend">之后3天 待验证</span>';
      }
      /* ★★★ 2026-10-21：**长短线各一句话**（用户先要「两个四字」，当天又改口：
         「**算了，你的四个字概括的完全很有限，用一句话吧**」）。
         `ts`／`tl` 由导出侧给（`tgb_summary.tag_s` / `tag_l`，内容是**句子**）；
         **老数据只有 `tag`** → 导出侧已经把它兜底成 `ts`、`tl` 留空，这里只画一行。
         ⚠ 句子用 **`.tline`**（**正文 13.5px、正常行高、不是 700**），**绝不复用 `.tag`**
           —— `.tag` 是当年给四个大字用的（22px／`mobile.css` 还有
           `.tl .tag{font-size:20px}` 那条作用域规则），复用就会被撑成大字。
         ⚠ 两行**结构完全一致**（短/长小牌子 ＋ 同一套字号），只有颜色分（短线红、长线蓝）。 */
      var ts = d.ts || d.t || '', tl = d.tl || '';
      var ones = '';
      if (ts || tl) {
        ones = '<div class="tones">' +
          (ts ? '<div class="tln"><i class="tk s">短</i>' +
            '<span class="tline s">' + esc(ts) + '</span></div>' : '') +
          (tl ? '<div class="tln"><i class="tk l">长</i>' +
            '<span class="tline l">' + esc(tl) + '</span></div>' : '') +
          '</div>';
      }
      h.push('<div class="day' + (i >= 5 ? ' old' : '') + '">' +
        '<div class="drow">' +
        '<span class="ddate">' + esc(String(d.d || '').slice(5)) + ' ' + esc(wk(d.d)) + '</span>' +
        bar +
        '<span class="dstats">' + st.join(' · ') + '</span>' + fw +
        '</div>' + ones +
        (d.note ? '<div class="dnote">' + esc(d.note) +
          '<a class="dlink" href="guba.html">当天复盘 →</a></div>' : '') +
        '</div>');
    }
    host.innerHTML = h.join('');
  }
  render();
})();
