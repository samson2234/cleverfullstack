document.addEventListener('DOMContentLoaded', function () {

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
      '<p>We use cookies to improve your experience and analyze site traffic. ' +
      'By continuing, you agree to our use of cookies. ' +
      'Read our <a href="privacy.html">Privacy Policy</a> for details.</p>' +
      '<div class="cookie-actions">' +
        '<button class="btn btn-accept" data-consent="accepted">Accept</button>' +
        '<button class="btn btn-reject" data-consent="rejected">Reject</button>' +
      '</div>';
    document.body.appendChild(banner);

    banner.querySelectorAll('button[data-consent]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        localStorage.setItem(cookieKey, btn.getAttribute('data-consent'));
        banner.classList.remove('show');
        setTimeout(function () { banner.remove(); }, 400);
      });
    });

    setTimeout(function () { banner.classList.add('show'); }, 1200);
  }

  /* Combined IntersectionObserver for reveal + stagger (single observer = better perf) */
  if ('IntersectionObserver' in window) {
    var revealIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal, .stagger').forEach(function (el) {
      revealIo.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal, .stagger').forEach(function (el) {
      el.classList.add('in');
    });
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

  /* Testimonial carousel */
  var testimonialContainer = document.querySelector('.testimonial-carousel');
  var testimonialDots = document.querySelector('.testimonial-dots');
  if (testimonialContainer && testimonialDots) {
    var cards = testimonialContainer.querySelectorAll('.testimonial-card');
    var dots = testimonialDots.querySelectorAll('.testimonial-dot');
    var current = 0;

    function showTestimonial(idx) {
      cards.forEach(function (c, i) {
        c.style.display = i === idx ? 'block' : 'none';
        if (i === idx) { c.classList.add('in'); }
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === idx);
      });
      current = idx;
    }

    if (cards.length > 0) {
      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { showTestimonial(i); });
      });
      showTestimonial(0);
      setInterval(function () {
        showTestimonial((current + 1) % cards.length);
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

});
