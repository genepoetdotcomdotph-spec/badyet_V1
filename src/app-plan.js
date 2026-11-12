/* ================= GUIDED SETUP & MY PLAN =================
   Setup (6 steps) runs on a brand-new sheet, or from Budgets > Set Up My Plan.
   My Plan is the same data on one screen, editable anytime; saving applies to
   the current budget month right away. */
const DEFAULT_LINES={
  needs:[['Needs',41.7,'home']],
  debts:[['Personal / Credit Debt',5000,30000,6,'monthly','card']],
  wants:[['Wants',30,'bag']],
  savings:[['Emergency Fund',10,'shield'],['Travel',5,'plane'],['Investments',5,'trend']]};
const SUGGEST={needs:['Housing & Rent','Groceries','Utilities','Transportation','Healthcare','Insurance','Education'],
  debts:['Credit Card','Personal Loan','Auto Loan','Student Loan','BNPL / Installment'],
  wants:['Food & Dining','Shopping','Entertainment','Subscriptions','Personal Care','Hobbies','Gifts'],
  savings:['Gadget','Wedding','House Down Payment','Retirement','Car']};
const LINE_DESC={'Needs':'All essential consumption (bills, groceries, fare)','Wants':'All lifestyle & discretionary consumption','Housing & Rent':'Rent or mortgage','Groceries':'Food and supplies for home','Utilities':'Electricity, water, internet',
  'Transportation':'Fare, fuel, parking','Debt Payments':'Cards and loans','Food & Dining':'Restaurants, coffee, delivery',
  'Shopping':'Clothes, gadgets, online','Entertainment':'Movies, games, outings','Subscriptions':'Netflix, Spotify, apps',
  'Personal Care':'Haircut, skincare','Healthcare':'Medicine, check-ups','Insurance':'Life, health, car','Education':'School, courses, books',
  'Emergency Fund':'For surprises, 3–6 months of costs','Travel':'Trips and holidays','Investments':'Stocks, funds, MP2'};
const GROUP_DESC={needs:'Consumption essentials + Debts tab seated here',wants:'Lifestyle consumption (no subcategories needed)',savings:'Subcategories & goals (add or withdraw anytime)'};
const PRESETS=[['Balanced',50,30,20],['Starter',70,20,10],['Saver',60,20,20]];
const PLAN_MARK=' (from plan)';
const GCOL={needs:'var(--ink)',debts:'var(--g1)',wants:'var(--g2s)',savings:'var(--g3s)'};
function lineIcon(name,g,customIc){
  if(customIc&&ICONS[customIc])return customIc;
  if(state&&state.settings&&state.settings.catIcons&&state.settings.catIcons[name]&&ICONS[state.settings.catIcons[name]])return state.settings.catIcons[name];
  if(g==='debts')return 'card';
  if(g==='savings')return ({'Emergency Fund':'shield','Travel':'plane','Japan trip (spring)':'plane','Investments':'trend'})[name]||'flag';
  return catIconName(name,'expense');
}
function suIconTrayHTML(l){
  if(!su||su.iconPickId!==l.id)return '';
  const cur=lineIcon(l.name,l.group,l.icon);
  return '<div class="su-icon-tray" role="listbox" aria-label="Choose icon">'+
    PICKABLE_ICONS.map(function(ic){
      return '<button type="button" class="su-icon-opt'+(cur===ic?' on':'')+'" data-su="set-icon" data-id="'+l.id+'" data-ic="'+ic+'" title="'+ic+'">'+I(ic,17)+'</button>';
    }).join('')+
  '</div>';
}

let su=null;
const suEsc=v=>esc(v==null?'':String(v));
function suParse(raw){
  const s=String(raw==null?'':raw).trim().replace(/[₱,\s]/g,'').replace(/%$/,'');
  if(s==='')return{empty:true,v:0};
  if(!/^-?(\d+\.?\d*|\.\d+)$/.test(s))return{bad:'Numbers only'+(/o/i.test(s)?' — that “O” is a letter, not a zero':''),v:0};
  const v=parseFloat(s);if(v<0)return{bad:'Can’t be negative',v:0};
  return{v:v};
}
const fmtPct=v=>(Math.round(v*10)/10).toString().replace(/\.0$/,'')+'%';
function draftFrom(plan,fresh){
  const p=plan&&plan.income>0&&plan.lines.length?plan:null;
  const inc0=p?p.income:((state.plan&&state.plan.income)||60000);
  const lines=p?p.lines.map(l=>{
    const isD=l.group==='debts';
    const mos=isD?Math.max(1,Math.round(toNum(l.months))||6):6;
    const tot=isD?(toNum(l.target)||round2((toNum(l.amount)||0)*mos)):(toNum(l.target)||0);
    const pd=isD?(toNum(l.paid)||0):0;
    const rem=isD?Math.max(0,round2(tot-pd)):0;
    const moAmt=isD?round2(rem/mos):(l.mode==='pct'?l.pct:l.amount);
    return{id:l.id,group:l.group,name:l.name,mode:isD?'amt':l.mode,raw:String(moAmt),rollover:!!l.rollover,
      target:tot?String(tot):'',targetDate:l.targetDate||'',paid:pd?String(pd):'0',months:String(mos),freq:l.freq||'monthly',icon:l.icon||lineIcon(l.name,l.group),custom:false};
  }):[
    {id:uid('PLN'),group:'needs',name:'Needs',mode:'amt',raw:String(Math.max(0,round2(inc0*0.5-5000))),rollover:false,target:'',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:'home',custom:false},
    {id:uid('PLN'),group:'debts',name:'Personal / Credit Debt',mode:'amt',raw:'5000',rollover:false,target:'30000',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:'card',custom:false},
    {id:uid('PLN'),group:'wants',name:'Wants',mode:'pct',raw:'30',rollover:false,target:'',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:'bag',custom:false},
    {id:uid('PLN'),group:'savings',name:'Emergency Fund',mode:'pct',raw:'10',rollover:false,target:'120000',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:'shield',custom:false},
    {id:uid('PLN'),group:'savings',name:'Travel',mode:'pct',raw:'5',rollover:false,target:'80000',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:'plane',custom:false},
    {id:uid('PLN'),group:'savings',name:'Investments',mode:'pct',raw:'5',rollover:false,target:'100000',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:'trend',custom:false}
  ];
  const inc=p?p.income:(state.plan&&state.plan.income)||'';
  return{income:inc?String(inc):'',payday:p?p.payday:'15-30',payDay:String(p?p.payDay:10),
    split:{needs:String(p?p.split.needs:50),wants:String(p?p.split.wants:30),savings:String(p?p.split.savings:20)},
    lines:lines,acc:{name:'My Bank',type:'bank',bal:''}};
}
function suSyncDebtLineRaw(l,inc){
  if(l.group!=='debts')return;
  const t=suParse(l.target),p=suParse(l.paid),m=suParse(l.months);
  const tot=t.bad||t.empty?0:t.v;
  const pd=p.bad||p.empty?0:p.v;
  const mos=Math.max(1,Math.round(m.bad||m.empty?6:m.v));
  const rem=Math.max(0,round2(tot-pd));
  l.mode='amt';
  l.raw=String(round2(rem/mos));
}
function suBalanceNeedsTank(d){
  const ip=suParse(d.income),inc=ip.bad||ip.empty?0:ip.v;
  const sp=suParse(d.split.needs),needsPct=sp.bad||sp.empty?0:sp.v;
  const needsTarget=round2(inc*needsPct/100);
  const debtLines=d.lines.filter(l=>l.group==='debts');
  debtLines.forEach(l=>suSyncDebtLineRaw(l,inc));
  const debtSum=round2(debtLines.reduce((s,l)=>s+(suParse(l.raw).v||0),0));
  const needsLines=d.lines.filter(l=>l.group==='needs');
  if(needsLines.length===1&&needsLines[0].name==='Needs'&&inc>0){
    const remNeeds=Math.max(0,round2(needsTarget-debtSum));
    needsLines[0].mode='amt';
    needsLines[0].raw=String(remNeeds);
  }
}
function suCalc(d){
  const ip=suParse(d.income),inc=ip.bad||ip.empty?0:ip.v;
  const out={inc:inc,incErr:ip.bad||(ip.empty?'Enter your monthly income':(inc<=0?'Must be more than ₱0':'')),split:{},splitErr:{},lines:{},groups:{},debts:{sum:0,pct:0,remTotal:0,count:0},errCount:0};
  let tot=0;
  PLAN_GROUPS.forEach(g=>{const r=suParse(d.split[g]);out.split[g]=r.bad||r.empty?0:r.v;
    out.splitErr[g]=r.bad||(r.empty?'Enter a percent':(r.v>100?'Can’t be more than 100%':''));tot+=out.split[g];});
  out.splitTotal=Math.round(tot*100)/100;
  out.splitOk=!PLAN_GROUPS.some(g=>out.splitErr[g])&&Math.abs(tot-100)<0.001;
  d.lines.filter(l=>l.group==='debts').forEach(l=>suSyncDebtLineRaw(l,inc));
  PLAN_GROUPS.forEach(g=>{
    const target=round2(inc*out.split[g]/100);let sum=0,bad=0;
    const checkLines=g==='needs'?d.lines.filter(l=>l.group==='needs'||l.group==='debts'):d.lines.filter(l=>l.group===g);
    checkLines.forEach(l=>{
      if(l.group==='debts'){
        const rt=suParse(l.target),rp=suParse(l.paid),rm=suParse(l.months);
        const totD=rt.bad||rt.empty?0:rt.v,pdD=rp.bad||rp.empty?0:rp.v,mosD=Math.max(1,Math.round(rm.bad||rm.empty?1:rm.v));
        const remD=Math.max(0,round2(totD-pdD));
        const amt=round2(remD/mosD);
        const pct=inc>0?amt/inc*100:0;
        let err=rt.bad||rp.bad||rm.bad||(totD<=0?'Enter total debt amount':'')||(!String(l.name||'').trim()?'Give this debt a name':'');
        if(!err&&pct>out.split.needs+1e-9)err='Monthly installment ('+money0(amt)+') exceeds your entire Needs share ('+money0(target)+'). Increase payoff months or raise Needs %.';
        if(err)bad++;
        out.lines[l.id]={amt:amt,pct:pct,rem:remD,mos:mosD,err:err};
        out.debts.sum=round2(out.debts.sum+amt);
        out.debts.remTotal=round2(out.debts.remTotal+remD);
        if(remD>0)out.debts.count++;
        sum+=amt;
        return;
      }
      const r=suParse(l.raw);let err=r.bad||(r.empty?'Enter an amount, or remove this line':'');
      const amt=r.bad||r.empty?0:(l.mode==='pct'?round2(inc*r.v/100):r.v);
      const pct=l.mode==='pct'?(r.bad||r.empty?0:r.v):(inc>0?amt/inc*100:0);
      if(!err&&pct>out.split[g]+1e-9)err='A line can’t be more than its group ('+fmtPct(out.split[g])+')';
      if(!err&&!String(l.name||'').trim())err='Give this line a name';
      if(!err&&d.lines.some(x=>x!==l&&x.group!=='savings'&&l.group!=='savings'&&x.name.trim().toLowerCase()===String(l.name).trim().toLowerCase()))err='This name is already used';
      if(err)bad++;
      out.lines[l.id]={amt:amt,pct:pct,err:err};sum+=amt;});
    const diff=round2(sum-target);
    const tol=Math.max(0.5,inc*0.00005);
    out.groups[g]={target:target,sum:round2(sum),diff:diff,bad:bad,state:bad?'bad':diff>tol?'over':diff<-tol?'under':'ok',sumPct:inc>0?sum/inc*100:0};
  });
  out.debts.pct=inc>0?out.debts.sum/inc*100:0;
  out.errCount=(out.incErr?1:0)+PLAN_GROUPS.reduce((s,g)=>s+(out.splitErr[g]?1:0)+out.groups[g].bad,0);
  return out;
}
function suStepValid(c,step){
  if(step===1)return !c.incErr&&(!su.needAcc||String(su.d.acc.name).trim())&&(su.d.payday!=='day'||(+su.d.payDay>=1&&+su.d.payDay<=28));
  if(step===2)return c.splitOk;
  if(step>=3&&step<=5){const g=PLAN_GROUPS[step-3];return c.groups[g].state==='ok';}
  return !c.errCount&&c.splitOk&&PLAN_GROUPS.every(g=>c.groups[g].state==='ok');
}

