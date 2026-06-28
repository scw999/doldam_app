// 돌담 홈페이지 — 모션·인터랙션 (anime.js + prefers-reduced-motion 존중)

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── 1. Hero 콘텐츠 등장 애니메이션 (anime.js) ───
  function initHeroAnimations() {
    if (reduce || typeof anime === 'undefined') return;

    // Hero 콘텐츠 순차 등장
    anime.timeline({ easing: 'easeOutCubic' })
      .add({
        targets: '.hero-meta',
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 700,
      })
      .add({
        targets: '.hero h1',
        opacity: [0, 1],
        translateY: [28, 0],
        duration: 900,
      }, '-=400')
      .add({
        targets: '.hero-tag',
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 700,
      }, '-=500')
      .add({
        targets: '.hero-sub',
        opacity: [0, 1],
        duration: 600,
      }, '-=400')
      .add({
        targets: '.store-row',
        opacity: [0, 1],
        translateY: [14, 0],
        duration: 600,
      }, '-=400');
  }

  // ─── 2. Scroll reveal — IntersectionObserver로 진입 시 .in-view 토글 ───
  function initScrollReveal() {
    if (reduce || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  // ─── 3. TOC active section 하이라이트 (정책 페이지) ───
  function initTocHighlight() {
    const tocLinks = document.querySelectorAll('.legal-toc a[href^="#"]');
    if (tocLinks.length === 0 || !('IntersectionObserver' in window)) return;

    const targets = Array.from(tocLinks)
      .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);

    const tocIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const id = e.target.id;
          const link = document.querySelector(`.legal-toc a[href="#${id}"]`);
          if (!link) return;
          if (e.isIntersecting) {
            tocLinks.forEach((l) => l.removeAttribute('aria-current'));
            link.setAttribute('aria-current', 'true');
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    targets.forEach((t) => tocIO.observe(t));
  }

  // anime.js 못 불러오거나 reduced motion이면 hero 콘텐츠 즉시 표시 (fallback)
  function showHeroFallback() {
    document.querySelectorAll('.hero-meta, .hero h1, .hero-tag, .hero-sub, .store-row')
      .forEach((el) => { el.style.opacity = '1'; });
  }

  // ─── anime.js 로딩 대기 후 hero 초기화 ───
  function start() {
    initScrollReveal();
    initTocHighlight();
    if (reduce) {
      showHeroFallback();
      return;
    }
    if (typeof anime !== 'undefined') {
      initHeroAnimations();
    } else {
      // anime.js CDN 늦게 로드 — 최대 2초 대기
      let retries = 20;
      const wait = setInterval(() => {
        if (typeof anime !== 'undefined') {
          clearInterval(wait);
          initHeroAnimations();
        } else if (--retries <= 0) {
          clearInterval(wait);
          showHeroFallback();  // 끝까지 못 부르면 콘텐츠라도 보이게
        }
      }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
