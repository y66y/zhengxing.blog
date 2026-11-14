(() => {
  'use strict';
  const root = document.querySelector('#experience');
  const dialog = document.querySelector('.experience-dialog');
  if (!root || !dialog) return;
  const data = window.EXPERIENCE_DATA || { places: [] };
  const places = (Array.isArray(data) ? data : data.places || []).filter(place =>
    place && typeof place.name === 'string' && Number.isFinite(place.lat) && Number.isFinite(place.lon) &&
    Math.abs(place.lat) <= 90 && Math.abs(place.lon) <= 180);
  const find = selector => dialog.querySelector(selector);
  const art = root.querySelector('.experience-map-art');
  const layer = root.querySelector('.experience-map-layer');
  const markers = root.querySelector('.experience-map-markers');
  const list = root.querySelector('.experience-places');
  const image = find('.experience-gallery-photo');
  const placeholder = find('.experience-gallery-placeholder');
  const previous = find('.experience-gallery-prev');
  const next = find('.experience-gallery-next');
  const close = find('.experience-gallery-close');
  const countryIds = { CHN: '156', CHE: '756', FRA: '250', GBR: '826', China: '156', Switzerland: '756', France: '250', 'United Kingdom': '826' };
  let activePlace = null;
  let photos = [];
  let photoIndex = 0;
  let opener = null;
  let previousOverflow = '';
  let swipeStart = null;
  let galleryOpen = false;

  // This SVG string is a bundled, locally generated asset, never user input.
  if (typeof window.EXPERIENCE_MAP_SVG === 'string') art.innerHTML = window.EXPERIENCE_MAP_SVG;
  const visited = new Set(places.map(place => countryIds[place.countryCode || place.country] || String(place.countryCode || '')));
  art.querySelectorAll('[data-country-code]').forEach(country => {
    country.classList.toggle('is-visited', visited.has(country.dataset.countryCode));
  });

  function safeUrl(value, allowRelative = false) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const raw = value.trim();
    if (/^(https?):\/\//i.test(raw)) return raw;
    if (allowRelative && !/^[a-z][a-z\d+.-]*:/i.test(raw) && !raw.startsWith('//')) return raw;
    return '';
  }

  function creditLink(text, url, parent) {
    const href = safeUrl(url);
    if (!href) { parent.append(document.createTextNode(text)); return; }
    const anchor = document.createElement('a');
    anchor.textContent = text; anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
    parent.append(anchor);
  }

  function renderPhoto() {
    const photo = photos[photoIndex];
    const caption = find('.experience-gallery-caption');
    const attribution = find('.experience-gallery-attribution');
    const counter = find('.experience-gallery-counter');
    attribution.replaceChildren();
    previous.disabled = next.disabled = photos.length < 2;
    image.hidden = true; image.removeAttribute('src'); image.alt = '';
    placeholder.hidden = false;
    if (!photo) {
      placeholder.textContent = 'Photographs will be added here soon.';
      caption.textContent = activePlace.name + ', ' + activePlace.country;
      counter.textContent = '';
      return;
    }
    placeholder.textContent = 'Loading photograph…';
    image.alt = photo.alt || photo.caption || 'A view of ' + activePlace.name;
    caption.textContent = photo.caption || photo.alt || '';
    const pieces = [];
    if (photo.author) pieces.push([photo.author, photo.authorUrl]);
    if (photo.license) pieces.push([photo.license, photo.licenseUrl]);
    const source = photo.sourceUrl || photo.source_url || photo.url;
    if (source) pieces.push([photo.title || photo.sourceLabel || 'Wikimedia Commons', source]);
    pieces.forEach(([text, url], index) => { if (index) attribution.append(document.createTextNode(' · ')); creditLink(text, url, attribution); });
    counter.textContent = `${photoIndex + 1} of ${photos.length}`;
    image.onload = () => { image.hidden = false; placeholder.hidden = true; };
    image.onerror = () => { image.hidden = true; placeholder.hidden = false; placeholder.textContent = 'This photograph is currently unavailable.'; };
    const src = safeUrl(photo.src, true);
    if (src) image.src = src;
    else { placeholder.textContent = 'This photograph is currently unavailable.'; }
  }

  function restorePage() {
    if (!galleryOpen) return;
    galleryOpen = false;
    document.body.style.overflow = previousOverflow;
    if (opener && opener.isConnected) opener.focus();
  }

  function openPlace(place, trigger) {
    activePlace = place; photos = Array.isArray(place.photos) ? place.photos.filter(p => p && typeof p.src === 'string') : [];
    photoIndex = 0; opener = trigger;
    find('#experience-gallery-title').textContent = place.name + ', ' + place.country;
    find('#experience-gallery-kind').textContent = place.galleryLabel || data.galleryLabel || 'Scenic photographs · Wikimedia Commons';
    renderPhoto(); previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; galleryOpen = true;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    close.focus();
  }

  function closeGallery() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    restorePage();
  }

  function step(delta) {
    if (photos.length < 2) return;
    photoIndex = (photoIndex + delta + photos.length) % photos.length; renderPhoto();
  }

  places.forEach(place => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'experience-place';
    button.append(document.createTextNode(place.name));
    button.setAttribute('aria-label', 'View photographs of ' + place.name + ', ' + place.country);
    const country = document.createElement('span'); country.textContent = place.country; button.append(country);
    button.addEventListener('click', () => openPlace(place, button)); list.append(button);
    const marker = document.createElement('button');
    const x = (place.lon + 180) / 360; const y = (90 - place.lat) / 180;
    marker.type = 'button'; marker.className = 'experience-map-marker';
    marker.style.left = `${x * 100}%`; marker.style.top = `${y * 100}%`;
    marker.dataset.x = String(x); marker.dataset.y = String(y);
    marker.title = place.name + ', ' + place.country;
    marker.setAttribute('aria-label', 'View photographs of ' + place.name + ', ' + place.country);
    marker.addEventListener('click', () => openPlace(place, marker)); markers.append(marker);
  });
  root.querySelector('.experience-empty').hidden = places.length > 0;
  if (!places.length) { root.querySelector('.experience-map-hint').hidden = true; root.querySelector('.experience-credit').hidden = true; }

  const views = { world: [1, 0.5, 0.5], europe: [7, (5 + 180) / 360, (90 - 48) / 180], china: [3, (112 + 180) / 360, (90 - 33) / 180] };
  root.querySelectorAll('[data-map-view]').forEach(button => {
    button.addEventListener('click', () => {
      const [zoom, cx, cy] = views[button.dataset.mapView] || views.world;
      const tx = 0.5 - cx * zoom; const ty = 0.5 - cy * zoom;
      layer.style.transform = `translate(${tx * 100}%, ${ty * 100}%) scale(${zoom})`;
      layer.style.setProperty('--map-zoom', String(zoom));
      markers.querySelectorAll('button').forEach(marker => {
        const x = Number(marker.dataset.x) * zoom + tx; const y = Number(marker.dataset.y) * zoom + ty;
        marker.hidden = x < 0 || x > 1 || y < 0 || y > 1;
      });
      root.querySelectorAll('[data-map-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    });
  });

  close.addEventListener('click', closeGallery);
  previous.addEventListener('click', () => step(-1)); next.addEventListener('click', () => step(1));
  dialog.addEventListener('close', () => { if (!dialog.open) restorePage(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeGallery(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeGallery(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'Tab') {
      const nodes = [...dialog.querySelectorAll('button:not(:disabled), a[href]')].filter(node => !node.hidden && node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  image.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') swipeStart = [event.clientX, event.clientY]; });
  image.addEventListener('pointerup', event => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart[0], dy = event.clientY - swipeStart[1]; swipeStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });
  image.addEventListener('pointercancel', () => { swipeStart = null; });
})();
