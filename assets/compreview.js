/* 盘后研究：涨停质量 + 板块状态 */
(function(){
  var P=window.REVIEW||{}, M=P.market||{};
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function f1(x){return Number(x||0).toFixed(1)}
  function f2(x){return Number(x||0).toFixed(2)}
  function set(id,v){var e=document.getElementById(id);if(e)e.innerHTML=v;}
  set('meta','数据日 '+(P.generated||'—')+' · 涨停质量/板块状态由本地库计算');
  set('cards','<div class="card"><div class="lab">涨停</div><div class="v">'+(M.zt||0)+'</div></div>'+
    '<div class="card"><div class="lab">炸板</div><div class="v">'+(M.zb||0)+'</div></div>'+
    '<div class="card"><div class="lab">最高板</div><div class="v">'+(M.max_height||0)+'</div></div>'+
    '<div class="card"><div class="lab">活跃板块</div><div class="v">'+(M.sectors||0)+'</div></div>');
  var q='';
  var qc='';             // 手机端卡片（窄屏用它，表格只在桌面显示）
  /* ★ 2026-11-14：手机端**不用表格**（表格在 390px 里怎么排都对不齐，横滑更不是适配）——
     同一份数据渲染成两张卡：桌面 `<table>`（列对齐）、窄屏 `.rcard`（字段名左 / 值右）。
     CSS 在 `review.css` 里按宽度二选一显示。 */
  (P.quality||[]).forEach(function(x){
    q+='<tr><td><b>'+esc(x.name)+'</b> <span class="muted">'+esc(x.code)+'</span></td>'+
      '<td data-label="连板">'+esc(x.lbc)+'</td><td data-label="首封">'+esc(x.fbt)+'</td>'+
      '<td data-label="炸板">'+esc(x.zbc)+'</td>'+
      '<td data-label="换手">'+(x.hs==null?'—':f1(x.hs)+'%')+'</td>'+
      '<td data-label="5日量比">'+(x.vr==null?'—':f2(x.vr))+'</td>'+
      '<td data-label="封板分"><b title="'+esc(x.parts||'')+'">'+esc(x.score)+'</b></td>'+
      '<td class="reason" data-label="原因" title="'+esc(x.reason)+'">'+esc(x.reason||'—')+'</td></tr>';
    /* 手机端**一行一只票**（2026-11-14 第二次改）：原来每只票一张竖排大卡，
       6 个字段各占一行 → 一只票 200px 高、一屏只能看 1 只半，信息密度崩了。
       现在改成「名称+代码 ｜ 连板 首封 换手 封板分」一行，原因作第二行单行截断。
       实测一只票 ≈ 54px，一屏能看 12 只。 */
    qc+='<div class="rcard"><div class="rh"><b>'+esc(x.name)+'</b>'+
      '<span class="muted">'+esc(x.code)+'</span>'+
      '<span class="rm">'+
        '<i>'+esc(x.lbc)+'板</i>'+
        '<i>'+esc(x.fbt)+'</i>'+
        '<i>'+(x.hs==null?'—':f1(x.hs)+'%')+'</i>'+
        '<b title="'+esc(x.parts||'')+'">'+esc(x.score)+'</b>'+
      '</span></div>'+
      '<div class="rz">'+esc(x.reason||'—')+'</div></div>';
  });
  set('qualityRows',q);
  set('qualityCards',qc);
  function badge(s){
    var m={'高潮':'hot','发酵':'mid','分歧':'warn','退潮':'cool','轮动':'gray','启动':'mid'};
    return '<span class="badge '+(m[s]||'gray')+'">'+esc(s)+'</span>';
  }
  var st='';
  var sc='';             // 手机端卡片（窄屏用它，表格只在桌面显示）
  (P.states||[]).forEach(function(x){
    var d=(x.delta==null)?'—':((x.delta>=0?'+':'')+x.delta);
    var cls=(x.delta>0?'up':x.delta<0?'down':'muted');
    st+='<tr><td><b>'+esc(x.name)+'</b></td>'+
      '<td data-label="涨停"><span class="v">'+esc(x.zt)+'</span></td>'+
      '<td data-label="最高"><span class="v">'+esc(x.high)+'</span></td>'+
      '<td data-label="状态"><span class="v">'+badge(x.state)+'</span></td>'+
      '<td data-label="龙头"><span class="v">'+esc(x.leader)+(x.leader_lbc?(' '+x.leader_lbc+'板'):'')+'</span></td>'+
      '<td data-label="较昨" class="'+cls+'"><span class="v">'+d+'</span></td></tr>';
    sc+='<div class="rcard"><div class="rh"><b>'+esc(x.name)+'</b>'+
      '<span class="rm">'+
        '<i>涨停 '+esc(x.zt)+'</i>'+
        '<i>最高 '+esc(x.high)+'</i>'+
        badge(x.state)+
        '<i>'+esc(x.leader)+(x.leader_lbc?(' '+x.leader_lbc+'板'):'')+'</i>'+
        '<b class="'+cls+'">'+d+'</b>'+
      '</span></div></div>';
  });
  set('stateRows',st);
  set('stateCards',sc);
  set('note',esc(P.note||''));
})();
