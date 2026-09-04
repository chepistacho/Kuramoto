/* ================================================================
   MODELO DE KURAMOTO — 8 osciladores
   ----------------------------------------------------------------
   Cada oscilador i tiene una fase θᵢ que avanza según:

       dθᵢ/dt = ωᵢ + (K/N) · Σⱼ sin(θⱼ − θᵢ)

   ωᵢ  → frecuencia natural del oscilador i (viene de su BPM)
   K   → fuerza de acoplamiento (0 = independientes, alto = se
         arrastran entre sí hasta sincronizarse)
   N   → número de osciladores (8 en este proyecto)

   Cada vez que θᵢ completa una vuelta completa (2π) se considera
   que el oscilador i tocó un "beat": ese es el gancho donde se
   conecta el audio (ver preload() más abajo) y, más adelante,
   cualquier comportamiento visual adicional.

   Por ahora los 8 cuerpos están QUIETOS en el espacio: ocupan una
   posición fija en el anillo y sólo gira su fase interna (el punto
   que orbita dentro de cada módulo). El movimiento en pantalla es
   apenas ese giro y el destello de cada beat.

   Cada oscilador tiene además un MODO de reproducción, elegible
   desde su propia tarjeta de control:
     - "un golpe"  → dispara el sonido desde el inicio en cada beat
                     (ideal para percusión: drums, snare, hi-hat...)
     - "sostenido" → si el sonido ya está sonando cuando cae un
                     nuevo beat, lo deja continuar tal cual (no lo
                     corta ni lo reinicia); sólo dispara una nueva
                     nota cuando la anterior ya terminó por su cuenta
                     (ideal para lo melódico: cuerdas, synth, pad...)
   ================================================================ */

const NUM_OSC = 8;

// Nombre de cada oscilador — se usa en su etiqueta y en la grilla de controles
const oscNames = ['DRUMS', 'CUERDAS', 'SYNTH', 'BASS', 'SNARE', 'HI-HAT', 'PAD', 'EFECTOS'];

// Modo de reproducción por defecto de cada oscilador: 'oneshot' o 'sustain'
// (se puede cambiar en vivo desde el botón de cada tarjeta)
const defaultModes = ['oneshot', 'sustain', 'sustain', 'oneshot', 'oneshot', 'oneshot', 'sustain', 'oneshot'];

// Tempos iniciales (BPM), ligeramente distintos entre sí para que
// el desfase / la sincronización se note con claridad.
const defaultBPM = [118, 124, 116, 121, 126, 113, 120, 128];

let oscillators = [];
let K = 1.4;
let playing = true;

let cnv;
let centerX, centerY, ringRadius, bodyRadius, markerRadius;
let rReadout;

// Paleta (definida como arreglos [r,g,b] para usar con fill()/stroke() vía spread)
const COL_BG_DEEP     = [10, 12, 16];
const COL_PANEL       = [20, 23, 29];
const COL_LINE_DIM    = [38, 43, 52];
const COL_TEXT_DIM    = [125, 131, 141];
const COL_TEXT_PRIM   = [237, 234, 226];
const COL_AMBER       = [255, 154, 68];
const COL_CYAN        = [89, 227, 201];


/* ================================================================
   ESPACIO PARA TUS SONIDOS
   ----------------------------------------------------------------
   Cada oscilador (0 a 7) puede disparar su propio sonido cada vez
   que completa una oscilación (un "beat"). Para conectarlos:

     1. Crea una carpeta "sounds" junto a este archivo .html
     2. Copia ahí tus archivos de audio (.mp3, .wav, .ogg)
     3. Descomenta y ajusta las líneas de abajo, una por oscilador

   Ejemplo:
     sounds[0] = loadSound('sounds/drums.mp3');
     sounds[1] = loadSound('sounds/cuerdas.mp3');

   Si no cargas nada, el proyecto sigue funcionando igual: cada beat
   se sigue viendo (el destello del módulo), simplemente no suena.
   ================================================================ */

