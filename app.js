// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Establish WebSocket Connection in app.js
let appSocket;
let onWebSocketPickupConfirmed = null;
let onWebSocketTripCompleted = null;
window.currentPickupLocation = "Cổng Phụ - Trường Đại Học VinUni";
window.currentDestinationLocation = "Nhà hát lớn Hà Nội";

function initAppWebSocket() {
    try {
        appSocket = new WebSocket('ws://localhost:8001');
        appSocket.onopen = () => console.log('WebSocket connected on passenger AI side.');
        appSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Passenger AI received event:', data);
                if (data.type === 'pickup_confirmed') {
                    if (window.onWebSocketPickupConfirmed) {
                        window.onWebSocketPickupConfirmed();
                    }
                } else if (data.type === 'trip_completed') {
                    if (window.onWebSocketTripCompleted) {
                        window.onWebSocketTripCompleted();
                    }
                } else if (data.type === 'driver_calling') {
                    window.showIncomingCall();
                } else if (data.type === 'call_ended') {
                    window.hideIncomingCall();
                } else if (data.type === 'trip_accepted') {
                    if (window.onWebSocketTripAccepted) {
                        window.onWebSocketTripAccepted();
                    }
                }
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };
        appSocket.onclose = () => {
            console.log('WebSocket disconnected on passenger AI side. Reconnecting...');
            setTimeout(initAppWebSocket, 2000);
        };
        appSocket.onerror = (err) => console.error('WebSocket error on passenger AI side:', err);
    } catch (e) {
        console.error('WebSocket initialization failed in app.js:', e);
    }
}
initAppWebSocket();

// Central Timer Registry to prevent background simulations from conflicting or throwing errors when modal is closed
window.aiModalTimers = [];
window.clearAiModalTimers = function() {
    if (window.aiModalTimers && window.aiModalTimers.length > 0) {
        window.aiModalTimers.forEach(timer => {
            if (timer.type === 'timeout') clearTimeout(timer.id);
            if (timer.type === 'interval') clearInterval(timer.id);
        });
        window.aiModalTimers = [];
    }
};
window.safeTimeout = function(callback, delay) {
    const id = setTimeout(callback, delay);
    window.aiModalTimers.push({ type: 'timeout', id });
    return id;
};
window.safeInterval = function(callback, delay) {
    const id = setInterval(callback, delay);
    window.aiModalTimers.push({ type: 'interval', id });
    return id;
};

// Update time dynamically
function updateTime() {
    const timeElement = document.querySelector('.time');
    if (timeElement) {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        timeElement.textContent = `${hours}:${minutes}`;
    }
}

setInterval(updateTime, 1000);
updateTime();

// Persistent Draggable AI Icon System
let currentX = 0;
let currentY = 0;

function initDraggableAiIcon() {
    const aiBtn = document.querySelector('.right-circle-btn');
    if (!aiBtn) return;

    // Clear CSS right/bottom so JS-controlled left/top takes over cleanly
    aiBtn.style.right = '';
    aiBtn.style.bottom = '';
    aiBtn.style.position = 'fixed';
    aiBtn.style.zIndex = '10001';
    aiBtn.style.margin = '0';
    aiBtn.style.touchAction = 'none'; // Prevents scrolling while dragging on mobile

    let isDragging = false;
    let startX = 0, startY = 0;
    let hasMoved = false;
    let btnWidth = 64;
    let btnHeight = 64;

    // Use requestAnimationFrame to ensure element is rendered before getting dimensions
    requestAnimationFrame(() => {
        const rect = aiBtn.getBoundingClientRect();
        btnWidth = rect.width || 64;
        btnHeight = rect.height || 64;

        // Reset saved position if layout version changed (new default position)
        const posVersion = localStorage.getItem('aiIconPosVersion');
        if (posVersion !== 'v4') {
            localStorage.removeItem('aiIconX');
            localStorage.removeItem('aiIconY');
            localStorage.setItem('aiIconPosVersion', 'v4');
        }

        // Retrieve saved position from localStorage if exists
        const savedX = localStorage.getItem('aiIconX');
        const savedY = localStorage.getItem('aiIconY');
        if (savedX && savedY) {
            // Limit coordinates to screen viewport limits
            const x = Math.max(10, Math.min(parseFloat(savedX), window.innerWidth - btnWidth - 10));
            const y = Math.max(10, Math.min(parseFloat(savedY), window.innerHeight - btnHeight - 10));
            aiBtn.style.left = x + 'px';
            aiBtn.style.top = y + 'px';
            currentX = x;
            currentY = y;
        } else {
            // Default: above the profile icon in bottom nav (right side, 10px above nav top)
            // Nav is at bottom: 20px, height: 64px → top of nav = 84px from bottom
            // AI icon bottom should be at 84px + 10px gap = 94px from bottom
            const defaultX = window.innerWidth - btnWidth - 20;
            const defaultY = window.innerHeight - btnHeight - 94;
            aiBtn.style.left = defaultX + 'px';
            aiBtn.style.top = defaultY + 'px';
            currentX = defaultX;
            currentY = defaultY;
        }
    });

    aiBtn.addEventListener('mousedown', dragStart);
    aiBtn.addEventListener('touchstart', dragStart, { passive: false });

    function dragStart(e) {
        isDragging = true;
        hasMoved = false;

        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        startX = clientX - currentX;
        startY = clientY - currentY;

        const startClientX = clientX;
        const startClientY = clientY;

        function drag(e) {
            if (!isDragging) return;
            if (e.type === 'touchmove') e.preventDefault();

            const cx = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const cy = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

            let newX = cx - startX;
            let newY = cy - startY;

            // Viewport boundary constraints
            const padding = 10;
            newX = Math.max(padding, Math.min(newX, window.innerWidth - btnWidth - padding));
            newY = Math.max(padding, Math.min(newY, window.innerHeight - btnHeight - padding));

            currentX = newX;
            currentY = newY;
            aiBtn.style.left = currentX + 'px';
            aiBtn.style.top = currentY + 'px';

            // Dynamically move greeting bubble along with AI button if showing
            if (aiGreetingNotif && aiGreetingNotif.style.opacity === '1') {
                const tooltipWidth = 260; // Approx width of tooltip
                const left = currentX + btnWidth / 2 - tooltipWidth / 2;
                const finalLeft = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
                
                aiGreetingNotif.style.left = finalLeft + 'px';
                aiGreetingNotif.style.right = 'auto';
                aiGreetingNotif.style.bottom = 'auto';
                
                if (currentY > window.innerHeight / 2) {
                    aiGreetingNotif.style.top = (currentY - 58) + 'px';
                } else {
                    aiGreetingNotif.style.top = (currentY + btnHeight + 10) + 'px';
                }
            }

            if (Math.abs(cx - startClientX) > 6 || Math.abs(cy - startClientY) > 6) {
                hasMoved = true;
            }
        }

        function dragEnd() {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('touchend', dragEnd);

            if (hasMoved) {
                localStorage.setItem('aiIconX', currentX);
                localStorage.setItem('aiIconY', currentY);
                // Temporarily disable click event by capturing & suppressing it
                aiBtn.style.pointerEvents = 'none';
                setTimeout(() => {
                    aiBtn.style.pointerEvents = 'auto';
                }, 50);
            }
        }

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
    }
}

// Auto-run draggable initialization when page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDraggableAiIcon);
} else {
    initDraggableAiIcon();
}

// AI Hover Greeting
let aiGreetingNotif;
let aiGreetingAutoTimer = null;
let aiGreetingHideTimer = null;
let aiGreetingMsgIndex = 0;
const AI_GREETING_MESSAGES = [
    '👋 Xin chào! Tôi là AI XanhSM',
    '🚗 Bạn muốn đặt xe không?',
    '🌟 Tôi có thể giúp gì cho bạn?',
    '📍 Hãy nói điểm đến của bạn nhé!',
    '😊 Xanh SM AI luôn sẵn sàng hỗ trợ!'
];

function createGreetingBubble() {
    if (aiGreetingNotif) return;
    aiGreetingNotif = document.createElement('div');
    aiGreetingNotif.id = 'ai-greeting';
    Object.assign(aiGreetingNotif.style, {
        position: 'fixed',
        background: 'linear-gradient(135deg, rgba(0,18,38,0.92) 0%, rgba(0,40,70,0.95) 100%)',
        color: 'white',
        padding: '12px 18px',
        borderRadius: '20px',
        boxShadow: '0 8px 24px rgba(0,188,212,0.35), 0 2px 8px rgba(0,0,0,0.3)',
        border: '1.5px solid rgba(0,242,254,0.4)',
        zIndex: '10002',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        opacity: '0',
        transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
        transform: 'translateY(12px) scale(0.9)',
        pointerEvents: 'none',
        backdropFilter: 'blur(10px)',
        webkitBackdropFilter: 'blur(10px)',
        whiteSpace: 'nowrap',
        maxWidth: '280px'
    });
    aiGreetingNotif.innerHTML = `
        <div style="width:28px;height:28px;background:linear-gradient(135deg,#00f2fe,#a18cd1);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fa-solid fa-robot" style="color:white;font-size:13px;"></i>
        </div>
        <span id="ai-greeting-text">👋 Xin chào! Tôi là AI XanhSM</span>
    `;
    document.body.appendChild(aiGreetingNotif);
}

function positionGreetingBubble() {
    const aiBtn = document.querySelector('.right-circle-btn');
    if (!aiBtn || !aiGreetingNotif) return;
    const rect = aiBtn.getBoundingClientRect();
    const tooltipWidth = aiGreetingNotif.offsetWidth || 260;
    const left = rect.left + rect.width / 2 - tooltipWidth / 2;
    const finalLeft = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
    aiGreetingNotif.style.left = finalLeft + 'px';
    aiGreetingNotif.style.right = 'auto';
    aiGreetingNotif.style.bottom = 'auto';
    if (rect.top > window.innerHeight / 2) {
        aiGreetingNotif.style.top = (rect.top - 60) + 'px';
    } else {
        aiGreetingNotif.style.top = (rect.bottom + 10) + 'px';
    }
}

function showAiGreeting(isAuto = false) {
    createGreetingBubble();
    // Update message text on auto-show
    if (isAuto) {
        const textEl = document.getElementById('ai-greeting-text');
        if (textEl) {
            textEl.textContent = AI_GREETING_MESSAGES[aiGreetingMsgIndex % AI_GREETING_MESSAGES.length];
            aiGreetingMsgIndex++;
        }
    }
    positionGreetingBubble();
    clearTimeout(aiGreetingHideTimer);
    setTimeout(() => {
        if (aiGreetingNotif) {
            aiGreetingNotif.style.opacity = '1';
            aiGreetingNotif.style.transform = 'translateY(0) scale(1)';
        }
    }, 10);
    // Auto-hide after 3 seconds
    if (isAuto) {
        aiGreetingHideTimer = setTimeout(() => hideAiGreeting(), 3000);
    }
}

function hideAiGreeting() {
    if (aiGreetingNotif) {
        aiGreetingNotif.style.opacity = '0';
        aiGreetingNotif.style.transform = 'translateY(12px) scale(0.9)';
    }
}

// Auto-greeting every 5 seconds
function startAutoGreeting() {
    // First show after 3 seconds
    setTimeout(() => {
        showAiGreeting(true);
    }, 3000);
    // Then repeat every 5 seconds
    aiGreetingAutoTimer = setInterval(() => {
        // Only show if AI modal is not open
        const modal = document.getElementById('ai-voice-modal');
        if (modal && modal.style.display !== 'none' && modal.style.display !== '') return;
        showAiGreeting(true);
    }, 5000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAutoGreeting);
} else {
    startAutoGreeting();
}


// =============================================
// AI Thinking Indicator
// =============================================
let _aiThinkingStyleInjected = false;

