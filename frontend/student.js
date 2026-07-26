// CHANGE THIS URL TO YOUR LIVE RENDER BACKEND URL BEFORE DEPLOYING TO VERCEL
// Example: const API_BASE = 'https://gls-attendance-backend.onrender.com/api';
const API_BASE = 'http://localhost:5000/api';

const elements = {
    form: document.getElementById('attendance-form'),
    btnFetch: document.getElementById('btn-fetch'),
    enrollment: document.getElementById('enrollment'),
    studentInfo: document.getElementById('student-info'),
    studentName: document.getElementById('student-name'),
    studentDivision: document.getElementById('student-division'),
    code: document.getElementById('code'),
    message: document.getElementById('message'),
    lockoutScreen: document.getElementById('lockout-screen'),
    timer: document.getElementById('timer')
};

// Check lockout state on load
function checkLockout() {
    const lockTime = localStorage.getItem('attendanceLock');
    if (lockTime) {
        const now = new Date().getTime();
        const diff = now - parseInt(lockTime);
        const fiveMins = 5 * 60 * 1000;
        
        if (diff < fiveMins) {
            showLockout(fiveMins - diff);
            return true;
        } else {
            localStorage.removeItem('attendanceLock');
        }
    }
    return false;
}

function showLockout(remainingMs) {
    elements.form.classList.add('hidden');
    elements.lockoutScreen.classList.remove('hidden');
    
    const interval = setInterval(() => {
        remainingMs -= 1000;
        if (remainingMs <= 0) {
            clearInterval(interval);
            localStorage.removeItem('attendanceLock');
            window.location.reload();
        } else {
            const mins = Math.floor(remainingMs / 60000);
            const secs = Math.floor((remainingMs % 60000) / 1000);
            elements.timer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function showMessage(msg, type = 'error') {
    elements.message.innerText = msg;
    elements.message.className = `message ${type}`;
    elements.message.classList.remove('hidden');
}

elements.btnFetch.addEventListener('click', async () => {
    const enrollmentNo = elements.enrollment.value.trim();
    if (!enrollmentNo) return showMessage('Please enter enrollment number');

    try {
        const res = await fetch(`${API_BASE}/student/${enrollmentNo}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to fetch');

        elements.studentName.innerText = data.name;
        elements.studentDivision.innerText = data.division;
        elements.studentInfo.classList.remove('hidden');
        elements.message.classList.add('hidden');
    } catch (err) {
        showMessage(err.message);
        elements.studentInfo.classList.add('hidden');
    }
});

elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const enrollmentNo = elements.enrollment.value.trim();
    const code = elements.code.value.trim();

    try {
        // We include credentials for the anti-cheat cookie
        const res = await fetch(`${API_BASE}/student/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enrollmentNo, code }),
            credentials: 'omit' // For simple demo without CORS complexities, you might need 'include' for cookies across domains
        });
        
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Submission failed');

        showMessage('Attendance marked successfully!', 'success');
        
        // Trigger Lockout
        localStorage.setItem('attendanceLock', new Date().getTime().toString());
        setTimeout(() => checkLockout(), 1500);

    } catch (err) {
        showMessage(err.message);
    }
});

// Init
checkLockout();