function openSetup(opts){
  opts=opts||{};
  su={mode:opts.edit?'edit':'setup',fresh:!!opts.fresh,step:opts.step||1,needsTab:opts.needsTab||'needs',iconPickId:null,showCatSetup:false,dir:'fwd',d:draftFrom(opts.edit?state.plan:null,opts.fresh),
    touched:{},last:{},bad:{},needAcc:!state.accounts.length};
  if(!su.d.income&&!opts.edit){const ex=round2(avgIncome());if(ex>0)su.d.income=String(Math.round(ex));}
  suBalanceNeedsTank(su.d);
  su.auto={};const c0=suCalc(su.d);PLAN_GROUPS.forEach(function(g){if(c0.groups[g].state==='ok')su.auto[g]=true;});
  let el=document.getElementById('suRoot');
  if(!el){el=document.createElement('div');el.id='suRoot';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');document.body.appendChild(el);}
  document.body.classList.add('su-open');
  suDraw();
}
function avgIncome(){const cur=monthKey(TODAY());const ks=allMonths().filter(k=>k<cur).slice(-3);if(!ks.length)return 0;
  return ks.reduce((s,k)=>s+periodSummary(monthTxns(k)).income,0)/ks.length;}
function closeSetup(){
  const el=document.getElementById('suRoot');if(el){el.classList.add('su-out');setTimeout(function(){el.remove();},220);}
  document.body.classList.remove('su-open');su=null;
  if(typeof Sync!=='undefined'&&Sync.deferRender)setTimeout(safeRender,240);
}
function suOpen(){return !!su&&!!document.getElementById('suRoot');}

function suThemeSwitch(){
  const t=state.settings.theme;
  return '<span class="tsw" role="radiogroup" aria-label="Color theme">'+[['light','sun','Light'],['dark','moon','Dark'],['auto','auto','Auto (follows your phone)']].map(function(o){
    return '<button type="button" role="radio" aria-checked="'+(t===o[0])+'" aria-label="'+o[2]+'" title="'+o[2]+'" data-su="theme" data-v="'+o[0]+'" class="'+(t===o[0]?'on':'')+'">'+I(o[1],15)+'</button>';}).join('')+'</span>';
}
function suRing(c,size,center,sub){
  size=size||112;const st=size>130?18:14,r=(size-st)/2-3,C=2*Math.PI*r,cx=size/2;
  const over=Math.max(0,c.splitTotal-100),tot=Math.max(100,c.splitTotal);let off=0,segs='';
  PLAN_GROUPS.forEach(function(g){const v=c.split[g]/tot*100,L=Math.max(0,C*v/100-(v>0?3:0));
    segs+='<circle class="su-seg" cx="'+cx+'" cy="'+cx+'" r="'+r.toFixed(1)+'" fill="none" style="stroke:'+GCOL[g]+'" stroke-width="'+st+'" stroke-dasharray="'+L.toFixed(1)+' '+C.toFixed(1)+'" stroke-dashoffset="'+(-off).toFixed(1)+'" transform="rotate(-90 '+cx+' '+cx+')"/>';off+=C*v/100;});
  if(over>0){const r2=r+st/2+5,C2=2*Math.PI*r2;segs+='<circle cx="'+cx+'" cy="'+cx+'" r="'+r2.toFixed(1)+'" fill="none" style="stroke:var(--err)" stroke-width="4" stroke-linecap="round" stroke-dasharray="'+(C2*Math.min(over,100)/100).toFixed(1)+' '+C2.toFixed(1)+'" transform="rotate(-90 '+cx+' '+cx+')"/>';}
  return '<div class="su-ring" style="width:'+size+'px;height:'+size+'px"><svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="overflow:visible" aria-hidden="true">'+segs+'</svg>'+
    '<div class="su-ring-c"><b class="'+(over>0?'err-txt':'')+'" style="font-size:'+(size>130?19:22)+'px">'+(center||fmtPct(c.splitTotal))+'</b><span class="'+(over>0?'err-txt':'')+'">'+(sub||(over>0?fmtPct(over)+' too much':c.splitOk?'planned ✓':fmtPct(100-c.splitTotal)+' left'))+'</span></div></div>';
}
function suTop(){
  if(su.mode==='edit')return '<div class="su-top"><button class="ib" data-su="close" aria-label="Back">'+I('chevL',18)+'</button><b class="su-title">My Plan (Needs · Debts · Wants · Savings)</b>'+suThemeSwitch()+'</div>';
  const s=su.step;
  return '<div class="su-top"><button class="ib" data-su="'+(s===1?'close':'back')+'" aria-label="'+(s===1?'Close':'Back')+'">'+I(s===1?'x':'chevL',18)+'</button>'+
    '<span class="su-stepno">Step '+s+' of 6</span>'+(s===1?suThemeSwitch():s<6?'<button class="su-skip" data-su="skip">Skip</button>':'<span style="width:44px"></span>')+'</div>'+
    '<div class="su-prog">'+[1,2,3,4,5,6].map(function(i){return '<i class="'+(i<=s?'on':'')+'"></i>';}).join('')+'</div>';
}
function suDraw(){
  const el=document.getElementById('suRoot');if(!el||!su)return;
  const body=su.mode==='edit'?suEditBody():suStepBody(su.step);
  el.innerHTML='<div class="su-wrap">'+suTop()+'<div class="su-body" id="suBody"><div class="su-step '+su.dir+'">'+body+'</div></div><div class="su-ft" id="suFt"></div></div>';
  suRefresh(true);
  const b=document.getElementById('suBody');if(b)b.scrollTop=0;
}
const LABELS=['Income · Payday','The Big Split','Needs & Debts Tab','Wants (Consumption)','Savings & Subcategories','Review'];
function suCatSetupBoxHTML(g){
  const isEss=g==='needs';
  const cats=state.settings.expenseCats.filter(c=>c.name!=='Needs'&&c.name!=='Wants'&&c.name!=='Reconciliation'&&(isEss?c.essential:!c.essential));
  return '<details class="expl" style="margin-top:8px"'+(su.showCatSetup?' open':'')+'><summary>Optional: Set Up '+GROUP_LBL[g]+' Categories First ('+cats.length+' ready)</summary>'+
    '<div style="margin-top:8px;font-size:12.5px;color:var(--muted)">Needs and Wants work as simple 1-click consumption tanks without subcategories, or you can set up categories here first:</div>'+
    '<div class="chips" style="margin-top:8px">'+cats.map(c=>'<span class="chip sm">'+catEmoji(c.name,'expense',13)+' '+esc(c.name)+'</span>').join('')+'</div>'+
    '<div style="display:flex;gap:6px;margin-top:8px"><input class="inp" id="suQuickCat_'+g+'" placeholder="New '+GROUP_LBL[g].toLowerCase()+' category (e.g. '+(isEss?'Water, Clinic':'Coffee, Cinema')+')" style="padding:6px 12px;font-size:13px">'+
    '<button type="button" class="btn btn-sm btn-primary" data-su="addcat" data-g="'+g+'">+ Add Category</button></div>'+
    '<div style="margin-top:8px"><button type="button" class="link" style="font-size:12.5px;font-weight:700" data-su="tankonly" data-g="'+g+'">Use single '+GROUP_LBL[g]+' consumption tank (no subcategories)</button></div>'+
  '</details>';
}
function suDebtLinesHTML(){
  const dLines=su.d.lines.filter(l=>l.group==='debts');
  if(!dLines.length)return '<div class="note" style="margin:8px 0"><b>Congratulations! No debts in your plan (Debt-Free! 🎉).</b> Tap <b>+ Add Debt Plan</b> below if you have a debt to divide across months or weeks.</div>';
  return dLines.map(function(l){
    const mos=Math.max(1,Math.round(suParse(l.months).v||6));
    const ic=lineIcon(l.name,'debts',l.icon);
    return '<div class="su-debt-card" data-line="'+l.id+'">'+
      '<div class="su-debt-top">'+
        '<button type="button" class="emo su-icon-btn" data-su="pick-icon" data-id="'+l.id+'" title="Choose icon" style="width:36px;height:36px;border-radius:99px;background:var(--mist);display:inline-flex;align-items:center;justify-content:center">'+I(ic,17)+'</button>'+
        '<input class="su-name" data-su-in="name" data-id="'+l.id+'" placeholder="Debt name (e.g. Credit Card, Loan)" value="'+suEsc(l.name)+'" style="flex:1">'+
        '<button type="button" class="icon-btn" data-su="del" data-id="'+l.id+'" aria-label="Remove debt">'+I('x',14)+'</button>'+
      '</div>'+
      suIconTrayHTML(l)+
      '<div class="su-debt-grid">'+
        '<div class="su-debt-field"><label>Total Debt (₱)</label><label class="su-box" data-box="dtot-'+l.id+'"><span class="u">₱</span><input data-su-in="debt-target" data-id="'+l.id+'" inputmode="decimal" value="'+suEsc(fmtInput(l.target))+'" style="width:100%"></label></div>'+
        '<div class="su-debt-field"><label>Divide Into (Months)</label><label class="su-box"><input data-su-in="debt-months" data-id="'+l.id+'" inputmode="numeric" value="'+suEsc(l.months)+'" style="width:100%"><span class="u">mo</span></label></div>'+
        '<div class="su-debt-field"><label>Already Paid (₱)</label><label class="su-box"><span class="u">₱</span><input data-su-in="debt-paid" data-id="'+l.id+'" inputmode="decimal" value="'+suEsc(fmtInput(l.paid||'0'))+'" style="width:100%"></label></div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:2px">'+
        '<div class="chips" style="gap:4px">'+
          '<span style="font-size:11.5px;color:var(--muted);margin-right:2px">Quick term:</span>'+
          [1,2,3,6,9,12].map(m=>'<button type="button" class="chip sm'+(mos===m?' on':'')+'" data-su="debt-mos" data-id="'+l.id+'" data-m="'+m+'">'+m+' mo'+(m===1?'':'s')+'</button>').join('')+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:6px;font-size:12px"><span style="color:var(--muted)">Pay preference:</span>'+
          '<select class="inp" data-su-in="debt-freq" data-id="'+l.id+'" style="padding:4px 10px;font-size:12.5px;width:auto;border-radius:99px">'+
            [['monthly','Monthly'],['weekly','Weekly'],['biweekly','Every 2 weeks'],['quarterly','Quarterly']].map(o=>'<option value="'+o[0]+'"'+(normFreq(l.freq)===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+
          '</select>'+
        '</div>'+
      '</div>'+
      '<div class="su-debt-summary" data-debt-sum="'+l.id+'"></div>'+
      '<div class="rowerr" data-err="'+l.id+'"></div>'+
    '</div>';
  }).join('');
}
function suNeedsAndDebtsStepHTML(){
  const d=su.d,onDebt=su.needsTab==='debts';
  const dCount=d.lines.filter(l=>l.group==='debts').length;
  return '<div class="su-subtabs" role="tablist" aria-label="Needs and Debts tabs">'+
    '<button type="button" role="tab" aria-selected="'+(!onDebt)+'" class="su-subtab'+(!onDebt?' on':'')+'" data-su="needstab" data-t="needs">'+I('home',15)+' Needs (Consumption)</button>'+
    '<button type="button" role="tab" aria-selected="'+onDebt+'" class="su-subtab'+(onDebt?' on':'')+'" data-su="needstab" data-t="debts">'+I('card',15)+' Debts Tab (Seats on Needs) <span class="cnt">'+dCount+'</span></button>'+
  '</div>'+
  (onDebt
    ?'<div class="note" style="margin-bottom:6px"><b>Debts sit inside your Needs share.</b> Tap any icon to customize it, or divide any debt (e.g. ₱30,000) into 6 months or 3 months while ongoing. Once paid off, the debt plan is automatically removed!</div>'+
      '<div data-lines="debts">'+suDebtLinesHTML()+'</div>'+
      '<div class="chips su-add"><button type="button" class="chip dash" data-su="add-debt">'+I('plus',14)+' Add Debt Plan</button>'+
        SUGGEST.debts.slice(0,3).map(n=>'<button type="button" class="chip dash" data-su="sug-debt" data-v="'+suEsc(n)+'">+ '+esc(n)+'</button>').join('')+'</div>'
    :suGroupTools('needs')+'<div data-lines="needs">'+suLines('needs')+'</div>'+suAddRow('needs')+suCatSetupBoxHTML('needs'));
}
function suStepBody(s){
  const d=su.d,lab='<div class="su-lbl">'+LABELS[s-1]+'</div>';
  if(s===1){
    return lab+'<h1 class="su-h">'+(su.fresh?'Let’s Set Up Your Budget':'Set Up Your Plan')+'</h1><p class="su-sub">About 3 minutes. You can change anything later.</p>'+
    '<div class="su-ill" aria-hidden="true">'+SU_ILL+'</div>'+
    '<label class="su-q" for="suIncome">How much do you take home each month?</label>'+
    '<div class="su-big" data-box="income"><span class="pre">₱</span><input id="suIncome" data-su-in="income" inputmode="decimal" autocomplete="off" placeholder="0" value="'+suEsc(fmtInput(d.income))+'"><small>after tax</small></div>'+
    '<div class="rowerr" data-err="income"></div>'+
    '<div class="su-hints" data-hints></div>'+
    '<div class="su-q">When do you get paid?</div>'+
    '<div class="chips">'+Object.keys(PAYDAY_LBL).map(function(k){return '<button class="chip'+(d.payday===k?' on':'')+'" data-su="payday" data-v="'+k+'">'+(d.payday===k?I('check',14)+' ':'')+PAYDAY_LBL[k]+'</button>';}).join('')+'</div>'+
    (d.payday==='day'?'<div class="su-inline"><label for="suPayDay">Day of the month</label><input id="suPayDay" class="inp" data-su-in="payDay" inputmode="numeric" maxlength="2" value="'+suEsc(d.payDay)+'"></div>':'')+
    (su.needAcc?'<div class="su-q">Where does your pay go?</div>'+
      '<div class="chips">'+[['bank','Bank'],['ewallet','E-Wallet'],['cash','Cash']].map(function(o){return '<button class="chip'+(d.acc.type===o[0]?' on':'')+'" data-su="acctype" data-v="'+o[0]+'">'+o[1]+'</button>';}).join('')+'</div>'+
      '<div class="fgrid" style="margin-top:10px"><div class="field"><label for="suAccName">Account name</label><input id="suAccName" class="inp" data-su-in="accname" value="'+suEsc(d.acc.name)+'" placeholder="e.g. BPI Payroll"></div>'+
      '<div class="field"><label for="suAccBal">Balance today (optional)</label><input id="suAccBal" class="inp" data-su-in="accbal" inputmode="decimal" value="'+suEsc(d.acc.bal)+'" placeholder="₱0"></div></div>':'')+
    (su.fresh?'<div class="su-alt">Just looking around? <button class="link" data-act="sheet-init" data-mode="demo">Load demo data instead</button></div>':'');
  }
  if(s===2){
    return lab+'<h1 class="su-h">How Do You Want To Split It?</h1>'+
    '<div class="presets">'+PRESETS.map(function(p){const on=+d.split.needs===p[1]&&+d.split.wants===p[2]&&+d.split.savings===p[3];
      return '<button class="pre'+(on?' on':'')+'" data-su="preset" data-v="'+p[1]+','+p[2]+','+p[3]+'">'+(p[0]==='Balanced'?'<span class="pop">Popular</span>':'')+(on?'<span class="ck">'+I('check',11)+'</span>':'')+
        '<b>'+p[0]+'</b><span>'+p[1]+' / '+p[2]+' / '+p[3]+'</span><span class="pmini"><i style="width:'+p[1]+'%;background:var(--ink)"></i><i style="width:'+p[2]+'%;background:var(--g2s)"></i><i style="width:'+p[3]+'%;background:var(--g3s)"></i></span></button>';}).join('')+
      '<button class="pre" data-su="custom"><b>Custom</b><span>Your own mix</span><span class="pmini"><i style="width:34%;background:var(--ink)"></i><i style="width:33%;background:var(--g2s)"></i><i style="width:33%;background:var(--g3s)"></i></span></button></div>'+
    '<div class="su-ringrow"><div data-ring></div><div class="su-legend" data-legend></div></div>'+
    '<div class="banner" data-splitbanner hidden></div>'+
    PLAN_GROUPS.map(function(g){return '<div class="su-bucket" data-bucket="'+g+'"><span class="dot" style="background:'+GCOL[g]+'"></span><div class="nm"><b>'+GROUP_LBL[g]+'</b><span>'+GROUP_DESC[g]+'</span><div class="rowerr" data-err="split-'+g+'"></div></div>'+
      '<div class="su-val"><label class="su-box" data-box="split-'+g+'"><input data-su-in="split" data-g="'+g+'" inputmode="decimal" aria-label="'+GROUP_LBL[g]+' percent" value="'+suEsc(d.split[g])+'"><span class="u">%</span></label><div class="peso" data-sec="split-'+g+'"></div></div></div>';}).join('');
  }
  if(s===3){
    return lab+'<h1 class="su-h">Needs & Debts Plan</h1>'+
      '<div class="su-ghead"><span class="su-sub" data-gsub="needs"></span><span class="grouppill" data-gpill="needs"></span></div>'+
      suNeedsAndDebtsStepHTML()+
      '<div class="banner" data-gbanner="needs" hidden></div>'+
      suTip('<b>Tap any icon (✎)</b> to pick a custom icon for your plan item.');
  }
  if(s>=4&&s<=5){
    const g=PLAN_GROUPS[s-3];
    return lab+'<h1 class="su-h">'+(g==='savings'?'Plan Your Savings Subcategories':'Wants Consumption Tank')+'</h1>'+
      '<div class="su-ghead"><span class="su-sub" data-gsub="'+g+'"></span><span class="grouppill" data-gpill="'+g+'"></span></div>'+
      suGroupTools(g)+'<div data-lines="'+g+'">'+suLines(g)+'</div>'+suAddRow(g)+(g==='wants'?suCatSetupBoxHTML('wants'):'')+
      '<div class="banner" data-gbanner="'+g+'" hidden></div>'+
      (g==='wants'?suTip('<b>Tap the icon (✎)</b> to customize your Wants icon, or keep a single Wants consumption tank.'):suTip('<b>Tap any icon (✎)</b> to choose an icon for each Savings subcategory.'));
  }
  return lab+'<h1 class="su-h">Your Plan & 4 Tanks Are Ready</h1>'+
    '<div class="su-ringrow"><div data-ring="big"></div><div class="su-legend" data-legend="pct"></div></div>'+
    '<div class="su-stats" data-stats></div>'+
    '<div class="su-q">Creating this will:</div><div class="su-checks" data-checks></div>';
}
function suTip(t){return '<div class="tip"><span class="ti">'+I('sparkle',14)+'</span><span>'+t+'</span></div>';}
/* One big switch: types every Needs, Wants and Savings line as % or ₱ at once.
   Skipped: debts (always ₱) and the automatic Needs tank (a lone "Needs" line that fills whatever debts leave). */
function suTankLine(l){if(l.group!=='needs')return false;const n=su.d.lines.filter(x=>x.group==='needs');return n.length===1&&n[0].name==='Needs';}
function suConvertible(l){return l.group!=='debts'&&!suTankLine(l);}
function suUnitSwitch(top){
  const ms=su.d.lines.filter(suConvertible).map(l=>l.mode);
  const all=!ms.length?'pct':ms.every(m=>m==='amt')?'amt':ms.every(m=>m==='pct')?'pct':'mix';
  const note=all==='mix'?'Mixed right now':(su.d.lines.some(suTankLine)?'Debts & Needs tank stay in ₱':'Debts stay in ₱');
  return '<div class="su-tools su-unit'+(all==='mix'?' mix':'')+'"'+(top?' data-top="1"':'')+'><div class="cap"><span>Type every amount as</span><em>'+note+'</em></div>'+
    '<div class="tg" role="group" aria-label="Type every amount as a percent or in pesos">'+
    '<button type="button" class="'+(all==='pct'?'on':'')+'" aria-pressed="'+(all==='pct')+'" data-su="gmode" data-m="pct"><b>% of income</b><small>Grows with your pay</small></button>'+
    '<button type="button" class="'+(all==='amt'?'on':'')+'" aria-pressed="'+(all==='amt')+'" data-su="gmode" data-m="amt"><b>₱ Peso amount</b><small>Stays the same</small></button></div></div>';
}
function suTopSwitch(){return su.d.lines.some(suConvertible)?suUnitSwitch(true):'';}
/* In setup, each step shows the switch only when that step has lines it can change. My Plan shows it once, at the top. */
function suGroupTools(g){if(!su||su.mode==='edit')return '';return su.d.lines.some(l=>l.group===g&&suConvertible(l))?suUnitSwitch():'';}
function suLines(g){return su.d.lines.filter(l=>l.group===g).map(suLineHTML).join('');}
function suLineHTML(l){
  const g=l.group,custom=l.custom;
  const ic=lineIcon(l.name,g,l.icon);
  return '<div class="su-line" data-line="'+l.id+'" style="flex-wrap:wrap">'+
    '<button type="button" class="emo su-icon-btn" data-su="pick-icon" data-id="'+l.id+'" title="Choose icon" aria-label="Choose icon for '+suEsc(l.name||'item')+'">'+I(ic,18)+'</button>'+
    '<div class="mid">'+(custom?'<input class="su-name" data-su-in="name" data-id="'+l.id+'" placeholder="Name" value="'+suEsc(l.name)+'" aria-label="Line name">':'<b>'+esc(l.name)+'</b>')+
      '<div class="sub2" data-desc="'+l.id+'"></div>'+
      '<div class="mt"><i data-bar="'+l.id+'"></i></div>'+
      (g==='savings'?'<div class="su-goal"><label>Target ₱<input data-su-in="target" data-id="'+l.id+'" inputmode="decimal" placeholder="optional" value="'+suEsc(fmtInput(l.target))+'"></label><span data-eta="'+l.id+'"></span></div>':
        '<button class="su-roll'+(l.rollover?' on':'')+'" data-su="roll" data-id="'+l.id+'" aria-pressed="'+!!l.rollover+'">'+(l.rollover?I('check',11)+' ':'')+'Rollover</button>')+
      '<div class="rowerr" data-err="'+l.id+'"></div></div>'+
    '<div class="su-val"><label class="su-box" data-box="'+l.id+'">'+(l.mode==='amt'?'<span class="u">₱</span>':'')+
      '<input data-su-in="line" data-id="'+l.id+'" inputmode="decimal" aria-label="'+suEsc(l.name||'Line')+' amount" value="'+suEsc(l.mode==='amt'?fmtInput(l.raw):l.raw)+'">'+(l.mode==='pct'?'<span class="u">%</span>':'')+'</label>'+
      '<div class="peso" data-sec="'+l.id+'"></div>'+
      '<span class="su-lact"><button type="button" data-su="pick-icon" data-id="'+l.id+'" title="Choose icon">Icon</button><button data-su="unit" data-id="'+l.id+'" title="Switch between % and ₱">'+(l.mode==='pct'?'Use ₱':'Use %')+'</button><button data-su="del" data-id="'+l.id+'" aria-label="Remove '+suEsc(l.name)+'">'+I('x',12)+'</button></span></div>'+
    '<div style="width:100%">'+suIconTrayHTML(l)+'</div>'+
  '</div>';
}
function suAddRow(g){
  const have=su.d.lines.filter(l=>l.group===g).map(l=>l.name.toLowerCase());
  const sug=(SUGGEST[g]||[]).filter(n=>have.indexOf(n.toLowerCase())<0).slice(0,3);
  return '<div class="chips su-add"><button class="chip dash" data-su="add" data-g="'+g+'">'+I('plus',14)+' Add '+(g==='savings'?'Subcategory / Goal':'Subcategory')+'</button>'+
    sug.map(function(n){return '<button class="chip dash" data-su="sug" data-g="'+g+'" data-v="'+suEsc(n)+'">+ '+esc(n)+'</button>';}).join('')+'</div>';
}
function suEditBody(){
  const d=su.d;
  return '<div class="su-big" data-box="income" style="margin-top:4px"><span class="pre">₱</span><input id="suIncome" data-su-in="income" inputmode="decimal" autocomplete="off" aria-label="Monthly income" value="'+suEsc(fmtInput(d.income))+'"><small data-was></small></div>'+
    '<div class="rowerr" data-err="income"></div><div class="su-hints" data-hints></div>'+
    '<div class="applies">'+I('info',15)+'<span>Tap any icon (✎) to pick a custom icon. Saved changes apply <b>right away</b> to '+esc(periodLabel(monthKey(TODAY())))+'.</span></div>'+
    '<div class="su-q">Payday</div><div class="chips">'+Object.keys(PAYDAY_LBL).map(function(k){return '<button class="chip'+(d.payday===k?' on':'')+'" data-su="payday" data-v="'+k+'">'+PAYDAY_LBL[k]+'</button>';}).join('')+'</div>'+
    (d.payday==='day'?'<div class="su-inline"><label for="suPayDay">Day of the month</label><input id="suPayDay" class="inp" data-su-in="payDay" inputmode="numeric" maxlength="2" value="'+suEsc(d.payDay)+'"></div>':'')+
    '<div class="su-q">Split</div><div class="su-ringrow"><div data-ring></div><div class="su-split3">'+PLAN_GROUPS.map(function(g){
      return '<div class="su-s3"><span><i style="background:'+GCOL[g]+'"></i>'+GROUP_LBL[g]+'</span><label class="su-box" data-box="split-'+g+'"><input data-su-in="split" data-g="'+g+'" inputmode="decimal" aria-label="'+GROUP_LBL[g]+' percent" value="'+suEsc(d.split[g])+'"><span class="u">%</span></label><div class="peso" data-sec="split-'+g+'"></div><div class="rowerr" data-err="split-'+g+'"></div></div>';}).join('')+'</div></div>'+
    '<div class="banner" data-splitbanner hidden></div>'+
    '<div data-topswitch>'+suTopSwitch()+'</div>'+
    '<section class="su-gsec"><div class="su-ghead"><h3>Needs & Debts <span data-gpct="needs"></span></h3><span class="grouppill" data-gpill="needs"></span></div>'+
      suNeedsAndDebtsStepHTML()+
      '<div class="banner" data-gbanner="needs" hidden></div>'+
      '<div class="su-fitrow" data-fit="needs" hidden><button class="btn btn-sm" data-su="autofit" data-g="needs">'+I('sparkle',14)+' Auto-Fit Needs</button></div></section>'+
    ['wants','savings'].map(function(g){return '<section class="su-gsec"><div class="su-ghead"><h3>'+GROUP_LBL[g]+' <span data-gpct="'+g+'"></span></h3><span class="grouppill" data-gpill="'+g+'"></span></div>'+
      suGroupTools(g)+'<div data-lines="'+g+'">'+suLines(g)+'</div>'+suAddRow(g)+(g==='wants'?suCatSetupBoxHTML('wants'):'')+'<div class="banner" data-gbanner="'+g+'" hidden></div>'+
      '<div class="su-fitrow" data-fit="'+g+'" hidden><button class="btn btn-sm" data-su="autofit" data-g="'+g+'">'+I('sparkle',14)+' Auto-Fit '+GROUP_LBL[g]+'</button></div></section>';}).join('');
}
function fmtInput(v){const s=String(v==null?'':v).trim();if(!/^\d+(\.\d+)?$/.test(s))return s;const p=s.split('.');return Number(p[0]).toLocaleString('en-PH')+(p[1]?'.'+p[1]:'');}

function setTxt(sel,html){document.querySelectorAll('#suRoot '+sel).forEach(function(e){if(e.innerHTML!==html)e.innerHTML=html;});}
function setBad(key,bad){
  document.querySelectorAll('#suRoot [data-box="'+key+'"]').forEach(function(b){
    if(bad&&!su.bad[key]){b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');}
    b.classList.toggle('bad',!!bad);});
  su.bad[key]=!!bad;
}
function suRefresh(first){
  if(!su)return;
  const d=su.d,c=suCalc(d),inc=c.inc;
  setBad('income',!!c.incErr&&!(first&&!d.income));
  setTxt('[data-err="income"]',c.incErr&&!(first&&!d.income)?I('alert',12)+' '+esc(c.incErr):'');
  setTxt('[data-hints]',inc>0?'<span class="chip sm">'+I('cal',13)+' ≈ '+money0(inc/30)+' a day</span><span class="chip sm">'+I('coins',13)+' '+money0(inc*12)+' a year</span>':'');
  if(su.mode==='edit'&&state.plan&&state.plan.income&&inc!==state.plan.income)setTxt('[data-was]','was '+money0(state.plan.income));else setTxt('[data-was]','');
  PLAN_GROUPS.forEach(function(g){
    const e=c.splitErr[g];setBad('split-'+g,!!e||(c.splitTotal>100&&su.lastSplit===g));
    setTxt('[data-err="split-'+g+'"]',e?I('alert',12)+' '+esc(e):(c.splitTotal>100&&su.lastSplit===g?I('alert',12)+' You just changed this':''));
    countTo('[data-sec="split-'+g+'"]',round2(inc*c.split[g]/100),money0);
  });
  document.querySelectorAll('#suRoot [data-ring]').forEach(function(r){const big=r.dataset.ring==='big';
    r.innerHTML=big?suRing(c,150,money0(inc),'a month'):suRing(c,112);});
  setTxt('[data-legend]',PLAN_GROUPS.map(function(g){return '<div><i style="background:'+GCOL[g]+'"></i>'+GROUP_LBL[g]+(g==='needs'&&c.debts.sum>0?' (incl. '+money0(c.debts.sum)+' debt)':'')+'<span>'+money0(inc*c.split[g]/100)+'</span></div>';}).join('')+
    (c.splitTotal>100?'<div class="err-txt" style="font-weight:700">Total<span class="err-txt">'+money0(inc*c.splitTotal/100)+'</span></div>':''));
  setTxt('[data-legend="pct"]',PLAN_GROUPS.map(function(g){return '<div><i style="background:'+GCOL[g]+'"></i><b>'+GROUP_LBL[g]+'</b><span>'+fmtPct(c.split[g])+'</span></div>';}).join('')+
    (c.debts.sum>0?'<div><i style="background:var(--g1)"></i><b>Debts (in Needs)</b><span>'+money0(c.debts.sum)+'/mo</span></div>':'')+
    '<div class="su-mut">'+(d.payday==='day'?'Paid on day '+esc(d.payDay):'Paid '+PAYDAY_LBL[d.payday].replace('Once, on','on'))+'</div>');
  const sb=document.querySelector('#suRoot [data-splitbanner]');
  if(sb){const over=c.splitTotal>100,under=c.splitTotal<100&&!PLAN_GROUPS.some(g=>c.splitErr[g]);
    sb.hidden=!(over||under)||PLAN_GROUPS.some(g=>c.splitErr[g]);
    if(!sb.hidden){const diff=Math.abs(c.splitTotal-100);
      const fixes=PLAN_GROUPS.map(function(g){const v=Math.round((c.split[g]-(c.splitTotal-100))*10)/10;return v>=0&&v<=100?'<button class="fix" data-su="splitfix" data-g="'+g+'" data-v="'+v+'">'+GROUP_LBL[g]+' → '+fmtPct(v)+'</button>':'';}).join('');
      sb.className='banner'+(over?' bad':' soft');
      sb.innerHTML='<div class="bt">'+I(over?'alert':'info',18)+'<span><b>Your split adds up to '+fmtPct(c.splitTotal)+'.</b> It needs to be exactly 100%. '+(over?'Take '+fmtPct(diff)+' off one part':'Add '+fmtPct(diff)+' to one part')+', or tap a quick fix.</span></div><div class="fixes">'+fixes+'</div>';}}
  d.lines.filter(l=>l.group==='debts').forEach(function(l){
    const L=c.lines[l.id]||{amt:0,pct:0,rem:0,mos:6,err:''};
    const df=debtFreqAmt(L.amt,l.freq);
    setBad('dtot-'+l.id,!!L.err);
    setTxt('[data-err="'+l.id+'"]',L.err?I('alert',12)+' '+esc(L.err):'');
    setTxt('[data-debt-sum="'+l.id+'"]',
      '<span>Remaining: <b>'+money0(L.rem)+'</b> · Installment: <b>'+money(df.amt)+df.lbl+'</b> ('+money0(L.amt)+'/mo, '+fmtPct(L.pct)+' of income)</span>'+
      '<span>'+(L.rem<=0?'<b>Paid off — will be removed ✓</b>':'Debt-free in <b>'+L.mos+' mo'+(L.mos===1?'':'s')+'</b> ('+fmtMonthYear(L.mos)+')')+'</span>');
  });
  PLAN_GROUPS.forEach(function(g){
    const G=c.groups[g];
    d.lines.filter(l=>l.group===g).forEach(function(l){
      const L=c.lines[l.id];if(!L)return;
      const showErr=L.err&&!(L.err.indexOf('Enter an amount')===0&&first);
      const pushes=!L.err&&G.state==='over'&&su.last[g]===l.id;
      setBad(l.id,!!showErr||pushes);
      setTxt('[data-err="'+l.id+'"]',showErr?I('alert',12)+' '+esc(L.err):pushes?I('alert',12)+' Pushes '+GROUP_LBL[g]+' over by '+fmtPct(G.diff/(inc||1)*100):'');
      countTo('[data-sec="'+l.id+'"]',l.mode==='pct'?L.amt:L.pct,l.mode==='pct'?money0:function(v){return fmtPct(v)+' of income';},l.mode==='pct'?null:true);
      const bar=document.querySelector('#suRoot [data-bar="'+l.id+'"]');if(bar){bar.style.width=(G.target>0?Math.min(100,L.amt/G.target*100):0).toFixed(1)+'%';bar.classList.toggle('bad',!!showErr||pushes);}
      const desc=(l.mode==='amt'?'Fixed amount':'')+(L.amt>0&&g!=='savings'&&l.mode==='pct'&&L.amt/30>=50?(l.mode==='amt'?' · ':'')+'≈ '+money0(L.amt/30)+' a day':'');
      setTxt('[data-desc="'+l.id+'"]',esc(LINE_DESC[l.name]?(LINE_DESC[l.name]+(desc?' · '+desc:'')):desc));
      if(g==='savings'){const t=suParse(l.target);const tv=t.bad||t.empty?0:t.v;
        setTxt('[data-eta="'+l.id+'"]',tv>0&&L.amt>0?(function(){const m=Math.ceil(tv/L.amt);return 'Reached '+(m>=24?'in about '+(Math.round(m/6)/2)+' years':m>12?'by '+fmtMonthYear(m):'in '+m+' month'+(m===1?'':'s'));})():L.amt>0?money0(L.amt*12)+' a year':'');}
    });
    const pill=document.querySelectorAll('#suRoot [data-gpill="'+g+'"]');
    pill.forEach(function(p){p.className='grouppill '+(G.state==='ok'?'ok':G.state==='under'?'':'bad');
      p.textContent=G.bad&&G.state==='bad'?'Fix red entries':fmtPct(G.sumPct)+' of '+fmtPct(c.split[g]);});
    setTxt('[data-gsub="'+g+'"]',money0(G.target)+(g==='needs'&&c.debts.sum>0?' total ('+money0(c.debts.sum)+' debt + '+money0(Math.max(0,G.target-c.debts.sum))+' Needs tank)':g==='savings'?' a month · each becomes a savings subcategory':' consumption tank'));
    setTxt('[data-gpct="'+g+'"]','· '+fmtPct(c.split[g])+' · '+money0(G.target));
    const bn=document.querySelector('#suRoot [data-gbanner="'+g+'"]');
    if(bn){const show=G.state==='over'||(G.state==='under'&&su.mode==='edit');bn.hidden=!show;
      if(show){const dp=fmtPct(Math.abs(G.diff)/(inc||1)*100);bn.className='banner'+(G.state==='over'?' bad':' soft');
        bn.innerHTML='<div class="bt">'+I(G.state==='over'?'alert':'info',18)+'<span>'+(G.state==='over'?'<b>'+GROUP_LBL[g]+' (including Debts) adds up to '+fmtPct(G.sumPct)+',</b> which is '+money0(G.diff)+' over '+fmtPct(c.split[g])+'. Tap Auto-Fit or increase payoff months.':
          '<b>'+money0(-G.diff)+' of '+GROUP_LBL[g]+' has no job yet.</b> Tap Auto-Fit to put it in your '+GROUP_LBL[g]+' tank.')+'</span></div>';}}
    const fr=document.querySelector('#suRoot [data-fit="'+g+'"]');if(fr)fr.hidden=!(G.state==='over'||G.state==='under');
  });
  if(su.mode==='setup'&&su.step===6){
    const nd=d.lines.filter(l=>l.group==='debts').length;
    const ng=d.lines.filter(l=>l.group==='savings').length;
    const spendDay=Math.max(0,inc-c.groups.savings.target-c.debts.sum)/30;
    setTxt('[data-stats]','<div><span>4 Tanks</span><b>Needs · Wants · Debts · Savings</b></div><div><span>Active Debts</span><b>'+nd+(nd?' ('+money0(c.debts.remTotal)+')':' (Debt-Free 🎉)')+'</b></div><div><span>Net After Debt</span><b>'+money0(Math.max(0,inc-c.debts.sum))+'/mo</b></div>');
    const ck=function(t){return '<div class="chk"><span class="c">'+I('check',13)+'</span><span>'+t+'</span></div>';};
    setTxt('[data-checks]',
      ck('Activate your <b>4 interactive tanks</b>: Needs ('+money0(Math.max(0,c.groups.needs.target-c.debts.sum))+'), Wants ('+money0(c.groups.wants.target)+'), Debts ('+money0(c.debts.remTotal)+' full tank), and Savings ('+money0(c.groups.savings.target)+'/mo)')+
      ck(nd?'Schedule <b>'+nd+' debt payoff plan'+(nd===1?'':'s')+'</b> ('+money0(c.debts.sum)+'/mo seated in Needs) that <b>automatically remove</b> and celebrate when paid off':'Celebrate your <b>100% Debt-Free</b> status on the Debt-Free chart')+
      ck('Keep <b>'+ng+' savings subcategor'+(ng===1?'y':'ies')+'</b> with custom icons where you can add (+) or subtract (−) money anytime')+
      ck('Show your live <b>Debt-Free Chart</b> and <b>Effect of Debt on Net Income</b> widget ('+money0(spendDay)+'/day after debt & savings)'));
  }
  suFooter(c);
  suLinkErrors();
}
function fmtMonthYear(m){const d=parseISO(TODAY());const x=new Date(d.getFullYear(),d.getMonth()+m,1);return MONS[x.getMonth()]+' '+x.getFullYear();}
function countTo(sel,to,fmt){
  document.querySelectorAll('#suRoot '+sel).forEach(function(el){
    const from=el.dataset.v===undefined?null:parseFloat(el.dataset.v);el.dataset.v=String(to);
    if(from===null||from===to||!isFinite(from)||reduceMotion()){el.textContent=fmt(to);return;}
    const t0=performance.now(),dur=260;cancelAnimationFrame(el._raf);
    const step=function(now){const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=fmt(from+(to-from)*e);if(k<1)el._raf=requestAnimationFrame(step);};
    el._raf=requestAnimationFrame(step);});
}
function reduceMotion(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}}
function suLinkErrors(){
  document.querySelectorAll('#suRoot .rowerr[data-err]').forEach(function(el){
    const k=el.getAttribute('data-err'),id='suerr-'+k.replace(/[^\w-]/g,'');el.id=id;el.setAttribute('aria-live','polite');
    const inp=k==='income'?document.getElementById('suIncome'):k.indexOf('split-')===0?document.querySelector('#suRoot [data-su-in="split"][data-g="'+k.slice(6)+'"]'):document.querySelector('#suRoot [data-su-in="line"][data-id="'+k+'"]');
    if(!inp)return;inp.setAttribute('aria-describedby',id);
    if(el.textContent.trim())inp.setAttribute('aria-invalid','true');else inp.removeAttribute('aria-invalid');});
}
function suFooter(c){
  const f=document.getElementById('suFt');if(!f)return;
  let left='',right='',pct=100,bad=false,btn='',extra='';
  const ok=function(t){return '<span class="ok">'+I('check',15)+' '+t+'</span>';};
  const badT=function(t){bad=true;return '<span class="bad">'+I('alert',15)+' '+t+'</span>';};
  if(su.mode==='edit'){
    const valid=suStepValid(c,6);
    const overG=PLAN_GROUPS.find(g=>c.groups[g].state==='over');
    if(c.errCount)left=badT(c.errCount+' entr'+(c.errCount===1?'y':'ies')+' to fix');
    else if(!c.splitOk)left=badT('Split adds up to '+fmtPct(c.splitTotal));
    else if(overG)left=badT(GROUP_LBL[overG]+' over by '+money0(c.groups[overG].diff));
    else if(!valid){const u=PLAN_GROUPS.find(g=>c.groups[g].state==='under');left='<span>'+money0(-c.groups[u].diff)+' of '+GROUP_LBL[u]+' has no job yet</span>';pct=90;}
    else left=ok('Every peso has a job');
    right=valid?money0(c.inc)+' of '+money0(c.inc):'Nothing saved yet';
    btn='<button class="btn btn-primary su-next" data-su="save"'+(valid?'':' disabled')+'>Save Changes</button>';
  }else{
    const s=su.step,valid=suStepValid(c,s);
    if(s===1){left='Budget month';right=su.d.payday==='15-30'?'Runs 15th → 14th':su.d.payday==='day'?'Runs day '+esc(su.d.payDay)+' to day before':'Runs 1st → end of month';
      if(c.incErr&&su.d.income)left=badT('Check your income');}
    else if(s===2){const over=c.splitTotal-100;
      if(PLAN_GROUPS.some(g=>c.splitErr[g]))left=badT('Fix the red entries');
      else if(over>0.0001)left=badT('Over by '+fmtPct(over)+' ('+money0(c.inc*over/100)+')');
      else if(over<-0.0001){left='<span>'+fmtPct(-over)+' left to plan</span>';pct=c.splitTotal;}
      else left=ok('100% planned');
      right=money0(c.inc*c.splitTotal/100)+' of '+money0(c.inc);}
    else if(s<=5){const g=PLAN_GROUPS[s-3],G=c.groups[g];
      if(G.state==='bad')left=badT('Fix the red entries');
      else if(G.state==='over')left=badT('Over by '+fmtPct(G.diff/(c.inc||1)*100)+' ('+money0(G.diff)+')');
      else if(G.state==='under'){left='<span>'+money0(-G.diff)+' left to give a job</span>';pct=G.target>0?G.sum/G.target*100:0;}
      else left=ok(GROUP_LBL[g]+(g==='needs'&&c.debts.sum>0?' + Debts':'')+' fully planned');
      right=money0(G.sum)+' of '+money0(G.target);
      if(G.state==='over'||G.state==='under')extra='<button class="btn su-ghost" data-su="autofit" data-g="'+g+'">'+I('sparkle',16)+' Auto-Fit</button>';}
    else{left=valid?'All '+money0(c.inc)+' has a job':badT('Go back and fix the red entries');right=valid?'100%':'';}
    btn='<button class="btn btn-primary su-next" data-su="'+(s===6?'create':'next')+'"'+(valid?'':' disabled')+'>'+(s===6?I('check',18)+' Create My Budget':'Next')+'</button>';
  }
  f.innerHTML='<div class="alloc"><span>'+left+'</span><span>'+right+'</span></div>'+
    '<div class="meter'+(bad?' bad':'')+'"><i style="width:'+Math.max(0,Math.min(100,pct)).toFixed(1)+'%"></i>'+(bad?'<em></em>':'')+'</div>'+
    '<div class="btns">'+extra+btn+'</div>';
}

function suLine(id){return su.d.lines.find(l=>l.id===id);}
function suRescale(g,newPct){
  if(g==='needs'){suBalanceNeedsTank(su.d);return;}
  const ls=su.d.lines.filter(l=>l.group===g&&l.mode==='pct');const sum=ls.reduce((s,l)=>s+(suParse(l.raw).v||0),0);
  if(!ls.length||!(sum>0))return;
  const fixed=su.d.lines.filter(l=>l.group===g&&l.mode==='amt').reduce((s,l)=>s+(suParse(l.raw).v||0),0);
  const inc=suCalc(su.d).inc;const room=newPct-(inc>0?fixed/inc*100:0);if(room<0)return;
  let acc=0;ls.forEach(function(l,i){let v=Math.round((suParse(l.raw).v||0)/sum*room*10)/10;if(i===ls.length-1)v=Math.round((room-acc)*10)/10;acc+=v;l.raw=String(v);});
  ls.forEach(function(l){const i=document.querySelector('#suRoot [data-su-in="line"][data-id="'+l.id+'"]');if(i)i.value=l.raw;});
}
function suAutoFit(g,quiet){
  const c=suCalc(su.d),inc=c.inc,target=c.groups[g].target;
  const debtSum=g==='needs'?c.debts.sum:0;
  let ls=su.d.lines.filter(l=>l.group===g);
  if(!ls.length){
    const defName=g==='needs'?'Needs':g==='wants'?'Wants':'Emergency Fund';
    ls=[{id:uid('PLN'),group:g,name:defName,mode:'amt',raw:String(Math.max(0,round2(target-debtSum))),rollover:false,target:'',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:g==='needs'?'home':g==='wants'?'bag':'shield',custom:false}];
    su.d.lines.push(ls[0]);
  }
  if(g==='needs'&&ls.length===1){
    const rem=Math.max(0,round2(target-debtSum));
    ls[0].mode='amt';ls[0].raw=String(rem);
    const box=document.querySelector('#suRoot [data-lines="needs"]');if(box)box.innerHTML=suLines('needs');
    if(!quiet){suRefresh();toast('Needs consumption tank fitted around your Debts ('+money0(rem)+').','ok');}
    return;
  }
  const fixed=ls.filter(l=>l.mode==='amt').reduce((s,l)=>s+(suParse(l.raw).v||0),0)+debtSum;
  const pl=ls.filter(l=>l.mode==='pct');
  if(!pl.length&&ls.length){
    const lastL=ls[ls.length-1];
    const others=ls.slice(0,-1).reduce((s,l)=>s+(suParse(l.raw).v||0),0)+debtSum;
    if(others<=target){
      lastL.raw=String(Math.max(0,round2(target-others)));
      const box=document.querySelector('#suRoot [data-lines="'+g+'"]');if(box)box.innerHTML=suLines(g);
      if(!quiet){suRefresh();toast(GROUP_LBL[g]+' now fits exactly.','ok');}
      return;
    }
  }
  if(fixed>target+0.5){if(quiet)return;toast('Your fixed ₱ amounts (and debts) exceed '+GROUP_LBL[g]+'. Increase debt payoff months or lower a fixed amount.','err');return;}
  if(!pl.length){if(quiet)return;toast('Every line is a fixed ₱ amount. Change one to fit, or switch it to %.','err');return;}
  const roomPct=(target-fixed)/(inc||1)*100;const sum=pl.reduce((s,l)=>s+(suParse(l.raw).v||0),0);
  let acc=0;pl.forEach(function(l,i){const base=sum>0?(suParse(l.raw).v||0)/sum:1/pl.length;let v=Math.round(base*roomPct*10)/10;if(i===pl.length-1)v=Math.round((roomPct-acc)*100)/100;acc+=v;l.raw=String(v);});
  if(!quiet){su.touched[g]=true;delete su.auto[g];}su.last[g]=null;
  const box=document.querySelector('#suRoot [data-lines="'+g+'"]');if(box)box.innerHTML=suLines(g);
  if(quiet)return;suRefresh();toast(GROUP_LBL[g]+' now fits exactly.','ok');
}
function suConvert(l,to){
  const inc=suCalc(su.d).inc;const r=suParse(l.raw);if(l.mode===to)return;
  if(!r.bad&&!r.empty&&inc>0){
    if(to==='amt')l.raw=String(Math.round(inc*r.v/100));
    else{   // ₱ -> %: keep as many decimals as needed (up to 4) so the peso amount doesn't move, e.g. ₱25,000 of ₱60,000 = 41.6667%
      const exact=r.v/inc*100;let p=exact;
      for(let k=1;k<=4;k++){const f=Math.pow(10,k);p=Math.round(exact*f)/f;if(Math.abs(inc*p/100-r.v)<0.05)break;}
      l.raw=String(p);
    }
  }
  l.mode=to;
}
function suRedrawLines(g){
  if(g==='debts'){const box=document.querySelector('#suRoot [data-lines="debts"]');if(box)box.innerHTML=suDebtLinesHTML();return;}
  const box=document.querySelector('#suRoot [data-lines="'+g+'"]');if(box)box.innerHTML=suLines(g);
  if(box){const prev=box.previousElementSibling,want=suGroupTools(g);   // show / refresh / hide this step's switch
    if(prev&&prev.classList.contains('su-tools')){if(want)prev.outerHTML=want;else prev.remove();}
    else if(want)box.insertAdjacentHTML('beforebegin',want);}
  document.querySelectorAll('#suRoot [data-topswitch]').forEach(function(t){t.innerHTML=suTopSwitch();});
  const add=box&&box.nextElementSibling;if(add&&add.classList.contains('su-add'))add.outerHTML=suAddRow(g);
}

document.addEventListener('click',function(e){
  const b=e.target.closest&&e.target.closest('#suRoot [data-su]');if(!b||!su)return;
  e.preventDefault();
  const a=b.dataset.su,d=su.d;
  switch(a){
    case 'close':closeSetup();break;
    case 'back':su.dir='back';su.step=Math.max(1,su.step-1);suDraw();break;
    case 'next':{const c=suCalc(d);if(!suStepValid(c,su.step)){suRefresh();return;}su.dir='fwd';su.step++;suDraw();break;}
    case 'skip':{const fr=su.fresh;closeSetup();if(fr&&typeof Sync!=='undefined'&&Sync.url&&!Sync.snap)initSheet('empty');break;}
    case 'theme':state.settings.theme=b.dataset.v;applyTheme();saveState();
      document.querySelectorAll('#suRoot .tsw').forEach(function(t){t.outerHTML=suThemeSwitch();});break;
    case 'needstab':su.needsTab=b.dataset.t;su.iconPickId=null;su.dir='';suDraw();break;
    case 'pick-icon':{
      const id=b.dataset.id;
      su.iconPickId=(su.iconPickId===id?null:id);
      const l=suLine(id);
      if(l){suRedrawLines(l.group);suRefresh();}
      break;}
    case 'set-icon':{
      const l=suLine(b.dataset.id),ic=b.dataset.ic;
      if(l&&ICONS[ic]){
        l.icon=ic;
        state.settings.catIcons=state.settings.catIcons||{};
        if(l.name)state.settings.catIcons[l.name]=ic;
        saveLocal();
        su.iconPickId=null;
        suRedrawLines(l.group);
        suRefresh();
      }
      break;}
    case 'add-debt':case 'sug-debt':{
      const nm=a==='sug-debt'?b.dataset.v:'Personal Debt';
      const l={id:uid('PLN'),group:'debts',name:nm,mode:'amt',raw:'5000',rollover:false,target:'30000',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:'card',custom:a==='add-debt'};
      d.lines.push(l);suBalanceNeedsTank(d);su.dir='';suDraw();break;}
    case 'debt-mos':{
      const l=suLine(b.dataset.id);
      if(l){l.months=String(b.dataset.m);suBalanceNeedsTank(d);suRedrawLines('debts');suRefresh();}break;}
    case 'addcat':{
      const g=b.dataset.g,inp=document.getElementById('suQuickCat_'+g);
      const nm=(inp&&inp.value||'').trim();
      if(!nm){toast('Type a category name first.','err');break;}
      if(!state.settings.expenseCats.some(c=>c.name.toLowerCase()===nm.toLowerCase())){
        state.settings.expenseCats.push({name:nm,essential:g==='needs'});ensureCatIds(state);saveLocal();
      }
      su.showCatSetup=true;su.dir='';suDraw();toast('Added category "'+nm+'".','ok');break;}
    case 'tankonly':{
      const g=b.dataset.g,c=suCalc(d);
      const rem=g==='needs'?Math.max(0,round2(c.groups.needs.target-c.debts.sum)):c.groups[g].target;
      d.lines=d.lines.filter(l=>l.group!==g);
      d.lines.push({id:uid('PLN'),group:g,name:GROUP_LBL[g],mode:'amt',raw:String(rem),rollover:false,target:'',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:g==='needs'?'home':'bag',custom:false});
      su.dir='';suDraw();toast('Set '+GROUP_LBL[g]+' to a single consumption tank.','ok');break;}
    case 'payday':d.payday=b.dataset.v;suDraw();break;
    case 'acctype':d.acc.type=b.dataset.v;if(['My Bank','My E-Wallet','Cash Wallet'].indexOf(d.acc.name)>=0||!d.acc.name)d.acc.name=({bank:'My Bank',ewallet:'My E-Wallet',cash:'Cash Wallet'})[d.acc.type];suDraw();break;
    case 'preset':case 'custom':{
      if(a==='preset'){const v=b.dataset.v.split(',');PLAN_GROUPS.forEach(function(g,i){d.split[g]=v[i];if(!su.touched[g])suRescale(g,+v[i]);});}
      su.lastSplit=null;const keep=su.dir;su.dir='';suDraw();su.dir=keep;
      if(a==='custom'){const i=document.querySelector('#suRoot [data-su-in="split"]');if(i){i.focus();i.select();}}break;}
    case 'splitfix':{d.split[b.dataset.g]=b.dataset.v;su.lastSplit=null;if(!su.touched[b.dataset.g])suRescale(b.dataset.g,+b.dataset.v);
      const i=document.querySelector('#suRoot [data-su-in="split"][data-g="'+b.dataset.g+'"]');if(i)i.value=b.dataset.v;suRefresh();break;}
    case 'gmode':{su.auto={};d.lines.filter(suConvertible).forEach(function(l){suConvert(l,b.dataset.m);});PLAN_GROUPS.forEach(function(g){suRedrawLines(g);});suRefresh();break;}
    case 'unit':{const l=suLine(b.dataset.id);if(l){delete su.auto[l.group];suConvert(l,l.mode==='pct'?'amt':'pct');suRedrawLines(l.group);suRefresh();}break;}
    case 'del':{const l=suLine(b.dataset.id);if(!l)break;const grp=l.group;
      d.lines=d.lines.filter(x=>x!==l);
      if(grp==='debts')suBalanceNeedsTank(d);
      su.touched[grp]=true;delete su.auto[grp];
      suRedrawLines(grp);suRefresh();break;}
    case 'add':case 'sug':{const g=b.dataset.g;const nm=a==='sug'?b.dataset.v:'';const l={id:uid('PLN'),group:g,name:nm,mode:'pct',raw:'0',rollover:false,target:'',targetDate:'',paid:'0',months:'6',freq:'monthly',icon:lineIcon(nm,g),custom:a==='add'};
      d.lines.push(l);su.touched[g]=true;delete su.auto[g];su.last[g]=l.id;su.iconPickId=(a==='add'?l.id:null);suRedrawLines(g);suRefresh();
      const row=document.querySelector('#suRoot [data-line="'+l.id+'"]');if(row){row.classList.add('su-enter');
        const inp=row.querySelector(a==='add'?'.su-name':'[data-su-in="line"]');if(inp){inp.focus();if(inp.select)inp.select();}}break;}
    case 'roll':{const l=suLine(b.dataset.id);if(l){l.rollover=!l.rollover;b.classList.toggle('on',l.rollover);b.setAttribute('aria-pressed',l.rollover);b.innerHTML=(l.rollover?I('check',11)+' ':'')+'Rollover';}break;}
    case 'autofit':suAutoFit(b.dataset.g);break;
    case 'create':case 'save':{const c=suCalc(d);if(!suStepValid(c,6)){suRefresh();return;}
      b.innerHTML=I('check',20);b.classList.add('su-done');
      setTimeout(function(){applyPlan(d,{fresh:su&&su.fresh,edit:a==='save'});},reduceMotion()?0:260);break;}
  }
});
document.addEventListener('input',function(e){
  const t=e.target;if(!su||!t.closest||!t.closest('#suRoot'))return;
  const f=t.dataset.suIn;if(!f)return;const d=su.d;
  if(f==='income'){
    d.income=t.value;suBalanceNeedsTank(d);const after=suCalc(d);
    if(after.inc>0)PLAN_GROUPS.forEach(function(g){
      if(su.auto[g]&&su.d.lines.some(l=>l.group===g&&l.mode==='amt'))suAutoFit(g,true);});
  }
  else if(f==='payDay')d.payDay=t.value.replace(/\D/g,'');
  else if(f==='accname')d.acc.name=t.value;
  else if(f==='accbal')d.acc.bal=t.value;
  else if(f==='split'){const g=t.dataset.g;d.split[g]=t.value;su.lastSplit=g;const r=suParse(t.value);if(!r.bad&&!r.empty&&!su.touched[g])suRescale(g,r.v);}
  else if(f==='line'){const l=suLine(t.dataset.id);if(l){l.raw=t.value;su.touched[l.group]=true;delete su.auto[l.group];su.last[l.group]=l.id;}}
  else if(f==='name'){const l=suLine(t.dataset.id);if(l){l.name=t.value;if(l.icon&&l.name.trim()){state.settings.catIcons=state.settings.catIcons||{};state.settings.catIcons[l.name.trim()]=l.icon;}}}
  else if(f==='target'){const l=suLine(t.dataset.id);if(l)l.target=t.value;}
  else if(f==='debt-target'){const l=suLine(t.dataset.id);if(l){l.target=t.value;suBalanceNeedsTank(d);}}
  else if(f==='debt-months'){const l=suLine(t.dataset.id);if(l){l.months=t.value.replace(/\D/g,'');suBalanceNeedsTank(d);}}
  else if(f==='debt-paid'){const l=suLine(t.dataset.id);if(l){l.paid=t.value;suBalanceNeedsTank(d);}}
  else if(f==='debt-freq'){const l=suLine(t.dataset.id);if(l){l.freq=t.value;}}
  suRefresh();
});
document.addEventListener('change',function(e){
  const t=e.target;if(!su||!t.closest||!t.closest('#suRoot'))return;
  if(t.dataset.suIn==='income'||t.dataset.suIn==='accbal'||t.dataset.suIn==='target'||t.dataset.suIn==='debt-target'||t.dataset.suIn==='debt-paid'){const r=suParse(t.value);if(!r.bad&&!r.empty)t.value=fmtInput(String(r.v));}
  else if(t.dataset.suIn==='debt-freq'){const l=suLine(t.dataset.id);if(l){l.freq=t.value;suRefresh();}}
  else if(t.dataset.suIn==='line'){const l=suLine(t.dataset.id);if(l&&l.mode==='amt'){const r=suParse(t.value);if(!r.bad&&!r.empty)t.value=fmtInput(String(r.v));}}
});
document.addEventListener('keydown',function(e){
  if(!suOpen())return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(su.mode==='setup'&&su.step>1){su.dir='back';su.step--;suDraw();}else closeSetup();}
  else if(e.key==='Enter'&&e.target&&e.target.tagName==='INPUT'){const n=document.querySelector('#suRoot .su-next');if(n&&!n.disabled){e.preventDefault();n.click();}}
},true);

/* ---------- apply the plan to the app ---------- */
function applyPlan(d,opts){
  opts=opts||{};
  const num=function(x){const r=suParse(x);return r.bad||r.empty?0:r.v;};
  const oldNames=((state.plan&&state.plan.lines)||[]).filter(l=>l.group!=='savings').map(l=>l.name);
  state.settings.catIcons=state.settings.catIcons||{};
  d.lines.forEach(l=>{const nm=String(l.name||'').trim();if(nm&&l.icon&&ICONS[l.icon])state.settings.catIcons[nm]=l.icon;});
  state.plan=normPlan({income:num(d.income),payday:d.payday,payDay:num(d.payDay)||1,split:{needs:num(d.split.needs),wants:num(d.split.wants),savings:num(d.split.savings)},
    lines:d.lines.map(l=>({id:l.id,group:l.group,name:String(l.name).trim(),mode:l.group==='debts'?'amt':l.mode,pct:l.mode==='pct'&&l.group!=='debts'?num(l.raw):null,amount:l.mode==='amt'||l.group==='debts'?num(l.raw):null,
      rollover:l.rollover,target:num(l.target),targetDate:l.targetDate,paid:num(l.paid),months:Math.max(1,Math.round(num(l.months))||6),freq:l.freq||'monthly',icon:l.icon||''}))});
  prunePaidDebts();
  const p=state.plan;
  if(!state.accounts.length&&String(d.acc.name).trim())
    state.accounts.push({id:uid('ACC'),name:String(d.acc.name).trim(),type:d.acc.type,openingBalance:num(d.acc.bal),openingDate:TODAY(),notes:'',archived:false,apr:null,minPayment:0,dueDay:null,plannedPayment:0});
  state.settings.monthStartDay=p.payday==='15-30'?15:p.payday==='day'?clamp(p.payDay,1,28):1;
  p.lines.filter(l=>l.group!=='savings').forEach(function(l){
    const c=state.settings.expenseCats.find(x=>x.name.toLowerCase()===l.name.toLowerCase());
    if(c){c.essential=l.group==='needs';l.name=c.name;}else state.settings.expenseCats.push({name:l.name,essential:l.group==='needs'});});
  ensureCatIds(state);
  if(state.settings.incomeCats.indexOf('Salary')<0)state.settings.incomeCats.unshift('Salary');
  p.lines.filter(l=>l.group==='savings').forEach(function(l){
    const amt=lineAmt(l,p.income),g=state.goals.find(x=>x.name.toLowerCase()===l.name.toLowerCase());
    if(g){g.monthlyContribution=amt;if(l.target)g.target=l.target;if(l.targetDate)g.targetDate=l.targetDate;}
    else state.goals.push({id:uid('GOL'),name:l.name,target:l.target||0,saved:0,targetDate:l.targetDate||null,monthlyContribution:amt});});
  const newNames=p.lines.filter(l=>l.group!=='savings').map(l=>l.name);
  syncPlanBudgets(monthKey(TODAY()),oldNames.filter(n=>newNames.indexOf(n)<0));
  syncPayBills();
  if(opts.fresh)state.isDemo=false;
  ui.month=monthKey(TODAY());
  closeSetup();
  if(opts.fresh&&typeof Sync!=='undefined'&&Sync.url&&!Sync.snap){initSheet('plan');}
  else refresh();
  nav('dashboard');
  document.body.classList.remove('just-built');void document.body.offsetWidth;document.body.classList.add('just-built');
  setTimeout(function(){document.body.classList.remove('just-built');},1400);
  if(!opts.fresh)toast(opts.edit?'Plan saved. This month’s budgets are updated.':'Your plan is set up. Budgets and goals are ready.','ok');
}
/* Budgets for one budget month, from the plan. Lines removed from the plan lose their budget. */
function syncPlanBudgets(k,removed){
  const p=state.plan;if(!p||!p.income)return 0;let n=0;
  p.lines.filter(l=>l.group!=='savings').forEach(function(l){
    const amt=lineAmt(l,p.income);const b=state.budgets.find(x=>x.month===k&&x.scope==='monthly'&&x.category===l.name);
    if(b){if(b.amount!==amt||!!b.rollover!==!!l.rollover){b.amount=amt;b.rollover=!!l.rollover;n++;}}
    else{state.budgets.push({id:uid('BUD'),month:k,category:l.name,amount:amt,scope:'monthly',rollover:!!l.rollover});n++;}});
  (removed||[]).forEach(function(name){const before=state.budgets.length;
    state.budgets=state.budgets.filter(x=>!(x.month===k&&x.scope==='monthly'&&x.category===name));n+=before-state.budgets.length;});
  return n;
}
/* A new payday month with no budgets yet gets them from the plan. */
function ensurePlanBudgets(){
  if(!hasPlan())return false;const k=monthKey(TODAY());
  if(state.budgets.some(b=>b.month===k&&b.scope==='monthly'&&b.category!=='__total__'))return false;
  return syncPlanBudgets(k,[])>0;
}
function syncPayBills(){
  const p=state.plan;
  state.recurring=state.recurring.filter(r=>String(r.description).slice(-PLAN_MARK.length)!==PLAN_MARK);
  if(!p.income)return;
  if(state.recurring.some(r=>r.type==='income'&&r.status==='active'))return;   // you already track your own pay
  const acc=state.accounts.find(a=>!a.archived&&(a.type==='bank'||a.type==='ewallet'))||state.accounts.find(a=>!a.archived&&ASSETS.includes(a.type));
  if(!acc)return;
  const today=TODAY(),t=parseISO(today);
  const nextOn=function(day){let d=new Date(t.getFullYear(),t.getMonth(),Math.min(day,new Date(t.getFullYear(),t.getMonth()+1,0).getDate()));
    if(isoDate(d)<today){const n=new Date(t.getFullYear(),t.getMonth()+1,1);d=new Date(n.getFullYear(),n.getMonth(),Math.min(day,new Date(n.getFullYear(),n.getMonth()+1,0).getDate()));}return isoDate(d);};
  const mk=function(desc,amt,freq,start){return{id:uid('BIL'),description:desc+PLAN_MARK,type:'income',amount:round2(amt),category:'Salary',account:acc.id,startDate:start,endDate:null,freq:freq,nextDue:start,status:'active'};};
  if(p.payday==='15-30'){state.recurring.push(mk('Pay, 15th',p.income/2,'monthly',nextOn(15)),mk('Pay, 30th',p.income/2,'monthly',nextOn(30)));}
  else if(p.payday==='biweekly')state.recurring.push(mk('Pay',p.income*12/26,'biweekly',today));
  else state.recurring.push(mk('Pay',p.income,'monthly',nextOn(p.payday==='day'?p.payDay:1)));
}

/* ---------- Home & Budgets pieces ---------- */
function planActuals(k){
  const sm=spendFor(k),out={needs:0,wants:0,savings:0};
  for(const c in sm)out[planGroupOf(c)==='needs'?'needs':'wants']+=sm[c];
  const sav=state.accounts.filter(a=>a.type==='savings').map(a=>a.id);
  for(const t of monthTxns(k))if((t.type==='transfer')&&sav.indexOf(t.toAccount)>=0&&sav.indexOf(t.fromAccount)<0)out.savings+=t.amount;
  PLAN_GROUPS.forEach(g=>{out[g]=round2(out[g]);});
  return out;
}
function planCardHTML(k){
  const p=state.plan,isCur=k===monthKey(TODAY()),pace=isCur?dayOfPeriod(TODAY())/dim(k):1,a=planActuals(k);
  const rows=PLAN_GROUPS.map(function(g){
    const plan=groupAmt(p,g),spent=a[g],w=plan>0?Math.min(100,spent/plan*100):0,exp=plan*pace;
    let st;
    if(g==='savings')st=spent>=plan&&plan>0?'Done for this month':money0(Math.max(0,plan-spent))+' to go';
    else if(spent>plan)st='<b class="err-txt">Over by '+money0(spent-plan)+'</b>';
    else if(isCur&&spent>exp+Math.max(200,plan*0.05))st='<b>Ahead of pace</b> · '+money0(spent-exp)+' more than expected';
    else st='On track';
    return '<div class="pg"><div class="pg-t"><b>'+GROUP_LBL[g]+'</b><span><span class="num">'+money0(spent)+'</span> <span class="mut">of '+money0(plan)+'</span></span></div>'+
      '<div class="pg-bar"><i style="width:'+w.toFixed(1)+'%;background:'+(spent>plan&&g!=='savings'?'var(--err)':GCOL[g])+'"></i>'+(isCur?'<u style="left:'+(pace*100).toFixed(1)+'%"></u>':'')+'</div>'+
      '<div class="pg-s"><span>'+st+'</span><span>'+Math.round(plan>0?spent/plan*100:0)+'% '+(g==='savings'?'saved':'used')+'</span></div></div>';}).join('');
  return '<section class="plan-card"><div class="pc-head"><span>Your '+[p.split.needs,p.split.wants,p.split.savings].map(v=>Math.round(v*10)/10).join(' / ')+'</span>'+
    (isCur?'<span>Day '+dayOfPeriod(TODAY())+' of '+dim(k)+'</span>':'<span>'+esc(periodLabel(k))+'</span>')+'</div>'+
    '<div class="pc-stack">'+PLAN_GROUPS.map(g=>'<i style="width:'+p.split[g]+'%;background:'+GCOL[g]+'"></i>').join('')+'</div>'+rows+
    (isCur?'<div class="pc-key"><span></span>Where you should be today</div>':'')+
    '<div class="pc-tiles"><div>Needs left<b>'+money0(Math.max(0,groupAmt(p,'needs')-a.needs))+'</b></div><div>Wants left<b>'+money0(Math.max(0,groupAmt(p,'wants')-a.wants))+'</b></div><div>To save<b>'+money0(Math.max(0,groupAmt(p,'savings')-a.savings))+'</b></div></div></section>';
}
function planInviteHTML(){
  if(hasPlan()||!state.accounts.length||state.dismissed.indexOf('plan-invite')>=0)return '';
  return '<section class="plan-invite"><div class="pi-ill" aria-hidden="true">'+SU_ILL_SMALL+'</div><div class="pi-t"><b>Give Every Peso A Job</b><span>Set a 50/30/20 plan in about 3 minutes. Budgets and goals fill in for you.</span>'+
    '<div class="pi-b"><button class="btn btn-primary btn-sm" data-act="plan-setup">Set Up My Plan</button><button class="btn btn-ghost btn-sm" data-act="ins-dismiss" data-key="plan-invite">Not Now</button></div></div></section>';
}
function planBudgetsHTML(k){
  if(!hasPlan())return '<div class="panel" style="margin-bottom:16px"><div class="panel-body plan-cta"><div><b>Plan your budget in 3 minutes</b><span>Pick a split like 50 / 30 / 20 and break it into categories. Budgets and goals fill in for you.</span></div><button class="btn btn-primary" data-act="plan-setup">'+I('sparkle',15)+' Set Up My Plan</button></div></div>';
  const p=state.plan,bs=budgetsFor(k).filter(b=>b.scope==='monthly'&&b.category!=='__total__'),sm=spendFor(k);
  const line=function(name){return p.lines.find(l=>l.name===name&&l.group!=='savings');};
  const row=function(b){const spent=sm[b.category]||0,l=line(b.category),w=b.amount>0?Math.min(100,spent/b.amount*100):0;
    return '<button class="pb-row" data-act="drill" data-cat="'+esc(b.category)+'" data-from="'+monthStart(k)+'" data-to="'+monthEnd(k)+'"><span class="emo">'+I(catIconName(b.category,'expense'),17)+'</span>'+
      '<span class="pb-mid"><span class="pb-n">'+esc(b.category)+(l&&l.mode==='amt'?' <span class="tag">Fixed</span>':'')+(b.rollover?' <span class="tag">Rollover</span>':'')+'</span>'+
      '<span class="pb-bar"><i style="width:'+w.toFixed(1)+'%'+(spent>b.amount?';background:var(--err)':'')+'"></i></span></span>'+
      '<span class="pb-r"><b class="'+(spent>b.amount?'err-txt':'')+'">'+money0(spent)+'</b><span>of '+money0(b.amount)+(b.carry?' · '+(b.carry>0?'+':'−')+money0(Math.abs(b.carry))+' rolled':'')+'</span></span></button>';};
  const a=planActuals(k);
  const sec=function(g){
    const list=g==='savings'?null:bs.filter(b=>planGroupOf(b.category)===g);
    const body=g==='savings'?p.lines.filter(l=>l.group==='savings').map(function(l){const goal=state.goals.find(x=>x.name.toLowerCase()===l.name.toLowerCase());
        const w=goal&&goal.target>0?Math.min(100,goal.saved/goal.target*100):0;
        return '<button class="pb-row" data-act="nav" data-sec="goals"><span class="emo">'+I(lineIcon(l.name,'savings',l.icon),17)+'</span><span class="pb-mid"><span class="pb-n">'+esc(l.name)+'</span><span class="pb-bar"><i style="width:'+w.toFixed(1)+'%"></i></span></span>'+
          '<span class="pb-r"><b>'+money0(lineAmt(l,p.income))+'/mo</b><span>'+(goal?money0(goal.saved)+(goal.target>0?' of '+money0(goal.target):' saved'):'')+'</span></span></button>';}).join('')
      :list.map(row).join('')||'<div class="note">No '+GROUP_LBL[g].toLowerCase()+' budgets this month.</div>';
    return '<div class="pb-sec"><h4>'+GROUP_LBL[g]+' · '+fmtPct(p.split[g])+'</h4><span>'+money0(a[g])+' of '+money0(groupAmt(p,g))+'</span></div>'+body;};
  return '<div class="panel plan-budgets" style="margin-bottom:16px"><div class="panel-head"><button class="btn btn-sm" data-act="plan-edit">'+I('edit',14)+' Edit Plan</button>'+
    '<span class="sub" style="margin-left:auto">From your plan · '+[p.split.needs,p.split.wants,p.split.savings].map(v=>Math.round(v*10)/10).join(' / ')+'</span></div><div class="panel-body">'+
    PLAN_GROUPS.map(sec).join('')+'</div></div>';
}

/* Line drawings (theme colours) */
const SU_ILL='<svg width="230" height="112" viewBox="0 0 230 112" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M-6 74 C 46 74 62 32 104 32 C 150 32 156 90 196 90 C 214 90 226 80 240 70" style="stroke:var(--mist2)" stroke-width="11"/>'+
  '<rect x="44" y="30" width="118" height="68" rx="14" style="fill:var(--paper)"/><path d="M44 47h118"/><rect x="132" y="58" width="40" height="24" rx="8" style="fill:var(--paper)"/><circle cx="144" cy="70" r="3" style="fill:currentColor"/>'+
  '<ellipse cx="190" cy="92" rx="20" ry="7" style="fill:var(--paper)"/><path d="M170 92v-8M210 92v-8"/><ellipse cx="190" cy="84" rx="20" ry="7" style="fill:var(--paper)"/><path d="M170 84v-8M210 84v-8"/><ellipse cx="190" cy="76" rx="20" ry="7" style="fill:var(--paper)"/>'+
  '<circle cx="36" cy="22" r="12" style="fill:var(--paper)"/><path d="M32 16h5a3.4 3.4 0 0 1 0 6.8h-5zM30 19.4h11M32 16v12"/>'+
  '<circle cx="204" cy="30" r="3" style="fill:currentColor" stroke="none"/><circle cx="18" cy="64" r="2.5" style="fill:var(--muted2)" stroke="none"/></svg>';
const SU_ILL_SMALL='<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="32" cy="32" r="22" style="stroke:var(--mist2)" stroke-width="8"/>'+
  '<path d="M32 10a22 22 0 0 1 19 33" stroke-width="8" style="stroke:currentColor"/><path d="M51 43a22 22 0 0 1-30 8" stroke-width="8" style="stroke:var(--g2s)"/></svg>';

