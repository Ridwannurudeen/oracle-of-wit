// Oracle of Wit — Visual Effects, Audio, Animations (ES Module)

import { state, validatorVotingInterval, setValidatorVotingInterval, revealTimeouts, setRevealTimeouts } from './state.js';
import { soundEnabled, audioCtx, setAudioCtx } from './api.js';

/** @type {((force?: boolean) => void)|null} Late-binding render to avoid circular imports. */
let _render = null;
/** @param {(force?: boolean) => void} fn */ export function bindEffectsRender(fn) { _render = fn; }

// === DATA MIST PARTICLE SYSTEM ===
(function initMist() {
    const c = document.getElementById('mist-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    let w, h, particles = [], mouseX = 0, mouseY = 0;

    function resize() { w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

    for (let i = 0; i < 60; i++) {
        particles.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2,
            r: Math.random() * 2 + 0.5,
            color: Math.random() > 0.5 ? 'rgba(168,85,247,' : 'rgba(45,212,191,',
            alpha: Math.random() * 0.3 + 0.05
        });
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        for (const p of particles) {
            const dx = p.x - mouseX, dy = p.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                p.vx += dx / dist * 0.02;
                p.vy += dy / dist * 0.02;
            }
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.99; p.vy *= 0.99;
            if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color + p.alpha + ')';
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }
    draw();
})();

/**
 * 3D Oracle Eye rendered with Three.js shaders. Tracks mouse movement,
 * changes colour/pulse based on game state, and supports multiple DOM mount points.
 */
class OracleEye3D {
    constructor() {
        this.instances = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.gameColor = { r: 0.66, g: 0.33, b: 0.97 };
        this.targetColor = { r: 0.66, g: 0.33, b: 0.97 };
        this.pupilDilation = 0.3;
        this.targetDilation = 0.3;
        this.pulseSpeed = 1.0;
        this.available = typeof THREE !== 'undefined';

        if (this.available) {
            document.addEventListener('mousemove', e => {
                this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
                this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
            });
        }
    }

