'use strict';

const euro = n => new Intl.NumberFormat('de-AT', {
  style: 'currency', currency: 'EUR',
  minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  maximumFractionDigits: 2
}).format(n);

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
);

// ── Group BIKES by (model, category) and collect variants ──
const modelMap = new Map();

BIKES.forEach(bike => {
  const key = `${bike.model}|${bike.category}`;
  if (!modelMap.has(key)) {
    modelMap.set(key, {
      model: bike.model,
      category: bike.category,
      image: bike.image,
      source: bike.source,
      bonus: false,
      isNew: bike.new,
      motorShort: bike.motorShort,
      batteryShort: bike.batteryShort,
      torque: bike.torque || null,
      variants: new Map()
    });
  }

  const group = modelMap.get(key);
  group.bonus = group.bonus || bike.bonus;

  // One variant entry per (name, price) — merge colors/sizes
  const vKey = `${bike.variant}|${bike.price}`;
  if (!group.variants.has(vKey)) {
    group.variants.set(vKey, {
      name: bike.variant,
      price: bike.price,
      uvp: bike.uvp,
      sizes: {},
      colors: []
    });
  }
  const v = group.variants.get(vKey);
  bike.options.forEach(opt => {
    if (!v.colors.includes(opt.color)) v.colors.push(opt.color);
    Object.entries(opt.sizes).forEach(([sz, n]) => {
      v.sizes[sz] = (v.sizes[sz] || 0) + n;
    });
  });
});

// ── Helper: size chips ──
function sizeChips(sizes) {
  return ['S', 'M', 'L', 'XL']
    .filter(s => sizes[s])
    .map(s => `<span class="size-chip">${s}&thinsp;·&thinsp;${sizes[s]}×</span>`)
    .join('');
}

// ── Helper: pre-filled mailto ──
function makeMailto(model, variant) {
  const subject = `Raiffeisen Bike-Aktion 2026 – ${model} ${variant.name}`;
  const colorStr = variant.colors.join(' / ');
  const sizeStr = Object.entries(variant.sizes).filter(([, n]) => n > 0).map(([s]) => s).join(' / ');
  const body =
    `Hallo NOX-Team,\n\n` +
    `ich bin Raiffeisen-Mitarbeiter / Familienmitglied und interessiere mich für:\n\n` +
    `Modell:       ${model}\n` +
    `Ausführung:   ${variant.name}\n` +
    `Aktionspreis: ${euro(variant.price)} inkl. 20 % USt.\n` +
    `Farbe:        ${colorStr}\n` +
    `Größe:        (Wunsch eintragen – verfügbar: ${sizeStr})\n\n` +
    `Bitte bestätigt Verfügbarkeit, Ausstattung und Liefermöglichkeit.\n\n` +
    `Name:\nTelefon (optional):\n\nVielen Dank!`;
  return `mailto:info@noxcycles.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ── Render model cards ──
const gridIds = {
  'Tour & Alltag': 'grid-tour',
  'Trail':         'grid-trail',
  'All Mountain':  'grid-am',
  'Enduro':        'grid-enduro'
};

modelMap.forEach(group => {
  const gridId = gridIds[group.category];
  if (!gridId) return;
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const variants = Array.from(group.variants.values());

  // Spec summary line (strip footnote markers)
  const clean = s => s.replace(/[¹²³⁴⁵]/g, '').trim();
  const specParts = [group.motorShort, group.batteryShort].map(clean);
  if (group.torque) specParts.push(clean(group.torque));

  const variantHTML = variants.map(v => `
    <div class="variant-row">
      <div>
        <p class="variant-name">${esc(v.name)}</p>
        <div class="variant-price-line">
          <span class="variant-price">${euro(v.price)}</span>
          <span class="variant-saving">statt <s>${euro(v.uvp)}</s>&ensp;<strong>sparst ${euro(v.uvp - v.price)}</strong></span>
        </div>
        <div class="variant-sizes">${sizeChips(v.sizes)}</div>
      </div>
      <a class="btn-inquire" href="${makeMailto(group.model, v)}">Anfragen →</a>
    </div>
  `).join('');

  const card = document.createElement('article');
  card.className = 'bike-card';
  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${esc(group.image)}" alt="${esc(group.model)}" loading="lazy">
      <div class="card-badges">
        ${group.isNew  ? '<span class="badge badge-new">Neu 2026</span>' : ''}
        ${group.bonus ? '<span class="badge badge-bonus">+ Zusatzakku</span>' : ''}
      </div>
    </div>
    <div class="card-body">
      <h3 class="card-model">${esc(group.model)}</h3>
      <p class="card-specs">${specParts.map(esc).join(' · ')}</p>
      <div class="variant-list">${variantHTML}</div>
      ${group.bonus ? `<p class="bonus-note">⚡ RS-Bonus: 720-Wh-Zusatzakku im Wert von 800 € gratis</p>` : ''}
      <a class="nox-link" href="${esc(group.source)}" target="_blank" rel="noopener">Technische Details bei NOX ↗</a>
    </div>
  `;
  grid.appendChild(card);
});

// ── Price table ──
const masterMap = new Map();
BIKES.forEach(p => {
  const key = `${p.model}|${p.variant}|${p.price}`;
  if (!masterMap.has(key)) masterMap.set(key, { ...p, count: 0 });
  masterMap.get(key).count += p.count;
});

const MASTER = Array.from(masterMap.values())
  .sort((a, b) => a.model.localeCompare(b.model, 'de') || a.price - b.price);

document.getElementById('price-table-body').innerHTML = MASTER.map(p => `
  <tr>
    <td><strong>${esc(p.model)}</strong><span>${esc(p.variant)}</span></td>
    <td>${euro(p.uvp)}</td>
    <td class="price-active">${euro(p.price)}</td>
    <td class="saving">${euro(p.uvp - p.price)}</td>
    <td>${euro(p.price - 100)}</td>
    <td>${p.bonus ? '720 Wh gratis' : '–'}</td>
  </tr>
`).join('');
