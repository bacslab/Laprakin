export function BrandMark({ className = '', alt = 'Laprakin' }) {
  return <img className={`brand-mark ${className}`.trim()} src="/brand/laprakin-mark.png" alt={alt} />;
}

export default BrandMark;
