using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

static class LieneCutLauncher {
  [STAThread]
  static void Main() {
    var root = AppDomain.CurrentDomain.BaseDirectory;
    var node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
    if (!File.Exists(node) || !File.Exists(Path.Combine(root, "serve.mjs")) || !File.Exists(Path.Combine(root, "dist", "index.html"))) {
      MessageBox.Show("LieneCut is incomplete. Extract the full release ZIP and install Node.js 22.18 or newer.", "LieneCut", MessageBoxButtons.OK, MessageBoxIcon.Error);
      return;
    }
    try {
      using (var process = Process.Start(new ProcessStartInfo(node, "serve.mjs --open") {
        WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
        WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardError = true
      })) {
        var error = process.StandardError.ReadToEnd();
        process.WaitForExit();
        if (process.ExitCode != 0) throw new InvalidOperationException(error.Trim());
      }
    } catch (Exception e) {
      MessageBox.Show("LieneCut could not start: " + e.Message, "LieneCut", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
  }
}
