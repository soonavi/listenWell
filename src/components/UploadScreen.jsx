import React from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'

function UploadScreen({ onUpload }) {
  return (
    <motion.div
      className="relative flex-1 flex items-center justify-center px-4 sm:px-8"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        className="relative z-10 max-w-lg w-full flex flex-col items-center gap-5 sm:gap-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Welcome to ListenWell
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Bring your audio files in, customize them, and play them your way.
          </p>
        </div>
        <label className="cursor-pointer w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-10 sm:px-14 py-8 sm:py-10 flex flex-col items-center gap-3 hover:border-violet-500/60 hover:bg-white/[0.06] transition-all duration-200 glass-card">
          <span className="text-sm sm:text-base text-gray-200">
            Add audio files
          </span>
          <span className="text-[11px] sm:text-xs text-gray-500">
            Drag &amp; drop or click to browse
          </span>
          <input
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={onUpload}
          />
        </label>
      </motion.div>
    </motion.div>
  )
}

export default UploadScreen
