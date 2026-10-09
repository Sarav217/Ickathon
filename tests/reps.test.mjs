import { RepCounter } from '../extension/lib/reps.js';
const P=(x,y,v=1)=>({x,y,visibility:v});
function body({kneeBend=0,armsUp=false,legsWide=false}={}){
  const lm=Array.from({length:33},()=>P(.5,.5));
  lm[0]=P(.5,.2); lm[11]=P(.55,.3); lm[12]=P(.45,.3);
  lm[15]=armsUp?P(.65,.1):P(.58,.55); lm[16]=armsUp?P(.35,.1):P(.42,.55);
  lm[23]=P(.54,.55); lm[24]=P(.46,.55);
  // knee: straight leg = hip(.55) knee(.75) ankle(.95). Bend: knee forward (x offset), ankle fixed
  const kx=kneeBend; lm[25]=P(.54+kx,.72); lm[26]=P(.46-kx,.72);
  const ax=legsWide?.2:0; lm[27]=P(.54+ax,.95); lm[28]=P(.46-ax,.95);
  return lm;
}
let fails=0; const t=(n,c)=>{console.log(c?'ok  ':'FAIL',n); if(!c)fails++;};
let c=new RepCounter('squat'); for(let i=0;i<5;i++){ c.update(body()); c.update(body({kneeBend:.22})); c.update(body()); }
t('5 squats counted',c.reps===5);
c=new RepCounter('squat'); for(let i=0;i<5;i++) c.update(body({kneeBend:.01}));
t('standing still counts 0',c.reps===0);
c=new RepCounter('jacks'); for(let i=0;i<4;i++){ c.update(body()); c.update(body({armsUp:true,legsWide:true})); c.update(body()); }
t('4 jacks counted',c.reps===4);
c=new RepCounter('jacks'); for(let i=0;i<4;i++){ c.update(body({armsUp:true})); c.update(body()); }
t('arms only is not a jack',c.reps===0);
c=new RepCounter('reach'); for(let i=0;i<3;i++){ c.update(body()); c.update(body({armsUp:true})); c.update(body()); }
t('3 reaches counted',c.reps===3);
let hid=body(); hid[25]=P(.5,.7,.1); c=new RepCounter('squat'); const s=c.update(hid);
t('hidden legs gives hint, no rep',s.reps===0 && /Step back/.test(s.hint));
process.exit(fails?1:0);
