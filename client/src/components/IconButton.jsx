export function IconButton({ label, children, className = '', onClick, disabled = false, type = 'button' }) {
  return <button type={type} className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

export default IconButton;
