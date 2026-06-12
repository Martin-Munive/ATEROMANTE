import { Brain, ChevronLeft, ChevronRight } from 'lucide-react';

export function TutorPanel() {
  return (
    <section className="tutor-panel">
      <div className="panel-heading">
        <span>Tutor</span>
        <strong><Brain size={18} />Clase magistral</strong>
      </div>
      <div className="move-verdict">
        <div className="star">★</div>
        <div>
          <strong>Cd5! es una jugada excelente</strong>
          <span>+0.58</span>
        </div>
      </div>
      <p>
        Excelente ruptura central. El caballo se instala en d5, presionando c7 y e7,
        y controla casillas clave del centro.
      </p>
      <ul>
        <li>Controlas la importante casilla e7.</li>
        <li>Limitas las piezas negras.</li>
        <li>Mejoras tu pieza desarrollándola activamente.</li>
      </ul>
      <div className="lesson-block">
        <h3>Ideas estratégicas</h3>
        <p>
          Las blancas buscan espacio en el centro y actividad de piezas. El caballo en d5
          es una pieza clave en el ataque al flanco de rey.
        </p>
      </div>
      <div className="lesson-block">
        <h3>Planes recomendados</h3>
        <ol>
          <li>Presionar con e5 en el momento oportuno.</li>
          <li>Desarrollar el alfil de c1 vía g5.</li>
          <li>Enrocar corto y atacar el flanco de rey.</li>
        </ol>
      </div>
      <div className="tutor-actions">
        <button><ChevronLeft size={16} />Anterior</button>
        <span>6 / 18</span>
        <button>Siguiente <ChevronRight size={16} /></button>
      </div>
    </section>
  );
}
