/* =========================================================================
   XP-Style Portfolio — script.js
   Sections:
     1) Globals & Helpers
     2) Audio / Chime
     3) Window State & Taskbar (ensureTaskButton, activateTaskButton)
     4) Window Operations (open, close, minimize, restore, maximize)
     5) Dragging & Double-click behavior
     6) Resizing (resizer handle)
     7) Task menu (taskbar right-click)
     8) Icon / Start Menu interactions
     9) Delegated control buttons (min/max/close)
    10) Init & keyboard / orientation helpers
   ========================================================================= */

/* ---------------------------
   1) Globals & Helpers
   --------------------------- */
const desktop = document.getElementById('desktop');
const windows = Array.from(document.querySelectorAll('.window'));
const icons = document.querySelectorAll('.icon');
const taskButtonsContainer = document.getElementById('taskButtons');
const startBtn = document.getElementById('startBtn');
const startMenu = document.getElementById('startMenu');
let highestZ = 10;
let audioStarted = false;

/* small helper to get/set state */
function getWindowState(win){ return win.dataset.state || 'normal'; }
function setWindowState(win,state){ win.dataset.state = state; }

/* geometry helper */
function rectCenter(el){ const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; }

/* ---------------------------
   2) Audio / Chime
   --------------------------- */
function playXPChime() {
  if (!window.AudioContext) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const seq = [[523.25,0.12],[659.25,0.14],[783.99,0.18]];
  let start = ctx.currentTime + 0.02;
  seq.forEach(([freq,dur])=>{
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sine'; o.frequency.value = freq; g.gain.value = 0;
    o.connect(g); g.connect(ctx.destination); o.start(start);
    g.gain.linearRampToValueAtTime(0.12, start + 0.02);
    g.gain.linearRampToValueAtTime(0.0001, start + dur);
    o.stop(start + dur + 0.01);
    start += dur + 0.02;
  });
}
function ensureAudioGesture() { if (audioStarted) return; audioStarted = true; try{ playXPChime(); }catch(e){} }
function maybePlayOnOpen() { if (audioStarted) playXPChime(); }

/* ---------------------------
   3) Taskbar buttons
   --------------------------- */
function ensureTaskButton(forWin){
  const name = forWin.dataset.name || 'App';
  let btn = taskButtonsContainer.querySelector(`[data-for="${forWin.id}"]`);
  if (!btn){
    btn = document.createElement('div');
    btn.className = 'task-btn';
    btn.dataset.for = forWin.id;
    btn.textContent = name;

    // click toggles minimize/restore
    btn.addEventListener('click', () => {
      if (getWindowState(forWin) === 'minimized') restoreWindow(btn, forWin);
      else minimizeWindow(forWin);
    });

    // context menu / long press -> task menu
    btn.addEventListener('contextmenu', (e) => { e.preventDefault(); showTaskMenu(btn, forWin); });
    let pressTimer = null;
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') pressTimer = setTimeout(() => showTaskMenu(btn, forWin), 600);
    });
    btn.addEventListener('pointerup', (e) => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });

    taskButtonsContainer.appendChild(btn);
  }
  return btn;
}

function activateTaskButton(forWin){
  const all = taskButtonsContainer.querySelectorAll('.task-btn');
  all.forEach(b=> b.classList.toggle('active', b.dataset.for === forWin.id));
}

/* ---------------------------
   4) Window operations
   --------------------------- */
function bringToFront(win){
  highestZ += 1;
  win.style.zIndex = highestZ;
  windows.forEach(w => w.dataset.focused = 'false');
  win.dataset.focused = 'true';
  activateTaskButton(win);
}

function minimizeWindow(win) {
  if (win.dataset.state === 'minimized') return;
  win.dataset.state = 'minimized';
  win.style.display = 'none';
  ensureTaskButton(win);
}

function restoreWindow(win) {
  win.style.display = '';
  win.classList.remove('minimized');
  win.dataset.state = 'normal';
  bringToFront(win);
}

