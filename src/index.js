import { defineTool } from '@deepseek-ai/dsh-tools';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { RoomRuntime } from './runtime.js';
import { prefix,serveRoom } from './http.js';
import { createRequire } from 'node:module';
const {actions}=createRequire(import.meta.url)('../web/simulation.cjs');

export const name='dsh-dafeiyu-room';
export const inject=['tools','systemPrompt','agents','sessions'];
const output={schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]};
const workTools=new Set(['read','read_image','write','edit','apply_patch','exec_command','write_stdin','web_search','web_fetch']);
export const isWorkTool=name=>workTools.has(name)||typeof name==='string'&&/^(terminal_|browser_)/.test(name);

/** Adds environment + body tools to the existing agent without owning its persona. */
export function apply(ctx,config={}){
  if(config.enabled===false)return;
  const runtime=new RoomRuntime({...config,statePath:config.statePath||join(homedir(),'.dsh/storages/dsh-dafeiyu-room/room.json')});
  let timer,viewer;
  ctx.effect(()=>()=>{if(timer)clearInterval(timer);if(viewer?.listening){viewer.closeAllConnections();viewer.close();}try{runtime.save();}finally{runtime.close();}});
  const log=ctx.logger?.('dsh-dafeiyu-room')||console;
  const isRoot=agent=>!!agent&&ctx.agents.roots().some(root=>root.id===agent.id);
  const bound=exec=>{
    exec.signal.throwIfAborted();
    if(!isRoot(exec.agent))throw Error('小屋身体仅由主会话控制');
    runtime.assertAgent(exec.agent.id);
  };
  ctx.tools.register(defineTool({
    name:'room_observe',description:'按需读取你居住的小屋状态，供自主活动决策；结果不需要向用户逐项复述。普通聊天无需每次观察。仅环境，不读取其他插件记忆或屏幕。',parameters:{},output,
    async execute(_args,exec){bound(exec);return JSON.stringify(runtime.observe());}
  }));
  ctx.tools.register(defineTool({
    name:'room_plan',description:'自主安排屋内生活，动作通过摄像头呈现，日常活动无需文字旁白或逐步报告。最多六步，普通活动30–600秒，sleep可到43200秒，灯/窗帘操作可短至1秒。支持准备简餐cook、eat吃饭、drink喝水、wash_dishes洗杯碗、tidy擦桌、手机、读书、烤火、睡觉及灯窗帘；物品不足时先准备或清洗。家具动作自动寻路和坐卧，直接指定动作，不先用walk走进家具。空数组表示安全起身休息；返回接受而非已经完成。',
    parameters:{revision:{type:'integer',required:true,description:'最近环境或room_observe中的revision'},steps:{type:'array',required:true,items:{oneOf:[
      {type:'object',additionalProperties:false,properties:{action:{type:'string',enum:Object.keys(actions).filter(key=>key!=='walk'),required:true},duration_seconds:{type:'integer',description:'普通30–600秒；sleep 30–43200秒；灯窗帘1–600秒，建议3秒'}}},
      {type:'object',additionalProperties:false,properties:{action:{type:'string',const:'walk',required:true},duration_seconds:{type:'integer'},x:{type:'number',required:true,description:'可行走地板横坐标百分比'},y:{type:'number',required:true,description:'可行走地板纵坐标百分比'}}}
    ]}}},output,
    async execute(args,exec){bound(exec);return JSON.stringify(runtime.plan(args.steps,{id:exec.callId,agentId:exec.agent.id,revision:args.revision}));}
  }));
  ctx.systemPrompt.context({name:'dsh-dafeiyu-room.environment',order:3500,interpolate:false,required:true,text:({agent})=>{
    if(!isRoot(agent))return '';
    if(!runtime.activeAgentId)runtime.select(agent.id);
    return agent.id===runtime.activeAgentId?runtime.environment():'';
  }});
  ctx.on('agent/inbox/inserted',({agent,message})=>{
    if(!isRoot(agent))return;
    if(message.source.kind==='user')runtime.userActivity(agent.id,message.id);
    if(message.source.kind==='schedule'&&(!runtime.activeAgentId||agent.id===runtime.activeAgentId)){runtime.select(agent.id);runtime.life.state.alarmRangAt=runtime.now();runtime.save();}
  });
  ctx.on('agent/disposed',({agent})=>{if(agent.id===runtime.activeAgentId){runtime.endWork('interrupted');runtime.connected=false;runtime.save();}});
  ctx.on('session/event',(session,event)=>{
    if(session.id!==runtime.activeAgentId)return;
    if(event.type==='tool/call'&&isWorkTool(event.data?.name))runtime.startWork(event.data.callId);
    if(event.type==='tool/result')runtime.life.workResult(event.data?.message?.toolCallId,!!event.data?.message?.isError);
    if(event.type==='assistant/message'){
      const blocks=event.data?.message?.content||[];
      if(blocks.some(block=>block.type==='text'&&block.text?.trim())&&!blocks.some(block=>block.type==='tool_call'))runtime.life.reply(runtime.now());
    }
    if(event.type==='turn/end'){
      runtime.endWork(event.data.reason);
      const reason=typeof event.data.reason==='string'?event.data.reason:event.data.reason?.kind;
      if(reason==='error'){runtime.error='主会话本次调用失败，自主唤醒暂停';runtime.save();}
    }
  });
  ctx.inject(['schedule'],scheduleCtx=>{
    let refreshing=false;
    const refresh=async()=>{
      const owner=runtime.activeAgentId;if(!owner||refreshing)return;refreshing=true;
      try{const entries=await scheduleCtx.schedule.catalog();if(runtime.activeAgentId===owner)runtime.life.setAlarms(entries,owner);}
      catch{runtime.life.state.scheduleAvailable=false;runtime.life.state.alarms=[];}
      finally{refreshing=false;}
    };
    scheduleCtx.on('schedule/changed',refresh);
    const alarmTimer=setInterval(refresh,15000);refresh();
    scheduleCtx.effect(()=>()=>clearInterval(alarmTimer));
  });
  ctx.inject(['webServer'],httpCtx=>{
    httpCtx.effect(()=>httpCtx.webServer.register({kind:'prefix',path:prefix,handler:(req,res)=>serveRoom(runtime,req,res)}));
  });
  if(config.viewerPort){
    if(!Number.isInteger(config.viewerPort)||config.viewerPort<1024||config.viewerPort>65535)throw Error('观察画面端口无效');
    viewer=createServer((req,res)=>{
      if(req.url==='/'){res.writeHead(302,{Location:prefix+'/'});res.end();return;}
      serveRoom(runtime,req,res);
    });
    viewer.on('error',error=>log.warn?.('观察端口暂不可用，仍可从DSH插件页观看：'+error.code));
    viewer.listen(config.viewerPort,'127.0.0.1');
  }
  let lastSaved=0,lastWeather=0;
  timer=setInterval(()=>{
    try{
      runtime.advance();
      if(runtime.now()-lastWeather>=30000){lastWeather=runtime.now();void runtime.refreshWeather();}
      const agent=ctx.agents.get(runtime.activeAgentId);
      if(runtime.claimWake(agent)){
        // Native inbox delivery wakes the same agent and retains its model,
        // persona, memory plugins, tool policies and accounting.
        agent.send(createUserMessage({source:{kind:'dsh-dafeiyu-room',form:'notice',summary:'小屋空闲活动决策'},content:[{type:'text',text:'小屋空闲活动通知，不是用户的新消息或新任务。根据当前状态自主使用room_plan，或继续原位休息。日常动作由摄像头呈现；本通知不要求聊天回复，不发送天气、位置、物品、吃喝或动作播报，也不把本通知当作手机收到用户消息。确有需要用户知道的事情才简短提醒。沿用原身份与记忆。'}]}),'next-turn',true);
      }
      if(runtime.now()-lastSaved>=5000){runtime.save();lastSaved=runtime.now();}
    }catch(error){runtime.error='小屋活动暂停：'+error.message;log.warn?.(runtime.error);}
  },100);
  log.info?.('观察画面与主会话身体工具已就绪');
}
