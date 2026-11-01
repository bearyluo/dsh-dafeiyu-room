import test from 'node:test';
import assert from 'node:assert/strict';
import {WeatherService} from '../src/weather.js';
const beijing={name:'北京',latitude:39.9,longitude:116.4,example:true};
test('weather uses current provider timestamps; failure preserves stale attribution instead of invented weather',async()=>{
  let now=Date.UTC(2026,9,31,14),count=0;
  const weather=new WeatherService({now:()=>now,fetcher:async url=>{count++;assert.equal(url.hostname,'api.open-meteo.com');if(count>1)throw Error('offline');return {ok:true,json:async()=>({current:{time:'2026-10-31T14:00',temperature_2m:9.5,weather_code:61,is_day:0}})};}});
  await weather.refresh(beijing);await weather.refresh(beijing);assert.equal(count,1);assert.equal(weather.view(beijing).kind,'rain');assert.equal(weather.view(beijing).status,'live');
  now+=7200000;await weather.refresh(beijing);const stale=weather.view(beijing);assert.equal(stale.status,'stale');assert.equal(stale.kind,'unknown');assert.equal(stale.fetchedAt,Date.UTC(2026,9,31,14));assert.equal(stale.source,'Open-Meteo');
});
test('a late weather response for the previous city cannot replace the selected city',async()=>{
  const resolvers=new Map(),now=Date.UTC(2026,9,31,14);
  const weather=new WeatherService({now:()=>now,fetcher:url=>new Promise(resolve=>resolvers.set(url.searchParams.get('latitude'),()=>resolve({ok:true,json:async()=>({current:{time:'2026-10-31T14:00',temperature_2m:20,weather_code:0,is_day:1}})})))});
  const other={name:'上海',latitude:31.2,longitude:121.5};
  const a=weather.refresh(beijing);weather.invalidate();const b=weather.refresh(other);
  resolvers.get('31.2')();await b;resolvers.get('39.9')();await a;
  assert.equal(weather.view(other).status,'live');assert.equal(weather.view(beijing).status,'unavailable');
});
