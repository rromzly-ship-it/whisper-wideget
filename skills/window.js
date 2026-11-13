/**
 * Skill: Kontrol Jendela, Folder, & Aplikasi (0 Token + Progressive Prompt Spec)
 * Menangani minimize/maximize/fullscreen/close jendela, Alt+Tab, Task View, buka folder spesial, dan buka aplikasi umum.
 */
const QUICK_APPS = {
  'chrome': 'chrome',
  'google chrome': 'chrome',
  'kom': 'chrome',
  'edge': 'edge',
  'microsoft edge': 'edge',
  'notepad': 'notepad',
  'catatan': 'notepad',
  'kalkulator': 'calculator',
  'calculator': 'calculator',
  'word': 'word',
  'microsoft word': 'word',
  'excel': 'excel',
  'microsoft excel': 'excel',
  'powerpoint': 'powerpoint',
  'file explorer': 'file explorer',
  'explorer': 'file explorer',
  'terminal': 'terminal',
  'cmd': 'cmd',
  'powershell': 'powershell',
  'settings': 'settings',
  'pengaturan windows': 'settings',
  'task manager': 'task manager',
  'paint': 'paint',
  'corel': 'CorelDRAW 2024',
  'coreldraw': 'CorelDRAW 2024',
  'koreldraw': 'CorelDRAW 2024',
  'whatsapp': 'whatsapp',
  'wa': 'whatsapp',
  'telegram': 'telegram',
  'spotify': 'spotify',
  'vscode': 'code',
  'vs code': 'code',
  'discord': 'discord'
};

const QUICK_FOLDERS = {
  'downloads': 'downloads',
  'download': 'downloads',
  'unduhan': 'downloads',
  'documents': 'documents',
  'dokumen': 'documents',
  'desktop': 'desktop',
  'pictures': 'pictures',
  'gambar': 'pictures',
  'music': 'music',
  'musik': 'music',
  'videos': 'videos',
  'video': 'videos',
  'temp': 'temp',
  'appdata': 'appdata',
  'recycle bin': 'recycle_bin',
  'tempat sampah': 'recycle_bin'
};

module.exports = {
  id: 'window',
  name: 'Kontrol Jendela, Aplikasi & Folder',
  category: 'sistem',
  description: 'Buka aplikasi umum, buka folder (Downloads/Documents/Desktop/Recycle Bin), minimize/maximize/fullscreen/tutup jendela, Alt+Tab, Task View.',
  intentPattern: /\b(folder|downloads?|documents?|desktop|pictures?|music|videos?|appdata|temp|recycle|sampah|alt.?tab|task.?view|jendela|tunggu)\b/i,
  promptSpec: 'open_folder{target:"temp|downloads|documents|desktop|pictures|music|videos|appdata|localappdata|recycle_bin"} | open_alt_tab{} | open_task_view{} | wait_window{keyword}',
  examples: [
    'buka chrome / buka notepad / buka kalkulator',
    'buka folder downloads',
    'minimize aplikasi ini / maximize jendela ini',
    'buka alt tab / tampilkan semua jendela'
  ],

  matchFastPlan({ clean }) {
    if (/^(?:buka\s+)?alt\s*[+-]?\s*tab$|^(?:lihat|tampilkan)\s+(?:aplikasi|jendela)\s+(?:yang\s+)?aktif$/i.test(clean)) {
      return { steps: [{ action: 'open_alt_tab' }], summary: 'Buka Alt+Tab', replyLang: 'id', reply: 'Membuka Alt Tab' };
    }
    if (/^(?:buka\s+)?task\s*view$|^(?:lihat|tampilkan)\s+semua\s+(?:aplikasi|jendela)$/i.test(clean)) {
      return { steps: [{ action: 'open_task_view' }], summary: 'Buka Task View', replyLang: 'id', reply: 'Membuka Task View' };
    }
    if (/^(?:minimize|kecilkan)\s+(?:aplikasi|jendela)\s+ini$/i.test(clean)) {
      return { steps: [{ action: 'window_control', op: 'minimize' }], summary: 'Minimize jendela', replyLang: 'id', reply: 'Jendela diminimalkan' };
    }
    if (/^(?:maximize|besarkan)\s+(?:aplikasi|jendela)\s+ini$/i.test(clean)) {
      return { steps: [{ action: 'window_control', op: 'maximize' }], summary: 'Maximize jendela', replyLang: 'id', reply: 'Jendela dimaksimalkan' };
    }
    if (/^(?:fullscreen|layar\s+penuh)\s+(?:aplikasi|jendela)\s+ini$/i.test(clean)) {
      return { steps: [{ action: 'window_control', op: 'fullscreen' }], summary: 'Fullscreen aplikasi', replyLang: 'id', reply: 'Layar penuh diaktifkan' };
    }
    if (/^(?:restore|kembalikan)\s+(?:ukuran\s+)?(?:aplikasi|jendela)\s+ini$/i.test(clean)) {
      return { steps: [{ action: 'window_control', op: 'restore' }], summary: 'Restore jendela', replyLang: 'id', reply: 'Ukuran jendela dikembalikan' };
    }
    if (/^(?:tutup|close)\s+(?:aplikasi|jendela)\s+ini$/i.test(clean)) {
      return { steps: [{ action: 'window_control', op: 'close' }], summary: 'Tutup jendela', replyLang: 'id', reply: 'Jendela ditutup' };
    }

    const folderMatch = clean.match(/^buka\s+(?:folder\s+|aplikasi\s+|program\s+|app\s+)?([a-z0-9\s._+-]+)$/i);
    if (folderMatch && folderMatch[1]) {
      const key = folderMatch[1].trim().toLowerCase();
      if (QUICK_FOLDERS[key]) {
        return {
          steps: [{ action: 'open_folder', target: QUICK_FOLDERS[key] }],
          summary: `Buka folder ${key}`,
          replyLang: 'id',
          reply: `Siap, membuka folder ${key}`
        };
      }
      if (QUICK_APPS[key]) {
        return {
          steps: [{ action: 'open_app', appName: QUICK_APPS[key], forceNew: false }],
          summary: `Buka ${QUICK_APPS[key]}`,
          replyLang: 'id',
          reply: `Siap, membuka ${QUICK_APPS[key]}`
        };
      }
    }

    return null;
  }
};

