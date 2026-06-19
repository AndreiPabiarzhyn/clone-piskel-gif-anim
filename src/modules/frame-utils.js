export function reorderFrameCollections(collections, from, insertionIndex) {
  const count = collections[0]?.length || 0;
  if (!Number.isInteger(from) || from < 0 || from >= count) return from;

  let to = Math.max(0, Math.min(count, insertionIndex));
  if (to > from) to -= 1;
  if (to === from) return from;

  collections.forEach((frames) => {
    const [frame] = frames.splice(from, 1);
    frames.splice(to, 0, frame);
  });
  return to;
}
