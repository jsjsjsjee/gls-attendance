const path = require('path');
const exceljs = require('exceljs');
const db = require('../db');

const files = [
    { name: 'MScIT_DivAlpha.xlsx', division: 'Alpha' },
    { name: 'MScIT_DivBeta.xlsx', division: 'Beta' },
    { name: 'MScIT_DivGamma.xlsx', division: 'Gamma' }
];

async function parseExcel() {
    console.log('Starting Excel extraction for PostgreSQL...');
    let students = [];

    for (const file of files) {
        const filePath = path.join(__dirname, '../../', file.name);
        const workbook = new exceljs.Workbook();
        
        try {
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.worksheets[0]; // First sheet

            worksheet.eachRow((row, rowNumber) => {
                // Skip header rows if any
                if (rowNumber === 1) return;

                let enrollmentNo = '';
                let nameParts = [];

                row.eachCell((cell, colNumber) => {
                    const val = cell.value ? cell.value.toString().trim() : '';
                    if (!val) return;

                    if (/^[A-Za-z0-9]{5,12}$/.test(val) && /[A-Za-z]/.test(val) && /[0-9]/.test(val)) {
                        enrollmentNo = val;
                    } 
                    else if (!/^\d+$/.test(val)) {
                        nameParts.push(val);
                    }
                });

                if (enrollmentNo) {
                    let fullName = nameParts.join(' ');
                    
                    if (enrollmentNo === 'IT26A38' && !fullName.trim()) {
                        fullName = 'RAJGOR HARKUMAR TANVIRKUMAR';
                    }
                    
                    students.push({
                        enrollmentNo: enrollmentNo.toUpperCase(),
                        name: fullName,
                        division: file.division
                    });
                }
            });
            console.log(`Extracted records from ${file.name}`);
        } catch (err) {
            console.error(`Error parsing ${file.name}:`, err.message);
        }
    }

    if (students.length > 0) {
        console.log(`Found ${students.length} student records. Inserting into PostgreSQL...`);
        
        try {
            await db.query("DELETE FROM students");
            
            for (const s of students) {
                await db.query(
                    "INSERT INTO students (enrollment_no, name, division) VALUES ($1, $2, $3)",
                    [s.enrollmentNo, s.name, s.division]
                );
            }
            
            console.log('Database population complete from Excel!');
        } catch (err) {
            console.error("Error inserting into DB:", err);
        } finally {
            process.exit(0);
        }
    } else {
        console.log('No student records found in Excel files.');
        process.exit(1);
    }
}

parseExcel();
