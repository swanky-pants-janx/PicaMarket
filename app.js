// Capture recovery state before Supabase clears the URL hash
var _isRecovery = window.location.hash.includes('type=recovery');

// ── SUPABASE ──────────────────────────────────────────────────────
var _sb = window.supabase.createClient(
  'https://bjzckhanxudkyrpczqbs.supabase.co',
  'sb_publishable_f64M7MFa88zOMuZ083v-lw_Ypgcyhx-'
);

// ── EMAIL ─────────────────────────────────────────────────────────
async function sendEmail(to,subject,html){if(!currentUser||!currentUser.id){console.error('Email error: no user');return;}var{data:{session}}=await _sb.auth.getSession();if(!session){console.error('Email error: no session');return;}fetch('https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/resend-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({to,subject,html})}).catch(err=>console.error('Email error:',err));}

// ── PAYFAST ───────────────────────────────────────────────────────
var PF_FIELD_ORDER=['merchant_id','merchant_key','return_url','cancel_url','notify_url','name_first','name_last','email_address','cell_number','m_payment_id','amount','item_name','item_description','custom_str1','custom_str2','custom_str3','custom_str4','custom_str5','email_confirmation','confirmation_address','currency','payment_method'];
function pfEncode(s){return encodeURIComponent(String(s).trim()).replace(/%20/g,'+').replace(/!/g,'%21').replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\*/g,'%2A').replace(/~/g,'%7E');}
function pfSignature(data,passphrase){var parts=PF_FIELD_ORDER.filter(k=>data[k]!==undefined&&data[k]!==null&&data[k]!=='').map(k=>k+'='+pfEncode(data[k]));if(passphrase)parts.push('passphrase='+pfEncode(passphrase));return md5(parts.join('&'));}
function pfUrl(vendor,market){
  var mid=currentUser.payfastMerchantId,mkey=currentUser.payfastMerchantKey;
  if(!mid||!mkey)return null;
  var nameParts=vendor.name.split(' ');
  var data={merchant_id:mid,merchant_key:mkey,return_url:'https://picamarket.site/',cancel_url:'https://picamarket.site/',notify_url:'https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/payfast-itn',name_first:nameParts[0],name_last:nameParts.slice(1).join(' ')||'-',email_address:vendor.email,m_payment_id:vendor.id+':'+market.id,amount:getStallFee(vendor,market).toFixed(2),item_name:(market.name+' '+stallTypeLabel(vendor,market)).substring(0,100)};
  data.signature=pfSignature(data,currentUser.payfastPassphrase||null);
  var q=new URLSearchParams();
  PF_FIELD_ORDER.forEach(k=>{if(data[k]!==undefined&&data[k]!==null&&data[k]!=='')q.set(k,data[k]);});
  q.set('signature',data.signature);
  return(currentUser.payfastSandbox?'https://sandbox.payfast.co.za/eng/process':'https://www.payfast.co.za/eng/process')+'?'+q.toString();
}
async function openPaymentSettings(){showPage('settings');showSettingsSec('payment');}
async function savePaymentSettings(){
  var mid=document.getElementById('pf-merchant-id').value.trim();
  var mkey=document.getElementById('pf-merchant-key').value.trim();
  var passphrase=document.getElementById('pf-passphrase').value.trim();
  var sandbox=document.getElementById('pf-sandbox').checked;
  var bankHolder=document.getElementById('bank-holder').value.trim();
  var bankName=document.getElementById('bank-name').value.trim();
  var bankAccNum=document.getElementById('bank-acc-num').value.trim();
  var bankBranch=document.getElementById('bank-branch').value.trim();
  var bankAccType=document.getElementById('bank-acc-type').value;
  var btn=document.getElementById('pf-save-btn');
  btn.textContent='Saving...';btn.disabled=true;
  var{error}=await _sb.from('profiles').update({payfast_merchant_id:mid,payfast_merchant_key:mkey,payfast_passphrase:passphrase||null,payfast_sandbox:sandbox,bank_holder:bankHolder,bank_name:bankName,bank_acc_num:bankAccNum,bank_branch:bankBranch,bank_acc_type:bankAccType}).eq('id',currentUser.id);
  btn.textContent='Save';btn.disabled=false;
  if(error){alert('Failed to save. Try again.');return;}
  currentUser.payfastMerchantId=mid||null;currentUser.payfastMerchantKey=mkey||null;currentUser.payfastPassphrase=passphrase||null;currentUser.payfastSandbox=sandbox;
  currentUser.bankHolder=bankHolder||null;currentUser.bankName=bankName||null;
  currentUser.bankAccNum=bankAccNum||null;currentUser.bankBranch=bankBranch||null;currentUser.bankAccType=bankAccType||null;
  closeModal('payment-settings-modal');
}

// ── HELPERS ──────────────────────────────────────────────────────
var darkMode=false;
function saveUserSettings(){if(!currentUser)return;_sb.from('profiles').update({settings:{dark_mode:darkMode,hide_hints:state.hideHints,hide_calendar:state.hideCalendar,approval_email_intro:currentUser.emailApprovalIntro||null,reminder_email_intro:currentUser.emailReminderIntro||null,blocked_emails:currentUser.blockedEmails||[],form_fields:currentUser.formFields||DEFAULT_FORM_FIELDS,notify_on_apply:currentUser.notifyOnApply!==false}}).eq('id',currentUser.id).then(({error})=>{if(error)console.error('Settings save error:',error);});}
function openBlockedVendors(){showPage('settings');showSettingsSec('blocked');}
function renderBlockedList(){var list=currentUser.blockedEmails||[];var el=document.getElementById('blocked-list');el.innerHTML=list.length?list.map(e=>'<div class="blocked-row"><span>'+esc(e)+'</span><button data-email="'+esc(e)+'" title="Remove">&times;</button></div>').join(''):'<div style="font-size:13px;color:var(--text3);padding:8px 0">No blocked emails yet.</div>';el.querySelectorAll('button[data-email]').forEach(function(btn){btn.onclick=function(){removeBlockedEmail(btn.dataset.email);};});}
function addBlockedEmail(){var inp=document.getElementById('blocked-email-input');var email=inp.value.trim().toLowerCase();if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showToast('Enter a valid email');return;}if((currentUser.blockedEmails||[]).includes(email)){showToast('Already blocked');return;}currentUser.blockedEmails=[...(currentUser.blockedEmails||[]),email];inp.value='';saveUserSettings();renderBlockedList();showToast(email+' blocked');}
function removeBlockedEmail(email){currentUser.blockedEmails=(currentUser.blockedEmails||[]).filter(e=>e!==email);saveUserSettings();renderBlockedList();showToast('Removed');}
function openEmailTemplates(){showPage('settings');showSettingsSec('email');}
async function saveEmailTemplates(){var approval=document.getElementById('et-approval').value.trim();var reminder=document.getElementById('et-reminder').value.trim();var btn=document.getElementById('et-save-btn');btn.textContent='Saving...';btn.disabled=true;currentUser.emailApprovalIntro=approval||null;currentUser.emailReminderIntro=reminder||null;saveUserSettings();btn.textContent='Save';btn.disabled=false;closeModal('email-templates-modal');showToast('Email templates saved');}
function toggleDark(){darkMode=!darkMode;document.body.classList.toggle('dark',darkMode);syncSettingsMenu();saveUserSettings();}
function openSettingsMenu(e){if(e)e.stopPropagation();showPage('settings');}
function closeSettingsMenu(){document.getElementById('settings-overlay').classList.remove('open');}
function syncSettingsMenu(){var dv=document.getElementById('sm-dark-val');if(dv){dv.textContent=darkMode?'On':'Off';dv.className=darkMode?'sm-badge':'sm-badge off';}var hv=document.getElementById('sm-hints-val');if(hv){hv.textContent=state.hideHints?'Hidden':'Shown';hv.className=state.hideHints?'sm-badge off':'sm-badge';}var sdv=document.getElementById('sp-dark-val');if(sdv)sdv.checked=darkMode;var shv=document.getElementById('sp-hints-val');if(shv)shv.checked=!state.hideHints;var scv=document.getElementById('sp-cal-val');if(scv)scv.checked=!state.hideCalendar;if(currentUser){var an=document.getElementById('acc-name');if(an)an.value=currentUser.name||'';var am=document.getElementById('acc-market');if(am)am.value=currentUser.market||'';var ae=document.getElementById('acc-email');if(ae)ae.value=currentUser.email||'';var nv=document.getElementById('acc-notify-val');if(nv)nv.checked=currentUser.notifyOnApply!==false;var apv=document.getElementById('acc-public-val');if(apv)apv.checked=!!currentUser.isPublic;var adesc=document.getElementById('acc-desc');if(adesc)adesc.value=currentUser.description||'';var pm=document.getElementById('pf-merchant-id');if(pm)pm.value=currentUser.payfastMerchantId||'';var pk=document.getElementById('pf-merchant-key');if(pk)pk.value=currentUser.payfastMerchantKey||'';var pp=document.getElementById('pf-passphrase');if(pp)pp.value=currentUser.payfastPassphrase||'';var psb=document.getElementById('pf-sandbox');if(psb)psb.checked=!!currentUser.payfastSandbox;var bh=document.getElementById('bank-holder');if(bh)bh.value=currentUser.bankHolder||'';var bn2=document.getElementById('bank-name');if(bn2)bn2.value=currentUser.bankName||'';var ba=document.getElementById('bank-acc-num');if(ba)ba.value=currentUser.bankAccNum||'';var bb=document.getElementById('bank-branch');if(bb)bb.value=currentUser.bankBranch||'';var bt=document.getElementById('bank-acc-type');if(bt)bt.value=currentUser.bankAccType||'';var ea=document.getElementById('et-approval');if(ea)ea.value=currentUser.emailApprovalIntro||'';var er=document.getElementById('et-reminder');if(er)er.value=currentUser.emailReminderIntro||'';renderBlockedList();}}
function showSettingsSec(sec){document.querySelectorAll('.settings-sec').forEach(el=>el.classList.remove('active'));document.querySelectorAll('.settings-nav-item').forEach(el=>el.classList.remove('active'));var el=document.getElementById('ssec-'+sec);if(el)el.classList.add('active');var nav=document.getElementById('snav-'+sec);if(nav)nav.classList.add('active');if(sec==='form-builder')renderFormBuilder();if(sec==='history')renderHistory();}
function toggleHints(){state.hideHints=!state.hideHints;document.querySelectorAll('.page-banner').forEach(el=>el.style.display=state.hideHints?'none':'');syncSettingsMenu();saveUserSettings();}
function toggleCalendar(){state.hideCalendar=!state.hideCalendar;var el=document.getElementById('home-calendar');if(el)el.style.display=state.hideCalendar?'none':'';syncSettingsMenu();saveUserSettings();}
function showToast(msg){var t=document.getElementById('toast');t.textContent=msg;var bar=document.createElement('div');bar.className='toast-bar';t.appendChild(bar);t.classList.add('show');setTimeout(()=>{t.classList.remove('show');},2500);}
function updateBellBadge(count){document.querySelectorAll('.nav-bell-badge').forEach(function(el){el.style.display=count>0?'flex':'none';el.textContent=count>9?'9+':String(count);});}
function clearNotifications(){_notifCount=0;updateBellBadge(0);}
function startVendorWatch(){if(_realtimeChannel){_sb.removeChannel(_realtimeChannel);_realtimeChannel=null;}_notifCount=0;updateBellBadge(0);_newVendorIds=new Set();_realtimeChannel=_sb.channel('vendor-watch-'+currentUser.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'vendors',filter:'user_id=eq.'+currentUser.id},function(payload){var newVendor=dbToVendor(payload.new);if(!state.vendors.find(function(v){return v.id===newVendor.id;}))state.vendors.push(newVendor);_newVendorIds.add(newVendor.id);var onApproval=document.getElementById('page-approval').classList.contains('active');if(onApproval){renderPending();updateMetrics();showToast('New application: '+(newVendor.name||'Vendor'));}else{_notifCount++;_notifDest='approval';updateBellBadge(_notifCount);setPageDot('approval',true);showToast('New vendor application!');}}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'vendors',filter:'user_id=eq.'+currentUser.id},function(payload){var updated=dbToVendor(payload.new);var idx=state.vendors.findIndex(function(v){return v.id===updated.id;});if(idx>=0){var prev=state.vendors[idx];state.vendors[idx]=updated;if(updated.payStatus==='paid'&&prev.payStatus!=='paid'){var onApproved=document.getElementById('page-approved').classList.contains('active');if(onApproved){showToast('Payment received — '+updated.name);}else{_notifCount++;_notifDest='approved';updateBellBadge(_notifCount);setPageDot('approved',true);showToast('Payment received — '+updated.name);}}}else{state.vendors.push(updated);}updateMetrics();var onApproved2=document.getElementById('page-approved').classList.contains('active');if(onApproved2)renderApproved();}).subscribe();}

// ── LIGHTBOX ──────────────────────────────────────────────────────
var _lbImages=[],_lbIdx=0;
function openLightbox(vendorId,idx){var v=state.vendors.find(x=>x.id===vendorId);if(!v||!v.images||!v.images.length)return;_lbImages=v.images;_lbIdx=idx||0;_renderLightbox();document.getElementById('lightbox').classList.add('open');}
function closeLightbox(){document.getElementById('lightbox').classList.remove('open');_lbImages=[];_lbIdx=0;}
function lightboxNav(dir){_lbIdx=(_lbIdx+dir+_lbImages.length)%_lbImages.length;_renderLightbox();}
function _renderLightbox(){document.getElementById('lightbox-img').src=_lbImages[_lbIdx];var c=document.getElementById('lightbox-counter');c.textContent=_lbImages.length>1?(_lbIdx+1)+' / '+_lbImages.length:'';var hasMany=_lbImages.length>1;document.querySelector('.lb-prev').style.display=hasMany?'flex':'none';document.querySelector('.lb-next').style.display=hasMany?'flex':'none';}
document.addEventListener('keydown',function(e){var lb=document.getElementById('lightbox');if(!lb||!lb.classList.contains('open'))return;if(e.key==='ArrowRight')lightboxNav(1);else if(e.key==='ArrowLeft')lightboxNav(-1);else if(e.key==='Escape')closeLightbox();});
// ── FORM BUILDER ─────────────────────────────────────────────────
var _editingFieldId=null,_editingOptions=[];
var FB_TYPE_LABELS={text:'Short text',textarea:'Long text',email:'Email',photos:'Photos',radio:'Single choice',checkbox:'Multi-choice',select:'Dropdown'};
function renderFormBuilder(){
  var fields=currentUser.formFields||DEFAULT_FORM_FIELDS;
  var container=document.getElementById('fb-fields-container');
  container.innerHTML='<div class="card" style="padding:0;overflow:hidden">'+
    fields.map(function(f,i){
      var opts=f.options&&f.options.length?'<div style="font-size:11px;color:var(--text3);margin-top:3px">'+f.options.map(esc).join(' · ')+'</div>':'';
      var lockBadge=f.builtin?'<span class="fb-type-badge" style="background:var(--bg2)">Built-in</span>':'';
      var actions=f.builtin
        ?'<div class="fb-field-actions"><button class="btn small" onclick="moveField(\''+f.id+'\',-1)" '+(i===0?'disabled':'')+' title="Move up">↑</button><button class="btn small" onclick="moveField(\''+f.id+'\',1)" '+(i===fields.length-1?'disabled':'')+' title="Move down">↓</button></div>'
        :'<div class="fb-field-actions"><button class="btn small" onclick="moveField(\''+f.id+'\',-1)" '+(i===0?'disabled':'')+'>↑</button><button class="btn small" onclick="moveField(\''+f.id+'\',1)" '+(i===fields.length-1?'disabled':'')+'>↓</button><button class="btn small" onclick="openEditField(\''+f.id+'\')">Edit</button><button class="btn small" style="color:var(--red)" onclick="deleteField(\''+f.id+'\')">Delete</button></div>';
      return'<div class="fb-field-card"><div class="fb-field-left"><span class="fb-type-badge">'+esc(FB_TYPE_LABELS[f.type]||f.type)+'</span>'+lockBadge+'<div><div class="fb-field-label">'+esc(f.label)+'</div>'+opts+'</div>'+(f.required?'<span class="badge" style="background:var(--red-bg);color:var(--red);font-size:10px;flex-shrink:0">Required</span>':'')+'</div>'+actions+'</div>';
    }).join('')+
    '<div class="fb-field-card" style="opacity:0.45;pointer-events:none"><div class="fb-field-left"><span class="fb-type-badge">Auto</span><span class="fb-type-badge" style="background:var(--bg2)">Built-in</span><div><div class="fb-field-label">Select markets to attend</div><div style="font-size:11px;color:var(--text3);margin-top:3px">Always shown last — generated from your Markets page</div></div></div></div>'+
  '</div>';
}
function openAddField(){_editingFieldId=null;_editingOptions=[];document.getElementById('field-modal-title').textContent='Add field';document.getElementById('field-type').value='text';document.getElementById('field-label').value='';document.getElementById('field-required').checked=false;document.getElementById('field-options-list').innerHTML='';document.getElementById('field-option-input').value='';syncFieldModal();document.getElementById('field-modal').classList.add('open');}
function openEditField(id){var f=(currentUser.formFields||DEFAULT_FORM_FIELDS).find(x=>x.id===id);if(!f||f.builtin)return;_editingFieldId=id;_editingOptions=(f.options||[]).slice();document.getElementById('field-modal-title').textContent='Edit field';document.getElementById('field-type').value=f.type;document.getElementById('field-label').value=f.label;document.getElementById('field-required').checked=!!f.required;syncFieldModal();document.getElementById('field-modal').classList.add('open');}
function syncFieldModal(){var type=document.getElementById('field-type').value;var hasOpts=['radio','checkbox','select'].includes(type);document.getElementById('field-options-section').style.display=hasOpts?'block':'none';if(hasOpts)_renderFieldOptions();}
function _renderFieldOptions(){document.getElementById('field-options-list').innerHTML=_editingOptions.map(function(opt,i){return'<div class="fb-option-row"><span>'+esc(opt)+'</span><button onclick="removeFieldOption('+i+')">&times;</button></div>';}).join('');}
function addFieldOption(){var inp=document.getElementById('field-option-input');var val=inp.value.trim();if(!val)return;if(_editingOptions.includes(val)){showToast('Option already added');return;}_editingOptions.push(val);inp.value='';_renderFieldOptions();}
function removeFieldOption(i){_editingOptions.splice(i,1);_renderFieldOptions();}
function saveField(){var type=document.getElementById('field-type').value;var label=document.getElementById('field-label').value.trim();var required=document.getElementById('field-required').checked;var hasOpts=['radio','checkbox','select'].includes(type);if(!label){showToast('Enter a question or label');return;}if(hasOpts&&!_editingOptions.length){showToast('Add at least one option');return;}var fields=(currentUser.formFields||DEFAULT_FORM_FIELDS).slice();var fieldObj={id:_editingFieldId||uid(),type,label,required};if(hasOpts)fieldObj.options=_editingOptions.slice();if(_editingFieldId){var idx=fields.findIndex(x=>x.id===_editingFieldId);if(idx!==-1)fields[idx]=fieldObj;}else{fields.push(fieldObj);}currentUser.formFields=fields;saveUserSettings();closeModal('field-modal');renderFormBuilder();_updateDashboardFormPreview();showToast(_editingFieldId?'Field updated':'Field added');}
function deleteField(id){if(!confirm('Delete this field? Existing vendor responses will no longer be shown.'))return;currentUser.formFields=(currentUser.formFields||DEFAULT_FORM_FIELDS).filter(x=>x.id!==id);saveUserSettings();renderFormBuilder();_updateDashboardFormPreview();showToast('Field deleted');}
function moveField(id,dir){var fields=(currentUser.formFields||DEFAULT_FORM_FIELDS).slice();var idx=fields.findIndex(x=>x.id===id);var newIdx=idx+dir;if(newIdx<0||newIdx>=fields.length)return;var tmp=fields[idx];fields[idx]=fields[newIdx];fields[newIdx]=tmp;currentUser.formFields=fields;saveUserSettings();renderFormBuilder();_updateDashboardFormPreview();}
function _updateDashboardFormPreview(){var container=document.getElementById('dashboard-form-fields');if(!container)return;_renderFormFieldsInto(container,currentUser.formFields||DEFAULT_FORM_FIELDS,true);}
function _renderFormFieldsInto(container,fields,preview){
  container.innerHTML=fields.map(function(f){
    var reqMark=f.required?' *':'';var input='';
    if(f.builtin){
      if(f.id==='builtin-name')input='<input class="form-input" id="v-name" type="text" placeholder="e.g. Sunshine Bakes"'+(preview?'':'')+' >';
      else if(f.id==='builtin-desc')input='<textarea class="form-input" id="v-desc" placeholder="Tell us about your stall..."></textarea>';
      else if(f.id==='builtin-email')input='<input class="form-input" id="v-email" type="email" placeholder="you@example.com">';
      else if(f.id==='builtin-photos')input='<div class="upload-box"><input type="file" accept="image/*" multiple onchange="handleVendorImages(event)"><div>&#8679; Tap to add photos (max 4)</div></div><div id="vendor-img-thumbs" class="img-thumb-grid"></div>';
    }else if(preview){
      if(f.type==='text')input='<input class="form-input" disabled placeholder="Vendor\'s answer">';
      else if(f.type==='textarea')input='<textarea class="form-input" disabled rows="3" placeholder="Vendor\'s answer"></textarea>';
      else if(f.type==='select')input='<select class="form-input" disabled><option>Select...</option>'+(f.options||[]).map(o=>'<option>'+esc(o)+'</option>').join('')+'</select>';
      else if(f.type==='radio')input=(f.options||[]).map(o=>'<label style="display:flex;align-items:center;gap:8px;margin:4px 0"><input type="radio" disabled> '+esc(o)+'</label>').join('');
      else if(f.type==='checkbox')input=(f.options||[]).map(o=>'<label style="display:flex;align-items:center;gap:8px;margin:4px 0"><input type="checkbox" disabled> '+esc(o)+'</label>').join('');
    }
    return'<div class="form-group"><label class="form-label">'+esc(f.label)+reqMark+'</label>'+input+'</div>';
  }).join('');
}

