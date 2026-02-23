import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const normalizedPath = decodeURIComponent(location.pathname);

    const prestadorMatch = normalizedPath.match(
      /^\/geren[^/]*prestador(?:es)?\/([^/]+)$/i,
    );

    if (!prestadorMatch) return;

    const cpf = prestadorMatch[1];
    const destino = `/gerenciamento-prestadores/${encodeURIComponent(cpf)}`;

    if (location.pathname !== destino) {
      navigate(destino, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <a href="/" className="text-blue-500 underline hover:text-blue-700">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
