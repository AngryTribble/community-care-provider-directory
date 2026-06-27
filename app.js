let providers = [];
let activeProviderIndex = null;
let clipboardHistory = [];

const grid = document.getElementById('providerGrid');
const searchInput = document.getElementById('searchInput');
const cityFilter = document.getElementById('cityFilter');
const hsrmFilter = document.getElementById('hsrmFilter');
const resultCount = document.getElementById('resultCount');
const editDialog = document.getElementById('editDialog');
const editFields = document.getElementById('editFields');
const profileOverlay = document.getElementById('profileOverlay');
const profilePanel = document.getElementById('profilePanel');
const clipboardItems = document.getElementById('clipboardItems');

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
  return data.map((p, i) => {
    const normalized = {
      id: p.id || slugify(`${p.officeName || 'provider'}-${i}`),
      officeName: p.officeName || p.careSite || p.caresite || 'Unknown Care Site',
      providerName: p.providerName || p.provider || '',
      providerNpi: p.providerNpi || p.providerIdentifier || p.npi || '',
      careSiteNpi: p.careSiteNpi || '',
      specialties: p.specialties || [p.specialty || 'Unknown Specialty'],
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
      email: p.email || '',
      medicalRecordsFax: p.medicalRecordsFax || '',
      status: p.status || '',
      epsStatus: p.epsStatus || p.compassEpsStatus || '',
      hsrmStatus: p.hsrmStatus || p.compassHsrmStatus || '',
      acceptingNewReferrals: p.acceptingNewReferrals || p.compassAcceptingStatus || '',
      preferredReferralMethod: p.preferredReferralMethod || 'Fax',
      organization: p.organization || p.organizationGroup || '',
      telehealthAvailable: p.telehealthAvailable || '',
      coverageCounty: p.coverageCounty || '',
      notes: Array.isArray(p.notes) ? p.notes : (p.notes ? [p.notes] : []),
      restrictions: Array.isArray(p.restrictions) ? p.restrictions : (p.restrictions ? [p.restrictions] : [])
    };

    normalized.searchText = [
      normalized.officeName,
      normalized.providerName,
      normalized.providerNpi,
      normalized.careSiteNpi,
      normalized.specialties.join(' '),
      normalized.address.street,
      normalized.address.city,
      normalized.address.state,
      normalized.address.zip,
      normalized.phone,
      normalized.fax,
      normalized.email,
      normalized.organization,
      normalized.coverageCounty,
      normalized.notes.join(' '),
      normalized.restrictions.join(' ')
    ].filter(Boolean).join(' ').toLowerCase();

    return normalized;
  });
}

function populateFilters() {
  const cities = [...new Set(providers.map(p => p.address.city).filter(Boolean))].sort();
  cityFilter.innerHTML = '<option value="">All Cities</option>';

  cities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    cityFilter.appendChild(option);
  });
}

function renderProviders() {
  const q = searchInput.value.trim().toLowerCase();
  const city = cityFilter.value;
  const hsrm = hsrmFilter.value;
  const hasFilter = city || hsrm;

  if (q.length < 2 && !hasFilter) {
    resultCount.textContent = `${providers.length.toLocaleString()} providers loaded`;
    grid.innerHTML = `
      <section class="search-start-panel">
        <h2>Search Community Care Providers</h2>
        <p>Search over ${providers.length.toLocaleString()} in-network provider entries.</p>
        <p>Enter at least <strong>2 characters</strong> or select a filter to begin.</p>
        <div class="search-hints">
          <span>Provider Name</span>
          <span>Care Site</span>
          <span>Specialty</span>
          <span>City</span>
          <span>ZIP</span>
          <span>Phone</span>
          <span>Fax</span>
          <span>NPI</span>
        </div>
      </section>
    `;
    return;
  }

  const matches = [];

  for (const p of providers) {
    if (city && p.address.city !== city) continue;
    if (hsrm && p.hsrmStatus !== hsrm) continue;
    if (q && !p.searchText.includes(q)) continue;

    matches.push(p);

    if (matches.length >= 100) break;
  }

  const totalMatches = providers.filter(p => {
    if (city && p.address.city !== city) return false;
    if (hsrm && p.hsrmStatus !== hsrm) return false;
    if (q && !p.searchText.includes(q)) return false;
    return true;
  }).length;

  resultCount.textContent =
    totalMatches > 100
      ? `Showing first 100 of ${totalMatches.toLocaleString()} matching providers. Refine your search to narrow results.`
      : `${totalMatches.toLocaleString()} provider${totalMatches === 1 ? '' : 's'} found`;

  grid.innerHTML = matches.map(p => providerCardTemplate(p, providers.indexOf(p))).join('');
}