function copyVendorLink(){var url=window.location.origin+'/public.html?slug='+currentUser.slug;navigator.clipboard.writeText(url).then(()=>showToast('Vendor page link copied!')).catch(()=>alert('Your link:\n'+url));closeSettingsMenu();}
async function openAccountSettings(){showPage('settings');showSettingsSec('account');}
function toggleAccNotify(){currentUser.notifyOnApply=!(currentUser.notifyOnApply!==false);var el=document.getElementById('acc-notify-val');if(el)el.checked=currentUser.notifyOnApply;}
function toggleAccPublic(){currentUser.isPublic=!currentUser.isPublic;var el=document.getElementById('acc-public-val');if(el)el.checked=currentUser.isPublic;}
function checkDeleteConfirm(){var inp=document.getElementById('delete-account-confirm-input');var btn=document.getElementById('delete-account-confirm-btn');if(!inp||!btn)return;btn.disabled=inp.value.trim()!==currentUser.market;}
async function confirmDeleteAccount(){var btn=document.getElementById('delete-account-confirm-btn');btn.textContent='Deleting...';btn.disabled=true;var{data:{session}}=await _sb.auth.getSession();var res=await fetch('https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/delete-account',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token}});if(!res.ok){showToast('Delete failed. Please try again.');btn.textContent='Delete account';btn.disabled=false;return;}await _sb.auth.signOut();window.location.href='index.html';}

async function saveAccountSettings(){var name=document.getElementById('acc-name').value.trim();if(!name){alert('Name cannot be empty.');return;}var isPublic=document.getElementById('acc-public-val')?document.getElementById('acc-public-val').checked:false;var desc=document.getElementById('acc-desc')?document.getElementById('acc-desc').value.trim():'';if(desc==='meet_your_maker_1'){var descEl=document.getElementById('acc-desc');if(descEl)descEl.value='';runStressTest();return;}
  if(desc==='meet_your_maker_0'){var descEl2=document.getElementById('acc-desc');if(descEl2)descEl2.value='';purgeStressTestData();return;}var btn=document.getElementById('acc-save-btn');btn.textContent='Saving...';btn.disabled=true;var{error}=await _sb.from('profiles').update({coordinator_name:name,is_public:isPublic,description:desc||null}).eq('id',currentUser.id);btn.textContent='Save';btn.disabled=false;if(error){alert('Failed to save. Try again.');return;}currentUser.name=name;currentUser.isPublic=isPublic;currentUser.description=desc;document.getElementById('nav-user').textContent=name;var nv=document.getElementById('acc-notify-val');if(nv)currentUser.notifyOnApply=nv.checked;saveUserSettings();closeModal('account-modal');showToast('Account settings saved!');}