function injectAiThinkingStyles() {
    if (_aiThinkingStyleInjected) return;
    _aiThinkingStyleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        @keyframes aiThinkingDot {
            0%, 20% { opacity: 0.3; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(-5px); }
            80%, 100% { opacity: 0.3; transform: translateY(0); }
        }
        @keyframes aiThinkingPulse {
            0% { box-shadow: 0 2px 12px rgba(0,188,212,0.08); }
            50% { box-shadow: 0 2px 20px rgba(0,188,212,0.22); }
            100% { box-shadow: 0 2px 12px rgba(0,188,212,0.08); }
        }
        @keyframes aiThinkingFadeIn {
            from { opacity: 0; transform: translateY(8px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ai-thinking-bubble {
            align-self: flex-start;
            background: linear-gradient(135deg, #f8f9fa 0%, #f0f4f8 100%);
            padding: 14px 20px;
            border-radius: 20px 20px 20px 4px;
            max-width: 75%;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: aiThinkingFadeIn 0.35s ease-out, aiThinkingPulse 2s ease-in-out infinite;
            border: 1.5px solid rgba(0,188,212,0.15);
        }
        .ai-thinking-icon {
            width: 30px; height: 30px;
            background: linear-gradient(135deg, #00f2fe, #00bcd4);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            animation: aiThinkingPulse 1.5s ease-in-out infinite;
        }
        .ai-thinking-icon i {
            color: white; font-size: 13px;
        }
        .ai-thinking-dots {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .ai-thinking-dots span {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00bcd4, #00f2fe);
            display: inline-block;
            animation: aiThinkingDot 1.4s ease-in-out infinite;
        }
        .ai-thinking-dots span:nth-child(2) {
            animation-delay: 0.2s;
        }
        .ai-thinking-dots span:nth-child(3) {
            animation-delay: 0.4s;
        }
        .ai-thinking-label {
            font-size: 12px;
            color: #90a4ae;
            font-weight: 500;
            margin-left: 2px;
            font-style: italic;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show AI thinking indicator in the chat board
 * @param {HTMLElement} textBoard - The chat container element
 * @returns {HTMLElement} - The thinking bubble element (to remove later)
 */
function showAiThinking(textBoard) {
    injectAiThinkingStyles();
    const thinking = document.createElement('div');
    thinking.className = 'ai-thinking-bubble';
    thinking.innerHTML = `
        <div class="ai-thinking-icon">
            <i class="fa-solid fa-robot"></i>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
            <div class="ai-thinking-dots">
                <span></span><span></span><span></span>
            </div>
            <div class="ai-thinking-label">AI đang suy nghĩ...</div>
        </div>
    `;
    textBoard.appendChild(thinking);
    textBoard.scrollTop = textBoard.scrollHeight;
    return thinking;
}

// AI Voice Modal
function openAiModal(isCallSimulation = false) {
    const setTimeout = window.safeTimeout;
    const setInterval = window.safeInterval;
    hideAiGreeting();
    
    if (!isCallSimulation) {
        startSpeechRecognitionForModal();
    }

    let modal = document.getElementById('ai-voice-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ai-voice-modal';
        modal.innerHTML = `
            <div style="
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 10005;
                background: linear-gradient(180deg, #e8fffe 0%, #f0f9ff 40%, #ffffff 100%);
                display: flex; flex-direction: column;
                font-family: Inter, sans-serif;
                animation: slideUpFull 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                overflow: hidden;
            ">

                <!-- Chat area -->
                <div id="ai-user-text" style="
                    flex:1;
                    overflow-y:auto;
                    padding:40px 16px 24px 16px;
                    display:flex;
                    flex-direction:column;
                    gap:12px;
                    scroll-behavior:smooth;
                ">
                    <div style="
                        text-align:center;color:#aaa;font-size:13px;
                        padding:20px 0;font-style:italic;
                    ">(Đang chờ giọng nói...)</div>
                </div>

                <!-- Bottom Controls (Mic, Blue Circle, Close) -->
                <div style="
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 16px 40px 32px 40px;
                    flex-shrink: 0;
                    background: transparent;
                ">
                    <!-- Mic Button -->
                    <button onclick="speakAI('Tôi đang lắng nghe bạn đây. Vui lòng nói điểm đến của bạn.')" style="
                        width: 50px; height: 50px; border-radius: 50%;
                        background: #f5f5f5; border: none; cursor: pointer;
                        display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.06); transition: background 0.2s;
                    ">
                        <i class="fa-solid fa-microphone" style="color: #444; font-size: 20px;"></i>
                    </button>

                    <!-- Blue Animated Pill -->
                    <div id="ai-voice-pill" onclick="window.startRealMicVisualizer()" style="cursor: pointer;
                        width: 220px; height: 60px; border-radius: 30px;
                        background: linear-gradient(90deg, rgba(135,206,250,0.8) 0%, rgba(0,191,255,0.9) 50%, rgba(30,144,255,1) 100%);
                        box-shadow: 0 8px 24px rgba(0, 191, 255, 0.4), inset 0 -4px 12px rgba(0,0,200,0.1), inset 0 4px 12px rgba(255,255,255,0.4);
                        animation: pulseListening 2s infinite ease-in-out;
                        transition: all 0.3s ease;
                        display: flex; align-items: center; justify-content: center;
                    ">
                        <div class="pill-waveform">
                            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                            <span class="center-bar"></span>
                            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                        </div>
                    </div>

                    <!-- Close Button -->
                    <button onclick="closeAiModal()" style="
                        width: 50px; height: 50px; border-radius: 50%;
                        background: #f5f5f5; border: none; cursor: pointer;
                        display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.06); transition: background 0.2s;
                    ">
                        <i class="fa-solid fa-xmark" style="color: #444; font-size: 24px;"></i>
                    </button>
                </div>
            </div>
            <style>
                @keyframes pulseListening {
                    0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,242,254,0.7); }
                    70%  { transform: scale(1.05); box-shadow: 0 0 0 22px rgba(0,242,254,0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,242,254,0); }
                }
                @keyframes userSpeakingPulse {
                    0%   { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(34,197,94,0.7); background: linear-gradient(90deg, rgba(135,206,250,0.8) 0%, rgba(34,197,94,0.8) 50%, rgba(30,144,255,1) 100%); }
                    50%  { transform: scale(1.03); box-shadow: 0 0 0 16px rgba(34,197,94,0); background: linear-gradient(90deg, rgba(34,197,94,0.8) 0%, rgba(0,191,255,0.9) 50%, rgba(34,197,94,0.8) 100%); }
                    100% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(34,197,94,0); background: linear-gradient(90deg, rgba(135,206,250,0.8) 0%, rgba(34,197,94,0.8) 50%, rgba(30,144,255,1) 100%); }
                }
                .pill-speaking-user {
                    animation: userSpeakingPulse 0.4s infinite ease-in-out !important;
                }
                .pill-speaking-ai {
                    animation: pulseListening 0.8s infinite ease-in-out !important;
                }
                
                /* Waveform styles inside pill */
                .pill-waveform {
                    display: flex; align-items: center; justify-content: center; gap: 4px; height: 100%;
                }
                .pill-waveform span {
                    display: block; width: 4px; background: rgba(255,255,255,0.9);
                    border-radius: 4px; transform-origin: center;
                    animation: waveformIdle 1.5s ease-in-out infinite alternate;
                }
                .pill-waveform .center-bar {
                    width: 5px; height: 36px; background: #fff;
                    animation: centerIdle 1.5s ease-in-out infinite alternate;
                }
                
                /* Waveform heights radiating from center */
                .pill-waveform span:nth-child(7), .pill-waveform span:nth-child(9) { height: 28px; animation-delay: 0.1s; }
                .pill-waveform span:nth-child(6), .pill-waveform span:nth-child(10) { height: 20px; animation-delay: 0.2s; }
                .pill-waveform span:nth-child(5), .pill-waveform span:nth-child(11) { height: 14px; animation-delay: 0.3s; }
                .pill-waveform span:nth-child(4), .pill-waveform span:nth-child(12) { height: 10px; animation-delay: 0.4s; }
                .pill-waveform span:nth-child(3), .pill-waveform span:nth-child(13) { height: 6px; animation-delay: 0.5s; }
                .pill-waveform span:nth-child(2), .pill-waveform span:nth-child(14) { height: 4px; animation-delay: 0.6s; }
                .pill-waveform span:nth-child(1), .pill-waveform span:nth-child(15) { height: 4px; animation-delay: 0.7s; }
                
                @keyframes waveformIdle { 0% { transform: scaleY(0.7); opacity: 0.6; } 100% { transform: scaleY(1.3); opacity: 0.9; } }
                @keyframes centerIdle { 0% { transform: scaleY(0.8); opacity: 0.8; } 100% { transform: scaleY(1.1); opacity: 1; } }
                @keyframes waveformActive { 0% { transform: scaleY(0.3); opacity: 0.7; } 100% { transform: scaleY(2.2); opacity: 1; } }
                @keyframes centerActive { 0% { transform: scaleY(0.5); opacity: 0.9; } 100% { transform: scaleY(1.3); opacity: 1; } }
                
                .pill-speaking-user .pill-waveform span, .pill-speaking-ai .pill-waveform span {
                    animation-name: waveformActive; animation-duration: 0.3s;
                }
                .pill-speaking-user .pill-waveform .center-bar, .pill-speaking-ai .pill-waveform .center-bar {
                    animation-name: centerActive; animation-duration: 0.3s;
                }

                @keyframes slideUpFull {
                    from { opacity: 0; transform: translateY(100%); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
            </style>

        `;
        document.body.appendChild(modal);
    }

    // Always restart waveform when modal opens (stop any stale loop first)
    stopAiWaveform();
    // Wait two frames so the canvas is fully painted before reading dimensions
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            startAiWaveform();
        });
    });

    // Reset text
    const textBoard = document.getElementById('ai-user-text');
    textBoard.style.flexDirection = 'column';
    textBoard.style.alignItems = 'stretch';
    textBoard.style.justifyContent = 'flex-start';
    textBoard.innerHTML = '<div id="ai-status" style="text-align: center; color: #aaa; font-style: italic; width: 100%; margin-top: 20px;">(Đang chờ giọng nói...)</div>';

    if (isCallSimulation) {
        document.getElementById('ai-status').style.display = 'none';
        return;
    }

    // 0. AI Greeting
    setTimeout(() => {
        document.getElementById('ai-status').style.display = 'none';

        const thinkingGreeting = showAiThinking(textBoard);
        setTimeout(() => {
            thinkingGreeting.remove();
            const aiGreetingBubble = document.createElement('div');
            aiGreetingBubble.style.alignSelf = 'flex-start';
            aiGreetingBubble.style.background = '#f5f5f5';
            aiGreetingBubble.style.padding = '12px 18px';
            aiGreetingBubble.style.borderRadius = '16px 16px 16px 0';
            aiGreetingBubble.style.maxWidth = '85%';
            aiGreetingBubble.style.marginBottom = '16px';
            aiGreetingBubble.style.fontSize = '16px';
            aiGreetingBubble.innerHTML = `<span style="color: #00bcd4; margin-right: 4px; font-weight: 700;"><i class="fa-solid fa-robot"></i> AI:</span> Xin chào, XanhSM AI đây. Bạn muốn đi đâu?`;
            textBoard.appendChild(aiGreetingBubble);
            textBoard.scrollTop = textBoard.scrollHeight;
            speakAI("Xin chào, Xanh ét em A I đây. Bạn muốn đi đâu?");

            // Hiển thị gợi ý địa điểm quen thuộc
            const suggestionsTitle = document.createElement('div');
            suggestionsTitle.style.fontSize = '16px';
            suggestionsTitle.style.fontWeight = '600';
            suggestionsTitle.style.color = '#555';
            suggestionsTitle.style.marginBottom = '8px';
            suggestionsTitle.textContent = 'Gợi ý điểm đến thường xuyên:';
            textBoard.appendChild(suggestionsTitle);

            const suggestionsWrapper = document.createElement('div');
            suggestionsWrapper.style.display = 'flex';
            suggestionsWrapper.style.flexWrap = 'wrap';
            suggestionsWrapper.style.gap = '12px';
            suggestionsWrapper.style.marginBottom = '20px';
            
            const places = ["Nhà hát Lớn Hà Nội", "Sân bay Nội Bài", "Công ty", "Nhà riêng"];
            places.forEach(place => {
                const btn = document.createElement('button');
                btn.innerHTML = `<i class="fa-solid fa-location-dot" style="margin-right:6px;"></i> ${place}`;
                btn.style.background = '#e0f7fa';
                btn.style.border = '2px solid #b2ebf2';
                btn.style.padding = '12px 18px';
                btn.style.borderRadius = '24px';
                btn.style.color = '#00838f';
                btn.style.fontSize = '18px';
                btn.style.fontWeight = '700';
                btn.style.cursor = 'pointer';
                btn.style.transition = 'all 0.2s';
                btn.onmouseenter = () => btn.style.background = '#b2ebf2';
                btn.onmouseleave = () => btn.style.background = '#e0f7fa';
                // Nếu click vào nút, tự động điền dòng chat (do đang giả lập nên ta có thể bỏ qua tương tác thật, nhưng cứ thêm cho sinh động)
                btn.onclick = () => {
                    const status = document.getElementById('ai-status');
                    if(status) status.style.display = 'none';
                    // Thêm bubble text giả lập
                };
                suggestionsWrapper.appendChild(btn);
            });
            textBoard.appendChild(suggestionsWrapper);
            textBoard.scrollTop = textBoard.scrollHeight;

            // 1. Simulate user speaking after AI greeting
            setTimeout(() => {
                const userBubble1 = document.createElement('div');
                userBubble1.style.alignSelf = 'flex-end';
                userBubble1.style.background = '#e0f6f4';
                userBubble1.style.padding = '8px 12px';
                userBubble1.style.borderRadius = '16px 16px 0 16px';
                userBubble1.style.maxWidth = '85%';
                userBubble1.style.marginBottom = '8px';
                userBubble1.style.color = '#006064';
                textBoard.appendChild(userBubble1);

                const textToType1 = "Cho mình đến Nhà hát lớn.";
        let i = 0;
        const interval1 = setInterval(() => {
            userBubble1.innerHTML += textToType1.charAt(i);
            i++;
            textBoard.scrollTop = textBoard.scrollHeight;
            if (i >= textToType1.length) {
                clearInterval(interval1);

                // 2. AI confirms destination — show thinking first
                const thinking1 = showAiThinking(textBoard);
                setTimeout(() => {
                    thinking1.remove();
                    const aiBubble = document.createElement('div');
                    aiBubble.style.alignSelf = 'flex-start';
                    aiBubble.style.background = '#f5f5f5';
                    aiBubble.style.padding = '8px 12px';
                    aiBubble.style.borderRadius = '16px 16px 16px 0';
                    aiBubble.style.maxWidth = '85%';
                    aiBubble.style.marginBottom = '8px';
                    aiBubble.innerHTML = `<span style="color: #00bcd4; margin-right: 4px;"><i class="fa-solid fa-robot"></i> AI:</span> Bạn muốn đến <b>Nhà hát lớn Hà Nội</b> phải không?`;
                    textBoard.appendChild(aiBubble);
                    speakAI("Bạn muốn đến Nhà hát lớn Hà Nội phải không?");

                    // 3. User says Ok
                    setTimeout(() => {
                        const userBubble2 = document.createElement('div');
                        userBubble2.style.alignSelf = 'flex-end';
                        userBubble2.style.background = '#e0f6f4';
                        userBubble2.style.padding = '8px 12px';
                        userBubble2.style.borderRadius = '16px 16px 0 16px';
                        userBubble2.style.maxWidth = '85%';
                        userBubble2.style.marginBottom = '8px';
                        userBubble2.style.color = '#006064';
                        textBoard.appendChild(userBubble2);

                        const textToType2 = "Đúng rồi.";
                        let j = 0;
                        const interval2 = setInterval(() => {
                            userBubble2.innerHTML += textToType2.charAt(j);
                            j++;
                            textBoard.scrollTop = textBoard.scrollHeight;
                            if (j >= textToType2.length) {
                                clearInterval(interval2);

                                // 4. AI asks location — show thinking first
                                const thinking2 = showAiThinking(textBoard);
                                setTimeout(() => {
                                    thinking2.remove();
                                    const aiLocationBubble = document.createElement('div');
                                    aiLocationBubble.style.alignSelf = 'flex-start';
                                    aiLocationBubble.style.background = '#f5f5f5';
                                    aiLocationBubble.style.padding = '8px 12px';
                                    aiLocationBubble.style.borderRadius = '16px 16px 16px 0';
                                    aiLocationBubble.style.maxWidth = '85%';
                                    aiLocationBubble.style.marginBottom = '8px';
                                    aiLocationBubble.innerHTML = `<span style="color: #00bcd4; margin-right: 4px;"><i class="fa-solid fa-robot"></i> AI:</span> Vị trí đón của bạn là <b>Cổng Phụ - Trường Đại Học VinUni</b> phải không?`;
                                    textBoard.appendChild(aiLocationBubble);
                                    speakAI("Vị trí đón của bạn là Cổng Phụ Trường Đại Học VinUni phải không?");

                                    // 5. User says: "Tôi muốn thay đổi địa điểm đón."
                                    setTimeout(() => {
                                        const userConfirmBubble = document.createElement('div');
                                        userConfirmBubble.style.alignSelf = 'flex-end';
                                        userConfirmBubble.style.background = '#e0f6f4';
                                        userConfirmBubble.style.padding = '12px 18px';
                                        userConfirmBubble.style.borderRadius = '16px 16px 0 16px';
                                        userConfirmBubble.style.maxWidth = '85%';
                                        userConfirmBubble.style.marginBottom = '8px';
                                        userConfirmBubble.style.color = '#006064';
                                        userConfirmBubble.style.fontSize = '16px';
                                        userConfirmBubble.style.fontWeight = '600';
                                        textBoard.appendChild(userConfirmBubble);

                                        const textToTypeConfirm = "Tôi muốn thay đổi địa điểm đón.";
                                        let k = 0;
                                        const intervalConfirm = setInterval(() => {
                                            userConfirmBubble.innerHTML += textToTypeConfirm.charAt(k);
                                            k++;
                                            textBoard.scrollTop = textBoard.scrollHeight;
                                            if (k >= textToTypeConfirm.length) {
                                                clearInterval(intervalConfirm);

                                                // 6. AI responds listing alternatives — show thinking first
                                                const thinking3 = showAiThinking(textBoard);
                                                setTimeout(() => {
                                                    thinking3.remove();
                                                    const aiBubble = document.createElement('div');
                                                    aiBubble.style.alignSelf = 'flex-start';
                                                    aiBubble.style.background = '#f5f5f5';
                                                    aiBubble.style.padding = '12px 18px';
                                                    aiBubble.style.borderRadius = '16px 16px 16px 0';
                                                    aiBubble.style.maxWidth = '85%';
                                                    aiBubble.style.marginBottom = '8px';
                                                    aiBubble.style.fontSize = '16px';
                                                    aiBubble.innerHTML = `<span style="color: #00bcd4; margin-right: 4px; font-weight: 700;"><i class="fa-solid fa-robot"></i> AI:</span> Hãy chọn một địa điểm đón khác dưới đây:`;
                                                    textBoard.appendChild(aiBubble);
                                                    speakAI("Hãy chọn một địa điểm đón khác từ các gợi ý dưới đây");

                                                    // Show alternative locations options
                                                    const altContainer = document.createElement('div');
                                                    altContainer.id = 'pickup-alternatives';
                                                    altContainer.style.display = 'flex';
                                                    altContainer.style.flexDirection = 'column';
                                                    altContainer.style.gap = '12px';
                                                    altContainer.style.marginTop = '10px';
                                                    altContainer.style.marginBottom = '10px';
                                                    altContainer.style.width = '100%';

                                                    const alternatives = [
                                                        { name: "Cổng Chính - Trường Đại Học VinUni", dist: "15.0 km", price: "53.000đ" },
                                                        { name: "Tòa S2.12 - Vinhomes Ocean Park", dist: "14.5 km", price: "51.000đ" },
                                                        { name: "Times City - 458 Minh Khai", dist: "8.2 km", price: "29.000đ" }
                                                    ];

                                                    altContainer.innerHTML = alternatives.map(alt => `
                                                        <button onclick="selectAlternativePickup('${alt.name}', '${alt.dist}', '${alt.price}')" style="background-color: white; border: 2px solid #e0e0e0; padding: 16px 20px; border-radius: 16px; font-weight: 600; cursor: pointer; text-align: left; font-size: 16px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.04); transition: all 0.2s; font-family: 'Inter', sans-serif; width: 100%; border-left: 6px solid #00bcd4;">
                                                            <div style="display: flex; align-items: flex-start; gap: 8px;">
                                                                <i class="fa-solid fa-location-dot" style="color: #00bcd4; font-size: 18px; margin-top: 2px;"></i>
                                                                <span style="color: #111; line-height: 1.4;">${alt.name}</span>
                                                            </div>
                                                            <div style="display: flex; align-items: center; gap: 12px; margin-left: 26px; font-size: 13px; color: #666; font-weight: 500;">
                                                                <span><i class="fa-solid fa-route" style="margin-right: 4px;"></i>${alt.dist}</span>
                                                                <span><i class="fa-solid fa-money-bill-wave" style="margin-right: 4px; color: #4CAF50;"></i>${alt.price}</span>
                                                            </div>
                                                        </button>
                                                    `).join('');

                                                    textBoard.appendChild(altContainer);
                                                    textBoard.scrollTop = textBoard.scrollHeight;

                                                    // 7. Simulating user saying "Tòa S2.12" automatically after 3 seconds
                                                    setTimeout(() => {
                                                        selectAlternativePickup("Tòa S2.12 - Vinhomes Ocean Park", "14.5 km", "51.000đ");
                                                    }, 3000);
                                                }, 1000);
                                            }
                                        }, 50);
                                    }, 1200);
                                }, 1000); // end of timeout before AI asks location
                            }
                        }, 50); // end of interval2 (User: "Đúng rồi.")
                    }, 1200); // end of timeout before user says "Đúng rồi." (Dest)
                }, 1000); // end of timeout before AI confirms dest
            }
        }, 50); // end of interval1 (User says destination)
            }, 4000); // Wait for AI greeting to finish before user speaks
        }, 800); // AI thinking delay
    }, 1000); // Initial delay after modal opens
}

window.confirmPickupLocation = function() {
    // Hide the options container
    const opt = document.getElementById('pickup-options');
    if (opt) opt.remove();

    const textBoard = document.getElementById('ai-user-text');
    
    // User says Đúng rồi
    const userConfirmBubble = document.createElement('div');
    userConfirmBubble.style.alignSelf = 'flex-end';
    userConfirmBubble.style.background = '#e0f6f4';
    userConfirmBubble.style.padding = '8px 12px';
    userConfirmBubble.style.borderRadius = '16px 16px 0 16px';
    userConfirmBubble.style.maxWidth = '85%';
    userConfirmBubble.style.marginBottom = '8px';
    userConfirmBubble.style.color = '#006064';
    userConfirmBubble.innerHTML = "Đúng rồi.";
    textBoard.appendChild(userConfirmBubble);
    textBoard.scrollTop = textBoard.scrollHeight;

    // AI action -> search and show info — show thinking first
    const thinkingRoute = showAiThinking(textBoard);
    setTimeout(() => {
        thinkingRoute.remove();
        getTripRouteInfo("Cổng Phụ - Trường Đại Học VinUni", "15.2 km", "54.000đ");
    }, 1000);
};

window.showPickupAlternatives = function() {
    if (window.aiBookingConfirmTimer) clearTimeout(window.aiBookingConfirmTimer);
    // Remove the options container or trip actions if they exist
    const opt = document.getElementById('pickup-options');
    if (opt) opt.remove();
    const act = document.getElementById('trip-actions-container');
    if (act) act.remove();
    const altP = document.getElementById('pickup-alternatives');
    if (altP) altP.remove();
    const altD = document.getElementById('destination-alternatives');
    if (altD) altD.remove();

    const textBoard = document.getElementById('ai-user-text');
    
    // User says Chọn địa điểm khác
    const userConfirmBubble = document.createElement('div');
    userConfirmBubble.style.alignSelf = 'flex-end';
    userConfirmBubble.style.background = '#e0f6f4';
    userConfirmBubble.style.padding = '12px 18px';
    userConfirmBubble.style.borderRadius = '16px 16px 0 16px';
    userConfirmBubble.style.maxWidth = '85%';
    userConfirmBubble.style.marginBottom = '8px';
    userConfirmBubble.style.color = '#006064';
    userConfirmBubble.style.fontSize = '16px';
    userConfirmBubble.style.fontWeight = '600';
    userConfirmBubble.innerHTML = "Đổi vị trí đón.";
    textBoard.appendChild(userConfirmBubble);
    textBoard.scrollTop = textBoard.scrollHeight;

    // AI responds listing alternatives — show thinking first
    const thinkingPickup = showAiThinking(textBoard);
    setTimeout(() => {
        thinkingPickup.remove();
        const aiBubble = document.createElement('div');
        aiBubble.style.alignSelf = 'flex-start';
        aiBubble.style.background = '#f5f5f5';
        aiBubble.style.padding = '12px 18px';
        aiBubble.style.borderRadius = '16px 16px 16px 0';
        aiBubble.style.maxWidth = '85%';
        aiBubble.style.marginBottom = '8px';
        aiBubble.style.fontSize = '16px';
        aiBubble.innerHTML = `<span style="color: #00bcd4; margin-right: 4px; font-weight: 700;"><i class="fa-solid fa-robot"></i> AI:</span> Hãy chọn một địa điểm đón khác dưới đây:`;
        textBoard.appendChild(aiBubble);
        speakAI("Hãy chọn một địa điểm đón khác từ các gợi ý dưới đây");

        // Show alternative locations options
        const altContainer = document.createElement('div');
        altContainer.id = 'pickup-alternatives';
        altContainer.style.display = 'flex';
        altContainer.style.flexDirection = 'column';
        altContainer.style.gap = '12px';
        altContainer.style.marginTop = '10px';
        altContainer.style.marginBottom = '10px';
        altContainer.style.width = '100%';

        const alternatives = [
            { name: "Cổng Chính - Trường Đại Học VinUni", dist: "15.0 km", price: "53.000đ" },
            { name: "Tòa S2.12 - Vinhomes Ocean Park", dist: "14.5 km", price: "51.000đ" },
            { name: "Times City - 458 Minh Khai", dist: "8.2 km", price: "29.000đ" }
        ];

        altContainer.innerHTML = alternatives.map(alt => `
            <button onclick="selectAlternativePickup('${alt.name}', '${alt.dist}', '${alt.price}')" style="background-color: white; border: 2px solid #e0e0e0; padding: 16px 20px; border-radius: 16px; font-weight: 600; cursor: pointer; text-align: left; font-size: 16px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.04); transition: all 0.2s; font-family: 'Inter', sans-serif; width: 100%; border-left: 6px solid #00bcd4;">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <i class="fa-solid fa-location-dot" style="color: #00bcd4; font-size: 18px; margin-top: 2px;"></i>
                    <span style="color: #111; line-height: 1.4;">${alt.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; margin-left: 26px; font-size: 13px; color: #666; font-weight: 500;">
                    <span><i class="fa-solid fa-route" style="margin-right: 4px;"></i>${alt.dist}</span>
                    <span><i class="fa-solid fa-money-bill-wave" style="margin-right: 4px; color: #4CAF50;"></i>${alt.price}</span>
                </div>
            </button>
        `).join('');

        textBoard.appendChild(altContainer);
        textBoard.scrollTop = textBoard.scrollHeight;
    }, 1000);
};

window.selectAlternativePickup = function(name, dist, price) {
    const setTimeout = window.safeTimeout;
    const setInterval = window.safeInterval;
    const alt = document.getElementById('pickup-alternatives');
    if (alt) alt.remove();

    const textBoard = document.getElementById('ai-user-text');
    
    // User says the name of the new location
    const userConfirmBubble = document.createElement('div');
    userConfirmBubble.style.alignSelf = 'flex-end';
    userConfirmBubble.style.background = '#e0f6f4';
    userConfirmBubble.style.padding = '12px 18px';
    userConfirmBubble.style.borderRadius = '16px 16px 0 16px';
    userConfirmBubble.style.maxWidth = '85%';
    userConfirmBubble.style.marginBottom = '8px';
    userConfirmBubble.style.color = '#006064';
    userConfirmBubble.style.fontSize = '16px';
    userConfirmBubble.style.fontWeight = '600';
    
    // Display natural brief name if it is Vinhomes S2.12
    const displayMsg = (name === "Tòa S2.12 - Vinhomes Ocean Park") ? "Tòa S2.12." : (name + ".");
    userConfirmBubble.innerHTML = displayMsg;
    textBoard.appendChild(userConfirmBubble);
    textBoard.scrollTop = textBoard.scrollHeight;

    // AI confirms update — show thinking first
    const thinkingUpdate = showAiThinking(textBoard);
    setTimeout(() => {
        thinkingUpdate.remove();
        window.currentPickupLocation = name;
        // Send websocket event
        if (appSocket && appSocket.readyState === WebSocket.OPEN) {
            appSocket.send(JSON.stringify({ type: 'pickup_changed', location: name, dist: dist }));
        }
        const destLoc = window.currentDestinationLocation || "Nhà hát lớn Hà Nội";
        getTripRouteInfo(name, dist, price, destLoc);
    }, 1000);
};

window.showDestinationAlternatives = function() {
    if (window.aiBookingConfirmTimer) clearTimeout(window.aiBookingConfirmTimer);
    const setTimeout = window.safeTimeout;
    const setInterval = window.safeInterval;
    // Remove other action elements
    const opt = document.getElementById('pickup-options');
    if (opt) opt.remove();
    const act = document.getElementById('trip-actions-container');
    if (act) act.remove();
    const altP = document.getElementById('pickup-alternatives');
    if (altP) altP.remove();
    const altD = document.getElementById('destination-alternatives');
    if (altD) altD.remove();

    const textBoard = document.getElementById('ai-user-text');
    
    // User says Đổi điểm đến
    const userConfirmBubble = document.createElement('div');
    userConfirmBubble.style.alignSelf = 'flex-end';
    userConfirmBubble.style.background = '#e0f6f4';
    userConfirmBubble.style.padding = '12px 18px';
    userConfirmBubble.style.borderRadius = '16px 16px 0 16px';
    userConfirmBubble.style.maxWidth = '85%';
    userConfirmBubble.style.marginBottom = '8px';
    userConfirmBubble.style.color = '#006064';
    userConfirmBubble.style.fontSize = '16px';
    userConfirmBubble.style.fontWeight = '600';
    userConfirmBubble.innerHTML = "Đổi vị trí đến.";
    textBoard.appendChild(userConfirmBubble);
    textBoard.scrollTop = textBoard.scrollHeight;

    // AI lists alternative destinations — show thinking first
    const thinkingDest = showAiThinking(textBoard);
    setTimeout(() => {
        thinkingDest.remove();
        const aiBubble = document.createElement('div');
        aiBubble.style.alignSelf = 'flex-start';
        aiBubble.style.background = '#f5f5f5';
        aiBubble.style.padding = '12px 18px';
        aiBubble.style.borderRadius = '16px 16px 16px 0';
        aiBubble.style.maxWidth = '85%';
        aiBubble.style.marginBottom = '8px';
        aiBubble.style.fontSize = '16px';
        aiBubble.innerHTML = `<span style="color: #00bcd4; margin-right: 4px; font-weight: 700;"><i class="fa-solid fa-robot"></i> AI:</span> Hãy chọn một địa điểm đến khác dưới đây:`;
        textBoard.appendChild(aiBubble);
        speakAI("Hãy chọn một địa điểm đến khác từ các gợi ý dưới đây");

        // Show options
        const destContainer = document.createElement('div');
        destContainer.id = 'destination-alternatives';
        destContainer.style.display = 'flex';
        destContainer.style.flexDirection = 'column';
        destContainer.style.gap = '12px';
        destContainer.style.marginTop = '10px';
        destContainer.style.marginBottom = '10px';
        destContainer.style.width = '100%';

        const alternatives = [
            { name: "Hồ Hoàn Kiếm", dist: "16.0 km", price: "56.000đ" },
            { name: "Lăng Chủ tịch Hồ Chí Minh", dist: "18.5 km", price: "65.000đ" },
            { name: "AEON Mall Long Biên", dist: "9.5 km", price: "33.000đ" }
        ];

        destContainer.innerHTML = alternatives.map(alt => `
            <button onclick="selectAlternativeDestination('${alt.name}', '${alt.dist}', '${alt.price}')" style="background-color: white; border: 2px solid #e0e0e0; padding: 16px 20px; border-radius: 16px; font-weight: 600; cursor: pointer; text-align: left; font-size: 16px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.04); transition: all 0.2s; font-family: 'Inter', sans-serif; width: 100%; border-left: 6px solid #ffca28;">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <i class="fa-solid fa-location-dot" style="color: #f57f17; font-size: 18px; margin-top: 2px;"></i>
                    <span style="color: #111; line-height: 1.4;">${alt.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; margin-left: 26px; font-size: 13px; color: #666; font-weight: 500;">
                    <span><i class="fa-solid fa-route" style="margin-right: 4px;"></i>${alt.dist}</span>
                    <span><i class="fa-solid fa-money-bill-wave" style="margin-right: 4px; color: #4CAF50;"></i>${alt.price}</span>
                </div>
            </button>
        `).join('');

        textBoard.appendChild(destContainer);
        textBoard.scrollTop = textBoard.scrollHeight;
    }, 1000);
};

window.selectAlternativeDestination = function(name, dist, price) {
    const setTimeout = window.safeTimeout;
    const setInterval = window.safeInterval;
    const alt = document.getElementById('destination-alternatives');
    if (alt) alt.remove();

    const textBoard = document.getElementById('ai-user-text');
    
    // User says destination
    const userConfirmBubble = document.createElement('div');
    userConfirmBubble.style.alignSelf = 'flex-end';
    userConfirmBubble.style.background = '#e0f6f4';
    userConfirmBubble.style.padding = '8px 12px';
    userConfirmBubble.style.borderRadius = '16px 16px 0 16px';
    userConfirmBubble.style.maxWidth = '85%';
    userConfirmBubble.style.marginBottom = '8px';
    userConfirmBubble.style.color = '#006064';
    userConfirmBubble.innerHTML = name + ".";
    textBoard.appendChild(userConfirmBubble);
    textBoard.scrollTop = textBoard.scrollHeight;

    // AI loader — show thinking first
    const thinkingDestUpdate = showAiThinking(textBoard);
    setTimeout(() => {
        thinkingDestUpdate.remove();
        window.currentDestinationLocation = name;
        // Send websocket event
        if (appSocket && appSocket.readyState === WebSocket.OPEN) {
            appSocket.send(JSON.stringify({ type: 'destination_changed', location: name, dist: dist }));
        }
        const pickupLoc = window.currentPickupLocation || "Cổng Phụ - Trường Đại Học VinUni";
        getTripRouteInfo(pickupLoc, dist, price, name);
    }, 1000);
};

window.getTripRouteInfo = function(pickupLoc = "Cổng Phụ - Trường Đại Học VinUni", dist = "15.2 km", price = "54.000đ", destinationLoc = "Nhà hát lớn Hà Nội") {
    window.currentDistance = dist;
    window.currentPrice = price;
    window.showAiBookingConfirmPopup(pickupLoc, dist, price, destinationLoc);
};

window.confirmTripBooking = function() {
    finalizeBooking(
        window.currentPickupLocation || "Cổng Phụ - Trường Đại Học VinUni",
        window.currentDistance || "15.2 km",
        window.currentPrice || "54.000đ",
        window.currentDestinationLocation || "Nhà hát lớn Hà Nội"
    );
};

// Deprecated continueChatBooking – flow now uses showBookingConfirmation and finalizeBooking
window.continueChatBooking = undefined;

// ---------------------------------------------------
// New booking flow helpers
// ---------------------------------------------------

/**
 * Show the confirmation popup before the final booking button.
 * After the user confirms (clicks OK), the final "ĐẶT XE NGAY" button is displayed.
 */
function showBookingConfirmation(pickupLoc, dist, price, destinationLoc) {
    const textBoard = document.getElementById('ai-user-text');
    // Confirmation popup (same UI as before)
    const confirmPopup = document.createElement('div');
    confirmPopup.style.alignSelf = 'center';
    confirmPopup.style.background = '#fff8e1';
    confirmPopup.style.border = '1px solid #ffca28';
    confirmPopup.style.padding = '12px 16px';
    confirmPopup.style.borderRadius = '16px';
    confirmPopup.style.maxWidth = '85%';
    confirmPopup.style.marginBottom = '8px';
    confirmPopup.style.textAlign = 'center';
    confirmPopup.style.boxShadow = '0 4px 12px rgba(255, 193, 7, 0.15)';
    confirmPopup.innerHTML = `<span style="color: #f57c00; font-weight: 600; font-size: 15px;">
        <i class="fa-solid fa-circle-exclamation"></i> Xác nhận đặt xe</span><br>
        <span style="color: #424242; font-size: 14px; margin-top: 8px; display: inline-block;">
        Bạn đồng ý đặt chuyến đi này chứ?</span>`;
    textBoard.appendChild(confirmPopup);
    textBoard.scrollTop = textBoard.scrollHeight;
    speakAI("Xác nhận đặt xe. Bạn đồng ý đặt chuyến đi này chứ?");

    // Simulate user pressing OK after a short delay (you could replace with real UI interaction)
    setTimeout(() => {
        // Remove confirmation popup
        confirmPopup.remove();
        // Show final booking button
        showFinalBookingButton(pickupLoc, dist, price, destinationLoc);
    }, 1200);
}

/**
 * Render the final "ĐẶT XE NGAY" button. Clicking it will directly show the success popup.
 */
window.showAiBookingConfirmPopup = function(pickupLoc, dist, price, destinationLoc) {
    const popupId = 'aiBookingConfirmPopup';
    let popup = document.getElementById(popupId);
    if (!popup) {
        popup = document.createElement('div');
        popup.id = popupId;
        popup.style.position = 'fixed';
        popup.style.top = '0';
        popup.style.left = '0';
        popup.style.width = '100vw';
        popup.style.height = '100vh';
        popup.style.background = 'rgba(0,0,0,0.5)';
        popup.style.zIndex = '20000'; // above the AI modal
        popup.style.display = 'flex';
        popup.style.alignItems = 'center';
        popup.style.justifyContent = 'center';
        popup.style.backdropFilter = 'blur(2px)';
        document.body.appendChild(popup);
    }
    
    popup.innerHTML = `
        <div style="background: #fff; border-radius: 20px; padding: 24px; width: 85%; max-width: 340px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s ease-out; text-align: center;">
            <div style="width: 60px; height: 60px; background: #e0f6f4; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                <i class="fa-solid fa-car-side" style="font-size: 24px; color: #31d1c4;"></i>
            </div>
            <h3 style="margin: 0 0 12px; font-size: 20px; font-weight: 800; color: #212121;">Xác nhận đặt xe</h3>
            <p style="margin: 0 0 24px; font-size: 15px; color: #666; line-height: 1.5;">Bạn đã yêu cầu đặt xe từ <b>${pickupLoc}</b> đến <b>${destinationLoc}</b> với giá <b>${price}</b>. Bạn muốn đặt xe ngay hay hủy chuyến?</p>
            <div style="display: flex; gap: 12px;">
                <button onclick="document.getElementById('${popupId}').style.display = 'none'" style="flex: 1; padding: 14px; border: 1.5px solid #ff3b30; background: #fff; border-radius: 14px; font-size: 15px; font-weight: 700; color: #ff3b30; cursor: pointer;">Hủy chuyến</button>
                <button onclick="document.getElementById('${popupId}').style.display = 'none'; finalizeBooking('${pickupLoc}', '${dist}', '${price}', '${destinationLoc}')" style="flex: 1; padding: 14px; border: none; background: #31d1c4; border-radius: 14px; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer; box-shadow: 0 4px 12px rgba(49, 209, 196, 0.3);">Đặt xe ngay</button>
            </div>
        </div>
    `;
    popup.style.display = 'flex';
    
    // AI thông báo nội dung popup bao gồm giá tiền
    const priceTextForSpeech = price.replace('.000đ', ' nghìn đồng');
    speakAI(`Xác nhận đặt xe. Chuyến đi của bạn có giá ${priceTextForSpeech}. Bạn muốn đặt xe ngay hay hủy chuyến?`);
};

function showFinalBookingButton(pickupLoc, dist, price, destinationLoc) {
    // Không hiển thị nút trên bảng chat nữa, mà mở luôn popup thông báo
    window.showAiBookingConfirmPopup(pickupLoc, dist, price, destinationLoc);
}

/**
 * Final step after the user clicks the booking button.
 * Shows the success popup and announces the booking.
 */
function finalizeBooking(pickupLoc, dist, price, destinationLoc) {
    const textBoard = document.getElementById('ai-user-text');
    // Remove the final button
    const btnContainer = document.getElementById('trip-actions-container');
    if (btnContainer) btnContainer.remove();

    // Success popup (same UI as previously after OK)
    const successPopup = document.createElement('div');
    successPopup.style.alignSelf = 'center';
    successPopup.style.background = '#e8f5e9';
    successPopup.style.border = '1px solid #4caf50';
    successPopup.style.padding = '12px 16px';
    successPopup.style.borderRadius = '16px';
    successPopup.style.maxWidth = '85%';
    successPopup.style.marginBottom = '8px';
    successPopup.style.textAlign = 'center';
    successPopup.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.15)';
    successPopup.innerHTML = `<span style="color: #388e3c; font-weight: 600; font-size: 15px;">
        <i class="fa-solid fa-circle-check"></i> Đặt xe thành công</span><br>
        <span style="color: #424242; font-size: 14px; margin-top: 8px; display: inline-block;">
        Hệ thống đang gọi tài xế cho bạn...</span>`;
    textBoard.appendChild(successPopup);
    textBoard.scrollTop = textBoard.scrollHeight;
    speakAI("Đặt xe thành công. Hệ thống đang gọi tài xế cho bạn.");

    // AI finding driver
    setTimeout(() => {
        const actionBubble = document.createElement('div');
        actionBubble.style.alignSelf = 'center';
        actionBubble.style.background = '#e8f5e9';
        actionBubble.style.color = '#2e7d32';
        actionBubble.style.padding = '6px 12px';
        actionBubble.style.borderRadius = '20px';
        actionBubble.style.fontSize = '13px';
        actionBubble.style.marginTop = '8px';
        actionBubble.style.marginBottom = '8px';
        actionBubble.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i> Đang tìm kiếm tài xế quanh đây...`;
        textBoard.appendChild(actionBubble);
        textBoard.scrollTop = textBoard.scrollHeight;

        // Wait 5 seconds
        setTimeout(() => {
            actionBubble.style.display = 'none';

            const foundBubble = document.createElement('div');
            foundBubble.style.alignSelf = 'flex-start';
            foundBubble.style.background = '#f5f5f5';
            foundBubble.style.padding = '8px 12px';
            foundBubble.style.borderRadius = '16px 16px 16px 0';
            foundBubble.style.maxWidth = '85%';
            foundBubble.style.marginBottom = '8px';
            foundBubble.innerHTML = `<span style="color: #00bcd4; margin-right: 4px;"><i class="fa-solid fa-robot"></i> AI:</span> Đã tìm thấy tài xế!`;
            textBoard.appendChild(foundBubble);
            textBoard.scrollTop = textBoard.scrollHeight;
            speakAI("Đã tìm thấy tài xế.");

            // Broadcast driver found to WebSocket
            if (appSocket && appSocket.readyState === WebSocket.OPEN) {
                appSocket.send(JSON.stringify({
                    type: 'driver_found',
                    pickup: pickupLoc || window.currentPickupLocation || "Cổng Phụ - Trường Đại Học VinUni",
                    destination: destinationLoc || window.currentDestinationLocation || "Nhà hát lớn Hà Nội",
                    dist: dist || window.currentDistance || "15.2 km",
                    price: price || window.currentPrice || "54.000đ"
                }));
            }

            let tripAcceptFallback = setTimeout(() => {
                if (window.onWebSocketTripAccepted) {
                    console.log("Fallback: Driver didn't accept in 15 seconds. Simulating acceptance.");
                    window.onWebSocketTripAccepted();
                }
            }, 15000);

            // Register the trip accepted drawing logic
            window.onWebSocketTripAccepted = () => {
                clearTimeout(tripAcceptFallback);
                window.onWebSocketTripAccepted = null;

                const driverInfoBubble = document.createElement('div');
                driverInfoBubble.style.alignSelf = 'flex-start';
                driverInfoBubble.style.background = '#ffffff';
                driverInfoBubble.style.border = '2px solid #e0f6f4';
                driverInfoBubble.style.padding = '18px 20px';
                driverInfoBubble.style.borderRadius = '20px 20px 20px 0';
                driverInfoBubble.style.maxWidth = '95%';
                driverInfoBubble.style.marginBottom = '12px';
                driverInfoBubble.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';

                driverInfoBubble.innerHTML = `
                    <div style="font-family: 'Inter', sans-serif; line-height: 1.5; color: #333;">
                        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
                            <!-- Large round avatar -->
                            <div style="position: relative; flex-shrink: 0;">
                                <img src="https://randomuser.me/api/portraits/men/32.jpg" style="width: 64px; height: 64px; border-radius: 50%; border: 3px solid #00bcd4; object-fit: cover;">
                                <div style="position: absolute; bottom: -4px; right: -4px; background-color: #ff9800; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; border: 2px solid white; display: flex; align-items: center; gap: 2px;">
                                    <i class="fa-solid fa-star"></i>4.9
                                </div>
                            </div>
                            <!-- Driver basic info -->
                            <div style="text-align: left;">
                                <span style="color: #757575; font-size: 12px; font-weight: 500; display: block; text-transform: uppercase; letter-spacing: 0.5px;">Tài xế đang đến</span>
                                <b style="color: #111; font-size: 19px; display: block; margin-top: 2px;">Nguyễn Sỹ Cường</b>
                                <span style="color: #666; font-size: 13px; font-weight: 500; display: block; margin-top: 2px;">⭐ 4.9 (1.2K+ chuyến đi)</span>
                            </div>
                        </div>

                        <!-- Vehicle detail row -->
                        <div style="background-color: #f5fdfc; border: 1.5px solid #b2dfdb; padding: 12px 14px; border-radius: 12px; margin-bottom: 12px; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-motorcycle" style="color: #00bcd4; font-size: 18px;"></i>
                                <div>
                                    <span style="color: #666; font-size: 12px; display: block;">Biển số xe máy điện (EVO XANH CYAN)</span>
                                    <b style="color: #111; font-size: 18px; letter-spacing: 0.5px; display: block; margin-top: 2px;">29AB-907.77</b>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: #00897b; font-weight: 600;">
                                <i class="fa-solid fa-leaf"></i>
                                <span>Xe điện VinFast Evo200 - Thân thiện môi trường</span>
                            </div>
                        </div>

                        <!-- ETA row -->
                        <div style="display: flex; align-items: center; justify-content: space-between; background-color: #e8f5e9; border: 1.5px solid #a5d6a7; padding: 12px 14px; border-radius: 12px; margin-bottom: 16px; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-clock" style="color: #2e7d32; font-size: 18px;"></i>
                                <div>
                                    <span style="color: #2e7d32; font-size: 12px; font-weight: 600; display: block;">Thời gian đón dự kiến</span>
                                    <b style="color: #1b5e20; font-size: 18px; display: block; margin-top: 1px;">3 phút nữa sẽ đến</b>
                                </div>
                            </div>
                        </div>

                        <!-- Contact buttons -->
                        <div style="display: flex; gap: 10px; justify-content: space-between; width: 100%;">
                            <button onclick="showIncomingCall()" style="flex: 1; background-color: #34c759; color: white; border: none; padding: 14px; border-radius: 14px; font-weight: 700; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 10px rgba(52,199,89,0.2); font-family: 'Inter', sans-serif;">
                                <i class="fa-solid fa-phone" style="font-size: 16px;"></i>
                                Gọi điện
                            </button>
                            <button onclick="answerCall()" style="flex: 1; background-color: #f2f2f7; color: #333; border: 1px solid #e5e5ea; padding: 14px; border-radius: 14px; font-weight: 700; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: 'Inter', sans-serif;">
                                <i class="fa-solid fa-comment" style="color: #00bcd4; font-size: 16px;"></i>
                                Nhắn tin
                            </button>
                        </div>
                    </div>
                `;

                textBoard.appendChild(driverInfoBubble);
                textBoard.scrollTop = textBoard.scrollHeight;
                speakAI("Thông tin tài xế. Nguyễn Sỹ Cường. Biển số xe: 29 A B, 9 0 7, 7 7. Tài xế sẽ đến trong 3 phút.");

                // Simulate real-time location updates every 5 seconds
                const locations = [
                    "Đường Đa Tốn, Gia Lâm",
                    "Đường gom Cao tốc Hà Nội - Hải Phòng",
                    "Khu đô thị Vinhomes Ocean Park",
                    "Cách bạn 500 mét, chuẩn bị rẽ vào cổng",
                    "Đã đến Cổng Phụ - Trường Đại Học VinUni. Vui lòng chuẩn bị lên xe!"
                ];

                const routeAnnouncements = [
                    "Bác tài đã bắt đầu di chuyển từ Cổng Phụ VinUni. AI Xanh SM xin chúc quý khách một chuyến đi an toàn và vui vẻ!",
                    // "Xe đang di chuyển trên đường nội khu Đại học VinUni, chuẩn bị rẽ ra đại lộ Đại Dương.",
                    // "Đã rẽ phải vào đại lộ Đại Dương. Tốc độ xe ổn định ở mức 40 kilômét trên giờ. Thời tiết hôm nay rất thuận lợi cho chuyến đi của bạn.",
                    // "Chuẩn bị đi qua bùng binh Đại Dương, xe sẽ rẽ ra đường Lý Thánh Tông hướng về phía cao tốc.",
                    // "Đang di chuyển trên đường Lý Thánh Tông. Phía trước có mật độ giao thông thưa thớt, xe đang di chuyển thông thoáng.",
                    // "Xe chuẩn bị rẽ vào đường gom Đại lộ Vinhomes Ocean Park để đi về hướng cầu Vĩnh Tuy.",
                    // "Hiện tại xe đang đi song song với đường cao tốc Hà Nội - Hải Phòng. Quý khách vui lòng thắt dây an toàn đầy đủ.",
                    // "Chuẩn bị đi qua khu vực Đa Tốn. Quãng đường còn lại đến Nhà Hát Lớn là khoảng 12 kilômét.",
                    // "Xe đã đi vào đường Cổ Linh. Đây là tuyến đường chính kết nối Quận Long Biên và Gia Lâm.",
                    // "Đang di chuyển qua Aeon Mall Long Biên bên tay phải quý khách. Giao thông tại ngã tư Cổ Linh hiện tại ổn định.",
                    // "Chuẩn bị lên cầu Vĩnh Tuy để vượt sông Hồng sang quận Hai Bà Trưng. Quý khách có thể ngắm nhìn sông Hồng bên tay phải.",
                    // "Xe đang di chuyển trên cầu Vĩnh Tuy. Gió nhẹ, tốc độ xe đạt 50 kilômét trên giờ. Chúng ta đã đi được nửa chặng đường.",
                    // "Đã đi hết cầu Vĩnh Tuy, xe chuẩn bị rẽ vào đường Minh Khai để hướng về trung tâm thành phố.",
                    // "Đang di chuyển trên đường Minh Khai. Giao thông phía dưới hơi đông đúc nhưng xe chúng ta vẫn di chuyển tốt.",
                    // "Chuẩn bị rẽ phải vào phố Kim Ngưu tại nút giao tiếp theo. Quý khách vui lòng chú ý hành lý cá nhân.",
                    // "Xe đang đi dọc theo phố Kim Ngưu, chuẩn bị rẽ sang đường Trần Khát Chân.",
                    // "Đã rẽ vào đường Trần Khát Chân. Quãng đường đến Nhà Hát Lớn Hà Nội còn lại khoảng 3 kilômét, dự kiến 5 phút nữa sẽ tới.",
                    // "Xe chuẩn bị rẽ vào phố Lò Đúc. Phố Lò Đúc có nhiều cây sao đen cổ thụ tuyệt đẹp bên đường.",
                    // "Đang di chuyển qua ngã năm Lò Đúc - Phan Chu Trinh. Chúng ta đang tiến rất gần đến phố Tràng Tiền.",
                    "Xe đã đi vào phố Tràng Tiền và đang tiến vào khu vực Nhà Hát Lớn Hà Nội. Điểm đến của quý khách ở phía trước. Cảm ơn quý khách đã đồng hành cùng Xanh SM!"
                ];

                let locIndex = 0;

                function sendLocationUpdate() {
                    if (locIndex >= locations.length) return;

                    const locationBubble = document.createElement('div');
                    locationBubble.style.alignSelf = 'flex-start';
                    locationBubble.style.background = '#f5f5f5';
                    locationBubble.style.padding = '8px 12px';
                    locationBubble.style.borderRadius = '16px 16px 16px 0';
                    locationBubble.style.maxWidth = '85%';
                    locationBubble.style.marginBottom = '8px';

                    let text = `Tài xế đang ở <b>${locations[locIndex]}</b>.`;
                    if (locIndex === 3) text = `Tài xế đang <b>${locations[locIndex]}</b>.`;
                    if (locIndex === 4) text = `<b style="color: #4CAF50;">${locations[locIndex]}</b>`;

                    locationBubble.innerHTML = `<span style="color: #00bcd4; margin-right: 4px;"><i class="fa-solid fa-robot"></i> AI:</span> ${text}`;
                    textBoard.appendChild(locationBubble);
                    textBoard.scrollTop = textBoard.scrollHeight;
                    speakAI(text.replace(/<[^>]*>?/gm, ''));

                    locIndex++;

                    if (locIndex < locations.length) {
                        setTimeout(sendLocationUpdate, 5000);
                    } else {
                        // Driver arrived at pickup location. Stop and wait for driver screen WebSocket confirmation.
                        console.log('Driver arrived at VinUni. Waiting for driver to confirm pickup via WebSocket...');
                        
                        let fallbackTimer = setTimeout(() => {
                            if (typeof onWebSocketPickupConfirmed !== 'undefined' && onWebSocketPickupConfirmed) {
                                console.log('WebSocket pickup confirmed fallback triggered.');
                                onWebSocketPickupConfirmed();
                            }
                        }, 25000); // 25s auto fallback if websocket not connected
                        
                        window.onWebSocketPickupConfirmed = () => {
                            clearTimeout(fallbackTimer);
                            window.onWebSocketPickupConfirmed = null;
                            sendPickupConfirmation();
                        };
                    }
                }

                function sendPickupConfirmation() {
                    const confirmBubble = document.createElement('div');
                    confirmBubble.style.alignSelf = 'flex-start';
                    confirmBubble.style.background = '#e8f5e9';
                    confirmBubble.style.border = '1px solid #a5d6a7';
                    confirmBubble.style.padding = '10px 14px';
                    confirmBubble.style.borderRadius = '16px 16px 16px 0';
                    confirmBubble.style.maxWidth = '85%';
                    confirmBubble.style.marginBottom = '8px';
                    confirmBubble.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.1)';

                    confirmBubble.innerHTML = `<span style="color: #2e7d32; margin-right: 4px;"><i class="fa-solid fa-circle-check"></i> AI:</span> <b style="color: #1b5e20;">Tài xế Nguyễn Sỹ Cường đã xác nhận đón hành khách thành công. Bắt đầu hành trình!</b>`;
                    textBoard.appendChild(confirmBubble);
                    textBoard.scrollTop = textBoard.scrollHeight;
                    speakAI("Tài xế Nguyễn Sỹ Cường đã xác nhận đón hành khách thành công. Bắt đầu hành trình!");

                    let announcementIndex = 0;

                    function sendAnnouncement() {
                        // Wait for WebSocket trip completed confirmation from driver side
                        console.log('All announcements skipped. Waiting for driver to confirm trip completion via WebSocket...');
                        
                        let completionFallbackTimer = setTimeout(() => {
                            if (typeof window.onWebSocketTripCompleted !== 'undefined' && window.onWebSocketTripCompleted) {
                                console.log('WebSocket trip completion fallback triggered.');
                                window.onWebSocketTripCompleted();
                            }
                        }, 25000); // 25s auto fallback if websocket not connected
                        
                        window.onWebSocketTripCompleted = () => {
                            clearTimeout(completionFallbackTimer);
                            window.onWebSocketTripCompleted = null;
                            sendTripCompletion();
                        };
                    }

                    function sendTripCompletion() {
                        const textBoard = document.getElementById('ai-user-text');
                        if (textBoard) {
                            const completionBubble = document.createElement('div');
                            completionBubble.style.alignSelf = 'flex-start';
                            completionBubble.style.background = '#e8f5e9';
                            completionBubble.style.padding = '12px 18px';
                            completionBubble.style.borderRadius = '16px 16px 16px 0';
                            completionBubble.style.maxWidth = '85%';
                            completionBubble.style.marginBottom = '16px';
                            completionBubble.style.fontSize = '15px';
                            completionBubble.style.border = '1px solid #c8e6c9';
                            const finalPrice = window.currentPrice || '54.000đ';
                            completionBubble.innerHTML = `<span style="color: #2e7d32; margin-right: 4px; font-weight: 700;"><i class="fa-solid fa-robot"></i> AI:</span> Tài xế Nguyễn Sỹ Cường đã xác nhận hoàn thành chuyến đi. Số tiền <b>${finalPrice}</b> đã được trừ trong ví Xanh Pay của bạn. Cảm ơn bạn đã lựa chọn Xanh SM!`;
                            textBoard.appendChild(completionBubble);
                            textBoard.scrollTop = textBoard.scrollHeight;
                            
                            const priceToSpeak = finalPrice.replace('.000đ', ' nghìn đồng');
                            speakAI(`Tài xế Nguyễn Sỹ Cường đã xác nhận hoàn thành chuyến đi. Số tiền ${priceToSpeak} đã được trừ trong ví Xanh Pay của bạn. Cảm ơn bạn đã lựa chọn Xanh SM!`);
                        }
                        
                        setTimeout(() => {
                            closeAiModal();
                            showTripSuccessAnimation();
                        }, 10000);
                    }

                    // Start route updates after 1 second
                    setTimeout(sendAnnouncement, 1000);
                }

                // Start sending the first update after 1 second
                setTimeout(sendLocationUpdate, 1000);

            };
        }, 5000); // Wait 5 secs for driver to be found

    }, 1500); // finding driver delay AFTER success popup
}

function showTripSuccessAnimation() {
    if (!document.getElementById('success-anim-style')) {
        const style = document.createElement('style');
        style.id = 'success-anim-style';
        style.textContent = `
            @keyframes starFlyUp {
                0% { transform: translate(-50%, 100vh) scale(0.5) rotate(0deg); opacity: 0; }
                20% { opacity: 1; transform: translate(calc(-50% - 30px), 60vh) scale(1) rotate(72deg); }
                40% { transform: translate(calc(-50% + 30px), 30vh) scale(1.5) rotate(144deg); }
                60% { transform: translate(-50%, 50%) scale(2) rotate(216deg); }
                100% { transform: translate(-50%, -50%) scale(2.5) rotate(360deg); }
            }
            @keyframes starGlow {
                0% { filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5)); transform: translate(-50%, -50%) scale(2.5); opacity: 1; }
                50% { filter: drop-shadow(0 0 40px rgba(255, 215, 0, 1)) drop-shadow(0 0 80px rgba(255, 255, 255, 0.8)); transform: translate(-50%, -50%) scale(3.5); opacity: 1; }
                100% { filter: drop-shadow(0 0 100px rgba(255, 215, 0, 0)); transform: translate(-50%, -50%) scale(4.5); opacity: 0; }
            }
            @keyframes particleBurst {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
            }
            @keyframes checkmarkPop {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            @keyframes textFadeInUp {
                0% { opacity: 0; transform: translate(-50%, 20px); }
                100% { opacity: 1; transform: translate(-50%, 0); }
            }
            
            .success-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.7);
                z-index: 20000;
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: none;
                transition: opacity 0.5s ease;
            }
            
            .star-icon {
                position: absolute;
                top: 50%; left: 50%;
                font-size: 40px;
                color: #FFD700;
                transform: translate(-50%, -50%);
            }
            
            .star-flying {
                animation: starFlyUp 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
            }
            
            .star-glowing {
                animation: starGlow 0.6s ease-out forwards;
            }
            
            .particle-burst {
                position: absolute;
                top: 50%; left: 50%;
                width: 200px; height: 200px;
                background: radial-gradient(circle, rgba(255,215,0,0.8) 0%, rgba(255,255,255,0) 70%);
                animation: particleBurst 0.6s ease-out forwards;
            }
            
            .mini-star {
                position: absolute;
                color: #FFD700;
                font-size: 16px;
                opacity: 0;
                transform: translate(-50%, -50%) scale(0);
                animation: miniStarPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            
            @keyframes miniStarPop {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0) rotate(0deg); }
                100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(180deg); }
            }
            
            .success-text {
                position: absolute;
                top: calc(50% + 90px); left: 50%;
                font-size: 32px;
                font-weight: 900;
                color: #FFD700;
                text-transform: uppercase;
                letter-spacing: 2px;
                text-shadow: 0 4px 15px rgba(255,215,0,0.6);
                opacity: 0;
            }
            .text-show {
                animation: textFadeInUp 0.5s ease forwards;
            }
        `;
        document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.className = 'success-overlay';
    
    const star = document.createElement('i');
    star.className = 'fa-solid fa-star star-icon star-flying';
    
    overlay.appendChild(star);
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        star.classList.remove('star-flying');
        star.classList.add('star-glowing');
        
        const burst = document.createElement('div');
        burst.className = 'particle-burst';
        overlay.appendChild(burst);
        
        setTimeout(() => {
            // Thêm các ngôi sao nhỏ xuất hiện ngẫu nhiên trên khắp màn hình
            const numStars = 25;
            for (let i = 0; i < numStars; i++) {
                const miniStar = document.createElement('i');
                miniStar.className = 'fa-solid fa-star mini-star';
                
                // Vị trí ngẫu nhiên từ 5% đến 95% màn hình (chiều ngang) 
                // và 10% đến 90% (chiều dọc)
                const randomX = 5 + Math.random() * 90;
                const randomY = 10 + Math.random() * 80;
                
                miniStar.style.left = `${randomX}%`;
                miniStar.style.top = `${randomY}%`;
                
                // Thời gian xuất hiện lác đác ngẫu nhiên (từ 0s đến 0.6s)
                miniStar.style.animationDelay = `${Math.random() * 0.6}s`;
                // Kích thước to nhỏ khác nhau
                miniStar.style.fontSize = `${10 + Math.random() * 18}px`;
                
                overlay.appendChild(miniStar);
            }
            
            const text = document.createElement('div');
            text.className = 'success-text text-show';
            text.textContent = 'Thành công';
            overlay.appendChild(text);
            
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 500);
            }, 3000);
            
        }, 300);
    }, 1200);
}

window.finalizeBooking = finalizeBooking;

let micVisualizerRAF = null;
let micAudioContext = null;
let micStream = null;

window.startRealMicVisualizer = function() {
    if (micAudioContext) {
        window.stopRealMicVisualizer();
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            micStream = stream;
            micAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = micAudioContext.createMediaStreamSource(stream);
            const analyser = micAudioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const spans = document.querySelectorAll('.pill-waveform span');
            if (spans.length === 0) return;

            const pill = document.getElementById('ai-voice-pill');
            if (pill) {
                pill.classList.remove('pill-speaking-user', 'pill-speaking-ai');
            }

            spans.forEach(span => {
                span.style.animation = 'none';
                span.style.transition = 'transform 0.05s ease';
            });

            function renderFrame() {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                const volume = Math.min(1, average / 40); // Độ nhạy

                spans.forEach((span, index) => {
                    const distanceToCenter = Math.abs(index - Math.floor(spans.length / 2));
                    const maxScale = 2.5 - (distanceToCenter * 0.25);
                    const scaleY = 0.4 + volume * maxScale * (0.8 + Math.random() * 0.4);
                    span.style.transform = `scaleY(${scaleY})`;
                });

                micVisualizerRAF = requestAnimationFrame(renderFrame);
            }
            
            renderFrame();
            
            const status = document.getElementById('ai-status');
            if (status) {
                status.textContent = 'Đang nghe... (Nói to để thấy hiệu ứng)';
                status.style.display = 'block';
                status.style.color = '#2196F3';
            }
        })
        .catch(err => {
            console.error("Mic error:", err);
            alert("Không thể truy cập microphone. Vui lòng cấp quyền micro cho trình duyệt.");
        });
};

window.stopRealMicVisualizer = function() {
    if (micVisualizerRAF) {
        cancelAnimationFrame(micVisualizerRAF);
        micVisualizerRAF = null;
    }
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (micAudioContext) {
        micAudioContext.close();
        micAudioContext = null;
    }
    const spans = document.querySelectorAll('.pill-waveform span');
    spans.forEach(span => {
        span.style.animation = '';
        span.style.transition = '';
        span.style.transform = '';
    });
};

function closeAiModal() {
    const modal = document.getElementById('ai-voice-modal');
    if (modal) {
        // Animate slide down before removing
        const inner = modal.firstElementChild;
        if (inner) {
            inner.style.transition = 'transform 0.3s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.3s ease';
            inner.style.transform = 'translateY(100%)';
            inner.style.opacity = '0';
        }
        setTimeout(() => {
            modal.remove();
            stopAiWaveform();
            window.stopRealMicVisualizer();
        }, 300);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        window.clearAiModalTimers();
        if (modalSpeechRecognition) {
            try { modalSpeechRecognition.abort(); } catch(e) {}
            modalSpeechRecognition = null;
        }
    }
}

// =============================================
// AI Waveform Canvas Visualizer — Split Mode
// 'ai'   → left side animates  (AI speaking)
// 'user' → right side animates (User speaking)
// 'idle' → both sides flat
// =============================================
let _waveformRAF = null;
let _waveformMode = 'idle'; // 'ai' | 'user' | 'idle'

window.setWaveformMode = function(mode) {
    _waveformMode = mode;
    const pill = document.getElementById('ai-voice-pill');
    if (pill) {
        if (mode === 'user') {
            pill.classList.add('pill-speaking-user');
            pill.classList.remove('pill-speaking-ai');
        } else if (mode === 'ai') {
            pill.classList.add('pill-speaking-ai');
            pill.classList.remove('pill-speaking-user');
        } else {
            pill.classList.remove('pill-speaking-user', 'pill-speaking-ai');
        }
    }
};

function startAiWaveform() {
    const canvas = document.getElementById('ai-waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Set mode to 'both' initially so animation is immediately visible
    _waveformMode = 'both';

    function resize() {
        // Use offsetWidth if available, fallback to window.innerWidth
        const w = canvas.offsetWidth  || canvas.parentElement?.offsetWidth  || window.innerWidth;
        const h = canvas.offsetHeight || canvas.parentElement?.offsetHeight || 160;
        const dpr = window.devicePixelRatio || 1;
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    }
    resize();
    const resizeHandler = () => resize();
    window.addEventListener('resize', resizeHandler);

    const NUM_BARS = 60;   // per side
    const BAR_GAP  = 2;
    const MIC_GAP  = 56;   // dead zone px on each side of canvas center for mic button

    let phase = 0;
    const noiseL = Array.from({ length: NUM_BARS }, () => Math.random());
    const noiseR = Array.from({ length: NUM_BARS }, () => Math.random());

    // Smooth amplitude multipliers (ease in/out when mode changes)
    let ampL = 0, ampR = 0;
    const AMP_SPEED = 0.07;

    function drawBar(x, barW, barH, centerY, colorStop0, colorStop1, colorStop2) {
        const r  = Math.min(barW / 2, 3);
        const bx = x, by = centerY - barH, bw = barW, bh = barH * 2;
        const grad = ctx.createLinearGradient(0, by, 0, by + bh);
        grad.addColorStop(0,   colorStop0);
        grad.addColorStop(0.45, colorStop1);
        grad.addColorStop(1,   colorStop2);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + bw - r, by);
        ctx.quadraticCurveTo(bx + bw, by,      bx + bw, by + r);
        ctx.lineTo(bx + bw, by + bh - r);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        ctx.lineTo(bx + r,  by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx,  by + bh - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by,       bx + r, by);
        ctx.closePath();
        ctx.fill();
    }

    function draw() {
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);
        phase += 0.05;

        // Smooth amplitude targets
        const targetL = (_waveformMode === 'ai' || _waveformMode === 'both') ? 1 : 0;
        const targetR = (_waveformMode === 'user' || _waveformMode === 'both') ? 1 : 0;
        ampL += (targetL - ampL) * AMP_SPEED;
        ampR += (targetR - ampR) * AMP_SPEED;

        const centerY = h / 2;
        const centerX = w / 2;

        // Usable width on each side (excluding mic dead zone)
        const sideW = centerX - MIC_GAP;
        const barW  = Math.max(2, (sideW - BAR_GAP * (NUM_BARS - 1)) / NUM_BARS);

        // Center flat line (always visible, subtle)
        ctx.strokeStyle = 'rgba(150,200,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(w, centerY);
        ctx.stroke();

        // ── LEFT SIDE (AI speaking) ──────────────────────
        // Bars drawn right-to-left from (centerX - MIC_GAP) toward 0
        for (let i = 0; i < NUM_BARS; i++) {
            const t = i / NUM_BARS;
            const idleH = 2; // always show tiny flat bars

            let barH = idleH;
            if (ampL > 0.01) {
                const w1 = Math.sin(phase       + t * Math.PI * 5) * 0.38;
                const w2 = Math.sin(phase * 1.8 + t * Math.PI * 3) * 0.22;
                const w3 = Math.sin(phase * 0.5 + t * Math.PI * 7) * 0.18;
                noiseL[i] += (Math.random() - 0.5) * 0.1;
                noiseL[i]  = Math.max(0.05, Math.min(0.95, noiseL[i]));
                const raw = (Math.abs(w1 + w2 + w3) + noiseL[i] * 0.35) * 0.9 + 0.06;
                barH = idleH + raw * centerY * 0.82 * ampL;
            }

            // x counts from right-edge of left zone leftward
            const x = centerX - MIC_GAP - (i + 1) * (barW + BAR_GAP);
            if (x < 0) continue;

            const alpha = 0.3 + ampL * 0.65;
            drawBar(x, barW, barH, centerY,
                `rgba(0,242,254,${alpha})`,
                `rgba(79,172,254,${alpha * 0.9})`,
                `rgba(0,188,212,${alpha * 0.7})`
            );
        }

        // ── RIGHT SIDE (User speaking) ──────────────────────
        // Bars drawn left-to-right from (centerX + MIC_GAP) toward w
        for (let i = 0; i < NUM_BARS; i++) {
            const t = i / NUM_BARS;
            const idleH = 2;

            let barH = idleH;
            if (ampR > 0.01) {
                const w1 = Math.sin(phase * 1.1  + t * Math.PI * 4) * 0.4;
                const w2 = Math.sin(phase * 0.7  + t * Math.PI * 6) * 0.25;
                const w3 = Math.sin(phase * 2.0  + t * Math.PI * 2) * 0.15;
                noiseR[i] += (Math.random() - 0.5) * 0.12;
                noiseR[i]  = Math.max(0.05, Math.min(0.95, noiseR[i]));
                const raw = (Math.abs(w1 + w2 + w3) + noiseR[i] * 0.35) * 0.9 + 0.06;
                barH = idleH + raw * centerY * 0.82 * ampR;
            }

            const x = centerX + MIC_GAP + i * (barW + BAR_GAP);
            if (x + barW > w) break;

            const alpha = 0.3 + ampR * 0.65;
            drawBar(x, barW, barH, centerY,
                `rgba(255,180,50,${alpha})`,
                `rgba(34,197,94,${alpha * 0.9})`,
                `rgba(16,185,129,${alpha * 0.75})`
            );
        }

        // Labels
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = `rgba(0,188,212,${0.35 + ampL * 0.55})`;
        ctx.fillText('🤖 AI', 8, centerY - 6);

        ctx.textAlign = 'right';
        ctx.fillStyle = `rgba(34,197,94,${0.35 + ampR * 0.55})`;
        ctx.fillText('Bạn 👤', w - 8, centerY - 6);

        if (document.getElementById('ai-waveform-canvas')) {
            _waveformRAF = requestAnimationFrame(draw);
        } else {
            window.removeEventListener('resize', resizeHandler);
        }
    }

    _waveformRAF = requestAnimationFrame(draw);
}

function stopAiWaveform() {
    if (_waveformRAF) {
        cancelAnimationFrame(_waveformRAF);
        _waveformRAF = null;
    }
    _waveformMode = 'idle';
}



window.speakAI = function (text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        // Waveform: AI speaking → left side
        utterance.onstart = () => window.setWaveformMode && window.setWaveformMode('ai');
        utterance.onend   = () => window.setWaveformMode && window.setWaveformMode('idle');
        utterance.onerror = () => window.setWaveformMode && window.setWaveformMode('idle');
        window.speechSynthesis.speak(utterance);
    }
}

// --- Calling Simulation System for Passenger Side ---
let isIncomingCallActive = false;
let callRecognition = null;
let modalSpeechRecognition = null;

function startSpeechRecognitionForModal() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        if (modalSpeechRecognition) {
            try { modalSpeechRecognition.abort(); } catch(e) {}
        }
        modalSpeechRecognition = new SpeechRecognition();
        modalSpeechRecognition.lang = 'vi-VN';
        modalSpeechRecognition.interimResults = true;
        modalSpeechRecognition.maxAlternatives = 1;

        // Waveform: user mic picks up sound → right side
        modalSpeechRecognition.onsoundstart = () => {
            window.setWaveformMode && window.setWaveformMode('user');
        };
        modalSpeechRecognition.onspeechend = () => {
            window.setWaveformMode && window.setWaveformMode('idle');
        };
        modalSpeechRecognition.onsoundend = () => {
            window.setWaveformMode && window.setWaveformMode('idle');
        };

        modalSpeechRecognition.onresult = (event) => {
            const resultText = event.results[event.results.length - 1][0].transcript.toLowerCase();
            console.log("Speech recognized in Modal:", resultText);
            // Keep right side active while interim results come in
            if (!event.results[event.results.length - 1].isFinal) {
                window.setWaveformMode && window.setWaveformMode('user');
                return;
            }
            window.setWaveformMode && window.setWaveformMode('idle');

            if (resultText.includes('đặt xe') || resultText.includes('gọi xe') || resultText.includes('muốn đặt xe') || resultText.includes('đặt xe ngay')) {
                const bookingBtn = document.getElementById('trip-actions-container');
                if (bookingBtn) {
                    window.confirmTripBooking();
                }
            }
        };

        modalSpeechRecognition.onend = () => {
            window.setWaveformMode && window.setWaveformMode('idle');
            const modal = document.getElementById('ai-voice-modal');
            if (modal && modalSpeechRecognition) {
                try { modalSpeechRecognition.start(); } catch(e) {}
            }
        };
        
        try {
            modalSpeechRecognition.start();
            console.log("Modal speech recognition started.");
        } catch (e) {
            console.error("Modal speech recognition start failed:", e);
        }
    }
}

window.showIncomingCall = function() {
    isIncomingCallActive = true;
    
    // Play Incoming call audio voice
    speakAI("Hành khách ơi, bác tài Nguyễn Sỹ Cường đang gọi điện cho bạn. Bạn có muốn nghe không? Hãy nói Nghe, nói Xe, hoặc bấm nút trả lời nhé.");
    
    let callOverlay = document.getElementById('incoming-call-overlay');
    if (!callOverlay) {
        callOverlay = document.createElement('div');
        callOverlay.id = 'incoming-call-overlay';
        callOverlay.style.position = 'fixed';
        callOverlay.style.top = '0';
        callOverlay.style.left = '0';
        callOverlay.style.width = '100vw';
        callOverlay.style.height = '100vh';
        callOverlay.style.background = 'linear-gradient(180deg, #1c1c1e 0%, #000000 100%)';
        callOverlay.style.zIndex = '100010';
        callOverlay.style.display = 'flex';
        callOverlay.style.flexDirection = 'column';
        callOverlay.style.alignItems = 'center';
        callOverlay.style.justifyContent = 'space-around';
        callOverlay.style.padding = '40px 24px';
        callOverlay.style.color = 'white';
        callOverlay.style.fontFamily = 'Inter, sans-serif';
        
        callOverlay.innerHTML = `
            <!-- Simulated status bar in call overlay to keep premium look -->
            <div style="position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 600; padding: 12px 24px 6px; color: #fff; opacity: 0.8; z-index: 100;">
                <span class="time">09:17</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <i class="fa-solid fa-signal" style="font-size: 12px;"></i>
                    <i class="fa-solid fa-wifi" style="font-size: 12px;"></i>
                    <i class="fa-solid fa-battery-three-quarters" style="font-size: 12px;"></i>
                </div>
            </div>

            <div style="text-align: center; margin-top: 40px;">
                <span style="color: #8e8e93; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 12px;">Cuộc gọi đến từ Xanh SM</span>
                <h2 style="font-size: 28px; font-weight: 800; margin-bottom: 6px;">Nguyễn Sỹ Cường</h2>
                <span style="color: #34c759; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; animation: blinkText 1.5s infinite;">
                    <i class="fa-solid fa-phone"></i> Đang gọi...
                </span>
            </div>
            
            <!-- Avatar -->
            <div style="width: 120px; height: 120px; border-radius: 50%; border: 3px solid #00bda4; overflow: hidden; box-shadow: 0 8px 32px rgba(0,189,164,0.3); animation: pulseAvatar 1.5s infinite alternate; display: flex; justify-content: center; align-items: center;">
                <img src="https://randomuser.me/api/portraits/men/32.jpg" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            
            <p style="color: #8e8e93; font-size: 14px; text-align: center; max-width: 280px; margin-bottom: 20px; line-height: 1.5;">
                Nói <b style="color: white; font-size: 16px;">"Nghe"</b> hoặc <b style="color: white; font-size: 16px;">"Xe"</b>,<br>hoặc bấm nút xanh để trả lời.
            </p>
            
            <!-- Action Buttons -->
            <div style="display: flex; gap: 60px; justify-content: center; width: 100%; margin-bottom: 40px;">
                <!-- Decline Button -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <button onclick="declineCall()" style="width: 64px; height: 64px; border-radius: 50%; background-color: #ff3b30; color: white; border: none; font-size: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(255,59,48,0.25);">
                        <i class="fa-solid fa-phone-slash"></i>
                    </button>
                    <span style="font-size: 12px; color: #8e8e93; font-weight: 500;">Từ chối</span>
                </div>
                
                <!-- Answer Button -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <button onclick="answerCall()" style="width: 64px; height: 64px; border-radius: 50%; background-color: #34c759; color: white; border: none; font-size: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(52,199,89,0.25); animation: wiggleAnswer 2s infinite;">
                        <i class="fa-solid fa-phone"></i>
                    </button>
                    <span style="font-size: 12px; color: #8e8e93; font-weight: 500;">Trả lời</span>
                </div>
            </div>
            
            <style>
                @keyframes blinkText {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                @keyframes pulseAvatar {
                    0% { transform: scale(0.96); box-shadow: 0 0 0 0 rgba(0, 189, 164, 0.4); }
                    100% { transform: scale(1.04); box-shadow: 0 0 0 16px rgba(0, 189, 164, 0); }
                }
                @keyframes wiggleAnswer {
                    0%, 100% { transform: rotate(0); }
                    10%, 30%, 50% { transform: rotate(-8deg); }
                    20%, 40%, 60% { transform: rotate(8deg); }
                    70% { transform: scale(1.05); }
                    80% { transform: scale(0.95); }
                }
            </style>
        `;
        document.body.appendChild(callOverlay);
    }
    
    // Sync current time in call overlay
    const timeEl = callOverlay.querySelector('.time');
    if (timeEl) {
        const now = new Date();
        let h = now.getHours();
        let m = now.getMinutes();
        timeEl.textContent = `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
    }

    // Start Speech Recognition
    startSpeechRecognitionForCall();
};

