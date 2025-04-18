// Main canvas elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Text processing canvas (hidden)
const textCanvas = document.getElementById('textCanvas');
const textCtx = textCanvas.getContext('2d');

// UI elements
const textInput = document.getElementById('text-input');
const startBtn = document.getElementById('start-button');
const closeInfoBtn = document.getElementById('close-info');
const infoBox = document.getElementById('info-box');

// Mouse position tracking
const mouse = {
    x: -1,
    y: -1,
    radius: 100
};

// Performance settings
let lastTime = 0;
const targetFPS = 60;
const fpsInterval = 1000 / targetFPS;
let frameCount = 0;

// Canvas dimensions
let cw = 0; // canvas width
let ch = 0; // canvas height

// Particle settings
const PARTICLE_SIZE = 1.0; // Particle size (increased from 0.45)
const PARTICLE_COLOR_BASE = 220; // Base color value (220-255 range)

// Animation states
let animationState = 'random'; // 'random', 'forming', 'formed'
let animationStartTime = 0;
const FORMATION_DURATION = 1500; // Time in ms for particles to form text

// Text display settings
let showAdditionalText = false;
const additionalText = "Hey I'm";
let textOpacity = 0;

// Particles array
let particles = [];

// Define target particle count
const TARGET_PARTICLE_COUNT = 1200; // Reduced from 2500 to 1200

// Particle class
class Particle {
    constructor(homeX, homeY) {
        // Home position (where it should go when forming text)
        this.homeX = homeX;
        this.homeY = homeY;
        
        // Current position (random across screen initially)
        this.x = Math.random() * cw;
        this.y = Math.random() * ch;
        
        // Random velocity
        this.vx = 0;
        this.vy = 0;
        
        // Set size - fine grain style
        this.size = PARTICLE_SIZE * (0.7 + Math.random() * 0.6); // Varied sizes
        
        // Bright white color with slight variation
        const grayValue = PARTICLE_COLOR_BASE + Math.random() * (255 - PARTICLE_COLOR_BASE);
        this.color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        
        // For animation interpolation
        this.startX = this.x;
        this.startY = this.y;
    }
    
    // Update particle in random state (before button click)
    updateRandom() {
        // Random drifting motion
        this.x += (Math.random() - 0.5) * 0.3;
        this.y += (Math.random() - 0.5) * 0.3;
        
        // Wrap around edges
        if (this.x < 0) this.x = cw;
        if (this.x > cw) this.x = 0;
        if (this.y < 0) this.y = ch;
        if (this.y > ch) this.y = 0;
    }
    
    // Update during formation animation
    updateForming(progress) {
        // Interpolate position from start to home
        this.x = this.startX + (this.homeX - this.startX) * progress;
        this.y = this.startY + (this.homeY - this.startY) * progress;
    }
    
    // Update particle in formed state (after animation completes)
    updateFormed() {
        // Calculate force toward home position
        const dx = this.homeX - this.x;
        const dy = this.homeY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const force = distance * 0.01; // Spring force
        const angle = Math.atan2(dy, dx);
        
        // Apply home force
        this.vx += force * Math.cos(angle);
        this.vy += force * Math.sin(angle);
        
        // Apply mouse repulsion force
        if (mouse.x >= 0) {
            const mx = this.x - mouse.x;
            const my = this.y - mouse.y;
            const mouseDistSq = mx * mx + my * my;
            
            if (mouseDistSq < mouse.radius * mouse.radius) {
                const mouseDist = Math.sqrt(mouseDistSq);
                const repulsion = (mouse.radius - mouseDist) / mouse.radius;
                const mouseAngle = Math.atan2(my, mx);
                
                this.vx += repulsion * 0.8 * Math.cos(mouseAngle);
                this.vy += repulsion * 0.8 * Math.sin(mouseAngle);
            }
        }
        
        // Apply friction
        this.vx *= 0.92;
        this.vy *= 0.92;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
    }
    
    // Draw the particle
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialize text particles
function initText() {
    // Clear the text canvas
    textCtx.clearRect(0, 0, cw, ch);
    
    // Calculate optimal font size - starting much smaller to ensure full visibility
    let fontSize = 140; // Starting with a significantly smaller size
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    
    // Set a fixed, safe font size with generous margins
    textCtx.font = `bold ${fontSize}px "Times New Roman", serif`;
    console.log(`Using fixed font size: ${fontSize}px for reliable rendering`);
    
    // Draw text to hidden canvas - positioned much higher to avoid bottom cutoff
    textCtx.fillStyle = 'white';
    textCtx.fillText("Benson", cw / 2, ch / 2 - fontSize * 0.25); // Shifted up significantly
    
    // Get pixel data from text
    const imageData = textCtx.getImageData(0, 0, cw, ch);
    
    // Find text boundaries to ensure we have the complete text
    let minX = cw, minY = ch, maxX = 0, maxY = 0;
    let hasPixels = false;
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const index = (y * cw + x) * 4;
            if (imageData.data[index + 3] > 128) {
                hasPixels = true;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    if (!hasPixels) {
        console.error("No text pixels found! Please try again.");
        return;
    }
    
    console.log(`Text boundaries: (${minX},${minY}) to (${maxX},${maxY}), height: ${maxY - minY}px, width: ${maxX - minX}px`);
    
    // Create grid for even distribution
    const GRID_SIZE = 5; // Size of each grid cell (5x5 pixels)
    const grid = {};
    const validCells = [];
    
    // Collect valid pixels, organizing them into grid cells
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const index = (y * cw + x) * 4;
            if (imageData.data[index + 3] > 128) {
                // Calculate grid cell
                const cellX = Math.floor(x / GRID_SIZE);
                const cellY = Math.floor(y / GRID_SIZE);
                const cellKey = `${cellX},${cellY}`;
                
                // Track occupied cells
                if (!grid[cellKey]) {
                    grid[cellKey] = true;
                    validCells.push({
                        x: cellX * GRID_SIZE + GRID_SIZE / 2,
                        y: cellY * GRID_SIZE + GRID_SIZE / 2
                    });
                }
            }
        }
    }
    
