import type { BlockData } from '@reeywhaar/bananacms'
import { byKey, childrenOf, textOf } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'
import { BlockFrame } from './BlockFrame.tsx'
import { vote } from './poll.ts'
import { parseVotes } from './votes.ts'
import { VoteButton } from './VoteButton.tsx'

// The Main page's poll group: its question, the options in its options group,
// and their counts in its votes meta block, which each vote updates (poll.ts)
export function PollBlock(props: { poll: BlockData | undefined; locale: string }) {
  const blocks = childrenOf(props.poll)
  const votesBlock = byKey(blocks, 'votes')
  if (votesBlock?.content.type !== 'meta') return null
  const votes = parseVotes(votesBlock.content.text)
  const options = childrenOf(byKey(blocks, 'options')).flatMap((block) =>
    block.content.type === 'text'
      ? [
          {
            key: block.content.key,
            label: block.content.text,
            votes: votes[block.content.key] ?? 0,
          },
        ]
      : [],
  )
  const total = options.reduce((sum, option) => sum + option.votes, 0)
  const strings = t(props.locale)

  return (
    <BlockFrame source="CMS: page “Main page”, group poll">
      <h2 className="text-xl font-semibold">{textOf(blocks, 'question')}</h2>
      <ul className="mt-4 space-y-4">
        {options.map((option) => {
          const percent = total ? Math.round((option.votes / total) * 100) : 0
          return (
            <li key={option.key}>
              <form
                action={vote.bind(null, votesBlock.id, option.key)}
                className="flex items-center gap-4"
              >
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>{option.label}</span>
                    <span className="text-stone-500 tabular-nums">
                      {option.votes} · {percent}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-amber-100">
                    <div
                      className="h-2 rounded-full bg-amber-400 transition-[width]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                <VoteButton label={strings.vote} pendingLabel={strings.voting} />
              </form>
            </li>
          )
        })}
      </ul>
    </BlockFrame>
  )
}