    /**
     * Mount a new 3D eye instance into a DOM container.
     * @param {HTMLElement} container - DOM element to append the renderer canvas to.
     * @param {number} [size=160] - Pixel width/height of the eye.
     * @returns {Object|null} Eye instance, or null if Three.js unavailable.
     */
    mount(container, size = 160) {
        if (!this.available) return null;
        try {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            camera.position.z = 3;

            const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer.setSize(size, size);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x000000, 0);

            const outerGeo = new THREE.SphereGeometry(1, 64, 64);
            const outerMat = new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uMouse: { value: new THREE.Vector2(0, 0) },
                    uColor: { value: new THREE.Vector3(0.66, 0.33, 0.97) },
                    uDilation: { value: 0.3 },
                    uPulseSpeed: { value: 1.0 }
                },
                vertexShader: `
                    varying vec2 vUv;
                    varying vec3 vNormal;
                    varying vec3 vPosition;
                    void main() {
                        vUv = uv;
                        vNormal = normalize(normalMatrix * normal);
                        vPosition = position;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform float uTime;
                    uniform vec2 uMouse;
                    uniform vec3 uColor;
                    uniform float uDilation;
                    uniform float uPulseSpeed;
                    varying vec2 vUv;
                    varying vec3 vNormal;
                    varying vec3 vPosition;

                    void main() {
                        vec2 center = vec2(0.5) + uMouse * 0.08;
                        float dist = distance(vUv, center);
                        float irisRadius = 0.35;
                        float iris = smoothstep(irisRadius + 0.02, irisRadius - 0.02, dist);
                        float pupilRadius = uDilation;
                        float pupil = smoothstep(pupilRadius + 0.02, pupilRadius - 0.02, dist);
                        vec2 specPos = center + vec2(-0.1, 0.12);
                        float spec = smoothstep(0.08, 0.0, distance(vUv, specPos));
                        float rings = sin(dist * 40.0 + uTime * 0.5) * 0.1 + 0.9;
                        vec3 irisColor = uColor * rings;
                        irisColor += vec3(0.1, 0.3, 0.3) * sin(uTime * 0.3 + dist * 10.0) * 0.15;
                        vec3 scleraColor = vec3(0.04, 0.04, 0.07);
                        float pulse = sin(uTime * uPulseSpeed) * 0.15 + 0.85;
                        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
                        vec3 rimColor = uColor * fresnel * 0.6 * pulse;
                        vec3 color = scleraColor;
                        color = mix(color, irisColor * pulse, iris);
                        color = mix(color, vec3(0.01), pupil);
                        color += vec3(1.0) * spec * 0.8;
                        color += rimColor;
                        float alpha = smoothstep(0.5, 0.35, length(vPosition.xy));
                        alpha = max(alpha, fresnel * 0.3);
                        gl_FragColor = vec4(color, alpha);
                    }
                `,
                transparent: true
            });

            const eyeMesh = new THREE.Mesh(outerGeo, outerMat);
            scene.add(eyeMesh);

            const spriteMat = new THREE.SpriteMaterial({
                color: 0xa855f7,
                transparent: true,
                opacity: 0.15,
                blending: THREE.AdditiveBlending
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(3, 3, 1);
            scene.add(sprite);

            container.appendChild(renderer.domElement);
            renderer.domElement.style.borderRadius = '50%';

            const instance = { scene, camera, renderer, eyeMesh, outerMat, sprite, spriteMat, size, active: true };
            this.instances.push(instance);
            return instance;
        } catch(e) {
            return null;
        }
    }

    /**
     * Set the eye's visual state (colour, pulse speed, dilation) based on game phase.
     * @param {string} stateName - Current game screen/state name.
     * @returns {void}
     */
    setGameState(stateName) {
        switch(stateName) {
            case 'idle': case 'welcome': case 'lobby':
                this.targetColor = { r: 0.66, g: 0.33, b: 0.97 };
                this.pulseSpeed = 1.0;
                this.targetDilation = 0.3;
                break;
            case 'judging': case 'curating':
                this.targetColor = { r: 0.18, g: 0.83, b: 0.75 };
                this.pulseSpeed = 2.0;
                this.targetDilation = 0.25;
                break;
            case 'roundResults': case 'finished':
                this.targetColor = { r: 0.98, g: 0.75, b: 0.14 };
                this.pulseSpeed = 0.5;
                this.targetDilation = 0.35;
                break;
            case 'submitting':
                this.targetColor = { r: 0.66, g: 0.33, b: 0.97 };
                this.pulseSpeed = 1.2;
                this.targetDilation = 0.28;
                break;
            case 'betting':
                this.targetColor = { r: 0.96, g: 0.62, b: 0.04 };
                this.pulseSpeed = 1.5;
                this.targetDilation = 0.22;
                break;
            default:
                this.targetColor = { r: 0.66, g: 0.33, b: 0.97 };
                this.pulseSpeed = 1.0;
                this.targetDilation = 0.3;
        }
    }

    /** Dilate the pupil (e.g. on input focus). */ dilate() { this.targetDilation = 0.45; }
    /** Constrict the pupil back to default. */ undilate() { this.targetDilation = 0.3; }

    /**
     * Main animation loop. Smoothly interpolates colour, mouse tracking,
     * and dilation, then renders all active instances.
     * @returns {void}
     */
    animate() {
        this.targetX += (this.mouseX - this.targetX) * 0.08;
        this.targetY += (this.mouseY - this.targetY) * 0.08;
        this.gameColor.r += (this.targetColor.r - this.gameColor.r) * 0.03;
        this.gameColor.g += (this.targetColor.g - this.gameColor.g) * 0.03;
        this.gameColor.b += (this.targetColor.b - this.gameColor.b) * 0.03;
        this.pupilDilation += (this.targetDilation - this.pupilDilation) * 0.05;

        const time = performance.now() * 0.001;

        for (const inst of this.instances) {
            if (!inst.active || !inst.renderer.domElement.isConnected) {
                // Dispose WebGL resources to prevent context leak
                if (inst.active !== false) {
                    try {
                        inst.renderer.dispose();
                        inst.outerMat.dispose();
                        inst.spriteMat.dispose();
                    } catch (_) { /* already disposed */ }
                }
                inst.active = false;
                continue;
            }
            inst.outerMat.uniforms.uTime.value = time;
            inst.outerMat.uniforms.uMouse.value.set(this.targetX, this.targetY);
            inst.outerMat.uniforms.uColor.value.set(this.gameColor.r, this.gameColor.g, this.gameColor.b);
            inst.outerMat.uniforms.uDilation.value = this.pupilDilation;
            inst.outerMat.uniforms.uPulseSpeed.value = this.pulseSpeed;
            inst.eyeMesh.rotation.y = this.targetX * 0.15;
            inst.eyeMesh.rotation.x = -this.targetY * 0.15;
            const pulse = Math.sin(time * this.pulseSpeed) * 0.05 + 0.15;
            inst.spriteMat.opacity = pulse;
            inst.spriteMat.color.setRGB(this.gameColor.r, this.gameColor.g, this.gameColor.b);
            inst.renderer.render(inst.scene, inst.camera);
        }

        this.instances = this.instances.filter(i => i.active);
        requestAnimationFrame(() => this.animate());
    }

    /** Start the animation loop if Three.js is available. */
    start() {
        if (this.available) this.animate();
    }
}

