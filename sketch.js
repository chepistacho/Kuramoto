/* =========================================================================
   ECOSISTEMA KURAMOTO — p5.js (WEBGL)
   ------------------------------------------------------------------------- */
p5.disableFriendlyErrors = true;

const N = 8;
const TIME_SCALE = 1.0;
const ORBIT_RADIUS = 230;
const CHAOS_EXTENT = 360;

const PERSONALIDADES = {
  1: { nombre: 'bajo',  color: [70, 120, 255],  omegaRango: [0.55, 0.72], size: 34, hitR: 58 },
  2: { nombre: 'pad',   color: [110, 240, 205], omegaRango: [0.60, 0.80], size: 27, hitR: 46 },
  3: { nombre: 'hihat', color: [225, 250, 255], omegaRango: [1.32, 1.70], size: 11, hitR: 30 },
  4: { nombre: 'synth', color: [175, 145, 255], omegaRango: [0.92, 1.22], size: 23, hitR: 42 }
};

const ESCALA_PAD   = [196.00, 220.00, 233.08, 261.63];
const ESCALA_SYNTH = [392.00, 440.00, 466.16, 523.25, 587.33];
const RAICES_BAJO  = [55.00, 61.74];

let agents = [];
let K = 1.6;
let r = 0, psi = 0, rSmooth = 0;
let camAngle = 0;
let heldAgent = null;
let audioReady = false;
let masterReverb;
let particulas = [];
let kSlider, kReadout, rValueEl;

class Agente {
  constructor(indice, personalidad, subIndice) {
    this.i = indice;
    this.personalidad = personalidad;
    const cfg = PERSONALIDADES[personalidad];
    this.cfg = cfg;

    const [wLo, wHi] = cfg.omegaRango;
    this.baseOmega = lerp(wLo, wHi, subIndice === 0 ? 0.12 : 0.88) + random(-0.03, 0.03);
    this.theta = random(TWO_PI);
    this.cicloPrevio = floor(this.theta / TWO_PI);

    this.shocked = false;
    this.shockMult = 1;
    this.shockNoiseAmp = 0;
    this.ruidoT = random(1000);

    this.chaosSeed = createVector(random(1000), random(1000), random(1000));
    this.wobbleSeed = random(1000);
    this.pos = createVector();
    this.sx = 0; this.sy = 0;

    this.polarY = N > 1 ? 1 - (indice / (N - 1)) * 2 : 0;
    this.radioXZ = sqrt(max(0, 1 - this.polarY * this.polarY));

    this.pulso = 0;
    this.rotX = random(TWO_PI); this.rotY = random(TWO_PI); this.rotZ = 0;
    this.spin = random(TWO_PI);
    this.respireOffX = random(TWO_PI);
    this.respireOffY = random(TWO_PI);
    this.respireOffZ = random(TWO_PI);

    this.ondas = []; // Aquí guardamos los anillos de energía que suelta en cada ciclo
    this.crearVoz(subIndice);
  }

