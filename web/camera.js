'use strict';
const canvas=document.getElementById('body'),ctx=canvas.getContext('2d');
const actor=document.getElementById('actor'),scene=document.getElementById('room-scene');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const atlases={},rows={sit_side:0,sit_right:0,sit_phone:1,sit_floor:2,look_window:3,sit_tea:4,sit_book:5,sit_eat:0,sit_prepare:0,sit_clean:0,sit_desk:2};
const house=document.getElementById('household').getContext('2d');
const front=document.getElementById('interactions').getContext('2d');
const cabin=new Image();
const cameraNotice=document.getElementById('camera-notice');
const scenery=new CabinEnvironment.Scenery(document.getElementById('environment'),document.getElementById('environment-weather'),scene,reduced);
let household=null;
let simulation=null,clockOffset=0,lastSnapshot=0,connected=false,polling=false,assetsReady=false,lastText='',drawKey='',viewerRest=false,lastLive=null;
function restView(reason='离线休息 · 本地画面'){
  const state=CabinViewState.resting(lastLive,Date.now());
  viewerRest=true;connected=false;household=state.life;
  clockOffset=state.serverTime-performance.now();lastSnapshot=state.serverTime;
  simulation=new CabinRuntime.RoomSimulation(state.body,state.serverTime);
  scenery.update(state);scene.classList.toggle('night',state.life.clock.night);scene.classList.add('lamp-off');
  scene.classList.toggle('curtains-closed',state.life.room.curtains==='closed');scene.dataset.weather='unknown';scene.dataset.source='offline-rest';
  scene.parentElement.dataset.period=CabinEnvironment.presentation(state.life.clock,state.weather).phase;
  scene.parentElement.dataset.weather='unknown';document.body.classList.add('offline');
  document.getElementById('signal').classList.remove('live');document.getElementById('connection-label').textContent=reason;
  document.getElementById('clock').textContent=state.life.clock.time;document.getElementById('daylight').textContent=state.life.clock.period;
  cameraNotice.hidden=false;cameraNotice.textContent=reason;scene.title=reason;
}
restView();
function frames(image,columns,edges){
  const cell=image.width/columns,scan=document.createElement('canvas');
  const c=scan.getContext('2d',{willReadFrequently:true}),result=[];
  for(let row=0;row<edges.length-1;row++){
    const top=Math.round(edges[row]),height=Math.round(edges[row+1])-top;
    scan.width=Math.ceil(cell);scan.height=height;
    for(let col=0;col<columns;col++){
      c.clearRect(0,0,scan.width,height);c.drawImage(image,col*cell,top,cell,height,0,0,cell,height);
      const registered=CabinSprite.registration(c.getImageData(0,0,scan.width,height).data,scan.width,height);
      result.push({...registered,x:col*cell+registered.left,y:top+registered.top});
    }
  }
  return result;
}
function load(name,file,columns,edges){return new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>{try{atlases[name]={image,crops:frames(image,columns,edges||Array.from({length:5},(_,i)=>i*image.height/4))};resolve();}catch(error){reject(error);}};image.onerror=reject;image.src='./assets/'+file;
});}
Promise.all([CabinHome.load(),load('walk','lo-walk.png',4),load('life','lo-life-v3.png',4,[0,255,498,712,995,1254,1536]),load('pose','lo-poses.png',3,[0,724]),new Promise((resolve,reject)=>{cabin.onload=resolve;cabin.onerror=reject;cabin.src='./assets/cabin-v2.png';})]).then(()=>{CabinHome.draw(document.getElementById('home-decor').getContext('2d'));const table=document.getElementById('table-cover').getContext('2d');table.drawImage(cabin,0,0);table.drawImage(document.getElementById('home-decor'),0,0);CabinHome.duvet(document.getElementById('bed-cover').getContext('2d'));assetsReady=true;scene.dataset.sprites='ready';}).catch(()=>{scene.dataset.sprites='error';cameraNotice.hidden=false;cameraNotice.textContent='角色画面加载失败，请重新打开';document.getElementById('activity').textContent=cameraNotice.textContent;});
function gesture(pose,time,resting){
  return CabinSprite.gesture(pose,time,resting,reduced.matches);
}
function body(pose,direction,time,walking,resting,alpha=1,offset=0){
  if(pose==='sit_back')pose='sit_desk';
  let atlas=atlases.walk,index=['down','left','right','up'].indexOf(direction)*4+(walking&&!reduced.matches?Math.floor(Math.max(0,time)/140)%4:0);
  if(Object.hasOwn(rows,pose)){atlas=atlases.life;index=rows[pose]*4+gesture(pose,time,resting);}
  else if(pose==='sit_back'||pose==='lie'){atlas=atlases.pose;index=pose==='lie'?(simulation?.state.action==='sleep'?2:0):1;}
  const crop=atlas.crops[index],reference=atlas===atlases.life?atlas.crops[rows[pose]*4+(['sit_floor','sit_desk'].includes(pose)?1:0)]:crop;
  const scale=atlas===atlases.life?0.2:atlas===atlases.pose?(pose==='lie'?48:50)/crop.height:54/Math.max(...atlas.crops.map(p=>p.height));
  const draw=(frame)=>{const d=CabinSprite.destination(frame,reference,scale,atlas===atlases.life);ctx.drawImage(atlas.image,frame.x,frame.y,frame.width,frame.height,Math.round(d.x),Math.round(d.y+offset),Math.round(d.width),Math.round(d.height));};
  ctx.save();ctx.globalAlpha=alpha;
  if(atlas===atlases.life&&direction==='left'){ctx.translate(48,0);ctx.scale(-1,1);}
  if(pose==='sit_desk'){
    // Keep the head/shoulders full size; fold the lap and hem into the seat.
    ctx.save();ctx.beginPath();ctx.rect(0,0,48,58);ctx.clip();draw(atlases.life.crops[12]);ctx.restore();
    ctx.save();ctx.translate(24,0);ctx.scale(0.5,1);ctx.translate(-24,0);
    ctx.save();ctx.beginPath();ctx.rect(0,58,48,6);ctx.clip();draw(atlases.life.crops[12]);ctx.restore();
    ctx.beginPath();ctx.rect(0,64,48,8);ctx.clip();draw(reference);ctx.restore();
  }else if(pose==='lie'){
    // Only the registered head/shoulders emerge above the real quilt; no tail or
    // skirt can leak around its sides. Waking uses the open-eyed pose.
    ctx.beginPath();ctx.rect(6,10,36,48);ctx.clip();draw(crop);
  }else if(atlas===atlases.life&&index%4!==0){
    const seam=['sit_floor','sit_desk'].includes(pose)?64:54;
    ctx.save();ctx.beginPath();ctx.rect(0,0,48,seam);ctx.clip();draw(crop);ctx.restore();
    ctx.beginPath();ctx.rect(0,seam,48,72-seam);ctx.clip();draw(reference);
  }else draw(crop);
  ctx.restore();
  return index;
}
function furnishings(s,time){
  house.clearRect(0,0,400,300);house.imageSmoothingEnabled=false;
  const rect=(x,y,w,h,color)=>{house.fillStyle=color;house.fillRect(x,y,w,h);};
  CabinHome.washstand(house);
  CabinHome.wallSwitch(house,household?.room?.lamp!==false);
  const wash=s.phase?.kind==='hold'&&s.action==='wash_dishes';
  if(household?.items?.dirtyCups&&!wash){rect(201,60,3,3,'#beb395');rect(202,60,2,1,'#6d4e36');}
  if(household?.items?.dirtyDishes&&!['eat','cook'].includes(s.action)){rect(296,221,11,2,'#b3a689');rect(298,220,7,1,'#8d704a');}
}
function interactions(s,time){
  front.clearRect(0,0,400,300);front.imageSmoothingEnabled=false;
  if(s.phase?.kind!=='hold')return;
  const x=s.position.x*4,y=s.position.y*3,t=reduced.matches?0:Math.max(0,time),action=s.action;
  // Props stay at their real surfaces. No synthetic limbs or skin-colored bridges.
  const rect=(x,y,w,h,color)=>{front.fillStyle=color;front.fillRect(Math.round(x),Math.round(y),w,h);};
  if(['cook','eat','tidy'].includes(action)){
    rect(292,209,17,19,'#9b6035');
    for(let i=0;i<6;i++){rect(292,211+i*3,17,1,i%2?'#b37743':'#86502c');rect(294+i%3,212+i*3,5,1,'#a96b3b');}
  }
  if(action==='water'){
    rect(x-16,y-18,8,6,'#344f4f');rect(x-15,y-17,6,4,'#8da8a1');
    rect(x-20,y-20,6,2,'#a7bbb0');rect(x-8,y-17,2,4,'#b4c5b8');
    const spout=[x-21,y-19],soil=[62,151];
    if(reduced.matches||Math.floor(t/2000)%3!==2){for(let i=0;i<5;i++){const p=((t/750+i/5)%1);rect(spout[0]+(soil[0]-spout[0])*p,spout[1]+(soil[1]-spout[1])*p,1,2,'#a8d6ce');}rect(61+Math.floor(t/170)%3,151,1,1,'#bfded1');}
  }
  if(action==='wash_dishes'){
    const basin=CabinMotion.washstand.basin,dx=reduced.matches?0:Math.round(Math.sin(t/500));
    // The character stands in front of the counter, facing away. Cups and
    // water belong behind her head/shoulders, never pasted across her hair.
    const wet=(x,y,w,h,color)=>{house.fillStyle=color;house.fillRect(Math.round(x),Math.round(y),w,h);};
    house.save();house.beginPath();house.rect(basin.x,basin.y,basin.width,basin.height);house.clip();
    wet(basin.x+2+dx,basin.y,4,3,'#e0d8ba');wet(basin.x+3+dx,basin.y+1,2,1,'#6d8d89');
    if(!reduced.matches){wet(basin.x+5,basin.y+Math.floor(t/180)%3,1,1,'#d7ece0');wet(basin.x+1+Math.floor(t/200)%7,basin.y+3,1,1,'#d8eee0');}
    house.restore();CabinHome.washRim(house);
  }
  if(action==='eat'){
    rect(293,219,12,2,'#604631');rect(294,217,10,3,'#dac7a6');rect(296,216,6,2,'#d4aa65');
    const bite=Math.floor(t/1200)%4;
    for(let i=0;i<4-bite;i++)rect(297+i,216,1,1,i%2?'#66864a':'#edcc8b');
    const lift=reduced.matches?0:Math.floor(t/600)%2;
    rect(302,216-lift,1,4,'#bac7bd');rect(301,215-lift,3,1,'#d6ddd0');
    if(Math.floor(t/650)%5===0)rect(300,211,1,3,'#e5dcc086');
  }
  if(action==='cook'){
    rect(294,211,14,9,'#5f432c');rect(295,212,12,6,'#ba9360');rect(296,213,10,1,'#d1ac72');
    for(let i=0;i<4;i++)rect(297+i*2,216,1,1,i%2?'#a3a55d':'#d88c4e');
    const chop=reduced.matches?0:Math.floor(t/450)%2;
    rect(302,212+chop,2,2,'#634d3d');rect(304,212+chop,1,4,'#c2c9bd');
  }
  if(action==='tidy'){
    const dx=reduced.matches?0:Math.round(Math.sin(t/600));
    rect(300+dx,213,5,3,'#628773');rect(301+dx,213,4,1,'#a8bea0');
    if(Math.floor(t/700)%3===0)rect(298,215,1,1,'#d2d2aa');
  }
  if(action==='computer'&&household?.work?.status==='working'){
    const key=reduced.matches?0:Math.floor(t/300)%3;
    house.fillStyle='#c6c9b5';house.fillRect(325+key*2,141,1,1);
  }

}

