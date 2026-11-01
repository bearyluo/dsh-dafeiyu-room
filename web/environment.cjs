// Cohesive garden ground plane; time and precipitation remain driven by live state.
(function(host){
  'use strict';
  const W=480,H=360;
  const supported=new Set(['clear','cloudy','fog','rain','snow','thunder']);
  function presentation(clock,weather){
    const hour=Number.isInteger(clock?.hour)&&clock.hour>=0&&clock.hour<24?clock.hour:null;
    const phase=hour===null?'unknown':hour>=7&&hour<17?'day':hour>=5&&hour<7?'dawn':hour>=17&&hour<19?'dusk':'night';
    const kind=weather?.status==='live'&&supported.has(weather.kind)?weather.kind:'unknown';
    return {phase,kind,precipitation:['rain','thunder'].includes(kind)?'rain':kind==='snow'?'snow':null,
      celestial:hour!==null&&(kind==='clear'||kind==='cloudy'&&[1,2].includes(weather.code)),clouds:kind!=='clear',code:weather?.code};
  }
  const random=i=>{const value=Math.sin(i*127.1+311.7)*43758.5453;return value-Math.floor(value);};
  class Scenery{
    constructor(background,foreground,room,reduced){
      this.bg=background;this.fg=foreground;this.room=room;this.reduced=reduced;this.view=null;this.lamp=true;this.lastPaint=-Infinity;this.baseKey='';
      this.buffer=document.createElement('canvas');this.buffer.width=1600;this.buffer.height=1200;
      background.width=1600;background.height=1200;foreground.width=1600;foreground.height=1200;
      this.garden=new Image();this.garden.onload=()=>{this.baseKey='';this.lastPaint=-Infinity;};this.garden.src='./assets/outdoor-garden-v1.png';
      this.observer=new ResizeObserver(()=>this.measure());this.observer.observe(background.parentElement);this.measure();
    }
    measure(){
      const stage=this.bg.getBoundingClientRect(),room=this.room.getBoundingClientRect();
      if(!stage.width||!stage.height)return;
      this.bounds={x:(room.left-stage.left)/stage.width*W,y:(room.top-stage.top)/stage.height*H,w:room.width/stage.width*W,h:room.height/stage.height*H};
      this.baseKey='';this.lastPaint=-Infinity;
    }
    update(state){this.clock=state.life?.clock;this.weather=state.weather;this.view=presentation(this.clock,this.weather);this.lamp=state.life?.room?.lamp!==false;this.lastPaint=-Infinity;}
    disconnect(){if(this.view){this.view=presentation(this.clock,null);this.lastPaint=-Infinity;}}
    outside(c){
      const b=this.bounds;
      const path=new Path2D();path.rect(0,0,W,H);
      // Protect the roofless room and wooden walls. The doorstep is outdoors.
      path.rect(b.x+b.w*.078,b.y+b.h*.028,b.w*.844,b.h*.85);c.clip(path,'evenodd');
    }
    base(){
      const c=this.buffer.getContext('2d'),v=this.view,b=this.bounds;
      c.setTransform(this.buffer.width/W,0,0,this.buffer.height/H,0,0);
      c.clearRect(0,0,W,H);c.imageSmoothingEnabled=false;c.fillStyle='#64794e';c.fillRect(0,0,W,H);
      if(this.garden.complete&&this.garden.naturalWidth)c.drawImage(this.garden,0,0,W,H);
      c.save();c.globalCompositeOperation='multiply';
      if(v.phase==='night'){c.globalAlpha=.65;c.fillStyle='#3b5878';c.fillRect(0,0,W,H);}
      else if(v.phase==='dawn'){c.globalAlpha=.3;c.fillStyle='#82879c';c.fillRect(0,0,W,H);}
      else if(v.phase==='dusk'){c.globalAlpha=.35;c.fillStyle='#b0867c';c.fillRect(0,0,W,H);}
      if(['rain','thunder','fog','unknown'].includes(v.kind)){c.globalAlpha=.2;c.fillStyle='#6b8292';c.fillRect(0,0,W,H);}
      c.restore();
      if(v.phase==='night'){c.fillStyle='#10223844';c.fillRect(0,0,W,H);}
      const x=b.x+b.w*.085,y=b.y+b.h*.03,w=b.w*.835,h=b.h*.845;
      for(let i=3;i>=1;i--){c.fillStyle='#1d211b18';c.fillRect(x-i,y-i+2,w+i*2,h+i*2);}
    }
    sky(){} // This is an overhead ground plane; there is no horizon strip.
    weatherEffects(c,time){
      const v=this.view,still=this.reduced.matches;
      if(v.precipitation==='rain'){
        // Small wet patches belong on the dirt path, not over tree canopies.
        for(const [x,y,w] of [[240,345,7],[243,356,5],[237,334,4]]){
          c.fillStyle='#647d775c';c.fillRect(x-w/2,y,w,1.1);c.fillRect(x-w/2+1,y-0.5,w-2,.6);
          c.fillStyle='#afc2ae66';const ring=still?2:1+Math.floor(time/280+x)%3;c.fillRect(x-ring,y,ring*2,.35);
        }
        c.fillStyle=v.phase==='night'?'#b6c9d977':'#8aa6b38c';
        for(let i=0;i<(v.kind==='thunder'?260:190);i++){
          const offset=still?0:time*(.12+random(i+7)*.04),y=(random(i+880)*H+offset)%(H+20)-10,x=(random(i+400)*W+offset*.13)%W;
          const length=2.5+(i%4)*.7;for(let j=0;j<length;j+=.8)c.fillRect(x+j*.2,y+j,.32,.85);
        }
      }else if(v.precipitation==='snow'){
        c.fillStyle='#e0e7d9d0';for(let i=0;i<95;i++){
          const x=(random(i+310)*W+(still?0:Math.sin(time*.0006+i)*9)+W)%W,y=(random(i+702)*H+(still?0:time*.018))%H;
          c.fillRect(Math.floor(x),Math.floor(y),i%4===0?2:1,i%4===0?2:1);
        }
      }else if(v.kind==='fog'){
        c.fillStyle='#b9cbc533';for(let i=0;i<4;i++){const x=still?0:Math.sin(time*.0001+i)*30;c.fillRect(x-20,110+i*62,W+40,17);}
      }
      if(['night','dusk'].includes(v.phase)&&this.lamp){
        const b=this.bounds,x=b.x+b.w*.5,y=b.y+b.h*.97;
        for(let i=3;i>=1;i--){c.fillStyle='#ecb35a0c';c.fillRect(Math.round(x-10-i*6),Math.round(y-3),20+i*12,4+i*3);}
      }
      if(v.phase==='night'&&v.kind==='clear'){
        for(let i=0;i<6;i++){
          const x=31+i*77+(still?0:Math.sin(time*.0004+i)*4),y=255+i%3*31+(still?0:Math.cos(time*.0005+i)*4);
          c.fillStyle=still||Math.sin(time*.001+i)>0?'#d7cd80aa':'#a4ad5555';c.fillRect(Math.floor(x),Math.floor(y),1,1);
        }
      }
    }
    draw(time){
      if(!this.view||!this.bounds||time-this.lastPaint<(this.reduced.matches?900:50))return;
      this.lastPaint=time;
      const key=[this.view.phase,this.view.kind,this.view.code,JSON.stringify(this.bounds)].join(':');
      if(this.baseKey!==key){this.base();this.baseKey=key;}
      const b=this.bg.getContext('2d'),f=this.fg.getContext('2d');b.imageSmoothingEnabled=false;f.imageSmoothingEnabled=false;
      b.clearRect(0,0,this.bg.width,this.bg.height);b.drawImage(this.buffer,0,0);
      f.setTransform(this.fg.width/W,0,0,this.fg.height/H,0,0);f.clearRect(0,0,W,H);f.save();this.outside(f);this.weatherEffects(f,time);f.restore();
    }
  }
  const api={presentation,Scenery};if(typeof module==='object')module.exports=api;else host.CabinEnvironment=api;
})(typeof window==='object'?window:{});
