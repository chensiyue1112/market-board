/* m-select.js — 把手机端的原生 `<select>` 换成**可控的小米风格下拉**  2026-09-30 新建
   ─────────────────────────────────────────────────────────────────────────
   为什么：用户「我的手机是小米14，手机 ui 要符合小米浏览器的设计」。
   小米自带浏览器**强制渲染原生 `<select>`**，CSS 改不动它的箭头/高度/间距 ——
   用户在 `日知录记账` 里为此把全部原生控件重写成纯 div（其技术文档 §6.1）。
   这里照同一个思路做，但**不动现有 JS**：

     原生 `<select>` 依旧是**唯一状态源**（页面 JS 照旧 `sel.innerHTML=…` / `sel.value=…` / `sel.onchange=…`）
     ├─ 手机端由 `mobile.css` 把它藏起来（`select.m-hide`，只作用于 ≤680px）
     └─ 本脚本在它旁边画一个 `.msel`：点开＝自己的面板，选完 → 写回 `select.value` + **派发 `change`**
        → 页面原有的 `onchange` / `addEventListener('change')` 照常触发（**一行都不用改**）

   ⚠ 反向同步：页面自己的「前一天/后一天/最新」按钮是**直接改 `select.value`** 的，
     而按规范**程序化改 value 不触发 change** → 所以这里轮询一次 `value`，把标签拉回来。

   ⚠⚠ **必须在 `check_page.js` 的 stub DOM 下保持"什么都不做"**：
     那个校验器是在假 DOM 里跑页面脚本的，它只实现了极少数 API
     （`querySelectorAll` 只认 `button`）。所以这里**先取 `select` 列表、空就直接返回**，
     全部包在 try/catch 里 —— 适配层再怎么样也**不能把页面搞崩**。 */
(function () {
  "use strict";
  try {
    if (typeof document === "undefined" || !document.querySelectorAll ||
        !document.createElement || !document.body) return;
    var sels = document.querySelectorAll("select");
    if (!sels || !sels.length) return;          // ← stub 下 `querySelectorAll('select')` 返回空，就此收工

    var open = null;                            // 当前展开的 .msel

    function txt(sel) {
      var i = sel.selectedIndex;
      if (i >= 0 && sel.options && sel.options[i]) return sel.options[i].textContent;
      return sel.value || "—";
    }

    function close() {
      if (!open) return;
      var p = open.querySelector(".msel-panel");
      if (p && p.parentNode) p.parentNode.removeChild(p);
      open.classList.remove("open");
      open.setAttribute("aria-expanded", "false");
      open = null;
    }

    function build(sel, box) {
      var panel = document.createElement("div");
      panel.className = "msel-panel";
      panel.setAttribute("role", "listbox");
      var cur = sel.value;
      for (var i = 0; i < sel.options.length; i++) {
        (function (opt) {
          var it = document.createElement("div");
          it.className = "msel-opt" + (opt.value === cur ? " on" : "");
          it.setAttribute("role", "option");
          it.textContent = opt.textContent;
          if (opt.value === cur) {
            var t = document.createElement("span");
            t.className = "msel-tick";
            t.textContent = "✓";
            it.appendChild(t);
          }
          it.addEventListener("click", function (e) {
            e.stopPropagation();
            // ★ 写回原生控件 + 派发 change —— 页面原有逻辑（onchange/addEventListener）照常跑
            sel.value = opt.value;
            try {
              sel.dispatchEvent(new Event("change", { bubbles: true }));
            } catch (err) {
              var ev = document.createEvent("HTMLEvents");
              ev.initEvent("change", true, false);
              sel.dispatchEvent(ev);
            }
            close();
          });
          panel.appendChild(it);
        })(sel.options[i]);
      }
      return panel;
    }

    function make(sel) {
      var box = document.createElement("div");
      box.className = "msel";
      box.setAttribute("role", "button");
      box.setAttribute("aria-haspopup", "listbox");
      box.setAttribute("aria-expanded", "false");
      box.setAttribute("tabindex", "0");
      if (sel.getAttribute("aria-label")) box.setAttribute("aria-label", sel.getAttribute("aria-label"));
      var v = document.createElement("span");
      v.className = "msel-v";
      v.textContent = txt(sel);
      var a = document.createElement("i");
      a.className = "msel-a";
      a.textContent = "▾";
      box.appendChild(v);
      box.appendChild(a);
      box.addEventListener("click", function (e) {
        e.stopPropagation();
        if (box.disabled) return;
        if (open === box) { close(); return; }
        close();
        box.appendChild(build(sel, box));       // 每次展开**现读** options（页面随时会重填）
        box.classList.add("open");
        box.setAttribute("aria-expanded", "true");
        open = box;
      });
      box.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); box.click(); }
        else if (e.key === "Escape") close();
      });
      sel.classList.add("m-hide");             // 只让 mobile.css 在手机端藏它
      if (sel.parentNode) sel.parentNode.insertBefore(box, sel.nextSibling);

      // 反向同步：页面按钮直接改 sel.value（不触发 change）→ 轮询把标签拉回来
      var last = sel.value;
      setInterval(function () {
        if (sel.value !== last) {
          last = sel.value;
          v.textContent = txt(sel);
        }
      }, 250);
      return box;
    }

    for (var i = 0; i < sels.length; i++) {
      if (!sels[i].classList || sels[i].classList.contains("m-hide")) continue;
      make(sels[i]);
    }

    // 点空白关、滚动关、Esc 关
    document.addEventListener("click", function () { close(); });
    window.addEventListener("scroll", function () { close(); }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    /* ⚠ 桌面（>680px）时 `mobile.css` 不隐藏原生 select、`.msel` 也不显示（`.msel{display:none}`），
       所以这里**不需要**判断屏幕宽度、也不用监听 resize —— 由 CSS 决定谁出场。 */
  } catch (e) {
    /* 适配层出任何问题都不该影响页面：原生 select 仍在，功能不丢 */
  }
})();
