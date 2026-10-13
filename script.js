/* VirtualMix xatframe: animowane cząsteczki i paski equalizera.
   Bez bibliotek, bez połączeń sieciowych, bez przechwytywania kliknięć. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('preview') === '1') document.body.classList.add('is-preview');

  document.querySelectorAll('[data-equalizer]').forEach(el => {
    const count = 36;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('i');
      bar.style.setProperty('--h', `${15 + Math.random() * 85}%`);
      bar.style.setProperty('--d', `${0.8 + Math.random() * 1.9}s`);
      bar.style.setProperty('--delay', `${-Math.random() * 3}s`);
      frag.appendChild(bar);
    }
    el.appendChild(frag);
  });

  // Niezależne sterowanie panelami z małego paska nad czatem.
  document.querySelectorAll('.vm-top-button').forEach(button => {
    button.addEventListener('click', () => {
      const active = Number(button.dataset.tab);
      const isLeft = active <= 3;
      const side = document.querySelector(`[data-side="${isLeft ? 'left' : 'right'}"]`);
      if (!side) return;
      const initial = isLeft ? 1 : 4;
      const group = button.closest('.vm-top-group');
      group.querySelectorAll('.vm-top-button').forEach(tab => {
        const selected = tab === button;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-pressed', String(selected));
      });
      // Nad panelem pokazujemy tę samą aktywną zakładkę, co nad czatem.
      side.querySelectorAll('[data-tab-indicator]').forEach(indicator => {
        indicator.classList.toggle('is-active', Number(indicator.dataset.tabIndicator) === active);
      });
      side.querySelector('.side__home').hidden = active !== initial;
      side.querySelector('.side__empty').hidden =
  active === initial || (isLeft && (active === 2 || active === 3));
      const schedulePanel = side.querySelector('[data-schedule]');
      if (schedulePanel) { schedulePanel.hidden = active !== 2; if (active === 2) loadSchedule(); }
       const teamPanel = side.querySelector('[data-team]');
if (teamPanel) {
  teamPanel.hidden = active !== 3;
  if (active === 3) loadTeam();
}
       
      // LIVE — uruchamianie tylko w zakładce 5
      const livePanel = side.querySelector('[data-live]');

      if (livePanel) {
        const showLive = active === 5;

        livePanel.hidden = !showLive;
        setLivePreview(showLive);
      }

    });
  });

   
  
  // =========================================
  // EKIPA — KOMPAKTOWE KARTY I STRONICOWANIE
  // =========================================

  const TEAM_URL =
    'https://virtualmix.pl/vm_ekipa_proxy.php?format=json';

  const teamPanel = document.querySelector('[data-team]');
  const teamList = document.querySelector('[data-team-list]');
  const teamViewport =
    document.querySelector('[data-team-viewport]');
  const teamCount =
    document.querySelector('[data-team-count]');
  const teamPage =
    document.querySelector('[data-team-page]');

  let teamLoaded = false;
  let teamBusy = false;
  let teamPeople = [];
  let teamCurrentPage = 0;
  let teamPageSize = 5;
  let teamTimer = null;
  let teamLastFetch = 0;

  function makeTeamCard(person) {
    const card = document.createElement('article');
    card.className = 'vm-team-card';

    const avatarUrl = getSafeAvatar(person.avatar);
    const avatar = avatarUrl
      ? document.createElement('img')
      : document.createElement('span');

    avatar.className = 'vm-team-avatar' +
      (avatarUrl ? '' : ' vm-team-avatar-fallback');

    if (avatarUrl) {
      avatar.src = avatarUrl;
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatar.referrerPolicy = 'no-referrer';

      avatar.addEventListener('error', () => {
        const fallback = document.createElement('span');
        fallback.className =
          'vm-team-avatar vm-team-avatar-fallback';
        fallback.textContent = '♫';
        avatar.replaceWith(fallback);
      }, { once: true });
    } else {
      avatar.textContent = '♫';
    }

    const details = document.createElement('div');
    details.className = 'vm-team-details';

    const main = document.createElement('div');
    main.className = 'vm-team-main';

    const nick = document.createElement('div');
    nick.className = 'vm-team-nick';
    nick.textContent = String(person.nick || 'Prezenter');
    nick.title = nick.textContent;

    main.append(nick);

    // Statusy po prawej stronie nicku.
    if (person.guest || person.vacation) {
      const badges = document.createElement('div');
      badges.className = 'vm-team-badges';

      if (person.guest) {
        const guest = document.createElement('span');
        guest.className =
          'vm-team-badge vm-team-badge--guest';
        guest.textContent = 'GOŚCINNIE';
        badges.append(guest);
      }

      if (person.vacation) {
        const vacation = document.createElement('span');
        vacation.className =
          'vm-team-badge vm-team-badge--vacation';
        vacation.textContent = 'URLOP';
        badges.append(vacation);
      }

      main.append(badges);
    }

    const meta = document.createElement('div');
    meta.className = 'vm-team-meta';

    const name = String(person.name || '').trim();
    const city = String(person.city || '').trim();

    meta.textContent =
      [name, city].filter(Boolean).join(' · ') ||
      'Ekipa VirtualMix';

    details.append(main, meta);
    card.append(avatar, details);

    return card;
  }

  // Ile pełnych kart zmieści się w panelu?
  function calculateTeamPageSize() {
    if (!teamViewport || !teamList ||
        !teamPeople.length) return 5;

    const sample = makeTeamCard(teamPeople[0]);
    teamList.replaceChildren(sample);

    const cardHeight = sample.getBoundingClientRect().height;
    const listStyle = getComputedStyle(teamList);
    const gap = parseFloat(listStyle.rowGap) || 5;

    const available = teamViewport.clientHeight -
      (parseFloat(listStyle.paddingTop) || 0) -
      (parseFloat(listStyle.paddingBottom) || 0);

    return Math.max(
      1,
      Math.floor((available + gap) / (cardHeight + gap))
    );
  }

  function renderTeamPage(page = 0) {
    if (!teamList || !teamPeople.length ||
        !teamPanel || teamPanel.hidden) return;

    const totalPages = Math.ceil(
      teamPeople.length / teamPageSize
    );

    teamCurrentPage =
      ((page % totalPages) + totalPages) % totalPages;

    const start = teamCurrentPage * teamPageSize;
    const end = start + teamPageSize;
    const people = teamPeople.slice(start, end);

    const frag = document.createDocumentFragment();

    people.forEach(person => {
      frag.append(makeTeamCard(person));
    });

    teamList.replaceChildren(frag);

    if (teamPage) {
      teamPage.textContent =
        `${teamCurrentPage + 1} / ${totalPages}`;
    }

    teamViewport.scrollTop = 0;
  }

  function stopTeamRotation() {
    if (teamTimer !== null) {
      clearInterval(teamTimer);
      teamTimer = null;
    }
  }

  function startTeamRotation() {
    stopTeamRotation();

    if (!teamPanel || teamPanel.hidden ||
        document.hidden) return;

    const totalPages = Math.ceil(
      teamPeople.length / teamPageSize
    );

    if (totalPages <= 1) return;

    // Zmiana całej strony co 7 sekund.
    teamTimer = setInterval(() => {
      if (!teamPanel.hidden && !document.hidden) {
        renderTeamPage(teamCurrentPage + 1);
      }
    }, 7000);
  }

  function refreshTeamLayout() {
    if (!teamLoaded || !teamPeople.length ||
        !teamPanel || teamPanel.hidden) return;

    stopTeamRotation();

    teamPageSize = calculateTeamPageSize();
    renderTeamPage(0);
    startTeamRotation();
  }

  async function loadTeam(force = false) {
    if (!teamPanel || !teamList ||
        teamPanel.hidden || teamBusy) return;

    if (!force && teamLoaded &&
        Date.now() - teamLastFetch < 300000) {
      refreshTeamLayout();
      return;
    }

    teamBusy = true;

    if (!teamLoaded) {
      teamList.textContent = 'Ładowanie ekipy…';
    }

    try {
      const endpoint = new URL(TEAM_URL);
      endpoint.searchParams.set('_', Date.now());

      const response = await fetch(endpoint.href, {
        cache: 'no-store',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const data = await response.json();

      const people = Array.isArray(data)
        ? data
        : Array.isArray(data.people)
          ? data.people
          : [];

      if (!people.length) {
        if (!teamLoaded) {
          teamList.textContent =
            'Ekipa jest chwilowo niedostępna.';
        }
        return;
      }

      teamPeople = people.filter(
        person => person && typeof person === 'object'
      );

      teamLoaded = true;
      teamLastFetch = Date.now();

      if (teamCount) {
        teamCount.textContent =
          `${teamPeople.length} osób`;
      }

      refreshTeamLayout();

    } catch (error) {
      console.warn('VirtualMix ekipa:', error);

      if (!teamLoaded) {
        teamList.textContent =
          'Nie udało się pobrać ekipy.';
      }
    } finally {
      teamBusy = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTeamRotation();
    } else if (teamPanel && !teamPanel.hidden) {
      startTeamRotation();
    }
  });

  window.addEventListener('resize', () => {
    if (teamLoaded && teamPanel && !teamPanel.hidden) {
      refreshTeamLayout();
    }
  }, { passive: true });

  setInterval(() => {
    if (teamPanel && !teamPanel.hidden) {
      loadTeam(true);
    }
  }, 300000);

   
  // =========================================
  // VIRTUALMIX — PODGLĄD LIVE BEZ DŹWIĘKU
  // =========================================

  const LIVE_PREVIEW_URL =
    'https://virtualmix.pl/vm_live_embed_proxy.php?muted_preview=1';

  const liveFrame =
    document.querySelector('[data-live-frame]');

  let livePreviewEnabled = false;

  function setLivePreview(enabled) {
    if (!liveFrame) return;

    if (enabled && !livePreviewEnabled) {
      liveFrame.src = LIVE_PREVIEW_URL;
      livePreviewEnabled = true;
    }

    if (!enabled && livePreviewEnabled) {
      liveFrame.removeAttribute('src');
      livePreviewEnabled = false;
    }
  }


  // Publiczne proxy ramówki VirtualMix.
  const SCHEDULE_PROXY_URL = 'https://virtualmix.pl/vm_schedule_week_proxy.php';
  const schedulePanel = document.querySelector('[data-schedule]');
  const scheduleList = document.querySelector('[data-schedule-list]');
  const scheduleStatus = document.querySelector('[data-schedule-status]');
  let lastScheduleFetch = 0;
  let scheduleBusy = false;
  const zone = 'Europe/Warsaw';
  const dayFormat = new Intl.DateTimeFormat('en-GB', {timeZone:zone, weekday:'short'});
  const dateFormat = new Intl.DateTimeFormat('pl-PL', {timeZone:zone,day:'2-digit',month:'2-digit'});
  const clockFormat = new Intl.DateTimeFormat('en-GB', {timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const daysByName = {Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
  function polandNow() {
    const d=new Date();
    return {day:daysByName[dayFormat.format(d)] || 1, clock:clockFormat.format(d),label:dateFormat.format(d)};
  }
  function isCanceled(row) {
    const status=String(row.status ?? '').toLowerCase();
    return ['canceled','cancelled','odwolana','odwołana','odwolane','odwołane'].includes(status);
  }
  function minutes(time) {
    const m=/^(\d{1,2}):(\d{2})$/.exec(String(time||''));
    return m ? Number(m[1])*60+Number(m[2]) : null;
  }
  function isCurrent(row, clock) {
    if(isCanceled(row)) return false;
    const s=minutes(row.start),e=minutes(row.end),now=minutes(clock);
    if(s===null || e===null || now===null || s===e) return false;
    return e>s ? now>=s && now<e : now>=s || now<e;
  }
  function getSafeAvatar(raw) {
    try {
      const u=new URL(String(raw||''));
      return u.protocol==='https:' ? u.href : '';
    } catch(_) {return '';}
  }
  function makeEntry(row, current) {
    const article=document.createElement('article');
    article.className='vm-schedule-entry'+(current?' is-current':'')+(isCanceled(row)?' is-canceled':'');
    const url=getSafeAvatar(row.avatar);
    const avatar=url ? document.createElement('img') : document.createElement('span');
    avatar.className='vm-schedule-avatar'+(url?'':' vm-schedule-avatar-fallback');
    if(url) {avatar.src=url;avatar.alt='';avatar.loading='lazy';avatar.referrerPolicy='no-referrer';avatar.addEventListener('error',()=>{avatar.replaceWith(Object.assign(document.createElement('span'),{className:'vm-schedule-avatar vm-schedule-avatar-fallback',textContent:'♫'}));},{once:true});}
    else avatar.textContent='♫';
    const info=document.createElement('div');info.className='vm-schedule-info';
    const time=document.createElement('div');time.className='vm-schedule-time';
    time.textContent=`${row.start||'--:--'} – ${row.end||'--:--'}`;
    const name=document.createElement('div');name.className='vm-schedule-presenter';
    name.textContent=String(row.presenter || 'VirtualMix');
    name.title=String(row.presenter || 'VirtualMix');
    if(current){ const now=document.createElement('span');now.className='vm-schedule-now';now.textContent='TERAZ';time.append(now);}
    if(isCanceled(row)){const cancel=document.createElement('span');cancel.className='vm-schedule-now';cancel.textContent='ODWOŁANA';time.append(cancel);}
    info.append(time,name);article.append(avatar,info);
    return article;
  }
  async function loadSchedule(force=false) {
    if (!schedulePanel || !scheduleList || scheduleBusy || schedulePanel.hidden) return;
    const today=polandNow();
    const label=document.querySelector('[data-schedule-date]');if(label) label.textContent=today.label;
    if (!SCHEDULE_PROXY_URL.trim()) {
      scheduleStatus.textContent='Ustaw adres proxy PHP w pliku script.js';return;
    }
    if(!force && Date.now()-lastScheduleFetch<60000) return;
    scheduleBusy=true;
    scheduleStatus.textContent='Ładowanie ramówki…';
    try {
      const endpoint=new URL(SCHEDULE_PROXY_URL);
      if(endpoint.protocol!=='https:') throw new Error('Adres proxy musi korzystać z HTTPS');
      endpoint.searchParams.set('_',String(Date.now()));
      const response=await fetch(endpoint.href,{cache:'no-store'});
      if(!response.ok) throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(data.ok===false) throw new Error('Proxy zwróciło błąd');
      const days=data.days ?? data.schedule ?? {};
      const rows=days[today.day] ?? days[String(today.day)] ?? [];
      if(!Array.isArray(rows)) throw new Error('Niepoprawny format days');
      const valid=rows.filter(r=>r && typeof r==='object').sort((a,b)=>String(a.start||'').localeCompare(String(b.start||'')));
      const frag=document.createDocumentFragment();let currentIndex=-1;
      valid.forEach((row,i)=>{const active=isCurrent(row,today.clock);if(active)currentIndex=i;frag.append(makeEntry(row,active));});
      scheduleList.replaceChildren(frag);
      scheduleStatus.textContent=valid.length?'':'Brak audycji na dziś';
      // W xatframe środek panelu może nie odbierać scrolla: pokazujemy bieżącą pozycję automatycznie.
      requestAnimationFrame(()=>{
        const active=scheduleList.querySelector('.is-current');
        if(active) scheduleList.scrollTop=Math.max(0,active.offsetTop-scheduleList.offsetTop-scheduleList.clientHeight/3);
        else scheduleList.scrollTop=0;
      });
      lastScheduleFetch=Date.now();
    } catch(err){scheduleStatus.textContent='Nie udało się pobrać ramówki';console.warn('VirtualMix ramówka:',err);}
    finally {scheduleBusy=false;}
  }
  setInterval(()=>{if(schedulePanel && !schedulePanel.hidden)loadSchedule(true);},60000);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d', {alpha: true});
  if (!ctx) return;
  let width = 0, height = 0, particles = [], raf = 0;
  const safe = () => Math.min(width * 0.43, 440);
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(125, Math.round(width / 18));
    particles = Array.from({length: count}, makeParticle);
  }
  function makeParticle() {
    const left = Math.random() < .5;
    const zone = Math.max(50,(width - safe() * 2) / 2);
    return {
      x: left ? Math.random() * zone : width - Math.random() * zone,
      y: Math.random() * height,
      r: .5 + Math.random() * 2,
      s: .15 + Math.random() * .6,
      a: .18 + Math.random() * .55,
      color: left ? '0,160,255' : '255,99,15',
    };
  }
  function draw() {
    if (document.hidden) {raf = requestAnimationFrame(draw);return;}
    ctx.clearRect(0,0,width,height);
    for (let i=0; i<particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(${p.color},${p.a})`;
      ctx.shadowColor = `rgba(${p.color},.6)`;
      ctx.shadowBlur = 9;
      ctx.fill();
      p.y -= p.s;
      p.x += Math.sin((p.y+i*32)/85)*.17;
      if(p.y < -10) Object.assign(p,makeParticle(),{y:height+10});
    }
    ctx.shadowBlur = 0;
    raf = requestAnimationFrame(draw);
  }
  resize(); draw();
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('pagehide',()=>cancelAnimationFrame(raf));
})();
