// ── SUPABASE ──────────────────────────────────────────────────────
var _sb = window.supabase.createClient(
  'https://bjzckhanxudkyrpczqbs.supabase.co',
  'sb_publishable_f64M7MFa88zOMuZ083v-lw_Ypgcyhx-'
);

// ── EMAIL ─────────────────────────────────────────────────────────
function sendEmail(to,subject,html){fetch('https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/resend-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer sb_publishable_f64M7MFa88zOMuZ083v-lw_Ypgcyhx-'},body:JSON.stringify({to,subject,html})}).catch(err=>console.error('Email error:',err));}

// ── HELPERS ──────────────────────────────────────────────────────
var darkMode=false;
function toggleDark(){darkMode=!darkMode;document.body.classList.toggle('dark',darkMode);syncSettingsMenu();}
function openSettingsMenu(e){e.stopPropagation();var menu=document.getElementById('settings-menu');if(menu.style.display==='block'){menu.style.display='none';return;}syncSettingsMenu();menu.style.display='block';var rect=e.currentTarget.getBoundingClientRect();var top=rect.bottom+6,left=Math.max(8,rect.right-220);if(top+180>window.innerHeight)top=rect.top-190;menu.style.top=top+'px';menu.style.left=left+'px';}
function syncSettingsMenu(){var dv=document.getElementById('sm-dark-val');if(dv){dv.textContent=darkMode?'On':'Off';dv.className=darkMode?'sm-badge':'sm-badge off';}var hv=document.getElementById('sm-hints-val');if(hv){hv.textContent=state.hideHints?'Hidden':'Shown';hv.className=state.hideHints?'sm-badge off':'sm-badge';}}
function toggleHints(){state.hideHints=!state.hideHints;document.querySelectorAll('.page-banner').forEach(el=>el.style.display=state.hideHints?'none':'');syncSettingsMenu();}
function goToMarketIndex(){document.getElementById('settings-menu').style.display='none';showPage('public');}
function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function uid(){return crypto.randomUUID();}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function makeSlug(n){return n.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');}

// ── AUTH ─────────────────────────────────────────────────────────
var currentUser=null;
function switchAuthTab(t){document.querySelectorAll('.auth-tab').forEach((el,i)=>el.classList.toggle('active',(i===0&&t==='login')||(i===1&&t==='register')));document.getElementById('auth-login').style.display=t==='login'?'block':'none';document.getElementById('auth-register').style.display=t==='register'?'block':'none';document.getElementById('auth-forgot').style.display=t==='forgot'?'block':'none';clearAuthMsg();}
function showAuthError(m){var e=document.getElementById('auth-error');e.textContent=m;e.style.display='block';document.getElementById('auth-success').style.display='none';}
function showAuthSuccess(m){var e=document.getElementById('auth-success');e.textContent=m;e.style.display='block';document.getElementById('auth-error').style.display='none';}
function clearAuthMsg(){document.getElementById('auth-error').style.display='none';document.getElementById('auth-success').style.display='none';}
async function doLogin(){var email=document.getElementById('login-email').value.trim().toLowerCase();var pass=document.getElementById('login-password').value;if(!email||!pass){showAuthError('Please fill in all fields.');return;}var{data,error}=await _sb.auth.signInWithPassword({email,password:pass});if(error){showAuthError('Incorrect email or password.');return;}var{data:profile}=await _sb.from('profiles').select('*').eq('id',data.user.id).single();if(!profile){showAuthError('Account has no profile. Please contact support.');return;}loginAs(data.user,profile);}
async function doRegister(){var market=document.getElementById('reg-market').value.trim();var name=document.getElementById('reg-name').value.trim();var email=document.getElementById('reg-email').value.trim().toLowerCase();var pass=document.getElementById('reg-password').value;var confirm=document.getElementById('reg-confirm').value;if(!market||!name||!email||!pass||!confirm){showAuthError('Please fill in all fields.');return;}if(!email.includes('@')){showAuthError('Please enter a valid email.');return;}if(pass.length<6){showAuthError('Password must be at least 6 characters.');return;}if(pass!==confirm){showAuthError('Passwords do not match.');return;}var{data:existing}=await _sb.from('profiles').select('id').eq('market_name',market).maybeSingle();if(existing){showAuthError('That market name is already taken. Please choose a different name.');return;}var{data,error}=await _sb.auth.signUp({email,password:pass});if(error){showAuthError(error.message);return;}var slug=makeSlug(market);var{error:pErr}=await _sb.from('profiles').insert({id:data.user.id,market_name:market,coordinator_name:name,slug,coordinator_email:email});if(pErr){showAuthError('Account created but profile failed to save. Please try logging in.');return;}showAuthSuccess('Account created! Logging you in...');setTimeout(()=>loginAs(data.user,{market_name:market,coordinator_name:name,slug}),800);}
async function loginAs(user,profile){currentUser={...user,market:profile.market_name,name:profile.coordinator_name,slug:profile.slug};state.vendors=[];state.markets=[];state.expandedRows={};state.approvedToday=0;state.filterPayment='';document.getElementById('auth-screen').style.display='none';document.getElementById('dashboard').style.display='block';document.getElementById('nav-brand').innerHTML='<span>'+esc(profile.market_name)+'</span> &ndash; Dashboard';document.getElementById('nav-user').textContent=profile.coordinator_name;document.getElementById('pub-title').textContent=profile.market_name;await loadUserData();renderPublicLinkBanner();renderPending();updateMetrics();}
async function doLogout(){await _sb.auth.signOut();currentUser=null;document.getElementById('dashboard').style.display='none';document.getElementById('auth-screen').style.display='flex';document.getElementById('login-email').value='';document.getElementById('login-password').value='';clearAuthMsg();switchAuthTab('login');}
async function doForgotPassword(){var email=document.getElementById('forgot-email').value.trim().toLowerCase();if(!email){showAuthError('Please enter your email.');return;}var{error}=await _sb.auth.resetPasswordForEmail(email,{redirectTo:'https://picamarket.site/'});if(error){showAuthError(error.message);return;}showAuthSuccess('Reset link sent! Check your inbox.');}
async function doResetPassword(){var pass=document.getElementById('reset-password-input').value;var confirm=document.getElementById('reset-password-confirm').value;var re=document.getElementById('reset-error'),rs=document.getElementById('reset-success');re.style.display='none';rs.style.display='none';if(!pass||!confirm){re.textContent='Please fill in both fields.';re.style.display='block';return;}if(pass.length<6){re.textContent='Password must be at least 6 characters.';re.style.display='block';return;}if(pass!==confirm){re.textContent='Passwords do not match.';re.style.display='block';return;}var{error}=await _sb.auth.updateUser({password:pass});if(error){re.textContent=error.message;re.style.display='block';return;}rs.textContent='Password updated! You can now log in.';rs.style.display='block';setTimeout(()=>{document.getElementById('reset-password-modal').classList.remove('open');},2000);}
// Restore session on page load only; handle password recovery redirect
_sb.auth.onAuthStateChange(async(event,session)=>{
  if(event==='PASSWORD_RECOVERY'){document.getElementById('reset-password-modal').classList.add('open');return;}
  if(event==='INITIAL_SESSION'&&session&&!currentUser){var{data:profile}=await _sb.from('profiles').select('*').eq('id',session.user.id).single();if(profile)loginAs(session.user,profile);}
});

// ── DB HELPERS ────────────────────────────────────────────────────
function dbToMarket(r){return{id:r.id,name:r.name,desc:r.description||'',header:r.header||'',fee:r.fee||FEE,capacity:r.capacity||30,dates:r.dates||[],banner:r.banner||null,published:r.published||false,notes:r.notes||''};}
function marketToDb(m){return{id:m.id,user_id:currentUser.id,name:m.name,description:m.desc||'',header:m.header||'',fee:m.fee||FEE,capacity:m.capacity||30,dates:m.dates||[],banner:m.banner||null,published:!!m.published,notes:m.notes||''};}
function dbToVendor(r){return{id:r.id,name:r.name,desc:r.description||'',email:r.email,status:r.status||'pending',markets:r.markets||[],marketPayments:r.market_payments||{},marketMethods:r.market_methods||{},payStatus:r.pay_status||'outstanding',payMethod:r.pay_method||null,images:r.images||[],submitted:r.submitted_at||'',approvedAt:r.approved_at||'',feePerMarket:FEE};}
function vendorToDb(v){return{id:v.id,user_id:currentUser.id,name:v.name,description:v.desc||'',email:v.email,status:v.status,markets:v.markets||[],market_payments:v.marketPayments||{},market_methods:v.marketMethods||{},pay_status:v.payStatus||'outstanding',pay_method:v.payMethod||null,images:v.images||[],submitted_at:v.submitted||'',approved_at:v.approvedAt||''};}
async function loadUserData(){var[{data:mkts},{data:vnds}]=await Promise.all([_sb.from('markets').select('*').eq('user_id',currentUser.id).order('created_at'),_sb.from('vendors').select('*').eq('user_id',currentUser.id).order('created_at')]);state.markets=(mkts||[]).map(dbToMarket);state.vendors=(vnds||[]).map(dbToVendor);}
function sbSave(table,obj){_sb.from(table).upsert(obj).then(({error})=>{if(error)console.error('DB save error:',error);});}
function sbDel(table,id){_sb.from(table).delete().eq('id',id).then(({error})=>{if(error)console.error('DB delete error:',error);});}

// ── STATE ─────────────────────────────────────────────────────────
// Each vendor object shape:
// { id, name, desc, email, status, markets:['mid1','mid2'],
//   marketPayments:{'mid1':'outstanding','mid2':'paid'},
//   payStatus:'outstanding'|'partial'|'paid', payMethod, feePerMarket,
//   images, submitted, approvedAt }
var state={vendors:[],markets:[],editMarketId:null,notesMarketId:null,approvedToday:0,expandedRows:{},filterPayment:'',hideHints:false,_approveQueue:[],_removeQueue:[],_tempDates:[],_tempBanner:null,_menuVendorId:null,_payMarketId:null};
var FEE=350;
var _vendorImages=[];

// ── NAVIGATION ────────────────────────────────────────────────────
function showPage(p){document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));document.querySelectorAll('.nav-tab').forEach(el=>el.classList.remove('active'));document.querySelectorAll('.bottom-nav-item').forEach(el=>el.classList.remove('active'));document.getElementById('page-'+p).classList.add('active');var map={approval:0,approved:1,markets:2};if(map[p]!==undefined){document.querySelectorAll('.nav-tab')[map[p]].classList.add('active');document.querySelectorAll('.bottom-nav-item')[map[p]].classList.add('active');}if(p==='approval')renderPending();if(p==='approved')renderApproved();if(p==='markets')renderMarkets();if(p==='public')renderPublic();if(state.hideHints)document.querySelectorAll('.page-banner').forEach(el=>el.style.display='none');updateMetrics();window.scrollTo(0,0);}
function pubTab(t){var tabs=document.querySelectorAll('.tabs-inner .tab-inner');tabs[0].classList.toggle('active',t==='browse');tabs[1].classList.toggle('active',t==='apply');document.getElementById('pub-browse').style.display=t==='browse'?'block':'none';document.getElementById('pub-apply').style.display=t==='apply'?'block':'none';if(t==='apply')renderVendorFormMarkets();}
function updateMetrics(){var pend=state.vendors.filter(v=>v.status==='pending');var appr=state.vendors.filter(v=>v.status==='approved');var paid=appr.filter(v=>v.payStatus==='paid');var rev=appr.reduce((s,v)=>s+v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+(m?m.fee||FEE:FEE);},0),0);document.getElementById('m-pending').textContent=pend.length;document.getElementById('m-app-total').textContent=appr.length;document.getElementById('m-app-paid').textContent=paid.length;document.getElementById('m-app-out').textContent=appr.length-paid.length;document.getElementById('m-app-rev').textContent='R'+rev.toLocaleString();}

