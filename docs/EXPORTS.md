# Capture exports

The editor's **Download** action exports the visible annotations and each screenshot's saved annotations. **Copy** writes the active annotated screenshot as PNG for browser clipboard compatibility. Export Image also encodes the requested format rather than renaming the original bytes.

Choose PNG or JPEG in Settings. JPEG exports use the configured quality and a white background for transparent pixels. Filename extensions match the encoded MIME type; repeated primary/full-page screenshots receive numbered names instead of overwriting each other. Capture titles edited in the editor appear in debug metadata.

With Debug Records enabled, individual downloads include screenshots plus JSON. ZIP downloads include screenshots, JSON, `network.har`, and a new `report.md` issue template containing console errors, failed requests, attachment names, and editable reproduction/expected/actual behavior sections. JSON attachment metadata lists the actual exported files without copying raw screenshot data into the report.

HTTP failures honor both browser `statusCode` and interceptor `status`; unknown response status is represented as 0 in HAR. The Download button remains busy during image preparation and cannot start duplicate downloads. Failed preparation leaves the editor open for retry.

Diagnostics follow the extension's existing redaction policy; screenshots can still contain visible private information. Review attachments before sharing. Browser tests verify PNG/JPEG decoding and annotation pixels, and unit tests cover attachment names, collision handling, ZIP contents, and HTTP failure summaries.
