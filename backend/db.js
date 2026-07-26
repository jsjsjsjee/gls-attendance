const { Pool } = require('pg');

// Use Render/Supabase DATABASE_URL if available, else a default local one
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gls_attendance',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // SSL required for most cloud DBs
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                enrollment_no VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                division VARCHAR(50)
            );
            
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                subject VARCHAR(255),
                code VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES sessions(id),
                enrollment_no VARCHAR(50) REFERENCES students(enrollment_no),
                marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(session_id, enrollment_no)
            );
        `);
        console.log('PostgreSQL Database initialized successfully.');
    } catch (err) {
        console.error('Error initializing PostgreSQL database:', err);
    }
}

initDB();

module.exports = pool;