// ── VENDOR APPROVAL ───────────────────────────────────────────────
function renderPending(filter){
  var list=state.vendors.filter(v=>v.status==='pending');
  if(filter)list=list.filter(v=>v.name.toLowerCase().includes(filter.toLowerCase()));
  var tb=document.getElementById('pending-tbody'),cards=document.getElementById('pending-cards'),empty=document.getElementById('pending-empty');
  if(!list.length){tb.innerHTML='';cards.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  tb.innerHTML=list.map(v=>{
    var mchips=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<span class="chip">'+esc(m.name)+'</span>':''}).join('');
    var exp=state.expandedRows[v.id];
    var photos=v.images&&v.images.length?'<div style="grid-column:1/-1"><div class="field-label">Stall photos</div><div class="img-thumb-grid" style="margin-top:4px">'+v.images.map(src=>'<div class="img-thumb"><img src="'+src+'"></div>').join('')+'</div></div>':'';
    var rows='<tr><td><input type="checkbox" class="v-check" value="'+v.id+'"></td><td><button class="vendor-name-btn" onclick="toggleExpand(\''+v.id+'\')">'+esc(v.name)+'</button></td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">'+esc(v.desc)+'</td><td><span class="badge" style="background:var(--teal-bg);color:var(--teal)">'+v.markets.length+' mkt'+(v.markets.length!==1?'s':'')+'</span></td><td style="color:var(--text2)">'+v.submitted+'</td><td><span class="badge pending">Pending</span></td></tr>';
    if(exp){rows+='<tr class="expand-row"><td colspan="6"><div class="expand-inner"><div><div class="field-label">Email</div><div class="field-value">'+esc(v.email)+'</div></div><div><div class="field-label">Est. fee</div><div class="field-value" style="font-weight:500">R'+(v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+(m?m.fee||FEE:FEE);},0)).toLocaleString()+'</div></div><div style="grid-column:1/-1"><div class="field-label">Description</div><div class="field-value">'+esc(v.desc)+'</div></div><div style="grid-column:1/-1"><div class="field-label">Markets selected</div><div class="market-chips" style="margin-top:4px">'+(mchips||'None')+'</div></div>'+photos+'</div></td></tr>';}
    return rows;
  }).join('');
  cards.innerHTML=list.map(v=>{
    var mchips=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<span class="chip">'+esc(m.name)+'</span>':''}).join('');
    var exp=state.expandedRows[v.id+'_m'];
    var photos=v.images&&v.images.length?'<div><div class="field-label">Stall photos</div><div class="img-thumb-grid" style="margin-top:4px">'+v.images.map(src=>'<div class="img-thumb"><img src="'+src+'"></div>').join('')+'</div></div>':'';
    var expand=exp?'<div class="vendor-card-expand"><div class="field-label">Email</div><div class="field-value">'+esc(v.email)+'</div><div class="field-label">Description</div><div class="field-value">'+esc(v.desc)+'</div><div class="field-label">Markets</div><div class="market-chips" style="margin-top:4px">'+(mchips||'None')+'</div><div class="field-label">Est. fee</div><div class="field-value" style="font-weight:500">R'+(v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+(m?m.fee||FEE:FEE);},0)).toLocaleString()+'</div>'+photos+'</div>':'';
    return'<div class="vendor-card"><div class="vendor-card-header"><div class="vendor-card-check"><input type="checkbox" class="v-check" value="'+v.id+'"></div><div class="vendor-card-name" onclick="toggleExpandMobile(\''+v.id+'\')">'+esc(v.name)+'</div><div class="vendor-card-badge"><span class="badge pending">Pending</span></div></div><div class="vendor-card-meta">'+v.markets.length+' market'+(v.markets.length!==1?'s':'')+' &middot; '+v.submitted+'</div>'+expand+'</div>';
  }).join('');
}
function toggleExpand(id){state.expandedRows[id]=!state.expandedRows[id];renderPending();}
function toggleExpandMobile(id){state.expandedRows[id+'_m']=!state.expandedRows[id+'_m'];renderPending();}
function toggleAll(cb){document.querySelectorAll('.v-check').forEach(c=>c.checked=cb.checked);}
function disapproveSelected(){var checked=[...new Set(Array.from(document.querySelectorAll('.v-check:checked')).map(c=>c.value))];if(!checked.length){alert('Select at least one vendor to remove.');return;}state._removeQueue=checked;var names=checked.map(id=>{var v=state.vendors.find(x=>x.id===id);return v?v.name:null;}).filter(Boolean);document.getElementById('remove-modal-list').innerHTML=names.map(n=>'<li style="padding:4px 0;font-size:13px">'+esc(n)+'</li>').join('');document.getElementById('remove-modal').classList.add('open');}
function confirmRemove(){state._removeQueue.forEach(id=>sbDel('vendors',id));state.vendors=state.vendors.filter(v=>!state._removeQueue.includes(v.id));state._removeQueue=[];closeModal('remove-modal');renderPending();updateMetrics();}
function approveSelected(){var checked=[...new Set(Array.from(document.querySelectorAll('.v-check:checked')).map(c=>c.value))];if(!checked.length){alert('Select at least one vendor to approve.');return;}state._approveQueue=checked.slice();openNextApproval();}
function closeApprovalModal(){state._approveQueue=[];closeModal('approve-modal');}
function openNextApproval(){if(!state._approveQueue.length){updateMetrics();renderPending();return;}var id=state._approveQueue[0];var v=state.vendors.find(x=>x.id===id);if(!v){state._approveQueue.shift();openNextApproval();return;}document.getElementById('approve-modal-name').textContent=v.name;document.getElementById('approve-modal-count').textContent=state._approveQueue.length>1?state._approveQueue.length+' vendors in queue':'';document.getElementById('approve-market-checks').innerHTML=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);if(!m)return'';return'<label style="display:flex;align-items:center;gap:10px;padding:12px;border:0.5px solid var(--border);border-radius:8px;cursor:pointer;margin-bottom:8px;background:var(--bg3)"><input type="checkbox" class="approve-mkt-cb" value="'+mid+'" checked style="width:18px;height:18px;accent-color:var(--blue)"><div><div style="font-size:14px;font-weight:500;color:var(--text)">'+esc(m.name)+'</div><div style="font-size:12px;color:var(--text2)">'+m.dates.join(' · ')+' · R'+(m.fee||FEE)+'/date</div></div></label>';}).join('');document.getElementById('approve-modal').classList.add('open');}

