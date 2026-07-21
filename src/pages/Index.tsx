import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Root route: unauthenticated visitors land on /landingpage2,
// authenticated users go straight to the app.
const Index = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/discover" : "/landingpage2"} replace />;
};

export default Index;
