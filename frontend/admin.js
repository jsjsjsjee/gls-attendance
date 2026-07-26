// CHANGE THIS URL TO YOUR LIVE RENDER BACKEND URL BEFORE DEPLOYING TO VERCEL
// Example: const API_BASE = 'https://gls-attendance-backend.onrender.com/api';
const API_BASE = 'http://localhost:5000/api';

let currentSessionId = null;
let sessionInterval = null;

const elements = {
    sessionForm: document.getElementById('session-form'),
    subjectInput: document.getElementById('subject'),
    activeSession: document.getElementById('active-session'),
    displayCode: document.getElementById('display-code'),
    sessionTimer: document.getElementById('session-timer'),
    btnDownload: document.getElementById('btn-download'),
    
    divisionSelect: document.getElementById('division'),
    studentListSelect: document.getElementById('student-list'),
    btnManualMark: document.getElementById('btn-manual-mark'),
    
    message: document.getElementById('message')
};

function showMessage(msg, type = 'error') {
    elements.message.innerText = msg;
    elements.message.className = `message ${type}`;
    elements.message.classList.remove('hidden');
    setTimeout(() => {
        elements.message.classList.add('hidden');
    }, 5000);
}

// 1. Generate Session Code
elements.sessionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = elements.subjectInput.value.trim();
    if (!subject) return;

    try {
        const res = await fetch(`${API_BASE}/admin/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);

        currentSessionId = data.id;
        elements.displayCode.innerText = data.code;
        
        elements.sessionForm.classList.add('hidden');
        elements.activeSession.classList.remove('hidden');
        
        startTimer(data.expiresAt);
        showMessage('Session created successfully!', 'success');
        
    } catch (err) {
        showMessage(err.message);
    }
});

function startTimer(expiresAtIso) {
    if (sessionInterval) clearInterval(sessionInterval);
    
    const expiresAt = new Date(expiresAtIso).getTime();
    
    sessionInterval = setInterval(() => {
        const now = new Date().getTime();
        const diff = expiresAt - now;
        
        if (diff <= 0) {
            clearInterval(sessionInterval);
            elements.sessionTimer.innerText = "EXPIRED";
            elements.sessionTimer.style.color = "var(--error)";
            showMessage('Session Code Expired', 'error');
        } else {
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            elements.sessionTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// 2. Download Excel
elements.btnDownload.addEventListener('click', () => {
    if (!currentSessionId) return showMessage('No active session.');
    window.location.href = `${API_BASE}/admin/export/${currentSessionId}`;
});

// 3. Manual Override - Load Students
elements.divisionSelect.addEventListener('change', async (e) => {
    const division = e.target.value;
    elements.studentListSelect.innerHTML = '<option value="">--Select Student--</option>';
    
    if (!division) {
        elements.studentListSelect.disabled = true;
        elements.btnManualMark.disabled = true;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/students/${division}`);
        const students = await res.json();
        
        if (!res.ok) throw new Error(students.error);

        students.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.enrollment_no;
            opt.textContent = `${s.enrollment_no} - ${s.name}`;
            elements.studentListSelect.appendChild(opt);
        });

        elements.studentListSelect.disabled = false;
        
    } catch (err) {
        showMessage(err.message);
    }
});

elements.studentListSelect.addEventListener('change', (e) => {
    elements.btnManualMark.disabled = !e.target.value;
});

// 4. Manual Override - Mark Present
elements.btnManualMark.addEventListener('click', async () => {
    if (!currentSessionId) return showMessage('Please generate a session code first.');
    
    const enrollmentNo = elements.studentListSelect.value;
    if (!enrollmentNo) return;

    try {
        const res = await fetch(`${API_BASE}/admin/mark-manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSessionId, enrollmentNo })
        });
        
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);

        showMessage(`Successfully marked student ${enrollmentNo} present.`, 'success');
        
    } catch (err) {
        showMessage(err.message);
    }
});
