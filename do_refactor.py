import re
import os

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)

content = read_file('src/components/common/ProfileSettings.tsx')

# This is a very complex file. To ensure we don't break anything, 
# it's best to keep the existing component logic and just extract the state to a reducer
# and the render methods to subcomponents, passing the state as props.

# But instead of writing a flaky python script, I'll just write the exact files needed directly.
