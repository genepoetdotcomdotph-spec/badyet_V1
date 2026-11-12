/* ================= FORMS & MODALS ================= */
function accOptions(list,sel){
  return list.map(function(a){return '<option value="'+esc(a.id)+'"'+(a.id===sel?' selected':'')+'>'+esc(a.name)+' ('+ACC_LBL[a.type]+')</option>';}).join('');
}
function openTxnModal(t,pref){
  pref=pref||{};
  const isNew=!t;
  t=t?Object.assign({},t):{date:pref.date||TODAY(),type:pref.type||'expense',description:'',amount:'',category:'',fromAccount:pref.fromAccount||'',toAccount:pref.toAccount||'',method:'',notes:'',tags:[],recurringId:pref.recurringId||null,refundOf:pref.refundOf||null};
  if(pref.category)t.category=pref.category;
  if(pref.description)t.description=pref.description;
  if(pref.amount!==undefined&&pref.amount!=='')t.amount=pref.amount;
  if(!state.accounts.filter(function(a){return !a.archived;}).length){
    openModal({title:'Add an account first',body:'<p style="font-size:14px">Every transaction belongs to an account (for example your bank, cash wallet or GCash). Add one first, then come back.</p>',
      foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" data-act="acc-add">'+I('plus',15)+' Add account</button>'});
    return;
  }
  const recentExp=state.transactions.filter(function(x){return x.type==='expense'&&x.date>=addDaysISO(TODAY(),-120);}).slice(-30).reverse();
  const rec=t.recurringId?state.recurring.find(function(r){return r.id===t.recurringId;}):null;
  openModal({title:isNew?(rec?(rec.type==='income'?'Record income received':'Record bill payment'):'Add transaction'):'Edit transaction',body:
  '<form id="fTxn" novalidate><div class="form-err" id="fTxnErr"></div>'+
  (rec&&isNew?'<div class="note teal" style="margin-bottom:12px">Linked to schedule \u201c'+esc(rec.description)+'\u201d. Saving moves its next due date forward.</div>':'')+
  '<div class="fgrid">'+
  '<div class="field"><label>Type</label><select class="inp" id="tType">'+Object.keys(TYPE_LBL).map(function(x){return '<option value="'+x+'"'+(t.type===x?' selected':'')+'>'+TYPE_LBL[x]+'</option>';}).join('')+'</select></div>'+
  '<div class="field"><label>Date</label><input type="date" class="inp" id="tDate" value="'+esc(t.date)+'" required></div>'+
  '</div>'+
  '<div class="field"><label>Description / merchant</label><input class="inp" id="tDesc" value="'+esc(t.description)+'" placeholder="e.g. Puregold, Meralco, Salary" list="descList" autocomplete="off"><datalist id="descList">'+
    Array.from(new Set(state.transactions.slice(-200).map(function(x){return x.description;}))).slice(0,60).map(function(d){return '<option value="'+esc(d)+'">';}).join('')+'</datalist><div class="mem-hint" id="tMem"></div></div>'+
  '<div class="fgrid">'+
  '<div class="field"><label>Amount (\u20b1)</label><input type="number" class="inp" id="tAmt" min="0.01" step="0.01" value="'+esc(t.amount||'')+'" placeholder="0.00" inputmode="decimal"></div>'+
  '<div class="field" id="fCat"><label>Category</label><select class="inp" id="tCat"></select></div>'+
  '</div>'+
  '<div class="fgrid">'+
  '<div class="field" id="fFrom"><label id="lFrom">From account</label><select class="inp" id="tFrom"></select></div>'+
  '<div class="field" id="fTo"><label id="lTo">To account</label><select class="inp" id="tTo"></select></div>'+
  '</div>'+
  '<div id="fRefOf" class="field" style="display:none"><label>Refund of (optional)</label><select class="inp" id="tRefOf"><option value="">\u2014 none \u2014</option>'+recentExp.map(function(x){return '<option value="'+esc(x.id)+'"'+(t.refundOf===x.id?' selected':'')+'>'+esc(fmtDate(x.date)+' \u00b7 '+x.description+' \u00b7 '+money(x.amount))+'</option>';}).join('')+'</select></div>'+
  '<div class="fgrid">'+
  '<div class="field"><label>Payment method (optional)</label><select class="inp" id="tMethod"><option value=""></option>'+['Cash','Debit Card','Credit Card','Bank Transfer','E-Wallet','Autopay','ATM','Other'].map(function(m){return '<option'+(t.method===m?' selected':'')+'>'+m+'</option>';}).join('')+'</select></div>'+
  '<div class="field"><label>Tags (optional, separate with ;)</label><input class="inp" id="tTags" value="'+esc(Array.isArray(t.tags)?t.tags.join('; '):'')+'" placeholder="work; reimbursable"></div>'+
  '</div>'+
  '<div class="field"><label>Notes (optional)</label><textarea class="inp" id="tNotes">'+esc(t.notes||'')+'</textarea></div>'+
  '<div class="note" id="tHelp"></div>'+
  '</form>',
  foot:(isNew?'':'<button class="btn btn-danger" data-act="txn-del" data-id="'+esc(t.id)+'" style="margin-right:auto">'+I('trash',15)+' Delete</button>')+'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="tSave">'+(isNew?'Add transaction':'Save changes')+'</button>',
  onMount:function(){
    const HELP={income:'Money coming in (salary, freelance\u2026). Counts as income.',expense:'Money going out. Paid with a credit card? Pick the card \u2014 it adds to what you owe.',transfer:'Moving your own money between accounts (e.g. bank \u2192 GCash). Not income or expense.',cc_payment:'Paying off a credit card or loan from a cash account. Reduces debt; not counted as a new expense.',refund:'Money returned to you. Reduces spending in that category.'};
    const draw=function(){
      const type=$('#tType').value;
      const cats=type==='income'?state.settings.incomeCats:state.settings.expenseCats.map(function(c){return c.name;});
      const curCat=$('#tCat').value||t.category;
      $('#tCat').innerHTML=cats.map(function(c){return '<option value="'+esc(c)+'"'+(c===curCat?' selected':'')+'>'+esc(c)+'</option>';}).join('');
      $('#fCat').style.display=(type==='transfer'||type==='cc_payment')?'none':'';
      $('#fRefOf').style.display=type==='refund'?'':'none';
      const live=state.accounts.filter(function(a){return !a.archived||a.id===t.fromAccount||a.id===t.toAccount;});
      const assetL=live.filter(function(a){return ASSETS.includes(a.type);});
      const curFrom=$('#tFrom').value||t.fromAccount,curTo=$('#tTo').value||t.toAccount;
      let fromList='',toList='',lF='From account',lT='To account',showF=true,showT=true;
      if(type==='income'){showF=false;lT='Deposit to';toList=accOptions(assetL,curTo);}
      else if(type==='expense'){lF='Paid with';fromList=accOptions(live.filter(function(a){return ASSETS.includes(a.type)||a.type==='credit';}),curFrom);showT=false;}
      else if(type==='refund'){showF=false;lT='Money returns to';toList=accOptions(live.filter(function(a){return ASSETS.includes(a.type)||a.type==='credit';}),curTo);}
      else if(type==='transfer'){fromList=accOptions(assetL,curFrom);toList=accOptions(live,curTo);}
      else{lF='Pay from (cash account)';fromList=accOptions(assetL,curFrom);lT='Card / loan being paid';toList=accOptions(live.filter(function(a){return LIABS.includes(a.type);}),curTo);}
      $('#fFrom').style.display=showF?'':'none';$('#fTo').style.display=showT?'':'none';
      $('#tFrom').innerHTML='<option value="">\u2014 select \u2014</option>'+fromList;
      $('#tTo').innerHTML='<option value="">\u2014 select \u2014</option>'+toList;
      $('#lFrom').textContent=lF;$('#lTo').textContent=lT;
      $('#tHelp').textContent=HELP[type];
    };
    $('#tType').addEventListener('change',draw);
    draw();
    /* Category memory: same description as before -> same category and account. */
    let catTouched=!isNew,accTouched=!isNew||!!(pref.fromAccount||pref.toAccount);
    $('#tCat').addEventListener('change',function(){catTouched=true;});
    $('#tFrom').addEventListener('change',function(){accTouched=true;});
    $('#tTo').addEventListener('change',function(){accTouched=true;});
    const recall=function(){
      const type=$('#tType').value,m=recallFor($('#tDesc').value,type),hint=$('#tMem');
      if(!m){hint.textContent='';return;}
      const got=[];
      if(!catTouched&&m.category&&Array.from($('#tCat').options).some(function(o){return o.value===m.category;})){$('#tCat').value=m.category;got.push(m.category);}
      const sel=(type==='income'||type==='refund')?$('#tTo'):$('#tFrom');
      if(!accTouched&&m.account&&Array.from(sel.options).some(function(o){return o.value===m.account;})){sel.value=m.account;got.push(acctName(m.account));}
      hint.innerHTML=got.length?I('sparkle',13)+' Remembered: '+esc(got.join(' \u00b7 ')):'';
    };
    $('#tDesc').addEventListener('input',recall);$('#tDesc').addEventListener('change',recall);
    $('#fTxn').addEventListener('submit',function(e){e.preventDefault();$('#tSave').click();});
    $('#tSave').addEventListener('click',function(){
      const type=$('#tType').value,date=$('#tDate').value,desc=$('#tDesc').value.trim();
      const amount=round2(parseFloat($('#tAmt').value));
      const cat=$('#tCat').value||'Other',from=$('#tFrom').value||null,to=$('#tTo').value||null;
      const errs=[];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date))errs.push('Pick a date.');
      if(!desc)errs.push('Type a description or merchant.');
      if(!isFinite(amount)||amount<=0)errs.push('Amount must be more than zero.');
      if(amount>1e12)errs.push('That amount looks too large.');
      const fa=accountById(from),ta=accountById(to);
      if(type==='income'&&(!ta||!ASSETS.includes(ta.type)))errs.push('Choose which account the money went into.');
      if(type==='expense'&&!fa)errs.push('Choose the account or card used.');
      if(type==='refund'&&!ta)errs.push('Choose the account the money returns to.');
      if(type==='transfer'){
        if(!fa||!ASSETS.includes(fa.type))errs.push('Choose the account the money comes from.');
        if(!ta)errs.push('Choose the account the money goes to.');
        if(from&&from===to)errs.push('From and To must be different accounts.');
      }
      if(type==='cc_payment'){
        if(!fa||!ASSETS.includes(fa.type))errs.push('Choose the cash account you paid from.');
        if(!ta||!LIABS.includes(ta.type))errs.push('Choose the card or loan being paid.');
      }
      const errEl=$('#fTxnErr');
      if(errs.length){errEl.innerHTML=errs.map(esc).join('<br>');errEl.classList.add('show');return;}
      errEl.classList.remove('show');
      const tags=$('#tTags').value.split(';').map(function(x){return x.trim();}).filter(Boolean);
      const recId=t.recurringId||null;
      const obj={id:t.id||uid('TXN'),date:date,type:type,description:desc,amount:amount,
        category:(type==='transfer'||type==='cc_payment')?'':cat,
        fromAccount:(type==='income'||type==='refund')?null:from,
        toAccount:(type==='expense')?null:to,
        method:$('#tMethod').value,notes:$('#tNotes').value.trim(),tags:tags,
        refundOf:(type==='refund'?($('#tRefOf').value||null):null),recurringId:recId};
      mutate(function(){
        if(isNew)state.transactions.push(obj);
        else{const i=state.transactions.findIndex(function(x){return x.id===obj.id;});if(i>=0)state.transactions[i]=obj;else state.transactions.push(obj);}
        if(recId&&isNew){const r=state.recurring.find(function(x){return x.id===recId;});if(r)advanceRecurring(r,obj.date);}
      });
      closeModal();
      toast((isNew?'Added':'Updated')+' \u201c'+desc+'\u201d ('+money(amount)+')','ok');
    });
  }});
}
function openTxnDetail(id){
  const t=state.transactions.find(function(x){return x.id===id;});if(!t)return;
  const orig=t.refundOf?state.transactions.find(function(x){return x.id===t.refundOf;}):null;
  const rec=t.recurringId?state.recurring.find(function(r){return r.id===t.recurringId;}):null;
  const rows=[['Date',fmtDate(t.date)],['Type',TYPE_LBL[t.type]],['Description',t.description],['Amount',money(t.amount)],['Category',t.category||'\u2014'],
  ['From',acctName(t.fromAccount)||'\u2014'],['To',acctName(t.toAccount)||'\u2014'],['Method',t.method||'\u2014'],
  ['Tags',t.tags.join(', ')||'\u2014'],['Notes',t.notes||'\u2014'],
  ['Linked schedule',rec?rec.description:'\u2014'],
  ['Refund of',orig?(fmtDate(orig.date)+' \u00b7 '+orig.description+' \u00b7 '+money(orig.amount)):'\u2014']];
  openModal({title:'Transaction detail',body:'<dl class="dl">'+rows.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>';}).join('')+'</dl>',
  foot:'<button class="btn btn-danger" data-act="txn-del" data-id="'+esc(t.id)+'">'+I('trash',15)+' Delete</button>'+
  (t.type==='expense'?('<button class="btn" data-act="txn-refund" data-id="'+esc(t.id)+'">Record refund</button>'):'')+
  '<button class="btn" data-act="txn-dup" data-id="'+esc(t.id)+'">'+I('copy',15)+' Duplicate</button>'+
  '<span style="flex:1"></span><button class="btn" data-act="modal-close">Close</button><button class="btn btn-primary" data-act="txn-edit" data-id="'+esc(t.id)+'">'+I('edit',15)+' Edit</button>'});
}
function openAccountModal(a,preType){
  const isNew=!a;
  a=a||{name:'',type:preType||'bank',openingBalance:'',openingDate:TODAY(),notes:'',archived:false,apr:'',minPayment:'',dueDay:'',plannedPayment:''};
  const isL=LIABS.includes(a.type);
  openModal({title:isNew?'Add account':'Edit account',body:
  '<form id="fAcc" novalidate><div class="form-err" id="fAccErr"></div>'+
  '<div class="fgrid"><div class="field"><label>Account name</label><input class="inp" id="aName" value="'+esc(a.name)+'" placeholder="e.g. BPI Payroll"></div>'+
  '<div class="field"><label>Type</label><select class="inp" id="aType">'+['cash','bank','ewallet','savings','credit','loan'].map(function(x){return '<option value="'+x+'"'+(a.type===x?' selected':'')+'>'+ACC_LBL[x]+'</option>';}).join('')+'</select></div>'+
  '<div class="field"><label id="aOpenLbl">'+(isL?'Amount owed at start':'Starting balance')+'</label><input type="number" step="0.01" class="inp" id="aOpen" value="'+esc(a.openingBalance)+'" placeholder="0.00"></div>'+
  '<div class="field"><label>As of date</label><input type="date" class="inp" id="aDate" value="'+esc(a.openingDate)+'"></div></div>'+
  '<div id="liabFields" style="display:'+(isL?'':'none')+'"><div class="subhead">Card / loan details (optional)</div><div class="fgrid">'+
  '<div class="field"><label>Interest rate (APR %)</label><input type="number" step="0.01" min="0" class="inp" id="aApr" value="'+(a.apr==null?'':esc(a.apr))+'"></div>'+
  '<div class="field"><label>Minimum payment</label><input type="number" step="0.01" min="0" class="inp" id="aMin" value="'+(a.minPayment||'')+'"></div>'+
  '<div class="field"><label>Payment due day (1\u201331)</label><input type="number" min="1" max="31" class="inp" id="aDue" value="'+(a.dueDay||'')+'"></div>'+
  '<div class="field"><label>Planned monthly payment</label><input type="number" step="0.01" min="0" class="inp" id="aPlan" value="'+(a.plannedPayment||'')+'"></div></div></div>'+
  '<div class="field"><label>Notes</label><input class="inp" id="aNotes" value="'+esc(a.notes||'')+'"></div>'+
  (isNew?'':'<label class="check"><input type="checkbox" id="aArch"'+(a.archived?' checked':'')+'> Archived (hidden from totals; history kept)</label>')+
  '</form>',
  foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="aSave">Save account</button>',
  onMount:function(){
    $('#aType').addEventListener('change',function(){const l=LIABS.includes($('#aType').value);$('#liabFields').style.display=l?'':'none';$('#aOpenLbl').textContent=l?'Amount owed at start':'Starting balance';});
    $('#fAcc').addEventListener('submit',function(e){e.preventDefault();$('#aSave').click();});
    $('#aSave').addEventListener('click',function(){
      const name=$('#aName').value.trim(),type=$('#aType').value;
      const open=round2(parseFloat($('#aOpen').value)||0);
      const errs=[];
      if(!name)errs.push('Give the account a name.');
      if($('#aOpen').value!==''&&!isFinite(parseFloat($('#aOpen').value)))errs.push('Starting balance must be a number.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test($('#aDate').value))errs.push('Pick a valid date.');
      if(state.accounts.some(function(x){return x.name.toLowerCase()===name.toLowerCase()&&x.id!==a.id;}))errs.push('You already have an account with this name.');
      const errEl=$('#fAccErr');
      if(errs.length){errEl.innerHTML=errs.map(esc).join('<br>');errEl.classList.add('show');return;}
      errEl.classList.remove('show');
      mutate(function(){
        const obj={id:a.id||uid('ACC'),name:name,type:type,openingBalance:open,openingDate:$('#aDate').value,notes:$('#aNotes').value.trim(),
          archived:(!isNew&&$('#aArch')&&$('#aArch').checked),
          apr:($('#aApr').value===''?null:parseFloat($('#aApr').value)||0),
          minPayment:parseFloat($('#aMin').value)||0,
          dueDay:clamp(parseInt($('#aDue').value,10)||0,0,31)||null,
          plannedPayment:parseFloat($('#aPlan').value)||0};
        if(isNew)state.accounts.push(obj);
        else{const i=state.accounts.findIndex(function(x){return x.id===obj.id;});if(i>=0)state.accounts[i]=obj;}
      });
      closeModal();toast('Account \u201c'+name+'\u201d saved.','ok');
    });
  }});
}
function openBudgetModal(b,preCat){
  const isNew=!b;
  b=b||{month:ui.month,category:preCat||'',amount:'',scope:'monthly',rollover:false};
  const spentHint=b.category&&b.category!=='__total__'?(netSpendByCat(monthTxns(b.month))[b.category]||0):null;
  openModal({title:isNew?'Add budget':'Edit budget',body:
  '<form id="fBud" novalidate><div class="form-err" id="fBudErr"></div>'+
  '<div class="fgrid"><div class="field"><label>Month</label><input type="month" class="inp" id="bMonth" value="'+esc(b.month)+'"></div>'+
  '<div class="field"><label>Period</label><select class="inp" id="bScope"><option value="monthly"'+(b.scope==='monthly'?' selected':'')+'>Monthly</option><option value="weekly"'+(b.scope==='weekly'?' selected':'')+'>Weekly</option></select></div></div>'+
  '<div class="field"><label>Category</label><select class="inp" id="bCat"><option value="__total__"'+(b.category==='__total__'?' selected':'')+'>Overall total (all spending)</option>'+state.settings.expenseCats.map(function(c){return '<option value="'+esc(c.name)+'"'+(b.category===c.name?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select></div>'+
  '<div class="field"><label>Amount (\u20b1)</label><input type="number" class="inp" id="bAmt" min="0" step="0.01" value="'+esc(b.amount||'')+'" placeholder="0.00">'+(spentHint!=null?'<div class="hint">Spent so far in '+monthLabel(b.month)+': '+money(spentHint)+'</div>':'')+'</div>'+
  '<label class="check" id="bRollWrap"><input type="checkbox" id="bRoll"'+(b.rollover?' checked':'')+'> Rollover: add last month\u2019s leftover (or take off last month\u2019s overspending)</label>'+
  '</form>',
  foot:(isNew?'':'<button class="btn btn-danger" data-act="bud-del" data-id="'+esc(b.id)+'" style="margin-right:auto">'+I('trash',15)+' Delete</button>')+'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="bSave">Save budget</button>',
  onMount:function(){
    const rollVis=function(){$('#bRollWrap').style.display=($('#bScope').value==='monthly'&&$('#bCat').value!=='__total__')?'':'none';};
    $('#bScope').addEventListener('change',rollVis);$('#bCat').addEventListener('change',rollVis);rollVis();
    $('#fBud').addEventListener('submit',function(e){e.preventDefault();$('#bSave').click();});
    $('#bSave').addEventListener('click',function(){
      const month=$('#bMonth').value,cat=$('#bCat').value,scope=$('#bScope').value,amount=round2(parseFloat($('#bAmt').value));
      const errs=[];
      if(!/^\d{4}-\d{2}$/.test(month))errs.push('Pick a month.');
      if(!isFinite(amount)||amount<0)errs.push('Amount must be zero or more.');
      if(state.budgets.some(function(x){return x.month===month&&x.category===cat&&x.scope===scope&&x.id!==b.id;}))errs.push('A '+scope+' budget for this category already exists in '+monthLabel(month)+'. Edit that one instead.');
      const errEl=$('#fBudErr');
      if(errs.length){errEl.innerHTML=errs.map(esc).join('<br>');errEl.classList.add('show');return;}
      mutate(function(){
        const obj={id:b.id||uid('BUD'),month:month,category:cat,amount:amount,scope:scope,
          rollover:scope==='monthly'&&cat!=='__total__'&&$('#bRoll').checked};
        if(isNew)state.budgets.push(obj);
        else{const i=state.budgets.findIndex(function(x){return x.id===obj.id;});if(i>=0)state.budgets[i]=obj;}
      });
      closeModal();toast('Budget saved.','ok');
    });
  }});
}
function openRecurringModal(r){
  const isNew=!r;
  r=r||{description:'',type:'expense',amount:'',category:'',account:'',startDate:TODAY(),endDate:'',freq:'monthly',status:'active',nextDue:null};
  openModal({title:isNew?'New recurring schedule':'Edit schedule',body:
  '<form id="fRec" novalidate><div class="form-err" id="fRecErr"></div>'+
  '<div class="fgrid"><div class="field"><label>Type</label><select class="inp" id="rType"><option value="expense"'+(r.type==='expense'?' selected':'')+'>Bill / expense</option><option value="income"'+(r.type==='income'?' selected':'')+'>Income</option></select></div>'+
  '<div class="field"><label>How often</label><select class="inp" id="rFreq">'+Object.keys(FREQ_LBL).map(function(f){return '<option value="'+f+'"'+(r.freq===f?' selected':'')+'>'+FREQ_LBL[f]+'</option>';}).join('')+'</select></div></div>'+
  '<div class="field"><label>Description</label><input class="inp" id="rDesc" value="'+esc(r.description)+'" placeholder="e.g. Rent, Salary, Netflix"></div>'+
  '<div class="fgrid"><div class="field"><label>Amount (\u20b1)</label><input type="number" class="inp" id="rAmt" min="0.01" step="0.01" value="'+esc(r.amount||'')+'"></div>'+
  '<div class="field"><label>Category</label><select class="inp" id="rCat"></select></div></div>'+
  '<div class="field"><label>Account</label><select class="inp" id="rAcc"></select><div class="hint">Bills charged to a credit card: choose the card \u2014 the forecast treats them as card debt, not cash leaving today.</div></div>'+
  '<div class="fgrid"><div class="field"><label>First date</label><input type="date" class="inp" id="rStart" value="'+esc(r.startDate)+'"></div>'+
  '<div class="field"><label>End date (optional)</label><input type="date" class="inp" id="rEnd" value="'+esc(r.endDate||'')+'"></div></div>'+
  (isNew?'':'<div class="fgrid"><div class="field"><label>Next due</label><input type="date" class="inp" id="rNext" value="'+esc(r.nextDue||'')+'"></div><div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="rPaused"'+(r.status==='paused'?' checked':'')+'> Paused</label></div></div>')+
  '</form>',
  foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="rSave">Save schedule</button>',
  onMount:function(){
    const draw=function(){
      const inc=$('#rType').value==='income';
      const curCat=$('#rCat').value||r.category,curAcc=$('#rAcc').value||r.account;
      $('#rCat').innerHTML=(inc?state.settings.incomeCats:state.settings.expenseCats.map(function(c){return c.name;})).map(function(c){return '<option value="'+esc(c)+'"'+(c===curCat?' selected':'')+'>'+esc(c)+'</option>';}).join('');
      $('#rAcc').innerHTML='<option value="">\u2014 select \u2014</option>'+state.accounts.filter(function(a){return (!a.archived||a.id===r.account)&&(inc?ASSETS.includes(a.type):true);}).map(function(a){return '<option value="'+esc(a.id)+'"'+(a.id===curAcc?' selected':'')+'>'+esc(a.name)+' ('+ACC_LBL[a.type]+')</option>';}).join('');
    };
    $('#rType').addEventListener('change',draw);draw();
    $('#fRec').addEventListener('submit',function(e){e.preventDefault();$('#rSave').click();});
    $('#rSave').addEventListener('click',function(){
      const type=$('#rType').value,desc=$('#rDesc').value.trim(),amount=round2(parseFloat($('#rAmt').value));
      const start=$('#rStart').value,cat=$('#rCat').value,acc=$('#rAcc').value||null,freq=$('#rFreq').value,end=$('#rEnd').value||null;
      const next=$('#rNext')?($('#rNext').value||null):null;
      const errs=[];
      if(!desc)errs.push('Type a description.');
      if(!isFinite(amount)||amount<=0)errs.push('Amount must be more than zero.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start))errs.push('Pick the first date.');
      if(end&&end<start)errs.push('End date can\u2019t be before the first date.');
      if(!acc)errs.push('Choose an account.');
      const errEl=$('#fRecErr');
      if(errs.length){errEl.innerHTML=errs.map(esc).join('<br>');errEl.classList.add('show');return;}
      mutate(function(){
        let nd=isNew?start:(next||r.nextDue||start);
        if(!isNew&&start!==r.startDate&&nd<start)nd=start;
        const obj={id:r.id||uid('BIL'),description:desc,type:type,amount:amount,category:cat,account:acc,startDate:start,endDate:end,freq:freq,
          status:(!isNew&&$('#rPaused')&&$('#rPaused').checked)?'paused':'active',nextDue:nd};
        if(isNew)state.recurring.push(obj);
        else{const i=state.recurring.findIndex(function(x){return x.id===obj.id;});if(i>=0)state.recurring[i]=obj;}
      });
      closeModal();toast('Schedule saved.','ok');
    });
  }});
}
function openGoalModal(g){
  const isNew=!g;
  g=g||{name:'',target:'',saved:'',targetDate:'',monthlyContribution:''};
  openModal({title:isNew?'New savings goal':'Edit goal',body:
  '<form id="fGoal" novalidate><div class="form-err" id="fGoalErr"></div>'+
  '<div class="field"><label>Goal name</label><input class="inp" id="gName" value="'+esc(g.name)+'" placeholder="e.g. Emergency fund"></div>'+
  '<div class="fgrid"><div class="field"><label>Target amount (\u20b1)</label><input type="number" class="inp" id="gTarget" min="0" step="0.01" value="'+esc(g.target||'')+'"></div>'+
  '<div class="field"><label>Already saved (\u20b1)</label><input type="number" class="inp" id="gSaved" min="0" step="0.01" value="'+esc(g.saved||'')+'"></div></div>'+
  '<div class="fgrid"><div class="field"><label>Target date</label><input type="date" class="inp" id="gDate" value="'+esc(g.targetDate||'')+'"></div>'+
  '<div class="field"><label>Planned monthly amount (\u20b1)</label><input type="number" class="inp" id="gContr" min="0" step="0.01" value="'+esc(g.monthlyContribution||'')+'"></div></div>'+
  '</form>',
  foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="gSave">Save goal</button>',
  onMount:function(){
    $('#fGoal').addEventListener('submit',function(e){e.preventDefault();$('#gSave').click();});
    $('#gSave').addEventListener('click',function(){
      const name=$('#gName').value.trim(),target=round2(parseFloat($('#gTarget').value));
      const errs=[];
      if(!name)errs.push('Give the goal a name.');
      if(!isFinite(target)||target<=0)errs.push('Target must be more than zero.');
      const errEl=$('#fGoalErr');
      if(errs.length){errEl.innerHTML=errs.map(esc).join('<br>');errEl.classList.add('show');return;}
      mutate(function(){
        const obj={id:g.id||uid('GOL'),name:name,target:target,saved:round2(parseFloat($('#gSaved').value)||0),targetDate:$('#gDate').value||null,monthlyContribution:round2(parseFloat($('#gContr').value)||0)};
        if(isNew)state.goals.push(obj);
        else{const i=state.goals.findIndex(function(x){return x.id===obj.id;});if(i>=0)state.goals[i]=obj;}
      });
      closeModal();toast('Goal saved.','ok');
    });
  }});
}
function openContribModal(gid){
  const g0=state.goals.find(function(x){return x.id===gid;});if(!g0)return;
  const savers=state.accounts.filter(function(a){return !a.archived&&a.type==='savings';});
  const firstBank=state.accounts.find(function(a){return !a.archived&&a.type==='bank';});
  const assetL=state.accounts.filter(function(a){return !a.archived&&ASSETS.includes(a.type);});
  openModal({title:'Add money to \u201c'+esc(g0.name)+'\u201d',body:
  '<form id="fCon" novalidate><div class="form-err" id="fConErr"></div>'+
  '<div class="field"><label>Amount (\u20b1) \u2014 use a minus sign to take money out</label><input type="number" class="inp" id="cAmt" step="0.01" placeholder="0.00" value="'+(g0.monthlyContribution||'')+'"></div>'+
  (assetL.length>1?'<label class="check" style="margin-bottom:12px"><input type="checkbox" id="cAlso"> Also record a real transfer between my accounts</label>'+
  '<div class="fgrid" id="cAccs" style="display:none">'+
  '<div class="field"><label>From</label><select class="inp" id="cFrom">'+accOptions(assetL,(firstBank&&firstBank.id))+'</select></div>'+
  '<div class="field"><label>To (savings)</label><select class="inp" id="cTo">'+accOptions(assetL,(savers[0]&&savers[0].id))+'</select></div></div>':'')+
  '</form>',
  foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="cSave">Save</button>',
  onMount:function(){
    if($('#cAlso'))$('#cAlso').addEventListener('change',function(){$('#cAccs').style.display=$('#cAlso').checked?'':'none';});
    $('#fCon').addEventListener('submit',function(e){e.preventDefault();$('#cSave').click();});
    $('#cSave').addEventListener('click',function(){
      const g=state.goals.find(function(x){return x.id===gid;});
      const amt=round2(parseFloat($('#cAmt').value));
      const errEl=$('#fConErr');
      if(!g){closeModal();return;}
      if(!isFinite(amt)||amt===0){errEl.textContent='Enter an amount (not zero).';errEl.classList.add('show');return;}
      if(amt<0&&g.saved+amt<0){errEl.textContent='You can\u2019t take out more than is saved in this goal.';errEl.classList.add('show');return;}
      const also=$('#cAlso')&&$('#cAlso').checked;
      if(also&&$('#cFrom').value===$('#cTo').value){errEl.textContent='Pick two different accounts for the transfer.';errEl.classList.add('show');return;}
      errEl.classList.remove('show');
      mutate(function(){
        g.saved=round2(g.saved+amt);
        if(also){
          const pos=amt>0;
          state.transactions.push({id:uid('TXN'),date:TODAY(),type:'transfer',description:(pos?'Savings contribution \u2014 ':'Savings withdrawal \u2014 ')+g.name,amount:Math.abs(amt),category:'',fromAccount:pos?$('#cFrom').value:$('#cTo').value,toAccount:pos?$('#cTo').value:$('#cFrom').value,method:'Bank Transfer',notes:'',tags:[],recurringId:null,refundOf:null});
        }
      });
      closeModal();toast((amt>0?'Added ':'Withdrew ')+money(Math.abs(amt))+' for \u201c'+g.name+'\u201d.','ok');
    });
  }});
}
function openReconcileModal(aid){
  const a=accountById(aid);if(!a)return;
  const computed=accountBalance(a.id);
  const liab=isLiab(a);
  openModal({title:'Reconcile \u201c'+esc(a.name)+'\u201d',body:
  '<div class="note" style="margin-bottom:14px">The app calculates '+(liab?'you owe':'a balance of')+' <b>'+money(computed)+'</b>. Type the '+(liab?'amount owed':'balance')+' shown on your statement. Any difference is recorded as a visible \u201cReconciliation\u201d transaction \u2014 history is never silently changed.</div>'+
  '<form id="fRec2" novalidate><div class="form-err" id="fRec2Err"></div>'+
  '<div class="field"><label>Statement '+(liab?'amount owed':'balance')+' (\u20b1)</label><input type="number" class="inp" id="rcBal" step="0.01" value="'+computed+'"></div>'+
  '<div class="field"><label>Statement date</label><input type="date" class="inp" id="rcDate" value="'+TODAY()+'"></div></form>',
  foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="rcGo">Check & adjust</button>',
  onMount:function(){
    $('#fRec2').addEventListener('submit',function(e){e.preventDefault();$('#rcGo').click();});
    $('#rcGo').addEventListener('click',function(){
      const st=round2(parseFloat($('#rcBal').value));
      const dt=$('#rcDate').value||TODAY();
      if(!isFinite(st)){$('#fRec2Err').textContent='Enter a valid amount.';$('#fRec2Err').classList.add('show');return;}
      const diff=round2(st-computed);
      if(Math.abs(diff)<0.005){closeModal();toast('It matches your statement. Nothing to adjust.','ok');return;}
      const moreMoney=liab?diff<0:diff>0;
      confirmDialog('Record adjustment?','The app says <b>'+money(computed)+'</b> but your statement says <b>'+money(st)+'</b>. Record a '+money(Math.abs(diff))+' adjustment (category: Reconciliation)?','Record adjustment',false,function(){
        mutate(function(){
          state.transactions.push({id:uid('TXN'),date:dt,type:moreMoney?'income':'expense',
            description:'Statement adjustment \u2014 '+a.name,amount:Math.abs(diff),category:moreMoney?'Other Income':'Reconciliation',
            fromAccount:moreMoney?null:a.id,toAccount:moreMoney?a.id:null,method:'',notes:'Reconciliation vs statement',tags:[],recurringId:null,refundOf:null});
        });
        toast('Adjustment of '+money(Math.abs(diff))+' recorded.','ok');
      });
    });
  }});
}

/* ================= IMPORT / EXPORT / REPORT ================= */
function exportCSVTxns(list,label){
  list=(list||state.transactions).slice().sort(function(a,b){return a.date<b.date?-1:1;});
  const head=['id','date','type','description','amount','category','fromAccount','toAccount','method','notes','tags','recurringId'];
  const rows=list.map(function(t){return [t.id,t.date,t.type,t.description,t.amount,t.category,(acctName(t.fromAccount)||''),(acctName(t.toAccount)||''),t.method||'',t.notes||'',t.tags.join(';'),t.recurringId||''].map(csvCell).join(',');});
  download('badyet-transactions-'+(label||TODAY())+'.csv','\uFEFF'+[head.join(',')].concat(rows).join('\n'),'text/csv');
  toast(list.length+' transaction(s) exported to CSV.','ok');
}
function exportJSON(){
  download('badyet-backup-'+TODAY()+'.json',JSON.stringify({app:'badyet',version:2,exportedAt:new Date().toISOString(),data:state},null,2),'application/json');
  toast('Full backup downloaded.','ok');
}
function importJSON(text){
  let obj;
  try{obj=JSON.parse(text);}catch(e){toast('That file is not a valid backup.','err');return;}
  const d=(obj&&obj.data&&obj.data.transactions)?obj.data:obj;
  if(!d||!Array.isArray(d.transactions)||!Array.isArray(d.accounts)){toast('This doesn\u2019t look like a Badyet backup.','err');return;}
  confirmDialog('Restore this backup?','This <b>replaces all current data</b>'+(Sync.url?' (in the app <b>and</b> your Google Sheet)':'')+' with the backup: '+d.transactions.length+' transactions, '+d.accounts.length+' accounts. This can\u2019t be undone.','Restore backup',true,function(){
    state=normalizeState(d);refresh();toast('Backup restored.','ok');
  });
}
let pendingImport=null;
function importCSV(text){
  const rows=parseCSV(text);
  if(rows.length<2){toast('The CSV file has no data rows.','err');return;}
  const norm=function(s){return String(s||'').toLowerCase().replace(/[\s_]+/g,'');};
  const head=rows[0].map(norm);
  const col={};['date','description','amount','type','category','fromaccount','toaccount','account','method','notes','tags'].forEach(function(k){col[k]=head.indexOf(k);});
  ['merchant','desc','details'].forEach(function(alt){if(col.description<0&&head.indexOf(alt)>=0)col.description=head.indexOf(alt);});
  ['from','source'].forEach(function(alt){if(col.fromaccount<0&&head.indexOf(alt)>=0)col.fromaccount=head.indexOf(alt);});
  ['to','destination'].forEach(function(alt){if(col.toaccount<0&&head.indexOf(alt)>=0)col.toaccount=head.indexOf(alt);});
  if(col.date<0||col.description<0||col.amount<0){toast('The CSV needs at least date, description and amount columns.','err');return;}
  const get=function(r,i){return (i>=0&&i<r.length)?String(r[i]).trim():'';};
  const accByName=function(v){if(!v)return null;const a=state.accounts.find(function(x){return x.name.toLowerCase()===v.toLowerCase();});return a?a.id:null;};
  const parsed=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i];const date=normDate(get(r,col.date));const desc=get(r,col.description);
    const amount=toNum(get(r,col.amount));
    const rawType=get(r,col.type);
    const type=rawType?normTxnType(rawType):(amount<0?'expense':'expense');
    let status='ok',reason='';
    if(!date){status='error';reason='invalid date';}
    else if(!desc){status='error';reason='missing description';}
    else if(!isFinite(amount)||amount===0){status='error';reason='invalid amount';}
    else if(state.transactions.some(function(t){return t.date===date&&Math.abs(t.amount-Math.abs(amount))<0.01&&t.description.toLowerCase()===desc.toLowerCase();})){status='duplicate';reason='already exists';}
    parsed.push({date:date,desc:desc,amount:Math.abs(amount),type:type,category:get(r,col.category),
      from:(accByName(get(r,col.fromaccount))||accByName(get(r,col.account))),
      to:accByName(get(r,col.toaccount)),method:get(r,col.method),notes:get(r,col.notes),tags:get(r,col.tags),
      status:status,reason:reason,line:i+1});
  }
  const okN=parsed.filter(function(p){return p.status==='ok';}).length;
  const dupN=parsed.filter(function(p){return p.status==='duplicate';}).length;
  const errN=parsed.filter(function(p){return p.status==='error';}).length;
  pendingImport=parsed;
  openModal({wide:true,title:'Preview import',body:
  '<div class="note" style="margin-bottom:12px">'+parsed.length+' row(s): <b class="pos">'+okN+' ready</b>, '+dupN+' possible duplicate(s) (unticked \u2014 tick to import anyway), '+errN+' invalid (skipped). Unknown categories become \u201cOther\u201d; accounts are matched by name.</div>'+
  '<div class="table-scroll" style="max-height:340px;overflow-y:auto"><table class="tbl"><thead><tr><th></th><th>Line</th><th>Date</th><th>Type</th><th>Description</th><th class="r">Amount</th><th>Category</th><th>Status</th></tr></thead><tbody>'+
  parsed.map(function(p){
    const box=(p.status==='error'?'':'<input type="checkbox" class="impRow" data-line="'+p.line+'"'+(p.status==='ok'?' checked':'')+'>');
    const stat=(p.status==='ok'?'<span class="badge b-ok">ready</span>':(p.status==='duplicate'?('<span class="badge b-watch">'+esc(p.reason)+'</span>'):('<span class="badge b-over">'+esc(p.reason)+'</span>')));
    return '<tr><td>'+box+'</td><td>'+p.line+'</td><td class="num">'+esc(p.date||'\u2014')+'</td><td>'+typeBadge(p.type)+'</td><td>'+esc(p.desc||'\u2014')+'</td><td class="amt">'+money(p.amount)+'</td><td>'+esc(p.category||'Other')+'</td><td>'+stat+'</td></tr>';}).join('')+
  '</tbody></table></div>',
  foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="impGo">Import selected</button>',
  onMount:function(root){
    root.querySelector('#impGo').addEventListener('click',function(){
      const lines=new Set();
      root.querySelectorAll('.impRow:checked').forEach(function(cb){lines.add(Number(cb.dataset.line));});
      const sel=(pendingImport||[]).filter(function(p){return lines.has(p.line)&&p.status!=='error';});
      if(!sel.length){toast('Nothing selected to import.','err');return;}
      mutate(function(){
        for(const p of sel){
          const catOK=state.settings.incomeCats.includes(p.category)||state.settings.expenseCats.some(function(c){return c.name===p.category;});
          const mv=p.type==='transfer'||p.type==='cc_payment';
          state.transactions.push({id:uid('TXN'),date:p.date,type:p.type,description:p.desc,amount:p.amount,
            category:mv?'':(catOK?p.category:(p.type==='income'?'Other Income':'Other')),
            fromAccount:(p.type==='expense'||mv)?(p.from||null):null,
            toAccount:(p.type==='income'||p.type==='refund')?(p.to||p.from||null):(mv?(p.to||null):null),
            method:p.method||'',notes:p.notes||'',tags:(p.tags?p.tags.split(';').map(function(x){return x.trim();}).filter(Boolean):[]),recurringId:null,refundOf:null});
        }
      });
      closeModal();toast(sel.length+' transaction(s) imported.','ok');
    });
  }});
}
function buildReportHTML(){
  const k=ui.month;
  const startBal=availableCash(addDaysISO(monthStart(k),-1));
  const isCur=(k===monthKey(TODAY()));
  const endBal=availableCash(isCur?TODAY():monthEnd(k));
  const tx=monthTxns(k),S=periodSummary(tx);
  const P=periodSummary(monthTxns(monthAdd(k,-1)));
  const spend=netSpendByCat(tx);
  const cats=Object.entries(spend).sort(function(a,b){return b[1]-a[1];});
  const budMap={};for(const b of budgetsFor(k))if(b.scope==='monthly')budMap[b.category]=b;
  const largest=tx.slice().sort(function(a,b){return b.amount-a.amount;}).slice(0,5);
  const nextK=monthAdd(k,1);
  const upcoming=[];
  for(const r of state.recurring){if(r.status!=='active')continue;
    for(const d of occBetween(r,monthStart(nextK),monthEnd(nextK)))upcoming.push({d:d,r:r});}
  upcoming.sort(function(a,b){return a.d<b.d?-1:1;});
  const fc=computeForecast(1);
  return '<h1>Badyet \u2014 Monthly Financial Report</h1><p class="muted">Period: '+monthLabel(k)+(isCur?(' (as of '+fmtDate(TODAY())+' \u2014 month in progress)'):'')+' \u00b7 Generated '+fmtDate(TODAY())+'</p>'+
  '<h2>Summary</h2><table><tr><th>Starting cash & deposits</th><td class="r">'+money(startBal)+'</td><th>Ending cash & deposits</th><td class="r">'+money(endBal)+'</td></tr>'+
  '<tr><th>Income</th><td class="r">'+money(S.income)+'</td><th>Expenses (gross / refunds / net)</th><td class="r">'+money(S.gross)+' / '+money(S.refunds)+' / '+money(S.netExpense)+'</td></tr>'+
  '<tr><th>Net cash flow</th><td class="r">'+signed(S.net)+'</td><th>Savings rate</th><td class="r">'+(S.savingsRate==null?'\u2014':pctStr(S.savingsRate))+'</td></tr></table>'+
  '<h2>Spending by category & budget performance</h2><table><tr><th>Category</th><th class="r">Spent</th><th class="r">Share</th><th class="r">Budget</th><th>Status</th></tr>'+
  (cats.length?cats.map(function(c){const b=budMap[c[0]];const st=b?budgetStatus(c[1],b.amount):null;
    return '<tr><td>'+esc(c[0])+'</td><td class="r">'+money(c[1])+'</td><td class="r">'+(S.netExpense>0?pctStr(Math.max(0,c[1])/S.netExpense*100):'\u2014')+'</td><td class="r">'+(b?money(b.amount):'\u2014')+'</td><td>'+(st?st.label:'no budget')+'</td></tr>';}).join(''):'<tr><td colspan="5">No expenses recorded.</td></tr>')+'</table>'+
  '<h2>Largest transactions</h2><table><tr><th>Date</th><th>Description</th><th>Type</th><th class="r">Amount</th></tr>'+
  (largest.length?largest.map(function(t){return '<tr><td>'+fmtDate(t.date)+'</td><td>'+esc(t.description)+'</td><td>'+TYPE_LBL[t.type]+'</td><td class="r">'+money(t.amount)+'</td></tr>';}).join(''):'<tr><td colspan="4">None.</td></tr>')+'</table>'+
  '<h2>Month-over-month change</h2><table><tr><th></th><th class="r">'+monthLabel(monthAdd(k,-1))+'</th><th class="r">'+monthLabel(k)+'</th><th class="r">Change</th></tr>'+
  '<tr><td>Income</td><td class="r">'+money(P.income)+'</td><td class="r">'+money(S.income)+'</td><td class="r">'+signed(S.income-P.income)+'</td></tr>'+
  '<tr><td>Expenses (net)</td><td class="r">'+money(P.netExpense)+'</td><td class="r">'+money(S.netExpense)+'</td><td class="r">'+signed(S.netExpense-P.netExpense)+'</td></tr>'+
  '<tr><td>Net</td><td class="r">'+signed(P.net)+'</td><td class="r">'+signed(S.net)+'</td><td class="r">'+signed(S.net-P.net)+'</td></tr></table>'+
  '<h2>Upcoming commitments \u2014 '+monthLabel(nextK)+'</h2><table><tr><th>Date</th><th>Description</th><th class="r">Amount</th></tr>'+
  (upcoming.length?upcoming.slice(0,12).map(function(u){return '<tr><td>'+fmtDate(u.d)+'</td><td>'+esc(u.r.description)+'</td><td class="r">'+signed(u.r.type==='income'?u.r.amount:-u.r.amount)+'</td></tr>';}).join(''):'<tr><td colspan="3">No scheduled items.</td></tr>')+'</table>'+
  '<h2>Forecast \u2014 rest of current month</h2><table><tr><th>Current available cash</th><td class="r">'+money(fc.cash0)+'</td></tr>'+
  '<tr><th>Expected income remaining</th><td class="r">'+money(fc.incomeRem)+'</td></tr><tr><th>Scheduled bills remaining</th><td class="r">'+money(fc.billsRem)+'</td></tr>'+
  '<tr><th>Estimated variable spending</th><td class="r">'+money(fc.variableRem)+'</td></tr><tr><th>Projected month-end cash</th><td class="r">'+money(fc.projectedEnd)+'</td></tr></table>'+
  '<div class="foot">Generated by Badyet from your recorded transactions. Rule-based projection; not a guarantee.</div>';
}
function printReport(){
  $('#printRoot').innerHTML=buildReportHTML();
  toast('Opening print dialog \u2014 choose \u201cSave as PDF\u201d to keep a copy.');
  setTimeout(function(){window.print();},150);
}

/* ================= DEMO DATA ================= */
function seedDemo(){
  const rng=mulberry32(1187);
  const ri=function(a,b){return Math.round(a+rng()*(b-a));};
  const pick=function(arr){return arr[Math.floor(rng()*arr.length)];};
  const today=TODAY(),cur=monthKey(today),startKey=monthAdd(cur,-6);
  const A={bpi:uid('ACC'),cash:uid('ACC'),gcash:uid('ACC'),save:uid('ACC'),cc:uid('ACC'),loan:uid('ACC')};
  const open0=addDaysISO(monthStart(startKey),-5);
  const dayISO=function(kk,d){return kk+'-'+String(clamp(d,1,dim(kk))).padStart(2,'0');};
  state={version:2,settings:defaultSettings(),transactions:[],budgets:[],recurring:[],goals:[],exceptions:[],dismissed:[],isDemo:true,
    accounts:[
      {id:A.bpi,name:'BPI Payroll',type:'bank',openingBalance:25000,openingDate:open0,notes:'Main salary account',archived:false,apr:null,minPayment:0,dueDay:null,plannedPayment:0},
      {id:A.cash,name:'Cash Wallet',type:'cash',openingBalance:2500,openingDate:open0,notes:'',archived:false,apr:null,minPayment:0,dueDay:null,plannedPayment:0},
      {id:A.gcash,name:'GCash',type:'ewallet',openingBalance:1200,openingDate:open0,notes:'',archived:false,apr:null,minPayment:0,dueDay:null,plannedPayment:0},
      {id:A.save,name:'BPI Savings',type:'savings',openingBalance:20000,openingDate:open0,notes:'Emergency fund parking',archived:false,apr:null,minPayment:0,dueDay:null,plannedPayment:0},
      {id:A.cc,name:'RCBC Gold Card',type:'credit',openingBalance:0,openingDate:open0,notes:'',archived:false,apr:36,minPayment:2500,dueDay:22,plannedPayment:6000},
      {id:A.loan,name:'BPI Family Auto Loan',type:'loan',openingBalance:90000,openingDate:open0,notes:'5-year auto loan',archived:false,apr:10.5,minPayment:5850,dueDay:5,plannedPayment:5850}]};
  const RC=function(desc,type,amount,cat,acc,day){return{id:uid('BIL'),description:desc,type:type,amount:amount,category:cat,account:acc,startDate:dayISO(startKey,day),endDate:null,freq:'monthly',nextDue:null,status:'active'};};
  const R={
    sal15:RC('Salary (15th)','income',30000,'Salary',A.bpi,15),
    sal30:RC('Salary (30th)','income',30000,'Salary',A.bpi,30),
    free:RC('Freelance project','income',6500,'Freelance',A.gcash,20),
    rent:RC('Rent \u2014 Casa Verde unit','expense',12500,'Housing & Rent',A.bpi,3),
    net:RC('Converge fiber internet','expense',1299,'Utilities',A.bpi,8),
    mer:RC('Meralco electricity','expense',2150,'Utilities',A.bpi,10),
    wat:RC('Maynilad water','expense',380,'Utilities',A.bpi,10),
    phone:RC('Globe postpaid','expense',999,'Utilities',A.gcash,20),
    nfx:RC('Netflix','expense',549,'Subscriptions',A.cc,14),
    spot:RC('Spotify','expense',149,'Subscriptions',A.gcash,21),
    ins:RC('Sun Life insurance','expense',1150,'Healthcare',A.gcash,17),
    loani:RC('Auto loan interest','expense',850,'Debt Interest',A.bpi,5)};
  state.recurring=[R.sal15,R.sal30,R.free,R.rent,R.net,R.mer,R.wat,R.phone,R.nfx,R.spot,R.ins,R.loani];
  const txns=[];
  const gen={};gen[A.bpi]=25000;gen[A.cash]=2500;gen[A.gcash]=1200;gen[A.save]=20000;gen[A.cc]=0;gen[A.loan]=90000;
  function ledger(type,from,to,amt){
    const L=function(id){return LIABS.includes((accountById(id)||{}).type);};
    if((type==='income'||type==='refund')&&to)gen[to]+=L(to)?-amt:amt;
    if(type==='expense'&&from)gen[from]+=L(from)?amt:-amt;
    if(type==='transfer'||type==='cc_payment'){
      if(from)gen[from]+=L(from)?amt:-amt;
      if(to)gen[to]+=L(to)?-amt:amt;}
  }
  function DT(iso,type,desc,amount,cat,from,to,extra){
    if(iso>today)return;
    txns.push(Object.assign({id:uid('TXN'),date:iso,type:type,description:desc,amount:round2(amount),category:cat||'',fromAccount:from||null,toAccount:to||null,method:'',notes:'',tags:[],recurringId:null,refundOf:null},extra||{}));
    ledger(type,from,to,amount);
  }
  function pickAsset(pref,amt){
    const opts=[pref,A.bpi,A.gcash,A.cash];
    for(const a of opts){if(a&&(gen[a]||0)>=amt)return a;}
    return A.bpi;
  }
  const GROC=['Puregold','SM Supermarket','Landers','Walter Mart'];
  const FOOD=["Jollibee","McDonald's","Foodpanda","Starbucks","Chowking","Greenwich","Kuya Jessie Lugawan","Mang Inasal"];
  for(let m=0;m<=6;m++){
    const key=monthAdd(startKey,m),D=dim(key),isCur=(key===cur);
    const lastDay=isCur?Number(today.slice(8)):D;
    const iso=function(d){return key+'-'+String(clamp(d,1,D)).padStart(2,'0');};
    DT(iso(15),'income','Salary (15th)',30000,'Salary',null,A.bpi,{recurringId:R.sal15.id,method:'Bank Transfer'});
    DT(iso(30),'income','Salary (30th)',30000,'Salary',null,A.bpi,{recurringId:R.sal30.id,method:'Bank Transfer'});
    DT(iso(20),'income','Freelance project',Math.round(ri(5000,9500)/250)*250,'Freelance',null,A.gcash,{recurringId:R.free.id});
    DT(iso(3),'expense','Rent \u2014 Casa Verde unit',12500,'Housing & Rent',A.bpi,null,{recurringId:R.rent.id,method:'Autopay'});
    DT(iso(8),'expense','Converge fiber internet',1299,'Utilities',A.bpi,null,{recurringId:R.net.id,method:'Autopay'});
    DT(iso(10),'expense','Meralco electricity',ri(1600,2800),'Utilities',A.bpi,null,{recurringId:R.mer.id});
    DT(iso(10),'expense','Maynilad water',380,'Utilities',A.bpi,null,{recurringId:R.wat.id,method:'Autopay'});
    DT(iso(20),'expense','Globe postpaid',999,'Utilities',A.gcash,null,{recurringId:R.phone.id,method:'Autopay'});
    DT(iso(14),'expense','Netflix',549,'Subscriptions',A.cc,null,{recurringId:R.nfx.id,method:'Credit Card'});
    DT(iso(21),'expense','Spotify',149,'Subscriptions',A.gcash,null,{recurringId:R.spot.id,method:'E-Wallet'});
    DT(iso(17),'expense','Sun Life insurance',1150,'Healthcare',A.gcash,null,{recurringId:R.ins.id,method:'Autopay'});
    DT(iso(5),'transfer','Auto loan principal payment',5000,'',A.bpi,A.loan,{method:'Bank Transfer'});
    DT(iso(5),'expense','Auto loan interest',850,'Debt Interest',A.bpi,null,{recurringId:R.loani.id,method:'Bank Transfer'});
    DT(iso(5),'transfer','Automatic savings transfer',5000,'',A.bpi,A.save,{method:'Bank Transfer'});
    DT(iso(7),'transfer','GCash cash-in',4000,'',A.bpi,A.gcash,{method:'Bank Transfer'});
    DT(iso(12),'transfer','ATM withdrawal',5000,'',A.bpi,A.cash,{method:'ATM'});
    if(m%2===0)DT(iso(19),'transfer','GCash cash-in',1500,'',A.bpi,A.gcash,{method:'Bank Transfer'});
    let gd=ri(2,5);
    while(gd<=lastDay){const amt=ri(1300,2600)+m*60;
      DT(iso(gd),'expense',pick(GROC),amt,'Groceries',pickAsset(rng()<0.5?A.gcash:A.bpi,amt),null,{method:'E-Wallet'});
      gd+=ri(6,9);}
    const nFood=7+(m===5?5:0)+ri(0,2);
    for(let i=0;i<nFood;i++){const d=ri(1,lastDay),amt=ri(140,720)+Math.round(m*18);
      DT(iso(d),'expense',pick(FOOD),amt,'Food & Dining',(rng()<0.45?pickAsset(A.cash,amt):pickAsset(A.gcash,amt)),null);}
    for(let f=0,n=ri(1,2);f<n;f++)DT(iso(ri(3,lastDay)),'expense','Shell fuel',ri(1150,1850),'Transportation',A.bpi,null);
    for(let f=0,n=ri(2,4);f<n;f++)DT(iso(ri(1,lastDay)),'expense','Grab ride',ri(140,420),'Transportation',A.gcash,null,{method:'E-Wallet'});
    DT(iso(ri(5,20)),'expense','Beep card load',500,'Transportation',A.gcash,null,{method:'E-Wallet'});
    if(m>=2)for(let i=0,n=ri(1,3);i<n;i++)DT(iso(ri(1,lastDay)),'expense',pick(['Shopee','Lazada','Uniqlo','Decathlon']),ri(400,2200),'Shopping',pickAsset(A.gcash,2000),null);
    if(m===3)DT(iso(ri(8,18)),'expense','iPhone screen repair',7800,'Shopping',A.bpi,null,{notes:'Dropped phone \u2014 one-time repair'});
    for(let i=0,n=ri(1,2);i<n;i++)DT(iso(ri(1,lastDay)),'expense',pick(['SM Cinemas','Bowling night','Board game cafe']),ri(350,900),'Entertainment',A.cash,null);
    if(m===5)DT(iso(ri(10,20)),'expense','Arena concert tickets',3400,'Entertainment',A.bpi,null,{notes:'One-off treat'});
    if(m===4)DT(iso(ri(6,16)),'expense','St. Luke\u2019s ER visit',9500,'Healthcare',A.bpi,null,{notes:'Sprained ankle \u2014 one-time'});
    if(rng()<0.6)DT(iso(ri(1,lastDay)),'expense','Mercury Drug',ri(250,900),'Healthcare',A.cash,null);
    DT(iso(ri(1,lastDay)),'expense',pick(['Barbershop','Watsons','The Body Shop']),ri(180,650),'Personal Care',A.cash,null);
    if(m===3)DT(iso(ri(5,25)),'expense','Udemy course',899,'Education',A.gcash,null,{method:'E-Wallet'});
    if(rng()<0.5)DT(iso(ri(1,lastDay)),'expense',pick(['Courier delivery','GCash fees','Photocopy shop']),ri(50,300),'Other',A.gcash,null);
    for(let i=0,n=ri(2,3);i<n;i++)DT(iso(ri(1,lastDay)),'expense',pick(['Zalora order','AirAsia seat sale','Cafe Juanita dinner','Power Mac accessories']),ri(800,5400),pick(['Shopping','Entertainment','Food & Dining']),A.cc,null,{method:'Credit Card'});
    const owed=gen[A.cc];
    if(owed>=1500&&22<=lastDay){
      const pay=Math.min(owed,Math.max(2000,Math.round(owed*0.65/100)*100),7000);
      DT(iso(22),'cc_payment','Credit card payment \u2014 RCBC',pay,'',A.bpi,A.cc,{method:'Bank Transfer'});
    }
    if(m===1)DT(iso(ri(10,25)),'refund','Shopee refund (item returned)',ri(400,900),'Shopping',null,A.gcash,{method:'E-Wallet'});
    if(m===3)DT(iso(ri(12,20)),'refund','Meralco bill adjustment',ri(250,600),'Utilities',null,A.bpi);
  }
  state.transactions=txns.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  for(const r of state.recurring){
    const posted=state.transactions.filter(function(t){return t.recurringId===r.id;}).sort(function(a,b){return a.date<b.date?1:-1;});
    r.nextDue=posted.length?stepFreq(r,posted[0].date):r.startDate;
  }
  const BUD={'Food & Dining':5000,'Groceries':10000,'Housing & Rent':13000,'Utilities':5500,'Transportation':4500,'Healthcare':2000,'Subscriptions':2500,'Shopping':4000,'Entertainment':2500,'Personal Care':1000};
  for(const k of [monthAdd(cur,-2),monthAdd(cur,-1),cur])
    for(const c in BUD)state.budgets.push({id:uid('BUD'),month:k,category:c,amount:BUD[c],scope:'monthly',rollover:c==='Groceries'||c==='Food & Dining'});
  const saveBal=accountBalance(A.save);
  const emergency=Math.round(saveBal*0.68/100)*100;
  state.goals=[
    {id:uid('GOL'),name:'Emergency Fund',target:120000,saved:emergency,targetDate:addMonthsISO(today,12),monthlyContribution:6000},
    {id:uid('GOL'),name:'Japan trip (spring)',target:80000,saved:round2(saveBal-emergency),targetDate:addMonthsISO(today,8),monthlyContribution:3000},
    {id:uid('GOL'),name:'Investments',target:100000,saved:15000,targetDate:addMonthsISO(today,12),monthlyContribution:3000}];
  state.plan={
    income:60000,payday:'15-30',payDay:15,split:{needs:50,wants:30,savings:20},
    lines:[
      {id:uid('PLN'),group:'needs',name:'Needs',mode:'amt',pct:null,amount:31000,rollover:false,target:0,targetDate:'',paid:0,months:6,freq:'monthly',icon:'home'},
      {id:uid('PLN'),group:'debts',name:'Personal / Credit Debt',mode:'amt',pct:null,amount:5000,rollover:false,target:30000,targetDate:'',paid:0,months:6,freq:'monthly',icon:'card'},
      {id:uid('PLN'),group:'wants',name:'Wants',mode:'pct',pct:30,amount:null,rollover:false,target:0,targetDate:'',paid:0,months:6,freq:'monthly',icon:'bag'},
      {id:uid('PLN'),group:'savings',name:'Emergency Fund',mode:'pct',pct:10,amount:null,rollover:false,target:120000,targetDate:addMonthsISO(today,12),paid:0,months:6,freq:'monthly',icon:'shield'},
      {id:uid('PLN'),group:'savings',name:'Japan trip (spring)',mode:'pct',pct:5,amount:null,rollover:false,target:80000,targetDate:addMonthsISO(today,8),paid:0,months:6,freq:'monthly',icon:'plane'},
      {id:uid('PLN'),group:'savings',name:'Investments',mode:'pct',pct:5,amount:null,rollover:false,target:100000,targetDate:addMonthsISO(today,12),paid:0,months:6,freq:'monthly',icon:'trend'}
    ]
  };
  state=normalizeState(state);
  return state;
}

/* ================= GOOGLE SHEETS SYNC ================= */
const SYNC_KEY='badyet_sheet_url';
const SYNC_SEEN_KEY='badyet_setup_seen';
const POLL_MS=15000;
/* The sheet's own link arrives with the data, so no personal link lives in this file. */
let SHEET_LINK='';
function openSheetBtn(){return SHEET_LINK?'<a class="btn" href="'+esc(SHEET_LINK)+'" target="_blank" rel="noopener">'+I('ext',15)+' Open sheet</a>':'';}
const Sync={url:'',status:'off',err:'',snap:null,remoteSig:'',pending:false,busy:false,again:false,pulling:false,pushTimer:null,lastOk:0,deferRender:false,hosted:false,locked:false,pinOn:false};
/* PIN lock: the PIN is checked by the Apps Script on Google's side. A correct PIN
   gives this device a key (token) that is valid for 30 days. */
const TOKEN_KEY='badyet_token',PIN_FLAG='badyet_pin_on';
function getToken(){try{return localStorage.getItem(TOKEN_KEY)||'';}catch(e){return '';}}
function setToken(t){try{if(t)localStorage.setItem(TOKEN_KEY,t);else localStorage.removeItem(TOKEN_KEY);}catch(e){}}
function setPinFlag(on){Sync.pinOn=!!on;try{if(on)localStorage.setItem(PIN_FLAG,'1');else localStorage.removeItem(PIN_FLAG);}catch(e){}}
function pinFlag(){try{return localStorage.getItem(PIN_FLAG)==='1';}catch(e){return false;}}

function gasCode(){const el=document.getElementById('gasCode');return el?el.textContent.replace(/^\s*\n/,''):'';}
function rowSig(t,r){return TABLES[t].cols.map(function(c){const v=r[c];return v==null?'':String(v);}).join('\u241F');}
function snapshotOf(rows){const o={};for(const t in TABLES){o[t]={};for(const r of (rows[t]||[])){const k=String(r[TABLES[t].key]==null?'':r[TABLES[t].key]);if(k)o[t][k]=rowSig(t,r);}}return o;}
function diffOps(){
  const rows=stateToRows(state);const ops=[];
  for(const t in TABLES){
    const key=TABLES[t].key,old=Sync.snap[t]||{},seen={},up=[];
    for(const r of rows[t]){const k=String(r[key]);if(!k)continue;seen[k]=1;if(old[k]!==rowSig(t,r))up.push(r);}
    const del=Object.keys(old).filter(function(k){return !seen[k];});
    if(up.length)ops.push({op:'upsert',table:t,rows:up});
    if(del.length)ops.push({op:'delete',table:t,keys:del});
  }
  return{ops:ops,rows:rows};
}
const SYNC_MODE_KEY='badyet_sync_mode';
/* What the sheet last had, kept on the phone. If the app closes before an offline change is
   sent, the next start can still tell what's new and send it first. */
const SNAP_KEY='badyet_snap_v1';
function saveSnap(){try{if(Sync.snap)localStorage.setItem(SNAP_KEY,JSON.stringify(Sync.snap));else localStorage.removeItem(SNAP_KEY);}catch(e){}}
function loadSnap(){try{const r=localStorage.getItem(SNAP_KEY);return r?JSON.parse(r):null;}catch(e){return null;}}
function dropSnap(){try{localStorage.removeItem(SNAP_KEY);}catch(e){}}
async function pushPendingFirst(){
  if(!Sync.snap||!state||!diffOps().ops.length)return true;
  Sync.pending=true;updateSyncChip();
  await pushNow();
  return !Sync.pending;
}
/* Running inside Google? Then the page can call the sheet directly — no URL, no CORS. */
const HOSTED=(typeof google!=='undefined'&&google.script&&google.script.run);
function gsrun(fn){
  const args=Array.prototype.slice.call(arguments,1);
  return new Promise(function(resolve,reject){
    try{
      const r=google.script.run.withSuccessHandler(resolve).withFailureHandler(function(e){reject(new Error((e&&e.message)||String(e)||'Google Apps Script error'));});
      r[fn].apply(r,args);
    }catch(e){reject(e);}
  });
}
function inPreview(){try{return window.self!==window.top;}catch(e){return true;}}
function jsonp(url,params){
  params=params||{action:'read',token:getToken()};
  return new Promise(function(resolve,reject){
    const name='__badyetCb'+Date.now().toString(36)+Math.floor(Math.random()*1e6);
    let done=false,timer=null;
    const s=document.createElement('script');
    const cleanup=function(){clearTimeout(timer);s.onload=s.onerror=null;s.remove();setTimeout(function(){try{delete window[name];}catch(x){window[name]=undefined;}},30000);};
    window[name]=function(j){if(done)return;done=true;cleanup();resolve(j);};
    s.onerror=function(){if(done)return;done=true;cleanup();reject(new Error('NOLOAD'));};
    s.onload=function(){setTimeout(function(){if(done)return;done=true;cleanup();reject(new Error('NOTBADYET'));},80);};
    timer=setTimeout(function(){if(done)return;done=true;cleanup();reject(new Error('TIMEOUT'));},30000);
    s.src=url+(url.indexOf('?')>=0?'&':'?')+Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k]==null?'':params[k]);}).join('&')+'&callback='+name+'&t='+Date.now();
    document.head.appendChild(s);
  });
}
function verifyWrite(body,data){
  data=data||{};
  if(body.action==='replace'){
    for(const t of ['Accounts','Transactions'])
      if(((data[t]||[]).length)!==((body.data&&body.data[t])||[]).length)throw new Error('NOTSAVED');
    return;
  }
  for(const op of (body.ops||[])){
    const k=TABLES[op.table].key;
    const have=new Set((data[op.table]||[]).map(function(r){return String(r[k]);}));
    if(op.op==='upsert'&&op.rows.some(function(r){return !have.has(String(r[k]));}))throw new Error('NOTSAVED');
    if(op.op==='delete'&&op.keys.some(function(x){return have.has(String(x));}))throw new Error('NOTSAVED');
  }
}
const OFFLINE_MSG='You\u2019re offline or Google can\u2019t be reached. Your changes are kept on this phone and will save automatically.';
function friendlyErr(e){
  const m=String((e&&e.message)||e);
  /* Worked before on this phone? Then it's the internet, not the link. */
  if((m==='NOLOAD'||m==='TIMEOUT')&&Sync.snap&&!inPreview())return new Error(OFFLINE_MSG);
  if(m==='NOLOAD')return new Error(inPreview()
    ?'This page is running inside a preview window that blocks internet access. Download badyet.html and open it directly in Chrome (double-click the file).'
    :'Couldn’t load your web app link at all. Check that you’re online and that the link was copied fully (it ends in /exec). Click “Test my link” to check it.');
  if(m==='NOTBADYET')return new Error('Your link answered, but not with Badyet data. This almost always means one of these: (1) the script wasn’t saved before you deployed, (2) “Who has access” isn’t exactly “Anyone”, or (3) you’re using the old script — paste the new one and publish a new version. Click “Test my link” to see what Google says.');
  if(m==='TIMEOUT')return new Error('Google took too long to answer. Try again in a minute.');
  if(m==='NOTSAVED')return new Error('Google received the change but your sheet didn’t update. Check that the deployment has “Execute as: Me”, then publish a new version.');
  return e instanceof Error?e:new Error(m);
}
async function apiCors(body,url){
  let resp;
  try{
    if(body.action==='read')resp=await fetch(url+(url.indexOf('?')>=0?'&':'?')+'action=read&token='+encodeURIComponent(getToken())+'&t='+Date.now(),{method:'GET',redirect:'follow'});
    else resp=await fetch(url,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({token:getToken()},body))});
  }catch(e){const x=new Error('NET');x.network=true;throw x;}
  const txt=await resp.text();
  let j;
  try{j=JSON.parse(txt);}catch(e){const x=new Error('NOTBADYET');x.network=true;throw x;}
  if(!j.ok)throw new Error('Script error: '+(j.error||'unknown'));
  return j;
}
function lockedErr(){const e=new Error('Locked. Enter your PIN.');e.locked=true;return e;}
async function api(body,urlOverride){
  const res=await apiRaw(body,urlOverride);
  if(res&&res.data&&res.data.__auth){handleAuth();throw authErr();}
  if(res&&res.data&&res.data.__locked){handleLocked();throw lockedErr();}
  return res;
}
async function apiRaw(body,urlOverride){
  const tok=getToken();
  if(HOSTED){
    let data;
    if(body.action==='apply')data=await gsrun('apiApply',body.ops,tok);
    else if(body.action==='replace')data=await gsrun('apiReplace',body.data,tok);
    else if(body.action==='unlock')data=await gsrun('apiUnlock',body.pin);
    else if(body.action==='setpin')data=await gsrun('apiSetPin',tok,body.pin);
    else if(body.action==='lock')data=await gsrun('apiLock',tok);
    else if(body.action==='auth')data=await gsrun('apiAuth',body.op,body.payload||{},tok);
    else data=await gsrun('apiGet',tok);
    return {ok:true,data:data};
  }
  if(['unlock','setpin','lock'].indexOf(body.action)>=0){
    let j;try{j=await jsonp(urlOverride||Sync.url,{action:body.action,pin:body.pin||'',token:tok});}catch(e){throw friendlyErr(e);}
    if(!j||!j.ok)throw new Error((j&&j.error)||'Script error');
    return j;
  }
  const url=urlOverride||Sync.url;
  if(body.action==='auth'){   // passwords only ever travel in a POST body, never in a link
    try{return await apiCors(body,url);}
    catch(e){if(e.network)throw new Error('NET: Couldn\u2019t reach Google. Check your internet and try again.');throw e;}
  }
  let mode='cors';try{mode=localStorage.getItem(SYNC_MODE_KEY)||'cors';}catch(e){}
  if(mode!=='jsonp'){
    try{return await apiCors(body,url);}
    catch(e){if(!e.network)throw e;}
  }
  /* Fallback: works even when the browser blocks normal cross-site replies. */
  try{
    if(body.action!=='read'){
      try{await fetch(url,{method:'POST',mode:'no-cors',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});}
      catch(e){throw new Error('NOLOAD');}
    }
    const j=await jsonp(url);
    if(!j||!j.ok)throw new Error('Script error: '+((j&&j.error)||'unknown'));
    if(body.action!=='read')verifyWrite(body,j.data);
    try{localStorage.setItem(SYNC_MODE_KEY,'jsonp');}catch(e){}
    return j;
  }catch(e){throw friendlyErr(e);}
}
function uiBusy(){
  if(modalOpen())return true;
  const a=document.activeElement;
  return !!(a&&a.closest&&a.closest('#view')&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
}
function safeRender(){if(uiBusy()){Sync.deferRender=true;return;}Sync.deferRender=false;render();}
function applyRemote(data,forceRender){
  if(data&&data.__sheetUrl)SHEET_LINK=String(data.__sheetUrl);
  if(data&&data.__pin!==undefined)setPinFlag(!!data.__pin);
  noteServerFlags(data);
  const sig=JSON.stringify(data||{});
  if(!forceRender&&Sync.snap&&sig===Sync.remoteSig)return false;
  Sync.remoteSig=sig;
  const before=JSON.stringify(stateToRows(state));
  const oldPlan=state&&state.plan&&state.plan.income>0&&state.plan.lines.length?state.plan:null;
  state=rowsToState(data);
  Sync.snap=snapshotOf(stateToRows(state));saveSnap();
  let planFix=typeof ensurePlanBudgets==='function'&&ensurePlanBudgets();
  /* Plan edited in the sheet: this month's budgets follow it, like saving My Plan in the app. */
  if(oldPlan&&hasPlan()&&JSON.stringify(oldPlan)!==JSON.stringify(state.plan)){
    const now=state.plan.lines.filter(l=>l.group!=='savings').map(l=>l.name);
    if(syncPlanBudgets(monthKey(TODAY()),oldPlan.lines.filter(l=>l.group!=='savings'&&now.indexOf(l.name)<0).map(l=>l.name)))planFix=true;
  }
  if(planFix){saveLocal();setTimeout(schedulePush,0);}
  saveLocal();
  const changed=JSON.stringify(stateToRows(state))!==before;
  if(changed||forceRender){
    safeRender();
    if(changed&&!forceRender){const ch=$('#syncChip');if(ch){ch.classList.remove('flash');void ch.offsetWidth;ch.classList.add('flash');}
      toast('Updated from your Google Sheet.');}
  }
  return changed;
}
function setSyncStatus(s,msg){Sync.status=s;Sync.err=msg||'';if(s==='ok'){Sync.lastOk=Date.now();Sync.err='';}updateSyncChip();}
function agoTxt(ms){const s=Math.round((Date.now()-ms)/1000);if(s<10)return 'just now';if(s<60)return s+'s ago';const m=Math.round(s/60);return m+'m ago';}
function updateSyncChip(){
  const ch=$('#syncChip'),tx=$('#syncTxt');if(!ch||!tx)return;
  let st=Sync.url?Sync.status:'off';
  if(Sync.url&&(Sync.pending||Sync.busy)&&st!=='error')st='saving';
  ch.className=st;
  tx.textContent=st==='off'?'Connect Sheet':st==='connecting'?'Connecting\u2026':st==='saving'?'Saving\u2026':st==='error'?'Sync Issue':('Synced '+(Sync.lastOk?agoTxt(Sync.lastOk):''));
  ch.title=st==='error'?Sync.err:(Sync.url?'Click to sync now. Auto-refresh every 15 seconds.':'Store your data in Google Sheets');
  const ft=$('#sbFootTxt');
  if(ft)ft.innerHTML=Sync.hosted?'Published from your Google Sheet.<br>Edits there appear here in ~15s.':(Sync.url?'Saved to your Google Sheet.<br>Edits there appear here in ~15s.':'Your data stays in this browser only.<br>Connect Google Sheets in Settings.');
}
function schedulePush(){
  if(!Sync.url||!Sync.snap)return;
  Sync.pending=true;updateSyncChip();
  clearTimeout(Sync.pushTimer);Sync.pushTimer=setTimeout(pushNow,500);
}
async function pushNow(){
  if(!Sync.url||!Sync.snap||Sync.locked)return;
  if(Sync.busy){Sync.again=true;return;}
  const d=diffOps();
  if(!d.ops.length){Sync.pending=false;if(Sync.status!=='error')setSyncStatus('ok');else updateSyncChip();return;}
  Sync.busy=true;updateSyncChip();
  const sentSnap=snapshotOf(d.rows);
  try{
    await api({action:'apply',ops:d.ops});
    Sync.snap=sentSnap;saveSnap();
    Sync.remoteSig='';
    if(!Sync.again)Sync.pending=false;
    setSyncStatus('ok');
  }catch(e){
    if(e.locked)return;
    setSyncStatus('error',e.message);
    toast(e.message===OFFLINE_MSG?e.message:'Couldn\u2019t save to Google Sheet: '+e.message+' Will retry.',e.message===OFFLINE_MSG?'':'err');
  }finally{
    Sync.busy=false;
    if(Sync.again){Sync.again=false;pushNow();}
    else updateSyncChip();
  }
}
async function pull(force){
  if(!Sync.url||Sync.busy||Sync.pulling||Sync.locked)return;
  if(!force&&(Sync.pending||document.hidden||modalOpen()))return;
  Sync.pulling=true;
  if(force)updateSyncChip();
  try{
    const res=await api({action:'read'});
    if(Sync.pending||Sync.busy)return;
    applyRemote(res.data,!Sync.snap);
    setSyncStatus('ok');
  }catch(e){if(!e.locked){setSyncStatus('error',e.message);if(force)toast(e.message,'err');}}
  finally{Sync.pulling=false;}
}
function validateUrl(url){
  url=String(url||'').trim();
  if(/docs\.google\.com\/spreadsheets/.test(url))throw new Error('That\u2019s the sheet link. You need the Web app URL from Deploy (it starts with https://script.google.com/macros/s/ and ends with /exec).');
  if(!/^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec\/?$/.test(url))throw new Error('That doesn\u2019t look like a Web app URL. It should start with https://script.google.com/macros/s/ and end with /exec. (If it ends with /dev, use Deploy \u2192 New deployment instead of Test deployments.)');
  return url.replace(/\/$/,'');
}
async function initSheet(mode){
  closeModal();
  if(mode==='demo'){seedDemo();ui.month=monthKey(TODAY());}
  else if(mode==='empty')state=blankState();
  saveLocal();render();
  Sync.busy=true;setSyncStatus('saving');
  try{
    const res=await api({action:'replace',data:stateToRows(state)});
    Sync.busy=false;Sync.pending=false;Sync.snap=null;
    applyRemote(res.data,true);setSyncStatus('ok');
    toast(mode==='plan'?'Your plan is set up and saved to your Google Sheet.':mode==='demo'?'Demo data saved to your Google Sheet. Open it to see the tabs!':mode==='empty'?'Your sheet is set up and empty \u2014 start by adding an account.':'Your app data is now in the Google Sheet.','ok');
    if(mode==='empty')nav('accounts');
  }catch(e){Sync.busy=false;setSyncStatus('error',e.message);toast('Couldn\u2019t write to the sheet: '+e.message,'err');}
}
function openInitChoice(){
  openModal({title:I('check',18)+' Connected! Your sheet is empty',body:
  '<p style="font-size:13.5px;margin-bottom:14px">The script created the tabs (Accounts, Transactions, Budgets, Bills, Goals, Categories, Settings). What should go in them?</p>'+
  '<button class="choice" data-act="sheet-init" data-mode="demo"><span class="ci">'+I('sparkle',18)+'</span><span><b>Load demo data (recommended to explore)</b><span>Six months of sample Filipino budget data, so every chart and button has something to show. You can erase it later in Settings.</span></span></button>'+
  '<button class="choice" data-act="sheet-init" data-mode="empty"><span class="ci">'+I('inbox',18)+'</span><span><b>Start empty</b><span>A clean slate for your real accounts and transactions.</span></span></button>'+
  (state.transactions.length?'<button class="choice" data-act="sheet-init" data-mode="current"><span class="ci">'+I('ul',18)+'</span><span><b>Upload what\u2019s in this app now</b><span>'+state.transactions.length+' transactions and '+state.accounts.length+' accounts currently in this browser.</span></span></button>':''),
  foot:''});
}
function openSetupWizard(){
  try{localStorage.setItem(SYNC_SEEN_KEY,'1');}catch(e){}
  const code=gasCode();
  openModal({wide:true,noFocus:true,title:I('sheet',18)+' Connect your Google Sheet',body:
  (inPreview()?'<div class="alert-inline">'+I('alert',16)+'<span><b>You’re viewing this inside a preview window.</b> Previews often block internet access, so connecting may fail. For best results, download <b>badyet.html</b> and open it directly in Chrome.</span></div>':'')+
  '<p style="font-size:13.5px;margin-bottom:16px">Badyet will save everything into your Google Sheet, and anything you change in the sheet shows up here within about 15 seconds. It\u2019s a one-time setup, about 2 minutes.</p>'+
  '<ol class="steps">'+
  '<li><b>Open your sheet</b><span class="muted">Then in the menu click <span class="kbd">Extensions</span> \u2192 <span class="kbd">Apps Script</span>. A code editor opens in a new tab.</span></li>'+
  '<li><b>Paste the bridge script</b><span class="muted">Delete everything already in the editor, paste the script, then press <span class="kbd">Ctrl+S</span> (or <span class="kbd">\u2318+S</span>) to save.</span><div style="margin-top:8px" class="split-btns"><button class="btn btn-sm btn-primary" data-act="copy-gas">'+I('copy',14)+' Copy script</button><button class="btn btn-sm" data-act="dl-gas">'+I('dl',14)+' Download Code.gs</button></div><div class="codebox">'+esc(code.split('\n').slice(0,12).join('\n'))+'\n\u2026 ('+code.split('\n').length+' lines)</div></li>'+
  '<li><b>Publish it as a web app</b><span class="muted">Click the blue <span class="kbd">Deploy</span> button \u2192 <span class="kbd">New deployment</span> \u2192 gear icon \u2192 <span class="kbd">Web app</span>. Set <b>Execute as: Me</b> and <b>Who has access: Anyone</b>, then <span class="kbd">Deploy</span>.<br>Google asks for permission: pick your account \u2192 <i>Advanced</i> \u2192 <i>Go to (project name) (unsafe)</i> \u2192 <i>Allow</i>. It says \u201cunsafe\u201d only because Google hasn\u2019t reviewed a script you added yourself.</span></li>'+
  '<li><b>Paste the Web app URL here</b><span class="muted">Copy the URL Google shows you (starts with https://script.google.com/macros/s/ and ends with /exec).</span>'+
  '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><input class="inp" id="gasUrl" style="flex:1;min-width:240px" placeholder="https://script.google.com/macros/s/\u2026/exec" value="'+esc(Sync.url)+'"><button class="btn btn-teal" id="gasGo">'+I('link',15)+' Connect</button><button class="btn" id="gasTest">'+I('ext',15)+' Test my link</button></div><div class="form-err" id="gasErr" style="margin-top:8px"></div></li>'+
  '</ol>'+
  '<details class="expl" id="gasHelp" style="margin-bottom:12px"><summary>Not connecting? Click “Test my link” and compare what you see</summary><ol>'+
  '<li><b>Text starting with {"ok":true</b> — the script works. If Connect still fails, you’re probably viewing this page inside a preview: download <b>badyet.html</b> and open it directly in Chrome.</li>'+
  '<li><b>“Script function not found: doGet”</b> — the script wasn’t saved before deploying. Paste it again, press Ctrl+S, then Deploy → <b>Manage deployments</b> → pencil → Version: <b>New version</b> → Deploy.</li>'+
  '<li><b>A Google sign-in page, or “You need access”</b> — “Who has access” is set to “Anyone with Google account” or “Only myself”. Change it to <b>Anyone</b> (Manage deployments → pencil).</li>'+
  '<li><b>“Sorry, unable to open the file at this time”</b> — you’re signed into several Google accounts. Open the link in an Incognito window to test, or redo the setup while signed into only the account that owns the sheet.</li>'+
  '<li><b>“Authorization is required”</b> — open Apps Script, choose <b>testSetup</b> in the toolbar, click <b>Run</b>, and allow the permissions.</li>'+
  '<li><b>Work or school Google account</b> — your organisation may not allow “Anyone”. Use a personal Gmail account to own the sheet instead.</li>'+
  '</ol><div style="margin-top:6px">Changed the script after deploying? Always publish a <b>New version</b> (Manage deployments → pencil → Version: New version) — Google keeps running the old one otherwise.</div></details>'+
  '<div class="note">Keep that URL private: anyone who has it could read or change your budget data.</div>',
  foot:'<button class="btn" data-act="modal-close">I\u2019ll do this later</button>',
  onMount:function(){
    const go=$('#gasGo');
    $('#gasUrl').addEventListener('keydown',function(e){if(e.key==='Enter')go.click();});
    $('#gasTest').addEventListener('click',function(){
      const err=$('#gasErr');err.classList.remove('show');
      let url;try{url=validateUrl($('#gasUrl').value);}catch(e){err.textContent=e.message;err.classList.add('show');return;}
      window.open(url,'_blank','noopener');
      $('#gasHelp').open=true;
    });
    go.addEventListener('click',function(){connectWith($('#gasUrl').value,$('#gasErr'),go,function(){const h=$('#gasHelp');if(h)h.open=true;});});
  }});
}
/* Connect to a web app link. A sheet with data is loaded as-is (nothing local is pushed over it). */
async function connectWith(raw,err,btn,onFail){
  err.classList.remove('show');
  let url;
  try{url=validateUrl(raw);}catch(e){err.textContent=e.message;err.classList.add('show');return;}
  const label=btn.innerHTML;btn.disabled=true;btn.innerHTML='Connecting\u2026';
  const keep=function(){Sync.url=url;try{localStorage.setItem(SYNC_KEY,url);}catch(e){}Sync.snap=null;Sync.remoteSig='';};
  try{
    const res=await api({action:'read'},url);
    keep();
    const d=res.data||{};
    const empty=!(d.Accounts||[]).length&&!(d.Transactions||[]).length;
    if(empty){setSyncStatus('ok');closeModal();openSetup({fresh:true});}
    else{applyRemote(d,true);setSyncStatus('ok');closeModal();render();toast('Connected! Loaded '+state.transactions.length+' transactions from your sheet.','ok');}
  }catch(e){
    if(e.locked){keep();updateSyncChip();return;}   // PIN screen is showing; unlocking loads the data
    err.textContent=e.message;err.classList.add('show');
    if(onFail)onFail();
    btn.disabled=false;btn.innerHTML=label;
  }
}
/* Installed app (GitHub Pages): the short version, for people who already have their link. */
function openConnectSimple(){
  try{localStorage.setItem(SYNC_SEEN_KEY,'1');}catch(e){}
  openModal({title:'Connect Your Sheet',body:
    '<p style="font-size:14px;margin:0 0 14px">Paste your Badyet app link: the one that ends in <b>/exec</b>. Find it in Apps Script under <span class="kbd">Deploy</span> \u2192 <span class="kbd">Manage deployments</span>.</p>'+
    '<div class="form-err" id="cxErr"></div>'+
    '<div class="field"><label for="cxUrl">App link</label><input class="inp" id="cxUrl" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/\u2026/exec" value="'+esc(Sync.url)+'"></div>'+
    '<div class="note">The link is saved only on this device, never in the app\u2019s files. Your data stays in your Google Sheet.</div>',
    foot:'<button class="btn" data-act="sync-guide">First time? Full setup</button><span style="flex:1"></span><button class="btn btn-primary" id="cxGo">'+I('link',15)+' Connect</button>',
    onMount:function(){
      const go=$('#cxGo');
      $('#cxUrl').addEventListener('keydown',function(e){if(e.key==='Enter')go.click();});
      go.addEventListener('click',function(){connectWith($('#cxUrl').value,$('#cxErr'),go);});
    }});
}
function disconnectSheet(){
  Sync.url='';Sync.snap=null;Sync.remoteSig='';Sync.pending=false;
  try{localStorage.removeItem(SYNC_KEY);}catch(e){}
  setSyncStatus('off');render();
  toast('Disconnected. The app keeps a local copy; your sheet is untouched.');
}
function syncPanelHTML(){
  if(Sync.hosted){
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>'+I('sheet',16)+' Google Sheet storage</h3><span class="badge b-ok">connected</span></div><div class="panel-body">'+
    '<div class="note teal" style="margin-bottom:12px">'+I('check',15)+' This app is published straight from your Google Sheet, so it reads and writes your sheet directly \u2014 no link to paste and nothing to connect. Changes you make in the sheet appear here within about 15 seconds.</div>'+
    '<div class="grid g-2" style="margin-bottom:6px"><div>'+
    '<div class="kv"><span class="k">Last synced</span><span class="v">'+(Sync.lastOk?agoTxt(Sync.lastOk):'\u2014')+'</span></div>'+
    '<div class="kv"><span class="k">Checks the sheet</span><span class="v">every 15 seconds</span></div>'+
    '<div class="kv"><span class="k">App changes saved</span><span class="v">within ~1 second</span></div>'+
    '</div><div class="note"><b>Editing In The Sheet</b><ul>'+
    '<li>New row: leave the <b>ID</b> blank. It fills in by itself.</li>'+
    '<li>Pick categories and accounts from the dropdowns. The grey ID columns fill in by themselves.</li>'+
    '<li>Delete a row to delete that record.</li>'+
    '<li>The <b>Guide</b> tab in the sheet explains every tab.</li></ul></div></div>'+
    '<div class="split-btns"><button class="btn btn-teal" data-act="sync-now">'+I('refresh',15)+' Sync now</button>'+
    openSheetBtn()+
    '<button class="btn" data-act="sync-overwrite">'+I('ul',15)+' Re-upload app data to sheet</button></div>'+
    '</div></div>';
  }
  if(!Sync.url)return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>'+I('sheet',16)+' Google Sheet storage</h3><span class="badge b-mut">not connected</span></div><div class="panel-body">'+
    '<p style="font-size:13.5px;margin-bottom:12px">Save all your data in your Google Sheet and edit it from anywhere. Changes flow both ways automatically.</p>'+
    '<button class="btn btn-teal" data-act="sync-setup">'+I('link',15)+' Connect Google Sheet</button></div></div>';
  const st=Sync.status;
  const badge=st==='error'?'<span class="badge b-over">problem</span>':(Sync.pending||Sync.busy)?'<span class="badge b-watch">saving\u2026</span>':'<span class="badge b-ok">connected</span>';
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>'+I('sheet',16)+' Google Sheet storage</h3>'+badge+'</div><div class="panel-body">'+
  (st==='error'?'<div class="alert-inline">'+I('alert',16)+'<span><b>Last sync failed:</b> '+esc(Sync.err)+'</span></div>':'')+
  '<div class="grid g-2" style="margin-bottom:6px"><div>'+
  '<div class="kv"><span class="k">Last synced</span><span class="v">'+(Sync.lastOk?agoTxt(Sync.lastOk):'\u2014')+'</span></div>'+
  '<div class="kv"><span class="k">Checks the sheet for changes</span><span class="v">every 15 seconds</span></div>'+
  '<div class="kv"><span class="k">App changes saved</span><span class="v">within ~1 second</span></div>'+
  '<div class="kv"><span class="k">Web app URL</span><span class="v" style="font-weight:500;font-size:12px;text-transform:none">\u2026'+esc(Sync.url.slice(-26))+'</span></div>'+
  '</div><div class="note"><b>Editing in the sheet</b><ul>'+
  '<li>New row: leave <b>id</b> blank \u2014 it fills in by itself.</li>'+
  '<li>Delete a row to delete that record.</li>'+
  '<li>Account columns use the account <b>name</b> exactly as in the Accounts tab.</li>'+
  '<li>Dates as <b>2026-10-14</b>; budget month as <b>2026-10</b>.</li>'+
  '<li>Type: income, expense, transfer, cc_payment or refund.</li></ul></div></div>'+
  '<div class="split-btns">'+
  '<button class="btn btn-teal" data-act="sync-now">'+I('refresh',15)+' Sync now</button>'+
  openSheetBtn()+
  '<button class="btn" data-act="sync-setup">'+I('link',15)+' Change URL / setup guide</button>'+
  '<button class="btn" data-act="sync-overwrite">'+I('ul',15)+' Re-upload app data to sheet</button>'+
  '<button class="btn btn-danger" data-act="sync-disconnect">'+I('unlink',15)+' Disconnect</button>'+
  '</div></div></div>';
}

/* ================= COLOR THEME ================= */
const darkQuery=(window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null);
function applyTheme(){
  const t=(state&&state.settings&&state.settings.theme)||'light';
  const sysDark=!!(darkQuery&&darkQuery.matches);
  const dark=t==='dark'||(t==='auto'&&sysDark);
  const root=document.documentElement,want=dark?'dark':'light';
  root.setAttribute('data-theme',want);
  root.style.colorScheme=want;
  if(document.body){document.body.setAttribute('data-theme',want);document.body.style.colorScheme=want;}
  const m=document.getElementById('metaTheme');if(m)m.setAttribute('content',dark?'#000000':'#ffffff');
  try{localStorage.setItem('badyet_theme',want);}catch(e){}
}
if(darkQuery){const onChange=function(){if(state&&state.settings.theme==='auto')applyTheme();};
  if(darkQuery.addEventListener)darkQuery.addEventListener('change',onChange);else if(darkQuery.addListener)darkQuery.addListener(onChange);}

/* ================= QUICK ADD (keypad) ================= */
let qa=null;
function qaAccounts(type){return state.accounts.filter(function(a){return !a.archived&&(type==='income'?ASSETS.includes(a.type):(ASSETS.includes(a.type)||a.type==='credit'));});}
function qaCats(type){
  const cats=type==='income'?state.settings.incomeCats.slice():state.settings.expenseCats.map(function(c){return c.name;}).filter(function(n){return n!=='Reconciliation';});
  const cnt={},from=addDaysISO(TODAY(),-60);
  for(const t of state.transactions)if(t.type===type&&t.date>=from)cnt[t.category]=(cnt[t.category]||0)+1;
  return cats.sort(function(a,b){return (cnt[b]||0)-(cnt[a]||0);});
}
function qaDefaultAcc(type){
  let id=null;try{id=localStorage.getItem('badyet_qa_acc_'+type);}catch(e){}
  const list=qaAccounts(type);
  const a=list.find(function(x){return x.id===id;})||list.find(function(x){return x.type==='bank'||x.type==='ewallet';})||list[0];
  return a?a.id:'';
}
function openQuickAdd(){
  if(!state.accounts.filter(function(a){return !a.archived;}).length){openTxnModal(null);return;}
  qa={type:'expense',date:TODAY(),amt:'',cat:qaCats('expense')[0],acc:qaDefaultAcc('expense'),note:'',catPicked:false,accPicked:false};
  openModal({title:'Add',body:'<div class="qa" id="qaRoot"></div>',noFocus:true});
  qaDraw();
}
function qaAmtText(){
  if(!qa.amt)return '₱0';
  const p=qa.amt.split('.');
  return '₱'+Number(p[0]||'0').toLocaleString('en-PH')+(p.length>1?'.'+p[1]:'');
}
function qaDraw(){
  const root=$('#qaRoot');if(!root||!qa)return;
  const days=[];for(let i=-4;i<=0;i++)days.push(addDaysISO(TODAY(),i));
  root.innerHTML=
    '<div class="qa-tanks" role="group" aria-label="Quick Tanks">'+
      [['needs','Needs','Spend'],['wants','Wants','Spend'],['debts','Debts','Subtract'],['savings','Savings','Add / −']].map(function(tk){
        return '<button type="button" class="qa-tank-btn" data-act="tank-open" data-tank="'+tk[0]+'"><span>'+tk[1]+'</span><small>'+tk[2]+'</small></button>';
      }).join('')+
    '</div>'+
    '<div class="seg" role="tablist">'+['expense','income'].map(function(t){return '<button data-act="qa-type" data-t="'+t+'"'+(qa.type===t?' class="on"':'')+'>'+t+'</button>';}).join('')+'</div>'+
    '<div class="qa-days">'+days.map(function(x){const dt=parseISO(x);
      return '<button class="qa-day'+(qa.date===x?' on':'')+'" data-act="qa-day" data-d="'+x+'"><b>'+dt.getDate()+'</b><small>'+(relDays(x)===0?'Today':WD[dt.getDay()])+'</small></button>';}).join('')+'</div>'+
    '<div class="qa-amt"><span class="v'+(qa.amt?'':' zero')+'" id="qaAmt">'+qaAmtText()+'</span>'+
      '<button class="icon-btn" id="qaDel" data-act="qa-key" data-k="del" aria-label="Delete last digit" style="visibility:'+(qa.amt?'visible':'hidden')+'">'+I('chevL',20)+'</button></div>'+
    '<div class="qa-cats">'+qaCats(qa.type).map(function(c){return '<button class="qa-cat'+(qa.cat===c?' on':'')+'" data-act="qa-cat" data-c="'+esc(c)+'"><span class="e" aria-hidden="true">'+catEmoji(c,qa.type)+'</span>'+esc(c)+'</button>';}).join('')+'</div>'+
    '<div class="qa-row"><select class="inp" data-chg="qa-acc" aria-label="Account">'+qaAccounts(qa.type).map(function(a){return '<option value="'+esc(a.id)+'"'+(a.id===qa.acc?' selected':'')+'>'+(qa.type==='income'?'To ':'From ')+esc(a.name)+'</option>';}).join('')+'</select>'+
      '<input class="inp" data-inp="qa-note" placeholder="Where? (e.g. Jollibee)" aria-label="Description" maxlength="80" autocomplete="off" list="qaDescList" value="'+esc(qa.note)+'">'+
      '<datalist id="qaDescList">'+knownDescriptions(qa.type).map(function(d){return '<option value="'+esc(d)+'">';}).join('')+'</datalist></div>'+
    '<div class="mem-hint" id="qaMem"></div>'+
    '<div class="qa-keys">'+['1','2','3','4','5','6','7','8','9','.','0','ok'].map(function(k){
      return k==='ok'?'<button class="qa-key ok" data-act="qa-save" aria-label="Save">'+I('check',26)+'</button>':'<button class="qa-key" data-act="qa-key" data-k="'+k+'">'+k+'</button>';}).join('')+'</div>'+
    '<button class="qa-more" data-act="qa-more">Transfer, Card Payment Or More Details</button>';
  const on=root.querySelector('.qa-cat.on');if(on&&on.scrollIntoView)try{on.scrollIntoView({block:'nearest',inline:'center'});}catch(e){}
}
function qaRecall(){
  const hint=$('#qaMem');if(!qa||!hint)return;
  const m=recallFor(qa.note,qa.type);
  if(!m){hint.textContent='';return;}
  const got=[];
  if(!qa.catPicked&&m.category&&qaCats(qa.type).indexOf(m.category)>=0){
    qa.cat=m.category;got.push(m.category);
    document.querySelectorAll('.qa-cat').forEach(function(b){b.classList.toggle('on',b.dataset.c===m.category);});
    const on=document.querySelector('.qa-cat.on');if(on&&on.scrollIntoView)try{on.scrollIntoView({block:'nearest',inline:'center'});}catch(e){}
  }
  if(!qa.accPicked&&m.account&&qaAccounts(qa.type).some(function(a){return a.id===m.account;})){
    qa.acc=m.account;got.push(acctName(m.account));
    const sel=document.querySelector('[data-chg="qa-acc"]');if(sel)sel.value=m.account;
  }
  hint.innerHTML=got.length?I('sparkle',13)+' Remembered: '+esc(got.join(' \u00b7 ')):'';
}
function qaKey(k){
  if(!qa)return;
  let a=qa.amt;
  if(k==='del')a=a.slice(0,-1);
  else if(k==='.'){if(a.indexOf('.')>=0)return;a=(a||'0')+'.';}
  else{
    if(a.indexOf('.')>=0&&a.split('.')[1].length>=2)return;
    if(a==='0')a='';
    if(a.indexOf('.')<0&&a.length>=9)return;
    a+=k;
  }
  qa.amt=a;
  const el=$('#qaAmt');if(el){el.textContent=qaAmtText();el.classList.toggle('zero',!a);}
  const del=$('#qaDel');if(del)del.style.visibility=a?'visible':'hidden';
}
function qaSave(){
  if(!qa)return;
  const amount=round2(parseFloat(qa.amt));
  if(!(amount>0)){toast('Type an amount first.','err');return;}
  const acc=accountById(qa.acc);
  if(!acc){toast('Pick an account first.','err');return;}
  const cat=qa.cat||(qa.type==='income'?'Other Income':'Other');
  const t={id:uid('TXN'),date:qa.date,type:qa.type,description:(qa.note||'').trim()||cat,amount:amount,category:cat,
    fromAccount:qa.type==='expense'?acc.id:null,toAccount:qa.type==='income'?acc.id:null,method:'',notes:'',tags:[],recurringId:null,refundOf:null};
  try{localStorage.setItem('badyet_qa_acc_'+qa.type,acc.id);}catch(e){}
  qa=null;closeModal();
  mutate(function(){state.transactions.push(t);});
  toast('Added '+money(amount)+' for '+cat,'ok');
}
function qaMore(){
  if(!qa)return;
  const p={type:qa.type,date:qa.date,category:qa.cat,description:qa.note,amount:qa.amt?round2(parseFloat(qa.amt)):''};
  if(qa.type==='expense')p.fromAccount=qa.acc;else p.toAccount=qa.acc;
  qa=null;closeModal();openTxnModal(null,p);
}
function openMore(){
  const od=overdueBills().length;
  const secs=['goals','accounts','settings'];
  openModal({title:'More',noFocus:true,body:'<div class="more-grid">'+secs.map(function(s){
    return '<button data-act="nav" data-sec="'+s+'"'+(ui.section===s?' class="on"':'')+'>'+I(SECTIONS[s].icon,22)+SECTIONS[s].title+(s==='bills'&&od?'<span class="dotb" aria-label="overdue"></span>':'')+'</button>';}).join('')+'</div>'});
}

/* ================= EVENT DISPATCH ================= */
let lastDown=null;
document.addEventListener('mousedown',function(e){lastDown=e.target;},true);
document.addEventListener('click',function(e){
  if(!(e.target instanceof Element))return;
  if(e.target.dataset&&e.target.dataset.backdrop){if(lastDown===e.target)closeModal();return;}
  const btn=e.target.closest('[data-act]');
  if(!btn||btn.disabled)return;
  const act=btn.dataset.act,d=btn.dataset;
  const findT=function(){return state.transactions.find(function(x){return x.id===d.id;});};
  switch(act){
    case 'modal-close':closeModal();break;
    case 'confirm-yes':{const cb=confirmCb;confirmCb=null;closeModal();if(cb)cb();break;}
    case 'nav':closeModal();nav(d.sec);break;
    case 'sb-toggle':document.body.classList.toggle('sb-collapsed');break;
    case 'sb-open':document.body.classList.add('sb-open');break;
    case 'sb-close':document.body.classList.remove('sb-open');break;
    case 'add-txn':case 'txn-add':closeModal();openQuickAdd();break;
    case 'more-open':openMore();break;
    case 'dash-metric':ui.dash.metric=d.m||'spent';render();break;
    case 'set-month':setMonth(d.k);break;
    case 'qa-type':if(qa&&qa.type!==d.t){qa.type=d.t;qa.cat=qaCats(d.t)[0];qa.acc=qaDefaultAcc(d.t);qa.catPicked=qa.accPicked=false;qaDraw();qaRecall();}break;
    case 'qa-day':if(qa){qa.date=d.d;document.querySelectorAll('.qa-day').forEach(function(b){b.classList.toggle('on',b.dataset.d===d.d);});}break;
    case 'qa-cat':if(qa){qa.cat=d.c;qa.catPicked=true;document.querySelectorAll('.qa-cat').forEach(function(b){b.classList.toggle('on',b.dataset.c===d.c);});}break;
    case 'qa-key':qaKey(d.k);break;
    case 'qa-save':qaSave();break;
    case 'qa-more':qaMore();break;
    case 'month-prev':setMonth(monthAdd(ui.month,-1));break;
    case 'month-next':setMonth(monthAdd(ui.month,1));break;
    case 'home-act-toggle':
      ui.dash.showActivity=!ui.dash.showActivity;
      render();
      if(ui.dash.showActivity){const sec=document.getElementById('homeActivitySec');if(sec&&sec.scrollIntoView)sec.scrollIntoView({behavior:'smooth',block:'start'});}
      break;
    case 'set-theme':{
      const v=d.v||'light';
      mutate(function(){state.settings.theme=v;applyTheme();});
      toast((v==='auto'?'Theme follows your device':v==='dark'?'Dark theme on':'Light theme on')+'.','ok');
      break;}
    case 'drill':
      closeModal();
      ui.txn=freshTxnFilter({q:(d.q||''),type:(d.type||''),cat:(d.cat||''),acc:(d.acc||''),from:(d.from||''),to:(d.to||'')});
      ui.dash.showActivity=true;
      nav('dashboard');
      setTimeout(function(){const sec=document.getElementById('homeActivitySec');if(sec&&sec.scrollIntoView)sec.scrollIntoView({behavior:'smooth',block:'start'});},40);
      break;
    case 'txn-view':openTxnDetail(d.id);break;
    case 'txn-edit':{const t=findT();closeModal();if(t)openTxnModal(t);break;}
    case 'txn-dup':{const t=findT();closeModal();if(t)openTxnModal(null,{type:t.type,category:t.category,fromAccount:t.fromAccount,toAccount:t.toAccount,description:t.description,amount:t.amount});break;}
    case 'txn-del':{const t=findT();if(!t)break;
      confirmDialog('Delete transaction?','Delete \u201c'+esc(t.description)+'\u201d ('+money(t.amount)+') on '+fmtDate(t.date)+'? Balances, budgets and reports will update.','Delete',true,function(){
        mutate(function(){state.transactions=state.transactions.filter(function(x){return x.id!==d.id;});});
        toast('Transaction deleted.','ok');});break;}
    case 'txn-refund':{const t=findT();if(!t)break;closeModal();
      const fa=accountById(t.fromAccount);
      openTxnModal(null,{type:'refund',category:t.category,refundOf:t.id,toAccount:fa?fa.id:null,description:'Refund \u2014 '+t.description,amount:t.amount});break;}
    case 'tx-sort':
      if(ui.txn.sort===d.f)ui.txn.dir=(ui.txn.dir==='asc'?'desc':'asc');
      else{ui.txn.sort=d.f;ui.txn.dir=d.f==='description'?'asc':'desc';}
      updateTxnTable();break;
    case 'tx-page':ui.txn.page+=Number(d.d)||0;updateTxnTable();window.scrollTo({top:0,behavior:'smooth'});break;
    case 'tx-clear':ui.txn=freshTxnFilter();render();break;
    case 'tx-export':
      if(ui.section==='analytics')exportCSVTxns(monthTxns(ui.month),ui.month);
      else if(ui.section==='transactions')exportCSVTxns(filteredTxns(),'filtered-'+TODAY());
      else exportCSVTxns();
      break;
    case 'report-print':printReport();break;
    case 'acc-add':closeModal();openAccountModal(null,d.type);break;
    case 'acc-edit':{const a=accountById(d.id);if(a)openAccountModal(a);break;}
    case 'acc-hist':ui.txn=freshTxnFilter({acc:d.id});ui.dash.showActivity=true;nav('dashboard');setTimeout(function(){const sec=document.getElementById('homeActivitySec');if(sec&&sec.scrollIntoView)sec.scrollIntoView({behavior:'smooth',block:'start'});},40);break;
    case 'acc-arch':{const a=accountById(d.id);if(!a)break;const willArch=!a.archived;
      mutate(function(){a.archived=willArch;});toast(willArch?'Account archived (history kept).':'Account restored.');break;}
    case 'acc-del':{const a=accountById(d.id);if(!a)break;
      const used=state.transactions.some(function(t){return t.fromAccount===a.id||t.toAccount===a.id;})||state.recurring.some(function(r){return r.account===a.id;});
      if(used){toast('This account is used by transactions or schedules. Archive it instead.','err');break;}
      confirmDialog('Delete account?','Delete \u201c'+esc(a.name)+'\u201d? It has no transactions.','Delete',true,function(){
        mutate(function(){state.accounts=state.accounts.filter(function(x){return x.id!==a.id;});});toast('Account deleted.','ok');});break;}
    case 'acc-recon':openReconcileModal(d.id);break;
    case 'bud-add':closeModal();openBudgetModal(null,d.cat);break;
    case 'bud-edit':{const b=state.budgets.find(function(x){return x.id===d.id;});closeModal();if(b)openBudgetModal(b);break;}
    case 'bud-del':{const b=state.budgets.find(function(x){return x.id===d.id;});if(!b)break;
      confirmDialog('Delete budget?','Remove the '+b.scope+' budget for '+esc(b.category==='__total__'?'overall total':b.category)+' ('+monthLabel(b.month)+')?','Delete',true,function(){
        mutate(function(){state.budgets=state.budgets.filter(function(x){return x.id!==d.id;});});toast('Budget removed.','ok');});break;}
    case 'bud-copy-prev':{const pk=monthAdd(ui.month,-1);let n=0;
      mutate(function(){for(const b of rawBudgetsFor(pk)){if(!state.budgets.some(function(x){return x.month===ui.month&&x.category===b.category&&x.scope===b.scope;})){state.budgets.push(Object.assign({},b,{id:uid('BUD'),month:ui.month}));n++;}}});
      toast(n?('Copied '+n+' budget(s) from '+monthLabel(pk)+'.'):('Nothing new to copy from '+monthLabel(pk)+'.'),n?'ok':'');break;}
    case 'bud-copy-next':{const nk=monthAdd(ui.month,1);let n=0;
      mutate(function(){for(const b of rawBudgetsFor(ui.month)){if(!state.budgets.some(function(x){return x.month===nk&&x.category===b.category&&x.scope===b.scope;})){state.budgets.push(Object.assign({},b,{id:uid('BUD'),month:nk}));n++;}}});
      toast(n?('Copied '+n+' budget(s) to '+monthLabel(nk)+'.'):('Budgets for '+monthLabel(nk)+' already exist.'),n?'ok':'');break;}
    case 'an-hist':ui.an.hist=Number(d.n)||6;render();break;
    case 'cat-toggle':mutate(function(){const c=state.settings.expenseCats.find(function(x){return x.name===d.cat;});if(c)c.essential=!c.essential;});break;
    case 'cat-del':{const used=state.transactions.some(function(t){return t.category===d.cat;})||state.budgets.some(function(b){return b.category===d.cat;})||state.recurring.some(function(r){return r.category===d.cat;});
      if(used){toast('\u201c'+d.cat+'\u201d is still used by transactions, budgets or schedules, so it can\u2019t be deleted.','err');break;}
      confirmDialog('Delete category?','Delete the category \u201c'+esc(d.cat)+'\u201d?','Delete',true,function(){
        mutate(function(){state.settings.expenseCats=state.settings.expenseCats.filter(function(c){return c.name!==d.cat;});
          state.settings.incomeCats=state.settings.incomeCats.filter(function(c){return c!==d.cat;});});toast('Category removed.','ok');});break;}
    case 'cat-add':{const nm=((($('#newCatName')||{}).value)||'').trim();const kind=($('#newCatKind')||{}).value||'expense';const ess=($('#newCatEss')||{}).checked;
      if(!nm){toast('Type a category name first.','err');break;}
      if(state.settings.expenseCats.some(function(c){return c.name.toLowerCase()===nm.toLowerCase();})||state.settings.incomeCats.some(function(c){return c.toLowerCase()===nm.toLowerCase();})){toast('That category already exists.','err');break;}
      mutate(function(){if(kind==='income')state.settings.incomeCats.push(nm);else state.settings.expenseCats.push({name:nm,essential:!!ess});});toast('Category \u201c'+nm+'\u201d added.','ok');break;}
    case 'anom-except':mutate(function(){if(!state.exceptions.includes(d.id))state.exceptions.push(d.id);});toast('Got it \u2014 excluded from unusual-spending checks and averages.');break;
    case 'fc-horizon':ui.fc.horizon=Number(d.h)||1;render();break;
    case 'fc-reset':ui.scenario={incomePct:0,diningCut:0,oneTime:0,oneTimeWhen:1,monthlyAdj:0};render();break;
    case 'goal-add':openGoalModal(null);break;
    case 'goal-edit':{const g=state.goals.find(function(x){return x.id===d.id;});closeModal();if(g)openGoalModal(g);break;}
    case 'goal-del':{const g=state.goals.find(function(x){return x.id===d.id;});if(!g)break;
      confirmDialog('Delete goal?','Delete \u201c'+esc(g.name)+'\u201d? Any transfers you recorded stay in your history.','Delete',true,function(){
        mutate(function(){state.goals=state.goals.filter(function(x){return x.id!==d.id;});});toast('Goal deleted.','ok');});break;}
    case 'goal-contrib':openContribModal(d.id);break;
    case 'debt-pay':{const a=accountById(d.id);if(!a)break;
      const bank=state.accounts.find(function(x){return !x.archived&&x.type==='bank';});
      openTxnModal(null,{type:'cc_payment',toAccount:a.id,fromAccount:bank?bank.id:'',description:'Payment \u2014 '+a.name,amount:(Math.min(a.plannedPayment||a.minPayment||0,Math.max(0,accountBalance(a.id)))||'')});break;}
    case 'rec-add':openRecurringModal(null);break;
    case 'rec-edit':{const r=state.recurring.find(function(x){return x.id===d.id;});if(r)openRecurringModal(r);break;}
    case 'rec-del':{const r=state.recurring.find(function(x){return x.id===d.id;});if(!r)break;
      confirmDialog('Delete schedule?','Delete \u201c'+esc(r.description)+'\u201d? Past transactions stay; only future scheduling is removed.','Delete',true,function(){
        mutate(function(){state.recurring=state.recurring.filter(function(x){return x.id!==d.id;});});toast('Schedule deleted.','ok');});break;}
    case 'rec-toggle':{let now='';mutate(function(){const r=state.recurring.find(function(x){return x.id===d.id;});if(r){r.status=r.status==='active'?'paused':'active';now=r.status;}});toast(now==='paused'?'Schedule paused.':'Schedule resumed.');break;}
    case 'rec-skip':{const r=state.recurring.find(function(x){return x.id===d.id;});if(!r||!r.nextDue)break;
      const nd=r.nextDue,rid=r.id;
      confirmDialog('Skip this one?','Skip \u201c'+esc(r.description)+'\u201d due '+fmtDate(nd)+'? Nothing is recorded and it moves to the next date.','Skip',false,function(){
        mutate(function(){const rr=state.recurring.find(function(x){return x.id===rid;});if(rr)advanceRecurring(rr,nd);});toast('Skipped.','ok');});break;}
    case 'rec-paid':{const r=state.recurring.find(function(x){return x.id===d.id;});if(!r||!r.nextDue)break;
      openTxnModal(null,{type:r.type,date:(r.nextDue<=TODAY()?TODAY():r.nextDue),category:r.category,fromAccount:(r.type==='expense'?r.account:null),toAccount:(r.type==='income'?r.account:null),description:r.description,amount:r.amount,recurringId:r.id});break;}
    case 'ins-dismiss':mutate(function(){if(!state.dismissed.includes(d.key))state.dismissed.push(d.key);});toast('Dismissed. You can bring it back in Settings.');break;
    case 'ins-restore':mutate(function(){state.dismissed=[];});toast('Dismissed alerts restored.','ok');break;
    case 'set-export-csv':exportCSVTxns();break;
    case 'set-export-json':exportJSON();break;
    case 'pin-set':openPinModal();break;
    case 'acc-enable':Sync.locked=false;showAuth('enable');break;
    case 'acc-pass':openChangePassword();break;
    case 'acc-logout':confirmDialog('Log out?','You\u2019ll need your username or email and password to get back in on this phone.','Log out',false,function(){closeModal();logOut();});break;
    case 'pin-lock':pinLockNow();break;
    case 'pin-off':confirmDialog('Turn off PIN lock?','Anyone with your app link will be able to open it again.','Turn off',true,function(){closeModal();pinOff();});break;
    case 'set-reset-demo':confirmDialog('Reset to demo data?','This replaces all your current data'+(Sync.url?' (including your Google Sheet)':'')+' with the sample dataset.','Reset to demo',true,function(){
      seedDemo();ui.month=monthKey(TODAY());refresh();toast('Demo data restored.','ok');});break;
    case 'set-wipe':confirmDialog('Erase everything?','This permanently deletes all accounts, transactions, budgets, schedules and goals'+(Sync.url?' <b>from this app and your Google Sheet</b>':'')+'. Download a backup first if you might need it.','Erase all data',true,function(){
      state=blankState();ui.month=monthKey(TODAY());refresh();toast('All data erased.','ok');});break;
    /* --- Google Sheets --- */
    case 'sync-chip':
      if(!Sync.url){if(PWA)openConnectSimple();else openSetupWizard();break;}
      if(Sync.status==='error'&&Sync.pending){pushNow();break;}
      Sync.remoteSig='';pull(true).then(function(){if(Sync.status==='ok')toast('Synced with your Google Sheet.','ok');});break;
    case 'sync-now':
      if(Sync.pending){pushNow();break;}
      Sync.remoteSig='';pull(true).then(function(){if(Sync.status==='ok')toast('Synced with your Google Sheet.','ok');render();});break;
    case 'sync-setup':closeModal();if(PWA)openConnectSimple();else openSetupWizard();break;
    case 'sync-guide':closeModal();openSetupWizard();break;
    case 'pwa-install':pwaInstall();break;
    case 'sync-disconnect':confirmDialog('Disconnect Google Sheet?','The app stops syncing. Your sheet keeps all its data, and this browser keeps a copy.','Disconnect',true,disconnectSheet);break;
    case 'sync-overwrite':confirmDialog('Re-upload everything?','This rewrites every tab in your Google Sheet with exactly what the app shows now. Use it if the sheet got messed up.','Re-upload',false,function(){initSheet('current');});break;
    case 'sheet-init':if(typeof closeSetup==='function'&&suOpen())closeSetup();initSheet(d.mode);break;
    case 'tank-open':closeModal();openTankModal(d.tank);break;
    case 'debt-congrats-open':closeModal();openDebtFreeCongratsModal();break;
    case 'debt-term-set':{
      const m=clamp(Number(d.m)||6,1,120);
      mutate(function(){
        const l=state.plan&&state.plan.lines.find(x=>x.id===d.id);
        if(l){l.months=m;l.amount=debtMonthlyAmt(l,state.plan.income);prunePaidDebts();syncPlanBudgets(monthKey(TODAY()),[]);}
      });
      toast('Adjusted debt payoff plan to '+m+' month(s).','ok');break;}
    case 'plan-setup':closeModal();openSetup({});break;
    case 'plan-btn':closeModal();openSetup(hasPlan()?{edit:true}:{});break;
    case 'plan-edit':closeModal();openSetup({edit:true});break;
    case 'copy-gas':{const code=gasCode();
      const fallback=function(){const ta=document.createElement('textarea');ta.value=code;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(x){}ta.remove();
        toast(ok?'Script copied \u2014 now paste it into Apps Script.':'Copy blocked by the browser \u2014 use Download instead.',ok?'ok':'err');};
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(function(){toast('Script copied \u2014 now paste it into Apps Script.','ok');},fallback);
      else fallback();
      break;}
    case 'dl-gas':download('Code.gs',gasCode(),'text/plain');toast('Code.gs downloaded.','ok');break;
  }
});
let qTimer=null;
document.addEventListener('input',function(e){
  const f=e.target.dataset&&e.target.dataset.inp;
  if(!f)return;
  if(f==='qa-note'&&qa){qa.note=e.target.value;qaRecall();return;}
  if(f==='txn-q'){clearTimeout(qTimer);qTimer=setTimeout(function(){ui.txn.q=e.target.value;ui.txn.page=1;updateTxnTable();},250);}
  if(f==='fc-income'){ui.scenario.incomePct=Number(e.target.value)||0;
    const sl=e.target.closest('.sl-row').querySelector('.slv');if(sl)sl.textContent=(ui.scenario.incomePct>0?'+':'')+ui.scenario.incomePct+'%';
    updateFcOut();}
  if(f==='fc-dining'){ui.scenario.diningCut=Number(e.target.value)||0;
    const sl=e.target.closest('.sl-row').querySelector('.slv');if(sl)sl.textContent=ui.scenario.diningCut+'%';
    updateFcOut();}
  if(f==='fc-onetime'){ui.scenario.oneTime=Math.max(0,Number(e.target.value)||0);updateFcOut();}
  if(f==='fc-monthly'){ui.scenario.monthlyAdj=Math.max(0,Number(e.target.value)||0);updateFcOut();}
});
document.addEventListener('change',function(e){
  const f=e.target.dataset&&e.target.dataset.chg;
  if(!f)return;
  switch(f){
    case 'dash-preset':ui.dash.preset=e.target.value;render();break;
    case 'qa-acc':if(qa){qa.acc=e.target.value;qa.accPicked=true;}break;
    case 'txn-sort':{const v=String(e.target.value).split('-');ui.txn.sort=v[0]||'date';ui.txn.dir=v[1]||'desc';ui.txn.page=1;updateTxnTable();break;}
    case 'dash-from':ui.dash.from=e.target.value;render();break;
    case 'dash-to':ui.dash.to=e.target.value;render();break;
    case 'txn-type':ui.txn.type=e.target.value;ui.txn.cat='';ui.txn.page=1;render();break;
    case 'txn-cat':ui.txn.cat=e.target.value;ui.txn.page=1;updateTxnTable();break;
    case 'txn-acc':ui.txn.acc=e.target.value;ui.txn.page=1;updateTxnTable();break;
    case 'txn-from':ui.txn.from=e.target.value;ui.txn.page=1;updateTxnTable();break;
    case 'txn-to':ui.txn.to=e.target.value;ui.txn.page=1;updateTxnTable();break;
    case 'fc-when':ui.scenario.oneTimeWhen=Number(e.target.value)||1;updateFcOut();break;
    case 'set-theme':{const v=e.target.value||'light';mutate(function(){state.settings.theme=v;applyTheme();});toast((v==='auto'?'Theme follows your device':v==='dark'?'Dark theme on':'Light theme on')+'.','ok');break;}
    case 'set-datefmt':mutate(function(){state.settings.dateFormat=e.target.value;});toast('Date format updated.','ok');break;
    case 'set-period':mutate(function(){state.settings.reportingPeriod=e.target.value;ui.dash.preset=e.target.value;});toast('Default period updated.','ok');break;
    case 'set-psd':{const v=clamp(Number(e.target.value)||1,1,28);mutate(function(){state.settings.monthStartDay=v;ui.month=monthKey(TODAY());});
      toast(v===1?'Budgets now follow the calendar month.':'Budget months now start on the '+ordinal(v)+'.','ok');break;}
    case 'set-warn':{const v=clamp(Number(e.target.value)||80,1,100);mutate(function(){state.settings.warnThreshold=v;});toast('Warning threshold set to '+v+'%.','ok');break;}
    case 'set-danger':{const v=clamp(Number(e.target.value)||100,1,200);mutate(function(){state.settings.dangerThreshold=v;});toast('Exceeded threshold set to '+v+'%.','ok');break;}
    case 'import-csv':{const file=e.target.files[0];e.target.value='';if(!file)return;
      const rd=new FileReader();rd.onload=function(){importCSV(String(rd.result));};rd.onerror=function(){toast('Could not read the file.','err');};rd.readAsText(file);break;}
    case 'import-json':{const file=e.target.files[0];e.target.value='';if(!file)return;
      const rd=new FileReader();rd.onload=function(){importJSON(String(rd.result));};rd.onerror=function(){toast('Could not read the file.','err');};rd.readAsText(file);break;}
  }
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&modalOpen()){closeModal();return;}
  if(qa&&$('#qaRoot')){
    const tg=e.target;if(tg&&/^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName))return;
    if(/^[0-9]$/.test(e.key)){qaKey(e.key);e.preventDefault();}
    else if(e.key==='.'||e.key===','){qaKey('.');e.preventDefault();}
    else if(e.key==='Backspace'){qaKey('del');e.preventDefault();}
    else if(e.key==='Enter'){qaSave();e.preventDefault();}
  }
});
document.addEventListener('focusout',function(){if(Sync.deferRender)setTimeout(function(){if(Sync.deferRender)safeRender();},300);});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&Sync.url)pull(false);});
window.addEventListener('beforeunload',function(e){if(Sync.url&&(Sync.pending||Sync.busy)){pushNow();e.preventDefault();e.returnValue='';}});
function updateTxnTable(){const w=$('#txnTableWrap');if(w)w.innerHTML=txnTableHTML();}
function updateFcOut(){const w=$('#fcOut');if(!w)return;
  try{
    w.innerHTML=fcOutHTML();
    if(fcCache)attachHover('fcChartWrap',fcCache.labels,[{name:'Projected cash',color:'var(--ink)',data:fcCache.series}]);
  }catch(err){console.error(err);w.innerHTML='<div class="panel"><div class="panel-body"><div class="alert-inline">'+I('alert',16)+'<span><b>The forecast could not be redrawn.</b> '+esc(err.message)+'</span></div></div></div>';}
}
(function(){const mp=$('#monthPick');if(mp&&mp.showPicker)mp.addEventListener('click',function(){try{mp.showPicker();}catch(e){}});if(mp)mp.addEventListener('change',function(e){const v=e.target.value;if(/^\d{4}-\d{2}$/.test(v))setMonth(v);else e.target.value=ui.month;});})();