function toggleMaximize(win) {
  const isMax = win.dataset.state === 'maximized';
  if (isMax) {
    // restore
    win.classList.remove('maximized');
    if (win.dataset.prevTop) win.style.top = win.dataset.prevTop;
    if (win.dataset.prevLeft) win.style.left = win.dataset.prevLeft;
    if (win.dataset.prevWidth) win.style.width = win.dataset.prevWidth;
    if (win.dataset.prevHeight) win.style.height = win.dataset.prevHeight;
    win.dataset.state = 'normal';
    const b1 = win.querySelector('.max-btn'); if (b1) b1.textContent = '▢';
  } else {
    // store previous geometry then maximize
    win.dataset.prevTop = win.style.top;
    win.dataset.prevLeft = win.style.left;
    win.dataset.prevWidth = win.style.width;
    win.dataset.prevHeight = win.style.height;
    win.classList.add('maximized');
    win.style.top = '0px';
    win.style.left = '0px';
    win.style.width = '100%';
    win.style.height = 'calc(100% - 54px)';
    win.dataset.state = 'maximized';
    const b2 = win.querySelector('.max-btn'); if (b2) b2.textContent = '❐';
  }
  bringToFront(win);
}

function closeWindow(win){
  if (win.dataset.animating === 'true') return;
  win.dataset.animating = 'true';
  win.style.transition = 'opacity 240ms linear, transform 260ms cubic-bezier(.2,.9,.2,1)';
  win.style.transformOrigin = 'center center';
  win.style.opacity = '0';
  win.style.transform = 'scale(0.96)';

  const onEnd = ()=>{
    win.removeEventListener('transitionend', onEnd);
    win.style.display = 'none';
    win.style.opacity = '';
    win.style.transform = '';
    win.style.transition = '';
    win.dataset.animating = '';
    setWindowState(win,'normal');
    const btn = taskButtonsContainer.querySelector(`[data-for="${win.id}"]`);
    if (btn) btn.remove();
  };
  win.addEventListener('transitionend', onEnd);
  setTimeout(()=>{ if (win.dataset.animating) onEnd(); }, 340);
}

function openWindow(win){
  if (win.dataset.animating === 'true') return;
  win.style.display = '';
  win.style.opacity = '0';
  win.style.transform = 'scale(0.98)';
  requestAnimationFrame(()=>{
    win.style.transition = 'opacity 240ms linear, transform 260ms cubic-bezier(.2,.9,.2,1)';
    win.style.opacity = '1';
    win.style.transform = 'scale(1)';
  });
  const onEnd = (ev)=>{
    if (ev && ev.propertyName && !['opacity','transform'].includes(ev.propertyName)) return;
    win.removeEventListener('transitionend', onEnd);
    win.style.transition = '';
    win.style.transform = '';
    win.style.opacity = '';
    bringToFront(win);
  };
  win.addEventListener('transitionend', onEnd);
  ensureTaskButton(win);
  maybePlayOnOpen();
  setWindowState(win,'normal');
}

/* ---------------------------
   5) Draggable windows (title-bar)
   --------------------------- */
function makeDraggable(win){
  const title = win.querySelector('.title-bar');
  let dragging = false, startX=0, startY=0, origX=0, origY=0;

  title.addEventListener('pointerdown', (e) => {
    // prevent starting drag when interacting with title controls
    if (e.target.closest('.title-controls')) return;
    e.preventDefault();
    ensureAudioGesture();
    bringToFront(win);
    if (win.classList.contains('maximized')) return; // can't drag while maximized
    dragging = true;
    title.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    origX = win.offsetLeft; origY = win.offsetTop;
    title.style.cursor = 'grabbing';
  });

  title.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    win.style.left = (origX + dx) + 'px';
    win.style.top = (origY + dy) + 'px';
  });

  title.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    try { title.releasePointerCapture(e.pointerId); } catch(e){}
    title.style.cursor = 'grab';
  });

  // double-click on title (not on controls) toggles maximize
  title.addEventListener('dblclick', (e) => {
    if (e.target.closest('.title-controls')) return;
    toggleMaximize(win);
  });

  // focus when clicking body too
  win.addEventListener('pointerdown', () => { bringToFront(win); ensureAudioGesture(); });
}

