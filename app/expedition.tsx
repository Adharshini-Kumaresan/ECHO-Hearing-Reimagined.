import {useEffect, useRef, type PointerEvent} from 'react';
import {detection, testFrequencies, type Trial} from './screening';

export type Lane = 0 | 1;
export type Shot = { id: number; lane: Lane; hit: boolean };

export function Arena({shot, lane, steer, paused}:{
  shot:Shot|null; lane:Lane; steer:(lane:Lane)=>void; paused:boolean;
}) {
  const arena=useRef<HTMLDivElement>(null);
  const laser=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if (!shot?.hit || paused || !arena.current || !laser.current) return;
    const projectile=laser.current;
    const enemies=arena.current.querySelectorAll<HTMLElement>(`.lane-${shot.lane} .arena-enemy`);
    const start=performance.now();
    let frame=0;
    let previousTop=projectile.getBoundingClientRect().bottom;

    function checkHit(now:number){
      if (now-start>420){
        const target=Array.from(enemies).filter(enemy=>!enemy.dataset.hit)
          .sort((first,second)=>second.getBoundingClientRect().bottom-first.getBoundingClientRect().bottom)[0];
        if(target)target.dataset.hit='true';
        projectile.style.visibility="hidden";
        return;
      }
      const beam=projectile.getBoundingClientRect();
      for (const enemy of enemies){
        if (enemy.dataset.hit) continue;
        const target=enemy.getBoundingClientRect();
        if (target.bottom>=beam.top && target.top<=previousTop &&
            target.left<=beam.right && target.right>=beam.left){
          enemy.dataset.hit='true';
          projectile.style.visibility='hidden';
          return;
        }
      }
      previousTop=beam.top;
      frame=requestAnimationFrame(checkHit);
    }
    frame=requestAnimationFrame(checkHit);
    return()=>cancelAnimationFrame(frame);
  },[shot,paused]);

  function steerWithPointer(event:PointerEvent<HTMLDivElement>){
    if (paused || event.button!==0) return;
    const bounds=event.currentTarget.getBoundingClientRect();
    steer(event.clientX<bounds.left+bounds.width/2?0:1);
  }

  return <div ref={arena} className={'echo-arena'+(paused?' frozen':'')} onPointerDown={steerWithPointer} aria-hidden="true">
    <div className="arena-flank flank-left"/><div className="arena-flank flank-right"/>
    <div className="arena-track"/><div className="arena-haze"/>
    {([0,1] as const).map(side=><div className={'enemy-lane lane-'+side} key={side}>
      {[0,1,2].map(i=><div className="arena-enemy" key={i} onAnimationIteration={event=>delete event.currentTarget.dataset.hit} style={{animationDelay:`-${i*2.3+side*.8}s`}}><span/></div>)}
    </div>)}
    <div className={`arena-ship aim-${lane}`}><i className="ship-exhaust"/><i className="ship-hull"/><i className="ship-canopy"/></div>
    {shot&&<div ref={laser} className={`arena-laser aim-${shot.lane}`} key={shot.id}/>}
  </div>;
}

export function DetectionChart({trials,protocol}:{trials:Trial[];protocol?:string}) {
  const xs = (i:number)=>85+i*100;
  const ys = (level:number)=>30+(level-15)*3.18;
  const ears = [0,1].map(ear=>testFrequencies.map(freq=>detection(trials,ear,freq,protocol)));
  return <>
    <svg className="audiogram" viewBox="0 0 650 337" role="img" aria-label="Detection levels by frequency. Exact values are listed below.">
      <rect x="70" y="30" width="530" height="255" rx="3" fill="#f5f1fb"/>
      {[15,30,45,60,75,95].map(level=><g key={level}><line x1="70" x2="600" y1={ys(level)} y2={ys(level)} stroke="#ddd4ea"/><text x="59" y={ys(level)+4} textAnchor="end" fontSize="13">{level}</text></g>)}
      {testFrequencies.map((freq,i)=><g key={freq}><line x1={xs(i)} x2={xs(i)} y1="30" y2="285" stroke="#e2daed"/><text x={xs(i)} y="307" textAnchor="middle" fontSize="13">{freq}</text></g>)}
      {ears.map((points,ear)=><g key={ear} stroke={ear===0?'#5a54b0':'#b13c38'} strokeWidth="2.5">
        {points.map((point,i)=>{
          const prior=points[i-1];
          if(point.status==='pending'||point.level===null)return null;
          const x=xs(i)+(ear===0?-4:4), y=ys(point.level);
          return <g key={i}>{prior&&prior.status!=='pending'&&prior.level!==null&&<line x1={x-100} x2={x} y1={ys(prior.level)} y2={y}/>}
            {ear===0?<path d={`M${x-5} ${y-5}l10 10m-10 0l10 -10`}/>:<circle cx={x} cy={y} r="5" fill="white"/>}</g>;
        })}
      </g>)}
      <text x="335" y="329" textAnchor="middle" fontSize="12">Frequency (Hz)</text>
      <text x="17" y="165" textAnchor="middle" transform="rotate(-90 17 165)" fontSize="12">Relative playback step</text>
    </svg>
    <table className="echo-response-table">
      <thead><tr><th scope="col">Frequency</th><th scope="col">× Left channel</th><th scope="col">○ Right channel</th></tr></thead>
      <tbody>{testFrequencies.map((freq,i)=><tr key={freq}><th scope="row">{freq.toLocaleString()} Hz</th>{ears.map((points,ear)=>{
        const point=points[i];
        const label=point.status==='pending'?'Incomplete':point.status==='above-range'?'No reliable level':point.status==='at-floor'?'≤ 15':point.level;
        return <td key={ear}>{label}</td>;
      })}</tr>)}</tbody>
    </table>
    <p className="muted">Levels are relative to this session’s playback setup. The estimate uses on-time shots on the correct side and repeats missed steps. The report shows the channel that played each tone.</p>
  </>;
}
