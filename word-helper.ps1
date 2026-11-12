param(
    [Parameter(Mandatory=$true)]
    [string]$Action,
    [string]$FilePath = "",
    [string]$TextB64 = "",
    [string]$Mode = "document"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Decode-Text([string]$b64) {
    if ([string]::IsNullOrEmpty($b64)) { return "" }
    $bytes = [Convert]::FromBase64String($b64)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Get-OrCreateWord([bool]$createIfMissing = $true) {
    try {
        $word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
        $word.Visible = $true
        return $word
    } catch {
        if (-not $createIfMissing) {
            return $null
        }
        $word = New-Object -ComObject Word.Application
        $word.Visible = $true
        return $word
    }
}

function Activate-Word($word) {
    try {
        $word.Activate()
        if ($word.ActiveWindow) {
            $word.ActiveWindow.Activate()
        }
    } catch {}
}

function Emit-Json($obj) {
    $json = $obj | ConvertTo-Json -Compress -Depth 4
    Write-Output $json
}

try {
    switch ($Action.ToLowerInvariant()) {
        "open_new" {
            $word = Get-OrCreateWord $true
            $doc = $word.Documents.Add()
            Activate-Word $word
            Emit-Json @{ ok = $true; message = "Dokumen Word baru dibuka"; name = $doc.Name }
        }

        "open_file" {
            if ([string]::IsNullOrWhiteSpace($FilePath) -or -not (Test-Path -LiteralPath $FilePath)) {
                Emit-Json @{ ok = $false; message = "File dokumen tidak ditemukan" }
                exit 0
            }
            $word = Get-OrCreateWord $true
            $doc = $word.Documents.Open($FilePath)
            Activate-Word $word
            Emit-Json @{ ok = $true; message = "Membuka $($doc.Name)"; name = $doc.Name }
        }

        "append_text" {
            $text = Decode-Text $TextB64
            if ([string]::IsNullOrWhiteSpace($text)) {
                Emit-Json @{ ok = $false; message = "Teks catatan kosong" }
                exit 0
            }
            $word = Get-OrCreateWord $true
            if ($word.Documents.Count -eq 0) {
                $null = $word.Documents.Add()
            }
            Activate-Word $word
            $normalized = $text -replace "`r`n", "`r" -replace "`n", "`r"
            try { $word.UndoRecord.StartCustomRecord("Whisper Catat") } catch {}
            $word.Selection.TypeText($normalized)
            $word.Selection.TypeParagraph()
            try { $word.UndoRecord.EndCustomRecord() } catch {}
            Emit-Json @{ ok = $true; message = "Catatan ditulis ke Word" }
        }

        "read_text" {
            $word = Get-OrCreateWord $false
            if ($null -eq $word -or $word.Documents.Count -eq 0) {
                Emit-Json @{ ok = $false; message = "Tidak ada dokumen Word yang terbuka" }
                exit 0
            }
            $selText = ""
            try { $selText = $word.Selection.Text } catch {}
            if ($null -ne $selText -and $selText.Trim().Length -gt 2) {
                $clean = ($selText -replace "`r", "`n").TrimEnd([char]0x07, "`n")
                Emit-Json @{ ok = $true; mode = "selection"; text = $clean }
            } else {
                $docText = $word.ActiveDocument.Content.Text
                $clean = ($docText -replace "`r", "`n").TrimEnd([char]0x07, "`n")
                Emit-Json @{ ok = $true; mode = "document"; text = $clean }
            }
        }

        "replace_text" {
            $text = Decode-Text $TextB64
            $word = Get-OrCreateWord $false
            if ($null -eq $word -or $word.Documents.Count -eq 0) {
                Emit-Json @{ ok = $false; message = "Tidak ada dokumen Word yang terbuka" }
                exit 0
            }
            Activate-Word $word
            $normalized = $text -replace "`r`n", "`r" -replace "`n", "`r"
            try { $word.UndoRecord.StartCustomRecord("Whisper Perbaiki Dokumen") } catch {}
            if ($Mode -eq "selection" -and $word.Selection.Text.Trim().Length -gt 2) {
                $word.Selection.Text = $normalized
            } else {
                $word.ActiveDocument.Content.Text = $normalized
            }
            try { $word.UndoRecord.EndCustomRecord() } catch {}
            Emit-Json @{ ok = $true; message = "Dokumen berhasil diperbaiki (Ctrl+Z untuk batal)" }
        }

        "save" {
            $word = Get-OrCreateWord $false
            if ($null -eq $word -or $word.Documents.Count -eq 0) {
                Emit-Json @{ ok = $false; message = "Tidak ada dokumen Word yang terbuka" }
                exit 0
            }
            $doc = $word.ActiveDocument
            if (-not [string]::IsNullOrWhiteSpace($doc.Path) -and [string]::IsNullOrWhiteSpace($FilePath)) {
                $doc.Save()
                Emit-Json @{ ok = $true; message = "Dokumen $($doc.Name) disimpan" }
            } else {
                $target = $FilePath
                if ([string]::IsNullOrWhiteSpace($target)) {
                    $docsDir = [Environment]::GetFolderPath("MyDocuments")
                    $stamp = (Get-Date).ToString("yyyyMMdd-HHmm")
                    $target = Join-Path $docsDir "Catatan-Whisper-$stamp.docx"
                } elseif (-not [System.IO.Path]::IsPathRooted($target)) {
                    $docsDir = [Environment]::GetFolderPath("MyDocuments")
                    if (-not $target.EndsWith(".docx", [StringComparison]::OrdinalIgnoreCase)) {
                        $target += ".docx"
                    }
                    $target = Join-Path $docsDir $target
                }
                $doc.SaveAs2($target)
                Emit-Json @{ ok = $true; message = "Disimpan sebagai $([System.IO.Path]::GetFileName($target))" }
            }
        }

        default {
            Emit-Json @{ ok = $false; message = "Aksi Word tidak dikenal: $Action" }
        }
    }
} catch {
    Emit-Json @{ ok = $false; message = $_.Exception.Message }
}

