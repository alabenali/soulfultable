import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [reservations, setReservations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const pollRef = useRef(null);

  // Fetch reservations from admin endpoint
  const fetchReservations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/reservations', {
        credentials: 'include' // send cookies
      });
      if (response.status === 401) {
        // Not authenticated, redirect to login
        navigate('/admin/login');
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors du chargement');
      }
      const data = await response.json();
      setReservations(data);
    } catch (err) {
      // If it's a network error or other, show error
      if (err.message !== 'Failed to fetch') {
        setError(err.message);
      }
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (id, newStatut) => {
    try {
      const response = await fetch(`/api/admin/reservations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statut: newStatut })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la mise à jour');
      }
      // Refetch to update UI
      await fetchReservations();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle export CSV
  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/export', {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'export');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reservations.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        navigate('/admin/login');
      } else {
        setError('Erreur lors de la déconnexion');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchReservations();
    // Poll for new reservations every 10 seconds
    pollRef.current = setInterval(() => {
      fetchReservations();
    }, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Filter reservations based on search term
  const filteredReservations = reservations.filter(res => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      res.nom.toLowerCase().includes(term) ||
      res.prenom.toLowerCase().includes(term) ||
      res.email.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full border-4 border-terracotta border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 w-full max-w-xl">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col items-center">
          <h1 className="text-center font-serif text-2xl sm:text-3xl mb-4">
            Administration - Réservations
          </h1>
          <div className="w-full max-w-xl">
            <p className="text-center text-gray-600 mb-4">
              Nombre total de réservations : {reservations.length}
            </p>
            <div className="relative mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom, prénom ou email..."
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {filteredReservations.length === 0 && reservations.length > 0 ? (
          <p className="text-center text-gray-500 py-8">Aucune réservation ne correspond à votre recherche.</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prénom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date d'inscription</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email envoyé</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReservations.map(res => (
                  <tr key={res.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{res.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{res.nom}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{res.prenom}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{res.telephone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{res.adresse}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{res.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{res.date_inscription}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={res.statut}
                        onChange={(e) => handleStatusChange(res.id, e.target.value)}
                        className="bg-white border border-gray-300 rounded-md px-2 py-1 text-sm"
                      >
                        <option value="en attente">En attente</option>
                        <option value="confirmé">Confirmé</option>
                        <option value="annulé">Annulé</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {res.email_envoye ? 'Oui' : 'Non'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {/* No action buttons beyond status dropdown */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col items-center">
          <div className="flex w-full justify-between items-center">
            <button
              onClick={handleExport}
              className="btn-primary py-2 px-4"
            >
              Exporter en CSV
            </button>
            <button
              onClick={handleLogout}
              className="ml-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminDashboard;