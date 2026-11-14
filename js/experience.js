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
  const countryIds = { JPN: '392', KOR: '410', TWN: '158', CHN: '156', CHE: '756', FRA: '250', GBR: '826', China: '156', Switzerland: '756', France: '250', 'United Kingdom': '826' };
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
    else root.querySelector('#experience-search').focus();
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

  const search = root.querySelector('#experience-search');
  const count = root.querySelector('#experience-count');
  const clusterPanel = root.querySelector('.experience-cluster-panel');
  const clusterList = root.querySelector('.experience-cluster-places');
  const viewport = root.querySelector('.experience-map-viewport');
  const placeButtons = new Map();
  let matchingPlaces = places;
  let currentView = 'world';
  let clusterOpener = null;
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\s'’‘-]/g, '').toLowerCase();
  const views = {
    world: [1, .5, .5],
    europe: [9, (5 + 180) / 360, (90 - 48) / 180],
    china: [4.5, (108 + 180) / 360, (90 - 35) / 180],
    'south-china': [25, (114 + 180) / 360, (90 - 23) / 180],
    'east-asia': [7, (131 + 180) / 360, (90 - 36) / 180]
  };
  function makePlaceButton(place) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'experience-place'; button.dataset.placeId = place.id;
    button.append(document.createTextNode(place.name));
    button.setAttribute('aria-label', 'View photographs of ' + placeLabel(place));
    if (place.country) { const label = document.createElement('span'); label.textContent = place.country; button.append(label); }
    button.addEventListener('click', () => openPlace(place, button));
    return button;
  }
  places.forEach(place => {
    const button = makePlaceButton(place); placeButtons.set(place.id, button); list.append(button);
  });
  function closeCluster(restoreFocus = false) {
    clusterPanel.hidden = true;
    if (restoreFocus && clusterOpener && clusterOpener.isConnected) clusterOpener.focus();
  }
  function showCluster(group, button) {
    clusterOpener = button; clusterList.replaceChildren(...group.map(makePlaceButton));
    clusterPanel.hidden = false;
    clusterPanel.querySelector('h3').textContent = 'Choose a place · ' + group.length;
    clusterList.querySelector('button').focus({ preventScroll: true });
    clusterPanel.scrollIntoView({block:'nearest',behavior:'auto'});
  }
  function renderMarkers() {
    const [zoom, cx, cy] = views[currentView];
    const tx = .5 - cx * zoom, ty = .5 - cy * zoom;
    layer.style.transform = `translate(${tx * 100}%, ${ty * 100}%) scale(${zoom})`;
    layer.style.setProperty('--map-zoom', String(zoom));
    const width = viewport.clientWidth, height = viewport.clientHeight, groups = [];
    for (const place of matchingPlaces) {
      const x = (place.lon + 180) / 360, y = (90 - place.lat) / 180;
      const sx = x * zoom + tx, sy = y * zoom + ty;
      if (sx < 0 || sx > 1 || sy < 0 || sy > 1) continue;
      const group = groups.find(g => Math.hypot((sx - g.sx) * width, (sy - g.sy) * height) < 34);
      if (group) {
        const n = group.places.length;
        group.x = (group.x * n + x)/(n+1); group.y = (group.y * n + y)/(n+1);
        group.sx = (group.sx * n + sx)/(n+1); group.sy = (group.sy * n + sy)/(n+1);
        group.places.push(place);
      } else groups.push({x,y,sx,sy,places:[place]});
    }
    // Centroids can move as points are added; merge again until markers no longer overlap.
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i=0;i<groups.length;i++) for (let j=i+1;j<groups.length;j++) {
        const a=groups[i], b=groups[j];
        if (Math.hypot((a.sx-b.sx)*width,(a.sy-b.sy)*height)>=34) continue;
        const n=a.places.length,m=b.places.length;
        for (const k of ['x','y','sx','sy']) a[k]=(a[k]*n+b[k]*m)/(n+m);
        a.places.push(...b.places);groups.splice(j,1);merged=true;break outer;
      }
    }
    markers.replaceChildren();
    groups.forEach(group => {
      const marker = document.createElement('button');
      marker.type = 'button'; marker.className = 'experience-map-marker';
      marker.style.left = `${group.x * 100}%`; marker.style.top = `${group.y * 100}%`;
      marker.dataset.placeIds = group.places.map(p => p.id).join(' ');
      if (group.places.length === 1) {
        const place = group.places[0]; marker.title = placeLabel(place);
        marker.setAttribute('aria-label','View photographs of ' + placeLabel(place));
        marker.addEventListener('click',() => openPlace(place,marker));
      } else {
        marker.classList.add('is-cluster'); marker.textContent = group.places.length;
        const label = group.places.map(p => p.name).join(', ');
        marker.title = label; marker.setAttribute('aria-label', `${group.places.length} nearby places: ${label}`);
        marker.addEventListener('click',() => showCluster(group.places,marker));
      }
      markers.append(marker);
    });
  }
  function filterPlaces() {
    const query = normalize(search.value.trim());
    matchingPlaces = places.filter(place => normalize([place.id,place.name,place.country,...(place.aliases || [])].join(' ')).includes(query));
    const visible = new Set(matchingPlaces.map(p => p.id));
    placeButtons.forEach((button,id) => { button.hidden = !visible.has(id); });
    count.textContent = query ? `${matchingPlaces.length} of ${places.length} places` : `${places.length} places · ${places.reduce((n,p)=>n+(p.photos||[]).length,0)} photographs`;
    root.querySelector('.experience-empty').hidden = matchingPlaces.length > 0;
    root.querySelector('.experience-empty').textContent = 'No places match your search.';
    closeCluster(); renderMarkers();
  }
  search.addEventListener('input',filterPlaces);
  root.querySelector('.experience-cluster-close').addEventListener('click',()=>closeCluster(true));
  clusterPanel.addEventListener('keydown',event => { if(event.key==='Escape'){event.preventDefault();closeCluster(true);} });
  root.querySelectorAll('[data-map-view]').forEach(button => button.addEventListener('click',() => {
    currentView = button.dataset.mapView; closeCluster(); renderMarkers();
    root.querySelectorAll('[data-map-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  }));
  function resizeMap() {
    const active=document.activeElement;
    const restore=markers.contains(active)||clusterPanel.contains(active);
    const ids=(active.dataset.placeIds||active.dataset.placeId||'').split(' ');
    closeCluster();renderMarkers();
    if (restore) {
      const target=[...markers.querySelectorAll('button')].find(button=>button.dataset.placeIds.split(' ').some(id=>ids.includes(id)));
      (target||search).focus({preventScroll:true});
    }
  }
  if ('ResizeObserver' in window) new ResizeObserver(resizeMap).observe(viewport);
  else window.addEventListener('resize',resizeMap);
  filterPlaces();

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
