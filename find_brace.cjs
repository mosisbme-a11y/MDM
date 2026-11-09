
const fs = require('fs');
const content = fs.readFileSync('src/components/Stage4MohSubmittedMatrixTable.tsx', 'utf8');

let braceCount = 0;
let stack = [];

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '{') {
    braceCount++;
    const line = content.substring(0, i).split('\n').length;
    stack.push({ type: '{', line });
  }
  if (char === '}') {
    braceCount--;
    const line = content.substring(0, i).split('\n').length;
    if (braceCount < 0) {
      console.log(`Extra close brace at line ${line}`);
      process.exit(1);
    }
    stack.pop();
  }
}

if (braceCount > 0) {
  console.log(`Unclosed brace at line ${stack[stack.length-1].line}`);
}
