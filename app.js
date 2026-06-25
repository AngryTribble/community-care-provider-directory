let providers = [];
let activeEditIndex = null;

const grid = document.getElementById('providerGrid');
const searchInput = document.getElementById('searchInput');
const cityFilter = document.getElementById('cityFilter');
const hsrmFilter = document.getElementById('hsrmFilter');
const resultCount = document.getElementById('resultCount');
const editDialog = document.getElementById('editDialog');
const editFields = document.getElementById('editFields');

fetch('data/providers.json')
  .then(r => r.json())
  .then(data => {
    providers = normalizeProviders(data);
    populateFilters();
    renderProviders();
  })
  .catch(err => {
    resultCount.textContent = 'Could not load providers.json';
    console.error(err);
  });

function normalizeProviders(data) {
  return data.map((p, i) => ({
    id: p.id || slugify(`${p.officeName || 'provider'}-${p.citySection || p.address?.city || i}`),
    officeName: p.officeName || 'Unknown Provider',
    providerName: p.providerName || '',
    specialties: p.specialties || [p.specialty || 'Dermatology'],
    tags: p.tags || [],
    address: typeof p.address === 'object' ? p.address : { street: p.address || '', city: p.citySection || '', state: 'MI', zip: '' },
    phone: p.phone || '',
    fax: p.fax || '',
    medicalRecordsFax: p.medicalRecordsFax || '',
    email: p.email || '',
    npi: p.npi || '',
    optumStatus: p.optumStatus || 'Unknown',
    epsStatus: p.epsStatus || 'Unknown',
    hsrmStatus: p.hsrmStatus || 'Unknown',
    acceptingNewReferrals: p.acceptingNewReferrals || 'Unknown',
    preferredReferralMethod: p.preferredReferralMethod || 'Fax',
    notes: Array.isArray(p.notes) ? p.notes : (p.notes ? [p.notes] : []),
    restrictions: p.restrictions || [],
    lastVerified: p.lastVerified || '',
    verifiedBy: p.verifiedBy || ''
  }));
}

function populateFilters() {
  const cities = [...new Set(providers.map(p => p.address.city).filter(Boolean))].sort();
  cities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    cityFilter.appendChild(option);
  });
}

function renderProviders() {
  const q = searchInput.value.toLowerCase();
  const city = cityFilter.value;
  const hsrm = hsrmFilter.value;
  const filtered = providers.filter(p => {
    const haystack = JSON.stringify(p).toLowerCase();
    return (!q || haystack.includes(q)) && (!city || p.address.city === city) && (!hsrm || p.hsrmStatus === hsrm);
  });
  resultCount.textContent = `${filtered.length} provider${filtered.length === 1 ? '' : 's'} found`;
  grid.innerHTML = filtered.map((p) => cardTemplate(p, providers.indexOf(p))).join('');
}

function cardTemplate(p, index) {
  const addressLine = [p.address.street, p.address.city, p.address.state, p.address.zip].filter(Boolean).join(', ');
  return `
    <article class="provider-card" id="card-${index}">
      <div class="card-body">
        <h2>${escapeHtml(p.officeName)}</h2>
        <div class="meta">${escapeHtml(p.specialties.join(', '))} | ${escapeHtml(p.address.city || 'City Unknown')}</div>
        <div class="badges">
          ${badge(`Optum: ${p.optumStatus}`, p.optumStatus)}
          ${badge(`EPS: ${p.epsStatus}`, p.epsStatus)}
          ${badge(`HSRM: ${p.hsrmStatus}`, p.hsrmStatus)}
        </div>
        <div class="info-line"><strong>Phone:</strong> ${escapeHtml(p.phone || 'Not listed')}</div>
        <div class="info-line"><strong>Fax:</strong> ${escapeHtml(p.fax || 'Not listed')}</div>
        <div class="info-line"><strong>Last Verified:</strong> ${escapeHtml(p.lastVerified || 'Not verified')}</div>
        <div class="details">
          <p><strong>Address:</strong><br>${escapeHtml(addressLine || 'Not listed')}</p>
          <p><strong>NPI:</strong> ${escapeHtml(p.npi || 'Not listed')}</p>
          <p><strong>Email:</strong> ${escapeHtml(p.email || 'Not listed')}</p>
          <p><strong>Preferred Referral Method:</strong> ${escapeHtml(p.preferredReferralMethod)}</p>
          <p><strong>Notes:</strong><br>${escapeHtml(p.notes.join('\n') || 'No notes listed').replaceAll('\n','<br>')}</p>
          <p><strong>Restrictions:</strong><br>${escapeHtml(p.restrictions.join('\n') || 'No restrictions listed').replaceAll('\n','<br>')}</p>
        </div>
        <div class="card-actions">
          <button onclick="toggleDetails(${index})">View</button>
          <button class="copy-btn" onclick="copyReferral(${index})">Copy</button>
          <button onclick="openEdit(${index})">Edit</button>
        </div>
      </div>
    </article>`;
}