async function runStressTest(){
  function rnd(arr){return arr[Math.floor(Math.random()*arr.length)];}
  function rndInt(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
  function futureDate(days){var d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
  function pastDate(days){var d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10);}
  showToast('Stress test starting...');
  var marketDefs=[
    {name:'Spring Craft Fair',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:350,color:'#6b7280'}]},
    {name:'Sunday Food Market',stallTypes:[{id:'food',name:'Food vendor',fee:450,color:'#ea580c'},{id:'craft',name:'Craft stall',fee:300,color:'#7c3aed'}]},
    {name:'Artisan Weekend Market',stallTypes:[{id:'small',name:'Small (2m)',fee:200,color:'#2563eb'},{id:'large',name:'Large (4m)',fee:400,color:'#16a34a'}]},
    {name:'Organic Farmers Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:300,color:'#6b7280'}]},
    {name:'Night Market',stallTypes:[{id:'standard',name:'Standard',fee:400,color:'#4f46e5'},{id:'premium',name:'Premium corner',fee:650,color:'#ca8a04'}]},
    {name:'Heritage Street Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:350,color:'#6b7280'}]},
    {name:'Pop-Up Fashion Fair',stallTypes:[{id:'rack',name:'Clothing rack',fee:250,color:'#db2777'},{id:'booth',name:'Full booth',fee:500,color:'#7c3aed'}]},
    {name:'Community Flea Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:150,color:'#6b7280'}]},
    {name:'Garden Market',stallTypes:[{id:'small',name:'Small plot',fee:200,color:'#16a34a'},{id:'large',name:'Large plot',fee:380,color:'#0d9488'}]},
    {name:'Creative Makers Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:320,color:'#6b7280'},{id:'premium',name:'Premium spot',fee:550,color:'#ca8a04'}]},
    {name:'Makers & Bakers Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:300,color:'#6b7280'}]},
    {name:'Vintage & Retro Fair',stallTypes:[{id:'small',name:'Small table',fee:180,color:'#db2777'},{id:'large',name:'Full stall',fee:360,color:'#7c3aed'}]},
    {name:'Seaside Craft Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:400,color:'#0d9488'}]},
    {name:'Urban Street Food Festival',stallTypes:[{id:'food',name:'Food stall',fee:500,color:'#ea580c'},{id:'bev',name:'Beverage stall',fee:420,color:'#2563eb'}]},
    {name:'Eco & Sustainable Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:280,color:'#16a34a'}]},
    {name:'Holiday Gift Market',stallTypes:[{id:'small',name:'Small (2m)',fee:250,color:'#ca8a04'},{id:'large',name:'Large (4m)',fee:480,color:'#dc2626'}]},
    {name:'Weekend Wellness Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:350,color:'#0d9488'},{id:'premium',name:'Premium corner',fee:600,color:'#7c3aed'}]},
    {name:'Kids & Family Fair',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:200,color:'#6b7280'}]},
    {name:'Coastal Artisan Market',stallTypes:[{id:'small',name:'Small stall',fee:300,color:'#2563eb'},{id:'large',name:'Large stall',fee:550,color:'#0d9488'}]},
    {name:'Township Arts Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:180,color:'#6b7280'}]},
    {name:'Tech & Innovation Fair',stallTypes:[{id:'table',name:'Demo table',fee:450,color:'#4f46e5'},{id:'booth',name:'Full booth',fee:800,color:'#2563eb'}]},
    {name:'Harvest Festival Market',stallTypes:[{id:'produce',name:'Produce stall',fee:250,color:'#16a34a'},{id:'craft',name:'Craft stall',fee:320,color:'#ca8a04'}]},
    {name:'Indie Music & Craft Fair',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:300,color:'#db2777'}]},
    {name:'Morning Brew Market',stallTypes:[{id:'small',name:'Small stall',fee:220,color:'#ca8a04'},{id:'large',name:'Large stall',fee:420,color:'#ea580c'}]},
    {name:'Sunset Night Bazaar',stallTypes:[{id:'standard',name:'Standard',fee:380,color:'#4f46e5'},{id:'premium',name:'Premium',fee:680,color:'#dc2626'}]},
    {name:'Handmade & Homegrown',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:260,color:'#16a34a'}]},
    {name:'Pet & Animal Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:220,color:'#0d9488'}]},
    {name:'Cultural Fusion Market',stallTypes:[{id:'small',name:'Small (2m)',fee:200,color:'#db2777'},{id:'large',name:'Large (4m)',fee:380,color:'#ea580c'}]},
    {name:'Mountain Makers Market',stallTypes:[{id:'normal-stall',name:'Normal stall',fee:310,color:'#6b7280'},{id:'premium',name:'Premium spot',fee:560,color:'#ca8a04'}]},
    {name:'Waterfront Weekend Market',stallTypes:[{id:'food',name:'Food vendor',fee:480,color:'#ea580c'},{id:'craft',name:'Craft stall',fee:340,color:'#7c3aed'},{id:'premium',name:'Waterfront corner',fee:700,color:'#2563eb'}]}
  ];
  var markets=marketDefs.map(function(def,i){
    var isFuture=i<22;
    return{id:uid(),user_id:currentUser.id,name:def.name,description:'A wonderful '+def.name.toLowerCase()+' featuring local vendors and artisans.',header:'',fee:def.stallTypes[0].fee,stall_types:def.stallTypes,capacity:rndInt(15,80),dates:isFuture?[futureDate(rndInt(7,90)),futureDate(rndInt(91,180))]:[pastDate(rndInt(7,90))],deadline:isFuture?futureDate(rndInt(3,14)):null,start_time:'08:00',end_time:'14:00',banner:null,published:i<26,notes:''};
  });
  var{error:mErr}=await _sb.from('markets').insert(markets);
  if(mErr){showToast('Market insert failed: '+mErr.message);return;}
  showToast('30 markets created! Generating vendors...');
  var pubMarkets=markets.filter(function(m){return m.published;});
  var firstNames=['Amara','Sarah','Thabo','Lisa','Sipho','Maria','James','Nomsa','David','Fatima','Peter','Zanele','Michael','Priya','Lerato','Emma','Kofi','Nadia','Chris','Yemi','Aisha','Brendan','Cleo','Deon','Elena','Farai','Grace','Hendrik','Ivy','Johan','Karen','Lebo','Mpho','Naledi','Oscar','Palesa','Quinton','Rudo','Siya','Tanya','Ulrich','Vera','Warren','Xola','Yasmin','Zack','Adaeze','Bongani','Candice','Dlamini'];
  var lastNames=['Smith','Johnson','Dlamini','Nkosi','Petersen','Williams','Maharaj','Okafor','Truter','Botha','Mokoena','Taylor','Naidoo','Khumalo','Brown','Ferreira','Sithole','Hendricks','Mbeki','Ntuli','Groenewald','Zulu','Patel','Van Wyk','Pretorius','Louw','Mthembu','Jacobs','Mabaso','Coetzee','Du Plessis','Shabalala','Visser','Cele','Swanepoel','Mkhize','Steyn','Ndlovu','Rossouw','Buthelezi'];
  var products=['Handmade jewellery','Artisan cheese','Organic produce','Handcrafted ceramics','Vintage clothing','Artisan bread','Natural skincare','Handwoven textiles','Specialty coffee','Hot sauce & condiments','Handmade candles','Fresh flowers','Plant nursery','Artisan chocolates','Photography prints','Woodwork','Fermented foods','Macramé art','Bespoke leather goods','Upcycled furniture','Handmade soap','Essential oils','Raw honey','Dried herbs','Homemade jams','Craft beer','Pressed juices','Biltong & dried meats','Handpainted pottery','Wire art','Beaded accessories','Natural dyes & fabric','Mushroom growing kits','Kombucha','Sourdough bread','Vegan baked goods','Handmade pasta','Cold brew coffee','Activated charcoal products','Succulents & cacti'];
  var TOTAL=1000;var vendors=[];
  for(var i=0;i<TOTAL;i++){
    var fname=rnd(firstNames);var lname=rnd(lastNames);
    var product=rnd(products);
    var stallName=product+' by '+fname;
    var email=fname.toLowerCase()+'.'+lname.toLowerCase().replace(/\s/g,'')+i+'@example.com';
    var numMkts=rndInt(1,Math.min(4,pubMarkets.length));
    var chosen=pubMarkets.slice().sort(function(){return Math.random()-0.5;}).slice(0,numMkts);
    var marketIds=chosen.map(function(m){return m.id;});
    var isApproved=i>=300;
    var marketPayments={};var marketMethods={};var marketStallTypes={};var payStatuses=[];
    chosen.forEach(function(m){
      marketStallTypes[m.id]=rnd(m.stall_types).id;
      if(isApproved){
        var paid=Math.random()<0.45;
        marketPayments[m.id]=paid?'paid':'outstanding';
        if(paid){marketMethods[m.id]=rnd(['payfast','eft','cash']);payStatuses.push('paid');}
        else payStatuses.push('outstanding');
      }
    });
    var payStatus='outstanding';
    if(isApproved&&payStatuses.length){
      if(payStatuses.every(function(s){return s==='paid';}))payStatus='paid';
      else if(payStatuses.some(function(s){return s==='paid';}))payStatus='partial';
    }
    var payMethod=Object.values(marketMethods)[0]||null;
    vendors.push({id:uid(),user_id:currentUser.id,name:stallName,description:'We specialise in premium '+product.toLowerCase()+', handcrafted with care.',email:email,status:isApproved?'approved':'pending',markets:marketIds,market_payments:marketPayments,market_methods:marketMethods,market_stall_types:marketStallTypes,market_attendance:{},pay_status:payStatus,pay_method:payMethod,images:[],submitted_at:pastDate(rndInt(1,120)),approved_at:isApproved?pastDate(rndInt(1,60)):null,custom_responses:{}});
  }
  var BATCH=50;
  for(var b=0;b<vendors.length;b+=BATCH){
    var{error:vErr}=await _sb.from('vendors').insert(vendors.slice(b,b+BATCH));
    if(vErr){showToast('Vendor insert failed: '+vErr.message);return;}
    showToast('Vendors '+(b+BATCH)+'/'+TOTAL+'...');
  }
  markets.forEach(function(m){state.markets.push(dbToMarket(m));});
  vendors.forEach(function(v){state.vendors.push(dbToVendor(v));});
  vendors.filter(function(_,i){return i%4===0;}).forEach(function(v){state.verifiedEmails.add(v.email.toLowerCase());});
  updateMetrics();renderHome();
  showToast('Done! 30 markets + 1000 vendors created.');
}
async function purgeStressTestData(){
  showToast('Purging stress test data...');
  var fakeMarketNames=['Spring Craft Fair','Sunday Food Market','Artisan Weekend Market','Organic Farmers Market','Night Market','Heritage Street Market','Pop-Up Fashion Fair','Community Flea Market','Garden Market','Creative Makers Market','Makers & Bakers Market','Vintage & Retro Fair','Seaside Craft Market','Urban Street Food Festival','Eco & Sustainable Market','Holiday Gift Market','Weekend Wellness Market','Kids & Family Fair','Coastal Artisan Market','Township Arts Market','Tech & Innovation Fair','Harvest Festival Market','Indie Music & Craft Fair','Morning Brew Market','Sunset Night Bazaar','Handmade & Homegrown','Pet & Animal Market','Cultural Fusion Market','Mountain Makers Market','Waterfront Weekend Market'];
  var[{error:vErr},{error:mErr}]=await Promise.all([
    _sb.from('vendors').delete().eq('user_id',currentUser.id).ilike('email','%@example.com'),
    _sb.from('markets').delete().eq('user_id',currentUser.id).in('name',fakeMarketNames)
  ]);
  if(vErr||mErr){showToast('Purge failed: '+((vErr||mErr).message));return;}
  state.vendors=state.vendors.filter(function(v){return!v.email.endsWith('@example.com');});
  state.markets=state.markets.filter(function(m){return!fakeMarketNames.includes(m.name);});
  updateMetrics();renderHome();
  showToast('Stress test data purged.');
}
function sendPasswordResetFromAccount(){_sb.auth.resetPasswordForEmail(currentUser.email,{redirectTo:'https://picamarket.site/'});showToast('Password reset email sent!');}
function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function uid(){return crypto.randomUUID();}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){var el=document.getElementById(id);if(!el)return;el.classList.add('closing');setTimeout(function(){el.classList.remove('open','closing');},150);}
function makeSlug(n){var s=n.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');return s||Math.random().toString(36).slice(2,10);}

// ── AUTH ─────────────────────────────────────────────────────────
var currentUser=null;
var _realtimeChannel=null;var _notifCount=0;var _notifDest='approval';var _newVendorIds=new Set();
function openNotifications(){showPage(_notifDest);}
function setPageDot(page,show){document.querySelectorAll('.nav-notif-dot[data-for="'+page+'"]').forEach(function(el){el.style.display=show?'block':'none';});}
var _turnstileWidgetId=null;
var _isDevEnv=window.location.hostname==='localhost'||window.location.hostname.endsWith('.vercel.app');
var _accountType='organiser';
function switchAccountType(t){_accountType=t;var ob=document.getElementById('at-organiser');var vb=document.getElementById('at-vendor');var pill=document.getElementById('at-pill');var desc=document.getElementById('auth-type-desc');if(pill)pill.style.transform=t==='vendor'?'translateX(100%)':'none';if(ob)ob.style.color=t==='organiser'?'#fff':'var(--text2)';if(vb)vb.style.color=t==='vendor'?'#fff':'var(--text2)';if(desc)desc.textContent=t==='organiser'?'Run and manage your markets, vendors, and applications':'Apply to markets and save your vendor details';var of=document.getElementById('reg-organiser-fields');var vf=document.getElementById('reg-vendor-fields');if(of)of.style.display=t==='organiser'?'block':'none';if(vf)vf.style.display=t==='vendor'?'block':'none';clearAuthMsg();}
function switchAuthTab(t){document.querySelectorAll('.auth-tab').forEach((el,i)=>el.classList.toggle('active',(i===0&&t==='login')||(i===1&&t==='register')));document.getElementById('auth-login').style.display=t==='login'?'block':'none';document.getElementById('auth-register').style.display=t==='register'?'block':'none';document.getElementById('auth-forgot').style.display=t==='forgot'?'block':'none';clearAuthMsg();if(t==='register'&&window.turnstile&&_turnstileWidgetId===null){var el=document.getElementById('reg-turnstile');if(el)_turnstileWidgetId=window.turnstile.render(el,{sitekey:'0x4AAAAAACvSECCEAevdD5i-',theme:'auto'});}}
function passwordStrength(pass){var score=0;if(pass.length>=8)score++;if(pass.length>=12)score++;if(/[A-Z]/.test(pass))score++;if(/[a-z]/.test(pass))score++;if(/[0-9]/.test(pass))score++;if(/[^A-Za-z0-9]/.test(pass))score++;return score;}
function updatePwStrength(inputId,wrapId){var pass=document.getElementById(inputId).value;var wrap=document.getElementById(wrapId);if(!pass){wrap.style.display='none';return;}wrap.style.display='block';var score=passwordStrength(pass);var suffix=wrapId.replace('-strength','');var fill=document.getElementById(suffix+'-fill');var label=document.getElementById(suffix+'-label');var levels=[{pct:16,color:'#d96060',text:'Very weak'},{pct:33,color:'#d96060',text:'Weak'},{pct:50,color:'#d4943a',text:'Fair'},{pct:67,color:'#d4943a',text:'Good'},{pct:83,color:'#2a6610',text:'Strong'},{pct:100,color:'#2a6610',text:'Very strong'}];var lvl=levels[Math.min(score,5)];fill.style.width=lvl.pct+'%';fill.style.background=lvl.color;label.textContent=lvl.text;label.style.color=lvl.color;}
function showAuthError(m){var e=document.getElementById('auth-error');e.textContent=m;e.style.display='block';document.getElementById('auth-success').style.display='none';}
function showAuthSuccess(m){var e=document.getElementById('auth-success');e.textContent=m;e.style.display='block';document.getElementById('auth-error').style.display='none';}
function clearAuthMsg(){document.getElementById('auth-error').style.display='none';document.getElementById('auth-success').style.display='none';}
var _loginAttempts=0;var _loginLockUntil=0;var _loginCountdownTimer=null;
function _startLoginCountdown(){var btn=document.getElementById('login-btn');var remaining=Math.ceil((_loginLockUntil-Date.now())/1000);if(remaining<=0){btn.disabled=false;btn.textContent='Log in';_loginCountdownTimer=null;return;}var m=Math.floor(remaining/60);var s=remaining%60;btn.disabled=true;btn.textContent='Try again in '+m+':'+(s<10?'0':'')+s;_loginCountdownTimer=setTimeout(_startLoginCountdown,1000);}
async function doLogin(){if(Date.now()<_loginLockUntil){showAuthError('Too many login attempts. Please wait for the countdown to finish.');return;}var email=document.getElementById('login-email').value.trim().toLowerCase();var pass=document.getElementById('login-password').value;if(!email||!pass){showAuthError('Please fill in all fields.');return;}var{data,error}=await _sb.auth.signInWithPassword({email,password:pass});if(error){_loginAttempts++;if(_loginAttempts>=5){_loginLockUntil=Date.now()+120000;_loginAttempts=0;showAuthError('Too many failed attempts. Please wait 2 minutes.');_startLoginCountdown();return;}showAuthError('Incorrect email or password. '+(5-_loginAttempts)+' attempt'+(5-_loginAttempts===1?'':'s')+' remaining.');return;}_loginAttempts=0;var{data:profile}=await _sb.from('profiles').select('*').eq('id',data.user.id).maybeSingle();if(profile){loginAs(data.user,profile);return;}var{data:vendorProfile}=await _sb.from('vendor_profiles').select('id').eq('user_id',data.user.id).maybeSingle();if(vendorProfile){window.location.href='vendor.html';return;}showAuthError('Account has no profile. Please contact support.');}
async function doVendorRegister(){if(!_isDevEnv){var tsToken=window.turnstile?window.turnstile.getResponse(document.getElementById('reg-turnstile')):null;if(!tsToken){showAuthError('Please wait for the security check to complete.');return;}var verifyRes=await fetch('https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/verify-turnstile',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer sb_publishable_f64M7MFa88zOMuZ083v-lw_Ypgcyhx-'},body:JSON.stringify({token:tsToken})});var verifyData=await verifyRes.json();if(!verifyData.success){showAuthError('Security check failed. Please refresh and try again.');if(window.turnstile)window.turnstile.reset(document.getElementById('reg-turnstile'));return;}}var stall=document.getElementById('reg-stall').value.trim();var email=document.getElementById('reg-email').value.trim().toLowerCase();var pass=document.getElementById('reg-password').value;var confirm=document.getElementById('reg-confirm').value;if(!stall||!email||!pass||!confirm){showAuthError('Please fill in all fields.');return;}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showAuthError('Please enter a valid email.');return;}if(pass.length<8){showAuthError('Password must be at least 8 characters.');return;}if(!/[A-Z]/.test(pass)){showAuthError('Password must contain at least one uppercase letter.');return;}if(!/[a-z]/.test(pass)){showAuthError('Password must contain at least one lowercase letter.');return;}if(!/[0-9]/.test(pass)){showAuthError('Password must contain at least one number.');return;}if(!/[^A-Za-z0-9]/.test(pass)){showAuthError('Password must contain at least one special character (e.g. !@#$%).');return;}if(pass!==confirm){showAuthError('Passwords do not match.');return;}var{data,error}=await _sb.auth.signUp({email,password:pass});if(error){showAuthError(error.message);return;}var{error:pErr}=await _sb.from('vendor_profiles').insert({user_id:data.user.id,stall_name:stall,email:email});if(pErr){showAuthError('Account created but profile failed to save. Please try logging in.');return;}var welSess=data.session;if(welSess){fetch('https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/welcome-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+welSess.access_token},body:JSON.stringify({type:'vendor'})}).catch(err=>console.error('Welcome email error:',err));}showAuthSuccess('Account created! Redirecting to your dashboard...');setTimeout(()=>{window.location.href='vendor.html';},800);}
async function doRegister(){if(_accountType==='vendor'){doVendorRegister();return;}if(!_isDevEnv){var tsToken=window.turnstile?window.turnstile.getResponse(document.getElementById('reg-turnstile')):null;if(!tsToken){showAuthError('Please wait for the security check to complete.');return;}var verifyRes=await fetch('https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/verify-turnstile',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer sb_publishable_f64M7MFa88zOMuZ083v-lw_Ypgcyhx-'},body:JSON.stringify({token:tsToken})});var verifyData=await verifyRes.json();if(!verifyData.success){showAuthError('Security check failed. Please refresh and try again.');if(window.turnstile)window.turnstile.reset(document.getElementById('reg-turnstile'));return;}}var market=document.getElementById('reg-market').value.trim();var name=document.getElementById('reg-name').value.trim();var email=document.getElementById('reg-email').value.trim().toLowerCase();var pass=document.getElementById('reg-password').value;var confirm=document.getElementById('reg-confirm').value;if(!market||!name||!email||!pass||!confirm){showAuthError('Please fill in all fields.');return;}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showAuthError('Please enter a valid email.');return;}if(pass.length<8){showAuthError('Password must be at least 8 characters.');return;}if(!/[A-Z]/.test(pass)){showAuthError('Password must contain at least one uppercase letter.');return;}if(!/[a-z]/.test(pass)){showAuthError('Password must contain at least one lowercase letter.');return;}if(!/[0-9]/.test(pass)){showAuthError('Password must contain at least one number.');return;}if(!/[^A-Za-z0-9]/.test(pass)){showAuthError('Password must contain at least one special character (e.g. !@#$%).');return;}if(pass!==confirm){showAuthError('Passwords do not match.');return;}var{data:existing}=await _sb.from('profiles').select('id').eq('market_name',market).maybeSingle();if(existing){showAuthError('That market name is already taken. Please choose a different name.');return;}var{data,error}=await _sb.auth.signUp({email,password:pass});if(error){showAuthError(error.message);return;}var slug=makeSlug(market);var{error:pErr}=await _sb.from('profiles').insert({id:data.user.id,market_name:market,coordinator_name:name,slug,coordinator_email:email});if(pErr){showAuthError('Account created but profile failed to save. Please try logging in.');return;}var welSess2=data.session;if(welSess2){fetch('https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/welcome-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+welSess2.access_token},body:JSON.stringify({})}).catch(err=>console.error('Welcome email error:',err));}showAuthSuccess('Account created! Logging you in...');setTimeout(()=>loginAs(data.user,{market_name:market,coordinator_name:name,slug}),800);}
async function loginAs(user,profile){var saved=profile.settings||{};currentUser={...user,market:profile.market_name,name:profile.coordinator_name,slug:profile.slug,isPublic:!!profile.is_public,description:profile.description||'',payfastMerchantId:profile.payfast_merchant_id||null,payfastMerchantKey:profile.payfast_merchant_key||null,payfastPassphrase:profile.payfast_passphrase||null,payfastSandbox:!!profile.payfast_sandbox,bankHolder:profile.bank_holder||null,bankName:profile.bank_name||null,bankAccNum:profile.bank_acc_num||null,bankBranch:profile.bank_branch||null,bankAccType:profile.bank_acc_type||null,emailApprovalIntro:saved.approval_email_intro||null,emailReminderIntro:saved.reminder_email_intro||null,blockedEmails:saved.blocked_emails||[],formFields:saved.form_fields||(saved.custom_fields&&saved.custom_fields.length?DEFAULT_FORM_FIELDS.concat(saved.custom_fields):null)||DEFAULT_FORM_FIELDS,notifyOnApply:saved.notify_on_apply!==false};state.vendors=[];state.markets=[];state.expandedRows={};state.filterPayment='';darkMode=!!saved.dark_mode;state.hideHints=!!saved.hide_hints;state.hideCalendar=!!saved.hide_calendar;document.body.classList.toggle('dark',darkMode);document.getElementById('auth-screen').style.display='none';document.getElementById('dashboard').style.display='block';document.getElementById('nav-brand').innerHTML='<span>'+esc(profile.market_name)+'</span><span class="nav-brand-suffix"> &ndash; Dashboard</span>';document.getElementById('nav-user').textContent=profile.coordinator_name;document.getElementById('sidebar-user').textContent=profile.coordinator_name;document.getElementById('pub-title').textContent=profile.market_name;await loadUserData();showPage('home');if(state.hideHints)document.querySelectorAll('.page-banner').forEach(el=>el.style.display='none');startVendorWatch();maybeShowOrganiserOnboarding();}

function maybeShowOrganiserOnboarding(){var key='pm_ob_done_'+currentUser.id;if(currentUser.description){localStorage.setItem(key,'1');return;}if(localStorage.getItem(key))return;var el=document.getElementById('org-onboarding');if(el){document.getElementById('ob-org-desc').value='';document.getElementById('ob-org-step-1').style.display='block';document.getElementById('ob-org-step-2').style.display='none';el.style.display='flex';}}
function obOrgNext(){document.getElementById('ob-org-step-1').style.display='none';document.getElementById('ob-org-step-2').style.display='block';}
function obOrgBack(){document.getElementById('ob-org-step-1').style.display='block';document.getElementById('ob-org-step-2').style.display='none';}
async function obOrgFinish(){var desc=document.getElementById('ob-org-desc').value.trim();var isPublic=document.getElementById('ob-org-public').checked;await _sb.from('profiles').update({description:desc||null,is_public:isPublic}).eq('id',currentUser.id);currentUser.description=desc;currentUser.isPublic=isPublic;syncSettingsMenu();localStorage.setItem('pm_ob_done_'+currentUser.id,'1');document.getElementById('org-onboarding').style.display='none';}
function obOrgSkip(){localStorage.setItem('pm_ob_done_'+currentUser.id,'1');document.getElementById('org-onboarding').style.display='none';}

async function doLogout(){closeModal('logout-confirm-modal');if(_realtimeChannel){_sb.removeChannel(_realtimeChannel);_realtimeChannel=null;}await _sb.auth.signOut();currentUser=null;document.getElementById('dashboard').style.display='none';document.getElementById('auth-screen').style.display='flex';document.getElementById('login-email').value='';document.getElementById('login-password').value='';clearAuthMsg();switchAuthTab('login');}
async function doForgotPassword(){var email=document.getElementById('forgot-email').value.trim().toLowerCase();if(!email){showAuthError('Please enter your email.');return;}var{error}=await _sb.auth.resetPasswordForEmail(email,{redirectTo:'https://picamarket.site/'});if(error){showAuthError(error.message);return;}showAuthSuccess('Reset link sent! Check your inbox.');}
async function doResetPassword(){var pass=document.getElementById('reset-password-input').value;var confirm=document.getElementById('reset-password-confirm').value;var re=document.getElementById('reset-error'),rs=document.getElementById('reset-success');re.style.display='none';rs.style.display='none';if(!pass||!confirm){re.textContent='Please fill in both fields.';re.style.display='block';return;}if(pass.length<8){re.textContent='Password must be at least 8 characters.';re.style.display='block';return;}if(!/[A-Z]/.test(pass)){re.textContent='Password must contain at least one uppercase letter.';re.style.display='block';return;}if(!/[a-z]/.test(pass)){re.textContent='Password must contain at least one lowercase letter.';re.style.display='block';return;}if(!/[0-9]/.test(pass)){re.textContent='Password must contain at least one number.';re.style.display='block';return;}if(!/[^A-Za-z0-9]/.test(pass)){re.textContent='Password must contain at least one special character (e.g. !@#$%).';re.style.display='block';return;}if(pass!==confirm){re.textContent='Passwords do not match.';re.style.display='block';return;}var{error}=await _sb.auth.updateUser({password:pass});if(error){re.textContent=error.message;re.style.display='block';return;}rs.textContent='Password updated! You can now log in.';rs.style.display='block';setTimeout(()=>{document.getElementById('reset-password-modal').classList.remove('open');},2000);}
// Restore session on page load only; handle password recovery redirect
_sb.auth.onAuthStateChange(async(event,session)=>{
  if(event==='PASSWORD_RECOVERY'){document.getElementById('reset-password-modal').classList.add('open');return;}
  if(event==='INITIAL_SESSION'&&session&&!currentUser&&!_isRecovery){var{data:profile}=await _sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();if(profile){loginAs(session.user,profile);return;}var{data:vp}=await _sb.from('vendor_profiles').select('id').eq('user_id',session.user.id).maybeSingle();if(vp){window.location.href='vendor.html';}}
});

// ── DB HELPERS ────────────────────────────────────────────────────
function dbToMarket(r){return{id:r.id,name:r.name,desc:r.description||'',header:r.header||'',fee:r.fee||FEE,stallTypes:r.stall_types||[],capacity:r.capacity||30,dates:r.dates||[],deadline:r.deadline||null,startTime:r.start_time||null,endTime:r.end_time||null,banner:r.banner||null,published:r.published||false,notes:r.notes||''};}
function marketToDb(m){return{id:m.id,user_id:currentUser.id,name:m.name,description:m.desc||'',header:m.header||'',fee:m.fee||FEE,stall_types:m.stallTypes||[],capacity:m.capacity||30,dates:m.dates||[],deadline:m.deadline||null,start_time:m.startTime||null,end_time:m.endTime||null,banner:m.banner||null,published:!!m.published,notes:m.notes||''};}
function dbToVendor(r){return{id:r.id,name:r.name,desc:r.description||'',email:r.email,status:r.status||'pending',markets:r.markets||[],marketPayments:r.market_payments||{},marketMethods:r.market_methods||{},marketStallTypes:r.market_stall_types||{},marketAttendance:r.market_attendance||{},payStatus:r.pay_status||'outstanding',payMethod:r.pay_method||null,images:r.images||[],submitted:r.submitted_at||'',approvedAt:r.approved_at||'',customResponses:r.custom_responses||{}};}
function vendorToDb(v){var obj={id:v.id,user_id:currentUser.id,name:v.name,description:v.desc||'',email:v.email,status:v.status,markets:v.markets||[],market_payments:v.marketPayments||{},market_methods:v.marketMethods||{},market_stall_types:v.marketStallTypes||{},market_attendance:v.marketAttendance||{},pay_status:v.payStatus||'outstanding',pay_method:v.payMethod||null,images:v.images||[],submitted_at:v.submitted||'',approved_at:v.approvedAt||''};if(v.customResponses&&Object.keys(v.customResponses).length)obj.custom_responses=v.customResponses;return obj;}
function defaultStallTypes(fee){return[{id:'normal-stall',name:'Normal stall',fee:fee||FEE,color:'#6b7280'}];}
function getStallType(v,m){var types=m&&m.stallTypes&&m.stallTypes.length?m.stallTypes:defaultStallTypes(m&&m.fee);var typeId=(v&&v.marketStallTypes&&m)?v.marketStallTypes[m.id]:null;return types.find(x=>x.id===typeId)||types[0];}
function getStallFee(v,m){return getStallType(v,m).fee||FEE;}
function stallTypeLabel(v,m){return getStallType(v,m).name||'Normal stall';}
function stallTypeBadge(v,m){var t=getStallType(v,m);var c=t.color||'#6b7280';return'<span class="badge" style="background:'+c+'22;color:'+c+'">'+esc(t.name)+'</span>';}
async function refreshPending(){var btn=document.getElementById('refresh-btn');if(btn){btn.textContent='↻ Loading...';btn.disabled=true;}await loadUserData();renderPending();updateMetrics();if(btn){btn.textContent='↻ Refresh';btn.disabled=false;}}
async function loadUserData(){var[{data:mkts},{data:vnds},{data:arcs}]=await Promise.all([_sb.from('markets').select('*').eq('user_id',currentUser.id).order('created_at'),_sb.from('vendors').select('*').eq('user_id',currentUser.id).order('created_at'),_sb.from('archived_markets').select('*').eq('user_id',currentUser.id).order('archived_at',{ascending:false})]);state.markets=(mkts||[]).map(dbToMarket);state.vendors=(vnds||[]).map(dbToVendor);state.archivedMarkets=arcs||[];var emails=[...new Set(state.vendors.map(v=>v.email).filter(Boolean))];if(emails.length){var allVps=[];var chunkSize=100;for(var i=0;i<emails.length;i+=chunkSize){var chunk=emails.slice(i,i+chunkSize);var{data:vps}=await _sb.from('vendor_profiles').select('email').in('email',chunk);if(vps)allVps.push(...vps);}state.verifiedEmails=new Set(allVps.map(vp=>(vp.email||'').toLowerCase()));}else{state.verifiedEmails=new Set();}}
function isVerified(v){return !!(state.verifiedEmails&&state.verifiedEmails.has((v.email||'').toLowerCase()));}
async function sbSave(table,obj){var{error}=await _sb.from(table).upsert(obj);if(error){console.error('DB save error:',error);showToast('Save failed — please try again.');return false;}return true;}
async function sbDel(table,id){var{error}=await _sb.from(table).delete().eq('id',id);if(error){console.error('DB delete error:',error);showToast('Delete failed — please try again.');return false;}return true;}

// ── STATE ─────────────────────────────────────────────────────────
// Each vendor object shape:
// { id, name, desc, email, status, markets:['mid1','mid2'],
//   marketPayments:{'mid1':'outstanding','mid2':'paid'},
//   payStatus:'outstanding'|'partial'|'paid', payMethod,
//   images, submitted, approvedAt }
var state={vendors:[],markets:[],editMarketId:null,notesMarketId:null,expandedRows:{},filterPayment:'',hideHints:false,hideCalendar:false,pendingSort:{col:null,dir:1},approvedSort:{col:null,dir:1},_approveQueue:[],_removeQueue:[],_tempDates:[],_tempBanner:null,_tempStallTypes:[],_menuVendorId:null,_payMarketId:null,verifiedEmails:new Set(),archivedMarkets:[]};
var FEE=350;
var DEFAULT_FORM_FIELDS=[
  {id:'builtin-name',type:'text',label:'Stall / shop name',required:true,builtin:true},
  {id:'builtin-desc',type:'textarea',label:'Description of what you sell',required:true,builtin:true},
  {id:'builtin-email',type:'email',label:'Contact email',required:true,builtin:true},
  {id:'builtin-photos',type:'photos',label:'Photos of your stall / products',required:false,builtin:true},
];
var STALL_COLORS=['#6b7280','#2563eb','#16a34a','#0d9488','#7c3aed','#ea580c','#dc2626','#db2777','#ca8a04','#4f46e5'];
var _vendorImages=[];

// ── NAVIGATION ────────────────────────────────────────────────────
function showPage(p){document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));document.querySelectorAll('.nav-tab').forEach(el=>el.classList.remove('active'));document.querySelectorAll('.bottom-nav-item').forEach(el=>el.classList.remove('active'));document.querySelectorAll('.sidebar-item').forEach(el=>el.classList.remove('active'));document.getElementById('page-'+p).classList.add('active');var map={home:0,approval:1,approved:2,markets:3,settings:4};if(map[p]!==undefined){var nt=document.querySelectorAll('.nav-tab')[map[p]];if(nt)nt.classList.add('active');var bn=document.querySelectorAll('.bottom-nav-item')[map[p]];if(bn)bn.classList.add('active');var si=document.querySelectorAll('.sidebar-item')[map[p]];if(si)si.classList.add('active');}if(p==='home')renderHome();if(p==='approval'){renderPending();clearNotifications();setPageDot('approval',false);loadUserData().then(()=>{renderPending();updateMetrics();});}if(p==='approved'){renderApproved();clearNotifications();setPageDot('approved',false);}if(p==='markets')renderMarkets();if(p==='public')renderPublic();if(p==='settings')syncSettingsMenu();if(state.hideHints)document.querySelectorAll('.page-banner').forEach(el=>el.style.display='none');updateMetrics();window.scrollTo(0,0);}
function pubTab(t){var tabs=document.querySelectorAll('.tabs-inner .tab-inner');tabs[0].classList.toggle('active',t==='browse');tabs[1].classList.toggle('active',t==='apply');document.getElementById('pub-browse').style.display=t==='browse'?'block':'none';document.getElementById('pub-apply').style.display=t==='apply'?'block':'none';if(t==='apply')renderVendorFormMarkets();}
function updateMetrics(){var pend=state.vendors.filter(v=>v.status==='pending');var appr=state.vendors.filter(v=>v.status==='approved');var paid=appr.filter(v=>v.payStatus==='paid');var rev=appr.reduce((s,v)=>s+v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(v,m);},0),0);document.getElementById('m-pending').textContent=pend.length;document.getElementById('m-app-total').textContent=appr.length;document.getElementById('m-app-paid').textContent=paid.length;document.getElementById('m-app-out').textContent=appr.length-paid.length;document.getElementById('m-app-rev').textContent='R'+rev.toLocaleString();}

// ── HOME PAGE ─────────────────────────────────────────────────────
function renderHome(){
  var key='pm_visited_'+(currentUser?currentUser.id:'x');
  var hero=document.getElementById('home-hero');
  if(!localStorage.getItem(key)){
    var greet=document.getElementById('home-greeting');
    if(greet)greet.textContent='Hello '+(currentUser?currentUser.name:'')+'!';
    if(hero)hero.style.display='';
    localStorage.setItem(key,'1');
  }else{
    if(hero)hero.style.display='none';
  }
  var pending=state.vendors.filter(function(v){return v.status==='pending';}).length;
  var today=new Date().toISOString().slice(0,10);
  var upcoming=state.markets.filter(function(m){return m.dates&&m.dates.some(function(d){return d>=today;});}).length;
  var ep=document.getElementById('hm-pending');if(ep)ep.textContent=pending;
  var eu=document.getElementById('hm-upcoming');if(eu)eu.textContent=upcoming;
  renderCalendar();
}

// ── CALENDAR ──────────────────────────────────────────────────────
var _calYear,_calMonth;
function renderCalendar(){
  var el=document.getElementById('home-calendar');if(!el)return;
  if(state.hideCalendar){el.style.display='none';return;}
  el.style.display='';
  var now=new Date();
  if(!_calYear){_calYear=now.getFullYear();_calMonth=now.getMonth();}
  var today=now.toISOString().slice(0,10);
  var dateMap={};
  state.markets.forEach(function(m){(m.dates||[]).forEach(function(d){if(!dateMap[d])dateMap[d]=[];dateMap[d].push(m.name);});});
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var firstDow=(new Date(_calYear,_calMonth,1).getDay()+6)%7;
  var daysInMonth=new Date(_calYear,_calMonth+1,0).getDate();
  var daysInPrev=new Date(_calYear,_calMonth,0).getDate();
  var prevYear=_calMonth===0?_calYear-1:_calYear,prevMonth=_calMonth===0?11:_calMonth-1;
  var nextYear=_calMonth===11?_calYear+1:_calYear,nextMonth=_calMonth===11?0:_calMonth+1;
  var cells=[];
  for(var i=0;i<firstDow;i++)cells.push({d:daysInPrev-firstDow+1+i,mo:prevMonth,yr:prevYear,cur:false});
  for(var d=1;d<=daysInMonth;d++)cells.push({d:d,mo:_calMonth,yr:_calYear,cur:true});
  var total=Math.ceil(cells.length/7)*7;
  for(var n=1;cells.length<total;n++)cells.push({d:n,mo:nextMonth,yr:nextYear,cur:false});
  var pad=function(n){return n<10?'0'+n:''+n;};
  var grid=cells.map(function(c){
    var ds=c.yr+'-'+pad(c.mo+1)+'-'+pad(c.d);
    var mkts=dateMap[ds]||[];var hasM=mkts.length>0;
    var isToday=ds===today;
    var cls='cal-day'+(c.cur?' cur-month':'')+(isToday?' today-cell':'')+(hasM?' has-market':'');
    var attrs=hasM?' onclick="calSelectDay(\''+ds+'\')" title="'+mkts.map(esc).join(', ')+'"':'';
    return'<div class="'+cls+'"'+attrs+'><span class="day-num">'+c.d+'</span><span class="cal-dot"></span></div>';
  }).join('');
  el.innerHTML='<div class="home-cal"><div class="mf-section-label" style="margin-top:2rem">Market Calendar</div><div class="cal-header"><button class="cal-nav-btn" onclick="calNav(-1)">&#8249;</button><span class="cal-month-label">'+MONTHS[_calMonth]+' '+_calYear+'</span><button class="cal-nav-btn" onclick="calNav(1)">&#8250;</button></div><div class="cal-grid">'+DAYS.map(function(d){return'<div class="cal-weekday">'+d+'</div>';}).join('')+grid+'</div><div id="cal-day-info" style="min-height:8px"></div></div>';
}
function calNav(dir){
  _calMonth+=dir;
  if(_calMonth>11){_calMonth=0;_calYear++;}
  if(_calMonth<0){_calMonth=11;_calYear--;}
  renderCalendar();
}
function calSelectDay(ds){
  var tip=document.getElementById('cal-day-info');if(!tip)return;
  var names=[];state.markets.forEach(function(m){if((m.dates||[]).includes(ds))names.push(m.name);});
  if(!names.length)return;
  tip.innerHTML='<div style="margin-top:10px;padding:10px 12px;background:var(--bg3);border-radius:8px;border:0.5px solid var(--border)"><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text3);margin-bottom:4px">'+ds+'</div>'+names.map(function(n){return'<div style="font-size:13px;color:var(--text);font-weight:500">'+esc(n)+'</div>';}).join('')+'</div>';
}

// ── VENDOR APPROVAL ───────────────────────────────────────────────
function renderPending(filter){
  var blocked=currentUser?currentUser.blockedEmails||[]:[];
  var list=state.vendors.filter(v=>v.status==='pending'&&!blocked.includes(v.email.toLowerCase()));
  if(filter)list=list.filter(v=>v.name.toLowerCase().includes(filter.toLowerCase()));
  var ps=state.pendingSort;
  if(ps.col){list.sort((a,b)=>{var av,bv;if(ps.col==='name'){av=a.name.toLowerCase();bv=b.name.toLowerCase();}else if(ps.col==='desc'){av=(a.desc||'').toLowerCase();bv=(b.desc||'').toLowerCase();}else if(ps.col==='markets'){av=a.markets.length;bv=b.markets.length;}else if(ps.col==='fee'){av=a.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(a,m);},0);bv=b.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(b,m);},0);}else if(ps.col==='submitted'){av=a.submitted;bv=b.submitted;}return av<bv?-ps.dir:av>bv?ps.dir:0;});}
  var tb=document.getElementById('pending-tbody'),cards=document.getElementById('pending-cards'),empty=document.getElementById('pending-empty');
  if(!list.length){tb.innerHTML='';cards.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  var _psh=function(label,col){var arr=ps.col===col?(ps.dir===1?' ▲':' ▼'):'';return'<th style="cursor:pointer;user-select:none;white-space:nowrap" onclick="sortPending(\''+col+'\')">'+label+'<span style="font-size:10px;color:var(--text3)">'+arr+'</span></th>';};
  document.getElementById('pending-thead').innerHTML='<tr><th style="width:36px"></th>'+_psh('Stall name','name')+_psh('Description','desc')+_psh('Markets','markets')+_psh('Est. fee','fee')+_psh('Submitted','submitted')+'<th>Status</th></tr>';
  tb.innerHTML=list.map(v=>{
    var mchips=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<span class="chip">'+esc(m.name)+'</span>':''}).join('');
    var estFee=v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(v,m);},0);
    var exp=state.expandedRows[v.id];
    var photos=v.images&&v.images.length?'<div style="grid-column:1/-1"><div class="field-label">Stall photos</div><div class="img-thumb-grid" style="margin-top:4px">'+v.images.map((src,i)=>'<div class="img-thumb clickable" onclick="openLightbox(\''+v.id+'\','+i+')"><img src="'+src+'"></div>').join('')+'</div></div>':'';
    var newDot=_newVendorIds.has(v.id)?'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--red);margin-right:6px;vertical-align:middle;flex-shrink:0"></span>':'';var rows='<tr><td><input type="checkbox" class="v-check" value="'+v.id+'"></td><td><button class="vendor-name-btn" onclick="toggleExpand(\''+v.id+'\')">'+newDot+esc(v.name)+'</button>'+(isVerified(v)?'<span class="badge" style="background:rgba(37,99,235,0.1);color:var(--blue);font-size:10px;margin-left:4px">&#10003;</span>':'')+'</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">'+esc(v.desc)+'</td><td><span class="badge" style="background:var(--teal-bg);color:var(--teal)">'+v.markets.length+' mkt'+(v.markets.length!==1?'s':'')+'</span></td><td style="font-weight:500">R'+estFee.toLocaleString()+'</td><td style="color:var(--text2)">'+v.submitted+'</td><td><span class="badge pending">Pending</span></td></tr>';
    if(exp){var stallInfo=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<div style="font-size:12px;padding:3px 0">'+esc(m.name)+' <span style="color:var(--text3)">('+stallTypeLabel(v,m)+')</span></div>':''}).join('');rows+='<tr class="expand-row"><td colspan="7"><div class="expand-inner"><div><div class="field-label">Email</div><div class="field-value">'+esc(v.email)+'</div></div><div style="grid-column:1/-1"><div class="field-label">Description</div><div class="field-value">'+esc(v.desc)+'</div></div>'+_vendorCustomSection(v,true)+'<div style="grid-column:1/-1"><div class="field-label">Markets &amp; stall types</div><div style="margin-top:6px">'+stallInfo+'</div></div>'+photos+'</div></td></tr>';}
    return rows;
  }).join('');
  cards.innerHTML=list.map(v=>{
    var mchips=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<span class="chip">'+esc(m.name)+'</span>':''}).join('');
    var exp=state.expandedRows[v.id+'_m'];
    var photos=v.images&&v.images.length?'<div><div class="field-label">Stall photos</div><div class="img-thumb-grid" style="margin-top:4px">'+v.images.map((src,i)=>'<div class="img-thumb clickable" onclick="openLightbox(\''+v.id+'\','+i+')"><img src="'+src+'"></div>').join('')+'</div></div>':'';
    var expand=exp?'<div class="vendor-card-expand"><div class="field-label">Email</div><div class="field-value">'+esc(v.email)+'</div><div class="field-label">Description</div><div class="field-value">'+esc(v.desc)+'</div>'+_vendorCustomSection(v,false)+'<div class="field-label">Markets &amp; stall types</div>'+v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>'+esc(m.name)+' <span style="color:var(--text3)">('+stallTypeLabel(v,m)+')</span></span><span style="font-weight:500">R'+getStallFee(v,m)+'</span></div>':''}).join('')+'<div class="field-label" style="margin-top:6px">Est. fee</div><div class="field-value" style="font-weight:500">R'+(v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(v,m);},0)).toLocaleString()+'</div>'+photos+'</div>':'';
    var mNewDot=_newVendorIds.has(v.id)?'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--red);margin-right:6px;vertical-align:middle;flex-shrink:0"></span>':'';return'<div class="vendor-card"><div class="vendor-card-header"><div class="vendor-card-check"><input type="checkbox" class="v-check" value="'+v.id+'"></div><div class="vendor-card-name" onclick="toggleExpandMobile(\''+v.id+'\')">'+mNewDot+esc(v.name)+(isVerified(v)?'<span class="badge" style="background:rgba(37,99,235,0.1);color:var(--blue);font-size:10px;margin-left:4px">&#10003;</span>':'')+'</div><div class="vendor-card-badge"><span class="badge pending">Pending</span></div></div><div class="vendor-card-meta">'+v.markets.length+' market'+(v.markets.length!==1?'s':'')+' &middot; '+v.submitted+'</div>'+expand+'</div>';
  }).join('');
}
function _vendorCustomSection(v,spanAll){var fields=(currentUser.formFields||[]).filter(f=>!f.builtin);if(!fields.length||!v.customResponses)return'';var entries=fields.map(f=>{var val=v.customResponses[f.id];if(!val&&val!==0)return'';var display=Array.isArray(val)?val.join(', '):String(val);if(!display)return'';return'<div><div class="field-label">'+esc(f.label)+'</div><div class="field-value">'+esc(display)+'</div></div>';}).filter(Boolean).join('');if(!entries)return'';var span=spanAll?'style="grid-column:1/-1"':'';return'<div '+span+'><div class="field-label" style="margin-bottom:4px">Additional questions</div><div style="display:grid;gap:6px">'+entries+'</div></div>';}
function toggleExpand(id){_newVendorIds.delete(id);state.expandedRows[id]=!state.expandedRows[id];renderPending();}
function toggleExpandMobile(id){_newVendorIds.delete(id);state.expandedRows[id+'_m']=!state.expandedRows[id+'_m'];renderPending();}
function toggleAll(cb){document.querySelectorAll('.v-check').forEach(c=>c.checked=cb.checked);}
function disapproveSelected(){var checked=[...new Set(Array.from(document.querySelectorAll('.v-check:checked')).map(c=>c.value))];if(!checked.length){alert('Select at least one vendor to remove.');return;}state._removeQueue=checked;var names=checked.map(id=>{var v=state.vendors.find(x=>x.id===id);return v?v.name:null;}).filter(Boolean);document.getElementById('remove-modal-list').innerHTML=names.map(n=>'<li style="padding:4px 0;font-size:13px">'+esc(n)+'</li>').join('');document.getElementById('remove-modal').classList.add('open');}
async function confirmRemove(){var ids=state._removeQueue.slice();await Promise.all(ids.map(id=>sbDel('vendors',id)));state.vendors=state.vendors.filter(v=>!ids.includes(v.id));state._removeQueue=[];closeModal('remove-modal');renderPending();updateMetrics();}
function approveSelected(){var checked=[...new Set(Array.from(document.querySelectorAll('.v-check:checked')).map(c=>c.value))];if(!checked.length){alert('Select at least one vendor to approve.');return;}state._approveQueue=checked.slice();openNextApproval();}
function closeApprovalModal(){state._approveQueue=[];closeModal('approve-modal');}
function openNextApproval(){if(!state._approveQueue.length){updateMetrics();renderPending();return;}var id=state._approveQueue[0];var v=state.vendors.find(x=>x.id===id);if(!v){state._approveQueue.shift();openNextApproval();return;}document.getElementById('approve-modal-name').textContent=v.name;document.getElementById('approve-modal-count').textContent=state._approveQueue.length>1?state._approveQueue.length+' vendors in queue':'';document.getElementById('approve-market-checks').innerHTML=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);if(!m)return'';var badge=m&&m.stallTypes&&m.stallTypes.length>1?' &nbsp;'+stallTypeBadge(v,m):'';return'<label style="display:flex;align-items:center;gap:10px;padding:12px;border:0.5px solid var(--border);border-radius:8px;cursor:pointer;margin-bottom:8px;background:var(--bg3)"><input type="checkbox" class="approve-mkt-cb" value="'+mid+'" checked style="width:18px;height:18px;accent-color:var(--blue)"><div><div style="font-size:14px;font-weight:500;color:var(--text)">'+esc(m.name)+badge+'</div><div style="font-size:12px;color:var(--text2)">'+m.dates.join(' · ')+' · R'+getStallFee(v,m)+'/stall'+' ('+stallTypeLabel(v,m)+')</div></div></label>';}).join('');document.getElementById('approve-modal').classList.add('open');}

