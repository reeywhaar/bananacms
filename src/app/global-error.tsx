'use client'

export default function Error() {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ margin: 0 }}>An unexpected error occurred.</p>
        </div>
      </body>
    </html>
  )
}
