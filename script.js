const MAX_HISTORY = 10;
let activeSwatchId = null;
let viewMode = 'grid'; // 'grid', 'rows', 'cols'
let activeCopyStyle = 'raw'; // 'raw', 'css', 'json'

// Gamut Mask State Variables
let wheelDragMode = 'color'; // 'color' or 'mask'
let constrainToGamut = false;
let maskRotation = 0; // degrees
let maskScale = 1.0; // multiplier scale factor

class PaletteManager {
    constructor() {
        this.colors = [];
        this.globalHistory = [];
        this.globalHistoryIndex = -1;
    }
    init(initialCount = 5) {
        this.colors = [];
        for(let i=0; i<initialCount; i++) {
            this.colors.push(this.createSwatch(generateRandomHex()));
        }
        this.saveGlobalState();
    }
    createSwatch(hex) {
        return {
            id: 'swatch_' + Date.now() + '_' + Math.floor(Math.random()*10000),
            hex: hex.toUpperCase(),
            locked: false,
            history: [hex.toUpperCase()],
            hIndex: 0
        };
    }
    saveGlobalState() {
        if(this.globalHistoryIndex < this.globalHistory.length - 1) {
            this.globalHistory = this.globalHistory.slice(0, this.globalHistoryIndex + 1);
        }
        const snapshot = JSON.stringify(this.colors);
        if(this.globalHistory.length > 0 && this.globalHistory[this.globalHistoryIndex] === snapshot) return;

        this.globalHistory.push(snapshot);
        if(this.globalHistory.length > MAX_HISTORY + 1) this.globalHistory.shift();
        else this.globalHistoryIndex++;
        updateToolbarUI();
    }
    undoGlobal() {
        if (this.globalHistoryIndex > 0) {
            this.globalHistoryIndex--;
            this.colors = JSON.parse(this.globalHistory[this.globalHistoryIndex]);
            renderPalette();
            updateToolbarUI();
        }
    }
    redoGlobal() {
        if (this.globalHistoryIndex < this.globalHistory.length - 1) {
            this.globalHistoryIndex++;
            this.colors = JSON.parse(this.globalHistory[this.globalHistoryIndex]);
            renderPalette();
            updateToolbarUI();
        }
    }
    saveLocalState(id, newHex) {
        const s = this.colors.find(c => c.id === id);
        if(!s) return;
        newHex = newHex.toUpperCase();
        if(s.history[s.hIndex] === newHex) return;
        
        if(s.hIndex < s.history.length - 1) s.history = s.history.slice(0, s.hIndex + 1);
        s.history.push(newHex);
        if(s.history.length > MAX_HISTORY + 1) s.history.shift();
        else s.hIndex++;
        s.hex = newHex;
    }
    undoLocal(id) {
        const s = this.colors.find(c => c.id === id);
        if(s && s.hIndex > 0) {
            s.hIndex--;
            s.hex = s.history[s.hIndex];
            this.saveGlobalState();
            renderPalette();
        }
    }
    redoLocal(id) {
        const s = this.colors.find(c => c.id === id);
        if(s && s.hIndex < s.history.length - 1) {
            s.hIndex++;
            s.hex = s.history[s.hIndex];
            this.saveGlobalState();
            renderPalette();
        }
    }
}

const pm = new PaletteManager();

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = message;
    toast.classList.remove('opacity-0');
    setTimeout(() => toast.classList.add('opacity-0'), 2200);
}

function copyToClipboard(text) {
    const success = () => showToast(`Copied!`);
    const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            document.execCommand('copy');
            success();
        } catch (err) { console.error('Copy failed', err); }
        document.body.removeChild(ta);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(success).catch(() => fallback());
    } else {
        fallback();
    }
}

const copyModal = document.getElementById('copy-modal');
document.getElementById('btn-copy-all').addEventListener('click', () => {
    copyModal.classList.remove('hidden');
    setTimeout(() => copyModal.classList.remove('opacity-0'), 10);
});
document.getElementById('btn-close-copy').addEventListener('click', () => {
    copyModal.classList.add('opacity-0');
    setTimeout(() => copyModal.classList.add('hidden'), 300);
});

