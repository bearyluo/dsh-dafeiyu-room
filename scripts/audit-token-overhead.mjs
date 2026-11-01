// Only synthetic fixtures and the plugin's own published tool schemas are read.
import {apply} from '../src/index.js';
import {RoomRuntime} from '../src/runtime.js';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const out=resolve(process.argv[2]||'build/token-audit/texts');mkdirSync(out,{recursive:true});
const directory=mkdtempSync(join(tmpdir(),'cabin-token-audit-')),tools=[],cleanup=[];
const agent={id:'synthetic-agent',status:'idle',inbox:{nextTurn:[],nextStep:[]}};
const ctx={tools:{register:tool=>tools.push(tool)},systemPrompt:{context(){}},agents:{roots:()=>[agent]},logger:()=>({info(){},warn(){}}),on(){},inject(){},effect:fn=>{const f=fn();if(typeof f==='function')cleanup.push(f);}};
let runtime;
try{
  apply(ctx,{statePath:join(directory,'room.json'),maxDailyDecisions:0});
  runtime=new RoomRuntime({now:()=>Date.parse('2026-11-01T12:00:00Z')});runtime.select(agent.id);
  const save=(name,text)=>writeFileSync(join(out,name+'.txt'),text);
  const environment=runtime.environment();
  save('environment',environment);save('static-instructions',environment.split('\n小屋状态')[0]);
  save('state',JSON.stringify(runtime.observe()));
  save('tools',JSON.stringify(tools.map(({name,description,parameters})=>({type:'function',function:{name,description,parameters}}))));
  save('decision-notice','小屋空闲活动通知，不是用户的新消息或新任务。根据当前状态自主使用room_plan，或继续原位休息。日常动作由摄像头呈现；本通知不要求聊天回复，不发送天气、位置、物品、吃喝或动作播报，也不把本通知当作手机收到用户消息。确有需要用户知道的事情才简短提醒。沿用原身份与记忆。');
  save('sample-plan-call',JSON.stringify({revision:0,steps:[{action:'tea',duration_seconds:300},{action:'phone_bed',duration_seconds:300},{action:'sleep',duration_seconds:3600}]}));
  save('sample-plan-result',JSON.stringify(runtime.plan([{action:'tea',duration_seconds:300}],{id:'synthetic-call',agentId:agent.id,revision:0})));
  console.log('Synthetic plugin texts exported; no private chat, configuration or API calls used.');
}finally{runtime?.close();for(const f of cleanup)f();rmSync(directory,{recursive:true,force:true});}
