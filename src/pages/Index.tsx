import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Root route: unauthenticated visitors land on /landing,
// authenticated users go straight to the app.
const Index = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/browse" : "/landing"} replace />;
};

export default Index;
