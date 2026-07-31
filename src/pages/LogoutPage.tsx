import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../services/api";

function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    clearAuth();
    navigate("/", { replace: true });
  }, [navigate]);

  return null;
}

export default LogoutPage;
