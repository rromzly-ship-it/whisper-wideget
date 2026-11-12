#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure Git executable path is found even if shell session PATH is stale
function getGitCmd() {
  const possiblePaths = [
    'git',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe', 'cmd', 'git.exe'),
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe'
  ];
  for (const p of possiblePaths) {
    try {
      execSync(`"${p}" --version`, { stdio: 'ignore' });
      return `"${p}"`;
    } catch (_) {}
  }
  return 'git';
}

const git = getGitCmd();

console.log('\n==================================================');
console.log('🔄 WHISPER FLOATING WIDGET - SYNC & UPDATE CHECKER');
console.log('==================================================\n');

try {
  const isCheckOnly = process.argv.includes('--check');

  if (!isCheckOnly) {
    console.log('⬇️  Menarik pembaruan terbaru dari GitHub...');
    try {
      const pullOutput = execSync(`${git} pull origin main`, { encoding: 'utf8' });
      console.log(pullOutput.trim());
    } catch (e) {
      console.warn('⚠️  Catatan pull otomatis:', e.message);
    }
  }

  console.log('\n📌 DETAIL PEMBARUAN TERAKHIR (LATEST COMMIT):');
  console.log('--------------------------------------------------');
  try {
    const lastCommit = execSync(`${git} log -1 --pretty=format:"Commit  : %h%nAuthor  : %an%nTanggal : %ad%nPesan   : %s"`, { encoding: 'utf8' });
    console.log(lastCommit);
  } catch (_) {
    console.log('(Belum ada commit atau git belum terdeteksi)');
  }
  console.log('--------------------------------------------------');

  const changelogPath = path.join(__dirname, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const content = fs.readFileSync(changelogPath, 'utf8');
    const sections = content.split(/^##\s+/m);
    if (sections.length > 1) {
      console.log('\n📋 RINGKASAN CATATAN RILIS TERAKHIR (CHANGELOG.md):');
      console.log('--------------------------------------------------');
      console.log('## ' + sections[1].trim());
      console.log('--------------------------------------------------\n');
    }
  }

  console.log('✅ Status: Siap digunakan dengan versi terbaru!\n');
} catch (err) {
  console.error('❌ Terjadi kesalahan saat memeriksa update:', err.message);
}
