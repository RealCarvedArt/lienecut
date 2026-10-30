using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Windows.Forms;
static class SingleAppLauncher {
  [STAThread] static void Main() {
    try {
      byte[] bytes;
      using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("LieneCutRuntime")) {
        if (stream == null) throw new InvalidOperationException("Embedded runtime is missing.");
        bytes = new byte[stream.Length]; for (var i=0;i<bytes.Length;) { var n=stream.Read(bytes,i,bytes.Length-i); if(n==0) throw new EndOfStreamException(); i+=n; }
      }
      string hash; using(var sha=SHA256.Create()) hash=BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();
      var dir=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"LieneCut"); Directory.CreateDirectory(dir);
      var runtime=Path.Combine(dir,"runtime-"+hash+".exe"); if(!File.Exists(runtime)) File.WriteAllBytes(runtime,bytes);
      Process.Start(new ProcessStartInfo(runtime){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});
    } catch(Exception e) { MessageBox.Show("LieneCut could not start: "+e.Message,"LieneCut",MessageBoxButtons.OK,MessageBoxIcon.Error); }
  }
}