function mergeApproveVendor(v,sel){var mnames=sel.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?m.name:mid;}).join(', ');var existing=state.vendors.find(x=>x.id!==v.id&&x.status==='approved'&&x.email===v.email);if(existing){sel.forEach(mid=>{if(!existing.markets.includes(mid))existing.markets.push(mid);if(!existing.marketPayments)existing.marketPayments={};if(!existing.marketPayments[mid])existing.marketPayments[mid]='outstanding';});sbSave('vendors',vendorToDb(existing));sbDel('vendors',v.id);state.vendors=state.vendors.filter(x=>x.id!==v.id);}else{v.status='approved';v.markets=sel.slice();v.payStatus='outstanding';v.payMethod=null;v.marketPayments={};sel.forEach(mid=>{v.marketPayments[mid]='outstanding';});v.approvedAt=new Date().toLocaleDateString('en-ZA');sbSave('vendors',vendorToDb(v));}sendEmail(v.email,'You\'ve been approved — '+esc(currentUser.market),'<p>Hi '+esc(v.name)+',</p><p>Great news! Your vendor application has been approved for the following market'+(sel.length!==1?'s':'')+':</p><p><strong>'+esc(mnames)+'</strong></p><p>The coordinator will be in touch with further details. Please ensure your stall fee is paid before the market date.</p><p>Thanks,<br>'+esc(currentUser.market)+'</p>');}

function confirmApproval(){
  var id=state._approveQueue.shift();
  var v=state.vendors.find(x=>x.id===id);
  var sel=Array.from(document.querySelectorAll('.approve-mkt-cb:checked')).map(c=>c.value);
  if(!sel.length){alert('Select at least one market.');state._approveQueue.unshift(id);return;}
  mergeApproveVendor(v,sel);
  state.approvedToday++;
  closeModal('approve-modal');
  setTimeout(openNextApproval,200);
}

function skipApproval(){state._approveQueue.shift();closeModal('approve-modal');setTimeout(openNextApproval,200);}

function approveAll(){
  [...state._approveQueue].forEach(id=>{
    var v=state.vendors.find(x=>x.id===id);
    if(!v)return;
    mergeApproveVendor(v,v.markets.slice());
    state.approvedToday++;
  });
  state._approveQueue=[];
  closeModal('approve-modal');
  updateMetrics();
  renderPending();
}

