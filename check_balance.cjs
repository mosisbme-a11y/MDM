
const fs = require('fs');
const content = fs.readFileSync('src/components/Stage4MohSubmittedMatrixTable.tsx', 'utf8');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '{') braceCount++;
  if (char === '}') braceCount--;
  if (char === '(') parenCount++;
  if (char === ')') parenCount--;
  if (char === '[') bracketCount++;
  if (char === ']') bracketCount--;
  
  if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
    console.log(`Unbalanced at index ${i} (char: ${char})`);
    // Find line number
    const line = content.substring(0, i).split('\n').length;
    console.log(`Line: ${line}`);
    process.exit(1);
  }
}

console.log(`Final counts: Braces: ${braceCount}, Parens: ${parenCount}, Brackets: ${bracketCount}`);
if (braceCount !== 0 || parenCount !== 0 || bracketCount !== 0) {
  process.exit(1);
}