  crearVoz(subIndice) {
    if (typeof p5.Oscillator === 'undefined') return;

    if (this.personalidad === 1) {
      this.raiz = RAICES_BAJO[subIndice % RAICES_BAJO.length];
      this.osc = new p5.Oscillator('sine');
      this.osc.amp(0);
      this.osc.start();
      this.env = new p5.Envelope();
      this.env.setADSR(0.001, 0.22, 0, 0.04);
      this.env.setRange(0.85, 0);
    } else if (this.personalidad === 2) {
      this.osc = new p5.Oscillator('sine');
      this.osc2 = new p5.Oscillator('triangle');
      this.osc.amp(0); this.osc2.amp(0);
      this.osc.start(); this.osc2.start();
      this.env = new p5.Envelope();
      this.env.setADSR(0.9, 0.35, 0.35, 1.6);
      this.env.setRange(0.16, 0);
      if (masterReverb) {
        this.osc.disconnect(); this.osc2.disconnect();
        masterReverb.process(this.osc, 2.4, 2.2);
        masterReverb.process(this.osc2, 2.4, 2.2);
      }
    } else if (this.personalidad === 3) {
      this.hatNoise = new p5.Noise('white');
      this.hatNoise.amp(0);
      this.hatNoise.start();
      this.filtro = new p5.HighPass();
      this.filtro.freq(7000);
      this.filtro.res(6);
      this.hatNoise.disconnect();
      this.hatNoise.connect(this.filtro);
      this.env = new p5.Envelope();
      this.env.setADSR(0.001, 0.045, 0, 0.02);
      this.env.setRange(0.16, 0);
    } else if (this.personalidad === 4) {
      this.osc = new p5.Oscillator('sawtooth');
      this.osc.amp(0);
      this.osc.start();
      this.filtro = new p5.LowPass();
      this.filtro.freq(2200);
      this.filtro.res(9);
      this.osc.disconnect();
      this.osc.connect(this.filtro);
      if (masterReverb) masterReverb.process(this.filtro, 1.6, 1.6);
      this.env = new p5.Envelope();
      this.env.setADSR(0.001, 0.14, 0, 0.09);
      this.env.setRange(0.22, 0);
    }
  }

disparar() {
    this.pulso = 1.0;
    // Soltar onda expansiva tipo gota de agua
    this.ondas.push({ radio: this.cfg.size, alpha: 255 });

    if (!audioReady) return;

    if (this.personalidad === 1) {
      this.osc.freq(this.raiz * 2.6);
      this.osc.freq(this.raiz * 0.55, 0.16);
      this.env.play(this.osc, 0, 0.02);
    } else if (this.personalidad === 2) {
      const nota = random(ESCALA_PAD);
      this.osc.freq(nota);
      this.osc2.freq(nota * 1.004);
      this.env.play(this.osc, 0, 0.5);
      this.env.play(this.osc2, 0, 0.5);
    } else if (this.personalidad === 3) {
      this.filtro.freq(random(5500, 9500));
      this.env.play(this.hatNoise, 0, 0.01);
    } else if (this.personalidad === 4) {
      const nota = random(ESCALA_SYNTH);
      this.osc.freq(nota);
      this.env.play(this.osc, 0, 0.02);
    }
  }

  actualizarFase(dtSim) {
    const omegaEfectivo = this.shocked ? this.baseOmega * this.shockMult : this.baseOmega;
    const acoplamiento = K * r * sin(psi - this.theta);
    let dtheta = omegaEfectivo + acoplamiento;
    let nuevaTheta = this.theta + dtheta * dtSim;

    if (this.shocked) {
      this.ruidoT += dtSim * 2.6;
      const n = noise(this.ruidoT) - 0.5;
      nuevaTheta += n * this.shockNoiseAmp * dtSim;
    }

    const cicloNuevo = floor(nuevaTheta / TWO_PI);
    this.theta = nuevaTheta;
    if (cicloNuevo > this.cicloPrevio) this.disparar();
    this.cicloPrevio = cicloNuevo;
  }

  actualizarVisual(t, dtReal) {
    this.pulso *= 0.90;
    if (this.personalidad === 3) this.spin += dtReal * 5.2;

    const nx = noise(this.chaosSeed.x + t * 0.05);
    const ny = noise(this.chaosSeed.y + t * 0.05);
    const nz = noise(this.chaosSeed.z + t * 0.05);
    const posCaos = createVector(
      map(nx, 0, 1, -CHAOS_EXTENT, CHAOS_EXTENT),
      map(ny, 0, 1, -CHAOS_EXTENT * 0.7, CHAOS_EXTENT * 0.7),
      map(nz, 0, 1, -CHAOS_EXTENT, CHAOS_EXTENT)
    );

    const posOrbita = createVector(
      ORBIT_RADIUS * this.radioXZ * cos(this.theta),
      ORBIT_RADIUS * this.polarY,
      ORBIT_RADIUS * this.radioXZ * sin(this.theta)
    );

    const wob = (1 - rSmooth * 0.55) * 9;
    const wobble = createVector(
      map(noise(this.wobbleSeed + t * 0.6), 0, 1, -wob, wob),
      map(noise(this.wobbleSeed + 50 + t * 0.6), 0, 1, -wob, wob),
      map(noise(this.wobbleSeed + 100 + t * 0.6), 0, 1, -wob, wob)
    );

    const mezcla = constrain(rSmooth, 0, 1);
    this.pos = p5.Vector.lerp(posCaos, posOrbita, mezcla).add(wobble);
  }