function providerCardTemplate(p, index) {
  const addressLine = [p.address.street, p.address.city, p.address.state, p.address.zip].filter(Boolean).join(', ');
  const cityState = [p.address.city, p.address.state].filter(Boolean).join(', ');
  const inactive = isInactiveProvider(p);

  return `
    <article class="provider-card ${inactive ? 'provider-card-alert' : ''}">
      <div class="card-body">
        <div class="card-topline">
          <h2>${escapeHtml(p.officeName)}</h2>
          <div class="badges">
            ${isTrueValue(p.epsStatus) ? badge('EPS', 'good') : ''}
            ${isTrueValue(p.hsrmStatus) ? badge('HSRM', 'good') : ''}
            ${inactive ? badge('Inactive / Not Accepting', 'danger') : ''}
          </div>
        </div>

<div class="meta">${escapeHtml(p.specialties.join(', '))} | ${escapeHtml(cityState || 'Location Unknown')}</div>

<hr class="card-divider">

<div class="provider-subline">
  <strong>${escapeHtml(p.providerName || 'Provider not listed')}</strong>
  <span class="provider-npi">NPI: ${escapeHtml(p.providerNpi || 'Not listed')}</span>
</div>

        <div class="info-line"><strong>Address:</strong> ${escapeHtml(addressLine || 'Not listed')}</div>
        <div class="info-line"><strong>Phone:</strong> ${escapeHtml(p.phone || 'Not listed')}</div>
        <div class="info-line"><strong>Fax:</strong> ${escapeHtml(p.fax || 'Not listed')}</div>
        ${p.email ? `<div class="info-line"><strong>Email:</strong> ${escapeHtml(p.email)}</div>` : ''}

        <div class="card-actions">
          <button onclick="openProviderProfile(${index})">View Profile</button>
          <button class="copy-btn" onclick="copyProvider(${index})">Copy</button>
          <button onclick="openEdit(${index})">Edit</button>
        </div>
      </div>
    </article>`;
}

function openProviderProfile(index) {
  activeProviderIndex = index;
  const p = providers[index];
  const addressLine = [p.address.street, p.address.city, p.address.state, p.address.zip].filter(Boolean).join(', ');

  profilePanel.innerHTML = `
    <button class="profile-close" onclick="closeProviderProfile()">×</button>

    <h2>${escapeHtml(p.officeName)}</h2>
    <p class="profile-subtitle">${escapeHtml(p.providerName || 'Provider not listed')}</p>
    <p class="profile-subtitle">${escapeHtml(p.specialties.join(', '))}</p>

    <section>
      <h3>Contact Information</h3>
      <p><strong>Address:</strong><br>${escapeHtml(addressLine || 'Not listed')}</p>
      <p><strong>Phone:</strong> ${escapeHtml(p.phone || 'Not listed')}</p>
      <p><strong>Fax:</strong> ${escapeHtml(p.fax || 'Not listed')}</p>
      <p><strong>Email:</strong> ${escapeHtml(p.email || 'Not listed')}</p>
      <p><strong>Care Site NPI:</strong> ${escapeHtml(p.careSiteNpi || 'Not listed')}</p>
      <p><strong>Provider NPI:</strong> ${escapeHtml(p.providerNpi || 'Not listed')}</p>
    </section>

    <section>
      <h3>Community Care Intelligence</h3>
      <div class="details-grid">
        ${detailItem('EPS', isTrueValue(p.epsStatus) ? 'Yes' : 'No / Unknown')}
        ${detailItem('HSRM', isTrueValue(p.hsrmStatus) ? 'Yes' : 'No / Unknown')}
        ${detailItem('Accepting Veterans', p.acceptingNewReferrals)}
        ${detailItem('Preferred Referral Method', p.preferredReferralMethod)}
        ${detailItem('Medical Records Fax', p.medicalRecordsFax)}
        ${detailItem('Telehealth', p.telehealthAvailable)}
        ${detailItem('Coverage County', p.coverageCounty)}
        ${detailItem('Organization / Group', p.organization)}
        ${detailItem('Status', p.status)}
      </div>
    </section>

    <section>
      <h3>Notes</h3>
      <p>${escapeHtml(p.notes.join('\n') || 'No notes listed.').replaceAll('\n', '<br>')}</p>
    </section>

    <section>
      <h3>Restrictions</h3>
      <p>${escapeHtml(p.restrictions.join('\n') || 'No restrictions listed.').replaceAll('\n', '<br>')}</p>
    </section>

    <div class="profile-actions">
      <button class="copy-btn" onclick="copyProvider(${index})">Copy Provider</button>
      <button onclick="openEdit(${index})">Suggest Update</button>
      <button onclick="closeProviderProfile()">Close</button>
    </div>
  `;

  profileOverlay.classList.remove('hidden');
}

