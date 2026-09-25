export const CHAPTERS = ['SPARK', 'SHAPE', 'BUILD', 'DEPLOY', 'EVOLVE', 'TRANSITION'];
// Functional accents match the Explorer. World palettes remain soft blue/teal.
export const POWER_STYLE = {
  Frame: {color:'#1f7ae0', symbol:'◎', verb:'Reveal', message:'A hidden route takes shape.'},
  Commit: {color:'#7b3fe4', symbol:'◇', verb:'Connect', message:'Connection established.'},
  Equip: {color:'#2e9f66', symbol:'△', verb:'Build', message:'Missing structures assembled.'},
  Assure: {color:'#eb7f35', symbol:'⬡', verb:'Verify', message:'A protected corridor is established.'},
  Operate: {color:'#d84b55', symbol:'≋', verb:'Stabilise', message:'System stabilised.'},
  Learn: {color:'#a98500', symbol:'↻', verb:'Adapt', message:'The route adapts.'}
};
export const powerStyle = key => POWER_STYLE[key] || {color:'#307e8b',symbol:'◈',verb:'Activate',message:'A new path takes shape.'};
export const THEMES = [
  {sky:'#daeaf1',low:'#b9dddf',mist:'#f6f6ea',rock:'#517b83',leaf:'#72a3a0'},
  {sky:'#d8e9ef',low:'#b1d5df',mist:'#edf4f1',rock:'#4e7888',leaf:'#7ba8a5'},
  {sky:'#d4e9e7',low:'#afd4ce',mist:'#f1f2df',rock:'#4b7b79',leaf:'#79a792'},
  {sky:'#dee9ed',low:'#b7d3de',mist:'#f5f0e4',rock:'#557887',leaf:'#7aa19b'},
  {sky:'#dcece5',low:'#b2d8cf',mist:'#f5f4df',rock:'#4c8079',leaf:'#84ad95'},
  {sky:'#e6eeeb',low:'#c8e2df',mist:'#fff5df',rock:'#648887',leaf:'#93b6a3'}
];
export const PHYSICS = {speed:260,acceleration:1900,friction:2200,gravity:1500,jump:650,coyote:.12,buffer:.14,width:24,height:28};
export const WORLD = {width:2800,height:1450,hubX:1400,hubY:1200};
export const SAVE_KEY = 'aistScaleRunProgressV2';

export const ABILITIES={Frame:{key:'1',name:'Reveal steps',hint:'Creates temporary stepping stones ahead for 8 seconds.'},Commit:{key:'2',name:'Dash',hint:'A short burst across a gap in your facing direction.'},Equip:{key:'3',name:'Boost jump / break',hint:'Charges a higher jump, or adds one air jump. At a ready blocker, assembles the tools and breaks the barrier.'},Assure:{key:'4',name:'Glide',hint:'Slows your fall for 8 seconds.'},Operate:{key:'5',name:'Sprint',hint:'Faster movement for 8 seconds.'},Learn:{key:'6',name:'Recall',hint:'Return directly to the central portal.'}};
