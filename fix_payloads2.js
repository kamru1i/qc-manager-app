const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

content = content.replace("emit('open-revision-modal', { recordId: record as any } as unknown as { requestId: string });", "emit('open-revision-modal', { recordId: record });");
content = content.replace("emit('approve-chuti-request', { requestId: id, approve } as unknown as { requestId: string });", "emit('approve-chuti-request', { requestId: id, approve });");
content = content.replace("emit('approve-reserve-adjustment', { requestId: '', record, approve } as unknown as { requestId: string });", "emit('approve-reserve-adjustment', { requestId: '', record, approve });");
content = content.replace("emit('approve-profile-change', { requestId: id, approve } as unknown as { requestId: string });", "emit('approve-profile-change', { requestId: id, approve });");
content = content.replace("emit('approve-password-reset', { requestId: id, approve } as unknown as { requestId: string });", "emit('approve-password-reset', { requestId: id, approve });");
content = content.replace("emit('supervisor-approve-chuti', { requestId: id, approve } as unknown as { requestId: string });", "emit('supervisor-approve-chuti', { requestId: id, approve });");

fs.writeFileSync('src/app/page.tsx', content);
