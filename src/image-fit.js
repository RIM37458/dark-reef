export function fitImageWithin({ width, height }, maxEdge) {
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}
