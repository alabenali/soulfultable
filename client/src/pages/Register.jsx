import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
    email: '',
    payment: 'vente_physique'
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!form.nom.trim()) newErrors.nom = 'Le nom est requis';
    if (!form.prenom.trim()) newErrors.prenom = 'Le prénom est requis';
    if (!form.telephone.trim()) newErrors.telephone = 'Le téléphone est requis';
    else if (!/^\+?[\d\s]{8,}$/.test(form.telephone)) newErrors.telephone = 'Format téléphone invalide';
    if (!form.adresse.trim()) newErrors.adresse = 'L\'adresse est requise';
    if (!form.email.trim()) newErrors.email = 'L\'email est requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Format email invalide';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        const data = await response.json();
        navigate('/confirmation', { state: { reservation: data.reservation } });
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Erreur lors de l\'enregistrement');
      }
    } catch (err) {
      alert('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Main Form Card */}
      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6 mb-10 sm:mb-12 public-content">
        <div className="soulful-card form-card p-6 sm:p-10">
          <div className="max-w-md mx-auto">
            <h1 className="soulful-heading text-2xl sm:text-3xl text-center mb-2 text-[#4A2E14]">
              Réservation — Soulful Table
            </h1>
            <p className="mb-6 text-sm text-center text-muted">
              Remplissez les informations ci-dessous pour réserver votre place.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#4A2E14]">Prénom</label>
                  <input
                    type="text"
                    value={form.prenom}
                    onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white rounded-lg border input-terracotta text-sm"
                    placeholder="Prénom"
                  />
                  {errors.prenom && <p className="text-xs text-red-600 mt-1">{errors.prenom}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#4A2E14]">Nom</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white rounded-lg border input-terracotta text-sm"
                    placeholder="Nom"
                  />
                  {errors.nom && <p className="text-xs text-red-600 mt-1">{errors.nom}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#4A2E14]">Téléphone</label>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="w-full px-4 py-3 bg-white rounded-lg border input-terracotta text-sm"
                  placeholder="+216 12 345 678"
                />
                {errors.telephone && <p className="text-xs text-red-600 mt-1">{errors.telephone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#4A2E14]">Adresse</label>
                <input
                  type="text"
                  value={form.adresse}
                  onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                  className="w-full px-4 py-3 bg-white rounded-lg border input-terracotta text-sm"
                  placeholder="Adresse complète"
                />
                {errors.adresse && <p className="text-xs text-red-600 mt-1">{errors.adresse}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#4A2E14]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white rounded-lg border input-terracotta text-sm"
                  placeholder="vous@email.com"
                />
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
              </div>

              <fieldset className="pt-2">
                <legend className="text-xs font-semibold uppercase tracking-wider text-[#4A2E14] mb-3">Mode de paiement</legend>
                <div className="space-y-2 bg-[#F9F7F3] p-4 rounded-xl border border-stone-200/80 payment-options">
                  <label className="flex items-center gap-3 cursor-pointer text-sm text-[#2C2219]">
                    <input className="h-4 w-4 accent-[#4A2E14]" type="radio" name="payment" value="vente_physique" checked={form.payment === 'vente_physique'} onChange={(e) => setForm({ ...form, payment: e.target.value })} />
                    <span>Vente physique</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-sm text-[#2C2219]">
                    <input className="h-4 w-4 accent-[#4A2E14]" type="radio" name="payment" value="transfert_bancaire" checked={form.payment === 'transfert_bancaire'} onChange={(e) => setForm({ ...form, payment: e.target.value })} />
                    <span>Transfert bancaire (RIB affiché sur la confirmation)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-sm text-[#2C2219]">
                    <input className="h-4 w-4 accent-[#4A2E14]" type="radio" name="payment" value="paiement_jour" checked={form.payment === 'paiement_jour'} onChange={(e) => setForm({ ...form, payment: e.target.value })} />
                    <span>Payer le jour J</span>
                  </label>
                </div>
              </fieldset>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-terracotta w-full py-3.5 text-base"
                >
                  {loading ? 'Enregistrement en cours...' : 'Confirmer ma réservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;