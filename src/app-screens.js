/* ---------------- UI framework ---------------- */
const TXN_PER=25;
function freshTxnFilter(o){return Object.assign({q:'',type:'',cat:'',acc:'',from:'',to:'',sort:'date',dir:'desc',page:1},o||{});}
let ui={section:'dashboard',month:monthKey(TODAY()),
  dash:{preset:'month',from:'',to:'',metric:'spent',showActivity:false},
  txn:freshTxnFilter(),
  fc:{horizon:1},an:{hist:6},
  scenario:{incomePct:0,diningCut:0,oneTime:0,oneTimeWhen:1,monthlyAdj:0}};
let fcCache=null,dashCache=null;
const SECTIONS={
  dashboard:{title:'Home',sub:'4 Tanks & Activity',icon:'home',usesMonth:true},
  budgets:{title:'Budgets',sub:'Plan Breakdown & Category Limits',icon:'target',usesMonth:true},
  debt:{title:'Debt',sub:'Payoff Plan & Net Income Impact',icon:'card',usesMonth:false},
  goals:{title:'Savings',sub:'Savings Subcategories & Goals',icon:'flag',usesMonth:false},
  accounts:{title:'Accounts',sub:'Where Your Money Sits',icon:'wallet',usesMonth:false},
  settings:{title:'Settings',sub:'Appearance, Sheet & Backup',icon:'gear',usesMonth:false}};
function toast(msg,type){
  const d=document.createElement('div');d.className='toast '+(type||'');
  d.innerHTML=I(type==='err'?'alert':type==='ok'?'check':'info',16)+'<span>'+esc(msg)+'</span>';
  $('#toastRoot').appendChild(d);
  setTimeout(function(){d.style.opacity='0';d.style.transition='opacity .3s';setTimeout(function(){d.remove();},320);},3800);
}
const modalOpen=()=>$('#modalRoot').classList.contains('open');
function openModal(o){
  const root=$('#modalRoot');
  root.innerHTML='<div class="modal-backdrop" data-backdrop="1"><div class="modal'+(o.wide?' modal-wide':'')+'" role="dialog" aria-modal="true">'+
    '<div class="modal-head"><h3>'+o.title+'</h3><button class="icon-btn" data-act="modal-close" aria-label="Close">'+I('x',17)+'</button></div>'+
    '<div class="modal-body">'+o.body+'</div>'+
    (o.foot?'<div class="modal-foot">'+o.foot+'</div>':'')+'</div></div>';
  root.classList.add('open');
  const f=root.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]),.modal-body select,.modal-body textarea');
  if(f&&!o.noFocus)setTimeout(function(){try{f.focus();}catch(e){}},50);
  if(o.onMount)o.onMount(root);
}
function closeModal(){$('#modalRoot').classList.remove('open');$('#modalRoot').innerHTML='';
  if(typeof Sync!=='undefined'&&Sync.deferRender)setTimeout(safeRender,30);}