window.hideIncomingCall = function() {
    isIncomingCallActive = false;
    if (callRecognition) {
        try { callRecognition.abort(); } catch(e) {}
    }
    const callOverlay = document.getElementById('incoming-call-overlay');
    if (callOverlay) callOverlay.remove();
};

window.declineCall = function() {
    window.hideIncomingCall();
    if (appSocket && appSocket.readyState === WebSocket.OPEN) {
        appSocket.send(JSON.stringify({ type: 'call_ended' }));
    }
    speakAI("Cuộc gọi bị từ chối.");
};

window.answerCall = function() {
    isIncomingCallActive = false;
    if (callRecognition) {
        try { callRecognition.abort(); } catch(e) {}
    }
    
    // Send answered signal to websocket
    if (appSocket && appSocket.readyState === WebSocket.OPEN) {
        appSocket.send(JSON.stringify({ type: 'call_answered' }));
    }
    
    // Remove incoming call overlay
    const callOverlay = document.getElementById('incoming-call-overlay');
    if (callOverlay) callOverlay.remove();
    
    // Make sure the AI voice modal is open
    let modal = document.getElementById('ai-voice-modal');
    if (!modal) {
        openAiModal(true);
    }
    
    // Append conversation dialogue inside the active AI voice modal
    const textBoard = document.getElementById('ai-user-text');
    if (textBoard) {
        textBoard.innerHTML = '';
        
        // Show connect message
        const systemMsg = document.createElement('div');
        systemMsg.style.alignSelf = 'center';
        systemMsg.style.background = '#e5f1ff';
        systemMsg.style.color = '#007aff';
        systemMsg.style.padding = '6px 12px';
        systemMsg.style.borderRadius = '12px';
        systemMsg.style.fontSize = '12px';
        systemMsg.style.marginBottom = '8px';
        systemMsg.style.fontWeight = '600';
        systemMsg.innerHTML = `<i class="fa-solid fa-phone"></i> Cuộc gọi đã kết nối`;
        textBoard.appendChild(systemMsg);
        textBoard.scrollTop = textBoard.scrollHeight;
        
        playCallDialogueSequence(textBoard);
    }
};

