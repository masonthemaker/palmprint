# @palmprint/widget

Standalone Palmprint script-tag bundle for non-React sites.

```html
<script
  src="https://cdn.example.com/palmprint-widget.js"
  data-api-base="https://your-app.example/api/palmprint"
  data-widget="checkbox"
  defer
></script>
```

The bundle dispatches `palmprint:verified` with the same signed result shape as
the React SDK when `data-api-base` points at Palmprint server routes.