/* ================= STARTUP SELF-TEST (results in console, F12) ================= */
function selfTest(){
  const res=[];
  const T=function(name,fn){try{fn();res.push([name,true,'']);}catch(e){res.push([name,false,String((e&&e.message)||e)]);}};
  T('Transfer does not affect income/expense totals',function(){
    const as=state.accounts.filter(function(a){return ASSETS.includes(a.type);});
    if(as.length<2)return;
    const before=periodSummary(state.transactions),balA=accountBalance(as[0].id);
    state.transactions.push({id:'__t1__',date:TODAY(),type:'transfer',description:'__t1__',amount:137.5,category:'',fromAccount:as[0].id,toAccount:as[1].id,method:'',notes:'',tags:[],recurringId:null});
    const mid=periodSummary(state.transactions),balA2=accountBalance(as[0].id);
    state.transactions.pop();
    if(mid.income!==before.income||mid.netExpense!==before.netExpense)throw new Error('transfer changed totals');
    if(Math.abs(balA2-(balA-137.5))>0.01)throw new Error('transfer did not move balance');
  });
  T('Refund reduces net expenses, not income',function(){
    const before=periodSummary(state.transactions);
    state.transactions.push({id:'__t2__',date:TODAY(),type:'refund',description:'__t2__',amount:50,category:'Other',fromAccount:null,toAccount:null,method:'',notes:'',tags:[],recurringId:null});
    const mid=periodSummary(state.transactions);state.transactions.pop();
    if(mid.income!==before.income)throw new Error('refund counted as income');
    if(Math.abs(mid.netExpense-(before.netExpense-50))>0.001)throw new Error('refund did not reduce net expenses');
  });
  T('Sheet round-trip keeps data identical',function(){
    const a=JSON.stringify(stateToRows(state));
    const b=JSON.stringify(stateToRows(rowsToState(JSON.parse(a))));
    if(a!==b)throw new Error('round-trip mismatch');
  });
  T('Empty period produces no NaN',function(){const s=periodSummary([]);if(!isFinite(s.income+s.netExpense+s.net))throw new Error('NaN');});
  T('Forecast output is finite',function(){const fc=computeForecast(3,{incomePct:5,diningCut:10,oneTime:1000,oneTimeWhen:2,monthlyAdj:500});if(!isFinite(fc.projectedEnd))throw new Error('non-finite');});
  const bad=res.filter(function(r){return !r[1];});
  if(bad.length)console.warn('[Badyet self-test] FAILURES:',bad);
  else console.log('[Badyet self-test] '+res.length+'/'+res.length+' checks passed');
  return res;
}

