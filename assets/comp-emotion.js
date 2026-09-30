/* 情绪区组件（四板块，读 window.EMOTION 渲染） */
/* ===== 情绪区组件（四个板块 · 由 EMOTION.components 驱动） ===== */
(function(){
  var E = window.EMOTION;
  var noteEl = document.getElementById('emoNote');
  if(!E){noteEl.textContent='未取到数据 emotion.js';return;}
  noteEl.textContent = '数据日 ' + E.generated + ' · ' + E.note;

  var UP='#e03131', DOWN='#2f9e44', INK='#23262b';
  /* **档位 30/60/180 每个图各自管理**（2026-09-15 用户："30/60/180放在每个子图的右上角，单独管理。"）：
     以前是一个共享变量 n，点一次四个图一起换；现在 NS[key] 各存一份（默认 30），
     点某个图的档位只重画那个图。 */
  var NS = {}, REG = {}, $ = function(id){return document.getElementById(id);};
  function nOf(key){ return NS[key] || 30; }

  /* 轴步进：取"最小可用步进"，使 值域/step ≤ 7 且刻度规整（1/2/5/10/20…或小数档）。
     ⚠ 必须从小往大试——从大往小试第一个就命中，会把 1 家/1 板/% 拉平成 200 的网格。 */
  function tickStep(span, isInt){
    var t = isInt ? [1,2,5,10,20,50,100,200]
                  : [0.05,0.1,0.2,0.5,1,2,5,10,20,50,100];
    for(var i=0;i<t.length;i++){ if(span/t[i]<=7) return t[i]; }
    return t[t.length-1];
  }
  /* 轴规则（两部分）：
     ① 起止：向上取整到步进的倍数即可，**不强制从 0 起**——
        "始终从 0 起"只适合家数/板数这类计数；指数点位（微盘股）与分数从 0 起会把曲线压成一条带。
     ② 步进：取"最小可用步进"，使 值域/step ≤ 7 且刻度规整（1/2/5/10/20…或小数档）。
        ⚠ 必须从小往大试——从大往小试第一个就命中，会把 1 家/1 板/% 拉平成 200 的网格。 */
  function tickStep(span, isInt){
    var t = isInt ? [1,2,5,10,20,50,100,200,500,1000,2000,5000]
                  : [0.05,0.1,0.2,0.5,1,2,5,10,20,50,100,200,500,1000,2000];
    for(var i=0;i<t.length;i++){ if(span/t[i]<=7) return t[i]; }
    return t[t.length-1];
  }
  function axisOf(vals, isInt, anchor0){
    var real = vals.filter(function(x){return x!=null;});
    var mn = real.length ? Math.min.apply(null, real) : 0;
    var mx = real.length ? Math.max.apply(null, real) : 1;
    var step = tickStep((mx - mn) || Math.abs(mx) || 1, isInt);
    /* anchor0=true（家数/板数这类计数）：从 0 起，读数直观；
       anchor0=false（指数点位/分数）：按窗口内值域缩放，否则曲线被压成一条带 */
    var lo = (anchor0 === false) ? Math.floor(mn/step)*step : 0;
    var hi = Math.ceil(mx/step)*step;
    if(hi === lo) hi = lo + step;
    var d = isInt ? 0 : 2;
    /* **纵轴要读数**（2026-09-15 用户："其实我只是想让他的纵轴明显一点"）：
       一行一个图之后空间够了 → 刻度字号 9→11、颜色加深、轴线画出来、网格更清楚。 */
    return {type:'value',min:+lo.toFixed(d),max:+hi.toFixed(d),interval:step,
            axisLabel:{color:'#868e96',fontSize:11,margin:6},
            axisLine:{show:true,lineStyle:{color:'#dee2e6'}},
            axisTick:{show:true,lineStyle:{color:'#dee2e6'}},
            splitLine:{lineStyle:{color:'#eef1f4'}}};
  }
  function fmtS(v, unit){
    if(v==null) return '—';
    if(unit==='%') return v.toFixed(2)+'%';
    if(unit==='亿') return v.toFixed(2)+' 亿';
    if(unit==='板') return Math.round(v)+' 板';
    if(unit==='家') return Math.round(v)+' 家';
    return v.toFixed(2);
  }
  function lastReal(a){ for(var i=a.length-1;i>=0;i--){ if(a[i]!=null) return i; } return -1; }
  function prevReal(a,i0){ for(var i=i0-1;i>=0;i--){ if(a[i]!=null) return i; } return -1; }
  function avgOf(a){ var r=a.filter(function(x){return x!=null;});
    return r.length? r.reduce(function(x,y){return x+y;},0)/r.length : null; }
  function avgLine(avg){
    return avg==null ? undefined : {silent:true,symbol:'none',
      lineStyle:{color:'#ced4da',type:'dashed',width:1},label:{show:false},
      data:[{yAxis:Number(avg.toFixed(2))}]};
  }
  /* 涨停强度专用：画**锚点水平线（0）**而不是窗口均值 ——
     这个指数就是"以锚点期为 0"标出来的，把 0 画出来才看得出"这几天在常态之上还是之下"。
     ⚠ 2026-09-15 用户："涨停强度的图里面的锚点0这几个字去掉" → **只留虚线、不写字**
     （纵轴刻度上本来就有 0，再写一遍是多余的）。 */
  function anchorLine(v){
    return {silent:true,symbol:'none',
      lineStyle:{color:'#b197fc',type:'dashed',width:1},
      label:{show:false},
      data:[{yAxis:Number(v)}]};
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function num(v,d){ return v==null ? '—' : Number(v).toFixed(d==null?2:d); }
  function sgn(v,d){ return v==null ? '—' : (v>0?'+':'') + Number(v).toFixed(d==null?3:d); }
  /* 带符号的两位小数（0 附近也要能看出正负；v0.48 强度改成以 0 为中心后到处要用） */
  function sg(v){ return v==null ? '—' : (v>0?'+':'') + Number(v).toFixed(2); }

  /* ===== 涨停强度「怎么算出来的」小窗口（2026-09-14 用户要求：点某日的点弹出计算内容） =====
     内容全部来自 E.score_bars[日期]（导出侧算好，页面不做计算）：
       score = 5.0 + 0.40×z(H) + 0.30×z(D) + 0.30×z(R)，z=(原始值−冻结锚点均值)/锚点标准差 */
  var HINT_H = '今日连板股按板层加权求和（1 板层只展示、不计分）';
  var HINT_D = '今日首板、且近 N 日内涨停 ≥M 次：(次数/窗口)^1.6 求和';
  var HINT_R = '0.6×1进2率 + 0.3×2进3率 + 0.1×3进4率；分母<2 的档不计入，剩余权重归一';

  function scoreModalHtml(date){
    var B = (E.score_bars || {})[date];
    var P = E.score_params || {};
    if(!B) return '<div class="dim">这一天没有强度记录（早于强度计算起点，或当天还没跑「每日更新」）。</div>';
    var w = B.w || P.w || {h:.4,d:.3,r:.3};
    var off = P.offset==null ? 5.0 : P.offset;
    var an = P.anchor || {};
    var rows = [
      ['H', '连板高度', B.h, an.h, w.h, HINT_H],
      ['D', '反复活跃', B.d, an.d, w.d, HINT_D],
      ['R', '接力（晋级率）', B.r, an.r, w.r, HINT_R]];
    var sum = 0;
    rows.forEach(function(r){ if(B.con && B.con[r[0].toLowerCase()]!=null) sum += B.con[r[0].toLowerCase()]; });
    var h = '<div class="scform">' + esc((P.formula ||
      ('score = ' + off + ' + 0.40×z(H) + 0.30×z(D) + 0.30×z(R)')).replace(/\*/g, '×')) + '</div>';
    /* 固定列宽（`sctab`）：每格只放**一个数**，公式与合计另起一行说明 ——
       否则"5.66（记录值 5.66）"这种长文本会把那一列撑宽，别的列头跟着换行，看着就是"表格对不齐"。 */
    h += '<table class="stk sctab"><colgroup><col style="width:29%"><col style="width:11%">' +
         '<col style="width:25%"><col style="width:11%"><col style="width:10%"><col style="width:14%">' +
         '</colgroup><thead><tr><th>分量</th><th>原始值</th><th>锚点 μ±σ</th><th>z</th>' +
         '<th>权重</th><th>贡献</th></tr></thead><tbody>';
    rows.forEach(function(r){
      var k = r[0].toLowerCase(), a = r[3] || {};
      h += '<tr><td><b>' + r[0] + '</b> ' + r[1] + '</td>' +
           '<td>' + num(r[2]) + '</td>' +
           '<td>' + (a.mu==null?'—':num(a.mu,3) + ' ± ' + num(a.sd,3)) + '</td>' +
           '<td>' + num((B.z||{})[k],3) + '</td>' +
           '<td>' + num(r[4],2) + '</td>' +
           '<td class="' + (((B.con||{})[k]||0)>=0?'up':'down') + '">' + sgn((B.con||{})[k]) + '</td></tr>';
    });
    h += '<tr><td><b>基准</b> 锚点日水平</td><td>—</td><td>—</td><td>—</td><td>—</td><td>' +
         num(off,1) + '</td></tr>';    h += '<tr class="sum"><td>合计</td><td>—</td><td>—</td><td>—</td><td>—</td><td>' +
         sg(off + sum) + '</td></tr></tbody></table>';
    /* 合计的验算写成一行算式：负项用减号（"− 0.076"），别写成 "＋ -0.076" 这种读着别扭的 */
    function term(v){ return v==null ? '—' : (v < 0 ? '− ' + Math.abs(v).toFixed(3)
                                                   : '＋ ' + Number(v).toFixed(3)); }
    h += '<div class="note2">' + num(off,1) + '（基准）' + term((B.con||{}).h) + term((B.con||{}).d) +
         term((B.con||{}).r) + ' ＝ <b>' + sg(off + sum) + '</b>' +
         '　记录值 ' + sg(B.score) + '</div>';
    /* ⚠ **只讲"这个数怎么来的"**（2026-09-15 用户："这些不需要啊…这些也不需要…我都知道连板股了
       就不需要知道这些"）——删掉三类东西：
         · 口径原文（子项目那段长 note）与"数据＝永久归档"的交代 → 口径在《技术方案》里，不占弹窗；
         · "0 是什么／锚点是什么／z 怎么读"整段解释（用户已经明白了，第二次看就是噪音）；
         · R 的"今日晋级的票"名单（与上面的连板股名单是同一批票，重复）。
       留下：公式 → 三分量表（原始值/锚点/z/权重/贡献）→ 一行验算 → R 接力分层 → 板层分布 → H/D 名单。 */
    if(B.warmup) h += '<div class="note2"><b>这天在预热期</b>（D 的 8 日窗口还没满），不参与最高/最低判读。</div>';

    /* —— R 的接力分层（最能说明"接力强不强"） —— */
    var pm = B.promote || {}, tiers = pm.tiers || {};
    var keys = Object.keys(tiers);
    if(keys.length){
      h += '<div class="dsub">R 接力分层 · 昨→今 <b>' + (pm.cnt==null?'—':pm.cnt) + '/' +
           (pm.prev_total==null?'—':pm.prev_total) + '</b> 只延续（承接率 <b>' +
           (pm.rate==null?'—':num(pm.rate,1)+'%') + '</b>）</div>';
      h += '<table class="stk sctab"><colgroup><col style="width:26%"><col style="width:24%">' +
           '<col style="width:22%"><col style="width:28%"></colgroup>' +
           '<thead><tr><th>档位</th><th>晋级/分母</th><th>晋级率</th><th>是否计入 R</th></tr></thead><tbody>';
      keys.forEach(function(k){
        var t = tiers[k] || {}, used = (t.den!=null && pm.min_tier_den!=null && t.den >= pm.min_tier_den);
        h += '<tr><td>' + esc(k) + '</td><td>' + (t.num==null?'—':t.num) + ' / ' +
             (t.den==null?'—':t.den) + '</td><td>' + (t.rate==null?'—':num(t.rate,1)+'%') + '</td>' +
             '<td>' + (used ? '计入' : '<span class="dim">分母&lt;' + pm.min_tier_den + '，不计入</span>') + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    /* —— 板层分布 —— */
    var ly = B.layers || {}, lk = Object.keys(ly).sort(function(a,b){ return (+a.slice(1))-(+b.slice(1)); });
    if(lk.length){
      h += '<div class="dsub">板层分布（10cm 分层口径）</div><div class="scchips">' +
        lk.map(function(k){ return '<span class="scchip">' + k.slice(1) + ' 板 <b>' + ly[k] + '</b></span>'; }).join('') +
        '</div>';
    }
    /* —— 三个分量的个股名单 —— */
    function listOf(title, arr, n, fmt){
      if(!arr || !arr.length) return '';
      return '<div class="dsub">' + title + ' <b>' + n + '</b> 只' +
        (n > arr.length ? '（列前 ' + arr.length + '）' : '') + '</div><div class="scchips">' +
        arr.map(function(x){ return '<span class="scchip">' + esc(x.n) + ' <b>' + fmt(x) + '</b></span>'; }).join('') +
        '</div>';
    }
    h += listOf('H · 连板股（按板层加权）', B.h_list, B.n_h, function(x){ return x.cur + ' 板'; });
    h += listOf('D · 反复活跃（首板且近 ' + (P.d_win||8) + ' 日 ≥' + (P.d_need||2) + ' 板）',
                B.d_list, B.n_d, function(x){ return '近' + (P.d_win||8) + '日 ' + x.c + ' 板'; });
    /* R 的"今日晋级的票"名单**不再单独列**（2026-09-15 用户："我都知道连板股了就不需要知道这些"）：
       它就是上面 H 连板股那批票的"上一档→这一档"，重复一遍只是噪音。 */
    return h;
  }

  function openScoreModal(date){
    var m = $('emoModal');
    if(!m || !date) return;
    var B = (E.score_bars || {})[date];
    if($('emoMTitle')) $('emoMTitle').textContent =
      '涨停强度 ' + (B && B.score!=null ? sg(B.score) : '—') + '　' + date + '　怎么算出来的';
    if($('emoMBody')) $('emoMBody').innerHTML = scoreModalHtml(date);
    m.classList.add('on');
  }
  function closeScoreModal(){
    var m = $('emoModal'); if(m) m.classList.remove('on');
  }
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t || !t.closest) return;
    if(t.closest('[data-emoclose]')){ closeScoreModal(); return; }
    var c = t.closest('[data-emoscore]');
    if(c){
      var v = c.getAttribute('data-emoscore');
      var ds = E.dates || [];
      var arr = (E.series && E.series.score) || [];
      var i = lastReal(arr);
      openScoreModal(v === 'last' ? (i>=0 ? ds[i] : ds[ds.length-1]) : v);
    }
  });
  document.addEventListener('keydown', function(e){
    if(e && e.key === 'Escape') closeScoreModal();
  });

  (E.components||[]).forEach(function(c){
    var specs = c.series || [];
    var main = specs[0];
    var vals = (E.series && E.series[main.key]) || [];
    var dates = E.dates || [];   /* 统一主网格（真实交易日）；各序列按日期对位 */
    var i0 = lastReal(vals), pv = prevReal(vals, i0);
    var nReal = vals.filter(function(x){return x!=null;}).length;

    /* —— 头部：主值 + 较昨 —— */
    var vEl=$('v-'+c.key), dEl=$('d-'+c.key), hEl=$('h-'+c.key), sEl=$('s-'+c.key);
    if(hEl) hEl.innerHTML = (c.hint || '') + (c.key==='score'
      ? '　<span class="caret" data-emoscore="last" title="点曲线上的点看那一天的算式">算法 ▸</span>' : '');
    if(i0<0){
      if(vEl){vEl.textContent='—'; vEl.style.color='#ced4da';}
      /* **区分"接口本来不给历史"和"今天没取到"**（2026-09-14）：
         微盘股（同花顺 883418）平时是有 200 根历史的，今天因为该源当日预算打满没取到 ——
         这种时候必须说"没取到、下次自动补"，不能说成"接口不提供历史"（那是两回事）。 */
      var miss = /没取到|留空/.test(String(E.note||''));
      if(dEl){dEl.textContent = miss ? '今天没取到' : '历史累积中'; dEl.style.color='#adb5bd';}
      if(sEl) sEl.innerHTML='<span class="gapnote">' + (miss
        ? '数据源今天没取到 → 这一格留空，下次跑「每日更新」会自动补（不是「没有数据」）'
        : '接口不提供历史 → 自 '+E.generated+' 起累积') + '</span>';
      return;
    }
    var cur = vals[i0];
    if(vEl){
      /* **带符号**（v0.48 起强度以 0 为中心）：正=偏强、负=偏弱，符号本身就是结论 →
         正数补 "+"，颜色按符号走（红强绿弱，与全站红涨绿跌一致）。 */
      var txt = fmtS(cur, c.unit);
      if(c.signed && cur > 0) txt = '+' + txt;
      vEl.textContent = txt;
      vEl.style.color = (c.unit==='%' || c.signed) ? (cur>=0?UP:DOWN) : INK;
    }
    if(dEl){
      if(pv>=0){
        var d = cur - vals[pv], du = c.unit||'';
        dEl.textContent = '较昨 ' + (d>0?'+':'') + (c.int ? Math.round(d) : d.toFixed(2)) + (du?(' '+du):'');
        dEl.style.color = d>=0?UP:DOWN;
      }else{
        dEl.textContent = '（历史不足，仅当日）'; dEl.style.color='#adb5bd';
      }
    }
    /* 子行：计数类给期内均值；指数点位类给区间涨跌（均值对点位没意义）；
       **涨停强度给"区间跨度 + 今日相对锚点的偏离 + 历史分位"**（2026-09-14 用户：
       "设为 5 分很难看出来各日的波动"）——均值会把这个指数的波动抹平（各日都在 5 附近），
       所以这里不写均值，改写"今天比常态强多少、在历史上排第几"。 */
    if(sEl){
      var parts = [];
      if(c.trend){
        var rs = vals.filter(function(x){return x!=null;});
        if(rs.length >= 2){
          var ch = (rs[rs.length-1] / rs[0] - 1) * 100;
          parts.push('区间 ' + (ch>=0?'+':'') + ch.toFixed(2) + '%（' + vals.length + '日）');
        }
      }else if(c.key === 'score'){
        /* 区间与分位都用**满窗口**（不含预热期）—— 口径明确说"预热期不参与最高/最低判读"，
           所以这里不能把预热那 8 天算进来（它们的 D 窗口不满，会出现 −2.4 / +4.3 这种极端值）。 */
        var B0 = (E.score_bars || {})[E.dates[i0]] || {};
        var FL = E.score_full || {};
        if(FL.min != null){
          parts.push('满窗口 ' + FL.n + ' 日 ' + sg(FL.min) + '~' + sg(FL.max) +
                     '（跨度 ' + (FL.max-FL.min).toFixed(2) + '）');
        }
        if(B0.rank != null) parts.push('今日分位 ' + B0.rank.toFixed(0) + '%');
      }else{
        var avg = avgOf(vals);
        if(avg!=null && nReal>=2) parts.push('期内均值 '+fmtS(avg, c.unit));
      }
      if(nReal<vals.length) parts.push('有效历史 '+nReal+'/'+vals.length+' 天');
      sEl.innerHTML = parts.length ? '<span class="gapnote">'+parts.join(' · ')+'</span>' : '';
    }

    /* —— 折线 —— */
    var el = $('c-'+c.key);
    if(!el) return;
    var chart = echarts.init(el);
    function render(){
      var k = Math.min(nOf(c.key), dates.length);      // 用**这个图自己的档位**
      var dd = dates.slice(-k);
      var yA = [], series = [];
      specs.forEach(function(sp, si){
        var v = ((E.series&&E.series[sp.key])||[]).slice(-k);
        var ax = axisOf(v, !!c.int, c.anchor0);   /* ← 判据用 comp.int；anchor0 决定是否从 0 起 */
        if(si>0){ ax.splitLine={show:false}; if(!c.shareAxis) ax.position='right'; }
        yA.push(ax);
        var sdef = {name:sp.name, type:sp.type||'line', yAxisIndex:si, data:v,
          itemStyle:{color:sp.color}, lineStyle:{width:si?1.2:1.7,color:sp.color},
          barMaxWidth:16, connectNulls:false};
        if((sp.type||'line')==='line'){ sdef.smooth=false; sdef.symbol='circle'; sdef.symbolSize=3; }
        if(si===0 && (sp.type||'line')==='line'){
          var off5 = (E.score_params || {}).offset;
          if(c.key === 'score' && off5 != null) sdef.markLine = anchorLine(off5);
          else sdef.markLine = avgLine(avgOf(v));
        }
        if(sp.warmup && (E.score_warmup_idx||[]).length){
          /* 预热期：按主网格里的实际位置标注（前 warmup 天） */
          var wi = E.score_warmup_idx.filter(function(x){ return x >= dates.length-k; });
          if(wi.length){
            sdef.markArea={silent:true,itemStyle:{color:'rgba(255,212,120,.22)'},
              data:[[{xAxis:dd[wi[0]-(dates.length-k)]},{xAxis:dd[wi[wi.length-1]-(dates.length-k)]}]]};
          }
        }
        series.push(sdef);
      });
      chart.setOption({
        /* 图变高变宽之后（一行一个）留出上下呼吸：上方给"锚点/均值"参考线的标签留位置 */
        grid:{left:4,right:8,top:18,bottom:4,containLabel:true},
        /* 悬停 tooltip：**只给日期和值**（2026-09-15 用户："鼠标放在点上面的弹窗只要显示日期和强度就行了，
           不要多余文字"）——原来末尾还挂一行口径小字（`c.hint`），那是"多余文字"，去掉；
           单序列的图不再重复写序列名（卡片标题已经写了），只留数值 + 单位。 */
        tooltip:{trigger:'axis',formatter:function(ps){
          var h='<div>'+ps[0].axisValue+'</div>';
          ps.forEach(function(p){
            if(p.value==null) return;
            h+='<div>'+(ps.length>1?(p.marker+p.seriesName+' '):'')+'<b>'+fmtS(p.value, c.unit)+'</b></div>';
          });
          return h;}},
        /* x 轴：**只标几个日期**（一行一个图之后横向有空间了，标出首尾能知道这段是哪几天）
           —— 不逐点标（30~180 个点会糊成一片）。 */
        xAxis:{type:'category',data:dd,axisLine:{show:true,lineStyle:{color:'#e9ecef'}},
          axisTick:{show:false},
          axisLabel:{show:true,color:'#adb5bd',fontSize:10,interval:Math.max(0,Math.floor(dd.length/5)-1),
            formatter:function(v){ return String(v||'').slice(5); }}},
        yAxis:yA, series:series
      }, true);
    }
    render();
    /* 点强度曲线上的任意一点 → 弹出**那一天**的算式（2026-09-14 用户要求）。
       dataIndex 是"当前档位窗口"里的下标 → 先按档位换回真实日期。 */
    if(c.key === 'score'){
      chart.on('click', function(p){
        if(!p || p.componentType !== 'series' || p.dataIndex == null) return;
        var k = Math.min(nOf('score'), dates.length);   // 与上面 render 用同一个档位
        var dt = dates.slice(-k)[p.dataIndex];
        if(dt) openScoreModal(dt);
      });
    }
    REG[c.key] = {chart:chart, render:render};
  });

  /* 档位提示行：**不再汇总一个共享档位**（每个图自己管），只说清网格 —— 档位按钮就在每个图右上角 */
  function rangeNote(){
    var rEl = document.getElementById('emoRange');
    if(!rEl) return;
    rEl.textContent = '显示网格＝真实交易日（历史不足处留空）；30/60/180 在每个图右上角各自切换。';
  }
  /* **派生读数一行**（2026-09-17 加，全部挤在**一行**里，不新开卡片）：
       赚钱效应 · 炸板率 · 净涨停占比 · 连板梯队完整度
     口径（来源与踩坑都记在 `pipeline/pool_metrics.py` / `premium.py` 文件头）：
       · 赚钱效应 = 昨日涨停股今日涨幅均值（R 测"接力强不强"，它测"昨天买的今天赚不赚"）
       · **炸板率 = 炸板股数 /(涨停+炸板)** —— 分母是"触及涨停"，必须用**独立炸板池**；
         全行业最常见的算错是拿"涨停池里炸板次数>0"当炸板（实测差 17 个百分点）
       · **净涨停占比 = 涨停占比 − 跌停占比**（国泰海通研报口径）；两家开源都强调
         用占比/比值而非绝对家数（绝对数受市况基数影响、跨日不可比）
       · 梯队完整度 = 2..height 档位中非空占比（height<3 出"—"，**不给 0**）
     ⚠ 任一数**没取到**就显示 "—"，绝不当 0（"没取到" ≠ "没有"）。 */
  function premNote(){
    var pEl = document.getElementById('emoPrem');
    if(!pEl) return;
    var P = (E.prem || []);
    var t = P.length ? P[P.length - 1] : null;
    var parts = [];
    if(t){
      var sign = t.avg > 0 ? 'up' : (t.avg < 0 ? 'down' : 'dim');
      parts.push('<span class="premOpen" data-premopen="1" title="点开看逐日趋势">' +
        '赚钱效应 <b class="' + sign + '">' + (t.avg > 0 ? '+' : '') +
        t.avg.toFixed(2) + '%</b> <i class="premCue">›</i></span><span class="dim">（中位 ' +
        (t.med > 0 ? '+' : '') + t.med.toFixed(2) + '% · 翻红 ' +
        Math.round(t.win * 100) + '% · ' + t.n + ' 只）</span>');
    } else {
      parts.push('赚钱效应 <b class="dim">—</b><span class="dim">（昨涨停股行情覆盖不足半数）</span>');
    }
    var pm = E.pool_metrics || null;
    if(pm){
      parts.push('炸板率 ' + fmtPct(pm.break_rate));
      parts.push('净涨停占比 ' + fmtSigned(pm.net_zt_share));
      parts.push('梯队完整度 ' + (pm.ladder_completeness == null
        ? '<b class="dim">—</b><span class="dim">（高度' + (pm.height == null ? '?' : pm.height) + '<3）</span>'
        : '<b>' + Math.round(pm.ladder_completeness * 100) + '%</b><span class="dim">（' +
          pm.rungs_filled + '/' + (pm.height - 1) + ' 档）</span>'));
    }
    pEl.innerHTML = parts.join('　｜　');
  }
  function fmtPct(v){
    return v == null ? '<b class="dim">—</b>' : '<b>' + (v * 100).toFixed(1) + '%</b>';
  }
  function fmtSigned(v){
    if(v == null) return '<b class="dim">—</b>';
    var c = v > 0 ? 'up' : (v < 0 ? 'down' : 'dim');
    return '<b class="' + c + '">' + (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%</b>';
  }
  /* 赚钱效应 · 点开看逐日趋势（2026-09-18 加）
     ⚠ **为什么不新开卡片**：用户对"每日页加东西"很敏感。数据其实早就逐日填好了
       （`emotion.js` 的 `prem` 是逐日网格），此前只是**行内只显示最新一天** ——
       而"拿得住"要看的就是**趋势**。所以只在他已有那一行上加一个可点入口，不新增卡片。
     档位与全站一致：10 / 30 / 100 个交易日。 */
  var PREM_WIN = 30;
  var PREM_SEGS = [10, 30, 100];
  var premChart = null;
  function premTrend(){
    var P = (E.prem || []), D = (E.dates || []);
    var out = [];
    for(var i = 0; i < P.length; i++){
      var t = P[i];
      out.push((t && t.avg != null) ? {d: D[i], avg: t.avg, med: t.med,
                                      win: t.win, n: t.n} : null);
    }
    return out.slice(-PREM_WIN);
  }
  function premModalHtml(){
    var h = '<div class="seg">';
    PREM_SEGS.forEach(function(v){
      h += '<button id="prem-sg-' + v + '" data-premseg="' + v + '" data-n="' + v + '" class="' +
        (v === PREM_WIN ? 'on' : '') + '">' + v + '</button>';
    });
    h += '</div><div id="premTrendBox" style="height:220px"></div>';
    return h;
  }
  function drawPremTrend(){
    var box = document.getElementById('premTrendBox');
    if(!box || typeof echarts === 'undefined') return;
    var S = premTrend();
    if(!premChart) premChart = echarts.init(box);
    premChart.setOption({
      animation: false,
      grid: {left: 46, right: 12, top: 14, bottom: 24},
      tooltip: {trigger: 'axis', formatter: function(ps){
        var i = ps[0].dataIndex, x = S[i];
        if(!x) return ps[0].axisValue + '<br/>（当日没取到）';
        return x.d + '<br/><b>' + (x.avg > 0 ? '+' : '') + x.avg.toFixed(2) + '%</b>' +
          '（中位 ' + (x.med > 0 ? '+' : '') + x.med.toFixed(2) + '% · 翻红 ' +
          Math.round(x.win * 100) + '% · ' + x.n + ' 只）';
      }},
      xAxis: {type: 'category', boundaryGap: false,
              data: S.map(function(x){ return x ? x.d : ''; }),
              axisLabel: {fontSize: 9, interval: Math.max(0, Math.ceil(S.length / 6) - 1)}},
      /* ⚠ 这是**带正负号的比率**（可正可负）→ **不从 0 起**（`scale:true`），
         并画一条 0 参考线：0 以上＝昨涨停股今天整体在涨，以下为负。 */
      yAxis: {type: 'value', scale: true,
              axisLabel: {fontSize: 9, formatter: function(v){ return v + '%'; }}},
      series: [{type: 'line', smooth: false, symbol: 'circle', symbolSize: 3,
                showSymbol: S.length <= 12, connectNulls: false,
                lineStyle: {width: 1.6}, itemStyle: {color: '#e03131'},
                data: S.map(function(x){ return x ? x.avg : null; }),
                markLine: {silent: true, symbol: 'none',
                           lineStyle: {color: '#adb5bd', type: 'dashed'},
                           data: [{yAxis: 0}]}}],
    });
    premChart.resize();
  }
  function openPremModal(){
    var m = $('emoModal'); if(!m) return;
    if($('emoMTitle')) $('emoMTitle').textContent = '赚钱效应 · 逐日趋势';
    if($('emoMBody')) $('emoMBody').innerHTML = premModalHtml();
    m.classList.add('on');
    // innerHTML 换过 → 旧实例挂在已移除的节点上，必须重来一次
    if(premChart){ try{ premChart.dispose(); }catch(err){} premChart = null; }
    drawPremTrend();
  }
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t || !t.closest) return;
    if(t.closest('[data-premopen]')){ openPremModal(); return; }
    var sg = t.closest('[data-premseg]');
    if(!sg) return;
    var nv = parseInt(sg.getAttribute('data-n'), 10);
    if(!nv) return;
    PREM_WIN = nv;
    PREM_SEGS.forEach(function(v){
      var b = document.getElementById('prem-sg-' + v);
      if(b && b.classList){ if(v === nv) b.classList.add('on'); else b.classList.remove('on'); }
    });
    drawPremTrend();
  });

  /* **每个图各管各的档位**：事件委托（`data-seg` 在按钮上），点哪个只重画哪个图。
     按钮用固定 id（`sg-<key>-<n>`），切档时只改这三颗的 on 态 —— 不依赖 DOM 遍历，
     校验器的 stub 也能走通这条路径（`--click=data-n=180`）。 */
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t || !t.closest) return;
    var btn = t.closest('[data-seg]');
    if(!btn) return;
    var key = btn.getAttribute('data-seg');
    var nx = parseInt(btn.getAttribute('data-n'), 10);
    if(!key || !nx) return;
    NS[key] = nx;
    [30,60,180].forEach(function(v){
      var b = document.getElementById('sg-' + key + '-' + v);
      if(b && b.classList){ if(v === nx) b.classList.add('on'); else b.classList.remove('on'); }
    });
    if(REG[key]) REG[key].render();       // 只重画这一个图
    rangeNote();
  });
  rangeNote();
  premNote();
  window.addEventListener('resize',function(){
    Object.keys(REG).forEach(function(k){ REG[k].chart.resize(); });
  });
})();