/* ---------------------------
   6) Resizable windows
   --------------------------- */
function makeResizable(win){
  // add bottom-right resizer handle
  const handle = document.createElement('div');
  handle.className = 'resizer';
  win.appendChild(handle);

  let resizing = false;
  let startX = 0, startY = 0, startW = 0, startH = 0;

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); bringToFront(win);
    // if maximized, restore before resizing
    if (win.classList.contains('maximized')) {
      win.classList.remove('maximized');
      if (win.dataset.prevWidth) win.style.width = win.dataset.prevWidth;
      if (win.dataset.prevHeight) win.style.height = win.dataset.prevHeight;
      if (win.dataset.prevLeft) win.style.left = win.dataset.prevLeft;
      if (win.dataset.prevTop) win.style.top = win.dataset.prevTop;
      win.dataset.state = 'normal';
    }
    resizing = true;
    startX = e.clientX; startY = e.clientY;
    startW = win.offsetWidth; startH = win.offsetHeight;
    handle.setPointerCapture(e.pointerId);
  });

  function onPointerMove(e){
    if (!resizing) return;
    const dx = e.clientX - startX; const dy = e.clientY - startY;
    const newW = Math.max(260, startW + dx);
    const newH = Math.max(120, startH + dy);
    win.style.width = newW + 'px';
    win.style.height = newH + 'px';
    win.dataset.state = 'normal';
  }
  function onPointerUp(e){
    if (!resizing) return;
    resizing = false;
    try{ handle.releasePointerCapture(e.pointerId); } catch(e){}
  }
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}

/* ---------------------------
   7) Task menu (small menu above task button)
   --------------------------- */
function showTaskMenu(btn, win){
  removeTaskMenu();
  const menu = document.createElement('div');
  menu.className = 'task-menu';
  menu.innerHTML = `
    <div class="item" data-action="restore">Restore</div>
    <div class="item" data-action="maximize">Maximize</div>
    <div class="item" data-action="close">Close</div>
  `;
  document.body.appendChild(menu);
  const rect = btn.getBoundingClientRect();
  menu.style.left = rect.left + 'px';
  menu.style.top = (rect.top - menu.offsetHeight - 8) + 'px';

  menu.addEventListener('click', (e)=>{
    const it = e.target.closest('.item'); if (!it) return;
    const act = it.dataset.action;
    if (act === 'restore') restoreWindow(btn, win);
    else if (act === 'maximize') {
      if (getWindowState(win) === 'maximized') toggleMaximize(win);
      else {
        if (getWindowState(win) === 'minimized') { restoreWindow(btn, win); setTimeout(()=> toggleMaximize(win), 260); }
        else toggleMaximize(win);
      }
    }
    else if (act === 'close') closeWindow(win);
    removeTaskMenu();
  });

  setTimeout(()=>{ document.addEventListener('click', removeTaskMenu); }, 10);
}
function removeTaskMenu(){ const existing = document.querySelector('.task-menu'); if (existing) { existing.remove(); document.removeEventListener('click', removeTaskMenu); } }

/* ---------------------------
   8) Icon behavior & dynamic project windows
   --------------------------- */
icons.forEach(ic=>{
  ic.addEventListener('click', ()=>{
    ensureAudioGesture();
    const target = document.getElementById(ic.dataset.target);
    if (target) openWindow(target);
  });
  ic.addEventListener('keydown', e=>{ if (e.key==='Enter') ic.click(); });
});