// ── APPROVED VENDORS ──────────────────────────────────────────────
function calcPayStatus(v){
  var mids=v.markets||[];
  if(!mids.length)return'outstanding';
  var mp=v.marketPayments||{};
  var paidCount=mids.filter(mid=>mp[mid]==='paid').length;
  if(paidCount===mids.length)return'paid';
  if(paidCount>0)return'partial';
  return'outstanding';
}

function renderApproved(filter,payFilter){
  filter=filter||'';payFilter=payFilter||state.filterPayment||'';
  var list=state.vendors.filter(v=>v.status==='approved');
  if(filter)list=list.filter(v=>v.name.toLowerCase().includes(filter.toLowerCase()));
  if(payFilter){list=list.filter(v=>{var ps=calcPayStatus(v);return payFilter==='paid'?ps==='paid':ps!=='paid';});}
  var tb=document.getElementById('approved-tbody'),cards=document.getElementById('approved-cards'),empty=document.getElementById('approved-empty');
  if(!list.length){tb.innerHTML='';cards.innerHTML='';empty.style.display='block';updateMetrics();return;}
  empty.style.display='none';
  tb.innerHTML=list.map(v=>{
    var fee=v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+(m?m.fee||FEE:FEE);},0);
    var chips=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<span class="chip">'+esc(m.name)+'</span>':''}).join('');
    var ps=calcPayStatus(v);
    var pb=ps==='paid'?'<span class="badge paid">Paid</span>':ps==='partial'?'<span class="badge partial">Partial</span>':'<span class="badge outstanding">Outstanding</span>';
    var method='<span style="color:var(--text3);font-size:12px">—</span>';
    var exp=state.expandedRows['appr_'+v.id];
    var rows='<tr><td><button class="vendor-name-btn" onclick="toggleExpandApproved(\''+v.id+'\')" style="font-weight:500">'+esc(v.name)+'</button><br><span style="font-size:11px;color:var(--text2)">'+esc(v.email)+'</span></td><td><div class="market-chips">'+(chips||'—')+'</div></td><td style="font-weight:500">R'+fee.toLocaleString()+'</td><td>'+pb+'</td><td>'+method+'</td><td><button onclick="openDotMenu(event,\''+v.id+'\')" style="background:none;border:0.5px solid var(--border);border-radius:6px;cursor:pointer;padding:4px 9px;font-size:16px;color:var(--text2);line-height:1">&#8942;</button></td></tr>';
    if(exp){
      rows+=v.markets.map(mid=>{
        var m=state.markets.find(x=>x.id===mid);
        var mp=(v.marketPayments||{})[mid];
        var mm=(v.marketMethods||{})[mid];
        var mpb=mp==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';
        var mmb=mm?'<span class="badge '+mm+'">'+mm.charAt(0).toUpperCase()+mm.slice(1)+'</span>':'<span style="color:var(--text3);font-size:12px">—</span>';
        return'<tr style="background:var(--bg2)"><td colspan="2" style="padding:8px 12px 8px 28px;font-size:12px;color:var(--text2)">&#8627; '+(m?esc(m.name):mid)+'</td><td style="padding:8px 12px;font-size:12px;font-weight:500">R'+(m?m.fee||FEE:FEE)+'</td><td style="padding:8px 12px">'+mpb+'</td><td style="padding:8px 12px">'+mmb+'</td><td></td></tr>';
      }).join('');
    }
    return rows;
  }).join('');
  cards.innerHTML=list.map(v=>{
    var fee=v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+(m?m.fee||FEE:FEE);},0);
    var chips=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<span class="chip">'+esc(m.name)+'</span>':''}).join('');
    var ps=calcPayStatus(v);
    var pb=ps==='paid'?'<span class="badge paid">Paid</span>':ps==='partial'?'<span class="badge partial">Partial</span>':'<span class="badge outstanding">Outstanding</span>';
    var exp=state.expandedRows['appr_'+v.id];
    var expandContent=exp?'<div style="margin-top:10px;padding-top:10px;border-top:0.5px solid var(--border)">'+v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);var mp=(v.marketPayments||{})[mid];var mm=(v.marketMethods||{})[mid];var mpb=mp==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';var mmb=mm?'<span class="badge '+mm+'">'+mm.charAt(0).toUpperCase()+mm.slice(1)+'</span>':'';return'<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:0.5px solid var(--border)"><span style="font-size:12px;color:var(--text2)">'+(m?esc(m.name):mid)+'</span><div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;font-weight:500;color:var(--text)">R'+(m?m.fee||FEE:FEE)+'</span>'+mpb+mmb+'</div></div>';}).join('')+'</div>':'';
    return'<div class="vendor-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div><button class="vendor-name-btn" onclick="toggleExpandApproved(\''+v.id+'\')" style="font-size:14px;font-weight:500">'+esc(v.name)+'</button><div style="font-size:11px;color:var(--text2)">'+esc(v.email)+'</div></div><div style="display:flex;align-items:center;gap:6px">'+pb+'<button onclick="openDotMenu(event,\''+v.id+'\')" style="background:none;border:0.5px solid var(--border);border-radius:6px;cursor:pointer;padding:4px 8px;font-size:16px;color:var(--text2);line-height:1">&#8942;</button></div></div><div class="market-chips" style="margin-bottom:8px">'+(chips||'—')+'</div><span style="font-size:13px;font-weight:500;color:var(--text)">R'+fee.toLocaleString()+'</span>'+expandContent+'</div>';
  }).join('');
  updateMetrics();
}
function toggleExpandApproved(id){state.expandedRows['appr_'+id]=!state.expandedRows['appr_'+id];renderApproved();}

// ── DOT MENU ──────────────────────────────────────────────────────
function openDotMenu(e,vid){
  e.stopPropagation();
  state._menuVendorId=vid;
  var v=state.vendors.find(x=>x.id===vid);
  var menu=document.getElementById('dot-menu');
  document.getElementById('dot-menu-label').textContent=v?v.name:'';
  menu.style.display='block';
  var rect=e.currentTarget.getBoundingClientRect();
  var top=rect.bottom+6,left=rect.right-200;
  if(left<8)left=8;
  if(top+180>window.innerHeight)top=rect.top-190;
  menu.style.top=top+'px';menu.style.left=left+'px';
}
document.addEventListener('click',function(e){var dm=document.getElementById('dot-menu');if(dm&&dm.style.display==='block'&&!dm.contains(e.target))dm.style.display='none';var sm=document.getElementById('settings-menu');if(sm&&sm.style.display==='block'&&!sm.contains(e.target))sm.style.display='none';});