/** @type {OracleEye3D} Singleton 3D oracle eye instance. */
export const oracleEye3D = new OracleEye3D();
oracleEye3D.start();

/**
 * Mount the 3D oracle eye into a container element by ID.
 * No-ops if container not found or already has a canvas.
 * @param {string} containerId - DOM element ID.
 * @param {number} size - Pixel size for the eye.
 * @returns {void}
 */
export function mountOracleEye(containerId, size) {
    const el = document.getElementById(containerId);
    if (!el || el.querySelector('canvas')) return;
    oracleEye3D.mount(el, size);
}

// === ORACLE EYE CURSOR TRACKING (CSS fallback) ===
document.addEventListener('mousemove', e => {
    document.querySelectorAll('.oracle-eye').forEach(el => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (window.innerWidth / 2);
        const dy = (e.clientY - cy) / (window.innerHeight / 2);
        const x = 40 + dx * 15;
        const y = 40 + dy * 15;
        el.style.setProperty('--eye-x', x + '%');
        el.style.setProperty('--eye-y', y + '%');
    });
});

/**
 * Initialise the Web Audio API context. Creates one if needed and resumes if suspended.
 * @returns {void}
 */
export function initAudio() {
    if (!audioCtx) setAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

/**
 * Play a synthesised sound effect using Web Audio oscillators.
 * @param {string} type - Sound type key (e.g. 'click', 'submit', 'win', 'drumroll').
 * @returns {void}
 */
export function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    // Resume AudioContext if browser auto-suspended it (e.g. after idle)
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const sounds = {
        click: [600, 0.1, 'sine'],
        submit: [800, 0.15, 'sine'],
        bet: [500, 0.2, 'triangle'],
        win: [[523,659,784], 0.3, 'sine'],
        tick: [1000, 0.05, 'square'],
        start: [[440,554,659], 0.2, 'sine'],
        warning: [[440,220], 0.3, 'sawtooth'],
        eliminate: [[400,200], 0.1, 'sine'],
        reveal: [[523,659,784,1047], 0.4, 'sine'],
        loss: [150, 0.2, 'sawtooth'],
        drumroll: null,
        streak: [[660,880,1100], 0.3, 'sine'],
        tab: [800, 0.06, 'sine'],
        hover: null,
        transition: null
    };
    if (type === 'drumroll') {
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.6);
        } catch (_e) { /* audio may not be available */ }
        return;
    }
    if (type === 'transition') {
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.2);
        } catch (_e) { /* audio may not be available */ }
        return;
    }
    if (type === 'hover') {
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.frequency.value = 2000; osc.type = 'sine';
            gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.05);
        } catch (_e) { /* audio may not be available */ }
        return;
    }
    const s = sounds[type];
    if (!s) return;
    try {
        const freqs = Array.isArray(s[0]) ? s[0] : [s[0]];
        freqs.forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.frequency.value = f; osc.type = s[2];
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + s[1]);
            osc.start(audioCtx.currentTime + i * 0.1);
            osc.stop(audioCtx.currentTime + s[1] + i * 0.1);
        });
    } catch (_e) { /* audio may not be available */ }
}

/**
 * Create a burst of 60 coloured confetti particles that fall and auto-remove.
 * @returns {void}
 */
export function createConfetti() {
    const colors = ['#f59e0b','#ec4899','#6366f1','#10b981','#ef4444','#8b5cf6'];
    for (let i = 0; i < 60; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.background = colors[Math.floor(Math.random() * colors.length)];
        c.style.animation = `confetti-fall ${2+Math.random()*2}s linear forwards`;
        c.style.animationDelay = Math.random() * 0.5 + 's';
        c.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4500);
    }
}

/**
 * Start the animated validator voting sequence. Simulates 5 validators
 * casting votes at 800ms intervals with sound effects.
 * @returns {void}
 */
