'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { 
  AlertTriangle, 
  Loader2, 
  Download, 
  Upload, 
  FileJson,
  RefreshCw 
} from 'lucide-react'
import {
  resetToDefaultsAction,
  getExerciseBackupAction,
  importExercisesAction
} from '@/app/workouts/actions'
import { toast } from 'sonner' // Using sonner just in case, or just alerts

export function DataManagementToolbar() {
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Reset Logic ---
  const handleReset = async () => {
    if (confirmText !== 'RESET WORKOUTS') return

    setIsLoading(true)
    try {
      const res = await resetToDefaultsAction()
      if (res.success) {
        setIsResetOpen(false)
        setConfirmText('')
        // Ideally use a toast here
        alert(`Success! Reset ${res.count} exercises.`)
      } else {
        alert(`Error: ${res.error}`)
      }
    } catch (e) {
      alert('An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  // --- Export Logic ---
  const handleExport = async () => {
    try {
      const res = await getExerciseBackupAction()
      if (res.success && res.data) {
        const jsonString = JSON.stringify(res.data, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        
        const a = document.createElement('a')
        a.href = url
        a.download = `ironplan-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        alert('Failed to export data: ' + res.error)
      }
    } catch (e) {
      alert('Export failed unexpectedly.')
    }
  }

  // --- Import Logic ---
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('This will completely REPLACE all existing exercises with the data from the file. Are you sure?')) {
      e.target.value = '' // Reset
      return
    }

    setImportLoading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        if (!Array.isArray(json)) {
            alert('Invalid JSON: Root must be an array of exercises.')
            setImportLoading(false)
            return
        }
        
        const res = await importExercisesAction(json)
        if (res.success) {
            alert(`Successfully imported ${res.count} exercises.`)
        } else {
            alert(`Import failed: ${res.error}`)
        }
      } catch (err) {
        alert('Failed to parse JSON file.')
      } finally {
        setImportLoading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Export */}
      <Button variant="outline" size="sm" onClick={handleExport} title="Export to JSON">
        <Download className="h-4 w-4 mr-2" />
        Backup
      </Button>

      {/* Import */}
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
        disabled={importLoading}
        title="Import from JSON"
      >
        {importLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
        Restore
      </Button>

      {/* Reset */}
      <Button 
        variant="outline" 
        size="sm"
        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-900/20"
        onClick={() => setIsResetOpen(true)}
      >
        <AlertTriangle className="mr-2 h-4 w-4" />
        Reset
      </Button>

      {/* Reset Modal */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl border border-border">
            <div className="mb-4 flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Reset Database?</h2>
            </div>
            
            <p className="mb-4 text-muted-foreground text-sm">
              This will <strong className="text-foreground">permanently delete all exercises</strong> and reset the catalog to the default dataset.
            </p>

            <p className="mb-2 text-sm font-medium">
              Type <span className="font-mono font-bold text-foreground">RESET WORKOUTS</span> to confirm:
            </p>
            
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET WORKOUTS"
              className="mb-6 border-red-200 focus:border-red-500"
            />

            <div className="flex justify-end gap-3">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsResetOpen(false)
                  setConfirmText('')
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={handleReset}
                disabled={confirmText !== 'RESET WORKOUTS' || isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
