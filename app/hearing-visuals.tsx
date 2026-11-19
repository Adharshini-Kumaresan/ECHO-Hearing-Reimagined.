'use client';
import {useEffect,useRef,useState} from 'react';
import {Play,Pause,RotateCcw} from 'lucide-react';
import {lockPageScroll} from './page-scroll-lock';

export function EarVector({className=''}:{className?:string}){
  return <svg className={className} viewBox="0 0 240 300" role="img" aria-label="Illustrated human outer ear"><path d="M148 277C112 300 72 264 78 225C42 190 33 125 55 70C85-8 198 4 208 83C218 150 163 170 158 218C157 242 166 263 148 277Z" fill="#f2a678" stroke="currentColor" strokeWidth="7"/><path d="M88 202C65 171 60 121 78 81C101 30 170 39 181 83C193 127 153 136 138 174M103 230C92 198 121 192 129 174C140 151 128 134 104 145C85 153 84 176 99 183M87 113C89 83 122 66 146 80C166 91 156 113 141 119" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/><path d="M121 151Q146 154 138 179" fill="none" stroke="#ffe9bd" strokeWidth="5" strokeLinecap="round"/></svg>;
}
export function HearingMotif({kind='wave'}:{kind?:'wave'|'ear'|'vinyl'|'cells'}){
  if(kind==='ear')return <EarVector className="motif-ear"/>;
  return <svg className={'hearing-motif motif-'+kind} viewBox="0 0 260 160" role="img" aria-label={kind==='wave'?'Animated sound waveform':kind==='vinyl'?'Vinyl record with a musical note':'Schematic sensory hair cells'}>
    {kind==='wave'?<>{Array.from({length:25},(_,i)=><rect className="equalizer-bar" key={i} x={8+i*10} y={80-[15,27,47,67,38,55,18][i%7]} width="5" height={2*[15,27,47,67,38,55,18][i%7]} rx="2" fill="currentColor" style={{animationDelay:`${-i*.13}s`}}/>)}</>:kind==='vinyl'?<><g className="vinyl-turn"><circle cx="110" cy="80" r="71" fill="#093c1c"/><circle cx="110" cy="80" r="57" fill="none" stroke="#9bd62b" strokeWidth="1"/><circle cx="110" cy="80" r="47" fill="none" stroke="#9bd62b" strokeWidth="1"/><circle cx="110" cy="80" r="25" fill="#f17c45"/><circle cx="110" cy="80" r="6" fill="#f4efda"/><path d="M54 49Q73 17 106 23" fill="none" stroke="#f8f0d9" strokeWidth="4" opacity=".6"/></g><path d="M221 25L203 104Q183 97 181 114Q187 132 204 118L228 43L249 36V17Z" fill="currentColor"/></>:<><path d="M7 129Q130 102 253 129" fill="none" stroke="currentColor" strokeWidth="4"/>{Array.from({length:7},(_,i)=><g key={i} className="hair-cell" style={{animationDelay:`${-i*.15}s`}}><rect x={18+i*33} y="73" width="22" height="48" rx="10" fill="#f17c45" stroke="currentColor" strokeWidth="2"/><path d={`M${23+i*33} 75V50M${29+i*33} 74V42M${35+i*33} 75V32`} stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></g>)}</>}
  </svg>;
}

