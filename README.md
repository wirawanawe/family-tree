# Family Tree Application

Aplikasi web untuk mengelola dan memvisualisasikan pohon keluarga menggunakan Next.js, Tailwind CSS, dan MySQL2.

## Fitur

- 🌳 Visualisasi pohon keluarga interaktif
- 👥 Manajemen anggota keluarga (CRUD)
- 🔗 Relasi keluarga (ayah, ibu, pasangan)
- 📋 Tampilan daftar dan pohon
- 🎨 UI modern dengan Tailwind CSS
- 💾 Database MySQL untuk penyimpanan data
- 🔐 Sistem autentikasi dengan 3 role: Superadmin, Admin, Member
- ✅ Approval system untuk admin baru
- 📅 Kalender acara keluarga
- 👤 Auto-navigation untuk member ke posisi mereka di tree

## Prerequisites

- Node.js 18+ dan npm
- MySQL Server
- Database MySQL yang sudah dibuat

## Instalasi

1. Install dependencies:
```bash
npm install
```

2. Buat file `.env.local` di root project dengan konfigurasi berikut:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=family_tree
DB_PORT=3306
```

3. Buat database MySQL:
```sql
CREATE DATABASE family_tree;
```

4. Jalankan aplikasi:
```bash
npm run dev
```

5. Buat superadmin pertama (opsional, bisa juga langsung daftar):
```bash
# Opsi 1: Menggunakan script JavaScript (direkomendasikan)
SUPERADMIN_USERNAME=superadmin SUPERADMIN_PASSWORD=admin123 SUPERADMIN_NAME="Super Admin" node scripts/create-superadmin.js

# Opsi 2: Menggunakan API endpoint (setelah server running)
curl -X POST http://localhost:3000/api/admin/create-superadmin \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"admin123","name":"Super Admin"}'
```

**Catatan**: Default superadmin credentials:
- Username: `superadmin`
- Password: `admin123`
- **PENTING**: Ganti password setelah login pertama kali!

6. Buka browser di `http://localhost:3000`

## Struktur Project

```
family_tree/
├── app/
│   ├── api/
│   │   ├── members/          # API untuk CRUD anggota keluarga
│   │   └── tree/             # API untuk data pohon keluarga
│   ├── globals.css           # Global styles dengan Tailwind
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Halaman utama
├── components/
│   ├── FamilyTree.tsx        # Komponen visualisasi pohon
│   ├── MemberForm.tsx        # Form untuk add/edit anggota
│   └── MemberList.tsx        # Tampilan daftar anggota
├── lib/
│   └── db.ts                 # Konfigurasi database MySQL
└── package.json
```

## Sistem Role

### 👑 Superadmin
- Bisa approve/reject pendaftaran admin baru
- Bisa menambah/edit/hapus anggota keluarga
- Bisa membuat acara keluarga
- Akses ke halaman `/admin` untuk manage approvals

### 👨‍💼 Admin
- Perlu approval dari superadmin sebelum bisa login
- Bisa menambah/edit/hapus anggota keluarga
- Bisa membuat acara keluarga
- Tidak bisa approve admin lain

### 👤 Member
- Hanya bisa melihat family tree (read-only)
- Tidak bisa menambah/edit/hapus anggota
- Tidak bisa membuat acara
- Setelah login, langsung ditampilkan posisi mereka di tree
- Bisa memilih anggota keluarga saat register untuk auto-navigation

## Penggunaan

1. **Login/Register**: Buka `/login` untuk login atau daftar
2. **Superadmin**: Setelah login sebagai superadmin, akses `/admin` untuk approve admin baru
3. **Menambah Anggota Keluarga**: (Admin/Superadmin) Klik tombol "+ Add Family Member" dan isi form
4. **Mengedit Anggota**: (Admin/Superadmin) Klik tombol "Edit" pada kartu anggota atau di tabel
5. **Menghapus Anggota**: (Admin/Superadmin) Klik tombol "Delete" (akan ada konfirmasi)
6. **Melihat Pohon Keluarga**: Gunakan toggle "Tree View" untuk melihat visualisasi pohon
7. **Melihat Daftar**: (Admin/Superadmin) Gunakan toggle "List View" untuk melihat dalam format tabel
8. **Acara Keluarga**: Klik "📅 Acara Keluarga" untuk melihat kalender (Admin bisa tambah/edit)

## Teknologi

- **Next.js 14**: Framework React dengan App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling utility-first
- **MySQL2**: Database driver untuk MySQL
- **React 18**: UI library

## Catatan

- Database akan otomatis membuat tabel `family_members` saat pertama kali aplikasi dijalankan
- Pastikan MySQL server sudah berjalan sebelum menjalankan aplikasi
- Relasi keluarga (ayah, ibu, pasangan) menggunakan foreign keys untuk integritas data
