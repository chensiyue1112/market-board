/* 持仓总览：总资产、总浮盈、今日盈亏、两个持仓、加仓计划。 */
(function () {
  var P = window.POSITION || {};
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmt(x){ return Number(x || 0).toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function fmt0(x){ return Number(x || 0).toLocaleString('zh-CN', {maximumFractionDigits:0}); }
  function p3(x){ return Number(x || 0).toFixed(3); }
  function p4(x){ return Number(x || 0).toFixed(4); }
  function pct(x){ var v=Number(x||0); return (v>=0?'+':'')+v.toFixed(2)+'%'; }
  function cls(x){ return Number(x||0)>=0?'up':'down'; }
  function set(id,v){ var e=document.getElementById(id); if(e) e.innerHTML=v; }

  /* ★ 2026-11-14：**负数金额丢了负号**。原来写成
     `(v>=0?'+':'') + '¥' + fmt(Math.abs(v))` —— 负数分支给的是空串，
     于是 −174.62 显示成「¥174.62」（黑字、没有减号），看起来像个盈利。
     现在统一成「符号在货币号前」：+¥1,234.00 / −¥174.62。 */
  function money(v) {
    var n = Number(v || 0);
    return (n >= 0 ? '+' : '−') + '¥' + fmt(Math.abs(n));
  }

  set('meta','数据日 '+(P.generated||'—'));
  set('assets','¥'+fmt(P.total_assets));
  set('pnl','总浮盈 <span class="'+cls(P.total_pnl)+'">' + money(P.total_pnl) + '</span>');
  set('today','今日 <span class="'+cls(P.today_pnl)+'">' + money(P.today_pnl) + '（'+pct(P.today_pnl_pct)+'）</span>');
  set('hint','持仓市值 ¥'+fmt(P.holdings_market_value||0)+' · 标准券 ¥'+fmt(P.standard_bond||0)+' · 可用 ¥'+fmt(P.cash));

  var h='';
  (P.holdings||[]).forEach(function(x){
    h+='<div class="holding"><div class="name">'+esc(x.name)+'<span class="code">'+esc(x.code)+'</span></div>'+
       '<div class="mv">¥'+fmt(x.market_value)+'</div>'+
       '<div class="pnl '+cls(x.pnl)+'">' + money(x.pnl) + '（'+pct(x.pnl_pct)+'）</div>'+
       '<div class="detail">'+fmt0(x.shares)+' 份 · 成本 '+p4(x.avg_cost)+' · 现价 '+p3(x.price)+'</div></div>';
  });
  set('holdings',h);
  set('bond','<span>新标准券 <span style="color:#8b93a1">（现金类）</span></span><b>¥'+fmt(P.standard_bond)+'</b>');
  set('action',esc(P.today_action||''));

  set('note',esc(P.note||''));
})();