function closeProviderProfile() {
  profileOverlay.classList.add('hidden');
}

function copyProvider(index) {
  const p = providers[index];
  const text = buildCopyText(p);

  navigator.clipboard.writeText(text).then(() => {
    addToClipboard(p.officeName, p.providerName || 'Provider Copy', text);
    alert('Provider copied.');
  });
}

function buildCopyText(p) {
  const cityStateZip = [p.address.city, p.address.state, p.address.zip].filter(Boolean).join(', ');

  let text = `** PREFERRED PROVIDER **
${p.officeName}
${p.providerName ? p.providerName + '\n' : ''}${p.address.street || ''}
${cityStateZip}
Phone: ${p.phone || ''}
Fax: ${p.fax || ''}
Care Site NPI: ${p.careSiteNpi || ''}
${p.providerNpi ? `Provider NPI: ${p.providerNpi}` : ''}`;

  if (isTrueValue(p.epsStatus)) {
    text += `

** AMSA: Please utilize EPS to get this Veteran scheduled for care **`;
  }

  return text;
}

function addToClipboard(title, subtitle, text) {
  clipboardHistory.unshift({
    title,
    subtitle,
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  clipboardHistory = clipboardHistory.slice(0, 5);
  renderClipboard();
}

function renderClipboard() {
  if (!clipboardHistory.length) {
    clipboardItems.innerHTML = `<p class="clipboard-empty">Nothing copied yet.</p>`;
    return;
  }

  clipboardItems.innerHTML = `
    ${clipboardHistory.map((item, index) => `
      <div class="clipboard-card">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.subtitle)}</span>
        <small>${escapeHtml(item.time)}</small>
        <button onclick="recopyClipboard(${index})">Copy Again</button>
      </div>
    `).join('')}

    <button class="clear-clipboard-btn" onclick="clearClipboard()">Clear Clipboard</button>
  `;
}

function clearClipboard() {
  clipboardHistory = [];
  renderClipboard();
}

function recopyClipboard(index) {
  navigator.clipboard.writeText(clipboardHistory[index].text).then(() => alert('Copied again.'));
}

function openEdit(index) {
  activeProviderIndex = index;
  const p = providers[index];

  editFields.innerHTML = `
    ${inputField('officeName', 'Care Site Name', p.officeName)}
    ${inputField('providerName', 'Provider Name', p.providerName)}
    ${inputField('providerNpi', 'Provider NPI', p.providerNpi)}
    ${inputField('careSiteNpi', 'Care Site NPI', p.careSiteNpi)}
    ${inputField('address.street', 'Street', p.address.street)}
    ${inputField('address.city', 'City', p.address.city)}
    ${inputField('address.state', 'State', p.address.state)}
    ${inputField('address.zip', 'ZIP', p.address.zip)}
    ${inputField('phone', 'Phone', p.phone)}
    ${inputField('fax', 'Fax', p.fax)}
    ${inputField('email', 'Email', p.email)}
    ${inputField('epsStatus', 'EPS Status', p.epsStatus)}
    ${inputField('hsrmStatus', 'HSRM Status', p.hsrmStatus)}
    ${textareaField('notes', 'Notes', p.notes.join('\n'))}
    ${textareaField('restrictions', 'Restrictions', p.restrictions.join('\n'))}
  `;

  editDialog.showModal();
}

function detailItem(label, value) {
  return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || 'Not listed')}</strong></div>`;
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

  return status.includes('inactive') ||
         status.includes('deactivated') ||
         status.includes('not active') ||
         accepting.includes('no') ||
         accepting.includes('not accepting');
}

function inputField(name, label, value) {
  return `<label><strong>${label}</strong><input data-field="${name}" value="${escapeAttr(value || '')}"></label>`;
}

function textareaField(name, label, value) {
  return `<label class="field-wide"><strong>${label}</strong><textarea data-field="${name}" rows="4">${escapeHtml(value || '')}</textarea></label>`;
}

document.getElementById('copyJsonButton').addEventListener('click', () => {
  alert('Update request workflow will connect here next.');
});

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('\n', ' ');
}

let searchTimer;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderProviders, 250);
});

cityFilter.addEventListener('input', renderProviders);
hsrmFilter.addEventListener('input', renderProviders);

document.getElementById('clearFilters').addEventListener('click', () => {
  searchInput.value = '';
  cityFilter.value = '';
  hsrmFilter.value = '';
  renderProviders();
});

renderClipboard();
