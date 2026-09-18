/* Progressive motion only. HTML, links and native details never depend on this file. */
(() => {
  'use strict';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !Element.prototype.animate || !CSS.supports('translate', '1px')) return;

  const active = new Map();
  const seen = new WeakSet();
  let observer;
  let stopped = false;
  const ease = 'cubic-bezier(.16,1,.3,1)';

  function play(element, frames, options) {
    if (!element || stopped || document.hidden) return;
    const animation = element.animate(frames, options);
    active.set(element, animation);
    const release = () => {
      if (active.get(element) === animation) active.delete(element);
    };
    animation.finished.then(release, release);
  }
  function arrive(element, x = 0, y = 10, delay = 0, opacity = .65) {
    if (!element || seen.has(element)) return;
    seen.add(element);
    // Individual translate preserves the menu's existing rotation and geometry.
    play(element, [{ translate: `${x}px ${y}px`, opacity }, { translate: '0px 0px', opacity: 1 }],
      { duration: 560, delay, easing: ease, fill: 'backwards' });
  }
  function settleAll() {
    for (const animation of active.values()) animation.cancel();
    active.clear();
  }
  function stop() {
    stopped = true;
    observer?.disconnect();
    settleAll();
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
    arrive(document.querySelector('.wordmark'), -8, 0, 0, .5);
    arrive(document.querySelector('.menu-label'), -10, 0, 35, .4);
    document.querySelectorAll('.main-navigation a').forEach((item, i) => arrive(item, -18, 5, 65 + i * 45, .35));
    arrive(document.querySelector('.profile-intro'), 12, 6, 70, .5);
    arrive(document.querySelector('h1'), 18, 8, 115, .4);
    arrive(document.querySelector('.subtitle'), 12, 0, 170, .5);
    arrive(document.querySelector('.hero-links'), 0, 10, 210, .5);
    // One soft breath, then rest. Less than five seconds; no endless ambient loop.
    play(document.querySelector('.profile-orbit'), [
      { scale: '.99', opacity: .55 }, { scale: '1.018', opacity: .78, offset: .5 }, { scale: '1', opacity: .55 }
    ], { duration: 4200, easing: 'ease-in-out' });
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
    if (target) settleTarget(target);
  });
  // Stop on hidden tabs, printing, restored pages or a live accessibility preference change.
  document.addEventListener('visibilitychange', () => { if (document.hidden) settleAll(); });
  window.addEventListener('beforeprint', stop);
  window.addEventListener('pagehide', stop);
  preference.addEventListener('change', event => { if (event.matches) stop(); });
})();
