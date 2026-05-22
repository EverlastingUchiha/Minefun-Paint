// ==UserScript==
// @name         MineFun Paint Tool.
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Paint tool. Use ALT+Z to start.
// @author       Itz_Krishna AKA Everlasting
// @match        https://minefun.io/*
// @match        https://*.minefun.io/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CFG = {
    accent:    '#0ff',
    accentGlow:'0 0 5px #0ff, 0 0 10px #0ff',
    panelBg:   '#0a0a1a',
    panelDark: '#05050f',
    text:      '#e0e0ff',
    dim:       '#8888aa',
    maxUndo:   30,
  };

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  function makeLayer(zOffset) {
    const c = document.createElement('canvas');
    c.width  = W();
    c.height = H();
    Object.assign(c.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100vw', height: '100vh',
      pointerEvents: 'none',
      zIndex: String(2147483640 + zOffset),
    });
    document.body.appendChild(c);
    return c;
  }

  const lImg  = makeLayer(0);
  const lDraw = makeLayer(1);
  const lPrev = makeLayer(2);

  const cImg  = lImg.getContext('2d');
  const cDraw = lDraw.getContext('2d');
  const cPrev = lPrev.getContext('2d');

  let paintEnabled = false;
  let tool        = 'brush';
  let brushColor  = CFG.accent;
  let brushSize   = 8;
  let brushTex    = 'solid';
  let useGrad     = false;
  let gradColor1  = '#ff00ff';
  let gradColor2  = '#00ffff';
  let layerAlpha  = 1;

  let painting    = false;
  let startX = 0, startY = 0;
  let brushPts    = [];
  let snapData    = null;

  let loadedImg   = null;
  let imgX = 100, imgY = 100;
  let imgW = 0,   imgH = 0;
  let imgDragOn   = false;
  let draggingImg = false;
  let dOffX = 0,  dOffY = 0;

  let pickerActive = false;

  let undoStack = [];
  let redoStack = [];

  let toastTimeout = null;
  function showMessage(msg, isError = false) {
    const toast = document.getElementById('pp-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = isError ? '#f44' : CFG.accent;
    toast.style.opacity = '1';
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
  }

  function snap() {
    const d = cDraw.getImageData(0, 0, lDraw.width, lDraw.height);
    undoStack.push(d);
    if (undoStack.length > CFG.maxUndo) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (!undoStack.length) { showMessage('Nothing to undo', true); return; }
    redoStack.push(cDraw.getImageData(0, 0, lDraw.width, lDraw.height));
    cDraw.putImageData(undoStack.pop(), 0, 0);
    showMessage('Undo');
  }

  function redo() {
    if (!redoStack.length) { showMessage('Nothing to redo', true); return; }
    undoStack.push(cDraw.getImageData(0, 0, lDraw.width, lDraw.height));
    cDraw.putImageData(redoStack.pop(), 0, 0);
    showMessage('Redo');
  }

  function getStrokeStyle(ctx, x1, y1, x2, y2) {
    if (!useGrad) return brushColor;
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, gradColor1);
    g.addColorStop(1, gradColor2);
    return g;
  }

  function getBrushStyle(ctx) {
    if (!useGrad || brushPts.length < 2) return brushColor;
    const first = brushPts[0];
    const last  = brushPts[brushPts.length - 1];
    return getStrokeStyle(ctx, first.x, first.y, last.x, last.y);
  }

  function setupDraw(ctx) {
    ctx.lineWidth   = brushSize;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.globalAlpha = layerAlpha;
    ctx.globalCompositeOperation = (tool === 'eraser') ? 'destination-out' : 'source-over';
  }

  function addPoint(x, y) {
    brushPts.push({ x, y });

    if (brushPts.length === 1) {
      cDraw.save();
      setupDraw(cDraw);
      cDraw.beginPath();
      cDraw.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      cDraw.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : getBrushStyle(cDraw);
      cDraw.fill();
      cDraw.restore();
      return;
    }

    cDraw.save();
    setupDraw(cDraw);

    if (brushTex === 'spray') {
      cDraw.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
      for (let i = 0; i < brushSize * 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * brushSize;
        cDraw.fillRect(x + Math.cos(a)*r, y + Math.sin(a)*r, 1.2, 1.2);
      }
    } else if (brushPts.length >= 3) {
      const p0 = brushPts[brushPts.length - 3];
      const p1 = brushPts[brushPts.length - 2];
      const p2 = brushPts[brushPts.length - 1];

      if (brushTex === 'calligraphy') {
        const angle = Math.atan2(p2.y - p0.y, p2.x - p0.x);
        cDraw.lineWidth = Math.max(1, brushSize * (0.4 + Math.abs(Math.sin(angle)) * 0.6));
      }
      if (brushTex === 'glow') {
        cDraw.shadowColor = brushColor;
        cDraw.shadowBlur  = brushSize * 2;
      }

      cDraw.strokeStyle = getBrushStyle(cDraw);
      cDraw.beginPath();
      cDraw.moveTo(p0.x, p0.y);
      cDraw.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      cDraw.stroke();
    }

    cDraw.restore();
  }

  function drawShape(ctx, shape, x1, y1, x2, y2, preview) {
    ctx.save();
    ctx.lineWidth   = brushSize;
    ctx.lineCap     = 'round';
    if (!preview) {
      ctx.globalAlpha = layerAlpha;
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = getStrokeStyle(ctx, x1, y1, x2, y2);
    } else {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = brushColor;
      ctx.setLineDash([5, 4]);
    }

    const w = x2 - x1;
    const h = y2 - y1;
    const cx = x1 + w/2;
    const cy = y1 + h/2;
    const radius = Math.min(Math.abs(w), Math.abs(h)) / 2;

    ctx.beginPath();

    if (shape === 'line') {
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    } else if (shape === 'rect') {
      ctx.strokeRect(x1, y1, w, h);
    } else if (shape === 'square') {
      const side = Math.max(Math.abs(w), Math.abs(h));
      const dx = w > 0 ? 1 : -1;
      const dy = h > 0 ? 1 : -1;
      ctx.strokeRect(x1, y1, dx * side, dy * side);
    } else if (shape === 'circle') {
      ctx.ellipse(cx, cy, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
    } else if (shape === 'triangle') {
      const angle = (2 * Math.PI) / 3;
      for (let i = 0; i < 3; i++) {
        const px = cx + radius * Math.cos(i * angle - Math.PI/2);
        const py = cy + radius * Math.sin(i * angle - Math.PI/2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (shape === 'pentagon') {
      const angle = (2 * Math.PI) / 5;
      for (let i = 0; i < 5; i++) {
        const px = cx + radius * Math.cos(i * angle - Math.PI/2);
        const py = cy + radius * Math.sin(i * angle - Math.PI/2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (shape === 'hexagon') {
      const angle = (2 * Math.PI) / 6;
      for (let i = 0; i < 6; i++) {
        const px = cx + radius * Math.cos(i * angle - Math.PI/2);
        const py = cy + radius * Math.sin(i * angle - Math.PI/2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    ctx.stroke();
    ctx.restore();
  }

  const tip = document.createElement('div');
  Object.assign(tip.style, {
    position:'fixed', display:'none',
    background:'rgba(0,0,0,0.8)', color:'#0ff',
    fontSize:'10px', padding:'2px 8px', borderRadius:'12px',
    pointerEvents:'none', zIndex:'9999999', fontFamily:'monospace',
    boxShadow:'0 0 4px #0ff',
  });
  document.body.appendChild(tip);

  function showTip(x, y, w, h, shape) {
    let text = `${Math.abs(Math.round(w))} × ${Math.abs(Math.round(h))}`;
    if (shape === 'square') {
      const side = Math.max(Math.abs(w), Math.abs(h));
      text = `${Math.abs(Math.round(side))} × ${Math.abs(Math.round(side))}`;
    }
    tip.style.left    = (x + 14) + 'px';
    tip.style.top     = (y + 14) + 'px';
    tip.style.display = 'block';
    tip.textContent   = text;
  }
  function hideTip() { tip.style.display = 'none'; }

  function pickColorAt(x, y) {
    const tmp = document.createElement('canvas');
    tmp.width = lDraw.width; tmp.height = lDraw.height;
    const tc = tmp.getContext('2d');
    tc.drawImage(lImg, 0, 0);
    tc.drawImage(lDraw, 0, 0);
    const px = tc.getImageData(x, y, 1, 1).data;
    brushColor = '#' + [px[0],px[1],px[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    const cp = document.getElementById('pp-color');
    if (cp) cp.value = brushColor;
    updateStatus();
    setTool('brush');
    showMessage('Color picked');
  }

  function redrawImage() {
    cImg.clearRect(0, 0, lImg.width, lImg.height);
    if (loadedImg) cImg.drawImage(loadedImg, imgX, imgY, imgW, imgH);
  }

  // Mouse events
  lPrev.addEventListener('mousedown', e => {
    if (e.button !== 0) return;

    if (pickerActive) {
      pickColorAt(e.clientX, e.clientY);
      pickerActive = false;
      const pb = document.getElementById('pp-picker');
      if (pb) pb.classList.remove('active');
      return;
    }

    if (imgDragOn && loadedImg) {
      const mx = e.clientX, my = e.clientY;
      if (mx >= imgX && mx <= imgX + imgW && my >= imgY && my <= imgY + imgH) {
        draggingImg = true;
        dOffX = mx - imgX;
        dOffY = my - imgY;
        return;
      }
    }

    if (!paintEnabled) return;

    painting = true;
    startX = e.clientX;
    startY = e.clientY;
    brushPts = [];

    snap();  // Save state before drawing anything (Brush, Eraser, Shape)

    if (tool === 'brush' || tool === 'eraser') {
      addPoint(startX, startY);
    } else {
      snapData = cDraw.getImageData(0, 0, lDraw.width, lDraw.height);
    }
  });

  lPrev.addEventListener('mousemove', e => {
    if (draggingImg) {
      imgX = Math.max(0, Math.min(W() - imgW, e.clientX - dOffX));
      imgY = Math.max(0, Math.min(H() - imgH, e.clientY - dOffY));
      redrawImage();
      return;
    }
    if (!paintEnabled || !painting) return;
    const x = e.clientX, y = e.clientY;

    if (tool === 'brush' || tool === 'eraser') {
      addPoint(x, y);
    } else {
      cDraw.putImageData(snapData, 0, 0);
      drawShape(cDraw, tool, startX, startY, x, y, false);
      cPrev.clearRect(0, 0, lPrev.width, lPrev.height);
      drawShape(cPrev, tool, startX, startY, x, y, true);
      showTip(x, y, x - startX, y - startY, tool);
    }
  });

  window.addEventListener('mouseup', () => {
    if (draggingImg) { draggingImg = false; return; }
    if (!paintEnabled || !painting) return;
    painting = false;
    cPrev.clearRect(0, 0, lPrev.width, lPrev.height);
    hideTip();
    brushPts = [];
  });

  window.addEventListener('resize', () => {
    const saved = cDraw.getImageData(0, 0, lDraw.width, lDraw.height);
    [lImg, lDraw, lPrev].forEach(c => { c.width = W(); c.height = H(); });
    cDraw.putImageData(saved, 0, 0);
    imgX = Math.max(0, Math.min(W() - imgW, imgX));
    imgY = Math.max(0, Math.min(H() - imgH, imgY));
    redrawImage();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', e => {
    if (e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      const p = document.getElementById('pp');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
      return;
    }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }

    if (!paintEnabled) return;
    const k = e.key.toLowerCase();
    const map = {
      b:'brush', e:'eraser', l:'line', r:'rect', s:'square', c:'circle',
      t:'triangle', p:'pentagon', h:'hexagon', i:'colorpicker'
    };
    if (map[k]) setTool(map[k]);
    if (k === 'g') {
      const cb = document.getElementById('pp-grad');
      if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
    }
  });

  // UI Helpers
  function setTool(name) {
    tool = name;
    if (name === 'colorpicker') pickerActive = true;
    else pickerActive = false;
    document.querySelectorAll('.pp-tool').forEach(btn => btn.classList.toggle('active', btn.dataset.tool === name));
    updateStatus();
  }

  function setPaint(v) {
    paintEnabled = v;
    lPrev.style.pointerEvents = v ? 'all' : 'none';
    const btn = document.getElementById('pp-toggle');
    if (btn) {
      btn.textContent = v ? 'PAINT ON' : 'PAINT OFF';
      btn.className = 'pp-toggle ' + (v ? 'on' : 'off');
    }
    showMessage(v ? 'Paint enabled' : 'Paint disabled');
  }

  function updateStatus() {
    const s = document.getElementById('pp-status');
    if (s) s.textContent = `${tool.toUpperCase()} | ${brushSize}px | ${brushColor}${useGrad ? ' GRADIENT' : ''}`;
  }

  function exportCanvas(format = 'png', quality = 0.92) {
    const canvas = document.createElement('canvas');
    canvas.width = lDraw.width; canvas.height = lDraw.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(lImg, 0, 0);
    ctx.globalAlpha = layerAlpha;
    ctx.drawImage(lDraw, 0, 0);
    return canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', quality);
  }

  function buildProject() {
    return {
      v: 1,
      drawing: lDraw.toDataURL(),
      image: loadedImg ? lImg.toDataURL() : null,
      imgX, imgY, imgW, imgH,
      tool, brushColor, brushSize, brushTex,
      useGrad, gradColor1, gradColor2, layerAlpha,
    };
  }

  function restoreProject(d) {
    if (!d || d.v !== 1) { showMessage('Incompatible project version', true); return; }
    const di = new Image();
    di.onload = () => {
      cDraw.clearRect(0, 0, lDraw.width, lDraw.height);
      cDraw.drawImage(di, 0, 0);
      snap();
    };
    di.src = d.drawing;
    if (d.image) {
      const ii = new Image();
      ii.onload = () => {
        loadedImg = ii;
        imgX = d.imgX; imgY = d.imgY; imgW = d.imgW; imgH = d.imgH;
        redrawImage();
      };
      ii.src = d.image;
    }
    tool = d.tool; brushColor = d.brushColor; brushSize = d.brushSize;
    brushTex = d.brushTex; useGrad = d.useGrad;
    gradColor1 = d.gradColor1; gradColor2 = d.gradColor2;
    layerAlpha = d.layerAlpha;
    syncUI(); updateStatus();
    showMessage('Project restored');
  }

  function syncUI() {
    setEl('pp-color',   brushColor);
    setEl('pp-color2a', gradColor1);
    setEl('pp-color2b', gradColor2);
    setEl('pp-size',    brushSize);
    setEl('pp-opacity', Math.round(layerAlpha * 100));
    setEl('pp-tex',     brushTex);
    const gc = document.getElementById('pp-grad');
    if (gc) { gc.checked = useGrad; }
    const sv = document.getElementById('pp-size-v');
    if (sv) sv.textContent = brushSize;
    const ov = document.getElementById('pp-op-v');
    if (ov) ov.textContent = Math.round(layerAlpha * 100);
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  // UI Panel
  const panel = document.createElement('div');
  panel.id = 'pp';
  panel.innerHTML = `
<div id="pp-hdr">
  <span id="pp-title">PAINT PRO</span>
  <div style="display:flex;gap:6px;align-items:center">
    <span id="pp-ver" style="font-size:9px;color:#0ff">v1.0</span>
    <button id="pp-x">✕</button>
  </div>
</div>

<div id="pp-tabs">
  <button class="pp-tab active" data-tab="draw">DRAW</button>
  <button class="pp-tab" data-tab="image">IMAGE</button>
  <button class="pp-tab" data-tab="info">INFO</button>
</div>

<div class="pp-page active" id="pp-page-draw">
  <button id="pp-toggle" class="pp-toggle off">PAINT OFF</button>
  <div class="pp-sec">
    <div class="pp-lbl">TOOLS</div>
    <div class="pp-tools">
      <button class="pp-tool active" data-tool="brush" title="Brush (B)">🖌</button>
      <button class="pp-tool"        data-tool="eraser" title="Eraser (E)">◯</button>
      <button class="pp-tool"        data-tool="line"   title="Line (L)">╱</button>
      <button class="pp-tool"        data-tool="rect"   title="Rectangle (R)">▭</button>
      <button class="pp-tool"        data-tool="square" title="Square (S)">□</button>
      <button class="pp-tool"        data-tool="circle" title="Circle (C)">○</button>
      <button class="pp-tool"        data-tool="triangle" title="Triangle (T)">▲</button>
      <button class="pp-tool"        data-tool="pentagon" title="Pentagon (P)">⬟</button>
      <button class="pp-tool"        data-tool="hexagon"  title="Hexagon (H)">⬡</button>
      <button class="pp-tool"        id="pp-picker" data-tool="colorpicker" title="Color Picker (I)">◉</button>
    </div>
  </div>

  <div class="pp-sec pp-row">
    <div style="flex:1">
      <div class="pp-lbl">COLOR</div>
      <input type="color" id="pp-color" value="${CFG.accent}">
    </div>
    <div style="flex:2">
      <div class="pp-lbl">GRADIENT <input type="checkbox" id="pp-grad" style="vertical-align:middle"></div>
      <div id="pp-grad-wrap2" style="display:flex;gap:4px">
        <input type="color" id="pp-color2a" value="#ff00ff" title="Gradient start">
        <input type="color" id="pp-color2b" value="#00ffff" title="Gradient end">
      </div>
    </div>
  </div>

  <div class="pp-sec">
    <div class="pp-lbl">SIZE: <span id="pp-size-v">8</span>px</div>
    <input type="range" id="pp-size" min="1" max="100" value="8">
  </div>

  <div class="pp-sec">
    <div class="pp-lbl">TEXTURE</div>
    <select id="pp-tex">
      <option value="solid">Solid</option>
      <option value="spray">Spray</option>
      <option value="calligraphy">Calligraphy</option>
      <option value="glow">Glow</option>
    </select>
  </div>

  <div class="pp-sec">
    <div class="pp-lbl">OPACITY: <span id="pp-op-v">100</span>%</div>
    <input type="range" id="pp-opacity" min="0" max="100" value="100">
  </div>

  <div class="pp-sec pp-row" style="justify-content:center">
    <button id="pp-undo" class="pp-btn" style="flex:0 0 auto; width:70px">UNDO</button>
    <button id="pp-redo" class="pp-btn" style="flex:0 0 auto; width:70px">REDO</button>
    <button id="pp-clear" class="pp-btn" style="flex:0 0 auto; width:70px;color:#f66">CLEAR</button>
  </div>

  <div id="pp-status" class="pp-status">BRUSH | 8px | #0ff</div>
</div>

<div class="pp-page" id="pp-page-image">
  <div class="pp-sec">
    <div class="pp-lbl">LOAD IMAGE</div>
    <input type="file" id="pp-file" accept="image/*">
  </div>
  <div class="pp-sec pp-row">
    <button id="pp-drag-toggle" class="pp-btn off">DRAG IMAGE: OFF</button>
  </div>
  <div class="pp-sec pp-row">
    <button id="pp-save-png" class="pp-btn">EXPORT PNG</button>
    <button id="pp-save-jpg" class="pp-btn">EXPORT JPG</button>
  </div>
  <div class="pp-sec">
    <div class="pp-lbl">JPG QUALITY: <span id="pp-jq-v">92</span>%</div>
    <input type="range" id="pp-jq" min="10" max="100" value="92">
  </div>
  <hr>
  <div class="pp-lbl" style="font-weight:bold;margin-bottom:6px">PROJECT</div>
  <div class="pp-sec pp-row">
    <button id="pp-save-proj" class="pp-btn">SAVE TO LOCAL</button>
    <button id="pp-load-proj" class="pp-btn">LOAD FROM LOCAL</button>
  </div>
  <div class="pp-sec pp-row">
    <button id="pp-exp-json" class="pp-btn">EXPORT JSON</button>
    <label class="pp-btn" for="pp-imp-json">IMPORT JSON</label>
    <input type="file" id="pp-imp-json" accept=".json" style="display:none">
  </div>
</div>

<div class="pp-page" id="pp-page-info">
  <div class="pp-info-card">
    <div class="pp-lbl">KEYBOARD SHORTCUTS</div>
    <div class="pp-dim">
      Alt+Z – Toggle panel<br>
      B / E / L / R / S / C / T / P / H / I – Tools<br>
      G – Toggle gradient<br>
      Ctrl+Z / Ctrl+Y – Undo / Redo
    </div>
  </div>
  <div class="pp-info-card">
    <div class="pp-lbl">CREDITS</div>
    <div class="pp-dim">
      Developed by Itz_Krishna AKA Everlasting<br>
      Version 1.0
    </div>
  </div>
  <div class="pp-info-card">
    <a href="https://discord.gg/byXxUkZxag" target="_blank" class="pp-discord">JOIN OUR DISCORD</a>
  </div>
  <div class="pp-info-card" id="updates-placeholder">
    <div class="pp-lbl">UPDATES</div>
    <div class="pp-dim">Waiting for future updates...</div>
  </div>
</div>

<div id="pp-toast" class="pp-toast"></div>
`;

  document.body.appendChild(panel);

  // Styles
  const style = document.createElement('style');
  style.textContent = `
  #pp {
    position:fixed; top:70px; right:16px; width:280px;
    background:${CFG.panelBg}; color:${CFG.text};
    border-radius:16px; border:1px solid ${CFG.accent};
    box-shadow:0 8px 28px rgba(0,255,255,0.2), ${CFG.accentGlow};
    font-family:'Segoe UI',system-ui,sans-serif;
    font-size:13px; z-index:2147483647;
    display:none; overflow:hidden;
    resize:both; min-width:240px; min-height:380px;
  }
  #pp * { box-sizing:border-box; }
  #pp-hdr {
    display:flex; justify-content:space-between; align-items:center;
    background:${CFG.panelDark}; padding:10px 14px;
    border-bottom:1px solid ${CFG.accent}; cursor:move; user-select:none;
  }
  #pp-title { font-weight:700; font-size:14px; color:${CFG.accent}; text-shadow:0 0 3px ${CFG.accent}; }
  #pp-x { background:none; border:none; color:#0ff; cursor:pointer; font-size:16px; padding:0 4px; }
  #pp-x:hover { color:#fff; text-shadow:0 0 5px #0ff; }
  #pp-tabs { display:flex; background:#05050f; border-bottom:1px solid #0ff; }
  .pp-tab {
    flex:1; padding:8px 2px; border:none; background:none; color:${CFG.dim};
    font-size:11px; font-weight:600; cursor:pointer; text-transform:uppercase;
  }
  .pp-tab.active { color:${CFG.accent}; border-bottom:2px solid ${CFG.accent}; text-shadow:0 0 3px ${CFG.accent}; }
  .pp-page { display:none; padding:12px; max-height:62vh; overflow-y:auto; }
  .pp-page.active { display:block; }
  .pp-sec { margin-bottom:12px; }
  .pp-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .pp-lbl { font-size:10px; color:${CFG.accent}; margin-bottom:4px; letter-spacing:0.5px; text-shadow:0 0 2px ${CFG.accent}; }
  .pp-tools { display:flex; flex-wrap:wrap; gap:6px; }
  .pp-tool {
    width:38px; height:38px; font-size:16px;
    background:#111; border:1px solid #0ff;
    border-radius:10px; cursor:pointer; transition:0.1s; color:#0ff;
  }
  .pp-tool.active { background:rgba(0,255,255,0.2); border-color:#0ff; box-shadow:0 0 5px #0ff; }
  .pp-toggle {
    width:100%; padding:8px; border-radius:10px; border:none;
    font-weight:700; font-size:12px; cursor:pointer; margin-bottom:12px;
  }
  .pp-toggle.on  { background:${CFG.accent}; color:#000; box-shadow:0 0 8px ${CFG.accent}; }
  .pp-toggle.off { background:#1e1e30; color:#f66; border:1px solid #f66; }
  .pp-btn {
    flex:1; padding:6px 8px; background:#111; border:1px solid #0ff;
    border-radius:8px; color:${CFG.text}; cursor:pointer; font-size:11px;
    text-align:center; user-select:none; transition:0.1s;
  }
  .pp-btn:hover { background:#0ff; color:#000; border-color:#fff; box-shadow:0 0 6px #0ff; }
  .pp-btn.off { color:#f99; border-color:#f66; }
  input[type="range"] { width:100%; accent-color:${CFG.accent}; }
  input[type="color"] { width:36px; height:30px; border:1px solid ${CFG.accent}; background:#111; cursor:pointer; border-radius:6px; }
  select { width:100%; background:#111; color:${CFG.text}; border:1px solid ${CFG.accent}; border-radius:8px; padding:5px; }
  .pp-status {
    background:#0d0d1a; padding:6px 8px; border-radius:8px;
    font-size:10px; color:#0ff; margin-top:10px; text-align:center; border:1px solid #0ff33;
  }
  .pp-info-card {
    background:#0a0a1a; border-radius:12px; padding:10px; margin-bottom:12px;
    border-left:3px solid ${CFG.accent};
  }
  .pp-dim { font-size:10px; color:${CFG.dim}; line-height:1.5; }
  .pp-discord {
    display:block; text-align:center; text-decoration:none; color:#0ff;
    font-size:12px; padding:8px; border-radius:10px; background:#0a0a1a;
    border:1px solid #0ff; transition:0.1s;
  }
  .pp-discord:hover { background:#5865f2; color:#fff; border-color:#fff; box-shadow:0 0 8px #5865f2; }
  hr { border-color:#0ff33; margin:12px 0; }
  .pp-toast {
    position:absolute; bottom:10px; left:10px; right:10px;
    background:${CFG.accent}; color:#000; font-size:10px;
    padding:5px; border-radius:8px; text-align:center;
    opacity:0; transition:opacity 0.2s; pointer-events:none;
    z-index:10; font-weight:500; box-shadow:0 0 5px ${CFG.accent};
  }
  #pp-file { background:#111; border:1px solid #0ff; color:${CFG.text}; padding:5px; border-radius:8px; width:100%; }
  `;
  document.head.appendChild(style);

  // Panel Dragging
  let draggingPanel = false;
  let dragStartX = 0, dragStartY = 0;
  const headerEl = document.getElementById('pp-hdr');
  headerEl.addEventListener('mousedown', e => {
    if (e.target.id === 'pp-x') return;
    draggingPanel = true;
    const rect = panel.getBoundingClientRect();
    dragStartX = e.clientX - rect.left;
    dragStartY = e.clientY - rect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!draggingPanel) return;
    let left = e.clientX - dragStartX;
    let top = e.clientY - dragStartY;
    left = Math.max(0, Math.min(left, window.innerWidth - panel.offsetWidth));
    top = Math.max(0, Math.min(top, window.innerHeight - panel.offsetHeight));
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => draggingPanel = false);

  // Tab Switching
  document.querySelectorAll('.pp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pp-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.pp-page').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`pp-page-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // UI Binding
  document.getElementById('pp-x').onclick = () => panel.style.display = 'none';
  document.getElementById('pp-toggle').onclick = () => setPaint(!paintEnabled);

  document.querySelectorAll('.pp-tool').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  document.getElementById('pp-color').addEventListener('input', e => { brushColor = e.target.value; updateStatus(); });
  document.getElementById('pp-color2a').addEventListener('input', e => { gradColor1 = e.target.value; });
  document.getElementById('pp-color2b').addEventListener('input', e => { gradColor2 = e.target.value; });

  document.getElementById('pp-grad').addEventListener('change', e => {
    useGrad = e.target.checked;
    updateStatus();
  });

  document.getElementById('pp-size').addEventListener('input', e => {
    brushSize = +e.target.value;
    document.getElementById('pp-size-v').textContent = brushSize;
    updateStatus();
  });

  document.getElementById('pp-tex').addEventListener('change', e => { brushTex = e.target.value; });
  document.getElementById('pp-opacity').addEventListener('input', e => {
    layerAlpha = e.target.value / 100;
    document.getElementById('pp-op-v').textContent = e.target.value;
    updateStatus();
  });

  document.getElementById('pp-undo').onclick = undo;
  document.getElementById('pp-redo').onclick = redo;
  document.getElementById('pp-clear').onclick = () => {
    snap();
    cDraw.clearRect(0, 0, lDraw.width, lDraw.height);
    showMessage('Canvas cleared');
  };

  document.getElementById('pp-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      loadedImg = img;
      const scale = Math.min((W() * 0.7) / img.naturalWidth, (H() * 0.7) / img.naturalHeight, 1);
      imgW = img.naturalWidth * scale;
      imgH = img.naturalHeight * scale;
      imgX = (W() - imgW) / 2;
      imgY = (H() - imgH) / 2;
      redrawImage();
      showMessage('Image loaded');
    };
    img.src = url;
  });

  const dragToggle = document.getElementById('pp-drag-toggle');
  dragToggle.onclick = () => {
    imgDragOn = !imgDragOn;
    dragToggle.textContent = `DRAG IMAGE: ${imgDragOn ? 'ON' : 'OFF'}`;
    dragToggle.classList.toggle('off', !imgDragOn);
    lPrev.style.pointerEvents = (imgDragOn || paintEnabled) ? 'all' : 'none';
  };

  document.getElementById('pp-save-png').onclick = () => {
    const a = document.createElement('a');
    a.href = exportCanvas('png');
    a.download = 'minefun.png'; a.click();
    showMessage('Saved as PNG');
  };
  const jqSlider = document.getElementById('pp-jq');
  const jqVal = document.getElementById('pp-jq-v');
  jqSlider.addEventListener('input', () => { jqVal.textContent = jqSlider.value; });
  document.getElementById('pp-save-jpg').onclick = () => {
    const q = +jqSlider.value / 100;
    const a = document.createElement('a');
    a.href = exportCanvas('jpg', q);
    a.download = 'minefun.jpg'; a.click();
    showMessage('Saved as JPG');
  };

  document.getElementById('pp-save-proj').onclick = () => {
    try {
      localStorage.setItem('mf_proj', JSON.stringify(buildProject()));
      showMessage('Project saved to localStorage');
    } catch (err) { showMessage('Save failed', true); }
  };
  document.getElementById('pp-load-proj').onclick = () => {
    const raw = localStorage.getItem('mf_proj');
    if (!raw) { showMessage('No saved project', true); return; }
    try { restoreProject(JSON.parse(raw)); }
    catch (err) { showMessage('Load failed', true); }
  };
  document.getElementById('pp-exp-json').onclick = () => {
    const blob = new Blob([JSON.stringify(buildProject())], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'minefun-project.json'; a.click();
    showMessage('Exported as JSON');
  };
  document.getElementById('pp-imp-json').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try { restoreProject(JSON.parse(ev.target.result)); }
      catch (err) { showMessage('Import failed', true); }
    };
    r.readAsText(f);
    e.target.value = '';
  });

  // Initialise
  snap();
  panel.style.display = 'none';
  updateStatus();
  console.log('Paint Pro v1.0 is working');
})();
