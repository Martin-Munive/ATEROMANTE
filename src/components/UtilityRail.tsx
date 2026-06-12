import { utilityTools } from '../data/session';

export function UtilityRail() {
  return (
    <aside className="utility-rail">
      {utilityTools.map(({ icon: Icon, label }) => (
        <button key={label} title={label}><Icon size={22} /><span>{label}</span></button>
      ))}
    </aside>
  );
}
