'use client'

import { useState } from 'react'

export type RipenessStage = {
  name: string
  color: string
  description: string
}

export function RipenessSlider(props: { stages: RipenessStage[]; label: string }) {
  const [index, setIndex] = useState(0)
  const stage = props.stages[index]

  return (
    <div className="mt-5 flex items-center gap-5">
      <div
        className="size-16 shrink-0 rounded-full border-4 border-white shadow-md transition-colors"
        style={{ backgroundColor: stage.color }}
      />
      <div className="flex-1">
        <input
          type="range"
          min={0}
          max={props.stages.length - 1}
          value={index}
          onChange={(e) => setIndex(e.currentTarget.valueAsNumber)}
          aria-label={props.label}
          className="w-full accent-amber-500"
        />
        <p className="mt-1 font-medium">{stage.name}</p>
        <p className="text-sm text-stone-600">{stage.description}</p>
      </div>
    </div>
  )
}
