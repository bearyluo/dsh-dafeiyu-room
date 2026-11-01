// Viewer-only fallback. It never writes a plan, advances needs, or calls an agent.
(function(host){
  'use strict';
  const motion=typeof module==='object'?require('./motion.cjs'):host.CabinMotion;
  function resting(previous=null,now=Date.now()){
    let timeZone=previous?.life?.clock?.timeZone||'Asia/Shanghai',parts;
    try{parts=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);}
    catch{timeZone='Asia/Shanghai';parts=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);}
    const get=kind=>parts.find(part=>part.type===kind)?.value,hour=Number(get('hour')),night=hour<6||hour>=18;
    const fixture=JSON.parse(JSON.stringify(motion.fixtures.sleep));
    return {schema:1,serverTime:now,connected:false,activeAgent:false,error:null,viewerRest:true,
      body:{schema:1,revision:0,position:{...fixture.point},direction:fixture.direction,pose:'lie',action:'sleep',fixture,prop:null,phase:null,queue:[],plan:null,completed:[],receipts:[],lastTick:now,resting:true},
      life:{clock:{timeZone,hour,time:get('hour')+':'+get('minute'),night,period:night?'夜晚':'白天'},room:{lamp:false,curtains:night?'closed':'open'},phone:{unread:0},work:{status:'offline'},alarms:[]},
      weather:{status:'unavailable',label:'天气未连接',city:previous?.weather?.city||'',example:previous?.weather?.example||false}};
  }
  const api={resting};if(typeof module==='object')module.exports=api;else host.CabinViewState=api;
})(typeof window==='object'?window:{});
