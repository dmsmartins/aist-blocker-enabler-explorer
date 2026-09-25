// Original procedural ambient score: no downloads, copyrighted recordings or network.
export function createAudio(){
 let context=null,master=null,enabled=false,playing=false,timer=null,beat=0;const voices=new Set();
 function tone(frequency,time,duration,volume=.02,type='sine'){
  const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,time);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+Math.min(.12,duration*.2));gain.gain.exponentialRampToValueAtTime(.0001,time+duration);oscillator.connect(gain);gain.connect(master);voices.add(oscillator);oscillator.start(time);oscillator.stop(time+duration+.05);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
 }
 function silence(){clearInterval(timer);timer=null;for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
 function bar(){if(!enabled||!playing||context?.state!=='running')return;const chords=[[130.81,164.81,196],[110,130.81,164.81],[87.31,130.81,174.61],[98,146.83,196]],chord=chords[beat%4],t=context.currentTime+.04;chord.forEach(f=>tone(f,t,4.4,.012));const melody=[0,2,1,2,0,1,2,1];for(let i=0;i<4;i++)tone(chord[melody[(beat*4+i)%melody.length]]*4,t+i*.9,1.5,.018);beat++;}
 function sync(){if(!enabled||!playing){silence();return;}if(context?.state==='running'&&!timer){bar();timer=setInterval(bar,3600);}}
 function unlock(on){enabled=!!on;if(!enabled){silence();return;}try{context ||= new (window.AudioContext||window.webkitAudioContext)();if(!master){master=context.createGain();master.gain.value=.55;master.connect(context.destination);}if(context.state==='suspended')context.resume().then(sync).catch(()=>{});else sync();}catch{enabled=false;}}
 function setPlaying(value){playing=!!value;sync();}
 function play(kind){if(!enabled||context?.state!=='running')return;const notes=({collect:[523,784],open:[392,523,659],return:[659,392],signal:[440,660],complete:[392,523,784],reveal:[330,660]})[kind];notes?.forEach((f,i)=>tone(f,context.currentTime+i*.11,.45,.06));}
 return {unlock,play,setPlaying};
}
