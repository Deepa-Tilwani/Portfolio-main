(function() {
  const DATA = window.PORTFOLIO_DATA || {};
  const cfg = DATA.config || {};

  function qs(sel, root=document) { return root.querySelector(sel); }
  function qsa(sel, root=document) { return [...root.querySelectorAll(sel)]; }
  function esc(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function setText(selector, value) {
    const el = qs(selector);
    if (el) el.textContent = value;
  }

  function year() {
    setText('#year', new Date().getFullYear());
  }

  function themeToggle() {
    const toggle = qs('#darkModeToggle');
    if (!toggle) return;
    const saved = localStorage.getItem('theme') || 'light';
    applyTheme(saved);
    toggle.addEventListener('click', () => {
      const next = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('theme', next);
    });
  }

  function applyTheme(mode) {
    const toggle = qs('#darkModeToggle');
    if (mode === 'dark') {
      document.body.classList.add('dark-mode');
      if (toggle) toggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      document.body.classList.remove('dark-mode');
      if (toggle) toggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }

  function fmtYear(y) { return y ? String(y) : ''; }

  function pubCard(pub, featured=false) {
    const tags = (pub.tags || []).map(t => `<span class="badge me-1 mb-1">${esc(t)}</span>`).join('');
    const url = pub.url ? `<a href="${esc(pub.url)}" target="_blank" rel="noopener">${esc(pub.title)}</a>` : esc(pub.title);
    const featuredMark = featured ? '<span class="chip">Selected</span>' : '';
    return `
      <div class="col-lg-6">
        <article class="publication-card h-100 d-flex flex-column gap-2">
          <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div>
              <div class="small text-uppercase text-secondary mb-2">${esc(pub.venue || '')}${pub.year ? ' · ' + fmtYear(pub.year) : ''}</div>
              <h5 class="mb-2">${url}</h5>
            </div>
            ${featuredMark}
          </div>
          <p class="small text-secondary mb-2">${esc(pub.authors || '')}</p>
          <div class="mt-auto">${tags}</div>
        </article>
      </div>`;
  }

  function talkCard(talk) {
    const videoId = (talk.youtube || '').includes('watch?v=') ? new URL(talk.youtube).searchParams.get('v') : '';
    const embed = videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    const slides = talk.slides ? `<a class="btn btn-outline-accent btn-sm" href="${esc(talk.slides)}" target="_blank" rel="noopener">Slides</a>` : '';
    return `
      <div class="col-lg-6">
        <article class="talk-card h-100 d-flex flex-column gap-3">
          ${embed ? `<div class="ratio ratio-16x9 rounded-4 overflow-hidden"><iframe src="${embed}" title="${esc(talk.title)}" allowfullscreen loading="lazy"></iframe></div>` : ''}
          <div>
            <div class="small text-uppercase text-secondary mb-2">${esc(talk.event || 'Talk')}</div>
            <h5 class="mb-2">${esc(talk.title || 'Research talk')}</h5>
            <p class="mb-0 text-secondary">${esc(talk.summary || '')}</p>
          </div>
          <div class="d-flex gap-2 flex-wrap mt-auto">
            ${talk.youtube ? `<a class="btn btn-accent btn-sm" href="${esc(talk.youtube)}" target="_blank" rel="noopener">YouTube</a>` : ''}
            ${slides}
          </div>
        </article>
      </div>`;
  }

  function listItems(items, cls='list-tight') {
    return `<ul class="${cls}">` + items.map(item => `<li>${item}</li>`).join('') + `</ul>`;
  }

  function renderHome() {
    const pubs = DATA.featured_publications || (DATA.publications || []).slice(0, 4);
    const pubsCount = (DATA.publications || []).length;
    const metrics = DATA.scholar_metrics || {};
    function parseMetric(value) {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    }
    const citationCount = parseMetric(metrics.citations);
    const hIndex = parseMetric(metrics.h_index);
    const awardCount = (DATA.awards || []).length;
    function setStat(name, value) {
      const el = qs(`[data-stat="${name}"]`);
      if (!el) return;
      if (typeof value === 'number' && Number.isFinite(value)) {
        el.textContent = value;
        el.setAttribute('data-target', value);
      } else {
        el.textContent = '--';
        el.removeAttribute('data-target');
      }
    }
    setStat('publications', pubsCount);
    setStat('citations', citationCount);
    setStat('h_index', hIndex);
    setStat('awards', awardCount);

    const featured = qs('#featured-publications');
    if (featured) featured.innerHTML = pubs.map(p => pubCard(p, true)).join('');

    const areas = qs('#research-areas');
    if (areas) {
      areas.innerHTML = (DATA.research_areas || []).map(area => `
        <div class="col-md-4">
          <article class="focus-card h-100">
            <h5>${esc(area.title)}</h5>
            <p class="mb-0 text-secondary">${esc(area.desc)}</p>
          </article>
        </div>`).join('');
    }

    const exp = qs('#home-experience');
    if (exp) {
      exp.innerHTML = (DATA.experience || []).slice(0, 3).map(item => `
        <div class="col-lg-4">
          <article class="experience-snapshot h-100">
            <div class="small text-uppercase text-secondary mb-2">${esc(item.period || '')}</div>
            <h5 class="mb-1">${esc(item.title || '')}</h5>
            <p class="text-secondary mb-3">${esc(item.org || '')}</p>
            ${listItems((item.bullets || []).slice(0, 2).map(esc), 'signal-list')}
          </article>
        </div>`).join('');
    }

    const awards = qs('#home-awards');
    if (awards) {
      awards.innerHTML = (DATA.awards || []).slice(0, 4).map(item => `
        <article class="award-item">
          <div class="award-year">${esc(item.year || '')}</div>
          <div>
            <h5 class="mb-1">${esc(item.title || '')}</h5>
            <p class="mb-0 text-secondary">${esc(item.detail || '')}</p>
          </div>
        </article>`).join('');
    }
  }

  function renderResearch() {
    const el = qs('#research-cards');
    if (el) {
      el.innerHTML = (DATA.research_areas || []).map(area => `
        <div class="col-md-4">
          <article class="focus-card h-100">
            <h5>${esc(area.title)}</h5>
            <p class="text-secondary mb-0">${esc(area.desc)}</p>
          </article>
        </div>`).join('');
    }
    const selected = qs('#selected-projects');
    if (selected) {
      selected.innerHTML = `
        <div class="col-lg-6">
          <article class="card-lite h-100 p-4">
            <h5>REASONS benchmark</h5>
            <p class="text-secondary mb-0">Benchmarking retrieval and citation grounding for scientific LLM outputs with attention to evidence quality and factual support.</p>
          </article>
        </div>
        <div class="col-lg-6">
          <article class="card-lite h-100 p-4">
            <h5>Generative brain models</h5>
            <p class="text-secondary mb-0">Working with Jansen-Rit and related neural mass models for inversion, effective connectivity, and statistical analysis of brain dynamics.</p>
          </article>
        </div>
        <div class="col-lg-6">
          <article class="card-lite h-100 p-4">
            <h5>Healthcare AI and explainability</h5>
            <p class="text-secondary mb-0">Applying machine learning and explainable AI methods to clinical and neurocognitive settings, including depression and autism-related studies.</p>
          </article>
        </div>
        <div class="col-lg-6">
          <article class="card-lite h-100 p-4">
            <h5>AI systems in applied settings</h5>
            <p class="text-secondary mb-0">Building multi-agent and LLM-based systems for decision support, attribution, search, and high-stakes evaluation.</p>
          </article>
        </div>`;
    }

    const exp = qs('#research-experience-highlights');
    if (exp) {
      exp.innerHTML = (DATA.experience || []).slice(0, 3).map(item => `
        <div class="col-lg-6">
          <article class="card-lite h-100 p-4">
            <div class="small text-secondary text-uppercase mb-2">${esc(item.period || '')}</div>
            <h5 class="mb-2">${esc(item.title || '')}</h5>
            <p class="text-secondary mb-2">${esc(item.org || '')}</p>
            ${listItems((item.bullets || []).slice(0, 3).map(esc), 'signal-list')}
          </article>
        </div>`).join('');
    }

    const teaching = qs('#research-teaching');
    if (teaching) teaching.innerHTML = listItems((DATA.teaching || []).slice(0, 4).map(esc), 'signal-list');

    const mentoring = qs('#research-mentoring');
    if (mentoring) mentoring.innerHTML = listItems((DATA.mentoring || []).map(esc), 'signal-list');
  }

  function renderPublicationsPage() {
    const featured = DATA.featured_publications || [];
    const all = DATA.publications || [];
    const feat = qs('#featured-list');
    if (feat) feat.innerHTML = featured.map(p => pubCard(p, true)).join('');
    const allEl = qs('#all-publications');
    if (allEl) allEl.innerHTML = all.map(p => pubCard(p, false)).join('');
    const talks = qs('#talks-grid');
    if (talks) talks.innerHTML = (DATA.talks || []).map(talkCard).join('');
  }

  function renderCV() {
    setText('#cv-publication-count', (DATA.publications || []).length);
    setText('#cv-award-count', (DATA.awards || []).length);
    setText('#cv-talk-count', (DATA.talks || []).length);

    const edu = qs('#cv-education');
    if (edu) edu.innerHTML = (DATA.education || []).map(item => `
      <div class="timeline-item">
        <div class="timeline-icon"><i class="fas fa-graduation-cap"></i></div>
        <div class="timeline-content">
          <div class="small text-secondary text-uppercase mb-1">${esc(item.period)}</div>
          <h5 class="mb-1">${esc(item.title)}</h5>
          <p class="text-secondary mb-2">${esc(item.org)}</p>
          <p class="mb-0">${esc(item.detail)}</p>
        </div>
      </div>`).join('');

    const exp = qs('#cv-experience');
    if (exp) exp.innerHTML = (DATA.experience || []).map(item => `
      <div class="timeline-item">
        <div class="timeline-icon"><i class="fas fa-flask"></i></div>
        <div class="timeline-content">
          <div class="small text-secondary text-uppercase mb-1">${esc(item.period)}</div>
          <h5 class="mb-1">${esc(item.title)}</h5>
          <p class="text-secondary mb-2">${esc(item.org)}</p>
          ${listItems((item.bullets || []).map(esc))}
        </div>
      </div>`).join('');

    const pubs = qs('#cv-publications');
    if (pubs) pubs.innerHTML = (DATA.publications || []).map(p => `
      <li class="mb-3">
        <strong>${esc(p.title)}</strong><br>
        <span class="text-secondary">${esc(p.venue)} · ${fmtYear(p.year)}</span>
      </li>`).join('');

    const awards = qs('#cv-awards');
    if (awards) awards.innerHTML = (DATA.awards || []).map(a => `
      <li class="mb-3">
        <strong>${esc(a.year)}</strong> — ${esc(a.title)}<br>
        <span class="text-secondary">${esc(a.detail)}</span>
      </li>`).join('');

    const teaching = qs('#cv-teaching');
    if (teaching) teaching.innerHTML = listItems((DATA.teaching || []).map(esc));

    const service = qs('#cv-service');
    if (service) service.innerHTML = listItems((DATA.service || []).map(esc));

    const mentoring = qs('#cv-mentoring');
    if (mentoring) mentoring.innerHTML = listItems((DATA.mentoring || []).map(esc));
  }

  function renderExperience() {
    const ed = qs('#experience-education');
    if (ed) ed.innerHTML = (DATA.education || []).map(item => `
      <div class="timeline-item">
        <div class="timeline-icon"><i class="fas fa-graduation-cap"></i></div>
        <div class="timeline-content">
          <div class="small text-secondary text-uppercase mb-1">${esc(item.period)}</div>
          <h5 class="mb-1">${esc(item.title)}</h5>
          <p class="text-secondary mb-0">${esc(item.org)}</p>
        </div>
      </div>`).join('');
    const ex = qs('#experience-timeline');
    if (ex) ex.innerHTML = (DATA.experience || []).map(item => `
      <div class="timeline-item">
        <div class="timeline-icon"><i class="fas fa-briefcase"></i></div>
        <div class="timeline-content">
          <div class="small text-secondary text-uppercase mb-1">${esc(item.period)}</div>
          <h5 class="mb-1">${esc(item.title)}</h5>
          <p class="text-secondary mb-2">${esc(item.org)}</p>
          ${listItems((item.bullets || []).map(esc))}
        </div>
      </div>`).join('');
    const teach = qs('#experience-teaching');
    if (teach) teach.innerHTML = listItems((DATA.teaching || []).map(esc));
    const service = qs('#experience-service');
    if (service) service.innerHTML = listItems((DATA.service || []).map(esc));
  }

  function renderContact() {
    setText('#contact-email', cfg.email || '');
    setText('#contact-phone', cfg.phone || '');
    setText('#contact-location', cfg.location || '');
  }

  function renderGlobalBits() {
    qsa('[data-site-name]').forEach(el => el.textContent = cfg.name || 'Research Portfolio');
    qsa('[data-site-tagline]').forEach(el => el.textContent = cfg.tagline || 'Research portfolio');
    const resume = cfg.resume_pdf || 'assets/Deepa_Tilwani_Resume.pdf';
    qsa('[data-resume-link]').forEach(el => el.setAttribute('href', resume));
    qsa('[data-scholar-link]').forEach(el => el.setAttribute('href', cfg.scholar_profile_url || '#'));
    qsa('[data-linkedin-link]').forEach(el => el.setAttribute('href', cfg.linkedin_url || '#'));
    qsa('[data-email-link]').forEach(el => el.setAttribute('href', `mailto:${cfg.email || ''}`));
    qsa('[data-profile-image]').forEach(el => el.setAttribute('src', cfg.profile_image || 'images/profile.png'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    year();
    themeToggle();
    renderGlobalBits();

    const page = document.body.getAttribute('data-page') || 'home';
    if (page === 'home' || page === 'index') renderHome();
    if (page === 'research') renderResearch();
    if (page === 'publications' || page === 'talks') renderPublicationsPage();
    if (page === 'cv') renderCV();
    if (page === 'experience') renderExperience();
    if (page === 'contact') renderContact();

    const scrollBtn = qs('#scrollTopBtn');
    if (scrollBtn) {
      window.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('show', document.documentElement.scrollTop > 300);
      });
      scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    const counters = qsa('.counter');
    if (counters.length) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const targetAttr = el.getAttribute('data-target');
          if (!targetAttr) {
            observer.unobserve(el);
            return;
          }
          const target = parseInt(targetAttr, 10);
          if (!Number.isFinite(target)) {
            observer.unobserve(el);
            return;
          }
          let count = 0;
          const step = Math.max(1, Math.ceil(target / 60));
          const tick = () => {
            count = Math.min(target, count + step);
            el.textContent = count;
            if (count < target) requestAnimationFrame(tick);
          };
          tick();
          observer.unobserve(el);
        });
      }, { threshold: 0.5 });
      counters.forEach(c => observer.observe(c));
    }
  });
})();
