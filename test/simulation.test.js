import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {RoomSimulation,actions}=createRequire(import.meta.url)('../web/simulation.cjs');
const motion=createRequire(import.meta.url)('../web/motion.cjs');
const send=(room,steps,id='plan',now=1000)=>room.submit(steps,{id,agentId:'primary',revision:room.state.revision,now});

test('bed entry reaches the side aisle then sits on the edge before lying down',()=>{
  for(const action of ['sit_bed','phone_bed','read_bed','tea_bed','lie_bed','sleep']){
    const fixture=motion.fixtures[action],room=new RoomSimulation(null,1000);
    assert(fixture.approach.x>fixture.point.x);assert(fixture.approach.y<40);assert(motion.walkable(fixture.approach));
    send(room,[{action}]);
    const phases=[room.state.phase,...room.state.queue],walks=phases.filter(p=>p.kind==='walk'),mounts=phases.filter(p=>p.kind==='mount');
    assert.deepEqual(walks.at(-1).to,fixture.approach);
    assert.equal(mounts[0].to.y,fixture.approach.y);
    if(['lie_bed','sleep'].includes(action)){
      assert.equal(mounts.length,2);assert.equal(mounts[0].toPose,'sit_side');assert.equal(mounts[1].fromPose,'sit_side');assert.equal(mounts[1].toPose,'lie');
    }
  }
});

test('table work docks behind the elevated tabletop and exits through the floor aisle',()=>{
  for(const action of ['cook','tidy']){
    const fixture=motion.fixtures[action],p=fixture.point;
    assert(motion.walkable(fixture.approach),action);
    assert(!motion.walkable(p),'docking point must not become a free walking destination');
    const room=new RoomSimulation(null,1000);send(room,[{action,duration_seconds:30}]);
    room.tick(20000);assert.equal(room.state.phase.kind,'hold');assert.deepEqual(room.state.position,p);
    send(room,[],'cancel',20000);room.tick(23000);
    assert.deepEqual(room.state.position,fixture.approach);assert.equal(room.state.action,'stand');
  }
});

test('saved stationary furniture poses re-register after layout corrections without finishing the activity',()=>{
  const room=new RoomSimulation(null,1000);send(room,[{action:'computer',duration_seconds:120}]);room.tick(15000);
  const saved=room.snapshot(15000);saved.position={x:82,y:54.3};saved.pose='sit_back';
  const restored=new RoomSimulation(saved,15000);restored.resume(30000);
  assert.deepEqual(restored.state.position,motion.fixtures.computer.point);assert.equal(restored.state.pose,'sit_desk');
  assert.equal(restored.state.phase.kind,'hold');assert.equal(restored.state.completed.length,0);
});

test('walking stops facing the final route segment rather than the previous idle direction',()=>{
  for(const [point,direction] of [[{x:40,y:57},'left'],[{x:65,y:57},'right'],[{x:50,y:45},'up'],[{x:50,y:65},'down']]){
    const room=new RoomSimulation(null,1000);send(room,[{action:'walk',...point,duration_seconds:30}]);room.tick(50000);
    assert.equal(room.state.direction,direction);assert.deepEqual(room.state.position,point);
  }
});

test('cancelling a wall interaction returns through its aisle before walking elsewhere',()=>{
  for(const action of ['wash_dishes','lamp_on','lamp_off']){
    const room=new RoomSimulation(null,1000);send(room,[{action,duration_seconds:120}]);room.tick(25000);
    assert.equal(room.state.phase.kind,'hold');
    const at={...room.state.position};send(room,[],'cancel-wall',25000);
    assert.deepEqual(room.state.position,at,'cancellation must not jump out of the fixture');
    room.tick(30000);assert(motion.walkable(room.state.position),'return to traversable floor');
    send(room,[{action:'walk',x:50,y:57,duration_seconds:30}],'leave-wall',30000);
    for(let t=30000;t<50000;t+=40){room.tick(t);if(room.state.phase?.kind==='walk')assert(motion.walkable(room.state.position));}
    assert.deepEqual(room.state.position,{x:50,y:57});
  }
});

test('sitting mounts once and holds its registered contact point for the whole activity',()=>{
  for(const action of ['sit_bed','sit_chair','fireplace']){
    const room=new RoomSimulation(null,1000);send(room,[{action,duration_seconds:30}]);
    let previous=null,mounts=0,holds=0,position=null;
    for(let t=1000;t<45000;t+=40){
      room.tick(t);const phase=room.state.phase;
      if(phase?.kind==='mount'&&previous!=='mount')mounts++;
      if(phase?.kind==='hold'){holds++;position??={...room.state.position};assert.deepEqual(room.state.position,position);}
      previous=phase?.kind;
    }
    assert.equal(mounts,1,action);assert(holds>600,action);
  }
});

