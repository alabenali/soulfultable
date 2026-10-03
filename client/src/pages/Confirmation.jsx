import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

const Confirmation = () => {
  const location = useLocation();
  const reservation = location.state && location.state.reservation;
  const [rib, setRib] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setRib(data.rib);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchConfig();
  }, []);

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* Header Banner */}
      <header className="w-full header-banner-texture py-5 sm:py-6 px-4 flex items-center justify-center">
        <Link to="/" className="flex items-center justify-center max-w-xs w-full mx-auto">
          <img
            src="/soulful-logo.png"
            alt="Soulful Table"
            className="h-auto max-w-[200px] sm:max-w-[240px] w-full object-contain filter drop-shadow-sm transition-opacity hover:opacity-90"
          />
        </Link>
      </header>

      {/* Confirmation Content Card */}
      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6 mb-10 sm:mb-12 public-content">
        <div className="soulful-card confirmation-card p-8 sm:p-12 text-center flex flex-col items-center">
          <h1 className="soulful-heading text-3xl sm:text-4xl mb-3 text-[#4A2E14]">
            Votre réservation est bien reçue
          </h1>
          <p className="text-muted text-base sm:text-lg mb-8 leading-relaxed">
            Vous allez recevoir un email de confirmation avec tous les détails pratiques de l'événement.
          </p>

          <div className="w-full text-left bg-[#F9F7F3] p-6 rounded-xl border border-stone-200/80 mb-8 space-y-3 detail-panel">
            <h2 className="font-serif text-lg font-medium text-[#4A2E14]">Détails de votre réservation</h2>
            {reservation ? (
              <div className="space-y-1.5 text-sm text-[#2C2219]">
                <p><strong>Nom & Prénom :</strong> {reservation.prenom} {reservation.nom}</p>
                <p><strong>Téléphone :</strong> {reservation.telephone}</p>
                <p><strong>Email :</strong> {reservation.email}</p>
                <p><strong>Mode de paiement :</strong> <span className="capitalize">{reservation.payment_method || reservation.payment || 'Non spécifié'}</span></p>
              </div>
            ) : (
              <p className="text-sm text-muted">Réservation enregistrée avec succès.</p>
            )}

            {reservation && (reservation.payment_method === 'transfert_bancaire' || reservation.payment === 'transfert_bancaire') && (
              <div className="mt-4 pt-4 border-t border-stone-200">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-[#4A2E14] mb-1">RIB pour virement bancaire</h3>
                <p className="font-mono text-sm break-words bg-white p-3 rounded-lg border border-stone-200 text-[#4A2E14]">
                  {rib || 'RIB non configuré. Contactez l\'organisateur.'}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center w-full">
            <Link to="/" className="btn-terracotta w-full sm:w-auto px-8 py-3">
              Retour à l'accueil
            </Link>
            <a
              href="https://www.instagram.com/soulful_table/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#6B705C] hover:text-[#4A2E14] font-medium transition-colors underline underline-offset-4 py-2"
            >
              Suivez-nous sur Instagram
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Confirmation;