async function mergeApproveVendor(v,sel){var mnames=sel.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?m.name:mid;}).join(', ');var existing=state.vendors.find(x=>x.id!==v.id&&x.status==='approved'&&x.email===v.email);if(existing){sel.forEach(mid=>{if(!existing.markets.includes(mid))existing.markets.push(mid);if(!existing.marketPayments)existing.marketPayments={};if(!existing.marketPayments[mid])existing.marketPayments[mid]='outstanding';});var ok=await sbSave('vendors',vendorToDb(existing));await sbDel('vendors',v.id);if(!ok){showToast('Approval failed — please try again.');return;}state.vendors=state.vendors.filter(x=>x.id!==v.id);}else{v.status='approved';v.markets=sel.slice();v.payStatus='outstanding';v.payMethod=null;v.marketPayments={};sel.forEach(mid=>{v.marketPayments[mid]='outstanding';});v.approvedAt=new Date().toISOString().slice(0,10);var ok=await sbSave('vendors',vendorToDb(v));if(!ok){showToast('Approval failed — please try again.');return;}}var paySection='';
  var _hasPF=currentUser.payfastMerchantId&&currentUser.payfastMerchantKey;
  var _hasBank=currentUser.bankHolder&&currentUser.bankName&&currentUser.bankAccNum;
  if(_hasPF){
    var links=sel.map(mid=>{var m=state.markets.find(x=>x.id===mid);if(!m)return'';var url=pfUrl(v,m);return url?'<p style="margin:8px 0"><strong>'+esc(m.name)+'</strong> ('+stallTypeLabel(v,m)+') — R'+getStallFee(v,m)+': <a href="'+url+'" style="color:#2563eb">Pay now</a></p>':'';}).join('');
    if(links)paySection='<p>Please pay your stall fee for each market using the links below:</p>'+links+'<p style="font-size:12px;color:#666">Payments are processed securely via PayFast.</p>';
  }
  if(_hasBank){paySection+='<p style="margin-top:12px"><strong>EFT / Bank transfer:</strong><br>'+'Account holder: <strong>'+esc(currentUser.bankHolder)+'</strong><br>'+'Bank: <strong>'+esc(currentUser.bankName)+'</strong><br>'+'Account number: <strong>'+esc(currentUser.bankAccNum)+'</strong>'+(currentUser.bankBranch?'<br>Branch code: <strong>'+esc(currentUser.bankBranch)+'</strong>':'')+(currentUser.bankAccType?'<br>Account type: <strong>'+esc(currentUser.bankAccType)+'</strong>':'')+'<br><em style="font-size:12px;color:#6b7280">Please use your stall name as the payment reference.</em></p>';}
  if(!paySection)paySection='<p>The coordinator will be in touch with payment details. Please ensure your stall fee is paid before the market date.</p>';
  var approvalIntro=currentUser.emailApprovalIntro?'<p>'+esc(currentUser.emailApprovalIntro).replace(/\n/g,'<br>')+'</p>':'<p>Great news! Your vendor application has been approved for the following market'+(sel.length!==1?'s':'')+':</p>';
  sendEmail(v.email,'You\'ve been approved — '+currentUser.market,'<p>Hi '+esc(v.name)+',</p>'+approvalIntro+'<p><strong>'+esc(mnames)+'</strong></p>'+paySection+'<p>Thanks,<br>'+esc(currentUser.market)+'</p>');}

