"use strict";
/* =====================================================================
   BADYET — Personal Budget Tracker — v2.0 (Google Sheets sync)
   ---------------------------------------------------------------------
   Storage: a Google Sheet (via a small Apps Script "bridge" web app).
   The browser keeps a local copy for speed; the sheet is the source of
   truth. Changes made in the app are pushed within ~0.5s; changes made
   in the sheet are pulled every 15 seconds.

   ACCOUNTING MODEL
   Account types: cash | bank | ewallet | savings  -> assets
                  credit | loan                    -> liabilities (owed)
   income / expense / refund / transfer / cc_payment, where transfers and
   card payments are never counted as income or expense, refunds reduce
   category spending, and balances = opening balance + ledger effects.
   ===================================================================== */

/* ---------------- Utilities ---------------- */
const $=s=>document.querySelector(s);
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function uid(p){return (p||'ID')+'-'+(Date.now().toString(36).slice(-3)+Math.random().toString(36).slice(2,5)).toUpperCase();}
const round2=n=>Math.round((+n||0)*100)/100;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PESO=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2});
const PESO0=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0});
const money=n=>PESO.format(round2(n||0));
const money0=n=>PESO0.format(Math.round(n||0));
const signed=n=>{n=round2(n||0);return (n>0?'+':n<0?'\u2212':'')+money(Math.abs(n));};
const pctStr=n=>Math.round(n)+'%';
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONS_F=['January','February','March','April','May','June','July','August','September','October','November','December'];
function isoDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function parseISO(s){const p=String(s).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
const TODAY=()=>isoDate(new Date());
function addDaysISO(s,n){const d=parseISO(s);d.setDate(d.getDate()+n);return isoDate(d);}
function addMonthsISO(s,n){const d=parseISO(s);const day=d.getDate();const r=new Date(d.getFullYear(),d.getMonth()+n,1);const dm=new Date(r.getFullYear(),r.getMonth()+1,0).getDate();r.setDate(Math.min(day,dm));return isoDate(r);}
/* Budget months can start on payday (Settings > "Budget month starts on day").
   With a start day of 15, the month "2026-11" runs Nov 15 - Dec 14. */
function periodStartDay(){let n=1;try{n=Math.round(toNum(state&&state.settings&&state.settings.monthStartDay))||1;}catch(e){}return n>=2&&n<=28?n:1;}
function monthKey(s){s=String(s);const k=s.slice(0,7);if(s.length<10)return k;const S=periodStartDay();return (S>1&&Number(s.slice(8,10))<S)?monthAdd(k,-1):k;}
function monthAdd(k,n){const p=k.split('-').map(Number);const d=new Date(p[0],p[1]-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function monthStart(k){return k+'-'+String(periodStartDay()).padStart(2,'0');}
function monthEnd(k){const S=periodStartDay();if(S===1){const p=k.split('-').map(Number);return isoDate(new Date(p[0],p[1],0));}return addDaysISO(monthAdd(k,1)+'-'+String(S).padStart(2,'0'),-1);}
const daysBetween=(a,b)=>Math.round((parseISO(b)-parseISO(a))/86400000);
const dim=k=>daysBetween(monthStart(k),monthEnd(k))+1;
const dayOfPeriod=iso=>daysBetween(monthStart(monthKey(iso)),iso)+1;
const monthLabel=k=>{const p=k.split('-').map(Number);return MONS_F[p[1]-1]+' '+p[0];};
const periodLabel=k=>periodStartDay()===1?monthLabel(k):fmtDShort(monthStart(k))+' \u2013 '+fmtDShort(monthEnd(k));
function fmtDate(s){if(!s)return '\u2014';const p=String(s).split('-').map(Number);switch(state.settings.dateFormat){case 'dd MMM yyyy':return p[2]+' '+MONS[p[1]-1]+' '+p[0];case 'yyyy-MM-dd':return s;case 'MM/dd/yyyy':return String(p[1]).padStart(2,'0')+'/'+String(p[2]).padStart(2,'0')+'/'+p[0];default:return MONS[p[1]-1]+' '+p[2]+', '+p[0];}}
const fmtDShort=s=>{const p=String(s).split('-').map(Number);return MONS[p[1]-1]+' '+p[2];};
function relDays(iso){return Math.round((parseISO(iso)-parseISO(TODAY()))/86400000);}
function download(name,text,mime){const b=new Blob([text],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);}
function csvCell(v){v=String(v==null?'':v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function parseCSV(text){const rows=[];let row=[],cur='',q=false;text=String(text).replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}else{if(c==='"')q=true;else if(c===','){row.push(cur);cur='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cur);cur='';if(row.length>1||row[0]!=='')rows.push(row);row=[];}else cur+=c;}}if(cur!==''||row.length){row.push(cur);if(row.length>1||row[0]!=='')rows.push(row);}return rows;}
/* Tolerant parsers for values typed by hand in the Google Sheet */
function toNum(x){if(typeof x==='number')return isFinite(x)?x:0;const v=parseFloat(String(x==null?'':x).replace(/^\s*PHP/i,'').replace(/[\u20b1,\s]/g,''));return isFinite(v)?v:0;}
function toBool(v){return v===true||/^(true|yes|y|1|x)$/i.test(String(v==null?'':v).trim());}
function normDate(v){v=String(v==null?'':v).trim();if(!v)return null;if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);const m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');const d=new Date(v);return isNaN(d)?null:isoDate(d);}
function normTxnType(v){const k=String(v||'').toLowerCase().replace(/[^a-z]/g,'');return({income:'income',expense:'expense',expenses:'expense',transfer:'transfer',ccpayment:'cc_payment',cardpayment:'cc_payment',creditcardpayment:'cc_payment',payment:'cc_payment',refund:'refund'})[k]||'expense';}
function normAccType(v){const k=String(v||'').toLowerCase().replace(/[^a-z]/g,'');return({cash:'cash',bank:'bank',ewallet:'ewallet',wallet:'ewallet',gcash:'ewallet',savings:'savings',saving:'savings',credit:'credit',creditcard:'credit',card:'credit',loan:'loan'})[k]||'bank';}
function normFreq(v){const k=String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');return({weekly:'weekly',biweekly:'biweekly',every2weeks:'biweekly',fortnightly:'biweekly',monthly:'monthly',quarterly:'quarterly',annually:'annually',annual:'annually',yearly:'annually'})[k]||'monthly';}

/* ---------------- Icons ---------------- */
const ICONS={
food:'<path d="M7 3v7a2 2 0 0 1-2 2M7 3v7a2 2 0 0 0 2 2M7 12v9M5 3v4M9 3v4"/><path d="M17 21V3c-2.2 1.6-3 4.2-3 7.5V13h3"/>',
cart:'<path d="M3 4h2.2l2.3 10.5h10.8L20.5 7H6.4"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
bulb:'<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.1V16h5v-.1c0-.8.4-1.5 1.1-2.1A6 6 0 0 0 12 3z"/>',
car:'<path d="M4 16.5V12l2.3-5.5h11.4L20 12v4.5z"/><path d="M4 12h16"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
heart:'<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
play:'<rect x="3" y="4.5" width="18" height="13" rx="2.5"/><path d="M10 8.5v5l4.2-2.5z"/><path d="M8 21h8"/>',
bag:'<path d="M5 8h14l-1.2 13H6.2z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
film:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3 9.5h4.5M3 14.5h4.5M16.5 9.5H21M16.5 14.5H21"/>',
percent:'<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.4"/><circle cx="17" cy="17" r="2.4"/>',
scissors:'<circle cx="6" cy="7" r="2.6"/><circle cx="6" cy="17" r="2.6"/><path d="M8.3 8.4 20 18M8.3 15.6 20 6"/>',
book:'<path d="M2.5 5H9a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2.5z"/><path d="M21.5 5H15a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7.5z"/>',
scale:'<path d="M12 4v16M6 20h12M4 8h16"/><path d="M6 8l-3 6.5a3 3 0 0 0 6 0zM18 8l-3 6.5a3 3 0 0 0 6 0z"/>',
box:'<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/>',
briefcase:'<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18"/>',
laptop:'<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>',
store:'<path d="M4.5 10.5V20h15v-9.5"/><path d="M3 10.5 5 4h14l2 6.5z"/><path d="M10 20v-5h4v5"/>',
gift:'<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8C10.5 5 7 4.6 7 6.5S10 8 12 8zm0 0c1.5-3 5-3.4 5-1.5S14 8 12 8z"/>',
coins:'<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"/>',
undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
tagi:'<path d="M3.5 12.5V4h8.5l9 9-8.5 8.5z"/><circle cx="8" cy="8.5" r="1.3"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
auto:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>',
home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
chart:'<path d="M3 20h18"/><path d="M6 20v-7M12 20V5M18 20v-11"/>',
trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
flag:'<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
card:'<rect x="2" y="5" width="20" height="15" rx="2.5"/><path d="M2 10h20"/>',
cal:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
wallet:'<path d="M3 7a2 2 0 0 1 2-2h13v3"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
plus:'<path d="M12 5v14M5 12h14"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
chevL:'<path d="M15 6l-6 6 6 6"/>',chevR:'<path d="M9 6l6 6-6 6"/>',chevD:'<path d="M6 9l6 6 6-6"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
edit:'<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/>',
trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
dl:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
ul:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
alert:'<path d="M12 3 2.5 20h19z"/><path d="M12 9v5"/><circle cx="12" cy="17.2" r="0.4"/>',
check:'<path d="M4 12.5l5 5L20 6.5"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.4"/>',
swap:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
print:'<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
refresh:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/>',
pause:'<path d="M9 5v14M15 5v14"/>',play:'<path d="M7 5l12 7-12 7z"/>',
skip:'<path d="M5 5l10 7-10 7z"/><path d="M18 5v14"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
inbox:'<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
sheet:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
link:'<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
ext:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
cloud:'<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z"/>',
sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
unlink:'<path d="M9 15l-2 2a3 3 0 0 1-4-4l2-2M15 9l2-2a3 3 0 0 1 4 4l-2 2"/><path d="M4 4l16 16"/>',
lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
shield:'<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/>',
plane:'<path d="M10.5 13.5 3 11l1.5-1.5 7.5 1L16 6.5a2 2 0 0 1 3 3L15 13.5l1 7.5-1.5 1.5L12 15z"/>'};
const I=(n,s)=>{s=s||18;return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[n]||'')+'</svg>';};

/* ---------------- Default state ---------------- */
const ASSETS=['cash','bank','ewallet','savings'], LIABS=['credit','loan'];
const TYPE_LBL={income:'Income',expense:'Expense',transfer:'Transfer',cc_payment:'Card payment',refund:'Refund'};
const TYPE_CLS={income:'b-income',expense:'b-expense',transfer:'b-transfer',cc_payment:'b-pay',refund:'b-refund'};
const ACC_LBL={cash:'Cash',bank:'Bank',ewallet:'E-Wallet',savings:'Savings',credit:'Credit Card',loan:'Loan'};
const PALETTE=['var(--ink)','var(--g1)','var(--g2)','var(--g3)','var(--g4)','var(--g5)','var(--g6)','var(--g1)','var(--g2)','var(--g3)','var(--g4)','var(--g5)'];
/* Category icons: simple line drawings in the theme's own colour. */
const PICKABLE_ICONS=['home','cart','bulb','car','heart','play','bag','film','food','scissors','book','card','shield','plane','trend','flag','gift','coins','sparkle','briefcase','laptop','store','wallet','target'];
const CAT_ICON={'Food & Dining':'food','Groceries':'cart','Housing & Rent':'home','Utilities':'bulb','Transportation':'car','Healthcare':'heart',
  'Subscriptions':'play','Shopping':'bag','Entertainment':'film','Debt Interest':'percent','Personal Care':'scissors','Education':'book',
  'Reconciliation':'scale','Other':'box','Salary':'briefcase','Freelance':'laptop','Business':'store','Allowance':'gift',
  'Investment Income':'trend','Other Income':'coins','Needs':'home','Wants':'bag','Debts':'card','Savings':'flag','Debt Payments':'card','Phone & Internet':'bulb','Insurance':'shield','Childcare':'heart','Hobbies':'sparkle','Gifts':'gift','Coffee':'food','Gaming':'play','Pets':'heart'};
function catIconName(c,type){
  try{
    // the plan's icon is saved in the sheet, so it wins over this device's own memory
    if(state&&state.plan&&Array.isArray(state.plan.lines)){
      const pl=state.plan.lines.find(l=>l.name===c&&l.icon&&ICONS[l.icon]);
      if(pl)return pl.icon;
    }
    if(state&&state.settings&&state.settings.catIcons&&state.settings.catIcons[c]&&ICONS[state.settings.catIcons[c]])return state.settings.catIcons[c];
  }catch(e){}
  return CAT_ICON[c]||(type==='income'?'coins':'tagi');
}
function catEmoji(c,type,size){return I(catIconName(c,type),size||20);}
function txEmoji(t){
  if(t.type==='transfer')return I('swap',20);
  if(t.type==='cc_payment')return I('card',20);
  if(t.type==='refund')return I('undo',20);
  return catEmoji(t.category,t.type);
}
/* Smooth curve through points (Catmull-Rom -> cubic Bezier). */
function smoothD(pts){
  if(!pts.length)return '';
  let d='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    d+='C'+(p1[0]+(p2[0]-p0[0])/6).toFixed(1)+' '+(p1[1]+(p2[1]-p0[1])/6).toFixed(1)+' '+(p2[0]-(p3[0]-p1[0])/6).toFixed(1)+' '+(p2[1]-(p3[1]-p1[1])/6).toFixed(1)+' '+p2[0].toFixed(1)+' '+p2[1].toFixed(1);
  }
  return d;
}
/* The home-screen wave: one point per month, centred in equal columns. */
function svgWave(vals,sel){
  const W=600,H=150,n=vals.length;
  const finite=vals.filter(function(v){return isFinite(v);});
  let min=Math.min.apply(null,finite.length?finite:[0]),max=Math.max.apply(null,finite.length?finite:[0]);
  const flat=max===min;
  const y=function(v){return flat?H/2:22+(1-(v-min)/(max-min))*(H-44);};
  const pts=vals.map(function(v,i){return [(i+.5)*W/n,y(v||0)];});
  const ext=[[-W*.14,pts[0][1]]].concat(pts,[[W*1.14,pts[n-1][1]]]);
  const p=pts[sel]||pts[n-1];
  return '<svg class="wave" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Monthly trend">'+
    '<path d="'+smoothD(ext)+'" style="fill:none;stroke:var(--ink)" stroke-width="3.5" stroke-linecap="round"/>'+
    '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="8.5" style="fill:var(--paper);stroke:var(--ink)" stroke-width="3.5"/></svg>';
}
function defaultSettings(){return{
  currency:'PHP',dateFormat:'MMM d, yyyy',reportingPeriod:'month',
  warnThreshold:80,dangerThreshold:100,theme:'light',monthStartDay:1,
  expenseCats:[
    {name:'Needs',essential:true},{name:'Wants',essential:false},{name:'Debt Payments',essential:true},
    {name:'Food & Dining',essential:false},{name:'Groceries',essential:true},{name:'Housing & Rent',essential:true},
    {name:'Utilities',essential:true},{name:'Transportation',essential:true},{name:'Healthcare',essential:true},
    {name:'Subscriptions',essential:false},{name:'Shopping',essential:false},{name:'Entertainment',essential:false},
    {name:'Debt Interest',essential:true},{name:'Personal Care',essential:false},{name:'Education',essential:true},
    {name:'Reconciliation',essential:true},{name:'Other',essential:false}],
  incomeCats:['Salary','Freelance','Business','Allowance','Investment Income','Other Income'],
  catIds:{},catIcons:{}};}
function blankPlan(){return{income:0,payday:'1',payDay:1,split:{needs:50,wants:30,savings:20},lines:[]};}
function blankState(){return{version:2,settings:defaultSettings(),accounts:[],transactions:[],budgets:[],recurring:[],goals:[],exceptions:[],dismissed:[],isDemo:false,plan:blankPlan()};}
/* ---------------- Plan (guided setup) ----------------
   income: monthly take-home. split: % of income for needs / wants / savings.
   lines: one per category (needs, wants) or goal (savings). A line is either a
   % of income (grows with income) or a fixed peso amount (amount set). */
const PLAN_GROUPS=['needs','wants','savings'];
const ALL_PLAN_GROUPS=['needs','wants','debts','savings'];
const GROUP_LBL={needs:'Needs',wants:'Wants',debts:'Debts',savings:'Savings'};
const PAYDAY_LBL={'1':'Once, on the 1st','15-30':'15th & 30th','biweekly':'Every 2 weeks','day':'Other day'};
function debtRem(l){const t=Math.max(0,toNum(l.target));const pd=Math.max(0,toNum(l.paid));return t>0?Math.max(0,round2(t-pd)):Math.max(0,toNum(l.amount));}
function debtMonthlyAmt(l,income){
  const m=Math.max(1,Math.round(toNum(l.months))||1);
  const rem=debtRem(l);
  if(toNum(l.target)>0)return round2(rem/m);
  return round2(l.mode==='pct'?((income||0)*(l.pct||0)/100):(toNum(l.amount)||0));
}
function debtFreqAmt(monthlyAmt,freq){
  const f=normFreq(freq||'monthly');
  if(f==='weekly')return{amt:round2(monthlyAmt*12/52),lbl:'/wk',freqLbl:'Weekly'};
  if(f==='biweekly')return{amt:round2(monthlyAmt*12/26),lbl:'/2wks',freqLbl:'Every 2 weeks'};
  if(f==='quarterly')return{amt:round2(monthlyAmt*3),lbl:'/qtr',freqLbl:'Quarterly'};
  return{amt:round2(monthlyAmt),lbl:'/mo',freqLbl:'Monthly'};
}
function normPlan(p){
  p=p||{};const out=blankPlan();
  out.income=Math.max(0,round2(toNum(p.income)));
  out.payday=['1','15-30','biweekly','day'].includes(String(p.payday))?String(p.payday):'1';
  out.payDay=clamp(Math.round(toNum(p.payDay))||1,1,28);
  const sp=p.split||{};PLAN_GROUPS.forEach(g=>{if(sp[g]!==undefined&&sp[g]!=='')out.split[g]=Math.max(0,toNum(sp[g]));});
  out.lines=(Array.isArray(p.lines)?p.lines:[]).filter(l=>String(l.name||'').trim()).map(l=>{
    const rawG=String(l.group||'needs').toLowerCase();
    const g=ALL_PLAN_GROUPS.includes(rawG)?rawG:(rawG==='debt'?'debts':'needs');
    const isDebt=g==='debts';
    const months=isDebt?Math.max(1,Math.round(toNum(l.months))||6):0;
    const target=Math.max(0,toNum(l.target)||0);
    const paid=isDebt?Math.max(0,toNum(l.paid)||0):0;
    const freq=isDebt?normFreq(l.freq||'monthly'):'monthly';
    const fixed=isDebt||l.mode==='amt'||(l.mode!=='pct'&&l.amount!==null&&l.amount!==undefined&&String(l.amount).trim()!=='');
    const compAmt=isDebt?(target>0?round2(Math.max(0,target-paid)/months):Math.max(0,toNum(l.amount))):Math.max(0,toNum(l.amount));
    const nm=String(l.name).trim();
    const ic=String(l.icon||'').trim()||((state&&state.settings&&state.settings.catIcons&&state.settings.catIcons[nm])||'');
    return{id:String(l.id||'')||uid('PLN'),group:g,
      name:nm,mode:fixed?'amt':'pct',pct:fixed?null:Math.max(0,toNum(l.pct)),amount:fixed?compAmt:null,
      rollover:toBool(l.rollover),target:target,targetDate:normDate(l.targetDate)||'',
      paid:paid,months:months,freq:freq,icon:ICONS[ic]?ic:''};
  }).filter(l=>!(l.group==='debts'&&l.target>0&&l.paid>=l.target));
  return out;
}
const hasPlan=()=>!!(state&&state.plan&&state.plan.income>0&&state.plan.lines.length);
const lineAmt=(l,income)=>l.group==='debts'?debtMonthlyAmt(l,income):round2(l.mode==='amt'?(l.amount||0):(income*(l.pct||0)/100));
const groupAmt=(p,g)=>{
  if(!p)return 0;
  if(g==='debts')return round2((p.lines||[]).filter(l=>l.group==='debts').reduce((s,l)=>s+lineAmt(l,p.income),0));
  return round2(p.income*(p.split[g]||0)/100);
};
function planGroupOf(cat){
  if(cat==='Needs')return 'needs';
  if(cat==='Wants')return 'wants';
  if(cat==='Debt Payments'||cat==='Debt Interest')return 'debts';
  const l=hasPlan()&&state.plan.lines.find(x=>x.name===cat&&x.group!=='savings');
  if(l)return l.group==='debts'?'needs':l.group;
  const c=state.settings.expenseCats.find(x=>x.name===cat);return c&&c.essential?'needs':'wants';
}
/* Auto-removes any debt plan line whose remaining balance reaches 0 and restores its share to Needs consumption. */
let lastFreedDebt={names:[],monthly:0};
function prunePaidDebts(){
  if(!state||!state.plan||!Array.isArray(state.plan.lines))return[];
  const removed=[];
  let freedMonthly=0;
  state.plan.lines=state.plan.lines.filter(l=>{
    if(l.group!=='debts')return true;
    const rem=debtRem(l);
    if(l.target>0&&rem<=0.005){
      removed.push(l.name);
      freedMonthly+=round2(toNum(l.amount)||(l.target/Math.max(1,l.months||1)));
      return false;
    }
    l.amount=debtMonthlyAmt(l,state.plan.income);
    return true;
  });
  if(removed.length){
    lastFreedDebt={names:removed.slice(),monthly:round2(freedMonthly)};
    const k=monthKey(TODAY());
    removed.forEach(nm=>{
      state.budgets=state.budgets.filter(b=>!(b.month===k&&b.category===nm));
    });
    const needsCons=state.plan.lines.find(l=>l.group==='needs'&&l.name==='Needs');
    if(needsCons){
      const otherNeeds=state.plan.lines.filter(l=>l.group==='needs'&&l!==needsCons).reduce((s,l)=>s+lineAmt(l,state.plan.income),0);
      const debtsNow=state.plan.lines.filter(l=>l.group==='debts').reduce((s,l)=>s+lineAmt(l,state.plan.income),0);
      const targetNeeds=groupAmt(state.plan,'needs');
      const newNeedsAmt=Math.max(0,round2(targetNeeds-otherNeeds-debtsNow));
      if(needsCons.mode==='amt')needsCons.amount=newNeedsAmt;
      else if(state.plan.income>0)needsCons.pct=round2(newNeedsAmt/state.plan.income*100);
    }
    syncPlanBudgets(k,removed);
  }
  return removed;
}
function normalizeState(s){
  s=s||{};
  const st=Object.assign(defaultSettings(),s.settings||{});
  st.expenseCats=(Array.isArray(st.expenseCats)&&st.expenseCats.length)?st.expenseCats.map(c=>typeof c==='string'?{name:c,essential:false}:{name:String(c.name),essential:!!c.essential}):defaultSettings().expenseCats;
  st.incomeCats=(Array.isArray(st.incomeCats)&&st.incomeCats.length)?st.incomeCats.map(String):defaultSettings().incomeCats;
  st.warnThreshold=clamp(toNum(st.warnThreshold)||80,1,100);
  st.dangerThreshold=clamp(toNum(st.dangerThreshold)||100,1,200);
  if(!['MMM d, yyyy','dd MMM yyyy','yyyy-MM-dd','MM/dd/yyyy'].includes(st.dateFormat))st.dateFormat='MMM d, yyyy';
  if(!['month','prev','ytd','custom'].includes(st.reportingPeriod))st.reportingPeriod='month';
  st.theme=String(st.theme||'').toLowerCase();if(!['light','dark','auto'].includes(st.theme))st.theme='light';
  st.monthStartDay=clamp(Math.round(toNum(st.monthStartDay))||1,1,28);
  st.catIds=Object.assign({},(s.settings&&s.settings.catIds)||{});
  st.catIcons=Object.assign({},(s.settings&&s.settings.catIcons)||{});
  const out=blankState();out.settings=st;
  ensureCatIds(out);
  out.accounts=(s.accounts||[]).map(a=>({id:String(a.id||'')||uid('ACC'),name:String(a.name||'Account').trim(),type:normAccType(a.type),openingBalance:toNum(a.openingBalance),openingDate:normDate(a.openingDate)||TODAY(),notes:String(a.notes||''),archived:toBool(a.archived),apr:(a.apr==null||a.apr==='')?null:toNum(a.apr),minPayment:toNum(a.minPayment),dueDay:toNum(a.dueDay)?clamp(Math.round(toNum(a.dueDay)),1,31):null,plannedPayment:toNum(a.plannedPayment)}));
  out.transactions=(s.transactions||[]).map(t=>{const type=normTxnType(t.type);const mv=(type==='transfer'||type==='cc_payment');
    return{id:String(t.id||'')||uid('TXN'),date:normDate(t.date)||TODAY(),type:type,description:String(t.description||''),amount:Math.abs(toNum(t.amount)),
      category:mv?'':(String(t.category||'').trim()||(type==='income'?'Other Income':'Other')),
      fromAccount:t.fromAccount||null,toAccount:t.toAccount||null,method:String(t.method||''),notes:String(t.notes||''),
      tags:Array.isArray(t.tags)?t.tags:(t.tags?String(t.tags).split(';').map(x=>x.trim()).filter(Boolean):[]),
      recurringId:t.recurringId||null,refundOf:t.refundOf||null};});
  out.budgets=(s.budgets||[]).map(b=>{const m=String(b.month||'').trim();const bc=String(b.category||'').trim();
    return{id:String(b.id||'')||uid('BUD'),month:/^\d{4}-\d{2}/.test(m)?m.slice(0,7):((normDate(m)||TODAY()).slice(0,7)),
      category:/^(__total__|overall total|overall|total|all spending)$/i.test(bc)?'__total__':(bc||'Other'),amount:toNum(b.amount),scope:String(b.scope||'').toLowerCase()==='weekly'?'weekly':'monthly',rollover:toBool(b.rollover)};});
  out.recurring=(s.recurring||[]).map(r=>({id:String(r.id||'')||uid('BIL'),description:String(r.description||''),type:String(r.type||'').toLowerCase()==='income'?'income':'expense',amount:Math.abs(toNum(r.amount)),category:String(r.category||'').trim()||'Other',account:r.account||null,startDate:normDate(r.startDate)||TODAY(),endDate:normDate(r.endDate),freq:normFreq(r.freq),nextDue:normDate(r.nextDue),status:String(r.status||'').toLowerCase()==='paused'?'paused':'active'}));
  out.goals=(s.goals||[]).map(g=>({id:String(g.id||'')||uid('GOL'),name:String(g.name||'Goal'),target:toNum(g.target),saved:toNum(g.saved),targetDate:normDate(g.targetDate),monthlyContribution:toNum(g.monthlyContribution)}));
  out.exceptions=Array.isArray(s.exceptions)?s.exceptions:[];
  out.dismissed=Array.isArray(s.dismissed)?s.dismissed:[];
  out.isDemo=!!s.isDemo;
  out.plan=normPlan(s.plan);
  // Bills typed into the sheet without a "next due" date: work it out from history.
  for(const r of out.recurring){
    if(!r.nextDue){const posted=out.transactions.filter(t=>t.recurringId===r.id).map(t=>t.date).sort();
      r.nextDue=posted.length?stepFreq(r,posted[posted.length-1]):r.startDate;}
  }
  return out;
}

/* ---------------- Local persistence (cache) ---------------- */
const LS_KEY='badyet_state_v1';
let state=null;
function saveLocal(){try{localStorage.setItem(LS_KEY,JSON.stringify(state));}catch(e){}}
function saveState(){
  saveLocal();
  if(typeof schedulePush==='function')schedulePush();
}
function loadState(){try{const raw=localStorage.getItem(LS_KEY);return raw?normalizeState(JSON.parse(raw)):null;}catch(e){return null;}}

/* ---------------- Sheet <-> app data mapping ---------------- */
const TABLES={
  Transactions:{key:'id',cols:['id','date','type','description','amount','category','categoryId','fromAccount','fromAccountId','toAccount','toAccountId','method','notes','tags','recurringId','refundOf']},
  Accounts:{key:'id',cols:['id','name','type','openingBalance','openingDate','apr','minPayment','dueDay','plannedPayment','archived','notes']},
  ExpenseCategories:{key:'id',cols:['id','name','essential']},
  IncomeCategories:{key:'id',cols:['id','name']},
  Budgets:{key:'id',cols:['id','month','category','categoryId','scope','amount','rollover']},
  Bills:{key:'id',cols:['id','description','type','amount','category','categoryId','account','accountId','frequency','startDate','endDate','nextDue','status']},
  Goals:{key:'id',cols:['id','name','target','saved','targetDate','monthlyContribution']},
  Plan:{key:'id',cols:['id','group','name','pct','amount','worksOut','rollover','target','targetDate','paid','months','freq','icon']},
  Settings:{key:'key',cols:['key','value','note']}
};
/* Words the sheet shows (matches the Lists tab). */
const SHEET_LBL={
  txn:{income:'Income',expense:'Expense',transfer:'Transfer',cc_payment:'Card payment',refund:'Refund'},
  acc:{cash:'Cash',bank:'Bank',ewallet:'E-wallet',savings:'Savings',credit:'Credit card',loan:'Loan'},
  freq:{weekly:'Weekly',biweekly:'Every 2 weeks',monthly:'Monthly',quarterly:'Quarterly',annually:'Yearly'}};
const ALL_SPENDING='All spending',ALL_SPENDING_ID='ALL';
const SETTING_ROWS=[
  ['dateFormat','Date format','How dates are shown in the app.'],
  ['reportingPeriod','Home period','Which period the home screen shows first.'],
  ['warnThreshold','Budget warning at (%)','A budget is flagged once this share of it is used.'],
  ['dangerThreshold','Budget limit at (%)','A budget counts as over once this share is used.'],
  ['theme','Color theme','Light, Dark or Auto (follows your phone or computer).'],
  ['monthStartDay','Budget month starts on day','1 = calendar month. Set it to your payday (e.g. 15) so budgets run payday to payday.'],
  ['planIncome','Monthly income (plan)','Your take-home pay per month. Set up in the app under Budgets \u2192 Edit Plan.'],
  ['planSplit','Plan split (Needs / Wants / Savings %)','Three numbers that add up to 100, e.g. 50 / 30 / 20.'],
  ['payday','Payday','1st, 15th & 30th, Every 2 weeks, or a day of the month (e.g. 10).'],
  ['isDemo','Demo data','TRUE while the sample data is loaded.'],
  ['dismissed','Dismissed alerts','Alerts you closed in the app (kept by the app).'],
  ['exceptions','Ignored in checks','Transactions excluded from unusual-spending checks (kept by the app).']];
const normKey=v=>String(v==null?'':v).toLowerCase().replace(/[^a-z0-9]/g,'');
/* Every category gets a stable ID (EXP-/INC-) so rows can link to it. */
function ensureCatIds(s){
  const ids=s.settings.catIds=s.settings.catIds||{};
  s.settings.expenseCats.forEach(c=>{if(!ids[c.name])ids[c.name]=uid('EXP');});
  s.settings.incomeCats.forEach(n=>{if(!ids[n])ids[n]=uid('INC');});
  return ids;
}
function stateToRows(s){
  const ids=ensureCatIds(s);
  const accName=id=>{const a=s.accounts.find(x=>x.id===id);return a?a.name:'';};
  const cid=n=>(n&&ids[n])||'';
  const lbl=(m,v)=>m[v]||v||'';
  const sv={dateFormat:s.settings.dateFormat,reportingPeriod:s.settings.reportingPeriod,warnThreshold:String(s.settings.warnThreshold),
    dangerThreshold:String(s.settings.dangerThreshold),theme:({light:'Light',dark:'Dark',auto:'Auto'})[s.settings.theme]||'Light',monthStartDay:String(s.settings.monthStartDay||1),
    planIncome:s.plan&&s.plan.income?String(s.plan.income):'',planSplit:s.plan?[s.plan.split.needs,s.plan.split.wants,s.plan.split.savings].join(' / '):'',
    payday:s.plan?(s.plan.payday==='day'?String(s.plan.payDay):PAYDAY_LBL[s.plan.payday]):'',isDemo:s.isDemo?'TRUE':'FALSE',dismissed:(s.dismissed||[]).join('|'),exceptions:(s.exceptions||[]).join('|')};
  return{
    Transactions:s.transactions.map(t=>({id:t.id,date:t.date,type:lbl(SHEET_LBL.txn,t.type),description:t.description,amount:t.amount,
      category:t.category||'',categoryId:cid(t.category),fromAccount:accName(t.fromAccount),fromAccountId:t.fromAccount||'',
      toAccount:accName(t.toAccount),toAccountId:t.toAccount||'',method:t.method||'',notes:t.notes||'',tags:(t.tags||[]).join('; '),
      recurringId:t.recurringId||'',refundOf:t.refundOf||''})),
    Accounts:s.accounts.map(a=>({id:a.id,name:a.name,type:lbl(SHEET_LBL.acc,a.type),openingBalance:a.openingBalance||0,openingDate:a.openingDate||'',
      apr:a.apr==null?'':a.apr,minPayment:a.minPayment||'',dueDay:a.dueDay||'',plannedPayment:a.plannedPayment||'',archived:!!a.archived,notes:a.notes||''})),
    ExpenseCategories:s.settings.expenseCats.map(c=>({id:cid(c.name),name:c.name,essential:!!c.essential})),
    IncomeCategories:s.settings.incomeCats.map(n=>({id:cid(n),name:n})),
    Budgets:s.budgets.map(b=>{const all=b.category==='__total__';
      return{id:b.id,month:b.month,category:all?ALL_SPENDING:b.category,categoryId:all?ALL_SPENDING_ID:cid(b.category),scope:b.scope==='weekly'?'Weekly':'Monthly',amount:b.amount,rollover:!!b.rollover};}),
    Bills:s.recurring.map(r=>({id:r.id,description:r.description,type:r.type==='income'?'Income':'Expense',amount:r.amount,
      category:r.category,categoryId:cid(r.category),account:accName(r.account),accountId:r.account||'',frequency:lbl(SHEET_LBL.freq,r.freq),
      startDate:r.startDate||'',endDate:r.endDate||'',nextDue:r.nextDue||'',status:r.status==='paused'?'Paused':'Active'})),
    Goals:s.goals.map(g=>({id:g.id,name:g.name,target:g.target,saved:g.saved,targetDate:g.targetDate||'',monthlyContribution:g.monthlyContribution||0})),
    Plan:((s.plan&&s.plan.lines)||[]).map(l=>({id:l.id,group:GROUP_LBL[l.group]||'Needs',name:l.name,pct:l.mode==='pct'?l.pct:'',amount:l.mode==='amt'?lineAmt(l,s.plan.income):'',
      worksOut:lineAmt(l,s.plan.income),rollover:(l.group==='savings'||l.group==='debts')?false:!!l.rollover,target:(l.group==='savings'||l.group==='debts')&&l.target?l.target:'',targetDate:l.group==='savings'?(l.targetDate||''):'',
      paid:l.group==='debts'?(l.paid||0):'',months:l.group==='debts'?(l.months||6):'',freq:l.group==='debts'?lbl(SHEET_LBL.freq,l.freq||'monthly'):'',icon:(l.icon&&ICONS[l.icon])?l.icon:''})),
    Settings:SETTING_ROWS.map(x=>({key:x[1],value:sv[x[0]],note:x[2]}))
  };
}
function rowsToState(d){
  d=d||{};
  const str=v=>String(v==null?'':v).trim();
  if(d.Categories&&!d.ExpenseCategories){   // older sheet layout
    d=Object.assign({},d,{
      ExpenseCategories:d.Categories.filter(c=>str(c.kind).toLowerCase()!=='income').map(c=>({id:'',name:c.name,essential:c.essential})),
      IncomeCategories:d.Categories.filter(c=>str(c.kind).toLowerCase()==='income').map(c=>({id:'',name:c.name}))});
  }
  const accounts=(d.Accounts||[]).filter(r=>str(r.name)||str(r.id)).map(r=>({id:str(r.id)||uid('ACC'),name:str(r.name)||'Account',type:r.type,
    openingBalance:r.openingBalance,openingDate:r.openingDate,notes:r.notes,archived:r.archived,apr:r.apr,minPayment:r.minPayment,dueDay:r.dueDay,plannedPayment:r.plannedPayment}));
  const accId=(id,name)=>{id=str(id);name=str(name).toLowerCase();
    const a=(id&&accounts.find(x=>x.id===id))||(name&&accounts.find(x=>x.name.toLowerCase()===name));return a?a.id:null;};
  const exp=(d.ExpenseCategories||[]).filter(c=>str(c.name)),inc=(d.IncomeCategories||[]).filter(c=>str(c.name));
  const catIds={},catById={};
  exp.concat(inc).forEach(c=>{const id=str(c.id);if(id){catIds[str(c.name)]=id;catById[id]=str(c.name);}});
  catById[ALL_SPENDING_ID]=ALL_SPENDING;
  const catName=(id,name)=>catById[str(id)]||str(name);
  const set={};
  (d.Settings||[]).forEach(r=>{const k=normKey(r.key);const hit=SETTING_ROWS.find(x=>normKey(x[0])===k||normKey(x[1])===k);if(hit)set[hit[0]]=r.value;});
  const list=v=>str(v).split('|').map(x=>x.trim()).filter(Boolean);
  const settings={expenseCats:exp.map(c=>({name:str(c.name),essential:toBool(c.essential)})),incomeCats:inc.map(c=>str(c.name)),catIds:catIds};
  if(set.dateFormat)settings.dateFormat=str(set.dateFormat);
  if(set.reportingPeriod)settings.reportingPeriod=str(set.reportingPeriod);
  if(str(set.warnThreshold))settings.warnThreshold=toNum(set.warnThreshold);
  if(str(set.dangerThreshold))settings.dangerThreshold=toNum(set.dangerThreshold);
  if(str(set.theme))settings.theme=str(set.theme).toLowerCase();
  if(str(set.monthStartDay))settings.monthStartDay=toNum(set.monthStartDay);
  const spl=str(set.planSplit).split(/[\/,|]/).map(x=>toNum(x));
  const pd=str(set.payday).toLowerCase().replace(/\s/g,'');
  const plan={income:toNum(set.planIncome),split:spl.length===3?{needs:spl[0],wants:spl[1],savings:spl[2]}:undefined,
    payday:/15/.test(pd)&&/30/.test(pd)?'15-30':/2week|biweek/.test(pd)?'biweekly':/^\d+$/.test(pd)&&+pd>1?'day':'1',payDay:/^\d+$/.test(pd)?+pd:1,
    lines:(d.Plan||[]).filter(r=>str(r.name)).map(r=>({id:str(r.id),group:str(r.group).toLowerCase(),name:str(r.name),pct:r.pct,amount:str(r.amount)?r.amount:null,
      rollover:r.rollover,target:r.target,targetDate:r.targetDate,paid:r.paid,months:r.months,freq:r.freq,icon:str(r.icon)}))};
  return normalizeState({settings:settings,accounts:accounts,
    transactions:(d.Transactions||[]).filter(r=>str(r.description)||toNum(r.amount)).map(r=>({id:str(r.id),date:r.date,type:r.type,description:str(r.description),amount:r.amount,
      category:catName(r.categoryId,r.category),fromAccount:accId(r.fromAccountId,r.fromAccount),toAccount:accId(r.toAccountId,r.toAccount),
      method:r.method,notes:r.notes,tags:str(r.tags).split(/[;,]/).map(x=>x.trim()).filter(Boolean),recurringId:str(r.recurringId)||null,refundOf:str(r.refundOf)||null})),
    budgets:(d.Budgets||[]).filter(r=>str(r.category)||str(r.categoryId)||toNum(r.amount)).map(r=>({id:str(r.id),month:r.month,
      category:str(r.categoryId)===ALL_SPENDING_ID?'__total__':catName(r.categoryId,r.category),amount:r.amount,scope:r.scope,rollover:r.rollover})),
    recurring:(d.Bills||[]).filter(r=>str(r.description)).map(r=>({id:str(r.id),description:str(r.description),type:r.type,amount:r.amount,
      category:catName(r.categoryId,r.category),account:accId(r.accountId,r.account),startDate:r.startDate,endDate:r.endDate,freq:r.frequency,nextDue:r.nextDue,status:r.status})),
    goals:(d.Goals||[]).filter(r=>str(r.name)).map(r=>({id:str(r.id),name:str(r.name),target:r.target,saved:r.saved,targetDate:r.targetDate,monthlyContribution:r.monthlyContribution})),
    exceptions:list(set.exceptions),dismissed:list(set.dismissed),isDemo:toBool(set.isDemo),plan:plan});
}

/* ---------------- Ledger calculations ---------------- */
const accountById=id=>state.accounts.find(a=>a.id===id);
const isLiab=a=>a&&LIABS.includes(a.type);
function accountBalance(id,cutoff){
  const acc=accountById(id);if(!acc)return 0;
  let b=0;
  if(!cutoff||!acc.openingDate||acc.openingDate<=cutoff)b=acc.openingBalance||0;
  const liab=isLiab(acc);
  for(const t of state.transactions){
    if(cutoff&&t.date>cutoff)continue;
    if(t.type==='income'&&t.toAccount===id)b+=liab?-t.amount:t.amount;
    else if(t.type==='refund'&&t.toAccount===id)b+=liab?-t.amount:t.amount;
    else if(t.type==='expense'&&t.fromAccount===id)b+=liab?t.amount:-t.amount;
    else if(t.type==='transfer'||t.type==='cc_payment'){
      if(t.fromAccount===id)b+=liab?t.amount:-t.amount;
      if(t.toAccount===id)b+=liab?-t.amount:t.amount;
    }
  }
  return round2(b);
}
const availableCash=cutoff=>state.accounts.filter(a=>!a.archived&&ASSETS.includes(a.type)).reduce((s,a)=>s+accountBalance(a.id,cutoff),0);
const totalDebt=cutoff=>state.accounts.filter(a=>!a.archived&&LIABS.includes(a.type)).reduce((s,a)=>s+accountBalance(a.id,cutoff),0);
const txnsIn=(from,to)=>state.transactions.filter(t=>(!from||t.date>=from)&&(!to||t.date<=to));
const monthTxns=k=>txnsIn(monthStart(k),monthEnd(k));
const sumBy=(tx,type)=>round2(tx.filter(t=>t.type===type).reduce((s,t)=>s+t.amount,0));
function periodSummary(tx){const income=sumBy(tx,'income'),gross=sumBy(tx,'expense'),refunds=sumBy(tx,'refund');
  return{income:income,gross:gross,refunds:refunds,netExpense:round2(gross-refunds),net:round2(income-gross+refunds),
    savingsRate:income>0?round2((income-gross+refunds)/income*100):null};}
function netSpendByCat(tx){const m={};for(const t of tx){if(t.type==='expense')m[t.category]=round2((m[t.category]||0)+t.amount);else if(t.type==='refund')m[t.category]=round2((m[t.category]||0)-t.amount);}return m;}
function allMonths(){const set=new Set(state.transactions.map(t=>monthKey(t.date)));set.add(monthKey(TODAY()));return[...set].sort();}
function avgNetCashflow(months){const cur=monthKey(TODAY());const keys=allMonths().filter(k=>k<cur).slice(-months);if(!keys.length)return null;
  let net=0;for(const k of keys)net+=periodSummary(monthTxns(k)).net;return round2(net/keys.length);}

/* ---------------- Recurring schedules ---------------- */
function stepFreq(r,iso){
  if(r.freq==='weekly')return addDaysISO(iso,7);
  if(r.freq==='biweekly')return addDaysISO(iso,14);
  let m=1;if(r.freq==='quarterly')m=3;if(r.freq==='annually')m=12;
  const p=parseISO(iso),anchor=Number(String(r.startDate||iso).slice(8))||p.getDate();
  const nm=new Date(p.getFullYear(),p.getMonth()+m,1);
  const dd=new Date(nm.getFullYear(),nm.getMonth()+1,0).getDate();
  return isoDate(new Date(nm.getFullYear(),nm.getMonth(),Math.min(anchor,dd)));
}
function occBetween(r,fromISO,toISO){
  const out=[];let cur=r.startDate,g=0;
  while(cur<=toISO&&g<3000){
    if(cur>=fromISO&&(!r.endDate||cur<=r.endDate))out.push(cur);
    cur=stepFreq(r,cur);g++;
  }
  return out;
}
const postedOn=(rid,date)=>state.transactions.some(t=>t.recurringId===rid&&t.date===date);
function advanceRecurring(r,paidDate){
  if(!r.nextDue)return;let g=0;
  while(r.nextDue<=paidDate&&g<600){r.nextDue=stepFreq(r,r.nextDue);g++;}
}
const overdueBills=()=>state.recurring.filter(r=>r.status==='active'&&r.nextDue&&r.nextDue<TODAY()&&(!r.endDate||r.nextDue<=r.endDate));
function dueSoon(days){const out=[];const to=addDaysISO(TODAY(),days);
  for(const r of state.recurring){if(r.status!=='active'||!r.nextDue)continue;
    for(const d of occBetween(r,TODAY(),to)){if(d>=r.nextDue&&!postedOn(r.id,d))out.push({r:r,date:d});}}
  return out;}

/* ---------------- Budgets ---------------- */
/* Rollover: a budget with "Rollover" on also gets last month's leftover
   (or loses last month's overspending). budgetsFor() returns copies with the
   effective amount; base = what you typed, carry = what came from last month. */
const rawBudgetsFor=k=>state.budgets.filter(b=>b.month===k);
let _spendMemo=new Map();
function clearBudgetMemo(){_spendMemo=new Map();}
function spendFor(k){if(!_spendMemo.has(k))_spendMemo.set(k,netSpendByCat(monthTxns(k)));return _spendMemo.get(k);}
function budgetCarry(b,depth){
  depth=depth||0;
  if(!b.rollover||b.scope!=='monthly'||b.category==='__total__'||depth>24)return 0;
  const pk=monthAdd(b.month,-1);
  const pb=state.budgets.find(x=>x.month===pk&&x.scope==='monthly'&&x.category===b.category);
  if(!pb)return 0;
  const eff=pb.amount+budgetCarry(pb,depth+1);
  return round2(eff-(spendFor(pk)[b.category]||0));
}
const budgetsFor=k=>rawBudgetsFor(k).map(b=>{const c=budgetCarry(b);return Object.assign({},b,{base:b.amount,carry:c,amount:round2(Math.max(0,b.amount+c))});});
function totalBudget(k){const t=state.budgets.find(b=>b.month===k&&b.scope==='monthly'&&b.category==='__total__');
  return t?t.amount:budgetsFor(k).filter(b=>b.scope==='monthly'&&b.category!=='__total__').reduce((s,b)=>s+b.amount,0);}
function budgetStatus(spent,amount){
  if(!(amount>0))return spent>0?{cls:'b-mut',label:'No budget'}:{cls:'b-mut',label:'\u2014'};
  const p=spent/amount*100;
  if(p>=state.settings.dangerThreshold)return{cls:'b-over',label:'Over budget'};
  if(p>=state.settings.warnThreshold)return{cls:'b-watch',label:'Approaching'};
  return{cls:'b-ok',label:'On track'};
}

/* ---------------- Forecast ---------------- */
function categoryBaseline(){
  const cur=monthKey(TODAY());
  const keys=allMonths().filter(k=>k<cur).slice(-3);
  const out={__months:keys.length};
  const pick=k=>monthTxns(k).filter(t=>(t.type==='expense'||t.type==='refund')&&!t.recurringId&&!state.exceptions.includes(t.id));
  if(!keys.length){
    const m=netSpendByCat(pick(cur));for(const c in m)if(m[c]>0)out[c]=m[c];
    out.__limited=true;return out;
  }
  for(const k of keys){const m=netSpendByCat(pick(k));for(const c in m)out[c]=round2((out[c]||0)+m[c]);}
  for(const k in out){if(!k.startsWith('__'))out[k]=round2(out[k]/keys.length);}
  return out;
}
function estimateCategoryRemainder(cat){
  const today=TODAY(),k=monthKey(today),D=dim(k),dom=dayOfPeriod(today);
  const remaining=D-dom;if(remaining<=0)return 0;
  const avg=categoryBaseline()[cat]||0;
  const cur=netSpendByCat(monthTxns(k))[cat]||0;
  const pace=cur/Math.max(dom,1)*D;
  return round2(Math.max(0,0.5*avg+0.5*pace)/D*remaining);
}
function computeForecast(horizon,sc){
  sc=sc||{incomePct:0,diningCut:0,oneTime:0,oneTimeWhen:1,monthlyAdj:0};
  const today=TODAY(),startKey=monthKey(today),endKey=monthAdd(startKey,horizon-1),endISO=monthEnd(endKey);
  const cash0=availableCash();
  const base=categoryBaseline();
  const events=[],dayDelta={},balAfter={},mk={};
  const add=(d,amt)=>{dayDelta[d]=round2((dayDelta[d]||0)+amt);};
  const bucket=(k,f,amt)=>{if(!mk[k])mk[k]={income:0,bills:0,variable:0};mk[k][f]=round2(mk[k][f]+amt);};
  let incomeRem=0,billsRem=0,variableRem=0;
  for(const r of state.recurring){
    if(r.status!=='active')continue;
    for(const D of occBetween(r,today,endISO)){
      if(postedOn(r.id,D)||(r.nextDue&&D<r.nextDue))continue;
      const k=monthKey(D);
      if(r.type==='income'){
        const amt=round2(r.amount*(1+(sc.incomePct||0)/100));
        add(D,amt);bucket(k,'income',amt);incomeRem+=amt;
        events.push({date:D,label:r.description,amt:amt,kind:'income'});
      }else{
        const acc=accountById(r.account);
        if(isLiab(acc)){events.push({date:D,label:r.description+' (billed to '+acc.name+' \u2014 no cash outflow now)',amt:r.amount,kind:'card'});}
        else{add(D,-r.amount);bucket(k,'bills',r.amount);billsRem+=r.amount;
          events.push({date:D,label:r.description,amt:-r.amount,kind:'bill'});}
      }
    }
  }
  const dining='Food & Dining';
  for(const cat in base){
    if(cat.indexOf('__')===0)continue;
    let avg=base[cat];if(cat===dining)avg=avg*(1-(sc.diningCut||0)/100);
    if(!(avg>0))continue;
    const D0=dim(startKey),dom0=dayOfPeriod(today),s0=monthStart(startKey);
    const daily=avg/D0;
    for(let d=Math.max(1,dom0);d<=D0;d++){const iso=addDaysISO(s0,d-1);if(iso>=today){add(iso,-daily);bucket(startKey,'variable',daily);}}
    for(let m=1;m<horizon;m++){const k=monthAdd(startKey,m),dd=dim(k),dm=avg/dd,sk=monthStart(k);
      for(let d=1;d<=dd;d++){add(addDaysISO(sk,d-1),-dm);bucket(k,'variable',dm);}}
  }
  variableRem=0;for(const k in mk)variableRem+=mk[k].variable;
  if(sc.oneTime>0){
    const k=monthAdd(startKey,Math.max(0,(sc.oneTimeWhen||1)-1));
    let d=addDaysISO(monthStart(k),Math.min(14,dim(k)-1));
    if(d<=today)d=addDaysISO(today,1);
    add(d,-sc.oneTime);bucket(monthKey(d),'bills',sc.oneTime);
    events.push({date:d,label:'Planned purchase (what-if scenario)',amt:-sc.oneTime,kind:'scenario'});
  }
  if(sc.monthlyAdj){
    for(let m=0;m<horizon;m++){const k=monthAdd(startKey,m);
      let d=(m===0?addDaysISO(today,1):k+'-05');
      if(d>endISO)continue;
      add(d,-sc.monthlyAdj);bucket(monthKey(d),'bills',sc.monthlyAdj);
      events.push({date:d,label:'Monthly set-aside adjustment (what-if)',amt:-sc.monthlyAdj,kind:'scenario'});}
  }
  const labels=[],series=[];let bal=cash0;
  labels.push(fmtDShort(today)+' (now)');series.push(round2(cash0));
  let firstNeg=null,minBal=cash0,minDate=today;
  for(let d=addDaysISO(today,1);d<=endISO;d=addDaysISO(d,1)){
    bal=round2(bal+(dayDelta[d]||0));
    labels.push(fmtDShort(d));series.push(bal);balAfter[d]=bal;
    if(bal<0&&!firstNeg)firstNeg={date:d,amount:bal};
    if(bal<minBal){minBal=bal;minDate=d;}
  }
  const months=[];let cum=cash0;
  for(let m=0;m<horizon;m++){const k=monthAdd(startKey,m);const b=mk[k]||{income:0,bills:0,variable:0};
    const net=round2(b.income-b.bills-b.variable);cum=round2(cum+net);
    months.push({k:k,income:b.income,bills:b.bills,variable:b.variable,net:net,end:cum});}
  const warnings=[];
  if(firstNeg){const nextInc=events.filter(e=>e.kind==='income'&&e.date>firstNeg.date)[0];
    warnings.push({level:'danger',text:'Projected available cash turns negative on '+fmtDate(firstNeg.date)+' ('+money(firstNeg.amount)+').'+(nextInc?' Next expected income after that: '+nextInc.label+' on '+fmtDate(nextInc.date)+'.':'')});}
  if(base.__limited)warnings.push({level:'warn',text:'Transaction history is limited, so variable-spending estimates lean on this month\u2019s pace only. They will improve as you record more months.'});
  const keys3=allMonths().filter(k=>k<startKey).slice(-3);
  if(keys3.length>=2){const tots=keys3.map(k=>periodSummary(monthTxns(k)).netExpense);
    const avg=tots.reduce((a,b)=>a+b,0)/tots.length;
    if(avg>0&&(Math.max.apply(null,tots)-Math.min.apply(null,tots))/avg>0.6)warnings.push({level:'warn',text:'Your monthly spending has been highly variable, so treat these projections as rough bounds rather than precise figures.'});}
  const explanations=[
    'Current available cash & deposits (from your ledger): '+money(cash0)+'.',
    'Expected income remaining (from active recurring schedules): '+money(incomeRem)+'.',
    'Confirmed scheduled bills & planned payments: '+money(billsRem)+'.',
    'Estimated variable spending ('+base.__months+'-month average, spread over remaining days): '+money(variableRem)+'.',
    'Projected ending cash: '+money(cash0)+' + '+money(incomeRem)+' \u2212 '+money(billsRem)+' \u2212 '+money(variableRem)+(sc.oneTime||sc.monthlyAdj?' \u2212 what-if items':'')+' = '+money(months[months.length-1].end)+'.'
  ];
  if(sc.incomePct)explanations.push('What-if applied: income '+(sc.incomePct>0?'+':'')+sc.incomePct+'%.');
  if(sc.diningCut)explanations.push('What-if applied: Food & Dining cut by '+sc.diningCut+'%.');
  events.sort((a,b)=>a.date<b.date?-1:1);
  return{cash0:cash0,labels:labels,series:series,events:events,months:months,balAfter:balAfter,incomeRem:incomeRem,billsRem:billsRem,variableRem:variableRem,
    projectedEnd:months[months.length-1].end,minBal:minBal,minDate:minDate,firstNeg:firstNeg,warnings:warnings,explanations:explanations,
    limited:!!base.__limited,horizon:horizon,endISO:endISO};
}

/* ---------------- Safe to spend today ----------------
   Money in this budget month (received + pay still due), minus bills still
   due, minus monthly goal savings, minus what you've already spent,
   spread over the days left. Same idea as PocketGuard's "In My Pocket". */
function safeToSpend(){
  const today=TODAY(),k=monthKey(today),start=monthStart(k),end=monthEnd(k);
  const S=periodSummary(monthTxns(k));
  let incomeDue=0,billsDue=0,nBills=0;
  for(const r of state.recurring){
    if(r.status!=='active'||!r.nextDue)continue;
    for(const d of occBetween(r,start,end)){
      if(d<r.nextDue||postedOn(r.id,d))continue;
      if(r.type==='income')incomeDue+=r.amount;else{billsDue+=r.amount;nBills++;}
    }
  }
  const goals=state.goals.filter(g=>g.monthlyContribution>0&&!(g.target>0&&g.saved>=g.target)).reduce((s,g)=>s+(g.monthlyContribution||0),0);
  const left=round2(S.income+incomeDue-billsDue-goals-S.netExpense);
  const days=Math.max(1,daysBetween(today,end)+1);
  return{income:round2(S.income),incomeDue:round2(incomeDue),billsDue:round2(billsDue),nBills:nBills,goals:round2(goals),
    spent:S.netExpense,left:left,days:days,perDay:left>0?Math.floor(left/days):0,end:end};
}

/* ---------------- Category memory ----------------
   Type a description you've used before and the app picks the same
   category and account you used last time. */
function recallFor(desc,type){
  const key=normKey(desc);if(key.length<2)return null;
  let best=null;
  for(const t of state.transactions){
    if(t.type!==type||normKey(t.description)!==key)continue;
    if(!best||t.date>=best.date)best=t;
  }
  if(!best)return null;
  return{category:best.category,account:(type==='income'||type==='refund')?best.toAccount:best.fromAccount};
}
function knownDescriptions(type){
  const cnt={},name={};
  for(const t of state.transactions){if(t.type!==type||!t.description)continue;const k=normKey(t.description);if(!k)continue;cnt[k]=(cnt[k]||0)+1;name[k]=t.description;}
  return Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,60).map(k=>name[k]);
}

/* ---------------- Insights ---------------- */
function computeInsights(){
  const out=[],k=ui.month,today=TODAY();
  const cur=monthKey(today);
  const add=(key,level,title,body,actionHTML)=>{if(state.dismissed.includes(key))return;
    out.push({key:key,level:level,title:title,body:body,actionHTML:actionHTML||''});};
  const spendMap=netSpendByCat(monthTxns(k));
  for(const b of budgetsFor(k)){
    if(b.scope!=='monthly'||b.category==='__total__')continue;
    const spent=spendMap[b.category]||0;
    if(!(b.amount>0))continue;
    const p=spent/b.amount*100;
    const est=spent+(k===cur?estimateCategoryRemainder(b.category):0);
    if(p>=state.settings.dangerThreshold)
      add('bud:'+b.category+':'+k,'danger',b.category+' is over budget',money(spent)+' spent of '+money(b.amount)+' ('+pctStr(p)+').'+(k===cur?' Projected month-end: '+money(est)+'.':''),
        '<button class="btn btn-sm" data-act="drill" data-cat="'+esc(b.category)+'" data-from="'+monthStart(k)+'" data-to="'+monthEnd(k)+'">View transactions</button><button class="btn btn-sm" data-act="bud-edit" data-id="'+esc(b.id)+'">Adjust budget</button>');
    else if(p>=state.settings.warnThreshold)
      add('bud:'+b.category+':'+k,'warn',b.category+' is approaching its budget',pctStr(p)+' of '+money(b.amount)+' used ('+money(spent)+').'+(k===cur?' Projected month-end: about '+money(est)+'.':''),
        '<button class="btn btn-sm" data-act="drill" data-cat="'+esc(b.category)+'" data-from="'+monthStart(k)+'" data-to="'+monthEnd(k)+'">View transactions</button>');
    else if(est>0&&est<b.amount*0.9&&b.amount-est>=1000&&dayOfPeriod(today)>=15&&k===cur)
      add('budok:'+b.category+':'+k,'good',b.category+' has unused budget',money(b.amount-est)+' looks likely to remain unspent (projected '+money(est)+' of '+money(b.amount)+'). Consider moving the surplus to a savings goal.',
        '<button class="btn btn-sm" data-act="nav" data-sec="goals">Go to goals</button>');
  }
  const base=categoryBaseline();
  if(!base.__limited){
    for(const cat in base){if(cat.indexOf('__')===0)continue;
      const spent=spendMap[cat]||0,avg=base[cat];
      if(avg>0&&spent>avg*1.5&&spent-avg>=1000)
        add('anom:'+cat+':'+k,'warn','Spending on '+cat+' is above your usual pace','This month: '+money(spent)+' vs a '+base.__months+'-month average of '+money(avg)+'. That is '+money(spent-avg)+' above baseline.',
          '<button class="btn btn-sm" data-act="drill" data-cat="'+esc(cat)+'" data-from="'+monthStart(k)+'" data-to="'+monthEnd(k)+'">Inspect transactions</button>');
    }
  }
  for(const r of overdueBills()){
    add('bill:'+r.id+':'+r.nextDue,'danger','Overdue: '+r.description,'Was due '+fmtDate(r.nextDue)+' ('+money(r.amount)+'). It has not been recorded as paid.',
      '<button class="btn btn-sm btn-primary" data-act="rec-paid" data-id="'+esc(r.id)+'">Mark as paid</button><button class="btn btn-sm" data-act="rec-skip" data-id="'+esc(r.id)+'">Skip</button>');
  }
  for(const e of dueSoon(5)){
    if(e.date<today)continue;
    const dd=relDays(e.date);
    const when=(dd===0?'today':(dd+' day(s) from now'));
    add('bill:'+e.r.id+':'+e.date,'info','Upcoming: '+e.r.description,
      money(e.r.amount)+' due '+fmtDate(e.date)+' ('+when+'), '+(e.r.type==='income'?'into ':'paid from ')+((accountById(e.r.account)||{name:'\u2014'}).name)+'.',
      '<button class="btn btn-sm btn-primary" data-act="rec-paid" data-id="'+esc(e.r.id)+'">'+(e.r.type==='income'?'Mark as received':'Mark as paid')+'</button>');
  }
  const fc=computeForecast(1);
  if(fc.firstNeg)
    add('fc:neg:'+cur,'danger','Projected cash may fall short','Based on current balances, schedules and estimated spending, available cash may go negative around '+fmtDate(fc.firstNeg.date)+'. Review the Forecast section.',
      '<button class="btn btn-sm" data-act="nav" data-sec="forecast">Open forecast</button>');
  const cf=avgNetCashflow(3);
  for(const g of state.goals){
    if(!g.targetDate||g.target<=0)continue;
    const monthsLeft=Math.max(1,Math.round((parseISO(g.targetDate)-parseISO(today))/(30.44*86400000)));
    const need=round2(Math.max(0,g.target-g.saved)/monthsLeft);
    if(need>0&&cf!=null&&cf>0&&need>cf)
      add('goal:'+g.id+':'+cur,'warn','Goal "'+g.name+'" needs more than your cash flow allows','Requires about '+money(need)+'/month for '+monthsLeft+' months, but your average net cash flow is '+money(cf)+'/month. Consider extending the target date or lowering the target.',
        '<button class="btn btn-sm" data-act="goal-edit" data-id="'+esc(g.id)+'">Adjust goal</button>');
  }
  if(base['Subscriptions']>0||spendMap['Subscriptions']>0){
    const per=spendMap['Subscriptions']||base['Subscriptions']||0;
    const ann=round2(per*12);
    if(ann>=6000)add('sub:annual','info','Subscriptions cost about '+money(ann)+' per year','Based on roughly '+money(per)+' per month. Worth reviewing which ones you actually use.',
      '<button class="btn btn-sm" data-act="drill" data-cat="Subscriptions">See subscriptions</button>');
  }
  const recent=state.transactions.filter(t=>t.date>=addDaysISO(today,-60));
  const seen={},dups=[];
  for(const t of recent){
    if(t.type==='transfer')continue;
    const key=t.date+'|'+round2(t.amount)+'|'+t.description.toLowerCase().trim();
    if(seen[key]){if(!state.exceptions.includes(t.id)&&!state.exceptions.includes(seen[key].id))dups.push([seen[key],t]);}
    else seen[key]=t;
  }
  dups.slice(0,3).forEach(p=>add('dup:'+p[0].id+':'+p[1].id,'warn','Possible duplicate transaction','"'+p[1].description+'" ('+money(p[1].amount)+') appears twice on '+fmtDate(p[1].date)+'. Not fraud \u2014 just a possible double entry.',
    '<button class="btn btn-sm" data-act="txn-view" data-id="'+esc(p[1].id)+'">Review</button><button class="btn btn-sm btn-ghost" data-act="anom-except" data-id="'+esc(p[1].id)+'">It\u2019s not a duplicate</button>'));
  return out;
}

/* ---------------- Charts (local SVG) ---------------- */
const CPL=54,CPR=14,CPT=14,CPB=30;
const nochart=msg=>'<div class="nochart">'+esc(msg||'Not enough data to chart yet.')+'</div>';
function svgLine(o){
  const w=o.w||720,h=o.h||230,labels=o.labels||[],series=o.series||[],fmtY=o.fmtY||money0;
  const n=labels.length;
  if(!n||!series.length)return nochart(o.emptyMsg);
  const vals=[];for(const s of series)for(const v of s.data){if(v!=null&&isFinite(v))vals.push(v);}
  if(!vals.length)return nochart(o.emptyMsg);
  let min=Math.min(0,Math.min.apply(null,vals)),max=Math.max(0,Math.max.apply(null,vals));
  if(max===min)max=min+1;
  const iw=w-CPL-CPR,ih=h-CPT-CPB;
  const X=i=>CPL+(n<=1?iw/2:i*iw/(n-1));
  const Y=v=>CPT+(max-v)/(max-min)*ih;
  let out='<svg viewBox="0 0 '+w+' '+h+'" class="chart" role="img">';
  for(let g=0;g<=4;g++){const v=min+(max-min)*g/4,y=Y(v);
    out+='<line x1="'+CPL+'" y1="'+y.toFixed(1)+'" x2="'+(w-CPR)+'" y2="'+y.toFixed(1)+'" style="stroke:var(--grid)"/><text x="'+(CPL-8)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" class="ct">'+esc(fmtY(v))+'</text>';}
  if(min<0){const y0=Y(0);out+='<line x1="'+CPL+'" y1="'+y0.toFixed(1)+'" x2="'+(w-CPR)+'" y2="'+y0.toFixed(1)+'" style="stroke:var(--ink)" stroke-dasharray="3 4" opacity=".35"/>';}
  const step=Math.max(1,Math.ceil(n/6));
  labels.forEach(function(lb,i){if(i%step===0||i===n-1)out+='<text x="'+X(i).toFixed(1)+'" y="'+(h-8)+'" text-anchor="middle" class="ct">'+esc(String(lb).slice(0,9))+'</text>';});
  let guide='';
  if(o.guide)guide='<line class="guide" x1="0" y1="'+CPT+'" x2="0" y2="'+(h-CPB)+'" style="stroke:var(--ink)" stroke-width="1" opacity="0" stroke-dasharray="3 3"/>';
  for(const s of series){
    const pts=s.data.map(function(v,i){return v==null?null:[X(i),Y(v)];});
    const full=pts.length>1&&pts.every(function(p){return !!p;});
    let d='';
    if(full)d=smoothD(pts);
    else{let open=false;pts.forEach(function(p){if(p){d+=(open?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);open=true;}else open=false;});}
    if(s.area&&full){
      const base=Y(Math.max(min,0)).toFixed(1);
      out+='<path d="'+d+'L'+pts[pts.length-1][0].toFixed(1)+' '+base+'L'+pts[0][0].toFixed(1)+' '+base+'Z" style="fill:'+s.color+'" opacity="0.06"/>';
    }
    out+='<path d="'+d+'" style="fill:none;stroke:'+s.color+'" stroke-width="2.6"'+(s.dashed?' stroke-dasharray="6 4"':'')+' stroke-linejoin="round" stroke-linecap="round"/>';
    if(pts.length<=14)pts.forEach(function(p,i){if(p)out+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" style="fill:'+s.color+'" class="chov"><title>'+esc(labels[i])+': '+esc((s.tipFmt||money)(s.data[i]))+'</title></circle>';});
  }
  out+=guide;
  if(o.markers)for(const m of o.markers){const i=labels.indexOf(m.label);if(i>=0)out+='<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(m.value).toFixed(1)+'" r="4.5" style="fill:'+(m.color||'var(--ink)')+';stroke:var(--paper)" stroke-width="1.5"><title>'+esc(m.title)+'</title></circle>';}
  out+='</svg>';
  return out;
}
function svgBars(o){
  const w=o.w||720,h=o.h||230,labels=o.labels||[],series=o.series||[],fmtY=o.fmtY||money0;
  const n=labels.length;
  if(!n||!series.length)return nochart(o.emptyMsg);
  const vals=[];for(const s of series)for(const v of s.data){if(v!=null&&isFinite(v))vals.push(v);}
  if(!vals.length||vals.every(v=>!v))return nochart(o.emptyMsg);
  let min=Math.min(0,Math.min.apply(null,vals)),max=Math.max(0,Math.max.apply(null,vals));
  if(max===min)max=min+1;
  const iw=w-CPL-CPR,ih=h-CPT-CPB;
  const Y=v=>CPT+(max-v)/(max-min)*ih;
  const gw=iw/n,bw=Math.max(3,(gw-10)/series.length);
  let out='<svg viewBox="0 0 '+w+' '+h+'" class="chart" role="img">';
  for(let g=0;g<=4;g++){const v=min+(max-min)*g/4,y=Y(v);
    out+='<line x1="'+CPL+'" y1="'+y.toFixed(1)+'" x2="'+(w-CPR)+'" y2="'+y.toFixed(1)+'" style="stroke:var(--grid)"/><text x="'+(CPL-8)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" class="ct">'+esc(fmtY(v))+'</text>';}
  const y0=Y(Math.max(min,Math.min(0,max)));
  labels.forEach(function(lb,i){
    series.forEach(function(s,j){
      const v=s.data[i];if(v==null)return;
      const x=CPL+i*gw+5+j*bw,yv=Y(v);
      const y=Math.min(yv,y0),bh=Math.abs(yv-y0);
      out+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,bh).toFixed(1)+'" rx="3" style="fill:'+s.color+'" class="chov"><title>'+esc(lb)+' \u2014 '+esc(s.name)+': '+esc((s.tipFmt||money)(v))+'</title></rect>';
      if(n<=14&&Math.abs(v)>0)out+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle" class="ct">'+esc(money0(v))+'</text>';
    });
    out+='<text x="'+(CPL+i*gw+gw/2).toFixed(1)+'" y="'+(h-8)+'" text-anchor="middle" class="ct">'+esc(String(lb).slice(0,9))+'</text>';
  });
  out+='</svg>';
  return out;
}
function svgDonut(items,o){
  o=o||{};const size=o.size||170,thick=(o.thick==null?21:o.thick);
  const total=items.reduce(function(s,x){return s+Math.max(0,x.value);},0);
  if(!(total>0))return nochart(o.emptyMsg);
  const r=(size-thick)/2,c=size/2,circ=2*Math.PI*r;let off=0;
  let out='<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" role="img">';
  items.forEach(function(x){
    if(!(x.value>0))return;
    const frac=x.value/total,len=frac*circ;
    out+='<circle cx="'+c+'" cy="'+c+'" r="'+r+'" style="fill:none;stroke:'+x.color+'" stroke-width="'+thick+'" stroke-dasharray="'+len.toFixed(2)+' '+(circ-len).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 '+c+' '+c+')" class="chov"><title>'+esc(x.label)+': '+esc(money(x.value))+' ('+pctStr(frac*100)+')</title></circle>';
    off+=len;
  });
  out+='<text x="'+c+'" y="'+(c-3)+'" text-anchor="middle" style="font-weight:800;font-size:16px;fill:var(--ink);font-family:Archivo,sans-serif">'+esc(o.center||'')+'</text>';
  out+='<text x="'+c+'" y="'+(c+15)+'" text-anchor="middle" class="ct">'+esc(o.centerSub||'')+'</text></svg>';
  return out;
}
function attachHover(wrapId,labels,series){
  const wrap=document.getElementById(wrapId);if(!wrap)return;
  const svg=wrap.querySelector('svg.chart');if(!svg)return;
  const g=svg.querySelector('.guide');
  let tip=wrap.querySelector('.chart-tip');
  if(!tip){tip=document.createElement('div');tip.className='chart-tip';wrap.appendChild(tip);}
  svg.onmousemove=function(e){
    const r=svg.getBoundingClientRect(),vw=svg.viewBox.baseVal.width;
    const iw=vw-CPL-CPR,n=labels.length;if(n<1)return;
    let i=Math.round(((e.clientX-r.left)/r.width*vw-CPL)/iw*(n-1));i=clamp(i,0,n-1);
    const px=CPL+i*iw/Math.max(1,n-1);
    if(g){g.setAttribute('x1',px);g.setAttribute('x2',px);g.setAttribute('opacity','1');}
    let rows='';for(const s of series){const v=s.data[i];
      rows+='<div class="row"><span><span class="dot" style="background:'+s.color+'"></span>'+esc(s.name)+'</span><b>'+money(v==null?0:v)+'</b></div>';}
    tip.innerHTML='<b>'+esc(labels[i])+'</b>'+rows;
    tip.style.display='block';
    const wr=wrap.getBoundingClientRect();
    tip.style.left=clamp((px/vw*r.width)+12,4,Math.max(4,wr.width-150))+'px';
    tip.style.top='4px';
  };
  svg.onmouseleave=function(){tip.style.display='none';if(g)g.setAttribute('opacity','0');};
}
function sparkline(vals,color){
  const pts=vals.map(function(v,i){return [i,v];}).filter(function(p){return p[1]!=null;});
  if(pts.length<2)return '<span class="week-chip">no history</span>';
  const min=Math.min.apply(null,pts.map(function(p){return p[1];})),max=Math.max.apply(null,pts.map(function(p){return p[1];}));
  const Y=v=>max===min?12:18-(v-min)/(max-min)*16;
  let d='';pts.forEach(function(p,i){d+=(i?'L':'M')+(i/(pts.length-1)*76).toFixed(1)+' '+Y(p[1]).toFixed(1);});
  return '<svg width="80" height="26" viewBox="0 0 76 26"><path d="'+d+'" style="fill:none;stroke:'+color+'" stroke-width="1.8"/></svg>';
}

