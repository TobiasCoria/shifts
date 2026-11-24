export default function Brand({ subtitle, compact = false, light = false }) {
  return <div className={`shifts-brand${light ? ' shifts-brand-light' : ''}${compact ? ' shifts-brand-compact' : ''}`}>
    <span className="shifts-brand-mark"><img src="/shifts-mark.svg" alt="" /></span>
    <span className="shifts-brand-copy"><strong>SHIFTS</strong>{subtitle && <small>{subtitle}</small>}</span>
  </div>;
}
