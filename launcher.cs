using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

class WhisperLauncher {
    [STAThread]
    static void Main() {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string electronExe = Path.Combine(baseDir, "node_modules", "electron", "dist", "electron.exe");

        if (!File.Exists(electronExe)) {
            MessageBox.Show(
                "File electron.exe tidak ditemukan di:\n" + electronExe,
                "Whisper Voice Widget",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return;
        }

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = electronExe;
        psi.Arguments = ".";
        psi.WorkingDirectory = baseDir;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;

        if (psi.EnvironmentVariables.ContainsKey("ELECTRON_RUN_AS_NODE")) {
            psi.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
        }

        try {
            Process.Start(psi);
        } catch (Exception ex) {
            MessageBox.Show(
                "Gagal menjalankan Whisper:\n" + ex.Message,
                "Whisper Voice Widget",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}

