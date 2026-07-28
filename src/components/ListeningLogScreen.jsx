import React, { useMemo, useState } from 'react'
import { Music2, ArrowLeft, List, Globe, Play } from 'lucide-react'

import { buildListeningLog, formatDuration } from '@/utils/listeningLog'
import { buildSphereNodes, toneColor } from '@/utils/listeningSphere'
import ListeningSphere from '@/components/ListeningSphere'

const SPHERE_MODES = [
  { value: 'artists', label: 'Artists', noun: 'artists' },
  { value: 'albums', label: 'Albums', noun: 'albums' },
  { value: 'tracks', label: 'Tracks', noun: 'tracks' },
]

/**
 * A private record of what you've played. Deliberately a logbook, not a
 * year-in-review: no streaks, no goals, no comparisons, nothing to share. It
 * reports what the counts say and stops there.
 *
 * Two readings of the same counts: the log lists them, the sphere plots them.
 * Neither adds anything the other doesn't have.
 */
function ListeningLogScreen({ songs = [], playCounts = {}, onBack, onPlaySong }) {
  const [view, setView] = useState('log')
  const [sphereMode, setSphereMode] = useState('artists')
  const [selectedKey, setSelectedKey] = useState(null)

  const log = useMemo(() => buildListeningLog(songs, playCounts), [songs, playCounts])
  const tracksWithLength = useMemo(
    () => songs.filter((s) => typeof s.duration === 'number' && s.duration > 0).length,
    [songs],
  )
  const sphere = useMemo(
    () => buildSphereNodes(songs, playCounts, sphereMode),
    [songs, playCounts, sphereMode],
  )
  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs])
  const selected = useMemo(
    () => (selectedKey ? sphere.nodes.find((node) => node.key === selectedKey) ?? null : null),
    [sphere, selectedKey],
  )

  // Switching mode strands the old selection — drop it during render rather
  // than in an effect, so the panel never paints a reading that isn't there.
  if (selectedKey && !selected) setSelectedKey(null)

  const hasPlays = log.totalPlays > 0
  const modeNoun = SPHERE_MODES.find((m) => m.value === sphereMode)?.noun ?? 'entries'

  return (
    <section className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="p-2 rounded-full border border-white/15 text-gray-400 hover:text-white hover:border-white/40 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="section-title text-base sm:text-lg text-white">Listening log</h2>
          <p className="text-[11px] text-gray-500">Yours alone. Never leaves your account.</p>
        </div>
        {hasPlays && (
          <div className="shrink-0 flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5" role="group" aria-label="View">
            {[
              { value: 'log', label: 'List view', Icon: List },
              { value: 'sphere', label: 'Sphere view', Icon: Globe },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`p-1.5 rounded-full transition-colors ${view === value ? 'bg-violet-500/15 text-violet-300' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasPlays ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
          <Music2 className="w-9 h-9 text-gray-700" />
          <p>Nothing played yet.</p>
        </div>
      ) : view === 'sphere' ? (
        <SphereView
          sphere={sphere}
          mode={sphereMode}
          modeNoun={modeNoun}
          onChangeMode={(next) => { setSphereMode(next); setSelectedKey(null) }}
          selected={selected}
          onSelect={(node) => setSelectedKey(node ? node.key : null)}
          songsById={songsById}
          playCounts={playCounts}
          onPlaySong={onPlaySong}
        />
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

/**
 * The globe, its mode switch and the reading panel beside it. Stacks on a
 * phone: sphere above, panel below, both scrollable within their own box.
 */
function SphereView({ sphere, mode, modeNoun, onChangeMode, selected, onSelect, songsById, playCounts, onPlaySong }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5" role="group" aria-label="Plot by">
          {SPHERE_MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => onChangeMode(value)}
              className={`px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                mode === value ? 'bg-violet-500/15 text-violet-300' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-600 tabular-nums ml-auto">
          {sphere.nodes.length} {modeNoun}
          {sphere.truncated > 0 ? ` · ${sphere.truncated} beyond the top ${sphere.nodes.length} not plotted` : ''}
        </span>
      </div>

      {/* Both boxes carry min-h-0 so the pair always fits the page: on a phone
          the globe takes two thirds and the panel one, and the panel scrolls
          inside itself rather than pushing the globe off the bottom. */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
        <div className="flex-[2] min-h-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] glass-card overflow-hidden">
          {sphere.nodes.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-sm text-gray-500 text-center px-6">
              <Globe className="w-8 h-8 text-gray-700" />
              <p>Nothing to plot yet.</p>
              {mode === 'albums' && (
                <p className="text-xs text-gray-600 max-w-xs">
                  Album names are what group plays into records. Name a track&apos;s album and it lands here.
                </p>
              )}
            </div>
          ) : (
            <ListeningSphere
              nodes={sphere.nodes}
              selectedKey={selected?.key ?? null}
              onSelect={onSelect}
              modeLabel={modeNoun}
            />
          )}
        </div>

        <aside className="flex-1 min-h-0 lg:flex-none lg:w-80 rounded-2xl border border-white/[0.06] bg-white/[0.02] glass-card overflow-y-auto">
          {selected
            ? <SphereReading node={selected} songsById={songsById} playCounts={playCounts} onPlaySong={onPlaySong} />
            : <SphereLegend sphere={sphere} modeNoun={modeNoun} />}
        </aside>
      </div>
    </div>
  )
}

/** How to read the globe, shown until something is selected. */
function SphereLegend({ sphere, modeNoun }) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">Reading the sphere</p>
      <dl className="flex flex-col gap-2.5 text-xs">
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-gray-500">Height</dt>
          <dd className="text-gray-300 flex-1">Rank. Your most played sits at the top.</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-gray-500">Size</dt>
          <dd className="text-gray-300 flex-1">Plays. Area, not width, tracks the count.</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-gray-500">Colour</dt>
          <dd className="text-gray-300 flex-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: toneColor(0, 1) }} />
              most
              <span className="mx-1 text-gray-600">→</span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: toneColor(1, 1) }} />
              least
            </span>
          </dd>
        </div>
      </dl>
      <p className="text-[11px] text-gray-600 border-t border-white/[0.06] pt-3">
        Drag to turn, scroll or pinch to zoom, tap a dot to read it. {sphere.totalPlays.toLocaleString()} plays across {sphere.total} {modeNoun}.
      </p>
      {sphere.unfiled > 0 && (
        <p className="text-[11px] text-gray-600">
          {sphere.unfiled} played track{sphere.unfiled === 1 ? '' : 's'} carr{sphere.unfiled === 1 ? 'ies' : 'y'} no album name, so {sphere.unfiled === 1 ? 'it is' : 'they are'} not plotted here.
        </p>
      )}
    </div>
  )
}

