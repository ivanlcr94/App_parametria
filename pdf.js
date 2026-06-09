// ═══════════════════════════════════════════════════
//  pdf.js — Generación del PDF (usa jsPDF)
// ═══════════════════════════════════════════════════

// ══════════════════════════════════════════════════
//  PDF GENERATION
// ══════════════════════════════════════════════════
async function generatePDF() {
  showLoading('Preparando documento…');
  const { jsPDF } = window.jspdf;
  const data = getFormData();
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const W = 210, H = 297;
  const margin = 14;

  // ── PALETA BLANCA ──
  const cWhite    = [255, 255, 255];
  const cAccent   = [234, 88,  12];   // naranja oscuro (legible en blanco)
  const cDark     = [15,  23,  42];   // casi negro
  const cMid      = [71,  85, 105];   // gris medio
  const cLight    = [241, 245, 249];  // gris muy claro (filas alternas)
  const cBorder   = [203, 213, 225];  // borde gris
  const cOrange   = [249, 115,  22];  // acento header

  // ── FONDO BLANCO ──
  function pageBackground() {
    doc.setFillColor(...cWhite);
    doc.rect(0, 0, W, H, 'F');
    // franja superior naranja
    doc.setFillColor(...cOrange);
    doc.rect(0, 0, W, 9, 'F');
  }

  function pageHeader(title, pageNum, totalPages) {
    doc.setFillColor(...cLight);
    doc.rect(0, 9, W, 16, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...cMid);
    doc.text('PARAMETRÍA', margin, 15.5);
    doc.setFontSize(8.5);
    doc.setTextColor(...cAccent);
    doc.text(title.toUpperCase(), margin, 21);
    doc.setFontSize(7);
    doc.setTextColor(...cMid);
    doc.text(`${pageNum} / ${totalPages}`, W - margin, 21, { align: 'right' });
    doc.text(`Molde: ${data.molde}`, W - margin, 15.5, { align: 'right' });
    // línea inferior header
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.3);
    doc.line(0, 25, W, 25);
  }

  function pageFooter() {
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, H - 11, W - margin, H - 11);
    doc.setFontSize(6.5);
    doc.setTextColor(...cMid);
    const moldeStr = data.molde + (data.producto ? ' — ' + data.producto : '');
    doc.text(
      `${moldeStr}  •  Fecha: ${formatDate(data.fecha)}  •  Máquina: ${data.maquina}`,
      W / 2, H - 6, { align: 'center' }
    );
  }

  function hLine(y) {
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.25);
    doc.line(margin, y, W - margin, y);
  }

  function dataRow(label, value, y, shade) {
    const rowH = 8;
    if (shade) {
      doc.setFillColor(...cLight);
      doc.rect(margin, y, W - margin * 2, rowH, 'F');
    }
    doc.setFontSize(7);
    doc.setTextColor(...cMid);
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), margin + 3, y + 5.2);
    doc.setFontSize(9);
    doc.setTextColor(...cDark);
    doc.text(String(value || '—'), margin + 58, y + 5.2);
    return y + rowH + 1;
  }

  // ── TOTAL DE PÁGINAS ──
  const photoPages = photos.length > 0 ? Math.ceil(photos.length / 4) : 0;
  const totalPages = 1 + photoPages;

  // ══════════════════════════════
  //  PÁGINA 1 — DATOS
  // ══════════════════════════════
  pageBackground();
  pageHeader('Hoja de proceso', 1, totalPages);

  // Resolver imagen de pieza con rotación manual aplicada
  const piezaImgFinal = await getPiezaImgFinal();

  // ── Cabecera: imagen de pieza a la derecha, título a la izquierda ──
  const fechaStr = formatDate(data.fecha);
  const imgSize  = 48; // mm — cuadrado para la imagen de pieza
  const titleW   = W - margin * 2 - imgSize - 8;

  // Imagen de pieza (si existe)
  if (piezaImgFinal) {
    // Calcular aspect ratio para que entre en el cuadrado sin deformar
    const pDims = await getImageDimensions(piezaImgFinal);
    const pAR   = pDims.width / pDims.height;
    let pw, ph;
    if (pAR >= 1) { pw = imgSize; ph = imgSize / pAR; }
    else           { ph = imgSize; pw = imgSize * pAR; }
    const px = W - margin - imgSize + (imgSize - pw) / 2;
    const py = 27 + (imgSize - ph) / 2;
    // Marco de la imagen
    doc.setFillColor(...cLight);
    doc.roundedRect(W - margin - imgSize, 27, imgSize, imgSize, 3, 3, 'F');
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(W - margin - imgSize, 27, imgSize, imgSize, 3, 3, 'S');
    try { doc.addImage(piezaImgFinal, 'JPEG', px, py, pw, ph, '', 'FAST'); } catch(e) {}
    doc.setFontSize(6);
    doc.setTextColor(...cMid);
    doc.text('PIEZA', W - margin - imgSize/2, 27 + imgSize + 4, { align: 'center' });
  }

  // Título molde (izquierda, con espacio para la imagen)
  doc.setFontSize(20);
  doc.setTextColor(...cDark);
  doc.setFont('helvetica', 'bold');
  const moldeLabel = data.molde || 'Sin nombre';
  // truncar si es muy largo
  const moldeLines = doc.splitTextToSize(moldeLabel, titleW);
  doc.text(moldeLines[0], margin, 37);

  // Nombre del producto debajo
  if (data.producto) {
    doc.setFontSize(10);
    doc.setTextColor(...cAccent);
    doc.setFont('helvetica', 'bold');
    doc.text(data.producto, margin, 44);
    doc.setFont('helvetica', 'normal');
  }

  const hLineY = piezaImgFinal ? Math.max(27 + imgSize + 8, data.producto ? 47 : 42) : (data.producto ? 47 : 42);
  hLine(hLineY);

  // Tabla de datos con filas alternadas (Molde y Producto ya figuran en el título)
  let y = hLineY + 4;
  y = dataRow('Máquina',            data.maquina,                          y, false);
  y = dataRow('Materia prima',      data.materiaPrima,                     y, true);
  y = dataRow('Peso de pieza',      `${data.pesoPieza} g × ${data.cantPieza} unid.`, y, true);
  y = dataRow('Peso de colada',     `${data.pesoColada} g × ${data.cantColada} unid.`, y, false);
  y = dataRow('Conexiones de agua', data.agua,                             y, true);

  // bloque peso total
  const totalPieza  = (parseFloat(data.pesoPieza)  * parseInt(data.cantPieza)).toFixed(1);
  const totalColada = (parseFloat(data.pesoColada) * parseInt(data.cantColada)).toFixed(1);
  const totalShot   = (parseFloat(totalPieza) + parseFloat(totalColada)).toFixed(1);

  y += 3;
  doc.setFillColor(255, 237, 213); // naranja muy claro
  doc.roundedRect(margin, y, W - margin * 2, 14, 2, 2, 'F');
  doc.setDrawColor(...cOrange);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, W - margin * 2, 14, 2, 2, 'S');
  doc.setLineWidth(0.25);

  doc.setFontSize(7);
  doc.setTextColor(...cMid);
  doc.text('PESO TOTAL DE DISPARO', margin + 4, y + 4.5);
  doc.setFontSize(13);
  doc.setTextColor(...cAccent);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalShot} g`, margin + 4, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...cMid);
  doc.text(`Piezas: ${totalPieza} g  |  Colada: ${totalColada} g`, W - margin - 4, y + 9, { align: 'right' });
  y += 18;

  // Observación pieza
  if (data.observacion) {
    hLine(y);
    y += 5;
    doc.setFontSize(7);
    doc.setTextColor(...cMid);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIÓN DE PIEZA', margin, y + 2);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...cDark);
    const linesObs = doc.splitTextToSize(data.observacion, W - margin * 2 - 4);
    linesObs.forEach(line => { doc.text(line, margin + 2, y); y += 5.5; });
  }

  // Observación molde
  if (data.observacionMolde) {
    hLine(y);
    y += 5;
    doc.setFontSize(7);
    doc.setTextColor(...cMid);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES DE MOLDE', margin, y + 2);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...cDark);
    const linesMolde = doc.splitTextToSize(data.observacionMolde, W - margin * 2 - 4);
    linesMolde.forEach(line => { doc.text(line, margin + 2, y); y += 5.5; });
  }

  // Bloques de firma
  const signY = H - 52;
  hLine(signY);
  doc.setFontSize(7);
  doc.setTextColor(...cMid);
  doc.setFont('helvetica', 'bold');

  const boxW = 55, boxH = 18;
  const signLabels = ['FIRMA RESPONSABLE', 'APROBADO POR', 'FECHA'];
  const xs = [margin, W / 2 - boxW / 2, W - margin - boxW];
  signLabels.forEach((lbl, i) => {
    doc.text(lbl, xs[i], signY + 7);
    doc.setDrawColor(...cBorder);
    doc.setFillColor(...cLight);
    doc.rect(xs[i], signY + 9, boxW, boxH, 'FD');
  });
  // Responsable pre-completado en el primer bloque
  if (data.responsable) {
    doc.setFontSize(8.5);
    doc.setTextColor(...cDark);
    doc.setFont('helvetica', 'normal');
    doc.text(data.responsable, xs[0] + 2, signY + 20);
  }
  // Fecha pre-completada en el bloque FECHA
  doc.setFontSize(8.5);
  doc.setTextColor(...cDark);
  doc.setFont('helvetica', 'normal');
  doc.text(fechaStr, xs[2] + 2, signY + 20);

  pageFooter();

  // ══════════════════════════════
  //  PÁGINAS DE FOTOS
  //  4 fotos por hoja, respetando
  //  el aspect ratio de cada imagen
  // ══════════════════════════════
  // Nombres editables de cada hoja de fotos
  const pageNames = window._photoPageNames || [];

  for (let pi = 0; pi < photoPages; pi++) {
    updateLoadingMsg(`Procesando fotos (${pi + 1}/${photoPages})…`);
    doc.addPage();
    pageBackground();
    pageHeader(pageNames[pi] || `Hoja ${pi + 1}`, pi + 2, totalPages);
    pageFooter();

    const startIdx = pi * 4;
    const pagePhotos = photos.slice(startIdx, startIdx + 4);

    // Grilla fija 2×2 — 4 posiciones siempre iguales
    // Las fotos se ubican cada una en su celda respetando aspect ratio
    const gap   = 5;   // mm entre celdas
    const areaTop = 28, areaBot = H - 14;
    const areaW = W - margin * 2;
    const areaH = areaBot - areaTop;
    const cellW = (areaW - gap) / 2;
    const cellH = (areaH - gap) / 2;

    // Posiciones fijas de las 4 celdas (col, row)
    const cells = [
      { x: margin,              y: areaTop },
      { x: margin + cellW + gap, y: areaTop },
      { x: margin,              y: areaTop + cellH + gap },
      { x: margin + cellW + gap, y: areaTop + cellH + gap },
    ];

    for (let j = 0; j < pagePhotos.length; j++) {
      const cell = cells[j];
      const photo = pagePhotos[j];

      // La corrección EXIF ya se hizo al importar la foto,
      // solo aplicar rotación manual del usuario si la hay
      let imgData = photo.dataUrl;
      if (photo.rotation !== 0) {
        imgData = await rotateImageData(photo.dataUrl, photo.rotation);
      }

      // Dimensiones reales post-rotación para aspect ratio correcto
      const dims = await getImageDimensions(imgData);
      const imgAR   = dims.width / dims.height;
      const cellAR  = cellW / cellH;

      let drawW, drawH;
      if (imgAR > cellAR) {
        // más ancha que la celda → ajustar por ancho
        drawW = cellW;
        drawH = cellW / imgAR;
      } else {
        // más alta que la celda → ajustar por alto
        drawH = cellH;
        drawW = cellH * imgAR;
      }

      // Centrar en la celda
      const drawX = cell.x + (cellW - drawW) / 2;
      const drawY = cell.y + (cellH - drawH) / 2;

      // Fondo de celda
      doc.setFillColor(...cLight);
      doc.rect(cell.x, cell.y, cellW, cellH, 'F');

      try {
        doc.addImage(imgData, 'JPEG', drawX, drawY, drawW, drawH, '', 'FAST');
      } catch (e) {
        doc.setFontSize(8);
        doc.setTextColor(...cMid);
        doc.text('Error al cargar imagen', cell.x + cellW/2, cell.y + cellH/2, { align: 'center' });
      }

      // Borde sutil
      doc.setDrawColor(...cBorder);
      doc.setLineWidth(0.3);
      doc.rect(cell.x, cell.y, cellW, cellH, 'S');
    }
  }

  // ── GUARDAR ──
  const filename = sanitizeFilename(data.molde || 'parametria') + '.pdf';
  doc.save(filename);
  hideLoading();
  showToast(`PDF "${filename}" descargado ✓`);
}

// ══════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════
function rotateImageData(dataUrl, degrees) {
  // Normalizar a 0/90/180/270
  const deg = ((degrees % 360) + 360) % 360;
  if (deg === 0) return Promise.resolve(dataUrl);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // 90 y 270 intercambian dimensiones
      if (deg === 90 || deg === 270) {
        canvas.width = h; canvas.height = w;
      } else {
        canvas.width = w; canvas.height = h;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(deg * Math.PI / 180);
      ctx.drawImage(img, -w / 2, -h / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function getImageDimensions(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 4, height: 3 }); // fallback 4:3
    img.src = dataUrl;
  });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\-\.áéíóúüñÁÉÍÓÚÜÑ ]/g, '_').replace(/\s+/g, '_');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
