import { Gauge, UserRound } from 'lucide-react';
import { navigation } from '../data/session';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <nav>
        {navigation.map(({ icon: Icon, label }) => (
          <button className={label === 'Partida' ? 'selected' : ''} key={label}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
      <div className="profile-panel">
        <div className="profile-title"><UserRound size={18} />Mi perfil</div>
        <dl>
          <div><dt>ELO Blitz</dt><dd>1824</dd></div>
          <div><dt>ELO Rapid</dt><dd>1867</dd></div>
          <div><dt>ELO Clásico</dt><dd>1921</dd></div>
        </dl>
      </div>
      <button className="history"><Gauge size={18} />Historial de sesiones</button>
      <small className="version">Versión 0.0.1</small>
    </aside>
  );
}
