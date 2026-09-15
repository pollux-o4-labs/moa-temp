import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Planner from "../app/planner";
import { readPlannerLocation } from "../features/planner/planner-location";
import "../app/globals.css";

const url = new URL(window.location.href);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Planner initialLocation={readPlannerLocation(url)} />
  </StrictMode>
);
