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
  const markers = root.querySelector('.experience-map-markers');
  const image = find('.experience-gallery-photo');
  const placeholder = find('.experience-gallery-placeholder');
  const previous = find('.experience-gallery-prev');
  const next = find('.experience-gallery-next');
  const close = find('.experience-gallery-close');
  const countryIds = { ITA: '380', ARE: '784', THA: '764', MYS: '458', JPN: '392', KOR: '410', TWN: '158', CHN: '156', CHE: '756', FRA: '250', GBR: '826', China: '156', Switzerland: '756', France: '250', 'United Kingdom': '826' };
  const placeLabel = place => [place.name, place.country].filter(Boolean).join(', ');
  let activePlace = null;
  let photos = [];
  let photoIndex = 0;
  let opener = null;
  let previousOverflow = '';
  let swipeStart = null;
  let galleryOpen = false;

  // This SVG string is a bundled, locally generated asset, never user input.
  if (typeof window.EXPERIENCE_MAP_SVG === 'string') art.innerHTML = window.EXPERIENCE_MAP_SVG;
  art.querySelector('svg')?.setAttribute('preserveAspectRatio', 'none');
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
      caption.textContent = placeLabel(activePlace);
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
    if (opener && opener.isConnected && opener.getClientRects().length) opener.focus();
    else {
      const target = [...markers.children].find(marker => markerIds(marker).includes(activePlace?.id));
      (target || viewport).focus({ preventScroll: true });
    }
  }

  function openPlace(place, trigger) {
    activePlace = place; photos = Array.isArray(place.photos) ? place.photos.filter(p => p && typeof p.src === 'string') : [];
    photoIndex = 0; opener = trigger;
    find('#experience-gallery-title').textContent = placeLabel(place);
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

  const viewport = root.querySelector('.experience-map-viewport');
  const zoomIn = root.querySelector('[data-map-zoom="in"]');
  const zoomOut = root.querySelector('[data-map-zoom="out"]');
  const reset = root.querySelector('[data-map-reset]');
  const regionButtons = [...root.querySelectorAll('[data-map-view]')];
  const views = {
    world: [1, .5, .5],
    europe: [9, (5 + 180) / 360, (90 - 48) / 180],
    china: [4.5, (108 + 180) / 360, (90 - 35) / 180],
    'south-china': [25, (114 + 180) / 360, (90 - 23) / 180],
    'east-asia': [7, (131 + 180) / 360, (90 - 36) / 180]
  };
  const points = places.map(place => ({ place, x: (place.lon + 180) / 360, y: (90 - place.lat) / 180 }));
  const state = { scale: 1, tx: 0, ty: 0 };
  const pointers = new Map();
  let currentView = 'world';
  let frame = 0;
  let dragging = false;
  let suppressClickUntil = 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const markerIds = node => (node?.dataset?.placeIds || '').split(' ').filter(Boolean);

  function setState(scale, tx, ty, view = '') {
    state.scale = clamp(scale, 1, 512);
    state.tx = clamp(tx, 1 - state.scale, 0);
    state.ty = clamp(ty, 1 - state.scale, 0);
    currentView = view;
    regionButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mapView === currentView)));
    zoomIn.disabled = state.scale >= 512;
    zoomOut.disabled = state.scale <= 1;
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderMarkers(); });
  }

  function zoomAt(scale, ax = .5, ay = .5) {
    const nextScale = clamp(scale, 1, 512);
    const ratio = nextScale / state.scale;
    setState(nextScale, ax - (ax - state.tx) * ratio, ay - (ay - state.ty) * ratio);
  }

  function setView(name) {
    const [scale, cx, cy] = views[name] || views.world;
    setState(scale, .5 - cx * scale, .5 - cy * scale, name);
  }

  function zoomToGroup(group) {
    const xs = group.points.map(point => point.x), ys = group.points.map(point => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const fit = Math.min(.72 / Math.max(maxX - minX, .00001), .68 / Math.max(maxY - minY, .00001));
    const scale = Math.min(512, Math.max(state.scale * 2, fit));
    setState(scale, .5 - (minX + maxX) / 2 * scale, .5 - (minY + maxY) / 2 * scale);
  }

  function renderMarkers() {
    const focused = document.activeElement;
    const hadFocus = markers.contains(focused);
    const focusedIds = markerIds(focused);
    const { scale, tx, ty } = state;
    art.style.transform = `translate(${tx * 100}%, ${ty * 100}%) scale(${scale})`;
    art.style.setProperty('--map-zoom', String(scale));
    viewport.dataset.mapScale = String(scale);
    const width = viewport.clientWidth, height = viewport.clientHeight, groups = [];
    if (!width || !height) return;
    for (const point of points) {
      const sx = point.x * scale + tx, sy = point.y * scale + ty;
      if (sx < 0 || sx > 1 || sy < 0 || sy > 1) continue;
      const group = groups.find(item => Math.hypot((sx - item.sx) * width, (sy - item.sy) * height) < 34);
      if (group) {
        const n = group.points.length;
        group.x = (group.x * n + point.x) / (n + 1); group.y = (group.y * n + point.y) / (n + 1);
        group.sx = (group.sx * n + sx) / (n + 1); group.sy = (group.sy * n + sy) / (n + 1);
        group.points.push(point);
      } else groups.push({ x: point.x, y: point.y, sx, sy, points: [point] });
    }
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        if (Math.hypot((a.sx - b.sx) * width, (a.sy - b.sy) * height) >= 34) continue;
        const n = a.points.length, m = b.points.length;
        for (const key of ['x', 'y', 'sx', 'sy']) a[key] = (a[key] * n + b[key] * m) / (n + m);
        a.points.push(...b.points); groups.splice(j, 1); merged = true; break outer;
      }
    }
    const existing = new Map([...markers.children].map(marker => [marker.dataset.placeIds, marker]));
    const nextMarkers = groups.map(group => {
      const ids = group.points.map(point => point.place.id).sort().join(' ');
      const marker = existing.get(ids) || document.createElement('button');
      marker.type = 'button'; marker.className = 'experience-map-marker'; marker.dataset.placeIds = ids;
      marker.style.left = `${group.sx * 100}%`; marker.style.top = `${group.sy * 100}%`;
      if (group.points.length === 1) {
        const place = group.points[0].place;
        marker.textContent = ''; marker.title = placeLabel(place);
        marker.setAttribute('aria-label', 'View photographs of ' + placeLabel(place));
        marker.onclick = () => openPlace(place, marker);
      } else {
        marker.classList.add('is-cluster'); marker.textContent = group.points.length;
        const label = group.points.map(point => point.place.name).join(', ');
        marker.title = label;
        marker.setAttribute('aria-label', `Zoom in on ${group.points.length} nearby places: ${label}`);
        marker.onclick = () => zoomToGroup(group);
      }
      return marker;
    });
    // Reuse buttons so unchanged markers keep pointer targets and keyboard focus.
    const retained = new Set(nextMarkers);
    [...markers.children].forEach(marker => { if (!retained.has(marker)) marker.remove(); });
    nextMarkers.forEach(marker => { if (marker.parentNode !== markers) markers.append(marker); });
    if (hadFocus && !focused.isConnected) {
      const target = nextMarkers.find(marker => markerIds(marker).some(id => focusedIds.includes(id)));
      (target || viewport).focus({ preventScroll: true });
    }
  }

  function localPoint(event) {
    const bounds = viewport.getBoundingClientRect();
    return { x: (event.clientX - bounds.left - viewport.clientLeft) / viewport.clientWidth,
      y: (event.clientY - bounds.top - viewport.clientTop) / viewport.clientHeight };
  }
  function capturePointers() {
    for (const id of pointers.keys()) {
      try { viewport.setPointerCapture(id); } catch (_) { /* The pointer may already have ended. */ }
    }
  }
  function startDrag() {
    dragging = true; suppressClickUntil = performance.now() + 400;
    viewport.classList.add('is-dragging'); capturePointers();
  }
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = localPoint(event);
    pointers.set(event.pointerId, { ...point, startX: event.clientX, startY: event.clientY });
    // Leave a single tap uncaptured so native button clicks and focus work normally.
    if (pointers.size > 1) startDrag();
  });
  viewport.addEventListener('pointermove', event => {
    const old = pointers.get(event.pointerId);
    if (!old) return;
    const point = localPoint(event);
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (!dragging && Math.hypot(event.clientX - old.startX, event.clientY - old.startY) < 4) return;
    startDrag();
    if (other) {
      const width = viewport.clientWidth, height = viewport.clientHeight;
      const oldDistance = Math.hypot((old.x - other.x) * width, (old.y - other.y) * height);
      const newDistance = Math.hypot((point.x - other.x) * width, (point.y - other.y) * height);
      const oldX = (old.x + other.x) / 2, oldY = (old.y + other.y) / 2;
      const newX = (point.x + other.x) / 2, newY = (point.y + other.y) / 2;
      const scale = clamp(state.scale * (oldDistance > 1 ? newDistance / oldDistance : 1), 1, 512);
      const ratio = scale / state.scale;
      setState(scale, newX - (oldX - state.tx) * ratio, newY - (oldY - state.ty) * ratio);
    } else setState(state.scale, state.tx + point.x - old.x, state.ty + point.y - old.y);
    pointers.set(event.pointerId, { ...old, ...point });
    event.preventDefault();
  });
  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (dragging) suppressClickUntil = performance.now() + 400;
    if (!pointers.size) { dragging = false; viewport.classList.remove('is-dragging'); }
    // The remaining pointer retains its latest position for a smooth pinch-to-pan transition.
    try { if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId); } catch (_) {}
  }
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('lostpointercapture', event => {
    if (event.target === viewport && pointers.has(event.pointerId)) endPointer(event);
  });
  window.addEventListener('pointerup', endPointer);
  viewport.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && event.detail !== 0) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  viewport.addEventListener('dragstart', event => event.preventDefault());
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    const point = localPoint(event);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    zoomAt(state.scale * Math.exp(-clamp(event.deltaY * unit, -600, 600) * .002), point.x, point.y);
  }, { passive: false });
  viewport.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === '+' || event.key === '=') zoomAt(state.scale * 1.7);
    else if (event.key === '-' || event.key === '_') zoomAt(state.scale / 1.7);
    else if (event.key === 'Home' || event.key === '0') setView('world');
    else {
      const pan = { ArrowLeft: [.12, 0], ArrowRight: [-.12, 0], ArrowUp: [0, .12], ArrowDown: [0, -.12] }[event.key];
      if (!pan) return;
      setState(state.scale, state.tx + pan[0], state.ty + pan[1]);
    }
    event.preventDefault();
  });
  zoomIn.addEventListener('click', () => zoomAt(state.scale * 1.7));
  zoomOut.addEventListener('click', () => zoomAt(state.scale / 1.7));
  reset.addEventListener('click', () => setView('world'));
  regionButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.mapView)));
  if ('ResizeObserver' in window) new ResizeObserver(renderMarkers).observe(viewport);
  else window.addEventListener('resize', renderMarkers);
  setView('world');

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
