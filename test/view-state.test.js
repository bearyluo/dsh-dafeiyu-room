import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{resting}=require('../web/view-state.cjs'),{RoomSimulation}=require('../web/simulation.cjs'),{fixtures}=require('../web/motion.cjs');
test('offline display starts in bed without submitting or completing a model plan',()=>{
  const now=Date.parse('2026-11-01T15:00:00Z'),previous={life:{clock:{timeZone:'Asia/Shanghai'},room:{lamp:true}},weather:{status:'live',kind:'rain',city:'示例'}};
  const original=JSON.stringify(previous),state=resting(previous,now),simulation=new RoomSimulation(state.body,now);
  assert.equal(state.life.clock.hour,23);assert.equal(state.life.clock.night,true);assert.equal(state.life.room.lamp,false);
  assert.equal(state.connected,false);assert.equal(state.viewerRest,true);assert.equal(state.weather.status,'unavailable');
  for(const delta of [0,10000,86400000]){
    const body=simulation.tick(now+delta);assert.equal(body.action,'sleep');assert.equal(body.pose,'lie');assert.deepEqual(body.position,fixtures.sleep.point);
    assert.equal(body.plan,null);assert.deepEqual(body.completed,[]);assert.deepEqual(body.receipts,[]);
  }
  assert.equal(JSON.stringify(previous),original);
});
test('offline time uses a real clock, and recovery takes the exact live body instead of the placeholder',()=>{
  const now=Date.parse('2026-11-01T04:00:00Z');assert.equal(resting(null,now).life.clock.hour,12);
  assert.equal(resting({life:{clock:{timeZone:'bad zone'}}},now).life.clock.timeZone,'Asia/Shanghai');
  const live=new RoomSimulation(null,now);live.submit([{action:'phone_bed',duration_seconds:120}],{id:'live',agentId:'same-agent',revision:0,now});
  const before=live.snapshot(now+7000);resting({body:before},now+8000);
  assert.deepEqual(new RoomSimulation(before,now+7000).snapshot(now+7000),before);
});
