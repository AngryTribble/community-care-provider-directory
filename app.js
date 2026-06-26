let providers = [];
let offices = [];
let activeOfficeIndex = null;
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
    offices = groupProvidersByOffice(providers);
    populateFilters();
    renderOffices();
  })
  .catch(err => {
    resultCount.textContent = 'Could not load providers.json';
    console.error(err);
  });

function normalizeProviders(data) {
  return data.map((p, i) => ({
    id: p.id || slugify(`${p.officeName || p.careSite || 'provider'}-${i}`),
    officeName: p.officeName || p.careSite || p.caresite || 'Unknown Care Site',
    providerName: p.providerName || p.provider || '',
    providerNpi: p.providerNpi || p.providerIdentifier || '',
    careSiteNpi: p.careSiteNpi || p.groupNpi || p.npi || '',
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
  }));
}

function groupProvidersByOffice(providerList) {
  const map = new Map();

  providerList.forEach(p => {
    const key = [
      p.officeName,
      p.address.street,
      p.address.city,
      p.address.state,
      p.address.zip
    ].join('|').toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        officeName: p.officeName,
        address: p.address,
        phone: p.phone,
        fax: p.fax,
        email: p.email,
        careSiteNpi: p.careSiteNpi,
        specialties: new Set(),
        epsStatus: p.epsStatus,
        hsrmStatus: p.hsrmStatus,
        status: p.status,
        acceptingNewReferrals: p.acceptingNewReferrals,
        medicalRecordsFax: p.medicalRecordsFax,
        preferredReferralMethod: p.preferredReferralMethod,
        organization: p.organization,
        telehealthAvailable: p.telehealthAvailable,
        coverageCounty: p.coverageCounty,
        notes: new Set(),
        restrictions: new Set(),
        providers: []
      });
    }

    const office = map.get(key);
    p.specialties.forEach(s => office.specialties.add(s));
    p.notes.forEach(n => office.notes.add(n));
    p.restrictions.forEach(r => office.restrictions.add(r));

    if (p.providerName || p.providerNpi) {
      office.providers.push({
        providerName: p.providerName,
        providerNpi: p.providerNpi
      });
    }
  });

  return [...map.values()].map(o => ({
    ...o,
    specialties: [...o.specialties],
    notes: [...o.notes],
    restrictions: [...o.restrictions]
  }));
}

function populateFilters() {
  const cities = [...new Set(offices.map(o => o.address.city).filter(Boolean))].sort();
  cityFilter.innerHTML = '<option value="">All Cities</option>';
  cities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    cityFilter.appendChild(option);
  });
}

function renderOffices() {
  const q = searchInput.value.toLowerCase();
  const city = cityFilter.value;
  const hsrm = hsrmFilter.value;

  const filtered = offices.filter(o => {
    const haystack = JSON.stringify(o).toLowerCase();
    return (!q || haystack.includes(q)) &&
           (!city || o.address.city === city) &&
           (!hsrm || o.hsrmStatus === hsrm);
  });

  resultCount.textContent = `${filtered.length} office${filtered.length === 1 ? '' : 's'} found`;
  grid.innerHTML = filtered.map(o => officeCardTemplate(o, offices.indexOf(o))).join('');
}