function render(now){
  requestAnimationFrame(render);
  if(document.visibilityState!=='hidden')scenery.draw(now);
  if(!simulation||!assetsReady||document.visibilityState==='hidden')return;
  const at=connected||viewerRest?now+clockOffset:lastSnapshot,s=simulation.tick(at),phase=s.phase;
  const p=phase?Math.max(0,Math.min(1,(at-phase.startedAt)/phase.duration)):1;
  const walking=phase&&['walk','exit'].includes(phase.kind);
  const time=phase?at-phase.startedAt:at;
  actor.style.left=s.position.x+'%';actor.style.top=s.position.y+'%';
  actor.dataset.phase=phase?.kind||'resting';actor.dataset.posture=s.pose;
  // Reuse the original full-resolution furniture layer so the table and plant
  // occlude legs without resampling a separate canvas cutout out of alignment.
  document.getElementById('table-cover').hidden=!(s.pose==='stand'&&s.position.x>=72&&s.position.x<=81&&s.position.y>=68&&s.position.y<=78);
  const lifeTime=phase?.kind==='hold'?time:at;
  furnishings(s,lifeTime);
  interactions(s,lifeTime);
  const holding=phase?.kind==='hold';
  const sleeping=s.action==='sleep'&&(holding||viewerRest);
  scene.classList.toggle('sleeping',sleeping);scene.classList.toggle('message-waiting',!!household?.phone?.unread);
  const sleepCue=document.getElementById('sleep-cue'),phoneCue=document.getElementById('phone-cue');
  sleepCue.style.left=(s.position.x+3)+'%';sleepCue.style.top=(s.position.y-11)+'%';
  phoneCue.style.left=(s.position.x+3)+'%';phoneCue.style.top=(s.position.y-(sleeping?3:12))+'%';
  const key=[s.pose,s.direction,walking?Math.floor(time/140):Math.floor(lifeTime/100),phase?.kind,p.toFixed(2),s.resting].join(':');
  if(key!==drawKey){
    drawKey=key;ctx.clearRect(0,0,48,72);ctx.imageSmoothingEnabled=false;
    if(phase?.fromPose&&phase?.toPose&&phase.fromPose!==phase.toPose&&!reduced.matches){
      // Four crisp key poses keep pixel edges solid instead of ghosting sprites.
      const frame=Math.min(3,Math.floor(p*4));
      body(frame<2?phase.fromPose:phase.toPose,s.direction,0,false,true);
    }else body(s.pose,s.direction,lifeTime,walking,s.resting);
    ctx.globalAlpha=1;actor.dataset.gestureFrame=String(gesture(s.pose,lifeTime,s.resting));
  }
  const lying=s.pose==='lie'||phase?.kind==='mount'&&phase.toPose==='lie'&&p>.6;
  scene.classList.toggle('lying',lying);
  document.getElementById('bed-cover').style.display=lying?'block':'none';
  const restingLabels={lie_bed:'醒着躺在床上',sit_bed:'在床沿歇一会儿',phone_bed:'侧坐床沿歇一会儿',read_bed:'合上书歇一会儿',tea_bed:'在床沿歇一会儿',computer:'坐在电脑前歇一会儿',fireplace:'在炉火边歇一会儿'};
  const text=viewerRest?'离线休息 · 本地睡眠画面':s.action==='computer'&&holding&&household?.work?.status==='working'?'在电脑前处理你交代的工作':phase?.label||(restingLabels[s.action]||'原地歇一会儿');
  if(text!==lastText){document.getElementById('activity').textContent=text;scene.setAttribute('aria-label','大肥鱼的小屋：'+text);lastText=text;}
}
requestAnimationFrame(render);
async function refresh(){
  if(polling||document.visibilityState==='hidden')return;polling=true;
  try{
    let token='';try{token=sessionStorage.getItem('dsh-room-viewer-token')||'';}catch{}
    const started=Date.now(),response=await fetch('./state',{cache:'no-store',headers:token?{'Authorization':'Bearer '+token}:{},signal:AbortSignal.timeout(5000)});
    if(response.status===401)throw Error('pairing');
    if(!response.ok)throw Error('offline');const state=await response.json();
    if(state.schema!==1||!state.body)throw Error('bad state');
    lastLive=state;
    if(!state.connected&&!state.preview){restView('主会话离线 · 本地休息画面');return;}
    viewerRest=false;
    clockOffset=state.serverTime+Math.min(500,(Date.now()-started)/2)-performance.now();lastSnapshot=state.serverTime;
    simulation=new CabinRuntime.RoomSimulation(state.body,state.serverTime);connected=true;
    household=state.life||null;
    scenery.update(state);
    scene.parentElement.dataset.period=CabinEnvironment.presentation(household?.clock,state.weather).phase;
    scene.parentElement.dataset.weather=state.weather?.status==='live'?state.weather.kind:'unknown';
    document.getElementById('signal').classList.toggle('live',state.connected);
    document.getElementById('connection-label').textContent=state.preview?'动画验收':state.connected?'大肥鱼主会话已连接':'等待大肥鱼主会话';
    document.getElementById('preview-label').hidden=!state.preview;
    document.getElementById('preview-label').textContent=state.previewScenery?'场景验收 · 演示时间天气':'动画验收 · 演示轨迹';
    const date=new Date(state.serverTime),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(date));
    const night=household?.clock?.night??(hour<6||hour>=18);scene.classList.toggle('night',night);
    document.getElementById('clock').textContent=household?.clock?.time||new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
    document.getElementById('daylight').textContent=household?.clock?.period||(night?'夜晚':'白天');
    scene.classList.toggle('lamp-off',household?.room?.lamp===false);scene.classList.toggle('curtains-closed',household?.room?.curtains==='closed');
    scene.dataset.weather=state.weather?.status==='live'?state.weather.kind:'unknown';
    const needs=household?.needs,items=household?.items;
    document.getElementById('life-note').textContent=needs?[(needs.energy<25?'困得想睡':needs.energy<50?'有些困':'精神不错'),needs.satiety<35?'肚子饿了':needs.satiety<60?'有些饿':'吃饱了',needs.hydration<35?'想喝水':null,items?'备有 '+items.meals+' 份简餐':null].filter(Boolean).join(' · '):'';
    const phone=household?.phone,alarm=household?.alarms?.filter(a=>a.scheduledAt).sort((a,b)=>Date.parse(a.scheduledAt)-Date.parse(b.scheduledAt))[0];
    const work=household?.work;
    const workNote=work?.status==='working'?'正在电脑前工作':work?.status==='failed'?'这次工作遇到了错误':work?.status==='waiting'?'工作等待主会话处理':work?.status==='interrupted'?'上次工作已中断':work?.status==='finished'?(work.failures?'工作回合已结束，有工具报错':'工作回合已结束'):null;
    let alarmNote=null;if(alarm){try{alarmNote='闹钟 '+new Intl.DateTimeFormat('zh-CN',{timeZone:household.clock.timeZone,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(alarm.scheduledAt));}catch{alarmNote='已安排闹钟';}}
    const ringing=household?.alarmRangAt&&state.serverTime-household.alarmRangAt<15000;
    document.getElementById('phone-note').textContent=[phone?.unread?'手机有 '+phone.unread+' 条新消息':phone?.lastReplyAt?'最近一条消息已回复':'手机安静着',workNote,ringing?'闹钟响了':alarmNote].filter(Boolean).join(' · ');
    const weather=state.weather;
    document.getElementById('weather-note').textContent=weather?(weather.example?'示例城市 · ':'')+weather.city+' · '+weather.label+(weather.status==='live'?' '+Math.round(weather.temperature)+'°C':''):'';
    scene.dataset.source=state.preview?'acceptance':state.connected?'dsh':'waiting';
    if(state.error){document.getElementById('connection-label').textContent='活动暂停 · 等待主会话';}
    if(scene.dataset.sprites!=='error'){cameraNotice.hidden=!state.error;cameraNotice.textContent=state.error?'活动暂停 · 等待主会话':'';}
    scene.title=[document.getElementById('connection-label').textContent,household?.clock?.time,document.getElementById('weather-note').textContent].filter(Boolean).join(' · ');
    document.body.classList.remove('offline');
  }catch(error){restView(error.message==='pairing'?'连接需要重新配对 · 本地休息画面':'连接已断开 · 本地休息画面');}
  finally{polling=false;}
}
refresh();setInterval(refresh,1000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