let confirmCb=null;
function confirmDialog(title,msg,label,danger,onYes){
  confirmCb=onYes;
  openModal({title:title,body:'<p style="font-size:14px">'+msg+'</p>',
    foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn '+(danger?'btn-danger':'btn-primary')+'" data-act="confirm-yes">'+esc(label||'Confirm')+'</button>'});
}
function refresh(){saveState();render();}
function nav(sec){if(!SECTIONS[sec])return;ui.section=sec;document.body.classList.remove('sb-open');render();window.scrollTo({top:0});}
function setMonth(k){if(!/^\d{4}-\d{2}$/.test(k))return;ui.month=k;$('#monthPick').value=k;
  if(ui.dash.showActivity){ui.txn.from=monthStart(k);ui.txn.to=monthEnd(k);ui.txn.page=1;}
  render();}
function render(){
  try{renderInner();}
  catch(err){
    console.error(err);
    $('#view').innerHTML='<div class="panel"><div class="panel-body"><div class="alert-inline">'+I('alert',16)+'<span><b>This section could not be displayed.</b> Technical detail: '+esc(err.message)+' \u2014 the rest of the app still works.</span></div></div></div>';
  }
}
function renderInner(){
  clearBudgetMemo();
  if(typeof applyTheme==='function')applyTheme();
  document.querySelectorAll('#navList .nav-item').forEach(function(b){b.classList.toggle('active',b.dataset.sec===ui.section);});
  const sec=SECTIONS[ui.section];
  $('#secTitle').textContent=sec.title;$('#secSub').textContent=sec.sub;
  $('#monthGroup').style.display=sec.usesMonth?'flex':'none';
  $('#monthPick').value=ui.month;
  const ml=$('#monthLbl');if(ml)ml.textContent=periodStartDay()>1?fmtDShort(monthStart(ui.month))+' \u2013 '+fmtDShort(monthEnd(ui.month)):MONS[Number(ui.month.slice(5))-1]+' '+ui.month.slice(0,4);
  const pb=$('#btnPlan');if(pb){const has=hasPlan();pb.classList.toggle('new',!has);
    $('#btnPlanIc').innerHTML=I(has?'edit':'sparkle',15);$('#btnPlanLbl').textContent=has?'Edit My Plan':'Set Up My Plan';
    pb.setAttribute('aria-label',has?'Edit my plan':'Set up my plan');pb.title=has?'Edit my plan':'Set up my plan';}
  const od=overdueBills().length;
  const badge=$('#navBillsBadge');
  if(badge){badge.style.display=od?'':'none';badge.textContent=od;}
  $('#demoChip').style.display=state.isDemo?'':'none';
  document.querySelectorAll('#bottomNav .bn').forEach(function(b){
    const s=b.dataset.sec;b.classList.toggle('on',s?s===ui.section:['dashboard','budgets','debt'].indexOf(ui.section)<0);});
  const md=$('#bnMoreDot');if(md)md.style.display=od?'':'none';
  $('#view').innerHTML=(RENDER[ui.section]||RENDER.dashboard)();
  try{
    if(ui.section==='forecast'&&fcCache)
      attachHover('fcChartWrap',fcCache.labels,[{name:'Projected cash',color:'var(--ink)',data:fcCache.series}]);
    if(ui.section==='dashboard'&&dashCache)
      attachHover('dashTrendWrap',dashCache.labels,[{name:'Daily spending',color:'var(--c2)',data:dashCache.series}]);
  }catch(e){console.error(e);}
}
function mutate(fn){fn();refresh();}

/* ---------------- Shared render helpers ---------------- */
const typeBadge=t=>'<span class="badge '+TYPE_CLS[t]+'">'+TYPE_LBL[t]+'</span>';
function acctName(id){const a=accountById(id);return a?a.name:null;}
function acctCell(t){
  const f=acctName(t.fromAccount),to=acctName(t.toAccount);
  if(t.type==='income')return esc(to||'\u2014');
  if(t.type==='expense')return esc(f||'\u2014');
  if(t.type==='refund')return '\u2192 '+esc(to||'\u2014');
  return esc(f||'\u2014')+' <span class="cat-chip">\u2192</span> '+esc(to||'\u2014');
}
function amtCell(t){
  if(t.type==='income'||t.type==='refund')return '<span class="pos">+'+money(t.amount)+'</span>';
  if(t.type==='expense')return '<span class="neg">\u2212'+money(t.amount)+'</span>';
  return '<span style="color:var(--muted)">'+money(t.amount)+'</span>';
}
function meterHTML(spent,amount){
  if(!(amount>0))return '<div class="meter" style="max-width:130px"></div>';
  const p=clamp(spent/amount*100,0,100);
  const raw=spent/amount*100;
  const col=raw>=state.settings.dangerThreshold?'var(--red)':raw>=state.settings.warnThreshold?'var(--orange)':'var(--teal)';
  return '<div class="meter" style="max-width:130px"><div class="meter-fill" style="width:'+p.toFixed(1)+'%;background:'+col+'"></div></div>';
}
function hbarRow(o){
  const max=o.max||o.value||1;
  const p=max>0?clamp(o.value/max*100,0,100):0;
  return '<div class="hbar'+(o.act?' clickable':'')+'"'+(o.act?' data-act="'+o.act+'" data-cat="'+esc(o.cat||'')+'" data-from="'+esc(o.from||'')+'" data-to="'+esc(o.to||'')+'"':'')+'>'+
    '<div class="hbar-top"><span class="hbar-lb">'+o.label+'</span><span class="hbar-v num" style="color:'+(o.color||'var(--ink)')+'">'+money(o.value)+'</span></div>'+
    '<div class="meter"><div class="meter-fill" style="width:'+p.toFixed(1)+'%;background:'+(o.color||'var(--teal)')+'"></div></div>'+
    (o.sub?'<div class="hbar-sub">'+o.sub+'</div>':'')+'</div>';
}
function insightList(list,limit){
  if(!list.length)return '<div class="note">All clear.</div>';
  return list.slice(0,limit||20).map(function(x){
    const ic=x.level==='danger'||x.level==='warn'?'alert':x.level==='good'?'check':'info';
    return '<div class="insight '+x.level+'"><div class="ii">'+I(ic,17)+'</div><div class="tx"><b>'+esc(x.title)+'</b><span>'+esc(x.body)+'</span>'+
      '<div class="act-row">'+(x.actionHTML||'')+'<button class="btn btn-sm btn-ghost" data-act="ins-dismiss" data-key="'+esc(x.key)+'">'+'Dismiss</button></div></div></div>';
  }).join('');
}
function connectBannerHTML(){
  if(typeof Sync==='undefined'||Sync.url)return '';
  return '<div class="connect-banner"><div class="t"><b>'+I('sheet',17)+' Save To Google Sheets</b><span>Your data only lives in this browser for now.</span></div>'+
    '<button class="btn btn-primary" data-act="sync-setup">Connect</button></div>';
}

/* ================= SECTION RENDERERS ================= */
const RENDER={};

/* ---------- Home ---------- */
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function dayLabel(iso){
  const r=relDays(iso);
  if(r===0)return 'Today';if(r===-1)return 'Yesterday';if(r===1)return 'Tomorrow';
  const d=parseISO(iso);
  return WD[d.getDay()]+', '+MONS[d.getMonth()]+' '+d.getDate()+(d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():'');
}
function txTitle(t){
  if(t.type==='transfer')return 'transfer';
  if(t.type==='cc_payment')return 'card payment';
  if(t.type==='refund')return 'refund';
  return t.category||TYPE_LBL[t.type];
}
function txSigned(t){
  if(t.type==='income'||t.type==='refund')return '+'+money(t.amount);
  if(t.type==='expense')return '−'+money(t.amount);
  return money(t.amount);
}
function txRowHTML(t){
  const mv=t.type==='transfer'||t.type==='cc_payment';
  let sub=mv?((acctName(t.fromAccount)||'?')+' → '+(acctName(t.toAccount)||'?')):t.description;
  if(!mv&&(!sub||sub===t.category))sub=acctName(t.type==='expense'?t.fromAccount:t.toAccount)||'';
  return '<button class="txr" data-act="txn-view" data-id="'+esc(t.id)+'"><span class="emo" aria-hidden="true">'+txEmoji(t)+'</span>'+
    '<span class="txr-mid"><span class="txr-t">'+esc(txTitle(t))+'</span><span class="txr-s">'+esc(sub)+'</span></span>'+
    '<span class="txr-a'+(mv?' mv':'')+'">'+txSigned(t)+'</span></button>';
}
function dayNet(list){let n=0;for(const t of list){if(t.type==='income'||t.type==='refund')n+=t.amount;else if(t.type==='expense')n-=t.amount;}return round2(n);}
function txListHTML(list,grouped){
  if(!grouped)return list.map(txRowHTML).join('');
  let out='',cur=null,bucket=[];
  const flush=function(){
    if(!bucket.length)return;
    const n=dayNet(bucket);
    out+='<div class="txl-day"><span>'+dayLabel(cur)+'</span><span class="num">'+(n?signed(n):'')+'</span></div>'+bucket.map(txRowHTML).join('');
    bucket=[];
  };
  for(const t of list){if(t.date!==cur){flush();cur=t.date;}bucket.push(t);}
  flush();
  return out;
}

/* ---------------- 4 Tanks (Needs, Wants, Debts, Savings) + Debt-Free Congratulations + Debt Chart & Net Income Widget ---------------- */
function activeDebtLines(){
  const pLines=(state.plan&&Array.isArray(state.plan.lines))?state.plan.lines.filter(l=>l.group==='debts'&&debtRem(l)>0):[];
  return pLines;
}
function totalDebtStatus(){
  const pLines=activeDebtLines();
  const liabs=state.accounts.filter(a=>!a.archived&&LIABS.includes(a.type));
  const acctDebt=round2(liabs.reduce((s,a)=>s+Math.max(0,accountBalance(a.id)),0));
  if(pLines.length){
    const initTotal=round2(pLines.reduce((s,l)=>s+(toNum(l.target)>0?toNum(l.target):debtRem(l)),0));
    const paidTotal=round2(pLines.reduce((s,l)=>s+Math.max(0,toNum(l.paid)),0));
    const remTotal=round2(pLines.reduce((s,l)=>s+debtRem(l),0));
    const monthlyPay=round2(pLines.reduce((s,l)=>s+debtMonthlyAmt(l,state.plan.income),0));
    const maxMonths=Math.max.apply(null,pLines.map(l=>Math.max(1,Math.round(toNum(l.months))||1)));
    const primaryFreq=pLines[0].freq||'monthly';
    return{hasPlanDebts:true,lines:pLines,totalTarget:Math.max(initTotal,remTotal),paid:paidTotal,remaining:remTotal,monthlyPay:monthlyPay,months:maxMonths,freq:primaryFreq,acctDebt:acctDebt};
  }
  if(hasPlan()){
    return{hasPlanDebts:false,lines:[],totalTarget:0,paid:0,remaining:0,monthlyPay:0,months:0,freq:'monthly',acctDebt:acctDebt};
  }
  const planned=round2(liabs.reduce((s,a)=>s+(a.plannedPayment||a.minPayment||0),0))||(acctDebt>0?round2(acctDebt/6):0);
  const mos=acctDebt>0&&planned>0?Math.ceil(acctDebt/planned):0;
  return{hasPlanDebts:false,lines:[],totalTarget:acctDebt,paid:0,remaining:acctDebt,monthlyPay:planned,months:mos||6,freq:'monthly',acctDebt:acctDebt};
}
function tankMetrics(k){
  k=k||ui.month;
  const tx=monthTxns(k),sm=netSpendByCat(tx),S=periodSummary(tx);
  const p=hasPlan()?state.plan:{income:S.income||60000,split:{needs:50,wants:30,savings:20},lines:[]};
  const inc=p.income||S.income||0;
  const ds=totalDebtStatus();
  const needsGross=round2(inc*(p.split.needs||50)/100);
  const debtMonthly=ds.remaining>0?ds.monthlyPay:0;
  const needsCap=Math.max(0,round2(needsGross-debtMonthly));
  const wantsCap=round2(inc*(p.split.wants||30)/100);
  const savCap=round2(inc*(p.split.savings||20)/100);
  let needsSpent=0,wantsSpent=0;
  for(const c in sm){
    if(c==='Debt Payments'||c==='Debt Interest')continue;
    const g=planGroupOf(c);
    if(g==='needs')needsSpent+=sm[c];
    else wantsSpent+=sm[c];
  }
  needsSpent=Math.max(0,round2(needsSpent));
  wantsSpent=Math.max(0,round2(wantsSpent));
  const needsLeft=Math.max(0,round2(needsCap-needsSpent));
  const wantsLeft=Math.max(0,round2(wantsCap-wantsSpent));
  const needsFillPct=needsCap>0?clamp((needsCap-needsSpent)/needsCap*100,0,100):0;
  const wantsFillPct=wantsCap>0?clamp((wantsCap-wantsSpent)/wantsCap*100,0,100):0;
  const debtFillPct=ds.totalTarget>0?clamp(ds.remaining/ds.totalTarget*100,0,100):(ds.remaining>0?100:0);
  const goalsTotalTarget=round2(state.goals.reduce((s,g)=>s+Math.max(0,g.target||0),0));
  const goalsTotalSaved=round2(state.goals.reduce((s,g)=>s+Math.max(0,g.saved||0),0));
  const savAccBal=round2(state.accounts.filter(a=>!a.archived&&a.type==='savings').reduce((s,a)=>s+Math.max(0,accountBalance(a.id)),0));
  const savCurrent=goalsTotalSaved>0?goalsTotalSaved:savAccBal;
  const savTarget=goalsTotalTarget>0?goalsTotalTarget:Math.max(savCap*6,savCurrent,10000);
  const savFillPct=savTarget>0?clamp(savCurrent/savTarget*100,0,100):0;
  return{
    inc:inc,
    needs:{cap:needsCap,gross:needsGross,spent:needsSpent,left:needsLeft,fillPct:needsFillPct},
    wants:{cap:wantsCap,spent:wantsSpent,left:wantsLeft,fillPct:wantsFillPct},
    debts:{total:ds.totalTarget,paid:ds.paid,rem:ds.remaining,monthly:debtMonthly,months:ds.months,freq:ds.freq,fillPct:debtFillPct,lines:ds.lines},
    savings:{cap:savCap,saved:savCurrent,target:savTarget,fillPct:savFillPct,goals:state.goals}
  };
}
function debtFreeCongratsBannerHTML(tm){
  tm=tm||tankMetrics(ui.month);
  if(tm.debts.rem>0)return '';
  const freed=lastFreedDebt&&lastFreedDebt.monthly>0?lastFreedDebt.monthly:0;
  return '<div class="congrats-card" role="status" aria-live="polite">'+
    '<div class="congrats-badge">'+I('sparkle',24)+'</div>'+
    '<div class="congrats-body">'+
      '<h4>Congratulations! You Are 100% Debt-Free! 🎉</h4>'+
      '<p>You have <b>₱0 debt</b>. 100% of your <b>'+money(tm.inc)+'</b> monthly net income stays with you for Needs, Wants, and Savings'+(freed>0?' (<b>+'+money(freed)+'/mo</b> freed from completed debt plans!)':'.')+'</p>'+
    '</div>'+
    '<div class="split-btns">'+
      '<button type="button" class="btn btn-sm btn-primary" data-act="debt-congrats-open">'+I('sparkle',14)+' Celebrate</button>'+
      '<button type="button" class="btn btn-sm" data-act="tank-open" data-tank="debts">+ Plan a Debt</button>'+
    '</div>'+
  '</div>';
}
function openDebtFreeCongratsModal(paidNames,freedMonthly){
  const tm=tankMetrics(ui.month);
  const namesTxt=(paidNames&&paidNames.length)?paidNames.join(', '):(lastFreedDebt.names.length?lastFreedDebt.names.join(', '):'all your debts');
  const freed=(freedMonthly!=null?freedMonthly:lastFreedDebt.monthly)||0;
  openModal({
    title:I('sparkle',18)+' Congratulations!',
    body:'<div class="congrats-modal-hero">'+
      '<div class="congrats-modal-ring">'+I('check',36)+'</div>'+
      '<h2>You Are Officially Debt-Free! 🎉</h2>'+
      '<p>Congratulations on paying off <b>'+esc(namesTxt)+'</b>! Your Debts tank is now completely empty (<b>₱0 owed</b>) and the finished debt plan has been removed automatically.</p>'+
      '<div class="congrats-stat-box">'+
        '<div class="kv"><span class="k">Remaining Debt Balance</span><span class="v pos">₱0.00 (100% Paid Off)</span></div>'+
        '<div class="kv"><span class="k">Net Income Retained</span><span class="v pos">100% ('+money(tm.inc)+'/mo)</span></div>'+
        (freed>0?'<div class="kv"><span class="k">Cash Flow Freed Up</span><span class="v pos">+'+money(freed)+'/mo (+'+money0(freed*12)+'/yr)</span></div>':'')+
        '<div class="kv"><span class="k">Needs Consumption Tank</span><span class="v">'+money(tm.needs.cap)+'/mo available</span></div>'+
      '</div>'+
    '</div>',
    foot:'<button class="btn" data-act="tank-open" data-tank="savings">'+I('flag',15)+' Add Freed Cash To Savings</button>'+
         '<button class="btn btn-primary" data-act="modal-close">Awesome!</button>'
  });
}
function tankLiquidHTML(pct,cls){
  /* Map 0..100% into 12..85% vessel height so every tank always shows sloshing, rippling water waves! */
  const vis=pct<=0?12:(16+(clamp(pct,0,100)*0.69));
  const waveFront='M0,12 C40,24 80,0 120,12 C160,24 200,0 240,12 C280,24 320,0 360,12 C400,24 440,0 480,12 L480,26 L0,26 Z';
  const waveBack='M0,12 C35,2 85,22 120,12 C155,2 205,22 240,12 C275,2 325,22 360,12 C395,2 445,22 480,12 L480,26 L0,26 Z';
  return '<div class="tank-liquid'+(cls?' '+cls:'')+'" style="height:'+vis.toFixed(1)+'%">'+
    '<svg class="tank-wave back" viewBox="0 0 480 26" preserveAspectRatio="none" aria-hidden="true"><path d="'+waveBack+'"/></svg>'+
    '<svg class="tank-wave front" viewBox="0 0 480 26" preserveAspectRatio="none" aria-hidden="true"><path d="'+waveFront+'"/></svg>'+
  '</div>';
}
function tanksHTML(k){
  const tm=tankMetrics(k);
  const dFreq=debtFreqAmt(tm.debts.monthly,tm.debts.freq);
  const goalCnt=state.goals.length;
  return '<section class="tanks-sec" aria-label="Budget Tanks">'+
    '<div class="tanks-head"><h3>Your 4 Tanks</h3><span>Tap any tank to spend, pay/add debt, or add/withdraw savings</span></div>'+
    '<div class="tanks-grid">'+
      '<button type="button" class="tank-card" data-act="tank-open" data-tank="needs">'+
        '<div class="tank-top"><span class="tank-title">'+catEmoji('Needs','expense',15)+' Needs</span><span class="tank-pct">'+Math.round(tm.needs.fillPct)+'%</span></div>'+
        '<div class="tank-vessel">'+tankLiquidHTML(tm.needs.fillPct,tm.needs.fillPct<20?'warn':'')+
          '<div class="tank-vessel-overlay"><b>'+money0(tm.needs.left)+'</b><small>of '+money0(tm.needs.cap)+' left</small></div></div>'+
        '<div class="tank-sub">Spent '+money0(tm.needs.spent)+'</div>'+
        '<span class="tank-act">+ Spend</span>'+
      '</button>'+
      '<button type="button" class="tank-card" data-act="tank-open" data-tank="wants">'+
        '<div class="tank-top"><span class="tank-title">'+catEmoji('Wants','expense',15)+' Wants</span><span class="tank-pct">'+Math.round(tm.wants.fillPct)+'%</span></div>'+
        '<div class="tank-vessel">'+tankLiquidHTML(tm.wants.fillPct,tm.wants.fillPct<20?'warn':'')+
          '<div class="tank-vessel-overlay"><b>'+money0(tm.wants.left)+'</b><small>of '+money0(tm.wants.cap)+' left</small></div></div>'+
        '<div class="tank-sub">Spent '+money0(tm.wants.spent)+'</div>'+
        '<span class="tank-act">+ Spend</span>'+
      '</button>'+
      '<button type="button" class="tank-card'+(tm.debts.rem<=0?' debt-free':'')+'" data-act="tank-open" data-tank="debts">'+
        '<div class="tank-top"><span class="tank-title">'+catEmoji('Debts','expense',15)+' Debts</span><span class="tank-pct">'+(tm.debts.rem>0?Math.round(tm.debts.fillPct)+'%':'0%')+'</span></div>'+
        '<div class="tank-vessel">'+tankLiquidHTML(tm.debts.fillPct,'debt-fill')+
          '<div class="tank-vessel-overlay"><b>'+(tm.debts.rem>0?money0(tm.debts.rem):'₱0')+'</b><small>'+(tm.debts.rem>0?'of '+money0(tm.debts.total)+' owed':'Debt-Free 🎉')+'</small></div></div>'+
        '<div class="tank-sub">'+(tm.debts.rem>0?(money0(dFreq.amt)+dFreq.lbl+' · '+tm.debts.months+'m left'):'No active debt')+'</div>'+
        '<span class="tank-act">'+(tm.debts.rem>0?'− Pay / + Add':'+ Add Debt')+'</span>'+
      '</button>'+
      '<button type="button" class="tank-card" data-act="tank-open" data-tank="savings">'+
        '<div class="tank-top"><span class="tank-title">'+catEmoji('Savings','expense',15)+' Savings</span><span class="tank-pct">'+Math.round(tm.savings.fillPct)+'%</span></div>'+
        '<div class="tank-vessel">'+tankLiquidHTML(tm.savings.fillPct,'sav-fill')+
          '<div class="tank-vessel-overlay"><b>'+money0(tm.savings.saved)+'</b><small>of '+money0(tm.savings.target)+'</small></div></div>'+
        '<div class="tank-sub">'+(goalCnt?(goalCnt+' goal'+(goalCnt===1?'':'s')+' · '+money0(tm.savings.cap)+'/mo'):('Plan '+money0(tm.savings.cap)+'/mo'))+'</div>'+
        '<span class="tank-act">+ Add / − Get</span>'+
      '</button>'+
    '</div></section>';
}

/* Debt-Free Trajectory Chart & Net Income Effect Widget */
function debtFreeAndNetIncomeHTML(k){
  k=k||ui.month;
  const tm=tankMetrics(k);
  const S=periodSummary(monthTxns(k));
  const baseInc=tm.inc||S.income||60000;
  const debtMo=tm.debts.rem>0?tm.debts.monthly:0;
  const netAfterDebt=Math.max(0,round2(baseInc-debtMo));
  const debtSharePct=baseInc>0?clamp(debtMo/baseInc*100,0,100):0;
  const keptSharePct=baseInc>0?clamp(100-debtSharePct,0,100):100;
  const dFreq=debtFreqAmt(debtMo,tm.debts.freq);
  const isFree=tm.debts.rem<=0;
  const mos=Math.max(1,tm.debts.months||1);
  const labels=['Now'],balSeries=[round2(tm.debts.rem)];
  if(!isFree){
    for(let m=1;m<=mos;m++){
      labels.push('M'+m+' ('+fmtMonthYear(m).slice(0,3)+')');
      balSeries.push(Math.max(0,round2(tm.debts.rem-(tm.debts.rem/mos)*m)));
    }
  }else{
    for(let m=1;m<=3;m++){labels.push('M'+m);balSeries.push(0);}
  }
  const primaryDebt=tm.debts.lines[0]||null;
  const termBtns=primaryDebt?[1,2,3,6,9,12].map(m=>'<button type="button" class="btn btn-sm'+(primaryDebt.months===m?' btn-primary':'')+'" data-act="debt-term-set" data-id="'+esc(primaryDebt.id)+'" data-m="'+m+'">'+m+' mo'+(m===1?'':'s')+'</button>').join(''):'';
  return (isFree?debtFreeCongratsBannerHTML(tm):'')+
    '<section class="debt-widgets" aria-label="Debt-Free Status and Net Income Impact">'+
    /* Left: Debt-Free Status & Payoff Chart */
    '<div class="panel"><div class="panel-head"><h3>'+I('trend',16)+' Debt-Free Chart</h3>'+
      '<span class="df-badge'+(isFree?' free':'')+'" style="margin-left:auto">'+(isFree?I('check',13)+' Debt-Free 🎉':('Debt-Free in '+mos+' mo'+(mos===1?'':'s')+' ('+fmtMonthYear(mos)+')'))+'</span></div>'+
      '<div class="panel-body">'+
        (isFree
          ?'<div class="note" style="margin-bottom:10px"><b>Congratulations! You have no debt! 🎉</b> Your Debts tank is at ₱0 and any completed debt plan has been removed.</div>'
          :'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">'+
             '<span style="font-size:13px;color:var(--muted)">Left: <b style="color:var(--ink)">'+money(tm.debts.rem)+'</b> of '+money(tm.debts.total)+'</span>'+
             (termBtns?'<div class="split-btns" style="align-items:center"><span style="font-size:12px;color:var(--muted)">Term:</span>'+termBtns+'</div>':'')+
           '</div>')+
        svgLine({w:520,h:175,labels:labels,series:[{name:'Remaining debt',color:'var(--ink)',data:balSeries,area:true}]})+
        '<div class="kv" style="margin-top:8px"><span class="k">Scheduled payoff</span><span class="v">'+(isFree?'₱0 / mo (Debt-Free)':money(dFreq.amt)+dFreq.lbl+' ('+money(debtMo)+'/mo)')+'</span></div>'+
      '</div></div>'+
    /* Right: Effect of Debt on Net Income Widget */
    '<div class="panel"><div class="panel-head"><h3>'+I('scale',16)+' Effect Of Debt On Net Income</h3>'+
      '<span class="badge '+(isFree?'b-ok':debtSharePct>=20?'b-over':'b-watch')+'" style="margin-left:auto">'+(isFree?'0% Debt Burden':pctStr(debtSharePct)+' of Income')+'</span></div>'+
      '<div class="panel-body">'+
        '<div class="kv"><span class="k">Monthly net income</span><span class="v">'+money(baseInc)+'</span></div>'+
        '<div class="kv"><span class="k">Debt payment ('+esc(dFreq.freqLbl)+')</span><span class="v neg">'+(debtMo>0?'−'+money(debtMo)+'/mo ('+money(dFreq.amt)+dFreq.lbl+')':'₱0.00')+'</span></div>'+
        '<div class="kv"><span class="k">Net income after debt</span><span class="v pos">'+money(netAfterDebt)+' ('+pctStr(keptSharePct)+')</span></div>'+
        '<div class="kv"><span class="k">Needs tank after debt</span><span class="v">'+money(tm.needs.cap)+' of '+money(tm.needs.gross)+'</span></div>'+
        '<div class="net-bar" title="Net Income Kept vs Debt Drain">'+
          '<i style="width:'+keptSharePct.toFixed(1)+'%;background:var(--ink)"></i>'+
          '<i style="width:'+debtSharePct.toFixed(1)+'%;background:var(--c2)"></i>'+
        '</div>'+
        '<div class="note" style="margin-top:8px">'+(isFree
          ?'<b>Congratulations!</b> 100% of your <b>'+money(baseInc)+'</b> net income is free for your Needs, Wants, and Savings tanks.'
          :'Once paid off in <b>'+mos+' month'+(mos===1?'':'s')+'</b>, the debt plan removes itself and <b>+'+money(debtMo)+'/mo</b> returns to your net income.')+
        '</div>'+
      '</div></div>'+
  '</section>';
}

/* Interactive Modal for the 4 Tanks (Needs, Wants, Debts, Savings) */
function openTankModal(tank){
  const k=ui.month,tm=tankMetrics(k);
  const liveAssets=state.accounts.filter(a=>!a.archived&&ASSETS.includes(a.type));
  const defAcc=(liveAssets.find(a=>a.type==='bank'||a.type==='ewallet')||liveAssets[0]||{}).id||'';
  if(tank==='needs'||tank==='wants'){
    const isNeeds=tank==='needs';
    const cap=isNeeds?tm.needs.cap:tm.wants.cap,left=isNeeds?tm.needs.left:tm.wants.left,spent=isNeeds?tm.needs.spent:tm.wants.spent;
    const subCats=state.settings.expenseCats.filter(c=>isNeeds?c.essential:!c.essential).map(c=>c.name);
    const defaultCat=isNeeds?'Needs':'Wants';
    openModal({
      title:catEmoji(defaultCat,'expense',18)+' '+GROUP_LBL[tank]+' Tank (Consumption)',
      body:'<form id="fTankSpend" novalidate><div class="form-err" id="fTankErr"></div>'+
        '<div class="note" style="margin-bottom:12px"><b>'+money(left)+' left</b> in your '+GROUP_LBL[tank]+' tank this month (spent '+money(spent)+' of '+money(cap)+'). Just enter the amount you spent — no subcategory required!</div>'+
        '<div class="field"><label for="tkAmt">Amount spent (₱)</label><input type="number" class="inp" id="tkAmt" min="0.01" step="0.01" placeholder="0.00" inputmode="decimal" required></div>'+
        '<div class="fgrid">'+
          '<div class="field"><label for="tkDesc">Note / where (optional)</label><input class="inp" id="tkDesc" placeholder="e.g. '+esc(isNeeds?'Groceries, bill, fare':'Coffee, dining out, treat')+'"></div>'+
          '<div class="field"><label for="tkDate">Date</label><input type="date" class="inp" id="tkDate" value="'+TODAY()+'"></div>'+
        '</div>'+
        '<details class="expl" style="margin-bottom:10px"><summary>Optional: Pick a specific category or account</summary>'+
          '<div class="fgrid" style="margin-top:10px">'+
            '<div class="field"><label for="tkCat">Category (optional)</label><select class="inp" id="tkCat"><option value="'+esc(defaultCat)+'">'+esc(defaultCat)+' (General tank)</option>'+
              subCats.filter(c=>c!==defaultCat).map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')+'</select></div>'+
            '<div class="field"><label for="tkAcc">Paid from</label><select class="inp" id="tkAcc">'+accOptions(liveAssets,defAcc)+'</select></div>'+
          '</div>'+
        '</details></form>',
      foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="tkSave">Subtract From '+GROUP_LBL[tank]+' Tank</button>',
      onMount:function(){
        $('#fTankSpend').addEventListener('submit',function(e){e.preventDefault();$('#tkSave').click();});
        $('#tkSave').addEventListener('click',function(){
          const amt=round2(parseFloat($('#tkAmt').value));
          const errEl=$('#fTankErr');
          if(!isFinite(amt)||amt<=0){errEl.textContent='Enter an amount greater than ₱0.';errEl.classList.add('show');return;}
          const cat=($('#tkCat')&&$('#tkCat').value)||defaultCat;
          const acc=($('#tkAcc')&&$('#tkAcc').value)||defAcc;
          const desc=($('#tkDesc').value||'').trim()||(GROUP_LBL[tank]+' consumption');
          const dt=$('#tkDate').value||TODAY();
          mutate(function(){
            if(!state.settings.expenseCats.some(c=>c.name===cat))state.settings.expenseCats.push({name:cat,essential:isNeeds});
            ensureCatIds(state);
            state.transactions.push({id:uid('TXN'),date:dt,type:'expense',description:desc,amount:amt,category:cat,fromAccount:acc||null,toAccount:null,method:'',notes:'',tags:[],recurringId:null,refundOf:null});
          });
          closeModal();
          toast('Subtracted '+money(amt)+' from your '+GROUP_LBL[tank]+' tank.','ok');
        });
      }
    });
    return;
  }
  if(tank==='debts'){
    const pLines=activeDebtLines();
    const liabs=state.accounts.filter(a=>!a.archived&&LIABS.includes(a.type));
    const hasAny=pLines.length>0;
    const firstDebt=pLines[0]||null;
    const defPay=firstDebt?Math.min(debtRem(firstDebt),debtFreqAmt(debtMonthlyAmt(firstDebt,tm.inc),firstDebt.freq).amt):(tm.debts.monthly||0);
    openModal({
      title:I('card',18)+' Debts Tank (− Pay / + Add Debt)',
      body:'<form id="fTankDebt" novalidate><div class="form-err" id="fTankDebtErr"></div>'+
        '<div class="field"><label>Action</label><div class="seg" id="tkDebtModeSeg" style="width:100%">'+
          (hasAny?'<button type="button" class="on" data-debtmode="pay" style="flex:1;text-align:center">− Subtract Payment</button>'+
                  '<button type="button" data-debtmode="increase" style="flex:1;text-align:center">+ Add To This Debt</button>':'')+
          '<button type="button" class="'+(hasAny?'':'on')+'" data-debtmode="new" style="flex:1;text-align:center">+ New Debt Plan</button>'+
        '</div></div>'+
        /* Pane 1: Pay / Subtract or Increase Existing Debt */
        (hasAny?'<div id="tkDebtExistingPane">'+
          '<div class="note" id="tkDebtModeNote" style="margin-bottom:12px">Your Debts tank has <b>'+money(tm.debts.rem)+'</b> remaining of <b>'+money(tm.debts.total)+'</b>. Subtract what you paid — when it hits ₱0, the plan removes itself!</div>'+
          '<div class="field"><label for="tkDebtId">Select debt</label><select class="inp" id="tkDebtId">'+
            pLines.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' — '+money(debtRem(l))+' left ('+l.months+' mo'+(l.months===1?'':'s')+' · '+money(debtMonthlyAmt(l,tm.inc))+'/mo)</option>').join('')+'</select></div>'+
          '<div class="fgrid">'+
            '<div class="field"><label for="tkDebtAmt" id="tkDebtAmtLbl">Amount paid to subtract (₱)</label><input type="number" class="inp" id="tkDebtAmt" min="0.01" step="0.01" value="'+(defPay||'')+'" placeholder="0.00" inputmode="decimal"></div>'+
            '<div class="field"><label for="tkDebtMos">Payoff months</label><input type="number" class="inp" id="tkDebtMos" min="1" max="120" step="1" value="'+(firstDebt?firstDebt.months:tm.debts.months||6)+'"></div>'+
          '</div>'+
          '<div class="fgrid">'+
            '<div class="field"><label for="tkDebtFreq">Payment preference</label><select class="inp" id="tkDebtFreq">'+
              [['monthly','Monthly'],['weekly','Weekly'],['biweekly','Every 2 weeks'],['quarterly','Quarterly']].map(o=>'<option value="'+o[0]+'"'+((firstDebt?firstDebt.freq:'monthly')===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></div>'+
            '<div class="field" id="tkDebtAccWrap"><label for="tkDebtAcc">Paid from account</label><select class="inp" id="tkDebtAcc">'+accOptions(liveAssets,defAcc)+'</select></div>'+
          '</div>'+
        '</div>':'')+
        /* Pane 2: Add a Brand New Debt Plan */
        '<div id="tkDebtNewPane" style="display:'+(hasAny?'none':'block')+'">'+
          (!hasAny?'<div class="congrats-modal-hero" style="padding:4px 0 12px">'+
             '<div class="congrats-modal-ring" style="width:56px;height:56px">'+I('sparkle',26)+'</div>'+
             '<h2 style="font-size:19px">You Have No Active Debt! 🎉</h2>'+
             '<p style="margin-bottom:8px">Add a debt below if you want to divide it across months or weeks inside your Needs share:</p>'+
           '</div>':'<div class="note" style="margin-bottom:12px">Add another debt to your plan (seated inside Needs) and divide it into months or weeks:</div>')+
          '<div class="field"><label for="tkNewDebtName">Debt name</label><input class="inp" id="tkNewDebtName" placeholder="e.g. Credit Card, Personal Loan, Gadget Loan" value="Personal Debt"></div>'+
          '<div class="fgrid">'+
            '<div class="field"><label for="tkNewDebtTot">Total debt amount (₱)</label><input type="number" class="inp" id="tkNewDebtTot" min="1" step="100" placeholder="30000" value="30000"></div>'+
            '<div class="field"><label for="tkNewDebtMos">Divide into (months)</label><input type="number" class="inp" id="tkNewDebtMos" min="1" max="120" value="6"></div>'+
          '</div>'+
          '<div class="field"><label for="tkNewDebtFreq">Payment preference</label><select class="inp" id="tkNewDebtFreq"><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="quarterly">Quarterly</option></select></div>'+
        '</div>'+
      '</form>',
      foot:'<button class="btn" data-act="modal-close">Cancel</button>'+
        (hasAny?'<button class="btn" type="button" id="tkDebtAdjOnly">Save Term Only</button><button class="btn btn-primary" id="tkDebtSave">− Subtract Payment</button>'
               :'<button class="btn btn-primary" id="tkDebtCreate">+ Add Debt To Plan</button>'),
      onMount:function(root){
        let mode=hasAny?'pay':'new';
        const sel=$('#tkDebtId');
        const syncModeUI=function(){
          root.querySelectorAll('[data-debtmode]').forEach(b=>b.classList.toggle('on',b.dataset.debtmode===mode));
          const exPane=$('#tkDebtExistingPane'),nwPane=$('#tkDebtNewPane');
          const adjBtn=$('#tkDebtAdjOnly'),saveBtn=$('#tkDebtSave');
          if(exPane)exPane.style.display=(mode==='new')?'none':'block';
          if(nwPane)nwPane.style.display=(mode==='new')?'block':'none';
          if(adjBtn)adjBtn.style.display=(mode==='pay')?'':'none';
          if(mode==='pay'){
            if($('#tkDebtAmtLbl'))$('#tkDebtAmtLbl').textContent='Amount paid to subtract (₱)';
            if($('#tkDebtModeNote'))$('#tkDebtModeNote').innerHTML='Your Debts tank has <b>'+money(tm.debts.rem)+'</b> remaining of <b>'+money(tm.debts.total)+'</b>. Subtract what you paid — when it hits ₱0, the plan removes itself!';
            if($('#tkDebtAccWrap'))$('#tkDebtAccWrap').style.display='';
            if(saveBtn)saveBtn.textContent='− Subtract Payment';
          }else if(mode==='increase'){
            if($('#tkDebtAmtLbl'))$('#tkDebtAmtLbl').textContent='Additional debt amount to add (₱)';
            if($('#tkDebtModeNote'))$('#tkDebtModeNote').innerHTML='Borrowed more on this debt? Enter the additional amount below to add it to your Debts tank and recalculate your installment.';
            if($('#tkDebtAccWrap'))$('#tkDebtAccWrap').style.display='none';
            if($('#tkDebtAmt'))$('#tkDebtAmt').value='';
            if(saveBtn)saveBtn.textContent='+ Add To Debt';
          }else{
            if(saveBtn)saveBtn.textContent='+ Add Debt To Plan';
          }
        };
        root.querySelectorAll('[data-debtmode]').forEach(b=>b.addEventListener('click',function(){
          mode=b.dataset.debtmode;syncModeUI();
        }));
        if(sel)sel.addEventListener('change',function(){
          const l=state.plan.lines.find(x=>x.id===sel.value);
          if(l){
            $('#tkDebtMos').value=l.months||6;
            $('#tkDebtFreq').value=l.freq||'monthly';
            if(mode==='pay')$('#tkDebtAmt').value=Math.min(debtRem(l),debtFreqAmt(debtMonthlyAmt(l,tm.inc),l.freq).amt);
          }
        });
        if($('#tkDebtAdjOnly'))$('#tkDebtAdjOnly').addEventListener('click',function(){
          const id=sel?sel.value:(firstDebt&&firstDebt.id);
          const mos=clamp(Math.round(parseFloat($('#tkDebtMos').value)||6),1,120);
          const freq=$('#tkDebtFreq').value||'monthly';
          mutate(function(){
            const l=state.plan&&state.plan.lines.find(x=>x.id===id);
            if(l){l.months=mos;l.freq=freq;l.amount=debtMonthlyAmt(l,state.plan.income);prunePaidDebts();syncPlanBudgets(monthKey(TODAY()),[]);}
          });
          closeModal();
          toast('Updated debt payoff plan to '+mos+' month(s) ('+FREQ_LBL[freq]+').','ok');
        });
        const createNewDebt=function(){
          const nm=($('#tkNewDebtName').value||'').trim()||'Personal Debt';
          const tot=round2(parseFloat($('#tkNewDebtTot').value));
          const mos=clamp(Math.round(parseFloat($('#tkNewDebtMos').value)||6),1,120);
          const freq=$('#tkNewDebtFreq').value||'monthly';
          const errEl=$('#fTankDebtErr');
          if(!isFinite(tot)||tot<=0){errEl.textContent='Enter a total debt amount greater than ₱0.';errEl.classList.add('show');return;}
          mutate(function(){
            if(!state.plan||!state.plan.income)state.plan={income:60000,payday:'15-30',payDay:15,split:{needs:50,wants:30,savings:20},lines:[]};
            const moAmt=round2(tot/mos);
            state.plan.lines.push({id:uid('PLN'),group:'debts',name:nm,mode:'amt',pct:null,amount:moAmt,rollover:false,target:tot,targetDate:'',paid:0,months:mos,freq:freq,icon:'card'});
            prunePaidDebts();
            syncPlanBudgets(monthKey(TODAY()),[]);
          });
          closeModal();
          toast('Added '+nm+' ('+money(tot)+' over '+mos+' months) to your Debts tank!','ok');
        };
        if($('#tkDebtCreate'))$('#tkDebtCreate').addEventListener('click',createNewDebt);
        if($('#tkDebtSave'))$('#tkDebtSave').addEventListener('click',function(){
          if(mode==='new'){createNewDebt();return;}
          const amt=round2(parseFloat($('#tkDebtAmt').value));
          const mos=clamp(Math.round(parseFloat($('#tkDebtMos').value)||6),1,120);
          const freq=$('#tkDebtFreq').value||'monthly';
          const errEl=$('#fTankDebtErr');
          if(!isFinite(amt)||amt<=0){errEl.textContent='Enter an amount greater than ₱0.';errEl.classList.add('show');return;}
          const id=sel?sel.value:(firstDebt&&firstDebt.id);
          if(mode==='increase'){
            let debtName='Debt';
            mutate(function(){
              const l=state.plan&&state.plan.lines.find(x=>x.id===id);
              if(l){
                debtName=l.name;
                l.target=round2((toNum(l.target)||debtRem(l))+amt);
                l.months=mos;
                l.freq=freq;
                l.amount=debtMonthlyAmt(l,state.plan.income);
                prunePaidDebts();
                syncPlanBudgets(monthKey(TODAY()),[]);
              }
            });
            closeModal();
            toast('Added '+money(amt)+' to '+debtName+'!','ok');
            return;
          }
          const fromAcc=($('#tkDebtAcc')&&$('#tkDebtAcc').value)||defAcc;
          let paidOffNames=[];
          let freedMo=0;
          let debtName='Debt payment';
          mutate(function(){
            const l=state.plan&&state.plan.lines.find(x=>x.id===id);
            if(l){
              debtName=l.name;
              freedMo=debtMonthlyAmt(l,state.plan.income);
              l.paid=round2((toNum(l.paid)||0)+amt);
              l.months=mos;
              l.freq=freq;
              l.amount=debtMonthlyAmt(l,state.plan.income);
            }
            const liabAcc=liabs.find(a=>a.name.toLowerCase()===debtName.toLowerCase())||liabs.find(a=>accountBalance(a.id)>0);
            if(liabAcc){
              state.transactions.push({id:uid('TXN'),date:TODAY(),type:'cc_payment',description:'Debt payment — '+debtName,amount:amt,category:'',fromAccount:fromAcc||null,toAccount:liabAcc.id,method:'Bank Transfer',notes:'Subtracted from Debts tank',tags:[],recurringId:null,refundOf:null});
            }else{
              if(!state.settings.expenseCats.some(c=>c.name==='Debt Payments'))state.settings.expenseCats.push({name:'Debt Payments',essential:true});
              ensureCatIds(state);
              state.transactions.push({id:uid('TXN'),date:TODAY(),type:'expense',description:'Debt payment — '+debtName,amount:amt,category:'Debt Payments',fromAccount:fromAcc||null,toAccount:null,method:'Bank Transfer',notes:'Subtracted from Debts tank',tags:[],recurringId:null,refundOf:null});
            }
            paidOffNames=prunePaidDebts();
          });
          closeModal();
          if(paidOffNames.length){
            toast('🎉 Congratulations! '+paidOffNames.join(', ')+' is 100% paid off and removed from your plan!','ok');
            openDebtFreeCongratsModal(paidOffNames,freedMo);
          }else{
            toast('Subtracted '+money(amt)+' from your Debts tank!','ok');
          }
        });
      }
    });
    return;
  }
  if(tank==='savings'){
    const subcats=state.goals.length?state.goals.map(g=>({id:g.id,name:g.name,saved:g.saved,target:g.target})):[{id:'__new__',name:'Emergency Fund',saved:0,target:60000}];
    const savAcc=state.accounts.find(a=>!a.archived&&a.type==='savings');
    openModal({
      title:I('flag',18)+' Savings Tank (+ Add / − Subtract)',
      body:'<form id="fTankSav" novalidate><div class="form-err" id="fTankSavErr"></div>'+
        '<div class="note" style="margin-bottom:12px">Add money to grow a savings subcategory, or subtract when you withdraw / get money from your savings.</div>'+
        '<div class="field"><label>Action</label><div class="seg" id="tkSavDirSeg" style="width:100%">'+
          '<button type="button" class="on" data-savdir="add" style="flex:1;text-align:center">+ Add to Savings (Put in)</button>'+
          '<button type="button" data-savdir="sub" style="flex:1;text-align:center">− Subtract (Get money out)</button>'+
        '</div></div>'+
        '<div class="fgrid">'+
          '<div class="field"><label for="tkSavSub">Savings subcategory</label><select class="inp" id="tkSavSub">'+
            subcats.map(s=>'<option value="'+esc(s.name)+'">'+esc(s.name)+' ('+money0(s.saved)+' saved)</option>').join('')+
            '<option value="__custom__">+ New savings subcategory…</option></select></div>'+
          '<div class="field" id="tkSavNewWrap" style="display:none"><label for="tkSavNew">New subcategory name</label><input class="inp" id="tkSavNew" placeholder="e.g. Tuition, Gadget"></div>'+
        '</div>'+
        '<div class="fgrid">'+
          '<div class="field"><label for="tkSavAmt">Amount (₱)</label><input type="number" class="inp" id="tkSavAmt" min="0.01" step="0.01" placeholder="0.00" inputmode="decimal" required></div>'+
          '<div class="field"><label for="tkSavAcc">Cash / bank account</label><select class="inp" id="tkSavAcc">'+accOptions(liveAssets.filter(a=>a.type!=='savings'),defAcc)+'</select></div>'+
        '</div></form>',
      foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="tkSavSave">+ Add To Savings</button>',
      onMount:function(root){
        let dir='add';
        root.querySelectorAll('[data-savdir]').forEach(b=>b.addEventListener('click',function(){
          dir=b.dataset.savdir;
          root.querySelectorAll('[data-savdir]').forEach(x=>x.classList.toggle('on',x.dataset.savdir===dir));
          $('#tkSavSave').textContent=dir==='add'?'+ Add To Savings':'− Subtract From Savings';
        }));
        $('#tkSavSub').addEventListener('change',function(){
          $('#tkSavNewWrap').style.display=$('#tkSavSub').value==='__custom__'?'':'none';
        });
        $('#fTankSav').addEventListener('submit',function(e){e.preventDefault();$('#tkSavSave').click();});
        $('#tkSavSave').addEventListener('click',function(){
          const amt=round2(parseFloat($('#tkSavAmt').value));
          const errEl=$('#fTankSavErr');
          if(!isFinite(amt)||amt<=0){errEl.textContent='Enter an amount greater than ₱0.';errEl.classList.add('show');return;}
          let subName=$('#tkSavSub').value;
          if(subName==='__custom__'){
            subName=($('#tkSavNew').value||'').trim();
            if(!subName){errEl.textContent='Enter a name for the new savings subcategory.';errEl.classList.add('show');return;}
          }
          let goal=state.goals.find(g=>g.name.toLowerCase()===subName.toLowerCase());
          if(dir==='sub'&&goal&&goal.saved<amt){
            errEl.textContent='Only '+money(goal.saved)+' is available in "'+goal.name+'".';errEl.classList.add('show');return;
          }
          const bankId=($('#tkSavAcc')&&$('#tkSavAcc').value)||defAcc;
          mutate(function(){
            if(!goal){
              goal={id:uid('GOL'),name:subName,target:Math.max(amt*6,30000),saved:0,targetDate:addMonthsISO(TODAY(),12),monthlyContribution:amt};
              state.goals.push(goal);
            }
            goal.saved=Math.max(0,round2(goal.saved+(dir==='add'?amt:-amt)));
            if(state.plan&&Array.isArray(state.plan.lines)&&!state.plan.lines.some(l=>l.group==='savings'&&l.name.toLowerCase()===subName.toLowerCase())){
              state.plan.lines.push({id:uid('PLN'),group:'savings',name:subName,mode:'amt',pct:null,amount:amt,rollover:false,target:goal.target,targetDate:goal.targetDate||'',paid:0,months:0,freq:'monthly',icon:'flag'});
            }
            if(savAcc&&bankId&&savAcc.id!==bankId){
              state.transactions.push({
                id:uid('TXN'),date:TODAY(),type:'transfer',
                description:(dir==='add'?'Savings deposit — ':'Savings withdrawal — ')+subName,
                amount:amt,category:'',
                fromAccount:dir==='add'?bankId:savAcc.id,
                toAccount:dir==='add'?savAcc.id:bankId,
                method:'Bank Transfer',notes:dir==='add'?'Added to Savings tank':'Subtracted (got money) from Savings tank',tags:[],recurringId:null,refundOf:null
              });
            }
          });
          closeModal();
          toast((dir==='add'?'Added ':'Subtracted (withdrew) ')+money(amt)+(dir==='add'?' to ':' from ')+subName+'.','ok');
        });
      }
    });
  }
}

function safeHTML(){
  const s=safeToSpend();
  const row=function(l,v,cls){return '<div class="safe-r'+(cls?' '+cls:'')+'"><span>'+l+'</span><span class="num">'+v+'</span></div>';};
  const sub=s.left>0?(money0(s.left)+' left for '+s.days+(s.days===1?' day':' days')+', until '+fmtDShort(s.end))
    :(s.income+s.incomeDue>0?'Over by '+money0(-s.left)+'. More spending now eats into bills or savings.':'Add your pay as a bill (Bills \u2192 Income) so Badyet knows what\u2019s coming in.');
  return '<section class="safe" aria-label="Safe to spend today">'+
    '<div class="safe-lb">Safe To Spend Today</div>'+
    '<div class="safe-v">'+money0(s.perDay)+'<small> / day</small></div>'+
    '<div class="safe-sub">'+esc(sub)+'</div>'+
    '<details class="safe-how"><summary>How It\u2019s Worked Out</summary>'+
      row('Income received',money0(s.income))+
      (s.incomeDue?row('Pay still coming','+'+money0(s.incomeDue)):'')+
      row('Bills still due'+(s.nBills?' ('+s.nBills+')':''),'\u2212'+money0(s.billsDue))+
      (s.goals?row('Goal savings','\u2212'+money0(s.goals)):'')+
      row('Already spent','\u2212'+money0(s.spent))+
      row('Left \u00f7 '+s.days+(s.days===1?' day':' days'),(s.left<0?'\u2212':'')+money0(Math.abs(s.left)),'tot')+
    '</details></section>';
}
function miniHTML(lb,sec,val){return '<button class="mini" data-act="nav" data-sec="'+sec+'"><div class="lb">'+lb+'</div><div class="vl">'+val+'</div></button>';}
RENDER.dashboard=function(){
  dashCache=null;
  const k=ui.month,today=TODAY(),isCur=k===monthKey(today);
  const metric=ui.dash.metric||'spent';
  const months=[];for(let i=5;i>=0;i--)months.push(monthAdd(k,-i));
  const sums=months.map(function(m){return periodSummary(monthTxns(m));});
  const pick=function(s){return metric==='earned'?s.income:metric==='left'?s.net:s.netExpense;};
  const vals=sums.map(pick),S=sums[5],big=vals[5];
  const tb=totalBudget(k);
  const mLbl=monthLabel(k);
  let sub;
  if(metric==='spent')sub=tb>0?(pctStr(S.netExpense/tb*100)+' of your '+money0(tb)+' budget'):'spent in '+mLbl;
  else if(metric==='earned')sub='earned in '+mLbl;
  else sub='earned minus spent'+(S.savingsRate!=null?', '+pctStr(S.savingsRate)+' kept':'');
  const cash=availableCash(),tm=tankMetrics(k),sDay=safeToSpend();
  const list=monthTxns(k).slice().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0;});
  const showAct=!!ui.dash.showActivity;

  const left='<section class="hero">'+
    '<div class="hero-pills">'+[['spent','Spent'],['earned','Earned'],['left','Left Over']].map(function(p){
      return '<button class="pill'+(metric===p[0]?' on':'')+'" data-act="dash-metric" data-m="'+p[0]+'">'+p[1]+'</button>';}).join('')+'</div>'+
    '<div class="hero-num">'+(big<0?'−':'')+money(Math.abs(big))+'</div>'+
    '<div class="hero-sub">'+esc(sub)+'</div>'+
    svgWave(vals,5)+
    '<div class="months">'+months.map(function(m){return '<button data-act="set-month" data-k="'+m+'"'+(m===k?' class="on"':'')+'>'+MONS[Number(m.slice(5))-1]+'</button>';}).join('')+'</div>'+
    (periodStartDay()>1?'<div class="hero-per">'+esc(periodLabel(k))+'</div>':'')+
  '</section>'+
  (isCur&&state.accounts.length?safeHTML():'')+
  tanksHTML(k)+
  debtFreeAndNetIncomeHTML(k);

  const right='<section class="minis">'+
      miniHTML('Cash','accounts',money0(cash))+
      miniHTML('Debt','debt',tm.debts.rem>0?money0(tm.debts.rem):'Debt-Free 🎉')+
      miniHTML('Safe / Day','budgets',money0(sDay.perDay))+'</section>'+
    '<section class="blk" id="homeActivitySec">'+
      '<button type="button" class="btn" style="width:100%;justify-content:space-between;padding:13px 18px;border-radius:20px;font-size:15px;font-weight:700'+(showAct?';background:var(--ink);color:var(--paper);border-color:var(--ink)':'')+'" data-act="home-act-toggle" aria-expanded="'+showAct+'">'+
        '<span style="display:inline-flex;align-items:center;gap:9px">'+I('list',18)+' Activity</span>'+
        '<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;opacity:.85">'+(showAct?'Hide Activity':('Search & View ('+list.length+')'))+' '+I(showAct?'chevD':'chevR',15)+'</span>'+
      '</button>'+
      (showAct
        ?'<div class="home-act-panel">'+txnFiltersHTML()+'<div id="txnTableWrap">'+txnTableHTML()+'</div></div>'
        :'')+
    '</section>';
  return connectBannerHTML()+'<div class="dash"><div>'+left+'</div><div>'+right+'</div></div>';
};

/* ---------- Activity ---------- */
function txnFiltersHTML(){
  const t=ui.txn;
  const cats=t.type==='income'?state.settings.incomeCats:(t.type?state.settings.expenseCats.map(function(c){return c.name;}):state.settings.expenseCats.map(function(c){return c.name;}).concat(state.settings.incomeCats));
  const nAct=[t.type,t.cat,t.acc,t.from,t.to].filter(Boolean).length;
  const sv=t.sort+'-'+t.dir;
  return '<div class="filters">'+
    '<div class="field grow"><input class="inp" placeholder="Search" aria-label="Search" value="'+esc(t.q)+'" data-inp="txn-q"></div>'+
    '<div class="field sortf"><select class="inp" data-chg="txn-sort" aria-label="Sort">'+[['date-desc','Newest'],['date-asc','Oldest'],['amount-desc','Largest'],['amount-asc','Smallest']].map(function(o){return '<option value="'+o[0]+'"'+(sv===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div>'+
    '<details class="more-filters"'+(nAct?' open':'')+'><summary>Filters'+(nAct?' ('+nAct+')':'')+'</summary><div class="filters">'+
    '<div class="field"><label>Type</label><select class="inp" data-chg="txn-type"><option value="">All</option>'+Object.keys(TYPE_LBL).map(function(x){return '<option value="'+x+'"'+(t.type===x?' selected':'')+'>'+TYPE_LBL[x]+'</option>';}).join('')+'</select></div>'+
    '<div class="field"><label>Category</label><select class="inp" data-chg="txn-cat"><option value="">All</option>'+cats.map(function(c){return '<option value="'+esc(c)+'"'+(t.cat===c?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select></div>'+
    '<div class="field"><label>Account</label><select class="inp" data-chg="txn-acc"><option value="">All</option>'+state.accounts.map(function(a){return '<option value="'+esc(a.id)+'"'+(t.acc===a.id?' selected':'')+'>'+esc(a.name)+'</option>';}).join('')+'</select></div>'+
    '<div class="field"><label>From</label><input type="date" class="inp" value="'+t.from+'" data-chg="txn-from"></div>'+
    '<div class="field"><label>To</label><input type="date" class="inp" value="'+t.to+'" data-chg="txn-to"></div>'+
    '<div class="field"><label>&nbsp;</label><button class="btn btn-sm" data-act="tx-clear">Reset</button></div>'+
    '</div></details></div>';
}
function filteredTxns(){
  const f=ui.txn,q=f.q.toLowerCase();
  let list=state.transactions.filter(function(t){
    if(q&&!(t.description.toLowerCase().includes(q)||(t.notes||'').toLowerCase().includes(q)||t.tags.some(function(x){return x.toLowerCase().includes(q);})))return false;
    if(f.type&&t.type!==f.type)return false;
    if(f.cat&&t.category!==f.cat)return false;
    if(f.acc&&t.fromAccount!==f.acc&&t.toAccount!==f.acc)return false;
    if(f.from&&t.date<f.from)return false;
    if(f.to&&t.date>f.to)return false;
    return true;});
  list.sort(function(a,b){
    const va=a[f.sort],vb=b[f.sort];
    const c=va<vb?-1:va>vb?1:0;
    return f.dir==='asc'?c:-c;});
  return list;
}
function txnTableHTML(){
  const list=filteredTxns();
  const pages=Math.max(1,Math.ceil(list.length/TXN_PER));
  ui.txn.page=clamp(ui.txn.page||1,1,pages);
  const page=list.slice((ui.txn.page-1)*TXN_PER,ui.txn.page*TXN_PER);
  const S=periodSummary(list);
  if(!list.length)return '<div class="empty">'+(state.transactions.length?'Nothing matches.':'Nothing here yet.')+'<br>'+
    (state.transactions.length?'<button class="btn btn-sm" style="margin-top:12px" data-act="tx-clear">Clear Filters</button>':'<button class="btn btn-sm btn-primary" style="margin-top:12px" data-act="add-txn">'+I('plus',14)+' Add One</button>')+'</div>';
  return '<div class="tx-sum"><span><b>'+list.length+'</b> Items</span><span>In <b>'+money(S.income)+'</b></span><span>Out <b>'+money(S.netExpense)+'</b></span></div>'+
    '<div class="txwrap">'+txListHTML(page,ui.txn.sort==='date')+'</div>'+
    '<div class="pager">'+(pages>1?'<span>'+ui.txn.page+' / '+pages+'</span>'+
    '<button class="btn btn-sm" data-act="tx-page" data-d="-1"'+(ui.txn.page<=1?' disabled':'')+' aria-label="Previous page">'+I('chevL',14)+'</button>'+
    '<button class="btn btn-sm" data-act="tx-page" data-d="1"'+(ui.txn.page>=pages?' disabled':'')+' aria-label="Next page">'+I('chevR',14)+'</button>':'')+
    '<button class="btn btn-sm" data-act="tx-export">'+I('dl',14)+' Export CSV</button></div>';
}
RENDER.transactions=function(){
  return '<div class="panel"><div class="panel-head"><h3>All Activity</h3><span style="margin-left:auto" class="split-btns"><button class="btn btn-sm btn-primary" data-act="add-txn">'+I('plus',14)+' Add</button></span></div>'+
  txnFiltersHTML()+'<div id="txnTableWrap">'+txnTableHTML()+'</div></div>'+
  '<p class="note" style="margin-top:14px">Transfers and card payments only move money between your accounts, so they don’t count as spending.</p>';
};

/* ---------- Budgets ---------- */
function weekRange(){
  const d=parseISO(TODAY());const off=(d.getDay()+6)%7;
  const mon=addDaysISO(TODAY(),-off);return[mon,addDaysISO(mon,6)];
}
RENDER.budgets=function(){
  const k=ui.month;
  const tx=monthTxns(k),spendMap=netSpendByCat(tx);
  const bs=budgetsFor(k);
  const catB=bs.filter(function(b){return b.scope==='monthly'&&b.category!=='__total__';});
  return planBudgetsHTML(k)+
  '<div class="panel"><div class="panel-head"><h3>Category Limits — '+periodLabel(k)+'</h3>'+
    '<span class="split-btns" style="margin-left:auto">'+
    '<button class="btn btn-sm" data-act="bud-copy-prev">'+I('refresh',14)+' Copy previous month</button>'+
    '<button class="btn btn-sm btn-primary" data-act="bud-add">'+I('plus',14)+' Add category limit</button></span></div>'+
  '<div class="table-scroll"><table class="tbl"><thead><tr><th>Category</th><th class="r">Limit</th><th class="r">Spent</th><th class="r">Remaining</th><th>Progress</th><th>Status</th><th></th></tr></thead><tbody>'+
  (catB.length?catB.map(function(b){
    const spent=spendMap[b.category]||0,st=budgetStatus(spent,b.amount);
    return '<tr class="rowlink" data-act="drill" data-cat="'+esc(b.category)+'" data-from="'+monthStart(k)+'" data-to="'+monthEnd(k)+'">'+
    '<td><span class="hb-ic">'+catEmoji(b.category,'expense',16)+'</span><b>'+esc(b.category)+'</b>'+(b.rollover?' <span class="badge b-mut">Rollover</span>':'')+'</td>'+
    '<td class="amt">'+money(b.amount)+'</td><td class="amt neg">'+money(spent)+'</td>'+
    '<td class="amt '+(b.amount-spent>=0?'pos':'neg')+'">'+signed(b.amount-spent)+'</td>'+
    '<td>'+meterHTML(spent,b.amount)+'</td>'+
    '<td><span class="badge '+st.cls+'">'+st.label+'</span></td>'+
    '<td><span class="split-btns" style="flex-wrap:nowrap"><button class="icon-btn" data-act="bud-edit" data-id="'+esc(b.id)+'" title="Edit">'+I('edit',15)+'</button><button class="icon-btn danger" data-act="bud-del" data-id="'+esc(b.id)+'" title="Delete">'+I('trash',15)+'</button></span></td></tr>';}).join('')
  :'<tr><td colspan="7"><div class="empty">No individual category limits for this month yet.<br><button class="btn btn-sm btn-primary" style="margin-top:10px" data-act="bud-add">'+I('plus',14)+' Add category limit</button></div></td></tr>')+
  '</tbody></table></div></div>';
};

/* ---------- Analytics ---------- */
function momHTML(){
  const k=ui.month,pk=monthAdd(k,-1);
  const S=periodSummary(monthTxns(k)),P=periodSummary(monthTxns(pk));
  const diff=round2(S.netExpense-P.netExpense);
  const chg=P.netExpense>0?round2(diff/P.netExpense*100):null;
  const changeTxt=chg==null?(S.netExpense>0?'New spending \u2014 no data for '+monthLabel(pk):'\u2014'):(pctStr(Math.abs(chg))+(diff>0?' higher':' lower'));
  return '<div class="panel"><div class="panel-head"><h3>Vs. Last Month</h3><span class="sub">'+monthLabel(k)+' vs '+monthLabel(pk)+'</span></div><div class="panel-body">'+
  '<div class="kv"><span class="k">This month (net spend)</span><span class="v neg">'+money(S.netExpense)+'</span></div>'+
  '<div class="kv"><span class="k">Previous month</span><span class="v">'+money(P.netExpense)+'</span></div>'+
  '<div class="kv"><span class="k">Difference</span><span class="v '+(diff>0?'neg':'pos')+'">'+signed(diff)+'</span></div>'+
  '<div class="kv"><span class="k">Change</span><span class="v">'+changeTxt+'</span></div>'+
  '<div class="kv"><span class="k">Income</span><span class="v">'+money(P.income)+' \u2192 '+money(S.income)+'</span></div>'+
  '</div></div>';
}
RENDER.analytics=function(){
  const k=ui.month,today=TODAY();
  const tx=monthTxns(k),spendMap=netSpendByCat(tx);
  const cats=Object.entries(spendMap).filter(function(c){return c[1]!==0;}).sort(function(a,b){return b[1]-a[1];});
  const catMax=cats.length?Math.max(cats[0][1],0.0001):1;
  const pk=monthAdd(k,-1);
  const prevMap=netSpendByCat(monthTxns(pk));
  const catRows=cats.map(function(c){
    const prev=prevMap[c[0]]||0;
    let sub='no prior-month data';
    if(prev>0){const chg=Math.round((c[1]-prev)/prev*100);sub='prev: '+money(prev)+' ('+(chg>=0?'+':'')+chg+'%)';}
    const ci=state.settings.expenseCats.findIndex(function(x){return x.name===c[0];});
    return hbarRow({label:'<span class="hb-ic">'+catEmoji(c[0],'expense',16)+'</span>'+esc(c[0]),value:Math.max(0,c[1]),max:catMax,color:'var(--ink)',sub:sub,act:'drill',cat:c[0],from:monthStart(k),to:monthEnd(k)});
  }).join('');
  const mer={};for(const t of tx){if(t.type!=='expense')continue;const key=t.description.toLowerCase().trim();(mer[key]=mer[key]||{name:t.description,total:0,count:0}).total+=t.amount;mer[key].count++;}
  const merPrev={};for(const t of monthTxns(pk)){if(t.type!=='expense')continue;const key=t.description.toLowerCase().trim();(merPrev[key]=merPrev[key]||{total:0}).total+=t.amount;}
  const topMer=Object.values(mer).sort(function(a,b){return b.total-a.total;}).slice(0,10);
  let fixed=0,variable=0;
  for(const t of tx){if(t.type==='expense'){if(t.recurringId)fixed+=t.amount;else variable+=t.amount;}else if(t.type==='refund')variable-=t.amount;}
  let ess=0,dis=0;
  for(const c in spendMap){const meta=state.settings.expenseCats.find(function(x){return x.name===c;});if(meta&&meta.essential)ess+=spendMap[c];else dis+=spendMap[c];}
  const histN=clamp(ui.an.hist,3,12);
  const monthsH=[];for(let i=histN-1;i>=0;i--)monthsH.push(monthAdd(k,-i));
  const base=categoryBaseline();
  const anoms=[];
  if(!base.__limited)for(const c in base){if(c.indexOf('__')===0)continue;
    const spent=spendMap[c]||0,avg=base[c];
    if(avg>0&&spent>avg*1.5&&spent-avg>=1000&&!state.dismissed.includes('anom:'+c+':'+k))anoms.push({cat:c,spent:spent,avg:avg});}
  const expTx=tx.filter(function(t){return t.type==='expense';});
  const medians={};for(const c in spendMap){const arr=expTx.filter(function(t){return t.category===c;}).map(function(t){return t.amount;}).sort(function(a,b){return a-b;});medians[c]=arr.length?arr[Math.floor(arr.length/2)]:0;}
  const txAnoms=expTx.filter(function(t){return !state.exceptions.includes(t.id)&&medians[t.category]>0&&t.amount>medians[t.category]*3&&t.amount>=2000;}).slice(0,5);
  const D=dim(k),cut=(k===monthKey(today)?dayOfPeriod(today):D);
  const daily=new Array(cut).fill(0);
  for(const t of tx){const d=dayOfPeriod(t.date);if(d>cut||d<1)continue;if(t.type==='expense')daily[d-1]+=t.amount;else if(t.type==='refund')daily[d-1]-=t.amount;}
  const weeks=[];for(let w=0;w<D/7;w++){let s=0;for(let d=w*7+1;d<=Math.min(D,(w+1)*7);d++){if(d<=cut)s+=daily[d-1];}weeks.push({lb:'W'+(w+1),v:round2(s)});}
  const hasDaily=daily.some(function(v){return v!==0;});
  const firstData=state.transactions.length?state.transactions.reduce(function(m,t){return t.date<m?t.date:m;},'9999'):null;
  const monthsAvail=firstData?monthsH.filter(function(m){return m>=monthKey(firstData);}).length:0;

  return '<div class="grid g-2-1">'+
    '<div class="panel"><div class="panel-head"><h3>By Category</h3><span class="sub">Tap One To See It</span></div><div class="panel-body" style="padding-top:6px">'+
    (cats.length?catRows:'<div class="note">No expenses this month.</div>')+
    '</div></div>'+momHTML()+'</div>'+

  '<div class="grid g-2">'+
    '<div class="panel"><div class="panel-head"><h3>Day By Day</h3></div><div class="panel-body">'+
    (hasDaily?svgLine({labels:daily.map(function(_,i){return String(i+1);}),series:[{name:'Daily net spend',color:'var(--ink)',data:daily.map(function(v){return round2(v);}),area:true}]}):nochart('No spending yet this month.'))+
      '<div class="subhead" style="margin-top:14px">Weekly totals</div>'+
      svgBars({labels:weeks.map(function(x){return x.lb;}),series:[{name:'Weekly spend',color:'var(--ink)',data:weeks.map(function(x){return x.v;})}],emptyMsg:'No spending yet this month.'})+
    '</div></div>'+
    '<div class="panel"><div class="panel-head"><h3>Over Time</h3><div class="seg" style="margin-left:auto">'+
      [3,6,12].map(function(n){return '<button data-act="an-hist" data-n="'+n+'"'+(ui.an.hist===n?' class="on"':'')+'>'+n+'m</button>';}).join('')+'</div></div><div class="panel-body">'+
      svgBars({labels:monthsH.map(function(m){return MONS[Number(m.slice(5))-1];}),series:[{name:'Income',color:'var(--ink)',data:monthsH.map(function(m){return periodSummary(monthTxns(m)).income;})},{name:'Expenses',color:'var(--c2)',data:monthsH.map(function(m){return periodSummary(monthTxns(m)).netExpense;})}],emptyMsg:'No history yet.'})+
      '<div class="legend"><span class="li"><span class="sw" style="background:var(--ink)"></span>Income</span><span class="li"><span class="sw" style="background:var(--c2)"></span>Expenses</span></div>'+
      (monthsAvail<histN?('<div class="note" style="margin-top:10px">Only '+monthsAvail+' month(s) of data in this window; it fills in as history accumulates.</div>'):'')+
    '</div></div>'+
  '</div>'+

  '<div class="grid g-3">'+
    '<div class="panel"><div class="panel-head"><h3>Fixed Vs. Flexible</h3></div><div class="panel-body">'+
      '<div class="kv"><span class="k">Fixed (from schedules)</span><span class="v">'+money(fixed)+'</span></div>'+
      '<div style="margin:6px 0">'+meterHTML(fixed,Math.max(fixed+variable,0.001)*1.0001)+'</div>'+
      '<div class="kv"><span class="k">Variable</span><span class="v">'+money(variable)+'</span></div>'+
      '<div style="margin:6px 0 8px">'+meterHTML(variable,Math.max(fixed+variable,0.001)*1.0001)+'</div>'+
      '<div class="note">Fixed = transactions linked to a recurring schedule (rent, subscriptions, etc.). Everything else is treated as variable.</div></div></div>'+
    '<div class="panel"><div class="panel-head"><h3>Needs Vs. Wants</h3></div><div class="panel-body">'+
      '<div class="kv"><span class="k">Essential</span><span class="v">'+money(ess)+'</span></div>'+
      '<div style="margin:6px 0">'+meterHTML(ess,Math.max(ess+dis,0.001)*1.0001)+'</div>'+
      '<div class="kv"><span class="k">Discretionary</span><span class="v">'+money(dis)+'</span></div>'+
      '<div style="margin:6px 0 8px">'+meterHTML(dis,Math.max(ess+dis,0.001)*1.0001)+'</div>'+
      '<div class="subhead">Tap to toggle essential</div>'+
      '<div class="split-btns">'+state.settings.expenseCats.map(function(c){return '<button class="btn btn-sm '+(c.essential?'btn-teal':'')+'" data-act="cat-toggle" data-cat="'+esc(c.name)+'">'+esc(c.name)+(c.essential?' \u2713':'')+'</button>';}).join('')+'</div>'+
    '</div></div>'+
    '<div class="panel"><div class="panel-head"><h3>Top Places</h3></div><div class="panel-body" style="padding-top:4px">'+
      (topMer.length?('<div class="table-scroll"><table class="tbl"><thead><tr><th>Merchant</th><th class="r">This month</th><th class="r">Prev</th><th class="r">Change</th></tr></thead><tbody>'+
      topMer.map(function(m){const p=(merPrev[m.name.toLowerCase().trim()]||{}).total||0;
        const chg=p>0?Math.round((m.total-p)/p*100):null;
        return '<tr class="rowlink" data-act="drill" data-q="'+esc(m.name)+'" data-from="'+monthStart(k)+'" data-to="'+monthEnd(k)+'"><td><b>'+esc(m.name)+'</b><div style="font-size:11px;color:var(--muted)">'+m.count+' purchase(s)</div></td><td class="amt">'+money(m.total)+'</td><td class="amt">'+money(p)+'</td><td class="amt">'+(chg==null?'\u2014':(chg>0?'+':'')+chg+'%')+'</td></tr>';}).join('')+'</tbody></table></div>'):'<div class="note">No merchant purchases this month.</div>')+
    '</div></div>'+
  '</div>'+

  '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Unusual Spending</h3></div><div class="panel-body" style="padding-top:8px">'+
    ((anoms.length||txAnoms.length)?
      anoms.map(function(a){return '<div class="insight warn"><div class="ii">'+I('alert',17)+'</div><div class="tx"><b>'+esc(a.cat)+' is running '+Math.round((a.spent/a.avg-1)*100)+'% above usual</b><span>'+money(a.spent)+' this month vs a '+base.__months+'-month average of '+money(a.avg)+' (rule: more than 150% and at least '+money(1000)+' above).</span>'+
      '<div class="act-row"><button class="btn btn-sm" data-act="drill" data-cat="'+esc(a.cat)+'" data-from="'+monthStart(k)+'" data-to="'+monthEnd(k)+'">Inspect</button><button class="btn btn-sm btn-ghost" data-act="ins-dismiss" data-key="anom:'+esc(a.cat)+':'+k+'">Dismiss for this month</button></div></div></div>';}).join('')+
      txAnoms.map(function(t){return '<div class="insight info"><div class="ii">'+I('info',17)+'</div><div class="tx"><b>Unusually large: '+esc(t.description)+' ('+money(t.amount)+')</b><span>'+esc(t.category)+' \u2014 about '+(medians[t.category]>0?Math.round(t.amount/medians[t.category]):'\u2013')+'\u00d7 the typical purchase in that category. Only a size observation.</span>'+
      '<div class="act-row"><button class="btn btn-sm" data-act="txn-view" data-id="'+esc(t.id)+'">Review</button><button class="btn btn-sm btn-ghost" data-act="anom-except" data-id="'+esc(t.id)+'">Mark as expected one-off</button></div></div></div>';}).join('')
    :'<div class="note">Nothing unusual detected.</div>')+
  '</div></div>';
};

/* ---------- Forecast ---------- */
function fcOutHTML(){
  const fc=computeForecast(ui.fc.horizon,ui.scenario);
  fcCache=fc;
  const horLbl=(ui.fc.horizon===1?'Rest of '+monthLabel(monthKey(TODAY())):ui.fc.horizon+' months');
  const markers=fc.events.slice(0,30).map(function(e){
    const col=(e.kind==='income'?'var(--ink)':e.kind==='bill'?'var(--c2)':e.kind==='card'?'var(--c3)':'var(--c4)');
    return{label:fmtDShort(e.date),value:(fc.balAfter[e.date]!=null?fc.balAfter[e.date]:fc.cash0),color:col,title:fmtDate(e.date)+' \u2014 '+e.label+' ('+signed(e.amt)+')'};});
  const cf=avgNetCashflow(3);
  const sc=ui.scenario;
  const adjNet=(cf!=null?round2(cf*(1+sc.incomePct/100)+((sc.diningCut>0)?(categoryBaseline()['Food & Dining']||0)*sc.diningCut/100:0)-(sc.monthlyAdj||0)):null);
  const savePot=(cf!=null?round2(Math.max(0,(adjNet!=null?adjNet:cf)*ui.fc.horizon)):0);
  const cfNote=(cf!=null
    ?('<p style="font-size:13.5px">Your average net cash flow over the last 3 complete months is <b class="'+(cf>=0?'pos':'neg')+'">'+money(cf)+'/month</b>'+((sc.incomePct||sc.diningCut||sc.monthlyAdj)?(' (with what-if changes: <b>'+money(adjNet)+'</b>)'):'')+', so over '+ui.fc.horizon+' month(s) you could plausibly set aside about <b class="pos">'+money(savePot)+'</b>.</p>')
    :'<div class="note">Not enough complete-month history to estimate an average cash flow yet.</div>');
  const affordNote=(sc.oneTime>0
    ?('<div class="'+(fc.minBal>=0?'note teal':'alert-inline')+'" style="margin-top:10px">'+I('info',15)+' <span><b>Can I afford it?</b> After the planned purchase of '+money(sc.oneTime)+', your lowest projected balance is '+money(fc.minBal)+'. '+(fc.minBal>=0?'Looks affordable within these assumptions.':'Not affordable within these assumptions \u2014 consider delaying it or reducing the amount.')+'</span></div>')
    :'');
  const evs=fc.events.slice(0,25);
  return '<div class="grid g-2-1">'+
  '<div><div class="panel"><div class="panel-head"><h3>Projected available cash \u2014 '+esc(horLbl)+'</h3><span class="sub">hover the line</span></div><div class="panel-body"><div class="chart-wrap" id="fcChartWrap">'+
    svgLine({labels:fc.labels,series:[{name:'Projected cash',color:'var(--ink)',data:fc.series,area:true}],guide:true,markers:markers,emptyMsg:'No projection available.'})+
  '</div><div class="legend"><span class="li"><span class="sw" style="background:var(--ink)"></span>Projection</span><span class="li"><span class="sw" style="background:var(--ink)"></span>Income</span><span class="li"><span class="sw" style="background:var(--c2)"></span>Bill</span><span class="li"><span class="sw" style="background:var(--c3)"></span>Card billing (no cash out)</span><span class="li"><span class="sw" style="background:var(--c4)"></span>What-if</span></div></div></div>'+
  '<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>How this was calculated</h3></div><div class="panel-body">'+
    (fc.warnings.map(function(w){return '<div class="alert-inline" style="'+(w.level==='danger'?'':'border-style:dashed')+'">'+I('alert',16)+'<span>'+esc(w.text)+'</span></div>';}).join(''))+
    '<ol style="margin:0 0 4px 18px;font-size:13px;line-height:1.9">'+fc.explanations.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol>'+
    '<details class="expl" style="margin-top:10px"><summary>Assumptions & limitations</summary><ol>'+
    '<li>This is a transparent rule-based projection, not an AI model.</li>'+
    '<li>Only recurring schedules and estimated variable spending are projected; recorded transactions are never subtracted twice.</li>'+
    '<li>Purchases billed to a credit card show as card debt, not immediate cash outflows.</li>'+
    '<li>A bill marked paid never appears again as an unpaid outflow.</li></ol></details>'+
  '</div></div></div>'+
  '<div><div class="panel"><div class="panel-head"><h3>Month-by-month</h3></div><div class="panel-body" style="padding-top:4px">'+
    '<div class="table-scroll"><table class="tbl"><thead><tr><th>Month</th><th class="r">Income</th><th class="r">Bills</th><th class="r">Variable</th><th class="r">End</th></tr></thead><tbody>'+
    fc.months.map(function(m,i){return '<tr><td><b>'+MONS[Number(m.k.slice(5))-1]+' '+m.k.slice(0,4)+(i===0?' *':'')+'</b></td><td class="amt pos">'+money0(m.income)+'</td><td class="amt neg">'+money0(m.bills)+'</td><td class="amt neg">'+money0(m.variable)+'</td><td class="amt '+(m.end>=0?'':'neg')+'">'+money0(m.end)+'</td></tr>';}).join('')+
    '</tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:4px">* partial month (from today)</div>'+
    '<div class="kv" style="margin-top:10px"><span class="k">Projected ending cash</span><span class="v '+(fc.projectedEnd>=0?'pos':'neg')+'">'+money(fc.projectedEnd)+'</span></div>'+
    '<div class="kv"><span class="k">Lowest projected balance</span><span class="v '+(fc.minBal>=0?'':'neg')+'">'+money(fc.minBal)+' ('+fmtDShort(fc.minDate)+')</span></div>'+
  '</div></div>'+
  '<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Savings potential</h3></div><div class="panel-body">'+
    cfNote+affordNote+
  '</div></div></div></div>'+
  '<div class="panel"><div class="panel-head"><h3>Expected cash movements</h3></div><div class="table-scroll"><table class="tbl"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th class="r">Amount</th><th class="r">Projected cash after</th></tr></thead><tbody>'+
  (evs.length?evs.map(function(e){
    const badgeType=(e.kind==='income'?'income':e.kind==='bill'?'expense':e.kind==='card'?'cc_payment':'transfer');
    return '<tr><td class="num">'+fmtDate(e.date)+'</td><td><b>'+esc(e.label)+'</b></td><td>'+typeBadge(badgeType)+'</td><td class="amt '+(e.kind==='card'?'':(e.amt>=0?'pos':'neg'))+'">'+(e.kind==='card'?money(e.amt):signed(e.amt))+'</td><td class="amt">'+(fc.balAfter[e.date]!=null?money(fc.balAfter[e.date]):'\u2014')+'</td></tr>';}).join(''):'<tr><td colspan="5"><div class="empty">No scheduled movements in this period. Add salary and bills under Bills & Schedule.</div></td></tr>')+
  '</tbody></table></div></div>';
}
RENDER.forecast=function(){
  const sc=ui.scenario;
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-body">'+
  '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">'+
    '<div class="seg">'+[[1,'Rest of month'],[3,'3 months'],[6,'6 months'],[12,'12 months']].map(function(h){return '<button data-act="fc-horizon" data-h="'+h[0]+'"'+(ui.fc.horizon===h[0]?' class="on"':'')+'>'+h[1]+'</button>';}).join('')+'</div>'+
    '<span class="note" style="flex:1;min-width:220px">Everything after today is an estimate.</span>'+
    '<button class="btn btn-sm" data-act="fc-reset">'+I('refresh',14)+' Reset what-if</button>'+
  '</div>'+
  '<div class="subhead" style="margin-top:16px">What If\u2026 (Doesn\u2019t Change Your Data)</div>'+
  '<div class="sl-row"><label>Income change</label><input type="range" min="-20" max="20" step="5" value="'+sc.incomePct+'" data-inp="fc-income"><span class="slv">'+(sc.incomePct>0?'+':'')+sc.incomePct+'%</span></div>'+
  '<div class="sl-row"><label>Cut Food & Dining by</label><input type="range" min="0" max="50" step="5" value="'+sc.diningCut+'" data-inp="fc-dining"><span class="slv">'+sc.diningCut+'%</span></div>'+
  '<div class="sl-row"><label>Big one-time purchase (\u20b1)</label><input type="number" class="inp" style="width:130px" min="0" step="500" value="'+sc.oneTime+'" data-inp="fc-onetime"><select class="inp" style="width:150px" data-chg="fc-when">'+[[1,'This month'],[2,'Next month'],[3,'In 2 months'],[4,'In 3 months']].map(function(o){return '<option value="'+o[0]+'"'+(sc.oneTimeWhen===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div>'+
  '<div class="sl-row"><label>Extra savings per month (\u20b1)</label><input type="number" class="inp" style="width:130px" step="500" min="0" value="'+sc.monthlyAdj+'" data-inp="fc-monthly"><span class="note" style="flex:1;min-width:180px">Money you plan to put aside each month.</span></div>'+
  '</div></div><div id="fcOut">'+fcOutHTML()+'</div>';
};

/* ---------- Goals ---------- */
RENDER.goals=function(){
  const cf=avgNetCashflow(3);
  const totalT=state.goals.reduce(function(s,g){return s+g.target;},0),totalS=state.goals.reduce(function(s,g){return s+g.saved;},0);
  const today=TODAY();
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Savings goals</h3>'+
  '<span class="sub">'+state.goals.length+' goal(s) \u00b7 '+money(totalS)+' of '+money(totalT)+' saved overall</span>'+
  '<button class="btn btn-sm btn-primary" style="margin-left:auto" data-act="goal-add">'+I('plus',14)+' New goal</button></div></div>'+
  (state.goals.length?state.goals.map(function(g){
    const p=g.target>0?clamp(g.saved/g.target*100,0,100):0;
    const monthsLeft=g.targetDate?Math.max(1,Math.round((parseISO(g.targetDate)-parseISO(today))/(30.44*86400000))):null;
    const need=monthsLeft?round2(Math.max(0,g.target-g.saved)/monthsLeft):null;
    const feasible=(need!=null&&cf!=null)?(need<=Math.max(cf,0)):null;
    const done=g.target>0&&g.saved>=g.target;
    const eta=(g.monthlyContribution>0&&g.target>g.saved)?addMonthsISO(today,Math.ceil((g.target-g.saved)/g.monthlyContribution)):null;
    const etaTxt=done?'Complete \ud83c\udf89':(eta?fmtDate(eta):'Set a monthly amount');
    const feasTxt=done?'<span class="badge b-ok">Reached</span>':(feasible==null?'\u2014':(feasible?'<span class="badge b-ok">Looks achievable</span>':'<span class="badge b-over">Tight / unlikely</span>'));
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-body">'+
    '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">'+
      '<div style="flex:1;min-width:230px"><h3 style="font-size:16px">'+esc(g.name)+'</h3>'+
      '<div style="margin:8px 0 4px"><div class="meter"><div class="meter-fill" style="width:'+p.toFixed(1)+'%"></div></div></div>'+
      '<div class="num" style="font-weight:700;font-size:13.5px">'+money(g.saved)+' of '+money(g.target)+' <span style="color:var(--muted);font-weight:500">('+pctStr(p)+')</span></div>'+
      (g.targetDate?('<div style="font-size:12.5px;color:var(--muted);margin-top:4px">Target date: '+fmtDate(g.targetDate)+(monthsLeft?(' \u00b7 '+monthsLeft+' month(s) left'):'')+'</div>'):'')+
      '</div>'+
      '<div style="min-width:210px;flex:1">'+
      '<div class="kv"><span class="k">Needed per month</span><span class="v">'+(need!=null?money(need):'\u2014')+'</span></div>'+
      '<div class="kv"><span class="k">Your plan</span><span class="v">'+money(g.monthlyContribution)+'/mo</span></div>'+
      '<div class="kv"><span class="k">Done by (at your plan)</span><span class="v">'+etaTxt+'</span></div>'+
      '<div class="kv"><span class="k">Realistic?</span><span class="v">'+feasTxt+'</span></div>'+
      (cf!=null?('<div style="color:var(--muted);font-size:11.5px;margin-top:4px">Avg net cash flow (3 mo): '+money(cf)+'/mo</div>'):'')+
      '</div>'+
      '<div class="split-btns" style="flex-direction:column">'+
        '<button class="btn btn-sm btn-primary" data-act="goal-contrib" data-id="'+esc(g.id)+'">'+I('plus',14)+' Add money</button>'+
        '<button class="btn btn-sm" data-act="goal-edit" data-id="'+esc(g.id)+'">'+I('edit',14)+' Edit</button>'+
        '<button class="btn btn-sm btn-danger" data-act="goal-del" data-id="'+esc(g.id)+'">'+I('trash',14)+' Delete</button>'+
      '</div></div></div></div>';}).join(''):'<div class="panel"><div class="empty">'+I('flag',30)+'<br><b>No savings goals yet.</b><br><button class="btn btn-sm btn-primary" style="margin-top:10px" data-act="goal-add">Create your first goal</button></div></div>')+
  '<div class="note" style="margin-top:16px">\u201cAdd Money\u201d can also record a real transfer between your accounts.</div>';
};

/* ---------- Debt ---------- */
function payoffEstimate(bal,apr,monthly){
  if(!(monthly>0)||bal<=0)return null;
  const r=apr>0?apr/100/12:0;
  if(r>0){if(monthly<=bal*r)return{ok:false,reason:'Payment does not cover the monthly interest.'};
    const n=Math.log(monthly/(monthly-r*bal))/Math.log(1+r);
    return{ok:true,months:Math.ceil(n),interest:round2(monthly*n-bal)};}
  return{ok:true,months:Math.ceil(bal/monthly),interest:0};
}
RENDER.debt=function(){
  const liabs=state.accounts.filter(function(a){return LIABS.includes(a.type)&&!a.archived;});
  const debt=totalDebt();
  const cardD=round2(liabs.filter(function(a){return a.type==='credit';}).reduce(function(s,a){return s+accountBalance(a.id);},0));
  const loanD=round2(liabs.filter(function(a){return a.type==='loan';}).reduce(function(s,a){return s+accountBalance(a.id);},0));
  const cur=monthKey(TODAY());
  const trend=[];for(let i=5;i>=0;i--){const k=monthAdd(cur,-i);
    trend.push({k:k,v:(k===cur?debt:round2(liabs.reduce(function(s,a){return s+accountBalance(a.id,monthEnd(k));},0)))});}
  const upcoming=liabs.filter(function(a){return a.dueDay&&accountBalance(a.id)>0;}).map(function(a){
    let d=cur+'-'+String(clamp(a.dueDay,1,dim(cur))).padStart(2,'0');
    if(d<TODAY())d=monthAdd(cur,1)+'-'+String(clamp(a.dueDay,1,dim(monthAdd(cur,1)))).padStart(2,'0');
    return{a:a,d:d};}).sort(function(x,y){return x.d<y.d?-1:1;});
  const liabCards=(liabs.length?liabs.map(function(a){
    const bal=accountBalance(a.id);
    const pays=state.transactions.filter(function(t){return (t.type==='cc_payment'||t.type==='transfer')&&t.toAccount===a.id;}).sort(function(x,y){return x.date<y.date?1:-1;}).slice(0,5);
    const est=payoffEstimate(bal,a.apr,a.plannedPayment||a.minPayment);
    const estTxt=est?(est.ok?(est.months+' months \u00b7 ~'+money(est.interest)+' interest'):('<span class="neg">'+esc(est.reason)+'</span>')):(bal>0?'Set a planned payment':'\u2014');
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-body">'+
    '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">'+
    '<div style="flex:1;min-width:220px"><h3>'+I(a.type==='credit'?'card':'wallet',16)+' '+esc(a.name)+'</h3>'+
    '<div class="num" style="font-size:24px;font-weight:800;color:'+(bal>0?'var(--red)':'var(--teal)')+'">'+money(Math.abs(bal))+'</div>'+
    '<div style="font-size:12px;color:var(--muted)">'+(bal>0?'outstanding':'fully paid')+' \u00b7 '+ACC_LBL[a.type]+(a.apr?(' \u00b7 APR '+a.apr+'%'):'')+'</div></div>'+
    '<div style="min-width:220px;flex:1">'+
    '<div class="kv"><span class="k">Minimum payment</span><span class="v">'+money(a.minPayment)+(a.dueDay?(' (due day '+a.dueDay+')'):'')+'</span></div>'+
    '<div class="kv"><span class="k">Planned monthly</span><span class="v">'+money(a.plannedPayment)+'</span></div>'+
    '<div class="kv"><span class="k">Payoff estimate</span><span class="v">'+estTxt+'</span></div>'+
    '<div style="color:var(--muted);font-size:11.5px;margin-top:4px">Assumes a fixed monthly payment at the entered APR; your bank\u2019s method may differ.</div>'+
    '</div>'+
    '<div class="split-btns" style="flex-direction:column">'+
    '<button class="btn btn-sm btn-primary" data-act="debt-pay" data-id="'+esc(a.id)+'">'+I('plus',14)+' Record payment</button>'+
    '<button class="btn btn-sm" data-act="acc-hist" data-id="'+esc(a.id)+'">'+I('list',14)+' History</button>'+
    '<button class="btn btn-sm" data-act="acc-edit" data-id="'+esc(a.id)+'">'+I('edit',14)+' Edit</button></div></div>'+
    (pays.length?('<div class="subhead" style="margin-top:12px">Recent payments</div><div class="table-scroll"><table class="tbl"><tbody>'+pays.map(function(p){return '<tr class="rowlink" data-act="txn-view" data-id="'+esc(p.id)+'"><td class="num">'+fmtDate(p.date)+'</td><td>'+esc(p.description)+'</td><td class="amt">'+money(p.amount)+'</td></tr>';}).join('')+'</tbody></table></div>'):'')+
    '</div></div>';}).join(''):'<div class="panel"><div class="empty">'+I('card',30)+'<br><b>No credit cards or loans yet.</b><br><button class="btn btn-sm btn-primary" style="margin-top:10px" data-act="acc-add" data-type="credit">Add a credit card or loan</button></div></div>');
  return debtFreeAndNetIncomeHTML(ui.month)+'<div class="grid g-3" style="margin-top:16px">'+
  '<div class="panel"><div class="panel-head"><h3>Total owed</h3></div><div class="panel-body">'+
  '<div class="kv"><span class="k">Total owed</span><span class="v neg">'+money(debt)+'</span></div>'+
  '<div class="kv"><span class="k">Credit cards</span><span class="v">'+money(cardD)+'</span></div>'+
  '<div class="kv"><span class="k">Loans</span><span class="v">'+money(loanD)+'</span></div>'+
  '<div class="kv"><span class="k">Net position (cash \u2212 debt)</span><span class="v '+(availableCash()-debt>=0?'pos':'neg')+'">'+money(availableCash()-debt)+'</span></div>'+
  '</div></div>'+
  '<div class="panel"><div class="panel-head"><h3>Debt trend \u2014 6 months</h3></div><div class="panel-body">'+
  svgLine({labels:trend.map(function(t){return MONS[Number(t.k.slice(5))-1];}),series:[{name:'Total debt',color:'var(--ink)',data:trend.map(function(t){return t.v;})}],emptyMsg:'No liabilities registered.'})+
  '</div></div>'+
  '<div class="panel"><div class="panel-head"><h3>Upcoming payments</h3></div><div class="panel-body" style="padding-top:4px">'+
  (upcoming.length?upcoming.map(function(u){return '<div class="kv"><span class="k">'+esc(u.a.name)+' \u00b7 '+fmtDShort(u.d)+'</span><span class="v">'+(u.a.plannedPayment>0?('plan '+money(u.a.plannedPayment)):('min '+money(u.a.minPayment)))+'</span></div>';}).join(''):'<div class="note">No payment dates set. Add a due day when editing a card or loan.</div>')+
  '</div></div></div>'+liabCards;
};

/* ---------- Bills ---------- */
const FREQ_LBL={weekly:'Weekly',biweekly:'Every 2 weeks',monthly:'Monthly',quarterly:'Quarterly',annually:'Annually'};
RENDER.bills=function(){
  const recs=state.recurring.slice().sort(function(a,b){return (a.nextDue||'9999')<(b.nextDue||'9999')?-1:1;});
  const soon=dueSoon(7);
  const soonTot=round2(soon.filter(function(e){return e.r.type==='expense';}).reduce(function(s,e){return s+e.r.amount;},0));
  const posted=state.transactions.filter(function(t){return t.recurringId;}).sort(function(a,b){return a.date<b.date?1:-1;}).slice(0,10);
  return '<div class="grid g-3">'+
  '<div class="panel"><div class="panel-head"><h3>Due in the next 7 days</h3></div><div class="panel-body"><div class="kv"><span class="k">Total outgoing</span><span class="v neg">'+money(soonTot)+'</span></div><div class="kv"><span class="k">Bills</span><span class="v">'+soon.filter(function(e){return e.r.type==='expense';}).length+'</span></div><div class="kv"><span class="k">Overdue (unpaid)</span><span class="v '+(overdueBills().length?'neg':'')+'">'+overdueBills().length+'</span></div></div></div>'+
  '<div class="panel span-2"><div class="panel-head"><h3>How It Works</h3></div><div class="panel-body"><div class="note">\u201cMark Paid\u201d records the payment and moves to the next date. \u201cSkip\u201d moves on without recording anything.</div></div></div>'+
  '</div>'+
  '<div class="panel"><div class="panel-head"><h3>Recurring entries</h3><button class="btn btn-sm btn-primary" style="margin-left:auto" data-act="rec-add">'+I('plus',14)+' New schedule</button></div>'+
  '<div class="table-scroll"><table class="tbl"><thead><tr><th>Description</th><th>Type</th><th>Category</th><th>Account</th><th>Frequency</th><th class="r">Amount</th><th>Next due</th><th>Status</th><th></th></tr></thead><tbody>'+
  (recs.length?recs.map(function(r){
    const od=r.status==='active'&&r.nextDue&&r.nextDue<TODAY();
    const ended=r.endDate&&r.nextDue&&r.nextDue>r.endDate;
    const dueCell=ended?'<span class="badge b-mut">ended</span>':(r.nextDue?(fmtDate(r.nextDue)+(od?' <span class="badge b-over">overdue</span>':(' <span style="font-size:11px;color:var(--muted)">(in '+relDays(r.nextDue)+'d)</span>'))):'\u2014');
    return '<tr><td><b>'+esc(r.description)+'</b>'+(r.endDate?('<div style="font-size:11px;color:var(--muted)">until '+fmtDate(r.endDate)+'</div>'):'')+'</td>'+
    '<td>'+typeBadge(r.type)+'</td><td><span class="cat-chip">'+esc(r.category)+'</span></td><td style="color:var(--muted)">'+esc(acctName(r.account)||'\u2014')+'</td><td style="font-size:12.5px">'+FREQ_LBL[r.freq]+'</td><td class="amt">'+money(r.amount)+'</td>'+
    '<td class="num">'+dueCell+'</td>'+
    '<td><span class="badge '+(r.status==='active'?'b-ok':'b-mut')+'">'+(r.status==='active'?'Active':'Paused')+'</span></td>'+
    '<td><span class="split-btns" style="flex-wrap:nowrap">'+
    (ended?'':'<button class="btn btn-sm '+(od?'btn-danger':'btn-primary')+'" data-act="rec-paid" data-id="'+esc(r.id)+'">'+(r.type==='income'?'Received':'Mark paid')+'</button>'+
    '<button class="icon-btn" data-act="rec-skip" data-id="'+esc(r.id)+'" title="Skip this occurrence">'+I('skip',15)+'</button>')+
    '<button class="icon-btn" data-act="rec-toggle" data-id="'+esc(r.id)+'" title="'+(r.status==='active'?'Pause':'Resume')+'">'+I(r.status==='active'?'pause':'play',15)+'</button>'+
    '<button class="icon-btn" data-act="rec-edit" data-id="'+esc(r.id)+'" title="Edit">'+I('edit',15)+'</button>'+
    '<button class="icon-btn danger" data-act="rec-del" data-id="'+esc(r.id)+'" title="Delete">'+I('trash',15)+'</button></span></td></tr>';}).join(''):'<tr><td colspan="9"><div class="empty">'+I('cal',30)+'<br><b>No recurring entries yet.</b><br><button class="btn btn-sm btn-primary" style="margin-top:10px" data-act="rec-add">Add salary, rent, subscriptions\u2026</button></div></td></tr>')+
  '</tbody></table></div></div>'+
  (posted.length?('<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Recent schedule history</h3></div><div class="table-scroll"><table class="tbl"><tbody>'+posted.map(function(t){return '<tr class="rowlink" data-act="txn-view" data-id="'+esc(t.id)+'"><td class="num">'+fmtDate(t.date)+'</td><td>'+esc(t.description)+'</td><td>'+typeBadge(t.type)+'</td><td class="amt">'+amtCell(t)+'</td></tr>';}).join('')+'</tbody></table></div></div>'):'');
};

/* ---------- Accounts ---------- */
RENDER.accounts=function(){
  const assets=state.accounts.filter(function(a){return ASSETS.includes(a.type);});
  const liabs=state.accounts.filter(function(a){return LIABS.includes(a.type);});
  const cash=availableCash(),debt=totalDebt();
  const cur=monthKey(TODAY());
  const accCard=function(a){
    const bal=accountBalance(a.id);
    const n=state.transactions.filter(function(t){return t.fromAccount===a.id||t.toAccount===a.id;}).length;
    const trend=[];for(let i=5;i>=0;i--){const k=monthAdd(cur,-i);trend.push(k===cur?bal:accountBalance(a.id,monthEnd(k)));}
    const balCol=isLiab(a)?(bal>0?'var(--red)':'var(--teal)'):(bal>=0?'var(--ink)':'var(--red)');
    const balLbl=isLiab(a)?(bal>0?'owed':'nothing owed'):(bal>=0?'available':'negative balance');
    return '<div class="panel" style="margin-bottom:12px'+(a.archived?';opacity:.65':'')+'"><div class="panel-body" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">'+
    '<div style="flex:1;min-width:180px"><h3>'+esc(a.name)+(a.archived?' <span class="badge b-mut">archived</span>':'')+'</h3>'+
    '<div style="font-size:12px;color:var(--muted)">'+ACC_LBL[a.type]+' \u00b7 opened '+fmtDate(a.openingDate)+' \u00b7 '+n+' transaction(s)'+(a.notes?(' \u00b7 '+esc(a.notes)):'')+'</div></div>'+
    '<div style="text-align:right;min-width:150px"><div class="num" style="font-size:22px;font-weight:800;color:'+balCol+'">'+money(Math.abs(bal))+'</div>'+
    '<div style="font-size:11.5px;color:var(--muted)">'+balLbl+'</div></div>'+
    '<div style="text-align:center">'+sparkline(trend,isLiab(a)?'var(--c3)':'var(--ink)')+'<div style="font-size:10.5px;color:var(--muted)">6-mo trend</div></div>'+
    '<div class="split-btns">'+
    '<button class="btn btn-sm" data-act="acc-hist" data-id="'+esc(a.id)+'">'+I('list',14)+' History</button>'+
    '<button class="btn btn-sm" data-act="acc-recon" data-id="'+esc(a.id)+'">'+I('check',14)+' Reconcile</button>'+
    '<button class="btn btn-sm" data-act="acc-edit" data-id="'+esc(a.id)+'">'+I('edit',14)+' Edit</button>'+
    '<button class="btn btn-sm" data-act="acc-arch" data-id="'+esc(a.id)+'">'+(a.archived?'Restore':'Archive')+'</button>'+
    (n===0?'<button class="icon-btn danger" data-act="acc-del" data-id="'+esc(a.id)+'" title="Delete (no transactions)">'+I('trash',15)+'</button>':'')+
    '</div></div></div>';};
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-body"><div class="statrail">'+
  '<div class="stat"><div class="lb">Available cash & deposits</div><div class="vl num pos">'+money(cash)+'</div></div>'+
  '<div class="stat"><div class="lb">of which savings</div><div class="vl num">'+money(round2(assets.filter(function(a){return a.type==='savings'&&!a.archived;}).reduce(function(s,a){return s+accountBalance(a.id);},0)))+'</div></div>'+
  '<div class="stat"><div class="lb">Credit card debt</div><div class="vl num neg">'+money(round2(liabs.filter(function(a){return a.type==='credit'&&!a.archived;}).reduce(function(s,a){return s+accountBalance(a.id);},0)))+'</div></div>'+
  '<div class="stat"><div class="lb">Loans</div><div class="vl num neg">'+money(round2(liabs.filter(function(a){return a.type==='loan'&&!a.archived;}).reduce(function(s,a){return s+accountBalance(a.id);},0)))+'</div></div>'+
  '<div class="stat"><div class="lb">Net position</div><div class="vl num '+(cash-debt>=0?'pos':'neg')+'">'+money(cash-debt)+'</div></div>'+
  '</div></div></div>'+
  (assets.length?('<div class="subhead" style="margin:18px 4px 10px">Assets</div>'+assets.map(accCard).join('')):'')+
  (liabs.length?('<div class="subhead" style="margin:18px 4px 10px">Liabilities</div>'+liabs.map(accCard).join('')):'')+
  (!state.accounts.length?'<div class="panel" style="margin-bottom:12px"><div class="empty">'+I('wallet',30)+'<br><b>No accounts yet.</b><br>Start with your bank, cash wallet or GCash.</div></div>':'')+
  '<button class="btn btn-primary" data-act="acc-add">'+I('plus',15)+' Add account</button>'+
  '<div class="note" style="margin-top:14px">Balance = starting balance + every transaction. Use \u201cReconcile\u201d to match your bank statement.</div>';
};

/* ---------- Settings ---------- */
function ordinal(n){const v=n%100;return n+((v>10&&v<14)?'th':(['th','st','nd','rd'][n%10]||'th'));}
RENDER.settings=function(){
  const s=state.settings;
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Appearance</h3></div><div class="panel-body">'+
    '<div class="field" style="margin:0"><label>Color Theme</label><div class="seg theme-seg" role="radiogroup" aria-label="Color theme">'+[['light','sun','Light'],['dark','moon','Dark'],['auto','auto','Auto']].map(function(o){return '<button role="radio" aria-checked="'+(s.theme===o[0])+'" data-act="set-theme" data-v="'+o[0]+'"'+(s.theme===o[0]?' class="on"':'')+'>'+I(o[1],16)+' '+o[2]+'</button>';}).join('')+'</div>'+
    '<div class="hint">Auto follows your phone or computer.</div></div>'+
  '</div></div>'+
  installPanelHTML()+
  '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Budget Plan</h3>'+(hasPlan()?'<span class="badge b-ok" style="margin-left:auto">'+[state.plan.split.needs,state.plan.split.wants,state.plan.split.savings].join(' / ')+'</span>':'')+'</div><div class="panel-body">'+
    (hasPlan()?'<p class="pin-txt">'+money0(state.plan.income)+' a month, paid '+PAYDAY_LBL[state.plan.payday].replace('Once, on','on').toLowerCase()+'. Change your income, split or categories anytime.</p><button class="btn" data-act="plan-edit">'+I('edit',15)+' Edit My Plan</button>'
      :'<p class="pin-txt">Split your income into Needs, Wants and Savings. Budgets and goals fill in for you.</p><button class="btn btn-primary" data-act="plan-setup">'+I('sparkle',15)+' Set Up My Plan</button>')+'</div></div>'+
  pinPanelHTML()+
  syncPanelHTML()+
  '<div class="grid g-2">'+
  '<div class="panel"><div class="panel-head"><h3>Preferences</h3></div><div class="panel-body">'+
    '<div class="field"><label>Currency</label><select class="inp" disabled><option>Philippine Peso (PHP \u20b1)</option></select></div>'+
    '<div class="field"><label>Date format</label><select class="inp" data-chg="set-datefmt">'+['MMM d, yyyy','dd MMM yyyy','yyyy-MM-dd','MM/dd/yyyy'].map(function(f){return '<option'+(s.dateFormat===f?' selected':'')+'>'+f+'</option>';}).join('')+'</select></div>'+
    '<div class="field"><label for="setPsd">Budget month starts on</label><select class="inp" id="setPsd" data-chg="set-psd">'+
      Array.from({length:28},function(_,i){const n=i+1;return '<option value="'+n+'"'+(s.monthStartDay===n?' selected':'')+'>'+(n===1?'1st (calendar month)':ordinal(n)+' of the month')+'</option>';}).join('')+'</select>'+
      '<div class="hint">Set this to your payday. With the 15th, November runs '+fmtDShort('2026-11-15')+' \u2013 '+fmtDShort('2026-12-14')+'.</div></div>'+
    '<div class="fgrid">'+
    '<div class="field"><label>Budget warning at (%)</label><input type="number" class="inp" min="1" max="100" value="'+s.warnThreshold+'" data-chg="set-warn"></div>'+
    '<div class="field"><label>Budget exceeded at (%)</label><input type="number" class="inp" min="1" max="200" value="'+s.dangerThreshold+'" data-chg="set-danger"></div></div>'+
    (state.dismissed.length?'<button class="btn btn-sm" data-act="ins-restore">'+I('refresh',14)+' Show '+state.dismissed.length+' dismissed alerts again</button>':'')+
  '</div></div>'+
  '<div class="panel"><div class="panel-head"><h3>Categories</h3></div><div class="panel-body">'+
    '<div class="subhead">Expense (tap a name to switch Needs / Wants)</div>'+
    s.expenseCats.map(function(c){return '<div class="kv"><span class="k" style="cursor:pointer" data-act="cat-toggle" data-cat="'+esc(c.name)+'">'+esc(c.name)+(c.essential?' <span class="badge b-ok">Needs</span>':' <span class="badge b-mut">Wants</span>')+'</span>'+
    '<span class="v"><button class="icon-btn danger" data-act="cat-del" data-cat="'+esc(c.name)+'" title="Delete category">'+I('trash',14)+'</button></span></div>';}).join('')+
    '<div class="field" style="margin-top:12px"><label>Add category</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="inp" id="newCatName" placeholder="e.g. Pets" style="flex:1;min-width:120px"><select class="inp" id="newCatKind" style="width:120px"><option value="expense">Expense</option><option value="income">Income</option></select><label class="check"><input type="checkbox" id="newCatEss"> Essential</label><button class="btn btn-teal btn-sm" data-act="cat-add">Add</button></div></div>'+
    '<div class="subhead">Income</div>'+s.incomeCats.map(function(c){return '<span class="cat-chip" style="margin:2px 4px 2px 0;padding:3px 9px;display:inline-flex;align-items:center">'+esc(c)+' <button class="icon-btn" style="width:20px;height:20px" data-act="cat-del" data-cat="'+esc(c)+'">'+I('x',11)+'</button></span>';}).join('')+
  '</div></div>'+
  '</div>'+
  '<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Backup, import & reset</h3></div><div class="panel-body">'+
  '<div class="grid g-2" style="margin-bottom:4px">'+
  '<div><div class="subhead">Export</div>'+
  '<div class="split-btns"><button class="btn" data-act="set-export-csv">'+I('dl',15)+' Transactions CSV</button>'+
  '<button class="btn" data-act="set-export-json">'+I('dl',15)+' Full backup (JSON)</button></div></div>'+
  '<div><div class="subhead">Import</div>'+
  '<div class="split-btns">'+
  '<label class="btn" style="cursor:pointer">'+I('ul',15)+' Add transactions from CSV<input type="file" accept=".csv,text/csv" hidden data-chg="import-csv"></label>'+
  '<label class="btn" style="cursor:pointer">'+I('ul',15)+' Restore backup (JSON)<input type="file" accept=".json,application/json" hidden data-chg="import-json"></label></div>'+
  '<div class="note" style="margin-top:10px">CSV import <b>adds</b> rows after a preview. JSON restore <b>replaces everything</b> (including your Google Sheet) after confirmation.</div></div>'+
  '</div>'+
  '<div class="subhead" style="margin-top:8px">Reset</div>'+
  '<div class="split-btns"><button class="btn" data-act="set-reset-demo">'+I('refresh',15)+' Reset to demo data</button>'+
  '<button class="btn btn-danger" data-act="set-wipe">'+I('trash',15)+' Erase everything</button></div>'+
  (Sync.url?'<div class="note orange" style="margin-top:10px">These also change your Google Sheet.</div>':'')+
  '</div></div>'+
  '<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Good To Know</h3></div><div class="panel-body"><div class="note">No bank connections or shared logins. Keep your app link private: anyone with it can see your data.</div></div></div>';
};

