// ═══════════════════════════════════════════════════
//  app.js — Lógica principal de la aplicación
// ═══════════════════════════════════════════════════

// ══════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════
let photos = [];          // {dataUrl, rotation}
let currentStep = 0;

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════


// ══════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════
function goToStep(step) {
  if (step === 1 && !validateStep0()) return;
  if (step === 2) renderOrderGrid();
  if (step === 3) renderPDFPreview();

  document.querySelectorAll('.section').forEach((s, i) => {
    s.classList.toggle('active', i === step);
  });
  document.querySelectorAll('.step-tab').forEach((t, i) => {
    t.classList.remove('active', 'done');
    if (i === step) t.classList.add('active');
    if (i < step)  t.classList.add('done');
  });
  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════════════════════════
//  VALIDATION
// ══════════════════════════════════════════════════
function validateStep0() {
  const molde = document.getElementById('molde').value.trim();
  const maquina = document.getElementById('maquina').value.trim();
  if (!molde) { showToast('Ingresá el nombre del molde', true); return false; }
  if (!maquina) { showToast('Ingresá la máquina', true); return false; }
  return true;
}

// ══════════════════════════════════════════════════
//  SPINNERS
// ══════════════════════════════════════════════════
function changeVal(id, delta) {
  const el = document.getElementById(id);
  let val = parseFloat(el.value) + delta;
  if (val < 0) val = 0;
  el.value = Math.round(val * 10) / 10;
}

// ══════════════════════════════════════════════════
//  AGUA
// ══════════════════════════════════════════════════
function toggleAgua(el) {
  // No propagar si el click viene de un pct-btn
  el.classList.toggle('selected');
  if (!el.classList.contains('selected')) {
    // Al deseleccionar limpiar porcentaje activo
    el.querySelectorAll('.pct-btn').forEach(b => b.classList.remove('active'));
    delete el.dataset.pct;
  }
}

function setPct(e, btn, pct) {
  e.stopPropagation(); // no disparar toggleAgua
  const item = btn.closest('.agua-item');
  item.classList.add('selected');
  item.querySelectorAll('.pct-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // 0 = Sin agua (se guarda como texto especial)
  item.dataset.pct = pct === 0 ? 'sin-agua' : pct;
}

function getAguaValues() {
  const selected = [...document.querySelectorAll('.agua-item.selected')].map(el => {
    const pct = el.dataset.pct;
    if (!pct) return el.dataset.val;
    if (pct === 'sin-agua') return `${el.dataset.val} (Sin agua)`;
    return `${el.dataset.val} ${pct}%`;
  });
  const custom = document.getElementById('aguaCustom').value.trim();
  if (custom) selected.push(custom);
  return selected.length ? selected.join(' | ') : 'No especificadas';
}

// ══════════════════════════════════════════════════
//  CAMERA / FILE
//  - inputCamara: capture="environment" → abre cámara directamente
//  - inputGaleria: sin capture → abre galería/picker
//  - Corrección EXIF automática en ambos casos
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Fecha de hoy por defecto
  document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
  // Vincular inputs de cámara y galería (fotos de máquina)
  const cam = document.getElementById('inputCamara');
  const gal = document.getElementById('inputGaleria');
  if (cam) cam.addEventListener('change', handleFileInput);
  if (gal) gal.addEventListener('change', handleFileInput);
  // Vincular inputs de imagen de pieza
  const pc = document.getElementById('piezaImgCam');
  const pg = document.getElementById('piezaImgGal');
  if (pc) pc.addEventListener('change', handlePiezaImg);
  if (pg) pg.addEventListener('change', handlePiezaImg);
});

// Imagen de la pieza
let piezaImgData     = null;  // dataUrl original (EXIF corregido)
let piezaImgRotation = 0;     // rotación manual acumulada

