import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { IndoorLife,checkSettings } from './life.js';
import { WeatherService } from './weather.js';
const {RoomSimulation,validate}=createRequire(import.meta.url)('../web/simulation.cjs');
const pluginVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;

/** Owns only cabin physics, plans and wake-up accounting; never chat or memory. */
export class RoomRuntime {
  constructor({statePath,now=()=>Date.now(),idleMinutes=2,cooldownMinutes=10,maxDailyDecisions=12,weatherFetch=fetch}={}){
    for(const [value,min,max] of [[idleMinutes,1,60],[cooldownMinutes,5,120],[maxDailyDecisions,0,48]])if(!Number.isInteger(value)||value<min||value>max)throw Error('小屋活动额度设置无效');
    this.now=now;this.config={idleMinutes,cooldownMinutes,maxDailyDecisions};this.statePath=statePath;this.settingsToken=randomBytes(24).toString('hex');
    this.workLease=null;this.workPrevious=null;this.workSequence=0;
    this.connected=false;this.error=null;this.activeAgentId=null;this.lastUserAt=now();this.lastDecisionAt=0;this.usage={day:'',attempts:0};
    if(statePath){
      mkdirSync(dirname(statePath),{recursive:true});this.lockPath=statePath+'.lock';
      if(existsSync(this.lockPath)){
        const pid=Number(readFileSync(this.lockPath,'utf8'));
        let alive=true;try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}
        if(alive)throw Error('另一个宿主正在使用这份小屋状态');unlinkSync(this.lockPath);
      }
      const fd=openSync(this.lockPath,'wx');writeFileSync(fd,String(process.pid));closeSync(fd);
    }
    try{
      const saved=statePath&&existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):null;
      this.sim=new RoomSimulation(saved?.body,now());
      this.life=new IndoorLife(saved?.life,now());
      if(saved&&!saved.life)this.life.initializeReceipts(saved.body?.completed||[]);
      this.weather=new WeatherService({fetcher:weatherFetch,now,saved:saved?.weather});
      if(saved){this.lastDecisionAt=saved.lastDecisionAt||0;this.usage=saved.usage||this.usage;this.sim.resume(now());}
    }catch(error){this.close();throw error;}
  }
  select(agentId){
    if(this.activeAgentId&&this.activeAgentId!==agentId){
      this.advance();this.life.workEnd('interrupted',this.now());this.workLease=null;this.workPrevious=null;
      this.sim.submit([],{id:'session-switch:'+this.now()+':'+(++this.workSequence),agentId:this.activeAgentId,revision:this.sim.state.revision,now:this.now()});
      this.life.state.alarms=[];
    }
    this.activeAgentId=agentId;this.connected=true;
  }
  userActivity(agentId,messageId){this.select(agentId);this.lastUserAt=this.now();this.error=null;this.life.message(messageId,this.now());}
  assertAgent(agentId){if(!this.activeAgentId)this.select(agentId);if(agentId!==this.activeAgentId)throw Error('此房间属于当前主会话，其他会话不能控制身体');}
  advance(now=this.now()){
    // Integrate on actual phase boundaries: a fast-forward must not turn an
    // entire dinner/walk/sleep plan into hours of one final posture.
    for(let guard=0;guard<256;guard++){
      const phase=this.sim.state.phase,end=phase?Math.min(now,phase.startedAt+phase.duration):now;
      this.life.tick(this.sim.state,end);this.sim.tick(end);this.life.tick(this.sim.state,end);
      if(end>=now||!this.sim.state.phase)break;
    }
    this.life.tick(this.sim.state,now);this.sim.tick(now);this.life.tick(this.sim.state,now);
    if(this.workLease&&this.life.state.work.status==='working'&&!this.sim.state.plan&&this.sim.state.action==='computer'){
      this.workLease='host-work:'+now+':'+(++this.workSequence);
      this.sim.submit([{action:'computer',duration_seconds:600}],{id:this.workLease,agentId:this.activeAgentId,revision:this.sim.state.revision,now});
    }
    return this.sim.state;
  }
  plan(steps,identity){
    this.assertAgent(identity.agentId);const normalized=validate(steps);
    this.advance();
    if(!this.sim.state.receipts.some(receipt=>receipt.id===identity.id))this.life.validatePlan(normalized);
    const result=this.sim.submit(normalized,{...identity,now:this.now()});this.error=null;this.save();return result;
  }
  observe(){this.advance();return {...this.sim.observe(this.now()),life:this.life.observe(this.now()),weather:this.weather.view(this.life.state.settings.location)};}
  settings(){return {...JSON.parse(JSON.stringify(this.life.state.settings)),csrfToken:this.settingsToken};}
  updateSettings(value){const checked=checkSettings(value);Object.assign(this.life.state.settings,checked);if(checked.location)this.weather.invalidate();this.save();return {saved:true,settings:this.settings()};}
  async searchCities(query){return this.weather.search(query);}
  async refreshWeather(){return this.weather.refresh(this.life.state.settings.location);}
  startWork(callId){
    this.advance();if(!this.life.workStart(callId,this.now()))return;
    const body=this.sim.state;
    this.workPrevious=body.plan?body.plan.steps.slice(body.plan.index).map(step=>({...step})):[];
    if(body.phase?.kind==='hold'&&this.workPrevious.length)this.workPrevious[0].duration_seconds=Math.max(30,Math.ceil((body.phase.startedAt+body.phase.duration-this.now())/1000));
    this.workLease='host-work:'+this.now()+':'+(++this.workSequence);
    this.sim.submit([{action:'computer',duration_seconds:600}],{id:this.workLease,agentId:this.activeAgentId,revision:body.revision,now:this.now()});this.save();
  }
  endWork(reason){
    this.advance();if(!this.life.workEnd(reason,this.now()))return;
    if(this.sim.state.plan?.id===this.workLease){
      const steps=this.workPrevious?.length?this.workPrevious:[{action:'sit_chair',duration_seconds:30}];
      // Changed stock may invalidate a paused plan; resting is always safe.
      try{this.life.validatePlan(steps);this.sim.submit(steps,{id:'work-return:'+this.now()+':'+(++this.workSequence),agentId:this.activeAgentId,revision:this.sim.state.revision,now:this.now()});}
      catch{this.sim.submit([],{id:'work-rest:'+this.now()+':'+(++this.workSequence),agentId:this.activeAgentId,revision:this.sim.state.revision,now:this.now()});}
    }
    this.workLease=null;this.workPrevious=null;this.save();
  }
  environment(){
    const view=this.observe();
    return '你居住的小屋环境（沿用宿主原有身份、人格和记忆）。小屋状态供生活与动作决策，不是聊天回复的待播报内容。沟通规则：先自然回应用户当前的话，沿用宿主语气；不因这份环境注入就添加开场场景描写、动作旁白，或逐项复述天气、位置、灯窗、物品、吃喝需求。不要每轮都说手机亮了、刚看到消息或去查看消息。日常动作通过room_plan在画面中执行，无需在聊天里宣布或总结。仅当用户问起、与话题直接相关或确有提醒必要时提及相关细节，通常一句以内；用户明确要求场景描写时可以展开。这些规则只约束插件引入的小屋旁白，不改写角色卡或记忆，不限制正常问题的回答长度。房间布局：床在左上，窗在上方偏左，洗碗台紧贴上方挂锅的墙，灯开关在壁炉右侧的墙上，壁炉在上方偏右，书架在右上，书桌电脑在右侧，餐桌和食材在右下。画面角色是你在这个世界的身体，用户在另一边通过原聊天和你联系；手机提示对应实际收到的消息。由你自主决定看手机、吃喝、读书、整理、开关灯窗帘或睡觉，用户只观看。家具动作自动寻路，直接指定动作，不另用walk走进家具。sleep可以持续30秒到12小时，睡眠期间不会被日常空闲通知打断；普通聊天保留活动，你可以自主醒来回复。needs与食材均为虚拟生活状态，cook准备简餐、eat吃现成饭、wash_dishes洗净杯碗，不能凭空增加物品。真实文件/终端工具运行时，身体会自动去电脑前；坐在电脑前本身不等于完成工作。定时工作请用宿主schedule_create，按宿主工具当前公开的参数把任务投递到“当前会话”，闹钟仅显示真实任务；没有该工具时不要声称已设定。时间、天气以当前环境为准，示例城市不代表用户位置，过期或不可用天气不得当成实时实况。未提供的手机内容、书页、真实屏幕未知。\n小屋状态（供决策，无需逐项复述）：\n'+JSON.stringify(view);
  }
  snapshot(){this.advance();return {schema:1,pluginVersion,serverTime:this.now(),connected:this.connected,activeAgent:!!this.activeAgentId,error:this.error,body:this.sim.snapshot(this.now()),life:this.life.observe(this.now()),weather:this.weather.view(this.life.state.settings.location),autonomy:{...this.config,attempts:this.usage.attempts}};}
  canWake(agent){
    const now=this.now(),day=new Intl.DateTimeFormat('en-CA',{timeZone:this.life.state.settings.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    if(this.usage.day!==day)this.usage={day,attempts:0};
    return this.connected&&!this.error&&this.life.state.work.status!=='working'&&agent&&agent.id===this.activeAgentId&&agent.status==='idle'&&!this.sim.state.plan&&!this.sim.state.phase&&
      !agent.inbox.nextTurn.length&&!agent.inbox.nextStep.length&&this.usage.attempts<this.config.maxDailyDecisions&&
      now-this.lastUserAt>=this.config.idleMinutes*60000&&now-this.lastDecisionAt>=this.config.cooldownMinutes*60000;
  }
  claimWake(agent){if(!this.canWake(agent))return false;this.lastDecisionAt=this.now();this.usage.attempts++;this.save();return true;}
  save(){if(!this.statePath)return;this.advance();const temp=this.statePath+'.tmp';writeFileSync(temp,JSON.stringify({schema:1,body:this.sim.snapshot(this.now()),life:this.life.state,weather:this.weather.saved(),lastDecisionAt:this.lastDecisionAt,usage:this.usage}));renameSync(temp,this.statePath);}
  close(){this.weather?.close();if(this.lockPath&&existsSync(this.lockPath))unlinkSync(this.lockPath);this.lockPath=null;}
}
