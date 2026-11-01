const copy=value=>JSON.parse(JSON.stringify(value));
const clamp=value=>Math.max(0,Math.min(100,value));
const receiptKey=event=>event.receipt_id||[event.plan_id,event.at,event.action].join(':');
export const defaultLocation={name:'北京',latitude:39.9042,longitude:116.4074,timeZone:'Asia/Shanghai',example:true};
export function checkSettings(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['location','timeZone'].includes(key)))throw Error('仅可设置天气城市和时区');
  const result={};
  if(value.timeZone!==undefined){
    if(typeof value.timeZone!=='string'||value.timeZone.length>80)throw Error('时区无效');
    try{new Intl.DateTimeFormat('zh-CN',{timeZone:value.timeZone}).format();}catch{throw Error('时区无效');}
    result.timeZone=value.timeZone;
  }
  if(value.location!==undefined){
    const location=value.location;
    if(!location||typeof location!=='object'||Object.keys(location).some(key=>!['name','latitude','longitude','timeZone','example'].includes(key))||typeof location.name!=='string'||!location.name.trim()||location.name.length>100||
      typeof location.latitude!=='number'||!Number.isFinite(location.latitude)||Math.abs(location.latitude)>90||typeof location.longitude!=='number'||!Number.isFinite(location.longitude)||Math.abs(location.longitude)>180)throw Error('城市信息无效');
    result.location={name:location.name.trim(),latitude:location.latitude,longitude:location.longitude,example:false};
    if(location.timeZone){checkSettings({timeZone:location.timeZone});result.location.timeZone=location.timeZone;}
  }
  return result;
}