function startSpeechRecognitionForCall() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        callRecognition = new SpeechRecognition();
        callRecognition.lang = 'vi-VN';
        callRecognition.interimResults = false;
        callRecognition.maxAlternatives = 1;
        
        callRecognition.onresult = (event) => {
            const resultText = event.results[0][0].transcript.toLowerCase();
            console.log("Speech recognized for call:", resultText);
            if (resultText.includes('nghe') || resultText.includes('xe') || resultText.includes('máy') || resultText.includes('alo') || resultText.includes('trả lời')) {
                window.answerCall();
            }
        };
        
        callRecognition.onend = () => {
            if (isIncomingCallActive) {
                try { callRecognition.start(); } catch(e) {}
            }
        };
        
        try {
            callRecognition.start();
            console.log("Speech recognition started.");
        } catch (e) {
            console.error("Speech recognition start failed:", e);
        }
    }
}

function playCallDialogueSequence(textBoard) {
    const setTimeout = window.safeTimeout;
    const setInterval = window.safeInterval;
    // 1. Driver speaks
    setTimeout(() => {
        const bubble = document.createElement('div');
        bubble.style.alignSelf = 'flex-start';
        bubble.style.background = '#f2f2f7';
        bubble.style.border = '1px solid #e5e5ea';
        bubble.style.padding = '8px 12px';
        bubble.style.borderRadius = '16px 16px 16px 0';
        bubble.style.maxWidth = '85%';
        bubble.style.marginBottom = '8px';
        const pickupText = window.currentPickupLocation || "Cổng Phụ - Trường Đại Học VinUni";
        // Convert dash characters in pronunciation
        const speechPickupText = pickupText.replace(/-/g, ' ');
        bubble.innerHTML = `<span style="color: #00bcd4; font-weight: 700;"><i class="fa-solid fa-phone"></i> Tài xế:</span> "Alo, tôi là tài xế Nguyễn Sỹ Cường đây. Tôi đang đỗ ở ${pickupText} rồi, bạn sắp ra tới chưa?"`;
        textBoard.appendChild(bubble);
        textBoard.scrollTop = textBoard.scrollHeight;
        speakAI(`Alo, tôi là tài xế Nguyễn Sỹ Cường đây. Tôi đang đỗ ở ${speechPickupText} rồi, bạn sắp ra tới chưa?`);
    }, 1000);
    
    // 2. Passenger replies
    setTimeout(() => {
        const bubble = document.createElement('div');
        bubble.style.alignSelf = 'flex-end';
        bubble.style.background = '#e0f6f4';
        bubble.style.border = '1px solid #b2dfdb';
        bubble.style.padding = '8px 12px';
        bubble.style.borderRadius = '16px 16px 0 16px';
        bubble.style.maxWidth = '85%';
        bubble.style.marginBottom = '8px';
        bubble.style.color = '#006064';
        bubble.innerHTML = `<span style="color: #00897b; font-weight: 700;"><i class="fa-solid fa-user"></i> Bạn:</span> "Dạ em đang đi xuống đây ạ, tầm 1 phút nữa em ra tới."`;
        textBoard.appendChild(bubble);
        textBoard.scrollTop = textBoard.scrollHeight;
        speakAI("Dạ em đang đi xuống đây ạ, tầm một phút nữa em ra tới.");
    }, 7000);
    
    // 3. Driver replies
    setTimeout(() => {
        const bubble = document.createElement('div');
        bubble.style.alignSelf = 'flex-start';
        bubble.style.background = '#f2f2f7';
        bubble.style.border = '1px solid #e5e5ea';
        bubble.style.padding = '8px 12px';
        bubble.style.borderRadius = '16px 16px 16px 0';
        bubble.style.maxWidth = '85%';
        bubble.style.marginBottom = '8px';
        bubble.innerHTML = `<span style="color: #00bcd4; font-weight: 700;"><i class="fa-solid fa-phone"></i> Tài xế:</span> "Vâng, xe điện màu xanh cyan biển số 29AB-907.77 bạn nhé."`;
        textBoard.appendChild(bubble);
        textBoard.scrollTop = textBoard.scrollHeight;
        speakAI("Vâng, xe điện màu xanh cyan biển số 2 9 A B, 9 0 7, 7 7 bạn nhé.");
    }, 12000);
    
    // 4. Passenger replies
    setTimeout(() => {
        const bubble = document.createElement('div');
        bubble.style.alignSelf = 'flex-end';
        bubble.style.background = '#e0f6f4';
        bubble.style.border = '1px solid #b2dfdb';
        bubble.style.padding = '8px 12px';
        bubble.style.borderRadius = '16px 16px 0 16px';
        bubble.style.maxWidth = '85%';
        bubble.style.marginBottom = '8px';
        bubble.style.color = '#006064';
        bubble.innerHTML = `<span style="color: #00897b; font-weight: 700;"><i class="fa-solid fa-user"></i> Bạn:</span> "Dạ em thấy rồi, em đang đi ra đây."`;
        textBoard.appendChild(bubble);
        textBoard.scrollTop = textBoard.scrollHeight;
        speakAI("Dạ em thấy rồi, em đang đi ra đây.");
    }, 17000);
    
    // 5. Disconnect
    setTimeout(() => {
        const systemMsg = document.createElement('div');
        systemMsg.style.alignSelf = 'center';
        systemMsg.style.background = '#ffebee';
        systemMsg.style.color = '#ff3b30';
        systemMsg.style.padding = '6px 12px';
        systemMsg.style.borderRadius = '12px';
        systemMsg.style.fontSize = '12px';
        systemMsg.style.marginBottom = '8px';
        systemMsg.style.fontWeight = '600';
        systemMsg.innerHTML = `<i class="fa-solid fa-phone-slash"></i> Cuộc gọi đã kết thúc`;
        textBoard.appendChild(systemMsg);
        textBoard.scrollTop = textBoard.scrollHeight;
        speakAI("Cuộc gọi đã kết thúc.");
    }, 21000);
}
