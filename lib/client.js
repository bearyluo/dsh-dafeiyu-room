window.__ModuleLoader__.load({id:'dsh-dafeiyu-room',factory:(require)=>{
  const React=require('react'),{useState,useEffect,useRef}=React,h=React.createElement;
  const base='/plugins/dsh-dafeiyu-room/';
  const layoutKey='dsh-dafeiyu-room.camera-layout.v1';
  const viewport=()=>({width:window.visualViewport?.width||window.innerWidth,height:window.visualViewport?.height||window.innerHeight});
  const cameraSize=(view,preferred=480)=>{const width=Math.min(preferred,Math.max(1,view.width-16),Math.max(1,(view.height-16)*4/3));return {width,height:width*.75};};
  function clampPoint(point,width,height,view){
    return {x:Math.max(8,Math.min(view.width-width-8,point.x)),y:Math.max(8,Math.min(view.height-height-8,point.y))};
  }
  function fitLayout(value,view){const size=cameraSize(view,value.maximized?Infinity:value.width);return {...value,launcher:clampPoint(value.launcher,44,44,view),camera:value.maximized?{x:(view.width-size.width)/2,y:(view.height-size.height)/2}:clampPoint(value.camera,size.width,size.height,view)};}
  function loadLayout(){
    const view=viewport(),size=cameraSize(view);
    let value={open:false,width:480,maximized:false,launcher:{x:view.width-62,y:view.height-62},camera:{x:view.width-size.width-18,y:view.height-size.height-80}};
    try{
      const saved=JSON.parse(localStorage.getItem(layoutKey));
      if(saved&&typeof saved.open==='boolean'&&['camera','launcher'].every(key=>Number.isFinite(saved[key]?.x)&&Number.isFinite(saved[key]?.y)))value={...value,...saved,width:Number.isFinite(saved.width)?Math.max(240,Math.min(2400,saved.width)):480,maximized:saved.maximized===true};
    }catch{}
    return fitLayout(value,view);
  }
  function CameraDock(){
    const [layout,setLayout]=useState(loadLayout),[view,setView]=useState(viewport),[dragging,setDragging]=useState(null);
    const current=useRef(layout),drag=useRef(null),suppressClick=useRef(false),launcher=useRef(null);
    const size=cameraSize(view,layout.maximized?Infinity:layout.width);
    function commit(next,save=false){current.current=next;setLayout(next);if(save)try{localStorage.setItem(layoutKey,JSON.stringify(next));}catch{}}
    useEffect(()=>{
      const resize=()=>{const next=viewport();setView(next);commit(fitLayout(current.current,next),true);};
      window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};
    },[]);
    function begin(kind,event){
      if(event.button!==0||!event.isPrimary||drag.current)return;
      if(kind==='camera'&&current.current.maximized)return;
      if(kind==='resize')event.stopPropagation();
      suppressClick.current=false;
      drag.current={kind,id:event.pointerId,x:event.clientX,y:event.clientY,width:size.width,position:{...current.current[kind==='resize'?'camera':kind]},moved:false};
      event.currentTarget.setPointerCapture(event.pointerId);setDragging(kind);
    }
    function move(event){
      const gesture=drag.current;if(!gesture||gesture.id!==event.pointerId)return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(!gesture.moved&&Math.hypot(dx,dy)<5)return;
      gesture.moved=true;event.preventDefault();
      const currentView=viewport();
      if(gesture.kind==='resize'){
        const delta=(dx+dy*.75)/(1+.75*.75),width=Math.max(Math.min(240,cameraSize(currentView,Infinity).width),Math.min(2400,cameraSize(currentView,Infinity).width,gesture.width+delta));
        commit(fitLayout({...current.current,width,maximized:false},currentView));return;
      }
      const dimensions=gesture.kind==='camera'?cameraSize(currentView,current.current.width):{width:44,height:44};
      const point=clampPoint({x:gesture.position.x+dx,y:gesture.position.y+dy},dimensions.width,dimensions.height,currentView);
      commit({...current.current,[gesture.kind]:point});
    }
    function finish(event){
      const gesture=drag.current;if(!gesture||gesture.id!==event.pointerId)return;
      if(gesture.kind==='launcher')suppressClick.current=gesture.moved;
      drag.current=null;setDragging(null);commit(current.current,true);
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }
    function toggle(){commit({...current.current,open:!current.current.open},true);}
    function close(){commit({...current.current,open:false},true);launcher.current?.focus();}
    function maximize(){commit(fitLayout({...current.current,maximized:!current.current.maximized},viewport()),true);}
    function keyMove(kind,event){
      if(event.key==='Escape'&&current.current.open){event.preventDefault();close();return;}
      if(event.target!==event.currentTarget)return;
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!direction)return;
      event.preventDefault();const amount=event.shiftKey?30:10;
      if(kind==='resize'){commit(fitLayout({...current.current,width:Math.max(240,Math.min(2400,current.current.width+(direction[0]+direction[1])*amount)),maximized:false},viewport()),true);return;}
      const point=current.current[kind];
      commit(fitLayout({...current.current,[kind]:{x:point.x+direction[0]*amount,y:point.y+direction[1]*amount}},viewport()),true);
    }
    const events=kind=>({onPointerDown:event=>begin(kind,event),onPointerMove:move,onPointerUp:finish,onPointerCancel:finish,onLostPointerCapture:finish,onKeyDown:event=>keyMove(kind,event)});
    const fixed={position:'fixed',boxSizing:'border-box',touchAction:'none',userSelect:'none',WebkitUserSelect:'none'};
    return h(React.Fragment,null,
      h('style',null,'.dsh-room-launcher{border:0;background:var(--dsw-alias-button-floating-fill,#fff);color:var(--dsw-alias-label-secondary,#61666b);box-shadow:var(--dsw-elevation-panel,0 0 0 .5px #0002,0 3px 8px #00000008);border-radius:var(--dsw-radius-sm,8px);transition:background .15s,color .15s}.dsh-room-launcher:hover{background:var(--dsw-alias-button-floating-hover,#f1f3f5);color:var(--dsw-alias-label-primary,#0f1115)}.dsh-room-launcher[aria-expanded="true"]{background:var(--dsw-alias-button-ghost-active-fill,#ebeef2);color:var(--dsw-alias-label-primary,#0f1115)}.dsh-room-launcher:focus-visible,.dsh-room-camera:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4176e6);outline-offset:3px}.dsh-room-camera .dsh-room-close{opacity:0;transition:opacity .15s;background:var(--dsw-alias-button-floating-fill,#fff);color:var(--dsw-alias-label-secondary,#61666b);box-shadow:var(--dsw-elevation-stroke,0 0 0 .5px #0002)}.dsh-room-camera .dsh-room-close:hover{background:var(--dsw-alias-button-floating-hover,#f1f3f5);color:var(--dsw-alias-label-primary,#0f1115)}.dsh-room-camera:hover .dsh-room-close,.dsh-room-camera:focus-within .dsh-room-close{opacity:1}@media(hover:none){.dsh-room-camera .dsh-room-close{opacity:1}}@media(prefers-reduced-motion:reduce){.dsh-room-launcher,.dsh-room-camera .dsh-room-close{transition:none}}'),
      h('button',{...events('launcher'),ref:launcher,className:'dsh-room-launcher','aria-label':layout.open?'收起小屋摄像头':'打开小屋摄像头','aria-expanded':layout.open,'aria-controls':'dsh-room-camera',title:'小屋摄像头 · 拖动可移动入口',
        onClick:event=>{if(event.detail!==0&&suppressClick.current){suppressClick.current=false;return;}toggle();},
        style:{...fixed,left:layout.launcher.x,top:layout.launcher.y,width:44,height:44,zIndex:2147481999,display:'grid',placeItems:'center',cursor:dragging==='launcher'?'grabbing':'grab',padding:0}},
        h('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'none','aria-hidden':true},h('path',{d:'m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round',strokeLinejoin:'round'}))),
      layout.open?h('aside',{...events('camera'),id:'dsh-room-camera',className:'dsh-room-camera',role:'region','aria-label':'小屋摄像头浮窗',tabIndex:0,title:'拖动画面移动；右下角缩放；右上角放大；Esc收起',
        style:{...fixed,left:layout.camera.x,top:layout.camera.y,width:size.width,height:size.height,zIndex:2147482000,border:0,borderRadius:'var(--dsw-radius-sm,8px)',overflow:'hidden',background:'transparent',filter:'drop-shadow(0 2px 4px #00000024)',cursor:dragging==='camera'?'grabbing':'grab'}},
        h('iframe',{src:base,title:'大肥鱼的小屋实时画面',tabIndex:-1,style:{display:'block',width:'100%',height:'100%',border:0,background:'transparent',pointerEvents:'none'}}),
        h('div',{style:{position:'absolute',right:6,top:6,display:'flex',gap:4}},
          ...[[layout.maximized?'还原小屋窗口':'放大小屋窗口',layout.maximized?'↙':'⛶',maximize],['关闭小屋浮窗','×',close]].map(([label,icon,action])=>h('button',{key:label,className:'dsh-room-close','aria-label':label,title:label,onPointerDown:event=>event.stopPropagation(),onClick:action,style:{width:44,height:44,display:'grid',placeItems:'center',border:0,borderRadius:'var(--dsw-radius-sm,8px)',padding:0,fontSize:22,lineHeight:1,cursor:'pointer'}},icon))),
        !layout.maximized?h('button',{...events('resize'),className:'dsh-room-close','aria-label':'调整小屋窗口大小',title:'拖动缩放；方向键微调',style:{position:'absolute',right:0,bottom:0,width:44,height:44,border:0,borderRadius:8,fontSize:22,cursor:'nwse-resize',touchAction:'none'}},'◢'):null):null);
  }
  function HouseholdSettings(){
    const [settings,setSettings]=useState(null),[query,setQuery]=useState(''),[cities,setCities]=useState([]),[city,setCity]=useState(null),[zone,setZone]=useState('Asia/Shanghai'),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
    useEffect(()=>{const controller=new AbortController();fetch(base+'settings',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('无法读取小屋设置');return r.json();}).then(value=>{setSettings(value);setZone(value.timeZone);}).catch(error=>{if(error.name!=='AbortError')setNotice(error.message);});return()=>controller.abort();},[]);
    async function search(){
      setBusy(true);setNotice('正在寻找城市…');setCity(null);setCities([]);
      try{const response=await fetch(base+'locations?q='+encodeURIComponent(query),{signal:AbortSignal.timeout(15000)}),result=await response.json();if(!response.ok)throw Error(result.error);setCities(result.locations);setNotice(result.locations.length?'请选择匹配的城市。':'没找到，请试试城市英文名或附近城市。');}catch(error){setNotice(error.message);}finally{setBusy(false);}
    }
    async function save(){
      setBusy(true);
      try{
        const response=await fetch(base+'settings',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Settings-Token':settings.csrfToken},body:JSON.stringify({timeZone:zone,...(city?{location:city}:{})})}),result=await response.json();
        if(!response.ok)throw Error(result.error);setSettings(result.settings);setCity(null);setNotice('已保存，小屋会按所选城市更新天气。');
      }catch(error){setNotice(error.message);}finally{setBusy(false);}
    }
    return h('section',{style:{padding:'16px 0',borderTop:'1px solid #8884',marginTop:16}},
      h('h4',null,'小屋时间与天气'),
      h('p',null,settings?('当前天气城市：'+(settings.location.example?'示例 · ':'')+settings.location.name):'读取设置中…'),
      h('p',{style:{fontSize:12,opacity:.75}},'仅向 Open-Meteo 查询所选城市的公开天气。不会自动读取定位；聊天和记忆沿用大肥鱼。'),
      h('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},h('input',{'aria-label':'搜索天气城市',placeholder:'输入城市，如北京 / Shanghai',value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&!busy&&query.trim().length>=2){e.preventDefault();search();}},style:{padding:8,minWidth:200}}),h('button',{disabled:busy||query.trim().length<2,onClick:search},'搜索城市')),
      cities.length?h('div',{style:{display:'grid',gap:6,marginTop:10}},cities.map((item,index)=>h('button',{key:index,onClick:()=>{setCity(item);setZone(item.timeZone);},'aria-pressed':city===item,style:{textAlign:'left',padding:8,border:city===item?'2px solid #7e9b59':undefined}},item.name))):null,
      h('label',{style:{display:'block',marginTop:12}},'小屋时区 ',h('input',{'aria-label':'小屋时区',value:zone,onChange:e=>setZone(e.target.value),placeholder:'Asia/Shanghai',style:{padding:7}})),
      h('p',{style:{fontSize:12,opacity:.75}},'选择城市会带入当地时区，也可单独修改。屋内昼夜按此时区的时钟变化。'),
      h('button',{disabled:busy||!settings,onClick:save},busy?'处理中…':'保存小屋设置'),
      h('p',{role:'status',style:{fontSize:12}},notice),
      h('a',{href:'https://open-meteo.com/',target:'_blank',rel:'noreferrer',style:{fontSize:11}},'天气与城市数据：Open-Meteo'));
  }
  function RoomCamera(){
    return h('section',{style:{padding:16}},
      h('iframe',{src:base,title:'大肥鱼的小屋观察画面',style:{display:'block',width:'100%',height:'auto',maxWidth:720,aspectRatio:'4/3',border:0,background:'transparent'}}),
      h(HouseholdSettings));
  }
  function apply(ctx){
    for(const slot of ['plugins.bundle.config','settings.plugins.tab','settings.plugin.item']){
      ctx.slots.inject(slot,()=>{try{ctx.slots.register({name:slot,key:'dsh-dafeiyu-room',id:'dsh-dafeiyu-room',order:31,label:()=> '大肥鱼的小屋',inject:()=>({})},RoomCamera);}catch(error){console.warn('[dsh-dafeiyu-room] camera slot unavailable',error);}});
    }
    ctx.slots.inject('shell.overlay',()=>{try{
      ctx.slots.register({name:'shell.overlay',id:'dsh-dafeiyu-room-camera',order:1000},CameraDock);
    }catch(error){console.warn('[dsh-dafeiyu-room] camera overlay unavailable',error);}});
  }
  return {name:'dsh-dafeiyu-room-client',inject:['slots'],apply};
}});