async function confirmApproval(){
  var id=state._approveQueue.shift();
  var v=state.vendors.find(x=>x.id===id);
  var sel=Array.from(document.querySelectorAll('.approve-mkt-cb:checked')).map(c=>c.value);
  if(!sel.length){alert('Select at least one market.');state._approveQueue.unshift(id);return;}
  await mergeApproveVendor(v,sel);
  closeModal('approve-modal');
  setTimeout(openNextApproval,200);
}

function skipApproval(){state._approveQueue.shift();closeModal('approve-modal');setTimeout(openNextApproval,200);}

async function approveAll(){
  await Promise.all([...state._approveQueue].map(id=>{
    var v=state.vendors.find(x=>x.id===id);
    if(!v)return Promise.resolve();
    return mergeApproveVendor(v,v.markets.slice());
  }));
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
  var as=state.approvedSort;
  if(as.col){list.sort((a,b)=>{var av,bv;if(as.col==='name'){av=a.name.toLowerCase();bv=b.name.toLowerCase();}else if(as.col==='markets'){av=a.markets.length;bv=b.markets.length;}else if(as.col==='fee'){av=a.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(a,m);},0);bv=b.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(b,m);},0);}else if(as.col==='payment'){var ord={paid:0,partial:1,outstanding:2};av=ord[calcPayStatus(a)]||0;bv=ord[calcPayStatus(b)]||0;}return av<bv?-as.dir:av>bv?as.dir:0;});}
  var tb=document.getElementById('approved-tbody'),cards=document.getElementById('approved-cards'),empty=document.getElementById('approved-empty');
  var _ash=function(label,col){var arr=as.col===col?(as.dir===1?' ▲':' ▼'):'';return'<th style="cursor:pointer;user-select:none;white-space:nowrap" onclick="sortApproved(\''+col+'\')">'+label+'<span style="font-size:10px;color:var(--text3)">'+arr+'</span></th>';};
  document.getElementById('approved-thead').innerHTML='<tr><th style="width:36px"></th>'+_ash('Stall name','name')+_ash('Markets','markets')+_ash('Total fee','fee')+_ash('Payment','payment')+'<th>Method</th><th></th></tr>';
  if(!list.length){tb.innerHTML='';cards.innerHTML='';empty.style.display='block';updateMetrics();return;}
  empty.style.display='none';
  tb.innerHTML=list.map(v=>{
    var fee=v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(v,m);},0);
    var chips=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<span class="chip">'+esc(m.name)+(m&&m.stallTypes&&m.stallTypes.length>1?' ('+stallTypeLabel(v,m)+')':'')+'</span>':''}).join('');
    var ps=calcPayStatus(v);
    var pb=ps==='paid'?'<span class="badge paid">Paid</span>':ps==='partial'?'<span class="badge partial">Partial</span>':'<span class="badge outstanding">Outstanding</span>';
    var method='<span style="color:var(--text3);font-size:12px">—</span>';
    var exp=state.expandedRows['appr_'+v.id];
    var rows='<tr><td><input type="checkbox" class="va-check" value="'+v.id+'"></td><td><button class="vendor-name-btn" onclick="toggleExpandApproved(\''+v.id+'\')" style="font-weight:500">'+esc(v.name)+'</button>'+(isVerified(v)?'<span class="badge" style="background:rgba(37,99,235,0.1);color:var(--blue);font-size:10px;margin-left:4px;vertical-align:middle">&#10003;</span>':'')+'<br><span style="font-size:11px;color:var(--text2)">'+esc(v.email)+'</span></td><td><div class="market-chips">'+(chips||'—')+'</div></td><td style="font-weight:500">R'+fee.toLocaleString()+'</td><td>'+pb+'</td><td>'+method+'</td><td><button onclick="openDotMenu(event,\''+v.id+'\')" style="background:none;border:0.5px solid var(--border);border-radius:6px;cursor:pointer;padding:4px 9px;font-size:16px;color:var(--text2);line-height:1">&#8942;</button></td></tr>';
    if(exp){
      var apprPhotos=v.images&&v.images.length?'<div style="grid-column:1/-1"><div class="field-label">Stall photos</div><div class="img-thumb-grid" style="margin-top:4px">'+v.images.map((src,i)=>'<div class="img-thumb clickable" onclick="openLightbox(\''+v.id+'\','+i+')"><img src="'+src+'"></div>').join('')+'</div></div>':'';
      rows+='<tr class="expand-row"><td colspan="7"><div class="expand-inner"><div style="grid-column:1/-1"><div class="field-label">Description</div><div class="field-value">'+esc(v.desc||'—')+'</div></div>'+_vendorCustomSection(v,true)+apprPhotos+'</div></td></tr>';
      rows+=v.markets.map(mid=>{
        var m=state.markets.find(x=>x.id===mid);
        var mp=(v.marketPayments||{})[mid];
        var mm=(v.marketMethods||{})[mid];
        var mpb=mp==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';
        var mmb=mm?'<span class="badge '+mm+'">'+mm.charAt(0).toUpperCase()+mm.slice(1)+'</span>':'<span style="color:var(--text3);font-size:12px">—</span>';
        return'<tr style="background:var(--bg2)"><td></td><td colspan="2" style="padding:8px 12px 8px 28px;font-size:12px;color:var(--text2)">&#8627; '+(m?esc(m.name):mid)+' <span style="color:var(--text3)">('+stallTypeLabel(v,m)+')</span></td><td style="padding:8px 12px;font-size:12px;font-weight:500">R'+getStallFee(v,m)+'</td><td style="padding:8px 12px">'+mpb+'</td><td style="padding:8px 12px">'+mmb+'</td><td></td></tr>';
      }).join('');
    }
    return rows;
  }).join('');
  cards.innerHTML=list.map(v=>{
    var fee=v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(v,m);},0);
    var chips=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?'<span class="chip">'+esc(m.name)+(m&&m.stallTypes&&m.stallTypes.length>1?' ('+stallTypeLabel(v,m)+')':'')+'</span>':''}).join('');
    var ps=calcPayStatus(v);
    var pb=ps==='paid'?'<span class="badge paid">Paid</span>':ps==='partial'?'<span class="badge partial">Partial</span>':'<span class="badge outstanding">Outstanding</span>';
    var exp=state.expandedRows['appr_'+v.id];
    var apprPhotosM=v.images&&v.images.length?'<div class="field-label" style="margin-top:8px;margin-bottom:4px">Stall photos</div><div class="img-thumb-grid">'+v.images.map((src,i)=>'<div class="img-thumb clickable" onclick="openLightbox(\''+v.id+'\','+i+')"><img src="'+src+'"></div>').join('')+'</div>':'';
    var expandContent=exp?'<div style="margin-top:10px;padding-top:10px;border-top:0.5px solid var(--border)"><div class="field-label">Description</div><div class="field-value" style="margin-bottom:8px">'+esc(v.desc||'—')+'</div>'+_vendorCustomSection(v,false)+apprPhotosM+'<div class="field-label" style="margin-top:8px;margin-bottom:4px">Markets &amp; stall types</div>'+v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);var mp=(v.marketPayments||{})[mid];var mm=(v.marketMethods||{})[mid];var mpb=mp==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';var mmb=mm?'<span class="badge '+mm+'">'+mm.charAt(0).toUpperCase()+mm.slice(1)+'</span>':'';return'<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:0.5px solid var(--border)"><span style="font-size:12px;color:var(--text2)">'+(m?esc(m.name):mid)+' <span style="color:var(--text3)">('+stallTypeLabel(v,m)+')</span></span><div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;font-weight:500;color:var(--text)">R'+getStallFee(v,m)+'</span>'+mpb+mmb+'</div></div>';}).join('')+'</div>':'';
    return'<div class="vendor-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="va-check" value="'+v.id+'"><div><button class="vendor-name-btn" onclick="toggleExpandApproved(\''+v.id+'\')" style="font-size:14px;font-weight:500">'+esc(v.name)+'</button>'+(isVerified(v)?'<span class="badge" style="background:rgba(37,99,235,0.1);color:var(--blue);font-size:10px;margin-top:2px;display:inline-block">&#10003;</span>':'')+'<div style="font-size:11px;color:var(--text2)">'+esc(v.email)+'</div></div></div><div style="display:flex;align-items:center;gap:6px">'+pb+'<button onclick="openDotMenu(event,\''+v.id+'\')" style="background:none;border:0.5px solid var(--border);border-radius:6px;cursor:pointer;padding:4px 8px;font-size:16px;color:var(--text2);line-height:1">&#8942;</button></div></div><div class="market-chips" style="margin-bottom:8px">'+(chips||'—')+'</div><span style="font-size:13px;font-weight:500;color:var(--text)">R'+fee.toLocaleString()+'</span>'+expandContent+'</div>';
  }).join('');
  updateMetrics();
}
function toggleExpandApproved(id){state.expandedRows['appr_'+id]=!state.expandedRows['appr_'+id];renderApproved();}
function sortPending(col){if(state.pendingSort.col===col)state.pendingSort.dir*=-1;else{state.pendingSort.col=col;state.pendingSort.dir=1;}renderPending();}
function sortApproved(col){if(state.approvedSort.col===col)state.approvedSort.dir*=-1;else{state.approvedSort.col=col;state.approvedSort.dir=1;}renderApproved();}

// ── DOT MENU ──────────────────────────────────────────────────────
function openDotMenu(e,vid){
  e.stopPropagation();
  state._menuVendorId=vid;
  var v=state.vendors.find(x=>x.id===vid);
  var menu=document.getElementById('dot-menu');
  document.getElementById('dot-menu-label').textContent=v?v.name:'';
  var isPaid=v&&calcPayStatus(v)==='paid';
  var rb=document.getElementById('dot-reminder-btn');
  rb.disabled=isPaid;rb.style.opacity=isPaid?'0.4':'';rb.style.cursor=isPaid?'not-allowed':'';
  menu.style.display='block';
  var rect=e.currentTarget.getBoundingClientRect();
  var top=rect.bottom+6,left=rect.right-200;
  if(left<8)left=8;
  if(top+200>window.innerHeight)top=rect.top-210;
  menu.style.top=top+'px';menu.style.left=left+'px';
}
document.addEventListener('click',function(e){var dm=document.getElementById('dot-menu');if(dm&&dm.style.display==='block'&&!dm.contains(e.target))dm.style.display='none';var mm=document.getElementById('mass-action-approved-menu');if(mm&&mm.style.display==='block'&&!mm.contains(e.target))mm.style.display='none';});

