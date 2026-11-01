import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {presentation}=createRequire(import.meta.url)('../web/environment.cjs');
test('the outdoor sky follows the configured clock and precipitation follows only live weather',()=>{
  assert.equal(presentation({hour:1},{status:'live',kind:'clear'}).phase,'night');
  assert.equal(presentation({hour:6},{status:'live',kind:'clear'}).phase,'dawn');
  assert.equal(presentation({hour:12},{status:'live',kind:'rain'}).precipitation,'rain');
  assert.equal(presentation({hour:18},{status:'live',kind:'thunder'}).phase,'dusk');
  assert.equal(presentation({hour:23},{status:'live',kind:'snow'}).precipitation,'snow');
  for(const status of ['stale','unavailable',undefined]){
    const view=presentation({hour:1},{status,kind:'rain'});assert.equal(view.phase,'night');assert.equal(view.precipitation,null);assert.equal(view.kind,'unknown');
  }
});
test('unknown times or overcast sky do not invent night, sunshine, or a visible moon',()=>{
  assert.equal(presentation(null,null).phase,'unknown');
  assert.equal(presentation({hour:26},{status:'live',kind:'clear'}).phase,'unknown');
  assert.equal(presentation({hour:26},{status:'live',kind:'clear'}).celestial,false);
  assert.equal(presentation({hour:1},{status:'live',kind:'cloudy',code:3}).celestial,false);
  assert.equal(presentation({hour:1},{status:'unavailable',kind:'clear'}).celestial,false);
});