function dotMenuAction(action){
  document.getElementById('dot-menu').style.display='none';
  var v=state.vendors.find(x=>x.id===state._menuVendorId);
  if(!v)return;
  if(action==='addmarket'){
    document.getElementById('add-market-vendor-name').textContent=v.name;
    var sel=document.getElementById('add-market-select');
    sel.innerHTML='<option value="">Select a market...</option>'+state.markets.filter(m=>!v.markets.includes(m.id)).map(m=>'<option value="'+m.id+'">'+esc(m.name)+(m.published?'':' (draft)')+'</option>').join('');
    document.getElementById('add-market-info').style.display='none';
    document.getElementById('add-market-modal').classList.add('open');
  } else if(action==='credit'){
    document.getElementById('credit-vendor-name').textContent=v.name;
    var sel2=document.getElementById('credit-market-select');
    sel2.innerHTML='<option value="">Select a market...</option>'+state.markets.map(m=>'<option value="'+m.id+'">'+esc(m.name)+(m.published?'':' (draft)')+'</option>').join('');
    document.getElementById('credit-info').style.display='none';
    document.getElementById('credit-modal').classList.add('open');
  } else if(action==='pay'){
    document.getElementById('pay-modal-name').textContent=v.name;
    document.getElementById('pay-step-1').style.display='block';
    document.getElementById('pay-step-2').style.display='none';
    document.getElementById('pay-step-1-info').style.display='none';
    var sel3=document.getElementById('pay-market-sel');
    sel3.innerHTML='<option value="">Choose a market...</option>';
    v.markets.forEach(function(mid){
      var m=state.markets.find(x=>x.id===mid);
      var mp=(v.marketPayments||{})[mid];
      var opt=document.createElement('option');
      opt.value=mid;
      opt.textContent=(m?m.name:mid)+' — '+(mp==='paid'?'Paid':'Outstanding');
      sel3.appendChild(opt);
    });
    document.getElementById('pay-modal').classList.add('open');
  } else if(action==='remove'){
    document.getElementById('remove-approved-name').textContent=v.name;
    document.getElementById('remove-approved-modal').classList.add('open');
  }
}

// ── PAY MODAL FLOW ────────────────────────────────────────────────
function payStep2(){
  var mid=document.getElementById('pay-market-sel').value;
  if(!mid){alert('Please select a market.');return;}
  state._payMarketId=mid;
  var m=state.markets.find(x=>x.id===mid);
  document.getElementById('pay-step-2-market').textContent=m?m.name:mid;
  document.getElementById('pay-step-1').style.display='none';
  document.getElementById('pay-step-2').style.display='block';
}
function payBackStep1(){
  state._payMarketId=null;
  document.getElementById('pay-step-1').style.display='block';
  document.getElementById('pay-step-2').style.display='none';
}
function setPayment(method){
  var v=state.vendors.find(x=>x.id===state._menuVendorId);
  var mid=state._payMarketId;
  if(!v||!mid)return;
  if(!v.marketPayments)v.marketPayments={};
  if(!v.marketMethods)v.marketMethods={};
  if(method==='outstanding'){
    v.marketPayments[mid]='outstanding';
    delete v.marketMethods[mid];
  } else {
    v.marketPayments[mid]='paid';
    v.marketMethods[mid]=method;
  }
  var ps=calcPayStatus(v);
  v.payStatus=ps;
  v.payMethod=ps==='paid'?method:(ps==='partial'?'partial':null);
  sbSave('vendors',vendorToDb(v));
  closeModal('pay-modal');
  renderApproved();
  updateMetrics();
}

// ── ADD / CREDIT / REMOVE ─────────────────────────────────────────
function onAddMarketChange(){var mid=document.getElementById('add-market-select').value;var info=document.getElementById('add-market-info');if(!mid){info.style.display='none';return;}var m=state.markets.find(x=>x.id===mid);var v=state.vendors.find(x=>x.id===state._menuVendorId);if(m&&v){var nf=m.fee||FEE;var existingTotal=v.markets.reduce((t,mid2)=>{var mx=state.markets.find(x=>x.id===mid2);return t+(mx?mx.fee||FEE:FEE);},0);info.style.display='block';info.textContent='Vendor will be added to "'+m.name+'" (R'+nf+'/stall). Total fee updates to R'+(existingTotal+nf).toLocaleString()+'.';};}
function confirmAddMarket(){var mid=document.getElementById('add-market-select').value;if(!mid){alert('Please select a market.');return;}var v=state.vendors.find(x=>x.id===state._menuVendorId);if(!v)return;if(!v.markets.includes(mid)){v.markets.push(mid);if(!v.marketPayments)v.marketPayments={};v.marketPayments[mid]='outstanding';}sbSave('vendors',vendorToDb(v));closeModal('add-market-modal');renderApproved();updateMetrics();}
function onCreditMarketChange(){var mid=document.getElementById('credit-market-select').value;var info=document.getElementById('credit-info');if(!mid){info.style.display='none';return;}var m=state.markets.find(x=>x.id===mid);var v=state.vendors.find(x=>x.id===state._menuVendorId);if(m&&v){info.style.display='block';info.textContent='Vendor will be moved to "'+m.name+'" and removed from all current markets. Payment status carries over.';};}
function confirmCredit(){var mid=document.getElementById('credit-market-select').value;if(!mid){alert('Please select a market.');return;}var v=state.vendors.find(x=>x.id===state._menuVendorId);if(!v)return;v.markets=[mid];v.marketPayments={};v.marketPayments[mid]=v.payStatus==='paid'?'paid':'outstanding';sbSave('vendors',vendorToDb(v));closeModal('credit-modal');renderApproved();updateMetrics();}
function confirmRemoveApproved(){sbDel('vendors',state._menuVendorId);state.vendors=state.vendors.filter(v=>v.id!==state._menuVendorId);closeModal('remove-approved-modal');renderApproved();updateMetrics();}

