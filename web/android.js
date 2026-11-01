'use strict';
const open=document.getElementById('open'),status=document.getElementById('status');
if(location.protocol==='https:')document.getElementById('connection-note').textContent='外网连接：电脑和外网服务保持运行；免费域名可能过期或变化，需要重新连接。此链接只用于查看小屋。';
let key=new URLSearchParams(location.hash.slice(1)).get('key');
try{if(key&&/^[\w-]{43}$/.test(key))sessionStorage.setItem('dsh-room-viewer-token',key);else key=sessionStorage.getItem('dsh-room-viewer-token');if(location.hash)history.replaceState(null,'',location.pathname);}catch{}
if(!key||!(/^[\w-]{43}$/).test(key)){open.setAttribute('aria-disabled','true');status.textContent='请用电脑生成的完整连接或二维码打开此页。';}
else{
  const pairing=location.origin+location.pathname+'#key='+key;
  open.href='dafeiyuroom://connect?url='+encodeURIComponent(pairing);
  document.getElementById('browser').href='./mobile.html#key='+key;
}
