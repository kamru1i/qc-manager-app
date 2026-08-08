import re

with open('src/components/common/ProfileSettings.tsx', 'r') as f:
    content = f.read()

states = re.findall(r'const \[([a-zA-Z0-9_]+),\s*set([a-zA-Z0-9_]+)\]\s*=\s*useState(?:<([^>]+)>)?\((.*?)\);', content)

for s in states:
    print(s[0], s[2], s[3])
