const PAGE_SIZE = 18;
const FEATURED_COUNT = 10;

let _photos = [];
let _shuffled = [];
let _rendered = 0;
let _activeFilter = 'all';
let _lbIndex = 0;
let _lbWired = false;
let _lazyObs = null;
let _scrollObs = null;
let _touchStartX = 0;
let _lbPhotos = null;

function shuffleForSession(photos) {
  const key = `gal-order-v${photos.length}`;
  const stored = sessionStorage.getItem(key);
  if (stored) {
    try {
      const order = JSON.parse(stored);
      if (Array.isArray(order) && order.length === photos.length) {
        return order.map(i => photos[i]);
      }
    } catch (_) {}
  }
  const indices = photos.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  sessionStorage.setItem(key, JSON.stringify(indices));
  return indices.map(i => photos[i]);
}

function catLabel(cat) {
  if (!cat) return '';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function createTile(photo, index, featured = false) {
  const tile = document.createElement('div');
  tile.className = featured ? 'gal-feat-tile' + (index === 0 ? ' gal-feat-hero' : '') : 'gal-item';
  if (!featured) {
    tile.dataset.cat = photo.cat || '';
    if (_activeFilter !== 'all' && photo.cat !== _activeFilter) tile.style.display = 'none';
  }
  tile.setAttribute('role', 'button');
  tile.setAttribute('tabindex', '0');

  const img = document.createElement('img');
  img.alt = photo.caption || photo.who || '';
  img.dataset.src = photo.thumb || photo.src;
  img.style.opacity = '0';

  const over = document.createElement('div');
  over.className = featured ? 'gal-feat-over' : 'gal-item-over';

  if (photo.cat) {
    const catEl = document.createElement('span');
    catEl.className = 'gal-item-cat';
    catEl.textContent = catLabel(photo.cat);
    over.appendChild(catEl);
  }
  if (photo.who) {
    const whoEl = document.createElement('span');
    whoEl.className = 'gal-item-who';
    whoEl.textContent = photo.who;
    over.appendChild(whoEl);
  }
  if (featured && photo.caption) {
    const capEl = document.createElement('span');
    capEl.className = 'gal-featured-cap';
    capEl.textContent = photo.caption;
    over.appendChild(capEl);
  }

  tile.appendChild(img);
  tile.appendChild(over);

  const globalIndex = _shuffled.indexOf(photo);
  tile.addEventListener('click', () => openLightbox(globalIndex === -1 ? 0 : globalIndex));
  tile.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(globalIndex === -1 ? 0 : globalIndex);
    }
  });

  return { tile, img };
}

function initLazyObserver() {
  if (_lazyObs) _lazyObs.disconnect();
  _lazyObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.dataset.src) {
        img.src = img.dataset.src;
        img.onload = () => {
          img.style.opacity = '';
          img.classList.add('gal-loaded');
        };
        img.onerror = () => { img.style.opacity = ''; };
        delete img.dataset.src;
      }
      _lazyObs.unobserve(img);
    });
  }, { rootMargin: '300px' });
  return _lazyObs;
}

function observeImg(img) {
  _lazyObs.observe(img);
}

function renderFeatured() {
  const strip = document.getElementById('gal-featured-strip');
  if (!strip) return;
  strip.innerHTML = '';
  const slice = _shuffled.slice(0, FEATURED_COUNT);
  slice.forEach((photo, i) => {
    const { tile, img } = createTile(photo, i, true);
    strip.appendChild(tile);
    observeImg(img);
  });
}

function renderBatch() {
  const grid = document.getElementById('gal-masonry');
  if (!grid) return;
  const batch = _shuffled.slice(_rendered, _rendered + PAGE_SIZE);
  batch.forEach(photo => {
    const { tile, img } = createTile(photo, _rendered, false);
    grid.appendChild(tile);
    observeImg(img);
    _rendered++;
  });
  updateSentinel();
}

function updateSentinel() {
  const sentinel = document.getElementById('gal-sentinel');
  if (!sentinel) return;
  if (_rendered >= _shuffled.length) {
    sentinel.style.display = 'none';
  } else {
    sentinel.style.display = '';
  }
}

function initScrollObserver() {
  if (_scrollObs) _scrollObs.disconnect();
  const sentinel = document.getElementById('gal-sentinel');
  if (!sentinel) return;
  _scrollObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) renderBatch();
  }, { rootMargin: '200px' });
  _scrollObs.observe(sentinel);
}

function updateMeta() {
  const meta = document.getElementById('gal-meta');
  if (!meta) return;
  if (_activeFilter === 'all') {
    meta.textContent = `${_shuffled.length} photo${_shuffled.length !== 1 ? 's' : ''} — a different order awaits on your next visit`;
  } else {
    const visible = _shuffled.filter(p => (p.cat || '') === _activeFilter).length;
    meta.textContent = `${visible} ${_activeFilter} photo${visible !== 1 ? 's' : ''}`;
  }
}

function applyFilter(cat) {
  _activeFilter = cat;
  const grid = document.getElementById('gal-masonry');
  if (!grid) return;
  grid.querySelectorAll('.gal-item').forEach(tile => {
    if (cat === 'all' || tile.dataset.cat === cat) {
      tile.style.display = '';
    } else {
      tile.style.display = 'none';
    }
  });
  updateMeta();
}

function wireFilters() {
  document.querySelectorAll('.gal-filter[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gal-filter[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.cat);
    });
  });
}

