Set WshShell = CreateObject("WScript.Shell")
appDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = appDir
Set env = WshShell.Environment("PROCESS")
On Error Resume Next
env.Remove "ELECTRON_RUN_AS_NODE"
On Error GoTo 0
WshShell.Run """" & appDir & "\node_modules\electron\dist\electron.exe"" .", 0, False