  proyectarPantalla() {
    // El machetazo final. window._renderer existe en global mode y salta la mierda del navegador.
    const objRenderer = window._renderer;
    if (objRenderer && typeof objRenderer.screenX === 'function') {
        this.sx = objRenderer.screenX(this.pos.x, this.pos.y, this.pos.z);
        this.sy = objRenderer.screenY(this.pos.x, this.pos.y, this.pos.z);
    } else {
        this.sx = -999;
        this.sy = -999;
    }
  }

  display(t) {
    const base = this.cfg.color;
    let col = this.shocked ? [lerp(base[0], 255, 0.55), lerp(base[1], 140, 0.55), lerp(base[2], 90, 0.55)] : base;
    
    // Progreso normalizado del ciclo actual (0.0 a 1.0)
    let faseNorm = (this.theta % TWO_PI) / TWO_PI;

    push();
    translate(this.pos.x, this.pos.y, this.pos.z);

    // 1. Dibujar las ondas expansivas de latidos pasados
    push();
    noFill();
    strokeWeight(2);
    this.ondas.forEach(o => {
      stroke(col[0], col[1], col[2], o.alpha);
      push();
      rotateX(PI/2);
      torus(o.radio, 1, 24, 3);
      pop();
    });
    pop();

    // 2. Dibujar el bicho deformado por su ciclo
    noStroke();
    ambientMaterial(col[0], col[1], col[2], 180);
    specularMaterial(255, 255, 255);
    shininess(70);

    if (this.personalidad === 1) { // BAJO: Se infla lento y se contrae de golpe
      let tension = pow(faseNorm, 3); // Crece exponencialmente antes de estallar
      let escala = 1 + tension * 0.4;
      emissiveMaterial(col[0] * tension, col[1] * tension, col[2] * tension);
      scale(escala);
      sphere(this.cfg.size, 24, 16);

    } else if (this.personalidad === 2) { // PAD: Medusa que ondula con la fase
      let brX = 1 + 0.3 * sin(faseNorm * TWO_PI * 2); 
      let brY = 1 + 0.2 * cos(faseNorm * TWO_PI);
      scale(brX, brY, brX);
      emissiveMaterial(col[0] * 0.2, col[1] * 0.2, col[2] * 0.2);
      sphere(this.cfg.size, 16, 12);

    } else if (this.personalidad === 3) { // HIHAT: Da vueltas según su ciclo
      rotateX(faseNorm * TWO_PI * 2);
      rotateY(faseNorm * TWO_PI);
      emissiveMaterial(col[0] * 0.4, col[1] * 0.4, col[2] * 0.4);
      torus(this.cfg.size, this.cfg.size * 0.3, 12, 6);

    } else { // SYNTH: Se desenrolla o retuerce con el ciclo
      rotateZ(faseNorm * TWO_PI);
      rotateX(this.rotX + faseNorm);
      noFill();
      strokeWeight(1.5);
      stroke(col[0], col[1], col[2], 200 + 55 * faseNorm);
      emissiveMaterial(0);
      box(this.cfg.size * (1 + 0.2 * sin(faseNorm * PI)));
    }
    
    pop();
  }

  dibujarBajo(col) {
    const escala = 1 + this.pulso * 0.55;
    noStroke();
    ambientMaterial(col[0], col[1], col[2]);
    specularMaterial(255, 255, 255);
    shininess(70);
    const brillo = this.pulso;
    emissiveMaterial(col[0] * brillo * 0.9, col[1] * brillo * 0.9, col[2] * brillo);
    sphere(this.cfg.size * escala, 22, 16);

    if (this.pulso > 0.03) {
      push();
      blendMode(ADD);
      noStroke();
      emissiveMaterial(0, 0, 0);
      specularMaterial(0);
      ambientMaterial(col[0], col[1], col[2]);
      sphere(this.cfg.size * escala * (1.6 + this.pulso), 16, 12);
      blendMode(BLEND);
      pop();
    }
  }

  dibujarPad(col, t) {
    const brX = 1 + 0.28 * sin(t * this.baseOmega * TWO_PI * 0.5 + this.respireOffX);
    const brY = 1 + 0.28 * sin(t * this.baseOmega * TWO_PI * 0.5 * 1.13 + this.respireOffY);
    const brZ = 1 + 0.28 * sin(t * this.baseOmega * TWO_PI * 0.5 * 0.87 + this.respireOffZ);
    scale(brX, brY, brZ);
    noStroke();
    ambientMaterial(col[0], col[1], col[2], 150);
    specularMaterial(255, 255, 255, 150);
    shininess(35);
    emissiveMaterial(col[0] * this.pulso * 0.35, col[1] * this.pulso * 0.35, col[2] * this.pulso * 0.35);
    sphere(this.cfg.size, 18, 14);
  }

