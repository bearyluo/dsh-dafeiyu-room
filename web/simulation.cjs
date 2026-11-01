(function(host){
  'use strict';
  const motion=typeof module==='object'?require('./motion.cjs'):host.CabinMotion;
  const props={phone_bed:'手机',phone_table:'手机',read_bed:'书',tea:'茶杯',tea_bed:'茶杯',drink:'水杯',eat:'餐碗和勺子',cook:'食材',tidy:'抹布',wash_dishes:'杯碗',water:'浇水壶'};
  const quick=new Set(['lamp_on','lamp_off','curtains_open','curtains_close']);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const same=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<.001;
  const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*.75);
  const actions={stand:'在地板上站立',walk:'走到空地',...Object.fromEntries(Object.entries(motion.fixtures).map(([key,v])=>[key,v.label]))};
  function validate(steps){
    if(!Array.isArray(steps)||steps.length>6)throw Error('计划最多六步');
    return steps.map(step=>{
      if(!step||typeof step!=='object'||Array.isArray(step)||Object.keys(step).some(k=>!['action','duration_seconds','x','y'].includes(k)))throw Error('活动格式无效');
      if(!Object.hasOwn(actions,step.action))throw Error('未知的小屋动作');
      const duration=step.duration_seconds??(quick.has(step.action)?3:step.action==='sleep'?3600:120);
      const minimum=quick.has(step.action)?1:30,maximum=step.action==='sleep'?43200:600;
      if(!Number.isInteger(duration)||duration<minimum||duration>maximum)throw Error('停留时间无效：普通活动30–600秒，开关操作1–600秒，睡眠30–43200秒');
      const result={action:step.action,duration_seconds:duration};
      if(step.action==='walk'){
        if(!motion.walkable({x:step.x,y:step.y}))throw Error('目标不在可行走地板上');
        result.x=step.x;result.y=step.y;
      }else if('x'in step||'y'in step)throw Error('家具动作不能指定坐标');
      return result;
    });
  }
  class RoomSimulation {
    constructor(saved=null,now=Date.now()){
      this.state=saved?copy(saved):{schema:1,revision:0,position:{...motion.anchors.room},direction:'down',pose:'stand',action:'stand',fixture:null,prop:null,phase:null,queue:[],plan:null,completed:[],receipts:[],lastTick:now,resting:true};
      if(this.state.schema!==1)throw Error('不支持的房间状态版本');
    }
    resume(now){
      // A stopped host does not invent completed activities while offline.
      if(this.state.phase)this.state.phase.startedAt+=Math.max(0,now-this.state.lastTick);
      this.state.lastTick=now;
      // Re-register saved stationary poses when furniture/art has been corrected.
      const s=this.state,fixture=motion.fixtures[s.action];
      if(fixture&&(!s.phase||s.phase.kind==='hold')){
        Object.assign(s,{position:copy(fixture.point),fixture:copy(fixture),pose:fixture.pose,direction:fixture.direction});
        if(s.phase)Object.assign(s.phase,{from:copy(fixture.point),to:copy(fixture.point),patch:{...s.phase.patch,fixture:copy(fixture),pose:fixture.pose,direction:fixture.direction}});
      }
    }
    submit(steps,{id,agentId,revision,now=Date.now()}={}){
      const normalized=validate(steps);
      if(typeof id!=='string'||!id||id.length>200)throw Error('缺少动作调用编号');
      const old=this.state.receipts.find(r=>r.id===id);
      if(old){if(JSON.stringify(old.steps)!==JSON.stringify(normalized))throw Error('调用编号已用于其他计划');return copy(old);}
      this.tick(now);
      if(revision!==this.state.revision)throw Error('房间状态已变化，请重新观察后安排');
      // An interrupted mount/exit retains a safe aisle target.
      const exit=this.state.phase?.exit||this.state.fixture?.approach||null;
      this.state.queue=[];this.state.phase=null;
      this.state.revision++;this.state.resting=false;
      this.state.plan={id,agentId,steps:normalized,index:0,exit};
      if(!normalized.length){
        const s=this.state,origin={...s.position};s.plan=null;
        if(s.prop)this.phase('put_down','收好'+s.prop,650,origin,{prop:null});
        if(s.pose!=='stand')this.phase('rise','起身',420,origin,{pose:'stand',prop:null},{fromPose:s.pose,toPose:'stand',exit});
        if(exit&&!same(origin,exit))this.phase('exit','回到家具旁的地板',Math.max(320,distance(origin,exit)/11*1000),exit,{fixture:null,pose:'stand',action:'stand'},{exit});
        else if(s.queue.length)s.queue.at(-1).patch={...s.queue.at(-1).patch,fixture:null,pose:'stand',action:'stand'};
        else Object.assign(s,{fixture:null,pose:'stand',action:'stand'});
        this.next(now);
      }
      else this.startStep(now);
      const receipt={id,revision:this.state.revision,status:normalized.length?'accepted':this.state.phase?'settling':'resting',steps:normalized};
      this.state.receipts=[...this.state.receipts.slice(-63),receipt];
      return copy(receipt);
    }
    phase(kind,label,duration,to,patch={},extra={}){
      this.state.queue.push({kind,label,duration,to:copy(to),patch:copy(patch),...extra});
    }
    startStep(now){
      const s=this.state,step=s.plan.steps[s.plan.index],action=step.action;
      const fixture=action==='walk'?{approach:{x:step.x,y:step.y},point:{x:step.x,y:step.y},direction:s.direction,pose:'stand',label:'在屋里走动'}:
        action==='stand'?{approach:{...motion.anchors.room},point:{...motion.anchors.room},direction:s.direction,pose:'stand',label:'在地板上站立'}:copy(motion.fixtures[action]);
      const newProp=props[action]||null;
      let origin={...s.position};
      const changingSeat=s.fixture&&same(s.fixture.point,fixture.point)&&s.pose!=='stand';
      if(s.prop&&(s.prop!==newProp||!changingSeat))this.phase('put_down','收好'+s.prop,650,origin,{prop:null,...(changingSeat?{pose:'sit_side'}:{})},{fromPose:s.pose,toPose:changingSeat?'sit_side':s.pose});
      if(!changingSeat){
        const exit=s.plan.exit||s.fixture?.approach;
        if(s.pose!=='stand')this.phase('rise','起身',420,origin,{pose:'stand',prop:null},{fromPose:s.pose,toPose:'stand',exit});
        if(exit&&!same(origin,exit)){
          this.phase('exit','离开家具边',Math.max(320,distance(origin,exit)/11*1000),exit,{fixture:null},{exit});origin={...exit};
        }
        s.plan.exit=null;
        const route=motion.route(origin,fixture.approach);
        if(!same(origin,fixture.approach)&&!route.length)throw Error('没有可用路线');
        for(const point of route){if(['walk','stand'].includes(action))fixture.direction=motion.step(origin,point,.001).direction;this.phase('walk','走向'+fixture.label,Math.max(80,distance(origin,point)/11*1000),point,{pose:'stand',fixture:null});origin={...point};}
        this.phase('turn','转向家具',180,origin,{direction:fixture.entry?.direction||fixture.direction});
        if(fixture.entry){
          this.phase('mount','从床侧坐到床沿',480,fixture.entry.point,{pose:fixture.entry.pose,direction:fixture.entry.direction,fixture},{fromPose:'stand',toPose:fixture.entry.pose,exit:fixture.approach});
          origin={...fixture.entry.point};
        }
        const arrivalPose=newProp&&fixture.pose.startsWith('sit')?'sit_side':fixture.pose;
        if(fixture.pose!=='stand'||!same(origin,fixture.point))this.phase('mount',fixture.pose.startsWith('sit')?'慢慢坐下':fixture.pose==='lie'?'从床沿躺向枕头':action==='window'||action.startsWith('curtains_')?'靠近窗台':'靠近操作位置',480,fixture.point,{pose:arrivalPose,fixture,direction:fixture.direction},{fromPose:fixture.entry?.pose||'stand',toPose:arrivalPose,exit:fixture.approach});
      }
      if(newProp&&(newProp!==s.prop||!changingSeat))this.phase('pick_up','拿起'+newProp,650,fixture.point,{prop:newProp,pose:fixture.pose},{fromPose:fixture.pose.startsWith('sit')?'sit_side':fixture.pose,toPose:fixture.pose,exit:fixture.approach});
      this.phase('hold',fixture.label,step.duration_seconds*1000,fixture.point,{pose:fixture.pose,action,fixture,prop:newProp,direction:fixture.direction},{activity:action,receiptId:s.plan.id+':'+s.plan.index});
      this.next(now);
    }
    next(at){
      const s=this.state,phase=s.queue.shift();
      if(phase){
        s.phase={...phase,startedAt:at,from:{...s.position},fromDirection:s.direction};
        if(phase.kind==='hold')Object.assign(s,phase.patch);
        return;
      }
      if(s.plan){
        const step=s.plan.steps[s.plan.index];
        s.completed=[...s.completed.slice(-31),{action:step.action,at,plan_id:s.plan.id,agent_id:s.plan.agentId,receipt_id:s.plan.id+':'+s.plan.index,duration_seconds:step.duration_seconds}];
        s.plan.index++;
        if(s.plan.index<s.plan.steps.length){this.startStep(at);return;}
      }
      s.plan=null;s.phase=null;s.resting=true;
      if(s.action==='sleep')s.action='lie_bed';
    }
    tick(now=Date.now()){
      const s=this.state;
      now=Math.max(s.lastTick,now);
      for(let guard=0;s.phase&&guard<100;guard++){
        const phase=s.phase,p=now>=phase.startedAt+phase.duration?1:Math.max(0,(now-phase.startedAt)/phase.duration);
        const eased=['mount','exit'].includes(phase.kind)?p*p*(3-2*p):p;
        s.position={x:phase.from.x+(phase.to.x-phase.from.x)*eased,y:phase.from.y+(phase.to.y-phase.from.y)*eased};
        if(['walk','exit'].includes(phase.kind)&&!same(phase.from,phase.to))s.direction=motion.step(phase.from,phase.to,.001).direction;
        if(p<1)break;
        Object.assign(s,copy(phase.patch));s.position={...phase.to};this.next(phase.startedAt+phase.duration);
      }
      s.lastTick=now;return this.state;
    }
    snapshot(now=Date.now()){this.tick(now);return copy(this.state);}
    observe(now=Date.now()){
      const s=this.tick(now),phase=s.phase;
      return {revision:s.revision,position:s.position,facing:s.direction,posture:s.pose,holding:s.prop,
        doing:phase?.label||(s.resting?'原地歇着':actions[s.action]),stage:phase?.kind||'resting',
        intended_action:s.plan?.steps[s.plan.index]?.action||null,remaining_steps:s.plan?s.plan.steps.length-s.plan.index:0,
        recent_completed:s.completed.slice(-3),available_actions:actions,
        walking_examples:[{x:50,y:57},{x:40,y:45},{x:65,y:60}],furniture_routing:'家具动作自动寻路；只有walk使用地板坐标'};
    }
  }
  const api={RoomSimulation,validate,actions};
  if(typeof module==='object')module.exports=api;else host.CabinRuntime=api;
})(typeof window==='object'?window:{});
