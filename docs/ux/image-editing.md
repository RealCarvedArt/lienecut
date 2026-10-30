# Image editing and arrangement

- JPEG/JPG imports work through file selection, drop and paste, alongside PNG/WebP/GIF. JPEG has no transparency, so its cut follows its rectangular image boundary plus the white border. Imported JPEG sizing defaults to 300 DPI.
- Each artwork row has a Rotation field accepting any finite degree value, including fractional and negative angles. Values normalize into 0–360 degrees. Rotate/R remains a convenient +90 degree step. Preview, thumbnail, exported raster and cut generation share the same rotation geometry.
- Selection bounds, pointer hit area, resizing, keyboard movement and edge clamping include the white border. Edited individual images retain a 3 mm sheet-edge safety margin in addition to the border. Precomposed whole sheets retain their original placement until explicitly moved/resized/rotated/arranged.
- Arrange includes every artwork item, including whole-sheet imports. It tries three packing orders and quarter-turn orientations, then searches a common proportional scale if original sizes do not fit. It never enlarges art, preserves aspect ratios and leaves 1.5 mm between border bounding boxes. The resulting scale is reported in session feedback.
- If the physical borders cannot fit while maintaining usable artwork size (3 mm shortest source dimension, or existing smaller size), arrangement reports the limit and leaves the layout unchanged. Packing uses rotated bounding rectangles, not interlocking contour nesting.

Verification: `npm test` (16 passing), `node tools/ui-check.mjs`, `node tools/layout-check.mjs`. Synthetic JPEG browser tests cover rotation, dragging from border pixels, edge clamping, all-image packing including a full-sheet PNG, and narrow layouts. Geometry tests cover mixed sizes, border widths, rotation, no overlap, no clipping, proportional scaling, unchanged input on failure, and invalid inputs. Screenshot: dist/ui-review/arranged-jpegs.png.

Physical printer/calibration/cancellation testing was not performed.

## Visible-shape placement update (2026-10-27)
Placement, edge fitting, dimensions and hit testing now use opaque pixel runs captured on import. Transparent corners and holes do not intercept selection, and rotated transparent canvas corners can extend beyond the safe margin while the visible artwork and white border stay inside it. Manual overlaps remain allowed. Arrange uses the tighter visible extents but still packs rectangles around those extents rather than interlocking contours. The selection box is a visual editing aid, not a collision obstacle.

Verification: 18 unit tests pass, including a rotated circle fitting at original size where its rotated canvas rectangle cannot, and click-through of transparent gaps to underlying artwork. Browser checks verify rotated circle placement against the page edge without size changes, plus the existing free-rotation, live-border, JPEG and compact-card workflows.
