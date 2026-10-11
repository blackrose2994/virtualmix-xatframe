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