let sounds = new Array(NUM_OSC).fill(null);

function preload(){
  // sounds[0] = loadSound('sounds/drums.mp3');
  // sounds[1] = loadSound('sounds/cuerdas.mp3');
  // sounds[2] = loadSound('sounds/synth.mp3');
  // sounds[3] = loadSound('sounds/bass.mp3');
  // sounds[4] = loadSound('sounds/snare.mp3');
  // sounds[5] = loadSound('sounds/hihat.mp3');
  // sounds[6] = loadSound('sounds/pad.mp3');
  // sounds[7] = loadSound('sounds/efectos.mp3');
}

// Decide cómo suena cada beat según el modo del oscilador:
//   'oneshot'  → siempre reinicia el sonido desde cero (percusión)
//   'sustain'  → sólo dispara si el sonido anterior ya terminó;
//                si sigue sonando, lo deja tal cual (nada de cortes
//                ni reinicios abruptos)
function triggerSound(i){
  const s = sounds[i];
  if (!s) return;

  if (oscillators[i].mode === 'sustain'){
    if (!s.isPlaying()){
      s.play();
    }
    // si ya está sonando: no se toca, se deja terminar su propio ciclo
  } else {
    if (s.isPlaying()) s.stop();
    s.play();
  }
}


/* ================================================================
   COMPORTAMIENTO VISUAL (próximo paso)
   ----------------------------------------------------------------
   Ahora mismo esta función no hace nada: los 8 cuerpos están fijos
   en el anillo y sólo cambia su fase. Este es el lugar para, en la
   siguiente iteración, mover su posición, tamaño o color en función
   de θᵢ, de la sincronía global (r) o de K.
   Se llama una vez por cuadro para cada oscilador, después de
   actualizar su física y antes de dibujarlo.
   ================================================================ */
function updateVisualBehavior(osc, dt){
  // TODO: siguiente iteración.
  // Ideas para más adelante:
  //   - osc.pos podría desplazarse según r (el parámetro de orden)
  //   - el tamaño del cuerpo podría respirar con su propia fase
  //   - el color podría virar según qué tan alineado está con el
  //     promedio del grupo
}


class Oscillator {
  constructor(index, bpm, name, mode){
    this.index = index;
    this.name = name;
    this.mode = mode;        // 'oneshot' o 'sustain'
    this.bpm = bpm;
    this.omega = this.bpmToOmega(bpm);
    this.theta = random(0, TWO_PI);
    this.flash = 0;          // 0..1, intensidad del destello del último beat
    this.pos = createVector(0, 0);
  }

  bpmToOmega(bpm){
    return (bpm / 60) * TWO_PI; // radianes por segundo
  }

  setBPM(bpm){
    this.bpm = bpm;
    this.omega = this.bpmToOmega(bpm);
  }

  setMode(mode){
    this.mode = mode;
  }

  update(dt, all){
    // término de acoplamiento: cuánto "tiran" de mí los otros 7
    let coupling = 0;
    for (let k = 0; k < all.length; k++){
      if (k === this.index) continue;
      coupling += sin(all[k].theta - this.theta);
    }
    coupling *= K / all.length;

    const dtheta = this.omega + coupling;
    let next = this.theta + dtheta * dt;

    // cada vuelta completa (2π) hacia adelante = un beat
    while (next >= TWO_PI){
      next -= TWO_PI;
      this.onBeat();
    }
    while (next < 0){
      next += TWO_PI;
    }
    this.theta = next;

    // el destello decae solo (~350ms)
    this.flash = max(0, this.flash - dt / 0.35);

    updateVisualBehavior(this, dt);
  }

  onBeat(){
    this.flash = 1;
    triggerSound(this.index);
  }

