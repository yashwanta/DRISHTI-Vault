import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GLOBAL_CSS } from "./theme";

// Inject global styles
const style = document.createElement("style");
style.textContent = GLOBAL_CSS;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
