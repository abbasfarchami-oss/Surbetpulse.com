import fs from "node:fs"; import { parse1xV3 } from "./lines.mjs";
const C = JSON.parse(fs.readFileSync("config.json","utf8"));
const URLS = (process.env.URLS||"").split(",").filter(Boolean);
const SECRET = process.env.DRY_RUN ? "" : fs.readFileSync(process.env.WEBHOOK_SECRET_FILE,"utf8").trim();
const Q = "cfView=3&count=50&fcountry=197&gr=285&grMode=4&lng=en&ref=1&selectedMs=1.1,2.1,10.1";
const ROUNDS = +(process.env.ROUNDS||12), DELAY = +(process.env.DELAY||5)*1000;
const prev = new Map(); const lat = []; const stats = [];
const lbl = {1:"Home",2:"Draw",3:"Away"};
function validate(o){ const req=["id","sport","league","event","market","live","startsAt","outcomes","source"];
  return req.every(k=>k in o) && typeof o.live==="boolean" && o.outcomes.length>=2 && o.outcomes.length<=3 && o.outcomes.every(x=>x.label&&x.bookmaker&&x.odds>1); }
for (let r=0;r<ROUNDS;r++){
  const t0=Date.now(); const items=[]; let games={line:0,live:0}, lines=0, changes=[];
  for (const live of [true,false]) {
    const res = await fetch(`https://1xbet.fi/service-api/main-${live?"live":"line"}-feed/v3/games1x2?${Q}`,{headers:{"user-agent":"Mozilla/5.0"}});
    if(!res.ok){ console.log("feed",live,res.status); continue; }
    for (const g of await res.json()) { if (g.sport?.id!==1) continue; const e=parse1xV3(g); games[live?"live":"line"]++;
      const mk = {...e.mk}; if (Object.keys(e.o).length) mk["1X2"]=e.o;
      for (const [m,s] of Object.entries(mk)) { let ts,mname,lab;
        if(m==="1X2"){ts=[1,2,3].filter(t=>s[t]); mname="1X2"; lab=t=>lbl[t];}
        else if(m.startsWith("OU:")){const l=+m.slice(3); ts=["o","u"]; mname=`Over/Under ${l}`; lab=t=>(t==="o"?"Over ":"Under ")+l;}
        else {const l=+m.slice(3); ts=["h","a"]; mname=`Asian Handicap ${l>0?"+":""}${l}`; lab=t=>t==="h"?`${e.home} ${l>0?"+":""}${l}`:`${e.away} ${-l>0?"+":""}${-l}`;}
        if(!ts.every(t=>s[t])||ts.length<2) continue; lines++;
        const id=`1x|${e.id}|${m}`.slice(0,80);
        const outcomes=ts.map(t=>{const k=id+t, p=prev.get(k), o={label:String(lab(t)).slice(0,40),bookmaker:"1xBet",odds:+s[t]}; if(p&&p!==o.odds){o.prevOdds=p; changes.push(`${e.home} vs ${e.away} ${mname} ${o.label}: ${p}->${o.odds}`);} prev.set(k,o.odds); return o;});
        items.push({id,sport:"Football",league:String(e.league).slice(0,80),event:`${e.home} vs ${e.away}`.slice(0,160),market:mname,live,startsAt:new Date((e.start||0)*1000).toISOString(),outcomes,source:"collector"});
      }}
  }
  // priority: live first, changed first
  items.sort((a,b)=>(b.live-a.live)||((b.outcomes.some(o=>o.prevOdds)?1:0)-(a.outcomes.some(o=>o.prevOdds)?1:0)));
  const batch=items.slice(0,500); const bad=batch.filter(o=>!validate(o)).length;
  const st={round:r+1,games,lines,sent:batch.length,invalid:bad,changes:changes.length,sample:changes.slice(0,3),fetchMs:Date.now()-t0,post:[]};
  if(!process.env.DRY_RUN) for (const u of URLS){ const s=Date.now(); try{ const p=await fetch(u,{method:"POST",headers:{"content-type":"application/json","x-webhook-secret":SECRET},body:JSON.stringify({opportunities:batch})}); const ms=Date.now()-s; lat.push(ms); st.post.push(`${p.status} ${ms}ms ${(await p.text()).slice(0,120)}`);}catch(e){st.post.push("ERR "+e.message);} }
  else if(r===0) fs.writeFileSync("/tmp/live1x-dry.json",JSON.stringify({opportunities:batch.slice(0,3)},null,1));
  console.log(JSON.stringify(st));
  await new Promise(z=>setTimeout(z,Math.max(0,DELAY-(Date.now()-t0))));
}
if(lat.length){lat.sort((a,b)=>a-b); console.log("LATENCY median",lat[lat.length>>1],"p95",lat[Math.floor(lat.length*0.95)]);}