  display(){
    push();
    translate(this.pos.x, this.pos.y);

    // resplandor del beat
    if (this.flash > 0){
      noStroke();
      fill(COL_AMBER[0], COL_AMBER[1], COL_AMBER[2], this.flash * 90);
      circle(0, 0, bodyRadius * 2 + this.flash * 26);
    }

    // cuerpo
    const edge = lerpColor(color(...COL_LINE_DIM), color(...COL_AMBER), this.flash);
    stroke(edge);
    strokeWeight(1.5);
    fill(...COL_PANEL);
    circle(0, 0, bodyRadius * 2);

    // pista interna (el "camino" de la oscilación)
    noFill();
    stroke(...COL_LINE_DIM);
    strokeWeight(1);
    circle(0, 0, markerRadius * 2);

    // marcador de fase, orbitando según θᵢ
    const mx = cos(this.theta) * markerRadius;
    const my = sin(this.theta) * markerRadius;
    noStroke();
    fill(...COL_CYAN);
    circle(mx, my, 7);

    // etiqueta
    noStroke();
    textFont('IBM Plex Mono');
    textAlign(CENTER, CENTER);
    fill(...COL_TEXT_DIM);
    textSize(9.5);
    text(this.name, 0, bodyRadius + 15);
    fill(...COL_TEXT_PRIM);
    textSize(11);
    text(Math.round(this.bpm) + ' BPM', 0, bodyRadius + 29);

    pop();
  }
}


function setup(){
  const holder = document.getElementById('canvas-holder');
  const size = min(holder.offsetWidth, 560);
  cnv = createCanvas(size, size);
  cnv.parent('canvas-holder');

  rReadout = document.getElementById('rValue');

  for (let i = 0; i < NUM_OSC; i++){
    oscillators.push(new Oscillator(i, defaultBPM[i], oscNames[i], defaultModes[i]));
  }

  layout();
  buildOscGrid();
  wireControls();
  frameRate(60);
}

function windowResized(){
  layout();
}

// posiciona los 8 cuerpos en un anillo fijo — esto es lo "quieto"
function layout(){
  const holder = document.getElementById('canvas-holder');
  const size = min(holder.offsetWidth, 560);
  resizeCanvas(size, size);

  centerX = width / 2;
  centerY = height / 2;
  ringRadius = width * 0.34;
  bodyRadius = width * 0.075;
  markerRadius = bodyRadius * 0.55;

  for (let i = 0; i < oscillators.length; i++){
    const a = -HALF_PI + i * (TWO_PI / NUM_OSC);
    oscillators[i].pos = createVector(
      centerX + cos(a) * ringRadius,
      centerY + sin(a) * ringRadius
    );
  }
}

function draw(){
  background(...COL_BG_DEEP);

  const dt = min(deltaTime / 1000, 0.05); // evita saltos si la pestaña pierde foco

  if (playing){
    for (const osc of oscillators) osc.update(dt, oscillators);
  }

  drawRingGuide();
  drawCouplingWeb();
  drawOrderParameter();
  for (const osc of oscillators) osc.display();
}

// guía punteada del anillo, sólo de referencia visual
function drawRingGuide(){
  push();
  noFill();
  stroke(...COL_LINE_DIM);
  strokeWeight(1);
  drawingContext.setLineDash([2, 6]);
  circle(centerX, centerY, ringRadius * 2);
  drawingContext.setLineDash([]);
  pop();
}

// el "tejido" de acoplamiento: una línea por cada par de osciladores,
// que se ilumina cuando esas dos fases están alineadas
function drawCouplingWeb(){
  for (let i = 0; i < oscillators.length; i++){
    for (let j = i + 1; j < oscillators.length; j++){
      const align = cos(oscillators[j].theta - oscillators[i].theta); // -1..1
      const alpha = map(align, -1, 1, 4, 70);
      const w = map(align, -1, 1, 0.4, 1.6);
      stroke(COL_CYAN[0], COL_CYAN[1], COL_CYAN[2], alpha);
      strokeWeight(w);
      line(oscillators[i].pos.x, oscillators[i].pos.y, oscillators[j].pos.x, oscillators[j].pos.y);
    }
  }
}