/* dynamic project windows (cards inside Projects) */
const projectList = document.getElementById('project-list');
if (projectList) {
  projectList.addEventListener('click', (ev)=>{
    const card = ev.target.closest('.file-card'); if (!card) return;
    ensureAudioGesture();
    const projId = card.dataset.proj;
    let projWin = document.getElementById(projId);
    if (!projWin){
      projWin = document.createElement('div');
      projWin.className='window';
      projWin.id = projId;
      projWin.dataset.name = card.textContent.trim();
      projWin.dataset.state='normal';
      projWin.style.top = (120 + Math.random()*80) + 'px';
      projWin.style.left = (100 + Math.random()*160) + 'px';
      projWin.innerHTML = `
        <div class="title-bar">
          <div class="title-left"><div class="icon-mini"></div><div>${card.textContent.trim()}</div></div>
          <div class="title-controls">
            <button type="button" class="min-btn">_</button>
            <button type="button" class="max-btn">▢</button>
            <button type="button" class="close-btn">✕</button>
          </div>
        </div>
        <div class="window-body">
          <h1>${card.textContent.trim()}</h1>
          <p>A demo page for this project. Replace with screenshots, links, or an embedded demo.</p>
        </div>
      `;
      desktop.appendChild(projWin);
      windows.push(projWin);
      makeDraggable(projWin);
      makeResizable(projWin);
    }
    openWindow(projWin);
  });
}

/* ---------------------------
   9) Start button & start menu behavior
   --------------------------- */
startBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  ensureAudioGesture();
  startMenu.style.display = (startMenu.style.display === 'block') ? 'none' : 'block';
  startMenu.setAttribute('aria-hidden', startMenu.style.display !== 'block');
});

// close start menu when clicking elsewhere
document.addEventListener('click', ()=>{
  if (startMenu.style.display === 'block') {
    startMenu.style.display = 'none';
    startMenu.setAttribute('aria-hidden','true');
  }
});

// open items from start menu
startMenu.addEventListener('click', (e)=>{
  const item = e.target.closest('.start-item'); if (!item) return;
  const openId = item.dataset.open;
  if (openId){
    const w = document.getElementById(openId);
    if (w) openWindow(w);
  }
  // small demo actions
  if (item.id === 'myComputer') alert('My Computer (this is a demo).');
  if (item.id === 'controlPanel') alert('Control Panel (demo).');
  if (item.id === 'shutDown') {
    const overlay = document.createElement('div'); overlay.style.position='fixed'; overlay.style.inset=0; overlay.style.background='#000'; overlay.style.opacity='0'; overlay.style.zIndex=9999999; document.body.appendChild(overlay);
    requestAnimationFrame(()=>{ overlay.style.transition='opacity 600ms linear'; overlay.style.opacity='1'; });
  }
  startMenu.style.display='none';
  startMenu.setAttribute('aria-hidden','true');
});

/* ---------------------------
   10) Delegated control buttons handler
       (works for both static & dynamic windows)
   --------------------------- */
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.min-btn, .max-btn, .close-btn');
  if (!btn) return;
  const win = btn.closest('.window');
  if (!win) return;
  e.stopPropagation();
  ensureAudioGesture();
  if (btn.classList.contains('min-btn')) minimizeWindow(win);
  else if (btn.classList.contains('max-btn')) toggleMaximize(win);
  else if (btn.classList.contains('close-btn')) closeWindow(win);
});

/* ---------------------------
   11) Init / keyboard / orientation helpers
   --------------------------- */
windows.forEach(w=>{
  w.style.display = 'none';
  setWindowState(w,'normal');
  // wire up draggable/resizable for initial windows
  makeDraggable(w);
  makeResizable(w);
});

// first gesture for audio
document.addEventListener('pointerdown', function one(){ ensureAudioGesture(); document.removeEventListener('pointerdown', one); });

// Esc key behaviour (close top window or remove dynamic project)
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape'){
    const top = windows.slice().sort((a,b)=> (b.style.zIndex||0)-(a.style.zIndex||0))[0];
    if (!top) return;
    if (top.id && top.id.startsWith('proj-')) {
      top.remove();
      const tbtn = taskButtonsContainer.querySelector(`[data-for="${top.id}"]`);
      if (tbtn) tbtn.remove();
    } else {
      top.style.display='none';
      const tbtn = taskButtonsContainer.querySelector(`[data-for="${top.id}"]`);
      if (tbtn) tbtn.remove();
    }
  }
});

// orientation warning
const rotateWarning = document.getElementById('rotateWarning');
function checkOrientation(){
  if (window.innerWidth < window.innerHeight && window.innerWidth <= 900) rotateWarning.style.display='flex';
  else rotateWarning.style.display='none';
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('load', checkOrientation);
