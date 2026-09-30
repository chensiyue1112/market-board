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

  set('meta','数据日 '+(P.generated||'—'));
  set('assets','¥'+fmt(P.total_assets));
  set('pnl','总浮盈 <span class="'+cls(P.total_pnl)+'">'+(Number(P.total_pnl)>=0?'+':'')+'¥'+fmt(Math.abs(Number(P.total_pnl)))+'</span>');
  set('today','今日 <span class="'+cls(P.today_pnl)+'">'+(Number(P.today_pnl)>=0?'+':'')+'¥'+fmt(Math.abs(Number(P.today_pnl)))+'（'+pct(P.today_pnl_pct)+'）</span>');
  set('hint','总市值 ¥'+fmt(P.total_market_value)+' · 可用 ¥'+fmt(P.cash));

  var h='';
  (P.holdings||[]).forEach(function(x){
    h+='<div class="holding"><div class="name">'+esc(x.name)+'<span class="code">'+esc(x.code)+'</span></div>'+
       '<div class="mv">¥'+fmt(x.market_value)+'</div>'+
       '<div class="pnl '+cls(x.pnl)+'">'+(Number(x.pnl)>=0?'+':'')+'¥'+fmt(x.pnl)+'（'+pct(x.pnl_pct)+'）</div>'+
       '<div class="detail">'+fmt0(x.shares)+' 份 · 成本 '+p4(x.avg_cost)+' · 现价 '+p3(x.price)+'</div></div>';
  });
  set('holdings',h);
  set('bond','<span>新标准券 <span style="color:#8b93a1">（现金类）</span></span><b>¥'+fmt(P.standard_bond)+'</b>');
  set('action',esc(P.today_action||''));

  var q='';
  (P.planned_buys||[]).forEach(function(b,i){
    q+='<div>第'+(i+1)+'笔：跌到 <b>'+p3(b.price)+'</b> 买 <b>¥'+fmt0(b.budget)+'</b>（约 '+fmt0(b.shares)+' 份）</div>';
  });
  set('plan',q);
  set('note',esc(P.note||''));
})();
