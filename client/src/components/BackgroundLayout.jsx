import { useLocation } from 'react-router-dom';

const BackgroundLayout = ({ children }) => {
  const location = useLocation();

  // Do not apply background image for admin routes
  if (location.pathname.startsWith('/admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen linen-texture text-[#2C2219] flex flex-col items-center justify-start antialiased">
      <div className="w-full flex-1 flex flex-col items-center">
        {children}
      </div>
    </div>
  );
};

export default BackgroundLayout;