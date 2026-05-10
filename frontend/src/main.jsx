/**
 * Application Entry Point
 *
 * Mounts the React app into the DOM root element.
 * Wraps the app in StrictMode for development-time checks.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);