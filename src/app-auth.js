
/* ================= ACCOUNTS: sign up, verify email, log in =================
   The server (Code.gs → apiAuth) does the real checks. This file only draws the
   screens, checks typing as you go, and keeps the login key on this phone. */
const ACC_FLAG='badyet_accounts_on',ACC_USER='badyet_user',ACC_LAST='badyet_last_id';
function accFlag(){try{return localStorage.getItem(ACC_FLAG)==='1';}catch(e){return false;}}
function setAccFlag(on){Sync.accountsOn=!!on;try{if(on)localStorage.setItem(ACC_FLAG,'1');else localStorage.removeItem(ACC_FLAG);}catch(e){}}
function savedUser(){try{return JSON.parse(localStorage.getItem(ACC_USER)||'null');}catch(e){return null;}}
function setUser(u){Sync.user=u||null;try{if(u)localStorage.setItem(ACC_USER,JSON.stringify(u));else localStorage.removeItem(ACC_USER);}catch(e){}}
function lastId(){try{return localStorage.getItem(ACC_LAST)||'';}catch(e){return '';}}
function setLastId(v){try{if(v)localStorage.setItem(ACC_LAST,v);}catch(e){}}
/* Flags that arrive with every read */
function noteServerFlags(d){
  if(!d)return;
  if(d.__accountsOn!==undefined)setAccFlag(!!d.__accountsOn);
  if(d.__account){const u=Object.assign({},Sync.user||{},d.__account);if(d.__sheetUrl)u.sheetUrl=d.__sheetUrl;setUser(u);}
  if(d.__accountsUrl!==undefined)Sync.accountsUrl=String(d.__accountsUrl||'');
}
async function authCall(op,payload){const res=await apiRaw({action:'auth',op:op,payload:payload||{}});return res.data||{};}
function authErr(){const e=new Error('Please log in.');e.locked=true;e.auth=true;return e;}
/* Any read/write that comes back "please log in" lands here */
function handleAuth(){
  if(document.getElementById('auRoot'))return;
  Sync.locked=true;setToken('');setAccFlag(true);setUser(null);
  try{localStorage.removeItem(LS_KEY);}catch(e){}dropSnap();
  state=blankState();Sync.snap=null;Sync.remoteSig='';Sync.pending=false;
  if(modalOpen())closeModal();
  render();showAuth('login');
}
async function logOut(){
  try{await authCall('logout');}catch(e){}
  setToken('');setUser(null);
  try{localStorage.removeItem(LS_KEY);}catch(e){}dropSnap();
  state=blankState();Sync.snap=null;Sync.remoteSig='';Sync.pending=false;Sync.locked=true;
  if(modalOpen())closeModal();
  render();showAuth('login',{msg:'You’re logged out.'});
}

