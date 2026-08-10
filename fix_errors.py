import re
import os

base_dir = "/Users/bnfcorporate/Documents/Web Dev/qc-manager-app/src/utils"

# Fix excelExporters.ts
with open(f"{base_dir}/excelExporters.ts", "r") as f:
    content = f.read()

content = content.replace("};\\n    onSuccess: () => void,", "},\\n    onSuccess: () => void,")
content = content.replace("};\\n    onError: (msg: string) => void", "},\\n    onError: (msg: string) => void")
# Let's use regex to fix the filters argument
content = re.sub(r'filters: \{([^}]*)\};', r'filters: {\1},', content)

with open(f"{base_dir}/excelExporters.ts", "w") as f:
    f.write(content)

# Fix pdfExporters.ts
with open(f"{base_dir}/pdfExporters.ts", "r") as f:
    content = f.read()

content = re.sub(r'filters: \{([^}]*)\};', r'filters: {\1},', content)

with open(f"{base_dir}/pdfExporters.ts", "w") as f:
    f.write(content)

# Fix settlementHelpers.ts
with open(f"{base_dir}/settlementHelpers.ts", "r") as f:
    content = f.read()

content = content.replace("import { ChutiRecord, generateUUID } from '@/utils/offlineSync';", "import { ChutiRecord } from '@/utils/offlineSync';\\nimport { generateUUID } from '@/utils/idbStoreFactory';")

with open(f"{base_dir}/settlementHelpers.ts", "w") as f:
    f.write(content)

print("Fixed")