// parámetro de orden r·e^(iψ) = (1/N)·Σ e^(iθⱼ) — mide la sincronía global
function computeOrderParameter(){
  let sumCos = 0, sumSin = 0;
  for (const osc of oscillators){
    sumCos += cos(osc.theta);
    sumSin += sin(osc.theta);
  }
  const r = sqrt(sumCos * sumCos + sumSin * sumSin) / oscillators.length;
  const psi = atan2(sumSin, sumCos);
  return { r, psi };
}

function drawOrderParameter(){
  const { r, psi } = computeOrderParameter();
  if (rReadout) rReadout.textContent = r.toFixed(2);

  push();
  translate(centerX, centerY);
  stroke(...COL_CYAN);
  strokeWeight(2);
  const len = r * ringRadius * 0.85;
  line(0, 0, cos(psi) * len, sin(psi) * len);
  noStroke();
  fill(...COL_CYAN);
  circle(0, 0, 6);
  pop();
}


/* ---------------- controles (HTML fuera del canvas) ---------------- */

function buildOscGrid(){
  const grid = document.getElementById('oscGrid');
  grid.innerHTML = '';
  oscillators.forEach((osc, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'osc-ctrl';
    wrap.innerHTML = `
      <label for="bpm${i}">${osc.name}</label>
      <input type="number" id="bpm${i}" min="40" max="220" step="1" value="${osc.bpm}">
      <button type="button" class="mode-toggle" id="mode${i}" data-mode="${osc.mode}"></button>
    `;
    grid.appendChild(wrap);

    document.getElementById(`bpm${i}`).addEventListener('input', (e) => {
      const v = Number(e.target.value) || 1;
      oscillators[i].setBPM(v);
    });

    const modeBtn = document.getElementById(`mode${i}`);
    paintModeButton(modeBtn, osc.mode);
    modeBtn.addEventListener('click', () => {
      const next = osc.mode === 'sustain' ? 'oneshot' : 'sustain';
      osc.setMode(next);
      modeBtn.dataset.mode = next;
      paintModeButton(modeBtn, next);
    });
  });
}

// texto del botón según el modo: qué le pasa al sonido cuando cae un beat
function paintModeButton(btn, mode){
  btn.textContent = mode === 'sustain' ? '≈ sostenido' : '● un golpe';
}

function unlockAudioIfNeeded(){
  if (typeof getAudioContext === 'function' && getAudioContext().state !== 'running'){
    userStartAudio();
  }
}

function wireControls(){
  const playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', () => {
    unlockAudioIfNeeded();
    playing = !playing;
    playBtn.textContent = playing ? '❚❚ Pausar' : '▶ Iniciar';
    playBtn.setAttribute('aria-pressed', String(playing));
  });

  const kSlider = document.getElementById('kSlider');
  const kValue = document.getElementById('kValue');
  kSlider.addEventListener('input', (e) => {
    K = Number(e.target.value);
    kValue.textContent = K.toFixed(2);
  });

  document.getElementById('randPhaseBtn').addEventListener('click', () => {
    for (const osc of oscillators) osc.theta = random(0, TWO_PI);
  });

  document.getElementById('randBpmBtn').addEventListener('click', () => {
    oscillators.forEach((osc, i) => {
      const bpm = Math.round(random(90, 150));
      osc.setBPM(bpm);
      document.getElementById(`bpm${i}`).value = bpm;
    });
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    oscillators.forEach((osc, i) => {
      osc.setBPM(defaultBPM[i]);
      osc.setMode(defaultModes[i]);
      osc.theta = random(0, TWO_PI);
      document.getElementById(`bpm${i}`).value = defaultBPM[i];
      const modeBtn = document.getElementById(`mode${i}`);
      modeBtn.dataset.mode = defaultModes[i];
      paintModeButton(modeBtn, defaultModes[i]);
    });
    K = 1.4;
    kSlider.value = 1.4;
    kValue.textContent = '1.40';
  });
}