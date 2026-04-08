var _sb = window.supabase.createClient(
  'https://bjzckhanxudkyrpczqbs.supabase.co',
  'sb_publishable_f64M7MFa88zOMuZ083v-lw_Ypgcyhx-'
);

var _vendorUser = null;
var _vendorProfile = null;
var _vpImages = []; // { url: string, file: File|null }
var _vdDarkMode = false;

function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function showToast(msg){var t=document.getElementById('toast');t.textContent=msg;var bar=document.createElement('div');bar.className='toast-bar';t.appendChild(bar);t.classList.add('show');setTimeout(()=>{t.classList.remove('show');},2500);}
function closeModal(id){var el=document.getElementById(id);if(!el)return;el.classList.add('closing');setTimeout(function(){el.classList.remove('open','closing');},150);}
function openModal(id){var el=document.getElementById(id);if(el)el.classList.add('open');}

// ── SESSION ───────────────────────────────────────────────────────
_sb.auth.onAuthStateChange(async(event, session) => {
  if (event === 'INITIAL_SESSION') {
    if (!session) { window.location.href = 'index.html'; return; }
    // Verify this is a vendor account
    var { data: vp } = await _sb.from('vendor_profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    if (!vp) { window.location.href = 'index.html'; return; }
    _vendorUser = session.user;
    _vendorProfile = vp;
    // Ensure email is set so organiser verified-badge matching works
    if (!vp.email && session.user.email) {
      await _sb.from('vendor_profiles').update({ email: session.user.email }).eq('user_id', session.user.id);
      _vendorProfile.email = session.user.email;
    }
    vdInit();
  }
});

// ── INIT ──────────────────────────────────────────────────────────
function vdInit() {
  var saved = JSON.parse(localStorage.getItem('pm_vd_settings') || '{}');
  _vdDarkMode = !!saved.dark_mode;
  document.body.classList.toggle('dark', _vdDarkMode);
  document.getElementById('vd-loading').style.display = 'none';
  document.getElementById('vd-dashboard').style.display = 'block';
  var stallName = _vendorProfile.stall_name || '';
  document.getElementById('vd-nav-brand').textContent = stallName || 'Vendor Dashboard';
  document.getElementById('vd-nav-user').textContent = stallName;
  document.getElementById('vd-sidebar-user').textContent = stallName;
  vdPopulateProfile();
  vdLoadDirectory();
  vdMaybeShowOnboarding();
}

// ── NAVIGATION ────────────────────────────────────────────────────
function vdShowPage(p) {
  document.querySelectorAll('#vd-dashboard .page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#vd-sidebar .sidebar-item').forEach(el => el.classList.remove('active'));
  document.getElementById('vd-page-' + p).classList.add('active');
  var map = { directory: 0, profile: 1, settings: 2 };
  if (map[p] !== undefined) {
    var nt = document.querySelectorAll('.nav-tab')[map[p]];
    if (nt) nt.classList.add('active');
    var bn = document.querySelectorAll('.bottom-nav-item')[map[p]];
    if (bn) bn.classList.add('active');
    var si = document.querySelectorAll('#vd-sidebar .sidebar-item')[map[p]];
    if (si) si.classList.add('active');
  }
  if (p === 'settings') vdSyncSettings();
  window.scrollTo(0, 0);
}

// ── LOGOUT ────────────────────────────────────────────────────────
async function vdLogout() {
  await _sb.auth.signOut();
  window.location.href = 'index.html';
}

// ── PROFILE ───────────────────────────────────────────────────────
function vdPopulateProfile() {
  var p = _vendorProfile;
  document.getElementById('vp-stall-name').value = p.stall_name || '';
  document.getElementById('vp-what-you-sell').value = p.what_you_sell || '';
  document.getElementById('vp-email').value = p.email || _vendorUser.email || '';
  _vpImages = (p.images || []).map(url => ({ url, file: null }));
  vdRenderImagePreview();
  // Keep autofill cache in sync so public.html can pre-fill application forms
  localStorage.setItem('pm_vendor_autofill', JSON.stringify({
    stall_name: p.stall_name || '',
    what_you_sell: p.what_you_sell || '',
    email: p.email || _vendorUser.email || '',
    images: p.images || []
  }));
}

function vdRenderImagePreview() {
  var grid = document.getElementById('vp-img-preview');
  grid.innerHTML = _vpImages.map((img, i) =>
    '<div class="vp-img-wrap"><img class="vp-img-thumb" src="' + esc(img.url) + '"><button class="vp-img-remove" onclick="vdRemoveImage(' + i + ')" title="Remove">&times;</button></div>'
  ).join('');
}

function vdRemoveImage(i) {
  _vpImages.splice(i, 1);
  vdRenderImagePreview();
}

function vdHandlePhotos(input) {
  var files = Array.from(input.files);
  var remaining = 5 - _vpImages.length;
  if (remaining <= 0) { showToast('Maximum 5 photos allowed.'); input.value = ''; return; }
  files.slice(0, remaining).forEach(file => {
    var url = URL.createObjectURL(file);
    _vpImages.push({ url, file });
    vdRenderImagePreview();
  });
  input.value = '';
}

async function vdSaveProfile() {
  var stallName = document.getElementById('vp-stall-name').value.trim();
  var whatYouSell = document.getElementById('vp-what-you-sell').value.trim();
  var email = document.getElementById('vp-email').value.trim().toLowerCase();
  if (!stallName || !email) { showToast('Stall name and email are required.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email.'); return; }

  var btn = document.getElementById('vp-save-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;

  // Upload any new images
  var finalImages = [];
  for (var img of _vpImages) {
    if (!img.file) { finalImages.push(img.url); continue; }
    var ext = img.file.name.split('.').pop();
    var path = _vendorUser.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
    var { data: uploadData, error: upErr } = await _sb.storage.from('vendor-images').upload(path, img.file, { upsert: false });
    if (upErr) { showToast('Image upload failed. Try again.'); btn.textContent = 'Save profile'; btn.disabled = false; return; }
    var { data: urlData } = _sb.storage.from('vendor-images').getPublicUrl(path);
    img.url = urlData.publicUrl;
    img.file = null;
    finalImages.push(img.url);
  }

  var { error } = await _sb.from('vendor_profiles').update({
    stall_name: stallName,
    what_you_sell: whatYouSell || null,
    email: email,
    images: finalImages,
    updated_at: new Date().toISOString()
  }).eq('user_id', _vendorUser.id);

  btn.textContent = 'Save profile'; btn.disabled = false;

  if (error) { showToast('Save failed. Please try again.'); return; }

  _vendorProfile.stall_name = stallName;
  _vendorProfile.what_you_sell = whatYouSell;
  _vendorProfile.email = email;
  _vendorProfile.images = finalImages;
  _vpImages = finalImages.map(url => ({ url, file: null }));
  vdRenderImagePreview();

  // Cache for autofill on public application pages
  localStorage.setItem('pm_vendor_autofill', JSON.stringify({ stall_name: stallName, what_you_sell: whatYouSell, email, images: finalImages }));

  document.getElementById('vd-nav-brand').textContent = stallName;
  document.getElementById('vd-nav-user').textContent = stallName;
  document.getElementById('vd-sidebar-user').textContent = stallName;

  showToast('Profile saved!');
}

// ── DIRECTORY ────────────────────────────────────────────────────
async function vdLoadDirectory() {
  var { data: organisers } = await _sb.from('profiles')
    .select('id, market_name, slug, description')
    .eq('is_public', true)
    .order('market_name');

  var grid = document.getElementById('vd-dir-grid');
  var empty = document.getElementById('vd-dir-empty');

  if (!organisers || organisers.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.innerHTML = organisers.map(org =>
    '<div class="dir-card">' +
      '<div class="dir-card-name">' + esc(org.market_name) + '</div>' +
      (org.description ? '<div class="dir-card-desc">' + esc(org.description) + '</div>' : '<div class="dir-card-desc" style="color:var(--text3)">No description provided.</div>') +
      '<button class="btn primary dir-card-btn" onclick="vdOpenOrganiser(\'' + esc(org.slug) + '\')">View markets</button>' +
    '</div>'
  ).join('');
}

// ── ONBOARDING ───────────────────────────────────────────────────
function vdMaybeShowOnboarding() {
  var key = 'pm_ob_done_' + _vendorUser.id;
  if (_vendorProfile.what_you_sell) { localStorage.setItem(key, '1'); return; }
  if (localStorage.getItem(key)) return;
  var el = document.getElementById('vd-onboarding');
  if (el) { document.getElementById('ob-stall-name').value = _vendorProfile.stall_name || ''; el.style.display = 'flex'; }
}

async function vdFinishOnboarding() {
  var stallName = document.getElementById('ob-stall-name').value.trim();
  var whatYouSell = document.getElementById('ob-what-you-sell').value.trim();
  if (stallName) {
    await _sb.from('vendor_profiles').update({ stall_name: stallName, what_you_sell: whatYouSell || null, updated_at: new Date().toISOString() }).eq('user_id', _vendorUser.id);
    _vendorProfile.stall_name = stallName;
    _vendorProfile.what_you_sell = whatYouSell;
    vdPopulateProfile();
    document.getElementById('vd-nav-brand').textContent = stallName;
    document.getElementById('vd-nav-user').textContent = stallName;
    document.getElementById('vd-sidebar-user').textContent = stallName;
  }
  localStorage.setItem('pm_ob_done_' + _vendorUser.id, '1');
  document.getElementById('vd-onboarding').style.display = 'none';
}

function vdSkipOnboarding() {
  localStorage.setItem('pm_ob_done_' + _vendorUser.id, '1');
  document.getElementById('vd-onboarding').style.display = 'none';
}

function vdOpenOrganiser(slug) {
  window.open('public.html?slug=' + encodeURIComponent(slug), '_blank');
}

// ── SETTINGS ─────────────────────────────────────────────────────
function vdShowSettingsSec(sec) {
  document.querySelectorAll('#vd-page-settings .settings-sec').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#vd-page-settings .settings-nav-item').forEach(el => el.classList.remove('active'));
  var el = document.getElementById('vd-ssec-' + sec);
  if (el) el.classList.add('active');
  var nav = document.getElementById('vd-snav-' + sec);
  if (nav) nav.classList.add('active');
}

function vdSyncSettings() {
  var dv = document.getElementById('vd-sp-dark-val');
  if (dv) dv.checked = _vdDarkMode;
  var p = _vendorProfile;
  var sa = document.getElementById('vd-acc-stall');
  if (sa) sa.value = p.stall_name || '';
  var ae = document.getElementById('vd-acc-email');
  if (ae) ae.value = p.email || '';
  var le = document.getElementById('vd-acc-login-email');
  if (le) le.value = _vendorUser.email || '';
}

function vdToggleDark() {
  _vdDarkMode = !_vdDarkMode;
  document.body.classList.toggle('dark', _vdDarkMode);
  var saved = JSON.parse(localStorage.getItem('pm_vd_settings') || '{}');
  saved.dark_mode = _vdDarkMode;
  localStorage.setItem('pm_vd_settings', JSON.stringify(saved));
  var dv = document.getElementById('vd-sp-dark-val');
  if (dv) dv.checked = _vdDarkMode;
}

async function vdSaveAccountSettings() {
  var stallName = document.getElementById('vd-acc-stall').value.trim();
  var email = document.getElementById('vd-acc-email').value.trim().toLowerCase();
  if (!stallName || !email) { showToast('Stall name and email are required.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email.'); return; }
  var btn = document.getElementById('vd-acc-save-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;
  var { error } = await _sb.from('vendor_profiles').update({
    stall_name: stallName, email: email, updated_at: new Date().toISOString()
  }).eq('user_id', _vendorUser.id);
  btn.textContent = 'Save'; btn.disabled = false;
  if (error) { showToast('Save failed. Please try again.'); return; }
  _vendorProfile.stall_name = stallName;
  _vendorProfile.email = email;
  document.getElementById('vd-nav-brand').textContent = stallName;
  document.getElementById('vd-nav-user').textContent = stallName;
  document.getElementById('vd-sidebar-user').textContent = stallName;
  document.getElementById('vp-stall-name').value = stallName;
  document.getElementById('vp-email').value = email;
  showToast('Account settings saved!');
}

function vdOpenDeleteModal() {
  document.getElementById('vd-delete-confirm-input').value = '';
  document.getElementById('vd-delete-confirm-input').placeholder = _vendorProfile.stall_name || '';
  document.getElementById('vd-delete-confirm-btn').disabled = true;
  openModal('vd-delete-account-modal');
}

function vdCheckDeleteConfirm() {
  var inp = document.getElementById('vd-delete-confirm-input');
  var btn = document.getElementById('vd-delete-confirm-btn');
  if (!inp || !btn) return;
  btn.disabled = inp.value.trim() !== (_vendorProfile.stall_name || '');
}

async function vdConfirmDeleteAccount() {
  var btn = document.getElementById('vd-delete-confirm-btn');
  btn.textContent = 'Deleting...'; btn.disabled = true;
  var { data: { session } } = await _sb.auth.getSession();
  var res = await fetch('https://bjzckhanxudkyrpczqbs.supabase.co/functions/v1/delete-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token }
  });
  if (!res.ok) { showToast('Delete failed. Please try again.'); btn.textContent = 'Delete account'; btn.disabled = false; return; }
  await _sb.auth.signOut();
  window.location.href = 'index.html';
}

async function vdSendPasswordReset() {
  var { error } = await _sb.auth.resetPasswordForEmail(_vendorUser.email, { redirectTo: 'https://picamarket.site/' });
  if (error) { showToast('Failed to send reset email.'); return; }
  showToast('Password reset link sent to your email!');
}
