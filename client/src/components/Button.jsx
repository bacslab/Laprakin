import { Link } from '../router';

export function Button({ children, to, variant = 'primary', className = '', type = 'button', onClick, disabled, title }) {
  const classes = `button button-${variant} ${className}`.trim();
  if (to) return <Link className={classes} to={to} title={title}>{children}</Link>;
  return <button className={classes} type={type} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

export default Button;
