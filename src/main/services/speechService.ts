import { ChildProcess, spawn } from 'child_process'
import { BrowserWindow } from 'electron'

let proc: ChildProcess | null = null

// Script PowerShell — Windows Speech Recognition (SAPI 5, hors-ligne, fr-FR)
const PS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$engine = $null
try {
  try {
    $ci = [System.Globalization.CultureInfo]::GetCultureInfo('fr-FR')
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($ci)
  } catch {
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  }
  $engine.SetInputToDefaultAudioDevice()
  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $null = Register-ObjectEvent -InputObject $engine -EventName SpeechRecognized -SourceIdentifier 'SR_DIC'
  $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
  [Console]::WriteLine('STARTED')
  [Console]::Out.Flush()
  while ($true) {
    foreach ($evt in @(Get-Event -SourceIdentifier SR_DIC -ErrorAction SilentlyContinue)) {
      $t = $evt.SourceEventArgs.Result.Text
      $c = $evt.SourceEventArgs.Result.Confidence
      if ($c -gt 0.15 -and $t.Trim().Length -gt 0) {
        [Console]::WriteLine('RESULT:' + $t)
        [Console]::Out.Flush()
      }
      Remove-Event -EventIdentifier $evt.EventIdentifier -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 80
  }
} catch {
  [Console]::WriteLine('ERROR:' + $_.Exception.Message)
  [Console]::Out.Flush()
} finally {
  if ($engine) { try { $engine.RecognizeAsyncStop(); $engine.Dispose() } catch {} }
  Unregister-Event -SourceIdentifier SR_DIC -ErrorAction SilentlyContinue
}
`

function getWin(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0]
}

export function startWindowsSpeech(): void {
  if (proc) stopWindowsSpeech()

  proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  proc.stdout?.on('data', (buf: Buffer) => {
    for (const line of buf.toString('utf8').split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (t === 'STARTED')              getWin()?.webContents.send('speech:started')
      else if (t.startsWith('RESULT:')) getWin()?.webContents.send('speech:result', t.slice(7))
      else if (t.startsWith('ERROR:'))  getWin()?.webContents.send('speech:error', t.slice(6))
    }
  })

  proc.on('exit', () => {
    proc = null
    getWin()?.webContents.send('speech:stopped')
  })
}

export function stopWindowsSpeech(): void {
  if (proc) {
    proc.kill()
    proc = null
  }
}
