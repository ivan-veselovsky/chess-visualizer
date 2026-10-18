import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import ErrorBoundary from "./app/ErrorBoundary";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* A note and a Reload button rather than a blank page, for anything that
        gets past the boundaries nearer to where it happened. */}
    <ErrorBoundary what="the app">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
