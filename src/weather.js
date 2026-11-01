const locationKey=location=>location.latitude+','+location.longitude;
const conditions=code=>code===0?{kind:'clear',label:'晴'}:[1,2,3].includes(code)?{kind:'cloudy',label:code===3?'阴':'多云'}:[45,48].includes(code)?{kind:'fog',label:'雾'}:code>=95?{kind:'thunder',label:'雷雨'}:[71,73,75,77,85,86].includes(code)?{kind:'snow',label:'雪'}:[51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)?{kind:'rain',label:'雨'}:{kind:'unknown',label:'天气未知'};

/** Public, city-level weather only; all model decisions stay in the host. */
export class WeatherService{
  constructor({fetcher=fetch,now=()=>Date.now(),saved=null}={}){
    this.fetcher=fetcher;this.now=now;this.value=saved||null;this.lastAttempt=null;this.pending=new Map();this.searches=new Map();this.controllers=new Set();this.closed=false;this.requestedKey=null;
  }
  async json(url){
    const controller=new AbortController();this.controllers.add(controller);
    try{
      const response=await this.fetcher(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]),redirect:'error'});
      if(!response.ok)throw Error('天气服务暂时不可用');
      return await response.json();
    }finally{this.controllers.delete(controller);}
  }
  invalidate(){this.value=null;this.lastAttempt=null;this.requestedKey=null;}
  saved(){return this.value;}
  view(location){
    const key=locationKey(location),value=this.value?.key===key?this.value:null;
    const base={city:location.name,example:!!location.example,source:'Open-Meteo',attribution:'https://open-meteo.com/'};
    if(!value)return {...base,status:'unavailable',kind:'unknown',label:'天气暂不可用'};
    const fresh=this.now()-value.fetchedAt<=3600000&&Math.abs(this.now()-value.modelTime)<=5400000;
    const {key:_key,...weather}=value;
    return {...base,...weather,status:fresh?'live':'stale',...(fresh?{}:{kind:'unknown',label:'天气缓存已过期'})};
  }
  async refresh(location){
    if(this.closed)return;
    const key=locationKey(location);this.requestedKey=key;
    if(this.pending.has(key))return this.pending.get(key);
    if(this.lastAttempt?.key===key&&this.now()-this.lastAttempt.at<(this.lastAttempt.failed?60000:600000))return;
    this.lastAttempt={key,at:this.now()};
    const request=(async()=>{
      try{
        const url=new URL('https://api.open-meteo.com/v1/forecast');
        url.search=new URLSearchParams({latitude:String(location.latitude),longitude:String(location.longitude),current:'temperature_2m,weather_code,is_day',timezone:'UTC',forecast_days:'1'}).toString();
        const data=await this.json(url),current=data.current;
        if(!current||!Number.isFinite(current.temperature_2m)||!Number.isInteger(current.weather_code)||![0,1].includes(current.is_day))throw Error('天气数据无效');
        const modelTime=Date.parse(current.time+'Z');if(!Number.isFinite(modelTime))throw Error('天气时间无效');
        if(!this.closed&&this.requestedKey===key)this.value={key,...conditions(current.weather_code),code:current.weather_code,temperature:current.temperature_2m,isDay:!!current.is_day,modelTime,fetchedAt:this.now()};
      }catch{
        if(this.lastAttempt?.key===key)this.lastAttempt.failed=true;
        // Preserve a known sample with its original timestamps; never turn a
        // network failure into invented sunshine or refresh a stale timestamp.
      }finally{this.pending.delete(key);}
    })();this.pending.set(key,request);return request;
  }
  async search(query){
    if(typeof query!=='string'||query.trim().length<2||query.length>64||/[\u0000-\u001f]/.test(query))throw Error('请输入2至64个字符的城市名称');
    const key=query.trim(),cached=this.searches.get(key);
    if(cached&&this.now()-cached.at<600000)return cached.value;
    const url=new URL('https://geocoding-api.open-meteo.com/v1/search');url.search=new URLSearchParams({name:key,count:'8',language:'zh',format:'json'}).toString();
    const data=await this.json(url);
    const value=(data.results||[]).filter(row=>typeof row.name==='string'&&Number.isFinite(row.latitude)&&Math.abs(row.latitude)<=90&&Number.isFinite(row.longitude)&&Math.abs(row.longitude)<=180).slice(0,8).map(row=>({name:[...new Set([row.name,row.admin1,row.country].filter(Boolean))].join(' · '),latitude:row.latitude,longitude:row.longitude,timeZone:row.timezone||'UTC'}));
    if(this.searches.size>=16)this.searches.delete(this.searches.keys().next().value);
    this.searches.set(key,{at:this.now(),value});return value;
  }
  close(){this.closed=true;for(const controller of this.controllers)controller.abort();this.controllers.clear();}
}