  dibujarHihat(col) {
    rotateX(this.spin * 0.7);
    rotateY(this.spin);
    noStroke();
    ambientMaterial(col[0], col[1], col[2]);
    specularMaterial(255, 255, 255);
    shininess(95);
    emissiveMaterial(col[0] * this.pulso, col[1] * this.pulso, col[2] * this.pulso);
    torus(this.cfg.size, this.cfg.size * 0.36, 14, 8);
  }

  dibujarSynth(col) {
    rotateX(this.rotX);
    rotateY(this.rotY);
    rotateZ(this.rotZ);
    noFill();
    emissiveMaterial(0, 0, 0);
    strokeWeight(1.6);
    stroke(col[0], col[1], col[2], 230);
    box(this.cfg.size);
    if (this.pulso > 0.05) {
      push();
      blendMode(ADD);
      strokeWeight(3.2);
      stroke(col[0], col[1], col[2], 255 * this.pulso);
      box(this.cfg.size * 1.12);
      blendMode(BLEND);
      pop();
    }
  }
}

function crearParticulas() {
  particulas = [];
  Array.from({ length: 46 }).forEach(() => {
    particulas.push({
      pos: createVector(random(-420, 420), random(-420, 420), random(-420, 420)),
      vel: random(0.25, 0.7),
      tam: random(2, 5.5),
      fase: random(1000)
    });
  });
}

function actualizarYDibujarParticulas(dtReal) {
  noStroke();
  push();
  blendMode(ADD);
  particulas.forEach(p => {
    p.pos.y -= p.vel * dtReal * 26;
    if (p.pos.y < -430) {
      p.pos.y = 430;
      p.pos.x = random(-420, 420);
      p.pos.z = random(-420, 420);
    }
    const centelleo = 0.5 + 0.5 * sin(frameCount * 0.05 + p.fase);
    push();
    translate(p.pos.x, p.pos.y, p.pos.z);
    ambientMaterial(0, 0, 0);
    specularMaterial(0);
    emissiveMaterial(150, 235, 255, 90 * centelleo);
    sphere(p.tam, 6, 4);
    pop();
  });
  blendMode(BLEND);
  pop();
}

function dibujarSueloRejilla() {
  push();
  stroke(60, 190, 210, 55);
  strokeWeight(1);
  noFill();
  const extension = 760, paso = 95, y0 = 250;
  const numSteps = Math.floor((extension * 2) / paso);
  Array.from({ length: numSteps + 1 }).forEach((_, i) => {
    let val = -extension + (i * paso);
    line(val, y0, -extension, val, y0, extension);
    line(-extension, y0, val, extension, y0, val);
  });
  pop();
}