test('arrival is not reported as completed while the body is still walking',()=>{
  const room=new RoomSimulation(null,1000);send(room,[{action:'phone_bed',duration_seconds:30}]);
  assert.equal(room.observe(1001).posture,'stand');assert.equal(room.observe(1001).stage,'walk');
  assert.equal(room.observe(1001).intended_action,'phone_bed');assert.equal(room.observe(1001).recent_completed.length,0);
  const phases=new Set();for(let now=1000;now<18000;now+=50){room.tick(now);phases.add(room.state.phase?.kind);}
  for(const phase of ['walk','turn','mount','pick_up','hold'])assert(phases.has(phase),phase);
  assert.equal(room.state.pose,'sit_phone');assert.deepEqual(room.state.position,motion.fixtures.phone_bed.point);
  assert.equal(room.state.completed.length,0);
  room.tick(50000);assert.equal(room.state.completed[0].action,'phone_bed');assert.equal(room.state.resting,true);
});
test('all actions reach the fixture; only floor movement uses walkable cells',()=>{
  let now=1000;const room=new RoomSimulation(null,now);
  for(const action of Object.keys(actions)){
    const step=action==='walk'?{action,x:50,y:61,duration_seconds:30}:{action,duration_seconds:30};
    send(room,[step],action,now);
    for(let t=now;t<now+25000;t+=30){
      room.tick(t);
      if(room.state.phase?.kind==='walk')assert(motion.walkable(room.state.position),JSON.stringify(room.state.position));
    }
    assert.equal(room.state.action,action);
    now+=60000;room.tick(now);
  }
});
test('switching bed props stays seated; leaving has put-down, rise and safe exit',()=>{
  const room=new RoomSimulation(null,1000);send(room,[{action:'phone_bed'}]);room.tick(15000);
  const at={...room.state.position};send(room,[{action:'read_bed'}],'book',15000);
  const phases=new Set();for(let t=15000;t<18000;t+=20){room.tick(t);phases.add(room.state.phase?.kind);assert.deepEqual(room.state.position,at);}
  assert(!phases.has('walk'));assert(phases.has('put_down')&&phases.has('pick_up'));
  send(room,[{action:'fireplace'}],'fire',18000);
  assert.deepEqual(room.state.position,at);
  const leaving=new Set();for(let t=18000;t<40000;t+=30){room.tick(t);leaving.add(room.state.phase?.kind);}
  for(const phase of ['put_down','rise','exit','walk','mount','hold'])assert(leaving.has(phase),phase);
  assert.equal(room.state.pose,'sit_floor');
});
test('interrupting a mount preserves its furniture exit instead of teleporting',()=>{
  const room=new RoomSimulation(null,1000);send(room,[{action:'sit_bed'}]);
  let now=1000;for(;now<12000;now+=10){room.tick(now);if(room.state.phase?.kind==='mount')break;}
  room.tick(now+200);const from={...room.state.position};send(room,[{action:'window'}],'interrupt',now+200);
  assert.deepEqual(room.state.position,from);room.tick(now+20000);assert.equal(room.state.pose,'look_window');
});
test('invalid plans and stale revisions do not replace accepted plans; duplicates never rewind',()=>{
  const room=new RoomSimulation(null,1000);const receipt=send(room,[{action:'tea'}]);
  const saved=JSON.stringify(room.state);
  for(const steps of [[{action:'delete_files'}],[{action:'walk',x:80,y:45}],[{action:'tea',x:20}],[{action:'tea',duration_seconds:true}],[{action:'tea'}, {action:'unknown'}]]){
    assert.throws(()=>send(room,steps,'bad'));assert.equal(JSON.stringify(room.state),saved);
  }
  assert.throws(()=>room.submit([{action:'window'}],{id:'stale',agentId:'primary',revision:99,now:1000}));
  room.tick(10000);const position={...room.state.position};
  assert.deepEqual(send(room,[{action:'tea'}]),receipt);assert.deepEqual(room.state.position,position);
});
test('restart resumes from saved feet and pauses offline time; a viewer can extrapolate consistently',()=>{
  const room=new RoomSimulation(null,1000);send(room,[{action:'window'}]);room.tick(2100);
  const before=room.snapshot(2100),restored=new RoomSimulation(before,2100);restored.resume(100000);
  restored.tick(100000);assert.deepEqual(restored.state.position,before.position);
  const viewer=new RoomSimulation(room.snapshot(2200),2200);assert.deepEqual(viewer.snapshot(2300).position,room.snapshot(2300).position);
});
test('cancelling a seated activity or partial mount returns to the aisle without teleporting',()=>{
  for(const targetPhase of ['mount','hold']){
    const room=new RoomSimulation(null,1000);send(room,[{action:'phone_bed'}]);
    let now=1000;for(;now<20000;now+=10){room.tick(now);if(room.state.phase?.kind===targetPhase)break;}
    room.tick(now+180);const from={...room.state.position};
    const result=send(room,[],'cancel',now+180);assert.equal(result.status,'settling');
    assert.deepEqual(room.state.position,from);assert.equal(room.state.resting,false);
    room.tick(now+5000);assert.equal(room.state.pose,'stand');assert.equal(room.state.prop,null);
    assert(motion.walkable(room.state.position));assert.equal(room.state.resting,true);
    assert.equal(room.state.completed.length,0);
    send(room,[{action:'window'}],'after-cancel',now+5000);room.tick(now+25000);
    assert.equal(room.state.pose,'look_window');
  }
});
test('moving a tea activity between seats puts down and picks up the cup; watering stays standing',()=>{
  const room=new RoomSimulation(null,1000);send(room,[{action:'tea'}]);room.tick(20000);
  assert.equal(room.state.prop,'茶杯');send(room,[{action:'tea_bed'}],'move-cup',20000);
  const phases=new Set();for(let t=20000;t<40000;t+=20){room.tick(t);phases.add(room.state.phase?.kind);if(room.state.phase?.kind==='walk')assert.equal(room.state.prop,null);}
  assert(phases.has('put_down')&&phases.has('pick_up'));assert.equal(room.state.prop,'茶杯');assert.equal(room.state.pose,'sit_tea');
  send(room,[{action:'water'}],'water',40000);
  let sawPickup=false;for(let t=40000;t<60000;t+=20){room.tick(t);if(room.state.phase?.kind==='pick_up'){sawPickup=true;assert.equal(room.state.phase.fromPose,'stand');assert.equal(room.state.pose,'stand');}}
  assert(sawPickup);assert.equal(room.state.prop,'浇水壶');
});