function dotMenuAction(action){
  document.getElementById('dot-menu').style.display='none';
  if(!state._menuVendorId){showToast('Vendor not found');return;}
  var v=state.vendors.find(x=>x.id===state._menuVendorId);
  if(!v){showToast('Vendor not found');return;}
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
  } else if(action==='reminder'){
    sendPaymentReminderEmail(v);
  } else if(action==='remove'){
    document.getElementById('remove-approved-name').textContent=v.name;
    document.getElementById('remove-approved-modal').classList.add('open');
  }
}

function buildReminderEmail(v){
  var outstanding=v.markets.filter(mid=>(v.marketPayments||{})[mid]!=='paid');
  var rows=outstanding.map(function(mid){var m=state.markets.find(x=>x.id===mid);if(!m)return'';return'<tr><td style="padding:6px 12px 6px 0">'+esc(m.name)+'</td><td style="padding:6px 0;font-weight:500">R'+getStallFee(v,m)+'</td></tr>';}).join('');
  var total=outstanding.reduce(function(t,mid){var m=state.markets.find(x=>x.id===mid);if(!m)return t;return t+getStallFee(v,m);},0);
  var paySection='';
  var hasPF=currentUser.payfastMerchantId&&currentUser.payfastMerchantKey;
  var hasBank=currentUser.bankHolder&&currentUser.bankName&&currentUser.bankAccNum;
  if(hasPF||hasBank){
    paySection='<p style="margin-top:16px"><strong>How to pay:</strong></p>';
    if(hasPF&&outstanding.length===1){var m=state.markets.find(x=>x.id===outstanding[0]);if(m){var url=pfUrl(v,m);paySection+='<p><a href="'+url+'" style="color:#2563eb">Pay via PayFast — R'+getStallFee(v,m)+'</a></p>';}}
    else if(hasPF){paySection+='<p>Pay via PayFast — your coordinator will send individual payment links for each market.</p>';}
    if(hasBank){paySection+='<p style="margin-top:12px"><strong>EFT / Bank transfer:</strong><br>'+'Account holder: <strong>'+esc(currentUser.bankHolder)+'</strong><br>'+'Bank: <strong>'+esc(currentUser.bankName)+'</strong><br>'+'Account number: <strong>'+esc(currentUser.bankAccNum)+'</strong>'+(currentUser.bankBranch?'<br>Branch code: <strong>'+esc(currentUser.bankBranch)+'</strong>':'')+(currentUser.bankAccType?'<br>Account type: <strong>'+esc(currentUser.bankAccType)+'</strong>':'')+'<br><em style="font-size:12px;color:#6b7280">Please use your stall name as the payment reference.</em></p>';}
  }
  var reminderIntro=currentUser.emailReminderIntro?'<p>'+esc(currentUser.emailReminderIntro).replace(/\n/g,'<br>')+'</p>':'<p>This is a friendly reminder that you have outstanding stall fees for <strong>'+esc(currentUser.market)+'</strong>.</p>';
  return'<p>Hi <strong>'+esc(v.name)+'</strong>,</p>'+reminderIntro+'<table style="border-collapse:collapse;margin:12px 0">'+rows+'<tr style="border-top:1px solid #e5e7eb"><td style="padding:8px 12px 4px 0;font-weight:600">Total outstanding</td><td style="padding:8px 0 4px;font-weight:600">R'+total+'</td></tr></table>'+paySection+'<p style="margin-top:16px">If you have any questions, feel free to reply to this email.</p><p>Thank you,<br><strong>'+esc(currentUser.market)+' team</strong></p>';
}

function sendPaymentReminderEmail(v){
  if(calcPayStatus(v)==='paid'){showToast('Vendor is fully paid');return;}
  var outstanding=v.markets.filter(mid=>(v.marketPayments||{})[mid]!=='paid');
  if(!outstanding.length){showToast('No outstanding markets');return;}
  sendEmail(v.email,'Payment reminder — '+currentUser.market,buildReminderEmail(v));
  showToast('Reminder sent to '+v.name);
}

function sendBulkPaymentReminders(){
  var outstanding=state.vendors.filter(v=>calcPayStatus(v)!=='paid');
  if(!outstanding.length){showToast('No outstanding vendors');return;}
  if(!confirm('Send payment reminder emails to '+outstanding.length+' vendor'+(outstanding.length===1?'':'s')+'?'))return;
  outstanding.forEach(function(v){sendEmail(v.email,'Payment reminder — '+currentUser.market,buildReminderEmail(v));});
  showToast('Reminders sent to '+outstanding.length+' vendor'+(outstanding.length===1?'':'s'));
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
async function setPayment(method){
  var mid=state._payMarketId;
  if(!mid)return;
  var ids=state._massVendorIds&&state._massVendorIds.length?state._massVendorIds:[state._menuVendorId];
  await Promise.all(ids.map(function(id){
    var v=state.vendors.find(x=>x.id===id);
    if(!v||!v.markets.includes(mid))return Promise.resolve();
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
    return sbSave('vendors',vendorToDb(v));
  }));
  state._massVendorIds=null;
  closeModal('pay-modal');
  renderApproved();
  updateMetrics();
}

// ── ADD / CREDIT / REMOVE ─────────────────────────────────────────
function onAddMarketChange(){var mid=document.getElementById('add-market-select').value;var info=document.getElementById('add-market-info');if(!mid){info.style.display='none';return;}var m=state.markets.find(x=>x.id===mid);var v=state.vendors.find(x=>x.id===state._menuVendorId);if(m&&v){var nf=m.fee||FEE;var existingTotal=v.markets.reduce((t,mid2)=>{var mx=state.markets.find(x=>x.id===mid2);return t+getStallFee(v,mx);},0);info.style.display='block';info.textContent='Vendor will be added to "'+m.name+'" at normal stall rate (R'+nf+'). Total fee updates to R'+(existingTotal+nf).toLocaleString()+'.';};}
async function confirmAddMarket(){var mid=document.getElementById('add-market-select').value;if(!mid){alert('Please select a market.');return;}var ids=state._massVendorIds&&state._massVendorIds.length?state._massVendorIds:[state._menuVendorId];await Promise.all(ids.map(function(id){var v=state.vendors.find(x=>x.id===id);if(!v)return Promise.resolve();if(!v.markets.includes(mid)){v.markets.push(mid);if(!v.marketPayments)v.marketPayments={};v.marketPayments[mid]='outstanding';}return sbSave('vendors',vendorToDb(v));}));state._massVendorIds=null;closeModal('add-market-modal');renderApproved();updateMetrics();}
function onCreditMarketChange(){var mid=document.getElementById('credit-market-select').value;var info=document.getElementById('credit-info');if(!mid){info.style.display='none';return;}var m=state.markets.find(x=>x.id===mid);var v=state.vendors.find(x=>x.id===state._menuVendorId);if(m&&v){info.style.display='block';info.textContent='Vendor will be moved to "'+m.name+'" and removed from all current markets. Payment status carries over.';};}
async function confirmCredit(){var mid=document.getElementById('credit-market-select').value;if(!mid){alert('Please select a market.');return;}var ids=state._massVendorIds&&state._massVendorIds.length?state._massVendorIds:[state._menuVendorId];await Promise.all(ids.map(function(id){var v=state.vendors.find(x=>x.id===id);if(!v)return Promise.resolve();v.markets=[mid];v.marketPayments={};v.marketPayments[mid]=v.payStatus==='paid'?'paid':'outstanding';return sbSave('vendors',vendorToDb(v));}));state._massVendorIds=null;closeModal('credit-modal');renderApproved();updateMetrics();}
async function confirmRemoveApproved(){var id=state._menuVendorId;var ok=await sbDel('vendors',id);if(!ok)return;state.vendors=state.vendors.filter(v=>v.id!==id);closeModal('remove-approved-modal');renderApproved();updateMetrics();}

// ── APPROVED MASS ACTIONS ─────────────────────────────────────────
function toggleAllApproved(cb){document.querySelectorAll('.va-check').forEach(c=>c.checked=cb.checked);}
function openMassActionApproved(e){
  e.stopPropagation();
  var ids=[...new Set(Array.from(document.querySelectorAll('.va-check:checked')).map(c=>c.value))];
  if(!ids.length){alert('Select at least one vendor first.');return;}
  var menu=document.getElementById('mass-action-approved-menu');
  document.getElementById('mass-action-approved-label').textContent=ids.length+' vendor'+(ids.length===1?' selected':' selected');
  menu.style.display='block';
  var rect=e.currentTarget.getBoundingClientRect();
  var top=rect.bottom+6,left=rect.right-200;
  if(left<8)left=8;
  if(top+250>window.innerHeight)top=rect.top-260;
  menu.style.top=top+'px';menu.style.left=left+'px';
}
function massActionApproved(action){
  document.getElementById('mass-action-approved-menu').style.display='none';
  var ids=[...new Set(Array.from(document.querySelectorAll('.va-check:checked')).map(c=>c.value))];
  if(!ids.length){showToast('No vendors selected');return;}
  state._massVendorIds=ids;
  if(action==='reminder'){
    var count=0;
    ids.forEach(function(id){var v=state.vendors.find(x=>x.id===id);if(v&&calcPayStatus(v)!=='paid'){sendEmail(v.email,'Payment reminder — '+currentUser.market,buildReminderEmail(v));count++;}});
    showToast(count?'Reminders sent to '+count+' vendor'+(count===1?'':'s'):'All selected vendors are fully paid');
    state._massVendorIds=null;
  } else if(action==='remove'){
    var names=ids.map(id=>{var v=state.vendors.find(x=>x.id===id);return v?v.name:null;}).filter(Boolean);
    document.getElementById('mass-remove-approved-list').innerHTML=names.map(n=>'<li style="padding:4px 0">'+esc(n)+'</li>').join('');
    document.getElementById('mass-remove-approved-modal').classList.add('open');
  } else if(action==='addmarket'){
    var sel=document.getElementById('add-market-select');
    sel.innerHTML='<option value="">Select a market...</option>'+state.markets.map(m=>'<option value="'+m.id+'">'+esc(m.name)+(m.published?'':' (draft)')+'</option>').join('');
    document.getElementById('add-market-vendor-name').textContent=ids.length+' vendors';
    document.getElementById('add-market-info').style.display='none';
    document.getElementById('add-market-modal').classList.add('open');
  } else if(action==='credit'){
    var sel2=document.getElementById('credit-market-select');
    sel2.innerHTML='<option value="">Select a market...</option>'+state.markets.map(m=>'<option value="'+m.id+'">'+esc(m.name)+(m.published?'':' (draft)')+'</option>').join('');
    document.getElementById('credit-vendor-name').textContent=ids.length+' vendors';
    document.getElementById('credit-info').style.display='none';
    document.getElementById('credit-modal').classList.add('open');
  } else if(action==='pay'){
    document.getElementById('pay-modal-name').textContent=ids.length+' vendors';
    document.getElementById('pay-step-1').style.display='block';
    document.getElementById('pay-step-2').style.display='none';
    document.getElementById('pay-step-1-info').style.display='none';
    var sel3=document.getElementById('pay-market-sel');
    sel3.innerHTML='<option value="">Choose a market...</option>'+state.markets.map(m=>'<option value="'+m.id+'">'+esc(m.name)+(m.published?'':' (draft)')+'</option>').join('');
    document.getElementById('pay-modal').classList.add('open');
  }
}
async function confirmMassRemoveApproved(){
  var ids=state._massVendorIds.slice();
  var results=await Promise.all(ids.map(function(id){return sbDel('vendors',id);}));
  var deleted=ids.filter(function(_,i){return results[i];});
  var failed=ids.length-deleted.length;
  state.vendors=state.vendors.filter(v=>!deleted.includes(v.id));
  state._massVendorIds=null;
  closeModal('mass-remove-approved-modal');
  renderApproved();
  updateMetrics();
  if(failed>0)showToast(failed+' delete'+(failed===1?' failed':' failed')+' — please try again.');
}

// ── PAST VENDORS ──────────────────────────────────────────────────
var _historyTab='vendors';
function renderHistory(tab){if(tab)_historyTab=tab;var pill=document.getElementById('hist-pill'),tvEl=document.getElementById('hist-tab-vendors'),tmEl=document.getElementById('hist-tab-markets');if(pill)pill.style.transform=_historyTab==='markets'?'translateX(100%)':'';if(tvEl)tvEl.style.color=_historyTab==='vendors'?'#fff':'var(--text2)';if(tmEl)tmEl.style.color=_historyTab==='markets'?'#fff':'var(--text2)';var vs=document.getElementById('hist-vendors-section'),ms=document.getElementById('hist-markets-section');if(vs)vs.style.display=_historyTab==='vendors'?'':'none';if(ms)ms.style.display=_historyTab==='markets'?'':'none';if(_historyTab==='vendors')renderVendorHistory();else renderMarketHistory();}
function _getVendorHistoryAggregated(filter){var vendorMap={};(state.archivedMarkets||[]).forEach(function(am){var vendors=(am.data&&am.data.vendors)||[];vendors.forEach(function(v){var key=(v.email||'').toLowerCase();if(!vendorMap[key])vendorMap[key]={name:v.name,email:v.email||'',markets:[]};vendorMap[key].markets.push({market_name:am.market_name,market_id:am.id,dates:am.market_dates||[],stall_type:v.stall_type,fee:v.fee,payment_status:v.payment_status,payment_method:v.payment_method,approved_at:v.approved_at,archived_at:am.archived_at});});});var list=Object.values(vendorMap);if(filter)list=list.filter(function(v){return v.name.toLowerCase().includes(filter.toLowerCase())||v.email.toLowerCase().includes(filter.toLowerCase());});list.sort(function(a,b){return a.name.toLowerCase()<b.name.toLowerCase()?-1:a.name.toLowerCase()>b.name.toLowerCase()?1:0;});return list;}
function renderVendorHistory(filter){filter=filter||'';var list=_getVendorHistoryAggregated(filter);var tb=document.getElementById('hist-v-tbody'),cards=document.getElementById('hist-v-cards'),empty=document.getElementById('hist-v-empty');if(!list.length){if(tb)tb.innerHTML='';if(cards)cards.innerHTML='';if(empty)empty.style.display='block';return;}if(empty)empty.style.display='none';var isV=function(email){return !!(state.verifiedEmails&&state.verifiedEmails.has((email||'').toLowerCase()));};if(tb){tb.innerHTML=list.map(function(v){var verBadge=isV(v.email)?'<span class="badge" style="background:rgba(37,99,235,0.1);color:var(--blue);font-size:10px;margin-left:4px">&#10003;</span>':'';var allDates=[];v.markets.forEach(function(mk){(mk.dates||[]).forEach(function(d){allDates.push(d);});});allDates.sort();var lastDate=allDates.length?allDates[allDates.length-1]:'—';return'<tr onclick="openArchivedVendorDetail(\''+esc(v.email)+'\')" style="cursor:pointer"><td><strong>'+esc(v.name)+'</strong>'+verBadge+'<br><span style="font-size:11px;color:var(--text2)">'+esc(v.email)+'</span></td><td><span class="badge" style="background:var(--blue-bg);color:var(--blue-text)">'+v.markets.length+' market'+(v.markets.length!==1?'s':'')+'</span></td><td style="color:var(--text2)">'+lastDate+'</td></tr>';}).join('');}if(cards){cards.innerHTML=list.map(function(v){var verBadge=isV(v.email)?'<span class="badge" style="background:rgba(37,99,235,0.1);color:var(--blue);font-size:10px;margin-left:4px">&#10003;</span>':'';var allDates=[];v.markets.forEach(function(mk){(mk.dates||[]).forEach(function(d){allDates.push(d);});});allDates.sort();var lastDate=allDates.length?allDates[allDates.length-1]:'—';return'<div class="vendor-card" onclick="openArchivedVendorDetail(\''+esc(v.email)+'\')" style="cursor:pointer"><div class="vendor-card-header"><div class="vendor-card-name">'+esc(v.name)+verBadge+'</div></div><div class="vendor-card-meta">'+v.markets.length+' market'+(v.markets.length!==1?'s':'')+' &middot; Last: '+lastDate+'</div></div>';}).join('');}
}
function renderMarketHistory(){var list=state.archivedMarkets||[];var el=document.getElementById('hist-m-list'),empty=document.getElementById('hist-m-empty');if(!list.length){if(el)el.innerHTML='';if(empty)empty.style.display='block';return;}if(empty)empty.style.display='none';if(el){el.innerHTML=list.map(function(am){var dates=(am.market_dates||[]).join(' · ')||'—';var vCount=(am.data&&am.data.vendors)?am.data.vendors.length:0;var archived=am.archived_at?am.archived_at.slice(0,10):'';return'<div class="card" style="margin-bottom:1rem;cursor:pointer" onclick="openArchivedMarketDetail(\''+am.id+'\')"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div><strong style="font-size:15px">'+esc(am.market_name)+'</strong><div style="font-size:12px;color:var(--text2);margin-top:2px">'+dates+'</div></div><div style="display:flex;align-items:center;gap:8px"><span class="badge" style="background:var(--blue-bg);color:var(--blue-text)">'+vCount+' vendor'+(vCount!==1?'s':'')+'</span><span style="font-size:11px;color:var(--text3)">Archived '+archived+'</span><span style="font-size:12px;color:var(--text3)">&#8250;</span></div></div></div>';}).join('');}
}
function openArchivedMarketDetail(id){var am=state.archivedMarkets.find(function(x){return x.id===id;});if(!am)return;var d=am.data||{};var vendors=d.vendors||[];var dates=(am.market_dates||[]).join(' · ')||'—';var archived=am.archived_at?am.archived_at.slice(0,10):'';var paidCount=vendors.filter(function(v){return v.payment_status==='paid';}).length;var totalRev=vendors.reduce(function(s,v){return s+Number(v.fee||0);},0);var paidRev=vendors.filter(function(v){return v.payment_status==='paid';}).reduce(function(s,v){return s+Number(v.fee||0);},0);var html='<div class="card" style="margin-bottom:1.25rem"><h2 style="margin:0 0 4px;font-size:20px">'+esc(am.market_name)+'</h2><div style="font-size:13px;color:var(--text2);margin-bottom:12px">'+dates+'</div><div class="metric-grid"><div class="metric"><div class="metric-label">Vendors</div><div class="metric-value blue">'+vendors.length+'</div></div><div class="metric"><div class="metric-label">Paid</div><div class="metric-value green" style="font-size:16px">'+paidCount+' / '+vendors.length+'</div></div><div class="metric"><div class="metric-label">Revenue collected</div><div class="metric-value" style="font-size:16px">R'+paidRev.toLocaleString()+'</div></div><div class="metric"><div class="metric-label">Expected revenue</div><div class="metric-value" style="font-size:16px">R'+totalRev.toLocaleString()+'</div></div></div><div style="font-size:11px;color:var(--text3);margin-top:10px">Archived '+archived+'</div></div>';if(vendors.length){html+='<div class="card" style="margin-bottom:1.25rem"><h3 style="margin-bottom:1rem">Vendors</h3><table class="vendor-table desktop-table"><thead><tr><th>Vendor</th><th>Stall type</th><th>Fee</th><th>Payment</th><th>Method</th></tr></thead><tbody>';html+=vendors.map(function(v){var pb=v.payment_status==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';var mb=v.payment_method?'<span class="badge '+esc(v.payment_method)+'">'+esc(v.payment_method.charAt(0).toUpperCase()+v.payment_method.slice(1))+'</span>':'<span style="color:var(--text3);font-size:12px">—</span>';return'<tr><td><strong>'+esc(v.name)+'</strong><br><span style="font-size:11px;color:var(--text2)">'+esc(v.email)+'</span></td><td>'+esc(v.stall_type||'—')+'</td><td>R'+Number(v.fee||0).toLocaleString()+'</td><td>'+pb+'</td><td>'+mb+'</td></tr>';}).join('');html+='</tbody></table><div class="mobile-cards">'+vendors.map(function(v){var pb=v.payment_status==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';return'<div class="vendor-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><strong>'+esc(v.name)+'</strong>'+pb+'</div><div style="font-size:11px;color:var(--text2)">'+esc(v.email)+'</div><div style="font-size:11px;color:var(--text2);margin-top:2px">'+esc(v.stall_type||'—')+' — R'+Number(v.fee||0).toLocaleString()+'</div></div>';}).join('')+'</div></div>';}else{html+='<div class="card"><div class="empty-state">No vendors were approved for this market.</div></div>';}document.getElementById('md-content').innerHTML=html;document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});document.querySelectorAll('.nav-tab').forEach(function(el){el.classList.remove('active');});document.querySelectorAll('.bottom-nav-item').forEach(function(el){el.classList.remove('active');});document.querySelectorAll('.sidebar-item').forEach(function(el){el.classList.remove('active');});document.getElementById('page-market-detail').classList.add('active');var nt5=document.querySelectorAll('.nav-tab')[5];if(nt5)nt5.classList.add('active');var bn5=document.querySelectorAll('.bottom-nav-item')[5];if(bn5)bn5.classList.add('active');var si5=document.querySelectorAll('.sidebar-item')[5];if(si5)si5.classList.add('active');window.scrollTo(0,0);}
async function openArchivedVendorDetail(email){var list=_getVendorHistoryAggregated();var vd=list.find(function(v){return(v.email||'').toLowerCase()===(email||'').toLowerCase();});if(!vd)return;var profileData=null;if(state.verifiedEmails&&state.verifiedEmails.has((email||'').toLowerCase())){var{data:vp}=await _sb.from('vendor_profiles').select('stall_name,what_you_sell,images').eq('email',(email||'').toLowerCase()).maybeSingle();if(vp)profileData=vp;}var isV=state.verifiedEmails&&state.verifiedEmails.has((email||'').toLowerCase());var verBadge=isV?'<span class="badge" style="background:rgba(37,99,235,0.1);color:var(--blue);font-size:11px;margin-left:6px">&#10003;</span>':'';var html='<div class="card" style="margin-bottom:1.25rem">';var photos=(profileData&&profileData.images&&profileData.images.length)?profileData.images:[];if(photos.length){html+='<div class="img-thumb-grid" style="margin:0 0 1rem">'+photos.slice(0,4).map(function(src){return'<div class="img-thumb"><img src="'+src+'"></div>';}).join('')+'</div>';}html+='<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px"><h2 style="margin:0;font-size:20px">'+esc(vd.name)+'</h2>'+verBadge+'</div>';html+='<div style="font-size:13px;color:var(--text2);margin-bottom:8px">'+esc(vd.email)+'</div>';var descText=(profileData&&profileData.what_you_sell)||'';if(descText)html+='<p style="font-size:13px;color:var(--text);line-height:1.6">'+esc(descText)+'</p>';html+='</div>';html+='<div class="card" style="margin-bottom:1.25rem"><h3 style="margin-bottom:1rem">Market history</h3>';var mks=vd.markets.slice().sort(function(a,b){var ad=(a.dates&&a.dates.length)?a.dates[0]:'';var bd=(b.dates&&b.dates.length)?b.dates[0]:'';return ad<bd?1:ad>bd?-1:0;});html+='<table class="vendor-table desktop-table"><thead><tr><th>Market</th><th>Dates</th><th>Stall type</th><th>Fee</th><th>Payment</th><th>Method</th></tr></thead><tbody>';html+=mks.map(function(mk){var pb=mk.payment_status==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';var mb=mk.payment_method?'<span class="badge '+esc(mk.payment_method)+'">'+esc(mk.payment_method.charAt(0).toUpperCase()+mk.payment_method.slice(1))+'</span>':'<span style="color:var(--text3);font-size:12px">—</span>';var dates=(mk.dates&&mk.dates.length)?mk.dates.join(' · '):'—';return'<tr><td><strong>'+esc(mk.market_name)+'</strong></td><td style="color:var(--text2);font-size:12px">'+dates+'</td><td>'+esc(mk.stall_type||'—')+'</td><td>R'+Number(mk.fee||0).toLocaleString()+'</td><td>'+pb+'</td><td>'+mb+'</td></tr>';}).join('');html+='</tbody></table>';html+='<div class="mobile-cards">'+mks.map(function(mk){var pb=mk.payment_status==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';var dates=(mk.dates&&mk.dates.length)?mk.dates.join(', '):'—';return'<div class="vendor-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><strong>'+esc(mk.market_name)+'</strong>'+pb+'</div><div style="font-size:11px;color:var(--text2);margin-bottom:2px">'+dates+'</div><div style="font-size:11px;color:var(--text2)">R'+Number(mk.fee||0).toLocaleString()+(mk.payment_method?' &middot; '+mk.payment_method.charAt(0).toUpperCase()+mk.payment_method.slice(1):'')+'</div></div>';}).join('')+'</div>';html+='</div>';document.getElementById('vd-content').innerHTML=html;document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});document.querySelectorAll('.nav-tab').forEach(function(el){el.classList.remove('active');});document.querySelectorAll('.bottom-nav-item').forEach(function(el){el.classList.remove('active');});document.querySelectorAll('.sidebar-item').forEach(function(el){el.classList.remove('active');});document.getElementById('page-vendor-detail').classList.add('active');var nt5=document.querySelectorAll('.nav-tab')[5];if(nt5)nt5.classList.add('active');var bn5=document.querySelectorAll('.bottom-nav-item')[5];if(bn5)bn5.classList.add('active');var si5=document.querySelectorAll('.sidebar-item')[5];if(si5)si5.classList.add('active');window.scrollTo(0,0);}
async function purgeHistory(){if(!state.archivedMarkets||!state.archivedMarkets.length){showToast('No history to purge.');return;}if(!confirm('Permanently delete ALL archived market history? This cannot be undone.'))return;var{error}=await _sb.from('archived_markets').delete().eq('user_id',currentUser.id);if(error){alert('Failed to purge history. Please try again.');return;}state.archivedMarkets=[];renderHistory();showToast('History purged.');}

