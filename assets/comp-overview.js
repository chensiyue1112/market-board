/* 大盘速览组件（读 window.PREVIEW 渲染） */
/* ===== 大盘速览组件 ===== */
(function(){
  var hd = document.getElementById('hdrDate');
  if (hd) {
    var d = new Date();
    var w = '日一二三四五六'[d.getDay()];
    hd.textContent = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0') + ' 周' + w;
  }
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

  /* 指数走势图的重画入口：**下面量能档位一变就调它**（用户 2026-10-12：
     「上面的指数是同步变化日数的」）。IIFE 与外层各一个作用域，用这个变量搭桥。 */
  var idxChartDraw = null;

  /* ★★★ 2026-10-12（用户：「**每日页的上证指数和深证指数的图换一种显示，用一幅图，
     上面是一排按钮，分别是上证，深证，科创50，创业板**」）——
     一张**可切换指数**的收盘线，取代原来那两条微型走势（`#i0-spark`/`#i1-spark`）。
     ⚠ 按钮由 `PREVIEW.idx_pick` 生成（**不在 HTML 里写死**）：写死两处必然漂移。
     ⚠ 容器/按钮位/画图库一旦缺一个就**整段跳过** —— 本组件被别的页复用，
       而且 `check_page.js` 的 stub DOM 下也要能安全跑过去（它只实现了部分 API）。 */
  (function(){
    var box = el('idxChart'), seg = el('idxSeg');
    var pick = P.idx_pick || [];
    if(!box || !seg || !window.echarts || !pick.length){
      // 没有可切换的指数（老数据/取数失败）→ **把整块藏掉**，别留一个 200px 的空框
      if(box) box.style.display = 'none';
      return;
    }
    if(typeof seg.appendChild !== 'function') return;
    var cur = pick[0].k;
    var c = echarts.init(box);
    /* ⚠ 日数**不再在这里写死**（原来是 `WIN = 120`）—— 由量能那排 `30/60/180/360`
       档位传进来，两张图共用一个日数（用户要的"同步变化日数"）。 */
    function seriesOf(k, n){
      var m = (P.idx_series || {})[k] || {};
      var ds = Object.keys(m).sort();
      if(n && ds.length > n) ds = ds.slice(-n);
      return {dates: ds, vals: ds.map(function(d){ return m[d]; })};
    }
    var btns = [];
    /* ⚠⚠ 当前日数**必须记在闭包里**（用户 2026-10-13 报的 bug：「**上证这些指数不跟下面的按钮走，
       老是跳到 720 日**」）。
       起因：指数按钮的处理器写的是 `draw()` —— **不带参数** → `seriesOf(cur, undefined)` 里那句
       `if(n && …)` 判空、**不截取**，于是把缓存里的**全部 800 根**一次画出来 ✗。
       图上看着就像"跳到了最大档"，而且跟下面量能档位显示的日数**对不上**。
       → 把最近一次传进来的 `n` 存成 `curN`，`draw()` 不带参数时**沿用 `curN`**。
       ★ 教训：**"日数"只有一个来源（量能档位），指数图只能记住它、不能没有它**。 */
    var curN = 30;
    /* ★ 2026-10-20（用户：「每日页的四个指数在对应区间标注最大回撤」）——
       **最大回撤** = 区间内「峰值 → 之后最低点」的最大跌幅（标准定义，不是"首日→末日"：
       后者会漏掉中途那一段，比如先跌 20% 再涨回来，末日跌幅只有 2%）。
       一次遍历：维护**至今最高点**下标，算 vals[i]/至今最高-1，取**最负**的那个，
       同时记下峰/谷下标（→ 日期、相隔交易日）。区间内一直创新高 → dd = 0。
       ⚠ 空序列/坏值返回 dd=0（宁可显示 0%，也不显示 NaN）。 */
    function maxDD(vals){
      var peak = 0, best = 0, hi = 0, lo = 0, i, d;
      for(i = 1; i < vals.length; i++){
        if(vals[i] >= vals[peak]) peak = i;
        d = vals[i] / vals[peak] - 1;
        if(d < best){ best = d; hi = peak; lo = i; }
      }
      return {dd: isFinite(best) ? best : 0, hi: hi, lo: lo, gap: lo - hi};
    }
    /* 标签文案（`#idxDD`）。格式与用户给的一致：
       `最大回撤 -12.3%（08-05 → 09-02，20 个交易日）`；没有回撤 → `最大回撤 0%`。
       ⚠ 只用 textContent 写（check_page.js 的 stub DOM 没有元素级 querySelectorAll），
         而且文案里**不许出现 `**`/`~~`**（同一支校验器会扫出来）。
       ★ 2026-10-20 补：**跨年时带年份**。720 档的上证峰在 2024-05（区间从 2024-01 起），
         只写 `05-20 → 09-13` 会被读成"今年的 5 月 20 日"——那是个假信息。
         只有端点年份 ≠ 区间末日年份时才升级成 `YYYY-MM-DD`，常态仍是 `MM-DD`。 */
    function ddLabel(s){
      var r = maxDD(s.vals), pct, yl, d1, d2;
      if(!r.dd) return '最大回撤 0%';
      pct = (r.dd * 100).toFixed(1);
      if(pct === '-0.0' || pct === '0.0') return '最大回撤 0%';
      yl = String(s.dates[s.dates.length - 1]).slice(0, 4);
      d1 = String(s.dates[r.hi]); d2 = String(s.dates[r.lo]);
      if(d1.slice(0, 4) !== yl || d2.slice(0, 4) !== yl){ d1 = d1.slice(0, 10); d2 = d2.slice(0, 10); }
      else { d1 = d1.slice(5); d2 = d2.slice(5); }
      return '最大回撤 ' + pct + '%（' + d1 + ' → ' + d2 + '，' + r.gap + ' 个交易日）';
    }
    function draw(n){
      if(n){ curN = n; }
      var s = seriesOf(cur, curN), nm = cur, i;
      for(i = 0; i < pick.length; i++){ if(pick[i].k === cur) nm = pick[i].name; }
      var up = s.vals.length > 1 && s.vals[s.vals.length-1] >= s.vals[0];
      var dd = maxDD(s.vals), ddEl = el('idxDD');
      if(ddEl) ddEl.textContent = ddLabel(s);
      if (typeof c.clear === 'function') c.clear();
      c.setOption({
        animation:false,
        grid:{left:58,right:16,top:14,bottom:26},
        tooltip:{trigger:'axis',formatter:function(ps){
          return ps[0].axisValue + '<br/>' + nm + ' 收盘 <b>' + ps[0].value + '</b>';}},
        xAxis:{type:'category',data:s.dates,boundaryGap:false,
               axisLabel:{fontSize:11,color:'#8b93a1'},axisLine:{lineStyle:{color:'#e6e9ee'}}},
        yAxis:{type:'value',scale:true,axisLabel:{fontSize:11,color:'#8b93a1'},
               splitLine:{lineStyle:{color:'#f0f2f5'}}},
        series:[{name:nm,type:'line',data:s.vals,smooth:false,symbol:'none',
                 lineStyle:{width:1.8,color:up?UP:DOWN},areaStyle:{opacity:0.06},
                 /* 峰→谷那段**浅色底**标出来（非常淡，只是给眼睛一个落点；
                    没有回撤时不给 markArea，免得画出零宽的一条） */
                 markArea: dd.dd ? {silent:true,itemStyle:{color:'rgba(139,147,161,0.10)'},
                   data:[[{xAxis:s.dates[dd.hi]},{xAxis:s.dates[dd.lo]}]]} : undefined,
                 /* 当天收盘价：贯穿全图的轻微点线，方便一眼看当前价在区间里的位置。 */
                 markLine: s.vals.length ? {
                   silent:true, symbol:'none',
                   lineStyle:{color:'#8b93a1', width:1, type:'dotted', opacity:0.72},
                   label:{show:false},
                   data:[{yAxis:s.vals[s.vals.length-1]}]
                 } : undefined}]
      }, true);
      for(i = 0; i < btns.length; i++){ btns[i].el.className = (btns[i].k === cur) ? 'on' : ''; }
    }
    idxChartDraw = draw;
    pick.forEach(function(x){
      var b = document.createElement('button');
      b.textContent = x.name;
      b.addEventListener('click', function(){ cur = x.k; draw(); });
      seg.appendChild(b);
      btns.push({el:b, k:x.k});
    });
    draw(30);                            // 初始与量能档位默认的 30 日一致
    if(typeof window.addEventListener === 'function'){
      window.addEventListener('resize', function(){ c.resize(); });
    }
  })();
  P.indices.forEach(function(it,i){
    set('i'+i+'-nm', it.name);
    var c = el('i'+i+'-chg');                 // ★ 可能不存在（容器被删/改名）→ 判一下
    if (c) {
      c.textContent = (it.chg>=0?'+':'') + it.chg.toFixed(2) + '%';
      c.className = 'big ' + (it.chg>=0?'up':'down');
    }
    var pc = (it.chg_pt!=null) ? '（' + (it.chg_pt>=0?'+':'') + it.chg_pt.toFixed(2) + '）' : '';
    set('i'+i+'-pt', it.point + ' 点' + pc);
    /* ⚠ 2026-10-12：这里原来还画一条**微型走势**（`#i0-spark`/`#i1-spark`）。
       用户要求换成"一张图 ＋ 四个指数按钮" → 那两条已经撤掉，改由上面的
       `#idxChart` 画（见本文件里 `idx_pick` 那段）。这里**不再需要 per-index 的 spark**。 */
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
    /* ⚠ 这个数组**要和 index.html 里 `#volSeg` 的按钮一一对应** ——
       stub 下没法用 `querySelectorAll('#volSeg button')` 逐个遍历（它只返回通用 stub 节点），
       所以只能把档位列出来。**加档位时两处都要改**。
       2026-10-12：加 360，同日再加 720（`fetch_preview.py` 的 `LMT` 要跟着 ≥ 最大档位）。 */
    [30,60,180,360,720].forEach(function(v){
      var b = document.getElementById('vg-' + v);
      if(b && b.classList){ if(v === nx) b.classList.add('on'); else b.classList.remove('on'); }
    });
    render();
    /* ★ 2026-10-12（用户：「**上面的指数是同步变化日数的**」）——
       档位一变，**上面那张指数走势图也跟着换日数**（两张图共用一个档位）。 */
    if (idxChartDraw) idxChartDraw(n);
  });
  var maTgl=el('volMaTgl');
  if (maTgl) maTgl.addEventListener('click',function(){
    showMa=!showMa; maTgl.classList.toggle('on',showMa);
    maTgl.textContent = showMa?'隐藏20日均量':'显示20日均量'; render();
  });
  window.addEventListener('resize',function(){
    chart.resize();
  /* ⚠ 2026-10-12：`sparks`（每指数一条微型走势）已撤掉，指数图自己挂了 resize ✓ */
  });
})();
