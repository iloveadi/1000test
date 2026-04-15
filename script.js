// Matter.js modules
const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Events } = Matter;

// Configuration
const CONFIG = {
    bpm: 40,
    blockWidth: 120,
    blockHeight: 60,
    maxBlocks: 104,
    colors: ['#eee8d5', '#fdf6e3', '#eee8d5', '#93a1a1', '#eee8d5'],
    wallThickness: 60
};

// State
let engine, render, runner;
let blocks = [];
let selectedBlock = null;
let audioCtx = null;
let currentMode = 'classic'; // 'classic' or 'reverse'

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initPhysics();
    initBlocks();
    initUI();
});

function initPhysics() {
    engine = Engine.create();
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    render = Render.create({
        element: container,
        engine: engine,
        options: {
            width: width,
            height: height,
            wireframes: false,
            background: 'transparent',
            pixelRatio: window.devicePixelRatio
        }
    });

    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);

    // Walls
    const walls = [
        Bodies.rectangle(width / 2, height + CONFIG.wallThickness / 2, width, CONFIG.wallThickness, { isStatic: true, render: { visible: false } }), // Bottom
        Bodies.rectangle(-CONFIG.wallThickness / 2, height / 2, CONFIG.wallThickness, height, { isStatic: true, render: { visible: false } }), // Left
        Bodies.rectangle(width + CONFIG.wallThickness / 2, height / 2, CONFIG.wallThickness, height, { isStatic: true, render: { visible: false } }), // Right
        Bodies.rectangle(width / 2, -500, width, CONFIG.wallThickness, { isStatic: false, wireframes: false }) // Initial drop buffer - not a wall
    ];
    Composite.add(engine.world, walls.slice(0, 3));

    // Mouse control
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: { visible: false }
        }
    });
    Composite.add(engine.world, mouseConstraint);

    // Handle mouse click for Quiz
    Events.on(mouseConstraint, 'mousedown', (event) => {
        const mousePosition = event.mouse.position;
        const found = Matter.Query.point(blocks, mousePosition)[0];
        
        // If we clicked a block and aren't dragging it far (simple click check)
        if (found) {
            // Check if it was a quick click or a drag
            const startPos = { ...mousePosition };
            setTimeout(() => {
                const dist = Math.hypot(mouse.position.x - startPos.x, mouse.position.y - startPos.y);
                if (dist < 5) {
                    showQuiz(found);
                }
            }, 100);
        }
    });

    // Custom rendering for Text
    Events.on(render, 'afterRender', () => {
        const context = render.context;
        context.font = 'bold 20px "Noto Sans KR"';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        blocks.forEach(block => {
            const { x, y } = block.position;
            const angle = block.angle;
            
            context.save();
            context.translate(x, y);
            context.rotate(angle);
            context.fillStyle = '#073642';
            
            // Draw Number (Smaller)
            context.font = '12px "Noto Sans KR"';
            context.fillText(block.cheonjamun.id, 0, -18);
            
            // Draw Main Text (Hanja or Reading)
            context.font = 'bold 20px "Noto Sans KR"';
            const displayText = currentMode === 'classic' ? block.cheonjamun.hanja : block.cheonjamun.reading;
            context.fillText(displayText, 0, 8);
            context.restore();
        });
    });

    window.addEventListener('resize', () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        render.canvas.width = newWidth;
        render.canvas.height = newHeight;
        // Update floor position if needed
    });
}

function initBlocks() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    
    // Create 104 blocks
    cheonjamunData.slice(0, CONFIG.maxBlocks).forEach((data, i) => {
        setTimeout(() => {
            const x = Math.random() * (width - 100) + 50;
            const y = -100;
            
            const block = Bodies.rectangle(x, y, CONFIG.blockWidth, CONFIG.blockHeight, {
                chamfer: { radius: 10 },
                render: {
                    fillStyle: CONFIG.colors[i % CONFIG.colors.length],
                    strokeStyle: '#93a1a1',
                    lineWidth: 1
                },
                friction: 0.5,
                restitution: 0.6
            });
            
            block.cheonjamun = data;
            blocks.push(block);
            Composite.add(engine.world, block);
            
            // Start audio on first block creation (interaction required)
            if (i === 0) {
                // Audio needs user gesture, handled in UI
            }
        }, i * 150); // Stagger drop
    });
}

