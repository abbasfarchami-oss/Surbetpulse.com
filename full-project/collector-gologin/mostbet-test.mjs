import fs from "node:fs";
const SECRET=fs.readFileSync("/workspace/arbradar/.webhook_secret","utf8").trim();
const URL_="https://surebetpulse.com/api/public/odds-webhook"; const N=+(process.env.N||25);
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const games=[];
function walk(x,league){ if(Array.isArray(x)){for(const y of x)walk(y,league);return;}
  if(!x||typeof x!=="object")return; if(x.match&&x.outcomes){games.push({...x,league});return;}
  const t=(typeof x.title==="string"&&!x.alias)?x.title:league; for(const v of Object.values(x)) if(v&&typeof v==="object") walk(v,t); }
for(let of=0;of<500;of+=100){ const r=await fetch(`https://mostbet.com/api/v3/user/line/list?t[]=2&lc[]=1&l=100&of=${of}&lng=en`,{headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36","accept":"application/json"}});
  if(!r.ok){console.log("feed",r.status);break;} const n0=games.length; walk(await r.json(),"Football"); if(games.length-n0<100)break; await sleep(1100);}
const items=[]; const f=l=>(l>0?"+":"")+l;
for(const g of games){ const m=g.match, h=m.team1?.title, a=m.team2?.title; if(!h||!a)continue;
  const O={}; for(const o of g.outcomes) if(o.odd&&o.active!==false&&+o.odd>1) O[o.alias]=o;
  const base={sport:"Football",league:String(g.league||"Football").slice(0,80),event:`${h} vs ${a}`.slice(0,160),live:true,startsAt:new Date((m.begin_at||0)*1000).toISOString(),source:"collector"};
  const add=(k,market,arr)=>items.push({id:`mb|${g.id}|${k}`.slice(0,80),...base,market,outcomes:arr.map(([l,o])=>({label:String(l).slice(0,40),bookmaker:"Mostbet",odds:+o.odd}))});
  if(O["1"]&&O.x&&O["2"]) add("1X2","1X2",[["Home",O["1"]],["Draw",O.x],["Away",O["2"]]]);
  const val=o=>{const s=o?.outcome_type_mixer_id?.split(":")[1]; return s==null?NaN:+s;};
  if(O.total_over&&O.total_under){const l=val(O.total_over); if(!isNaN(l)) add("OU:"+l,`Over/Under ${l}`,[["Over "+l,O.total_over],["Under "+l,O.total_under]]);}
  if(O.fora_one&&O.fora_two){const l=val(O.fora_one); if(!isNaN(l)) add("AH:"+l,`Asian Handicap ${f(l)}`,[[`${h} ${f(l)}`,O.fora_one],[`${a} ${f(-l)}`,O.fora_two]]);}
}
const batch=items.slice(0,N); console.log(JSON.stringify({games:games.length,lines:items.length,sent:batch.length,examples:batch.filter(i=>i.market!=="1X2").slice(0,1).concat(batch.slice(0,1))}));
if(!process.env.DRY_RUN){const s=Date.now(); try{const p=await fetch(URL_,{method:"POST",headers:{"content-type":"application/json","x-webhook-secret":SECRET},body:JSON.stringify({opportunities:batch}),signal:AbortSignal.timeout(10000)}); console.log("POST",p.status,Date.now()-s+"ms",(await p.text()).slice(0,200));}catch(e){console.log("POST ERR",e.message);}}
