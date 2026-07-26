const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const exceljs = require('exceljs');
const db = require('./db'); // This is now a pg Pool

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Generate 6-digit code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. Admin: Create a new session (code valid for 2 mins)
app.post('/api/admin/session', async (req, res) => {
    const { subject } = req.body;
    if (!subject) return res.status(400).json({ error: 'Subject is required' });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes

    try {
        const result = await db.query(
            `INSERT INTO sessions (subject, code, expires_at) VALUES ($1, $2, $3) RETURNING id, subject, code`,
            [subject, code, expiresAt]
        );
        const sessionData = result.rows[0];
        sessionData.expires_at = expiresAt; // Guarantee correct UTC string for frontend timer
        res.json(sessionData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Admin: Get all students for a division
app.get('/api/admin/students/:division', async (req, res) => {
    const { division } = req.params;
    try {
        const result = await db.query(
            `SELECT * FROM students WHERE LOWER(division) = LOWER($1)`,
            [division]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin: Manually mark student present
app.post('/api/admin/mark-manual', async (req, res) => {
    const { sessionId, enrollmentNo } = req.body;
    if (!sessionId || !enrollmentNo) return res.status(400).json({ error: 'Missing data' });

    try {
        await db.query(
            `INSERT INTO attendance (session_id, enrollment_no) VALUES ($1, $2)`,
            [sessionId, enrollmentNo]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') { // Postgres unique violation code
            return res.status(400).json({ error: 'Student already marked present' });
        }
        res.status(500).json({ error: err.message });
    }
});

// 4. Admin: Export Attendance to Excel
app.get('/api/admin/export/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const result = await db.query(
            `SELECT a.marked_at, s.enrollment_no, s.name, s.division 
             FROM attendance a 
             JOIN students s ON a.enrollment_no = s.enrollment_no 
             WHERE a.session_id = $1`,
            [sessionId]
        );

        const workbook = new exceljs.Workbook();
        const sheet = workbook.addWorksheet('Attendance');
        
        sheet.columns = [
            { header: 'Enrollment No', key: 'enrollment_no', width: 20 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Division', key: 'division', width: 15 },
            { header: 'Timestamp', key: 'marked_at', width: 25 },
        ];

        result.rows.forEach(row => {
            // Postgres node driver parses timestamps to JS Date objects automatically
            const date = new Date(row.marked_at); 
            row.marked_at = date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            sheet.addRow(row);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="attendance_${sessionId}.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 5. Student: Get student details
app.get('/api/student/:enrollmentNo', async (req, res) => {
    const { enrollmentNo } = req.params;
    try {
        const result = await db.query(
            `SELECT * FROM students WHERE enrollment_no = $1`,
            [enrollmentNo]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Student: Submit Attendance (Anti-Cheat)
app.post('/api/student/mark', async (req, res) => {
    const { enrollmentNo, code } = req.body;
    
    if (req.cookies.attendance_lock) {
        return res.status(429).json({ error: 'You have recently marked attendance. Please wait 5 minutes before trying again.' });
    }

    try {
        const sessionResult = await db.query(
            `SELECT * FROM sessions WHERE code = $1 ORDER BY id DESC LIMIT 1`,
            [code]
        );

        if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Invalid code' });
        
        const session = sessionResult.rows[0];
        
        // Have PostgreSQL check the time natively to prevent NodeJS timezone parsing bugs
        const timeCheck = await db.query(
            `SELECT expires_at > LOCALTIMESTAMP as is_valid FROM sessions WHERE id = $1`,
            [session.id]
        );
        
        if (!timeCheck.rows[0].is_valid) {
            return res.status(400).json({ error: 'Code has expired (2-minute window passed)' });
        }

        await db.query(
            `INSERT INTO attendance (session_id, enrollment_no) VALUES ($1, $2)`,
            [session.id, enrollmentNo]
        );

        res.cookie('attendance_lock', 'true', {
            maxAge: 5 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax' 
        });

        res.json({ success: true, message: 'Attendance marked successfully' });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Attendance already marked for this subject' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});

// Export the app for Vercel Serverless
module.exports = app;
