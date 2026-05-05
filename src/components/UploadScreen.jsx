import React, { useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import { Music2, Upload, FolderOpen } from 'lucide-react'

function UploadScreen({ onUpload, onDrop }) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    onDrop(e.dataTransfer.files)
  }

  return (
    <motion.div
      className="relative flex-1 flex items-center justify-center px-4 sm:px-8"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        className="relative z-10 max-w-lg w-full flex flex-col items-center gap-6 sm:gap-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Your Music, Your Way
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Upload your audio files and build your personal library.
          </p>
        </div>

        <label
          className={`cursor-pointer w-full rounded-3xl border-2 border-dashed px-10 sm:px-14 py-12 sm:py-16 flex flex-col items-center gap-4 transition-all duration-200 glass-card ${
            isDragging
              ? 'border-violet-400/80 bg-violet-500/10 scale-[1.02]'
              : 'border-white/15 bg-white/[0.03] hover:border-violet-500/60 hover:bg-white/[0.06]'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <motion.div
            animate={isDragging ? { scale: 1.15, rotate: -6 } : { scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors duration-200 ${
              isDragging ? 'bg-violet-500/25' : 'bg-white/[0.06]'
            }`}
          >
            {isDragging ? (
              <Upload className="w-10 h-10 text-violet-300" />
            ) : (
              <Music2 className="w-10 h-10 text-violet-400/70" />
            )}
          </motion.div>

          <div className="text-center">
            <p className="text-base sm:text-lg font-medium text-gray-200 mb-1">
              {isDragging ? 'Drop your audio files here' : 'Add audio files'}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-500">
              Drag &amp; drop or click to browse · MP3, FLAC, AAC, WAV and more
            </p>
          </div>

          <input
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={onUpload}
          />
        </label>

        <div className="flex items-center gap-6 text-[11px] text-gray-600">
          <span className="flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Click or drop
          </span>
          <span className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" /> Multiple files
          </span>
          <span className="flex items-center gap-1.5">
            <Music2 className="w-3.5 h-3.5" /> All formats
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default UploadScreen
