// Oracle of Wit — Visual Effects, Audio, Animations
// Depends on: state.js

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
            // Subtle mouse repulsion
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

// === 3D ORACLE EYE (Three.js) ===
class OracleEye3D {
    constructor() {
        this.instances = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.gameColor = { r: 0.66, g: 0.33, b: 0.97 }; // wit purple
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

            // Outer eye sphere (sclera glow)
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

                        // Iris
                        float irisRadius = 0.35;
                        float iris = smoothstep(irisRadius + 0.02, irisRadius - 0.02, dist);

                        // Pupil
                        float pupilRadius = uDilation;
                        float pupil = smoothstep(pupilRadius + 0.02, pupilRadius - 0.02, dist);

                        // Specular highlight
                        vec2 specPos = center + vec2(-0.1, 0.12);
                        float spec = smoothstep(0.08, 0.0, distance(vUv, specPos));

                        // Iris color with animated rings
                        float rings = sin(dist * 40.0 + uTime * 0.5) * 0.1 + 0.9;
                        vec3 irisColor = uColor * rings;
                        irisColor += vec3(0.1, 0.3, 0.3) * sin(uTime * 0.3 + dist * 10.0) * 0.15;

                        // Compose
                        vec3 scleraColor = vec3(0.04, 0.04, 0.07);
                        float pulse = sin(uTime * uPulseSpeed) * 0.15 + 0.85;

                        // Fresnel rim glow
                        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
                        vec3 rimColor = uColor * fresnel * 0.6 * pulse;

                        vec3 color = scleraColor;
                        color = mix(color, irisColor * pulse, iris);
                        color = mix(color, vec3(0.01), pupil);
                        color += vec3(1.0) * spec * 0.8;
                        color += rimColor;

                        // Outer glow falloff
                        float alpha = smoothstep(0.5, 0.35, length(vPosition.xy));
                        alpha = max(alpha, fresnel * 0.3);

                        gl_FragColor = vec4(color, alpha);
                    }
                `,
                transparent: true
            });

            const eyeMesh = new THREE.Mesh(outerGeo, outerMat);
            scene.add(eyeMesh);

            // Outer glow sprite
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

    setGameState(stateName) {
        switch(stateName) {
            case 'idle': case 'welcome': case 'lobby':
                this.targetColor = { r: 0.66, g: 0.33, b: 0.97 }; // wit purple
                this.pulseSpeed = 1.0;
                this.targetDilation = 0.3;
                break;
            case 'judging': case 'curating':
                this.targetColor = { r: 0.18, g: 0.83, b: 0.75 }; // oracle teal
                this.pulseSpeed = 2.0;
                this.targetDilation = 0.25;
                break;
            case 'roundResults': case 'finished':
                this.targetColor = { r: 0.98, g: 0.75, b: 0.14 }; // consensus gold
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

    dilate() { this.targetDilation = 0.45; }
    undilate() { this.targetDilation = 0.3; }

    animate() {
        // Smooth lerp mouse
        this.targetX += (this.mouseX - this.targetX) * 0.08;
        this.targetY += (this.mouseY - this.targetY) * 0.08;

        // Smooth lerp color
        this.gameColor.r += (this.targetColor.r - this.gameColor.r) * 0.03;
        this.gameColor.g += (this.targetColor.g - this.gameColor.g) * 0.03;
        this.gameColor.b += (this.targetColor.b - this.gameColor.b) * 0.03;

        // Smooth lerp dilation
        this.pupilDilation += (this.targetDilation - this.pupilDilation) * 0.05;

        const time = performance.now() * 0.001;

        for (const inst of this.instances) {
            if (!inst.active || !inst.renderer.domElement.isConnected) {
                inst.active = false;
                continue;
            }

            inst.outerMat.uniforms.uTime.value = time;
            inst.outerMat.uniforms.uMouse.value.set(this.targetX, this.targetY);
            inst.outerMat.uniforms.uColor.value.set(this.gameColor.r, this.gameColor.g, this.gameColor.b);
            inst.outerMat.uniforms.uDilation.value = this.pupilDilation;
            inst.outerMat.uniforms.uPulseSpeed.value = this.pulseSpeed;

            // Subtle mesh rotation following mouse
            inst.eyeMesh.rotation.y = this.targetX * 0.15;
            inst.eyeMesh.rotation.x = -this.targetY * 0.15;

            // Glow sprite pulse
            const pulse = Math.sin(time * this.pulseSpeed) * 0.05 + 0.15;
            inst.spriteMat.opacity = pulse;
            inst.spriteMat.color.setRGB(this.gameColor.r, this.gameColor.g, this.gameColor.b);

            inst.renderer.render(inst.scene, inst.camera);
        }

        // Clean up disconnected instances
        this.instances = this.instances.filter(i => i.active);

        requestAnimationFrame(() => this.animate());
    }

    start() {
        if (this.available) this.animate();
    }
}

const oracleEye3D = new OracleEye3D();
oracleEye3D.start();

// Mount 3D eye to a container element (called after render)
function mountOracleEye(containerId, size) {
    const el = document.getElementById(containerId);
    if (!el || el.querySelector('canvas')) return; // already mounted or missing
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

// === AUDIO SYSTEM ===
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
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
        drumroll: null, // special handling below
        streak: [[660,880,1100], 0.3, 'sine'],
        tab: [800, 0.06, 'sine'],
        hover: null, // special handling below
        transition: null // special handling below
    };
    // Drumroll: ascending sweep
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
        } catch(e) {}
        return;
    }
    // Transition: whoosh sweep
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
        } catch(e) {}
        return;
    }
    // Hover: very quiet tick
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
        } catch(e) {}
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
    } catch(e) {}
}

// === CONFETTI ===
function createConfetti() {
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

// === VALIDATOR VOTING ANIMATION ===
function startValidatorVoting() {
    if (validatorVotingInterval) return; // Already running

    state.validatorVotes = [];
    state.consensusReached = false;

    // Get submissions to simulate voting on
    const submissions = state.room?.submissions || [];
    const submissionIds = submissions.map(s => s.id);

    if (submissionIds.length === 0) return;

    // Determine the likely winner (first submission for simulation,
    // actual winner comes from backend)
    let winningId = submissionIds[0];

    // Simulate validators voting one by one
    let voteIndex = 0;
    const validators = ['GPT-4', 'Claude', 'LLaMA', 'Gemini', 'Mixtral'];

    validatorVotingInterval = setInterval(() => {
        if (voteIndex >= 5) {
            // All validators voted
            state.consensusReached = true;
            playSound('click');
            render(true);
            stopValidatorVoting();
            return;
        }

        // Simulate validator voting
        // Most validators agree (4-5 out of 5) to show consensus
        let vote;
        if (voteIndex < 4 || Math.random() > 0.3) {
            vote = winningId; // Agree with consensus
        } else {
            // Occasionally a validator disagrees (shows democracy working)
            const otherIds = submissionIds.filter(id => id !== winningId);
            vote = otherIds.length > 0 ? otherIds[Math.floor(Math.random() * otherIds.length)] : winningId;
        }

        state.validatorVotes.push(vote);
        playSound('tick');

        // Check for majority (3/5)
        const voteCounts = {};
        state.validatorVotes.forEach(v => {
            voteCounts[v] = (voteCounts[v] || 0) + 1;
        });
        const maxVotes = Math.max(...Object.values(voteCounts));
        if (maxVotes >= 3 && !state.consensusReached) {
            // Find the winning submission ID
            state.winningSubmissionId = Object.keys(voteCounts).find(k => voteCounts[k] === maxVotes);
        }

        voteIndex++;
        render(true);

    }, 800); // Vote every 800ms for dramatic effect
}

function stopValidatorVoting() {
    if (validatorVotingInterval) {
        clearInterval(validatorVotingInterval);
        validatorVotingInterval = null;
    }
}

// === DRAMATIC REVEAL SEQUENCE ===
function startRevealSequence() {
    stopRevealSequence();
    const r = state.room;
    const result = r.roundResults[r.roundResults.length - 1];
    if (!result) return;

    const revealOrder = result.revealOrder || r.submissions.map(s => s.id);
    state.revealIndex = -1;
    state.revealedJokes = [];
    revealTimeouts = [];

    playSound('drumroll');
    render(true);

    // Reveal jokes one by one every 2.5 seconds
    state.revealTimer = setInterval(() => {
        state.revealIndex++;

        const currentId = revealOrder[state.revealIndex];
        const isWinner = state.revealIndex === revealOrder.length - 1;
        const submission = r.submissions.find(s => s.id === currentId);

        // Guard against missing submission
        if (!submission) {
            if (!isWinner) return; // skip bad ID
            // If winner is missing, bail to results
            stopRevealSequence();
            render(true);
            return;
        }

        if (isWinner) {
            // Stop the interval — we handle the rest with timeouts
            clearInterval(state.revealTimer);
            state.revealTimer = null;

            playSound('drumroll');
            // Flash the screen gold
            const flash = document.createElement('div');
            flash.className = 'screen-flash';
            document.body.appendChild(flash);
            revealTimeouts.push(setTimeout(() => flash.remove(), 600));

            // 1.5s dramatic pause, then reveal winner
            revealTimeouts.push(setTimeout(() => {
                if (state.revealPhase !== 'revealing') return; // cancelled
                state.revealedJokes.push({ ...submission, isWinner: true, eliminated: false });
                playSound('reveal');
                createConfetti();
                render(true);

                // After 3s showing winner, transition to full results
                revealTimeouts.push(setTimeout(() => {
                    if (state.revealPhase !== 'revealing') return; // cancelled
                    state.revealPhase = null;
                    state.revealedJokes = [];
                    state.revealIndex = -1;
                    playSound('win');
                    render(true);
                }, 3000));
            }, 1500));
        } else {
            state.revealedJokes.push({ ...submission, isWinner: false, eliminated: true });
            playSound('eliminate');
            render(true);
        }
    }, 2500);
}

function stopRevealSequence() {
    if (state.revealTimer) { clearInterval(state.revealTimer); state.revealTimer = null; }
    revealTimeouts.forEach(t => clearTimeout(t));
    revealTimeouts = [];
    state.revealPhase = null;
    state.revealedJokes = [];
    state.revealIndex = -1;
}

function skipReveal() {
    stopRevealSequence();
    playSound('win');
    render(true);
}

// Add whoosh sound for screen transitions
function playScreenTransition(oldScreen, newScreen) {
    if (oldScreen === newScreen) return;
    playSound('transition');
}