function handlePiezaImg(e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const corrected  = await correctExifOrientation(ev.target.result);
    piezaImgData     = corrected;
    piezaImgRotation = 0;
    renderPiezaImg();
  };
  reader.readAsDataURL(files[0]);
}

function renderPiezaImg() {
  const wrap = document.getElementById('piezaImgWrap');
  const img  = document.getElementById('piezaImg');
  const ph   = document.getElementById('piezaPlaceholder');
  img.src              = piezaImgData;
  img.style.display    = 'block';
  img.style.transform  = `rotate(${piezaImgRotation}deg)`;
  // Para 90/270 ajustar escala para que no se corte
  const deg = ((piezaImgRotation % 360) + 360) % 360;
  img.style.maxHeight  = (deg === 90 || deg === 270) ? '160px' : '220px';
  ph.style.display     = 'none';
  wrap.classList.add('has-img');
}

function rotatePiezaImg() {
  if (!piezaImgData) return;
  piezaImgRotation = (piezaImgRotation + 90) % 360;
  renderPiezaImg();
}

function deletePiezaImg() {
  piezaImgData     = null;
  piezaImgRotation = 0;
  const wrap = document.getElementById('piezaImgWrap');
  const img  = document.getElementById('piezaImg');
  const ph   = document.getElementById('piezaPlaceholder');
  img.src = ''; img.style.display = 'none'; img.style.transform = '';
  ph.style.display = 'block';
  wrap.classList.remove('has-img');
}

// Devuelve el dataUrl de la pieza con la rotación manual aplicada al canvas
async function getPiezaImgFinal() {
  if (!piezaImgData) return null;
  if (piezaImgRotation === 0) return piezaImgData;
  return rotateImageData(piezaImgData, piezaImgRotation);
}

function handleFileInput(e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = async ev => {
    const corrected = await correctExifOrientation(ev.target.result);
    // Agregar directamente sin confirmación — la cámara ya confirma
    photos.push({ dataUrl: corrected, rotation: 0 });
    updatePhotoGrid();
    showToast('Foto agregada ✓');
  };
  reader.readAsDataURL(file);
}

