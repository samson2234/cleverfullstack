document.addEventListener('DOMContentLoaded', function () {

  /* i18n init */
  if (typeof i18n !== 'undefined') {
    i18n.init();
    var urlParams = new URLSearchParams(window.location.search);
    var urlLang = urlParams.get('lang');
    if (urlLang && (urlLang === 'fr' || urlLang === 'en')) {
      i18n.setLang(urlLang);
    } else {
      i18n.translatePage();
    }
    var langToggle = document.querySelector('.lang-toggle');
    if (langToggle) {
      langToggle.addEventListener('click', function () {
        var next = i18n.getLang() === 'en' ? 'fr' : 'en';
        i18n.setLang(next);
      });
    }
  }

  /* Mobile nav toggle */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      toggle.classList.toggle('active');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.classList.remove('active');
      });
    });
  }

  /* Cookie consent banner */
  var cookieKey = 'cleverstack_cookie_consent';
  if (!localStorage.getItem(cookieKey)) {
    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<p data-i18n="cookie.text" class="cookie-text">We use cookies to improve your experience and analyze site traffic. By continuing, you agree to our use of cookies. Read our <a href="privacy.html">Privacy Policy</a> for details.</p>' +
      '<div class="cookie-actions">' +
        '<button class="btn btn-accept" data-consent="accepted" data-i18n="cookie.accept">Accept</button>' +
        '<button class="btn btn-reject" data-consent="rejected" data-i18n="cookie.reject">Reject</button>' +
      '</div>';
    document.body.appendChild(banner);

    if (typeof i18n !== 'undefined') { i18n.translatePage(); }

    banner.querySelectorAll('button[data-consent]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        localStorage.setItem(cookieKey, btn.getAttribute('data-consent'));
        banner.classList.remove('show');
        setTimeout(function () { banner.remove(); }, 400);
      });
    });

    setTimeout(function () { banner.classList.add('show'); }, 1200);
  }

  /* Scroll-triggered animations — GSAP + ScrollTrigger (progressive enhancement, safe fallbacks) */
  var revealSel = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsapReady = false;

  function revealAllNow() {
    document.querySelectorAll(revealSel).forEach(function (el) { el.classList.add('in'); });
  }

  function initGsapAnimations() {
    if (gsapReady) return;
    gsapReady = true;
    if (!window.gsap || !window.ScrollTrigger) { revealAllNow(); return; }
    document.documentElement.classList.add('gsap');
    gsap.registerPlugin(ScrollTrigger);

    /* Hero intro — stagger hero content in on load */
    var hero = document.querySelector('.hero, .page-hero');
    if (hero) {
      var heroEls = hero.querySelectorAll('.eyebrow, h1, p, .ctas, .hero-stack');
      if (heroEls.length) {
        gsap.fromTo(heroEls, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.12 });
      }
    }

    /* Scroll reveals — same classes and behaviour, GSAP-powered */
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(function (el) {
      var from = { autoAlpha: 0, y: 24 };
      if (el.classList.contains('reveal-left')) from = { autoAlpha: 0, x: -30 };
      else if (el.classList.contains('reveal-right')) from = { autoAlpha: 0, x: 30 };
      else if (el.classList.contains('reveal-scale')) from = { autoAlpha: 0, scale: 0.92 };
      gsap.fromTo(el, from, {
        autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    /* Staggered children */
    document.querySelectorAll('.stagger').forEach(function (s) {
      gsap.fromTo(s.children, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: s, start: 'top 88%', once: true }
      });
    });
  }

  if (reduceMotion) {
    revealAllNow();
  } else {
    initGsapAnimations();
    setTimeout(function () { if (!gsapReady) revealAllNow(); }, 3000);
  }

  /* Hero stack layer cycling (signature element) */
  var layers = document.querySelectorAll('.stack-layer');
  if (layers.length) {
    var i = 0;
    setInterval(function () {
      layers.forEach(function (l) { l.classList.remove('is-active'); });
      layers[i].classList.add('is-active');
      i = (i + 1) % layers.length;
    }, 1800);
  }

  /* Animated counters for stats */
  var counterEls = document.querySelectorAll('.stat .num');
  var countersAnimated = false;

  function animateCounters() {
    if (countersAnimated) return;
    countersAnimated = true;
    counterEls.forEach(function (el) {
      var text = el.textContent;
      var target = parseFloat(text) || 0;
      var suffix = text.replace(/[\d.]/g, '');
      var isPct = suffix.indexOf('%') !== -1;
      var duration = 2000;
      var startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = eased * target;
        el.textContent = (isPct ? Math.round(current) : current.toFixed(0)) + suffix;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = text;
        }
      }
      requestAnimationFrame(step);
    });
  }

  var statStrips = document.querySelectorAll('.stat-strip');
  if (statStrips.length && 'IntersectionObserver' in window) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounters();
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    statStrips.forEach(function (s) { counterObserver.observe(s); });
  }

  /* Testimonial carousel - scrollable 3-up */
  var testimonialTrack = document.getElementById('testimonial-track');
  var testimonialDots = document.querySelector('.testimonial-dots');
  var testiPrev = document.querySelector('.testi-prev');
  var testiNext = document.querySelector('.testi-next');
  if (testimonialTrack && testimonialDots) {
    var cards = testimonialTrack.querySelectorAll('.testimonial-card');
    var dots = testimonialDots.querySelectorAll('.testimonial-dot');
    var cardsPerPage = 3;
    var totalPages = Math.ceil(cards.length / cardsPerPage);
    var currentPage = 0;

    function getCardWidth() {
      if (cards.length === 0) return 0;
      var rect = cards[0].getBoundingClientRect();
      var gap = 20;
      return rect.width + gap;
    }

    function scrollToPage(page) {
      if (page < 0) page = 0;
      if (page >= totalPages) page = totalPages - 1;
      currentPage = page;
      var cardW = getCardWidth();
      testimonialTrack.scrollTo({ left: cardW * page * cardsPerPage, behavior: 'smooth' });
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === page);
      });
    }

    function updatePageFromScroll() {
      var cardW = getCardWidth();
      if (cardW === 0) return;
      var approx = Math.round(testimonialTrack.scrollLeft / (cardW * cardsPerPage));
      if (approx !== currentPage && approx >= 0 && approx < totalPages) {
        currentPage = approx;
        dots.forEach(function (d, i) {
          d.classList.toggle('active', i === approx);
        });
      }
    }

    if (cards.length > 0) {
      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { scrollToPage(i); });
      });
      testiPrev.addEventListener('click', function () { scrollToPage(currentPage - 1); });
      testiNext.addEventListener('click', function () { scrollToPage(currentPage + 1); });
      testimonialTrack.addEventListener('scroll', updatePageFromScroll);
      scrollToPage(0);
      setInterval(function () {
        scrollToPage((currentPage + 1) % totalPages);
      }, 5000);
    }
  }

  /* Portfolio filter */
  var filterBtns = document.querySelectorAll('.filter-btn');
  var projectCards = document.querySelectorAll('.project-card');
  if (filterBtns.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var f = btn.getAttribute('data-filter');
        projectCards.forEach(function (card) {
          if (f === 'all' || card.getAttribute('data-cat') === f) {
            card.classList.remove('hide');
          } else {
            card.classList.add('hide');
          }
        });
      });
    });
  }

  /* FAQ accordion */
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    q.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      faqItems.forEach(function (other) {
        other.classList.remove('open');
        other.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* Header background on scroll — passive + RAF for perf */
  var header = document.querySelector('.site-header');
  var headerTicking = false;
  if (header) {
    window.addEventListener('scroll', function () {
      if (!headerTicking) {
        requestAnimationFrame(function () {
          header.style.boxShadow = window.scrollY > 8 ? '0 1px 0 rgba(16,20,43,.06)' : 'none';
          headerTicking = false;
        });
        headerTicking = true;
      }
    }, { passive: true });
  }

  /* Contact form — real submission via Vercel API */
  var form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var status = form.querySelector('.form-status');
      var originalText = btn.innerHTML;

      btn.innerHTML = 'Sending\u2026';
      btn.disabled = true;
      btn.style.opacity = '0.7';

      var formData = {
        name: form.querySelector('[name="name"]').value,
        email: form.querySelector('[name="email"]').value,
        phone: form.querySelector('[name="phone"]').value,
        message: form.querySelector('[name="message"]').value
      };

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          btn.innerHTML = 'Message Sent \u2713';
          btn.style.background = 'var(--success, #10B981)';
          btn.style.boxShadow = '0 0 20px rgba(16,185,129,0.3)';
          if (status) {
            status.textContent = data.message || 'Thank you! We will respond within 24 hours.';
            status.style.color = 'var(--success, #10B981)';
            status.style.display = 'block';
          }
          form.reset();
          setTimeout(function () {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.background = '';
            btn.style.boxShadow = '';
            if (status) status.style.display = 'none';
          }, 4000);
        } else {
          throw new Error(data.error || 'Something went wrong');
        }
      })
      .catch(function (err) {
        btn.innerHTML = 'Failed \u2717';
        btn.style.background = 'var(--error, #EF4444)';
        if (status) {
          status.textContent = err.message || 'Something went wrong. Please email us at cleverdigitals70@gmail.com';
          status.style.color = 'var(--error, #EF4444)';
          status.style.display = 'block';
        }
        setTimeout(function () {
          btn.innerHTML = originalText;
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.background = '';
          if (status) status.style.display = 'none';
        }, 4000);
      });
    });
  }

  /* Price calculator */
  var calc = document.getElementById('priceCalculator');
  if (calc) {
    var baseOptions = calc.querySelectorAll('.calc-opt');
    var featureChecks = calc.querySelectorAll('#calcFeatures input[type="checkbox"]');
    var calcTotal = document.getElementById('calcTotal');
    var calcBreakdown = document.getElementById('calcBreakdown');

    function formatPrice(n) {
      return '$' + n.toLocaleString('en-US');
    }

    function updateCalculator() {
      var activeOpt = calc.querySelector('.calc-opt.active');
      var basePrice = activeOpt ? parseInt(activeOpt.getAttribute('data-price')) : 500;
      var baseName = activeOpt ? activeOpt.querySelector('.opt-title').textContent : 'Starter Website';

      var featuresTotal = 0;
      var featuresHtml = '';
      featureChecks.forEach(function (cb) {
        if (cb.checked) {
          var p = parseInt(cb.getAttribute('data-price'));
          featuresTotal += p;
          var label = cb.parentElement.textContent.trim().replace(/\s*\+\$[\d,]+/, '').trim();
          featuresHtml += '<div class="calc-line"><span>' + label + '</span><span>' + formatPrice(p) + '</span></div>';
        }
      });

      var total = basePrice + featuresTotal;

      var breakdownHtml = '<div class="calc-line"><span>Base: ' + baseName + '</span><span>' + formatPrice(basePrice) + '</span></div>';
      if (featuresHtml) {
        breakdownHtml += featuresHtml;
      }
      calcBreakdown.innerHTML = breakdownHtml;
      calcTotal.textContent = formatPrice(total);
    }

    baseOptions.forEach(function (opt) {
      opt.addEventListener('click', function () {
        baseOptions.forEach(function (o) { o.classList.remove('active'); });
        opt.classList.add('active');
        var radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        updateCalculator();
      });
    });

    featureChecks.forEach(function (cb) {
      cb.addEventListener('change', updateCalculator);
    });

    updateCalculator();
  }

  /* ROI calculator */
  var roiCalc = document.getElementById('roiCalculator');
  if (roiCalc) {
    var roiVisitors = document.getElementById('roiVisitors');
    var roiConv = document.getElementById('roiConv');
    var roiAOV = document.getElementById('roiAOV');
    var roiVisitorsVal = document.getElementById('roiVisitorsVal');
    var roiConvVal = document.getElementById('roiConvVal');
    var roiAOVVal = document.getElementById('roiAOVVal');
    var roiCurrent = document.getElementById('roiCurrent');
    var roiProjected = document.getElementById('roiProjected');
    var roiDiff = document.getElementById('roiDiff');

    var ROI_UPLIFT = 1.6;
    function fmtCurrency(n) {
      return '$' + Math.round(n).toLocaleString('en-US');
    }
    function updateRoi() {
      var visitors = parseInt(roiVisitors.value, 10);
      var convPct = parseInt(roiConv.value, 10) / 10;
      var aov = parseInt(roiAOV.value, 10);
      var current = visitors * (convPct / 100) * aov;
      var projected = visitors * (convPct / 100) * ROI_UPLIFT * aov;
      var diff = projected - current;
      roiVisitorsVal.textContent = visitors.toLocaleString('en-US');
      roiConvVal.textContent = convPct.toFixed(1) + '%';
      roiAOVVal.textContent = fmtCurrency(aov);
      roiCurrent.textContent = fmtCurrency(current);
      roiProjected.textContent = fmtCurrency(projected);
      roiDiff.textContent = '+' + fmtCurrency(diff);
    }
    [roiVisitors, roiConv, roiAOV].forEach(function (input) {
      input.addEventListener('input', updateRoi);
    });
    updateRoi();
  }

  /* Scroll progress bar */
  var scrollProgress = document.querySelector('.scroll-progress');
  var progressTicking = false;
  if (scrollProgress) {
    window.addEventListener('scroll', function () {
      if (!progressTicking) {
        requestAnimationFrame(function () {
          var scrollTop = window.scrollY;
          var docHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (docHeight > 0) {
            scrollProgress.style.transform = 'scaleX(' + (scrollTop / docHeight) + ')';
          }
          progressTicking = false;
        });
        progressTicking = true;
      }
    }, { passive: true });
  }

  /* Back to top button */
  var backToTop = document.querySelector('.back-to-top');
  var backTopTicking = false;
  if (backToTop) {
    window.addEventListener('scroll', function () {
      if (!backTopTicking) {
        requestAnimationFrame(function () {
          backToTop.classList.toggle('visible', window.scrollY > 400);
          backTopTicking = false;
        });
        backTopTicking = true;
      }
    }, { passive: true });
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* Page loading bar */
  var loadBar = document.querySelector('.page-load-bar');
  if (loadBar) {
    var loadKey = 'cleverstack_loading';
    if (!sessionStorage.getItem(loadKey)) {
      sessionStorage.setItem(loadKey, '1');
      requestAnimationFrame(function () { loadBar.style.width = '60%'; });
    }
    window.addEventListener('load', function () {
      loadBar.style.width = '100%';
      setTimeout(function () { loadBar.classList.add('done'); }, 600);
    });
  }

  /* Page preloader */
  var preloader = document.querySelector('.page-preloader');
  if (preloader) {
    var preloadKey = 'cleverstack_preloaded';
    if (sessionStorage.getItem(preloadKey)) {
      preloader.classList.add('hidden');
    } else {
      sessionStorage.setItem(preloadKey, '1');
      window.addEventListener('load', function () {
        setTimeout(function () {
          preloader.classList.add('hidden');
          setTimeout(function () { preloader.remove(); }, 500);
        }, 600);
      });
    }
  }

  /* Dark mode toggle */
  var darkToggle = document.querySelector('.dark-toggle');
  var darkKey = 'cleverstack_theme';
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    if (darkToggle) {
      darkToggle.textContent = theme === 'dark' ? '\u2600' : '\u263E';
      darkToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
  if (darkToggle) {
    var savedTheme = localStorage.getItem(darkKey);
    if (savedTheme) {
      applyTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    }
    darkToggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(darkKey, next);
    });
  }

  /* Image lightbox */
  var lightbox = document.querySelector('.lightbox-overlay');
  if (lightbox) {
    var lightboxImg = lightbox.querySelector('.lightbox-img');
    var lightboxClose = lightbox.querySelector('.lightbox-close');
    document.querySelectorAll('[data-lightbox]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var imgEl = el.tagName === 'IMG' ? el : el.querySelector('img');
        var src = el.getAttribute('data-lightbox') || (imgEl && imgEl.src) || '';
        lightboxImg.src = src;
        lightboxImg.alt = (imgEl && imgEl.alt) || '';
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });
    function closeLightbox() {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    }
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  /* Card tilt micro-interaction */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.tilt-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = 'perspective(600px) rotateY(' + (x * 6) + 'deg) rotateX(' + (-y * 6) + 'deg)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg)';
      });
    });
  }

  /* Before/after comparison slider */
  document.querySelectorAll('.comparison-wrap').forEach(function (wrap) {
    var handle = wrap.querySelector('.comparison-handle');
    var before = wrap.querySelector('.comparison-before');
    var isDragging = false;
    function setPos(pct) {
      pct = Math.max(5, Math.min(95, pct));
      handle.style.left = pct + '%';
      before.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
    }
    function onMove(e) {
      if (!isDragging) return;
      var rect = wrap.getBoundingClientRect();
      var x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      setPos((x / rect.width) * 100);
    }
    handle.addEventListener('mousedown', function () { isDragging = true; });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', function () { isDragging = false; });
    handle.addEventListener('touchstart', function (e) { e.preventDefault(); isDragging = true; });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', function () { isDragging = false; });
    setPos(50);
  });

  /* Smooth parallax on hero gradient orbs — passive + RAF + throttled */
  var orbs = document.querySelectorAll('.mesh-bg .orb');
  var orbTicking = false;
  var lastMouseX = 0;
  var lastMouseY = 0;

  if (orbs.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('mousemove', function (e) {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      if (!orbTicking) {
        requestAnimationFrame(function () {
          var x = (lastMouseX / window.innerWidth - 0.5) * 20;
          var y = (lastMouseY / window.innerHeight - 0.5) * 20;
          orbs.forEach(function (orb, i) {
            var factor = (i + 1) * 0.3;
            orb.style.transform = 'translate(' + (x * factor) + 'px, ' + (y * factor) + 'px)';
          });
          orbTicking = false;
        });
        orbTicking = true;
      }
    }, { passive: true });
  }

  /* Skeleton loading for lazy images */
  var lazyImgs = document.querySelectorAll('.shot-area img[loading="lazy"]');
  lazyImgs.forEach(function (img) {
    var wrap = img.closest('.shot-area, .pd-img-wrap');
    if (wrap) {
      var skel = document.createElement('div');
      skel.className = 'skeleton skeleton-img';
      skel.style.position = 'absolute';
      skel.style.inset = '0';
      skel.style.borderRadius = '0';
      if (!wrap.querySelector('.skeleton')) {
        wrap.style.position = 'relative';
        wrap.appendChild(skel);
      }
      var reveal = function () {
        wrap.classList.add('loaded');
      };
      if (img.complete && img.naturalWidth > 0) {
        reveal();
      } else {
        img.addEventListener('load', reveal);
        img.addEventListener('error', reveal);
      }
    }
  });

});
