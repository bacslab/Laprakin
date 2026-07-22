export const departments = [
  { key: 'jkb', label: 'Jurusan Komputer dan Bisnis' },
  { key: 'jem', label: 'Jurusan Rekayasa Elektro dan Mekatronika' },
  { key: 'jmip', label: 'Jurusan Rekayasa Mesin dan Industri Pertanian' },
  { key: 'other', label: 'Jurusan lainnya' },
];

export const programs = [
  { key: 'ti', department: 'jkb', label: 'D3 Teknik Informatika' },
  { key: 'rks', department: 'jkb', label: 'D4 Rekayasa Keamanan Siber' },
  { key: 'trpl', department: 'jkb', label: 'D4 Teknologi Rekayasa Perangkat Lunak' },
  { key: 'trm', department: 'jkb', label: 'D4 Teknologi Rekayasa Multimedia' },
  { key: 'alks', department: 'jkb', label: 'D4 Akuntansi Lembaga Keuangan Syariah' },
  { key: 'te', department: 'jem', label: 'D3 Teknik Elektronika' },
  { key: 'tl', department: 'jem', label: 'D3 Teknik Listrik' },
  { key: 'mekatronika', department: 'jem', label: 'D4 Teknologi Rekayasa Mekatronika' },
  { key: 'tm', department: 'jmip', label: 'D3 Teknik Mesin' },
  { key: 'tppl', department: 'jmip', label: 'D4 Teknik Pengendalian Pencemaran Lingkungan' },
  { key: 'ppa', department: 'jmip', label: 'D4 Pengembangan Produk Agroindustri' },
  { key: 'ter', department: 'jmip', label: 'D4 Teknologi Rekayasa Energi Terbarukan' },
  { key: 'rki', department: 'jmip', label: 'D4 Rekayasa Kimia Industri' },
  { key: 'other', department: 'other', label: 'Prodi lainnya' },
];

export const templates = [
  {
    key: 'langkah',
    title: 'Berbasis langkah',
    description: 'Untuk praktik yang mengikuti urutan instruksi modul.',
  },
  {
    key: 'pengujian',
    title: 'Hasil pengujian',
    description: 'Untuk laporan dengan tabel, pengukuran, dan hasil uji.',
  },
  {
    key: 'proyek',
    title: 'Berbasis proyek',
    description: 'Untuk proses pembangunan, implementasi, dan hasil akhir.',
  },
];
