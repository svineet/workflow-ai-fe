# TODO (frontend)

- Add toast system for transient messages (success/error) with neobrutalist style
  - Show on IDE “Run” start/success/fail
  - Reuse for workflow create/update and API errors
  - Keep simple: stacked fixed bottom-right, 3s auto-dismiss

- Workflows
  - Use list endpoint (wired) and add delete/rename actions
  - Show webhook slug and quick copy

- IDE
  - Inspector: render block spec summary and required fields for selected node
  - Node config: simple form from `input_schema.properties` (optional)
  - Console: add toggle/collapse and auto-scroll

- Runs
  - Poll run status every 3-5s on detail page until terminal state
  - Stream logs (SSE/WebSocket) later

- Blocks
  - Show required fields from `input_schema.required`
  - Render the input nodes and output nodes
  - Change graph model for edges to be from a <node, output_connector_name> -> <node, input_connector_name>

- Block Palette
  - Group blocks by namespace (http.*, llm.*, transform.*, etc.) in palette