import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
export const web=join(dirname(fileURLToPath(import.meta.url)),'../web');
export const allowed=new Set(['android.html','android.css','android.js','assets/outdoor-garden-v1.png','mobile.html','mobile.css','mobile.js','index.html','camera.css','camera.js','home.js','assets/home-decor-v1.png','assets/home-extras-v1.png','assets/home-linen-v1.png','assets/home-duvet-v1.png','assets/home-washstand-v1.png','assets/home-switch-v1.png','sprite.cjs','environment.cjs','motion.cjs','simulation.cjs','view-state.cjs','assets/cabin-v2.png','assets/lo-walk.png','assets/lo-poses.png','assets/lo-sit-side.png','assets/lo-life-v3.png']);
export const prefix='/plugins/dsh-dafeiyu-room';
export async function serveRoom(runtime,req,res){
  const remote=req.socket?.remoteAddress;
  let url;try{url=new URL(req.url,'http://'+req.headers.host);}catch{res.writeHead(400);res.end();return;}
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||
    (req.headers.origin&&req.headers.origin!==url.origin)){res.writeHead(403);res.end();return;}
  const settingsPath=url.pathname===prefix+'/settings';
  if(req.method!=='GET'&&!(settingsPath&&req.method==='POST')){res.writeHead(405,{Allow:settingsPath?'GET, POST':'GET'});res.end();return;}
  if(url.pathname===prefix){res.writeHead(302,{Location:prefix+'/'});res.end();return;}
  const relative=url.pathname.replace(/^\/plugins\/dsh-dafeiyu-room\/?/,'')||'index.html';
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'");
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  if(relative==='settings'){
    if(req.method==='GET'){json(200,runtime.settings());return;}
    const supplied=Buffer.from(String(req.headers['x-room-settings-token']||'')),expected=Buffer.from(runtime.settingsToken);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){json(403,{error:'设置页面已过期，请重新打开'});return;}
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){json(415,{error:'设置需要JSON格式'});return;}
    try{
      let body='',bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>8192){json(413,{error:'设置内容过长'});return;}body+=chunk;}
      const result=runtime.updateSettings(JSON.parse(body));json(200,result);void runtime.refreshWeather();
    }catch(error){json(400,{error:error instanceof SyntaxError?'设置格式无效':error.message});}
    return;
  }
  if(relative==='locations'){
    try{json(200,{locations:await runtime.searchCities(url.searchParams.get('q'))});}
    catch(error){json(400,{error:error.message});}return;
  }
  if(relative==='state'){
    res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(runtime.snapshot()));return;
  }
  if(!allowed.has(relative)){res.writeHead(404);res.end();return;}
  try{
    const bytes=readFileSync(join(web,relative));
    res.setHeader('Content-Type',relative.endsWith('.png')?'image/png':relative.endsWith('.html')?'text/html; charset=utf-8':relative.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');res.end(bytes);
  }catch{res.writeHead(503);res.end();}
}
