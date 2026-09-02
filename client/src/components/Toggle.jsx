export default function Toggle({ checked, onChange, title, description }) {
  return <label className="toggle-control"><input type="checkbox" aria-label={title} checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-dot" /><span><b>{title}</b>{description && <small>{description}</small>}</span></label>;
}