// ── MARKET DASHBOARD ──────────────────────────────────────────────
function openMarketDashboard(mid){
  var m=state.markets.find(x=>x.id===mid);if(!m)return;
  var approvedVendors=state.vendors.filter(v=>v.status==='approved'&&v.markets.includes(mid));
  var pendingVendors=state.vendors.filter(v=>v.status==='pending'&&v.markets.includes(mid));
  var paidVendors=approvedVendors.filter(v=>(v.marketPayments||{})[mid]==='paid');
  var fee=m.fee||FEE;
  var rev=approvedVendors.length*fee,revPaid=paidVendors.length*fee;
  var cap=m.capacity||30,capPct=Math.min(100,Math.round((approvedVendors.length/cap)*100));
  var capColor=capPct>=90?'red':capPct>=70?'amber':'green';
  var bi=m.banner?'<img src="'+m.banner+'">':esc(m.header||m.name);
  var html='<div class="market-card" style="margin-bottom:1.5rem"><div class="market-banner" style="height:140px">'+bi+'</div><div class="market-body"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><strong style="font-size:17px">'+esc(m.name)+'</strong>'+(m.published?'<span class="published-badge on"><span class="dot green"></span> Published</span>':'<span class="published-badge off"><span class="dot gray"></span> Draft</span>')+'</div><p style="font-size:13px;margin:6px 0 8px">'+esc(m.desc||'')+'</p><div class="date-chips">'+m.dates.map(d=>'<span class="date-chip">'+d+'</span>').join('')+'</div></div></div>';
  html+='<div class="metric-grid" style="margin-bottom:1.25rem"><div class="metric"><div class="metric-label">Vendors approved</div><div class="metric-value blue">'+approvedVendors.length+'</div></div><div class="metric"><div class="metric-label">Expected revenue</div><div class="metric-value green" style="font-size:16px">R'+rev.toLocaleString()+'</div></div><div class="metric"><div class="metric-label">Revenue collected</div><div class="metric-value" style="font-size:16px">R'+revPaid.toLocaleString()+'</div></div><div class="metric"><div class="metric-label">Waitlisted</div><div class="metric-value amber">'+pendingVendors.length+'</div></div></div>';
  html+='<div class="card" style="margin-bottom:1rem"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;font-weight:500;color:var(--text)">Stall capacity</span><span style="font-size:13px;color:var(--text2)">'+approvedVendors.length+' / '+cap+' stalls</span></div><div class="progress-wrap"><div class="progress-bar '+capColor+'" style="width:'+capPct+'%"></div></div><div style="font-size:11px;color:var(--text3);margin-top:6px">'+capPct+'% full &nbsp;·&nbsp; '+(cap-approvedVendors.length)+' stalls remaining</div></div>';
  html+='<div class="card" style="margin-bottom:1rem"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;font-weight:500;color:var(--text)">Payment status</span><span style="font-size:13px;color:var(--text2)">'+paidVendors.length+' paid / '+(approvedVendors.length-paidVendors.length)+' outstanding</span></div><div class="progress-wrap"><div class="progress-bar" style="width:'+(approvedVendors.length?Math.round((paidVendors.length/approvedVendors.length)*100):0)+'%"></div></div><div style="font-size:11px;color:var(--text3);margin-top:6px">R'+revPaid.toLocaleString()+' of R'+rev.toLocaleString()+' collected</div></div>';
  html+='<div class="card" style="margin-bottom:1rem"><h3 style="margin-bottom:1rem">Vendors attending</h3>';
  if(approvedVendors.length){
    html+='<table class="vendor-table desktop-table"><thead><tr><th>Stall name</th><th>Email</th><th>Fee</th><th>Payment</th><th></th></tr></thead><tbody>'+approvedVendors.map(v=>{var mp=(v.marketPayments||{})[mid];var pb=mp==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';return'<tr><td><strong>'+esc(v.name)+'</strong></td><td style="color:var(--text2)">'+esc(v.email)+'</td><td>R'+fee+'</td><td>'+pb+'</td><td><button onclick="removeFromMarket(\''+v.id+'\',\''+mid+'\')" style="background:none;border:0.5px solid var(--red);border-radius:6px;cursor:pointer;padding:4px 8px;font-size:12px;color:var(--red)">&#128465; Remove</button></td></tr>';}).join('')+'</tbody></table>'
      +'<div class="mobile-cards">'+approvedVendors.map(v=>{var mp=(v.marketPayments||{})[mid];var pb=mp==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';return'<div class="vendor-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><strong>'+esc(v.name)+'</strong>'+pb+'</div><div style="font-size:11px;color:var(--text2);margin-bottom:8px">'+esc(v.email)+'</div><button onclick="removeFromMarket(\''+v.id+'\',\''+mid+'\')" style="background:none;border:0.5px solid var(--red);border-radius:6px;cursor:pointer;padding:5px 10px;font-size:12px;color:var(--red)">&#128465; Remove</button></div>';}).join('')+'</div>';
  }else{html+='<div class="empty-state" style="padding:1.5rem">No vendors approved yet.</div>';}
  html+='</div>';
  html+='<div class="card" style="margin-bottom:1rem"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem"><h3 style="margin:0">Waitlist</h3><span style="font-size:12px;color:var(--text2)">'+pendingVendors.length+' vendor'+(pendingVendors.length!==1?'s':'')+' waiting</span></div>';
  if(pendingVendors.length){html+=pendingVendors.map(v=>'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:0.5px solid var(--border)"><div><div style="font-size:13px;font-weight:500;color:var(--text)">'+esc(v.name)+'</div><div style="font-size:11px;color:var(--text2)">'+esc(v.email)+' &middot; Applied '+v.submitted+'</div></div><button class="btn small success" onclick="quickApprove(\''+v.id+'\',\''+mid+'\')">Approve</button></div>').join('');}
  else{html+='<div class="empty-state" style="padding:1.5rem">No pending applications for this market.</div>';}
  html+='</div>';
  var notes=m.notes||'';
  html+='<div class="card" style="margin-bottom:1rem"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem"><h3 style="margin:0">Notes</h3><button class="btn small" onclick="openNotes(\''+mid+'\')">Edit notes</button></div>'+(notes?'<p style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap">'+esc(notes)+'</p>':'<p style="font-size:13px;color:var(--text3)">No notes yet. Click "Edit notes" to add reminders or logistics info.</p>')+'</div>';
  document.getElementById('mdb-content').innerHTML=html;
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-market-dash').classList.add('active');
  document.querySelectorAll('.nav-tab')[2].classList.add('active');
  document.querySelectorAll('.bottom-nav-item')[2].classList.add('active');
  window.scrollTo(0,0);
}
function removeFromMarket(vid,mid){var v=state.vendors.find(x=>x.id===vid);if(!v)return;v.markets=v.markets.filter(x=>x!==mid);if(v.marketPayments)delete v.marketPayments[mid];if(!v.markets.length){sbDel('vendors',vid);state.vendors=state.vendors.filter(x=>x.id!==vid);}else{sbSave('vendors',vendorToDb(v));}openMarketDashboard(mid);}
function quickApprove(vid,mid){var v=state.vendors.find(x=>x.id===vid);if(!v)return;var otherMarkets=v.markets.filter(x=>x!==mid);var existing=state.vendors.find(x=>x.id!==vid&&x.status==='approved'&&x.email===v.email);if(existing){if(!existing.markets.includes(mid))existing.markets.push(mid);if(!existing.marketPayments)existing.marketPayments={};existing.marketPayments[mid]='outstanding';sbSave('vendors',vendorToDb(existing));if(otherMarkets.length>0){v.markets=otherMarkets;sbSave('vendors',vendorToDb(v));}else{sbDel('vendors',v.id);state.vendors=state.vendors.filter(x=>x.id!==vid);}}else if(otherMarkets.length>0){var nv={id:uid(),name:v.name,desc:v.desc,email:v.email,markets:[mid],images:v.images,status:'approved',payStatus:'outstanding',payMethod:null,marketPayments:{[mid]:'outstanding'},submitted:v.submitted,approvedAt:new Date().toLocaleDateString('en-ZA'),feePerMarket:v.feePerMarket};state.vendors.push(nv);sbSave('vendors',vendorToDb(nv));v.markets=otherMarkets;sbSave('vendors',vendorToDb(v));}else{if(!v.markets.includes(mid))v.markets.push(mid);v.status='approved';v.payStatus='outstanding';v.payMethod=null;if(!v.marketPayments)v.marketPayments={};v.marketPayments[mid]='outstanding';v.approvedAt=new Date().toLocaleDateString('en-ZA');sbSave('vendors',vendorToDb(v));}state.approvedToday++;updateMetrics();openMarketDashboard(mid);}
function openNotes(mid){state.notesMarketId=mid;var m=state.markets.find(x=>x.id===mid);document.getElementById('notes-input').value=m?(m.notes||''):'';document.getElementById('notes-modal').classList.add('open');}
function saveNotes(){var m=state.markets.find(x=>x.id===state.notesMarketId);if(m){m.notes=document.getElementById('notes-input').value;sbSave('markets',marketToDb(m));}closeModal('notes-modal');openMarketDashboard(state.notesMarketId);}

// ── MARKETS LIST ──────────────────────────────────────────────────
function renderMarkets(){
  var el=document.getElementById('markets-list'),empty=document.getElementById('markets-empty');
  if(!state.markets.length){el.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  el.innerHTML=state.markets.map(m=>{
    var appr=state.vendors.filter(v=>v.status==='approved'&&v.markets.includes(m.id)).length;
    var cap=m.capacity||30,pct=Math.min(100,Math.round((appr/cap)*100));
    var dates=m.dates.map(d=>'<span class="date-chip">'+d+'</span>').join('');
    var pub=m.published?'<span class="published-badge on"><span class="dot green"></span> Published</span>':'<span class="published-badge off"><span class="dot gray"></span> Draft</span>';
    var bi=m.banner?'<img src="'+m.banner+'">':esc(m.header||m.name);
    return'<div class="market-card"><div class="market-banner">'+bi+'<span class="market-banner-fee">R'+(m.fee||FEE)+'/stall</span></div><div class="market-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px"><strong style="font-size:15px">'+esc(m.name)+'</strong>'+pub+'</div><p style="font-size:13px;margin-bottom:8px">'+esc(m.desc||'')+'</p><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;color:var(--text2)">Capacity</span><span style="font-size:12px;color:var(--text2)">'+appr+'/'+cap+' stalls</span></div><div class="progress-wrap"><div class="progress-bar '+(pct>=90?'red':pct>=70?'amber':'green')+'" style="width:'+pct+'%"></div></div><div class="date-chips" style="margin-top:10px">'+dates+'</div></div><div class="market-footer"><div class="btn-row"><button class="btn small primary" onclick="openMarketDashboard(\''+m.id+'\')">View dashboard</button><button class="btn small" onclick="duplicateMarket(\''+m.id+'\')">Duplicate</button><button class="btn small" onclick="openMarketModal(\''+m.id+'\')">Edit</button><button class="btn small '+(m.published?'danger':'success')+'" onclick="togglePublish(\''+m.id+'\')">'+(m.published?'Unpublish':'Publish')+'</button><button class="btn small danger" onclick="deleteMarket(\''+m.id+'\')">Delete</button></div><span style="font-size:11px;color:var(--text2)">'+m.dates.length+' date'+(m.dates.length!==1?'s':'')+'</span></div></div>';
  }).join('');
}
function duplicateMarket(id){var m=state.markets.find(x=>x.id===id);if(!m)return;var copy=Object.assign({},m,{id:uid(),name:m.name+' (copy)',published:false,notes:''});state.markets.push(copy);sbSave('markets',marketToDb(copy));renderMarkets();updateMetrics();}
function togglePublish(id){var m=state.markets.find(x=>x.id===id);if(m){m.published=!m.published;sbSave('markets',marketToDb(m));}renderMarkets();updateMetrics();}
function deleteMarket(id){sbDel('markets',id);state.markets=state.markets.filter(x=>x.id!==id);renderMarkets();updateMetrics();}
function renderPublicLinkBanner(){var slug=currentUser?currentUser.slug:'';var url=window.location.origin+'/public.html?slug='+slug;document.getElementById('public-link-banner').innerHTML='<div style="display:flex;align-items:flex-start;gap:10px"><div style="font-size:16px;flex-shrink:0">&#128279;</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:var(--teal);margin-bottom:3px">Your public vendor page</div><div style="font-size:12px;color:var(--teal-text);margin-bottom:10px;line-height:1.5">Share this link with vendors so they can browse your markets and apply.</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="background:var(--bg);border:0.5px solid var(--teal);border-radius:8px;padding:8px 12px;font-size:13px;font-family:monospace;color:var(--teal);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+url+'</div><button class="btn small" style="border-color:var(--teal);color:var(--teal);flex-shrink:0" onclick="copySlugLink(\''+url+'\')">Copy link</button></div></div></div>';}
function copySlugLink(url){navigator.clipboard.writeText(url).then(()=>alert('Link copied!')).catch(()=>alert('Your link:\n'+url));}
function handleBannerUpload(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){state._tempBanner=ev.target.result;document.getElementById('banner-preview').src=ev.target.result;document.getElementById('banner-preview').style.display='block';document.getElementById('banner-upload-prompt').style.display='none';document.getElementById('banner-remove-btn').style.display='inline-flex';};r.readAsDataURL(file);}
function removeBanner(){state._tempBanner=null;document.getElementById('banner-preview').style.display='none';document.getElementById('banner-preview').src='';document.getElementById('banner-upload-prompt').style.display='block';document.getElementById('banner-remove-btn').style.display='none';}
function openMarketModal(id){state.editMarketId=id;var m=id?state.markets.find(x=>x.id===id):null;document.getElementById('market-modal-title').textContent=m?'Edit market':'New market';document.getElementById('m-name').value=m?m.name:'';document.getElementById('m-desc').value=m?(m.desc||''):'';document.getElementById('m-header').value=m?(m.header||''):'';document.getElementById('m-fee').value=m?(m.fee||FEE):FEE;document.getElementById('m-capacity').value=m?(m.capacity||30):30;state._tempDates=m?[...m.dates]:[];state._tempBanner=m?(m.banner||null):null;var prev=document.getElementById('banner-preview'),prompt=document.getElementById('banner-upload-prompt'),rb=document.getElementById('banner-remove-btn');if(state._tempBanner){prev.src=state._tempBanner;prev.style.display='block';prompt.style.display='none';rb.style.display='inline-flex';}else{prev.src='';prev.style.display='none';prompt.style.display='block';rb.style.display='none';}renderDateList();document.getElementById('market-modal').classList.add('open');}
function addDate(){var val=document.getElementById('m-date-pick').value;if(!val)return;if(!state._tempDates.includes(val))state._tempDates.push(val);document.getElementById('m-date-pick').value='';renderDateList();}
function removeDate(d){state._tempDates=state._tempDates.filter(x=>x!==d);renderDateList();}
function renderDateList(){document.getElementById('m-date-list').innerHTML=state._tempDates.map(d=>'<span class="date-chip" style="cursor:pointer" onclick="removeDate(\''+d+'\')">'+d+' &#x2715;</span>').join('');}
function saveMarket(){var name=document.getElementById('m-name').value.trim();if(!name){alert('Market name is required.');return;}var m={id:state.editMarketId||uid(),name,desc:document.getElementById('m-desc').value.trim(),header:document.getElementById('m-header').value.trim(),fee:parseInt(document.getElementById('m-fee').value)||FEE,capacity:parseInt(document.getElementById('m-capacity').value)||30,dates:[...state._tempDates],banner:state._tempBanner||null,published:false,notes:''};if(state.editMarketId){var i=state.markets.findIndex(x=>x.id===state.editMarketId);m.published=state.markets[i].published;m.notes=state.markets[i].notes||'';state.markets[i]=m;}else state.markets.push(m);sbSave('markets',marketToDb(m));closeModal('market-modal');renderMarkets();updateMetrics();}

// ── PUBLIC / MARKET INDEX ─────────────────────────────────────────
function renderPublic(){renderPubMarkets();renderVendorFormMarkets();}
function renderPubMarkets(){var pub=state.markets.filter(m=>m.published);var el=document.getElementById('pub-markets-list'),empty=document.getElementById('pub-markets-empty');if(!pub.length){el.innerHTML='';empty.style.display='block';return;}empty.style.display='none';el.innerHTML=pub.map(m=>{var dates=m.dates.map(d=>'<span class="date-chip">'+d+'</span>').join('');var bi=m.banner?'<img src="'+m.banner+'">':esc(m.header||m.name);return'<div class="market-card" style="margin-bottom:1rem"><div class="market-banner">'+bi+'</div><div class="market-body"><strong style="font-size:15px">'+esc(m.name)+'</strong><p style="font-size:13px;margin:6px 0 8px">'+esc(m.desc||'')+'</p><div class="date-chips">'+dates+'</div></div><div class="market-footer"><span style="font-size:12px;color:var(--text2)">Stall fee: R'+(m.fee||FEE)+'/date</span><button class="btn small primary" onclick="pubTab(\'apply\')">Apply to attend</button></div></div>';}).join('');}
function renderVendorFormMarkets(){var pub=state.markets.filter(m=>m.published);var el=document.getElementById('v-market-checks'),noM=document.getElementById('v-no-markets');if(!pub.length){el.innerHTML='';noM.style.display='block';return;}noM.style.display='none';el.innerHTML=pub.map(m=>'<div class="market-select-card" onclick="toggleMktCheck(\''+m.id+'\',this)"><input type="checkbox" class="v-mkt-check" id="vc-'+m.id+'" value="'+m.id+'" onclick="event.stopPropagation();this.closest(\'.market-select-card\').classList.toggle(\'selected\',this.checked)"><div><div class="msc-name">'+esc(m.name)+'</div><div class="msc-dates">'+(m.dates.join(' · ')||'Dates TBC')+'</div><div class="msc-fee">Stall fee: R'+(m.fee||FEE)+'/date</div></div></div>').join('');}
function toggleMktCheck(id,card){var cb=document.getElementById('vc-'+id);cb.checked=!cb.checked;card.classList.toggle('selected',cb.checked);}
function handleVendorImages(e){var files=Array.from(e.target.files).slice(0,4-_vendorImages.length);files.forEach(file=>{if(_vendorImages.length>=4)return;var r=new FileReader();r.onload=function(ev){_vendorImages.push(ev.target.result);renderVendorThumbs();};r.readAsDataURL(file);});}
function removeVendorImg(i){_vendorImages.splice(i,1);renderVendorThumbs();}
function renderVendorThumbs(){document.getElementById('vendor-img-thumbs').innerHTML=_vendorImages.map((src,i)=>'<div class="img-thumb"><img src="'+src+'"><button class="img-thumb-remove" onclick="removeVendorImg('+i+')">&#x2715;</button></div>').join('');}
function submitVendorForm(){
  var name=document.getElementById('v-name').value.trim();
  var desc=document.getElementById('v-desc').value.trim();
  var email=document.getElementById('v-email').value.trim();
  var markets=Array.from(document.querySelectorAll('.v-mkt-check:checked')).map(c=>c.value);
  if(!name||!desc||!email){alert('Please fill in all required fields.');return;}
  if(!markets.length){alert('Please select at least one market.');return;}
  if(!email.includes('@')){alert('Please enter a valid email address.');return;}
  var mnames=markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?m.name:mid;}).join(', ');
  var nv={id:uid(),name,desc,email,markets:markets.slice(),images:[..._vendorImages],status:'pending',payStatus:'outstanding',payMethod:null,marketPayments:{},submitted:new Date().toLocaleDateString('en-ZA'),feePerMarket:FEE};
  state.vendors.push(nv);
  sbSave('vendors',vendorToDb(nv));
  if(currentUser){sendEmail(currentUser.email,'New vendor application — '+name,'<p>A new vendor application has been submitted.</p><p><strong>Stall name:</strong> '+esc(name)+'<br><strong>Email:</strong> '+esc(email)+'<br><strong>Markets:</strong> '+esc(mnames)+'<br><strong>Description:</strong> '+esc(desc)+'</p><p>Log in to your dashboard to review and approve.</p>');}
  document.getElementById('v-name').value='';document.getElementById('v-desc').value='';document.getElementById('v-email').value='';
  _vendorImages=[];renderVendorThumbs();
  document.querySelectorAll('.v-mkt-check').forEach(c=>{c.checked=false;c.closest('.market-select-card').classList.remove('selected');});
  var s=document.getElementById('v-success');s.style.display='block';setTimeout(()=>s.style.display='none',4000);
  updateMetrics();
}

function exportCSV(type){var list=type==='pending'?state.vendors.filter(v=>v.status==='pending'):state.vendors.filter(v=>v.status==='approved');if(!list.length){alert('No vendors to export.');return;}var headers=type==='pending'?['Name','Email','Description','Markets','Submitted']:['Name','Email','Markets','Stall Fee (R)','Payment Status','Payment Method','Approved'];var rows=list.map(v=>{var mnames=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?m.name:'?';}).join('; ');var fee=v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+(m?m.fee||FEE:FEE);},0);return type==='pending'?[v.name,v.email,v.desc,mnames,v.submitted]:[v.name,v.email,mnames,fee,v.payStatus||'outstanding',v.payMethod||'',v.approvedAt||''];});var csv=[headers,...rows].map(r=>r.map(c=>'"'+(c||'').toString().replace(/"/g,'""')+'"').join(',')).join('\n');var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=type+'-vendors.csv';a.click();}
