using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Windows.Forms;
using System.Net;
using System.Diagnostics;
using System.ComponentModel;
using System.Reflection;
using System.Runtime.InteropServices;

namespace DiskSweeprWebSetup
{
    public class Program
    {
        [STAThread]
        public static void Main()
        {
            try
            {
                // Force TLS 1.2 & TLS 1.3
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11;
            }
            catch { }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ModernWebInstaller());
        }
    }

    public static class GraphicsUtils
    {
        public static GraphicsPath CreateRoundedPath(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            if (radius <= 0)
            {
                path.AddRectangle(rect);
                return path;
            }

            int d = radius * 2;
            if (d > rect.Width) d = rect.Width;
            if (d > rect.Height) d = rect.Height;

            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void FillRoundedRectangle(Graphics g, Brush brush, Rectangle rect, int radius)
        {
            using (GraphicsPath path = CreateRoundedPath(rect, radius))
            {
                g.FillPath(brush, path);
            }
        }

        public static void DrawRoundedRectangle(Graphics g, Pen pen, Rectangle rect, int radius)
        {
            using (GraphicsPath path = CreateRoundedPath(rect, radius))
            {
                g.DrawPath(pen, path);
            }
        }
    }

    // Modern Sleek Rounded Button with Hover State
    public class ModernButton : Control
    {
        public int BorderRadius { get; set; }
        public Color NormalColor { get; set; }
        public Color HoverColor { get; set; }
        public Color PressedColor { get; set; }
        public Color BorderColor { get; set; }
        public bool HasBorder { get; set; }

        private bool isHovered = false;
        private bool isPressed = false;

        public ModernButton()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            this.Cursor = Cursors.Hand;
            this.BorderRadius = 10;
            this.NormalColor = Color.FromArgb(37, 99, 235);
            this.HoverColor = Color.FromArgb(59, 130, 246);
            this.PressedColor = Color.FromArgb(29, 78, 216);
            this.BorderColor = Color.FromArgb(96, 165, 250);
            this.ForeColor = Color.White;
            this.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            this.HasBorder = false;
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            base.OnMouseEnter(e);
            isHovered = true;
            Invalidate();
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            isHovered = false;
            isPressed = false;
            Invalidate();
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button == MouseButtons.Left)
            {
                isPressed = true;
                Invalidate();
            }
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            isPressed = false;
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            Color fill = !Enabled ? Color.FromArgb(51, 65, 85) : (isPressed ? PressedColor : (isHovered ? HoverColor : NormalColor));

            using (SolidBrush b = new SolidBrush(fill))
            {
                GraphicsUtils.FillRoundedRectangle(g, b, rect, BorderRadius);
            }

            if (HasBorder && Enabled)
            {
                using (Pen p = new Pen(BorderColor, 1))
                {
                    GraphicsUtils.DrawRoundedRectangle(g, p, rect, BorderRadius);
                }
            }

            // Draw Centered Text
            Color textC = !Enabled ? Color.FromArgb(148, 163, 184) : ForeColor;
            TextRenderer.DrawText(g, Text, Font, rect, textC, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    // Modern Custom Checkbox with Sleek Rounded Box
    public class ModernCheckBox : Control
    {
        private bool _checked = true;
        public bool Checked
        {
            get { return _checked; }
            set { _checked = value; Invalidate(); }
        }

        public ModernCheckBox()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            this.Cursor = Cursors.Hand;
            this.Size = new Size(210, 24);
            this.Font = new Font("Segoe UI", 9.25f, FontStyle.Regular);
        }

        protected override void OnClick(EventArgs e)
        {
            base.OnClick(e);
            _checked = !_checked;
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            // Box rect (18 x 18 with 4px radius)
            Rectangle box = new Rectangle(0, (Height - 18) / 2, 18, 18);

            if (_checked)
            {
                using (SolidBrush b = new SolidBrush(Color.FromArgb(37, 99, 235)))
                {
                    GraphicsUtils.FillRoundedRectangle(g, b, box, 4);
                }
                using (Pen p = new Pen(Color.FromArgb(59, 130, 246), 1))
                {
                    GraphicsUtils.DrawRoundedRectangle(g, p, box, 4);
                }

                // Checkmark vector
                using (Pen checkPen = new Pen(Color.White, 2f))
                {
                    checkPen.StartCap = LineCap.Round;
                    checkPen.EndCap = LineCap.Round;
                    g.DrawLines(checkPen, new Point[] {
                        new Point(box.X + 4, box.Y + 9),
                        new Point(box.X + 7, box.Y + 13),
                        new Point(box.X + 13, box.Y + 5)
                    });
                }
            }
            else
            {
                using (SolidBrush b = new SolidBrush(Color.FromArgb(15, 23, 42)))
                {
                    GraphicsUtils.FillRoundedRectangle(g, b, box, 4);
                }
                using (Pen p = new Pen(Color.FromArgb(71, 85, 105), 1))
                {
                    GraphicsUtils.DrawRoundedRectangle(g, p, box, 4);
                }
            }

            // Text
            using (SolidBrush textB = new SolidBrush(Color.FromArgb(226, 232, 240)))
            {
                g.DrawString(Text, Font, textB, 26, (Height - Font.Height) / 2);
            }
        }
    }

    // Modern Pill Progress Bar
    public class ModernProgressBar : Control
    {
        private int _value = 0;
        public int Value
        {
            get { return _value; }
            set { _value = Math.Max(0, Math.Min(100, value)); Invalidate(); }
        }

        public ModernProgressBar()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            this.Size = new Size(460, 8);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            int radius = Height / 2;

            // Background track
            using (SolidBrush bgB = new SolidBrush(Color.FromArgb(30, 41, 59)))
            {
                GraphicsUtils.FillRoundedRectangle(g, bgB, rect, radius);
            }

            // Progress Fill with smooth gradient
            if (_value > 0)
            {
                int fillW = Math.Max(Height, (int)((rect.Width * _value) / 100.0));
                Rectangle fillRect = new Rectangle(0, 0, fillW, Height - 1);

                using (LinearGradientBrush fillB = new LinearGradientBrush(fillRect, Color.FromArgb(37, 99, 235), Color.FromArgb(96, 165, 250), 0f))
                {
                    GraphicsUtils.FillRoundedRectangle(g, fillB, fillRect, radius);
                }
            }
        }
    }

    public class ModernWebInstaller : Form
    {
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HTCAPTION = 0x2;

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        // Windows 11 Rounded Corners API
        private const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        private const int DWMWCP_ROUND = 2;

        // Native Drop Shadow
        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ClassStyle |= 0x00020000; // CS_DROPSHADOW
                return cp;
            }
        }

        private Color bg = Color.FromArgb(11, 15, 25);
        private Color cardBg = Color.FromArgb(17, 24, 39);
        private Color primary = Color.FromArgb(37, 99, 235);
        private Color textMain = Color.FromArgb(248, 250, 252);
        private Color textMuted = Color.FromArgb(148, 163, 184);
        private Color textDim = Color.FromArgb(100, 116, 139);

        private Label lblPathDisplay;
        private ModernButton btnChangePath;
        private ModernCheckBox chkDesktop;
        private ModernCheckBox chkStart;
        private ModernButton btnInstall;
        private Label lblStatus;
        private Label lblPercent;
        private ModernProgressBar prgBar;
        private WebClient webClient;
        private Image appIcon = null;

        private string installDir;
        private string defaultDownloadUrl = "https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Setup-1.1.0.exe";
        private string tempInstallerPath;
        private bool isInstalled = false;
        private string existingUninstallerPath = null;
        private ModernButton btnUninstall = null;

        public ModernWebInstaller()
        {
            this.Size = new Size(520, 420);
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = bg;
            this.DoubleBuffered = true;

            // Enable Windows 11 rounded corners if supported
            try
            {
                int preference = DWMWCP_ROUND;
                DwmSetWindowAttribute(this.Handle, DWMWA_WINDOW_CORNER_PREFERENCE, ref preference, sizeof(int));
            }
            catch { }

            installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "DiskSweepr");
            existingUninstallerPath = DetectExistingInstallation();

            LoadEmbeddedIcon();
            InitUI();
        }

        private string DetectExistingInstallation()
        {
            try
            {
                using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\com.disksweepr.app"))
                {
                    if (key != null)
                    {
                        object loc = key.GetValue("InstallLocation");
                        if (loc != null && Directory.Exists(loc.ToString()))
                        {
                            installDir = loc.ToString();
                        }
                        object uninst = key.GetValue("UninstallString");
                        if (uninst != null)
                        {
                            string p = uninst.ToString().Replace("\"", "").Trim();
                            if (File.Exists(p)) return p;
                        }
                    }
                }
            }
            catch { }

            string localUninst = Path.Combine(installDir, "Uninstall DiskSweepr.exe");
            if (File.Exists(localUninst)) return localUninst;

            return null;
        }

        private void LoadEmbeddedIcon()
        {
            try
            {
                Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("AppIcon");
                if (s != null)
                {
                    appIcon = Image.FromStream(s);
                }
                else
                {
                    string p = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "build", "icon.png");
                    if (File.Exists(p)) appIcon = Image.FromFile(p);
                }
            }
            catch { }
        }

        private void InitUI()
        {
            // Close & Minimize Header Buttons
            Button btnClose = new Button
            {
                Text = "✕",
                Size = new Size(32, 28),
                Location = new Point(this.Width - 38, 6),
                FlatStyle = FlatStyle.Flat,
                ForeColor = textDim,
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand,
                Font = new Font("Arial", 9.5f)
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.FlatAppearance.MouseOverBackColor = Color.FromArgb(220, 38, 38);
            btnClose.FlatAppearance.MouseDownBackColor = Color.FromArgb(185, 28, 28);
            btnClose.MouseEnter += (s, e) => btnClose.ForeColor = Color.White;
            btnClose.MouseLeave += (s, e) => btnClose.ForeColor = textDim;
            btnClose.Click += (s, e) => Application.Exit();

            Button btnMin = new Button
            {
                Text = "—",
                Size = new Size(32, 28),
                Location = new Point(this.Width - 72, 6),
                FlatStyle = FlatStyle.Flat,
                ForeColor = textDim,
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand,
                Font = new Font("Arial", 8.5f)
            };
            btnMin.FlatAppearance.BorderSize = 0;
            btnMin.FlatAppearance.MouseOverBackColor = Color.FromArgb(30, 41, 59);
            btnMin.Click += (s, e) => this.WindowState = FormWindowState.Minimized;

            this.Controls.Add(btnClose);
            this.Controls.Add(btnMin);

            // Drag window anywhere
            this.MouseDown += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(Handle, WM_NCLBUTTONDOWN, HTCAPTION, 0);
                }
            };

            // Modern Path Row (Label + Sleek Change button)
            lblPathDisplay = new Label
            {
                Text = ShortenPath(installDir, 42),
                Location = new Point(48, 206),
                Size = new Size(330, 26),
                ForeColor = textMuted,
                Font = new Font("Consolas", 9f),
                TextAlign = ContentAlignment.MiddleLeft,
                BackColor = Color.Transparent
            };
            this.Controls.Add(lblPathDisplay);

            btnChangePath = new ModernButton
            {
                Text = "Change...",
                Location = new Point(390, 204),
                Size = new Size(82, 28),
                BorderRadius = 6,
                NormalColor = Color.FromArgb(30, 41, 59),
                HoverColor = Color.FromArgb(51, 65, 85),
                PressedColor = Color.FromArgb(15, 23, 42),
                ForeColor = Color.FromArgb(226, 232, 240),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            };
            btnChangePath.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Select DiskSweepr Installation Directory";
                    fbd.SelectedPath = installDir;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        installDir = fbd.SelectedPath;
                        lblPathDisplay.Text = ShortenPath(installDir, 42);
                    }
                }
            };
            this.Controls.Add(btnChangePath);

            // Modern Flat Checkboxes
            chkDesktop = new ModernCheckBox
            {
                Text = "Create Desktop Shortcut",
                Location = new Point(48, 246),
                Size = new Size(200, 24),
                Checked = true
            };
            chkStart = new ModernCheckBox
            {
                Text = "Add to Start Menu",
                Location = new Point(270, 246),
                Size = new Size(200, 24),
                Checked = true
            };
            this.Controls.Add(chkDesktop);
            this.Controls.Add(chkStart);

            // Status label & Percent label
            lblStatus = new Label
            {
                Text = !string.IsNullOrEmpty(existingUninstallerPath)
                    ? "DiskSweepr is currently installed on this PC."
                    : "Ready to install DiskSweepr to your PC.",
                Location = new Point(48, 286),
                Size = new Size(350, 18),
                ForeColor = !string.IsNullOrEmpty(existingUninstallerPath) ? Color.FromArgb(56, 189, 248) : textMuted,
                Font = new Font("Segoe UI", 8.75f)
            };
            lblPercent = new Label
            {
                Text = "",
                Location = new Point(400, 286),
                Size = new Size(72, 18),
                ForeColor = Color.FromArgb(56, 189, 248),
                Font = new Font("Segoe UI", 8.75f, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleRight
            };
            this.Controls.Add(lblStatus);
            this.Controls.Add(lblPercent);

            // Progress bar
            prgBar = new ModernProgressBar
            {
                Location = new Point(48, 310),
                Size = new Size(424, 8),
                Visible = false
            };
            this.Controls.Add(prgBar);

            if (!string.IsNullOrEmpty(existingUninstallerPath))
            {
                btnInstall = new ModernButton
                {
                    Text = "Reinstall / Update",
                    Location = new Point(48, 336),
                    Size = new Size(244, 46),
                    BorderRadius = 10,
                    NormalColor = Color.FromArgb(37, 99, 235),
                    HoverColor = Color.FromArgb(59, 130, 246),
                    PressedColor = Color.FromArgb(29, 78, 216),
                    Font = new Font("Segoe UI", 10.5f, FontStyle.Bold)
                };
                btnInstall.Click += BtnInstall_Click;
                this.Controls.Add(btnInstall);

                btnUninstall = new ModernButton
                {
                    Text = "Uninstall",
                    Location = new Point(302, 336),
                    Size = new Size(170, 46),
                    BorderRadius = 10,
                    NormalColor = Color.FromArgb(35, 20, 25),
                    HoverColor = Color.FromArgb(185, 28, 28),
                    PressedColor = Color.FromArgb(153, 27, 27),
                    BorderColor = Color.FromArgb(153, 27, 27),
                    HasBorder = true,
                    ForeColor = Color.FromArgb(252, 165, 165),
                    Font = new Font("Segoe UI", 10.5f, FontStyle.Bold)
                };
                btnUninstall.Click += (s, e) =>
                {
                    DialogResult res = MessageBox.Show(
                        "Are you sure you want to uninstall DiskSweepr from your system?",
                        "Uninstall DiskSweepr",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question);

                    if (res == DialogResult.Yes)
                    {
                        try
                        {
                            Process.Start(existingUninstallerPath);
                            Application.Exit();
                        }
                        catch (Exception ex)
                        {
                            MessageBox.Show("Failed to launch uninstaller: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        }
                    }
                };
                this.Controls.Add(btnUninstall);
            }
            else
            {
                // Primary CTA Button
                btnInstall = new ModernButton
                {
                    Text = "Install DiskSweepr",
                    Location = new Point(48, 336),
                    Size = new Size(424, 46),
                    BorderRadius = 10,
                    NormalColor = Color.FromArgb(37, 99, 235),
                    HoverColor = Color.FromArgb(59, 130, 246),
                    PressedColor = Color.FromArgb(29, 78, 216),
                    Font = new Font("Segoe UI", 11f, FontStyle.Bold)
                };
                btnInstall.Click += BtnInstall_Click;
                this.Controls.Add(btnInstall);
            }
        }

        private string ShortenPath(string path, int maxLength)
        {
            if (path.Length <= maxLength) return path;
            return path.Substring(0, 15) + "..." + path.Substring(path.Length - (maxLength - 18));
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            if (isInstalled)
            {
                string exePath = Path.Combine(installDir, "DiskSweepr.exe");
                if (File.Exists(exePath))
                {
                    Process.Start(exePath);
                }
                Application.Exit();
                return;
            }

            if (btnUninstall != null)
            {
                btnUninstall.Visible = false;
                btnInstall.Size = new Size(424, 46);
            }

            btnInstall.Enabled = false;
            btnChangePath.Enabled = false;
            chkDesktop.Enabled = false;
            chkStart.Enabled = false;
            prgBar.Visible = true;

            string localBeside = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "DiskSweepr-Setup-1.1.0.exe");
            string localRelease = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "release", "DiskSweepr-Setup-1.1.0.exe");

            if (File.Exists(localBeside))
            {
                RunSilentInstall(localBeside);
                return;
            }
            else if (File.Exists(localRelease))
            {
                RunSilentInstall(Path.GetFullPath(localRelease));
                return;
            }

            tempInstallerPath = Path.Combine(Path.GetTempPath(), "DiskSweepr-Setup-1.1.0.exe");
            lblStatus.Text = "Connecting to GitHub Releases...";

            webClient = new WebClient();
            webClient.Headers.Add("User-Agent", "DiskSweepr-Web-Installer/1.0");
            webClient.DownloadProgressChanged += (s, ev) =>
            {
                this.Invoke((MethodInvoker)delegate
                {
                    prgBar.Value = ev.ProgressPercentage;
                    double mbReceived = ev.BytesReceived / 1048576.0;
                    double mbTotal = ev.TotalBytesToReceive / 1048576.0;
                    lblPercent.Text = ev.ProgressPercentage + "%";
                    if (mbTotal > 0)
                    {
                        lblStatus.Text = string.Format("Downloading: {0:F1} MB / {1:F1} MB", mbReceived, mbTotal);
                    }
                });
            };

            webClient.DownloadFileCompleted += (s, ev) =>
            {
                if (ev.Error != null)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        lblStatus.Text = "Download failed: " + ev.Error.Message;
                        lblStatus.ForeColor = Color.FromArgb(239, 68, 68);
                        btnInstall.Enabled = true;
                        btnInstall.Text = "Retry Download";
                    });
                }
                else
                {
                    RunSilentInstall(tempInstallerPath);
                }
            };

            try
            {
                webClient.DownloadFileAsync(new Uri(defaultDownloadUrl), tempInstallerPath);
            }
            catch (Exception ex)
            {
                lblStatus.Text = "Connection error: " + ex.Message;
                lblStatus.ForeColor = Color.FromArgb(239, 68, 68);
                btnInstall.Enabled = true;
            }
        }

        private void RunSilentInstall(string installerFile)
        {
            this.Invoke((MethodInvoker)delegate
            {
                lblStatus.Text = "Installing DiskSweepr...";
                lblPercent.Text = "Installing";
                prgBar.Value = 95;
            });

            BackgroundWorker bw = new BackgroundWorker();
            bw.DoWork += (s, e) =>
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = installerFile,
                        Arguments = string.Format("/S /D={0}", installDir),
                        UseShellExecute = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    Process p = Process.Start(psi);
                    p.WaitForExit();
                }
                catch { }
            };

            bw.RunWorkerCompleted += (s, e) =>
            {
                lblStatus.Text = "✓ DiskSweepr is installed and ready!";
                lblStatus.ForeColor = Color.FromArgb(34, 197, 94);
                lblPercent.Text = "100%";
                prgBar.Value = 100;

                btnInstall.Enabled = true;
                btnInstall.Text = "Launch DiskSweepr";
                btnInstall.NormalColor = Color.FromArgb(16, 185, 129);
                btnInstall.HoverColor = Color.FromArgb(5, 150, 105);
                btnInstall.PressedColor = Color.FromArgb(4, 120, 87);
                isInstalled = true;
            };

            bw.RunWorkerAsync();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            // Outer 1px Subtle Border
            using (Pen p = new Pen(Color.FromArgb(30, 41, 59), 1))
            {
                GraphicsUtils.DrawRoundedRectangle(g, p, new Rectangle(0, 0, Width - 1, Height - 1), 12);
            }

            // Top subtle branding title
            using (Font f = new Font("Segoe UI", 8.25f, FontStyle.Bold))
            using (SolidBrush b = new SolidBrush(Color.FromArgb(100, 116, 139)))
            {
                g.DrawString("DISKSWEEPR INSTALLER", f, b, 20, 12);
            }

            // Hero Section: App Icon container (60 x 60 rounded squircle)
            Rectangle iconBox = new Rectangle(48, 52, 60, 60);
            using (SolidBrush cardB = new SolidBrush(cardBg))
            using (Pen borderP = new Pen(Color.FromArgb(51, 65, 85), 1))
            {
                GraphicsUtils.FillRoundedRectangle(g, cardB, iconBox, 14);
                GraphicsUtils.DrawRoundedRectangle(g, borderP, iconBox, 14);
            }

            if (appIcon != null)
            {
                g.DrawImage(appIcon, new Rectangle(iconBox.X + 6, iconBox.Y + 6, 48, 48));
            }

            // App Title: "DiskSweepr"
            using (Font titleF = new Font("Segoe UI", 20f, FontStyle.Bold))
            using (SolidBrush titleB = new SolidBrush(textMain))
            {
                g.DrawString("DiskSweepr", titleF, titleB, 122, 46);
            }

            // Version Pill: "v1.1.0"
            Rectangle verRect = new Rectangle(296, 56, 50, 20);
            using (SolidBrush verBg = new SolidBrush(Color.FromArgb(12, 74, 110)))
            using (Pen verP = new Pen(Color.FromArgb(2, 132, 199), 1))
            using (Font verF = new Font("Segoe UI", 8.5f, FontStyle.Bold))
            using (SolidBrush verB = new SolidBrush(Color.FromArgb(56, 189, 248)))
            {
                GraphicsUtils.FillRoundedRectangle(g, verBg, verRect, 6);
                GraphicsUtils.DrawRoundedRectangle(g, verP, verRect, 6);
                g.DrawString("v1.1.0", verF, verB, verRect.X + 6, verRect.Y + 2);
            }

            // Subtitle
            using (Font tagF = new Font("Segoe UI", 9.25f))
            using (SolidBrush tagB = new SolidBrush(textMuted))
            {
                g.DrawString("High-Performance System Storage Optimizer", tagF, tagB, 124, 86);
            }

            // 3 Modern Tags: [Fast] [Safe] [Open Source]
            DrawFeatureTag(g, "⚡ Instant Scan", 124, 110);
            DrawFeatureTag(g, "🛡️ Risk Rated", 232, 110);
            DrawFeatureTag(g, "🔒 Privacy First", 330, 110);

            // Installation Path Card Container (424 x 40 rounded)
            Rectangle pathCard = new Rectangle(48, 198, 424, 38);
            using (SolidBrush cardB = new SolidBrush(Color.FromArgb(15, 23, 42)))
            using (Pen cardP = new Pen(Color.FromArgb(30, 41, 59), 1))
            {
                GraphicsUtils.FillRoundedRectangle(g, cardB, pathCard, 8);
                GraphicsUtils.DrawRoundedRectangle(g, cardP, pathCard, 8);
            }

            // Path Section Header
            using (Font f = new Font("Segoe UI", 8.25f, FontStyle.Bold))
            using (SolidBrush b = new SolidBrush(Color.FromArgb(100, 116, 139)))
            {
                g.DrawString("INSTALLATION DIRECTORY", f, b, 48, 178);
            }
        }

        private void DrawFeatureTag(Graphics g, string text, int x, int y)
        {
            using (Font f = new Font("Segoe UI", 8f, FontStyle.Bold))
            using (SolidBrush bgB = new SolidBrush(Color.FromArgb(19, 27, 46)))
            using (Pen p = new Pen(Color.FromArgb(30, 41, 59), 1))
            using (SolidBrush textB = new SolidBrush(Color.FromArgb(148, 163, 184)))
            {
                SizeF size = g.MeasureString(text, f);
                Rectangle rect = new Rectangle(x, y, (int)size.Width + 12, 22);
                GraphicsUtils.FillRoundedRectangle(g, bgB, rect, 6);
                GraphicsUtils.DrawRoundedRectangle(g, p, rect, 6);
                g.DrawString(text, f, textB, x + 6, y + 3);
            }
        }
    }
}