function badge(text, value) {
  const cls = value === 'Active' || value === 'Yes' || value === 'In Network' ? 'good' : 'warn';
  return `<span class="badge ${cls}">${escapeHtml(text)}</span>`;
}

function toggleDetails(index) { document.getElementById(`card-${index}`).classList.toggle('open'); }

function copyReferral(index) {
  const p = providers[index];
  const address = [p.address.street, p.address.city, p.address.state, p.address.zip].filter(Boolean).join(', ');
  const text = `Community Provider Selected:\nProvider: ${p.officeName}\nSpecialty: ${p.specialties.join(', ')}\nAddress: ${address}\nPhone: ${p.phone}\nFax: ${p.fax}\nOptum Status: ${p.optumStatus}\nEPS: ${p.epsStatus}\nHSRM: ${p.hsrmStatus}\nLast Verified: ${p.lastVerified || 'Not verified'}`;
  navigator.clipboard.writeText(text).then(() => alert('Referral comment copied.'));
}

function openEdit(index) {
  activeEditIndex = index;
  const p = providers[index];
  editFields.innerHTML = `
    ${inputField('officeName', 'Office Name', p.officeName)}
    ${inputField('providerName', 'Provider Name', p.providerName)}
    ${inputField('specialties', 'Specialties', p.specialties.join(', '))}
    ${inputField('address.street', 'Street', p.address.street)}
    ${inputField('address.city', 'City', p.address.city)}
    ${inputField('address.state', 'State', p.address.state)}
    ${inputField('address.zip', 'ZIP', p.address.zip)}
    ${inputField('phone', 'Phone', p.phone)}
    ${inputField('fax', 'Fax', p.fax)}
    ${inputField('medicalRecordsFax', 'Medical Records Fax', p.medicalRecordsFax)}
    ${inputField('email', 'Email', p.email)}
    ${inputField('npi', 'NPI', p.npi)}
    ${inputField('optumStatus', 'Optum Status', p.optumStatus)}
    ${inputField('epsStatus', 'EPS Status', p.epsStatus)}
    ${inputField('hsrmStatus', 'HSRM Status', p.hsrmStatus)}
    ${textareaField('notes', 'Notes', p.notes.join('\n'))}
    ${textareaField('restrictions', 'Restrictions', p.restrictions.join('\n'))}
    ${inputField('lastVerified', 'Last Verified', p.lastVerified)}
    ${inputField('verifiedBy', 'Verified By', p.verifiedBy)}
  `;
  editDialog.showModal();
}

function inputField(name, label, value) { return `<label><strong>${label}</strong><input data-field="${name}" value="${escapeAttr(value || '')}"></label>`; }
function textareaField(name, label, value) { return `<label class="field-wide"><strong>${label}</strong><textarea data-field="${name}" rows="4">${escapeHtml(value || '')}</textarea></label>`; }

document.getElementById('copyJsonButton').addEventListener('click', () => {
  const updated = JSON.parse(JSON.stringify(providers[activeEditIndex]));
  editFields.querySelectorAll('[data-field]').forEach(el => setNested(updated, el.dataset.field, el.value));
  updated.specialties = String(updated.specialties).split(',').map(s => s.trim()).filter(Boolean);
  updated.notes = String(updated.notes).split('\n').map(s => s.trim()).filter(Boolean);
  updated.restrictions = String(updated.restrictions).split('\n').map(s => s.trim()).filter(Boolean);
  navigator.clipboard.writeText(JSON.stringify(updated, null, 2)).then(() => alert('Updated JSON copied. Paste it into providers.json for now.'));
});

function setNested(obj, path, value) {
  const parts = path.split('.');
  let ref = obj;
  while (parts.length > 1) ref = ref[parts.shift()];
  ref[parts[0]] = value;
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttr(s) { return escapeHtml(s).replaceAll('\n', ' '); }

[searchInput, cityFilter, hsrmFilter].forEach(el => el.addEventListener('input', renderProviders));
document.getElementById('clearFilters').addEventListener('click', () => { searchInput.value = ''; cityFilter.value = ''; hsrmFilter.value = ''; renderProviders(); });