    // Create particles from valid cells
    particles = [];
    
    // Make sure we don't exceed our target count
    const cellCount = validCells.length;
    const useEvery = Math.max(1, Math.floor(cellCount / TARGET_PARTICLE_COUNT));
    
    // Create particles from the grid cells for even distribution
    for (let i = 0; i < validCells.length; i += useEvery) {
        particles.push(new Particle(validCells[i].x, validCells[i].y));
        
        if (particles.length >= TARGET_PARTICLE_COUNT) break;
    }
    
    console.log(`Created ${particles.length} evenly distributed particles from ${validCells.length} grid cells`);
}

// Start formation animation when button is clicked
function startFormation() {
    // Save starting positions
    particles.forEach(p => {
        p.startX = p.x;
        p.startY = p.y;
    });
    
    animationState = 'forming';
    animationStartTime = Date.now();
    startBtn.classList.add('hidden');
    showAdditionalText = true; // Enable the additional text
}

// Animation loop
function animate(timestamp) {
    // Calculate elapsed time since last frame
    const elapsed = timestamp - lastTime;
    
    // Only render if enough time has passed for target frame rate
    if (elapsed > fpsInterval) {
        // Update time tracking
        lastTime = timestamp - (elapsed % fpsInterval);
        frameCount++;
        
        // Clear canvas
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, cw, ch);
        
        // Update particles based on animation state
        if (animationState === 'random') {
            // Random drifting before button click
            particles.forEach(p => p.updateRandom());
        } 
        else if (animationState === 'forming') {
            // Calculate animation progress
            const progress = Math.min(1.0, (Date.now() - animationStartTime) / FORMATION_DURATION);
            
            // Easing function for smooth animation
            const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
            
            // Update particles with interpolation
            particles.forEach(p => p.updateForming(easedProgress));
            
            // Fade in the additional text during formation
            textOpacity = easedProgress;
            
            // Check if animation is complete
            if (progress >= 1.0) {
                animationState = 'formed';
                textOpacity = 1.0; // Ensure text is fully visible
            }
        } 
        else if (animationState === 'formed') {
            // Interactive physics after formation
            particles.forEach(p => p.updateFormed());
        }
        
        // Draw all particles
        particles.forEach(p => p.draw());
        
        // Draw additional text if enabled
        if (showAdditionalText) {
            drawAdditionalText();
        }
    }
    
    // Continue animation loop
    requestAnimationFrame(animate);
}

// Draw the additional text
function drawAdditionalText() {
    ctx.save();
    
    // Calculate text position - centered horizontally, closer to the main text
    const textY = ch / 2.8; // Position closer to Benson (changed from ch/3.5)
    
    // Set text properties
    ctx.font = `bold 60px "Space Mono", "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Create glow effect
    ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
    ctx.shadowBlur = 10;
    
    // Set text color with opacity for fade-in effect
    ctx.fillStyle = `rgba(255, 255, 255, ${textOpacity})`;
    
    // Draw the text
    ctx.fillText(additionalText, cw / 2, textY);
    
    ctx.restore();
}

// Resize handler
function handleResize() {
    cw = window.innerWidth;
    ch = window.innerHeight;
    
    canvas.width = cw;
    canvas.height = ch;
    textCanvas.width = cw;
    textCanvas.height = ch;
    
    // Reinitialize particles on resize
    initText();
    
    // Reset to random state if resized before animation starts
    if (animationState === 'random' || !startBtn.classList.contains('hidden')) {
        animationState = 'random';
        startBtn.classList.remove('hidden');
    }
}

// Mouse move handler
function handleMouseMove(e) {
    mouse.x = e.clientX - canvas.offsetLeft;
    mouse.y = e.clientY - canvas.offsetTop;
}

// Mouse out handler
function handleMouseOut() {
    mouse.x = -1;
    mouse.y = -1;
}

// Touch move handler for mobile
function handleTouchMove(e) {
    e.preventDefault();
    mouse.x = e.touches[0].clientX - canvas.offsetLeft;
    mouse.y = e.touches[0].clientY - canvas.offsetTop;
}

// Set up event listeners
window.addEventListener('resize', handleResize);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseout', handleMouseOut);
window.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleMouseOut);

// Button click event
startBtn.addEventListener('click', startFormation);

// Info box close button
if (closeInfoBtn) {
    closeInfoBtn.addEventListener('click', function() {
        infoBox.style.display = 'none';
    });
}

// Initialize
handleResize();
lastTime = performance.now();
animate(lastTime);