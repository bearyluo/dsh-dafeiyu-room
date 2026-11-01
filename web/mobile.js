'use strict';
const viewport=document.getElementById('viewport'),camera=document.getElementById('camera'),notice=document.getElementById('notice');
function message(text){notice.textContent=text;notice.hidden=!text;}
// The pairing secret never enters a query, Referer, cookie, or upstream request.
try{
  const key=new URLSearchParams(location.hash.slice(1)).get('key');
  if(key&&/^[\w-]{43}$/.test(key))sessionStorage.setItem('dsh-room-viewer-token',key);
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
}catch{message('浏览器禁止保存访问凭证，请允许此页面使用会话存储后重新打开链接。');}
camera.src='./';
let zoom=1,x=0,y=0,gesture=null;
const points=new Map();
function draw(){
  const w=viewport.clientWidth,h=viewport.clientHeight,fit=Math.min(w,h*4/3),width=fit*zoom,height=width*.75;
  x=Math.max(-Math.max(0,(width-w)/2),Math.min(Math.max(0,(width-w)/2),x));
  y=Math.max(-Math.max(0,(height-h)/2),Math.min(Math.max(0,(height-h)/2),y));
  Object.assign(camera.style,{width:width+'px',height:height+'px',left:((w-width)/2+x)+'px',top:((h-height)/2+y)+'px'});
  viewport.dataset.zoom=zoom.toFixed(2);document.getElementById('less').disabled=zoom<=1;document.getElementById('more').disabled=zoom>=3;
}
function scale(next){const previous=zoom;zoom=Math.max(1,Math.min(3,next));x*=zoom/previous;y*=zoom/previous;draw();}
document.getElementById('less').onclick=()=>scale(zoom-.25);
document.getElementById('more').onclick=()=>scale(zoom+.25);
document.getElementById('fit').onclick=()=>{zoom=1;x=y=0;draw();};
const full=document.getElementById('fullscreen');
if(!document.documentElement.requestFullscreen&&!document.documentElement.webkitRequestFullscreen){full.hidden=true;full.disabled=true;}
full.onclick=async()=>{try{
  if(document.fullscreenElement)await document.exitFullscreen();else if(document.webkitFullscreenElement)document.webkitExitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else document.documentElement.webkitRequestFullscreen();
}catch{message('当前浏览器不支持全屏，可横屏或放大查看。');}};
document.addEventListener('fullscreenchange',()=>{full.setAttribute('aria-label',document.fullscreenElement?'退出全屏':'全屏查看');draw();});
function start(){const values=[...points.values()];gesture=values.length===1?{x,y,start:values[0]}:values.length===2?{zoom,x,y,distance:Math.max(1,Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y))}:null;}
viewport.addEventListener('pointerdown',e=>{if(e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);start();});
viewport.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||!gesture)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});const values=[...points.values()];
  if(values.length===1&&gesture.start){x=gesture.x+e.clientX-gesture.start.x;y=gesture.y+e.clientY-gesture.start.y;draw();}
  else if(values.length===2&&gesture.distance){const ratio=Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y)/gesture.distance;zoom=Math.max(1,Math.min(3,gesture.zoom*ratio));x=gesture.x*zoom/gesture.zoom;y=gesture.y*zoom/gesture.zoom;draw();}
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(name,e=>{points.delete(e.pointerId);start();});
viewport.addEventListener('wheel',e=>{e.preventDefault();scale(zoom+(e.deltaY<0?.15:-.15));},{passive:false});
window.addEventListener('resize',()=>{points.clear();gesture=null;draw();});window.visualViewport?.addEventListener('resize',draw);draw();
