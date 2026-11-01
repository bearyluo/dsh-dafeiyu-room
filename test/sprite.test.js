import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {registration,destination,gesture}=createRequire(import.meta.url)('../web/sprite.cjs');

test('transparent padding cannot move the registered head or soles between sprite cells',()=>{
  const make=offset=>{
    const data=new Uint8ClampedArray(96*100*4);
    const fill=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x+offset;i<x+offset+w;i++)data[(j*96+i)*4+3]=255;};
    fill(30,8,20,24);fill(24,32,32,38);fill(34,70,12,20);
    return registration(data,96,100);
  };
  const first=make(0),shifted=make(-18);
  for(const seated of [false,true]){
    const a=destination(first,first,.2,seated),b=destination(shifted,first,.2,seated);
    // Compare the same visible landmark after registration, not cell coordinates.
    assert.equal(a.x+(first.headX-first.left)*.2,b.x+(shifted.headX-shifted.left)*.2);
    assert.equal(a.y,b.y);assert.equal(a.height,b.height);
  }
});
test('resting seats and household work never cycle leg-swinging source frames',()=>{
  for(const pose of ['sit_side','sit_right','sit_eat','sit_prepare','sit_clean'])for(let t=0;t<15000;t+=137)assert.equal(gesture(pose,t),0);
  assert.equal(gesture('sit_tea',5000,false,true),0);
  assert.equal(gesture('sit_phone',5000,true),0);
  assert.notEqual(gesture('sit_tea',3900),0);
  for(const pose of ['sit_desk','sit_floor'])for(let t=0;t<6000;t+=137)assert.equal(gesture(pose,t),1);
});