/* ================= INIT ================= */
/* ================= INSTALLABLE APP (GitHub Pages build) ================= */
const PWA=!!window.BADYET_PWA;
let installEvt=null;
const isStandalone=function(){try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}catch(e){return false;}};
const isIOS=function(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);};
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installEvt=e;if(ui.section==='settings')safeRender();});
window.addEventListener('appinstalled',function(){installEvt=null;toast('Badyet is installed. Open it from your home screen.','ok');if(ui.section==='settings')safeRender();});
async function pwaInstall(){
  if(!installEvt){toast(isIOS()?'In Safari: tap Share, then Add to Home Screen.':'Use your browser menu: Install app or Add to Home screen.');return;}
  installEvt.prompt();
  try{await installEvt.userChoice;}catch(e){}
  installEvt=null;render();
}
function installPanelHTML(){
  if(!PWA)return '';
  let body;
  if(isStandalone())body='<p class="pin-txt" style="margin:0">'+I('check',15)+' You\u2019re using the installed app.</p>';
  else if(installEvt)body='<p class="pin-txt">Put Badyet on your home screen. It opens full screen, like any other app.</p><button class="btn btn-primary" data-act="pwa-install">'+I('dl',15)+' Install App</button>';
  else if(isIOS())body='<p class="pin-txt" style="margin:0">In Safari, tap <b>Share</b> '+I('ul',14)+' then <b>Add to Home Screen</b>.</p>';
  else body='<p class="pin-txt" style="margin:0">Open your browser menu <b>\u22ee</b> and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>';
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Install On This Device</h3></div><div class="panel-body">'+body+'</div></div>';
}

