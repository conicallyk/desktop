document.addEventListener('DOMContentLoaded', () => {
    let zIndexCounter = 100;
    
    const taskbarItems = document.getElementById('taskbar-items');
    const startButton = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');
    const clock = document.getElementById('clock');
    
    function updateClock() {
        const now = new Date();
        clock.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    setInterval(updateClock, 1000);
    updateClock();

    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && e.target !== startButton) {
            startMenu.classList.remove('open');
        }
    });

    const windowElements = document.querySelectorAll('.window');
    windowElements.forEach(win => {
        const id = win.id;
        const closeBtn = win.querySelector('.close-btn');
        const minBtn = win.querySelector('.minimize-btn');
        const titleBar = win.querySelector('.title-bar');

        closeBtn.onclick = () => closeWindow(id);
        minBtn.onclick = () => minimizeWindow(id);
        win.onmousedown = () => bringToFront(win);
        makeDraggable(win, titleBar);
        makeResizable(win);

        if (!win.classList.contains('hidden')) {
            createTaskbarItem(id, win.querySelector('.title-bar-text').textContent);
        }
    });

    document.querySelectorAll('.icon').forEach(icon => {
        icon.ondblclick = () => openWindow(icon.getAttribute('data-target'));
    });

    function openWindow(id) {
        const win = document.getElementById(id);
        if (!win) return;
        win.classList.remove('hidden');
        win.classList.remove('minimized');
        bringToFront(win);
        if (!document.getElementById(`task-${id}`)) {
            createTaskbarItem(id, win.querySelector('.title-bar-text').textContent);
        }
        if (id === 'window-paint') initPaint();
    }

    function closeWindow(id) {
        document.getElementById(id).classList.add('hidden');
        const taskItem = document.getElementById(`task-${id}`);
        if (taskItem) taskItem.remove();
    }

    function minimizeWindow(id) {
        document.getElementById(id).classList.add('minimized');
        const taskItem = document.getElementById(`task-${id}`);
        if (taskItem) taskItem.classList.remove('active');
    }

    function toggleWindow(id) {
        const win = document.getElementById(id);
        if (win.classList.contains('minimized')) {
            win.classList.remove('minimized');
            bringToFront(win);
        } else {
            minimizeWindow(id);
        }
    }

    function bringToFront(win) {
        zIndexCounter++;
        win.style.zIndex = zIndexCounter;
        document.querySelectorAll('.taskbar-item').forEach(item => item.classList.remove('active'));
        const taskItem = document.getElementById(`task-${win.id}`);
        if (taskItem) taskItem.classList.add('active');
    }

    function createTaskbarItem(id, title) {
        const item = document.createElement('div');
        item.className = 'taskbar-item active';
        item.id = `task-${id}`;
        item.textContent = title;
        item.onclick = () => toggleWindow(id);
        taskbarItems.appendChild(item);
    }

    function makeResizable(elmnt) {
        const resizers = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        resizers.forEach(dir => {
            const resizer = document.createElement('div');
            resizer.className = `resizer ${dir}`;
            elmnt.appendChild(resizer);
            resizer.onmousedown = (e) => initResize(e, dir);
        });

        function initResize(e, dir) {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = elmnt.offsetWidth;
            const startHeight = elmnt.offsetHeight;
            const startTop = elmnt.offsetTop;
            const startLeft = elmnt.offsetLeft;

            document.onmousemove = (e) => {
                if (dir.includes('e')) elmnt.style.width = startWidth + (e.clientX - startX) + 'px';
                if (dir.includes('s')) elmnt.style.height = startHeight + (e.clientY - startY) + 'px';
                if (dir.includes('w')) {
                    elmnt.style.width = startWidth - (e.clientX - startX) + 'px';
                    elmnt.style.left = startLeft + (e.clientX - startX) + 'px';
                }
                if (dir.includes('n')) {
                    elmnt.style.height = startHeight - (e.clientY - startY) + 'px';
                    elmnt.style.top = startTop + (e.clientY - startY) + 'px';
                }
                
                // Specific fix for paint canvas on resize if it's the paint window
                if (elmnt.id === 'window-paint') {
                    const canvas = document.getElementById('paint-canvas');
                    if (canvas) {
                        // We don't want to clear the canvas on every pixel resize, 
                        // but normally you'd handle buffer resizing here.
                    }
                }
            };

            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        }
    }

    function makeDraggable(elmnt, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;
        function dragMouseDown(e) {
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        function elementDrag(e) {
            pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }
        function closeDragElement() {
            document.onmouseup = null; document.onmousemove = null;
        }
    }

    // Paint Logic
    let paintInitialized = false;
    function initPaint() {
        if (paintInitialized) return;
        const canvas = document.getElementById('paint-canvas');
        const ctx = canvas.getContext('2d');
        const colorPicker = document.getElementById('paint-color-picker');
        let drawing = false;
        let tool = 'pencil';

        canvas.width = 450;
        canvas.height = 300;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;

        canvas.onmousedown = (e) => {
            drawing = true;
            ctx.beginPath();
            ctx.moveTo(e.offsetX, e.offsetY);
        };
        canvas.onmousemove = (e) => {
            if (!drawing) return;
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : colorPicker.value;
            ctx.lineWidth = tool === 'eraser' ? 20 : 2;
            ctx.stroke();
        };
        canvas.onmouseup = () => drawing = false;

        document.getElementById('tool-pencil').onclick = () => {
            tool = 'pencil';
            document.querySelectorAll('.paint-tool').forEach(t => t.classList.remove('active'));
            document.getElementById('tool-pencil').classList.add('active');
        };
        document.getElementById('tool-eraser').onclick = () => {
            tool = 'eraser';
            document.querySelectorAll('.paint-tool').forEach(t => t.classList.remove('active'));
            document.getElementById('tool-eraser').classList.add('active');
        };
        document.getElementById('tool-clear').onclick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        };

        document.querySelectorAll('.palette-color').forEach(c => {
            c.onclick = () => {
                colorPicker.value = rgb2hex(c.style.background);
            };
        });

        function rgb2hex(rgb) {
            if (!rgb) return '#000000';
            const res = rgb.match(/\d+/g);
            if (!res) return rgb;
            return "#" + res.map(x => {
                const hex = parseInt(x).toString(16);
                return hex.length === 1 ? "0" + hex : hex;
            }).join("");
        }
        paintInitialized = true;
    }
});
