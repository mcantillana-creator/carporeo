// User-supplied circuit music. Original synth is a fallback if a file fails.
// No recordings, melody transcriptions or samples from commercial games.
export const TRACK_MUSIC=Object.fromEntries(['santiago','cordillera','tololo','pacifico','atacama'].map(id=>[id,`/assets/music/${id}.mp3`]));
export const FINAL_LAP_RATE=1.35;
export function mixLevels(settings,action=false){const music=Math.max(0,Math.min(1,Number(settings.musicVolume??65)/100)),effects=Math.max(0,Math.min(1,Number(settings.effectsVolume??85)/100));return {music:settings.music?music*(action?.12:.22):0,effects:settings.sfx?effects:0};}
export const MUSIC_TEMPO={normal:144,final:198};
export function musicNotes(beat,track='santiago'){
 const variant={santiago:0,pacifico:2,cordillera:1,tololo:3,atacama:4}[track]||0;
 const roots=[50,46,53,48],root=roots[Math.floor(beat/16)%4];
 const pattern=[0,7,12,14,7,19,12,7,3,12,19,14,10,7,12,3];
 return {lead:root+12+pattern[(beat+variant*2)%pattern.length],bass:root-12,chord:[root,root+7,root+14],accent:beat%4===0};
}
export function createAudio(settings){return {
 trackSource:null,trackLoading:null,trackId:null,musicGeneration:0,
 stopTrack(){this.musicGeneration++;if(this.trackSource){try{this.trackSource.stop();}catch{}this.trackSource.disconnect();}this.trackSource=null;this.trackLoading=null;this.trackId=null;},
 async loadTrack(track){if(!TRACK_MUSIC[track]||!this.ctx?.decodeAudioData||this.trackId===track||this.trackLoading===track)return;this.stopTrack();this.trackLoading=track;const generation=this.musicGeneration;try{const response=await fetch(TRACK_MUSIC[track]);if(!response.ok)throw new Error("Audio unavailable");const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());if(generation!==this.musicGeneration)return;const source=this.ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(this.musicGain);source.start();this.trackSource=source;this.trackId=track;}catch{if(generation===this.musicGeneration)this.trackId=track;}finally{if(generation===this.musicGeneration)this.trackLoading=null;}},
 duckUntil:0,lastAir:false,lastDrift:false,skidGain:null,ctx:null,nextBeat:0,beat:0,lastLap:null,lastEmote:null,urgentAt:0,
 tone(midi,time,duration,volume,type='triangle',bus){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);o.connect(g);g.connect(bus||this.ctx.destination);g.gain.setValueAtTime(.0001,time);g.gain.linearRampToValueAtTime(volume,time+.02);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.start(time);o.stop(time+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};},
 cue(kind){if(!['count','go','lastlap','pickup'].includes(kind)||!this.ctx||!settings.sfx||this.ctx.state!=='running')return;const t=this.ctx.currentTime;this.duckUntil=t+.6;
 const notes=kind==='jump'?[67,74,81]:kind==='land'?[48,43]:kind==='drift'?[76,73]:kind==='lastlap'?[76,79,83,88]:kind==='happy'?[72,79,84]:kind==='hurt'?[61,55]:kind==='pickup'?[79,86]:kind==='go'?[83,88]:[69];
 notes.forEach((n,i)=>this.tone(n,t+i*.11,.2,.09*mixLevels(settings).effects,'square'));},
 start(){try{if(!this.ctx){this.ctx=new AudioContext();this.gain=this.ctx.createGain();this.gain.gain.value=0;this.gain.connect(this.ctx.destination);this.osc=this.ctx.createOscillator();this.osc.type='triangle';this.osc.connect(this.gain);this.osc.start();this.skidGain=this.ctx.createGain();this.skidGain.gain.value=0;this.skidGain.connect(this.ctx.destination);this.skid=this.ctx.createOscillator();this.skid.type='triangle';this.skid.frequency.value=430;this.skid.connect(this.skidGain);this.skid.start();this.musicGain=this.ctx.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.ctx.destination);}if(this.ctx.state==='suspended')this.ctx.resume();}catch{}},
 resetRace(){this.stopTrack();this.beat=0;this.nextBeat=this.ctx?.currentTime||0;this.lastLap=null;this.lastEmote=null;this.urgentAt=0;this.lastAir=false;this.lastDrift=false;this.duckUntil=0;},
 update(k,track){if(!this.ctx||!k||this.ctx.state!=='running')return;const now=this.ctx.currentTime;
 if(settings.music&&!k.finished)this.loadTrack(track);if(this.trackSource)this.trackSource.playbackRate.setTargetAtTime(k.lap===2?FINAL_LAP_RATE:1,now,.6);
 const airborne=!!k.air&&!k.falling,sliding=!k.air&&!k.falling&&k.drift>.2;
 this.lastAir=airborne;this.lastDrift=sliding;
 const mix=mixLevels(settings,sliding||airborne||now<this.duckUntil);
 if(this.skidGain)this.skidGain.gain.setTargetAtTime(sliding&&!k.finished?.035*mix.effects:0,now,.06);
 this.osc.frequency.setTargetAtTime(60+k.speed*4+(k.drift||0)*12,now,.08);this.gain.gain.setTargetAtTime(!k.finished?(.04+Math.min(1,k.speed/48)*.04)*mix.effects:0,now,.08);
 this.musicGain.gain.setTargetAtTime(!k.finished?mix.music:0,now,.1);
 if(k.lap===2&&this.lastLap!==2){this.cue('lastlap');this.urgentAt=now+6;}this.lastLap=k.lap;
 if(k.lap===2&&!k.finished&&now>=this.urgentAt){this.cue('count');this.urgentAt=now+6;}
 
 if(this.nextBeat<now-.2)this.nextBeat=now;
 const step=60/(k.lap===2?MUSIC_TEMPO.final:MUSIC_TEMPO.normal)/2;
 while(this.nextBeat<now+.12){const t=this.nextBeat,n=musicNotes(this.beat,track);
 if(settings.music&&!k.finished&&!this.trackSource&&!this.trackLoading){this.tone(n.lead,t,step*.85,.05,'square',this.musicGain);if(n.accent)this.tone(n.bass,t,step*1.7,.12,'triangle',this.musicGain);
 if(this.beat%8===0)n.chord.forEach((pitch,i)=>this.tone(pitch,t+i*.02,step*3,.022,'triangle',this.musicGain));}
 this.beat++;this.nextBeat+=step;
 }
 },
 quiet(){this.stopTrack();if(this.ctx){this.skidGain?.gain.setTargetAtTime(0,this.ctx.currentTime,.06);this.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.1);this.musicGain.gain.setTargetAtTime(0,this.ctx.currentTime,.1);}}
};}
