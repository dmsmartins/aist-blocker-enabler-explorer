export function createAudio(){
  let context=null,enabled=false;
  function unlock(on){enabled=!!on;if(!enabled)return;try{context ||= new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume().catch(()=>{});}catch{enabled=false;}}
  function play(kind){if(!enabled||!context||context.state!=='running')return;const notes=({collect:[523,784],open:[392,523,659],return:[659,392],signal:[440,660],complete:[392,523,784],reveal:[330,660]})[kind];if(!notes)return;
    notes.forEach((frequency,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),t=context.currentTime+i*.11;oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.045,t+.025);gain.gain.exponentialRampToValueAtTime(.0001,t+.45);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(t);oscillator.stop(t+.5);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};});
  }
  return {unlock,play};
}
