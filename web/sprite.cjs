(function(host){
  'use strict';
  // Registration follows the head for seated art and the soles for walking art.
  // Generated cells have different transparent padding; cell centers are not pivots.
  function registration(data,width,height){
    let left=width,top=height,right=-1,bottom=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>160){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<0)throw Error('精灵帧缺失');
    let hl=width,hr=-1,weight=0,total=0;
    for(let y=top;y<Math.min(bottom+1,top+32);y++)for(let x=left;x<=right;x++)if(data[(y*width+x)*4+3]>160){hl=Math.min(hl,x);hr=Math.max(hr,x);}
    for(let y=bottom-Math.max(4,Math.round((bottom-top)*.08));y<=bottom;y++)for(let x=left;x<=right;x++)if(data[(y*width+x)*4+3]>160){weight++;total+=x;}
    return {left,top,width:right-left+1,height:bottom-top+1,headX:(hl+hr)/2,footX:total/weight,footY:bottom+1};
  }
  function destination(frame,reference,scale,seated=false){
    return {x:24+(frame.left-(seated?frame.headX:frame.footX))*scale,
      y:seated?71-(reference.footY-reference.top)*scale:71+(frame.top-frame.footY)*scale,
      width:frame.width*scale,height:frame.height*scale};
  }
  function gesture(pose,time,resting=false,reduced=false){
    if(pose==='sit_desk'||pose==='sit_floor')return 1;
    if(resting||reduced||['sit_side','sit_right','sit_eat','sit_prepare','sit_clean'].includes(pose))return 0;
    const cycles={sit_tea:[0,0,0,0,0,1,2,2,3,0,0,0],sit_book:[0,0,0,0,0,0,0,0,1,1,2,3],sit_phone:[0,0,0,3,3,0],sit_floor:[0,0,1,1,0,0,3,3],look_window:[0,0,0,1,1,0,0,3]};
    const cycle=cycles[pose];return cycle?cycle[Math.floor(Math.max(0,time)/(pose==='sit_book'?700:650))%cycle.length]:0;
  }
  const api={registration,destination,gesture};
  if(typeof module==='object')module.exports=api;else host.CabinSprite=api;
})(typeof window==='object'?window:{});