/* ---------- the same rules the server uses ---------- */
const AU_RULES={
  user:function(u){return /^[a-z0-9_]{3,20}$/.test(u)?'':'Use 3 to 20 letters, numbers or _ (no spaces).';},
  email:function(e){return (e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))?'':'That email doesn’t look right.';},
  pass:function(p,u,e){
    const low=String(p||'').toLowerCase(),loc=(e||'').split('@')[0]||'';
    return [{ok:p.length>=8,t:'At least 8 characters'},{ok:/\d/.test(p),t:'Has a number'},
      {ok:!!p&&!(u&&low.indexOf(u)>=0)&&!(loc.length>=4&&low.indexOf(loc)>=0)&&low!==e,t:'Not your username or email'}];
  }
};
const AU_X={mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.6 4.4-5.5 8-5.5s6.5 1.9 8 5.5"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>',
  out:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5c1.2-3.2 3.6-5 6.5-5s5.3 1.8 6.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.5c2.4.1 4.1 1.6 5 4"/>'};
function AI(n,s){s=s||18;return AU_X[n]?'<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+AU_X[n]+'</svg>':I(n,s);}

/* ---------- state of the overlay ---------- */
let AU={screen:'login',v:{},err:{},msg:'',busy:false,timer:null};
function auOpen(){return !!document.getElementById('auRoot');}
function showAuth(screen,opts){
  opts=opts||{};
  let el=document.getElementById('auRoot');
  if(!el){el=document.createElement('div');el.id='auRoot';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');document.body.appendChild(el);}
  document.body.classList.add('au-on');
  const keepV=opts.keepValues?AU.v:{};
  AU=Object.assign({screen:screen,v:keepV,err:{},msg:'',bad:'',busy:false,timer:AU.timer},opts.state||{});
  if(opts.msg)AU.msg=opts.msg;
  if(screen==='login'&&!AU.v.id)AU.v.id=lastId();
  if(AU.v.keep===undefined)AU.v.keep=true;
  auDraw(true);
}
function hideAuth(){
  const el=document.getElementById('auRoot');if(el)el.remove();
  document.body.classList.remove('au-on');
  if(AU.timer){clearInterval(AU.timer);AU.timer=null;}
}

/* ---------- drawing ---------- */
function auTheme(){
  const t=(state&&state.settings&&state.settings.theme)||'auto';
  return '<div class="au-tsw" role="radiogroup" aria-label="Theme">'+[['light','sun','Light'],['dark','moon','Dark'],['auto','auto','Auto']].map(function(o){
    return '<button type="button" role="radio" aria-checked="'+(t===o[0])+'" aria-label="'+o[2]+' theme" data-au="theme" data-v="'+o[0]+'" class="'+(t===o[0]?'on':'')+'">'+I(o[1],15)+'</button>';}).join('')+'</div>';
}
function auField(o){   // {key,label,icon,type,ac,ph,hint,eye,mode}
  const val=AU.v[o.key]==null?'':AU.v[o.key],er=AU.err[o.key];
  return '<div class="au-fl"><label for="au_'+o.key+'">'+o.label+'</label>'+
    '<div class="au-in'+(er?' bad':'')+'" data-in="'+o.key+'">'+AI(o.icon,18)+
    '<input id="au_'+o.key+'" data-au-in="'+o.key+'" type="'+(o.type||'text')+'" value="'+esc(val)+'" autocomplete="'+(o.ac||'off')+'"'+
      (o.mode?' inputmode="'+o.mode+'"':'')+' autocapitalize="none" spellcheck="false"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(er?' aria-invalid="true"':'')+' aria-describedby="au_'+o.key+'_m">'+
    (o.eye?'<button type="button" class="au-eye" data-au="eye" data-k="'+o.key+'" aria-label="Show password">'+AI('eye',19)+'</button>':'')+
    '<span class="au-tick" aria-hidden="true">'+I('check',13)+'</span></div>'+
    '<div id="au_'+o.key+'_m" class="au-msg">'+(er?'<div class="au-er" role="alert">'+I('alert',15)+'<span>'+er+'</span></div>':(o.hint?'<div class="au-hint">'+o.hint+'</div>':''))+'</div></div>';
}
function auRules(key,u,e){
  return '<div class="au-rules" data-rules="'+key+'">'+AU_RULES.pass(AU.v[key]||'',u,e).map(function(r){
    return '<div class="'+(r.ok?'y':'')+'"><i>'+(r.ok?I('check',11):'')+'</i>'+r.t+'</div>';}).join('')+'</div>';
}
function auBtn(label,act,on){return '<button type="submit" class="au-b1'+(on===false?' dis':'')+'" data-au-go="'+act+'"'+(on===false||AU.busy?' disabled':'')+'>'+(AU.busy?'<span class="au-spin" aria-hidden="true"></span>Working…':label)+'</button>';}
function auTile(t,kind,ic){return '<div class="au-tile'+(kind?' '+kind:'')+'" role="'+(kind==='bad'?'alert':'status')+'">'+I(ic||(kind==='bad'?'alert':'info'),17)+'<span>'+t+'</span></div>';}
function auTop(back){return '<div class="au-tb">'+(back?'<button type="button" class="au-cb" data-au="back" aria-label="Back">'+I('chevL',18)+'</button>':'<span></span>')+auTheme()+'</div>';}
function auMark(ic){return '<div class="au-mk" aria-hidden="true">'+(ic?AI(ic,28):(document.getElementById('brandMark')?document.getElementById('brandMark').outerHTML.replace('id="brandMark"',''):''))+'</div>';}
function auCode(){
  const c=String(AU.v.code||'');
  let boxes='';for(let i=0;i<6;i++)boxes+='<span class="'+(i<c.length?'f':'')+(i===Math.min(c.length,5)?' cur':'')+'">'+(c.charAt(i)||'')+'</span>';
  return '<label class="au-code'+(AU.err.code?' bad':'')+'" for="au_code"><span class="au-sr">6-digit code</span>'+
    '<input id="au_code" data-au-in="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="'+esc(c)+'" aria-describedby="au_code_m">'+boxes+'</label>'+
    '<div id="au_code_m">'+(AU.err.code?'<div class="au-er" role="alert">'+I('alert',15)+'<span>'+AU.err.code+'</span></div>':'')+'</div>';
}
function mm(s){s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function auSignupValid(){
  const u=(AU.v.username||''),e=(AU.v.email||'').trim().toLowerCase(),p=AU.v.password||'';
  return !AU_RULES.user(u)&&!AU_RULES.email(e)&&AU_RULES.pass(p,u,e).every(function(r){return r.ok;});
}
function auBody(){
  const s=AU.screen,v=AU.v;
  if(s==='login'){
    const waiting=AU.waitUntil&&AU.waitUntil>Date.now();
    return auTop(false)+'<form class="au-bd" data-au-form="login" novalidate>'+auMark()+
      '<h1>Welcome back</h1><p class="au-sub">Log in to see your budget.</p>'+
      (AU.msg?auTile(AU.msg,'','check'):'')+
      auField({key:'id',label:'Username or email',icon:'user',ac:'username'})+
      auField({key:'password',label:'Password',icon:'lock',type:'password',ac:'current-password',eye:true})+
      '<div class="au-row"><label class="au-chk"><input type="checkbox" data-au-in="keep"'+(v.keep!==false?' checked':'')+'><i>'+I('check',12)+'</i>Keep me logged in</label><button type="button" class="au-lnkb" data-au="go" data-to="forgot">Forgot password?</button></div>'+
      (waiting?auTile('<b>Too many wrong tries.</b> Please wait <b data-au-count="wait">'+mm((AU.waitUntil-Date.now())/1000)+'</b> and try again, or reset your password.','bad'):(AU.bad?auTile(AU.bad,'bad'):''))+
      auBtn('Log In','login',!waiting)+
      '<p class="au-lnk">New here? <button type="button" class="au-lnkb" data-au="go" data-to="signup">Create an account</button></p></form>';
  }
  if(s==='signup'||s==='enable'){
    const en=s==='enable';
    return auTop(true)+'<form class="au-bd" data-au-form="'+s+'" novalidate><div class="au-ey">'+(en?'Accounts · you’ll be the admin':'Step 1 of 2')+'</div>'+
      '<h1>'+(en?'Turn on accounts':'Create your account')+'</h1><p class="au-sub">'+(en?'Your current budget stays yours. Friends can then sign up with their own private sheet.':'Your budget gets its own private sheet.')+'</p>'+
      auField({key:'username',label:'Username',icon:'user',ac:'username',hint:'3–20 letters, numbers or _. You can log in with it.'})+
      auField({key:'email',label:'Email',icon:'mail',type:'email',ac:'email',mode:'email',hint:'We’ll send a code here. One account per email.'})+
      auField({key:'password',label:'Password',icon:'lock',type:'password',ac:'new-password',eye:true})+
      auRules('password',v.username,(v.email||'').trim().toLowerCase())+
      (AU.bad?auTile(AU.bad,'bad'):'')+
      auBtn('Send Verification Code',s,auSignupValid())+
      (en?'':'<p class="au-lnk">Have an account? <button type="button" class="au-lnkb" data-au="go" data-to="login">Log in</button></p>')+'</form>';
  }
  if(s==='verify'){
    const left=AU.expAt?(AU.expAt-Date.now())/1000:0,rs=AU.resendAt?(AU.resendAt-Date.now())/1000:0;
    const step=AU.purpose==='reset'?'Reset password':AU.purpose==='enable'?'Accounts · last step':'Step 2 of 2';
    return auTop(true)+'<form class="au-bd" data-au-form="verify" novalidate><div class="au-ey">'+step+'</div><h1>Check your email</h1>'+
      '<p class="au-sub">We sent a 6-digit code to <b>'+esc(AU.sentTo||'')+'</b>.</p>'+auCode()+
      '<div class="au-meta"><span>Code expires in <b data-au-count="exp">'+mm(left)+'</b></span>'+
        (rs>0?'<span>Resend in <b data-au-count="resend">'+mm(rs)+'</b></span>':'<button type="button" class="au-lnkb" data-au="resend">Send a new code</button>')+'</div>'+
      (AU.bad?auTile(AU.bad,'bad'):auTile('Can’t find it? Check <b>Spam</b> or <b>Promotions</b>. The email comes from the Badyet owner’s Gmail.','', 'inbox'))+
      '<div class="au-grow"></div>'+auBtn(AU.purpose==='reset'?'Continue':AU.purpose==='enable'?'Verify &amp; Turn On':'Verify &amp; Create Account','verify',String(v.code||'').length===6)+'</form>';
  }
  if(s==='ready'){
    const u=AU.user||{};
    return auTop(false)+'<div class="au-bd"><div class="au-big">'+I('check',44)+'</div><div class="au-center"><h1>'+(AU.admin?'Accounts are on!':'You’re in, '+esc(u.username||'')+'!')+'</h1>'+
      '<p class="au-sub">'+(AU.admin?'You’re the admin. Your budget is now your account, and friends can sign up from the same link.':'Your email is verified and your own budget sheet is ready.')+'</p></div>'+
      '<div class="au-card"><div class="li"><span>Account</span><b>'+esc(u.username||'')+(AU.admin?' <span class="au-pill">Admin</span>':'')+'</b></div><div class="li"><span>Email</span><b>'+esc(u.email||'')+' <span class="au-pill">Verified</span></b></div>'+
      '<div class="li"><span>Your sheet</span><b>'+I('sheet',15)+esc(u.sheetName||(AU.admin?'Your current sheet':'Badyet – '+(u.username||'')))+'</b></div></div>'+
      (AU.admin?auTile('Accounts are listed in a new <b>Badyet Accounts</b> sheet in your Google Drive. Only you can open it.'):
        AU.shared?auTile('We shared the sheet with your email, so you can open it in <b>Google Sheets</b> anytime.'):auTile('We couldn’t share the sheet with this email automatically. You can still use everything in the app.'))+
      '<div class="au-grow"></div><button type="button" class="au-b1" data-au="enter">'+(AU.admin?'Back To My Budget':'Set Up My Budget')+'</button>'+
      (u.sheetUrl?'<a class="au-b2" href="'+esc(u.sheetUrl)+'" target="_blank" rel="noopener">'+I('ext',16)+'Open My Sheet</a>':'')+'</div>';
  }
  if(s==='forgot'){
    return auTop(true)+'<form class="au-bd" data-au-form="forgot" novalidate>'+auMark('key')+'<h1>Forgot password?</h1>'+
      '<p class="au-sub">Enter the email on your account. We’ll send a code to set a new password.</p>'+
      auField({key:'email',label:'Email',icon:'mail',type:'email',ac:'email',mode:'email'})+
      (AU.bad?auTile(AU.bad,'bad'):'')+auBtn('Send Reset Code','forgot',!AU_RULES.email((v.email||'').trim().toLowerCase()))+
      auTile('For your safety we show the same message whether or not the email has an account.')+
      '<p class="au-lnk">Remembered it? <button type="button" class="au-lnkb" data-au="go" data-to="login">Log in</button></p></form>';
  }
  if(s==='newpass'){
    const okAll=AU_RULES.pass(v.npass||'','',AU.email).every(function(r){return r.ok;})&&v.npass===v.npass2;
    return auTop(true)+'<form class="au-bd" data-au-form="newpass" novalidate><div class="au-ey">Reset password</div><h1>Set a new password</h1>'+
      '<p class="au-sub">Code accepted for <b>'+esc(AU.sentTo||'')+'</b>.</p>'+
      auField({key:'npass',label:'New password',icon:'lock',type:'password',ac:'new-password',eye:true})+auRules('npass','',AU.email)+
      auField({key:'npass2',label:'Type it again',icon:'lock',type:'password',ac:'new-password'})+
      (AU.bad?auTile(AU.bad,'bad'):'')+auBtn('Save &amp; Log In','newpass',okAll)+
      auTile('Your other phones are logged out, just in case.','','lock')+'</form>';
  }
  return '';
}
function auDraw(focus){
  const el=document.getElementById('auRoot');if(!el)return;
  const act=document.activeElement&&document.activeElement.id;
  el.setAttribute('aria-label',{login:'Log in',signup:'Create an account',enable:'Turn on accounts',verify:'Check your email',ready:'Account ready',forgot:'Forgot password',newpass:'Set a new password'}[AU.screen]||'Account');
  el.innerHTML='<div class="au-wrap">'+auBody()+'</div>';
  auLive();
  const want=act&&document.getElementById(act)?act:null;
  if(want){const f=document.getElementById(want);f.focus({preventScroll:true});try{const n=f.value.length;f.setSelectionRange(n,n);}catch(e){}}
  else if(focus){const first=el.querySelector('.bad input')||el.querySelector('input:not([type=checkbox])');if(first&&!('ontouchstart' in window))first.focus({preventScroll:true});}
  if(AU.timer){clearInterval(AU.timer);AU.timer=null;}
  if(AU.expAt||AU.resendAt||AU.waitUntil)AU.timer=setInterval(auTick,1000);
}
function auTick(){
  const now=Date.now();
  const set=function(k,t){const n=document.querySelector('[data-au-count="'+k+'"]');if(n)n.textContent=mm((t-now)/1000);};
  if(AU.expAt)set('exp',AU.expAt);
  if(AU.resendAt){if(AU.resendAt<=now){AU.resendAt=0;auDraw();return;}set('resend',AU.resendAt);}
  if(AU.waitUntil){if(AU.waitUntil<=now){AU.waitUntil=0;auDraw();return;}set('wait',AU.waitUntil);}
  if(AU.expAt&&AU.expAt<=now&&AU.screen==='verify'&&!AU.err.code){AU.err.code='That code has expired. Ask for a new one.';auDraw();}
}
/* Live checks while typing, without redrawing the whole screen */
function auLive(){
  const s=AU.screen,v=AU.v;
  const tick=function(k,ok){const box=document.querySelector('#auRoot [data-in="'+k+'"]');if(box)box.classList.toggle('ok',!!ok&&!AU.err[k]);};
  if(s==='signup'||s==='enable'){
    const u=v.username||'',e=(v.email||'').trim().toLowerCase();
    tick('username',u&&!AU_RULES.user(u));tick('email',e&&!AU_RULES.email(e));
    tick('password',AU_RULES.pass(v.password||'',u,e).every(function(r){return r.ok;}));
    const r=document.querySelector('#auRoot [data-rules="password"]');if(r)r.outerHTML=auRules('password',u,e);
    auEnable(auSignupValid());
  }else if(s==='newpass'){
    const ok1=AU_RULES.pass(v.npass||'','',AU.email).every(function(r){return r.ok;});
    tick('npass',ok1);tick('npass2',ok1&&v.npass===v.npass2&&!!v.npass2);
    const r=document.querySelector('#auRoot [data-rules="npass"]');if(r)r.outerHTML=auRules('npass','',AU.email);
    auEnable(ok1&&v.npass===v.npass2);
  }else if(s==='forgot')auEnable(!AU_RULES.email((v.email||'').trim().toLowerCase()));
  else if(s==='verify'){
    const c=String(v.code||''),boxes=document.querySelectorAll('#auRoot .au-code span:not(.au-sr)');
    boxes.forEach(function(b,i){b.textContent=c.charAt(i)||'';b.className=(i<c.length?'f':'')+(i===Math.min(c.length,5)?' cur':'');});
    auEnable(c.length===6);
  }
}
function auEnable(on){const b=document.querySelector('#auRoot [data-au-go]');if(b&&!AU.busy){b.disabled=!on;b.classList.toggle('dis',!on);}}

/* ---------- talking to the server ---------- */
async function auRun(fn){
  if(AU.busy)return;
  AU.busy=true;AU.bad='';auDraw();
  try{await fn();}
  catch(e){AU.bad=String(e&&e.message||e).indexOf('NET')===0?'Couldn’t reach Google. Check your internet and try again.':esc(String(e&&e.message||e));}
  finally{AU.busy=false;if(auOpen())auDraw();}
}
function auServerErr(r,fallbackField){
  if(r.field){AU.err[r.field]=esc(r.error)+(r.suggest&&r.suggest.length?' Try <b>'+r.suggest.map(esc).join('</b> or <b>')+'</b>.':'')+(r.emailUsed?' <button type="button" class="au-lnkb" data-au="go" data-to="login">Log in</button> or reset your password.':'');}
  else AU.bad=esc(r.error||'Something went wrong.');
}
function auToVerify(r,purpose,email){
  AU.screen='verify';AU.purpose=purpose;AU.email=email;AU.sentTo=r.sentTo||email;AU.v.code='';AU.err={};AU.bad='';
  AU.expAt=Date.now()+(r.expiresIn||600)*1000;AU.resendAt=Date.now()+(r.resendIn||45)*1000;
}
function auLoggedIn(r){
  setToken(r.token||'');setAccFlag(true);setUser(r.user||null);
  if(r.user)setLastId(r.user.username);
  Sync.locked=false;
}
async function auSubmit(which){
  const v=AU.v;AU.err={};
  if(which==='login')return auRun(async function(){
    const id=String(v.id||'').trim();
    if(!id||!v.password){AU.bad='Enter your username or email and your password.';return;}
    const r=await authCall('login',{id:id,password:v.password,keep:v.keep!==false});
    if(r.ok){auLoggedIn(r);hideAuth();toast('Welcome back, '+(r.user&&r.user.username||'')+'!','ok');firstLoad();return;}
    v.password='';
    if(r.wait){AU.waitUntil=Date.now()+r.wait*1000;return;}
    AU.err.password=esc(r.error||'Wrong username, email or password.')+(r.left!=null&&r.left<=2?' <b>'+r.left+' '+(r.left===1?'try':'tries')+' left</b> before a 5-minute pause.':'');
  });
  if(which==='signup'||which==='enable')return auRun(async function(){
    const p={username:String(v.username||'').trim().toLowerCase(),email:String(v.email||'').trim().toLowerCase(),password:v.password,keep:true};
    const r=await authCall(which==='enable'?'enable':'signup',p);
    if(r.ok){AU.pend=p;auToVerify(r,which==='enable'?'enable':'signup',p.email);return;}
    if(r.wait&&!r.field){AU.bad='Please wait '+r.wait+' seconds before asking for another code.';return;}
    auServerErr(r);
  });
  if(which==='forgot')return auRun(async function(){
    const em=String(v.email||'').trim().toLowerCase();
    const r=await authCall('forgot',{email:em});
    if(r.ok){auToVerify(r,'reset',em);return;}
    auServerErr(r);
  });
  if(which==='verify')return auRun(async function(){
    const code=String(v.code||'');
    if(AU.purpose==='reset'){
      const r=await authCall('reset_check',{email:AU.email,code:code});
      if(r.ok){AU.ticket=r.ticket;AU.screen='newpass';AU.v.npass='';AU.v.npass2='';AU.expAt=0;AU.resendAt=0;return;}
      v.code='';AU.err.code=esc(r.error)+(r.left!=null?' <b>'+r.left+' '+(r.left===1?'try':'tries')+' left</b>, then you’ll need a new code.':'');return;
    }
    const r=AU.purpose==='enable'
      ?await authCall('enable_verify',{username:AU.pend.username,email:AU.email,code:code})
      :await authCall('verify',{email:AU.email,code:code});
    if(r.ok){auLoggedIn(r);AU.screen='ready';AU.user=r.user;AU.shared=r.shared;AU.admin=!!r.admin;AU.expAt=0;AU.resendAt=0;return;}
    if(r.restart){AU.screen='signup';AU.expAt=0;AU.resendAt=0;auServerErr(r);return;}
    v.code='';AU.err.code=esc(r.error)+(r.left!=null?' <b>'+r.left+' '+(r.left===1?'try':'tries')+' left</b>, then you’ll need a new code.':'');
  });
  if(which==='newpass')return auRun(async function(){
    if(v.npass!==v.npass2){AU.err.npass2='The two passwords don’t match.';return;}
    const r=await authCall('reset',{email:AU.email,ticket:AU.ticket,password:v.npass});
    if(r.ok){auLoggedIn(r);hideAuth();toast('Password changed. You’re logged in.','ok');firstLoad();return;}
    if(r.expired){showAuth('forgot',{state:{bad:esc(r.error)}});return;}
    auServerErr(r);
  });
}
async function auResend(){
  return auRun(async function(){
    const r=await authCall('resend',{email:AU.email,purpose:AU.purpose});
    if(r.ok){AU.expAt=Date.now()+(r.expiresIn||600)*1000;AU.resendAt=Date.now()+(r.resendIn||45)*1000;AU.v.code='';AU.err={};toast('New code sent to '+(r.sentTo||'your email')+'.','ok');return;}
    if(r.wait){AU.resendAt=Date.now()+r.wait*1000;return;}
    if(r.expired){showAuth(AU.purpose==='reset'?'forgot':AU.purpose==='enable'?'enable':'signup',{keepValues:true,state:{bad:esc(r.error)}});return;}
    AU.bad=esc(r.error||'Couldn’t send a new code.');
  });
}

/* ---------- events ---------- */
document.addEventListener('input',function(e){
  const t=e.target;if(!t.closest||!t.closest('#auRoot'))return;
  const k=t.dataset&&t.dataset.auIn;if(!k)return;
  let val=t.type==='checkbox'?t.checked:t.value;
  if(k==='username'){const low=String(val).toLowerCase().replace(/\s/g,'');if(low!==val){const pos=t.selectionStart;t.value=low;try{t.setSelectionRange(pos,pos);}catch(x){}}val=low;}
  if(k==='code'){val=String(val).replace(/\D/g,'').slice(0,6);if(val!==t.value)t.value=val;}
  AU.v[k]=val;
  if(AU.err[k]){delete AU.err[k];const box=document.querySelector('#auRoot [data-in="'+k+'"]');if(box)box.classList.remove('bad');const m=document.getElementById('au_'+k+'_m');if(m)m.innerHTML='';t.removeAttribute('aria-invalid');}
  if(k==='code'){if(AU.err.code){delete AU.err.code;const m=document.getElementById('au_code_m');if(m)m.innerHTML='';const c=document.querySelector('#auRoot .au-code');if(c)c.classList.remove('bad');}
    auLive();if(val.length===6&&!AU.busy)auSubmit('verify');return;}
  if(AU.bad){AU.bad='';const tl=document.querySelector('#auRoot .au-tile.bad');if(tl&&AU.screen!=='login')tl.remove();}
  auLive();
});
document.addEventListener('submit',function(e){
  const f=e.target.closest&&e.target.closest('#auRoot [data-au-form]');if(!f)return;
  e.preventDefault();
  const b=f.querySelector('[data-au-go]');if(b&&b.disabled)return;
  auSubmit(f.dataset.auForm==='enable'?'enable':f.dataset.auForm);
});
document.addEventListener('click',function(e){
  const b=e.target.closest&&e.target.closest('#auRoot [data-au]');if(!b)return;
  const a=b.dataset.au;
  if(a==='eye'){const inp=document.getElementById('au_'+b.dataset.k);if(!inp)return;const show=inp.type==='password';inp.type=show?'text':'password';b.innerHTML=AI(show?'eyeoff':'eye',19);b.setAttribute('aria-label',show?'Hide password':'Show password');return;}
  if(a==='theme'){state.settings.theme=b.dataset.v;applyTheme();try{saveState();}catch(x){}auDraw();return;}
  if(a==='go'){showAuth(b.dataset.to,{keepValues:true});return;}
  if(a==='resend'){auResend();return;}
  if(a==='enter'){hideAuth();firstLoad();return;}
  if(a==='back'){
    if(AU.screen==='enable'){hideAuth();Sync.locked=false;return;}
    if(AU.screen==='verify'&&AU.purpose==='enable'){showAuth('enable',{keepValues:true});return;}
    if(AU.screen==='verify'&&AU.purpose==='reset'||AU.screen==='newpass'){showAuth('forgot',{keepValues:true});return;}
    if(AU.screen==='verify'){showAuth('signup',{keepValues:true});return;}
    showAuth('login',{keepValues:true});
  }
});
document.addEventListener('keydown',function(e){
  if(!auOpen())return;
  if(e.key==='Escape'&&AU.screen==='enable'){hideAuth();Sync.locked=false;}
},true);

/* ---------- Settings → Account ---------- */
function accountPanelHTML(){
  if(!Sync.url)return '';
  if(!Sync.accountsOn){
    return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Accounts</h3><span class="badge b-mut" style="margin-left:auto">Off</span></div><div class="panel-body">'+
      '<p class="pin-txt">Let friends sign up with their own username, password and email. Each gets a private budget sheet. You become the admin, and your current budget stays yours.</p>'+
      '<button class="btn btn-primary" data-act="acc-enable">'+AI('users',15)+' Turn On Accounts</button></div></div>';
  }
  const u=Sync.user||savedUser()||{};
  const li=function(k,v){return '<div class="acc-li"><span>'+k+'</span><b>'+v+'</b></div>';};
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Account</h3>'+(u.role==='Admin'?'<span class="badge acc-admin" style="margin-left:auto">Admin</span>':'')+'</div><div class="panel-body">'+
    li('Username',esc(u.username||'—'))+li('Email',esc(u.email||'—')+' <span class="badge b-mut">Verified</span>')+
    (SHEET_LINK?li('Your sheet',I('sheet',15)+' Google Sheet'):'')+
    '<div class="split-btns" style="margin-top:14px">'+(SHEET_LINK?'<a class="btn btn-primary" href="'+esc(SHEET_LINK)+'" target="_blank" rel="noopener">'+I('ext',15)+' Open My Sheet</a>':'')+
      '<button class="btn" data-act="acc-pass">'+I('lock',15)+' Change Password</button><button class="btn" data-act="acc-logout">'+AI('out',15)+' Log Out</button></div>'+
    (u.role==='Admin'?'<p class="pin-txt" style="margin-top:12px">You’re the admin. Everyone’s account is listed in the <b>Badyet Accounts</b> sheet in your Google Drive.</p>'+
      (Sync.accountsUrl?'<a class="btn" style="margin-top:4px" href="'+esc(Sync.accountsUrl)+'" target="_blank" rel="noopener">'+AI('users',15)+' Open Accounts List</a>':''):'')+
  '</div></div>';
}
function openChangePassword(){
  openModal({title:'Change Password',body:
    '<form id="fPw" novalidate><div class="form-err" id="fPwErr"></div>'+
    '<div class="fgrid"><div class="field"><label for="pwCur">Current password</label><input class="inp" id="pwCur" type="password" autocomplete="current-password"></div>'+
    '<div class="field"><label for="pwNew">New password</label><input class="inp" id="pwNew" type="password" autocomplete="new-password"></div>'+
    '<div class="field"><label for="pwNew2">Type it again</label><input class="inp" id="pwNew2" type="password" autocomplete="new-password"></div></div>'+
    '<div class="note">At least 8 characters with a number. Your other phones will be logged out; this one stays in.</div></form>',
    foot:'<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="pwSave">Save Password</button>',
    onMount:function(){
      $('#fPw').addEventListener('submit',function(e){e.preventDefault();$('#pwSave').click();});
      $('#pwSave').addEventListener('click',async function(){
        const cur=$('#pwCur').value,a=$('#pwNew').value,b=$('#pwNew2').value,errEl=$('#fPwErr'),u=Sync.user||{};
        const bad=AU_RULES.pass(a,u.username,u.email).find(function(r){return !r.ok;});
        const msg=!cur?'Enter your current password.':bad?bad.t+' is required.':a!==b?'The two new passwords don’t match.':'';
        if(msg){errEl.textContent=msg;errEl.classList.add('show');return;}
        $('#pwSave').disabled=true;$('#pwSave').textContent='Saving…';
        try{
          const r=await authCall('change_password',{current:cur,password:a});
          if(r.auth){closeModal();handleAuth();return;}
          if(!r.ok)throw new Error(r.error||'Not saved');
          closeModal();toast('Password changed. Other phones were logged out.','ok');
        }catch(e){errEl.textContent=e.message;errEl.classList.add('show');$('#pwSave').disabled=false;$('#pwSave').textContent='Save Password';}
      });
    }});
}
