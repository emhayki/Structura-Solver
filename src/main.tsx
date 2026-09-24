import { createRoot } from "react-dom/client";
import Studio from "./components/studio";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");
createRoot(root).render(<Studio />);