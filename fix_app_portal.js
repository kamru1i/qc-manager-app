const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');
content = content.replace('function AppPortalInner({\n  const { emit } = useAppEventBus();', 'function AppPortalInner({');

content = content.replace('}) {\n  const [activeTab', '}) {\n  const { emit } = useAppEventBus();\n  const [activeTab');
fs.writeFileSync('src/app/page.tsx', content);
