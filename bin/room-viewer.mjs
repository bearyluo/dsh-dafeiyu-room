#!/usr/bin/env node
import {createServer} from 'node:http';
import {networkInterfaces,homedir} from 'node:os';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createMobileHandler,loopbackSource} from '../src/mobile-viewer.js';
import {prefix} from '../src/http.js';

const args=process.argv.slice(2),arg=(key,fallback)=>{const index=args.indexOf(key);return index<0?fallback:args[index+1];};
const privateIp=ip=>/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const ips=Object.values(networkInterfaces()).flat().filter(item=>item.family==='IPv4'&&!item.internal&&privateIp(item.address)).map(item=>item.address);
if(args.includes('--help')){console.log('dsh-room-viewer [--lan | --host PRIVATE_IP] [--port 8797] [--source http://127.0.0.1:8796/plugins/dsh-dafeiyu-room/state] [--config FILE] [--rotate-key]\n默认只监听本机。--lan 开放当前局域网接口，只提供带访问凭证的小屋画面，不代理DSH聊天或控制。');process.exit(0);}
const address=arg('--host',args.includes('--lan')?ips[0]:'127.0.0.1'),port=Number(arg('--port','8797'));
if(address!=='127.0.0.1'&&!ips.includes(address))throw Error('请选择本机局域网IPv4地址；不支持监听公网或所有网卡');
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('网页端口无效');
const configPath=resolve(arg('--config',join(homedir(),'.dsh/storages/dsh-dafeiyu-room/viewer-access.json')));
let token;
if(existsSync(configPath)&&!args.includes('--rotate-key'))token=JSON.parse(readFileSync(configPath,'utf8')).token;
if(!/^[\w-]{43}$/.test(token||'')){token=randomBytes(32).toString('base64url');mkdirSync(dirname(configPath),{recursive:true});writeFileSync(configPath,JSON.stringify({token})+'\n',{mode:0o600});}
const source=loopbackSource(arg('--source','http://127.0.0.1:8796'+prefix+'/state'));
const authorities=new Set([address+':'+port,'127.0.0.1:'+port,'localhost:'+port]);
const handler=createMobileHandler({token,snapshot:source,authorities,apkPath:args.includes('--apk')?resolve(arg('--apk')):null});
const servers=[...new Set([address,'127.0.0.1'])].map(host=>{
  const server=createServer((req,res)=>{void handler(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});});
  server.on('error',error=>{console.error('小屋网页无法启动：'+error.code);for(const {server:other} of servers){other.closeAllConnections();other.close();}process.exitCode=1;});
  return {server,host};
});
await Promise.all(servers.map(({server,host})=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);})));
const link='http://'+address+':'+port+prefix+'/android.html#key='+token;
// Intentionally printed only to the local user's terminal; no request logging.
console.log('安卓悬浮小屋（同一Wi-Fi，完整链接为只读访问凭证）：\n'+link+'\n先下载安装应用，再从网页连接；电脑和本服务需要保持运行。');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const {server} of servers){server.closeAllConnections();server.close();}});