export function OpeningTrailer({onClose}:{onClose:()=>void}){
  const skip=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{
    const unlock=lockPageScroll();const previous=document.activeElement as HTMLElement|null;skip.current?.focus();
    const timer=setTimeout(onClose,5000);
    function key(event:KeyboardEvent){if(event.key==='Escape')onClose();if(event.key==='Tab'){event.preventDefault();skip.current?.focus();}}
    window.addEventListener('keydown',key);
    return()=>{clearTimeout(timer);unlock();window.removeEventListener('keydown',key);previous?.focus()};
  },[onClose]);
  return <div className="echo-trailer paper" role="dialog" aria-modal="true" aria-label="ECHO opening film, five seconds">
    <span className="trailer-brand">echo ✳</span><button ref={skip} className="trailer-skip" onClick={onClose}>SKIP INTRO</button>
    <div className="trailer-scene scene-sound"><HearingMotif/><h2>IT STARTS<br/>WITH A WAVE.</h2><span>MUSIC. SCIENCE. A LITTLE CURIOSITY.</span></div>
    <div className="trailer-scene scene-ear"><EarVector/><h2>A LITTLE<br/><i>WONDER.</i></h2><span>ONE REMARKABLE PAIR OF EARS.</span></div>
    <div className="trailer-scene scene-echo"><span className="trailer-orbit"/><h2>HEAR<br/>YOUR WORLD.</h2><span>WELCOME TO ECHO.</span></div>
    <div className="trailer-progress" aria-hidden="true"><span/></div><span className="trailer-caption">A SHORT FILM FOR YOUR EYES · SOUND OFF</span>
  </div>;
}

