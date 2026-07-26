const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const db = require('../db');

// Map filenames to divisions
const files = [
    { name: 'MScIT_DivAlpha.pdf', division: 'Alpha' },
    { name: 'MScIT_DivBeta.pdf', division: 'Beta' },
    { name: 'MScIT_DivGamma.pdf', division: 'Gamma' }
];

async function parsePDFs() {
    console.log('Starting PDF extraction...');
    
    // Using a set to avoid duplicates just in case
    let students = [];

    for (const file of files) {
        const filePath = path.join(__dirname, '../../', file.name);
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}, skipping...`);
            continue;
        }

        const dataBuffer = fs.readFileSync(filePath);
        try {
            const data = await pdf(dataBuffer);
            const text = data.text;
            
            // This regex tries to find enrollment numbers and names
            // Example format assumption: "1234567890 John Doe"
            // You may need to adjust this regex based on the exact PDF text output
            const lines = text.split('\n');
            
            for (let line of lines) {
                line = line.trim();
                // This regex looks for an optional serial number at start,
                // followed by a 5-15 character alphanumeric enrollment number (like IT26A57),
                // followed by the student name.
                const match = line.match(/^(?:\d+\s+)?([A-Za-z0-9]{5,15})\s+(.+)$/);
                if (match) {
                    students.push({
                        enrollmentNo: match[1].trim(),
                        name: match[2].trim(),
                        division: file.division
                    });
                }
            }
            console.log(`Extracted text from ${file.name}`);
        } catch (err) {
            console.error(`Error parsing ${file.name}:`, err);
        }
    }

    if (students.length > 0) {
        console.log(`Found ${students.length} potential student records. Inserting into DB...`);
        db.serialize(() => {
            const stmt = db.prepare("INSERT OR REPLACE INTO students (enrollment_no, name, division) VALUES (?, ?, ?)");
            students.forEach(s => {
                stmt.run(s.enrollmentNo, s.name, s.division);
            });
            stmt.finalize(() => {
                console.log('Database population complete.');
                process.exit(0);
            });
        });
    } else {
        console.log('No student records extracted. The PDF format might not match the parsing logic.');
        process.exit(1);
    }
}

parsePDFs();
