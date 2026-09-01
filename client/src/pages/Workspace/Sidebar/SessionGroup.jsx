export function SessionGroup({ children, render, ...props }) {
  if (render) return render(props);
  return children || null;
}

export default SessionGroup;