const earParts=[
  {name:'Outer ear',tag:'CATCH THE WAVE',text:'The visible pinna collects incoming sound and directs it into the ear canal.',x:145,y:230},
  {name:'Ear canal',tag:'A WAY INSIDE',text:'The ear canal carries sound toward the eardrum.',x:320,y:250},
  {name:'Eardrum',tag:'FROM SOUND TO MOTION',text:'The eardrum vibrates when sound reaches it.',x:427,y:240},
  {name:'Middle-ear bones',tag:'THREE TINY MOVERS',text:'The malleus, incus and stapes pass vibrations from the eardrum toward the inner ear.',x:488,y:214},
  {name:'Cochlea',tag:'MEET THE SPIRAL',text:'Inside this fluid-filled structure, sensory hair cells help turn vibrations into electrical signals.',x:625,y:290},
  {name:'Auditory nerve',tag:'THE MESSAGE CONTINUES',text:'The auditory nerve carries signals toward the brain, where they are interpreted as sound.',x:754,y:265},
];
export function EarAnatomy(){
  const [part,setPart]=useState(0),[playing,setPlaying]=useState(false);const active=earParts[part];
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setPart(previous=>{if(previous===5){setPlaying(false);return 5;}return previous+1}),1600);return()=>clearInterval(timer)},[playing]);
  function choose(index:number){setPlaying(false);setPart(index);}
  return <section className="ear-anatomy paper" id="inside-your-ears"><div className="anatomy-heading"><div><span className="cut-label">A LITTLE SCIENCE. A LOT OF WONDER.</span><h2>SMALL PARTS.<br/><i>BIG FEELINGS.</i></h2></div><p>From your favourite chorus to a familiar voice.<br/>Follow the journey inside your ear.</p></div>
    <div className="ear-plate"><span className="paper-tape"/><div className="ear-plate-top"><span>THE ART OF LISTENING</span><span>INTERACTIVE EAR CUTAWAY</span></div>
      <svg className={'ear-cutaway '+(playing?'signal-playing':'')} viewBox="0 0 900 440" role="img" aria-label={`Simplified ear cutaway. Selected part: ${active.name}. Use the part buttons below to explore.`}>
        <defs><linearGradient id="ear-tissue" x2="0" y2="1"><stop stopColor="#efb28b"/><stop offset="1" stopColor="#db865b"/></linearGradient></defs>
        <path className="ear-region" d="M78 100Q163 10 269 95L377 134L435 165L435 343L260 344Q132 419 80 325Z" fill="#ecd7b2"/>
        <path d="M199 370C156 403 98 355 111 305C65 269 63 168 92 119C131 49 233 68 240 143C247 208 193 236 191 291C191 321 218 345 199 370Z" fill="url(#ear-tissue)" stroke="#633c23" strokeWidth="4"/>
        <path d="M130 280C104 251 99 178 120 140C144 99 204 114 212 152C223 194 175 210 166 246M142 302C133 274 156 266 167 250C179 229 164 210 147 219C127 231 125 246 142 253M134 180C143 146 180 140 188 165" fill="none" stroke="#8a4e2d" strokeWidth="5" strokeLinecap="round"/>
        <path d="M186 253Q236 224 278 240L409 230L420 282L286 290Q227 273 192 288Z" fill="#c17c51" stroke="#633c23" strokeWidth="3"/>
        <path d="M202 259Q256 248 287 262L409 253" stroke="#6b3a20" strokeWidth="16" fill="none" strokeLinecap="round"/>
        <path d="M421 222L435 292" fill="none" stroke="#e67f53" strokeWidth="12" strokeLinecap="round"/>
        <path d="M438 171Q511 150 551 193L555 302Q511 319 443 321Z" fill="#f4e8c8" stroke="#b89b73" strokeWidth="2"/>
        <path d="M443 248L462 211L483 219L494 198L518 205L537 238" fill="none" stroke="#775b34" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round"/>
        <circle cx="460" cy="210" r="10" fill="#f6ce7d" stroke="#775b34" strokeWidth="3"/><circle cx="494" cy="198" r="9" fill="#f6ce7d" stroke="#775b34" strokeWidth="3"/>
        <path d="M530 226L549 236L540 251Z" fill="#f6ce7d" stroke="#775b34" strokeWidth="3"/>
        <path d="M581 220C549 176 557 103 596 107C639 114 636 175 615 206M612 211C621 161 652 125 674 151C696 181 662 214 635 225M589 219C553 191 529 214 555 239" fill="none" stroke="#b97e43" strokeWidth="12"/>
        <path d="M568 262C602 224 664 228 681 272C708 339 631 378 589 344C543 307 576 264 614 267C648 271 653 309 630 319C608 330 590 309 607 298" fill="none" stroke="#b97e43" strokeWidth="24" strokeLinecap="round"/>
        <path d="M568 262C602 224 664 228 681 272C708 339 631 378 589 344C543 307 576 264 614 267C648 271 653 309 630 319C608 330 590 309 607 298" fill="none" stroke="#f3cd7a" strokeWidth="11" strokeLinecap="round"/>
        <path d="M667 283L790 236M670 294L796 267M670 307L793 296" stroke="#e5a547" strokeWidth="9" fill="none" strokeLinecap="round"/>
        <path d="M485 305L536 385" stroke="#c69666" strokeWidth="19" strokeLinecap="round"/>
        <g className="incoming-waves" fill="none" stroke="#6a9945" strokeWidth="3"><path d="M20 218Q43 247 20 277"/><path d="M40 209Q73 247 40 286"/><path d="M60 201Q99 247 60 294"/></g>
        <path className="sound-route" d="M30 250L144 250L323 261L427 257L473 219L535 240L620 290L789 267" fill="none" stroke="#f06331" strokeWidth="3" strokeDasharray="4 10" opacity=".65"/>
        {earParts.map((item,index)=><g key={item.name} role="button" tabIndex={0} aria-label={`Explore ${item.name}`} aria-pressed={part===index} onClick={()=>choose(index)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(index)}}} className={'anatomy-point '+(part===index?'active':'')}><circle cx={item.x} cy={item.y} r="22" className="point-halo"/><circle cx={item.x} cy={item.y} r="13" fill={part===index?'#f17c45':'#093c1c'}/><text x={item.x} y={item.y+4} textAnchor="middle" fill="#fff7dc" fontSize="10" fontFamily="sans-serif">{index+1}</text></g>)}
        <g fill="#315239" fontSize="13" fontFamily="sans-serif" letterSpacing="2"><text x="90" y="37">OUTER EAR</text><text x="405" y="76">MIDDLE EAR</text><text x="620" y="76">INNER EAR</text><text x="757" y="192" fontSize="11" letterSpacing="0">TO THE BRAIN</text></g>
        <path d="M350 100V370M558 90V390" stroke="#607e54" strokeWidth="1" strokeDasharray="4 8" opacity=".4"/>
      </svg>
      <div className="ear-parts" aria-label="Parts of the ear">{earParts.map((item,index)=><button key={item.name} aria-pressed={part===index} onClick={()=>choose(index)}><span>{index+1}</span>{item.name}</button>)}</div>
      <div className="ear-explanation" aria-live="polite"><div><span>{active.tag}</span><h3>{active.name}</h3><p>{active.text}</p></div><button className="ear-follow" onClick={()=>{if(playing)setPlaying(false);else{setPart(0);setPlaying(true)}}}>{playing?<Pause size={18}/>:<Play size={18}/>} {playing?'Pause the journey':'Follow a sound'}</button></div>
      <div className="anatomy-credit"><span>EDUCATIONAL SCHEMATIC · NOT TO SCALE</span><a href="https://www.nidcd.nih.gov/health/how-do-we-hear" target="_blank" rel="noreferrer">Explore the science · NIH / NIDCD</a></div>
    </div>
  </section>;
}
export function SoundScience(){
  const [frequency,setFrequency]=useState(1000),[amplitude,setAmplitude]=useState(45);
  const cycles=2+Math.log2(frequency/250)*2;
  const path=Array.from({length:241},(_,index)=>`${index?'L':'M'}${index*2},${100-Math.sin(index/240*Math.PI*2*cycles)*amplitude}`).join(' ');
  return <section className="sound-science paper"><div className="science-heading"><span className="cut-label">MUSIC MEETS MECHANICS</span><h2>GOOD VIBRATIONS.<br/><i>GREAT LITTLE SCIENCE.</i></h2></div><div className="science-grid">
    <article className="wave-lab"><span className="science-tag">THE WAVE LAB</span><h3>See what sound does.</h3><svg viewBox="0 0 480 200" role="img" aria-label={`Waveform illustration: ${frequency} hertz, relative amplitude ${amplitude}`}><path d="M0 100H480M0 50H480M0 150H480" stroke="#466447" strokeWidth="1"/><path d={path} fill="none" stroke="#bcf900" strokeWidth="4"/><circle className="wave-dot" cx="240" cy={100-Math.sin(Math.PI*cycles)*amplitude} r="6" fill="#f17c45"/></svg><label>FREQUENCY <strong>{frequency.toLocaleString()} Hz</strong><input aria-label="Waveform frequency" type="range" min="250" max="8000" step="250" value={frequency} onChange={event=>setFrequency(Number(event.target.value))}/></label><label>RELATIVE AMPLITUDE <strong>{amplitude<40?'SMALLER':'LARGER'}</strong><input aria-label="Waveform amplitude" type="range" min="12" max="78" value={amplitude} onChange={event=>setAmplitude(Number(event.target.value))}/></label><p>More cycles suggest a higher pitch. A taller wave shows a greater amplitude.</p><small>VISUAL EXPLORATION ONLY · NO AUDIO PLAYS · AMPLITUDE IS NOT A dB MEASUREMENT</small></article>
    <article className="hair-cell-card"><span className="paper-tape"/><span className="science-tag">INSIDE THE COCHLEA</span><HearingMotif kind="cells"/><h3>TINY CELLS.<br/>A BIG CONNECTION.</h3><p>Movement inside the cochlea bends sensory hair-cell bundles, helping create signals for the auditory nerve.</p><span className="hand-note">Small enough to miss.<br/>Too important to forget.</span></article>
    <article className="stereo-card"><span className="science-tag">TWO SIDES OF YOUR STORY</span><div className="stereo-ears"><EarVector/><span>L<br/>+<br/>R</span><EarVector/></div><h3>LEFT EAR.<br/>RIGHT HERE.</h3><p>ECHO presents signals to each headphone channel separately. That’s why your stereo check comes first.</p><div className="stereo-pulses"><span>LEFT</span><HearingMotif/><span>RIGHT</span></div></article>
  </div></section>;
}
