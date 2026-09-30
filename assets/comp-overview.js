/* 大盘速览组件（读 window.PREVIEW 渲染） */
/* ===== 大盘速览组件 ===== */
(function(){
  var P = window.PREVIEW;
  if(!P){set('srcNote','未取到数据 preview.js');return;}
  var UP='#e03131', DOWN='#2f9e44';
  /* ★ 2026-09-22：本组件原来**每一处都直接 `document.getElementById(...).xxx =`**，
     容器一旦缺失（删卡 / 改名 / 数据里少一块）就在**渲染链最前面**抛 TypeError ——
     **速览卡的成交额、量能比、量能图、校验行全部空白，而且界面上不报错**。
     其余四支组件（comp-sector / comp-emotion / comp-macro / comp-alerts）都做了存在性判断，
     **只有这一支漏了** —— 2026-09-22 刚删过卡（观察区），这类改动随时会再发生。
     现在统一走 `el()`（取元素，可能 null）与 `set()`（只在存在时写文字）。 */
  function el(id){ return document.getElementById(id); }
  function set(id, txt){ var e = el(id); if (e) e.textContent = txt; }

  set('ovDate', '数据日 ' + P.generated);
  /* **旧数据不许伪装成今天**（2026-09-14 用户就是照这个抓出来的：速览卡显示的上证 -1.18%
     其实是 09-11 的，当天真实是 -0.07%）。所以：① 日期写进标题（上面那行）；
     ② 一旦有告警（=最新交易日没取到），在**数字正上方**的静态告警条里写明"这是哪天的数"。*/
  (function(){
    var bar = document.getElementById('ovStale');
    if(!bar) return;
    if(P.warn){
      bar.innerHTML = '⚠ <b>下面这些数字是 ' + P.generated + ' 的，不是最新交易日</b>：'
        + String(P.warn).replace(/</g,'&lt;');
      bar.style.display = 'block';
    }
  })();

  function spark(el, dates, closes, color){
    if(!closes || closes.length<2){el.style.display='none';return;}
    var c = echarts.init(el);
    c.setOption({grid:{left:1,right:1,top:3,bottom:3},
      tooltip:{trigger:'axis',formatter:function(ps){return ps[0].axisValue+'<br/>收盘 <b>'+ps[0].value+'</b> 点';}},
      xAxis:{type:'category',data:dates,show:false},
      yAxis:{type:'value',scale:true,show:false},
      series:[{type:'line',data:closes,smooth:false,symbol:'none',lineStyle:{width:1.3,color:color}}]});
    sparks.push(c);
  }
  var sparks=[];
  P.indices.forEach(function(it,i){
    set('i'+i+'-nm', it.name);
    var c = el('i'+i+'-chg');                 // ★ 可能不存在（容器被删/改名）→ 判一下
    if (c) {
      c.textContent = (it.chg>=0?'+':'') + it.chg.toFixed(2) + '%';
      c.className = 'big ' + (it.chg>=0?'up':'down');
    }
    var pc = (it.chg_pt!=null) ? '（' + (it.chg_pt>=0?'+':'') + it.chg_pt.toFixed(2) + '）' : '';
    set('i'+i+'-pt', it.point + ' 点' + pc);
    var sp0 = el('i'+i+'-spark');
    if (sp0) spark(sp0, it.spark_dates || P.amount_series.dates,
          it.spark_closes, it.chg>=0?UP:DOWN);
  });

  /* 两市成交 */
  set('tv', Math.round(P.turnover_yi).toLocaleString('zh-CN') + ' 亿');
  // ⚠ 除零/缺字段要兜住：`turnover_yest_yi` 为 0 或缺失时，这里会算出 **Infinity/NaN**
  //   （导出侧 `fetch_preview.py` 自己就写了 `r_yest = ... if yest else None`），
  //   而同一张卡的量能比那一格此刻显示的是「—」→ **同条件两个数说法矛盾**。2026-09-22 修。
  var tvChg = (P.turnover_yest_yi ? (P.turnover_yi/P.turnover_yest_yi - 1)*100 : null);
  var tvEl = el('tv-chg');
  if (tvEl) {
    tvEl.textContent = (tvChg!=null && isFinite(tvChg))
      ? '较昨 ' + (tvChg>=0?'+':'') + tvChg.toFixed(1) + '%' : '—';
    if (tvChg!=null && isFinite(tvChg)) tvEl.className = 'sub ' + (tvChg>=0?'up':'down');
  }
  set('tv-lab', '20日均 ' + Math.round(P.amount_avg20_yi).toLocaleString('zh-CN') + ' 亿');

  /* 量能比：人话标注放量/缩量、相对 20 日均 */
  var ry = P.ratio_vs_yest, r20 = P.ratio_vs_20avg, r5 = P.ratio_vs_5avg;
  var r = el('ratio');
  if (r) {
    r.textContent = (ry!=null ? ry.toFixed(2) : '—');
    r.className = 'big ' + (ry!=null ? (ry>=1?'up':'down') : '');
  }
  set('ratio5', '较5日均 ' + (r5!=null?r5.toFixed(2):'—') + ' · 较20日均 ' + (r20!=null?r20.toFixed(2):'—'));
  set('ratio-lab', (r20!=null ? (r20>=1?'放量（高于20日均）':'缩量（低于20日均）') : '') +
    (ry!=null ? ' · 环比' + (ry>=1?'增':'减') : ''));

  /* 校验提示（数据硬原则：失败不许悄悄上页） */
  if(P.warn){var w=el('ovWarn'); if(w){w.textContent='⚠ '+P.warn; w.style.display='block';}}
  if(P.checks && P.checks.length){
    var c0=P.checks[0];
    set('ovChk', '✓ 交叉校验：' + c0.date + ' 两市成交 本脚本 ' + Math.round(c0.ours) + ' 亿 vs 公开实测 '
      + Math.round(c0.known) + ' 亿（偏差 ' + (c0.dev_pct>=0?'+':'') + c0.dev_pct + '%）');
  }
  set('srcNote', P.note + ' · 数据源：' + P.source);

  /* 量能柱 + 20 日均量线 */
  var n = 30, showMa = false;
  // ⚠ `echarts.init(null)` 会抛 —— 容器没了就别初始化整张图（后面的量能柱、档位、均线开关都靠它）
  var volBox = el('volChart');
  if (!volBox) { set('srcNote', '量能图容器 #volChart 不在这一页'); return; }
  var chart = echarts.init(volBox);
  var allDates = P.amount_series.dates, allYi = P.amount_series.yi;
  var maAll = allYi.map(function(_,i){
    if(i<19) return null;
    var s=0; for(var j=i-19;j<=i;j++) s+=allYi[j];
    return Math.round(s/20);
  });
  /* 纵轴步进：取"最小的规整档"使 值域/step ≤ 7（亿元，整数档）——
     ⚠ **必须从小往大试**（从大往小试第一个就命中，会给 1.6 万亿的成交额套上 5 万的格）。
     2026-09-15 用户："量能图也在纵轴放明显点。" → 除了步进，刻度也加大加深、把轴线画出来。 */
  function volStep(span){
    var t = [500,1000,2000,2500,5000,10000,20000,25000,50000,100000];
    for(var i=0;i<t.length;i++){ if(span/t[i]<=7) return t[i]; }
    return t[t.length-1];
  }
  function render(){
    var dates = allDates.slice(-n), vals = allYi.slice(-n);
    var upLast = vals[vals.length-1] >= vals[vals.length-2];
    var series=[{name:'成交额',type:'bar',data:vals,barMaxWidth:22,
      itemStyle:{color:function(par){var last=vals.length-1;
        if(par.dataIndex===last)return upLast?UP:DOWN; return '#74c0fc';},borderRadius:[2,2,0,0]}}];
    /* ⚠ `smooth:true`（2026-09-22 用户："20日均线做平滑点，你现在的直线太生硬了"）——
       原来折线是一段段直线拼的，量能本身抖动大，看着像锯齿。均线本来就是**平滑过的**量，
       画成折线反而把"平滑"这件事又抹掉了。⚠ 只对均线用平滑，**柱状不受影响**。 */
    if(showMa){series.push({name:'20日均量',type:'line',data:maAll.slice(-n),smooth:true,symbol:'none',
      lineStyle:{width:1.6,type:'solid',color:'#868e96'},itemStyle:{color:'#868e96'}});}
    /* 柱状图的纵轴**必须从 0 起**（量能是绝对量，截断会骗人）；只管把刻度做规整、做清楚 */
    var real = vals.filter(function(x){return x!=null;});
    var mx = real.length ? Math.max.apply(null, real) : 1;
    var mn = real.length ? Math.min.apply(null, real) : 0;
    var iMax = vals.indexOf(mx), iMin = vals.indexOf(mn);
    var cur = vals[vals.length-1];
    var step = volStep(mx || 1);
    /* **当前尺度里的最高/最低量能，以及今天处在什么位置**（2026-09-15 用户："标出来当前尺度的
       最高量能和最低量能，然后展示一下当前在这个尺度的什么位置"）——
       ① 图上：最高/最低各一条虚线（带值+日期），今天再一条（重合时只画一条、标签合并）；
       ② 图下：一行人话（区间 + 今天是第几 + 分位 + 处在上沿/中间/下沿）。 */
    var lowN = real.filter(function(x){ return x < cur; }).length;      // 比今天低的有几天
    var pct = real.length > 1 ? Math.round(100 * lowN / (real.length - 1)) : 0;
    var isMin = cur <= mn, isMax = cur >= mx;
    var where = isMin ? '区间最低' : isMax ? '区间最高'
      : (pct <= 20 ? '区间下沿' : pct <= 40 ? '偏下' : pct <= 60 ? '中间' : pct <= 80 ? '偏上' : '区间上沿');
    var wt = isMin ? 'down' : isMax ? 'up'
      : (pct <= 40 ? 'down' : pct >= 60 ? 'up' : '');
    function yi(v){ return Math.round(v).toLocaleString('zh-CN'); }     // 亿元一律取整（与卡片其它数字一致）
    /* 三条参考线（最高/最低/今日）**只留线、不标文字**（2026-09-22 用户："三根线不用标文字，
       我知道是代表什么"）。信息没丢：图下 `volPos` 那行人话把 最高/最低/今日 三个数连日期都写全了，
       线上的标签只是重复；而且三条线的值都挨得近时标签会互相压。颜色区分就够了：
       红=最高、绿=最低、灰=今日。 */
    function mk(v, color){
      return {yAxis: v, lineStyle:{color:color,type:'dashed',width:1}, label:{show:false}};
    }
    /* 今天与最高/最低重合时就别再画两条线（今天 16,127 正好是最低那天 → 会出现两条重叠的标签） */
    var ml = [];
    ml.push(mk(mx, '#e03131'));
    ml.push(mk(mn, '#2f9e44'));
    if(!isMin && !isMax) ml.push(mk(cur, '#495057'));
    series[0].markLine = {silent:true, symbol:'none', data:ml};
    chart.setOption({grid:{left:8,right:10,top:16,bottom:22,containLabel:true},
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(ps){
        var h = ps[0].axisValue+'<br/>成交额 <b>'+Math.round(ps[0].value).toLocaleString('zh-CN')+'</b> 亿';
        if(ps.length>1 && ps[1].value!=null){h+='<div>20日均量 <b>'+Math.round(ps[1].value).toLocaleString('zh-CN')+'</b> 亿</div>';}
        return h;}},
      xAxis:{type:'category',data:dates,axisLine:{lineStyle:{color:'#dee2e6'}},
        axisTick:{show:false},axisLabel:{color:'#868e96',fontSize:10,interval:Math.max(0,Math.floor(dates.length/5)-1),
          formatter:function(v){ return String(v||'').slice(5); }}},
      yAxis:{type:'value',name:'亿元',min:0,max:Math.ceil(mx/step)*step,interval:step,
        nameTextStyle:{color:'#adb5bd',fontSize:11},
        axisLine:{show:true,lineStyle:{color:'#dee2e6'}},
        axisTick:{show:true,lineStyle:{color:'#dee2e6'}},
        splitLine:{lineStyle:{color:'#eef1f4'}},
        axisLabel:{color:'#868e96',fontSize:11,margin:6,
          formatter:function(v){ return Number(v).toLocaleString('zh-CN'); }}},
      series:series}, true);
    var posEl = document.getElementById('volPos');
    if(posEl){
      posEl.innerHTML = '近 <b>' + vals.length + '</b> 个交易日：最高 <b>' + yi(mx) + '</b> 亿（' +
        String(dates[iMax]).slice(5) + '）· 最低 <b>' + yi(mn) + '</b> 亿（' +
        String(dates[iMin]).slice(5) + '）　｜　今日 <b>' + yi(cur) + '</b> 亿 ＝ <b class="' + wt +
        '">' + where + '</b>' + ((isMin || isMax) ? '' :
        '（比近 ' + vals.length + ' 日里 ' + pct + '% 的交易日高）');
    }
  }
  render();
  /* 量能档位：**事件委托**（`data-vol` 写在按钮上，点哪个只重画这张图）——
     原来是 `querySelectorAll('#volSeg button')` 逐个绑，校验器碰不到这条路
     （stub 的 querySelectorAll 只返回通用 stub 节点），控件坏了也不会被发现。
     2026-09-15 起与情绪区、量能档位的写法统一：委托 + 固定 id 改 on 态。 */
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t || !t.closest) return;
    var btn = t.closest('[data-vol]');
    if(!btn) return;
    var nx = parseInt(btn.getAttribute('data-vol'), 10);
    if(!nx) return;
    n = nx;
    [30,60,180].forEach(function(v){
      var b = document.getElementById('vg-' + v);
      if(b && b.classList){ if(v === nx) b.classList.add('on'); else b.classList.remove('on'); }
    });
    render();
  });
  var maTgl=el('volMaTgl');
  if (maTgl) maTgl.addEventListener('click',function(){
    showMa=!showMa; maTgl.classList.toggle('on',showMa);
    maTgl.textContent = showMa?'隐藏20日均量':'显示20日均量'; render();
  });
  window.addEventListener('resize',function(){
    chart.resize(); sparks.forEach(function(c){c.resize();});
  });
})();