// --- Audio Logic ---
function playSuccessSound() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // "Ppi-yuk!" sound: quick slide from 400Hz to 1200Hz
    const now = audioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
}

// --- UI & Quiz Logic ---
function initUI() {
    const btnCancel = document.getElementById('btn-cancel');
    const btnCancelChoice = document.getElementById('btn-cancel-choice');
    const btnSubmit = document.getElementById('btn-submit');
    const input = document.getElementById('answer-input');
    
    // Mode Buttons
    const modeClassicBtn = document.getElementById('mode-classic');
    const modeReverseBtn = document.getElementById('mode-reverse');

    modeClassicBtn.addEventListener('click', () => switchMode('classic'));
    modeReverseBtn.addEventListener('click', () => switchMode('reverse'));

    btnCancel.addEventListener('click', closeQuiz);
    btnCancelChoice.addEventListener('click', closeQuiz);
    btnSubmit.addEventListener('click', checkAnswer);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
}

function switchMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;
    
    document.getElementById('mode-classic').classList.toggle('active', mode === 'classic');
    document.getElementById('mode-reverse').classList.toggle('active', mode === 'reverse');
}

function showQuiz(block) {
    selectedBlock = block;
    const container = document.getElementById('quiz-container');
    const display = document.getElementById('quiz-hanja');
    
    const inputGroup = document.getElementById('mode-input-group');
    const choiceGroup = document.getElementById('mode-choice-group');

    if (currentMode === 'classic') {
        display.innerText = block.cheonjamun.hanja;
        inputGroup.style.display = 'block';
        choiceGroup.style.display = 'none';
        const input = document.getElementById('answer-input');
        input.value = '';
        setTimeout(() => input.focus(), 100);
    } else {
        display.innerText = block.cheonjamun.reading;
        inputGroup.style.display = 'none';
        choiceGroup.style.display = 'block';
        generateChoices(block);
    }
    
    container.classList.add('active');
}

function generateChoices(correctBlock) {
    const container = document.getElementById('choice-container');
    container.innerHTML = '';
    
    // Pick 3 random distractors
    const distractors = cheonjamunData
        .filter(d => d.id !== correctBlock.cheonjamun.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
    
    const choices = [correctBlock.cheonjamun, ...distractors]
        .sort(() => 0.5 - Math.random());
    
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'choice-button';
        btn.innerText = choice.hanja;
        btn.onclick = () => checkChoice(choice.hanja);
        container.appendChild(btn);
    });
}

function checkChoice(selectedHanja) {
    if (selectedHanja === selectedBlock.cheonjamun.hanja) {
        playSuccessSound();
        removeBlock(selectedBlock);
        closeQuiz();
    } else {
        const container = document.getElementById('quiz-container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 400);
    }
}

function closeQuiz() {
    document.getElementById('quiz-container').classList.remove('active');
    selectedBlock = null;
}

function checkAnswer() {
    if (!selectedBlock) return;
    
    const input = document.getElementById('answer-input').value.trim().replace(/\s+/g, '');
    const data = selectedBlock.cheonjamun;
    
    // Normalize targets
    const targetReading = data.reading.replace(/\s+/g, '');
    const targetHun = data.hun.replace(/[,/]/g, '').replace(/\s+/g, '');
    
    if (input === targetReading || input === targetHun) {
        // Correct!
        playSuccessSound();
        removeBlock(selectedBlock);
        closeQuiz();
    } else {
        // Wrong
        const container = document.getElementById('quiz-container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 400);
    }
}

function removeBlock(block) {
    // Visual effect before removal
    block.render.fillStyle = '#b58900';
    
    // Scale down effect (Matter.js doesn't have built-in scale animation, so we just remove after a bit)
    setTimeout(() => {
        Composite.remove(engine.world, block);
        blocks = blocks.filter(b => b !== block);
    }, 200);
}
