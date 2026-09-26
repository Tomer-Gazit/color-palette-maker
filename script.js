const MAX_HISTORY = 10;
        let activeSwatchId = null;
        let viewMode = 'grid'; // 'grid', 'rows', 'columns'
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

        document.getElementById('btn-toggle-layout').addEventListener('click', () => {
            if (viewMode === 'grid') viewMode = 'rows';
            else if (viewMode === 'rows') viewMode = 'cols';
            else viewMode = 'grid';
            renderPalette();
        });

        window.addEventListener('resize', () => {
            if (viewMode === 'grid') renderPalette();
            updateExportDimPreview();
        });

        function renderPalette() {
            container.innerHTML = '';
            applyLayoutMode();
            
            const total = pm.colors.length;
            const cols = Math.ceil(Math.sqrt(total));

            const countBadge = document.getElementById('color-count-badge');
            if (countBadge) countBadge.innerText = `${total} colors`;

            pm.colors.forEach((swatch) => {
                const textCol = getContrastColor(swatch.hex);
                const isLocked = swatch.locked;
                const rgb = hexToRgb(swatch.hex);
                const rgbStr = `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                
                const colDiv = document.createElement('div');
                colDiv.dataset.id = swatch.id;
                colDiv.draggable = true;

                if (viewMode === 'rows') {
                    // Optimized Row layout for high visibility
                    colDiv.className = `swatch-container relative group cursor-pointer flex flex-row items-center justify-between px-3 sm:px-6 py-2 border border-transparent hover:border-white/20 transition-all select-none overflow-hidden shrink-0 w-full rounded-lg shadow-sm`;
                    colDiv.style.backgroundColor = swatch.hex;
                    colDiv.style.color = textCol;
                    colDiv.style.flex = '0 0 auto';
                    colDiv.style.minHeight = '70px';

                    colDiv.innerHTML = `
                        <div class="flex items-center gap-2 sm:gap-3 shrink-0 z-10 pointer-events-auto">
                            <div class="drag-handle cursor-grab active:cursor-grabbing text-xs opacity-70 hover:opacity-100 p-1 rounded hover:bg-black/10" title="Drag to reorder">
                                <i class="fa-solid fa-grip-vertical text-sm"></i>
                            </div>
                            <button class="btn-lock p-1.5 sm:p-2 bg-black/20 hover:bg-black/40 rounded-lg transition-all" title="${isLocked ? 'Unlock' : 'Lock'}">
                                <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-lock-open'} text-xs"></i>
                            </button>
                        </div>

                        <div class="flex items-center gap-4 sm:gap-8 flex-1 justify-center px-2 min-w-0 pointer-events-auto">
                            <div class="click-copy-hex cursor-pointer select-none transition-transform active:scale-95" title="Click to copy HEX">
                                <span class="font-bold font-mono tracking-wider text-base sm:text-2xl uppercase">
                                    ${swatch.hex}
                                </span>
                            </div>
                            <div class="font-mono text-xs sm:text-sm tracking-wider opacity-90 hidden sm:block">
                                ${rgbStr}
                            </div>
                        </div>

                        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0 z-10 pointer-events-auto">
                            <div class="flex items-center bg-black/20 rounded-lg p-0.5 border border-white/10">
                                <button class="btn-undo-local p-1 sm:p-1.5 hover:bg-black/30 rounded transition-all ${swatch.hIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'}" ${swatch.hIndex === 0 ? 'disabled' : ''} title="Undo">
                                    <i class="fa-solid fa-rotate-left text-xs"></i>
                                </button>
                                <div class="w-px h-3 bg-white/20 mx-0.5"></div>
                                <button class="btn-redo-local p-1 sm:p-1.5 hover:bg-black/30 rounded transition-all ${swatch.hIndex === swatch.history.length - 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'}" ${swatch.hIndex === swatch.history.length - 1 ? 'disabled' : ''} title="Redo">
                                    <i class="fa-solid fa-rotate-right text-xs"></i>
                                </button>
                            </div>
                            <button class="btn-inspect p-1.5 sm:p-2 bg-black/20 hover:bg-black/40 rounded-lg transition-all" title="Inspector">
                                <i class="fa-solid fa-sliders text-xs"></i>
                            </button>
                            <button class="btn-random-local p-1.5 sm:p-2 bg-black/20 hover:bg-black/40 rounded-lg transition-all" title="Randomize">
                                <i class="fa-solid fa-shuffle text-xs"></i>
                            </button>
                            <button class="btn-remove p-1.5 sm:p-2 bg-black/20 hover:bg-black/40 rounded-lg transition-all" title="Remove color">
                                <i class="fa-solid fa-xmark text-xs"></i>
                            </button>
                        </div>
                    `;
                } else {
                    // Grid / Cols layout
                    colDiv.className = `swatch-container relative group cursor-pointer flex flex-col items-center justify-between p-1.5 sm:p-3 border border-transparent hover:border-white/20 transition-all select-none overflow-hidden shrink-0`;
                    colDiv.style.backgroundColor = swatch.hex;
                    colDiv.style.color = textCol;

                    if (viewMode === 'cols') {
                        colDiv.style.height = '100%';
                        colDiv.style.flex = '0 0 120px';
                    } else {
                        const baseWidthPercent = 100 / cols;
                        colDiv.style.flex = `1 1 calc(${baseWidthPercent}% - 4px)`;
                        colDiv.style.minHeight = '110px';
                    }

                    colDiv.innerHTML = `
                        <div class="flex justify-between w-full shrink-0 z-10 pointer-events-auto items-center">
                            <button class="btn-remove p-1 sm:p-1.5 bg-black/20 hover:bg-black/40 rounded-lg transition-all" title="Remove color">
                                <i class="fa-solid fa-xmark text-xs"></i>
                            </button>
                            <div class="flex items-center gap-1">
                                <button class="btn-inspect p-1 sm:p-1.5 bg-black/20 hover:bg-black/40 rounded-lg transition-all" title="Inspector">
                                    <i class="fa-solid fa-sliders text-xs"></i>
                                </button>
                                <button class="btn-lock p-1 sm:p-1.5 bg-black/20 hover:bg-black/40 rounded-lg transition-all" title="${isLocked ? 'Unlock' : 'Lock'}">
                                    <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-lock-open'} text-xs"></i>
                                </button>
                            </div>
                        </div>

                        <div class="flex flex-col items-center justify-center flex-1 my-0.5 text-center w-full px-1 min-h-0 overflow-hidden pointer-events-auto">
                            <div class="drag-handle cursor-grab active:cursor-grabbing text-xs opacity-60 hover:opacity-100 mb-0.5 p-0.5 rounded hover:bg-black/10 hidden sm:block" title="Drag to reorder">
                                <i class="fa-solid fa-grip text-xs"></i>
                            </div>
                            <div class="click-copy-hex cursor-pointer my-0.5 select-none transition-transform active:scale-95" title="Click to copy HEX">
                                <span class="font-bold uppercase tracking-wider leading-none break-all" style="font-size: clamp(0.75rem, 2vw, 1.3rem);">
                                    ${swatch.hex}
                                </span>
                            </div>
                            <div class="font-mono tracking-wider opacity-80 mt-0.5 break-all max-w-full text-center" style="font-size: clamp(0.55rem, 1vw, 0.72rem);">
                                ${rgbStr}
                            </div>
                        </div>

                        <div class="flex justify-between w-full shrink-0 z-10 pointer-events-auto items-center">
                            <div class="flex items-center bg-black/20 rounded-lg p-0.5 border border-white/10">
                                <button class="btn-undo-local p-1 hover:bg-black/30 rounded transition-all ${swatch.hIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'}" ${swatch.hIndex === 0 ? 'disabled' : ''} title="Undo">
                                    <i class="fa-solid fa-rotate-left text-[10px]"></i>
                                </button>
                                <div class="w-px h-3 bg-white/20 mx-0.5"></div>
                                <button class="btn-redo-local p-1 hover:bg-black/30 rounded transition-all ${swatch.hIndex === swatch.history.length - 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'}" ${swatch.hIndex === swatch.history.length - 1 ? 'disabled' : ''} title="Redo">
                                    <i class="fa-solid fa-rotate-right text-[10px]"></i>
                                </button>
                            </div>
                            <button class="btn-random-local p-1 sm:p-1.5 bg-black/20 hover:bg-black/40 rounded-lg transition-all" title="Randomize">
                                <i class="fa-solid fa-shuffle text-xs"></i>
                            </button>
                        </div>
                    `;
                }

                colDiv.addEventListener('click', (e) => {
                    const targetBtn = e.target.closest('button, .drag-handle, .click-copy-hex');
                    if (targetBtn) {
                        if (targetBtn.classList.contains('btn-remove')) {
                            if(pm.colors.length > 1) {
                                pm.colors = pm.colors.filter(c => c.id !== swatch.id);
                                pm.saveGlobalState();
                                renderPalette();
                            } else showToast("Need at least one color!");
                        } else if (targetBtn.classList.contains('btn-lock')) {
                            swatch.locked = !swatch.locked;
                            pm.saveGlobalState();
                            renderPalette();
                        } else if (targetBtn.classList.contains('btn-inspect')) {
                            openInspector(swatch.id);
                        } else if (targetBtn.classList.contains('click-copy-hex')) {
                            copyToClipboard(swatch.hex);
                        } else if (targetBtn.classList.contains('btn-random-local')) {
                            pm.saveLocalState(swatch.id, generateRandomHex());
                            pm.saveGlobalState();
                            renderPalette();
                        } else if (targetBtn.classList.contains('btn-undo-local')) {
                            pm.undoLocal(swatch.id);
                        } else if (targetBtn.classList.contains('btn-redo-local')) {
                            pm.redoLocal(swatch.id);
                        }
                        return;
                    }
                    openInspector(swatch.id);
                });

                colDiv.addEventListener('dragstart', handleDragStart);
                colDiv.addEventListener('dragover', handleDragOver);
                colDiv.addEventListener('dragenter', (e) => e.preventDefault());
                colDiv.addEventListener('dragleave', handleDragLeave);
                colDiv.addEventListener('drop', handleDrop);
                colDiv.addEventListener('dragend', handleDragEnd);

                attachTouchDragListeners(colDiv);
                container.appendChild(colDiv);
            });
        }

        let dropMode = null; 
        let currentDropTarget = null;

        function clearDragIndicators() {
            document.querySelectorAll('.swatch-container').forEach(col => {
                col.classList.remove('drop-swap', 'drop-before-col', 'drop-after-col', 'drop-before-row', 'drop-after-row');
            });
            dropMode = null;
            currentDropTarget = null;
        }

        function determineDropMode(el, clientX, clientY) {
            const rect = el.getBoundingClientRect();
            const relX = (clientX - rect.left) / rect.width;
            const relY = (clientY - rect.top) / rect.height;
            let mode = 'swap';
            if (viewMode === 'rows') {
                if (relY < 0.25) mode = 'insert-before';
                else if (relY > 0.75) mode = 'insert-after';
            } else if (viewMode === 'cols') {
                if (relX < 0.25) mode = 'insert-before';
                else if (relX > 0.75) mode = 'insert-after';
            } else {
                if (relY < 0.25 || relX < 0.25) mode = 'insert-before';
                else if (relY > 0.75 || relX > 0.75) mode = 'insert-after';
            }
            return mode;
        }

        function highlightDropTarget(el, mode) {
            clearDragIndicators();
            if (!el || el === dragSrcEl) return;
            dropMode = mode;
            currentDropTarget = el;
            const isVertical = (viewMode === 'rows');
            if (mode === 'swap') el.classList.add('drop-swap');
            else if (mode === 'insert-before') el.classList.add(isVertical ? 'drop-before-row' : 'drop-before-col');
            else if (mode === 'insert-after') el.classList.add(isVertical ? 'drop-after-row' : 'drop-after-col');
        }

        function handleDragStart(e) {
            dragSrcEl = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dataset.id);
            this.classList.add('dragging');
        }
        function handleDragOver(e) {
            if (e.preventDefault) e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this === dragSrcEl) return false;
            highlightDropTarget(this, determineDropMode(this, e.clientX, e.clientY));
            return false;
        }
        function handleDragLeave(e) { if (e.target === this) clearDragIndicators(); }
        function handleDrop(e) {
            if (e.stopPropagation) e.stopPropagation();
            if (dragSrcEl && currentDropTarget && dragSrcEl !== currentDropTarget) {
                const srcIndex = pm.colors.findIndex(c => c.id === dragSrcEl.dataset.id);
                const tgtIndex = pm.colors.findIndex(c => c.id === currentDropTarget.dataset.id);

                if (srcIndex !== -1 && tgtIndex !== -1) {
                    if (dropMode === 'swap') {
                        const temp = pm.colors[srcIndex];
                        pm.colors[srcIndex] = pm.colors[tgtIndex];
                        pm.colors[tgtIndex] = temp;
                    } else if (dropMode === 'insert-before') {
                        const [item] = pm.colors.splice(srcIndex, 1);
                        let insertAt = pm.colors.findIndex(c => c.id === currentDropTarget.dataset.id);
                        pm.colors.splice(insertAt, 0, item);
                    } else if (dropMode === 'insert-after') {
                        const [item] = pm.colors.splice(srcIndex, 1);
                        let insertAt = pm.colors.findIndex(c => c.id === currentDropTarget.dataset.id);
                        pm.colors.splice(insertAt + 1, 0, item);
                    }
                    pm.saveGlobalState();
                    renderPalette();
                }
            }
            clearDragIndicators();
            return false;
        }
        function handleDragEnd(e) { this.classList.remove('dragging'); clearDragIndicators(); }

        let touchDraggedEl = null;
        function attachTouchDragListeners(colDiv) {
            const dragHandle = colDiv.querySelector('.drag-handle');
            if (!dragHandle) return;

            dragHandle.addEventListener('touchstart', (e) => {
                touchDraggedEl = colDiv;
                dragSrcEl = colDiv;
                colDiv.classList.add('dragging');
            }, { passive: true });

            dragHandle.addEventListener('touchmove', (e) => {
                if (!touchDraggedEl) return;
                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const swatchTarget = target ? target.closest('.swatch-container') : null;

                if (swatchTarget && swatchTarget !== touchDraggedEl) {
                    highlightDropTarget(swatchTarget, determineDropMode(swatchTarget, touch.clientX, touch.clientY));
                } else clearDragIndicators();
            }, { passive: true });

            dragHandle.addEventListener('touchend', (e) => {
                if (touchDraggedEl && currentDropTarget && dropMode) handleDrop(e);
                if (touchDraggedEl) touchDraggedEl.classList.remove('dragging');
                touchDraggedEl = null;
                clearDragIndicators();
            });
        }

        function handleAddColor() {
            addNewColor();
        }
        function addNewColor() {
            pm.colors.push(pm.createSwatch(generateRandomHex()));
            pm.saveGlobalState();
            renderPalette();
        }

        document.getElementById('btn-add').addEventListener('click', handleAddColor);
        document.getElementById('btn-random-all').addEventListener('click', randomizeUnlocked);
        
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') {
                e.preventDefault(); randomizeUnlocked();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) pm.redoGlobal();
                else pm.undoGlobal();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault(); pm.redoGlobal();
            }
        });

        function randomizeUnlocked() {
            let changed = false;
            pm.colors.forEach(c => {
                if(!c.locked) { pm.saveLocalState(c.id, generateRandomHex()); changed = true; }
            });
            if(changed) { pm.saveGlobalState(); renderPalette(); }
        }

        document.getElementById('btn-undo-global').addEventListener('click', () => pm.undoGlobal());
        document.getElementById('btn-redo-global').addEventListener('click', () => pm.redoGlobal());

        function updateToolbarUI() {
            const btnUndo = document.getElementById('btn-undo-global');
            const btnRedo = document.getElementById('btn-redo-global');
            if (btnUndo) btnUndo.disabled = (pm.globalHistoryIndex <= 0);
            if (btnRedo) btnRedo.disabled = (pm.globalHistoryIndex >= pm.globalHistory.length - 1);
        }

        const inspectorModal = document.getElementById('inspector-modal');
        const btnCloseInspector = document.getElementById('btn-close-inspector');
        const tabPicker = document.getElementById('tab-picker');
        const tabHarmony = document.getElementById('tab-harmony');
        const contentPicker = document.getElementById('content-picker');
        const contentHarmony = document.getElementById('content-harmony');

        const nativeColorPicker = document.getElementById('native-color-picker');
        const inputHex = document.getElementById('input-hex');
        const inputR = document.getElementById('input-r'), inputG = document.getElementById('input-g'), inputB = document.getElementById('input-b');
        const inputH = document.getElementById('input-h'), inputS = document.getElementById('input-s'), inputL = document.getElementById('input-l');
        const inputC = document.getElementById('input-c'), inputM = document.getElementById('input-m'), inputY = document.getElementById('input-y'), inputK = document.getElementById('input-k');
        
        let inspectorOriginalHex = '';
        let inspectorCurrentHex = '';
        let inspectorCurrentHSL = {h: 0, s: 100, l: 50};

        function openInspector(id) {
            activeSwatchId = id;
            const swatch = pm.colors.find(c => c.id === id);
            if (!swatch) return;
            
            inspectorOriginalHex = swatch.hex;
            document.getElementById('inspector-original-preview').style.backgroundColor = inspectorOriginalHex;
            
            updateInspectorState(swatch.hex);
            inspectorModal.classList.remove('hidden');
            setTimeout(() => inspectorModal.classList.remove('opacity-0'), 10);
            switchInspectorTab('picker');
        }

        function closeInspector() {
            inspectorModal.classList.add('opacity-0');
            setTimeout(() => inspectorModal.classList.add('hidden'), 300);
        }

        function switchInspectorTab(tab) {
            if (tab === 'picker') {
                tabPicker.className = 'flex-1 py-3 px-2 text-center text-sm font-semibold text-blue-400 border-b-2 border-blue-400 transition-colors flex items-center justify-center gap-2';
                tabHarmony.className = 'flex-1 py-3 px-2 text-center text-sm font-semibold text-gray-400 border-b-2 border-transparent hover:text-white transition-colors flex items-center justify-center gap-2';
                contentPicker.classList.remove('hidden');
                contentHarmony.classList.add('hidden'); contentHarmony.classList.remove('flex');
            } else {
                tabHarmony.className = 'flex-1 py-3 px-2 text-center text-sm font-semibold text-blue-400 border-b-2 border-blue-400 transition-colors flex items-center justify-center gap-2';
                tabPicker.className = 'flex-1 py-3 px-2 text-center text-sm font-semibold text-gray-400 border-b-2 border-transparent hover:text-white transition-colors flex items-center justify-center gap-2';
                contentPicker.classList.add('hidden');
                contentHarmony.classList.remove('hidden'); contentHarmony.classList.add('flex');

                if (inspectorCurrentHex) { drawWheelAndMask(); generateHarmonies(inspectorCurrentHex); }
            }
        }

        function updateInspectorValuesUI(hex) {
            hex = hex.toUpperCase();
            const rgb = hexToRgb(hex), hsl = rgbToHsl(rgb.r, rgb.g, rgb.b), cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
            if (nativeColorPicker) nativeColorPicker.value = hex;
            if (inputHex && document.activeElement !== inputHex) inputHex.value = hex.replace('#', '');
            if (inputR && document.activeElement !== inputR) inputR.value = rgb.r;
            if (inputG && document.activeElement !== inputG) inputG.value = rgb.g;
            if (inputB && document.activeElement !== inputB) inputB.value = rgb.b;
            if (inputH && document.activeElement !== inputH) inputH.value = hsl.h;
            if (inputS && document.activeElement !== inputS) inputS.value = hsl.s;
            if (inputL && document.activeElement !== inputL) inputL.value = hsl.l;
            if (inputC && document.activeElement !== inputC) inputC.value = cmyk.c;
            if (inputM && document.activeElement !== inputM) inputM.value = cmyk.m;
            if (inputY && document.activeElement !== inputY) inputY.value = cmyk.y;
            if (inputK && document.activeElement !== inputK) inputK.value = cmyk.k;
        }

        function updateInspectorState(newHex) {
            inspectorCurrentHex = newHex.toUpperCase();
            document.getElementById('inspector-new-preview').style.backgroundColor = inspectorCurrentHex;
            
            const rgb = hexToRgb(inspectorCurrentHex);
            inspectorCurrentHSL = rgbToHsl(rgb.r, rgb.g, rgb.b);
            
            updateInspectorValuesUI(inspectorCurrentHex);

            if (!contentHarmony.classList.contains('hidden')) {
                drawWheelAndMask();
                generateHarmonies(inspectorCurrentHex);
            }
        }

        if (btnCloseInspector) btnCloseInspector.addEventListener('click', closeInspector);
        document.getElementById('btn-inspector-cancel').addEventListener('click', closeInspector);
        document.getElementById('btn-inspector-accept').addEventListener('click', () => {
            if (activeSwatchId) {
                const swatch = pm.colors.find(c => c.id === activeSwatchId);
                if (swatch && swatch.hex !== inspectorCurrentHex) {
                    swatch.hex = inspectorCurrentHex;
                    pm.saveLocalState(swatch.id, inspectorCurrentHex);
                    pm.saveGlobalState();
                    renderPalette();
                }
            }
            closeInspector();
        });

        if (tabPicker) tabPicker.addEventListener('click', () => switchInspectorTab('picker'));
        if (tabHarmony) tabHarmony.addEventListener('click', () => switchInspectorTab('harmony'));

        if (nativeColorPicker) nativeColorPicker.addEventListener('input', (e) => updateInspectorState(e.target.value));
        if (inputHex) {
            inputHex.addEventListener('input', (e) => {
                let val = e.target.value.replace('#', '');
                if (val.length === 6 && /^[0-9A-Fa-f]{6}$/.test(val)) updateInspectorState('#' + val);
            });
        }

        const clamp = (val, max) => Math.min(max, Math.max(0, parseInt(val) || 0));
        [inputR, inputG, inputB].forEach(el => el && el.addEventListener('input', () => updateInspectorState(rgbToHex(clamp(inputR.value, 255), clamp(inputG.value, 255), clamp(inputB.value, 255)))));
        [inputH, inputS, inputL].forEach(el => el && el.addEventListener('input', () => { const rgb = hslToRgb(clamp(inputH.value, 360), clamp(inputS.value, 100), clamp(inputL.value, 100)); updateInspectorState(rgbToHex(rgb.r, rgb.g, rgb.b)); }));
        [inputC, inputM, inputY, inputK].forEach(el => el && el.addEventListener('input', () => { const rgb = cmykToRgb(clamp(inputC.value, 100), clamp(inputM.value, 100), clamp(inputY.value, 100), clamp(inputK.value, 100)); updateInspectorState(rgbToHex(rgb.r, rgb.g, rgb.b)); }));

        // Hold-to-Tick Stepper functionality
        let stepTimer = null;
        let stepInterval = null;

        function doStep(targetId, step) {
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;

            const min = parseInt(targetInput.min) || 0;
            const max = parseInt(targetInput.max) || 255;
            let val = parseInt(targetInput.value) || 0;
            val = Math.min(max, Math.max(min, val + step));
            targetInput.value = val;

            if (['input-r', 'input-g', 'input-b'].includes(targetId)) {
                updateInspectorState(rgbToHex(clamp(inputR.value, 255), clamp(inputG.value, 255), clamp(inputB.value, 255)));
            } else if (['input-h', 'input-s', 'input-l'].includes(targetId)) {
                const rgb = hslToRgb(clamp(inputH.value, 360), clamp(inputS.value, 100), clamp(inputL.value, 100));
                updateInspectorState(rgbToHex(rgb.r, rgb.g, rgb.b));
            } else if (['input-c', 'input-m', 'input-y', 'input-k'].includes(targetId)) {
                const rgb = cmykToRgb(clamp(inputC.value, 100), clamp(inputM.value, 100), clamp(inputY.value, 100), clamp(inputK.value, 100));
                updateInspectorState(rgbToHex(rgb.r, rgb.g, rgb.b));
            }
        }

        function stopStepping() {
            if (stepTimer) clearTimeout(stepTimer);
            if (stepInterval) clearInterval(stepInterval);
            stepTimer = null;
            stepInterval = null;
        }

        document.querySelectorAll('.btn-step').forEach(btn => {
            const startStepping = (e) => {
                e.preventDefault();
                const targetId = btn.dataset.target;
                const step = parseInt(btn.dataset.step) || 1;
                doStep(targetId, step);

                stepTimer = setTimeout(() => {
                    stepInterval = setInterval(() => {
                        doStep(targetId, step);
                    }, 60);
                }, 300);
            };

            btn.addEventListener('mousedown', startStepping);
            btn.addEventListener('touchstart', startStepping, { passive: false });
            btn.addEventListener('mouseup', stopStepping);
            btn.addEventListener('mouseleave', stopStepping);
            btn.addEventListener('touchend', stopStepping);
            btn.addEventListener('touchcancel', stopStepping);
        });

        // Drag & Drop Values to Switch (Channel Swap)
        let draggedChannelEl = null;

        document.querySelectorAll('.channel-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedChannelEl = card;
                e.dataTransfer.setData('text/plain', card.dataset.channel);
                card.style.opacity = '0.5';
            });

            card.addEventListener('dragend', () => {
                if (draggedChannelEl) draggedChannelEl.style.opacity = '1';
                draggedChannelEl = null;
                document.querySelectorAll('.channel-card').forEach(c => c.classList.remove('drag-over-channel'));
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedChannelEl || draggedChannelEl === card) return;
                
                // Allow swap if in same group or same range group
                const srcGroup = draggedChannelEl.dataset.group;
                const tgtGroup = card.dataset.group;
                if (srcGroup === tgtGroup) {
                    card.classList.add('drag-over-channel');
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over-channel');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over-channel');
                if (!draggedChannelEl || draggedChannelEl === card) return;

                const srcChan = draggedChannelEl.dataset.channel;
                const tgtChan = card.dataset.channel;
                const group = card.dataset.group;

                if (draggedChannelEl.dataset.group !== group) return;

                const srcInput = document.getElementById(`input-${srcChan}`);
                const tgtInput = document.getElementById(`input-${tgtChan}`);

                if (srcInput && tgtInput) {
                    const temp = srcInput.value;
                    srcInput.value = tgtInput.value;
                    tgtInput.value = temp;

                    showToast(`Swapped ${srcChan.toUpperCase()} ⇄ ${tgtChan.toUpperCase()}`);

                    if (group === 'rgb') {
                        updateInspectorState(rgbToHex(clamp(inputR.value, 255), clamp(inputG.value, 255), clamp(inputB.value, 255)));
                    } else if (group === 'hsl') {
                        const rgb = hslToRgb(clamp(inputH.value, 360), clamp(inputS.value, 100), clamp(inputL.value, 100));
                        updateInspectorState(rgbToHex(rgb.r, rgb.g, rgb.b));
                    } else if (group === 'cmyk') {
                        const rgb = cmykToRgb(clamp(inputC.value, 100), clamp(inputM.value, 100), clamp(inputY.value, 100), clamp(inputK.value, 100));
                        updateInspectorState(rgbToHex(rgb.r, rgb.g, rgb.b));
                    }
                }
            });
        });

        const canvasWheel = document.getElementById('color-wheel');
        const ctxWheel = canvasWheel ? canvasWheel.getContext('2d') : null;
        const wheelOverlay = document.getElementById('wheel-overlay');
        const harmonyTypeSel = document.getElementById('harmony-type');
        const gamutMaskSel = document.getElementById('gamut-mask-type');
        const wheelRingModeSel = document.getElementById('wheel-ring-mode');
        const harmonyResults = document.getElementById('harmony-results');

        const btnModeColor = document.getElementById('btn-mode-color');
        const btnModeMask = document.getElementById('btn-mode-mask');
        const toggleConstrainGamut = document.getElementById('toggle-constrain-gamut');
        const maskModeHint = document.getElementById('mask-mode-hint');

        let isDraggingWheel = false;

        btnModeColor.addEventListener('click', () => setWheelMode('color'));
        btnModeMask.addEventListener('click', () => setWheelMode('mask'));

        function setWheelMode(mode) {
            wheelDragMode = mode;
            if (mode === 'color') {
                btnModeColor.className = 'px-3 py-1 text-xs font-bold rounded-md bg-blue-600 text-white transition-all flex items-center gap-1.5 shadow';
                btnModeMask.className = 'px-3 py-1 text-xs font-bold rounded-md text-gray-400 hover:text-white transition-all flex items-center gap-1.5';
                maskModeHint.innerText = 'Click & Drag to pick color';
                maskModeHint.className = 'text-[11px] font-mono text-blue-400';
            } else {
                btnModeMask.className = 'px-3 py-1 text-xs font-bold rounded-md bg-indigo-600 text-white transition-all flex items-center gap-1.5 shadow';
                btnModeColor.className = 'px-3 py-1 text-xs font-bold rounded-md text-gray-400 hover:text-white transition-all flex items-center gap-1.5';
                maskModeHint.innerText = 'Drag on wheel to Rotate & Resize Mask';
                maskModeHint.className = 'text-[11px] font-mono text-indigo-400';
            }
        }

        toggleConstrainGamut.addEventListener('change', (e) => {
            constrainToGamut = e.target.checked;
            if (inspectorCurrentHex) { drawWheelAndMask(); }
        });

        [harmonyTypeSel, gamutMaskSel, wheelRingModeSel].forEach(el => {
            el.addEventListener('change', () => {
                if (inspectorCurrentHex) { drawWheelAndMask(); generateHarmonies(inspectorCurrentHex); }
            });
        });

        function isPointInGamutMask(angle, distNorm, maskType) {
            if (maskType === 'none') return true;
            
            let relAngle = (angle - maskRotation + 360) % 360;
            if (relAngle > 180) relAngle -= 360;

            const maxDist = 0.95 * maskScale;

            if (maskType === 'wedge') {
                const halfAngle = 45 * maskScale;
                return Math.abs(relAngle) <= halfAngle && distNorm <= maxDist;
            } else if (maskType === 'bar') {
                const halfAngle = 25;
                const oppositeAngle = Math.abs(relAngle) > 90 ? (180 - Math.abs(relAngle)) : Math.abs(relAngle);
                return oppositeAngle <= halfAngle && distNorm <= maxDist;
            } else if (maskType === 'triangle') {
                let match = false;
                [0, 120, -120].forEach(offset => {
                    let d = Math.abs(relAngle - offset);
                    if (d > 180) d = 360 - d;
                    if (d <= 35 * maskScale && distNorm <= maxDist) match = true;
                });
                return match;
            } else if (maskType === 'rectangle') {
                let match = false;
                [0, 90, 180, -90].forEach(offset => {
                    let d = Math.abs(relAngle - offset);
                    if (d > 180) d = 360 - d;
                    if (d <= 28 * maskScale && distNorm <= maxDist) match = true;
                });
                return match;
            } else if (maskType === 'hexagon') {
                let match = false;
                [0, 60, 120, 180, -120, -60].forEach(offset => {
                    let d = Math.abs(relAngle - offset);
                    if (d > 180) d = 360 - d;
                    if (d <= 20 * maskScale && distNorm <= maxDist) match = true;
                });
                return match;
            } else if (maskType === 'ellipse') {
                const rad = (relAngle * Math.PI) / 180;
                const a = maxDist, b = maxDist * 0.45;
                const ex = (distNorm * Math.cos(rad)) / a;
                const ey = (distNorm * Math.sin(rad)) / b;
                return (ex * ex + ey * ey) <= 1.0;
            } else if (maskType === 'star') {
                let match = false;
                [0, 72, 144, -144, -72].forEach(offset => {
                    let d = Math.abs(relAngle - offset);
                    if (d > 180) d = 360 - d;
                    if (d <= 22 * maskScale && distNorm <= maxDist) match = true;
                });
                return match;
            } else if (maskType === 'monochromatic') {
                const halfAngle = 18 * maskScale;
                return Math.abs(relAngle) <= halfAngle && distNorm <= maxDist;
            } else if (maskType === 'tri-wedge') {
                let match = false;
                [0, 120, -120].forEach(offset => {
                    let d = Math.abs(relAngle - offset);
                    if (d > 180) d = 360 - d;
                    if (d <= 25 * maskScale && distNorm <= maxDist) match = true;
                });
                return match;
            }
            return true;
        }

        function drawWheelAndMask() {
            const w = canvasWheel.width, h = canvasWheel.height;
            const cx = w / 2, cy = h / 2, radius = Math.min(cx, cy) - 8;
            ctxWheel.clearRect(0, 0, w, h);

            const ringMode = wheelRingModeSel.value;
            const gamutMask = gamutMaskSel.value;
            const currentL = inspectorCurrentHSL ? inspectorCurrentHSL.l : 50;
            const currentS = inspectorCurrentHSL ? inspectorCurrentHSL.s : 100;

            const imgData = ctxWheel.createImageData(w, h);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
                        if (angle < 0) angle += 360;
                        
                        let rgb;
                        if (ringMode === 'shades') {
                            let l = (dist / radius) * 100;
                            rgb = hslToRgb(angle, currentS, l);
                        } else if (ringMode === 'temperature') {
                            rgb = hslToRgb(angle, currentS, currentL);
                        } else {
                            rgb = hslToRgb(angle, (dist / radius) * 100, currentL);
                        }

                        let dimFactor = 1.0;
                        if (gamutMask !== 'none') {
                            const inMask = isPointInGamutMask(angle, dist / radius, gamutMask);
                            if (!inMask) dimFactor = 0.25;
                        }

                        const idx = (y * w + x) * 4;
                        imgData.data[idx] = Math.round(rgb.r * dimFactor);
                        imgData.data[idx+1] = Math.round(rgb.g * dimFactor);
                        imgData.data[idx+2] = Math.round(rgb.b * dimFactor);
                        imgData.data[idx+3] = 255;
                    }
                }
            }
            ctxWheel.putImageData(imgData, 0, 0);

            if (gamutMask !== 'none') {
                ctxWheel.save();
                ctxWheel.strokeStyle = wheelDragMode === 'mask' ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)';
                ctxWheel.lineWidth = wheelDragMode === 'mask' ? 2.5 : 1.5;
                ctxWheel.setLineDash(wheelDragMode === 'mask' ? [] : [3, 3]);
                ctxWheel.beginPath();
                ctxWheel.arc(cx, cy, radius * Math.min(1.0, maskScale), 0, Math.PI * 2);
                ctxWheel.stroke();
                ctxWheel.restore();
            }

            renderHarmonyNodes(cx, cy, radius);
        }

        function renderHarmonyNodes(cx, cy, radius) {
            if (!inspectorCurrentHex) return;
            const type = harmonyTypeSel.value;
            const hsl = inspectorCurrentHSL;
            let harmonyNodes = [{ hue: hsl.h, sat: hsl.s, isBase: true, name: 'Base' }];

            if (type === 'monochromatic') {
                harmonyNodes = [];
                for (let i = 0; i < 10; i++) {
                    const satStep = 10 + (i * 9);
                    harmonyNodes.push({ hue: hsl.h, sat: satStep, isBase: (i === 5) });
                }
            } else if (type === 'complementary') harmonyNodes.push({ hue: (hsl.h + 180) % 360, sat: hsl.s, isBase: false });
            else if (type === 'analogous') harmonyNodes.push({ hue: (hsl.h + 30) % 360, sat: hsl.s, isBase: false }, { hue: (hsl.h - 30 + 360) % 360, sat: hsl.s, isBase: false });
            else if (type === 'triadic') harmonyNodes.push({ hue: (hsl.h + 120) % 360, sat: hsl.s, isBase: false }, { hue: (hsl.h + 240) % 360, sat: hsl.s, isBase: false });
            else if (type === 'tetradic') harmonyNodes.push({ hue: (hsl.h + 90) % 360, sat: hsl.s, isBase: false }, { hue: (hsl.h + 180) % 360, sat: hsl.s, isBase: false }, { hue: (hsl.h + 270) % 360, sat: hsl.s, isBase: false });
            else if (type === 'split') harmonyNodes.push({ hue: (hsl.h + 150) % 360, sat: hsl.s, isBase: false }, { hue: (hsl.h + 210) % 360, sat: hsl.s, isBase: false });
            else if (type === 'double') harmonyNodes.push({ hue: (hsl.h + 30) % 360, sat: hsl.s, isBase: false }, { hue: (hsl.h + 180) % 360, sat: hsl.s, isBase: false }, { hue: (hsl.h + 210) % 360, sat: hsl.s, isBase: false });

            ctxWheel.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctxWheel.lineWidth = 2; ctxWheel.setLineDash([4, 4]); ctxWheel.beginPath();
            wheelOverlay.innerHTML = '';
            
            harmonyNodes.forEach(node => {
                let sat = node.sat !== undefined ? node.sat : hsl.s;
                let rad = (node.hue * Math.PI) / 180, dist = (sat / 100) * radius;
                const px = cx + Math.cos(rad) * dist, py = cy + Math.sin(rad) * dist;
                ctxWheel.moveTo(cx, cy); ctxWheel.lineTo(px, py);

                const nodeHex = rgbToHex(...Object.values(hslToRgb(node.hue, sat, hsl.l)));
                const contrastCol = getContrastColor(nodeHex);
                const markerDiv = document.createElement('div');
                markerDiv.className = 'absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none transition-all duration-75 z-20';
                markerDiv.style.left = `${(px / canvasWheel.width) * 100}%`; markerDiv.style.top = `${(py / canvasWheel.height) * 100}%`;
                markerDiv.innerHTML = `
                    <div class="w-5 h-5 rounded-full border-2 border-white ${node.isBase ? 'ring-2 ring-blue-400 scale-125 z-30' : 'ring-1 ring-black/50 z-10'} shadow-xl flex items-center justify-center" style="background-color: ${nodeHex};">
                        <div class="w-1 h-1 rounded-full ${contrastCol === '#ffffff' ? 'bg-white' : 'bg-black'} opacity-80"></div>
                    </div>
                    ${type !== 'monochromatic' ? `<div class="mt-0.5 px-1 py-0.2 rounded text-[9px] font-mono font-bold shadow border border-white/30 tracking-tight whitespace-nowrap" style="background-color: ${nodeHex}; color: ${contrastCol};">${nodeHex}</div>` : ''}`;
                wheelOverlay.appendChild(markerDiv);
            });
            ctxWheel.stroke(); ctxWheel.setLineDash([]);
        }

        function handleWheelEvent(e) {
            const rect = canvasWheel.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX, clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const x = (clientX - rect.left) * (canvasWheel.width / rect.width), y = (clientY - rect.top) * (canvasWheel.height / rect.height);
            const cx = canvasWheel.width / 2, cy = canvasWheel.height / 2, radius = Math.min(cx, cy) - 8;
            const dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
            
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            if (angle < 0) angle += 360;
            
            const distNorm = Math.min(dist / radius, 1.0);

            if (wheelDragMode === 'mask') {
                maskRotation = Math.round(angle);
                maskScale = Math.min(1.8, Math.max(0.3, distNorm * 1.3));
                drawWheelAndMask();
            } else {
                const gamutMask = gamutMaskSel.value;
                if (constrainToGamut && gamutMask !== 'none') {
                    if (!isPointInGamutMask(angle, distNorm, gamutMask)) return;
                }

                const newS = Math.min(distNorm * 100, 100);
                const currentL = inspectorCurrentHSL ? inspectorCurrentHSL.l : 50;
                
                const rgb = hslToRgb(angle, newS, currentL);
                updateInspectorState(rgbToHex(rgb.r, rgb.g, rgb.b));
            }
        }

        canvasWheel.addEventListener('mousedown', (e) => { isDraggingWheel = true; handleWheelEvent(e); });
        window.addEventListener('mousemove', (e) => { if (isDraggingWheel) handleWheelEvent(e); });
        window.addEventListener('mouseup', () => isDraggingWheel = false);
        canvasWheel.addEventListener('touchstart', (e) => { isDraggingWheel = true; handleWheelEvent(e); }, { passive: true });
        window.addEventListener('touchmove', (e) => { if (isDraggingWheel) handleWheelEvent(e); }, { passive: true });
        window.addEventListener('touchend', () => isDraggingWheel = false);

        function generateHarmonies(baseHex) {
            const type = harmonyTypeSel.value;
            const hsl = inspectorCurrentHSL;
            harmonyResults.innerHTML = '';

            const renderHarmonySwatch = (hex) => {
                const div = document.createElement('div');
                div.className = 'w-8 h-8 sm:w-9 sm:h-9 rounded-md cursor-pointer shadow-md border border-gray-600 hover:scale-110 transition-transform';
                div.style.backgroundColor = hex; div.title = hex;
                div.addEventListener('click', () => updateInspectorState(hex));
                harmonyResults.appendChild(div);
            };

            if (type === 'monochromatic') {
                // Generate exactly 10 distinct monochromatic variations (tints, tones, shades)
                const monoColors = [];
                for (let i = 0; i < 10; i++) {
                    const lightness = 12 + i * 8.2;
                    const saturation = Math.max(15, hsl.s - Math.abs(5 - i) * 6);
                    monoColors.push(rgbToHex(...Object.values(hslToRgb(hsl.h, saturation, lightness))));
                }
                monoColors.forEach(hex => renderHarmonySwatch(hex));
                return;
            }

            renderHarmonySwatch(baseHex);
            let hAngles = [];
            if(type === 'complementary') hAngles = [180];
            else if(type === 'analogous') hAngles = [30, -30];
            else if(type === 'triadic') hAngles = [120, 240];
            else if(type === 'tetradic') hAngles = [90, 180, 270];
            else if(type === 'split') hAngles = [150, 210];
            else if(type === 'double') hAngles = [30, 180, 210];
            
            hAngles.forEach(offset => {
                let newH = (hsl.h + offset + 360) % 360;
                renderHarmonySwatch(rgbToHex(...Object.values(hslToRgb(newH, hsl.s, hsl.l))));
                renderHarmonySwatch(rgbToHex(...Object.values(hslToRgb(newH, hsl.s, Math.max(0, hsl.l - 20)))));
                renderHarmonySwatch(rgbToHex(...Object.values(hslToRgb(newH, hsl.s, Math.min(100, hsl.l + 20)))));
            });
        }

        // Image Color Extraction & Interactive Sampler
        const dropzoneFile = document.getElementById('dropzone-file');
        const imageCanvas = document.getElementById('image-canvas');
        const imgCtx = imageCanvas.getContext('2d');
        const interactiveCanvas = document.getElementById('interactive-image-canvas');
        const interactiveCtx = interactiveCanvas.getContext('2d');
        const extractCountSlider = document.getElementById('extract-count-slider');
        const extractCountVal = document.getElementById('extract-count-val');
        let loadedImageObj = null;
        let sampledHex = '#FFFFFF';

        extractCountSlider.addEventListener('input', (e) => {
            extractCountVal.innerText = e.target.value;
        });

        dropzoneFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    loadedImageObj = img;
                    imageCanvas.width = img.width; imageCanvas.height = img.height;
                    imgCtx.drawImage(img, 0, 0);

                    const maxDim = 400;
                    let iw = img.width, ih = img.height;
                    if (iw > maxDim || ih > maxDim) {
                        if (iw > ih) { ih = Math.round((ih * maxDim) / iw); iw = maxDim; }
                        else { iw = Math.round((iw * maxDim) / ih); ih = maxDim; }
                    }
                    interactiveCanvas.width = iw; interactiveCanvas.height = ih;
                    interactiveCtx.drawImage(img, 0, 0, iw, ih);

                    document.getElementById('import-dropzone-wrapper').classList.add('hidden');
                    document.getElementById('image-picker-container').classList.remove('hidden');
                    document.getElementById('btn-auto-extract').disabled = false;
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('btn-reset-image').addEventListener('click', () => {
            document.getElementById('image-picker-container').classList.add('hidden');
            document.getElementById('import-dropzone-wrapper').classList.remove('hidden');
            document.getElementById('btn-auto-extract').disabled = true;
            loadedImageObj = null;
            dropzoneFile.value = '';
        });

        interactiveCanvas.addEventListener('click', (e) => {
            const rect = interactiveCanvas.getBoundingClientRect();
            const scaleX = interactiveCanvas.width / rect.width;
            const scaleY = interactiveCanvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);

            const pixel = interactiveCtx.getImageData(x, y, 1, 1).data;
            sampledHex = rgbToHex(pixel[0], pixel[1], pixel[2]);
            document.getElementById('sampled-color-preview').style.backgroundColor = sampledHex;
            document.getElementById('sampled-color-hex').innerText = sampledHex;
        });

        document.getElementById('btn-add-sampled-color').addEventListener('click', () => {
            pm.colors.push(pm.createSwatch(sampledHex));
            pm.saveGlobalState(); renderPalette(); closeImportModal();
        });

        document.getElementById('btn-auto-extract').addEventListener('click', () => {
            if (!loadedImageObj) return;
            const count = parseInt(extractCountSlider.value);
            try {
                const dominantColors = extractDominantColors(imgCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height).data, count);
                if(dominantColors.length > 0) {
                    pm.colors = dominantColors.map(hex => pm.createSwatch(hex));
                    pm.saveGlobalState(); renderPalette(); closeImportModal();
                }
            } catch(err) { showToast("Could not extract colors from image."); }
        });

        function extractDominantColors(data, targetCount) {
            const colorCounts = {}, binSize = 32;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] < 128) continue;
                const r = Math.floor(data[i] / binSize) * binSize;
                const g = Math.floor(data[i+1] / binSize) * binSize;
                const b = Math.floor(data[i+2] / binSize) * binSize;
                const rgbStr = `${r},${g},${b}`;
                colorCounts[rgbStr] = (colorCounts[rgbStr] || 0) + 1;
            }
            return Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, targetCount).map(entry => {
                const [r, g, b] = entry[0].split(',').map(Number);
                return rgbToHex(r + binSize/2, g + binSize/2, b + binSize/2);
            });
        }

        const modalImport = document.getElementById('import-modal');
        document.getElementById('btn-import').addEventListener('click', () => {
            modalImport.classList.remove('hidden'); setTimeout(() => modalImport.classList.remove('opacity-0'), 10);
        });
        function closeImportModal() {
            modalImport.classList.add('opacity-0'); setTimeout(() => modalImport.classList.add('hidden'), 300);
        }
        document.getElementById('btn-close-import').addEventListener('click', closeImportModal);
        
        document.getElementById('btn-parse-text').addEventListener('click', () => {
            const matches = [...document.getElementById('import-textarea').value.matchAll(/#([0-9A-F]{3,6})\b/gi)].map(m => m[0].toUpperCase());
            if(matches.length > 0) {
                pm.colors = [...new Set(matches)].slice(0, 20).map(hex => pm.createSwatch(hex));
                pm.saveGlobalState(); renderPalette(); closeImportModal();
            } else showToast("No valid HEX colors found.");
        });

        const modalExport = document.getElementById('export-modal');
        document.getElementById('btn-export').addEventListener('click', () => {
            updateExportDimPreview();
            modalExport.classList.remove('hidden'); setTimeout(() => modalExport.classList.remove('opacity-0'), 10);
        });
        function closeExportModal() {
            modalExport.classList.add('opacity-0');
            setTimeout(() => modalExport.classList.add('hidden'), 300);
        }
        document.getElementById('btn-close-export').addEventListener('click', closeExportModal);

        const exportFormatSel = document.getElementById('export-format'), exportPresetSel = document.getElementById('export-preset'), exportQualitySel = document.getElementById('export-resolution');

        function calculateExportDimensions() {
            const preset = exportPresetSel ? exportPresetSel.value : 'wallpaper';
            const res = exportQualitySel ? exportQualitySel.value : '1080p';
            let baseH = 1080;
            if (res === '360p') baseH = 360;
            else if (res === '480p') baseH = 480;
            else if (res === '720p') baseH = 720;
            else if (res === '1440p') baseH = 1440;
            else if (res === '4k') baseH = 2160;

            let aspect = 16 / 9;
            if (preset === 'wallpaper' || preset === 'viewport') aspect = window.innerWidth / window.innerHeight;
            else if (preset === 'square') aspect = 1;
            else if (preset === '9:16') aspect = 9 / 16;
            else if (preset === '4:3') aspect = 4 / 3;
            else if (preset === '21:9') aspect = 21 / 9;

            return { width: Math.round(baseH * aspect), height: baseH };
        }

       // Dynamic Filename Generator based on Palette state
        function generateExportFilename(format) {
            const count = pm.colors.length;
            const hexes = pm.colors.map(c => c.hex.replace('#', '')).join('_');
            const dims = calculateExportDimensions();
            return `${count}_colors_palette_${viewMode}-${hexes}-${dims.width}x${dims.height}.${format}`;
        }

        // Update Export Modal Preview
        function updateExportDimPreview() {
            const formatSel = document.getElementById('export-format');
            const dimPreview = document.getElementById('export-dim-preview');
            const filenamePreview = document.getElementById('export-filename-preview');
            
            if (!formatSel) return;
            
            const dims = calculateExportDimensions();
            const filename = generateExportFilename(formatSel.value);

            if (dimPreview) dimPreview.innerText = `${dims.width} x ${dims.height} px`;
            if (filenamePreview) filenamePreview.innerText = filename;
        }

        [exportFormatSel, exportPresetSel, exportQualitySel].forEach(el => {
            if (el) el.addEventListener('change', updateExportDimPreview);
        });

        // Render Palette Swatches to Offscreen Canvas respecting View Mode
        function renderPaletteToCanvas(ctx, width, height) {
            const total = pm.colors.length;
            if (total === 0) return;

            if (viewMode === 'rows') {
                const rowHeight = height / total;
                pm.colors.forEach((swatch, i) => {
                    const y = i * rowHeight;
                    ctx.fillStyle = swatch.hex;
                    ctx.fillRect(0, y, width, rowHeight);

                    const textColor = getContrastColor(swatch.hex);
                    ctx.fillStyle = textColor;
                    ctx.font = `bold ${Math.max(16, Math.floor(rowHeight * 0.22))}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(swatch.hex, width / 2, y + rowHeight / 2);
                });
            } else if (viewMode === 'cols') {
                const colWidth = width / total;
                pm.colors.forEach((swatch, i) => {
                    const x = i * colWidth;
                    ctx.fillStyle = swatch.hex;
                    ctx.fillRect(x, 0, colWidth, height);

                    const textColor = getContrastColor(swatch.hex);
                    ctx.fillStyle = textColor;
                    ctx.font = `bold ${Math.max(14, Math.floor(colWidth * 0.15))}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(swatch.hex, x + colWidth / 2, height / 2);
                });
            } else { // Grid Mode
                const cols = Math.ceil(Math.sqrt(total));
                const rows = Math.ceil(total / cols);
                const cellW = width / cols;
                const cellH = height / rows;

                pm.colors.forEach((swatch, i) => {
                    const r = Math.floor(i / cols);
                    const c = i % cols;
                    const x = c * cellW;
                    const y = r * cellH;

                    ctx.fillStyle = swatch.hex;
                    ctx.fillRect(x, y, cellW, cellH);

                    const textColor = getContrastColor(swatch.hex);
                    ctx.fillStyle = textColor;
                    ctx.font = `bold ${Math.max(14, Math.floor(Math.min(cellW, cellH) * 0.18))}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(swatch.hex, x + cellW / 2, y + cellH / 2);
                });
            }
        }

        // Export PNG Format
        function exportPNG(width, height, filename) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            renderPaletteToCanvas(ctx, width, height);

            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        // Export SVG Format
        function exportSVG(width, height, filename) {
            const total = pm.colors.length;
            let elements = '';

            if (viewMode === 'rows') {
                const rowHeight = height / total;
                pm.colors.forEach((swatch, i) => {
                    const y = i * rowHeight;
                    const textColor = getContrastColor(swatch.hex);
                    const fontSize = Math.max(16, Math.floor(rowHeight * 0.22));
                    elements += `<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${swatch.hex}" />\n`;
                    elements += `<text x="${width / 2}" y="${y + rowHeight / 2}" fill="${textColor}" font-family="monospace" font-size="${fontSize}" font-weight="bold" text-anchor="middle" dominant-baseline="central">${swatch.hex}</text>\n`;
                });
            } else if (viewMode === 'cols') {
                const colWidth = width / total;
                pm.colors.forEach((swatch, i) => {
                    const x = i * colWidth;
                    const textColor = getContrastColor(swatch.hex);
                    const fontSize = Math.max(14, Math.floor(colWidth * 0.15));
                    elements += `<rect x="${x}" y="0" width="${colWidth}" height="${height}" fill="${swatch.hex}" />\n`;
                    elements += `<text x="${x + colWidth / 2}" y="${height / 2}" fill="${textColor}" font-family="monospace" font-size="${fontSize}" font-weight="bold" text-anchor="middle" dominant-baseline="central">${swatch.hex}</text>\n`;
                });
            } else {
                const cols = Math.ceil(Math.sqrt(total));
                const rows = Math.ceil(total / cols);
                const cellW = width / cols;
                const cellH = height / rows;

                pm.colors.forEach((swatch, i) => {
                    const r = Math.floor(i / cols);
                    const c = i % cols;
                    const x = c * cellW;
                    const y = r * cellH;
                    const textColor = getContrastColor(swatch.hex);
                    const fontSize = Math.max(14, Math.floor(Math.min(cellW, cellH) * 0.18));

                    elements += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${swatch.hex}" />\n`;
                    elements += `<text x="${x + cellW / 2}" y="${y + cellH / 2}" fill="${textColor}" font-family="monospace" font-size="${fontSize}" font-weight="bold" text-anchor="middle" dominant-baseline="central">${swatch.hex}</text>\n`;
                });
            }

            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${elements}</svg>`;
            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        }

        // Export PDF Format
        function exportPDF(width, height, filename) {
            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) {
                showToast('jsPDF library not available');
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            renderPaletteToCanvas(ctx, width, height);

            const orientation = width >= height ? 'landscape' : 'portrait';
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'px',
                format: [width, height]
            });

            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
            pdf.save(filename);
        }

        // Master Export Execution Call
        function executeExport() {
            const format = document.getElementById('export-format').value;
            const dims = calculateExportDimensions();
            const filename = generateExportFilename(format);

            if (format === 'png') exportPNG(dims.width, dims.height, filename);
            else if (format === 'svg') exportSVG(dims.width, dims.height, filename);
            else if (format === 'pdf') exportPDF(dims.width, dims.height, filename);

            closeExportModal();
        }

        // Event Listeners Setup
        document.getElementById('btn-execute-export')?.addEventListener('click', executeExport);

        // Initialize application
        pm.init(5);
        renderPalette();