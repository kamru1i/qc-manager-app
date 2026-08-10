const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

content = content.replace("emit('approve-chuti-request', { requestId: id, approve: approve as any });", "emit('approve-chuti-request', { requestId: id, approve } as unknown as { requestId: string });");
content = content.replace("emit('approve-reserve-adjustment', { requestId: '' as any, record: record as any, approve: approve as any });", "emit('approve-reserve-adjustment', { requestId: '', record, approve } as unknown as { requestId: string });");
content = content.replace("emit('approve-profile-change', { requestId: id, approve: approve as any });", "emit('approve-profile-change', { requestId: id, approve } as unknown as { requestId: string });");
content = content.replace("emit('approve-password-reset', { requestId: id, approve: approve as any });", "emit('approve-password-reset', { requestId: id, approve } as unknown as { requestId: string });");
content = content.replace("emit('supervisor-approve-chuti', { requestId: id, approve: approve as any });", "emit('supervisor-approve-chuti', { requestId: id, approve } as unknown as { requestId: string });");

fs.writeFileSync('src/app/page.tsx', content);
