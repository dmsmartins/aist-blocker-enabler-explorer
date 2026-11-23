const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');
const code = html.match(/function mountIntroFilm\(\) \{[\s\S]*?\n\}\nfunction entryCard/)[0].replace(/\nfunction entryCard$/, '');

function setup(reduce=false) {
  const element=()=>({attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.listeners[k]=f;}});
  const steps=Array.from({length:3},element), scenes=Array.from({length:3},element), pause=element();
  const film={isConnected:true,querySelectorAll:q=>q==='[data-film-step]'?steps:scenes,querySelector:()=>pause,contains:()=>false};
  const mq={matches:reduce,addEventListener(){},removeEventListener(){}};
  let tick;const context={app:{querySelector:()=>film},window:{matchMedia:()=>mq},document:{hidden:false,activeElement:null},setInterval:f=>(tick=f,1),clearInterval:()=>{}};
  vm.runInNewContext(code+';mountIntroFilm()',context);
  return {steps,scenes,pause,tick,mq};
}
test('recommendation and both direct routes remain available',()=>{
  assert.match(html,/href="\.\/assessment-preview\/">Start an assessment/);
  assert.match(html,/href="\.\/timeline\/">Open the Timeline/);
  assert.match(html,/data-entry="explore">Explore directly/);
  assert.match(html,/class="lifecycle-art hero-visual">\$\{timelinePreviewSvg\(\)\}/);
});
test('animation progresses, selects a step, pauses and resumes',()=>{
  const {steps,scenes,pause,tick}=setup();
  tick();assert.equal(steps[1].attrs['aria-pressed'],'true');assert.equal(scenes[1].hidden,false);
  steps[2].listeners.click();assert.equal(steps[2].attrs['aria-pressed'],'true');tick();assert.equal(steps[2].attrs['aria-pressed'],'true');
  pause.listeners.click();tick();assert.equal(steps[0].attrs['aria-pressed'],'true');
});
test('reduced motion starts paused',()=>{
  const {steps,pause,tick}=setup(true);tick();assert.equal(steps[0].attrs['aria-pressed'],'true');assert.equal(pause.attrs['aria-label'],'Play animation');
});