export function startValidatorVoting() {
    if (validatorVotingInterval) return;

    state.validatorVotes = [];
    state.consensusReached = false;

    const submissions = state.room?.submissions || [];
    const submissionIds = submissions.map(s => s.id);
    if (submissionIds.length === 0) return;

    let winningId = submissionIds[0];
    let voteIndex = 0;

    setValidatorVotingInterval(setInterval(() => {
        if (voteIndex >= 5) {
            state.consensusReached = true;
            playSound('click');
            if (_render) _render(true);
            stopValidatorVoting();
            return;
        }

        let vote;
        if (voteIndex < 4 || Math.random() > 0.3) {
            vote = winningId;
        } else {
            const otherIds = submissionIds.filter(id => id !== winningId);
            vote = otherIds.length > 0 ? otherIds[Math.floor(Math.random() * otherIds.length)] : winningId;
        }

        state.validatorVotes.push(vote);
        playSound('tick');

        const voteCounts = {};
        state.validatorVotes.forEach(v => {
            voteCounts[v] = (voteCounts[v] || 0) + 1;
        });
        const maxVotes = Math.max(...Object.values(voteCounts));
        if (maxVotes >= 3 && !state.consensusReached) {
            state.winningSubmissionId = Object.keys(voteCounts).find(k => voteCounts[k] === maxVotes);
        }

        voteIndex++;
        if (_render) _render(true);
    }, 800));
}

/**
 * Stop the validator voting animation and clear the interval.
 * @returns {void}
 */
export function stopValidatorVoting() {
    if (validatorVotingInterval) {
        clearInterval(validatorVotingInterval);
        setValidatorVotingInterval(null);
    }
}

/**
 * Start the dramatic joke reveal sequence. Reveals eliminated submissions
 * at 2.5s intervals, then the winner with confetti and a screen flash.
 * @returns {void}
 */
export function startRevealSequence() {
    stopRevealSequence();
    // Re-set revealPhase AFTER stop (which resets it to null)
    state.revealPhase = 'revealing';
    const r = state.room;
    const result = r.roundResults[r.roundResults.length - 1];
    if (!result) return;

    const revealOrder = result.revealOrder || r.submissions.map(s => s.id);
    state.revealIndex = -1;
    state.revealedJokes = [];
    setRevealTimeouts([]);

    playSound('drumroll');
    if (_render) _render(true);

    state.revealTimer = setInterval(() => {
        state.revealIndex++;

        const currentId = revealOrder[state.revealIndex];
        const isWinner = state.revealIndex === revealOrder.length - 1;
        const submission = r.submissions.find(s => s.id === currentId);

        if (!submission) {
            if (!isWinner) return;
            stopRevealSequence();
            if (_render) _render(true);
            return;
        }

        if (isWinner) {
            clearInterval(state.revealTimer);
            state.revealTimer = null;

            playSound('drumroll');
            const flash = document.createElement('div');
            flash.className = 'screen-flash';
            document.body.appendChild(flash);
            const newTimeouts = [...revealTimeouts];
            newTimeouts.push(setTimeout(() => flash.remove(), 600));

            newTimeouts.push(setTimeout(() => {
                if (state.revealPhase !== 'revealing') return;
                state.revealedJokes.push({ ...submission, isWinner: true, eliminated: false });
                playSound('reveal');
                createConfetti();
                if (_render) _render(true);

                const innerTimeouts = [...revealTimeouts];
                innerTimeouts.push(setTimeout(() => {
                    if (state.revealPhase !== 'revealing') return;
                    state.revealPhase = null;
                    state.revealedJokes = [];
                    state.revealIndex = -1;
                    playSound('win');
                    if (_render) _render(true);
                }, 3000));
                setRevealTimeouts(innerTimeouts);
            }, 1500));
            setRevealTimeouts(newTimeouts);
        } else {
            state.revealedJokes.push({ ...submission, isWinner: false, eliminated: true });
            playSound('eliminate');
            if (_render) _render(true);
        }
    }, 2500);
}

/**
 * Stop the reveal sequence, clear all timeouts, and reset reveal state.
 * @returns {void}
 */
export function stopRevealSequence() {
    if (state.revealTimer) { clearInterval(state.revealTimer); state.revealTimer = null; }
    revealTimeouts.forEach(t => clearTimeout(t));
    setRevealTimeouts([]);
    state.revealPhase = null;
    state.revealedJokes = [];
    state.revealIndex = -1;
}

/**
 * Skip the reveal animation and jump directly to the round results.
 * @returns {void}
 */
export function skipReveal() {
    stopRevealSequence();
    playSound('win');
    if (_render) _render(true);
}

/**
 * Play a transition sound when switching between screens.
 * @param {string} oldScreen - Previous screen name.
 * @param {string} newScreen - New screen name.
 * @returns {void}
 */
export function playScreenTransition(oldScreen, newScreen) {
    if (oldScreen === newScreen) return;
    playSound('transition');
}
