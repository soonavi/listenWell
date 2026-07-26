import React from 'react'
import { Plus, X } from 'lucide-react'

import {
  SMART_FIELDS,
  OPERATORS_BY_TYPE,
  fieldType,
  createEmptyRule,
} from '@/utils/smartPlaylists'

const selectClass =
  'rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500/60'

/**
 * Editor for a smart playlist's rules. Every track in the list is here because
 * one of these lines says so — the rules stay visible rather than becoming an
 * opaque "smart" behaviour.
 */
function SmartPlaylistRules({ definition, onChange, matchCount }) {
  const rules = definition?.rules ?? []
  const match = definition?.match ?? 'all'

  const update = (next) => onChange?.({ match, rules, ...next })

  const setRule = (index, patch) => {
    update({ rules: rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)) })
  }

  const changeField = (index, nextField) => {
    // Operators are per-type, so switching field type needs a valid operator.
    const nextType = fieldType(nextField)
    const currentOp = rules[index]?.op
    const allowed = OPERATORS_BY_TYPE[nextType] ?? []
    const op = allowed.some((o) => o.id === currentOp) ? currentOp : allowed[0]?.id
    setRule(index, { field: nextField, op, value: nextType === 'number' ? '' : '' })
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
        <span>Include songs where</span>
        <select
          value={match}
          onChange={(e) => update({ match: e.target.value })}
          className={selectClass}
          aria-label="Match all or any rule"
        >
          <option value="all">all</option>
          <option value="any">any</option>
        </select>
        <span>of these are true</span>
        {typeof matchCount === 'number' && (
          <span className="ml-auto tabular-nums text-gray-500">
            {matchCount} match{matchCount === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {rules.map((rule, index) => {
          const type = fieldType(rule.field)
          const operators = OPERATORS_BY_TYPE[type] ?? []
          return (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <select
                value={rule.field}
                onChange={(e) => changeField(index, e.target.value)}
                className={selectClass}
                aria-label="Field"
              >
                {SMART_FIELDS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>

              <select
                value={rule.op}
                onChange={(e) => setRule(index, { op: e.target.value })}
                className={selectClass}
                aria-label="Condition"
              >
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>

              {/* Boolean rules are fully expressed by their operator. */}
              {type !== 'boolean' && (
                <input
                  type={type === 'number' ? 'number' : 'text'}
                  value={rule.value ?? ''}
                  onChange={(e) => setRule(index, { value: e.target.value })}
                  placeholder={type === 'number' ? '0' : 'value'}
                  aria-label="Value"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60"
                />
              )}

              <button
                type="button"
                onClick={() => update({ rules: rules.filter((_, i) => i !== index) })}
                aria-label="Remove rule"
                className="shrink-0 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-gray-500 hover:text-white hover:border-white/40 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => update({ rules: [...rules, createEmptyRule()] })}
        className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs text-gray-300 border border-white/15 hover:border-white/40 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add rule
      </button>

      {rules.length === 0 && (
        <p className="text-[11px] text-gray-500">
          With no rules, this playlist holds your whole library.
        </p>
      )}
    </div>
  )
}

export default SmartPlaylistRules