function officeCardTemplate(o, index) {
  const addressLine = [o.address.street, o.address.city, o.address.state, o.address.zip].filter(Boolean).join(', ');
  const cityState = [o.address.city, o.address.state].filter(Boolean).join(', ');
  const inactive = isInactiveOffice(o);

  return `
    <article class="provider-card ${inactive ? 'provider-card-alert' : ''}">
      <div class="card-body">
        <div class="card-topline">
          <h2>${escapeHtml(o.officeName)}</h2>
          <div class="badges">
            ${isTrueValue(o.epsStatus) ? badge('EPS', 'good') : ''}
            ${isTrueValue(o.hsrmStatus) ? badge('HSRM', 'good') : ''}
            ${inactive ? badge('Inactive / Not Accepting', 'danger') : ''}
          </div>
        </div>

        <div class="meta">${escapeHtml(o.specialties.join(', '))} | ${escapeHtml(cityState || 'Location Unknown')}</div>

        <div class="info-line"><strong>Address:</strong> ${escapeHtml(addressLine || 'Not listed')}</div>
        <div class="info-line"><strong>Phone:</strong> ${escapeHtml(o.phone || 'Not listed')}</div>
        <div class="info-line"><strong>Fax:</strong> ${escapeHtml(o.fax || 'Not listed')}</div>
        ${o.email ? `<div class="info-line"><strong>Email:</strong> ${escapeHtml(o.email)}</div>` : ''}

        <div class="card-actions">
          <button class="copy-btn" onclick="copyOffice(${index})">Copy Office</button>
          <button onclick="openOfficeProfile(${index})">View Office</button>
          <button onclick="openEdit(${index})">Suggest Update</button>
        </div>

        <div class="office-providers">
          <h3>Providers at this Office</h3>
          ${providerListTemplate(o, index)}
        </div>
      </div>
    </article>`;
}

function providerListTemplate(o, officeIndex) {
  if (!o.providers.length) {
    return `<p class="muted">No individual providers listed.</p>`;
  }

  return o.providers.slice(0, 8).map((p, providerIndex) => `
    <div class="office-provider-row">
      <div>
        <strong>${escapeHtml(p.providerName || 'Provider name not listed')}</strong>
        <span>${p.providerNpi ? `NPI: ${escapeHtml(p.providerNpi)}` : 'NPI not listed'}</span>
      </div>
      <button onclick="copyProvider(${officeIndex}, ${providerIndex})">Copy Provider</button>
    </div>
  `).join('');
}

function openOfficeProfile(index) {
  activeOfficeIndex = index;
  const o = offices[index];
  const addressLine = [o.address.street, o.address.city, o.address.state, o.address.zip].filter(Boolean).join(', ');

  profilePanel.innerHTML = `
    <button class="profile-close" onclick="closeOfficeProfile()">×</button>

    <h2>${escapeHtml(o.officeName)}</h2>
    <p class="profile-subtitle">${escapeHtml(o.specialties.join(', '))}</p>

    <section>
      <h3>Contact Information</h3>
      <p><strong>Address:</strong><br>${escapeHtml(addressLine || 'Not listed')}</p>
      <p><strong>Phone:</strong> ${escapeHtml(o.phone || 'Not listed')}</p>
      <p><strong>Fax:</strong> ${escapeHtml(o.fax || 'Not listed')}</p>
      <p><strong>Email:</strong> ${escapeHtml(o.email || 'Not listed')}</p>
      <p><strong>Care Site NPI:</strong> ${escapeHtml(o.careSiteNpi || 'Not listed')}</p>
    </section>

    <section>
      <h3>Providers at this Office</h3>
      ${o.providers.map((p, providerIndex) => `
        <div class="profile-provider-row">
          <div>
            <strong>${escapeHtml(p.providerName || 'Provider name not listed')}</strong>
            <span>${p.providerNpi ? `NPI: ${escapeHtml(p.providerNpi)}` : 'NPI not listed'}</span>
          </div>
          <button onclick="copyProvider(${index}, ${providerIndex})">Copy Provider</button>
        </div>
      `).join('') || '<p>No individual providers listed.</p>'}
    </section>

    <section>
      <h3>Community Care Intelligence</h3>
      <div class="details-grid">
        ${detailItem('EPS', isTrueValue(o.epsStatus) ? 'Yes' : 'No / Unknown')}
        ${detailItem('HSRM', isTrueValue(o.hsrmStatus) ? 'Yes' : 'No / Unknown')}
        ${detailItem('Accepting Veterans', o.acceptingNewReferrals)}
        ${detailItem('Preferred Referral Method', o.preferredReferralMethod)}
        ${detailItem('Medical Records Fax', o.medicalRecordsFax)}
        ${detailItem('Telehealth', o.telehealthAvailable)}
        ${detailItem('Coverage County', o.coverageCounty)}
        ${detailItem('Organization / Group', o.organization)}
      </div>
    </section>

    <section>
      <h3>Notes</h3>
      <p>${escapeHtml(o.notes.join('\n') || 'No notes listed.').replaceAll('\n', '<br>')}</p>
    </section>

    <section>
      <h3>Restrictions</h3>
      <p>${escapeHtml(o.restrictions.join('\n') || 'No restrictions listed.').replaceAll('\n', '<br>')}</p>
    </section>

    <div class="profile-actions">
      <button class="copy-btn" onclick="copyOffice(${index})">Copy Office</button>
      <button onclick="openEdit(${index})">Suggest Update</button>
      <button onclick="closeOfficeProfile()">Close</button>
    </div>
  `;

  profileOverlay.classList.remove('hidden');
}