/* First read from the sheet (also runs again right after unlocking). */
function firstLoad(){
  if(!HOSTED&&!Sync.url)return;
  setSyncStatus('connecting');
  (async function(){
    try{
      if(!(await pushPendingFirst())){toast('You\u2019re offline. Your changes are kept on this phone and will save when you\u2019re back online.');return;}
      const res=await api({action:'read'});
      const dd=res.data||{};
      if(dd.__pin!==undefined)setPinFlag(!!dd.__pin);
      noteServerFlags(dd);
      if(dd.__sheetUrl)SHEET_LINK=String(dd.__sheetUrl);
      if(!(dd.Accounts||[]).length&&!(dd.Transactions||[]).length){setSyncStatus('ok');openSetup({fresh:true});}
      else{applyRemote(dd,true);setSyncStatus('ok');if(HOSTED)toast('Loaded '+state.transactions.length+' transactions from your Google Sheet.','ok');}
    }catch(e){if(!e.locked){setSyncStatus('error',e.message);toast(HOSTED?'Couldn\u2019t read the sheet: '+e.message:e.message,'err');}}
  })();
}

/* ================= PIN LOCK ================= */
let lockPin='';
function handleLocked(){
  if(Sync.locked)return;
  Sync.locked=true;setToken('');setPinFlag(true);
  try{localStorage.removeItem(LS_KEY);}catch(e){}dropSnap();
  state=blankState();Sync.snap=null;Sync.remoteSig='';Sync.pending=false;
  if(modalOpen())closeModal();
  render();showLock();
}
function showLock(){
  Sync.locked=true;lockPin='';
  let el=document.getElementById('lockRoot');
  if(!el){el=document.createElement('div');el.id='lockRoot';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Enter your PIN');document.body.appendChild(el);}
  el.innerHTML='<div class="lock-box">'+
    '<div class="lock-mark" aria-hidden="true">'+(document.getElementById('brandMark')?document.getElementById('brandMark').outerHTML.replace('id="brandMark"',''):'')+'</div>'+
    '<h2>Enter Your PIN</h2><p class="lock-sub">Your budget is locked.</p>'+
    '<div class="lock-dots" id="lockDots" aria-live="polite"></div>'+
    '<div class="lock-err" id="lockErr" role="alert"></div>'+
    '<div class="qa-keys lock-keys">'+['1','2','3','4','5','6','7','8','9','del','0','ok'].map(function(k){
      if(k==='ok')return '<button class="qa-key ok" data-lock="ok" aria-label="Unlock">'+I('check',26)+'</button>';
      if(k==='del')return '<button class="qa-key" data-lock="del" aria-label="Delete last digit">'+I('chevL',22)+'</button>';
      return '<button class="qa-key" data-lock="'+k+'">'+k+'</button>';}).join('')+'</div>'+
    '<p class="lock-foot">Forgot it? Open your Google Sheet and use <b>Badyet \u2192 Remove app PIN</b>.</p></div>';
  document.body.classList.add('locked');
  lockDraw();
}
function hideLock(){const el=document.getElementById('lockRoot');if(el)el.remove();document.body.classList.remove('locked');}
function lockDraw(){
  const d=document.getElementById('lockDots');if(!d)return;
  const n=Math.max(4,lockPin.length);
  d.innerHTML=Array.from({length:n},function(_,i){return '<i class="'+(i<lockPin.length?'on':'')+'"></i>';}).join('');
}
function lockKey(k){
  if(!Sync.locked)return;
  const err=document.getElementById('lockErr');
  if(k==='del')lockPin=lockPin.slice(0,-1);
  else if(k==='ok'){lockTry();return;}
  else if(/^\d$/.test(k)&&lockPin.length<8){lockPin+=k;if(err)err.textContent='';}
  lockDraw();
}
async function lockTry(){
  const err=document.getElementById('lockErr');
  if(lockPin.length<4){if(err)err.textContent='Your PIN has at least 4 digits.';return;}
  const pin=lockPin;lockPin='';lockDraw();
  if(err)err.textContent='Checking\u2026';
  try{
    const res=await apiRaw({action:'unlock',pin:pin});
    const r=res.data||{};
    if(r.ok){setToken(r.token||'');Sync.locked=false;hideLock();toast('Unlocked.','ok');firstLoad();return;}
    if(err)err.textContent=r.wait?('Too many tries. Wait '+Math.ceil(r.wait/60)+' min, then try again.'):('Wrong PIN.'+(r.left!=null?' '+r.left+' '+(r.left===1?'try':'tries')+' left before a short wait.':''));
    const box=document.querySelector('.lock-box');if(box){box.classList.remove('shake');void box.offsetWidth;box.classList.add('shake');}
  }catch(e){if(err)err.textContent='Couldn\u2019t reach Google: '+e.message;}
}
document.addEventListener('click',function(e){const b=e.target.closest&&e.target.closest('[data-lock]');if(b){e.preventDefault();lockKey(b.dataset.lock);}});
document.addEventListener('keydown',function(e){
  if(!Sync.locked||!document.getElementById('lockRoot'))return;
  if(/^[0-9]$/.test(e.key))lockKey(e.key);else if(e.key==='Backspace')lockKey('del');else if(e.key==='Enter')lockKey('ok');else return;
  e.preventDefault();e.stopPropagation();
},true);
function pinPanelHTML(){
  return accountPanelHTML()+(Sync.accountsOn?'':pinOnlyPanelHTML());
}
function pinOnlyPanelHTML(){
  if(!Sync.url)return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>PIN Lock</h3></div><div class="panel-body"><div class="note">Connect your Google Sheet first. The PIN is checked on Google\u2019s side, so it needs the sheet.</div></div></div>';
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>PIN Lock</h3><span class="badge '+(Sync.pinOn?'b-ok':'b-mut')+'" style="margin-left:auto">'+(Sync.pinOn?'On':'Off')+'</span></div><div class="panel-body">'+
    (Sync.pinOn
      ?'<p class="pin-txt">Your app asks for a PIN on new devices. This device stays unlocked for 30 days, or until you lock it.</p>'+
        '<div class="split-btns"><button class="btn" data-act="pin-set">'+I('edit',15)+' Change PIN</button><button class="btn" data-act="pin-lock">'+I('lock',15)+' Lock Now</button><button class="btn btn-danger" data-act="pin-off">Turn Off</button></div>'
      :'<p class="pin-txt">Right now anyone with your app link can see your money. Add a 4 to 8 digit PIN so only you can open it.</p>'+
        '<button class="btn btn-primary" data-act="pin-set">'+I('lock',15)+' Set A PIN</button>')+
  '</div></div>';
}
function openPinModal(){
  openModal({title:Sync.pinOn?'Change PIN':'Set A PIN',body:
    '<form id="fPin" novalidate><div class="form-err" id="fPinErr"></div>'+
    '<div class="fgrid"><div class="field"><label for="pin1">New PIN (4\u20138 digits)</label><input class="inp pin-inp" id="pin1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password"></div>'+
    '<div class="field"><label for="pin2">Type it again</label><input class="inp pin-inp" id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password"></div></div>'+
    '<div class="note">Other phones and computers will need the new PIN. If you forget it, open your Google Sheet and use <b>Badyet \u2192 Remove app PIN</b>.</div></form>',
    foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="pinSave">Save PIN</button>',
    onMount:function(){
      $('#fPin').addEventListener('submit',function(e){e.preventDefault();$('#pinSave').click();});
      $('#pinSave').addEventListener('click',async function(){
        const a=$('#pin1').value.trim(),b=$('#pin2').value.trim(),errEl=$('#fPinErr');
        const err=!/^\d{4,8}$/.test(a)?'Use 4 to 8 digits, numbers only.':a!==b?'The two PINs don\u2019t match.':'';
        if(err){errEl.textContent=err;errEl.classList.add('show');return;}
        $('#pinSave').disabled=true;$('#pinSave').textContent='Saving\u2026';
        try{
          const r=(await api({action:'setpin',pin:a})).data||{};
          if(!r.ok)throw new Error(r.error||'Not saved');
          setToken(r.token||'');setPinFlag(true);closeModal();render();toast('PIN saved. Other devices will ask for it.','ok');
        }catch(e){if(e.locked)return;errEl.textContent=e.message;errEl.classList.add('show');$('#pinSave').disabled=false;$('#pinSave').textContent='Save PIN';}
      });
    }});
}
async function pinOff(){
  try{const r=(await api({action:'setpin',pin:''})).data||{};if(!r.ok)throw new Error('Not saved');
    setPinFlag(false);setToken('');render();toast('PIN lock turned off.','ok');}
  catch(e){if(!e.locked)toast('Couldn\u2019t turn off the PIN: '+e.message,'err');}
}
async function pinLockNow(){
  try{await apiRaw({action:'lock'});}catch(e){}
  setToken('');Sync.locked=false;handleLocked();
}

(function init(){
  try{
    $('#navList').innerHTML=Object.keys(SECTIONS).map(function(k){
      return '<button class="nav-item" data-act="nav" data-sec="'+k+'">'+I(SECTIONS[k].icon,18)+'<span class="nav-label">'+SECTIONS[k].title+'</span><span class="nav-badge"'+(k==='bills'?' id="navBillsBadge"':'')+' style="display:none"></span></button>';}).join('');
    $('#sbCollapseIc').innerHTML=I('chevL',16);
    $('#burger').innerHTML=I('menu',20);
    $('#btnAddIc').innerHTML=I('plus',15);
    [['#bnHome','home','Home'],['#bnTx','target','Budgets'],['#bnIns','card','Debt']].forEach(function(x){const el=$(x[0]);if(el)el.innerHTML=I(x[1],22)+'<span>'+x[2]+'</span>';});
    if($('#bnMore'))$('#bnMore').innerHTML=I('menu',22)+'<span>More</span><span class="dotb" id="bnMoreDot" style="display:none"></span>';
    if($('#bnAdd'))$('#bnAdd').innerHTML=I('plus',24);
    $('#mPrev').innerHTML=I('chevL',15);
    $('#mNext').innerHTML=I('chevR',15);
    if(HOSTED){Sync.hosted=true;Sync.url='__hosted__';}
    else{try{Sync.url=localStorage.getItem(SYNC_KEY)||'';}catch(e){Sync.url='';}}
    /* The Android app can come with your web app link built in (config.js), so friends only see Log In. */
    if(PWA&&!Sync.url&&window.BADYET_SERVER&&/^https:\/\/script\.google\.com\//.test(String(window.BADYET_SERVER))){Sync.url=String(window.BADYET_SERVER).replace(/\/$/,'');try{localStorage.setItem(SYNC_KEY,Sync.url);}catch(e){}}
    Sync.accountsOn=accFlag();Sync.user=savedUser();
    const mustAuth=!!Sync.url&&Sync.accountsOn&&!getToken();
    const mustLock=!mustAuth&&!Sync.accountsOn&&!!Sync.url&&pinFlag()&&!getToken();
    const shut=mustLock||mustAuth;
    state=shut?null:loadState();
    if(!state)state=HOSTED||shut||PWA?blankState():seedDemo();
    if(shut){try{localStorage.removeItem(LS_KEY);}catch(e){}}else saveLocal();
    Sync.pinOn=pinFlag();
    if(!shut)Sync.snap=loadSnap();
    if(!shut&&ensurePlanBudgets())saveLocal();
    ui.dash.preset=state.settings.reportingPeriod||'month';
    ui.month=monthKey(TODAY());
    render();
    selfTest();
    updateSyncChip();
    if(mustAuth){Sync.locked=true;showAuth('login');}
    else if(mustLock)showLock();
    else if(HOSTED||Sync.url)firstLoad();
    else if(PWA)setTimeout(openConnectSimple,500);
    else{let seen=false;try{seen=!!localStorage.getItem(SYNC_SEEN_KEY);}catch(e){}
      if(!seen)setTimeout(openSetupWizard,700);}
    if(PWA&&'serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js').catch(function(e){console.warn('offline mode unavailable',e);});
    setInterval(function(){
      if(!Sync.url)return;
      if(Sync.pending&&!Sync.busy&&Sync.status==='error')pushNow();
      else pull(false);
    },POLL_MS);
    setInterval(updateSyncChip,5000);
  }catch(err){
    console.error(err);
    try{const d=document.getElementById('fatalErr');
      if(d){d.style.display='block';d.innerHTML='<b>Badyet hit an error during startup.</b> '+esc(String(err&&err.message||err))+'<small>Details are in the browser console (F12).</small>';}
    }catch(e2){}
  }
})();
