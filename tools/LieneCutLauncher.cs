using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

static class LieneCutLauncher {
  const int Port = 5174;

  [STAThread]
  static void Main() {
    var root = AppDomain.CurrentDomain.BaseDirectory;
    if (!Listening()) {
      var node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
      var server = Path.Combine(root, "serve.mjs");
      if (!File.Exists(node) || !File.Exists(server) || !File.Exists(Path.Combine(root, "dist", "index.html"))) {
        MessageBox.Show("LieneCut is incomplete. Extract the full release ZIP and install Node.js 22.18 or newer.", "LieneCut", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return;
      }
      try {
        Process.Start(new ProcessStartInfo(node, "serve.mjs") {
          WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden
        });
      } catch (Exception e) {
        MessageBox.Show("LieneCut could not start: " + e.Message, "LieneCut", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return;
      }
      for (var i = 0; i < 50 && !Listening(); i++) Thread.Sleep(100);
      if (!Listening()) {
        MessageBox.Show("LieneCut did not start. Another app may already be using port 5174.", "LieneCut", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return;
      }
    }
    Process.Start(new ProcessStartInfo("http://127.0.0.1:" + Port) { UseShellExecute = true });
  }

  static bool Listening() {
    try { using (var client = new TcpClient()) { client.Connect("127.0.0.1", Port); return true; } }
    catch { return false; }
  }
}
