with open('src/services/storage.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('import { auth, db, googleProvider }'): continue
    if line.startswith('import { getAuth, signOut, onAuthStateChanged }'): continue
    if line.startswith('import { collection, doc, setDoc, deleteDoc, getDoc, onSnapshot, query, where }'): continue
    
    new_lines.append(line)

content = "".join(new_lines)
with open('src/services/storage.ts', 'w') as f:
    f.write(content)
