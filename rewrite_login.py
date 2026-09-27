import re

with open('src/services/storage.ts', 'r') as f:
    content = f.read()

new_login = """
  async login(identifier: string, password: string, roleTab: UserRole): Promise<{ success: boolean; user?: User; error?: string }> {
    let email = identifier.trim().toLowerCase();
    
    if (!email.includes('@')) {
       if (email === 'admin') email = 'admin@sekolah.sch.id';
       else if (roleTab === 'siswa') email = `${email}@siswa.sch.id`;
       else if (roleTab === 'guru') email = `${email}@guru.sch.id`;
       else email = `${email}@sekolah.sch.id`;
    }

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const user = res.user;
      
      let userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        const newUser: User = {
          id: user.uid,
          name: user.displayName || 'Unknown',
          email: user.email || '',
          role: roleTab
        };
        await setDoc(doc(db, "users", user.uid), newUser);
        userDoc = await getDoc(doc(db, "users", user.uid));
      } else {
         const existingData = userDoc.data() as User;
         if (existingData.role !== roleTab && existingData.role !== 'admin') {
            await signOut(auth);
            return { success: false, error: "Peran tidak sesuai. Anda terdaftar sebagai " + existingData.role };
         }
      }
      return { success: true, user: userDoc.data() as User };
    } catch (e: any) {
      if (e.code === 'auth/operation-not-allowed') {
        return { success: false, error: "Mohon aktifkan metode login 'Email/Password' di Firebase Console Anda (menu Authentication -> Sign-in method)." };
      }
      
      if (email === 'admin@sekolah.sch.id' && password === 'admin123' && (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/network-request-failed')) {
         try {
           const res = await createUserWithEmailAndPassword(auth, email, password);
           const adminUser: User = {
             id: res.user.uid,
             name: "Administrator",
             email: email,
             role: "admin",
             password: "admin123"
           };
           await setDoc(doc(db, "users", res.user.uid), adminUser);
           return { success: true, user: adminUser };
         } catch(createErr: any) {
           return { success: false, error: "Gagal membuat akun admin: " + createErr.message };
         }
      }
      return { success: false, error: "Email/Username atau password salah." };
    }
  }
"""

start_idx = content.find("async login(identifier: string")
end_idx = content.find("async logout()", start_idx)
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_login.strip() + "\n\n  " + content[end_idx:]

with open('src/services/storage.ts', 'w') as f:
    f.write(content)
