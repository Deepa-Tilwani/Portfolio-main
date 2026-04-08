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

  function dedupePublications(items) {
    const seen = new Set();
    return (items || []).filter(pub => {
      const key = String(pub?.title || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sortFeatured(items) {
    return [...(items || [])]
      .filter(item => item && item.featured)
      .sort((a, b) => {
        const yearDelta = Number(b.year || 0) - Number(a.year || 0);
        if (yearDelta !== 0) return yearDelta;
        return String(a.title || '').localeCompare(String(b.title || ''));
      })
      .slice(0, 4);
  }

  async function loadJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.json();
  }

  async function hydrateDynamicData() {
    try {
      const [scholarPubs, manualPubs, awards] = await Promise.all([
        loadJson('assets/scholar-publications.json'),
        loadJson('assets/manual-publications.json'),
        loadJson('assets/awards.json')
      ]);

      const combinedPublications = dedupePublications([
        ...(scholarPubs || []),
        ...(manualPubs || [])
      ]).sort((a, b) => {
        const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featuredDelta !== 0) return featuredDelta;
        const yearDelta = Number(b.year || 0) - Number(a.year || 0);
        if (yearDelta !== 0) return yearDelta;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });

      DATA.publications = combinedPublications;
      DATA.featured_publications = sortFeatured(combinedPublications);
      DATA.awards = awards || [];
    } catch (error) {
      console.warn('Falling back to bundled site data.', error);
    }

    try {
      DATA.news = await loadJson('assets/news.json');
    } catch (error) {
      console.warn('Falling back to bundled news data.', error);
    }

    try {
      DATA.blogs = await loadJson('assets/blogs.json');
    } catch (error) {
      console.warn('Falling back to bundled blog data.', error);
    }
  }

  function formatDisplayDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

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

  function publicationTopic(pub) {
    const tags = Array.isArray(pub.tags) ? pub.tags.filter(Boolean) : [];
    if (!tags.length) return 'Other';
    const nonGeneric = tags.find(tag => !['book chapter', 'tutorial'].includes(String(tag).toLowerCase()));
    return nonGeneric || tags[0];
  }

  function sortPublications(items) {
    return [...items].sort((a, b) => {
      const yearDelta = Number(b.year || 0) - Number(a.year || 0);
      if (yearDelta !== 0) return yearDelta;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  function topicOrderName(topic) {
    return String(topic || '').toLowerCase();
  }

  function formatTopicLabel(topic) {
    return String(topic || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function topicSlug(topic) {
    return String(topic || 'other')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'other';
  }

  function pubListItem(pub) {
    const title = pub.url
      ? `<a href="${esc(pub.url)}" target="_blank" rel="noopener">${esc(pub.title)}</a>`
      : esc(pub.title);
    const venueBits = [pub.venue || '', fmtYear(pub.year)].filter(Boolean);
    const tags = (pub.tags || [])
      .filter(tag => String(tag) !== publicationTopic(pub))
      .map(tag => `<span class="publication-tag">${esc(tag)}</span>`)
      .join('');

    return `
      <li class="publication-list-item">
        <div class="publication-citation">
          <div class="publication-title">${title}</div>
          <div class="publication-authors">${esc(pub.authors || '')}</div>
          ${venueBits.length ? `<div class="publication-meta">${esc(venueBits.join(' · '))}</div>` : ''}
        </div>
        ${tags ? `<div class="publication-tag-row">${tags}</div>` : ''}
      </li>`;
  }

  function groupedPublicationList(publications) {
    const groups = new Map();
    sortPublications(publications).forEach(pub => {
      const topic = publicationTopic(pub);
      if (!groups.has(topic)) groups.set(topic, []);
      groups.get(topic).push(pub);
    });

    const orderedTopics = [...groups.keys()].sort((a, b) => topicOrderName(a).localeCompare(topicOrderName(b)));

    return orderedTopics.map(topic => `
      <section class="publication-topic-group" data-topic="${esc(topicSlug(topic))}">
        <div class="publication-topic-header">
          <h3>${esc(formatTopicLabel(topic))}</h3>
        </div>
        <ul class="publication-list">
          ${groups.get(topic).map(pubListItem).join('')}
        </ul>
      </section>
    `).join('');
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
      const items = DATA.awards || [];
      const previewCount = 4;
      awards.innerHTML = `
        <ul class="award-list" aria-label="Awards and recognition">
          ${items.map((item, index) => `
            <li class="award-item ${index >= previewCount ? 'award-item-hidden' : ''}" ${index >= previewCount ? 'data-award-overflow="true"' : ''}>
              <div class="award-year">${esc(item.year || '')}</div>
              <div>
                <h3 class="award-title">${esc(item.title || '')}</h3>
                <p class="mb-0 text-secondary">${esc(item.detail || '')}</p>
              </div>
            </li>`).join('')}
        </ul>
        ${items.length > previewCount ? `
          <button type="button" class="award-toggle-link" data-awards-toggle aria-expanded="false">
            Read more
          </button>
        ` : ''}
      `;
    }

    const news = qs('#home-news');
    if (news) {
      const items = DATA.news || [];
      news.innerHTML = items.length ? `
        <ul class="content-list" aria-label="News appearances">
          ${items.map(item => `
            <li class="content-list-item">
              <div class="news-meta">${esc(item.source || 'News')} · ${esc(formatDisplayDate(item.date))}</div>
              <h3 class="content-list-title">${esc(item.title || '')}</h3>
              <p class="content-list-summary text-secondary">${esc(item.summary || '')}</p>
              <a class="content-list-link" href="${esc(item.url || '#')}" target="_blank" rel="noopener" aria-label="Read article: ${esc(item.title || '')}">Read article</a>
            </li>
          `).join('')}
        </ul>
      ` : `
        <p class="text-secondary mb-0">News appearances will be added here.</p>
      `;
    }

    const blogs = qs('#home-blogs');
    if (blogs) {
      const items = DATA.blogs || [];
      if (!items.length) {
        blogs.innerHTML = `
          <div class="content-list-empty">
            <div class="coming-soon-label">Coming up</div>
            <p class="mb-0 text-secondary">Blog posts are coming soon.</p>
          </div>
        `;
      } else {
        blogs.innerHTML = `
          <ul class="content-list" aria-label="Blog posts">
            ${items.map(item => `
              <li class="content-list-item">
                <div class="news-meta">${esc(item.source || 'Blog')} · ${esc(formatDisplayDate(item.date))}</div>
                <h3 class="content-list-title">${esc(item.title || '')}</h3>
                <p class="content-list-summary text-secondary">${esc(item.summary || '')}</p>
                <a class="content-list-link" href="${esc(item.url || '#')}" target="_blank" rel="noopener" aria-label="${esc(item.cta_label || 'Open post')}: ${esc(item.title || '')}">${esc(item.cta_label || 'Open post')}</a>
              </li>
            `).join('')}
          </ul>
        `;
      }
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
        <article class="organized-item">
          <div class="small text-secondary text-uppercase mb-2">${esc(item.period || '')}</div>
          <h5 class="mb-1">${esc(item.title || '')}</h5>
          <p class="text-secondary mb-3">${esc(item.org || '')}</p>
          ${listItems((item.bullets || []).slice(0, 3).map(esc), 'signal-list')}
        </article>`).join('');
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
    if (allEl) allEl.innerHTML = groupedPublicationList(all);
    const talks = qs('#talks-grid');
    if (talks) talks.innerHTML = (DATA.talks || []).map(talkCard).join('');
  }

  function renderCV() {
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

  function bindExpandableLists() {
    qsa('[data-awards-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const container = button.closest('#home-awards');
        if (!container) return;
        const overflowItems = qsa('[data-award-overflow="true"]', container);
        const expanded = button.getAttribute('aria-expanded') === 'true';
        overflowItems.forEach(item => item.classList.toggle('award-item-hidden', expanded));
        button.setAttribute('aria-expanded', String(!expanded));
        button.textContent = expanded ? 'Read more' : 'Show less';
      });
    });
  }

  function renderGlobalBits() {
    qsa('[data-site-name]').forEach(el => el.textContent = cfg.name || 'Research Portfolio');
    qsa('[data-site-tagline]').forEach(el => el.textContent = cfg.tagline || 'Research portfolio');
    const resume = cfg.resume_pdf || 'assets/Deepa_Tilwani_Resume.pdf';
    qsa('[data-resume-link]').forEach(el => el.setAttribute('href', resume));
    qsa('[data-scholar-link]').forEach(el => el.setAttribute('href', cfg.scholar_profile_url || '#'));
    qsa('[data-linkedin-link]').forEach(el => el.setAttribute('href', cfg.linkedin_url || '#'));
    qsa('[data-github-link]').forEach(el => el.setAttribute('href', cfg.github_url || '#'));
    qsa('[data-email-link]').forEach(el => el.setAttribute('href', `mailto:${cfg.email || ''}`));
    qsa('[data-profile-image]').forEach(el => el.setAttribute('src', cfg.profile_image || 'images/profile.png'));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await hydrateDynamicData();
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
    bindExpandableLists();

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
