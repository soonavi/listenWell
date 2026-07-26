import React, { useMemo } from 'react'
import { Music2, ArrowLeft } from 'lucide-react'

import { buildListeningLog, formatDuration } from '@/utils/listeningLog'

/**
 * A private record of what you've played. Deliberately a logbook, not a
 * year-in-review: no streaks, no goals, no comparisons, nothing to share. It
 * reports what the counts say and stops there.
 */
function ListeningLogScreen({ songs = [], playCounts = {}, onBack, onPlaySong }) {
  const log = useMemo(() => buildListeningLog(songs, playCounts), [songs, playCounts])
  const tracksWithLength = useMemo(
    () => songs.filter((s) => typeof s.duration === 'number' && s.duration > 0).length,
    [songs],
  )

  const hasPlays = log.totalPlays > 0

  return (
    <section className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="p-2 rounded-full border border-white/15 text-gray-400 hover:text-white hover:border-white/40 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h2 className="section-title text-base sm:text-lg text-white">Listening log</h2>
          <p className="text-[11px] text-gray-500">Yours alone. Never leaves your account.</p>
        </div>
      </div>

      {!hasPlays ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
          <Music2 className="w-9 h-9 text-gray-700" />
          <p>Nothing played yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-2">
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Plays" value={log.totalPlays.toLocaleString()} />
            <Stat
              label="Time played"
              value={formatDuration(log.estimatedSeconds)}
              note={
                tracksWithLength < songs.length
                  ? `approximate · ${tracksWithLength} of ${songs.length} tracks measured`
                  : 'approximate'
              }
            />
            <Stat label="Tracks played" value={`${log.coverage.played} / ${log.coverage.total}`} note={`${log.coverage.percent}% of library`} />
            <Stat label="Never played" value={String(log.coverage.total - log.coverage.played)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Most played">
              {log.topTracks.map(({ song, count }) => (
                <Row
                  key={song.id}
                  primary={song.title || song.fileName}
                  secondary={song.artist || 'Unknown artist'}
                  trailing={`${count}`}
                  coverUrl={song.coverUrl}
                  onClick={() => onPlaySong?.(song.id)}
                />
              ))}
            </Panel>

            <Panel title="Most played artists">
              {log.topArtists.map((entry) => (
                <Row
                  key={entry.artist}
                  primary={entry.artist}
                  secondary={`${entry.tracks} track${entry.tracks === 1 ? '' : 's'}`}
                  trailing={`${entry.count}`}
                />
              ))}
            </Panel>
          </div>

          {log.neverPlayed.length > 0 && (
            <Panel title="Not played yet">
              {log.neverPlayed.map((song) => (
                <Row
                  key={song.id}
                  primary={song.title || song.fileName}
                  secondary={song.artist || 'Unknown artist'}
                  coverUrl={song.coverUrl}
                  onClick={() => onPlaySong?.(song.id)}
                />
              ))}
            </Panel>
          )}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 glass-card">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-xl text-white tabular-nums mt-1">{value}</p>
      {note && <p className="text-[10px] text-gray-600 mt-0.5">{note}</p>}
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-sm font-semibold text-gray-200">{title}</p>
      </div>
      <div className="px-2 py-2 flex flex-col">{children}</div>
    </div>
  )
}

function Row({ primary, secondary, trailing, coverUrl, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`flex items-center gap-3 rounded-xl px-2 py-2 text-left ${onClick ? 'hover:bg-white/[0.05] transition-colors' : ''}`}
    >
      {coverUrl !== undefined && (
        <div className="w-8 h-8 rounded-md overflow-hidden bg-white/[0.06] flex items-center justify-center shrink-0">
          {coverUrl
            ? <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-3.5 h-3.5 text-gray-600" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/90 truncate">{primary}</p>
        <p className="text-[11px] text-gray-500 truncate">{secondary}</p>
      </div>
      {trailing && <span className="text-xs text-gray-500 tabular-nums shrink-0">{trailing}</span>}
    </Tag>
  )
}

export default ListeningLogScreen
