'use strict';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function play(video) { const promise = video.play(); if (promise) promise.catch(() => {}); }
function pause(video) { video.pause(); }
// Keep hidden panels and off-screen media silent. The narrated intro plays on request.
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (!entry.isIntersecting) pause(entry.target); });
  }, { threshold: 0 });
  $$('video').forEach(video => observer.observe(video));
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) $$('video').forEach(pause);
});
$$('video').forEach(video => video.addEventListener('play', () => {
  if (video.id === 'intro-video') $$('video').filter(other => other !== video).forEach(pause);
  else pause($('#intro-video'));
}));
// Load the full intro only after its source upload and encoding have finished.
async function loadIntro() {
  const video = $('#intro-video');
  const status = $('#intro-status');
  try {
    const response = await fetch('assets/intro-status.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Intro status unavailable');
    const info = await response.json();
    if (!info.ready) {
      status.textContent = 'Intro video is being prepared.';
      setTimeout(loadIntro, 15000);
      return;
    }
    const source = video.querySelector('source');
    source.src = `${source.dataset.src}?v=${encodeURIComponent(info.version)}`;
    video.controls = true;
    video.load();
    status.hidden = true;
  } catch {
    // Direct file preview cannot fetch JSON; native video playback still works.
    if (location.protocol === 'file:') {
      video.querySelector('source').src = video.querySelector('source').dataset.src;
      video.controls = true;
      video.load();
      status.hidden = true;
    } else {
      status.textContent = 'Intro video is being prepared.';
      setTimeout(loadIntro, 15000);
    }
  }
}
loadIntro();
function selectTab(button) {
  const list = button.closest('[role="tablist"]');
  list.querySelectorAll('[role="tab"]').forEach(tab => {
    const selected = tab === button;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.classList.toggle('active', selected);
  });
}
$$('[role="tablist"]').forEach(list => {
  list.addEventListener('keydown', event => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    let next;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); tabs[next].focus(); tabs[next].click(); }
  });
});
function changeVideo(video, slug) {
  pause(video);
  video.poster = `assets/images/${slug}.webp`;
  video.querySelector('source').src = `assets/videos/${slug}.mp4`;
  video.load();
  // An explicit tab selection requests a preview; reduced-motion users retain manual playback.
  if (!reducedMotion.matches) play(video);
}
const demos = {
  folding: {kind: 'Contact-rich manipulation', title: 'Fold the cardboard box.', description: 'Transform a flat cardboard box into a usable container through a sequence of coordinated, contact-rich interactions.', score: '40%', data: '100 teleoperated episodes', speed: '4×'},
  packing: {kind: 'Generalization to unseen combinations', title: 'Pack the requested objects.', description: 'Follow a language instruction to pack a specified set of objects. Train on 110 object combinations and reserve 95 unseen combinations for zero-shot evaluation.', score: '65%', data: '550 episodes · 110 combinations', speed: '3×'},
  line: {kind: 'Language-directed rearrangement', title: 'Put the blocks in a line.', description: 'Rearrange six wooden cubes into a requested line: horizontal at the top, horizontal at the bottom, or vertical.', score: '55%', data: '90 episodes · 3 line configurations', speed: '4×'}
};
$$('[data-demo]').forEach(button => button.addEventListener('click', () => {
  selectTab(button);
  const demo = demos[button.dataset.demo];
  for (const key of ['kind', 'title', 'description', 'score', 'data']) $(`#demo-${key}`).textContent = demo[key];
  $('#demo-speed').textContent = `Real robot · ${demo.speed} speed`;
  $('#demo-panel').setAttribute('aria-labelledby', button.id);
  changeVideo($('#demo-video'), button.dataset.demo);
}));
$$('[data-budget]').forEach(button => button.addEventListener('click', () => {
  selectTab(button);
  const budget = button.dataset.budget;
  $('#budget-panel').setAttribute('aria-labelledby', button.id);
  $('#budget-caption').textContent = `Generated plan · ${budget} generator call${budget === '1' ? '' : 's'} · Presentation, slide 19`;
  changeVideo($('#search-video'), `search-${budget}`);
}));
const arrangements = {left: 'Bread down, blue cube top left, bear top right.', up: 'Bread up, blue cube bottom left, bear bottom right.', right: 'Bread down, bear top left, blue cube top right.'};
$$('[data-steer]').forEach(button => button.addEventListener('click', () => {
  selectTab(button);
  $('#steering-panel').setAttribute('aria-labelledby', button.id);
  $('#steering-caption').textContent = `Generated plan · ${arrangements[button.dataset.steer]}`;
  changeVideo($('#steering-video'), `steer-${button.dataset.steer}`);
}));
$('#replay-comparison').addEventListener('click', () => {
  $$('.comparison video').forEach(video => { video.currentTime = 0; play(video); });
});
// Keep the fixed contents rail in sync with continuous document scrolling.
const sectionMenu = $('.section-menu');
const compactNavigation = window.matchMedia('(max-width: 600px) and (hover: none) and (pointer: coarse)');
const sectionLinks = $$('nav[aria-label="Page sections"] a');
const linkedSections = sectionLinks.map(link => $(link.hash));
function syncNavigationLayout() {
  sectionMenu.open = !compactNavigation.matches;
  scheduleSectionUpdate();
}
sectionLinks.forEach(link => link.addEventListener('click', () => {
  if (compactNavigation.matches) sectionMenu.open = false;
}));
$('.site-header .wordmark').addEventListener('click', () => {
  if (compactNavigation.matches) sectionMenu.open = false;
});
let sectionUpdatePending = false;
function updateCurrentSection() {
  sectionUpdatePending = false;
  const marker = compactNavigation.matches ? $('.site-header').offsetHeight + 24 : 72;
  let current = 0;
  linkedSections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= marker) current = index;
  });
  // The final section may be shorter than the viewport.
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
    current = sectionLinks.length - 1;
  }
  sectionLinks.forEach((link, index) => {
    const active = index === current;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  $('#current-section').textContent = sectionLinks[current].lastElementChild.textContent;
}
function scheduleSectionUpdate() {
  if (sectionUpdatePending) return;
  sectionUpdatePending = true;
  requestAnimationFrame(updateCurrentSection);
}
compactNavigation.addEventListener('change', syncNavigationLayout);
window.addEventListener('scroll', scheduleSectionUpdate, { passive: true });
window.addEventListener('resize', scheduleSectionUpdate);
window.addEventListener('load', scheduleSectionUpdate);
if ('ResizeObserver' in window) new ResizeObserver(scheduleSectionUpdate).observe($('#main'));
syncNavigationLayout();


// Numbered buttons and panel navigation follow the CIMI interaction pattern.
$$('[data-panel-group]').forEach(list => {
  const tabs = [...list.querySelectorAll('[data-panel-tab]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const isMethod = list.dataset.panelGroup === 'method';
  let selectedIndex = 0;
  function activate(index, focus = false) {
    selectedIndex = index;
    selectTab(tabs[index]);
    panels.forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== index;
      if (panel.hidden) panel.querySelectorAll('video').forEach(pause);
    });
    if (isMethod) {
      $('#method-progress').textContent = `Step ${index + 1} of ${tabs.length} · ${tabs[index].lastElementChild.textContent}`;
      $('#method-previous').disabled = index === 0;
      $('#method-next').disabled = index === tabs.length - 1;
      $('#method-next').textContent = index === tabs.length - 1 ? 'Final step' : 'Next step →';
    }
    if (focus) tabs[index].focus({ preventScroll: true });
    scheduleSectionUpdate();
  }
  tabs.forEach((tab, index) => tab.addEventListener('click', () => activate(index)));
  if (isMethod) {
    $('#method-previous').addEventListener('click', () => activate(Math.max(0, selectedIndex - 1), true));
    $('#method-next').addEventListener('click', () => activate(Math.min(tabs.length - 1, selectedIndex + 1), true));
  }
});
