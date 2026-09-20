(function () {
  'use strict';

  var ZO = '6347430';
  var LOOKUP_URL = 'https://www.amsoil.com/lookup/?zo=' + ZO;
  var SHOP_URL = 'https://www.amsoil.com/?zo=' + ZO;
  var VEHICLES_BASE = 'assets/vehicles/';

  var yearSel = document.getElementById('year');
  var makeSel = document.getElementById('make');
  var modelSel = document.getElementById('model');
  var modelFilter = document.getElementById('model-filter');
  var statusEl = document.getElementById('catalog-status');
  var form = document.getElementById('finder-form');
  var results = document.getElementById('results');
  var list = document.getElementById('category-list');
  var intro = document.getElementById('results-intro');
  var vehicleLabel = document.getElementById('results-vehicle');

  var tabVehicle = document.getElementById('tab-vehicle');
  var tabEquipment = document.getElementById('tab-equipment');
  var panelVehicle = document.getElementById('panel-vehicle');
  var panelEquipment = document.getElementById('panel-equipment');

  var mode = 'vehicle';
  var yearData = null; // { make: [models] }
  var yearsMeta = null;
  var yearCache = {};

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', !!isError);
    statusEl.hidden = !msg;
  }

  function clearSelect(sel, placeholder) {
    sel.innerHTML = '';
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    sel.appendChild(opt);
  }

  function enable(el, on) {
    el.disabled = !on;
  }

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function setMode(next) {
    mode = next;
    var isVehicle = next === 'vehicle';
    tabVehicle.classList.toggle('active', isVehicle);
    tabEquipment.classList.toggle('active', !isVehicle);
    tabVehicle.setAttribute('aria-selected', isVehicle ? 'true' : 'false');
    tabEquipment.setAttribute('aria-selected', isVehicle ? 'false' : 'true');
    panelVehicle.classList.toggle('hidden', !isVehicle);
    panelEquipment.classList.toggle('hidden', isVehicle);
  }

  tabVehicle.addEventListener('click', function () { setMode('vehicle'); });
  tabEquipment.addEventListener('click', function () { setMode('equipment'); });

  var byEquipment = {
    'diesel-pickup': [
      { name: 'Heavy-duty / diesel engine oil', note: 'Match viscosity & API / OEM diesel specs on AMSOIL.com' },
      { name: 'Automatic or manual transmission fluid', note: 'Confirm transmission type in official lookup' },
      { name: 'Differential / gear lube', note: 'Front/rear as equipped; verify weight & limited-slip needs' },
      { name: 'Oil filter & by-pass filtration (if applicable)', note: 'Fitment via AMSOIL.com lookup' },
      { name: 'Coolant / antifreeze (as needed)', note: 'Follow OEM coolant chemistry requirements' }
    ],
    'gas-passenger': [
      { name: 'Passenger-car / light-truck synthetic motor oil', note: 'Verify viscosity & API/ILSAC specs' },
      { name: 'Oil filter', note: 'Confirm fitment on AMSOIL.com' },
      { name: 'Automatic transmission fluid (if automatic)', note: 'Match OEM ATF specification' },
      { name: 'Differential / transfer case fluid (AWD/4WD)', note: 'As equipped — verify on lookup' }
    ],
    'european': [
      { name: 'European-formula / ACEA-minded motor oil', note: 'Match ACEA class & OEM approvals on AMSOIL.com' },
      { name: 'Oil filter', note: 'Confirm application' },
      { name: 'OEM-spec automatic transmission fluid', note: 'Many European cars need specific ATF — verify' },
      { name: 'Coolant meeting OEM chemistry', note: 'Do not mix incompatible coolants' }
    ],
    'motorcycle': [
      { name: 'Motorcycle engine oil (shared-sump or separate)', note: 'Confirm wet-clutch / JASO needs on AMSOIL.com' },
      { name: 'Fork oil / suspension fluid (as needed)', note: 'Match weight recommended by OEM' },
      { name: 'Chain lube or primary/transmission (as equipped)', note: 'Depends on bike design — verify' },
      { name: 'Oil filter', note: 'Confirm fitment' }
    ],
    'lawn': [
      { name: 'Small-engine / 4-stroke motor oil', note: 'Match viscosity for air-cooled engines' },
      { name: 'Grease for deck / linkages (as needed)', note: 'Optional maintenance category' },
      { name: 'Fuel additive / stabilizer (seasonal)', note: 'Follow label; verify product on AMSOIL.com' }
    ],
    'classic': [
      { name: 'Classic / high-zinc or appropriate motor oil', note: 'Flat-tappet & seal considerations — verify suitability' },
      { name: 'Gear lube for differential / manual gearbox', note: 'Match weight & GL rating' },
      { name: 'Grease', note: 'Chassis & bearings as applicable' },
      { name: 'Transmission fluid (if automatic)', note: 'Older ATF specs — confirm on AMSOIL.com' }
    ],
    'atv-utv': [
      { name: 'ATV/UTV engine oil', note: 'Confirm wet-clutch / OEM viscosity on AMSOIL.com' },
      { name: 'Transmission / differential fluid', note: 'As equipped' },
      { name: 'Grease', note: 'Suspension & driveline points' }
    ],
    'marine': [
      { name: 'Marine engine oil / outboard oil category', note: '2-stroke vs 4-stroke critical — verify on AMSOIL.com' },
      { name: 'Lower unit / gear lube (as equipped)', note: 'Confirm application' }
    ],
    'other': [
      { name: 'Use official AMSOIL.com lookup', note: 'Enter exact equipment for authoritative recommendations' }
    ]
  };

  var defaultVehicleCategories = [
    { name: 'Synthetic motor oil', note: 'Confirm viscosity & specifications for your exact engine' },
    { name: 'Oil filter', note: 'Fitment via AMSOIL.com vehicle lookup' },
    { name: 'Transmission fluid', note: 'Automatic, DCT, CVT, or manual — match OEM spec' },
    { name: 'Differential / transfer case fluid (if equipped)', note: 'Verify weights and limited-slip requirements' },
    { name: 'Coolant / grease (as needed)', note: 'Follow OEM guidance; verify products on AMSOIL.com' }
  ];

  function inferEquipmentFromMake(make, model) {
    var m = (make + ' ' + model).toLowerCase();
    if (/bmw|mercedes|volkswagen|audi|volvo|porsche|mini|alfa romeo|jaguar|land rover|bentley|rolls|ferrari|lamborghini|maserati|fiat/.test(m)) {
      return 'european';
    }
    if (/silverado|sierra|f-?250|f-?350|f250|f350|ram 2500|ram 3500|powerstroke|duramax|cummins|super duty|hd\b/.test(m)) {
      return 'diesel-pickup';
    }
    return 'gas-passenger';
  }

  function showResults(label, cats) {
    list.innerHTML = '';
    cats.forEach(function (c) {
      var li = document.createElement('li');
      li.innerHTML = c.name + '<small>' + c.note + '</small>';
      list.appendChild(li);
    });
    if (vehicleLabel) vehicleLabel.textContent = label;
    intro.textContent =
      'Suggested fluid categories for “' + label + '”. Categories only — not exact SKUs, viscosities, or capacities. Confirm on AMSOIL.com before buying. No prices are shown on this site.';
    results.classList.add('visible');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function populateMakes() {
    clearSelect(makeSel, 'Select make');
    clearSelect(modelSel, 'Select model');
    if (modelFilter) modelFilter.value = '';
    enable(modelSel, false);
    enable(modelFilter, false);
    if (!yearData) {
      enable(makeSel, false);
      return;
    }
    var makes = Object.keys(yearData).sort(function (a, b) {
      return a.localeCompare(b);
    });
    makes.forEach(function (make) {
      var opt = document.createElement('option');
      opt.value = make;
      opt.textContent = make;
      makeSel.appendChild(opt);
    });
    enable(makeSel, true);
  }

  function populateModels(filterText) {
    clearSelect(modelSel, 'Select model');
    var make = makeSel.value;
    if (!yearData || !make || !yearData[make]) {
      enable(modelSel, false);
      enable(modelFilter, false);
      return;
    }
    var models = yearData[make];
    var q = normalize(filterText || '');
    var shown = 0;
    models.forEach(function (model) {
      if (q && normalize(model).indexOf(q) === -1) return;
      var opt = document.createElement('option');
      opt.value = model;
      opt.textContent = model;
      modelSel.appendChild(opt);
      shown++;
    });
    enable(modelSel, true);
    enable(modelFilter, true);
    if (q && shown === 0) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No models match filter';
      empty.disabled = true;
      modelSel.appendChild(empty);
    }
  }

  function loadYear(year) {
    yearData = null;
    clearSelect(makeSel, 'Loading makes…');
    clearSelect(modelSel, 'Select model');
    enable(makeSel, false);
    enable(modelSel, false);
    enable(modelFilter, false);
    if (modelFilter) modelFilter.value = '';

    if (!year) {
      clearSelect(makeSel, 'Select make');
      setStatus('');
      return Promise.resolve();
    }

    if (yearCache[year]) {
      yearData = yearCache[year];
      populateMakes();
      setStatus(Object.keys(yearData).length + ' makes loaded for ' + year);
      return Promise.resolve();
    }

    setStatus('Loading vehicle catalog for ' + year + '…');
    return fetch(VEHICLES_BASE + year + '.json', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        yearCache[year] = data;
        yearData = data;
        populateMakes();
        setStatus(Object.keys(data).length + ' makes · pick make then model');
      })
      .catch(function (err) {
        clearSelect(makeSel, 'Select make');
        setStatus('Could not load catalog for ' + year + '. Try again or use AMSOIL.com lookup.', true);
        console.error(err);
      });
  }

  yearSel.addEventListener('change', function () {
    loadYear(yearSel.value);
  });

  makeSel.addEventListener('change', function () {
    if (modelFilter) modelFilter.value = '';
    populateModels('');
  });

  if (modelFilter) {
    modelFilter.addEventListener('input', function () {
      populateModels(modelFilter.value);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var cats;
    var label;

    if (mode === 'equipment') {
      var eq = document.getElementById('equipment').value;
      if (!eq) {
        alert('Please select an equipment type.');
        return;
      }
      cats = byEquipment[eq] || byEquipment.other;
      label = document.getElementById('equipment').selectedOptions[0].textContent;
    } else {
      var year = yearSel.value;
      var make = makeSel.value;
      var model = modelSel.value;
      if (!year || !make || !model) {
        alert('Please select year, make, and model.');
        return;
      }
      var key = inferEquipmentFromMake(make, model);
      cats = byEquipment[key] || defaultVehicleCategories;
      label = year + ' ' + make + ' ' + model;
    }

    showResults(label, cats);
  });

  // Wire CTA buttons if present
  var btnLookup = document.getElementById('cta-lookup');
  var btnShop = document.getElementById('cta-shop');
  if (btnLookup) btnLookup.href = LOOKUP_URL;
  if (btnShop) btnShop.href = SHOP_URL;

  // Bootstrap years
  setStatus('Loading year list…');
  clearSelect(yearSel, 'Loading…');
  enable(yearSel, false);
  enable(makeSel, false);
  enable(modelSel, false);
  enable(modelFilter, false);

  fetch(VEHICLES_BASE + 'years.json', { credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (meta) {
      yearsMeta = meta;
      clearSelect(yearSel, 'Select year');
      (meta.years || []).forEach(function (y) {
        var opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = String(y);
        yearSel.appendChild(opt);
      });
      enable(yearSel, true);
      var stats = meta.stats || {};
      var note =
        'Catalog: ' +
        (meta.minYear || '') +
        '–' +
        (meta.maxYear || '') +
        ' · ' +
        (stats.uniqueMakeCount || (meta.uniqueMakes || []).length) +
        '+ makes · sourced from US EPA Fuel Economy menus (not an AMSOIL product database).';
      setStatus(note);
      var srcNote = document.getElementById('catalog-source-note');
      if (srcNote) {
        srcNote.textContent =
          'Catalog sourced from US EPA Fuel Economy vehicle menus; not an AMSOIL product database. Covers ' +
          meta.minYear +
          '–' +
          meta.maxYear +
          ' US light-duty vehicles in the EPA menu.';
      }
    })
    .catch(function (err) {
      clearSelect(yearSel, 'Select year');
      setStatus('Catalog failed to load. Use equipment type or AMSOIL.com lookup.', true);
      console.error(err);
    });
})();
