import { FC } from 'react'

export const WithNewLines: FC<{ text: string }> = ({ text }) => {
  return (
    <>
      {text.split('\n').map((line, index) => (
        <span key={index}>
          {line}
          <br />
        </span>
      ))}
    </>
  )
}
