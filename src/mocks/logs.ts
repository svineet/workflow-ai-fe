const ideLines = [
  '[INFO] Loading blocks…',
  '[INFO] Canvas ready',
  '[INFO] Connected Start → HTTP → LLM',
]

export function getMockLogsForIDE(): string[] {
  return ideLines
}

export function getLogsForRun(runId: string): string[] {
  const base = [
    `[RUN ${runId}] starting…`,
    '[Start] ok',
    '[HTTP] GET https://example.com → 200',
    '[LLM] prompt tokens: 123, completion tokens: 45',
    '[LLM] response: "Hello, world"',
    '[RUN] completed successfully',
  ]
  return base
} 