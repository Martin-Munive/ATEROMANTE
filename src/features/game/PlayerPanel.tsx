export function PlayerPanel() {
  return (
    <section className="players">
      <div className="player-card top">
        <div className="avatar">MC</div>
        <div><strong>Carlsen, Magnus</strong><span>2835</span></div>
      </div>
      <div className="clock active">27:48 <span>+0.3s</span></div>
      <div className="opening">
        <strong>Siciliana Najdorf</strong>
        <span>Entrenamiento asistido</span>
        <dl>
          <div><dt>Política:</dt><dd>Tutor privado</dd></div>
          <div><dt>Modo:</dt><dd>Consentido</dd></div>
          <div><dt>Servidor:</dt><dd>Moderador</dd></div>
          <div><dt>Export:</dt><dd>TrainingAssistance</dd></div>
        </dl>
      </div>
      <div className="player-card bottom">
        <div className="avatar">FC</div>
        <div><strong>Caruana, Fabiano</strong><span>2804</span></div>
      </div>
      <div className="clock">24:17 <span>+0.3s</span></div>
    </section>
  );
}
