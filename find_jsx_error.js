const fs = require('fs');
const parser = require('@babel/parser');

const code = fs.readFileSync('src/components/study/PracticeLibrary.tsx', 'utf8');
try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log("No syntax error found by babel parser.");
} catch (e) {
  console.error(e.message);
}
