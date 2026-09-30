/* 全站顶栏的日期/版本注入；数据来自 site/data/version.js */
(function(){
  var v=window.SITEVER||{};
  var d=document.getElementById('hdrDate'), b=document.getElementById('hdrVer');
  if(d) d.textContent = v.date ? ' '+v.date : '';
  if(b) b.textContent = v.build ? ' · v'+v.build : '';
})();
