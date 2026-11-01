/* Pure presentation geometry, also exercised by the Node acceptance checks. */
(function (host) {
  'use strict';
  const anchors = {room: {x: 50, y: 57}, window: {x: 22, y: 53.5}, desk: {x: 82, y: 59}};
  const washstand={x:178,y:49,width:28,height:29.3,basin:{x:187,y:59,width:10,height:4}};
  const wallSwitch={x:294,y:58,width:5,height:11};
  const fixtures = {
    sit_bed: {approach: {x:28,y:35.8}, point:{x:23.8,y:35.8}, pose:'sit_side', direction:'right', label:'侧坐在床沿'},
    lie_bed: {approach: {x:28,y:35.8}, entry:{point:{x:23.8,y:35.8},pose:'sit_side',direction:'right'}, point:{x:20.5,y:31.8}, pose:'lie', direction:'down', label:'躺在床上'},
    sit_chair: {approach:{x:82,y:59}, point:{x:82,y:52.3}, pose:'sit_desk', direction:'up', label:'坐在书桌椅上'},
    computer: {approach:{x:82,y:59}, point:{x:82,y:52.3}, pose:'sit_desk', direction:'up', label:'坐在电脑前'},
    sit_table: {approach:{x:67,y:79}, point:{x:71,y:79}, pose:'sit_right', direction:'right', label:'坐在餐桌旁'},
    window: {approach:{x:29,y:28}, point:{x:29,y:26}, pose:'look_window', direction:'up', label:'靠窗探身看风景'},
    fireplace: {approach:{x:61,y:37}, point:{x:61,y:34.5}, pose:'sit_floor', direction:'up', label:'坐在炉火旁取暖'},
    bookshelf: {approach:{x:82,y:35}, point:{x:82,y:35}, pose:'stand', direction:'up', label:'在书架旁'},
    tea: {approach:{x:67,y:79}, point:{x:71,y:79}, pose:'sit_tea', direction:'right', label:'坐在餐桌旁喝茶'},
    tea_bed: {approach:{x:28,y:35.8}, point:{x:23.8,y:35.8}, pose:'sit_tea', direction:'right', label:'侧坐床沿喝茶'},
    phone_bed: {approach:{x:28,y:35.8}, point:{x:23.8,y:35.8}, pose:'sit_phone', direction:'right', label:'侧坐床沿看手机'},
    read_bed: {approach:{x:28,y:35.8}, point:{x:23.8,y:35.8}, pose:'sit_book', direction:'right', label:'侧坐床沿翻书'},
    water: {approach:anchors.window, point:anchors.window, pose:'stand', direction:'left', label:'给盆栽浇水'},
    sleep: {approach:{x:28,y:35.8},entry:{point:{x:23.8,y:35.8},pose:'sit_side',direction:'right'},point:{x:20.5,y:31.8},pose:'lie',direction:'down',label:'盖好被子睡觉'},
    eat: {approach:{x:67,y:79},point:{x:71,y:79},pose:'sit_eat',direction:'right',label:'坐在餐桌旁吃饭'},
    drink: {approach:{x:67,y:79},point:{x:71,y:79},pose:'sit_tea',direction:'right',label:'坐在餐桌旁喝水'},
    cook: {approach:{x:76,y:68},point:{x:75.5,y:72.3},pose:'stand',direction:'down',label:'在餐桌准备简餐'},
    wash_dishes: {approach:{x:48,y:35},point:{x:48,y:28},pose:'stand',direction:'up',label:'贴近水槽背对镜头洗杯碗'},
    tidy: {approach:{x:76,y:68},point:{x:75.5,y:72.3},pose:'stand',direction:'down',label:'擦拭整理餐桌'},
    phone_table: {approach:{x:67,y:79},point:{x:71,y:79},pose:'sit_phone',direction:'right',label:'坐在餐桌旁看手机'},
    lamp_on: {approach:{x:73.5,y:35},point:{x:73.5,y:27},pose:'stand',direction:'up',label:'按墙壁开关打开室内灯'},
    lamp_off: {approach:{x:73.5,y:35},point:{x:73.5,y:27},pose:'stand',direction:'up',label:'按墙壁开关关掉室内灯'},
    curtains_open: {approach:{x:29,y:28},point:{x:29,y:26},pose:'stand',direction:'up',label:'拉开窗帘'},
    curtains_close: {approach:{x:29,y:28},point:{x:29,y:26},pose:'stand',direction:'up',label:'合上窗帘'}
  };
  function walkable(p) {
    return Number.isFinite(p.x) && Number.isFinite(p.y) &&
      ((p.x >= 27 && p.x <= 74 && p.y >= 33 && p.y <= 68) ||
       (p.x >= 23 && p.x <= 87 && p.y >= 59 && p.y <= 68) ||
       (p.x >= 34 && p.x <= 86 && p.y >= 33 && p.y <= 38) ||
       (p.x >= 42 && p.x <= 67 && p.y >= 68 && p.y <= 81) ||
       (p.x >= 21 && p.x <= 28 && p.y >= 45 && p.y <= 61) ||
       (p.x >= 28 && p.x <= 32 && p.y >= 26 && p.y <= 34));
  }
  function route(from, to) {
    if (!walkable(from) || !walkable(to)) return [];
    const start = {x:Math.round(from.x),y:Math.round(from.y)}, goal = {x:Math.round(to.x),y:Math.round(to.y)};
    const key = p => p.y * 100 + p.x, queue = [start], previous = new Map([[key(start),null]]);
    for (let head=0;head<queue.length && !previous.has(key(goal));head++) {
      const p=queue[head];
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const next={x:p.x+dx,y:p.y+dy}, id=key(next);
        if (walkable(next) && !previous.has(id)) {previous.set(id,p);queue.push(next);}
      }
    }
    if (!previous.has(key(goal))) return [];
    const points=[];
    for(let p=goal;p;p=previous.get(key(p))) points.push(p);
    points.reverse();
    const corners=points.filter((p,i)=>!i || i===points.length-1 ||
      (p.x-points[i-1].x)!==(points[i+1].x-p.x) || (p.y-points[i-1].y)!==(points[i+1].y-p.y));
    if (Math.hypot(goal.x-to.x,goal.y-to.y)>.001) corners.push({...to});
    return corners.filter(p=>Math.hypot(p.x-from.x,p.y-from.y)>.001);
  }
  function step(from, to, seconds, speed = 12) {
    const dx = to.x - from.x, dy = to.y - from.y;
    // Scene is 4:3, so vertical percentages cover fewer screen pixels.
    const distance = Math.hypot(dx, dy * .75), ratio = distance ? Math.min(1, speed * seconds / distance) : 1;
    return {x: from.x + dx * ratio, y: from.y + dy * ratio,
      direction: Math.abs(dx) > Math.abs(dy) * .75 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'),
      arrived: ratio === 1};
  }
  function giftPosition(placement, index) {
    const areas = {'bookshelf.shared_reads': [78, 18, 4, 2.5, 3], desk: [76, 43, 3, 3, 4],
      bedside: [14, 24, 3, 3, 2], wall: [68, 10, 2.5, 3, 4]};
    const [x, y, dx, dy, columns] = areas[placement] || areas.desk;
    return {x: x + index % columns * dx, y: y + Math.floor(index / columns) * dy};
  }
  const api = {anchors, fixtures, washstand, wallSwitch, walkable, route, step, giftPosition};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else host.CabinMotion = api;
})(typeof window !== 'undefined' ? window : {});
