let providers = [];
let activeEditIndex = null;

const grid = document.getElementById('providerGrid');
const searchInput = document.getElementById('searchInput');
const cityFilter = document.getElementById('cityFilter');
const hsrmFilter = document.getElementById('hsrmFilter');
const resultCount = document.getElementById('resultCount');
const editDialog = document.getElementById('editDialog');
const editFields = document.getElementById('editFields');

fetch('./providers.json?v=' + Date.now())
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
    id: p.id || slugify(`${p.officeName || p.careSite || 'provider'}-${p.address?.city || p.citySection || i}`),
    officeName: p.officeName || p.careSite || p.caresite || 'Unknown Care Site',
    providerName: p.providerName || p.provider || '',
    providerNpi: p.providerNpi || p.providerIdentifier || '',
    careSiteNpi: p.careSiteNpi || p.groupNpi || p.npi || '',
    specialties: p.specialties || [p.specialty || 'Unknown Specialty'],
    tags: p.tags || [],
    address: typeof p.address === 'object'
      ? p.address
      : {
          street: p.address || p.careSiteAddress || '',
          city: p.citySection || p.careSiteCity || '',
          state: p.careSiteState || 'MI',
          zip: p.careSiteZipCode || ''
        },
    phone: p.phone || p.careSitePhoneNumber || '',
    fax: p.fax || p.careSiteFax || '',
    medicalRecordsFax: p.medicalRecordsFax || '',
    email: p.email || '',
    status: p.status || p.Status || '',
    availability: p.availability || p.Availability || '',
    epsStatus: p.epsStatus || p.compassEpsStatus || '',
    hsrmStatus: p.hsrmStatus || p.compassHsrmStatus || '',
    acceptingNewReferrals: p.acceptingNewReferrals || p.compassAcceptingStatus || '',
    preferredReferralMethod: p.preferredReferralMethod || 'Fax',
    organization: p.organization || p.organizationGroup || '',
    telehealthAvailable: p.telehealthAvailable || '',
    coverageCounty: p.coverageCounty || '',
    notes: Array.isArray(p.notes) ? p.notes : (p.notes ? [p.notes] : []),
    restrictions: Array.isArray(p.restrictions) ? p.restrictions : (p.restrictions ? [p.restrictions] : []),
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
    return (!q || haystack.includes(q)) &&
           (!city || p.address.city === city) &&
           (!hsrm || p.hsrmStatus === hsrm);
  });

  resultCount.textContent = `${filtered.length} provider${filtered.length === 1 ? '' : 's'} found`;
  grid.innerHTML = filtered.map((p) => cardTemplate(p, providers.indexOf(p))).join('');
}

function cardTemplate(p, index) {
  const addressLine = [p.address.street, p.address.city, p.address.state, p.address.zip].filter(Boolean).join(', ');
  const cityState = [p.address.city, p.address.state].filter(Boolean).join(', ');
  const inactive = isInactiveProvider(p);
  const eps = isTrueValue(p.epsStatus);
  const hsrm = isTrueValue(p.hsrmStatus);

  return `
    <article class="provider-card ${inactive ? 'provider-card-alert' : ''}" id="card-${index}">
      <div class="card-body">
        <h2>${escapeHtml(p.officeName)}</h2>

        <div class="provider-subline">
          ${escapeHtml(p.providerName || 'Provider not listed')}
          ${p.providerNpi ? `<span class="npi-pill">NPI: ${escapeHtml(p.providerNpi)}</span>` : ''}
        </div>

        <div class="meta">
          ${escapeHtml(p.specialties.join(', '))} | ${escapeHtml(cityState || 'Location Unknown')}
        </div>

        <div class="badges">
          ${eps ? badge('EPS', 'good') : ''}
          ${hsrm ? badge('HSRM', 'good') : ''}
          ${inactive ? badge('Inactive / Not Accepting', 'danger') : ''}
        </div>

        <div class="info-line"><strong>Address:</strong> ${escapeHtml(addressLine || 'Not listed')}</div>
        <div class="info-line"><strong>Phone:</strong> ${escapeHtml(p.phone || 'Not listed')}</div>
        <div class="info-line"><strong>Fax:</strong> ${escapeHtml(p.fax || 'Not listed')}</div>
        ${p.email ? `<div class="info-line"><strong>Email:</strong> ${escapeHtml(p.email)}</div>` : ''}

        <div class="details">
          <div class="details-grid">
            ${detailItem('Care Site', p.officeName)}
            ${detailItem('Provider', p.providerName)}
            ${detailItem('Provider NPI', p.providerNpi)}
            ${detailItem('Care Site NPI', p.careSiteNpi)}
            ${detailItem('Specialty', p.specialties.join(', '))}
            ${detailItem('Status', p.status)}
            ${detailItem('Availability', p.availability)}
            ${detailItem('Accepting New Referrals', p.acceptingNewReferrals)}
            ${detailItem('Telehealth Available', p.telehealthAvailable)}
            ${detailItem('Organization / Group', p.organization)}
            ${detailItem('Coverage County', p.coverageCounty)}
            ${detailItem('Preferred Referral Method', p.preferredReferralMethod)}
            ${detailItem('Medical Records Fax', p.medicalRecordsFax)}
            ${detailItem('Email', p.email)}
          </div>

          <p><strong>Notes:</strong><br>${escapeHtml(p.notes.join('\\n') || 'No notes listed').replaceAll('\\n','<br>')}</p>
          <p><strong>Restrictions:</strong><br>${escapeHtml(p.restrictions.join('\\n') || 'No restrictions listed').replaceAll('\\n','<br>')}</p>

          <button class="close-details" onclick="toggleDetails(${index})">Close</button>
        </div>

        <div class="card-actions">
          <button onclick="toggleDetails(${index})">View</button>
          <button class="copy-btn" onclick="copyReferral(${index})">Copy</button>
          <button onclick="openEdit(${index})">Suggest Update</button>
        </div>
      </div>
    </article>`;
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || 'Not listed')}</strong>
    </div>`;
}

function badge(text, type) {
  return `<span class="badge ${type}">${escapeHtml(text)}</span>`;
}

function isTrueValue(value) {
  const v = String(value || '').trim().toLowerCase();
  return ['true', 'yes', 'y', 'active', 'available'].includes(v);
}

function isInactiveProvider(p) {
  const status = String(p.status || '').toLowerCase();
  const accepting = String(p.acceptingNewReferrals || '').toLowerCase();
  const availability = String(p.availability || '').toLowerCase();

  return status.includes('inactive') ||
         status.includes('deactivated') ||
         status.includes('not active') ||
         accepting.includes('no') ||
         accepting.includes('not accepting') ||
         availability.includes('not accepting');
}

function toggleDetails(index) {
  document.getElementById(`card-${index}`).classList.toggle('open');
}

function copyReferral(index) {
  const p = providers[index];

  const careSiteName = p.officeName || '';
  const providerName = p.providerName || '';
  const addressStreet = p.address?.street || '';
  const cityStateZip = [p.address?.city, p.address?.state, p.address?.zip].filter(Boolean).join(', ');
  const phone = p.phone || '';
  const fax = p.fax || '';
  const careSiteNpi = p.careSiteNpi || '';
  const providerNpi = p.providerNpi || '';

  let text = `** PREFERRED PROVIDER **
