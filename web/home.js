'use strict';
// Approved artwork is sampled from its original atlases, never stretched across
// furniture or used as new collision geometry. Coordinates are cabin pixels.
const CabinHome=(()=>{
  const images={};
  const sources={decor:'home-decor-v1.png',extras:'home-extras-v1.png',linen:'home-linen-v1.png',duvet:'home-duvet-v1.png',room:'cabin-v2.png',sink:'home-washstand-v1.png',switches:'home-switch-v1.png'};
  const placements=[
    // Floor textiles: large enough to cover the original rug within its footprint.
    ['decor',[492,132,540,378],[156,135,91,55]],
    ['decor',[1067,106,423,403],[181,221,37,23]],
    // Wall and shelf keepsakes, clear of the working surfaces and window glass.
    ['decor',[83,68,339,457],[246,28,14,18]],
    ['decor',[50,567,461,399],[208,28,12,11]],
    ['decor',[541,646,467,296],[137,49,17,11]],
    ['decor',[1070,622,435,307],[338,31,9,7]],
    ['extras',[91,78,250,326],[130,43,9,12]],
    ['extras',[544,16,177,402],[138,24,5,12]],
    ['extras',[871,84,347,319],[103,127,13,11]],
    ['extras',[39,432,351,360],[272,24,15,16]],
    ['extras',[428,482,399,299],[135,226,14,11]],
    ['extras',[900,480,299,312],[52,83,7,7]],
    ['extras',[26,868,403,337],[306,138,10,8]],
    ['extras',[490,805,252,434],[157,29,7,12]],
    ['extras',[851,910,378,270],[319,35,10,7]],
    ['linen',[82,859,563,364],[75,210,15,10]],
    ['linen',[742,825,390,378],[51,189,9,9]],
    ['linen',[690,242,490,345],[68,70,25,12]],
  ];
  const load=()=>Promise.all(Object.entries(sources).map(([name,file])=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>{images[name]=image;resolve();};image.onerror=reject;image.src='./assets/'+file;
  })));
  function duvet(context){
    // Identical cloth registration in the base and foreground prevents a white
    // fold or green quilt flashing through when entering/leaving the bed.
    context.imageSmoothingEnabled=false;
    context.drawImage(images.duvet,118,77,1078,1074,63,81,36,35);
  }
  function draw(context){
    context.clearRect(0,0,context.canvas.width,context.canvas.height);context.imageSmoothingEnabled=false;
    context.save();context.scale(context.canvas.width/400,context.canvas.height/300);
    textiles(context);
    // Remove the old floor-level painting with wood from the same board rows.
    original(context,[285,93,18,24],[328,93,18,24]);
    for(const [name,source,target] of placements)context.drawImage(images[name],...source,...target);
    duvet(context);
    context.restore();
  }
  function original(context,source,target=source){
    context.drawImage(images.room,source[0]*3.62,source[1]*3.62,source[2]*3.62,source[3]*3.62,...target);
  }
  function restore(context,points){
    context.save();context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();context.clip();
    context.drawImage(images.room,0,0,400,300);context.restore();
  }
  function textiles(context){
    // Replace the embedded green rugs, then restore only the real furniture
    // silhouettes. Original feet/contact points and front layers stay aligned.
    original(context,[121,78,71,53],[50,78,71,53]);
    context.drawImage(images.decor,1067,106,423,403,51,79,68,49);
    restore(context,[[61,61],[66,61],[66,65],[73,62],[88,62],[94,65],[94,61],[100,61],[100,130],[95,130],[95,122],[65,122],[65,130],[61,130]]);
    original(context,[51,78,10,14]);
    for(let x=263;x<352;x+=29)original(context,[145,210,Math.min(29,352-x),35],[x,210,Math.min(29,352-x),35]);
    context.drawImage(images.decor,1067,106,423,403,264,210,87,34);
    // Left chair, right chair, table/flowers and right planter are distinct
    // silhouettes so the new rug remains visible between their legs.
    restore(context,[[273,211],[277,212],[279,220],[288,220],[290,224],[290,234],[286,236],[275,236],[272,233],[272,216]]);
    restore(context,[[274,234],[277,234],[277,242],[274,242]]);
    restore(context,[[284,234],[287,234],[287,242],[284,242]]);
    restore(context,[[336,211],[339,211],[340,234],[337,236],[324,236],[321,232],[322,222],[332,220],[334,215]]);
    restore(context,[[324,234],[327,234],[327,242],[324,242]]);
    restore(context,[[336,234],[339,234],[339,242],[336,242]]);
    restore(context,[[311,198],[318,198],[321,207],[322,212],[322,235],[319,237],[296,237],[291,234],[290,211],[311,211]]);
    restore(context,[[292,234],[296,234],[296,243],[292,243]]);
    restore(context,[[316,234],[320,234],[320,243],[316,243]]);
    restore(context,[[344,211],[350,208],[355,210],[356,225],[354,244],[344,244],[340,235],[341,217]]);
  }
  function washstand(context){const b=CabinMotion.washstand;context.drawImage(images.sink,313,321,629,659,b.x,b.y,b.width,b.height);}
  function wallSwitch(context,on){const b=CabinMotion.wallSwitch;context.drawImage(images.switches,on?444:1018,112,on?311:312,664,b.x,b.y,b.width,b.height);}
  function washRim(context){context.save();context.beginPath();context.rect(184,63,18,3);context.clip();washstand(context);context.restore();}
  return {load,draw,duvet,washstand,wallSwitch,washRim};
})();