/** Virtual household only: no chat text, role card, provider, or user memory. */
export class IndoorLife{
  constructor(saved=null,now=Date.now()){
    this.state=saved?copy(saved):{
      schema:1,updatedAt:now,settings:{location:{...defaultLocation},timeZone:'Asia/Shanghai'},
      needs:{energy:82,satiety:72,hydration:78},
      items:{ingredients:6,meals:2,cleanCups:3,dirtyCups:0,dirtyDishes:0},
      room:{lamp:true,curtains:'open',tidy:85,plantMoisture:70},
      phone:{received:0,read:0,replies:0,lastReceivedAt:null,lastReadAt:null,lastReplyAt:null,lastRepliedSequence:0,ids:[]},
      processed:[],work:{status:'idle',source:'host',calls:0,failures:0},alarms:[],scheduleAvailable:false,alarmRangAt:null
    };
    if(this.state.schema!==1)throw Error('不支持的屋内生活状态版本');
    this.pendingCalls=new Set();
    if(this.state.work.status==='working')this.state.work.status='interrupted';
    // Offline time advances the clock, not simulated meals, work or deprivation.
    this.state.updatedAt=now;
  }
  initializeReceipts(completed){this.state.processed=completed.map(receiptKey).slice(-96);}
  clock(now=Date.now()){
    const timeZone=this.state.settings.timeZone;
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(part=>[part.type,part.value]));
    const hour=Number(parts.hour),period=hour<6?'深夜':hour<10?'早晨':hour<17?'白天':hour<19?'傍晚':'夜晚';
    return {timeZone,date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute,hour,period,night:hour<6||hour>=18};
  }
  activityEffect(action,items){
    if(action==='cook'){
      if(items.ingredients<1)throw Error('储物柜里的食材不足，不能凭空准备饭菜');
      items.ingredients--;items.meals++;
    }
    if(action==='eat'){
      if(items.meals<1)throw Error('没有现成简餐，可以先cook准备');
      items.meals--;items.dirtyDishes++;
    }
    if(['tea','tea_bed','drink'].includes(action)){
      if(items.cleanCups<1)throw Error('没有干净杯子，可以先wash_dishes');
      items.cleanCups--;items.dirtyCups++;
    }
    if(action==='wash_dishes'){items.cleanCups+=items.dirtyCups;items.dirtyCups=0;items.dirtyDishes=0;}
  }
  validatePlan(steps){const items=copy(this.state.items);for(const step of steps)this.activityEffect(step.action,items);}
  message(id,now){
    const phone=this.state.phone;
    if(typeof id==='string'&&phone.ids.includes(id))return;
    if(typeof id==='string')phone.ids=[...phone.ids.slice(-63),id];
    phone.received++;phone.lastReceivedAt=now;
  }
  reply(now){
    const phone=this.state.phone;
    if(phone.received<=phone.lastRepliedSequence)return;
    phone.read=phone.received;phone.lastReadAt=now;phone.lastReplyAt=now;phone.replies++;phone.lastRepliedSequence=phone.received;
  }
  workStart(callId,now){
    if(this.pendingCalls.has(callId))return false;
    const started=this.state.work.status!=='working';
    if(started)this.state.work={status:'working',source:'host',calls:0,failures:0,startedAt:now};
    this.pendingCalls.add(callId);this.state.work.calls++;
    return started;
  }
  workResult(callId,isError){if(this.pendingCalls.delete(callId)&&isError)this.state.work.failures++;}
  workEnd(reason,now){
    if(this.state.work.status!=='working')return false;
    const kind=typeof reason==='string'?reason:reason?.kind;
    this.state.work.status=kind==='error'?'failed':['aborted','interrupted','forked'].includes(kind)?'interrupted':kind==='blocked'?'waiting':'finished';
    this.state.work.endedAt=now;this.pendingCalls.clear();return true;
  }
  setAlarms(records,agentId){
    this.state.scheduleAvailable=true;
    this.state.alarms=records.filter(record=>record.target?.kind!=='new'&&record.target?.sessionId===agentId&&record.status==='active').slice(0,8).map(record=>({id:record.id,title:record.title,scheduledAt:record.scheduledAt,kind:record.kind}));
  }
  tick(body,now){
    const s=this.state,hours=Math.max(0,Math.min(24,(now-s.updatedAt)/3600000));
    const sleeping=body.action==='sleep'&&(body.phase?.kind==='hold'||body.resting);
    s.needs.energy=clamp(s.needs.energy+hours*(sleeping?12:-2));
    s.needs.satiety=clamp(s.needs.satiety-hours*(sleeping?2:5));
    s.needs.hydration=clamp(s.needs.hydration-hours*(sleeping?3:7));
    s.room.plantMoisture=clamp(s.room.plantMoisture-hours*1.3);s.updatedAt=now;
    for(const event of body.completed){
      const key=receiptKey(event);if(s.processed.includes(key))continue;
      this.activityEffect(event.action,s.items);
      if(event.action==='eat'){s.needs.satiety=clamp(s.needs.satiety+40);s.needs.energy=clamp(s.needs.energy+5);s.room.tidy=clamp(s.room.tidy-8);}
      if(['tea','tea_bed','drink'].includes(event.action))s.needs.hydration=clamp(s.needs.hydration+35);
      if(event.action==='water')s.room.plantMoisture=clamp(s.room.plantMoisture+35);
      if(event.action==='tidy')s.room.tidy=100;
      if(event.action==='lamp_on')s.room.lamp=true;
      if(event.action==='lamp_off')s.room.lamp=false;
      if(event.action==='curtains_open')s.room.curtains='open';
      if(event.action==='curtains_close')s.room.curtains='closed';
      s.processed=[...s.processed.slice(-95),key];
    }
    if(['phone_bed','phone_table'].includes(body.action)&&body.phase?.kind==='hold'&&now-(s.phone.lastReceivedAt||now)>=800){s.phone.read=s.phone.received;s.phone.lastReadAt=now;}
  }
  observe(now){
    const s=this.state;
    return {clock:this.clock(now),needs:Object.fromEntries(Object.entries(s.needs).map(([key,value])=>[key,Math.round(value)])),
      items:{...s.items},room:{...s.room,plantMoisture:Math.round(s.room.plantMoisture)},
      phone:{unread:s.phone.received-s.phone.read,lastReceivedAt:s.phone.lastReceivedAt,lastReplyAt:s.phone.lastReplyAt},
      work:{...s.work},alarms:copy(s.alarms),scheduleAvailable:s.scheduleAvailable,alarmRangAt:s.alarmRangAt};
  }
}
