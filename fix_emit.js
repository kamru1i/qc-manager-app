const fs = require('fs');

function fixEmit(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('const { emit } = useAppEventBus();')) {
    // find the first `{` after the export const Name
    const regex = /(export const \w+(?::\s*React\.FC<[^>]+>)?\s*=\s*\([^)]*\)\s*=>\s*\{)/;
    const match = content.match(regex);
    if (match) {
      const insertIndex = match.index + match[0].length;
      content = content.slice(0, insertIndex) + '\n  const { emit } = useAppEventBus();' + content.slice(insertIndex);
      fs.writeFileSync(filePath, content);
      console.log(`Fixed ${filePath}`);
    } else {
      console.log(`Regex not matched in ${filePath}`);
    }
  }
}

fixEmit('src/components/common/UnifiedSidebar.tsx');
fixEmit('src/components/common/UserManagement.tsx');