// ──────────────────────────────────────────────────
//  CORRECCIÓN EXIF
//  Android guarda las fotos en orientación del sensor
//  con la rotación codificada en el tag EXIF 0x0112.
//  Lo leemos manualmente de los bytes JPEG y
//  redibujamos la imagen corregida en canvas.
// ──────────────────────────────────────────────────
async function correctExifOrientation(dataUrl) {
  return new Promise(resolve => {
    const orientation = readExifOrientation(dataUrl);
    if (!orientation || orientation === 1) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Para 90° y 270° se intercambian ancho y alto
      if (orientation >= 5 && orientation <= 8) {
        canvas.width = h; canvas.height = w;
      } else {
        canvas.width = w; canvas.height = h;
      }
      ctx.save();
      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0,  1, w, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
        case 4: ctx.transform( 1, 0, 0, -1, 0, h); break;
        case 5: ctx.transform( 0, 1, 1,  0, 0, 0); break;
        case 6: ctx.transform( 0, 1,-1,  0, h, 0); break;
        case 7: ctx.transform( 0,-1,-1,  0, h, w); break;
        case 8: ctx.transform( 0,-1, 1,  0, 0, w); break;
      }
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function readExifOrientation(dataUrl) {
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const bin = atob(base64);
    const len = Math.min(bin.length, 65536); // solo leemos los primeros 64KB
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null; // no es JPEG
    let offset = 2;
    while (offset + 4 < len) {
      if (bytes[offset] !== 0xFF) break;
      const marker = bytes[offset + 1];
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (marker === 0xE1 && offset + 10 < len) { // APP1
        const exifHeader = String.fromCharCode(
          bytes[offset+4], bytes[offset+5], bytes[offset+6],
          bytes[offset+7], bytes[offset+8], bytes[offset+9]
        );
        if (exifHeader === 'Exif\0\0') {
          const tiff = offset + 10;
          const le = bytes[tiff] === 0x49; // II=little endian, MM=big endian
          const r16 = o => le
            ? bytes[tiff+o] | (bytes[tiff+o+1] << 8)
            : (bytes[tiff+o] << 8) | bytes[tiff+o+1];
          const r32 = o => le
            ? bytes[tiff+o] | (bytes[tiff+o+1]<<8) | (bytes[tiff+o+2]<<16) | (bytes[tiff+o+3]<<24)
            : (bytes[tiff+o]<<24) | (bytes[tiff+o+1]<<16) | (bytes[tiff+o+2]<<8) | bytes[tiff+o+3];
          const ifdOff = r32(4);
          const nEntries = r16(ifdOff);
          for (let i = 0; i < nEntries; i++) {
            const e = ifdOff + 2 + i * 12;
            if (r16(e) === 0x0112) return r16(e + 8); // Orientation tag
          }
        }
      }
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  } catch(e) {}
  return null;
}

function showModal(src) {
  document.getElementById('modalImg').src = src;
  document.getElementById('photoModal').classList.add('open');
}

function acceptPhoto() {
  if (pendingPhoto) {
    photos.push({ ...pendingPhoto });
    updatePhotoGrid();
    pendingPhoto = null;
  }
  closeModal();
}

function rejectPhoto() {
  pendingPhoto = null;
  closeModal();
  showToast('Foto descartada');
}

function closeModal() {
  document.getElementById('photoModal').classList.remove('open');
}

// ══════════════════════════════════════════════════
//  PHOTO GRID (step 2)
// ══════════════════════════════════════════════════
function updatePhotoGrid() {
  const grid = document.getElementById('photoGrid');
  const badge = document.getElementById('photoCount');
  const btnNext = document.getElementById('btnNextOrder');

  document.getElementById('photoCountNum').textContent = photos.length;
  badge.style.display = photos.length ? 'inline-flex' : 'none';
  btnNext.disabled = photos.length === 0;

  grid.innerHTML = '';
  photos.forEach((p, i) => {
    const card = createPhotoCard(p, i, false);
    grid.appendChild(card);
  });
}

function createPhotoCard(p, i, isOrder) {
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.dataset.idx = i;

  const img = document.createElement('img');
  img.src = p.dataUrl;
  img.style.transform = `rotate(${p.rotation}deg)`;
  img.style.transition = 'transform .3s';

  const num = document.createElement('div');
  num.className = 'photo-num';
  num.textContent = `#${i + 1}`;

  const actions = document.createElement('div');
  actions.className = 'photo-actions';

  // rotate btn
  const rotBtn = document.createElement('button');
  rotBtn.className = 'photo-action-btn rot';
  rotBtn.textContent = '🔄';
  rotBtn.title = 'Rotar';
  rotBtn.onclick = e => { e.stopPropagation(); rotatePhoto(i, isOrder); };

  // delete btn
  const delBtn = document.createElement('button');
  delBtn.className = 'photo-action-btn del';
  delBtn.textContent = '🗑';
  delBtn.title = 'Eliminar';
  delBtn.onclick = e => { e.stopPropagation(); deletePhoto(i, isOrder); };

  actions.appendChild(rotBtn);
  actions.appendChild(delBtn);
  card.appendChild(img);
  card.appendChild(num);
  card.appendChild(actions);

  if (isOrder) {
    // Botones de reordenamiento (funciona en cualquier dispositivo)
    const moveWrap = document.createElement('div');
    moveWrap.style.cssText = 'position:absolute;bottom:6px;right:6px;display:flex;gap:4px;';
    const upBtn = document.createElement('button');
    upBtn.className = 'photo-action-btn move-btn';
    upBtn.style.cssText = 'background:rgba(0,0,0,.55);color:#fff;border:none;font-size:14px;';
    upBtn.textContent = '↑';
    upBtn.title = 'Mover arriba';
    upBtn.onclick = e => { e.stopPropagation(); movePhoto(i, -1); };
    const downBtn = document.createElement('button');
    downBtn.className = 'photo-action-btn move-btn';
    downBtn.style.cssText = 'background:rgba(0,0,0,.55);color:#fff;border:none;font-size:14px;';
    downBtn.textContent = '↓';
    downBtn.title = 'Mover abajo';
    downBtn.onclick = e => { e.stopPropagation(); movePhoto(i, 1); };
    moveWrap.appendChild(upBtn);
    moveWrap.appendChild(downBtn);
    card.appendChild(moveWrap);

    // Touch drag (arrastrá la foto en móvil)
    initTouchDrag(card, i);
  }

  return card;
}

function rotatePhoto(i, isOrder) {
  photos[i].rotation = (photos[i].rotation + 90) % 360;
  if (isOrder) renderOrderGrid(); else updatePhotoGrid();
}

function deletePhoto(i, isOrder) {
  photos.splice(i, 1);
  if (isOrder) renderOrderGrid(); else updatePhotoGrid();
  showToast('Foto eliminada');
}

// ══════════════════════════════════════════════════
//  ORDER GRID (step 3)
//  Reordenamiento por TOUCH (funciona en móvil y desktop)
//  El drag & drop HTML5 no funciona en pantallas táctiles,
//  se reemplaza completamente con touchstart/touchmove/touchend
//  y botones de flecha para subir/bajar.
// ══════════════════════════════════════════════════
// Almacena los nombres editados de cada hoja { pageIndex: name }
if (!window._photoPageNames) window._photoPageNames = [];

function renderOrderGrid() {
  const grid = document.getElementById('orderGrid');
  grid.innerHTML = '';
  photos.forEach((p, i) => {
    if (i % 4 === 0) {
      const pageIdx = Math.floor(i / 4);
      const defaultName = `Hoja ${pageIdx + 1}`;

      const wrap = document.createElement('div');
      wrap.className = 'page-divider';

      // Input editable con el nombre de la hoja
      const inp = document.createElement('input');
      inp.type        = 'text';
      inp.value       = window._photoPageNames[pageIdx] !== undefined
                          ? window._photoPageNames[pageIdx]
                          : defaultName;
      inp.placeholder = defaultName;
      inp.dataset.pageIdx = pageIdx;
      inp.style.cssText = [
        'flex:1', 'background:transparent', 'border:none',
        'border-bottom:1px dashed var(--accent)', 'color:var(--accent)',
        'font-family:inherit', 'font-size:11px', 'font-weight:700',
        'letter-spacing:2px', 'text-transform:uppercase',
        'outline:none', 'padding:2px 4px', 'min-width:0',
        'cursor:text'
      ].join(';');
      inp.addEventListener('input', () => {
        window._photoPageNames[pageIdx] = inp.value;
      });
      inp.addEventListener('click', e => e.stopPropagation());

      const icon = document.createElement('span');
      icon.textContent = '✏️';
      icon.style.cssText = 'font-size:12px;opacity:.6;flex-shrink:0';

      wrap.appendChild(inp);
      wrap.appendChild(icon);
      grid.appendChild(wrap);
    }
    const card = createPhotoCard(p, i, true);
    grid.appendChild(card);
  });
}

// ── Touch drag state ──
let touchDragIdx = null;
let touchDragEl  = null;
let touchOverIdx = null;

function initTouchDrag(card, idx) {
  card.addEventListener('touchstart', e => {
    // Solo iniciar si el toque es sobre la imagen (no sobre botones)
    if (e.target.closest('.photo-action-btn') || e.target.closest('.move-btn')) return;
    touchDragIdx = idx;
    touchDragEl  = card;
    card.classList.add('touch-dragging');
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    if (touchDragEl === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetCard = el ? el.closest('.photo-card[data-idx]') : null;
    // Limpiar highlight previo
    document.querySelectorAll('.photo-card').forEach(c => c.classList.remove('touch-over'));
    if (targetCard && targetCard !== touchDragEl) {
      touchOverIdx = parseInt(targetCard.dataset.idx);
      targetCard.classList.add('touch-over');
    } else {
      touchOverIdx = null;
    }
  }, { passive: false });

  card.addEventListener('touchend', () => {
    if (touchDragEl) touchDragEl.classList.remove('touch-dragging');
    document.querySelectorAll('.photo-card').forEach(c => c.classList.remove('touch-over'));
    if (touchDragIdx !== null && touchOverIdx !== null && touchDragIdx !== touchOverIdx) {
      const moved = photos.splice(touchDragIdx, 1)[0];
      photos.splice(touchOverIdx, 0, moved);
      renderOrderGrid();
    }
    touchDragIdx = null; touchDragEl = null; touchOverIdx = null;
  });
}

function movePhoto(idx, direction) {
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= photos.length) return;
  const tmp = photos[idx];
  photos[idx] = photos[newIdx];
  photos[newIdx] = tmp;
  renderOrderGrid();
}

// ══════════════════════════════════════════════════
//  PDF PREVIEW (step 4)
// ══════════════════════════════════════════════════
function renderPDFPreview() {
  const data = getFormData();
  const rows = [
    ['Fecha', data.fecha],
    ['Máquina', data.maquina],
    ['Molde', `${data.molde}${data.producto ? ' — ' + data.producto : ''}`],
    ['Responsable', data.responsable || '—'],
    ['Materia Prima', data.materiaPrima],
    ['Peso pieza', `${data.pesoPieza} g × ${data.cantPieza} unid.`],
    ['Peso colada', `${data.pesoColada} g × ${data.cantColada} unid.`],
    ['Conexiones de agua', data.agua],
    ['Imagen pieza', data.piezaImg ? '✓ Cargada' : 'Sin imagen'],
    ['Fotos', `${photos.length} foto(s) — ${Math.ceil(photos.length / 4)} hoja(s) de fotos`],
    ['Observación pieza', data.observacion || '—'],
    ['Observación molde', data.observacionMolde || '—'],
  ];

  const summary = document.getElementById('previewSummary');
  summary.innerHTML = rows.map(([k, v]) =>
    `<div class="preview-row"><span>${k}</span><strong>${v}</strong></div>`
  ).join('');
}

function getFormData() {
  return {
    fecha:             document.getElementById('fecha').value,
    maquina:           document.getElementById('maquina').value.trim(),
    molde:             document.getElementById('molde').value.trim(),
    responsable:       document.getElementById('responsable').value.trim(),
    producto:          document.getElementById('producto').value.trim(),
    materiaPrima:      document.getElementById('materiaPrima').value.trim(),
    pesoPieza:         document.getElementById('pesoPieza').value,
    cantPieza:         document.getElementById('cantPieza').value,
    pesoColada:        document.getElementById('pesoColada').value,
    cantColada:        document.getElementById('cantColada').value,
    agua:              getAguaValues(),
    observacion:       document.getElementById('observacion').value.trim(),
    observacionMolde:  document.getElementById('observacionMolde').value.trim(),
    piezaImg:          piezaImgData,  // se resuelve a final rotado en generatePDF
  };
}


function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showLoading(msg) {
  document.getElementById('loadingMsg').textContent = msg;
  document.getElementById('loadingOverlay').classList.add('open');
}
function updateLoadingMsg(msg) {
  document.getElementById('loadingMsg').textContent = msg;
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('open');
}

// ══ PWA: Registrar Service Worker ══
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker registrado'))
      .catch(e => console.warn('SW error:', e));
  });
}

// ══ PWA: Prompt de instalación ══
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').style.display = 'flex';
});
window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner').style.display = 'none';
  deferredPrompt = null;
});
function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    document.getElementById('installBanner').style.display = 'none';
  });
}
</script>
