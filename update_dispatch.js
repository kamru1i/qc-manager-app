const fs = require('fs');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes('useAppEventBus')) {
    content = content.replace(/(import .* from 'react';?)/, "$1\nimport { useAppEventBus } from '@/contexts/AppEventBusContext';");
  }

  // Inject const { emit } = useAppEventBus(); inside the main component/hook
  const componentMatch = content.match(/export (default )?(function|const) \w+\s*\(.*?\) (\{|=>\s*\{)/);
  if (componentMatch && !content.includes('const { emit } = useAppEventBus();')) {
    const insertIndex = componentMatch.index + componentMatch[0].length;
    content = content.slice(0, insertIndex) + '\n  const { emit } = useAppEventBus();' + content.slice(insertIndex);
  }

  // Regex to catch new CustomEvent("event-name", { detail: X })
  // Handles newlines and whitespace
  // ([\s\S]*?) matches lazily until the first closing brace for detail, then we match up to closing parenthesis
  content = content.replace(/window\.dispatchEvent\(\s*new\s+CustomEvent\(\s*["']([^"']+)["']\s*,\s*\{\s*detail:\s*([\s\S]*?)\s*\}\s*,?\s*\)\s*,?\s*\)/g, (match, eventName, detailContent) => {
    return `emit('${eventName}', ${detailContent.trim()})`;
  });

  content = content.replace(/window\.dispatchEvent\(\s*new\s+CustomEvent\(\s*["']([^"']+)["']\s*,?\s*\)\s*,?\s*\)/g, (match, eventName) => {
    return `emit('${eventName}')`;
  });

  content = content.replace(/window\.dispatchEvent\(\s*new\s+Event\(\s*["']([^"']+)["']\s*,?\s*\)\s*,?\s*\)/g, (match, eventName) => {
    return `emit('${eventName}')`;
  });

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

['src/app/page.tsx', 'src/components/common/UnifiedSidebar.tsx', 'src/components/common/UserManagement.tsx'].forEach(file => {
  try {
    processFile(file);
  } catch(e) {
    console.error(e);
  }
});
