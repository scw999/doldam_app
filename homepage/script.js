// 돌담 홈페이지 — 가벼운 인터랙션 (모션, 접근성)
// prefers-reduced-motion 존중

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll reveal — IntersectionObserver로 진입 시 .in-view 토글
  if (!reduce && 'IntersectionObserver' in window) {
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
  } else {
    // 모션 거부 또는 IO 미지원 → 즉시 표시
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in-view'));
  }

  // TOC active section 하이라이트 (정책 페이지에만 작동)
  const tocLinks = document.querySelectorAll('.legal-toc a[href^="#"]');
  if (tocLinks.length > 0 && 'IntersectionObserver' in window) {
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
})();
