using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Forms;

class Program {
    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    static extern bool SetCursorPos(int X, int Y);

    [StructLayout(LayoutKind.Sequential)]
    struct RECT {
        public int Left, Top, Right, Bottom;
    }

    [DllImport("user32.dll")]
    static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("dwmapi.dll")]
    static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

    const int GWL_EXSTYLE = -20;
    const int WS_EX_TOOLWINDOW = 0x00000080;
    const int DWMWA_CLOAKED = 14;

    [DllImport("user32.dll")]
    static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    static extern uint MapVirtualKey(uint uCode, uint uMapType);

    [DllImport("user32.dll")]
    static extern bool EnumChildWindows(IntPtr hwndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("kernel32.dll")]
    static extern uint GetCurrentThreadId();

    const byte VK_CONTROL = 0x11;
    const byte VK_SHIFT = 0x10;
    const byte VK_MENU = 0x12; // Alt
    const byte VK_LWIN = 0x5B;
    const byte VK_TAB = 0x09;
    const byte VK_RETURN = 0x0D;
    const byte VK_ESCAPE = 0x1B;
    const byte VK_LEFT = 0x25;
    const byte VK_PRIOR = 0x21; // Page Up
    const byte VK_NEXT = 0x22;  // Page Down
    const byte VK_END = 0x23;
    const byte VK_HOME = 0x24;
    const byte VK_F5 = 0x74;
    const byte VK_V = 0x56;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_WHEEL = 0x0800;
    const uint MOUSEEVENTF_HWHEEL = 0x01000;
    const int SW_MAXIMIZE = 3;
    const int SW_MINIMIZE = 6;
    const int SW_RESTORE = 9;
    const uint WM_CLOSE = 0x0010;

    static string EscapeJson(string s) {
        if (string.IsNullOrEmpty(s)) return "";
        StringBuilder sb = new StringBuilder(s.Length);
        foreach (char c in s) {
            if (c == '\\') sb.Append("\\\\");
            else if (c == '"') sb.Append("\\\"");
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c >= 32) sb.Append(c);
        }
        return sb.ToString();
    }

    static void FocusWindow(IntPtr targetHwnd) {
        if (targetHwnd == IntPtr.Zero) return;
        if (IsIconic(targetHwnd)) {
            ShowWindow(targetHwnd, SW_RESTORE);
            Thread.Sleep(80);
        }
        IntPtr currentHwnd = GetForegroundWindow();
        if (currentHwnd != targetHwnd) {
            uint dummy;
            uint currentThread = GetCurrentThreadId();
            uint targetThread = GetWindowThreadProcessId(targetHwnd, out dummy);
            uint fgThread = currentHwnd != IntPtr.Zero ? GetWindowThreadProcessId(currentHwnd, out dummy) : 0;

            if (fgThread != 0 && fgThread != currentThread) {
                AttachThreadInput(currentThread, fgThread, true);
            }
            AttachThreadInput(currentThread, targetThread, true);
            SetForegroundWindow(targetHwnd);
            BringWindowToTop(targetHwnd);
            AttachThreadInput(currentThread, targetThread, false);
            if (fgThread != 0 && fgThread != currentThread) {
                AttachThreadInput(currentThread, fgThread, false);
            }
        }
    }

    struct WinInfo {
        public long hwnd;
        public string title;
        public string process;
    }

    static bool IsAltTabCandidate(IntPtr hWnd) {
        if (!IsWindowVisible(hWnd)) return false;
        int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
        if ((exStyle & WS_EX_TOOLWINDOW) != 0) return false;
        int cloaked = 0;
        try {
            if (DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, Marshal.SizeOf(typeof(int))) == 0 && cloaked != 0) {
                return false;
            }
        } catch {}
        if (!IsIconic(hWnd)) {
            RECT r;
            if (GetWindowRect(hWnd, out r)) {
                if ((r.Right - r.Left) < 30 || (r.Bottom - r.Top) < 30) return false;
            }
        }
        return true;
    }

    static List<WinInfo> GetVisibleWindows() {
        List<WinInfo> list = new List<WinInfo>();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            if (!IsAltTabCandidate(hWnd)) return true;
            int len = GetWindowTextLength(hWnd);
            if (len <= 0) return true;

            StringBuilder sb = new StringBuilder(len + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString().Trim();
            if (string.IsNullOrEmpty(title)) return true;

            if (title == "Program Manager" || title == "Windows Input Experience" || title == "Microsoft Text Input Application") return true;

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            string procName = "";
            try {
                Process p = Process.GetProcessById((int)pid);
                procName = p.ProcessName;
            } catch {}

            list.Add(new WinInfo { hwnd = hWnd.ToInt64(), title = title, process = procName });
            return true;
        }, IntPtr.Zero);
        return list;
    }

    static string GetWindowTitleText(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return "";
        try {
            int len = GetWindowTextLength(hWnd);
            if (len <= 0) return "";
            StringBuilder sb = new StringBuilder(len + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            return sb.ToString().Trim();
        } catch {
            return "";
        }
    }

    static bool IsWisOwnWindowTitle(string title) {
        if (string.IsNullOrEmpty(title)) return false;
        string t = title.Trim();
        return t == "Whisper Widget" ||
               t == "Menu Widget" ||
               t == "Karakter Mata" ||
               t == "Wis Grid Canvas" ||
               t.StartsWith("Pengaturan ", StringComparison.OrdinalIgnoreCase) ||
               t.StartsWith("Whisper Agent", StringComparison.OrdinalIgnoreCase);
    }

    static IntPtr GetActiveTargetWindow() {
        IntPtr fg = GetForegroundWindow();
        if (fg != IntPtr.Zero && !IsWisOwnWindowTitle(GetWindowTitleText(fg))) {
            return fg;
        }
        List<WinInfo> wins = GetVisibleWindows();
        foreach (WinInfo w in wins) {
            if (!IsWisOwnWindowTitle(w.title)) {
                IntPtr h = new IntPtr(w.hwnd);
                if (!IsIconic(h)) return h;
            }
        }
        foreach (WinInfo w in wins) {
            if (!IsWisOwnWindowTitle(w.title)) return new IntPtr(w.hwnd);
        }
        return fg;
    }

    static void ListVisibleWindows() {
        List<WinInfo> wins = GetVisibleWindows();
        List<string> items = new List<string>();
        foreach (WinInfo w in wins) {
            items.Add("{\"hwnd\":" + w.hwnd + ",\"title\":\"" + EscapeJson(w.title) + "\",\"process\":\"" + EscapeJson(w.process) + "\"}");
        }
        Console.OutputEncoding = Encoding.UTF8;
        Console.WriteLine("[" + string.Join(",", items.ToArray()) + "]");
    }

    static bool WaitForWindow(string keyword, int timeoutMs) {
        string kw = keyword.ToLowerInvariant();
        Stopwatch sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs) {
            List<WinInfo> wins = GetVisibleWindows();
            foreach (WinInfo w in wins) {
                if (w.process.ToLowerInvariant().Contains(kw) || w.title.ToLowerInvariant().Contains(kw)) {
                    FocusWindow(new IntPtr(w.hwnd));
                    return true;
                }
            }
            Thread.Sleep(150);
        }
        return false;
    }

    static IntPtr FindBrowserWindow() {
        List<WinInfo> wins = GetVisibleWindows();
        foreach (WinInfo w in wins) {
            string p = w.process.ToLowerInvariant();
            if (p == "chrome" || p == "msedge" || p == "brave") {
                return new IntPtr(w.hwnd);
            }
        }
        return IntPtr.Zero;
    }

    static void ListChromeTabs() {
        Console.OutputEncoding = Encoding.UTF8;
        IntPtr hwnd = FindBrowserWindow();
        if (hwnd == IntPtr.Zero) {
            Console.WriteLine("[]");
            return;
        }
        try {
            AutomationElement root = AutomationElement.FromHandle(hwnd);
            Condition tabCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.TabItem);
            AutomationElementCollection tabs = root.FindAll(TreeScope.Descendants, tabCond);
            List<string> outList = new List<string>();
            for (int i = 0; i < tabs.Count; i++) {
                string name = tabs[i].Current.Name;
                if (!string.IsNullOrEmpty(name)) {
                    outList.Add("{\"index\":" + i + ",\"name\":\"" + EscapeJson(name) + "\"}");
                }
            }
            Console.WriteLine("[" + string.Join(",", outList.ToArray()) + "]");
        } catch {
            Console.WriteLine("[]");
        }
    }

    static bool SelectChromeTab(string keyword) {
        IntPtr hwnd = FindBrowserWindow();
        if (hwnd == IntPtr.Zero) return false;

        FocusWindow(hwnd);
        Thread.Sleep(80);

        try {
            AutomationElement root = AutomationElement.FromHandle(hwnd);
            Condition tabCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.TabItem);
            AutomationElementCollection tabs = root.FindAll(TreeScope.Descendants, tabCond);
            string kw = keyword.ToLowerInvariant();

            for (int i = 0; i < tabs.Count; i++) {
                string name = tabs[i].Current.Name ?? "";
                if (name.ToLowerInvariant().Contains(kw)) {
                    object patternObj;
                    if (tabs[i].TryGetCurrentPattern(SelectionItemPattern.Pattern, out patternObj)) {
                        ((SelectionItemPattern)patternObj).Select();
                        return true;
                    }
                    // Fallback: InvokePattern or Send Ctrl+(i+1) if in first 8 tabs
                    if (tabs[i].TryGetCurrentPattern(InvokePattern.Pattern, out patternObj)) {
                        ((InvokePattern)patternObj).Invoke();
                        return true;
                    }
                    if (i < 8) {
                        SendCombo(new byte[] { VK_CONTROL }, (byte)(0x31 + i));
                        return true;
                    }
                }
            }
        } catch {}
        return false;
    }

    static bool IsExtendedKey(byte vk) {
        return vk == VK_LEFT || vk == 0x26 || vk == 0x27 || vk == 0x28 ||
               vk == VK_PRIOR || vk == VK_NEXT || vk == VK_END || vk == VK_HOME ||
               vk == 0x2D || vk == 0x2E || vk == VK_LWIN ||
               (vk >= 0xA6 && vk <= 0xB3);
    }

    static void PressKey(byte vk, bool up) {
        byte scan = (byte)MapVirtualKey(vk, 0);
        uint flags = (IsExtendedKey(vk) ? KEYEVENTF_EXTENDEDKEY : 0u) | (up ? KEYEVENTF_KEYUP : 0u);
        keybd_event(vk, scan, flags, UIntPtr.Zero);
    }

    static void SendCombo(byte[] modifiers, byte key) {
        foreach (byte m in modifiers) {
            PressKey(m, false);
            Thread.Sleep(12);
        }
        PressKey(key, false);
        Thread.Sleep(30);
        PressKey(key, true);
        for (int i = modifiers.Length - 1; i >= 0; i--) {
            Thread.Sleep(12);
            PressKey(modifiers[i], true);
        }
    }

    static bool ExecuteScroll(string direction, int customAmount = 0) {
        string dir = direction.Trim().ToLowerInvariant();
        if (dir == "top") {
            SendCombo(new byte[] { VK_CONTROL }, VK_HOME);
            return true;
        }
        if (dir == "bottom") {
            SendCombo(new byte[] { VK_CONTROL }, VK_END);
            return true;
        }
        if (dir == "down" || dir == "up") {
            int sign = dir == "down" ? -1 : 1;
            if (customAmount > 0) {
                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, sign * customAmount, UIntPtr.Zero);
            } else {
                for (int i = 0; i < 6; i++) {
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, sign * 120, UIntPtr.Zero);
                    Thread.Sleep(22);
                }
            }
            return true;
        }
        if (dir == "left" || dir == "right") {
            int sign = dir == "right" ? 1 : -1;
            if (customAmount > 0) {
                mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, sign * customAmount, UIntPtr.Zero);
            } else {
                for (int i = 0; i < 5; i++) {
                    mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, sign * 120, UIntPtr.Zero);
                    Thread.Sleep(22);
                }
            }
            return true;
        }
        return false;
    }

    static byte ParseVirtualKey(string keyName) {
        string k = (keyName ?? "").Trim().ToLowerInvariant();
        if (k.Length == 1) {
            char ch = k[0];
            if (ch >= 'a' && ch <= 'z') return (byte)(0x41 + (ch - 'a'));
            if (ch >= '0' && ch <= '9') return (byte)(0x30 + (ch - '0'));
        }
        if (k.StartsWith("f") && k.Length <= 3) {
            int fnum;
            if (int.TryParse(k.Substring(1), out fnum) && fnum >= 1 && fnum <= 12) {
                return (byte)(0x6F + fnum);
            }
        }
        switch (k) {
            case "space": return 0x20;
            case "enter":
            case "return": return VK_RETURN;
            case "tab": return VK_TAB;
            case "esc":
            case "escape": return VK_ESCAPE;
            case "backspace":
            case "back": return 0x08;
            case "delete":
            case "del": return 0x2E;
            case "left": return VK_LEFT;
            case "up": return 0x26;
            case "right": return 0x27;
            case "down": return 0x28;
            case "home": return VK_HOME;
            case "end": return VK_END;
            case "pageup":
            case "prior": return VK_PRIOR;
            case "pagedown":
            case "next": return VK_NEXT;
            case "plus":
            case "=": return 0xBB;
            case "minus":
            case "-": return 0xBD;
            case "slash":
            case "/": return 0xBF;
            case "media_play_pause":
            case "play_pause": return 0xB3;
            case "media_next": return 0xB0;
            case "media_prev": return 0xB1;
            case "media_stop": return 0xB2;
            case "volume_mute":
            case "mute": return 0xAD;
            case "volume_down": return 0xAE;
            case "volume_up": return 0xAF;
            case "browser_back": return 0xA6;
            case "browser_forward": return 0xA7;
            case "browser_refresh": return 0xA8;
        }
        return 0;
    }

    static bool ExecuteHotkey(string combo) {
        string c = (combo ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(c)) return false;

        // Focus underlying app if Wis settings/widget window currently holds focus
        IntPtr fg = GetForegroundWindow();
        if (fg == IntPtr.Zero || IsWisOwnWindowTitle(GetWindowTitleText(fg))) {
            IntPtr target = GetActiveTargetWindow();
            if (target != IntPtr.Zero) {
                FocusWindow(target);
                Thread.Sleep(85);
            }
        }

        if (c == "slash" || c == "/") { SendKeys.SendWait("/"); return true; }

        string[] parts = c.Split(new char[] { '+' }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return false;

        List<byte> mods = new List<byte>();
        for (int i = 0; i < parts.Length - 1; i++) {
            string m = parts[i].Trim();
            if (m == "ctrl" || m == "control") mods.Add(VK_CONTROL);
            else if (m == "alt" || m == "menu") mods.Add(VK_MENU);
            else if (m == "shift") mods.Add(VK_SHIFT);
            else if (m == "win" || m == "lwin") mods.Add(VK_LWIN);
            else return false;
        }

        byte vk = ParseVirtualKey(parts[parts.Length - 1]);
        if (vk == 0) return false;

        SendCombo(mods.ToArray(), vk);
        return true;
    }

    static bool ExecuteWindowControl(string op, long customHwnd) {
        string action = (op ?? "").Trim().ToLowerInvariant();
        IntPtr hwnd = customHwnd != 0 ? new IntPtr(customHwnd) : GetActiveTargetWindow();
        if (hwnd == IntPtr.Zero) return false;

        if (action == "minimize") {
            return ShowWindow(hwnd, SW_MINIMIZE);
        }
        if (action == "maximize") {
            FocusWindow(hwnd);
            return ShowWindow(hwnd, SW_MAXIMIZE);
        }
        if (action == "restore" || action == "normal") {
            FocusWindow(hwnd);
            return ShowWindow(hwnd, SW_RESTORE);
        }
        if (action == "close") {
            return PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
        }
        if (action == "fullscreen") {
            FocusWindow(hwnd);
            Thread.Sleep(70);
            SendCombo(new byte[0], 0x7A); // F11
            return true;
        }
        return false;
    }

    static void ExecuteMouseClick(int x, int y, string mode) {
        SetCursorPos(x, y);
        Thread.Sleep(85);
        string m = (mode ?? "left").Trim().ToLowerInvariant();
        if (m == "right") {
            mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(25);
            mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
        } else if (m == "double") {
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(20);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(60);
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(20);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        } else {
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(25);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        }
    }

    static bool CaptureScreenGrid(int sx, int sy, int sw, int sh, string outPath) {
        if (sw <= 0 || sh <= 0 || string.IsNullOrEmpty(outPath)) return false;
        int w = 960;
        int h = Math.Max(320, (int)Math.Round((double)w * sh / sw));

        using (var rawBmp = new Bitmap(sw, sh, PixelFormat.Format24bppRgb))
        using (var gRaw = Graphics.FromImage(rawBmp)) {
            gRaw.CopyFromScreen(sx, sy, 0, 0, new Size(sw, sh), CopyPixelOperation.SourceCopy);

            using (var scaled = new Bitmap(w, h, PixelFormat.Format24bppRgb))
            using (var g = Graphics.FromImage(scaled)) {
                g.InterpolationMode = InterpolationMode.Bilinear;
                g.DrawImage(rawBmp, 0, 0, w, h);

                // Bold 5x4 Chessboard Grid (A1..E4) proven much easier for Vision AI than dense ticks
                string[] cols = new string[] { "A", "B", "C", "D", "E" };
                using (var cellPen = new Pen(Color.FromArgb(145, 255, 255, 0), 1.5f))
                using (var bgBrush = new SolidBrush(Color.FromArgb(170, 0, 0, 0)))
                using (var txtBrush = new SolidBrush(Color.Yellow))
                using (var font = new Font("Arial", 12f, FontStyle.Bold)) {
                    for (int c = 0; c < 5; c++) {
                        int gx = (int)Math.Round(w * c / 5.0);
                        if (c > 0) g.DrawLine(cellPen, gx, 0, gx, h);
                        for (int r = 0; r < 4; r++) {
                            int gy = (int)Math.Round(h * r / 4.0);
                            if (c == 0 && r > 0) g.DrawLine(cellPen, 0, gy, w, gy);
                            string lbl = cols[c] + (r + 1).ToString();
                            g.FillRectangle(bgBrush, gx + 3, gy + 3, 27, 18);
                            g.DrawString(lbl, font, txtBrush, gx + 4, gy + 3);
                        }
                    }
                }

                ImageCodecInfo jpgEncoder = null;
                foreach (var codec in ImageCodecInfo.GetImageEncoders()) {
                    if (codec.FormatID == ImageFormat.Jpeg.Guid) { jpgEncoder = codec; break; }
                }
                if (jpgEncoder != null) {
                    using (var ep = new EncoderParameters(1)) {
                        ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 85L);
                        scaled.Save(outPath, jpgEncoder, ep);
                    }
                } else {
                    scaled.Save(outPath, ImageFormat.Jpeg);
                }
                return true;
            }
        }
    }

    static bool CaptureScreenCrop(int sx, int sy, int sw, int sh, string outPath) {
        if (sw <= 8 || sh <= 8 || string.IsNullOrEmpty(outPath)) return false;
        int w = 960;
        int h = Math.Max(220, (int)Math.Round((double)w * sh / sw));

        using (var rawBmp = new Bitmap(sw, sh, PixelFormat.Format24bppRgb))
        using (var gRaw = Graphics.FromImage(rawBmp)) {
            gRaw.CopyFromScreen(sx, sy, 0, 0, new Size(sw, sh), CopyPixelOperation.SourceCopy);
            using (var scaled = new Bitmap(w, h, PixelFormat.Format24bppRgb))
            using (var g = Graphics.FromImage(scaled)) {
                g.InterpolationMode = InterpolationMode.Bilinear;
                g.DrawImage(rawBmp, 0, 0, w, h);
                using (var pen = new Pen(Color.FromArgb(120, 0, 255, 255), 1f))
                using (var bg = new SolidBrush(Color.FromArgb(195, 0, 0, 0)))
                using (var txt = new SolidBrush(Color.Yellow))
                using (var font = new Font("Arial", 10f, FontStyle.Bold)) {
                    for (int p = 10; p < 100; p += 10) {
                        int gx = (int)Math.Round(w * p / 100.0);
                        g.DrawLine(pen, gx, 0, gx, h);
                        g.FillRectangle(bg, gx - 12, h - 18, 24, 16);
                        g.DrawString(p.ToString(), font, txt, gx - 10, h - 17);
                        int gy = (int)Math.Round(h * p / 100.0);
                        g.DrawLine(pen, 0, gy, w, gy);
                        g.FillRectangle(bg, 2, gy - 8, 24, 16);
                        g.DrawString(p.ToString(), font, txt, 3, gy - 7);
                    }
                }
                scaled.Save(outPath, ImageFormat.Jpeg);
                return true;
            }
        }
    }

    struct UiQueueNode {
        public AutomationElement el;
        public int depth;
    }

    static string ShortControlType(ControlType ct) {
        if (ct == ControlType.Edit) return "Edit";
        if (ct == ControlType.ComboBox) return "Combo";
        if (ct == ControlType.Hyperlink) return "Link";
        if (ct == ControlType.Button) return "Button";
        if (ct == ControlType.TabItem) return "Tab";
        if (ct == ControlType.MenuItem) return "Menu";
        if (ct == ControlType.ListItem) return "List";
        if (ct == ControlType.CheckBox) return "Check";
        return "";
    }

    static void CollectElementIfValid(AutomationElement el, string forcedRole, List<string> items, HashSet<string> seen, int maxItems) {
        if (items.Count >= maxItems) return;
        try {
            if (el.Current.IsOffscreen) return;
            string role = string.IsNullOrEmpty(forcedRole) ? ShortControlType(el.Current.ControlType) : forcedRole;
            if (string.IsNullOrEmpty(role)) return;
            string name = (el.Current.Name ?? "").Trim();
            if (string.IsNullOrEmpty(name)) return;
            if (name.Length > 90) name = name.Substring(0, 90);
            System.Windows.Rect rc = el.Current.BoundingRectangle;
            if (rc.IsEmpty || rc.Width < 8 || rc.Height < 8 || rc.Width > 2400 || rc.Height > 950) return;
            int rx = (int)Math.Round(rc.X);
            int ry = (int)Math.Round(rc.Y);
            int rw = (int)Math.Round(rc.Width);
            int rh = (int)Math.Round(rc.Height);
            string sig = role + "|" + name + "|" + (rx / 12) + "|" + (ry / 12);
            if (!seen.Contains(sig)) {
                seen.Add(sig);
                items.Add("{\"t\":\"" + role + "\",\"n\":\"" + EscapeJson(name) + "\",\"x\":" + rx + ",\"y\":" + ry + ",\"w\":" + rw + ",\"h\":" + rh + "}");
            }
        } catch {}
    }

    static void DumpForegroundUiTree(IntPtr customHwnd) {
        Console.OutputEncoding = Encoding.UTF8;
        IntPtr hwnd = customHwnd != IntPtr.Zero ? customHwnd : GetActiveTargetWindow();
        if (hwnd == IntPtr.Zero) {
            Console.WriteLine("{\"title\":\"\",\"process\":\"\",\"elements\":[]}");
            return;
        }
        try {
            int len = GetWindowTextLength(hwnd);
            StringBuilder sb = new StringBuilder(Math.Max(1, len + 1));
            if (len > 0) GetWindowText(hwnd, sb, sb.Capacity);
            string winTitle = sb.ToString().Trim();

            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            string procName = "";
            try { procName = Process.GetProcessById((int)pid).ProcessName; } catch {}

            AutomationElement root = AutomationElement.FromHandle(hwnd);
            List<string> items = new List<string>();
            HashSet<string> seen = new HashSet<string>();

            // Fast Win32 child lookup for Chromium/Edge active tab viewport (skips 300+ TabItems in <5ms)
            IntPtr renderChildHwnd = IntPtr.Zero;
            EnumChildWindows(hwnd, delegate(IntPtr ch, IntPtr lp) {
                if (!IsWindowVisible(ch)) return true;
                StringBuilder cls = new StringBuilder(64);
                if (GetClassName(ch, cls, cls.Capacity) > 0) {
                    if (cls.ToString() == "Chrome_RenderWidgetHostHWND") {
                        RECT cr;
                        if (GetWindowRect(ch, out cr) && (cr.Right - cr.Left) > 200 && (cr.Bottom - cr.Top) > 150) {
                            renderChildHwnd = ch;
                            return false;
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);

            // Stage 1: Jump directly into Chrome_RenderWidgetHostHWND or ControlType.Document
            try {
                AutomationElement scanRoot = null;
                if (renderChildHwnd != IntPtr.Zero) {
                    scanRoot = AutomationElement.FromHandle(renderChildHwnd);
                } else {
                    AutomationElement docRoot = root.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Document));
                    scanRoot = docRoot ?? root;
                }

                Condition editOrCombo = new OrCondition(
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ComboBox)
                );
                AutomationElementCollection inputs = scanRoot.FindAll(TreeScope.Descendants, editOrCombo);
                for (int i = 0; i < inputs.Count && items.Count < 15; i++) {
                    CollectElementIfValid(inputs[i], null, items, seen, 85);
                }

                Condition interactive = new OrCondition(
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Hyperlink),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem),
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.TabItem)
                );
                AutomationElementCollection clickables = scanRoot.FindAll(TreeScope.Descendants, interactive);
                for (int i = 0; i < clickables.Count && items.Count < 85; i++) {
                    CollectElementIfValid(clickables[i], null, items, seen, 85);
                }
            } catch {}

            // Stage 2: Quick shallow BFS fallback for outer window controls if Document yielded few items
            if (items.Count < 20) {
                TreeWalker walker = TreeWalker.ControlViewWalker;
                Queue<UiQueueNode> q = new Queue<UiQueueNode>();
                q.Enqueue(new UiQueueNode { el = root, depth = 0 });
                Stopwatch sw = Stopwatch.StartNew();
                int visited = 0;
                while (q.Count > 0 && visited < 400 && items.Count < 85 && sw.ElapsedMilliseconds < 220) {
                    UiQueueNode cur = q.Dequeue();
                    visited++;
                    if (cur.depth > 0) CollectElementIfValid(cur.el, null, items, seen, 85);
                    if (cur.depth < 10) {
                        try {
                            AutomationElement child = walker.GetFirstChild(cur.el);
                            int siblings = 0;
                            while (child != null && siblings < 35 && q.Count < 500) {
                                q.Enqueue(new UiQueueNode { el = child, depth = cur.depth + 1 });
                                child = walker.GetNextSibling(child);
                                siblings++;
                            }
                        } catch {}
                    }
                }
            }

            Console.WriteLine("{\"title\":\"" + EscapeJson(winTitle) + "\",\"process\":\"" + EscapeJson(procName) + "\",\"elements\":[" + string.Join(",", items.ToArray()) + "]}");
        } catch {
            Console.WriteLine("{\"title\":\"\",\"process\":\"\",\"elements\":[]}");
        }
    }

    static bool IsEditableFocused() {
        try {
            AutomationElement focused = AutomationElement.FocusedElement;
            if (focused == null) return false;
            ControlType ct = focused.Current.ControlType;
            return ct == ControlType.Edit || ct == ControlType.ComboBox;
        } catch {
            return false;
        }
    }

    // --- Global HID Raw Input Watcher for Stylus Pen & Touchscreen ---
    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTDEVICE {
        public ushort usUsagePage;
        public ushort usUsage;
        public uint dwFlags;
        public IntPtr hwndTarget;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTHEADER {
        public uint dwType;
        public uint dwSize;
        public IntPtr hDevice;
        public IntPtr wParam;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct HIDP_CAPS {
        public ushort Usage, UsagePage, InputReportByteLength, OutputReportByteLength, FeatureReportByteLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 17)] public ushort[] Reserved;
        public ushort NumberLinkCollectionNodes, NumberInputButtonCaps, NumberInputValueCaps, NumberInputDataIndices;
        public ushort NumberOutputButtonCaps, NumberOutputValueCaps, NumberOutputDataIndices;
        public ushort NumberFeatureButtonCaps, NumberFeatureValueCaps, NumberFeatureDataIndices;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct HIDP_VALUE_CAPS {
        public ushort UsagePage;
        public byte ReportID;
        [MarshalAs(UnmanagedType.U1)] public bool IsAlias;
        public ushort BitField, LinkCollection, LinkUsage, LinkUsagePage;
        [MarshalAs(UnmanagedType.U1)] public bool IsRange, IsStringRange, IsDesignatorRange, IsAbsolute;
        [MarshalAs(UnmanagedType.U1)] public bool HasNull;
        public byte Reserved;
        public ushort BitSize, ReportCount;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 5)] public ushort[] Reserved2;
        public uint UnitsExp, Units;
        public int LogicalMin, LogicalMax, PhysicalMin, PhysicalMax;
        public ushort UsageMin, UsageMax, StringMin, StringMax, DesignatorMin, DesignatorMax, DataIndexMin, DataIndexMax;
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);

    [DllImport("user32.dll")]
    static extern uint GetRawInputData(IntPtr hRawInput, uint uiCommand, IntPtr pData, ref uint pcbSize, uint cbSizeHeader);

    [DllImport("user32.dll")]
    static extern uint GetRawInputDeviceInfo(IntPtr hDevice, uint uiCommand, IntPtr pData, ref uint pcbSize);

    [DllImport("hid.dll")]
    static extern int HidP_GetCaps(IntPtr PreparsedData, out HIDP_CAPS Capabilities);

    [DllImport("hid.dll")]
    static extern int HidP_GetValueCaps(int ReportType, [Out] HIDP_VALUE_CAPS[] ValueCaps, ref ushort ValueCapsLength, IntPtr PreparsedData);

    [DllImport("hid.dll")]
    static extern int HidP_GetUsageValue(int ReportType, ushort UsagePage, ushort LinkCollection, ushort Usage, out uint UsageValue, IntPtr PreparsedData, IntPtr Report, uint ReportLength);

    [DllImport("hid.dll")]
    static extern int HidP_GetUsages(int ReportType, ushort UsagePage, ushort LinkCollection, [Out] ushort[] UsageList, ref uint UsageLength, IntPtr PreparsedData, IntPtr Report, uint ReportLength);

    class HidDeviceInfo {
        public IntPtr Preparsed;
        public ushort LinkCol;
        public int MinX, MaxX, MinY, MaxY;
        public bool IsTouch;
        public bool Valid;
    }

    static Dictionary<IntPtr, HidDeviceInfo> hidCache = new Dictionary<IntPtr, HidDeviceInfo>();

    static HidDeviceInfo GetHidInfo(IntPtr hDevice) {
        HidDeviceInfo cached;
        if (hidCache.TryGetValue(hDevice, out cached)) return cached;
        var info = new HidDeviceInfo { Valid = false };
        try {
            uint pSz = 0;
            GetRawInputDeviceInfo(hDevice, 0x20000005, IntPtr.Zero, ref pSz);
            if (pSz > 0) {
                IntPtr pp = Marshal.AllocHGlobal((int)pSz);
                if (GetRawInputDeviceInfo(hDevice, 0x20000005, pp, ref pSz) != unchecked((uint)-1)) {
                    HIDP_CAPS caps;
                    if (HidP_GetCaps(pp, out caps) == 0x00110000 && caps.UsagePage == 0x0D && (caps.Usage == 0x02 || caps.Usage == 0x04)) {
                        ushort vLen = caps.NumberInputValueCaps;
                        var vcaps = new HIDP_VALUE_CAPS[vLen];
                        HidP_GetValueCaps(0, vcaps, ref vLen, pp);
                        bool hasX = false, hasY = false;
                        foreach (var v in vcaps) {
                            if (v.UsagePage == 0x01 && v.UsageMin == 0x30 && !hasX) {
                                info.MinX = v.LogicalMin; info.MaxX = v.LogicalMax;
                                info.LinkCol = v.LinkCollection;
                                hasX = true;
                            } else if (v.UsagePage == 0x01 && v.UsageMin == 0x31 && (!hasY || v.LinkCollection == info.LinkCol)) {
                                info.MinY = v.LogicalMin; info.MaxY = v.LogicalMax;
                                hasY = true;
                            }
                        }
                        if (hasX && hasY && info.MaxX > info.MinX && info.MaxY > info.MinY) {
                            info.Preparsed = pp;
                            info.IsTouch = (caps.Usage == 0x04);
                            info.Valid = true;
                            hidCache[hDevice] = info;
                            return info;
                        }
                    }
                }
                Marshal.FreeHGlobal(pp);
            }
        } catch {}
        hidCache[hDevice] = info;
        return info;
    }

    class RawInputForm : Form {
        long lastEmitMs = 0;
        int lastPx = -1, lastPy = -1;
        protected override CreateParams CreateParams {
            get {
                CreateParams cp = base.CreateParams;
                cp.Parent = new IntPtr(-3); // HWND_MESSAGE
                return cp;
            }
        }
        protected override void WndProc(ref Message m) {
            if (m.Msg == 0x00FF) { // WM_INPUT
                ProcessRawInput(m.LParam);
            }
            base.WndProc(ref m);
        }
        void ProcessRawInput(IntPtr hRawInput) {
            try {
                uint hdrSz = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
                uint dwSize = 0;
                GetRawInputData(hRawInput, 0x10000003, IntPtr.Zero, ref dwSize, hdrSz);
                if (dwSize == 0 || dwSize > 4096) return;
                IntPtr buf = Marshal.AllocHGlobal((int)dwSize);
                try {
                    if (GetRawInputData(hRawInput, 0x10000003, buf, ref dwSize, hdrSz) != dwSize) return;
                    var hdr = (RAWINPUTHEADER)Marshal.PtrToStructure(buf, typeof(RAWINPUTHEADER));
                    if (hdr.dwType != 2) return; // RIM_TYPEHID
                    var dev = GetHidInfo(hdr.hDevice);
                    if (!dev.Valid) return;

                    int hidOffset = (int)hdrSz;
                    uint dwSizeHid = (uint)Marshal.ReadInt32(buf, hidOffset);
                    uint dwCount = (uint)Marshal.ReadInt32(buf, hidOffset + 4);
                    if (dwCount == 0 || dwSizeHid == 0) return;

                    IntPtr reportPtr = IntPtr.Add(buf, hidOffset + 8);
                    // Check TipSwitch (0x42) or InRange (0x32) for Touch/Pen so lift events don't jump to 0,0
                    ushort[] usages = new ushort[16];
                    uint usageLen = (uint)usages.Length;
                    bool hasActiveContact = true;
                    if (HidP_GetUsages(0, 0x0D, dev.LinkCol, usages, ref usageLen, dev.Preparsed, reportPtr, dwSizeHid) == 0x00110000) {
                        hasActiveContact = false;
                        for (uint ui = 0; ui < usageLen; ui++) {
                            if (usages[ui] == 0x42 || usages[ui] == 0x32) { hasActiveContact = true; break; }
                        }
                    }
                    if (!hasActiveContact && dev.IsTouch) return;

                    uint rawX, rawY;
                    if (HidP_GetUsageValue(0, 0x01, dev.LinkCol, 0x30, out rawX, dev.Preparsed, reportPtr, dwSizeHid) != 0x00110000) return;
                    if (HidP_GetUsageValue(0, 0x01, dev.LinkCol, 0x31, out rawY, dev.Preparsed, reportPtr, dwSizeHid) != 0x00110000) return;
                    if (rawX == 0 && rawY == 0) return;

                    Rectangle vs = SystemInformation.VirtualScreen;
                    int sx = vs.Left + (int)Math.Round(((double)(rawX - dev.MinX) / (dev.MaxX - dev.MinX)) * vs.Width);
                    int sy = vs.Top + (int)Math.Round(((double)(rawY - dev.MinY) / (dev.MaxY - dev.MinY)) * vs.Height);

                    long now = Environment.TickCount & 0x7FFFFFFF;
                    if ((Math.Abs(sx - lastPx) >= 1 || Math.Abs(sy - lastPy) >= 1) && (now - lastEmitMs >= 8)) {
                        lastPx = sx; lastPy = sy; lastEmitMs = now;
                        Console.WriteLine(sx + "," + sy);
                    }
                } finally {
                    Marshal.FreeHGlobal(buf);
                }
            } catch {}
        }
    }

    static void RunPointerWatch() {
        Console.OutputEncoding = Encoding.ASCII;
        var form = new RawInputForm();
        IntPtr hwnd = form.Handle; // force handle creation
        var rids = new RAWINPUTDEVICE[] {
            new RAWINPUTDEVICE { usUsagePage = 0x0D, usUsage = 0x02, dwFlags = 0x00000100, hwndTarget = hwnd }, // Pen
            new RAWINPUTDEVICE { usUsagePage = 0x0D, usUsage = 0x04, dwFlags = 0x00000100, hwndTarget = hwnd }  // Touch
        };
        RegisterRawInputDevices(rids, (uint)rids.Length, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
        Application.Run();
    }

    static void Main(string[] args) {
        try { SetProcessDPIAware(); } catch {}
        if (args.Length > 0) {
            string cmd = args[0].ToLowerInvariant();
            if (cmd == "screenshot_grid" && args.Length >= 6) {
                int sx, sy, sw, sh;
                if (int.TryParse(args[1], out sx) && int.TryParse(args[2], out sy) &&
                    int.TryParse(args[3], out sw) && int.TryParse(args[4], out sh)) {
                    try {
                        bool ok = CaptureScreenGrid(sx, sy, sw, sh, args[5]);
                        Console.WriteLine(ok ? "OK" : "FAIL");
                    } catch (Exception ex) {
                        Console.Error.WriteLine(ex.Message);
                        Console.WriteLine("FAIL");
                    }
                }
                return;
            }
            if (cmd == "mouse_click" && args.Length >= 3) {
                int mx, my;
                if (int.TryParse(args[1], out mx) && int.TryParse(args[2], out my)) {
                    string mode = args.Length > 3 ? args[3] : "left";
                    ExecuteMouseClick(mx, my, mode);
                    Console.WriteLine("OK");
                }
                return;
            }
            if (cmd == "scroll_at" && args.Length >= 4) {
                int mx, my;
                if (int.TryParse(args[1], out mx) && int.TryParse(args[2], out my)) {
                    SetCursorPos(mx, my);
                    Thread.Sleep(35);
                    ExecuteScroll(args[3]);
                    Console.WriteLine("OK");
                }
                return;
            }
            if (cmd == "get") {
                Console.WriteLine(GetActiveTargetWindow().ToInt64());
                return;
            }
            if (cmd == "window_control" && args.Length >= 2) {
                long hw = 0;
                if (args.Length > 2) long.TryParse(args[2], out hw);
                bool ok = ExecuteWindowControl(args[1], hw);
                Console.WriteLine(ok ? "OK" : "FAIL");
                return;
            }
            if (cmd == "fg_rect") {
                IntPtr fg = GetForegroundWindow();
                RECT r;
                if (fg != IntPtr.Zero && !IsIconic(fg) && GetWindowRect(fg, out r)) {
                    int w = r.Right - r.Left;
                    int h = r.Bottom - r.Top;
                    if (w > 120 && h > 120) {
                        Console.WriteLine("{\"x\":" + r.Left + ",\"y\":" + r.Top + ",\"width\":" + w + ",\"height\":" + h + "}");
                        return;
                    }
                }
                Console.WriteLine("null");
                return;
            }
            if (cmd == "list") {
                ListVisibleWindows();
                return;
            }
            if (cmd == "focus" && args.Length > 1) {
                long hwndVal;
                if (long.TryParse(args[1], out hwndVal) && hwndVal != 0) {
                    FocusWindow(new IntPtr(hwndVal));
                }
                return;
            }
            if (cmd == "wait_window" && args.Length > 1) {
                int timeout = 5000;
                if (args.Length > 2) int.TryParse(args[2], out timeout);
                bool found = WaitForWindow(args[1], timeout);
                Console.WriteLine(found ? "OK" : "TIMEOUT");
                return;
            }
            if (cmd == "chrome_tabs") {
                ListChromeTabs();
                return;
            }
            if (cmd == "chrome_select_tab" && args.Length > 1) {
                bool ok = SelectChromeTab(args[1]);
                Console.WriteLine(ok ? "OK" : "NOT_FOUND");
                return;
            }
            if (cmd == "hotkey" && args.Length > 1) {
                bool ok = ExecuteHotkey(args[1]);
                Console.WriteLine(ok ? "OK" : "UNSUPPORTED");
                return;
            }
            if (cmd == "scroll" && args.Length > 1) {
                int amt = 0;
                if (args.Length > 2) int.TryParse(args[2], out amt);
                bool ok = ExecuteScroll(args[1], amt);
                Console.WriteLine(ok ? "OK" : "UNSUPPORTED");
                return;
            }
            if (cmd == "screenshot_crop" && args.Length >= 6) {
                int sx, sy, sw, sh;
                if (int.TryParse(args[1], out sx) && int.TryParse(args[2], out sy) &&
                    int.TryParse(args[3], out sw) && int.TryParse(args[4], out sh)) {
                    try {
                        bool ok = CaptureScreenCrop(sx, sy, sw, sh, args[5]);
                        Console.WriteLine(ok ? "OK" : "FAIL");
                    } catch { Console.WriteLine("FAIL"); }
                }
                return;
            }
            if (cmd == "is_edit_focused") {
                Console.WriteLine(IsEditableFocused() ? "OK" : "NO");
                return;
            }
            if (cmd == "ui_tree") {
                IntPtr ch = IntPtr.Zero;
                long hv;
                if (args.Length > 1 && long.TryParse(args[1], out hv) && hv != 0) ch = new IntPtr(hv);
                DumpForegroundUiTree(ch);
                return;
            }
            if (cmd == "alt_tab") {
                SendCombo(new byte[] { VK_CONTROL, VK_MENU }, VK_TAB);
                return;
            }
            if (cmd == "taskview") {
                SendCombo(new byte[] { VK_LWIN }, VK_TAB);
                return;
            }
            if (cmd == "pointer_watch") {
                RunPointerWatch();
                return;
            }
        }

        IntPtr targetHwnd = IntPtr.Zero;
        if (args.Length > 0) {
            long val;
            if (long.TryParse(args[0], out val) && val != 0) {
                targetHwnd = new IntPtr(val);
            }
        }

        if (targetHwnd != IntPtr.Zero) {
            FocusWindow(targetHwnd);
            Thread.Sleep(90);
        } else {
            Thread.Sleep(60);
        }

        SendCombo(new byte[] { VK_CONTROL }, VK_V);
    }
}