function buildLightbox() {
  if (document.getElementById('gal-lightbox')) return;
  const lb = document.createElement('div');
  lb.id = 'gal-lightbox';
  lb.className = 'gal-lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');

  const close = document.createElement('button');
  close.id = 'gal-lb-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';

  const prev = document.createElement('button');
  prev.id = 'gal-lb-prev';
  prev.setAttribute('aria-label', 'Previous');
  prev.textContent = '‹';

  const next = document.createElement('button');
  next.id = 'gal-lb-next';
  next.setAttribute('aria-label', 'Next');
  next.textContent = '›';

  const img = document.createElement('img');
  img.id = 'gal-lb-img';
  img.alt = '';

  const cap = document.createElement('figcaption');
  cap.id = 'gal-lb-cap';

  const counter = document.createElement('span');
  counter.id = 'gal-lb-counter';

  lb.appendChild(close);
  lb.appendChild(prev);
  lb.appendChild(next);
  lb.appendChild(img);
  lb.appendChild(cap);
  lb.appendChild(counter);
  document.body.appendChild(lb);
}

function lbShow(index) {
  const lb = document.getElementById('gal-lightbox');
  const img = document.getElementById('gal-lb-img');
  const cap = document.getElementById('gal-lb-cap');
  const counter = document.getElementById('gal-lb-counter');
  if (!lb || !img) return;
  const arr = _lbPhotos || _shuffled;
  const photo = arr[index];
  if (!photo) return;
  _lbIndex = index;
  img.style.opacity = '0';
  img.onload = () => { img.style.opacity = '1'; };
  img.src = photo.src;
  img.alt = photo.caption || photo.who || '';
  if (cap) cap.textContent = [photo.caption, photo.who].filter(Boolean).join(' — ');
  if (counter) counter.textContent = `${index + 1} / ${arr.length}`;
}

function openLightbox(index) {
  buildLightbox();
  wireLightbox();
  const lb = document.getElementById('gal-lightbox');
  if (!lb) return;
  lbShow(index);
  const scrollY = window.scrollY;
  document.body.dataset.lbScroll = scrollY;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  lb.classList.add('open');
}

function closeLightbox() {
  const lb = document.getElementById('gal-lightbox');
  if (!lb) return;
  lb.classList.remove('open');
  const scrollY = parseFloat(document.body.dataset.lbScroll || '0');
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, scrollY);
  _lbPhotos = null;
}

function lbPrev() {
  const arr = _lbPhotos || _shuffled;
  lbShow((_lbIndex - 1 + arr.length) % arr.length);
}

function lbNext() {
  const arr = _lbPhotos || _shuffled;
  lbShow((_lbIndex + 1) % arr.length);
}

function wireLightbox() {
  if (_lbWired) return;
  _lbWired = true;

  const lb = document.getElementById('gal-lightbox');
  const closeBtn = document.getElementById('gal-lb-close');
  const prevBtn = document.getElementById('gal-lb-prev');
  const nextBtn = document.getElementById('gal-lb-next');

  closeBtn && closeBtn.addEventListener('click', closeLightbox);
  prevBtn && prevBtn.addEventListener('click', lbPrev);
  nextBtn && nextBtn.addEventListener('click', lbNext);

  lb && lb.addEventListener('click', e => {
    if (e.target === lb) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    const lb = document.getElementById('gal-lightbox');
    if (!lb || !lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbPrev();
    else if (e.key === 'ArrowRight') lbNext();
  });

  document.addEventListener('touchstart', e => {
    const lb = document.getElementById('gal-lightbox');
    if (!lb || !lb.classList.contains('open')) return;
    _touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const lb = document.getElementById('gal-lightbox');
    if (!lb || !lb.classList.contains('open')) return;
    const dx = e.changedTouches[0].clientX - _touchStartX;
    if (Math.abs(dx) > 50) dx < 0 ? lbNext() : lbPrev();
  }, { passive: true });
}

function showEmptyState() {
  const empty = document.getElementById('gal-empty');
  const meta = document.getElementById('gal-meta');
  const sentinel = document.getElementById('gal-sentinel');
  if (empty) empty.style.display = '';
  if (meta) meta.style.display = 'none';
  const featured = document.querySelector('.gal-featured');
  if (featured) featured.style.display = 'none';
  if (sentinel) sentinel.style.display = 'none';
}

function hideEmptyState() {
  const empty = document.getElementById('gal-empty');
  const meta = document.getElementById('gal-meta');
  const featured = document.querySelector('.gal-featured');
  if (empty) empty.style.display = 'none';
  if (meta) meta.style.display = '';
  if (featured) featured.style.display = '';
}

function reset() {
  _rendered = 0;
  _activeFilter = 'all';
  const grid = document.getElementById('gal-masonry');
  if (grid) grid.innerHTML = '';
  const strip = document.getElementById('gal-featured-strip');
  if (strip) strip.innerHTML = '';
  if (_scrollObs) { _scrollObs.disconnect(); _scrollObs = null; }
}

export function initGallery(photos) {
  _photos = Array.isArray(photos) ? photos : [];
  reset();
  initLazyObserver();

  if (_photos.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();
  _shuffled = shuffleForSession(_photos);

  renderFeatured();
  renderBatch();
  updateMeta();
  wireFilters();
  initScrollObserver();
}

export function refreshGallery(photos) {
  const incoming = Array.isArray(photos) ? photos : [];
  if (incoming.length === _photos.length) return;
  initGallery(incoming);
}

export function openGalleryLightbox(photos, index) {
  _lbPhotos = photos;
  buildLightbox();
  wireLightbox();
  const lb = document.getElementById('gal-lightbox');
  if (!lb) return;
  lbShow(index);
  const scrollY = window.scrollY;
  document.body.dataset.lbScroll = scrollY;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  lb.classList.add('open');
}
