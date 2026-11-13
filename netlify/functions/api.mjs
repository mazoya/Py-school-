import {getStore} from "@netlify/blobs";
import {COURSE,EXAM,CERT,SKILLS} from "./content.mjs";
export const config={path:"/api"};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json"}});
const rnd=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x%32]).join("");
export default async (req)=>{
  const st=getStore({name:"pyschool",consistency:"strong"}),get=k=>st.get(k,{type:"json"}),set=(k,v)=>st.setJSON(k,v);
  const b=await req.json().catch(()=>({})),a=b.a;
  const cfg=(await get("cfg"))||{session:"S1"};
  const admin=b.pw&&process.env.ADMIN_PASSWORD&&b.pw===process.env.ADMIN_PASSWORD;
  if(a?.startsWith("adm_")&&!admin)return J({e:"Mot de passe admin incorrect"},401);
  if(a==="adm_gen"){const code="PY-"+rnd(4)+"-"+rnd(4),idx=(await get("idx"))||[];
    await set("c/"+code,{name:b.name,phone:b.phone,session:cfg.session,used:false,at:Date.now(),attempts:0});idx.push(code);await set("idx",idx);return J({code,session:cfg.session});}
  if(a==="adm_list"){const idx=(await get("idx"))||[],rows=[];for(const c of idx)rows.push({code:c,...(await get("c/"+c))});return J({session:cfg.session,rows});}
  if(a==="adm_revoke"){const r=await get("c/"+b.code);if(r){r.revoked=true;await set("c/"+b.code,r);}return J({ok:1});}
  if(a==="adm_newsession"){cfg.session="S"+Date.now();await set("cfg",cfg);return J({session:cfg.session});}
  if(a==="redeem"){const c=String(b.code||"").trim().toUpperCase(),r=await get("c/"+c);
    if(!r||r.used||r.revoked||r.session!==cfg.session)return J({e:"Code invalide, déjà utilisé ou expiré. Demandez un nouveau code à l'administrateur."},403);
    r.used=true;r.usedAt=Date.now();const t=rnd(32);await set("c/"+c,r);await set("t/"+t,{code:c});return J({token:t,name:r.name});}
  if(a==="verify"){const r=await get("c/"+String(b.id||"").toUpperCase());
    if(!r||!r.passed||r.revoked)return J({e:"Certificat introuvable ou non valide."},404);
    return J({name:r.certName||r.name,score:r.score,date:new Date(r.passedAt).toLocaleDateString("fr-FR"),id:b.id,skills:SKILLS});}
  const t=b.token&&await get("t/"+b.token),c=t?.code,r=c&&await get("c/"+c);
  if(!r||r.revoked||r.session!==cfg.session)return J({e:"Session expirée : demandez un nouveau code."},403);
  if(a==="course")return J({html:COURSE});
  if(a==="exam")return J({q:EXAM.map(([q,o])=>({q,o})),attempts:r.attempts||0,passed:!!r.passed});
  if(a==="submit"){if(!r.passed&&(r.attempts||0)>=3)return J({e:"3 tentatives utilisées. Contactez l'administrateur."},403);
    r.attempts=(r.attempts||0)+1;const ok=EXAM.filter((x,i)=>b.answers?.[i]===x[2]).length,pct=Math.round(ok*100/EXAM.length);
    if(pct>=70&&!r.passed){r.passed=true;r.score=pct;r.passedAt=Date.now();}await set("c/"+c,r);return J({pct,passed:pct>=70,attempts:r.attempts});}
  if(a==="cert"){if(!r.passed)return J({e:"Réussissez d'abord l'examen final (70 % minimum)."},403);
    if(b.name){r.certName=String(b.name).slice(0,60);await set("c/"+c,r);}
    return J({svg:CERT,score:r.score,date:new Date(r.passedAt).toLocaleDateString("fr-FR"),id:c});}
  return J({e:"?"},400);
};
