'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { Download, Upload, Loader2 } from 'lucide-react'
import {
  getSessionHistoryBackupAction,
  importSessionHistoryAction,
  type ExportedSession
} from '@/app/progress/actions'

interface SessionHistoryToolbarProps {
  onImportSuccess: () => void
}

export function SessionHistoryToolbar({ onImportSuccess }: SessionHistoryToolbarProps) {
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await getSessionHistoryBackupAction()
      if (res.success && res.data) {
        const jsonString = JSON.stringify(res.data, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = `ironplan-session-history-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast(`Exported ${res.data.length} session(s) to file.`, 'success')
      } else {
        toast('Failed to export session history: ' + res.error, 'error')
      }
    } catch {
      toast('Export failed unexpectedly.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPendingFile(file)
    }
  }

  const executeImport = async () => {
    if (!pendingFile) return

    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        if (!Array.isArray(json)) {
          toast('Invalid JSON: Root must be an array of sessions.', 'error')
          setImporting(false)
          setPendingFile(null)
          return
        }

        const res = await importSessionHistoryAction(json as ExportedSession[])
        if (res.success) {
          const messages: string[] = []
          if (res.imported && res.imported > 0) {
            messages.push(`Imported ${res.imported} session(s)`)
          }
          if (res.skipped && res.skipped > 0) {
            messages.push(`Skipped ${res.skipped} duplicate(s)`)
          }
          toast(messages.join('. ') || 'Import completed.', 'success')
          onImportSuccess()
        } else {
          toast(`Import failed: ${res.error}`, 'error')
        }
      } catch {
        toast('Failed to parse JSON file.', 'error')
      } finally {
        setImporting(false)
        setPendingFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(pendingFile)
  }

  const cancelImport = () => {
    setPendingFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          title="Export session history to JSON"
          className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportClick}
          disabled={importing}
          title="Import session history from JSON"
          className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Import
        </Button>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingFile)}
        onClose={cancelImport}
        onConfirm={executeImport}
        title="Import Session History"
        description={`Import sessions from "${pendingFile?.name}"? Duplicate sessions (matching start times) will be skipped.`}
        confirmText="Import"
        variant="info"
        isLoading={importing}
      />
    </>
  )
}
