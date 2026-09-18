/* Navigation remains available independently of animation preferences. */
(() => {
  'use strict';
  const container = document.querySelector('.section-navigation');
  if (!container) return;
  const drawer = container.querySelector('details');
  const summary = drawer.querySelector('summary');
  const links = [...container.querySelectorAll('a')];
  const sections = [...document.querySelectorAll('main>section')];
  let scheduled = false;
  let current;
  function update() {
    scheduled = false;
    const threshold = Math.min(160, innerHeight * .25);
    let id = 'home';
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= threshold) id = section.id;
    }
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) id = 'contact';
    if (id === current) return;
    current = id;
    document.documentElement.dataset.section = id;
    links.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }
  function close(returnFocus = false) {
    if (!drawer.open) return;
    drawer.open = false;
    if (returnFocus) summary.focus({preventScroll:true});
  }
  container.addEventListener('click', event => {
    if (event.target.closest('a')) close(true);
  });
  document.addEventListener('pointerdown', event => {
    if (!container.contains(event.target)) close();
  }, {passive:true});
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawer.open) { event.preventDefault(); close(true); }
  });
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', () => { close(); schedule(); }, {passive:true});
  window.addEventListener('pageshow', schedule);
  window.addEventListener('hashchange', schedule);
  update();
})();

/* Progressive motion only. HTML, links and native details never depend on this file. */
(() => {
  'use strict';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !Element.prototype.animate || !CSS.supports('translate', '1px')) return;

  const active = new Map();
  const seen = new WeakSet();
  let observer;
  const ease = 'cubic-bezier(.22,.65,.25,1)';
  let paused = false;
  let printing = false;
  try { paused = sessionStorage.getItem('linghan-motion-paused') === 'true'; } catch {}
  const toggle = document.createElement('button');
  toggle.className = 'motion-toggle';
  toggle.type = 'button';
  document.body.append(toggle);
  function syncMotion() {
    const off = paused || preference.matches || document.hidden || printing;
    document.documentElement.dataset.motion = off ? 'paused' : 'running';
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Resume page animations' : 'Pause page animations');
    toggle.hidden = preference.matches;
  }
  toggle.addEventListener('click', () => {
    paused = !paused;
    if (paused) settleAll();
    try { sessionStorage.setItem('linghan-motion-paused', String(paused)); } catch {}
    syncMotion();
  });
  syncMotion();

  function play(element, frames, options) {
    if (!element || paused || preference.matches || printing || document.hidden) return;
    const animation = element.animate(frames, options);
    active.set(element, animation);
    const release = () => {
      if (active.get(element) === animation) active.delete(element);
    };
    animation.finished.then(release, release);
  }
  function arrive(element, x = 0, y = 18, delay = 0, opacity = .55, duration = 850) {
    if (!element || seen.has(element)) return;
    seen.add(element);
    // Individual translate preserves the menu's existing rotation and geometry.
    play(element, [{ translate: `${x}px ${y}px`, opacity }, { translate: '0px 0px', opacity: 1 }],
      { duration, delay, easing: ease, fill: 'backwards' });
  }
  function settleAll() {
    for (const animation of active.values()) animation.cancel();
    active.clear();
  }
  function settleTarget(target) {
    for (const [element, animation] of active) {
      if (element === target || element.contains(target) || target.contains(element)) {
        animation.cancel();
        active.delete(element);
      }
    }
  }
  function currentTarget() {
    try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch { return null; }
  }

  // Skip a late entrance, a restored scroll position, or a link straight to research.
  const homeEntry = (!location.hash || location.hash === '#home') && scrollY < 24 && performance.now() < 1500;
  if (homeEntry) {
    arrive(document.querySelector('.wordmark'), -18, 0, 0, .35, 1000);
    arrive(document.querySelector('.menu-label'), -22, 0, 100, .3, 1000);
    document.querySelectorAll('.main-navigation a').forEach((item, i) => arrive(item, -46, 10, 140 + i * 120, .18, 1250));
    arrive(document.querySelector('.profile-intro'), 28, 14, 180, .3, 1200);
    arrive(document.querySelector('h1'), 42, 18, 300, .2, 1300);
    arrive(document.querySelector('.subtitle'), 28, 0, 460, .3, 1150);
    arrive(document.querySelector('.hero-links'), 0, 22, 580, .3, 1100);

  }

  // Independent background layers cannot affect the document's layout or reading order.
  document.querySelectorAll('.intro, main section').forEach(section => {
    const atmosphere = document.createElement('div');
    atmosphere.className = 'page-atmosphere';
    atmosphere.setAttribute('aria-hidden', 'true');
    section.prepend(atmosphere);
  });

  // Ambient motion belongs to decoration, runs only in view, and is always pausable.
  let ambientObserver;
  if ('IntersectionObserver' in window) {
    ambientObserver = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.classList.toggle('motion-visible', entry.isIntersecting);
    });
    document.querySelectorAll('.intro, main section, .profile-orbit, .interest-visual, .timeline>li').forEach(el => ambientObserver.observe(el));
  }

  if ('IntersectionObserver' in window) {
    const target = currentTarget();
    const blocks = document.querySelectorAll('main section>h2, .about-copy, .interests>li, .broader-interests, .project-heading, .study-details, .emerging-directions, .background-group>h3, .timeline>li, .contact-links');
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (entry.target.contains(document.activeElement)) continue;
        arrive(entry.target);
      }
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    for (const block of blocks) {
      // Deep links are immediately readable, without a second animation over the target.
      if (target && (target.contains(block) || block.contains(target))) seen.add(block);
      else observer.observe(block);
    }
  }

  document.addEventListener('pointerdown', event => settleTarget(event.target), { passive: true });
  document.addEventListener('focusin', event => settleTarget(event.target));
  window.addEventListener('wheel', settleAll, { passive: true });
  window.addEventListener('touchstart', settleAll, { passive: true });
  document.addEventListener('pointerover', event => {
    const link = event.target.closest('a, summary');
    if (link) settleTarget(link);
  }, { passive: true });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    // Native anchors retain control; don't move an interactive destination as it arrives.
    try {
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;
      settleTarget(target);
      for (const block of target.querySelectorAll('*')) seen.add(block);
      seen.add(target);
    } catch { /* A malformed hash must never prevent native navigation. */ }
  });
  window.addEventListener('hashchange', () => {
    const target = currentTarget();
    if (!target) return;
    settleTarget(target);
    const panels = target.id === 'home'
      ? document.querySelectorAll('.main-navigation, .site-header')
      : target.matches('main section')
        ? [...target.children].filter(el => !el.classList.contains('page-atmosphere'))
        : [];
    // Section selection gets a visible transition; anchors still scroll natively.
    [...panels].forEach((panel, i) => {
      seen.delete(panel);
      arrive(panel, i ? 16 : -12, 12, Math.min(i * 75, 225), .45, 1050);
    });
  });
  // Stop on hidden tabs, printing, restored pages or a live accessibility preference change.
  document.addEventListener('visibilitychange', () => { if (document.hidden) settleAll(); syncMotion(); });
  window.addEventListener('beforeprint', () => { printing = true; settleAll(); syncMotion(); });
  window.addEventListener('afterprint', () => { printing = false; syncMotion(); });
  window.addEventListener('pagehide', () => { settleAll(); });
  preference.addEventListener('change', () => { settleAll(); syncMotion(); });
})();
