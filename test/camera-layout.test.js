import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the shipped ModuleLoader factory and its event handlers. No duplicate
// sizing implementation; real React/browser rendering is checked separately.
function harness(saved=null){
  const slots={},hooks=[],effects=[],listeners={},storage=new Map(saved?[['dsh-dafeiyu-room.camera-layout.v1',JSON.stringify(saved)]]:[]);let cursor=0;
  const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props||{},children}),useState:initial=>{const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],next=>{hooks[i]=next;}];},useRef:initial=>{const i=cursor++;return hooks[i]??=( {current:initial});},useEffect:fn=>{cursor++;effects.push(fn);}};
  const window={innerWidth:1200,innerHeight:800,addEventListener:(name,fn)=>{listeners[name]=fn;},removeEventListener:()=>{},__ModuleLoader__:{load:({factory})=>factory(()=>React).apply({slots:{inject:(_name,fn)=>fn(),register:(meta,component)=>{slots[meta.name]=component;}}})}};
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},console});
  let tree;const render=()=>{cursor=0;tree=slots['shell.overlay']();return tree;};
  const flatten=node=>node&&typeof node==='object'?[node,...node.children.flat(Infinity).flatMap(flatten)]:[];
  const find=label=>flatten(tree).find(node=>node.props['aria-label']===label);
  render();effects[0]();
  return {render,find,storage,resize:(width,height)=>{window.innerWidth=width;window.innerHeight=height;listeners.resize();render();}};
}
const dimensions=node=>[node.props.style.width,node.props.style.height];

test('old camera positions migrate, enlarge/restore works and preferred size survives phone rotation',()=>{
  const h=harness({open:true,camera:{x:10,y:20},launcher:{x:100,y:100}});
  assert.deepEqual(dimensions(h.find('小屋摄像头浮窗')),[480,360]);
  h.find('放大小屋窗口').props.onClick();h.render();assert(h.find('小屋摄像头浮窗').props.style.width>480);
  h.find('还原小屋窗口').props.onClick();h.render();assert.equal(h.find('小屋摄像头浮窗').props.style.width,480);
  h.find('调整小屋窗口大小').props.onKeyDown({key:'ArrowRight',target:1,currentTarget:1,preventDefault(){}});h.render();
  assert.equal(h.find('小屋摄像头浮窗').props.style.width,490);
  h.resize(320,568);assert(h.find('小屋摄像头浮窗').props.style.width<=304);
  h.resize(1200,800);assert.equal(h.find('小屋摄像头浮窗').props.style.width,490);
  const saved=JSON.parse(h.storage.get('dsh-dafeiyu-room.camera-layout.v1'));assert.equal(saved.width,490);
});

test('corner drag resizes at 4:3 without moving the camera or toggling the launcher',()=>{
  const h=harness({open:true,width:400,camera:{x:100,y:100},launcher:{x:100,y:700}}),handle=h.find('调整小屋窗口大小');
  const target={setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
  const event={button:0,isPrimary:true,pointerId:1,clientX:500,clientY:400,currentTarget:target,stopPropagation(){},preventDefault(){}};
  handle.props.onPointerDown(event);handle.props.onPointerMove({...event,clientX:660,clientY:520});handle.props.onPointerUp(event);h.render();
  const camera=h.find('小屋摄像头浮窗');assert.deepEqual(dimensions(camera),[560,420]);assert.equal(camera.props.style.left,100);assert.equal(camera.props.style.top,100);
  assert.equal(h.find('收起小屋摄像头').props['aria-expanded'],true);
});
