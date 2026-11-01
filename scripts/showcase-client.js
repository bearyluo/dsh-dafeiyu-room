const $=id=>document.getElementById(id);
let state=null,busy=false;
async function refresh(){
  if(busy)return;busy=true;
  try{
    const response=await fetch('/showcase-state',{cache:'no-store'});if(!response.ok)throw Error('offline');state=await response.json();
    $('current').textContent=state.done?'全部'+state.total+'种动作播放完毕':state.index+' / '+state.total+' · '+state.label;
    $('stage').textContent=state.error||state.stage;
    $('toggle').textContent=state.done?'已播完':state.running?'暂停播放':'继续播放';$('toggle').disabled=state.done;for(const id of ['frame-start','frame-middle','frame-end'])$(id).disabled=!state.canFrame;
    for(const id of ['entry-start','entry-middle','entry-end'])$(id).disabled=!state.canEntry;
    $('hint').textContent=state.singleAction?'单独循环此动作：走近、落座、停留3秒、起身离开；走位保持原速。':state.computerDemo?'键盘动作演示：没有调用工具或执行真实工作。':'每项停留3秒，走位和起身保持原速。可暂停、跳到上一项或下一项，点击名称会走到位置后自动暂停，方便检查。';
    if(!$('list').children.length)for(const [index,item]of state.items.entries()){
      const li=document.createElement('li'),button=document.createElement('button');button.textContent=item.label;button.onclick=()=>command(index);li.append(button);$('list').append(li);
    }
    for(const [i,li]of [...$('list').children].entries())li.className=i+1===state.index&&!state.done?'active':i+1<state.index||state.done?'complete':'';
  }catch{$('stage').textContent='验收预览连接中断，请等待本地预览恢复';}
  finally{busy=false;}
}
async function command(value){
  try{const response=await fetch('/showcase-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:value})});if(!response.ok)throw Error('invalid');await refresh();}
  catch{$('stage').textContent='播放控制暂时不可用';}
}
$('toggle').onclick=()=>command(state?.running?'pause':'play');$('restart').onclick=()=>command('restart');
$('previous').onclick=()=>command('previous');$('next').onclick=()=>command('next');
refresh();setInterval(refresh,400);

for(const [id,value] of [['frame-start','frame_start'],['frame-middle','frame_middle'],['frame-end','frame_end']])$(id).onclick=()=>command(value);

for(const [id,value] of [['entry-start','entry_start'],['entry-middle','entry_middle'],['entry-end','entry_end']])$(id).onclick=()=>command(value);
