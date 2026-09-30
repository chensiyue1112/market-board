/* 时间轴最小渲染：只输出 日期 + 短线/长线两句话。 */
(function () {
  var D = window.TL || {};
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var WK = ['周日','周一','周二','周三','周四','周五','周六'];
  function wk(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? '' : WK[d.getDay()];
  }
  var host = document.getElementById('view');
  if (!host) return;
  var days = D.days || [], h = [];
  for (var i = 0; i < days.length; i++) {
    var d = days[i], ts = d.ts || d.t || '', tl = d.tl || '';
    if (String(d.d || '') < '2026-10-20') continue;
    if (!ts || !tl) continue;
    var dir = d.ret == null ? '' : (d.ret >= 0 ? ' up' : ' down');
    h.push('<div class="day">' +
      '<div class="ddate">' + esc(d.d || '') + ' ' + esc(wk(d.d)) + '</div>' +
      (ts ? '<div class="tline' + dir + '">' + esc(ts) + '</div>' : '') +
      (tl ? '<div class="tline' + dir + '">' + esc(tl) + '</div>' : '') +
      '</div>');
  }
  host.innerHTML = h.join('');
})();