// ── MARKET DASHBOARD ──────────────────────────────────────────────
function openMarketDashboard(mid){
  var m=state.markets.find(x=>x.id===mid);if(!m)return;
  var approvedVendors=state.vendors.filter(v=>v.status==='approved'&&v.markets.includes(mid));
  var pendingVendors=state.vendors.filter(v=>v.status==='pending'&&v.markets.includes(mid));
  var paidVendors=approvedVendors.filter(v=>(v.marketPayments||{})[mid]==='paid');
  var rev=approvedVendors.reduce((s,v)=>s+getStallFee(v,m),0);
  var revPaid=paidVendors.reduce((s,v)=>s+getStallFee(v,m),0);
  var cap=m.capacity||30,capPct=Math.min(100,Math.round((approvedVendors.length/cap)*100));
  var capColor=capPct>=90?'red':capPct>=70?'amber':'green';
  var bi=m.banner?'<img src="'+esc(m.banner)+'">':esc(m.header||m.name);
  var html='<div class="market-card" style="margin-bottom:1.5rem"><div class="market-banner" style="height:140px">'+bi+'</div><div class="market-body"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><strong style="font-size:17px">'+esc(m.name)+'</strong>'+(m.published?'<span class="published-badge on"><span class="dot green"></span> Published</span>':'<span class="published-badge off"><span class="dot gray"></span> Draft</span>')+'</div><p style="font-size:13px;margin:6px 0 8px">'+esc(m.desc||'')+'</p><div class="date-chips">'+m.dates.map(d=>'<span class="date-chip">'+d+'</span>').join('')+'</div></div></div>';
  html+='<div class="metric-grid" style="margin-bottom:1.25rem"><div class="metric"><div class="metric-label">Vendors approved</div><div class="metric-value blue">'+approvedVendors.length+'</div></div><div class="metric"><div class="metric-label">Expected revenue</div><div class="metric-value green" style="font-size:16px">R'+rev.toLocaleString()+'</div></div><div class="metric"><div class="metric-label">Revenue collected</div><div class="metric-value" style="font-size:16px">R'+revPaid.toLocaleString()+'</div></div><div class="metric"><div class="metric-label">Waitlisted</div><div class="metric-value amber">'+pendingVendors.length+'</div></div></div>';
  html+='<div class="card" style="margin-bottom:1rem"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;font-weight:500;color:var(--text)">Stall capacity</span><span style="font-size:13px;color:var(--text2)">'+approvedVendors.length+' / '+cap+' stalls</span></div><div class="progress-wrap"><div class="progress-bar '+capColor+'" style="width:'+capPct+'%"></div></div><div style="font-size:11px;color:var(--text3);margin-top:6px">'+capPct+'% full &nbsp;·&nbsp; '+(cap-approvedVendors.length)+' stalls remaining</div></div>';
  html+='<div class="card" style="margin-bottom:1rem"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;font-weight:500;color:var(--text)">Payment status</span><span style="font-size:13px;color:var(--text2)">'+paidVendors.length+' paid / '+(approvedVendors.length-paidVendors.length)+' outstanding</span></div><div class="progress-wrap"><div class="progress-bar" style="width:'+(approvedVendors.length?Math.round((paidVendors.length/approvedVendors.length)*100):0)+'%"></div></div><div style="font-size:11px;color:var(--text3);margin-top:6px">R'+revPaid.toLocaleString()+' of R'+rev.toLocaleString()+' collected</div></div>';
  html+='<div class="card" style="margin-bottom:1rem"><h3 style="margin-bottom:1rem">Vendors attending</h3>';
  if(approvedVendors.length){
    html+='<table class="vendor-table desktop-table"><thead><tr><th style="width:36px">Attended</th><th>Stall name</th><th>Email</th><th>Stall type</th><th>Fee</th><th>Payment</th><th></th></tr></thead><tbody>'+approvedVendors.map(v=>{var mp=(v.marketPayments||{})[mid];var attended=(v.marketAttendance||{})[mid];var pb=mp==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';return'<tr><td style="text-align:center"><input type="checkbox" '+(attended?'checked':'')+' onchange="toggleAttendance(\''+v.id+'\',\''+mid+'\')" style="width:16px;height:16px;accent-color:var(--blue);cursor:pointer"></td><td><strong>'+esc(v.name)+'</strong></td><td style="color:var(--text2)">'+esc(v.email)+'</td><td>'+stallTypeBadge(v,m)+'</td><td>R'+getStallFee(v,m)+'</td><td>'+pb+'</td><td><button onclick="removeFromMarket(\''+v.id+'\',\''+mid+'\')" style="background:none;border:0.5px solid var(--red);border-radius:6px;cursor:pointer;padding:4px 8px;font-size:12px;color:var(--red)">Remove</button></td></tr>';}).join('')+'</tbody></table>'
      +'<div class="mobile-cards">'+approvedVendors.map(v=>{var mp=(v.marketPayments||{})[mid];var attended=(v.marketAttendance||{})[mid];var pb=mp==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge outstanding">Outstanding</span>';return'<div class="vendor-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><strong>'+esc(v.name)+'</strong>'+pb+'</div><div style="font-size:11px;color:var(--text2);margin-bottom:4px">'+esc(v.email)+'</div><div style="font-size:11px;color:var(--text2);margin-bottom:12px">'+stallTypeLabel(v,m)+' — R'+getStallFee(v,m)+'</div><div style="display:flex;justify-content:space-between;align-items:center"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" '+(attended?'checked':'')+' onchange="toggleAttendance(\''+v.id+'\',\''+mid+'\')" style="width:18px;height:18px;accent-color:var(--blue);cursor:pointer"><span style="font-size:13px;color:var(--text2)">Attended</span></label><button onclick="removeFromMarket(\''+v.id+'\',\''+mid+'\')" style="background:none;border:0.5px solid var(--red);border-radius:6px;cursor:pointer;padding:5px 10px;font-size:12px;color:var(--red)">Remove</button></div></div>';}).join('')+'</div>';
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
  document.querySelectorAll('.sidebar-item').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-market-dash').classList.add('active');
  document.querySelectorAll('.nav-tab')[2].classList.add('active');
  document.querySelectorAll('.bottom-nav-item')[2].classList.add('active');
  document.querySelectorAll('.sidebar-item')[2].classList.add('active');
  window.scrollTo(0,0);
}
async function toggleAttendance(vid,mid){var v=state.vendors.find(x=>x.id===vid);if(!v)return;if(!v.marketAttendance)v.marketAttendance={};v.marketAttendance[mid]=!v.marketAttendance[mid];await sbSave('vendors',vendorToDb(v));openMarketDashboard(mid);}
async function removeFromMarket(vid,mid){var v=state.vendors.find(x=>x.id===vid);if(!v)return;v.markets=v.markets.filter(x=>x!==mid);if(v.marketPayments)delete v.marketPayments[mid];if(!v.markets.length){await sbDel('vendors',vid);state.vendors=state.vendors.filter(x=>x.id!==vid);}else{await sbSave('vendors',vendorToDb(v));}openMarketDashboard(mid);}
async function quickApprove(vid,mid){var v=state.vendors.find(x=>x.id===vid);if(!v)return;var otherMarkets=v.markets.filter(x=>x!==mid);var existing=state.vendors.find(x=>x.id!==vid&&x.status==='approved'&&x.email===v.email);if(existing){if(!existing.markets.includes(mid))existing.markets.push(mid);if(!existing.marketPayments)existing.marketPayments={};existing.marketPayments[mid]='outstanding';await sbSave('vendors',vendorToDb(existing));if(otherMarkets.length>0){v.markets=otherMarkets;await sbSave('vendors',vendorToDb(v));}else{await sbDel('vendors',v.id);state.vendors=state.vendors.filter(x=>x.id!==vid);}}else if(otherMarkets.length>0){var nv={id:uid(),name:v.name,desc:v.desc,email:v.email,markets:[mid],images:v.images,status:'approved',payStatus:'outstanding',payMethod:null,marketPayments:{},submitted:v.submitted,approvedAt:new Date().toISOString().slice(0,10)};nv.marketPayments[mid]='outstanding';state.vendors.push(nv);await sbSave('vendors',vendorToDb(nv));v.markets=otherMarkets;await sbSave('vendors',vendorToDb(v));}else{if(!v.markets.includes(mid))v.markets.push(mid);v.status='approved';v.payStatus='outstanding';v.payMethod=null;v.marketPayments={};v.marketPayments[mid]='outstanding';v.approvedAt=new Date().toISOString().slice(0,10);await sbSave('vendors',vendorToDb(v));}var _qaM=state.markets.find(x=>x.id===mid);var _qaPaySection='';var _qaPF=currentUser.payfastMerchantId&&currentUser.payfastMerchantKey;var _qaBank=currentUser.bankHolder&&currentUser.bankName&&currentUser.bankAccNum;if(_qaPF){var _qaUrl=pfUrl(v,_qaM);if(_qaUrl)_qaPaySection='<p>Please pay your stall fee using the link below:</p><p><strong>'+esc(_qaM?_qaM.name:mid)+'</strong> — R'+getStallFee(v,_qaM)+': <a href="'+_qaUrl+'" style="color:#2563eb">Pay now</a></p><p style="font-size:12px;color:#666">Payments are processed securely via PayFast.</p>';}if(_qaBank){_qaPaySection+='<p style="margin-top:12px"><strong>EFT / Bank transfer:</strong><br>'+'Account holder: <strong>'+esc(currentUser.bankHolder)+'</strong><br>'+'Bank: <strong>'+esc(currentUser.bankName)+'</strong><br>'+'Account number: <strong>'+esc(currentUser.bankAccNum)+'</strong>'+(currentUser.bankBranch?'<br>Branch code: <strong>'+esc(currentUser.bankBranch)+'</strong>':'')+(currentUser.bankAccType?'<br>Account type: <strong>'+esc(currentUser.bankAccType)+'</strong>':'')+'<br><em style="font-size:12px;color:#6b7280">Please use your stall name as the payment reference.</em></p>';}if(!_qaPaySection)_qaPaySection='<p>The coordinator will be in touch with payment details. Please ensure your stall fee is paid before the market date.</p>';sendEmail(v.email,'You\'ve been approved — '+currentUser.market,'<p>Hi '+esc(v.name)+',</p><p>Great news! Your vendor application has been approved for the following market:</p><p><strong>'+esc(_qaM?_qaM.name:mid)+'</strong></p>'+_qaPaySection+'<p>Thanks,<br>'+esc(currentUser.market)+'</p>');updateMetrics();openMarketDashboard(mid);}
function openNotes(mid){state.notesMarketId=mid;var m=state.markets.find(x=>x.id===mid);document.getElementById('notes-input').value=m?(m.notes||''):'';document.getElementById('notes-modal').classList.add('open');}
async function saveNotes(){var m=state.markets.find(x=>x.id===state.notesMarketId);if(m){m.notes=document.getElementById('notes-input').value;await sbSave('markets',marketToDb(m));}closeModal('notes-modal');openMarketDashboard(state.notesMarketId);}

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
    var bi=m.banner?'<img src="'+esc(m.banner)+'">':esc(m.header||m.name);
    var today=new Date().toISOString().slice(0,10);var dlClosed=m.deadline&&m.deadline<today;var deadlineHtml=m.deadline?'<div style="margin-top:6px;font-size:11px;color:'+(dlClosed?'var(--red)':'var(--text3)')+'">'+(dlClosed?'Applications closed ('+m.deadline+')':'Applications close '+m.deadline)+'</div>':'';
    return'<div class="market-card"><div class="market-banner">'+bi+'</div><div class="market-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px"><strong style="font-size:15px">'+esc(m.name)+'</strong>'+pub+'</div><p style="font-size:13px;margin-bottom:8px">'+esc(m.desc||'')+'</p><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;color:var(--text2)">Capacity</span><span style="font-size:12px;color:var(--text2)">'+appr+'/'+cap+' stalls</span></div><div class="progress-wrap"><div class="progress-bar '+(pct>=90?'red':pct>=70?'amber':'green')+'" style="width:'+pct+'%"></div></div><div class="date-chips" style="margin-top:10px">'+dates+'</div>'+deadlineHtml+'</div><div class="market-footer"><div class="btn-row"><button class="btn small primary" onclick="openMarketDashboard(\''+m.id+'\')">View dashboard</button><button class="btn small" onclick="duplicateMarket(\''+m.id+'\')">Duplicate</button><button class="btn small" onclick="openMarketModal(\''+m.id+'\')" '+(m.published?'disabled title="Unpublish this market first to edit it"':'')+'>Edit</button><button class="btn small '+(m.published?'danger':'success')+'" onclick="togglePublish(\''+m.id+'\')">'+(m.published?'Unpublish':'Publish')+'</button><button id="archive-btn-'+m.id+'" class="btn small danger" onclick="archiveMarket(\''+m.id+'\')">Archive</button></div><span style="font-size:11px;color:var(--text2)">'+m.dates.length+' date'+(m.dates.length!==1?'s':'')+'</span></div></div>';
  }).join('');
}
async function duplicateMarket(id){var m=state.markets.find(x=>x.id===id);if(!m)return;var copy=Object.assign({},m,{id:uid(),name:m.name+' (copy)',published:false,notes:'',stallTypes:(m.stallTypes||[]).map(t=>({...t}))});state.markets.push(copy);await sbSave('markets',marketToDb(copy));renderMarkets();updateMetrics();}
async function togglePublish(id){var m=state.markets.find(x=>x.id===id);if(m){m.published=!m.published;await sbSave('markets',marketToDb(m));}renderMarkets();updateMetrics();}
async function archiveMarket(id){var m=state.markets.find(function(x){return x.id===id;});if(!m)return;var _btn=document.getElementById('archive-btn-'+id);if(!confirm('Archive "'+esc(m.name)+'"?\n\nThis will snapshot all vendor and payment data, then remove the market. The archive cannot be undone from this dialog — use "Purge All History" on the History page to delete archived data.'))return;if(_btn){_btn.textContent='Archiving…';_btn.disabled=true;}var approvedVendors=state.vendors.filter(function(v){return v.status==='approved'&&v.markets.includes(id);});var snapshot={fee:m.fee,stall_types:m.stallTypes||[],capacity:m.capacity||0,notes:m.notes||'',vendors:approvedVendors.map(function(v){return{name:v.name,email:(v.email||'').toLowerCase(),stall_type:stallTypeLabel(v,m),fee:getStallFee(v,m),payment_status:(v.marketPayments||{})[id]||'outstanding',payment_method:(v.marketMethods||{})[id]||null,approved_at:v.approvedAt||null};})};var{data:archived,error:archErr}=await _sb.from('archived_markets').insert({user_id:currentUser.id,market_name:m.name,market_dates:m.dates||[],data:snapshot}).select().single();if(archErr){if(_btn){_btn.textContent='Archive';_btn.disabled=false;}alert('Failed to archive market. Please try again.');return;}var toDelete=[],toUpdate=[];approvedVendors.forEach(function(v){var newMarkets=v.markets.filter(function(mid){return mid!==id;});var newPayments=Object.assign({},v.marketPayments||{});delete newPayments[id];var newMethods=Object.assign({},v.marketMethods||{});delete newMethods[id];var newStallTypes=Object.assign({},v.marketStallTypes||{});delete newStallTypes[id];var newAttendance=Object.assign({},v.marketAttendance||{});delete newAttendance[id];if(newMarkets.length===0){toDelete.push(v.id);}else{toUpdate.push(Object.assign({},v,{markets:newMarkets,marketPayments:newPayments,marketMethods:newMethods,marketStallTypes:newStallTypes,marketAttendance:newAttendance}));}});var ops=[];if(toDelete.length)ops.push(_sb.from('vendors').delete().in('id',toDelete));toUpdate.forEach(function(v){ops.push(sbSave('vendors',vendorToDb(v)));});ops.push(sbDel('markets',id));await Promise.all(ops);if(toDelete.length)state.vendors=state.vendors.filter(function(x){return!toDelete.includes(x.id);});toUpdate.forEach(function(v){var idx=state.vendors.findIndex(function(x){return x.id===v.id;});if(idx!==-1)state.vendors[idx]=v;});state.markets=state.markets.filter(function(x){return x.id!==id;});if(archived)state.archivedMarkets.unshift(archived);renderMarkets();renderApproved();updateMetrics();showToast('Market archived.');}
function handleBannerUpload(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){state._tempBanner=ev.target.result;document.getElementById('banner-preview').src=ev.target.result;document.getElementById('banner-preview').style.display='block';document.getElementById('banner-upload-prompt').style.display='none';document.getElementById('banner-remove-btn').style.display='inline-flex';};r.readAsDataURL(file);}
function removeBanner(){state._tempBanner=null;document.getElementById('banner-preview').style.display='none';document.getElementById('banner-preview').src='';document.getElementById('banner-upload-prompt').style.display='block';document.getElementById('banner-remove-btn').style.display='none';}
function openMarketModal(id){if(id){var chk=state.markets.find(x=>x.id===id);if(chk&&chk.published){alert('This market is published. Unpublish it first before making edits.');return;}}state.editMarketId=id;var m=id?state.markets.find(x=>x.id===id):null;document.getElementById('market-form-title').textContent=m?'Edit market':'New market';document.getElementById('m-name').value=m?m.name:'';document.getElementById('m-desc').value=m?(m.desc||''):'';document.getElementById('m-header').value=m?(m.header||''):'';state._tempStallTypes=m&&m.stallTypes&&m.stallTypes.length?m.stallTypes.map(t=>({...t})):defaultStallTypes(m?m.fee:FEE);document.getElementById('m-capacity').value=m?(m.capacity||30):30;document.getElementById('m-deadline').value=m?(m.deadline||''):'';document.getElementById('m-start-time').value=m?(m.startTime||''):'';document.getElementById('m-end-time').value=m?(m.endTime||''):'';state._tempDates=m?[...m.dates]:[];state._tempBanner=m?(m.banner||null):null;var prev=document.getElementById('banner-preview'),prompt=document.getElementById('banner-upload-prompt'),rb=document.getElementById('banner-remove-btn');if(state._tempBanner){prev.src=state._tempBanner;prev.style.display='block';prompt.style.display='none';rb.style.display='inline-flex';}else{prev.src='';prev.style.display='none';prompt.style.display='block';rb.style.display='none';}renderDateList();renderStallTypeList();showPage('market-form');}
function addDate(){var val=document.getElementById('m-date-pick').value;if(!val)return;if(!state._tempDates.includes(val))state._tempDates.push(val);document.getElementById('m-date-pick').value='';renderDateList();}
function removeDate(d){state._tempDates=state._tempDates.filter(x=>x!==d);renderDateList();}
function renderDateList(){document.getElementById('m-date-list').innerHTML=state._tempDates.map(d=>'<span class="date-chip" style="cursor:pointer" onclick="removeDate(\''+d+'\')">'+d+' &#x2715;</span>').join('');}
function renderStallTypeList(){var el=document.getElementById('stall-type-list');if(!el)return;el.innerHTML=state._tempStallTypes.map(function(t,i){var swatches=STALL_COLORS.map(c=>'<button type="button" onclick="setStallTypeColor('+i+',\''+c+'\')" style="width:22px;height:22px;border-radius:50%;background:'+c+';border:'+(t.color===c?'2.5px solid var(--text)':'1.5px solid transparent')+';cursor:pointer;padding:0;flex-shrink:0"></button>').join('');var canDelete=state._tempStallTypes.length>1;return'<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;padding:10px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg3)"><div style="width:10px;height:10px;border-radius:50%;background:'+(t.color||'#6b7280')+';flex-shrink:0;margin-top:15px"></div><div style="flex:1"><div style="display:flex;gap:8px;margin-bottom:8px"><input class="form-input" type="text" placeholder="Type name e.g. Normal stall" value="'+esc(t.name||'')+'" oninput="updateStallTypeName('+i+',this.value)" style="flex:1"><input class="form-input" type="number" placeholder="Fee (R)" value="'+(t.fee||'')+'" oninput="updateStallTypeFee('+i+',this.value)" style="width:95px" inputmode="numeric" min="0"></div><div style="display:flex;gap:4px;flex-wrap:wrap">'+swatches+'</div></div>'+(i===0?'<span style="font-size:10px;color:var(--text3);flex-shrink:0;margin-top:14px;white-space:nowrap">Default</span>':'')+(canDelete?'<button type="button" onclick="removeStallType('+i+')" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:18px;padding:4px;flex-shrink:0">&#x2715;</button>':'')+'</div>';}).join('');}
function addStallType(){state._tempStallTypes.push({id:'st-'+Date.now(),name:'',fee:state._tempStallTypes[0]?state._tempStallTypes[0].fee:FEE,color:'#6b7280'});renderStallTypeList();}
function removeStallType(i){if(state._tempStallTypes.length<=1)return;state._tempStallTypes.splice(i,1);renderStallTypeList();}
function updateStallTypeName(i,val){state._tempStallTypes[i].name=val;}
function updateStallTypeFee(i,val){state._tempStallTypes[i].fee=parseInt(val)||0;}
function setStallTypeColor(i,color){state._tempStallTypes[i].color=color;renderStallTypeList();}
async function saveMarket(){var name=document.getElementById('m-name').value.trim();if(!name){alert('Market name is required.');return;}var stallTypesVal=state._tempStallTypes.filter(t=>t.name&&t.name.trim()).map(t=>({id:t.id||('st-'+Date.now()),name:t.name.trim(),fee:t.fee||FEE,color:t.color||'#6b7280'}));if(!stallTypesVal.length)stallTypesVal=defaultStallTypes(FEE);var m={id:state.editMarketId||uid(),name,desc:document.getElementById('m-desc').value.trim(),header:document.getElementById('m-header').value.trim(),fee:stallTypesVal[0].fee,stallTypes:stallTypesVal,capacity:parseInt(document.getElementById('m-capacity').value)||30,dates:[...state._tempDates],deadline:document.getElementById('m-deadline').value||null,startTime:document.getElementById('m-start-time').value||null,endTime:document.getElementById('m-end-time').value||null,banner:state._tempBanner||null,published:false,notes:''};if(state.editMarketId){var i=state.markets.findIndex(x=>x.id===state.editMarketId);m.published=state.markets[i].published;m.notes=state.markets[i].notes||'';state.markets[i]=m;}else state.markets.push(m);await sbSave('markets',marketToDb(m));showPage('markets');renderMarkets();updateMetrics();}

