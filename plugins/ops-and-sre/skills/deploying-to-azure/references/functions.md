# Functions deploy

## Prebuilt zip when the remote build cannot reach the package index

Use this whenever the app sits in a VNet that cannot reach the build CDN. Build the zip yourself:

1. Include runtime files only (a test pins the file list).
2. Install dependencies for the target platform and Python version into `.python_packages/lib/site-packages`:
   `uv pip install --target .python_packages/lib/site-packages --python-platform linux -r requirements.txt`
3. Publish with remote build off.

On Flex Consumption `az functionapp deploy` can answer 415; use the Kudu `/api/publish` endpoint instead. Afterwards list the registered functions and call the health route.

## Extension bundle

`host.json` must declare `extensionBundle` (version range `[4.*, 5.0.0)`) or non-HTTP bindings are not registered: the functions show as errored while HTTP routes 404. After every publish, check that the function list shows every expected function with no error state.

## Telemetry

Turn Application Insights sampling off (`samplingSettings.isEnabled: false`) when you count events, or counts undercount. Log lines emitted from worker-pool threads are dropped by the host; log from the invocation thread.
