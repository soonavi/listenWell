import React, { useState } from 'react'
import { Upload } from 'lucide-react'

function UploadScreen({ onUpload, onDrop }) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    onDrop(e.dataTransfer.files)
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-medium text-white/90 mb-1 text-center tracking-tight">
          Add your music
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          MP3, FLAC, WAV, AAC and more
        </p>

        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`block w-full rounded-2xl border cursor-pointer transition-all duration-150 ${
            isDragging
              ? 'border-violet-400/60 bg-violet-500/[0.06]'
              : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex flex-col items-center py-14 px-8 gap-4">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${isDragging ? 'border-violet-400/50 text-violet-300' : 'border-white/15 text-gray-500'}`}>
              <Upload className="w-4 h-4" />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-300">
                {isDragging ? 'Release to upload' : 'Drop files here or click to browse'}
              </p>
            </div>
          </div>
          <input
            type="file"
            accept="audio/*,video/webm,video/ogg,.webm,.ogg,.opus"
            multiple
            className="hidden"
            onChange={onUpload}
          />
        </label>
      </div>
    </div>
  )
}

export default UploadScreen