// Copy style selection buttons
document.querySelectorAll('.copy-style-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.copy-style-btn').forEach(b => {
            b.classList.remove('border-blue-500', 'bg-blue-600/30', 'text-blue-300');
            b.classList.add('border-gray-700', 'bg-gray-900', 'text-gray-300');
        });
        const target = e.currentTarget;
        target.classList.remove('border-gray-700', 'bg-gray-900', 'text-gray-300');
        target.classList.add('border-blue-500', 'bg-blue-600/30', 'text-blue-300');
        activeCopyStyle = target.dataset.style;
    });
});

// Copy action buttons (HEX, RGB, HSL, CMYK)
document.querySelectorAll('.btn-copy-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        const hexes = pm.colors.map(c => c.hex);
        let formattedItems = [];

        hexes.forEach((h, i) => {
            const rgb = hexToRgb(h);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);

            let val = '';
            if (type === 'hex') val = `${h}`;
            else if (type === 'rgb') val = `(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            else if (type === 'hsl') val = `(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
            else if (type === 'cmyk') val = `(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;

            if (activeCopyStyle === 'css') {
                let cssVal = val;
                if (type === 'rgb') cssVal = `rgb${val}`;
                else if (type === 'hsl') cssVal = `hsl${val}`;
                else if (type === 'cmyk') cssVal = `cmyk${val}`;
                formattedItems.push(`  --color-${i+1}: ${cssVal};`);
            } else {
                formattedItems.push(val);
            }
        });

        let output = '';
        if (activeCopyStyle === 'css') {
            output = `:root {\n` + formattedItems.join('\n') + `\n}`;
        } else if (activeCopyStyle === 'json') {
            output = JSON.stringify(formattedItems, null, 2);
        } else {
            output = formattedItems.join(', ');
        }

        copyToClipboard(output);
        copyModal.classList.add('opacity-0');
        setTimeout(() => copyModal.classList.add('hidden'), 300);
    });
});

function generateRandomHex() {
    return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase();
}

function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if(h.length === 3) h = h.split('').map(c => c+c).join('');
    const r = parseInt(h.substring(0,2), 16) || 0;
    const g = parseInt(h.substring(2,4), 16) || 0;
    const b = parseInt(h.substring(4,6), 16) || 0;
    return {r, g, b};
}

function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) h = s = 0;
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) r = g = b = l;
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToCmyk(r, g, b) {
    let c = 1 - (r / 255);
    let m = 1 - (g / 255);
    let y = 1 - (b / 255);
    let k = Math.min(c, Math.min(m, y));
    if (k === 1) c = m = y = 0;
    else {
        c = (c - k) / (1 - k); m = (m - k) / (1 - k); y = (y - k) / (1 - k);
    }
    return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
}

function cmykToRgb(c, m, y, k) {
    c /= 100; m /= 100; y /= 100; k /= 100;
    const r = 255 * (1 - c) * (1 - k);
    const g = 255 * (1 - m) * (1 - k);
    const b = 255 * (1 - y) * (1 - k);
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

function getContrastColor(hex) {
    const { r, g, b } = hexToRgb(hex);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

const container = document.getElementById('palette-container');
let dragSrcEl = null;

function applyLayoutMode() {
    const btnLayoutIcon = document.getElementById('icon-layout');
    const btnLayoutLabel = document.getElementById('label-layout');

    let baseClass = "flex-1 flex w-full h-[calc(100vh-3.5rem)] transition-all duration-300 overflow-y-auto hide-scroll ";
    container.className = baseClass;

    if (viewMode === 'rows') {
        container.classList.add('mode-rows');
        btnLayoutIcon.className = 'fa-solid fa-bars';
        btnLayoutLabel.innerText = 'Rows';
    } else if (viewMode === 'cols') {
        container.classList.add('mode-cols');
        btnLayoutIcon.className = 'fa-solid fa-table-columns';
        btnLayoutLabel.innerText = 'Cols';
    } else {
        container.classList.add('mode-grid');
        btnLayoutIcon.className = 'fa-solid fa-border-all';
        btnLayoutLabel.innerText = 'Grid';
    }
}

document.getElementById('