// ── PUBLIC / MARKET INDEX ─────────────────────────────────────────
function renderPublic(){renderPubMarkets();renderVendorFormMarkets();_updateDashboardFormPreview();}
function renderPubMarkets(){var pub=state.markets.filter(m=>m.published);var el=document.getElementById('pub-markets-list'),empty=document.getElementById('pub-markets-empty');if(!pub.length){el.innerHTML='';empty.style.display='block';return;}empty.style.display='none';var today=new Date().toISOString().slice(0,10);el.innerHTML=pub.map(m=>{var dates=m.dates.map(d=>'<span class="date-chip">'+d+'</span>').join('');var bi=m.banner?'<img src="'+esc(m.banner)+'">':esc(m.header||m.name);var closed=m.deadline&&m.deadline<today;var deadlineHtml=m.deadline?'<span style="font-size:11px;color:'+(closed?'var(--red)':'var(--text3)')+'">'+(closed?'Applications closed':'Apply by '+m.deadline)+'</span>':'';var applyBtn=closed?'<span style="font-size:12px;color:var(--red)">Applications closed</span>':'<button class="btn small primary" onclick="pubTab(\'apply\')">Apply to attend</button>';return'<div class="market-card" style="margin-bottom:1rem"><div class="market-banner">'+bi+'</div><div class="market-body"><strong style="font-size:15px">'+esc(m.name)+'</strong><p style="font-size:13px;margin:6px 0 8px">'+esc(m.desc||'')+'</p><div class="date-chips">'+dates+'</div>'+(deadlineHtml?'<div style="margin-top:6px">'+deadlineHtml+'</div>':'')+'</div><div class="market-footer"><span style="font-size:12px;color:var(--text2)">Stall fee: R'+(m.fee||FEE)+'/date</span>'+applyBtn+'</div></div>';}).join('');}
function renderVendorFormMarkets(){var today=new Date().toISOString().slice(0,10);var pub=state.markets.filter(m=>m.published&&(!m.deadline||m.deadline>=today));var el=document.getElementById('v-market-checks'),noM=document.getElementById('v-no-markets');if(!pub.length){el.innerHTML='';noM.style.display='block';return;}noM.style.display='none';el.innerHTML=pub.map(m=>{var deadlineHtml=m.deadline?'<div class="msc-fee" style="color:var(--text3)">Apply by '+m.deadline+'</div>':'';return'<div class="market-select-card" onclick="toggleMktCheck(\''+m.id+'\',this)"><input type="checkbox" class="v-mkt-check" id="vc-'+m.id+'" value="'+m.id+'" onclick="event.stopPropagation();this.closest(\'.market-select-card\').classList.toggle(\'selected\',this.checked)"><div><div class="msc-name">'+esc(m.name)+'</div><div class="msc-dates">'+(m.dates.join(' · ')||'Dates TBC')+'</div><div class="msc-fee">Stall fee: R'+(m.fee||FEE)+'/date</div>'+deadlineHtml+'</div></div>';}).join('');}
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
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){alert('Please enter a valid email address.');return;}
  var today=new Date().toISOString().slice(0,10);var closedMkt=markets.find(mid=>{var m=state.markets.find(x=>x.id===mid);return m&&m.deadline&&m.deadline<today;});if(closedMkt){alert('Applications for one or more selected markets are closed.');return;}
  var mnames=markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?m.name:mid;}).join(', ');
  var nv={id:uid(),name,desc,email,markets:markets.slice(),images:[..._vendorImages],status:'pending',payStatus:'outstanding',payMethod:null,marketPayments:{},submitted:new Date().toISOString().slice(0,10)};
  state.vendors.push(nv);
  sbSave('vendors',vendorToDb(nv));
  if(currentUser&&currentUser.email){sendEmail(currentUser.email,'New vendor application — '+name,'<p>A new vendor application has been submitted.</p><p><strong>Stall name:</strong> '+esc(name)+'<br><strong>Email:</strong> '+esc(email)+'<br><strong>Markets:</strong> '+esc(mnames)+'<br><strong>Description:</strong> '+esc(desc)+'</p><p>Log in to your dashboard to review and approve.</p>');}
  document.getElementById('v-name').value='';document.getElementById('v-desc').value='';document.getElementById('v-email').value='';
  _vendorImages=[];renderVendorThumbs();
  document.querySelectorAll('.v-mkt-check').forEach(c=>{c.checked=false;c.closest('.market-select-card').classList.remove('selected');});
  var s=document.getElementById('v-success');s.style.display='block';setTimeout(()=>s.style.display='none',4000);
  updateMetrics();
}

function exportCSV(type){var list=type==='pending'?state.vendors.filter(v=>v.status==='pending'):state.vendors.filter(v=>v.status==='approved');if(!list.length){alert('No vendors to export.');return;}var headers=type==='pending'?['Name','Email','Description','Markets','Submitted']:['Name','Email','Markets','Stall Types','Stall Fee (R)','Payment Status','Payment Method','Approved'];var rows=list.map(v=>{var mnames=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return m?m.name:'?';}).join('; ');var fee=v.markets.reduce((t,mid)=>{var m=state.markets.find(x=>x.id===mid);return t+getStallFee(v,m);},0);var stallTypes=v.markets.map(mid=>{var m=state.markets.find(x=>x.id===mid);return(m?m.name:'?')+': '+stallTypeLabel(v,m);}).join('; ');return type==='pending'?[v.name,v.email,v.desc,mnames,v.submitted]:[v.name,v.email,mnames,stallTypes,fee,v.payStatus||'outstanding',v.payMethod||'',v.approvedAt||''];});var csv=[headers,...rows].map(r=>r.map(c=>'"'+(c||'').toString().replace(/"/g,'""')+'"').join(',')).join('\n');var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=type+'-vendors.csv';a.click();}