function closeOfficeProfile() {
  profileOverlay.classList.add('hidden');
}

function copyOffice(index) {
  const o = offices[index];
  const text = buildCopyText(o, null);
  navigator.clipboard.writeText(text).then(() => {
    addToClipboard(o.officeName, 'Office Copy', text);
    alert('Office copied.');
  });
}

function copyProvider(officeIndex, providerIndex) {
  const o = offices[officeIndex];
  const provider = o.providers[providerIndex];
  const text = buildCopyText(o, provider);
  navigator.clipboard.writeText(text).then(() => {
    addToClipboard(o.officeName, provider.providerName || 'Provider Copy', text);
    alert('Provider copied.');
  });
}

function buildCopyText(o, provider) {
  const cityStateZip = [o.address.city, o.address.state, o.address.zip].filter(Boolean).join(', ');

  let text = `** PREFERRED PROVIDER **
${o.officeName}
${provider?.providerName ? provider.providerName + '\n' : ''}${o.address.street || ''}
${cityStateZip}
Phone: ${o.phone || ''}
Fax: ${o.fax || ''}
Care Site NPI: ${o.careSiteNpi || ''}
${provider?.providerNpi ? `Provider NPI: ${provider.providerNpi}` : ''}`;

  if (isTrueValue(o.epsStatus)) {
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
  clipboardItems.innerHTML = clipboardHistory.map((item, index) => `
    <div class="clipboard-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.subtitle)}</span>
      <small>${escapeHtml(item.time)}</small>
      <button onclick="recopyClipboard(${index})">Copy Again</button>
    </div>
  `).join('');
}

function recopyClipboard(index) {
  navigator.clipboard.writeText(clipboardHistory[index].text).then(() => alert('Copied again.'));
}

function openEdit(index) {
  activeOfficeIndex = index;
  const o = offices[index];

  editFields.innerHTML = `
    ${inputField('officeName', 'Care Site Name', o.officeName)}
    ${inputField('address.street', 'Street', o.address.street)}
    ${inputField('address.city', 'City', o.address.city)}
    ${inputField('address.state', 'State', o.address.state)}
    ${inputField('address.zip', 'ZIP', o.address.zip)}
    ${inputField('phone', 'Phone', o.phone)}
    ${inputField('fax', 'Fax', o.fax)}
    ${inputField('email', 'Email', o.email)}
    ${inputField('careSiteNpi', 'Care Site NPI', o.careSiteNpi)}
    ${inputField('epsStatus', 'EPS Status', o.epsStatus)}
    ${inputField('hsrmStatus', 'HSRM Status', o.hsrmStatus)}
    ${textareaField('notes', 'Notes', o.notes.join('\n'))}
    ${textareaField('restrictions', 'Restrictions', o.restrictions.join('\n'))}
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

function isInactiveOffice(o) {
  const status = String(o.status || '').toLowerCase();
  const accepting = String(o.acceptingNewReferrals || '').toLowerCase();

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

[searchInput, cityFilter, hsrmFilter].forEach(el => el.addEventListener('input', renderOffices));

document.getElementById('clearFilters').addEventListener('click', () => {
  searchInput.value = '';
  cityFilter.value = '';
  hsrmFilter.value = '';
  renderOffices();
});
