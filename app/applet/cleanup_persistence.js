const fs = require('fs');

const filesToClean = [
  'src/App.tsx',
  'src/components/DspWorkflowView.tsx',
  'src/components/HFListUploadModal.tsx',
  'src/components/MultipleStockUploadModal.tsx'
];

filesToClean.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf8');

  // Remove persistence function calls
  const persistenceRegex = /\s*(save|load|clear).+ToIndexedDB\([^)]*\)(\.catch\(\(\) => {}\))?\s*;?/g;
  content = content.replace(persistenceRegex, '');

  // Remove localStorage interactions
  const localStorageRegex = /\s*(localStorage\.(setItem|removeItem|getItem)\([\'\"]epss_.+?[\'\"]\)(,\s*JSON\.stringify\(.+?\))?\s*\));?\s*/g;
  content = content.replace(localStorageRegex, '');
  
  // Remove console warnings about local storage
  content = content.replace(/\s*console\.warn\([\'\"](Failed to persist|Error reading from IndexedDB|LocalStorage limit reached).+?\);/g, '');

  fs.writeFileSync(file, content);
  console.log(`Cleaned ${file}`);
});
