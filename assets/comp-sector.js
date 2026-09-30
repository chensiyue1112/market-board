/* comp-sector.js — **概念观察**页（数据：data/sector.js → window.SECTOR）（⚠ 2026-09-26 改名：本页原名「板块观察页」，现名「**概念观察**」）
 *
 * 结构按《需求文档》v0.44：观察区 / 重点板块对比 / 候选榜
 * ⚠ **2026-09-22：观察区那一块已从页面删除**（用户："还有观察区删除"），
 *   连带「＋观察」按钮（涨停板行 / 新冒出 / 信号行三处）一起去掉 ——
 *   按钮加进去的是个**再也看不到的清单**。
 *   下面的 `load/save/add/del/has/obsRow` **保留但当前无人调用**：
 *   圈定结果仍存在浏览器 localStorage（站点纯静态、无后端），
 *   哪天要把观察区加回来，恢复 HTML 那一段 + 这里的渲染即可。
 */
(function () {
  var ALL = window.SECTOR_DATA || {};
  var DATES = (window.SECTOR_DATES || []).slice();
  var S = window.SECTOR || ALL[DATES[DATES.length - 1]] || {};
  var KEY = 'msj.observe.v1';
  var CHIP_GROUPS = [];

  /* —— 日期切换（用户要的小组件：可回看历史日验证策略）—— */
  function curDate() { return S.generated; }
  function isHist() { return !!S.historical; }
  function setDay(d) {
    if (!ALL[d]) return;
    S = ALL[d];
    render();
    paintDayBar();
  }
  function paintDayBar() {
    var sel = el('sDay');
    if (!sel) return;
    if (sel.options && sel.options.length !== DATES.length) {   // 只在首次或数量变化时重建
      sel.innerHTML = '';
      DATES.slice().reverse().forEach(function (d) {
        var o = document.createElement('option');
        o.value = d;
        o.textContent = d + (ALL[d] && ALL[d].historical ? '' : '（最新）');
        sel.appendChild(o);
      });
    }
    sel.value = curDate();
    var i = DATES.indexOf(curDate());
    if (el('sPrev')) el('sPrev').disabled = (i <= 0);
    if (el('sNext')) el('sNext').disabled = (i >= DATES.length - 1);
    var w = el('sDayWarn');
    if (w) {
      if (isHist() && S.day_warn) { w.textContent = '⚠ ' + S.day_warn; w.style.display = 'block'; }
      else { w.style.display = 'none'; }
    }
  }
  function bindDay() {
    var sel = el('sDay');
    if (sel) sel.addEventListener('change', function (e) { setDay(e.target.value); });
    if (el('sPrev')) el('sPrev').addEventListener('click', function () {
      var i = DATES.indexOf(curDate());
      if (i > 0) setDay(DATES[i - 1]);
    });
    if (el('sNext')) el('sNext').addEventListener('click', function () {
      var i = DATES.indexOf(curDate());
      if (i >= 0 && i < DATES.length - 1) setDay(DATES[i + 1]);
    });
  }

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pct(v) {
    if (v == null) return '—';
    var c = v > 0 ? 'up' : (v < 0 ? 'down' : 'dim');
    return '<span class="' + c + '">' + (v > 0 ? '+' : '') + v.toFixed(2) + '%</span>';
  }
  /* 涨跌的"指标值"形式（放进 .m 槽里用，等宽数字 + 粗体） */
  function pctb(v) {
    if (v == null) return '<b class="dim">—</b>';
    var c = v > 0 ? 'up' : (v < 0 ? 'down' : 'dim');
    return '<b class="' + c + '">' + (v > 0 ? '+' : '') + v.toFixed(2) + '%</b>';
  }
  /* 指标槽：小标签（10px 灰）+ 值（13px 等宽）——同族卡片里列会自然对齐 */
  function M(label, val, wide) {
    return '<span class="m' + (wide ? ' wide' : '') + '"><i>' + label + '</i>' + val + '</span>';
  }
  function load() {
    var l;
    try { l = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    /* 读出来就顺手把"名字＝代码"的旧条目改成真名（改不动就原样返回） */
    return (typeof healObsNames === 'function') ? healObsNames(l) : l;
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }
  function has(code) {
    return load().some(function (x) { return x.code === code; });
  }
  function add(obj) {
    var l = load();
    if (!l.some(function (x) { return x.code === obj.code; })) { l.push(obj); save(l); }
    render();
  }
  function del(code) {
    save(load().filter(function (x) { return x.code !== code; }));
    render();
  }

  /* —— 数据索引：按方向代码找当日数据 —— */
  function index() {
    var m = {};
    (S.hits || []).forEach(function (h) { m[h.code] = h; });
    (S.newcomers || []).forEach(function (n) { if (!m[n.code]) m[n.code] = n; });
    return m;
  }

  /* —— 方向名解析：**任何地方都不许把代码当名字显示** ——
     （2026-09-14 用户："886015 为什么显示个数字？？？"）
     成因：观察区存在浏览器里，加进去时那个方向**当天不在方向榜**上 → `index()[code]` 是空的，
     老代码就把 `name` 写成了代码本身，之后页面一直显示那串数字。
     现在的顺序：当日榜 → 全库对照表 S.board_names → 最后才退回代码（并标出来）。 */
  function nameOf(code, fallback) {
    var h = index()[code];
    if (h && h.name) return h.name;
    if (fallback && fallback !== code) return fallback;
    var bn = (window.SECTOR_NAMES || {})[code];      // 全库对照表（导出文件尾部一份）
    if (bn) return bn;
    return fallback || code;
  }
  /* 旧数据自愈：localStorage 里存着"名字＝代码"的条目 → 用全库对照表改回来并写回 */
  function healObsNames(list) {
    var changed = false;
    var names = window.SECTOR_NAMES || {};
    var out = list.map(function (x) {
      if (!x || !x.code) return x;
      var nm = names[x.code];
      if (nm && (!x.name || x.name === x.code)) {
        changed = true;
        return { code: x.code, name: nm, added: x.added, etf: x.etf, etf_name: x.etf_name };
      }
      return x;
    });
    if (changed) { try { localStorage.setItem(KEY, JSON.stringify(out)); } catch (e) {} }
    return out;
  }

  /* 走势证据拼成一行（鼠标停在 ETF 上就看得到；**替代一定注明"不是同一主题"**） */
  function etfEvidence(x) {
    var p = [];
    if (x.kind === '替代') p.push('替代：不是同一主题，只是走势跟着走');
    if (x.kind === '对应') p.push('对应：与板块同主题的场内 ETF');
    if (x.corr != null) p.push('跟踪度 ' + x.corr.toFixed(2));   // 全站统一叫"跟踪度"（＝相关）
    if (x.resid != null) p.push('剔沪深300残差相关 ' + x.resid.toFixed(2));
    if (x.same_dir != null) p.push('同向率 ' + Math.round(x.same_dir * 100) + '%');
    if (x.beta != null) p.push('beta ' + x.beta.toFixed(2));
    if (x.cumdiff != null) p.push('60日累计差 ' + (x.cumdiff >= 0 ? '+' : '') + x.cumdiff.toFixed(1) + '%');
    if (x.amount20) p.push('20日均额 ' + (x.amount20 / 1e8).toFixed(2) + '亿');
    if (x.scale) p.push('规模 ' + (x.scale / 1e8).toFixed(2) + '亿');
    return p.join(' · ');
  }

  /* ⚠ `moneyCell()`（资金那一格）随"涨停板一行只留名称/涨停数/涨幅/特征"一起去掉了
     （2026-09-16）：资金读数仍在观察区那张卡的展开里（那里才是决定买不买的地方）。 */

  /* **按「归入」的票算的结构读数**（v0.82）——一行里的 连板/最高/形态 必须与「归入 N 只」同源。
     为什么不能用同花顺的 sector_zt 字段（实测 9.11 新能源汽车）：
       方向级 high = "4天3板"，但我们库里的 lbc 取的是个股 `continue_num`（当日连板）→ 该概念
       12 只成员当日**全是首板**；那个"4天3板"来自成员 `high_days` 编码（众泰汽车 196612 = 4天3板），
       而同花顺同时给它的 `continue_num` 是 1 —— **同花顺自己两个字段就打架**；
       而且众泰汽车已被归入**一带一路**，压根不在这个方向的归入名单里。 */
  function ownStats(h) {
    var own = (h && h.own) || [];
    var lian = own.filter(function (x) { return (x.lbc || 1) >= 2; });
    var best = lian.slice().sort(function (a, b) { return (b.lbc || 0) - (a.lbc || 0); })[0] || null;
    return {
      n: own.length, lian: lian.length, best: best,
      f1: lian.filter(function (x) { return (x.span || x.lbc) === x.lbc; }).length,
      f2: lian.filter(function (x) { return (x.span || x.lbc) > x.lbc; }).length,
      high: best ? ((best.span && best.span > best.lbc)
        ? best.span + '天' + best.lbc + '板' : best.lbc + '板') : '首板',
    };
  }

  /* ══ 2026-09-16 版面重构（用户："只有观察区做的好，保留观察区，放在最上面。其他的给我重构或者删除。"
     ＋"每个板块要显式展示的数据有：板块或主题名称，今日涨停数量，今日主题或板块涨幅，有什么特征。
     剩下的放到点击展开，点击展开的是要额外弹出来一个页面，而不是折叠展开。点开可以展示今日涨停的票，
     但是仅仅展示，再带个属性，比如连扳多少板或者几天几板，就足够了，别说一堆废话。"）══

     卡片行统一成：**名称 · 涨停数 · 涨幅 · 特征**（特征最多两项：最高板 / 在榜天数 / 股吧帖数）；
     代码、涨停理由、归属依据、连板只数、形态①②、榜内原始涨停数**全部进悬空弹窗**，
     弹窗里票只给「名称 + 几板」（理由挂 title 悬浮）。 */

  function hitsMap() {
    var m = {};
    /* ⚠ **`days_on` 要在这里补进去**（2026-09-17 修）：导出侧**只有 `stats` / `board_top` /
       `leaders_by_board` 带 `days_on`，`hits[]` / `newcomers[]` 里没有这个字段**
       （实测：最新导出 `hits[0]` 的键为 code,name,zt_num,uniq_num,cont_num,high,high_num,chg,dup_n,own_n
       —— 306 条历史 hits 无一带 `days_on`）。
       而 `daysTxt(≥2 才写)` 在**涨停板行**与**点开的弹窗**里都要用它 → 结果是
       「连续 N 天有涨停」**从来没渲染过**（芯片概念当时已 8 天，特征栏却空着）。
       数据本来就在 `S.stats[code].days_on` 里 → 统一在这里补，三处调用点不用各自兜。 */
    var st = S.stats || {};
    /* ⚠ **只给"涨停板/新冒出"这一族补，不碰观察区**（2026-09-17）：
       v1.31 ③ 已经定了「观察区点开＝ETF 走势折线图，**不再原地展开明细表**，要看明细去涨停板卡」，
       所以观察区那张卡只显示它自己那几格，**不给它加"连续 N 天"**（否则是擅自把用户砍掉的东西加回去）。
       观察区卡里那个隐藏的 `.sdetail` 面板读 `S.stats[code].days_on` 本来就取得到，不受这里影响。 */
    function fix(o) {
      if (o && o.days_on == null && st[o.code]) o.days_on = st[o.code].days_on;
      return o;
    }
    (S.hits || []).forEach(function (h) { m[h.code] = fix(h); });
    (S.newcomers || []).forEach(function (n) { if (!m[n.code]) m[n.code] = fix(n); });
    return m;
  }
  /* 「连续 N 天有涨停」的唯一取数处：先看对象自己带的，再退回 `S.stats`（同上：导出侧只有 stats 带它） */
  function daysOf(o) {
    if (!o) return null;
    if (o.days_on != null) return o.days_on;
    var s = (S.stats || {})[o.code];
    return s ? s.days_on : null;
  }
  /* 方向 → 今日涨停名单（**归入**口径）；同类合并过的方向把同族名单并起来、按股票去重 */
  function boardStocks(code, aliasCodes) {
    var m = hitsMap(), seen = {}, out = [];
    ([code].concat(aliasCodes || [])).forEach(function (cd) {
      var h = m[cd];
      if (!h) return;
      (h.own || h.stocks || []).forEach(function (s2) {
        if (s2 && s2.stock && !seen[s2.stock]) { seen[s2.stock] = 1; out.push(s2); }
      });
    });
    return out;
  }
  function lvlText(s) {                 // "3板" / "5天3板"
    var lbc = (s && s.lbc) || 1;
    return (s && s.span && s.span > lbc) ? (s.span + '天' + lbc + '板') : (lbc + '板');
  }
  /* "连续 N 天有涨停"——**只在 ≥2 天时写**："连续 1 天"就是今天，等于没说（别写废话） */
  function daysTxt(n) { return (n && n >= 2) ? ('连续 ' + n + ' 天有涨停') : ''; }
  /* 弹窗里的名单：**只给名称 + 几板**（代码小字标注身份；涨停理由只在悬浮里） */
  function stockList(list) {
    if (!list || !list.length) return '<div class="empty">今天没有归入这个方向的涨停股。</div>';    return '<div class="zxlist">' + list.map(function (s2) {
      return '<div class="zxrow" title="' + esc(s2.reason || '') + '">' +
        '<b>' + esc(s2.name || s2.stock) + '</b>' +
        '<i>' + esc(lvlText(s2)) + '</i>' +
        '<em>' + esc(s2.stock) + '</em></div>';
    }).join('') + '</div>';
  }
  /* 「这个方向对应哪只 ETF」——点涨停板/新冒出的弹窗里也要给（2026-09-17 用户："涨停板点击后
     要显示一个etf，但是目前好像没做到。"）。
     理由：**用户只做 ETF** —— 点开一个方向、看完是哪几只票在涨停，下一步必然是"那我买哪只"。
     原来弹窗里只有票、一个 ETF 都不给，等于让人自己再去别处找。
     用**同一套两行卡零件**（`.bcard/.bhead/.bmain/.bline`，见观察区一节）——**别自创版式**。
     ⚠ `data-etfchart` 让整行可点 → 点它弹 ETF 走势图（与观察区一致）；没有 ETF 时如实写"无配套 ETF"。 */
  function etfOfBoard(code) {
    var fe = (window.SECTOR_ETFS || {})[code] || null;
    var co = null;
    var idx = index()[code];
    if (idx && idx.etf && (idx.etf.cands || []).length) co = idx.etf.cands[0];
    if (fe) {
      var se = (S.etfs || {})[fe.code] || {};
      return { code: fe.code, name: fe.name || se.name || '', pct: se.pct,
               kind: fe.kind, corr: fe.corr, verified: true };
    }
    if (co) return { code: co.code, name: co.name, pct: co.pct, kind: co.kind,
                     corr: co.corr, verified: false };
    return null;
  }
  function etfBlockHtml(code) {
    var e = etfOfBoard(code);
    var meta = S.follow_meta || {};
    var fol = (S.follow || {})[code];
    var body;
    if (e) {
      var tier = (e.kind === '替代') ? '<span class="tag warn">替代</span>'
               : (e.kind === '对应') ? '<span class="tag hit">对应</span>' : '';
      body = '<div class="bcard"><div class="bhead" data-etfchart="' + esc(e.code) + '"' +
        ' data-etfname="' + esc(e.name || '') + '"' +
        ' title="点这张卡看 ' + esc(e.code) + ' 的走势（10/30/100 个交易日）">' +
        '<span class="bmain"><div class="bline"><span class="lab">ETF</span>' +
          '<span class="bcode">' + esc(e.code) + '</span>' + tier +
          '<span class="bsub">' + esc((e.name || '').slice(0, 20)) + '</span>' +
          '<span class="bpct">' + (e.pct != null ? pct(e.pct) : '—') + '</span></div>' +
        '</div><span class="caret">▸</span></div></div>';
    } else {
      body = '<div class="bcard"><div class="bhead">' +
        '<span class="bmain"><div class="bline"><span class="lab">ETF</span>' +
        '<span class="bsub">无配套 ETF</span></div></div></div></div>';
    }
    /* 同一方向的候选对比（只有 ≥2 只时才出表；放量日 <5 次的方向导出侧就不给） */
    var cmp = '';
    if (fol && fol.length >= 2) {
      cmp = '<table class="stk"><tr><th>代码</th><th>名称</th><th>档位</th>' +
        '<th class="rsn">放量日超额</th><th>相关性</th></tr>' +
        fol.map(function (r) {
          var exc = (r.exc == null) ? '—' : ((r.exc > 0 ? '+' : '') + (r.exc * 100).toFixed(2) + '%');
          return '<tr><td>' + esc(r.etf) + '</td><td>' + esc(r.name || '') + '</td>' +
            '<td>' + esc(r.kind || '—') + '</td><td class="rsn">' + exc + '</td>' +
            '<td>' + ((r.corr == null) ? '—' : r.corr.toFixed(3)) + '</td></tr>';
        }).join('') + '</table>';
    } else if (fol && fol.length === 1) {
      cmp = '<div class="srcnote">该方向只有 1 只候选 ETF，没有可比项。</div>';
    } else if (!fol && meta.held_n) {
      cmp = '<div class="srcnote">当日 ' + meta.held_n + ' 个方向因数据未就绪或样本不足未出「候选对比」。</div>';
    }
    return '<div class="dsub">对应的 ETF' +
      (fol ? ' · 同一方向候选 ' + fol.length + ' 只' : '') + '</div>' + body + cmp;
  }

  /* 悬空小窗口（**所有"点开"都弹它**，不再原地折叠展开）；共用 `#sxModal` */
  function openSx(title, body, foot) {
    var m = el('sxModal');
    if (!m) return;
    el('sxMTitle').textContent = title || '';
    el('sxMBody').innerHTML = (body || '') +
      (foot ? '<div class="zxf">' + foot + '</div>' : '');
    m.classList.add('on');
  }
  function closeSx() { var m = el('sxModal'); if (m) m.classList.remove('on'); }

  /* 弹窗①：某个方向今天涨停的票（涨停板 / 新冒出 / ② 异动 共用） */
  function openBoardSx(o) {
    var list = boardStocks(o.code, o.alias_codes);
    var f = [];
    if (o.alias && o.alias.length) f.push('含 ' + o.alias.join('、'));
    if (o.own_n != null) f.push('归入 <b>' + o.own_n + '</b> 只');
    if (o.zt_num) f.push('同花顺涨停 <b>' + o.zt_num + '</b> 只');
    if (o.cont_num && o.high) f.push('最高 <b>' + esc(o.high) + '</b>');   // 全是首板就不写"最高 首板"
    if (daysTxt(daysOf(o))) f.push('连续 <b>' + daysOf(o) + '</b> 天有涨停');
    /* ⚠ 弹窗里**必须给 ETF**（2026-09-17 用户："涨停板点击后要显示一个etf，但是目前好像没做到。"）：
       用户只做 ETF —— 看完是哪几只票在涨停，下一步就是"那我买哪只"。 */
    openSx(nameOf(o.code, o.name) + ' 今日涨停',
           stockList(list) + etfBlockHtml(o.code), f.join(' · '));
  }
  /* 弹窗②：出头鸟卡的某个方向（只列连板 ≥2 的票，与胶囊上的"最高 N 板"同源） */
  function openLeadSx(b) {
    openSx(nameOf(b.code, b.name) + ' 出头鸟', stockList(b.leaders || []),
      '连板 <b>' + (b.cont_num || 0) + '</b> 只 · 最高 <b>' + esc(b.high || '—') + '</b>' +
      (daysTxt(b.days_on) ? ' · 连续 <b>' + b.days_on + '</b> 天有涨停' : ''));
  }
  /* 弹窗③：② ETF 异动的一行（它指的板块今天的涨停票；没有板块就如实说） */
  function openEtfSx(x) {
    var o = x.board_code ? (hitsMap()[x.board_code] || null) : null;
    var f = [];
    if (x.up_pct != null) {
      f.push('当日 <b>' + (x.up_pct > 0 ? '+' : '') + x.up_pct.toFixed(2) + '%</b>');
    }
    if (x.red_days) f.push('连阳 <b>' + x.red_days + '</b> 天');
    if (o) {
      var list = boardStocks(o.code, o.alias_codes);
      if (o.alias && o.alias.length) f.push('含 ' + o.alias.join('、'));
      f.push('归入 <b>' + (o.own_n || 0) + '</b> 只');
      openSx(nameOf(o.code, o.name) + ' 今日涨停', stockList(list), f.join(' · '));
    } else {
      openSx((x.label || '') + ' 今日涨停',
        '<div class="empty">今天没有名字对得上的板块。</div>', f.join(' · '));
    }
  }

  /* 涨停板一行：**名称 · 涨停 N 只 · 涨幅 · 特征** ＋ 观察 ＋ 点开弹窗
     ⚠ **行内只许出现这四格**（2026-09-16 用户："你告诉我为什么要弄这个+5g，搞完都不对齐了，
     为什么别人没有，就他有"）——同类合并的别名**不进行**（进了就只有那一行多一格、整列不齐），
     想看合并了谁，点开弹窗里写「含 5G」。 */
  function boardRow(h) {
    var talk = (h.talk || {}).verdict === 'nodata' ? null : h.talk;
    var feat = [];
    /* 「最高」只在**真有连板**时写：归入的票全是首板时写"最高 首板"等于没说（用户："别写废话"） */
    if (h.cont_num && h.high) feat.push('最高 ' + esc(h.high));
    if (daysTxt(daysOf(h))) feat.push(daysTxt(daysOf(h)));
    if (talk && talk.talk_hits) feat.push('股吧 ' + talk.talk_hits + ' 帖');
    return '<div class="srow" data-code="' + esc(h.code) + '">' +
      '<div class="sline" data-sx="bd:' + esc(h.code) + '" title="点这一行看今天涨停的票">' +
        '<span class="sname">' + esc(h.name) + '</span>' +
        M('涨停', '<b>' + (h.own_n || 0) + '</b> 只', true) +
        M('涨幅', pctb(h.chg)) +
        '<span class="m feat"><i>特征</i><em>' + (feat.join(' · ') || '—') + '</em></span>' +
        /* ⚠ **「＋观察」按钮 2026-09-22 去掉**（用户："观察区删除" → 选了"按钮一起去掉"）。
           观察区那块已经不显示了，按钮加进去就是一个**再也看不到的清单**。
           箭头保留（点开弹窗看今天涨停的票），并靠右。 */
        '<span class="bact">' +
          '<span class="caret" data-sx="bd:' + esc(h.code) + '">▸</span>' +
        '</span>' +
      '</div>' +
    '</div>';
  }

  /* 新冒出：与涨停板同款一行（判据不同：今天刚进榜） */
  function newRow(n) {
    var feat = [];
    if (n.high) feat.push('最高 ' + esc(n.high));
    if (n.talk && n.talk.verdict !== 'nodata' && n.talk.talk_hits) {
      feat.push('股吧 ' + n.talk.talk_hits + ' 帖');
    }
    return '<div class="srow" data-code="' + esc(n.code) + '">' +
      '<div class="sline" data-sx="bd:' + esc(n.code) + '" title="点这一行看今天涨停的票">' +
        '<span class="sname">' + esc(n.name) + '</span>' +
        M('涨停', '<b>' + ((n.own_n || n.zt_num || 0)) + '</b> 只', true) +
        M('涨幅', pctb(n.chg)) +
        '<span class="m feat"><i>特征</i><em>' + (feat.join(' · ') || '—') + '</em></span>' +
        '<span class="bact">' +            /* ⚠ 「＋观察」按钮已去除（2026-09-22，同涨停板那行） */
          '<span class="caret" data-sx="bd:' + esc(n.code) + '">▸</span>' +
        '</span>' +
      '</div>' +
    '</div>';
  }

  /* 观察区：**折叠板块卡**（用户 2026-09-12：默认只给板块，数据点开再看）
     常显：色块 + 板块名 + 当日涨幅 + ETF（对应/替代 + 代码/名称/当日）
     点开：① 方向口径（涨停/连板/最高/连续在榜/形态①②）② **ETF 口径**（近10日/连涨/资金）
           ③ ETF 明细（档位/规模/跟踪度/走势证据）④ 题材基金
     ETF 档位（用户 2026-09-14 定的口径）：**对应** = 同一主题的场内 ETF（首选）；
     **替代** = 只是走势跟着走、**不是同一主题**（买不到对应品时的退路），鼠标停住看证据。 */
  function bcell(label, val, cls) {
    return '<div class="bcell">' + label + ' <b' + (cls ? ' class="' + cls + '"' : '') + '>' +
      val + '</b></div>';
  }

  function obsRow(o) {
    var h = index()[o.code];    var os = ownStats(h);          // 结构读数一律按**归入的票**算（v0.82，与涨停板卡同源）
    var s = (S.stats || {})[o.code];
    var del = '<button class="mini" data-del="' + esc(o.code) + '">移除</button>';
    if (!s) {
      /* 这个方向**不在同花顺当日的板块名单里**（从 ② ETF 异动 或历史里加进来的）：没有涨停结构读数，
         但**别让它点不动**（2026-09-15 用户："观察区和etf异动里面的板块点了没反应啊"）。
         ⚠ **必须写清"哪张名单、第几名、门槛多少家"**（2026-09-16 用户两轮：
         一版"今天没进 20 个热门方向"→"热门，热尼玛呢？是什么就写什么"；
         二版"同花顺今天没列它"→"同花顺在哪里没列到他？你感觉你这样写能让人获取到任何一点信息吗？"）。
         事实：**同花顺每天按涨停家数列出前 N 个板块**（N 与当日门槛在 `S.board_list` 里），
         这个方向不在其中 → 它今天的涨停家数没有达到门槛（我们因此拿不到它的涨停统计）。
         ⚠ **不口语化**：不写"没列它/没列到他"，写"未进…名单"。
         ⚠ **ETF 照给**（2026-09-15 用户："为什么军工和创新药没有etf？？昨天不是还有吗"）：
         原来 ETF 只从 `stats[code].etf` 取、而 stats 只覆盖当天被列出的方向 → 一掉出去就没 ETF。
         现在改读**全库对照表** `window.SECTOR_ETFS`（军工 512660、创新药 517380 一直都在库里）。 */
      var bl = S.board_list || {};
      /* ⚠ 措辞原则（2026-09-16 用户）：**只要一句结论**，别加"（当日门槛 10 家）"这种括号，
         门槛数挪进悬浮提示，行内不加括号。
         ★★ 2026-09-25 换源：**"未进前 20" 这个说法作废了**。
           换源前方向榜是同花顺给的、**每天恰好 20 个**，"前 20"是真门槛；
           现在 `sector_zt` 是**自算**的（当日有 ≥1 只涨停就上榜，每天 250~300 个），
           所以走到这一行的方向**不是因为排名不够，而是它当天根本没有涨停**。
           再说"未进前 20"会让用户以为"进了前 20 才算数" —— 那是旧口径的残留。 */
      var notListed = '当日该方向没有涨停';
      var notListedWhy = '方向榜是**全量**的：当日只要有 ≥1 只涨停就上榜（不再有「前 20」这条截断线）。' +
        '这个方向今天一只涨停都没有，所以没有涨停/连板统计（不是没有数据）。' +
        (bl.min_zt != null ? '（参考：当日最热的前 ' + (bl.n || 20) + ' 名，第 ' + (bl.n || 20) +
                             ' 名 ' + bl.min_zt + ' 家）' : '');
      var nm = nameOf(o.code, o.name);
      var isCode = (nm === o.code);
      var bs2 = (S.board_series || {})[o.code];
      var fe = (window.SECTOR_ETFS || {})[o.code] || null;
      var pe = (o.etf && (S.etfs || {})[o.etf]) || null;
      var se = fe ? ((S.etfs || {})[fe.code] || {}) : {};
      var shown2 = pe
        ? { code: pe.code, name: pe.name || o.etf_name, pct: pe.pct, kind: (fe && fe.kind), corr: (fe && fe.corr) }
        : (fe ? { code: fe.code, name: fe.name, pct: se.pct, kind: fe.kind, corr: fe.corr } : null);
      var tier2 = shown2 && shown2.kind;
      var etfLine2 = shown2
        ? '<span class="lab">ETF</span><span class="bcode">' + esc(shown2.code) + '</span>' +
          (tier2 === '替代' ? '<span class="tag warn">替代</span>'
                            : (tier2 === '对应' ? '<span class="tag hit">对应</span>' : '')) +
          '<span class="bsub' + (tier2 === '对应' ? ' yesetf' : '') + '"' +
            ' title="' + esc(etfEvidence({ kind: shown2.kind, corr: shown2.corr })) + '">' +
            esc((shown2.name || '').slice(0, 16)) + '</span>' +
          '<span class="bpct">' + (shown2.pct != null ? pct(shown2.pct) : '—') + '</span>'
        : '<span class="lab">ETF</span><span class="bsub">无配套 ETF</span>';
      var lines = ['<div class="brow"><span class="blab">指数线</span>' +
        (bs2
          ? '近10日 ' + (bs2.cum_pct != null ? ((bs2.cum_pct > 0 ? '+' : '') + bs2.cum_pct.toFixed(2) + '%') : '—') +
            '　连涨 <b>' + (bs2.up_days || 0) + '</b> 天' +
            (bs2.asof && S.generated && bs2.asof < S.generated
              ? '　<span class="dim">（该线到 ' + esc(bs2.asof) + '）</span>' : '')
          : '<span class="dim">本地还没有</span>') + '</div>'];
      lines.push('<div class="dsub">' + esc(notListed) + ' → 没有当日涨停/连板统计</div>');
      return '<div class="bcard">' +
        '<div class="bhead" data-etfchart="' + esc((shown2 && shown2.code) || '') + '"' +
          ' data-etfname="' + esc((shown2 && shown2.name) || '') + '"' +
          (shown2 ? ' title="点这张卡看 ' + esc(shown2.code) + ' 的走势（10/30/100 个交易日）"'
                  : ' title="点这张卡看指数线说明"') + '>' +
        '<span class="blk8 h0" title="' + esc(notListedWhy) + '"></span>' +
        '<div class="bmain">' +
          '<div class="bline"><span class="lab">板块</span>' +
            '<span class="bname">' + esc(nm) + '</span>' +
            (isCode ? '<span class="bcode">' + esc(o.code) + '</span>' : '') +
            '<span class="bpct dim" title="' + esc(notListedWhy) + '">' +
              esc(notListed) + '</span></div>' +
          '<div class="bline bline2' + (shown2 ? '' : ' none') + '">' + etfLine2 + '</div>' +
        '</div>' +
        '<span class="bact">' + del + '</span>' +
        '<span class="caret">▾</span></div>' +
        '<div class="sdetail" id="ob-' + esc(o.code) + '">' + lines.join('') + '</div></div>';
    }
    /* ⚠ 2026-09-25：原来这里是 `s.board` —— 而它和 `S.board_series[code]` 是
       **同一次调用产出的同一份数据**，20 天白运两遍（换源后方向涨到 719 个，
       sector.js 因此涨到 15.7 MB）。导出侧已删 `stats[].board`，这里改读全局那份。
       用到的字段只有 `cum_pct` 与 `up_days`（见下面 `idxCum`/`idxUp`）。 */
    var b = (S.board_series || {})[s.code], fd = s.fund;
    /* **你点的那只 ETF 优先**（用户 2026-09-12："既然我在这里选中，那么观察区的 ETF 就应该显示这个 ETF"）：
       从 ② ETF 异动 加进观察区时会记下 o.etf（例：512710 军工龙头ETF富国）；
       而 s.etf 是系统按名称+跟踪度+规模**优选**出来的那只（例：512660 军工ETF国泰）——两者常常不是同一只。
       ⚠ 你选了就以你的为准；没有 o.etf（比如从涨停板加进来的）才用系统优选的。 */
    var pick = (o.etf && (S.etfs || {})[o.etf]) || null;
    var pcan = ((((index()[o.code] || {}).etf || {}).cands) || [])
      .filter(function (x) { return x.code === o.etf; })[0] || null;
    var sysEtf = s.etf;
    var shown = pick || (sysEtf ? { code: sysEtf.code, name: sysEtf.name, pct: sysEtf.pct,
      cum_pct: (sysEtf.perf || {}).cum_pct, up_days: (sysEtf.perf || {}).up_days,
      net: (sysEtf.money || {}).net, net_pct: (sysEtf.money || {}).net_pct,
      amount: (sysEtf.money || {}).amount, scale: sysEtf.scale,
      /* ★ 交易所口径的净申赎（2026-09-22 起页面用这个当「资金」）：
         用户"板块本身就不要资金了，**看 etf 交易量就可以反推了**"。
         份额增减＝真实的申购/赎回，是一手数据；东财那套"主力/散户"对 ETF 本就牵强。 */
      flow_net: sysEtf.flow_net, flow_chg_pct: sysEtf.flow_chg_pct,
      flow_share_chg: sysEtf.flow_share_chg,
      flow_date: sysEtf.flow_date, flow_stale: sysEtf.flow_stale } : null);
    var pickMissing = !!(o.etf && !pick);            // 记了 ETF 但本次导出没有它的行情 → 如实说
    /* **ETF 档位**（用户 2026-09-14）：对应 = 同一主题的场内 ETF；替代 = 只是走势跟着走、
       **不是同一主题**。你从 ETF 异动点进来的那只用 pcan（候选记录）取档位，
       系统优选的那只用 sysEtf 取——两边都取不到就**不标**（不猜）。 */
    var tier = pick ? (pcan && pcan.kind) : (sysEtf && sysEtf.kind);
    var tierEv = etfEvidence(pick
      ? { kind: pcan && pcan.kind, corr: pcan && pcan.corr, resid: pcan && pcan.resid,
          same_dir: pcan && pcan.same_dir, beta: pcan && pcan.beta,
          cumdiff: pcan && pcan.cumdiff, amount20: pcan && pcan.amount20,
          scale: (pick.scale || (pcan && pcan.scale)) }
      : (sysEtf || {}));
    var tierTag = (tier === '替代') ? '<span class="tag warn">替代</span>'
                : (tier === '对应') ? '<span class="tag hit">对应</span>' : '';
    /* 第二行（ETF）：代码 · 名称 · 当日涨跌；没配套 ETF 时明说"无配套 ETF"，不静默留空 */
    var etfLine = shown
      ? '<span class="lab">ETF</span>' +
        '<span class="bcode">' + esc(shown.code) + '</span>' +
        tierTag +
        '<span class="bsub' + ((pick || (sysEtf && sysEtf.picked)) ? ' yesetf' : '') + '"' +
          (tierEv ? ' title="' + esc(tierEv) + '"' : '') + '>' +
          esc((shown.name || o.etf_name || '').slice(0, 16)) + '</span>' +
        '<span class="bpct">' + pct(shown.pct) + '</span>' +
        (pick ? '<span class="tag hit">你选的</span>' : '')
      : '<span class="lab">ETF</span><span class="bsub">' + (pickMissing
          ? '已记 ' + esc(o.etf_name || o.etf) + '（本次导出没有它的行情）' : '无配套 ETF') + '</span>';
    // 没有 ETF 时：**用指数口径兜底并标注**，否则强方向（如元件 +7.52%）会因为没 ETF 看着空白
    var idxCum = (b && b.cum_pct != null) ? b.cum_pct : null;
    var idxUp = (b && b.up_days) || 0;
    var hasEtf = !!(shown && shown.cum_pct != null);
    var cumPct = hasEtf ? shown.cum_pct : idxCum;
    var cumUp = hasEtf ? shown.up_days : idxUp;
    var cum = (cumPct != null)
      ? '<span class="' + (cumPct > 0 ? 'up' : (cumPct < 0 ? 'down' : 'dim')) + '">' +
        (cumPct > 0 ? '+' : '') + cumPct.toFixed(2) + '%</span>' +
        (hasEtf ? '' : '<span class="dim">指数</span>')
      : '<span class="dim">—</span>';
    /* ★ 2026-09-22 改口径：这一格原先是**东财的"主力净额"**（`shown.net`），现在改用
       **交易所口径的净申赎**（`flow_net` = 份额增减 × 收盘价）。用户原话：
       "**板块本身就不要资金了，看 etf 交易量就可以反推了**"。
       为什么换：ETF 是**申赎制**，份额增减＝真实的申购/赎回，是**一手数据**；
       而东财那套"主力/散户"大单分类对 ETF 本就牵强（通达信对 ETF 的资金流恒返回 0）。
       而且交易所数据**免费、无 key、不占东财那个最稀缺的窗口**。
       ⚠ 取不到就如实写「—」，**不回退**到旧口径 —— 两个口径不是一回事，混着显示更糟。 */
    /* ⚠ 交易所是 **T 日数据次日早 8:30 发布**，所以这一格拿到的常常是**上一个交易日**的份额 ——
       必须把实际日期标出来（"没取到"与"没有"要分开，默认它是当天就是糊弄）。
       只有真跟卡片同一天时才不标。 */
    var money = (shown && shown.flow_net != null)
      ? '<span class="' + ((shown.flow_net || 0) >= 0 ? 'up' : 'down') + '">' +
        ((shown.flow_net || 0) >= 0 ? '+' : '') + ((shown.flow_net || 0) / 1e8).toFixed(2) + ' 亿</span>' +
        (shown.flow_stale && shown.flow_date
          ? '<span class="dim"> ' + esc(String(shown.flow_date).slice(5)) + '</span>' : '')
      : '<span class="dim">—</span>';
    function etfOne(x, label, extra) {
      var ev2 = etfEvidence(x);
      return '<span class="blab">' + label + '</span>' + esc(x.code) + ' ' + esc(x.name || '') +
        (x.kind === '替代' ? '<span class="tag warn">替代</span>'
                           : (x.kind === '对应' ? '<span class="tag hit">对应</span>' : '')) +
        (x.scale ? '　规模 ' + (x.scale / 1e8).toFixed(1) + ' 亿' : '') +
        (x.corr != null ? '　跟踪度 ' + x.corr.toFixed(2) : '') +
        (x.picked ? '<span class="tag hit">优选</span>' : (x.corr != null ? '<span class="tag new">候选</span>' : '')) +
        (ev2 ? '<br><span class="dim">' + esc(ev2) + '</span>' : '') +
        (extra || '');
    }
    var etfRows = '';
    if (pick) {                                    // 你选的那只（含规模/跟踪度，若有）
      etfRows += '<div class="brow">' + etfOne({ code: pick.code, name: pick.name || o.etf_name,
        scale: pick.scale || (pcan && pcan.scale), corr: pcan && pcan.corr,
        picked: pcan && pcan.picked, kind: pcan && pcan.kind, resid: pcan && pcan.resid,
        same_dir: pcan && pcan.same_dir, beta: pcan && pcan.beta,
        cumdiff: pcan && pcan.cumdiff, amount20: pcan && pcan.amount20 }, '你选的 ETF') + '</div>';
    }
    if (sysEtf && (!pick || sysEtf.code !== pick.code)) {
      etfRows += '<div class="brow">' + etfOne({ code: sysEtf.code, name: sysEtf.name,
        scale: sysEtf.scale, corr: sysEtf.corr, picked: sysEtf.picked,
        kind: sysEtf.kind, resid: sysEtf.resid, same_dir: sysEtf.same_dir,
        beta: sysEtf.beta, cumdiff: sysEtf.cumdiff, amount20: sysEtf.amount20 },
        '系统优选') + '</div>';
    }
    if (!etfRows) {
      etfRows = '<div class="brow"><span class="blab">配套 ETF</span><span class="dim">无</span></div>';
    }
    return '<div class="bcard">' +
      /* **点这张卡 = 弹 ETF 走势折线图**（2026-09-15 用户："我点击展开的信息修改成一个悬空的折线图，
         是这个etf近10天，30天，100天的走势，是交易日的。跟情绪区一样可以切换。"）
         → 不再原地展开那张明细表；`data-etfchart` 带上要看的那只 ETF（你记的那只优先，否则系统对照表那只）。 */
      '<div class="bhead" data-etfchart="' + esc((shown && shown.code) || '') + '"' +
        ' data-etfname="' + esc((shown && shown.name) || '') + '"' +
        (shown ? ' title="点这张卡看 ' + esc(shown.code) + ' 的走势（10/30/100 个交易日）"' :
                 ' title="这个方向没有配套 ETF，点开看指数线说明"') + '>' +
      /* 两行：① 板块（锚点）② 实际要交易的那只 ETF（各带小标签，别让两个百分数混在一起） */
      '<span class="blk8 ' + heat(s.chg) + '" title="色块＝当日涨幅分档"></span>' +
      '<div class="bmain">' +
        '<div class="bline">' +
          '<span class="lab">板块</span>' +
          '<span class="bname">' + esc(s.name || o.name) + '</span>' +
          '<span class="bpct">' + pct(s.chg) + '</span>' +
        '</div>' +
        '<div class="bline bline2' + (shown ? '' : ' none') + '">' + etfLine + '</div>' +
      '</div>' +
      '<span class="bact">' + del + '</span>' +
      '<span class="caret">▾</span>' +
    '</div>' +
      '<div class="sdetail" id="ob-' + esc(o.code) + '">' +
        '<div class="dsub">方向口径（涨停结构）</div>' +
        '<div class="bgrid">' +
          // 不在当日涨停板里（从 ② 或历史加进来的）→ **没有归入数据，写「—」**，不拿 0 充数
          bcell('归入涨停股', h ? os.n + ' 只' : '—') +
          bcell('连板', h ? os.lian : '—') +
          bcell('最高', h ? esc(os.high) : '—') + bcell('连续有涨停', (s.days_on || 0) + ' 天') +
          bcell('形态①', h ? os.f1 : '—') + bcell('形态②', h ? os.f2 : '—') +
          bcell('连涨(指数)', ((b && b.up_days) || 0) + ' 天') +
          bcell('近10日(指数)', (b && b.cum_pct != null)
            ? ((b.cum_pct > 0 ? '+' : '') + b.cum_pct.toFixed(2) + '%') : '—') +
        '</div>' +
        '<div class="dsub">' + (hasEtf ? 'ETF 口径（实际交易的那个）'
                                       : '指数口径（无场内 ETF，仅参考）') + '</div>' +
        '<div class="bgrid">' +
          bcell('近10日', cum) + bcell('连涨', cumUp + ' 天') +
          bcell('净申赎', money) +
          bcell('份额变化', (shown && shown.flow_chg_pct != null) ? (shown.flow_chg_pct.toFixed(2) + '%') : '—') +
        '</div>' +
        etfRows +
        (fd ? '<div class="brow"><span class="blab">题材基金</span><span>' + esc(fd.code) + ' ' +
          esc(fd.name || '') + '</span>' +
          (fd.corr != null ? '<span class="snum dim">跟踪度' + fd.corr.toFixed(2) + '</span>' : '') +
          '</div>' : '') +
      '</div>' +
    '</div>';
  }

  /* 强弱色块：只按"当日板块涨幅"分档，档位写在图例里（不是把多项合成一个分） */
  function heat(chg) {
    if (chg == null) return 'h0';
    if (chg >= 3) return 'h4';
    if (chg >= 1) return 'h3';
    if (chg > 0) return 'h2';
    if (chg > -2) return 'h1';
    return 'h0';
  }

  function render() {
    var hits = S.hits || [], news = S.newcomers || [], obs = load();
    var b = S.breadth || {};

    var an = S.attr_n || {};
    /* 全市场兜底口径（b.all_n / b.all_max_lbc / b.off）：`stock_zt_daily` 只收录"概念落在
       当日方向榜里的"涨停股，实测比全市场名单少 13%，缺的里面含高板龙头 →
       页头必须给真实分母，否则"最高 N 板"是错的、"去重涨停 N 只"也不等于全市场。 */
    var allTxt = (b.all_n
      ? ' ｜ 全市场涨停 <b>' + b.all_n + '</b> 只' +
        (b.all_max_lbc && b.all_max_lbc > (b.max_lbc || 0)
          ? '（最高 <b>' + b.all_max_lbc + '</b> 板）' : '')
      : '');
    el('sHead').innerHTML =
      '<b>' + esc(S.generated || '—') + '</b> ｜ 涨停板 <b>' + hits.length + '</b> 个方向 ｜ ' +
      '新冒出 <b>' + news.length + '</b> ｜ 出头鸟 <b>' + (S.leaders || []).length + '</b> 只 ｜ ' +
      '去重涨停 <b>' + (b.stock_uniq || 0) + '</b> 只' +
      (an.stocks ? '（归入 <b>' + an.assigned + '</b>）' : '') +
      ' ｜ 最高 <b>' + (b.max_lbc || 0) + '</b> 板' + allTxt +
      '<span class="tagr">构建 ' + esc(S.build || '—') + '</span>';

    /* **「另外 N 只涨停不在今天的 20 个热门方向里」整块已删**（2026-09-16 用户："这些不要了。"）：
       数据仍在 `S.breadth.off` 里（`report_block.py` 也能查），只是不再铺在页面上。 */

    /* ⚠ **「观察区」渲染 2026-09-22 整段删除**（用户："还有观察区删除"）。
       卡和 `sObs`/`sObsCount` 两个容器都已从 `sector.html` 去掉 ——
       `el()` 就是 `document.getElementById`、**没有 null 保护**，留着这两个 id 的引用
       会被页面校验器判为"引用了不存在的 id"（真实浏览器会 null 报错、中断整页渲染）。
       ⚠ 用户圈定的清单**仍留在浏览器 localStorage** 里（`load()` 等几个函数保留、未删），
       数据也仍在 `S.observe` 里 —— 哪天要把观察区加回来，恢复 HTML + 这一段即可。 */

    /* ⚠ **卡尾什么都不写**（2026-09-16 用户：先是"我叫你别写废话，特么的听不懂吗"→我把括号删了 →
       用户再问"还有 24 个主题这种废话讲干什么？"）——**连"还有 N 个"都不要**。
       总数在页头那行已经有了（"涨停板 12 个方向"），卡里只铺前 5 行就够了；
       被截掉的条数仍在数据里（`board_more`/`new_more`/`leaders_more`/`etf_more`），只是不上页面。 */
    var bt = S.board_top || [];
    el('sCand').innerHTML = bt.length ? bt.map(boardRow).join('')
      : '<div class="empty">今日没有归入涨停股的方向。</div>';

    el('sNew').innerHTML = news.length ? news.map(newRow).join('')
      : '<div class="empty">今日无新冒出。</div>';

    /* 出头鸟：**前 5 个方向、只给概念胶囊**（名称 + 最高几板），点开弹窗看是哪几只票
       —— 2026-09-16 用户："出头鸟也只要前五个，只给我概念胶囊模样就行了，不要搞一堆废话，
       可以附上多少连扳还是多少天多少板。" ＋ "点开再显示信息。" */
    var lb = S.leaders_by_board || [];
    el('sLead').innerHTML = lb.length
      ? '<div class="chips">' + lb.map(function (b2) {
          return '<span class="chip" data-sx="ld:' + esc(b2.code) + '" title="点开看是哪几只票">' +
            '<b>' + esc(b2.name) + '</b><i>最高 ' + esc(b2.high || '—') + '</i>' +
            '<em>' + (b2.cont_num || 0) + ' 只</em></span>';
        }).join('') + '</div>'
      : '<div class="empty">今日无 ≥2 连板个股。</div>';
    /* ⚠ 「未归入板块的连板股」不在页面上铺（用户 2026-09-16："不要搞一堆废话"）：
       它仍在 `S.leaders_unassigned` 里，命令行 `report_block.py` 看得到（不静默丢失）。 */

    renderSignals();
    /* 口径长句**不上页面**（2026-09-14 用户："这句话别写了"）：仍留在 S.note 里备查 */
    el('sNote').textContent = '';
  }

  /* ② ETF 异动：**一个主题一行、两段**（上面＝最强的那只 ETF；下面＝它指的板块）
     —— 2026-09-16 用户："为什么有芯片通信了，下面还要再出现芯片通信呢，只要一次就够了。"
     ＋"每个板块要显式展示的数据有：板块或主题名称，今日涨停数量，今日主题或板块涨幅，有什么特征
     （连红多少天？）。…然后在这些上面的应该是你找出来的最强的etf，只要一个就行了。" */
  function renderSignals() {
    var g = S.signals || {};
    var list = g.rows || [];
    /* ⚠ 行结构**照抄观察区那张卡**（`.bcard/.bhead/.blk8/.bmain/.bline/.bact`）——
       2026-09-16 我第一版用两个 `.sline` 叠起来，两行挤在一起、左对齐还对不齐，用户：
       "你看看你的煞笔ui全缩成一团了。" 观察区那套本来就是用户认可的版式，直接复用。 */
    var rows = list.map(function (x) {
      var perf = (S.etfs || {})[x.code] || {};
      var up = (x.up_pct != null ? x.up_pct : perf.pct);
      /* ⚠ **「连红」改名「连阳」**（2026-09-22 用户）：口径是**连续 N 天 收 > 开**，
         但"连红"会被读成"连涨"。用户实测 `159030 粮食ETF华夏` 那天**对昨收是 −0.77%**
         却标着「连红 5 天」，以为是机制坏了 —— **机制没错，是词骗人**。
         用户定的处理："**改标签就行，机制别改**"（收>开 的口径是 2026-09-14 用户自己定的）。
         ⚠ 悬浮里把口径写清楚，行内不多一个字（项目惯例：解释放 `title`）。 */
      var tags = (x.up_pct != null ? '<span class="tag hit">≥3%</span>' : '') +
                 (x.red_days ? '<span class="tag new" title="连续 ' + x.red_days +
                   ' 天 收 > 开（日内收阳，不等于对昨收上涨）">连阳 ' + x.red_days + ' 天</span>' : '');
      var bn = x.board ? nameOf(x.board_code, x.board) : '';
      /* 下段＝它指的板块（名称 · 涨幅 · 今日涨停只数）；没有对得上的板块就如实说 */
      var l2 = bn
        ? '<span class="lab">板块</span><span class="bsub yesetf">' + esc(bn) + '</span>' +
          '<span class="bpct">' + pct(x.board_chg) + '</span>' +
          (x.board_own != null ? '<span class="snum dim">涨停 ' + x.board_own + ' 只</span>' : '')
        : '<span class="lab">板块</span><span class="bsub">没有对得上的板块</span>';
      return '<div class="bcard">' +
        '<div class="bhead" data-sx="em:' + esc(x.code) + '"' +
          ' title="点开看这个板块今天涨停的票">' +
          '<span class="blk8 ' + heat(up) + '" title="色块＝ETF 当日涨幅分档"></span>' +
          '<div class="bmain">' +
            '<div class="bline">' +
              '<span class="lab">ETF</span>' +
              '<span class="bname">' + esc((x.etf_name || '').slice(0, 18)) + '</span>' +
              '<span class="bcode">' + esc(x.code) + '</span>' +
              '<span class="bpct">' + pct(up) + '</span>' +
              tags +
            '</div>' +
            '<div class="bline bline2">' + l2 + '</div>' +
          '</div>' +
          '<span class="bact">' +
            /* ⚠ 「＋观察」按钮已去除（2026-09-22，同涨停板那行） */
            '<span class="caret">▸</span>' +
          '</span>' +
        '</div>' +
      '</div>';
    }).join('');
    /* 卡尾**不写"还有 N 个主题"**（2026-09-16 用户："还有 24 个主题这种废话讲干什么？"） */
    /* 历史日**不是"没有"、是"不取"**（② 只有当日快照，没有历史）——按项目规矩要明说 */
    var none = S.historical
      ? '<div class="empty">历史日不取（ETF 异动只有当日快照，不是"没有异动"）。</div>'
      : '<div class="empty">今日无。</div>';
    el('sE').innerHTML = rows || none;   // 卡片标题已写"② ETF 异动"，此处不再重复
    renderNewEtf();
  }

  /* 信号源⑥：**小卡按「大类」横排**（大类名 / 只数 / 最近上新日期），**点一张**才看
     具体是哪几只 ETF、各自属于哪个**小类**。
     ★ 2026-09-26 用户：「**这些 etf 肯定有归属的大类和小类啊，就像在板块观察那里。
     因此在新 etf 上新模块里，显示大类就行了，点击再展示具体的 etf 和对应的小类。**」
     ⚠ 分组只决定**怎么摆**、不决定**谁出现**：每只新 ETF 都被放进某个桶（归类对不上的
       落到「宽基/风格」或「未归类」），**一只都不丢** —— 那是上一轮踩过的坑。
     ⚠ 分组字段是导出侧算好的 `e.big`（`etf_grp` 那套归类），**不是**原来的同花顺方向。 */
  function renderNewEtf() {
    var ne = S.new_etf || [];
    if (!ne.length) {
      el('sN').innerHTML = '<div class="empty">近 60 天无新上市 ETF</div>';
      return;
    }
    var byb = {}, order = [];
    ne.forEach(function (e) {
      var k = e.big || '未归类';
      if (!byb[k]) { byb[k] = { big: k, etfs: [] }; order.push(k); }
      byb[k].etfs.push(e);
    });
    CHIP_GROUPS = order.map(function (k) { return byb[k]; }).sort(function (a, b) {
      return (b.etfs[0].listed || '').localeCompare(a.etfs[0].listed || '');
    });
    el('sN').innerHTML = '<div class="chips">' + CHIP_GROUPS.map(function (g) {
      return '<span class="chip" data-chip="' + esc(g.big) + '"' +
        ' title="点开看这个大类的哪几只 ETF 上新">' +
        '<b>' + esc(g.big) + '</b><i>' + esc((g.etfs[0].listed || '').slice(5)) + '</i>' +
        '<em>' + g.etfs.length + '</em></span>';
    }).join('') + '</div>';
  }

  function chipDetail(g) {
    return '<table class="stk"><tr><th>代码</th><th>名称</th><th>小类</th>' +
      '<th>上市日期</th><th>规模</th></tr>' +
      g.etfs.map(function (e) {
        return '<tr><td>' + esc(e.code) + '</td><td>' + esc(e.name) + '</td><td>' +
          esc(e.small || '—') + '</td><td>' + esc(e.listed || '—') + '</td><td>' +
          ((e.scale || 0) / 1e8).toFixed(2) + ' 亿</td></tr>';
      }).join('') + '</table>';
  }

  /* 点小卡：弹出该**大类**最近上市的新 ETF（含各自的小类） */
  function showChip(big) {
    var g = CHIP_GROUPS.filter(function (x) { return x.big === big; })[0];
    if (!g) return;
    openSx(big + ' · 最近上市的新 ETF', chipDetail(g), g.etfs.length + ' 只（上市 ≤ 60 天）');
  }

  /* ⚠ `copyText()`（复制命令到剪贴板）随「钉住」按钮一起去掉了（2026-09-15）：
     页面上已经没有"复制命令"这类交互——纯静态站点点了也写不了库，那种按钮只会误导。 */

  /* ===== ETF 走势小窗口（2026-09-15 用户要求）=====
     点观察区那张卡 → **悬空折线图**：该 ETF 近 10 / 30 / 100 个交易日的**收盘价**（交易日轴，不是自然日）。
     数据来自导出的 `window.ETF_SERIES`（本地 `etf_daily`，**不额外取数**）；切换按钮在面板右上角。
     刻度、轴线、网格与情绪区一套规格（看得清纵轴）。 */
  var EFN = 10, EFCODE = null, EFCHART = null, EFNODE = null;   // 默认 **10 个交易日**（用户 2026-09-15 要求）
  function etfSeries(code) {
    var D = window.ETF_SERIES || {};
    var arr = (D.close || {})[code];
    if (!arr) return null;
    return { dates: D.dates || [], close: arr };
  }
  function etfWindow(code) {
    var s = etfSeries(code);
    if (!s) return null;
    var k = Math.min(EFN, s.dates.length);
    var dd = s.dates.slice(-k), cc = s.close.slice(-k);
    /* **画的是百分比，不是价格**（2026-09-15 用户："看的是百分比啊，要比每个阶段的初始价格为基准，
       分别计算百分比。"）→ 每档各自以**该档第一个有行情的收盘价**为 0% 基准换算。 */
    var base = null;
    for (var i = 0; i < cc.length; i++) { if (cc[i] != null) { base = cc[i]; break; } }
    var pctArr = cc.map(function (x) { return (x == null || !base) ? null : (x / base - 1) * 100; });
    var real = pctArr.filter(function (x) { return x != null; });
    return { dates: dd, pct: pctArr, k: k, base: base, n: real.length,
             last: real.length ? real[real.length - 1] : null,
             tailNull: cc.length > 0 && cc[cc.length - 1] == null };
  }
  /* 面板结构**只建一次**（图表容器 + 一行说明）；切档只改说明文字并重画。
     ⚠ **不能每次切档都重建 innerHTML**：那样 `#etfMChart` 是**新节点**，而 ECharts 实例还绑在
     被删掉的旧节点上（`if (!EFCHART)` 又不会重新 init）→ 折线直接消失、且再也回不来
     （2026-09-15 用户报的就是这个："点到10就没折线了，然后点其他的折线也消失了"）。 */
  function etfModalHtml(code) {
    return '<div class="etfchart" id="etfMChart"></div><div class="srcnote" id="etfMSub"></div>' +
      '<div id="etfMFol">' + followHtml(code) + '</div>';
  }
  /* 「这个 ETF 在它的方向里，历史上跟得怎么样」——**同一方向的候选横向对比**
     （2026-09-17 接入；计算见 `pipeline/tools/etf_follow.py`，导出进 `S.follow`）

     ⚠ **只摆事实、不做推荐**：不排"最优"、不给星级、不写"该买哪只"。
       页面只回答"同一方向这几只历史上谁跟得紧"，选哪只是用户的事（系统定位：不指导）。
     ⚠ **样本门槛在导出侧**（放量日 < 5 次的方向根本不会出现在 `S.follow` 里）——
       2 次算出来的"超额"没有意义，宁可不显示。
     ⚠ **刻意不显示"累计偏离"**：那个数混着"等权板块指数 vs 市值加权 ETF"的权重方法差，
       会被误读成"这只 ETF 跟踪差"（详见 etf_follow.py 文件头）。 */
  function followOf(etfCode) {
    var F = S.follow || {};
    for (var d in F) {
      var rows = F[d] || [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].etf === etfCode) return { board: d, rows: rows, me: rows[i] };
      }
    }
    return null;
  }
  function followHtml(etfCode) {
    var f = followOf(etfCode);
    var meta = S.follow_meta || {};
    /* ⚠ **没有表时也要说一句话，不许静默留空**（2026-09-17 踩到）：
       这张表有两道闸门（方向指数线必须延伸到最新交易日、放量日 ≥5 次）。
       09-17 当天同花顺 K 线被熔断 → 18/20 个方向的线停在 09-15/16 → **整块表算不出来**
       → 页面上一片空白、不报错 —— 正是"东西没出现却没人发现"那类问题。
       现在按三种情况如实分说，让用户知道是"没有"还是"还没就绪"。 */
    if (!f) {
      return '<div class="srcnote">该方向不在「候选 ETF 跟随度」范围内' +
        (meta.held_n ? '（当日 ' + meta.held_n + ' 个方向因数据未就绪或样本不足未出表）' : '') +
        '。</div>';
    }
    if (!f.rows || f.rows.length < 2) {
      return '<div class="srcnote">该方向只有 1 只名称对得上的候选 ETF，没有可比项。</div>';
    }
    var rows = f.rows;
    return '<div class="dsub">同一方向的候选 ETF · 历史跟随度</div>' +
      '<table class="stk"><tr><th>代码</th><th>名称</th><th>档位</th>' +
      '<th class="rsn">放量日超额</th><th>相关性</th></tr>' +
      rows.map(function (r) {
        var me = (r.etf === etfCode);
        var exc = (r.exc == null) ? '—' : ((r.exc > 0 ? '+' : '') + (r.exc * 100).toFixed(2) + '%');
        var co = (r.corr == null) ? '—' : r.corr.toFixed(3);
        return '<tr' + (me ? ' class="folme"' : '') + '><td>' + esc(r.etf) + '</td>' +
          '<td>' + esc(r.name || '') + (me ? ' ←现在这只' : '') + '</td>' +
          '<td>' + esc(r.kind || '—') + '</td>' +
          '<td class="rsn">' + exc + '</td><td>' + co + '</td></tr>';
      }).join('') + '</table>' +
      '<div class="srcnote">放量日＝该方向涨停家数 > 前 3 日均值 ×' + (meta.surge_k || 1.5) +
      '；超额＝放量日 ETF 涨幅 − 方向涨幅的平均；回看 ' + (meta.window || 120) +
      ' 个交易日，共 ' + ((f.me && f.me.n_ev) || 0) + ' 次放量日（≥' + (meta.min_ev || 5) +
      ' 次才出表）。两者都是相对量，不代表这只 ETF 跟踪好坏。</div>';
  }
  function etfSubText(code) {
    var w = etfWindow(code);
    if (!w) return '本地还没有这只 ETF 的日线（下次跑「每日更新」会自动补）。';
    return '近 ' + w.k + ' 个交易日　' +
      (w.last == null ? '—' : ((w.last > 0 ? '+' : '') + w.last.toFixed(2) + '%')) +
      '（以该档首日收盘为 0%）　有效 ' + w.n + '/' + w.k + ' 天' +
      (w.tailNull ? '　（最新一天还没有行情）' : '');
  }
  function drawEtfChart(code) {
    var el2 = el('etfMChart');
    if (!el2 || !window.echarts) return;
    var w = etfWindow(code);
    if (!w) return;
    var dd = w.dates, pp = w.pct;                 // **百分比序列**（首日＝0%）
    var real = pp.filter(function (x) { return x != null; });
    var mn = real.length ? Math.min.apply(null, real) : 0;
    var mx = real.length ? Math.max.apply(null, real) : 0;
    mn = Math.min(mn, 0); mx = Math.max(mx, 0);   // 纵轴**必须含 0**（0＝该档基准）
    var span = (mx - mn) || 1;
    var t = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
    var step = t[t.length - 1];
    for (var i = 0; i < t.length; i++) { if (span / t[i] <= 6) { step = t[i]; break; } }
    /* 容器换了（首次画 / 面板重开）→ 旧实例作废、重新 init；同一容器则复用 */
    if (EFCHART && EFNODE !== el2 && EFCHART.dispose) { try { EFCHART.dispose(); } catch (e2) {} EFCHART = null; }
    if (!EFCHART) EFCHART = window.echarts.init(el2);
    EFNODE = el2;
    EFCHART.setOption({
      grid: { left: 4, right: 10, top: 12, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', formatter: function (ps) {
        var p = ps[0];
        return '<div>' + p.axisValue + '</div><div><b>' +
          (p.value == null ? '—' : ((p.value > 0 ? '+' : '') + Number(p.value).toFixed(2) + '%')) +
          '</b></div>';
      } },
      xAxis: { type: 'category', data: dd, axisLine: { lineStyle: { color: '#dee2e6' } },
        axisTick: { show: false },
        axisLabel: { show: true, color: '#868e96', fontSize: 10,
          interval: Math.max(0, Math.floor(dd.length / 5) - 1),
          formatter: function (v) { return String(v || '').slice(5); } } },
      yAxis: { type: 'value', min: +(Math.floor(mn / step) * step).toFixed(2),
        max: +(Math.ceil(mx / step) * step).toFixed(2), interval: step,
        axisLine: { show: true, lineStyle: { color: '#dee2e6' } },
        axisTick: { show: true, lineStyle: { color: '#dee2e6' } },
        splitLine: { lineStyle: { color: '#eef1f4' } },
        axisLabel: { color: '#868e96', fontSize: 11, margin: 6,
          formatter: function (v) { return v + '%'; } } },
      series: [{ name: code, type: 'line', data: pp, smooth: false, symbol: 'circle',
        symbolSize: 3, connectNulls: false, itemStyle: { color: '#1c7ed6' },
        lineStyle: { width: 1.7, color: '#1c7ed6' },
        /* 0% 基准线（该档首日）：画虚线、**不写字**（纵轴刻度上就有 0%） */
        markLine: { silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: '#b197fc', type: 'dashed', width: 1 }, data: [{ yAxis: 0 }] } }]
    }, true);
  }
  function renderEtfPanel() {
    if (!EFCODE) return;
    var sub = el('etfMSub');
    if (sub) sub.textContent = etfSubText(EFCODE);
    drawEtfChart(EFCODE);
  }
  function openEtfModal(code, name) {
    var m = el('etfModal');
    if (!m) return;
    EFCODE = code || null;
    el('etfMTitle').textContent = code ? ('走势　' + code + ' ' + (name || '')) : '走势';
    /* ⚠ **必须把 code 传下去**（2026-09-17 踩到）：`etfModalHtml()` 原来不接参数，
       而"同一方向候选对比"要靠这个 code 才能查出"现在看的是哪一只" →
       不传的话 `followHtml(undefined)` 恒返回空，整块表**静默不显示**（页面不报错）。 */
    el('etfMBody').innerHTML = code ? etfModalHtml(code)
      : '<div class="empty">这个方向没有配套 ETF，也没有可画的行情。</div>';
    if (code) EFCHART = null;             // 容器新建 → 实例作废，重画时重新 init
    m.classList.add('on');
    if (code) renderEtfPanel();           // 面板可见后再画，尺寸才对
  }
  function closeEtfModal() {
    var m = el('etfModal');
    if (m) m.classList.remove('on');
  }
  function setEfn(v) {
    EFN = v;
    [10, 30, 100].forEach(function (x) {
      var b = el('etf-s-' + x);
      if (b && b.classList) { if (x === v) b.classList.add('on'); else b.classList.remove('on'); }
    });
    renderEtfPanel();                     // 只改说明 + 重画，**不重建容器**
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      /* ⚠⚠ **动作按钮必须最先判**（2026-09-17 修 Bug：观察区「移除」点了没反应）。
         原因：观察区整张卡的 `.bhead` 上挂着 `data-etfchart`，而「移除」按钮**就在它里面**
         （`<div class="bhead" data-etfchart=…><span class="bact"><button data-del=…>`）。
         点击会冒泡到 `.bhead`，而原来的顺序是"先判卡片、后判按钮" → **卡片把点击抢走** →
         点「移除」变成**弹出 ETF 走势图**，永远删不掉。实测确认：点移除后 localStorage 条数不变、
         而 `etfModal` 被打开。同病的还有：② ETF 异动行里的 `+观察`（也在 `.bhead[data-etfchart]` 里）。
         → 判据：**带明确动作语义的属性（add/del/toggle/chip/sx/close）优先于"整块可点"的容器**。 */
      var act = t.closest('[data-add],[data-del],[data-toggle],[data-chip],[data-sx],[data-sxclose]');
      if (act) { t = act; }
      else {
        /* ETF 走势小窗口：关闭 / 切档 / 点观察区卡打开 */
        if (t.closest('[data-etfclose]')) { closeEtfModal(); return; }
        var nbtn = t.closest('[data-etfn]');
        if (nbtn) { setEfn(parseInt(nbtn.getAttribute('data-etfn'), 10) || 30); return; }
        var card = t.closest('[data-etfchart]');
        if (card) {
          openEtfModal(card.getAttribute('data-etfchart'), card.getAttribute('data-etfname'));
          return;
        }
        return;
      }
      /* ⚠ **按钮优先于行**：`closest` 从点击目标往上找，命中的第一个带这些属性的元素说了算
         （点 `+观察` 按钮时命中的是按钮本身，不会被整行的 `data-sx` 抢走） */
      if (!t) return;
      if (t.hasAttribute('data-sxclose')) {
        closeSx();
      } else if (t.hasAttribute('data-add')) {
        var code = t.getAttribute('data-add');
        var etf = t.getAttribute('data-etf') || null;
        var etfName = t.getAttribute('data-etfname') || null;
        var cur = load().filter(function (x) { return x.code === code; })[0];
        if (cur && etf && cur.etf !== etf) {
          // 已在观察区、但记的 ETF 不是这只（含"改版前加的、没记 ETF"）→ **改成这只**，不删
          save(load().map(function (x) {
            return x.code === code ? { code: code, name: x.name, added: x.added,
                                       etf: etf, etf_name: etfName } : x;
          }));
          render();
          return;
        }
        if (has(code)) { del(code); return; }
        var h = index()[code] || {};
        // 名字解析走 nameOf（当日榜 → 全库对照表 → 代码），**绝不把代码当名字存进去**
        add({ code: code, name: nameOf(code, h.name), added: S.generated,
              // ② ETF 异动 里点进来时，把**你点的那只 ETF** 一起记下来（观察区就显示它）
              etf: etf, etf_name: etfName });
      } else if (t.hasAttribute('data-chip')) {
        showChip(t.getAttribute('data-chip'));
      } else if (t.hasAttribute('data-del')) {
        del(t.getAttribute('data-del'));
      } else if (t.hasAttribute('data-toggle')) {
        var d = el(t.getAttribute('data-toggle'));
        if (d) d.classList.toggle('open');
      } else if (t.hasAttribute('data-sx')) {
        /* 明细**悬空弹窗**（2026-09-16 用户："点击展开的是要额外弹出来一个页面，而不是折叠展开"）：
           `bd:<方向>` = 该方向今日涨停的票；`ld:<方向>` = 出头鸟；`em:<ETF>` = ② 异动那一行 */
        var v = t.getAttribute('data-sx') || '';
        var kind = v.split(':')[0], cd = v.slice(kind.length + 1);
        if (kind === 'bd') {
          /* ⚠ **优先取"合并后那一行"**（`S.board_top`）：行上写的是"涨停 6 只"（同类合并、按股票去重），
             弹窗若只拿单条 `S.hits` 就只列 4 只 —— 两处数字对不上（2026-09-16 实测踩到）。 */
          var o = (S.board_top || []).filter(function (x) { return x.code === cd; })[0] ||
                  hitsMap()[cd] || index()[cd];
          if (o) openBoardSx(o);
        } else if (kind === 'ld') {
          var L = (S.leaders_by_board || []).filter(function (x) { return x.code === cd; })[0];
          if (L) openLeadSx(L);
        } else if (kind === 'em') {
          var E = ((S.signals || {}).rows || []).filter(function (x) { return x.code === cd; })[0];
          if (E) openEtfSx(E);
        }
      }
    });
    // 观察区**右键剔除**（需求文档 v0.44 定的交互；按钮也保留，两种都能用）
    document.addEventListener('contextmenu', function (e) {
      var row = e.target.closest ? e.target.closest('#sObs .srow[data-code]') : null;
      if (!row) return;
      e.preventDefault();
      var code = row.getAttribute('data-code');
      if (code && confirm('把这个板块从观察区移除？\n' + code)) del(code);
    });
  }

  if (!window.SECTOR_DATA && !window.SECTOR) {
    document.addEventListener('DOMContentLoaded', function () {
      var n = el('sHead');
      if (n) n.innerHTML = '<span class="warn">没有找到 data/sector.js —— 跑 python pipeline/export_sector.py 生成。</span>';
    });
    return;
  }
  document.addEventListener('DOMContentLoaded', function () {
    render();
    bind();
    bindDay();
    paintDayBar();
  });
})();
