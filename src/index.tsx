import React from "react";
import ReactDOM from "react-dom/client";
import { LanguageProvider } from "./shared/language";
import App from "./app/App";

import "./index.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(<LanguageProvider><App /></LanguageProvider>);
