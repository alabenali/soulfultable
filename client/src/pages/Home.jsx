import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* Header/Hero Section: Compact header, centered logo with tight balanced spacing */}
      <header className="w-full header-banner-texture py-5 sm:py-6 px-4 flex items-center justify-center">
        <div className="flex items-center justify-center max-w-sm w-full mx-auto">
          <img 
            src="/soulful-logo.png" 
            alt="Soulful Table" 
            className="h-auto max-w-[240px] sm:max-w-[290px] w-full object-contain filter drop-shadow-sm transition-transform hover:scale-[1.01]" 
          />
        </div>
      </header>

      {/* Content Card & Spacing: Placed close to the logo without huge empty gaps */}
      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6 mb-10 sm:mb-12">
        <div className="soulful-card p-7 sm:p-10 text-center flex flex-col items-center">
          {/* Heading in Warm Terracotta */}
          <h1 className="soulful-heading text-3xl sm:text-4xl font-normal tracking-tight mb-3 text-[#4A2E14]">
            Rejoignez la Table Soulful
          </h1>

          {/* Description */}
          <p className="text-muted text-base sm:text-lg max-w-md mx-auto mb-7 leading-relaxed">
            Rejoignez-nous pour une soirée intime & chaleureuse. Réservez votre place — nous vous enverrons tous les détails de l'événement.
          </p>

          {/* Primary CTA Button */}
          <Link to="/register" className="btn-terracotta w-full sm:w-auto text-base px-9 py-3.5">
            Réserver votre place
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Home;