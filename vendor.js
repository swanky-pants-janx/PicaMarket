var _sb = window.supabase.createClient(
  'https://bjzckhanxudkyrpczqbs.supabase.co',
  'sb_publishable_f64M7MFa88zOMuZ083v-lw_Ypgcyhx-'
);

var _vendorUser = null;
var _vendorProfile = null;
var _vpImages = []; // { url: string, file: File|null }

function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function showToast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}

// ── SESSION ───────────────────────────────────────────────────────
_sb.auth.onAuthStateChange(async(event, session) => {
  if (event === 'INITIAL_SESSION') {
    if (!session) { window.location.href = 'index.html'; return; }
    // Verify this is a vendor account
    var { data: vp } = await _sb.from('vendor_profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    if (!vp) { window.location.href = 'index.html'; return; }
    _vendorUser = session.user;
    _vendorProfile = vp;
    vdInit();
  }
});

// ── INIT ──────────────────────────────────────────────────────────
function vdInit() {
  document.getElementById('vd-loading').style.display = 'none';
  document.getElementById('vd-dashboard').style.display = 'block';
  var stallName = _vendorProfile.stall_name || '';
  document.getElementById('vd-nav-brand').textContent = stallName || 'Vendor Dashboard';
  document.getElementById('vd-nav-user').textContent = stallName;
  document.getElementById('vd-sidebar-user').textContent = stallName;
  vdPopulateProfile();
  vdLoadDirectory();
}

// ── NAVIGATION ────────────────────────────────────────────────────
function vdShowPage(p) {
  document.querySelectorAll('#vd-dashboard .page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#vd-sidebar .sidebar-item').forEach(el => el.classList.remove('active'));
  document.getElementById('vd-page-' + p).classList.add('active');
  var map = { profile: 0, directory: 1 };
  if (map[p] !== undefined) {
    var nt = document.querySelectorAll('.nav-tab')[map[p]];
    if (nt) nt.classList.add('active');
    var bn = document.querySelectorAll('.bottom-nav-item')[map[p]];
    if (bn) bn.classList.add('active');
    var si = document.querySelectorAll('#vd-sidebar .sidebar-item')[map[p]];
    if (si) si.classList.add('active');
  }
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

function vdOpenOrganiser(slug) {
  window.open('public.html?slug=' + encodeURIComponent(slug), '_blank');
}