function setup() {
  setAttributes('antialias', true);
  const cnv = createCanvas(windowWidth, windowHeight, WEBGL);
  cnv.parent(document.body);
  frameRate(60);

  if (typeof p5.Reverb !== 'undefined') {
    masterReverb = new p5.Reverb();
    masterReverb.drywet(0.32);
  }

  agents = [];
  const secuenciaPersonalidades = [1, 1, 2, 2, 3, 3, 4, 4];
  const subIndicePorPersonalidad = {};
  
  Array.from({ length: N }).forEach((_, i) => {
    const p = secuenciaPersonalidades[i];
    subIndicePorPersonalidad[p] = (subIndicePorPersonalidad[p] || 0);
    agents.push(new Agente(i, p, subIndicePorPersonalidad[p]));
    subIndicePorPersonalidad[p]++;
  });

  crearParticulas();

  kSlider = document.getElementById('kSlider');
  kReadout = document.getElementById('kReadout');
  rValueEl = document.getElementById('rValue');
  
  if (kSlider) {
      K = parseFloat(kSlider.value);
      if(kReadout) kReadout.textContent = K.toFixed(2);
      kSlider.addEventListener('input', () => {
        K = parseFloat(kSlider.value);
        if(kReadout) kReadout.textContent = K.toFixed(2);
      });
  }

  const btnIniciar = document.getElementById('btnIniciar');
  if (btnIniciar) {
      btnIniciar.addEventListener('click', () => {
        try {
          if (typeof userStartAudio === 'function') userStartAudio();
          const ctx = (typeof getAudioContext === 'function') ? getAudioContext() : null;
          if (ctx && ctx.state !== 'running') ctx.resume();
        } catch (e) {}
        audioReady = (typeof p5.Oscillator !== 'undefined');
        document.getElementById('inicio').classList.add('oculto');
      });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function actualizarKuramoto(dtSim) {
  let sumaCos = 0, sumaSin = 0;
  agents.forEach(a => {
    sumaCos += cos(a.theta);
    sumaSin += sin(a.theta);
  });
  const mc = sumaCos / N, ms = sumaSin / N;
  r = sqrt(mc * mc + ms * ms);
  psi = atan2(ms, mc);
  rSmooth += (r - rSmooth) * 0.04;

  agents.forEach(a => a.actualizarFase(dtSim));
}

function draw() {
  const dtReal = constrain(deltaTime / 1000, 0, 0.05);
  const dtSim = dtReal * TIME_SCALE;
  const t = millis() / 1000;

  actualizarKuramoto(dtSim);
  if (rValueEl) rValueEl.textContent = r.toFixed(2);

  const cFondoBajo = color(6, 10, 22);
  const cFondoAlto = color(6, 46, 58);
  const fondo = lerpColor(cFondoBajo, cFondoAlto, rSmooth * 0.7);
  background(fondo);

  const cAmbBajo = color(16, 24, 55);
  const cAmbAlto = color(60, 235, 235);
  const ambiente = lerpColor(cAmbBajo, cAmbAlto, rSmooth);
  ambientLight(red(ambiente), green(ambiente), blue(ambiente));

  const lx = sin(t * 0.35) * 500;
  const lz = cos(t * 0.35) * 500;
  pointLight(255, 255, 255, lx, -260, lz);
  directionalLight(70, 110, 150, -0.4, 0.6, -0.7);

  camAngle += 0.09 * dtReal;
  const parX = map(constrain(mouseX, 0, width), 0, width, -40, 40);
  const parY = map(constrain(mouseY, 0, height), 0, height, -25, 25);
  const eyeX = cos(camAngle) * 640 + parX;
  const eyeZ = sin(camAngle) * 640;
  const eyeY = -170 + sin(camAngle * 0.5) * 40 + parY;
  camera(eyeX, eyeY, eyeZ, 0, 0, 0, 0, 1, 0);

  agents.forEach(a => {
    a.actualizarVisual(t, dtReal);
    a.proyectarPantalla();
  });

  dibujarSueloRejilla();
  actualizarYDibujarParticulas(dtReal);

  const ordenados = [...agents].sort((a, b) => {
    const da = (a.pos.x - eyeX) ** 2 + (a.pos.y - eyeY) ** 2 + (a.pos.z - eyeZ) ** 2;
    const db = (b.pos.x - eyeX) ** 2 + (b.pos.y - eyeY) ** 2 + (b.pos.z - eyeZ) ** 2;
    return db - da;
  });
  
  ordenados.forEach(a => a.display(t));

  const cercano = agenteMasCercano(mouseX, mouseY);
  cursor(cercano ? HAND : ARROW);
}

function agenteMasCercano(px, py) {
  let mejor = null, mejorD = Infinity;
  agents.forEach(a => {
    const d = dist(px, py, a.sx, a.sy);
    if (d < a.cfg.hitR && d < mejorD) { mejorD = d; mejor = a; }
  });
  return mejor;
}

function iniciarShock(px, py) {
  const a = agenteMasCercano(px, py);
  if (!a) return;
  heldAgent = a;
  a.shocked = true;
  a.shockMult = random(2.4, 4.2);
  a.shockNoiseAmp = random(2.2, 4.0);
}

function terminarShock() {
  if (heldAgent) heldAgent.shocked = false;
  heldAgent = null;
}

function enZonaDeInterfaz(py) {
  return py > height - 150;
}

function mousePressed() {
  if (mouseY < 0 || mouseY > height || enZonaDeInterfaz(mouseY)) return;
  iniciarShock(mouseX, mouseY);
}

function mouseReleased() { terminarShock(); }

function touchStarted() {
  if (touches.length > 0 && !enZonaDeInterfaz(touches[0].y)) iniciarShock(touches[0].x, touches[0].y);
  return false;
}

function touchEnded() { terminarShock(); return false; }