/** The selected dot, in numbers. */
function SphereReading({ node, songsById, playCounts, onPlaySong }) {
  const tracks = node.songIds.map((id) => songsById.get(id)).filter(Boolean)
  const top = tracks.slice(0, 5)

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/[0.06] flex items-center justify-center shrink-0">
          {node.coverUrl
            ? <img src={node.coverUrl} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-5 h-5 text-gray-600" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/95 truncate">{node.label}</p>
          {node.sublabel && <p className="text-[11px] text-gray-500 truncate">{node.sublabel}</p>}
        </div>
        <span
          className="shrink-0 w-2.5 h-2.5 rounded-full"
          style={{ background: toneColor(node.tone, 1) }}
          aria-hidden
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Reading label="Plays" value={node.count.toLocaleString()} />
        <Reading label="Rank" value={`#${node.rank}`} />
        <Reading label="Share" value={`${(node.share * 100).toFixed(node.share < 0.1 ? 1 : 0)}%`} note="of all plays" />
        <Reading label="Time" value={formatDuration(node.seconds)} note="approximate" />
      </div>

      {top.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-white/[0.06] pt-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 px-1 pb-1">
            {node.tracks === 1 ? 'Track' : 'Most played tracks'}
          </p>
          {top.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => onPlaySong?.(song.id)}
              className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/[0.05] transition-colors"
            >
              <Play className="w-3 h-3 shrink-0 text-gray-600 group-hover:text-violet-300 transition-colors" fill="currentColor" strokeWidth={0} />
              <span className="text-xs text-gray-300 truncate flex-1">{song.title || song.fileName}</span>
              <span className="text-[11px] text-gray-600 tabular-nums shrink-0">{playCounts[song.id] || 0}</span>
            </button>
          ))}
          {tracks.length > top.length && (
            <p className="text-[11px] text-gray-600 px-1.5 pt-1">
              and {tracks.length - top.length} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Reading({ label, value, note }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-base text-white tabular-nums mt-0.5">{value}</p>
      {note && <p className="text-[10px] text-gray-600">{note}</p>}
    </div>
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
