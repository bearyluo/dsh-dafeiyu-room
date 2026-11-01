#!/usr/bin/env node
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {createMobileHandler,loopbackSource} from '../src/mobile-viewer.js';
import {prefix} from '../src/http.js';
const args=process.argv.slice(2),arg=(key,fallback)=>{const index=args.indexOf(key);return index<0?fallback:args[index+1];};
const port=Number(arg('--port','8797')),cloudflared=arg('--cloudflared','cloudflared'),provider=arg('--provider','localhost-run');
if(!['localhost-run','cloudflare'].includes(provider))throw Error('不支持的免费外网服务');
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('网页端口无效');
const configPath=resolve(arg('--config',join(homedir(),'.dsh/storages/dsh-dafeiyu-room/viewer-access.json')));
let config=existsSync(configPath)?JSON.parse(readFileSync(configPath,'utf8')):{};
if(!/^[\w-]{43}$/.test(config.token||'')){config.token=randomBytes(32).toString('base64url');mkdirSync(dirname(configPath),{recursive:true});writeFileSync(configPath,JSON.stringify(config)+'\n',{mode:0o600});}
const publicOrigins=new Set(),authorities=new Set(['127.0.0.1:'+port]),handler=createMobileHandler({token:config.token,authorities,publicOrigins,apkPath:args.includes('--apk')?resolve(arg('--apk')):null,snapshot:loopbackSource(arg('--source','http://127.0.0.1:8796'+prefix+'/state'))});
const server=createServer((req,res)=>void handler(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();}));
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
const command=provider==='cloudflare'?cloudflared:arg('--ssh','ssh');
const childArgs=provider==='cloudflare'?['tunnel','--no-autoupdate','--url','http://127.0.0.1:'+port,'--http-host-header','127.0.0.1:'+port,'--protocol','http2']:['-F','none','-o','BatchMode=yes','-o','ConnectTimeout=20','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-o','StrictHostKeyChecking=accept-new','-o','UserKnownHostsFile='+join(dirname(configPath),'tunnel-known-hosts'),'-o','IdentityFile='+(process.platform==='win32'?'NUL':'/dev/null'),'-o','IdentitiesOnly=yes','-o','IdentityAgent=none','-T','-R','80:127.0.0.1:'+port,'nokey@localhost.run','--','--output','json'];
const child=spawn(command,childArgs,{windowsHide:true,stdio:['ignore','pipe','pipe']});
let tail='',origin=null,stopping=false;
function connected(next){
  if(next===origin)return;origin=next;publicOrigins.clear();publicOrigins.add(origin);authorities.add(new URL(origin).host);
  const pairing=origin+prefix+'/android.html#key='+config.token;
  writeFileSync(join(dirname(configPath),'public-access.json'),JSON.stringify({origin,pairing,provider,startedAt:new Date().toISOString(),temporary:true},null,2)+'\n',{mode:0o600});
  console.log('免费外网小屋入口（完整链接为只读凭证）：\n'+pairing+'\n安卓安装后从网页点“打开安卓悬浮窗”。电脑、DSH和本程序须保持运行；免费域名可能到期或重启后变化。');
}
const output=chunk=>{
  tail=(tail+chunk.toString()).slice(-256000);
  if(provider==='cloudflare'){const match=tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);if(match)connected(match[0]);}
  else{const lines=tail.split(/\r?\n/);tail=lines.pop();for(const line of lines)try{const event=JSON.parse(line.trim());const host=event.id?.replace(/^localhost\//,'');if(event.type==='v1.tcpip_forward.register.accepted'&&/^[a-z0-9-]+\.lhr\.life$/.test(host))connected('https://'+host);}catch{}}
  // Operational errors only; never print full request logs or pairing headers.
  if(provider==='cloudflare'&&/failed|ERR/.test(chunk.toString())||provider==='localhost-run'&&/Permission denied|Connection refused|Connection timed out|Could not resolve|REMOTE HOST IDENTIFICATION HAS CHANGED/.test(chunk.toString()))console.error(chunk.toString().replace(/token=[^\s]+/g,'token=[redacted]').trim());
};
child.stdout.on('data',output);child.stderr.on('data',output);
function stop(){if(stopping)return;stopping=true;child.kill();server.closeAllConnections();server.close();}
child.on('error',error=>{console.error('免费外网组件无法启动：'+error.code);stop();process.exitCode=1;});
child.on('exit',code=>{if(!stopping){console.error('免费外网连接已结束，退出码：'+code);stop();process.exitCode=code||1;}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,stop);