${careSiteName}
${providerName ? providerName + '\n' : ''}${addressStreet}
${cityStateZip}
Phone: ${phone}
Fax: ${fax}
Care Site NPI: ${careSiteNpi}
${providerNpi ? `Provider NPI: ${providerNpi}` : ''}`;

  if (isTrueValue(p.epsStatus)) {
    text += `

** AMSA: Please utilize EPS to get this Veteran scheduled for care **`;
  }

  navigator.clipboard.writeText(text).then(() => alert('Preferred provider copied.'));
}

function openEdit(index) {
  activeEditIndex = index;
  const p = providers[index];

  editFields.innerHTML = `
    ${inputField('officeName', 'Care Site Name', p.officeName)}
    ${inputField('providerName', 'Provider Name', p.providerName)}
    ${inputField('providerNpi', 'Provider NPI', p.providerNpi)}
    ${inputField('careSiteNpi', 'Care Site NPI', p.careSiteNpi)}
    ${inputField('specialties', 'Specialties', p.specialties.join(', '))}
    ${inputField('address.street', 'Street', p.address.street)}
    ${inputField('address.city', 'City', p.address.city)}
    ${inputField('address.state', 'State', p.address.state)}
    ${inputField('address.zip', 'ZIP', p.address.zip)}
    ${inputField('phone', 'Phone', p.phone)}
    ${inputField('fax', 'Fax', p.fax)}
    ${inputField('medicalRecordsFax', 'Medical Records Fax', p.medicalRecordsFax)}
    ${inputField('email', 'Email', p.email)}
    ${inputField('status', 'Status', p.status)}
    ${inputField('availability', 'Availability', p.availability)}
    ${inputField('epsStatus', 'EPS Status', p.epsStatus)}
    ${inputField('hsrmStatus', 'HSRM Status', p.hsrmStatus)}
    ${inputField('acceptingNewReferrals', 'Accepting New Referrals', p.acceptingNewReferrals)}
    ${textareaField('notes', 'Notes', p.notes.join('\\n'))}
    ${textareaField('restrictions', 'Restrictions', p.restrictions.join('\\n'))}
  `;

  editDialog.showModal();
}

function inputField(name, label, value) {
  return `<label><strong>${label}</strong><input data-field="${name}" value="${escapeAttr(value || '')}"></label>`;
}

function textareaField(name, label, value) {
  return `<label class="field-wide"><strong>${label}</strong><textarea data-field="${name}" rows="4">${escapeHtml(value || '')}</textarea></label>`;
}

document.getElementById('copyJsonButton').addEventListener('click', () => {
  const updated = JSON.parse(JSON.stringify(providers[activeEditIndex]));
  editFields.querySelectorAll('[data-field]').forEach(el => setNested(updated, el.dataset.field, el.value));

  updated.specialties = String(updated.specialties).split(',').map(s => s.trim()).filter(Boolean);
  updated.notes = String(updated.notes).split('\\n').map(s => s.trim()).filter(Boolean);
  updated.restrictions = String(updated.restrictions).split('\\n').map(s => s.trim()).filter(Boolean);

  navigator.clipboard.writeText(JSON.stringify(updated, null, 2)).then(() => alert('Update request copied.'));
});

function setNested(obj, path, value) {
  const parts = path.split('.');
  let ref = obj;
  while (parts.length > 1) ref = ref[parts.shift()];
  ref[parts[0]] = value;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('\n', ' ');
}

[searchInput, cityFilter, hsrmFilter].forEach(el => el.addEventListener('input', renderProviders));

document.getElementById('clearFilters').addEventListener('click', () => {
  searchInput.value = '';
  cityFilter.value = '';
  hsrmFilter.value = '';
  renderProviders();
});
